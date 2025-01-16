// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { existsSync } from "node:fs";
import { mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { CLIDisplay } from "@twin.org/cli-core";
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

		const suiFixtureSource = path.join(__dirname, "fixtures", "sui");
		const suiFixtureDest = path.join(TEST_INPUT_GLOB, "sui");
		await copyFixtures(suiFixtureSource, suiFixtureDest);
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

	test("Fails with no command line arguments", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["node", "move-to-json"], undefined, {
			overrideOutputWidth: 1000
		});

		expect(exitCode).toBe(1);
		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain("error");
	});

	test("Fails with only one command line argument", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["node", "move-to-json", TEST_INPUT_GLOB], undefined, {
			overrideOutputWidth: 1000
		});

		expect(exitCode).toBe(1);
		const errOutput = errorBuffer.join("\n");
		expect(errOutput).toContain("error");
	});

	test("Succeeds with valid arguments and no .move files", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(
			["node", "move-to-json", TEST_INPUT_GLOB, TEST_OUTPUT_JSON],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(0);
	});

	test("Compiles an IOTA fixture", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				path.join(TEST_INPUT_GLOB, "iota", "sources", "*.move"),
				TEST_OUTPUT_JSON,
				"--platform=iota"
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(0);

		const compiledFileExists = existsSync(TEST_OUTPUT_JSON);
		expect(compiledFileExists).toBe(true);

		const fileContents = await readFile(TEST_OUTPUT_JSON, "utf8");
		const json = JSON.parse(fileContents);

		expect(json.nft).toBeDefined();
		expect(json.nft.packageId).toMatch(/^0x/);
		expect(json.nft.package).toBeDefined();
	});

	test("Compiles a SUI fixture", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(
			[
				"node",
				"move-to-json",
				path.join(TEST_INPUT_GLOB, "sui", "sources", "*.move"),
				TEST_OUTPUT_JSON,
				"--platform=sui"
			],
			"./dist/locales",
			{ overrideOutputWidth: 1000 }
		);

		expect(exitCode).toBe(0);

		const fileContents = await readFile(TEST_OUTPUT_JSON, "utf8");
		const json = JSON.parse(fileContents);

		expect(json.nft).toBeDefined();
		expect(json.nft.packageId).toMatch(/^0x/);
		expect(json.nft.package).toBeDefined();
	});
});
