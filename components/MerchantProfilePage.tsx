import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Settings, Supplier, MerchantTransaction, Order, Treasury, CustomerProfile } from '../types';
import { 
  Trash2, Printer, Wallet as WalletIcon, RefreshCw, 
  CheckCircle2, Clock, Eye, Search, Lock, Share2, Copy, Sparkles, X, Mail,
  Calculator, ExternalLink, ChevronDown, ChevronUp, AlertCircle, ShieldCheck, Key,
  Layers, FileText, ArrowLeft, Building2, Truck, ArrowDownRight, Package as PackageIcon, TrendingUp, Coins, Activity, History
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import * as db from '../services/databaseService';
import { calculateMerchantTransparencyAnalytics } from '../utils/merchantAnalytics';
import { inAppToast } from '../utils/inAppAlert';

interface MerchantProfilePageProps {
  settings: Settings;
  updateSettings: (updater: (prev: Settings) => Settings) => void;
  orders: Order[];
  treasury?: Treasury;
  setTreasury?: (updater: (prev: Treasury | undefined) => Treasury | undefined) => void;
  customers?: CustomerProfile[];
  currentUser?: any;
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

const MerchantProfilePage: React.FC<MerchantProfilePageProps> = ({ 
  settings, 
  updateSettings, 
  orders, 
  treasury, 
  setTreasury,
  customers = [],
  currentUser
}) => {
  const { storeId, supplierId } = useParams<{ storeId: string; supplierId: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'settlements' | 'inventory' | 'requests'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [merchantPinInput, setMerchantPinInput] = useState('');
  const [cloudRequests, setCloudRequests] = useState<db.PartnerPortalRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Find the merchant (supplier)
  const merchant = useMemo(() => {
    const rawSuppliers = settings.suppliers || [];
    const targetId = supplierId?.toLowerCase() || '';
    const targetName = normalizeName(supplierId || '');

    return rawSuppliers.find(s => 
      (s.id && s.id.toLowerCase() === targetId) || 
      (s.id && s.id.toLowerCase() === targetId.replace('sup_', '')) ||
      (normalizeName(s.name) === targetName)
    );
  }, [settings.suppliers, supplierId]);

  const loadRequests = useCallback(async () => {
    if (!storeId) return;
    setIsLoadingRequests(true);
    try {
      const reqs = await db.getPartnerRequests(storeId);
      setCloudRequests(reqs);
    } catch (err) {
      console.error('[MerchantProfile] Error loading requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const merchantRequests = useMemo(() => {
    if (!merchant) return [];
    const mId = merchant.id.toLowerCase();
    const mName = normalizeName(merchant.name);
    return cloudRequests.filter(r => {
      const rId = (r.partnerId || (r as any).merchantId || '').toLowerCase();
      const rName = normalizeName(r.partnerName || (r as any).merchantName || '');
      return (rId === mId) || (rName === mName);
    });
  }, [cloudRequests, merchant]);

  const pendingRequests = useMemo(() => 
    merchantRequests.filter(r => r.status === 'pending'), 
    [merchantRequests]
  );

  const merchantOrders = useMemo(() => {
    if (!merchant) return [];
    const mName = normalizeName(merchant.name);
    const mId = merchant.id.toLowerCase();
    return orders.filter(o => {
      const oMId = (o.merchantId || '').toLowerCase();
      const oMName = normalizeName(o.merchantName || '');
      return (oMId === mId) || (oMName === mName);
    });
  }, [orders, merchant]);

  const analytics = useMemo(() => {
    if (!merchant) return null;
    return calculateMerchantTransparencyAnalytics(merchantOrders, settings, merchant.id);
  }, [merchantOrders, settings, merchant]);

  const chartData = useMemo(() => {
    if (!merchant) return [];
    const transactions = merchant.transactions || [];
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let runningBalance = 0;
    return sortedTxs.map(t => {
      runningBalance = t.balanceAfter ?? (runningBalance + t.amount);
      return {
        date: new Date(t.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
        balance: runningBalance,
        amount: t.amount
      };
    });
  }, [merchant]);

  if (!merchant) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <AlertCircle size={48} className="text-rose-500" />
        <h2 className="text-xl font-black text-slate-800">لم يتم العثور على الموكل المطلوب</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition-colors">العودة للخلف</button>
      </div>
    );
  }

  const handleApproveRequest = async (req: db.PartnerPortalRequest) => {
    try {
      const amount = Number(req.amount);
      if (!storeId || req.status !== 'pending' || !Number.isFinite(amount) || amount <= 0 || amount > (merchant.balance || 0)) {
        inAppToast('تعذر اعتماد الطلب: تحقق من حالته والمبلغ والرصيد المتاح.', 'error');
        return;
      }
      const statusUpdated = await db.updatePartnerRequestStatus(req.id, storeId, 'approved');
      if (!statusUpdated) {
        inAppToast('لم يتم اعتماد الطلب؛ ربما عولج بالفعل من شاشة أخرى. حدّث القائمة.', 'error');
        return;
      }
      setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));

      // Update Merchant Balance and record Withdrawal Transaction
      updateSettings(currentSettings => {
        const updatedSuppliers = (currentSettings.suppliers || []).map(s => {
          if (s.id === merchant.id) {
            const currentBalance = s.balance || 0;
            const newTx: MerchantTransaction = {
              id: `mtx-w-${Date.now()}`,
              merchantId: s.id,
              merchantName: s.name,
              date: new Date().toISOString(),
              type: 'withdrawal',
              amount: -amount,
              balanceAfter: currentBalance - amount,
              notes: `سحب مستحقات (طلب #${req.id.slice(-6)}) - ${req.notes || ''}`,
              referenceId: req.id,
              performedBy: currentUser?.fullName || 'الإدارة'
            };
            return {
              ...s,
              balance: currentBalance - amount,
              transactions: [newTx, ...(s.transactions || [])]
            };
          }
          return s;
        });
        const addedTx = updatedSuppliers.find(s => s.id === merchant.id)?.transactions?.[0];
        return {
          ...currentSettings,
          suppliers: updatedSuppliers,
          ...(addedTx ? { merchantTransactions: [addedTx, ...(currentSettings.merchantTransactions || [])] } : {})
        };
      });

      inAppToast(`تم اعتماد طلب السحب للموكل ${merchant.name} بمبلغ ${amount.toLocaleString()} ج.م بنجاح ✅`, 'success');
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء اعتماد الطلب', 'error');
    }
  };

  const copyPortalLink = () => {
    const link = `${window.location.origin}/merchant-portal?storeId=${storeId}&merchantId=${merchant.id}`;
    navigator.clipboard.writeText(link);
    inAppToast('تم نسخ رابط بوابة الموكل بنجاح', 'success');
  };

  const shareWhatsApp = () => {
    const link = `${window.location.origin}/merchant-portal?storeId=${storeId}&merchantId=${merchant.id}`;
    const code = merchant.passcode || '0000';
    const storeTitle = settings.storeName || 'المتجر';
    const text = `مرحباً بك يا ${merchant.name} 🌟\nإليك رابط بوابتك الإلكترونية المباشرة لمتابعة شحنات بضاعتك وتفاصيل محفظتك المالية في متجر ${storeTitle}:\n🔗 ${link}\n🔑 رمز المرور السري (PIN): ${code}\n\nتحياتنا، إدارة المتجر.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(`/store/${storeId}/merchant-settlement?tab=partners`)} 
          className="group flex items-center gap-2 text-slate-500 font-bold hover:text-emerald-600 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-emerald-50 transition-colors border border-slate-200">
            <ArrowLeft size={20} />
          </div>
          العودة لدليل الموكلين
        </button>

        <div className="flex gap-2">
          <button 
            onClick={copyPortalLink}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black border border-indigo-200 hover:bg-indigo-100 transition-all cursor-pointer"
          >
            <Copy size={16} />
            <span className="text-xs">رابط البوابة</span>
          </button>
          <button 
            onClick={shareWhatsApp}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-black border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
          >
            <Share2 size={16} />
            <span className="text-xs">مشاركة واتساب</span>
          </button>
        </div>
      </div>

      {/* Profile Hero Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-6 sm:gap-8 justify-between relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        <div className="flex items-center gap-4 sm:gap-6 relative z-10 w-full sm:w-auto">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tr from-emerald-600 to-teal-700 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30 flex-shrink-0">
            <Building2 size={48} />
          </div>
          <div className="space-y-1 min-w-0 text-right">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 truncate">{merchant.name}</h1>
              <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-full uppercase border border-emerald-200">موكل معتمد</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center gap-2">
                <Truck size={16} className="text-slate-400" />
                <span>{merchantOrders.length} أوردر إجمالي</span>
              </p>
              <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center gap-2">
                <Mail size={16} className="text-slate-400" />
                <span>{merchant.email || 'بدون بريد مسجل'}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400">PIN:</span>
                <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">{merchant.passcode || '0000'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center md:text-left relative z-10 w-full sm:w-auto mt-4 sm:mt-0 bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
          <p className="text-[10px] sm:text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">رصيد الموكل الحالي بالمحفظة</p>
          <p className={`text-4xl sm:text-5xl font-black tracking-tighter ${(merchant.balance || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {(merchant.balance || 0).toLocaleString()} 
            <span className="text-lg sm:text-xl font-bold ml-2 text-emerald-400">ج.م</span>
          </p>
        </div>
      </motion.div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-6 space-y-4 shadow-sm text-right">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                <Clock size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">طلبات سحب معلقة من الموكل ({pendingRequests.length})</h3>
                <p className="text-xs text-slate-500">هذه الطلبات مقدمة من بوابة الموكل وبانتظار اعتمادك المالي وتخصيمها من المحفظة</p>
              </div>
            </div>
            <Link to={`/store/${storeId}/merchant-settlement?tab=requests`} className="text-xs font-black text-amber-700 hover:underline">إدارة كافة الطلبات ←</Link>
          </div>

          <div className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-sm text-slate-900">{req.typeArabic || 'طلب سحب مستحقات'}</span>
                    <span className="text-base font-black text-indigo-600 font-mono">{req.amount.toLocaleString()} ج.م</span>
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{new Date(req.createdAt || req.date).toLocaleDateString('ar-EG')}</span>
                  </div>
                  {req.notes && <p className="text-xs text-slate-500 font-medium">📝 {req.notes}</p>}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => handleApproveRequest(req)}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-sm transition-all cursor-pointer"
                  >
                    اعتماد وتخصيم الرصيد ✅
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 text-right">
          <div className="flex items-center gap-2 text-slate-500">
            <Calculator size={16} />
          <span className="text-[10px] font-black uppercase">إجمالي التحصيل من الطلبات</span>
          </div>
          <p className="text-xl font-black text-slate-900 font-mono">{(analytics?.totalCollected || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></p>
          <p className="text-[10px] text-slate-400 font-medium">تحصيل الطلبات، وليس صافي المبلغ المسدّد للموكل</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 text-right">
          <div className="flex items-center gap-2 text-slate-500">
            <ArrowDownRight size={16} />
            <span className="text-[10px] font-black uppercase">إجمالي المسحوبات</span>
          </div>
          <p className="text-xl font-black text-rose-600 font-mono">
            {merchant.transactions?.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString() || 0} 
            <span className="text-[10px]"> ج.م</span>
          </p>
          <p className="text-[10px] text-slate-400 font-medium">المبالغ التي تم تحويلها للموكل فعلياً</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 text-right">
          <div className="flex items-center gap-2 text-slate-500">
            <PackageIcon size={16} />
            <span className="text-[10px] font-black uppercase">بضاعة قيد التحصيل</span>
          </div>
          <p className="text-xl font-black text-indigo-600 font-mono">
            {merchantOrders.filter(o => ['تم_الشحن', 'جاري_التوصيل', 'في_الطريق'].includes(o.status)).length} 
            <span className="text-[10px]"> شحنة</span>
          </p>
          <p className="text-[10px] text-slate-400 font-medium">أوردرات مشحونة لم يتم تحصيل قيمتها بعد</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 text-right">
          <div className="flex items-center gap-2 text-slate-500">
            <TrendingUp size={16} />
            <span className="text-[10px] font-black uppercase">نسبة نجاح التسليم</span>
          </div>
          <p className="text-xl font-black text-emerald-600 font-mono">{analytics?.deliverySuccessRate || 0}%</p>
          <p className="text-[10px] text-slate-400 font-medium">معدل استلام العملاء لبضاعة هذا الموكل</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border border-slate-200 rounded-3xl p-2 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-xs">
        {[
          { id: 'overview', label: 'المركز المالي والمحفظة', icon: WalletIcon },
          { id: 'transactions', label: 'كشف الحساب التفصيلي', icon: History },
          { id: 'settlements', label: 'سجل كشوف التسوية', icon: FileText },
          { id: 'inventory', label: 'المخزون وحركة الأصناف', icon: Layers },
          { id: 'requests', label: 'طلبات السحب والمصروفات', icon: Coins }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {tab.id === 'requests' && pendingRequests.length > 0 && (
              <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse">{pendingRequests.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Balance Chart Card */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 text-right">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">منحنى سيولة محفظة الموكل</h3>
                    <p className="text-[11px] text-slate-500 font-medium">تتبع نمو رصيد الموكل الجاري المتاح للسحب عبر الزمن</p>
                  </div>
                </div>
              </div>

              <div className="h-80 w-full" dir="ltr">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 font-bold text-xs">لا توجد حركات كافية في الحساب لرسم المنحنى حالياً.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800, direction: 'rtl'}} />
                      <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorBalance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 text-right">
                  <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-600" size={18} />
                    إدارة صلاحيات دخول الموكل للبوابة
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يمكن للموكل تسجيل الدخول لبوابته الخاصة <strong>/merchant-portal</strong> لمتابعة مبيعات بضاعته وطلب سحب الأرباح. تأكد من ربط بريده الإلكتروني ورمز الـ PIN الخاص به.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2">
                     <button 
                        onClick={() => navigate(`/store/${storeId}/merchant-settlement?tab=partners`)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                     >
                       تعديل بيانات الحساب ⚙️
                     </button>
                  </div>
               </div>

               <div className="bg-gradient-to-br from-slate-900 to-[#0d1b2a] p-6 rounded-3xl text-white shadow-xl space-y-4 relative overflow-hidden text-right">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <h4 className="font-black text-sm flex items-center gap-2 relative z-10">
                    <TrendingUp className="text-emerald-400" size={18} />
                    ملخص أداء المبيعات والمخزن
                  </h4>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                     <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400">إجمالي المبيعات المحصلة:</span>
                        <div className="text-lg font-black font-mono text-emerald-400">{(analytics?.totalCollected || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></div>
                     </div>
                     <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400">عدد المنتجات المسجلة:</span>
                        <div className="text-lg font-black font-mono">{settings.products?.filter(p => p.merchantId === merchant.id).length || 0} <span className="text-[10px]">صنف</span></div>
                     </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('inventory')}
                    className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black transition-all cursor-pointer border border-white/10 relative z-10"
                  >
                    عرض حركة المخزن التفصيلية ←
                  </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-right">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
               <div>
                  <h3 className="text-sm font-black text-slate-900">سجل المعاملات المالية التاريخي</h3>
                  <p className="text-[11px] text-slate-500 font-medium">بيان تفصيلي بجميع التسويات والمسحوبات والتعديلات اليدوية على رصيد الموكل</p>
               </div>
               <div className="relative">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="بحث في المعاملات..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 pr-9 text-xs outline-none focus:border-emerald-600 w-full sm:w-64" 
                  />
               </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-6 text-center">التاريخ</th>
                    <th className="py-4 px-3">نوع العملية</th>
                    <th className="py-4 px-3">البيان / الملاحظات</th>
                    <th className="py-4 px-3 text-center">المبلغ</th>
                    <th className="py-4 px-3 text-center">الرصيد بعدها</th>
                    <th className="py-4 px-6 text-center">بواسطة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {(!merchant.transactions || merchant.transactions.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-400 font-bold italic">لا توجد معاملات مسجلة حالياً في سجل محفظة الموكل</td>
                    </tr>
                  ) : (
                    merchant.transactions
                      .filter(t => !searchTerm || t.notes.toLowerCase().includes(searchTerm.toLowerCase()) || t.type.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 text-center font-mono font-bold text-slate-400">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                        <td className="py-4 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            tx.type === 'order_delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            tx.type === 'withdrawal' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            tx.type === 'adjustment' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                            'bg-slate-50 text-slate-700 border-slate-100'
                          }`}>
                            {tx.type === 'order_delivered' ? 'تسوية مبيعات' : 
                             tx.type === 'withdrawal' ? 'سحب نقدي' : 
                             tx.type === 'adjustment' ? 'تعديل يدوي' : 
                             tx.type === 'lump_sum_deduction' ? 'خصم مجمع' : tx.type}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-bold text-slate-700 max-w-xs">{tx.notes}</td>
                        <td className={`py-4 px-3 text-center font-black font-mono text-sm ${tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                        </td>
                        <td className="py-4 px-3 text-center font-black font-mono text-slate-900 text-sm bg-slate-50/50">
                          {tx.balanceAfter?.toLocaleString() || '—'}
                        </td>
                        <td className="py-4 px-6 text-center text-[10px] font-black text-slate-400">{tx.performedBy || 'الإدارة'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settlements' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4 text-right">
             <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">أرشيف كشوف التسوية المعتمدة</h3>
                  <p className="text-xs text-slate-500">مراجعة كافة التسويات المالية السابقة التي تم اعتمادها لهذا الموكل</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(settings.merchantSettlements || [])
                  .filter(s => s.status === 'paid' && (s.merchantId === merchant.id || s.merchantName === merchant.name))
                  .map(st => (
                  <div key={st.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-200 hover:border-emerald-300 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="px-3 py-1 bg-white rounded-xl text-[10px] font-black border border-slate-200 font-mono text-slate-400 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-colors">
                        #{st.settlementNumber}
                      </div>
                      <span className={`text-[10px] font-bold ${st.reversedAt ? 'text-rose-600' : 'text-slate-400'}`}>
                        {st.reversedAt ? 'معكوس · ' : ''}{new Date(st.date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="space-y-1 mb-4">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">الصافي المحول للموكل:</p>
                      <p className="text-2xl font-black text-slate-900 font-mono">{(st.netPayoutToMerchant || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span></p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                      <span className="text-[10px] font-black text-slate-400">{st.ordersCount} أوردر مسوّى</span>
                      <button className="text-[10px] font-black text-emerald-600 hover:underline cursor-pointer">عرض التفاصيل ←</button>
                    </div>
                  </div>
                ))}
             </div>

             {(settings.merchantSettlements || []).filter(s => s.status === 'paid' && (s.merchantId === merchant.id || s.merchantName === merchant.name)).length === 0 && (
                <div className="py-20 text-center text-slate-400 font-bold text-xs italic">لا توجد كشوف تسوية تاريخية مسجلة لهذا الموكل حتى الآن.</div>
             )}
          </div>
        )}

        {activeTab === 'inventory' && analytics && (
          <div className="space-y-6 text-right">
             <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                      <PackageIcon size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">حركة بضاعة الموكل بالمخزن</h3>
                      <p className="text-xs text-slate-500">تحليل المبيعات، المرتجعات، والكميات المتبقية من أصناف الموكل حالياً</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black shadow-sm cursor-pointer hover:bg-emerald-700 transition-colors">جرد المخزون الآن 📝</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">اسم المنتج / الصنف</th>
                        <th className="py-3 px-3 text-center">المباع (مسلم)</th>
                        <th className="py-3 px-3 text-center text-rose-600">المرتجع</th>
                        <th className="py-3 px-3 text-center font-black">المتبقي حالياً</th>
                        <th className="py-3 px-3 text-center">إجمالي المبيعات</th>
                        <th className="py-3 px-4 text-center">رأس مال البضاعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {analytics.productMovements.length === 0 ? (
                        <tr><td colSpan={6} className="py-12 text-center text-slate-400 italic">لا توجد حركة بضاعة مسجلة</td></tr>
                      ) : (
                        analytics.productMovements.map(pm => (
                          <tr key={pm.productId} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                  <PackageIcon size={14} />
                                </div>
                                <span className="font-bold text-slate-800">{pm.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600 bg-emerald-50/20">{pm.quantityDelivered} ق</td>
                            <td className="py-3 px-3 text-center font-bold text-rose-600 bg-rose-50/20">{pm.quantityReturned} ق</td>
                            <td className="py-3 px-3 text-center font-black text-indigo-700 bg-indigo-50/30">
                              {(settings.products?.find(p => p.id === pm.productId)?.stockQuantity || 0)} ق
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{pm.totalDeliveredSales.toLocaleString()} ج.م</td>
                            <td className="py-3 px-4 text-center font-mono font-black text-emerald-600">{pm.totalDeliveredCost.toLocaleString()} ج.م</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">سجل طلبات السحب والمصروفات الواردة</h3>
                  <p className="text-xs text-slate-500">مراجعة كافة الطلبات المالية المقدمة من الموكل وحالات اعتمادها</p>
                </div>
              </div>
              <button 
                onClick={loadRequests}
                disabled={isLoadingRequests}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                <RefreshCw size={16} className={isLoadingRequests ? 'animate-spin text-emerald-600' : ''} />
              </button>
            </div>

            <div className="space-y-3">
               {merchantRequests.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-black text-xs italic">لا توجد طلبات واردة من هذا الموكل حتى الآن.</div>
               ) : (
                 merchantRequests.map(req => {
                   const isPending = req.status === 'pending';
                   const isApproved = req.status === 'approved';
                   const isRejected = req.status === 'rejected';

                   return (
                     <div key={req.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                             isPending ? 'bg-amber-100 text-amber-600' :
                             isApproved ? 'bg-emerald-100 text-emerald-600' :
                             'bg-rose-100 text-rose-600'
                           }`}>
                             <Coins size={20} />
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-slate-900">{req.typeArabic || 'طلب سحب مستحقات'}</span>
                                <span className="text-[10px] font-bold text-slate-400">({new Date(req.createdAt || req.date).toLocaleDateString('ar-EG')})</span>
                              </div>
                              <p className="text-[11px] text-slate-500 max-w-md">{req.notes || 'لا يوجد ملاحظات إضافية'}</p>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                           <div className="text-left space-y-0.5">
                              <p className="text-sm font-black text-slate-900 font-mono">{req.amount.toLocaleString()} ج.م</p>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                isPending ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                isApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                'bg-rose-100 text-rose-700 border-rose-200'
                              }`}>
                                {isPending ? 'قيد المراجعة ⏳' : isApproved ? 'تم الاعتماد ✅' : 'تم الرفض ❌'}
                              </span>
                           </div>
                           
                           {isPending && (
                             <button 
                                onClick={() => handleApproveRequest(req)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black transition-all cursor-pointer shadow-sm"
                             >
                               اعتماد وصرف ✅
                             </button>
                           )}
                        </div>
                     </div>
                   );
                 })
               )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default MerchantProfilePage;
