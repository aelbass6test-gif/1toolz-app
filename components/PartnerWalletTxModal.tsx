import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpLeft, DollarSign, Package, Truck, Check, HelpCircle, User, Users, Calculator, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Partner, PartnerTransaction, Settings, Wallet, Transaction, Treasury } from '../types';

interface PartnerWalletTxModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
}

export const PartnerWalletTxModal: React.FC<PartnerWalletTxModalProps> = ({
  isOpen,
  onClose,
  settings,
  updateSettings,
  wallet,
  setWallet,
  treasury,
  setTreasury
}) => {
  const [activeTab, setActiveTab] = useState<'funding' | 'withdrawal'>('funding');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [txType, setTxType] = useState<PartnerTransaction['type']>('capital_addition');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState('');
  const [notes, setNotes] = useState('');

  const partners = settings.partners || [];

  const handleTransaction = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }
    if (!selectedPartnerId) {
      alert('يرجى اختيار الشريك');
      return;
    }

    const partner = partners.find(p => p.id === selectedPartnerId);
    if (!partner) return;

    const isWithdrawal = activeTab === 'withdrawal';
    const tId = Date.now().toString();

    // 1. Create Partner Transaction
    const newPartnerTx: PartnerTransaction = {
      id: tId,
      partnerId: selectedPartnerId,
      type: txType,
      amount: numAmount,
      date: new Date().toISOString(),
      note: notes || undefined,
      treasuryAccountId: selectedTreasuryId || undefined
    };

    // 2. Update Partner Balance
    const updatedPartners = partners.map(p => {
      if (p.id === selectedPartnerId) {
        let newBalance = p.balance;
        if (['loan', 'profit_withdrawal', 'expense_repayment', 'customer_advance', 'internal_transfer_out'].includes(txType)) {
          newBalance -= numAmount;
        } else {
          newBalance += numAmount;
        }
        return { ...p, balance: newBalance };
      }
      return p;
    });

    // 3. Create Wallet Transaction
    const walletTx: Transaction = {
      id: `pt_w_${tId}`,
      type: isWithdrawal ? 'سحب' : 'إيداع',
      amount: numAmount,
      date: new Date().toISOString(),
      note: `معاملة شريك: ${partner.name} - ${
        txType === 'loan' ? 'سلفة / مسحوبات' : 
        txType === 'capital_addition' ? 'إيداع رأس مال' : 
        txType === 'profit_withdrawal' ? 'سحب أرباح' : 
        txType === 'shipping_funding' ? 'تمويل شحن' :
        txType === 'repayment' ? 'سداد سلفة' :
        txType === 'supply_funding' ? 'تمويل بضاعة' : 
        txType === 'expense_coverage' ? 'تغطية مصروفات' : 'معاملة مالية'
      }`,
      category: txType === 'supply_funding' ? 'supply_funding' : (isWithdrawal ? 'manual_withdrawal' : 'manual_deposit'),
      status: 'completed'
    } as Transaction;

    // 4. Update Treasury if selected
    if (selectedTreasuryId && setTreasury && treasury) {
      const selectedAccount = treasury.accounts.find(a => a.id === selectedTreasuryId);
      if (selectedAccount) {
        setTreasury((prev: any) => {
          if (!prev) return prev;
          const updatedAccounts = prev.accounts.map((acc: any) => {
            if (acc.id === selectedTreasuryId) {
              return {
                ...acc,
                balance: isWithdrawal ? acc.balance - numAmount : acc.balance + numAmount
              };
            }
            return acc;
          });

          const newTreasuryTx = {
            id: `T-PART-${Date.now()}`,
            date: new Date().toISOString(),
            type: isWithdrawal ? 'withdrawal' : 'deposit',
            amount: numAmount,
            description: `معاملة شريك ${partner.name}: ${walletTx.note}`,
            toAccountId: isWithdrawal ? undefined : selectedTreasuryId,
            fromAccountId: isWithdrawal ? selectedTreasuryId : undefined,
            reference: `pt_${tId}`
          };

          return {
            ...prev,
            accounts: updatedAccounts,
            transactions: [newTreasuryTx, ...(prev.transactions || [])]
          };
        });
      }
    }

    // 5. Update Global State
    updateSettings({
      ...settings,
      partners: updatedPartners,
      partnerTransactions: [...(settings.partnerTransactions || []), newPartnerTx]
    });

    // 6. Update Wallet
    setWallet(prev => ({
      ...prev,
      balance: isWithdrawal ? prev.balance - numAmount : prev.balance + numAmount,
      transactions: [walletTx, ...prev.transactions]
    }));

    alert('تم تسجيل العملية بنجاح وتحديث الحسابات');
    onClose();
    setAmount('');
    setNotes('');
  };

  const fundingOptions = [
    { id: 'capital_addition', label: 'إيداع رأس مال / زيادة حصة استثمارية (+)', icon: ArrowUpLeft, color: 'text-blue-600 bg-blue-50' },
    { id: 'repayment', label: 'سداد سلفة / إرجاع كاش للمحل (+)', icon: Check, color: 'text-emerald-600 bg-emerald-50' },
    { id: 'supply_funding', label: 'تمويل شراء بضاعة ومخزون (+)', icon: Package, color: 'text-indigo-600 bg-indigo-50' },
    { id: 'expense_coverage', label: 'تغطية مصروفات تشغيلية أو شحن (+)', icon: Truck, color: 'text-purple-600 bg-purple-50' },
  ];

  const withdrawalOptions = [
    { id: 'loan', label: 'سحب أموال (سلفة / مسحوبات شخصية)', icon: ArrowDownRight, color: 'text-rose-600 bg-rose-50' },
    { id: 'profit_withdrawal', label: 'سحب من الأرباح الموزعة', icon: DollarSign, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden text-right"
            dir="rtl"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Users className="text-indigo-600" size={24} />
                معاملات حسابات الشركاء
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Tabs */}
              <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl">
                <button
                  onClick={() => { setActiveTab('funding'); setTxType('capital_addition'); }}
                  className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                    activeTab === 'funding' 
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'
                  }`}
                >
                  ضخ أموال (رأس مال / تمويل)
                </button>
                <button
                  onClick={() => { setActiveTab('withdrawal'); setTxType('loan'); }}
                  className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                    activeTab === 'withdrawal' 
                      ? 'bg-white dark:bg-slate-800 text-rose-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'
                  }`}
                >
                  سحب أموال (سلفة / مسحوبات)
                </button>
              </div>

              {/* Partner Selection */}
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <User size={16} className="text-indigo-500" />
                  اختر الشريك المعني
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {partners.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPartnerId(p.id)}
                      className={`p-4 rounded-2xl border-2 transition-all text-center space-y-1 ${
                        selectedPartnerId === p.id 
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                          : 'border-slate-100 dark:border-slate-700 hover:border-indigo-200 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <p className="font-black text-sm dark:text-white truncate">{p.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">الرصيد: {p.balance.toLocaleString()} ج.م</p>
                    </button>
                  ))}
                  {partners.length === 0 && (
                    <div className="col-span-full p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl text-center">
                      <p className="text-slate-400 font-bold text-sm">لم يتم إضافة شركاء بعد</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Type Selection Grid */}
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Calculator size={16} className="text-indigo-500" />
                  نوع المعاملة
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(activeTab === 'funding' ? fundingOptions : withdrawalOptions).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTxType(opt.id as any)}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                        txType === opt.id 
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                          : 'border-slate-100 dark:border-slate-700 hover:border-indigo-200 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${opt.color}`}>
                        <opt.icon size={20} />
                      </div>
                      <span className="font-black text-xs text-right leading-tight dark:text-white">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Treasury */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Coins size={16} className="text-emerald-500" />
                    المبلغ (ج.م)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-xl font-black outline-none focus:border-indigo-500 transition-all dark:text-white"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <HelpCircle size={16} className="text-amber-500" />
                    عبر حساب (اختياري)
                  </label>
                  <select
                    value={selectedTreasuryId}
                    onChange={(e) => setSelectedTreasuryId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-500 transition-all dark:text-white appearance-none"
                  >
                    <option value="">لا يوجد (تحديث المحفظة فقط)</option>
                    {treasury?.accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300">ملاحظات إضافية</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:border-indigo-500 transition-all dark:text-white h-24 resize-none"
                />
              </div>

              <button
                onClick={handleTransaction}
                disabled={!amount || !selectedPartnerId}
                className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-lg shadow-xl shadow-indigo-500/25 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                تأكيد العملية وتسجيلها
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
