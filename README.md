# ♟️ Royal Chess — Chess PvP Crypto Betting

Platform catur online player-vs-player dengan crypto betting di **Base**, **BNB Chain**, dan **Solana**. Pajak platform 5% dari total pot.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  RainbowKit (EVM) + Phantom (Solana) + Socket.IO Client     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                    Backend (Express + Socket.IO)              │
│  Auth (SIWE) • Matchmaking • Chess Engine • Settlement       │
└───────┬──────────────────────────────────────┬──────────────┘
        │                                      │
┌───────▼───────┐  ┌──────────┐  ┌────────────▼──────────────┐
│  EVM Contracts │  │PostgreSQL│  │   Solana Program (Anchor) │
│  (Solidity)    │  │ + Prisma │  │   (Rust)                  │
│  Base + BSC    │  │          │  │                           │
└────────────────┘  └──────────┘  └───────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, TailwindCSS, RainbowKit, Phantom Wallet Adapter |
| **Backend** | Express, Socket.IO, chess.js, Prisma, PostgreSQL |
| **EVM Contracts** | Solidity 0.8.24, Hardhat, OpenZeppelin (UUPS Upgradeable) |
| **Solana Program** | Rust, Anchor 0.30, SPL Token |
| **Auth** | Sign-In with Ethereum (SIWE) + JWT |

## Supported Chains & Tokens

| Token | Base (8453) | BSC (56) | Solana |
|-------|:-----------:|:--------:|:------:|
| Native (ETH/BNB/SOL) | ✅ | ✅ | ✅ |
| USDC | ✅ ERC-20 | ✅ BEP-20 | ✅ SPL |
| USDT | ✅ ERC-20 | ✅ BEP-20 | ✅ SPL |

## Quick Start

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL
- (Optional) Solana CLI + Anchor for Solana program

### 1. Clone & Install
```bash
git clone <repo-url> royal-chess
cd royal-chess
cp .env.example .env   # edit values
pnpm install
```

### 2. Database
```bash
cd packages/backend
pnpm db:generate
pnpm db:push
```

### 3. Compile Contracts
```bash
# EVM
cd packages/contracts/evm
pnpm compile
pnpm test

# Solana (requires Anchor CLI)
cd packages/contracts/solana
anchor build
anchor test
```

### 4. Deploy Contracts
```bash
# EVM — Base Sepolia (testnet)
cd packages/contracts/evm
pnpm deploy:base-sepolia

# EVM — BSC Testnet
pnpm deploy:bsc

# Solana — Devnet
cd packages/contracts/solana
anchor deploy --provider.cluster devnet
```

Update `.env` with deployed contract addresses.

### 5. Run Development
```bash
# From root
pnpm dev

# Or individually
pnpm dev:backend    # http://localhost:3001
pnpm dev:frontend   # http://localhost:3000
```

## Project Structure

```
royal-chess/
├── packages/
│   ├── contracts/
│   │   ├── evm/                    # Solidity smart contracts
│   │   │   ├── contracts/
│   │   │   │   └── Royal ChessEscrow.sol
│   │   │   ├── test/
│   │   │   │   └── Royal ChessEscrow.test.ts
│   │   │   └── scripts/
│   │   │       └── deploy.ts
│   │   └── solana/                  # Anchor program
│   │       └── programs/
│   │           └── catur-bet-escrow/
│   │               └── src/
│   │                   └── lib.rs
│   ├── backend/                     # Express + Socket.IO server
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── auth/               # SIWE auth + JWT
│   │       ├── chess/              # chess.js engine wrapper
│   │       ├── game/               # Matchmaking, room, timer
│   │       ├── routes/             # REST API
│   │       ├── services/           # Blockchain settlement
│   │       ├── socket/             # WebSocket handlers
│   │       └── index.ts            # Entry point
│   └── frontend/                    # Next.js app
│       └── src/
│           ├── app/                # Pages (lobby, game, leaderboard, profile)
│           ├── components/         # UI components
│           ├── hooks/              # Auth & Socket hooks
│           ├── lib/                # Config (wagmi, socket)
│           ├── providers/          # Context providers
│           └── styles/             # Tailwind + globals
├── PRD.md                           # Product Requirements Document
├── README.md
├── .env.example
└── pnpm-workspace.yaml
```

## Smart Contract Flow

```
Player1 createMatch(token, betAmount) → deposit to escrow
Player2 joinMatch(matchId, betAmount) → deposit to escrow
→ Match status: FUNDED

Backend: startMatch(matchId) → status: IN_PROGRESS

[Game plays off-chain via WebSocket]

Game ends → Backend: settleMatch(matchId, winner)
  → 95% → winner wallet
  → 5%  → treasury wallet

Draw → Backend: refundMatch(matchId, reason)
  → 100% → player1
  → 100% → player2
```

## Platform Fee

- **Rate:** 5% of total pot
- **Example:** Bet $50 each → Pot $100 → Fee $5 → Winner gets $95
- **Collection:** Automatic via smart contract on settlement
- **Treasury:** Multi-sig wallet

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth/nonce` | — | Get SIWE nonce |
| POST | `/api/auth/verify` | — | Verify SIWE, get JWT |
| GET | `/api/users/me` | ✅ | Current user profile |
| PATCH | `/api/users/me` | ✅ | Update username |
| GET | `/api/users/:id` | — | Public profile |
| GET | `/api/matches/:id` | — | Match details |
| GET | `/api/matches/user/:id` | — | User match history |
| GET | `/api/leaderboard` | — | Top players by ELO |
| GET | `/api/health` | — | Server health check |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `matchmaking:join` | → Server | Join matchmaking queue |
| `matchmaking:cancel` | → Server | Cancel search |
| `match:found` | ← Server | Match found, game starting |
| `game:move` | → Server | Make a chess move |
| `game:moved` | ← Server | Move confirmed & broadcast |
| `game:resign` | → Server | Resign game |
| `game:draw_offer` | → Server | Offer/accept draw |
| `game:state` | ← Server | Full game state update |
| `game:ended` | ← Server | Game finished |
| `game:reconnect` | → Server | Reconnect to game |
| `chat:send` | → Server | Send pre-defined chat |
| `chat:message` | ← Server | Chat message received |

## Development Scripts

```bash
pnpm dev              # Run backend + frontend
pnpm dev:backend      # Backend only
pnpm dev:frontend     # Frontend only
pnpm build            # Build all packages
pnpm test             # Run contract tests
pnpm lint             # Lint all packages
```

## License

MIT
