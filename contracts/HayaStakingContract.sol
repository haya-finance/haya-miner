// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HayaStakingContract
 * @dev This contract allows users to stake tokens for a specific period of time and earn rewards based on their staked amount and level.
*/
contract HayaStakingContract is ReentrancyGuard {


    /**
     * @dev Minimum stake time in seconds.
     */
    uint256 public constant MIN_STAKE_TIME = 365 days;

    /**
     * @dev The ERC20 token used for staking.
     */
    IERC20 public immutable stakeToken;

    /**
     * @dev Mapping of addresses to their corresponding stake information.
     */
    mapping(address => Stake) public stakes;

    /**
     * @dev Mapping of levels to their corresponding stake amounts.
     */
    mapping(Level => uint256) public levelAmounts;

    /**
     * @dev Enum representing the different levels of staking.
     * - None: Level 0
     * - SeniorAgent: Level 1
     * - GlobalAgent: Level 2
     */
    enum Level {
        None,
        SeniorAgent,
        GlobalAgent
    }

    /**
     * @dev Struct representing a stake made by a user.
     * - stakeTime: The time when the stake was made.
     * - unlockTime: The time when the stake can be unlocked.
     * - level: The level of the stake.
     */
    struct Stake {
        uint256 stakeTime;
        uint256 unlockTime;
        Level level;
    }

    /**
     * @dev Emitted when a user's level is changed.
     * @param user The address of the user whose level was changed.
     * @param oldLevel The old level of the user.
     * @param newLevel The new level of the user.
     */
    event LevelChanged(address indexed user, uint8 oldLevel, uint8 newLevel);

    /**
     * @dev Constructor function for the stakeContract.
     * @param _token The address of the token contract.
     */
    constructor(address _token) {
        stakeToken = IERC20(_token);
        levelAmounts[Level.SeniorAgent] = 10_000 ether;
        levelAmounts[Level.GlobalAgent] = 100_000 ether;
    }

    /**
     * @dev Upgrades the level of the stake for the caller.
     * @param _newLevel The new level to upgrade to.
     * Emits a `LevelChanged` event with the updated stake level.
     * Requirements:
     * - The caller must have an existing stake.
     * - The upgrade cost must be transferred from the caller to the contract.
     * - The stake's unlock time is set to the current block timestamp plus the minimum stake time.
     * - The stake's stake time is set to the current block timestamp.
     */
    function upgradeLevel(Level _newLevel) external nonReentrant {
        Stake storage stake = stakes[msg.sender];
        Level oldLevel = stake.level;
        uint256 upgradeCost = calculateUpgradeCost(oldLevel, _newLevel);
        stakeToken.transferFrom(msg.sender, address(this), upgradeCost);

        stake.level = _newLevel;
        stake.unlockTime = block.timestamp + MIN_STAKE_TIME;
        stake.stakeTime = block.timestamp;

        emit LevelChanged(msg.sender, uint8(oldLevel), uint8(_newLevel));
    }

    /**
     * @dev Unstakes the stake of the caller.
     * The stake must exist and be at a level higher than None.
     * The stake must also be unlocked (unlockTime <= block.timestamp).
     * Transfers the corresponding stake token amount to the caller.
     * Deletes the stake from the stakes mapping.
     * Emits a LevelChanged event with the updated stake level.
     */
    function unstake() external nonReentrant {
        Stake memory stake = stakes[msg.sender];
        require(stake.level > Level.None, "StakeContract: No stake found");
        require(stake.unlockTime <= block.timestamp, "StakeContract: Stake is still locked");
        Level oldLevel = stake.level;
        stakeToken.transfer(msg.sender, levelAmounts[stake.level]);

        delete stakes[msg.sender];
        emit LevelChanged(msg.sender, uint8(oldLevel), uint8(Level.None));
    }

    /**
     * @dev Internal function to calculate the amount of tokens required to upgrade to a higher level.
     * @param currentLevel The current level of the stake.
     * @param newLevel The new level to upgrade to.
     * @return The amount of tokens required to upgrade.
     */
    function calculateUpgradeCost(Level currentLevel, Level newLevel) public view returns (uint256) {
        require(newLevel > currentLevel && newLevel <= Level.GlobalAgent, "StakeContract: Invalid level upgrade");
        uint256 upgradeCost = levelAmounts[Level(newLevel)] - levelAmounts[Level(currentLevel)];
        return upgradeCost;
    }

    /**
     * @dev Fallback function to reject any incoming Ether transfers.
     * Reverts the transaction to prevent accidental transfers to this contract.
     */
    receive() external payable {
        revert();
    }
}