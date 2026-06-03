import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Package, CheckCircle2, Wallet as WalletIcon, Truck, RefreshCcw, FileSearch, Check, PlayCircle, X, AlertTriangle, ArrowRight, Lightbulb, Loader, BrainCircuit, PhoneForwarded, PieChart as ChartIcon, Clock, AlertCircle, ShieldAlert, Layers, DollarSign, Monitor, ArrowLeft, Users2 } from 'lucide-react';
import { Order, Settings, Wallet, User, CustomerProfile, Store } from '../types';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { generateDashboardSuggestions } from '../services/geminiService';
import { calculateOrderProfitLoss, getOrderProductCost, getLatestProductCost } from '../utils/financials';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

const StatusDistribution = ({ data }: { data: { name: string, value: number, color: string }[] }) => {
    const total = useMemo(() => (data || []).reduce((sum, item) => sum + item.value, 0), [data]);

    if (total === 0) {
        return <div className="h-full flex items-center justify-center text-slate-400">لا توجد بيانات لعرضها.</div>;
    }

    return (
        <div className="h-full flex flex-col justify-center gap-6 py-4">
            {data.map(item => {
                const percentage = total > 0 ? (item.value / total) * 100 : 0;
                return (
                    <div key={item.name}>
                        <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{item.name}</span>
</div>
<span className="text-xs font-black text-slate-600 dark:text-slate-300">{item.value} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full rounded-full" 
                                style={{ width: `${percentage}%`, backgroundColor: item.color, transition: 'width 0.5s ease-in-out' }}
                            ></div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

const SmartSuggestions = ({ orders, settings }: { orders: Order[], settings: Settings }) => {
    const [suggestions, setSuggestions] = useState('اضغط على زر التحديث للحصول على اقتراحات ذكية.');
    const [isLoading, setIsLoading] = useState(false);

    const customers = useMemo(() => {
        const customerMap = new Map<string, Pick<CustomerProfile, 'name' | 'successfulOrders' | 'totalSpent'>>();
        (orders || []).forEach(order => {
            const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
            if (!cleanPhone) return;
            if (!customerMap.has(cleanPhone)) {
                customerMap.set(cleanPhone, { name: order.customerName, successfulOrders: 0, totalSpent: 0 });
            }
            const customer = customerMap.get(cleanPhone)!;
            if (order.status === 'تم_التحصيل' || order.status === 'مدفوعة') {
                customer.successfulOrders += 1;
                customer.totalSpent += (order.productPrice + order.shippingFee) - (order.discount || 0);
            }
        });
        return Array.from(customerMap.values());
    }, [orders]);

    const fetchSuggestions = async () => {
        setIsLoading(true);
        setSuggestions('');
        const result = await generateDashboardSuggestions(orders || [], (settings?.products || []), customers);
        setSuggestions(result);
        setIsLoading(false);
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2"><Lightbulb className="text-amber-500"/> اقتراحات ذكية</h3>
                <button onClick={fetchSuggestions} disabled={isLoading} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-wait" title="تحديث الاقتراحات">
                    <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>
            {isLoading ? (
                <div className="flex items-center justify-center h-24 text-slate-400 gap-2">
                    <BrainCircuit size={20} className="animate-pulse" />
                    <span>المساعد الذكي يحلل بياناتك...</span>
                </div>
            ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none space-y-2 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {suggestions.split('\n').map((line, i) => <p key={i} className="my-1">{line}</p>)}
                </div>
            )}
        </div>
    );
};


const Dashboard = ({ orders, settings, wallet, currentUser, activeStore }: { orders: Order[], settings: Settings, wallet: Wallet, currentUser: User | null, activeStore: Store | undefined }) => {
  const [showVideoBanner, setShowVideoBanner] = useState(true);
  const [financialFilter, setFinancialFilter] = useState<'all' | 'with' | 'dep'>('all');

  const [announcementText, setAnnouncementText] = useState<string | null>(() => {
    const text = localStorage.getItem('platform_announcement_text');
    const type = localStorage.getItem('platform_announcement_type');
    const dismissed = localStorage.getItem('platform_announcement_dismissed');
    if (text && type !== 'none' && dismissed !== text) {
      return text;
    }
    return null;
  });
  const announcementType = useMemo(() => localStorage.getItem('platform_announcement_type') || 'info', []);

  const handleDismissAnnouncement = () => {
    if (announcementText) {
      localStorage.setItem('platform_announcement_dismissed', announcementText);
      setAnnouncementText(null);
    }
  };

  const financialNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      body: string;
      date: string;
      type: 'سحب' | 'إيداع';
      status: string;
      amount: number;
    }> = [];

    // 1. Add withdrawals
    (wallet?.withdrawRequests || []).forEach(r => {
      let body = '';
      if (r.status === 'pending') {
        body = `طلب سحب بقيمة ${r.amount.toLocaleString()} ج.م ينتظر معالجة الإدارة الأولى.`;
      } else if (r.status === 'processing') {
        body = `طلب السحب بقيمة ${r.amount.toLocaleString()} ج.م جاري تحويله وتدقيقه الآن.`;
      } else if (r.status === 'accepted') {
        body = `تمت الموافقة على طلب سحب بقيمة ${r.amount.toLocaleString()} ج.م عبر ${r.method === 'bank' ? 'البنك' : 'محفظة الهاتف'}.`;
      } else if (r.status === 'rejected') {
        body = `تم رفض طلب سحب بقيمة ${r.amount.toLocaleString()} ج.م. أعيد المبلغ بالكامل لمحفظتكم لعدم مطابقة الشروط.`;
      }

      list.push({
        id: `w-${r.id}`,
        title: `طلب سحب رصيد`,
        body,
        date: r.date,
        type: 'سحب',
        status: r.status,
        amount: r.amount
      });
    });

    // 2. Add deposits (wallet charges)
    (wallet?.transactions || []).filter(t => t.category === 'wallet_charge').forEach(t => {
      let body = '';
      if (t.status === 'pending') {
        body = `طلب شحن رصيد بقيمة ${t.amount.toLocaleString()} ج.م بانتظار التحقق من الإيداع.`;
      } else if (t.status === 'completed') {
        body = `جرت بنجاح إضافة مبلغ شحن رصيد ${t.amount.toLocaleString()} ج.م إلى رصيدكم الأساسي.`;
      } else if (t.status === 'cancelled') {
        body = `تم رفض/إلغاء لطلب شحن الرصيد بقيمة ${t.amount.toLocaleString()} ج.م.`;
      }

      list.push({
        id: `d-${t.id}`,
        title: `طلب شحن رصيد`,
        body,
        date: t.date,
        type: 'إيداع',
        status: t.status,
        amount: t.amount
      });
    });

    // Sort by date newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [wallet]);

  const filteredNotifications = useMemo(() => {
    if (financialFilter === 'all') return financialNotifications;
    if (financialFilter === 'with') return financialNotifications.filter(n => n.type === 'سحب');
    return financialNotifications.filter(n => n.type === 'إيداع');
  }, [financialNotifications, financialFilter]);

  const stats = useMemo(() => {
    let totalProfit = 0;
    let totalLoss = 0;
    let totalCOGS = 0;
    let totalShippingPaid = 0;
    let totalReturnedExpenses = 0;
    
    // Additional metrics for the new requested cards
    let awaitingDecisionCount = 0;
    let processingCount = 0;
    let outForDeliveryCount = 0;
    let awaitingPickupCount = 0;
    let headedToYouCount = 0;
    let successfulOrdersCount = 0;
    
    let actualCollection = 0;
    let expectedCollection = 0;

    let posSalesCount = 0;
    let websiteSalesCount = 0;
    let posRevenue = 0;
    let websiteRevenue = 0;

    let counts: Record<string, number> = {
      'في_انتظار_المكالمة': 0,
      'جاري_المراجعة': 0, 'قيد_التنفيذ': 0, 'تم_الارسال': 0, 'قيد_الشحن': 0,
      'تم_توصيلها': 0, 'تم_التحصيل': 0, 'مدفوعة': 0, 'مرتجع': 0, 'مرتجع_جزئي': 0,
      'فشل_التوصيل': 0, 'تمت_الاعادة_لشركة_الشحن': 0, 'ملغي': 0, 'مؤجل': 0, 'مجدول': 0
    };

    (orders || []).forEach((o: Order) => {
      if (counts[o.status] !== undefined) counts[o.status]++;
      
      const isPos = o.channel === 'pos' || o.id.startsWith('POS-');
      const orderRevenue = (o.totalPrice || (o.productPrice + o.shippingFee));

      if (isPos) {
          posSalesCount++;
          posRevenue += orderRevenue;
      } else {
          websiteSalesCount++;
          websiteRevenue += orderRevenue;
      }

      const { profit, loss } = calculateOrderProfitLoss(o, settings);
      totalProfit += profit;
      totalLoss += loss;

      const safeProductCost = getOrderProductCost(o) || 0;
      const safeShippingFee = Number(o.shippingFee) || 0;

      // Mapping for the 8 requested cards
      if (o.status === 'جاري_المراجعة' || o.status === 'في_انتظار_المكالمة') {
          awaitingDecisionCount++;
      }
      if (o.status === 'قيد_التنفيذ') {
          processingCount++;
      }
      if (o.status === 'تم_الارسال' || o.status === 'قيد_الشحن') {
          outForDeliveryCount++;
      }
      
      if (o.status === 'مرتجع' || o.status === 'تمت_الاعادة_لشركة_الشحن' || o.status === 'فشل_التوصيل') {
          headedToYouCount++;
          totalReturnedExpenses += loss;
      }
      
      if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة' || o.status === 'تم_توصيلها') {
          successfulOrdersCount++;
          actualCollection += (o.totalPrice || (o.productPrice + o.shippingFee));
          totalCOGS += safeProductCost;
          totalShippingPaid += safeShippingFee;
      } else if (!['ملغي', 'مرتجع', 'فشل_التوصيل'].includes(o.status)) {
          expectedCollection += (o.totalPrice || (o.productPrice + o.shippingFee));
      }
    });

    const cancelledCount = counts['ملغي'] || 0;
    const returnedCount = (counts['مرتجع'] || 0) + (counts['مرتجع_جزئي'] || 0) + (counts['تمت_الاعادة_لشركة_الشحن'] || 0);
    const failedCount = counts['فشل_التوصيل'] || 0;
    const delayedCount = (counts['مؤجل'] || 0) + (counts['مجدول'] || 0);

    // Logical fallback for "Awaiting Pickup" based on custom preparation status if available
    awaitingPickupCount = (orders || []).filter(o => o.status === 'قيد_التنفيذ' && (o as any).preparationStatus === 'بانتظار التجهيز').length;

    // Financial calculations for Inventory Value
    const totalInventoryValue = (settings?.products || []).reduce((acc, p) => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        return acc + p.variants.reduce((vAcc, v) => {
          const stock = v.stockQuantity ?? v.stock ?? 0;
          const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
          return vAcc + (stock * cost);
        }, 0);
      } else {
        const stock = p.stockQuantity ?? p.stock ?? 0;
        const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
        return acc + (stock * cost);
      }
    }, 0);

    // Liquid cash calculation
    const cashBalance = (wallet?.transactions || []).reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        if (t.details?.paidByPartnerId) return sum;
        if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
        if (t.type === 'سحب') return t.status === 'cancelled' ? sum : sum - amount;
        return sum;
    }, 0);

    const workingCapital = cashBalance + (wallet?.supplyBalance || 0) + totalInventoryValue;

    return { 
      net: totalProfit - totalLoss, 
      counts, 
      total: (orders || []).length,
      awaitingDecisionCount,
      processingCount,
      outForDeliveryCount,
      awaitingPickupCount,
      headedToYouCount,
      successfulOrdersCount,
      actualCollection,
      expectedCollection,
      totalCOGS,
      totalShippingPaid,
      totalReturnedExpenses,
      totalInventoryValue,
      workingCapital,
      posSalesCount,
      websiteSalesCount,
      posRevenue,
      websiteRevenue,
      cancelledCount,
      returnedCount,
      failedCount,
      delayedCount
    };
  }, [orders, settings, wallet]);

  const channelData = [
    { name: 'مبيعات الكاشير (POS)', value: stats.posRevenue, color: '#6366f1' },
    { name: 'مبيعات الأونلاين', value: stats.websiteRevenue, color: '#10b981' }
  ].filter(d => d.value > 0);

  const chartData = [
    { name: 'بانتظار مكالمة', value: stats.counts['في_انتظار_المكالمة'] || 0, color: '#06b6d4' },
    { name: 'مراجعة', value: stats.counts['جاري_المراجعة'] || 0, color: '#a855f7' },
    { name: 'تحصيل', value: (stats.counts['تم_التحصيل'] || 0) + (stats.counts['مدفوعة'] || 0), color: '#22c55e' },
    { name: 'مرتجع', value: (stats.counts['مرتجع'] || 0) + (stats.counts['فشل_التوصيل'] || 0) + (stats.counts['تمت_الاعادة_لشركة_الشحن'] || 0), color: '#ef4444' },
    { name: 'في الطريق', value: (stats.counts['قيد_الشحن'] || 0) + (stats.counts['تم_الارسال'] || 0), color: '#0ea5e9' },
    { name: 'مؤجل/مجدول', value: (stats.counts['مؤجل'] || 0) + (stats.counts['مجدول'] || 0), color: '#6366f1' }
  ];

  const lowStockProducts = (settings?.products || []).filter(p => (p.stockQuantity ?? 0) < 5);

  return (
    <motion.div 
      className="space-y-8 pb-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Platform Level Announcement Banner */}
      {announcementText && (
        <motion.div 
          variants={itemVariants}
          className={`p-4 rounded-3xl border flex items-center justify-between gap-4 transition-all ${
            announcementType === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-200'
              : announcementType === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200'
              : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/40 text-indigo-800 dark:text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {announcementType === 'warning' ? (
              <AlertTriangle className="text-amber-500 animate-pulse shrink-0" size={20} />
            ) : announcementType === 'error' ? (
              <ShieldAlert className="text-rose-500 shrink-0" size={20} />
            ) : (
              <AlertCircle className="text-indigo-500 shrink-0" size={20} />
            )}
            <div>
              <span className="text-xs font-black leading-relaxed">{announcementText}</span>
            </div>
          </div>
          <button 
            onClick={handleDismissAnnouncement}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2 sm:mb-3">
            أهلاً بك، {currentUser?.fullName.split(' ')[0]} 👋
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              متجرك نشط
            </span>
            <span className="text-[10px] sm:text-sm">تحديث: منذ دقيقتين</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:flex items-center gap-3">
          <Link to="/store-preview" className="glass-card px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
            <PlayCircle size={16} className="text-primary" />
            <span>معاينة</span>
          </Link>
          <button className="bg-primary text-white px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            إضافة منتج
          </button>
        </div>
      </motion.div>

      {/* AI Smart Assistant Banner */}
      <motion.div variants={itemVariants}>
        <SmartSuggestions orders={orders} settings={settings} />
      </motion.div>

      {/* NEW Quick Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardStatusCard 
          title="في إنتظار قرارك" 
          value={stats.awaitingDecisionCount} 
          color="text-orange-500"
        />
        <DashboardStatusCard 
          title="الأوردرات الناجحة" 
          value={`${stats.successfulOrdersCount} / ${stats.total}`} 
          color="text-emerald-600"
        />
        <DashboardStatusCard 
          title="متجه للعميل" 
          value={stats.outForDeliveryCount} 
          color="text-blue-600"
        />
        <DashboardStatusCard 
          title="قيد التنفيذ" 
          value={stats.processingCount} 
          color="text-purple-600"
        />
        
        {/* Additional Stats Row */}
        <DashboardStatusCard 
          title="المرتجعات" 
          value={stats.returnedCount} 
          color="text-rose-600"
        />
        <DashboardStatusCard 
          title="ملغي" 
          value={stats.cancelledCount} 
          color="text-slate-500"
        />
        <DashboardStatusCard 
          title="فشل التوصيل" 
          value={stats.failedCount} 
          color="text-red-500"
        />
        <DashboardStatusCard 
          title="مؤجل ومجدول" 
          value={stats.delayedCount} 
          color="text-amber-500"
        />

        {/* Financial collection and pickups */}
        <DashboardStatusCard 
          title="التحصيل الفعلي" 
          value={`${stats.actualCollection.toLocaleString()} ج.م`} 
          color="text-slate-700"
          badge={`${stats.total > 0 ? Math.round((stats.successfulOrdersCount / stats.total) * 100) : 0}%`}
        />
        <DashboardStatusCard 
          title="التحصيل المتوقع" 
          value={`${(stats.expectedCollection).toLocaleString()} ج.م`} 
          color="text-slate-700"
        />
        <DashboardStatusCard 
          title="في انتظار الاستلام" 
          value={stats.awaitingPickupCount} 
          color="text-slate-700"
        />
        <DashboardStatusCard 
          title="متجه إليك" 
          value={stats.headedToYouCount} 
          color="text-slate-700"
        />
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Stats - Large Card */}
        <motion.div variants={itemVariants} className="md:col-span-8 glass-card p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-colors" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">الأداء المالي</h3>
              <select className="bg-transparent border-none text-sm font-bold text-slate-500 focus:ring-0 cursor-pointer">
                <option>آخر 7 أيام</option>
                <option>آخر 30 يوم</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* صافي الأرباح */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-500 animate-bounce" />
                  <span>صافي الأرباح</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.net.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">الأرباح المتبقية بعد خصم تكاليف الشحن والمصاريف</p>
              </div>

              {/* رصيد المحفظة */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <WalletIcon size={16} className="text-indigo-500" />
                  <span>رصيد المحفظة السائل</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                  {((wallet?.transactions || []).reduce((sum, t) => {
                      const amount = Number(t.amount) || 0;
                      if (t.details?.paidByPartnerId) return sum;
                      if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
                      if (t.type === 'سحب') return t.status === 'cancelled' ? sum : sum - amount;
                      return sum;
                  }, 0) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">السيولة النقدية المتاحة للتوزيع والسحب الفوري</p>
              </div>

              {/* رأس المال العامل الكلي */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers size={16} className="text-blue-500" />
                  <span>رأس المال العامل الكلي</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-blue-605 dark:text-blue-400 tabular-nums animate-pulse-slow">
                  {stats.workingCapital.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">إجمالي الأصول (السيولة + محفظة التوريد + البضاعة بالتكلفة)</p>
              </div>

              {/* تكلفة البضاعة المباعة COGS */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <Package size={16} className="text-amber-500" />
                  <span>تكلفة البضائع المباعة (COGS)</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-200 tabular-nums">
                  {stats.totalCOGS.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">إجمالي تكلفة شراء المنتجات للأوردرات الناجحة</p>
              </div>

              {/* قيمة البضائع في المستودع */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <Clock size={16} className="text-cyan-500" />
                  <span>قيمة المخزون الحالي (بالتكلفة)</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-200 tabular-nums">
                  {stats.totalInventoryValue.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.m</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">قيمة كل قطعة بضاعة موجودة حالياً بالمخزن بسعر التكلفة</p>
              </div>

              {/* رسوم ومصاريف التشغيل */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <Truck size={16} className="text-rose-500" />
                  <span>رسوم شحن ومصاريف تشغيل</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-rose-500 dark:text-rose-400 tabular-nums">
                  {(stats.totalShippingPaid + stats.totalReturnedExpenses).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">إجمالي تكاليف التوصيل + خسائر الشحن للأوردرات الراجعة</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions / Status - Vertical Bento */}
        <motion.div variants={itemVariants} className="md:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-3xl h-full flex flex-col justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6">حالات الطلبات</h3>
            <div className="space-y-4">
              <StatusItem label="بانتظار تأكيد" value={stats.counts['في_انتظار_المكالمة']} color="bg-cyan-500" />
              <StatusItem label="قيد المراجعة" value={stats.counts['جاري_المراجعة']} color="bg-purple-500" />
              <StatusItem label="تم التحصيل" value={stats.counts['تم_التحصيل']} color="bg-emerald-500" />
              <StatusItem label="مرتجعات" value={stats.counts['مرتجع']} color="bg-rose-500" />
            </div>
            <Link to="/orders" className="mt-8 text-center text-sm font-bold text-primary hover:underline">
              إدارة كافة الطلبات
            </Link>
          </div>
        </motion.div>

        {/* Analytics Chart - Bento Card */}
        <motion.div variants={itemVariants} className="md:col-span-6 glass-card p-8 rounded-3xl min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">توزيع المبيعات (حالات)</h3>
            <ChartIcon size={20} className="text-slate-400" />
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} className="outline-none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    backdropFilter: 'blur(10px)',
                    border: 'none',
                    borderRadius: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Channel Breakdown - ONLY SHOW IF POS DATA EXISTS */}
        {channelData.length > 1 && (
          <motion.div variants={itemVariants} className="md:col-span-6 glass-card p-8 rounded-3xl min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">تحليل قنوات البيع (Online vs POS)</h3>
              <Monitor size={20} className="text-indigo-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 h-full items-center">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                {channelData.map(item => (
                  <div key={item.name} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-bold text-slate-500">{item.name}</span>
                    </div>
                    <p className="text-xl font-black text-slate-800 dark:text-white">{item.value.toLocaleString()} ج.م</p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {item.name.includes('POS') ? `${stats.posSalesCount} فاتورة` : `${stats.websiteSalesCount} طلب`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Financial Alerts & Team Performance */}
        <motion.div variants={itemVariants} className="md:col-span-12 glass-card p-8 rounded-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <WalletIcon className="text-primary" size={20} />
                    إشعارات القسم المالي
                  </h3>
                  
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold font-sans self-start">
                    <button
                      onClick={() => setFinancialFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${financialFilter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      الكل
                    </button>
                    <button
                      onClick={() => setFinancialFilter('with')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${financialFilter === 'with' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      سحب
                    </button>
                    <button
                      onClick={() => setFinancialFilter('dep')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${financialFilter === 'dep' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      إيداع
                    </button>
                  </div>
                </div>

                {filteredNotifications.length > 0 ? (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {filteredNotifications.slice(0, 5).map(n => {
                      let alertBg = 'bg-slate-50 dark:bg-slate-800/40 border-slate-100';
                      let iconColor = 'text-slate-400';
                      let statusText = '';
                      let statusBg = 'bg-slate-100 text-slate-600';

                      if (n.status === 'accepted' || n.status === 'completed') {
                        alertBg = 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100/50 dark:border-emerald-900/40';
                        iconColor = 'text-emerald-500';
                        statusText = 'مقبول';
                        statusBg = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
                      } else if (n.status === 'rejected' || n.status === 'cancelled') {
                        alertBg = 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-100/50 dark:border-rose-900/40';
                        iconColor = 'text-rose-500';
                        statusText = 'مرفوض';
                        statusBg = 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300';
                      } else if (n.status === 'pending') {
                        alertBg = 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-100/50 dark:border-amber-900/40';
                        iconColor = 'text-amber-500 animate-pulse';
                        statusText = 'مراجعة';
                        statusBg = 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
                      }

                      return (
                        <div key={n.id} className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all hover:bg-white dark:hover:bg-slate-800 ${alertBg}`}>
                          <div className="mt-0.5">
                            {n.status === 'accepted' || n.status === 'completed' ? (
                              <CheckCircle2 size={16} className={iconColor} />
                            ) : n.status === 'rejected' || n.status === 'cancelled' ? (
                              <AlertCircle size={16} className={iconColor} />
                            ) : (
                              <Clock size={16} className={iconColor} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{n.title}</span>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {new Date(n.date).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">{n.body}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${statusBg}`}>
                                {statusText}
                              </span>
                              <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 tabular-nums">
                                {n.amount.toLocaleString()} ج.م
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 py-12">
                    <WalletIcon size={40} className="stroke-1 opacity-25 mb-3" />
                    <p className="text-sm font-bold">لا توجد حركات مالية مسجلة حالياً.</p>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                    <Link to="/wallet" className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">
                      عرض كافة العمليات المالية من المحفظة <ArrowLeft size={12} />
                    </Link>
                </div>
            </div>

            <div className="lg:col-span-5 border-r lg:border-r-0 lg:border-right border-slate-100 dark:border-slate-800 lg:pr-8">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-6">
                    <TrendingUp className="text-emerald-500" size={20} />
                    أعلى الموظفين إنجازاً (اليوم)
                </h3>
                
                <div className="space-y-3">
                  {(() => {
                    const today = new Date().toISOString().split('T')[0];
                    const statsMap: Record<string, { name: string; confirmed: number; total: number }> = {};
                    
                    (settings.employees || []).filter(e => e.status === 'active' || !e.status).forEach(emp => {
                        statsMap[emp.phone] = { name: emp.name, confirmed: 0, total: 0 };
                    });

                    orders.forEach(o => {
                        (o.confirmationLogs || []).forEach(log => {
                            if (log.timestamp.startsWith(today)) {
                                if (!statsMap[log.userId]) {
                                    statsMap[log.userId] = { name: log.userName || 'موظف', confirmed: 0, total: 0 };
                                }
                                statsMap[log.userId].total++;
                                if (log.action === 'تم التأكيد') statsMap[log.userId].confirmed++;
                            }
                        });
                    });

                    const sortedStats = Object.entries(statsMap)
                        .filter(([_, info]) => info.total > 0)
                        .sort((a,b) => b[1].confirmed - a[1].confirmed)
                        .slice(0, 5);

                    if (sortedStats.length === 0) {
                        return (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
                                <Users2 size={32} className="opacity-20 mb-2" />
                                <p className="text-xs font-bold">لا يوجد نشاط للفريق حتى الآن</p>
                            </div>
                        );
                    }

                    return sortedStats.map(([id, info], idx) => (
                      <div key={id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-hover hover:border-indigo-200">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-white dark:bg-slate-700 text-slate-500'}`}>
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[100px]">{info.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 capitalize">{Math.round((info.confirmed/info.total)*100)}% معدل تأكيد</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-600 tabular-nums">{info.confirmed}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">مؤكد</p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <Link to="/confirmation-queue" className="mt-6 w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black hover:bg-indigo-50 transition-colors">
                    غرفة تأكيد الطلبات <Monitor size={14} />
                </Link>
            </div>
          </div>
        </motion.div>

        {/* Inventory & Alerts - Bento Card */}
        <motion.div variants={itemVariants} className="md:col-span-6 glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">تنبيهات المخزون</h3>
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          
          {lowStockProducts.length > 0 ? (
            <div className="space-y-4">
              {lowStockProducts.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                      <Package size={20} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500">SKU: {p.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-rose-500">{p.stockQuantity} قطع</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">مخزون منخفض</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <CheckCircle2 size={48} className="text-emerald-500/20 mb-4" />
              <p className="font-bold">المخزون سليم تماماً</p>
            </div>
          )}
        </motion.div>

      </div>

      {/* Footer Branding */}
      <motion.div variants={itemVariants} className="pt-12 border-t border-slate-200 dark:border-slate-800/50">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">
            <div className="w-8 h-[1px] bg-current opacity-20" />
            OneToolz Dashboard v2.0
            <div className="w-8 h-[1px] bg-current opacity-20" />
          </div>
          <p className="text-[10px] text-slate-400 text-center max-w-xs leading-relaxed">
            تم التصميم والبرمجة بواسطة عبدالرحمن سعيد. جميع الحقوق محفوظة © 2026
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

const StatusItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="flex items-center justify-between group cursor-default">
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.1)]`} />
      <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{label}</span>
    </div>
    <span className="text-sm font-black text-slate-800 dark:text-white tabular-nums">{value}</span>
  </div>
);

const DashboardStatusCard = ({ title, value, color, badge }: { title: string, value: string | number, color: string, badge?: string }) => (
  <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col items-end justify-center min-h-[80px] sm:min-h-[100px] group hover:border-primary/30 transition-all">
      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 opacity-20 group-hover:opacity-100 transition-opacity">
           <Clock size={12} className="text-slate-400 dark:text-slate-500" />
      </div>
      <div className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-black mb-1 sm:mb-1.5">{title}</div>
      <div className={`text-base sm:text-2xl font-black ${color} flex items-center gap-1 sm:gap-2 tabular-nums`}>
          {badge && (
              <span className="text-[8px] sm:text-[10px] bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300 px-1 sm:px-1.5 py-0.5 rounded-full font-black">
                  {badge}
              </span>
          )}
          {value}
      </div>
  </div>
);


interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const StatCard = ({ title, value, icon }: StatCardProps) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
        {icon}
    </div>
    <div>
      <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">{title}</div>
      <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  </div>
);

interface SmallStatProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

const SmallStat = ({ title, value, icon, colorClass }: SmallStatProps) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
      <div className={`flex items-center justify-center gap-2 font-bold text-slate-500 dark:text-slate-400 mb-1 ${colorClass}`}>
          {icon}
          <span className="text-sm">{title}</span>
      </div>
      <div className="text-2xl font-black text-slate-800 dark:text-white">{value}</div>
  </div>
);

export default Dashboard;
