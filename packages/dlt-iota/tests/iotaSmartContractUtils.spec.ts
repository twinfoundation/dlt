// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClient } from "@iota/iota-sdk/client";
import type { IWalletConnector } from "@twin.org/wallet-models";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { TEST_CLIENT_OPTIONS, TEST_NETWORK } from "./setupTestEnv";
import { IotaSmartContractUtils } from "../src/iotaSmartContractUtils";
import {
	testDeploymentConfig,
	TEST_NAMESPACE,
	TEST_IDENTITY
} from "./fixtures/testDeploymentConfig";
import type { IIotaConfig } from "../src/models/IIotaConfig";
import type { NetworkTypes } from "../src/models/networkTypes";

const MOCK_PACKAGE_ID = "0x1234567890abcdef1234567890abcdef12345678";
const MOCK_ADMIN_ADDRESS = "0x5555555555555555555555555555555555555555";

// Version extractor function for object version validation
const mockVersionExtractor = (content: { fields?: { version?: number } }): number =>
	content?.fields?.version ?? 0;

describe("IotaSmartContractUtils - Phase 2 Methods", () => {
	// Test configuration
	const testConfig: IIotaConfig = {
		clientOptions: TEST_CLIENT_OPTIONS,
		network: TEST_NETWORK as NetworkTypes,
		enableCostLogging: false
	};

	// Mock clients
	const mockClient = {
		devInspectTransactionBlock: vi.fn(),
		getObject: vi.fn(),
		getOwnedObjects: vi.fn(),
		queryTransactionBlocks: vi.fn()
	};

	const mockWalletConnector = {
		getAddresses: vi.fn()
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mock returns
		mockWalletConnector.getAddresses.mockResolvedValue([MOCK_ADMIN_ADDRESS]);

		// Setup default getOwnedObjects mock for AdminCap discovery
		mockClient.getOwnedObjects.mockResolvedValue({
			data: [
				{
					data: {
						objectId: "0xadmincap123456789abcdef1234567890abcdef12",
						version: "1",
						digest: "DigestHash123"
					}
				}
			],
			hasNextPage: false
		} as unknown);
	});

	describe("getCurrentContractVersion", () => {
		test("can get current contract version", async () => {
			// Create a simple mock response directly in the test
			const testMockVersionResponse = {
				results: [
					{
						returnValues: [
							[new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0])] // BCS encoded u64 value: 1
						]
					}
				],
				effects: {
					status: { status: "success" as const }
				},
				events: []
			};

			// Ensure the mock returns the response properly
			mockClient.devInspectTransactionBlock.mockResolvedValue(testMockVersionResponse);

			const version = await IotaSmartContractUtils.getCurrentContractVersion(
				testConfig,
				mockClient as unknown as IotaClient,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				TEST_IDENTITY,
				mockWalletConnector as unknown as IWalletConnector
			);

			expect(version).toBe(1);
			expect(mockClient.devInspectTransactionBlock).toHaveBeenCalled();
		});

		test("throws error when no version data returned", async () => {
			mockClient.devInspectTransactionBlock.mockResolvedValue({
				results: []
			} as unknown);

			await expect(
				IotaSmartContractUtils.getCurrentContractVersion(
					testConfig,
					mockClient as unknown as IotaClient,
					TEST_NAMESPACE,
					MOCK_PACKAGE_ID,
					TEST_IDENTITY,
					mockWalletConnector as unknown as IWalletConnector
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GeneralError",
					source: "IotaSmartContractUtils",
					message: "iotaSmartContractUtils.getCurrentContractVersionFailed"
				})
			);
		});
	});

	describe("validateObjectVersion", () => {
		test("can validate object version", async () => {
			// Create mock responses directly in the test
			const testMockVersionResponse = {
				results: [
					{
						returnValues: [
							[new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0])] // Contract version: 1
						]
					}
				],
				effects: { status: { status: "success" as const } },
				events: []
			};

			const testMockObjectResponse = {
				data: {
					objectId: "0x9876543210fedcba9876543210fedcba98765432",
					version: "1",
					digest: "AoZh3hs5Y6z6fmSJZZUksZBPVXYksLpJLstSPCLSKgKF",
					content: {
						dataType: "moveObject" as const,
						type: "0x2::test::TestObject",
						fields: {
							version: 1
						}
					}
				}
			};

			mockClient.devInspectTransactionBlock.mockResolvedValue(testMockVersionResponse);
			mockClient.getObject.mockResolvedValue(testMockObjectResponse);

			const isValid = await IotaSmartContractUtils.validateObjectVersion(
				testConfig,
				mockClient as unknown as IotaClient,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				TEST_IDENTITY,
				"0x9876543210fedcba9876543210fedcba98765432",
				mockWalletConnector as unknown as IWalletConnector,
				mockVersionExtractor
			);

			expect(isValid).toBe(true);
			expect(mockClient.devInspectTransactionBlock).toHaveBeenCalled();
			expect(mockClient.getObject).toHaveBeenCalled();
		});

		test("returns false when object version is newer than contract", async () => {
			// Contract version is 1 (from mockVersionResponse)
			const testMockVersionResponse = {
				results: [
					{
						returnValues: [
							[new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0])] // BCS encoded u64 value: 1
						]
					}
				],
				effects: {
					status: { status: "success" as const }
				},
				events: []
			};

			mockClient.devInspectTransactionBlock.mockResolvedValue(testMockVersionResponse);

			// Object version is 2 (newer than contract)
			const newerObjectResponse = {
				data: {
					objectId: "0x9876543210fedcba9876543210fedcba98765432",
					version: "1",
					digest: "AoZh3hs5Y6z6fmSJZZUksZBPVXYksLpJLstSPCLSKgKF",
					content: {
						dataType: "moveObject" as const,
						type: "0x2::test::TestObject",
						fields: {
							version: 2 // Newer than contract version (1)
						}
					}
				}
			};
			mockClient.getObject.mockResolvedValue(newerObjectResponse as unknown);

			const isValid = await IotaSmartContractUtils.validateObjectVersion(
				testConfig,
				mockClient as unknown as IotaClient,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				TEST_IDENTITY,
				"0x9876543210fedcba9876543210fedcba98765432",
				mockWalletConnector as unknown as IWalletConnector,
				mockVersionExtractor
			);

			expect(isValid).toBe(false);
		});
	});

	describe("isMigrationActive", () => {
		test("returns true when migration is enabled", async () => {
			const testMigrationStateEnabledResponse = {
				data: {
					objectId: "0x1234567890abcdef1234567890abcdef12345678",
					version: "1",
					digest: "DigestHash123",
					content: {
						dataType: "moveObject" as const,
						type: "0x2::test::MigrationState",
						fields: {
							enabled: true
						}
					}
				}
			};

			mockClient.getObject.mockResolvedValue(testMigrationStateEnabledResponse as unknown);

			const isActive = await IotaSmartContractUtils.isMigrationActive(
				testConfig,
				mockClient as unknown as IotaClient,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				testDeploymentConfig,
				TEST_IDENTITY,
				mockWalletConnector as unknown as IWalletConnector
			);

			expect(isActive).toBe(true);
			expect(mockClient.getObject).toHaveBeenCalled();
		});

		test("returns false when migration is disabled", async () => {
			const testMigrationStateDisabledResponse = {
				data: {
					objectId: "0x1234567890abcdef1234567890abcdef12345678",
					version: "1",
					digest: "DigestHash123",
					content: {
						dataType: "moveObject" as const,
						type: "0x2::test::MigrationState",
						fields: {
							fields: {
								enabled: false
							}
						}
					}
				}
			};

			mockClient.getObject.mockResolvedValue(testMigrationStateDisabledResponse as unknown);

			const isActive = await IotaSmartContractUtils.isMigrationActive(
				testConfig,
				mockClient as unknown as IotaClient,
				TEST_NAMESPACE,
				MOCK_PACKAGE_ID,
				testDeploymentConfig,
				TEST_IDENTITY,
				mockWalletConnector as unknown as IWalletConnector
			);

			expect(isActive).toBe(false);
			expect(mockClient.getObject).toHaveBeenCalled();
		});

		test("throws error when migration state not found", async () => {
			mockClient.getObject.mockResolvedValue({ data: null } as unknown);

			await expect(
				IotaSmartContractUtils.isMigrationActive(
					testConfig,
					mockClient as unknown as IotaClient,
					TEST_NAMESPACE,
					MOCK_PACKAGE_ID,
					testDeploymentConfig,
					TEST_IDENTITY,
					mockWalletConnector as unknown as IWalletConnector
				)
			).rejects.toThrow(
				expect.objectContaining({
					name: "GeneralError",
					source: "IotaSmartContractUtils"
				})
			);
		});
	});
});
