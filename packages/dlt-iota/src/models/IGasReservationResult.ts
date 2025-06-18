// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ObjectRef } from "@iota/iota-sdk/transactions";

/**
 * Interface for gas reservation result from the gas station (with TypeScript camelCase conventions).
 */
export interface IGasReservationResult {
	/**
	 * The sponsor's on-chain address.
	 */
	sponsorAddress: string;

	/**
	 * An ID used to reference this particular gas reservation.
	 */
	reservationId: number;

	/**
	 * References to the sponsor's coins that will pay gas.
	 */
	gasCoins: ObjectRef[];
}
