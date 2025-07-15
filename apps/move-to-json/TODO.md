// TODO:

✅ Balance checking issues identified with IOTA client, requiring further investigation into correct balance calculations due to multiple coin objects returning the same balance
  ✅ Test balance calculation by performing small nano transfer to understand coin object structure
  ✅ Sum all coin object balances in JSON output to verify total balance calculation

* Regex replacement concerns identified as potential failure points in the current implementation, particularly for network configuration updates.
  * Investigate if move.toml can support multiple network dependencies to avoid regex replacements
* use three separate .env files for each network to manage configurations, moving away from YAML configs
* Refactor package structure to remove NFT label
  * Populate the compiled-modules.json one by one based on the network we are building for. So right now we are doing them all at once because the package ID and the base64 string are the same but we might introduce let's say debugging for mainnet inside the contract and that would imply a different base64. So let's transition from doing them all at once to isolating them and making them independent.
* Mnemonic management strategy to keep private for all networks while using faucet for devnet/testnet funding.
* Smart contract versioning concern raised about maintaining backward compatibility when updating contracts with new deployment IDs.
  * Update flag investigation needed to understand how smart contract updates maintain access to shared objects.
  * Version number management in move.toml file may be key to proper smart contract update procedures.
* check if we have available a nanosToIota
* check nft structure and make sure our tool will work
* update readme with the latest and include how to install CLI with HOMEBREW



1. Shared Object Access Control
Critical Discovery: The investigation revealed a major backward compatibility concern:
All previous package versions remain accessible on-chain
Old versions can still interact with shared objects
This can break invariants maintained by newer versions

Example from Sui documentation:
// Version 1: Simple increment
public entry fun increment(c: &mut Counter) {
    c.value = c.value + 1;
}

// Version 2: Increment with events every 100
public entry fun increment(c: &mut Counter) {
    c.value = c.value + 1;
    if (c.value % 100 == 0) {
        event::emit(Progress { reached: c.value });
    }
}

Problem: If users call both versions, the event emission invariant breaks.