import React, { useState, useMemo } from 'react';
import { Partner, Order, Product, Settings, PartnerAllowedReports } from '../types';
import { 
  BarChart3, TrendingUp, Package, DollarSign, Truck, PieChart, 
  Coins, ShoppingCart, ArrowUpRight, ArrowDownRight, Layers, CheckCircle2, 
  AlertTriangle, Filter, Calendar, Printer, Download, Eye, Sparkles
} from 'lucide-react';

interface PartnerReportsViewProps {
  partner: Partner;
  orders: Order[];
  products: Product[];
  settings: Settings;
  allowedReports: PartnerAllowedReports;
  storeName: string;
}

export const PartnerReportsView: React.FC<PartnerReportsViewProps> = ({
  partner,
  orders = [],
  products = [],
  settings,
  allowedReports = {},
  storeName
}) => {
  // Available report keys that are allowed
  const availableReports = useMemo(() => {
    const list: { key: keyof PartnerAllowedReports; title: string; icon: React.ElementType }[] = [];
    if (allowedReports.salesAndRevenue) list.push({ key: 'salesAndRevenue', title: 'المبيعات والإيرادات', icon: BarChart3 });
    if (allowedReports.topSellingProducts) list.push({ key: 'topSellingProducts', title: 'أفضل المنتجات مبيعاً', icon: Package });
    if (allowedReports.inventoryValuation) list.push({ key: 'inventoryValuation', title: 'قيمة المخزون والبضائع', icon: Layers });
    if (allowedReports.expensesBreakdown) list.push({ key: 'expensesBreakdown', title: 'المصروفات والتكاليف', icon: DollarSign });
    if (allowedReports.shippingPerformance) list.push({ key: 'shippingPerformance', title: 'الشحن والتسليم والمرتجع', icon: Truck });
    if (allowedReports.profitDistributions) list.push({ key: 'profitDistributions', title: 'دورات توزيع الأرباح', icon: TrendingUp });
    if (allowedReports.cashFlowSummary) list.push({ key: 'cashFlowSummary', title: 'التدفقات النقدية والخزائن', icon: Coins });
    return list;
  }, [allowedReports]);

  const [activeReportKey, setActiveReportKey] = useState<keyof PartnerAllowedReports>(() => {
    return availableReports[0]?.key || 'salesAndRevenue';
  });

  const isDeliveredStatus = (status: string) => ['تم_التوصيل', 'تم_توصيلها', 'تم_التحصيل', 'مدفوعة'].includes(status);
  const isReturnedStatus = (status: string) => ['مرتجع', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن'].includes(status);
  const isCancelledStatus = (status: string) => ['ملغي'].includes(status);

  // Calculate Sales & Revenue Stats
  const salesStats = useMemo(() => {
    const validOrders = orders.filter(o => !isCancelledStatus(o.status) && !isReturnedStatus(o.status));
    const deliveredOrders = orders.filter(o => isDeliveredStatus(o.status));
    const totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.totalPrice || o.netRevenue || o.productPrice || 0)), 0);
    const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.totalPrice || o.netRevenue || o.productPrice || 0)), 0);
    const avgOrderValue = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;
    const partnerRatio = partner.profitRatio || 0;
    const partnerShare = Math.round((deliveredRevenue * partnerRatio) / 100);

    return {
      totalOrders: validOrders.length,
      deliveredOrders: deliveredOrders.length,
      totalRevenue,
      deliveredRevenue,
      avgOrderValue,
      partnerShare,
      partnerRatio
    };
  }, [orders, partner]);

  // Top Products Stats
  const topProductsStats = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; totalRevenue: number }> = {};
    orders.forEach(order => {
      if (isCancelledStatus(order.status)) return;
      (order.items || []).forEach(item => {
        const pId = item.productId || item.name;
        if (!counts[pId]) {
          counts[pId] = {
            name: item.name,
            qty: 0,
            totalRevenue: 0
          };
        }
        counts[pId].qty += (item.quantity || 1);
        counts[pId].totalRevenue += ((Number(item.price) || 0) * (item.quantity || 1));
      });
    });

    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [orders]);

  // Inventory Valuation Stats
  const inventoryStats = useMemo(() => {
    let totalCost = 0;
    let totalRetail = 0;
    let totalQuantity = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      const stock = Number(p.stock) || 0;
      const cost = Number(p.costPrice) || 0;
      const price = Number(p.price) || 0;

      totalQuantity += stock;
      totalCost += (stock * cost);
      totalRetail += (stock * price);
      if (stock <= 5) lowStockCount++;
    });

    const partnerInventoryShare = Math.round((totalCost * (partner.profitRatio || 0)) / 100);

    return {
      totalCost,
      totalRetail,
      totalQuantity,
      lowStockCount,
      partnerInventoryShare,
      expectedProfit: totalRetail - totalCost
    };
  }, [products, partner]);

  // Expenses Stats
  const expensesStats = useMemo(() => {
    const rawExpenses = (settings as any)?.expenses || (settings as any)?.generalExpenses || [];
    const totalExpenses = rawExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const byCategory: Record<string, number> = {};

    rawExpenses.forEach((e: any) => {
      const cat = e.category || 'عام';
      byCategory[cat] = (byCategory[cat] || 0) + (Number(e.amount) || 0);
    });

    const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

    return {
      totalExpenses,
      categoryData,
      count: rawExpenses.length
    };
  }, [settings]);

  // Shipping & Delivery Stats
  const shippingStats = useMemo(() => {
    const total = orders.length;
    if (total === 0) return { deliveredRate: 0, returnedRate: 0, pendingRate: 0, delivered: 0, returned: 0, inTransit: 0 };

    const delivered = orders.filter(o => isDeliveredStatus(o.status)).length;
    const returned = orders.filter(o => isReturnedStatus(o.status)).length;
    const inTransit = orders.filter(o => ['قيد_الشحن', 'تم_الارسال', 'قيد_التنفيذ'].includes(o.status)).length;

    const deliveredRate = Math.round((delivered / total) * 100);
    const returnedRate = Math.round((returned / total) * 100);
    const pendingRate = Math.max(0, 100 - deliveredRate - returnedRate);

    return {
      total,
      delivered,
      returned,
      inTransit,
      deliveredRate,
      returnedRate,
      pendingRate
    };
  }, [orders]);

  if (availableReports.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
        <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
          <Eye size={28} />
        </div>
        <h3 className="text-base font-black text-slate-800">لا توجد تقارير مفعلة حالياً</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          لم تقم إدارة المتجر بتفعيل أي تقارير مخصصة لحسابك حتى الآن. يمكنك مراجعة الإدارة لمنحك صلاحية الاطلاع على تقارير المتجر.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header with Selector Pills */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <BarChart3 size={20} className="text-[#008060]" />
              <span>تقارير الشراكة المعتمدة والمخصصة</span>
            </h3>
            <p className="text-xs text-slate-500">
              التقارير والإحصائيات المصرح لك بالاطلاع عليها من إدارة متجر {storeName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              متاح لك: {availableReports.length} تقارير
            </span>
          </div>
        </div>

        {/* Report Selector Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {availableReports.map(rep => {
            const Icon = rep.icon;
            const isActive = activeReportKey === rep.key;
            return (
              <button
                key={rep.key}
                type="button"
                onClick={() => setActiveReportKey(rep.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  isActive 
                    ? 'bg-[#008060] text-white shadow-md shadow-[#008060]/20' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <Icon size={15} />
                <span>{rep.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* REPORT 1: SALES & REVENUE                           */}
      {/* ==================================================== */}
      {activeReportKey === 'salesAndRevenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500">إجمالي إيرادات المبيعات المحققة</span>
              <div className="text-2xl font-black font-mono text-slate-900">
                {salesStats.deliveredRevenue.toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold">من الطلبات المسلمة بالكامل</span>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500">إجمالي عدد الطلبيات</span>
              <div className="text-2xl font-black font-mono text-slate-900">
                {salesStats.totalOrders.toLocaleString()} <span className="text-xs font-normal opacity-70">طلب</span>
              </div>
              <span className="text-[10px] text-slate-500">المسلم منها: {salesStats.deliveredOrders}</span>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500">متوسط قيمة الأوردر</span>
              <div className="text-2xl font-black font-mono text-slate-900">
                {salesStats.avgOrderValue.toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
              </div>
              <span className="text-[10px] text-slate-500">لكل طلب مؤكد</span>
            </div>

            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-900">حصتك المعتمدة ({salesStats.partnerRatio}%)</span>
              <div className="text-2xl font-black font-mono text-[#008060]">
                {salesStats.partnerShare.toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold">تقدير من إجمالي الإيراد المسلم</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* REPORT 2: TOP SELLING PRODUCTS                      */}
      {/* ==================================================== */}
      {activeReportKey === 'topSellingProducts' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h4 className="font-black text-sm text-slate-900 border-b border-slate-100 pb-3">
            ترتيب المنتجات الأكثر طلباً ومبيعاً
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-bold">
                  <th className="py-2.5 px-3">الترتيب</th>
                  <th className="py-2.5 px-3">اسم المنتج</th>
                  <th className="py-2.5 px-3">الكمية المباعة</th>
                  <th className="py-2.5 px-3">إجمالي الإيراد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topProductsStats.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-black text-slate-400">#{idx + 1}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <span>{p.name}</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-indigo-600">{p.qty} قطعة</td>
                    <td className="py-3 px-3 font-mono font-bold text-[#008060]">{p.totalRevenue.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* REPORT 3: INVENTORY VALUATION                       */}
      {/* ==================================================== */}
      {activeReportKey === 'inventoryValuation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500">إجمالي قيمة المخزون (سعر التكلفة)</span>
              <div className="text-2xl font-black font-mono text-slate-900">
                {inventoryStats.totalCost.toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
              </div>
              <span className="text-[10px] text-slate-500">إجمالي قطع البضاعة: {inventoryStats.totalQuantity}</span>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500">القيمة التقديرية للبيع التجاري</span>
              <div className="text-2xl font-black font-mono text-emerald-600">
                {inventoryStats.totalRetail.toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
              </div>
              <span className="text-[10px] text-slate-500">الربح المتوقع: {inventoryStats.expectedProfit.toLocaleString()} ج.م</span>
            </div>

            <div className="p-5 rounded-3xl bg-emerald-50/60 border border-emerald-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-900">حصتك الرأسمالية في المخزون</span>
              <div className="text-2xl font-black font-mono text-[#008060]">
                {inventoryStats.partnerInventoryShare.toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold">بناءً على نسبة {partner.profitRatio || 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* REPORT 4: EXPENSES BREAKDOWN                        */}
      {/* ==================================================== */}
      {activeReportKey === 'expensesBreakdown' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="font-black text-sm text-slate-900">
              توزيع المصروفات والتكاليف التشغيلية للمتجر
            </h4>
            <div className="text-sm font-black text-rose-600 font-mono">
              الإجمالي: {expensesStats.totalExpenses.toLocaleString()} ج.م
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expensesStats.categoryData.map((cat, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-600 block">{cat.name}</span>
                <div className="text-lg font-black font-mono text-slate-900">
                  {cat.value.toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {expensesStats.totalExpenses > 0 ? Math.round((cat.value / expensesStats.totalExpenses) * 100) : 0}% من المصروفات
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* REPORT 5: SHIPPING & DELIVERY                       */}
      {/* ==================================================== */}
      {activeReportKey === 'shippingPerformance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-800">نسبة التسليم والتحصيل</span>
              <div className="text-3xl font-black font-mono text-emerald-600">
                {shippingStats.deliveredRate}%
              </div>
              <span className="text-[10px] text-emerald-700">{shippingStats.delivered} أوردر مسلم بنجاح</span>
            </div>

            <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-rose-800">نسبة المرتجع والإلغاء</span>
              <div className="text-3xl font-black font-mono text-rose-600">
                {shippingStats.returnedRate}%
              </div>
              <span className="text-[10px] text-rose-700">{shippingStats.returned} أوردر مرتجع</span>
            </div>

            <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-amber-800">شحنات قيد التوصيل</span>
              <div className="text-3xl font-black font-mono text-amber-600">
                {shippingStats.inTransit}
              </div>
              <span className="text-[10px] text-amber-700">مع مندوبي وشركات الشحن</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* REPORT 6: PROFIT DISTRIBUTIONS                      */}
      {/* ==================================================== */}
      {activeReportKey === 'profitDistributions' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h4 className="font-black text-sm text-slate-900 border-b border-slate-100 pb-3">
            سجل دورات توزيع الأرباح المعتمدة لحساب الشريك
          </h4>
          <div className="space-y-3">
            {(settings.partnerTransactions || [])
              .filter(t => t.partnerId === partner.id && t.type === 'profit_distribution')
              .map((t, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 flex justify-between items-center">
                  <div>
                    <span className="font-black text-xs text-slate-900 block">{t.note || 'توزيع أرباح دورية'}</span>
                    <span className="text-[10px] font-mono text-slate-500">{new Date(t.date).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-emerald-600 text-sm">+{Number(t.amount || 0).toLocaleString()} ج.م</span>
                    <span className="text-[10px] text-emerald-700 block font-bold">معتمد بالحساب</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* REPORT 7: CASH FLOW                                 */}
      {/* ==================================================== */}
      {activeReportKey === 'cashFlowSummary' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h4 className="font-black text-sm text-slate-900 border-b border-slate-100 pb-3">
            ملخص حركة الخزائن والتدفقات النقدية
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {((settings as any)?.treasuries || []).map((t: any, idx: number) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="font-black text-xs text-slate-900 block">{t.name}</span>
                  <span className="text-[10px] text-slate-500">{t.type === 'bank' ? 'حساب بنكي' : t.type === 'wallet' ? 'محفظة إلكترونية' : 'خزينة نقدية'}</span>
                </div>
                <div className="font-mono font-black text-sm text-[#008060]">
                  {Number(t.balance || 0).toLocaleString()} ج.م
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
