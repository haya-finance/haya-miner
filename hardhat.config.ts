import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();
const config: HardhatUserConfig = {
  defender: {
    apiKey: process.env.DEFENDER_KEY as string,
    apiSecret: process.env.DEFENDER_SECRET as string,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    sepolia: {
      accounts: process.env.ARBITRUM_SEPOLIA_DEPLOY_PRIVATE_KEY
        ? [`0x${process.env.ARBITRUM_SEPOLIA_DEPLOY_PRIVATE_KEY}`]
        : undefined,
      url: "https://arbitrum-sepolia.infura.io/v3/" + process.env.INFURA_TOKEN,
    },
    production: {
      url: "https://arbitrum-mainnet.infura.io/v3/" + process.env.INFURA_TOKEN,
    },
  },
  etherscan: {
    apiKey: {
      // @ts-ignore
      sepolia: process.env.ARBITRUM_ETHERSCAN_TOKEN,
      // @ts-ignore
      production: process.env.ARBITRUM_ETHERSCAN_TOKEN,
    },
    customChains: [
      {
        network: "sepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "production",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
    ],
  },
};

export default config;
