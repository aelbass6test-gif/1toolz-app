import React, { useState, useMemo, useEffect } from 'react';
import { Wallet, Transaction, TransactionCategory, Settings, Treasury, TreasuryTransaction, PartnerTransaction } from '../types';
import { DollarSign, Plus, TrendingDown, PieChart as PieChartIcon, Calendar, Trash2, Tag, Receipt, Landmark, User } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface ExpensesPageProps {
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
}

const ExpensesPage: React.FC<ExpensesPageProps> = ({ wallet, setWallet, settings, updateSettings, treasury, setTreasury }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [paymentSource, setPaymentSource] = useState<'treasury' | 'partner'>('treasury');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [category, setCategory] = useState<TransactionCategory>(
      (settings.expenseCategories && settings.expenseCategories.length > 0) 
      ? (settings.expenseCategories[0] as TransactionCategory) 
      : 'expense_ads'
  );

  useEffect(() => {
    if (treasury?.accounts && treasury.accounts.length > 0 && !accountId) {
      setAccountId(treasury.accounts[0].id);
    }
  }, [treasury, accountId]);
  
  // Custom dialog states
  const [dialog, setDialog] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  } | null>(null);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({message, type});
      setTimeout(() => setToast(null), 3000);
  };

  const expenses = useMemo(() => {
      return wallet.transactions
        .filter(t => t.type === 'سحب' && t.category && (t.category.startsWith('expense_') || (settings.expenseCategories || []).includes(t.category)))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [wallet.transactions, settings.expenseCategories]);

  const expenseCategoriesConfig = useMemo(() => {
    // A simple hash function to generate consistent colors based on the category name
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    };

    const getLabel = (key: string) => {
        const labels: Record<string, string> = {
            'expense_ads': 'إعلانات وتسويق',
            'expense_salary': 'رواتب ومكافآت',
            'expense_rent': 'إيجار ومرافق',
            'expense_packaging': 'أدوات تغليف',
            'expense_shipping_fees': 'مصاريف شحن',
            'expense_other': 'مصاريف أخرى'
        };
        return labels[key] || key;
    };

    return (settings.expenseCategories || []).map(cat => ({
        key: cat,
        label: getLabel(cat),
        color: stringToColor(cat)
    }));
  }, [settings.expenseCategories]);

  const stats = useMemo(() => {
      const total = expenses.reduce((sum, t) => sum + t.amount, 0);
      const categoryTotals = expenseCategoriesConfig.map(cat => ({
          name: cat.label,
          value: expenses.filter(t => t.category === cat.key).reduce((sum, t) => sum + t.amount, 0),
          color: cat.color
      })).filter(c => c.value > 0);
      return { total, categoryTotals };
  }, [expenses, expenseCategoriesConfig]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (paymentSource === 'treasury' && !accountId) {
      showToast('الرجاء اختيار حساب الخزينة', 'error');
      return;
    }
    
    if (paymentSource === 'partner' && !selectedPartnerId) {
      showToast('الرجاء اختيار الشريك', 'error');
      return;
    }

    const newTransactionId = Date.now().toString();

    if (paymentSource === 'partner') {
      const partner = (settings.partners || []).find(p => p.id === selectedPartnerId);
      if (!partner) return;

      const categoryLabel = category === 'expense_ads' ? 'إعلانات' : 
             category === 'expense_salary' ? 'رواتب' : 
             category === 'expense_rent' ? 'إيجار' : 
             category === 'expense_packaging' ? 'تغليف' : 
             category === 'expense_shipping_fees' ? 'رسوم شحن' : 
             category === 'expense_other' ? 'أخرى' : category;

      const partnerTx: PartnerTransaction = {
          id: newTransactionId + 'pt',
          partnerId: selectedPartnerId,
          type: 'expense_coverage',
          amount: numAmount,
          date: new Date().toISOString(),
          note: `دفع مصروف شخصياً: ${description || 'مصروف جديد'} (${categoryLabel})`
      };

      updateSettings({
          ...settings,
          partners: (settings.partners || []).map(p => p.id === selectedPartnerId ? { ...p, balance: (p.balance || 0) + numAmount } : p),
          partnerTransactions: [partnerTx, ...(settings.partnerTransactions || [])]
      });

      // Add to Wallet for reporting (but no global balance deduction as it was personal funds)
      const walletTransaction: Transaction = {
          id: newTransactionId,
          type: 'سحب',
          amount: numAmount,
          date: new Date().toISOString(),
          note: `مصروف (بواسطة ${partner.name}): ${description || 'مصروف جديد'}`,
          category: category,
          status: 'completed',
          details: { paidByPartnerId: selectedPartnerId }
      };

      setWallet(prev => ({
          ...prev,
          transactions: [walletTransaction, ...prev.transactions]
      }));

    } else {
      // 1. Add to Wallet Tracking (Expenses are synced into the Wallet Ledger for reports)
      const newTransaction: Transaction = {
          id: newTransactionId,
          type: 'سحب',
          amount: numAmount,
          date: new Date().toISOString(),
          note: description || 'مصروف جديد',
          category: category,
          status: 'completed',
          details: { treasuryAccountId: accountId }
      };

      setWallet(prevWallet => {
          const currentBalance = Number(prevWallet.balance) || 0;
          return {
              ...prevWallet,
              balance: currentBalance - numAmount,
              transactions: [newTransaction, ...prevWallet.transactions]
          };
      });

      // 2. Add to Treasury
      if (setTreasury) {
        const treasuryTx: TreasuryTransaction = {
          id: newTransactionId,
          date: new Date().toISOString(),
          type: 'withdrawal',
          amount: numAmount,
          description: `مصروف: ${description || 'مصروف جديد'}`,
          fromAccountId: accountId
        };
        
        setTreasury((prev: Treasury) => {
          const updatedAccounts = prev.accounts.map(acc => 
            acc.id === accountId ? { ...acc, balance: acc.balance - numAmount } : acc
          );
          return {
            ...prev,
            accounts: updatedAccounts,
            transactions: [treasuryTx, ...(prev.transactions || [])]
          };
        });
      }
    }

    setShowAddModal(false);
    setAmount('');
    setDescription('');
    setSelectedPartnerId('');
  };

  const deleteExpense = (id: string) => {
      setDialog({
        isOpen: true,
        title: 'تأكيد الحذف',
        message: 'هل أنت متأكد من حذف هذا المصروف؟ سيتم إعادة المبلغ للمحفظة والخزينة.',
        onConfirm: () => {
          let txAccountToRefund: string | undefined = undefined;
          let amntoRefund: number = 0;

          setWallet(prevWallet => {
            const transactionToDelete = prevWallet.transactions.find(t => t.id === id);
            if (!transactionToDelete) {
                return prevWallet;
            }
            
            txAccountToRefund = transactionToDelete.details?.treasuryAccountId;
            const paidByPartnerId = transactionToDelete.details?.paidByPartnerId;
            amntoRefund = Number(transactionToDelete.amount) || 0;
            const updatedTransactions = prevWallet.transactions.filter(t => t.id !== id);
            
            const currentBalance = Number(prevWallet.balance) || 0;
            const newBalance = txAccountToRefund ? currentBalance + amntoRefund : currentBalance;

            if (paidByPartnerId) {
                updateSettings({
                    ...settings,
                    partners: (settings.partners || []).map(p => p.id === paidByPartnerId ? { ...p, balance: p.balance - amntoRefund } : p),
                    partnerTransactions: (settings.partnerTransactions || []).filter(pt => pt.id !== id + 'pt')
                });
            }

            return {
                ...prevWallet,
                balance: newBalance,
                transactions: updatedTransactions
            };
          });

          if (setTreasury && amntoRefund > 0) {
            setTreasury((prev: Treasury) => {
              const updatedAccounts = prev.accounts.map(acc => 
                acc.id === txAccountToRefund ? { ...acc, balance: acc.balance + amntoRefund } : acc
              );
              // We could also record a refund transaction in treasury here, but keeping it simple for now
              return {
                ...prev,
                accounts: updatedAccounts,
                transactions: prev.transactions.filter(tx => tx.id !== id) // Remove the linked treasury tx if it exists
              };
            });
          }

          setDialog(null);
          showToast('تم حذف المصروف بنجاح');
        }
      });
  };

  return (
    <div className="space-y-6">
      {dialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-lg">{dialog.title}</h3>
            <p className="text-slate-600">{dialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDialog(null)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">إلغاء</button>
              <button onClick={dialog.onConfirm} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">تأكيد</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-bold ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
        <div className="flex justify-between items-center gap-4">
            <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Receipt size={32} className="text-red-500"/>
                    إدارة المصروفات
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">تتبع كافة التكاليف التشغيلية لمتجرك لضبط صافي الربح.</p>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all active:scale-95">
                <Plus size={20}/> تسجيل مصروف
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div>
                    <h3 className="text-slate-500 dark:text-slate-400 font-bold mb-2">إجمالي المصروفات</h3>
                    <div className="text-4xl font-black text-slate-800 dark:text-white">{stats.total.toLocaleString()} <span className="text-lg text-slate-500">ج.م</span></div>
                </div>
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 text-sm font-bold">
                    <TrendingDown size={20}/>
                    <span>المصروفات من الخزينة تخصم من الرصيد، أما المدفوعة شخصياً فتسجل كمديونية للشريك.</span>
                </div>
            </div>

            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center">
                {stats.categoryTotals.length > 0 ? (
                    <div className="w-full flex flex-col md:flex-row items-center gap-8">
                        <div className="w-48 h-48 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie data={stats.categoryTotals} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {stats.categoryTotals.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            {stats.categoryTotals.map((cat, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{cat.name}</span>
                                    </div>
                                    <span className="font-black text-slate-800 dark:text-white">{cat.value.toLocaleString()} ج.م</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <PieChartIcon size={48} className="mb-2 opacity-50"/>
                        <p>لا توجد بيانات تحليلية بعد.</p>
                    </div>
                )}
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-lg dark:text-white">سجل المصروفات</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-black uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">البيان</th>
                            <th className="px-6 py-4">التصنيف</th>
                            <th className="px-6 py-4">التاريخ</th>
                            <th className="px-6 py-4 text-center">القيمة</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {expenses.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-12 text-slate-400">لم يتم تسجيل أي مصروفات.</td></tr>
                        ) : (
                            expenses.map(exp => {
                                const catInfo = expenseCategoriesConfig.find(c => c.key === exp.category);
                                return (
                                    <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-700 dark:text-slate-300">{exp.note}</div>
                                            {exp.details?.paidByPartnerId && (
                                                <div className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 mt-1">
                                                    <User size={10} /> سدد شخصياً بواسطة: {settings.partners?.find(p => p.id === exp.details.paidByPartnerId)?.name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: catInfo?.color || '#94a3b8' }}>
                                                {catInfo?.label || 'عام'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 font-mono"><Calendar size={12} className="inline ml-1"/>{new Date(exp.date).toLocaleString('ar-EG')}</td>
                                        <td className="px-6 py-4 text-center font-black text-red-600">-{exp.amount.toLocaleString()} ج.م</td>
                                        <td className="px-6 py-4 text-left">
                                            <button onClick={() => deleteExpense(exp.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">تسجيل مصروف جديد</h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
                        <div>
                          <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">مصدر الدفع</label>
                          <div className="flex gap-2">
                             <button type="button" onClick={() => setPaymentSource('treasury')} className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${paymentSource === 'treasury' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-800'}`}>الخزينة / المحفظة</button>
                             <button type="button" onClick={() => setPaymentSource('partner')} className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${paymentSource === 'partner' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-800'}`}>شريك (من جيبه)</button>
                          </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">قيمة المصروف</label>
                            <div className="relative">
                                <input type="number" required autoFocus value={amount} onChange={e => setAmount(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold dark:text-white" placeholder="0.00" />
                                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            </div>
                        </div>

                        {paymentSource === 'treasury' ? (
                          <div>
                              <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">من حساب (الخزينة/المحفظة)</label>
                              <div className="relative">
                                  <select 
                                      required={paymentSource === 'treasury'} 
                                      value={accountId} 
                                      onChange={e => setAccountId(e.target.value)} 
                                      className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold dark:text-white appearance-none"
                                  >
                                      <option value="" disabled>اختر حساب الخزينة</option>
                                      {treasury?.accounts.map(acc => (
                                          <option key={acc.id} value={acc.id}>
                                              {acc.name} - ({acc.balance.toLocaleString()} ج.م)
                                          </option>
                                      ))}
                                  </select>
                                  <Landmark className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                              </div>
                          </div>
                        ) : (
                          <div>
                              <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">اختر الشريك</label>
                              <div className="relative">
                                  <select 
                                      required={paymentSource === 'partner'} 
                                      value={selectedPartnerId} 
                                      onChange={e => setSelectedPartnerId(e.target.value)} 
                                      className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold dark:text-white appearance-none"
                                  >
                                      <option value="" disabled>اختر الشريك المسدد</option>
                                      {(settings.partners || []).map(p => (
                                          <option key={p.id} value={p.id}>
                                              {p.name} - (مديونية: {p.balance.toLocaleString()} ج.م)
                                          </option>
                                      ))}
                                  </select>
                                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                              </div>
                          </div>
                        )}
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">التصنيف</label>
                            <div className="grid grid-cols-2 gap-2">
                                {expenseCategoriesConfig.map(cat => (
                                    <button 
                                        key={cat.key} 
                                        type="button" 
                                        onClick={() => setCategory(cat.key as any)}
                                        className={`p-2 rounded-lg text-xs font-bold border transition-all ${category === cat.key ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600 dark:text-red-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">تفاصيل / ملاحظات</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 dark:text-white h-24" placeholder="اكتب تفاصيل المصروف هنا..." />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">تأكيد الخصم</button>
                            <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default ExpensesPage;
