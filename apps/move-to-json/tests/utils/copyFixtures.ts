// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import fsExtra from "fs-extra";

/**
 * Recursively copy files from a source folder to a destination folder.
 * @param src - Source directory
 * @param dest - Destination directory
 */
export async function copyFixtures(src: string, dest: string): Promise<void> {
	await fsExtra.copy(src, dest);
}
