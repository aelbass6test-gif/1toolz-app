import React, { useState, useMemo, useEffect } from 'react';
import { Wallet, Transaction, TransactionCategory, Settings, Treasury, TreasuryTransaction, PartnerTransaction } from '../types';
import { DollarSign, Plus, TrendingDown, PieChart as PieChartIcon, Calendar, Trash2, Tag, Receipt, Landmark, User, Info, Printer } from 'lucide-react';
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
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPartner, setFilterPartner] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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
        .filter(t => t.type === 'سحب' && t.category && (t.category.startsWith('expense_') || t.category.startsWith('supply_expense_') || (settings.expenseCategories || []).includes(t.category)))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [wallet.transactions, settings.expenseCategories]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
        const matchesCategory = filterCategory === 'all' || exp.category === filterCategory;
        const matchesPartner = filterPartner === 'all' || 
            (exp.details?.paidByPartnerId === filterPartner) ||
            (exp.note.includes(settings.partners?.find(p => p.id === filterPartner)?.name || '___NEVER_MATCH___'));
        
        const matchesSearch = !searchQuery || 
            exp.note.toLowerCase().includes(searchQuery.toLowerCase()) || 
            exp.amount.toString().includes(searchQuery);

        return matchesCategory && matchesPartner && matchesSearch;
    });
  }, [expenses, filterCategory, filterPartner, searchQuery, settings.partners]);

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
            'expense_other': 'مصاريف أخرى',
            'supply_expense_shipping': 'شحن مشتريات',
            'supply_expense_other': 'إضافات مشتريات'
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
      const total = filteredExpenses.reduce((sum, t) => sum + t.amount, 0);
      const categoryTotals = expenseCategoriesConfig.map(cat => ({
          name: cat.label,
          value: filteredExpenses.filter(t => t.category === cat.key).reduce((sum, t) => sum + t.amount, 0),
          color: cat.color
      })).filter(c => c.value > 0);
      return { total, categoryTotals };
  }, [filteredExpenses, expenseCategoriesConfig]);

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
          note: `سداد مصروفات (تحمل شخصي): ${description || 'مصروف جديد'} (${categoryLabel})`
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

  const handlePrint = () => {
    window.print();
  };

  const deleteExpense = (id: string) => {
      setDialog({
        isOpen: true,
        title: 'تأكيد الحذف',
        message: 'هل أنت متأكد من حذف هذا المصروف؟ سيتم إعادة المبلغ للمحفظة والخزينة.',
        onConfirm: () => {
          const transactionToDelete = wallet.transactions.find(t => t.id === id);
          if (!transactionToDelete) {
              setDialog(null);
              return;
          }

          const txAccountToRefund = transactionToDelete.details?.treasuryAccountId;
          const paidByPartnerId = transactionToDelete.details?.paidByPartnerId;
          const amntoRefund = Number(transactionToDelete.amount) || 0;

          if (paidByPartnerId) {
              updateSettings({
                  ...settings,
                  partners: (settings.partners || []).map(p => p.id === paidByPartnerId ? { ...p, balance: (p.balance || 0) - amntoRefund } : p),
                  partnerTransactions: (settings.partnerTransactions || []).filter(pt => pt.id !== id + 'pt')
              });
          }

          setWallet(prevWallet => {
            const updatedTransactions = prevWallet.transactions.filter(t => t.id !== id);
            const currentBalance = Number(prevWallet.balance) || 0;
            const newBalance = txAccountToRefund ? currentBalance + amntoRefund : currentBalance;

            return {
                ...prevWallet,
                balance: newBalance,
                transactions: updatedTransactions
            };
          });

          if (setTreasury && amntoRefund > 0 && txAccountToRefund) {
            setTreasury((prev: Treasury) => {
              const updatedAccounts = prev.accounts.map(acc => 
                acc.id === txAccountToRefund ? { ...acc, balance: acc.balance + amntoRefund } : acc
              );
              return {
                ...prev,
                accounts: updatedAccounts,
                transactions: prev.transactions.filter(tx => tx.id !== id)
              };
            });
          }

          setDialog(null);
          showToast('تم حذف المصروف بنجاح');
        }
      });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-8" dir="rtl">
      {/* Print-only Header */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                <Receipt size={32} />
             </div>
             <div>
                <h1 className="text-3xl font-black text-slate-900">مصروفات المتجر العام</h1>
                <p className="text-sm text-slate-600 mt-1 uppercase tracking-widest font-bold">تقرير الضبط المالي والجرد التفصيلي</p>
             </div>
          </div>
          <div className="text-left text-xs font-bold text-slate-500 space-y-1">
            <div>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div>تاريخ الاستخراج: {new Date().toLocaleTimeString('ar-EG')}</div>
            <div className="text-slate-900 font-extrabold pt-2">إجمالي المصروفات في الفترة: {stats.total.toLocaleString()} ج.م</div>
          </div>
        </div>

        {/* Print-only Balances Summary (The "Rest of accounts" requested by user) */}
        <div className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-200 pt-6">
           <div>
             <h3 className="text-sm font-black text-slate-900 mb-3 border-b border-slate-100 pb-1">أرصدة الخزائن الحالية</h3>
             <div className="space-y-2">
                {treasury?.accounts.map(acc => (
                  <div key={acc.id} className="flex justify-between text-xs">
                    <span className="text-slate-600">{acc.name}:</span>
                    <span className="font-bold text-slate-900">{acc.balance.toLocaleString()} ج.م</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs border-t border-slate-100 pt-1 font-black">
                  <span>إجمالي السيولة المتاحة:</span>
                  <span>{(treasury?.accounts.reduce((sum, a) => sum + a.balance, 0) || 0).toLocaleString()} ج.م</span>
                </div>
             </div>
           </div>
           <div>
             <h3 className="text-sm font-black text-slate-900 mb-3 border-b border-slate-100 pb-1">ذمم ومسحوبات الشركاء (مديونيات)</h3>
             <div className="space-y-2">
                {settings.partners?.map(p => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-slate-600">{p.name}:</span>
                    <span className="font-bold text-slate-900">{p.balance?.toLocaleString() || 0} ج.م</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs border-t border-slate-100 pt-1 font-black">
                  <span>إجمالي مديونية الشركاء:</span>
                  <span>{(settings.partners?.reduce((sum, p) => sum + (p.balance || 0), 0) || 0).toLocaleString()} ج.م</span>
                </div>
             </div>
           </div>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl text-right" dir="rtl">
            <h3 className="font-bold text-lg">{dialog.title}</h3>
            <p className="text-slate-600 text-sm">{dialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDialog(null)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">إلغاء</button>
              <button onClick={dialog.onConfirm} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">تأكيد</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-bold ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-650'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">الضبط المالي والمصروفات</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <Receipt size={32} className="text-rose-500"/>
            إدارة المصروفات العامة
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">تتبع التكاليف الإدارية، التسويق والرواتب لضبط هامش الربح التشغيلي بدقة</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
                onClick={handlePrint} 
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-2xl font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer print:hidden"
            >
                <Printer size={18}/>
                <span>طباعة التقرير</span>
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-rose-600/10 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer print:hidden">
                <Plus size={20}/>
                <span>تسجيل مصروف جديد</span>
            </button>
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 dark:from-black dark:to-slate-950 p-8 rounded-[2.5rem] shadow-2xl flex flex-col justify-between text-white min-h-[14rem] border border-white/5 print:bg-white print:text-slate-900 print:border-slate-200 print:shadow-none print:min-h-0 print:p-4">
                <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none print:hidden"></div>
                <div>
                    <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider print:text-rose-600">إجمالي المصروفات العامة</span>
                    <div className="text-4xl font-black tracking-tight mt-1 print:text-2xl">{stats.total.toLocaleString()} <span className="text-lg font-bold opacity-60">ج.م</span></div>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3 text-red-300 text-xs font-medium leading-relaxed mt-4 print:hidden">
                    <TrendingDown className="w-5 h-5 flex-shrink-0 text-rose-400" />
                    <span>المصروفات من الخزينة تخصم تلقائياً من الأرصدة المتوفرة، بينما المسددة شخصياً تقيد للشريك كذمة دائنة.</span>
                </div>
            </div>

            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/40 dark:border-slate-850 shadow-sm flex items-center print:hidden">
                {stats.categoryTotals.length > 0 ? (
                    <div className="w-full flex flex-col md:flex-row items-center gap-8">
                        <div className="w-44 h-44 flex-shrink-0 relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie data={stats.categoryTotals} cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={4} dataKey="value">
                                        {stats.categoryTotals.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] uppercase font-black text-slate-400">التصنيفات</span>
                                <span className="text-lg font-extrabold text-slate-800 dark:text-white">{stats.categoryTotals.length}</span>
                            </div>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                            {stats.categoryTotals.map((cat, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/50 border border-slate-100/10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                        <span className="font-extrabold text-slate-650 dark:text-slate-300 text-xs truncate max-w-[100px]">{cat.name}</span>
                                    </div>
                                    <span className="font-black text-slate-800 dark:text-white text-xs">{cat.value.toLocaleString()} ج.م</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-44 flex flex-col items-center justify-center text-slate-400">
                        <PieChartIcon size={40} className="mb-2 opacity-35 text-slate-300 dark:text-slate-600"/>
                        <p className="text-xs font-bold text-slate-400">لا توجد بيانات تحليلية بعد.</p>
                        <p className="text-[10px] text-slate-500 mt-1">ابدأ بتوزيع مصروفاتك في الحقول المخصصة لتظهر التحليلات هنا.</p>
                    </div>
                )}
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/45 dark:border-slate-850 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-white">سجل المصروفات العامة</h3>
                    <p className="text-xs text-slate-400 mt-1">قائمة تفصيلية بكافة قيود المصروفات مرتبة زمنياً من الأحدث للأقدم</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <div className="relative">
                        <select 
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] sm:text-xs font-bold px-4 py-2 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all cursor-pointer"
                        >
                            <option value="all">كل التصنيفات</option>
                            {expenseCategoriesConfig.map(cat => (
                                <option key={cat.key} value={cat.key}>{cat.label}</option>
                            ))}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                           <Tag size={12} />
                        </div>
                    </div>

                    <div className="relative">
                        <select 
                            value={filterPartner}
                            onChange={(e) => setFilterPartner(e.target.value)}
                            className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] sm:text-xs font-bold px-4 py-2 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all cursor-pointer"
                        >
                            <option value="all">كل المساهمين</option>
                            {(settings.partners || []).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                           <User size={12} />
                        </div>
                    </div>

                    <input 
                        type="text"
                        placeholder="بحث في البيانات..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all w-full sm:w-48"
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 text-xs font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="px-8 py-4">البيان</th>
                            <th className="px-8 py-4">التصنيف</th>
                            <th className="px-8 py-4">التاريخ والوقت</th>
                            <th className="px-8 py-4 text-center">القيمة لـ (ج.م)</th>
                            <th className="px-8 py-4 print:hidden"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredExpenses.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-16 text-slate-400 text-sm font-bold">لم يتم العثور على مصروفات تطابق اختياراتك.</td></tr>
                        ) : (
                            filteredExpenses.map(exp => {
                                const catInfo = expenseCategoriesConfig.find(c => c.key === exp.category);
                                
                                let fundingPartners: { name: string, amount?: number, isPartner: boolean }[] = [];
                                
                                if (exp.details?.paidByPartnerId) {
                                    const p = settings.partners?.find(p => p.id === exp.details.paidByPartnerId);
                                    if (p) fundingPartners.push({ name: p.name, isPartner: true });
                                } else if (exp.details?.orderId) {
                                    const isShipping = exp.category?.includes('shipping');
                                    const requiredType = isShipping ? 'shipping_funding' : 'expense_coverage';
                                    const pts = settings.partnerTransactions?.filter(t => 
                                        t.type === requiredType && 
                                        t.id.includes(exp.details.orderId!) &&
                                        t.amount > 0
                                    ) || [];
                                    
                                    pts.forEach(pt => {
                                        const p = settings.partners?.find(p => p.id === pt.partnerId);
                                        if (p) fundingPartners.push({ name: p.name, amount: pt.amount, isPartner: true });
                                    });
                                }

                                if (fundingPartners.length === 0 && exp.details?.expensePaidBy) {
                                    const isPartner = settings.partners?.some(p => p.name.trim() === exp.details.expensePaidBy?.trim());
                                    fundingPartners.push({ name: exp.details.expensePaidBy, isPartner: !!isPartner });
                                } else if (fundingPartners.length === 0 && exp.details?.note) {
                                    const p = settings.partners?.find(p => p.name.trim() === exp.details.note?.trim());
                                    if (p) fundingPartners.push({ name: p.name, isPartner: true });
                                }

                                return (
                                    <tr key={exp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/40 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="font-extrabold text-slate-800 dark:text-slate-200">{exp.note}</div>
                                            <div className="flex flex-wrap gap-2 mt-1.5">
                                                {fundingPartners.length > 0 ? (
                                                    fundingPartners.map((fp, idx) => (
                                                        <div key={idx} className={`text-[10px] font-black flex items-center gap-1 px-2 py-0.5 rounded-md w-max ${fp.isPartner ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'}`}>
                                                            <User size={10} /> 
                                                            {fp.isPartner ? 'سداد شريك: ' : 'القائم بالدفع: '} {fp.name}
                                                            {fp.amount ? ` (${fp.amount} ج.م)` : ''}
                                                        </div>
                                                    ))
                                                ) : null}
                                                {exp.details?.note && exp.details.note !== exp.note && (
                                                    <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-max">
                                                        <Info size={10} /> ملاحظة: {exp.details.note}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black text-white" style={{ backgroundColor: catInfo?.color || '#94a3b8' }}>
                                                {catInfo?.label || 'مصروف عام'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-sm text-slate-500 font-medium font-mono">
                                            {new Date(exp.date).toLocaleDateString('ar-EG')} - {new Date(exp.date).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                                        </td>
                                        <td className="px-8 py-5 text-center font-black text-base text-rose-600 dark:text-rose-500 tabular-nums">
                                            -{exp.amount.toLocaleString()} ج.م
                                        </td>
                                        <td className="px-8 py-5 text-center font-black text-white tabular-nums print:hidden">
                                            <button onClick={() => deleteExpense(exp.id)} className="p-2 text-slate-450 hover:text-red-650 dark:text-slate-500 dark:hover:text-red-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"><Trash2 size={16}/></button>
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
