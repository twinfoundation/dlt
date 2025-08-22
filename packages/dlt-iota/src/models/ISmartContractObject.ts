// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Base interface for all smart contract objects with versioning support.
 */
export interface ISmartContractObject {
	/**
	 * The ID of the smart contract object.
	 */
	id: {
		/**
		 * The ID of the smart contract object.
		 */
		id: string; // UID is an object with an 'id' field
	};

	/**
	 * The version of the contract that created this object.
	 */
	version: string;
}
