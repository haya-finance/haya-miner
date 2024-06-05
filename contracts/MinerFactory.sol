// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title MinerFactory
 * @dev This contract is responsible for creating instances of the Miner contract.
 * It inherits from the ReentrancyGuard and Ownable2Step contracts.
 */
contract MinerFactory is ReentrancyGuard, Ownable2Step {

    /**
     * @dev Public variable that stores the address of the miner contract.
     */
    address public minerContract;

    /**
     * @dev The ERC20 token used for Mint.
     * @notice This token has 6 decimal places.
     */
    IERC20 public tokenForMint;


    /**
     * @dev Public variable that stores the address of the beneficiaries.
     */
    address public beneficiaries;

    /**
     * @dev The timestamp when the MinerFactory contract starts.
     */
    uint256 public startTime;

    /**
     * @dev Represents the end time for a specific operation.
     */
    uint256 public endTime;

    /**
     * @dev A mapping that stores the prices of different miner types.
     * The keys of the mapping are instances of the enum type `MinerType`,
     * and the values are the corresponding prices represented as `uint256`.
     */
    mapping(MinerType => uint256) public minerPrices;

    /**
     * @dev Enum representing the different types of Haya Miners.
     * Mini: Represents a Mini Miner.
     * Bronze: Represents a Bronze Miner.
     * Silver: Represents a Silver Miner.
     * Gold: Represents a Gold Miner.
     */
    enum MinerType {
        Mini,
        Bronze,
        Silver,
        Gold
    }

    /**
     * @dev Emitted when a miner is minted.
     * @param user The address of the user who minted the miner.
     * @param minerType The type of the miner that was minted.
     * @param quantity The quantity of miners that were minted.
     */
    event MinerMinted(address indexed user, uint8 minerType, uint256 quantity);
    
    /**
     * @dev Emitted when the beneficiaries address is set.
     * @param beneficiaries The new address of the beneficiaries.
     */
    event BeneficiariesSet(address beneficiaries);

    /**
     * @dev Constructor function for the MinerFactory contract.
     * @param _minerContract The address of the miner contract.
     * @param _tokenForMint The address of the token used for minting.
     * @param _owner The address of the contract owner.
     * @param _startTime The start time of the contract.
     * @param _endTime The end time of the contract.
     * @param _beneficiaries The address of the beneficiaries.
     */
    constructor(
        address _minerContract,
        address _tokenForMint,
        address _owner,
        uint256 _startTime,
        uint256 _endTime,
        address _beneficiaries
    ) Ownable(_owner) {
        minerContract = _minerContract;
        tokenForMint = IERC20(_tokenForMint);
        startTime = _startTime;
        endTime = _endTime;
        beneficiaries = _beneficiaries;
        minerPrices[MinerType.Mini] = 10 * 10**6;
        minerPrices[MinerType.Bronze] = 100 * 10**6;
        minerPrices[MinerType.Silver] = 1_000 * 10**6;
        minerPrices[MinerType.Gold] = 10_000 * 10**6;
    }

    /**
     * @dev External function to mint multiple ERC1155 miners.
     * @param _minerTypes The types of miners to purchase.
     * @param _quantities The quantities of miners to purchase for each type.
     */
    function mintMiners(MinerType[] memory _minerTypes, uint256[] memory _quantities) external nonReentrant {
        require(_minerTypes.length == _quantities.length, "MinerFactory: Invalid input");
        require(startTime <= block.timestamp && (block.timestamp < endTime || endTime == 0), "MinerFactory: Invalid time");

        for (uint256 i = 0; i < _minerTypes.length; i++) {
            mintMiner(_minerTypes[i], _quantities[i]);
        }
    }

    /**
     * @dev Sets the end time for the mining process.
     * Can only be called by the contract owner.
     * 
     * @param _endTime The new end time for the mining process.
     */
    function setEndTime(uint256 _endTime) external onlyOwner {
        endTime = _endTime;
    }
    
    /**
     * @dev Sets the address of the beneficiaries.
     * Can only be called by the contract owner.
     * 
     * @param _beneficiaries The new address of the beneficiaries.
     */
    function setBeneficiaries(address _beneficiaries) external onlyOwner {
        beneficiaries = _beneficiaries;
        emit BeneficiariesSet(_beneficiaries);
    }

    /**
     * @dev Mints a specified quantity of miners of a given type for the caller.
     * @param _minerType The type of miner to be minted.
     * @param _quantity The quantity of miners to be minted.
     * @notice This function is internal and can only be called from within the contract.
     * @notice The caller must have a sufficient balance of the token for minting.
     * @notice The token for minting will be transferred from the caller to the beneficiaries.
     * @notice The minting process will be performed by the Miner contract.
     * @notice Emits a `MinerMinted` event with the caller's address, miner type, and quantity.
     */
    function mintMiner(MinerType _minerType, uint256 _quantity) internal {
        require(_minerType >= MinerType.Mini && _minerType <= MinerType.Gold, "MinerFactory: Invalid type");
        uint256 totalPrice = minerPrices[_minerType] * _quantity;
        require(tokenForMint.balanceOf(msg.sender) >= totalPrice, "MinerFactory: Insufficient balance");

        tokenForMint.transferFrom(msg.sender, beneficiaries, totalPrice);
        IMiner(minerContract).mint(msg.sender, uint256(_minerType), _quantity, "");
        emit MinerMinted(msg.sender, uint8(_minerType), _quantity);
    }

    /**
     * @dev Fallback function to reject any incoming Ether transfers.
     * Reverts the transaction to prevent accidental transfers to this contract.
     */
    receive() external payable {
        revert();
    }
}

/**
 * @title IMiner
 * @dev Interface for the Miner contract.
 */
interface IMiner {
    /**
     * @dev Mints new tokens and assigns them to the specified account.
     * @param account The address to which the tokens will be assigned.
     * @param id The unique identifier of the token.
     * @param amount The amount of tokens to mint.
     * @param data Additional data to pass to the mint function.
     */
    function mint(address account, uint256 id, uint256 amount, bytes calldata data) external;
}