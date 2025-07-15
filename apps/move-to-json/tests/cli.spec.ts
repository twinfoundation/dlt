// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { existsSync } from "node:fs";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { GeneralError } from "@twin.org/core";
import { CLI } from "../src/cli";
import { copyFixtures } from "./utils/copyFixtures";

const TEST_DATA_LOCATION = path.resolve(path.join(__dirname, ".tmp"));
const TEST_INPUT_GLOB = path.join(TEST_DATA_LOCATION, "contracts");
const TEST_OUTPUT_JSON = path.join(TEST_DATA_LOCATION, "compiled-modules.json");
const TEST_TOML_LOCATION = path.resolve(path.join(__dirname, ".tmp-toml"));
let writeBuffer: string[] = [];
let errorBuffer: string[] = [];

/**
 * Test version of updateMoveToml function.
 * @param moveTomlPath Path to the Move.toml file to update.
 * @param network Network name to set in the rev parameter.
 */
async function updateMoveTomlTest(moveTomlPath: string, network: string): Promise<void> {
	const content = await readFile(moveTomlPath, "utf8");

	// Replace the rev value with the target network
	const updatedContent = content.replace(/rev\s*=\s*"[^"]*"/g, `rev = "${network}"`);

	await writeFile(moveTomlPath, updatedContent, "utf8");
}

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

describe("Move.toml Update Functionality", () => {
	beforeAll(async () => {
		await rm(TEST_TOML_LOCATION, { recursive: true, force: true });
		await mkdir(TEST_TOML_LOCATION, { recursive: true });
	});

	afterAll(async () => {
		await rm(TEST_TOML_LOCATION, { recursive: true, force: true });
	});

	test("Updates rev parameter from mainnet to testnet", async () => {
		const testFilePath = path.join(TEST_TOML_LOCATION, "test-mainnet-to-testnet.toml");

		// Create test Move.toml with mainnet
		const originalContent = `[package]
name = "nft"
version = "0.0.1"

[dependencies]
Iota = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/iota-framework/packages/iota-framework", rev = "mainnet" }

[addresses]
nft = "0x0"
`;

		await writeFile(testFilePath, originalContent, "utf8");

		// Update to testnet
		await updateMoveTomlTest(testFilePath, "testnet");

		// Verify the change
		const updatedContent = await readFile(testFilePath, "utf8");
		expect(updatedContent).toContain('rev = "testnet"');
		expect(updatedContent).not.toContain('rev = "mainnet"');

		// Verify the rest of the file is unchanged
		expect(updatedContent).toContain("[package]");
		expect(updatedContent).toContain('name = "nft"');
		expect(updatedContent).toContain("[addresses]");
	});

	test("Updates rev parameter from devnet to mainnet", async () => {
		const testFilePath = path.join(TEST_TOML_LOCATION, "test-devnet-to-mainnet.toml");

		// Create test Move.toml with devnet
		const originalContent = `[package]
name = "verifiable_storage"
version = "0.0.1"

[dependencies]
Iota = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/iota-framework/packages/iota-framework", rev = "devnet" }

[addresses]
verifiable_storage = "0x0"
`;

		await writeFile(testFilePath, originalContent, "utf8");

		// Update to mainnet
		await updateMoveTomlTest(testFilePath, "mainnet");

		// Verify the change
		const updatedContent = await readFile(testFilePath, "utf8");
		expect(updatedContent).toContain('rev = "mainnet"');
		expect(updatedContent).not.toContain('rev = "devnet"');
	});

	test("Handles various whitespace patterns around rev parameter", async () => {
		const testFilePath = path.join(TEST_TOML_LOCATION, "test-whitespace.toml");

		// Create test Move.toml with various whitespace patterns
		const originalContent = `[package]
name = "test"
version = "0.0.1"

[dependencies]
Iota = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/iota-framework/packages/iota-framework", rev="testnet" }

[addresses]
test = "0x0"
`;

		await writeFile(testFilePath, originalContent, "utf8");

		// Update to devnet
		await updateMoveTomlTest(testFilePath, "devnet");

		// Verify the change
		const updatedContent = await readFile(testFilePath, "utf8");
		expect(updatedContent).toContain('rev = "devnet"');
		expect(updatedContent).not.toContain('rev="testnet"');
	});

	test("Handles multiple rev parameters correctly", async () => {
		const testFilePath = path.join(TEST_TOML_LOCATION, "test-multiple-rev.toml");

		// Create test Move.toml with multiple dependencies (hypothetical case)
		const originalContent = `[package]
name = "test"
version = "0.0.1"

[dependencies]
Iota = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/iota-framework/packages/iota-framework", rev = "mainnet" }
OtherDep = { git = "https://github.com/example/other.git", rev = "v1.0.0" }

[addresses]
test = "0x0"
`;

		await writeFile(testFilePath, originalContent, "utf8");

		// Update to testnet - should change ALL rev parameters
		await updateMoveTomlTest(testFilePath, "testnet");

		// Verify the changes - both rev parameters should be updated
		const updatedContent = await readFile(testFilePath, "utf8");
		expect(updatedContent).toContain('rev = "testnet"');
		expect(updatedContent).not.toContain('rev = "mainnet"');
		expect(updatedContent).not.toContain('rev = "v1.0.0"');

		// Count occurrences of 'rev = "testnet"'
		const matches = updatedContent.match(/rev = "testnet"/g);
		expect(matches).toHaveLength(2);
	});

	test("Preserves file structure and formatting", async () => {
		const testFilePath = path.join(TEST_TOML_LOCATION, "test-preserve-structure.toml");

		// Create test Move.toml with specific formatting
		const originalContent = `[package]
name = "nft"
version = "0.0.1"

# This is a comment
[dependencies]
Iota = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/iota-framework/packages/iota-framework", rev = "devnet" }

[addresses]
nft = "0x0"
`;

		await writeFile(testFilePath, originalContent, "utf8");

		// Update to mainnet
		await updateMoveTomlTest(testFilePath, "mainnet");

		// Verify the change and structure preservation
		const updatedContent = await readFile(testFilePath, "utf8");
		expect(updatedContent).toContain('rev = "mainnet"');
		expect(updatedContent).toContain("# This is a comment");
		expect(updatedContent).toContain("[package]");
		expect(updatedContent).toContain("[dependencies]");
		expect(updatedContent).toContain("[addresses]");

		// Verify line breaks are preserved
		const lines = updatedContent.split("\n");
		expect(lines.length).toBeGreaterThan(5);
	});
});
