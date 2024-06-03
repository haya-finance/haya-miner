
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// mock class using BasicToken
contract StandardTokenMock is ERC20 {
    
    /**
     * @dev Private variable to store the number of decimal places for the token.
     */
    uint8 private internal_decimals;

    /**
     * @dev Constructor function for the StandardTokenMock contract.
     * @param _name The name of the token.
     * @param _symbol The symbol of the token.
     * @param _decimals The number of decimals for the token.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        internal_decimals = _decimals;
    }

    function decimals() public view override virtual returns (uint8) {
        return internal_decimals;
    }

    function mint() external {
        _mint(msg.sender, 1_000_000 * 10 ** uint256(internal_decimals));
    }

    function mintWithAmount(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}