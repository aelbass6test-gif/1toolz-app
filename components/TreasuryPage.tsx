import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { Settings, Treasury, TreasuryAccount, TreasuryTransaction } from '../types';

interface TreasuryPageProps {
  settings: Settings;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
  wallet?: any;
  setWallet?: (updater: any) => void;
}

export const TreasuryPage: React.FC<TreasuryPageProps> = ({ settings, treasury, setTreasury, wallet, setWallet }) => {
  const accounts = treasury?.accounts || [];
  const virtualAccounts: TreasuryAccount[] = [
    {
      id: 'main_wallet',
      name: 'المحفظة العامة (الرصيد الأساسي)',
      type: 'wallet',
      balance: Number(wallet?.balance || 0),
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
            type: transactionType === 'transfer' ? 'تحويل' : (toAccountId ? 'إيداع' : 'سحب'),
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
    const custodyFromHolders = (settings?.cashHolders || []).reduce((sum, h) => sum + (h.currentBalance || 0), 0);
    const custodyAccounts = accounts.filter(a => a.type === 'custody').reduce((sum, acc) => sum + acc.balance, 0);
    return custodyFromHolders + custodyAccounts;
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Landmark className="w-5 h-5" />;
      case 'wallet': return <Wallet className="w-5 h-5" />;
      case 'custody': return <Users className="w-5 h-5" />;
      default: return <Landmark className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">نظام الخزينة المركزي</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">الخزانة والعهد النقدية</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">إضافة، تمويل، وموازنة حساباتك النقدية والبنكية وعهد الموظفين بدقة تامة</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => { setTransactionType('deposit'); setShowTransactionModal(true); }}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 hover:-translate-y-0.5 active:translate-y-0 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/10 transition-all duration-200 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4" />
            <span>إيداع جديد</span>
          </button>
          <button 
            onClick={() => { setTransactionType('withdrawal'); setShowTransactionModal(true); }}
            className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-500 hover:-translate-y-0.5 active:translate-y-0 text-white rounded-2xl font-black text-sm shadow-lg shadow-rose-500/10 transition-all duration-200 cursor-pointer"
          >
            <TrendingDown className="w-4 h-4" />
            <span>تسجيل مصروف</span>
          </button>
          <button 
            onClick={() => { setTransactionType('transfer'); setShowTransactionModal(true); }}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black text-sm transition-all duration-200 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>تحويل أرصدة</span>
          </button>
        </div>
      </div>

      {/* Overview Cards with polished gradient mesh */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 dark:from-black dark:to-slate-950 rounded-[2.5rem] p-8 text-white shadow-2xl border border-white/10 group flex flex-col justify-between min-h-[11rem]">
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">إجمالي السيولة النقدية</span>
              <p className="text-4xl font-black tracking-tight mt-1">
                {getTotalBalance().toLocaleString()} <span className="text-lg font-bold opacity-60">ج.م</span>
              </p>
            </div>
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 text-indigo-300">
              <Landmark className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-slate-400 font-medium relative z-10 leading-relaxed mt-4">
            إجمالي الأموال المتوفرة حالياً في جميع الخزائن النقدية والحسابات البنكية والمحافظ النشطة.
          </p>
        </div>

        <div className="relative overflow-hidden bg-slate-900 dark:bg-slate-900/40 rounded-[2.5rem] p-8 text-white shadow-md border border-slate-200 dark:border-slate-800 text-right group flex flex-col justify-between min-h-[11rem]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">إجمالي العهد لدى الموظفين</span>
              <p className="text-4xl font-black tracking-tight mt-1 text-white">
                {getTotalCustody().toLocaleString()} <span className="text-lg font-bold text-slate-400">ج.م</span>
              </p>
            </div>
            <div className="p-4 bg-amber-500/15 rounded-2xl text-amber-500">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-4">
            السلف المؤقتة والعهد التشغيلية المسلمة لرجالك الميدانيين أو فريق المبيعات والمنتشرة للعمل.
          </p>
        </div>
      </div>

      {/* Accounts List */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-500" />
              الخزائن والحسابات النشطة
            </h3>
            <p className="text-xs text-slate-400 mt-1">تتبع الرصيد الحالي والموزع لكل خيار دفع ومؤسسة تشغيلية</p>
          </div>
          <button 
            onClick={() => setShowAddAccountModal(true)}
            className="flex items-center gap-2 px-5 py-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black shadow-lg shadow-indigo-600/15 hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حساب/خزينة</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {allAccounts.map(acc => (
            <div key={acc.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/85 p-6 hover:shadow-xl hover:border-indigo-500/20 dark:hover:border-indigo-500/20 transition-all duration-300 flex flex-col justify-between min-h-[14rem] group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-bl-full pointer-events-none"></div>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`p-3 rounded-2xl ${
                    acc.type === 'safe' ? 'bg-emerald-55 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                    acc.type === 'bank' ? 'bg-blue-55 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
                    acc.type === 'wallet' ? 'bg-purple-55 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' :
                    'bg-amber-55 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                  }`} style={{backgroundColor: acc.type === 'safe' ? 'rgba(16, 185, 129, 0.08)' : acc.type === 'bank' ? 'rgba(59, 130, 246, 0.08)' : acc.type === 'wallet' ? 'rgba(139, 92, 246, 0.08)' : 'rgba(245, 158, 11, 0.08)'}}>
                    {getAccountIcon(acc.type)}
                  </div>
                  <div className="flex items-center gap-2">
                    {['main_wallet', 'supply_wallet'].includes(acc.id) && (
                      <span className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg font-black italic">أساسي</span>
                    )}
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {acc.type === 'safe' ? 'خزينة' : acc.type === 'bank' ? 'حساب بنكي' : acc.type === 'wallet' ? 'محفظة' : 'عهدة موقتة'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-slate-800 dark:text-slate-100 font-extrabold text-base truncate" title={acc.name}>{acc.name}</h4>
                  {!['main_wallet', 'supply_wallet'].includes(acc.id) && (
                    <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); startEditAccount(acc); }} 
                        className="p-1.5 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/80 dark:hover:bg-indigo-950/50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer" 
                        title="تعديل الحساب"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc); }} 
                        className="p-1.5 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800/80 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer" 
                        title="حذف الحساب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                
                {acc.type === 'bank' && (
                  <div className="mb-4 space-y-1 bg-slate-50 dark:bg-slate-850/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-bold">{acc.bankName || 'البنك المعني'}</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-black select-all tracking-tight">{acc.accountNumber}</p>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{acc.beneficiaryName}</p>
                  </div>
                )}

                {acc.type === 'wallet' && (
                  <div className="mb-4 space-y-1 bg-slate-50 dark:bg-slate-850/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-black select-all">{acc.walletNumber}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{acc.walletName} - صاحب المحفظة</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/70">
                <span className="text-[10px] text-slate-405 dark:text-slate-500 font-bold block mb-0.5">الرصيد المتوفر</span>
                <p className="text-2xl font-black text-slate-800 dark:text-white tabular-nums tracking-tight">
                  {acc.balance.toLocaleString()} <span className="text-xs text-slate-400 font-bold">ج.م</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/40 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            سجل حركة النقدية
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm">
              <tr>
                <th className="p-4 font-bold">التاريخ</th>
                <th className="p-4 font-bold">نوع الحركة</th>
                <th className="p-4 font-bold">البيان</th>
                <th className="p-4 font-bold">من حساب</th>
                <th className="p-4 font-bold">إلى حساب</th>
                <th className="p-4 font-bold">المبلغ (ج.م)</th>
                <th className="p-4 font-bold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center justify-center text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-bold">لا توجد حركات مسجلة</p>
                  </td>
                </tr>
              ) : transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-300 font-medium">
                    {new Date(tx.date).toLocaleDateString('ar-EG')} - {new Date(tx.date).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${
                      tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      tx.type === 'withdrawal' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                      tx.type === 'advance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {tx.type === 'deposit' ? 'إيداع' : tx.type === 'withdrawal' ? 'صرف' : tx.type === 'advance' ? 'تسليم عهدة' : 'تحويل'}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-bold text-slate-800 dark:text-slate-200">
                    {tx.description}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {tx.fromAccountId ? allAccounts.find(a => a.id === tx.fromAccountId)?.name : '-'}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {tx.toAccountId ? allAccounts.find(a => a.id === tx.toAccountId)?.name : '-'}
                  </td>
                  <td className={`p-4 text-sm font-black tabular-nums ${
                    tx.type === 'deposit' ? 'text-emerald-600' :
                    tx.type === 'withdrawal' ? 'text-rose-600' :
                    'text-indigo-600'
                  }`}>
                    {tx.type === 'withdrawal' ? '-' : tx.type === 'deposit' ? '+' : ''}{tx.amount.toLocaleString()}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => initiateDeleteTransaction(tx)}
                      className="p-2 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800/80 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-xl transition-all duration-200 cursor-pointer"
                      title="حذف الحركة وتسوية الرصيد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6">إضافة حساب أو خزينة جديدة</h3>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم الحساب / الخزينة / العهدة</label>
                <input 
                  type="text" 
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">النوع</label>
                <select 
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="safe">خزينة نقدية (درج/خزنة)</option>
                  <option value="bank">حساب بنكي</option>
                  <option value="wallet">محفظة إلكترونية</option>
                  <option value="custody">عهدة موظف/مندوب</option>
                </select>
              </div>

              {accountType === 'bank' && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم البنك</label>
                    <input 
                      type="text" 
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="مثال: البنك الأهلي المصري"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">رقم الحساب</label>
                    <input 
                      type="text" 
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم المستفيد</label>
                    <input 
                      type="text" 
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              {accountType === 'wallet' && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">رقم المحفظة</label>
                    <input 
                      type="text" 
                      value={walletNumber}
                      onChange={(e) => setWalletNumber(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم صاحب المحفظة</label>
                    <input 
                      type="text" 
                      value={walletName}
                      onChange={(e) => setWalletName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">الرصيد الافتتاحي (ج.م)</label>
                <input 
                  type="number" 
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold transition-colors"
                >
                  حفظ الحساب
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransactionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6">
              {transactionType === 'deposit' ? 'تسجيل إيداع / إيراد' : transactionType === 'withdrawal' ? 'تسجيل صرف / مصروف' : transactionType === 'advance' ? 'تسليم عهدة' : 'تحويل أرصدة'}
            </h3>
            <form onSubmit={handleTransaction} className="space-y-4">
              
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">المبلغ (ج.م)</label>
                <input 
                  type="number" 
                  value={transAmount}
                  onChange={(e) => setTransAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white text-xl font-black tabular-nums focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  required min="0.01" step="0.01"
                />
              </div>

              {(transactionType === 'withdrawal' || transactionType === 'transfer' || transactionType === 'advance') && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">من حساب (المنصرف منه)</label>
                  <select 
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">-- اختر الحساب --</option>
                    {allAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (رصيد: {acc.balance.toLocaleString()} ج.م)</option>
                    ))}
                  </select>
                </div>
              )}

              {(transactionType === 'deposit' || transactionType === 'transfer' || transactionType === 'advance') && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">إلى حساب (المُودع فيه / وجهة التحويل)</label>
                  <select 
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">-- اختر الحساب --</option>
                    
                    {allAccounts.filter(acc => transactionType !== 'advance' || acc.type === 'custody').map(acc => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === fromAccount}>{acc.name} {acc.type === 'custody' ? '(عهدة)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">البيان / ملاحظات</label>
                <input 
                  type="text" 
                  value={transDesc}
                  onChange={(e) => setTransDesc(e.target.value)}
                  placeholder="مثال: سحب نقدي من البنك وإيداع بالخزينة، أو تسليم عهدة للمندوب..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="submit"
                  className={`flex-1 text-white rounded-xl py-3 font-black transition-colors ${
                    transactionType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    transactionType === 'withdrawal' ? 'bg-rose-600 hover:bg-rose-700' :
                    'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  تنفيذ الحركة
                </button>
                <button 
                  type="button"
                  onClick={() => setShowTransactionModal(false)}
                  className="px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200" dir="rtl">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6">تعديل بيانات الحساب الجاري</h3>
            <form onSubmit={handleSaveEditAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم الحساب / الخزينة</label>
                <input 
                  type="text" 
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {editingAccount.type === 'bank' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم البنك</label>
                    <input 
                      type="text" 
                      value={editingBankName}
                      onChange={(e) => setEditingBankName(e.target.value)}
                      placeholder="مثال: البنك الأهلي المصري"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">رقم الحساب / IBAN</label>
                    <input 
                      type="text" 
                      value={editingAccountNumber}
                      onChange={(e) => setEditingAccountNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">اسم المستفيد</label>
                    <input 
                      type="text" 
                      value={editingBeneficiaryName}
                      onChange={(e) => setEditingBeneficiaryName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              {editingAccount.type === 'wallet' && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">رقم المحفظة</label>
                    <input 
                      type="text" 
                      value={editingWalletNumber}
                      onChange={(e) => setEditingWalletNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">الاسم بالكامل</label>
                    <input 
                      type="text" 
                      value={editingWalletName}
                      onChange={(e) => setEditingWalletName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold transition-colors"
                >
                  حفظ التعديلات
                </button>
                <button 
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && transactionToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right" dir="rtl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4 pb-3 border-b border-slate-150 dark:border-slate-800">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-xl font-black">حذف الحركة وتسوية الحسابات</h3>
            </div>
            
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              أنت على وشك حذف هذه الحركة المالية وإعادة تسوية حساباتها المتأثرة بالرصيد. يرجى تأكيد العملية:
            </p>

            {/* Main Transaction Card */}
            <div className="bg-rose-50/50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-4 mb-4">
              <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-900/40 px-2.5 py-1 rounded-full mb-2 inline-block">
                الحركة المحددة للحذف
              </span>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">{transactionToDelete.description}</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {new Date(transactionToDelete.date).toLocaleDateString('ar-EG')} | الحساب: {
                      transactionToDelete.fromAccountId ? allAccounts.find(a => a.id === transactionToDelete.fromAccountId)?.name :
                      transactionToDelete.toAccountId ? allAccounts.find(a => a.id === transactionToDelete.toAccountId)?.name : '-'
                    }
                  </p>
                </div>
                <div className="text-rose-600 dark:text-rose-400 font-black text-lg whitespace-nowrap">
                  {transactionToDelete.amount.toLocaleString()} ج.م
                </div>
              </div>
            </div>

            {/* Associated Transactions list */}
            {associatedTransactions.length > 0 && (
              <div className="mb-6 text-right">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    الحركات المرتبطة المكتشفة ({associatedTransactions.length} حركات)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
                  تم اكتشاف حركات مالية أخرى تشترك في نفس رمز مرجع الطلب وسيتم حذفها وتسوية أرصدتها تلقائياً مع الحركة الأساسية لضمان سلامة الدفاتر:
                </p>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {associatedTransactions.map(tx => (
                    <div key={tx.id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center gap-4 hover:border-indigo-500/10 transition-all duration-200">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{tx.description}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          الحساب: {
                            tx.fromAccountId ? allAccounts.find(a => a.id === tx.fromAccountId)?.name :
                            tx.toAccountId ? allAccounts.find(a => a.id === tx.toAccountId)?.name : '-'
                          }
                        </p>
                      </div>
                      <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300 tabular-nums">
                        {tx.amount.toLocaleString()} ج.م
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/70">
              <button 
                type="button"
                onClick={handleConfirmDeleteTransaction}
                className="flex-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl py-3 font-black text-sm transition-all duration-200 shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20"
              >
                تأكيد الحذف والموازنة
              </button>
              <button 
                type="button"
                onClick={() => { setShowDeleteModal(false); setTransactionToDelete(null); setAssociatedTransactions([]); }}
                className="px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert/Warning Dialog */}
      {alertConfig && alertConfig.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2rem] shadow-2xl p-6 text-right" dir="rtl">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-lg font-black">{alertConfig.title}</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm mb-6 leading-relaxed">{alertConfig.message}</p>
            <button 
              onClick={() => setAlertConfig(null)}
              className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-250 dark:bg-slate-705 dark:hover:bg-slate-650 text-slate-700 dark:text-white font-black rounded-xl transition-colors"
            >
              مفهوم
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
