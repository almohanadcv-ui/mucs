# Stops the local dev Postgres + Redis instances started by dev-infra-start.ps1.

$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$pgData = "$env:LOCALAPPDATA\mica-mab\pgdata"

& "$pgBin\pg_ctl.exe" -D $pgData stop -m fast
Get-Process -Name "redis-server" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Dev Postgres and Redis stopped."
