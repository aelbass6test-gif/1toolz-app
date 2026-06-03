import React, { useMemo, useState } from 'react';
import { 
  Search, 
  History, 
  TrendingUp, 
  TrendingDown,
  Coins, 
  ShieldCheck, 
  Banknote, 
  Calendar, 
  Package, 
  MapPin, 
  Truck, 
  Info, 
  X, 
  Receipt, 
  Printer, 
  Filter, 
  Percent, 
  Download, 
  RefreshCw,
  TrendingUp as ProfitIcon,
  HelpCircle
} from 'lucide-react';
import { Order, Settings, Store, OrderItem } from '../types';
import { generateCollectionsReportHTML } from '../utils/reportGenerator';
import { isBosta, calculateInsuranceFee, calculateBostaVat } from '../utils/financials';
import { printHTMLDirectly } from '../utils/printHelper';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  Legend
} from 'recharts';

interface CollectionsReportPageProps {
  orders: Order[];
  settings: Settings;
  activeStore?: Store;
}

interface UpgradedBreakdownDetails {
  orderNumber: string;
  customerName: string;
  shippingCompany: string;
  shippingArea: string;
  productPrice: number;
  productCost: number;
  shippingFee: number;
  totalAmount: number;
  insuranceFee: number;
  inspectionCost: number;
  inspectionPaid: boolean | undefined;
  codFee: number;
  net: number;
  discount: number;
  extraAdjustment: number;
  advancePayment: number;
  items: OrderItem[];
  date: string;
  bostaVat?: number;
  insuranceOnlyFee?: number;
}

const CollectionsReportPage: React.FC<CollectionsReportPageProps> = ({ orders, settings, activeStore }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBreakdown, setSelectedBreakdown] = useState<UpgradedBreakdownDetails | null>(null);
  
  // Custom Filter States
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'this_month'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProfitBracket, setSelectedProfitBracket] = useState<'all' | 'profitable' | 'non_profitable'>('all');

  const calculateCodFee = (order: Order) => {
    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const enabled = useCustom ? (compFees?.enableCodFees ?? true) : true;
    if (!enabled) return 0;

    const threshold = useCustom ? compFees!.codThreshold : settings.codThreshold;
    const rate = useCustom ? compFees!.codFeeRate : settings.codFeeRate;
    const tax = useCustom ? compFees!.codTaxRate : settings.codTaxRate;

    const totalAmount = order.productPrice + order.shippingFee;
    
    if (totalAmount <= threshold) return 0;

    const taxableAmount = totalAmount - threshold;
    const fee = taxableAmount * rate;
    const totalWithTax = fee * (1 + tax);
    
    return totalWithTax;
  };

  // Get list of unique shipping companies
  const shippingCompanies = useMemo(() => {
    const companies = new Set<string>();
    orders.forEach(o => {
      if (o.status === 'تم_التحصيل' && o.shippingCompany) {
        companies.add(o.shippingCompany);
      }
    });
    return Array.from(companies);
  }, [orders]);

  // Master Filter Logic
  const collectedOrders = useMemo(() => {
    let list = orders.filter(o => o.status === 'تم_التحصيل');

    // 1. Filter by search term
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(o => 
        o.customerName.toLowerCase().includes(s) || 
        o.orderNumber.toLowerCase().includes(s) ||
        (o.shippingCompany && o.shippingCompany.toLowerCase().includes(s)) ||
        (o.customerPhone && o.customerPhone.includes(s))
      );
    }

    // 2. Filter by shipping company
    if (selectedCompany !== 'all') {
      list = list.filter(o => o.shippingCompany === selectedCompany);
    }

    // 3. Filter by date presets
    if (dateRange !== 'all') {
      const now = new Date();
      list = list.filter(o => {
        if (!o.date) return false;
        const oDate = new Date(o.date);
        
        if (dateRange === 'today') {
          return oDate.toDateString() === now.toDateString();
        } else if (dateRange === 'yesterday') {
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          return oDate.toDateString() === yesterday.toDateString();
        } else if (dateRange === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          return oDate >= sevenDaysAgo;
        } else if (dateRange === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          return oDate >= thirtyDaysAgo;
        } else if (dateRange === 'this_month') {
          return oDate.getMonth() === now.getMonth() && oDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    // 4. Custom calendar date pickers
    if (startDate) {
      list = list.filter(o => o.date && o.date.split('T')[0] >= startDate);
    }
    if (endDate) {
      list = list.filter(o => o.date && o.date.split('T')[0] <= endDate);
    }

    // 5. Filter by profitability
    if (selectedProfitBracket !== 'all') {
      list = list.filter(o => {
        const cod = calculateCodFee(o);
        const compFees = settings.companySpecificFees?.[o.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
        const insuranceFee = calculateInsuranceFee(o, insuranceRate, settings);
        const inspectionAdjustment = o.inspectionFeePaidByCustomer ? 0 : inspectionCost;
        const bostaVat = calculateBostaVat(o, insuranceFee, settings);
        
        const safeDiscount = o.discount || 0;
        const safeAdvance = o.advancePayment || 0;
        const defaultCollectionAmount = o.productPrice + o.shippingFee - safeDiscount - safeAdvance + (o.inspectionFeePaidByCustomer ? inspectionCost : 0);
        const collectionAmount = o.totalAmountOverride !== undefined ? o.totalAmountOverride : defaultCollectionAmount;
        const extraAdjustment = o.totalAmountOverride !== undefined ? o.totalAmountOverride - defaultCollectionAmount : 0;
        
        const netProfit = o.productPrice - safeDiscount - o.productCost - insuranceFee - inspectionAdjustment - cod - bostaVat + extraAdjustment;
        
        return selectedProfitBracket === 'profitable' ? netProfit > 0 : netProfit <= 0;
      });
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, searchTerm, selectedCompany, dateRange, startDate, endDate, selectedProfitBracket, settings]);

  // Dynamic Metrics & Stats Calculation
  const stats = useMemo(() => {
    let totalGross = 0;
    let totalNetProfit = 0;
    let totalInsuranceFees = 0;
    let totalCodFees = 0;
    let totalCOGS = 0;
    let totalDeductions = 0;

    collectedOrders.forEach(o => {
      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
      
      const codFee = calculateCodFee(o);
      const insuranceFee = calculateInsuranceFee(o, insuranceRate, settings);
      const inspectionAdjustment = o.inspectionFeePaidByCustomer ? 0 : inspectionCost;
      const bostaVat = calculateBostaVat(o, insuranceFee, settings);
      
      const safeDiscount = o.discount || 0;
      const safeAdvance = o.advancePayment || 0;
      const defaultCollectionAmount = o.productPrice + o.shippingFee - safeDiscount - safeAdvance + (o.inspectionFeePaidByCustomer ? inspectionCost : 0);
      const collectionAmount = o.totalAmountOverride !== undefined ? o.totalAmountOverride : defaultCollectionAmount;
      const extraAdjustment = o.totalAmountOverride !== undefined ? o.totalAmountOverride - defaultCollectionAmount : 0;
      
      const shippingDeduction = insuranceFee + inspectionAdjustment + codFee + bostaVat;
      
      totalGross += collectionAmount;
      totalInsuranceFees += insuranceFee + bostaVat;
      totalCodFees += codFee;
      totalCOGS += o.productCost || 0;
      totalDeductions += shippingDeduction;
      totalNetProfit += (o.productPrice - safeDiscount - o.productCost - insuranceFee - inspectionAdjustment - codFee - bostaVat + extraAdjustment);
    });

    const netMarginPercent = totalGross > 0 ? (totalNetProfit / totalGross) * 100 : 0;
    const directROIValue = totalCOGS > 0 ? (totalNetProfit / totalCOGS) * 100 : 0;

    return { 
      totalGross, 
      totalNetProfit, 
      count: collectedOrders.length, 
      totalInsuranceFees, 
      totalCodFees,
      totalCOGS,
      totalDeductions,
      netMarginPercent,
      directROI: directROIValue
    };
  }, [collectedOrders, settings]);

  // Chart Data compilation (last 15 active days)
  const chartData = useMemo(() => {
    const dailyMap: Record<string, { dateStr: string; label: string; gross: number; net: number; count: number }> = {};
    
    collectedOrders.forEach(o => {
      if (!o.date) return;
      const dateStr = o.date.split('T')[0];
      
      const cod = calculateCodFee(o);
      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
      const insuranceFee = calculateInsuranceFee(o, insuranceRate, settings);
      const inspectionAdjustment = o.inspectionFeePaidByCustomer ? 0 : inspectionCost;
      const bostaVat = calculateBostaVat(o, insuranceFee, settings);
      
      const safeDiscount = o.discount || 0;
      const safeAdvance = o.advancePayment || 0;
      const defaultCollectionAmount = o.productPrice + o.shippingFee - safeDiscount - safeAdvance + (o.inspectionFeePaidByCustomer ? inspectionCost : 0);
      const collectionAmount = o.totalAmountOverride !== undefined ? o.totalAmountOverride : defaultCollectionAmount;
      const extraAdjustment = o.totalAmountOverride !== undefined ? o.totalAmountOverride - defaultCollectionAmount : 0;
      
      const netProfit = o.productPrice - safeDiscount - o.productCost - insuranceFee - inspectionAdjustment - cod - bostaVat + extraAdjustment;
      
      if (!dailyMap[dateStr]) {
        // Human readable date name
        let formattedLabel = dateStr;
        try {
          formattedLabel = new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
        } catch (_) {}
        dailyMap[dateStr] = { dateStr, label: formattedLabel, gross: 0, net: 0, count: 0 };
      }
      
      dailyMap[dateStr].gross += collectionAmount;
      dailyMap[dateStr].net += netProfit;
      dailyMap[dateStr].count += 1;
    });
    
    return Object.values(dailyMap)
      .sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime())
      .slice(-10); // Show last 10 active days for visual aesthetics
  }, [collectedOrders, settings]);

  const showBreakdown = (order: Order) => {
    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
    const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
    
    const safeDiscount = order.discount || 0;
    const safeAdvance = order.advancePayment || 0;
    const defaultCollectionAmount = order.productPrice + order.shippingFee - safeDiscount - safeAdvance + (order.inspectionFeePaidByCustomer ? inspectionCost : 0);
    const collectionAmount = order.totalAmountOverride !== undefined ? order.totalAmountOverride : defaultCollectionAmount;
    const extraAdjustment = order.totalAmountOverride !== undefined ? order.totalAmountOverride - defaultCollectionAmount : 0;

    const codFee = calculateCodFee(order);
    const insuranceFee = calculateInsuranceFee(order, insuranceRate, settings);
    const inspectionAdjustment = order.inspectionFeePaidByCustomer ? 0 : inspectionCost;
    const bostaVat = calculateBostaVat(order, insuranceFee, settings);
    const net = order.productPrice - safeDiscount - order.productCost - insuranceFee - inspectionAdjustment - codFee - bostaVat + extraAdjustment;

    setSelectedBreakdown({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      shippingCompany: order.shippingCompany,
      shippingArea: order.shippingArea || 'غير محدد',
      productPrice: order.productPrice,
      productCost: order.productCost,
      shippingFee: order.shippingFee,
      discount: safeDiscount,
      advancePayment: safeAdvance,
      extraAdjustment: extraAdjustment,
      totalAmount: collectionAmount,
      insuranceFee: insuranceFee + bostaVat,
      inspectionCost,
      inspectionPaid: order.inspectionFeePaidByCustomer,
      codFee,
      net,
      items: order.items || [],
      date: order.date,
      bostaVat: bostaVat,
      insuranceOnlyFee: insuranceFee
    });
  };

  const handlePrintReport = () => {
    const storeName = activeStore?.name || 'متجري';
    const html = generateCollectionsReportHTML(collectedOrders, settings, storeName);
    printHTMLDirectly(html);
  };

  const handleExportCSV = () => {
    // Generate CSV contents
    const headers = ["رقم الأوردر", "اسم العميل", "شركة الشحن", "المبلغ المحصل", "تكلفة السلع", "الخصم", "التأمين والضريبة", "عمولة COD", "صافي الربح", "التاريخ"];
    const rows = collectedOrders.map(o => {
      const cod = calculateCodFee(o);
      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
      const insuranceFee = calculateInsuranceFee(o, insuranceRate, settings);
      const inspectionAdjustment = o.inspectionFeePaidByCustomer ? 0 : inspectionCost;
      const bostaVat = calculateBostaVat(o, insuranceFee, settings);
      
      const safeDiscount = o.discount || 0;
      const safeAdvance = o.advancePayment || 0;
      const defaultCollectionAmount = o.productPrice + o.shippingFee - safeDiscount - safeAdvance + (o.inspectionFeePaidByCustomer ? inspectionCost : 0);
      const collectionAmount = o.totalAmountOverride !== undefined ? o.totalAmountOverride : defaultCollectionAmount;
      const extraAdjustment = o.totalAmountOverride !== undefined ? o.totalAmountOverride - defaultCollectionAmount : 0;
      
      const netProfit = o.productPrice - safeDiscount - o.productCost - insuranceFee - inspectionAdjustment - cod - bostaVat + extraAdjustment;
      
      return [
        o.orderNumber,
        o.customerName,
        o.shippingCompany || '',
        collectionAmount,
        o.productCost || 0,
        safeDiscount,
        insuranceFee + bostaVat + inspectionAdjustment,
        cod,
        netProfit,
        o.date ? o.date.split('T')[0] : ''
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `تقرير_تحصيلات_الأوردرات_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedCompany('all');
    setDateRange('all');
    setStartDate('');
    setEndDate('');
    setSelectedProfitBracket('all');
  };

  return (
    <div className="space-y-8 pb-12 px-4 sm:px-8 font-sans" dir="rtl">
      {/* Upper Title Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">مكتب التقارير والتدفق المالي</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <Coins size={36} className="text-emerald-500"/>
            سجل التحصيلات التفصيلي والتقارير المالية
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm font-medium">
            تتبع مالي احترافي لكافة الأوردرات المسلّمة وتحصيلات شركات الشحن مع التفصيل الصافي للهامش والأرباح
          </p>
        </div>

        {/* Rapid Print & Export Trigger Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={resetAllFilters}
            className="flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            title="إعادة تعيين كافة الفلاتر"
          >
            <RefreshCw size={14} />
            <span>إعادة تعيين</span>
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={collectedOrders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50 rounded-xl font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            <span>تصدير Excel / CSV</span>
          </button>

          <button
            onClick={handlePrintReport}
            disabled={collectedOrders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={14} />
            <span>طباعة التقرير الشامل</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Bento bar */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest pb-3 border-b border-slate-200/50 dark:border-slate-800/80">
          <Filter size={14} className="text-indigo-500"/>
          <span>خيارات البحث والتصفية المتطورة</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-3.5">
          {/* Text Search */}
          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">البحث النصي</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="رقم الأوردر، تليفون أو اسم العميل..." 
                className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 dark:text-white" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>

          {/* Shipping Company */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">شركة الشحن</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 dark:text-white"
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
            >
              <option value="all">كل الشركات ({shippingCompanies.length})</option>
              {shippingCompanies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Profit Bracket */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">ربحية الطلبات</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 dark:text-white"
              value={selectedProfitBracket}
              onChange={e => setSelectedProfitBracket(e.target.value as any)}
            >
              <option value="all">كل الأوردرات</option>
              <option value="profitable">أوردرات رابحة ذات عائد إيجابي 👍</option>
              <option value="non_profitable">أوردرات بهامش صفر أو سالب ⏸️</option>
            </select>
          </div>

          {/* Date Range Preset */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">الفترة الزمنية</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 dark:text-white"
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
            >
              <option value="all">كل التواريخ</option>
              <option value="today">اليوم</option>
              <option value="yesterday">أمس</option>
              <option value="7days">آخر 7 أيام</option>
              <option value="30days">آخر 30 يومًا</option>
              <option value="this_month">هذا الشهر الحالي</option>
            </select>
          </div>

          {/* Custom Date from */}
          <div className="lg:col-span-1.5 md:col-span-1">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">من تاريخ</label>
            <input 
              type="date"
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 dark:text-white"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* Custom Date to */}
          <div className="lg:col-span-1.5 md:col-span-1">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase">إلى تاريخ</label>
            <input 
              type="date"
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 dark:text-white"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Upgraded Multi-Card Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Collection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between transition-all hover:shadow-md hover:scale-[1.01] hover:border-emerald-300 dark:hover:border-emerald-800 duration-200">
          <div className="flex justify-between items-start">
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">إجمالي المحصل الفعلي (السيولة)</span>
              <p className="text-2xl font-black text-slate-800 dark:text-white">{(stats.totalGross).toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-400">ج.م</span></p>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
              <Banknote size={20} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium leading-relaxed">المجموع الإجمالي للقيم المالية المستلمة من العملاء</p>
        </div>

        {/* Direct Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between transition-all hover:shadow-md hover:scale-[1.01] hover:border-blue-300 dark:hover:border-blue-800 duration-200">
          <div className="flex justify-between items-start">
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">صافي الأرباح الصافية</span>
              <p className={`text-2xl font-black ${stats.totalNetProfit >= 0 ? 'text-blue-650' : 'text-rose-500'}`}>
                {(stats.totalNetProfit).toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-400">ج.م</span>
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
              {stats.netMarginPercent.toFixed(1)}% هامش صافي
            </span>
            <span className="text-[10px] text-slate-400 font-medium">بعد خصم التكلفة والشحن والرسوم</span>
          </div>
        </div>

        {/* Deductions Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between transition-all hover:shadow-md hover:scale-[1.01] hover:border-rose-200 dark:hover:border-rose-950 duration-200">
          <div className="flex justify-between items-start">
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">رسوم الشحن التراكمية وCOD</span>
              <p className="text-2xl font-black text-slate-800 dark:text-white">{(stats.totalDeductions).toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-400">ج.م</span></p>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-xl border border-rose-100 dark:border-rose-900/50">
              <Coins size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] font-medium text-slate-400">
            <span>منها تأمين: {stats.totalInsuranceFees.toLocaleString()} ج.م</span>
            <span>•</span>
            <span>رسوم COD: {stats.totalCodFees.toLocaleString()} ج.م</span>
          </div>
        </div>

        {/* Performance Index */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between transition-all hover:shadow-md hover:scale-[1.01] hover:border-purple-200 dark:hover:border-purple-950 duration-200">
          <div className="flex justify-between items-start">
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">عائد الاستثمار لسلع التحصيل (ROI)</span>
              <p className={`text-2xl font-black ${stats.directROI >= 40 ? 'text-purple-600' : 'text-slate-700 dark:text-slate-300'}`}>{stats.directROI.toFixed(1)}% <span className="text-xs">عائد</span></p>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl border border-purple-100 dark:border-purple-900/50">
              <Percent size={20} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium leading-relaxed">
            مؤشر ربحية السلع المسلّمة مقابل تكلفة شرائها الأصلية ({stats.totalCOGS.toLocaleString()} ج.م)
          </p>
        </div>
      </div>

      {/* Upgraded Trend Charts and Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (Gross vs Net) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-base">منحنى التدفق المالي والأرباح الصافية اليومية</h3>
              <p className="text-slate-400 text-xs mt-0.5">مقارنة حركة التحصيل النقدي والربح الفعلي لآخر 10 أيام نشطة</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black">
              <span className="flex items-center gap-1 text-emerald-500"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> إجمالي المحصل</span>
              <span className="flex items-center gap-1 text-blue-500"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> صافي الأرباح</span>
            </div>
          </div>

          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-150 rounded-2xl">
                <Calendar size={36} className="mb-2 opacity-50"/>
                <span className="text-xs font-bold">لا تتوفر حركات كافية لرسم المنحنى البياني حالياً</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="label" className="text-[10px] fill-slate-400 font-bold" tickLine={false} axisLine={false} />
                  <YAxis className="text-[10px] fill-slate-400 font-bold" tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ textAlign: 'right', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [`${Number(value).toLocaleString()} ج.م`, '']}
                  />
                  <Area type="monotone" dataKey="gross" name="gross" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#grossGradient)" />
                  <Area type="monotone" dataKey="net" name="net" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#netGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Shipping Company Revenue Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white text-base">توزيع سيولة التحصيل حسب قنوات الشحن</h3>
            <p className="text-slate-400 text-xs mt-0.5">مؤشر كفاءة شركات الشحن ونسب المبالغ المحصلة المودعة</p>
          </div>

          <div className="space-y-4 my-6">
            {shippingCompanies.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold italic text-center py-8">لم يتم رصد قنوات شحن نشطة</p>
            ) : (
              shippingCompanies.map(comp => {
                const compOrders = collectedOrders.filter(o => o.shippingCompany === comp);
                const compCollected = compOrders.reduce((sum, o) => {
                  const compFees = settings.companySpecificFees?.[o.shippingCompany];
                  const useCustom = compFees?.useCustomFees ?? false;
                  const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
                  const safeDiscount = o.discount || 0;
                  const safeAdvance = o.advancePayment || 0;
                  const defaultAmount = o.productPrice + o.shippingFee - safeDiscount - safeAdvance + (o.inspectionFeePaidByCustomer ? inspectionCost : 0);
                  return sum + (o.totalAmountOverride !== undefined ? o.totalAmountOverride : defaultAmount);
                }, 0);
                const pct = stats.totalGross > 0 ? (compCollected / stats.totalGross) * 100 : 0;

                return (
                  <div key={comp} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Truck size={14} className="text-slate-400" />
                        {comp}
                      </span>
                      <span className="font-bold text-slate-500">
                        {compCollected.toLocaleString()} ج.م ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full" 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">دليل الحساب والخصومات</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              يتم رصد رسوم الشحن وقيمة التأمين مباشرة خصماً في صافي الربح المستقر. عمولة التحصيل عند الاستلام (COD) تخصم بالكامل.
            </p>
          </div>
        </div>
      </div>

      {/* Main Collection Ledger Detail Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-150 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black dark:text-white text-right">سجل التحصيلات المالي التفصيلي</h3>
              <p className="text-xs text-slate-400 mt-0.5">قائمة تفصيلية حركية لكافة أوردرات التحصيل التي خضعت للتسليم الناجح للفترة المحددة</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto text-xs text-slate-400 font-bold">
            <span>تم استعراض عدد </span>
            <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded-lg font-black">{collectedOrders.length}</span>
            <span>أوردرات محصّلة</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-850/50 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4.5">رقم البوليصة</th>
                <th className="px-6 py-4.5">قناة الشحن والعميل</th>
                <th className="px-6 py-4.5">المبلغ الخاضع للتحصيل</th>
                <th className="px-6 py-4.5">تكلفة المشتريات (COGS)</th>
                <th className="px-6 py-4.5">رسوم الشحن والـ COD</th>
                <th className="px-6 py-4.5 text-center">الإنتاجية (الصافي)</th>
                <th className="px-6 py-4.5">الرابط المالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {collectedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center">
                      <HelpCircle size={44} className="text-slate-350 dark:text-slate-600 mb-3" />
                      <p className="text-sm font-black text-slate-700 dark:text-slate-305">لا توجد عمليات تحصيل مطابقة لمعايير البحث</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">يرجى التأكد من اختيار شركة الشحن الصحيحة أو تعديل الفترة الزمنية المستعلم عنها لمعاينة القيود.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                collectedOrders.map(order => {
                  const cod = calculateCodFee(order);
                  const compFees = settings.companySpecificFees?.[order.shippingCompany];
                  const useCustom = compFees?.useCustomFees ?? false;
                  const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
                  const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
                  const insuranceFee = calculateInsuranceFee(order, insuranceRate, settings);
                  const inspectionAdjustment = order.inspectionFeePaidByCustomer ? 0 : inspectionCost;
                  const bostaVat = calculateBostaVat(order, insuranceFee, settings);
                  
                  const safeDiscount = order.discount || 0;
                  const safeAdvance = order.advancePayment || 0;
                  const defaultCollectionAmount = order.productPrice + order.shippingFee - safeDiscount - safeAdvance + (order.inspectionFeePaidByCustomer ? inspectionCost : 0);
                  const collectionAmount = order.totalAmountOverride !== undefined ? order.totalAmountOverride : defaultCollectionAmount;
                  const extraAdjustment = order.totalAmountOverride !== undefined ? order.totalAmountOverride - defaultCollectionAmount : 0;
                  
                  const directFees = insuranceFee + bostaVat + inspectionAdjustment + cod;
                  const netProfit = order.productPrice - safeDiscount - order.productCost - insuranceFee - inspectionAdjustment - cod - bostaVat + extraAdjustment;
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{order.orderNumber}</div>
                        {order.date && <div className="text-[10px] text-slate-400 mt-0.5">{order.date.split('T')[0]}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black dark:text-white text-sm">{order.customerName}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium">
                          <Truck size={11} className="text-slate-400" />
                          <span>{order.shippingCompany}</span>
                          <span>•</span>
                          <MapPin size={11} className="text-slate-400" />
                          <span>{order.shippingArea}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-slate-800 dark:text-slate-200">{collectionAmount.toLocaleString()} ج.م</span>
                        {extraAdjustment !== 0 && (
                          <span className={`block text-[9px] font-bold ${extraAdjustment > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {extraAdjustment > 0 ? 'تعديل إضافي +' : 'خصم يدوي '}{extraAdjustment.toLocaleString()}ج
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">
                        {(order.productCost || 0).toLocaleString()} ج.م
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-700 dark:text-slate-300">{directFees.toLocaleString()} ج.م</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 flex gap-1.5">
                          {cod > 0 && <span>COD: {cod}ج</span>}
                          {insuranceFee > 0 && <span>تأمين/ضريبة: { (insuranceFee + bostaVat).toFixed(0) }ج</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-sm font-extrabold ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-505 dark:text-rose-400'}`}>
                            {netProfit.toLocaleString()} ج.م
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded mt-1 font-black ${netProfit >= 0 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/10' : 'bg-red-50 text-red-600'}`}>
                            {order.productCost > 0 ? `${((netProfit / order.productCost) * 100).toFixed(0)}% عائد` : 'هبة'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => showBreakdown(order)} 
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-lg transition-all text-xs font-bold"
                        >
                          <Info size={14} />
                          <span>تفصيل الربح</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPGRADED: Order Items & Financial breakdown Modal */}
      {selectedBreakdown && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800 text-right flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850/50">
               <div className="flex items-center gap-2">
                 <Receipt className="text-emerald-500" size={24} />
                 <div>
                   <h3 className="font-black text-slate-800 dark:text-white text-base">
                     الحسبة المالية المفصلة للأوردر #{selectedBreakdown.orderNumber}
                   </h3>
                   <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                     العميل: {selectedBreakdown.customerName} • شركة {selectedBreakdown.shippingCompany}
                   </p>
                 </div>
               </div>
               <button 
                 onClick={() => setSelectedBreakdown(null)} 
                 className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-all"
               >
                 <X size={20}/>
               </button>
            </div>

            {/* Modal Scrollable Contents */}
            <div className="p-6 overflow-y-auto space-y-6">
               
               {/* Section 1: Included Items detail List */}
               <div className="space-y-3">
                 <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                   <Package size={14} className="text-slate-400" />
                   <span>أصناف وسلع شحنة المعاملة الخاضعة للتسليم</span>
                 </h4>

                 <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                   {selectedBreakdown.items && selectedBreakdown.items.length > 0 ? (
                     selectedBreakdown.items.map((item, idx) => {
                       const itemContribution = item.price - (item.cost || 0);
                       const marginPct = item.price > 0 ? (itemContribution / item.price) * 100 : 0;
                       
                       return (
                         <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                           <div className="flex items-center gap-3">
                             {item.thumbnail ? (
                               <img 
                                 src={item.thumbnail} 
                                 alt={item.name} 
                                 className="w-10 h-10 object-cover rounded-xl border border-slate-200"
                                 referrerPolicy="no-referrer"
                               />
                             ) : (
                               <div className="w-10 h-10 bg-slate-100 dark:bg-slate-850 text-slate-400 rounded-xl flex items-center justify-center font-bold text-xs">
                                 سلعة
                               </div>
                             )}
                             <div>
                               <p className="font-bold text-xs dark:text-white max-w-xs truncate">{item.name}</p>
                               <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                 <span>الكمية: {item.quantity}</span>
                                 <span>•</span>
                                 <span>السعر الفردي: {item.price} ج.م</span>
                                 {item.variantDescription && (
                                   <>
                                     <span>•</span>
                                     <span className="text-indigo-500 font-bold">{item.variantDescription}</span>
                                   </>
                                 )}
                               </div>
                             </div>
                           </div>

                           <div className="text-left">
                             <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                               {(item.price * item.quantity).toLocaleString()} ج.م
                             </div>
                             <div className="text-[9px] text-emerald-500 font-bold">
                               هامش: {itemContribution > 0 ? `+${itemContribution.toLocaleString()}ج (${marginPct.toFixed(0)}%)` : 'لا يوجد'}
                             </div>
                           </div>
                         </div>
                       );
                     })
                   ) : (
                     <p className="text-xs text-slate-400 italic text-center py-4">لم يتم رصد بيانات تفصيلية لسلع هذا الأوردر</p>
                   )}
                 </div>
               </div>

               {/* Section 2: Detailed Deductions Calculations & Steps */}
               <div className="space-y-3">
                 <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                   <Coins size={14} className="text-slate-400" />
                   <span>الدخل، التكاليف، رسوم الشاحن والضريبة</span>
                 </h4>

                 <div className="grid grid-cols-2 gap-4">
                   {/* Col Left: Revenues */}
                   <div className="space-y-2 bg-emerald-50/30 dark:bg-emerald-950/10 p-4.5 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30">
                     <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-2">الإيراد المجموع (+)</span>
                     
                     <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-350">
                       <span>قيمة المنتجات:</span>
                       <span>+{selectedBreakdown.productPrice.toLocaleString()} ج.م</span>
                     </div>
                     <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-350">
                       <span>مصاريف الشحن:</span>
                       <span>+{selectedBreakdown.shippingFee.toLocaleString()} ج.م</span>
                     </div>
                     {selectedBreakdown.extraAdjustment > 0 && (
                       <div className="flex justify-between text-xs font-bold text-emerald-500">
                         <span>تعديل إيجابي يدوي:</span>
                         <span>+{selectedBreakdown.extraAdjustment.toLocaleString()} ج.م</span>
                       </div>
                     )}
                     <div className="border-t border-emerald-200/50 dark:border-emerald-900/30 my-2"></div>
                     <div className="flex justify-between text-xs font-black text-emerald-600 dark:text-emerald-400">
                       <span>التحصيل الكلي:</span>
                       <span>{selectedBreakdown.totalAmount.toLocaleString()} ج.م</span>
                     </div>
                   </div>

                   {/* Col Right: Costs & Deductions */}
                   <div className="space-y-2 bg-rose-50/20 dark:bg-rose-950/10 p-4.5 rounded-2xl border border-rose-100/50 dark:border-rose-900/20">
                     <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider block mb-2">التكاليف والخصومات (-)</span>
                     
                     <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-350">
                       <span>تكلفة المشتريات (COGS):</span>
                       <span className="text-rose-500">-{selectedBreakdown.productCost.toLocaleString()} ج.م</span>
                     </div>
                     {selectedBreakdown.discount > 0 && (
                       <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-350">
                         <span>خصم العميل:</span>
                         <span className="text-rose-505">-{selectedBreakdown.discount.toLocaleString()} ج.م</span>
                       </div>
                     )}
                     <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-350">
                       <span>تأمين الشحنة {selectedBreakdown.bostaVat && selectedBreakdown.bostaVat > 0 ? "والضريبة (+ ضريبة بوسطة 14%)" : "والضريبة"}:</span>
                       <span className="text-rose-500">-{selectedBreakdown.insuranceOnlyFee !== undefined && selectedBreakdown.insuranceOnlyFee > 0 ? `${selectedBreakdown.insuranceOnlyFee.toLocaleString()} ج.م${selectedBreakdown.bostaVat && selectedBreakdown.bostaVat > 0 ? ` + ${selectedBreakdown.bostaVat.toLocaleString()} ج.م ضريبة بوسطة 14%` : ''}` : selectedBreakdown.insuranceFee.toLocaleString() + ' ج.م'}</span>
                     </div>
                     <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-350">
                       <span>رسوم COD:</span>
                       <span className="text-rose-500">-{selectedBreakdown.codFee.toLocaleString()} ج.م</span>
                     </div>
                     {selectedBreakdown.extraAdjustment < 0 && (
                       <div className="flex justify-between text-xs font-bold text-rose-500">
                         <span>تعديل تنازلي يدوي:</span>
                         <span>{selectedBreakdown.extraAdjustment.toLocaleString()} ج.م</span>
                       </div>
                     )}
                     {selectedBreakdown.inspectionCost > 0 && !selectedBreakdown.inspectionPaid && (
                       <div className="flex justify-between text-xs font-bold text-slate-600">
                         <span>رسوم معاينة بوسطة:</span>
                         <span className="text-rose-500">-{selectedBreakdown.inspectionCost} ج.م</span>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
            </div>

            {/* Footer containing the massive Profit highlight banner */}
            <div className="p-5.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
               <div>
                  <span className="text-[10px] font-black text-slate-400 block uppercase mb-0.5">مؤشر كفاءة الأوردر</span>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {selectedBreakdown.net > 0 ? "أوردر ناجح ذو ربحية فائقة" : "أوردر بهامش ربح متعادل أو خسارة"}
                    </span>
                  </div>
               </div>

               <div className="bg-indigo-650 text-white px-6 py-3 rounded-2xl flex items-center gap-6 shadow-lg shadow-indigo-600/15">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-black tracking-widest text-indigo-200 block">صافي الربح الصافي (Net)</span>
                    <span className="text-2xl font-black">{selectedBreakdown.net.toLocaleString()} ج.م</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionsReportPage;
