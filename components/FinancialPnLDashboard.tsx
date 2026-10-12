import React, { useState, useMemo } from 'react';
import { Settings, Order, SupplyOrder, Treasury, Wallet } from '../types';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet as WalletIcon, 
  ShoppingBag, Truck, AlertTriangle, ArrowUpRight, ArrowDownLeft, 
  PieChart, BarChart2, Calendar, FileText, Download, Printer, ShieldAlert, Sparkles
} from 'lucide-react';
import { printHTMLDirectly } from '../utils/printHelper';
import * as XLSX from 'xlsx';

interface FinancialPnLDashboardProps {
  orders: Order[];
  settings: Settings;
  treasury?: Treasury;
  wallet?: Wallet;
}

export const FinancialPnLDashboard: React.FC<FinancialPnLDashboardProps> = ({
  orders,
  settings,
  treasury,
  wallet
}) => {
  const [period, setPeriod] = useState<'all' | 'this_month' | 'last_30'>('this_month');

  // Compute Live Financial P&L
  const pnlMetrics = useMemo(() => {
    let filteredOrders = orders;
    let filteredSupplyOrders = settings.supplyOrders || [];

    if (period === 'this_month') {
      const now = new Date();
      filteredOrders = orders.filter(o => {
        const d = new Date(o.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      filteredSupplyOrders = (settings.supplyOrders || []).filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (period === 'last_30') {
      const past = Date.now() - (30 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => new Date(o.date).getTime() >= past);
      filteredSupplyOrders = (settings.supplyOrders || []).filter(s => new Date(s.date).getTime() >= past);
    }

    // 1. Gross Revenue (Total Customer Invoices)
    const grossRevenue = filteredOrders.reduce((sum, o) => {
      if (o.status === 'ملغي') return sum;
      return sum + (o.totalPrice || 0);
    }, 0);

    // 2. Collected Sales Revenue
    const collectedRevenue = filteredOrders.reduce((sum, o) => {
      if (['تم_التحصيل', 'مدفوعة', 'تم_التوصيل'].includes(o.status) || o.paymentStatus === 'مدفوع') {
        return sum + (o.totalPrice || 0);
      }
      return sum;
    }, 0);

    // 3. Total COGS (Cost of Goods Sold)
    const totalCogs = filteredOrders.reduce((sum, o) => {
      if (o.status === 'ملغي' || o.status === 'مرتجع') return sum;
      const itemsCost = (o.items || []).reduce((iSum, item) => iSum + ((item.cost || 0) * (item.quantity || 1)), 0);
      return sum + itemsCost;
    }, 0);

    // 4. Logistics & Shipping Costs (Paid to carriers)
    const logisticsCosts = filteredOrders.reduce((sum, o) => {
      if (o.status === 'ملغي') return sum;
      return sum + (o.shippingFee || 0);
    }, 0);

    // 5. Operating & Miscellaneous Expenses (Treasury Withdrawals / Supply Other Fees)
    let operatingExpenses = 0;
    if (treasury?.transactions) {
      operatingExpenses = treasury.transactions.reduce((sum, tx) => {
        if (tx.type === 'withdrawal' && !tx.orderId) {
          return sum + (tx.amount || 0);
        }
        return sum;
      }, 0);
    }

    // Supply Purchases Cost
    const totalPurchasesCost = filteredSupplyOrders.reduce((sum, s) => sum + (s.grandTotal || s.totalCost || 0), 0);

    // 6. Net Profit Calculation
    const grossProfit = grossRevenue - totalCogs;
    const netOperatingProfit = grossProfit - logisticsCosts - operatingExpenses;

    return {
      grossRevenue,
      collectedRevenue,
      totalCogs,
      logisticsCosts,
      operatingExpenses,
      totalPurchasesCost,
      grossProfit,
      netOperatingProfit,
      totalOrdersCount: filteredOrders.length,
      deliveredOrdersCount: filteredOrders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل'].includes(o.status)).length,
      returnedOrdersCount: filteredOrders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_جزئي'].includes(o.status)).length
    };
  }, [orders, settings.supplyOrders, treasury, period]);

  const handleExportExcel = () => {
    const data = [
      { 'البند المالي': 'إجمالي إيرادات المبيعات (Gross Sales)', 'المبلغ (ج.م)': pnlMetrics.grossRevenue },
      { 'البند المالي': 'المبالغ المحصلة فعلياً (Collected Cash)', 'المبلغ (ج.م)': pnlMetrics.collectedRevenue },
      { 'البند المالي': 'تكلفة البضاعة المباعة (COGS)', 'المبلغ (ج.م)': -pnlMetrics.totalCogs },
      { 'البند المالي': 'إجمالي الربح الهامشي (Gross Profit)', 'المبلغ (ج.م)': pnlMetrics.grossProfit },
      { 'البند المالي': 'مصاريف الشحن واللوجستيات', 'المبلغ (ج.م)': -pnlMetrics.logisticsCosts },
      { 'البند المالي': 'المصروفات التشغيلية والخزينة', 'المبلغ (ج.م)': -pnlMetrics.operatingExpenses },
      { 'البند المالي': 'صافي الأرباح التشغيلية الحقيقية (Net Profit)', 'المبلغ (ج.م)': pnlMetrics.netOperatingProfit }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "قائمة الأرباح والخسائر");
    XLSX.writeFile(wb, `قائمة_الأرباح_والخسائر_${period}.xlsx`);
  };

  const handlePrintPnL = () => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>قائمة الأرباح والخسائر المباشرة P&L</title>
        <style>
          body { font-family: 'Cairo', sans-serif; padding: 30px; color: #0f172a; }
          .header { border-b: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; }
          .title { font-size: 24px; font-weight: 900; color: #065f46; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 15px; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-b: 1px border-dashed #cbd5e1; font-weight: bold; }
          .highlight { background: #d1fae5; border: 2px solid #10b981; border-radius: 12px; padding: 15px; font-size: 18px; font-weight: 900; color: #065f46; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">📊 قائمة الأرباح والخسائر المباشرة (Live P&L)</div>
            <div>الفترة: ${period === 'this_month' ? 'الشهر الحالي' : period === 'last_30' ? 'آخر 30 يوم' : 'جميع الأوقات'}</div>
          </div>
          <div style="font-weight: bold; color: #10b981;">${settings.storeName || 'المتجر'}</div>
        </div>

        <div class="card">
          <div class="row"><span>إجمالي الإيرادات والفواتير:</span> <span>${pnlMetrics.grossRevenue.toLocaleString()} ج.م</span></div>
          <div class="row"><span>إيرادات المحصلة فعلياً:</span> <span>${pnlMetrics.collectedRevenue.toLocaleString()} ج.م</span></div>
          <div class="row" style="color: #e11d48;"><span>تكلفة البضاعة المباعة (COGS):</span> <span>-${pnlMetrics.totalCogs.toLocaleString()} ج.م</span></div>
          <div class="row" style="color: #0284c7;"><span>إجمالي الربح الهامشي (Gross Profit):</span> <span>${pnlMetrics.grossProfit.toLocaleString()} ج.م</span></div>
        </div>

        <div class="card">
          <div class="row" style="color: #e11d48;"><span>تكاليف الشحن والخدمات اللوجستية:</span> <span>-${pnlMetrics.logisticsCosts.toLocaleString()} ج.م</span></div>
          <div class="row" style="color: #e11d48;"><span>المصروفات التشغيلية والخزينة:</span> <span>-${pnlMetrics.operatingExpenses.toLocaleString()} ج.م</span></div>
        </div>

        <div class="highlight" style="display: flex; justify-content: space-between;">
          <span>صافي الربح التشغيلي القابل للتوزيع:</span>
          <span>${pnlMetrics.netOperatingProfit.toLocaleString()} ج.م</span>
        </div>
      </body>
      </html>
    `;
    printHTMLDirectly(html);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top Banner & Filter Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-black border border-emerald-500/30 inline-flex items-center gap-1.5">
            <Sparkles size={14} /> لوحة الموازنة المباشرة اللحظية P&L
          </span>
          <h2 className="text-2xl sm:text-3xl font-black">تحليل الأرباح والخسائر وتكاليف التشغيل</h2>
          <p className="text-xs text-slate-300 font-medium max-w-xl">
            رصد صافي الربح الحقيقي بخصم التكلفة الفعلية للأصناف وتكاليف الشحن والمصروفات التشغيلية.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <div className="bg-white/10 p-1.5 rounded-2xl border border-white/10 flex items-center gap-1 text-xs font-bold">
            {(['this_month', 'last_30', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-2 rounded-xl transition-all cursor-pointer ${period === p ? 'bg-white text-slate-900 shadow-md font-black' : 'text-slate-300 hover:bg-white/10'}`}
              >
                {p === 'this_month' ? 'الشهر الحالي' : p === 'last_30' ? 'آخر 30 يوم' : 'الكل'}
              </button>
            ))}
          </div>

          <button onClick={handlePrintPnL} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white font-bold transition-all cursor-pointer" title="طباعة رسمية">
            <Printer size={18} />
          </button>
          <button onClick={handleExportExcel} className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white font-bold transition-all cursor-pointer" title="تصدير Excel">
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Gross Revenue Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-400 uppercase">إجمالي إيرادات المبيعات</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
            {pnlMetrics.grossRevenue.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            محصل منها: <strong className="text-emerald-600">{pnlMetrics.collectedRevenue.toLocaleString()} ج.م</strong>
          </div>
        </div>

        {/* Total COGS Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-rose-500 uppercase">تكلفة البضاعة المباعة (COGS)</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {pnlMetrics.totalCogs.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            مشتريات جديدة: {pnlMetrics.totalPurchasesCost.toLocaleString()} ج.م
          </div>
        </div>

        {/* Logistics & Expenses Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-500 uppercase">مصاريف الشحن والتشغيل</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Truck size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {(pnlMetrics.logisticsCosts + pnlMetrics.operatingExpenses).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            شحن: {pnlMetrics.logisticsCosts.toLocaleString()} ج.م | خزينة: {pnlMetrics.operatingExpenses.toLocaleString()} ج.م
          </div>
        </div>

        {/* Net Operating Profit Card */}
        <div className={`p-6 rounded-3xl border shadow-xl space-y-2 ${
          pnlMetrics.netOperatingProfit >= 0
            ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-transparent border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
            : 'bg-gradient-to-br from-rose-500/10 via-red-500/10 to-transparent border-rose-500/30 text-rose-950 dark:text-rose-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider">صافي الربح التشغيلي النهائي</span>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${pnlMetrics.netOperatingProfit >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono">
            {pnlMetrics.netOperatingProfit.toLocaleString()} <span className="text-xs font-bold opacity-80">ج.م</span>
          </div>
          <div className="text-[10px] font-bold opacity-80">
            {pnlMetrics.netOperatingProfit >= 0 ? 'الربح الصافي القابل للتوزيع أو الاستثمار' : 'خسارة تشغيلية بحاجة لمراجعة التكاليف'}
          </div>
        </div>

      </div>

    </div>
  );
};
