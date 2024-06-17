import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TOKEN: string = "";
const OWNER: string = "";
const HayaTokenPool = buildModule("HayaTokenPool", (m) => {
  const token = m.getParameter("tokenForReward", TOKEN);
  const owner = m.getParameter("owner", OWNER);
  const hayaTokenPool = m.contract("HayaTokenPool", [token, owner]);
  return { hayaTokenPool };
});

export default HayaTokenPool;
