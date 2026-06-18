# Deploy Solana Program — Quick Guide

## Solusi Tercepat: Solana Playground (2 menit, 0 install)

### 1. Buka https://beta.solpg.io/

### 2. Buat project baru
- Click "+" → Select "Anchor" → Name: `royal-chess-escrow`

### 3. Upload source files
Replace file default dengan:

**Cargo.toml** → copy dari: `programs/royal-chess-escrow/Cargo.toml`
**src/lib.rs** → copy dari: `programs/royal-chess-escrow/src/lib.rs`

### 4. Build
- Click **Build** button (atau Ctrl+Shift+B)
- Tunggu sampai "Build successful"

### 5. Deploy
- Connect wallet (Phantom/Solflare) — pojok kanan atas
- Switch ke **Devnet** — pojok kiri bawah
- Click **Deploy**
- Confirm transaction di wallet
- Copy **Program ID** yang muncul

### 6. Update .env
```
SOLANA_PROGRAM_ID=<paste-program-id>
```

---

## Kenapa build lokal gagal?

Windows + Solana Rust 1.79 punya masalah:
1. **Symlink privilege** — `cargo-build-sbf` butuh symlinks (butuh Developer Mode / Admin)
2. **Edition 2024 crates** — dependency baru butuh Rust 1.85+, Solana pakai 1.79
3. **Linker conflict** — MSVC `link.exe` vs Solana linker

Solana Playground di cloud sudah solve semua masalah ini.
