// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaTransactionBlockResponse } from "@iota/iota-sdk/client";
import type { Transaction } from "@iota/iota-sdk/transactions";

/**
 * Options for NFT transactions.
 */
export interface IIotaRebasedNftTransactionOptions {
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

/**
 * Response from an NFT transaction.
 */
export interface IIotaNftTransactionResponse extends IotaTransactionBlockResponse {
	/**
	 * The created object reference if this was a mint operation.
	 */
	createdObject?: {
		objectId: string;
	};
}
