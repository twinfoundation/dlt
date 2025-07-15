// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { NetworkTypes } from "./networkTypes";

/**
 * Network configuration interface
 */
export interface INetworkConfig {
	/**
	 * The network type
	 */
	network: NetworkTypes;
	/**
	 * The platform type
	 */
	platform: "iota";
	/**
	 * The RPC configuration
	 */
	rpc: {
		url: string;
		timeout?: number;
	};
	/**
	 * The deployment configuration
	 */
	deployment: {
		gasBudget: number;
		confirmationTimeout?: number;
		wallet: {
			mnemonicId: string;
			addressIndex: number;
		};
		gasStation?: {
			url: string;
			authToken: string;
		};
	};
	/**
	 * The contracts configuration
	 */
	contracts?: {
		[key: string]: {
			moduleName: string;
			dependencies?: string[];
			packageController?: {
				addressIndex: number;
			};
		};
	};
}
