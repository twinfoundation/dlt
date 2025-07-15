// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { exec } from "node:child_process";
import { promises as fsPromises } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CLIDisplay } from "@twin.org/cli-core";
import { GeneralError, Is } from "@twin.org/core";
import type { Command } from "commander";
import YAML from "yaml";
import type { ICoinObject } from "../models/ICoinObject";
import type { INetworkConfig } from "../models/INetworkConfig";
import type { NetworkTypes } from "../models/networkTypes";
import { validateDeploymentEnvironment, getDeploymentMnemonic } from "../utils/envSetup.js";

/**
 * Execute a command asynchronously and capture output.
 * @param command The command to execute
 * @param options Execution options
 * @param options.cwd Working directory for command execution
 * @returns The stdout output
 */
async function execAsync(command: string, options?: { cwd?: string }): Promise<string> {
	// TODO: Is this the best way, the best practice?
	return new Promise((resolve, reject) => {
		exec(command, { encoding: "utf8", ...options }, (error, stdout, stderr) => {
			if (error) {
				reject(
					new GeneralError("commands", `Command failed: ${error.message}\nstderr: ${stderr}`, {
						command,
						error: error.message,
						stderr
					})
				);
			} else {
				resolve(stdout.trim());
			}
		});
	});
}

/**
 * Build the deploy command.
 * @param program The command program.
 */
export function buildCommandDeploy(program: Command): void {
	program
		.command("deploy")
		.description("Deploy compiled contracts to the specified network")
		.option("-c, --config <path>", "Path to network configuration file")
		.option("--contracts <path>", "Path to compiled contracts file", "compiled-modules.json")
		.option("-n, --network <network>", "Target network (testnet, devnet, mainnet)")
		.option("--dry-run", "Perform a dry run without actual deployment")
		.option("-f, --force", "Force redeployment even if already deployed")
		.action(actionCommandDeploy);
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
	CLIDisplay.section("Deploy Contracts");

	try {
		const configPath = opts.config;
		const contractsPath = opts.contracts ?? "compiled-modules.json";
		const network = opts.network as NetworkTypes;
		const dryRun = opts.dryRun ?? false;
		const force = opts.force ?? false;

		if (!configPath) {
			CLIDisplay.error("Config file is required");
			return;
		}
		if (!network) {
			CLIDisplay.error("Network is required");
			return;
		}

		const config = await loadNetworkConfig(configPath);
		validateNetworkConfig(config, network);

		const contractsData = await loadCompiledContracts(contractsPath);

		if (network === "mainnet") {
			validateDeploymentEnvironment(network);
		}

		const networkContracts = contractsData[network];
		if (!networkContracts || typeof networkContracts !== "object") {
			throw new GeneralError("commands", `No contracts found for network: ${network}`, {
				network,
				contractsPath
			});
		}

		for (const [contractName, contractData] of Object.entries(networkContracts)) {
			await deployContract(
				contractName,
				contractData as { packageId: string; package: string; deployedPackageId?: string },
				config,
				network,
				dryRun,
				force
			);
		}

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
 * Load network configuration from file.
 * @param configPath Path to configuration file.
 * @returns Network configuration.
 */
async function loadNetworkConfig(configPath: string): Promise<INetworkConfig> {
	try {
		const content = await fsPromises.readFile(configPath, "utf8");
		const config = YAML.parse(content) as INetworkConfig;

		if (!config.platform || config.platform !== "iota") {
			throw new GeneralError("commands", "Invalid configuration: platform must be 'iota'");
		}

		return config;
	} catch (err) {
		throw new GeneralError("commands", "Failed to load network configuration", { configPath }, err);
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
		throw new GeneralError("commands", "Network mismatch", {
			expected: expectedNetwork,
			actual: config.network,
			help: `Configuration file specifies '${config.network}' but command targets '${expectedNetwork}'`
		});
	}

	if (!config.rpc?.url) {
		throw new GeneralError("commands", "Invalid configuration: RPC URL is required");
	}

	if (!config.deployment?.gasBudget) {
		throw new GeneralError("commands", "Invalid configuration: gas budget is required");
	}
}

/**
 * Load compiled contracts from file.
 * @param contractsPath Path to contracts file.
 * @returns Compiled contracts data.
 */
async function loadCompiledContracts(contractsPath: string): Promise<{ [key: string]: unknown }> {
	try {
		const content = await fsPromises.readFile(contractsPath, "utf8");
		const contracts = JSON.parse(content);

		if (!contracts || typeof contracts !== "object") {
			throw new GeneralError("commands", "Invalid contracts file: must contain an object");
		}

		return contracts;
	} catch (err) {
		throw new GeneralError("commands", "Failed to load compiled contracts", { contractsPath }, err);
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
	contractData: { packageId: string; package: string; deployedPackageId?: string },
	config: INetworkConfig,
	network: NetworkTypes,
	dryRun: boolean,
	force: boolean
): Promise<void> {
	CLIDisplay.task(`Deploying contract: ${contractName} (${network})`);

	if (contractData.deployedPackageId && !force) {
		CLIDisplay.value("Contract already deployed", contractData.deployedPackageId, 1);
		return;
	}

	if (dryRun) {
		CLIDisplay.value("DRY RUN: Would deploy contract", `${contractName} (${network})`, 1);
		CLIDisplay.value("DRY RUN: Package ID", contractData.packageId, 1);
		CLIDisplay.value("DRY RUN: Gas Budget", config.deployment.gasBudget.toString(), 1);
		CLIDisplay.value("DRY RUN: RPC URL", config.rpc.url, 1);

		// For mainnet, show mnemonic validation info
		if (network === "mainnet") {
			try {
				validateDeploymentEnvironment(network);
				const mnemonic = getDeploymentMnemonic(network);
				const walletAddress = await getWalletAddressFromMnemonic(
					mnemonic,
					config.deployment.wallet.addressIndex
				);
				CLIDisplay.value("DRY RUN: Wallet Address", walletAddress, 1);

				// Check wallet balance
				const balanceNanos = await getWalletBalance(walletAddress, config.rpc.url);
				const balanceIota = nanosToIota(balanceNanos);
				CLIDisplay.value("DRY RUN: Wallet Balance", `${balanceIota.toFixed(2)} IOTA`, 1);

				if (balanceNanos < config.deployment.gasBudget) {
					CLIDisplay.value(
						"⚠️  WARNING",
						`Insufficient balance: ${balanceIota.toFixed(2)} IOTA < ${nanosToIota(config.deployment.gasBudget).toFixed(2)} IOTA`,
						2
					);
				}
			} catch (err) {
				CLIDisplay.value(
					"⚠️  WARNING",
					`Environment validation failed: ${(err as Error).message}`,
					2
				);
			}
		}
		return;
	}

	try {
		// For mainnet, validate environment and check balance
		if (network === "mainnet") {
			validateDeploymentEnvironment(network);
			const mnemonic = getDeploymentMnemonic(network);
			const walletAddress = await getWalletAddressFromMnemonic(
				mnemonic,
				config.deployment.wallet.addressIndex
			);
			CLIDisplay.value("Wallet Address", walletAddress, 1);

			const balanceNanos = await getWalletBalance(walletAddress, config.rpc.url);
			const balanceIota = nanosToIota(balanceNanos);
			CLIDisplay.value("Wallet Balance", `${balanceIota.toFixed(2)} IOTA`, 1);
			CLIDisplay.value(
				"Gas Budget",
				`${nanosToIota(config.deployment.gasBudget).toFixed(2)} IOTA`,
				1
			);

			if (balanceNanos < config.deployment.gasBudget) {
				throw new GeneralError("commands", "Insufficient wallet balance for deployment", {
					balance: balanceIota,
					required: nanosToIota(config.deployment.gasBudget),
					walletAddress
				});
			}
		}

		// Deploy using IOTA CLI
		const deployedPackageId = await deployWithIotaCli(config.deployment.gasBudget);

		contractData.deployedPackageId = deployedPackageId;
		CLIDisplay.value("Deployed Package ID", deployedPackageId, 1);
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
 * Get wallet address from mnemonic using wallet CLI.
 * @param mnemonic The mnemonic phrase.
 * @param addressIndex The address index to derive.
 * @returns The wallet address.
 */
async function getWalletAddressFromMnemonic(
	mnemonic: string,
	addressIndex: number
): Promise<string> {
	// Create temporary files for mnemonic
	const tempDir = tmpdir();
	const walletEnvFile = path.join(tempDir, `wallet_${Date.now()}.env`);
	const addressEnvFile = path.join(tempDir, `address_${Date.now()}.env`);

	try {
		// Write mnemonic to temporary wallet.env file
		await fsPromises.writeFile(walletEnvFile, `MNEMONIC="${mnemonic}"\n`);

		// Generate address using wallet CLI
		const addressCmd = `npx "@twin.org/wallet-cli" address --load-env "${walletEnvFile}" --seed '!SEED' --count ${addressIndex + 1} --env "${addressEnvFile}"`;
		await execAsync(addressCmd);

		// Read the generated address
		const addressContent = await fsPromises.readFile(addressEnvFile, "utf8");
		const addressRegex = new RegExp(`ADDRESS_${addressIndex}=(.+)`);
		const addressMatch = addressRegex.exec(addressContent);

		if (!addressMatch?.[1]) {
			throw new GeneralError("commands", "Could not find address at index {addressIndex}", {
				addressIndex
			});
		}

		return addressMatch[1].trim();
	} finally {
		// Clean up temporary files
		await fsPromises.unlink(walletEnvFile);
		await fsPromises.unlink(addressEnvFile);
	}
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
 * Get wallet balance using IOTA CLI JSON output and sum all coin objects.
 * @param address The wallet address.
 * @param rpcUrl The RPC URL.
 * @returns The wallet balance in nanos.
 */
async function getWalletBalance(address: string, rpcUrl: string): Promise<number> {
	try {
		const balanceCmd = `iota client balance "${address}" --json`;
		const output = await execAsync(balanceCmd);

		// Parse the JSON output: [coinData, hasNextPage]
		const balanceData = JSON.parse(output) as unknown[];
		const coinData = balanceData[0] as unknown[];
		const hasNextPage = balanceData[1] as boolean;

		if (!Is.arrayValue(coinData)) {
			return 0;
		}

		const coinObjects = coinData[0] as unknown[];
		if (!Is.arrayValue(coinObjects)) {
			return 0;
		}

		let totalBalance = 0;
		for (const coinItem of coinObjects) {
			const coin = coinItem as ICoinObject;
			if (Is.stringValue(coin?.balance)) {
				const parsedBalance = Number.parseInt(coin.balance, 10);
				if (Is.number(parsedBalance) && !Number.isNaN(parsedBalance)) {
					totalBalance += parsedBalance;
				}
			}
		}

		// Log warning if pagination is detected
		if (hasNextPage) {
			CLIDisplay.value(
				"⚠️  WARNING",
				`Large wallet detected: ${coinObjects.length} coin objects with more pages available. Balance may be incomplete.`,
				2
			);
		}

		return totalBalance;
	} catch (err) {
		throw new GeneralError("commands", "Failed to get wallet balance", { address, rpcUrl }, err);
	}
}

/**
 * Deploy contract using IOTA CLI.
 * @param gasBudget Gas budget for deployment.
 * @returns Deployment result with package ID.
 */
async function deployWithIotaCli(gasBudget: number): Promise<string> {
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

	CLIDisplay.value("Move Project Root", moveProjectRoot, 1);

	const publishCmd = `iota client publish --gas-budget ${gasBudget} --json`;

	CLIDisplay.value("Publish Command", publishCmd, 1);
	CLIDisplay.value("Working Directory", moveProjectRoot, 1);

	const output = await execAsync(publishCmd, { cwd: moveProjectRoot });
	const result = JSON.parse(output);

	const packageId = result.objectChanges?.find(
		(change: { type: string; packageId?: string }) => change.type === "published"
	)?.packageId;

	if (!packageId) {
		throw new GeneralError("commands", "Could not find package ID in deployment result", {
			result
		});
	}

	return packageId;
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
		const content = JSON.stringify(contractsData, null, "\t");
		await fsPromises.writeFile(contractsPath, content, "utf8");
		CLIDisplay.value("Updated contracts file", contractsPath, 1);
	} catch (err) {
		throw new GeneralError("commands", "Failed to update contracts file", { contractsPath }, err);
	}
}
