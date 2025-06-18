// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ObjectRef } from "@iota/iota-sdk/transactions";

/**
 * Interface for the gas reservation result returned by the gas station.
 * This matches the snake_case format returned by the gas station API.
 */
export interface IGasStationReserveGasResult {
	/**
	 * The sponsor's on-chain address.
	 */
	sponsor_address: string;

	/**
	 * An ID used to reference this particular gas reservation.
	 */
	reservation_id: number;

	/**
	 * References to the sponsor's coins that will pay gas.
	 */
	gas_coins: ObjectRef[];
}
