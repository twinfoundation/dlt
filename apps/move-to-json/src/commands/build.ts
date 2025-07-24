// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Converter, GeneralError, StringHelper, I18n, Guards } from "@twin.org/core";
import { Sha3 } from "@twin.org/crypto";
import { nameof } from "@twin.org/nameof";
import type { Command } from "commander";
import FastGlob from "fast-glob";
import type { IContractData } from "../models/IContractData";
import type { ISmartContractDeployments } from "../models/ISmartContractDeployments";
import { NetworkTypes } from "../models/networkTypes";
import { verifyIotaSDK } from "../utils/iotaUtils.js";
import { searchDirectoryForMoveToml } from "../utils/moveToJsonUtils.js";

/**
 * Build the build command to be consumed by the CLI.
 * @param program The command to build on.
 */
export function buildCommandBuild(program: Command): void {
	program
		.command("build")
		.description(I18n.formatMessage("commands.build.description"))
		.argument("<inputGlob>", I18n.formatMessage("commands.build.options.inputGlob.description"))
		.option(
			I18n.formatMessage("commands.build.options.network.param"),
			I18n.formatMessage("commands.build.options.network.description")
		)
		.option(
			I18n.formatMessage("commands.build.options.output.param"),
			I18n.formatMessage("commands.build.options.output.description"),
			"smart-contract-deployments.json"
		)
		.action(async (inputGlob, opts) => {
			await actionCommandBuild(inputGlob, opts);
		});
}

/**
 * Action for the build command.
 * @param inputGlob A glob pattern that matches one or more Move files
 * @param opts Additional options.
 * @param opts.network Target network (testnet/devnet/mainnet) - optional if NETWORK env var is set.
 * @param opts.output Where we store the final compiled modules.
 */
export async function actionCommandBuild(
	inputGlob: string,
	opts: { network?: NetworkTypes; output?: string }
): Promise<void> {
	try {
		const network = opts.network ?? (process.env.NETWORK as NetworkTypes);

		if (!network) {
			throw new GeneralError("commands", "commands.build.networkRequired");
		}

		Guards.arrayOneOf("commands", nameof(network), network, Object.values(NetworkTypes));

		// Verify the IOTA SDK before we do anything else
		await verifyIotaSDK();

		const { normalizedGlob, normalizedOutput, executionDir } = normalizePathsAndWorkingDir(
			inputGlob,
			opts.output ?? "smart-contract-deployments.json"
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

		const existingJson = await CLIUtils.readJsonFile<ISmartContractDeployments>(normalizedOutput);
		const finalJson: ISmartContractDeployments = existingJson ?? {};

		finalJson[network] ??= {} as IContractData;

		if (existingJson) {
			CLIDisplay.value(
				I18n.formatMessage("commands.build.labels.mergingWithExistingJson"),
				normalizedOutput
			);
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

					const targetNetworkData = finalJson[network];

					targetNetworkData.packageId = packageId;
					targetNetworkData.package = packageData;

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

	// Improved path normalization with StringHelper
	const normalizedGlob = StringHelper.trimTrailingSlashes(
		path.resolve(inputGlob).replace(/\\/g, "/")
	);
	const normalizedOutput = path.resolve(outputJson);

	return {
		normalizedGlob,
		normalizedOutput,
		executionDir
	};
}
