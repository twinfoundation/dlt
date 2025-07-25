// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Is } from "@twin.org/core";
import type { NetworkTypes } from "../models/networkTypes.js";

/**
 * Validate that required environment variables are set for deployment.
 * @param network The target network.
 * @throws GeneralError if required environment variables are missing.
 */
export async function validateDeploymentEnvironment(network: NetworkTypes): Promise<void> {
	await getDeploymentMnemonic(network);
}

/**
 * Get the deployment mnemonic for a network.
 * @param network The target network.
 * @returns The mnemonic string.
 * @throws GeneralError if mnemonic is not found or invalid.
 */
export async function getDeploymentMnemonic(network: NetworkTypes): Promise<string> {
	const mnemonic = process.env.DEPLOYER_MNEMONIC;

	if (!mnemonic) {
		throw new GeneralError("envSetup", "mnemonicMissing", {
			network,
			mnemonicVar: "DEPLOYER_MNEMONIC"
		});
	}

	// Validate mnemonic format (should be 24 words)
	const words = mnemonic.trim().split(/\s+/);
	if (words.length !== 24) {
		throw new GeneralError("envSetup", "mnemonicInvalidFormat", {
			network,
			mnemonicVar: "DEPLOYER_MNEMONIC",
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
	const seed = process.env.DEPLOYER_SEED;

	if (!Is.stringValue(seed)) {
		return undefined;
	}

	if (!Is.stringHex(seed, true)) {
		throw new GeneralError("envSetup", "seedInvalidFormat", {
			network,
			seedVar: "DEPLOYER_SEED"
		});
	}

	if (seed.length < 66) {
		// 0x + 64 hex characters
		throw new GeneralError("envSetup", "seedInvalidFormat", {
			network,
			seedVar: "DEPLOYER_SEED"
		});
	}

	return seed;
}
