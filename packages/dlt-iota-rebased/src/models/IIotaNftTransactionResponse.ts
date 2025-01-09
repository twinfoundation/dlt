// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IotaTransactionBlockResponse } from "@iota/iota-sdk/client";

/**
 * Response from an NFT transaction.
 */
export interface IIotaNftTransactionResponse extends IotaTransactionBlockResponse {
	/**
	 * The created object reference.
	 */
	createdObject?: {
		objectId: string;
	};
}
