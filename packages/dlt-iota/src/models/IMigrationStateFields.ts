// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Generic interface representing the storage fields of a MigrationState object.
 */
export interface IMigrationStateFields {
	/**
	 * The ID of the MigrationState object.
	 */
	id: {
		/**
		 * The ID of the MigrationState object.
		 */
		id: string; // UID is an object with an 'id' field
	};

	/**
	 * Whether migration is currently enabled.
	 */
	enabled: boolean;
}
