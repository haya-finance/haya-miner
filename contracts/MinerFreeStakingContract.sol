// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract MinerFreeStakingContract is Initializable, Ownable2StepUpgradeable, ERC1155HolderUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {

    /**
     * @dev Maximum mining time allowed for staking.
     */
    uint256 public constant MAX_MINING_TIME = 7 days;

    /**
     * @dev The constant `HASH_RATE_FREE` represents the hash rate value for free staking.
     * It is set to 10_000.
     */
    uint256 public constant HASH_RATE_FREE = 10_000;

    /**
     * @dev A reference to the `IMinerStakingContract` interface.
     */
    IMinerStakingContract public minerStakingContract;

    /**
     * @dev A variable to store the interface of the IPool contract.
     */
    IPool public rewordsPool;

    /**
     * @dev Mapping to store the mining status of each address.
     * The key is the address and the value is an instance of the MiningStatus struct.
     * This mapping is private, meaning it can only be accessed within the contract.
     */
    mapping(address => MiningStatus) private miningStatuses;

    /**
     * @dev A mapping that stores the support status of miner types for each address and uint256 value.
     * The key is an address representing a NFT contract EIP 1155, and the value is a mapping of token id values to booleans.
     * The boolean value indicates whether the miner type is supported or not.
     */
    mapping(address => mapping(uint256 => bool)) private supportMinerTypes;

    /**
     * @dev Represents the mining status of a user.
     * @param hashRate The hash rate of the miner.
     * @param startTime The start time of the mining period.
     * @param endTime The end time of the mining period.
     * @param recentAdjustIndex The index used for recent hash rate adjustment.
     * @param latestClaimedTime The timestamp of the latest claimed reward.
     * @param rewardsClaimed The total number of rewards claimed by the miner.
     */
    struct MiningStatus {
        uint256 hashRate;
        uint256 startTime;
        uint256 endTime;
        uint256 recentAdjustIndex;
        uint256 latestClaimedTime;
        uint256 rewardsClaimed;
    }

    /**
     * @dev Struct representing the launch configuration for the MinerFreeStakingContract.
     * It contains the addresses of rewards pool, miner staking contract, and owner.
     */
    struct LaunchConfig {
        address rewardsPool;
        address minerStakingContract;
        address owner;
    }

    /**
     * @dev Emitted when a miner starts staking.
     * @param account The address of the account that started staking.
     * @param minerContract The address of the miner contract.
     * @param minerType The type of the miner.
     */
    event MinerStarted(address indexed account, address indexed minerContract, uint256 indexed minerType);

    /**
     * @dev Emitted when a miner claims rewards.
     * @param account The address of the user.
     * @param rewards The amount of rewards claimed.
     * @param targetTimestamp The target timestamp for claiming rewards.
     */
    event RewardsClaimed(address indexed account, uint256 rewards, uint256 targetTimestamp);

    /**
     * @dev Emitted when the support for a miner contract is modified.
     * @param minerContract The address of the miner contract.
     * @param tokenId The ID of the token associated with the miner contract.
     * @param supported The new support status for the miner contract.
     */
    event MinerSupportModified(address indexed minerContract, uint256 indexed tokenId, bool supported);

    /**
     * @dev Initializes the MinerFreeStakingContract with the provided configuration.
     * @param config The LaunchConfig struct containing the initial configuration values.
     */
    function initialize(LaunchConfig calldata config) public initializer {
        __Ownable_init(config.owner);
        __Pausable_init();
        __ReentrancyGuard_init();

        rewordsPool = IPool(config.rewardsPool);
        minerStakingContract = IMinerStakingContract(config.minerStakingContract);
    }

    /**
     * @dev Allows a user to start mining by staking a miner contract and token ID.
     * @param _minerContract The address of the miner contract.
     * @param _tokenId The ID of the token being staked.
     * 
     * Requirements:
     * - The caller must not be currently mining.
     * - The miner contract and token ID must be supported.
     * - The contract must not be paused.
     */
    function mining(address _minerContract, uint256 _tokenId) external onlyValidTime nonReentrant whenNotPaused {
        MiningStatus storage status = miningStatuses[msg.sender];
        require(status.hashRate == 0, "MinerFreeStakingContract: Already mining");
        require(isSupportMinerType(_minerContract, _tokenId), "MinerFreeStakingContract: Not supported");
        IERC1155(_minerContract).safeTransferFrom(msg.sender, address(this), _tokenId, 1, "");
        status.hashRate = HASH_RATE_FREE;
        status.startTime = block.timestamp;
        status.endTime = block.timestamp + MAX_MINING_TIME;
        status.latestClaimedTime = block.timestamp;
        status.rewardsClaimed = 0;
        status.recentAdjustIndex = minerStakingContract.getOccurredOutputFactorsLength() - 1;
        emit MinerStarted(msg.sender, _minerContract, _tokenId);
    }

    /**
     * @dev Allows a miner to claim their rewards.
     * @param _targetTimestamp The target timestamp for claiming rewards.
     * @notice The miner must be actively mining and the target timestamp must be within valid range.
     * @notice The rewards are calculated based on the miner's hash rate and previous claimed time.
     * @notice The rewards are transferred from the rewards pool to the miner's address.
     * @notice Emits a `RewardsClaimed` event with the miner's address, rewards amount, and target timestamp.
     */
    function claim(uint256 _targetTimestamp) external payable nonReentrant whenNotPaused {
        MiningStatus storage status = miningStatuses[msg.sender];
        require(status.hashRate > 0, "MinerFreeStakingContract: Not mining");
        if (minerStakingContract.claimFeeForEachMiner() > 0) {
            require(msg.value == minerStakingContract.claimFeeForEachMiner(), "MinerFreeStakingContract: Invalid fee");
            payable(minerStakingContract.claimFee2Address()).transfer(msg.value);
        }   
        require(_targetTimestamp < block.timestamp && _targetTimestamp <= status.endTime && _targetTimestamp > status.latestClaimedTime, "MinerFreeStakingContract: Invalid target timestamp");
        (uint256 recentAdjustIndex, uint256 rewards) = minerStakingContract.caculateRewards(status.hashRate, status.recentAdjustIndex, status.latestClaimedTime, _targetTimestamp);
        status.rewardsClaimed += rewards;
        status.recentAdjustIndex = recentAdjustIndex;
        status.latestClaimedTime = _targetTimestamp;
        rewordsPool.claim(msg.sender, rewards);
        emit RewardsClaimed(msg.sender, rewards, _targetTimestamp);
    }

    /**
     * @dev Retrieves the mining status of an account.
     * @param _account The address of the account to check.
     * @return The MiningStatus struct containing the mining status of the account.
     */
    function getMiningStatus(address _account) external view returns (MiningStatus memory) {
        return miningStatuses[_account];
    }

    /**
     * @dev Retrieves the unclaimed rewards for a given account up to a target timestamp.
     * @param _account The address of the account.
     * @param _targetTimestamp The target timestamp up to which the rewards are calculated.
     * @return The amount of unclaimed rewards.
     */
    function getUnclaimedRewards(address _account, uint256 _targetTimestamp) external view returns (uint256) {
        MiningStatus storage status = miningStatuses[_account];
        require(_targetTimestamp <= status.endTime && _targetTimestamp > status.latestClaimedTime, "MinerFreeStakingContract: Invalid target timestamp");
        (, uint256 rewards) = minerStakingContract.caculateRewards(HASH_RATE_FREE, status.recentAdjustIndex, status.latestClaimedTime, _targetTimestamp);
        return rewards;
    }

    /**
     * @dev Sets the support status for a specific miner type.
     * @param _minerContract The address of the miner contract.
     * @param _tokenId The ID of the miner type.
     * @param _supported The support status to be set.
     * Emits a `MinerSupportModified` event.
     */
    function setSupportMinerType(address _minerContract, uint256 _tokenId, bool _supported) external onlyOwner {
        supportMinerTypes[_minerContract][_tokenId] = _supported;
        emit MinerSupportModified(_minerContract, _tokenId, _supported);
    }

    /**
     * @dev Checks if a specific miner contract and token ID is supported.
     * @param _minerContract The address of the miner contract.
     * @param _tokenId The ID of the token.
     * @return A boolean indicating whether the miner contract and token ID is supported.
     */
    function isSupportMinerType(address _minerContract, uint256 _tokenId) public view returns (bool) {
        return supportMinerTypes[_minerContract][_tokenId];
    }

    /**
     * @dev Pauses all contract functions, except for the owner.
     * Can only be called by the contract owner.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses all contract functions, allowing them to be called again.
     * Can only be called by the contract owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Modifier to check if the current time is within the valid staking period.
     * The staking period is considered valid if the current time is greater than or equal to the start time
     * and less than the end time (if specified) or if the end time is set to 0 (indicating no end time).
     * Reverts with an error message if the time is invalid.
     */
    modifier onlyValidTime() {
        require(minerStakingContract.startTime() <= block.timestamp && (block.timestamp < minerStakingContract.endTime() || minerStakingContract.endTime() == 0), "MinerFreeStakingContract: Invalid time");
        _;
    }
}

/**
 * @title IPool
 * @dev Interface for the haya Pool contract.
 */
interface IPool {
    /**
     * @dev Claims the specified amount of tokens for the given recipient.
     * @param _recipient The address of the recipient.
     * @param _amount The amount of tokens to claim.
     */
    function claim(address _recipient, uint256 _amount) external;
}

interface IMinerStakingContract {
    /**
     * @dev Returns the length of the occurred output factors array.
     * @return The length of the occurred output factors array.
     */
    function getOccurredOutputFactorsLength() external view returns (uint256);

    /**
     * @dev Calculates the rewards based on the given parameters.
     * @param _hashRate The hash rate of the miner.
     * @param _recentAdjustIndex The recent adjustment index.
     * @param _latestClaimedTime The last timestamp of the user claim.
     * @param _targetTimestamp The target timestamp for the rewards calculation.
     * @return The calculated rewards and the new adjustment index.
     */
    function caculateRewards(uint256 _hashRate, uint256 _recentAdjustIndex, uint256 _latestClaimedTime, uint256 _targetTimestamp) external view returns (uint256, uint256);

    /**
     * @dev Returns the start time of the staking contract.
     * @return The start time of the staking contract.
     */
    function startTime() external view returns (uint256);

    /**
     * @dev Returns the end time of the staking contract.
     * @return The end time of the staking contract.
     */
    function endTime() external view returns (uint256);

    /**
     * @dev Returns the amount of fees that can be claimed for each miner.
     * @return The amount of fees that can be claimed for each miner.
     */
    function claimFeeForEachMiner() external view returns (uint256);

    /**
     * @dev Returns the address where the fee can be claimed.
     * @return The address where the fee can be claimed.
     */
    function claimFee2Address() external view returns (address);
}