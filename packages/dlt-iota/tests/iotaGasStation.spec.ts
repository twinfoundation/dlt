// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import {
	TEST_CLIENT_OPTIONS,
	TEST_NETWORK,
	TEST_MNEMONIC,
	TEST_IDENTITY,
	GAS_STATION_URL,
	GAS_STATION_AUTH_TOKEN,
	GAS_BUDGET
} from "./setupTestEnv";
import { Iota, type IIotaConfig, type IGasStationConfig } from "../src/index";

describe("Iota Gas Station Integration", () => {
	const gasStationConfig: IIotaConfig = {
		clientOptions: TEST_CLIENT_OPTIONS,
		network: TEST_NETWORK,
		gasBudget: GAS_BUDGET,
		gasStation: {
			gasStationUrl: GAS_STATION_URL,
			gasStationAuthToken: GAS_STATION_AUTH_TOKEN
		}
	};

	beforeAll(async () => {
		// Initialize entity storage schema
		initSchema();

		// Setup entity storage connectors
		EntityStorageConnectorFactory.register(
			"vault-key",
			() =>
				new MemoryEntityStorageConnector<VaultKey>({
					entitySchema: nameof<VaultKey>()
				})
		);

		EntityStorageConnectorFactory.register(
			"vault-secret",
			() =>
				new MemoryEntityStorageConnector<VaultSecret>({
					entitySchema: nameof<VaultSecret>()
				})
		);

		// Register vault connector
		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

		// Setup vault with test mnemonic
		const vaultConnector = VaultConnectorFactory.get("vault");
		await vaultConnector.setSecret(Iota.buildMnemonicKey(TEST_IDENTITY), TEST_MNEMONIC);
	});

	// Configuration Tests
	describe("Configuration", () => {
		test("Should create config with gas station configuration", () => {
			const gasStationConfigObj: IGasStationConfig = {
				gasStationUrl: GAS_STATION_URL,
				gasStationAuthToken: GAS_STATION_AUTH_TOKEN
			};

			const config: IIotaConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				gasBudget: GAS_BUDGET,
				gasStation: gasStationConfigObj
			};

			expect(config.gasStation).toBeDefined();
			expect(config.gasStation?.gasStationUrl).toBe(GAS_STATION_URL);
			expect(config.gasStation?.gasStationAuthToken).toBe(GAS_STATION_AUTH_TOKEN);
			expect(config.gasBudget).toBe(GAS_BUDGET);
		});

		test("Should create config without gas station configuration", () => {
			const config: IIotaConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK
			};

			expect(config.gasStation).toBeUndefined();
		});

		test("Should have gas station static methods available", () => {
			expect(typeof Iota.reserveGas).toBe("function");
			expect(typeof Iota.executeGasStationTransaction).toBe("function");
			expect(typeof Iota.prepareAndPostGasStationTransaction).toBe("function");
		});
	});

	describe("Live Integration (requires running gas station)", () => {
		test("Should connect to running gas station", async () => {
			const response = await fetch(GAS_STATION_URL, {
				method: "GET"
			});

			expect(response.ok).toBe(true);
		});

		test("Should reserve gas and examine response format", async () => {
			const gasReservation = await Iota.reserveGas(gasStationConfig, GAS_BUDGET);

			// Examine the structure
			expect(gasReservation).toHaveProperty("sponsorAddress");
			expect(gasReservation).toHaveProperty("reservationId");
			expect(gasReservation).toHaveProperty("gasCoins");
			expect(typeof gasReservation.sponsorAddress).toBe("string");
			expect(typeof gasReservation.reservationId).toBe("number");
			expect(Array.isArray(gasReservation.gasCoins)).toBe(true);
		});

		test("Should execute transaction via gas station and examine response format", async () => {
			const client = Iota.createClient(gasStationConfig);
			const vaultConnector = VaultConnectorFactory.get("vault");

			const seed = await Iota.getSeed(gasStationConfig, vaultConnector, TEST_IDENTITY);
			const addresses = Iota.getAddresses(seed, Iota.DEFAULT_COIN_TYPE, 0, 0, 1, false);
			const userAddress = addresses[0];

			// Reserve gas
			const gasReservation = await Iota.reserveGas(gasStationConfig, GAS_BUDGET);

			// Create a simple transaction
			const tx = new Transaction();
			tx.moveCall({
				target: "0x2::clock::timestamp_ms",
				arguments: [tx.object("0x6")]
			});

			// Set gas station parameters
			tx.setSender(userAddress);
			tx.setGasOwner(gasReservation.sponsorAddress);
			tx.setGasPayment(gasReservation.gasCoins);
			tx.setGasBudget(GAS_BUDGET);

			// Build and sign
			const unsignedTxBytes = await tx.build({ client });
			const keyPair = Iota.getKeyPair(seed, Iota.DEFAULT_COIN_TYPE, 0, 0);
			const keypair = Ed25519Keypair.fromSecretKey(keyPair.privateKey);
			const signature = await keypair.signTransaction(unsignedTxBytes);

			// Execute via gas station
			const gasStationResponse = await Iota.executeGasStationTransaction(
				gasStationConfig,
				gasReservation.reservationId,
				unsignedTxBytes,
				signature.signature
			);

			// Test if it's compatible with IotaTransactionBlockResponse
			expect(gasStationResponse).toBeDefined();
		});

		test("Should execute pre-built transaction via gas station with confirmation", async () => {
			const client = Iota.createClient(gasStationConfig);
			const vaultConnector = VaultConnectorFactory.get("vault");

			const seed = await Iota.getSeed(gasStationConfig, vaultConnector, TEST_IDENTITY);
			const addresses = Iota.getAddresses(seed, Iota.DEFAULT_COIN_TYPE, 0, 0, 1, false);
			const userAddress = addresses[0];

			const gasReservation = await Iota.reserveGas(gasStationConfig, GAS_BUDGET);

			const tx = new Transaction();
			tx.moveCall({
				target: "0x2::clock::timestamp_ms",
				arguments: [tx.object("0x6")]
			});

			tx.setSender(userAddress);
			tx.setGasOwner(gasReservation.sponsorAddress);
			tx.setGasPayment(gasReservation.gasCoins);
			tx.setGasBudget(GAS_BUDGET);

			const unsignedTxBytes = await tx.build({ client });
			const keyPair = Iota.getKeyPair(seed, Iota.DEFAULT_COIN_TYPE, 0, 0);
			const keypair = Ed25519Keypair.fromSecretKey(keyPair.privateKey);
			const signature = await keypair.signTransaction(unsignedTxBytes);

			const confirmedResponse = await Iota.executeAndConfirmGasStationTransaction(
				gasStationConfig,
				client,
				gasReservation.reservationId,
				unsignedTxBytes,
				signature.signature,
				{ waitForConfirmation: true }
			);

			expect(confirmedResponse).toBeDefined();
			expect(confirmedResponse.digest).toBeDefined();
			expect(typeof confirmedResponse.digest).toBe("string");
		});
	});
});
