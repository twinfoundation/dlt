// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	CoinType,
	type Block,
	type Client,
	type IBuildBlockOptions
} from "@iota/sdk-wasm/node/lib/index.js";
import { BaseError, Converter, GeneralError, Guards, Is, type IError } from "@twin.org/core";
import { Bip39, Bip44, KeyType } from "@twin.org/crypto";
import { nameof } from "@twin.org/nameof";
import type { IVaultConnector } from "@twin.org/vault-models";
import type { IIotaStardustConfig } from "./models/IIotaStardustConfig";

/**
 * Class for performing operations on IOTA.
 */
export class IotaStardust {
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
	public static readonly DEFAULT_COIN_TYPE: number = CoinType.IOTA;

	/**
	 * Default bech32 hrp.
	 */
	public static readonly DEFAULT_BECH32_HRP: string = "iota";

	/**
	 * The default length of time to wait for the inclusion of a transaction in seconds.
	 */
	public static readonly DEFAULT_INCLUSION_TIMEOUT: number = 60;

	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<IotaStardust>();

	/**
	 * Create configuration using defaults where necessary.
	 * @param config The configuration to populate.
	 */
	public static populateConfig(config: IIotaStardustConfig): void {
		Guards.object<IIotaStardustConfig["clientOptions"]>(
			IotaStardust._CLASS_NAME,
			nameof(config.clientOptions),
			config.clientOptions
		);

		config.vaultMnemonicId ??= IotaStardust.DEFAULT_MNEMONIC_SECRET_NAME;
		config.vaultSeedId ??= IotaStardust.DEFAULT_SEED_SECRET_NAME;
		config.coinType ??= IotaStardust.DEFAULT_COIN_TYPE;
		config.bech32Hrp ??= IotaStardust.DEFAULT_BECH32_HRP;
		config.inclusionTimeoutSeconds ??= IotaStardust.DEFAULT_INCLUSION_TIMEOUT;
	}

	/**
	 * Get the addresses for the requested range.
	 * @param config The configuration to use.
	 * @param vaultConnector The vault connector to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @param accountIndex The account index to get the addresses for.
	 * @param startAddressIndex The start index for the addresses.
	 * @param count The number of addresses to generate.
	 * @returns The list of addresses.
	 */
	public static async getAddresses(
		config: IIotaStardustConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		accountIndex: number,
		startAddressIndex: number,
		count: number
	): Promise<string[]> {
		Guards.stringValue(IotaStardust._CLASS_NAME, nameof(identity), identity);
		Guards.integer(IotaStardust._CLASS_NAME, nameof(startAddressIndex), startAddressIndex);
		Guards.integer(IotaStardust._CLASS_NAME, nameof(count), count);

		const seed = await IotaStardust.getSeed(config, vaultConnector, identity);

		const keyPairs: string[] = [];

		for (let i = startAddressIndex; i < startAddressIndex + count; i++) {
			const addressKeyPair = Bip44.addressBech32(
				seed,
				KeyType.Ed25519,
				config.bech32Hrp ?? IotaStardust.DEFAULT_BECH32_HRP,
				config.coinType ?? IotaStardust.DEFAULT_COIN_TYPE,
				accountIndex,
				false,
				i
			);

			keyPairs.push(addressKeyPair.address);
		}

		return keyPairs;
	}

	/**
	 * Prepare a transaction for sending, post and wait for inclusion.
	 * @param config The configuration to use.
	 * @param vaultConnector The vault connector to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @param client The client to use.
	 * @param options The options for the transaction.
	 * @returns The block id and block.
	 */
	public static async prepareAndPostTransaction(
		config: IIotaStardustConfig,
		vaultConnector: IVaultConnector,
		identity: string,
		client: Client,
		options: IBuildBlockOptions
	): Promise<{ blockId: string; block: Block }> {
		const seed = await this.getSeed(config, vaultConnector, identity);
		const secretManager = { hexSeed: Converter.bytesToHex(seed, true) };
		const prepared = await client.prepareTransaction(secretManager, {
			coinType: config.coinType ?? IotaStardust.DEFAULT_COIN_TYPE,
			...options
		});

		const signed = await client.signTransaction(secretManager, prepared);

		const blockIdAndBlock = await client.postBlockPayload(signed);

		try {
			const timeoutSeconds =
				config.inclusionTimeoutSeconds ?? IotaStardust.DEFAULT_INCLUSION_TIMEOUT;

			await client.retryUntilIncluded(blockIdAndBlock[0], 2, Math.ceil(timeoutSeconds / 2));
		} catch (error) {
			throw new GeneralError(
				IotaStardust._CLASS_NAME,
				"inclusionFailed",
				undefined,
				IotaStardust.extractPayloadError(error)
			);
		}

		return {
			blockId: blockIdAndBlock[0],
			block: blockIdAndBlock[1]
		};
	}

	/**
	 * Get the seed from the vault.
	 * @param config The configuration to use.
	 * @param vaultConnector The vault connector to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @returns The seed.
	 */
	public static async getSeed(
		config: IIotaStardustConfig,
		vaultConnector: IVaultConnector,
		identity: string
	): Promise<Uint8Array> {
		try {
			const seedBase64 = await vaultConnector.getSecret<string>(
				IotaStardust.buildSeedKey(config, identity)
			);
			return Converter.base64ToBytes(seedBase64);
		} catch {}

		const mnemonic = await vaultConnector.getSecret<string>(
			IotaStardust.buildMnemonicKey(config, identity)
		);

		return Bip39.mnemonicToSeed(mnemonic);
	}

	/**
	 * Extract error from SDK payload.
	 * @param error The error to extract.
	 * @returns The extracted error.
	 */
	public static extractPayloadError(error: unknown): IError {
		if (Is.json(error)) {
			const obj = JSON.parse(error);
			const message = obj.payload?.error;
			if (message === "no input with matching ed25519 address provided") {
				return new GeneralError(IotaStardust._CLASS_NAME, "insufficientFunds");
			}
			return {
				name: "IOTA",
				message
			};
		}

		return BaseError.fromError(error);
	}

	/**
	 * Build the key name to access the mnemonic in the vault.
	 * @param config The configuration to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @returns The vault key.
	 */
	public static buildMnemonicKey(config: IIotaStardustConfig, identity: string): string {
		return `${identity}/${config.vaultMnemonicId ?? IotaStardust.DEFAULT_MNEMONIC_SECRET_NAME}`;
	}

	/**
	 * Build the key name to access the seed in the vault.
	 * @param config The configuration to use.
	 * @param identity The identity of the user to access the vault keys.
	 * @returns The vault key.
	 */
	public static buildSeedKey(config: IIotaStardustConfig, identity: string): string {
		return `${identity}/${config.vaultSeedId ?? IotaStardust.DEFAULT_SEED_SECRET_NAME}`;
	}
}
