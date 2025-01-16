// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import fs from "node:fs";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Converter, GeneralError, I18n, StringHelper } from "@twin.org/core";
import { Sha3 } from "@twin.org/crypto";
import type { Command } from "commander";
import globby from "globby";
import type { ICompiledModules } from "../models/ICompiledModules";

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
		.option(
			"--platform <platform>",
			I18n.formatMessage("commands.move-to-json.options.platform.description"),
			"iota"
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
 * @param opts.platform The platform (e.g. 'iota' or 'sui').
 */
export async function actionCommandMoveToJson(
	inputGlob: string,
	outputJson: string,
	opts: { platform?: string }
): Promise<void> {
	try {
		CLIDisplay.section(I18n.formatMessage("commands.move-to-json.section.start"));

		CLIDisplay.value(I18n.formatMessage("commands.move-to-json.labels.inputGlob"), inputGlob);
		CLIDisplay.value(I18n.formatMessage("commands.move-to-json.labels.outputJson"), outputJson);
		CLIDisplay.value(
			I18n.formatMessage("commands.move-to-json.labels.platform"),
			opts.platform ?? "iota"
		);
		CLIDisplay.break();

		// Find matching .move files
		CLIDisplay.task(I18n.formatMessage("commands.move-to-json.progress.searchingFiles"));
		const matchedFiles = await globby(inputGlob);

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
		if (fs.existsSync(outputJson)) {
			try {
				const existingData = fs.readFileSync(outputJson, "utf8");
				finalJson = JSON.parse(existingData);
				CLIDisplay.value(
					I18n.formatMessage("commands.move-to-json.labels.mergingWithExistingJson"),
					outputJson
				);
			} catch (err) {
				throw new GeneralError(
					"commands",
					"commands.move-to-json.failedReadingOutputJson",
					{ file: outputJson },
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
				const compiled = await processMoveFile(moveFile, opts.platform ?? "iota");
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
			await fs.promises.mkdir(path.dirname(outputJson), { recursive: true });
		} catch (err) {
			throw new GeneralError(
				"commands",
				"commands.move-to-json.mkdirFailed",
				{
					dir: path.dirname(outputJson)
				},
				err
			);
		}

		CLIDisplay.task(I18n.formatMessage("commands.move-to-json.progress.writingJsonFile"));
		await CLIUtils.writeJsonFile(outputJson, finalJson, true);

		CLIDisplay.break();
		CLIDisplay.done();
	} catch (err) {
		CLIDisplay.error(err);
	}
}

/**
 * Process a single Move file by compiling it, computing the packageId, and base64-encoding the .mv modules.
 * @param moveFile The path to a single Move source file.
 * @param platform The platform (e.g. 'iota' or 'sui').
 * @returns The compiled results or null if no modules found.
 */
async function processMoveFile(
	moveFile: string,
	platform: string
): Promise<{
	contractName: string;
	packageId: string;
	packageData: string | string[];
} | null> {
	// The contract name is based on the .move file's base name in kebab-case
	const { name: baseName, dir: parentDir } = path.parse(moveFile);
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
		const cliApp = platform === "sui" ? "sui" : "iota";
		const cliArgs = ["move", "build"];

		CLIDisplay.value(
			I18n.formatMessage("commands.move-to-json.labels.compileCmd"),
			`${cliApp} ${cliArgs.join(" ")}`,
			1
		);
		CLIDisplay.value(I18n.formatMessage("commands.move-to-json.labels.workingDir"), parentDir, 1);
		CLIDisplay.value(I18n.formatMessage("commands.move-to-json.labels.workingDir"), parentDir, 1);

		await CLIUtils.runShellCmd(cliApp, cliArgs, parentDir);
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
	if (!fs.existsSync(bytecodeModulesPath)) {
		CLIDisplay.value(
			"commands.move-to-json.warnings.noBytecodeModulesFolderFound",
			{
				contract: contractName
			},
			2
		);
		return null;
	}

	// Get the module files
	const moduleFiles = fs.readdirSync(bytecodeModulesPath).filter(file => file.endsWith(".mv"));
	if (moduleFiles.length === 0) {
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

	for (const file of moduleFiles) {
		const modulePath = path.join(bytecodeModulesPath, file);
		const moduleBytes = fs.readFileSync(modulePath);

		modulesBytesForHash.push(moduleBytes);
		modulesBase64.push(Converter.bytesToBase64(moduleBytes));
	}

	const concatenated = Buffer.concat(modulesBytesForHash);
	const computedPackageIdBytes = Sha3.sum256(concatenated);
	const computedPackageId = `0x${Converter.bytesToHex(computedPackageIdBytes)}`;

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
