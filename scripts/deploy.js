const hre = require("hardhat");

async function main() {
  console.log("\n🔒 PrivaCast — Deploying to Sepolia...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.error("❌ No ETH in deployer wallet.");
    console.error("   Get free Sepolia ETH from: https://sepoliafaucet.com");
    process.exit(1);
  }

  console.log("Deploying PrivaCast contract...");
  const PrivaCast = await hre.ethers.getContractFactory("PrivaCast");
  const contract  = await PrivaCast.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ PrivaCast deployed successfully!");
  console.log("   Contract address:", address);
  console.log("   Sepolia Etherscan:", `https://sepolia.etherscan.io/address/${address}`);
  console.log("\n📋 Next step:");
  console.log(`   Copy this address into index.html:`);
  console.log(`   const CONTRACT_ADDRESS = "${address}";\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
