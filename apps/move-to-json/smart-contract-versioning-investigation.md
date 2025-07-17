# Smart Contract Versioning Investigation Results
📋 **Comprehensive Analysis of IOTA Move Smart Contract Versioning & Update Procedures**

## Executive Summary

Based on comprehensive research across IOTA Move documentation, contract analysis, and broader Move ecosystem practices, this investigation reveals critical findings about smart contract versioning on IOTA that directly impact the verifiable storage and NFT connector implementations.

---

## ✅ IOTA Move Smart Contract Versioning System

### 1. Package-Based Versioning Architecture

IOTA follows the Move standard with these key characteristics:

**Package ID-Based Versioning:**
- Each deployment creates a new immutable package with a unique ID
- Linear version history - packages can only be upgraded from the latest version
- `UpgradeCap` objects control upgrade permissions (generated during initial publication)
- All previous package versions remain permanently accessible on-chain

**Critical Discovery from Documentation:**
- IOTA explicitly mentions in the Simple Token Transfer tutorial that packages generate an `UpgradeCap` object during deployment
- Transaction output shows: `ObjectType: 0x2::package::UpgradeCap` created for every package deployment
- This confirms IOTA implements the full Move package upgrade system

### 2. Version Tracking in Move.toml

**Metadata-Only Versioning:**
```toml
[package]
name = "my_package"
version = "0.1.0"  # This is purely informational
```

Key findings:
- Version field in Move.toml is for developer reference only
- On-chain versioning uses Package IDs and upgrade sequences
- No automatic semantic versioning enforcement at protocol level

### 3. IOTA-Specific Implementation Details

**Object-Centric Storage Model:**
- IOTA eliminated global storage operations (`move_to`, `move_from`)
- Objects and packages assigned unique identifiers
- Parallel transaction execution through non-overlapping inputs
- 32-byte address type for both objects and accounts

**Module Initializers:**
- `init` function runs only once during module publication
- Used for creating singleton objects and initial state
- Critical for package upgrade initialization

---

## ⚠️ Backward Compatibility Analysis

### 4. Update Mechanisms & Compatibility Requirements

Based on IOTA's inheritance from Sui Move patterns:

**✅ Compatible Changes (Allowed):**
- Adding new functions, types, modules
- Changing function implementations
- Removing ability constraints on type parameters
- Adding abilities to struct definitions
- Changing non-public function signatures

**❌ Incompatible Changes (Forbidden):**
- Changing public function signatures
- Modifying existing struct layouts (adding/removing/changing fields)
- Adding new ability constraints on type parameters
- Removing abilities from structs

### 5. Shared Object Access Control - Critical Issue

**Major Backward Compatibility Concern:**
- All previous package versions remain accessible on-chain
- Old versions can still interact with shared objects
- This can break invariants maintained by newer versions

**Example of Invariant Violation:**
```move
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
```

**Problem:** Users calling both versions break the event emission invariant.

### 6. Recommended Versioning Patterns

**Versioned Shared Object Pattern:**
```move
struct Counter has key {
    id: UID,
    version: u64,        // Object version
    admin: ID,           // Admin capability ID
    value: u64,
}

const VERSION: u64 = 2;  // Package version

public fun increment(c: &mut Counter) {
    assert!(c.version == VERSION, EWrongVersion);
    c.value = c.value + 1;
}

// Migration function for admins
entry fun migrate(c: &mut Counter, a: &AdminCap) {
    assert!(c.admin == object::id(a), ENotAdmin);
    assert!(c.version < VERSION, ENotUpgrade);
    c.version = VERSION;
}
```

---

## 🔍 Verifiable Storage Contract Analysis

### 7. Current Implementation Status

**Contract Location:** `verifiable-storage/packages/verifiable-storage-connector-iota/src/contracts/verifiableStorage/sources/verifiable_storage.move`

**✅ Verified Findings:**
- **Version field present:** `version: u8` in `StorageItem` struct
- **No version checking:** Functions lack version validation
- **Shared object pattern:** Uses `transfer::share_object(storage)`
- **Access control:** Allowlist-based permissions

**Current Structure:**
```move
struct StorageItem has key, store {
    id: UID,
    data: String,
    epoch: u64,
    version: u8,          // ✅ Version field exists
    creator: address,
    allowlist: vector<address>,
    max_allowlist_size: u16
}
```

### 8. Verifiable Storage Versioning Concerns

**🚨 Critical Issues Identified:**

1. **No Version Validation:**
   - `update_data()` function lacks version checks
   - Old package versions can modify shared `StorageItem` objects
   - Risk of data corruption from deprecated logic

2. **Missing Migration Functions:**
   - No admin-controlled migration capabilities
   - No way to force version upgrades on shared objects

3. **Potential Attack Vectors:**
   - Older package versions could bypass new security constraints
   - Data integrity compromised by version mixing

**Recommended Fixes:**
```move
const CURRENT_VERSION: u8 = 1;

public entry fun update_data(storage: &mut StorageItem, data: String, ...) {
    assert!(storage.version == CURRENT_VERSION, EIncompatibleVersion);
    // ... rest of function
}

entry fun migrate_storage(storage: &mut StorageItem, admin_cap: &AdminCap) {
    assert!(admin_cap.creator == storage.creator, ENotAuthorized);
    storage.version = CURRENT_VERSION;
}
```

---

## 🎨 NFT Contract Analysis

### 9. NFT Implementation Review

**Contract Location:** `nft/packages/nft-connector-iota/src/contracts/nft/sources/nft.move`

**🚨 Critical Findings - No Versioning Mechanism:**

**Current NFT Structure:**
```move
struct NFT has key, store {
    id: UID,
    immutable_metadata: String,
    tag: String,
    metadata: String,      // Mutable metadata
    issuer: address,
    issuerIdentity: String,
    ownerIdentity: String
}
```

### 10. NFT Versioning Vulnerabilities

**⚠️ High-Risk Issues Identified:**

1. **No Version Control:**
   - NFT struct lacks version field entirely
   - No protection against old package interactions
   - Metadata corruption risk from deprecated functions

2. **Function Exposure:**
   - `update_metadata()` is public entry function
   - `transfer_with_metadata()` allows metadata changes during transfer
   - Old versions could apply outdated business logic

3. **Missing Access Controls:**
   - No admin capabilities for mass migration
   - No way to disable old package versions

**Example Attack Scenario:**
```move
// Version 1: Simple metadata update
public entry fun update_metadata(nft: &mut NFT, new_metadata: String) {
    nft.metadata = new_metadata;
}

// Version 2: Validates metadata format
public entry fun update_metadata(nft: &mut NFT, new_metadata: String) {
    assert!(validate_json_format(&new_metadata), EInvalidMetadata);
    nft.metadata = new_metadata;
}
```

**Problem:** Users could bypass Version 2 validation by calling Version 1's function.

### 11. NFT Contract Versioning Recommendations

**🛡️ Immediate Security Improvements:**

```move
struct NFT has key, store {
    id: UID,
    contract_version: u8,         // ADD: Version control
    immutable_metadata: String,
    tag: String,
    metadata: String,
    issuer: address,
    issuerIdentity: String,
    ownerIdentity: String
}

const CURRENT_VERSION: u8 = 1;

public entry fun update_metadata(nft: &mut NFT, new_metadata: String) {
    assert!(nft.contract_version == CURRENT_VERSION, EIncompatibleVersion);
    // Validation logic for current version
    assert!(validate_metadata_format(&new_metadata), EInvalidMetadata);
    nft.metadata = new_metadata;
}

// Migration function for issuer
entry fun migrate_nft(nft: &mut NFT, issuer_cap: &IssuerCap) {
    assert!(nft.issuer == object::id(issuer_cap), ENotAuthorized);
    nft.contract_version = CURRENT_VERSION;
}
```

**🔄 Version Migration Strategy:**
```move
struct IssuerCap has key, store {
    id: UID,
    issuer: address,
}

// Created during mint for issuer control
public entry fun mint(...) {
    let issuer_cap = IssuerCap {
        id: object::new(ctx),
        issuer: issuer,
    };
    transfer::transfer(issuer_cap, issuer);
    
    let nft = NFT {
        contract_version: CURRENT_VERSION,
        // ... other fields
    };
}
```

---

## 📊 Risk Assessment Summary

### 12. Impact Analysis

| Contract | Version Control | Risk Level | Impact |
|----------|----------------|------------|---------|
| **Verifiable Storage** | ⚠️ Partial (unused version field) | **HIGH** | Data corruption, security bypass |
| **NFT** | ❌ None | **CRITICAL** | Metadata corruption, access control bypass |

### 13. Recommended Action Items

**Immediate (Critical):**
1. ✅ **Verifiable Storage:** Implement version checking in all functions
2. ❌ **NFT Contract:** Add version field and validation logic
3. 🔄 **Both:** Implement admin migration capabilities

**Short-term (Important):**
1. 📝 Create version upgrade procedures
2. 🧪 Test upgrade scenarios thoroughly
3. 📚 Document version compatibility matrix

**Long-term (Strategic):**
1. 🏗️ Consider making packages immutable for production
2. 🔍 Implement automated version monitoring
3. 🛡️ Establish security audit requirements for upgrades

---

## 🎯 Conclusion

The investigation confirms that version number management in Move.toml is indeed key to proper smart contract update procedures, but primarily for developer tooling. The real version control happens through:

1. **Package IDs** for deployment versioning
2. **Shared object version fields** for runtime protection  
3. **Admin capabilities** for controlled migrations

**Critical Finding:** Both verifiable storage and NFT contracts are vulnerable to version-mixing attacks where old package versions can interact with newer shared objects, potentially bypassing security constraints and corrupting data integrity.

**Verification of User Concern:** The smart contract versioning concern about maintaining backward compatibility when updating contracts with new deployment IDs is **completely valid** and requires immediate attention in both contract implementations. 