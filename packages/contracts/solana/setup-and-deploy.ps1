#Requires -Version 5.1
<#
.SYNOPSIS
    Setup & deploy Royal Chess Escrow program to devnet.
.DESCRIPTION
    1. Install Solana CLI & Anchor CLI
    2. Generate wallet & request SOL
    3. Build & deploy program
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [ERR] $msg" -ForegroundColor Red }

# ────────────────────────────────────────────────────────────────
Write-Step "Step 1: Check prerequisites"
# ────────────────────────────────────────────────────────────────

$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo) {
    Write-Err "Rust not found. Install from https://rustup.rs first."
    exit 1
}
Write-Ok "Rust: $(cargo --version)"

# ────────────────────────────────────────────────────────────────
Write-Step "Step 2: Install Solana CLI"
# ────────────────────────────────────────────────────────────────

$solanaPath = "$env:USERPROFILE\.local\share\solana\install\active_release\bin"
$solanaInstalled = Get-Command solana -ErrorAction SilentlyContinue

if (-not $solanaInstalled) {
    Write-Host "    Downloading Solana CLI..."
    $installerUrl = "https://release.anza.xyz/v2.2.7/solana-install-init-x86_64-pc-windows-msvc.exe"
    $installerPath = "$env:TEMP\solana-install.exe"

    if (-not (Test-Path $installerPath)) {
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    }

    & $installerPath v2.2.7
    $env:PATH = "$solanaPath;$env:PATH"

    if (Get-Command solana -ErrorAction SilentlyContinue) {
        Write-Ok "Solana CLI installed"
    } else {
        Write-Warn "Solana installed but not in PATH. Restart terminal and re-run."
    }
} else {
    Write-Ok "Solana CLI ready"
}

# ────────────────────────────────────────────────────────────────
Write-Step "Step 3: Install Anchor CLI"
# ────────────────────────────────────────────────────────────────

$anchorInstalled = Get-Command anchor -ErrorAction SilentlyContinue

if (-not $anchorInstalled) {
    Write-Host "    Installing Anchor CLI (this may take a few minutes)..."
    cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked 2>&1 | Out-Null

    $cargoBin = "$env:USERPROFILE\.cargo\bin"
    if ($env:PATH -notlike "*$cargoBin*") {
        $env:PATH = "$cargoBin;$env:PATH"
    }

    if (Get-Command anchor -ErrorAction SilentlyContinue) {
        Write-Ok "Anchor CLI installed"
    } else {
        Write-Err "Anchor installation failed."
        exit 1
    }
} else {
    Write-Ok "Anchor CLI ready"
}

# ────────────────────────────────────────────────────────────────
Write-Step "Step 4: Configure wallet & network"
# ────────────────────────────────────────────────────────────────

solana config set --url devnet 2>&1 | Out-Null
$solanaKeyPath = "$env:USERPROFILE\.config\solana\id.json"

if (-not (Test-Path $solanaKeyPath)) {
    solana-keygen new --outfile $solanaKeyPath --no-bip39-passphrase --force 2>&1 | Out-Null
    Write-Ok "Wallet created"
} else {
    Write-Ok "Wallet found"
}

# Check balance & airdrop if needed
$balanceStr = solana balance 2>&1
$balance = [double]($balanceStr -replace '[^\d\.]', '')

if ($balance -lt 1.0) {
    Write-Host "    Requesting devnet SOL..."
    solana airdrop 2 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    Write-Ok "SOL received"
} else {
    Write-Ok "Balance: $balanceStr"
}

# ────────────────────────────────────────────────────────────────
Write-Step "Step 5: Build program"
# ────────────────────────────────────────────────────────────────

Set-Location "$PSScriptRoot"

$buildOutput = anchor build 2>&1
$buildExit = $LASTEXITCODE

if ($buildExit -ne 0) {
    Write-Err "Build failed!"
    Write-Host $buildOutput
    exit 1
}

Write-Ok "Build successful"

# ────────────────────────────────────────────────────────────────
Write-Step "Step 6: Deploy to devnet"
# ────────────────────────────────────────────────────────────────

Write-Host "    Token ready to deploy..."
$deployOutput = anchor program deploy --provider.cluster devnet 2>&1
$deployExit = $LASTEXITCODE

if ($deployExit -ne 0) {
    Write-Err "Deploy failed!"
    Write-Host $deployOutput
    exit 1
}

# Get program ID silently
$programKeypair = "$PSScriptRoot\target\deploy\royal_chess_escrow-keypair.json"
$programId = if (Test-Path $programKeypair) { solana address -k $programKeypair 2>$null } else { "unknown" }

Write-Ok "Deployed successfully!"

# ────────────────────────────────────────────────────────────────
Write-Step "Done!"
# ────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  Program deployed to Solana devnet" -ForegroundColor Green
Write-Host "  Add this to your .env file:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  SOLANA_PROGRAM_ID=$programId" -ForegroundColor White
Write-Host "  SOLANA_AUTHORITY_KEY=$solanaKeyPath" -ForegroundColor White
Write-Host ""
Write-Host "  Explorer: https://explorer.solana.com/address/$programId" -ForegroundColor DarkGray
Write-Host ""
