# Move-to-JSON Enhanced Deployment Task

## Executive Summary

Transform the Move-to-JSON tool to centralize smart contract deployment responsibility within the development team, eliminating runtime deployment by end users. This enhancement will introduce network-specific pre-deployment with published package IDs, streamlined bootstrap processes, and comprehensive configuration management for testnet, devnet, and mainnet environments.

## Current State Analysis

### Existing Architecture
- **Current Tool**: `@twin.org/move-to-json` CLI that compiles Move contracts to Base64 and generates package IDs
- **Build Process**: NFT package uses `build:contracts` script: `move-to-json "src/contracts/**/*.move" src/contracts/compiledModules/compiled-modules.json --platform iota`
- **Runtime Deployment**: `IotaNftConnector.start()` method deploys contracts during bootstrap if package doesn't exist
- **Package Management**: Single `compiled-modules.json` with computed package IDs and Base64 modules
- **Current Import**: `import compiledModulesJson from "./contracts/compiledModules/compiled-modules.json"`

### Current Deployment Flow
```typescript
// 1. Build time: Compile contracts
npm run build:contracts

// 2. Runtime: Check if package exists, deploy if not
const contractData = compiledModulesJson[this._contractName];
const packageExists = await Iota.packageExistsOnNetwork(client, packageId);
if (!packageExists) {
  // Deploy contract with txb.publish()
}
```

### Current JSON Structure
```json
{
  "nft": {
    "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
    "package": "oRzrCwYAAAAKAQAKAgoQ..."
  }
}
```

## Proposed Architecture Changes

### 1. Enhanced Move-to-JSON Tool

#### New Command Structure
```bash
# Current
move-to-json "src/contracts/**/*.move" output.json --platform iota

# Enhanced with separate build and deploy commands
move-to-json build "src/contracts/**/*.move" --output contracts/compiled-modules.json
move-to-json deploy --config config/iota-testnet.yaml --contracts contracts/compiled-modules.json --network testnet
move-to-json deploy --config config/iota-mainnet.yaml --contracts contracts/compiled-modules.json --network mainnet
```

#### Network-Specific Output Structure
```
src/contracts/
├── compiled-modules.json              # Network-specific deployed contracts
└── config/
    ├── iota-testnet.yaml              # Testnet deployment config
    ├── iota-devnet.yaml               # Devnet deployment config
    └── iota-mainnet.yaml              # Mainnet deployment config
```

### 2. New CLI Commands and Options

#### Build Command
```typescript
interface BuildOptions {
  output: string;          // Output file for compiled modules
  contracts: string;       // Glob pattern for .move files
}
```

#### Deploy Command  
```typescript
interface DeployOptions {
  config: string;          // Path to network config file
  contracts: string;       // Path to compiled modules JSON
  network: string;         // Network identifier (testnet/devnet/mainnet)
  dryRun?: boolean;       // Simulate deployment without executing
  force?: boolean;        // Force redeployment of existing packages
}
```

### 3. Network Configuration Files

#### IOTA Network Config Template
```yaml
# config/iota-testnet.yaml
network: testnet
platform: iota
rpc:
  url: https://api.testnet.iota.cafe
  timeout: 60000
deployment:
  gasBudget: 50000000
  confirmationTimeout: 60
  wallet:
    mnemonicId: deployer-mnemonic     # Vault key for deployment mnemonic
    addressIndex: 0
  gasStation:                         # Optional gas station configuration
    url: https://gas-station.testnet.iota.cafe
    authToken: ${GAS_STATION_AUTH}   # Environment variable
contracts:
  nft:
    moduleName: nft
    dependencies: ["0x1", "0x2"]
    packageController:
      addressIndex: 0                 # Address index for package controller
```

#### Environment-Specific Configurations
```yaml
# config/iota-mainnet.yaml
network: mainnet
platform: iota
rpc:
  url: https://api.mainnet.iota.cafe
deployment:
  gasBudget: 100000000
  wallet:
    mnemonicId: mainnet-deployer-mnemonic
    addressIndex: 0
  gasStation:
    url: ${MAINNET_GAS_STATION_URL}
    authToken: ${MAINNET_GAS_STATION_AUTH}
  security:
    requireConfirmation: true
    backupPackageIds: true
```

### 4. Enhanced JSON Output Format

#### New Network-Specific Structure (`compiled-modules.json`)
```json
{
  "testnet": {
    "nft": {
      "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
      "package": "oRzrCwYAAAAKAQAKAgoQ...",
      "deployedPackageId": "0x2ce8bef3ed47ca852c4dc4a961d5f8f9c6e5d4c3b2a1f0e9d8c7b6a594837261",
    }
  },
  "devnet": {
    "nft": {
      "packageId": "0x1bd7add2dc75ba6a840e21792a1ba51d807ce9c3b29c4fa2140f383e77988daa",
      "package": "oRzrCwYAAAAKAQAKAgoQ...",
      "deployedPackageId": "0x4ef5cg64eh58db962d5ec5b072e6f0f0a7d6e5d4c3b2a1f0e9d8c7b6a594837261"
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

## Implementation Plan

### Phase 1: Enhanced Move-to-JSON Tool

#### 1.1 New CLI Commands
- [ ] **Add `build` subcommand**
  - Compile Move contracts to build artifacts
  - Generate enhanced `compiled-modules.json` with network structure
  - Support only IOTA platform
  
- [ ] **Add `deploy` subcommand**
  - Deploy contracts to specified network
  - Update network-specific section in `compiled-modules.json`
  - Support gas station sponsoring
  - Include dry-run capability

#### 1.2 Configuration System
- [ ] **YAML configuration parser**
  - Network-specific configuration files
  - Environment variable substitution
  - Validation and error handling
  - IOTA-only platform support
  
- [ ] **Multi-network support**
  - Testnet, devnet, mainnet configurations
  - IOTA-specific settings only
  - Gas station integration



### Phase 2: Integration with Existing Packages

#### 2.1 NFT Package Updates
- [ ] **Remove runtime deployment logic**
  ```typescript
  // Remove from IotaNftConnector.start():
  // - Contract compilation and deployment
  // - Package existence checking
  // - Transaction publishing logic
  ```

- [ ] **Update contract loading**
  ```typescript
  // New import structure (same file, new format):
  import compiledModulesJson from "./contracts/compiledModules/compiled-modules.json";
  
  // Network-aware contract loading
  const getContractsForNetwork = (network: string) => {
    const networkContracts = compiledModulesJson[network];
    if (!networkContracts) {
      throw new Error(`No contracts found for network: ${network}`);
    }
    return networkContracts;
  };
  
  // Updated usage in IotaNftConnector.start():
  const networkContracts = getContractsForNetwork(this._config.network);
  const contractData = networkContracts[this._contractName];
  
  if (!contractData || !contractData.deployedPackageId) {
    throw new Error(`Contract ${this._contractName} not deployed on ${this._config.network}`);
  }
  
  this._deployedPackageId = contractData.deployedPackageId;
  ```

#### 2.2 Build Script Updates
- [ ] **Enhanced package.json scripts**
  ```json
  {
    "scripts": {
      "build:contracts": "move-to-json build \"src/contracts/**/*.move\" --output src/contracts/compiledModules/compiled-modules.json",
      "deploy:testnet": "move-to-json deploy --config config/iota-testnet.yaml --contracts src/contracts/compiledModules/compiled-modules.json --network testnet",
      "deploy:devnet": "move-to-json deploy --config config/iota-devnet.yaml --contracts src/contracts/compiledModules/compiled-modules.json --network devnet",
      "deploy:mainnet": "move-to-json deploy --config config/iota-mainnet.yaml --contracts src/contracts/compiledModules/compiled-modules.json --network mainnet"
    }
  }
  ```

### Phase 3: Developer Workflow Integration

#### 3.1 GitHub Actions Integration
- [ ] **Automated contract deployment**
  ```yaml
  # .github/workflows/deploy-contracts.yaml
  name: Deploy Smart Contracts
  on:
    workflow_dispatch:
      inputs:
        network:
          type: choice
          options: [testnet, devnet, mainnet]
        force:
          type: boolean
          default: false
  
  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - name: Deploy Contracts
          run: |
            npm run build:contracts
            npm run deploy:${{ github.event.inputs.network }} ${FORCE_FLAG}
          env:
            DEPLOYER_MNEMONIC: ${{ secrets.DEPLOYER_MNEMONIC }}
            GAS_STATION_AUTH: ${{ secrets.GAS_STATION_AUTH }}
  ```

#### 3.2 Development Team Workflow
- [ ] **Pre-deployment checklist**
  1. Contract changes reviewed and approved
  2. Network-specific configurations updated
  3. Deployment credentials secured
  4. Backup procedures in place

- [ ] **Deployment process**
  1. Build contracts: `npm run build:contracts`
  2. Deploy to testnet: `npm run deploy:testnet`
  3. Validate deployment and test functionality
  4. Deploy to mainnet: `npm run deploy:mainnet`
  5. Update package versions and publish



## Security Considerations

### Mainnet Deployment Security
- [ ] **Wallet Management**
  - Use dedicated deployment wallets
  - Implement hardware wallet support for mainnet
  - Separate testing wallets from production funding sources

- [ ] **Configuration Security**
  - Store sensitive credentials in GitHub secrets
  - Implement configuration validation
  - Add deployment confirmation steps for mainnet

- [ ] **Package Verification**
  - Implement package ID verification post-deployment
  - Add checksums for deployed contracts
  - Maintain deployment audit logs

### Gas Station Integration
- [ ] **Sponsored Deployment Support**
  - Configure gas station for each network
  - Implement fallback to direct payment
  - Add cost monitoring and limits

## Testing Strategy

### Unit Tests
- [ ] **Move-to-JSON Tool Tests**
  - Build command functionality
  - Deploy command functionality  
  - Configuration parsing and validation
  - Network-specific JSON structure generation
  - Error handling and edge cases

### Integration Tests
- [ ] **End-to-End Deployment Tests**
  - Test deployment to testnet
  - Verify contract functionality post-deployment
  - Test network-specific configuration loading
  - Validate new JSON structure in NFT package

### Migration Tests
- [ ] **Backward Compatibility Tests**
  - Ensure existing NFT functionality works
  - Test gradual migration scenarios
  - Validate fallback mechanisms
  - Test old-to-new format conversion

## Success Criteria

### Functional Requirements
- [ ] Smart contracts deployed by development team only
- [ ] Network-specific package ID management working in single JSON file
- [ ] Zero runtime deployment by end users
- [ ] Gas station integration functional for all networks
- [ ] Comprehensive error handling and recovery

### Performance Requirements
- [ ] Contract loading performance equivalent to current system
- [ ] Deployment time under 5 minutes per network
- [ ] Build process time unchanged or improved

### Operational Requirements
- [ ] Automated deployment pipelines functional
- [ ] Comprehensive monitoring and logging
- [ ] Clear rollback procedures documented
- [ ] Security audit completed for mainnet deployment

## Risks and Mitigation

### Technical Risks
- **Risk**: Breaking changes to existing packages
  **Mitigation**: Implement backward compatibility and gradual migration with format detection
  
- **Risk**: Network-specific deployment failures
  **Mitigation**: Implement robust error handling and rollback procedures

### Operational Risks  
- **Risk**: Loss of deployment credentials
  **Mitigation**: Use secure credential storage and backup procedures
  
- **Risk**: Gas station service unavailability
  **Mitigation**: Implement fallback to direct payment methods

## Documentation Updates

### Developer Documentation
- [ ] Update move-to-json tool documentation
- [ ] Create network deployment guides
- [ ] Document new build and deployment workflows
- [ ] Document new JSON structure format

### API Documentation
- [ ] Update NFT package documentation
- [ ] Document new contract loading patterns
- [ ] Create migration guide for existing projects
- [ ] Document network-specific configuration

## Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Weeks 1-2 | Enhanced move-to-json tool with new network-aware JSON structure |
| Phase 2 | Weeks 3-4 | NFT package updates and network support with new JSON format |
| Phase 3 | Weeks 5-6 | Full migration and contract deployment to all networks |
| Phase 4 | Week 7 | Cleanup, documentation, and release |

**Total Estimated Duration**: 7 weeks

## Next Steps

1. **Review and Approve**: Technical review of this specification
2. **Resource Allocation**: Assign development team members
3. **Environment Setup**: Prepare deployment credentials and configurations
4. **Implementation Start**: Begin Phase 1 development with new JSON structure
5. **Regular Check-ins**: Weekly progress reviews and adjustments
