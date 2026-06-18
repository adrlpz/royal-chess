# Solana Build & Deploy Guide

## Problem
Windows tidak support `cargo-build-sbf` tanpa symlink privilege (Developer Mode / Admin).
Docker tidak tersedia.

## Solution Options

### Option 1: Solana Playground (Recommended — No Install)
1. Buka https://beta.solpg.io/
2. Upload files dari `programs/royal-chess-escrow/`
3. Build & Deploy ke devnet langsung dari browser
4. Copy Program ID ke `.env`

### Option 2: WSL (Windows Subsystem for Linux)
```powershell
wsl --install -d Ubuntu
# Restart, lalu di WSL:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/bin/env
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli
cd /mnt/d/claude/catur/packages/contracts/solana
anchor build
anchor deploy --provider.cluster devnet
```

### Option 3: Install Docker Desktop
Download dari https://www.docker.com/products/docker-desktop/
Lalu jalankan:
```bash
cd D:\claude\catur\packages\contracts\solana
bash build-docker.sh
```

### Option 4: Enable Developer Mode (Admin Required)
1. Settings > Privacy & Security > For Developers > Developer Mode ON
2. Restart terminal
3. Run: `cargo-build-sbf --manifest-path programs/royal-chess-escrow/Cargo.toml`

## After Build & Deploy
Update `.env`:
```
SOLANA_PROGRAM_ID=<your-program-id>
SOLANA_AUTHORITY_KEY=<path-to-keypair.json>
```
