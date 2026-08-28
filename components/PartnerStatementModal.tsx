import React, { useState, useMemo } from 'react';
import { Settings, Partner, PartnerTransaction, Wallet, Order, Treasury } from '../types';
import { 
  Printer, X, Download, Share2, Filter, Calendar, Search, 
  Check, Eye, RefreshCw, FileText, User, Coins, TrendingUp, 
  ArrowDownRight, ArrowUpLeft, DollarSign, Wallet as WalletIcon, 
  Building2, Landmark, CheckCircle2, Copy, Loader2, Link as LinkIcon
} from 'lucide-react';
import { printHTMLDirectly } from '../utils/printHelper';
import { shareReport } from '../services/reportShareService';
import { parseSafeDate } from '../utils/dateUtils';
import { getVirtualOrderHandovers, calculateOrderProfitLoss } from '../utils/financials';

interface PartnerStatementModalProps {
  partner: Partner;
  settings: Settings;
  wallet: Wallet;
  orders: Order[];
  treasury?: Treasury;
  onClose: () => void;
}

const normalizeName = (name: string): string => {
  if (!name) return '';
  let normalized = name.trim().replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s*\((شريك|موظف|المدير|شريكه|partner|employee|admin|أنت|انت)\)/gi, '');
  normalized = normalized.replace(/\s+(شريك|موظف|المدير|شريكه|partner|employee|admin)$/gi, '');
  normalized = normalized
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
  if (/^(زهره)/.test(normalized)) {
    return 'زهره';
  }
  return normalized;
};

export const PartnerStatementModal: React.FC<PartnerStatementModalProps> = ({
  partner,
  settings,
  wallet,
  orders,
  treasury,
  onClose,
}) => {
  // Filter States
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_month' | 'last_30' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'capital' | 'profits' | 'withdrawals' | 'custody'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Display Options
  const [showSummaryCards, setShowSummaryCards] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [showCustody, setShowCustody] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Sharing States
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // 1. Gather all transactions
  const transactions = useMemo(() => {
    return (settings.partnerTransactions || []).filter(
      t => t.partnerId === partner.id && t.type !== 'pos_collection'
    );
  }, [settings.partnerTransactions, partner.id]);

  // 2. Gather handovers/custody
  const handoversForPartner = useMemo(() => {
    const holderId = `part_${partner.id}`;
    const partnerHolders = (settings.cashHolders || []).filter((h: any) => 
      h.userId === holderId || 
      h.userId === partner.id || 
      normalizeName(h.userName) === normalizeName(partner.name)
    );
    const partnerUserIds = [holderId, partner.id, ...partnerHolders.map(h => h.userId)];

    const allHandovers = [
      ...(settings.cashHandovers || []),
      ...getVirtualOrderHandovers(orders, settings, treasury)
    ];

    return allHandovers
      .filter(h => 
        partnerUserIds.includes(h.fromUserId) || 
        partnerUserIds.includes(h.toUserId) || 
        h.toUserId === partner.id || 
        h.toUserId === holderId || 
        h.fromUserId === partner.id || 
        h.fromUserId === holderId || 
        normalizeName(h.toUserName || '').includes(normalizeName(partner.name)) || 
        normalizeName(h.fromUserName || '').includes(normalizeName(partner.name))
      )
      .map(h => {
        const isGive = partnerUserIds.includes(h.toUserId) || h.toUserId === partner.id || h.toUserId === holderId || normalizeName(h.toUserName || '').includes(normalizeName(partner.name));
        return {
          id: h.id,
          partnerId: partner.id,
          type: isGive ? 'custody_give' : 'custody_receive',
          amount: Number(h.amount) || 0,
          date: h.date,
          note: h.notes || (isGive ? 'تسليم عهدة نقدية للشريك' : 'تسوية واسترداد عهدة من الشريك'),
        } as any;
      });
  }, [settings.cashHandovers, settings.cashHolders, partner, orders, treasury, settings]);

  // 3. Merged and sorted transactions
  const mergedTransactions = useMemo(() => {
    let list = [...transactions];
    if (showCustody) {
      list = [...list, ...handoversForPartner];
    }
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, handoversForPartner, showCustody]);

  // 4. Partner Custody calculation
  const partnerCustody = useMemo(() => {
    const holderId = `part_${partner.id}`;
    const partnerHolders = (settings.cashHolders || []).filter((h: any) => 
      h.userId === holderId || 
      h.userId === partner.id || 
      normalizeName(h.userName) === normalizeName(partner.name)
    );
    const settlements = handoversForPartner.filter((h: any) => 
        (h.toUserId && (h.toUserId === 'admin_deduction' || h.toUserId === 'admin_manual')) ||
        (h.toUserName && (h.toUserName.includes('خصم') || h.toUserName.includes('تصفية') || h.toUserName.includes('تسوية'))) ||
        (h.notes && (h.notes.includes('خصم') || h.notes.includes('تصفية') || h.notes.includes('تسوية') || h.notes.includes('تبين عدم رد'))) ||
        (h.note && (h.note.includes('خصم') || h.note.includes('تصفية') || h.note.includes('تسوية') || h.note.includes('تبين عدم رد')))
    );
    const hasSettlement = settlements.length > 0;
    let holderSum = partnerHolders.reduce((sum: number, h: any) => sum + (h.currentBalance || 0), 0);

    if (hasSettlement) {
        const lastSettlement = settlements.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const activeHandovers = handoversForPartner.filter((h: any) => new Date(h.date).getTime() > new Date(lastSettlement.date).getTime());
        const activeHandoverSum = activeHandovers.reduce((sum: number, h: any) => {
            if (h.type === 'custody_give') return sum + (Number(h.amount) || 0);
            if (h.type === 'custody_receive') return sum - (Number(h.amount) || 0);
            return sum;
        }, 0);
        return Math.max(0, holderSum) + Math.max(0, activeHandoverSum);
    }

    let handoverSum = handoversForPartner.reduce((sum: number, h: any) => {
      if (h.type === 'custody_give') return sum + (Number(h.amount) || 0);
      if (h.type === 'custody_receive') return sum - (Number(h.amount) || 0);
      return sum;
    }, 0);
    
    let sum = Math.max(holderSum, Math.max(0, handoverSum));
    if (sum <= 0 && holderSum > 0) sum = holderSum;
    return Math.max(0, sum);
  }, [settings.cashHolders, partner, handoversForPartner]);

  // 5. Compute running balance and filtered transactions
  const { filteredRows, overallStats, runningBalanceRows } = useMemo(() => {
    let running = 0;
    const allWithBalance = mergedTransactions.map(t => {
      const isAdd = ['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in', 'custody_receive'].includes(t.type);
      const val = Number(t.amount) || 0;
      if (t.type === 'pos_collection') {
        // neutral
      } else if (isAdd) {
        running += val;
      } else {
        running -= val;
      }
      return {
        ...t,
        runningBalance: running,
        isAddition: isAdd,
        amountNum: val
      };
    });

    // Date calculations
    const now = new Date();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    if (dateFilter === 'this_month') {
      minDate = new Date(now.getFullYear(), now.getMonth(), 1);
      maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (dateFilter === 'last_month') {
      minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      maxDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (dateFilter === 'last_30') {
      minDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    } else if (dateFilter === 'custom') {
      if (startDate) minDate = parseSafeDate(startDate);
      if (endDate) {
        const ed = parseSafeDate(endDate);
        if (ed) {
          ed.setHours(23, 59, 59, 999);
          maxDate = ed;
        }
      }
    }

    const filtered = allWithBalance.filter(t => {
      const tDate = parseSafeDate(t.date);
      if (!tDate) return false;
      if (minDate && tDate.getTime() < minDate.getTime()) return false;
      if (maxDate && tDate.getTime() > maxDate.getTime()) return false;

      if (typeFilter === 'capital') {
        if (!['capital_addition', 'supply_funding', 'shipping_funding', 'expense_coverage'].includes(t.type)) return false;
      } else if (typeFilter === 'profits') {
        if (!['profit_distribution', 'profit_withdrawal'].includes(t.type)) return false;
      } else if (typeFilter === 'withdrawals') {
        if (!['loan', 'profit_withdrawal', 'expense_repayment', 'internal_transfer_out'].includes(t.type)) return false;
      } else if (typeFilter === 'custody') {
        if (!['custody_give', 'custody_receive'].includes(t.type)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const note = (t.note || '').toLowerCase();
        const typeStr = getTxTypeName(t.type).toLowerCase();
        if (!note.includes(q) && !typeStr.includes(q)) return false;
      }

      return true;
    });

    const totalInvested = transactions.filter(t => ['capital_addition', 'supply_funding', 'shipping_funding', 'expense_coverage'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
    const totalDividends = transactions.filter(t => t.type === 'profit_distribution').reduce((s, t) => s + (t.amount || 0), 0);
    const totalWithdrawn = transactions.filter(t => t.type === 'profit_withdrawal').reduce((s, t) => s + (t.amount || 0), 0);
    const totalLoans = transactions.filter(t => t.type === 'loan').reduce((s, t) => s + (t.amount || 0), 0);
    const totalRepaid = transactions.filter(t => t.type === 'repayment').reduce((s, t) => s + (t.amount || 0), 0);

    let totalSuccessfulNetPos = 0;
    let totalSuccessfulNetShipping = 0;
    let returnsLosses = 0;

    (orders || []).forEach(order => {
      const { net, loss } = calculateOrderProfitLoss(order, settings);
      const isPos = order.channel === 'pos' || 
                    order.shippingCompany === 'كاشير - بيع مباشر' || 
                    order.shippingArea === 'نقطة البيع' ||
                    (order.id && order.id.startsWith('POS-'));
      
      const isReturnOrFailed = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(order.status);
      const isExchange = order.status === 'تم_الاستبدال';
      const hasLoss = loss > 0 || net < 0;

      if (isReturnOrFailed || isExchange || hasLoss) {
          const actualLoss = loss > 0 ? loss : (net < 0 ? Math.abs(net) : 0);
          returnsLosses += actualLoss;
      } else if (order.status === 'تم_التحصيل' || order.status === 'مدفوعة' || order.status === 'تم_توصيلها' || order.status === 'تم_التوصيل') {
          if (isPos) {
              totalSuccessfulNetPos += net;
          } else {
              totalSuccessfulNetShipping += net;
          }
      }
    });

    const isCustodyTx = (t: any) => {
      const note = t.note || t.description || '';
      const id = t.id || '';
      const category = t.category || '';
      return (
        note.includes('عهدة') ||
        note.includes('استرداد') ||
        note.includes('تسوية') ||
        note.includes('توريد') ||
        note.includes('تسليم') ||
        id.includes('CUST') ||
        id.includes('custody') ||
        id.includes('HND') ||
        category === 'pos_collection' ||
        category === 'custody_give' ||
        category === 'custody_receive'
      );
    };

    const adminExpenses = (wallet?.transactions || [])
      .filter(t => {
        if (isCustodyTx(t)) return false;
        const isExpenseCategory = t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_') || (settings.expenseCategories || []).includes(t.category || '');
        const isManualWithdrawal = t.category === 'manual_withdrawal';
        const isNotPartnerTx = !t.note?.includes('معاملة شريك');
        return t.type === 'سحب' && (isExpenseCategory || isManualWithdrawal) && isNotPartnerTx;
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const otherIncome = (wallet?.transactions || [])
      .filter(t => {
        if (isCustodyTx(t)) return false;
        const isNotPartnerTx = !t.note?.includes('معاملة شريك');
        const isNotPosTx = !t.note?.includes('مبيعات كاشير');
        return t.type === 'إيداع' && t.category === 'manual_deposit' && isNotPartnerTx && isNotPosTx;
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpenses = returnsLosses + adminExpenses;
    const allTimeNetProfit = totalSuccessfulNetPos + totalSuccessfulNetShipping + otherIncome - totalExpenses;
    const partnerTheoreticalProfit = (allTimeNetProfit * (partner.profitRatio || 0)) / 100;
    const partnerUnallocatedProfit = Math.max(0, partnerTheoreticalProfit - totalDividends);

    const partnerHolderId = `part_${partner.id}`;
    const allHandovers = [...(settings.cashHandovers || []), ...(getVirtualOrderHandovers ? getVirtualOrderHandovers(orders, settings) : [])];
    const partnerHandovers = allHandovers.filter(h => 
      h.fromUserId === partnerHolderId || 
      h.toUserId === partnerHolderId || 
      h.fromUserId === partner.id || 
      h.toUserId === partner.id ||
      (partner.name && (h.fromUserName?.includes(partner.name) || h.toUserName?.includes(partner.name)))
    );

    const custodyReturnedHandovers = partnerHandovers
      .filter(h => (h.fromUserId === partnerHolderId || h.fromUserId === partner.id || (partner.name && h.fromUserName?.includes(partner.name))) && h.status === 'completed')
      .reduce((s, h) => s + (Number(h.amount) || 0), 0);

    const custodyReturnedTxs = transactions
      .filter(t => t.type === 'custody_receive')
      .reduce((s, t) => s + (t.amount || 0), 0);

    const custodyDeductions = transactions
      .filter(t => (t.note || '').includes('خصم عهدة') || (t.note || '').includes('تسوية عهدة'))
      .reduce((s, t) => s + (t.amount || 0), 0);

    const settledCustodyTotal = Math.max(custodyReturnedHandovers + custodyReturnedTxs + custodyDeductions, 0);

    const stats = {
      totalInvested,
      totalDividends,
      totalWithdrawn,
      totalLoans,
      totalRepaid,
      netLoans: Math.max(0, totalLoans - totalRepaid),
      currentBalance: partner.balance,
      partnerCustody,
      partnerUnallocatedProfit,
      settledCustodyTotal
    };

    return {
      filteredRows: filtered,
      overallStats: stats,
      runningBalanceRows: allWithBalance
    };
  }, [mergedTransactions, transactions, partner, partnerCustody, dateFilter, startDate, endDate, typeFilter, searchQuery]);

  function getTxTypeName(type: string, note?: string) {
    const n = (note || '').toLowerCase();
    if (n.includes('خصم عهدة') || n.includes('تسوية عهدة') || n.includes('تحويلها كمسحوبات')) {
      return 'تسوية عهدة معلقة (خصم من الرصيد)';
    }
    switch (type) {
      case 'loan': return 'سلفة نقدية / مسحوبات شخصية';
      case 'customer_advance': return 'عربون محصل من عميل';
      case 'capital_addition': return 'إيداع رأس مال استثماري';
      case 'shipping_funding': return 'تمويل مصاريف الشحن';
      case 'profit_withdrawal': return 'سحب من حصة الأرباح المستحقة';
      case 'profit_distribution': return 'توزيع أرباح دورية معتمدة';
      case 'supply_funding': return 'تمويل شراء بضاعة ومخزون';
      case 'expense_coverage': return 'سداد مصروفات تشغيلية';
      case 'expense_repayment': return 'استرداد مصروفات مدفوعة للشريك';
      case 'pos_collection': return 'استلام عهدة كاشير';
      case 'repayment': return 'سداد مديونية / رد سلفة';
      case 'custody_give': return 'تسليم عهدة نقدية للشريك';
      case 'custody_receive': return 'تسوية واسترداد عهدة من الشريك';
      case 'internal_transfer_in': return 'تحويل مالي وارد';
      case 'internal_transfer_out': return 'تحويل مالي صادر';
      default: return 'معاملة مالية معتمدة';
    }
  }

  function getTxBadge(type: string, isAdd: boolean, note?: string) {
    const n = (note || '').toLowerCase();
    if (n.includes('خصم عهدة') || n.includes('تسوية عهدة') || n.includes('تحويلها كمسحوبات')) {
      return { bg: 'bg-amber-100 text-amber-900 border-amber-200', icon: '🔄' };
    }
    if (type === 'profit_distribution') {
      return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '📈' };
    }
    if (type === 'capital_addition' || type === 'supply_funding' || type === 'shipping_funding' || type === 'expense_coverage') {
      return { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: '💼' };
    }
    if (type === 'loan' || type === 'profit_withdrawal') {
      return { bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: '💸' };
    }
    if (type === 'custody_give' || type === 'custody_receive') {
      return { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🪙' };
    }
    return { bg: isAdd ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200', icon: '⚖️' };
  }

  
  const buildHtmlContent = () => {
    const storeTitle = (settings as any).storeName || (settings as any).companyName || 'وان تولز للعدد اليدوية';
    const printDate = new Date().toLocaleDateString('ar-EG');
    const printTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    let rowsHtml = '';
    filteredRows.forEach((t, idx) => {
      const typeLabel = getTxTypeName(t.type);
      const isAdd = t.isAddition;
      const val = t.amountNum;
      
      let accountName = 'الخزينة العامة / نقدي';
      if (t.treasuryAccountId) {
        const acc = treasury?.accounts?.find(a => String(a.id) === String(t.treasuryAccountId));
        if (acc) accountName = `${acc.name} (${acc.type === 'bank' ? 'بنك' : acc.type === 'wallet' ? 'محفظة' : 'خزينة'})`;
      }

      rowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
          <td style="padding: 9px 12px; text-align: right; color: #475569; white-space: nowrap;">
            ${new Date(t.date).toLocaleDateString('ar-EG')}
            <div style="font-size: 9px; color: #94a3b8;">${new Date(t.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
          </td>
          <td style="padding: 9px 12px; text-align: right; font-weight: bold; color: #1e293b;">
            ${typeLabel}
            ${t.treasuryAccountId ? `<div style="font-size: 9px; color: #4f46e5; font-weight: normal;">${accountName}</div>` : ''}
          </td>
          <td style="padding: 9px 12px; text-align: right; color: #334155; max-width: 280px; line-height: 1.4;">${t.note || '-'}</td>
          <td style="padding: 9px 12px; text-align: left; font-weight: bold; font-family: monospace; font-size: 12px; color: ${isAdd ? '#059669' : '#dc2626'}; white-space: nowrap;">
            ${isAdd ? '+' : '-'}${val.toLocaleString()} ج.م
          </td>
          <td style="padding: 9px 12px; text-align: left; font-weight: 900; font-family: monospace; font-size: 12px; color: #1e293b; white-space: nowrap;">
            ${t.runningBalance.toLocaleString()} ج.م
          </td>
        </tr>
      `;
    });

    const summaryCardsHtml = showSummaryCards ? `
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 25px; background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0;">
        
        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">الرصيد الصافي</div>
          <div style="font-size: 13px; font-weight: 900; color: ${partner.balance >= 0 ? '#059669' : '#dc2626'}; font-family: monospace; margin-top: 4px;">
            ${partner.balance.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: ${partner.balance >= 0 ? '#059669' : '#dc2626'}; font-weight: bold;">
            ${partner.balance >= 0 ? 'مستحق للشريك' : 'سلفة عليه'}
          </div>
        </div>

        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">رأس المال والتمويل</div>
          <div style="font-size: 13px; font-weight: 900; color: #2563eb; font-family: monospace; margin-top: 4px;">
            ${overallStats.totalInvested.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #64748b; font-weight: bold;">
            إجمالي الاستثمار
          </div>
        </div>

        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">الأرباح الموزعة</div>
          <div style="font-size: 13px; font-weight: 900; color: #059669; font-family: monospace; margin-top: 4px;">
            ${overallStats.totalDividends.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #059669; font-weight: bold;">
            مستحقات مسددة
          </div>
        </div>

        <div style="background: rgba(16, 185, 129, 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2); text-align: right;">
          <div style="font-size: 9px; color: #047857; font-weight: bold;">الأرباح المستحقة</div>
          <div style="font-size: 13px; font-weight: 900; color: #047857; font-family: monospace; margin-top: 4px;">
            ${overallStats.partnerUnallocatedProfit.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #059669; font-weight: bold;">
            حصة تقديرية
          </div>
        </div>

        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">سحب وسلف</div>
          <div style="font-size: 13px; font-weight: 900; color: #dc2626; font-family: monospace; margin-top: 4px;">
            ${(overallStats.totalWithdrawn + overallStats.totalLoans).toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #ef4444; font-weight: bold;">
            شخصية
          </div>
        </div>

        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">العهدة المعلقة</div>
          <div style="font-size: 13px; font-weight: 900; color: #d97706; font-family: monospace; margin-top: 4px;">
            ${overallStats.partnerCustody.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #d97706; font-weight: bold;">
            تشغيلية طرفه
          </div>
        </div>

        <div style="background: rgba(79, 70, 229, 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(79, 70, 229, 0.2); text-align: right;">
          <div style="font-size: 9px; color: #4338ca; font-weight: bold;">تسويات العهد</div>
          <div style="font-size: 13px; font-weight: 900; color: #4338ca; font-family: monospace; margin-top: 4px;">
            ${overallStats.settledCustodyTotal.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #4f46e5; font-weight: bold;">
            تم توريدها
          </div>
        </div>

      </div>
    ` : '';

    const signaturesHtml = showSignatures ? `
      <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
        <div style="text-align: right; width: 45%;">
          <p style="font-weight: bold; margin: 0 0 5px 0;">إعداد واعتماد الإدارة المالية:</p>
          <p style="margin: 0; color: #64748b;">التوقيع / الختم: _____________________________</p>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 9px;">تمت المراجعة والتدقيق المالي للنظام</p>
        </div>
        <div style="text-align: right; width: 45%;">
          <p style="font-weight: bold; margin: 0 0 5px 0;">إقرار ومصادقة الشريك (${partner.name}):</p>
          <p style="margin: 0; color: #64748b;">التوقيع: _____________________________</p>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 9px;">أقر بصحة العمليات والرصيد المذكور أعلاه</p>
        </div>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب الشريك - ${partner.name}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #ffffff;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            direction: rtl;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .title-area h1 {
            margin: 0 0 4px 0;
            font-size: 20px;            font-weight: 900;            color: #1e1b4b;          }          .title-area p {            margin: 0;            font-size: 11px;            color: #475569;            font-weight: 600;          }          .meta-box {            text-align: left;            font-size: 10px;            color: #64748b;          }          .meta-box strong {            color: #0f172a;            font-size: 12px;          }          table {            width: 100%;            border-collapse: collapse;            text-align: right;            margin-top: 10px;          }          th {            background-color: #f1f5f9;            color: #334155;            font-weight: 800;            padding: 8px 12px;            font-size: 10.5px;            border-bottom: 2px solid #cbd5e1;            border-top: 1px solid #cbd5e1;          }          .page-footer {            margin-top: 30px;            text-align: center;            font-size: 9px;            color: #94a3b8;            border-top: 1px solid #f1f5f9;            padding-top: 8px;          }        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="title-area">
            <h1>${storeTitle}</h1>
            <p>كشف حساب الشريك: <strong style="color: #4338ca; font-size: 13px;">${partner.name}</strong> | نسبة الأرباح: <strong>${partner.profitRatio}%</strong></p>
          </div>
          <div class="meta-box">
            <div><strong>كشف حساب مالي تفصيلي</strong></div>
            <div style="margin-top: 3px;">تاريخ التوليد: ${printDate} - ${printTime}</div>
            <div>الحالة: <span style="color: #059669; font-weight: bold;">حساب نشط ومطابق</span></div>
          </div>
        </div>
        ${summaryCardsHtml}
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="font-weight: 900; font-size: 12.5px; margin: 0; color: #1e293b;">سجل القيود والمعاملات المالية (${filteredRows.length} معاملة)</h3>
            <span style="font-size: 9.5px; color: #64748b;">العملة: الجنيه المصري (ج.م)</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: right; width: 14%;">التاريخ والوقت</th>
                <th style="text-align: right; width: 22%;">نوع المعاملة / القيد</th>
                <th style="text-align: right; width: 34%;">البيان والتفاصيل</th>
                <th style="text-align: left; width: 15%;">القيمة (مدين/دائن)</th>
                <th style="text-align: left; width: 15%;">الرصيد التراكمي</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="5" style="text-align: center; padding: 25px; color: #94a3b8; font-weight: bold;">لا توجد معاملات مسجلة تطابق محددات البحث.</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1; font-size: 11px;">
                <td colspan="3" style="padding: 10px 12px; text-align: right; color: #1e293b;">
                  صافي الرصيد الختامي بعد جميع الحركات:
                </td>
                <td colspan="2" style="padding: 10px 12px; text-align: left; font-size: 14px; font-weight: 900; color: ${partner.balance >= 0 ? '#059669' : '#dc2626'}; font-family: monospace;">
                  ${partner.balance >= 0 ? '+' : ''}${partner.balance.toLocaleString()} ج.م
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        ${signaturesHtml}
        <div class="page-footer">
          تم استخراج هذا التقرير آلياً عبر نظام إدارة الحسابات المالية الموحد. جميع الأرقام مطابقة للحركات الفعلية.
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    printHTMLDirectly(buildHtmlContent());
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const id = await shareReport(buildHtmlContent());
      setShareLink(`${window.location.origin}/shared-report/${id}`);
    } catch (error) {
      console.error('Share Error:', error);
      alert('حدث خطأ أثناء إنشاء رابط المشاركة.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };


  const handleCopyWhatsAppSummary = () => {
    const text = `📊 *كشف حساب الشريك - ${partner.name}*
🏢 المتجر: ${(settings as any).storeName || (settings as any).companyName || 'وان تولز للعدد اليدوية'}
📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}
────────────────────
💰 *الرصيد الصافي الحالي:* ${partner.balance >= 0 ? 'مستحق له ' : 'مديونية عليه '}${partner.balance.toLocaleString()} ج.م
💼 *إجمالي رأس المال والتمويل:* ${overallStats.totalInvested.toLocaleString()} ج.م
📈 *الأرباح الموزعة:* ${overallStats.totalDividends.toLocaleString()} ج.م
💸 *إجمالي المسحوبات والسلف:* ${(overallStats.totalWithdrawn + overallStats.totalLoans).toLocaleString()} ج.م
🪙 *العهدة النقدية طرفه:* ${overallStats.partnerCustody.toLocaleString()} ج.م
────────────────────
🔢 عدد الحركات الموثقة: ${filteredRows.length} حركة`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto text-right" dir="rtl">
        
        {/* Header with quick actions */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 flex-shrink-0">
              <Printer size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-800 dark:text-white">معاينة وطباعة كشف الحساب</h2>
                <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black px-2.5 py-0.5 rounded-full">
                  {partner.name}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                تخصيص الفترات والمعاملات والطباعة المباشرة لكشف الحساب الرسمي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {shareLink && (
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <LinkIcon size={14} />
                <span className="text-xs font-bold whitespace-nowrap hidden sm:inline" dir="ltr">{shareLink.slice(0, 35)}...</span>
                <button onClick={handleCopyLink} className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded-lg transition-colors text-indigo-600 dark:text-indigo-400" title="نسخ الرابط">
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            )}

            <button
              onClick={handleShare}
              disabled={isSharing}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              <span className="hidden sm:inline">{isSharing ? 'جاري الإنشاء...' : 'مشاركة أونلاين'}</span>
            </button>

            <button
              onClick={handleCopyWhatsAppSummary}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer"
              title="نسخ ملخص الحساب للواتساب"
            >
              {copySuccess ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              <span>{copySuccess ? 'تم النسخ بنجاح!' : 'نسخ للواتساب'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Printer size={16} />
              <span>طباعة المستند الرسمي</span>
            </button>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Date filter */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1">الفترة الزمنية</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-white outline-none"
              >
                <option value="all">كل الفترات (سجل شامل)</option>
                <option value="this_month">هذا الشهر الحالي</option>
                <option value="last_month">الشهر السابق</option>
                <option value="last_30">آخر 30 يوماً</option>
                <option value="custom">تحديد فترة مخصصة...</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1">نوع المعاملات</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-white outline-none"
              >
                <option value="all">جميع الحركات والقيود</option>
                <option value="capital">رأس المال والتمويل فقط</option>
                <option value="profits">الأرباح والمستحقات</option>
                <option value="withdrawals">المسحوبات والسلف</option>
                <option value="custody">حركات العهد النقدية</option>
              </select>
            </div>

            {/* Search filter */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 mb-1">البحث في البيان والملاحظات</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث برقم المعاملة أو الكلمات المفتاحية..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-slate-700 dark:text-white outline-none"
                />
                <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Custom Date Range if selected */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-3 pt-1 animate-in fade-in duration-150">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-slate-400 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold dark:text-white outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-black text-slate-400 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold dark:text-white outline-none"
                />
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex items-center gap-4 pt-1 flex-wrap text-xs font-bold text-slate-600 dark:text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSummaryCards}
                onChange={(e) => setShowSummaryCards(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span>إظهار بطاقات الملخص المالي</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCustody}
                onChange={(e) => setShowCustody(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span>تضمين حركات العهد التشغيلية</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span>إظهار خانات التوقيع والاعتماد</span>
            </label>
          </div>
        </div>

        {/* Live Paper Preview Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950/60 flex justify-center custom-scrollbar">
          
          {/* Printable Sheet Wrapper */}
          <div className="bg-white text-slate-900 w-full max-w-4xl p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200 space-y-6">
            
            {/* Sheet Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900">{(settings as any).storeName || (settings as any).companyName || 'وان تولز للعدد اليدوية'}</h1>
                <p className="text-xs font-bold text-slate-600 mt-1 flex items-center gap-2">
                  <span>كشف حساب الشريك:</span>
                  <span className="text-indigo-700 font-black text-sm">{partner.name}</span>
                  <span className="text-slate-400">|</span>
                  <span>نسبة المشاركة: <strong>{partner.profitRatio}%</strong></span>
                </p>
              </div>

              <div className="text-left font-bold text-xs space-y-0.5 text-slate-500">
                <p className="text-slate-900 font-black text-sm">كشف حساب مالي معتمد</p>
                <p>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</p>
                <p>الوقت: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Sheet Summary Cards */}
            {showSummaryCards && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">الرصيد الصافي</span>
                  <p className={`text-sm sm:text-base font-black font-mono ${partner.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {partner.balance.toLocaleString()} <span className="text-[9px]">ج.م</span>
                  </p>
                  <span className={`text-[9px] font-bold ${partner.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {partner.balance >= 0 ? 'مستحق للشريك' : 'سلفة عليه'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">رأس المال والتمويل</span>
                  <p className="text-sm sm:text-base font-black font-mono text-blue-600">
                    {overallStats.totalInvested.toLocaleString()} <span className="text-[9px]">ج.م</span>
                  </p>
                  <span className="text-[9px] font-bold text-slate-400">إجمالي الاستثمار</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">الأرباح الموزعة</span>
                  <p className="text-sm sm:text-base font-black font-mono text-emerald-600">
                    {overallStats.totalDividends.toLocaleString()} <span className="text-[9px]">ج.م</span>
                  </p>
                  <span className="text-[9px] font-bold text-emerald-600">مستحقات مسددة</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 shadow-xs">
                  <span className="text-[10px] font-black text-emerald-700 block mb-1 uppercase">📈 الأرباح المستحقة</span>
                  <p className="text-sm sm:text-base font-black font-mono text-emerald-700">
                    {overallStats.partnerUnallocatedProfit.toLocaleString()} <span className="text-[9px]">ج.م</span>
                  </p>
                  <span className="text-[9px] font-bold text-emerald-600">حصة الأرباح التقديرية</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">المسحوبات والسلف</span>
                  <p className="text-sm sm:text-base font-black font-mono text-rose-600">
                    {(overallStats.totalWithdrawn + overallStats.totalLoans).toLocaleString()} <span className="text-[9px]">ج.م</span>
                  </p>
                  <span className="text-[9px] font-bold text-rose-500">سحب شخصي وسلف</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">العهدة المعلقة</span>
                  <p className="text-sm sm:text-base font-black font-mono text-amber-600">
                    {overallStats.partnerCustody.toLocaleString()} <span className="text-[9px]">ج.م</span>
                  </p>
                  <span className="text-[9px] font-bold text-amber-600">عهدة تشغيلية طرفه</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-indigo-200 bg-indigo-50/40 shadow-xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-black text-indigo-700 block mb-1 uppercase">✅ تسويات العهد</span>
                  <p className="text-sm sm:text-base font-black font-mono text-indigo-700">
                    {overallStats.settledCustodyTotal.toLocaleString()} <span className="text-[9px]">ج.م</span>
                  </p>
                  <span className="text-[9px] font-bold text-indigo-600">تم توريدها ومطابقتها</span>
                </div>
              </div>
            )}

            {/* Sheet Ledger Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-sm text-slate-900">
                  سجل القيود والمعاملات ({filteredRows.length} قيد)
                </h3>
                <span className="text-xs text-slate-400 font-bold">العملة: الجنيه المصري (ج.م)</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                      <th className="p-3 w-[15%]">التاريخ والوقت</th>
                      <th className="p-3 w-[22%]">نوع المعاملة</th>
                      <th className="p-3 w-[33%]">البيان والملاحظات</th>
                      <th className="p-3 w-[15%] text-left">القيمة (مدين/دائن)</th>
                      <th className="p-3 w-[15%] text-left">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length > 0 ? (
                      filteredRows.map((t, idx) => {
                        const isAdd = t.isAddition;
                        const badge = getTxBadge(t.type, isAdd, t.note);
                        let accountName = '';
                        if (t.treasuryAccountId) {
                          const acc = treasury?.accounts?.find(a => String(a.id) === String(t.treasuryAccountId));
                          if (acc) accountName = acc.name;
                        }

                        return (
                          <tr key={t.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-slate-600 font-medium">
                              <div>{new Date(t.date).toLocaleDateString('ar-EG')}</div>
                              <div className="text-[10px] text-slate-400">{new Date(t.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.bg}`}>
                                <span>{badge.icon}</span>
                                <span>{getTxTypeName(t.type, t.note)}</span>
                              </span>
                              {accountName && (
                                <span className="block text-[9px] text-indigo-600 font-bold mt-0.5">
                                  {accountName}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700 font-medium leading-relaxed">
                              {t.note || '-'}
                            </td>
                            <td className={`p-3 text-left font-black font-mono text-xs ${isAdd ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isAdd ? '+' : '-'}{t.amountNum.toLocaleString()} ج.م
                            </td>
                            <td className="p-3 text-left font-black font-mono text-xs text-slate-800">
                              {t.runningBalance.toLocaleString()} ج.م
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                          لا توجد معاملات مسجلة تطابق محددات البحث والفترة المحددة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                      <td colSpan={3} className="p-3 text-slate-800">
                        صافي الرصيد المستحق للشريك:
                      </td>
                      <td colSpan={2} className={`p-3 text-left font-mono text-sm ${partner.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {partner.balance >= 0 ? '+' : ''}{partner.balance.toLocaleString()} ج.م
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Sheet Signatures */}
            {showSignatures && (
              <div className="pt-6 border-t border-dashed border-slate-300 flex justify-between text-xs text-slate-600 font-bold">
                <div className="w-[45%] space-y-1">
                  <p className="font-black text-slate-800">إعداد واعتماد الإدارة المالية:</p>
                  <p className="text-slate-400 text-[11px]">التوقيع / الختم: __________________________</p>
                </div>
                <div className="w-[45%] space-y-1">
                  <p className="font-black text-slate-800">إقرار ومصادقة الشريك ({partner.name}):</p>
                  <p className="text-slate-400 text-[11px]">التوقيع: __________________________</p>
                </div>
              </div>
            )}

            <div className="text-center pt-2 text-[10px] text-slate-400 font-medium">
              نظام إدارة الحسابات المالية الموحد • تم إنشاؤه إلكترونياً
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
