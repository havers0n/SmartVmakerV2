# ScrimSpec Database Dump Script (PowerShell)
# Usage: .\backups\dump_database.ps1 -Password "YOUR_PASSWORD"

param(
    [Parameter(Mandatory=$true)]
    [string]$Password
)

# Configuration
$DbHost = "aws-1-ap-south-1.pooler.supabase.com"
$DbPort = "6543"
$DbUser = "postgres.cuwdjemjuszaaxpouprc"
$DbName = "postgres"
$BackupDir = "backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "🗄️  ScrimSpec Database Backup" -ForegroundColor Green
Write-Host "=================================="
Write-Host "Database: $DbName"
Write-Host "Host: $DbHost"
Write-Host "Timestamp: $Timestamp"
Write-Host ""

# Set password environment variable
$env:PGPASSWORD = $Password

# Create backup directory if not exists
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

try {
    # Full backup
    Write-Host "📦 Creating full backup..." -ForegroundColor Green
    & "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
        --host=$DbHost `
        --port=$DbPort `
        --username=$DbUser `
        --dbname=$DbName `
        --no-owner `
        --no-privileges `
        --schema=public `
        --exclude-table-data='audit_log' `
        --exclude-table-data='id_uuid_mapping' `
        --file="$BackupDir\full_backup_$Timestamp.sql"

    Write-Host "✅ Full backup created: full_backup_$Timestamp.sql" -ForegroundColor Green

    # Schema-only backup
    Write-Host "📋 Creating schema-only backup..." -ForegroundColor Green
    & "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
        --host=$DbHost `
        --port=$DbPort `
        --username=$DbUser `
        --dbname=$DbName `
        --schema-only `
        --no-owner `
        --no-privileges `
        --schema=public `
        --file="$BackupDir\schema_$Timestamp.sql"

    Write-Host "✅ Schema backup created: schema_$Timestamp.sql" -ForegroundColor Green

    # Data-only backup
    Write-Host "💾 Creating data-only backup..." -ForegroundColor Green
    & "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
        --host=$DbHost `
        --port=$DbPort `
        --username=$DbUser `
        --dbname=$DbName `
        --data-only `
        --no-owner `
        --no-privileges `
        --schema=public `
        --exclude-table-data='audit_log' `
        --exclude-table-data='id_uuid_mapping' `
        --file="$BackupDir\data_$Timestamp.sql"

    Write-Host "✅ Data backup created: data_$Timestamp.sql" -ForegroundColor Green

    # Show summary
    Write-Host ""
    Write-Host "📊 Backup Summary:" -ForegroundColor Green
    Get-ChildItem "$BackupDir\*_$Timestamp.sql" | ForEach-Object {
        $size = "{0:N2} MB" -f ($_.Length / 1MB)
        Write-Host "  $($_.Name) - $size"
    }

    Write-Host ""
    Write-Host "✅ Backup completed successfully!" -ForegroundColor Green
    Write-Host "Files saved in: $BackupDir\"

} catch {
    Write-Host "❌ Error during backup: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear password
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
