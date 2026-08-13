# Creates the local dev database and writes backend/.env.
#
# The name is trailshare_dev, not trailshare: this machine already has an
# unrelated `trailshare` database managed by Flyway, and TypeORM's dev-mode
# synchronize would try to reshape its tables.
#
# Run this yourself in a terminal — it prompts for your PostgreSQL superuser
# password, so it is not something an agent should run on your behalf:
#
#   powershell -File scripts\setup-db.ps1
#
# Re-running is safe: an existing database is left alone and .env is only
# rewritten if you confirm.

$ErrorActionPreference = 'Stop'

$dbName = 'trailshare_dev'
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
        "SELECT 1 FROM pg_database WHERE datname='$dbName'"

    if ($exists -eq '1') {
        # Reusing a database someone else owns is how you lose their data:
        # TypeORM runs with synchronize on in dev and will happily reshape a
        # table it did not create. Only adopt a database that is empty or
        # already ours.
        $foreign = & "$pgBin\psql.exe" -U $superuser -d $dbName -tAc @"
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name NOT IN ('users','routes','waypoints','tours','bookings')
"@
        if ([int]$foreign -gt 0) {
            throw "Database `"$dbName`" already exists and contains tables this project does not own (for example a flyway_schema_history from another app). Refusing to touch it. Pick a different name by editing `$dbName in this script, or drop that database yourself first."
        }
        Write-Host "Database `"$dbName`" already exists and looks like ours — leaving it as is."
    }
    else {
        & "$pgBin\createdb.exe" -U $superuser $dbName
        Write-Host "Created database `"$dbName`"."
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
DB_NAME=$dbName
"@ | Set-Content -Path $envPath -Encoding utf8

    Write-Host "Wrote $envPath (git-ignored)."
    Write-Host 'Now run: cd backend; npm run start:dev'
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
