$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$python = Join-Path $root '.venv\Scripts\python.exe'
$configFile = Join-Path $root 'simplemam.toml'
$stateFile = Join-Path $root 'var\processes.json'
$script:records = @()
function Save-Process($process, $order) {
    $script:records += [PSCustomObject]@{ id = $process.Id; started = $process.StartTime.ToUniversalTime().ToString('o'); order = $order }
    ConvertTo-Json -InputObject @($script:records) | Set-Content $stateFile -Encoding UTF8
}
function Wait-Url($url, $process, $attempts = 30) {
    for ($i = 0; $i -lt $attempts; $i++) {
        $process.Refresh()
        if ($process.HasExited) { throw "A process exited before $url became ready. See var/log." }
        try {
            $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "Startup timed out: $url. See var/log."
}
try {
    if (!(Test-Path $python)) { throw 'Run setup-simplemam.bat first.' }
    if (!(Test-Path $configFile)) { throw 'Copy simplemam.example.toml to simplemam.toml and edit it.' }
    if (Test-Path $stateFile) { throw 'Run stop-simplemam.bat before starting again.' }
    $cfgJson = & $python (Join-Path $PSScriptRoot 'read-config.py') $configFile
    if ($LASTEXITCODE -ne 0) { throw 'Could not read simplemam.toml.' }
    $cfg = $cfgJson | ConvertFrom-Json
    foreach ($port in @($cfg.backend_port, $cfg.frontend_port, $cfg.nginx_port)) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            throw "Port $port is already in use. No process was stopped."
        }
    }
    if (!(Test-Path $cfg.nginx_exe)) { throw 'Set server.nginx_exe to the nginx.exe path.' }
    $next = Join-Path $root 'frontend\node_modules\next\dist\bin\next'
    if (!(Test-Path 'frontend\.next\BUILD_ID')) { throw 'Run setup-simplemam.bat to build the frontend.' }
    $node = (Get-Command node.exe).Source
    New-Item -ItemType Directory -Force 'var\log', 'var\nginx\logs' | Out-Null
    $env:SIMPLEMAM_CONFIG = $configFile
    $backend = Start-Process $python -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', $cfg.host, '--port', $cfg.backend_port) -WorkingDirectory (Join-Path $root 'backend') -PassThru -RedirectStandardOutput (Join-Path $root 'var\log\backend.stdout.log') -RedirectStandardError (Join-Path $root 'var\log\backend.stderr.log')
    Save-Process $backend 1
    Wait-Url "http://$($cfg.host):$($cfg.backend_port)/api/health" $backend
    $frontend = Start-Process $node -ArgumentList @("`"$next`"", 'start', '--hostname', $cfg.host, '--port', $cfg.frontend_port) -WorkingDirectory (Join-Path $root 'frontend') -PassThru -RedirectStandardOutput (Join-Path $root 'var\log\frontend.stdout.log') -RedirectStandardError (Join-Path $root 'var\log\frontend.stderr.log')
    Save-Process $frontend 2
    Wait-Url "http://$($cfg.host):$($cfg.frontend_port)/login" $frontend
    $template = Get-Content 'infra\nginx.conf.template' -Raw
    $template = $template.Replace('__HOST__', $cfg.host).Replace('__BACKEND_PORT__', [string]$cfg.backend_port).Replace('__FRONTEND_PORT__', [string]$cfg.frontend_port).Replace('__NGINX_PORT__', [string]$cfg.nginx_port)
    $nginxConfig = Join-Path $root 'var\nginx\nginx.conf'
    [System.IO.File]::WriteAllText($nginxConfig, $template, (New-Object System.Text.UTF8Encoding($false)))
    $prefix = (Join-Path $root 'var\nginx').Replace('\', '/') + '/'
    & $cfg.nginx_exe -t -p $prefix -c 'nginx.conf'
    if ($LASTEXITCODE -ne 0) { throw 'nginx configuration check failed.' }
    $nginx = Start-Process $cfg.nginx_exe -ArgumentList @('-p', "`"$prefix`"", '-c', 'nginx.conf') -WorkingDirectory (Join-Path $root 'var\nginx') -PassThru
    Save-Process $nginx 3
    Wait-Url "http://127.0.0.1:$($cfg.nginx_port)/api/health" $nginx
    $url = "http://localhost:$($cfg.nginx_port)/pc/materials"
    Write-Host "SimpleMam started: $url"
    Start-Process $url
} catch {
    Write-Host "Startup failed: $_"
    if ($script:records.Count) { & (Join-Path $PSScriptRoot 'stop.ps1') }
    exit 1
}
