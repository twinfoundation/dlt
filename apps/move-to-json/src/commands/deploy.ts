// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { exec } from "node:child_process";
import { promises as fsPromises } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import {
	GeneralError,
	Is,
	Converter,
	I18n,
	Coerce,
	ObjectHelper,
	StringHelper
} from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import { IotaFaucetConnector } from "@twin.org/wallet-connector-iota";
import type { Command } from "commander";
import { config as dotenvConfig } from "dotenv";
import type { ICoinObject } from "../models/ICoinObject";
import type { IContractData } from "../models/IContractData";
import type { INetworkConfig } from "../models/INetworkConfig";
import type { NetworkTypes } from "../models/networkTypes";
import {
	validateDeploymentEnvironment,
	getDeploymentMnemonic,
	getDeploymentSeed
} from "../utils/envSetup.js";
import { verifyIotaSDK } from "../utils/iotaUtils.js";

const execAsync = promisify(exec);

/**
 * Build the deploy command.
 * @param program The command program.
 */
export function buildCommandDeploy(program: Command): void {
	program
		.command("deploy")
		.description(I18n.formatMessage("commands.deploy.description"))
		.option(
			I18n.formatMessage("commands.deploy.options.contracts.param"),
			I18n.formatMessage("commands.deploy.options.contracts.description"),
			"compiled-modules.json"
		)
		.requiredOption(
			I18n.formatMessage("commands.deploy.options.network.param"),
			I18n.formatMessage("commands.deploy.options.network.description")
		)
		.option(
			I18n.formatMessage("commands.deploy.options.dryRun.param"),
			I18n.formatMessage("commands.deploy.options.dryRun.description")
		)
		.option(
			I18n.formatMessage("commands.deploy.options.force.param"),
			I18n.formatMessage("commands.deploy.options.force.description")
		)
		.action(actionCommandDeploy);
}

/**
 * Switch IOTA CLI to the target network environment.
 * @param network Target network to switch to
 * @param dryRun Whether this is a dry run (checks environment but doesn't switch)
 */
async function setIotaEnvironment(network: NetworkTypes, dryRun: boolean = false): Promise<void> {
	try {
		CLIDisplay.task(
			dryRun
				? I18n.formatMessage("commands.deploy.progress.checkingEnvironment")
				: I18n.formatMessage("commands.deploy.progress.settingEnvironment")
		);

		// Check if the environment exists
		const { stdout: envListOutput } = await execAsync("iota client envs");
		if (!envListOutput.includes(network)) {
			throw new GeneralError("commands", "commands.deploy.environmentNotFound", {
				network,
				availableEnvironments: envListOutput,
				setupCommand: `iota client new-env --alias ${network} --rpc <RPC_URL>`
			});
		}

		if (dryRun) {
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.iotaEnvironmentCheck"),
				`✅ ${network} environment exists`,
				1
			);
			return;
		}

		// Switch to target network environment
		await execAsync(`iota client switch --env ${network}`);

		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.switchedIotaEnvironment"),
			network,
			1
		);

		// Verify the switch was successful
		const { stdout: activeEnv } = await execAsync("iota client active-env");
		if (!activeEnv.includes(network)) {
			throw new GeneralError("commands", "commands.deploy.environmentSwitchFailed", {
				network,
				activeEnv
			});
		}
	} catch (error) {
		throw new GeneralError(
			"commands",
			"commands.deploy.environmentOperationFailed",
			{ network, operation: dryRun ? "check" : "switch to" },
			error
		);
	}
}

/**
 * Action for the deploy command.
 * @param opts Command options.
 * @param opts.contracts Path to compiled modules JSON.
 * @param opts.network Network identifier.
 * @param opts.dryRun Simulate deployment without executing.
 * @param opts.force Force redeployment of existing packages.
 */
export async function actionCommandDeploy(opts: {
	contracts?: string;
	network?: string;
	dryRun?: boolean;
	force?: boolean;
}): Promise<void> {
	CLIDisplay.section(I18n.formatMessage("commands.deploy.section.deployContracts"));

	try {
		const contractsPath = opts.contracts ?? "compiled-modules.json";
		const dryRun = opts.dryRun ?? false;
		const force = opts.force ?? false;

		if (!Is.stringValue(opts.network)) {
			throw new GeneralError("commands", "commands.deploy.networkRequired");
		}

		const validNetworks: NetworkTypes[] = ["testnet", "devnet", "mainnet"];
		if (!validNetworks.includes(opts.network as NetworkTypes)) {
			throw new GeneralError("commands", "commands.deploy.invalidNetwork", {
				network: opts.network,
				validNetworks: validNetworks.join(", ")
			});
		}

		const network = opts.network as NetworkTypes;

		// Verify the IOTA SDK before we do anything else
		await verifyIotaSDK();

		// Check/switch to target network environment BEFORE loading config
		await setIotaEnvironment(network, dryRun);

		const config = await loadNetworkConfigFromEnv(network);
		validateNetworkConfig(config, network);

		const contractsData = await loadCompiledContracts(contractsPath);

		if (network === "mainnet") {
			await validateDeploymentEnvironment(network);
		}

		const networkContracts = contractsData[network];
		if (!networkContracts || typeof networkContracts !== "object") {
			throw new GeneralError("commands", "commands.deploy.noContractsFound", {
				network,
				contractsPath
			});
		}

		// Handle flat structure - deploy the single contract directly
		await deployContract(
			"contract", // Use generic name since we have flat structure
			networkContracts as IContractData,
			config,
			network,
			dryRun,
			force
		);

		if (!dryRun) {
			await updateContractsFile(contractsPath, contractsData);
		}

		CLIDisplay.done();
	} catch (err) {
		CLIDisplay.error(err);
		throw err;
	}
}

/**
 * Load network configuration from environment file.
 * @param network Target network to determine which env file to load.
 * @returns Network configuration.
 */
async function loadNetworkConfigFromEnv(network: NetworkTypes): Promise<INetworkConfig> {
	try {
		const envFilePath = StringHelper.trimTrailingSlashes(
			path.join(process.cwd(), "configs", `${network}.env`)
		);

		if (!(await CLIUtils.fileExists(envFilePath))) {
			throw new GeneralError("commands", "commands.deploy.envFileNotFound", {
				network,
				envFilePath
			});
		}

		// Load environment variables from the network-specific file
		const result = dotenvConfig({ path: envFilePath });

		if (result.error) {
			throw new GeneralError("commands", "commands.deploy.envFileLoadFailed", {
				network,
				envFilePath,
				error: result.error.message
			});
		}

		const config: INetworkConfig = {
			network,
			platform: "iota",
			rpc: {
				url: Coerce.string(process.env.RPC_URL) || `https://api.${network}.iota.cafe`,
				timeout: Coerce.number(process.env.RPC_TIMEOUT) || 60000
			},
			deployment: {
				gasBudget: Coerce.number(process.env.GAS_BUDGET) || 50000000,
				confirmationTimeout: Coerce.number(process.env.CONFIRMATION_TIMEOUT) || 60,
				wallet: {
					mnemonicId: Coerce.string(process.env.MNEMONIC_ID) || "deployer-mnemonic",
					addressIndex: Coerce.number(process.env.ADDRESS_INDEX) || 0
				}
			}
		};

		return config;
	} catch (err) {
		throw new GeneralError("commands", "commands.deploy.networkConfigInvalid", { network }, err);
	}
}

/**
 * Validate network configuration matches expected network.
 * @param config Network configuration.
 * @param expectedNetwork Expected network type.
 * @throws GeneralError if the network configuration is invalid.
 */
function validateNetworkConfig(config: INetworkConfig, expectedNetwork: NetworkTypes): void {
	if (config.network !== expectedNetwork) {
		throw new GeneralError("commands", "commands.deploy.networkMismatch", {
			expected: expectedNetwork,
			actual: config.network,
			help: `Configuration file specifies '${config.network}' but command targets '${expectedNetwork}'`
		});
	}

	if (!config.rpc?.url) {
		throw new GeneralError("commands", "commands.deploy.rpcUrlRequired");
	}

	if (!config.deployment?.gasBudget) {
		throw new GeneralError("commands", "commands.deploy.gasBudgetRequired");
	}
}

/**
 * Load compiled contracts from file.
 * @param contractsPath Path to contracts file.
 * @returns Compiled contracts data.
 */
async function loadCompiledContracts(contractsPath: string): Promise<{ [key: string]: unknown }> {
	try {
		if (!(await CLIUtils.fileExists(contractsPath))) {
			throw new GeneralError("commands", "commands.deploy.contractsFileNotFound", {
				contractsPath
			});
		}

		const contracts = await CLIUtils.readJsonFile<{ [key: string]: unknown }>(contractsPath);

		if (!contracts || typeof contracts !== "object") {
			throw new GeneralError("commands", "commands.deploy.invalidContractsFile");
		}

		return contracts;
	} catch (err) {
		throw new GeneralError(
			"commands",
			"commands.deploy.contractsLoadFailed",
			{ contractsPath },
			err
		);
	}
}

/**
 * Deploy a single contract.
 * @param contractName Name of the contract
 * @param contractData Contract compilation data
 * @param contractData.packageId Package ID
 * @param contractData.package Package
 * @param contractData.deployedPackageId Deployed package ID
 * @param config Network configuration
 * @param network Target network
 * @param dryRun Whether this is a dry run
 * @param force Whether to force redeployment
 */
async function deployContract(
	contractName: string,
	contractData: IContractData,
	config: INetworkConfig,
	network: NetworkTypes,
	dryRun: boolean,
	force: boolean
): Promise<void> {
	CLIDisplay.task(
		I18n.formatMessage("commands.deploy.progress.deployingContract", { contractName, network })
	);

	if (contractData.deployedPackageId && !force) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.contractAlreadyDeployed"),
			contractData.deployedPackageId,
			1
		);
		return;
	}

	if (dryRun) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.dryRunWouldDeploy"),
			`${contractName} (${network})`,
			1
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.dryRunPackageId"),
			contractData.packageId,
			1
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.dryRunGasBudget"),
			config.deployment.gasBudget.toString(),
			1
		);
		CLIDisplay.value(I18n.formatMessage("commands.deploy.labels.dryRunRpcUrl"), config.rpc.url, 1);

		// For mainnet, show mnemonic validation info
		if (network === "mainnet") {
			try {
				await validateDeploymentEnvironment(network);
				const walletAddress = await getDeploymentWalletAddress(
					network,
					config.deployment.wallet.addressIndex
				);
				CLIDisplay.value(
					I18n.formatMessage("commands.deploy.labels.dryRunWalletAddress"),
					walletAddress,
					1
				);

				// Check wallet balance
				const balanceNanos = await getWalletBalance(config.rpc.url);
				const balanceIota = nanosToIota(balanceNanos);
				CLIDisplay.value(
					I18n.formatMessage("commands.deploy.labels.dryRunWalletBalance"),
					`${balanceIota.toFixed(2)} IOTA`,
					1
				);

				if (balanceNanos < config.deployment.gasBudget) {
					CLIDisplay.value(
						I18n.formatMessage("commands.deploy.labels.warning"),
						I18n.formatMessage("commands.deploy.labels.insufficientBalanceWarning", {
							currentBalance: balanceIota.toFixed(2),
							requiredBalance: nanosToIota(config.deployment.gasBudget).toFixed(2)
						}),
						2
					);
				}
			} catch (err) {
				CLIDisplay.value(
					I18n.formatMessage("commands.deploy.labels.warning"),
					I18n.formatMessage("commands.deploy.labels.environmentValidationWarning", {
						message: (err as Error).message
					}),
					2
				);
			}
		}
		return;
	}

	try {
		// Get wallet address for all networks
		const walletAddress = await getDeploymentWalletAddress(
			network,
			config.deployment.wallet.addressIndex
		);
		CLIDisplay.value(I18n.formatMessage("commands.deploy.labels.walletAddress"), walletAddress, 1);

		if (network === "mainnet") {
			// For mainnet, validate environment and check balance
			await validateDeploymentEnvironment(network);

			const balanceNanos = await getWalletBalance(config.rpc.url);
			const balanceIota = nanosToIota(balanceNanos);
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.walletBalance"),
				`${balanceIota.toFixed(2)} IOTA`,
				1
			);
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.gasBudget"),
				`${nanosToIota(config.deployment.gasBudget).toFixed(2)} IOTA`,
				1
			);

			if (balanceNanos < config.deployment.gasBudget) {
				throw new GeneralError("commands", "commands.deploy.insufficientBalance", {
					balance: balanceIota,
					required: nanosToIota(config.deployment.gasBudget),
					walletAddress
				});
			}
		} else if (network === "testnet" || network === "devnet") {
			// For testnet/devnet, request funds from faucet and validate balance
			await requestFaucetFunds(network, walletAddress);

			// Check balance after faucet request
			const balanceNanos = await getWalletBalance(config.rpc.url);
			const balanceIota = nanosToIota(balanceNanos);
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.walletBalance"),
				`${balanceIota.toFixed(2)} IOTA`,
				1
			);
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.gasBudget"),
				`${nanosToIota(config.deployment.gasBudget).toFixed(2)} IOTA`,
				1
			);

			if (balanceNanos < config.deployment.gasBudget) {
				CLIDisplay.value(
					I18n.formatMessage("commands.deploy.labels.warning"),
					I18n.formatMessage("commands.deploy.labels.insufficientBalanceAfterFaucet", {
						network,
						balance: balanceIota.toFixed(2),
						required: nanosToIota(config.deployment.gasBudget).toFixed(2),
						walletAddress
					}),
					2
				);
				// Still attempt deployment - maybe there are merged coins or other sources
			}
		}

		// Deploy using IOTA CLI
		const deploymentResult = await deployWithIotaCli(config.deployment.gasBudget);

		contractData.deployedPackageId = deploymentResult.packageId;
		contractData.upgradeCap = deploymentResult.upgradeCap ?? null;

		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.deployedPackageIdResult"),
			deploymentResult.packageId,
			1
		);
		if (deploymentResult.upgradeCap) {
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.upgradeCapId"),
				deploymentResult.upgradeCap,
				1
			);
		}
	} catch (err) {
		throw new GeneralError(
			"commands",
			"commands.deploy.deploymentFailed",
			{ contract: contractName },
			err
		);
	}
}

/**
 * Get wallet address from seed using wallet CLI.
 * @param seed The seed value (hex string starting with 0x).
 * @param addressIndex The address index to derive.
 * @returns The wallet address.
 */
async function getWalletAddressFromSeed(seed: string, addressIndex: number): Promise<string> {
	const tempDir = tmpdir();
	const addressEnvFile = path.join(tempDir, `address_${Date.now()}.env`);

	try {
		// Generate address using the provided seed
		const addressCmd = `npx "@twin.org/wallet-cli" address --seed "${seed}" --count ${addressIndex + 1} --env "${addressEnvFile}"`;
		await execAsync(addressCmd);

		// Read the generated address
		const addressContent = await fsPromises.readFile(addressEnvFile, "utf8");
		const addressRegex = new RegExp(`ADDRESS_${addressIndex}=(.+)`);
		const addressMatch = addressRegex.exec(addressContent);

		if (!addressMatch?.[1]) {
			throw new GeneralError("commands", "commands.deploy.addressNotFound", {
				addressIndex
			});
		}

		return addressMatch[1].trim();
	} finally {
		// Clean up temporary files
		try {
			await fsPromises.unlink(addressEnvFile);
		} catch {
			// Log cleanup failures but don't throw - this is not critical to the main operation
			CLIDisplay.value(
				"⚠️  Cleanup Warning",
				`Failed to remove temporary file: ${addressEnvFile}`,
				2
			);
		}
	}
}

/**
 * Get wallet address from mnemonic using the crypto library.
 * @param mnemonic The mnemonic phrase.
 * @param addressIndex The address index to derive.
 * @returns The wallet address.
 */
async function getWalletAddressFromMnemonic(
	mnemonic: string,
	addressIndex: number
): Promise<string> {
	// Use the crypto library to derive seed from mnemonic (same as original wallet.env generation)
	const seed = Bip39.mnemonicToSeed(mnemonic);
	const seedHex = Converter.bytesToHex(seed, true);

	// Use wallet CLI to generate address from the derived seed
	return getWalletAddressFromSeed(seedHex, addressIndex);
}

/**
 * Get wallet address for deployment, preferring seed over mnemonic if available.
 * @param network The target network.
 * @param addressIndex The address index to derive.
 * @returns The wallet address.
 */
async function getDeploymentWalletAddress(
	network: NetworkTypes,
	addressIndex: number
): Promise<string> {
	// Try to use seed first if available
	const seed = await getDeploymentSeed(network);
	if (seed) {
		return getWalletAddressFromSeed(seed, addressIndex);
	}

	// Fall back to mnemonic
	const mnemonic = await getDeploymentMnemonic(network);
	return getWalletAddressFromMnemonic(mnemonic, addressIndex);
}

/**
 * Convert nanos to IOTA (1 IOTA = 1,000,000,000 nanos).
 * @param nanos Balance in nanos.
 * @returns Balance in IOTA.
 */
function nanosToIota(nanos: number): number {
	return nanos / 1_000_000_000;
}

/**
 * Get wallet balance from IOTA CLI.
 * @param rpcUrl The RPC URL (not used but kept for consistency).
 * @param timeoutMs Timeout for the balance check.
 * @returns The total wallet balance in nanoIOTA.
 */
async function getWalletBalance(rpcUrl: string, timeoutMs: number = 30000): Promise<number> {
	try {
		const { stdout: output } = await execAsync("iota client balance --json", {
			timeout: timeoutMs
		});

		// Parse and validate the JSON structure
		const balanceResponse = parseBalanceResponse(output);

		// Calculate total balance from all coins
		return calculateTotalBalance(balanceResponse.coinObjects);
	} catch (error) {
		throw new GeneralError("commands", "commands.deploy.balanceCheckFailed", {}, error);
	}
}

/**
 * Interface for IOTA balance response structure.
 */
interface IBalanceResponse {
	/**
	 * Array of coin objects
	 */
	coinObjects: ICoinObject[];
	/**
	 * Whether there are more pages of results
	 */
	hasNextPage: boolean;
	/**
	 * Token metadata
	 */
	metadata: {
		decimals: number;
		name: string;
		symbol: string;
		description: string;
		iconUrl?: string;
		id: string;
	};
}

/**
 * Safely parse the IOTA CLI balance response.
 * @param jsonOutput Raw JSON output from IOTA CLI
 * @returns Parsed balance response
 * @throws GeneralError when parsing fails or structure is invalid
 */
function parseBalanceResponse(jsonOutput: string): IBalanceResponse {
	let parsedData: unknown;

	try {
		parsedData = JSON.parse(jsonOutput);
	} catch (error) {
		throw new GeneralError(
			"commands",
			"commands.deploy.invalidJsonResponse",
			{
				output: jsonOutput.slice(0, 200) // Truncate for logging
			},
			error
		);
	}

	// Validate root structure: [data, hasNextPage]
	if (!Is.arrayValue(parsedData) || parsedData.length < 2) {
		throw new GeneralError("commands", "commands.deploy.unexpectedResponseFormat", {
			message: "Root structure should be [data, hasNextPage]",
			actualLength: Is.arrayValue(parsedData) ? parsedData.length : "not array"
		});
	}

	const [dataWrapper, hasNextPage] = parsedData;

	// Validate hasNextPage
	if (typeof hasNextPage !== "boolean") {
		throw new GeneralError("commands", "commands.deploy.unexpectedResponseFormat", {
			message: "hasNextPage should be boolean",
			actualType: typeof hasNextPage
		});
	}

	// Validate data wrapper: [[...]]
	if (!Is.arrayValue(dataWrapper) || dataWrapper.length === 0) {
		throw new GeneralError("commands", "commands.deploy.unexpectedResponseFormat", {
			message: "Data wrapper should be non-empty array",
			actualLength: Is.arrayValue(dataWrapper) ? dataWrapper.length : "not array"
		});
	}

	// Validate inner structure: [metadata, coinObjects]
	const innerData = dataWrapper[0];
	if (!Is.arrayValue(innerData) || innerData.length < 2) {
		throw new GeneralError("commands", "commands.deploy.unexpectedResponseFormat", {
			message: "Inner data should have [metadata, coinObjects]",
			actualLength: Is.arrayValue(innerData) ? innerData.length : "not array"
		});
	}

	const [metadata, coinObjects] = innerData;

	// Validate metadata
	if (!Is.object(metadata)) {
		throw new GeneralError("commands", "commands.deploy.unexpectedResponseFormat", {
			message: "Metadata should be object",
			actualType: typeof metadata
		});
	}

	// Validate coin objects
	if (!Is.arrayValue(coinObjects)) {
		throw new GeneralError("commands", "commands.deploy.unexpectedResponseFormat", {
			message: "Coin objects should be array",
			actualType: typeof coinObjects
		});
	}

	// Validate coin object structure
	const validatedCoinObjects = coinObjects.map((coin, index) => {
		if (!Is.object(coin)) {
			throw new GeneralError("commands", "commands.deploy.invalidCoinObject", {
				index,
				actualType: typeof coin
			});
		}

		const balance = ObjectHelper.propertyGet(coin, "balance");
		if (!Is.stringValue(balance)) {
			throw new GeneralError("commands", "commands.deploy.invalidCoinBalance", {
				index,
				balance
			});
		}

		return coin as unknown as ICoinObject;
	});

	return {
		coinObjects: validatedCoinObjects,
		hasNextPage,
		metadata: metadata as IBalanceResponse["metadata"]
	};
}

/**
 * Calculate total balance from coin objects.
 * @param coinObjects Array of coin objects
 * @returns Total balance in nanoIOTA
 */
function calculateTotalBalance(coinObjects: ICoinObject[]): number {
	let total = 0;
	for (const coin of coinObjects) {
		const balance = ObjectHelper.propertyGet(coin, "balance");
		const coinBalance = Coerce.number(balance);
		if (coinBalance !== undefined) {
			total += coinBalance;
		}
	}
	return total;
}

/**
 * Request funds from the faucet for testnet or devnet deployment.
 * @param network The target network (testnet or devnet).
 * @param walletAddress The wallet address to fund.
 * @returns Promise that resolves when funding is complete.
 */
async function requestFaucetFunds(network: NetworkTypes, walletAddress: string): Promise<void> {
	if (network !== "testnet" && network !== "devnet") {
		return; // Only fund for testnet and devnet
	}

	try {
		CLIDisplay.task(
			I18n.formatMessage("commands.deploy.progress.requestingFaucetFunds", { network })
		);

		const faucetConnector = new IotaFaucetConnector({
			config: {
				endpoint: `https://faucet.${network}.iota.cafe`,
				clientOptions: { url: `https://api.${network}.iota.cafe` },
				network
			}
		});

		const amountFunded = await faucetConnector.fundAddress(
			"move-to-json-deployer",
			walletAddress,
			60
		);

		if (amountFunded > 0n) {
			const amountIota = nanosToIota(Number(amountFunded));
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.faucetFundsRequested"),
				`${amountIota.toFixed(2)} IOTA`,
				1
			);
		} else {
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.warning"),
				I18n.formatMessage("commands.deploy.labels.faucetNoFundsAdded", { network }),
				2
			);
		}
	} catch (err) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.warning"),
			I18n.formatMessage("commands.deploy.labels.faucetRequestFailed", {
				network,
				error: (err as Error).message
			}),
			2
		);
		// Don't throw - allow deployment to proceed even if faucet fails
		// The user might already have sufficient funds
	}
}

/**
 * Deploy contract using IOTA CLI.
 * @param gasBudget Gas budget for deployment.
 * @returns Deployment result with package ID.
 */
async function deployWithIotaCli(
	gasBudget: number
): Promise<{ packageId: string; upgradeCap?: string }> {
	// Find the Move project directory by looking for Move.toml files
	const moveTomlPaths = await findMoveTomlFiles(process.cwd());

	if (moveTomlPaths.length === 0) {
		throw new GeneralError(
			"commands",
			"No Move.toml files found in current directory or subdirectories. Make sure you're running this from a directory containing Move projects.",
			{
				currentDir: process.cwd()
			}
		);
	}

	const moveProjectRoot = path.dirname(moveTomlPaths[0]);

	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.moveProjectRoot"),
		moveProjectRoot,
		1
	);

	const publishCmd = `iota client publish --gas-budget ${gasBudget} --json`;

	CLIDisplay.value(I18n.formatMessage("commands.deploy.labels.publishCommand"), publishCmd, 1);
	CLIDisplay.value(
		I18n.formatMessage("commands.deploy.labels.workingDirectory"),
		moveProjectRoot,
		1
	);

	const { stdout: output } = await execAsync(publishCmd, { cwd: moveProjectRoot });
	const result = JSON.parse(output);

	// Extract package ID from published object
	const packageId = result.objectChanges?.find(
		(change: { type: string; packageId?: string }) => change.type === "published"
	)?.packageId;

	if (!packageId) {
		throw new GeneralError("commands", "commands.deploy.packageIdNotFound", {
			result
		});
	}

	// Extract UpgradeCap ID from created objects
	const upgradeCap = result.objectChanges?.find(
		(change: { objectType?: string; objectId?: string }) =>
			change.objectType === "0x2::package::UpgradeCap"
	)?.objectId;

	return {
		packageId,
		upgradeCap
	};
}

/**
 * Find all Move.toml files in a directory tree.
 * @param rootDir Root directory to search
 * @returns Array of Move.toml file paths
 */
async function findMoveTomlFiles(rootDir: string): Promise<string[]> {
	const moveTomlFiles: string[] = [];
	await searchDirectoryForMoveToml(rootDir, moveTomlFiles);
	return moveTomlFiles;
}

/**
 * Recursively search a directory for Move.toml files.
 * @param dir Directory to search
 * @param moveTomlFiles Array to collect found files
 */
async function searchDirectoryForMoveToml(dir: string, moveTomlFiles: string[]): Promise<void> {
	try {
		const entries = await fsPromises.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
				await searchDirectoryForMoveToml(fullPath, moveTomlFiles);
			} else if (entry.isFile() && entry.name === "Move.toml") {
				moveTomlFiles.push(fullPath);
			}
		}
	} catch {
		// Ignore directories that can't be read
	}
}

/**
 * Update contracts file with deployed package IDs.
 * @param contractsPath Path to contracts file.
 * @param contractsData Updated contracts data.
 */
async function updateContractsFile(
	contractsPath: string,
	contractsData: { [key: string]: unknown }
): Promise<void> {
	try {
		await CLIUtils.writeJsonFile(contractsPath, contractsData, false);
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.updatedContractsFile"),
			contractsPath,
			1
		);
	} catch (err) {
		throw new GeneralError(
			"commands",
			"commands.deploy.contractsFileUpdateFailed",
			{ contractsPath },
			err
		);
	}
}
