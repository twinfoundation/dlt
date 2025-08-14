// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface for contract data stored in smart-contract-deployments.json
 */
export interface IContractData {
	/**
	 * Package ID generated during build
	 */
	packageId: string;
	/**
	 * Base64-encoded package bytecode
	 */
	packageBytecode: string | string[];
	/**
	 * Package ID from actual deployment
	 */
	deployedPackageId?: string;
	/**
	 * UpgradeCap object ID for package upgrades
	 */
	upgradeCapabilityId?: string;
	/**
	 * Migration state ID for tracking contract migrations
	 */
	migrationStateId?: string;
}
