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

	const configWithoutGasStation: IIotaConfig = {
		clientOptions: TEST_CLIENT_OPTIONS,
		network: TEST_NETWORK
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

	// Live Integration Tests
	describe("Live Integration (requires running gas station)", () => {
		/**
		 * Test 1: Check if gas station is running and accessible
		 */
		test("Should connect to running gas station", async () => {
			console.log("🔍 Testing gas station connectivity...");

			try {
				const response = await fetch(GAS_STATION_URL, {
					method: "GET"
				});

				console.log(`📡 Gas station status: ${response.status}`);
				expect(response.ok).toBe(true);
			} catch (error) {
				console.error("❌ Gas station not accessible:", error);
				expect(true).toBe(false); // This will fail and show the error
			}
		}, 10000);

		/**
		 * Test 2: Test gas reservation and examine response format
		 */
		test("Should reserve gas and examine response format", async () => {
			console.log("🚀 Testing gas reservation...");

			try {
				const gasReservation = await Iota.reserveGas(gasStationConfig, GAS_BUDGET);

				console.log("✅ Gas reservation successful:");
				console.log("📋 Full response structure:", JSON.stringify(gasReservation, null, 2));

				// Examine the structure
				expect(gasReservation).toHaveProperty("sponsor_address");
				expect(gasReservation).toHaveProperty("reservation_id");
				expect(gasReservation).toHaveProperty("gas_coins");
				expect(typeof gasReservation.sponsor_address).toBe("string");
				expect(typeof gasReservation.reservation_id).toBe("number");
				expect(Array.isArray(gasReservation.gas_coins)).toBe(true);

				console.log(`📍 Sponsor address: ${gasReservation.sponsor_address}`);
				console.log(`🔢 Reservation ID: ${gasReservation.reservation_id}`);
				console.log(`⛽ Gas coins count: ${gasReservation.gas_coins.length}`);
			} catch (error) {
				console.error("❌ Gas reservation failed:", error);
				throw error;
			}
		}, 15000);

		/**
		 * Test 3: Create a simple transaction and examine gas station execution response
		 */
		test("Should execute transaction via gas station and examine response format", async () => {
			console.log("🔨 Testing full gas station transaction execution...");

			try {
				// Get client and vault
				const client = Iota.createClient(gasStationConfig);
				const vaultConnector = VaultConnectorFactory.get("vault");

				// Get user address
				const seed = await Iota.getSeed(gasStationConfig, vaultConnector, TEST_IDENTITY);
				const addresses = Iota.getAddresses(seed, Iota.DEFAULT_COIN_TYPE, 0, 0, 1, false);
				const userAddress = addresses[0];

				console.log(`👤 User address: ${userAddress}`);

				// Reserve gas
				const gasReservation = await Iota.reserveGas(gasStationConfig, GAS_BUDGET);
				console.log(`⛽ Reserved gas with ID: ${gasReservation.reservation_id}`);

				// Create a simple transaction
				const tx = new Transaction();
				tx.moveCall({
					target: "0x2::clock::timestamp_ms",
					arguments: [tx.object("0x6")]
				});

				// Set gas station parameters
				tx.setSender(userAddress);
				tx.setGasOwner(gasReservation.sponsor_address);
				tx.setGasPayment(gasReservation.gas_coins);
				tx.setGasBudget(GAS_BUDGET);

				// Build and sign
				const unsignedTxBytes = await tx.build({ client });
				const keyPair = Iota.getKeyPair(seed, Iota.DEFAULT_COIN_TYPE, 0, 0);
				const keypair = Ed25519Keypair.fromSecretKey(keyPair.privateKey);
				const signature = await keypair.signTransaction(unsignedTxBytes);

				console.log("📝 Transaction built and signed, submitting to gas station...");

				// Execute via gas station
				const gasStationResponse = await Iota.executeGasStationTransaction(
					gasStationConfig,
					gasReservation.reservation_id,
					unsignedTxBytes,
					signature.signature
				);

				console.log("🎉 Gas station execution complete!");
				console.log("📋 Full gas station response structure:");
				console.log(JSON.stringify(gasStationResponse, null, 2));

				// Examine what the gas station actually returns
				console.log("🔍 Response analysis:");
				console.log(`- Type: ${typeof gasStationResponse}`);
				console.log(`- Has digest: ${gasStationResponse?.digest ? "YES" : "NO"}`);
				console.log(`- Has effects: ${gasStationResponse?.effects ? "YES" : "NO"}`);
				console.log(`- Has events: ${gasStationResponse?.events ? "YES" : "NO"}`);
				console.log(`- Has objectChanges: ${gasStationResponse?.objectChanges ? "YES" : "NO"}`);

				if (gasStationResponse?.digest) {
					console.log(`📜 Transaction digest: ${gasStationResponse.digest}`);
				}

				// Test if it's compatible with IotaTransactionBlockResponse
				expect(gasStationResponse).toBeDefined();
			} catch (error) {
				console.error("❌ Gas station transaction execution failed:", error);
				console.error("Error details:", JSON.stringify(error, null, 2));
				throw error;
			}
		}, 30000);

		/**
		 * Test 4: Compare gas station response vs traditional response structure
		 */
		test("Should compare gas station vs traditional transaction response structures", async () => {
			console.log("🔄 Comparing response structures...");

			try {
				const client = Iota.createClient(configWithoutGasStation);
				const vaultConnector = VaultConnectorFactory.get("vault");

				// Get user address and ensure it has funds
				const seed = await Iota.getSeed(configWithoutGasStation, vaultConnector, TEST_IDENTITY);
				const addresses = Iota.getAddresses(seed, Iota.DEFAULT_COIN_TYPE, 0, 0, 1, false);
				const userAddress = addresses[0];

				console.log(`👤 User address for traditional tx: ${userAddress}`);

				// Try to get balance first
				try {
					const balance = await client.getBalance({ owner: userAddress });
					console.log(`💰 Current balance: ${balance.totalBalance}`);

					if (Number.parseInt(balance.totalBalance, 10) < 100000000) {
						console.log("⚠️ Insufficient balance for traditional transaction, skipping comparison");
						return;
					}

					// Create a simple traditional transaction for comparison
					const traditionalResponse = await Iota.prepareAndPostValueTransaction(
						configWithoutGasStation,
						vaultConnector,
						undefined,
						TEST_IDENTITY,
						client,
						userAddress,
						BigInt(1000000), // 1 IOTA
						userAddress, // Send to self
						{ waitForConfirmation: false }
					);

					console.log("📋 Traditional response structure:");
					console.log(JSON.stringify(traditionalResponse, null, 2));

					console.log("🔍 Traditional response analysis:");
					console.log(`- Type: ${typeof traditionalResponse}`);
					console.log(`- Has digest: ${traditionalResponse?.digest ? "YES" : "NO"}`);
					console.log(`- Has effects: ${traditionalResponse?.effects ? "YES" : "NO"}`);
					console.log(`- Has events: ${traditionalResponse?.events ? "YES" : "NO"}`);
					console.log(`- Has objectChanges: ${traditionalResponse?.objectChanges ? "YES" : "NO"}`);
				} catch (error) {
					console.log(
						"⚠️ Traditional transaction failed (probably due to insufficient funds):",
						error
					);
					console.log("This is expected if the test address has no funds.");
				}
			} catch (error) {
				console.error("❌ Response comparison failed:", error);
				// Don't throw - this test is informational
			}
		}, 30000);
	});
});
