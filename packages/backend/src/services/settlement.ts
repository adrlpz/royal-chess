import { ethers } from "ethers";
import { config } from "../config.js";
import { PrismaClient, MatchStatus } from "@prisma/client";

// ABI fragment for settleMatch & refundMatch
const ESCROW_ABI = [
  "function settleMatch(bytes32 matchId, address winner) external",
  "function refundMatch(bytes32 matchId, string reason) external",
  "function startMatch(bytes32 matchId) external",
  "function matches(bytes32) view returns (tuple(bytes32,address,address,address,uint256,uint256,uint256,uint8,uint256,uint256))",
];

export interface SettleParams {
  matchId: string;          // DB match ID
  contractMatchId: string;  // on-chain bytes32 match ID
  chain: "BASE" | "BSC";
  winnerAddress: string | null; // null = draw
  reason: string;
}

export class SettlementService {
  private baseProvider: ethers.JsonRpcProvider;
  private bscProvider: ethers.JsonRpcProvider;
  private baseWallet: ethers.Wallet;
  private bscWallet: ethers.Wallet;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;

    this.baseProvider = new ethers.JsonRpcProvider(config.baseRpcUrl);
    this.bscProvider = new ethers.JsonRpcProvider(config.bscRpcUrl);

    const baseKey = config.deployerPrivateKey;
    this.baseWallet = new ethers.Wallet(baseKey, this.baseProvider);
    this.bscWallet = new ethers.Wallet(baseKey, this.bscProvider);
  }

  /**
   * Settle a match on-chain — winner gets 95%, treasury gets 5%.
   */
  async settleEVM(params: SettleParams): Promise<string> {
    const { matchId, contractMatchId, chain, winnerAddress, reason } = params;

    const wallet = chain === "BASE" ? this.baseWallet : this.bscWallet;
    const escrow = new ethers.Contract(config.evmEscrowAddress, ESCROW_ABI, wallet);

    const matchIdBytes = contractMatchId.startsWith("0x")
      ? contractMatchId
      : ethers.keccak256(ethers.toUtf8Bytes(contractMatchId));

    let tx;
    if (winnerAddress) {
      // Settle: pay winner
      tx = await escrow.settleMatch(matchIdBytes, winnerAddress);
    } else {
      // Draw: refund both
      tx = await escrow.refundMatch(matchIdBytes, reason);
    }

    const receipt = await tx.wait();
    console.log(`[Settlement] ${chain} TX: ${receipt.hash}`);

    // Update DB
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: "COMPLETED" as MatchStatus,
        txHashSettle: receipt.hash,
      },
    });

    return receipt.hash;
  }

  /**
   * Mark match as InProgress on-chain (called when both players deposit).
   */
  async startMatchOnChain(contractMatchId: string, chain: "BASE" | "BSC"): Promise<string> {
    const wallet = chain === "BASE" ? this.baseWallet : this.bscWallet;
    const escrow = new ethers.Contract(config.evmEscrowAddress, ESCROW_ABI, wallet);

    const matchIdBytes = contractMatchId.startsWith("0x")
      ? contractMatchId
      : ethers.keccak256(ethers.toUtf8Bytes(contractMatchId));

    const tx = await escrow.startMatch(matchIdBytes);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Get match state from on-chain contract.
   */
  async getOnChainMatch(contractMatchId: string, chain: "BASE" | "BSC") {
    const provider = chain === "BASE" ? this.baseProvider : this.bscProvider;
    const escrow = new ethers.Contract(config.evmEscrowAddress, ESCROW_ABI, provider);

    const matchIdBytes = contractMatchId.startsWith("0x")
      ? contractMatchId
      : ethers.keccak256(ethers.toUtf8Bytes(contractMatchId));

    return await escrow.matches(matchIdBytes);
  }
}
