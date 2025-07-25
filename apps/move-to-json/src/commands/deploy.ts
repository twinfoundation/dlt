// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { IotaClient } from "@iota/iota-sdk/client";
import { requestIotaFromFaucetV0 } from "@iota/iota-sdk/faucet";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { GeneralError, Is, Converter, I18n, Coerce, Guards } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import { Iota } from "@twin.org/dlt-iota";
import { nameof } from "@twin.org/nameof";
import type { Command } from "commander";
import type { IContractData } from "../models/IContractData";
import type { INetworkConfig } from "../models/INetworkConfig";
import type { ISmartContractDeployments } from "../models/ISmartContractDeployments";
import { NetworkTypes } from "../models/networkTypes";
import {
	validateDeploymentEnvironment,
	getDeploymentMnemonic,
	getDeploymentSeed
} from "../utils/envSetup.js";
import { verifyIotaSDK } from "../utils/iotaUtils.js";
import { searchDirectoryForMoveToml } from "../utils/moveToJsonUtils.js";

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
			"smart-contract-deployments.json"
		)
		.option(
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
 * @param opts.network Network identifier - optional if NETWORK env var is set.
 * @param opts.dryRun Simulate deployment without executing.
 * @param opts.force Force redeployment of existing packages.
 */
export async function actionCommandDeploy(opts: {
	contracts?: string;
	network?: NetworkTypes;
	dryRun?: boolean;
	force?: boolean;
}): Promise<void> {
	CLIDisplay.section(I18n.formatMessage("commands.deploy.section.deployContracts"));
	CLIDisplay.section(opts.contracts ?? "smart-contract-deployments.json");

	try {
		const contractsPath = opts.contracts ?? "smart-contract-deployments.json";
		const dryRun = opts.dryRun ?? false;
		const force = opts.force ?? false;

		const network = opts.network ?? (process.env.NETWORK as NetworkTypes);

		Guards.arrayOneOf("commands", nameof(network), network, Object.values(NetworkTypes));

		// Verify the IOTA SDK before we do anything else
		await verifyIotaSDK();

		// Check/switch to target network environment BEFORE loading config
		await setIotaEnvironment(network, dryRun);

		const config = await createNetworkConfig(network);
		validateNetworkConfig(config, network);

		const contractsData = await loadCompiledContracts(contractsPath);

		if (network === "mainnet") {
			await validateDeploymentEnvironment(network);
		}

		const networkContracts = contractsData[network];
		if (!Is.object<IContractData>(networkContracts)) {
			throw new GeneralError("commands", "commands.deploy.noContractsFound", {
				network,
				contractsPath
			});
		}

		await deployContract("contract", networkContracts, config, network, dryRun, force);

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
 * Creates the network configuration.
 * @param network Target network to determine which env file to load.
 * @returns Network configuration.
 */
async function createNetworkConfig(network: NetworkTypes): Promise<INetworkConfig> {
	try {
		const rpcUrl = Coerce.string(process.env.RPC_URL);
		if (!Is.stringValue(rpcUrl)) {
			throw new GeneralError("commands", "commands.deploy.rpcUrlRequired", {
				network
			});
		}

		const config: INetworkConfig = {
			network,
			platform: "iota",
			rpc: {
				url: rpcUrl,
				timeout: Coerce.number(process.env.RPC_TIMEOUT) || 60000
			},
			deployment: {
				gasBudget: Coerce.number(process.env.GAS_BUDGET) || 50000000,
				confirmationTimeout: Coerce.number(process.env.CONFIRMATION_TIMEOUT) || 60,
				wallet: {
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

	if (!Is.stringValue(config.rpc?.url)) {
		throw new GeneralError("commands", "commands.deploy.rpcUrlRequired", {
			network: expectedNetwork
		});
	}

	if (!Is.number(config.deployment?.gasBudget)) {
		throw new GeneralError("commands", "commands.deploy.gasBudgetRequired", {
			network: expectedNetwork
		});
	}
}

/**
 * Load compiled contracts from file.
 * @param contractsPath Path to contracts file.
 * @returns Compiled contracts data.
 */
async function loadCompiledContracts(contractsPath: string): Promise<ISmartContractDeployments> {
	try {
		if (!(await CLIUtils.fileExists(contractsPath))) {
			throw new GeneralError("commands", "commands.deploy.contractsFileNotFound", {
				contractsPath
			});
		}

		const contracts = await CLIUtils.readJsonFile<ISmartContractDeployments>(contractsPath);

		if (!Is.object(contracts)) {
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
 * Validate environment and setup for deployment based on network type.
 * @param network Target network.
 * @param config Network configuration.
 * @param isDryRun Whether this is a dry run.
 * @returns Wallet address for the deployment.
 */
async function validateEnvironmentForNetwork(
	network: NetworkTypes,
	config: INetworkConfig,
	isDryRun: boolean = false
): Promise<string> {
	const walletAddress = await getDeploymentWalletAddress(
		network,
		config.deployment.wallet.addressIndex
	);

	if (isDryRun) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.dryRunWalletAddress"),
			walletAddress,
			1
		);
	} else {
		CLIDisplay.value(I18n.formatMessage("commands.deploy.labels.walletAddress"), walletAddress, 1);
	}

	if (network === "mainnet") {
		await validateDeploymentEnvironment(network);
	} else if ((network === "testnet" || network === "devnet") && !isDryRun) {
		// For testnet/devnet, request funds from faucet
		await requestFaucetFunds(network, walletAddress);
	}

	return walletAddress;
}

/**
 * Check wallet balance and display relevant information.
 * @param network Target network.
 * @param config Network configuration.
 * @param walletAddress Wallet address.
 * @param isDryRun Whether this is a dry run.
 * @returns Balance in nanos.
 */
async function checkWalletBalance(
	network: NetworkTypes,
	config: INetworkConfig,
	walletAddress: string,
	isDryRun: boolean = false
): Promise<number> {
	const client = new IotaClient({ url: config.rpc.url });
	const balanceIota = await client.getBalance({ owner: walletAddress });
	const balanceNumberIota = Number(balanceIota.totalBalance);
	const requiredIota = nanosToIota(config.deployment.gasBudget);

	const balanceLabel = isDryRun
		? "commands.deploy.labels.dryRunWalletBalance"
		: "commands.deploy.labels.walletBalance";
	const gasBudgetLabel = isDryRun
		? "commands.deploy.labels.dryRunGasBudget"
		: "commands.deploy.labels.gasBudget";

	CLIDisplay.value(I18n.formatMessage(balanceLabel), `${balanceNumberIota.toFixed(2)} IOTA`, 1);
	CLIDisplay.value(I18n.formatMessage(gasBudgetLabel), `${requiredIota.toFixed(2)} IOTA`, 1);

	// Handle insufficient balance based on network and run type
	if (balanceNumberIota < requiredIota) {
		if (isDryRun) {
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.warning"),
				I18n.formatMessage("commands.deploy.labels.insufficientBalanceWarning", {
					currentBalance: balanceNumberIota.toFixed(2),
					requiredBalance: requiredIota.toFixed(2)
				}),
				2
			);
		} else if (network === "mainnet") {
			throw new GeneralError("commands", "commands.deploy.insufficientBalance", {
				balance: balanceNumberIota,
				required: requiredIota,
				walletAddress
			});
		} else {
			// For testnet/devnet, show warning but continue
			CLIDisplay.value(
				I18n.formatMessage("commands.deploy.labels.warning"),
				I18n.formatMessage("commands.deploy.labels.insufficientBalanceAfterFaucet", {
					network,
					balance: balanceNumberIota.toFixed(2),
					required: requiredIota.toFixed(2),
					walletAddress
				}),
				2
			);
		}
	}

	return balanceNumberIota;
}

/**
 * Handle dry run validation and display.
 * @param contractName Name of the contract.
 * @param contractData Contract data.
 * @param config Network configuration.
 * @param network Target network.
 */
async function handleDryRunValidation(
	contractName: string,
	contractData: IContractData,
	config: INetworkConfig,
	network: NetworkTypes
): Promise<void> {
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
	CLIDisplay.value(I18n.formatMessage("commands.deploy.labels.dryRunRpcUrl"), config.rpc.url, 1);

	try {
		const walletAddress = await validateEnvironmentForNetwork(network, config, true);
		await checkWalletBalance(network, config, walletAddress, true);
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

/**
 * Handle actual deployment execution.
 * @param contractName Name of the contract.
 * @param contractData Contract data.
 * @param config Network configuration.
 * @param network Target network.
 */
async function handleActualDeployment(
	contractName: string,
	contractData: IContractData,
	config: INetworkConfig,
	network: NetworkTypes
): Promise<void> {
	try {
		const walletAddress = await validateEnvironmentForNetwork(network, config, false);
		await checkWalletBalance(network, config, walletAddress, false);

		const deploymentResult = await deployWithIotaCli(config.deployment.gasBudget);

		contractData.deployedPackageId = deploymentResult.packageId;
		contractData.upgradeCap = deploymentResult.upgradeCap;

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

	if (Is.stringValue(contractData.deployedPackageId) && !force) {
		CLIDisplay.value(
			I18n.formatMessage("commands.deploy.labels.contractAlreadyDeployed"),
			contractData.deployedPackageId,
			1
		);
		return;
	}

	if (dryRun) {
		await handleDryRunValidation(contractName, contractData, config, network);
		return;
	}

	await handleActualDeployment(contractName, contractData, config, network);
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
	const hexSeed = await getDeploymentSeed(network);
	let seed: Uint8Array | undefined;
	if (Is.stringValue(hexSeed)) {
		seed = Converter.hexToBytes(hexSeed);
	} else {
		const mnemonic = await getDeploymentMnemonic(network);
		seed = Bip39.mnemonicToSeed(mnemonic);
	}

	const addresses = Iota.getAddresses(seed, Iota.DEFAULT_COIN_TYPE, 0, addressIndex, 1, false);

	return addresses[0];
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
 * Request funds from the faucet for testnet or devnet deployment.
 * @param network The target network (testnet or devnet).
 * @param walletAddress The wallet address to fund.
 * @returns Promise that resolves when funding is complete.
 */
async function requestFaucetFunds(network: NetworkTypes, walletAddress: string): Promise<void> {
	if (network !== "testnet" && network !== "devnet") {
		return;
	}
	CLIDisplay.task(
		I18n.formatMessage("commands.deploy.progress.requestingFaucetFunds", { network })
	);

	const faucetUrl = process.env.FAUCET_URL ?? `https://faucet.${network}.iota.cafe`;

	const response = await requestIotaFromFaucetV0({
		host: faucetUrl,
		recipient: walletAddress
	});

	if (response?.error) {
		throw new GeneralError("commands", "commands.deploy.fundingFailed", undefined, response.error);
	}

	const client = new IotaClient({ url: process.env.RPC_URL ?? "" });
	const balanceIota = await client.getBalance({ owner: walletAddress });
	const balanceNumberIota = Number(balanceIota.totalBalance);

	if (balanceNumberIota > 0n) {
		const amountIota = nanosToIota(Number(balanceNumberIota));
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
}

/**
 * Deploy contract using IOTA CLI.
 * @param gasBudget Gas budget for deployment.
 * @returns Deployment result with package ID.
 */
async function deployWithIotaCli(
	gasBudget: number
): Promise<{ packageId: string; upgradeCap?: string }> {
	// Find the Move project directory
	const moveTomlPaths: string[] = [];
	await searchDirectoryForMoveToml(process.cwd(), moveTomlPaths);

	if (moveTomlPaths.length === 0) {
		throw new GeneralError("commands", "commands.deploy.noMoveTomlFilesFound", {
			currentDir: process.cwd()
		});
	}

	// Use the actual Move project directory
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
 * Update contracts file with deployed package IDs.
 * @param contractsPath Path to contracts file.
 * @param contractsData Updated contracts data.
 */
async function updateContractsFile(
	contractsPath: string,
	contractsData: ISmartContractDeployments
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
