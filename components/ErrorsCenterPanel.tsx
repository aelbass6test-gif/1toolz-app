import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  Link2,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import {
  SheetAuditRow,
  TransactionCashoutEntry,
  TwoWayCodAuditResult
} from '../utils/codReconciliation';

export type UnifiedErrorCategory =
  | 'unlinked_order'
  | 'untransferred_cod'
  | 'amount_or_bank_variance'
  | 'fee_anomaly'
  | 'fraud_or_price'
  | 'missing_compensation'
  | 'logistics_or_pickup';

export type ErrorSeverity = 'critical' | 'high' | 'medium';

export interface UnifiedErrorRecord {
  id: string;
  category: UnifiedErrorCategory;
  categoryLabel: string;
  severity: ErrorSeverity;
  trackingKey?: string;
  orderNumber?: string;
  orderId?: string;
  cashoutId?: string;
  brandName: string;
  customerName: string;
  customerPhone?: string;
  dateStr?: string;
  financialImpact: number;
  title: string;
  description: string;
  sheetRow?: SheetAuditRow;
  cashoutEntry?: TransactionCashoutEntry;
  targetAuditTab: string;
}

export interface ErrorsCenterPanelProps {
  storeName: string;
  auditResult: TwoWayCodAuditResult;
  orderBasePath: string;
  onInspectWaybill: (trackingCode: string, cashoutId?: string) => void;
  onInspectCashout: (tx: TransactionCashoutEntry) => void;
  onOpenLinkOrImportModal: (row: SheetAuditRow) => void;
  onJumpToAuditTab: (tab: string, search?: string) => void;
  onNotify?: (msg: string, type?: 'success' | 'error') => void;
}

const PAGE_SIZE = 30;

const formatEgp = (val: number): string => {
  const num = Number.isFinite(val) ? val : 0;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} ج.م`;
};

const normalizeBrand = (raw?: string, fallback?: string): string => {
  const clean = (raw || '').trim().replace(/\s+/g, ' ');
  return clean || (fallback || 'المتجر الرئيسي');
};

export function collectUnifiedErrors(
  auditResult: TwoWayCodAuditResult,
  storeName: string
): UnifiedErrorRecord[] {
  const items: UnifiedErrorRecord[] = [];
  const rowByTracking = new Map<string, SheetAuditRow>();
  for (const r of auditResult.sheetRows) {
    if (r.category !== 'duplicate' && r.trackingKey) {
      rowByTracking.set(r.trackingKey.trim().toUpperCase(), r);
    }
  }
  const cashoutById = new Map<string, TransactionCashoutEntry>();
  for (const c of auditResult.transactionsSummary.entries) {
    if (c.cashoutId) cashoutById.set(c.cashoutId.trim().toUpperCase(), c);
  }

  // 1. Unlinked sheet orders (not found in store orders)
  for (const row of auditResult.notFound) {
    items.push({
      id: `err_unlinked_${row.id}`,
      category: 'unlinked_order',
      categoryLabel: 'غير مربوط بالمتجر',
      severity: row.sheetNetPayout > 0 ? 'high' : 'medium',
      trackingKey: row.trackingKey,
      orderNumber: row.businessRefKey || undefined,
      cashoutId: row.sheetCashoutId || undefined,
      cashoutEntry: row.sheetCashoutId
        ? cashoutById.get(row.sheetCashoutId.trim().toUpperCase())
        : undefined,
      brandName: normalizeBrand(row.brandName, storeName),
      customerName: row.customerName || 'عميل غير مسمّى',
      customerPhone: row.phoneRaw || undefined,
      dateStr: row.sheetDeliveredAt || row.sheetDate || undefined,
      financialImpact: Math.abs(row.sheetNetPayout || row.sheetGrossAmount || 0),
      title: 'بوليصة شحن غير مربوطة بأوردر في المتجر',
      description:
        row.reasonSummary ||
        'لم يتم العثور على أوردر مطابق في المتجر — يمكنك ربطها بأوردر موجود أو تنزيلها مباشرة للأوردرات.',
      sheetRow: row,
      targetAuditTab: 'not_found'
    });
  }

  // 2. Collected by courier but NOT transferred to bank (Not Paid)
  for (const row of auditResult.collectedUntransferred) {
    items.push({
      id: `err_untrans_${row.id}`,
      category: 'untransferred_cod',
      categoryLabel: 'محصّل بدون تحويل',
      severity: 'critical',
      trackingKey: row.trackingKey,
      orderNumber: row.matchedOrder?.orderNumber || row.businessRefKey,
      orderId: row.matchedOrder?.id,
      brandName: normalizeBrand(
        row.brandName || row.matchedOrder?.merchantBrandName,
        storeName
      ),
      customerName: row.matchedOrder?.customerName || row.customerName || 'عميل',
      customerPhone: row.matchedOrder?.customerPhone || row.phoneRaw,
      dateStr: row.sheetDeliveredAt || row.sheetDate,
      financialImpact: Math.max(0, row.sheetNetPayout || row.sheetGrossAmount),
      title: 'شحنة مسلّمة ومحصّلة بدون تحويل بنكي',
      description:
        row.reasonSummary ||
        `تم تسليم الشحنة وتحصيل ${formatEgp(row.sheetGrossAmount)} دون إصدار كود تحويل بنكي بعد.`,
      sheetRow: row,
      targetAuditTab: 'untransferred'
    });
  }

  // 3. Short-paid & over-paid discrepancies on orders
  for (const row of [...auditResult.shortPaid, ...auditResult.overPaid]) {
    const isShort = row.category === 'short_paid';
    items.push({
      id: `err_var_${row.id}`,
      category: 'amount_or_bank_variance',
      categoryLabel: isShort ? 'عجز توريد بأوردر' : 'زيادة توريد بأوردر',
      severity: isShort ? 'critical' : 'medium',
      trackingKey: row.trackingKey,
      orderNumber: row.matchedOrder?.orderNumber || row.businessRefKey,
      orderId: row.matchedOrder?.id,
      cashoutId: row.sheetCashoutId || undefined,
      cashoutEntry: row.sheetCashoutId
        ? cashoutById.get(row.sheetCashoutId.trim().toUpperCase())
        : undefined,
      brandName: normalizeBrand(
        row.brandName || row.matchedOrder?.merchantBrandName,
        storeName
      ),
      customerName: row.matchedOrder?.customerName || row.customerName || 'عميل',
      customerPhone: row.matchedOrder?.customerPhone || row.phoneRaw,
      dateStr: row.sheetDeliveredAt || row.sheetDate,
      financialImpact: Math.abs(row.netVariance || 0),
      title: isShort
        ? `نقص في الصافي المحوّل بمقدار ${formatEgp(Math.abs(row.netVariance))}`
        : `زيادة في الصافي المحوّل بمقدار ${formatEgp(Math.abs(row.netVariance))}`,
      description: row.reasonSummary || 'يوجد فرق بين الصافي المتوقع وصافي الشيت.',
      sheetRow: row,
      targetAuditTab: 'discrepancy'
    });
  }

  // 4. Cashout Bank Variances (from Transactions summary & Forensic audits)
  for (const tx of auditResult.transactionsSummary.entries) {
    if (!tx.isUnlinkedGeneralPayout && Math.abs(tx.bankVariance) >= 0.5) {
      items.push({
        id: `err_bank_${tx.id}`,
        category: 'amount_or_bank_variance',
        categoryLabel: 'فرق دفعة تحويل بنكي',
        severity: tx.bankVariance < 0 ? 'critical' : 'high',
        cashoutId: tx.cashoutId,
        cashoutEntry: tx,
        brandName: storeName,
        customerName: `دفعة تحويل ${tx.cashoutId}`,
        dateStr: tx.date,
        financialImpact: Math.abs(tx.bankVariance),
        title: `فرق بنكي في الدفعة ${tx.cashoutId} (${tx.bankVariance > 0 ? '+' : ''}${formatEgp(tx.bankVariance)})`,
        description: `المحوّل فعلياً ${formatEgp(tx.cashoutAmount)} مقابل صافي ${tx.linkedOrderCount} شحنة (${formatEgp(tx.linkedNetTotal)}) ورسوم تحويل -${formatEgp(tx.transferFees)}.`,
        targetAuditTab: 'cashout_audit'
      });
    }
  }

  // 5. Fee anomalies (only uncompensated or active ones)
  for (const fee of auditResult.feeAnomalies) {
    if (fee.compensatedInCredits && fee.netUncompensatedOvercharge <= 0.05) continue;
    const matchedSheet = rowByTracking.get(fee.trackingKey.trim().toUpperCase());
    items.push({
      id: `err_fee_${fee.id}`,
      category: 'fee_anomaly',
      categoryLabel: 'خطأ تسعير / مصاريف شحن',
      severity: fee.netUncompensatedOvercharge >= 40 ? 'high' : 'medium',
      trackingKey: fee.trackingKey,
      orderNumber: matchedSheet?.matchedOrder?.orderNumber || matchedSheet?.businessRefKey,
      orderId: matchedSheet?.matchedOrder?.id,
      cashoutId: fee.sheetCashoutId || undefined,
      cashoutEntry: fee.sheetCashoutId
        ? cashoutById.get(fee.sheetCashoutId.trim().toUpperCase())
        : undefined,
      brandName: normalizeBrand(fee.brandName, storeName),
      customerName: fee.customerName || 'عميل',
      customerPhone: fee.customerPhone,
      dateStr: matchedSheet?.sheetDeliveredAt || matchedSheet?.sheetDate,
      financialImpact: Math.max(0, fee.netUncompensatedOvercharge || fee.overchargeEstimate),
      title: fee.anomalyTags?.[0] || 'زيادة غير مبررة في مصاريف الشحن',
      description:
        fee.anomalyTags?.join(' · ') ||
        `مصاريف مخصومة ${formatEgp(fee.sheetFeesAmount)} مقابل المتوقع ${formatEgp(fee.expectedLimit)}.`,
      sheetRow: matchedSheet,
      targetAuditTab: 'fee_anomalies'
    });
  }

  // 6. Internal Fraud & Product Price Anomalies
  for (const fraud of auditResult.internalFraudAlerts) {
    const matchedSheet = rowByTracking.get(fraud.trackingKey.trim().toUpperCase());
    items.push({
      id: `err_fraud_${fraud.id}`,
      category: 'fraud_or_price',
      categoryLabel: 'فرق سعر / تنبيه رقابي',
      severity: fraud.severity === 'critical' ? 'critical' : fraud.severity === 'high' ? 'high' : 'medium',
      trackingKey: fraud.trackingKey,
      orderNumber: fraud.orderNumber || fraud.matchedOrder?.orderNumber,
      orderId: fraud.matchedOrder?.id,
      brandName: normalizeBrand(fraud.brandName || fraud.matchedOrder?.merchantBrandName, storeName),
      customerName: fraud.customerName || fraud.matchedOrder?.customerName || 'عميل',
      customerPhone: fraud.customerPhone || fraud.matchedOrder?.customerPhone,
      dateStr: fraud.sheetDate,
      financialImpact: Math.abs(fraud.financialRiskAmount || 0),
      title:
        fraud.fraudType === 'product_price_anomaly'
          ? 'انخفاض غير مبرر في سعر بيع المنتج'
          : fraud.fraudType === 'cancelled_in_store_delivered_in_bosta'
          ? 'ملغي بالمتجر لكنه مسلّم في بوسطة'
          : fraud.fraudType === 'cod_downgraded_or_zero'
          ? 'تخفيض أو تصفير مبلغ التحصيل (COD)'
          : fraud.fraudType === 'settled_in_store_no_cashout'
          ? 'تم تحصيله بالمتجر بدون كود تحويل بوسطة'
          : fraud.fraudType === 'double_waybill_same_order'
          ? 'بوليصتان لنفس الأوردر'
          : 'تضارب حالة بين شيتات الشحن',
      description: fraud.reasonSummary,
      sheetRow: matchedSheet,
      targetAuditTab: 'fraud_alerts'
    });
  }

  // 7. Missing / Under-paid Compensations
  for (const comp of auditResult.missingCompensations) {
    const matchedSheet = rowByTracking.get(comp.trackingKey.trim().toUpperCase());
    const netShortfall = Math.max(
      0,
      comp.estimatedValue - (comp.paidCompensationAmount || 0)
    );
    items.push({
      id: `err_comp_${comp.id}`,
      category: 'missing_compensation',
      categoryLabel:
        comp.alertKind === 'under_compensated' ? 'تعويض ناقص القيمة' : 'تعويض غير مصروف',
      severity: 'critical',
      trackingKey: comp.trackingKey,
      orderNumber: comp.orderNumber || comp.matchedOrder?.orderNumber,
      orderId: comp.matchedOrder?.id,
      brandName: normalizeBrand(comp.brandName || comp.matchedOrder?.merchantBrandName, storeName),
      customerName: comp.customerName || comp.matchedOrder?.customerName || 'عميل',
      customerPhone: comp.customerPhone || comp.matchedOrder?.customerPhone,
      dateStr: comp.sheetDate,
      financialImpact: netShortfall,
      title:
        comp.alertKind === 'under_compensated'
          ? `تعويض أقل من قيمة المنتج (ناقص ${formatEgp(netShortfall)})`
          : `شحنة تالفة/مفقودة بدون تعويض (${formatEgp(comp.estimatedValue)})`,
      description: comp.reasonSummary,
      sheetRow: matchedSheet,
      targetAuditTab: 'missing_comp'
    });
  }

  // 8. Zero-Attempt Returns
  for (const za of auditResult.zeroAttemptReturns) {
    const matchedSheet = rowByTracking.get(za.trackingKey.trim().toUpperCase());
    items.push({
      id: `err_za_${za.id}`,
      category: 'logistics_or_pickup',
      categoryLabel: 'مرتجع بدون محاولات',
      severity: 'high',
      trackingKey: za.trackingKey,
      orderNumber: za.matchedOrder?.orderNumber,
      orderId: za.matchedOrder?.id,
      cashoutId: za.sheetCashoutId,
      brandName: normalizeBrand(za.brandName || za.matchedOrder?.merchantBrandName, storeName),
      customerName: za.customerName || za.matchedOrder?.customerName || 'عميل',
      customerPhone: za.customerPhone || za.matchedOrder?.customerPhone,
      financialImpact: Math.abs(za.shippingFeesDeducted || 0),
      title: 'مرتجع بدون محاولات تسليم فعلية',
      description: za.reasonSummary,
      sheetRow: matchedSheet,
      targetAuditTab: 'zero_attempt_returns'
    });
  }

  // 9. Stuck Returns in Hubs
  for (const sr of auditResult.stuckReturns) {
    const matchedSheet = rowByTracking.get(sr.trackingKey.trim().toUpperCase());
    items.push({
      id: `err_stuck_${sr.id}`,
      category: 'logistics_or_pickup',
      categoryLabel: 'مرتجع عالق بالفرع',
      severity: sr.daysOverdue >= 10 ? 'high' : 'medium',
      trackingKey: sr.trackingKey,
      orderNumber: sr.matchedOrder?.orderNumber,
      orderId: sr.matchedOrder?.id,
      brandName: normalizeBrand(sr.brandName || sr.matchedOrder?.merchantBrandName, storeName),
      customerName: sr.customerName || sr.matchedOrder?.customerName || 'عميل',
      customerPhone: sr.customerPhone || sr.matchedOrder?.customerPhone,
      dateStr: sr.updatedAt || sr.expectedReturnDate,
      financialImpact: Math.abs(sr.codAmount || 0),
      title: `مرتجع متأخر ${sr.daysOverdue} يوم في ${sr.currentHub || 'الفرع'}`,
      description: sr.reasonSummary,
      sheetRow: matchedSheet,
      targetAuditTab: 'stuck_returns'
    });
  }

  // 10. Wrongful Pickup Fee Deductions
  for (const pk of auditResult.pickupFeeAudits) {
    if (pk.verdict !== 'wrongful_deduction') continue;
    items.push({
      id: `err_pk_${pk.id}`,
      category: 'logistics_or_pickup',
      categoryLabel: 'خصم بيك أب خاطئ',
      severity: 'medium',
      cashoutId: pk.cashoutId,
      cashoutEntry: pk.cashoutId
        ? cashoutById.get(pk.cashoutId.trim().toUpperCase())
        : undefined,
      brandName: storeName,
      customerName: `معاملة بيك أب #${pk.transactionId}`,
      dateStr: pk.txDate,
      financialImpact: Math.abs(pk.overchargeAmount || pk.feeAmount || 0),
      title: `خصم رسوم بيك أب رغم سحب ${pk.shipmentsPickedCount} شحنة`,
      description: pk.reasonSummary,
      targetAuditTab: 'pickup_requests'
    });
  }

  // Sort: critical -> high -> medium, then highest financial impact
  const sevWeight: Record<ErrorSeverity, number> = { critical: 3, high: 2, medium: 1 };
  items.sort((a, b) => {
    const diff = sevWeight[b.severity] - sevWeight[a.severity];
    if (diff !== 0) return diff;
    return b.financialImpact - a.financialImpact;
  });

  return items;
}

export default function ErrorsCenterPanel({
  storeName,
  auditResult,
  orderBasePath,
  onInspectWaybill,
  onInspectCashout,
  onOpenLinkOrImportModal,
  onJumpToAuditTab,
  onNotify
}: ErrorsCenterPanelProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | UnifiedErrorCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | ErrorSeverity>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const allErrors = useMemo(
    () => collectUnifiedErrors(auditResult, storeName),
    [auditResult, storeName]
  );

  // Brand breakdown for errors
  const brandCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const err of allErrors) {
      map.set(err.brandName, (map.get(err.brandName) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allErrors]);

  const brandScopedErrors = useMemo(() => {
    if (selectedBrand === 'all') return allErrors;
    return allErrors.filter(e => e.brandName === selectedBrand);
  }, [allErrors, selectedBrand]);

  const summary = useMemo(() => {
    let criticalCount = 0;
    let totalImpact = 0;
    let financialErrorsCount = 0;
    let operationalErrorsCount = 0;
    const byCat: Record<UnifiedErrorCategory, number> = {
      unlinked_order: 0,
      untransferred_cod: 0,
      amount_or_bank_variance: 0,
      fee_anomaly: 0,
      fraud_or_price: 0,
      missing_compensation: 0,
      logistics_or_pickup: 0
    };

    for (const e of brandScopedErrors) {
      if (e.severity === 'critical') criticalCount += 1;
      totalImpact += e.financialImpact;
      byCat[e.category] += 1;
      if (
        e.category === 'untransferred_cod' ||
        e.category === 'amount_or_bank_variance' ||
        e.category === 'fee_anomaly' ||
        e.category === 'missing_compensation' ||
        e.category === 'fraud_or_price'
      ) {
        financialErrorsCount += 1;
      } else {
        operationalErrorsCount += 1;
      }
    }

    return {
      total: brandScopedErrors.length,
      criticalCount,
      totalImpact: Math.round(totalImpact * 100) / 100,
      financialErrorsCount,
      operationalErrorsCount,
      byCat
    };
  }, [brandScopedErrors]);

  const filteredErrors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return brandScopedErrors.filter(e => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (!q) return true;
      return (
        (e.trackingKey || '').toLowerCase().includes(q) ||
        (e.orderNumber || '').toLowerCase().includes(q) ||
        (e.cashoutId || '').toLowerCase().includes(q) ||
        e.customerName.toLowerCase().includes(q) ||
        (e.customerPhone || '').toLowerCase().includes(q) ||
        e.brandName.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    });
  }, [brandScopedErrors, categoryFilter, severityFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredErrors.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedErrors = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredErrors.slice(start, start + PAGE_SIZE);
  }, [filteredErrors, safePage]);

  const handleExportErrorsXlsx = () => {
    if (filteredErrors.length === 0) return;
    const rows = filteredErrors.map((e, idx) => ({
      '#': idx + 1,
      الخطورة: e.severity === 'critical' ? 'حرج' : e.severity === 'high' ? 'مرتفع' : 'متوسط',
      'تصنيف الخطأ': e.categoryLabel,
      البراند: e.brandName,
      'رقم البوليصة': e.trackingKey || '-',
      'رقم الأوردر': e.orderNumber || '-',
      'كود الدفعة': e.cashoutId || '-',
      العميل: e.customerName,
      الهاتف: e.customerPhone || '-',
      'الأثر المالي (ج.م)': e.financialImpact,
      العنوان: e.title,
      التفاصيل: e.description
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'مركز الأخطاء الموحد');
    XLSX.writeFile(wb, `all_errors_report_${selectedBrand === 'all' ? 'all' : selectedBrand}.xlsx`);
    onNotify?.(`تم تصدير ${filteredErrors.length} خطأ وتنبيه إلى ملف Excel.`);
  };

  return (
    <div className="space-y-5">
      {/* Header + Brand Selector */}
      <section className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3.5">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
              مركز الأخطاء والتنبيهات الموحّد
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              كل الأخطاء المحاسبية والتشغيلية (بوالص غير مربوطة، تحصيل بلا تحويل، فروقات بنك وتسعير، تعويضات ناقصة، ومرتجعات عالقة) في شاشة واحدة
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportErrorsXlsx}
            disabled={filteredErrors.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير الأخطاء Excel ({filteredErrors.length})</span>
          </button>
        </div>

        {/* Brand Filter Bar */}
        {brandCounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 ml-1 shrink-0">
              <Building2 className="w-3.5 h-3.5" />
              <span>البراند:</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedBrand('all');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedBrand === 'all'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>كل البراندات</span>
              <span className="font-mono tabular-nums opacity-85 mr-1.5">({allErrors.length})</span>
            </button>
            {brandCounts.slice(0, 6).map(b => (
              <button
                key={b.name}
                type="button"
                onClick={() => {
                  setSelectedBrand(b.name);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedBrand === b.name
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{b.name}</span>
                <span className="font-mono tabular-nums opacity-75 mr-1.5">({b.count})</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 4 Flat Executive Summary KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold">إجمالي الأخطاء المكتشفة</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-black text-slate-900 dark:text-white">
            {summary.total.toLocaleString('en-US')}
          </div>
          <div className="mt-1.5 text-[11px] font-mono tabular-nums text-rose-600 dark:text-rose-400 font-bold">
            منها {summary.criticalCount} خطأ حرج يتطلب تدخل فوري
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold">إجمالي المبالغ والفروقات المعرّضة</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatEgp(summary.totalImpact)}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            مجموع المستحقات والفروقات والمطالبات المفتوحة
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold">أخطاء مالية ومحاسبية</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-black text-slate-900 dark:text-white">
            {summary.financialErrorsCount.toLocaleString('en-US')}
          </div>
          <div className="mt-1.5 text-[11px] font-mono tabular-nums text-slate-500">
            بلا تحويل ({summary.byCat.untransferred_cod}) · فروقات ({summary.byCat.amount_or_bank_variance}) · شحن ({summary.byCat.fee_anomaly})
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold">بوالص غير مربوطة وتشغيلية</span>
            <Link2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-black text-slate-900 dark:text-white">
            {summary.operationalErrorsCount.toLocaleString('en-US')}
          </div>
          <div className="mt-1.5 text-[11px] font-mono tabular-nums text-slate-500">
            غير مربوط بالمتجر ({summary.byCat.unlinked_order}) · مرتجعات/بيك أب ({summary.byCat.logistics_or_pickup})
          </div>
        </div>
      </section>

      {/* Unified Filterable Errors Table */}
      <section className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="بحث برقم البوليصة، الأوردر، كود الدفعة، العميل، أو وصف الخطأ..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 text-[11px]">
                {(
                  [
                    { id: 'all', label: 'كل المستويات' },
                    { id: 'critical', label: 'حرج فقط' },
                    { id: 'high', label: 'مرتفع' },
                    { id: 'medium', label: 'متوسط' }
                  ] as const
                ).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSeverityFilter(s.id);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      severityFilter === s.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {(categoryFilter !== 'all' || severityFilter !== 'all' || searchQuery.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('all');
                    setSeverityFilter('all');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>مسح</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Strip */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'الكل', count: summary.total },
                { id: 'unlinked_order', label: 'غير مربوطة بالمتجر', count: summary.byCat.unlinked_order },
                { id: 'untransferred_cod', label: 'محصّل بدون تحويل', count: summary.byCat.untransferred_cod },
                {
                  id: 'amount_or_bank_variance',
                  label: 'فروقات مبالغ وبنك',
                  count: summary.byCat.amount_or_bank_variance
                },
                { id: 'fee_anomaly', label: 'أخطاء تسعير الشحن', count: summary.byCat.fee_anomaly },
                { id: 'fraud_or_price', label: 'فروقات أسعار / رقابة', count: summary.byCat.fraud_or_price },
                { id: 'missing_compensation', label: 'تعويضات ناقصة', count: summary.byCat.missing_compensation },
                { id: 'logistics_or_pickup', label: 'مرتجعات وبيك أب', count: summary.byCat.logistics_or_pickup }
              ] as const
            ).map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat.label}</span>
                <span className="font-mono tabular-nums opacity-75 mr-1">({cat.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Empty / Healthy State or Table */}
        {filteredErrors.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              {allErrors.length === 0 ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {allErrors.length === 0
                ? 'حساباتك نظيفة 100% — لا توجد أخطاء مكتشفة حالياً'
                : 'لا توجد أخطاء تطابق الفلتر أو البحث المحدد'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {allErrors.length === 0
                ? 'كل البوالص والدفعات المرفوعة متطابقة ولا توجد فروقات أو تعويضات ناقصة.'
                : 'جرّب اختيار تصنيف آخر أو عرض كل البراندات.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-bold">الخطورة والنوع</th>
                  <th className="py-3 px-3 font-bold">الأوردر / البوليصة والبراند</th>
                  <th className="py-3 px-3 font-bold">التشخيص والتفاصيل</th>
                  <th className="py-3 px-3 font-bold text-left">الأثر المالي</th>
                  <th className="py-3 px-4 font-bold text-center">إجراء فوري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedErrors.map(err => (
                  <tr
                    key={err.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/35 transition-colors"
                  >
                    <td className="py-3 px-4 align-top whitespace-nowrap">
                      <div
                        className={`font-black ${
                          err.severity === 'critical'
                            ? 'text-rose-600 dark:text-rose-400'
                            : err.severity === 'high'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {err.severity === 'critical'
                          ? 'حرج'
                          : err.severity === 'high'
                          ? 'مرتفع'
                          : 'متوسط'}{' '}
                        · {err.categoryLabel}
                      </div>
                      {err.dateStr && (
                        <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
                          {err.dateStr}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-x-1.5">
                        {err.trackingKey && (
                          <button
                            type="button"
                            onClick={() => onInspectWaybill(err.trackingKey!, err.cashoutId)}
                            className="font-mono tabular-nums font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            {err.trackingKey}
                          </button>
                        )}
                        {err.cashoutId && (
                          err.cashoutEntry ? (
                            <button
                              type="button"
                              onClick={() => onInspectCashout(err.cashoutEntry!)}
                              className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              {err.cashoutId}
                            </button>
                          ) : (
                            <span className="font-mono tabular-nums text-slate-500">
                              {err.cashoutId}
                            </span>
                          )
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-700 dark:text-slate-200 font-semibold">
                        {err.customerName}
                        {err.orderId && (
                          <Link
                            to={`${orderBasePath}/${err.orderId}`}
                            className="font-mono tabular-nums text-[#008060] dark:text-emerald-400 hover:underline mr-1.5"
                          >
                            (#{err.orderNumber})
                          </Link>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {err.brandName}
                        {err.customerPhone ? ` · ${err.customerPhone}` : ''}
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top max-w-md">
                      <div className="font-bold text-slate-900 dark:text-white">{err.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {err.description}
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top text-left font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={`font-black ${
                          err.financialImpact > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {err.financialImpact > 0 ? formatEgp(err.financialImpact) : '-'}
                      </span>
                    </td>

                    <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {err.sheetRow && (
                          <button
                            type="button"
                            onClick={() => onOpenLinkOrImportModal(err.sheetRow!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#008060] hover:bg-[#006b50] text-white text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>{err.sheetRow.matchedOrder ? 'تسوية شحن' : 'ربط / تنزيل'}</span>
                          </button>
                        )}
                        {err.trackingKey ? (
                          <button
                            type="button"
                            onClick={() => onInspectWaybill(err.trackingKey!, err.cashoutId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>فحص</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onJumpToAuditTab(err.targetAuditTab, err.cashoutId || err.trackingKey)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>عرض بالتدقيق</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredErrors.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-slate-900/40">
            <div className="text-slate-500 font-mono tabular-nums">
              عرض {((safePage - 1) * PAGE_SIZE + 1).toLocaleString('en-US')} –{' '}
              {Math.min(safePage * PAGE_SIZE, filteredErrors.length).toLocaleString('en-US')} من{' '}
              <strong className="text-slate-900 dark:text-white">
                {filteredErrors.length.toLocaleString('en-US')}
              </strong>{' '}
              خطأ وتنبيه
            </div>
            {totalPages > 1 && (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
