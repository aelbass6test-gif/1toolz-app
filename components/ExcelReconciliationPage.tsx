import React from 'react';
import { useParams } from 'react-router-dom';
import {
  CodSettlementBatch,
  CodSheetAmountMode,
  CodSheetColumnProfile,
  Order,
  OrderItem,
  StoreData,
  TreasuryTransaction
} from '../types';
import CodHunterWorkspace from './CodHunterWorkspace';
import { SheetAuditRow } from '../utils/codReconciliation';
import {
  SheetOrderImportPayload,
  SheetOrderLinkUpdatePayload,
  SheetOrderUpdatePayload
} from './SheetOrderLinkAndImportModal';
import { deleteStoreItem, deleteStoreItems } from '../services/databaseService';

interface ExcelReconciliationPageProps {
  allStoresData: Record<string, StoreData>;
  updateStoreData: (storeId: string, updater: (draft: StoreData) => void) => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
  currentUserName?: string;
}

export default function ExcelReconciliationPage({
  allStoresData,
  updateStoreData,
  showToast,
  currentUserName
}: ExcelReconciliationPageProps) {
  const { storeId } = useParams<{ storeId: string }>();
  const storeData = storeId ? allStoresData[storeId] : null;

  if (!storeId || !storeData || !storeData.settings) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm font-bold">
        جاري تحميل بيانات المتجر...
      </div>
    );
  }

  const storeDisplayName = storeData.settings.storeName || storeData.name || storeId;
  const operator = currentUserName || 'مدير المتجر / المحاسب';

  const handleSaveCarrierProfile = (
    profileKey: string,
    profile: CodSheetColumnProfile,
    graceDays: number
  ) => {
    updateStoreData(storeId, draft => {
      if (!draft.settings.codCarrierColumnProfiles) {
        draft.settings.codCarrierColumnProfiles = {};
      }
      draft.settings.codCarrierColumnProfiles[profileKey] = profile;
      draft.settings.codExpectedPayoutGraceDays = graceDays;
    });
  };

  const handleUpdateGraceDays = (graceDays: number) => {
    updateStoreData(storeId, draft => {
      draft.settings.codExpectedPayoutGraceDays = graceDays;
    });
  };

  const handleSettleBatch = (params: {
    batchNumber: string;
    notes: string;
    treasuryAccountId: string;
    selectedRows: SheetAuditRow[];
    carrierFilter: string;
    fileNames: string[];
    amountMode: CodSheetAmountMode;
    totalSheetRows: number;
    totalSheetNet: number;
    totalExpectedNet: number;
    totalDiscrepancy: number;
  }) => {
    const batchId = `codbatch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const settleByOrderId = new Map<string, SheetAuditRow>();
    params.selectedRows.forEach(row => {
      if (row.matchedOrder) settleByOrderId.set(row.matchedOrder.id, row);
    });
    const settledOrderIds = Array.from(settleByOrderId.keys());
    if (settledOrderIds.length === 0) return;

    let treasuryTxId: string | undefined;

    updateStoreData(storeId, draft => {
      draft.orders = (draft.orders || []).map(order => {
        const row = settleByOrderId.get(order.id);
        if (!row) return order;
        return {
          ...order,
          status: 'تم_التحصيل',
          paymentStatus: 'مدفوع',
          collectionProcessed: true,
          codPayoutBatchId: batchId,
          codPayoutSettledAt: nowIso,
          codPayoutNetReceived: row.sheetNetPayout,
          codPayoutExpectedNet: row.expectation?.expectedNetPayout ?? row.sheetNetPayout,
          codPayoutDiff: row.netVariance,
          codPayoutSheetRef: params.batchNumber
        };
      });

      if (params.treasuryAccountId && params.totalSheetNet > 0 && draft.treasury?.accounts) {
        const accIdx = draft.treasury.accounts.findIndex(a => a.id === params.treasuryAccountId);
        if (accIdx !== -1) {
          treasuryTxId = `tx_cod_${Date.now()}`;
          draft.treasury.accounts[accIdx].balance =
            Math.round((draft.treasury.accounts[accIdx].balance + params.totalSheetNet) * 100) /
            100;

          const tx: TreasuryTransaction = {
            id: treasuryTxId,
            date: nowIso,
            toAccountId: params.treasuryAccountId,
            amount: params.totalSheetNet,
            type: 'deposit',
            description: `إيداع دفعة تحصيل COD رقم ${params.batchNumber} (${settledOrderIds.length} أوردر)`,
            reference: params.batchNumber,
            category: 'collection',
            operatorName: operator,
            reconciliationDiff:
              params.totalDiscrepancy !== 0 ? params.totalDiscrepancy : undefined
          };
          draft.treasury.transactions = [tx, ...(draft.treasury.transactions || [])];
        }
      }

      const batchRecord: CodSettlementBatch = {
        id: batchId,
        batchNumber: params.batchNumber,
        carrierName: params.carrierFilter === 'all' ? 'متعدد / الكل' : params.carrierFilter,
        fileNames: params.fileNames,
        amountMode: params.amountMode,
        createdAt: nowIso,
        createdBy: operator,
        totalRowsInSheets: params.totalSheetRows,
        settledOrderIds,
        totalSheetNetAmount: params.totalSheetNet,
        totalExpectedNetAmount: params.totalExpectedNet,
        totalDiscrepancyAmount: params.totalDiscrepancy,
        treasuryAccountId: params.treasuryAccountId || undefined,
        treasuryTxId,
        notes: params.notes || undefined
      };

      if (!draft.settings.codReconciliationBatches) {
        draft.settings.codReconciliationBatches = [];
      }
      draft.settings.codReconciliationBatches.unshift(batchRecord);

      const logs = draft.settings.activityLogs || [];
      logs.unshift({
        id: `log_cod_${Date.now()}`,
        user: operator,
        action: 'اعتماد دفعة تحصيل COD',
        details: `اعتماد الدفعة ${params.batchNumber}: تحصيل ${settledOrderIds.length} أوردر بإجمالي صافي ${params.totalSheetNet.toLocaleString('en-US')} ج.م`,
        date: nowIso,
        timestamp: Date.now()
      });
      draft.settings.activityLogs = logs.slice(0, 400);
    });
  };

  const handleReverseBatch = (batch: CodSettlementBatch) => {
    const settledSet = new Set(batch.settledOrderIds || []);
    const nowIso = new Date().toISOString();

    updateStoreData(storeId, draft => {
      draft.orders = (draft.orders || []).map(order => {
        if (order.codPayoutBatchId !== batch.id && !settledSet.has(order.id)) return order;
        const reverted = { ...order };
        if (reverted.status === 'تم_التحصيل') {
          reverted.status = 'تم_التوصيل';
        }
        reverted.collectionProcessed = false;
        delete reverted.codPayoutBatchId;
        delete reverted.codPayoutSettledAt;
        delete reverted.codPayoutNetReceived;
        delete reverted.codPayoutExpectedNet;
        delete reverted.codPayoutDiff;
        delete reverted.codPayoutSheetRef;
        return reverted;
      });

      if (batch.treasuryTxId && batch.treasuryAccountId && draft.treasury) {
        const txExists = (draft.treasury.transactions || []).some(t => t.id === batch.treasuryTxId);
        if (txExists) {
          draft.treasury.transactions = draft.treasury.transactions.filter(
            t => t.id !== batch.treasuryTxId
          );
          const accIdx = (draft.treasury.accounts || []).findIndex(
            a => a.id === batch.treasuryAccountId
          );
          if (accIdx !== -1) {
            draft.treasury.accounts[accIdx].balance =
              Math.round(
                (draft.treasury.accounts[accIdx].balance - batch.totalSheetNetAmount) * 100
              ) / 100;
          }
        }
      }

      draft.settings.codReconciliationBatches = (
        draft.settings.codReconciliationBatches || []
      ).filter(b => b.id !== batch.id);

      const logs = draft.settings.activityLogs || [];
      logs.unshift({
        id: `log_cod_rev_${Date.now()}`,
        user: operator,
        action: 'عكس وإلغاء دفعة تحصيل COD',
        details: `إلغاء الدفعة ${batch.batchNumber} واسترجاع ${batch.settledOrderIds.length} أوردر لحالة مسلّم غير محصّل`,
        date: nowIso,
        timestamp: Date.now()
      });
      draft.settings.activityLogs = logs.slice(0, 400);
    });
  };

  const deductItemsFromUnifiedInventory = (
    draft: StoreData,
    items: OrderItem[],
    warehouseId?: string
  ): number => {
    if (!draft.settings.products || items.length === 0) return 0;
    const whId =
      warehouseId ||
      (draft.settings as unknown as { defaultWarehouseId?: string }).defaultWarehouseId ||
      draft.settings.warehouses?.[0]?.id ||
      'wh_main';
    let deductedUnits = 0;

    draft.settings.products = draft.settings.products.map(prod => {
      const matchingItems = items.filter(i => i.productId === prod.id);
      if (matchingItems.length === 0) return prod;

      const updated = { ...prod };
      for (const item of matchingItems) {
        const qty = Math.max(0, Number(item.quantity) || 0);
        if (qty <= 0) continue;
        deductedUnits += qty;

        if (item.variantId && updated.variants?.length) {
          updated.variants = updated.variants.map(v => {
            if (v.id !== item.variantId) return v;
            const nextQty = Math.max(0, (v.stockQuantity ?? v.stock ?? 0) - qty);
            const nextWh = { ...(v.warehouseStock || {}) };
            if (nextWh[whId] !== undefined) {
              nextWh[whId] = Math.max(0, nextWh[whId] - qty);
            }
            return {
              ...v,
              stockQuantity: nextQty,
              stock: typeof v.stock === 'number' ? nextQty : v.stock,
              warehouseStock: nextWh
            };
          });
          const sumVariants = updated.variants.reduce(
            (s, v) => s + (v.stockQuantity ?? v.stock ?? 0),
            0
          );
          updated.stockQuantity = sumVariants;
          if (typeof updated.stock === 'number') updated.stock = sumVariants;
        } else {
          const baseStock = updated.stockQuantity ?? updated.stock ?? 0;
          const nextQty = Math.max(0, baseStock - qty);
          updated.stockQuantity = nextQty;
          if (typeof updated.stock === 'number') updated.stock = nextQty;
          if (updated.warehouseStock && updated.warehouseStock[whId] !== undefined) {
            updated.warehouseStock = {
              ...updated.warehouseStock,
              [whId]: Math.max(0, updated.warehouseStock[whId] - qty)
            };
          }
        }
      }
      return updated;
    });

    return deductedUnits;
  };

  const restoreItemsToUnifiedInventory = (
    draft: StoreData,
    items: OrderItem[],
    warehouseId?: string
  ): number => {
    if (!draft.settings.products || !items.length) return 0;
    const whId =
      warehouseId ||
      (draft.settings as unknown as { defaultWarehouseId?: string }).defaultWarehouseId ||
      draft.settings.warehouses?.find(w => w.isDefault)?.id ||
      draft.settings.warehouses?.[0]?.id ||
      'wh_main';
    let restoredUnits = 0;

    draft.settings.products = draft.settings.products.map(prod => {
      const matchingItems = items.filter(
        it =>
          it.productId === prod.id ||
          (it.variantId && prod.variants?.some(v => v.id === it.variantId))
      );
      if (matchingItems.length === 0) return prod;

      const updated = { ...prod };
      for (const item of matchingItems) {
        const qty = Math.max(0, Number(item.quantity) || 0);
        if (qty <= 0) continue;
        restoredUnits += qty;

        if (item.variantId && updated.variants?.length) {
          updated.variants = updated.variants.map(v => {
            if (v.id !== item.variantId) return v;
            const nextQty = (v.stockQuantity ?? v.stock ?? 0) + qty;
            const nextWh = { ...(v.warehouseStock || {}) };
            if (whId) {
              nextWh[whId] = (nextWh[whId] ?? 0) + qty;
            }
            return {
              ...v,
              stockQuantity: nextQty,
              stock: typeof v.stock === 'number' ? nextQty : v.stock,
              warehouseStock: nextWh
            };
          });
          const sumVariants = updated.variants.reduce(
            (s, v) => s + (v.stockQuantity ?? v.stock ?? 0),
            0
          );
          updated.stockQuantity = sumVariants;
          if (typeof updated.stock === 'number') updated.stock = sumVariants;
        } else {
          const baseStock = updated.stockQuantity ?? updated.stock ?? 0;
          const nextQty = baseStock + qty;
          updated.stockQuantity = nextQty;
          if (typeof updated.stock === 'number') updated.stock = nextQty;
          if (whId) {
            updated.warehouseStock = {
              ...(updated.warehouseStock || {}),
              [whId]: (updated.warehouseStock?.[whId] ?? 0) + qty
            };
          }
        }
      }
      return updated;
    });

    return restoredUnits;
  };

  const handleCreateOrderFromSheet = (payload: SheetOrderImportPayload) => {
    const nowIso = new Date().toISOString();
    const newId = `ord_sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const totalCost = Math.round(
      payload.items.reduce((s, i) => s + (i.cost || 0) * (i.quantity || 1), 0) * 100
    ) / 100;
    const totalWeight =
      payload.items.reduce((s, i) => s + (i.weight || 1) * (i.quantity || 1), 0) || 1;
    const primaryProductName =
      payload.items.map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(' + ') ||
      payload.sheetRow.packageDescription ||
      `شحنة #${payload.sheetRow.trackingKey}`;

    const isStoreCompanyMode = payload.walletShippingSource === 'customer';
    const walletShippingFee = isStoreCompanyMode
      ? Math.round(Math.max(0, Number(payload.customerShippingFee) || 0) * 100) / 100
      : Math.round(
          Math.max(
            0,
            Number(payload.walletShippingFee) > 0
              ? Number(payload.walletShippingFee)
              : Number(payload.actualCarrierFee) > 0
              ? Number(payload.actualCarrierFee)
              : Number(payload.customerShippingFee) || 0
          ) * 100
        ) / 100;
    const safeCodAmount = Math.round(Math.max(0, Number(payload.codAmount) || 0) * 100) / 100;
    const isActiveShipment = payload.status !== 'قيد_التنفيذ';
    const shouldDeductShipping = walletShippingFee > 0 && isActiveShipment;
    const shouldDepositCollection =
      safeCodAmount > 0 && (payload.status === 'تم_التحصيل' || payload.collectionProcessed);

    const safeInsFee = isStoreCompanyMode ? Math.round(Math.max(0, Number(payload.insuranceFee) || 0) * 100) / 100 : 0;
    const safeVatVal = isStoreCompanyMode ? Math.round(Math.max(0, Number(payload.vatValue) || 0) * 100) / 100 : 0;
    const safeInspFee = isStoreCompanyMode ? Math.round(Math.max(0, Number(payload.inspectionFee) || 0) * 100) / 100 : 0;
    const safeCodFee = isStoreCompanyMode ? Math.round(Math.max(0, Number(payload.codFee) || 0) * 100) / 100 : 0;
    const safeReturnFee = isStoreCompanyMode ? Math.round(Math.max(0, Number(payload.returnShippingFee) || 0) * 100) / 100 : 0;
    const anyStoreFeeDeducted =
      isActiveShipment &&
      (walletShippingFee > 0 || safeInsFee > 0 || safeVatVal > 0 || safeInspFee > 0 || safeReturnFee > 0);

    const newOrder: Order = {
      id: newId,
      createdAt: nowIso,
      updatedAt: nowIso,
      store_id: storeId,
      source: 'synced',
      platform: 'bosta_sheet_import',
      sheetFeeBillingMode: isStoreCompanyMode ? 'store_company_fees' : 'carrier_all_inclusive',
      orderNumber: payload.orderNumber,
      referenceNumber: payload.sheetRow.businessRefKey || payload.sheetRow.trackingKey,
      waybillNumber: payload.sheetRow.trackingKey,
      bostaTrackingNumber: payload.sheetRow.trackingKey,
      date: payload.sheetRow.sheetDeliveredAt || payload.sheetRow.sheetDate || nowIso.slice(0, 10),
      shippingCompany: 'بوسطة',
      shippingArea: payload.city || 'غير محدد',
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerAddress: payload.customerAddress,
      city: payload.city,
      governorate: payload.city,
      merchantBrandName: payload.brandName,
      storeName: storeDisplayName,
      items: payload.items,
      shippingFee: payload.customerShippingFee,
      isManualShippingOverride: true,
      status: payload.status,
      paymentStatus: payload.paymentStatus,
      paymentMethod: safeCodAmount === 0 ? 'مدفوع مسبقاً (تحصيل 0)' : 'COD',
      productName: primaryProductName,
      productPrice: payload.productPrice,
      productCost: totalCost,
      totalPrice: safeCodAmount,
      totalAmountOverride: safeCodAmount,
      totalAmountOverrideReason:
        safeCodAmount === 0
          ? 'تحصيل 0 من شيت بوسطة (خصم الشحن فقط من المحفظة)'
          : 'مبلغ التحصيل الفعلي من شيت بوسطة',
      includeInspectionFee: isStoreCompanyMode ? payload.includeInspectionFee : false,
      inspectionFee: safeInspFee,
      inspectionFeeDeducted: isStoreCompanyMode && safeInspFee > 0 && isActiveShipment,
      inspectionFeePaidByCustomer: false,
      isInsured: isStoreCompanyMode ? payload.isInsured : false,
      insuranceFee: safeInsFee,
      vatValue: safeVatVal,
      shippingVatRate: isStoreCompanyMode ? payload.shippingVatRate : 0,
      codFee: safeCodFee,
      returnFeeDeducted: isStoreCompanyMode && safeReturnFee > 0 && isActiveShipment,
      weight: totalWeight,
      discount: 0,
      netRevenue: safeCodAmount,
      collectionProcessed: payload.status === 'تم_التحصيل' || payload.collectionProcessed,
      shippingAndInsuranceDeducted: anyStoreFeeDeducted,
      preparationStatus: 'جاهز',
      stockDeducted: payload.deductFromInventory,
      warehouseId: payload.warehouseId,
      notes: payload.notes,
      internalNotes: `بوليصة: ${payload.sheetRow.trackingKey} | تحصيل COD: ${safeCodAmount} ج.م | شحن العميل: ${payload.customerShippingFee} ج.م | شحن بوسطة الفعلي: ${payload.actualCarrierFee} ج.م | فرق التسوية: ${payload.shippingSpread >= 0 ? '+' : ''}${payload.shippingSpread} ج.م`,
      codPayoutNetReceived: payload.sheetRow.sheetNetPayout,
      codPayoutExpectedNet: Math.round((safeCodAmount - payload.customerShippingFee) * 100) / 100,
      codPayoutDiff: payload.shippingSpread,
      codPayoutSheetRef: payload.cashoutId || payload.sheetRow.fileName
    };

    let deductedUnits = 0;
    updateStoreData(storeId, draft => {
      draft.orders = [newOrder, ...(draft.orders || [])];

      if (!draft.wallet) {
        draft.wallet = { balance: 0, transactions: [] };
      }
      if (!Array.isArray(draft.wallet.transactions)) {
        draft.wallet.transactions = [];
      }

      const walletTxsToAdd: typeof draft.wallet.transactions = [];
      let balanceDelta = 0;

      if (shouldDeductShipping) {
        walletTxsToAdd.push({
          id: `ship_${newId}`,
          type: 'سحب',
          amount: walletShippingFee,
          date: nowIso,
          note: `مصاريف شحن أوردر #${payload.orderNumber}${safeCodAmount === 0 ? ' (تحصيل 0 - بوسطة)' : ' (بوسطة)'}`,
          category: 'shipping',
          status: 'completed',
          orderId: newId,
          orderNumber: payload.orderNumber
        });
        balanceDelta -= walletShippingFee;
      }

      if (isActiveShipment && safeInsFee > 0) {
        walletTxsToAdd.push({
          id: `insure_${newId}`,
          type: 'سحب',
          amount: safeInsFee,
          date: nowIso,
          note: `خصم رسوم تأمين أوردر #${payload.orderNumber}`,
          category: 'insurance',
          status: 'completed',
          orderId: newId,
          orderNumber: payload.orderNumber
        });
        balanceDelta -= safeInsFee;
      }

      if (isActiveShipment && safeVatVal > 0) {
        const vatPctText = `${Math.round((payload.shippingVatRate || 0.14) * 100)}%`;
        walletTxsToAdd.push({
          id: `vat_${newId}`,
          type: 'سحب',
          amount: safeVatVal,
          date: nowIso,
          note: `خصم ضريبة القيمة المضافة لطلب شحن (${vatPctText}) #${payload.orderNumber}`,
          category: 'vat',
          status: 'completed',
          orderId: newId,
          orderNumber: payload.orderNumber
        });
        balanceDelta -= safeVatVal;
      }

      if (isActiveShipment && safeInspFee > 0) {
        walletTxsToAdd.push({
          id: `insp_expense_${newId}`,
          type: 'سحب',
          amount: safeInspFee,
          date: nowIso,
          note: `خصم رسوم معاينة أوردر #${payload.orderNumber}`,
          category: 'inspection',
          status: 'completed',
          orderId: newId,
          orderNumber: payload.orderNumber
        });
        balanceDelta -= safeInspFee;
      }

      if (isActiveShipment && safeReturnFee > 0) {
        walletTxsToAdd.push({
          id: `return_${newId}`,
          type: 'سحب',
          amount: safeReturnFee,
          date: nowIso,
          note: `خصم مصاريف مرتجع أوردر #${payload.orderNumber}`,
          category: 'return',
          status: 'completed',
          orderId: newId,
          orderNumber: payload.orderNumber
        });
        balanceDelta -= safeReturnFee;
      }

      if (shouldDepositCollection && safeCodFee > 0) {
        walletTxsToAdd.push({
          id: `cod_${newId}`,
          type: 'سحب',
          amount: safeCodFee,
          date: nowIso,
          note: `خصم رسوم COD أوردر #${payload.orderNumber}`,
          category: 'cod',
          status: 'completed',
          orderId: newId,
          orderNumber: payload.orderNumber
        });
        balanceDelta -= safeCodFee;
      }

      if (shouldDepositCollection) {
        walletTxsToAdd.push({
          id: `collect_${newId}`,
          type: 'إيداع',
          amount: safeCodAmount,
          date: nowIso,
          note: `رصيد من الدفع عند الاستلام أوردر #${payload.orderNumber}`,
          category: 'collection',
          status: 'completed',
          orderId: newId,
          orderNumber: payload.orderNumber
        });
        balanceDelta += safeCodAmount;
      }

      if (walletTxsToAdd.length > 0) {
        const existingIds = new Set(draft.wallet.transactions.map(t => t.id));
        const uniqueNew = walletTxsToAdd.filter(t => !existingIds.has(t.id));
        if (uniqueNew.length > 0) {
          draft.wallet.transactions = [...uniqueNew, ...draft.wallet.transactions];
          draft.wallet.balance = Math.round(((Number(draft.wallet.balance) || 0) + balanceDelta) * 100) / 100;
        }
      }

      if (payload.deductFromInventory) {
        deductedUnits = deductItemsFromUnifiedInventory(draft, payload.items, payload.warehouseId);
      }

      const rawDesc = (payload.sheetRow.packageDescription || '').trim();
      const descNormKey = rawDesc
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (payload.pickedFromInventory && descNormKey && payload.items.length > 0) {
        const realItems = payload.items.filter(
          it => it.productId && !String(it.productId).startsWith('sheet_item_')
        );
        if (realItems.length > 0) {
          draft.settings.sheetProductMappings = {
            ...(draft.settings.sheetProductMappings || {}),
            [descNormKey]: realItems.map(it => ({
              productId: it.productId,
              ...(it.variantId ? { variantId: it.variantId } : {}),
              quantity: Math.max(1, Number(it.quantity) || 1),
              updatedAt: nowIso
            }))
          };
        }
      }

      const logs = draft.settings.activityLogs || [];
      logs.unshift({
        id: `log_imp_${Date.now()}`,
        user: operator,
        action: 'تنزيل أوردر من شيت بوسطة وتسوية الشحن',
        details: `تنزيل الأوردر #${payload.orderNumber} (بوليصة ${payload.sheetRow.trackingKey}) · تحصيل ${safeCodAmount} ج.م${
          isStoreCompanyMode
            ? ` · مصاريف شركة الشحن بالمتجر -${payload.totalStoreCarrierFees} ج.م`
            : shouldDeductShipping
            ? ` · خصم شحن بوسطة -${walletShippingFee} ج.م`
            : ''
        } · فرق التسوية ${payload.shippingSpread >= 0 ? '+' : ''}${payload.shippingSpread} ج.م${payload.deductFromInventory ? ` · تم خصم ${deductedUnits} قطعة من المخزون الموحّد` : ''}`,
        date: nowIso,
        timestamp: Date.now()
      });
      draft.settings.activityLogs = logs.slice(0, 400);
    });
  };

  const handleLinkOrderWithSettlement = (payload: SheetOrderLinkUpdatePayload) => {
    const nowIso = new Date().toISOString();
    let deductedUnits = 0;
    updateStoreData(storeId, draft => {
      draft.orders = (draft.orders || []).map(order => {
        if (order.id !== payload.orderId) return order;
        const spreadNote = `تسوية الشحن (${payload.sheetRow.trackingKey}): شحن العميل ${payload.customerShippingFee} ج.م vs بوسطة ${payload.actualCarrierFee} ج.م (فرق ${payload.shippingSpread >= 0 ? '+' : ''}${payload.shippingSpread} ج.م)`;
        return {
          ...order,
          waybillNumber: order.waybillNumber || payload.sheetRow.trackingKey,
          bostaTrackingNumber: order.bostaTrackingNumber || payload.sheetRow.trackingKey,
          shippingFee: payload.customerShippingFee,
          codPayoutNetReceived: payload.sheetRow.sheetNetPayout,
          codPayoutDiff: payload.shippingSpread,
          codPayoutSheetRef: payload.sheetRow.sheetCashoutId || order.codPayoutSheetRef,
          stockDeducted: payload.deductFromInventory ? true : order.stockDeducted,
          warehouseId: payload.deductFromInventory ? (payload.warehouseId || order.warehouseId) : order.warehouseId,
          updatedAt: nowIso,
          internalNotes: [order.internalNotes, spreadNote, payload.notes]
            .filter(Boolean)
            .join(' | ')
        };
      });

      if (payload.deductFromInventory && payload.itemsToDeduct?.length) {
        deductedUnits = deductItemsFromUnifiedInventory(
          draft,
          payload.itemsToDeduct,
          payload.warehouseId
        );
      }

      const logs = draft.settings.activityLogs || [];
      logs.unshift({
        id: `log_lnk_${Date.now()}`,
        user: operator,
        action: 'ربط بوليصة بأوردر وتسوية فرق الشحن',
        details: `ربط البوليصة ${payload.sheetRow.trackingKey} · شحن العميل ${payload.customerShippingFee} ج.م vs بوسطة ${payload.actualCarrierFee} ج.م (فرق ${payload.shippingSpread >= 0 ? '+' : ''}${payload.shippingSpread} ج.م)${payload.deductFromInventory ? ` · خصم ${deductedUnits} قطعة من المخزون` : ''}`,
        date: nowIso,
        timestamp: Date.now()
      });
      draft.settings.activityLogs = logs.slice(0, 400);
    });
  };

  const handleUpdateOrderFromSheet = (payload: SheetOrderUpdatePayload) => {
    const nowIso = new Date().toISOString();
    const isStoreCompanyMode = payload.walletShippingSource === 'customer';
    const safeCodAmount = Math.round(Math.max(0, Number(payload.codAmount) || 0) * 100) / 100;
    const walletShippingFee = isStoreCompanyMode
      ? Math.round(Math.max(0, Number(payload.customerShippingFee) || 0) * 100) / 100
      : Math.round(Math.max(0, Number(payload.walletShippingFee) || 0) * 100) / 100;
    const isActiveShipment = payload.status !== 'قيد_التنفيذ';
    const shouldDeductShipping = walletShippingFee > 0 && isActiveShipment;
    const shouldDepositCollection = safeCodAmount > 0 && payload.status === 'تم_التحصيل';

    const safeInsFee = isStoreCompanyMode && isActiveShipment ? Math.round(Math.max(0, Number(payload.insuranceFee) || 0) * 100) / 100 : 0;
    const safeVatVal = isStoreCompanyMode && isActiveShipment ? Math.round(Math.max(0, Number(payload.vatValue) || 0) * 100) / 100 : 0;
    const safeInspFee = isStoreCompanyMode && isActiveShipment ? Math.round(Math.max(0, Number(payload.inspectionFee) || 0) * 100) / 100 : 0;
    const safeCodFee = isStoreCompanyMode && shouldDepositCollection ? Math.round(Math.max(0, Number(payload.codFee) || 0) * 100) / 100 : 0;
    const safeReturnFee = isStoreCompanyMode && isActiveShipment ? Math.round(Math.max(0, Number(payload.returnShippingFee) || 0) * 100) / 100 : 0;

    const feeSpecs: Array<{
      id: string;
      amount: number;
      category: 'shipping' | 'insurance' | 'vat' | 'inspection' | 'cod' | 'return';
      note: string;
    }> = [
      {
        id: `ship_${payload.orderId}`,
        amount: shouldDeductShipping ? walletShippingFee : 0,
        category: 'shipping',
        note: `مصاريف شحن أوردر #${payload.orderNumber}${safeCodAmount === 0 ? ' (تحصيل 0 - بوسطة)' : ' (بوسطة)'}`
      },
      {
        id: `insure_${payload.orderId}`,
        amount: safeInsFee,
        category: 'insurance',
        note: `خصم رسوم تأمين أوردر #${payload.orderNumber}`
      },
      {
        id: `vat_${payload.orderId}`,
        amount: safeVatVal,
        category: 'vat',
        note: `خصم ضريبة القيمة المضافة لطلب شحن (${Math.round((payload.shippingVatRate || 0.14) * 100)}%) #${payload.orderNumber}`
      },
      {
        id: `insp_expense_${payload.orderId}`,
        amount: safeInspFee,
        category: 'inspection',
        note: `خصم رسوم معاينة أوردر #${payload.orderNumber}`
      },
      {
        id: `return_${payload.orderId}`,
        amount: safeReturnFee,
        category: 'return',
        note: `خصم مصاريف مرتجع أوردر #${payload.orderNumber}`
      },
      {
        id: `cod_${payload.orderId}`,
        amount: safeCodFee,
        category: 'cod',
        note: `خصم رسوم COD أوردر #${payload.orderNumber}`
      }
    ];
    const targetFeeMap = new Map(feeSpecs.map(s => [s.id, s]));

    // Capture IDs of any existing order wallet transactions that must be deleted from DB/IndexedDB
    const removedWalletTxIds = (storeData.wallet?.transactions || [])
      .filter(t => {
        if (!t) return false;
        const spec = targetFeeMap.get(t.id);
        if (spec && spec.amount <= 0) return true;
        const isCollectTx =
          t.id === `collect_${payload.orderId}` || t.id === `collect_heal_${payload.orderId}`;
        if (isCollectTx && !shouldDepositCollection) return true;
        if (t.id === `collect_heal_${payload.orderId}` && shouldDepositCollection) return true;
        return false;
      })
      .map(t => t.id)
      .filter(Boolean);

    updateStoreData(storeId, draft => {
      const existing = (draft.orders || []).find(o => o.id === payload.orderId);
      if (!existing) return;

      const updatedProductPrice = Math.max(
        0,
        Math.round((safeCodAmount - payload.customerShippingFee) * 100) / 100
      );

      draft.orders = (draft.orders || []).map(order => {
        if (order.id !== payload.orderId) return order;
        return {
          ...order,
          orderNumber: payload.orderNumber,
          waybillNumber: order.waybillNumber || payload.sheetRow.trackingKey,
          bostaTrackingNumber: order.bostaTrackingNumber || payload.sheetRow.trackingKey,
          sheetFeeBillingMode: isStoreCompanyMode ? 'store_company_fees' : 'carrier_all_inclusive',
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          customerAddress: payload.customerAddress,
          city: payload.city,
          governorate: payload.city,
          merchantBrandName: payload.brandName,
          shippingFee: payload.customerShippingFee,
          isManualShippingOverride: true,
          totalPrice: safeCodAmount,
          totalAmountOverride: safeCodAmount,
          totalAmountOverrideReason:
            safeCodAmount === 0
              ? 'تحصيل 0 من شيت بوسطة (خصم الشحن فقط من المحفظة)'
              : 'تعديل مبلغ التحصيل من شيت بوسطة',
          productPrice: updatedProductPrice,
          netRevenue: safeCodAmount,
          paymentMethod:
            safeCodAmount === 0 && order.platform === 'bosta_sheet_import'
              ? 'مدفوع مسبقاً (تحصيل 0)'
              : order.paymentMethod,
          status: payload.status,
          paymentStatus: payload.paymentStatus,
          collectionProcessed: payload.status === 'تم_التحصيل',
          isInsured: isStoreCompanyMode ? payload.isInsured : false,
          insuranceFee: isStoreCompanyMode ? safeInsFee : 0,
          includeInspectionFee: isStoreCompanyMode ? payload.includeInspectionFee : false,
          inspectionFee: isStoreCompanyMode ? safeInspFee : 0,
          inspectionFeeDeducted: isStoreCompanyMode && safeInspFee > 0 && isActiveShipment,
          vatValue: isStoreCompanyMode ? safeVatVal : 0,
          shippingVatRate: isStoreCompanyMode ? payload.shippingVatRate : 0,
          codFee: isStoreCompanyMode ? safeCodFee : 0,
          returnFeeDeducted: isStoreCompanyMode && safeReturnFee > 0 && isActiveShipment,
          shippingAndInsuranceDeducted:
            shouldDeductShipping || safeInsFee > 0 || safeVatVal > 0 || safeInspFee > 0 || order.shippingAndInsuranceDeducted,
          notes: payload.notes,
          codPayoutNetReceived: payload.sheetRow.sheetNetPayout,
          codPayoutExpectedNet: Math.round((safeCodAmount - payload.customerShippingFee) * 100) / 100,
          codPayoutDiff: payload.shippingSpread,
          updatedAt: nowIso
        };
      });

      if (!draft.wallet) {
        draft.wallet = { balance: 0, transactions: [] };
      }
      if (!Array.isArray(draft.wallet.transactions)) {
        draft.wallet.transactions = [];
      }

      const collectTxId = `collect_${payload.orderId}`;
      const collectHealTxId = `collect_heal_${payload.orderId}`;
      let balanceDelta = 0;

      // Reconcile all itemized shipping/fee withdrawal transactions cleanly
      for (const spec of feeSpecs) {
        const existingTx = draft.wallet.transactions.find(t => t.id === spec.id);
        if (spec.amount > 0) {
          if (existingTx) {
            const oldAmt = existingTx.status !== 'cancelled' ? Number(existingTx.amount) || 0 : 0;
            balanceDelta += oldAmt - spec.amount;
            draft.wallet.transactions = draft.wallet.transactions.map(t =>
              t.id === spec.id
                ? {
                    ...t,
                    amount: spec.amount,
                    orderNumber: payload.orderNumber,
                    status: 'completed',
                    note: spec.note
                  }
                : t
            );
          } else if (existing.platform === 'bosta_sheet_import' || existing.shippingAndInsuranceDeducted) {
            balanceDelta -= spec.amount;
            draft.wallet.transactions = [
              {
                id: spec.id,
                type: 'سحب',
                amount: spec.amount,
                date: nowIso,
                note: spec.note,
                category: spec.category,
                status: 'completed',
                orderId: payload.orderId,
                orderNumber: payload.orderNumber
              },
              ...draft.wallet.transactions
            ];
          }
        } else if (existingTx) {
          if (existingTx.status !== 'cancelled') {
            balanceDelta += Number(existingTx.amount) || 0;
          }
          draft.wallet.transactions = draft.wallet.transactions.filter(t => t.id !== spec.id);
        }
      }

      // Reconcile collection deposit transaction in store wallet
      const existingCollectTxs = draft.wallet.transactions.filter(
        t => t.id === collectTxId || t.id === collectHealTxId
      );
      const oldCollectedSum = existingCollectTxs.reduce(
        (s, t) => s + (t.status === 'completed' ? Number(t.amount) || 0 : 0),
        0
      );

      if (shouldDepositCollection) {
        balanceDelta += safeCodAmount - oldCollectedSum;
        const primaryCollect = existingCollectTxs[0];
        draft.wallet.transactions = draft.wallet.transactions.filter(
          t => t.id !== collectTxId && t.id !== collectHealTxId
        );
        draft.wallet.transactions = [
          {
            id: collectTxId,
            type: 'إيداع',
            amount: safeCodAmount,
            date: primaryCollect?.date || nowIso,
            note: `رصيد من الدفع عند الاستلام أوردر #${payload.orderNumber}`,
            category: 'collection',
            status: 'completed',
            orderId: payload.orderId,
            orderNumber: payload.orderNumber
          },
          ...draft.wallet.transactions
        ];
      } else if (existingCollectTxs.length > 0) {
        balanceDelta -= oldCollectedSum;
        draft.wallet.transactions = draft.wallet.transactions.filter(
          t => t.id !== collectTxId && t.id !== collectHealTxId
        );
      }

      if (balanceDelta !== 0) {
        draft.wallet.balance = Math.round(((Number(draft.wallet.balance) || 0) + balanceDelta) * 100) / 100;
      }

      const logs = draft.settings.activityLogs || [];
      logs.unshift({
        id: `log_upd_sheet_${Date.now()}`,
        user: operator,
        action: 'تعديل بيانات أوردر من شيت بوسطة',
        details: `تعديل الأوردر #${payload.orderNumber} (بوليصة ${payload.sheetRow.trackingKey}) · التحصيل ${safeCodAmount} ج.م · الشحن ${payload.customerShippingFee} ج.م${
          isStoreCompanyMode ? ` · إجمالي مصاريف الشركة -${payload.totalStoreCarrierFees} ج.م` : ''
        } · الحالة: ${payload.status}`,
        date: nowIso,
        timestamp: Date.now()
      });
      draft.settings.activityLogs = logs.slice(0, 400);
    });

    if (removedWalletTxIds.length > 0) {
      void deleteStoreItems(storeId, 'transactions', removedWalletTxIds);
    }
  };

  const handleDeleteOrderFromStore = (orderId: string) => {
    const nowIso = new Date().toISOString();
    const existingOrder = (storeData.orders || []).find(o => o.id === orderId);
    const existingOrderNum = String(existingOrder?.orderNumber || '').trim();
    const removedWalletTxIds = (storeData.wallet?.transactions || [])
      .filter(t => {
        if (!t) return false;
        const note = t.note || '';
        const id = t.id || '';
        const matchById = t.orderId === orderId || id.endsWith(`_${orderId}`);
        const matchByNum =
          Boolean(existingOrderNum) &&
          (String(t.orderNumber || '').trim() === existingOrderNum ||
            note.includes(`#${existingOrderNum}`));
        return matchById || matchByNum;
      })
      .map(t => t.id)
      .filter(Boolean);

    let result: {
      orderNumber: string;
      removedWalletTxs: number;
      restoredUnits: number;
    } | null = existingOrder
      ? {
          orderNumber: existingOrderNum || orderId,
          removedWalletTxs: removedWalletTxIds.length,
          restoredUnits: 0
        }
      : null;

    updateStoreData(storeId, draft => {
      const targetOrder = (draft.orders || []).find(o => o.id === orderId);
      if (!targetOrder) return;

      const targetOrderNum = String(targetOrder.orderNumber || '').trim();

      // 1. Remove order from store orders
      draft.orders = (draft.orders || []).filter(o => o.id !== orderId);

      // 2. Restore stock to unified inventory if it was deducted
      let restoredUnits = 0;
      const isPos =
        targetOrder.channel === 'pos' ||
        targetOrder.id.startsWith('POS-') ||
        targetOrder.shippingCompany === 'كاشير - بيع مباشر';
      if ((targetOrder.stockDeducted || isPos) && targetOrder.items?.length) {
        restoredUnits = restoreItemsToUnifiedInventory(
          draft,
          targetOrder.items,
          targetOrder.warehouseId
        );
      }

      // 3. Cascade delete all associated wallet transactions & reverse wallet balance
      let removedWalletTxs = 0;
      if (draft.wallet && Array.isArray(draft.wallet.transactions)) {
        let balanceDelta = 0;
        const remainingTxs = draft.wallet.transactions.filter(t => {
          const note = t.note || '';
          const id = t.id || '';
          const matchById = t.orderId === orderId || id.endsWith(`_${orderId}`);
          const matchByNum =
            Boolean(targetOrderNum) &&
            (String(t.orderNumber || '').trim() === targetOrderNum ||
              note.includes(`#${targetOrderNum}`));
          const isMatch = matchById || matchByNum;
          if (isMatch) {
            removedWalletTxs += 1;
            const amt = Number(t.amount) || 0;
            if (t.type === 'إيداع' && t.status === 'completed') {
              balanceDelta -= amt;
            } else if (t.type === 'سحب' && t.status !== 'cancelled') {
              balanceDelta += amt;
            }
          }
          return !isMatch;
        });

        if (removedWalletTxs > 0) {
          draft.wallet.transactions = remainingTxs;
          draft.wallet.balance =
            Math.round(((Number(draft.wallet.balance) || 0) + balanceDelta) * 100) / 100;
        }
      }

      // 4. Audit log
      const logs = draft.settings.activityLogs || [];
      logs.unshift({
        id: `log_del_${Date.now()}`,
        user: operator,
        action: 'حذف أوردر من المتجر ورد المخزون وحركات المحفظة',
        details: `حذف الأوردر #${targetOrderNum || orderId} · مسح ${removedWalletTxs} حركة من المحفظة${
          restoredUnits > 0 ? ` · رد ${restoredUnits} قطعة للمخزون الموحّد` : ''
        }`,
        date: nowIso,
        timestamp: Date.now()
      });
      draft.settings.activityLogs = logs.slice(0, 400);

      result = {
        orderNumber: targetOrderNum || orderId,
        removedWalletTxs,
        restoredUnits
      };
    });

    // Also remove from cloud & local persistence immediately
    deleteStoreItem(storeId, 'orders', orderId);
    if (existingOrderNum) {
      deleteStoreItem(storeId, 'orders', existingOrderNum);
    }
    if (removedWalletTxIds.length > 0) {
      void deleteStoreItems(storeId, 'transactions', removedWalletTxIds);
    }

    return result;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#060a12] px-3 sm:px-5 lg:px-7 py-4 sm:py-6">
      <CodHunterWorkspace
        storeId={storeId}
        storeName={storeDisplayName}
        orders={storeData.orders || []}
        settings={storeData.settings}
        treasuryAccounts={storeData.treasury?.accounts || []}
        storeWallet={storeData.wallet}
        allowBatchSettlement={true}
        showBackToDashboard={true}
        orderDetailBasePath={`/store/${storeId}/orders`}
        onSaveCarrierProfile={handleSaveCarrierProfile}
        onUpdateGraceDays={handleUpdateGraceDays}
        onSettleBatch={handleSettleBatch}
        onReverseBatch={handleReverseBatch}
        onCreateOrderFromSheet={handleCreateOrderFromSheet}
        onLinkOrderWithSettlement={handleLinkOrderWithSettlement}
        onUpdateOrderFromSheet={handleUpdateOrderFromSheet}
        onDeleteOrderFromStore={handleDeleteOrderFromStore}
        onNotify={(msg, type) => {
          if (showToast) {
            try {
              showToast(msg, type);
            } catch {
              // ignore
            }
          }
        }}
      />
    </div>
  );
}
