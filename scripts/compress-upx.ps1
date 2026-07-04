<#
.SYNOPSIS
  Compresses the built Tauri binary with UPX for smaller distribution size.
.DESCRIPTION
  Finds the release .exe in src-tauri/target/release, verifies UPX is available,
  backs up the original, compresses with --best --lzma, and reports size reduction.
  Skips gracefully if UPX is not installed.
#>

$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path "$PSScriptRoot\.."
$releaseDir = Join-Path $projectRoot "src-tauri\target\release"
$exeName = "endfield-gacha-assistant.exe"

if (-not (Test-Path (Join-Path $releaseDir $exeName))) {
    Write-Host "[UPX] Release binary not found at $releaseDir\$exeName" -ForegroundColor Yellow
    Write-Host "[UPX] Run 'npm run tauri:build' first." -ForegroundColor Yellow
    exit 1
}

$upx = Get-Command upx -ErrorAction SilentlyContinue
if (-not $upx) {
    Write-Host "[UPX] UPX is not installed. Download from https://upx.github.io" -ForegroundColor Yellow
    Write-Host "[UPX] Skipping compression; binary is usable as-is." -ForegroundColor Yellow
    exit 0
}

$originalSize = (Get-Item (Join-Path $releaseDir $exeName)).Length
$backupPath = Join-Path $releaseDir "$exeName.bak"

Write-Host "[UPX] Original size: $([math]::Round($originalSize / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host "[UPX] Backing up to $backupPath ..." -ForegroundColor Gray
Copy-Item (Join-Path $releaseDir $exeName) $backupPath -Force

Write-Host "[UPX] Compressing with --best --lzma ..." -ForegroundColor Cyan
& $upx.Source --best --lzma (Join-Path $releaseDir $exeName)

if ($LASTEXITCODE -ne 0) {
    Write-Host "[UPX] Compression failed. Restoring backup." -ForegroundColor Red
    Copy-Item $backupPath (Join-Path $releaseDir $exeName) -Force
    exit 1
}

$compressedSize = (Get-Item (Join-Path $releaseDir $exeName)).Length
$reduction = [math]::Round(($originalSize - $compressedSize) / $originalSize * 100, 1)
Write-Host "[UPX] Compressed size: $([math]::Round($compressedSize / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host "[UPX] Size reduction: ${reduction}%" -ForegroundColor Green
Write-Host "[UPX] Backup kept at $backupPath" -ForegroundColor Gray
