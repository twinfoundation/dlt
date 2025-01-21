// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { Transaction } from "@iota/iota-sdk/transactions";

/**
 * Options for NFT transactions.
 */
export interface IIotaRebasedNftTransactionOptions {
	/**
	 * The owner address of the NFT.
	 */
	owner: string;

	/**
	 * The transaction to execute.
	 */
	transaction: Transaction;

	/**
	 * Show transaction effects in response.
	 */
	showEffects?: boolean;

	/**
	 * Show transaction events in response.
	 */
	showEvents?: boolean;

	/**
	 * Show object changes in response.
	 */
	showObjectChanges?: boolean;
}
