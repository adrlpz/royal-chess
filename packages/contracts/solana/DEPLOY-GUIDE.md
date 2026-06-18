# Solana Build & Deploy Guide

## Method: Solana Playground (Web IDE — No Install)

### Step 1: Open Solana Playground
Go to: https://beta.solpg.io/

### Step 2: Create New Project
1. Click "+" → Name: `royal-chess-escrow`
2. Select framework: **Anchor**

### Step 3: Upload Source Files
Upload these files from `programs/royal-chess-escrow/`:
- `Cargo.toml`
- `src/lib.rs`

Replace the default generated files with our code.

### Step 4: Build
1. Click **Build** (or press Ctrl+Shift+B)
2. Wait for compilation to finish
3. Should show "Build successful"

### Step 5: Deploy
1. Connect wallet (Phantom/Solflare) — top right
2. Switch to **Devnet** — bottom left
3. Click **Deploy**
4. Confirm transaction in wallet
5. Copy the **Program ID**

### Step 6: Update Environment
Add to your `.env` file:
```
SOLANA_PROGRAM_ID=<paste-program-id-here>
SOLANA_AUTHORITY_KEY=<your-wallet-path>
```

---

## Alternative: Pre-built .so File

If Solana Playground doesn't work, we can try building on a Linux machine or CI/CD.

## Alternative: Enable Developer Mode (Windows)

1. Open **Settings** → **Privacy & Security** → **For Developers**
2. Toggle **Developer Mode** to ON
3. Restart terminal
4. Run:
```powershell
cd D:\claude\catur\packages\contracts\solana
cargo-build-sbf --manifest-path programs/royal-chess-escrow/Cargo.toml --sbf-out-dir target/deploy
```

## After Deployment

Test the program by calling initialize:
```bash
# Using Solana CLI
solana program show <PROGRAM_ID>

# Or test with a client script (see tests/ directory)
```

Update all environment files with the new Program ID.
