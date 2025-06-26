// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Response interface for gas station funding operations.
 */
export interface IGasStationFundingResponse {
	/**
	 * The transaction digest.
	 */
	transaction_digest?: string;
	/**
	 * Alternative digest field.
	 */
	digest?: string;
	/**
	 * Transaction effects.
	 */
	effects?: unknown;
	/**
	 * Transaction events.
	 */
	events?: unknown[];
	/**
	 * Object changes.
	 */
	objectChanges?: unknown[];
}
