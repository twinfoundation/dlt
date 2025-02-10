// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { NameOfPlugin } from "@twin.org/nameof-vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [NameOfPlugin],

	test: {
		include: ["./tests/**/*.spec.ts"],
		globals: true,
		bail: 1,
		testTimeout: 300000,
		hookTimeout: 300000,
		coverage: {
			reporter: ["text", "lcov"],
			include: ["src/**/*.ts"],
			exclude: ["**/index.ts", "**/models/**/*.ts"]
		},
		fileParallelism: false
	}
});
