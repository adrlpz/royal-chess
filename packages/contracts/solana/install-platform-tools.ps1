# install-platform-tools.ps1
# Manual install Solana platform-tools (bypass cargo-build-sbf download)
# Jalankan dari PowerShell: .\install-platform-tools.ps1

$ErrorActionPreference = "Stop"
$baseDir = "$env:USERPROFILE\.cache\solana\v1.45"
$platformToolsDir = "$baseDir\platform-tools"
$depsDir = "$platformToolsDir\dependencies"

Write-Host "=== Installing Solana platform-tools v1.45 ===" -ForegroundColor Cyan
Write-Host "Target: $depsDir"

# Create dirs
New-Item -ItemType Directory -Path $depsDir -Force | Out-Null

# Download
$url = "https://github.com/anza-xyz/platform-tools/releases/download/v1.45/platform-tools-windows-x86_64.tar.bz2"
$tarPath = "$depsDir\platform-tools.tar.bz2"

Write-Host "Downloading (497MB)..." -ForegroundColor Yellow
Write-Host "URL: $url"
Write-Host "TIP: Jika download lambat, download manual via browser lalu copy ke:"
Write-Host "  $tarPath"
Write-Host ""

# Check if already downloaded
if (Test-Path $tarPath) {
    Write-Host "Found existing tar.bz2, skipping download" -ForegroundColor Green
} else {
    $ProgressPreference = 'Continue'
    try {
        Invoke-WebRequest -Uri $url -OutFile $tarPath -UseBasicParsing -TimeoutSec 600
        Write-Host "Downloaded: $([math]::Round((Get-Item $tarPath).Length / 1MB)) MB" -ForegroundColor Green
    } catch {
        Write-Host "Download failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Download manual via browser:" -ForegroundColor Yellow
        Write-Host "  1. Buka: $url"
        Write-Host "  2. Save ke: $tarPath"
        Write-Host "  3. Jalankan script ini lagi"
        exit 1
    }
}

# Extract
Write-Host "Extracting..." -ForegroundColor Cyan
Push-Location $depsDir
tar -xjf platform-tools.tar.bz2 --strip-components=1
Pop-Location
Remove-Item $tarPath -Force

# Create marker
Set-Content "$baseDir\platform-tools-v1.45.md" "v1.45" -Force

# Create junction
$juncPath = "$platformToolsDir\platform-tools"
if (Test-Path $juncPath) { cmd /c rmdir "$juncPath" 2>&1 | Out-Null }
cmd /c mklink /J "$juncPath" "$depsDir" | Out-Null

# Verify
Write-Host "`n=== Verify ===" -ForegroundColor Green
Write-Host "rustc: $(& "$depsDir\rust\bin\rustc.exe" --version)"
Write-Host "junction: $(Test-Path "$juncPath\rust\bin\rustc.exe")"
Write-Host "marker: $(Test-Path "$baseDir\platform-tools-v1.45.md")"
Write-Host ""
Write-Host "Done! Sekarang jalankan:" -ForegroundColor Green
Write-Host "  cargo-build-sbf --manifest-path programs/royal-chess-escrow/Cargo.toml --sbf-out-dir target/deploy" -ForegroundColor Cyan
