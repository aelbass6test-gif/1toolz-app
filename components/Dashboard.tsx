import React, { useMemo, useState, useEffect } from 'react';
import { parseSafeDate } from '../utils/dateUtils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Package, CheckCircle2, Wallet as WalletIcon, Truck, RefreshCcw, FileSearch, Check, PlayCircle, X, AlertTriangle, ArrowRight, Lightbulb, Loader, BrainCircuit, PhoneForwarded, PieChart as ChartIcon, Clock, AlertCircle, ShieldAlert, Layers, DollarSign, Monitor, ArrowLeft, Users2, ArrowUpLeft, ShoppingBag, Sparkles, Percent, ArrowDown, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { Order, Settings, Wallet, User, CustomerProfile, Store, Treasury } from '../types';
import { Link } from 'react-router-dom';
import { motion, Variants, Reorder } from 'framer-motion';
import { generateDashboardSuggestions } from '../services/geminiService';
import { calculateOrderProfitLoss, getOrderProductCost, getLatestProductCost, calculateInsuranceFee, calculateBostaVat, getStandardShippingFee, getVirtualOrderHandovers } from '../utils/financials';
import { DashboardManager, DashboardWidget, WidgetWrapper } from './dashboard/DashboardWidgets';
import { useInventoryVisibility } from '../utils/useInventoryVisibility';
import { DailySalesProfitChart } from './dashboard/DailySalesProfitChart';

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
    const [suggestions, setSuggestions] = useState('اضغط على زر التحديث للحصول على اقتراحات وتحليلات ذكية لمتجرك.');
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
        <div className="surface-card p-6 sm:p-7 relative overflow-hidden h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                        <Sparkles size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-slate-900 dark:text-white text-base">المستشار الذكي (AI Suggestions)</h3>
                            <span className="px-2.5 py-0.5 text-[9px] font-black rounded-full bg-gradient-to-r from-amber-500 to-purple-600 text-white shadow-xs">
                                Gemini AI ✨
                            </span>
                        </div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">تحليلات فورية وتوصيات لزيادة المبيعات وكفاءة العمليات</p>
                    </div>
                </div>
                <button 
                    onClick={fetchSuggestions} 
                    disabled={isLoading} 
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait cursor-pointer self-start sm:self-auto"
                >
                    <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} />
                    <span>{isLoading ? 'جاري التحليل...' : 'تحديث الاقتراحات الذكية'}</span>
                </button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-3 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <BrainCircuit size={28} className="text-purple-500 animate-bounce" />
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300">مستشار الذكاء الاصطناعي يقوم بتحليل المبيعات والعملاء والمخزون...</span>
                </div>
            ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {suggestions.split('\n').map((line, i) => (
                        <p key={i} className="my-1.5 flex items-start gap-2">
                            {line.startsWith('•') || line.startsWith('-') ? (
                                <span className="text-amber-500 font-black">✦</span>
                            ) : null}
                            <span>{line.replace(/^[•-]\s*/, '')}</span>
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};


const Dashboard = ({ orders, settings, wallet, treasury, currentUser, activeStore }: { orders: Order[], settings: Settings, wallet: Wallet, treasury: Treasury | undefined, currentUser: User | null, activeStore: Store | undefined }) => {
  const { showInventoryValue, toggleInventoryValue } = useInventoryVisibility();
  const [showVideoBanner, setShowVideoBanner] = useState(true);
  const [financialFilter, setFinancialFilter] = useState<'all' | 'with' | 'dep'>('all');
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showDetailedFinancials, setShowDetailedFinancials] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);

  const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
    { id: 'suggestions', title: '💡 الاقتراحات الذكية', visible: true, type: 'full' },
    { id: 'kpis', title: '📊 مؤشرات الأداء وحالات الطلبات', visible: true, type: 'full' },
    { id: 'daily_chart', title: '📈 المبيعات والأرباح اليومية', visible: true, type: 'full' },
    { id: 'finance_history', title: '💳 الأداء المالي وسجل التداولات', visible: true, type: 'full' },
    { id: 'team_performance', title: '👥 أداء الفريق والموظفين', visible: true, type: 'full' },
    { id: 'inventory_alerts', title: '⚠️ تنبيهات المخزون', visible: true, type: 'half' },
    { id: 'top_products', title: '🔥 الأكثر مبيعاً هذا الشهر', visible: true, type: 'half' },
    { id: 'supplier_debt', title: '🏢 ديون ومستحقات الموردين', visible: true, type: 'full' },
    { id: 'distributed_custody', title: '🪙 العهد النقدية الموزعة', visible: true, type: 'full' },
  ];

  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    const saved = localStorage.getItem('dashboard_layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const loaded: DashboardWidget[] = [];
          const seen = new Set<string>();
          for (const item of parsed) {
            const def = DEFAULT_DASHBOARD_WIDGETS.find(w => w.id === item?.id);
            if (def) {
              loaded.push({ ...def, visible: item.visible !== false });
              seen.add(def.id);
            }
          }
          for (const def of DEFAULT_DASHBOARD_WIDGETS) {
            if (!seen.has(def.id)) {
              loaded.push({ ...def, visible: true });
            }
          }
          if (loaded.length > 0) return loaded;
        }
      } catch (e) {
        console.warn('Failed to parse dashboard layout from localStorage:', e);
      }
    }
    return DEFAULT_DASHBOARD_WIDGETS;
  });

  useEffect(() => {
    try {
      const serializableLayout = widgets.map(w => ({
        id: w.id,
        visible: Boolean(w.visible)
      }));
      localStorage.setItem('dashboard_layout', JSON.stringify(serializableLayout));
    } catch (e) {
      console.warn('Failed to persist dashboard layout to localStorage:', e);
    }
  }, [widgets]);

  const handleToggleWidget = (id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const handleAddWidget = (id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: true } : w));
  };

  const SuggestionsWidget = () => (
    <div className="h-full">
      <SmartSuggestions orders={orders} settings={settings} />
    </div>
  );

  const KpisWidget = () => (
    <div className="space-y-10 h-full">
      {/* 📊 E-commerce Pro KPIs Hub */}
      <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[2.5rem] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <span className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/60">
                <BarChart3 size={20} />
              </span>
              <span>كفاءة الأداء التشغيلي</span>
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400">مؤشرات الأداء الرئيسية (KPIs) لنمو متجرك</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* KPI 1: Delivery success rate */}
          <div className="surface-card surface-card-hover group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-emerald-500/10 transition-all" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600/80 dark:text-emerald-400/80">أداء الشحن</span>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold">معدل نجاح التسليم</p>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.deliveryRate}%</span>
              </div>
            </div>
            <div className="mt-6 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${stats.deliveryRate}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  stats.deliveryRate > 75 ? 'bg-emerald-500' : stats.deliveryRate > 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
              />
            </div>
          </div>

          {/* KPI 2: Average Order Value */}
          <div className="surface-card surface-card-hover group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-indigo-500/10 transition-all" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <DollarSign size={20} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600/80 dark:text-indigo-400/80">المعدل التجاري</span>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold">متوسط قيمة السلة</p>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{(stats.aov ?? 0).toLocaleString()}</span>
                <span className="text-xs font-bold text-slate-400">ج.م</span>
              </div>
            </div>
          </div>

          {/* KPI 3: Net Profit Margin */}
          <div className="surface-card surface-card-hover group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-cyan-500/10 transition-all" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl">
                <Percent size={20} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-600/80 dark:text-cyan-400/80">صحة الهامش</span>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold">هامش صافي الربح</p>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.netMargin}%</span>
              </div>
            </div>
            <div className="mt-6 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(stats.netMargin, 0)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full bg-cyan-500"
              />
            </div>
          </div>

          {/* KPI 4: Active unique customers */}
          <div className="surface-card surface-card-hover group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-purple-500/10 transition-all" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl">
                <Users2 size={20} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-purple-600/80 dark:text-purple-400/80">قاعدة العملاء</span>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold">العملاء الفريدين</p>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.uniqueCustomerCount}</span>
                <span className="text-xs font-bold text-slate-400">عميل</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔄 Pipeline and tracking */}
      <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[2.5rem] shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700">
              <Layers size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">دورة حياة الطلبات اليومية</h2>
              <p className="text-xs text-slate-400 font-bold">تتبع لحظي وشامل لجميع شحنات المبيعات والتحصيلات</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <DashboardStatusCard title="ناجحة" value={stats.successfulOrdersCount} color="text-emerald-600 dark:text-emerald-400" />
          <DashboardStatusCard title="بانتظار قرار" value={stats.awaitingDecisionCount} color="text-amber-600 dark:text-amber-400" />
          <DashboardStatusCard title="خرج للتوصيل" value={stats.outForDeliveryCount} color="text-blue-600 dark:text-blue-400" />
          <DashboardStatusCard title="قيد التنفيذ" value={stats.processingCount} color="text-purple-600 dark:text-purple-400" />
          <DashboardStatusCard title="توقع التحصيل" value={`${(stats.expectedCollection).toLocaleString()}`} color="text-slate-900 dark:text-white" badge="ج.م" />
          <DashboardStatusCard title="تحصيل فعلي" value={`${(stats.actualCollection).toLocaleString()}`} color="text-emerald-600 dark:text-emerald-400" badge="ج.م" />
        </div>

        <motion.div 
          initial={false}
          animate={{ height: showDetailedStats ? 'auto' : 0, opacity: showDetailedStats ? 1 : 0 }}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
            <DashboardStatusCard title="المرتجعات" value={stats.returnedCount} color="text-rose-600 dark:text-rose-400" />
            <DashboardStatusCard title="فشل التوصيل" value={stats.failedCount} color="text-rose-500" />
            <DashboardStatusCard title="ملغي" value={stats.cancelledCount} color="text-slate-500" />
            <DashboardStatusCard title="مؤجل" value={stats.delayedCount} color="text-amber-500" />
            <DashboardStatusCard title="بانتظار استلام" value={stats.awaitingPickupCount} color="text-slate-600 dark:text-slate-400" />
            <DashboardStatusCard title="متجه إليك" value={stats.headedToYouCount} color="text-rose-500" />
          </div>
        </motion.div>

        <div className="flex justify-center pt-2">
          <button 
            type="button"
            onClick={() => setShowDetailedStats(!showDetailedStats)}
            className="px-6 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-2 border border-slate-200/60 dark:border-slate-700/60"
          >
            {showDetailedStats ? 'إخفاء الحالات الإضافية' : 'عرض كافة الحالات'}
            <ArrowDown className={`transition-transform duration-300 ${showDetailedStats ? 'rotate-180' : ''}`} size={12} />
          </button>
        </div>
      </div>
    </div>
  );

  const FinanceHistoryWidget = () => (
    <div className="surface-card p-8 sm:p-10 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">الأداء المالي والسيولة</h3>
            <p className="text-sm font-bold text-slate-400">تحليل الميزانية، الأرباح، والتدفقات النقدية اللحظية</p>
          </div>
          <button 
            type="button"
            onClick={() => setShowDetailedFinancials(!showDetailedFinancials)}
            className="btn-secondary py-2.5 px-5 flex items-center gap-2 text-xs"
          >
            <ChartIcon size={14} />
            <span>{showDetailedFinancials ? 'تقليل العرض' : 'تحليلات تفصيلية'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* صافي الأرباح */}
          <div className="space-y-3 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-white/5 transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">صافي الأرباح</p>
            <h4 className={`text-3xl font-black tabular-nums tracking-tighter ${(stats.net ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {(stats.net ?? 0).toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">ج.م</span>
            </h4>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${(stats.revenueGrowth ?? 0) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                {(stats.revenueGrowth ?? 0) >= 0 ? '↑' : '↓'} {(stats.revenueGrowth ?? 0).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 font-bold">نمو المبيعات</span>
            </div>
          </div>

          {/* مجمل الأرباح */}
          <div className="space-y-3 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-white/5 transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">مجمل الربح</p>
            <h4 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
              {(stats.grossProfit ?? 0).toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">ج.م</span>
            </h4>
            <p className="text-[10px] text-slate-400 font-bold">قبل خصم المصاريف</p>
          </div>

          {/* ROI */}
          <div className="space-y-3 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-white/5 transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">العائد على الاستثمار</p>
            <h4 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums tracking-tighter">
              {stats.roi.toFixed(1)}%
            </h4>
            <p className="text-[10px] text-slate-400 font-bold">كفاءة العائد (ROI)</p>
          </div>

          {/* Liquidity */}
          <div className="space-y-3 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-white/5 transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">معامل السيولة</p>
            <h4 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
              {stats.liquidityCoverage}
            </h4>
            <p className="text-[10px] text-slate-400 font-bold">شهور تغطية</p>
          </div>
        </div>

        {/* 6-Month Area Chart */}
        <div className="pt-10 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-sm font-black text-slate-900 dark:text-white">تحليل التدفق النقدي (آخر 6 أشهر)</h4>
            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> الإيرادات</span>
              <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700"></span> المصروفات</span>
            </div>
          </div>
          <div className="h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.financeHistory}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: '#fff', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 800 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expenses" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="6 6" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const TeamList = () => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23,59,59,999);

    const statsMap: Record<string, { name: string; confirmed: number; total: number }> = {};
    
    (settings.employees || []).filter(e => e.status === 'active' || !e.status).forEach(emp => {
        statsMap[emp.phone] = { name: emp.name, confirmed: 0, total: 0 };
    });

    orders.forEach(o => {
        (o.confirmationLogs || []).forEach(log => {
            const logDate = parseSafeDate(log.timestamp);
            if (logDate && logDate.getTime() >= startOfDay.getTime() && logDate.getTime() <= endOfDay.getTime()) {
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

    return (
      <div className="space-y-3">
        {sortedStats.map(([id, info], idx) => (
          <div key={id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 transition-hover hover:border-indigo-200">
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
        ))}
      </div>
    );
  };

  const SupplierDebtWidget = () => (
    <div className="glass-card p-6 sm:p-8 rounded-3xl h-full border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Layers className="text-rose-500" size={24} />
          ديون ومستحقات الموردين (Accounts Payable)
        </h3>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-400">إجمالي المديونية</span>
          <p className="text-lg font-black text-rose-600">-{(stats.supplierDebt ?? 0).toLocaleString()} ج.م</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(settings.suppliers || []).filter(s => (s.balance || 0) > 0).slice(0, 8).map(supplier => (
           <div key={supplier.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-rose-200 transition-colors group">
              <div className="flex items-center gap-3 mb-3">
                 <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black text-base transition-transform group-hover:scale-110">
                    {supplier.name.charAt(0)}
                 </div>
                 <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{supplier.name}</p>
                    <p className="text-[10px] font-bold text-slate-400">مورد خارجي</p>
                 </div>
              </div>
              <div className="flex items-end justify-between">
                 <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">مستحق السداد له</p>
                    <p className="text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">{(supplier.balance || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></p>
                 </div>
                 <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/suppliers`} className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-400 hover:text-primary transition-colors shadow-sm">
                    <ArrowLeft size={16} />
                 </Link>
              </div>
           </div>
        ))}
        {(settings.suppliers || []).filter(s => (s.balance || 0) > 0).length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                <p className="text-sm font-bold italic">لا توجد مديونيات للموردين حالياً ✨</p>
            </div>
        )}
      </div>
    </div>
  );

  const DistributedCustodyWidget = () => (
    <div className="glass-card p-6 sm:p-8 rounded-3xl h-full border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Users2 className="text-orange-500" size={24} />
          تفاصيل العهد النقدية الموزعة (الموظفين)
        </h3>
        <span className="text-xs font-bold text-slate-400">إجمالي العهد: {(stats.totalCustodyBalance ?? 0).toLocaleString()} ج.م</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(holders || []).slice(0, 8).map(holder => {
           const isManager = holder.userId === 'admin' || holder.originalIds?.includes('admin') || holder.userName === 'المدير' || holder.userName === 'المدير (أنت)';
           const isPartner = settings?.partners?.find(p => p.id === holder.userId || holder.originalIds?.includes(p.id) || holder.originalIds?.includes(`part_${p.id}`) || holder.originalIds?.includes(`partner_${p.id}`) || normalizeName(p.name) === holder.userName);
           const isEmployee = settings?.employees?.find(e => e.id === holder.userId || holder.originalIds?.includes(e.id) || holder.originalIds?.includes(`emp_${e.id}`) || holder.originalIds?.includes(`employee_${e.id}`) || normalizeName(e.name) === holder.userName);

           return (
            <div key={holder.userId} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-orange-200 transition-colors group">
               <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-base transition-transform group-hover:scale-110">
                     {holder.userName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                     <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{holder.userName}</p>
                     <p className="text-[10px] font-bold text-slate-400">
                       {isManager ? 'المدير' : isPartner ? 'شريك' : isEmployee ? 'موظف مفوض' : 'عهدة'}
                     </p>
                  </div>
               </div>
               <div className="flex items-end justify-between">
                  <div className="space-y-0.5">
                     <p className="text-[9px] font-bold text-slate-400 uppercase">الرصيد في عهدته</p>
                     <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{(holder.currentBalance || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></p>
                  </div>
                  <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/cash-management`} className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-400 hover:text-primary transition-colors shadow-sm">
                     <ArrowLeft size={16} />
                  </Link>
               </div>
            </div>
           );
        })}
        {(holders || []).length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                <p className="text-sm font-bold italic">لا توجد عهد موزعة حالياً ✨</p>
            </div>
        )}
      </div>
    </div>
  );

  const renderWidgetContent = (id: string) => {
    switch (id) {
      case 'suggestions': return <SuggestionsWidget />;
      case 'kpis': return <KpisWidget />;
      case 'daily_chart': return <DailySalesProfitChart orders={orders} settings={settings} />;
      case 'finance_history': return <FinanceHistoryWidget />;
      case 'team_performance': return (
        <div className="glass-card p-6 sm:p-8 rounded-3xl h-full border border-slate-200 dark:border-slate-800">
           <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-6">
              <TrendingUp className="text-emerald-500" size={20} /> أعلى الموظفين إنجازاً
           </h3>
           <TeamList />
        </div>
      );
      case 'inventory_alerts': return (
        <div className="glass-card p-6 rounded-3xl h-full flex flex-col justify-between border border-slate-200/60 dark:border-slate-800">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="text-amber-500 animate-pulse" size={20} />
                تنبيهات المخزون الذكية
              </h3>
              <Link to="/products" className="text-xs font-bold text-indigo-600 hover:underline">إدارة</Link>
            </div>
            {lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {lowStockProducts.slice(0,3).map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                     <span className="text-xs font-bold truncate max-w-[150px]">{p.name}</span>
                     <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-black text-xs tabular-nums">{p.stockQuantity} قطعة</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-emerald-600 font-bold text-sm bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl">المخزون في حالة ممتازة ✨</div>
            )}
          </div>
          <Link to="/products" className="mt-4 block text-center py-2 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-600/20 transition-all">🚀 فتح مركز الذكاء الاصطناعي للمخزون</Link>
        </div>
      );
      case 'top_products': return (
        <div className="glass-card p-6 rounded-3xl h-full flex flex-col justify-between border border-slate-200/60 dark:border-slate-800">
           <div>
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                 <Sparkles className="text-indigo-500" size={20} />
                 الأكثر مبيعاً هذا الشهر
               </h3>
               <Link to="/products" className="text-xs font-bold text-indigo-600 hover:underline">الكل</Link>
             </div>
             <div className="space-y-2">
               {stats.topProducts.slice(0,3).map((p: any, idx: number) => (
                 <div key={p.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                   <div className="flex items-center gap-2">
                     <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center">#{idx+1}</span>
                     <span className="text-xs font-bold truncate max-w-[140px]">{p.name}</span>
                   </div>
                   <span className="font-black text-indigo-600 dark:text-indigo-400 text-xs tabular-nums">{p.salesCount} بيعة</span>
                 </div>
               ))}
             </div>
           </div>
           <Link to="/products" className="mt-4 block text-center py-2 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl hover:bg-emerald-600/20 transition-all">📊 عرض مصفوفة الربحية والتحليل</Link>
        </div>
      );
      case 'supplier_debt': return <SupplierDebtWidget />;
      case 'distributed_custody': return <DistributedCustodyWidget />;
      default: return null;
    }
  };
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
        body = `طلب سحب بقيمة ${(r.amount ?? 0).toLocaleString()} ج.م ينتظر معالجة الإدارة الأولى.`;
      } else if (r.status === 'processing') {
        body = `طلب السحب بقيمة ${(r.amount ?? 0).toLocaleString()} ج.م جاري تحويله وتدقيقه الآن.`;
      } else if (r.status === 'accepted') {
        body = `تمت الموافقة على طلب سحب بقيمة ${(r.amount ?? 0).toLocaleString()} ج.م عبر ${r.method === 'bank' ? 'البنك' : 'محفظة الهاتف'}.`;
      } else if (r.status === 'rejected') {
        body = `تم رفض طلب سحب بقيمة ${(r.amount ?? 0).toLocaleString()} ج.م. أعيد المبلغ بالكامل لمحفظتكم لعدم مطابقة الشروط.`;
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

    // 2. Add all completed or pending transactions
    (wallet?.transactions || []).forEach(t => {
      let title = t.category === 'wallet_charge' ? 'طلب شحن رصيد' : 
                  t.type === 'إيداع' ? 'حركة توريد / تحصيل' : 'حركة سحب / مصروف';
      
      let body = '';
      const amountStr =(t.amount ?? 0).toLocaleString();

      if (t.category === 'wallet_charge') {
        if (t.status === 'pending') {
          body = `طلب شحن رصيد بقيمة ${amountStr} ج.م بانتظار التحقق من الإيداع.`;
        } else if (t.status === 'completed') {
          body = `جرت بنجاح إضافة مبلغ شحن رصيد ${amountStr} ج.م إلى رصيدكم الأساسي.`;
        } else if (t.status === 'cancelled') {
          body = `تم رفض/إلغاء لطلب شحن الرصيد بقيمة ${amountStr} ج.م.`;
        }
      } else if (t.category === 'collection') {
        body = `تم إيداع مبلغ تحصيل طلب #${t.orderNumber || t.id} بقيمة ${amountStr} ج.م.`;
      } else if (t.category === 'manual_deposit') {
        body = `إيداع يدوي بقيمة ${amountStr} ج.م: ${t.note}`;
      } else if (t.category === 'manual_withdrawal') {
        body = `سحب يدوي بقيمة ${amountStr} ج.م: ${t.note}`;
      } else if (t.category?.startsWith('expense_')) {
        body = `صرف مصروفات التشغيل بقيمة ${amountStr} ج.م: ${t.note}`;
      } else {
        body = `${t.note || `عملية ${t.type} بقيمة ${amountStr} ج.م`}`;
      }

      list.push({
        id: `t-${t.id}`,
        title,
        body,
        date: t.date,
        type: t.type,
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

  // Helper for normalizing names in custody ledger
  const normalizeName = (name: string): string => {
    if (!name) return '';
    let normalized = name.trim().replace(/\s+/g, ' ');
    normalized = normalized.replace(/\s*\((شريك|موظف|المدير|شريكه|partner|employee|admin|أنت|انت)\)/gi, '');
    normalized = normalized.replace(/\s+(شريك|موظف|المدير|شريكه|partner|employee|admin)$/gi, '');
    normalized = normalized
      .replace(/أ/g, 'ا')
      .replace(/إ/g, 'ا')
      .replace(/آ/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .toLowerCase()
      .trim();
    if (/^(زهره|زهرة)/.test(normalized)) {
        return 'زهره';
    }
    return normalized;
  };

  const holders = useMemo(() => {
    const rawHolders = settings?.cashHolders || [];
    const grouped: Record<string, any> = {};
    
    // First group by normalized name from original cashHolders to avoid duplicates
    rawHolders.forEach((h: any) => {
        if (!h.userName) return;
        const name = normalizeName(h.userName);
        if (!grouped[name]) {
            grouped[name] = {
                userId: h.userId,
                userName: h.userName,
                currentBalance: h.currentBalance || 0,
                lastUpdated: h.lastUpdated || new Date().toISOString(),
                originalIds: [h.userId]
            };
        } else {
            grouped[name].currentBalance += (h.currentBalance || 0);
            if (!grouped[name].originalIds.includes(h.userId)) {
              grouped[name].originalIds.push(h.userId);
            }
            if (h.lastUpdated && new Date(h.lastUpdated) > new Date(grouped[name].lastUpdated)) {
                grouped[name].lastUpdated = h.lastUpdated;
            }
        }
    });

    const baseHandovers = settings?.cashHandovers || [];
    const virtuals = getVirtualOrderHandovers(orders, settings, treasury);
    const handovers = [...baseHandovers, ...virtuals];

    // Combine partners and employees
    const allUsers = [
        ...(settings?.partners || []).map(p => ({ id: p.id, name: p.name, type: 'partner' })),
        ...(settings?.employees || []).map(e => ({ id: e.id, name: e.name, type: 'employee' }))
    ];

    allUsers.forEach(user => {
        const holderId = user.type === 'partner' ? `part_${user.id}` : `emp_${user.id}`;
        const userHolders = rawHolders.filter((h: any) => 
            h.userId === holderId || 
            h.userId === user.id || 
            normalizeName(h.userName) === normalizeName(user.name)
        );
        const userUserIds = [holderId, user.id, ...userHolders.map(h => h.userId)];

        const userHandovers = handovers.filter(h => 
            userUserIds.includes(h.fromUserId) || 
            userUserIds.includes(h.toUserId) || 
            h.toUserId === user.id || 
            h.toUserId === holderId || 
            h.fromUserId === user.id || 
            h.fromUserId === holderId || 
            normalizeName(h.toUserName || '').includes(normalizeName(user.name)) || 
            normalizeName(h.fromUserName || '').includes(normalizeName(user.name))
        );

        const settlements = userHandovers.filter(h => 
            h.toUserId === 'admin_deduction' || 
            h.toUserId === 'admin_manual' ||
            (h.toUserName && (h.toUserName.includes('خصم') || h.toUserName.includes('تصفية') || h.toUserName.includes('تسوية'))) ||
            (h.notes && (h.notes.includes('خصم') || h.notes.includes('تصفية') || h.notes.includes('تسوية')))
        );
        const hasSettlement = settlements.length > 0;
        let holderSum = userHolders.reduce((sum, h) => sum + (h.currentBalance || 0), 0);

        let custodyAmt = 0;
        if (hasSettlement) {
            const lastSettlement = settlements.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const activeHandovers = userHandovers.filter(h => new Date(h.date).getTime() > new Date(lastSettlement.date).getTime());
            const activeHandoverSum = activeHandovers.reduce((sum, h) => {
                const isGive = userUserIds.includes(h.toUserId) || h.toUserId === user.id || h.toUserId === holderId || normalizeName(h.toUserName || '').includes(normalizeName(user.name));
                return isGive ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
            }, 0);
            custodyAmt = Math.max(0, holderSum) + Math.max(0, activeHandoverSum);
        } else {
            let handoverSum = userHandovers.reduce((sum, h) => {
                const isGive = userUserIds.includes(h.toUserId) || h.toUserId === user.id || h.toUserId === holderId || normalizeName(h.toUserName || '').includes(normalizeName(user.name));
                return isGive ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
            }, 0);
            custodyAmt = Math.max(holderSum, Math.max(0, handoverSum));
            if (custodyAmt <= 0 && holderSum > 0) custodyAmt = holderSum;
        }
        custodyAmt = Math.max(0, custodyAmt);

        const name = normalizeName(user.name);
        if (!grouped[name]) {
            if (custodyAmt > 0) {
                grouped[name] = {
                    userId: holderId,
                    userName: user.name,
                    currentBalance: custodyAmt,
                    lastUpdated: new Date().toISOString(),
                    originalIds: [holderId, user.id]
                };
            }
        } else {
            grouped[name].currentBalance = custodyAmt;
        }
    });

    return Object.values(grouped);
  }, [settings?.cashHolders, settings?.partners, settings?.employees, orders, treasury]);

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
      'تم_توصيلها': 0, 'تم_التوصيل': 0, 'تم_التحصيل': 0, 'مدفوعة': 0, 'مرتجع': 0, 'مرتجع_جزئي': 0,
      'فشل_التوصيل': 0, 'تمت_الاعادة_لشركة_الشحن': 0, 'ملغي': 0, 'مؤجل': 0, 'مجدول': 0
    };

    const getOrderCollectionAmount = (order: Order, type: 'revenue' | 'cod' = 'revenue') => {
      if (!settings) return 0;
      const safeProductPrice = Number(order.productPrice) || 0;
      const safeShippingFee = Number(order.shippingFee) || 0;
      const safeTax = Number(order.tax) || 0;
      const safeDiscount = Number(order.discount) || 0;
      const safeAdvance = Number(order.advancePayment) || 0;
      
      const compFees = settings.companySpecificFees?.[order.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
      const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      const insuranceFee = (isPosOrder ? 0 : ((order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0));
      const inspectionFee = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
      
      const safeCredit = Number(order.creditAmount) || 0;
      const safeReturnCash = order.returnCashToCustomer && order.cashToReturnAmount ? Number(order.cashToReturnAmount) : 0;
      
      const computedCOD = safeProductPrice + safeShippingFee + safeTax - safeDiscount - safeAdvance + inspectionFee - safeCredit - safeReturnCash;
      const codAmount = order.totalAmountOverride != null ? Math.max(0, Math.round(Number(order.totalAmountOverride))) : computedCOD;
      const displayTotal = order.source === 'synced' && order.totalPrice != null ? Number(order.totalPrice) + inspectionFee : codAmount;

      if (type === 'cod') return displayTotal;
      
      // Revenue should include the advance payment, credit, and return cash back to reflect the full order value
      return displayTotal + (order.totalAmountOverride != null || order.source !== 'synced' ? (safeAdvance + safeCredit + safeReturnCash) : 0);
    };

    (orders || []).forEach((o: Order) => {
      if (counts[o.status] !== undefined) counts[o.status]++;
      
      const isPos = o.channel === 'pos' || o.id.startsWith('POS-');
      const orderRevenue = getOrderCollectionAmount(o);

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

      const safeProductCost = getOrderProductCost(o, settings) || 0;
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
      
      const isCollected = o.collectionProcessed === true || o.paymentStatus === 'مدفوع' || ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status);
      const isTerminated = ['ملغي', 'مرتجع', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مؤرشف'].includes(o.status);

      if (o.status === 'مرتجع' || o.status === 'تمت_الاعادة_لشركة_الشحن' || o.status === 'فشل_التوصيل' || o.status === 'ملغي' || o.status === 'مرتجع_جزئي' || o.status === 'مرتجع_بعد_الاستلام') {
          headedToYouCount++;
          totalReturnedExpenses += loss;
      }
      
      if (isCollected) {
          successfulOrdersCount++;
          actualCollection += orderRevenue;
          totalCOGS += safeProductCost;
          totalShippingPaid += safeShippingFee;
      } else if (!isTerminated) {
          expectedCollection += orderRevenue;
      }
    });

    const cancelledCount = counts['ملغي'] || 0;
    const cancelledLossesCount = (orders || []).filter(o => o.status === 'ملغي').length;
    const returnedCount = (counts['مرتجع'] || 0) + (counts['مرتجع_جزئي'] || 0) + (counts['تمت_الاعادة_لشركة_الشحن'] || 0) + cancelledLossesCount;
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

    // Liquid cash calculation - Sum up transactions to get current balance
    const rawCashBalance = (wallet?.transactions || []).reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        if (t.details?.paidByPartnerId) return sum;

        if (t.type === 'إيداع') {
            if (t.status === 'cancelled') return sum;
            if (t.status === 'pending' && (t.category === 'wallet_charge' || t.category === 'charge')) return sum;
            return sum + amount;
        }
        if (t.type === 'سحب') return t.status === 'cancelled' ? sum : sum - amount;
        return sum;
    }, 0);

    const autoClosingDiff = settings.enableAutoClosingDifference 
        ? Math.abs(orders
            .filter(o => ['تم_توصيلها', 'تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'مرتجع_جزئي'].includes(o.status))
            .reduce((sum, o) => sum + (calculateOrderProfitLoss(o, settings).closingDifference || 0), 0))
        : (settings.hiddenWalletAmount || 0);

    const hidden = settings.enableHiddenWalletAmount ? autoClosingDiff : 0;
    const cashBalance = Math.max(0, rawCashBalance - hidden);

    const treasuryTotal = Math.max(0, (treasury?.accounts || []).reduce((sum, acc) => sum + (acc.balance || 0), 0) - hidden);
    const workingCapital = treasuryTotal + totalInventoryValue;

    // Calculate Admin & Operational Expenses
    const adminExpenses = (wallet?.transactions || [])
      .filter(t => {
        const isExpenseCategory = (settings?.expenseCategories || []).includes(t.category || '');
        const isNotPartnerTx = !t.note?.includes('معاملة شريك');
        return t.type === 'سحب' && isExpenseCategory && isNotPartnerTx;
      })
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Calculate Partner Capital Contributions (Total Investment)
    const totalCapital = (settings?.partnerTransactions || [])
        .filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const bankBalance = (treasury?.accounts || []).filter(a => a.type === 'bank').reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const safeBalance = (treasury?.accounts || []).filter(a => a.type === 'safe').reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const rawDigitalWalletBalance = (treasury?.accounts || []).filter(a => a.type === 'wallet').reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const digitalWalletBalance = Math.max(0, rawDigitalWalletBalance - hidden);

    // 💡 Pro KPI Calculations
    const totalOrdersCount = (orders || []).length;
    const deliveryRate = totalOrdersCount > 0 ? Math.round((successfulOrdersCount / totalOrdersCount) * 10000) / 100 : 0;
    const aov = successfulOrdersCount > 0 ? Math.round(actualCollection / successfulOrdersCount) : 0;
    const cancellationRate = totalOrdersCount > 0 ? Math.round((cancelledCount / totalOrdersCount) * 10000) / 100 : 0;
    const returnRate = totalOrdersCount > 0 ? Math.round((returnedCount / totalOrdersCount) * 10000) / 100 : 0;

    // Calculate Receivables (Credit Sales from POS)
    const posReceivables = (settings?.posSales || [])
        .filter(s => s.cashHolderId === 'credit')
        .reduce((sum, s) => sum + s.totalAmount, 0);

    // Calculate Total Distributed Custody
    const totalCustodyBalance = holders.reduce((sum, h) => sum + (h.currentBalance || 0), 0);

    // Build unique customer set
    const uniqueCustomerCount = (orders || []).reduce((acc, o) => {
      const clean = (o.customerPhone || '').trim();
      if (clean) acc.add(clean);
      return acc;
    }, new Set<string>()).size;

    // Calculate Revenue vs Expenses for the last 6 months
    const financeHistory = (() => {
       const months = [];
       for (let i = 5; i >= 0; i--) {
         const d = new Date();
         d.setDate(1); // Set to 1st to avoid month rolling issues
         d.setMonth(d.getMonth() - i);
         months.push({
           name: d.toLocaleString('ar-EG', { month: 'short' }),
           key: `${d.getMonth()}-${d.getFullYear()}`,
           revenue: 0,
           expenses: 0
         });
       }

       // Simple month-based revenue aggregation
       (orders || []).forEach(o => {
         const isSuccessful = ['تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'تم_الاستلام'].includes(o.status);
         if (isSuccessful) {
            const d = new Date(o.date);
            const key = `${d.getMonth()}-${d.getFullYear()}`;
            const m = months.find(item => item.key === key);
            if (m) m.revenue += getOrderCollectionAmount(o);
         }
       });

       // Simple month-based expense aggregation
       (wallet.transactions || []).forEach(t => {
         const isExpense = t.type === 'سحب' && (settings?.expenseCategories || []).includes(t.category || '');
         if (isExpense) {
            const d = new Date(t.date);
            const key = `${d.getMonth()}-${d.getFullYear()}`;
            const m = months.find(item => item.key === key);
            if (m) m.expenses += t.amount;
         }
       });

       return months;
    })();

    // Calculate Dead Stock (Products with high stock but no sales in last 30 days)
    const deadStockCount = (settings?.products || []).filter(p => {
        const stock = (p.stockQuantity || 0);
        if (stock < 5) return false; // low stock is not "dead" in this context
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const hasRecentSales = (orders || []).some(o => 
            o.status !== 'ملغي' && 
            new Date(o.date) >= thirtyDaysAgo && 
            (o.items || []).some(item => item.productId === p.id)
        );
        
        return !hasRecentSales;
    }).length;

    // Calculate Liquidity Coverage (Cash / Avg Monthly Expenses)
    const avgMonthlyExpense = adminExpenses / Math.max((orders.length > 0 ? (new Date().getTime() - new Date(orders[0].date).getTime()) / (1000 * 60 * 60 * 24 * 30) : 1), 1);
    const liquidityCoverage = avgMonthlyExpense > 0 ? (cashBalance / avgMonthlyExpense).toFixed(1) : '∞';

    // Top Selling Products logic
    const topProducts = (settings?.products || []).map(p => {
        const salesCount = (orders || []).filter(o => 
            ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status) &&
            (o.items || []).some(item => item.productId === p.id)
        ).length;
        return { ...p, salesCount };
    }).sort((a, b) => b.salesCount - a.salesCount).slice(0, 5);

    // New Financial Metrics & Consolidation
    // Calculate POS Profit/COGS for sales that are NOT in the orders list
    let extraPosProfit = 0;
    let extraPosCOGS = 0;
    const extraPosSales = (settings?.posSales || []).filter(s => !(orders || []).some(o => o.id === s.id || o.orderNumber === s.saleNumber));
    
    extraPosSales.forEach(s => {
        (s.items || []).forEach(item => {
            const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
            extraPosCOGS += (cost * (item.quantity || 1));
            extraPosProfit += ((item.price - cost) * (item.quantity || 1));
        });
    });

    const finalRevenue = actualCollection + extraPosSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const finalCOGS = totalCOGS + extraPosCOGS;
    const finalProfit = totalProfit + extraPosProfit;
    const finalSuccessfulCount = successfulOrdersCount + extraPosSales.length;
    
    // Gross Profit (Product Margin) = Revenue - Product Cost (COGS)
    // This represents the direct profit from products before shipping and fees without extra markups
    const grossProfit = (orders || []).filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status)).reduce((sum, o) => {
        const itemProfit = (o.items || []).reduce((iSum, item) => {
            const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
            return iSum + ((item.price - cost) * (item.quantity || 1));
        }, 0);

        return sum + itemProfit;
    }, 0) + extraPosProfit;
    
    const supplierDebt = (settings?.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);
    const shippingReceivables = (orders || [])
        .filter(o => (o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل' || o.status === 'مدفوعة' || o.status === 'قيد_الشحن') && !o.collectionProcessed)
        .reduce((sum, o) => sum + getOrderCollectionAmount(o, 'cod'), 0);
    
    const netAvailableLiquidity = (treasuryTotal || 0) - supplierDebt;
    const netProfit = finalProfit - totalLoss - adminExpenses;
    
    const roi = totalCapital > 0 ? (netProfit / totalCapital) * 100 : 0;
    const expenseRatio = finalRevenue > 0 ? (adminExpenses / finalRevenue) * 100 : 0;
    const grossMarginPercentage = finalRevenue > 0 ? (grossProfit / finalRevenue) * 100 : 0;
    const netMarginPercentage = finalRevenue > 0 ? (netProfit / finalRevenue) * 100 : 0;
    const netMargin = Math.round(netMarginPercentage * 10) / 10;
    
    // Revenue Growth (Current month vs Previous month)
    const currentMonthKey = `${new Date().getMonth()}-${new Date().getFullYear()}`;
    const previousMonth = new Date();
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const prevMonthKey = `${previousMonth.getMonth()}-${previousMonth.getFullYear()}`;
    const currentMonthRevenue = (financeHistory.find(m => m.key === currentMonthKey)?.revenue || 0);
    const prevMonthRevenue = (financeHistory.find(m => m.key === prevMonthKey)?.revenue || 0);
    const revenueGrowth = prevMonthRevenue > 0 ? ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

    // Top Customers Calculation
    const customerMap = new Map();
    (orders || []).forEach(o => {
      if (!['ملغي', 'مرفوض'].includes(o.status)) {
        const key = o.customerPhone || o.customerName;
        if (key) {
           const current = customerMap.get(key) || { id: key, name: o.customerName, phone: o.customerPhone, totalSpend: 0, ordersCount: 0 };
           current.totalSpend += getOrderCollectionAmount(o);
           current.ordersCount += 1;
           customerMap.set(key, current);
        }
      }
    });
    const topCustomers = Array.from(customerMap.values())
      .sort((a: any, b: any) => b.totalSpend - a.totalSpend)
      .slice(0, 5);

    const inventoryValue = (settings?.products || []).reduce((sum, p) => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        return sum + p.variants.reduce((vSum, v) => {
          const qty = v.stockQuantity ?? v.stock ?? 0;
          const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
          return vSum + (qty * cost);
        }, 0);
      } else {
        const qty = p.stockQuantity ?? p.stock ?? 0;
        const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
        return sum + (qty * cost);
      }
    }, 0);

    const productSalesMap = new Map();
    (orders || []).forEach(o => {
        if (!['ملغي', 'مرتجع', 'فشل_التوصيل'].includes(o.status)) {
            (o.items || []).forEach(item => {
                const current = productSalesMap.get(item.productId) || { id: item.productId, name: item.name, quantity: 0, revenue: 0 };
                current.quantity += (item.quantity || 1);
                current.revenue += (item.price * (item.quantity || 1));
                productSalesMap.set(item.productId, current);
            });
        }
    });
    const topSellingProducts = Array.from(productSalesMap.values())
        .sort((a: any, b: any) => b.quantity - a.quantity)
        .slice(0, 5);

    const funnel = {
        pending: (orders || []).filter(o => o.status === 'جاري_المراجعة' || o.status === 'في_انتظار_المكالمة').length,
        confirmed: (orders || []).filter(o => o.status === 'قيد_التنفيذ' || o.status === 'تم_الارسال').length,
        shipping: (orders || []).filter(o => o.status === 'قيد_الشحن').length,
        delivered: (orders || []).filter(o => o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل' || o.status === 'مدفوعة').length,
        collected: (orders || []).filter(o => o.status === 'تم_التحصيل').length
    };

    const avgProfitPerOrder = finalSuccessfulCount > 0 ? netProfit / finalSuccessfulCount : 0;

    return { 
      net: netProfit, 
      adminExpenses,
      totalCapital,
      counts, 
      total: totalOrdersCount,
      awaitingDecisionCount,
      processingCount,
      outForDeliveryCount,
      awaitingPickupCount,
      headedToYouCount,
      successfulOrdersCount: finalSuccessfulCount,
      actualCollection: finalRevenue,
      expectedCollection,
      totalCOGS: finalCOGS,
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
      delayedCount,
      // Pro metrics
      deliveryRate,
      aov,
      cancellationRate,
      returnRate,
      netMargin,
      uniqueCustomerCount,
      posReceivables,
      totalCustodyBalance,
      financeHistory,
      deadStockCount,
      liquidityCoverage,
      topProducts: topSellingProducts,
      totalRevenue: finalRevenue,
      grossProfit,
      roi,
      expenseRatio,
      supplierDebt,
      shippingReceivables,
      grossMarginPercentage,
      netMarginPercentage,
      revenueGrowth,
      treasuryTotal,
      bankBalance,
      safeBalance,
      digitalWalletBalance,
      netAvailableLiquidity,
      topCustomers,
      inventoryValue,
      funnel,
      avgProfitPerOrder
    };
  }, [orders, settings, wallet, treasury, holders]);

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
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-12 text-right overflow-x-hidden font-sans"
      dir="rtl"
    >
      {/* 🚀 Dynamic Premium Hero Banner */}
      <motion.div variants={itemVariants} className="relative z-20 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-[#0d1f1c] to-emerald-950 text-white p-7 sm:p-9 shadow-xl border border-emerald-500/20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/4 translate-y-1/4" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                المتجر متصل ومستقر
              </span>
              <span className="text-xs text-slate-300/80 font-medium flex items-center gap-1">
                <Clock size={13} className="text-amber-400" />
                تحديث تلقائي كل دقيقة
              </span>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                أهلاً بك، {currentUser?.fullName ? currentUser.fullName.split(' ')[0] : 'عزيزي التاجر'} 👋
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-300/90 max-w-2xl leading-relaxed">
                غرفة العمليات المركزية لمتابعة حركة المبيعات اللحظية، الأرباح، وتوجيه أداء المتجر.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link 
              to={activeStore ? `/store/${activeStore.id}/orders/new` : '/orders/new'} 
              className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ShoppingBag size={18} />
              <span>+ إنشاء أوردر جديد</span>
            </Link>

            <Link 
              to="/store"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/10 transition-all backdrop-blur-md flex items-center justify-center gap-2"
            >
              <PlayCircle size={18} className="text-emerald-400" />
              <span>معاينة المتجر</span>
            </Link>

            <button 
              onClick={() => setIsEditingLayout(!isEditingLayout)}
              className={`px-4 py-3 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                isEditingLayout 
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-md ring-2 ring-white/30' 
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/10 backdrop-blur-md'
              }`}
            >
              <Monitor size={18} />
              <span>{isEditingLayout ? 'إنهاء التخصيص' : 'تخصيص الواجهة'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      <DashboardManager 
        isEditing={isEditingLayout}
        onToggleEditing={() => setIsEditingLayout(!isEditingLayout)}
        widgets={widgets}
        onAddWidget={handleAddWidget}
      />

      <Reorder.Group 
        axis="y" 
        onReorder={setWidgets} 
        values={widgets} 
        className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start"
      >
        {widgets.map((widget) => (
          <WidgetWrapper 
            key={widget.id} 
            widget={widget} 
            isEditing={isEditingLayout} 
            onToggleVisibility={handleToggleWidget}
          >
            {renderWidgetContent(widget.id)}
          </WidgetWrapper>
        ))}
      </Reorder.Group>

      {/* Footer Branding */}
      <motion.div variants={itemVariants} className="pt-12 border-t border-slate-100 dark:border-white/5">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-700">
            <div className="w-12 h-[1px] bg-current" />
            نظام إدارة التجارة الذكي | v3.0 Premium Edition
            <div className="w-12 h-[1px] bg-current" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 text-center max-w-xs leading-relaxed">
            تم تطوير هذا النظام بأعلى معايير الدقة والسرعة لخدمة تجارتك المتنامية.
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
  <div className="bg-white dark:bg-slate-900/40 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-xs flex flex-col items-end justify-center min-h-[110px] transition-all duration-300 hover:shadow-md hover:border-slate-200 dark:hover:border-white/10 group">
    <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 group-hover:text-slate-500 transition-colors">{title}</div>
    <div className={`text-2xl font-black ${color} flex items-center gap-2 tabular-nums tracking-tighter`}>
      {value}
      {badge && (
        <span className="text-[10px] text-slate-400 font-bold ml-1">
          {badge}
        </span>
      )}
    </div>
  </div>
);


interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const StatCard = ({ title, value, icon }: StatCardProps) => (
  <div className="bg-white/70 dark:bg-[#0b0f19]/60 backdrop-blur-xl p-5.5 rounded-2xl border border-slate-200/45 dark:border-white/5 shadow-sm flex items-center gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/5">
    <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 rounded-xl">
        {icon}
    </div>
    <div>
      <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">{title}</div>
      <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums">{value}</div>
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
  <div className="bg-white/75 dark:bg-[#0b0f19]/65 backdrop-blur-xl p-4.5 rounded-2xl border border-slate-200/40 dark:border-white/5 text-center shadow-xs transition-all duration-300 hover:shadow-md">
      <div className={`flex items-center justify-center gap-2 font-bold text-slate-500 dark:text-slate-400 mb-1 ${colorClass}`}>
          {icon}
          <span className="text-sm">{title}</span>
      </div>
      <div className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">{value}</div>
  </div>
);

export default Dashboard;
