# Smart Contract Versioning & Backward Compatibility Investigation

## Questions for Identity Team

### Background Context
We're working on a deployment tool for IOTA Move smart contracts and need to understand how to properly handle contract updates while maintaining backward compatibility, especially for shared objects and existing data access.

### Key Questions

#### 1. **Contract Update Workflow**
- How do you handle smart contract updates when deploying new versions?
- What is your process for linking new deployments to previous versions?
- Do you use the `--upgrade` flag or similar mechanisms during deployment?

#### 2. **Deployment ID Management**
- When you deploy an updated smart contract (with a new Package ID), how do you ensure:
  - Existing identities created with the old contract still work?
  - New deployments can access data/objects from previous versions?
  - Shared objects remain accessible across different contract versions?

#### 3. **Version Tracking in Move.toml**
- Do you increment the `version` field in `Move.toml` for each update?
- How does this version number relate to deployment backward compatibility?
- Does the version change affect the compiled base64 package data?

#### 4. **Shared Object Access**
- For contracts that create shared objects (like verifiable storage), how do you ensure:
  - New contract versions can still access shared objects created by old versions?
  - There's no loss of access to existing shared state?

#### 5. **NPM Package Strategy**
- When you update smart contracts and get new Package IDs:
  - How do you handle NPM package updates?
  - Do you maintain support for multiple Package IDs in one package?
  - How do you ensure clients using old NPM versions still function?

#### 6. **Breaking vs Non-Breaking Changes**
- How do you distinguish between breaking and non-breaking contract changes?
- What practices do you follow to maintain backward compatibility?
- Are there specific patterns or constraints you follow when updating contracts?

#### 7. **Update Metadata & Linking**
- Do you use specific metadata or on-chain mechanisms to link contract versions?
- Is there an `UpgradeCap` object or similar that maintains continuity?
- How does the IOTA Move runtime know that different Package IDs represent the same logical contract?

### Our Current Challenge
We have a deployment tool that:
1. Compiles Move contracts and generates Package IDs
2. Updates JSON files with deployment information
3. Could potentially rebuild NPM packages with new Package IDs

We need to understand how to implement proper versioning so that when we deploy updates, existing users don't lose functionality and shared objects remain accessible.

### **Critical Issue: Verifiable Storage Impact**

Verifiable Storage presents a **particularly critical case** for smart contract versioning because it creates **shared objects** that must remain accessible across contract updates:

#### **Current Architecture Analysis:**
```move
// Creates shared objects via transfer::share_object(storage)
public entry fun store_data(...) {
    let storage = StorageItem { /* ... */ };
    transfer::share_object(storage);  // ← SHARED OBJECT
}

// Updates shared objects by reference
public entry fun update_data(storage: &mut StorageItem, ...) {
    // Modifies existing shared object
}
```

#### **Version Continuity Requirements:**
1. **Shared Object Access**: Existing `StorageItem` objects must remain accessible after contract updates
2. **Cross-Version Operations**: New contract versions must be able to:
   - Read shared objects created by old versions
   - Update shared objects created by old versions  
   - Maintain allowlist and permission logic
3. **Data Persistence**: Stored data cannot become orphaned due to Package ID changes

#### **Package ID References in Code:**
```typescript
// IOTA Connector uses deployedPackageId for move calls
txb.moveCall({
    target: `${packageId}::${moduleName}::store_data`,  // ← Package ID dependency
    arguments: [/* ... */]
});

// URN generation includes Package ID
const urn = new Urn("verifiable", `${NAMESPACE}:${deployedPackageId}:${objectId}`);
```

#### **Specific Questions for Verifiable Storage:**
- How do you ensure new contract versions can access `StorageItem` shared objects created by old versions?
- Does the `UpgradeCap` mechanism maintain cross-version shared object compatibility?
- How do you handle URN generation and object references across Package ID changes?
- What happens to existing allowlists when contracts are updated?

This is **the most critical use case** for understanding proper versioning, as data loss or access failure would be catastrophic for production systems.

---

## 🔍 **Research Findings & Answers**

Based on comprehensive investigation of IOTA Move documentation, SUI Move specifications (which IOTA is based on), and Move ecosystem patterns, here are the answers to the critical verifiable storage versioning questions:

### **✅ ANSWER 1: Shared Object Cross-Version Access**

**Q: How do you ensure new contract versions can access StorageItem shared objects created by old versions?**

**A: IOTA Move provides automatic shared object compatibility across package versions through object type stability:**

#### **Key Mechanism: Type Identity Preservation**
```move
// Original package (0xABC123::verifiable_storage)
struct StorageItem has key, store {
    id: UID,
    data: String,
    // ... other fields
}

// Upgraded package (0xDEF456::verifiable_storage) 
// SAME struct definition = SAME type identity
struct StorageItem has key, store {
    id: UID,
    data: String,
    // ... can add NEW fields but not modify existing ones
}
```

**Critical Findings:**
- **Shared objects are type-agnostic**: Once created with `transfer::share_object()`, they exist independently of the package that created them
- **Any package can access shared objects** if they have the correct type definition and object reference
- **Layout compatibility is enforced**: Upgraded packages must maintain compatible struct layouts to access existing objects

### **✅ ANSWER 2: UpgradeCap and Cross-Version Compatibility**

**Q: Does the UpgradeCap mechanism maintain cross-version shared object compatibility?**

**A: Yes, but indirectly. UpgradeCap ensures link compatibility, which preserves shared object access:**

#### **How UpgradeCap Works for Shared Objects:**
```move
// UpgradeCap tracks package lineage and enforces compatibility
struct UpgradeCap has key, store {
    package: ID,      // Links to current package version
    version: u64,     // Tracks upgrade count
    policy: u8,       // COMPATIBLE, ADDITIVE, or DEP_ONLY
}
```

**Compatibility Guarantees:**
- **COMPATIBLE**: Can modify function implementations, maintain struct layout compatibility
- **ADDITIVE**: Can only add new functions/types, existing structures unchanged
- **DEP_ONLY**: Only dependency changes allowed

**For Verifiable Storage:**
- Use `ADDITIVE` or `COMPATIBLE` policies to ensure existing `StorageItem` objects remain accessible
- **Link compatibility check** during upgrade ensures old shared objects work with new code

### **✅ ANSWER 3: URN Generation and Package ID References**

**Q: How do you handle URN generation and object references across Package ID changes?**

**A: Implement Package ID abstraction and version-aware URN strategies:**

#### **Recommended Pattern: Self-Address Decoupling**
```typescript
// Instead of hardcoding package ID in URNs
const urn = new Urn("verifiable", `${deployedPackageId}:${objectId}`); // ❌ BRITTLE

// Use self-address (stays constant across upgrades)
const urn = new Urn("verifiable", `${NAMESPACE}:${objectId}`); // ✅ STABLE
```

**IOTA Move Solution:**
- **Package self-address**: Remains constant across upgrades (e.g., `0xVERIFIABLE_STORAGE`)
- **Published-at address**: Changes with each upgrade (actual on-chain location)
- **URNs should reference self-address**, not published-at address

#### **Multi-Version URN Support:**
```typescript
// Support multiple package versions in URN resolution
class VerifiableStorageUtils {
    static resolvePackageId(urn: string): string {
        // Try current package first, fallback to previous versions
        const packageVersions = [currentPackageId, ...previousPackageIds];
        return packageVersions.find(id => objectExistsAtPackage(id, objectId));
    }
}
```

### **✅ ANSWER 4: Allowlist Persistence Across Versions**

**Q: What happens to existing allowlists when contracts are updated?**

**A: Allowlists persist automatically because they're stored in the shared object, not the package:**

```move
struct StorageItem has key, store {
    id: UID,
    data: String,
    allowlist: vector<address>,  // ← Stored in object, not package
    // ...
}

// Upgrade-compatible allowlist access
public entry fun update_data(storage: &mut StorageItem, ...) {
    // allowlist validation works regardless of package version
    assert!(is_inlist(&storage.allowlist, sender), E_UNAUTHORIZED);
}
```

**Key Insights:**
- **Data lives in objects**: Allowlists are stored in `StorageItem` objects, not in package code
- **Function logic upgradeable**: Can improve allowlist validation while preserving existing data
- **No migration needed**: Existing allowlists automatically work with upgraded packages

### **📊 SUMMARY: Verifiable Storage Upgrade Safety**

#### **✅ What Works Automatically:**
1. **Shared object access**: Existing `StorageItem` objects remain accessible
2. **Data persistence**: All stored data (including allowlists) preserved
3. **Cross-version operations**: New packages can read/write old shared objects
4. **Permission logic**: Allowlist validation works across package versions

#### **⚠️ What Requires Careful Planning:**
1. **URN generation**: Must abstract away package IDs for stability
2. **Client library updates**: NPM packages need multi-version support
3. **Function signature changes**: Must maintain compatibility for shared object access
4. **Event structures**: Existing event parsers may break with schema changes

#### **🎯 Recommended Approach for Verifiable Storage:**
1. **Use ADDITIVE upgrade policy** to ensure maximum compatibility
2. **Implement version-aware URN resolution** to handle package ID changes
3. **Maintain struct layout compatibility** for existing shared objects
4. **Add versioning metadata** to new shared objects for future upgrade planning
5. **Test cross-version scenarios** thoroughly before production upgrades

This research confirms that **IOTA Move's upgrade system can safely handle verifiable storage updates** when following proper compatibility patterns, ensuring no data loss or access failures occur during smart contract upgrades.

### Expected Outcome
Understanding your approach will help us implement proper smart contract versioning in our deployment pipeline, ensuring that:
- Contract updates don't break existing functionality
- **Shared objects (especially verifiable storage) remain accessible across versions**
- NPM packages can be updated safely
- The deployment tool handles version continuity correctly
- **No data loss or orphaned shared objects occur during updates** 
