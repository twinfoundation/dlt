// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Converter, GeneralError, StringHelper, I18n } from "@twin.org/core";
import { Sha3 } from "@twin.org/crypto";
import type { Command } from "commander";
import FastGlob from "fast-glob";
import type { NetworkTypes } from "../models/networkTypes";
import { verifyIotaSDK } from "../utils/iotaUtils.js";

/**
 * Build the build command to be consumed by the CLI.
 * @param program The command to build on.
 */
export function buildCommandBuild(program: Command): void {
	program
		.command("build")
		.description(I18n.formatMessage("commands.build.description"))
		.argument("<inputGlob>", I18n.formatMessage("commands.build.options.inputGlob.description"))
		.requiredOption(
			I18n.formatMessage("commands.build.options.network.param"),
			I18n.formatMessage("commands.build.options.network.description")
		)
		.option(
			I18n.formatMessage("commands.build.options.output.param"),
			I18n.formatMessage("commands.build.options.output.description"),
			"compiled-modules.json"
		)
		.action(async (inputGlob, opts) => {
			await actionCommandBuild(inputGlob, opts);
		});
}

/**
 * Action for the build command.
 * @param inputGlob A glob pattern that matches one or more Move files
 * @param opts Additional options.
 * @param opts.network Target network (testnet/devnet/mainnet).
 * @param opts.output Where we store the final compiled modules.
 */
export async function actionCommandBuild(
	inputGlob: string,
	opts: { network?: string; output?: string }
): Promise<void> {
	try {
		if (!opts.network) {
			throw new GeneralError("commands", "commands.build.networkRequired");
		}

		const validNetworks: NetworkTypes[] = ["testnet", "devnet", "mainnet"];
		if (!validNetworks.includes(opts.network as NetworkTypes)) {
			throw new GeneralError("commands", "commands.build.invalidNetwork", {
				network: opts.network,
				validNetworks: validNetworks.join(", ")
			});
		}

		const network = opts.network as NetworkTypes;

		// Verify the IOTA SDK before we do anything else
		await verifyIotaSDK();

		const { normalizedGlob, normalizedOutput, executionDir } = normalizePathsAndWorkingDir(
			inputGlob,
			opts.output ?? "compiled-modules.json"
		);

		CLIDisplay.section(
			I18n.formatMessage("commands.build.section.buildingMoveContracts", {
				network: network.toUpperCase()
			})
		);

		CLIDisplay.value(I18n.formatMessage("commands.build.labels.inputGlob"), inputGlob);
		CLIDisplay.value(I18n.formatMessage("commands.build.labels.outputJson"), normalizedOutput);
		CLIDisplay.value(I18n.formatMessage("commands.build.labels.network"), network);
		CLIDisplay.value(I18n.formatMessage("commands.build.labels.platform"), "iota");
		CLIDisplay.break();

		// Find matching .move files
		CLIDisplay.task(I18n.formatMessage("commands.build.progress.searchingFiles"));

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
			CLIDisplay.value(
				I18n.formatMessage("commands.build.warnings.noMoveFilesFound", { inputGlob }),
				"",
				2
			);
		}
		CLIDisplay.value(
			I18n.formatMessage("commands.build.labels.matchedFilesCount"),
			matchedFiles.length.toString()
		);
		CLIDisplay.break();

		// Prepare build environment
		CLIDisplay.task(I18n.formatMessage("commands.build.progress.preparingBuildEnvironment"));

		// Find all Move projects in the directory tree
		const moveProjects: string[] = [];
		await searchDirectoryForMoveToml(executionDir, moveProjects);

		for (const projectRoot of moveProjects) {
			CLIDisplay.value("Prepared project", projectRoot, 1);
		}

		const finalJson = {
			testnet: {},
			devnet: {},
			mainnet: {}
		};

		if (await CLIUtils.fileExists(normalizedOutput)) {
			try {
				const existingData = await fsPromises.readFile(normalizedOutput, "utf8");
				const existingJson = JSON.parse(existingData);

				if (existingJson.testnet) {
					Object.assign(finalJson.testnet, existingJson.testnet);
				}
				if (existingJson.devnet) {
					Object.assign(finalJson.devnet, existingJson.devnet);
				}
				if (existingJson.mainnet) {
					Object.assign(finalJson.mainnet, existingJson.mainnet);
				}

				CLIDisplay.value(
					I18n.formatMessage("commands.build.labels.mergingWithExistingJson"),
					normalizedOutput
				);
			} catch (err) {
				throw new GeneralError(
					"commands",
					"commands.build.failedReadingOutputJson",
					{ file: normalizedOutput },
					err
				);
			}
		} else {
			CLIDisplay.value(
				I18n.formatMessage("commands.build.labels.noExistingJsonFound"),
				I18n.formatMessage("commands.build.labels.creatingNewJsonStructure"),
				1
			);
		}

		CLIDisplay.break();

		for (const moveFile of matchedFiles) {
			CLIDisplay.task(I18n.formatMessage("commands.build.progress.processingMoveFile"), moveFile);
			try {
				const compiled = await processMoveFile(moveFile);
				if (compiled) {
					const { contractName, packageId, packageData } = compiled;

					const targetNetworkData = finalJson[network] as { [key: string]: unknown };

					targetNetworkData.packageId = packageId;
					targetNetworkData.package = packageData;

					if (targetNetworkData.deployedPackageId) {
						// Keep existing deployedPackageId
					} else {
						targetNetworkData.deployedPackageId = null;
					}

					CLIDisplay.value(`Updated ${network} package`, contractName, 2);
				}
			} catch (err) {
				throw new GeneralError(
					"commands",
					"commands.build.contractProcessingFailed",
					{ file: moveFile },
					err
				);
			}
			CLIDisplay.break();
		}

		// Ensure the output directory exists
		try {
			await fsPromises.mkdir(path.dirname(normalizedOutput), { recursive: true });
		} catch (err) {
			throw new GeneralError(
				"commands",
				"commands.build.mkdirFailed",
				{ dir: path.dirname(normalizedOutput) },
				err
			);
		}

		CLIDisplay.task(I18n.formatMessage("commands.build.progress.writingJsonFile"));
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
	const { name: baseName } = path.parse(moveFile);
	const contractName = StringHelper.kebabCase(baseName);

	// Find the "project root" (the directory containing Move.toml).
	const projectRoot = getProjectRoot(moveFile);

	CLIDisplay.value(I18n.formatMessage("commands.build.labels.contractName"), contractName, 1);
	CLIDisplay.value(I18n.formatMessage("commands.build.labels.platform"), "iota", 1);

	// Compile the contract
	try {
		const cliArgs = ["move", "build"];

		CLIDisplay.value(
			I18n.formatMessage("commands.build.labels.compileCommand"),
			`iota ${cliArgs.join(" ")}`,
			1
		);
		CLIDisplay.value(I18n.formatMessage("commands.build.labels.workingDirectory"), projectRoot, 1);

		await CLIUtils.runShellApp("iota", cliArgs, projectRoot);
		CLIDisplay.value(
			I18n.formatMessage("commands.build.labels.compileResult"),
			"Build completed",
			1
		);
	} catch (error) {
		throw new GeneralError(
			"commands",
			"commands.build.buildFailed",
			{ platform: "iota", file: moveFile },
			error
		);
	}

	// Get the bytecode modules
	const buildFolderName = StringHelper.snakeCase(baseName);
	const bytecodeModulesPath = path.join(projectRoot, "build", buildFolderName, "bytecode_modules");

	try {
		await fsPromises.access(bytecodeModulesPath);
	} catch {
		CLIDisplay.value(
			I18n.formatMessage("commands.build.warnings.noBytecodeModulesFolder", { contractName }),
			"",
			2
		);
		return null;
	}

	const moduleFiles = await fsPromises.readdir(bytecodeModulesPath);
	const mvFiles = moduleFiles.filter(f => f.endsWith(".mv"));
	if (mvFiles.length === 0) {
		CLIDisplay.value(
			I18n.formatMessage("commands.build.warnings.noMvFilesFound", { contractName }),
			"",
			2
		);
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

	CLIDisplay.value(
		I18n.formatMessage("commands.build.labels.computedPackageId"),
		computedPackageId,
		2
	);

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

/**
 * Recursively search a directory for Move.toml files.
 * @param dir Directory to search
 * @param moveProjects Array to collect found projects
 */
async function searchDirectoryForMoveToml(dir: string, moveProjects: string[]): Promise<void> {
	try {
		const entries = await fsPromises.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
				await searchDirectoryForMoveToml(fullPath, moveProjects);
			} else if (entry.isFile() && entry.name === "Move.toml") {
				moveProjects.push(dir);
			}
		}
	} catch {
		// Ignore directories that can't be read
	}
}
