// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { existsSync } from "node:fs";
import { mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { GeneralError } from "@twin.org/core";
import { CLI } from "../src/cli";
import { copyFixtures } from "./utils/copyFixtures";
import { validateDeploymentEnvironment, getDeploymentMnemonic } from "../src/utils/envSetup";

const TEST_DATA_LOCATION = path.resolve(path.join(__dirname, ".tmp"));
const TEST_INPUT_GLOB = path.join(TEST_DATA_LOCATION, "contracts");
const TEST_OUTPUT_JSON = path.join(TEST_DATA_LOCATION, "compiled-modules.json");

let writeBuffer: string[] = [];
let errorBuffer: string[] = [];

describe("move-to-json CLI", () => {
	beforeAll(async () => {
		await rm(TEST_DATA_LOCATION, { recursive: true, force: true });
		await mkdir(TEST_INPUT_GLOB, { recursive: true });

		const fixtureSource = path.join(__dirname, "fixtures");
		const fixtureDest = path.join(TEST_INPUT_GLOB, "iota");
		await copyFixtures(fixtureSource, fixtureDest);
	});

	afterAll(async () => {
		await rm(TEST_DATA_LOCATION, { recursive: true, force: true });
	});

	beforeEach(() => {
		writeBuffer = [];
		errorBuffer = [];

		CLIDisplay.write = (buffer: string | Uint8Array): void => {
			writeBuffer.push(...buffer.toString().split("\n"));
		};
		CLIDisplay.writeError = (buffer: string | Uint8Array): void => {
			errorBuffer.push(...buffer.toString().split("\n"));
		};
	});

	test("Shows help when no subcommand provided", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["node", "move-to-json", "--help"], "./dist/locales", {
			overrideOutputWidth: 1000
		});

		expect(exitCode).toBe(0);
		const output = writeBuffer.join("\n");
		expect(output).toContain("build");
		expect(output).toContain("deploy");
	});

	test("Build command fails gracefully when platform SDK is not installed", async () => {
		vi.spyOn(CLIUtils, "runShellApp").mockRejectedValueOnce(
			new GeneralError("commands", "IOTA SDK not installed", { platform: "iota" })
		);

		const cli = new CLI();
		const exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				"build",
				path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
				"--network",
				"testnet",
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(0);

		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain("IOTA SDK not installed");

		vi.restoreAllMocks();
	});

	test("Build command compiles an IOTA fixture", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				"build",
				path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
				"--network",
				"testnet",
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		console.log(errorBuffer);

		expect(exitCode).toBe(0);
		const compiledFileExists = existsSync(TEST_OUTPUT_JSON);
		expect(compiledFileExists).toBe(true);

		const fileContents = await readFile(TEST_OUTPUT_JSON, "utf8");
		const json = JSON.parse(fileContents);

		// Check new network-aware structure exists
		expect(json.testnet).toBeDefined();

		// Check contract data in target network (testnet) - flat structure
		expect(json.testnet.packageId).toMatch(/^0x/);
		expect(json.testnet.package).toBeDefined();
		expect(json.testnet.deployedPackageId).toBeUndefined();
	});

	test("Deploy command requires network option", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["node", "move-to-json", "deploy"], "./dist/locales", {
			overrideOutputWidth: 1000
		});

		expect(exitCode).toBe(1);
		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain(
			'Property "network" must be one of [testnet, devnet, mainnet], it is "undefined"'
		);
	});
});

describe("envSetup Validation", () => {
	const TEST_CONFIGS_DIR = path.join(TEST_DATA_LOCATION, "configs");

	beforeAll(async () => {
		await mkdir(TEST_CONFIGS_DIR, { recursive: true });
	});

	afterAll(async () => {
		await rm(TEST_CONFIGS_DIR, { recursive: true, force: true });
	});

	beforeEach(() => {
		writeBuffer = [];
		errorBuffer = [];
	});

	test("validateDeploymentEnvironment throws localized error when mnemonic is missing", async () => {
		process.env.DEPLOYER_MNEMONIC = ""; // Clear mnemonic

		const originalCwd = process.cwd();
		process.chdir(TEST_DATA_LOCATION);

		try {
			await validateDeploymentEnvironment("testnet");
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(GeneralError);
			const generalError = error as GeneralError;
			expect(generalError.source).toBe("envSetup");
			expect(generalError.message).toBe("envSetup.mnemonicMissing");
			expect(generalError.properties).toMatchObject({
				network: "testnet",
				mnemonicVar: "DEPLOYER_MNEMONIC"
			});
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("validateDeploymentEnvironment throws localized error when mnemonic has wrong word count", async () => {
		// Modify the env with invalid mnemonic (only 12 words instead of 24)
		process.env.DEPLOYER_MNEMONIC =
			"word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12";

		const originalCwd = process.cwd();
		process.chdir(TEST_DATA_LOCATION);

		try {
			await validateDeploymentEnvironment("testnet");
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(GeneralError);
			const generalError = error as GeneralError;
			expect(generalError.source).toBe("envSetup");
			expect(generalError.message).toBe("envSetup.mnemonicInvalidFormat");
			expect(generalError.properties).toMatchObject({
				network: "testnet",
				mnemonicVar: "DEPLOYER_MNEMONIC",
				wordCount: 12
			});
		} finally {
			process.chdir(originalCwd);
		}
	});

	test("getDeploymentMnemonic returns mnemonic when valid", async () => {
		// Create env file with valid 24-word mnemonic
		const validMnemonic = Array.from({ length: 24 }, (_, i) => `word${i + 1}`).join(" ");
		process.env.DEPLOYER_MNEMONIC = validMnemonic;

		const originalCwd = process.cwd();
		process.chdir(TEST_DATA_LOCATION);

		try {
			const result = await getDeploymentMnemonic("testnet");
			expect(result).toBe(validMnemonic);
		} finally {
			process.chdir(originalCwd);
		}
	});
});
