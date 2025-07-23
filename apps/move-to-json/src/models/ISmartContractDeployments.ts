// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IContractData } from "./IContractData";

/**
 * Interface for the smart-contract-deployments.json structure, mapping each network to its contract data.
 */
export interface ISmartContractDeployments {
	/**
	 * Contract data for the testnet network.
	 */
	testnet?: IContractData;
	/**
	 * Contract data for the devnet network.
	 */
	devnet?: IContractData;
	/**
	 * Contract data for the mainnet network.
	 */
	mainnet?: IContractData;
}
