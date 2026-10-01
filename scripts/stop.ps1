$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$stateFile = Join-Path $root 'var\processes.json'
if (!(Test-Path $stateFile)) { Write-Host 'SimpleMam is not running.'; exit 0 }
$records = @(Get-Content $stateFile -Raw | ConvertFrom-Json)
$failed = @()
foreach ($record in ($records | Sort-Object order -Descending)) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if (!$process) { continue }
    # PID reuse must never terminate another application.
    if ($process.StartTime.ToUniversalTime().ToString('o') -ne $record.started) {
        Write-Warning "PID $($record.id) belongs to another process. Skipped."
        continue
    }
    & taskkill.exe /PID $record.id /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { $failed += $record }
}
if ($failed.Count) {
    ConvertTo-Json -InputObject @($failed) | Set-Content $stateFile -Encoding UTF8
    Write-Error 'Some SimpleMam processes could not be stopped.'
    exit 1
}
Remove-Item $stateFile
Write-Host 'SimpleMam stopped.'
