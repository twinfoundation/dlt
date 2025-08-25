// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { bcs } from "@iota/bcs";
import type { IotaClient } from "@iota/iota-sdk/client";
import { Transaction } from "@iota/iota-sdk/transactions";
import { GeneralError, Is, StringHelper } from "@twin.org/core";
import type { ILoggingComponent } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import type { IVaultConnector } from "@twin.org/vault-models";
import type { IWalletConnector } from "@twin.org/wallet-models";
import { Iota } from "./iota";
import type { IIotaConfig } from "./models/IIotaConfig";
import type { ISmartContractDeployments } from "./models/ISmartContractDeployments";
import type { NetworkTypes } from "./models/networkTypes";

/**
 * Utility class providing common smart contract operations for IOTA-based contracts.
 * This class uses composition pattern to provide shared functionality without inheritance complexity.
 */
export class IotaSmartContractUtils {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<IotaSmartContractUtils>();

	/**
	 * Migrate a smart contract object to the current version using admin privileges.
	 * This is a generic migration method that works with any IOTA smart contract.
	 * @param config The IOTA configuration.
	 * @param client The IOTA client instance.
	 * @param vaultConnector The vault connector for key management.
	 * @param walletConnector The wallet connector for address generation.
	 * @param logging Optional logging component.
	 * @param gasBudget The gas budget for the transaction.
	 * @param identity The identity of the controller with admin privileges.
	 * @param objectId The ID of the object to migrate.
	 * @param namespace The contract namespace (e.g., "nft", "verifiable_storage").
	 * @param packageId The deployed package ID for the contract.
	 * @param deploymentConfig The deployment configuration containing object IDs.
	 * @param walletAddressIndex Optional wallet address index for the controller.
	 * @returns Promise that resolves when migration is complete.
	 */
	public static async migrateSmartContract(
		config: IIotaConfig,
		client: IotaClient,
		vaultConnector: IVaultConnector,
		walletConnector: IWalletConnector,
		logging: ILoggingComponent | undefined,
		gasBudget: number,
		identity: string,
		objectId: string,
		namespace: string,
		packageId: string,
		deploymentConfig: ISmartContractDeployments,
		walletAddressIndex?: number
	): Promise<void> {
		try {
			const txb = new Transaction();
			txb.setGasBudget(gasBudget);

			const moduleName = this.getModuleName(namespace);

			// Get admin address for the transaction
			const adminAddress = await this.getPackageControllerAddress(
				walletConnector,
				identity,
				walletAddressIndex
			);

			// Get the required object IDs from deployment config
			const { adminCapId, migrationStateId } = await this.getContractObjectIds(
				client,
				namespace,
				config.network as NetworkTypes,
				deploymentConfig,
				packageId,
				adminAddress
			);

			txb.moveCall({
				target: `${packageId}::${moduleName}::migrate_${moduleName}`,
				arguments: [txb.object(adminCapId), txb.object(migrationStateId), txb.object(objectId)]
			});

			const result = await Iota.prepareAndPostTransaction(
				config,
				vaultConnector,
				logging as ILoggingComponent,
				identity,
				client,
				adminAddress,
				txb,
				{
					dryRunLabel: config.enableCostLogging ? "migrate_object" : undefined
				}
			);

			if (result.effects?.status?.status !== "success") {
				throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "migrationFailed", {
					error: result.effects?.status?.error,
					objectId
				});
			}
		} catch (error) {
			throw new GeneralError(
				IotaSmartContractUtils.CLASS_NAME,
				"migrateSmartContractFailed",
				{ objectId },
				error
			);
		}
	}

	/**
	 * Enable migration operations using admin privileges.
	 * @param config The IOTA configuration.
	 * @param client The IOTA client instance.
	 * @param vaultConnector The vault connector for key management.
	 * @param walletConnector The wallet connector for address generation.
	 * @param logging Optional logging component.
	 * @param gasBudget The gas budget for the transaction.
	 * @param identity The identity of the controller with admin privileges.
	 * @param namespace The contract namespace (e.g., "nft", "verifiable_storage").
	 * @param packageId The deployed package ID for the contract.
	 * @param deploymentConfig The deployment configuration containing object IDs.
	 * @param walletAddressIndex Optional wallet address index for the controller.
	 * @returns Promise that resolves when migration is enabled.
	 */
	public static async enableMigration(
		config: IIotaConfig,
		client: IotaClient,
		vaultConnector: IVaultConnector,
		walletConnector: IWalletConnector,
		logging: ILoggingComponent | undefined,
		gasBudget: number,
		identity: string,
		namespace: string,
		packageId: string,
		deploymentConfig: ISmartContractDeployments,
		walletAddressIndex?: number
	): Promise<void> {
		try {
			const txb = new Transaction();
			txb.setGasBudget(gasBudget);

			const moduleName = this.getModuleName(namespace);

			// Get admin address for the transaction
			const adminAddress = await this.getPackageControllerAddress(
				walletConnector,
				identity,
				walletAddressIndex
			);

			// Get the required object IDs from deployment config
			const { adminCapId, migrationStateId } = await this.getContractObjectIds(
				client,
				namespace,
				config.network as NetworkTypes,
				deploymentConfig,
				packageId,
				adminAddress
			);

			txb.moveCall({
				target: `${packageId}::${moduleName}::enable_migration`,
				arguments: [txb.object(adminCapId), txb.object(migrationStateId)]
			});

			const result = await Iota.prepareAndPostTransaction(
				config,
				vaultConnector,
				logging as ILoggingComponent,
				identity,
				client,
				adminAddress,
				txb,
				{
					dryRunLabel: config.enableCostLogging ? "enable_migration" : undefined
				}
			);

			if (result.effects?.status?.status !== "success") {
				throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "enableMigrationFailed", {
					error: result.effects?.status?.error
				});
			}
		} catch (error) {
			throw new GeneralError(
				IotaSmartContractUtils.CLASS_NAME,
				"enableMigrationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Disable migration operations using admin privileges.
	 * @param config The IOTA configuration.
	 * @param client The IOTA client instance.
	 * @param vaultConnector The vault connector for key management.
	 * @param walletConnector The wallet connector for address generation.
	 * @param logging Optional logging component.
	 * @param gasBudget The gas budget for the transaction.
	 * @param identity The identity of the controller with admin privileges.
	 * @param namespace The contract namespace (e.g., "nft", "verifiable_storage").
	 * @param packageId The deployed package ID for the contract.
	 * @param deploymentConfig The deployment configuration containing object IDs.
	 * @param walletAddressIndex Optional wallet address index for the controller.
	 * @returns Promise that resolves when migration is disabled.
	 */
	public static async disableMigration(
		config: IIotaConfig,
		client: IotaClient,
		vaultConnector: IVaultConnector,
		walletConnector: IWalletConnector,
		logging: ILoggingComponent | undefined,
		gasBudget: number,
		identity: string,
		namespace: string,
		packageId: string,
		deploymentConfig: ISmartContractDeployments,
		walletAddressIndex?: number
	): Promise<void> {
		try {
			const txb = new Transaction();
			txb.setGasBudget(gasBudget);

			const moduleName = this.getModuleName(namespace);

			// Get admin address for the transaction
			const adminAddress = await this.getPackageControllerAddress(
				walletConnector,
				identity,
				walletAddressIndex
			);

			// Get the required object IDs from deployment config
			const { adminCapId, migrationStateId } = await this.getContractObjectIds(
				client,
				namespace,
				config.network as NetworkTypes,
				deploymentConfig,
				packageId,
				adminAddress
			);

			txb.moveCall({
				target: `${packageId}::${moduleName}::disable_migration`,
				arguments: [txb.object(adminCapId), txb.object(migrationStateId)]
			});

			const result = await Iota.prepareAndPostTransaction(
				config,
				vaultConnector,
				logging as ILoggingComponent,
				identity,
				client,
				adminAddress,
				txb,
				{
					dryRunLabel: config.enableCostLogging ? "disable_migration" : undefined
				}
			);

			if (result.effects?.status?.status !== "success") {
				throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "disableMigrationFailed", {
					error: result.effects?.status?.error
				});
			}
		} catch (error) {
			throw new GeneralError(
				IotaSmartContractUtils.CLASS_NAME,
				"disableMigrationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check if migration is currently active for a smart contract.
	 * @param config The IOTA configuration.
	 * @param client The IOTA client instance.
	 * @param namespace The contract namespace (e.g., "nft", "verifiable_storage").
	 * @param packageId The deployed package ID for the contract.
	 * @param deploymentConfig The deployment configuration containing object IDs.
	 * @param identity The identity for MigrationState discovery.
	 * @param walletConnector The wallet connector for address generation.
	 * @param walletAddressIndex Optional wallet address index.
	 * @returns True if migration is enabled, false otherwise.
	 */
	public static async isMigrationActive(
		config: IIotaConfig,
		client: IotaClient,
		namespace: string,
		packageId: string,
		deploymentConfig: ISmartContractDeployments,
		identity: string,
		walletConnector: IWalletConnector,
		walletAddressIndex?: number
	): Promise<boolean> {
		try {
			// Get admin address for discovery
			const adminAddress = await this.getPackageControllerAddress(
				walletConnector,
				identity,
				walletAddressIndex
			);

			// Get the migration state ID
			const { migrationStateId } = await this.getContractObjectIds(
				client,
				namespace,
				config.network as NetworkTypes,
				deploymentConfig,
				packageId,
				adminAddress
			);

			const migrationStateResponse = await client.getObject({
				id: migrationStateId,
				options: {
					showContent: true,
					showType: true
				}
			});

			if (!migrationStateResponse.data?.content) {
				throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "migrationStateNotReadable", {
					migrationStateId
				});
			}

			const content = migrationStateResponse.data.content;
			if (content.dataType === "moveObject" && Is.objectValue(content.fields)) {
				const fields = content.fields as { enabled: boolean };
				return Is.boolean(fields.enabled) ? fields.enabled : false;
			}

			return false;
		} catch (error) {
			throw new GeneralError(
				IotaSmartContractUtils.CLASS_NAME,
				"isMigrationActiveFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Get the current contract version from the deployed smart contract.
	 * @param config The IOTA configuration.
	 * @param client The IOTA client instance.
	 * @param namespace The contract namespace (e.g., "nft", "verifiable_storage").
	 * @param packageId The deployed package ID for the contract.
	 * @param identity The identity for package controller address.
	 * @param walletConnector The wallet connector for address generation.
	 * @param walletAddressIndex Optional wallet address index.
	 * @returns The current version number of the contract.
	 */
	public static async getCurrentContractVersion(
		config: IIotaConfig,
		client: IotaClient,
		namespace: string,
		packageId: string,
		identity: string,
		walletConnector: IWalletConnector,
		walletAddressIndex?: number
	): Promise<number> {
		try {
			const tx = new Transaction();
			const moduleName = this.getModuleName(namespace);

			tx.moveCall({
				target: `${packageId}::${moduleName}::get_current_version`,
				arguments: []
			});

			const controllerAddress = await this.getPackageControllerAddress(
				walletConnector,
				identity,
				walletAddressIndex
			);

			const result = await client.devInspectTransactionBlock({
				sender: controllerAddress,
				transactionBlock: tx
			});

			if (
				Is.arrayValue(result.results) &&
				Is.object(result.results[0]) &&
				Is.arrayValue<Uint8Array>(result.results[0].returnValues)
			) {
				const versionBytes = result.results[0].returnValues[0];

				// Convert to Uint8Array if it's a regular array
				const byteData = versionBytes[0];
				if (!Is.arrayValue(byteData) && !Is.uint8Array(byteData)) {
					throw new GeneralError(this.CLASS_NAME, "invalidVersionData");
				}

				// Convert to Uint8Array for BCS parsing
				const uint8Data = Is.uint8Array(byteData) ? byteData : new Uint8Array(byteData);

				// The version is returned as a u64, decode it from bytes using BCS
				// IOTA Move contracts return data in BCS format
				const version = Number(bcs.u64().parse(uint8Data));
				return version;
			}

			throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "getCurrentContractVersionNoData", {
				resultExists: Is.arrayValue(result.results),
				resultLength: Is.arrayValue(result.results) ? result.results.length : 0,
				hasReturnValues: Is.arrayValue(result.results?.[0]?.returnValues)
			});
		} catch (error) {
			throw new GeneralError(
				IotaSmartContractUtils.CLASS_NAME,
				"getCurrentContractVersionFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Validate that an object version is compatible with the current contract.
	 * @param config The IOTA configuration.
	 * @param client The IOTA client instance.
	 * @param namespace The contract namespace (e.g., "nft", "verifiable_storage").
	 * @param packageId The deployed package ID for the contract.
	 * @param identity The identity for version checking.
	 * @param objectId The object ID to validate.
	 * @param walletConnector The wallet connector for address generation.
	 * @param versionExtractor Function to extract version from object content.
	 * @param walletAddressIndex Optional wallet address index.
	 * @returns True if the object version is compatible, false otherwise.
	 */
	public static async validateObjectVersion<T>(
		config: IIotaConfig,
		client: IotaClient,
		namespace: string,
		packageId: string,
		identity: string,
		objectId: string,
		walletConnector: IWalletConnector,
		versionExtractor: (content: T) => number,
		walletAddressIndex?: number
	): Promise<boolean> {
		try {
			// Get current contract version
			const currentVersion = await this.getCurrentContractVersion(
				config,
				client,
				namespace,
				packageId,
				identity,
				walletConnector,
				walletAddressIndex
			);

			// Get object version
			const objectResponse = await client.getObject({
				id: objectId,
				options: {
					showContent: true,
					showType: true
				}
			});

			if (!objectResponse.data?.content) {
				throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "objectNotReadable", {
					objectId
				});
			}

			const content = objectResponse.data.content;
			if (content.dataType === "moveObject" && Is.objectValue(content.fields)) {
				const objectVersion = versionExtractor(content as T);
				return objectVersion <= currentVersion;
			}

			throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "objectInvalidFormat", {
				objectId,
				content
			});
		} catch (error) {
			throw new GeneralError(
				IotaSmartContractUtils.CLASS_NAME,
				"validateObjectVersionFailed",
				{ objectId },
				error
			);
		}
	}

	/**
	 * Get the module name for a given namespace.
	 * @param namespace The contract namespace.
	 * @returns The module name in snake_case format.
	 * @internal
	 */
	private static getModuleName(namespace: string): string {
		// Convert namespace to snake_case for module name
		return StringHelper.snakeCase(namespace);
	}

	/**
	 * Get the package controller address for transactions.
	 * @param walletConnector The wallet connector for address generation.
	 * @param identity The identity to use.
	 * @param addressIndex Optional address index to use.
	 * @returns The controller address.
	 * @internal
	 */
	private static async getPackageControllerAddress(
		walletConnector: IWalletConnector,
		identity: string,
		addressIndex = 0
	): Promise<string> {
		const addresses = await walletConnector.getAddresses(identity, 0, addressIndex, 1);
		return addresses[0];
	}

	/**
	 * Get contract object IDs (AdminCap and MigrationState) from deployment config with fallback discovery.
	 * @param client The IOTA client instance.
	 * @param namespace The contract namespace.
	 * @param network The network name.
	 * @param deploymentConfig The deployment configuration.
	 * @param packageId The package ID.
	 * @param adminAddress The admin address for object discovery.
	 * @returns Object containing adminCapId and migrationStateId.
	 * @internal
	 */
	private static async getContractObjectIds(
		client: IotaClient,
		namespace: string,
		network: NetworkTypes,
		deploymentConfig: ISmartContractDeployments,
		packageId: string,
		adminAddress: string
	): Promise<{ adminCapId: string; migrationStateId: string }> {
		try {
			// First try to load from deployment JSON
			const networkConfig = deploymentConfig[network];
			if (Is.objectValue(networkConfig)) {
				const migrationStateId = networkConfig.migrationStateId;

				// AdminCap must be discovered from blockchain (not stored in JSON)
				const adminCapId = await this.discoverAdminCap(client, packageId, namespace, adminAddress);

				if (Is.stringValue(migrationStateId) && Is.stringValue(adminCapId)) {
					return { adminCapId, migrationStateId };
				}
			}

			// Fallback: discover both from blockchain
			return await this.discoverContractObjectsFromBlockchain(
				client,
				packageId,
				namespace,
				adminAddress
			);
		} catch (error) {
			throw new GeneralError(
				IotaSmartContractUtils.CLASS_NAME,
				"getContractObjectIdsFailed",
				{ namespace, network, packageId },
				error
			);
		}
	}

	/**
	 * Discover AdminCap object from the blockchain.
	 * @param client The IOTA client instance.
	 * @param packageId The package ID.
	 * @param namespace The contract namespace.
	 * @param adminAddress The admin address.
	 * @returns The AdminCap object ID.
	 * @internal
	 */
	private static async discoverAdminCap(
		client: IotaClient,
		packageId: string,
		namespace: string,
		adminAddress: string
	): Promise<string> {
		const adminCapType = `${packageId}::${this.getModuleName(namespace)}::AdminCap`;

		const adminCapObjects = await client.getOwnedObjects({
			owner: adminAddress,
			filter: {
				StructType: adminCapType
			},
			options: {
				showContent: true,
				showType: true
			}
		});

		if (Is.arrayValue(adminCapObjects.data) && adminCapObjects.data.length > 0) {
			const adminCapObject = adminCapObjects.data[0];
			if (Is.stringValue(adminCapObject.data?.objectId)) {
				return adminCapObject.data.objectId;
			}
		}

		throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "adminCapNotFound", {
			adminCapType,
			adminAddress
		});
	}

	/**
	 * Discover contract objects from blockchain as fallback.
	 * @param client The IOTA client instance.
	 * @param packageId The package ID.
	 * @param namespace The contract namespace.
	 * @param adminAddress The admin address.
	 * @returns Object containing adminCapId and migrationStateId.
	 * @internal
	 */
	private static async discoverContractObjectsFromBlockchain(
		client: IotaClient,
		packageId: string,
		namespace: string,
		adminAddress: string
	): Promise<{ adminCapId: string; migrationStateId: string }> {
		// Discover AdminCap
		const adminCapId = await this.discoverAdminCap(client, packageId, namespace, adminAddress);

		// Discover MigrationState through transaction history
		const migrationStateType = `${packageId}::${this.getModuleName(namespace)}::MigrationState`;

		const transactions = await client.queryTransactionBlocks({
			filter: {
				FromAddress: adminAddress
			},
			options: {
				showObjectChanges: true,
				showEffects: true
			},
			limit: 20,
			order: "descending"
		});

		// Look for MigrationState object creation in transaction history
		let migrationStateId: string | undefined;
		for (const tx of transactions.data) {
			const objectChanges = tx.objectChanges;
			if (Is.arrayValue(objectChanges)) {
				for (const change of objectChanges) {
					if (
						(change.type === "created" || change.type === "mutated") &&
						"objectType" in change &&
						change.objectType === migrationStateType
					) {
						migrationStateId = change.objectId;
						break;
					}
				}
				if (migrationStateId) {
					break;
				}
			}
		}

		if (!migrationStateId) {
			throw new GeneralError(IotaSmartContractUtils.CLASS_NAME, "migrationStateNotFound", {
				migrationStateType,
				adminAddress
			});
		}

		return { adminCapId, migrationStateId };
	}
}
