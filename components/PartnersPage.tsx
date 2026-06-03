import React, { useState, useMemo } from 'react';
import { Settings, Partner, PartnerTransaction, Wallet, Transaction, Order } from '../types';
import { Plus, User, DollarSign, ArrowDownRight, ArrowUpLeft, Trash2, Edit2, Check, X, TrendingUp, Wallet as WalletIcon, PieChart, History, Activity, Info, AlertCircle, Package as PackageIcon, Truck, Coins } from 'lucide-react';
import { calculateOrderProfitLoss } from '../utils/financials';
import { motion, AnimatePresence } from 'motion/react';

interface PartnersPageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  orders: Order[];
}

const PartnersPage: React.FC<PartnersPageProps> = ({ settings, updateSettings, wallet, setWallet, orders }) => {
  const [partnerName, setPartnerName] = useState('');
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [editPartnerId, setEditPartnerId] = useState<string | null>(null);
  const [editPartnerName, setEditPartnerName] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionType, setTransactionType] = useState<PartnerTransaction['type']>('loan');
  
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

  const partners = useMemo(() => settings.partners || [], [settings.partners]);
  const transactions = useMemo(() => settings.partnerTransactions || [], [settings.partnerTransactions]);
  
  // Calculate Profit
  const { 
      grossMargin, 
      totalExpenses, 
      operationalFees,
      returnsLosses, 
      adminExpenses,
      allTimeNetProfit,
      undistributedProfit
  } = useMemo(() => {
    let grossMargin = 0;
    let operationalFees = 0;
    let returnsLosses = 0;

    orders.forEach(order => {
        const { profit, loss } = calculateOrderProfitLoss(order, settings);
        
        if (order.status === 'تم_التحصيل' || order.status === 'مدفوعة') {
            const totalItemsRevenue = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const totalItemsCost = order.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
            grossMargin += (totalItemsRevenue - totalItemsCost);
            operationalFees += (totalItemsRevenue - totalItemsCost) - profit;
        } else if (['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام'].includes(order.status)) {
            returnsLosses += loss;
        }
    });
    
    const adminExpenses = wallet.transactions
      .filter(t => {
        const isExpenseCategory = t.category?.startsWith('expense_') || (settings.expenseCategories || []).includes(t.category || '');
        const isManualWithdrawal = t.category === 'manual_withdrawal';
        const isNotPartnerTx = !t.note?.includes('معاملة شريك');
        
        return t.type === 'سحب' && (isExpenseCategory || isManualWithdrawal) && isNotPartnerTx;
      })
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalExpenses = operationalFees + returnsLosses + adminExpenses;
    const allTimeNetProfit = grossMargin - totalExpenses;
    
    const distributed = transactions
      .filter(t => t.type === 'profit_distribution')
      .reduce((sum, t) => sum + t.amount, 0);

    const undistributedProfit = Math.max(0, allTimeNetProfit - distributed);
    
    return { 
        grossMargin, 
        totalExpenses, 
        operationalFees,
        returnsLosses, 
        adminExpenses,
        allTimeNetProfit,
        undistributedProfit
    };
  }, [orders, wallet.transactions, settings, transactions]);

  const addPartner = () => {
    if (!partnerName) return;
    const newPartner: Partner = {
      id: Date.now().toString(),
      name: partnerName,
      balance: 0,
      profitRatio: 0
    };
    updateSettings({
      ...settings,
      partners: [...partners, newPartner]
    });
    setPartnerName('');
    showToast('تم إضافة الشريك بنجاح');
  };

  const totals = useMemo(() => {
     return {
        capital: transactions.filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding').reduce((a, b) => a + b.amount, 0),
        loans: transactions.filter(t => t.type === 'loan').reduce((a, b) => a + b.amount, 0),
        advances: transactions.filter(t => t.type === 'customer_advance').reduce((a, b) => a + b.amount, 0),
        repayments: transactions.filter(t => t.type === 'repayment').reduce((a, b) => a + b.amount, 0),
        withdrawals: transactions.filter(t => t.type === 'profit_withdrawal').reduce((a, b) => a + b.amount, 0)
     };
  }, [transactions]);

  const distributeProfit = () => {
    if (undistributedProfit <= 0) {
        showToast('لا يوجد أرباح جديدة متاحة للتوزيع حالياً', 'error');
        return;
    }
    const totalRatios = partners.reduce((sum, p) => sum + (p.profitRatio || 0), 0);
    if (totalRatios !== 100) {
        showToast(`خطأ: لتوزيع الأرباح يجب أن يكون مجموع النسب 100% تماماً. (الحالي: ${totalRatios}%) - إذا كان هناك نسبة مستقطعة للشركة، قم بإضافتها كشريك باسم "أرباح محتجزة" أو "الشركة".`, 'error');
        return;
    }

    setDialog({
        isOpen: true,
        title: 'تأكيد توزيع الأرباح',
        message: `سيتم توزيع ${undistributedProfit.toLocaleString()} ج.م (الأرباح الجديدة) على الشركاء بناءً على نسبهم. هل تريد المتابعة؟`,
        onConfirm: () => {
            const newTransactions: PartnerTransaction[] = [];
            const updatedPartners = partners.map(partner => {
                const share = (undistributedProfit * (partner.profitRatio || 0)) / 100;
                if (share <= 0) return partner;
        
                const newTransaction: PartnerTransaction = {
                    id: Date.now().toString() + partner.id,
                    partnerId: partner.id,
                    type: 'profit_distribution', 
                    amount: share,
                    date: new Date().toISOString(),
                    note: `توزيع أرباح تلقائي عن الفترة الحالية ${new Date().toLocaleDateString('ar-EG')}`
                };
                newTransactions.push(newTransaction);
                
                return {
                    ...partner,
                    balance: partner.balance + share
                };
            });
        
            updateSettings({
                ...settings,
                partners: updatedPartners,
                partnerTransactions: [...transactions, ...newTransactions]
            });
            setDialog(null);
            showToast('تم توزيع الأرباح بنجاح');
        }
    });
  };

  const deletePartner = (partnerId: string) => {
    if (transactions.some(t => t.partnerId === partnerId)) {
        showToast('عفواً، لا يمكن حذف شريك له حركات مالية مسجلة. للضرورة، قم بتصفية أرقامه أولاً.', 'error');
        return;
    }
    setDialog({
        isOpen: true,
        title: 'تأكيد الحذف',
        message: 'هل أنت متأكد من حذف هذا الشريك؟ سيتم حذف جميع معاملاته أيضاً.',
        onConfirm: () => {
            updateSettings({
              ...settings,
              partners: partners.filter(p => p.id !== partnerId),
              partnerTransactions: transactions.filter(t => t.partnerId !== partnerId)
            });
            setDialog(null);
            showToast('تم حذف الشريك بنجاح');
        }
    });
  };

  const startEditPartner = (partner: Partner) => {
    setEditPartnerId(partner.id);
    setEditPartnerName(partner.name);
  };

  const savePartnerName = () => {
    if (!editPartnerId || !editPartnerName) return;
    updateSettings({
      ...settings,
      partners: partners.map(p => p.id === editPartnerId ? {...p, name: editPartnerName} : p)
    });
    setEditPartnerId(null);
    showToast('تم تعديل اسم الشريك بنجاح');
  };

  const addTransaction = (partnerId: string) => {
    const amount = parseFloat(transactionAmount);
    if (!amount || isNaN(amount)) return;
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return;

    if (transactionType === 'profit_withdrawal') {
        const partnerDistributions = transactions.filter(t => t.partnerId === partnerId && t.type === 'profit_distribution').reduce((a, b) => a + b.amount, 0);
        const partnerWithdrawals = transactions.filter(t => t.partnerId === partnerId && t.type === 'profit_withdrawal').reduce((a, b) => a + b.amount, 0);
        const availableProfit = partnerDistributions - partnerWithdrawals;
        
        if (amount > availableProfit) {
            showToast(`عفواً، لا يمكن سحب أرباح تتجاوز المتاح (${availableProfit.toLocaleString()} ج.م)`, 'error');
            return;
        }
    }

    const isWithdrawal = transactionType === 'loan' || transactionType === 'profit_withdrawal' || transactionType === 'expense_repayment';
    const isSupplyFunding = transactionType === 'supply_funding';

    if (isWithdrawal && amount > wallet.balance) {
        showToast('عفواً، الرصيد المتاح في المحفظة غير كافٍ لإتمام السحب', 'error');
        return;
    }

    const newTransaction: PartnerTransaction = {
      id: Date.now().toString(),
      partnerId,
      type: transactionType,
      amount,
      date: new Date().toISOString(),
    };

    const updatedPartners = partners.map(p => {
        if (p.id === partnerId) {
            let newBalance = p.balance;
            if (transactionType === 'loan' || transactionType === 'profit_withdrawal' || transactionType === 'expense_repayment') {
                newBalance -= amount;
            } else {
                newBalance += amount;
            }
            return { ...p, balance: newBalance };
        }
        return p;
    });

    const walletTransaction: Transaction = {
        id: Date.now().toString() + 'w',
        type: (isWithdrawal) ? 'سحب' : 'إيداع',
        amount: amount,
        date: new Date().toISOString(),
        note: `معاملة شريك: ${partner.name} - ${
            transactionType === 'loan' ? 'سلفة' : 
            transactionType === 'capital_addition' ? 'إيداع رأس مال' : 
            transactionType === 'profit_withdrawal' ? 'سحب أرباح' : 
            transactionType === 'shipping_funding' ? 'إيداع مصاريف الشحن' :
            transactionType === 'expense_repayment' ? 'رد مصروفات شخصية' :
            transactionType === 'supply_funding' ? 'تمويل شراء بضاعة (إيداع محفظة التوريد)' : 'سداد سلفة'
        }`,
        category: isSupplyFunding ? 'supply_deposit' : (isWithdrawal ? 'manual_withdrawal' : 'manual_deposit'),
        status: 'completed'
    } as Transaction;

    updateSettings({
      ...settings,
      partners: updatedPartners,
      partnerTransactions: [...transactions, newTransaction]
    });

    const movesRealMoney = transactionType !== 'profit_distribution';
    
    if (movesRealMoney) {
        setWallet(prev => ({ 
            ...prev, 
            balance: isSupplyFunding ? prev.balance : prev.balance + (isWithdrawal ? -amount : amount),
            supplyBalance: isSupplyFunding ? (prev.supplyBalance || 0) + amount : prev.supplyBalance,
            transactions: [walletTransaction, ...prev.transactions] 
        }));
    }
    
    setTransactionAmount('');
    showToast('تم إضافة المعاملة بنجاح');
  };

  return (
    <div className="p-4 sm:p-6 space-y-8 bg-slate-50/30 dark:bg-slate-900/10 min-h-screen">
      <AnimatePresence>
        {dialog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl"
            >
               <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
                 <AlertCircle size={32} />
               </div>
               <div className="text-center space-y-2">
                 <h3 className="font-black text-xl dark:text-white">{dialog.title}</h3>
                 <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{dialog.message}</p>
               </div>
               <div className="flex gap-3 pt-2">
                   <button onClick={() => setDialog(null)} className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">إلغاء</button>
                   <button onClick={dialog.onConfirm} className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25">تأكيد</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className={`fixed bottom-8 right-8 z-50 px-8 py-4 rounded-2xl shadow-2xl text-white font-bold flex items-center gap-3 backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-600/90' : 'bg-red-600/90'}`}
            >
                {toast.type === 'success' ? <Check size={20}/> : <X size={20}/>}
                {toast.message}
            </motion.div>
        )}
      </AnimatePresence>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
             <div className="p-2 bg-indigo-600 text-white rounded-2xl">
                <PieChart size={24} />
             </div>
             إدارة الشركاء
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">متابعة رؤوس الأموال، السلف، وتوزيع الأرباح</p>
        </div>
        
        <div className="flex gap-3">
            <button 
              onClick={() => distributeProfit()}
              className="bg-white dark:bg-slate-800 border-2 border-indigo-600/20 text-indigo-600 dark:text-indigo-400 px-6 py-3 rounded-2xl font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-2"
            >
              <TrendingUp size={18} />
              تحليل الأرباح
            </button>
            <button 
              onClick={() => {
                if (!partnerName) return;
                addPartner();
              }}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
               إضافة شريك
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              توزيع الأرباح التشغيلية
              <div className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-wider">حي ومباشر</div>
            </h2>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
               <Info size={14} />
               يتم الحساب بناءً على الأوردرات المكتملة
            </div>
          </div>
          
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-3xl group transition-all hover:border-indigo-300">
                        <div className="flex justify-between items-start mb-4">
                          <p className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                              <DollarSign size={18} /> إجمالي الربح التشغيلي
                          </p>
                          <TrendingUp className="text-indigo-300 dark:text-indigo-700" size={24} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{grossMargin.toLocaleString()} <span className="text-sm font-normal text-slate-400">ج.م</span></h3>
                            <p className="text-xs text-slate-400 font-medium">قبل خصم المصاريف والخسائر</p>
                        </div>
                    </div>

                    <div className="bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-6 rounded-3xl transition-all hover:border-rose-300">
                        <div className="flex justify-between items-start mb-4">
                          <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                              <ArrowDownRight size={18} /> إجمالي الخسائر والمصروفات
                          </p>
                          <Activity className="text-rose-300 dark:text-rose-700" size={24} />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm text-slate-500 font-medium">
                                <span>رسوم لوجستية (تأمين/تحصيل)</span>
                                <span className="text-rose-600 font-bold">-{operationalFees.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-500 font-medium">
                                <span>فشل توصيل ومرتجعات</span>
                                <span className="text-rose-600 font-bold">-{returnsLosses.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-500 font-medium">
                                <span>مصاريف إدارية وتشغيلية</span>
                                <span className="text-rose-600 font-bold">-{adminExpenses.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-500 font-medium font-black border-t border-rose-100 dark:border-rose-900/30 pt-2">
                                <span>صافي المصروفات</span>
                                <span className="text-rose-600">{totalExpenses.toLocaleString()} ج.م</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 ring-1 ring-indigo-500/10"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-500/5 rounded-full -ml-12 -mb-12 ring-1 ring-rose-500/10"></div>
                    
                    <div className="space-y-4 relative z-10 w-full">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إجمالي الأرباح التاريخية</p>
                          <p className="text-xl font-black text-slate-700 dark:text-slate-300">
                             {allTimeNetProfit.toLocaleString()} <span className="text-sm">ج.م</span>
                          </p>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">الأرباح المتاحة للتوزيع</p>
                          <h4 className="text-5xl font-black text-indigo-600 dark:text-indigo-400">
                            {undistributedProfit.toLocaleString()} 
                            <span className="text-xl font-bold text-slate-400 ml-2">ج.م</span>
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-bold">بعد خصم {(allTimeNetProfit - undistributedProfit).toLocaleString()} ج.م تم توزيعها سابقاً</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] font-medium leading-relaxed">
                        يتم توزيع المبلغ المتبقي فقط على الشركاء.
                    </p>

                    <button 
                      onClick={distributeProfit} 
                      disabled={undistributedProfit <= 0}
                      className={`w-full group relative overflow-hidden text-white px-8 py-4 rounded-2xl font-black transition-all duration-300 shadow-xl active:scale-95 ${undistributedProfit > 0 ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none'}`}
                    >
                        توزيع الأرباح المتبقية
                    </button>
                </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600 group-hover:scale-110 transition-transform"><WalletIcon size={80}/></div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center"><User size={20}/></div>
                    <h5 className="font-bold text-slate-500 dark:text-slate-400">إجمالي الشركاء</h5>
                  </div>
                  <p className="text-4xl font-black dark:text-white tracking-tight">{partners.length}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-600 group-hover:scale-110 transition-transform"><DollarSign size={80}/></div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center"><ArrowUpLeft size={20}/></div>
                    <h5 className="font-bold text-slate-500 dark:text-slate-400">إجمالي رأس المال</h5>
                  </div>
                  <p className="text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{totals.capital.toLocaleString()} <span className="text-sm font-bold text-slate-400">ج.م</span></p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-600 group-hover:scale-110 transition-transform"><History size={80}/></div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-xl flex items-center justify-center"><ArrowDownRight size={20}/></div>
                    <h5 className="font-bold text-slate-500 dark:text-slate-400">صافي مديونية السلف</h5>
                  </div>
                  <p className="text-4xl font-black text-rose-600 dark:text-rose-400 tracking-tight">{(totals.loans - totals.repayments).toLocaleString()} <span className="text-sm font-bold text-slate-400">ج.م</span></p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-teal-600 group-hover:scale-110 transition-transform"><Coins size={80}/></div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-xl flex items-center justify-center"><Coins size={20}/></div>
                    <h5 className="font-bold text-slate-500 dark:text-slate-400">إجمالي العرابين المستلمة</h5>
                  </div>
                  <p className="text-4xl font-black text-teal-600 dark:text-teal-400 tracking-tight">{totals.advances.toLocaleString()} <span className="text-sm font-bold text-slate-400">ج.م</span></p>
                </div>
            </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                  type="text" 
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="أدخل اسم الشريك الجديد..."
                  className="w-full pr-12 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-600/20 rounded-2xl outline-none transition-all font-bold"
              />
            </div>
            <button 
              onClick={addPartner} 
              className="w-full sm:w-auto bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
                إضافة الشريك
            </button>
        </div>
      </div>

      <h2 className="text-2xl font-black text-slate-800 dark:text-white px-2">الشركاء والمركز المالي</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
        {partners.map((partner, index) => (
          <motion.div 
            key={partner.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col"
          >
            <div className="p-6 border-b border-slate-50 dark:border-slate-700/50">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                      <User size={30} />
                  </div>
                  <div className="space-y-1">
                    {editPartnerId === partner.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          value={editPartnerName} 
                          onChange={(e) => setEditPartnerName(e.target.value)} 
                          className="font-black text-lg bg-slate-50 dark:bg-slate-900 border-2 border-indigo-600/30 rounded-lg px-2 py-1 outline-none w-40"
                          autoFocus
                        />
                        <button onClick={savePartnerName} className="text-emerald-600 hover:scale-110 transition-transform"><Check size={20}/></button>
                        <button onClick={() => setEditPartnerId(null)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none">
                            <a href={`#/partners/${partner.id}`} className="hover:text-indigo-600 transition-colors">{partner.name}</a>
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">شريك مؤسس</span>
                           {partner.profitRatio > 0 && (
                             <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">نسبة {partner.profitRatio}%</span>
                           )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditPartner(partner)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="تعديل"><Edit2 size={16}/></button>
                    <button onClick={() => {
                        setDialog({
                            isOpen: true,
                            title: 'تأكيد تصفية الحساب',
                            message: 'سيتم حذف جميع المعاملات المالية لهذا الشريك وتصفير رصيده (لا يمكن التراجع عن هذا الإجراء). هل أنت متأكد؟',
                            onConfirm: () => {
                                updateSettings({
                                    ...settings,
                                    partners: partners.map(p => p.id === partner.id ? {...p, balance: 0} : p),
                                    partnerTransactions: transactions.filter(t => t.partnerId !== partner.id)
                                });
                                setDialog(null);
                                showToast('تم تصفية حساب الشريك بنجاح، يمكنك الآن حذفه.');
                            }
                        });
                    }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all" title="تصفية الحساب"><Coins size={16}/></button>
                    <button onClick={() => deletePartner(partner.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="حذف"><Trash2 size={16}/></button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">الرصيد المتاح</p>
                      <p className={`text-xl font-black ${partner.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {partner.balance.toLocaleString()} ج.م
                      </p>
                  </div>
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">الحصة القادمة</p>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                         {((undistributedProfit * (partner.profitRatio || 0)) / 100).toLocaleString()}
                      </p>
                  </div>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-4">
                <div className="space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">التحكم في المعاملات</p>
                  
                  {activePartnerId !== partner.id ? (
                      <button 
                          onClick={() => {
                            setActivePartnerId(partner.id);
                            setTransactionType('loan');
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-4 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all group/btn"
                      >
                          <History size={18} className="group-hover/btn:rotate-12 transition-transform" />
                          إضافة معاملة مالية
                      </button>
                  ) : (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30"
                    >
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-black text-indigo-600 dark:text-indigo-400">بيانات المعاملة</label>
                          <button onClick={() => setActivePartnerId(null)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                        </div>
                        
                        <div className="space-y-3">
                            <input 
                                type="number"
                                value={transactionAmount}
                                onChange={(e) => setTransactionAmount(e.target.value)}
                                placeholder="أدخل المبلغ..."
                                className="w-full p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-600/30 font-black text-center text-lg"
                                autoFocus
                            />
                            
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                  { key: 'loan', label: 'سلفة / سحب', icon: ArrowDownRight, color: 'hover:border-rose-300 hover:text-rose-600' },
                                  { key: 'expense_repayment', label: 'رد مصروفات شخصية', icon: Check, color: 'hover:border-emerald-300 hover:text-emerald-600' },
                                  { key: 'capital_addition', label: 'إيداع رأس مال', icon: ArrowUpLeft, color: 'hover:border-emerald-300 hover:text-emerald-600' },
                                  { key: 'shipping_funding', label: 'إيداع مصاريف شحن', icon: Truck, color: 'hover:border-blue-300 hover:text-blue-600' },
                                  { key: 'profit_withdrawal', label: 'سحب من الأرباح', icon: DollarSign, color: 'hover:border-amber-300 hover:text-amber-600' },
                                  { key: 'repayment', label: 'سداد سداد قرض/سلفة', icon: Check, color: 'hover:border-blue-300 hover:text-blue-600' },
                                  { key: 'supply_funding', label: 'تمويل شراء بضاعة', icon: PackageIcon, color: 'hover:border-indigo-300 hover:text-indigo-600' }
                                ].map(type => (
                                  <button 
                                    key={type.key}
                                    onClick={() => setTransactionType(type.key as any)}
                                    className={`p-3 rounded-xl border-2 text-[10px] font-black flex flex-col items-center gap-1 transition-all ${
                                      transactionType === type.key 
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                        : `border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-500 ${type.color}`
                                    }`}
                                  >
                                    <type.icon size={16} />
                                    {type.label}
                                  </button>
                                ))}
                            </div>

                            <button 
                              onClick={() => {
                                if (!transactionAmount) return;
                                addTransaction(partner.id);
                                setActivePartnerId(null);
                              }} 
                              className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                            >
                              تأكيد المعاملة
                            </button>
                        </div>
                    </motion.div>
                  )}

                  <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">نسبة الشراكة (الربح)</span>
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{partner.profitRatio || 0}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={partner.profitRatio || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          updateSettings({
                            ...settings,
                            partners: partners.map(p => p.id === partner.id ? {...p, profitRatio: val} : p)
                          });
                        }}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center px-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">آخر 3 معاملات</p>
                          <a href={`#/partners/${partner.id}`} className="text-[10px] font-black text-indigo-600 hover:underline">عرض الكل</a>
                      </div>
                      <div className="space-y-2">
                        {transactions
                          .filter(t => t.partnerId === partner.id)
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 3)
                          .map(t => (
                              <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                  <div className="flex items-center gap-3">
                                      <div className={`p-1.5 rounded-lg ${
                                        ['capital_addition', 'repayment', 'supply_funding', 'expense_coverage'].includes(t.type) 
                                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' 
                                          : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
                                      }`}>
                                        {['loan', 'customer_advance'].includes(t.type) ? <ArrowDownRight size={12}/> : 
                                         t.type === 'capital_addition' ? <ArrowUpLeft size={12}/> : 
                                         t.type === 'shipping_funding' ? <Truck size={12}/> : 
                                         t.type === 'repayment' ? <Check size={12}/> : 
                                         t.type === 'expense_repayment' ? <Check size={12}/> :
                                         t.type === 'expense_coverage' ? <DollarSign size={12}/> :
                                         t.type === 'supply_funding' ? <PackageIcon size={12}/> : <DollarSign size={12}/>}
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                        {t.type === 'loan' ? 'سلفة' : t.type === 'customer_advance' ? 'عربون محصل' : t.type === 'capital_addition' ? 'رأس مال' : t.type === 'shipping_funding' ? 'شحن' : t.type === 'profit_withdrawal' ? 'سحب أرباح' : t.type === 'profit_distribution' ? 'إضافة أرباح' : t.type === 'supply_funding' ? 'تمويل بضاعة' : t.type === 'expense_coverage' ? 'مصروف شخصي' : t.type === 'expense_repayment' ? 'رد مصروفات' : 'سداد'}
                                      </span>
                                  </div>
                                  <span className={`text-[10px] font-black ${['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage'].includes(t.type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {['loan', 'profit_withdrawal', 'expense_repayment'].includes(t.type) ? '-' : '+'}{t.amount.toLocaleString()} 
                                      <span className="text-[10px] ml-1">ج.م</span>
                                  </span>
                              </div>
                          ))}
                        {transactions.filter(t => t.partnerId === partner.id).length === 0 && (
                          <div className="text-center py-4 text-slate-400 text-[10px] font-medium italic">
                            لا توجد معاملات مسجلة بعد
                          </div>
                        )}
                      </div>
                  </div>
                </div>
            </div>
          </motion.div>
        ))}
      </div>

      <h2 className="text-2xl font-black text-slate-800 dark:text-white px-2 mt-8">سجل توزيعات الأرباح السابقة</h2>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mb-12">
          {(() => {
              const profitDistributions = transactions
                  .filter(t => t.type === 'profit_distribution' || t.type === 'profit_withdrawal')
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              
              if (profitDistributions.length === 0) {
                  return <div className="text-center py-8 text-slate-400 font-bold">لا يوجد توزيعات أرباح سابقة.</div>;
              }

              return (
                  <div className="overflow-x-auto">
                      <table className="w-full text-right">
                          <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-700/50 text-slate-500 text-sm">
                                  <th className="py-3 px-4 font-bold">التاريخ</th>
                                  <th className="py-3 px-4 font-bold">الشريك</th>
                                  <th className="py-3 px-4 font-bold">المبلغ</th>
                                  <th className="py-3 px-4 font-bold">ملاحظات</th>
                              </tr>
                          </thead>
                          <tbody>
                              {profitDistributions.map(t => {
                                  const partner = partners.find(p => p.id === t.partnerId);
                                  return (
                                      <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                          <td className="py-4 px-4 text-sm font-bold text-slate-700 dark:text-slate-300">{new Date(t.date).toLocaleString('ar-EG')}</td>
                                          <td className="py-4 px-4 font-black text-indigo-600 dark:text-indigo-400">{partner?.name || 'شريك محذوف'}</td>
                                          <td className="py-4 px-4 font-black text-emerald-600 dark:text-emerald-400">
                                              {t.amount.toLocaleString()} ج.م
                                          </td>
                                          <td className="py-4 px-4 text-sm text-slate-500">{t.note}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              );
          })()}
      </div>
    </div>
  );
};

export default PartnersPage;
