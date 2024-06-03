import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("HayaStakeContract", function () {
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  /**
   * Deploys a stake contract fixture for testing purposes.
   * @returns An object containing the deployed stake contract, token, and accounts.
   */
  async function deployStakeContractFixture() {
    const [account1, account2] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract("StandardTokenMock", [
      "haya",
      "h",
      18,
    ]);
    const stakeContract = await hre.viem.deployContract("HayaStakingContract", [
      token.address,
    ]);
    await token.write.mintWithAmount([parseEther("100000")], {
      account: account1.account,
    });
    await token.write.approve([stakeContract.address, parseEther("100000")], {
      account: account1.account,
    });
    await token.write.mintWithAmount([parseEther("10000")], {
      account: account2.account,
    });
    await token.write.approve([stakeContract.address, parseEther("100000")], {
      account: account2.account,
    });
    return {
      stakeContract,
      token,
      account1,
      account2,
    };
  }

  it("Should upgrade the level of a stake", async function () {
    const { stakeContract, account1 } = await loadFixture(
      deployStakeContractFixture
    );
    await stakeContract.write.upgradeLevel([1], {
      account: account1.account,
    });
    const stake = await stakeContract.read.stakes([account1.account.address]);
    expect(stake[2]).to.equal(1);
  });

  it("Should allow unstaking after lock period", async function () {
    const { token, stakeContract, account1 } = await loadFixture(
      deployStakeContractFixture
    );
    await stakeContract.write.upgradeLevel([1], {
      account: account1.account,
    });
    await time.increase(ONE_YEAR_IN_SECS);
    await stakeContract.write.unstake({
      account: account1.account,
    });
    const stake = await stakeContract.read.stakes([account1.account.address]);
    expect(stake[0]).to.equal(0n);
    expect(stake[1]).to.equal(0n);
    expect(stake[2]).to.equal(0);
    expect(await token.read.balanceOf([account1.account.address])).to.equal(
      parseEther("100000")
    );
  });

  it("Should fail if the unlocking time is not up", async function () {
    const { stakeContract, account1 } = await loadFixture(
      deployStakeContractFixture
    );
    await stakeContract.write.upgradeLevel([1], {
      account: account1.account,
    });
    await expect(
      stakeContract.write.unstake({ account: account1.account })
    ).to.be.rejectedWith("StakeContract: Stake is still locked");
  });

  it("Should fail if never stack", async function () {
    const { stakeContract, account1 } = await loadFixture(
      deployStakeContractFixture
    );
    await expect(
      stakeContract.write.unstake({ account: account1.account })
    ).to.be.rejectedWith("StakeContract: No stake found");
  });

  it("Should fail if newLevel not bigger than current", async function () {
    const { stakeContract, account1 } = await loadFixture(
      deployStakeContractFixture
    );
    await expect(
      stakeContract.write.upgradeLevel([0], {
        account: account1.account,
      })
    ).to.be.rejectedWith("StakeContract: Invalid level upgrade");
    await stakeContract.write.upgradeLevel([1], {
      account: account1.account,
    });
    await expect(
      stakeContract.write.upgradeLevel([1], {
        account: account1.account,
      })
    ).to.be.rejectedWith("StakeContract: Invalid level upgrade");
    await expect(
      stakeContract.write.upgradeLevel([4], {
        account: account1.account,
      })
    ).to.be.rejected;
  });

  it("Should correctly charge for upgrading", async function () {
    const { token, stakeContract, account1 } = await loadFixture(
      deployStakeContractFixture
    );
    await stakeContract.write.upgradeLevel([1], {
      account: account1.account,
    });
    const balance = await token.read.balanceOf([account1.account.address]);
    expect(balance).to.equal(parseEther("90000"));
    await stakeContract.write.upgradeLevel([2], {
      account: account1.account,
    });
    const newBalance = await token.read.balanceOf([account1.account.address]);
    expect(balance - newBalance).to.equal(parseEther("90000"));
  });

  it("Should refresh lock time", async function () {
    const { stakeContract, account1 } = await loadFixture(
      deployStakeContractFixture
    );
    await stakeContract.write.upgradeLevel([1], {
      account: account1.account,
    });
    await time.increase(ONE_YEAR_IN_SECS);
    await stakeContract.write.upgradeLevel([2], {
      account: account1.account,
    });
    await time.increase(ONE_YEAR_IN_SECS / 2);
    await expect(
      stakeContract.write.unstake({ account: account1.account })
    ).to.be.rejectedWith("StakeContract: Stake is still locked");
    await time.increase(ONE_YEAR_IN_SECS / 2);
    await expect(stakeContract.write.unstake({ account: account1.account })).to
      .be.fulfilled;
  });

  it("Should fail if the balance is insufficient", async function () {
    const { stakeContract, account2 } = await loadFixture(
      deployStakeContractFixture
    );
    await expect(
      stakeContract.write.upgradeLevel([3], {
        account: account2.account,
      })
    ).to.be.rejected;
  });
});
