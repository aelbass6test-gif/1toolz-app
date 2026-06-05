
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
  X
} from 'lucide-react';
import { Settings, CashHolder, CashHandover } from '../types';

interface CashManagementProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  currentUser: any;
}

const CashManagement: React.FC<CashManagementProps> = ({ settings, updateSettings, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'balances' | 'handovers'>('balances');
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState<CashHandover | null>(null);

  // New Handover Form
  const [newHandover, setNewHandover] = useState({
    toUserId: '',
    amount: 0,
    notes: ''
  });

  const holders = settings.cashHolders || [];
  const handovers = settings.cashHandovers || [];
  const employees = settings.employees || [];
  
  // Combine currentUser and employees for selection
  const allPossibleHolders = [
    { id: 'admin', name: 'المدير (أنت)', role: 'admin' },
    ...employees.map(e => ({ id: `emp_${e.id}`, name: e.name, role: 'employee' })),
    ...(settings.partners || []).map(p => ({ id: `part_${p.id}`, name: p.name, role: 'partner' }))
  ];

  const handleExecuteHandover = () => {
    if (!newHandover.toUserId) return alert('يرجى اختيار المستلم');
    if (newHandover.amount <= 0) return alert('يرجى تحديد المبلغ');

    const amount = Number(newHandover.amount);
    const toUser = allPossibleHolders.find(h => h.id === newHandover.toUserId);
    
    // Determine source (current user)
    const fromUserName = currentUser?.fullName || 'المدير';
    const fromUserId = currentUser?.id || 'admin';

    const handoverId = `HND-${Date.now()}`;
    const handoverData: CashHandover = {
      id: handoverId,
      fromUserId,
      fromUserName,
      toUserId: newHandover.toUserId,
      toUserName: toUser?.name || 'مستخدم غير معروف',
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

    // Increase to destination
    const toIdx = updatedHolders.findIndex(h => h.userId === handoverData.toUserId);
    if (toIdx > -1) {
      updatedHolders[toIdx].currentBalance += amount;
      updatedHolders[toIdx].lastUpdated = handoverData.date;
    } else {
      updatedHolders.push({ userId: handoverData.toUserId, userName: handoverData.toUserName, currentBalance: amount, lastUpdated: handoverData.date });
    }

    updateSettings({
      ...settings,
      cashHolders: updatedHolders,
      cashHandovers: [handoverData, ...handovers],
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          user: fromUserName,
          action: 'تسليم نقدية',
          details: `تسليم مبلغ ${amount} ج.م إلى ${handoverData.toUserName}`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    });

    setShowHandoverModal(false);
    setNewHandover({ toUserId: '', amount: 0, notes: '' });
    alert('تم تسجيل عملية التسليم وتحديث العهد بنجاح');
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
                       <div className="text-right">
                          <h4 className="font-black text-slate-800 dark:text-white">{holder.userName}</h4>
                          <span className="text-[10px] font-bold text-slate-400">آخر تحديث: {new Date(holder.lastUpdated).toLocaleDateString('ar-EG')}</span>
                       </div>
                    </div>
                    
                    <div className="flex items-end justify-between">
                       <div className="space-y-1">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي المبلغ في العهدة</div>
                          <div className={`text-2xl font-black tabular-nums ${holder.currentBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {holder.currentBalance} <span className="text-xs">ج.م</span>
                          </div>
                       </div>
                       
                       {(currentUser?.isAdmin || currentUser?.id === holder.userId) && (
                         <button 
                           onClick={() => {
                             setShowHandoverModal(true);
                             setNewHandover(p => ({ ...p, fromUserId: holder.userId }));
                           }}
                           className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                           title="تسليم عهدة لشخص آخر"
                         >
                           <ArrowRightLeft size={18} />
                         </button>
                       )}
                    </div>
                 </div>
               ))
             )}
             
             {/* Quick Actions */}
             <div className="md:col-span-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                <button 
                  onClick={() => setShowHandoverModal(true)}
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
                 <div key={h.id} className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <CheckCircle2 size={18} />
                       </div>
                       <div>
                          <div className="flex items-center gap-2">
                             <span className="font-black text-slate-800 dark:text-white">{h.fromUserName}</span>
                             <ArrowRightLeft size={12} className="text-slate-400" />
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
                          {h.amount} <span className="text-[10px]">ج.م</span>
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
              
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 pr-8">تسليم مبلغ عهدة</h3>
              
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase mr-1">المستلم</label>
                    <select 
                      value={newHandover.toUserId}
                      onChange={(e) => setNewHandover({...newHandover, toUserId: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-12 px-4 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                    >
                      <option value="">-- اختر المستلم --</option>
                      {allPossibleHolders.map(h => (
                        <option key={h.id} value={h.id}>{h.name} ({h.role})</option>
                      ))}
                    </select>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase mr-1">المبلغ المراد تسليمه</label>
                    <div className="relative">
                       <input 
                         type="number"
                         value={newHandover.amount}
                         onChange={(e) => setNewHandover({...newHandover, amount: Number(e.target.value)})}
                         className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-12 pl-12 pr-4 rounded-xl font-black text-lg outline-none focus:ring-4 focus:ring-emerald-500/10"
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
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 resize-none"
                    />
                 </div>
                 
                 <div className="pt-4 flex items-center gap-3">
                    <div className="flex-1 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex gap-3 text-amber-700 dark:text-amber-400">
                       <AlertCircle size={18} className="shrink-0 mt-0.5" />
                       <p className="text-[10px] font-bold leading-relaxed">تنبيه: سيتم خصم هذا المبلغ من عهدتك وتضاف لعهدة الطرف الآخر فور الضغط على تأكيد.</p>
                    </div>
                    <button 
                      onClick={handleExecuteHandover}
                      className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      تأكيد التسليم
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
