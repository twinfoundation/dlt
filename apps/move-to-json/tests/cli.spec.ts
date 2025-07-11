// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { existsSync } from "node:fs";
import { mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { GeneralError } from "@twin.org/core";
import { CLI } from "../src/cli";
import { copyFixtures } from "./utils/copyFixtures";

const TEST_DATA_LOCATION = path.resolve(path.join(__dirname, ".tmp"));
const TEST_INPUT_GLOB = path.join(TEST_DATA_LOCATION, "contracts");
const TEST_OUTPUT_JSON = path.join(TEST_DATA_LOCATION, "compiled-modules.json");
let writeBuffer: string[] = [];
let errorBuffer: string[] = [];

describe("move-to-json CLI", () => {
	beforeAll(async () => {
		await rm(TEST_DATA_LOCATION, { recursive: true, force: true });
		await mkdir(TEST_INPUT_GLOB, { recursive: true });

		const iotaFixtureSource = path.join(__dirname, "fixtures", "iota");
		const iotaFixtureDest = path.join(TEST_INPUT_GLOB, "iota");
		await copyFixtures(iotaFixtureSource, iotaFixtureDest);
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
				"--output",
				TEST_OUTPUT_JSON
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(0);
		const compiledFileExists = existsSync(TEST_OUTPUT_JSON);
		expect(compiledFileExists).toBe(true);

		const fileContents = await readFile(TEST_OUTPUT_JSON, "utf8");
		const json = JSON.parse(fileContents);

		// Check new network-aware structure
		expect(json.testnet).toBeDefined();
		expect(json.devnet).toBeDefined();
		expect(json.mainnet).toBeDefined();

		// Check contract data in all networks
		expect(json.testnet.nft).toBeDefined();
		expect(json.testnet.nft.packageId).toMatch(/^0x/);
		expect(json.testnet.nft.package).toBeDefined();
		expect(json.testnet.nft.deployedPackageId).toBeNull();

		expect(json.devnet.nft).toBeDefined();
		expect(json.mainnet.nft).toBeDefined();
	});

	test("Deploy command requires config and network options", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["node", "move-to-json", "deploy"], "./dist/locales", {
			overrideOutputWidth: 1000
		});

		expect(exitCode).toBe(0);
		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain("Config file is required");
	});
});
