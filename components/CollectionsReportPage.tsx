import React, { useMemo, useState } from 'react';
import { Search, History, TrendingUp, Coins, ShieldCheck, Banknote, Calendar, Package, MapPin, Truck, Info, X, Receipt, Printer } from 'lucide-react';
import { Order, Settings, Store } from '../types';
import { generateCollectionsReportHTML } from '../utils/reportGenerator';
import { isBosta, calculateInsuranceFee, calculateBostaVat } from '../utils/financials';
import { printHTMLDirectly } from '../utils/printHelper';

interface CollectionsReportPageProps {
  orders: Order[];
  settings: Settings;
  activeStore?: Store;
}

interface BreakdownDetails {
  orderNumber: string;
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
}

const CollectionsReportPage: React.FC<CollectionsReportPageProps> = ({ orders, settings, activeStore }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownDetails | null>(null);

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

  const collectedOrders = useMemo(() => {
    return orders
      .filter(o => o.status === 'تم_التحصيل')
      .filter(o => 
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, searchTerm]);

  const stats = useMemo(() => {
    let totalGross = 0;
    let totalNetProfit = 0;
    let totalInsuranceFees = 0;
    let totalCodFees = 0;

    collectedOrders.forEach(o => {
      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      const inspectionCost = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
      
      const totalAmount = o.productPrice + o.shippingFee;
      const codFee = calculateCodFee(o);
      const insuranceFee = calculateInsuranceFee(o, insuranceRate, settings);
      const inspectionAdjustment = o.inspectionFeePaidByCustomer ? 0 : inspectionCost;
      const bostaVat = calculateBostaVat(o, insuranceFee, settings);
      
      const safeDiscount = o.discount || 0;
      const safeAdvance = o.advancePayment || 0;
      const defaultCollectionAmount = o.productPrice + o.shippingFee - safeDiscount - safeAdvance + (o.inspectionFeePaidByCustomer ? inspectionCost : 0);
      const collectionAmount = o.totalAmountOverride !== undefined ? o.totalAmountOverride : defaultCollectionAmount;
      const extraAdjustment = o.totalAmountOverride !== undefined ? o.totalAmountOverride - defaultCollectionAmount : 0;
      
      totalGross += collectionAmount;
      totalInsuranceFees += insuranceFee + bostaVat; // Include VAT in total insurance/tax fees if desired
      totalCodFees += codFee;
      totalNetProfit += (o.productPrice - safeDiscount - o.productCost - insuranceFee - inspectionAdjustment - codFee - bostaVat + extraAdjustment);
    });

    return { totalGross, totalNetProfit, count: collectedOrders.length, totalInsuranceFees, totalCodFees };
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
      productPrice: order.productPrice,
      productCost: order.productCost,
      shippingFee: order.shippingFee,
      discount: safeDiscount,
      advancePayment: safeAdvance,
      extraAdjustment: extraAdjustment,
      totalAmount: collectionAmount,
      insuranceFee: insuranceFee + bostaVat, // display as combined insurance/tax fee
      inspectionCost,
      inspectionPaid: order.inspectionFeePaidByCustomer,
      codFee,
      net
    });
  };

  const handlePrintReport = () => {
    const storeName = activeStore?.name || 'متجري';
    const html = generateCollectionsReportHTML(collectedOrders, settings, storeName);
    printHTMLDirectly(html);
  };


  return (
    <div className="space-y-8 pb-12 px-4 sm:px-8" dir="rtl">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">التحصيل المالي والسيولة</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <Coins size={32} className="text-indigo-500"/>
            سجل التحصيلات التفصيلي والتقارير المالية
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">متابعة دقيقة لعمليات التحصيل الناجحة لشركة الشحن، حساب رسوم الدفع عند الاستلام COD وصافي الأرباح</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="إجمالي المحصل" value={`${stats.totalGross.toLocaleString()} ج.م`} icon={<Banknote className="text-emerald-600"/>} color="emerald" />
        <StatCard title="صافي الأرباح" value={`${stats.totalNetProfit.toLocaleString()} ج.م`} icon={<TrendingUp className="text-blue-600"/>} color="blue" />
        <StatCard title="رسوم COD" value={`${stats.totalCodFees.toLocaleString()} ج.م`} icon={<Coins className="text-red-600"/>} color="red" />
        <StatCard title="أوردرات ناجحة" value={stats.count} icon={<ShieldCheck className="text-purple-600"/>} color="purple" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-lg">
              <History size={20} />
            </div>
            <h3 className="text-lg font-black dark:text-white text-right">سجل التحصيلات التفصيلي</h3>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="بحث في السجل..." 
                  className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 dark:text-white" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
            </div>
            <button
                onClick={handlePrintReport}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all"
            >
                <Printer size={16} />
                <span>طباعة</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">رقم البوليصة</th>
                <th className="px-6 py-4">العميل</th>
                <th className="px-6 py-4">المبلغ الكلي</th>
                <th className="px-6 py-4">حالة المعاينة</th>
                <th className="px-6 py-4 text-center">الربح الصافي</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {collectedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold italic">لا توجد عمليات تحصيل مسجلة</td>
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
                  
                  const netProfit = order.productPrice - safeDiscount - order.productCost - insuranceFee - inspectionAdjustment - cod - bostaVat + extraAdjustment;
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-blue-600 dark:text-blue-400">{order.orderNumber}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold dark:text-white text-sm">{order.customerName}</div>
                        <div className="text-[10px] text-slate-500">{order.shippingArea}</div>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-700 dark:text-slate-300">
                        {collectionAmount.toLocaleString()} ج.م
                      </td>
                      <td className="px-6 py-4">
                        {order.inspectionFeePaidByCustomer ? (
                          <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-black border border-emerald-200">مدفوعة</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full text-[10px] font-black border border-red-200">على الشركة</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                           <span className="text-blue-700 dark:text-blue-400 font-black">
                             {netProfit.toLocaleString()} ج.م
                           </span>
                           {cod > 0 && <span className="text-[9px] text-red-500 font-bold">خصم COD: {cod}ج</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => showBreakdown(order)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition-all">
                          <Info size={16} />
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

      {selectedBreakdown && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800 text-right">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
               <h3 className="font-black dark:text-white flex items-center gap-2">
                 <Receipt className="text-blue-600" /> تفصيل حسبة الأوردر {selectedBreakdown.orderNumber}
               </h3>
               <button onClick={() => setSelectedBreakdown(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-3">
               <div className="flex justify-between items-center text-sm font-bold pb-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">سعر البيع:</span>
                  <span className="text-emerald-500">+{selectedBreakdown.productPrice.toLocaleString()} ج.م</span>
               </div>
               {(selectedBreakdown.discount || 0) > 0 && (
                   <div className="flex justify-between items-center text-sm font-bold pb-2 border-b dark:border-slate-800">
                      <span className="text-slate-500">خصم مقدم للعميل:</span>
                      <span className="text-red-500">-{selectedBreakdown.discount.toLocaleString()} ج.م</span>
                   </div>
               )}
               <div className="flex justify-between items-center text-sm font-bold pb-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">سعر التكلفة:</span>
                  <span className="text-red-500">-{selectedBreakdown.productCost.toLocaleString()} ج.م</span>
               </div>
               {(selectedBreakdown.extraAdjustment || 0) !== 0 && (
                   <div className="flex justify-between items-center text-sm font-bold pb-2 border-b dark:border-slate-800">
                      <span className="text-slate-500">تعديل الإجمالي اليدوي:</span>
                      <span className={selectedBreakdown.extraAdjustment > 0 ? "text-emerald-500" : "text-red-500"}>
                          {selectedBreakdown.extraAdjustment > 0 ? '+' : ''}{selectedBreakdown.extraAdjustment.toLocaleString()} ج.م
                      </span>
                   </div>
               )}
               <div className="flex justify-between items-center text-sm font-bold pb-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">رسوم التأمين:</span>
                  <span className="text-red-500">-{selectedBreakdown.insuranceFee.toLocaleString()} ج.م</span>
               </div>
               <div className="flex justify-between items-center text-sm font-bold pb-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">رسوم المعاينة:</span>
                  <span className={selectedBreakdown.inspectionPaid ? "text-slate-400 italic" : "text-red-500"}>
                    {selectedBreakdown.inspectionPaid ? "مدفوعة من العميل (0)" : `-${selectedBreakdown.inspectionCost} ج.م`}
                  </span>
               </div>
               <div className="flex justify-between items-center text-sm font-bold pb-2 border-b dark:border-slate-800">
                  <span className="text-slate-500">رسوم تحصيل COD:</span>
                  <span className="text-red-500">-{selectedBreakdown.codFee.toLocaleString()} ج.م</span>
               </div>
               <div className="bg-blue-600 p-4 rounded-xl text-white flex justify-between items-center mt-4">
                  <span className="font-black uppercase tracking-widest text-xs">صافي الربح النهائي</span>
                  <span className="text-2xl font-black">{selectedBreakdown.net.toLocaleString()} ج.م</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-100 dark:border-emerald-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-100 dark:border-amber-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-purple-100 dark:border-purple-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-100 dark:border-red-800'
  };

  return (
    <div className={`p-5 rounded-2xl border ${colors[color]} bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-2 transition-transform hover:scale-[1.02]`}>
      <div className="flex items-center justify-between text-right">
        <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{title}</span>
        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-inherit">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-black text-right">{value}</div>
    </div>
  );
};

export default CollectionsReportPage;
