// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IContractData } from "./IContractData";

/**
 * Interface for the contracts file structure.
 * The key is the network name, the value is the contract data for that network.
 */
export interface IContractFile {
	[network: string]: IContractData;
}
