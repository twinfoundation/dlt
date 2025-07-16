# Interface: ICompiledModules

Interface for compiled module items

## Properties

### testnet

> **testnet**: `object`

Network-specific compiled module data

#### packageId

> **packageId**: `string`

The package ID.

#### package

> **package**: `string` \| `string`[]

The package data.

#### deployedPackageId

> **deployedPackageId**: `null` \| `string`

The deployed package ID (null if not deployed).

***

### devnet

> **devnet**: `object`

Devnet network compiled module data

#### packageId

> **packageId**: `string`

The package ID.

#### package

> **package**: `string` \| `string`[]

The package data.

#### deployedPackageId

> **deployedPackageId**: `null` \| `string`

The deployed package ID (null if not deployed).

***

### mainnet

> **mainnet**: `object`

Mainnet network compiled module data

#### packageId

> **packageId**: `string`

The package ID.

#### package

> **package**: `string` \| `string`[]

The package data.

#### deployedPackageId

> **deployedPackageId**: `null` \| `string`

The deployed package ID (null if not deployed).
