// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Configuration for gas station operations.
 */
export interface IGasStationConfig {
	/**
	 * The gas station service URL.
	 */
	gasStationUrl: string;

	/**
	 * The authentication token for the gas station API.
	 */
	gasStationAuthToken: string;
}
