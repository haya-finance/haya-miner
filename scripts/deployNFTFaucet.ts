import hre from "hardhat";
import NFTFaucet from "../ignition/modules/NFTFaucet";
require("dotenv").config();
const { run } = require("hardhat");
async function main() {
  const [owner] = await hre.viem.getWalletClients();
  const CONTRACTS_OWNER = owner.account.address;
  const FREE_MINER_CONTRACT = "";
  const TOKEN_ID = 0n;
  const { nftFaucet } = await hre.ignition.deploy(NFTFaucet, {
    parameters: {
      NFTFaucet: {
        owner: CONTRACTS_OWNER,
      },
    },
  });
  console.log("NFTFaucet deployed to:", nftFaucet.address);

  await nftFaucet.write.addComponent([
    { nftAddress: FREE_MINER_CONTRACT as `0x{string}`, tokenId: TOKEN_ID },
  ]);
  try {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    await run("verify:verify", {
      address: nftFaucet.address,
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
