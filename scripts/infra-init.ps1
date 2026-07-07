# One-time local dev infrastructure setup
# Run once from the repo root before starting development.
# conda does NOT need to be activated first — all postgres commands use 'conda run -n api-catalog'.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$DataDir  = Join-Path $RepoRoot 'local-data'

# Create data directories
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'pgdata')    | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'redis')     | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataDir 'minio-data')| Out-Null

# --- Postgres (via conda run — no PATH manipulation needed) ---
Write-Host '==> Initialising Postgres data directory...'
conda run -n api-catalog initdb -D "$DataDir\pgdata" --username=api_catalog --auth=trust --encoding=UTF8

Write-Host '==> Starting Postgres to create databases...'
conda run -n api-catalog pg_ctl start -D "$DataDir\pgdata" -l "$DataDir\pgdata\postgres.log" -w

Write-Host '==> Creating databases...'
conda run -n api-catalog createdb --username=api_catalog api_catalog
conda run -n api-catalog createdb --username=api_catalog api_catalog_test

conda run -n api-catalog pg_ctl stop -D "$DataDir\pgdata" -m fast
Write-Host '==> Postgres stopped (start again with: pnpm run infra:start)'

# --- Redis standalone binary (redis-windows project, Windows build of Redis 7) ---
# redis-server is NOT on conda-forge for Windows; download the standalone binary.
$RedisDir = Join-Path $DataDir 'redis-bin'
$RedisExe = Join-Path $RedisDir 'redis-server.exe'
if (-not (Test-Path $RedisExe)) {
    Write-Host '==> Downloading Redis for Windows (redis-windows/redis-windows)...'
    New-Item -ItemType Directory -Force -Path $RedisDir | Out-Null
    $RedisZip = Join-Path $DataDir 'redis-windows.zip'
    # Official Windows builds from the redis-windows community project
    Invoke-WebRequest `
        -Uri 'https://github.com/redis-windows/redis-windows/releases/download/7.4.4/Redis-7.4.4-Windows-x64-cygwin.zip' `
        -OutFile $RedisZip
    Expand-Archive -Path $RedisZip -DestinationPath $RedisDir -Force
    Remove-Item $RedisZip
    # The zip extracts to a subdirectory; find redis-server.exe wherever it landed
    $Found = Get-ChildItem -Path $RedisDir -Filter 'redis-server.exe' -Recurse | Select-Object -First 1
    if ($Found) {
        Copy-Item $Found.FullName $RedisExe
        Write-Host "    Redis binary saved to $RedisExe"
    } else {
        Write-Error 'redis-server.exe not found in downloaded archive'
    }
} else {
    Write-Host "==> Redis binary already exists at $RedisExe"
}

# --- MinIO standalone binary ---
$MinioExe = Join-Path $DataDir 'minio.exe'
if (-not (Test-Path $MinioExe)) {
    Write-Host '==> Downloading MinIO standalone binary...'
    Invoke-WebRequest `
        -Uri 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe' `
        -OutFile $MinioExe
    Write-Host "    Saved to $MinioExe"
} else {
    Write-Host "==> MinIO already downloaded at $MinioExe"
}

Write-Host ''
Write-Host 'Local infrastructure ready.'
Write-Host '  Start services : pnpm run infra:start'
Write-Host '  Stop services  : pnpm run infra:stop'
