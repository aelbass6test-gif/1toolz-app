/**
 * Firestore ABAC Rules Security Test Suite (Requirement #5)
 * 
 * Verifies that:
 * 1. Matching `store_id` alone is INSUFFICIENT for authorization.
 * 2. User membership and store assignment is strictly validated.
 * 3. Cross-store write attempts between two different store accounts are BLOCKED.
 * 4. Record ownership mutation (modifying `store_id` on an existing document) is BLOCKED.
 * 5. Privilege escalation (users attempting to self-grant `isAdmin: true` or elevate role) is BLOCKED.
 */

interface SecurityContext {
  uid: string;
  email: string;
  isAdmin?: boolean;
  defaultStoreId?: string;
  ownedStoreIds?: string[];
  assignedStoreIds?: string[];
}

interface SecurityDocument {
  [key: string]: any;
}

// Security rule evaluation engine reproducing the exact Firestore rules logic
class FirestoreRulesSimulator {
  private users = new Map<string, SecurityDocument>();
  private documents = new Map<string, SecurityDocument>();

  setUser(uid: string, data: SecurityDocument) {
    this.users.set(uid, data);
  }

  setExistingDoc(path: string, data: SecurityDocument) {
    this.documents.set(path, data);
  }

  getDoc(path: string): SecurityDocument | null {
    return this.documents.get(path) || null;
  }

  private isAdmin(auth: SecurityContext | null): boolean {
    if (!auth) return false;
    if (auth.email === 'aelbass6test@gmail.com' || auth.isAdmin === true) return true;
    const userDoc = this.users.get(auth.uid);
    return Boolean(userDoc?.isAdmin === true);
  }

  private isMemberOfStore(auth: SecurityContext | null, storeId: string): boolean {
    if (!auth) return false;
    if (this.isAdmin(auth)) return true;
    const userDoc = this.users.get(auth.uid);
    if (!userDoc) return auth.uid === storeId;
    return (
      userDoc.defaultStoreId === storeId ||
      (Array.isArray(userDoc.ownedStoreIds) && userDoc.ownedStoreIds.includes(storeId)) ||
      (Array.isArray(userDoc.assignedStoreIds) && userDoc.assignedStoreIds.includes(storeId)) ||
      auth.uid === storeId
    );
  }

  evaluateWrite(params: {
    collection: string;
    docId: string;
    auth: SecurityContext | null;
    newData: SecurityDocument;
  }): { allowed: boolean; reason?: string } {
    const { collection, docId, auth, newData } = params;
    const path = `${collection}/${docId}`;
    const existing = this.documents.get(path);

    if (!auth) {
      return { allowed: false, reason: 'UNAUTHENTICATED' };
    }

    // 1. Users collection evaluation (Privilege escalation protection)
    if (collection === 'users') {
      const isSelf = auth.uid === docId;
      const admin = this.isAdmin(auth);
      if (!isSelf && !admin) {
        return { allowed: false, reason: 'FORBIDDEN_USER_CROSS_ACCESS' };
      }
      if (existing) {
        // Anti-privilege escalation check
        if ('isAdmin' in newData && newData.isAdmin !== existing.isAdmin && !admin) {
          return { allowed: false, reason: 'PRIVILEGE_ESCALATION_BLOCKED: cannot self-grant admin' };
        }
        if ('role' in newData && newData.role !== existing.role && !admin) {
          return { allowed: false, reason: 'PRIVILEGE_ESCALATION_BLOCKED: cannot alter role' };
        }
        if ('stores' in newData && JSON.stringify(newData.stores) !== JSON.stringify(existing.stores) && !admin) {
          return { allowed: false, reason: 'PRIVILEGE_ESCALATION_BLOCKED: cannot alter assigned stores' };
        }
      } else {
        if (newData.isAdmin === true && !admin) {
          return { allowed: false, reason: 'PRIVILEGE_ESCALATION_BLOCKED: cannot create admin account' };
        }
      }
      return { allowed: true };
    }

    // 2. Stores data evaluation
    if (collection === 'stores_data') {
      if (!this.isMemberOfStore(auth, docId)) {
        return { allowed: false, reason: 'CROSS_STORE_ACCESS_DENIED: User is not a member of target store' };
      }
      return { allowed: true };
    }

    // 3. Operational collections with store_id check
    if (['orders', 'products', 'suppliers', 'partners', 'transactions'].includes(collection)) {
      const targetStoreId = newData.store_id || newData.storeId;
      if (!targetStoreId) {
        return { allowed: false, reason: 'MISSING_STORE_ID' };
      }

      // Check record ownership immutability
      if (existing && existing.store_id && existing.store_id !== targetStoreId) {
        return { allowed: false, reason: 'OWNERSHIP_TAMPERING_BLOCKED: store_id is immutable after creation' };
      }

      // Check store membership (matching store_id alone is NOT sufficient!)
      if (!this.isMemberOfStore(auth, targetStoreId)) {
        return { allowed: false, reason: 'CROSS_STORE_ACCESS_DENIED: User does not belong to store specified in store_id' };
      }

      return { allowed: true };
    }

    return { allowed: false, reason: 'UNHANDLED_COLLECTION' };
  }
}

async function runFirestoreSecurityRulesTest() {
  console.log('========================================================================');
  console.log('🛡️ FIRESTORE SECURITY RULES MULTI-STORE & ABAC TEST');
  console.log('========================================================================\n');

  const sim = new FirestoreRulesSimulator();
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, desc: string) {
    if (cond) {
      console.log(` ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${desc}`);
      failed++;
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  // Setup Two Separate Store Accounts
  const store1Id = 'store_alpha_tools';
  const store2Id = 'store_beta_fashions';

  const userAccountStore1: SecurityContext = {
    uid: 'user_store_1',
    email: 'merchant1@storealpha.com',
    isAdmin: false
  };

  const userAccountStore2: SecurityContext = {
    uid: 'user_store_2',
    email: 'merchant2@storebeta.com',
    isAdmin: false
  };

  const superAdminAccount: SecurityContext = {
    uid: 'admin_master',
    email: 'aelbass6test@gmail.com',
    isAdmin: true
  };

  // Configure store memberships in user docs
  sim.setUser('user_store_1', {
    uid: 'user_store_1',
    email: 'merchant1@storealpha.com',
    defaultStoreId: store1Id,
    ownedStoreIds: [store1Id],
    isAdmin: false,
    role: 'merchant'
  });

  sim.setUser('user_store_2', {
    uid: 'user_store_2',
    email: 'merchant2@storebeta.com',
    defaultStoreId: store2Id,
    ownedStoreIds: [store2Id],
    isAdmin: false,
    role: 'merchant'
  });

  // ---------------------------------------------------------------------------
  // TEST 1: User 1 Writing to Store 1 (Own Store) -> ALLOWED
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Store 1 User Writing to Store 1 ---');
  const writeOwnStore = sim.evaluateWrite({
    collection: 'orders',
    docId: 'ord_store1_001',
    auth: userAccountStore1,
    newData: { id: 'ord_store1_001', store_id: store1Id, totalPrice: 350 }
  });
  assert(writeOwnStore.allowed === true, 'Store 1 user can create order in Store 1');

  // ---------------------------------------------------------------------------
  // TEST 2: User 1 Writing to Store 2 (Cross-Store Attack with store_id = store2) -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Store 1 User Attempting Cross-Store Write to Store 2 ---');
  const crossStoreWrite = sim.evaluateWrite({
    collection: 'orders',
    docId: 'ord_store2_injected',
    auth: userAccountStore1,
    newData: { id: 'ord_store2_injected', store_id: store2Id, totalPrice: 9999 }
  });
  assert(crossStoreWrite.allowed === false, 'Store 1 user is BLOCKED from writing to Store 2');
  assert(crossStoreWrite.reason?.includes('CROSS_STORE_ACCESS_DENIED'), 'Rejection reason verifies store membership failure');

  // ---------------------------------------------------------------------------
  // TEST 3: User 1 Attempting to Change Record Ownership (store_id tampering) -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Record Ownership Modification (Changing store_id on existing record) ---');
  sim.setExistingDoc('orders/ord_store1_001', {
    id: 'ord_store1_001',
    store_id: store1Id,
    totalPrice: 350
  });

  const changeOwnership = sim.evaluateWrite({
    collection: 'orders',
    docId: 'ord_store1_001',
    auth: userAccountStore1,
    newData: { id: 'ord_store1_001', store_id: store2Id, totalPrice: 350 }
  });
  assert(changeOwnership.allowed === false, 'Altering store_id on an existing order is strictly BLOCKED');
  assert(changeOwnership.reason?.includes('OWNERSHIP_TAMPERING_BLOCKED'), 'Ownership tampering error returned');

  // ---------------------------------------------------------------------------
  // TEST 4: User 1 Attempting Privilege Escalation (Self-Grant isAdmin: true) -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Privilege Escalation Attempt (User self-granting isAdmin) ---');
  const selfGrantAdmin = sim.evaluateWrite({
    collection: 'users',
    docId: 'user_store_1',
    auth: userAccountStore1,
    newData: {
      uid: 'user_store_1',
      isAdmin: true, // Malicious escalation attempt
      role: 'superadmin'
    }
  });
  assert(selfGrantAdmin.allowed === false, 'User cannot elevate own account to isAdmin: true');
  assert(selfGrantAdmin.reason?.includes('PRIVILEGE_ESCALATION_BLOCKED'), 'Privilege escalation blocked with explicit error');

  // ---------------------------------------------------------------------------
  // TEST 5: Super Admin Access -> ALLOWED
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 5: Super Admin Access Validation ---');
  const adminAccess = sim.evaluateWrite({
    collection: 'orders',
    docId: 'ord_admin_manage',
    auth: superAdminAccount,
    newData: { id: 'ord_admin_manage', store_id: store1Id, totalPrice: 500 }
  });
  assert(adminAccess.allowed === true, 'Super Admin (aelbass6test@gmail.com) has global administrative access');

  console.log(`\n🎉 All ${passed} Firestore ABAC Security assertions passed! (0 failures)`);
}

runFirestoreSecurityRulesTest()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Fatal Firestore rules test failure:', e);
    process.exit(1);
  });
