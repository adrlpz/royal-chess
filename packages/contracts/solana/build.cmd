@echo off
REM Build Solana program - run from cmd.exe (not PowerShell, not Git Bash)
REM This avoids GNU link.exe shadowing MSVC link.exe

set SDK_DEPS=C:\Users\drees\.local\share\solana\install\solana-release\bin\platform-tools-sdk\sbf\dependencies

REM Add Solana LLVM to PATH (but AFTER MSVC so link.exe resolves correctly)
set PATH=%SDK_DEPS%\llvm\bin;%PATH%

REM Register solana toolchain
rustup toolchain uninstall solana 2>nul
rustup toolchain link solana "%SDK_DEPS%\rust"

REM Build
cd /d D:\claude\catur\packages\contracts\solana
if exist Cargo.lock del Cargo.lock

echo Building Solana program...
cargo +solana build --lib --target sbf-solana-solana --release --manifest-path programs\royal-chess-escrow\Cargo.toml --target-dir target\sbf-release

if %ERRORLEVEL% EQU 0 (
    echo.
    echo === BUILD SUCCESS ===
    dir target\sbf-release\sbf-solana-solana\release\royal_chess_escrow.so 2>nul || dir target\sbf-release\release\royal_chess_escrow.so 2>nul
) else (
    echo.
    echo === BUILD FAILED ===
)
