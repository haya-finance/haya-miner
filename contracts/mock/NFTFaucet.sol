// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {StandardNFTMock} from "./StandardNFTMock.sol";

contract NFTFaucet is Ownable, ERC1155Holder {

    NFT[] public components;
    uint256 public amount;

    struct NFT {
        address nftAddress;
        uint256 tokenId;
    }

    constructor(address _owner) Ownable(_owner) {
        amount = 1;
    }

    receive() external payable {
        address payable _toPayable = payable(msg.sender);
        (bool sent, ) = _toPayable.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
        _mint2Account(msg.sender);
    }

    function setAmount(uint256 _amount) external onlyOwner {
        amount = _amount;
    }

    function addComponent(NFT memory _component) external onlyOwner {
        components.push(_component);
    }

    function mint2Accounts(address[] memory _accounts) external {
        for (uint i = 0; i < _accounts.length; i++) {
            _mint2Account(_accounts[i]);
        }
    }

    function _mint2Account(address _account) internal {
        for (uint i = 0; i < components.length; i++) {
            StandardNFTMock(components[i].nftAddress).mint(_account, components[i].tokenId, amount);
        }
    }
}

