import React, { useState, useMemo } from 'react';
import { Settings, Partner, PartnerTransaction, Order, Wallet, FinancialPeriod, Treasury } from '../types';
import { 
  Lock, RefreshCw, CheckCircle2, AlertTriangle, ArrowRightLeft, DollarSign, 
  Package, TrendingUp, Calendar, FileText, Download, Printer, ShieldCheck, 
  Sparkles, X, ChevronDown, ChevronUp, Layers, Check, HelpCircle, History,
  ArrowUpRight, ArrowDownLeft, AlertCircle
} from 'lucide-react';
import { getLatestProductCost, calculateOrderProfitLoss, findProductInSettings, resolveItemCatalogPrice, getStandardShippingFee, getOrderProductCost } from '../utils/financials';
import { exportHTMLToPDF } from '../utils/pdfHelper';

interface PeriodClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  orders: Order[];
  wallet: Wallet;
  setWallet?: React.Dispatch<React.SetStateAction<Wallet>>;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
}

export const PeriodClosingModal: React.FC<PeriodClosingModalProps> = ({
  isOpen,
  onClose,
  settings,
  updateSettings,
  orders,
  wallet,
  setWallet,
  treasury,
  setTreasury
}) => {
  const [activeStep, setActiveStep] = useState<'review' | 'equalize' | 'confirm' | 'history'>('review');
  const [periodName, setPeriodName] = useState(() => {
    const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    return `الفترة المالية المنتهية في ${today}`;
  });
  const [notes, setNotes] = useState('');
  const [executionMode, setExecutionMode] = useState<'smart_date_cutoff' | 'full_rollover'>('smart_date_cutoff');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedHistoricalPeriod, setSelectedHistoricalPeriod] = useState<FinancialPeriod | null>(null);

  // Manual / Partial Transaction Dialog State for Equalization
  const [partnerTxModal, setPartnerTxModal] = useState<{
    partner: any;
    diff: number;
    type: 'deposit' | 'withdraw';
    amount: string;
    account: string;
    note: string;
  } | null>(null);

  // 1. Calculate Current Inventory Value (at Cost)
  const inventoryValuation = useMemo(() => {
    let totalCost = 0;
    let totalSelling = 0;
    let totalItems = 0;

    (settings.products || []).forEach(p => {
      const pCost = p.costPrice || 0;
      const pPrice = p.price || 0;
      
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const qty = Number(v.stockQuantity ?? v.stock ?? 0);
          if (qty > 0) {
            const vCost = v.costPrice !== undefined ? v.costPrice : pCost;
            const vPrice = v.price || pPrice;
            totalCost += (qty * vCost);
            totalSelling += (qty * vPrice);
            totalItems += qty;
          }
        });
      } else {
        const qty = Number(p.stockQuantity ?? p.stock ?? 0);
        if (qty > 0) {
          totalCost += (qty * pCost);
          totalSelling += (qty * pPrice);
          totalItems += qty;
        }
      }
    });

    return { totalCost, totalSelling, totalItems };
  }, [settings.products]);

  // 2. Financial Metrics for the Current Period (Matches PartnersPage & Reports)
  const periodMetrics = useMemo(() => {
    let totalSuccessfulNetPos = 0;
    let totalSuccessfulNetShipping = 0;
    let totalCogs = 0;
    let returnsLosses = 0;
    let totalRevenue = 0;

    orders.forEach(order => {
      const isPos = order.channel === 'pos' || 
                    order.shippingCompany === 'كاشير - بيع مباشر' || 
                    order.shippingArea === 'نقطة البيع' ||
                    (order.id && order.id.startsWith('POS-'));
      const { net, loss } = calculateOrderProfitLoss(order, settings);
      const isReturnOrFailed = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(order.status);
      const isExchange = order.status === 'تم_الاستبدال';
      const hasLoss = loss > 0 || net < 0;

      if (isReturnOrFailed || isExchange || hasLoss) {
        const actualLoss = loss > 0 ? loss : (net < 0 ? Math.abs(net) : 0);
        returnsLosses += actualLoss;
      } else if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(order.status)) {
        if (isPos) {
          totalSuccessfulNetPos += net;
        } else {
          totalSuccessfulNetShipping += net;
        }
        totalCogs += getOrderProductCost(order, settings);
        totalRevenue += (order.totalPrice || 0);
      }
    });

    const adminExpenses = (wallet?.transactions || [])
      .filter(t => {
        const isExpenseCategory = t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_') || (settings?.expenseCategories || []).includes(t.category || '');
        const isManualWithdrawal = t.category === 'manual_withdrawal';
        const isNotPartnerTx = !t.note?.includes('معاملة شريك');
        return t.type === 'سحب' && (isExpenseCategory || isManualWithdrawal) && isNotPartnerTx;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const otherIncome = (wallet?.transactions || [])
      .filter(t => {
        const isNotPartnerTx = !t.note?.includes('معاملة شريك');
        const isNotPosTx = !t.note?.includes('مبيعات كاشير');
        return t.type === 'إيداع' && t.category === 'manual_deposit' && isNotPartnerTx && isNotPosTx;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = returnsLosses + adminExpenses;
    const netProfit = totalSuccessfulNetPos + totalSuccessfulNetShipping + otherIncome - totalExpenses;

    const distributedProfits = (settings?.partnerTransactions || [])
      .filter(t => t.type === 'profit_distribution')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const remainingProfit = Math.max(0, netProfit - distributedProfits);

    return {
      totalRevenue,
      totalCogs,
      totalLoss: returnsLosses,
      totalExpenses,
      netProfit,
      distributedProfits,
      remainingProfit
    };
  }, [orders, settings, wallet]);

  // 3. Partner Performance & Equalization Math (Canonical ledger balance + unallocated profit share)
  const partnersEqualization = useMemo(() => {
    const partners = settings.partners || [];
    const transactions = settings.partnerTransactions || [];
    const totalInventoryCost = inventoryValuation.totalCost;

    return partners.map(p => {
      const pTxs = transactions.filter(t => t.partnerId === p.id || t.partnerId === `part_${p.id}` || t.partnerId === `partner_${p.id}`);
      
      const ratio = p.profitRatio || 0;
      
      // Calculate running balance from transactions
      const txComputedBalance = pTxs.reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        if (['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(t.type)) {
          return sum + amount;
        } else if (t.type === 'pos_collection') {
          return sum;
        } else {
          return sum - amount;
        }
      }, 0);

      // The live ledger balance of the partner
      const currentLedgerBalance = p.balance !== undefined && p.balance !== null ? Number(p.balance) : txComputedBalance;
      
      // Partner's share of undistributed net profit for the current period
      const currentProfitShare = (periodMetrics.remainingProfit * ratio) / 100;
      
      // Total available balance/equity = Recorded balance + unallocated profit share
      const currentAvailableBalance = currentLedgerBalance + currentProfitShare;
      
      // Target share in inventory (Capital required to cover their share in the opening stock)
      const targetInventoryShare = (totalInventoryCost * ratio) / 100;
      
      // Difference:
      // > 0: Partner has excess funds -> Withdraw cash
      // < 0: Partner has deficit -> Deposit cash
      const equalizationDifference = currentAvailableBalance - targetInventoryShare;

      return {
        id: p.id,
        name: p.name,
        ratio,
        currentLedgerBalance,
        txComputedBalance,
        currentProfitShare,
        currentAvailableBalance,
        targetInventoryShare,
        equalizationDifference, // > 0: Excess to withdraw, < 0: Deficit to deposit
        isEqual: Math.abs(equalizationDifference) < 1
      };
    });
  }, [settings.partners, settings.partnerTransactions, inventoryValuation.totalCost, periodMetrics.remainingProfit]);

  // Handle Manual/Partial Partner Equalization Transaction
  const handleExecutePartnerTx = () => {
    if (!partnerTxModal) return;
    const amountNum = Number(partnerTxModal.amount);
    if (!amountNum || amountNum <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    const { partner, type, account, note } = partnerTxModal;
    const todayIso = new Date().toISOString();
    const todayDate = todayIso.split('T')[0];
    
    // Backdate equalization transactions to yesterday so they belong to the closing period
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const txDate = (note && (note.includes('تسوية') || note.includes('مقاصة'))) ? yesterday : todayDate;
    
    const isWithdrawal = type === 'withdraw';
    const txId = `eq_${type}_${partner.id}_${Date.now()}`;

    // 1. Create Partner Transaction
    const newPartnerTx: PartnerTransaction = {
      id: txId,
      partnerId: partner.id,
      partnerName: partner.name,
      type: isWithdrawal ? 'personal_withdrawal' : 'capital_addition',
      amount: amountNum,
      date: txDate,
      notes: note || (isWithdrawal ? `تسوية مقاصة (سحب فائض نقدياً)` : `تسوية مقاصة (إيداع عجز لتغطية حصة البضاعة)`)
    };

    // 2. Update Partner Balance
    const updatedPartners = (settings.partners || []).map(p => {
      if (p.id === partner.id) {
        const curBal = Number(p.balance ?? 0);
        return {
          ...p,
          balance: isWithdrawal ? curBal - amountNum : curBal + amountNum
        };
      }
      return p;
    });

    // 3. Update Treasury/Wallet if selected
    if (account === 'central_wallet' && setWallet) {
      setWallet(prev => ({
        ...prev,
        balance: isWithdrawal ? prev.balance - amountNum : prev.balance + amountNum,
        transactions: [
          {
            id: `W-${txId}`,
            type: isWithdrawal ? 'سحب' : 'إيداع',
            amount: amountNum,
            date: txDate,
            note: `معاملة تسوية مقاصة مع الشريك ${partner.name}: ${note || ''}`,
            category: isWithdrawal ? 'manual_withdrawal' : 'manual_deposit',
            status: 'completed'
          } as any,
          ...(prev.transactions || [])
        ]
      }));
    } else if (account && account !== 'none' && setTreasury && treasury) {
      setTreasury((prev: any) => {
        if (!prev) return prev;
        const updatedAccounts = (prev.accounts || []).map((acc: any) => {
          if (acc.id === account) {
            return {
              ...acc,
              balance: isWithdrawal ? Number(acc.balance || 0) - amountNum : Number(acc.balance || 0) + amountNum
            };
          }
          return acc;
        });

        const newTreasuryTx = {
          id: `T-${txId}`,
          date: txDate,
          type: isWithdrawal ? 'withdrawal' : 'deposit',
          amount: amountNum,
          description: `معاملة تسوية مقاصة مع الشريك ${partner.name}: ${note || ''}`,
          toAccountId: isWithdrawal ? undefined : account,
          fromAccountId: isWithdrawal ? account : undefined,
          reference: txId
        };

        return {
          ...prev,
          accounts: updatedAccounts,
          transactions: [newTreasuryTx, ...(prev.transactions || [])]
        };
      });
    }

    // 4. Update Settings
    updateSettings({
      ...settings,
      partners: updatedPartners,
      partnerTransactions: [newPartnerTx, ...(settings.partnerTransactions || [])]
    });

    setPartnerTxModal(null);
    setSuccessMessage(`تم تسجيل عملية ${isWithdrawal ? 'السحب' : 'الإيداع'} للشريك (${partner.name}) بقيمة ${amountNum.toLocaleString('ar-EG')} ج.م بنجاح!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Handle Auto-Equalization
  const handleAutoEqualize = () => {
    if (!settings.partners || settings.partners.length === 0) return;

    const newTransactions: PartnerTransaction[] = [...(settings.partnerTransactions || [])];
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const txDate = yesterday; // Always backdate auto-equalization to old period

    partnersEqualization.forEach(p => {
      const diff = p.equalizationDifference;
      if (Math.abs(diff) >= 1) {
        if (diff > 0) {
          // Partner has excess: Create a settlement withdrawal
          newTransactions.push({
            id: `eq_withdraw_${p.id}_${Date.now()}`,
            partnerId: p.id,
            partnerName: p.name,
            type: 'personal_withdrawal',
            amount: Math.round(diff),
            date: txDate,
            notes: `تسوية مقاصة بضاعة المخزون (سحب الفائض لمعادلة الحصة في المخزون)`
          });
        } else {
          // Partner has deficit: Create an equalization deposit
          newTransactions.push({
            id: `eq_deposit_${p.id}_${Date.now()}`,
            partnerId: p.id,
            partnerName: p.name,
            type: 'capital_addition',
            amount: Math.round(Math.abs(diff)),
            date: txDate,
            notes: `تسوية مقاصة بضاعة المخزون (إيداع الفارق لمعادلة الحصة في المخزون)`
          });
        }
      }
    });

    const updatedPartners = (settings.partners || []).map(p => {
      const eq = partnersEqualization.find(e => e.id === p.id);
      if (!eq) return p;
      return {
        ...p,
        balance: Math.round(eq.targetInventoryShare)
      };
    });

    updateSettings({
      ...settings,
      partners: updatedPartners,
      partnerTransactions: newTransactions
    });

    setSuccessMessage('تم تطبيق سندات تسوية المقاصة بنجاح وتطابقت أرصدة جميع الشركاء مع حصصهم في البضاعة!');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Execute Financial Period Rollover
  const handleExecutePeriodClosing = () => {
    setIsProcessing(true);
    try {
      const now = new Date();
      const closedAt = now.toISOString();
      const startDate = settings.activePeriodStartDate || (orders.length > 0 ? orders[orders.length - 1]?.date?.split('T')[0] : now.toISOString().split('T')[0]);
      const endDate = now.toISOString().split('T')[0];

      // Build Snapshot
      const periodSnapshot: FinancialPeriod = {
        id: `period_${Date.now()}`,
        name: periodName,
        startDate: startDate || endDate,
        endDate,
        closedAt,
        closedBy: 'المدير المالي',
        openingInventoryValue: settings.openingInventoryValue || inventoryValuation.totalCost,
        closingInventoryValue: inventoryValuation.totalCost,
        totalSales: periodMetrics.totalRevenue,
        cogs: periodMetrics.totalCogs,
        grossProfit: periodMetrics.totalRevenue - periodMetrics.totalCogs,
        totalExpenses: periodMetrics.totalExpenses,
        totalLosses: periodMetrics.totalLoss,
        netProfit: periodMetrics.netProfit,
        distributedProfits: periodMetrics.distributedProfits,
        partnerBalancesSnapshot: partnersEqualization.map(p => ({
          partnerId: p.id,
          partnerName: p.name,
          profitRatio: p.ratio,
          capital: p.currentLedgerBalance,
          finalBalance: p.currentAvailableBalance,
          inventoryShare: p.targetInventoryShare,
          adjustmentAmount: p.equalizationDifference,
          newOpeningCapital: p.currentAvailableBalance
        })),
        notes,
        status: 'closed'
      };

      const updatedFinancialPeriods = [periodSnapshot, ...(settings.financialPeriods || [])];

      // Update Partners Capital to equal their Inventory Share for the new period
      const updatedPartners = (settings.partners || []).map(p => {
        const eq = partnersEqualization.find(e => e.id === p.id);
        const newCap = eq ? Math.round(eq.currentAvailableBalance) : (p.capital || 0);
        return {
          ...p,
          capital: newCap,
          initialCapital: newCap,
          balance: newCap
        };
      });

      // Update System Settings for the new Period
      const newSettings: Settings = {
        ...settings,
        financialPeriods: updatedFinancialPeriods,
        partners: updatedPartners,
        activePeriodStartDate: endDate, // New period starts from today!
        activePeriodName: `الفترة المالية الجديدة (${endDate})`,
        openingInventoryValue: inventoryValuation.totalCost
      };

      updateSettings(newSettings);

      setSuccessMessage('🎉 تم إقفال الدورة المالية بنجاح وبدء الدورة الجديدة برصيد البضاعة الحالي!');
      setActiveStep('history');
      setSelectedHistoricalPeriod(periodSnapshot);
    } catch (err) {
      console.error('Period Closing Error:', err);
      alert('حدث خطأ أثناء إقفال الفترة المالية');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export Period Closing Certificate
  const handleExportCertificatePDF = async () => {
    const certElement = document.getElementById('period-closing-certificate');
    if (!certElement) return;
    try {
      await exportHTMLToPDF(certElement, 'portrait', `محضر_إقفال_فترة_مالية_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('حدث خطأ أثناء تصدير ملف PDF');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex justify-between items-center border-b border-indigo-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300">
              <Lock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">إقفال الفترة المالية وبدء دورة محاسبية جديدة</h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full">
                  Financial Rollover & Inventory Equalization
                </span>
              </div>
              <p className="text-xs text-indigo-200/70 mt-0.5">
                تسوية مقاصة الشركاء وفق بضاعة المخزون وتدوير الأرصدة لدورة جديدة نظيفة ومطابقة 100%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-indigo-200/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs / Stepper */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveStep('review')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              activeStep === 'review' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
            <span>معاينة موقف الإقفال والمخزون</span>
          </button>

          <button
            onClick={() => setActiveStep('equalize')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              activeStep === 'equalize' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
            <span>تسوية مقاصة الشركاء (معادلة البضاعة)</span>
          </button>

          <button
            onClick={() => setActiveStep('confirm')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              activeStep === 'confirm' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
            <span>تنفيذ الإقفال وبدء الدورة الجديدة</span>
          </button>

          <button
            onClick={() => setActiveStep('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all mr-auto ${
              activeStep === 'history' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <History size={15} />
            <span>سجل الفترات السابقة ({(settings.financialPeriods || []).length})</span>
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="m-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-sm font-bold animate-in slide-in-from-top-2">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">

          {/* STEP 1: REVIEW CURRENT POSITION */}
          {activeStep === 'review' && (
            <div className="space-y-6 animate-in fade-in-5 duration-200">
              {/* Guidance Box */}
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3 leading-relaxed">
                <HelpCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-sm mb-1 text-blue-950 dark:text-blue-100">ما الذي يحدث عند إقفال الفترة المالية؟</strong>
                  يقوم السيستم بحصر قيمة البضاعة المتاحة حالياً في المخازن بسعر التكلفة، ومقارنتها بأرصدة الشركاء الحالية لتحديد المبالغ الواجب سحبها أو إيداعها لتتطابق حصة كل شريك مع نصيبه في البضاعة تماماً لبدء دورة جديدة برأس مال عيني افتتاحي.
                </div>
              </div>

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                  <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs font-bold mb-1">
                    <span>قيمة بضاعة المخزون الحالية</span>
                    <Package size={18} />
                  </div>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
                    {inventoryValuation.totalCost.toLocaleString('ar-EG')} ج.م
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-500 mt-1">
                    {inventoryValuation.totalItems.toLocaleString()} قطعة متاحة بسعر التكلفة
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40">
                  <div className="flex items-center justify-between text-indigo-800 dark:text-indigo-300 text-xs font-bold mb-1">
                    <span>إجمالي المبيعات المحققة</span>
                    <TrendingUp size={18} />
                  </div>
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
                    {periodMetrics.totalRevenue.toLocaleString('ar-EG')} ج.م
                  </div>
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-500 mt-1">
                    تكلفة بضاعة مباعة: {periodMetrics.totalCogs.toLocaleString()} ج.م
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                  <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-1">
                    <span>صافي الأرباح المحققة</span>
                    <DollarSign size={18} />
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                    {periodMetrics.netProfit.toLocaleString('ar-EG')} ج.م
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-1">
                    موزع منها: {periodMetrics.distributedProfits.toLocaleString()} ج.م
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                  <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 text-xs font-bold mb-1">
                    <span>إجمالي المصروفات والخسائر</span>
                    <AlertTriangle size={18} />
                  </div>
                  <div className="text-2xl font-black text-rose-700 dark:text-rose-400">
                    {(periodMetrics.totalExpenses + periodMetrics.totalLoss).toLocaleString('ar-EG')} ج.م
                  </div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-500 mt-1">
                    مصاريف: {periodMetrics.totalExpenses.toLocaleString()} | خسائر: {periodMetrics.totalLoss.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Action to Next Step */}
              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setActiveStep('equalize')}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all shadow-md shadow-indigo-200 dark:shadow-none"
                >
                  <span>الانتقال لجدول تسوية مقاصة الشركاء</span>
                  <ArrowRightLeft size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PARTNER EQUALIZATION & BALANCING */}
          {activeStep === 'equalize' && (
            <div className="space-y-6 animate-in fade-in-5 duration-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <ArrowRightLeft className="text-indigo-600" size={20} />
                    جدول معادلة وتسوية رصيد الشركاء بحصة المخزون
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    إجمالي بضاعة المخزون الحالية: <strong className="text-amber-600 font-black">{inventoryValuation.totalCost.toLocaleString('ar-EG')} ج.م</strong>
                  </p>
                </div>

                <button
                  onClick={handleAutoEqualize}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  <Sparkles size={16} />
                  <span>⚡ تطبيق تسوية المقاصة تلقائياً للجميع</span>
                </button>
              </div>

              {/* Detailed Equalization Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">الشريك</th>
                        <th className="py-3 px-4">النسبة</th>
                        <th className="py-3 px-4">الرصيد المتاح الحالي</th>
                        <th className="py-3 px-4">حصته في البضاعة</th>
                        <th className="py-3 px-4 text-center">الإجراء المطلوب للتسوية والمقاصة</th>
                        <th className="py-3 px-4">رأس المال الافتتاحي الجديد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {partnersEqualization.map((p, idx) => (
                        <tr key={p.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-3.5 px-4 font-black text-slate-800 dark:text-white">
                            {p.name}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {p.ratio}%
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                            <span className="font-mono text-sm">{Math.round(p.currentAvailableBalance).toLocaleString('ar-EG')} ج.م</span>
                            {p.currentProfitShare > 0 ? (
                              <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-sans">
                                (رصيد جاري: {Math.round(p.currentLedgerBalance).toLocaleString()} + أرباح: {Math.round(p.currentProfitShare).toLocaleString()})
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-sans">
                                (الرصيد الجاري الدفتري)
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-black text-amber-600 dark:text-amber-400">
                            {Math.round(p.targetInventoryShare).toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {p.isEqual ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full font-bold text-[11px]">
                                <Check size={14} className="text-emerald-500" />
                                متطابق تماماً (0 ج.م)
                              </span>
                            ) : p.equalizationDifference > 0 ? (
                              <button
                                type="button"
                                onClick={() => setPartnerTxModal({
                                  partner: p,
                                  diff: p.equalizationDifference,
                                  type: 'withdraw',
                                  amount: String(Math.round(p.equalizationDifference)),
                                  account: 'central_wallet',
                                  note: `سحب فائض لتسوية حصة المخزون (${Math.round(p.equalizationDifference).toLocaleString('ar-EG')} ج.م)`
                                })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer group"
                                title="اضغط لتسجيل عملية سحب نقدية (كاملة أو جزئية)"
                              >
                                <ArrowDownLeft size={14} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                                <span>يسحب فائض: <strong className="font-mono">{Math.round(p.equalizationDifference).toLocaleString('ar-EG')} ج.م</strong></span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-200/70 dark:bg-emerald-800/70 rounded-md font-sans">تنفيذ ⚡</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPartnerTxModal({
                                  partner: p,
                                  diff: Math.abs(p.equalizationDifference),
                                  type: 'deposit',
                                  amount: String(Math.round(Math.abs(p.equalizationDifference))),
                                  account: 'central_wallet',
                                  note: `إيداع لتغطية عجز حصة المخزون (${Math.round(Math.abs(p.equalizationDifference)).toLocaleString('ar-EG')} ج.م)`
                                })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer group"
                                title="اضغط لتسجيل عملية إيداع نقدية (كاملة أو جزئية)"
                              >
                                <ArrowUpRight size={14} className="text-blue-600 group-hover:scale-110 transition-transform" />
                                <span>يودع عجز: <strong className="font-mono">{Math.round(Math.abs(p.equalizationDifference)).toLocaleString('ar-EG')} ج.م</strong></span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-200/70 dark:bg-blue-800/70 rounded-md font-sans">تنفيذ ⚡</span>
                              </button>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                            {Math.round(p.currentAvailableBalance).toLocaleString('ar-EG')} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setActiveStep('review')}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  الرجوع للسابق
                </button>

                <button
                  onClick={() => setActiveStep('confirm')}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition-all shadow-md shadow-emerald-200 dark:shadow-none"
                >
                  <span>متابعة لتأكيد وتنفيذ الإقفال</span>
                  <Lock size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRM & EXECUTE ROLLOVER */}
          {activeStep === 'confirm' && (
            <div className="space-y-6 animate-in fade-in-5 duration-200">
              
              <div className="p-5 bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950/30 dark:to-slate-900/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl space-y-4">
                <h4 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="text-indigo-600" size={18} />
                  بيانات واعتماد إقفال الفترة المالية
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      مسمى الفترة المقفلة:
                    </label>
                    <input
                      type="text"
                      value={periodName}
                      onChange={(e) => setPeriodName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      ملاحظات أو قرارات مجلس الشركاء:
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: تم إقرار التقرير الختامي وتصفير المسحوبات وبدء الدورة برصيد البضاعة"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Rollover Mode Selector */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    طريقة إدارة الفترة الجديدة في السيستم:
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div 
                      onClick={() => setExecutionMode('smart_date_cutoff')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        executionMode === 'smart_date_cutoff'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs">التدوير الذكي (موصى به - أمان 100%)</span>
                        {executionMode === 'smart_date_cutoff' && <CheckCircle2 size={16} className="text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        يتم اعتماد تاريخ اليوم كبداية للدورة الجديدة. تبدأ مؤشرات المبيعات والمصروفات والمسحوبات من 0 ج.م مع الاحتفاظ بكافة الأوردرات القديمة في الأرشيف والسجلات دون فقدان أي بيانات.
                      </p>
                    </div>

                    <div 
                      onClick={() => setExecutionMode('full_rollover')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        executionMode === 'full_rollover'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs">تثبيت المخزون الافتتاحي وتدوير رأس المال</span>
                        {executionMode === 'full_rollover' && <CheckCircle2 size={16} className="text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        يتم حفظ التقرير الختامي في أرشيف الفترات السابقة وتعيين رأس مال كل شريك الجديد ليكون مساوياً لحصته في بضاعة المخزون كبضاعة أول المدة.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Final Review Card */}
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-black text-amber-900 dark:text-amber-200">
                    رأس المال الافتتاحي للدورة الجديدة (بضاعة أول المدة):
                  </h5>
                  <p className="text-lg font-black text-amber-700 dark:text-amber-400 mt-0.5">
                    {inventoryValuation.totalCost.toLocaleString('ar-EG')} ج.م
                  </p>
                </div>
                <div className="text-left text-xs font-bold text-slate-500">
                  <span>عدد الشركاء الموزع عليهم: {partnersEqualization.length}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setActiveStep('equalize')}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  الرجوع لجدول التسوية
                </button>

                <button
                  onClick={handleExecutePeriodClosing}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>جاري تنفيذ الإقفال والتدوير...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      <span>🔒 اعتماد الإقفال وبدء الدورة الجديدة الآن</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: HISTORICAL PERIODS ARCHIVE */}
          {activeStep === 'history' && (
            <div className="space-y-6 animate-in fade-in-5 duration-200">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <History className="text-indigo-600" size={20} />
                  أرشيف وسجل الفترات المالية المقفلة
                </h3>
                <span className="text-xs text-slate-500">
                  إجمالي الفترات المؤرشفة: {(settings.financialPeriods || []).length}
                </span>
              </div>

              {(settings.financialPeriods || []).length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Lock size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="font-bold text-sm">لا توجد فترات مالية مقفلة مسبقاً.</p>
                  <p className="text-xs mt-1">عند إقفال الفترة الحالية سيتم حفظ تقريرها وشهادة الإقفال هنا تلقائياً.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(settings.financialPeriods || []).map((period) => (
                    <div
                      key={period.id}
                      className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h4 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                            <span>📜</span> {period.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            الفترة من {new Date(period.startDate).toLocaleDateString('ar-EG')} إلى {new Date(period.endDate).toLocaleDateString('ar-EG')} (أُقفلت في {new Date(period.closedAt).toLocaleDateString('ar-EG')})
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedHistoricalPeriod(period)}
                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
                          >
                            عرض محضر الإقفال
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">المبيعات:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{period.totalSales?.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">صافي الربح:</span>
                          <span className="font-bold text-emerald-600">{period.netProfit?.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">بضاعة أول المدة:</span>
                          <span className="font-bold text-amber-600">{period.openingInventoryValue?.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">بضاعة الإقفال:</span>
                          <span className="font-bold text-amber-600">{period.closingInventoryValue?.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Historical Period Details / Certificate Modal View */}
              {selectedHistoricalPeriod && (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-3xl space-y-4" id="period-closing-certificate">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div>
                      <h4 className="font-black text-base text-slate-800 dark:text-white">
                        محضر وشهادة إقفال الدورة المالية ({selectedHistoricalPeriod.name})
                      </h4>
                      <p className="text-xs text-slate-500">تم الإقفال في {new Date(selectedHistoricalPeriod.closedAt).toLocaleString('ar-EG')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportCertificatePDF}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1"
                      >
                        <Download size={14} /> PDF
                      </button>
                      <button
                        onClick={() => setSelectedHistoricalPeriod(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                        <tr>
                          <th className="p-2.5">الشريك</th>
                          <th className="p-2.5">النسبة</th>
                          <th className="p-2.5">الرصيد النهائي للدورة</th>
                          <th className="p-2.5">حصة المخزون (رأس المال الجديد)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {(selectedHistoricalPeriod.partnerBalancesSnapshot || []).map((p, i) => (
                          <tr key={i}>
                            <td className="p-2.5 font-bold">{p.partnerName}</td>
                            <td className="p-2.5 font-mono">{p.profitRatio}%</td>
                            <td className="p-2.5 font-mono">{Math.round(p.finalBalance).toLocaleString()} ج.م</td>
                            <td className="p-2.5 font-mono font-black text-emerald-600">{Math.round(p.newOpeningCapital).toLocaleString()} ج.م</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>نظام الإقفال والتدوير المالي المتوافق مع معايير المحاسبة والشركاء</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>

      {/* Manual / Partial Transaction Popup Modal */}
      {partnerTxModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${partnerTxModal.type === 'deposit' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'}`}>
                  {partnerTxModal.type === 'deposit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-800 dark:text-white">
                    {partnerTxModal.type === 'deposit' ? 'إيداع نقدي لتغطية العجز' : 'سحب نقدي للفائض'}
                  </h4>
                  <p className="text-[11px] text-slate-400">الشريك: <strong className="text-slate-700 dark:text-slate-200">{partnerTxModal.partner.name}</strong></p>
                </div>
              </div>
              <button 
                onClick={() => setPartnerTxModal(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Guidance banner */}
            <div className={`p-3.5 rounded-2xl text-xs space-y-1.5 ${partnerTxModal.type === 'deposit' ? 'bg-blue-50/90 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800' : 'bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'}`}>
              <div className="flex justify-between items-center font-bold">
                <span>{partnerTxModal.type === 'deposit' ? 'إجمالي العجز المطلوب للمقاصة:' : 'إجمالي الفائض المتاح للسحب:'}</span>
                <span className="font-mono font-black text-sm">{Math.round(partnerTxModal.diff).toLocaleString('ar-EG')} ج.م</span>
              </div>
              <p className="text-[10px] opacity-80 leading-relaxed">
                {partnerTxModal.type === 'deposit' 
                  ? '💡 يمكن للشريك إيداع المبلغ كاملاً أو إيداع جزء منه الآن، وسيتم تحديث رصيده والمتبقي عليه تلقائياً.' 
                  : '💡 يمكن للشريك سحب الفائض كاملاً نقداً أو سحب جزء منه وترك الباقي في رصيده.'}
              </p>
            </div>

            {/* Form fields */}
            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    المبلغ المراد {partnerTxModal.type === 'deposit' ? 'إيداعه' : 'سحبه'} (ج.م):
                  </label>
                  <button
                    type="button"
                    onClick={() => setPartnerTxModal({ ...partnerTxModal, amount: String(Math.round(partnerTxModal.diff)) })}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                  >
                    ⚡ المبلغ كاملاً ({Math.round(partnerTxModal.diff).toLocaleString()} ج.م)
                  </button>
                </div>
                <input
                  type="number"
                  value={partnerTxModal.amount}
                  onChange={(e) => setPartnerTxModal({ ...partnerTxModal, amount: e.target.value })}
                  placeholder="أدخل المبلغ..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                {Number(partnerTxModal.amount) > 0 && Number(partnerTxModal.amount) < Math.round(partnerTxModal.diff) && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-1.5 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>
                      إيداع جزئي: سيتبقى على الشريك بعد هذا الإيداع عجز قدره <strong className="font-mono underline">{(Math.round(partnerTxModal.diff) - Number(partnerTxModal.amount)).toLocaleString('ar-EG')} ج.م</strong>
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">جهة المعاملة النقدية / الخزينة:</label>
                <select
                  value={partnerTxModal.account}
                  onChange={(e) => setPartnerTxModal({ ...partnerTxModal, account: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="none">📝 تسوية دفترية بحتة (تعديل رصيد الشريك فقط بدون حركة خزينة)</option>
                  <option value="central_wallet">💼 المحفظة المركزية الرئيسية</option>
                  {(treasury?.accounts || []).map(acc => (
                    <option key={acc.id} value={acc.id}>🏦 {acc.name} (الرصيد المتاح: {Number(acc.balance || 0).toLocaleString()} ج.م)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">البيان / ملاحظات المعاملة:</label>
                <input
                  type="text"
                  value={partnerTxModal.note}
                  onChange={(e) => setPartnerTxModal({ ...partnerTxModal, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPartnerTxModal(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecutePartnerTx}
                className={`flex-1 py-2.5 text-white rounded-xl text-xs font-black transition-all shadow-md ${partnerTxModal.type === 'deposit' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none'}`}
              >
                تأكيد تسجيل {partnerTxModal.type === 'deposit' ? 'الإيداع' : 'السحب'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
