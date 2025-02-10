// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IClientOptions } from "@iota/sdk-wasm/node/lib/index.js";

/**
 * Configuration for IOTA.
 */
export interface IIotaStardustConfig {
	/**
	 * The configuration for the client.
	 */
	clientOptions: IClientOptions;

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
	 * The bech32 human readable part for the addresses.
	 * @default iota
	 */
	bech32Hrp?: string;

	/**
	 * The length of time to wait for the inclusion of a transaction in seconds.
	 * @default 60
	 */
	inclusionTimeoutSeconds?: number;
}
