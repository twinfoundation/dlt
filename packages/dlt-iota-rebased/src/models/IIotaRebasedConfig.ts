// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClientOptions } from "@iota/iota-sdk/client";

/**
 * Configuration for IOTA.
 */
export interface IIotaRebasedConfig {
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
}
