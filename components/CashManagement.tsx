import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ArrowRightLeft, 
  User, 
  Plus, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp,
  Banknote,
  Search,
  Clock,
  ChevronDown,
  ChevronUp,
  Handshake,
  UserCheck,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Settings, CashHolder, CashHandover, Treasury, TreasuryTransaction } from '../types';

interface CashManagementProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  currentUser: any;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
  wallet?: any;
  setWallet?: (updater: any) => void;
}

const CashManagement: React.FC<CashManagementProps> = ({ settings, updateSettings, currentUser, treasury, setTreasury, wallet, setWallet }) => {
  const [activeTab, setActiveTab] = useState<'balances' | 'handovers'>('balances');
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState<CashHandover | null>(null);

  // New Handover Form
  const [handoverType, setHandoverType] = useState<'holder' | 'treasury' | 'supply_wallet'>('holder');
  const [newHandover, setNewHandover] = useState({
    fromUserId: '',
    toUserId: '',
    amount: 0,
    notes: ''
  });

  // Safe/Treasury Handover states
  const [showTreasuryModal, setShowTreasuryModal] = useState(false);
  const [selectedHolderForTreasury, setSelectedHolderForTreasury] = useState<CashHolder | null>(null);
  const [treasuryAmount, setTreasuryAmount] = useState(0);
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState('');
  const [treasuryNotes, setTreasuryNotes] = useState('');

  const [dialog, setDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, isWarning?: boolean} | null>(null);


  const holders = settings.cashHolders || [];
  const handovers = settings.cashHandovers || [];
  const employees = settings.employees || [];
  
  // Combine currentUser and employees for selection
  const allPossibleHolders = [
    { id: 'admin', name: 'المدير (أنت)', role: 'admin' },
    ...employees.map((e, index) => ({ id: `emp_${e.id || e.phone || index}`, name: e.name, role: 'employee' })),
    ...(settings.partners || []).map((p, index) => ({ id: `part_${p.id || index}`, name: p.name, role: 'partner' }))
  ];

  const handleExecuteHandover = () => {
    if (handoverType !== 'supply_wallet' && !newHandover.toUserId) {
      return alert(handoverType === 'treasury' ? 'يرجى اختيار الحساب المستلم (الخزينة)' : 'يرجى اختيار المستلم');
    }
    if (newHandover.amount <= 0) return alert('يرجى تحديد المبلغ');

    const amount = Number(newHandover.amount);
    
    // Determine source
    const fromUserId = newHandover.fromUserId || currentUser?.id || 'admin';
    const fromUser = allPossibleHolders.find(h => h.id === fromUserId);
    const fromUserName = fromUser?.name || currentUser?.fullName || 'المدير';

    const handoverId = `HND-${Date.now()}`;
    let toUserName = '';
    
    if (handoverType === 'supply_wallet') {
      toUserName = 'محفظة التوريد (رأس مال المخزون)';
    } else if (handoverType === 'treasury') {
      const targetAccount = (treasury?.accounts || []).find((acc: any) => acc.id === newHandover.toUserId);
      if (!targetAccount) return alert('الحساب المالي المحدد غير موجود');
      toUserName = `الخزينة: ${targetAccount.name}`;
    } else {
      const toUser = allPossibleHolders.find(h => h.id === newHandover.toUserId);
      toUserName = toUser?.name || 'مستخدم غير معروف';
      if (fromUserId === newHandover.toUserId) {
        return alert('لا يمكن تسليم العهدة لنفس الشخص');
      }
    }

    const handoverData: CashHandover = {
      id: handoverId,
      fromUserId,
      fromUserName,
      toUserId: handoverType === 'treasury' ? `treasury_${newHandover.toUserId}` : handoverType === 'supply_wallet' ? 'supply_wallet' : newHandover.toUserId,
      toUserName,
      amount,
      date: new Date().toISOString(),
      notes: newHandover.notes,
      status: 'completed'
    };

    // Update balances
    const updatedHolders = [...holders];
    
    // Decrease from source
    const fromIdx = updatedHolders.findIndex(h => h.userId === fromUserId);
    if (fromIdx > -1) {
      updatedHolders[fromIdx].currentBalance -= amount;
      updatedHolders[fromIdx].lastUpdated = handoverData.date;
    } else {
      updatedHolders.push({ userId: fromUserId, userName: fromUserName, currentBalance: -amount, lastUpdated: handoverData.date });
    }

    // Increase destination
    if (handoverType === 'treasury') {
      // Update Treasury State
      if (setTreasury) {
        const treasuryTxId = `tx-custody-deposit-${Date.now()}`;
        setTreasury((prev: any) => {
          if (!prev) return prev;
          const currentAccounts = prev.accounts || [];
          const updatedAccounts = currentAccounts.map((acc: any) => 
            acc.id === newHandover.toUserId ? { ...acc, balance: Number(acc.balance || 0) + amount } : acc
          );
          const treasuryTx: TreasuryTransaction = {
            id: treasuryTxId,
            date: new Date().toISOString(),
            type: 'deposit',
            amount,
            description: `توريد عهدة نقدية من: ${fromUserName}`,
            toAccountId: newHandover.toUserId,
            reference: handoverId
          };
          return {
            ...prev,
            accounts: updatedAccounts,
            transactions: [treasuryTx, ...(prev.transactions || [])]
          };
        });
      }
    } else if (handoverType === 'supply_wallet') {
      // Update Supply Wallet
      if (setWallet) {
        setWallet((prev: any) => {
          const walletTx = {
            id: `TR-CUSTODY-${Date.now()}`,
            type: 'إيداع',
            amount,
            date: new Date().toISOString(),
            note: `توريد عهدة نقدية من ${fromUserName} إلى محفظة التوريد: ${newHandover.notes || ''}`,
            category: 'supply_funding',
            status: 'completed'
          };
          return {
            ...prev,
            supplyBalance: (prev.supplyBalance || 0) + amount,
            transactions: [walletTx, ...(prev.transactions || [])]
          };
        });
      }
    } else {
      // Increase to destination holder
      const toIdx = updatedHolders.findIndex(h => h.userId === handoverData.toUserId);
      if (toIdx > -1) {
        updatedHolders[toIdx].currentBalance += amount;
        updatedHolders[toIdx].lastUpdated = handoverData.date;
      } else {
        updatedHolders.push({ userId: handoverData.toUserId, userName: handoverData.toUserName, currentBalance: amount, lastUpdated: handoverData.date });
      }
    }

    updateSettings({
      ...settings,
      cashHolders: updatedHolders,
      cashHandovers: [handoverData, ...handovers],
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          user: fromUserName,
          action: handoverType === 'treasury' ? 'توريد عهدة للخزينة' : handoverType === 'supply_wallet' ? 'توريد عهدة لمحفظة التوريد' : 'تسليم نقدية',
          details: handoverType === 'treasury' 
            ? `توريد مبلغ ${amount} ج.م من عهدة ${fromUserName} إلى حساب ${toUserName}`
            : handoverType === 'supply_wallet'
            ? `توريد مبلغ ${amount} ج.م من عهدة ${fromUserName} إلى محفظة التوريد (رأس مال المخزون)`
            : `تسليم مبلغ ${amount} ج.م من عهدة ${fromUserName} إلى ${handoverData.toUserName}`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    });

    setShowHandoverModal(false);
    setNewHandover({ fromUserId: '', toUserId: '', amount: 0, notes: '' });
    alert(
      handoverType === 'treasury' ? 'تم توريد مبلغ العهدة للخزينة بنجاح وترقية الحساب' :
      handoverType === 'supply_wallet' ? 'تم توريد مبلغ العهدة لمحفظة التوريد بنجاح' :
      'تم تسجيل عملية التسليم وتحديث العهد بنجاح'
    );
  };

  const handleExecuteTreasuryDeposit = () => {
    if (!selectedHolderForTreasury) return;
    if (!selectedTreasuryAccountId) return alert('يرجى اختيار خزينة أو محفظة للتوريد والإيداع');
    if (treasuryAmount <= 0) return alert('يرجى تحديد المبلغ');

    const amount = Number(treasuryAmount);
    const isSupplyWallet = selectedTreasuryAccountId === 'supply_wallet';
    
    let toUserName = '';
    if (isSupplyWallet) {
      toUserName = 'محفظة التوريد (رأس مال المخزون)';
    } else {
      const treasuryAccountsList = treasury?.accounts || [];
      const targetAccount = treasuryAccountsList.find((acc: any) => acc.id === selectedTreasuryAccountId);
      if (!targetAccount) return alert('الحساب المالي المحدد غير موجود');
      toUserName = `الخزينة: ${targetAccount.name}`;
    }

    const handoverId = `HND-TR-${Date.now()}`;
    const handoverData: CashHandover = {
      id: handoverId,
      fromUserId: selectedHolderForTreasury.userId,
      fromUserName: selectedHolderForTreasury.userName,
      toUserId: isSupplyWallet ? 'supply_wallet' : `treasury_${selectedTreasuryAccountId}`,
      toUserName,
      amount,
      date: new Date().toISOString(),
      notes: treasuryNotes ? `توريد مالي لمستودع التوريد: ${treasuryNotes}` : `تسليم مالي وتوريد عهدة للخزينة/المحفظة (${toUserName})`,
      status: 'completed'
    };

    // Update Cash Holders balances
    const updatedHolders = holders.map(h => {
      if (h.userId === selectedHolderForTreasury.userId) {
        return {
          ...h,
          currentBalance: h.currentBalance - amount,
          lastUpdated: handoverData.date
        };
      }
      return h;
    });

    // Update Destination state
    if (isSupplyWallet) {
      if (setWallet) {
        setWallet((prev: any) => {
          const walletTx = {
            id: `TR-CUSTODY-${Date.now()}`,
            type: 'إيداع',
            amount,
            date: new Date().toISOString(),
            note: `توريد عهدة نقدية من الموظف/الشريك ${selectedHolderForTreasury.userName} إلى محفظة التوريد: ${treasuryNotes || ''}`,
            category: 'supply_funding',
            status: 'completed'
          };
          return {
            ...prev,
            supplyBalance: (prev.supplyBalance || 0) + amount,
            transactions: [walletTx, ...(prev.transactions || [])]
          };
        });
      }
    } else {
      // Update Treasury State
      if (setTreasury) {
        const treasuryTxId = `tx-custody-deposit-${Date.now()}`;
        setTreasury((prev: any) => {
          if (!prev) return prev;
          const currentAccounts = prev.accounts || [];
          const updatedAccounts = currentAccounts.map((acc: any) => 
            acc.id === selectedTreasuryAccountId ? { ...acc, balance: Number(acc.balance || 0) + amount } : acc
          );
          const treasuryTx: TreasuryTransaction = {
            id: treasuryTxId,
            date: new Date().toISOString(),
            type: 'deposit',
            amount,
            description: `توريد عهدة نقدية من الموظف: ${selectedHolderForTreasury.userName}`,
            toAccountId: selectedTreasuryAccountId,
            reference: handoverId
          };
          return {
            ...prev,
            accounts: updatedAccounts,
            transactions: [treasuryTx, ...(prev.transactions || [])]
          };
        });
      }
    }

    updateSettings({
      ...settings,
      cashHolders: updatedHolders,
      cashHandovers: [handoverData, ...handovers],
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          user: currentUser?.fullName || 'المدير',
          action: 'توريد عهدة للخزينة',
          details: `تم توريد مبلغ ${amount} ج.م من عهدة الموظف ${selectedHolderForTreasury.userName} إلى ${toUserName}`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    });

    setShowTreasuryModal(false);
    setSelectedHolderForTreasury(null);
    setTreasuryAmount(0);
    setTreasuryNotes('');
    alert(isSupplyWallet ? 'تم توريد مبلغ العهدة لمحفظة التوريد بنجاح' : 'تم توريد مبلغ العهدة للخزينة وتحديث المعاملات بنجاح');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
             <Handshake className="text-indigo-600" />
             إدارة العهد والمبالغ النقدية
           </h2>
           <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mt-1">تتبع الفلوس مع مين؟ (شركاء، مناديب، كاشيرية)</p>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setActiveTab('balances')}
             className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'balances' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
           >
             <UserCheck size={18} />
             العهد الحالية
           </button>
           <button 
             onClick={() => setActiveTab('handovers')}
             className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'handovers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
           >
             <History size={18} />
             سجل التسليمات
           </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'balances' ? (
          <motion.div 
            key="balances"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
             {holders.length === 0 ? (
                <div className="md:col-span-3 py-20 text-center glass-card rounded-3xl">
                   <Banknote size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                   <p className="text-slate-500 font-bold italic">لا يوجد عهد نقدية مسجلة حالياً</p>
                </div>
              ) : (
                holders.map(holder => (
                  <div key={holder.userId} className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group">
                     <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                           <User size={24} />
                        </div>
                        <div className="flex items-center gap-2">
                           {(true) && (
                             <button 
                               onClick={() => {
                                 setDialog({ isOpen: true, title: 'تأكيد الحذف', message: 'هل أنت متأكد؟', isWarning: true, onConfirm: () => { const updatedHolders = holders.filter(h => h.userId !== holder.userId); updateSettings({ ...settings, cashHolders: updatedHolders }); setDialog(null); } });
                                }}
                               className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-colors"
                               title="حذف العهدة"
                             >
                               <X size={16} />
                             </button>
                           )}
                           <div className="text-right">
                              <h4 className="font-black text-slate-800 dark:text-white">{holder.userName}</h4>
                              <span className="text-[10px] font-bold text-slate-400">آخر تحديث: {new Date(holder.lastUpdated).toLocaleDateString('ar-EG')}</span>
                           </div>
                        </div>
                     </div>
                     
                     <div className="flex items-end justify-between">
                        <div className="space-y-1">
                           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي المبلغ في العهدة</div>
                           <div className={`text-2xl font-black tabular-nums ${holder.currentBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {holder.currentBalance.toLocaleString()} <span className="text-xs">ج.م</span>
                           </div>
                        </div>
                        
                        {(currentUser?.isAdmin || currentUser?.id === holder.userId) && (
                          <div className="flex items-center gap-1.5">
                             <button 
                               onClick={() => {
                                 setSelectedHolderForTreasury(holder);
                                 setTreasuryAmount(holder.currentBalance > 0 ? holder.currentBalance : 0);
                                 setTreasuryNotes('');
                                 if (treasury?.accounts && treasury.accounts.length > 0) {
                                   setSelectedTreasuryAccountId(treasury.accounts[0].id);
                                 } else {
                                   setSelectedTreasuryAccountId('');
                                 }
                                 setShowTreasuryModal(true);
                               }}
                               className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/40 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1 transition-all"
                               title="تسليم المبلغ للخزينة وتصفية العهدة"
                             >
                               <Banknote size={15} />
                               <span className="hidden sm:inline">تسليم للخزينة</span>
                             </button>
                             <button 
                               onClick={() => {
                                 setNewHandover({
                                   fromUserId: holder.userId,
                                   toUserId: '',
                                   amount: holder.currentBalance > 0 ? holder.currentBalance : 0,
                                   notes: ''
                                 });
                                 setHandoverType('holder');
                                 setShowHandoverModal(true);
                               }}
                               className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/40 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center gap-1 transition-all"
                               title="تحويل العهدة لشخص آخر"
                             >
                               <ArrowRightLeft size={15} />
                               <span className="hidden sm:inline">تحويل لشخص</span>
                             </button>
                          </div>
                        )}
                     </div>
                  </div>
                ))
              )}
              
              {/* Quick Actions */}
              <div className="md:col-span-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                 <button 
                   onClick={() => {
                     setNewHandover({
                       fromUserId: currentUser?.id || 'admin',
                       toUserId: '',
                       amount: 0,
                       notes: ''
                     });
                     setHandoverType('holder');
                     setShowHandoverModal(true);
                   }}
                   className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3"
                 >
                   <Plus size={24} />
                   تسجيل تسليم مبلغ مالي (شريك/مندوب/كاشير)
                 </button>
              </div>
          </motion.div>
        ) : (
          <motion.div 
            key="handovers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
             {handovers.length === 0 ? (
                  <div className="py-20 text-center glass-card rounded-3xl">
                     <History size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                     <p className="text-slate-500 font-bold">لم يتم تسجيل عمليات تسليم نقدية بعد</p>
                  </div>
               ) : (
                 handovers.map(h => (
                   <div key={h.id} className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-right" dir="rtl">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                            <CheckCircle2 size={18} />
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                               <span className="font-black text-slate-800 dark:text-white">{h.fromUserName}</span>
                               <ArrowRightLeft size={12} className="text-slate-400 rotate-180" />
                               <span className="font-black text-indigo-600">{h.toUserName}</span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(h.date).toLocaleString('ar-EG')}</div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                         {h.notes && (
                           <div className="text-[10px] bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg text-slate-500 italic max-w-[200px] truncate">
                             "{h.notes}"
                           </div>
                         )}
                         <div className="text-lg font-black text-emerald-600 tabular-nums">
                            {h.amount.toLocaleString()} <span className="text-[10px]">ج.م</span>
                         </div>
                      </div>
                   </div>
                 ))
               )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handover Modal */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
           >
              <button 
                onClick={() => setShowHandoverModal(false)}
                className="absolute left-6 top-6 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 pr-8 text-right">تسليم أو تحويل مالي</h3>
              
              <div className="space-y-6 text-right" dir="rtl">
                  {/* Select Recipient Type */}
                  <div className="space-y-2">
                     <label className="text-xs font-black text-slate-500 uppercase mr-1 flex items-center gap-1.5 justify-end">
                       جهة تسليم المبلغ
                     </label>
                     <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setHandoverType('holder');
                            setNewHandover({ ...newHandover, toUserId: '' });
                          }}
                          className={`py-2 px-1.5 rounded-xl text-[10px] sm:text-xs font-black border transition-all ${handoverType === 'holder' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/15' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                          عهدة شخصية
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHandoverType('treasury');
                            setNewHandover({ ...newHandover, toUserId: treasury?.accounts?.[0]?.id || '' });
                          }}
                          className={`py-2 px-1.5 rounded-xl text-[10px] sm:text-xs font-black border transition-all ${handoverType === 'treasury' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/15' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                          خزينة بالمنظومة
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHandoverType('supply_wallet');
                            setNewHandover({ ...newHandover, toUserId: 'supply_wallet' });
                          }}
                          className={`py-2 px-1.5 rounded-xl text-[10px] sm:text-xs font-black border transition-all ${handoverType === 'supply_wallet' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/15' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                          محفظة التوريد
                        </button>
                     </div>
                  </div>

                  {currentUser?.isAdmin && (
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-500 uppercase mr-1">المسلِّم (صاحب العهدة)</label>
                       <select 
                         value={newHandover.fromUserId || (currentUser?.id || 'admin')}
                         onChange={(e) => setNewHandover({...newHandover, fromUserId: e.target.value})}
                         className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-12 px-4 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 text-right"
                       >
                         {allPossibleHolders.map((h, index) => (
                           <option key={'from_' + h.id + index} value={h.id}>{h.name} ({h.role})</option>
                         ))}
                       </select>
                    </div>
                  )}

                  {handoverType !== 'supply_wallet' && (
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-500 uppercase mr-1">
                          {handoverType === 'treasury' ? 'الخزينة المستلمة' : 'المستلم'}
                       </label>
                       <select 
                         value={newHandover.toUserId}
                         onChange={(e) => setNewHandover({...newHandover, toUserId: e.target.value})}
                         className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-12 px-4 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 text-right"
                       >
                         {handoverType === 'treasury' ? (
                           <>
                             <option value="">-- اختر خزينة الإيداع --</option>
                             {(treasury?.accounts || []).map((acc: any) => (
                               <option key={'treasury_acc_' + acc.id} value={acc.id}>
                                 {acc.name} (الرصيد: {acc.balance.toLocaleString()} ج.م)
                               </option>
                             ))}
                           </>
                         ) : (
                           <>
                             <option value="">-- اختر المستلم --</option>
                             {allPossibleHolders.map((h, index) => (
                               <option key={'to_' + h.id + index} value={h.id}>{h.name} ({h.role})</option>
                             ))}
                           </>
                         )}
                       </select>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                     <label className="text-xs font-black text-slate-500 uppercase mr-1">المبلغ المراد تسليمه</label>
                     <div className="relative">
                        <input 
                          type="number"
                          value={newHandover.amount || ''}
                          onChange={(e) => setNewHandover({...newHandover, amount: Number(e.target.value)})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-12 pl-12 pr-4 rounded-xl font-black text-lg outline-none text-right focus:ring-4 focus:ring-emerald-500/10"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ج.م</span>
                     </div>
                  </div>
                  
                  <div className="space-y-2">
                     <label className="text-xs font-black text-slate-500 uppercase mr-1">ملاحظات</label>
                     <textarea 
                       placeholder="مثلاً: توريد يومية المخزن، عهدة مصاريف..."
                       value={newHandover.notes}
                       onChange={(e) => setNewHandover({...newHandover, notes: e.target.value})}
                       rows={2}
                       className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl font-bold text-sm outline-none text-right focus:ring-4 focus:ring-indigo-500/10 resize-none"
                     />
                  </div>
                  
                  <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
                     <div className="flex-1 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex gap-3 text-amber-700 dark:text-amber-400">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold leading-relaxed text-right">تنبيه: سيتم خصم هذا المبلغ من عهدة الطرف المسلم وتضاف لعهدة الطرف المستلم فور الضغط على تأكيد.</p>
                     </div>
                     <button 
                       onClick={handleExecuteHandover}
                       className="bg-emerald-600 text-white w-full sm:w-auto px-8 py-4 rounded-2xl font-black shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
                     >
                       تأكيد التسليم
                     </button>
                  </div>
              </div>
           </motion.div>
        </div>
      )}

      {/* Global Dialog */}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-slate-900 max-w-sm w-full rounded-3xl p-6 shadow-2xl relative text-center border border-slate-200 dark:border-slate-800"
            >
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${dialog.isWarning ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {dialog.isWarning ? <AlertTriangle size={32} /> : <Info size={32} />}
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">{dialog.title}</h3>
                <p className="text-slate-500 font-bold text-sm mb-6 leading-relaxed">{dialog.message}</p>
                
                <div className="flex gap-3">
                    <button 
                        onClick={() => setDialog(null)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                    >
                        إلغاء
                    </button>
                    <button 
                        onClick={dialog.onConfirm}
                        className={`flex-1 py-3 text-white rounded-xl font-bold transition-all shadow-lg ${dialog.isWarning ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'}`}
                    >
                        تأكيد
                    </button>
                </div>
            </motion.div>
        </div>
      )}

      {/* Treasury Settlement Modal */}
      {showTreasuryModal && selectedHolderForTreasury && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in fade-in-50 zoom-in-95 duration-200"
           >
              <button 
                onClick={() => {
                  setShowTreasuryModal(false);
                  setSelectedHolderForTreasury(null);
                }}
                className="absolute left-6 top-6 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 pr-8 text-right">تسليم عهدة للخزينة</h3>
              <p className="text-slate-400 text-xs font-bold mb-6 text-right">تسوية وتوريد الرصيد النقدي للموظف {selectedHolderForTreasury.userName} إلى حساب مالي</p>
              
              <div className="space-y-6 text-right" dir="rtl">
                 <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase mr-1">الحساب المالي المستلم (الخزينة/البنك/المحفظة)</label>
                    <select 
                      value={selectedTreasuryAccountId}
                      onChange={(e) => setSelectedTreasuryAccountId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-12 px-4 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 text-right"
                    >
                      <option value="">-- اختر الحساب المالي --</option>
                      <option value="supply_wallet">محفظة التوريد (رأس مال المخزون) - رصيد: {Number(wallet?.supplyBalance || 0).toLocaleString()} ج.م</option>
                      {(treasury?.accounts || []).map((acc: any) => (
                        <option key={acc.id} value={acc.id}>{acc.name} (رصيد: {Number(acc.balance || 0).toLocaleString()} ج.م)</option>
                      ))}
                    </select>
                 </div>
                 
                 <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <button 
                        type="button" 
                        onClick={() => setTreasuryAmount(selectedHolderForTreasury.currentBalance)}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        توريد كل العهدة ({selectedHolderForTreasury.currentBalance.toLocaleString()} ج.م)
                      </button>
                      <label className="text-xs font-black text-slate-500 uppercase">المبلغ المراد توريده</label>
                    </div>
                    <div className="relative">
                       <input 
                         type="number"
                         value={treasuryAmount || ''}
                         onChange={(e) => setTreasuryAmount(Number(e.target.value))}
                         className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-12 pl-12 pr-4 rounded-xl font-black text-lg outline-none text-right focus:ring-4 focus:ring-emerald-500/10"
                       />
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ج.م</span>
                    </div>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase mr-1">ملاحظات التوريد</label>
                    <textarea 
                      placeholder="مثلاً: توريد جزئي للعهدة، تصفية حساب يومية..."
                      value={treasuryNotes}
                      onChange={(e) => setTreasuryNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl font-bold text-sm outline-none text-right focus:ring-4 focus:ring-indigo-500/10 resize-none"
                    />
                 </div>
                 
                 <div className="pt-4 flex items-center justify-between gap-3">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex gap-3 text-indigo-700 dark:text-indigo-400 w-full">
                       <AlertCircle size={18} className="shrink-0 mt-0.5" />
                       <p className="text-[10px] font-bold leading-relaxed text-right">سيتم خصم المبلغ من عهدة {selectedHolderForTreasury.userName} وإضافته في رصيد حساب الخزينة المختار فور التأكيد.</p>
                    </div>
                 </div>

                 <div className="flex gap-3 justify-end pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowTreasuryModal(false);
                        setSelectedHolderForTreasury(null);
                      }}
                      className="border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      إلغاء
                    </button>
                    <button 
                      type="button"
                      onClick={handleExecuteTreasuryDeposit}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      تأكيد التوريد
                    </button>
                 </div>
              </div>
           </motion.div>
        </div>
      )}
    </div>
  );
};

export default CashManagement;
