# Move-to-JSON Task Overview

## Description

- Smart contracts' deployment will now be centralised within the development team, eliminating user deployment responsibilities.
- Move-to-JSON tool will be modified to include a publish option for compiling contracts to base64 format with output package IDs integrated into TypeScript packages.
- Network-specific deployment structure will feature separate subfolders for testnet, devnet, and mainnet in the JSON output format.
- Package ID management will transition to pre-published IDs from JSON files, simplifying the bootstrap process for deployments.
- Environmental config requirements for mainnet include wallet credentials and gas station setup, aligning with existing workflows.

## Smart Contract Deployment Architecture Changes

- Workflow restructuring required for smart contracts to centralise deployment responsibility to the development team only, eliminating the need for individual users to deploy contracts themselves.
- Move-to-JSON tool modification needed to include a publish option that compiles contracts to base64 format and publishes them with output package IDs built into TypeScript packages.
- Network-specific deployment structure proposed with separate subfolders for testnet, devnet, and mainnet versions in the JSON output format.
- Package ID management will shift from runtime deployment to pre-published IDs imported from JSON files, simplifying the bootstrap process.
- Environmental configuration requirements identified for mainnet deployments, requiring wallet credentials and gas station setup similar to existing component workflows.

## Technical Implementation Details

- Command structure redesign with separate build and deploy commands, maintaining consistency across all network types while accommodating mainnet funding requirements.
- Configuration file approach using separate IOTA config files for each network (testnet, devnet, mainnet) with command-line options for environment switching.
- Mnemonic and address index implementation for mainnet deployments, stored in dotenv files for easier GitHub workflow configuration.
- Security considerations for wallet management, including separate testing wallets to prevent compromise of main funding sources.

## Impact on the NFT package

- Basically in the NFT, for example, iotaNftConnector in the bootstrap method, the start method specifically, everything about contract data and compiled modules and verifying if the package exists on the network or not will go away because this will exist by default and by design of the changes we are going to make to the dlt package and specifically to the move-to-json tool, inside the apps folder.

## Additional considerations

- Make sure you look at the move to JSON folder inside the DLT to see the structure and how everything works. And also check the NFT package to see how this move to JSON tool is currently used in the NFT. So that you have greater context of the changes we need to implement. Like the "build" and "build:contracts" commands from the NFT's package.json file.
