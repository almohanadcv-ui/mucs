# Starts the local, user-owned Postgres + Redis dev instances for MICA MAB.
# These are NOT Windows services and require no admin rights: Postgres runs its
# own data directory under %LOCALAPPDATA%\mica-mab\pgdata on port 5434 (5432/5433
# are occupied by pre-existing system Postgres installs on this machine), and
# Redis is a portable build with no install step, on the standard port 6379.
# Safe to re-run: it detects services that are already up.

$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$pgData = "$env:LOCALAPPDATA\mica-mab\pgdata"
$pgLog = "$env:LOCALAPPDATA\mica-mab\pg.log"
$redisDir = "$env:LOCALAPPDATA\mica-mab\redis\Redis-8.8.0-Windows-x64-msys2"
$redisDataDir = "$env:LOCALAPPDATA\mica-mab\redisdata"

# Postgres
$pgReady = & "$pgBin\pg_isready.exe" -p 5434 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Postgres (dev, port 5434) already running."
} else {
    & "$pgBin\pg_ctl.exe" -D $pgData -l $pgLog -o "-p 5434" start
    Start-Sleep -Seconds 2
    & "$pgBin\pg_isready.exe" -p 5434
}

# Redis
$redisUp = $null
try { $redisUp = & "$redisDir\redis-cli.exe" -p 6379 ping } catch { $redisUp = $null }
if ($redisUp -eq "PONG") {
    Write-Host "Redis (dev, port 6379) already running."
} else {
    New-Item -ItemType Directory -Force -Path $redisDataDir | Out-Null
    Start-Process -FilePath "$redisDir\redis-server.exe" `
        -ArgumentList "--port 6379 --dir `"$redisDataDir`" --save 60 1" `
        -WindowStyle Hidden
    Start-Sleep -Seconds 2
    & "$redisDir\redis-cli.exe" -p 6379 ping
}
