// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IContractData } from "./IContractData";
import type { NetworkTypes } from "./networkTypes";

/**
 * Type for the contracts file structure.
 * Maps each network type to its optional contract data.
 */
export type IContractFile = {
	[K in NetworkTypes]?: IContractData;
};
