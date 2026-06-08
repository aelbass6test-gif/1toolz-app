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
}

export const TreasuryPage: React.FC<TreasuryPageProps> = ({ settings, treasury, setTreasury }) => {
  const accounts = treasury?.accounts || [];
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
      const srcAcc = accounts.find(a => a.id === fromAccountId);
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
        if (newTx.fromAccountId) {
          updatedAccounts = updatedAccounts.map(acc => 
            acc.id === newTx.fromAccountId ? { ...acc, balance: acc.balance - amount } : acc
          );
        }
        if (newTx.toAccountId) {
          updatedAccounts = updatedAccounts.map(acc => 
            acc.id === newTx.toAccountId ? { ...acc, balance: acc.balance + amount } : acc
          );
        }
        return {
          accounts: updatedAccounts,
          transactions: [newTx, ...prev.transactions]
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
          {accounts.map(acc => (
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
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {acc.type === 'safe' ? 'خزينة' : acc.type === 'bank' ? 'حساب بنكي' : acc.type === 'wallet' ? 'محفظة' : 'عهدة موقتة'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-slate-800 dark:text-slate-100 font-extrabold text-base truncate" title={acc.name}>{acc.name}</h4>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center justify-center text-slate-500">
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
                    {tx.fromAccountId ? accounts.find(a => a.id === tx.fromAccountId)?.name : '-'}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {tx.toAccountId ? accounts.find(a => a.id === tx.toAccountId)?.name : '-'}
                  </td>
                  <td className={`p-4 text-sm font-black tabular-nums ${
                    tx.type === 'deposit' ? 'text-emerald-600' :
                    tx.type === 'withdrawal' ? 'text-rose-600' :
                    'text-indigo-600'
                  }`}>
                    {tx.type === 'withdrawal' ? '-' : tx.type === 'deposit' ? '+' : ''}{tx.amount.toLocaleString()}
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
                    {accounts.map(acc => (
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
                    {accounts.filter(acc => transactionType !== 'advance' || acc.type === 'custody').map(acc => (
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
