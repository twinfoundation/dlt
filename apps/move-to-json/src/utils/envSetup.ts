// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GeneralError, Is } from "@twin.org/core";
import dotenv from "dotenv";

// Get the directory of this module
const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

// Load environment variables from .env and .env.dev files
// Look for .env files in the project root (two levels up from src/utils)
const projectRoot = path.resolve(currentDirname, "../..");
const envPaths = [path.join(projectRoot, ".env"), path.join(projectRoot, ".env.dev")];

dotenv.config({ path: envPaths });

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
 * Validate that required environment variables are set for deployment.
 * @param network The target network.
 * @throws GeneralError if required environment variables are missing.
 */
export function validateDeploymentEnvironment(network: NetworkType): void {
	const mnemonicVar = getMnemonicEnvVar(network);
	const mnemonic = process.env[mnemonicVar];

	if (!Is.stringValue(mnemonic)) {
		throw new GeneralError(
			"envSetup",
			`Missing deployment mnemonic for ${network}. Please set ${mnemonicVar} in your environment or .env.dev file.
			
You can generate a mnemonic using:
npx "@twin.org/wallet-cli" mnemonic --env wallet.env
npx "@twin.org/wallet-cli" address --load-env wallet.env --seed '!SEED' --count 5 --env address.env

Then copy the MNEMONIC value to your .env.dev file:
${mnemonicVar}="word1 word2 word3 ... word24"`,
			{ network, mnemonicVar }
		);
	}

	// Validate mnemonic format (should be 24 words)
	const words = mnemonic.trim().split(/\s+/);
	if (words.length !== 24) {
		throw new GeneralError(
			"envSetup",
			`Invalid mnemonic format for ${network}. Expected 24 words, got ${words.length}.
Please ensure ${mnemonicVar} contains a valid 24-word mnemonic phrase.`,
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
	validateDeploymentEnvironment(network);
	const mnemonicVar = getMnemonicEnvVar(network);
	const mnemonic = process.env[mnemonicVar];
	if (!Is.stringValue(mnemonic)) {
		throw new GeneralError("envSetup", "Mnemonic validation failed", { network, mnemonicVar });
	}
	return mnemonic;
}
