param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "transactpay_postgres",
    [string]$DbUser        = "postgres",
    [string]$DbName        = "transactpay_db"
)

if (-not (Test-Path $BackupFile)) {
    Write-Host "Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "Restoring database '$DbName' from $BackupFile..." -ForegroundColor Yellow

# Terminate existing connections to the database before restoring
docker exec -t $ContainerName psql -U $DbUser -d postgres -c "
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$DbName' AND pid <> pg_backend_pid();
" | Out-Null

# Pipe the backup file content directly into pg_restore via Get-Content
Get-Content $BackupFile -Raw -Encoding Byte | docker exec -i $ContainerName pg_restore -U $DbUser -d $DbName --clean --if-exists -v

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database restored successfully from $BackupFile" -ForegroundColor Green
} else {
    Write-Host "Restore execution completed. Verify database state." -ForegroundColor Yellow
}
