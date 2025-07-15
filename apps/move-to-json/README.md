# TWIN Move to JSON

Tool to convert Move source files to JSON with network-specific deployment support.

## Installation

```shell
npm install -g @twin.org/move-to-json
```

## Quick Start

```bash
# Build contracts for mainnet
move-to-json build "src/**/*.move" --network mainnet --output compiled-modules.json

# Deploy to mainnet
move-to-json deploy --config configs/iota-mainnet.yaml --network mainnet
```

## Environment Setup for Production Deployments

### Required Environment Variables

For production deployments, you need to set up environment variables containing your deployment credentials. This package follows the same pattern as the NFT package.

#### 1. Create Environment File

Copy the environment template:
```bash
cp env.example .env.dev
```

#### 2. Generate Deployment Mnemonics

Use the wallet CLI to generate secure mnemonics:

```bash
# Generate a mnemonic and addresses
npx "@twin.org/wallet-cli" mnemonic --env wallet.env
npx "@twin.org/wallet-cli" address --load-env wallet.env --seed '!SEED' --count 5 --env address.env

# Copy the mnemonic to your network-specific variables in .env.dev
echo "MAINNET_DEPLOYER_MNEMONIC=\"$(grep MNEMONIC wallet.env | cut -d'=' -f2 | tr -d '\"')\"" >> .env.dev
echo "TESTNET_DEPLOYER_MNEMONIC=\"$(grep MNEMONIC wallet.env | cut -d'=' -f2 | tr -d '\"')\"" >> .env.dev
echo "DEVNET_DEPLOYER_MNEMONIC=\"$(grep MNEMONIC wallet.env | cut -d'=' -f2 | tr -d '\"')\"" >> .env.dev
```

#### 3. Configure Gas Station (Optional)

For sponsored transactions, add gas station configuration to `.env.dev`:

```env
MAINNET_GAS_STATION_AUTH="your-mainnet-auth-token"
TESTNET_GAS_STATION_AUTH="your-testnet-auth-token"
DEVNET_GAS_STATION_AUTH="your-devnet-auth-token"
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MAINNET_DEPLOYER_MNEMONIC` | Yes (mainnet) | 24-word mnemonic for mainnet deployments |
| `TESTNET_DEPLOYER_MNEMONIC` | Yes (testnet) | 24-word mnemonic for testnet deployments |
| `DEVNET_DEPLOYER_MNEMONIC` | Yes (devnet) | 24-word mnemonic for devnet deployments |
| `MAINNET_GAS_STATION_AUTH` | No | Gas station auth token for mainnet |
| `TESTNET_GAS_STATION_AUTH` | No | Gas station auth token for testnet |
| `DEVNET_GAS_STATION_AUTH` | No | Gas station auth token for devnet |
| `MAINNET_GAS_STATION_URL` | No | Custom gas station URL for mainnet |
| `TESTNET_GAS_STATION_URL` | No | Custom gas station URL for testnet |
| `DEVNET_GAS_STATION_URL` | No | Custom gas station URL for devnet |

### Security Best Practices

#### Local Development
- Store credentials in `.env.dev` (never commit to git)
- Use test mnemonics with faucet funds for testnet/devnet
- Use dedicated deployment wallets separate from personal wallets

#### CI/CD and Production
- Store credentials in GitHub Secrets or your CI/CD secrets manager
- Use hardware wallets or HSM for mainnet deployment keys
- Implement approval workflows for mainnet deployments
- Monitor wallet balances and deployment costs

### Example .env.dev File

```env
# Mainnet credentials (use real values with sufficient funds)
MAINNET_DEPLOYER_MNEMONIC="word1 word2 word3 ... word24"
MAINNET_GAS_STATION_AUTH="real-mainnet-auth-token"

# Testnet credentials (can use faucet-funded test wallets)
TESTNET_DEPLOYER_MNEMONIC="test1 test2 test3 ... test24"
TESTNET_GAS_STATION_AUTH="test-auth-token"

# Devnet credentials (can use faucet-funded test wallets)
DEVNET_DEPLOYER_MNEMONIC="dev1 dev2 dev3 ... dev24"
DEVNET_GAS_STATION_AUTH="dev-auth-token"
```

### Generating Credentials

To generate new mnemonics and addresses for your deployment wallets:

#### 1. Generate Mnemonic and Seed
```bash
# Generate a new 24-word mnemonic and save to wallet.env
npx "@twin.org/wallet-cli" mnemonic --env wallet.env
```

This creates a `wallet.env` file with:
```env
MNEMONIC="word1 word2 word3 ... word24"
SEED="0x1234...abcd"
```

#### 2. Generate Addresses from Seed
```bash
# Generate 5 addresses and save to address.env
npx "@twin.org/wallet-cli" address --load-env wallet.env --seed '!SEED' --count 5 --env address.env
```

This creates an `address.env` file with:
```env
ADDRESS_0="iota1abc...xyz"
ADDRESS_0_PRIVATE_KEY="0x1234...abcd"
ADDRESS_0_PUBLIC_KEY="0x5678...efgh"
# ... up to ADDRESS_4
```

#### 3. Update Your .env.dev File
```bash
# Copy the mnemonic to your deployment configuration
echo "MAINNET_DEPLOYER_MNEMONIC=\"$(grep MNEMONIC wallet.env | cut -d'=' -f2 | tr -d '\"')\"" >> .env.dev
echo "TESTNET_DEPLOYER_MNEMONIC=\"$(grep MNEMONIC wallet.env | cut -d'=' -f2 | tr -d '\"')\"" >> .env.dev
```

> **Security Note**: The wallet CLI generates network-independent addresses. The same mnemonic can be used across all networks (mainnet/testnet/devnet), but you should use different mnemonics for different environments for security isolation.

## Commands

### build

Compile Move contracts for a specific network:

```bash
move-to-json build "src/**/*.move" --network <network> [--output <file>]
```

**Options:**
- `--network <network>` - Target network (testnet/devnet/mainnet) **[Required]**
- `--output <file>` - Output JSON file (default: compiled-modules.json)

**What it does:**
1. Validates environment variables for the target network
2. Cleans build artifacts and Move.lock files
3. Updates Move.toml with network-specific dependencies  
4. Compiles contracts using IOTA CLI
5. Generates network-aware JSON with package IDs and base64 modules

**Example:**
```bash
move-to-json build "src/contracts/**/*.move" --network mainnet --output compiled-modules.json
```

### deploy

Deploy compiled contracts to the specified network:

```bash
move-to-json deploy --config <config-file> --network <network> [options]
```

**Options:**
- `--config <file>` - Network configuration YAML file **[Required]**
- `--network <network>` - Network identifier (testnet/devnet/mainnet) **[Required]**
- `--contracts <file>` - Compiled modules JSON file (default: compiled-modules.json)
- `--dry-run` - Simulate deployment without executing
- `--force` - Force redeployment of existing packages

**What it does:**
1. Validates deployment credentials are available
2. Checks wallet balance against gas requirements
3. Loads compiled contracts from JSON
4. Deploys using IOTA CLI with network-specific settings
5. Updates JSON with deployed package IDs

**Example:**
```bash
move-to-json deploy --config configs/iota-mainnet.yaml --network mainnet
```

## Network Configuration Files

Create YAML configuration files for each network in a `configs/` directory:

### configs/iota-mainnet.yaml

```yaml
network: mainnet
platform: iota
rpc:
  url: https://api.mainnet.iota.cafe
  timeout: 60000
deployment:
  gasBudget: 100000000
  confirmationTimeout: 120
  wallet:
    mnemonicId: mainnet-deployer-mnemonic
    addressIndex: 0
  gasStation:
    url: https://gas-station.mainnet.iota.cafe
    authToken: ${MAINNET_GAS_STATION_AUTH}
  security:
    requireConfirmation: true
    backupPackageIds: true
contracts:
  nft:
    moduleName: nft
    dependencies: ["0x1", "0x2"]
    packageController:
      addressIndex: 0
```

### configs/iota-testnet.yaml

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
    authToken: ${TESTNET_GAS_STATION_AUTH}
contracts:
  nft:
    moduleName: nft
    dependencies: ["0x1", "0x2"]
    packageController:
      addressIndex: 0
```

## Complete Workflow

### 1. Development Workflow

```bash
# Set up environment variables
cp env.example .env.dev
npx "@twin.org/wallet-cli" mnemonic --env wallet.env
npx "@twin.org/wallet-cli" address --load-env wallet.env --seed '!SEED' --count 5 --env address.env
echo "TESTNET_DEPLOYER_MNEMONIC=\"$(grep MNEMONIC wallet.env | cut -d'=' -f2 | tr -d '\"')\"" >> .env.dev

# Build and test on testnet
move-to-json build "src/**/*.move" --network testnet
move-to-json deploy --config configs/iota-testnet.yaml --network testnet

# Test your contracts...
```

### 2. Production Deployment

```bash
# Ensure mainnet credentials are set
npx "@twin.org/wallet-cli" mnemonic --env wallet.env
npx "@twin.org/wallet-cli" address --load-env wallet.env --seed '!SEED' --count 5 --env address.env
echo "MAINNET_DEPLOYER_MNEMONIC=\"$(grep MNEMONIC wallet.env | cut -d'=' -f2 | tr -d '\"')\"" >> .env.dev

# Build for mainnet
move-to-json build "src/**/*.move" --network mainnet

# Deploy to mainnet (requires confirmation)
move-to-json deploy --config configs/iota-mainnet.yaml --network mainnet
```

### 3. Package.json Integration

```json
{
  "scripts": {
    "build:contracts": "move-to-json build \"src/contracts/**/*.move\" --network testnet --output compiled-modules.json",
    "build:contracts:mainnet": "move-to-json build \"src/contracts/**/*.move\" --network mainnet --output compiled-modules.json",
    "deploy:testnet": "move-to-json deploy --config configs/iota-testnet.yaml --network testnet",
    "deploy:mainnet": "move-to-json deploy --config configs/iota-mainnet.yaml --network mainnet"
  }
}
```

## Output Format

The tool generates a network-aware JSON structure:

```json
{
  "testnet": {
    "nft": {
      "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
      "package": "oRzrCwYAAAAKAQAKAgoQ...",
      "deployedPackageId": "0x2ce8bef3ed47ca852c4dc4a961d5f8f9c6e5d4c3b2a1f0e9d8c7b6a594837261"
    }
  },
  "devnet": {
    "nft": {
      "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
      "package": "oRzrCwYAAAAKAQAKAgoQ...",
      "deployedPackageId": null
    }
  },
  "mainnet": {
    "nft": {
      "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
      "package": "oRzrCwYAAAAKAQAKAgoQ...",
      "deployedPackageId": "0x5fg6dh75fi69ec073e7f1g1b8e7f6e5d4c3b2a1f0e9d8c7b6a594837261"
    }
  }
}
```

## Using in TypeScript

```typescript
import compiledModulesJson from './compiled-modules.json';

// Get current network from environment or config
const network = process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';

// Access deployed package ID for current network
const deployedPackageId = compiledModulesJson[network].nft.deployedPackageId;
const modules = compiledModulesJson[network].nft.package;

// Use in your IOTA client
const result = await iotaClient.publish({
  modules: [modules],
  packageId: deployedPackageId
});
```

## Error Handling

The tool provides comprehensive error handling:

### Missing Credentials
```
Error: Missing deployment mnemonic for mainnet. Please set MAINNET_DEPLOYER_MNEMONIC in your environment or .env.dev file.

You can generate a mnemonic using:
npx "@twin.org/wallet-cli" mnemonic --env wallet.env
npx "@twin.org/wallet-cli" address --load-env wallet.env --seed '!SEED' --count 5 --env address.env
```

### Insufficient Funds
```
Error: Insufficient funds for deployment. Required: 100000000, Available: 50000000
Please fund wallet address: iota1abc...xyz
```

### Network Mismatch
```
Error: Config network mismatch. Expected: mainnet, Actual: testnet
Please check your config file and --network parameter.
```

## Contributing

To contribute to this package see the guidelines for building and publishing in [CONTRIBUTING](./CONTRIBUTING.md)
