# Stop local dev infrastructure

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$DataDir  = Join-Path $RepoRoot 'local-data'

Write-Host '==> Stopping Postgres...'
conda run -n api-catalog pg_ctl stop -D "$DataDir\pgdata" -m fast 2>&1 | Out-Null
Write-Host '    Done'

Write-Host '==> Stopping Redis...'
redis-cli shutdown 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Stop-Process -Name 'redis-server' -Force -ErrorAction SilentlyContinue
}
Write-Host '    Done'

Write-Host '==> Stopping MinIO...'
Stop-Process -Name 'minio' -Force -ErrorAction SilentlyContinue
Write-Host '    Done'

Write-Host ''
Write-Host 'All local services stopped.'
