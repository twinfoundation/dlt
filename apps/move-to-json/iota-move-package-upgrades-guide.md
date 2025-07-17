# IOTA Move Package Upgrades: A Simple Guide to Versioning and Smart Contract Updates

## Table of Contents
1. [What Are Smart Contracts and Packages?](#what-are-smart-contracts-and-packages)
2. [The Challenge: How Do You Update Something Immutable?](#the-challenge-how-do-you-update-something-immutable)
3. [IOTA's Solution: Package Upgrades](#iotas-solution-package-upgrades)
4. [Understanding Versioning](#understanding-versioning)
5. [Module Initializers: One-Time Setup](#module-initializers-one-time-setup)
6. [Automated Address Management](#automated-address-management)
7. [Working with Shared Objects Across Versions](#working-with-shared-objects-across-versions)
8. [Practical Examples](#practical-examples)
9. [Best Practices and Common Pitfalls](#best-practices-and-common-pitfalls)
10. [Summary](#summary)

---

## What Are Smart Contracts and Packages?

Think of smart contracts like apps on your phone, but instead of running on your device, they run on a blockchain. In IOTA, these "apps" are organized into **packages**.

### What's a Package?
- A **package** is like a folder containing related smart contract code
- Each package gets a unique ID (like `0x537d7c04ddd8f7611de17910909c99c610227f9949126e684ba4a7b6eb55e3e1`)
- Inside packages are **modules** - think of these as individual files with specific functions
- When you publish a package, it becomes **immutable** (unchangeable)

### Why Immutable?
Immutability is crucial for security and trust:
- Once deployed, no one can secretly change the code
- Users know exactly what the smart contract will do
- It prevents malicious modifications
- Transactions can be processed faster since the code is guaranteed not to change

---

## The Challenge: How Do You Update Something Immutable?

Here's the problem every blockchain faces: **How do you fix bugs or add features to something that can't be changed?**

Traditional solutions are problematic:
- **Create a new contract**: Users lose their data and have to migrate manually
- **Make everything mutable**: Security goes out the window
- **Stop supporting updates**: You're stuck with bugs forever

---

## IOTA's Solution: Package Upgrades

IOTA solves this with a clever system that gives you the best of both worlds: **immutable security with upgrade flexibility**.

### How It Works

1. **Original Package**: When you first publish your package, you get:
   - A unique Package ID
   - An **UpgradeCap** (Upgrade Capability) - this is like a special key that proves you can upgrade the package

2. **Creating an Upgrade**: When you want to update:
   - You create a new version of your code
   - Use the UpgradeCap to prove you're authorized to upgrade
   - Publish the new version, which gets its own Package ID

3. **Version Chain**: All versions remain on the blockchain permanently:
   - Version 1: Package ID `0xABC123...`
   - Version 2: Package ID `0xDEF456...` 
   - Version 3: Package ID `0x789GHI...`

### Key Benefits
- **Backward Compatibility**: Old versions still work
- **Security**: Each version is still immutable
- **User Choice**: Applications can choose which version to use
- **Data Preservation**: User data isn't lost during upgrades

---

## Understanding Versioning

### Two Types of Versioning in IOTA

#### 1. Package Version (Move.toml)
This is like the version number you see on apps (1.0, 1.1, 2.0, etc.):

```toml
[package]
name = "my_token"
version = "1.2.0"  # This is just for developers to track changes
edition = "2024.beta"
```

**Important**: This version number is **metadata only** - it doesn't affect how the blockchain works. It's just a label to help developers organize their code.

#### 2. Package ID Versioning (The Real Versioning)
This is the actual versioning system that matters on the blockchain:
- Each deployment creates a new Package ID
- Package IDs are the "real" version identifiers
- The blockchain tracks the upgrade chain automatically

### How Compatibility Works

When you upgrade a package, IOTA checks two things:

#### Compatible Changes (✅ Allowed)
- **Adding new functions**
- **Adding new modules**
- **Adding new fields to structs** (in specific ways)
- **Changing private function implementations**

#### Incompatible Changes (❌ Not Allowed)  
- **Removing existing functions**
- **Changing function signatures** (parameters or return types)
- **Removing struct fields**
- **Changing the behavior of public functions in breaking ways**

---

## Module Initializers: One-Time Setup

### What's an `init` Function?

Every Move module can have a special function called `init` that runs **exactly once** when the package is first published:

```move
module my_package::my_module {
    // This function runs only when the package is first deployed
    fun init(ctx: &mut TxContext) {
        // Create initial objects
        // Set up permissions
        // Initialize state
    }
}
```

### Key Rules for `init` Functions

1. **Runs Only Once**: When you upgrade a package, the new `init` functions are **ignored**
2. **Automatic Execution**: You don't call `init` manually - it happens during publishing
3. **Setup Only**: Use it for initial setup, not ongoing operations

### Example: Token Creation
```move
fun init(witness: MY_TOKEN, ctx: &mut TxContext) {
    let (treasury, metadata) = coin::create_currency(
        witness,
        9,  // decimals
        b"MTK",  // symbol
        b"My Token",  // name
        b"A sample token",  // description
        option::none(),  // icon URL
        ctx
    );
    
    // Transfer ownership to the publisher
    transfer::public_transfer(treasury, tx_context::sender(ctx));
    transfer::public_freeze_object(metadata);
}
```

### What Happens During Upgrades?

- **Version 1**: `init` runs, creates initial objects
- **Version 2**: New `init` functions are ignored - the module is already "initialized"
- **Migration**: If you need to update shared objects, you need special migration functions

---

## Automated Address Management

### The Problem with Manual Address Management

In the old days, developers had to manually:
1. Deploy a package and get a Package ID
2. Copy that Package ID 
3. Manually update their `Move.toml` file
4. Repeat for every deployment

This was error-prone and tedious.

### IOTA's Automated Solution

IOTA now handles address management automatically through the **Move.lock** file:

#### Move.toml Setup
```toml
[addresses]
my_package = "0x0"  # Use 0x0 for new packages
```

#### What Happens Automatically
1. **First Deployment**: 
   - You set `my_package = "0x0"`
   - IOTA assigns a real Package ID
   - Creates/updates `Move.lock` with the actual address

2. **Subsequent Builds**:
   - IOTA reads the real address from `Move.lock`
   - Uses that for compilation and verification

3. **Upgrades**:
   - Change `my_package = "0x0"` (signals you want a new version)
   - IOTA creates new Package ID
   - Updates `Move.lock` automatically
   - After upgrade, change back to original Package ID

### Move.lock File
This file is automatically generated and contains the real addresses:
```json
{
  "addresses": {
    "my_package": "0x537d7c04ddd8f7611de17910909c99c610227f9949126e684ba4a7b6eb55e3e1"
  }
}
```

**Important**: Don't edit `Move.lock` manually - let IOTA manage it.

---

## Working with Shared Objects Across Versions

### The Shared Object Challenge

Shared objects are blockchain objects that multiple users can interact with (like a public scoreboard or shared vault). The challenge: **old package versions can still interact with shared objects created by new versions**.

### Example Problem
```move
// Version 1
public struct Counter has key {
    id: UID,
    value: u64,
}

public fun increment(counter: &mut Counter) {
    counter.value = counter.value + 1;
}
```

```move
// Version 2 - Added event logging
public fun increment(counter: &mut Counter) {
    counter.value = counter.value + 1;
    event::emit(IncrementEvent { new_value: counter.value });
}
```

**Problem**: Version 1's `increment` function can still be called, but it won't emit the event, causing inconsistent behavior.

### Solution: Version-Aware Shared Objects

Add version checking to your shared objects:

```move
module example::counter {
    const VERSION: u64 = 2;  // Current version
    
    public struct Counter has key {
        id: UID,
        version: u64,  // Object's version
        admin: ID,     // Admin capability ID
        value: u64,
    }
    
    public struct AdminCap has key {
        id: UID,
    }
    
    // All functions check version compatibility
    public fun increment(counter: &mut Counter) {
        assert!(counter.version == VERSION, EVersionMismatch);
        counter.value = counter.value + 1;
        event::emit(IncrementEvent { new_value: counter.value });
    }
    
    // Migration function (only admin can call)
    public fun migrate(
        counter: &mut Counter, 
        admin: &AdminCap,
        ctx: &TxContext
    ) {
        assert!(counter.admin == object::id(admin), ENotAuthorized);
        counter.version = VERSION;
        // Perform any necessary data migration
    }
}
```

### Migration Pattern
1. **Deploy Upgrade**: New package version with updated VERSION constant
2. **Migrate Objects**: Admin calls migration functions to update shared objects
3. **Enforce Version**: All functions check version before executing

---

## Practical Examples

### Example 1: Simple Token Upgrade

#### Step 1: Initial Deployment
```toml
# Move.toml
[package]
name = "my_token"
version = "1.0.0"

[addresses]
my_token = "0x0"  # New package
```

```bash
iota client publish
# Output: Package ID 0xABC123...
# UpgradeCap ID 0xDEF456...
```

#### Step 2: Preparing an Upgrade
```toml
# Move.toml - Updated version for reference
[package]
name = "my_token"
version = "1.1.0"  # Updated for tracking

[addresses]
my_token = "0x0"  # Set to 0x0 for upgrade
```

#### Step 3: Executing the Upgrade
```bash
iota client upgrade --upgrade-capability 0xDEF456...
# Output: New Package ID 0x789GHI...
```

#### Step 4: Update Configuration
```toml
# Move.toml - Point back to original for dependencies
[addresses]
my_token = "0xABC123..."  # Original Package ID
```

### Example 2: Handling Breaking Changes

Sometimes you need to make incompatible changes. Here's how:

#### Option 1: New Type Pattern
```move
// Version 1
public struct TokenV1 has key {
    id: UID,
    balance: u64,
}

// Version 2 - Need to add decimal support
public struct TokenV2 has key {
    id: UID,
    balance: u64,
    decimals: u8,
}

// Migration function
public fun migrate_v1_to_v2(old_token: TokenV1): TokenV2 {
    let TokenV1 { id, balance } = old_token;
    TokenV2 {
        id,
        balance,
        decimals: 9,  // Default decimals
    }
}
```

#### Option 2: Flag-Based Migration
```move
public struct Token has key {
    id: UID,
    balance: u64,
    decimals: Option<u8>,  // None = v1, Some = v2
    is_migrated: bool,
}

public fun ensure_migrated(token: &mut Token) {
    if (!token.is_migrated) {
        token.decimals = option::some(9);
        token.is_migrated = true;
    }
}
```

---

## Best Practices and Common Pitfalls

### ✅ Best Practices

1. **Plan for Upgrades Early**
   - Design shared objects with version fields from the start
   - Include admin capabilities for migrations
   - Use consistent version checking patterns

2. **Use Semantic Versioning**
   - Follow semver in Move.toml (1.0.0 → 1.0.1 → 1.1.0 → 2.0.0)
   - Match major version bumps with breaking changes

3. **Test Compatibility**
   - Test that old versions still work after upgrades
   - Verify migration functions work correctly
   - Check that dependent packages still function

4. **Document Changes**
   - Keep a changelog of what changed between versions
   - Document migration procedures for users
   - Explain compatibility implications

### ❌ Common Pitfalls

1. **Forgetting Version Checks**
   ```move
   // BAD: No version checking
   public fun transfer(token: &mut Token, amount: u64) {
       // Old versions can call this unexpectedly
   }
   
   // GOOD: Version checking
   public fun transfer(token: &mut Token, amount: u64) {
       assert!(token.version == CURRENT_VERSION, EVersionMismatch);
       // Safe to proceed
   }
   ```

2. **Not Planning for Migration**
   ```move
   // BAD: No migration capability
   public struct Vault has key {
       id: UID,
       balance: u64,
   }
   
   // GOOD: Migration-ready
   public struct Vault has key {
       id: UID,
       version: u64,
       admin: ID,
       balance: u64,
   }
   ```

3. **Breaking Changes Without New Types**
   ```move
   // BAD: Breaking change
   // Old: public fun withdraw(vault: &mut Vault, amount: u64)
   // New: public fun withdraw(vault: &mut Vault, amount: u64, recipient: address)
   
   // GOOD: Backward compatible
   public fun withdraw(vault: &mut Vault, amount: u64) {
       withdraw_to(vault, amount, tx_context::sender(ctx))
   }
   
   public fun withdraw_to(vault: &mut Vault, amount: u64, recipient: address) {
       // New functionality
   }
   ```

4. **Incorrect Address Management**
   ```toml
   # BAD: Manually managing addresses
   [addresses]
   my_package = "0x537d7c04..."  # Hard-coded
   
   # GOOD: Let IOTA manage automatically
   [addresses]
   my_package = "0x0"  # For new deployments
   ```

---

## Summary

### Key Takeaways

1. **Immutability + Upgradability**: IOTA lets you have secure, immutable smart contracts that can still be upgraded when needed.

2. **Two-Level Versioning**: 
   - **Move.toml version**: Just for developer tracking
   - **Package ID versioning**: The real blockchain versioning

3. **UpgradeCap**: Your key to upgrading packages - keep it safe!

4. **Automated Address Management**: Let IOTA handle Package IDs automatically through Move.lock.

5. **Version-Aware Design**: Build shared objects that can handle multiple package versions gracefully.

6. **Migration Planning**: Always plan for future changes - add version fields and admin capabilities early.

### The Upgrade Process in Simple Steps

1. **Initial Deploy**: Publish package, get Package ID and UpgradeCap
2. **Develop Changes**: Make improvements to your code
3. **Prepare Upgrade**: Set address to "0x0" in Move.toml
4. **Execute Upgrade**: Use UpgradeCap to upgrade
5. **Update Config**: Point Move.toml back to original Package ID
6. **Migrate Data**: Run migration functions if needed

### Why This Matters

Smart contract upgrades are crucial for:
- **Fixing security vulnerabilities**
- **Adding new features**
- **Improving performance**
- **Maintaining competitiveness**
- **Responding to user feedback**

IOTA's upgrade system gives you the flexibility to evolve your applications while maintaining the security and trust that makes blockchain valuable.

---

*This guide covers the essential concepts of IOTA Move package upgrades. For more detailed technical information, refer to the [IOTA Developer Documentation](https://docs.iota.org/developer/iota-101/move-overview/package-upgrades/upgrade).* 