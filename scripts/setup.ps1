$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
try {
    if (!(Test-Path 'simplemam.toml')) {
        Copy-Item 'simplemam.example.toml' 'simplemam.toml'
        Write-Host 'Created simplemam.toml. Edit database and media folders before starting (nginx_exe only when using nginx).'
    }
    if (!(Test-Path '.venv\Scripts\python.exe')) {
        & py -3 -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Python 3.11 or newer is required.' }
    }
    & '.venv\Scripts\python.exe' -m pip install -e './backend'
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
    $cfgJson = & '.venv\Scripts\python.exe' (Join-Path $PSScriptRoot 'read-config.py') (Join-Path $root 'simplemam.toml')
    if ($LASTEXITCODE -ne 0) { throw 'Could not read simplemam.toml.' }
    $cfg = $cfgJson | ConvertFrom-Json
    $env:SIMPLEMAM_BACKEND_URL = "http://$($cfg.host):$($cfg.backend_port)"
    Push-Location 'frontend'
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
    Write-Host 'Setup complete. Run start-simplemam.bat or start-simplemam-no-nginx.bat after configuring simplemam.toml.'
} catch { Write-Error $_; exit 1 }
