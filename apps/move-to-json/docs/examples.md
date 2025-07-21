# Move to JSON CLI Examples

This CLI compiles IOTA Move contracts into Base64-encoded modules, computes package IDs (SHA3-256), and provides network-specific deployment capabilities with separate build and deploy commands.

## Prerequisites

- Node.js (v20+)
- IOTA CLI installed in your PATH for compilation. You can download the IOTA CLI by visiting the [IOTA CLI GitHub Releases](https://github.com/iotaledger/iota/releases) page and downloading the appropriate binary for your operating system.

## Command Structure

The tool now uses separate `build` and `deploy` subcommands:

- **`build`** - Compiles Move contracts and generates network-aware JSON structure
- **`deploy`** - Deploys compiled contracts to specified network using configuration files

## Build Command

### Basic Usage

```bash
# Build contracts and generate network-aware JSON
move-to-json build "src/contracts/**/*.move" --output compiled-modules.json
```

### What it does:

- Find all .move files matching the glob pattern
- Compile each file using the IOTA Move compiler
- Compute deterministic package IDs from compiled bytecode
- Generate network-aware JSON structure with testnet, devnet, and mainnet sections
- Each network contains identical packageId and package data, with deployedPackageId initially set to null

### Example Output Structure

```json
{
  "buildInfo": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "compiler": "move-to-json-v2"
  },
  "testnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ...",
    "deployedPackageId": null
  },
  "devnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ...",
    "deployedPackageId": null
  },
  "mainnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ...",
    "deployedPackageId": null
  }
}
```

## Deploy Command

### Basic Usage

```bash
# Deploy to testnet
move-to-json deploy --config config/iota-testnet.yaml --network testnet

# Deploy to mainnet with force flag
move-to-json deploy --config config/iota-mainnet.yaml --network mainnet --force

# Dry run (simulate without deploying)
move-to-json deploy --config config/iota-testnet.yaml --network testnet --dry-run
```

### Network Configuration Files

Create YAML configuration files for each network:

#### testnet configuration (config/iota-testnet.yaml):

```yaml
network: testnet
platform: iota
rpc:
  url: https://api.testnet.iota.cafe
  timeout: 60000
deployment:
  gasBudget: 50000000
  confirmationTimeout: 60
  wallet:
    mnemonicId: deployer-mnemonic
    addressIndex: 0
  gasStation:
    url: https://gas-station.testnet.iota.cafe
    authToken: ${GAS_STATION_AUTH}
contracts:
  my_contract:
    moduleName: my_contract
    dependencies: ['0x1', '0x2']
```

#### mainnet configuration (config/iota-mainnet.yaml):

```yaml
network: mainnet
platform: iota
rpc:
  url: https://api.mainnet.iota.cafe
deployment:
  gasBudget: 100000000
  wallet:
    mnemonicId: mainnet-deployer-mnemonic
    addressIndex: 0
  security:
    requireConfirmation: true
    backupPackageIds: true
```

### What the deploy command does:

1. **Environment Preparation**: Cleans build artifacts and updates Move.toml for target network
2. **Configuration Validation**: Loads and validates network configuration
3. **Contract Deployment**: Uses IOTA CLI to publish contracts with appropriate gas budgets
4. **JSON Updates**: Updates the compiled-modules.json with actual deployed package IDs

## Complete Workflow Example

```bash
# 1. Build contracts for all networks
move-to-json build "src/contracts/**/*.move" --output src/contracts/compiled-modules.json

# 2. Deploy to testnet first
move-to-json deploy --config config/iota-testnet.yaml --network testnet

# 3. Test and validate on testnet

# 4. Deploy to mainnet
move-to-json deploy --config config/iota-mainnet.yaml --network mainnet
```

## Package.json Integration

Update your package.json scripts:

```json
{
  "scripts": {
    "build:contracts": "move-to-json build \"src/contracts/**/*.move\" --output src/contracts/compiled-modules.json",
    "deploy:testnet": "move-to-json deploy --config config/iota-testnet.yaml --network testnet",
    "deploy:devnet": "move-to-json deploy --config config/iota-devnet.yaml --network devnet",
    "deploy:mainnet": "move-to-json deploy --config config/iota-mainnet.yaml --network mainnet"
  }
}
```

## Updated Import Pattern

In your TypeScript code, access network-specific deployed contracts:

```typescript
import compiledModulesJson from './contracts/compiled-modules.json';

// Get current network (from environment, config, etc.)
const network = getCurrentNetwork(); // 'testnet', 'devnet', 'mainnet'

// Access deployed package ID for the current network
const deployedPackageId = compiledModulesJson[network].deployedPackageId;
const modules = compiledModulesJson[network].package;

// Use in your application
const result = await iotaClient.publish({
  modules: [modules],
  packageId: deployedPackageId
});
```

## Security Considerations

- **Mainnet deployments** require careful configuration with appropriate gas budgets
- **Wallet credentials** should be stored securely using environment variables
- **Gas station integration** provides sponsored transactions for supported networks
- **Dry run mode** allows testing deployment logic without actual execution
