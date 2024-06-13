// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MinerStakingContract
 * @dev This contract handles the staking of tokens by miners.
 * It inherits from Initializable, Ownable2StepUpgradeable, ERC1155HolderUpgradeable,
 * PausableUpgradeable, and ReentrancyGuardUpgradeable contracts.
 */
contract MinerStakingContract is Initializable, Ownable2StepUpgradeable, ERC1155HolderUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {

    /**
     * @dev Maximum mining time allowed for staking.
     */
    uint256 public constant MAX_MINING_TIME = 365 days;

    /**
     * @dev Interface for the ERC1155 miner contract.
     */
    IERC1155 public minerContract;


    /**
     * @dev A variable to store the interface of the IPool contract.
     */
    IPool public rewordsPool;


    /**
     * @dev The start time of the staking period.
     */
    uint256 public startTime;

    /**
     * @dev The end time of the staking period.
     */
    uint256 public endTime;

    /**
     * @dev A mapping that stores the hash rates for each MinerType.
     * The key is the MinerType enum and the value is the corresponding hash rate.
     */
    mapping(MinerType => uint256) public hashRates;

    /**
     * @dev A mapping that stores the mining statuses of addresses.
     * Each address can have multiple mining statuses.
     * The mining statuses are stored in an array.
     * The mapping is private, allowing external contracts to access the mining statuses.
     */
    mapping(address => MiningStatus[]) private miningStatuses;

    /**
     * @dev An array of `AdjustRecord` structs that stores adjustment records.
     * This array is private and can only be accessed within the `MinerStakingContract` contract.
     */
    AdjustRecord[] private adjustRecords;

    /**
    * @dev Represents a staking contract for miners.
    * 
    * - `minerType`: The type of miner.
    * - `startTime`: The start time of the staking period.
    * - `endTime`: The end time of the staking period.
    * - `recentAdjustIndex`: The recent adjustment index.
    * - `latestClaimedTime`: The latest time when rewards were claimed.
    * - `rewardsClaimed`: The total rewards claimed by the miner.
    */
    struct MiningStatus {
        MinerType minerType;
        uint256 startTime;
        uint256 endTime;
        uint256 recentAdjustIndex;
        uint256 latestClaimedTime;
        uint256 rewardsClaimed;
    }

    /**
     * @dev Enum representing the different types of miners.
     * - Mini: Represents the Mini miner type.
     * - Bronze: Represents the Bronze miner type.
     * - Silver: Represents the Silver miner type.
     * - Gold: Represents the Gold miner type.
     */
    enum MinerType {
        Mini,
        Bronze,
        Silver,
        Gold
    }

    /**
     * @dev Struct representing an adjustment record for a miner's staking contract.
     * It contains the outputFactor and time of the adjustment.
     */
    struct AdjustRecord {
        uint256 timestamp;
        uint256 outputFactor;
    }
  
    /**
     * @dev Struct representing the configuration for the staking contract.
     * It contains the output factor, miner contract address, rewards pool address, owner address, start time, and end time.
     */
    struct LaunchConfig {
        uint256 outputFactor;
        address minerContract;
        address rewardsPool;
        address owner;
        uint256 startTime;
        uint256 endTime;
    }

    /**
     * @dev Emitted when a miner starts staking.
     * @param miner The address of the miner.
     * @param minerType The type of the miner.
     */
    event MinerStarted(address indexed miner, MinerType indexed minerType);

    /**
     * @dev Emitted when a miner claims rewards.
     * @param miner The address of the user.
     * @param index The index of the rewards.
     * @param rewards The amount of rewards claimed.
     * @param targetTimestamp The target timestamp for claiming rewards.
     */
    event RewardsClaimed(address indexed miner, uint256 index, uint256 rewards, uint256 targetTimestamp);


    /**
     * @dev Emitted when the output factor is dropped.
     * @param timestamp The timestamp when the factor is dropped.
     * @param factor The dropped factor value.
     */
    event OutputFactorDropped(uint256 timestamp, uint256 factor);

    /**
     * @dev Emitted when a new output factor is added.
     * @param timestamp The timestamp when the output factor is added.
     * @param factor The value of the output factor.
     */
    event OutputFactorAdded(uint256 timestamp, uint256 factor);

    /**
     * @dev Emitted when the end time is updated.
     * @param newEndTime The new end time value.
     */
    event EndTimeUpdated(uint256 newEndTime);


    // /**
    //  * @dev Constructor function for the MinerStakingContract.
    //  * It disables the initializers to prevent any further initialization.
    //  */
    // constructor() {
    //     _disableInitializers();
    // }

    /**
     * @dev Initializes the staking contract with the specified configuration.
     * It sets the owner, miner contract, rewards pool, start time, and end time.
     * @param config The configuration for the staking contract.
     */
    function initialize(LaunchConfig calldata config) public initializer() {
        __Ownable_init(config.owner);
        __Pausable_init();
        __ReentrancyGuard_init();

        minerContract = IERC1155(config.minerContract);
        rewordsPool = IPool(config.rewardsPool);
        startTime  = config.startTime;
        endTime = config.endTime;
        _addOutputFactorNoCheck(block.timestamp, config.outputFactor);
        hashRates[MinerType.Mini] = 10_000;
        hashRates[MinerType.Bronze] = 100_000;
        hashRates[MinerType.Silver] = 1005_000;
        hashRates[MinerType.Gold] = 10_010_000;
    }

    /**
     * @dev Executes batch mining for multiple miner types and quantities.
     * @param _types An array of MinerType values representing the types of miners to be mined.
     * @param _quantities An array of uint256 values representing the quantities of miners to be mined.
     * @notice This function can only be called during valid time periods and when the contract is not paused.
     * @notice The length of `_types` and `_quantities` arrays must be the same.
     * @notice Each element in `_types` and `_quantities` arrays corresponds to a single mining operation.
     * @notice Throws an error if the input length is invalid.
     */
    function batchMining(MinerType[] calldata _types, uint256[] calldata _quantities) external onlyValidTime nonReentrant whenNotPaused {
        require(_types.length == _quantities.length, "MinerStakingContract: Invalid input length");
        for (uint256 i = 0; i < _types.length; i++) {
            _mining(_types[i], _quantities[i]);
        }
    }

    /**
     * @dev Initiates the mining process by staking a certain quantity of tokens with a specified miner type.
     * @param _type The type of miner to stake tokens with.
     * @param _quantity The quantity of tokens to stake.
     * Requirements:
     * - The function can only be called during a valid time period.
     * - The function can only be called when the contract is not paused.
     */
    function mining(MinerType _type, uint256 _quantity) external onlyValidTime nonReentrant whenNotPaused {
        _mining(_type, _quantity);
    }

    /**
     * @dev Allows a user to claim rewards for a given set of miner indexes and target timestamp.
     * @param _minerIndexes The array of miner indexes for which the rewards are to be claimed.
     * @param _targetTimestamp The target timestamp until which the rewards can be claimed.
     * @notice The target timestamp must be less than the current block timestamp.
     * @notice This function can only be called when the contract is not paused.
     */
    function claim(uint256[] calldata _minerIndexes, uint256[] calldata _targetTimestamp) external nonReentrant whenNotPaused {
        require(_minerIndexes.length == _targetTimestamp.length, "MinerStakingContract: Invalid input length");
        for (uint256 i = 0; i < _minerIndexes.length; i++) {
            require(_targetTimestamp[i] < block.timestamp, "MinerStakingContract: Invalid target timestamp");
            _claimRewards(msg.sender, _minerIndexes[i], _targetTimestamp[i]);
        }
    }

    /**
     * @dev Adds a future output factor to the adjustment records.
     * Only the contract owner can call this function.
     * @param _timeline The timeline for the adjustment.
     * @param _miningOutputFactor The output factor to be added.
     * Emits an `OutputFactorAdded` event with the timeline and output factor.
     */
    function addFutureOutputFactor(uint256 _timeline, uint256 _miningOutputFactor) external onlyOwner {
        _addOutputFactor(_timeline, _miningOutputFactor);
    }

    /**
     * @dev Adds a real-time output factor to the adjustment records.
     * Only the contract owner can call this function.
     * @param _miningOutputFactor The output factor to be added.
     * Emits an `OutputFactorAdded` event with the timestamp and output factor.
     */
    function addRealTimeOutputFactor(uint256 _miningOutputFactor) external onlyOwner {
        _addOutputFactor(block.timestamp, _miningOutputFactor);
    }

    /**
     * @dev Drops the future output factor from the adjustment records.
     * Only the contract owner can call this function.
     * 
     * Requirements:
     * - The future output factor must exist.
     * 
     * Emits an `OutputFactorDropped` event with the timestamp and output factor.
     */
    function dropFutureOutputFactor() public onlyOwner {
        (uint256 latestTimestamp, uint256 latestOutputFactor) = getLatestAdjustRecord();
        require(latestTimestamp > block.timestamp, "MinerStakingContract: The future output factor does not exist");
        adjustRecords.pop();
        emit OutputFactorDropped(latestTimestamp, latestOutputFactor);
    }

    /**
     * @dev Sets the end time for the staking contract.
     * @param _endTime The new end time to be set.
     * Emits an `EndTimeUpdated` event with the updated end time.
     * Only the contract owner can call this function.
     */
    function setEndTime(uint256 _endTime) public onlyOwner {
        endTime = _endTime;
        emit EndTimeUpdated(_endTime);
    }

    /**
     * @dev Pauses the staking contract.
     * Requirements:
     * - Only the contract owner can call this function.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the staking contract.
     * Requirements:
     * - Only the contract owner can call this function.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Returns the rewards for a given hash rate, output factor, and duration.
     * @param _hashRate The hash rate of the miner.
     * @param _outputFactor The output factor of the miner.
     * @param _duration The duration for which the rewards are to be calculated.
     * @return The rewards calculated based on the hash rate, output factor, and duration.
     */
    function rewardByHashRate(uint256 _hashRate, uint256 _outputFactor, uint256 _duration) public pure returns (uint256) {
        uint256 rewards = _hashRate * _outputFactor * _duration;
        return rewards;
    }

    /**
     * @dev Returns the length of the mining status array for a given account.
     * @param _account The address of the account.
     * @return The length of the mining status array.
     */
    function getMiningStatusLength(address _account) external view returns (uint256) {
        return miningStatuses[_account].length;
    }

    /**
     * @dev Retrieves the unclaimed rewards for a given account within a specified range of mining statuses.
     * @param _account The address of the account for which to retrieve the rewards.
     * @param _from The starting index of the mining statuses range.
     * @param _to The ending index of the mining statuses range.
     * @param _targetTimestamp The target timestamp used for calculating rewards.
     * @return rewards An array of unclaimed rewards for each mining status within the specified range.
     */
    function getUnclaimedRewards(address _account, uint256 _from, uint256 _to, uint256 _targetTimestamp) external view returns (uint256[] memory) {
        require(_from <= _to, "MinerStakingContract: Invalid range");
        uint256 length = miningStatuses[_account].length;
        require(_to < length, "MinerStakingContract: Invalid range");
        uint256[] memory rewards = new uint256[](_to - _from + 1);
        for (uint256 i = _from; i <= _to; i++) {
            (, rewards[i - _from]) = _calculateRewards(_account, i, _targetTimestamp);
        }
        return rewards;
    }
    
    /**
     * @dev Retrieves the mining status for a given account and index.
     * @param _account The address of the account.
     * @param _from The starting index of the range.
     * @param _to The ending index of the range.
     * @return An array of `MiningStatus` within the specified range.
     * @notice This function is view-only and does not modify the contract state.
     * @notice The range is inclusive of both the starting and ending indices.
     * @notice Throws an error if the range is invalid or if the ending index is out of bounds.
     */
    function getMiningStatus(address _account, uint256 _from, uint256 _to) external view returns (MiningStatus[] memory) {
        require(_from <= _to, "MinerStakingContract: Invalid range");
        uint256 length = miningStatuses[_account].length;
        require(_to < length, "MinerStakingContract: Invalid range");
        MiningStatus[] memory statuses = new MiningStatus[](_to - _from + 1);
        for (uint256 i = _from; i <= _to; i++) {
            statuses[i - _from] = miningStatuses[_account][i];
        }
        return statuses;
    }

    /**
     * @dev Retrieves the latest adjustment record.
     * @return The timestamp and output factor of the latest adjustment record.
     */
    function getLatestAdjustRecord() public view returns (uint256, uint256) {
        AdjustRecord memory record = adjustRecords[adjustRecords.length - 1];
        return (record.timestamp, record.outputFactor);
    }

    /**
     * @dev Retrieves an array of `AdjustRecord` within a specified range.
     * @param _from The starting index of the range.
     * @param _to The ending index of the range.
     * @return An array of `AdjustRecord` within the specified range.
     * @notice This function is view-only and does not modify the contract state.
     * @notice The range is inclusive of both the starting and ending indices.
     * @notice Throws an error if the range is invalid or if the ending index is out of bounds.
     */
    function getAdjustRecords(uint256 _from, uint256 _to) external view returns (AdjustRecord[] memory) {
        require(_from <= _to, "MinerStakingContract: Invalid range");
        uint256 length = adjustRecords.length;
        require(_to < length, "MinerStakingContract: Invalid range");
        AdjustRecord[] memory records = new AdjustRecord[](_to - _from + 1);
        for (uint256 i = _from; i <= _to; i++) {
            records[i - _from] = adjustRecords[i];
        }
        return records;
    }

    /**
     * @dev Retrieves the length of the occurred output factors array.
     * @return The length of the occurred output factors array.
     */
    function getOccurredOutputFactorsLength() public view returns (uint256) {
        (uint256 latestTimestamp, ) = getLatestAdjustRecord();
        if (block.timestamp >= latestTimestamp) {
            return adjustRecords.length;
        }
        return adjustRecords.length - 1;
    }

    /**
     * @dev Internal function for initiating mining.
     * @param _type The type of miner.
     * @param _quantity The quantity of miners to be initiated.
     * Requirements:
     * - `_quantity` must be greater than 0.
     * - `_type` must be a valid miner type.
     * - The caller must have approved the transfer of miners to this contract.
     * Emits a {Transfer} event.
     */
    function _mining(MinerType _type, uint256 _quantity) internal {
        require(_quantity > 0, "MinerStakingContract: Invalid quantity");
        require(_type >= MinerType.Mini && _type <= MinerType.Gold, "MinerStakingContract: Invalid type");
        minerContract.safeTransferFrom(msg.sender, address(this), uint256(_type), _quantity, "");
        /**
         * @dev Subtracting 1 from the length of the occurred output factors array to get the adjustIndex.
         * This is because the miner's initial state requires the index of the last occurred output factors.
         */
        uint256 adjustIndex = getOccurredOutputFactorsLength() - 1;
        for (uint256 i = 0; i < _quantity; i++) {
            _engineStart(msg.sender, _type, adjustIndex);
        }
    }

    /**
     * @dev Internal function to start the mining process for a specific miner.
     * @param account The address of the account.
     * @param _type The type of miner.
     * @param _adjustIndex The adjustment index.
     */
    function _engineStart(address account, MinerType _type, uint256 _adjustIndex) internal {
        miningStatuses[account].push(MiningStatus({
            minerType: _type,
            startTime: block.timestamp,
            endTime: block.timestamp + MAX_MINING_TIME,
            recentAdjustIndex: _adjustIndex,
            latestClaimedTime: block.timestamp,
            rewardsClaimed: 0
        }));
        emit MinerStarted(msg.sender, _type);
    }

    /**
     * @dev Internal function to claim rewards for a specific miner.
     * @param _account The address of the account.
     * @param _minerIndex The index of the miner in the miningStatuses mapping.
     * @param _targetTimestamp The target timestamp for calculating rewards.
     */
    function _claimRewards(address _account, uint256 _minerIndex, uint256 _targetTimestamp) internal {
        MiningStatus storage status = miningStatuses[_account][_minerIndex];
        (uint256 recentAdjustIndex, uint256 rewards) = _calculateRewards(_account, _minerIndex, _targetTimestamp);
        status.rewardsClaimed += rewards;
        status.recentAdjustIndex = recentAdjustIndex;
        status.latestClaimedTime = _targetTimestamp;
        rewordsPool.claim(_account, rewards);
        emit RewardsClaimed(_account, _minerIndex, rewards, _targetTimestamp);
    }

    /**
     * @dev Internal function to calculate rewards for a specific miner.
     * @param _account The address of the account.
     * @param _minerIndex The index of the miner in the miningStatuses mapping.
     * @param _targetTimestamp The target timestamp for calculating rewards.
     * @return The recent adjustment index and the rewards calculated.
     */
    function _calculateRewards(address _account, uint256 _minerIndex, uint256 _targetTimestamp) internal view returns (uint256, uint256) {
        MiningStatus memory status = miningStatuses[_account][_minerIndex];
        require(_targetTimestamp <= status.endTime && _targetTimestamp > status.latestClaimedTime, "MinerStakingContract: Invalid target timestamp");
        uint256 rewards = 0;
        uint256 lastTimestamp = status.latestClaimedTime;
        uint256 occurredLatestIndex = getOccurredOutputFactorsLength() - 1;
        uint256 hashRate = hashRates[status.minerType];
        for (uint256 i = status.recentAdjustIndex; i <= occurredLatestIndex; i++) {
            AdjustRecord memory record = adjustRecords[i];

            if (i < occurredLatestIndex) {
                AdjustRecord memory nextRecord = adjustRecords[i + 1];
                if (nextRecord.timestamp > _targetTimestamp) {
                    rewards += rewardByHashRate(hashRate, record.outputFactor, _targetTimestamp - lastTimestamp);
                    return (i, rewards);
                }
                rewards += rewardByHashRate(hashRate, record.outputFactor, nextRecord.timestamp - lastTimestamp);
                lastTimestamp = nextRecord.timestamp;
            }
            if (i == occurredLatestIndex) {
                rewards += rewardByHashRate(hashRate, record.outputFactor, _targetTimestamp - lastTimestamp);
            }
        }
        return (occurredLatestIndex, rewards);
    }

    /**
     * @dev Adds a new output factor to the adjustment records.
     * Only the contract owner can call this function.
     * 
     * Requirements:
     * - The timeline must be greater than the current block timestamp.
     * 
     * Emits an `OutputFactorAdded` event with the timeline and output factor.
     */
    function _addOutputFactor(uint256 _timeline, uint256 _miningOutputFactor) internal {
        require(_timeline >= block.timestamp, "MinerStakingContract: Invalid timeline");
        (uint256 latestTimestamp, uint256 latestOutputFactor) = getLatestAdjustRecord();
        require(latestTimestamp < block.timestamp, "MinerStakingContract: The future output factor exists");
        require(latestOutputFactor != _miningOutputFactor, "MinerStakingContract: The output factor is the same");
        _addOutputFactorNoCheck(_timeline, _miningOutputFactor);
    }

    /**
     * @dev Adds a new output factor to the adjustment records without checking the timeline.
     * @param _timeline The timeline for the adjustment.
     * @param _miningOutputFactor The output factor to be added.
     * Emits an `OutputFactorAdded` event with the timeline and output factor.
     */
    function _addOutputFactorNoCheck(uint256 _timeline, uint256 _miningOutputFactor) internal {
        adjustRecords.push(AdjustRecord(_timeline, _miningOutputFactor));
        emit OutputFactorAdded(_timeline, _miningOutputFactor);
    }
    
    /**
     * @dev Modifier to check if the current time is within the valid time range.
     * The function requires that the current block timestamp is greater than or equal to the `startTime`
     * and less than the `endTime`, or `endTime` is set to 0 (indicating no end time).
     * If the condition is not met, it reverts with an error message.
     */
    modifier onlyValidTime() {
        require(startTime <= block.timestamp && (block.timestamp < endTime || endTime == 0), "MinerStakingContract: Invalid time");
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