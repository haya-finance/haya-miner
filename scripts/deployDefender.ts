import hre from "hardhat";

const { ethers, run, defender } = require("hardhat");

require("dotenv").config();

async function main() {
  const {
    USDT_CONTRACT_ADDRESS,
    HAYA_CONTRACT_ADDRESS,
    CONTRACTS_OWNER,
    MINER_META_URI,
    PUBLIC_SALE_START_TIME,
    SALE_BENIFICIARIES,
    MINER_STAKING_START_TIME,
    MINER_STAKING_OUTPUT_FACTOR,
    WITHDRAW_ORACLE_ADDRESS,
  } = process.env;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
