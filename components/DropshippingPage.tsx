import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  Store, 
  TrendingUp, 
  Plus, 
  Search, 
  Printer, 
  FileText, 
  Calculator, 
  DollarSign, 
  Filter, 
  CheckCircle, 
  ExternalLink, 
  Building2, 
  Phone, 
  Edit, 
  Eye, 
  Sparkles,
  ArrowRight,
  ChevronDown,
  Layers
} from 'lucide-react';
import { Order, Settings, Store as StoreType } from '../types';
import { calculateOrderProfitLoss } from '../utils/financials';
import { generateShippingLabelHTML } from '../utils/shippingLabelGenerator';
import { generateInvoiceHTML } from '../utils/invoiceGenerator';

interface DropshippingPageProps {
  orders: Order[];
  settings: Settings;
  activeStore?: StoreType;
  setOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
}

export const DropshippingPage: React.FC<DropshippingPageProps> = ({
  orders = [],
  settings,
  activeStore,
  setOrders
}) => {
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const storePrefix = storeId ? `/store/${storeId}` : (activeStore ? `/store/${activeStore.id}` : '');

  const [activeTab, setActiveTab] = useState<'orders' | 'brands' | 'calculator'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [selectedOrderForPreview, setSelectedOrderForPreview] = useState<Order | null>(null);

  // Quick Profit Calculator State
  const [calcCost, setCalcCost] = useState<number>(200);
  const [calcShipping, setCalcShipping] = useState<number>(65);
  const [calcProfit, setCalcProfit] = useState<number>(100);

  // Filter dropshipping / external orders
  const dropshipOrders = useMemo(() => {
    return orders.filter(order => {
      const hasExtItems = order.items && order.items.some(
        (item: any) => item.isExternal || item.productId?.startsWith('external-') || item.productId?.startsWith('custom-')
      );
      const hasBrand = !!(order.merchantBrandName && order.merchantBrandName.trim().length > 0);
      const hasExtraMarkup = Number(order.externalProfitMarkup || 0) > 0;
      const isMarkedExt = (order as any).isExternalDropship === true;

      return hasExtItems || hasBrand || hasExtraMarkup || isMarkedExt;
    });
  }, [orders]);

  // Search & Brand filtered orders
  const filteredOrders = useMemo(() => {
    return dropshipOrders.filter(order => {
      const matchesSearch = 
        !searchQuery ||
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerPhone.includes(searchQuery) ||
        (order.merchantBrandName && order.merchantBrandName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesBrand = 
        brandFilter === 'all' || 
        (order.merchantBrandName && order.merchantBrandName.trim() === brandFilter);

      return matchesSearch && matchesBrand;
    });
  }, [dropshipOrders, searchQuery, brandFilter]);

  // Aggregate KPI metrics
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalNetProfit = 0;
    const brandsSet = new Set<string>();

    dropshipOrders.forEach(order => {
      const fin = calculateOrderProfitLoss(order, settings);
      totalSales += (order.totalPrice || fin.netRevenue || 0);
      totalNetProfit += fin.profit;

      if (order.merchantBrandName && order.merchantBrandName.trim()) {
        brandsSet.add(order.merchantBrandName.trim());
      }
    });

    const totalCount = dropshipOrders.length;
    const avgProfit = totalCount > 0 ? totalNetProfit / totalCount : 0;

    return {
      totalSales,
      totalNetProfit,
      totalCount,
      uniqueBrandsCount: brandsSet.size,
      avgProfit,
      uniqueBrandsList: Array.from(brandsSet)
    };
  }, [dropshipOrders, settings]);

  // Directory of Merchant Brands
  const merchantBrandsDirectory = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      orderCount: number;
      totalRevenue: number;
      totalProfit: number;
      lastOrderDate: string;
    }>();

    dropshipOrders.forEach(order => {
      const bName = order.merchantBrandName?.trim() || "غير محدد (عميل مجهول)";
      const bPhone = order.merchantBrandPhone?.trim() || "";
      const fin = calculateOrderProfitLoss(order, settings);

      const existing = map.get(bName) || {
        name: bName,
        phone: bPhone,
        orderCount: 0,
        totalRevenue: 0,
        totalProfit: 0,
        lastOrderDate: order.date
      };

      existing.orderCount += 1;
      existing.totalRevenue += (order.totalPrice || fin.netRevenue || 0);
      existing.totalProfit += fin.profit;
      if (new Date(order.date) > new Date(existing.lastOrderDate)) {
        existing.lastOrderDate = order.date;
      }
      if (bPhone && !existing.phone) {
        existing.phone = bPhone;
      }

      map.set(bName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [dropshipOrders, settings]);

  // Printing functions
  const handlePrintShippingLabel = (order: Order) => {
    const storeName = order.merchantBrandName?.trim() || activeStore?.name || "متجري";
    const html = generateShippingLabelHTML(order, storeName, settings);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  };

  const handlePrintInvoice = (order: Order) => {
    const storeName = order.merchantBrandName?.trim() || activeStore?.name || "متجري";
    const html = generateInvoiceHTML(order, settings, storeName);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute left-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-black rounded-full">
              <Sparkles size={14} className="text-amber-200" />
              <span>منظومة شحن المنتجات بدون مخزون & White Label</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">إدارة الدروب شيبنج والشحن الخارجي</h1>
            <p className="text-amber-100 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
              إعادة تحويل الشحنات، طباعة بوليصات وفواتير باسم البراند الخارجي للمورد، وتحصيل عمولاتك وأرباحك المباشرة بدون الحاجة لتسجيل مخزون محلي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate(`${storePrefix}/dropshipping/new`)}
              className="px-5 py-3.5 bg-white text-amber-900 hover:bg-amber-50 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-black/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus size={18} />
              <span>إنشاء أوردر دروب شيبنج جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">أوردرات الدروب شيبنج</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
              <Package size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-800 dark:text-white">
            {metrics.totalCount}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">شحنة تم إنشاؤها بدون مخزون</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">إجمالي تحصيلات المبيعات</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
              <Truck size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-800 dark:text-white">
            {Math.round(metrics.totalSales).toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">قيمة الـ COD المطلوبة من شركات الشحن</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">صافي عمولاتك ومكسبك</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            +{Math.round(metrics.totalNetProfit).toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
          </div>
          <p className="text-[10px] text-emerald-600/80 font-medium">الربح الصافي المحقق بعد خصم التكلفة</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">براندات الموردين</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
              <Store size={18} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-800 dark:text-white">
            {metrics.uniqueBrandsCount}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">براند يتم الشحن باسمه (White Label)</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <Package size={16} />
          <span>سجل شحنات الدروب شيبنج ({dropshipOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('brands')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'brands'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <Building2 size={16} />
          <span>دليل براندات الموردين ({merchantBrandsDirectory.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'calculator'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <Calculator size={16} />
          <span>حاسبة أرباح الهامش السريعة</span>
        </button>
      </div>

      {/* TAB 1: DROPSHIP ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث برقم الأوردر، اسم العميل، رقم الهاتف، أو اسم براند المورد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            {metrics.uniqueBrandsList.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400 shrink-0" />
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="all">جميع البراندات ({metrics.uniqueBrandsList.length})</option>
                  {metrics.uniqueBrandsList.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
                <Package size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-lg text-slate-800 dark:text-white">لا توجد طلبيات دروب شيبنج تطابق البحث</h3>
                <p className="text-xs text-slate-400">يمكنك إنشاء أوردر جديد إضافة أصناف بدون مخزون أو كتابة اسم براند المورد في إعدادات الطلب.</p>
              </div>
              <button
                onClick={() => navigate(`${storePrefix}/dropshipping/new`)}
                className="px-6 py-3 bg-amber-600 text-white font-black rounded-xl text-xs hover:bg-amber-700 transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                <span>إنشاء أول أوردر دروب شيبنج</span>
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">الأوردر والعميل</th>
                      <th className="p-3.5">براند المورد (الراسل المطبوع)</th>
                      <th className="p-3.5">الأصناف والتكلفة</th>
                      <th className="p-3.5">قيمة التحصيل COD</th>
                      <th className="p-3.5">صافي المكسَب والعمولة</th>
                      <th className="p-3.5">شركة الشحن والحالة</th>
                      <th className="p-3.5 text-center">طباعة وإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOrders.map(order => {
                      const fin = calculateOrderProfitLoss(order, settings);
                      const isBrandSet = !!order.merchantBrandName?.trim();

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-amber-600 dark:text-amber-400">#{order.orderNumber}</span>
                              <span className="text-[10px] text-slate-400">{new Date(order.date).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <div className="font-bold text-slate-800 dark:text-white">{order.customerName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{order.customerPhone}</div>
                          </td>

                          <td className="p-3.5">
                            {isBrandSet ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 rounded-lg text-[11px] font-black">
                                  <Store size={12} />
                                  <span>{order.merchantBrandName}</span>
                                </span>
                                {order.merchantBrandPhone && (
                                  <div className="text-[10px] font-mono text-slate-400">
                                    هاتف: {order.merchantBrandPhone}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-medium">اسم المتجر الافتراضي ({activeStore?.name || 'متجري'})</span>
                            )}
                          </td>

                          <td className="p-3.5 space-y-1">
                            <div className="font-medium text-slate-700 dark:text-slate-300">
                              {order.items && order.items.length > 0 ? (
                                order.items.map((it, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                                    <span className="text-slate-400">• {it.quantity}x</span>
                                    <span className="truncate max-w-[140px] font-bold">{it.name}</span>
                                    {it.cost ? <span className="text-[10px] text-amber-600 font-mono">(ت: {it.cost}ج)</span> : null}
                                  </div>
                                ))
                              ) : (
                                <span>{order.productName || 'بضاعة دروب شيبنج'}</span>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5 font-mono font-black text-sm text-slate-800 dark:text-white">
                            {Math.round(order.totalPrice || fin.netRevenue || 0).toLocaleString('ar-EG')} <span className="text-[10px] font-normal text-slate-400">ج.م</span>
                          </td>

                          <td className="p-3.5">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl font-mono font-black text-xs border border-emerald-200 dark:border-emerald-800">
                              <TrendingUp size={12} />
                              <span>+{Math.round(fin.profit).toLocaleString('ar-EG')} ج.م</span>
                            </div>
                          </td>

                          <td className="p-3.5 space-y-1">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold block w-fit">
                              {order.shippingCompany || 'شركة شحن عامة'}
                            </span>
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              {order.status || 'معلق'}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handlePrintShippingLabel(order)}
                                title="طباعة بوليصة باسم البراند الخارجي"
                                className="p-2 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 rounded-xl transition-colors cursor-pointer"
                              >
                                <Printer size={15} />
                              </button>

                              <button
                                onClick={() => handlePrintInvoice(order)}
                                title="طباعة الفاتورة"
                                className="p-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl transition-colors cursor-pointer"
                              >
                                <FileText size={15} />
                              </button>

                              <button
                                onClick={() => navigate(`${storePrefix}/orders/edit/${order.id}`)}
                                title="تعديل الأوردر"
                                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                              >
                                <Edit size={15} />
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

      {/* TAB 2: MERCHANT BRANDS DIRECTORY */}
      {activeTab === 'brands' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="font-black text-sm text-amber-900 dark:text-amber-200">دليل براندات الموردين والعملاء المعتمدين</h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">سجل بأسماء الشركاء والموردين الذين يتم الشحن لحسابهم White Label</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {merchantBrandsDirectory.map((brand, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 flex items-center justify-center font-black text-base">
                        {brand.name.substring(0, 1)}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 dark:text-white text-sm">{brand.name}</h4>
                        {brand.phone && (
                          <p className="text-xs font-mono text-slate-400 flex items-center gap-1">
                            <Phone size={12} /> {brand.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold rounded-lg">
                      {brand.orderCount} شحنة
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">إجمالي تحصيل الشحنات:</span>
                      <span className="font-black font-mono text-slate-800 dark:text-slate-200">
                        {Math.round(brand.totalRevenue).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">صافي عمولاتك منها:</span>
                      <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                        +{Math.round(brand.totalProfit).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setBrandFilter(brand.name);
                    setActiveTab('orders');
                  }}
                  className="w-full py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye size={14} />
                  <span>عرض شحنات هذا البراند</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DROPSHIP PROFIT CALCULATOR */}
      {activeTab === 'calculator' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 max-w-2xl mx-auto shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="p-3 bg-amber-500 text-white rounded-2xl">
              <Calculator size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 dark:text-white">حاسبة أرباح الهامش والدروب شيبنج السريعة</h3>
              <p className="text-xs text-slate-400">احسب السعر النهائي المقترح للعميل وقيمة تحصيل شركة الشحن فورياً بناءً على تكلفة المورد</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                تكلفة الشراء من المورد الاصلي (ج.م)
              </label>
              <input
                type="number"
                value={calcCost}
                onChange={(e) => setCalcCost(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                تكلفة الشحن والتوصيل المتوقعة (ج.م)
              </label>
              <input
                type="number"
                value={calcShipping}
                onChange={(e) => setCalcShipping(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                مكسَبك المطلوب / الهامش الصافي (ج.م)
              </label>
              <input
                type="number"
                value={calcProfit}
                onChange={(e) => setCalcProfit(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* Calculations Result Box */}
            {(() => {
              const suggestedSellingPrice = calcCost + calcProfit;
              const totalCODToCollect = suggestedSellingPrice + calcShipping;
              const profitMarginPercent = suggestedSellingPrice > 0 ? ((calcProfit / suggestedSellingPrice) * 100).toFixed(1) : '0';

              return (
                <div className="p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span>سعر بيع المنتج للعميل (شامل المكسب):</span>
                    <span className="text-sm font-mono font-black text-slate-900 dark:text-white">{suggestedSellingPrice} ج.م</span>
                  </div>

                  <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span>قيمة الـ COD الشاملة التوصيل للشركة:</span>
                    <span className="text-base font-mono font-black text-amber-600 dark:text-amber-400">{totalCODToCollect} ج.م</span>
                  </div>

                  <div className="pt-2 border-t border-amber-200 dark:border-amber-800/60 flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">نسبة الربح الصافي:</span>
                    <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">{profitMarginPercent}%</span>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => navigate(`${storePrefix}/dropshipping/new`)}
              className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Plus size={18} />
              <span>إنشاء أوردر دروب شيبنج بهذه الحسبة الآن</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropshippingPage;
