import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseUnits } from "viem";

describe("MinerFactory", function () {
  const ONE_WEEK_IN_SECS = 7 * 24 * 60 * 60;
  async function deployFatoryContractFixture() {
    const startTime = BigInt(await time.latest()) + BigInt(ONE_WEEK_IN_SECS);
    const endTime = startTime + BigInt(ONE_WEEK_IN_SECS);

    const [owner, beneficiaries, otherAccount, neweneficiaries] =
      await hre.viem.getWalletClients();
    const usdt = await hre.viem.deployContract("StandardTokenMock", [
      "USDT",
      "U",
      6,
    ]);
    await usdt.write.mintWithAmount([parseUnits("100000", 6)], {
      account: otherAccount.account,
    });

    const miner = await hre.viem.deployContract("Miner", [
      "",
      owner.account.address,
    ]);
    const factory = await hre.viem.deployContract("MinerFactory", [
      miner.address,
      usdt.address,
      owner.account.address,
      startTime,
      endTime,
      beneficiaries.account.address,
    ]);
    await miner.write.addFactory([factory.address]);
    await usdt.write.approve([factory.address, parseUnits("100000", 6)], {
      account: otherAccount.account,
    });
    return {
      factory,
      miner,
      usdt,
      owner,
      beneficiaries,
      otherAccount,
      neweneficiaries,
      startTime,
      endTime,
    };
  }

  it("should fail time not valid", async function () {
    const { factory, usdt, owner, endTime } = await loadFixture(
      deployFatoryContractFixture
    );
    await expect(factory.write.mintMiners([[0], [1n]])).to.be.rejectedWith(
      "MinerFactory: Invalid time"
    );
    await time.increaseTo(endTime);
    await expect(factory.write.mintMiners([[0], [1n]])).to.be.rejectedWith(
      "MinerFactory: Invalid time"
    );
  });

  it("should succeed when time is up", async function () {
    const { factory, usdt, otherAccount, startTime } = await loadFixture(
      deployFatoryContractFixture
    );
    await time.increaseTo(startTime);

    await expect(
      factory.write.mintMiners([[0], [1n]], { account: otherAccount.account })
    ).to.be.fulfilled;
  });

  it("should fail if not enough balance", async function () {
    const { factory, usdt, otherAccount, startTime } = await loadFixture(
      deployFatoryContractFixture
    );
    await time.increaseTo(startTime);
    await expect(
      factory.write.mintMiners([[0], [10001n]], {
        account: otherAccount.account,
      })
    ).to.be.rejectedWith("MinerFactory: Insufficient balance");
  });

  it("should verify if beneficiary receives the amount after mint", async function () {
    const { factory, usdt, beneficiaries, otherAccount, startTime } =
      await loadFixture(deployFatoryContractFixture);
    await time.increaseTo(startTime);
    const balanceBefore = await usdt.read.balanceOf([
      beneficiaries.account.address,
    ]);
    await factory.write.mintMiners([[3], [2n]], {
      account: otherAccount.account,
    });
    const balanceAfter = await usdt.read.balanceOf([
      beneficiaries.account.address,
    ]);
    expect(balanceAfter - balanceBefore).to.equal(10000n * 10n ** 6n * 2n);
    expect(await usdt.read.balanceOf([beneficiaries.account.address])).to.equal(
      10000n * 10n ** 6n * 2n
    );
  });

  it("should verify if mint event is emitted after purchase", async function () {
    const { factory, otherAccount, startTime } = await loadFixture(
      deployFatoryContractFixture
    );
    await time.increaseTo(startTime);
    await factory.write.mintMiners([[2], [10n]], {
      account: otherAccount.account,
    });
    const events = await factory.getEvents.MinerMinted();
    expect(events.length).to.equal(1);
    const mintEvent = events[0];
    expect(mintEvent.args.user).to.equal(
      getAddress(otherAccount.account.address)
    );
    expect(mintEvent.args.minerType).to.equal(2);
    expect(mintEvent.args.quantity).to.equal(10n);
  });

  it("should verify if beneficiary receives the amount after mint", async function () {
    const {
      factory,
      usdt,
      beneficiaries,
      neweneficiaries,
      otherAccount,
      startTime,
    } = await loadFixture(deployFatoryContractFixture);
    await time.increaseTo(startTime);
    const balanceBefore = await usdt.read.balanceOf([
      beneficiaries.account.address,
    ]);
    await factory.write.mintMiners([[0], [1n]], {
      account: otherAccount.account,
    });
    const balanceAfter = await usdt.read.balanceOf([
      beneficiaries.account.address,
    ]);
    expect(balanceAfter - balanceBefore).to.equal(10n * 10n ** 6n);
    expect(await usdt.read.balanceOf([beneficiaries.account.address])).to.equal(
      10n * 10n ** 6n
    );

    // Modify beneficiary
    await factory.write.setBeneficiaries([neweneficiaries.account.address]);

    // Verify minted tokens go to new beneficiary
    const balanceBeforeNew = await usdt.read.balanceOf([
      neweneficiaries.account.address,
    ]);
    await factory.write.mintMiners([[0], [1n]], {
      account: otherAccount.account,
    });
    const balanceAfterNew = await usdt.read.balanceOf([
      neweneficiaries.account.address,
    ]);
    expect(balanceAfterNew - balanceBeforeNew).to.equal(10n * 10n ** 6n);
    expect(
      await usdt.read.balanceOf([neweneficiaries.account.address])
    ).to.equal(10n * 10n ** 6n);
  });

  it("should fail if minting a non-existent type", async function () {
    const { factory, otherAccount, startTime } = await loadFixture(
      deployFatoryContractFixture
    );
    await time.increaseTo(startTime);
    await expect(
      factory.write.mintMiners([[4], [1n]], { account: otherAccount.account })
    ).to.be.rejected;
  });
});
