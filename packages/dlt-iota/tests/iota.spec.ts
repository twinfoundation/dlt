// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaClientOptions } from "@iota/iota-sdk/client";
import { Bip39 } from "@twin.org/crypto";
import { TEST_CLIENT_OPTIONS, TEST_COIN_TYPE, TEST_NETWORK } from "./setupTestEnv";
import { Iota } from "../src/iota";
import type { IIotaConfig } from "../src/models/IIotaConfig";

describe("Iota", () => {
	const TEST_IDENTITY = "test-identity";
	const TEST_MNEMONIC_ID = "test-mnemonic";
	const TEST_SEED_ID = "test-seed";
	test("can create a client", () => {
		const config: IIotaConfig = {
			clientOptions: TEST_CLIENT_OPTIONS,
			network: TEST_NETWORK
		};

		const client = Iota.createClient(config);
		expect(client).toBeDefined();
	});

	test("can fail to create a client with no url", () => {
		const config: IIotaConfig = {
			clientOptions: {
				url: undefined
			} as unknown as IotaClientOptions,
			network: TEST_NETWORK
		};

		expect(() => Iota.createClient(config)).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.string",
				properties: {
					property: "config.clientOptions.url",
					value: "undefined"
				}
			})
		);
	});

	test("can populate config defaults", () => {
		const config: IIotaConfig = {
			clientOptions: TEST_CLIENT_OPTIONS,
			network: TEST_NETWORK
		};

		Iota.populateConfig(config);

		expect(config.vaultMnemonicId).toBe("mnemonic");
		expect(config.coinType).toBe(4218);
	});

	test("can build seed key", () => {
		const key = Iota.buildSeedKey(TEST_IDENTITY, TEST_SEED_ID);
		expect(key).toBe(`${TEST_IDENTITY}/${TEST_SEED_ID}`);
	});

	test("can build mnemonic key", () => {
		const key = Iota.buildMnemonicKey(TEST_IDENTITY, TEST_MNEMONIC_ID);
		expect(key).toBe(`${TEST_IDENTITY}/${TEST_MNEMONIC_ID}`);
	});

	test("can get addresses", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const addresses = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 0, 1, false);
		expect(addresses.length).toBe(1);
		expect(addresses[0]).toBeDefined();
	});

	test("can generate a key pair for specified index", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const keyPair = Iota.getKeyPair(seed, TEST_COIN_TYPE, 0, 0);
		expect(keyPair).toBeDefined();
		expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
		expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
		expect(keyPair.privateKey.length).toBeGreaterThan(0);
		expect(keyPair.publicKey.length).toBeGreaterThan(0);
	});

	test("generates different key pairs for different account indices", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const keyPair1 = Iota.getKeyPair(seed, TEST_COIN_TYPE, 0, 0);
		const keyPair2 = Iota.getKeyPair(seed, TEST_COIN_TYPE, 1, 0);
		expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
		expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
	});

	test("generates different key pairs for different address indices", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const keyPair1 = Iota.getKeyPair(seed, TEST_COIN_TYPE, 0, 0);
		const keyPair2 = Iota.getKeyPair(seed, TEST_COIN_TYPE, 0, 1);
		expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
		expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
	});

	test("generates consistent key pairs for same parameters", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const keyPair1 = Iota.getKeyPair(seed, TEST_COIN_TYPE, 0, 0);
		const keyPair2 = Iota.getKeyPair(seed, TEST_COIN_TYPE, 0, 0);
		expect(keyPair1).toEqual(keyPair2);
	});

	test("throws error for invalid coin type", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		expect(() => Iota.getKeyPair(seed, Number.NaN, 0, 0)).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.integer",
				source: "Iota",
				properties: {
					property: "coinType",
					value: Number.NaN,
					options: undefined
				}
			})
		);
	});

	test("throws error for invalid account index", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		expect(() => Iota.getKeyPair(seed, TEST_COIN_TYPE, Number.NaN, 0)).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.integer",
				source: "Iota",
				properties: {
					property: "accountIndex",
					value: Number.NaN,
					options: undefined
				}
			})
		);
	});

	test("throws error for invalid address index", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		expect(() => Iota.getKeyPair(seed, TEST_COIN_TYPE, 0, Number.NaN)).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.integer",
				source: "Iota",
				properties: {
					property: "addressIndex",
					value: Number.NaN,
					options: undefined
				}
			})
		);
	});

	test("can find an address with low range", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const addresses = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 0, 1, false);
		expect(addresses.length).toBe(1);
		expect(addresses[0]).toBeDefined();

		const foundAddress = Iota.findAddress(1000, TEST_COIN_TYPE, seed, addresses[0]);
		expect(foundAddress.address).toEqual(addresses[0]);
	});

	test("can find an address with high range", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const addresses = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 999, 1, false);
		expect(addresses.length).toBe(1);
		expect(addresses[0]).toBeDefined();

		const foundAddress = Iota.findAddress(1000, TEST_COIN_TYPE, seed, addresses[0]);
		expect(foundAddress.address).toEqual(addresses[0]);
	});

	test("generates a single address by default", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const addresses = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 0, 1, false);
		expect(addresses).toHaveLength(1);
		expect(addresses[0]).toBeDefined();
		expect(typeof addresses[0]).toBe("string");
	});

	test("generates multiple addresses with count parameter", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const count = 3;
		const addresses = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 0, count);
		expect(addresses).toHaveLength(count);
		// Ensure all addresses are unique
		const uniqueAddresses = new Set(addresses);
		expect(uniqueAddresses.size).toBe(count);
	});

	test("generates different addresses for different account indices", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const address1 = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 0, 1)[0];
		const address2 = Iota.getAddresses(seed, TEST_COIN_TYPE, 1, 0, 1)[0];
		expect(address1).not.toBe(address2);
	});

	test("generates different addresses for different address indices", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const address1 = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 0, 1)[0];
		const address2 = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 1, 1)[0];
		expect(address1).not.toBe(address2);
	});

	test("generates consistent addresses for same parameters", () => {
		const mnemonic = Bip39.randomMnemonic();
		const seed = Bip39.mnemonicToSeed(mnemonic);

		const addresses1 = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 0, 2);
		const addresses2 = Iota.getAddresses(seed, TEST_COIN_TYPE, 0, 0, 2);
		expect(addresses1).toEqual(addresses2);
	});
});
