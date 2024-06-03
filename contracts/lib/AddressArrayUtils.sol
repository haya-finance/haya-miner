// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title AddressArrayUtils
 * @dev Library for working with arrays of addresses.
 */
library AddressArrayUtils {

    /**
     * @dev Returns the index of the specified address in the given array.
     * @param A The array of addresses to search in.
     * @param a The address to search for.
     * @return The index of the address in the array, and a boolean indicating whether the address was found.
     */
    function indexOf(
        address[] memory A,
        address a
    ) internal pure returns (uint256, bool) {
        uint256 length = A.length;
        for (uint256 i = 0; i < length; i++) {
            if (A[i] == a) {
                return (i, true);
            }
        }
        return (type(uint256).max, false);
    }

    /**
     * @dev Checks if an address array contains a specific address.
     * @param A The address array to search in.
     * @param a The address to search for.
     * @return True if the address is found in the array, false otherwise.
     */
    function contains(
        address[] memory A,
        address a
    ) internal pure returns (bool) {
        (, bool isIn) = indexOf(A, a);
        return isIn;
    }

    /**
     * @dev Checks if an array of addresses contains any duplicates.
     * @param A The array of addresses to check.
     * @return True if the array contains duplicates, false otherwise.
     */
    function hasDuplicate(address[] memory A) internal pure returns (bool) {
        require(A.length > 0, "A is empty");

        for (uint256 i = 0; i < A.length - 1; i++) {
            address current = A[i];
            for (uint256 j = i + 1; j < A.length; j++) {
                if (current == A[j]) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @dev Removes a specific address from an array of addresses.
     * @param A The array of addresses.
     * @param a The address to be removed.
     * @return The updated array of addresses after removing the specified address.
     * @notice This function is internal and should only be called from within the contract.
     * @notice If the specified address is not found in the array, a revert error is thrown.
     */
    function remove(
        address[] memory A,
        address a
    ) internal pure returns (address[] memory) {
        (uint256 index, bool isIn) = indexOf(A, a);
        if (!isIn) {
            revert("Address not in array.");
        } else {
            (address[] memory _A, ) = pop(A, index);
            return _A;
        }
    }

    /**
     * @dev Removes the specified address from the given storage array.
     * @param A The storage array of addresses.
     * @param a The address to be removed.
     * @notice This function will revert if the specified address is not found in the array.
     * @notice If the array is empty, this function will not throw an underflow error.
     */
    function removeStorage(address[] storage A, address a) internal {
        (uint256 index, bool isIn) = indexOf(A, a);
        if (!isIn) {
            revert("Address not in array.");
        } else {
            uint256 lastIndex = A.length - 1; // If the array would be empty, the previous line would throw, so no underflow here
            if (index != lastIndex) {
                A[index] = A[lastIndex];
            }
            A.pop();
        }
    }

    /**
     * @dev Removes an element from the given address array at the specified index.
     * @param A The address array.
     * @param index The index of the element to be removed.
     * @return The updated address array after removing the element, and the removed element.
     * @notice This function modifies the original array by removing the element at the specified index.
     * @notice The index must be less than the length of the array.
     */
    function pop(
        address[] memory A,
        uint256 index
    ) internal pure returns (address[] memory, address) {
        uint256 length = A.length;
        require(index < A.length, "Index must be < A length");
        address[] memory newAddresses = new address[](length - 1);
        for (uint256 i = 0; i < index; i++) {
            newAddresses[i] = A[i];
        }
        for (uint256 j = index + 1; j < length; j++) {
            newAddresses[j - 1] = A[j];
        }
        return (newAddresses, A[index]);
    }

    /**
     * @dev Extends an array of addresses by appending another array of addresses.
     * @param A The first array of addresses.
     * @param B The second array of addresses.
     * @return The extended array of addresses.
     */
    function extend(
        address[] memory A,
        address[] memory B
    ) internal pure returns (address[] memory) {
        uint256 aLength = A.length;
        uint256 bLength = B.length;
        address[] memory newAddresses = new address[](aLength + bLength);
        for (uint256 i = 0; i < aLength; i++) {
            newAddresses[i] = A[i];
        }
        for (uint256 j = 0; j < bLength; j++) {
            newAddresses[aLength + j] = B[j];
        }
        return newAddresses;
    }
}