import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const OWNER: string = "";
const URI: string = "";

const Miner = buildModule("Miner", (m) => {
  const owner = m.getParameter("owner", OWNER);
  const uri = m.getParameter("uri", URI);
  const miner = m.contract("Miner", [uri, owner]);
  return { miner };
});

export default Miner;
