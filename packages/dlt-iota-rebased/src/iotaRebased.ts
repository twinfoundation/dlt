// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { IotaClient, type IotaTransactionBlockResponse } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { BaseError, Converter, GeneralError, Guards, type IError } from "@twin.org/core";
import { Bip39, Bip44, KeyType } from "@twin.org/crypto";
import { nameof } from "@twin.org/nameof";
import type { IVaultConnector } from "@twin.org/vault-models";
import type { IIotaNftTransactionResponse } from "./models/IIotaNftTransactionResponse";
import type { IIotaRebasedConfig } from "./models/IIotaRebasedConfig";
import type { IIotaRebasedNftTransactionOptions } from "./models/IIotaRebasedNftTransactionOptions";

/**
 * Class for performing operations on IOTA.
 */
export class IotaRebased {
	/**
	 * Default name for the mnemonic secret.
	 */
	public static readonly DEFAULT_MNEMONIC_SECRET_NAME: string = "mnemonic";

	/**
	 * Default name for the seed secret.
	 */
	public static readonly DEFAULT_SEED_SECRET_NAME: string = "seed";

	/**
	 * Default coin type.
	 */
	public static readonly DEFAULT_COIN_TYPE: number = 4218;

	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<IotaRebased>();

	/**
	 * Create a new SUI client.
	 * @param config The configuration.
	 * @returns The client instance.
	 */
	public static createClient(config: IIotaRebasedConfig): IotaClient {
		Guards.object(IotaRebased._CLASS_NAME, nameof(config), config);
		Guards.object(IotaRebased._CLASS_NAME, nameof(config.clientOptions), config.clientOptions);
		Guards.string(
			IotaRebased._CLASS_NAME,
			nameof(config.clientOptions.url),
			config.clientOptions.url
		);

		return new IotaClient(config.clientOptions);
	}

	/**
	 * Create configuration using defaults where necessary.
	 * @param config The configuration to populate.
	 */
	public static populateConfig(config: IIotaRebasedConfig): void {
		Guards.object<IIotaRebasedConfig["clientOptions"]>(
			IotaRebased._CLASS_NAME,
			nameof(config.clientOptions),
			config.clientOptions
		);

		config.vaultMnemonicId ??= IotaRebased.DEFAULT_MNEMONIC_SECRET_NAME;
		config.vaultSeedId ??= IotaRebased.DEFAULT_SEED_SECRET_NAME;
		config.coinType ??= IotaRebased.DEFAULT_COIN_TYPE;
	}

	/**
	 * Get addresses for the identity.
	 * @param seed The seed to use for generating addresses.
	 * @param config The configuration.
	 * @param accountIndex The account index to get the addresses for.
	 * @param startAddressIndex The start index for the addresses.
	 * @param count The number of addresses to generate.
	 * @param isInternal Whether the addresses are internal.
	 * @returns The list of addresses.
	 */
	public static getAddresses(
		seed: Uint8Array,
		config: IIotaRebasedConfig,
		accountIndex: number,
		startAddressIndex: number,
		count: number,
		isInternal?: boolean
	): string[] {
		Guards.object(IotaRebased._CLASS_NAME, nameof(config), config);
		Guards.integer(IotaRebased._CLASS_NAME, nameof(accountIndex), accountIndex);
		Guards.integer(IotaRebased._CLASS_NAME, nameof(startAddressIndex), startAddressIndex);
		Guards.integer(IotaRebased._CLASS_NAME, nameof(count), count);

		const addresses: string[] = [];

		for (let i = startAddressIndex; i < startAddressIndex + count; i++) {
			// Derive the keypair using the seed
			const keyPair = Bip44.keyPair(
				seed,
				KeyType.Ed25519,
				config.coinType ?? IotaRebased.DEFAULT_COIN_TYPE,
				accountIndex,
				isInternal ?? false,
				i
			);

			const keypair = Ed25519Keypair.fromSecretKey(keyPair.privateKey);
			addresses.push(keypair.getPublicKey().toIotaAddress());
		}

		return addresses;
	}

	/**
	 * Prepare and post a transaction.
	 * @param config The configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user to access the vault keys.
	 * @param client The client instance.
	 * @param options The transaction options.
	 * @param options.amount The amount to transfer.
	 * @param options.recipient The recipient address.
	 * @returns The transaction result.
	 */
	public static async prepareAndPostTransaction(
		config: IIotaRebasedConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		client: IotaClient,
		options: {
			amount: bigint;
			recipient: string;
		}
	): Promise<{ digest: string }> {
		const seed = await this.getSeed(config, vaultConnector, identity);
		const keyPair = Bip44.keyPair(
			seed,
			KeyType.Ed25519,
			config.coinType ?? IotaRebased.DEFAULT_COIN_TYPE,
			0,
			false,
			0
		);
		const keypair = Ed25519Keypair.fromSecretKey(keyPair.privateKey);

		const txb = new Transaction();
		const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(options.amount)]);
		txb.transferObjects([coin], txb.pure.address(options.recipient));

		try {
			const result = await client.signAndExecuteTransaction({
				transaction: txb,
				signer: keypair,
				requestType: "WaitForLocalExecution",
				options: {
					showEffects: true,
					showEvents: true,
					showObjectChanges: true
				}
			});

			return { digest: result.digest };
		} catch (error) {
			throw new GeneralError(
				IotaRebased._CLASS_NAME,
				"transactionFailed",
				undefined,
				IotaRebased.extractPayloadError(error)
			);
		}
	}

	/**
	 * Prepare and post an NFT transaction.
	 * @param config The configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user to access the vault keys.
	 * @param client The client instance.
	 * @param options The NFT transaction options.
	 * @returns The transaction response.
	 */
	public static async prepareAndPostNftTransaction(
		config: IIotaRebasedConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		client: IotaClient,
		options: IIotaRebasedNftTransactionOptions
	): Promise<IIotaNftTransactionResponse> {
		const seed = await this.getSeed(config, vaultConnector, identity);
		const keyPair = Bip44.keyPair(
			seed,
			KeyType.Ed25519,
			config.coinType ?? IotaRebased.DEFAULT_COIN_TYPE,
			0,
			false,
			0
		);
		const keypair = Ed25519Keypair.fromSecretKey(keyPair.privateKey);

		try {
			const response = await client.signAndExecuteTransaction({
				transaction: options.transaction,
				signer: keypair,
				requestType: "WaitForLocalExecution",
				options: {
					showEffects: options.showEffects ?? true,
					showEvents: options.showEvents ?? true,
					showObjectChanges: options.showObjectChanges ?? true
				}
			});

			// Extract created object for mint operations
			const createdObject = response.effects?.created?.[0]?.reference?.objectId
				? { objectId: response.effects.created[0].reference.objectId }
				: undefined;

			return {
				...response,
				createdObject
			};
		} catch (error) {
			throw new GeneralError(
				IotaRebased._CLASS_NAME,
				"nftTransactionFailed",
				undefined,
				IotaRebased.extractPayloadError(error)
			);
		}
	}

	/**
	 * Prepare and post a storage transaction.
	 * @param config The configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user to access the vault keys.
	 * @param client The client instance.
	 * @param options The storage transaction options.
	 * @returns The transaction response.
	 */
	public static async prepareAndPostStorageTransaction(
		config: IIotaRebasedConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		client: IotaClient,
		options: IIotaRebasedNftTransactionOptions
	): Promise<IotaTransactionBlockResponse> {
		const seed = await this.getSeed(config, vaultConnector, identity);
		const keyPair = Bip44.keyPair(
			seed,
			KeyType.Ed25519,
			config.coinType ?? IotaRebased.DEFAULT_COIN_TYPE,
			0,
			false,
			0
		);
		const keypair = Ed25519Keypair.fromSecretKey(keyPair.privateKey);

		try {
			const response = await client.signAndExecuteTransaction({
				transaction: options.transaction,
				signer: keypair,
				requestType: "WaitForLocalExecution",
				options: {
					showEffects: options.showEffects ?? true,
					showEvents: options.showEvents ?? true,
					showObjectChanges: options.showObjectChanges ?? true
				}
			});

			return response;
		} catch (error) {
			throw new GeneralError(
				IotaRebased._CLASS_NAME,
				"storageTransactionFailed",
				undefined,
				IotaRebased.extractPayloadError(error)
			);
		}
	}

	/**
	 * Get the seed from the vault.
	 * @param config The configuration to use.
	 * @param vaultConnector The vault connector to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @returns The seed.
	 */
	public static async getSeed(
		config: IIotaRebasedConfig,
		vaultConnector: IVaultConnector,
		identity: string
	): Promise<Uint8Array> {
		try {
			const seedBase64 = await vaultConnector.getSecret<string>(
				IotaRebased.buildSeedKey(identity, config)
			);
			return Converter.base64ToBytes(seedBase64);
		} catch {}

		const mnemonic = await vaultConnector.getSecret<string>(
			IotaRebased.buildMnemonicKey(identity, config)
		);

		return Bip39.mnemonicToSeed(mnemonic);
	}

	/**
	 * Extract error from SDK payload.
	 * Errors from the Sui SDK are usually not JSON strings but objects.
	 * @param error The error to extract.
	 * @returns The extracted error.
	 */
	public static extractPayloadError(error: unknown): IError {
		if (error && typeof error === "object") {
			const errObj = error as { code?: string; message?: string };

			if (errObj.code === "InsufficientGas") {
				return new GeneralError(IotaRebased._CLASS_NAME, "insufficientFunds");
			}

			return {
				name: "IOTA",
				message: errObj.message ?? "Unknown error"
			};
		} else if (typeof error === "string") {
			try {
				const parsedError = JSON.parse(error);
				return {
					name: "IOTA",
					message: parsedError.message ?? "Unknown error"
				};
			} catch {
				// The error string is not valid JSON
				return {
					name: "IOTA",
					message: error
				};
			}
		}

		return BaseError.fromError(error);
	}

	/**
	 * Get the key for storing the mnemonic.
	 * @param identity The identity to use.
	 * @param config The configuration.
	 * @returns The mnemonic key.
	 */
	public static buildMnemonicKey(identity: string, config: IIotaRebasedConfig): string {
		return `${identity}/${config.vaultMnemonicId ?? IotaRebased.DEFAULT_MNEMONIC_SECRET_NAME}`;
	}

	/**
	 * Get the key for storing the seed.
	 * @param identity The identity to use.
	 * @param config The configuration.
	 * @returns The seed key.
	 */
	public static buildSeedKey(identity: string, config: IIotaRebasedConfig): string {
		return `${identity}/${config.vaultSeedId ?? IotaRebased.DEFAULT_SEED_SECRET_NAME}`;
	}

	/**
	 * Check if the package exists on the network.
	 * @param client The client to use.
	 * @param packageId The package ID to check.
	 * @returns True if the package exists, false otherwise.
	 */
	public static async packageExistsOnNetwork(
		client: IotaClient,
		packageId: string
	): Promise<boolean> {
		try {
			const packageObject = await client.getObject({
				id: packageId,
				options: {
					showType: true
				}
			});

			if ("error" in packageObject) {
				if (packageObject?.error?.code === "notExists") {
					return false;
				}
				throw new GeneralError(IotaRebased._CLASS_NAME, "packageObjectError", {
					packageId,
					error: packageObject.error
				});
			}

			return true;
		} catch (error) {
			throw new GeneralError(IotaRebased._CLASS_NAME, "packageNotFoundOnNetwork", {
				packageId,
				error: IotaRebased.extractPayloadError(error)
			});
		}
	}
}
