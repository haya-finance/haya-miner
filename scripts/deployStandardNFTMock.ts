import hre from "hardhat";
require("dotenv").config();
const { ethers, run, defender } = require("hardhat");
async function main() {
  const CONTRACTS_OWNER = process.env.CONTRACTS_OWNER as string;
  const StandardNFTMock = await ethers.getContractFactory("StandardNFTMock");
  const token = await defender.deployContract(StandardNFTMock, [
    "",
    CONTRACTS_OWNER,
  ]);
  console.log("wait deployed...");
  await token.waitForDeployment();
  console.log(`deployed to ${await token.getAddress()}`);

  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: await token.getAddress(),
      constructorArguments: ["", CONTRACTS_OWNER],
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
