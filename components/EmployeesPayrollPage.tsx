import React, { useState, useMemo, useEffect } from 'react';
import { Settings, StaffMember, PayrollTransaction, Wallet, Treasury } from '../types';
import { 
  Users, UserPlus, DollarSign, TrendingUp, TrendingDown, 
  History, Calendar, Plus, Trash2, Edit2, CheckCircle2, 
  AlertCircle, Search, Filter, Landmark, User, FileText, 
  Download, Printer, Eye, Briefcase, Phone, Mail, Award, 
  LayoutGrid, List, RefreshCw, FileSpreadsheet, Check, X, ShieldAlert
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
  const [activeTab, setActiveTab] = useState<'staff' | 'history' | 'report'>('staff');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [showEditTxModal, setShowEditTxModal] = useState(false);
  
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editingTx, setEditingTx] = useState<PayrollTransaction | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Monthly statistics
  const stats = useMemo(() => {
    const transactions = settings.payrollTransactions || [];
    const [year, month] = selectedMonth.split('-').map(Number);

    const monthTxs = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month - 1 && d.getFullYear() === year;
    });

    const totalSalaries = monthTxs.filter(t => t.type === 'salary').reduce((sum, t) => sum + t.amount, 0);
    const totalIncentives = monthTxs.filter(t => t.type === 'incentive').reduce((sum, t) => sum + t.amount, 0);
    const totalDeductions = monthTxs.filter(t => t.type === 'deduction').reduce((sum, t) => sum + t.amount, 0);
    
    const staffList = settings.staffMembers || [];
    const totalBaseBudget = staffList.filter(s => s.active).reduce((sum, s) => sum + (s.baseSalary || 0), 0);

    return { totalSalaries, totalIncentives, totalDeductions, totalBaseBudget };
  }, [settings.payrollTransactions, settings.staffMembers, selectedMonth]);

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
    let list = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (filterType !== 'all') {
      list = list.filter(t => t.type === filterType);
    }
    if (searchQuery) {
      list = list.filter(t => t.staffName.includes(searchQuery) || (t.note && t.note.includes(searchQuery)));
    }
    return list;
  }, [settings.payrollTransactions, filterType, searchQuery]);

  // Calculate staff finances for the selected month
  const getStaffMonthlySummary = (staffId: string) => {
    const transactions = settings.payrollTransactions || [];
    const [year, month] = selectedMonth.split('-').map(Number);
    
    const staffTxs = transactions.filter(t => {
      const d = new Date(t.date);
      return t.staffId === staffId && d.getMonth() === month - 1 && d.getFullYear() === year;
    });

    const paidSalaries = staffTxs.filter(t => t.type === 'salary').reduce((s, t) => s + t.amount, 0);
    const incentives = staffTxs.filter(t => t.type === 'incentive').reduce((s, t) => s + t.amount, 0);
    const deductions = staffTxs.filter(t => t.type === 'deduction').reduce((s, t) => s + t.amount, 0);
    
    const staff = settings.staffMembers?.find(s => s.id === staffId);
    const base = staff?.baseSalary || 0;
    const netPayable = base + incentives - deductions;
    const remaining = Math.max(0, netPayable - paidSalaries);

    return { base, paidSalaries, incentives, deductions, netPayable, remaining, staffTxs };
  };

  // --- Financial Impact Helpers ---
  const revertFinancialImpact = (tx: PayrollTransaction) => {
    if (tx.type === 'deduction') return; // Deductions don't withdraw money

    const refundAmount = tx.amount;
    const refundNote = `استرداد عملية ملغاة/معدلة (${tx.type === 'salary' ? 'راتب' : 'حافز'}) - ${tx.staffName}`;
    const today = new Date().toISOString().split('T')[0];

    if (tx.treasuryAccountId && setTreasury) {
      setTreasury((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.map((acc: any) => 
            acc.id === tx.treasuryAccountId ? { ...acc, balance: (acc.balance || 0) + refundAmount } : acc
          ),
          transactions: [
            {
              id: `treasury-refund-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              date: today,
              type: 'deposit',
              amount: refundAmount,
              description: refundNote,
              toAccountId: tx.treasuryAccountId
            },
            ...(prev.transactions || [])
          ]
        };
      });
    } else {
      setWallet((prev: any) => ({
        ...prev,
        balance: (prev.balance || 0) + refundAmount,
        transactions: [
          {
            id: `wallet-refund-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'إيداع',
            amount: refundAmount,
            date: today,
            note: refundNote,
            category: 'manual_deposit',
            status: 'completed'
          },
          ...(prev.transactions || [])
        ]
      }));
    }
  };

  const applyFinancialImpact = (tx: Omit<PayrollTransaction, 'id' | 'staffName'>, staffName: string) => {
    if (tx.type === 'deduction') return; // Deductions don't withdraw money

    const amountLabel = tx.type === 'salary' ? 'راتب' : 'حافز';
    const desc = `${amountLabel} - ${staffName} ${tx.note ? `(${tx.note})` : ''}`;
    const today = tx.date || new Date().toISOString().split('T')[0];

    if (tx.treasuryAccountId && setTreasury) {
      setTreasury((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.map((acc: any) => 
            acc.id === tx.treasuryAccountId ? { ...acc, balance: (acc.balance || 0) - tx.amount } : acc
          ),
          transactions: [
            {
              id: `treasury-pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              date: today,
              type: 'withdrawal',
              amount: tx.amount,
              description: desc,
              fromAccountId: tx.treasuryAccountId
            },
            ...(prev.transactions || [])
          ]
        };
      });
    } else {
      setWallet((prev: any) => ({
        ...prev,
        balance: (prev.balance || 0) - tx.amount,
        transactions: [
          {
            id: `wallet-pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            type: 'سحب',
            amount: tx.amount,
            date: today,
            note: desc,
            category: 'expense_salary',
            status: 'completed'
          },
          ...(prev.transactions || [])
        ]
      }));
    }
  };

  // --- Handlers ---
  const handleAddStaff = (staff: Omit<StaffMember, 'id'>) => {
    const newStaff: StaffMember = { ...staff, id: `staff-${Date.now()}` };
    setSettings(prev => ({ ...prev, staffMembers: [...(prev.staffMembers || []), newStaff] }));
    setShowAddStaffModal(false);
    showToast(`تمت إضافة الموظف ${staff.name} بنجاح`);
  };

  const handleUpdateStaff = (staff: StaffMember) => {
    setSettings(prev => ({
      ...prev,
      staffMembers: (prev.staffMembers || []).map(s => s.id === staff.id ? staff : s)
    }));
    setEditingStaff(null);
    showToast(`تم تحديث بيانات ${staff.name} بنجاح`);
  };

  const handleDeleteStaff = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
      setSettings(prev => ({
        ...prev,
        staffMembers: (prev.staffMembers || []).filter(s => s.id !== id)
      }));
      showToast('تم حذف الموظف من القائمة', 'info');
    }
  };

  const handleRecordPayment = (payment: Omit<PayrollTransaction, 'id' | 'staffName'>) => {
    const staff = settings.staffMembers?.find(s => s.id === payment.staffId);
    if (!staff) return;

    const paymentId = `pay-${Date.now()}`;
    const newPayment: PayrollTransaction = { ...payment, id: paymentId, staffName: staff.name };

    // Apply financial impact (withdraws cash if salary or incentive)
    applyFinancialImpact(payment, staff.name);

    setSettings(prev => ({
      ...prev,
      payrollTransactions: [...(prev.payrollTransactions || []), newPayment]
    }));

    setShowPaymentModal(false);
    setSelectedStaff(null);
    showToast(`تم تسجيل ${payment.type === 'salary' ? 'صرف راتب' : payment.type === 'incentive' ? 'صرف حافز' : 'خصم'} بقيمة ${payment.amount.toLocaleString()} ج.م للموظف ${staff.name}`);
  };

  const handleDeleteTransaction = (tx: PayrollTransaction) => {
    const sourceName = tx.treasuryAccountId ? 'الخزينة المختارة' : 'المحفظة العامة';
    const msg = tx.type === 'deduction'
      ? `هل أنت متأكد من حذف سجل الخصم للموظف ${tx.staffName}؟`
      : `هل أنت متأكد من حذف هذه العملية؟\nسيتم استرداد مبلغ (${tx.amount.toLocaleString()} ج.م) وإعادته تلقائياً إلى رصيد [ ${sourceName} ].`;

    if (window.confirm(msg)) {
      // Revert financial impact
      revertFinancialImpact(tx);

      // Remove from history
      setSettings(prev => ({
        ...prev,
        payrollTransactions: (prev.payrollTransactions || []).filter(t => t.id !== tx.id)
      }));

      showToast(`✅ تم حذف السجل بنجاح وإعادة المبلغ (${tx.amount.toLocaleString()} ج.م) إلى مكانه.`, 'success');
    }
  };

  const handleUpdateTransaction = (updatedData: Omit<PayrollTransaction, 'id' | 'staffName'>) => {
    if (!editingTx) return;

    // 1. Revert old transaction financial impact
    revertFinancialImpact(editingTx);

    // 2. Apply new transaction financial impact
    applyFinancialImpact(updatedData, editingTx.staffName);

    // 3. Update record in state
    const updatedTx: PayrollTransaction = {
      ...updatedData,
      id: editingTx.id,
      staffName: editingTx.staffName
    };

    setSettings(prev => ({
      ...prev,
      payrollTransactions: (prev.payrollTransactions || []).map(t => t.id === editingTx.id ? updatedTx : t)
    }));

    setShowEditTxModal(false);
    setEditingTx(null);
    showToast('✅ تم تعديل سجل الصرف وتسوية الأرصدة المالية تلقائياً.', 'success');
  };

  const exportToCSV = () => {
    const transactions = sortedHistory;
    if (transactions.length === 0) {
      showToast('لا توجد بيانات للتصدير', 'error');
      return;
    }
    const headers = ['التاريخ', 'الموظف', 'النوع', 'المبلغ', 'مصدر الصرف', 'ملاحظات'];
    const rows = transactions.map(tx => [
      tx.date,
      tx.staffName,
      tx.type === 'salary' ? 'راتب' : tx.type === 'incentive' ? 'حافز' : 'خصم',
      tx.amount,
      tx.treasuryAccountId ? 'خزينة / عهدة' : 'المحفظة العامة',
      tx.note || ''
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll-report-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير التقرير بصيغة CSV بنجاح');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 text-right" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 left-6 z-[300] px-6 py-3.5 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 border ${
              toast.type === 'error' 
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/30' :
              toast.type === 'info'
                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30' :
                'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/30'
            }`}
          >
            <CheckCircle2 size={20} />
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="opacity-80 hover:opacity-100 mr-2"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Users size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black">إدارة شؤون الموظفين والرواتب</h1>
                <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">الإصدار الذكي 2.0</span>
              </div>
              <p className="text-slate-300 text-xs md:text-sm mt-1">
                نظام شامل لمتابعة الرواتب، الحوافز، الخصومات، مع تسوية آلية فورية للأرصدة في الخزينة والمحفظة.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 w-full md:w-auto justify-end">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold transition-all backdrop-blur-md"
          >
            <FileSpreadsheet size={16} /> تصدير سجل الشهر
          </button>
          <button 
            onClick={() => setShowAddStaffModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
          >
            <UserPlus size={18} /> إضافة موظف جديد
          </button>
        </div>
      </div>

      {/* Month Selector & Filter Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Calendar size={16} className="text-indigo-600" /> شهر المحاسبة:</span>
          <input 
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 font-bold text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'staff' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={16} /> قائمة الموظفين
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <History size={16} /> سجل الصرف وتعديل الحركات
            </button>
            <button 
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'report' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileText size={16} /> كشف شهر {selectedMonth}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="ميزانية الرواتب الأساسية" 
          value={stats.totalBaseBudget} 
          icon={<Briefcase size={22} />} 
          color="slate"
          subtitle="لكل الموظفين النشطين" 
        />
        <StatCard 
          title="المصروف فعلياً (رواتب)" 
          value={stats.totalSalaries} 
          icon={<DollarSign size={22} />} 
          color="indigo"
          subtitle={`لشهر ${selectedMonth}`}
        />
        <StatCard 
          title="إجمالي الحوافز والمكافآت" 
          value={stats.totalIncentives} 
          icon={<TrendingUp size={22} />} 
          color="emerald" 
          subtitle={`لشهر ${selectedMonth}`}
        />
        <StatCard 
          title="إجمالي الخصومات والجزاءات" 
          value={stats.totalDeductions} 
          icon={<TrendingDown size={22} />} 
          color="rose" 
          subtitle={`لشهر ${selectedMonth}`}
        />
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="البحث بالاسم، المسمى الوظيفي، رقم الهاتف، أو الملاحظات..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pr-11 pl-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={16} /></button>
          )}
        </div>

        {activeTab === 'staff' && (
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="عرض كروت"
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="عرض جدول"
            >
              <List size={18} />
            </button>
          </div>
        )}

        {activeTab === 'history' && (
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value="all">كل الحركات (رواتب، حوافز، خصم)</option>
            <option value="salary">الرواتب المصروفة فقط</option>
            <option value="incentive">الحوافز والمكافآت فقط</option>
            <option value="deduction">الخصومات والجزاءات فقط</option>
          </select>
        )}
      </div>

      {/* TAB 1: STAFF LIST */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {filteredStaff.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
              <Users size={56} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">لا يوجد موظفين مسجلين</h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto mb-6">قم بإضافة فريق العمل الخاص بك للبدء في إدارة رواتبهم ومستحقاتهم الشهرية بضغطة زر.</p>
              <button 
                onClick={() => setShowAddStaffModal(true)}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                <UserPlus size={16} /> إضافة موظف الآن
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* Cards Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredStaff.map(staff => {
                const summary = getStaffMonthlySummary(staff.id);
                const progress = summary.base > 0 ? Math.min(100, (summary.paidSalaries / summary.base) * 100) : 0;

                return (
                  <motion.div 
                    key={staff.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      {/* Top profile */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-1.5">
                              {staff.name}
                              {!staff.active && <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full">غير نشط</span>}
                            </h3>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-0.5 rounded-lg inline-block mt-1">
                              {staff.position}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingStaff(staff)} 
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 rounded-xl transition-colors"
                            title="تعديل بيانات الموظف"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStaff(staff.id)} 
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                            title="حذف الموظف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Contact info */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                        <span className="flex items-center gap-1.5 font-mono" dir="ltr"><Phone size={13} className="text-indigo-500" /> {staff.phone}</span>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <span className="flex items-center gap-1.5"><Calendar size={13} className="text-indigo-500" /> انضم {new Date(staff.joinDate).toLocaleDateString('ar-EG')}</span>
                      </div>

                      {/* Financial summary for selected month */}
                      <div className="space-y-2.5 bg-slate-50/80 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-bold">الراتب الأساسي:</span>
                          <span className="font-black text-slate-900 dark:text-white">{summary.base.toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-emerald-600 font-bold flex items-center gap-1"><TrendingUp size={13} /> الحوافز (+):</span>
                          <span className="font-bold text-emerald-600">{summary.incentives.toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-rose-600 font-bold flex items-center gap-1"><TrendingDown size={13} /> الخصومات (-):</span>
                          <span className="font-bold text-rose-600">{summary.deductions.toLocaleString()} ج.م</span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center text-xs font-black">
                          <span className="text-indigo-600 dark:text-indigo-400">صافي المستحق للشهر:</span>
                          <span className="text-sm text-indigo-600 dark:text-indigo-400">{summary.netPayable.toLocaleString()} ج.م</span>
                        </div>
                      </div>

                      {/* Progress bar of disbursement */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-500">تم صرف: {summary.paidSalaries.toLocaleString()} ج.م</span>
                          <span className={summary.remaining === 0 ? "text-emerald-600 font-black" : "text-amber-600"}>
                            {summary.remaining === 0 ? "✅ تم الصرف بالكامل" : `متبقي: ${summary.remaining.toLocaleString()} ج.م`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${summary.remaining === 0 ? 'bg-emerald-500' : 'bg-indigo-600'}`} 
                            style={{ width: `${progress}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { setSelectedStaff(staff); setShowPayslipModal(true); }}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <FileText size={15} className="text-indigo-600" /> كشف حساب / قسيمة
                      </button>
                      <button 
                        onClick={() => { setSelectedStaff(staff); setShowPaymentModal(true); }}
                        className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                      >
                        <DollarSign size={15} /> صرف / خصم مالي
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">الموظف</th>
                      <th className="px-6 py-4">الوظيفة</th>
                      <th className="px-6 py-4">الراتب الأساسي</th>
                      <th className="px-6 py-4">الحوافز (+)</th>
                      <th className="px-6 py-4">الخصومات (-)</th>
                      <th className="px-6 py-4">تم صرفه</th>
                      <th className="px-6 py-4">المتبقي للصرف</th>
                      <th className="px-6 py-4 text-left">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {filteredStaff.map(staff => {
                      const summary = getStaffMonthlySummary(staff.id);
                      return (
                        <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <div>{staff.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{staff.phone}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-300">{staff.position}</td>
                          <td className="px-6 py-4 font-black text-slate-800 dark:text-white">{summary.base.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-bold text-emerald-600">{summary.incentives.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-bold text-rose-600">{summary.deductions.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4 font-black text-indigo-600">{summary.paidSalaries.toLocaleString()} ج.م</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                              summary.remaining === 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {summary.remaining === 0 ? 'خالص' : `${summary.remaining.toLocaleString()} ج.م`}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="flex items-center gap-1.5 justify-end">
                              <button 
                                onClick={() => { setSelectedStaff(staff); setShowPayslipModal(true); }}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
                                title="كشف حساب الموظف"
                              >
                                <FileText size={17} />
                              </button>
                              <button 
                                onClick={() => { setSelectedStaff(staff); setShowPaymentModal(true); }}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-colors"
                                title="صرف / خصم"
                              >
                                <DollarSign size={17} />
                              </button>
                              <button 
                                onClick={() => setEditingStaff(staff)}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                                title="تعديل"
                              >
                                <Edit2 size={17} />
                              </button>
                              <button 
                                onClick={() => handleDeleteStaff(staff.id)}
                                className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
                                title="حذف"
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HISTORY WITH FULL DELETE AND EDIT */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-4 rounded-2xl flex items-center gap-3">
            <ShieldAlert className="text-amber-600 flex-shrink-0" size={20} />
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
              **ميزة التسوية الآلية:** عند حذف أو تعديل أي حركة صرف (راتب أو حافز)، يقوم النظام تلقائياً بتحديث رصيد المحفظة أو الخزينة وإعادة المبلغ أو تسوية الفرق بدون أي تدخل يدوي!
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">التاريخ</th>
                    <th className="px-6 py-4">الموظف</th>
                    <th className="px-6 py-4">النوع</th>
                    <th className="px-6 py-4">المبلغ</th>
                    <th className="px-6 py-4">مصدر الصرف</th>
                    <th className="px-6 py-4">ملاحظات</th>
                    <th className="px-6 py-4 text-left">إجراءات (تعديل / استرداد)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {sortedHistory.length > 0 ? sortedHistory.map(tx => {
                    const accountName = tx.treasuryAccountId && treasury 
                      ? treasury.accounts.find(a => a.id === tx.treasuryAccountId)?.name 
                      : null;
                    const sourceLabel = accountName ? `خزينة: ${accountName}` : 'المحفظة العامة';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                          {new Date(tx.date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-6 py-4 font-black text-slate-800 dark:text-white">
                          {tx.staffName}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase inline-block ${
                            tx.type === 'salary' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            tx.type === 'incentive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }`}>
                            {tx.type === 'salary' ? 'راتب مصروف' : tx.type === 'incentive' ? 'حافز / مكافأة' : 'خصم / جزاء'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`font-black text-base ${tx.type === 'deduction' ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                            {tx.type === 'deduction' ? '-' : ''}{tx.amount.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 pt-5">
                          <Landmark size={14} /> {tx.type === 'deduction' ? 'سجل خصم إداري' : sourceLabel}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                          {tx.note || '-'}
                        </td>
                        <td className="px-6 py-4 text-left">
                          <div className="flex items-center gap-2 justify-end">
                            <button 
                              onClick={() => { setEditingTx(tx); setShowEditTxModal(true); }}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 font-bold text-xs flex items-center gap-1 transition-all"
                              title="تعديل وتحديث الرصيد"
                            >
                              <Edit2 size={13} /> تعديل
                            </button>
                            <button 
                              onClick={() => handleDeleteTransaction(tx)}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 font-bold text-xs flex items-center gap-1 transition-all"
                              title="حذف وإرجاع المبلغ للخزينة/المحفظة"
                            >
                              <Trash2 size={13} /> استرداد وحذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                        <History size={48} className="mx-auto opacity-20 mb-3" />
                        <p className="font-bold">لا توجد حركات صرف أو خصم مطابقة للبحث</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MONTHLY COMPREHENSIVE REPORT */}
      {activeTab === 'report' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white">التقرير الشامل لرواتب ومستحقات شهر {selectedMonth}</h3>
              <p className="text-xs text-slate-500 mt-0.5">ملخص تفصيلي لكل موظف موضحاً فيه صافي الاستحقاق وما تم صرفه فعلياً.</p>
            </div>
            <button 
              onClick={() => window.print()} 
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
            >
              <Printer size={16} /> طباعة التقرير
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black uppercase">
                <tr>
                  <th className="p-3">الموظف</th>
                  <th className="p-3">الوظيفة</th>
                  <th className="p-3">الراتب الأساسي</th>
                  <th className="p-3 text-emerald-600">الحوافز (+)</th>
                  <th className="p-3 text-rose-600">الخصومات (-)</th>
                  <th className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">صافي المستحق</th>
                  <th className="p-3">المنصرف فعلياً</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(settings.staffMembers || []).map(staff => {
                  const s = getStaffMonthlySummary(staff.id);
                  return (
                    <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{staff.name}</td>
                      <td className="p-3 text-xs text-slate-500">{staff.position}</td>
                      <td className="p-3 font-mono">{s.base.toLocaleString()}</td>
                      <td className="p-3 font-mono text-emerald-600">+{s.incentives.toLocaleString()}</td>
                      <td className="p-3 font-mono text-rose-600">-{s.deductions.toLocaleString()}</td>
                      <td className="p-3 font-black font-mono bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">{s.netPayable.toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold">{s.paidSalaries.toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-amber-600">{s.remaining.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-md ${
                          s.remaining === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {s.remaining === 0 ? 'خالص' : 'مستحق'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
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

        {showPayslipModal && selectedStaff && (
          <PayslipModal 
            staff={selectedStaff}
            summary={getStaffMonthlySummary(selectedStaff.id)}
            month={selectedMonth}
            onClose={() => { setShowPayslipModal(false); setSelectedStaff(null); }}
          />
        )}

        {showEditTxModal && editingTx && (
          <EditPaymentModal 
            tx={editingTx}
            treasury={treasury}
            onClose={() => { setShowEditTxModal(false); setEditingTx(null); }}
            onSave={handleUpdateTransaction}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB COMPONENTS ---

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string; subtitle?: string }> = ({ title, value, icon, color, subtitle }) => {
  const colors: Record<string, string> = {
    slate: 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30',
  };

  return (
    <div className={`p-5 rounded-3xl border ${colors[color]} shadow-sm transition-all hover:scale-[1.02]`}>
      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-wider opacity-60">{subtitle || 'مؤشر مالي'}</span>
      </div>
      <div>
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{title}</h3>
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
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">الاسم الكامل *</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                placeholder="أحمد علي..."
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">رقم الهاتف *</label>
              <input 
                type="tel" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">المسمى الوظيفي *</label>
              <input 
                type="text" 
                value={formData.position} 
                onChange={e => setFormData({...formData, position: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="مثلاً: خدمة عملاء، مندوب..."
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">الراتب الأساسي (ج.م)</label>
              <input 
                type="number" 
                value={formData.baseSalary} 
                onChange={e => setFormData({...formData, baseSalary: Number(e.target.value)})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">تاريخ التعيين</label>
              <input 
                type="date" 
                value={formData.joinDate} 
                onChange={e => setFormData({...formData, joinDate: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات إضافية</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] text-sm"
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-sm">إلغاء</button>
          <button 
            onClick={() => {
              if (!formData.name || !formData.phone) {
                alert('يرجى إدخال اسم الموظف ورقم الهاتف');
                return;
              }
              onSave(formData);
            }}
            className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all text-sm"
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
  const [amount, setAmount] = useState(staff.baseSalary);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [treasuryAccountId, setTreasuryAccountId] = useState<string>('');
  const [paymentSource, setPaymentSource] = useState<'wallet' | 'treasury'>('wallet');

  useEffect(() => {
    if (type === 'salary') setAmount(staff.baseSalary);
    else setAmount(0);
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
            <h2 className="text-xl font-black text-slate-800 dark:text-white">صرف أو تسجيل حركة مالية</h2>
            <p className="text-xs text-indigo-600 font-bold mt-0.5">للموظف: {staff.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            {(['salary', 'incentive', 'deduction'] as const).map(t => (
              <button 
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${type === t ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'salary' ? 'راتب شهر' : t === 'incentive' ? 'حافز / مكافأة' : 'خصم / جزاء'}
              </button>
            ))}
          </div>

          {type !== 'deduction' && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">مصدر الصرف (سحب سيولة)</label>
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button 
                  type="button"
                  onClick={() => setPaymentSource('wallet')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${paymentSource === 'wallet' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm font-black' : 'text-slate-500'}`}
                >
                  المحفظة العامة
                </button>
                <button 
                  type="button"
                  onClick={() => setPaymentSource('treasury')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${paymentSource === 'treasury' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm font-black' : 'text-slate-500'}`}
                >
                  الخزينة / العهدة
                </button>
              </div>
            </div>
          )}

          {type !== 'deduction' && paymentSource === 'treasury' && (
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
            <label className="text-xs font-bold text-slate-500 mb-1 block">المبلغ (ج.م) *</label>
            <div className="relative">
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 px-4 outline-none focus:ring-2 focus:ring-indigo-500 text-2xl font-black text-center"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">ج.م</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">تاريخ العملية</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات</label>
              <input 
                type="text" 
                value={note} 
                onChange={e => setNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                placeholder="مثلاً: دفعة أولى..."
              />
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${type === 'deduction' ? 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900/40 dark:text-indigo-300'}`}>
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs leading-relaxed font-medium">
                {type === 'deduction' 
                  ? 'تسجيل خصم إداري: سيتم تسجيل هذا الخصم لتقليل صافي الراتب المستحق للموظف هذا الشهر، دون سحب أي سيولة من الخزينة.'
                  : `سيتم صرف المبلغ فوراً وخصمه من ${paymentSource === 'wallet' ? 'المحفظة العامة' : 'حساب الخزينة المختار'} مع تسجيله في قائمة المصروفات.`
                }
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 text-sm">إلغاء</button>
          <button 
            onClick={() => {
              if (!amount || amount <= 0) {
                alert('يرجى إدخال مبلغ صحيح');
                return;
              }
              onSave({
                staffId: staff.id,
                type,
                amount,
                date,
                note,
                treasuryAccountId: type !== 'deduction' && paymentSource === 'treasury' ? treasuryAccountId : undefined
              });
            }}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95 transition-all text-sm"
          >
            تأكيد العملية
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const EditPaymentModal: React.FC<{ tx: PayrollTransaction; treasury?: Treasury; onClose: () => void; onSave: (data: Omit<PayrollTransaction, 'id' | 'staffName'>) => void }> = ({ tx, treasury, onClose, onSave }) => {
  const [type, setType] = useState<'salary' | 'incentive' | 'deduction'>(tx.type);
  const [amount, setAmount] = useState(tx.amount);
  const [date, setDate] = useState(tx.date);
  const [note, setNote] = useState(tx.note || '');
  const [paymentSource, setPaymentSource] = useState<'wallet' | 'treasury'>(tx.treasuryAccountId ? 'treasury' : 'wallet');
  const [treasuryAccountId, setTreasuryAccountId] = useState<string>(tx.treasuryAccountId || (treasury?.accounts[0]?.id || ''));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-right border border-slate-200 dark:border-slate-800"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/20">
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Edit2 size={18} className="text-blue-600" /> تعديل سجل الصرف
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">للموظف: {tx.staffName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            {(['salary', 'incentive', 'deduction'] as const).map(t => (
              <button 
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${type === t ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                {t === 'salary' ? 'راتب' : t === 'incentive' ? 'حافز' : 'خصم'}
              </button>
            ))}
          </div>

          {type !== 'deduction' && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">مصدر الصرف</label>
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button 
                  type="button"
                  onClick={() => setPaymentSource('wallet')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${paymentSource === 'wallet' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm font-black' : 'text-slate-500'}`}
                >
                  المحفظة العامة
                </button>
                <button 
                  type="button"
                  onClick={() => setPaymentSource('treasury')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${paymentSource === 'treasury' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm font-black' : 'text-slate-500'}`}
                >
                  الخزينة
                </button>
              </div>
            </div>
          )}

          {type !== 'deduction' && paymentSource === 'treasury' && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">اختر الحساب</label>
              <select 
                value={treasuryAccountId}
                onChange={e => setTreasuryAccountId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
              >
                {treasury?.accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">المبلغ المعدل (ج.م)</label>
            <input 
              type="number" 
              value={amount} 
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500 text-xl font-black text-center"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">التاريخ</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2.5 px-3 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات</label>
              <input 
                type="text" 
                value={note} 
                onChange={e => setNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2.5 px-3 text-xs"
              />
            </div>
          </div>

          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs leading-relaxed font-medium">
            💡 **تسوية آلية:** سيتم إلغاء التأثير المالي القديم وحساب الفرق وإضافته أو خصمه من الخزينة/المحفظة فوراً لضمان دقة الحسابات.
          </div>
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 font-bold text-slate-500 text-sm">إلغاء</button>
          <button 
            onClick={() => {
              if (!amount || amount <= 0) {
                alert('يرجى إدخال مبلغ صحيح');
                return;
              }
              onSave({
                staffId: tx.staffId,
                type,
                amount,
                date,
                note,
                treasuryAccountId: type !== 'deduction' && paymentSource === 'treasury' ? treasuryAccountId : undefined
              });
            }}
            className="px-7 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all text-sm"
          >
            حفظ التعديلات وتسوية الرصيد
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PayslipModal: React.FC<{ staff: StaffMember; summary: any; month: string; onClose: () => void }> = ({ staff, summary, month, onClose }) => {
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden text-right border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl"><FileText size={22} /></div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">قسيمة راتب وكشف مستحقات</h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">لشهر: {month}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-xl text-slate-700 dark:text-white transition-colors" title="طباعة">
              <Printer size={18} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-500 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* Employee Card */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">{staff.name}</h3>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">{staff.position}</p>
              <p className="text-[11px] text-slate-400 font-mono mt-1" dir="ltr">{staff.phone}</p>
            </div>
            <div className="text-left font-mono text-xs text-slate-500">
              <div>تاريخ التعيين:</div>
              <div className="font-bold text-slate-700 dark:text-slate-300">{new Date(staff.joinDate).toLocaleDateString('ar-EG')}</div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3">البيان / البند</th>
                  <th className="p-3 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                <tr>
                  <td className="p-3 font-bold text-slate-800 dark:text-white">الراتب الأساسي للشهر</td>
                  <td className="p-3 text-left font-mono font-bold text-slate-800 dark:text-white">{summary.base.toLocaleString()} ج.م</td>
                </tr>
                <tr>
                  <td className="p-3 text-emerald-600 font-bold">إجمالي الحوافز والمكافآت (+)</td>
                  <td className="p-3 text-left font-mono font-bold text-emerald-600">+{summary.incentives.toLocaleString()} ج.م</td>
                </tr>
                <tr>
                  <td className="p-3 text-rose-600 font-bold">إجمالي الخصومات والجزاءات (-)</td>
                  <td className="p-3 text-left font-mono font-bold text-rose-600">-{summary.deductions.toLocaleString()} ج.م</td>
                </tr>
                <tr className="bg-indigo-50/50 dark:bg-indigo-950/20 font-black text-sm">
                  <td className="p-3 text-indigo-700 dark:text-indigo-300">صافي المستحق الكلي</td>
                  <td className="p-3 text-left font-mono text-indigo-700 dark:text-indigo-300">{summary.netPayable.toLocaleString()} ج.م</td>
                </tr>
                <tr>
                  <td className="p-3 text-slate-600 dark:text-slate-400 font-bold">ما تم صرفه بالفعل هذا الشهر</td>
                  <td className="p-3 text-left font-mono font-bold text-slate-800 dark:text-white">{summary.paidSalaries.toLocaleString()} ج.م</td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-black text-sm border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td className="p-3 text-slate-900 dark:text-white">الرصيد المتبقي للصرف</td>
                  <td className={`p-3 text-left font-mono ${summary.remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {summary.remaining === 0 ? '✅ خالص بالكامل' : `${summary.remaining.toLocaleString()} ج.م`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Detailed Transactions List for this month */}
          {summary.staffTxs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">سجل حركات الشهر:</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {summary.staffTxs.map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                        t.type === 'salary' ? 'bg-blue-100 text-blue-700' : t.type === 'incentive' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {t.type === 'salary' ? 'راتب' : t.type === 'incentive' ? 'حافز' : 'خصم'}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">{t.note || 'بدون ملاحظات'}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{t.amount.toLocaleString()} ج.م</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="text-[11px] text-slate-400">تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</div>
          <button onClick={onClose} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-xl font-bold text-slate-700 dark:text-white text-sm transition-colors">
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EmployeesPayrollPage;
