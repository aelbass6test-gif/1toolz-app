import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, DollarSign, Percent, AlertTriangle, CheckCircle,
  Clock, Zap, RefreshCw, Barcode, Search, Save, Edit3, ArrowRight,
  ShieldCheck, Layers, Sparkles, Sliders, Calculator, Box, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Filter, Plus, Minus, Info, FileText, Check
} from 'lucide-react';
import { Settings, Product, Order } from '../../types';
import { audioSynth } from '../../utils/audioSynth';
import { triggerCelebration } from '../../utils/celebration';

export type InventoryHubTab = 'catalog' | 'forecasting' | 'profitability' | 'bulk_editor' | 'scanner';

interface SmartInventoryHubNavProps {
  activeTab: InventoryHubTab;
  setActiveTab: (tab: InventoryHubTab) => void;
  productsCount: number;
  criticalCount: number;
}

export const SmartInventoryHubNav: React.FC<SmartInventoryHubNavProps> = ({
  activeTab,
  setActiveTab,
  productsCount,
  criticalCount
}) => {
  const tabs = [
    { id: 'catalog' as const, label: 'قائمة المنتجات والتعديل', icon: <Package size={18} />, badge: productsCount },
    { id: 'forecasting' as const, label: 'المستشار الذكي والتنبؤ بالطلب', icon: <Sparkles size={18} className="text-amber-500 animate-pulse" />, badge: criticalCount > 0 ? `⚠️ ${criticalCount}` : undefined },
    { id: 'profitability' as const, label: 'مصفوفة التحليل المالي والربحية', icon: <TrendingUp size={18} className="text-emerald-500" /> },
    { id: 'bulk_editor' as const, label: 'التعديل السريع الجماعي (جدول)', icon: <Sliders size={18} className="text-blue-500" /> },
    { id: 'scanner' as const, label: 'الماسح الضوئي والبحث السريع', icon: <Barcode size={18} className="text-purple-500" /> },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-2 items-center justify-start my-4">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              try { audioSynth.playTone('info'); } catch (e) {}
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                isActive ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

interface HubContentProps {
  activeTab: InventoryHubTab;
  settings: Settings;
  setSettings: (updater: React.SetStateAction<Settings>) => void;
  orders: Order[];
}

export const SmartInventoryHubContent: React.FC<HubContentProps> = ({
  activeTab,
  settings,
  setSettings,
  orders
}) => {
  const products = useMemo(() => settings.products || [], [settings.products]);

  if (activeTab === 'forecasting') {
    return <AIDemandForecastingTab products={products} orders={orders} setSettings={setSettings} settings={settings} />;
  }
  if (activeTab === 'profitability') {
    return <ProfitabilityMatrixTab products={products} settings={settings} />;
  }
  if (activeTab === 'bulk_editor') {
    return <BulkEditorTab products={products} setSettings={setSettings} settings={settings} />;
  }
  if (activeTab === 'scanner') {
    return <BarcodeScannerTab products={products} setSettings={setSettings} settings={settings} />;
  }

  return null;
};

/* ==========================================================================
   TAB 2: AI DEMAND FORECASTING & REORDER ADVISOR
   ========================================================================== */
const AIDemandForecastingTab: React.FC<{
  products: Product[];
  orders: Order[];
  setSettings: (updater: React.SetStateAction<Settings>) => void;
  settings: Settings;
}> = ({ products, orders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<'all' | 'critical' | 'warning' | 'safe'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Calculate velocity from delivered/completed orders
  const analytics = useMemo(() => {
    const salesMap: Record<string, number> = {};
    const daysWindow = 30; // 30 days window

    orders.forEach((o) => {
      if (o.status === 'تم_التوصيل' || o.status === 'تم_توصيلها' || o.status === 'تم_الارسال' || o.status === 'قيد_الشحن' || o.status === 'تم_التحصيل' || o.status === 'قيد_التنفيذ') {
        (o.items || []).forEach((item) => {
          if (item.productId) {
            salesMap[item.productId] = (salesMap[item.productId] || 0) + (item.quantity || 1);
          }
        });
      }
    });

    let totalCritical = 0;
    let totalWarning = 0;
    let totalSafe = 0;
    let totalSuggestedRestock = 0;
    let estimatedRestockCost = 0;

    const analyzedProducts = products.map((p) => {
      const soldInWindow = salesMap[p.id] || 0;
      const dailyVelocity = Math.max(soldInWindow / daysWindow, 0.05); // assume at least small velocity to avoid infinity
      const stock = p.stockQuantity ?? p.stock ?? 0;
      const daysLeft = Math.round(stock / dailyVelocity);
      
      let risk: 'critical' | 'warning' | 'safe' = 'safe';
      if (stock === 0 || daysLeft <= 7) {
        risk = 'critical';
        totalCritical++;
      } else if (daysLeft <= 15) {
        risk = 'warning';
        totalWarning++;
      } else {
        totalSafe++;
      }

      // Suggest restock to cover 30 days
      const targetStock = Math.ceil(dailyVelocity * 30);
      const suggestedReorder = Math.max(targetStock - stock, 0);
      const cost = p.costPrice || 0;

      if (suggestedReorder > 0) {
        totalSuggestedRestock += suggestedReorder;
        estimatedRestockCost += suggestedReorder * cost;
      }

      return {
        ...p,
        soldInWindow,
        dailyVelocity: dailyVelocity.toFixed(1),
        daysLeft,
        risk,
        suggestedReorder,
        restockCost: suggestedReorder * cost
      };
    });

    return {
      analyzedProducts,
      totalCritical,
      totalWarning,
      totalSafe,
      totalSuggestedRestock,
      estimatedRestockCost
    };
  }, [products, orders]);

  const filtered = useMemo(() => {
    return analytics.analyzedProducts.filter((p) => {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName) return false;
      if (filterRisk === 'all') return true;
      return p.risk === filterRisk;
    });
  }, [analytics.analyzedProducts, searchTerm, filterRisk]);

  const handleCopyOrderRequest = (p: any) => {
    const text = `طلب تعزيز مخزون جديد:\n📦 المنتج: ${p.name}\n🔖 كود SKU: ${p.sku}\n📊 المخزون المتبقي: ${p.stockQuantity || 0} قطعة\n🛒 الكمية المقترحة للطلب: ${p.suggestedReorder} قطعة\n⏰ التقدير: المخزون الحالي يكفي لمدة ~${p.daysLeft} أيام.`;
    navigator.clipboard.writeText(text);
    setCopiedId(p.id);
    try { audioSynth.playTone('success'); } catch (e) {}
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-right" dir="rtl">
      {/* Top Banner KPI */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
            <Sparkles size={28} className="animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">المستشار الذكي للتنبؤ بالطلب وإعادة الطلب</h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
              تحليل سرعة استهلاك المخزون والتنبؤ بموعد النفاد مع اقتراح كميات الشراء الذكية لتجنب خسارة المبيعات.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 z-10">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block font-bold">أصناف حرجة (نفاد قريب)</span>
            <span className="text-lg font-black text-rose-400 tabular-nums">{analytics.totalCritical}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block font-bold">أصناف تحتاج متابعة</span>
            <span className="text-lg font-black text-amber-400 tabular-nums">{analytics.totalWarning}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block font-bold">إجمالي قطع مقترح طلبها</span>
            <span className="text-lg font-black text-emerald-400 tabular-nums">{analytics.totalSuggestedRestock.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="ابحث عن منتج أو SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">تصفية حسب الحالة:</span>
          <button
            onClick={() => setFilterRisk('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterRisk === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            الكل ({analytics.analyzedProducts.length})
          </button>
          <button
            onClick={() => setFilterRisk('critical')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterRisk === 'critical' ? 'bg-rose-600 text-white shadow-md' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
            }`}
          >
            🔴 حرجة ({analytics.totalCritical})
          </button>
          <button
            onClick={() => setFilterRisk('warning')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterRisk === 'warning' ? 'bg-amber-600 text-white shadow-md' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
            }`}
          >
            🟡 متابعة ({analytics.totalWarning})
          </button>
          <button
            onClick={() => setFilterRisk('safe')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterRisk === 'safe' ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
            }`}
          >
            🟢 مستقر ({analytics.totalSafe})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black uppercase border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4">المنتج / SKU</th>
                <th className="px-5 py-4">المخزون الحالي</th>
                <th className="px-5 py-4">سرعة الاستهلاك (يومياً)</th>
                <th className="px-5 py-4">الأيام المتبقية للنفاد</th>
                <th className="px-5 py-4">حالة المخزون</th>
                <th className="px-5 py-4">الكمية المقترح طلبها</th>
                <th className="px-5 py-4 text-left">إجراء سريع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                    لا توجد منتجات مطابقة لهذا التصنيف.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800 dark:text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.sku}</div>
                    </td>
                    <td className="px-5 py-4 font-black tabular-nums text-slate-800 dark:text-slate-200">
                      {p.stockQuantity || 0} <span className="text-[10px] text-slate-400 font-normal">قطعة</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      ~{p.dailyVelocity} <span className="text-[10px] font-sans text-slate-400">قطعة/يوم</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-black text-xs tabular-nums ${
                        p.risk === 'critical' ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 animate-pulse' :
                        p.risk === 'warning' ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400' :
                        'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        <Clock size={12} />
                        {p.stockQuantity === 0 ? 'نافد تماماً!' : `${p.daysLeft} يوم`}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {p.risk === 'critical' && <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">🔴 حرج جداً</span>}
                      {p.risk === 'warning' && <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">🟡 يوصى بالطلب</span>}
                      {p.risk === 'safe' && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">🟢 آمن</span>}
                    </td>
                    <td className="px-5 py-4">
                      {p.suggestedReorder > 0 ? (
                        <div className="font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                          +{p.suggestedReorder} <span className="text-[10px] font-normal text-slate-400">قطعة</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-left">
                      <button
                        onClick={() => handleCopyOrderRequest(p)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          copiedId === p.id
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                        }`}
                      >
                        {copiedId === p.id ? <Check size={14} /> : <ShoppingCart size={14} />}
                        <span>{copiedId === p.id ? 'تم النسخ!' : 'طلب تعزيز'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

/* ==========================================================================
   TAB 3: PROFITABILITY & MARGIN ANALYTICS MATRIX
   ========================================================================== */
const ProfitabilityMatrixTab: React.FC<{
  products: Product[];
  settings: Settings;
}> = ({ products }) => {
  const [filterType, setFilterType] = useState<'all' | 'high' | 'mid' | 'low'>('all');

  const analyzed = useMemo(() => {
    let totalInvestedCapital = 0;
    let totalExpectedRevenue = 0;
    let totalExpectedProfit = 0;

    const items = products.map((p) => {
      const stock = p.stockQuantity ?? p.stock ?? 0;
      const cost = p.costPrice || 0;
      const price = p.price || 0;
      const margin = price - cost;
      const marginPercent = price > 0 ? Math.round((margin / price) * 100) : 0;
      const invested = stock * cost;
      const expectedRev = stock * price;
      const expectedProf = stock * margin;

      totalInvestedCapital += invested;
      totalExpectedRevenue += expectedRev;
      totalExpectedProfit += expectedProf;

      let category: 'high' | 'mid' | 'low' = 'low';
      if (marginPercent >= 35) category = 'high';
      else if (marginPercent >= 15) category = 'mid';

      return {
        ...p,
        stock,
        cost,
        price,
        margin,
        marginPercent,
        invested,
        expectedRev,
        expectedProf,
        category
      };
    });

    // Sort by expected profit descending
    items.sort((a, b) => b.expectedProf - a.expectedProf);

    return {
      items,
      totalInvestedCapital,
      totalExpectedRevenue,
      totalExpectedProfit,
      avgMargin: totalExpectedRevenue > 0 ? Math.round((totalExpectedProfit / totalExpectedRevenue) * 100) : 0
    };
  }, [products]);

  const filteredItems = useMemo(() => {
    if (filterType === 'all') return analyzed.items;
    return analyzed.items.filter((i) => i.category === filterType);
  }, [analyzed.items, filterType]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-right" dir="rtl">
      {/* Top Banner KPI */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-emerald-900/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 font-black">
            <DollarSign size={28} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">مصفوفة التحليل المالي وربحية الأصناف</h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
              تحليل دقيق لتوزيع رأس المال المستثمر في المخزون وهامش الربح لكل منتج لاكتشاف الأصناف الأكثر ربحية.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 z-10">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block font-bold">رأس المال المستثمر</span>
            <span className="text-base sm:text-lg font-black text-white tabular-nums">{analyzed.totalInvestedCapital.toLocaleString()} ج.م</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block font-bold">الأرباح التقديرية بالمخزون</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 tabular-nums">{analyzed.totalExpectedProfit.toLocaleString()} ج.م</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block font-bold">متوسط هامش الربح</span>
            <span className="text-base sm:text-lg font-black text-amber-400 tabular-nums">{analyzed.avgMargin}%</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <span className="text-xs font-bold text-slate-500">تصنيف الأصناف حسب هوامش الربحية:</span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            الكل ({analyzed.items.length})
          </button>
          <button
            onClick={() => setFilterType('high')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'high' ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            ⭐ نجوم عالية الربحية ({analyzed.items.filter((i) => i.category === 'high').length})
          </button>
          <button
            onClick={() => setFilterType('mid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'mid' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
            }`}
          >
            ⚖️ ربحية معتدلة ({analyzed.items.filter((i) => i.category === 'mid').length})
          </button>
          <button
            onClick={() => setFilterType('low')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'low' ? 'bg-rose-600 text-white shadow-md' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
            }`}
          >
            ⚠️ ربحية منخفضة أو خسارة ({analyzed.items.filter((i) => i.category === 'low').length})
          </button>
        </div>
      </div>

      {/* Grid of Product Profit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h4 className="font-black text-slate-800 dark:text-white text-base leading-snug">{item.name}</h4>
                  <span className="text-[11px] font-mono text-slate-400 block mt-0.5">{item.sku}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                  item.category === 'high' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' :
                  item.category === 'mid' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400' :
                  'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                }`}>
                  {item.marginPercent}% ربح
                </span>
              </div>

              {/* Progress bar of margin */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.category === 'high' ? 'bg-emerald-500' : item.category === 'mid' ? 'bg-blue-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(Math.max(item.marginPercent, 5), 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">سعر التكلفة</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">{item.cost.toLocaleString()} ج.م</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">سعر البيع</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{item.price.toLocaleString()} ج.م</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center">
                  <span className="text-slate-500 font-bold">ربح القطعة الواحدة:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{item.margin.toLocaleString()} ج.م</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">المخزون المتوفر</span>
                <span className="font-black text-slate-800 dark:text-slate-200 tabular-nums">{item.stock} قطعة</span>
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 block">إجمالي الربح الكامن</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">{item.expectedProf.toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/* ==========================================================================
   TAB 4: QUICK BULK SPREADSHEET EDITOR
   ========================================================================== */
const BulkEditorTab: React.FC<{
  products: Product[];
  setSettings: (updater: React.SetStateAction<Settings>) => void;
  settings: Settings;
}> = ({ products, setSettings, settings }) => {
  const [edits, setEdits] = useState<Record<string, Partial<Product>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');

  const handleFieldChange = (id: string, field: keyof Product, value: any) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };

  const handleSaveAll = () => {
    const editIds = Object.keys(edits);
    if (editIds.length === 0) return;

    setIsSaving(true);
    try {
      const updatedProducts = products.map((p) => {
        if (edits[p.id]) {
          const updated = { ...p, ...edits[p.id] };
          if (updated.stockQuantity !== undefined) {
            updated.inStock = Number(updated.stockQuantity) > 0;
          }
          return updated;
        }
        return p;
      });

      setSettings((prev) => ({
        ...prev,
        products: updatedProducts
      }));

      setEdits({});
      try { audioSynth.playTone('success'); } catch (e) {}
      triggerCelebration('add_product', settings);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return products;
    return products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const totalEditsCount = Object.keys(edits).length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-right" dir="rtl">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
            <Sliders size={24} />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black dark:text-white">جدول التعديل السريع الجماعي</h3>
            <p className="text-xs text-slate-500 mt-0.5">عدل الأسعار، التكلفة، أو المخزون لعدة منتجات مباشرة مثل الإكسيل واحفظها دفعة واحدة.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="بحث في الجدول..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>

          <button
            onClick={handleSaveAll}
            disabled={totalEditsCount === 0 || isSaving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-md shrink-0 ${
              totalEditsCount > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-500/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save size={16} />
            <span>حفظ التعديلات ({totalEditsCount})</span>
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3.5 w-64">اسم المنتج</th>
                <th className="px-4 py-3.5 w-36">SKU</th>
                <th className="px-4 py-3.5 w-32">سعر التكلفة (ج.م)</th>
                <th className="px-4 py-3.5 w-32">سعر البيع (ج.م)</th>
                <th className="px-4 py-3.5 w-32">الكمية بالمخزون</th>
                <th className="px-4 py-3.5 w-32">حد التنبيه الأدنى</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filtered.map((p) => {
                const isEdited = !!edits[p.id];
                const currentName = edits[p.id]?.name ?? p.name;
                const currentSku = edits[p.id]?.sku ?? p.sku;
                const currentCost = edits[p.id]?.costPrice ?? p.costPrice ?? 0;
                const currentPrice = edits[p.id]?.price ?? p.price ?? 0;
                const currentStock = edits[p.id]?.stockQuantity ?? p.stockQuantity ?? 0;
                const currentMin = edits[p.id]?.minStockLevel ?? p.minStockLevel ?? 0;

                return (
                  <tr key={p.id} className={`transition-colors ${isEdited ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'}`}>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={currentName}
                        onChange={(e) => handleFieldChange(p.id, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={currentSku}
                        onChange={(e) => handleFieldChange(p.id, 'sku', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        value={currentCost}
                        onChange={(e) => handleFieldChange(p.id, 'costPrice', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold tabular-nums dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        value={currentPrice}
                        onChange={(e) => handleFieldChange(p.id, 'price', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        value={currentStock}
                        onChange={(e) => handleFieldChange(p.id, 'stockQuantity', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        value={currentMin}
                        onChange={(e) => handleFieldChange(p.id, 'minStockLevel', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

/* ==========================================================================
   TAB 5: SMART BARCODE & SKU SCANNER HUB
   ========================================================================== */
const BarcodeScannerTab: React.FC<{
  products: Product[];
  setSettings: (updater: React.SetStateAction<Settings>) => void;
  settings: Settings;
}> = ({ products, setSettings }) => {
  const [scanQuery, setScanQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!scanQuery.trim()) {
      setSelectedProduct(null);
      return;
    }
    const match = products.find(
      (p) =>
        p.sku.toLowerCase() === scanQuery.trim().toLowerCase() ||
        p.name.toLowerCase().includes(scanQuery.trim().toLowerCase())
    );
    if (match) {
      setSelectedProduct(match);
    } else {
      setSelectedProduct(null);
    }
  }, [scanQuery, products]);

  const handleQuickAdjust = (delta: number) => {
    if (!selectedProduct) return;
    const currentQty = selectedProduct.stockQuantity || 0;
    const newQty = Math.max(0, currentQty + delta);

    setSettings((prev) => ({
      ...prev,
      products: (prev.products || []).map((p) =>
        p.id === selectedProduct.id
          ? { ...p, stockQuantity: newQty, inStock: newQty > 0 }
          : p
      )
    }));

    try { audioSynth.playTone(delta > 0 ? 'success' : 'warning'); } catch (e) {}
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-right max-w-4xl mx-auto" dir="rtl">
      {/* Scanner Box */}
      <div className="bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white p-8 rounded-3xl shadow-xl border border-purple-900/40 text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto mb-4 font-black shadow-lg">
          <Barcode size={36} className="animate-pulse" />
        </div>
        <h3 className="text-2xl font-black tracking-tight">الماسح الضوئي الذكي والفحص السريع</h3>
        <p className="text-sm text-slate-300 max-w-md mx-auto mt-1 mb-6 font-medium">
          مرر قارئ الباركود على كود المنتج أو اكتب رقم SKU مباشرة للوصول الفوري وتعديل المخزون في ثوانٍ.
        </p>

        <div className="relative max-w-lg mx-auto">
          <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 w-6 h-6" />
          <input
            type="text"
            placeholder="امسح الباركود أو اكتب SKU أو اسم المنتج..."
            value={scanQuery}
            onChange={(e) => setScanQuery(e.target.value)}
            autoFocus
            className="w-full pr-14 pl-4 py-4 bg-white/10 backdrop-blur-md border-2 border-purple-500/50 rounded-2xl text-lg font-black text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/25 transition-all text-center"
          />
          {scanQuery && (
            <button
              onClick={() => setScanQuery('')}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white px-2 py-1 text-xs font-bold bg-white/10 rounded-lg"
            >
              مسح
            </button>
          )}
        </div>
      </div>

      {/* Live Result Display */}
      {scanQuery.trim() && !selectedProduct && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-400">
          <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" />
          <p className="font-bold text-base">لم يتم العثور على منتج مطابق لـ "{scanQuery}"</p>
          <p className="text-xs mt-1">تأكد من كتابة رمز SKU بشكل صحيح أو جرب البحث بالاسم.</p>
        </div>
      )}

      {selectedProduct && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-indigo-500/30 shadow-2xl space-y-6"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div className="flex items-center gap-4 text-right">
              {selectedProduct.thumbnail || selectedProduct.images?.[0] ? (
                <img src={selectedProduct.thumbnail || selectedProduct.images[0]} alt="" className="w-20 h-20 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-500 font-black text-2xl">
                  {selectedProduct.name.charAt(0)}
                </div>
              )}
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 mb-2 font-bold">
                  SKU: {selectedProduct.sku}
                </span>
                <h4 className="text-2xl font-black text-slate-800 dark:text-white">{selectedProduct.name}</h4>
                <p className="text-xs text-slate-400 mt-1">{selectedProduct.description || 'بدون وصف إضافي'}</p>
              </div>
            </div>

            <div className="text-center sm:text-left bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 min-w-40">
              <span className="text-xs text-slate-400 block font-bold">سعر البيع الحالي</span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                {selectedProduct.price.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
              </span>
            </div>
          </div>

          {/* Rapid Stock Adjuster */}
          <div className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 dark:from-slate-800/60 dark:via-indigo-950/20 dark:to-slate-800/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">الكمية الفعلية المتاحة بالمخزون:</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">
                  {selectedProduct.stockQuantity || 0}
                </span>
                <span className="text-sm font-bold text-slate-500">قطعة</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleQuickAdjust(-1)}
                className="w-14 h-14 rounded-2xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 font-black text-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm"
                title="سحب قطعة من المخزون (-1)"
              >
                <Minus size={24} />
              </button>
              <button
                onClick={() => handleQuickAdjust(1)}
                className="w-14 h-14 rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-400 font-black text-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm"
                title="إضافة قطعة للمخزون (+1)"
              >
                <Plus size={24} />
              </button>
              <button
                onClick={() => handleQuickAdjust(5)}
                className="px-4 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center transition-all active:scale-95 shadow-md shadow-indigo-500/20"
              >
                +5 قطع
              </button>
              <button
                onClick={() => handleQuickAdjust(10)}
                className="px-4 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center transition-all active:scale-95 shadow-md shadow-indigo-500/20"
              >
                +10 قطع
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
