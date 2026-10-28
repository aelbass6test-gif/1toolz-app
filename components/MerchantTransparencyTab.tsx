import React, { useState, useMemo } from 'react';
import { Order, Settings, CustomerProfile } from '../types';
import { 
  Building2, DollarSign, Calculator, FileText, CheckCircle2, 
  Printer, Download, Search, Filter, Calendar, User, 
  ArrowUpRight, ArrowDownLeft, ShieldAlert, Sparkles, X, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, RefreshCw, MessageSquare, RotateCcw, Eye,
  Layers, Percent, PackageCheck, AlertTriangle, FileSpreadsheet, Info,
  Package, Truck, ShieldCheck, ArrowRight, Check, Globe, ExternalLink
} from 'lucide-react';
import { getTrackingNumber, getShippingTrackingUrl } from '../utils/shippingTracking';
import { 
  calculateMerchantTransparencyAnalytics, 
  exportMerchantTransparencyExcel, 
  printMerchantTransparencyReport, 
  buildWhatsAppTransparencyText,
  ProductMovementItem,
  TransparencyOrderRow,
  TransparencyFilterOptions
} from '../utils/merchantAnalytics';
import { inAppToast } from '../utils/inAppAlert';

interface MerchantTransparencyTabProps {
  orders: Order[];
  settings: Settings;
  customers: CustomerProfile[];
  initialMerchantIdOrName?: string;
  onNavigateToSettlement?: (merchantId: string) => void;
  onOpenPortal?: (merchantId?: string) => void;
  isEmbeddedInPortal?: boolean;
  isDark?: boolean;
}

export const MerchantTransparencyTab: React.FC<MerchantTransparencyTabProps> = ({
  orders,
  settings,
  customers,
  initialMerchantIdOrName = 'all',
  onNavigateToSettlement,
  onOpenPortal,
  isEmbeddedInPortal = false,
  isDark = false
}) => {
  // Filter States
  const [selectedMerchant, setSelectedMerchant] = useState<string>(initialMerchantIdOrName);

  React.useEffect(() => {
    if (initialMerchantIdOrName) {
      setSelectedMerchant(initialMerchantIdOrName);
    }
  }, [initialMerchantIdOrName]);
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [settlementStatus, setSettlementStatus] = useState<'all' | 'settled' | 'unsettled'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // View sub-tab: 'products' | 'orders'
  const [subTab, setSubTab] = useState<'products' | 'orders'>('products');
  
  // Expanded order row in ledger
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Sorting in products table
  const [productSortBy, setProductSortBy] = useState<'sales' | 'delivered' | 'returned' | 'profit' | 'rate'>('sales');

  // Build list of merchants
  const merchantsList = useMemo(() => {
    const list: Array<{ id: string; name: string; phone?: string; sourceLabel: string }> = [];
    const seen = new Set<string>();

    // 1. Suppliers / Partners
    (settings.suppliers || []).forEach(s => {
      if (s.id && s.name && !seen.has(s.id)) {
        seen.add(s.id);
        seen.add(s.name.trim());
        list.push({ id: s.id, name: s.name.trim(), phone: s.phone, sourceLabel: 'مورد / شريك بضاعة' });
      }
    });

    // 2. Customers tagged as merchants
    customers.forEach(c => {
      const isTaggedMerchant =
        c.customerSegment === 'merchant' ||
        (Array.isArray(c.tags) && c.tags.some(t => ['موكل', 'صاحب بضاعة', 'تاجر', 'شريك', 'merchant', 'partner'].includes(String(t).trim().toLowerCase())));
      if (isTaggedMerchant && c.name && !seen.has(c.name.trim())) {
        seen.add(c.name.trim());
        if (c.phone) seen.add(c.phone);
        list.push({ id: c.phone || c.name, name: c.name.trim(), phone: c.phone, sourceLabel: 'موكل مسجل' });
      }
    });

    // 3. Unique merchants from orders
    orders.forEach(o => {
      const mName = (o.merchantName || '').trim();
      const mId = (o.merchantId || '').trim();
      if (mName && mId !== 'pending' && !seen.has(mName)) {
        seen.add(mName);
        if (mId) seen.add(mId);
        list.push({ id: mId || mName, name: mName, sourceLabel: 'أوردرات الموكلين' });
      }
    });

    return list;
  }, [settings.suppliers, customers, orders]);

  // Find merchant object
  const activeMerchantObj = useMemo(() => {
    if (!selectedMerchant || selectedMerchant === 'all') return undefined;
    return merchantsList.find(m => m.id === selectedMerchant || m.name === selectedMerchant);
  }, [selectedMerchant, merchantsList]);

  // Analytics Computation
  const analytics = useMemo(() => {
    const filterOpts: TransparencyFilterOptions = {
      dateRange,
      startDate,
      endDate,
      settlementStatus,
      searchTerm
    };
    return calculateMerchantTransparencyAnalytics(
      orders,
      settings,
      selectedMerchant,
      filterOpts,
      activeMerchantObj
    );
  }, [orders, settings, selectedMerchant, dateRange, startDate, endDate, settlementStatus, searchTerm, activeMerchantObj]);

  // Sorted product movements
  const sortedProducts = useMemo(() => {
    const prods = [...analytics.productMovements];
    if (productSortBy === 'sales') return prods.sort((a, b) => b.totalDeliveredSales - a.totalDeliveredSales);
    if (productSortBy === 'delivered') return prods.sort((a, b) => b.quantityDelivered - a.quantityDelivered);
    if (productSortBy === 'returned') return prods.sort((a, b) => b.quantityReturned - a.quantityReturned);
    if (productSortBy === 'profit') return prods.sort((a, b) => b.netProfit - a.netProfit);
    if (productSortBy === 'rate') return prods.sort((a, b) => b.returnRate - a.returnRate);
    return prods;
  }, [analytics.productMovements, productSortBy]);

  // Action: Export Excel
  const handleExportExcel = () => {
    try {
      exportMerchantTransparencyExcel(analytics, settings.storeName || 'متجري');
      inAppToast('تم تصدير ملف إكسيل الشفافية بنجاح.', 'success');
    } catch (e: any) {
      inAppToast('حدث خطأ أثناء تصدير ملف الإكسيل: ' + (e?.message || ''), 'error');
    }
  };

  // Action: Print Report
  const handlePrint = () => {
    try {
      printMerchantTransparencyReport(analytics, settings.storeName || 'متجري');
    } catch (e: any) {
      inAppToast('حدث خطأ أثناء تجهيز الطباعة: ' + (e?.message || ''), 'error');
    }
  };

  // Action: Share WhatsApp
  const handleShareWhatsApp = () => {
    const text = buildWhatsAppTransparencyText(analytics, settings.storeName || 'متجري');
    const targetPhone = activeMerchantObj?.phone ? activeMerchantObj.phone.replace(/[^0-9]/g, '') : '';
    
    // Copy to clipboard first
    navigator.clipboard?.writeText(text).then(() => {
      inAppToast('تم نسخ نص تقرير الشفافية إلى الحافظة.', 'success');
    }).catch(() => {});

    // Open WhatsApp
    const waUrl = targetPhone 
      ? `https://wa.me/${targetPhone.startsWith('2') ? targetPhone : '2' + targetPhone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const isProfit = analytics.merchantNetProfitOrLoss >= 0;

  return (
    <div className={`space-y-5 animate-fade-in ${isDark ? 'text-slate-100' : 'text-slate-800'}`} dir="rtl">
      
      {/* 1. Header & Filtering Bar */}
      <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'} rounded-3xl border shadow-xs p-4 sm:p-5 space-y-4`}>
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'} pb-4`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#008060] to-[#0a664e] flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  كشف الشفافية وحركة البضاعة والمخزن
                </h2>
                <span className={`text-[11px] font-bold ${isDark ? 'text-emerald-400' : 'text-[#008060]'}`}>
                  · محاسبة تفصيلية معتمدة
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
                متابعة شاملة لحركة الأصناف المباعة والمرتجعة ومصروفات الشحن وصافي المستحقات
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!isEmbeddedInPortal && (
              <button
                onClick={() => {
                  if (onOpenPortal) {
                    onOpenPortal(selectedMerchant);
                  } else {
                    const targetUrl = `/merchant-portal${selectedMerchant && selectedMerchant !== 'all' ? `?p=${encodeURIComponent(selectedMerchant)}` : ''}`;
                    window.location.href = targetUrl;
                  }
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black text-white bg-[#008060] hover:bg-[#0a664e] transition-all shadow-xs cursor-pointer"
                title="فتح بوابة الموكل الإلكترونية"
              >
                <Globe className="w-4 h-4" />
                <span>دخول بوابة الموكل</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200'
              }`}
              title="طباعة تقرير الشفافية الرسمي A4"
            >
              <Printer className="w-4 h-4 text-[#008060]" />
              <span>طباعة كشف A4 (PDF)</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
              title="تصدير ملف إكسيل متعدد الأوراق"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#008060]" />
              <span>تصدير Excel</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black text-white bg-[#008060] hover:bg-[#0a664e] transition-all shadow-xs cursor-pointer"
              title="مشاركة التقرير عبر واتساب"
            >
              <MessageSquare className="w-4 h-4" />
              <span>مشاركة واتساب</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isEmbeddedInPortal ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3 pt-1`}>
          {/* Merchant Selector (Hidden when locked inside portal) */}
          {!isEmbeddedInPortal && (
            <div>
              <label className={`block text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'} mb-1.5 flex items-center gap-1.5`}>
                <User className="w-3.5 h-3.5 text-[#008060]" />
                الموكل / صاحب البضاعة
              </label>
              <select
                value={selectedMerchant}
                onChange={e => setSelectedMerchant(e.target.value)}
                disabled={initialMerchantIdOrName !== 'all' && initialMerchantIdOrName !== ''}
                className={`w-full text-xs font-semibold px-3 py-2.5 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl focus:outline-none focus:border-[#008060] transition-all disabled:opacity-80 disabled:cursor-not-allowed`}
              >
                {initialMerchantIdOrName === 'all' && (
                  <option value="all">كافة الموكلين والشركاء (إجمالي عام)</option>
                )}
                {merchantsList.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.sourceLabel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              الفترة الزمنية
            </label>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            >
              <option value="all">كل الفترات السابقة</option>
              <option value="today">اليوم</option>
              <option value="7days">آخر 7 أيام</option>
              <option value="month">هذا الشهر الحالي</option>
              <option value="custom">فترة مخصصة...</option>
            </select>
          </div>

          {/* Settlement Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              حالة التسوية
            </label>
            <select
              value={settlementStatus}
              onChange={e => setSettlementStatus(e.target.value as any)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            >
              <option value="all">الكل (المسوى وغير المسوى)</option>
              <option value="unsettled">غير المسوى فقط (مستحق التسوية)</option>
              <option value="settled">المسوى فقط (كشوفات تاريخية)</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-500" />
              بحث سريع في الكشف
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="رقم الطلب، العميل، الصنف..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs px-3 py-2 pl-8 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Date Pickers if selected */}
        {dateRange === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">من تاريخ</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Executive Transparency Metrics (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Gross Collected */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي المحصل</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {analytics.totalCollected.toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span>من {analytics.deliveredCount} طلب مسلّم</span>
          </div>
        </div>

        {/* Card 2: Goods Cost Recovered */}
        <div className="bg-white rounded-2xl p-4 border border-sky-100 bg-sky-50/20 shadow-sm relative overflow-hidden group hover:border-sky-200 transition-all">
          <div className="flex items-center justify-between text-sky-800 mb-2">
            <span className="text-xs font-bold">رأس مال البضاعة</span>
            <span className="p-2 rounded-xl bg-sky-100 text-sky-700">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-sky-900 font-mono">
            {analytics.totalGoodsCostRecovered.toLocaleString()} <span className="text-xs font-bold text-sky-700">ج.م</span>
          </div>
          <div className="text-[10px] text-sky-600 mt-1">
            تكلفة البضاعة المباعة المستردة
          </div>
        </div>

        {/* Card 3: Shipping & Logistics */}
        <div className="bg-white rounded-2xl p-4 border border-rose-100 bg-rose-50/20 shadow-sm relative overflow-hidden group hover:border-rose-200 transition-all">
          <div className="flex items-center justify-between text-rose-800 mb-2">
            <span className="text-xs font-bold">الشحن واللوجستيات</span>
            <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-rose-700 font-mono">
            -{analytics.totalShippingAndCarrier.toLocaleString()} <span className="text-xs font-bold text-rose-500">ج.م</span>
          </div>
          <div className="text-[10px] text-rose-600 mt-1 truncate" title={`شحن ${analytics.totalBaseShipping} | تأمين ${analytics.totalInsurance} | معاينة ${analytics.totalInspection} | ضريبة ${analytics.totalVat}`}>
            شحن {analytics.totalBaseShipping} + تأمين وضريبة {analytics.totalCarrierAdditionalFees}
          </div>
        </div>

        {/* Card 4: Service Fee & Marketing & Returns */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 bg-amber-50/20 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-all">
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-xs font-bold">مصاريف التشغيل والمرتجع</span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-amber-800 font-mono">
            -{(analytics.totalServiceFees + analytics.totalMarketingCosts + analytics.totalReturnLosses).toLocaleString()} <span className="text-xs font-bold text-amber-600">ج.م</span>
          </div>
          <div className="text-[10px] text-amber-700 mt-1 truncate" title={`عمولة: ${analytics.totalServiceFees} | تسويق: ${analytics.totalMarketingCosts} | خسارة مرتجع: ${analytics.totalReturnLosses}`}>
            عمولة {analytics.totalServiceFees} + تسويق {analytics.totalMarketingCosts} + مرتجع {analytics.totalReturnLosses}
          </div>
        </div>

        {/* Card 5: Net Profit/Loss Over Capital */}
        <div className={`bg-white rounded-2xl p-4 border ${isProfit ? 'border-emerald-200 bg-emerald-50/20' : 'border-red-200 bg-red-50/20'} shadow-sm relative overflow-hidden group transition-all`}>
          <div className={`flex items-center justify-between ${isProfit ? 'text-emerald-800' : 'text-red-800'} mb-2`}>
            <span className="text-xs font-bold">صافي أرباح الموكل</span>
            <span className={`p-2 rounded-xl ${isProfit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </span>
          </div>
          <div className={`text-xl font-black font-mono ${isProfit ? 'text-emerald-700' : 'text-red-700'}`}>
            {isProfit ? '+' : ''}{analytics.merchantNetProfitOrLoss.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
          </div>
          <div className={`text-[10px] font-bold ${isProfit ? 'text-emerald-600' : 'text-red-600'} mt-1`}>
            العائد على البضاعة: {analytics.roiPercentage}%
          </div>
        </div>

        {/* Card 6: Final Net Payout to Merchant */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-md shadow-indigo-900/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-indigo-200 mb-2">
            <span className="text-xs font-bold">الصافي النهائي للموكل</span>
            <span className="p-2 rounded-xl bg-white/10 text-emerald-400">
              <Calculator className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {analytics.netPayoutToMerchant.toLocaleString()} <span className="text-xs font-bold text-indigo-300">ج.م</span>
          </div>
          <div className="text-[10px] text-indigo-200/80 mt-1">
            رأس المال {isProfit ? '+ الأرباح' : '- الخسائر'}
          </div>
        </div>
      </div>

      {/* 3. Delivery Health Progress & Key Ratio */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">
              إحصائية حركة الطلبات والشحنات
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              إجمالي {analytics.totalOrdersCount} طلب • {analytics.deliveredCount} مسلّم بنجاح ({analytics.deliverySuccessRate}%) • {analytics.returnCount} مرتجع ({analytics.returnRate}%) • {analytics.pendingDeliveryCount} قيد التنفيذ
            </div>
          </div>
        </div>

        {/* Delivery vs Return Visual Bar */}
        <div className="w-full md:w-80 flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-emerald-700">نسبة التسليم: {analytics.deliverySuccessRate}%</span>
            <span className="text-rose-700">نسبة الارتجاع: {analytics.returnRate}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              style={{ width: `${analytics.deliverySuccessRate}%` }} 
              className="bg-emerald-500 h-full transition-all duration-500"
              title={`تسليم ناجح: ${analytics.deliverySuccessRate}%`}
            />
            <div 
              style={{ width: `${analytics.returnRate}%` }} 
              className="bg-rose-500 h-full transition-all duration-500"
              title={`مرتجع: ${analytics.returnRate}%`}
            />
          </div>
        </div>
      </div>

      {/* 4. Sub-Navigation Tabs: Products Movement vs Orders Ledger */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl w-fit">
        <button
          onClick={() => setSubTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'products'
              ? 'bg-[#008060] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>حركة وتجميع الأصناف</span>
          <span className={`font-mono text-[11px] ${subTab === 'products' ? 'text-emerald-100' : 'text-slate-500'}`}>
            ({analytics.productMovements.length})
          </span>
        </button>

        <button
          onClick={() => setSubTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'orders'
              ? 'bg-[#008060] text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>البيان المحاسبي للأوردرات</span>
          <span className={`font-mono text-[11px] ${subTab === 'orders' ? 'text-emerald-100' : 'text-slate-500'}`}>
            ({analytics.orderRows.length})
          </span>
        </button>
      </div>

      {/* 5. Sub-Tab Content */}

      {/* SUB-TAB 1: PRODUCT MOVEMENT BREAKDOWN */}
      {subTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Table Controls */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-500" />
                تحليل مبيعات ومرتجعات كل صنف تابع للموكل
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold">ترتيب حسب:</span>
                <select
                  value={productSortBy}
                  onChange={e => setProductSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="sales">الأعلى مبيعاً (إيرادات)</option>
                  <option value="delivered">الأكثر تسليماً (كمية)</option>
                  <option value="profit">الأعلى صافي ربح</option>
                  <option value="returned">الأعلى كمية مرتجع</option>
                  <option value="rate">الأعلى نسبة ارتجاع (%)</option>
                </select>
              </div>
            </div>

            {/* Mobile Product Cards (md:hidden) */}
            <div className="md:hidden divide-y divide-slate-100">
              {sortedProducts.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs font-bold">
                  لا توجد منتجات مسجلة لهذا الموكل في الفترة المحددة
                </div>
              ) : (
                sortedProducts.map((prod, idx) => {
                  const isProdProfit = prod.netProfit >= 0;
                  return (
                    <div key={prod.productId + '_mob_' + idx} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008060] flex items-center justify-center font-black text-xs shrink-0 border border-emerald-100">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-xs text-slate-900 truncate">{prod.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{prod.sku} · إجمالي المطلوب: {prod.totalQuantityOrdered} ق</div>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className={`text-xs font-black font-mono tabular-nums ${isProdProfit ? 'text-[#008060]' : 'text-rose-600'}`}>
                            {isProdProfit ? '+' : ''}{prod.netProfit.toLocaleString()} ج.م
                          </div>
                          <div className="text-[10px] text-slate-400">صافي الربح</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">المسلّم</span>
                          <span className="font-mono font-black text-emerald-700">{prod.quantityDelivered} ق</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">المرتجع ({prod.returnRate}%)</span>
                          <span className="font-mono font-black text-rose-600">{prod.quantityReturned} ق</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">رأس المال</span>
                          <span className="font-mono font-black text-sky-800">{prod.totalDeliveredCost.toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">المنتج / الصنف</th>
                    <th className="py-3 px-3 text-center">كود SKU</th>
                    <th className="py-3 px-3 text-center">إجمالي المطلوب</th>
                    <th className="py-3 px-3 text-center text-emerald-800">المسلّم (المباع)</th>
                    <th className="py-3 px-3 text-center text-rose-800">المرتجع</th>
                    <th className="py-3 px-3 text-center">نسبة الارتجاع</th>
                    <th className="py-3 px-3 text-center">إجمالي المبيعات</th>
                    <th className="py-3 px-3 text-center text-sky-800">رأس مال المباع</th>
                    <th className="py-3 px-3 text-center text-rose-800">المصروفات المحملة</th>
                    <th className="py-3 px-4 text-left">صافي ربح الصنف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        لا توجد منتجات مسجلة لهذا الموكل في الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    sortedProducts.map((prod, idx) => {
                      const isProdProfit = prod.netProfit >= 0;
                      return (
                        <tr key={prod.productId + '_' + idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {prod.image ? (
                                <img
                                  src={prod.image}
                                  alt={prod.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#008060] flex items-center justify-center font-bold text-xs flex-shrink-0 border border-emerald-100">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 leading-snug">{prod.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{prod.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-500">
                            {prod.sku}
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono text-slate-700">
                            {prod.totalQuantityOrdered}
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono text-emerald-700 bg-emerald-50/30">
                            {prod.quantityDelivered} ق
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono text-rose-700 bg-rose-50/30">
                            {prod.quantityReturned} ق
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              prod.returnRate > 25 
                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                : prod.returnRate > 10 
                                ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {prod.returnRate}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono text-slate-800">
                            {prod.totalDeliveredSales.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono text-sky-800">
                            {prod.totalDeliveredCost.toLocaleString()} <span className="text-[10px] text-sky-500">ج.م</span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono text-rose-700">
                            -{prod.allocatedExpenses.toLocaleString()} <span className="text-[10px] text-rose-400">ج.م</span>
                          </td>
                          <td className="py-3 px-4 text-left font-black font-mono">
                            <span className={`inline-block px-2.5 py-1 rounded-lg ${
                              isProdProfit ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {isProdProfit ? '+' : ''}{prod.netProfit.toLocaleString()} ج.م
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Product Movement Footer Summary */}
            {(() => {
              const sumProdProfit = analytics.productMovements.reduce((s, p) => s + p.netProfit, 0);
              const isSumProfit = sumProdProfit >= 0;
              return (
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="text-slate-600 font-semibold">
                    إجمالي حركة الأصناف: <span className="font-bold text-slate-900">{analytics.productMovements.length} صنف</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 font-mono font-bold">
                    <span className="text-emerald-700">مباع: {analytics.productMovements.reduce((s, p) => s + p.quantityDelivered, 0)} قطعة</span>
                    <span className="text-rose-700">مرتجع: {analytics.productMovements.reduce((s, p) => s + p.quantityReturned, 0)} قطعة</span>
                    <span className="text-sky-800">رأس مال البضاعة: {analytics.totalGoodsCostRecovered.toLocaleString()} ج.م</span>
                    <span className={`${isSumProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                      صافي أرباح المنتجات: {isSumProfit ? '+' : ''}{sumProdProfit.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ITEMIZED ORDER LEDGER */}
      {subTab === 'orders' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                سجل الطلبات المفصل الخاص بالموكل ({analytics.orderRows.length} طلب)
              </div>
              <div className="text-xs text-slate-400">
                انقر على أي سطر لعرض تفاصيل التكاليف والمعادلة الرياضية بالكامل
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">رقم الطلب والتاريخ</th>
                    <th className="py-3 px-3">شركة الشحن والتتبع</th>
                    <th className="py-3 px-3">العميل والمحافظة</th>
                    <th className="py-3 px-3 text-center">الحالة</th>
                    <th className="py-3 px-3">الأصناف المشمولة</th>
                    <th className="py-3 px-3 text-center">المحصل</th>
                    <th className="py-3 px-3 text-center text-sky-800">رأس المال</th>
                    <th className="py-3 px-3 text-center text-rose-800">الشحن الأساسي</th>
                    <th className="py-3 px-3 text-center text-rose-600">رسوم (VAT/تأمين)</th>
                    <th className="py-3 px-3 text-center text-amber-800">العمولة والإعلانات</th>
                    <th className="py-3 px-3 text-center text-indigo-900">صافي المستحق</th>
                    <th className="py-3 px-3 text-center">ربح/خسارة</th>
                    <th className="py-3 px-2 text-center">تفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.orderRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        لا توجد طلبات مسجلة مطابقة للفلاتر المحددة
                      </td>
                    </tr>
                  ) : (
                    analytics.orderRows.map((o) => {
                      const isExpanded = expandedOrderId === o.orderId;
                      const isOrderProfit = o.merchantProfitOrLoss >= 0;
                      const trackingNum = o.rawOrder ? getTrackingNumber(o.rawOrder) : '';
                      const trackingUrl = o.rawOrder ? getShippingTrackingUrl(o.rawOrder) : null;

                      return (
                        <React.Fragment key={o.orderId}>
                          <tr 
                            onClick={() => setExpandedOrderId(isExpanded ? null : o.orderId)}
                            className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70'}`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-slate-900">#{o.orderNumber}</div>
                              <div className="text-[10px] text-slate-400">{new Date(o.date).toLocaleDateString('ar-EG')}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800 flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{o.shippingCompany || 'شركة الشحن'}</span>
                              </div>
                              <div className="flex flex-col gap-1 mt-0.5 items-start">
                                {trackingNum ? (
                                  <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    بوليصة: {trackingNum}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400">قيد إصدار البوليصة</div>
                                )}

                                {trackingUrl && (
                                  <a
                                    href={trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded-md transition-all shadow-2xs shrink-0"
                                    title="فتح صفحة تتبع الشحنة المباشرة لدى شركة الشحن"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    <span>تتبع الشحنة 🚚</span>
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800 truncate max-w-[140px]">{o.customerName}</div>
                              <div className="text-[10px] text-slate-400">{o.city || 'المدينة غير محددة'}</div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                o.isDelivered 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : o.isReturn 
                                  ? 'bg-rose-100 text-rose-800' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 max-w-[200px] truncate" title={o.itemsSummary}>
                              <span className="text-slate-600">{o.itemsSummary || 'منتج عام'}</span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono text-slate-900">
                              {o.collectedAmount.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono text-sky-800">
                              {o.merchantGoodsCost.toLocaleString()} <span className="text-[10px] text-sky-500">ج.م</span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono text-rose-700">
                              -{o.baseShippingFee.toLocaleString()} <span className="text-[10px] text-rose-400">ج.م</span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono text-rose-600" title={`تأمين: ${o.insuranceFee} | ضريبة: ${o.vatFee} | معاينة: ${o.inspectionFee} | COD: ${o.codFee}`}>
                              -{(o.carrierAdditionalFees + o.codFee).toLocaleString()} <span className="text-[10px] text-rose-400">ج.م</span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono text-amber-800" title={`عمولة: ${o.serviceFee} | تسويق: ${o.marketingFee}`}>
                              -{(o.serviceFee + o.marketingFee).toLocaleString()} <span className="text-[10px] text-amber-500">ج.م</span>
                            </td>
                            <td className="py-3 px-3 text-center font-black font-mono">
                              <span className={`inline-block px-2 py-0.5 rounded-lg ${
                                o.netMerchantAmount >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                              }`}>
                                {o.netMerchantAmount.toLocaleString()} ج.م
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold font-mono">
                              <span className={isOrderProfit ? 'text-emerald-600' : 'text-rose-600'}>
                                {isOrderProfit ? '+' : ''}{o.merchantProfitOrLoss.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center text-slate-400">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </td>
                          </tr>

                          {/* Expanded Detail Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 border-y-2 border-indigo-100">
                              <td colSpan={12} className="p-4">
                                <div className="space-y-4 max-w-5xl mx-auto">
                                  {/* Detailed Calculation Formula Ribbon */}
                                  <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2">
                                      <Calculator className="w-4 h-4 text-indigo-600" />
                                      <span className="font-bold text-slate-800">معادلة احتساب مستحق الموكل لهذا الطلب:</span>
                                    </div>
                                    <div className="font-mono text-xs text-slate-700 font-semibold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                      {o.isDelivered ? (
                                        <div className="space-y-1">
                                          <div>
                                            معادلة الأرباح: التحصيل ({o.collectedAmount}) - [الشحن ({o.baseShippingFee}) + رسوم ({o.carrierAdditionalFees}) + عمولة ({o.serviceFee}) + تسويق ({o.marketingFee})] = <span className="text-emerald-700 font-bold">{o.netMerchantAmount} ج.م</span>
                                          </div>
                                          <div className="text-[10px] text-slate-400 font-sans">
                                            * صافي ربحك الفعلي = {o.netMerchantAmount} - تكلفة البضاعة ({o.merchantGoodsCost}) = <span className={o.merchantProfitOrLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{o.merchantProfitOrLoss} ج.م</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          خسارة المرتجع = الشحن والرسوم ({o.totalShippingAndCarrier}) + التسويق ({o.marketingFee}) = <span className="text-rose-700 font-bold">-{o.returnLoss} ج.م</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Itemized Shipping & Carrier Fees breakdown */}
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs">
                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                      <div className="text-[10px] text-slate-400 font-bold">الشحن الأساسي</div>
                                      <div className="text-xs font-bold font-mono text-slate-800 mt-1">{o.baseShippingFee} ج.م</div>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                      <div className="text-[10px] text-slate-400 font-bold">رسوم التأمين</div>
                                      <div className="text-xs font-bold font-mono text-slate-800 mt-1">{o.insuranceFee} ج.م</div>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                      <div className="text-[10px] text-slate-400 font-bold">رسوم المعاينة</div>
                                      <div className="text-xs font-bold font-mono text-slate-800 mt-1">{o.inspectionFee} ج.م</div>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                      <div className="text-[10px] text-slate-400 font-bold">ضريبة VAT 14%</div>
                                      <div className="text-xs font-bold font-mono text-slate-800 mt-1">{o.vatFee} ج.م</div>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                      <div className="text-[10px] text-slate-400 font-bold">عمولة COD التحصيل</div>
                                      <div className="text-xs font-bold font-mono text-slate-800 mt-1">{o.codFee} ج.م</div>
                                    </div>
                                  </div>

                                  {/* Raw Items List inside this order */}
                                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                                      أصناف الطلب وتكلفة بضاعة كل صنف:
                                    </div>
                                    <div className="divide-y divide-slate-100 text-xs">
                                      {o.rawItems.map((it, itIdx) => (
                                        <div key={itIdx} className="p-2.5 flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                            <span className="font-bold text-slate-800">{it.name || it.productName || 'منتج'}</span>
                                            <span className="text-slate-400 font-mono text-[11px]">(x{it.quantity || 1})</span>
                                          </div>
                                          <div className="flex items-center gap-4 font-mono text-xs">
                                            <span className="text-slate-500">سعر البيع: {it.price || 0} ج.م</span>
                                            <span className="text-sky-800 font-bold">تكلفة القطعة: {it.cost || 0} ج.م</span>
                                            <span className="text-slate-900 font-black">إجمالي التكلفة: {((it.cost || 0) * (it.quantity || 1)).toLocaleString()} ج.م</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Bottom Transparency Guarantee Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>ميثاق الشفافية والمساءلة المشتركة</span>
          </div>
          <h3 className="text-lg font-black text-white">
            جميع الأرقام مستخرجة ومطابقة لحركة الشحنات وتكاليف الشحن الفعلية
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            يضمن هذا التقرير تفصيلاً كاملاً لكل مليم: تكلفة البضاعة المباعة المستردة للموكل، استقطاعات الشحن والرسوم الحكومية والضرائب، مصاريف الإعلانات، وصافي الأرباح المستحقة لتعزيز الثقة وبناء شراكة تجارية مستدامة.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {onNavigateToSettlement && selectedMerchant !== 'all' && (
            <button
              onClick={() => onNavigateToSettlement(selectedMerchant)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-900/40 transition-all"
            >
              <Calculator className="w-4 h-4" />
              <span>إجراء تسوية جديدة لهذا الموكل</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل نسخة للموكل</span>
          </button>
        </div>
      </div>
    </div>
  );
};
