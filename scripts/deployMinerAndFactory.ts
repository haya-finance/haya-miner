import hre from "hardhat";

const { ethers, run, defender } = require("hardhat");

require("dotenv").config();

async function main() {
  const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS as string;
  const MINER_META_URI = process.env.MINER_META_URI as string;
  const CONTRACTS_OWNER = process.env.CONTRACTS_OWNER as string;
  const PUBLIC_SALE_START_TIME = process.env.PUBLIC_SALE_START_TIME as string;
  const SALE_BENIFICIARIES = process.env.SALE_BENIFICIARIES as string;

  console.log("--------------------");
  console.log("Miner deploying...");
  const Miner = await ethers.getContractFactory("Miner");
  const miner = await defender.deployContract(Miner, [
    MINER_META_URI,
    CONTRACTS_OWNER,
  ]);
  await miner.waitForDeployment();
  console.log(`Miner deployed to ${await miner.getAddress()}`);
  console.log("Verify Miner...");
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: await miner.getAddress(),
      constructorArguments: [MINER_META_URI, CONTRACTS_OWNER],
    });
  } catch (error) {
    console.log(error);
  }

  console.log("--------------------");
  console.log("MinerFactory deploying...");

  const factoryLaunchConfig = [
    await miner.getAddress(),
    USDT_CONTRACT_ADDRESS,
    CONTRACTS_OWNER,
    PUBLIC_SALE_START_TIME,
    0,
    SALE_BENIFICIARIES,
  ];

  const MinerFactory = await ethers.getContractFactory("MinerFactory");
  const factory = await defender.deployContract(
    MinerFactory,
    factoryLaunchConfig
  );
  await factory.waitForDeployment();
  console.log(`MinerFactory deployed to ${await factory.getAddress()}`);

  console.log("Verify MinerFactory...");

  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: await factory.getAddress(),
      constructorArguments: factoryLaunchConfig,
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
