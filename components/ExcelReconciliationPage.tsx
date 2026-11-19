import React from 'react';
import { useParams } from 'react-router-dom';
import {
  CodSettlementBatch,
  CodSheetAmountMode,
  CodSheetColumnProfile,
  StoreData,
  TreasuryTransaction
} from '../types';
import CodHunterWorkspace from './CodHunterWorkspace';
import { SheetAuditRow } from '../utils/codReconciliation';

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      <CodHunterWorkspace
        storeId={storeId}
        storeName={storeDisplayName}
        orders={storeData.orders || []}
        settings={storeData.settings}
        treasuryAccounts={storeData.treasury?.accounts || []}
        allowBatchSettlement={true}
        showBackToDashboard={true}
        orderDetailBasePath={`/store/${storeId}/orders`}
        onSaveCarrierProfile={handleSaveCarrierProfile}
        onUpdateGraceDays={handleUpdateGraceDays}
        onSettleBatch={handleSettleBatch}
        onReverseBatch={handleReverseBatch}
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
