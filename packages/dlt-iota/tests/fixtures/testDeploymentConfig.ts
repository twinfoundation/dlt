// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ISmartContractDeployments } from "../../src/models/ISmartContractDeployments";

/**
 * Test deployment configurations for IotaSmartContractUtils testing
 */

export const TEST_NAMESPACE = "nft";
export const TEST_IDENTITY = "test-identity";
export const TEST_GAS_BUDGET = 50000000;

/**
 * Complete test deployment configuration
 */
export const testDeploymentConfig: ISmartContractDeployments = {
	testnet: {
		packageId: "0x1234567890abcdef1234567890abcdef12345678",
		packageBytecode: "mock-bytecode-data-for-testing",
		deployedPackageId: "0x1234567890abcdef1234567890abcdef12345678",
		upgradeCapabilityId: "0xupgrade1234567890abcdef1234567890abcdef",
		migrationStateId: "0xfedcba0987654321fedcba0987654321fedcba09"
	},
	devnet: {
		packageId: "0xdevnet567890abcdef1234567890abcdef123456",
		packageBytecode: "mock-bytecode-data-for-devnet-testing",
		deployedPackageId: "0xdevnet567890abcdef1234567890abcdef123456",
		upgradeCapabilityId: "0xdevnetupgrade1234567890abcdef12345678",
		migrationStateId: "0xdevnetmigration7654321fedcba0987654321"
	}
};

/**
 * Incomplete deployment configuration (missing migrationStateId)
 */
export const incompleteDeploymentConfig: ISmartContractDeployments = {
	testnet: {
		packageId: "0x1234567890abcdef1234567890abcdef12345678",
		packageBytecode: "mock-bytecode-data-for-testing",
		deployedPackageId: "0x1234567890abcdef1234567890abcdef12345678",
		upgradeCapabilityId: "0xupgrade1234567890abcdef1234567890abcdef"
		// migrationStateId missing - should trigger blockchain discovery
	}
};

/**
 * Empty deployment configuration
 */
export const emptyDeploymentConfig: ISmartContractDeployments = {};
