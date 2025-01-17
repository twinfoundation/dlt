// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface for compiled module items
 */
export interface ICompiledModules {
	/**
	 * The compiled module items.
	 */
	[contractName: string]: {
		/**
		 * The package ID.
		 */
		packageId: string;

		/**
		 * The package data.
		 */
		package: string | string[];
	};
}
