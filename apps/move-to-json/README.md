# TWIN Move to JSON

Tool to convert Move source files to JSON with network-specific deployment support.

## Prerequisites

### IOTA CLI Installation

Before using this tool, you need to install the IOTA CLI. The simplest way is using Homebrew:

```bash
# Install IOTA CLI using Homebrew (macOS/Linux/WSL)
brew install iotaledger/tap/iota
```

**Alternative installation methods:**

For other platforms or installation from source, see the [official IOTA installation guide](https://docs.iota.org/developer/getting-started/install-iota).

**Verify installation:**
```bash
iota --version
```

## Installation

```shell
npm install -g @twin.org/move-to-json
```

## Quick Start

```bash
# Build contracts for mainnet using npx
npx move-to-json build "src/**/*.move" --network mainnet --output compiled-modules.json

# Deploy to mainnet using npx  
npx move-to-json deploy --network mainnet
```

## Environment Setup for Production Deployments

### Required Environment Variables

For production deployments, you need to set up environment variables containing your deployment credentials. The tool uses network-specific configuration files located in the `configs/` directory.

#### 1. Create Environment Files

Copy the environment templates for each network you plan to use:

```bash
# Copy environment templates for each network
cp configs/testnet.env.example configs/testnet.env
cp configs/devnet.env.example configs/devnet.env  
cp configs/mainnet.env.example configs/mainnet.env
```

**Note:** Only copy the environment files for the networks you actually plan to deploy to. For development, you typically only need `testnet.env` and `devnet.env`.

#### 2. Generate Deployment Mnemonics

Use the wallet CLI to generate secure mnemonics and then manually update the appropriate network configuration files with the generated mnemonic.

### Environment Variable Reference

Each network has its own configuration file in the `configs/` directory with the required deployment mnemonic:

| Network | File | Required Variable |
|---------|------|-------------------|
| Testnet | `configs/testnet.env` | `TESTNET_DEPLOYER_MNEMONIC` |
| Devnet | `configs/devnet.env` | `DEVNET_DEPLOYER_MNEMONIC` |
| Mainnet | `configs/mainnet.env` | `MAINNET_DEPLOYER_MNEMONIC` |

### Security Best Practices

#### Local Development
- Store credentials in `configs/*.env` files (never commit to git - only commit `.example` files)
- Use test mnemonics with faucet funds for testnet/devnet
- Use dedicated deployment wallets separate from personal wallets

#### CI/CD and Production
- Store credentials in GitHub Secrets or your CI/CD secrets manager
- Use hardware wallets or HSM for mainnet deployment keys
- Implement approval workflows for mainnet deployments
- Monitor wallet balances and deployment costs

### Generating Credentials

#### 1. Generate Mnemonic and Seed
```bash
# Generate a new 24-word mnemonic and save to wallet.env
npx "@twin.org/wallet-cli" mnemonic --env wallet.env
```

#### 2. Generate Addresses from Seed
```bash
# Generate 5 addresses and save to address.env
npx "@twin.org/wallet-cli" address --load-env wallet.env --seed '!SEED' --count 5 --env address.env
```

## Commands

### build

Compile Move contracts for a specific network:

```bash
# Using npx (recommended for global usage)
npx move-to-json build "src/**/*.move" --network <network> [--output <file>]

# If installed globally
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
# Build for testnet
npx move-to-json build "tests/fixtures/sources/**/*.move" --network testnet --output tests/fixtures/compiled-modules/compiled-modules.json

# Build for mainnet
npx move-to-json build "src/contracts/**/*.move" --network mainnet --output compiled-modules.json
```

### deploy

Deploy compiled contracts to the specified network:

```bash
# Using npx (recommended for global usage)
npx move-to-json deploy --network <network> [options]

# If installed globally
move-to-json deploy --network <network> [options]
```

**Options:**
- `--network <network>` - Network identifier (testnet/devnet/mainnet) **[Required]**
- `--contracts <file>` - Compiled modules JSON file (default: compiled-modules.json)
- `--dry-run` - Simulate deployment without executing
- `--force` - Force redeployment of existing packages

**What it does:**
1. Loads network-specific configuration from `configs/{network}.env` file
2. Validates deployment credentials are available
3. Checks wallet balance against gas requirements
4. Loads compiled contracts from JSON
5. Deploys using IOTA CLI with network-specific settings
6. Updates JSON with deployed package IDs

**Example:**
```bash
# Deploy to testnet
npx move-to-json deploy --network testnet

# Deploy to mainnet
npx move-to-json deploy --network mainnet

# Dry run (simulation)
npx move-to-json deploy --network testnet --dry-run
```

## Network Configuration Files

The tool uses environment configuration files for each network in the `configs/` directory:

### configs/mainnet.env

```env
# IOTA Mainnet Network Configuration
NETWORK=mainnet
PLATFORM=iota

# RPC Configuration
RPC_URL=https://api.mainnet.iota.cafe
RPC_TIMEOUT=60000

# Deployment Configuration
GAS_BUDGET=100000000
CONFIRMATION_TIMEOUT=120

# Wallet Configuration  
MAINNET_DEPLOYER_MNEMONIC="word1 word2 word3 ... word24"
ADDRESS_INDEX=0

# Optional: Gas Station Configuration
# GAS_STATION_URL=https://gas-station.mainnet.iota.cafe
# GAS_STATION_AUTH=your-mainnet-auth-token
```

### configs/testnet.env

```env
# IOTA Testnet Network Configuration
NETWORK=testnet
PLATFORM=iota

# RPC Configuration
RPC_URL=https://api.testnet.iota.cafe
RPC_TIMEOUT=60000

# Deployment Configuration
GAS_BUDGET=50000000
CONFIRMATION_TIMEOUT=60

# Wallet Configuration
TESTNET_DEPLOYER_MNEMONIC="word1 word2 word3 ... word24"
ADDRESS_INDEX=0

# Optional: Gas Station Configuration
# GAS_STATION_URL=https://gas-station.testnet.iota.cafe
# GAS_STATION_AUTH=your-testnet-auth-token
```

## Complete Workflow

### 1. Development Workflow

```bash
# Set up environment file and generate credentials
cp configs/testnet.env.example configs/testnet.env
# Generate credentials and update testnet.env with your mnemonic

# Build and test on testnet
npx move-to-json build "src/**/*.move" --network testnet
npx move-to-json deploy --network testnet
```

### 2. Production Deployment

```bash
# Set up mainnet environment file and credentials
cp configs/mainnet.env.example configs/mainnet.env
# Generate secure credentials and update mainnet.env with your mnemonic

# Build and deploy to mainnet
npx move-to-json build "src/**/*.move" --network mainnet
npx move-to-json deploy --network mainnet
```

## Output Format

The tool generates a network-aware JSON structure:

```json
{
  "testnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ...",
    "deployedPackageId": "0x2ce8bef3ed47ca852c4dc4a961d5f8f9c6e5d4c3b2a1f0e9d8c7b6a594837261"
  },
  "devnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ...",
    "deployedPackageId": null
  },
  "mainnet": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ...",
    "deployedPackageId": "0x5fg6dh75fi69ec073e7f1g1b8e7f6e5d4c3b2a1f0e9d8c7b6a594837261"
  }
}
```



## Contributing

To contribute to this package see the guidelines for building and publishing in [CONTRIBUTING](./CONTRIBUTING.md)
