// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { Guards } from "@twin.org/core";
import dotenv from "dotenv";
import { Iota } from "../src/iota";

console.debug("Setting up test environment from .env and .env.dev files");

dotenv.config({ path: [path.join(__dirname, ".env"), path.join(__dirname, ".env.dev")] });

Guards.stringValue("TestEnv", "TEST_NODE_ENDPOINT", process.env.TEST_NODE_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_NETWORK", process.env.TEST_NETWORK);

export const TEST_CLIENT_OPTIONS = {
	url: process.env.TEST_NODE_ENDPOINT ?? ""
};

export const TEST_COIN_TYPE = Iota.DEFAULT_COIN_TYPE;
export const TEST_NETWORK = process.env.TEST_NETWORK;
