import hre from "hardhat";

import HayaStakingContract from "../ignition/modules/HayaStakingContract";
import Miner from "../ignition/modules/Miner";
import HayaTokenPool from "../ignition/modules/HayaTokenPool";
import MinerFactory from "../ignition/modules/MinerFactory";
const { ethers, upgrades, run } = require("hardhat");
require("dotenv").config();
async function main() {
  const {
    USDT_CONTRACT_ADDRESS,
    HAYA_CONTRACT_ADDRESS,
    MINER_META_URI,
    PUBLIC_SALE_START_TIME,
    CLAIM_FEE_RECIPIENT,
    SALE_BENIFICIARIES,
    MINER_STAKING_START_TIME,
    MINER_STAKING_OUTPUT_FACTOR,
    WITHDRAW_ORACLE_ADDRESS,
  } = process.env;
  const [owner] = await hre.viem.getWalletClients();
  const CONTRACTS_OWNER = owner.account.address;

  console.log("--------HayaStakingContract deploying------------");
  const { hayaStakingContract } = await hre.ignition.deploy(
    HayaStakingContract,
    {
      parameters: {
        HayaStakingContract: {
          tokenForStaking: HAYA_CONTRACT_ADDRESS as string,
        },
      },
    }
  );
  console.log("HayaStakingContract deployed to:", hayaStakingContract.address);

  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: hayaStakingContract.address,
      constructorArguments: [HAYA_CONTRACT_ADDRESS],
    });
  } catch (error) {
    console.log(error);
  }
  console.log("--------------------\n");
  console.log("--------HayaTokenPool deploying------------");
  const { hayaTokenPool } = await hre.ignition.deploy(HayaTokenPool, {
    parameters: {
      HayaTokenPool: {
        owner: CONTRACTS_OWNER as string,
        tokenForReward: HAYA_CONTRACT_ADDRESS as string,
      },
    },
  });
  console.log("HayaTokenPool deployed to:", hayaTokenPool.address);

  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: hayaTokenPool.address,
      constructorArguments: [HAYA_CONTRACT_ADDRESS, CONTRACTS_OWNER],
    });
  } catch (error) {
    console.log(error);
  }
  console.log("--------------------\n");
  console.log("--------Miner deploying------------");
  const { miner } = await hre.ignition.deploy(Miner, {
    parameters: {
      Miner: {
        owner: CONTRACTS_OWNER as string,
        uri: MINER_META_URI as string,
      },
    },
  });
  console.log("Miner deployed to:", miner.address);
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: miner.address,
      constructorArguments: [MINER_META_URI, CONTRACTS_OWNER],
    });
  } catch (error) {
    console.log(error);
  }
  console.log("--------------------\n");

  console.log("--------MinerFactory deploying------------");
  const { factory } = await hre.ignition.deploy(MinerFactory, {
    parameters: {
      MinerFactory: {
        miner: miner.address,
        tokenForMint: USDT_CONTRACT_ADDRESS as string,
        owner: CONTRACTS_OWNER as string,
        startTime: PUBLIC_SALE_START_TIME as string,
        endTime: 0,
        beneficiaries: SALE_BENIFICIARIES as string,
      },
    },
  });
  console.log("MinerFactory deployed to:", factory.address);
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: factory.address,
      constructorArguments: [
        miner.address,
        USDT_CONTRACT_ADDRESS,
        CONTRACTS_OWNER,
        PUBLIC_SALE_START_TIME,
        0,
        SALE_BENIFICIARIES,
      ],
    });
  } catch (error) {
    console.log(error);
  }
  console.log("--------------------\n");
  console.log("---------Miner Add Factory-----------");
  await miner.write.addFactory([factory.address]);
  console.log("Factory added\n");
  console.log("--------------------\n");

  console.log("---------MinerStakingContract deploying-----------");
  const minerStakingLaunchConfig = [
    MINER_STAKING_OUTPUT_FACTOR,
    miner.address,
    hayaTokenPool.address,
    CONTRACTS_OWNER,
    MINER_STAKING_START_TIME,
    0,
  ];
  const MinerStakingContract = await ethers.getContractFactory(
    "MinerStakingContract"
  );
  const minerStakingContract = await upgrades.deployProxy(
    MinerStakingContract,
    [minerStakingLaunchConfig],
    {
      initializer: "initialize",
    }
  );
  await minerStakingContract.waitForDeployment();
  const minerStakingAddress = await minerStakingContract.getAddress();
  console.log("MinerStakingContract deployed to:", minerStakingAddress);
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: minerStakingAddress,
    });
  } catch (error) {
    console.log(error);
  }
  console.log("--------------------\n");
  console.log("---------MinerFreeStakingContract deploying-----------");
  const minerFreeStakingLaunchConfig = [
    hayaTokenPool.address,
    minerStakingAddress,
    CONTRACTS_OWNER,
  ];
  const MinerFreeStakingContract = await ethers.getContractFactory(
    "MinerFreeStakingContract"
  );
  const minerFreeStakingContract = await upgrades.deployProxy(
    MinerFreeStakingContract,
    [minerFreeStakingLaunchConfig],
    {
      initializer: "initialize",
    }
  );
  await minerFreeStakingContract.waitForDeployment();
  const minerFreeStakingAddress = await minerFreeStakingContract.getAddress();
  console.log("MinerFreeStakingContract deployed to:", minerFreeStakingAddress);
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: minerFreeStakingAddress,
    });
  } catch (error) {
    console.log(error);
  }
  console.log("--------------------\n");
  console.log("---------Miner claim add fee-----------");
  await minerStakingContract.setClaimFee(
    20000000000000n,
    CLAIM_FEE_RECIPIENT as string
  );
  console.log("---------HayaTokenPool Add Claimer-----------");
  await hayaTokenPool.write.addClaimer([minerStakingAddress]);
  console.log("minerStakingAddress added\n");
  await hayaTokenPool.write.addClaimer([minerFreeStakingAddress]);
  console.log("minerFreeStakingAddress added\n");
  console.log("------🎉🎉 FINISHED!!! 🎉🎉--------\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
