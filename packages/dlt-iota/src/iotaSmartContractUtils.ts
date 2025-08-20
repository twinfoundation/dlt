// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClient } from "@iota/iota-sdk/client";
import { Transaction } from "@iota/iota-sdk/transactions";
import { GeneralError } from "@twin.org/core";
import type { ILoggingConnector } from "@twin.org/logging-models";
import type { IVaultConnector } from "@twin.org/vault-models";
import { Iota } from "./iota";
import type { IIotaConfig } from "./models/IIotaConfig";

/**
 * Utility class providing common smart contract operations for IOTA-based contracts.
 * This class uses composition pattern to provide shared functionality without inheritance complexity.
 */
export class IotaSmartContractUtils {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = "IotaSmartContractUtils";

	/**
	 * Migrate a smart contract object to the current version using admin privileges.
	 * This is a generic migration method that works with any IOTA smart contract.
	 * @param config The IOTA configuration.
	 * @param client The IOTA client instance.
	 * @param vaultConnector The vault connector for key management.
	 * @param logging Optional logging connector.
	 * @param gasBudget The gas budget for the transaction.
	 * @param identity The identity of the controller with admin privileges.
	 * @param objectId The ID of the object to migrate.
	 * @param getModuleName Function to get the module name for the contract.
	 * @param getPackageId Function to get the package ID for the contract.
	 * @param getAdminCapId Function to get the AdminCap object ID.
	 * @param getMigrationStateId Function to get the MigrationState object ID.
	 * @param getPackageControllerAddress Function to get the package controller address.
	 * @returns Promise that resolves when migration is complete.
	 */
	public static async migrateSmartContract(
		config: IIotaConfig,
		client: IotaClient,
		vaultConnector: IVaultConnector,
		logging: ILoggingConnector | undefined,
		gasBudget: number,
		identity: string,
		objectId: string,
		getModuleName: () => string,
		getPackageId: () => string,
		getAdminCapId: (identity: string) => Promise<string>,
		getMigrationStateId: (identity: string) => Promise<string>,
		getPackageControllerAddress: (identity: string) => Promise<string>
	): Promise<void> {
		try {
			const txb = new Transaction();
			txb.setGasBudget(gasBudget);

			const packageId = getPackageId();
			const moduleName = getModuleName();

			// Get admin address for the transaction
			const adminAddress = await getPackageControllerAddress(identity);

			// Get the required object IDs
			const adminCapId = await getAdminCapId(identity);
			const migrationStateId = await getMigrationStateId(identity);

			// Build the migration target based on object type
			const migrationTarget = `${packageId}::${moduleName}::migrate_nft`;

			txb.moveCall({
				target: migrationTarget,
				arguments: [txb.object(adminCapId), txb.object(migrationStateId), txb.object(objectId)]
			});

			const result = await Iota.prepareAndPostTransaction(
				config,
				vaultConnector,
				logging,
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
	 * @param logging Optional logging connector.
	 * @param gasBudget The gas budget for the transaction.
	 * @param identity The identity of the controller with admin privileges.
	 * @param getModuleName Function to get the module name for the contract.
	 * @param getPackageId Function to get the package ID for the contract.
	 * @param getAdminCapId Function to get the AdminCap object ID.
	 * @param getMigrationStateId Function to get the MigrationState object ID.
	 * @param getPackageControllerAddress Function to get the package controller address.
	 * @returns Promise that resolves when migration is enabled.
	 */
	public static async enableMigration(
		config: IIotaConfig,
		client: IotaClient,
		vaultConnector: IVaultConnector,
		logging: ILoggingConnector | undefined,
		gasBudget: number,
		identity: string,
		getModuleName: () => string,
		getPackageId: () => string,
		getAdminCapId: (identity: string) => Promise<string>,
		getMigrationStateId: (identity: string) => Promise<string>,
		getPackageControllerAddress: (identity: string) => Promise<string>
	): Promise<void> {
		try {
			const txb = new Transaction();
			txb.setGasBudget(gasBudget);

			const packageId = getPackageId();
			const moduleName = getModuleName();

			// Get admin address for the transaction
			const adminAddress = await getPackageControllerAddress(identity);

			// Get the required object IDs
			const adminCapId = await getAdminCapId(identity);
			const migrationStateId = await getMigrationStateId(identity);

			txb.moveCall({
				target: `${packageId}::${moduleName}::enable_migration`,
				arguments: [txb.object(adminCapId), txb.object(migrationStateId)]
			});

			const result = await Iota.prepareAndPostTransaction(
				config,
				vaultConnector,
				logging,
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
	 * @param logging Optional logging connector.
	 * @param gasBudget The gas budget for the transaction.
	 * @param identity The identity of the controller with admin privileges.
	 * @param getModuleName Function to get the module name for the contract.
	 * @param getPackageId Function to get the package ID for the contract.
	 * @param getAdminCapId Function to get the AdminCap object ID.
	 * @param getMigrationStateId Function to get the MigrationState object ID.
	 * @param getPackageControllerAddress Function to get the package controller address.
	 * @returns Promise that resolves when migration is disabled.
	 */
	public static async disableMigration(
		config: IIotaConfig,
		client: IotaClient,
		vaultConnector: IVaultConnector,
		logging: ILoggingConnector | undefined,
		gasBudget: number,
		identity: string,
		getModuleName: () => string,
		getPackageId: () => string,
		getAdminCapId: (identity: string) => Promise<string>,
		getMigrationStateId: (identity: string) => Promise<string>,
		getPackageControllerAddress: (identity: string) => Promise<string>
	): Promise<void> {
		try {
			const txb = new Transaction();
			txb.setGasBudget(gasBudget);

			const packageId = getPackageId();
			const moduleName = getModuleName();

			// Get admin address for the transaction
			const adminAddress = await getPackageControllerAddress(identity);

			// Get the required object IDs
			const adminCapId = await getAdminCapId(identity);
			const migrationStateId = await getMigrationStateId(identity);

			txb.moveCall({
				target: `${packageId}::${moduleName}::disable_migration`,
				arguments: [txb.object(adminCapId), txb.object(migrationStateId)]
			});

			const result = await Iota.prepareAndPostTransaction(
				config,
				vaultConnector,
				logging,
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
}
