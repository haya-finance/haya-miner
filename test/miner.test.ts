import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

/**
 * Represents the Miner contract test suite.
 */
describe("Miner", function () {
  /**
   * Deploys the Miner contract fixture.
   * @returns An object containing the deployed miner contract, owner, and factory.
   */
  async function deployMinerContractFixture() {
    const [owner, factory] = await hre.viem.getWalletClients();
    const miner = await hre.viem.deployContract("Miner", [
      "",
      owner.account.address,
    ]);
    return {
      miner,
      owner,
      factory,
    };
  }

  it("should allow the owner to set the factory", async function () {
    const { owner, miner, factory } = await loadFixture(
      deployMinerContractFixture
    );

    // Set the factory
    await miner.write.addFactory([factory.account.address]);

    // Verify the factory
    const factoryAddress = await miner.read.factories([0n]);
    expect(factoryAddress).to.equal(getAddress(factory.account.address));
  });

  it("should set the factory and mint tokens", async function () {
    const { owner, miner, factory } = await loadFixture(
      deployMinerContractFixture
    );

    // Set the factory
    await miner.write.addFactory([factory.account.address]);

    // Mint tokens
    await miner.write.mint([owner.account.address, 0n, 1n, "0x"], {
      account: factory.account,
    });

    // Verify the balance
    const balance = await miner.read.balanceOf([owner.account.address, 0n]);
    expect(balance).to.equal(1n);
  });

  it("should not allow non-owner to set the factory", async function () {
    const { owner, miner, factory } = await loadFixture(
      deployMinerContractFixture
    );
    await expect(
      miner.write.addFactory([factory.account.address], {
        account: factory.account,
      })
    ).to.be.rejected;
  });

  it("should not allow non-fatory to mint tokens", async function () {
    const { owner, miner, factory } = await loadFixture(
      deployMinerContractFixture
    );
    // Set the factory
    await miner.write.addFactory([factory.account.address]);
    // Mint tokens as non-owner
    await expect(
      miner.write.mint([owner.account.address, 0n, 1n, "0x"], {
        account: owner.account,
      })
    ).to.be.rejectedWith("Miner: caller is not a factory");
  });

  it("should allow the owner to transfer ownership", async function () {
    const { owner, miner, factory } = await loadFixture(
      deployMinerContractFixture
    );
    // Set the factory
    await miner.write.addFactory([factory.account.address]);
    // Transfer ownership
    await miner.write.transferOwnership([factory.account.address]);
    await miner.write.acceptOwnership({ account: factory.account });
    // Verify the new owner
    const newOwner = await miner.read.owner();
    expect(newOwner).to.equal(getAddress(factory.account.address));
  });
});
