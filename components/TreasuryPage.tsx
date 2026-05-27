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
  AlertCircle
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

    const newTx: TreasuryTransaction = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: transactionType,
      amount,
      description: transDesc,
      fromAccountId: (transactionType === 'withdrawal' || transactionType === 'transfer' || transactionType === 'advance') ? fromAccount : undefined,
      toAccountId: (transactionType === 'deposit' || transactionType === 'transfer' || transactionType === 'advance') ? toAccount : undefined,
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
  const getTotalCustody = () => accounts.filter(a => a.type === 'custody').reduce((sum, acc) => sum + acc.balance, 0);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">الخزانة والعهد النقدية</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">إدارة السيولة النقدية، الحسابات البنكية، وعهد الموظفين</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => { setTransactionType('deposit'); setShowTransactionModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all"
          >
            <TrendingUp className="w-4 h-4" />
            <span>إيداع / إيراد</span>
          </button>
          <button 
            onClick={() => { setTransactionType('withdrawal'); setShowTransactionModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition-all"
          >
            <TrendingDown className="w-4 h-4" />
            <span>صرف / مصروف</span>
          </button>
          <button 
            onClick={() => { setTransactionType('transfer'); setShowTransactionModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 rounded-xl font-bold transition-all"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>تحويل داخلي</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
              <Landmark className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 font-bold mb-1">إجمالي السيولة النقدية</h3>
          <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">
            {getTotalBalance().toLocaleString()} <span className="text-sm text-slate-500">ج.م</span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 font-bold mb-1">إجمالي العهد لدى الموظفين</h3>
          <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">
            {getTotalCustody().toLocaleString()} <span className="text-sm text-slate-500">ج.م</span>
          </p>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-500" />
            الخزائن والحسابات
          </h3>
          <button 
            onClick={() => setShowAddAccountModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة حساب/خزينة</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-100 dark:divide-slate-800">
          {accounts.map(acc => (
            <div key={acc.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${
                  acc.type === 'safe' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' :
                  acc.type === 'bank' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                  acc.type === 'wallet' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' :
                  'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
                }`}>
                  {getAccountIcon(acc.type)}
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  {acc.type === 'safe' ? 'خزينة' : acc.type === 'bank' ? 'بنك' : acc.type === 'wallet' ? 'محفظة' : 'عهدة'}
                </span>
              </div>
              <h4 className="text-slate-600 dark:text-slate-300 font-bold mb-1">{acc.name}</h4>
              
              {acc.type === 'bank' && (
                <div className="mb-2 space-y-0.5">
                  <p className="text-[10px] text-slate-400 font-bold">{acc.bankName || 'البنك'}</p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-black">{acc.accountNumber}</p>
                  <p className="text-[10px] text-slate-500 font-bold">{acc.beneficiaryName}</p>
                </div>
              )}

              {acc.type === 'wallet' && (
                <div className="mb-2 space-y-0.5">
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-black">{acc.walletNumber}</p>
                  <p className="text-[10px] text-slate-500 font-bold">{acc.walletName}</p>
                </div>
              )}

              <p className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">
                {acc.balance.toLocaleString()} <span className="text-sm text-slate-500 font-bold">ج.م</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
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

    </div>
  );
};
