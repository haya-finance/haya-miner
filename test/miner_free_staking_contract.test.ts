import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, parseUnits, maxUint256 } from "viem";

const { ethers, upgrades } = require("hardhat");

describe("MinerFreeStakingContract", function () {
  const ONE_WEEK_IN_SECS = 7 * 24 * 60 * 60;
  const FREE_HASHRATE = 10000n;
  async function deployMinerFreeStakingContractFixture() {
    const [owner, account1, account2] = await hre.viem.getWalletClients();

    const minerContract = await hre.viem.deployContract("StandardNFTMock", [
      "",
      owner.account.address,
    ]);
    const hayaContract = await hre.viem.deployContract("StandardTokenMock", [
      "haya",
      "h",
      18,
    ]);
    await hayaContract.write.mintWithAmount([parseEther("30000000000000000")]);

    await minerContract.write.mint([account1.account.address, 0n, 100n]);
    await minerContract.write.mint([account2.account.address, 0n, 100n]);
    await minerContract.write.mint([account1.account.address, 1n, 100n]);
    await minerContract.write.mint([account2.account.address, 1n, 100n]);
    const poolContract = await hre.viem.deployContract("HayaTokenPool", [
      hayaContract.address,
      owner.account.address,
    ]);
    await hayaContract.write.approve([poolContract.address, maxUint256]);
    await poolContract.write.deposit([parseEther("10000000000000000")]);

    const miningOutputFactor = 1;
    const minerStakingStartTime =
      BigInt(await time.latest()) + BigInt(ONE_WEEK_IN_SECS);
    const minerStakingEndTime =
      minerStakingStartTime + BigInt(ONE_WEEK_IN_SECS) * 3n;
    const minerStakingLaunchConfig = [
      miningOutputFactor,
      minerContract.address,
      poolContract.address,
      owner.account.address,
      minerStakingStartTime,
      minerStakingEndTime,
    ];
    const MinerStakingContract = await ethers.getContractFactory(
      "MinerStakingContract"
    );
    const minerStakingContract = await upgrades.deployProxy(
      MinerStakingContract,
      [minerStakingLaunchConfig]
    );
    await minerStakingContract.waitForDeployment();

    const minerFreeStakingLaunchConfig = [
      poolContract.address,
      await minerStakingContract.getAddress(),
      owner.account.address,
    ];
    const MinerFreeStakingContract = await ethers.getContractFactory(
      "MinerFreeStakingContract"
    );
    const minerFreeStakingContract = await upgrades.deployProxy(
      MinerFreeStakingContract,
      [minerFreeStakingLaunchConfig]
    );
    await minerFreeStakingContract.waitForDeployment();

    await minerContract.write.setApprovalForAll(
      [await minerFreeStakingContract.getAddress(), true],
      { account: owner.account }
    );
    await minerContract.write.setApprovalForAll(
      [await minerFreeStakingContract.getAddress(), true],
      { account: account1.account }
    );
    await minerContract.write.setApprovalForAll(
      [await minerFreeStakingContract.getAddress(), true],
      { account: account2.account }
    );
    await poolContract.write.addClaimer([
      await minerFreeStakingContract.getAddress(),
    ]);
    await minerFreeStakingContract.setSupportMinerType(
      minerContract.address,
      0n,
      true
    );
    return {
      owner,
      hayaContract,
      minerContract,
      poolContract,
      minerStakingContract,
      minerFreeStakingContract,
      account1,
      account2,
      minerStakingStartTime,
      minerStakingEndTime,
      FREE_HASHRATE,
    };
  }

  it("check init data", async function () {
    const { minerContract, poolContract, hayaContract, account1 } =
      await loadFixture(deployMinerFreeStakingContractFixture);
    expect(await hayaContract.read.balanceOf([poolContract.address])).to.equal(
      parseEther("10000000000000000")
    );
    expect(
      await minerContract.read.balanceOf([account1.account.address, 0n])
    ).to.equal(100n);
  });

  it("should fail to mine not staking period", async function () {
    const {
      minerFreeStakingContract,
      minerContract,
      account1,
      minerStakingEndTime,
    } = await loadFixture(deployMinerFreeStakingContractFixture);
    await expect(
      minerFreeStakingContract
        .connect(account1)
        .mining(minerContract.address, 0n)
    ).to.be.rejectedWith("MinerFreeStakingContract: Invalid time");
    await time.increaseTo(minerStakingEndTime);
    await expect(
      minerFreeStakingContract
        .connect(account1)
        .mining(minerContract.address, 0n)
    ).to.be.rejectedWith("MinerFreeStakingContract: Invalid time");
  });

  it("should failed mine not support token", async function () {
    const {
      minerFreeStakingContract,
      minerContract,
      account1,
      minerStakingStartTime,
    } = await loadFixture(deployMinerFreeStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await expect(
      minerFreeStakingContract
        .connect(account1)
        .mining(minerContract.address, 1n)
    ).to.be.rejectedWith("MinerFreeStakingContract: Not supported");
  });

  it("should successfully mine during staking period", async function () {
    const {
      minerFreeStakingContract,
      minerContract,
      account1,
      minerStakingStartTime,
    } = await loadFixture(deployMinerFreeStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await expect(
      minerFreeStakingContract
        .connect(account1)
        .mining(minerContract.address, 0n)
    ).to.be.fulfilled;
  });

  it("should calculate correct reward amount after 7 days", async function () {
    const {
      hayaContract,
      minerFreeStakingContract,
      minerStakingContract,
      minerContract,
      account1,
      minerStakingStartTime,
      FREE_HASHRATE,
    } = await loadFixture(deployMinerFreeStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await minerFreeStakingContract
      .connect(account1)
      .mining(minerContract.address, 0n);
    await expect(
      minerFreeStakingContract
        .connect(account1)
        .mining(minerContract.address, 0n)
    ).to.be.rejectedWith("MinerFreeStakingContract: Already mining");
    const miningStatus = await minerFreeStakingContract.getMiningStatus(
      account1.account.address
    );
    await expect(
      minerFreeStakingContract.connect(account1).claim(miningStatus.endTime)
    ).to.be.rejectedWith("MinerFreeStakingContract: Invalid target timestamp");

    await time.increase(ONE_WEEK_IN_SECS * 2);
    const rewardAmount = await minerStakingContract.caculateRewards(
      FREE_HASHRATE,
      miningStatus.recentAdjustIndex,
      miningStatus.latestClaimedTime,
      miningStatus.endTime
    );
    expect(rewardAmount[1]).to.equal(6048000000n);
    const balanceBefore = await hayaContract.read.balanceOf([
      account1.account.address,
    ]);
    await minerFreeStakingContract
      .connect(account1)
      .claim(miningStatus.endTime);
    const balanceAfter = await hayaContract.read.balanceOf([
      account1.account.address,
    ]);
    expect(balanceAfter - balanceBefore).to.equal(6048000000n);
    await expect(
      minerFreeStakingContract.connect(account1).claim(miningStatus.endTime)
    ).to.be.rejectedWith("MinerFreeStakingContract: Invalid target timestamp");

    const miningStatusAfter = await minerFreeStakingContract.getMiningStatus(
      account1.account.address
    );
    expect(miningStatusAfter.rewardsClaimed).to.equal(6048000000n);
    expect(miningStatusAfter.latestClaimedTime).to.equal(miningStatus.endTime);
    await expect(
      minerFreeStakingContract
        .connect(account1)
        .mining(minerContract.address, 0n)
    ).to.be.rejectedWith("MinerFreeStakingContract: Already mining");
  });
});
