import hre from "hardhat";

const { ethers, run, defender } = require("hardhat");
async function main() {
  interface Dictionary {
    [key: string]: any;
  }
  const tokensMap: Dictionary = {
    USDT: ["USDT", "USDT", 6],
    HAYA: ["HAYA", "HAYA", 18],
  };
  console.log("--------------------");
  const keys = Object.keys(tokensMap);
  const StandardTokenMock = await ethers.getContractFactory(
    "StandardTokenMock"
  );
  for (let key of keys) {
    const token = await defender.deployContract(
      StandardTokenMock,
      tokensMap[key]
    );
    console.log(key, "wait deployed...");
    await token.waitForDeployment();
    console.log(key, `deployed to ${await token.getAddress()}`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 20000));
      await run("verify:verify", {
        address: await token.getAddress(),
        constructorArguments: tokensMap[key],
      });
    } catch (error) {
      console.log(error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
