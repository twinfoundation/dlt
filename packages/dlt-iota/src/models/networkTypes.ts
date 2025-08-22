// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Network types supported for deployment
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const NetworkTypes = {
	/**
	 * Testnet.
	 */
	Testnet: "testnet",
	/**
	 * Devnet.
	 */
	Devnet: "devnet",
	/**
	 * Mainnet.
	 */
	Mainnet: "mainnet"
} as const;

/**
 * Network types supported for deployment
 */
export type NetworkTypes = (typeof NetworkTypes)[keyof typeof NetworkTypes];
