// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { BalanceChange, IotaEvent, IotaObjectChange } from "@iota/iota-sdk/client";

/**
 * Interface for the dry run transaction response.
 */
export interface IIotaDryRunResponse {
	/**
	 * The status of the dry run.
	 */
	status: string;

	/**
	 * The costs associated with the transaction.
	 */
	costs: {
		/**
		 * The computation cost.
		 */
		computationCost: string;

		/**
		 * The computation cost that was burned.
		 */
		computationCostBurned: string;

		/**
		 * The storage cost.
		 */
		storageCost: string;

		/**
		 * The storage rebate.
		 */
		storageRebate: string;

		/**
		 * The non-refundable storage fee.
		 */
		nonRefundableStorageFee: string;
	};

	/**
	 * The events emitted during the dry run.
	 */
	events: IotaEvent[];

	/**
	 * The balance changes that occurred during the dry run.
	 */
	balanceChanges: BalanceChange[];

	/**
	 * The object changes that occurred during the dry run.
	 */
	objectChanges: IotaObjectChange[];
}
