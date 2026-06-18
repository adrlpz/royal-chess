# Product Requirements Document (PRD)
## Royal Chess — Game Catur Online PvP dengan Crypto Betting

**Versi:** 1.0  
**Tanggal:** 17 Juni 2026  
**Status:** Draft  

---

## 1. Product Overview

### 1.1 Problem Statement
- Platform catur online yang ada (Chess.com, Lichess) tidak mendukung taruhan uang nyata
- Pemain catur yang ingin kompetisi berbasis taruhan harus menggunakan platform pihak ketiga yang tidak terintegrasi
- Pembayaran tradisional lambat, mahal, dan terbatas secara geografis
- Tidak ada solusi terdesentralisasi yang adil untuk PvP chess betting

### 1.2 Solution
**Royal Chess** adalah platform catur online PvP yang memungkinkan pemain bertaruh menggunakan cryptocurrency di jaringan **Base**, **BNB Chain (BSC)**, dan **Solana**. Smart contract (Solidity untuk Base/BSC, Anchor/Rust untuk Solana) bertindak sebagai escrow yang adil, memastikan pemenang menerima hadiah secara otomatis dikurangi pajak platform 5%.

### 1.3 Target Audience
| Segmen | Deskripsi |
|--------|-----------|
| **Crypto Enthusiast** | Pengguna aktif Base/BNB/Solana yang suka gaming |
| **Pemain Catur Kompetitif** | Rating ELO 1200-2400 yang ingin stakes nyata |
| **Bettor Kripto** | Pencari platform taruhan on-chain yang transparan |
| **Streamer/Content Creator** | Konten catur berhadiah untuk engagement |

### 1.4 Unique Value Proposition
- **Trustless Escrow** — Tidak ada pihak ketiga yang memegang dana
- **Multi-chain** — Base, BNB Chain, & Solana, token ETH/BNB/USDC/USDT/SOL/USDC-SPL
- **Instant Settlement** — Pemenang terima hadiah dalam <2 menit
- **Provably Fair** — Semua transaksi on-chain, auditabel
- **Low Fee** — 5% platform fee (lebih rendah dari sportsbook tradisional)

---

## 2. User Personas

### 2.1 Alex — Crypto Gamer
- **Usia:** 25 tahun
- **Profesi:** Software Developer
- **Tujuan:** Main catur sambil earn crypto
- **Pain Point:** Bosan main catur tanpa insentif finansial
- **Tech Savvy:** Tinggi, familiar dengan MetaMask, DeFi
- **Rating Catur:** 1800 ELO

### 2.2 Budi — Pemain Catur Tradisional
- **Usia:** 35 tahun
- **Profesi:** Pengusaha
- **Tujuan:** Kompetisi catur dengan stakes real
- **Pain Point:** Tidak paham crypto, butuh onboarding mudah
- **Tech Savvy:** Rendah-sedang
- **Rating Catur:** 1500 ELO

### 2.3 Clara — Streamer
- **Usia:** 22 tahun
- **Profesi:** Content Creator
- **Tujuan:** Konten catur menarik dengan hadiah crypto
- **Pain Point:** Butuh platform yang bisa ditonton live
- **Tech Savvy:** Sedang
- **Rating Catur:** 2000 ELO

---

## 3. Core Features

### 3.1 F1 — Wallet Connection
| Aspek | Detail |
|-------|--------|
| **Deskripsi** | Pemain menghubungkan wallet crypto untuk bermain |
| **Supported Wallets** | MetaMask, WalletConnect, Coinbase Wallet, Trust Wallet (EVM) • Phantom, Solflare, Backpack (Solana) |
| **Supported Chains** | Base (chain ID 8453), BNB Smart Chain (chain ID 56), Solana (mainnet-beta) |
| **Supported Tokens** | ETH (Base), BNB (BSC), USDC (Base & BSC), USDT (Base & BSC), SOL (Solana), USDC-SPL (Solana) |
| **Chain Switching** | Auto-detect & prompt switch jika salah jaringan (EVM). Solana wallet terpisah. |

**Acceptance Criteria:**
- [ ] User bisa connect wallet dalam <10 detik
- [ ] Otomatis detect chain yang benar
- [ ] Tampilkan balance semua supported token
- [ ] Graceful error jika wallet tidak terinstall

### 3.2 F2 — Matchmaking & Betting Setup
| Aspek | Detail |
|-------|--------|
| **Deskripsi** | Pemain mencari lawan dan menentukan taruhan |
| **Match Types** | Open Challenge, Quick Match, Direct Challenge (by username/link) |
| **Time Controls** | Bullet (1+0, 2+1), Blitz (3+0, 5+0, 5+3), Rapid (10+0, 15+10) |
| **Bet Amounts** | Min: $1 equiv, Max: $10,000 equiv |
| **Rating System** | ELO-based, terpisah per time control |

**Bet Setup Flow:**
1. Pilih time control
2. Pilih token & chain
3. Masukkan jumlah taruhan (dalam USD atau token)
4. Preview pot & fee (termasuk 5% platform fee)
5. Approve token (jika ERC-20) → Deposit ke escrow
6. Tunggu lawan

**Acceptance Criteria:**
- [ ] Quick Match menemukan lawan dalam <60 detik (peak hours)
- [ ] Bet amount ditampilkan dalam USD equivalent secara real-time
- [ ] Kedua pemain harus deposit sebelum game dimulai
- [ ] Deposit timeout: 5 menit, auto-refund jika lawan tidak deposit
- [ ] Tampilkan estimasi gas fee sebelum confirm

### 3.3 F3 — Chess Gameplay
| Aspek | Detail |
|-------|--------|
| **Deskripsi** | Game catur standar dengan UI responsif |
| **Rules** | Standard FIDE chess rules |
| **Board** | Interaktif, drag-and-drop, keyboard navigation |
| **Piece Set** | Multiple themes (classic, neo, 3D) |
| **Board Themes** | Light, dark, green, custom |
| **Sound** | Move, capture, check, castle, game-end sounds |
| **Analysis** | Post-game engine analysis (stockfish.wasm) |

**Gameplay Features:**
- Legal move highlighting
- Pre-move support
- Last move indicator
- Captured pieces display
- Material advantage bar
- Move history (PGN notation)
- Draw offers (3-fold repetition, 50-move rule auto-detected)
- Resign button dengan confirmation dialog
- Insufficient material auto-draw

**Acceptance Criteria:**
- [ ] Board render <100ms, move response <50ms
- [ ] Legal move validation di client & server (anti-cheat)
- [ ] Timer presisi ±100ms dari server clock
- [ ] Reconnection window: 60 detik jika koneksi terputus
- [ ] Game state persisten — tidak hilang jika refresh browser

### 3.4 F4 — Game Resolution & Settlement
| Aspek | Detail |
|-------|--------|
| **Deskripsi** | Penentuan pemenang dan distribusi hadiah |
| **Win Conditions** | Checkmate, opponent resign, opponent timeout (dengan material check) |
| **Draw Conditions** | Stalemate, 3-fold repetition, 50-move rule, insufficient material, mutual agreement |
| **Timeout Rules** | Jika timeout tapi lawan insufficient material → draw |

**Settlement Flow:**
1. Game selesai → backend verifikasi result
2. Backend trigger smart contract `settleMatch(matchId, winner)`
3. Smart contract kirim 95% pot ke pemenang
4. Smart contract kirim 5% ke platform treasury
5. Kedua pemain terima notifikasi on-chain

**Draw Settlement:**
- Kedua pemain terima refund 100% (tanpa fee)
- Kecuali draw by agreement SETELAH 10+ gerakan → refund 100%

**Acceptance Criteria:**
- [ ] Settlement otomatis dalam <2 menit setelah game selesai
- [ ] 95% tepat ke pemenang, 5% tepat ke treasury
- [ ] Gas fee settlement ditanggung platform (meta-transaction)
- [ ] History transaksi tersedia di UI dan on-chain

### 3.5 F5 — Platform Fee (5%)
| Aspek | Detail |
|-------|--------|
| **Fee Rate** | 5% dari total pot |
| **Fee Calculation** | Pot = 2 × bet amount. Fee = Pot × 5%. Winner receives Pot - Fee = 95% |
| **Contoh** | Bet $50 each → Pot $100 → Fee $5 → Winner gets $95 |
| **Fee Collection** | Otomatis oleh smart contract saat settlement |
| **Treasury Wallet** | Multi-sig wallet untuk keamanan |
| **Fee Adjustment** | Owner bisa update fee rate (max 10%, requires timelock) |

**Acceptance Criteria:**
- [ ] Fee selalu 5% dari total pot
- [ ] Fee langsung masuk treasury wallet
- [ ] Fee visible di UI sebelum pemain confirm bet
- [ ] Fee history auditable on-chain

### 3.6 F6 — User Profile & Stats
| Aspek | Detail |
|-------|--------|
| **Profile** | Username, avatar (NFT optional), bio |
| **Stats** | Win/loss/draw record, win rate, ELO rating |
| **History** | Game history dengan PGN, bet amounts, earnings |
| **Leaderboard** | Global, per time control, per chain |
| **Wallet History** | Deposit, withdrawal, earnings summary |

### 3.7 F7 — Chat & Social
| Aspek | Detail |
|-------|--------|
| **In-game Chat** | Pre-defined messages only (anti-toxicity) |
| **GG / Good Game** | Quick send saat game berakhir |
| **Block/Mute** | Bisa blokir pemain tertentu |
| **Friends** | Add friend, challenge langsung |
| **Report** | Report suspicious play / cheat |

---

## 4. User Flows

### 4.1 Flow: End-to-End Game (Happy Path)
```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Connect │───>│   Create │───>│  Deposit │───>│   Play   │───>│ Settle   │
│  Wallet  │    │  /Join   │    │  to      │    │  Chess   │    │  Payout  │
│          │    │  Match   │    │  Escrow  │    │  Game    │    │          │
└─────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │              │               │               │               │
   MetaMask     Pilih time      Approve TX      Real-time      Smart contract
   connect      control +       di wallet       WebSocket      auto-send
                bet amount                      gameplay       95% winner
                                                                5% treasury
```

### 4.2 Flow: Create Open Challenge
1. User klik "Create Game"
2. Pilih time control (Blitz 5+0)
3. Pilih token (USDC on Base)
4. Masukkan bet ($50)
5. Preview: "Pot: $100 | Fee: $5 | Winner gets: $95"
6. Klik "Create Challenge" → approve USDC → TX confirmed
7. Challenge muncul di lobby
8. Lawan join → deposit → game auto-start

### 4.3 Flow: Quick Match
1. User klik "Quick Match"
2. Pilih time control & bet range ($10-$50)
3. Deposit ke escrow
4. System cari lawan dengan range yang cocok
5. Match found → game auto-start
6. Jika tidak ada lawan dalam 2 menit → refund + cancel

### 4.4 Flow: Game Ends (Checkmate)
1. Pemenang delivers checkmate
2. UI tampilkan "You Won! +$95 (after 5% fee)"
3. Backend verify game result
4. Smart contract settleMatch() called
5. TX confirmed → winner receives $95 USDC
6. Stats updated, ELO recalculated
7. Game saved to history with PGN

### 4.5 Flow: Disconnection During Game
1. Player A terputus dari internet
2. Timer tetap berjalan (server-side)
3. Player A reconnect dalam 60 detik → game lanjut
4. Jika timeout habis → Player B menang by timeout
5. Settlement tetap berjalan normal

### 4.6 Flow: Draw
1. Position = stalemate / 3-fold / 50-move
2. System auto-detect draw
3. Dialog: "Game Draw — Both players refunded"
4. Smart contract refundMatch(matchId)
5. Kedua pemain terima 100% bet masing-masing (tanpa fee)

---

## 5. Betting Mechanics

### 5.1 Bet Amount Rules
| Parameter | Min | Max |
|-----------|-----|-----|
| Per Game | $1 equivalent | $10,000 equivalent |
| Daily Limit (per user) | — | $50,000 |
| Concurrent Games | 1 | 5 |

### 5.2 Supported Tokens & Chains

| Token | Base (8453) | BSC (56) | Solana |
|-------|:-----------:|:--------:|:------:|
| Native (ETH/BNB/SOL) | ✅ | ✅ | ✅ |
| USDC | ✅ (ERC-20) | ✅ (BEP-20) | ✅ (SPL) |
| USDT | ✅ (ERC-20) | ✅ (BEP-20) | ✅ (SPL) |

### 5.3 Price Oracle
- Gunakan **Chainlink Price Feeds** untuk konversi USD
- Harga di-lock saat kedua pemain deposit (bukan saat game selesai)
- Proteksi dari price manipulation: 5% slippage tolerance

### 5.4 Escrow Rules
- **Deposit Window:** 5 menit untuk kedua pemain
- **Refund:** Jika lawan tidak deposit → otomatis refund 100%
- **Cancellation:** Bisa cancel sebelum lawan join → refund 100%
- **Force Cancel:** Admin bisa cancel jika ada dispute → refund kedua belah pihak
- **Timeout:** Jika game tidak selesai dalam 24 jam (misal abandon) → draw, refund

### 5.5 Anti-Cheat
- **Move Validation:** Server-side chess engine validasi setiap gerakan
- **Bot Detection:** Analisis pola waktu gerakan (too consistent = suspicious)
- **Fair Play Score:** Statistical analysis dari game history
- **Reporting:** Player bisa report, admin review
- **Ban:** Cheater di-ban, dana dalam game yang aktif di-refund

---

## 6. Smart Contract Specification

### 6.1 EVM Contracts (Base & BSC) — Royal ChessEscrow

```solidity
// Simplified interface — Solidity
struct Match {
    bytes32 matchId;
    address player1;
    address player2;
    address token;          // ERC-20 token address (0x0 for native)
    uint256 betAmount;      // per player
    uint256 totalPot;
    uint256 platformFee;    // 5% of totalPot
    uint8   status;         // Created, Funded, InProgress, Settled, Cancelled, Draw
    uint256 createdAt;
    uint256 depositDeadline;
}

// Key functions
function createMatch(address token, uint256 betAmount, bytes32 matchHash) external payable;
function joinMatch(bytes32 matchId) external payable;
function settleMatch(bytes32 matchId, address winner) external onlyBackend;
function cancelMatch(bytes32 matchId) external;  // before opponent joins
function refundMatch(bytes32 matchId) external;  // draw / timeout
function updateFeeRate(uint256 newRate) external onlyOwner; // max 10%
```

### 6.2 Solana Program (Anchor) — royal_chess_escrow

```rust
// Simplified interface — Anchor/Rust
#[account]
pub struct Match {
    pub match_id: [u8; 32],
    pub player_1: Pubkey,
    pub player_2: Pubkey,
    pub bet_mint: Pubkey,          // SPL Token mint (native SOL = system program)
    pub bet_amount: u64,           // lamports / token base units
    pub total_pot: u64,
    pub platform_fee: u64,         // 5% of total_pot
    pub status: MatchStatus,       // Created, Funded, InProgress, Settled, Cancelled, Draw
    pub created_at: i64,
    pub deposit_deadline: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MatchStatus { Created, Funded, InProgress, Settled, Cancelled, Draw }

// Key instructions
pub fn create_match(ctx: Context<CreateMatch>, bet_amount: u64) -> Result<()>
pub fn join_match(ctx: Context<JoinMatch>) -> Result<()>
pub fn settle_match(ctx: Context<SettleMatch>, winner: Pubkey) -> Result<()>  // only_backend signer
pub fn cancel_match(ctx: Context<CancelMatch>) -> Result<()>   // before opponent joins
pub fn refund_match(ctx: Context<RefundMatch>) -> Result<()>   // draw / timeout

// SPL Token handling via Associated Token Accounts (ATA)
// Native SOL via system_program transfer
// Platform fee → treasury PDA / wallet
```

### 6.3 Solana-Specific Notes
| Aspek | Detail |
|-------|--------|
| **Token Standard** | SPL Token (native SOL + SPL tokens) |
| **USDC on Solana** | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (SPL mint) |
| **USDT on Solana** | Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB |
| **PDA (Program Derived Address)** | Escrow vault account per match |
| **Rent** | Match account rent exempt (~0.002 SOL) — platform covers |
| **TX Speed** | ~400ms finality, < $0.01 per TX |
| **Wallet Adapter** | @solana/wallet-adapter (Phantom, Solflare, Backpack) |

### 6.4 Fee Model (Sama untuk Semua Chain)
```
Total Pot    = Player1 Bet + Player2 Bet = 2 × $50 = $100
Platform Fee = Total Pot × 5% = $100 × 5% = $5
Winner Gets  = Total Pot - Fee = $100 - $5 = $95
Treasury Gets = $5
```

### 6.5 Security Features

**EVM (Base & BSC):**
- **ReentrancyGuard** — Prevent reentrancy attacks
- **Pausable** — Emergency pause by admin
- **Multi-sig Treasury** — 3-of-5 multi-sig for treasury withdrawals
- **Timelock** — Fee rate changes require 48-hour timelock
- **Max Bet Cap** — Hardcoded max bet per game
- **Upgradeable** — UUPS proxy pattern for contract upgrades

**Solana:**
- **PDA Authority** — Escrow vault owned by program PDA, bukan wallet
- **Signer Validation** — Backend authority verified via `has_one` constraint
- **Anchor Security** — Auto-checks account ownership, deserialization, discriminator
- **Reinit Protection** — Account discriminator prevents re-initialization attacks
- **Pausable Flag** — Global pause flag stored in program state account
- **Multi-sig Treasury** — Squads multisig for treasury withdrawals

---

## 7. Non-Functional Requirements

### 7.1 Performance
| Metric | Target |
|--------|--------|
| Page Load Time | <2 detik |
| Move Latency (WebSocket) | <100ms |
| Smart Contract TX | <30 detik confirmation |
| Settlement Time | <2 menit setelah game selesai |
| Concurrent Users | 10,000+ |
| Concurrent Games | 5,000+ |

### 7.2 Scalability
- Horizontal scaling backend servers
- WebSocket load balancing (sticky sessions)
- Database sharding by user region
- CDN untuk static assets
- Smart contract tidak bottleneck (off-chain game, on-chain settlement only)

### 7.3 Security
| Area | Measures |
|------|----------|
| **Smart Contract** | Audit oleh 2+ firma, formal verification, bug bounty |
| **Backend** | Rate limiting, input sanitization, SQL injection prevention |
| **Frontend** | CSP headers, XSS prevention, HTTPS only |
| **Auth** | Wallet signature (SIWE - Sign-In with Ethereum) |
| **Anti-Cheat** | Server-side validation, statistical analysis |
| **DDoS** | Cloudflare, rate limiting per IP/wallet |

### 7.4 Availability
- Uptime target: 99.9% (< 8.76 jam downtime/tahun)
- Multi-region deployment
- Automatic failover
- Database replication

### 7.5 Compliance
- KYC optional untuk small amounts (<$1000/game)
- KYC required untuk large amounts (>$1000/game)
- Geo-blocking untuk negara yang melarang crypto gambling
- Terms of Service yang jelas
- Responsible gambling: deposit limits, self-exclusion

---

## 8. Edge Cases & Error Handling

### 8.1 Game Edge Cases
| Scenario | Behavior |
|----------|----------|
| Player disconnects, reconnects <60s | Game continues |
| Player disconnects, timeout expires | Opponent wins by timeout |
| Both players disconnect | Last player to move wins if their clock runs out |
| Server crash during game | Resume from last known state, clocks adjusted |
| Illegal move attempted | Client rejects + server rejects, no penalty |
| Draw by agreement | Both refunded 100%, no fee |
| Draw by repetition/50-move | Both refunded 100%, no fee |
| Stalemate | Both refunded 100%, no fee |
| Game abandoned >24h | Auto-cancelled, both refunded |

### 8.2 Blockchain Edge Cases (EVM — Base & BSC)
| Scenario | Behavior |
|----------|----------|
| Gas price spike | Show warning, let user wait or proceed |
| TX stuck (low gas) | "Speed up" button, cancel TX option |
| Wrong chain connected | Prompt chain switch before any action |
| Insufficient balance | Block bet creation, show balance |
| Contract paused | Show maintenance notice, refund active games |
| Oracle price failure | Use fallback oracle or delay settlement |
| Token depeg >10% | Freeze new bets for that token |
| RPC node down | Failover to backup RPC |

### 8.3 Blockchain Edge Cases (Solana)
| Scenario | Behavior |
|----------|----------|
| Network congestion / TPS spike | Retry with priority fee, show estimated confirmation time |
| Transaction dropped | Auto-retry up to 3x with higher priority fee |
| Insufficient SOL for rent/gas | Block bet creation, show minimum SOL required |
| ATA (Associated Token Account) not created | Auto-create ATA in same TX batch |
| Wrong Solana wallet connected | Prompt correct wallet if not matching stored pubkey |
| Solana downtime (rare) | Queue TX, retry when network resumes, show maintenance banner |
| SPL token program update | Pin to known program version, audit before upgrade |
| Priority fee spike | Dynamic priority fee estimation via Helius/QuickNode API |

### 8.3 User Edge Cases
| Scenario | Behavior |
|----------|----------|
| Tab closed during game | Timer runs, reconnect on reopen |
| Multiple tabs | Only latest tab is active, others show warning |
| Bet created, no opponent in 5 min | Auto-refund |
| Approve TX rejected | Show error, let retry |
| Deposit TX to wrong address | Support ticket (cannot auto-recover) |
| Self-challenge (2 wallets) | IP/fingerprint detection, flag for review |

---

## 9. Success Metrics (KPIs)

### 9.1 Launch (Month 1-3)
| Metric | Target |
|--------|--------|
| Registered Users (wallet connected) | 5,000 |
| Daily Active Users | 500 |
| Games Played / Day | 200 |
| Total Volume (Monthly) | $100,000 |
| Platform Revenue (Monthly) | $5,000 |
| Avg Games per User / Day | 2.5 |
| User Retention (D7) | 30% |
| User Retention (D30) | 15% |

### 9.2 Growth (Month 4-12)
| Metric | Target |
|--------|--------|
| Registered Users | 50,000 |
| Daily Active Users | 5,000 |
| Games Played / Day | 3,000 |
| Total Volume (Monthly) | $2,000,000 |
| Platform Revenue (Monthly) | $100,000 |
| Avg Bet Size | $50 |
| Chain Distribution | Base 60%, BSC 40% |

### 9.3 Health Metrics
| Metric | Target |
|--------|--------|
| Cheater Detection Rate | >95% |
| False Positive Rate | <1% |
| Settlement Failure Rate | <0.1% |
| Support Ticket Resolution | <24 jam |
| NPS Score | >40 |

---

## 10. Future Roadmap

### Phase 2 (Month 6-9)
- [ ] Tournament mode (bracket, Swiss, round-robin)
- [ ] Spectator mode dengan live betting
- [ ] Mobile app (React Native)
- [ ] NFT avatars & achievements
- [ ] Guild/team system

### Phase 3 (Month 9-12)
- [ ] AI practice mode (Stockfish levels)
- [ ] Puzzle rush dengan betting
- [ ] Cross-chain bridge (seamless Base↔BSC)
- [ ] DAO governance untuk fee rate & rules
- [ ] Streaming integration (Twitch/YouTube)

### Phase 4 (Year 2)
- [ ] Betting marketplace (P2P side bets)
- [ ] Crypto rewards token ($CBET)
- [ ] Staking & yield dari treasury
- [ ] Variants: Chess960, Bughouse, Crazyhouse
- [ ] VR/AR chess experience

---

## 11. Glossary

| Istilah | Definisi |
|---------|----------|
| **ELO** | Rating system untuk mengukur kekuatan pemain |
| **Escrow** | Smart contract yang menyimpan dana sampai syarat terpenuhi |
| **PGN** | Portable Game Notation — format standar rekaman game catur |
| **Base** | Layer 2 Ethereum oleh Coinbase (chain ID 8453) |
| **BSC/BNB Chain** | Blockchain oleh Binance (chain ID 56) |
| **SIWE** | Sign-In with Ethereum — standar autentikasi wallet |
| **Treasury** | Wallet platform untuk mengumpulkan fee |
| **Multi-sig** | Wallet yang butuh N dari M tanda tangan untuk TX |
| **Meta-transaction** | TX yang gas fee-nya dibayar oleh relayer, bukan user |
| **Oracle** | Sumber data harga on-chain (Chainlink) |

---

*Document ini adalah living document dan akan di-update sesuai perkembangan proyek.*
