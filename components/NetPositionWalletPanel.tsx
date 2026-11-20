import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSpreadsheet,
  Info,
  Landmark,
  Layers,
  Link2Off,
  Plus,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  Wallet as WalletIcon
} from 'lucide-react';
import { CodSettlementBatch, Settings, TreasuryAccount, Wallet } from '../types';
import {
  getBrandFamilyMeta,
  TwoWayCodAuditResult,
  ZoneRateConfig
} from '../utils/codReconciliation';
import {
  BankConfirmationRecord,
  WalletCalculationMode,
  WalletCostConfig,
  WalletDataScope,
  WalletEntryKind,
  WalletLedgerEntry
} from '../utils/codStorage';

type WalletNavTab =
  | 'cashout_audit'
  | 'transactions_ledger'
  | 'untransferred'
  | 'uncollected'
  | 'compensations'
  | 'online_flex'
  | 'fee_anomalies'
  | 'in_transit_sheet'
  | 'stuck_returns'
  | 'bosta_credits'
  | 'batches'
  | 'not_found'
  | 'discrepancy';

type WaybillAlertKind = 'unlinked_to_order' | 'no_wallet_counterpart' | 'amount_mismatch';

interface WaybillWalletAlert {
  id: string;
  kind: WaybillAlertKind;
  trackingNumber: string;
  orderNumber: string;
  brandName: string;
  expectedAmount: number;
  recordedWalletAmount: number;
  differenceAmount: number;
  cashoutId: string;
  reason: string;
  targetTab: WalletNavTab;
}

interface NetPositionWalletPanelProps {
  storeName: string;
  auditResult: TwoWayCodAuditResult;
  sheetBrandFilter?: string;
  settings?: Settings;
  zoneRates?: ZoneRateConfig;
  treasuryAccounts: TreasuryAccount[];
  storeWallet?: Wallet;
  savedBatches?: CodSettlementBatch[];
  bankConfirmedCashouts: Record<string, BankConfirmationRecord>;
  ledgerEntries: WalletLedgerEntry[];
  costConfig: WalletCostConfig;
  onAddLedgerEntry: (entry: Omit<WalletLedgerEntry, 'id' | 'createdAt'>) => void;
  onDeleteLedgerEntry: (id: string) => void;
  onUpdateCostConfig: (next: WalletCostConfig) => void;
  onNavigateTab: (tab: WalletNavTab, search?: string) => void;
  searchQuery: string;
}

const ENTRY_KIND_META: Record<
  WalletEntryKind,
  { label: string; defaultDirection: 'in' | 'out'; group: 'cogs' | 'expenses' | 'payouts' | 'inflows' }
> = {
  goods_cost: { label: 'تكلفة بضاعة / مشتريات', defaultDirection: 'out', group: 'cogs' },
  ads: { label: 'مصروفات إعلانات وتمويل', defaultDirection: 'out', group: 'expenses' },
  operating_expense: { label: 'مصروفات تشغيل ومرتبات', defaultDirection: 'out', group: 'expenses' },
  supplier_payment: { label: 'دفعة مورد / مصنع', defaultDirection: 'out', group: 'payouts' },
  partner_withdrawal: { label: 'مسحوبات شركاء / توزيع أرباح', defaultDirection: 'out', group: 'payouts' },
  personal_withdrawal: { label: 'مسحوبات شخصية', defaultDirection: 'out', group: 'payouts' },
  opening_balance: { label: 'رصيد افتتاحي متاح', defaultDirection: 'in', group: 'inflows' },
  extra_income: { label: 'إيداع / إيراد إضافي', defaultDirection: 'in', group: 'inflows' }
};

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

const normalizeMatchText = (raw?: string): string =>
  (raw || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const formatEgpParts = (val: number): { sign: string; numStr: string } => {
  const num = Number.isFinite(val) ? round2(val) : 0;
  const abs = Math.abs(num);
  const hasFraction = Math.abs(abs - Math.trunc(abs)) > 0.0001;
  return {
    sign: num < 0 ? '−' : '',
    numStr: abs.toLocaleString('en-US', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2
    })
  };
};

const formatEgp = (val: number): string => {
  const { sign, numStr } = formatEgpParts(val);
  return `${sign}${numStr} ج.م`;
};

const EgpHero: React.FC<{
  value: number;
  className?: string;
  unitClassName?: string;
}> = ({ value, className = '', unitClassName = 'text-base font-bold opacity-80' }) => {
  const { sign, numStr } = formatEgpParts(value);
  return (
    <span className={`inline-flex items-baseline gap-1.5 tabular-nums ${className}`}>
      <span dir="ltr">
        {sign}
        {numStr}
      </span>
      <span className={unitClassName}>ج.م</span>
    </span>
  );
};

const TREASURY_TYPE_LABEL: Record<TreasuryAccount['type'], string> = {
  bank: 'حساب بنكي',
  safe: 'خزينة نقدية',
  wallet: 'محفظة إلكترونية',
  custody: 'عهدة'
};

// Extracts exact return fee deducted: reads negative Net Value first, then falls back to un-offset Total Fees when Net Value is 0
const getReturnDeductedFee = (r: TwoWayCodAuditResult['sheetRows'][number]): number => {
  if (r.sheetNetPayout < 0) return round2(Math.abs(r.sheetNetPayout));
  if (r.sheetFeesAmount > 0) {
    const offsets =
      Math.max(0, r.feeBreakdown?.discountsAndCredits || 0) +
      Math.max(0, r.feeBreakdown?.flexShipAmount || 0);
    const residual = round2(r.sheetFeesAmount - offsets);
    if (residual > 0.01) return residual;
  }
  return 0;
};

const STORE_SUPPLIER_CATS = new Set([
  'supplier_payment',
  'inventory_purchase',
  'supply_purchase',
  'supply_deposit',
  'supply_funding',
  'partner_supply'
]);

const STORE_WITHDRAWAL_CATS = new Set([
  'profit_withdrawal',
  'manual_withdrawal',
  'wallet_withdrawal'
]);

export const NetPositionWalletPanel: React.FC<NetPositionWalletPanelProps> = ({
  storeName,
  auditResult,
  sheetBrandFilter = 'all',
  settings,
  zoneRates,
  treasuryAccounts,
  storeWallet,
  savedBatches = [],
  bankConfirmedCashouts,
  ledgerEntries,
  costConfig,
  onAddLedgerEntry,
  onDeleteLedgerEntry,
  onUpdateCostConfig,
  onNavigateTab,
  searchQuery
}) => {
  const [entryKind, setEntryKind] = useState<WalletEntryKind>('ads');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryBrand, setEntryBrand] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [journalFilter, setJournalFilter] = useState<'all' | 'out' | 'in'>('all');
  const [showWaybillAlerts, setShowWaybillAlerts] = useState(false);
  const [waybillAlertFilter, setWaybillAlertFilter] = useState<'all' | WaybillAlertKind>('all');

  const q = searchQuery.trim().toLowerCase();

  // Priced store product catalog for Auto-COGS fallback when a sheet row is not linked to a store Order
  const pricedCatalog = useMemo(() => {
    const products = settings?.products || [];
    return products
      .filter(p => Number(p.costPrice) > 0 && (p.name?.trim() || p.sku?.trim()))
      .map(p => ({
        nameNorm: normalizeMatchText(p.name),
        skuNorm: normalizeMatchText(p.sku),
        costPrice: round2(Number(p.costPrice) || 0)
      }))
      .sort((a, b) => b.nameNorm.length - a.nameNorm.length);
  }, [settings?.products]);

  const resolveRowAutoCogs = useMemo(() => {
    return (
      r: TwoWayCodAuditResult['sheetRows'][number]
    ): { cost: number; source: 'order' | 'catalog' | 'none' } => {
      if (r.matchedOrder?.items?.length) {
        let orderCost = 0;
        r.matchedOrder.items.forEach(item => {
          const unitCost = Number(item.cost) || 0;
          const qty = Number(item.quantity) || 0;
          if (unitCost > 0 && qty > 0) orderCost += unitCost * qty;
        });
        if (orderCost > 0) return { cost: round2(orderCost), source: 'order' };
      }

      if (pricedCatalog.length > 0 && r.packageDescription) {
        const descNorm = normalizeMatchText(r.packageDescription);
        if (descNorm.length >= 3) {
          const matched = pricedCatalog.find(
            p =>
              (p.skuNorm.length >= 3 && descNorm.includes(p.skuNorm)) ||
              (p.nameNorm.length >= 4 && descNorm.includes(p.nameNorm))
          );
          if (matched) {
            const qtyMatch =
              descNorm.match(/(?:^|\s|[(\-])(\d{1,2})\s*[x×*](?:\s|$)/i) ||
              descNorm.match(/[x×*]\s*(\d{1,2})(?:\s|$|[)\-])/i) ||
              descNorm.match(/عدد\s*[:\-]?\s*(\d{1,2})/);
            const parsedQty = qtyMatch ? Math.max(1, Math.min(20, parseInt(qtyMatch[1], 10) || 1)) : 1;
            return { cost: round2(matched.costPrice * parsedQty), source: 'catalog' };
          }
        }
      }

      return { cost: 0, source: 'none' };
    };
  }, [pricedCatalog]);

  // Deduplicated brand family options for Quick Ledger dropdown
  const normalizedBrandOptions = useMemo(() => {
    const map = new Map<string, string>();
    auditResult.availableSheetBrands.forEach(raw => {
      const bf = getBrandFamilyMeta(raw);
      if (!bf.key) return;
      const existing = map.get(bf.key);
      if (!existing || (!existing.includes('ة') && bf.label.includes('ة'))) {
        map.set(bf.key, bf.label);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [auditResult.availableSheetBrands]);

  // 1. Core Sheet & Transactions Accounting Aggregation (Scope-Unified & Mathematically Closed to 0.00 EGP)
  const metrics = useMemo(() => {
    const isTrueFileDuplicate = (r: TwoWayCodAuditResult['sheetRows'][number]) =>
      r.category === 'duplicate' && r.reasonSummary.includes('تم تكرار هذه البوليصة');

    const dedupedRows = auditResult.sheetRows.filter(r => !isTrueFileDuplicate(r));

    const returnedRows = dedupedRows.filter(
      r =>
        r.category === 'not_collected_customer' ||
        (r.category === 'duplicate' && r.sheetNetPayout < 0 && r.sheetGrossAmount === 0)
    );
    const inTransitRows = dedupedRows.filter(r => r.category === 'in_transit_sheet');
    const deliveredRows = dedupedRows.filter(
      r =>
        r.category !== 'not_collected_customer' &&
        r.category !== 'in_transit_sheet' &&
        !(r.category === 'duplicate' && r.sheetNetPayout < 0 && r.sheetGrossAmount === 0)
    );

    // Fix 2: Estimate shipping for Deliveries_Export-only rows (which have COD but no Total Fees column yet)
    const cashCycleDelivered = deliveredRows.filter(
      r => r.fileRole === 'cash_cycles' && r.sheetFeesAmount > 0
    );
    const avgCashCycleShipFee =
      cashCycleDelivered.length > 0
        ? round2(
            cashCycleDelivered.reduce((s, r) => s + r.sheetFeesAmount, 0) /
              cashCycleDelivered.length
          )
        : round2((zoneRates?.cairoGizaMax || 77) * 1.14);

    const deductEstShipping = costConfig.deductEstimatedShippingOnDeliveriesOnly !== false;

    const getRowEstimatedShipping = (r: TwoWayCodAuditResult['sheetRows'][number]): number => {
      if (r.fileRole !== 'bosta_orders' || r.sheetFeesAmount > 0 || r.sheetGrossAmount <= 0) {
        return 0;
      }
      if (r.expectation && r.expectation.expectedCarrierFees > 0) {
        return round2(r.expectation.expectedCarrierFees);
      }
      return avgCashCycleShipFee;
    };

    let deliveriesOnlyDeliveredCount = 0;
    let deliveriesOnlyEstimatedShippingTotal = 0;
    let appliedDeliveriesOnlyEstShipping = 0;
    let appliedUntransferredEstShipping = 0;

    let deliveredCodTotal = 0;
    let deliveredShippingFees = 0;
    let deliveredSheetNetTotal = 0;
    let untransferredSheetNet = 0;

    deliveredRows.forEach(r => {
      const cod = Math.max(0, r.sheetGrossAmount);
      const rawEst = getRowEstimatedShipping(r);
      if (rawEst > 0) {
        deliveriesOnlyDeliveredCount += 1;
        deliveriesOnlyEstimatedShippingTotal += rawEst;
      }
      const appliedEst = deductEstShipping ? rawEst : 0;
      appliedDeliveriesOnlyEstShipping += appliedEst;

      const effFee = Math.max(0, r.sheetFeesAmount) + appliedEst;
      const effNet = r.sheetNetPayout - appliedEst;

      deliveredCodTotal += cod;
      deliveredShippingFees += effFee;
      deliveredSheetNetTotal += effNet;

      if (r.category === 'collected_untransferred') {
        untransferredSheetNet += effNet;
        appliedUntransferredEstShipping += appliedEst;
      }
    });

    deliveriesOnlyEstimatedShippingTotal = round2(deliveriesOnlyEstimatedShippingTotal);
    appliedDeliveriesOnlyEstShipping = round2(appliedDeliveriesOnlyEstShipping);
    appliedUntransferredEstShipping = round2(appliedUntransferredEstShipping);
    deliveredCodTotal = round2(deliveredCodTotal);
    deliveredShippingFees = round2(deliveredShippingFees);
    deliveredSheetNetTotal = round2(deliveredSheetNetTotal);
    untransferredSheetNet = round2(untransferredSheetNet);

    const deliveredNetOtherAdj = round2(
      deliveredSheetNetTotal - (deliveredCodTotal - deliveredShippingFees)
    );

    // Fix 3: Capture return fees from BOTH negative Net Value AND un-offset positive Total Fees
    let returnedShippingFees = 0;
    let zeroNetReturnFeesCaptured = 0;
    returnedRows.forEach(r => {
      const fee = getReturnDeductedFee(r);
      returnedShippingFees += fee;
      if (r.sheetNetPayout >= 0 && fee > 0) {
        zeroNetReturnFeesCaptured += fee;
      }
    });
    returnedShippingFees = round2(returnedShippingFees);
    zeroNetReturnFeesCaptured = round2(zeroNetReturnFeesCaptured);

    const ordersSheetNetEarned = round2(deliveredSheetNetTotal - returnedShippingFees);
    const paidOrdersSheetNet = round2(ordersSheetNetEarned - untransferredSheetNet);

    const inTransitCodValue = round2(
      inTransitRows.reduce((s, r) => s + Math.max(0, r.sheetGrossAmount), 0)
    );
    const stuckReturnsValue = round2(auditResult.totals.stuckReturnsValueAmount);

    const tx = auditResult.transactionsSummary;
    const credits = auditResult.bostaCreditsSummary;
    const comp = auditResult.compensationsSummary;
    const forensic = auditResult.cashoutForensicSummary;

    const isBrandFiltered = Boolean(sheetBrandFilter && sheetBrandFilter !== 'all');
    const filterBrandKey = isBrandFiltered ? getBrandFamilyMeta(sheetBrandFilter).key : '';
    const activeBrandFilterLabel = isBrandFiltered
      ? getBrandFamilyMeta(sheetBrandFilter).label || sheetBrandFilter
      : '';
    const hasSheetRows = dedupedRows.length > 0;
    const canToggleScope = tx.hasTransactionsSheet && hasSheetRows && !isBrandFiltered;

    const activeDataScope: WalletDataScope = isBrandFiltered
      ? 'orders_period'
      : !hasSheetRows && tx.hasTransactionsSheet
      ? 'full_transactions'
      : !tx.hasTransactionsSheet
      ? 'orders_period'
      : costConfig.dataScope === 'full_transactions'
      ? 'full_transactions'
      : 'orders_period';

    const isFullTransactionsScope = activeDataScope === 'full_transactions' && tx.hasTransactionsSheet;

    // Identify linked vs older historical Transactions cashouts
    const sheetCashoutIds = new Set(
      dedupedRows
        .map(r => (r.sheetCashoutId || '').trim())
        .filter(id => id && id !== '-')
    );
    const allPositiveTxCashouts = tx.hasTransactionsSheet
      ? tx.entries.filter(e => e.cashoutAmount > 0)
      : [];
    const linkedTxEntries = allPositiveTxCashouts.filter(
      e => sheetCashoutIds.has((e.cashoutId || '').trim()) || e.linkedOrderCount > 0
    );
    const unlinkedTxEntries = allPositiveTxCashouts.filter(
      e => !(sheetCashoutIds.has((e.cashoutId || '').trim()) || e.linkedOrderCount > 0)
    );
    const linkedCashoutIdSet = new Set(
      linkedTxEntries.map(e => (e.cashoutId || '').trim()).filter(Boolean)
    );
    const unlinkedHistoricalTxCount = unlinkedTxEntries.length;
    const unlinkedHistoricalTxTotal = round2(
      unlinkedTxEntries.reduce((s, e) => s + e.cashoutAmount, 0)
    );
    const useLinkedTxBridge =
      !isFullTransactionsScope && !isBrandFiltered && tx.hasTransactionsSheet && linkedTxEntries.length > 0;

    const linkedTxCashoutTotal = round2(
      linkedTxEntries.reduce((s, e) => s + e.cashoutAmount, 0)
    );
    const linkedCashoutBridge = useLinkedTxBridge
      ? round2(linkedTxCashoutTotal - paidOrdersSheetNet)
      : 0;
    const linkedTransferFees = round2(
      linkedTxEntries.reduce((s, e) => s + Math.abs(e.transferFees || 0), 0)
    );
    const linkedPickupFees = round2(
      linkedTxEntries.reduce((s, e) => s + Math.abs(e.linkedPickupTotal || 0), 0)
    );
    const linkedPackingFees = round2(
      linkedTxEntries.reduce(
        (s, e) => s + (e.linkedPackingTotal < 0 ? Math.abs(e.linkedPackingTotal) : 0),
        0
      )
    );

    // Full Transactions Ledger components
    const txGrossCollections = round2(tx.totalCollectionCycles);
    const txFeesCycles = round2(tx.totalBostaFeesCycles);
    const transferFeesTotal = round2(Math.abs(tx.totalTransferFees));
    const packingNet = round2(tx.packingMaterialNet);
    const pickupFeesTotal = round2(Math.abs(tx.pickupFeesTotal));
    const negativeAdjustments = tx.adjustmentsTotal < 0 ? round2(Math.abs(tx.adjustmentsTotal)) : 0;
    const positiveAdjustments = tx.adjustmentsTotal > 0 ? round2(tx.adjustmentsTotal) : 0;

    const bostaExtraDeductions = round2(
      transferFeesTotal +
        pickupFeesTotal +
        (packingNet < 0 ? Math.abs(packingNet) : 0) +
        negativeAdjustments
    );
    const packingRefunds = packingNet > 0 ? packingNet : 0;

    const compensationsReceived = round2(
      isFullTransactionsScope ? tx.totalCompensations : isBrandFiltered ? 0 : comp.totalCompensatedAmount
    );
    const bostaPositiveCredits = round2(
      compensationsReceived + packingRefunds + (isFullTransactionsScope ? positiveAdjustments : 0)
    );

    // Pocket 2: Balance currently sitting inside Bosta Wallet + Bosta Credits (account-wide, zeroed when brand-filtered)
    const bostaWalletBalance =
      !isBrandFiltered && tx.hasTransactionsSheet && tx.currentWalletBalance !== null
        ? round2(tx.currentWalletBalance)
        : 0;
    const bostaCreditsAvailable =
      !isBrandFiltered && credits.hasCreditsSheet && credits.currentCreditsBalance !== null
        ? round2(Math.max(0, credits.currentCreditsBalance))
        : 0;
    const insideBostaTotal = round2(bostaWalletBalance + bostaCreditsAvailable);

    // Strict Delivery-Order Linkage Guard:
    // A shipping waybill is ONLY considered linked to a delivery order if matched to a real store order
    // (when store-order matching is active) or matched to an uploaded warehouse order sheet (not 'not_found').
    const isRowLinkedToDeliveryOrder = (r: TwoWayCodAuditResult['sheetRows'][number]): boolean => {
      if (auditResult.matchWithStoreOrders) {
        return Boolean(r.matchedOrder);
      }
      if (r.category === 'not_found') return false;
      return Boolean(r.trackingKey || r.businessRefKey || r.matchedBy === 'cross_sheet');
    };

    const paidDeliveredRows = deliveredRows.filter(r => r.category !== 'collected_untransferred');
    const unlinkedPaidNetByCashoutId = new Map<string, number>();
    const unlinkedPaidCountByCashoutId = new Map<string, number>();
    const linkedPaidCountByCashoutId = new Map<string, number>();
    const linkedAnyCountByCashoutId = new Map<string, number>();

    dedupedRows.forEach(r => {
      const cid = (r.sheetCashoutId || '').trim();
      if (!cid || cid === '-') return;
      if (isRowLinkedToDeliveryOrder(r)) {
        linkedAnyCountByCashoutId.set(cid, (linkedAnyCountByCashoutId.get(cid) || 0) + 1);
      }
    });

    paidDeliveredRows.forEach(r => {
      const cid = (r.sheetCashoutId || '').trim();
      if (!cid || cid === '-') return;
      if (isRowLinkedToDeliveryOrder(r)) {
        linkedPaidCountByCashoutId.set(cid, (linkedPaidCountByCashoutId.get(cid) || 0) + 1);
      } else {
        const appliedEst = deductEstShipping ? getRowEstimatedShipping(r) : 0;
        const effNet = Math.max(0, round2(r.sheetNetPayout - appliedEst));
        unlinkedPaidNetByCashoutId.set(
          cid,
          round2((unlinkedPaidNetByCashoutId.get(cid) || 0) + effNet)
        );
        unlinkedPaidCountByCashoutId.set(cid, (unlinkedPaidCountByCashoutId.get(cid) || 0) + 1);
      }
    });

    // Closed Operational Net & Raw Transferred Cash BEFORE Delivery-Order Linkage Guard
    let netEarnedFromBosta = 0;
    let rawTransferredBeforeLinkGuard = 0;
    if (isFullTransactionsScope) {
      netEarnedFromBosta = round2(
        txGrossCollections - txFeesCycles - bostaExtraDeductions + bostaPositiveCredits
      );
      rawTransferredBeforeLinkGuard = round2(tx.totalCashouts);
    } else if (useLinkedTxBridge) {
      netEarnedFromBosta = round2(ordersSheetNetEarned + linkedCashoutBridge);
      rawTransferredBeforeLinkGuard = linkedTxCashoutTotal;
    } else {
      netEarnedFromBosta = round2(ordersSheetNetEarned + compensationsReceived);
      rawTransferredBeforeLinkGuard = round2(netEarnedFromBosta - untransferredSheetNet);
    }

    const impliedOpeningBostaBalance =
      isFullTransactionsScope && tx.currentWalletBalance !== null
        ? round2(bostaWalletBalance - (netEarnedFromBosta - rawTransferredBeforeLinkGuard))
        : 0;

    const calculationMode: WalletCalculationMode =
      costConfig.calculationMode === 'full_sheets' ? 'full_sheets' : 'verified_only';
    const isVerifiedOnlyMode = calculationMode === 'verified_only';

    const settledBatchNumbers = new Set(
      savedBatches.map(b => String(b.batchNumber || '').trim()).filter(Boolean)
    );
    const settledOrderIds = new Set(savedBatches.flatMap(b => b.settledOrderIds || []));
    const savedBatchesArchiveTotal = round2(
      savedBatches.reduce((s, b) => s + (Number(b.totalSheetNetAmount) || 0), 0)
    );

    // Exact per-cashout / per-row verification & delivery-order linkage split (Mathematically closed to 0.00 EGP)
    let verifiedBankAutoAmount = 0;
    let verifiedManualOrSettledAmount = 0;
    let verifiedCashoutCount = 0;
    let pendingReviewCashoutsAmount = 0;
    let pendingReviewCashoutsCount = 0;
    let scopedBankMissingOrShort = 0;
    let unlinkedWaybillsHeldAmount = 0;
    let unlinkedWaybillsHeldCount = 0;
    let unlinkedCashoutsHeldCount = 0;

    const forensicByCashout = new Map(
      forensic.cashoutAudits.map(c => [c.cashoutId, c] as const)
    );

    const evaluateTxCashouts = (entriesToEval: typeof allPositiveTxCashouts) => {
      entriesToEval.forEach(entry => {
        if (entry.cashoutAmount <= 0) return;
        const cid = (entry.cashoutId || '').trim();
        const key = cid && cid !== '-' ? cid : entry.id;
        const fa = forensicByCashout.get(entry.cashoutId);

        const linkedPaidCount = cid ? linkedPaidCountByCashoutId.get(cid) || 0 : 0;
        const linkedAnyCount = cid ? linkedAnyCountByCashoutId.get(cid) || 0 : 0;
        const unlinkedPaidCount = cid ? unlinkedPaidCountByCashoutId.get(cid) || 0 : 0;
        const unlinkedPaidNet = cid ? unlinkedPaidNetByCashoutId.get(cid) || 0 : 0;

        // Enforce strict delivery-order linkage: do NOT count as transferred unless linked to delivery orders
        let heldForUnlinked = 0;
        if (entry.linkedOrderCount === 0 || (linkedAnyCount === 0 && linkedPaidCount === 0)) {
          heldForUnlinked = entry.cashoutAmount;
          unlinkedCashoutsHeldCount += 1;
          if (unlinkedPaidCount > 0) {
            unlinkedWaybillsHeldCount += unlinkedPaidCount;
          }
        } else if (unlinkedPaidCount > 0) {
          heldForUnlinked = round2(Math.min(entry.cashoutAmount, Math.max(0, unlinkedPaidNet)));
          unlinkedWaybillsHeldCount += unlinkedPaidCount;
        }

        if (heldForUnlinked > 0) {
          unlinkedWaybillsHeldAmount += heldForUnlinked;
        }

        const eligibleAmount = round2(entry.cashoutAmount - heldForUnlinked);
        if (eligibleAmount <= 0) return;

        if (forensic.hasBankStatementSheet && fa?.bankMatchStatus === 'bank_matched_exact') {
          verifiedBankAutoAmount += eligibleAmount;
          verifiedCashoutCount += 1;
        } else if (
          forensic.hasBankStatementSheet &&
          fa?.bankMatchStatus === 'bank_short_deposit'
        ) {
          const shortfall = Math.min(eligibleAmount, Math.abs(fa.bankDepositDiff || 0));
          const landed = Math.max(0, round2(eligibleAmount - shortfall));
          verifiedBankAutoAmount += landed;
          scopedBankMissingOrShort += shortfall;
          verifiedCashoutCount += 1;
        } else if (
          forensic.hasBankStatementSheet &&
          fa?.bankMatchStatus === 'bank_missing_deposit'
        ) {
          scopedBankMissingOrShort += eligibleAmount;
        } else if (
          Boolean(bankConfirmedCashouts[key]) ||
          (entry.cashoutId && settledBatchNumbers.has(entry.cashoutId))
        ) {
          verifiedManualOrSettledAmount += eligibleAmount;
          verifiedCashoutCount += 1;
        } else {
          pendingReviewCashoutsAmount += eligibleAmount;
          pendingReviewCashoutsCount += 1;
        }
      });
    };

    if (isFullTransactionsScope) {
      evaluateTxCashouts(allPositiveTxCashouts);
    } else if (useLinkedTxBridge) {
      evaluateTxCashouts(linkedTxEntries);
    } else if (dedupedRows.length > 0) {
      paidDeliveredRows.forEach(r => {
        const appliedEst = deductEstShipping ? getRowEstimatedShipping(r) : 0;
        const effNet = round2(r.sheetNetPayout - appliedEst);
        if (!isRowLinkedToDeliveryOrder(r)) {
          unlinkedWaybillsHeldAmount += effNet;
          unlinkedWaybillsHeldCount += 1;
          return;
        }
        const isConfirmed =
          Boolean(r.expectation?.isAlreadySettled) ||
          Boolean(r.matchedOrder && settledOrderIds.has(r.matchedOrder.id)) ||
          Boolean(
            r.sheetCashoutId &&
              (settledBatchNumbers.has(r.sheetCashoutId) ||
                Boolean(bankConfirmedCashouts[r.sheetCashoutId]))
          );
        if (isConfirmed) {
          verifiedManualOrSettledAmount += effNet;
          verifiedCashoutCount += 1;
        } else {
          pendingReviewCashoutsAmount += effNet;
          pendingReviewCashoutsCount += 1;
        }
      });
      returnedRows.forEach(r => {
        const fee = getReturnDeductedFee(r);
        if (fee <= 0) return;
        const isConfirmed =
          Boolean(r.expectation?.isAlreadySettled) ||
          Boolean(
            r.sheetCashoutId &&
              (settledBatchNumbers.has(r.sheetCashoutId) ||
                Boolean(bankConfirmedCashouts[r.sheetCashoutId]))
          );
        if (isConfirmed) {
          verifiedManualOrSettledAmount -= fee;
        } else {
          pendingReviewCashoutsAmount -= fee;
        }
      });
      if (compensationsReceived > 0) {
        verifiedManualOrSettledAmount += compensationsReceived;
      }
    } else if (savedBatches.length > 0) {
      verifiedManualOrSettledAmount = savedBatchesArchiveTotal;
      verifiedCashoutCount = savedBatches.length;
    }

    unlinkedWaybillsHeldAmount = round2(unlinkedWaybillsHeldAmount);
    verifiedBankAutoAmount = round2(verifiedBankAutoAmount);
    verifiedManualOrSettledAmount = round2(verifiedManualOrSettledAmount);
    scopedBankMissingOrShort = round2(scopedBankMissingOrShort);
    const verifiedTotalCashFromBosta = round2(
      verifiedBankAutoAmount + verifiedManualOrSettledAmount
    );
    pendingReviewCashoutsAmount = round2(pendingReviewCashoutsAmount);

    // Transferred cash strictly excludes any waybills/cashouts not linked to a delivery order
    const transferredFromBosta = round2(rawTransferredBeforeLinkGuard - unlinkedWaybillsHeldAmount);

    const verifiedInBankAmount = forensic.hasBankStatementSheet
      ? verifiedBankAutoAmount
      : verifiedManualOrSettledAmount;

    const fullSheetsCashReceived =
      !tx.hasTransactionsSheet && dedupedRows.length === 0 && savedBatches.length > 0
        ? savedBatchesArchiveTotal
        : round2(transferredFromBosta - scopedBankMissingOrShort);

    const pendingReviewExcludedFromCash = isVerifiedOnlyMode ? pendingReviewCashoutsAmount : 0;
    const actualCashReceivedFromBosta = isVerifiedOnlyMode
      ? verifiedTotalCashFromBosta
      : fullSheetsCashReceived;

    const treasuryTotalBalance = round2(
      treasuryAccounts.reduce((s, acc) => s + (Number(acc.balance) || 0), 0)
    );

    // Fix 1: Complete Pocket 3 Actionable Claims (Strictly Deduplicated Against Pocket 1, Pocket 2 & Each Other)
    const untransferredKeys = new Set(
      auditResult.collectedUntransferred.map(r => r.trackingKey).filter(Boolean)
    );
    const shortPaidKeys = new Set(
      auditResult.shortPaid.map(r => r.trackingKey).filter(Boolean)
    );

    const dedupedFeeOvercharges = round2(
      auditResult.feeAnomalies
        .filter(f => !shortPaidKeys.has(f.trackingKey))
        .reduce((s, f) => s + Math.max(0, f.netUncompensatedOvercharge), 0) +
        (isBrandFiltered ? 0 : auditResult.totals.wrongfulPickupFeeAmount)
    );

    const rawUntransferredClaim = Math.max(
      0,
      round2(auditResult.totals.collectedUntransferredAmount - appliedUntransferredEstShipping)
    );
    const nonOverlappingUntransferred =
      bostaWalletBalance > 0
        ? Math.max(0, round2(rawUntransferredClaim - bostaWalletBalance))
        : rawUntransferredClaim;
    const walletUntransferredOverlap = round2(
      rawUntransferredClaim - nonOverlappingUntransferred
    );

    const scopedCashoutDeficits = isBrandFiltered
      ? 0
      : isFullTransactionsScope
      ? round2(auditResult.totals.cashoutShortfallAmount)
      : useLinkedTxBridge
      ? round2(
          forensic.cashoutAudits
            .filter(
              c =>
                linkedCashoutIdSet.has((c.cashoutId || '').trim()) &&
                c.verdict === 'short_cashout_deficit'
            )
            .reduce((s, c) => s + Math.abs(c.unexplainedVariance || 0), 0)
        )
      : round2(auditResult.totals.cashoutShortfallAmount);

    const scopedPhantomCashouts = isBrandFiltered
      ? round2(
          forensic.phantomCashoutOrders
            .filter(
              p =>
                p.brandName &&
                getBrandFamilyMeta(p.brandName).key === filterBrandKey
            )
            .reduce((s, p) => s + Math.max(0, p.sheetNetPayout || 0), 0)
        )
      : round2(auditResult.totals.phantomCashoutAmount);

    // Under-compensated shortfall from Compensations sheet (zero overlap with missingCompensations)
    const underCompensatedShortfall = isBrandFiltered
      ? 0
      : round2(auditResult.totals.underCompensatedShortfallAmount);

    // Deliveries_Export vs Cash Cycles COD shortfall (strictly cod_short / cod_zero, excluding untransferred & shortPaid)
    const deliveriesCyclesShortfall = round2(
      forensic.deliveriesVsCyclesMismatches
        .filter(m => {
          if (m.mismatchKind !== 'cod_short_in_cycles' && m.mismatchKind !== 'cod_zero_in_cycles') {
            return false;
          }
          if (untransferredKeys.has(m.trackingKey) || shortPaidKeys.has(m.trackingKey)) {
            return false;
          }
          if (isBrandFiltered) {
            return Boolean(m.brandName && getBrandFamilyMeta(m.brandName).key === filterBrandKey);
          }
          return true;
        })
        .reduce((s, m) => s + Math.max(0, m.codDifference), 0)
    );

    // Store orders marked Delivered that never appeared in ANY uploaded Bosta sheet
    const uncollectedDelivered = isBrandFiltered
      ? 0
      : round2(auditResult.totals.uncollectedDeliveredAmount);

    // Unpaid FlexShip & Untransferred Online/Deposit orders (strictly excluding untransferred & shortPaid)
    const onlineAndFlexUnpaid = round2(
      auditResult.onlineAndFlexAlerts
        .filter(o => {
          if (o.statusFlag !== 'unpaid_flex' && o.statusFlag !== 'untransferred_online') {
            return false;
          }
          if (untransferredKeys.has(o.trackingKey) || shortPaidKeys.has(o.trackingKey)) {
            return false;
          }
          if (isBrandFiltered) {
            return Boolean(o.brandName && getBrandFamilyMeta(o.brandName).key === filterBrandKey);
          }
          return true;
        })
        .reduce((s, o) => {
          if (o.statusFlag === 'untransferred_online') {
            return s + Math.max(0, (o.onlinePaymentAmount || 0) + (o.depositAmount || 0));
          }
          return s + Math.max(0, o.flexShipValue || o.flexShipFees || 0);
        }, 0)
    );

    const claimsBreakdown = {
      untransferredRaw: rawUntransferredClaim,
      untransferred: nonOverlappingUntransferred,
      walletUntransferredOverlap,
      shortPaid: round2(auditResult.totals.shortPaidDeficitAmount),
      cashoutDeficits: scopedCashoutDeficits,
      phantomCashouts: scopedPhantomCashouts,
      bankMissingOrShort: scopedBankMissingOrShort,
      deliveriesCyclesShortfall,
      feeOvercharges: dedupedFeeOvercharges,
      missingCompensations: isBrandFiltered
        ? 0
        : round2(auditResult.totals.missingCompensationsAmount),
      underCompensatedShortfall,
      uncollectedDelivered,
      onlineAndFlexUnpaid
    };
    const totalOwedClaims = round2(
      claimsBreakdown.untransferred +
        claimsBreakdown.shortPaid +
        claimsBreakdown.cashoutDeficits +
        claimsBreakdown.phantomCashouts +
        claimsBreakdown.bankMissingOrShort +
        claimsBreakdown.deliveriesCyclesShortfall +
        claimsBreakdown.feeOvercharges +
        claimsBreakdown.missingCompensations +
        claimsBreakdown.underCompensatedShortfall +
        claimsBreakdown.uncollectedDelivered +
        claimsBreakdown.onlineAndFlexUnpaid
    );

    // Pocket 4: In-transit COD + Stuck Returns at Bosta hubs
    const inTransitAndStuckTotal = round2(inTransitCodValue + stuckReturnsValue);

    // Fix 4A: Auto COGS from matched store orders + catalog fallback by package description
    let autoCogsFromOrders = 0;
    let autoCogsOrdersCount = 0;
    let autoCogsCatalogCount = 0;
    deliveredRows.forEach(r => {
      const resolved = resolveRowAutoCogs(r);
      if (resolved.cost > 0) {
        autoCogsFromOrders += resolved.cost;
        if (resolved.source === 'order') autoCogsOrdersCount += 1;
        else if (resolved.source === 'catalog') autoCogsCatalogCount += 1;
      }
    });
    autoCogsFromOrders = round2(autoCogsFromOrders);

    // Fix 4B: Complete Store Wallet Outflows (Operating/Supply Expenses + Suppliers + Withdrawals, ignoring cancelled & deposits)
    const customExpenseCats = new Set(settings?.expenseCategories || []);
    let storeOperatingExpenses = 0;
    let storeSupplierPayments = 0;
    let storeWithdrawals = 0;
    let storeOutflowsCount = 0;
    if (storeWallet?.transactions?.length) {
      storeWallet.transactions.forEach(t => {
        if (t.status === 'cancelled') return;
        if (t.type !== 'سحب') return;
        const cat = String(t.category || '');
        const amt = Math.abs(Number(t.amount) || 0);
        if (amt <= 0) return;

        if (
          cat.startsWith('expense_') ||
          cat.startsWith('supply_expense_') ||
          customExpenseCats.has(cat)
        ) {
          storeOperatingExpenses += amt;
          storeOutflowsCount += 1;
        } else if (STORE_SUPPLIER_CATS.has(cat)) {
          storeSupplierPayments += amt;
          storeOutflowsCount += 1;
        } else if (STORE_WITHDRAWAL_CATS.has(cat)) {
          storeWithdrawals += amt;
          storeOutflowsCount += 1;
        }
      });
    }
    storeOperatingExpenses = round2(storeOperatingExpenses);
    storeSupplierPayments = round2(storeSupplierPayments);
    storeWithdrawals = round2(storeWithdrawals);
    const storeRecordedOutflowsTotal = round2(
      storeOperatingExpenses + storeSupplierPayments + storeWithdrawals
    );

    // Filter manual ledger entries if brand filter is active
    const scopedLedgerEntries = isBrandFiltered
      ? ledgerEntries.filter(
          e => e.brandName && getBrandFamilyMeta(e.brandName).key === filterBrandKey
        )
      : ledgerEntries;

    let ledgerGoodsCost = 0;
    let ledgerAds = 0;
    let ledgerOperating = 0;
    let ledgerSuppliers = 0;
    let ledgerWithdrawals = 0;
    let ledgerInflows = 0;

    scopedLedgerEntries.forEach(e => {
      const amt = Math.abs(Number(e.amount) || 0);
      if (e.direction === 'in') {
        ledgerInflows += amt;
        return;
      }
      if (e.kind === 'goods_cost') ledgerGoodsCost += amt;
      else if (e.kind === 'ads') ledgerAds += amt;
      else if (e.kind === 'operating_expense') ledgerOperating += amt;
      else if (e.kind === 'supplier_payment') ledgerSuppliers += amt;
      else ledgerWithdrawals += amt;
    });

    ledgerGoodsCost = round2(ledgerGoodsCost);
    ledgerAds = round2(ledgerAds);
    ledgerOperating = round2(ledgerOperating);
    ledgerSuppliers = round2(ledgerSuppliers);
    ledgerWithdrawals = round2(ledgerWithdrawals);
    ledgerInflows = round2(ledgerInflows);

    const activeAutoCogs = costConfig.useAutoCogsFromOrders ? autoCogsFromOrders : 0;
    const includeStoreWallet = !isBrandFiltered && costConfig.includeStoreExpensesFromWallet;
    const activeStoreOperatingExpenses = includeStoreWallet ? storeOperatingExpenses : 0;
    const activeStoreSuppliers = includeStoreWallet ? storeSupplierPayments : 0;
    const activeStoreWithdrawals = includeStoreWallet ? storeWithdrawals : 0;
    const activeTreasuryInclusion =
      !isBrandFiltered && costConfig.includeTreasuryBalances ? treasuryTotalBalance : 0;

    const totalGoodsCost = round2(activeAutoCogs + ledgerGoodsCost);
    const totalExpenses = round2(ledgerAds + ledgerOperating + activeStoreOperatingExpenses);
    const totalPayoutsAndWithdrawals = round2(
      ledgerSuppliers + ledgerWithdrawals + activeStoreSuppliers + activeStoreWithdrawals
    );
    const totalAllOutflows = round2(totalGoodsCost + totalExpenses + totalPayoutsAndWithdrawals);

    // Waybill <-> Delivery Order & Wallet Counterpart Cross-Check Detector
    const walletDepositByOrderId = new Map<string, number>();
    const walletDepositByOrderNum = new Map<string, number>();
    const walletDepositNotes: Array<{ amount: number; noteNorm: string }> = [];
    if (storeWallet?.transactions?.length) {
      storeWallet.transactions.forEach(t => {
        if (t.status === 'cancelled' || t.type !== 'إيداع') return;
        const amt = Math.abs(Number(t.amount) || 0);
        if (amt <= 0) return;
        if (t.orderId) {
          walletDepositByOrderId.set(
            t.orderId,
            round2((walletDepositByOrderId.get(t.orderId) || 0) + amt)
          );
        }
        if (t.orderNumber) {
          const normNum = normalizeMatchText(t.orderNumber);
          if (normNum) {
            walletDepositByOrderNum.set(
              normNum,
              round2((walletDepositByOrderNum.get(normNum) || 0) + amt)
            );
          }
        }
        const noteNorm = normalizeMatchText(t.note);
        if (noteNorm) {
          walletDepositNotes.push({ amount: amt, noteNorm });
        }
      });
    }

    const txCashoutIdSet = new Set(
      allPositiveTxCashouts.map(e => (e.cashoutId || '').trim()).filter(id => id && id !== '-')
    );
    const phantomTrackingKeys = new Set(
      forensic.phantomCashoutOrders.map(p => p.trackingKey).filter(Boolean)
    );
    const dvcShortfallByKey = new Map<
      string,
      TwoWayCodAuditResult['cashoutForensicSummary']['deliveriesVsCyclesMismatches'][number]
    >();
    forensic.deliveriesVsCyclesMismatches.forEach(m => {
      if (
        (m.mismatchKind === 'cod_short_in_cycles' || m.mismatchKind === 'cod_zero_in_cycles') &&
        m.codDifference > 1
      ) {
        dvcShortfallByKey.set(m.trackingKey, m);
      }
    });

    const waybillWalletAlerts: WaybillWalletAlert[] = [];
    const seenAlertKeys = new Set<string>();

    const lookupStoreWalletDeposit = (
      orderId?: string,
      orderNum?: string,
      tracking?: string,
      cashoutId?: string
    ): number => {
      if (orderId && walletDepositByOrderId.has(orderId)) {
        return walletDepositByOrderId.get(orderId) || 0;
      }
      const normOrd = normalizeMatchText(orderNum);
      if (normOrd && walletDepositByOrderNum.has(normOrd)) {
        return walletDepositByOrderNum.get(normOrd) || 0;
      }
      const normTrack = normalizeMatchText(tracking);
      if (normTrack.length >= 5) {
        const hit = walletDepositNotes.find(n => n.noteNorm.includes(normTrack));
        if (hit) return hit.amount;
      }
      const normCid = normalizeMatchText(cashoutId);
      if (normCid.length >= 5) {
        const hit = walletDepositNotes.find(n => n.noteNorm.includes(normCid));
        if (hit) return hit.amount;
      }
      return 0;
    };

    deliveredRows.forEach(r => {
      const tracking = (r.trackingKey || '').trim() || '-';
      const orderNum = r.matchedOrder?.orderNumber || r.businessRefKey || '';
      const brandName = getBrandFamilyMeta(r.brandName || '').label || r.brandName || 'بدون براند';
      const cid = (r.sheetCashoutId || '').trim();
      const hasValidCid = Boolean(cid && cid !== '-');
      const appliedEst = deductEstShipping ? getRowEstimatedShipping(r) : 0;
      const effNet = round2(r.sheetNetPayout - appliedEst);
      const linkedToOrder = isRowLinkedToDeliveryOrder(r);

      const storeDepositAmt = lookupStoreWalletDeposit(
        r.matchedOrder?.id,
        orderNum,
        tracking,
        hasValidCid ? cid : ''
      );
      const inTxLedger = hasValidCid && txCashoutIdSet.has(cid);
      const inSavedBatch =
        Boolean(r.expectation?.isAlreadySettled) ||
        Boolean(r.matchedOrder && settledOrderIds.has(r.matchedOrder.id)) ||
        (hasValidCid && settledBatchNumbers.has(cid));
      const inBankConfirm = hasValidCid && Boolean(bankConfirmedCashouts[cid]);
      const isPhantom = phantomTrackingKeys.has(r.trackingKey);
      const hasWalletCounterpart = storeDepositAmt > 0 || inTxLedger || inSavedBatch || inBankConfirm;

      // Alert 1: Shipping waybill marked paid/settled in sheet, but NOT linked to a delivery order
      if (r.category !== 'collected_untransferred' && !linkedToOrder) {
        const alertKey = `unlinked:${r.trackingKey || r.id}`;
        if (!seenAlertKeys.has(alertKey)) {
          seenAlertKeys.add(alertKey);
          const expectedAmt = Math.max(0, effNet > 0 ? effNet : r.sheetGrossAmount);
          waybillWalletAlerts.push({
            id: alertKey,
            kind: 'unlinked_to_order',
            trackingNumber: tracking,
            orderNumber: orderNum || 'غير مرتبط بطلب',
            brandName,
            expectedAmount: expectedAmt,
            recordedWalletAmount: storeDepositAmt,
            differenceAmount: expectedAmt,
            cashoutId: hasValidCid ? cid : '-',
            reason:
              'بوليصة شحن غير مرتبطة بطلب توصيل فعلي — تم إيقاف احتساب مبلغها كـ «محوّل» في المحفظة لحين ربطها بالطلب',
            targetTab: 'not_found'
          });
        }
      }

      // Alert 2: Shipping waybill without ANY matching financial counterpart in wallet records
      let flaggedMissingCounterpart = false;
      if (r.category === 'collected_untransferred' && !hasWalletCounterpart) {
        const alertKey = `no_counterpart:${r.trackingKey || r.id}`;
        if (!seenAlertKeys.has(alertKey)) {
          seenAlertKeys.add(alertKey);
          flaggedMissingCounterpart = true;
          const expectedAmt = Math.max(0, effNet > 0 ? effNet : r.sheetGrossAmount);
          waybillWalletAlerts.push({
            id: alertKey,
            kind: 'no_wallet_counterpart',
            trackingNumber: tracking,
            orderNumber: orderNum || 'غير مرتبط بطلب',
            brandName,
            expectedAmount: expectedAmt,
            recordedWalletAmount: 0,
            differenceAmount: expectedAmt,
            cashoutId: '-',
            reason:
              'بوليصة مسلّمة بدون تحويل (بلا Cash-out ID) ولا يوجد لها مقابل مالي مسجّل في سجلات المحفظة',
            targetTab: 'untransferred'
          });
        }
      } else if (isPhantom && storeDepositAmt <= 0) {
        const alertKey = `no_counterpart:${r.trackingKey || r.id}`;
        if (!seenAlertKeys.has(alertKey)) {
          seenAlertKeys.add(alertKey);
          flaggedMissingCounterpart = true;
          const expectedAmt = Math.max(0, effNet > 0 ? effNet : r.sheetGrossAmount);
          waybillWalletAlerts.push({
            id: alertKey,
            kind: 'no_wallet_counterpart',
            trackingNumber: tracking,
            orderNumber: orderNum || 'غير مرتبط بطلب',
            brandName,
            expectedAmount: expectedAmt,
            recordedWalletAmount: 0,
            differenceAmount: expectedAmt,
            cashoutId: hasValidCid ? cid : '-',
            reason: `كود الدفعة (${cid}) غير موجود في كشف Transactions ولا يوجد مقابل مالي مطابق بالمحفظة`,
            targetTab: 'cashout_audit'
          });
        }
      } else if (
        r.category !== 'collected_untransferred' &&
        effNet > 0 &&
        !hasWalletCounterpart
      ) {
        const alertKey = `no_counterpart:${r.trackingKey || r.id}`;
        if (!seenAlertKeys.has(alertKey)) {
          seenAlertKeys.add(alertKey);
          flaggedMissingCounterpart = true;
          waybillWalletAlerts.push({
            id: alertKey,
            kind: 'no_wallet_counterpart',
            trackingNumber: tracking,
            orderNumber: orderNum || 'غير مرتبط بطلب',
            brandName,
            expectedAmount: effNet,
            recordedWalletAmount: 0,
            differenceAmount: effNet,
            cashoutId: hasValidCid ? cid : '-',
            reason: tx.hasTransactionsSheet
              ? 'بوليصة مسلّمة بالشيت بدون دفعة مطابقة في كشف Transactions أو سجل إيداعات المحفظة أو الدفعات المعتمدة'
              : 'بوليصة مسلّمة بالشيت بدون مقابل مالي مطابق في سجل إيداعات المحفظة أو الدفعات المعتمدة',
            targetTab: tx.hasTransactionsSheet ? 'transactions_ledger' : 'cashout_audit'
          });
        }
      }

      // Alert 3: Financial counterpart exists but amount does not match expected waybill value
      if (!flaggedMissingCounterpart) {
        if (r.category === 'short_paid') {
          const expectedAmt = round2(
            r.expectation?.expectedNetPayout || r.expectation?.expectedGrossCod || r.sheetGrossAmount
          );
          const recordedAmt = round2(Math.max(0, effNet));
          const diffAmt = round2(Math.max(0, expectedAmt - recordedAmt));
          if (diffAmt > 1) {
            const alertKey = `mismatch:${r.trackingKey || r.id}`;
            if (!seenAlertKeys.has(alertKey)) {
              seenAlertKeys.add(alertKey);
              waybillWalletAlerts.push({
                id: alertKey,
                kind: 'amount_mismatch',
                trackingNumber: tracking,
                orderNumber: orderNum || '-',
                brandName,
                expectedAmount: expectedAmt,
                recordedWalletAmount: recordedAmt,
                differenceAmount: diffAmt,
                cashoutId: hasValidCid ? cid : '-',
                reason: `عجز في القيمة المحصّلة/المحوّلة عن قيمة طلب التوصيل بفارق ${formatEgp(diffAmt)}`,
                targetTab: 'discrepancy'
              });
            }
          }
        } else if (dvcShortfallByKey.has(r.trackingKey)) {
          const mm = dvcShortfallByKey.get(r.trackingKey)!;
          const alertKey = `mismatch:${r.trackingKey || r.id}`;
          if (!seenAlertKeys.has(alertKey)) {
            seenAlertKeys.add(alertKey);
            waybillWalletAlerts.push({
              id: alertKey,
              kind: 'amount_mismatch',
              trackingNumber: tracking,
              orderNumber: orderNum || '-',
              brandName,
              expectedAmount: round2(mm.deliveriesCod),
              recordedWalletAmount: round2(mm.cyclesCod),
              differenceAmount: round2(mm.codDifference),
              cashoutId: hasValidCid ? cid : '-',
              reason: `تضارب قيمة التحصيل بين Deliveries_Export و Cash Cycles بفارق ${formatEgp(mm.codDifference)}`,
              targetTab: 'cashout_audit'
            });
          }
        } else if (
          storeDepositAmt > 0 &&
          effNet > 0 &&
          Math.abs(storeDepositAmt - effNet) > 5 &&
          !inTxLedger &&
          !inSavedBatch
        ) {
          const diffAmt = round2(Math.abs(effNet - storeDepositAmt));
          const alertKey = `mismatch:${r.trackingKey || r.id}`;
          if (!seenAlertKeys.has(alertKey)) {
            seenAlertKeys.add(alertKey);
            waybillWalletAlerts.push({
              id: alertKey,
              kind: 'amount_mismatch',
              trackingNumber: tracking,
              orderNumber: orderNum || '-',
              brandName,
              expectedAmount: effNet,
              recordedWalletAmount: storeDepositAmt,
              differenceAmount: diffAmt,
              cashoutId: hasValidCid ? cid : '-',
              reason: `المقابل المالي المسجّل بمحفظة المتجر (${formatEgp(storeDepositAmt)}) لا يطابق صافي البوليصة (${formatEgp(effNet)})`,
              targetTab: 'discrepancy'
            });
          }
        }
      }
    });

    // Also audit delivered store orders with waybills that never appeared in ANY Bosta sheet or wallet deposit
    if (!isBrandFiltered && auditResult.uncollectedDelivered.length > 0) {
      auditResult.uncollectedDelivered.forEach(u => {
        const tracking = (u.order.waybillNumber || '').trim();
        if (!tracking) return;
        const storeDepositAmt = lookupStoreWalletDeposit(
          u.order.id,
          u.order.orderNumber,
          tracking,
          ''
        );
        if (storeDepositAmt > 0 || settledOrderIds.has(u.order.id)) return;
        const alertKey = `uncollected:${tracking}`;
        if (seenAlertKeys.has(alertKey)) return;
        seenAlertKeys.add(alertKey);
        const expectedAmt = round2(
          u.expectation.expectedNetPayout > 0
            ? u.expectation.expectedNetPayout
            : u.expectation.expectedGrossCod
        );
        waybillWalletAlerts.push({
          id: alertKey,
          kind: 'no_wallet_counterpart',
          trackingNumber: tracking,
          orderNumber: u.order.orderNumber || '-',
          brandName: u.order.shippingCompany || 'طلب بالمتجر',
          expectedAmount: expectedAmt,
          recordedWalletAmount: 0,
          differenceAmount: expectedAmt,
          cashoutId: '-',
          reason:
            'طلب توصيل مسلّم بالمتجر وله بوليصة شحن لكنه غير ظاهر في شيتات بوسطة ولا يوجد له مقابل مالي بالمحفظة',
          targetTab: 'uncollected'
        });
      });
    }

    const waybillAlertsSummary = {
      totalCount: waybillWalletAlerts.length,
      unlinkedCount: waybillWalletAlerts.filter(a => a.kind === 'unlinked_to_order').length,
      unlinkedAmount: round2(
        waybillWalletAlerts
          .filter(a => a.kind === 'unlinked_to_order')
          .reduce((s, a) => s + a.expectedAmount, 0)
      ),
      noCounterpartCount: waybillWalletAlerts.filter(a => a.kind === 'no_wallet_counterpart').length,
      noCounterpartAmount: round2(
        waybillWalletAlerts
          .filter(a => a.kind === 'no_wallet_counterpart')
          .reduce((s, a) => s + a.expectedAmount, 0)
      ),
      mismatchCount: waybillWalletAlerts.filter(a => a.kind === 'amount_mismatch').length,
      mismatchAmount: round2(
        waybillWalletAlerts
          .filter(a => a.kind === 'amount_mismatch')
          .reduce((s, a) => s + a.differenceAmount, 0)
      )
    };

    // Ultimate Number 1: Cash On Hand Now (Strictly counts ONLY delivery-order-linked transferred cash)
    const cashOnHandNow = round2(
      actualCashReceivedFromBosta + activeTreasuryInclusion + ledgerInflows - totalAllOutflows
    );

    // Ultimate Number 2: Projected Total Net Position (identical across verified_only / full_sheets)
    const projectedNetPosition = round2(
      cashOnHandNow +
        pendingReviewExcludedFromCash +
        unlinkedWaybillsHeldAmount +
        insideBostaTotal +
        totalOwedClaims
    );

    const totalCompletedOrders = deliveredRows.length + returnedRows.length;
    const returnRatePct =
      totalCompletedOrders > 0 ? round2((returnedRows.length / totalCompletedOrders) * 100) : 0;
    const grossSalesBase = isFullTransactionsScope
      ? txGrossCollections || deliveredCodTotal
      : deliveredCodTotal;
    const netMarginPct =
      grossSalesBase > 0 ? round2((projectedNetPosition / grossSalesBase) * 100) : 0;

    return {
      calculationMode,
      isVerifiedOnlyMode,
      activeDataScope,
      isFullTransactionsScope,
      canToggleScope,
      isBrandFiltered,
      activeBrandFilterLabel,
      useLinkedTxBridge,
      linkedTxCashoutCount: linkedTxEntries.length,
      linkedTxCashoutTotal,
      linkedCashoutBridge,
      linkedTransferFees,
      linkedPickupFees,
      linkedPackingFees,
      unlinkedHistoricalTxCount,
      unlinkedHistoricalTxTotal,
      totalTxCashoutCount: allPositiveTxCashouts.length,
      deliveredCount: deliveredRows.length,
      returnedCount: returnedRows.length,
      inTransitCount: inTransitRows.length,
      returnRatePct,
      netMarginPct,
      avgCashCycleShipFee,
      deductEstShipping,
      deliveriesOnlyDeliveredCount,
      deliveriesOnlyEstimatedShippingTotal,
      appliedDeliveriesOnlyEstShipping,
      zeroNetReturnFeesCaptured,
      deliveredCodTotal,
      deliveredShippingFees,
      deliveredSheetNetTotal,
      deliveredNetOtherAdj,
      returnedShippingFees,
      ordersSheetNetEarned,
      paidOrdersSheetNet,
      untransferredSheetNet,
      txGrossCollections,
      txFeesCycles,
      bostaExtraDeductions,
      transferFeesTotal,
      pickupFeesTotal,
      packingNet,
      packingRefunds,
      negativeAdjustments,
      positiveAdjustments,
      compensationsReceived,
      bostaPositiveCredits,
      bostaCreditsAvailable,
      netEarnedFromBosta,
      impliedOpeningBostaBalance,
      rawTransferredBeforeLinkGuard,
      unlinkedWaybillsHeldAmount,
      unlinkedWaybillsHeldCount,
      unlinkedCashoutsHeldCount,
      waybillWalletAlerts,
      waybillAlertsSummary,
      transferredFromBosta,
      actualCashReceivedFromBosta,
      verifiedBankAutoAmount,
      verifiedManualOrSettledAmount,
      verifiedTotalCashFromBosta,
      verifiedCashoutCount,
      pendingReviewCashoutsAmount,
      pendingReviewCashoutsCount,
      pendingReviewExcludedFromCash,
      savedBatchesArchiveTotal,
      verifiedInBankAmount,
      hasBankStatement: forensic.hasBankStatementSheet,
      hasTransactionsSheet: tx.hasTransactionsSheet,
      treasuryTotalBalance,
      activeTreasuryInclusion,
      bostaWalletBalance,
      insideBostaTotal,
      claimsBreakdown,
      totalOwedClaims,
      inTransitCodValue,
      stuckReturnsValue,
      inTransitAndStuckTotal,
      autoCogsFromOrders,
      autoCogsOrdersCount,
      autoCogsCatalogCount,
      storeOperatingExpenses,
      storeSupplierPayments,
      storeWithdrawals,
      storeRecordedOutflowsTotal,
      storeOutflowsCount,
      ledgerGoodsCost,
      ledgerAds,
      ledgerOperating,
      ledgerSuppliers,
      ledgerWithdrawals,
      ledgerInflows,
      totalGoodsCost,
      totalExpenses,
      totalPayoutsAndWithdrawals,
      totalAllOutflows,
      cashOnHandNow,
      projectedNetPosition
    };
  }, [
    auditResult,
    sheetBrandFilter,
    settings?.expenseCategories,
    zoneRates?.cairoGizaMax,
    resolveRowAutoCogs,
    treasuryAccounts,
    storeWallet,
    savedBatches,
    bankConfirmedCashouts,
    ledgerEntries,
    costConfig
  ]);

  // 2. Per-Brand Wallet Breakdown (Normalized by Brand Family + Exact Same Shipping, Return & COGS Logic)
  const { brandWallets, brandTotals } = useMemo(() => {
    const map = new Map<
      string,
      {
        brandKey: string;
        brandName: string;
        rawAliases: Set<string>;
        deliveredCount: number;
        deliveriesOnlyCount: number;
        returnedCount: number;
        deliveredCod: number;
        shippingFees: number;
        returnedFees: number;
        sheetNetEarned: number;
        untransferredNet: number;
        autoCogs: number;
        ledgerIn: number;
        ledgerOut: number;
        finalNet: number;
      }
    >();

    const ensureBrand = (raw?: string) => {
      const cleanRaw = (raw || '').trim();
      const bf = getBrandFamilyMeta(cleanRaw);
      const key = bf.key || '__general__';
      const preferredLabel = bf.label || 'عام / بدون براند';
      const existing = map.get(key);
      if (existing) {
        if (cleanRaw) existing.rawAliases.add(cleanRaw);
        if (!existing.brandName.includes('ة') && preferredLabel.includes('ة')) {
          existing.brandName = preferredLabel;
        }
        return existing;
      }
      const created = {
        brandKey: key,
        brandName: preferredLabel,
        rawAliases: new Set<string>(cleanRaw ? [cleanRaw] : []),
        deliveredCount: 0,
        deliveriesOnlyCount: 0,
        returnedCount: 0,
        deliveredCod: 0,
        shippingFees: 0,
        returnedFees: 0,
        sheetNetEarned: 0,
        untransferredNet: 0,
        autoCogs: 0,
        ledgerIn: 0,
        ledgerOut: 0,
        finalNet: 0
      };
      map.set(key, created);
      return created;
    };

    auditResult.sheetRows.forEach(r => {
      if (r.category === 'duplicate' && r.reasonSummary.includes('تم تكرار هذه البوليصة')) return;
      if (r.category === 'in_transit_sheet') return;

      const b = ensureBrand(r.brandName);
      const isReturnRow =
        r.category === 'not_collected_customer' ||
        (r.category === 'duplicate' && r.sheetNetPayout < 0 && r.sheetGrossAmount === 0);

      if (isReturnRow) {
        b.returnedCount += 1;
        const retFee = getReturnDeductedFee(r);
        if (retFee > 0) {
          b.returnedFees += retFee;
          b.sheetNetEarned -= retFee;
        }
      } else {
        b.deliveredCount += 1;
        b.deliveredCod += Math.max(0, r.sheetGrossAmount);

        const isDeliveriesOnly =
          r.fileRole === 'bosta_orders' && r.sheetFeesAmount === 0 && r.sheetGrossAmount > 0;
        let appliedEst = 0;
        if (isDeliveriesOnly) {
          b.deliveriesOnlyCount += 1;
          if (metrics.deductEstShipping) {
            appliedEst =
              r.expectation && r.expectation.expectedCarrierFees > 0
                ? round2(r.expectation.expectedCarrierFees)
                : metrics.avgCashCycleShipFee;
          }
        }

        const effFee = Math.max(0, r.sheetFeesAmount) + appliedEst;
        const effNet = r.sheetNetPayout - appliedEst;

        b.shippingFees += effFee;
        b.sheetNetEarned += effNet;
        if (r.category === 'collected_untransferred') {
          b.untransferredNet += effNet;
        }
        if (costConfig.useAutoCogsFromOrders) {
          const resolved = resolveRowAutoCogs(r);
          if (resolved.cost > 0) b.autoCogs += resolved.cost;
        }
      }
    });

    ledgerEntries.forEach(e => {
      if (!e.brandName && metrics.isBrandFiltered) return;
      const b = ensureBrand(e.brandName);
      const amt = Math.abs(Number(e.amount) || 0);
      if (e.direction === 'in') b.ledgerIn += amt;
      else b.ledgerOut += amt;
    });

    const list = Array.from(map.values())
      .map(b => {
        const deliveredCod = round2(b.deliveredCod);
        const shippingFees = round2(b.shippingFees);
        const returnedFees = round2(b.returnedFees);
        const sheetNetEarned = round2(b.sheetNetEarned);
        const untransferredNet = round2(b.untransferredNet);
        const autoCogs = round2(b.autoCogs);
        const ledgerIn = round2(b.ledgerIn);
        const ledgerOut = round2(b.ledgerOut);
        const finalNet = round2(sheetNetEarned + ledgerIn - autoCogs - ledgerOut);
        return {
          ...b,
          aliasList: Array.from(b.rawAliases),
          deliveredCod,
          shippingFees,
          returnedFees,
          sheetNetEarned,
          untransferredNet,
          autoCogs,
          ledgerIn,
          ledgerOut,
          finalNet
        };
      })
      .filter(b => {
        if (!q) return true;
        return (
          b.brandName.toLowerCase().includes(q) ||
          b.aliasList.some(a => a.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.deliveredCod - a.deliveredCod || b.sheetNetEarned - a.sheetNetEarned);

    const totals = list.reduce(
      (acc, b) => ({
        deliveredCount: acc.deliveredCount + b.deliveredCount,
        returnedCount: acc.returnedCount + b.returnedCount,
        deliveredCod: round2(acc.deliveredCod + b.deliveredCod),
        shippingFees: round2(acc.shippingFees + b.shippingFees),
        returnedFees: round2(acc.returnedFees + b.returnedFees),
        sheetNetEarned: round2(acc.sheetNetEarned + b.sheetNetEarned),
        untransferredNet: round2(acc.untransferredNet + b.untransferredNet),
        outflows: round2(acc.outflows + b.autoCogs + b.ledgerOut),
        ledgerIn: round2(acc.ledgerIn + b.ledgerIn),
        finalNet: round2(acc.finalNet + b.finalNet)
      }),
      {
        deliveredCount: 0,
        returnedCount: 0,
        deliveredCod: 0,
        shippingFees: 0,
        returnedFees: 0,
        sheetNetEarned: 0,
        untransferredNet: 0,
        outflows: 0,
        ledgerIn: 0,
        finalNet: 0
      }
    );

    return { brandWallets: list, brandTotals: totals };
  }, [
    auditResult.sheetRows,
    ledgerEntries,
    costConfig.useAutoCogsFromOrders,
    metrics.deductEstShipping,
    metrics.avgCashCycleShipFee,
    metrics.isBrandFiltered,
    resolveRowAutoCogs,
    q
  ]);

  const filteredJournal = useMemo(() => {
    return [...ledgerEntries]
      .filter(e => {
        if (journalFilter !== 'all' && e.direction !== journalFilter) return false;
        if (!q) return true;
        return (
          e.note.toLowerCase().includes(q) ||
          (e.brandName || '').toLowerCase().includes(q) ||
          ENTRY_KIND_META[e.kind].label.toLowerCase().includes(q) ||
          e.date.includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [ledgerEntries, journalFilter, q]);

  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = round2(parseFloat(entryAmount));
    if (!numeric || numeric <= 0) return;
    const meta = ENTRY_KIND_META[entryKind];
    onAddLedgerEntry({
      date: entryDate || new Date().toISOString().slice(0, 10),
      kind: entryKind,
      direction: meta.defaultDirection,
      amount: numeric,
      brandName: entryBrand.trim() || undefined,
      note: entryNote.trim() || meta.label
    });
    setEntryAmount('');
    setEntryNote('');
  };

  const handleExportWalletXlsx = () => {
    const wb = XLSX.utils.book_new();
    const scopeLabel = metrics.isFullTransactionsScope
      ? `كشف Transactions التاريخي بالكامل (${metrics.totalTxCashoutCount} دفعة)`
      : `نطاق الشيتات المرفوعة (${metrics.deliveredCount} مسلّم · ${metrics.returnedCount} مرتجع)`;

    const waterfallRows = metrics.isFullTransactionsScope
      ? [
          { 'البند المالي': '(+) دورات تحصيل الكاش (Transactions Collection Cycles)', 'المبلغ (ج.م)': metrics.txGrossCollections },
          { 'البند المالي': '(-) دورات مصاريف الشحن والمرتجعات (Bosta Fees Cycles)', 'المبلغ (ج.م)': -metrics.txFeesCycles },
          { 'البند المالي': '(-) رسوم التحويل + البيك أب + التغليف والتسويات السالبة', 'المبلغ (ج.م)': -metrics.bostaExtraDeductions },
          { 'البند المالي': '(+) التعويضات والتسويات الموجبة واسترداد التغليف', 'المبلغ (ج.م)': metrics.bostaPositiveCredits },
          { 'البند المالي': '(=) صافي أرباح التشغيل بكشف حساب بوسطة', 'المبلغ (ج.م)': metrics.netEarnedFromBosta },
          ...(Math.abs(metrics.impliedOpeningBostaBalance) >= 1
            ? [{ 'البند المالي': 'رصيد مرحّل بمحفظة بوسطة قبل بداية الكشف', 'المبلغ (ج.م)': metrics.impliedOpeningBostaBalance }]
            : []),
          { 'البند المالي': '(-) المتبقي حالياً داخل محفظة بوسطة (لم يُحوّل بعد)', 'المبلغ (ج.م)': -metrics.bostaWalletBalance },
          ...(metrics.unlinkedWaybillsHeldAmount > 0
            ? [
                {
                  'البند المالي': '(-) مبالغ موقوفة لعدم ارتباط البوليصة/الدفعة بطلب توصيل فعلي',
                  'المبلغ (ج.م)': -metrics.unlinkedWaybillsHeldAmount
                }
              ]
            : []),
          { 'البند المالي': '(=) إجمالي المحوّل من بوسطة (مربوط بطلبات توصيل)', 'المبلغ (ج.م)': metrics.transferredFromBosta },
          ...(metrics.claimsBreakdown.bankMissingOrShort > 0
            ? [{ 'البند المالي': '(-) تحويلات لم تصل/ناقصة بكشف البنك (مُرحّلة للمطالبات)', 'المبلغ (ج.م)': -metrics.claimsBreakdown.bankMissingOrShort }]
            : [])
        ]
      : [
          { 'البند المالي': '(+) إجمالي تحصيلات الكاش (Delivered COD)', 'المبلغ (ج.م)': metrics.deliveredCodTotal },
          {
            'البند المالي':
              metrics.appliedDeliveriesOnlyEstShipping > 0
                ? `(-) مصاريف شحن المسلّم (شامل ${metrics.appliedDeliveriesOnlyEstShipping} ج.م شحن تقديري لبوالص Deliveries)`
                : '(-) مصاريف شحن المسلّم',
            'المبلغ (ج.م)': -metrics.deliveredShippingFees
          },
          ...(Math.abs(metrics.deliveredNetOtherAdj) >= 0.5
            ? [{ 'البند المالي': 'تسويات صافي الشيت (خصومات / FlexShip / Credits)', 'المبلغ (ج.م)': metrics.deliveredNetOtherAdj }]
            : []),
          { 'البند المالي': '(-) مصاريف شحن المرتجعات', 'المبلغ (ج.م)': -metrics.returnedShippingFees },
          { 'البند المالي': '(=) صافي بوسطة من الشيتات المرفوعة (يطابق جدول البراندات)', 'المبلغ (ج.م)': metrics.ordersSheetNetEarned },
          ...(metrics.useLinkedTxBridge
            ? Math.abs(metrics.linkedCashoutBridge) >= 0.01
              ? [
                  {
                    'البند المالي':
                      metrics.linkedCashoutBridge < 0
                        ? '(-) رسوم التحويل البنكي والتغليف والبيك أب المرتبطة بهذه الدفعات'
                        : '(+) تعويضات وتسويات موجبة مرتبطة بهذه الدفعات',
                    'المبلغ (ج.م)': metrics.linkedCashoutBridge
                  }
                ]
              : []
            : metrics.compensationsReceived > 0
            ? [{ 'البند المالي': '(+) التعويضات المعتمدة', 'المبلغ (ج.م)': metrics.compensationsReceived }]
            : []),
          { 'البند المالي': '(-) متحصل ولم يُحوّل بعد (بلا Cash-out ID)', 'المبلغ (ج.م)': -metrics.untransferredSheetNet },
          ...(metrics.unlinkedWaybillsHeldAmount > 0
            ? [
                {
                  'البند المالي': '(-) مبالغ موقوفة لعدم ارتباط البوليصة بطلب توصيل فعلي',
                  'المبلغ (ج.م)': -metrics.unlinkedWaybillsHeldAmount
                }
              ]
            : []),
          { 'البند المالي': '(=) إجمالي المحوّل من بوسطة عن البوالص المرتبطة بطلبات', 'المبلغ (ج.م)': metrics.transferredFromBosta },
          ...(metrics.claimsBreakdown.bankMissingOrShort > 0
            ? [{ 'البند المالي': '(-) تحويلات لم تصل/ناقصة بكشف البنك (مُرحّلة للمطالبات)', 'المبلغ (ج.م)': -metrics.claimsBreakdown.bankMissingOrShort }]
            : [])
        ];

    const waterfallSheet = XLSX.utils.json_to_sheet([
      { 'البند المالي': `نطاق البيانات: ${scopeLabel}`, 'المبلغ (ج.م)': '' },
      {
        'البند المالي': `وضع الحساب: ${metrics.isVerifiedOnlyMode ? 'المعتمد والمؤكّد بالبنك فقط' : 'معاينة شاملة لكل الشيتات'}`,
        'المبلغ (ج.م)': ''
      },
      ...waterfallRows,
      ...(metrics.pendingReviewExcludedFromCash !== 0
        ? [
            {
              'البند المالي': '(-) تحويلات تحت المراجعة (لم تُؤكّد بالبنك أو تُعتمد بعد)',
              'المبلغ (ج.م)': -metrics.pendingReviewExcludedFromCash
            }
          ]
        : []),
      {
        'البند المالي': metrics.isVerifiedOnlyMode
          ? '(=) الكاش المؤكّد والمعتمد فعلياً من بوسطة'
          : '(=) الكاش الواصل فعلياً من بوسطة',
        'المبلغ (ج.م)': metrics.actualCashReceivedFromBosta
      },
      ...(metrics.activeTreasuryInclusion !== 0
        ? [{ 'البند المالي': '(+) أرصدة خزائن النظام المضمومة', 'المبلغ (ج.م)': metrics.activeTreasuryInclusion }]
        : []),
      { 'البند المالي': '(+) رصيد افتتاحي وإيداعات إضافية بالدفتر', 'المبلغ (ج.م)': metrics.ledgerInflows },
      { 'البند المالي': '(-) تكلفة البضاعة المباعة (COGS)', 'المبلغ (ج.م)': -metrics.totalGoodsCost },
      { 'البند المالي': '(-) الإعلانات والمصروفات التشغيلية', 'المبلغ (ج.م)': -metrics.totalExpenses },
      { 'البند المالي': '(-) مدفوعات الموردين والمسحوبات', 'المبلغ (ج.م)': -metrics.totalPayoutsAndWithdrawals },
      { 'البند المالي': '(=) السيولة الحاضرة فعلياً الآن (Cash on Hand)', 'المبلغ (ج.م)': metrics.cashOnHandNow },
      ...(metrics.pendingReviewExcludedFromCash !== 0
        ? [
            {
              'البند المالي': '(+) تحويلات تحت المراجعة (عند تأكيد دخولها البنك)',
              'المبلغ (ج.م)': metrics.pendingReviewExcludedFromCash
            }
          ]
        : []),
      ...(metrics.unlinkedWaybillsHeldAmount > 0
        ? [
            {
              'البند المالي': '(+) مبالغ موقوفة لحين ربط البوالص بطلبات التوصيل',
              'المبلغ (ج.م)': metrics.unlinkedWaybillsHeldAmount
            }
          ]
        : []),
      { 'البند المالي': '(+) الرصيد الحالي داخل محفظة بوسطة + Credits', 'المبلغ (ج.م)': metrics.insideBostaTotal },
      { 'البند المالي': '(+) مطالبات: بلا تحويل (بعد استبعاد رصيد المحفظة)', 'المبلغ (ج.م)': metrics.claimsBreakdown.untransferred },
      {
        'البند المالي': '(+) مطالبات: فروقات تحصيل وتطابق (عجز/بنك/دفعات/Deliveries↔Cycles)',
        'المبلغ (ج.م)': round2(
          metrics.claimsBreakdown.shortPaid +
            metrics.claimsBreakdown.cashoutDeficits +
            metrics.claimsBreakdown.phantomCashouts +
            metrics.claimsBreakdown.bankMissingOrShort +
            metrics.claimsBreakdown.deliveriesCyclesShortfall
        )
      },
      {
        'البند المالي': '(+) مطالبات: رسوم زائدة وتعويضات ناقصة ومفقودة',
        'المبلغ (ج.م)': round2(
          metrics.claimsBreakdown.feeOvercharges +
            metrics.claimsBreakdown.missingCompensations +
            metrics.claimsBreakdown.underCompensatedShortfall
        )
      },
      ...(metrics.claimsBreakdown.uncollectedDelivered + metrics.claimsBreakdown.onlineAndFlexUnpaid > 0
        ? [
            {
              'البند المالي': '(+) مطالبات: أوردرات مختفية من الشيتات + أونلاين/FlexShip معلّق',
              'المبلغ (ج.م)': round2(
                metrics.claimsBreakdown.uncollectedDelivered +
                  metrics.claimsBreakdown.onlineAndFlexUnpaid
              )
            }
          ]
        : []),
      { 'البند المالي': '(=) الصافي الإجمالي المتوقع بعد التحصيل', 'المبلغ (ج.م)': metrics.projectedNetPosition }
    ]);
    XLSX.utils.book_append_sheet(wb, waterfallSheet, 'ملخص المحفظة والشلال');

    if (metrics.waybillWalletAlerts.length > 0) {
      const alertsSheet = XLSX.utils.json_to_sheet(
        metrics.waybillWalletAlerts.map(a => ({
          'رقم البوليصة': a.trackingNumber,
          'طلب التوصيل': a.orderNumber,
          'البراند': a.brandName,
          'نوع التنبيه':
            a.kind === 'unlinked_to_order'
              ? 'غير مرتبط بطلب توصيل'
              : a.kind === 'no_wallet_counterpart'
              ? 'بدون مقابل مالي بالمحفظة'
              : 'فارق مبلغ مع المحفظة',
          'القيمة المتوقعة (ج.م)': a.expectedAmount,
          'المسجّل بالمحفظة (ج.م)': a.recordedWalletAmount,
          'الفارق (ج.م)': a.differenceAmount,
          'كود الدفعة': a.cashoutId,
          'السبب': a.reason
        }))
      );
      XLSX.utils.book_append_sheet(wb, alertsSheet, 'تنبيهات البوالص والمحفظة');
    }

    if (brandWallets.length > 0) {
      const brandSheet = XLSX.utils.json_to_sheet(
        brandWallets.map(b => ({
          'البراند (موحد)': b.brandName,
          'المسميات المدمجة': b.aliasList.join(' / '),
          'عدد المسلّم': b.deliveredCount,
          'إجمالي COD المسلّم': b.deliveredCod,
          'عدد المرتجع': b.returnedCount,
          'مصاريف الشحن': b.shippingFees,
          'مصاريف المرتجعات': b.returnedFees,
          'صافي مستحق من بوسطة': b.sheetNetEarned,
          'متحصل ولم يُحوّل': b.untransferredNet,
          'تكلفة البضاعة': b.autoCogs,
          'مصاريف ومسحوبات البراند': b.ledgerOut,
          'إيداعات البراند': b.ledgerIn,
          'صافي البراند النهائي': b.finalNet
        }))
      );
      XLSX.utils.book_append_sheet(wb, brandSheet, 'محفظة كل براند');
    }

    if (ledgerEntries.length > 0) {
      const journalSheet = XLSX.utils.json_to_sheet(
        ledgerEntries.map(e => ({
          'التاريخ': e.date,
          'التصنيف': ENTRY_KIND_META[e.kind].label,
          'الاتجاه': e.direction === 'in' ? 'وارد (+)' : 'صادر (-)',
          'المبلغ (ج.م)': e.amount,
          'البراند': e.brandName || 'عام',
          'البيان': e.note
        }))
      );
      XLSX.utils.book_append_sheet(wb, journalSheet, 'دفتر حركات المحفظة');
    }

    const safeName = (storeName || 'store').replace(/[^\w\u0600-\u06FF-]/g, '_');
    XLSX.writeFile(wb, `محفظة_الصافي_المالي_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const claimsDiffsGroup = round2(
    metrics.claimsBreakdown.shortPaid +
      metrics.claimsBreakdown.cashoutDeficits +
      metrics.claimsBreakdown.phantomCashouts +
      metrics.claimsBreakdown.bankMissingOrShort +
      metrics.claimsBreakdown.deliveriesCyclesShortfall
  );
  const claimsFeesCompGroup = round2(
    metrics.claimsBreakdown.feeOvercharges +
      metrics.claimsBreakdown.missingCompensations +
      metrics.claimsBreakdown.underCompensatedShortfall
  );
  const claimsOtherGroup = round2(
    metrics.claimsBreakdown.uncollectedDelivered + metrics.claimsBreakdown.onlineAndFlexUnpaid
  );

  return (
    <div className="p-4 sm:p-5 space-y-6">
      {/* FOCAL ANCHOR: Brand Forest Green (#062d24) Executive Net Position Banner */}
      <div className="rounded-2xl bg-[#062d24] dark:bg-[#041d18] text-white border border-[#0b3f33] p-5 sm:p-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="text-xs font-bold text-[#00ab84] flex items-center gap-2">
              <WalletIcon className="w-4 h-4 shrink-0" />
              <span>
                محفظة الصافي والموقف المالي الشامل — {storeName}
                {metrics.isBrandFiltered ? ` · فلتر: ${metrics.activeBrandFilterLabel}` : ''}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              الخلاصة النهائية بعد التحصيلات، المرتجعات، المصاريف والمسحوبات
            </h2>
            <p className="text-xs text-emerald-100/80 flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 tabular-nums">
              <span>
                نطاق الحساب:{' '}
                <strong className="text-white">
                  {metrics.isFullTransactionsScope
                    ? `كشف Transactions التاريخي بالكامل (${metrics.totalTxCashoutCount} دفعة)`
                    : metrics.useLinkedTxBridge
                    ? `الشيتات المرفوعة ومطابقة تحويلاتها (${metrics.linkedTxCashoutCount} دفعة)`
                    : 'شيتات دورات التحصيل والأوردرات'}
                </strong>
              </span>
              {!metrics.isFullTransactionsScope && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{metrics.deliveredCount.toLocaleString('en-US')} شحنة مسلّمة</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {metrics.returnedCount.toLocaleString('en-US')} مرتجع ({metrics.returnRatePct}%)
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                {metrics.totalAllOutflows > 0
                  ? `هامش الصافي النهائي: ${metrics.netMarginPct}%`
                  : `صافي بعد الشحن: ${metrics.netMarginPct}% (قبل تكلفة البضاعة والمصاريف)`}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Scope Switch */}
            {metrics.canToggleScope && (
              <div className="inline-flex items-center p-1 rounded-xl bg-white/10 border border-white/15">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCostConfig({ ...costConfig, dataScope: 'orders_period' })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                    !metrics.isFullTransactionsScope
                      ? 'bg-[#00ab84] text-white'
                      : 'text-emerald-100/80 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span>نطاق الشيتات ({metrics.deliveredCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCostConfig({ ...costConfig, dataScope: 'full_transactions' })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                    metrics.isFullTransactionsScope
                      ? 'bg-white text-[#062d24]'
                      : 'text-emerald-100/80 hover:text-white'
                  }`}
                >
                  <ReceiptText className="w-3.5 h-3.5 shrink-0" />
                  <span>Transactions بالكامل ({metrics.totalTxCashoutCount})</span>
                </button>
              </div>
            )}

            {/* Dual-Mode Verification Switch */}
            <div className="inline-flex items-center p-1 rounded-xl bg-white/10 border border-white/15">
              <button
                type="button"
                onClick={() =>
                  onUpdateCostConfig({ ...costConfig, calculationMode: 'verified_only' })
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                  metrics.isVerifiedOnlyMode
                    ? 'bg-[#00ab84] text-white'
                    : 'text-emerald-100/80 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>المؤكّد فقط</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateCostConfig({ ...costConfig, calculationMode: 'full_sheets' })
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                  !metrics.isVerifiedOnlyMode
                    ? 'bg-white text-[#062d24]'
                    : 'text-emerald-100/80 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>معاينة الكل</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportWalletXlsx}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير XLSX</span>
            </button>
          </div>
        </div>

        {/* Two Primary Bottom-Line Numbers */}
        <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="text-xs font-bold text-emerald-100/80 mb-1.5">
              {metrics.isVerifiedOnlyMode
                ? 'السيولة المؤكّدة والحاضرة فعلياً الآن (المؤكّد بالبنك/المعتمد + الإيداعات − المصاريف)'
                : 'السيولة الحاضرة حسب الشيتات (إجمالي التحويلات + الإيداعات − المصاريف)'}
            </div>
            <div
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                metrics.cashOnHandNow >= 0 ? 'text-[#00ab84]' : 'text-rose-400'
              }`}
            >
              <EgpHero
                value={metrics.cashOnHandNow}
                unitClassName="text-lg sm:text-xl font-bold opacity-80"
              />
            </div>
            <div className="mt-2 text-[11px] text-emerald-100/70 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>
                {metrics.isVerifiedOnlyMode ? 'كاش مؤكّد/معتمد:' : 'واصل من بوسطة:'}{' '}
                {formatEgp(metrics.actualCashReceivedFromBosta)}
              </span>
              {metrics.activeTreasuryInclusion !== 0 && (
                <>
                  <span>·</span>
                  <span>خزائن النظام: +{formatEgp(metrics.activeTreasuryInclusion)}</span>
                </>
              )}
              {metrics.ledgerInflows > 0 && (
                <>
                  <span>·</span>
                  <span>إيداعات الدفتر: +{formatEgp(metrics.ledgerInflows)}</span>
                </>
              )}
              {metrics.totalAllOutflows > 0 ? (
                <>
                  <span>·</span>
                  <span>مصروفات ومسحوبات: −{formatEgp(metrics.totalAllOutflows)}</span>
                </>
              ) : (
                <>
                  <span>·</span>
                  <span className="text-emerald-200/60">لم تُخصم تكلفة بضاعة أو إعلانات بعد</span>
                </>
              )}
            </div>
          </div>

          <div className="md:border-r md:border-white/10 md:pr-5">
            <div className="text-xs font-bold text-emerald-100/80 mb-1.5">
              {metrics.isFullTransactionsScope
                ? 'الصافي الإجمالي المتوقع (بكامل تاريخ كشف Transactions + الرصيد والمطالبات)'
                : 'الصافي النهائي المتوقع عن الشيتات المرفوعة (الحاضر + رصيد بوسطة + المطالبات)'}
            </div>
            <div
              className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                metrics.projectedNetPosition >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              <EgpHero
                value={metrics.projectedNetPosition}
                unitClassName="text-lg sm:text-xl font-bold text-emerald-100/75"
              />
            </div>
            <div className="mt-2 text-[11px] text-emerald-100/70 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {metrics.pendingReviewExcludedFromCash !== 0 && (
                <>
                  <span className="text-amber-300 font-bold">
                    تحت مراجعة البنك: +{formatEgp(metrics.pendingReviewExcludedFromCash)}
                  </span>
                  <span>·</span>
                </>
              )}
              {metrics.unlinkedWaybillsHeldAmount > 0 && (
                <>
                  <span className="text-amber-300 font-bold">
                    موقوف لعدم الربط بطلب: +{formatEgp(metrics.unlinkedWaybillsHeldAmount)}
                  </span>
                  <span>·</span>
                </>
              )}
              {!metrics.isBrandFiltered && (
                <>
                  <span>رصيد داخل بوسطة: +{formatEgp(metrics.insideBostaTotal)}</span>
                  <span>·</span>
                </>
              )}
              <span>مطالبات صافية (بلا تكرار): +{formatEgp(metrics.totalOwedClaims)}</span>
              {metrics.inTransitAndStuckTotal > 0 && (
                <>
                  <span>·</span>
                  <span>(غير شامل {formatEgp(metrics.inTransitAndStuckTotal)} بضاعة في الطريق)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Historical Transactions Info Strip */}
        {!metrics.isFullTransactionsScope &&
          !metrics.isBrandFiltered &&
          metrics.unlinkedHistoricalTxCount > 0 && (
            <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start sm:items-center gap-2 text-emerald-100/85">
                <Info className="w-4 h-4 text-[#00ab84] shrink-0 mt-0.5 sm:mt-0" />
                <span className="tabular-nums">
                  الأرقام بالأعلى مطابقة 100% للـ{' '}
                  <strong className="text-white">{metrics.deliveredCount} شحنة</strong> المرفوعة وجدول البراندات بالأسفل — ويوجد{' '}
                  <strong className="text-white">{metrics.unlinkedHistoricalTxCount} دفعة أقدم</strong>{' '}
                  في شيت Transactions بإجمالي{' '}
                  <strong className="text-[#00ab84]">
                    {formatEgp(metrics.unlinkedHistoricalTxTotal)}
                  </strong>{' '}
                  خارج فترة شيتات الدورات الحالية.
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateCostConfig({ ...costConfig, dataScope: 'full_transactions' })
                }
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                عرض تاريخ Transactions بالكامل
              </button>
            </div>
          )}

        {/* Strict Delivery-Order Linkage Guard Strip */}
        {metrics.unlinkedWaybillsHeldAmount > 0 && (
          <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-2 text-amber-200/95">
              <Link2Off className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
              <span className="tabular-nums">
                تم إيقاف احتساب{' '}
                <strong className="text-amber-300">
                  {formatEgp(metrics.unlinkedWaybillsHeldAmount)}
                </strong>{' '}
                كـ «محوّل» (
                {metrics.unlinkedWaybillsHeldCount > 0
                  ? `${metrics.unlinkedWaybillsHeldCount} بوليصة غير مرتبطة بطلب توصيل`
                  : ''}
                {metrics.unlinkedWaybillsHeldCount > 0 && metrics.unlinkedCashoutsHeldCount > 0
                  ? ' · '
                  : ''}
                {metrics.unlinkedCashoutsHeldCount > 0
                  ? `${metrics.unlinkedCashoutsHeldCount} دفعة بدون بوالص مربوطة بطلبات`
                  : ''}
                ) — لا يُحتسب المبلغ محوّلاً إلا بعد ربط بوليصة الشحن بطلب التوصيل الفعلي.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setWaybillAlertFilter('unlinked_to_order');
                  setShowWaybillAlerts(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/30 text-amber-100 font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                عرض البوالص غير المرتبطة
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('not_found')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                ربط البوالص بالطلبات
              </button>
            </div>
          </div>
        )}

        {/* Pending Review Action Strip */}
        {metrics.isVerifiedOnlyMode && metrics.pendingReviewCashoutsAmount > 0 && (
          <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-2 text-amber-200/95">
              <Clock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
              <span className="tabular-nums">
                يوجد <strong className="text-white">{metrics.pendingReviewCashoutsCount}</strong>{' '}
                {metrics.isFullTransactionsScope || metrics.useLinkedTxBridge
                  ? 'دفعة تحويل'
                  : 'بوليصة'}{' '}
                بإجمالي{' '}
                <strong className="text-amber-300">
                  {formatEgp(metrics.pendingReviewCashoutsAmount)}
                </strong>{' '}
                لم يتم تأكيد دخولها البنك أو اعتمادها بعد — مستبعدة من السيولة الحاضرة لحين مراجعتها.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onNavigateTab(
                    metrics.hasTransactionsSheet ? 'transactions_ledger' : 'cashout_audit'
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-[#00ab84] hover:bg-[#009472] text-white font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                مراجعة وتأكيد الدفعات
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateCostConfig({ ...costConfig, calculationMode: 'full_sheets' })
                }
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                عرض معاينة الكل
              </button>
            </div>
          </div>
        )}
      </div>

      {/* WAYBILL <-> DELIVERY ORDER & WALLET COUNTERPART ALERT CARD */}
      {(metrics.waybillWalletAlerts.length > 0 || metrics.unlinkedWaybillsHeldAmount > 0) && (() => {
        const filteredAlerts = metrics.waybillWalletAlerts.filter(a => {
          if (waybillAlertFilter !== 'all' && a.kind !== waybillAlertFilter) return false;
          if (!q) return true;
          return (
            a.trackingNumber.toLowerCase().includes(q) ||
            a.orderNumber.toLowerCase().includes(q) ||
            a.brandName.toLowerCase().includes(q) ||
            a.cashoutId.toLowerCase().includes(q) ||
            a.reason.toLowerCase().includes(q)
          );
        });
        const hasMissingCounterpart = metrics.waybillAlertsSummary.noCounterpartCount > 0;
        return (
          <div
            className={`rounded-2xl bg-white dark:bg-slate-900/80 border overflow-hidden ${
              hasMissingCounterpart
                ? 'border-rose-200/90 dark:border-rose-900/50'
                : 'border-amber-200/90 dark:border-amber-900/50'
            }`}
          >
            <div
              className={`px-4 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                hasMissingCounterpart
                  ? 'bg-rose-50/50 dark:bg-rose-950/20'
                  : 'bg-amber-50/50 dark:bg-amber-950/20'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    hasMissingCounterpart
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    تنبيهات مطابقة بوالص الشحن مع طلبات التوصيل وسجلات المحفظة
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                    {metrics.waybillAlertsSummary.noCounterpartCount > 0 && (
                      <>
                        يوجد{' '}
                        <strong className="text-rose-600 dark:text-rose-400">
                          {metrics.waybillAlertsSummary.noCounterpartCount} بوليصة شحن
                        </strong>{' '}
                        بإجمالي{' '}
                        <strong className="text-rose-600 dark:text-rose-400">
                          {formatEgp(metrics.waybillAlertsSummary.noCounterpartAmount)}
                        </strong>{' '}
                        بدون مقابل مالي مطابق في سجلات المحفظة
                      </>
                    )}
                    {metrics.waybillAlertsSummary.noCounterpartCount > 0 &&
                      metrics.unlinkedWaybillsHeldAmount > 0 &&
                      ' · '}
                    {metrics.unlinkedWaybillsHeldAmount > 0 && (
                      <>
                        ومبلغ{' '}
                        <strong className="text-amber-700 dark:text-amber-400">
                          {formatEgp(metrics.unlinkedWaybillsHeldAmount)}
                        </strong>{' '}
                        موقوف من «المحوّل» لعدم ربط البوليصة بطلب توصيل فعلي
                      </>
                    )}
                    {metrics.waybillAlertsSummary.mismatchCount > 0 && (
                      <>
                        {' · '}
                        <strong className="text-amber-700 dark:text-amber-400">
                          {metrics.waybillAlertsSummary.mismatchCount} بوليصة
                        </strong>{' '}
                        بفارق مبلغ ({formatEgp(metrics.waybillAlertsSummary.mismatchAmount)})
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWaybillAlerts(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>
                    {showWaybillAlerts
                      ? 'إخفاء جدول التنبيهات'
                      : `عرض البوالص المتأثرة (${metrics.waybillWalletAlerts.length})`}
                  </span>
                  {showWaybillAlerts ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {showWaybillAlerts && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="inline-flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        {
                          id: 'all' as const,
                          label: `الكل (${metrics.waybillAlertsSummary.totalCount})`
                        },
                        {
                          id: 'no_wallet_counterpart' as const,
                          label: `بدون مقابل بالمحفظة (${metrics.waybillAlertsSummary.noCounterpartCount})`
                        },
                        {
                          id: 'unlinked_to_order' as const,
                          label: `غير مرتبط بطلب (${metrics.waybillAlertsSummary.unlinkedCount})`
                        },
                        {
                          id: 'amount_mismatch' as const,
                          label: `فارق مبلغ (${metrics.waybillAlertsSummary.mismatchCount})`
                        }
                      ] as const
                    ).map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setWaybillAlertFilter(tab.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer tabular-nums ${
                          waybillAlertFilter === tab.id
                            ? 'bg-[#062d24] text-white dark:bg-[#00ab84]'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    عرض {Math.min(filteredAlerts.length, 150)} من {filteredAlerts.length} تنبيه
                  </span>
                </div>

                {filteredAlerts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    لا توجد بوالص مطابقة لهذا التصنيف أو البحث.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200/80 dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3 whitespace-nowrap">رقم البوليصة</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">طلب التوصيل</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">البراند</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">الحالة</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">المتوقع</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-left">بالمحفظة</th>
                          <th className="py-2.5 px-3">التفاصيل</th>
                          <th className="py-2.5 px-3 whitespace-nowrap text-center">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {filteredAlerts.slice(0, 150).map(alert => (
                          <tr
                            key={alert.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2 px-3 font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                              {alert.trackingNumber}
                              {alert.cashoutId !== '-' && (
                                <span className="block text-[10px] font-normal text-slate-400">
                                  {alert.cashoutId}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 tabular-nums whitespace-nowrap">
                              <span
                                className={
                                  alert.orderNumber === 'غير مرتبط بطلب'
                                    ? 'text-amber-700 dark:text-amber-400 font-bold'
                                    : 'text-slate-700 dark:text-slate-300 font-semibold'
                                }
                              >
                                {alert.orderNumber}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {alert.brandName}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap font-bold">
                              {alert.kind === 'no_wallet_counterpart' ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  بدون مقابل بالمحفظة
                                </span>
                              ) : alert.kind === 'unlinked_to_order' ? (
                                <span className="text-amber-700 dark:text-amber-400">
                                  غير مرتبط بطلب
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400">
                                  فارق مبلغ
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-left font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                              {formatEgp(alert.expectedAmount)}
                            </td>
                            <td className="py-2 px-3 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                              {formatEgp(alert.recordedWalletAmount)}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-slate-600 dark:text-slate-300 min-w-[220px]">
                              {alert.reason}
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  onNavigateTab(
                                    alert.targetTab,
                                    alert.trackingNumber && alert.trackingNumber !== '-'
                                      ? alert.trackingNumber
                                      : undefined
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#062d24] hover:text-white dark:bg-slate-800 dark:hover:bg-[#00ab84] text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                فحص
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* SECTION 1: Where is Your Money Right Now? (4 Clean Flat Pockets — Brand-Aligned) */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            01. فلوسك فين دلوقتي؟ (التوزيع اللحظي على 4 جيوب — بدون تكرار حساب)
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            اضغط على أي جيب للانتقال مباشرة لتفاصيله
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Pocket 1: Transferred / Received Cash */}
          <button
            type="button"
            onClick={() => onNavigateTab('cashout_audit')}
            className="text-right bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 hover:border-[#00ab84]/60 transition-colors duration-150 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {metrics.isVerifiedOnlyMode
                  ? '1. كاش مؤكّد ومعتمد فعلياً'
                  : '1. كاش وصل حسب الشيتات'}
              </span>
              <Landmark className="w-4 h-4 text-[#00ab84] shrink-0" />
            </div>
            <div className="text-2xl font-extrabold text-[#008060] dark:text-[#00ab84]">
              <EgpHero
                value={metrics.actualCashReceivedFromBosta}
                unitClassName="text-sm font-bold opacity-75"
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums space-y-0.5">
              <div>
                {metrics.isVerifiedOnlyMode
                  ? metrics.pendingReviewCashoutsAmount > 0
                    ? `تحت مراجعة البنك: ${formatEgp(metrics.pendingReviewCashoutsAmount)}`
                    : metrics.verifiedCashoutCount > 0
                    ? `تم تأكيد/اعتماد ${metrics.verifiedCashoutCount} ${
                        metrics.isFullTransactionsScope || metrics.useLinkedTxBridge
                          ? 'دفعة تحويل'
                          : 'بوليصة'
                      } بالكامل`
                    : 'ارفع كشف البنك أو أكّد الدفعات لتظهر هنا'
                  : metrics.hasBankStatement
                  ? `إجمالي Cash Out ${formatEgp(metrics.transferredFromBosta)} · مطابق بالبنك ${formatEgp(metrics.verifiedInBankAmount)}`
                  : metrics.verifiedInBankAmount > 0
                  ? `مؤكّد يدوياً/معتمد: ${formatEgp(metrics.verifiedInBankAmount)}`
                  : metrics.isFullTransactionsScope
                  ? 'حسب سجل Cash Out في Transactions'
                  : 'صافي المسلّم المحوّل بعد خصم المرتجعات'}
              </div>
              {metrics.unlinkedWaybillsHeldAmount > 0 && (
                <div className="text-amber-600 dark:text-amber-400 font-semibold">
                  موقوف (غير مرتبط بطلب توصيل): {formatEgp(metrics.unlinkedWaybillsHeldAmount)}
                </div>
              )}
              {savedBatches.length > 0 && (
                <div className="text-slate-600 dark:text-slate-300 font-semibold">
                  أرشيف الدفعات المعتمدة ({savedBatches.length}):{' '}
                  {formatEgp(metrics.savedBatchesArchiveTotal)}
                </div>
              )}
              {!metrics.isBrandFiltered && treasuryAccounts.length > 0 && (
                <div className="text-slate-500 dark:text-slate-400">
                  خزائن النظام ({treasuryAccounts.length}): {formatEgp(metrics.treasuryTotalBalance)}
                </div>
              )}
            </div>
          </button>

          {/* Pocket 2: Inside Bosta Wallet + Credits */}
          <button
            type="button"
            onClick={() =>
              onNavigateTab(
                metrics.hasTransactionsSheet ? 'transactions_ledger' : 'bosta_credits'
              )
            }
            className="text-right bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 hover:border-[#062d24]/40 dark:hover:border-emerald-700/60 transition-colors duration-150 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                2. رصيد داخل محفظة بوسطة حالياً
              </span>
              <WalletIcon className="w-4 h-4 text-[#062d24] dark:text-emerald-400 shrink-0" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              <EgpHero
                value={metrics.insideBostaTotal}
                unitClassName="text-sm font-bold text-slate-500 dark:text-slate-400"
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums space-y-0.5">
              {metrics.isBrandFiltered ? (
                <div>رصيد محفظة بوسطة عام لكل الحساب (يظهر عند اختيار كل البراندات)</div>
              ) : (
                <>
                  <div>محفظة Transactions: {formatEgp(metrics.bostaWalletBalance)}</div>
                  <div>نقاط Bosta Credits: {formatEgp(metrics.bostaCreditsAvailable)}</div>
                </>
              )}
            </div>
          </button>

          {/* Pocket 3: Complete Actionable Claims Owed by Bosta (Zero Overlap) */}
          <button
            type="button"
            onClick={() =>
              onNavigateTab(
                metrics.claimsBreakdown.cashoutDeficits +
                  metrics.claimsBreakdown.phantomCashouts +
                  metrics.claimsBreakdown.bankMissingOrShort +
                  metrics.claimsBreakdown.deliveriesCyclesShortfall >
                  0
                  ? 'cashout_audit'
                  : metrics.claimsBreakdown.untransferred > 0
                  ? 'untransferred'
                  : metrics.claimsBreakdown.underCompensatedShortfall > 0
                  ? 'compensations'
                  : metrics.claimsBreakdown.onlineAndFlexUnpaid > 0
                  ? 'online_flex'
                  : metrics.claimsBreakdown.uncollectedDelivered > 0
                  ? 'uncollected'
                  : 'fee_anomalies'
              )
            }
            className="text-right bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 hover:border-rose-400/70 transition-colors duration-150 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                3. مطالبات ومستحقات ليك برّه
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            </div>
            <div
              className={`text-2xl font-extrabold ${
                metrics.totalOwedClaims > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-[#008060] dark:text-[#00ab84]'
              }`}
            >
              <EgpHero
                value={metrics.totalOwedClaims}
                unitClassName="text-sm font-bold opacity-75"
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums space-y-0.5">
              <div>
                بلا تحويل: {formatEgp(metrics.claimsBreakdown.untransferred)} · فروقات وتطابق:{' '}
                {formatEgp(claimsDiffsGroup)}
              </div>
              <div>
                رسوم وتعويضات: {formatEgp(claimsFeesCompGroup)}
                {claimsOtherGroup > 0 ? ` · أونلاين/مختفي: ${formatEgp(claimsOtherGroup)}` : ''}
              </div>
              {metrics.claimsBreakdown.walletUntransferredOverlap > 0 && (
                <div className="text-[10px] text-slate-400">
                  (مُستبعد {formatEgp(metrics.claimsBreakdown.walletUntransferredOverlap)} داخل المحفظة لمنع التكرار)
                </div>
              )}
            </div>
          </button>

          {/* Pocket 4: In-Transit & Stuck Returns */}
          <button
            type="button"
            onClick={() =>
              onNavigateTab(
                metrics.inTransitCodValue > 0 ? 'in_transit_sheet' : 'stuck_returns'
              )
            }
            className="text-right bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 hover:border-amber-400/70 transition-colors duration-150 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                4. بضاعة وفلوس في الطريق
              </span>
              <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              <EgpHero
                value={metrics.inTransitAndStuckTotal}
                unitClassName="text-sm font-bold opacity-75"
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums space-y-0.5">
              <div>
                قيد التشغيل ({metrics.inTransitCount}): {formatEgp(metrics.inTransitCodValue)}
              </div>
              <div>مرتجعات عالقة بالفروع: {formatEgp(metrics.stuckReturnsValue)}</div>
            </div>
          </button>
        </div>
      </div>

      {/* SECTION 2: Closed Accounting Waterfall (7 cols) + Quick Cost Switches & Ledger Form (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Right: Money Waterfall Table (100% Arithmetically Closed Top-to-Bottom) */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                02. شلال الصافي المحاسبي المغلق (كل سطر يجمع للسطر اللي بعده بالقرش)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {metrics.isFullTransactionsScope
                  ? 'مبني على كامل كشف Transactions التاريخي لضمان تطابق 100% بين التحصيلات والمصاريف والتحويلات والرصيد'
                  : metrics.useLinkedTxBridge
                  ? 'مبني على الشيتات المرفوعة (100% مطابق لجدول البراندات) مع ربط التحويلات ورسومها الفعلية من كشف Transactions'
                  : 'مبني على جميع بوالص الشيتات (شامل غير المسجل بالمتجر والمحصّل مسبقاً، بدون أي تكرار ملفات)'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right text-xs border-collapse">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {metrics.isFullTransactionsScope ? (
                  <>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                        إجمالي دورات تحصيل الكاش (Cash Collection Cycles)
                        <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          مسجّل في كامل كشف حساب Transactions المرفوع
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-left font-extrabold tabular-nums text-[#008060] dark:text-[#00ab84] whitespace-nowrap">
                        +{formatEgp(metrics.txGrossCollections)}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        دورات مصاريف بوسطة (شحن المسلّم + المرتجعات + التأمين + الضريبة)
                      </td>
                      <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        −{formatEgp(metrics.txFeesCycles)}
                      </td>
                    </tr>

                    {metrics.bostaExtraDeductions > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                          رسوم التحويل البنكي + البيك أب + التغليف والتسويات السالبة
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            تحويل {formatEgp(metrics.transferFeesTotal)} · بيك أب{' '}
                            {formatEgp(metrics.pickupFeesTotal)} · تغليف{' '}
                            {formatEgp(metrics.packingNet < 0 ? Math.abs(metrics.packingNet) : 0)}
                            {metrics.negativeAdjustments > 0
                              ? ` · تسويات ${formatEgp(metrics.negativeAdjustments)}`
                              : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          −{formatEgp(metrics.bostaExtraDeductions)}
                        </td>
                      </tr>
                    )}

                    {metrics.bostaPositiveCredits > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                          التعويضات المضافة للمحفظة واسترداد التغليف والتسويات الموجبة
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-[#008060] dark:text-[#00ab84] whitespace-nowrap">
                          +{formatEgp(metrics.bostaPositiveCredits)}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-slate-50/90 dark:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-extrabold text-slate-900 dark:text-white">
                        صافي حركة التشغيل بكشف بوسطة (خلال فترة الكشف)
                      </td>
                      <td className="py-2.5 px-4 text-left font-extrabold tabular-nums text-sm text-slate-900 dark:text-white whitespace-nowrap">
                        {formatEgp(metrics.netEarnedFromBosta)}
                      </td>
                    </tr>

                    {Math.abs(metrics.impliedOpeningBostaBalance) >= 1 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                          رصيد مرحّل داخل محفظة بوسطة قبل بداية تاريخ الكشف
                        </td>
                        <td
                          className={`py-2.5 px-4 text-left font-bold tabular-nums whitespace-nowrap ${
                            metrics.impliedOpeningBostaBalance >= 0
                              ? 'text-[#008060] dark:text-[#00ab84]'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {metrics.impliedOpeningBostaBalance >= 0 ? '+' : '−'}
                          {formatEgp(Math.abs(metrics.impliedOpeningBostaBalance))}
                        </td>
                      </tr>
                    )}

                    {metrics.bostaWalletBalance !== 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                          المتبقي حالياً داخل محفظة بوسطة (لم يُحوّل بعد — يظهر في الجيب 2)
                        </td>
                        <td
                          className={`py-2.5 px-4 text-left font-bold tabular-nums whitespace-nowrap ${
                            metrics.bostaWalletBalance > 0
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-[#008060] dark:text-[#00ab84]'
                          }`}
                        >
                          {metrics.bostaWalletBalance > 0 ? '−' : '+'}
                          {formatEgp(Math.abs(metrics.bostaWalletBalance))}
                        </td>
                      </tr>
                    )}

                    {metrics.unlinkedWaybillsHeldAmount > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-amber-700 dark:text-amber-300 font-semibold">
                          مبالغ موقوفة لم تُحتسب «محوّل» لعدم ارتباط البوليصة بطلب توصيل
                          <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                            {metrics.unlinkedWaybillsHeldCount > 0
                              ? `${metrics.unlinkedWaybillsHeldCount} بوليصة غير مرتبطة بطلب`
                              : ''}
                            {metrics.unlinkedWaybillsHeldCount > 0 &&
                            metrics.unlinkedCashoutsHeldCount > 0
                              ? ' · '
                              : ''}
                            {metrics.unlinkedCashoutsHeldCount > 0
                              ? `${metrics.unlinkedCashoutsHeldCount} دفعة بدون بوالص مربوطة بطلبات`
                              : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          −{formatEgp(metrics.unlinkedWaybillsHeldAmount)}
                        </td>
                      </tr>
                    )}

                    {metrics.claimsBreakdown.bankMissingOrShort > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-rose-700 dark:text-rose-300 font-semibold">
                          تحويلات لم تصل أو ناقصة بكشف البنك (مُرحّلة للمطالبات في الجيب 3)
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          −{formatEgp(metrics.claimsBreakdown.bankMissingOrShort)}
                        </td>
                      </tr>
                    )}

                    {metrics.pendingReviewExcludedFromCash !== 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-amber-700 dark:text-amber-300 font-semibold">
                          تحويلات تحت المراجعة (لم تُؤكّد بالبنك أو تُعتمد بعد — {metrics.pendingReviewCashoutsCount} دفعة)
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {metrics.pendingReviewExcludedFromCash > 0 ? '−' : '+'}
                          {formatEgp(Math.abs(metrics.pendingReviewExcludedFromCash))}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-emerald-50/50 dark:bg-emerald-950/20">
                      <td className="py-2.5 px-4 font-extrabold text-[#062d24] dark:text-emerald-200">
                        {metrics.isVerifiedOnlyMode
                          ? 'صافي الكاش المؤكّد والمعتمد فعلياً من بوسطة'
                          : 'صافي الكاش الواصل فعلياً من بوسطة (Cash Out)'}
                      </td>
                      <td className="py-2.5 px-4 text-left font-extrabold tabular-nums text-sm text-[#008060] dark:text-[#00ab84] whitespace-nowrap">
                        {formatEgp(metrics.actualCashReceivedFromBosta)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                        إجمالي التحصيل النقدي للعملاء (Delivered COD)
                        <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          {metrics.deliveredCount.toLocaleString('en-US')} شحنة مسلّمة بالشيتات المرفوعة
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-left font-extrabold tabular-nums text-[#008060] dark:text-[#00ab84] whitespace-nowrap">
                        +{formatEgp(metrics.deliveredCodTotal)}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        مصاريف شحن الشحنات المسلّمة (شحن + تأمين + ضريبة)
                        {metrics.appliedDeliveriesOnlyEstShipping > 0 && (
                          <span className="block text-[11px] text-amber-600 dark:text-amber-400 tabular-nums">
                            شامل {formatEgp(metrics.appliedDeliveriesOnlyEstShipping)} شحن تقديري لـ{' '}
                            {metrics.deliveriesOnlyDeliveredCount} شحنة من Deliveries_Export لم تنزل Cash Cycles بعد
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        −{formatEgp(metrics.deliveredShippingFees)}
                      </td>
                    </tr>

                    {Math.abs(metrics.deliveredNetOtherAdj) >= 0.5 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                          تسويات صافي الشيت (خصومات / FlexShip / Bosta Credits)
                        </td>
                        <td
                          className={`py-2.5 px-4 text-left font-bold tabular-nums whitespace-nowrap ${
                            metrics.deliveredNetOtherAdj >= 0
                              ? 'text-[#008060] dark:text-[#00ab84]'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {metrics.deliveredNetOtherAdj >= 0 ? '+' : '−'}
                          {formatEgp(Math.abs(metrics.deliveredNetOtherAdj))}
                        </td>
                      </tr>
                    )}

                    <tr>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        مصاريف شحن المرتجعات المخصومة ({metrics.returnedCount} مرتجع)
                        {metrics.zeroNetReturnFeesCaptured > 0 && (
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            شامل {formatEgp(metrics.zeroNetReturnFeesCaptured)} من عمود Total Fees لصفوف بدون سالب في Net Value
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        −{formatEgp(metrics.returnedShippingFees)}
                      </td>
                    </tr>

                    {/* Subtotal 1: Matches Section 03 Brand Table Sum to the exact piastre */}
                    <tr className="bg-slate-50/90 dark:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-extrabold text-slate-900 dark:text-white">
                        صافي مستحقات بوسطة من الشيتات المرفوعة
                        <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          يطابق إجمالي عمود «صافي بوسطة» في جدول البراندات بالأسفل بالقرش
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-left font-extrabold tabular-nums text-sm text-slate-900 dark:text-white whitespace-nowrap">
                        {formatEgp(metrics.ordersSheetNetEarned)}
                      </td>
                    </tr>

                    {!metrics.useLinkedTxBridge && metrics.compensationsReceived > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                          التعويضات المعتمدة
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-[#008060] dark:text-[#00ab84] whitespace-nowrap">
                          +{formatEgp(metrics.compensationsReceived)}
                        </td>
                      </tr>
                    )}

                    {metrics.untransferredSheetNet > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                          متحصل من العميل ولم يُحوّل بعد (بلا Cash-out ID — يظهر في الجيب 2 و3)
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          −{formatEgp(metrics.untransferredSheetNet)}
                        </td>
                      </tr>
                    )}

                    {metrics.useLinkedTxBridge && Math.abs(metrics.linkedCashoutBridge) >= 0.01 && (
                      <tr>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                          {metrics.linkedCashoutBridge < 0
                            ? 'رسوم التحويل البنكي والتغليف والبيك أب المرتبطة بهذه الدفعات'
                            : 'تعويضات وتسويات موجبة مرتبطة بهذه الدفعات'}
                          {(metrics.linkedTransferFees > 0 ||
                            metrics.linkedPickupFees > 0 ||
                            metrics.linkedPackingFees > 0) && (
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              تحويل {formatEgp(metrics.linkedTransferFees)}
                              {metrics.linkedPickupFees > 0
                                ? ` · بيك أب ${formatEgp(metrics.linkedPickupFees)}`
                                : ''}
                              {metrics.linkedPackingFees > 0
                                ? ` · تغليف ${formatEgp(metrics.linkedPackingFees)}`
                                : ''}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-left font-bold tabular-nums whitespace-nowrap ${
                            metrics.linkedCashoutBridge >= 0
                              ? 'text-[#008060] dark:text-[#00ab84]'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {metrics.linkedCashoutBridge >= 0 ? '+' : '−'}
                          {formatEgp(Math.abs(metrics.linkedCashoutBridge))}
                        </td>
                      </tr>
                    )}

                    {metrics.unlinkedWaybillsHeldAmount > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-amber-700 dark:text-amber-300 font-semibold">
                          مبالغ موقوفة لم تُحتسب «محوّل» لعدم ارتباط البوليصة بطلب توصيل
                          <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                            {metrics.unlinkedWaybillsHeldCount > 0
                              ? `${metrics.unlinkedWaybillsHeldCount} بوليصة غير مرتبطة بطلب`
                              : ''}
                            {metrics.unlinkedWaybillsHeldCount > 0 &&
                            metrics.unlinkedCashoutsHeldCount > 0
                              ? ' · '
                              : ''}
                            {metrics.unlinkedCashoutsHeldCount > 0
                              ? `${metrics.unlinkedCashoutsHeldCount} دفعة بدون بوالص مربوطة بطلبات`
                              : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          −{formatEgp(metrics.unlinkedWaybillsHeldAmount)}
                        </td>
                      </tr>
                    )}

                    {metrics.claimsBreakdown.bankMissingOrShort > 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-rose-700 dark:text-rose-300 font-semibold">
                          تحويلات لم تصل أو ناقصة بكشف البنك (مُرحّلة للمطالبات في الجيب 3)
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          −{formatEgp(metrics.claimsBreakdown.bankMissingOrShort)}
                        </td>
                      </tr>
                    )}

                    {metrics.pendingReviewExcludedFromCash !== 0 && (
                      <tr>
                        <td className="py-2.5 px-4 text-amber-700 dark:text-amber-300 font-semibold">
                          {metrics.useLinkedTxBridge
                            ? `دفعات تحويل تحت المراجعة (${metrics.pendingReviewCashoutsCount} دفعة لم تُؤكّد بالبنك بعد)`
                            : 'بوالص تحت المراجعة (لم تُعتمد في دفعة تحصيل أو تُؤكّد بالبنك بعد)'}
                        </td>
                        <td className="py-2.5 px-4 text-left font-bold tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {metrics.pendingReviewExcludedFromCash > 0 ? '−' : '+'}
                          {formatEgp(Math.abs(metrics.pendingReviewExcludedFromCash))}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-emerald-50/50 dark:bg-emerald-950/20">
                      <td className="py-2.5 px-4 font-extrabold text-[#062d24] dark:text-emerald-200">
                        {metrics.isVerifiedOnlyMode
                          ? 'صافي الكاش المؤكّد والمعتمد فعلياً من بوسطة'
                          : 'صافي الكاش المحوّل فعلياً من بوسطة'}
                      </td>
                      <td className="py-2.5 px-4 text-left font-extrabold tabular-nums text-sm text-[#008060] dark:text-[#00ab84] whitespace-nowrap">
                        {formatEgp(metrics.actualCashReceivedFromBosta)}
                      </td>
                    </tr>
                  </>
                )}

                {/* Optional Treasury & Inflows */}
                {metrics.activeTreasuryInclusion !== 0 && (
                  <tr>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      أرصدة خزائن النظام المضمومة
                    </td>
                    <td className="py-2.5 px-4 text-left font-bold tabular-nums text-[#008060] dark:text-[#00ab84] whitespace-nowrap">
                      +{formatEgp(metrics.activeTreasuryInclusion)}
                    </td>
                  </tr>
                )}

                {metrics.ledgerInflows > 0 && (
                  <tr>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      رصيد افتتاحي وإيداعات إضافية بالدفتر
                    </td>
                    <td className="py-2.5 px-4 text-left font-bold tabular-nums text-[#008060] dark:text-[#00ab84] whitespace-nowrap">
                      +{formatEgp(metrics.ledgerInflows)}
                    </td>
                  </tr>
                )}

                {/* Business Costs, Expenses & Withdrawals */}
                <tr>
                  <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                    تكلفة البضاعة المباعة (COGS)
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {costConfig.useAutoCogsFromOrders && metrics.autoCogsFromOrders > 0
                        ? `تلقائي: ${formatEgp(metrics.autoCogsFromOrders)} (${metrics.autoCogsOrdersCount} أوردر${
                            metrics.autoCogsCatalogCount > 0
                              ? ` + ${metrics.autoCogsCatalogCount} من الكتالوج`
                              : ''
                          })`
                        : 'بدون حساب تلقائي'}
                      {metrics.ledgerGoodsCost > 0
                        ? ` · يدوي بالدفتر (${formatEgp(metrics.ledgerGoodsCost)})`
                        : ''}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {metrics.totalGoodsCost > 0
                      ? `−${formatEgp(metrics.totalGoodsCost)}`
                      : formatEgp(0)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                    الإعلانات والمصروفات التشغيلية
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      إعلانات {formatEgp(metrics.ledgerAds)} · تشغيل {formatEgp(metrics.ledgerOperating)}
                      {!metrics.isBrandFiltered &&
                      costConfig.includeStoreExpensesFromWallet &&
                      metrics.storeOperatingExpenses > 0
                        ? ` · مصروفات النظام ${formatEgp(metrics.storeOperatingExpenses)}`
                        : ''}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {metrics.totalExpenses > 0
                      ? `−${formatEgp(metrics.totalExpenses)}`
                      : formatEgp(0)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                    مدفوعات الموردين والمسحوبات (شركاء / شخصية)
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      موردين {formatEgp(round2(metrics.ledgerSuppliers + (!metrics.isBrandFiltered && costConfig.includeStoreExpensesFromWallet ? metrics.storeSupplierPayments : 0)))} · مسحوبات{' '}
                      {formatEgp(round2(metrics.ledgerWithdrawals + (!metrics.isBrandFiltered && costConfig.includeStoreExpensesFromWallet ? metrics.storeWithdrawals : 0)))}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-left font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {metrics.totalPayoutsAndWithdrawals > 0
                      ? `−${formatEgp(metrics.totalPayoutsAndWithdrawals)}`
                      : formatEgp(0)}
                  </td>
                </tr>

                {/* Final Bottom Line */}
                <tr className="bg-[#062d24] text-white">
                  <td className="py-3.5 px-4 font-extrabold text-sm">
                    المتبقي فعلياً بعد كل حاجة (السيولة الحاضرة الآن)
                  </td>
                  <td
                    className={`py-3.5 px-4 text-left font-extrabold tabular-nums text-base whitespace-nowrap ${
                      metrics.cashOnHandNow >= 0 ? 'text-[#00ab84]' : 'text-rose-300'
                    }`}
                  >
                    {formatEgp(metrics.cashOnHandNow)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Left: Quick Ledger Form & System Source Switches */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                تسجيل قيد سريع في المحفظة
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                سجّل أي مصروف إعلانات أو دفعة مورد أو سحب أو رصيد افتتاحي ليُخصم فوراً ويُحفظ تلقائياً.
              </p>
            </div>

            <form onSubmit={handleSubmitEntry} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    نوع الحركة
                  </label>
                  <select
                    value={entryKind}
                    onChange={e => setEntryKind(e.target.value as WalletEntryKind)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {(Object.keys(ENTRY_KIND_META) as WalletEntryKind[]).map(k => (
                      <option key={k} value={k}>
                        {ENTRY_KIND_META[k].defaultDirection === 'in' ? '(+) ' : '(−) '}
                        {ENTRY_KIND_META[k].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    المبلغ (ج.م)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={entryAmount}
                    onChange={e => setEntryAmount(e.target.value)}
                    placeholder="مثال: 5000"
                    className="w-full px-3 py-2 text-xs font-bold tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    البراند (اختياري)
                  </label>
                  <select
                    value={entryBrand}
                    onChange={e => setEntryBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="">عام (على كل الحساب)</option>
                    {normalizedBrandOptions.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  البيان / الوصف
                </label>
                <input
                  type="text"
                  value={entryNote}
                  onChange={e => setEntryNote(e.target.value)}
                  placeholder="مثال: تمويل إعلانات فيسبوك / توريد مصنع / سحب شخصي"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#062d24] hover:bg-[#041d18] dark:bg-[#00ab84] dark:hover:bg-[#009472] text-white text-xs font-bold transition-colors duration-150 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة الحركة وتحديث الرصيد</span>
              </button>
            </form>
          </div>

          {/* Automatic Integration Switches */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
              خيارات الربط التلقائي مع بيانات النظام والشيتات
            </div>

            {metrics.deliveriesOnlyDeliveredCount > 0 && (
              <label className="flex items-center justify-between gap-3 text-xs cursor-pointer select-none">
                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                  خصم شحن تقديري لبوالص Deliveries_Export غير المسوّاة
                  <span className="block text-[10px] text-slate-500 tabular-nums">
                    {metrics.deliveriesOnlyDeliveredCount} شحنة × متوسط {formatEgp(metrics.avgCashCycleShipFee)} ≈ {formatEgp(metrics.deliveriesOnlyEstimatedShippingTotal)}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={metrics.deductEstShipping}
                  onChange={e =>
                    onUpdateCostConfig({
                      ...costConfig,
                      deductEstimatedShippingOnDeliveriesOnly: e.target.checked
                    })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-[#00ab84] focus:ring-[#00ab84]"
                />
              </label>
            )}

            <label className="flex items-center justify-between gap-3 text-xs cursor-pointer select-none">
              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                خصم تكلفة البضاعة تلقائياً (من الأوردرات + كتالوج المنتجات)
                <span className="block text-[10px] text-slate-500 tabular-nums">
                  المحسوب حالياً: {formatEgp(metrics.autoCogsFromOrders)} ({metrics.autoCogsOrdersCount} أوردر
                  {metrics.autoCogsCatalogCount > 0
                    ? ` + ${metrics.autoCogsCatalogCount} من الكتالوج`
                    : ''}
                  )
                </span>
              </span>
              <input
                type="checkbox"
                checked={costConfig.useAutoCogsFromOrders}
                onChange={e =>
                  onUpdateCostConfig({ ...costConfig, useAutoCogsFromOrders: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-300 text-[#00ab84] focus:ring-[#00ab84]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs cursor-pointer select-none">
              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                ضم مصروفات وموردين ومسحوبات محفظة النظام
                <span className="block text-[10px] text-slate-500 tabular-nums">
                  الإجمالي: {formatEgp(metrics.storeRecordedOutflowsTotal)} ({metrics.storeOutflowsCount} قيد
                  {metrics.storeRecordedOutflowsTotal > 0
                    ? ` — مصاريف ${formatEgp(metrics.storeOperatingExpenses)} · موردين ${formatEgp(metrics.storeSupplierPayments)} · مسحوبات ${formatEgp(metrics.storeWithdrawals)}`
                    : ''}
                  )
                </span>
              </span>
              <input
                type="checkbox"
                checked={costConfig.includeStoreExpensesFromWallet}
                onChange={e =>
                  onUpdateCostConfig({
                    ...costConfig,
                    includeStoreExpensesFromWallet: e.target.checked
                  })
                }
                className="w-4 h-4 rounded border-slate-300 text-[#00ab84] focus:ring-[#00ab84]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs cursor-pointer select-none">
              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                ضم أرصدة الخزائن الفعلية للسيولة الحاضرة
                <span className="block text-[10px] text-slate-500 tabular-nums">
                  إجمالي الخزائن ({treasuryAccounts.length}): {formatEgp(metrics.treasuryTotalBalance)}
                </span>
              </span>
              <input
                type="checkbox"
                checked={costConfig.includeTreasuryBalances}
                onChange={e =>
                  onUpdateCostConfig({
                    ...costConfig,
                    includeTreasuryBalances: e.target.checked
                  })
                }
                className="w-4 h-4 rounded border-slate-300 text-[#00ab84] focus:ring-[#00ab84]"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Connected Store Treasury Accounts Strip */}
      {treasuryAccounts.length > 0 && !metrics.isBrandFiltered && (
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#00ab84]" />
              <span>أرصدة الخزائن والحسابات الفعلية المسجّلة بالنظام</span>
            </div>
            <span className="text-xs font-extrabold tabular-nums text-[#008060] dark:text-[#00ab84]">
              الإجمالي: {formatEgp(metrics.treasuryTotalBalance)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {treasuryAccounts.map(acc => (
              <div
                key={acc.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                    {acc.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {TREASURY_TYPE_LABEL[acc.type] || acc.type}
                  </div>
                </div>
                <div className="font-extrabold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                  {formatEgp(acc.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: Per-Brand Wallet Breakdown (Merged by Brand Family + Totals Row) */}
      {brandWallets.length > 0 && (
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#00ab84]" />
                <span>03. محفظة الصافي لكل براند على حدة</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {metrics.isFullTransactionsScope
                  ? `يعرض تفصيل الـ ${metrics.deliveredCount} شحنة مسلّمة في شيتات الأوردرات والدورات المرفوعة فقط (مع دمج اختلافات كتابة نفس البراند تلقائياً)`
                  : 'تفصيل دقيق لتحصيل ومرتجعات وشحن ومصاريف وصافي كل براند (مع دمج اختلافات كتابة نفس البراند تلقائياً)'}
              </p>
            </div>
            <span className="text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
              {brandWallets.length} براند
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                  <th className="py-2.5 px-3 font-bold">البراند</th>
                  <th className="py-2.5 px-3 font-bold">المسلّم (COD)</th>
                  <th className="py-2.5 px-3 font-bold">المرتجع ورسومه</th>
                  <th className="py-2.5 px-3 font-bold">شحن المسلّم</th>
                  <th className="py-2.5 px-3 font-bold">صافي بوسطة</th>
                  <th className="py-2.5 px-3 font-bold">متحصل بلا تحويل</th>
                  <th className="py-2.5 px-3 font-bold">تكاليف وقيود البراند</th>
                  <th className="py-2.5 px-3 font-bold">الصافي النهائي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {brandWallets.map(b => {
                  const totalOrd = b.deliveredCount + b.returnedCount;
                  const retPct = totalOrd > 0 ? Math.round((b.returnedCount / totalOrd) * 100) : 0;
                  const brandOutflows = round2(b.autoCogs + b.ledgerOut);
                  return (
                    <tr
                      key={b.brandKey}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {b.brandName}
                        </div>
                        {b.aliasList.length > 1 && (
                          <div
                            className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 max-w-[220px] truncate"
                            title={b.aliasList.join(' · ')}
                          >
                            مُوحّد ({b.aliasList.length}): {b.aliasList.join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatEgp(b.deliveredCod)}
                        </div>
                        <div className="text-[10px] text-slate-500">{b.deliveredCount} شحنة</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-rose-600 dark:text-rose-400">
                          {b.returnedFees > 0 ? `−${formatEgp(b.returnedFees)}` : formatEgp(0)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {b.returnedCount} مرتجع ({retPct}%)
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-600 dark:text-slate-300">
                          {b.shippingFees > 0 ? `−${formatEgp(b.shippingFees)}` : formatEgp(0)}
                        </div>
                        {b.deliveriesOnlyCount > 0 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400">
                            {metrics.deductEstShipping
                              ? `منها ${b.deliveriesOnlyCount} شحن تقديري`
                              : `${b.deliveriesOnlyCount} بلا شحن (Deliveries)`}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatEgp(b.sheetNetEarned)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={
                            b.untransferredNet > 0
                              ? 'font-extrabold text-rose-600 dark:text-rose-400'
                              : 'text-slate-400'
                          }
                        >
                          {formatEgp(b.untransferredNet)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-rose-600 dark:text-rose-400 font-semibold">
                          {brandOutflows > 0 ? `−${formatEgp(brandOutflows)}` : formatEgp(0)}
                        </div>
                        {b.ledgerIn > 0 && (
                          <div className="text-[10px] text-[#008060] dark:text-[#00ab84] font-bold">
                            +{formatEgp(b.ledgerIn)} إيداع
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold whitespace-nowrap">
                        <span
                          className={
                            b.finalNet >= 0
                              ? 'text-[#008060] dark:text-[#00ab84]'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {formatEgp(b.finalNet)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-700 font-extrabold tabular-nums">
                  <td className="py-2.5 px-3 text-slate-900 dark:text-white whitespace-nowrap">
                    الإجمالي ({brandWallets.length} براند)
                  </td>
                  <td className="py-2.5 px-3 text-slate-900 dark:text-white whitespace-nowrap">
                    <div>{formatEgp(brandTotals.deliveredCod)}</div>
                    <div className="text-[10px] font-semibold text-slate-500">
                      {brandTotals.deliveredCount} شحنة
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    <div>
                      {brandTotals.returnedFees > 0
                        ? `−${formatEgp(brandTotals.returnedFees)}`
                        : formatEgp(0)}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500">
                      {brandTotals.returnedCount} مرتجع
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {brandTotals.shippingFees > 0
                      ? `−${formatEgp(brandTotals.shippingFees)}`
                      : formatEgp(0)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-900 dark:text-white whitespace-nowrap">
                    {formatEgp(brandTotals.sheetNetEarned)}
                  </td>
                  <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {formatEgp(brandTotals.untransferredNet)}
                  </td>
                  <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {brandTotals.outflows > 0
                      ? `−${formatEgp(brandTotals.outflows)}`
                      : formatEgp(0)}
                  </td>
                  <td
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      brandTotals.finalNet >= 0
                        ? 'text-[#008060] dark:text-[#00ab84]'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatEgp(brandTotals.finalNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: Interactive Wallet Ledger Journal */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              04. دفتر حركات المحفظة (المصروفات، الموردين، المسحوبات والإيداعات)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              محفوظة تلقائياً لهذا المتجر وتُخصم أو تُضاف لحظياً لصافي المحفظة
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'all', label: `الكل (${ledgerEntries.length})` },
                { id: 'out', label: 'صادر / مصروفات' },
                { id: 'in', label: 'وارد / إيداعات' }
              ] as const
            ).map(btn => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setJournalFilter(btn.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  journalFilter === btn.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {filteredJournal.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
            لا توجد حركات مسجّلة في دفتر المحفظة بعد — استخدم نموذج «تسجيل قيد سريع» بالأعلى لإضافة الإعلانات أو تكلفة البضاعة أو الموردين أو المسحوبات.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                  <th className="py-2.5 px-3 font-bold">التاريخ</th>
                  <th className="py-2.5 px-3 font-bold">التصنيف</th>
                  <th className="py-2.5 px-3 font-bold">البيان</th>
                  <th className="py-2.5 px-3 font-bold">البراند</th>
                  <th className="py-2.5 px-3 font-bold">المبلغ</th>
                  <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredJournal.map(entry => {
                  const isIncoming = entry.direction === 'in';
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-3 tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {entry.date}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {isIncoming ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-[#00ab84] shrink-0" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span>{ENTRY_KIND_META[entry.kind].label}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200">
                        {entry.note}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {entry.brandName ? getBrandFamilyMeta(entry.brandName).label : 'عام'}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-extrabold tabular-nums whitespace-nowrap ${
                          isIncoming
                            ? 'text-[#008060] dark:text-[#00ab84]'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isIncoming ? '+' : '−'}
                        {formatEgp(entry.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onDeleteLedgerEntry(entry.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="حذف الحركة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {ledgerEntries.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00ab84]" />
              <span>محفوظة تلقائياً في قاعدة بيانات المتصفح</span>
            </span>
            <div className="flex flex-wrap items-center gap-4 font-bold">
              <span className="text-[#008060] dark:text-[#00ab84]">
                إجمالي الوارد: +{formatEgp(metrics.ledgerInflows)}
              </span>
              <span className="text-rose-600 dark:text-rose-400">
                إجمالي الصادر: −
                {formatEgp(
                  round2(
                    metrics.ledgerGoodsCost +
                      metrics.ledgerAds +
                      metrics.ledgerOperating +
                      metrics.ledgerSuppliers +
                      metrics.ledgerWithdrawals
                  )
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetPositionWalletPanel;
