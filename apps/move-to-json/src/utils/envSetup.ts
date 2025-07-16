// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { GeneralError, Is } from "@twin.org/core";
import dotenv from "dotenv";

/**
 * Network types supported for deployment
 */
export type NetworkType = "testnet" | "devnet" | "mainnet";

/**
 * Get the mnemonic environment variable name for a network.
 * @param network The target network.
 * @returns The environment variable name for the deployer mnemonic.
 */
function getMnemonicEnvVar(network: NetworkType): string {
	const networkUpper = network.toUpperCase();
	return `${networkUpper}_DEPLOYER_MNEMONIC`;
}

/**
 * Get the seed environment variable name for a network.
 * @param network The target network.
 * @returns The environment variable name for the deployer seed.
 */
function getSeedEnvVar(network: NetworkType): string {
	const networkUpper = network.toUpperCase();
	return `${networkUpper}_DEPLOYER_SEED`;
}

/**
 * Load network-specific environment variables.
 * @param network The target network.
 * @returns The loaded environment variables.
 * @throws GeneralError if the environment file cannot be loaded.
 */
function loadNetworkEnvironment(network: NetworkType): { [key: string]: string } {
	const envFilePath = path.join(process.cwd(), "configs", `${network}.env`);
	const result = dotenv.config({ path: envFilePath });

	if (result.error) {
		throw new GeneralError("envSetup", `Failed to load environment file: ${envFilePath}`, {
			network,
			envFilePath,
			error: result.error.message
		});
	}

	return result.parsed ?? {};
}

/**
 * Validate that required environment variables are set for deployment.
 * @param network The target network.
 * @throws GeneralError if required environment variables are missing.
 */
export function validateDeploymentEnvironment(network: NetworkType): void {
	const envVars = loadNetworkEnvironment(network);
	const mnemonicVar = getMnemonicEnvVar(network);
	const mnemonic = envVars[mnemonicVar];

	if (!Is.stringValue(mnemonic)) {
		throw new GeneralError(
			"envSetup",
			`Missing deployment mnemonic for ${network}. Please set ${mnemonicVar} in configs/${network}.env file.
			
You can generate a mnemonic using:
npx "@twin.org/wallet-cli" mnemonic --env wallet.env

Then add the MNEMONIC value to your configs/${network}.env file:
${mnemonicVar}="word1 word2 word3 ... word24"

See configs/${network}.env.example for reference.`,
			{ network, mnemonicVar }
		);
	}

	// Validate mnemonic format (should be 24 words)
	const words = mnemonic.trim().split(/\s+/);
	if (words.length !== 24) {
		throw new GeneralError(
			"envSetup",
			`Invalid mnemonic format for ${network}. Expected 24 words, got ${words.length}.
Please ensure ${mnemonicVar} in configs/${network}.env contains a valid 24-word mnemonic phrase.`,
			{ network, mnemonicVar, wordCount: words.length }
		);
	}
}

/**
 * Get the deployment mnemonic for a network.
 * @param network The target network.
 * @returns The mnemonic string.
 * @throws GeneralError if mnemonic is not found or invalid.
 */
export function getDeploymentMnemonic(network: NetworkType): string {
	const envVars = loadNetworkEnvironment(network);
	const mnemonicVar = getMnemonicEnvVar(network);
	const mnemonic = envVars[mnemonicVar];

	if (!Is.stringValue(mnemonic)) {
		throw new GeneralError("envSetup", "Mnemonic validation failed", { network, mnemonicVar });
	}

	// Validate mnemonic format (should be 24 words)
	const words = mnemonic.trim().split(/\s+/);
	if (words.length !== 24) {
		throw new GeneralError(
			"envSetup",
			`Invalid mnemonic format for ${network}. Expected 24 words, got ${words.length}.`,
			{ network, mnemonicVar, wordCount: words.length }
		);
	}

	return mnemonic;
}

/**
 * Get the deployment seed for a network (if available).
 * @param network The target network.
 * @returns The seed string or undefined if not set.
 * @throws GeneralError if seed is not found or invalid.
 */
export function getDeploymentSeed(network: NetworkType): string | undefined {
	const envVars = loadNetworkEnvironment(network);
	const seedVar = getSeedEnvVar(network);
	const seed = envVars[seedVar];

	if (!Is.stringValue(seed)) {
		return undefined;
	}

	// Validate seed format (should be a hex string starting with 0x)
	if (!seed.startsWith("0x") || seed.length < 64) {
		throw new GeneralError(
			"envSetup",
			`Invalid seed format for ${network}. Expected hex string starting with 0x and at least 64 characters.
Please ensure ${seedVar} in configs/${network}.env contains a valid hex seed value.`,
			{ network, seedVar, seed: `${seed.slice(0, 20)}...` }
		);
	}

	return seed;
}
