import React, { useState, useMemo } from 'react';
import { 
  Landmark, 
  Wallet, 
  ArrowRightLeft, 
  Users, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  History,
  Search,
  Download,
  AlertCircle,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  ChevronRight,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calculator,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  Scale,
  ShieldAlert,
  Sparkles,
  Building2,
  Smartphone,
  MapPin,
  UserCheck,
  RefreshCw,
  Layers,
  Check,
  Percent,
  SlidersHorizontal,
  FileText,
  Eye,
  Paperclip
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Settings, Treasury, TreasuryAccount, TreasuryTransaction, Order } from '../types';
import { calculateOrderProfitLoss, getVirtualOrderHandovers } from '../utils/financials';
import { inAppConfirm } from '../utils/inAppAlert';
import { generateSafeId } from '../utils/idUtils';
import { InvoiceAttachmentUploader } from './InvoiceAttachmentUploader';

interface TreasuryPageProps {
  settings: Settings;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
  wallet?: any;
  setWallet?: (updater: any) => void;
  orders?: Order[];
}

// Egyptian Cash Denominations for Smart Cash Count & Reconciliation
const CASH_DENOMINATIONS = [
  { value: 200, label: 'فئة 200 جنيه', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 100, label: 'فئة 100 جنيه', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/30' },
  { value: 50, label: 'فئة 50 جنيه', color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  { value: 20, label: 'فئة 20 جنيه', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 10, label: 'فئة 10 جنيهات', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { value: 5, label: 'فئة 5 جنيهات', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  { value: 1, label: 'فئة 1 جنيه (فكة)', color: 'text-slate-700 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-900/50' }
];

export const TreasuryPage: React.FC<TreasuryPageProps> = ({ 
  settings, 
  treasury, 
  setTreasury, 
  wallet, 
  setWallet, 
  orders = [] 
}) => {
  const accounts = treasury?.accounts || [];
  const transactions = treasury?.transactions || [];

  // Active Main Navigation Tab
  const [activeTab, setActiveTab] = useState<'accounts' | 'audit' | 'ledger' | 'analytics'>('accounts');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Modals state
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal' | 'transfer' | 'advance'>('deposit');

  // Form state for new account
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'safe' | 'bank' | 'wallet' | 'custody'>('safe');
  const [initialBalance, setInitialBalance] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [walletNumber, setWalletNumber] = useState('');
  const [walletName, setWalletName] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [location, setLocation] = useState('');
  const [maxLimit, setMaxLimit] = useState('');
  const [minLimit, setMinLimit] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Form state for transaction
  const [transAmount, setTransAmount] = useState('');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transDesc, setTransDesc] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [transAttachments, setTransAttachments] = useState<string[]>([]);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);

  // Editing state for accounts
  const [editingAccount, setEditingAccount] = useState<TreasuryAccount | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingBankName, setEditingBankName] = useState('');
  const [editingAccountNumber, setEditingAccountNumber] = useState('');
  const [editingBeneficiaryName, setEditingBeneficiaryName] = useState('');
  const [editingWalletNumber, setEditingWalletNumber] = useState('');
  const [editingWalletName, setEditingWalletName] = useState('');
  const [editingResponsible, setEditingResponsible] = useState('');
  const [editingLocation, setEditingLocation] = useState('');
  const [editingMaxLimit, setEditingMaxLimit] = useState('');
  const [editingMinLimit, setEditingMinLimit] = useState('');
  const [editingIsDefault, setEditingIsDefault] = useState(false);

  // Smart Cash Denomination Audit Tool State
  const [auditSelectedAccountId, setAuditSelectedAccountId] = useState<string>('');
  const [denominationsCount, setDenominationsCount] = useState<Record<number, number>>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0
  });
  const [auditNotes, setAuditNotes] = useState('');
  const [auditAuditorName, setAuditAuditorName] = useState('');
  const [auditSuccessFeedback, setAuditSuccessFeedback] = useState<string | null>(null);

  // Custom alert & confirmation dialog
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; isError?: boolean } | null>(null);

  // Delete transaction modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<TreasuryTransaction | null>(null);
  const [associatedTransactions, setAssociatedTransactions] = useState<TreasuryTransaction[]>([]);

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
    if (/^(زهره|زهرة)/.test(normalized)) {
      return 'زهره';
    }
    return normalized;
  };

  const holders = useMemo(() => {
    const rawHolders = settings?.cashHolders || [];
    const grouped: Record<string, any> = {};
    
    rawHolders.forEach((h: any) => {
      if (!h.userName) return;
      const name = normalizeName(h.userName);
      if (!grouped[name]) {
        grouped[name] = {
          userId: h.userId,
          userName: h.userName,
          currentBalance: h.currentBalance || 0,
          lastUpdated: h.lastUpdated || new Date().toISOString(),
          originalIds: [h.userId]
        };
      } else {
        grouped[name].currentBalance += (h.currentBalance || 0);
        if (!grouped[name].originalIds.includes(h.userId)) {
          grouped[name].originalIds.push(h.userId);
        }
        if (h.lastUpdated && new Date(h.lastUpdated) > new Date(grouped[name].lastUpdated)) {
          grouped[name].lastUpdated = h.lastUpdated;
        }
      }
    });

    const baseHandovers = settings?.cashHandovers || [];
    const virtuals = getVirtualOrderHandovers(orders, settings, treasury);
    const handovers = [...baseHandovers, ...virtuals];

    const allUsers = [
      ...(settings?.partners || []).map(p => ({ id: p.id, name: p.name, type: 'partner' })),
      ...(settings?.employees || []).map(e => ({ id: e.id, name: e.name, type: 'employee' }))
    ];

    allUsers.forEach(user => {
      const holderId = user.type === 'partner' ? `part_${user.id}` : `emp_${user.id}`;
      const userHolders = rawHolders.filter((h: any) => 
        h.userId === holderId || 
        h.userId === user.id || 
        normalizeName(h.userName) === normalizeName(user.name)
      );
      const userUserIds = [holderId, user.id, ...userHolders.map(h => h.userId)];

      const userHandovers = handovers.filter(h => 
        userUserIds.includes(h.fromUserId) || 
        userUserIds.includes(h.toUserId) || 
        h.toUserId === user.id || 
        h.toUserId === holderId || 
        h.fromUserId === user.id || 
        h.fromUserId === holderId || 
        normalizeName(h.toUserName || '').includes(normalizeName(user.name)) || 
        normalizeName(h.fromUserName || '').includes(normalizeName(user.name))
      );

      const settlements = userHandovers.filter(h => 
        h.toUserId === 'admin_deduction' || 
        h.toUserId === 'admin_manual' ||
        (h.toUserName && (h.toUserName.includes('خصم') || h.toUserName.includes('تصفية') || h.toUserName.includes('تسوية'))) ||
        (h.notes && (h.notes.includes('خصم') || h.notes.includes('تصفية') || h.notes.includes('تسوية')))
      );
      const hasSettlement = settlements.length > 0;
      let holderSum = userHolders.reduce((sum, h) => sum + (h.currentBalance || 0), 0);

      let custodyAmt = 0;
      if (hasSettlement) {
        const lastSettlement = settlements.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const activeHandovers = userHandovers.filter(h => new Date(h.date).getTime() > new Date(lastSettlement.date).getTime());
        const activeHandoverSum = activeHandovers.reduce((sum, h) => {
          const isGive = userUserIds.includes(h.toUserId) || h.toUserId === user.id || h.toUserId === holderId || normalizeName(h.toUserName || '').includes(normalizeName(user.name));
          return isGive ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
        }, 0);
        custodyAmt = Math.max(0, holderSum) + Math.max(0, activeHandoverSum);
      } else {
        let handoverSum = userHandovers.reduce((sum, h) => {
          const isGive = userUserIds.includes(h.toUserId) || h.toUserId === user.id || h.toUserId === holderId || normalizeName(h.toUserName || '').includes(normalizeName(user.name));
          return isGive ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
        }, 0);
        custodyAmt = Math.max(holderSum, Math.max(0, handoverSum));
        if (custodyAmt <= 0 && holderSum > 0) custodyAmt = holderSum;
      }
      custodyAmt = Math.max(0, custodyAmt);

      const name = normalizeName(user.name);
      if (!grouped[name]) {
        if (custodyAmt > 0) {
          grouped[name] = {
            userId: holderId,
            userName: user.name,
            currentBalance: custodyAmt,
            lastUpdated: new Date().toISOString(),
            originalIds: [holderId, user.id]
          };
        }
      } else {
        grouped[name].currentBalance = custodyAmt;
      } 
    });

    return Object.values(grouped);
  }, [settings?.cashHolders, settings?.cashHandovers, settings?.partners, settings?.employees, orders, treasury]);

  // Dynamically calculate live balance for main wallet to match WalletPage behavior
  const calculateMainWalletBalance = () => {
    return (wallet?.transactions || []).reduce((sum: number, t: any) => {
      const amount = Number(t.amount) || 0;
      
      // Exclude all transactions belonging to supply wallet from main wallet balance
      const catStr = String(t.category || '');
      const typeStr = String(t.type || '');
      if (
        catStr.startsWith('supply_') ||
        catStr === 'supply_purchase' ||
        catStr === 'supply_deposit' ||
        catStr === 'supply_funding' ||
        catStr === 'supply_withdrawal' ||
        catStr === 'supplier_payment' ||
        catStr === 'inventory_purchase' ||
        t.details?.destinationType === 'supply_wallet' ||
        (t.id && String(t.id).endsWith('-in') && (t.note?.includes('محفظة التوريد') || t.note?.includes('التوريد')))
      ) {
        return sum;
      }

      if ((t.details?.paidByPartnerId || t.details?.expensePaidBy || t.note?.includes('دفعهم') || t.note?.includes('شريك')) && !t.note?.includes('المحفظة المركزية')) return sum;
      if (t.details?.cashHolderId || (t.details?.expensePaidBy && t.note?.includes('عهدة'))) return sum;

      // Handle treasury synchronization & transfers FIRST (before generic deposit/withdrawal check)
      if (catStr === 'treasury_sync' || typeStr === 'تحويل' || (t.id && String(t.id).startsWith('TR-'))) {
        const treasuryTxId = (t.details?.treasuryTxId || String(t.id).replace('TR-', '').replace('-out', '').replace('-in', ''));
        const tTx = treasury?.transactions?.find((x: any) => x.id === treasuryTxId);
        if (tTx) {
          // Transfer directly between main_wallet and supply_wallet
          if (tTx.fromAccountId === 'main_wallet' && tTx.toAccountId === 'supply_wallet') {
            return sum - amount;
          }
          if (tTx.fromAccountId === 'supply_wallet' && tTx.toAccountId === 'main_wallet') {
            return sum + amount;
          }
          // Main wallet to other treasury accounts
          if (tTx.fromAccountId === 'main_wallet') return sum - amount;
          if (tTx.toAccountId === 'main_wallet') return sum + amount;
          // Transfer did not involve main_wallet (e.g., bank -> supply_wallet)
          return sum;
        }

        // Fallback heuristics for unlinked or legacy transactions
        if (t.details?.toAccountId === 'supply_wallet' || t.note?.includes('إلى محفظة التوريد') || t.note?.includes('إلى التوريد') || (t.id && String(t.id).endsWith('-out'))) {
          return sum - amount;
        }
        if (t.details?.fromAccountId === 'supply_wallet' || t.note?.includes('من محفظة التوريد') || t.note?.includes('من التوريد')) {
          return sum + amount;
        }
        if (t.details?.fromAccountId === 'main_wallet' || t.type === 'سحب') {
          return sum - amount;
        }
        if (t.details?.toAccountId === 'main_wallet' || t.type === 'إيداع') {
          return sum + amount;
        }
        if (t.note?.includes('إنستاباي') || t.note?.includes('بنك') || t.note?.includes('إيداع')) {
          return sum + amount;
        }
        return sum;
      }

      if (t.type === 'إيداع') {
        if (t.status === 'cancelled') return sum;
        if (t.status === 'pending' && (t.category === 'wallet_charge' || t.category === 'charge')) return sum;
        return sum + amount;
      }
      if (t.type === 'سحب') {
        if (t.details?.treasuryAccountId && t.details.treasuryAccountId !== 'main_wallet') return sum;
        return t.status === 'cancelled' ? sum : sum - amount;
      }
      
      return sum;
    }, 0);
  };

  const autoClosingDiff = settings.enableAutoClosingDifference 
    ? Math.abs(orders
        .filter(o => ['تم_توصيلها', 'تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'مرتجع_جزئي'].includes(o.status))
        .reduce((sum, o) => sum + (calculateOrderProfitLoss(o, settings).closingDifference || 0), 0))
    : (settings.hiddenWalletAmount || 0);
  const hidden = settings.enableHiddenWalletAmount ? autoClosingDiff : 0;

  const virtualAccounts: TreasuryAccount[] = [
    {
      id: 'main_wallet',
      name: 'المحفظة العامة (الرصيد الأساسي)',
      type: 'wallet',
      balance: Math.max(0, calculateMainWalletBalance() - hidden),
      currency: 'EGP',
      walletName: 'المحفظة العامة',
      location: 'المركز المالي الرئيسي'
    },
    {
      id: 'supply_wallet',
      name: 'محفظة التوريد (رأس مال المخزون)',
      type: 'wallet',
      balance: Number(wallet?.supplyBalance || 0),
      currency: 'EGP',
      walletName: 'محفظة التوريد',
      location: 'حساب توريدات البضاعة'
    }
  ];

  const allAccounts: TreasuryAccount[] = [...virtualAccounts, ...accounts];

  // Financial aggregates & metrics
  const totalLiquidBalance = useMemo(() => {
    return allAccounts.filter(a => a.type !== 'custody').reduce((sum, acc) => sum + acc.balance, 0);
  }, [allAccounts]);

  const totalCashInSafes = useMemo(() => {
    return allAccounts.filter(a => a.type === 'safe').reduce((sum, acc) => sum + acc.balance, 0);
  }, [allAccounts]);

  const totalInBanks = useMemo(() => {
    return allAccounts.filter(a => a.type === 'bank').reduce((sum, acc) => sum + acc.balance, 0);
  }, [allAccounts]);

  const totalInWallets = useMemo(() => {
    return allAccounts.filter(a => a.type === 'wallet').reduce((sum, acc) => sum + acc.balance, 0);
  }, [allAccounts]);

  const totalCustody = useMemo(() => {
    const custodyFromAccounts = accounts.filter(a => a.type === 'custody').reduce((sum, acc) => sum + acc.balance, 0);
    const custodyFromHolders = holders.reduce((sum, h) => sum + (h.currentBalance || 0), 0);
    return custodyFromAccounts + custodyFromHolders;
  }, [accounts, holders]);

  // Net Cash Flow Analysis for current ledger
  const { totalDeposits, totalWithdrawals, netCashFlow } = useMemo(() => {
    let dep = 0;
    let wth = 0;
    transactions.forEach(t => {
      if (t.type === 'deposit') dep += Number(t.amount) || 0;
      if (t.type === 'withdrawal') wth += Number(t.amount) || 0;
    });
    return {
      totalDeposits: dep,
      totalWithdrawals: wth,
      netCashFlow: dep - wth
    };
  }, [transactions]);

  // Accounts requiring audit or breaching threshold alerts
  const thresholdAlerts = useMemo(() => {
    const alerts: Array<{ account: TreasuryAccount; type: 'max' | 'min'; diff: number }> = [];
    allAccounts.forEach(acc => {
      if (acc.maxLimit && acc.balance > acc.maxLimit) {
        alerts.push({ account: acc, type: 'max', diff: acc.balance - acc.maxLimit });
      }
      if (acc.minLimit && acc.balance < acc.minLimit) {
        alerts.push({ account: acc, type: 'min', diff: acc.minLimit - acc.balance });
      }
    });
    return alerts;
  }, [allAccounts]);

  // Filtered transactions for the ledger view
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Type filter
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;

      // Account filter
      if (accountFilter !== 'all' && t.fromAccountId !== accountFilter && t.toAccountId !== accountFilter) return false;

      // Date filter
      if (dateFilter !== 'all') {
        const txDate = new Date(t.date);
        const now = new Date();
        if (dateFilter === 'today') {
          if (txDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (txDate < weekAgo) return false;
        } else if (dateFilter === 'month') {
          if (txDate.getMonth() !== now.getMonth() || txDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fromName = allAccounts.find(a => a.id === t.fromAccountId)?.name?.toLowerCase() || '';
        const toName = allAccounts.find(a => a.id === t.toAccountId)?.name?.toLowerCase() || '';
        const desc = (t.description || '').toLowerCase();
        const ref = (t.reference || '').toLowerCase();
        const op = (t.operatorName || '').toLowerCase();
        return desc.includes(q) || ref.includes(q) || op.includes(q) || fromName.includes(q) || toName.includes(q);
      }

      return true;
    });
  }, [transactions, typeFilter, accountFilter, dateFilter, searchQuery, allAccounts]);

  // Smart Cash Denomination calculations
  const effectiveAuditAccount = useMemo(() => {
    if (auditSelectedAccountId) {
      return allAccounts.find(a => a.id === auditSelectedAccountId);
    }
    const defaultSafe = allAccounts.find(a => a.isDefault && a.type === 'safe');
    if (defaultSafe) return defaultSafe;
    return allAccounts.find(a => a.type === 'safe') || allAccounts[0];
  }, [auditSelectedAccountId, allAccounts]);

  const physicalCashCountTotal = useMemo(() => {
    return Object.entries(denominationsCount).reduce((sum, [denomStr, count]) => {
      const denom = Number(denomStr);
      return sum + (denom * (Number(count) || 0));
    }, 0);
  }, [denominationsCount]);

  const bookBalanceForAudit = effectiveAuditAccount ? effectiveAuditAccount.balance : 0;
  const auditDifference = physicalCashCountTotal - bookBalanceForAudit; // + is surplus, - is deficit

  // Quick Account Handlers
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;

    const newAccount: TreasuryAccount = {
      id: generateSafeId('acc'),
      name: accountName.trim(),
      type: accountType,
      balance: Number(initialBalance) || 0,
      currency: 'EGP',
      bankName: accountType === 'bank' ? bankName.trim() : undefined,
      accountNumber: accountType === 'bank' ? accountNumber.trim() : undefined,
      beneficiaryName: accountType === 'bank' ? beneficiaryName.trim() : undefined,
      walletNumber: accountType === 'wallet' ? walletNumber.trim() : undefined,
      walletName: accountType === 'wallet' ? walletName.trim() : undefined,
      responsiblePerson: responsiblePerson.trim() || undefined,
      location: location.trim() || undefined,
      maxLimit: maxLimit ? Number(maxLimit) : undefined,
      minLimit: minLimit ? Number(minLimit) : undefined,
      isDefault: isDefault
    };

    if (setTreasury) {
      setTreasury((prev: Treasury) => {
        let updatedAccounts = [...prev.accounts];
        if (newAccount.isDefault) {
          updatedAccounts = updatedAccounts.map(a => ({ ...a, isDefault: false }));
        }
        return {
          ...prev,
          accounts: [...updatedAccounts, newAccount]
        };
      });
    }

    setShowAddAccountModal(false);
    // Reset inputs
    setAccountName('');
    setInitialBalance('');
    setBankName('');
    setAccountNumber('');
    setBeneficiaryName('');
    setWalletNumber('');
    setWalletName('');
    setResponsiblePerson('');
    setLocation('');
    setMaxLimit('');
    setMinLimit('');
    setIsDefault(false);
  };

  const startEditAccount = (acc: TreasuryAccount) => {
    setEditingAccount(acc);
    setEditingName(acc.name);
    setEditingBankName(acc.bankName || '');
    setEditingAccountNumber(acc.accountNumber || '');
    setEditingBeneficiaryName(acc.beneficiaryName || '');
    setEditingWalletNumber(acc.walletNumber || '');
    setEditingWalletName(acc.walletName || '');
    setEditingResponsible(acc.responsiblePerson || '');
    setEditingLocation(acc.location || '');
    setEditingMaxLimit(acc.maxLimit ? String(acc.maxLimit) : '');
    setEditingMinLimit(acc.minLimit ? String(acc.minLimit) : '');
    setEditingIsDefault(Boolean(acc.isDefault));
  };

  const handleSaveEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editingName.trim()) return;

    if (setTreasury) {
      setTreasury((prev: Treasury) => ({
        ...prev,
        accounts: prev.accounts.map(acc => {
          if (acc.id === editingAccount.id) {
            return {
              ...acc,
              name: editingName.trim(),
              bankName: acc.type === 'bank' ? editingBankName.trim() : undefined,
              accountNumber: acc.type === 'bank' ? editingAccountNumber.trim() : undefined,
              beneficiaryName: acc.type === 'bank' ? editingBeneficiaryName.trim() : undefined,
              walletNumber: acc.type === 'wallet' ? editingWalletNumber.trim() : undefined,
              walletName: acc.type === 'wallet' ? editingWalletName.trim() : undefined,
              responsiblePerson: editingResponsible.trim() || undefined,
              location: editingLocation.trim() || undefined,
              maxLimit: editingMaxLimit ? Number(editingMaxLimit) : undefined,
              minLimit: editingMinLimit ? Number(editingMinLimit) : undefined,
              isDefault: editingIsDefault
            };
          }
          if (editingIsDefault) {
            return { ...acc, isDefault: false };
          }
          return acc;
        })
      }));
    }

    setEditingAccount(null);
  };

  const handleDeleteAccount = async (acc: TreasuryAccount) => {
    if (acc.balance !== 0) {
      setAlertConfig({
        isOpen: true,
        title: 'لا يمكن حذف الحساب',
        message: `عفواً، لا يمكن حذف الحساب "${acc.name}" لأن رصيده الحالي (${acc.balance.toLocaleString()} ج.م) ليس صفراً. يرجى تصفية أو تحويل الرصيد المتبقي أولاً لضمان سلامة الدفاتر المالية.`,
        isError: true
      });
      return;
    }

    if (accounts.length <= 1) {
      setAlertConfig({
        isOpen: true,
        title: 'إجراء غير مسموح',
        message: 'يجب أن يحتوي النظام على حساب مالي أو خزينة واحدة تابعة على الأقل.',
        isError: true
      });
      return;
    }

    const ok = await inAppConfirm(`هل أنت متأكد من رغبتك في حذف الحساب "${acc.name}" نهائياً من سجلات الخزينة؟`, {
      title: 'حذف حساب مالي من الخزينة',
      type: 'danger',
      confirmText: 'نعم، حذف الحساب',
      cancelText: 'إلغاء'
    });

    if (ok && setTreasury) {
      setTreasury((prev: Treasury) => ({
        ...prev,
        accounts: prev.accounts.filter(a => a.id !== acc.id)
      }));
    }
  };

  // Transaction Handler
  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transAmount);
    if (!amount || amount <= 0) return;

    const fromAccountId = (transactionType === 'withdrawal' || transactionType === 'transfer' || transactionType === 'advance') ? fromAccount : undefined;
    const toAccountId = (transactionType === 'deposit' || transactionType === 'transfer' || transactionType === 'advance') ? toAccount : undefined;

    // Overdraft safeguard check
    if (fromAccountId) {
      const srcAcc = allAccounts.find(a => a.id === fromAccountId);
      if (srcAcc && srcAcc.balance < amount) {
        setAlertConfig({
          isOpen: true,
          title: 'رصيد غير كافٍ',
          message: `عفواً، لا يمكن إتمام العملية لأن رصيد حساب المنصرف منه "${srcAcc.name}" (${srcAcc.balance.toLocaleString()} ج.م) لا يكفي لسحب مبلغ قدره ${amount.toLocaleString()} ج.م.`,
          isError: true
        });
        return;
      }
    }

    const newTx: TreasuryTransaction = {
      id: generateSafeId('tx'),
      date: new Date().toISOString(),
      type: transactionType,
      amount,
      description: transDesc.trim() || `حركة خزينة (${transactionType})`,
      fromAccountId,
      toAccountId,
      operatorName: operatorName.trim() || 'المسؤول المالي',
      reference: `TRX-${Date.now().toString().slice(-6)}`,
      attachmentUrl: transAttachments[0] || undefined,
      attachments: transAttachments.length > 0 ? transAttachments : undefined
    };

    if (setTreasury) {
      setTreasury((prev: Treasury) => {
        let updatedAccounts = [...prev.accounts];
        if (newTx.fromAccountId && !['main_wallet', 'supply_wallet'].includes(newTx.fromAccountId)) {
          updatedAccounts = updatedAccounts.map(acc => 
            acc.id === newTx.fromAccountId ? { ...acc, balance: acc.balance - amount } : acc
          );
        }
        if (newTx.toAccountId && !['main_wallet', 'supply_wallet'].includes(newTx.toAccountId)) {
          updatedAccounts = updatedAccounts.map(acc => 
            acc.id === newTx.toAccountId ? { ...acc, balance: acc.balance + amount } : acc
          );
        }
        return {
          ...prev,
          accounts: updatedAccounts,
          transactions: [newTx, ...prev.transactions]
        };
      });
    }

    // Handle wallet updates if virtual accounts (main_wallet or supply_wallet) are used
    if (setWallet && (fromAccountId === 'main_wallet' || fromAccountId === 'supply_wallet' || toAccountId === 'main_wallet' || toAccountId === 'supply_wallet')) {
      setWallet((prev: any) => {
        let newBalance = Number(prev.balance) || 0;
        let newSupplyBalance = Number(prev.supplyBalance) || 0;
        const walletTxs = [...(prev.transactions || [])];

        const isFromMain = fromAccountId === 'main_wallet';
        const isToMain = toAccountId === 'main_wallet';
        const isFromSupply = fromAccountId === 'supply_wallet';
        const isToSupply = toAccountId === 'supply_wallet';

        if (isFromMain) newBalance -= amount;
        if (isToMain) newBalance += amount;
        if (isFromSupply) newSupplyBalance -= amount;
        if (isToSupply) newSupplyBalance += amount;

        const fromAccName = allAccounts.find(a => a.id === fromAccountId)?.name || fromAccountId;
        const toAccName = allAccounts.find(a => a.id === toAccountId)?.name || toAccountId;

        // 1. Direct transfer between Main Wallet and Supply Wallet
        if (isFromMain && isToSupply) {
          // Outgoing deduction from Main Wallet (recorded as withdrawal)
          walletTxs.unshift({
            id: `TR-${newTx.id}-out`,
            type: 'سحب',
            amount,
            date: newTx.date,
            note: transDesc ? `تحويل إلى محفظة التوريد: ${transDesc}` : 'تحويل مالي صادر من المحفظة العامة إلى محفظة التوريد',
            category: 'treasury_sync',
            details: {
              fromAccountId: 'main_wallet',
              toAccountId: 'supply_wallet',
              treasuryTxId: newTx.id,
              type: 'transfer_to_supply'
            },
            status: 'completed'
          });
          // Incoming deposit into Supply Wallet (shows under supply tab, excluded from main wallet balance)
          walletTxs.unshift({
            id: `TR-${newTx.id}-in`,
            type: 'إيداع',
            amount,
            date: newTx.date,
            note: transDesc ? `تغذية محفظة التوريد: ${transDesc}` : 'تغذية وتمويل محفظة التوريد من المحفظة العامة',
            category: 'supply_deposit',
            details: {
              fromAccountId: 'main_wallet',
              toAccountId: 'supply_wallet',
              treasuryTxId: newTx.id,
              type: 'transfer_from_main'
            },
            status: 'completed'
          });
        } else if (isFromSupply && isToMain) {
          // Incoming deposit to Main Wallet
          walletTxs.unshift({
            id: `TR-${newTx.id}-in`,
            type: 'إيداع',
            amount,
            date: newTx.date,
            note: transDesc ? `تحويل وارد من محفظة التوريد: ${transDesc}` : 'تحويل مالي وارد للمحفظة العامة من محفظة التوريد',
            category: 'treasury_sync',
            details: {
              fromAccountId: 'supply_wallet',
              toAccountId: 'main_wallet',
              treasuryTxId: newTx.id
            },
            status: 'completed'
          });
          // Outgoing deduction from Supply Wallet
          walletTxs.unshift({
            id: `TR-${newTx.id}-out`,
            type: 'سحب',
            amount,
            date: newTx.date,
            note: transDesc ? `تحويل صادر إلى المحفظة العامة: ${transDesc}` : 'تحويل مالي صادر من محفظة التوريد إلى المحفظة العامة',
            category: 'supply_withdrawal',
            details: {
              fromAccountId: 'supply_wallet',
              toAccountId: 'main_wallet',
              treasuryTxId: newTx.id
            },
            status: 'completed'
          });
        } else if (isFromMain) {
          // Outgoing from Main Wallet to external account (Bank/Safe)
          walletTxs.unshift({
            id: `TR-${newTx.id}`,
            type: 'سحب',
            amount,
            date: newTx.date,
            note: transDesc ? `تحويل من المحفظة إلى ${toAccName}: ${transDesc}` : `تحويل مالي من المحفظة العامة إلى ${toAccName}`,
            category: 'treasury_sync',
            details: {
              fromAccountId: 'main_wallet',
              toAccountId,
              treasuryTxId: newTx.id
            },
            status: 'completed'
          });
        } else if (isToMain) {
          // Incoming to Main Wallet from external account (Bank/Safe)
          walletTxs.unshift({
            id: `TR-${newTx.id}`,
            type: 'إيداع',
            amount,
            date: newTx.date,
            note: transDesc ? `إيداع بالمحفظة من ${fromAccName}: ${transDesc}` : `إيداع/تحويل وارد للمحفظة العامة من ${fromAccName}`,
            category: 'treasury_sync',
            details: {
              fromAccountId,
              toAccountId: 'main_wallet',
              treasuryTxId: newTx.id
            },
            status: 'completed'
          });
        } else if (isToSupply) {
          // Funding Supply Wallet from external account (Bank/Safe) - Does NOT touch Main Wallet
          walletTxs.unshift({
            id: `TR-${newTx.id}`,
            type: 'إيداع',
            amount,
            date: newTx.date,
            note: transDesc ? `تغذية محفظة التوريد من ${fromAccName}: ${transDesc}` : `تغذية وتمويل محفظة التوريد من ${fromAccName}`,
            category: 'supply_deposit',
            details: {
              fromAccountId,
              toAccountId: 'supply_wallet',
              treasuryTxId: newTx.id
            },
            status: 'completed'
          });
        } else if (isFromSupply) {
          // Withdrawal from Supply Wallet to external account (Bank/Safe) - Does NOT touch Main Wallet
          walletTxs.unshift({
            id: `TR-${newTx.id}`,
            type: 'سحب',
            amount,
            date: newTx.date,
            note: transDesc ? `سحب من محفظة التوريد إلى ${toAccName}: ${transDesc}` : `سحب من محفظة التوريد إلى ${toAccName}`,
            category: 'supply_withdrawal',
            details: {
              fromAccountId: 'supply_wallet',
              toAccountId,
              treasuryTxId: newTx.id
            },
            status: 'completed'
          });
        }

        return {
          ...prev,
          balance: newBalance,
          supplyBalance: newSupplyBalance,
          transactions: walletTxs
        };
      });
    }
    
    setShowTransactionModal(false);
    setTransAmount('');
    setTransDesc('');
    setFromAccount('');
    setToAccount('');
    setOperatorName('');
    setTransAttachments([]);
  };

  // Reconcile and Save Smart Cash Count
  const handleSaveSmartAudit = (applyAdjustment = false) => {
    if (!effectiveAuditAccount) return;

    const auditedAccount = effectiveAuditAccount;
    const nowIso = new Date().toISOString();

    if (applyAdjustment && auditDifference !== 0) {
      const isSurplus = auditDifference > 0;
      const adjustAmount = Math.abs(auditDifference);

      const adjTx: TreasuryTransaction = {
        id: generateSafeId('adj_tx'),
        date: nowIso,
        type: isSurplus ? 'deposit' : 'withdrawal',
        amount: adjustAmount,
        description: isSurplus 
          ? `تسوية جرد فعلي (فائض نقدي) - محضر جرد ${auditedAccount.name}` 
          : `تسوية جرد فعلي (عجز نقدي) - محضر جرد ${auditedAccount.name}`,
        fromAccountId: isSurplus ? undefined : auditedAccount.id,
        toAccountId: isSurplus ? auditedAccount.id : undefined,
        operatorName: auditAuditorName.trim() || 'لجنة الجرد',
        reconciliationDiff: auditDifference,
        reference: `AUD-${Date.now().toString().slice(-6)}`
      };

      if (setTreasury) {
        setTreasury((prev: Treasury) => ({
          ...prev,
          accounts: prev.accounts.map(acc => 
            acc.id === auditedAccount.id ? { 
              ...acc, 
              balance: acc.balance + auditDifference, 
              lastAuditedAt: nowIso 
            } : acc
          ),
          transactions: [adjTx, ...prev.transactions]
        }));
      }

      setAuditSuccessFeedback(`تم اعتماد محضر الجرد وتسوية الفارق (${auditDifference > 0 ? '+' : ''}${auditDifference.toLocaleString()} ج.م) في الدفاتر بنجاح!`);
    } else {
      // Just update last audited timestamp
      if (setTreasury) {
        setTreasury((prev: Treasury) => ({
          ...prev,
          accounts: prev.accounts.map(acc => 
            acc.id === auditedAccount.id ? { ...acc, lastAuditedAt: nowIso } : acc
          )
        }));
      }
      setAuditSuccessFeedback(`تم حفظ وتوثيق محضر جرد ${auditedAccount.name} بنجاح.`);
    }

    setTimeout(() => {
      setAuditSuccessFeedback(null);
    }, 5000);
  };

  // Export Treasury Ledger to Excel (.xlsx)
  const handleExportLedgerExcel = () => {
    if (filteredTransactions.length === 0) {
      setAlertConfig({
        isOpen: true,
        title: 'لا توجد بيانات للتصدير',
        message: 'لا توجد حركات مالية مطابقة للشروط المحددة لتصديرها.',
        isError: true
      });
      return;
    }

    const exportRows = filteredTransactions.map((tx, idx) => {
      const fromAcc = allAccounts.find(a => a.id === tx.fromAccountId)?.name || '-';
      const toAcc = allAccounts.find(a => a.id === tx.toAccountId)?.name || '-';
      const typeLabel = 
        tx.type === 'deposit' ? 'إيداع نقدي / إيراد' :
        tx.type === 'withdrawal' ? 'صرف نقدي / مصروف' :
        tx.type === 'advance' ? 'تسليم عهدة تشغيل' : 'تحويل أرصدة';

      return {
        '#': idx + 1,
        'المرجع': tx.reference || tx.id,
        'التاريخ': new Date(tx.date).toLocaleDateString('ar-EG'),
        'الوقت': new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        'نوع الحركة': typeLabel,
        'البيان والتفاصيل': tx.description,
        'من حساب (المنصرف منه)': fromAcc,
        'إلى حساب (المستلم)': toAcc,
        'المبلغ (ج.م)': tx.amount,
        'المسؤول / المنفذ': tx.operatorName || 'المسؤول المالي'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'حركات الخزينة والسيولة');
    XLSX.writeFile(workbook, `سجل_الخزينة_والسيولة_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Print Treasury Ledger / Statement
  const handlePrintLedger = () => {
    window.print();
  };

  // Delete transaction with reversal
  const initiateDeleteTransaction = (tx: TreasuryTransaction) => {
    setTransactionToDelete(tx);
    const match = tx.description.match(/#(MNT-\d+|\d+)/i) || tx.description.match(/#\S+/);
    const reference = match ? match[0] : null;

    if (reference) {
      const associated = transactions.filter(t => t.id !== tx.id && t.description.includes(reference));
      setAssociatedTransactions(associated);
    } else {
      setAssociatedTransactions([]);
    }
    
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteTransaction = () => {
    if (!transactionToDelete) return;
    const txsToDelete = [transactionToDelete, ...associatedTransactions];
    const txIdsToDelete = txsToDelete.map(t => t.id);

    if (setTreasury) {
      setTreasury((prev: Treasury) => {
        let updatedAccounts = [...prev.accounts];
        let mainBalanceDiff = 0;
        let supplyBalanceDiff = 0;

        txsToDelete.forEach(tx => {
          const amount = tx.amount;
          if (tx.fromAccountId) {
            if (tx.fromAccountId === 'main_wallet') mainBalanceDiff += amount;
            else if (tx.fromAccountId === 'supply_wallet') supplyBalanceDiff += amount;
            else {
              updatedAccounts = updatedAccounts.map(acc => 
                acc.id === tx.fromAccountId ? { ...acc, balance: acc.balance + amount } : acc
              );
            }
          }
          if (tx.toAccountId) {
            if (tx.toAccountId === 'main_wallet') mainBalanceDiff -= amount;
            else if (tx.toAccountId === 'supply_wallet') supplyBalanceDiff -= amount;
            else {
              updatedAccounts = updatedAccounts.map(acc => 
                acc.id === tx.toAccountId ? { ...acc, balance: acc.balance - amount } : acc
              );
            }
          }
        });

        if (setWallet && (mainBalanceDiff !== 0 || supplyBalanceDiff !== 0 || txIdsToDelete.length > 0)) {
          setWallet((prevWallet: any) => {
            const match = transactionToDelete.description.match(/#(MNT-\d+|\d+)/i) || transactionToDelete.description.match(/#\S+/);
            const ref = match ? match[0] : '';
            const deletedIdSet = new Set(txIdsToDelete);

            const filteredWalletTx = (prevWallet.transactions || []).filter((wTx: any) => {
              if (ref && wTx.note && wTx.note.includes(ref)) return false;
              const wTreasuryId = (wTx.details?.treasuryTxId || String(wTx.id).replace('TR-', '').replace('-out', '').replace('-in', ''));
              if (deletedIdSet.has(wTreasuryId) || deletedIdSet.has(wTx.id)) return false;
              return true;
            });

            return {
              ...prevWallet,
              balance: (prevWallet.balance || 0) + mainBalanceDiff,
              supplyBalance: Math.max(0, (prevWallet.supplyBalance || 0) + supplyBalanceDiff),
              transactions: filteredWalletTx
            };
          });
        }

        const remainingTransactions = prev.transactions.filter(t => !txIdsToDelete.includes(t.id));

        return {
          accounts: updatedAccounts,
          transactions: remainingTransactions
        };
      });
    }

    setShowDeleteModal(false);
    setTransactionToDelete(null);
    setAssociatedTransactions([]);

    setAlertConfig({
      isOpen: true,
      title: 'تم الحذف والتسوية بنجاح',
      message: `تم حذف ${txsToDelete.length} حركة مالية بنجاح وإعادة تسوية أرصدة الحسابات المتأثرة تلقائياً.`,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto font-sans text-right" dir="rtl">
      
      {/* ======================================================== */}
      {/* 1. ARCHITECTURAL HERO BANNER & COMMAND BAR               */}
      {/* ======================================================== */}
      <div id="treasury-header" className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d1b2a] to-emerald-950 rounded-[2.5rem] p-7 sm:p-9 border border-slate-800 shadow-2xl text-white">
        {/* Ambient glow orbs */}
        <div className="absolute top-0 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-black tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>نظام الإدارة المالية الشاملة · الخزائن المركزية وإدارة السيولة</span>
              <span className="text-[10px] text-slate-400">·</span>
              <span className="text-slate-300">{allAccounts.length} أوعية نقدية معتمدة</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/40">
                <Landmark className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                  <span>إدارة الخزائن وأوعية السيولة النقدية</span>
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed mt-1 max-w-2xl">
                  رصد مباشر للنقدية السائلة، أداة جرد الفئات، وتتبع التحويلات البنكية والمحافظ وأدراج الكاشير بدقة دفاتر متناهية.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Command Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              onClick={() => { setTransactionType('deposit'); setShowTransactionModal(true); }}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
            >
              <TrendingUp className="w-4 h-4" />
              <span>إيداع نقدي</span>
            </button>

            <button 
              onClick={() => { setTransactionType('withdrawal'); setShowTransactionModal(true); }}
              className="flex items-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
            >
              <TrendingDown className="w-4 h-4" />
              <span>صرف مصروف</span>
            </button>

            <button 
              onClick={() => { setTransactionType('transfer'); setShowTransactionModal(true); }}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>تحويل بين الخزائن</span>
            </button>

            <button 
              onClick={() => setActiveTab('audit')}
              className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-2xl font-black text-xs transition-all cursor-pointer active:scale-95 backdrop-blur-xs"
            >
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>جرد فئات النقدية</span>
            </button>

            <button 
              onClick={handleExportLedgerExcel}
              className="flex items-center gap-1.5 px-3.5 py-3 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-2xl font-black text-xs transition-all cursor-pointer"
              title="تصدير كشف الحساب إلى Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Threshold and Reserve Alerts Banner if triggered */}
      {thresholdAlerts.length > 0 && (
        <div className="space-y-2">
          {thresholdAlerts.map((alt, idx) => (
            <div 
              key={alt.account.id + idx}
              className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                alt.type === 'max'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 shrink-0 ${alt.type === 'max' ? 'text-amber-600' : 'text-rose-600'}`} />
                <div>
                  <span className="font-black">
                    {alt.type === 'max' ? 'تنبيه تكدس سيولة نقدية: ' : 'تحذير انخفاض سيولة الأمان: '}
                  </span>
                  <span>
                    الرصيد في {alt.account.name} بلغ {alt.account.balance.toLocaleString()} ج.م 
                    ({alt.type === 'max' ? `تجاوز الحد الأقصى بفارق +${alt.diff.toLocaleString()} ج.م` : `أقل من الحد الأدنى بفارق -${alt.diff.toLocaleString()} ج.م`}).
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setTransactionType('transfer');
                  setFromAccount(alt.account.id);
                  setShowTransactionModal(true);
                }}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black shadow-xs hover:bg-slate-50 cursor-pointer"
              >
                تحويل وتفريغ الفائض
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CORPORATE LIQUIDITY METRICS CARDS                     */}
      {/* ======================================================== */}
      <div id="treasury-stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Liquid Capital */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                إجمالي السيولة النقدية المتوفرة
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tabular-nums tracking-tight">
                {totalLiquidBalance.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>كاش خزائن: {totalCashInSafes.toLocaleString()} ج.م</span>
            <span aria-hidden="true">·</span>
            <span>بنوك: {totalInBanks.toLocaleString()} ج.م</span>
          </div>
        </div>

        {/* Card 2: Operating Custody & Transit */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                العهد النقدية وسلف المناديب
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
                {totalCustody.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/40">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>طرف {holders.length} موظف ومندوب</span>
            <span className="text-amber-600 font-bold">قيد التسوية الدورية</span>
          </div>
        </div>

        {/* Card 3: Net Cash Flow */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                صافي التدفق النقدي المسجل
              </span>
              <h3 className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {netCashFlow >= 0 ? '+' : ''}{netCashFlow.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="text-emerald-600 font-bold">وارد: +{totalDeposits.toLocaleString()}</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-600 font-bold">صرف: -{totalWithdrawals.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 4: Working Wallets & Core Liquidity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block">
                المحافظ الرقمية ورأس المال التشغيلي
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tabular-nums tracking-tight">
                {totalInWallets.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-900/40">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>محفظة التوريد: {Number(wallet?.supplyBalance || 0).toLocaleString()} ج.م</span>
            <span className="text-indigo-600 font-bold">جاهزية التوريد</span>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 3. TACTICAL NAVIGATION TABS                              */}
      {/* ======================================================== */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Landmark className="w-4 h-4 text-indigo-500" />
          <span>الخزائن وصناديق السيولة ({allAccounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Calculator className="w-4 h-4 text-emerald-500" />
          <span>أداة جرد فئات النقدية (Cash Count)</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <History className="w-4 h-4 text-blue-500" />
          <span>سجل الحركات وكشف الحساب ({transactions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-500" />
          <span>تحليلات أوزان ومخاطر السيولة</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ACCOUNTS & CASH SAFES DECK                        */}
      {/* ======================================================== */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-500" />
                <span>أوعية وخزائن المتجر المعتمدة</span>
              </h2>
              <p className="text-slate-500 text-xs">
                متابعة أرصدة الخزائن النقدية، أدراج الكاشير، الحسابات البنكية، والمحافظ الإلكترونية بدقة عالية
              </p>
            </div>
            
            <button 
              onClick={() => setShowAddAccountModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة خزينة / حساب جديد</span>
            </button>
          </div>

          <div id="accounts-cards-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allAccounts.map(acc => {
              const isVirtual = ['main_wallet', 'supply_wallet'].includes(acc.id);
              const percentageOfTotal = totalLiquidBalance > 0 ? ((acc.balance / totalLiquidBalance) * 100).toFixed(1) : '0';
              const isOverLimit = acc.maxLimit && acc.balance > acc.maxLimit;
              const isUnderLimit = acc.minLimit && acc.balance < acc.minLimit;

              return (
                <div 
                  key={acc.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl border p-6 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden group ${
                    isOverLimit ? 'border-amber-300 dark:border-amber-800' :
                    isUnderLimit ? 'border-rose-300 dark:border-rose-800' :
                    'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600'
                  }`}
                >
                  <div>
                    {/* Top Type & Status Row */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-2.5 rounded-2xl ${
                          acc.type === 'safe' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                          acc.type === 'bank' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
                          acc.type === 'wallet' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' :
                          'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          {acc.type === 'safe' ? <Coins className="w-5 h-5" /> :
                           acc.type === 'bank' ? <Landmark className="w-5 h-5" /> :
                           acc.type === 'wallet' ? <Wallet className="w-5 h-5" /> :
                           <Users className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            {acc.type === 'safe' ? 'خزينة نقدية / درج' :
                             acc.type === 'bank' ? 'حساب بنكي جاري' :
                             acc.type === 'wallet' ? 'محفظة إلكترونية' : 'عهدة تشغيلية'}
                          </span>
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate max-w-[180px]" title={acc.name}>
                            {acc.name}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {acc.isDefault && (
                          <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                            خزينة رئيسية
                          </span>
                        )}
                        {!isVirtual && (
                          <div className="flex items-center gap-1 opacity-80 hover:opacity-100">
                            <button
                              onClick={() => startEditAccount(acc)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                              title="تعديل بيانات الحساب"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                              title="حذف الحساب"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Balance Display */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-150 dark:border-slate-800 mb-4 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-bold text-slate-400">الرصيد المتاح الحالي:</span>
                        <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">{percentageOfTotal}% من السيولة</span>
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                        {acc.balance.toLocaleString()} <span className="text-xs font-normal text-slate-400">ج.م</span>
                      </div>
                    </div>

                    {/* Metadata & Limits Specs */}
                    <div className="space-y-1.5 text-[11px] text-slate-500 mb-4">
                      {acc.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>الموقع: {acc.location}</span>
                        </div>
                      )}
                      {acc.responsiblePerson && (
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>المسؤول: {acc.responsiblePerson}</span>
                        </div>
                      )}
                      {acc.type === 'bank' && acc.accountNumber && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>حساب: {acc.accountNumber} ({acc.bankName || 'البنك'})</span>
                        </div>
                      )}
                      {acc.type === 'wallet' && acc.walletNumber && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          <span>رقم المحفظة: {acc.walletNumber}</span>
                        </div>
                      )}
                      {acc.lastAuditedAt && (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>آخر جرد: {new Date(acc.lastAuditedAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Account Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTransactionType('deposit');
                        setToAccount(acc.id);
                        setShowTransactionModal(true);
                      }}
                      className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      إيداع
                    </button>
                    <button
                      onClick={() => {
                        setTransactionType('withdrawal');
                        setFromAccount(acc.id);
                        setShowTransactionModal(true);
                      }}
                      className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      صرف
                    </button>
                    <button
                      onClick={() => {
                        setTransactionType('transfer');
                        setFromAccount(acc.id);
                        setShowTransactionModal(true);
                      }}
                      className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      تحويل منه
                    </button>
                    {acc.type === 'safe' && (
                      <button
                        onClick={() => {
                          setAuditSelectedAccountId(acc.id);
                          setActiveTab('audit');
                        }}
                        className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer"
                        title="جرد فئات هذه الخزينة"
                      >
                        <Calculator className="w-4 h-4 text-emerald-600" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SMART CASH DENOMINATION & VAULT AUDIT             */}
      {/* ======================================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-500" />
                  <span>حاسبة فئات النقدية ومحضر جرد الخزينة (Cash Count Audit)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  جرد فعلي للنقدية المتواجدة في الدرج أو الخزينة ومقارنتها تلقائياً بالرصيد الدفتري المسجل لكشف أي عجز أو زيادة وتسويتها.
                </p>
              </div>

              {/* Safe Selector */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  الخزينة المستهدفة للجرد:
                </label>
                <select
                  value={effectiveAuditAccount?.id || ''}
                  onChange={(e) => setAuditSelectedAccountId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-black text-slate-900 dark:text-white"
                >
                  {allAccounts.filter(a => a.type === 'safe' || a.type === 'wallet').map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (الدفتري: {acc.balance.toLocaleString()} ج.م)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {auditSuccessFeedback && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{auditSuccessFeedback}</span>
              </div>
            )}

            {/* Denomination Counter Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Cols: Cash Denominations Table */}
              <div className="lg:col-span-2 space-y-4">
                <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>إدخال عدد الأوراق النقدية بحسب الفئات:</span>
                  <button
                    onClick={() => setDenominationsCount({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 })}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  >
                    تصفير العداد
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3.5">فئة العملة</th>
                        <th className="p-3.5 text-center">عدد الأوراق (العدد)</th>
                        <th className="p-3.5 text-left">القيمة الإجمالية للفئة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      {CASH_DENOMINATIONS.map(d => {
                        const count = denominationsCount[d.value] || 0;
                        const subtotal = d.value * count;

                        return (
                          <tr key={d.value} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                            <td className="p-3.5 font-bold">
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${d.bg} ${d.color}`}>
                                {d.label}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDenominationsCount(prev => ({ ...prev, [d.value]: Math.max(0, (prev[d.value] || 0) - 1) }))}
                                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={count === 0 ? '' : count}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    setDenominationsCount(prev => ({ ...prev, [d.value]: val }));
                                  }}
                                  className="w-20 text-center py-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg font-black text-slate-900 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => setDenominationsCount(prev => ({ ...prev, [d.value]: (prev[d.value] || 0) + 1 }))}
                                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-3.5 text-left font-black text-slate-900 dark:text-white">
                              {subtotal.toLocaleString()} ج.م
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      القائم بالجرد (المحاسب / أمين الخزينة):
                    </label>
                    <input
                      type="text"
                      value={auditAuditorName}
                      onChange={(e) => setAuditAuditorName(e.target.value)}
                      placeholder="اسم المحاسب أو المشرف..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                      ملاحظات الجرد:
                    </label>
                    <input
                      type="text"
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      placeholder="أي فروقات أو ملاحظات حول سلامة الفئات..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Right Col: Reconciliation & Audit Result Capsule */}
              <div className="bg-slate-50 dark:bg-slate-850/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-700">
                    <Scale className="w-4 h-4 text-indigo-500" />
                    <span>مطابقة الجرد الفعلي بالدفاتر</span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block">إجمالي النقد الفعلي (المعدود):</span>
                      <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                        {physicalCashCountTotal.toLocaleString()} ج.م
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block">الرصيد الدفتري المسجل بالخزينة:</span>
                      <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                        {bookBalanceForAudit.toLocaleString()} ج.م
                      </div>
                    </div>

                    {/* Result Badge */}
                    <div className={`p-4 rounded-xl border text-center space-y-1 ${
                      auditDifference === 0 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
                        : auditDifference > 0 
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    }`}>
                      <div className="text-xs font-black flex items-center justify-center gap-1.5">
                        {auditDifference === 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4" />}
                        <span>
                          {auditDifference === 0 ? 'مطابقة تامة 100% (لا يوجد عجز أو زيادة)' :
                           auditDifference > 0 ? `فائض نقدي بالخزينة: +${auditDifference.toLocaleString()} ج.م` :
                           `عجز نقدي بالخزينة: -${Math.abs(auditDifference).toLocaleString()} ج.م`}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-80 font-medium">
                        {auditDifference === 0 
                          ? 'الرصيد الفعلي يطابق الدفاتر تماماً.' 
                          : 'يمكنك اعتماد الجرد وتسوية الفارق بقيد محاسبي مباشر.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  {auditDifference !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSaveSmartAudit(true)}
                      className={`w-full py-3 rounded-xl font-black text-xs text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        auditDifference > 0 ? 'bg-blue-600 hover:bg-blue-500' : 'bg-rose-600 hover:bg-rose-500'
                      }`}
                    >
                      <span>اعتماد وتسوية الفارق في الدفاتر ({auditDifference > 0 ? '+' : ''}{auditDifference.toLocaleString()} ج.م)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSaveSmartAudit(false)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>توثيق محضر الجرد بدون تعديل الرصيد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة محضر الجرد الرسمي</span>
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ADVANCED FINANCIAL LEDGER                         */}
      {/* ======================================================== */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في البيان، المرجع، المسؤول، أو الحساب..."
                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl pr-10 pl-4 py-2 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="all">كل أنواع الحركات</option>
                <option value="deposit">إيداعات نقدية (+)</option>
                <option value="withdrawal">مصروفات وصرف (-)</option>
                <option value="transfer">تحويلات بين الخزائن</option>
                <option value="advance">تسليم عهد تشغيل</option>
              </select>

              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="all">كل الحسابات والخزائن</option>
                {allAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="all">كل الفترات الزمنية</option>
                <option value="today">اليوم فقط</option>
                <option value="week">آخر 7 أيام</option>
                <option value="month">الشهر الحالي</option>
              </select>

              <button
                onClick={handleExportLedgerExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs"
                title="تصدير النتائج المعروضة إلى إكسيل"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>إكسيل</span>
              </button>

              <button
                onClick={handlePrintLedger}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer"
                title="طباعة كشف الحساب"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* Ledger Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">التاريخ والوقت</th>
                    <th className="p-4">نوع الحركة</th>
                    <th className="p-4">البيان والتفاصيل</th>
                    <th className="p-4">من حساب</th>
                    <th className="p-4">إلى حساب</th>
                    <th className="p-4">المبلغ</th>
                    <th className="p-4">المسؤول</th>
                    <th className="p-4 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-semibold font-sans">
                        <History className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                        <p>لا توجد حركات مالية مسجلة تطابق محددات البحث</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => {
                      const fromAcc = allAccounts.find(a => a.id === tx.fromAccountId)?.name || '-';
                      const toAcc = allAccounts.find(a => a.id === tx.toAccountId)?.name || '-';

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors">
                          <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString('ar-EG')}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="p-4 font-sans">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${
                              tx.type === 'deposit' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                              tx.type === 'withdrawal' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' :
                              tx.type === 'advance' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                              'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            }`}>
                              {tx.type === 'deposit' ? 'إيداع' :
                               tx.type === 'withdrawal' ? 'صرف' :
                               tx.type === 'advance' ? 'عهدة' : 'تحويل'}
                            </span>
                          </td>
                          <td className="p-4 font-sans font-bold text-slate-900 dark:text-white max-w-[240px] truncate" title={tx.description}>
                            {tx.description}
                            {tx.reference && (
                              <span className="block text-[10px] font-mono text-slate-400 font-normal">
                                مرجع: {tx.reference}
                              </span>
                            )}
                            {(tx.attachments?.[0] || tx.attachmentUrl) && (
                              <button
                                type="button"
                                onClick={() => setPreviewAttachmentUrl(tx.attachments?.[0] || tx.attachmentUrl || null)}
                                className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline mt-1 cursor-pointer font-extrabold"
                              >
                                <Paperclip size={10} />
                                <span>معاينة المستند المرفق</span>
                              </button>
                            )}
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-300 font-sans">{fromAcc}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-300 font-sans">{toAcc}</td>
                          <td className={`p-4 font-black text-sm tabular-nums whitespace-nowrap ${
                            tx.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' :
                            tx.type === 'withdrawal' ? 'text-rose-600 dark:text-rose-400' :
                            'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {tx.type === 'withdrawal' ? '-' : tx.type === 'deposit' ? '+' : ''}
                            {tx.amount.toLocaleString()} ج.م
                          </td>
                          <td className="p-4 text-slate-500 font-sans text-xs">{tx.operatorName || '-'}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => initiateDeleteTransaction(tx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                              title="حذف وتسوية الحركة المالية"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: LIQUIDITY PROPORTIONS & RISK ANALYTICS            */}
      {/* ======================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>تحليل أوزان السيولة وإدارة المخاطر النقدية</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                توزيع رأس المال السائل عبر قنوات الدفع والخزائن النقدية، وفحص مؤشرات الأمان والحدود القصوى.
              </p>
            </div>

            {/* Visual Multi-Segment Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>توزيع السيولة الإجمالية ({totalLiquidBalance.toLocaleString()} ج.م)</span>
                <span>100% رأس مال سائل</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                <div 
                  style={{ width: `${totalLiquidBalance > 0 ? (totalCashInSafes / totalLiquidBalance) * 100 : 0}%` }} 
                  className="bg-emerald-500 hover:opacity-90 transition-all" 
                  title={`كاش الخزائن: ${totalCashInSafes.toLocaleString()} ج.م`}
                />
                <div 
                  style={{ width: `${totalLiquidBalance > 0 ? (totalInBanks / totalLiquidBalance) * 100 : 0}%` }} 
                  className="bg-blue-500 hover:opacity-90 transition-all" 
                  title={`الحسابات البنكية: ${totalInBanks.toLocaleString()} ج.م`}
                />
                <div 
                  style={{ width: `${totalLiquidBalance > 0 ? (totalInWallets / totalLiquidBalance) * 100 : 0}%` }} 
                  className="bg-purple-500 hover:opacity-90 transition-all" 
                  title={`المحافظ الرقمية: ${totalInWallets.toLocaleString()} ج.م`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold pt-1">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  كاش الخزائن: {totalLiquidBalance > 0 ? ((totalCashInSafes / totalLiquidBalance) * 100).toFixed(1) : 0}%
                </span>
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  أرصدة بنكية: {totalLiquidBalance > 0 ? ((totalInBanks / totalLiquidBalance) * 100).toFixed(1) : 0}%
                </span>
                <span className="flex items-center gap-1.5 text-purple-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  محافظ إلكترونية: {totalLiquidBalance > 0 ? ((totalInWallets / totalLiquidBalance) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>

            {/* Detailed Proportions Breakdown Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">الوعاء المالي</th>
                    <th className="p-3.5">نوع الوعاء</th>
                    <th className="p-3.5">الرصيد الفعلي</th>
                    <th className="p-3.5">الوزن النسبي (%)</th>
                    <th className="p-3.5">الحد الأدنى للأمان</th>
                    <th className="p-3.5">الحد الأقصى للتوريد</th>
                    <th className="p-3.5 text-center">حالة الوعاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {allAccounts.map(acc => {
                    const ratio = totalLiquidBalance > 0 ? ((acc.balance / totalLiquidBalance) * 100).toFixed(1) : '0';
                    const isOver = acc.maxLimit && acc.balance > acc.maxLimit;
                    const isUnder = acc.minLimit && acc.balance < acc.minLimit;

                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                        <td className="p-3.5 font-bold font-sans text-slate-900 dark:text-white">{acc.name}</td>
                        <td className="p-3.5 font-sans">
                          {acc.type === 'safe' ? 'خزينة' : acc.type === 'bank' ? 'بنكي' : acc.type === 'wallet' ? 'محفظة' : 'عهدة'}
                        </td>
                        <td className="p-3.5 font-black text-slate-900 dark:text-white tabular-nums">
                          {acc.balance.toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 font-black text-indigo-600 dark:text-indigo-400">
                          {ratio}%
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {acc.minLimit ? `${acc.minLimit.toLocaleString()} ج.م` : 'غير محدد'}
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {acc.maxLimit ? `${acc.maxLimit.toLocaleString()} ج.م` : 'غير محدد'}
                        </td>
                        <td className="p-3.5 text-center font-sans">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                            isOver ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                            isUnder ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}>
                            {isOver ? 'تكدس سيولة' : isUnder ? 'نقص أمان' : 'مثالي وآمن'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD ACCOUNT / SAFE                              */}
      {/* ======================================================== */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Plus className="w-5 h-5 text-indigo-500" />
              <span>إضافة خزينة أو وعاء سيولة جديد</span>
            </h3>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    اسم الخزينة / الحساب *
                  </label>
                  <input 
                    type="text" 
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="مثال: خزينة الفرع الرئيسي، درج الكاشير..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نوع الوعاء المالي *
                  </label>
                  <select 
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="safe">خزينة نقدية (درج كاش / خزانة)</option>
                    <option value="bank">حساب بنكي جاري</option>
                    <option value="wallet">محفظة إلكترونية (InstaPay / فودافون كاش)</option>
                    <option value="custody">عهدة تشغيلية / مندوب</option>
                  </select>
                </div>
              </div>

              {/* Bank-specific fields */}
              {accountType === 'bank' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم البنك</label>
                    <input 
                      type="text" 
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="مثال: البنك الأهلي المصري، CIB..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم الحساب</label>
                      <input 
                        type="text" 
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="رقم الحساب البنكي"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم المستفيد</label>
                      <input 
                        type="text" 
                        value={beneficiaryName}
                        onChange={(e) => setBeneficiaryName(e.target.value)}
                        placeholder="الاسم الرباعي"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Wallet-specific fields */}
              {accountType === 'wallet' && (
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم المحفظة / عنوان الدفع</label>
                    <input 
                      type="text" 
                      value={walletNumber}
                      onChange={(e) => setWalletNumber(e.target.value)}
                      placeholder="01xxxxxxxxx أو IPA"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">صاحب المحفظة</label>
                    <input 
                      type="text" 
                      value={walletName}
                      onChange={(e) => setWalletName(e.target.value)}
                      placeholder="الاسم المسجل"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Location & Responsible Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الموقع / الفرع</label>
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مثال: الفرع الرئيسي، الكاشير..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المسؤول / أمين الخزينة</label>
                  <input 
                    type="text" 
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    placeholder="اسم المسؤول المعتمد..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Threshold limits & Initial Balance */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الرصيد الافتتاحي</label>
                  <input 
                    type="number" 
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الحد الأدنى للأمان</label>
                  <input 
                    type="number" 
                    value={minLimit}
                    onChange={(e) => setMinLimit(e.target.value)}
                    placeholder="اختياري"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الحد الأقصى للتوريد</label>
                  <input 
                    type="number" 
                    value={maxLimit}
                    onChange={(e) => setMaxLimit(e.target.value)}
                    placeholder="اختياري"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Set as Default Safe checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>تعيين كخزينة رئيسية افتراضية للمتجر</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 font-black text-xs transition-colors cursor-pointer"
                >
                  حفظ الحساب
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: NEW TRANSACTION (DEPOSIT / WITHDRAW / TRANSFER)  */}
      {/* ======================================================== */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-5 pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              {transactionType === 'deposit' ? <TrendingUp className="w-5 h-5 text-emerald-500" /> :
               transactionType === 'withdrawal' ? <TrendingDown className="w-5 h-5 text-rose-500" /> :
               <ArrowRightLeft className="w-5 h-5 text-indigo-500" />}
              <span>
                {transactionType === 'deposit' ? 'تسجيل إيداع نقدي / إيراد' :
                 transactionType === 'withdrawal' ? 'تسجيل صرف / مصروف تشغيلي' :
                 transactionType === 'advance' ? 'تسليم عهدة مالية' : 'تحويل أرصدة نقدية بين الخزائن'}
              </span>
            </h3>

            <form onSubmit={handleTransaction} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">المبلغ (ج.م) *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={transAmount}
                    onChange={(e) => setTransAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white text-xl font-black tabular-nums focus:outline-none focus:border-indigo-500 text-right"
                    required min="0.01" step="0.01" placeholder="0.00"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-extrabold text-xs">ج.م</span>
                </div>
              </div>

              {(transactionType === 'withdrawal' || transactionType === 'transfer' || transactionType === 'advance') && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">من حساب (المنصرف منه) *</label>
                  <select 
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 text-right"
                    required
                  >
                    <option value="">-- اختر الحساب المصدر --</option>
                    {allAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (متاح: {acc.balance.toLocaleString()} ج.م)</option>
                    ))}
                  </select>
                </div>
              )}

              {(transactionType === 'deposit' || transactionType === 'transfer' || transactionType === 'advance') && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">إلى حساب (المُودع فيه / وجهة التحويل) *</label>
                  <select 
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 text-right"
                    required
                  >
                    <option value="">-- اختر الحساب المستهدف --</option>
                    {allAccounts.filter(acc => transactionType !== 'advance' || acc.type === 'custody').map(acc => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === fromAccount}>
                        {acc.name} {acc.type === 'custody' ? '(عهدة)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">البيان / تفاصيل وملاحظات الحركة *</label>
                <input 
                  type="text" 
                  value={transDesc}
                  onChange={(e) => setTransDesc(e.target.value)}
                  placeholder="مثال: توريد كاش للمصرف، صرف مصاريف صيانة، تسليم عهدة تشغيل..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">اسم المنفذ / أمين الصندوق</label>
                <input 
                  type="text" 
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="مثال: أحمد أمين الخزينة"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Transaction Attachment Uploader */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <InvoiceAttachmentUploader
                  label="صورة الإيصال / مستند الحركة (اختياري)"
                  helperText="يمكنك التقاط صورة الإيصال أو المستند بالكاميرا أو رفعه للتأكيد"
                  attachments={transAttachments}
                  onChange={setTransAttachments}
                  activeStoreId="store-treasury"
                  folderCategory="expenses"
                  maxFiles={4}
                  compact
                />
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button 
                  type="submit"
                  className={`flex-1 text-white rounded-xl py-2.5 font-black text-xs transition-colors cursor-pointer ${
                    transactionType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-500' :
                    transactionType === 'withdrawal' ? 'bg-rose-600 hover:bg-rose-500' :
                    'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  تنفيذ وتسجيل الحركة
                </button>
                <button 
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: EDIT ACCOUNT                                    */}
      {/* ======================================================== */}
      {editingAccount && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
              تعديل بيانات الحساب الجاري
            </h3>

            <form onSubmit={handleSaveEditAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">اسم الحساب / الخزينة</label>
                <input 
                  type="text" 
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {editingAccount.type === 'bank' && (
                <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-slate-800 mt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم البنك</label>
                    <input 
                      type="text" 
                      value={editingBankName}
                      onChange={(e) => setEditingBankName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم الحساب</label>
                      <input 
                        type="text" 
                        value={editingAccountNumber}
                        onChange={(e) => setEditingAccountNumber(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم المستفيد</label>
                      <input 
                        type="text" 
                        value={editingBeneficiaryName}
                        onChange={(e) => setEditingBeneficiaryName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {editingAccount.type === 'wallet' && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 mt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم المحفظة</label>
                    <input 
                      type="text" 
                      value={editingWalletNumber}
                      onChange={(e) => setEditingWalletNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الاسم بالكامل</label>
                    <input 
                      type="text" 
                      value={editingWalletName}
                      onChange={(e) => setEditingWalletName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الموقع / الفرع</label>
                  <input 
                    type="text" 
                    value={editingLocation}
                    onChange={(e) => setEditingLocation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المسؤول</label>
                  <input 
                    type="text" 
                    value={editingResponsible}
                    onChange={(e) => setEditingResponsible(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">حد الأمان الأدنى</label>
                  <input 
                    type="number" 
                    value={editingMinLimit}
                    onChange={(e) => setEditingMinLimit(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">حد التوريد الأقصى</label>
                  <input 
                    type="number" 
                    value={editingMaxLimit}
                    onChange={(e) => setEditingMaxLimit(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingIsDefault}
                    onChange={(e) => setEditingIsDefault(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>خزينة رئيسية افتراضية</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 font-black text-xs cursor-pointer"
                >
                  حفظ التعديلات
                </button>
                <button 
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: DELETE TRANSACTION CONFIRMATION                 */}
      {/* ======================================================== */}
      {showDeleteModal && transactionToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-lg font-black">حذف الحركة وتسوية القيود الدفترية</h3>
            </div>
            
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              تنبيه محاسبي: أنت على وشك حذف هذه الحركة المالية. سيقوم النظام بإعادة ضبط وتسوية أرصدة الحسابات المتأثرة بالرصيد تلقائياً لضمان تطابق الدفاتر.
            </p>

            <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4 mb-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{transactionToDelete.description}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(transactionToDelete.date).toLocaleDateString('ar-EG')} | القيمة: {transactionToDelete.amount.toLocaleString()} ج.م
                  </p>
                </div>
                <div className="text-rose-600 dark:text-rose-400 font-black text-base whitespace-nowrap tabular-nums">
                  {transactionToDelete.amount.toLocaleString()} ج.م
                </div>
              </div>
            </div>

            {associatedTransactions.length > 0 && (
              <div className="mb-5 text-right">
                <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 mb-2">
                  الحركات المرتبطة المكتشفة ({associatedTransactions.length} حركات):
                </h4>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {associatedTransactions.map(tx => (
                    <div key={tx.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 flex justify-between items-center text-xs">
                      <span className="font-bold">{tx.description}</span>
                      <span className="font-mono font-black">{tx.amount.toLocaleString()} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button 
                type="button"
                onClick={handleConfirmDeleteTransaction}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl py-2.5 font-black text-xs cursor-pointer"
              >
                تأكيد الحذف والموازنة الدفترية
              </button>
              <button 
                type="button"
                onClick={() => { setShowDeleteModal(false); setTransactionToDelete(null); setAssociatedTransactions([]); }}
                className="px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Attachment Modal */}
      {previewAttachmentUrl && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-4 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <Paperclip size={16} className="text-indigo-500" />
                معاينة إيصال / مستند الحركة
              </h3>
              <button
                onClick={() => setPreviewAttachmentUrl(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-2xl bg-slate-950/5 dark:bg-slate-950 flex items-center justify-center p-2">
              <img
                src={previewAttachmentUrl}
                alt="معاينة المرفق"
                className="max-w-full max-h-[65vh] object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <a
                href={previewAttachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                فتح المستند في نافذة مستقلة ↗
              </a>
              <button
                onClick={() => setPreviewAttachmentUrl(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CUSTOM ALERT DIALOG                                      */}
      {/* ======================================================== */}
      {alertConfig && alertConfig.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-right border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className={`flex items-center gap-2 mb-2 ${alertConfig.isError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-base font-black">{alertConfig.title}</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-xs mb-5 leading-relaxed">{alertConfig.message}</p>
            <button 
              onClick={() => setAlertConfig(null)}
              className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-black text-xs rounded-xl cursor-pointer"
            >
              مفهوم
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TreasuryPage;
