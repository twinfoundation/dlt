// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { IotaClient, type IotaTransactionBlockResponse } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { BaseError, Converter, GeneralError, Guards, type IError } from "@twin.org/core";
import { Bip39, Bip44, KeyType } from "@twin.org/crypto";
import type { ILoggingConnector } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import type { IVaultConnector } from "@twin.org/vault-models";
import type { IIotaConfig } from "./models/IIotaConfig";
import type { IIotaDryRun } from "./models/IIotaDryRun";
import type { IIotaNftTransactionOptions } from "./models/IIotaNftTransactionOptions";
import type { IIotaNftTransactionResponse } from "./models/IIotaNftTransactionResponse";

/**
 * Class for performing operations on IOTA.
 */
export class Iota {
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
	 * Default scan range.
	 */
	public static readonly DEFAULT_SCAN_RANGE: number = 1000;

	/**
	 * Default inclusion timeout.
	 */
	public static readonly DEFAULT_INCLUSION_TIMEOUT: number = 60;

	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<Iota>();

	/**
	 * Create a new IOTA client.
	 * @param config The configuration.
	 * @returns The client instance.
	 */
	public static createClient(config: IIotaConfig): IotaClient {
		Guards.object(Iota._CLASS_NAME, nameof(config), config);
		Guards.object(Iota._CLASS_NAME, nameof(config.clientOptions), config.clientOptions);
		Guards.string(Iota._CLASS_NAME, nameof(config.clientOptions.url), config.clientOptions.url);

		return new IotaClient(config.clientOptions);
	}

	/**
	 * Create configuration using defaults where necessary.
	 * @param config The configuration to populate.
	 */
	public static populateConfig(config: IIotaConfig): void {
		Guards.object<IIotaConfig["clientOptions"]>(
			Iota._CLASS_NAME,
			nameof(config.clientOptions),
			config.clientOptions
		);

		config.vaultMnemonicId ??= Iota.DEFAULT_MNEMONIC_SECRET_NAME;
		config.vaultSeedId ??= Iota.DEFAULT_SEED_SECRET_NAME;
		config.coinType ??= Iota.DEFAULT_COIN_TYPE;
		config.inclusionTimeoutSeconds ??= Iota.DEFAULT_INCLUSION_TIMEOUT;
	}

	/**
	 * Get addresses for the identity.
	 * @param seed The seed to use for generating addresses.
	 * @param coinType The coin type to use.
	 * @param accountIndex The account index to get the addresses for.
	 * @param startAddressIndex The start index for the addresses.
	 * @param count The number of addresses to generate.
	 * @param isInternal Whether the addresses are internal.
	 * @returns The list of addresses.
	 */
	public static getAddresses(
		seed: Uint8Array,
		coinType: number,
		accountIndex: number,
		startAddressIndex: number,
		count: number,
		isInternal?: boolean
	): string[] {
		Guards.integer(Iota._CLASS_NAME, nameof(coinType), coinType);
		Guards.integer(Iota._CLASS_NAME, nameof(accountIndex), accountIndex);
		Guards.integer(Iota._CLASS_NAME, nameof(startAddressIndex), startAddressIndex);
		Guards.integer(Iota._CLASS_NAME, nameof(count), count);

		const addresses: string[] = [];

		for (let i = startAddressIndex; i < startAddressIndex + count; i++) {
			// Derive the keypair using the seed
			const keyPair = Bip44.keyPair(
				seed,
				KeyType.Ed25519,
				coinType ?? Iota.DEFAULT_COIN_TYPE,
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
	 * Get a key pair for the specified index.
	 * @param seed The seed to use for generating the key pair.
	 * @param coinType The coin type to use.
	 * @param accountIndex The account index to get the key pair for.
	 * @param addressIndex The address index to get the key pair for.
	 * @param isInternal Whether the address is internal.
	 * @returns The key pair containing private key and public key.
	 */
	public static getKeyPair(
		seed: Uint8Array,
		coinType: number,
		accountIndex: number,
		addressIndex: number,
		isInternal?: boolean
	): {
		privateKey: Uint8Array;
		publicKey: Uint8Array;
	} {
		Guards.integer(Iota._CLASS_NAME, nameof(coinType), coinType);
		Guards.integer(Iota._CLASS_NAME, nameof(accountIndex), accountIndex);
		Guards.integer(Iota._CLASS_NAME, nameof(addressIndex), addressIndex);

		const keyPair = Bip44.keyPair(
			seed,
			KeyType.Ed25519,
			coinType ?? Iota.DEFAULT_COIN_TYPE,
			accountIndex,
			isInternal ?? false,
			addressIndex
		);

		return keyPair;
	}

	/**
	 * Prepare and post a transaction.
	 * @param config The configuration.
	 * @param vaultConnector The vault connector.
	 * @param identity The identity of the user to access the vault keys.
	 * @param client The client instance.
	 * @param options The transaction options.
	 * @param options.source The source address.
	 * @param options.amount The amount to transfer.
	 * @param options.recipient The recipient address.
	 * @returns The transaction result.
	 */
	public static async prepareAndPostTransaction(
		config: IIotaConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		client: IotaClient,
		options: {
			source: string;
			amount: bigint;
			recipient: string;
		}
	): Promise<{ digest: string }> {
		const seed = await this.getSeed(config, vaultConnector, identity);

		const addressKeyPair = Iota.findAddress(
			config.maxAddressScanRange ?? Iota.DEFAULT_SCAN_RANGE,
			config.coinType ?? Iota.DEFAULT_COIN_TYPE,
			seed,
			options.source
		);
		const keypair = Ed25519Keypair.fromSecretKey(addressKeyPair.privateKey);

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

			await Iota.waitForTransactionConfirmation<IotaTransactionBlockResponse>(
				client,
				result,
				config
			);

			return { digest: result.digest };
		} catch (error) {
			throw new GeneralError(
				Iota._CLASS_NAME,
				"transactionFailed",
				undefined,
				Iota.extractPayloadError(error)
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
		config: IIotaConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		client: IotaClient,
		options: IIotaNftTransactionOptions
	): Promise<IIotaNftTransactionResponse> {
		const seed = await this.getSeed(config, vaultConnector, identity);
		const addressKeyPair = Iota.findAddress(
			config.maxAddressScanRange ?? Iota.DEFAULT_SCAN_RANGE,
			config.coinType ?? Iota.DEFAULT_COIN_TYPE,
			seed,
			options.owner
		);
		const keypair = Ed25519Keypair.fromSecretKey(addressKeyPair.privateKey);

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

			// Wait for transaction to be indexed and available over API
			const confirmedTransaction =
				await Iota.waitForTransactionConfirmation<IIotaNftTransactionResponse>(
					client,
					response,
					config,
					{
						showEffects: true,
						showEvents: true,
						showObjectChanges: true
					}
				);

			// Extract created object for mint operations from the confirmed transaction
			const createdObject = confirmedTransaction.effects?.created?.[0]?.reference?.objectId
				? { objectId: confirmedTransaction.effects.created[0].reference.objectId }
				: undefined;

			return {
				...confirmedTransaction,
				createdObject
			};
		} catch (error) {
			throw new GeneralError(
				Iota._CLASS_NAME,
				"nftTransactionFailed",
				undefined,
				Iota.extractPayloadError(error)
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
		config: IIotaConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		client: IotaClient,
		options: IIotaNftTransactionOptions
	): Promise<IotaTransactionBlockResponse> {
		const seed = await this.getSeed(config, vaultConnector, identity);
		const addressKeyPair = Iota.findAddress(
			config.maxAddressScanRange ?? Iota.DEFAULT_SCAN_RANGE,
			config.coinType ?? Iota.DEFAULT_COIN_TYPE,
			seed,
			options.owner
		);
		const keypair = Ed25519Keypair.fromSecretKey(addressKeyPair.privateKey);

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

			return await Iota.waitForTransactionConfirmation<IotaTransactionBlockResponse>(
				client,
				response,
				config,
				{
					showEffects: true,
					showEvents: true,
					showObjectChanges: true
				}
			);
		} catch (error) {
			throw new GeneralError(
				Iota._CLASS_NAME,
				"storageTransactionFailed",
				undefined,
				Iota.extractPayloadError(error)
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
		config: IIotaConfig,
		vaultConnector: IVaultConnector,
		identity: string
	): Promise<Uint8Array> {
		try {
			const seedBase64 = await vaultConnector.getSecret<string>(
				Iota.buildSeedKey(identity, config.vaultSeedId)
			);
			return Converter.base64ToBytes(seedBase64);
		} catch {}

		const mnemonic = await vaultConnector.getSecret<string>(
			Iota.buildMnemonicKey(identity, config.vaultMnemonicId)
		);

		return Bip39.mnemonicToSeed(mnemonic);
	}

	/**
	 * Find the address in the seed.
	 * @param maxScanRange The maximum range to scan.
	 * @param coinType The coin type to use.
	 * @param seed The seed to use.
	 * @param address The address to find.
	 * @returns The address key pair.
	 * @throws Error if the address is not found.
	 */
	public static findAddress(
		maxScanRange: number,
		coinType: number,
		seed: Uint8Array,
		address: string
	): {
		address: string;
		privateKey: Uint8Array;
		publicKey: Uint8Array;
	} {
		for (let i = 0; i < maxScanRange; i++) {
			const addressKeyPair = Bip44.address(seed, KeyType.Ed25519, coinType, 0, false, i);

			if (addressKeyPair.address === address) {
				return addressKeyPair;
			}
		}

		throw new GeneralError(Iota._CLASS_NAME, "addressNotFound", { address });
	}

	/**
	 * Extract error from SDK payload.
	 * Errors from the IOTA SDK are usually not JSON strings but objects.
	 * @param error The error to extract.
	 * @returns The extracted error.
	 */
	public static extractPayloadError(error: unknown): IError {
		if (error && typeof error === "object") {
			const errObj = error as { code?: string; message?: string };

			if (errObj.code === "InsufficientGas") {
				return new GeneralError(Iota._CLASS_NAME, "insufficientFunds");
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
	 * @param vaultMnemonicId The mnemonic ID to use.
	 * @returns The mnemonic key.
	 */
	public static buildMnemonicKey(identity: string, vaultMnemonicId?: string): string {
		return `${identity}/${vaultMnemonicId ?? Iota.DEFAULT_MNEMONIC_SECRET_NAME}`;
	}

	/**
	 * Get the key for storing the seed.
	 * @param identity The identity to use.
	 * @param vaultSeedId The seed ID to use.
	 * @returns The seed key.
	 */
	public static buildSeedKey(identity: string, vaultSeedId?: string): string {
		return `${identity}/${vaultSeedId ?? Iota.DEFAULT_SEED_SECRET_NAME}`;
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
				throw new GeneralError(Iota._CLASS_NAME, "packageObjectError", {
					packageId,
					error: packageObject.error
				});
			}

			return true;
		} catch (error) {
			throw new GeneralError(Iota._CLASS_NAME, "packageNotFoundOnNetwork", {
				packageId,
				error: Iota.extractPayloadError(error)
			});
		}
	}

	/**
	 * Dry run a transaction and log the results.
	 * @param client The IOTA client.
	 * @param logging The logging connector.
	 * @param className The class name for logging.
	 * @param txb The transaction to dry run.
	 * @param sender The sender address.
	 * @param operation The operation to log.
	 * @returns void.
	 */
	public static async dryRunTransaction(
		client: IotaClient,
		logging: ILoggingConnector | undefined,
		className: string,
		txb: Transaction,
		sender: string,
		operation: string
	): Promise<IIotaDryRun> {
		try {
			txb.setSender(sender);

			const builtTx = await txb.build({
				client,
				onlyTransactionKind: false
			});

			const dryRunResult = await client.dryRunTransactionBlock({
				transactionBlock: builtTx
			});

			if (dryRunResult.effects.status?.status !== "success") {
				throw new GeneralError(this._CLASS_NAME, "dryRunFailed", {
					error: dryRunResult.effects?.status?.error
				});
			}

			const result = {
				status: dryRunResult.effects.status.status,
				costs: {
					computationCost: dryRunResult.effects.gasUsed.computationCost,
					computationCostBurned: dryRunResult.effects.gasUsed.computationCostBurned,
					storageCost: dryRunResult.effects.gasUsed.storageCost,
					storageRebate: dryRunResult.effects.gasUsed.storageRebate,
					nonRefundableStorageFee: dryRunResult.effects.gasUsed.nonRefundableStorageFee
				},
				events: dryRunResult.events ?? [],
				balanceChanges: dryRunResult.balanceChanges ?? [],
				objectChanges: dryRunResult.objectChanges ?? []
			};

			if (logging) {
				await logging.log({
					level: "info",
					source: className,
					ts: Date.now(),
					message: "transactionCosts",
					data: {
						operation,
						...result
					}
				});
			}

			return result;
		} catch (error) {
			throw new GeneralError(
				Iota._CLASS_NAME,
				"dryRunFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Wait for a transaction to be indexed and available over the API.
	 * @param client The IOTA client instance.
	 * @param response The initial transaction response.
	 * @param response.digest The digest of the transaction.
	 * @param config The IOTA configuration.
	 * @param options Additional options for the transaction query.
	 * @param options.showEffects Whether to show effects.
	 * @param options.showEvents Whether to show events.
	 * @param options.showObjectChanges Whether to show object changes.
	 * @returns The confirmed transaction response.
	 */
	private static async waitForTransactionConfirmation<T extends IotaTransactionBlockResponse>(
		client: IotaClient,
		response: { digest: string },
		config: IIotaConfig,
		options?: {
			showEffects?: boolean;
			showEvents?: boolean;
			showObjectChanges?: boolean;
		}
	): Promise<T> {
		const timeoutMs = (config.inclusionTimeoutSeconds ?? Iota.DEFAULT_INCLUSION_TIMEOUT) * 1000;

		return client.waitForTransaction({
			digest: response.digest,
			timeout: timeoutMs,
			options: {
				showEffects: options?.showEffects ?? true,
				showEvents: options?.showEvents ?? true,
				showObjectChanges: options?.showObjectChanges ?? true
			}
		}) as Promise<T>;
	}
}
