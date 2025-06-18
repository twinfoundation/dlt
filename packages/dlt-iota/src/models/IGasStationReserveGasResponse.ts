// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IGasStationReserveGasResult } from "./IGasStationReserveGasResult";

/**
 * Interface for the gas station reserve gas response.
 */
export interface IGasStationReserveGasResponse {
	/**
	 * The reservation result.
	 */
	result: IGasStationReserveGasResult;

	/**
	 * Error message if the request failed.
	 */
	error?: string | null;
}
