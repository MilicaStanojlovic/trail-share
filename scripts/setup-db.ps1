# Creates the local `trailshare` database and writes backend/.env.
#
# Run this yourself in a terminal — it prompts for your PostgreSQL superuser
# password, so it is not something an agent should run on your behalf:
#
#   powershell -File scripts\setup-db.ps1
#
# Re-running is safe: an existing database is left alone and .env is only
# rewritten if you confirm.

$ErrorActionPreference = 'Stop'

$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot 'backend\.env'

if (-not (Test-Path $pgBin)) {
    throw "PostgreSQL 16 not found at $pgBin. Adjust `$pgBin in this script."
}

$service = Get-Service -Name 'postgresql-x64-16' -ErrorAction SilentlyContinue
if ($service -and $service.Status -ne 'Running') {
    Write-Host 'Starting the PostgreSQL service...'
    Start-Service -Name 'postgresql-x64-16'
}

$superuser = Read-Host 'PostgreSQL superuser name (press Enter for "postgres")'
if ([string]::IsNullOrWhiteSpace($superuser)) { $superuser = 'postgres' }

$securePassword = Read-Host "Password for $superuser" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)
$env:PGPASSWORD = $plainPassword

try {
    $exists = & "$pgBin\psql.exe" -U $superuser -d postgres -tAc `
        "SELECT 1 FROM pg_database WHERE datname='trailshare'"

    if ($exists -eq '1') {
        Write-Host 'Database "trailshare" already exists — leaving it as is.'
    }
    else {
        & "$pgBin\createdb.exe" -U $superuser trailshare
        Write-Host 'Created database "trailshare".'
    }

    if (Test-Path $envPath) {
        $answer = Read-Host 'backend\.env exists. Overwrite it? (y/N)'
        if ($answer -ne 'y') {
            Write-Host 'Left backend\.env untouched. Done.'
            return
        }
    }

    @"
NODE_ENV=development
PORT=8086
CORS_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USER=$superuser
DB_PASSWORD=$plainPassword
DB_NAME=trailshare
"@ | Set-Content -Path $envPath -Encoding utf8

    Write-Host "Wrote $envPath (git-ignored)."
    Write-Host 'Now run: cd backend; npm run start:dev'
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
