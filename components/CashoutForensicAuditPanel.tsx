import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Ghost,
  Landmark,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Upload
} from 'lucide-react';
import {
  CashoutForensicAuditEntry,
  CashoutForensicSummary
} from '../utils/codReconciliation';

interface CashoutForensicAuditPanelProps {
  summary: CashoutForensicSummary;
  searchQuery: string;
  onInspectCashoutId: (cashoutId: string) => void;
  onJumpToWaybill: (trackingKey: string) => void;
  onUploadBankStatement: () => void;
}

type ForensicSubView = 'all' | 'cashouts' | 'phantom' | 'dvc' | 'cycles' | 'bank';

const formatEgp = (val: number): string => {
  const num = Number.isFinite(val) ? val : 0;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م`;
};

export const CashoutForensicAuditPanel: React.FC<CashoutForensicAuditPanelProps> = ({
  summary,
  searchQuery,
  onInspectCashoutId,
  onJumpToWaybill,
  onUploadBankStatement
}) => {
  const [subView, setSubView] = useState<ForensicSubView>('all');
  const [showOnlyProblemCashouts, setShowOnlyProblemCashouts] = useState(false);
  const [showOutsideRangePhantoms, setShowOutsideRangePhantoms] = useState(false);

  const q = searchQuery.trim().toLowerCase();

  const filteredCashouts = useMemo(() => {
    return summary.cashoutAudits.filter(c => {
      if (showOnlyProblemCashouts) {
        const isIssue =
          c.verdict === 'short_cashout_deficit' ||
          c.bankMatchStatus === 'bank_missing_deposit' ||
          c.bankMatchStatus === 'bank_short_deposit';
        if (!isIssue) return false;
      }
      if (!q) return true;
      return (
        c.cashoutId.toLowerCase().includes(q) ||
        c.date.toLowerCase().includes(q) ||
        c.reasonSummary.toLowerCase().includes(q) ||
        (c.bankMatchedRef || '').toLowerCase().includes(q) ||
        (c.bankMatchedDescription || '').toLowerCase().includes(q) ||
        c.suspectedOmittedOrders.some(
          s =>
            s.trackingKey.toLowerCase().includes(q) ||
            (s.pairWithTrackingKey || '').toLowerCase().includes(q) ||
            (s.customerName || '').toLowerCase().includes(q)
        )
      );
    });
  }, [summary.cashoutAudits, showOnlyProblemCashouts, q]);

  const filteredPhantoms = useMemo(() => {
    return summary.phantomCashoutOrders.filter(p => {
      if (!showOutsideRangePhantoms && p.status !== 'phantom_missing_in_tx') return false;
      if (!q) return true;
      return (
        p.trackingKey.toLowerCase().includes(q) ||
        p.sheetCashoutId.toLowerCase().includes(q) ||
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.brandName || '').toLowerCase().includes(q)
      );
    });
  }, [summary.phantomCashoutOrders, showOutsideRangePhantoms, q]);

  const filteredDvc = useMemo(() => {
    if (!q) return summary.deliveriesVsCyclesMismatches;
    return summary.deliveriesVsCyclesMismatches.filter(
      m =>
        m.trackingKey.toLowerCase().includes(q) ||
        (m.customerName || '').toLowerCase().includes(q) ||
        (m.brandName || '').toLowerCase().includes(q) ||
        (m.dropoffCity || '').toLowerCase().includes(q) ||
        (m.cyclesCashoutId || '').toLowerCase().includes(q)
    );
  }, [summary.deliveriesVsCyclesMismatches, q]);

  const filteredBankRows = useMemo(() => {
    if (!q) return summary.bankRows;
    return summary.bankRows.filter(
      b =>
        b.description.toLowerCase().includes(q) ||
        b.reference.toLowerCase().includes(q) ||
        b.date.toLowerCase().includes(q) ||
        (b.matchedCashoutId || '').toLowerCase().includes(q) ||
        String(b.amount).includes(q)
    );
  }, [summary.bankRows, q]);

  const renderVerdictBadge = (c: CashoutForensicAuditEntry) => {
    if (c.verdict === 'short_cashout_deficit') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-black">
          <ShieldAlert className="w-3 h-3 shrink-0" />
          عجز {formatEgp(Math.abs(c.unexplainedVariance))}
        </span>
      );
    }
    if (c.verdict === 'verified_exact') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          مطابق 100%
        </span>
      );
    }
    if (c.verdict === 'explained_by_carryover') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-[11px] font-bold">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          مُفسّر بالرصيد المرحّل
        </span>
      );
    }
    if (c.verdict === 'surplus_or_partial_cycles') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          فائض +{formatEgp(c.unexplainedVariance)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
        بدون بوالص مربوطة
      </span>
    );
  };

  const renderBankStatusBadge = (c: CashoutForensicAuditEntry) => {
    if (c.bankMatchStatus === 'no_bank_sheet') {
      return <span className="text-[11px] text-slate-400 dark:text-slate-500">لم يُرفع كشف بنك</span>;
    }
    if (c.bankMatchStatus === 'bank_matched_exact') {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            دخل البنك
          </span>
          <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {formatEgp(c.bankMatchedAmount ?? c.cashoutAmount)} · {c.bankMatchedDate || '-'}
          </div>
        </div>
      );
    }
    if (c.bankMatchStatus === 'bank_short_deposit') {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-black">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            وصل ناقصاً {formatEgp(Math.abs(c.bankDepositDiff || 0))}
          </span>
          <div className="text-[10px] font-mono tabular-nums text-rose-600 dark:text-rose-400">
            إيداع فعلي: {formatEgp(c.bankMatchedAmount ?? 0)} ({c.bankMatchedDate || '-'})
          </div>
        </div>
      );
    }
    if (c.bankMatchStatus === 'bank_missing_deposit') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-black">
          <ShieldAlert className="w-3 h-3 shrink-0" />
          لم يظهر بكشف البنك!
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
        خارج فترة كشف البنك
      </span>
    );
  };

  const hasAnyData =
    summary.cashoutAudits.length > 0 ||
    summary.phantomCashoutOrders.length > 0 ||
    summary.deliveriesVsCyclesMismatches.length > 0 ||
    summary.hasBankStatementSheet;

  if (!hasAnyData) {
    return (
      <div className="py-16 px-6 text-center space-y-3">
        <Landmark className="w-10 h-10 text-slate-400 mx-auto" />
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          ارفع ملفي Cash Cycles و Transactions (واختيارياً Deliveries وكشف حساب البنك) لتفعيل التدقيق الثلاثي.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          يقارن المحرك كل دفعة Cash-out ID بمجموع صافي بوالصها والرصيد المرحّل، ويكتشف البوليصة الساقطة داخل الدفعة، والدفعات الوهمية، وتضارب COD بين Deliveries و Cash Cycles، ويطابق التحويلات مع كشف البنك.
        </p>
        <button
          type="button"
          onClick={onUploadBankStatement}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-bold hover:opacity-90 transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>رفع الشيتات أو كشف البنك</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Top 4 Forensic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setSubView('cashouts');
            setShowOnlyProblemCashouts(summary.shortCashoutCount > 0);
          }}
          className={`text-right rounded-2xl border p-3.5 transition-all duration-150 cursor-pointer ${
            summary.shortCashoutCount > 0
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/70'
              : 'bg-white dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              عجز دفعات التحويل (Cash-out)
            </span>
            <Scale
              className={`w-4 h-4 shrink-0 ${
                summary.shortCashoutCount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            />
          </div>
          <div
            className={`text-xl font-black font-mono tabular-nums ${
              summary.shortCashoutCount > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {formatEgp(summary.shortCashoutDeficitTotal)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary.shortCashoutCount} دفعة بها عجز · {summary.verifiedCashoutCount} مطابقة ·{' '}
            {summary.carryOverExplainedCount} بالرصيد المرحّل
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSubView('phantom')}
          className={`text-right rounded-2xl border p-3.5 transition-all duration-150 cursor-pointer ${
            summary.phantomCashoutCount > 0
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/70'
              : 'bg-white dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              دفعات وهمية غير موجودة بـ Transactions
            </span>
            <Ghost
              className={`w-4 h-4 shrink-0 ${
                summary.phantomCashoutCount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            />
          </div>
          <div
            className={`text-xl font-black font-mono tabular-nums ${
              summary.phantomCashoutCount > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {formatEgp(summary.phantomCashoutAmount)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary.phantomCashoutCount} بوليصة ({summary.phantomCashoutUniqueIds.length} كود دفعة)
            {summary.outsideTxRangeCount > 0
              ? ` · ${summary.outsideTxRangeCount} خارج فترة الكشف`
              : ''}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSubView('dvc')}
          className={`text-right rounded-2xl border p-3.5 transition-all duration-150 cursor-pointer ${
            summary.deliveriesCyclesMismatchCount > 0
              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/70'
              : 'bg-white dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              تضارب Deliveries ↔ Cash Cycles
            </span>
            <ArrowUpDown
              className={`w-4 h-4 shrink-0 ${
                summary.deliveriesCyclesMismatchCount > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            />
          </div>
          <div
            className={`text-xl font-black font-mono tabular-nums ${
              summary.deliveriesCyclesMismatchCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {formatEgp(summary.deliveriesCyclesShortfallAmount)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {summary.deliveriesCyclesMismatchCount} بوليصة بـ COD ناقص أو ساقطة من Cycles
          </div>
        </button>

        <div
          className={`rounded-2xl border p-3.5 ${
            summary.bankMissingCount > 0 || summary.bankShortCount > 0
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/70'
              : 'bg-white dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              مطابقة كشف البنك / إنستاباي
            </span>
            <Building2
              className={`w-4 h-4 shrink-0 ${
                summary.bankMissingCount > 0 || summary.bankShortCount > 0
                  ? 'text-rose-600'
                  : summary.hasBankStatementSheet
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            />
          </div>
          {summary.hasBankStatementSheet ? (
            <button
              type="button"
              onClick={() => setSubView('bank')}
              className="w-full text-right cursor-pointer"
            >
              <div
                className={`text-xl font-black font-mono tabular-nums ${
                  summary.bankMissingCount > 0 || summary.bankShortCount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {summary.bankMissingCount > 0 || summary.bankShortCount > 0
                  ? formatEgp(summary.bankMissingAmount + summary.bankShortAmount)
                  : `${summary.bankMatchedCount} دفعة مؤكدة`}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {summary.bankMatchedCount} مطابق · {summary.bankMissingCount} مفقود ·{' '}
                {summary.bankShortCount} ناقص
              </div>
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                لم يُرفع كشف بنك بعد
              </div>
              <button
                type="button"
                onClick={onUploadBankStatement}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-[11px] font-bold hover:opacity-90 transition cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>رفع كشف البنك / إنستاباي</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-Navigation Segmented Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'العرض الشامل', count: null, alert: false },
              {
                id: 'cashouts',
                label: 'تدقيق دفعات Cash-out',
                count: summary.cashoutAudits.length,
                alert: summary.shortCashoutCount > 0
              },
              {
                id: 'phantom',
                label: 'دفعات وهمية',
                count: summary.phantomCashoutCount,
                alert: summary.phantomCashoutCount > 0
              },
              {
                id: 'dvc',
                label: 'تضارب Deliveries↔Cycles',
                count: summary.deliveriesVsCyclesMismatches.length,
                alert: summary.deliveriesCyclesMismatchCount > 0
              },
              {
                id: 'cycles',
                label: 'إجماليات الدورات',
                count: null,
                alert: false
              },
              {
                id: 'bank',
                label: 'كشف البنك',
                count: summary.bankRows.length,
                alert: summary.bankMissingCount > 0 || summary.bankShortCount > 0
              }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubView(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                subView === tab.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                    subView === tab.id
                      ? 'bg-white/20 dark:bg-slate-900/15'
                      : tab.alert
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {(subView === 'all' || subView === 'cashouts') && summary.cashoutAudits.length > 0 && (
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyProblemCashouts}
              onChange={e => setShowOnlyProblemCashouts(e.target.checked)}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span>إظهار الدفعات التي بها عجز أو مشكلة بنك فقط</span>
          </label>
        )}
      </div>

      {/* SECTION 1: Closed-Equation Per-Cashout Audit Table + Smart Missing-Order Hunter */}
      {(subView === 'all' || subView === 'cashouts') && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-900">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>1. التدقيق الثلاثي لدفعات التحويل (Cash-out ID) وكاشف البوليصة الساقطة</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                يطابق المحوّل فعلياً في Transactions ضد صافي بوالص الدفعة في Cash Cycles + التسويات + الرصيد المرحّل − رسوم التحويل، ويبحث تلقائياً عن البوليصة المطابقة لأي عجز.
              </p>
            </div>
            {summary.txDateRange && (
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                نطاق Transactions: {summary.txDateRange.min} ← {summary.txDateRange.max}
              </span>
            )}
          </div>

          {filteredCashouts.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
              {showOnlyProblemCashouts
                ? 'ممتاز! لا توجد أي دفعة تحويل بها عجز غير مفسّر أو مشكلة مطابقة بنكية.'
                : 'لا توجد دفعات Cash Out في شيت Transactions المرفوع.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                    <th className="py-2.5 px-3 font-bold">كود الدفعة والتاريخ</th>
                    <th className="py-2.5 px-3 font-bold">البوالص والتسويات</th>
                    <th className="py-2.5 px-3 font-bold">الرصيد المرحّل</th>
                    <th className="py-2.5 px-3 font-bold">المستحق المتوقع</th>
                    <th className="py-2.5 px-3 font-bold">المحوّل فعلياً</th>
                    <th className="py-2.5 px-3 font-bold">الحكم والفرق</th>
                    <th className="py-2.5 px-3 font-bold">مطابقة البنك</th>
                    <th className="py-2.5 px-3 font-bold text-center">فحص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCashouts.map(c => {
                    const isDeficit = c.verdict === 'short_cashout_deficit';
                    return (
                      <React.Fragment key={c.id}>
                        <tr
                          className={`transition-colors ${
                            isDeficit || c.bankMatchStatus === 'bank_missing_deposit'
                              ? 'bg-rose-50/40 dark:bg-rose-950/15 hover:bg-rose-50/80 dark:hover:bg-rose-950/25'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                              {c.cashoutId}
                            </div>
                            <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              {c.date || '-'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                            <button
                              type="button"
                              onClick={() => onInspectCashoutId(c.cashoutId)}
                              title="اضغط لعرض الأوردرات المرتبطة بهذه الدفعة"
                              className="font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors cursor-pointer text-right"
                            >
                              {c.linkedOrderCount} بوليصة ({formatEgp(c.linkedNetTotal)})
                            </button>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {c.linkedAdjustmentsTotal !== 0 &&
                                `تسويات: ${c.linkedAdjustmentsTotal > 0 ? '+' : ''}${formatEgp(
                                  c.linkedAdjustmentsTotal
                                )} · `}
                              {c.transferFees > 0 ? `رسوم تحويل: -${formatEgp(c.transferFees)}` : 'بلا رسوم تحويل'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums text-[11px]">
                            {c.priorCarryOverBalance !== null ? (
                              <div>
                                <span
                                  className={
                                    c.priorCarryOverBalance < 0
                                      ? 'text-rose-600 dark:text-rose-400 font-bold'
                                      : 'text-slate-700 dark:text-slate-300 font-semibold'
                                  }
                                >
                                  سابق: {formatEgp(c.priorCarryOverBalance)}
                                </span>
                                {c.endingBalanceAfterCashout !== null && (
                                  <div className="text-[10px] text-slate-500">
                                    متبقي: {formatEgp(c.endingBalanceAfterCashout)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200">
                            {c.linkedOrderCount > 0 ? formatEgp(c.expectedFromOrdersNet) : '-'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                            <button
                              type="button"
                              onClick={() => onInspectCashoutId(c.cashoutId)}
                              title="اضغط لعرض الأوردرات المرتبطة بمبلغ التحويل"
                              className="inline-flex items-center gap-1.5 font-black text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline decoration-emerald-500/60 underline-offset-4 transition-colors cursor-pointer"
                            >
                              <span>{formatEgp(c.cashoutAmount)}</span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 max-w-[260px]">
                            <div className="mb-1">{renderVerdictBadge(c)}</div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                              {c.reasonSummary}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {renderBankStatusBadge(c)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onInspectCashoutId(c.cashoutId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>البوالص</span>
                            </button>
                          </td>
                        </tr>

                        {/* Smart Missing-Order Hunter Row (appears directly beneath short cashouts with matching waybills) */}
                        {isDeficit && c.suspectedOmittedOrders.length > 0 && (
                          <tr className="bg-rose-50/80 dark:bg-rose-950/30 border-b border-rose-200/70 dark:border-rose-900/60">
                            <td colSpan={8} className="py-2.5 px-4">
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="inline-flex items-center gap-1 font-black text-rose-700 dark:text-rose-300 shrink-0">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>
                                    كاشف البوليصة الساقطة (تطابق قيمة العجز{' '}
                                    {formatEgp(Math.abs(c.unexplainedVariance))}):
                                  </span>
                                </span>
                                {c.suspectedOmittedOrders.map((s, idx) => (
                                  <button
                                    key={`${c.id}_sus_${idx}`}
                                    type="button"
                                    onClick={() => onJumpToWaybill(s.trackingKey)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer font-mono tabular-nums"
                                    title="اضغط للبحث عن هذه البوليصة"
                                  >
                                    <Search className="w-3 h-3 text-rose-500 shrink-0" />
                                    <span className="font-black">
                                      {s.matchType === 'pair_net'
                                        ? `${s.trackingKey} + ${s.pairWithTrackingKey}`
                                        : s.trackingKey}
                                    </span>
                                    <span className="text-[10px] font-sans font-bold text-slate-600 dark:text-slate-300">
                                      {s.matchType === 'pair_net'
                                        ? `(مجموع ${formatEgp(s.pairCombinedNet || 0)})`
                                        : s.matchType === 'exact_cod'
                                        ? `(COD ${formatEgp(s.sheetGrossAmount)})`
                                        : `(صافي ${formatEgp(s.sheetNetPayout)})`}
                                    </span>
                                    {s.customerName && (
                                      <span className="text-[10px] font-sans text-slate-500">
                                        · {s.customerName}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Phantom / Ghost Cash-out ID Radar */}
      {(subView === 'all' || subView === 'phantom') &&
        (summary.phantomCashoutOrders.length > 0 || subView === 'phantom') && (
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-900">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Ghost className="w-4 h-4 text-rose-600" />
                  <span>2. رادار الدفعات الوهمية (مختومة بـ Cash-out ID غير موجود في Transactions)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  يكتشف البوالص التي تحمل كود تحويل داخل نطاق تواريخ ملف Transactions المرفوع لكنها لم تنزل كحركة تحويل فعلية!
                </p>
              </div>
              {summary.outsideTxRangeCount > 0 && (
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOutsideRangePhantoms}
                    onChange={e => setShowOutsideRangePhantoms(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>إظهار ما هو خارج فترة الكشف ({summary.outsideTxRangeCount})</span>
                </label>
              )}
            </div>

            {filteredPhantoms.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                ممتاز! كل أكواد الـ Cash-out ID داخل نطاق كشف الحساب موجودة ومثبتة في Transactions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                      <th className="py-2.5 px-3 font-bold">رقم البوليصة</th>
                      <th className="py-2.5 px-3 font-bold">العميل والبراند</th>
                      <th className="py-2.5 px-3 font-bold">كود الدفعة المزعوم</th>
                      <th className="py-2.5 px-3 font-bold">التاريخ</th>
                      <th className="py-2.5 px-3 font-bold">COD</th>
                      <th className="py-2.5 px-3 font-bold">الصافي المستحق</th>
                      <th className="py-2.5 px-3 font-bold">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPhantoms.slice(0, 120).map(p => (
                      <tr
                        key={p.id}
                        className={
                          p.status === 'phantom_missing_in_tx'
                            ? 'bg-rose-50/35 dark:bg-rose-950/15 hover:bg-rose-50/70'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40 opacity-80'
                        }
                      >
                        <td className="py-2.5 px-3 font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                          {p.trackingKey}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {p.customerName || '-'}
                          </div>
                          {p.brandName && (
                            <div className="text-[10px] text-slate-500">{p.brandName}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-black text-[11px] ${
                              p.status === 'phantom_missing_in_tx'
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {p.sheetCashoutId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {p.sheetPaidAt || p.sheetDeliveredAt || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          {formatEgp(p.sheetGrossAmount)}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {formatEgp(p.sheetNetPayout)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-300 max-w-[300px]">
                          {p.reasonSummary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* SECTION 3: Direct Deliveries ↔ Cash Cycles COD Mismatch Audit */}
      {(subView === 'all' || subView === 'dvc') &&
        (summary.deliveriesVsCyclesMismatches.length > 0 || subView === 'dvc') && (
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900">
              <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <ArrowUpDown className="w-4 h-4 text-amber-600" />
                <span>3. مطابقة قيمة التحصيل (COD) بين شيت Deliveries وشيت Cash Cycles</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                يكتشف أي شحنة سُلّمت بقيمة COD معينة في Deliveries لكنها نزلت في Cash Cycles بـ 0 أو بمبلغ أقل أو سقطت بالكامل.
              </p>
            </div>

            {filteredDvc.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                ممتاز! جميع قيم الـ COD في Deliveries مطابقة تماماً لشيت Cash Cycles.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                      <th className="py-2.5 px-3 font-bold">رقم البوليصة</th>
                      <th className="py-2.5 px-3 font-bold">العميل والبراند</th>
                      <th className="py-2.5 px-3 font-bold">COD في Deliveries</th>
                      <th className="py-2.5 px-3 font-bold">COD في Cash Cycles</th>
                      <th className="py-2.5 px-3 font-bold">الفارق</th>
                      <th className="py-2.5 px-3 font-bold">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDvc.slice(0, 120).map(m => (
                      <tr
                        key={m.id}
                        className={
                          m.mismatchKind === 'cod_higher_in_cycles'
                            ? 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                            : 'bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/60'
                        }
                      >
                        <td className="py-2.5 px-3 font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                          <div>{m.trackingKey}</div>
                          {m.cyclesCashoutId && (
                            <div className="text-[10px] font-normal text-slate-500">
                              {m.cyclesCashoutId}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {m.customerName || '-'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {m.brandName || '-'}
                            {m.dropoffCity ? ` · ${m.dropoffCity}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatEgp(m.deliveriesCod)}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-bold whitespace-nowrap">
                          <span
                            className={
                              m.cyclesCod < m.deliveriesCod
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {formatEgp(m.cyclesCod)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-black whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              m.codDifference > 0
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {m.codDifference > 0
                              ? `-${formatEgp(m.codDifference)}`
                              : `+${formatEgp(Math.abs(m.codDifference))}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-300 max-w-[320px]">
                          {m.reasonSummary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* SECTION 4: Aggregate Cycle Totals Comparison */}
      {(subView === 'all' || subView === 'cycles') && summary.cycleTotalsComparison.hasBothSheets && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-900">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>4. مقارنة إجماليات دورات التحصيل والمصاريف (Transactions مقابل Cash Cycles)</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {summary.cycleTotalsComparison.noteAr}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {summary.cycleTotalsComparison.txDateRange && (
                <span>
                  Transactions: {summary.cycleTotalsComparison.txDateRange.min} ←{' '}
                  {summary.cycleTotalsComparison.txDateRange.max}
                </span>
              )}
              {summary.cycleTotalsComparison.cyclesDateRange && (
                <span>
                  Cash Cycles: {summary.cycleTotalsComparison.cyclesDateRange.min} ←{' '}
                  {summary.cycleTotalsComparison.cyclesDateRange.max}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                  <th className="py-2.5 px-4 font-bold">البند الإجمالي</th>
                  <th className="py-2.5 px-4 font-bold">سجل Transactions (الدورات)</th>
                  <th className="py-2.5 px-4 font-bold">مجموع Cash Cycles (المدفوع)</th>
                  <th className="py-2.5 px-4 font-bold">إجمالي Cash Cycles (الكل)</th>
                  <th className="py-2.5 px-4 font-bold">الفارق (Transactions − المدفوع)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                <tr>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-800 dark:text-slate-100">
                    إجمالي تحصيلات الكاش (Collection Cycle / COD)
                  </td>
                  <td className="py-2.5 px-4 font-bold text-emerald-700 dark:text-emerald-400">
                    {formatEgp(summary.cycleTotalsComparison.txCollectionCyclesTotal)}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                    {formatEgp(summary.cycleTotalsComparison.sheetsPaidCodTotal)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">
                    {formatEgp(summary.cycleTotalsComparison.sheetsAllCodTotal)}
                  </td>
                  <td
                    className={`py-2.5 px-4 font-black ${
                      summary.cycleTotalsComparison.collectionGapVsPaid < -10
                        ? 'text-rose-600 dark:text-rose-400'
                        : summary.cycleTotalsComparison.collectionGapVsPaid > 10
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {summary.cycleTotalsComparison.collectionGapVsPaid > 0 ? '+' : ''}
                    {formatEgp(summary.cycleTotalsComparison.collectionGapVsPaid)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-bold text-slate-800 dark:text-slate-100">
                    إجمالي مصاريف بوسطة (Bosta Fees Cycle)
                  </td>
                  <td className="py-2.5 px-4 font-bold text-rose-700 dark:text-rose-400">
                    {formatEgp(summary.cycleTotalsComparison.txFeesCyclesTotal)}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                    {formatEgp(summary.cycleTotalsComparison.sheetsPaidFeesTotal)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">
                    {formatEgp(summary.cycleTotalsComparison.sheetsAllFeesTotal)}
                  </td>
                  <td
                    className={`py-2.5 px-4 font-black ${
                      summary.cycleTotalsComparison.feesGapVsPaid > 10
                        ? 'text-rose-600 dark:text-rose-400'
                        : summary.cycleTotalsComparison.feesGapVsPaid < -10
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {summary.cycleTotalsComparison.feesGapVsPaid > 0 ? '+' : ''}
                    {formatEgp(summary.cycleTotalsComparison.feesGapVsPaid)}
                  </td>
                </tr>
                <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                  <td className="py-2.5 px-4 font-sans font-black text-slate-900 dark:text-white">
                    صافي الدورات (التحصيلات − المصاريف)
                  </td>
                  <td className="py-2.5 px-4 font-black text-slate-900 dark:text-white">
                    {formatEgp(summary.cycleTotalsComparison.txNetCyclesTotal)}
                  </td>
                  <td className="py-2.5 px-4 font-black text-slate-900 dark:text-white">
                    {formatEgp(summary.cycleTotalsComparison.sheetsPaidNetTotal)}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-slate-600 dark:text-slate-300">
                    {formatEgp(summary.cycleTotalsComparison.sheetsAllNetTotal)}
                  </td>
                  <td
                    className={`py-2.5 px-4 font-black ${
                      summary.cycleTotalsComparison.netCycleGapVsPaid < -10
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {summary.cycleTotalsComparison.netCycleGapVsPaid > 0 ? '+' : ''}
                    {formatEgp(summary.cycleTotalsComparison.netCycleGapVsPaid)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: Bank Statement / InstaPay CSV Matching */}
      {(subView === 'all' || subView === 'bank') && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-900">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>5. مطابقة كشف الحساب البنكي / إنستاباي (Bank Statement Auto-Match)</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                يدعم كشوف حسابات CIB والأهلي وبنك مصر و QNB وإنستاباي (CSV / XLSX) لمطابقة كل تحويل Cash Out مع الإيداع الفعلي بحسابك.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {summary.bankDateRange && (
                <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  فترة كشف البنك: {summary.bankDateRange.min} ← {summary.bankDateRange.max}
                </span>
              )}
              <button
                type="button"
                onClick={onUploadBankStatement}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-[11px] font-bold hover:opacity-90 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{summary.hasBankStatementSheet ? 'إضافة كشف بنك آخر' : 'رفع كشف البنك / إنستاباي'}</span>
              </button>
            </div>
          </div>

          {!summary.hasBankStatementSheet ? (
            <div className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
              ارفع ملف كشف حساب البنك (Excel أو CSV) وسيقوم النظام تلقائياً بتصنيفه ومطابقة كل دفعة Cash Out بإيداعها الفعلي وكشف أي تحويل لم يصل لحسابك.
            </div>
          ) : filteredBankRows.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
              لا توجد حركات إيداع (دائن) مطابقة للبحث في ملف كشف البنك المرفوع.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                    <th className="py-2.5 px-3 font-bold">التاريخ</th>
                    <th className="py-2.5 px-3 font-bold">مبلغ الإيداع (دائن)</th>
                    <th className="py-2.5 px-3 font-bold">البيان / الوصف</th>
                    <th className="py-2.5 px-3 font-bold">المرجع</th>
                    <th className="py-2.5 px-3 font-bold">دفعة بوسطة المطابقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBankRows.slice(0, 100).map(br => (
                    <tr
                      key={br.id}
                      className={
                        br.matchedCashoutId
                          ? 'bg-emerald-50/25 dark:bg-emerald-950/10 hover:bg-emerald-50/50'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {br.date || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        +{formatEgp(br.amount)}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-700 dark:text-slate-200 max-w-[300px] truncate" title={br.description}>
                        {br.description || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                        {br.reference || '-'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {br.matchedCashoutId ? (
                          <button
                            type="button"
                            onClick={() => onInspectCashoutId(br.matchedCashoutId!)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono tabular-nums text-[11px] font-bold hover:underline cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{br.matchedCashoutId}</span>
                            {br.matchDiff !== undefined && Math.abs(br.matchDiff) > 0.01 && (
                              <span className="text-[10px] text-rose-600 dark:text-rose-400">
                                ({br.matchDiff > 0 ? '+' : ''}
                                {br.matchDiff})
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">إيداع غير مربوط ببوسطة</span>
                        )}
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
};

export default CashoutForensicAuditPanel;
