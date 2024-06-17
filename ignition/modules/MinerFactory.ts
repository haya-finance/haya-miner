import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const OWNER: string = "";
const MINERCONTRACT: string = "";
const TOKENFORMINT: string = ""; // usdt
const STARTTIME = 0;
const ENDTIME = 0;
const BENEFICAIARIES: string = ""; // beneficiaries

const MinerFactory = buildModule("MinerFactory", (m) => {
  const owner = m.getParameter("owner", OWNER);
  const minerContract = m.getParameter("miner", MINERCONTRACT);
  const tokenForMint = m.getParameter("tokenForMint", TOKENFORMINT);
  const startTime = m.getParameter("startTime", STARTTIME);
  const endTime = m.getParameter("endTime", ENDTIME);
  const beneficiaries = m.getParameter("beneficiaries", BENEFICAIARIES);

  const factory = m.contract("MinerFactory", [
    minerContract,
    tokenForMint,
    owner,
    startTime,
    endTime,
    beneficiaries,
  ]);
  return { factory };
});

export default MinerFactory;
