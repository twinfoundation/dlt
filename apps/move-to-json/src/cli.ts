// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIBase } from "@twin.org/cli-core";
import type { Command } from "commander";
import { buildCommandMoveToJson } from "./commands/moveToJson";

/**
 * The main entry point for the Move to JSON CLI.
 */
export class CLI extends CLIBase {
	/**
	 * Run the app.
	 * @param argv The process arguments.
	 * @param localesDirectory The directory for the locales, default to relative to the script.
	 * @param options Additional options.
	 * @param options.overrideOutputWidth Override the output width.
	 * @returns The exit code.
	 */
	public async run(
		argv: string[],
		localesDirectory?: string,
		options?: {
			overrideOutputWidth?: number;
		}
	): Promise<number> {
		return this.execute(
			{
				title: "TWIN Move to JSON",
				appName: "move-to-json",
				version: "0.0.1-next.17",
				icon: "⚙️ ",
				supportsEnvFiles: false,
				overrideOutputWidth: options?.overrideOutputWidth
			},
			localesDirectory ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../locales"),
			argv
		);
	}

	/**
	 * Configure any options or actions at the root program level.
	 * @param program The root program command.
	 */
	protected configureRoot(program: Command): void {
		buildCommandMoveToJson(program);
	}
}
