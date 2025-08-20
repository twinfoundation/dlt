// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { Guards } from "@twin.org/core";
import dotenv from "dotenv";
import { Iota } from "../src/iota";

console.debug("Setting up test environment from .env and .env.dev files");

dotenv.config({
	path: [path.join(__dirname, ".env"), path.join(__dirname, ".env.dev")],
	quiet: true
});

Guards.stringValue("TestEnv", "TEST_NODE_ENDPOINT", process.env.TEST_NODE_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_NETWORK", process.env.TEST_NETWORK);

export const TEST_CLIENT_OPTIONS = {
	url: process.env.TEST_NODE_ENDPOINT ?? ""
};

export const TEST_COIN_TYPE = Iota.DEFAULT_COIN_TYPE;
export const TEST_NETWORK = process.env.TEST_NETWORK;

// Test data constants
export const TEST_MNEMONIC =
	"undo boss jewel dog announce mistake cry brass stock debris arrest patrol recipe annual clown honey icon twist modify quarter warm lock anchor cigar";
export const TEST_IDENTITY = "test-identity";

// Gas station environment variables
export const GAS_STATION_URL = process.env.GAS_STATION_URL ?? "http://localhost:9527";
export const GAS_STATION_AUTH_TOKEN =
	process.env.GAS_STATION_AUTH_TOKEN ?? "qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI=";
export const GAS_BUDGET = Number.parseInt(process.env.GAS_BUDGET ?? "50000000", 10);
