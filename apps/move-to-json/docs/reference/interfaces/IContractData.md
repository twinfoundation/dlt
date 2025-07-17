# Interface: IContractData

Interface for contract data stored in compiled-modules.json

## Properties

### packageId

> **packageId**: `string`

Package ID generated during build

***

### package

> **package**: `string`

Base64-encoded package bytecode

***

### deployedPackageId?

> `optional` **deployedPackageId**: `null` \| `string`

Package ID from actual deployment

***

### upgradeCap?

> `optional` **upgradeCap**: `null` \| `string`

UpgradeCap object ID for package upgrades
