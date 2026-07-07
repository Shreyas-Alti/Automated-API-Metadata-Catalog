# Start local dev infrastructure
# Prerequisites: scripts/infra-init.ps1 already run once.
# conda does NOT need to be activated first — pg_ctl uses 'conda run -n api-catalog'.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$DataDir  = Join-Path $RepoRoot 'local-data'

# --- Postgres ---
Write-Host '==> Starting Postgres...'
conda run -n api-catalog pg_ctl start -D "$DataDir\pgdata" -l "$DataDir\pgdata\postgres.log" -w
Write-Host '    Postgres listening on port 5432'

# --- Redis (standalone binary downloaded by infra-init.ps1) ---
Write-Host '==> Starting Redis...'
$RedisDir = Join-Path $DataDir 'redis-bin'
$RedisExe = Join-Path $RedisDir 'redis-server.exe'
$RedisLog = Join-Path $DataDir 'redis\redis.log'
Start-Process `
    -FilePath $RedisExe `
    -ArgumentList '--port', '6379', '--loglevel', 'notice' `
    -WindowStyle Hidden `
    -RedirectStandardOutput $RedisLog
Write-Host '    Redis listening on port 6379'

# --- MinIO ---
Write-Host '==> Starting MinIO...'
$MinioExe  = Join-Path $DataDir 'minio.exe'
$MinioData = Join-Path $DataDir 'minio-data'
$env:MINIO_ROOT_USER     = 'minioadmin'
$env:MINIO_ROOT_PASSWORD = 'minioadmin_dev'
Start-Process `
    -FilePath $MinioExe `
    -ArgumentList 'server', $MinioData, '--console-address', ':9001' `
    -WindowStyle Hidden
Write-Host '    MinIO API on port 9000, console on port 9001'

Write-Host ''
Write-Host 'All local services started.'
Write-Host '  DATABASE_URL  = postgresql://api_catalog@localhost:5432/api_catalog'
Write-Host '  REDIS_URL     = redis://localhost:6379'
Write-Host '  S3_ENDPOINT   = http://localhost:9000'
