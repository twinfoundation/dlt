# Function: actionCommandDeploy()

> **actionCommandDeploy**(`opts`): `Promise`\<`void`\>

Action for the deploy command.

## Parameters

### opts

Command options.

#### config?

`string`

Path to network config file.

#### contracts?

`string`

Path to compiled modules JSON.

#### network?

`string`

Network identifier.

#### dryRun?

`boolean`

Simulate deployment without executing.

#### force?

`boolean`

Force redeployment of existing packages.

## Returns

`Promise`\<`void`\>
