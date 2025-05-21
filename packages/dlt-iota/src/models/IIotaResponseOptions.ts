// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaTransactionBlockResponseOptions } from "@iota/iota-sdk/client";

/**
 * Configuration for IOTA.
 */
export interface IIotaResponseOptions extends IotaTransactionBlockResponseOptions {
	/**
	 * Wait for confirmation of the transaction.
	 * @default true
	 */
	waitForConfirmation?: boolean;

	/**
	 * Dry run the transaction with this label, if not set no dry run will occur.
	 */
	dryRunLabel?: string;
}
