@echo off
REM Build & Deploy Solana program
REM Run from cmd.exe: build.cmd

set SDK_DEPS=C:\Users\drees\.local\share\solana\install\solana-release\bin\platform-tools-sdk\sbf\dependencies
set PATH=%SDK_DEPS%\llvm\bin;%PATH%

echo.
echo Royal Chess - Solana Program Build
echo ==================================
echo.

rustup toolchain uninstall solana 2>nul
rustup toolchain link solana "%SDK_DEPS%\rust"

cd /d D:\claude\catur\packages\contracts\solana
if exist Cargo.lock del Cargo.lock

echo Building program...
cargo +solana build --lib --target sbf-solana-solana --release --manifest-path programs\royal-chess-escrow\Cargo.toml --target-dir target\sbf-release

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Build successful
    echo.
    echo Token ready to deploy! Run:
    echo   anchor deploy --provider.cluster devnet
) else (
    echo.
    echo [ERR] Build failed
)
