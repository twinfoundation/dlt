// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { CLIUtils } from "@twin.org/cli-core";
import { GeneralError, Is, StringHelper, HexHelper } from "@twin.org/core";
import dotenv from "dotenv";
import type { NetworkTypes } from "../models/networkTypes.js";

/**
 * Get the mnemonic environment variable name for a network.
 * @param network The target network.
 * @returns The environment variable name for the deployer mnemonic.
 */
function getMnemonicEnvVar(network: NetworkTypes): string {
	const networkUpper = network.toUpperCase();
	return `${networkUpper}_DEPLOYER_MNEMONIC`;
}

/**
 * Get the seed environment variable name for a network.
 * @param network The target network.
 * @returns The environment variable name for the deployer seed.
 */
function getSeedEnvVar(network: NetworkTypes): string {
	const networkUpper = network.toUpperCase();
	return `${networkUpper}_DEPLOYER_SEED`;
}

/**
 * Load network-specific environment variables.
 * @param network The target network.
 * @returns The loaded environment variables.
 * @throws GeneralError if the environment file cannot be loaded.
 */
async function loadNetworkEnvironment(network: NetworkTypes): Promise<{ [key: string]: string }> {
	const envFilePath = StringHelper.trimTrailingSlashes(
		path.join(process.cwd(), "configs", `${network}.env`)
	);

	if (!(await CLIUtils.fileExists(envFilePath))) {
		throw new GeneralError("envSetup", "envFileNotFound", {
			network,
			envFilePath
		});
	}

	const result = dotenv.config({ path: envFilePath });

	if (result.error) {
		throw new GeneralError("envSetup", "envFileLoadFailed", {
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
export async function validateDeploymentEnvironment(network: NetworkTypes): Promise<void> {
	const envVars = await loadNetworkEnvironment(network);
	const mnemonicVar = getMnemonicEnvVar(network);
	const mnemonic = envVars[mnemonicVar];

	if (!Is.stringValue(mnemonic)) {
		throw new GeneralError("envSetup", "mnemonicMissing", {
			network,
			mnemonicVar
		});
	}

	// Validate mnemonic format (should be 24 words)
	const words = mnemonic.trim().split(/\s+/);
	if (words.length !== 24) {
		throw new GeneralError("envSetup", "mnemonicInvalidFormat", {
			network,
			mnemonicVar,
			wordCount: words.length
		});
	}
}

/**
 * Get the deployment mnemonic for a network.
 * @param network The target network.
 * @returns The mnemonic string.
 * @throws GeneralError if mnemonic is not found or invalid.
 */
export async function getDeploymentMnemonic(network: NetworkTypes): Promise<string> {
	const envVars = await loadNetworkEnvironment(network);
	const mnemonicVar = getMnemonicEnvVar(network);
	const mnemonic = envVars[mnemonicVar];

	if (!Is.stringValue(mnemonic)) {
		throw new GeneralError("envSetup", "mnemonicValidationFailed", {
			network,
			mnemonicVar
		});
	}

	// Validate mnemonic format (should be 24 words)
	const words = mnemonic.trim().split(/\s+/);
	if (words.length !== 24) {
		throw new GeneralError("envSetup", "mnemonicInvalidFormat", {
			network,
			mnemonicVar,
			wordCount: words.length
		});
	}

	return mnemonic;
}

/**
 * Get the deployment seed for a network (if available).
 * @param network The target network.
 * @returns The seed string or undefined if not set.
 * @throws GeneralError if seed is not found or invalid.
 */
export async function getDeploymentSeed(network: NetworkTypes): Promise<string | undefined> {
	const envVars = await loadNetworkEnvironment(network);
	const seedVar = getSeedEnvVar(network);
	const seed = envVars[seedVar];

	if (!Is.stringValue(seed)) {
		return undefined;
	}

	if (!HexHelper.hasPrefix(seed) || !HexHelper.isHex(seed.slice(2))) {
		throw new GeneralError("envSetup", "seedInvalidFormat", {
			network,
			seedVar,
			seed: `${seed.slice(0, 20)}...`
		});
	}

	if (seed.length < 66) {
		// 0x + 64 hex characters
		throw new GeneralError("envSetup", "seedInvalidFormat", {
			network,
			seedVar,
			seed: `${seed.slice(0, 20)}...`
		});
	}

	return seed;
}
