import { ethers, upgrades, network, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`Network: ${network.name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const feeRateBps = 500; // 5%

  console.log(`\nDeploying RoyalChessEscrow...`);
  console.log(`Treasury: ${treasury}`);
  console.log(`Fee Rate: ${feeRateBps} bps (5%)`);

  const Escrow = await ethers.getContractFactory("RoyalChessEscrow");
  const escrow = await upgrades.deployProxy(Escrow, [treasury, feeRateBps], {
    kind: "uups",
    unsafeAllow: ["constructor"],
  });
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(address);

  console.log(`\n✅ RoyalChessEscrow deployed!`);
  console.log(`   Proxy:            ${address}`);
  console.log(`   Implementation:   ${implAddress}`);
  console.log(`   Treasury:         ${treasury}`);
  console.log(`   Fee Rate:         ${feeRateBps} bps (5%)`);

  // Verify on explorer
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log(`\nWaiting for block confirmations...`);
    await escrow.deploymentTransaction()?.wait(5);

    console.log(`Verifying implementation contract on Etherscan...`);
    try {
      await run("verify:verify", {
        address: implAddress,
        constructorArguments: [],
      });
      console.log(`✅ Implementation verified!`);
    } catch (e: any) {
      if (e.message.includes("Already Verified") || e.message.includes("already verified")) {
        console.log(`ℹ️  Already verified.`);
      } else {
        console.log(`⚠️  Verify failed: ${e.message}`);
      }
    }
  }

  console.log(`\n📋 Deployment Summary:`);
  console.log(`   Proxy:            ${address}`);
  console.log(`   Implementation:   ${implAddress}`);
  console.log(`   Network:          ${network.name}`);
  console.log(`   Treasury:         ${treasury}`);
  console.log(`   Fee Rate:         ${feeRateBps} bps (5%)`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
