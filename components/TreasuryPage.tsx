import React, { useState } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { Settings, Treasury, TreasuryAccount, TreasuryTransaction, Order } from '../types';
import { calculateOrderProfitLoss } from '../utils/financials';

interface TreasuryPageProps {
  settings: Settings;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
  wallet?: any;
  setWallet?: (updater: any) => void;
  orders?: Order[];
}

export const TreasuryPage: React.FC<TreasuryPageProps> = ({ settings, treasury, setTreasury, wallet, setWallet, orders = [] }) => {
  const accounts = treasury?.accounts || [];
  const custodyHolders = settings?.cashHolders || [];

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'safe': return <Coins className="w-5 h-5" />;
      case 'bank': return <Landmark className="w-5 h-5" />;
      case 'wallet': return <Wallet className="w-5 h-5" />;
      case 'custody': return <Users className="w-5 h-5" />;
      default: return <Wallet className="w-5 h-5" />;
    }
  };
  
  // Dynamically calculate live balance for main wallet to match WalletPage behavior
  const calculateMainWalletBalance = () => {
    return (wallet?.transactions || []).reduce((sum: number, t: any) => {
        const amount = Number(t.amount) || 0;
        
        if (t.category === 'supply_purchase' || t.category === 'supply_deposit' || t.category?.startsWith('supply_expense_')) return sum;
        if ((t.details?.paidByPartnerId || t.details?.expensePaidBy || t.note?.includes('دفعهم') || t.note?.includes('شريك')) && !t.note?.includes('المحفظة المركزية')) return sum;

        if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
        if (t.type === 'سحب') {
            if (t.details?.treasuryAccountId && t.details.treasuryAccountId !== 'main_wallet') return sum;
            return t.status === 'cancelled' ? sum : sum - amount;
        }
        
        if (t.type === 'تحويل') {
            if (t.category === 'treasury_sync') {
                const treasuryTxId = t.id.replace('TR-', '');
                const tTx = treasury?.transactions?.find((x: any) => x.id === treasuryTxId);
                if (tTx) {
                    if (tTx.toAccountId === 'main_wallet') return sum + amount;
                    if (tTx.fromAccountId === 'main_wallet') return sum - amount;
                } else if (t.note?.includes('إنستاباي') || t.note?.includes('بنك') || t.note?.includes('إيداع') || t.note?.includes('تحويل')) {
                    return sum + amount;
                }
            }
            return sum;
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
      walletName: 'المحفظة العامة'
    },
    {
      id: 'supply_wallet',
      name: 'محفظة التوريد (رأس مال المخزون)',
      type: 'wallet',
      balance: Number(wallet?.supplyBalance || 0),
      currency: 'EGP',
      walletName: 'محفظة التوريد'
    }
  ];
  const allAccounts = [...virtualAccounts, ...accounts];
  const transactions = treasury?.transactions || [];
  
  // Modals state
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal' | 'transfer' | 'advance'>('deposit');

  // Form state
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'safe' | 'bank' | 'wallet' | 'custody'>('safe');
  const [initialBalance, setInitialBalance] = useState('');

  // New fields
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [walletNumber, setWalletNumber] = useState('');
  const [walletName, setWalletName] = useState('');

  const [transAmount, setTransAmount] = useState('');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transDesc, setTransDesc] = useState('');

  // Editing state for accounts
  const [editingAccount, setEditingAccount] = useState<TreasuryAccount | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingBankName, setEditingBankName] = useState('');
  const [editingAccountNumber, setEditingAccountNumber] = useState('');
  const [editingBeneficiaryName, setEditingBeneficiaryName] = useState('');
  const [editingWalletNumber, setEditingWalletNumber] = useState('');
  const [editingWalletName, setEditingWalletName] = useState('');

  // Custom alert state
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; isError?: boolean } | null>(null);

  // Delete transactions state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<TreasuryTransaction | null>(null);
  const [associatedTransactions, setAssociatedTransactions] = useState<TreasuryTransaction[]>([]);

  const initiateDeleteTransaction = (tx: TreasuryTransaction) => {
    setTransactionToDelete(tx);
    
    // Extract a reference like #MNT-9128 or #9128 or general #\S+ from description
    const match = tx.description.match(/#(MNT-\d+|\d+)/i) || tx.description.match(/#\S+/);
    const reference = match ? match[0] : null;

    if (reference) {
      // Find all transactions containing that reference (excluding the current one)
      const associated = transactions.filter(t => t.id !== tx.id && t.description.includes(reference));
      setAssociatedTransactions(associated);
    } else {
      setAssociatedTransactions([]);
    }
    
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteTransaction = () => {
    if (!transactionToDelete) return;

    // List of transactions to delete: the main one + all associated ones
    const txsToDelete = [transactionToDelete, ...associatedTransactions];
    const txIdsToDelete = txsToDelete.map(t => t.id);

    if (setTreasury) {
      setTreasury((prev: Treasury) => {
        let updatedAccounts = [...prev.accounts];

        // Process reversals for each transaction being deleted
        txsToDelete.forEach(tx => {
          const amount = tx.amount;

          // Revert impact on fromAccountId (add back the amount that was spent)
          if (tx.fromAccountId) {
            updatedAccounts = updatedAccounts.map(acc => 
              acc.id === tx.fromAccountId ? { ...acc, balance: acc.balance + amount } : acc
            );
          }

          // Revert impact on toAccountId (subtract the amount that was received)
          if (tx.toAccountId && tx.toAccountId !== 'supply_wallet') {
            updatedAccounts = updatedAccounts.map(acc => 
              acc.id === tx.toAccountId ? { ...acc, balance: acc.balance - amount } : acc
            );
          }
        });

        // Revert wallet supply balance if any of the transactions were a transfer to supply_wallet
        const totalSupplyRefund = txsToDelete
          .filter(tx => tx.toAccountId === 'supply_wallet')
          .reduce((sum, tx) => sum + tx.amount, 0);

        if (totalSupplyRefund > 0 && setWallet) {
          setWallet((prevWallet: any) => {
            const match = transactionToDelete.description.match(/#(MNT-\d+|\d+)/i) || transactionToDelete.description.match(/#\S+/);
            const ref = match ? match[0] : '';
            
            // Filter out wallet transactions that might be associated with this deletion
            const filteredWalletTx = (prevWallet.transactions || []).filter((wTx: any) => {
              if (ref && wTx.note && wTx.note.includes(ref)) return false;
              return true;
            });

            return {
              ...prevWallet,
              supplyBalance: Math.max(0, (prevWallet.supplyBalance || 0) - totalSupplyRefund),
              transactions: filteredWalletTx
            };
          });
        }

        // Filter out the deleted transactions
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

  const startEditAccount = (acc: TreasuryAccount) => {
    setEditingAccount(acc);
    setEditingName(acc.name);
    setEditingBankName(acc.bankName || '');
    setEditingAccountNumber(acc.accountNumber || '');
    setEditingBeneficiaryName(acc.beneficiaryName || '');
    setEditingWalletNumber(acc.walletNumber || '');
    setEditingWalletName(acc.walletName || '');
  };

  const handleSaveEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editingName.trim()) return;

    if (setTreasury) {
      setTreasury((prev: Treasury) => ({
        ...prev,
        accounts: prev.accounts.map(acc => 
          acc.id === editingAccount.id 
            ? {
                ...acc,
                name: editingName,
                bankName: acc.type === 'bank' ? editingBankName : undefined,
                accountNumber: acc.type === 'bank' ? editingAccountNumber : undefined,
                beneficiaryName: acc.type === 'bank' ? editingBeneficiaryName : undefined,
                walletNumber: acc.type === 'wallet' ? editingWalletNumber : undefined,
                walletName: acc.type === 'wallet' ? editingWalletName : undefined,
              }
            : acc
        )
      }));
    }

    setEditingAccount(null);
  };

  const handleDeleteAccount = (acc: TreasuryAccount) => {
    if (acc.balance !== 0) {
      setAlertConfig({
        isOpen: true,
        title: 'لا يمكن حذف الحساب',
        message: `عفواً، لا يمكن حذف الحساب "${acc.name}" لأن رصيده الحالي (${acc.balance.toLocaleString()} ج.م) ليس صفراً. يرجى تصفية أو تحويل الرصيد المتبقي أولاً لضمان سلامة الدفاتر المالية.`,
        isError: true
      });
      return;
    }

    // Protection to leave at least one account
    if (accounts.length <= 1) {
      setAlertConfig({
        isOpen: true,
        title: 'إجراء غير مسموح',
        message: 'يجب أن يحتوي النظام على حساب مالي أو خزينة واحدة تابعة على الأقل.',
        isError: true
      });
      return;
    }

    if (window.confirm(`هل أنت متأكد من رغبتك في حذف الحساب "${acc.name}" نهائياً من سجلات الخزينة؟`)) {
      if (setTreasury) {
        setTreasury((prev: Treasury) => ({
          ...prev,
          accounts: prev.accounts.filter(a => a.id !== acc.id)
        }));
      }
    }
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;

    const newAccount: TreasuryAccount = {
      id: Date.now().toString(),
      name: accountName,
      type: accountType,
      balance: Number(initialBalance) || 0,
      currency: 'EGP',
      bankName: accountType === 'bank' ? bankName : undefined,
      accountNumber: accountType === 'bank' ? accountNumber : undefined,
      beneficiaryName: accountType === 'bank' ? beneficiaryName : undefined,
      walletNumber: accountType === 'wallet' ? walletNumber : undefined,
      walletName: accountType === 'wallet' ? walletName : undefined,
    };

    if (setTreasury) {
      setTreasury((prev: Treasury) => ({
        ...prev,
        accounts: [...prev.accounts, newAccount]
      }));
    }

    setShowAddAccountModal(false);
    setAccountName('');
    setInitialBalance('');
    setBankName('');
    setAccountNumber('');
    setBeneficiaryName('');
    setWalletNumber('');
    setWalletName('');
  };

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
          message: `عفواً، لا يمكن إتمام العملية لأن رصيد حساب المتبع "${srcAcc.name}" (${srcAcc.balance.toLocaleString()} ج.م) لا يكفي لسحب مبلغ قدره ${amount.toLocaleString()} ج.م.`,
          isError: true
        });
        return;
      }
    }

    const newTx: TreasuryTransaction = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: transactionType,
      amount,
      description: transDesc,
      fromAccountId,
      toAccountId,
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

    // Handle wallet updates if virtual accounts are used
    if (setWallet && (fromAccountId === 'main_wallet' || fromAccountId === 'supply_wallet' || toAccountId === 'main_wallet' || toAccountId === 'supply_wallet')) {
      setWallet((prev: any) => {
        let newBalance = Number(prev.balance) || 0;
        let newSupplyBalance = Number(prev.supplyBalance) || 0;
        const walletTxs = [...(prev.transactions || [])];

        // Handle From
        if (fromAccountId === 'main_wallet') newBalance -= amount;
        if (fromAccountId === 'supply_wallet') newSupplyBalance -= amount;

        // Handle To
        if (toAccountId === 'main_wallet') newBalance += amount;
        if (toAccountId === 'supply_wallet') newSupplyBalance += amount;

        // Add wallet transaction record
        walletTxs.unshift({
            id: `TR-${newTx.id}`,
            type: (toAccountId === 'main_wallet' || toAccountId === 'supply_wallet') ? 'إيداع' : 'سحب',
            amount,
            date: newTx.date,
            note: transDesc || `عملية خزينة: ${transactionType}`,
            category: 'treasury_sync',
            status: 'completed'
        });

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
  };

  const getTotalBalance = () => accounts.filter(a => a.type !== 'custody').reduce((sum, acc) => sum + acc.balance, 0);
  const getTotalCustody = () => {
    const custodyFromAccounts = accounts.filter(a => a.type === 'custody').reduce((sum, acc) => sum + acc.balance, 0);
    const custodyFromHolders = (custodyHolders || []).reduce((sum, h) => sum + (h.currentBalance || 0), 0);
    return custodyFromAccounts + custodyFromHolders;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto font-sans text-right" dir="rtl">
      
      {/* Modern High-End Header */}
      <div id="treasury-header" className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                منظومة الخزينة والسيولة النقدية المتكاملة
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shadow-sm">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  الخزانة والعهد النقدية
                </h1>
                <p className="text-slate-450 dark:text-slate-500 text-[11px] sm:text-xs font-medium leading-relaxed mt-0.5">
                  تتبع الأرصدة النقدية والبنكية والمحافظ الإلكترونية، وإدارة سلف وعهدة الموظفين والمناديب بدقة محاسبية متناهية.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button 
              id="btn-quick-deposit"
              onClick={() => { setTransactionType('deposit'); setShowTransactionModal(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>إيداع جديد</span>
            </button>
            <button 
              id="btn-quick-withdraw"
              onClick={() => { setTransactionType('withdrawal'); setShowTransactionModal(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>تسجيل مصروف</span>
            </button>
            <button 
              id="btn-quick-transfer"
              onClick={() => { setTransactionType('transfer'); setShowTransactionModal(true); }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 active:scale-95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>تحويل أرصدة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Corporate Overview Cards Deck */}
      <div id="treasury-stats-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Total Liquid Capital */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                إجمالي السيولة النقدية المتوفرة
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tabular-nums tracking-tight">
                {getTotalBalance().toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100/30 dark:border-indigo-900/30">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium leading-normal">
              الرصيد الفعلي المتوفر في جميع الخزائن النقدية، الحسابات البنكية، والمحافظ النشطة.
            </p>
          </div>
        </div>

        {/* Card 2: Employee Custody */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                إجمالي العهد وسلف التشغيل
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tabular-nums tracking-tight">
                {getTotalCustody().toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ج.م</span>
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100/30 dark:border-amber-900/30">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium leading-normal">
              المبالغ المسندة للمناديب والكاشيرية كعهد نقدية قيد العمل والتسوية.
            </p>
          </div>
        </div>

        {/* Card 3: Active Accounts Stats */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                الحسابات المعتمدة بالنظام
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tabular-nums tracking-tight">
                {allAccounts.length}{' '}
                <span className="text-xs font-bold text-slate-450 dark:text-slate-500">حسابات نشطة</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100/30 dark:border-emerald-900/30">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
        </div>

      </div>

      {/* Accounts Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-500" />
              أوعية السيولة والخزائن المعتمدة
            </h2>
            <p className="text-slate-450 dark:text-slate-500 text-[10px] sm:text-xs font-medium mt-0.5">تتبع وتدقيق أرصدة الخزائن الرئيسية والمحافظ الإلكترونية والحسابات البنكية</p>
          </div>
          <button 
            id="btn-add-account"
            onClick={() => setShowAddAccountModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة وعاء مالي جديد</span>
          </button>
        </div>

        {/* Premium Grid for Accounts */}
        <div id="accounts-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {allAccounts.map(acc => (
            <div 
              key={acc.id} 
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[14rem] relative overflow-hidden group shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-xl border ${
                    acc.type === 'safe' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30' :
                    acc.type === 'bank' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30' :
                    acc.type === 'wallet' ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/30' :
                    'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30'
                  }`}>
                    {getAccountIcon(acc.type)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {['main_wallet', 'supply_wallet'].includes(acc.id) && (
                      <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-extrabold border border-indigo-100 dark:border-indigo-900/30">
                        رئيسي
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                      {acc.type === 'safe' ? 'خزينة' : acc.type === 'bank' ? 'حساب بنكي' : acc.type === 'wallet' ? 'محفظة' : 'عهدة'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2 mb-3">
                  <h4 className="text-slate-900 dark:text-white font-extrabold text-sm truncate" title={acc.name}>
                    {acc.name}
                  </h4>
                  {!['main_wallet', 'supply_wallet'].includes(acc.id) && (
                    <div className="flex gap-1 shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); startEditAccount(acc); }} 
                        className="p-1 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer" 
                        title="تعديل الحساب"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc); }} 
                        className="p-1 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer" 
                        title="حذف الحساب"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                {acc.type === 'bank' && (
                  <div className="mb-2 space-y-1.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{acc.bankName || 'البنك'}</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold select-all tracking-tight truncate leading-none">{acc.accountNumber}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">{acc.beneficiaryName}</p>
                  </div>
                )}

                {acc.type === 'wallet' && (
                  <div className="mb-2 space-y-1.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold select-all tracking-wide truncate leading-none">{acc.walletNumber}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">{acc.walletName || 'صاحب المحفظة'}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-1">الرصيد المتوفر</span>
                <p className="text-xl font-extrabold text-slate-950 dark:text-white tabular-nums tracking-tight">
                  {acc.balance.toLocaleString()}{' '}
                  <span className="text-xs text-slate-400 font-bold">ج.م</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History Logs */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/85 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              سجل الحركات النقدية والعمليات
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-0.5">سجل زمني متكامل ومدقق لكافة الحسابات الفرعية بالخزائن والمحافظ</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-400 text-xs font-bold border-b border-slate-100 dark:border-slate-800/80">
              <tr>
                <th className="p-4 font-black">التاريخ والوقت</th>
                <th className="p-4 font-black">نوع الحركة</th>
                <th className="p-4 font-black">البيان والتفاصيل</th>
                <th className="p-4 font-black">من حساب</th>
                <th className="p-4 font-black">إلى حساب</th>
                <th className="p-4 font-black">المبلغ (ج.م)</th>
                <th className="p-4 font-black text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {(() => {
                const filteredTxs = transactions.filter(tx => {
                  const involvesRealAccount = (tx.fromAccountId && !['main_wallet', 'supply_wallet'].includes(tx.fromAccountId)) || 
                                              (tx.toAccountId && !['main_wallet', 'supply_wallet'].includes(tx.toAccountId));
                  return involvesRealAccount;
                });

                if (filteredTxs.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <History className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                          <p>لا توجد حركات نقدية مسجلة في الوقت الحالي</p>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return filteredTxs.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors">
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono font-semibold whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('ar-EG')}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(tx.date).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        tx.type === 'deposit' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40' :
                        tx.type === 'withdrawal' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40' :
                        tx.type === 'advance' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40' :
                        'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40'
                      }`}>
                        {tx.type === 'deposit' ? 'إيداع' : tx.type === 'withdrawal' ? 'صرف' : tx.type === 'advance' ? 'تسليم عهدة' : 'تحويل'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-900 dark:text-slate-100 max-w-[250px] truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 font-semibold">
                      {tx.fromAccountId ? allAccounts.find(a => a.id === tx.fromAccountId)?.name : '-'}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 font-semibold">
                      {tx.toAccountId ? allAccounts.find(a => a.id === tx.toAccountId)?.name : '-'}
                    </td>
                    <td className={`p-4 font-black tabular-nums text-sm ${
                      tx.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' :
                      tx.type === 'withdrawal' ? 'text-rose-600 dark:text-rose-400' :
                      'text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {tx.type === 'withdrawal' ? '-' : tx.type === 'deposit' ? '+' : ''}
                      {tx.amount.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => initiateDeleteTransaction(tx)}
                        className="p-2 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                        title="حذف الحركة وتسوية الرصيد"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Plus className="w-5 h-5 text-indigo-500" />
              إضافة حساب أو خزينة جديدة
            </h3>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">اسم الحساب / الخزينة / العهدة</label>
                <input 
                  type="text" 
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="مثال: خزينة الفرع الرئيسي، حساب البنك الأهلي..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">نوع الحساب</label>
                <select 
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 text-right"
                >
                  <option value="safe">خزينة نقدية (درج / خزنة)</option>
                  <option value="bank">حساب بنكي</option>
                  <option value="wallet">محفظة إلكترونية</option>
                  <option value="custody">عهدة موظف / مندوب</option>
                </select>
              </div>

              {accountType === 'bank' && (
                <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم البنك</label>
                    <input 
                      type="text" 
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="مثال: البنك الأهلي المصري"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
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
                        placeholder="رقم الحساب الجاري"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
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
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {accountType === 'wallet' && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم المحفظة</label>
                    <input 
                      type="text" 
                      value={walletNumber}
                      onChange={(e) => setWalletNumber(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
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
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">الرصيد الافتتاحي (ج.م)</label>
                <input 
                  type="number" 
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 font-black text-xs transition-colors cursor-pointer"
                >
                  حفظ الحساب
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              {transactionType === 'deposit' ? 'تسجيل إيداع / إيراد' : transactionType === 'withdrawal' ? 'تسجيل صرف / مصروف' : transactionType === 'advance' ? 'تسليم عهدة وتشغيل' : 'تحويل أرصدة نقدية'}
            </h3>
            <form onSubmit={handleTransaction} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">المبلغ (ج.م)</label>
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
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">من حساب (المنصرف منه)</label>
                  <select 
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 text-right"
                    required
                  >
                    <option value="">-- اختر الحساب المصدر --</option>
                    {allAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (رصيد: {acc.balance.toLocaleString()} ج.م)</option>
                    ))}
                  </select>
                </div>
              )}

              {(transactionType === 'deposit' || transactionType === 'transfer' || transactionType === 'advance') && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">إلى حساب (المُودع فيه / وجهة التحويل)</label>
                  <select 
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 text-right"
                    required
                  >
                    <option value="">-- اختر الحساب المستهدف --</option>
                    {allAccounts.filter(acc => transactionType !== 'advance' || acc.type === 'custody').map(acc => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === fromAccount}>{acc.name} {acc.type === 'custody' ? '(عهدة موظف)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">البيان / الملاحظات والتفاصيل</label>
                <input 
                  type="text" 
                  value={transDesc}
                  onChange={(e) => setTransDesc(e.target.value)}
                  placeholder="مثال: تحويل عهدة، سحب مصاريف تشغيل..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                <button 
                  type="submit"
                  className={`flex-1 text-white rounded-xl py-2.5 font-black text-xs transition-colors cursor-pointer ${
                    transactionType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-500' :
                    transactionType === 'withdrawal' ? 'bg-rose-600 hover:bg-rose-500' :
                    'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  تنفيذ الحركة
                </button>
                <button 
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editing Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">تعديل بيانات الحساب الجاري</h3>
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
                <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم البنك</label>
                    <input 
                      type="text" 
                      value={editingBankName}
                      onChange={(e) => setEditingBankName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم الحساب</label>
                    <input 
                      type="text" 
                      value={editingAccountNumber}
                      onChange={(e) => setEditingAccountNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم المستفيد</label>
                    <input 
                      type="text" 
                      value={editingBeneficiaryName}
                      onChange={(e) => setEditingBeneficiaryName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              {editingAccount.type === 'wallet' && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم المحفظة</label>
                    <input 
                      type="text" 
                      value={editingWalletNumber}
                      onChange={(e) => setEditingWalletNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الاسم بالكامل</label>
                    <input 
                      type="text" 
                      value={editingWalletName}
                      onChange={(e) => setEditingWalletName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 font-black text-xs transition-colors cursor-pointer"
                >
                  حفظ التعديلات
                </button>
                <button 
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && transactionToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-lg font-black">حذف الحركة وتسوية الدفاتر</h3>
            </div>
            
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              تنبيه: أنت على وشك حذف هذه الحركة المالية بشكل كامل. سيقوم النظام بإعادة ضبط وتسوية أرصدة الحسابات المتأثرة بالرصيد تلقائياً لضمان تطابق القيود.
            </p>

            <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4 mb-4">
              <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 bg-rose-100/50 dark:bg-rose-900/50 px-2.5 py-0.5 rounded-md mb-2 inline-block">
                الحركة المستهدفة للحذف
              </span>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{transactionToDelete.description}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(transactionToDelete.date).toLocaleDateString('ar-EG')} | الحساب: {
                      transactionToDelete.fromAccountId ? allAccounts.find(a => a.id === transactionToDelete.fromAccountId)?.name :
                      transactionToDelete.toAccountId ? allAccounts.find(a => a.id === transactionToDelete.toAccountId)?.name : '-'
                    }
                  </p>
                </div>
                <div className="text-rose-600 dark:text-rose-400 font-black text-base whitespace-nowrap tabular-nums">
                  {transactionToDelete.amount.toLocaleString()} ج.م
                </div>
              </div>
            </div>

            {associatedTransactions.length > 0 && (
              <div className="mb-5 text-right">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    الحركات المرتبطة المكتشفة ({associatedTransactions.length} حركات)
                  </h4>
                </div>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {associatedTransactions.map(tx => (
                    <div key={tx.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl p-2.5 flex justify-between items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{tx.description}</p>
                      </div>
                      <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 tabular-nums">
                        {tx.amount.toLocaleString()} ج.م
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button"
                onClick={handleConfirmDeleteTransaction}
                className="flex-1 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-xl py-2.5 font-black text-xs transition-all shadow-md shadow-rose-600/10 cursor-pointer"
              >
                تأكيد الحذف والموازنة
              </button>
              <button 
                type="button"
                onClick={() => { setShowDeleteModal(false); setTransactionToDelete(null); setAssociatedTransactions([]); }}
                className="px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Dialog */}
      {alertConfig && alertConfig.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-right border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className={`flex items-center gap-2 mb-2 ${alertConfig.isError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              <AlertCircle className="w-5 h-5 animate-bounce" />
              <h3 className="text-base font-black">{alertConfig.title}</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-xs mb-5 leading-relaxed">{alertConfig.message}</p>
            <button 
              onClick={() => setAlertConfig(null)}
              className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-black text-xs rounded-xl transition-colors cursor-pointer"
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
