import hre from "hardhat";

const { ethers, run, upgrades } = require("hardhat");

async function main() {
  const miner_staking_proxy = "0x6737084Ffb31849444D8e8CA4BF45FE5d4Cc545c";
  const MinerStakingContract = await ethers.getContractFactory(
    "MinerStakingContract"
  );
  const MinerStakingContractV2 = await ethers.getContractFactory(
    "MinerStakingContractV2"
  );
  await upgrades.forceImport(miner_staking_proxy, MinerStakingContract);

  console.log("Upgrading MinerStakingContract...");
  await upgrades.upgradeProxy(miner_staking_proxy, MinerStakingContractV2);
  console.log("MinerStakingContract upgraded");
  const newImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(miner_staking_proxy);
  console.log("New Implementation Address:", newImplementationAddress);

  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: newImplementationAddress,
    });
  } catch (error) {
    console.log(error);
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
