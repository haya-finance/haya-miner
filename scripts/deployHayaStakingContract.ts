import hre from "hardhat";

const { ethers, run, defender } = require("hardhat");

require("dotenv").config();

async function main() {
  const HAYA_CONTRACT_ADDRESS = process.env.HAYA_CONTRACT_ADDRESS as string;
  console.log("HayaStakingContract deploying...");
  const HayaStakingContract = await ethers.getContractFactory(
    "HayaStakingContract"
  );
  const hayaStakingContract = await defender.deployContract(
    HayaStakingContract,
    [HAYA_CONTRACT_ADDRESS]
  );
  await hayaStakingContract.waitForDeployment();
  console.log(
    `HayaStakingContract deployed to ${await hayaStakingContract.getAddress()}`
  );
  console.log("Verify HayaStakingContract...");
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: await hayaStakingContract.getAddress(),
      constructorArguments: [HAYA_CONTRACT_ADDRESS],
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
