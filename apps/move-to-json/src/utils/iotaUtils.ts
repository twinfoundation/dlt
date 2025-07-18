// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { GeneralError, I18n } from "@twin.org/core";

/**
 * Verify the IOTA SDK is installed and accessible.
 * @throws GeneralError if IOTA SDK is not installed or accessible.
 */
export async function verifyIotaSDK(): Promise<void> {
	try {
		CLIDisplay.section(I18n.formatMessage("commands.build.section.checkingIotaSDK"));
		await CLIUtils.runShellApp("iota", ["--version"], process.cwd());
		CLIDisplay.break();
	} catch (err) {
		throw new GeneralError("commands", "commands.build.sdkNotInstalled", { platform: "iota" }, err);
	}
}
