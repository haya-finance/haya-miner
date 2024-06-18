import hre from "hardhat";
import TokenFaucet from "../ignition/modules/TokenFaucet";
require("dotenv").config();
const { run } = require("hardhat");
async function main() {
  const [owner] = await hre.viem.getWalletClients();
  const CONTRACTS_OWNER = owner.account.address;
  const { USDT_CONTRACT_ADDRESS, HAYA_CONTRACT_ADDRESS } = process.env ?? {};
  const { tokenFaucet } = await hre.ignition.deploy(TokenFaucet, {
    parameters: {
      TokenFaucet: {
        owner: CONTRACTS_OWNER,
      },
    },
  });
  console.log("TokenFaucet deployed to:", tokenFaucet.address);

  await tokenFaucet.write.addComponents([
    [
      USDT_CONTRACT_ADDRESS as `0x{string}`,
      HAYA_CONTRACT_ADDRESS as `0x{string}`,
    ],
  ]);
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: tokenFaucet.address,
      constructorArguments: [CONTRACTS_OWNER],
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
