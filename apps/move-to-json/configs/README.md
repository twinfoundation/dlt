// TODO: Remove this before finishing and creating a PR
# Network Configuration Files

This directory contains environment configuration files for deploying Move smart contracts to different IOTA networks using the `move-to-json deploy` command.

## Available Networks

- **`testnet.env`** - IOTA Testnet configuration with testnet-specific mnemonic
- **`devnet.env`** - IOTA Devnet configuration with devnet-specific mnemonic  
- **`mainnet.env`** - IOTA Mainnet configuration with mainnet-specific mnemonic
- **`{network}.env.example`** - Example configuration templates for each network

## Configuration Structure

Each `.env` file defines network-specific settings required for smart contract deployment:

### Basic Network Settings
```env
NETWORK=testnet          # Network identifier (testnet/devnet/mainnet)
PLATFORM=iota           # Platform type (currently only "iota" supported)
```

### RPC Configuration
```env
RPC_URL=https://api.testnet.iota.cafe    # Network RPC endpoint
RPC_TIMEOUT=60000                        # Optional: RPC timeout in milliseconds
```

### Deployment Settings
```env
GAS_BUDGET=50000000                      # Gas budget for transactions
CONFIRMATION_TIMEOUT=60                  # Optional: Transaction confirmation timeout
ADDRESS_INDEX=0                          # Wallet address derivation index

# Network-specific mnemonic (24 words)
TESTNET_DEPLOYER_MNEMONIC="word1 word2 word3 ... word24"
```

### Optional Gas Station Configuration
```env
# Optional: Gas station for fee sponsorship
GAS_STATION_URL=https://gas-station.testnet.iota.cafe
GAS_STATION_AUTH=your-auth-token
```

## Security and Mnemonic Management

### Network-Specific Mnemonics
Each network uses its own dedicated mnemonic for enhanced security:

- **`TESTNET_DEPLOYER_MNEMONIC`** - Dedicated testnet deployment wallet
- **`DEVNET_DEPLOYER_MNEMONIC`** - Dedicated devnet deployment wallet  
- **`MAINNET_DEPLOYER_MNEMONIC`** - Dedicated mainnet deployment wallet

### Funding Strategy
- **Testnet/Devnet**: Generate private mnemonics, then fund via faucet
  - Testnet Faucet: `https://faucet.testnet.iota.cafe/`
  - Devnet Faucet: `https://faucet.devnet.iota.cafe/`
- **Mainnet**: Use production-grade security with real IOTA tokens

### Seed Derivation
The tool supports two methods for wallet address generation:

1. **Mnemonic-based (default)**: Automatically derives seeds from mnemonics using wallet CLI
2. **Seed-based (preferred)**: Uses pre-generated seeds directly for consistent addresses

**Important**: Different BIP39 implementations may generate different seeds from the same mnemonic due to passphrase handling differences. If you have existing funded wallets, use the seed-based approach to maintain consistent addresses.

## Usage

### 1. Environment Setup

Copy the example files and customize:
```bash
cp configs/testnet.env.example configs/testnet.env
cp configs/devnet.env.example configs/devnet.env  
cp configs/mainnet.env.example configs/mainnet.env

# Edit each file with your actual mnemonics
```

### 2. Generate Mnemonics and Seeds

Generate separate mnemonics and seeds for each network:
```bash
# Generate testnet mnemonic and seed
npx "@twin.org/wallet-cli" mnemonic --env testnet-wallet.env
# Copy MNEMONIC and SEED values to configs/testnet.env as:
# TESTNET_DEPLOYER_MNEMONIC="..." 
# TESTNET_DEPLOYER_SEED="..."

# Generate devnet mnemonic and seed
npx "@twin.org/wallet-cli" mnemonic --env devnet-wallet.env
# Copy MNEMONIC and SEED values to configs/devnet.env as:
# DEVNET_DEPLOYER_MNEMONIC="..."
# DEVNET_DEPLOYER_SEED="..."

# Generate mainnet mnemonic and seed
npx "@twin.org/wallet-cli" mnemonic --env mainnet-wallet.env
# Copy MNEMONIC and SEED values to configs/mainnet.env as:
# MAINNET_DEPLOYER_MNEMONIC="..."
# MAINNET_DEPLOYER_SEED="..."
```

**Recommendation**: Always include both mnemonic and seed in your config files. The tool will prefer the seed if available, ensuring consistent wallet addresses even if BIP39 implementations differ.

### 3. Deploy Command

Deploy compiled contracts to a specific network:
```bash
# Deploy to testnet
move-to-json deploy --network testnet

# Deploy to devnet
move-to-json deploy --network devnet

# Deploy to mainnet
move-to-json deploy --network mainnet
```

### 4. Additional Options

```bash
# Dry run (simulate without executing)
move-to-json deploy --network testnet --dry-run

# Force redeployment of existing packages
move-to-json deploy --network testnet --force

# Specify custom contracts file
move-to-json deploy --network testnet --contracts my-contracts.json
```

## Configuration Validation

The deploy command validates that:
- Network-specific `.env` file exists in `configs/` directory
- Required fields are present (RPC URL, gas budget, network-specific mnemonic)
- Mnemonic contains exactly 24 words
- Network identifier matches between `--network` parameter and config file

## Troubleshooting

### Common Issues

1. **"Failed to load environment file"**
   - Ensure `configs/{network}.env` file exists
   - Check file permissions and format

2. **"Missing deployment mnemonic"**
   - Ensure correct mnemonic environment variable is set (e.g., `TESTNET_DEPLOYER_MNEMONIC`)
   - Verify mnemonic contains exactly 24 words

3. **"Invalid mnemonic format"**
   - Check that mnemonic contains exactly 24 space-separated words
   - Ensure no extra quotes or formatting characters

4. **"Insufficient wallet balance"**
   - For testnet/devnet: Fund wallet via faucet
   - For mainnet: Add real IOTA tokens to wallet

### Example Configuration Files

See the `.env.example` files in this directory for complete configuration templates.

### Generating Wallet Addresses

To see the wallet address that will be used for deployment:
```bash
# The deploy command shows wallet address in dry-run mode
move-to-json deploy --network testnet --dry-run
```
