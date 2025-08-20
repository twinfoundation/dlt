# Class: IotaSmartContractUtils

Utility class providing common smart contract operations for IOTA-based contracts.
This class uses composition pattern to provide shared functionality without inheritance complexity.

## Constructors

### Constructor

> **new IotaSmartContractUtils**(): `IotaSmartContractUtils`

#### Returns

`IotaSmartContractUtils`

## Properties

### CLASS\_NAME

> `readonly` `static` **CLASS\_NAME**: `string` = `"IotaSmartContractUtils"`

Runtime name for the class.

## Methods

### migrateSmartContract()

> `static` **migrateSmartContract**(`config`, `client`, `vaultConnector`, `logging`, `gasBudget`, `identity`, `objectId`, `getModuleName`, `getPackageId`, `getAdminCapId`, `getMigrationStateId`, `getPackageControllerAddress`): `Promise`\<`void`\>

Migrate a smart contract object to the current version using admin privileges.
This is a generic migration method that works with any IOTA smart contract.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### logging

Optional logging component.

`undefined` | `ILoggingComponent`

##### gasBudget

`number`

The gas budget for the transaction.

##### identity

`string`

The identity of the controller with admin privileges.

##### objectId

`string`

The ID of the object to migrate.

##### getModuleName

() => `string`

Function to get the module name for the contract.

##### getPackageId

() => `string`

Function to get the package ID for the contract.

##### getAdminCapId

(`identity`) => `Promise`\<`string`\>

Function to get the AdminCap object ID.

##### getMigrationStateId

(`identity`) => `Promise`\<`string`\>

Function to get the MigrationState object ID.

##### getPackageControllerAddress

(`identity`) => `Promise`\<`string`\>

Function to get the package controller address.

#### Returns

`Promise`\<`void`\>

Promise that resolves when migration is complete.

***

### enableMigration()

> `static` **enableMigration**(`config`, `client`, `vaultConnector`, `logging`, `gasBudget`, `identity`, `getModuleName`, `getPackageId`, `getAdminCapId`, `getMigrationStateId`, `getPackageControllerAddress`): `Promise`\<`void`\>

Enable migration operations using admin privileges.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### logging

Optional logging component.

`undefined` | `ILoggingComponent`

##### gasBudget

`number`

The gas budget for the transaction.

##### identity

`string`

The identity of the controller with admin privileges.

##### getModuleName

() => `string`

Function to get the module name for the contract.

##### getPackageId

() => `string`

Function to get the package ID for the contract.

##### getAdminCapId

(`identity`) => `Promise`\<`string`\>

Function to get the AdminCap object ID.

##### getMigrationStateId

(`identity`) => `Promise`\<`string`\>

Function to get the MigrationState object ID.

##### getPackageControllerAddress

(`identity`) => `Promise`\<`string`\>

Function to get the package controller address.

#### Returns

`Promise`\<`void`\>

Promise that resolves when migration is enabled.

***

### disableMigration()

> `static` **disableMigration**(`config`, `client`, `vaultConnector`, `logging`, `gasBudget`, `identity`, `getModuleName`, `getPackageId`, `getAdminCapId`, `getMigrationStateId`, `getPackageControllerAddress`): `Promise`\<`void`\>

Disable migration operations using admin privileges.

#### Parameters

##### config

[`IIotaConfig`](../interfaces/IIotaConfig.md)

The IOTA configuration.

##### client

`IotaClient`

The IOTA client instance.

##### vaultConnector

`IVaultConnector`

The vault connector for key management.

##### logging

Optional logging component.

`undefined` | `ILoggingComponent`

##### gasBudget

`number`

The gas budget for the transaction.

##### identity

`string`

The identity of the controller with admin privileges.

##### getModuleName

() => `string`

Function to get the module name for the contract.

##### getPackageId

() => `string`

Function to get the package ID for the contract.

##### getAdminCapId

(`identity`) => `Promise`\<`string`\>

Function to get the AdminCap object ID.

##### getMigrationStateId

(`identity`) => `Promise`\<`string`\>

Function to get the MigrationState object ID.

##### getPackageControllerAddress

(`identity`) => `Promise`\<`string`\>

Function to get the package controller address.

#### Returns

`Promise`\<`void`\>

Promise that resolves when migration is disabled.
