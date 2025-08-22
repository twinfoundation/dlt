module nft::nft {
    use iota::object::{Self, UID};
    use iota::transfer;
    use iota::tx_context::TxContext;
    use std::string::String;

    /// Current version of the NFT contract
    const VERSION: u64 = 1;

    /// Error codes
    const E_INCOMPATIBLE_VERSION: u64 = 1;
    const E_ALREADY_LATEST_VERSION: u64 = 2;
    const E_MIGRATION_DISABLED: u64 = 3;

    /// AdminCap provides administrative privileges for contract management
    public struct AdminCap has key, store {
        id: UID,
    }

    /// MigrationState tracks whether migration operations are enabled
    public struct MigrationState has key {
        id: UID,
        enabled: bool,
    }

    /// UpgradeCapRegistry stores reference to upgrade capabilities
    public struct UpgradeCapRegistry has key {
        id: UID,
        upgrade_cap_id: address,
    }

    /// Initialize the contract by creating and transferring AdminCap to deployer
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin_cap, ctx.sender());

        let migration_state = MigrationState {
            id: object::new(ctx),
            enabled: false,
        };
        transfer::share_object(migration_state);

        let upgrade_registry = UpgradeCapRegistry {
            id: object::new(ctx),
            upgrade_cap_id: @0x0,
        };
        transfer::share_object(upgrade_registry);
    }

    /// The NFT struct representing our NFT object.
    public struct NFT has key, store {
        id: UID,
        version: u64, // Version of the contract that created this NFT
        immutable_metadata: String, // All immutable data as JSON,
        tag: String,
        metadata: String, // Mutable metadata
        issuer: address,
        issuerIdentity: String,
        ownerIdentity: String
    }

    /// Internal function to assert NFT is compatible with current contract version
    fun assert_current_version(nft: &NFT) {
        assert!(nft.version == VERSION, E_INCOMPATIBLE_VERSION);
    }

    /// Mint a new NFT and transfer it to the issuer.
    public entry fun mint(
        immutable_metadata: String,
        tag: String,
        issuer: address,
        metadata: String,
        issuerIdentity: String,
        ownerIdentity: String,
        ctx: &mut TxContext
    ) {
        let nft = NFT {
            id: object::new(ctx),
            version: VERSION,
            immutable_metadata,
            tag,
            metadata,
            issuer,
            issuerIdentity,
            ownerIdentity
        };
        transfer::transfer(nft, issuer);
    }

    /// Update the mutable metadata of the NFT.
    /// Version-strict: Requires current version because metadata structure may change between versions
    public entry fun update_metadata(nft: &mut NFT, new_metadata: String) {
        // Version assertion required - metadata operations need consistent data structure
        assert_current_version(nft);
        nft.metadata = new_metadata;
    }

    /// Transfer without metadata update
    /// Version-flexible: Works with NFTs of any version for basic ownership transfer
    public entry fun transfer(
        mut nft: NFT, // Take ownership directly
        recipient: address,
        recipientIdentity: String
    ) {
        // No version assertion - basic transfers should work regardless of NFT version
        nft.ownerIdentity = recipientIdentity;

        transfer::public_transfer(nft, recipient);
    }

    /// Transfer with metadata update
    /// Version-strict: Requires current version because metadata structure may change between versions
    public entry fun transfer_with_metadata(
        mut nft: NFT, // Take ownership directly
        recipient: address,
        recipientIdentity: String,
        metadata: String
    ) {
        // Version assertion required - metadata operations need consistent data structure
        assert_current_version(&nft);
        nft.ownerIdentity = recipientIdentity;

        update_metadata(&mut nft, metadata);

        transfer::public_transfer(nft, recipient);
    }

    /// Burn the NFT.
    /// Version-flexible: Owners should always be able to destroy their NFTs regardless of version
    public entry fun burn(nft: NFT) {
        // No version assertion - burning should work for NFTs of any version
        let NFT {
            id,
            version: _,
            immutable_metadata: _,
            tag: _,
            metadata: _,
            issuer: _,
            issuerIdentity: _,
            ownerIdentity: _
        } = nft;
        object::delete(id);
    }

    /// Migrate an NFT to the current version (admin only)
    public entry fun migrate_nft(_admin_cap: &AdminCap, migration_state: &MigrationState, nft: &mut NFT) {
        assert!(migration_state.enabled, E_MIGRATION_DISABLED);
        assert!(is_migration_valid(nft), E_ALREADY_LATEST_VERSION);
        
        // Migration logic based on version
        if (nft.version == 1) {
            // Migrate from v1 to v2 (placeholder for future versions)
            nft.version = VERSION;
        }
        // Add more version migration logic here when needed
    }

    /// Enable migration operations (admin only)
    public entry fun enable_migration(_admin_cap: &AdminCap, migration_state: &mut MigrationState) {
        let current_state = migration_state.enabled;
        validate_migration_state_change(current_state, true);
        migration_state.enabled = true;
    }

    /// Disable migration operations (admin only)
    public entry fun disable_migration(_admin_cap: &AdminCap, migration_state: &mut MigrationState) {
        let current_state = migration_state.enabled;
        validate_migration_state_change(current_state, false);
        migration_state.enabled = false;
    }

    /// Check if migration is currently active
    public fun is_migration_active(migration_state: &MigrationState): bool {
        migration_state.enabled
    }

    /// Get the current contract version
    public fun get_current_version(): u64 {
        VERSION
    }

    /// Validate that migration state change is allowed
    fun validate_migration_state_change(current_enabled: bool, new_enabled: bool) {
        // Allow any state change for now - can be extended with business logic
        // Future validations could include:
        // - Checking if there are pending migrations
        // - Enforcing cooldown periods between state changes
        // - Requiring multiple admin confirmations for critical changes
        let _current = current_enabled;
        let _new = new_enabled;
    }

    /// Check if migration is valid for a specific NFT
    fun is_migration_valid(nft: &NFT): bool {
        // Only allow migration if NFT version is below current version
        nft.version < VERSION
    }

    /// Get NFT version without modifying the NFT
    public fun get_nft_version(nft: &NFT): u64 {
        nft.version
    }

    /// Check if NFT needs migration (public view function)
    public fun needs_migration(nft: &NFT): bool {
        nft.version < VERSION
    }
}
