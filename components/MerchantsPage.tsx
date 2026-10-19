import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as db from '../services/databaseService';
import { Link, useParams } from 'react-router-dom';
import { Settings, Order, Wallet, Treasury, PartnerTransaction, MerchantTransaction } from '../types';
import { 
  Handshake, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, 
  Trash2, Wallet as WalletIcon, TrendingUp, PieChart, History, 
  Activity, Info, AlertCircle, Package as PackageIcon, Truck, 
  Coins, Calculator, Sparkles, Building2, Eye, ExternalLink,
  Mail, Phone, MessageSquare, Share2, Copy, CheckCircle2, Users2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip as ReTooltip, BarChart, Bar, Legend, Cell
} from 'recharts';
import { generateSafeId } from '../utils/idUtils';

interface MerchantsPageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  orders: Order[];
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
}

const normalizeName = (name: string): string => {
  if (!name) return '';
  let normalized = name.trim().replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s*\((موكل|مورد|صاحب بضاعة|تاجر|partner|employee|admin)\)/gi, '');
  return normalized
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
};

const MerchantsPage: React.FC<MerchantsPageProps> = ({ settings, updateSettings, wallet, setWallet, orders, treasury, setTreasury }) => {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'merchants_list' | 'requests' | 'analytics'>('overview');
  const [cloudRequests, setCloudRequests] = useState<db.PartnerPortalRequest[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({message, type});
      setTimeout(() => setToast(null), 3000);
  };

  const loadCloudRequests = useCallback(async () => {
    if (!storeId) return;
    try {
      const reqs = await db.getPartnerRequests(storeId);
      setCloudRequests(reqs);
    } catch (_) {}
  }, [storeId]);

  useEffect(() => {
    loadCloudRequests();
    const interval = setInterval(loadCloudRequests, 10000);
    return () => clearInterval(interval);
  }, [loadCloudRequests]);

  const merchantRequests = useMemo(() => {
    return cloudRequests.filter((r: any) => {
      const isMerchant = r.id?.startsWith('REQ-M-') || 
                         r.isMerchantRequest === true || 
                         (r.typeArabic && r.typeArabic.includes('الموكل')) ||
                         (r.partnerId && (r.partnerId.startsWith('m_') || r.partnerId.startsWith('sup_')));
      return isMerchant;
    }).sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [cloudRequests]);

  const pendingRequestsCount = useMemo(() => merchantRequests.filter((r: any) => r.status === 'pending').length, [merchantRequests]);

  const merchants = useMemo(() => {
    const list = Object.values(settings.suppliers || {});
    if (!searchQuery) return list;
    const q = normalizeName(searchQuery);
    return list.filter(m => normalizeName(m.name).includes(q) || (m.email && m.email.toLowerCase().includes(q.toLowerCase())));
  }, [settings.suppliers, searchQuery]);

  const stats = useMemo(() => {
    const totalBalance = merchants.reduce((sum, m) => sum + (m.balance || 0), 0);
    const totalSettlements = (settings.merchantSettlements || []).reduce((sum, s) => sum + (s.netPayoutToMerchant || 0), 0);
    const activeMerchants = merchants.filter(m => (m.balance || 0) !== 0).length;
    
    return {
      totalBalance,
      totalSettlements,
      activeMerchants,
      count: merchants.length
    };
  }, [merchants, settings.merchantSettlements]);

  const handleApproveRequest = async (req: any) => {
    if (storeId) {
      await db.updatePartnerRequestStatus(req.id, storeId, 'approved');
      setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
    }

    const amt = Number(req.amount || 0);
    const supplierId = req.partnerId;
    const supplier = (settings.suppliers || {})[supplierId];

    if (!supplier) {
        showToast('فشل العثور على الموكل المرتبط بالطلب', 'error');
        return;
    }

    const newBalance = (supplier.balance || 0) - amt;
    const updatedSuppliers = {
        ...settings.suppliers,
        [supplierId]: { ...supplier, balance: newBalance }
    };

    const newTx: MerchantTransaction = {
        id: generateSafeId('mtx'),
        merchantId: supplierId,
        merchantName: supplier.name,
        type: 'withdrawal',
        amount: -amt,
        date: new Date().toISOString(),
        notes: `اعتماد طلب سحب من البوابة: ${req.notes || ''}`,
        balanceAfter: newBalance
    };

    const updatedSettings = {
      ...settings,
      suppliers: updatedSuppliers,
      merchantTransactions: [newTx, ...(settings.merchantTransactions || [])],
      activityLogs: [
        {
          id: generateSafeId('log'),
          user: 'الإدارة',
          action: 'اعتماد طلب موكل',
          details: `تم اعتماد طلب سحب للموكل ${supplier.name} بمبلغ ${amt.toLocaleString()} ج.م`,
          date: new Date().toISOString(),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    };
    updateSettings(updatedSettings);
    showToast(`تم اعتماد طلب الموكل ${supplier.name} بنجاح`);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-8 pb-24">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 font-black text-xs ${
              toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-rose-500 text-white border-rose-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                <Handshake size={24} />
             </div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">إدارة محافظ وحسابات الموكلين</h1>
                <p className="text-sm font-bold text-slate-400">نظام تصفية الأمانات، المسحوبات، والتحليلات المالية للموردين</p>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input
               type="text"
               placeholder="بحث عن موكل..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pr-10 pl-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
             />
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 w-fit">
        {[
          { id: 'overview', label: 'نظرة عامة', icon: <PieChart size={14} /> },
          { id: 'merchants_list', label: 'كافة الموكلين', icon: <Users2 size={14} /> },
          { 
            id: 'requests', 
            label: 'طلبات الموكلين', 
            icon: <Activity size={14} />,
            badge: pendingRequestsCount > 0 ? pendingRequestsCount : null
          },
          { id: 'analytics', label: 'التحليلات المالية', icon: <TrendingUp size={14} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-6 py-2.5 rounded-[1.5rem] text-xs font-black transition-all duration-300 flex items-center gap-2 relative ${
              activeSection === tab.id 
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md scale-105' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] animate-pulse">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeSection === 'overview' && (
          <motion.div
            key="overview"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="space-y-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                        <Coins size={20} />
                     </div>
                     <span className="text-[10px] font-black text-emerald-600 px-2 py-1 bg-emerald-50 rounded-full">إجمالي الأمانات</span>
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">إجمالي أرصدة الموكلين</p>
                     <h3 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                        {stats.totalBalance.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">ج.م</span>
                     </h3>
                  </div>
               </motion.div>

               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                        <Calculator size={20} />
                     </div>
                     <span className="text-[10px] font-black text-indigo-600 px-2 py-1 bg-indigo-50 rounded-full">التحصيلات والتسويات</span>
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">إجمالي ما تم تصفبته</p>
                     <h3 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                        {stats.totalSettlements.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">ج.م</span>
                     </h3>
                  </div>
               </motion.div>

               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl">
                        <AlertCircle size={20} />
                     </div>
                     <span className="text-[10px] font-black text-rose-600 px-2 py-1 bg-rose-50 rounded-full">الطلبات المعلقة</span>
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">طلبات بانتظار الاعتماد</p>
                     <h3 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                        {pendingRequestsCount} <span className="text-xs font-bold text-slate-400 ml-1">طلب</span>
                     </h3>
                  </div>
               </motion.div>

               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl">
                        <Users2 size={20} />
                     </div>
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">عدد الموكلين النشطين</p>
                     <h3 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                        {stats.activeMerchants} <span className="text-xs font-bold text-slate-400 ml-1">موكل</span>
                     </h3>
                  </div>
               </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <motion.div variants={itemVariants} className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6">أعلى 5 موكلين من حيث الأرصدة</h3>
                  <div className="h-64 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={merchants.sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 5)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <ReTooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="balance" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40}>
                                {merchants.slice(0, 5).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#818cf8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
               </motion.div>

               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <Sparkles size={40} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">نظام التسوية التلقائي</h3>
                  <p className="text-xs font-bold text-slate-400 leading-relaxed">
                    يمكنك تصفية حسابات بضاعة الأمانة لكل موكل بضغطة زر واحدة. النظام يحسب مبيعاته، مديونية الشحن، ورأس ماله المتاح للسحب.
                  </p>
                  <Link
                    to={`/store/${storeId}/merchant-settlement`}
                    className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all"
                  >
                    فتح نظام التسوية الآن
                  </Link>
               </motion.div>
            </div>
          </motion.div>
        )}

        {activeSection === 'merchants_list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                    <th className="p-8">بيانات الموكل</th>
                    <th className="p-8 text-center">الرصيد الجاري</th>
                    <th className="p-8 text-center">بوابة الموكل</th>
                    <th className="p-8 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {merchants.length > 0 ? (
                    merchants.map((merchant, idx) => (
                      <motion.tr 
                        key={merchant.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group"
                      >
                        <td className="p-8">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-lg">
                              {merchant.name.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-800 dark:text-white mb-1">{merchant.name}</span>
                              <span className="text-[10px] font-bold text-slate-400">{merchant.phone || 'بدون رقم هاتف'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-8 text-center">
                          <span className={`text-base font-black tabular-nums ${
                            (merchant.balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {(merchant.balance || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
                          </span>
                        </td>
                        <td className="p-8 text-center">
                          <div className="flex items-center justify-center gap-2">
                             <button
                               onClick={() => {
                                 const link = `${window.location.origin}/store/${storeId}/merchant-portal?p=${merchant.id}`;
                                 navigator.clipboard.writeText(link);
                                 showToast(`تم نسخ رابط البوابة لـ ${merchant.name}`);
                               }}
                               className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
                               title="نسخ رابط الدخول"
                             >
                               <Copy size={16} />
                             </button>
                             <Link
                               to={`/store/${storeId}/merchant-portal?p=${merchant.id}`}
                               target="_blank"
                               className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
                               title="معاينة البوابة"
                             >
                               <ExternalLink size={16} />
                             </Link>
                          </div>
                        </td>
                        <td className="p-8 text-center">
                          <Link
                            to={`/store/${storeId}/suppliers/${merchant.id}`}
                            className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-[10px] font-black shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all inline-block"
                          >
                            عرض المحفظة
                          </Link>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-20 text-center text-slate-400 font-bold italic">
                        لا يوجد موكلين يطابقون بحثك حالياً...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeSection === 'requests' && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {merchantRequests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {merchantRequests.map((req, idx) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600 font-black">
                          {req.partnerName?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">{req.partnerName}</h4>
                          <span className="text-[10px] text-slate-400 font-bold">{new Date(req.date || req.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        req.status === 'pending' ? 'bg-amber-50 text-amber-600 animate-pulse' :
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {req.status === 'pending' ? 'بانتظار الموافقة' : req.status === 'approved' ? 'تم الاعتماد' : 'مرفوض'}
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400">المبلغ المطلوب سحبه</p>
                      <h5 className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                        {(req.amount || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                      </h5>
                    </div>

                    {req.notes && (
                      <p className="text-[10px] font-bold text-slate-500 leading-relaxed bg-indigo-50/30 dark:bg-indigo-500/5 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10">
                        "{req.notes}"
                      </p>
                    )}

                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all"
                        >
                          موافقة وصرف
                        </button>
                        <button
                          onClick={async () => {
                            if (storeId) {
                                await db.updatePartnerRequestStatus(req.id, storeId, 'rejected');
                                setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
                                showToast('تم رفض طلب الموكل', 'error');
                            }
                          }}
                          className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-all"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-bold italic">
                لا توجد طلبات سحب حالية من الموكلين...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MerchantsPage;
