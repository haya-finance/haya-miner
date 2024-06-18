import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const OWNER: string = "";

const TokenFaucet = buildModule("TokenFaucet", (m) => {
  const owner = m.getParameter("owner", OWNER);
  const tokenFaucet = m.contract("TokenFaucet", [owner]);
  return { tokenFaucet };
});

export default TokenFaucet;
