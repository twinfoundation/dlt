// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClientOptions } from "@iota/iota-sdk/client";
import type { IGasStationConfig } from "./IGasStationConfig";

/**
 * Configuration for IOTA.
 */
export interface IIotaConfig {
	/**
	 * The configuration for the client.
	 */
	clientOptions: IotaClientOptions;

	/**
	 * The network the operations are being performed on.
	 */
	network: string;

	/**
	 * The id of the entry in the vault containing the mnemonic.
	 * @default mnemonic
	 */
	vaultMnemonicId?: string;

	/**
	 * The id of the entry in the vault containing the seed.
	 * @default seed
	 */
	vaultSeedId?: string;

	/**
	 * The coin type.
	 * @default IOTA 4218
	 */
	coinType?: number;

	/**
	 * The maximum range to scan for addresses.
	 * @default 1000
	 */
	maxAddressScanRange?: number;

	/**
	 * The length of time to wait for the inclusion of a transaction in seconds.
	 * @default 60
	 */
	inclusionTimeoutSeconds?: number;

	/**
	 * Gas station configuration for sponsored transactions.
	 * If provided, transactions will be processed through the gas station.
	 */
	gasStation?: IGasStationConfig;

	/**
	 * The default gas budget for all transactions (including sponsored and direct).
	 * @default 50000000
	 */
	gasBudget?: number;

	/**
	 * Enable cost logging for transactions.
	 * @default false
	 */
	enableCostLogging?: boolean;
}
