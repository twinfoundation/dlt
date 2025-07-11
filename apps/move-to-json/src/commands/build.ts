// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Converter, GeneralError, StringHelper } from "@twin.org/core";
import { Sha3 } from "@twin.org/crypto";
import type { Command } from "commander";
import FastGlob from "fast-glob";

/**
 * Build the build command to be consumed by the CLI.
 * @param program The command to build on.
 */
export function buildCommandBuild(program: Command): void {
	program
		.command("build")
		.description("Compile Move contracts and generate network-aware JSON structure")
		.argument("<inputGlob>", "A glob pattern that matches one or more Move files")
		.option("--output <file>", "Output file for compiled modules JSON", "compiled-modules.json")
		.action(async (inputGlob, opts) => {
			await actionCommandBuild(inputGlob, opts);
		});
}

/**
 * Action for the build command.
 * @param inputGlob A glob pattern that matches one or more Move files
 * @param opts Additional options.
 * @param opts.output Where we store the final compiled modules.
 */
export async function actionCommandBuild(
	inputGlob: string,
	opts: { output?: string }
): Promise<void> {
	try {
		// Verify the IOTA SDK before we do anything else
		await verifyIotaSDK();

		// Normalize paths and get working directory
		const { normalizedGlob, normalizedOutput, executionDir } = normalizePathsAndWorkingDir(
			inputGlob,
			opts.output ?? "compiled-modules.json"
		);

		CLIDisplay.section("Building Move Contracts");

		CLIDisplay.value("Input Glob", inputGlob);
		CLIDisplay.value("Output JSON", normalizedOutput);
		CLIDisplay.value("Platform", "iota");
		CLIDisplay.break();

		// Find matching .move files
		CLIDisplay.task("Searching for Move files...");

		const matchedFiles = await FastGlob(
			[normalizedGlob, "!**/build/**/*.move", "!**/dependencies/**/*.move"],
			{
				cwd: executionDir,
				absolute: true,
				dot: true,
				followSymbolicLinks: false,
				caseSensitiveMatch: false, // Important for Windows
				onlyFiles: true,
				stats: false
			}
		);

		if (matchedFiles.length === 0) {
			CLIDisplay.value("Warning: No Move files found for pattern", inputGlob, 2);
		}
		CLIDisplay.value("Matched Files Count", matchedFiles.length.toString());
		CLIDisplay.break();

		// Initialize the network-aware JSON structure
		const finalJson = {
			testnet: {},
			devnet: {},
			mainnet: {}
		};

		// Check if output file exists and merge with existing structure
		if (await CLIUtils.fileExists(normalizedOutput)) {
			try {
				const existingData = await fsPromises.readFile(normalizedOutput, "utf8");
				const existingJson = JSON.parse(existingData);

				// Merge existing data, preserving network-specific deployed package IDs
				if (existingJson.testnet) {
					Object.assign(finalJson.testnet, existingJson.testnet);
				}
				if (existingJson.devnet) {
					Object.assign(finalJson.devnet, existingJson.devnet);
				}
				if (existingJson.mainnet) {
					Object.assign(finalJson.mainnet, existingJson.mainnet);
				}

				CLIDisplay.value("Merging with existing JSON", normalizedOutput);
			} catch (err) {
				throw new GeneralError(
					"commands",
					"Failed to read existing output JSON",
					{ file: normalizedOutput },
					err
				);
			}
		} else {
			CLIDisplay.value("No existing JSON found", "Creating new JSON structure", 1);
		}

		CLIDisplay.break();

		// Process each Move file
		for (const moveFile of matchedFiles) {
			CLIDisplay.task("Processing Move file", moveFile);
			try {
				const compiled = await processMoveFile(moveFile);
				if (compiled) {
					const { contractName, packageId, packageData } = compiled;

					// Add compiled contract to all networks (packageId and package are same for all networks)
					const networks = [finalJson.testnet, finalJson.devnet, finalJson.mainnet];

					for (let i = 0; i < networks.length; i++) {
						const networkData = networks[i] as { [key: string]: { [key: string]: unknown } };
						if (!networkData[contractName]) {
							networkData[contractName] = {};
						}
						networkData[contractName].packageId = packageId;
						networkData[contractName].package = packageData;

						// Preserve existing deployedPackageId if it exists
						if (networkData[contractName].deployedPackageId) {
							// Keep existing deployedPackageId
						} else {
							// Initialize as null - will be set by deploy command
							networkData[contractName].deployedPackageId = null;
						}
					}
				}
			} catch (err) {
				throw new GeneralError("commands", "Contract processing failed", { file: moveFile }, err);
			}
			CLIDisplay.break();
		}

		// Ensure the output directory exists
		try {
			await fsPromises.mkdir(path.dirname(normalizedOutput), { recursive: true });
		} catch (err) {
			throw new GeneralError(
				"commands",
				"Failed to create directory",
				{ dir: path.dirname(normalizedOutput) },
				err
			);
		}

		CLIDisplay.task("Writing JSON file...");
		await CLIUtils.writeJsonFile(normalizedOutput, finalJson, true);

		CLIDisplay.break();
		CLIDisplay.done();
	} catch (err) {
		CLIDisplay.error(err);
	}
}

/**
 * Process a single Move file by compiling it, computing the packageId, and base64-encoding the .mv modules.
 * @param moveFile The path to a single Move source file.
 * @returns The compiled results or null if no modules found.
 */
async function processMoveFile(moveFile: string): Promise<{
	contractName: string;
	packageId: string;
	packageData: string | string[];
} | null> {
	// The contract name is based on the .move file's base name in kebab-case
	const { name: baseName, dir } = path.parse(moveFile);
	const parentDir = path.resolve(dir, "../");
	const contractName = StringHelper.kebabCase(baseName);

	// Find the "project root" (the directory containing Move.toml).
	const projectRoot = getProjectRoot(moveFile);

	CLIDisplay.value("Contract Name", contractName, 1);
	CLIDisplay.value("Platform", "iota", 1);

	// Compile the contract
	try {
		const cliArgs = ["move", "build"];

		CLIDisplay.value("Compile Command", `iota ${cliArgs.join(" ")}`, 1);
		CLIDisplay.value("Working Directory", parentDir, 1);

		await CLIUtils.runShellApp("iota", cliArgs, parentDir);
		CLIDisplay.value("Compile Result", "Build completed", 1);
	} catch (error) {
		throw new GeneralError("commands", "Build failed", { platform: "iota", file: moveFile }, error);
	}

	// Get the bytecode modules
	const buildFolderName = StringHelper.snakeCase(baseName);
	const bytecodeModulesPath = path.join(projectRoot, "build", buildFolderName, "bytecode_modules");

	try {
		await fsPromises.access(bytecodeModulesPath);
	} catch {
		CLIDisplay.value("Warning: No bytecode modules folder found", contractName, 2);
		return null;
	}

	const moduleFiles = await fsPromises.readdir(bytecodeModulesPath);
	const mvFiles = moduleFiles.filter(f => f.endsWith(".mv"));
	if (mvFiles.length === 0) {
		CLIDisplay.value("Warning: No .mv files found", contractName, 2);
		return null;
	}

	// Compute the package ID
	const modulesBytesForHash: Buffer[] = [];
	const modulesBase64: string[] = [];

	for (const file of mvFiles) {
		const modulePath = path.join(bytecodeModulesPath, file);
		const moduleBytes = await fsPromises.readFile(modulePath);

		modulesBytesForHash.push(moduleBytes);
		modulesBase64.push(Converter.bytesToBase64(moduleBytes));
	}

	const concatenated = Buffer.concat(modulesBytesForHash);
	const computedPackageIdBytes = Sha3.sum256(concatenated);
	const computedPackageId = `${Converter.bytesToHex(computedPackageIdBytes, true)}`;

	CLIDisplay.value("Computed Package ID", computedPackageId, 2);

	// If multiple modules, store them as an array
	const packageData = modulesBase64.length === 1 ? modulesBase64[0] : modulesBase64;

	return {
		contractName,
		packageId: computedPackageId,
		packageData
	};
}

/**
 * Get the project root directory from a Move file path.
 * @param moveFilePath The path to a Move source file.
 * @returns The project root directory.
 */
function getProjectRoot(moveFilePath: string): string {
	return path.resolve(path.parse(moveFilePath).dir, "..");
}

/**
 * Verify the IOTA SDK is installed.
 * @internal
 */
async function verifyIotaSDK(): Promise<void> {
	try {
		CLIDisplay.section("Checking IOTA SDK...");
		await CLIUtils.runShellApp("iota", ["--version"], process.cwd());
		CLIDisplay.break();
	} catch (err) {
		throw new GeneralError("commands", "IOTA SDK not installed", { platform: "iota" }, err);
	}
}

/**
 * Normalize paths and resolve working directory for cross-platform compatibility.
 * @param inputGlob The input glob pattern
 * @param outputJson The output JSON file path
 * @returns Normalized paths and working directory
 */
function normalizePathsAndWorkingDir(
	inputGlob: string,
	outputJson: string
): {
	normalizedGlob: string;
	normalizedOutput: string;
	executionDir: string;
} {
	// Get the directory where the command was run
	const executionDir = process.cwd();

	// Normalize paths for cross-platform compatibility
	const normalizedGlob = path.resolve(inputGlob).replace(/\\/g, "/");
	const normalizedOutput = path.resolve(outputJson);

	return {
		normalizedGlob,
		normalizedOutput,
		executionDir
	};
}
