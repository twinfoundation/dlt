// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface for the gas station execute transaction response.
 */
export interface IGasStationExecuteResponse {
	/**
	 * The transaction effects from the IOTA network.
	 * This contains the full IOTA transaction effects object.
	 */
	effects: {
		/**
		 * Additional effects data from the IOTA network.
		 * This includes messageVersion, status, executedEpoch, gasUsed, etc.
		 */
		[key: string]: unknown;

		/**
		 * The transaction digest.
		 */
		transactionDigest: string;
	};

	/**
	 * Error message if the request failed.
	 */
	error?: string | null;
}
