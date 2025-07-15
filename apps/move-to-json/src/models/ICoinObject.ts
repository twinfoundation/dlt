// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface for IOTA coin object from CLI balance response.
 */
export interface ICoinObject {
	/**
	 * The type of the coin.
	 */
	coinType: string;
	/**
	 * The object ID of the coin.
	 */
	coinObjectId: string;
	/**
	 * The version of the coin.
	 */
	version: string;
	/**
	 * The digest of the coin.
	 */
	digest: string;
	/**
	 * The balance amount as string.
	 */
	balance: string;
	/**
	 * The previous transaction ID.
	 */
	previousTransaction: string;
}
