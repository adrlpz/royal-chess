#!/bin/bash
# Build & deploy Solana program using Docker (works on Windows/Mac/Linux)
set -e

PROGRAM_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYPAIR="$PROGRAM_DIR/target/deploy/royal_chess_escrow-keypair.json"

echo "=== Building with Docker (backpackapp/build:v0.30.1) ==="

docker run --rm \
  -v "$PROGRAM_DIR:/work" \
  -w /work \
  backpackapp/build:v0.30.1 \
  bash -c "
    set -e
    echo '=== Generating keypair ==='
    solana-keygen new --outfile target/deploy/royal_chess_escrow-keypair.json --no-bip39-passphrase --force 2>/dev/null || true

    PROGRAM_ID=\$(solana address -k target/deploy/royal_chess_escrow-keypair.json)
    echo \"Program ID: \$PROGRAM_ID\"

    # Update declare_id in source
    sed -i \"s/declare_id!(\\\"[^\\\"]*\\\")/declare_id!(\\\"\$PROGRAM_ID\\\")/\" programs/royal-chess-escrow/src/lib.rs

    echo '=== Building ==='
    anchor build

    echo '=== Done ==='
    ls -la target/deploy/royal_chess_escrow.so 2>/dev/null
  "

echo ""
echo "=== Build complete ==="
if [ -f "$PROGRAM_DIR/target/deploy/royal_chess_escrow.so" ]; then
    PROGRAM_ID=$(solana address -k "$KEYPAIR" 2>/dev/null || echo "unknown")
    echo "Program .so: $PROGRAM_DIR/target/deploy/royal_chess_escrow.so"
    echo "Program ID: $PROGRAM_ID"
    echo ""
    echo "To deploy to devnet:"
    echo "  solana config set --url devnet"
    echo "  solana airdrop 2"
    echo "  solana program deploy target/deploy/royal_chess_escrow.so --keypair ~/.config/solana/id.json"
else
    echo "Build failed — .so file not found"
fi
