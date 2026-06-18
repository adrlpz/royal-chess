import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, bsc } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Royal Chess",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "royalchess-default",
  chains: [base, bsc],
  ssr: true,
});

export const SUPPORTED_CHAINS = {
  BASE: { id: 8453, name: "Base", rpc: "https://mainnet.base.org" },
  BSC: { id: 56, name: "BNB Chain", rpc: "https://bsc-dataseed1.binance.org" },
} as const;

export const SUPPORTED_TOKENS = {
  BASE: [
    { symbol: "ETH", name: "Ether", address: null, decimals: 18 },
    { symbol: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "USDT", name: "Tether", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
  ],
  BSC: [
    { symbol: "BNB", name: "BNB", address: null, decimals: 18 },
    { symbol: "USDC", name: "USD Coin", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    { symbol: "USDT", name: "Tether", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  ],
  SOLANA: [
    { symbol: "SOL", name: "Solana", address: null, decimals: 9 },
    { symbol: "USDC", name: "USD Coin (SPL)", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    { symbol: "USDT", name: "Tether (SPL)", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  ],
} as const;
