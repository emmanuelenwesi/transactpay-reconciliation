param (
    [string]$ContainerName = "transactpay_postgres",
    [string]$DbUser        = "postgres",
    [string]$DbName        = "transactpay_db",
    [string]$BackupDir     = ".\backups"
)

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

$Timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$FileName   = "$DbName_backup_$Timestamp.dump"
$LocalPath  = Join-Path $BackupDir $FileName

Write-Host "Creating backup for database '$DbName'..." -ForegroundColor Cyan

# Execute pg_dump inside container and pipe output to local file
docker exec -t $ContainerName pg_dump -U $DbUser -F c -b -v -d $DbName > $LocalPath

if ($LASTEXITCODE -eq 0 -and (Test-Path $LocalPath) -and (Get-Item $LocalPath).Length -gt 0) {
    Write-Host "Backup successfully created: $LocalPath" -ForegroundColor Green
    
    # Retention Policy: Prune backups older than 7 days
    Get-ChildItem -Path $BackupDir -Filter "*.dump" | 
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | 
        Remove-Item -Force -Verbose
} else {
    Write-Host "Backup failed!" -ForegroundColor Red
}
