#Requires -Version 5.1
<#
.SYNOPSIS
    Setup Solana environment & deploy Royal Chess Escrow program to devnet.
.DESCRIPTION
    1. Install Solana CLI
    2. Install Anchor CLI
    3. Generate wallet & airdrop SOL
    4. Build Anchor program
    5. Deploy to devnet
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [ERR] $msg" -ForegroundColor Red }

# ────────────────────────────────────────────────────────────────
Write-Step "Step 0: Check prerequisites"
# ────────────────────────────────────────────────────────────────

# Check Rust
$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo) {
    Write-Err "Rust not found. Install from https://rustup.rs first."
    exit 1
}
Write-Ok "Rust: $(cargo --version)"

# ────────────────────────────────────────────────────────────────
Write-Step "Step 1: Install Solana CLI"
# ────────────────────────────────────────────────────────────────

$solanaPath = "$env:USERPROFILE\.local\share\solana\install\active_release\bin"
$solanaInstalled = Get-Command solana -ErrorAction SilentlyContinue

if (-not $solanaInstalled) {
    Write-Host "    Downloading Solana installer..."

    # Use Anza installer (official successor)
    $installerUrl = "https://release.anza.xyz/v2.2.7/solana-install-init-x86_64-pc-windows-msvc.exe"
    $installerPath = "$env:TEMP\solana-install.exe"

    if (-not (Test-Path $installerPath)) {
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    }

    Write-Host "    Installing Solana CLI..."
    & $installerPath v2.2.7

    # Add to PATH for current session
    $env:PATH = "$solanaPath;$env:PATH"

    if (Get-Command solana -ErrorAction SilentlyContinue) {
        Write-Ok "Solana CLI installed: $(solana --version)"
    } else {
        Write-Warn "Solana CLI installed but not in PATH. Restart terminal and re-run."
        Write-Warn "Manual add: $solanaPath to PATH"
        # Continue anyway — anchor may still work
    }
} else {
    Write-Ok "Solana already installed: $(solana --version)"
}

# Ensure solana is in PATH
if (-not (Get-Command solana -ErrorAction SilentlyContinue)) {
    $env:PATH = "$solanaPath;$env:PATH"
}

# ────────────────────────────────────────────────────────────────
Write-Step "Step 2: Install Anchor CLI (via AVM)"
# ────────────────────────────────────────────────────────────────

$anchorInstalled = Get-Command anchor -ErrorAction SilentlyContinue

if (-not $anchorInstalled) {
    Write-Host "    Installing AVM (Anchor Version Manager)..."
    cargo install --git https://github.com/coral-xyz/anchor avm --force 2>&1 | Out-Null

    # Ensure cargo bin is in PATH
    $cargoBin = "$env:USERPROFILE\.cargo\bin"
    if ($env:PATH -notlike "*$cargoBin*") {
        $env:PATH = "$cargoBin;$env:PATH"
    }

    Write-Host "    Installing Anchor 0.30.1..."
    avm install 0.30.1
    avm use 0.30.1

    if (Get-Command anchor -ErrorAction SilentlyContinue) {
        Write-Ok "Anchor installed: $(anchor --version)"
    } else {
        Write-Err "Anchor installation failed. Try manually: cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli"
        exit 1
    }
} else {
    Write-Ok "Anchor already installed: $(anchor --version)"
}

# ────────────────────────────────────────────────────────────────
Write-Step "Step 3: Configure Solana for devnet"
# ────────────────────────────────────────────────────────────────

solana config set --url devnet
$solanaKeyPath = "$env:USERPROFILE\.config\solana\id.json"

if (-not (Test-Path $solanaKeyPath)) {
    Write-Host "    Generating new Solana keypair..."
    solana-keygen new --outfile $solanaKeyPath --no-bip39-passphrase --force
    Write-Ok "Keypair generated: $solanaKeyPath"
} else {
    Write-Ok "Keypair exists: $solanaKeyPath"
}

$pubkey = solana address
Write-Ok "Wallet address: $pubkey"

# Check balance & airdrop if needed
$balanceStr = solana balance 2>&1
$balance = [double]($balanceStr -replace '[^\d\.]', '')
Write-Host "    Current balance: $balanceStr"

if ($balance -lt 1.0) {
    Write-Host "    Requesting airdrop (2 SOL)..."
    solana airdrop 2 2>&1
    Start-Sleep -Seconds 3
    $newBalance = solana balance
    Write-Ok "New balance: $newBalance"
}

# ────────────────────────────────────────────────────────────────
Write-Step "Step 4: Build Anchor program"
# ────────────────────────────────────────────────────────────────

Set-Location "$PSScriptRoot"

Write-Host "    Building program..."
$buildOutput = anchor build 2>&1
$buildExit = $LASTEXITCODE

if ($buildExit -ne 0) {
    Write-Err "Build failed!"
    Write-Host $buildOutput
    exit 1
}

Write-Ok "Build successful"

# Show program ID
$programKeypair = "$PSScriptRoot\target\deploy\royal_chess_escrow-keypair.json"
if (Test-Path $programKeypair) {
    $programId = solana address -k $programKeypair
    Write-Ok "Program ID: $programId"

    # Update program ID in source files
    Write-Host "    Updating program ID in source..."

    # Update lib.rs
    $libRs = Get-Content "programs\royal-chess-escrow\src\lib.rs" -Raw
    $libRs = $libRs -replace 'declare_id!\("[^"]*"\);', "declare_id!(`"$programId`");"
    Set-Content "programs\royal-chess-escrow\src\lib.rs" $libRs -NoNewline

    # Update Anchor.toml
    $anchorToml = Get-Content "Anchor.toml" -Raw
    $anchorToml = $anchorToml -replace 'royal_chess_escrow = "[^"]*"', "royal_chess_escrow = `"$programId`""
    Set-Content "Anchor.toml" $anchorToml -NoNewline

    Write-Ok "Program ID updated in lib.rs & Anchor.toml"

    # Rebuild with correct ID
    Write-Host "    Rebuilding with correct program ID..."
    anchor build 2>&1 | Out-Null
    Write-Ok "Rebuild complete"
}

# ────────────────────────────────────────────────────────────────
Write-Step "Step 5: Run Anchor tests"
# ────────────────────────────────────────────────────────────────

Write-Host "    Running tests..."
$testOutput = anchor test 2>&1
$testExit = $LASTEXITCODE

if ($testExit -ne 0) {
    Write-Warn "Tests had issues (exit $testExit). Output:"
    Write-Host $testOutput
    $continue = Read-Host "    Continue with deploy? (y/n)"
    if ($continue -ne "y") { exit 1 }
} else {
    Write-Ok "All tests passed"
}

# ────────────────────────────────────────────────────────────────
Write-Step "Step 6: Deploy to Solana devnet"
# ────────────────────────────────────────────────────────────────

$balanceStr = solana balance 2>&1
$balance = [double]($balanceStr -replace '[^\d\.]', '')
if ($balance -lt 0.5) {
    Write-Host "    Low balance ($balanceStr). Requesting airdrop..."
    solana airdrop 2
    Start-Sleep -Seconds 3
}

Write-Host "    Deploying program to devnet..."
$deployOutput = anchor deploy --provider.cluster devnet 2>&1
$deployExit = $LASTEXITCODE

if ($deployExit -ne 0) {
    Write-Err "Deploy failed!"
    Write-Host $deployOutput
    exit 1
}

Write-Ok "Program deployed to devnet!"

# ────────────────────────────────────────────────────────────────
Write-Step "Step 7: Summary"
# ────────────────────────────────────────────────────────────────

$programId = solana address -k $programKeypair
$finalBalance = solana balance

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Royal Chess Escrow — Solana Devnet Deploy           ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Program ID:  $programId  ║" -ForegroundColor White
Write-Host "║  Network:     devnet                                       ║" -ForegroundColor White
Write-Host "║  Wallet:      $pubkey  ║" -ForegroundColor White
Write-Host "║  Balance:     $finalBalance                                        ║" -ForegroundColor White
Write-Host "║  Explorer:    https://explorer.solana.com/address/$programId  ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Add to .env:" -ForegroundColor Yellow
Write-Host "  SOLANA_PROGRAM_ID=$programId" -ForegroundColor White
Write-Host "  SOLANA_AUTHORITY_KEY=$solanaKeyPath" -ForegroundColor White
