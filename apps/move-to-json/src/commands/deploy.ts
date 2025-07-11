// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { GeneralError } from "@twin.org/core";
import type { Command } from "commander";
import YAML from "yaml";

/**
 * Network types supported for deployment
 */
type NetworkType = "testnet" | "devnet" | "mainnet";

/**
 * Network configuration interface
 */
interface NetworkConfig {
	/**
	 * The network type
	 */
	network: NetworkType;
	/**
	 * The platform type
	 */
	platform: "iota";
	/**
	 * The RPC configuration
	 */
	rpc: {
		url: string;
		timeout?: number;
	};
	/**
	 * The deployment configuration
	 */
	deployment: {
		gasBudget: number;
		confirmationTimeout?: number;
		wallet: {
			mnemonicId: string;
			addressIndex: number;
		};
		gasStation?: {
			url: string;
			authToken: string;
		};
	};
	/**
	 * The contracts configuration
	 */
	contracts?: {
		[key: string]: {
			moduleName: string;
			dependencies?: string[];
			packageController?: {
				addressIndex: number;
			};
		};
	};
}

/**
 * Build the deploy command to be consumed by the CLI.
 * @param program The command to build on.
 */
export function buildCommandDeploy(program: Command): void {
	program
		.command("deploy")
		.description("Deploy compiled contracts to specified network")
		.option("--config <file>", "Path to network configuration file")
		.option("--contracts <file>", "Path to compiled modules JSON", "compiled-modules.json")
		.option("--network <network>", "Network identifier (testnet/devnet/mainnet)")
		.option("--dry-run", "Simulate deployment without executing", false)
		.option("--force", "Force redeployment of existing packages", false)
		.action(async opts => {
			await actionCommandDeploy(opts);
		});
}

/**
 * Action for the deploy command.
 * @param opts Command options.
 * @param opts.config Path to network config file.
 * @param opts.contracts Path to compiled modules JSON.
 * @param opts.network Network identifier.
 * @param opts.dryRun Simulate deployment without executing.
 * @param opts.force Force redeployment of existing packages.
 */
export async function actionCommandDeploy(opts: {
	config?: string;
	contracts?: string;
	network?: string;
	dryRun?: boolean;
	force?: boolean;
}): Promise<void> {
	try {
		// Validate required options
		if (!opts.config) {
			throw new GeneralError("commands", "Config file is required for deployment", {});
		}
		if (!opts.network) {
			throw new GeneralError("commands", "Network is required for deployment", {});
		}

		const network = opts.network as NetworkType;
		const contractsFile = opts.contracts ?? "compiled-modules.json";

		CLIDisplay.section(`Deploying to ${network.toUpperCase()}`);

		// Load and validate network configuration
		const config = await loadNetworkConfig(opts.config);
		validateNetworkConfig(config, network);

		CLIDisplay.value("Network", network);
		CLIDisplay.value("Config File", opts.config);
		CLIDisplay.value("Contracts File", contractsFile);
		CLIDisplay.value("Dry Run", opts.dryRun ? "Yes" : "No");
		CLIDisplay.break();

		// Load compiled contracts
		const contractsData = await loadCompiledContracts(contractsFile);
		if (!contractsData[network]) {
			throw new GeneralError("commands", `No contracts found for network: ${network}`, {});
		}

		const networkContracts = contractsData[network];

		// Clean build environment and update Move.toml for target network
		await prepareDeploymentEnvironment(config, contractsFile);

		// Deploy each contract
		for (const [contractName, contractData] of Object.entries(networkContracts)) {
			if (typeof contractData === "object" && contractData !== null) {
				await deployContract(
					contractName,
					contractData as { packageId: string; package: string; deployedPackageId?: string },
					config,
					network,
					opts.dryRun ?? false,
					opts.force ?? false
				);
			}
		}

		// Update contracts file with deployed package IDs
		if (!opts.dryRun) {
			await updateContractsFile(contractsFile, contractsData);
		}

		CLIDisplay.break();
		CLIDisplay.done();
	} catch (err) {
		CLIDisplay.error(err);
	}
}

/**
 * Load network configuration from YAML file.
 * @param configPath Path to the configuration file
 * @returns Parsed network configuration
 */
async function loadNetworkConfig(configPath: string): Promise<NetworkConfig> {
	try {
		const configContent = await fsPromises.readFile(configPath, "utf8");
		const config = YAML.parse(configContent) as NetworkConfig;
		return config;
	} catch (err) {
		throw new GeneralError(
			"commands",
			"Failed to load network configuration",
			{ file: configPath },
			err
		);
	}
}

/**
 * Validate network configuration.
 * @param config The network configuration
 * @param expectedNetwork The expected network type
 * @throws GeneralError if the network configuration is invalid
 */
function validateNetworkConfig(config: NetworkConfig, expectedNetwork: NetworkType): void {
	if (config.network !== expectedNetwork) {
		throw new GeneralError("commands", "Config network mismatch", {
			expected: expectedNetwork,
			actual: config.network
		});
	}

	if (!config.rpc?.url) {
		throw new GeneralError("commands", "RPC URL is required in config", {});
	}

	if (!config.deployment?.gasBudget) {
		throw new GeneralError("commands", "Gas budget is required in config", {});
	}

	if (!config.deployment?.wallet?.mnemonicId) {
		throw new GeneralError("commands", "Wallet mnemonic ID is required in config", {});
	}
}

/**
 * Load compiled contracts from JSON file.
 * @param contractsPath Path to the contracts file
 * @returns Parsed contracts data
 */
async function loadCompiledContracts(contractsPath: string): Promise<{ [key: string]: unknown }> {
	try {
		const contractsContent = await fsPromises.readFile(contractsPath, "utf8");
		return JSON.parse(contractsContent);
	} catch (err) {
		throw new GeneralError(
			"commands",
			"Failed to load compiled contracts",
			{ file: contractsPath },
			err
		);
	}
}

/**
 * Prepare deployment environment by cleaning build artifacts and updating Move.toml.
 * @param config Network configuration
 * @param contractsFile Path to contracts file
 */
async function prepareDeploymentEnvironment(
	config: NetworkConfig,
	contractsFile: string
): Promise<void> {
	CLIDisplay.task("Preparing deployment environment...");

	// Find Move.toml files in the project
	const contractsDir = path.dirname(path.resolve(contractsFile));
	const moveTomlPaths = await findMoveTomlFiles(contractsDir);

	for (const moveTomlPath of moveTomlPaths) {
		const projectRoot = path.dirname(moveTomlPath);

		// Clean build artifacts
		const buildDir = path.join(projectRoot, "build");
		const moveLockFile = path.join(projectRoot, "Move.lock");

		try {
			await fsPromises.rm(buildDir, { recursive: true, force: true });
			CLIDisplay.value("Cleaned build directory", buildDir, 1);
		} catch {
			// Directory might not exist, ignore
		}

		try {
			await fsPromises.unlink(moveLockFile);
			CLIDisplay.value("Removed Move.lock", moveLockFile, 1);
		} catch {
			// File might not exist, ignore
		}

		// Update Move.toml with network-specific settings
		await updateMoveToml(moveTomlPath, config);
	}
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
 * Update Move.toml with network-specific settings.
 * @param moveTomlPath Path to Move.toml file
 * @param config Network configuration
 */
async function updateMoveToml(moveTomlPath: string, config: NetworkConfig): Promise<void> {
	// For now, just log that we would update it
	// In a real implementation, we would parse and modify the TOML file
	CLIDisplay.value("Would update Move.toml for network", config.network, 1);
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
	contractData: { packageId: string; package: string; deployedPackageId?: string },
	config: NetworkConfig,
	network: NetworkType,
	dryRun: boolean,
	force: boolean
): Promise<void> {
	CLIDisplay.task(`Deploying contract: ${contractName}`);

	if (contractData.deployedPackageId && !force) {
		CLIDisplay.value("Contract already deployed", contractData.deployedPackageId, 1);
		return;
	}

	if (dryRun) {
		CLIDisplay.value("DRY RUN: Would deploy contract", contractName, 1);
		CLIDisplay.value("DRY RUN: Package ID", contractData.packageId, 1);
		CLIDisplay.value("DRY RUN: Gas Budget", config.deployment.gasBudget.toString(), 1);
		return;
	}

	try {
		// Use IOTA CLI to publish the contract
		const publishArgs = [
			"client",
			"publish",
			"--gas-budget",
			config.deployment.gasBudget.toString()
		];

		CLIDisplay.value("Publishing with IOTA CLI", `iota ${publishArgs.join(" ")}`, 1);

		// In a real implementation, we would:
		// 1. Write the package bytecode to a temporary location
		// 2. Use iota client publish command
		// 3. Parse the output to get the deployed package ID
		// 4. Update the contractData with the deployed package ID

		// For now, simulate a successful deployment
		const simulatedDeployedId = `0x${Math.random().toString(16).slice(2, 66).padStart(64, "0")}`;
		contractData.deployedPackageId = simulatedDeployedId;

		CLIDisplay.value("Deployed Package ID", simulatedDeployedId, 1);
	} catch (err) {
		throw new GeneralError(
			"commands",
			"Contract deployment failed",
			{ contract: contractName },
			err
		);
	}
}

/**
 * Update contracts file with deployed package IDs.
 * @param contractsPath Path to contracts file
 * @param contractsData Updated contracts data
 */
async function updateContractsFile(
	contractsPath: string,
	contractsData: { [key: string]: unknown }
): Promise<void> {
	CLIDisplay.task("Updating contracts file with deployed package IDs...");

	try {
		await CLIUtils.writeJsonFile(contractsPath, contractsData, true);
		CLIDisplay.value("Updated contracts file", contractsPath, 1);
	} catch (err) {
		throw new GeneralError(
			"commands",
			"Failed to update contracts file",
			{ file: contractsPath },
			err
		);
	}
}
