import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Layers, 
  BarChart3, 
  AreaChart as AreaChartIcon, 
  ArrowUpRight, 
  Sparkles,
  ShoppingBag,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { Order, Settings } from '../../types';
import { calculateOrderProfitLoss, getOrderProductCost } from '../../utils/financials';

interface DailySalesProfitChartProps {
  orders: Order[];
  settings?: Settings;
}

type TimeRange = '7' | '14' | '30' | 'month';
type ChartMode = 'both' | 'sales' | 'profit';
type ChartType = 'area' | 'bar';

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export const DailySalesProfitChart: React.FC<DailySalesProfitChartProps> = ({ 
  orders = [], 
  settings 
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('14');
  const [chartMode, setChartMode] = useState<ChartMode>('both');
  const [chartType, setChartType] = useState<ChartType>('area');

  // Compute daily series based on selected timeRange
  const dailyData = useMemo(() => {
    const now = new Date();
    const daysCount = timeRange === '7' ? 7 : timeRange === '14' ? 14 : timeRange === '30' ? 30 : now.getDate();
    
    // Generate dates backwards from today
    const datesList: { dateKey: string; label: string; fullDate: string; dayName: string }[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      const dayName = ARABIC_DAYS[d.getDay()];
      const label = `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()].slice(0, 4)}`;
      const fullDate = `${dayName}، ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${year}`;
      datesList.push({ dateKey, label, fullDate, dayName });
    }

    // Map to aggregate data per day
    const dayMap = new Map<string, { 
      sales: number; 
      profit: number; 
      ordersCount: number; 
      successfulCount: number;
    }>();

    datesList.forEach(item => {
      dayMap.set(item.dateKey, { sales: 0, profit: 0, ordersCount: 0, successfulCount: 0 });
    });

    // Helper to calculate order revenue
    const getOrderRevenue = (order: Order) => {
      const safeProductPrice = Number(order.productPrice) || 0;
      const safeShippingFee = Number(order.shippingFee) || 0;
      const safeTax = Number(order.tax) || 0;
      const safeDiscount = Number(order.discount) || 0;
      const computedTotal = safeProductPrice + safeShippingFee + safeTax - safeDiscount;
      return order.totalAmountOverride != null ? Math.max(0, Number(order.totalAmountOverride)) : computedTotal;
    };

    // Aggregate Orders
    (orders || []).forEach(order => {
      if (!order.date) return;
      const d = new Date(order.date);
      if (isNaN(d.getTime())) return;
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;

      if (dayMap.has(key)) {
        const current = dayMap.get(key)!;
        current.ordersCount += 1;

        const isCancelled = ['ملغي', 'مرفوض'].includes(order.status);
        if (!isCancelled) {
          const rev = getOrderRevenue(order);
          current.sales += rev;

          const { profit, loss } = calculateOrderProfitLoss(order, settings);
          current.profit += (profit - loss);

          const isSuccessful = ['تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(order.status);
          if (isSuccessful) {
            current.successfulCount += 1;
          }
        }
      }
    });

    // Also include POS Sales if recorded in settings
    (settings?.posSales || []).forEach(sale => {
      if (!sale.date) return;
      const d = new Date(sale.date);
      if (isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;

      if (dayMap.has(key)) {
        const current = dayMap.get(key)!;
        current.ordersCount += 1;
        current.sales += (sale.totalAmount || 0);

        let posCost = 0;
        (sale.items || []).forEach(item => {
          posCost += (item.cost || 0) * (item.quantity || 1);
        });
        current.profit += ((sale.totalAmount || 0) - posCost);
        current.successfulCount += 1;
      }
    });

    return datesList.map(item => {
      const stats = dayMap.get(item.dateKey) || { sales: 0, profit: 0, ordersCount: 0, successfulCount: 0 };
      const margin = stats.sales > 0 ? (stats.profit / stats.sales) * 100 : 0;
      return {
        dateKey: item.dateKey,
        name: item.label,
        dayName: item.dayName,
        fullDate: item.fullDate,
        sales: Math.round(stats.sales),
        profit: Math.round(stats.profit),
        ordersCount: stats.ordersCount,
        successfulCount: stats.successfulCount,
        margin: Math.round(margin * 10) / 10
      };
    });
  }, [orders, settings, timeRange]);

  // Aggregate Summary Metrics for the chosen period
  const summary = useMemo(() => {
    let totalSales = 0;
    let totalProfit = 0;
    let totalOrders = 0;
    let peakDay = { name: '', sales: 0, date: '' };

    dailyData.forEach(d => {
      totalSales += d.sales;
      totalProfit += d.profit;
      totalOrders += d.ordersCount;
      if (d.sales > peakDay.sales) {
        peakDay = { name: d.dayName, sales: d.sales, date: d.name };
      }
    });

    const avgDailySales = dailyData.length > 0 ? Math.round(totalSales / dailyData.length) : 0;
    const avgDailyProfit = dailyData.length > 0 ? Math.round(totalProfit / dailyData.length) : 0;
    const overallMargin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 1000) / 10 : 0;

    return {
      totalSales,
      totalProfit,
      totalOrders,
      avgDailySales,
      avgDailyProfit,
      overallMargin,
      peakDay
    };
  }, [dailyData]);

  // Custom Glassmorphic Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 dark:bg-[#0f1722]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/[0.1] rounded-2xl p-4 shadow-xl text-right min-w-[210px] animate-in fade-in zoom-in-95 duration-100 font-sans" dir="rtl">
          <div className="border-b border-slate-100 dark:border-white/[0.08] pb-2 mb-2.5">
            <span className="text-xs font-black text-slate-800 dark:text-white">
              {data.fullDate}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {(chartMode === 'both' || chartMode === 'sales') && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-bold">المبيعات:</span>
                </div>
                <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono">
                  {data.sales.toLocaleString()} ج.م
                </span>
              </div>
            )}

            {(chartMode === 'both' || chartMode === 'profit') && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-bold">صافي الأرباح:</span>
                </div>
                <span className={`font-black font-mono ${data.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {data.profit.toLocaleString()} ج.م
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-slate-100 dark:border-white/[0.06] text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">إجمالي الطلبات:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">
                {data.ordersCount} طلب
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">هامش الربح:</span>
              <span className={`font-black ${data.margin >= 20 ? 'text-emerald-500' : data.margin > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                {data.margin}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-[#0f1722] rounded-3xl border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-7 shadow-sm transition-all duration-200 relative overflow-hidden">
      
      {/* Top Header & Interactive Segmented Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/[0.06]">
        
        {/* Title & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-2xs">
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                المبيعات والأرباح اليومية
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                <Sparkles size={10} />
                تفاعلي لحظي
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              متابعة تدفق الإيرادات اليومية ومقارنتها بصافي الأرباح الفعلية
            </p>
          </div>
        </div>

        {/* Action Controls Suite */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Time Range Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.05] p-1 rounded-xl border border-slate-200/70 dark:border-white/[0.06]">
            {[
              { id: '7', label: '7 أيام' },
              { id: '14', label: '14 يوم' },
              { id: '30', label: '30 يوم' },
              { id: 'month', label: 'هذا الشهر' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id as TimeRange)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  timeRange === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Metric Filter Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.05] p-1 rounded-xl border border-slate-200/70 dark:border-white/[0.06]">
            {[
              { id: 'both', label: 'الكل' },
              { id: 'sales', label: 'المبيعات' },
              { id: 'profit', label: 'الأرباح' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setChartMode(mode.id as ChartMode)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  chartMode === mode.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Chart Presentation Type Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.05] p-1 rounded-xl border border-slate-200/70 dark:border-white/[0.06]">
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'area'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="رسم بياني مساحي تدفقي"
              aria-label="رسم بياني مساحي"
            >
              <AreaChartIcon size={14} />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="رسم بياني أعمدة"
              aria-label="رسم بياني أعمدة"
            >
              <BarChart3 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlight Strip for Chosen Range */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 my-6">
        
        {/* Card 1: Total Period Sales */}
        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 text-right transition-all hover:border-indigo-500/30">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-1">
            <span>مبيعات الفترة</span>
            <DollarSign size={14} className="text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1 text-slate-900 dark:text-white font-mono">
            <span className="text-xl sm:text-2xl font-black">
              {summary.totalSales.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            متوسط {summary.avgDailySales.toLocaleString()} ج.م / يوم
          </div>
        </div>

        {/* Card 2: Total Period Net Profit */}
        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 text-right transition-all hover:border-emerald-500/30">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-1">
            <span>صافي الأرباح</span>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
            <span className="text-xl sm:text-2xl font-black">
              {summary.totalProfit.toLocaleString()}
            </span>
            <span className="text-xs font-bold opacity-75">ج.م</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            هامش ربح {summary.overallMargin}% في الفترة
          </div>
        </div>

        {/* Card 3: Total Orders */}
        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 text-right transition-all hover:border-amber-500/30">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-1">
            <span>إجمالي الطلبات</span>
            <ShoppingBag size={14} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1 text-slate-900 dark:text-white font-mono">
            <span className="text-xl sm:text-2xl font-black">
              {summary.totalOrders}
            </span>
            <span className="text-xs font-bold text-slate-400">طلب</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            بمعدل {dailyData.length > 0 ? (summary.totalOrders / dailyData.length).toFixed(1) : 0} طلب يومياً
          </div>
        </div>

        {/* Card 4: Peak Sales Day */}
        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 text-right transition-all hover:border-purple-500/30">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-1">
            <span>أعلى يوم مبيعات</span>
            <ArrowUpRight size={14} className="text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1 text-purple-600 dark:text-purple-400 font-mono">
            <span className="text-xl sm:text-2xl font-black">
              {summary.peakDay.sales.toLocaleString()}
            </span>
            <span className="text-xs font-bold opacity-75">ج.م</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1 truncate">
            {summary.peakDay.sales > 0 ? `${summary.peakDay.name} (${summary.peakDay.date})` : 'لا توجد مبيعات بعد'}
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[320px] w-full mt-2" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDailySales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorDailyProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="currentColor" 
                className="text-slate-200/80 dark:text-white/[0.06]" 
              />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                dy={6}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              />
              <Tooltip content={<CustomTooltip />} />
              {(chartMode === 'both' || chartMode === 'sales') && (
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  name="المبيعات"
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorDailySales)" 
                  activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                />
              )}
              {(chartMode === 'both' || chartMode === 'profit') && (
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  name="الأرباح"
                  stroke="#10b981" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorDailyProfit)" 
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          ) : (
            <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="currentColor" 
                className="text-slate-200/80 dark:text-white/[0.06]" 
              />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                dy={6}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              />
              <Tooltip content={<CustomTooltip />} />
              {(chartMode === 'both' || chartMode === 'sales') && (
                <Bar 
                  dataKey="sales" 
                  name="المبيعات" 
                  fill="#6366f1" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={32}
                />
              )}
              {(chartMode === 'both' || chartMode === 'profit') && (
                <Bar 
                  dataKey="profit" 
                  name="الأرباح" 
                  fill="#10b981" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={32}
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Chart Legend / Notes Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-white/[0.06] text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          {(chartMode === 'both' || chartMode === 'sales') && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-indigo-500" />
              <span className="font-bold">إجمالي المبيعات (Revenue)</span>
            </div>
          )}
          {(chartMode === 'both' || chartMode === 'profit') && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-bold">صافي الأرباح (Net Profit)</span>
            </div>
          )}
        </div>
        <div className="text-[11px] text-slate-400 font-medium">
          يتم احتساب الأرباح تلقائياً بعد خصم تكلفة المنتجات ومصاريف الشحن
        </div>
      </div>

    </div>
  );
};

export default DailySalesProfitChart;
