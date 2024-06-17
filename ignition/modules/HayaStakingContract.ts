import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TOKEN: string = "";

const HayaStakingContract = buildModule("HayaStakingContract", (m) => {
  const token = m.getParameter("tokenForStaking", TOKEN);
  const hayaStakingContract = m.contract("HayaStakingContract", [token]);
  return { hayaStakingContract };
});

export default HayaStakingContract;
