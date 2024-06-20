import hre from "hardhat";

const { ethers, run, upgrades } = require("hardhat");

async function main() {
  const miner_free_staking_proxy = "0x158fb550a30905B3e289f8292BE55ddEb29fF338";
  const MinerFreeStakingContract = await ethers.getContractFactory(
    "MinerFreeStakingContract"
  );
  const MinerFreeStakingContractV2 = await ethers.getContractFactory(
    "MinerFreeStakingContractV2"
  );
  await upgrades.forceImport(
    miner_free_staking_proxy,
    MinerFreeStakingContract
  );

  console.log("Upgrading MinerFreeStakingContract...");
  await upgrades.upgradeProxy(
    miner_free_staking_proxy,
    MinerFreeStakingContractV2
  );
  console.log("MinerFreeStakingContract upgraded");
  const newImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(miner_free_staking_proxy);
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
