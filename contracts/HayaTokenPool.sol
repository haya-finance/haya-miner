// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AddressArrayUtils} from "./lib/AddressArrayUtils.sol";

/**
 * @title HayaTokenPool
 * @dev This contract represents a Haya Pool, which is used to claim Haya tokens.
*/
contract HayaTokenPool is Ownable2Step {

    using AddressArrayUtils for address[];

    /**
     * @dev Public variable representing the Haya token contract.
     */
    IERC20 public immutable hayaToken;

    /**
     * @dev An array of addresses representing the claimers in the HayaPool contract.
     */
    address[] public claimers;

    /**
     * @dev Emitted when a user deposits tokens into the HayaPool contract.
     * @param user The address of the user who made the deposit.
     * @param amount The amount of tokens deposited.
     */
    event Deposited(address indexed user, uint256 amount);

    /**
     * @dev Emitted when a user claims their rewards from the HayaPool contract.
     * @param claimer The address of the user who claimed the rewards.
     * @param recipient The address where the claimed rewards are sent to.
     * @param amount The amount of rewards claimed.
     */
    event Claimed(address indexed claimer, address indexed recipient, uint256 amount);

    /**
     * @dev Emitted when a claimer is added to the HayaPool contract.
     * @param claimer The address of the claimer being added.
     */
    event ClaimerAdded(address indexed claimer);

    /**
     * @dev Emitted when a claimer is removed from the HayaPool contract.
     * @param claimer The address of the claimer being removed.
     */
    event ClaimerRemoved(address indexed claimer);

    /**
     * @dev Emitted when an emergency claim is made.
     * @param recipient The address of the recipient who made the claim.
     * @param amount The amount that was claimed.
     */
    event EmergencyClaimed(address indexed recipient, uint256 amount);


    /**
    * @dev Constructor function for the HayaPool contract.
    * @param _hayaToken The address of the Haya token contract.
    * @param _owner The address of the contract owner.
    */
    constructor(address _hayaToken, address _owner) Ownable(_owner) {
        hayaToken = IERC20(_hayaToken);
    }

    /**
     * @dev Claims the rewards from the HayaPool contract.
     * Can only be called by a claimer.
     * @param _recipient The address where the claimed rewards are sent to.
     * @param _amount The amount of rewards to claim.
     */
    function claim(address _recipient, uint256 _amount) external onlyClaimer {
        hayaToken.transfer(_recipient, _amount);
        emit Claimed(msg.sender, _recipient, _amount);
    }

    /**
     * @dev Transfers a specified amount of Haya tokens to the HayaPool contract.
     * Can be called by anyone.
     * 
     * @param _amount The amount of Haya tokens to transfer.
     */
    function deposit(uint256 _amount) external {
        hayaToken.transferFrom(msg.sender, address(this), _amount);
        emit Deposited(msg.sender, _amount);
    }
    
    /**
     * @dev Adds a new claimer to the HayaPool contract.
     * This function can only be called by the contract owner.
     * @param _claimer The address of the new claimer.
     */
    function addClaimer(address _claimer) public onlyOwner {
        require(claimers.contains(_claimer) == false, "HayaTokenPool: claimer already exists");
        claimers.push(_claimer);
        emit ClaimerAdded(_claimer);
    }
    
    /**
     * @dev Removes a claimer from the HayaPool contract.
     * This function can only be called by the contract owner.
     * @param _claimer The address of the claimer to remove.
     */
    function removeClaimer(address _claimer) public onlyOwner {
        require(claimers.contains(_claimer) == true, "HayaTokenPool: claimer does not exist");
        claimers.removeStorage(_claimer);
        emit ClaimerRemoved(_claimer);
    }
    
    /**
     * @dev Allows the owner to perform an emergency claim of Haya tokens.
     * This function can only be called by the contract owner.
     * @param _recipient The address to receive the claimed Haya tokens.
     * @param _amount The amount of Haya tokens to claim.
     */
    function emergencyClaim(address _recipient, uint256 _amount) public onlyOwner {
        hayaToken.transfer(_recipient, _amount);
        emit EmergencyClaimed(_recipient, _amount);
    }

    /**
     * @dev Fallback function to reject any incoming Ether transfers.
     * Reverts the transaction to prevent accidental transfers to this contract.
     */
    receive() external payable {
        revert();
    }

    /**
     * @dev Modifies a method to only be executable by a specific claimer.
     */
    modifier onlyClaimer() {
        require(claimers.contains(msg.sender), "HayaTokenPool: caller is not a claimer");
        _;
    }
}