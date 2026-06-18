import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { RoyalChessEscrow } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RoyalChessEscrow", function () {
  let escrow: RoyalChessEscrow;
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const FEE_RATE = 500; // 5%
  const BET_AMOUNT = ethers.parseEther("0.01");
  const matchId = ethers.keccak256(ethers.toUtf8Bytes("test-match-1"));

  beforeEach(async function () {
    [owner, player1, player2, treasury, other] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("RoyalChessEscrow");
    escrow = await upgrades.deployProxy(Escrow, [treasury.address, FEE_RATE], {
      kind: "uups",
      unsafeAllow: ["constructor"],
    }) as unknown as RoyalChessEscrow;
    await escrow.waitForDeployment();
  });

  // ─── Initialization ───────────────────────────────────────────────
  describe("Initialization", function () {
    it("should set treasury and fee rate", async function () {
      expect(await escrow.treasury()).to.equal(treasury.address);
      expect(await escrow.feeRateBps()).to.equal(FEE_RATE);
    });

    it("should reject zero treasury", async function () {
      const Escrow = await ethers.getContractFactory("RoyalChessEscrow");
      await expect(
        upgrades.deployProxy(Escrow, [ethers.ZeroAddress, FEE_RATE], { kind: "uups", unsafeAllow: ["constructor"] })
      ).to.be.revertedWith("Invalid treasury");
    });

    it("should reject fee rate above max during init", async function () {
      const Escrow = await ethers.getContractFactory("RoyalChessEscrow");
      await expect(
        upgrades.deployProxy(Escrow, [treasury.address, 1001], { kind: "uups", unsafeAllow: ["constructor"] })
      ).to.be.revertedWith("Fee too high");
    });
  });

  // ─── createMatch ──────────────────────────────────────────────────
  describe("createMatch", function () {
    it("should create match with native deposit", async function () {
      await expect(
        escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT })
      )
        .to.emit(escrow, "MatchCreated")
        .withArgs(matchId, player1.address, ethers.ZeroAddress, BET_AMOUNT);

      const m = await escrow.getMatch(matchId);
      expect(m.player1).to.equal(player1.address);
      expect(m.betAmount).to.equal(BET_AMOUNT);
      expect(m.status).to.equal(0); // Created
    });

    it("should reject duplicate matchId", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(
        escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT })
      ).to.be.revertedWith("Match exists");
    });

    it("should reject wrong native amount", async function () {
      await expect(
        escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Wrong native amount");
    });

    it("should reject zero bet amount", async function () {
      await expect(
        escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, 0, { value: 0 })
      ).to.be.revertedWith("Zero bet");
    });

    it("should reject bet below minimum", async function () {
      const tooLow = ethers.parseEther("0.0001");
      await expect(
        escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, tooLow, { value: tooLow })
      ).to.be.revertedWith("Bet too low");
    });

    it("should reject bet above maximum", async function () {
      const tooHigh = ethers.parseEther("101");
      await expect(
        escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, tooHigh, { value: tooHigh })
      ).to.be.revertedWith("Bet too high");
    });

    it("should reject native sent with ERC-20 token address", async function () {
      const fakeToken = "0x1234567890123456789012345678901234567890";
      await expect(
        escrow.connect(player1).createMatch(matchId, fakeToken, BET_AMOUNT, { value: BET_AMOUNT })
      ).to.be.revertedWith("No native needed");
    });

    it("should reject create when paused", async function () {
      await escrow.pause();
      await expect(
        escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT })
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });

    it("should compute correct fee", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      const m = await escrow.getMatch(matchId);

      const expectedPot = BET_AMOUNT * 2n;
      const expectedFee = (expectedPot * BigInt(FEE_RATE)) / 10000n;
      expect(m.totalPot).to.equal(expectedPot);
      expect(m.platformFee).to.equal(expectedFee);
    });
  });

  // ─── joinMatch ────────────────────────────────────────────────────
  describe("joinMatch", function () {
    beforeEach(async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
    });

    it("should allow player2 to join", async function () {
      await expect(
        escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT })
      )
        .to.emit(escrow, "MatchJoined")
        .withArgs(matchId, player2.address);

      const m = await escrow.getMatch(matchId);
      expect(m.player2).to.equal(player2.address);
      expect(m.status).to.equal(1); // Funded
    });

    it("should reject self-join", async function () {
      await expect(
        escrow.connect(player1).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT })
      ).to.be.revertedWith("Cannot self-join");
    });

    it("should reject wrong bet amount", async function () {
      await expect(
        escrow.connect(player2).joinMatch(matchId, ethers.parseEther("0.02"), { value: ethers.parseEther("0.02") })
      ).to.be.revertedWith("Bet amount mismatch");
    });

    it("should reject joining non-existent match", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      await expect(
        escrow.connect(player2).joinMatch(fakeId, BET_AMOUNT, { value: BET_AMOUNT })
      ).to.be.revertedWith("Match not found");
    });

    it("should reject joining already full match", async function () {
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(
        escrow.connect(other).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT })
      ).to.be.revertedWith("Not joinable");
    });

    it("should reject joining when paused", async function () {
      await escrow.pause();
      await expect(
        escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT })
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });

    it("should reject wrong native amount on join", async function () {
      await expect(
        escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Wrong native amount");
    });
  });

  // ─── settleMatch ──────────────────────────────────────────────────
  describe("settleMatch", function () {
    beforeEach(async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });
    });

    it("should reject settle on Funded status (must be InProgress)", async function () {
      await expect(
        escrow.settleMatch(matchId, player1.address)
      ).to.be.revertedWith("Not settleable");
    });

    it("should settle after startMatch and pay winner + treasury", async function () {
      await escrow.startMatch(matchId);

      const totalPot = BET_AMOUNT * 2n;
      const fee = (totalPot * BigInt(FEE_RATE)) / 10000n;
      const payout = totalPot - fee;

      await expect(escrow.settleMatch(matchId, player1.address))
        .to.emit(escrow, "MatchSettled")
        .withArgs(matchId, player1.address, payout, fee);

      const m = await escrow.getMatch(matchId);
      expect(m.status).to.equal(3); // Settled
    });

    it("should pay correct amounts to winner and treasury", async function () {
      await escrow.startMatch(matchId);

      const totalPot = BET_AMOUNT * 2n;
      const fee = (totalPot * BigInt(FEE_RATE)) / 10000n;

      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      await escrow.settleMatch(matchId, player2.address);
      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);

      expect(treasuryBalAfter - treasuryBalBefore).to.equal(fee);
    });

    it("should reject invalid winner", async function () {
      await escrow.startMatch(matchId);
      await expect(
        escrow.settleMatch(matchId, other.address)
      ).to.be.revertedWith("Invalid winner");
    });

    it("should reject non-owner settlement", async function () {
      await escrow.startMatch(matchId);
      await expect(
        escrow.connect(player1).settleMatch(matchId, player1.address)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should reject double settle", async function () {
      await escrow.startMatch(matchId);
      await escrow.settleMatch(matchId, player1.address);
      await expect(
        escrow.settleMatch(matchId, player2.address)
      ).to.be.revertedWith("Not settleable");
    });
  });

  // ─── startMatch ───────────────────────────────────────────────────
  describe("startMatch", function () {
    it("should start a funded match and emit MatchStarted", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });

      await expect(escrow.startMatch(matchId))
        .to.emit(escrow, "MatchStarted")
        .withArgs(matchId);

      const m = await escrow.getMatch(matchId);
      expect(m.status).to.equal(2); // InProgress
    });

    it("should reject starting non-funded match", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(escrow.startMatch(matchId)).to.be.revertedWith("Not fundable");
    });

    it("should reject non-owner start", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(escrow.connect(player1).startMatch(matchId)).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  // ─── cancelMatch ──────────────────────────────────────────────────
  describe("cancelMatch", function () {
    it("should allow player1 to cancel before opponent joins", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(escrow.connect(player1).cancelMatch(matchId))
        .to.emit(escrow, "MatchCancelled")
        .withArgs(matchId);
    });

    it("should allow owner to cancel before opponent joins", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(escrow.cancelMatch(matchId))
        .to.emit(escrow, "MatchCancelled");
    });

    it("should reject cancel by non-player1/non-owner", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(escrow.connect(other).cancelMatch(matchId)).to.be.revertedWith("Not authorized");
    });

    it("should reject cancel after opponent joins", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });
      // Status is now Funded, so "Cannot cancel" hits first (status != Created)
      await expect(escrow.connect(player1).cancelMatch(matchId)).to.be.revertedWith("Cannot cancel");
    });

    it("should reject cancel on non-Created status", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.startMatch(matchId);
      await expect(escrow.cancelMatch(matchId)).to.be.revertedWith("Cannot cancel");
    });
  });

  // ─── refundMatch + claimWithdrawal (Pull Pattern) ────────────────
  describe("refundMatch + claimWithdrawal", function () {
    it("should refund both players via owner (draw) — pull pattern", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });

      await expect(escrow.refundMatch(matchId, "draw"))
        .to.emit(escrow, "MatchRefunded");

      // Status changed to Draw
      const m = await escrow.getMatch(matchId);
      expect(m.status).to.equal(5);

      // Funds are pending, not yet transferred
      expect(await escrow.pendingClaim(matchId, player1.address)).to.equal(BET_AMOUNT);
      expect(await escrow.pendingClaim(matchId, player2.address)).to.equal(BET_AMOUNT);
    });

    it("should allow players to claim withdrawals", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.refundMatch(matchId, "draw");

      const p1BalBefore = await ethers.provider.getBalance(player1.address);
      const tx = await escrow.connect(player1).claimWithdrawal(matchId);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const p1BalAfter = await ethers.provider.getBalance(player1.address);

      expect(p1BalAfter - p1BalBefore + gasCost).to.equal(BET_AMOUNT);
      expect(await escrow.pendingClaim(matchId, player1.address)).to.equal(0);

      // Emit event
      await expect(escrow.connect(player2).claimWithdrawal(matchId))
        .to.emit(escrow, "WithdrawalClaimed")
        .withArgs(matchId, player2.address, BET_AMOUNT);
    });

    it("should reject double claim", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.refundMatch(matchId, "expired");
      await escrow.connect(player1).claimWithdrawal(matchId);
      await expect(escrow.connect(player1).claimWithdrawal(matchId)).to.be.revertedWith("Nothing to claim");
    });

    it("should reject claim with nothing pending", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(escrow.connect(other).claimWithdrawal(matchId)).to.be.revertedWith("Nothing to claim");
    });

    it("should allow player1 to refund expired Created match", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);

      await expect(escrow.connect(player1).refundMatch(matchId, "expired"))
        .to.emit(escrow, "MatchRefunded");

      expect(await escrow.pendingClaim(matchId, player1.address)).to.equal(BET_AMOUNT);
    });

    it("should reject player1 refund before deadline", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await expect(escrow.connect(player1).refundMatch(matchId, "not expired"))
        .to.be.revertedWith("Not expired");
    });

    it("should reject player1 refund on Funded status (owner only)", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });

      await expect(escrow.connect(player1).refundMatch(matchId, "draw"))
        .to.be.revertedWith("Only owner can refund funded/active");
    });

    it("should reject non-owner/non-player1 refund", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });

      await expect(escrow.connect(other).refundMatch(matchId, "draw"))
        .to.be.revertedWith("Not authorized");
    });

    it("should reject refund on settled match", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.startMatch(matchId);
      await escrow.settleMatch(matchId, player1.address);

      await expect(escrow.refundMatch(matchId, "double")).to.be.revertedWith("Not refundable");
    });
  });

  // ─── Fee Rate Timelock ────────────────────────────────────────────
  describe("Fee Rate Timelock (FIX-8)", function () {
    it("should schedule fee rate change", async function () {
      await expect(escrow.scheduleFeeRateChange(300))
        .to.emit(escrow, "FeeRateUpdateScheduled");

      expect(await escrow.pendingFeeRate()).to.equal(300);
      expect(await escrow.feeChangeTimestamp()).to.be.gt(0);
    });

    it("should reject execute before timelock expires", async function () {
      await escrow.scheduleFeeRateChange(300);
      await expect(escrow.executeFeeRateChange()).to.be.revertedWith("Timelock not expired");
    });

    it("should execute after timelock expires", async function () {
      await escrow.scheduleFeeRateChange(300);

      // Fast-forward 48 hours
      await ethers.provider.send("evm_increaseTime", [48 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(escrow.executeFeeRateChange())
        .to.emit(escrow, "FeeRateUpdated")
        .withArgs(500, 300);

      expect(await escrow.feeRateBps()).to.equal(300);
      expect(await escrow.pendingFeeRate()).to.equal(0);
    });

    it("should cancel pending fee change", async function () {
      await escrow.scheduleFeeRateChange(300);
      await escrow.cancelFeeRateChange();

      expect(await escrow.pendingFeeRate()).to.equal(0);
      expect(await escrow.feeChangeTimestamp()).to.equal(0);
    });

    it("should reject execute when no change scheduled", async function () {
      await expect(escrow.executeFeeRateChange()).to.be.revertedWith("No change scheduled");
    });

    it("should reject fee above max even in schedule", async function () {
      await expect(escrow.scheduleFeeRateChange(1001)).to.be.revertedWith("Fee too high");
    });
  });

  // ─── Admin ────────────────────────────────────────────────────────
  describe("Admin", function () {
    it("should pause and unpause", async function () {
      await escrow.pause();
      await expect(
        escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT })
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await escrow.unpause();
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      const m = await escrow.getMatch(matchId);
      expect(m.player1).to.equal(player1.address);
    });

    it("should update treasury", async function () {
      await escrow.setTreasury(other.address);
      expect(await escrow.treasury()).to.equal(other.address);
    });

    it("should reject zero treasury", async function () {
      await expect(escrow.setTreasury(ethers.ZeroAddress)).to.be.revertedWith("Invalid treasury");
    });

    it("should reject non-owner admin calls", async function () {
      await expect(escrow.connect(player1).pause()).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
      await expect(escrow.connect(player1).setTreasury(player1.address)).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  // ─── End-to-End Flow ──────────────────────────────────────────────
  describe("End-to-End Flow", function () {
    it("full game lifecycle: create → join → start → settle", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });

      await expect(escrow.startMatch(matchId)).to.emit(escrow, "MatchStarted");

      const totalPot = BET_AMOUNT * 2n;
      const fee = (totalPot * BigInt(FEE_RATE)) / 10000n;
      const payout = totalPot - fee;

      await escrow.settleMatch(matchId, player1.address);
      const m = await escrow.getMatch(matchId);
      expect(m.status).to.equal(3);
    });

    it("draw lifecycle: create → join → start → refund → claim", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player2).joinMatch(matchId, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.startMatch(matchId);

      await escrow.refundMatch(matchId, "stalemate");
      let m = await escrow.getMatch(matchId);
      expect(m.status).to.equal(5);

      // Both players claim
      await escrow.connect(player1).claimWithdrawal(matchId);
      await escrow.connect(player2).claimWithdrawal(matchId);

      expect(await escrow.pendingClaim(matchId, player1.address)).to.equal(0);
      expect(await escrow.pendingClaim(matchId, player2.address)).to.equal(0);
    });

    it("cancelled lifecycle: create → cancel (no opponent)", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });
      await escrow.connect(player1).cancelMatch(matchId);
      const m = await escrow.getMatch(matchId);
      expect(m.status).to.equal(4);
    });

    it("expired deposit lifecycle: create → wait → player1 refund → claim", async function () {
      await escrow.connect(player1).createMatch(matchId, ethers.ZeroAddress, BET_AMOUNT, { value: BET_AMOUNT });

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(player1).refundMatch(matchId, "no opponent");
      await escrow.connect(player1).claimWithdrawal(matchId);

      expect(await escrow.pendingClaim(matchId, player1.address)).to.equal(0);
    });
  });

  // ─── UUPS Upgrade ─────────────────────────────────────────────────
  describe("UUPS Upgrade", function () {
    it("should allow owner to upgrade", async function () {
      const EscrowV2 = await ethers.getContractFactory("RoyalChessEscrow");
      const upgraded = await upgrades.upgradeProxy(await escrow.getAddress(), EscrowV2, { unsafeAllow: ["constructor"] });
      expect(await upgraded.treasury()).to.equal(treasury.address);
      expect(await upgraded.feeRateBps()).to.equal(FEE_RATE);
    });

    it("should reject non-owner upgrade", async function () {
      const EscrowV2 = await ethers.getContractFactory("RoyalChessEscrow", player1);
      await expect(
        upgrades.upgradeProxy(await escrow.getAddress(), EscrowV2, { unsafeAllow: ["constructor"] })
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });
});
