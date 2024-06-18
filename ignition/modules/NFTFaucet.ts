import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const OWNER: string = "";

const NFTFaucet = buildModule("NFTFaucet", (m) => {
  const owner = m.getParameter("owner", OWNER);
  const nftFaucet = m.contract("NFTFaucet", [owner]);
  return { nftFaucet };
});

export default NFTFaucet;
