import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, getAddress } from "viem";

describe("HayaTokenPool", function () {
  /**
   * Deploys a pool contract fixture for testing purposes.
   * @returns An object containing the deployed pool, hayaToken, owner, and otherAccount.
   */
  async function deployPoolContractFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();
    const hayaToken = await hre.viem.deployContract("StandardTokenMock", [
      "haya",
      "h",
      18,
    ]);
    await hayaToken.write.mintWithAmount([parseEther("100000")]);
    const pool = await hre.viem.deployContract("HayaTokenPool", [
      hayaToken.address,
      owner.account.address,
    ]);
    await hayaToken.write.approve([pool.address, parseEther("100000")]);
    return {
      pool,
      hayaToken,
      owner,
      otherAccount,
    };
  }

  it("should deposit Haya into the pool", async function () {
    const { pool, hayaToken, owner } = await loadFixture(
      deployPoolContractFixture
    );
    await pool.write.deposit([parseEther("100")]);
    const balance = await hayaToken.read.balanceOf([pool.address]);
    expect(balance).to.equal(parseEther("100"));
  });

  it("should claim emergency tokens from the pool", async function () {
    const { pool, hayaToken, owner } = await loadFixture(
      deployPoolContractFixture
    );
    await pool.write.deposit([parseEther("100")]);
    await pool.write.emergencyClaim([owner.account.address, parseEther("100")]);
    const balance = await hayaToken.read.balanceOf([owner.account.address]);
    expect(balance).to.equal(parseEther("100000"));
  });

  it("should allow claimer to claim tokens from the pool", async function () {
    const { pool, hayaToken, otherAccount } = await loadFixture(
      deployPoolContractFixture
    );
    await pool.write.deposit([parseEther("100")]);
    await pool.write.addClaimer([otherAccount.account.address]);
    await pool.write.claim([otherAccount.account.address, parseEther("50")], {
      account: otherAccount.account,
    });
    const balance = await hayaToken.read.balanceOf([
      otherAccount.account.address,
    ]);
    expect(balance).to.equal(parseEther("50"));
  });

  it("should not allow non-claimer to claim tokens from the pool", async function () {
    const { pool, hayaToken, otherAccount } = await loadFixture(
      deployPoolContractFixture
    );
    await pool.write.deposit([parseEther("100")]);
    await expect(
      pool.write.claim([otherAccount.account.address, parseEther("50")], {
        account: otherAccount.account,
      })
    ).to.be.rejectedWith("HayaTokenPool: caller is not a claimer");
  });

  it("should not allow claimer to claim more than their share", async function () {
    const { pool, hayaToken, otherAccount } = await loadFixture(
      deployPoolContractFixture
    );
    await pool.write.deposit([parseEther("100")]);
    await pool.write.addClaimer([otherAccount.account.address]);
    await expect(
      pool.write.claim([otherAccount.account.address, parseEther("101")], {
        account: otherAccount.account,
      })
    ).to.be.rejected;
  });

  it("should not allow adding duplicate claimers", async function () {
    const { pool, otherAccount } = await loadFixture(deployPoolContractFixture);
    await pool.write.addClaimer([otherAccount.account.address]);
    await expect(
      pool.write.addClaimer([otherAccount.account.address])
    ).to.be.rejectedWith("HayaTokenPool: claimer already exists");
  });

  it("should not allow removing non-existent claimers", async function () {
    const { pool, otherAccount } = await loadFixture(deployPoolContractFixture);
    await expect(
      pool.write.removeClaimer([otherAccount.account.address])
    ).to.be.rejectedWith("HayaTokenPool: claimer does not exist");
  });

  it("should emit an event when a claimer claims tokens from the pool", async function () {
    const { pool, hayaToken, otherAccount } = await loadFixture(
      deployPoolContractFixture
    );
    await pool.write.deposit([parseEther("100")]);
    await pool.write.addClaimer([otherAccount.account.address]);

    await pool.write.claim([otherAccount.account.address, parseEther("50")], {
      account: otherAccount.account,
    });

    // Check if the event was emitted
    const claimEvent = await pool.getEvents.Claimed();
    expect(claimEvent).to.exist;
    expect(claimEvent[0].args.claimer).to.equal(
      getAddress(otherAccount.account.address)
    );
    expect(claimEvent[0].args.recipient).to.equal(
      getAddress(otherAccount.account.address)
    );
    expect(claimEvent[0].args.amount).to.equal(parseEther("50"));
  });
});
