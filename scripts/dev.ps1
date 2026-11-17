# Run API + frontend dev server together.
# Usage: pwsh scripts/dev.ps1  (or: powershell scripts/dev.ps1)
param()

$root = & git rev-parse --show-toplevel
Set-Location $root

if (-not (Test-Path '.venv\Scripts\petmonitor-api.exe')) {
    Write-Host "Error: .venv\Scripts\petmonitor-api.exe not found." -ForegroundColor Red
    Write-Host "       Run: pip install -e . (inside .venv) first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  PetMonitor AI -- dev" -ForegroundColor Green
Write-Host "  API  -> http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  UI   -> http://localhost:5173" -ForegroundColor Magenta
Write-Host "  Ctrl+C to stop both" -ForegroundColor DarkGray
Write-Host ""

$api = Start-Job -Name "API" -ScriptBlock {
    Set-Location $using:root
    & ".venv\Scripts\petmonitor-api.exe" 2>&1
}

$ui = Start-Job -Name "UI" -ScriptBlock {
    Set-Location $using:root
    npm run dev --prefix frontend 2>&1
}

try {
    while ($true) {
        $apiLines = Receive-Job $api
        foreach ($line in $apiLines) {
            Write-Host "[API] " -ForegroundColor Cyan -NoNewline
            Write-Host $line
        }
        $uiLines = Receive-Job $ui
        foreach ($line in $uiLines) {
            Write-Host "[UI ] " -ForegroundColor Magenta -NoNewline
            Write-Host $line
        }
        if ($api.State -ne 'Running' -and $ui.State -ne 'Running') { break }
        Start-Sleep -Milliseconds 200
    }
} finally {
    Stop-Job  $api, $ui -ErrorAction SilentlyContinue
    Remove-Job $api, $ui -Force -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "  Stopped." -ForegroundColor Yellow
}
