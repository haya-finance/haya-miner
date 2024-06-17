// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";


contract StandardNFTMock is ERC1155, Ownable2Step {

    /**
     * @dev Mapping to store the total supply of tokens for each ID.
     * The key of the mapping is the ID of the token, and the value is the total supply of that token.
     * This mapping is private, meaning it can only be accessed within the contract.
     */
    mapping(uint256 => uint256) private _totalSupply;
    
    /**
     * @dev Represents the total supply of a token.
     */
    uint256 private _totalSupplyAll;

    /**
     * @dev The name of the miner.
     */
    string public name;

    /**
     * @dev Public variable representing the symbol of the contract.
     */
    string public symbol;


    constructor(string memory _uri, address _owner) ERC1155(_uri) Ownable(_owner) {
        name = "Standard EIP-1155 NFT Mock";
        symbol = "SENM";
    }


    /**
     * @dev Mints a specified amount of tokens and assigns them to the specified account.
     * @param account The address to which the tokens will be assigned.
     * @param id The ID of the token to be minted.
     * @param amount The amount of tokens to be minted.
     */
    function mint(address account, uint256 id, uint256 amount) public {
        _mint(account, id, amount, "");
    }

    /**
     * @dev Sets the URI for the token metadata.
     * Can only be called by the contract owner.
     * @param newuri The new URI to set.
     */
    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    /**
     * @dev Burns a specific amount of tokens from the specified account.
     * 
     * Requirements:
     * - The caller must be the account owner or have been approved for all tokens by the account owner.
     * 
     * @param account The address of the account from which the tokens will be burned.
     * @param id The identifier of the token to be burned.
     * @param value The amount of tokens to be burned.
     */
    function burn(address account, uint256 id, uint256 value) public {
        if (account != _msgSender() && !isApprovedForAll(account, _msgSender())) {
            revert ERC1155MissingApprovalForAll(_msgSender(), account);
        }
        _burn(account, id, value);
    }

    /**
     * @dev Total value of tokens in with a given id.
     */
    function totalSupply(uint256 id) public view virtual returns (uint256) {
        return _totalSupply[id];
    }

    /**
     * @dev Total value of tokens.
     */
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupplyAll;
    }

    /**
     * @dev Indicates whether any token exist with a given id, or not.
     */
    function exists(uint256 id) public view virtual returns (bool) {
        return totalSupply(id) > 0;
    }

    /**
     * @dev See {ERC1155-_update}.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override {
        super._update(from, to, ids, values);

        if (from == address(0)) {
            uint256 totalMintValue = 0;
            for (uint256 i = 0; i < ids.length; ++i) {
                uint256 value = values[i];
                // Overflow check required: The rest of the code assumes that totalSupply never overflows
                _totalSupply[ids[i]] += value;
                totalMintValue += value;
            }
            // Overflow check required: The rest of the code assumes that totalSupplyAll never overflows
            _totalSupplyAll += totalMintValue;
        }

        if (to == address(0)) {
            uint256 totalBurnValue = 0;
            for (uint256 i = 0; i < ids.length; ++i) {
                uint256 value = values[i];

                unchecked {
                    // Overflow not possible: values[i] <= balanceOf(from, ids[i]) <= totalSupply(ids[i])
                    _totalSupply[ids[i]] -= value;
                    // Overflow not possible: sum_i(values[i]) <= sum_i(totalSupply(ids[i])) <= totalSupplyAll
                    totalBurnValue += value;
                }
            }
            unchecked {
                // Overflow not possible: totalBurnValue = sum_i(values[i]) <= sum_i(totalSupply(ids[i])) <= totalSupplyAll
                _totalSupplyAll -= totalBurnValue;
            }
        }
    }
}