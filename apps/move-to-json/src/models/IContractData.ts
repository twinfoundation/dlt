// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface for contract data stored in compiled-modules.json
 */
export interface IContractData {
	/**
	 * Package ID generated during build
	 */
	packageId: string;
	/**
	 * Base64-encoded package bytecode
	 */
	package: string;
	/**
	 * Package ID from actual deployment
	 */
	deployedPackageId?: string | null;
	/**
	 * UpgradeCap object ID for package upgrades
	 */
	upgradeCap?: string | null;
}
