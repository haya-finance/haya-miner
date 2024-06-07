import hre from "hardhat";

const { ethers, run, defender } = require("hardhat");

require("dotenv").config();

async function main() {
  const HAYA_CONTRACT_ADDRESS = process.env.HAYA_CONTRACT_ADDRESS as string;
  const CONTRACTS_OWNER = process.env.CONTRACTS_OWNER as string;
  console.log("HayaTokenPool deploying...");
  const HayaTokenPool = await ethers.getContractFactory("HayaTokenPool");
  const hayaTokenPool = await defender.deployContract(HayaTokenPool, [
    HAYA_CONTRACT_ADDRESS,
    CONTRACTS_OWNER,
  ]);
  await hayaTokenPool.waitForDeployment();
  console.log(`HayaTokenPool deployed to ${await hayaTokenPool.getAddress()}`);
  console.log("Verify HayaTokenPool...");
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: await hayaTokenPool.getAddress(),
      constructorArguments: [HAYA_CONTRACT_ADDRESS, CONTRACTS_OWNER],
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
