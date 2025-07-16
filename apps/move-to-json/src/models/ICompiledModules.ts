// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface for compiled module items
 */
export interface ICompiledModules {
	/**
	 * Network-specific compiled module data
	 */
	testnet: {
		/**
		 * The package ID.
		 */
		packageId: string;

		/**
		 * The package data.
		 */
		package: string | string[];

		/**
		 * The deployed package ID (null if not deployed).
		 */
		deployedPackageId: string | null;
	};
	/**
	 * Devnet network compiled module data
	 */
	devnet: {
		/**
		 * The package ID.
		 */
		packageId: string;

		/**
		 * The package data.
		 */
		package: string | string[];

		/**
		 * The deployed package ID (null if not deployed).
		 */
		deployedPackageId: string | null;
	};
	/**
	 * Mainnet network compiled module data
	 */
	mainnet: {
		/**
		 * The package ID.
		 */
		packageId: string;

		/**
		 * The package data.
		 */
		package: string | string[];

		/**
		 * The deployed package ID (null if not deployed).
		 */
		deployedPackageId: string | null;
	};
}
