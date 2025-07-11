# Network Configuration Files

This directory contains YAML configuration files for deploying Move smart contracts to different IOTA networks using the `move-to-json deploy` command.

## Available Networks

- **`iota-testnet.yaml`** - IOTA Testnet configuration with gas station support
- **`iota-devnet.yaml`** - IOTA Devnet configuration for development
- **`iota-mainnet.yaml`** - IOTA Mainnet configuration with enhanced security

## Configuration Structure

Each YAML file defines network-specific settings required for smart contract deployment:

### Basic Network Settings
```yaml
network: testnet          # Network identifier (testnet/devnet/mainnet)
platform: iota           # Platform type (currently only "iota" supported)
```

### RPC Configuration
```yaml
rpc:
  url: https://api.testnet.iota.cafe    # Network RPC endpoint
  timeout: 60000                        # Optional: RPC timeout in milliseconds
```

### Deployment Settings
```yaml
deployment:
  gasBudget: 50000000                   # Gas budget for transactions
  confirmationTimeout: 60               # Optional: Transaction confirmation timeout
  wallet:
    mnemonicId: deployer-mnemonic       # Vault key for deployment wallet mnemonic
    addressIndex: 0                     # Wallet address derivation index
  gasStation:                           # Optional: Gas station for fee sponsorship
    url: https://gas-station.testnet.iota.cafe
    authToken: ${GAS_STATION_AUTH}      # Environment variable reference
```

### Contract Configuration (Optional)
```yaml
contracts:
  nft:                                  # Contract identifier
    moduleName: nft                     # Move module name
    dependencies: ["0x1", "0x2"]       # Optional: Contract dependencies
    packageController:                  # Optional: Package controller settings
      addressIndex: 0                   # Address index for package controller
```

## Usage

### 1. Environment Setup

Set required environment variables:
```bash
export GAS_STATION_AUTH="your-auth-token"
# Add other environment variables as needed
```

### 2. Deploy Command

Deploy compiled contracts to a specific network:
```bash
# Deploy to testnet
move-to-json deploy --config configs/iota-testnet.yaml --network testnet

# Deploy to devnet
move-to-json deploy --config configs/iota-devnet.yaml --network devnet

# Deploy to mainnet
move-to-json deploy --config configs/iota-mainnet.yaml --network mainnet
```

### 3. Additional Options

```bash
# Dry run (simulate without executing)
move-to-json deploy --config configs/iota-testnet.yaml --network testnet --dry-run

# Force redeployment of existing packages
move-to-json deploy --config configs/iota-testnet.yaml --network testnet --force

# Specify custom contracts file
move-to-json deploy --config configs/iota-testnet.yaml --network testnet --contracts my-contracts.json
```

## Security Best Practices

### Environment Variables
- Store sensitive values (auth tokens, mnemonics) in environment variables
- Never commit sensitive credentials to version control
- Use `${VARIABLE_NAME}` syntax in YAML files for environment variable substitution

### Network-Specific Security
- **Testnet**: Use test mnemonics and tokens only
- **Devnet**: Suitable for development and testing
- **Mainnet**: Use hardware wallets or secure key management for production deployments

### Wallet Configuration
- Use different `mnemonicId` values for different environments
- Consider using different `addressIndex` values for contract deployment vs. package control
- Store mnemonics securely in your vault system

## Configuration Validation

The deploy command validates that:
- Network specified in `--network` matches the config file's `network` field
- Required fields are present (RPC URL, gas budget, wallet mnemonic ID)
- Environment variables referenced in the config are available

## Troubleshooting

### Common Issues

1. **"Config network mismatch"**
   - Ensure `--network` parameter matches the `network` field in your config file

2. **"RPC URL is required"**
   - Check that `rpc.url` is specified in your config file

3. **"Environment variable not found"**
   - Ensure all referenced environment variables (e.g., `${GAS_STATION_AUTH}`) are set

4. **"Wallet mnemonic ID is required"**
   - Verify `deployment.wallet.mnemonicId` is specified in your config

### Example Error Resolution

If you see a gas budget error, adjust the `deployment.gasBudget` value:
```yaml
deployment:
  gasBudget: 100000000  # Increase if transactions fail due to insufficient gas
```

## Customization

You can create custom configuration files by copying and modifying the existing templates:

```bash
cp configs/iota-testnet.yaml configs/my-custom-network.yaml
# Edit my-custom-network.yaml with your settings
move-to-json deploy --config configs/my-custom-network.yaml --network testnet
```

Remember to update the `network` field and other settings as appropriate for your deployment environment.
