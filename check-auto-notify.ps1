# Auto-notify checker script
# Runs every 1 hour to check for high readings

$url = "http://localhost:3000/api/auto-notify"

Write-Host "Starting auto-notify checker (every 1 hour)..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

while ($true) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "$timestamp - Response: $($response.StatusCode)" -ForegroundColor Cyan
        Write-Host $response.Content
    } catch {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "$timestamp - Error: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Next check in 1 hour..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3600
}
