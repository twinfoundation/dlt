// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Converter, GeneralError, I18n, StringHelper } from "@twin.org/core";
import { Sha3 } from "@twin.org/crypto";
import { Option, type Command } from "commander";
import FastGlob from "fast-glob";
import type { ICompiledModules } from "../models/ICompiledModules";
import { PlatformTypes } from "../models/platformTypes";

/**
 * Build the root command to be consumed by the CLI.
 * @param program The command to build on.
 */
export function buildCommandMoveToJson(program: Command): void {
	program
		.argument(
			I18n.formatMessage("commands.move-to-json.options.inputGlob.param"),
			I18n.formatMessage("commands.move-to-json.options.inputGlob.description")
		)
		.argument(
			I18n.formatMessage("commands.move-to-json.options.outputJson.param"),
			I18n.formatMessage("commands.move-to-json.options.outputJson.description")
		)
		.addOption(
			new Option(
				I18n.formatMessage("commands.move-to-json.options.platform.param"),
				I18n.formatMessage("commands.move-to-json.options.platform.description")
			)
				.choices(Object.values(PlatformTypes))
				.default(PlatformTypes.Iota)
		)
		.action(async (inputGlob, outputJson, opts) => {
			await actionCommandMoveToJson(inputGlob, outputJson, opts);
		});
}

/**
 * Action the root command.
 * @param inputGlob A glob pattern that matches one or more Move files
 * @param outputJson Where we store the final compiled modules.
 * @param opts Additional options, e.g. platform.
 * @param opts.platform The platform type.
 */
export async function actionCommandMoveToJson(
	inputGlob: string,
	outputJson: string,
	opts: { platform?: PlatformTypes }
): Promise<void> {
	try {
		// Verify the SDK before we do anything else
		await verifyPlatformSDK(opts.platform ?? PlatformTypes.Iota);

		// Normalize paths and get working directory
		const { normalizedGlob, normalizedOutput, executionDir } = normalizePathsAndWorkingDir(
			inputGlob,
			outputJson
		);

		CLIDisplay.section(I18n.formatMessage("commands.move-to-json.section.start"));

		CLIDisplay.value(I18n.formatMessage("commands.move-to-json.labels.inputGlob"), inputGlob);
		CLIDisplay.value(
			I18n.formatMessage("commands.move-to-json.labels.outputJson"),
			normalizedOutput
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.move-to-json.labels.platform"),
			opts.platform ?? PlatformTypes.Iota
		);
		CLIDisplay.break();

		// Find matching .move files
		CLIDisplay.task(I18n.formatMessage("commands.move-to-json.progress.searchingFiles"));

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
				I18n.formatMessage("commands.move-to-json.warnings.noMoveFilesFound", {
					inputGlob
				}),
				2
			);
		}
		CLIDisplay.value(
			I18n.formatMessage("commands.move-to-json.labels.matchedFilesCount"),
			matchedFiles.length.toString()
		);
		CLIDisplay.break();

		let finalJson: ICompiledModules = {};

		if (await CLIUtils.fileExists(normalizedOutput)) {
			try {
				const existingData = await fsPromises.readFile(normalizedOutput, "utf8");
				finalJson = JSON.parse(existingData);
				CLIDisplay.value(
					I18n.formatMessage("commands.move-to-json.labels.mergingWithExistingJson"),
					normalizedOutput
				);
			} catch (err) {
				throw new GeneralError(
					"commands",
					"commands.move-to-json.failedReadingOutputJson",
					{ file: normalizedOutput },
					err
				);
			}
		} else {
			CLIDisplay.value(
				I18n.formatMessage("commands.move-to-json.labels.noExistingJsonFound"),
				I18n.formatMessage("commands.move-to-json.labels.creatingNewJson"),
				1
			);
		}

		CLIDisplay.break();

		for (const moveFile of matchedFiles) {
			CLIDisplay.task(
				I18n.formatMessage("commands.move-to-json.progress.processingMoveFile"),
				moveFile
			);
			try {
				const compiled = await processMoveFile(moveFile, opts.platform ?? PlatformTypes.Iota);
				if (compiled) {
					// Merge into finalJson
					const { contractName, packageId, packageData } = compiled;
					finalJson[contractName] = { packageId, package: packageData };
				}
			} catch (err) {
				throw new GeneralError(
					"commands",
					"commands.move-to-json.contractProcessingFailed",
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
				"commands.move-to-json.mkdirFailed",
				{
					dir: path.dirname(normalizedOutput)
				},
				err
			);
		}

		CLIDisplay.task(I18n.formatMessage("commands.move-to-json.progress.writingJsonFile"));
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
 * @param platform The platform type
 * @returns The compiled results or null if no modules found.
 */
async function processMoveFile(
	moveFile: string,
	platform: PlatformTypes
): Promise<{
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

	CLIDisplay.value(
		I18n.formatMessage("commands.move-to-json.labels.contractName"),
		contractName,
		1
	);
	CLIDisplay.value(I18n.formatMessage("commands.move-to-json.labels.platform"), platform, 1);

	// Compile the contract
	try {
		const cliApp = platform === PlatformTypes.Iota ? "iota" : "sui";
		const cliArgs = ["move", "build"];

		CLIDisplay.value(
			I18n.formatMessage("commands.move-to-json.labels.compileCmd"),
			`${cliApp} ${cliArgs.join(" ")}`,
			1
		);
		CLIDisplay.value(I18n.formatMessage("commands.move-to-json.labels.workingDir"), parentDir, 1);

		await CLIUtils.runShellApp(cliApp, cliArgs, parentDir);
		CLIDisplay.value(
			I18n.formatMessage("commands.move-to-json.labels.compileResult"),
			"Build completed",
			1
		);
	} catch (error) {
		throw new GeneralError(
			"commands",
			"commands.move-to-json.buildFailed",
			{ platform, file: moveFile },
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
			I18n.formatMessage("commands.move-to-json.warnings.noBytecodeModulesFolderFound", {
				contract: contractName
			}),
			2
		);
		return null;
	}

	const moduleFiles = await fsPromises.readdir(bytecodeModulesPath);
	const mvFiles = moduleFiles.filter(f => f.endsWith(".mv"));
	if (mvFiles.length === 0) {
		CLIDisplay.value(
			I18n.formatMessage("commands.move-to-json.warnings.noMvFilesFound", {
				contract: contractName
			}),
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
		I18n.formatMessage("commands.move-to-json.labels.computedPackageId"),
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
 * Verify the required platform SDK is installed.
 * @param platform The platform to verify.
 * @internal
 */
async function verifyPlatformSDK(platform: string): Promise<void> {
	try {
		const cliApp = platform === PlatformTypes.Iota ? "iota" : "sui";
		await CLIUtils.runShellApp(cliApp, ["--version"], process.cwd());
	} catch (err) {
		throw new GeneralError("commands", "commands.move-to-json.sdkNotInstalled", { platform }, err);
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
	const executionDir = process.env.INIT_CWD ?? process.cwd();

	// Normalize paths for cross-platform compatibility
	const normalizedGlob = inputGlob.replace(/\\/g, "/");

	// Make output path absolute if it's relative
	const normalizedOutput = path.isAbsolute(outputJson)
		? outputJson
		: path.join(executionDir, outputJson);

	return {
		normalizedGlob,
		normalizedOutput,
		executionDir
	};
}
