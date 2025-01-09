# Class: IotaRebased

Class for performing operations on IOTA.

## Constructors

### new IotaRebased()

> **new IotaRebased**(): [`IotaRebased`](IotaRebased.md)

#### Returns

[`IotaRebased`](IotaRebased.md)

## Properties

### DEFAULT\_MNEMONIC\_SECRET\_NAME

> `readonly` `static` **DEFAULT\_MNEMONIC\_SECRET\_NAME**: `string` = `"mnemonic"`

Default name for the mnemonic secret.

***

### DEFAULT\_SEED\_SECRET\_NAME

> `readonly` `static` **DEFAULT\_SEED\_SECRET\_NAME**: `string` = `"seed"`

Default name for the seed secret.

***

### DEFAULT\_COIN\_TYPE

> `readonly` `static` **DEFAULT\_COIN\_TYPE**: `number` = `4218`

Default coin type.

## Methods

### createClient()

> `static` **createClient**(`config`): `IotaClient`

Create a new SUI client.

#### Parameters

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration.

#### Returns

`IotaClient`

The client instance.

***

### populateConfig()

> `static` **populateConfig**(`config`): `void`

Create configuration using defaults where necessary.

#### Parameters

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration to populate.

#### Returns

`void`

***

### getAddresses()

> `static` **getAddresses**(`seed`, `config`, `accountIndex`, `startAddressIndex`, `count`, `isInternal`?): `string`[]

Get addresses for the identity.

#### Parameters

• **seed**: `Uint8Array`

The seed to use for generating addresses.

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration.

• **accountIndex**: `number`

The account index to get the addresses for.

• **startAddressIndex**: `number`

The start index for the addresses.

• **count**: `number`

The number of addresses to generate.

• **isInternal?**: `boolean`

Whether the addresses are internal.

#### Returns

`string`[]

The list of addresses.

***

### prepareAndPostTransaction()

> `static` **prepareAndPostTransaction**(`config`, `vaultConnector`, `identity`, `client`, `options`): `Promise`\<`object`\>

Prepare and post a transaction.

#### Parameters

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration.

• **vaultConnector**: `IVaultConnector`

The vault connector.

• **identity**: `string`

The identity of the user to access the vault keys.

• **client**: `IotaClient`

The client instance.

• **options**

The transaction options.

• **options.amount**: `bigint`

The amount to transfer.

• **options.recipient**: `string`

The recipient address.

#### Returns

`Promise`\<`object`\>

The transaction result.

##### digest

> **digest**: `string`

***

### prepareAndPostNftTransaction()

> `static` **prepareAndPostNftTransaction**(`config`, `vaultConnector`, `identity`, `client`, `options`): `Promise`\<[`IIotaNftTransactionResponse`](../interfaces/IIotaNftTransactionResponse.md)\>

Prepare and post an NFT transaction.

#### Parameters

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration.

• **vaultConnector**: `IVaultConnector`

The vault connector.

• **identity**: `string`

The identity of the user to access the vault keys.

• **client**: `IotaClient`

The client instance.

• **options**: [`IIotaRebasedNftTransactionOptions`](../interfaces/IIotaRebasedNftTransactionOptions.md)

The NFT transaction options.

#### Returns

`Promise`\<[`IIotaNftTransactionResponse`](../interfaces/IIotaNftTransactionResponse.md)\>

The transaction response.

***

### prepareAndPostStorageTransaction()

> `static` **prepareAndPostStorageTransaction**(`config`, `vaultConnector`, `identity`, `client`, `options`): `Promise`\<`IotaTransactionBlockResponse`\>

Prepare and post a storage transaction.

#### Parameters

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration.

• **vaultConnector**: `IVaultConnector`

The vault connector.

• **identity**: `string`

The identity of the user to access the vault keys.

• **client**: `IotaClient`

The client instance.

• **options**: [`IIotaRebasedNftTransactionOptions`](../interfaces/IIotaRebasedNftTransactionOptions.md)

The storage transaction options.

#### Returns

`Promise`\<`IotaTransactionBlockResponse`\>

The transaction response.

***

### getSeed()

> `static` **getSeed**(`config`, `vaultConnector`, `identity`): `Promise`\<`Uint8Array`\>

Get the seed from the vault.

#### Parameters

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration to use.

• **vaultConnector**: `IVaultConnector`

The vault connector to use.

• **identity**: `string`

The identity of the user to access the vault keys.

#### Returns

`Promise`\<`Uint8Array`\>

The seed.

***

### extractPayloadError()

> `static` **extractPayloadError**(`error`): `IError`

Extract error from SDK payload.
Errors from the Sui SDK are usually not JSON strings but objects.

#### Parameters

• **error**: `unknown`

The error to extract.

#### Returns

`IError`

The extracted error.

***

### buildMnemonicKey()

> `static` **buildMnemonicKey**(`identity`, `config`): `string`

Get the key for storing the mnemonic.

#### Parameters

• **identity**: `string`

The identity to use.

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration.

#### Returns

`string`

The mnemonic key.

***

### buildSeedKey()

> `static` **buildSeedKey**(`identity`, `config`): `string`

Get the key for storing the seed.

#### Parameters

• **identity**: `string`

The identity to use.

• **config**: [`IIotaRebasedConfig`](../interfaces/IIotaRebasedConfig.md)

The configuration.

#### Returns

`string`

The seed key.
