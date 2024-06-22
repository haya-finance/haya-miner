import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, parseUnits, maxUint256 } from "viem";

const { ethers, upgrades } = require("hardhat");

describe("MinerStakingContract", function () {
  const ONE_WEEK_IN_SECS = 7 * 24 * 60 * 60;
  const HALF_YEAR_IN_SECS = 180 * 24 * 60 * 60;
  async function deployMinerStakingContractFixture() {
    const [owner, account1, account2] = await hre.viem.getWalletClients();

    const minerContract = await hre.viem.deployContract("Miner", [
      "",
      owner.account.address,
    ]);

    const hayaContract = await hre.viem.deployContract("StandardTokenMock", [
      "haya",
      "h",
      18,
    ]);
    const usdtContract = await hre.viem.deployContract("StandardTokenMock", [
      "USDT",
      "U",
      6,
    ]);
    await usdtContract.write.mintWithAmount([
      parseUnits("10000000000000000", 6),
    ]);
    await hayaContract.write.mintWithAmount([parseEther("30000000000000000")]);

    const factoryContract = await hre.viem.deployContract("MinerFactory", [
      minerContract.address,
      usdtContract.address,
      owner.account.address,
      0n,
      0n,
      owner.account.address,
    ]);
    await minerContract.write.addFactory([factoryContract.address]);
    await usdtContract.write.approve([factoryContract.address, maxUint256]);
    await hayaContract.write.approve([factoryContract.address, maxUint256]);
    await factoryContract.write.mintMiners([[0], [400n]]);
    await factoryContract.write.mintMiners([[1], [400n]]);
    await factoryContract.write.mintMiners([[2], [400n]]);
    await factoryContract.write.mintMiners([[3], [400n]]);
    await minerContract.write.safeBatchTransferFrom([
      owner.account.address,
      account1.account.address,
      [0n, 1n, 2n, 3n],
      [100n, 100n, 100n, 100n],
      "0x",
    ]);
    await minerContract.write.safeBatchTransferFrom([
      owner.account.address,
      account2.account.address,
      [0n, 1n, 2n, 3n],
      [100n, 100n, 100n, 100n],
      "0x",
    ]);
    const poolContract = await hre.viem.deployContract("HayaTokenPool", [
      hayaContract.address,
      owner.account.address,
    ]);
    await hayaContract.write.approve([poolContract.address, maxUint256]);
    await poolContract.write.deposit([parseEther("10000000000000000")]);

    const miningOutputFactor = 803571429;
    const minerStakingStartTime =
      BigInt(await time.latest()) + BigInt(ONE_WEEK_IN_SECS);
    const minerStakingEndTime =
      minerStakingStartTime + BigInt(HALF_YEAR_IN_SECS) * 3n;
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
    const hashRate0 = await minerStakingContract.hashRates(0);
    const hashRate1 = await minerStakingContract.hashRates(1);
    const hashRate2 = await minerStakingContract.hashRates(2);
    const hashRate3 = await minerStakingContract.hashRates(3);
    const HASH_RATES = [hashRate0, hashRate1, hashRate2, hashRate3];
    await minerContract.write.setApprovalForAll(
      [await minerStakingContract.getAddress(), true],
      { account: owner.account }
    );
    await minerContract.write.setApprovalForAll(
      [await minerStakingContract.getAddress(), true],
      { account: account1.account }
    );
    await minerContract.write.setApprovalForAll(
      [await minerStakingContract.getAddress(), true],
      { account: account2.account }
    );
    await poolContract.write.addClaimer([
      await minerStakingContract.getAddress(),
    ]);
    return {
      owner,
      hayaContract,
      minerContract,
      usdtContract,
      factoryContract,
      poolContract,
      minerStakingContract,
      account1,
      account2,
      minerStakingStartTime,
      minerStakingEndTime,
      HASH_RATES,
    };
  }

  it("check init data", async function () {
    const { minerContract, poolContract, hayaContract, account1 } =
      await loadFixture(deployMinerStakingContractFixture);
    expect(await hayaContract.read.balanceOf([poolContract.address])).to.equal(
      parseEther("10000000000000000")
    );
    expect(
      await minerContract.read.balanceOf([account1.account.address, 0n])
    ).to.equal(100n);
  });

  it("should fail to mine not staking period", async function () {
    const { minerStakingContract, account1, minerStakingEndTime } =
      await loadFixture(deployMinerStakingContractFixture);
    await expect(
      minerStakingContract.connect(account1).batchMining([0n], [100n])
    ).to.be.rejectedWith("MinerStakingContract: Invalid time");
    await time.increaseTo(minerStakingEndTime);
    await expect(
      minerStakingContract.connect(account1).batchMining([0n], [100n])
    ).to.be.rejectedWith("MinerStakingContract: Invalid time");
  });

  it("should fail to set OutputFactor if not an owner", async function () {
    const { minerStakingContract, account1, owner, minerStakingStartTime } =
      await loadFixture(deployMinerStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    const newOutputFactor = 2;
    const newTime = BigInt(await time.latest()) + BigInt(7 * 24 * 60 * 60);
    await expect(
      minerStakingContract
        .connect(account1)
        .addFutureOutputFactor(newTime, newOutputFactor)
    ).to.be.rejected;

    await expect(
      minerStakingContract.addFutureOutputFactor(newTime, newOutputFactor)
    ).to.be.fulfilled;
  });

  it("should add future OutputFactor and drop", async function () {
    const { minerStakingContract, minerStakingStartTime } = await loadFixture(
      deployMinerStakingContractFixture
    );
    await time.increaseTo(minerStakingStartTime);
    const newOutputFactor = 2n;
    const newTime = BigInt(await time.latest()) + BigInt(7 * 24 * 60 * 60);
    await expect(
      minerStakingContract.addFutureOutputFactor(newTime, newOutputFactor)
    ).to.be.fulfilled;
    const result = await minerStakingContract.getLatestAdjustRecord();
    expect(result[1]).to.equal(newOutputFactor);
    expect(result[0]).to.equal(newTime);
    await expect(minerStakingContract.dropFutureOutputFactor()).to.be.fulfilled;
    await time.increaseTo(newTime);
    await expect(
      minerStakingContract.dropFutureOutputFactor()
    ).to.be.rejectedWith(
      "MinerStakingContract: The future output factor does not exist"
    );
  });

  it("should add real-time OutputFactor", async function () {
    const { minerStakingContract, minerStakingStartTime } = await loadFixture(
      deployMinerStakingContractFixture
    );
    await time.increaseTo(minerStakingStartTime);
    await minerStakingContract.addRealTimeOutputFactor(2n);
    const result = await minerStakingContract.getAdjustRecords(0, 1);
    expect(result[1][1]).to.equal(2n);
  });

  it("should fail to add duplicate OutputFactor", async function () {
    const { minerStakingContract, minerStakingStartTime } = await loadFixture(
      deployMinerStakingContractFixture
    );
    await time.increaseTo(minerStakingStartTime);
    const newOutputFactor = 2n;
    await minerStakingContract.addRealTimeOutputFactor(newOutputFactor);
    await expect(
      minerStakingContract.addRealTimeOutputFactor(newOutputFactor)
    ).to.be.rejectedWith("MinerStakingContract: The output factor is the same");
  });
  it("should return the length of occurred difficulties", async function () {
    const { minerStakingContract } = await loadFixture(
      deployMinerStakingContractFixture
    );
    expect(
      await minerStakingContract.getOccurredOutputFactorsLength()
    ).to.be.equal(1n);
    await minerStakingContract.addRealTimeOutputFactor(2n);
    expect(
      await minerStakingContract.getOccurredOutputFactorsLength()
    ).to.be.equal(2n);
    const newTime = BigInt(await time.latest()) + BigInt(7 * 24 * 60 * 60);
    await minerStakingContract.addFutureOutputFactor(newTime, 1n);
    expect(
      await minerStakingContract.getOccurredOutputFactorsLength()
    ).to.be.equal(2n);
  });

  it("should successfully mine during staking period", async function () {
    const { minerStakingContract, account1, minerStakingStartTime } =
      await loadFixture(deployMinerStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await expect(
      minerStakingContract.connect(account1).batchMining([0n], [100n])
    ).to.be.fulfilled;
  });

  it("should successfully mint and verify miner status", async function () {
    const { minerStakingContract, account1, minerStakingStartTime } =
      await loadFixture(deployMinerStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await minerStakingContract.connect(account1).batchMining([1n], [10n]);
    const result = await minerStakingContract.getMiningStatus(
      account1.account.address,
      0,
      9
    );
    expect(result[0][0]).to.equal(1n);
    expect(result[0][2] - result[0][1]).to.equal(BigInt(HALF_YEAR_IN_SECS));
    expect(result[0][4]).to.equal(result[0][1]);
    expect(result[0][5]).to.equal(0n);
    expect(result[0][3]).to.equal(0n);
    expect(result[0][1]).to.equal(result[9][1]);
  });

  it("should fail to claim rewards after staking period ends", async function () {
    const {
      minerStakingContract,
      minerStakingStartTime,
      account1,
      minerStakingEndTime,
    } = await loadFixture(deployMinerStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await minerStakingContract.connect(account1).batchMining([1n], [10n]);
    await time.increaseTo(minerStakingEndTime + 10n);
    await expect(
      minerStakingContract
        .connect(account1)
        .claim([0n], [BigInt(await time.latest()) + 10n])
    ).to.be.rejectedWith("MinerStakingContract: Invalid target timestamp");
  });

  it("should claim rewards correct 7 days and outputs 803571429", async function () {
    const {
      minerStakingContract,
      account1,
      hayaContract,
      minerStakingStartTime,
    } = await loadFixture(deployMinerStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await minerStakingContract.connect(account1).batchMining([0n], [1n]);
    const hayaBalanceBefore = await hayaContract.read.balanceOf(
      [account1.account.address],
      { account: account1.account }
    );
    const status = await minerStakingContract.getMiningStatus(
      account1.account.address,
      0,
      0
    );
    await time.increase(ONE_WEEK_IN_SECS * 2);
    await minerStakingContract
      .connect(account1)
      .claim([0n], [status[0][1] + BigInt(ONE_WEEK_IN_SECS)]);
    const hayaBalanceAfter = await hayaContract.read.balanceOf(
      [account1.account.address],
      { account: account1.account }
    );
    expect(hayaBalanceAfter - hayaBalanceBefore).to.equal(4860000002592000000n);
  });

  it("should fail to claim and mining when paused", async function () {
    const { minerStakingContract, account1, minerStakingStartTime } =
      await loadFixture(deployMinerStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await minerStakingContract.connect(account1).batchMining([1n], [10n]);
    await minerStakingContract.pause();
    await expect(
      minerStakingContract.connect(account1).batchMining([1n], [10n])
    ).to.be.rejected;
    await expect(minerStakingContract.connect(account1).claim([1n])).to.be
      .rejected;
    await minerStakingContract.unpause();
    await expect(
      minerStakingContract.connect(account1).batchMining([1n], [10n])
    ).to.be.fulfilled;
    await expect(
      minerStakingContract
        .connect(account1)
        .claim([1n], [BigInt(await time.latest())])
    ).to.be.fulfilled;
  });

  it("should fail to claim if not a miner", async function () {
    const { minerStakingContract, account1, minerStakingStartTime } =
      await loadFixture(deployMinerStakingContractFixture);
    await time.increaseTo(minerStakingStartTime);
    await expect(
      minerStakingContract
        .connect(account1)
        .claim([0n], [BigInt(await time.latest())])
    ).to.be.rejected;
  });

  it("should correctly claim rewards and update miner status", async function () {
    const {
      HASH_RATES,
      minerStakingContract,
      account1,
      hayaContract,
      minerStakingStartTime,
      minerStakingEndTime,
    } = await loadFixture(deployMinerStakingContractFixture);
    const minerType = 1n;
    await time.increaseTo(minerStakingStartTime);
    await minerStakingContract.connect(account1).batchMining([minerType], [2n]);
    await time.increaseTo(minerStakingEndTime);
    const statusBefore = await minerStakingContract.getMiningStatus(
      account1.account.address,
      0,
      0
    );
    const startTimeBefore = statusBefore[0][1];
    const recentAdjustIndexBefore = statusBefore[0][3];
    const latestClaimedTimeBefore = statusBefore[0][4];
    const rewardsClaimedBefore = statusBefore[0][5];

    const latestAdjustRecord =
      await minerStakingContract.getLatestAdjustRecord();
    const OutputFactor = latestAdjustRecord[1];

    const claimDuration = 600n; // 10 minutes
    const targetTime = startTimeBefore + claimDuration;

    const estimateRewards = await minerStakingContract.rewardByHashRate(
      HASH_RATES[Number(minerType)],
      OutputFactor,
      claimDuration
    );

    const realEstimateRewards = await minerStakingContract.getUnclaimedRewards(
      account1.account.address,
      0,
      0,
      targetTime
    );
    expect(realEstimateRewards[0]).to.equal(estimateRewards);
    const hayaBalanceBefore = await hayaContract.read.balanceOf([
      account1.account.address,
    ]);
    await minerStakingContract.connect(account1).claim([0], [targetTime]);

    const hayaBalanceAfter = await hayaContract.read.balanceOf([
      account1.account.address,
    ]);
    expect(hayaBalanceAfter - hayaBalanceBefore).to.equal(estimateRewards);
    const result = await minerStakingContract.getMiningStatus(
      account1.account.address,
      0,
      1
    );
    const claimRewards = result[0][5];
    expect(claimRewards).to.equal(estimateRewards);

    const statusAfter = await minerStakingContract.getMiningStatus(
      account1.account.address,
      0,
      1
    );
    const startTimeAfter = statusAfter[0][1];
    const recentAdjustIndexAfter = statusAfter[0][3];
    const latestClaimedTimeAfter = statusAfter[0][4];
    const rewardsClaimedAfter = statusAfter[0][5];

    expect(startTimeAfter).to.equal(startTimeBefore);
    expect(recentAdjustIndexAfter).to.equal(recentAdjustIndexBefore);

    expect(latestClaimedTimeAfter).to.equal(targetTime);
    expect(rewardsClaimedBefore).to.equal(0n);
    expect(rewardsClaimedAfter).to.equal(estimateRewards);

    expect(statusAfter[1][4]).to.be.equal(latestClaimedTimeBefore);
    expect(statusAfter[1][5]).to.be.equal(0n);
  });

  it("should correctly claim rewards multiple times during staking period", async function () {
    const {
      HASH_RATES,
      minerStakingContract,
      account1,
      hayaContract,
      minerStakingStartTime,
      minerStakingEndTime,
    } = await loadFixture(deployMinerStakingContractFixture);
    const minerType = 3n;

    await time.increaseTo(minerStakingStartTime);

    await minerStakingContract.addFutureOutputFactor(
      minerStakingStartTime + BigInt(ONE_WEEK_IN_SECS),
      2n
    );
    await time.increaseTo(
      minerStakingStartTime +
        BigInt(ONE_WEEK_IN_SECS) +
        BigInt(ONE_WEEK_IN_SECS / 2)
    );
    await minerStakingContract.connect(account1).batchMining([minerType], [6n]);

    const statusBefore = await minerStakingContract.getMiningStatus(
      account1.account.address,
      0,
      0
    );

    await minerStakingContract.addFutureOutputFactor(
      minerStakingStartTime + BigInt(ONE_WEEK_IN_SECS) * 2n,
      3n
    );

    await time.increaseTo(
      minerStakingStartTime +
        BigInt(ONE_WEEK_IN_SECS) * 2n +
        BigInt(ONE_WEEK_IN_SECS / 2)
    );

    await minerStakingContract.addFutureOutputFactor(
      minerStakingStartTime + BigInt(ONE_WEEK_IN_SECS) * 3n,
      4n
    );

    await time.increaseTo(statusBefore[0][2] + 100n);
    const OutputFactorLength =
      await minerStakingContract.getOccurredOutputFactorsLength();
    const difficulties = await minerStakingContract.getAdjustRecords(
      0n,
      OutputFactorLength - 1n
    );

    const balanceBefore = await hayaContract.read.balanceOf([
      account1.account.address,
    ]);
    const hashrate = HASH_RATES[Number(minerType)];

    const firstTargetTime =
      minerStakingStartTime +
      BigInt(ONE_WEEK_IN_SECS) * 2n +
      BigInt(ONE_WEEK_IN_SECS / 2);
    const _stepOne = await minerStakingContract.rewardByHashRate(
      hashrate,
      2n,
      difficulties[2][0] - statusBefore[0][4]
    );

    const _stepTwo = await minerStakingContract.rewardByHashRate(
      hashrate,
      3n,
      firstTargetTime - difficulties[2][0]
    );
    const _stepThree = await minerStakingContract.rewardByHashRate(
      hashrate,
      3n,
      difficulties[3][0] - firstTargetTime
    );
    const _stepFour = await minerStakingContract.rewardByHashRate(
      hashrate,
      4n,
      statusBefore[0][2] - difficulties[3][0]
    );

    const contractFirstCaculate =
      await minerStakingContract.getUnclaimedRewards(
        account1.account.address,
        0,
        0,
        firstTargetTime
      );

    expect(contractFirstCaculate[0]).to.equal(_stepOne + _stepTwo);
    await minerStakingContract.connect(account1).claim([0], [firstTargetTime]);
    const balanceAfter = await hayaContract.read.balanceOf([
      account1.account.address,
    ]);
    expect(balanceAfter - balanceBefore).to.equal(_stepOne + _stepTwo);
    await minerStakingContract
      .connect(account1)
      .claim([0], [statusBefore[0][2]]);
    const finalBalace = await hayaContract.read.balanceOf([
      account1.account.address,
    ]);
    expect(finalBalace - balanceBefore).to.equal(
      _stepFour + _stepThree + _stepTwo + _stepOne
    );
  });
});
