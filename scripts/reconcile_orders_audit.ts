import fs from 'fs';
import path from 'path';

export interface OrderReconciliationStats {
  storeId: string;
  storeName: string;
  sourceA_Count: number; // stores_data embedded
  sourceB_Count: number; // orders collection
  uniqueA_Count: number;
  uniqueB_Count: number;
  commonCount: number;
  onlyInA_Count: number;
  onlyInB_Count: number;
  conflictCount: number;
  unionTotalCount: number;
  conflicts: Array<{
    id: string;
    differences: Record<string, { inA: any; inB: any }>;
  }>;
  onlyInA_Sample: string[];
  onlyInB_Sample: string[];
}

export function auditAndReconcileOrdersData(backupData: any): {
  perStore: Record<string, OrderReconciliationStats>;
  grandTotal: {
    uniqueA_Total: number;
    uniqueB_Total: number;
    commonTotal: number;
    onlyInA_Total: number;
    onlyInB_Total: number;
    conflictsTotal: number;
    unionGrandTotal: number;
  };
} {
  const storesData = backupData.stores_data || {};
  const ordersCollection = backupData.orders || {};

  const perStore: Record<string, OrderReconciliationStats> = {};
  const allUniqueA_Global = new Set<string>();
  const allUniqueB_Global = new Set<string>();
  const allUnion_Global = new Set<string>();
  let totalConflicts = 0;

  for (const [storeId, storeObj] of Object.entries<any>(storesData)) {
    const storeName = storeObj.name || storeObj.settings?.storeName || storeId;
    const embeddedOrders: any[] = Array.isArray(storeObj.orders) ? storeObj.orders : [];

    // Map source A orders by normalized ID
    const mapA = new Map<string, any>();
    for (const o of embeddedOrders) {
      if (!o) continue;
      const rawId = String(o.id || o.orderNumber || '').trim();
      if (rawId) {
        mapA.set(rawId, o);
        allUniqueA_Global.add(`${storeId}:::${rawId}`);
      }
    }

    // Match top-level orders collection docs belonging to this store
    const mapB = new Map<string, any>();
    for (const [docId, docData] of Object.entries<any>(ordersCollection)) {
      if (!docData) continue;
      const belongs =
        docData.storeId === storeId ||
        docData.store_id === storeId ||
        docId.startsWith(`${storeId}_`);
      if (belongs) {
        let normalizedId = String(docData.id || docId).trim();
        if (normalizedId.startsWith(`${storeId}_`)) {
          normalizedId = normalizedId.slice(storeId.length + 1);
        }
        mapB.set(normalizedId, docData);
        allUniqueB_Global.add(`${storeId}:::${normalizedId}`);
      }
    }

    const uniqueA_Ids = Array.from(mapA.keys());
    const uniqueB_Ids = Array.from(mapB.keys());

    const commonIds: string[] = [];
    const onlyInA_Ids: string[] = [];
    const onlyInB_Ids: string[] = [];
    const conflicts: Array<{ id: string; differences: Record<string, { inA: any; inB: any }> }> = [];

    const unionKeys = new Set<string>([...uniqueA_Ids, ...uniqueB_Ids]);

    for (const id of unionKeys) {
      allUnion_Global.add(`${storeId}:::${id}`);
      const inA = mapA.get(id);
      const inB = mapB.get(id);

      if (inA && inB) {
        commonIds.push(id);
        const diffs: Record<string, { inA: any; inB: any }> = {};
        
        // Compare essential business fields: status, totalPrice, paymentStatus
        const statusA = inA.status;
        const statusB = inB.status;
        if (statusA && statusB && statusA !== statusB) {
          diffs.status = { inA: statusA, inB: statusB };
        }

        const priceA = Number(inA.totalPrice ?? inA.totalAmount ?? 0);
        const priceB = Number(inB.totalPrice ?? inB.totalAmount ?? 0);
        if (Math.abs(priceA - priceB) > 0.01) {
          diffs.totalPrice = { inA: priceA, inB: priceB };
        }

        const payA = inA.paymentStatus;
        const payB = inB.paymentStatus;
        if (payA && payB && payA !== payB) {
          diffs.paymentStatus = { inA: payA, inB: payB };
        }

        if (Object.keys(diffs).length > 0) {
          conflicts.push({ id, differences: diffs });
        }
      } else if (inA && !inB) {
        onlyInA_Ids.push(id);
      } else if (!inA && inB) {
        onlyInB_Ids.push(id);
      }
    }

    totalConflicts += conflicts.length;

    perStore[storeId] = {
      storeId,
      storeName,
      sourceA_Count: embeddedOrders.length,
      sourceB_Count: mapB.size,
      uniqueA_Count: uniqueA_Ids.length,
      uniqueB_Count: uniqueB_Ids.length,
      commonCount: commonIds.length,
      onlyInA_Count: onlyInA_Ids.length,
      onlyInB_Count: onlyInB_Ids.length,
      conflictCount: conflicts.length,
      unionTotalCount: unionKeys.size,
      conflicts,
      onlyInA_Sample: onlyInA_Ids.slice(0, 5),
      onlyInB_Sample: onlyInB_Ids.slice(0, 5)
    };
  }

  // Calculate Common and Disjoint at Global Level
  let globalCommon = 0;
  let globalOnlyInA = 0;
  let globalOnlyInB = 0;

  for (const item of allUnion_Global) {
    const inA = allUniqueA_Global.has(item);
    const inB = allUniqueB_Global.has(item);
    if (inA && inB) globalCommon++;
    else if (inA) globalOnlyInA++;
    else if (inB) globalOnlyInB++;
  }

  return {
    perStore,
    grandTotal: {
      uniqueA_Total: allUniqueA_Global.size,
      uniqueB_Total: allUniqueB_Global.size,
      commonTotal: globalCommon,
      onlyInA_Total: globalOnlyInA,
      onlyInB_Total: globalOnlyInB,
      conflictsTotal: totalConflicts,
      unionGrandTotal: allUnion_Global.size
    }
  };
}

// Execution block when run as CLI
if (process.argv[1]?.endsWith('reconcile_orders_audit.ts')) {
  const backupFile = path.resolve('./data/backups/full_firestore_backup_latest.json');
  if (!fs.existsSync(backupFile)) {
    console.error('Backup file not found:', backupFile);
    process.exit(1);
  }
  const raw = fs.readFileSync(backupFile, 'utf8');
  const backup = JSON.parse(raw);
  const result = auditAndReconcileOrdersData(backup);

  console.log('========================================================================');
  console.log('تقرير مطابقة أعداد الطلبات بين المصادر (Order Sources Reconciliation)');
  console.log('المصدر (أ): stores_data/{storeId}.orders (الطلبات المدمجة في وثيقة المتجر)');
  console.log('المصدر (ب): orders/{orderId} (مجموعة الطلبات العامة المنفصلة في Firestore)');
  console.log('========================================================================\n');

  for (const [storeId, s] of Object.entries(result.perStore)) {
    if (s.sourceA_Count === 0 && s.sourceB_Count === 0) continue;
    console.log(`📌 متجر: [${storeId}] - ${s.storeName}`);
    console.log(`  - المصدر (أ) الطلبات المدمجة: ${s.uniqueA_Count} معرف فريد`);
    console.log(`  - المصدر (ب) مجموعة الطلبات:   ${s.uniqueB_Count} معرف فريد`);
    console.log(`  - المشترك بين المصدرين:       ${s.commonCount}`);
    console.log(`  - موجود في (أ) فقط:           ${s.onlyInA_Count}`);
    console.log(`  - موجود في (ب) فقط:           ${s.onlyInB_Count}`);
    console.log(`  - التعارضات بين المشتركين:    ${s.conflictCount}`);
    console.log(`  - إجمالي الاتحاد (بدون تكرار): ${s.unionTotalCount}`);
    if (s.conflicts.length > 0) {
      console.log(`    ⚠️ تفاصيل التعارضات:`, JSON.stringify(s.conflicts, null, 2));
    }
    console.log('------------------------------------------------------------------------');
  }

  console.log('\n📊 الإجمالي الكلي عبر كافة المتاجر:');
  console.log(`  - إجمالي المعرفات الفريدة في المصدر (أ): ${result.grandTotal.uniqueA_Total}`);
  console.log(`  - إجمالي المعرفات الفريدة في المصدر (ب): ${result.grandTotal.uniqueB_Total}`);
  console.log(`  - إجمالي المشترك بين المصدرين:         ${result.grandTotal.commonTotal}`);
  console.log(`  - إجمالي الموجود في المصدر (أ) فقط:    ${result.grandTotal.onlyInA_Total}`);
  console.log(`  - إجمالي الموجود في المصدر (ب) فقط:    ${result.grandTotal.onlyInB_Total}`);
  console.log(`  - إجمالي حالات التعارض (Conflicts):     ${result.grandTotal.conflictsTotal}`);
  console.log(`  - العدد الإجمالي النهائي للاتحاد (A ∪ B): ${result.grandTotal.unionGrandTotal}`);
  console.log('\n🔒 تأكيد أمان البيانات: لم يتم تنفيذ أي دمج تلقائي أو تعديل على البيانات الأصلية.');
}
