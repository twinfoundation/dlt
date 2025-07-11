// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The platform types.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const PlatformTypes = {
	/**
	 * IOTA.
	 */
	Iota: "iota"
} as const;

/**
 * The platform types.
 */
export type PlatformTypes = (typeof PlatformTypes)[keyof typeof PlatformTypes];
