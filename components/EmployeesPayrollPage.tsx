import React, { useState, useMemo, useEffect } from 'react';
import { Settings, StaffMember, PayrollTransaction, Wallet, Treasury, Transaction, TransactionCategory } from '../types';
import { 
  Users, UserPlus, DollarSign, TrendingUp, TrendingDown, 
  History, Calendar, Plus, Trash2, Edit2, CheckCircle2, 
  AlertCircle, Search, Filter, ArrowRightLeft, Landmark, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmployeesPayrollPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  treasury?: Treasury;
  setTreasury?: React.Dispatch<React.SetStateAction<Treasury | undefined>>;
}

const EmployeesPayrollPage: React.FC<EmployeesPayrollPageProps> = ({ 
  settings, 
  setSettings, 
  wallet, 
  setWallet, 
  treasury, 
  setTreasury 
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'history'>('staff');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  // Payroll stats
  const stats = useMemo(() => {
    const transactions = settings.payrollTransactions || [];
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const monthTxs = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const totalSalaries = monthTxs.filter(t => t.type === 'salary').reduce((sum, t) => sum + t.amount, 0);
    const totalIncentives = monthTxs.filter(t => t.type === 'incentive').reduce((sum, t) => sum + t.amount, 0);
    const totalDeductions = monthTxs.filter(t => t.type === 'deduction').reduce((sum, t) => sum + t.amount, 0);

    return { totalSalaries, totalIncentives, totalDeductions };
  }, [settings.payrollTransactions]);

  const filteredStaff = useMemo(() => {
    const staff = settings.staffMembers || [];
    if (!searchQuery) return staff;
    return staff.filter(s => 
      s.name.includes(searchQuery) || 
      s.phone.includes(searchQuery) || 
      s.position.includes(searchQuery)
    );
  }, [settings.staffMembers, searchQuery]);

  const sortedHistory = useMemo(() => {
    const history = settings.payrollTransactions || [];
    return [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [settings.payrollTransactions]);

  const handleAddStaff = (staff: Omit<StaffMember, 'id'>) => {
    const newStaff: StaffMember = {
      ...staff,
      id: `staff-${Date.now()}`
    };
    setSettings(prev => ({
      ...prev,
      staffMembers: [...(prev.staffMembers || []), newStaff]
    }));
    setShowAddStaffModal(false);
  };

  const handleUpdateStaff = (staff: StaffMember) => {
    setSettings(prev => ({
      ...prev,
      staffMembers: (prev.staffMembers || []).map(s => s.id === staff.id ? staff : s)
    }));
    setEditingStaff(null);
  };

  const handleDeleteStaff = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
      setSettings(prev => ({
        ...prev,
        staffMembers: (prev.staffMembers || []).filter(s => s.id !== id)
      }));
    }
  };

  const handleRecordPayment = (payment: Omit<PayrollTransaction, 'id' | 'staffName'>) => {
    const staff = settings.staffMembers?.find(s => s.id === payment.staffId);
    if (!staff) return;

    const paymentId = `pay-${Date.now()}`;
    const newPayment: PayrollTransaction = {
      ...payment,
      id: paymentId,
      staffName: staff.name
    };

    const category = payment.type === 'deduction' ? 'expense_other' : 'expense_salary';
    const amountLabel = payment.type === 'salary' ? 'راتب' : payment.type === 'incentive' ? 'حافز' : 'خصم';

    // 1. Handle Treasury Deduction if selected
    if (payment.treasuryAccountId && setTreasury) {
      const treasuryTx = {
        id: `staff-treasury-tx-${Date.now()}`,
        date: payment.date,
        type: 'withdrawal' as const,
        amount: payment.amount,
        description: `${amountLabel} - ${staff.name} ${payment.note ? `(${payment.note})` : ''}`,
        fromAccountId: payment.treasuryAccountId
      };

      setTreasury((prev: Treasury) => ({
        ...prev,
        accounts: prev.accounts.map(acc => 
          acc.id === payment.treasuryAccountId ? { ...acc, balance: acc.balance - payment.amount } : acc
        ),
        transactions: [treasuryTx, ...(prev.transactions || [])]
      }));
    } else {
      // Deduct from Wallet if no treasury account selected
      setWallet(prev => ({
        ...prev,
        balance: prev.balance - payment.amount,
        transactions: [{
          id: `staff-wallet-tx-${Date.now()}`,
          type: 'سحب',
          amount: payment.amount,
          date: payment.date,
          note: `${amountLabel} - ${staff.name} ${payment.note ? `(${payment.note})` : ''}`,
          category: category as any,
          status: 'completed'
        }, ...prev.transactions]
      }));
    }

    // 2. Update Settings History
    setSettings(prev => ({
      ...prev,
      payrollTransactions: [...(prev.payrollTransactions || []), newPayment]
    }));

    setShowPaymentModal(false);
    setSelectedStaff(null);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 text-right" dir="rtl">
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="text-indigo-600" /> إدارة شؤون الموظفين والرواتب
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">إدارة بيانات الموظفين، الرواتب، الحوافز، والخصومات الشهرية.</p>
        </div>
        <button 
          onClick={() => setShowAddStaffModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <UserPlus size={20} /> إضافة موظف جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="إجمالي الرواتب (هذا الشهر)" 
          value={stats.totalSalaries} 
          icon={<DollarSign size={24} />} 
          color="indigo" 
        />
        <StatCard 
          title="إجمالي الحوافز (هذا الشهر)" 
          value={stats.totalIncentives} 
          icon={<TrendingUp size={24} />} 
          color="emerald" 
        />
        <StatCard 
          title="إجمالي الخصومات (هذا الشهر)" 
          value={stats.totalDeductions} 
          icon={<TrendingDown size={24} />} 
          color="rose" 
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'staff' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={18} /> قائمة الموظفين
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <History size={18} /> سجل المدفوعات
        </button>
      </div>

      {activeTab === 'staff' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="البحث عن موظف بالاسم، الرقم، أو الوظيفة..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">الموظف</th>
                    <th className="px-6 py-4">المسمى الوظيفي</th>
                    <th className="px-6 py-4">الراتب الأساسي</th>
                    <th className="px-6 py-4">تاريخ الانضمام</th>
                    <th className="px-6 py-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStaff.length > 0 ? filteredStaff.map(staff => (
                    <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-white">{staff.name}</div>
                            <div className="text-xs text-slate-500 font-mono" dir="ltr">{staff.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          {staff.position}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">
                          {staff.baseSalary.toLocaleString()} <span className="text-[10px]">ج.م</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(staff.joinDate).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setSelectedStaff(staff); setShowPaymentModal(true); }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                            title="صرف راتب / حافز / خصم"
                          >
                            <DollarSign size={18} />
                          </button>
                          <button 
                            onClick={() => setEditingStaff(staff)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                            title="تعديل البيانات"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStaff(staff.id)}
                            className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Users size={48} className="opacity-20" />
                          <p>لا يوجد موظفين مسجلين حالياً.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">التاريخ</th>
                  <th className="px-6 py-4">الموظف</th>
                  <th className="px-6 py-4">النوع</th>
                  <th className="px-6 py-4">المبلغ</th>
                  <th className="px-6 py-4">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedHistory.length > 0 ? sortedHistory.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                      {new Date(tx.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                      {tx.staffName}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${
                        tx.type === 'salary' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        tx.type === 'incentive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                      }`}>
                        {tx.type === 'salary' ? 'راتب' : tx.type === 'incentive' ? 'حافز' : 'خصم'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold ${tx.type === 'deduction' ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>
                        {tx.type === 'deduction' ? '-' : ''}{tx.amount.toLocaleString()} <span className="text-[10px]">ج.م</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {tx.note || '-'}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <History size={48} className="opacity-20" />
                        <p>لا يوجد سجل مدفوعات حالياً.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showAddStaffModal || editingStaff) && (
          <StaffModal 
            staff={editingStaff || undefined}
            onClose={() => { setShowAddStaffModal(false); setEditingStaff(null); }}
            onSave={(data) => editingStaff ? handleUpdateStaff({ ...editingStaff, ...data }) : handleAddStaff(data)}
          />
        )}
        {showPaymentModal && selectedStaff && (
          <PaymentModal 
            staff={selectedStaff}
            treasury={treasury}
            onClose={() => { setShowPaymentModal(false); setSelectedStaff(null); }}
            onSave={handleRecordPayment}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-components ---

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: 'indigo' | 'emerald' | 'rose' }> = ({ title, value, icon, color }) => {
  const colors = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30',
  };

  return (
    <div className={`p-6 rounded-2xl border ${colors[color]} shadow-sm`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-wider opacity-60">ملخص شهري</span>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">{title}</h3>
        <p className="text-2xl font-black">{value.toLocaleString()} <span className="text-xs">ج.م</span></p>
      </div>
    </div>
  );
};

const StaffModal: React.FC<{ staff?: StaffMember; onClose: () => void; onSave: (data: Omit<StaffMember, 'id'>) => void }> = ({ staff, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: staff?.name || '',
    phone: staff?.phone || '',
    email: staff?.email || '',
    position: staff?.position || '',
    baseSalary: staff?.baseSalary || 0,
    joinDate: staff?.joinDate ? new Date(staff.joinDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    active: staff?.active ?? true,
    notes: staff?.notes || ''
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden text-right border border-slate-200 dark:border-slate-800"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <UserPlus size={24} className="text-indigo-600" /> {staff ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Trash2 size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">الاسم الكامل</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="أحمد علي..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">رقم الهاتف</label>
              <input 
                type="tel" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">المسمى الوظيفي</label>
              <input 
                type="text" 
                value={formData.position} 
                onChange={e => setFormData({...formData, position: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="مثلاً: خدمة عملاء، مندوب..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">الراتب الأساسي</label>
              <input 
                type="number" 
                value={formData.baseSalary} 
                onChange={e => setFormData({...formData, baseSalary: Number(e.target.value)})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">تاريخ التعيين</label>
              <input 
                type="date" 
                value={formData.joinDate} 
                onChange={e => setFormData({...formData, joinDate: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات إضافية</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors">إلغاء</button>
          <button 
            onClick={() => onSave(formData)}
            className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all"
          >
            {staff ? 'حفظ التعديلات' : 'إضافة الموظف'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PaymentModal: React.FC<{ staff: StaffMember; treasury?: Treasury; onClose: () => void; onSave: (data: Omit<PayrollTransaction, 'id' | 'staffName'>) => void }> = ({ staff, treasury, onClose, onSave }) => {
  const [type, setType] = useState<'salary' | 'incentive' | 'deduction'>('salary');
  const [amount, setAmount] = useState(type === 'salary' ? staff.baseSalary : 0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [treasuryAccountId, setTreasuryAccountId] = useState<string>('');
  const [paymentSource, setPaymentSource] = useState<'wallet' | 'treasury'>('wallet');

  // Auto-adjust amount when switching to salary
  React.useEffect(() => {
    if (type === 'salary') setAmount(staff.baseSalary);
  }, [type, staff.baseSalary]);

  useEffect(() => {
    if (treasury?.accounts && treasury.accounts.length > 0 && !treasuryAccountId) {
      setTreasuryAccountId(treasury.accounts[0].id);
    }
  }, [treasury, treasuryAccountId]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-right border border-slate-200 dark:border-slate-800"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white">صرف مستحقات مالية</h2>
            <p className="text-xs text-indigo-600 font-bold mt-0.5">للموظف: {staff.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Plus size={20} className="text-slate-400 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {(['salary', 'incentive', 'deduction'] as const).map(t => (
              <button 
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${type === t ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
              >
                {t === 'salary' ? 'راتب' : t === 'incentive' ? 'حافز' : 'خصم'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">مصدر الصرف</label>
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button 
                  type="button"
                  onClick={() => setPaymentSource('wallet')}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${paymentSource === 'wallet' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  المحفظة العامة
                </button>
                <button 
                  type="button"
                  onClick={() => setPaymentSource('treasury')}
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${paymentSource === 'treasury' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  الخزينة / العهدة
                </button>
              </div>
            </div>

            {paymentSource === 'treasury' && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">اختر الحساب</label>
                <select 
                  value={treasuryAccountId}
                  onChange={e => setTreasuryAccountId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                >
                  {treasury?.accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">المبلغ المستحق</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-4 px-4 outline-none focus:ring-2 focus:ring-indigo-500 text-2xl font-black text-center"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">ج.م</span>
              </div>
              {type === 'salary' && amount !== staff.baseSalary && (
                <p className="text-[10px] text-amber-600 font-bold mt-1">* المبلغ يختلف عن الراتب الأساسي المسجل ({staff.baseSalary} ج.م)</p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">تاريخ العملية</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات (اختياري)</label>
              <input 
                type="text" 
                value={note} 
                onChange={e => setNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="مثلاً: راتب شهر يونيو..."
              />
            </div>
          </div>

          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-indigo-600 mt-0.5" />
              <p className="text-[11px] text-indigo-700 dark:text-indigo-400 leading-relaxed font-medium">
                بمجرد التأكيد، سيتم خصم المبلغ من **{paymentSource === 'wallet' ? 'رصيد المحفظة' : 'الحساب المختار'}** وتسجيله تلقائياً في قائمة **المصروفات**.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors">إلغاء</button>
          <button 
            onClick={() => onSave({ staffId: staff.id, type, amount, date, note, treasuryAccountId: paymentSource === 'treasury' ? treasuryAccountId : undefined })}
            className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all"
          >
            تأكيد العملية
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EmployeesPayrollPage;
