import dotenv from "dotenv";
dotenv.config({ path: "../../../.env" });

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  nodeEnv: process.env.NODE_ENV || "development",

  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/royalchess",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",

  // EVM
  baseRpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  bscRpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org",
  evmEscrowAddress: process.env.EVM_ESCROW_ADDRESS || "",
  deployerPrivateKey: process.env.DEPLOYER_PRIVATE_KEY || "",

  // Solana
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  solanaProgramId: process.env.SOLANA_PROGRAM_ID || "",
  solanaAuthorityKey: process.env.SOLANA_AUTHORITY_KEY || "",

  // Game
  reconnectWindowSec: parseInt(process.env.RECONNECT_WINDOW_SEC || "60"),
  matchTimeoutSec: parseInt(process.env.MATCH_TIMEOUT_SEC || "86400"), // 24h

  // Platform
  treasuryAddress: process.env.TREASURY_ADDRESS || "",
  feeRateBps: parseInt(process.env.FEE_RATE_BPS || "500"), // 5%
};
