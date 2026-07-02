import React, { useState } from 'react';
import { 
  X, Copy, MapPin, Phone, User as UserIcon, Package, AlertCircle, 
  Wallet, Plus, CheckCircle2, Clock, Truck, ShieldAlert, ArrowRightLeft, 
  FileText, DollarSign, Calculator, ChevronRight, Share2, Printer, 
  ExternalLink, Sparkles, History, Check, AlertTriangle, HelpCircle,
  TrendingUp, TrendingDown, Layers, FileSearch, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { Order, Settings } from '../types';
import { ORDER_STATUS_METADATA } from '../constants';
import { 
  calculateCodFee, calculateInsuranceFee, calculateBostaVat, 
  isBosta, calculateOrderProfitLoss 
} from '../utils/financials';
import { generateInvoiceHTML } from '../utils/invoiceGenerator';

interface OrderDetailsModalProps {
  order: Order;
  settings: Settings;
  allOrders?: Order[];
  onClose: () => void;
  onAddTransaction?: (type: 'إيداع' | 'سحب', amount: number, note: string, category: any) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  settings, 
  allOrders = [], 
  onClose,
  onAddTransaction
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'financials' | 'tracking'>('details');
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!settings) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const { profit, loss, carrierFees, productCost: safeProductCost, netRevenue } = calculateOrderProfitLoss(order, settings);

  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  const safeAdminFee = Number(order.adminFee) || 0;
  
  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const insuranceFee = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
  const inspectionAdjustment = !isPosOrder && (order.includeInspectionFee ?? true) ? (order.inspectionFeePaidByCustomer ? 0 : (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0))) : 0;
  const bostaVatFee = calculateBostaVat(order, insuranceFee, settings);
  const codFee = calculateCodFee(order, settings);
  const currentVatRate = useCustom ? (compFees?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0)) : (settings?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0));
  
  const totalCarrierFees = carrierFees;
  
  const safeCredit = Number(order.creditAmount) || 0;
  const safeReturnCash = (order.returnCashToCustomer && order.cashToReturnAmount) ? Number(order.cashToReturnAmount) : 0;
  const computedTotal = Math.max(0, safeProductPrice + safeShippingFee + safeAdminFee - safeDiscount - safeAdvance - safeCredit - safeReturnCash + (order.inspectionFeePaidByCustomer ? inspectionAdjustment : 0));
  const totalAmountToCollect = order.totalAmountOverride != null 
    ? Math.max(0, Math.round(Number(order.totalAmountOverride))) 
    : computedTotal;
  
  const flexFeeValue = order.flexShipFee !== undefined 
    ? order.flexShipFee 
    : (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0));
  const flexCompanyFeeValue = order.flexShipCompanyFee !== undefined
    ? order.flexShipCompanyFee
    : (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0));
  const isFlexShipEnabled = order.enableFlexShip !== undefined ? order.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false));
  const flexPaidAmount = isFlexShipEnabled && order.flexShipFeePaidByCustomer ? (order.flexShipFee || flexFeeValue) : 0;
  const flexCompanyFeePaid = isFlexShipEnabled && order.flexShipFeePaidByCustomer ? (order.flexShipCompanyFee ?? flexCompanyFeeValue) : 0;

  const isReturnedOrFailed = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن'].includes(order.status);
  const applyReturnFee = isPosOrder ? false : (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
  const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
  const standardShippingFee = safeShippingFee;

  // Success rate calculations
  let customerSuccessRate = -1;
  let customerCompleted = 0;
  let customerTotal = 0;
  if (allOrders && allOrders.length > 0 && order.customerPhone) {
    const customerOrders = allOrders.filter(o => o.customerPhone === order.customerPhone);
    if (customerOrders.length > 0) {
        const successful = customerOrders.filter(o => ['تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(o.status)).length;
        customerSuccessRate = (successful / customerOrders.length) * 100;
        customerCompleted = successful;
        customerTotal = customerOrders.length;
    }
  }

  const successRateText = customerSuccessRate === -1 ? '' : (customerSuccessRate < 40 ? 'عميل نسبة استلامه منخفضة' : (customerSuccessRate > 80 ? 'عميل نشط وموثوق جداً' : 'نسبة استلام متوسطة'));
  const successRateColor = customerSuccessRate === -1 ? '' : (customerSuccessRate < 40 ? 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800' : (customerSuccessRate > 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'));

  // Wallet logic calculations
  const isWalletSettled = order.paymentStatus === 'مدفوع';
  const isOrderCollected = ['تم_التحصيل', 'مدفوعة'].includes(order.status);
  const isOrderDelivered = ['تم_التوصيل', 'تم_توصيلها'].includes(order.status);
  const isOrderFailedOrReturned = ['مرتجع', 'فشل_التوصيل', 'مرتجع_جزئي', 'ملغي', 'مؤرشف', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'].includes(order.status);

  let walletMessage = '';
  let walletStatusStyle = '';

  if (isWalletSettled) {
      walletMessage = 'تمت تسوية المستحقات وتحويلها بنجاح إلى حسابك ضمن الدورة المالية.';
      walletStatusStyle = 'emerald';
  } else if (isOrderCollected) {
      walletMessage = 'تم التحصيل من العميل. المبلغ متوفر بمحفظتك وقيد الانتظار لدورة السحب النقدي القادمة.';
      walletStatusStyle = 'indigo';
  } else if (isOrderDelivered) {
      walletMessage = 'تم تسليم الأوردر للعميل بنجاح. سيتم تحديث محفظتك وإضافة الرصيد فور إتمام تسوية التحصيل من شركة الشحن.';
      walletStatusStyle = 'teal';
  } else if (isOrderFailedOrReturned) {
      walletMessage = 'لم يكتمل الأوردر بسبب المرتجع. تم تسوية المصروفات وخسائر بوليصة الشحن من المديونية العامّة.';
      walletStatusStyle = 'rose';
  } else {
      walletMessage = 'سيتم تحديث محفظتك وإضافة الرصيد المتاح مباشرة فور إتمام توصيل الأوردر وتحصيله.';
      walletStatusStyle = 'slate';
  }
  
  const orderWarehouseName = order.warehouseId && settings.warehouses ? settings.warehouses.find(w => w.id === order.warehouseId)?.name : (settings.warehouses?.[0]?.name || 'الفرع الرئيسي');

  let building = '-', floor = '-', flat = '-', landmark = '-';
  if (order.shippingArea) {
      const bMatch = order.shippingArea.match(/مبنى\s*([\d\w]+)/);
      if (bMatch) building = bMatch[1];
      const fMatch = order.shippingArea.match(/دور\s*([\d\w]+)/);
      if (fMatch) floor = fMatch[1];
      const flMatch = order.shippingArea.match(/شقة\s*([\d\w]+)/);
      if (flMatch) flat = flMatch[1];
      const lMatch = order.shippingArea.match(/علامة مميزة\s*([^\-،]+)/);
      if (lMatch) landmark = lMatch[1].trim();
  }

  const autoWithdrawalEnabled = settings?.wallet?.autoWithdrawal || false;
  const withdrawDaysCount = settings?.wallet?.autoWithdrawalDays?.length || 0;
  const cycleText = autoWithdrawalEnabled ? (withdrawDaysCount > 0 ? `${withdrawDaysCount} أيام بالأسبوع` : 'سحب تلقائي مفعل') : 'سحب عند الطلب';

  const handlePrintSummary = () => {
    try {
        const html = generateInvoiceHTML(order, settings, 'متجري');
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.onload = () => {
                win.print();
            };
        }
    } catch (err) {
        console.error("Error printing invoice:", err);
    }
  };

  const statusInfo = ORDER_STATUS_METADATA[order.status] || { label: order.status.replace(/_/g, ' '), color: 'bg-slate-500 text-white', icon: 'Package' };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0b0f19] w-full max-w-6xl h-[92vh] flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200/80 dark:border-white/10">
        
        {/* Executive Header Section */}
        <div className="bg-slate-50/80 dark:bg-[#0f1523]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 p-5 sm:p-6 flex flex-col gap-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-2xl transition-all shadow-sm border border-slate-200/60 dark:border-white/5 active:scale-95"
                title="إغلاق النافذة"
              >
                <X size={20} />
              </button>
              <button 
                onClick={handlePrintSummary} 
                className="flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-slate-200/80 dark:border-white/10 rounded-2xl font-black text-slate-700 dark:text-slate-200 text-xs sm:text-sm transition-all shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/40 active:scale-95"
              >
                <Printer size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span>طباعة الفاتورة والملخص</span>
              </button>
            </div>
            
            <div className="text-right">
              <div className="flex items-center justify-end gap-3 mb-1.5 flex-wrap">
                <span className={`px-3 py-1 rounded-xl text-xs font-black shadow-xs border ${
                  order.paymentStatus === 'مدفوع' 
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400' 
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400'
                }`}>
                  {order.paymentStatus === 'مدفوع' ? '✓ مدفوع ومسوى' : '⏳ بانتظار السداد'}
                </span>
                <span className={`px-3.5 py-1 rounded-xl text-xs font-black shadow-xs ${statusInfo.color.split(' ')[0]} bg-opacity-15 text-slate-800 dark:text-white border border-current/20 flex items-center gap-1.5`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                  {statusInfo.label}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  طلب #{order.orderNumber || order.id.slice(0, 8)}
                </h2>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-end gap-2">
                <span>تاريخ الإنشاء: {new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(order.date))}</span>
                {order.assignedToName && (
                  <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                    بواسطة: {order.assignedToName}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Upgraded Navigation Tabs */}
          <div className="flex justify-end gap-2 sm:gap-3 border-t border-slate-200/60 dark:border-white/10 pt-4 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('tracking')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all duration-200 whitespace-nowrap ${
                activeTab === 'tracking' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]' 
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-white/5'
              }`}
            >
              <History size={16} />
              <span>تتبع الحالات وسجل التدقيق</span>
              {order.auditLogs && order.auditLogs.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'tracking' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {order.auditLogs.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('financials')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all duration-200 whitespace-nowrap ${
                activeTab === 'financials' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 scale-[1.02]' 
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-white/5'
              }`}
            >
              <Calculator size={16} />
              <span>معادلة الربح والخسارة المفصلة</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'financials' 
                  ? 'bg-white/20 text-white' 
                  : profit >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                {profit >= 0 ? `+${profit.toFixed(0)}` : `${profit.toFixed(0)}`} ج.م
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all duration-200 whitespace-nowrap ${
                activeTab === 'details' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]' 
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-white/5'
              }`}
            >
              <FileText size={16} />
              <span>بيانات العميل والشحنة</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar bg-slate-50/50 dark:bg-[#070a12]/50">
          
          {/* TAB 1: DETAILS (بيانات العميل والشحنة) */}
          {activeTab === 'details' && (
            <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Right Column: Customer & Items */}
              <div className="flex-1 space-y-6 lg:order-2">
                
                {/* Quick Communication Card */}
                <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a 
                      href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً أستاذ ${order.customerName}، بخصوص طلبك رقم #${order.orderNumber || order.id.slice(0,6)} من متجرنا...`)}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      <Share2 size={14} />
                      <span>مراسلة واتساب مباشر</span>
                    </a>
                    <a 
                      href={`tel:${order.customerPhone}`}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-black text-xs rounded-xl border border-indigo-200/50 dark:border-indigo-500/20 transition-all active:scale-95"
                    >
                      <Phone size={14} />
                      <span>اتصال هاتفي</span>
                    </a>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">حالة التواصل</span>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">محاولات التوصيل:</span>
                      <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 font-black text-xs rounded-lg text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                        {order.callAttempts?.length || 1} من أصل 3 محاولات
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Details Card */}
                <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-sm">
                  <div className="bg-slate-50/80 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200/80 dark:border-white/10 flex justify-between items-center flex-row-reverse">
                    <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
                      <UserIcon size={18} className="text-indigo-500" />
                      <span>بيانات العميل والعنوان</span>
                    </h3>
                    {customerSuccessRate !== -1 && (
                      <span className={`px-3 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${successRateColor}`}>
                        <ShieldAlert size={14} />
                        <span>{successRateText} ({Math.round(customerSuccessRate)}%)</span>
                      </span>
                    )}
                  </div>
                  <div className="p-6 space-y-6 text-right">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-100 dark:border-white/5 pb-6">
                      <div>
                        <span className="text-xs font-black text-slate-400 block mb-1.5">الاسم الكامل</span>
                        <p className="text-base font-black text-slate-900 dark:text-white">{order.customerName}</p>
                        {customerCompleted > 0 && (
                          <p className="text-[11px] font-bold text-slate-500 mt-1">سجل سابق: استلم {customerCompleted} من أصل {customerTotal} طلبات</p>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-400 block mb-1.5">رقم الهاتف</span>
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleCopy(order.customerPhone, 'phone')} 
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                            title="نسخ الرقم"
                          >
                            {copiedField === 'phone' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                          <p className="text-base font-black text-slate-900 dark:text-white tracking-wider" dir="ltr">{order.customerPhone}</p>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-slate-100 dark:border-white/5 pb-6">
                      <span className="text-xs font-black text-slate-400 block mb-1.5 flex items-center justify-end gap-1.5">
                        <span>العنوان ومكان التوصيل</span>
                        <MapPin size={14} className="text-indigo-500" />
                      </span>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        {order.shippingArea || '---'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-black text-slate-400 block mb-3">تفاصيل العنوان الفرعية</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-black">
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-white/5 text-center">
                          <span className="text-[10px] text-slate-400 block mb-1">المبنى / العمارة</span>
                          <span className="text-slate-800 dark:text-white">{building}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-white/5 text-center">
                          <span className="text-[10px] text-slate-400 block mb-1">الدور / الطابق</span>
                          <span className="text-slate-800 dark:text-white">{floor}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-white/5 text-center">
                          <span className="text-[10px] text-slate-400 block mb-1">رقم الشقة</span>
                          <span className="text-slate-800 dark:text-white">{flat}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-white/5 text-center">
                          <span className="text-[10px] text-slate-400 block mb-1">علامة مميزة</span>
                          <span className="text-slate-800 dark:text-white line-clamp-1">{landmark}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Products Table Card */}
                <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-sm">
                  <div className="bg-slate-50/80 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200/80 dark:border-white/10 flex justify-between items-center flex-row-reverse">
                    <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
                      <Package size={18} className="text-indigo-500" />
                      <span>قائمة المنتجات والتكاليف ({(order.items || []).length})</span>
                    </h3>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-xl">
                      إجمالي الكمية: {(order.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0)} قطع
                    </span>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 font-black text-xs border-b border-slate-200/60 dark:border-white/5">
                        <tr>
                          <th className="py-3.5 px-6 font-black">الإجمالي</th>
                          <th className="py-3.5 px-6 font-black">سعر الوحدة</th>
                          <th className="py-3.5 px-6 font-black">الكمية</th>
                          <th className="py-3.5 px-6 font-black">المنتج والوصف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {order.items?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 px-6 font-black text-indigo-600 dark:text-indigo-400">
                              {((item.price || 0) * (item.quantity || 1)).toLocaleString()} <span className="text-[10px] font-normal">ج.م</span>
                            </td>
                            <td className="py-4 px-6 font-bold text-slate-700 dark:text-slate-300">
                              {(item.price || 0).toLocaleString()} <span className="text-[10px] font-normal">ج.م</span>
                            </td>
                            <td className="py-4 px-6 font-black text-slate-900 dark:text-white">
                              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">{item.quantity || 1}</span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-end gap-3.5">
                                <div className="text-right">
                                  <span className="font-black text-slate-900 dark:text-white block">{item.name}</span>
                                  {(item.variantDescription || item.description) && <span className="text-[10px] text-slate-400 font-normal block">{item.variantDescription || item.description}</span>}
                                </div>
                                {item.thumbnail ? (
                                  <img src={item.thumbnail} alt={item.name} className="w-12 h-12 rounded-2xl object-cover border border-slate-200/80 dark:border-white/10 shadow-xs flex-shrink-0" />
                                ) : (
                                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                                    <Package size={22} />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )) || (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">لا توجد منتجات مسجلة في هذا الطلب</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Additional Logistics Note Card */}
                <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 p-6 shadow-sm space-y-4 text-right">
                  <h4 className="font-black text-slate-800 dark:text-white text-sm flex items-center justify-end gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
                    <span>بيانات لوجستية وملاحظات إضافية</span>
                    <Truck size={16} className="text-indigo-500" />
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-black">
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block mb-1">مرجع المنصة / الرقم الأصلي</span>
                      <span className="text-slate-800 dark:text-white font-mono">{order.platformOrderId || order.originalOrderId || '---'}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block mb-1">مخزن الشحن / الاسترجاع</span>
                      <span className="text-slate-800 dark:text-white">{orderWarehouseName}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block mb-1">شركة الشحن والتوصيل</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{order.shippingCompany || 'غير محدد'}</span>
                    </div>
                  </div>
                  {order.notes && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">ملاحظات العميل والتوصيل:</span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{order.notes}</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Left Column: Collection Summary Sidebar */}
              <div className="w-full lg:w-[360px] space-y-5 lg:order-1">
                
                {/* Collection Amount Card */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-[2rem] p-6 shadow-xl shadow-indigo-500/20 text-right relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-x-10 -translate-y-10 pointer-events-none"></div>
                  <span className="text-indigo-200 font-black text-xs uppercase tracking-widest block mb-1.5">المطلوب تحصيله عند الاستلام</span>
                  <div className="flex items-baseline justify-end gap-1.5 mb-3">
                    <span className="text-3xl sm:text-4xl font-black tabular-nums">{totalAmountToCollect.toLocaleString()}</span>
                    <span className="text-sm font-bold text-indigo-200">ج.م</span>
                  </div>
                  <div className="pt-3 border-t border-indigo-400/30 flex justify-between items-center text-xs font-bold text-indigo-100">
                    <span className="bg-white/15 px-2.5 py-1 rounded-lg">إجمالي فاتورة العميل</span>
                    <span>شامل المنتجات ورسوم التوصيل</span>
                  </div>
                </div>

                {/* Quick Profit Highlight Card */}
                <div className={`rounded-[2rem] border p-6 text-right shadow-sm transition-all ${
                  profit >= 0 
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-950 dark:text-emerald-100' 
                    : 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/30 text-rose-950 dark:text-rose-100'
                }`}>
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <span className={`text-xs font-black uppercase tracking-widest ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {profit >= 0 ? '💎 الصافي الربحي المتوقع' : '⚠️ صافي الخسارة المتوقعة'}
                    </span>
                    <Wallet size={16} className={profit >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
                  </div>
                  <div className="flex items-baseline justify-end gap-1.5 mb-2">
                    <span className={`text-3xl font-black tabular-nums ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {profit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-bold opacity-75">ج.م</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                    {profit >= 0 
                      ? 'الربح الصافي بعد خصم كافة التكاليف ومصاريف الشحن من الفاتورة.' 
                      : 'هذا الأوردر يحقق خسارة بسبب تكاليف الشحن المرتفعة أو الخصم.'}
                  </p>
                  <button 
                    onClick={() => setActiveTab('financials')}
                    className="mt-4 w-full py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-black text-xs rounded-xl border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span>عرض تحليل المعادلة المالية بالكامل</span>
                    <ChevronRight size={14} className="rotate-180 text-indigo-500" />
                  </button>
                </div>

                {/* Quick Logistics Specs Card */}
                <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 p-5 shadow-sm space-y-3 text-right">
                  <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 dark:border-white/5">
                    مواصفات الشحن والخدمات
                  </h5>
                  <div className="flex justify-between items-center text-xs font-bold py-1">
                    <span className={`px-2.5 py-0.5 rounded-lg font-black ${order.includeInspectionFee ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                      {order.includeInspectionFee ? 'نعم، مسموح' : 'لا، غير مسموح'}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">فتح الشحنة ومعاينتها؟</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold py-1 border-t border-slate-100 dark:border-white/5">
                    <span className="text-indigo-600 dark:text-indigo-400 font-black">{Number(flexFeeValue).toLocaleString()} ج.م</span>
                    <span className="text-slate-600 dark:text-slate-400">تطبيق خدمة فليكس شيب</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold py-1 border-t border-slate-100 dark:border-white/5">
                    <span className="text-slate-800 dark:text-white font-black">{safeProductCost.toLocaleString()} ج.م</span>
                    <span className="text-slate-600 dark:text-slate-400">تكلفة شراء السلع الأصلي</span>
                  </div>
                </div>

                {/* Wallet Status Mini Card */}
                <div className={`rounded-[2rem] border p-5 text-right transition-all ${
                  walletStatusStyle === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-200' :
                  walletStatusStyle === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-950 dark:text-indigo-200' :
                  walletStatusStyle === 'rose' ? 'bg-rose-500/10 border-rose-500/20 text-rose-950 dark:text-rose-200' :
                  'bg-white dark:bg-[#0f1523] border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200'
                }`}>
                  <div className="flex items-center justify-end gap-2 mb-2 font-black text-xs">
                    <span>حالة المحفظة والدورة المالية</span>
                    <Wallet size={16} className="text-indigo-500" />
                  </div>
                  <p className="text-[11px] font-bold leading-relaxed text-slate-600 dark:text-slate-400">
                    {walletMessage}
                  </p>
                  <div className="mt-3 pt-3 border-t border-current/10 flex justify-between items-center text-[11px] font-black">
                    <span className="bg-current/10 px-2.5 py-1 rounded-lg">{cycleText}</span>
                    <span className="text-slate-500">نظام التسوية:</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: FINANCIALS (معادلة الربح والخسارة والماليات) */}
          {activeTab === 'financials' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Executive Overview Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 text-right">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="space-y-2 z-10 flex-1">
                  <span className="px-3.5 py-1 bg-indigo-500/20 text-indigo-300 font-black text-xs rounded-xl border border-indigo-500/30 inline-block mb-1">
                    ✨ التحليل المالي التنفيذي الشامل
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    معادلة الإيرادات مقابل المصروفات والربحية الصافية
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-300 max-w-xl leading-relaxed">
                    يتم احتساب الربح الصافي من خلال طرح تكلفة شراء المنتجات ومستحقات شركة الشحن والتأمين والضرائب من إجمالي المبلغ المحصل من العميل.
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xl p-5 rounded-3xl border border-white/15 z-10 w-full md:w-auto justify-end">
                  <div className="text-right">
                    <span className="text-xs font-bold text-indigo-200 block mb-1">
                      {isReturnedOrFailed ? 'صافي خسارة / تسوية المرتجع:' : 'الربح الصافي المحقق / المتوقع:'}
                    </span>
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span className={`text-3xl sm:text-4xl font-black tabular-nums ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {profit >= 0 ? `+${profit.toLocaleString()}` : `${profit.toLocaleString()}`}
                      </span>
                      <span className="text-xs font-bold text-slate-300">ج.م</span>
                    </div>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {profit >= 0 ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
                  </div>
                </div>
              </div>

              {/* 2-Column Comparison Grid: Revenues vs Expenses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* COLUMN 1: REVENUES (الإيرادات وما يدفعه العميل) */}
                <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-emerald-500/30 dark:border-emerald-500/20 p-6 shadow-sm space-y-5 text-right relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4 flex-row-reverse">
                    <h4 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <ArrowDownRight size={18} />
                      </div>
                      <span>الإيرادات (ما يدفعه العميل عند الاستلام)</span>
                    </h4>
                    <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs rounded-xl">
                      عائد إيجابي (+)
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                      <span className="text-slate-600 dark:text-slate-300">سعر المنتجات المسجل للعميل</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{safeProductPrice.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                      <span className="text-slate-600 dark:text-slate-300">رسوم الشحن المقررة على العميل</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{safeShippingFee.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                      </span>
                    </div>

                    {safeAdminFee > 0 && (
                      <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                        <span className="text-slate-600 dark:text-slate-300">زيادات أو رسوم إضافية على الفاتورة</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{safeAdminFee.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                        </span>
                      </div>
                    )}

                    {order.includeInspectionFee !== false && !isPosOrder && order.inspectionFeePaidByCustomer !== false && inspectionAdjustment > 0 && (
                      <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                        <span className="text-slate-600 dark:text-slate-300">رسوم فتح ومعاينة الشحنة (مدفوعة من العميل)</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{inspectionAdjustment.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                        </span>
                      </div>
                    )}

                    {safeDiscount > 0 && (
                      <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-rose-50/80 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 rounded-2xl border border-rose-200/50 dark:border-rose-900/30">
                        <span>خصومات ومسماحات ترويجية للعميل (-)</span>
                        <span className="font-black tabular-nums">
                          -{safeDiscount.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                        </span>
                      </div>
                    )}

                    {safeAdvance > 0 && (
                      <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-indigo-50/80 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-300 rounded-2xl border border-indigo-200/50 dark:border-indigo-900/30">
                        <span>عربون دفعة مقدمة (مستلم مسبقاً) (-)</span>
                        <span className="font-black tabular-nums">
                          -{safeAdvance.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center flex-row-reverse bg-emerald-500/10 dark:bg-emerald-500/15 p-4 rounded-2xl">
                    <span className="font-black text-slate-900 dark:text-white text-sm">إجمالي المطلوب تحصيله عند الاستلام:</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg tabular-nums">
                      {totalAmountToCollect.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                    </span>
                  </div>
                </div>

                {/* COLUMN 2: EXPENSES (المصروفات والتكاليف التشغيلية) */}
                <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-rose-500/30 dark:border-rose-500/20 p-6 shadow-sm space-y-5 text-right relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-rose-500"></div>
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4 flex-row-reverse">
                    <h4 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <ArrowUpRight size={18} />
                      </div>
                      <span>المصروفات والتكاليف التشغيلية (على الشركة)</span>
                    </h4>
                    <span className="px-3 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-xs rounded-xl">
                      استقطاع خصم (-)
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                      <span className="text-slate-600 dark:text-slate-300">تكلفة شراء السلع الأصلية (رأس المال)</span>
                      <span className="font-black text-rose-500 tabular-nums">
                        -{safeProductCost.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                      <span className="text-slate-600 dark:text-slate-300">تكلفة بوليصة الشحن (مستحقات شركة الشحن)</span>
                      <span className="font-black text-rose-500 tabular-nums">
                        -{standardShippingFee.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                      </span>
                    </div>

                    {insuranceFee > 0 && (
                      <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                        <span className="text-slate-600 dark:text-slate-300">التأمين الإجباري على قيمة الشحنة</span>
                        <span className="font-black text-rose-500 tabular-nums">
                          -{insuranceFee.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
                        </span>
                      </div>
                    )}

                    {bostaVatFee > 0 && (
                      <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                        <span className="text-slate-600 dark:text-slate-300">ضريبة القيمة المضافة لشركة الشحن ({(currentVatRate * 100).toFixed(0)}%)</span>
                        <span className="font-black text-rose-500 tabular-nums">
                          -{bostaVatFee.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
                        </span>
                      </div>
                    )}

                    {codFee > 0 && (
                      <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                        <span className="text-slate-600 dark:text-slate-300">رسوم تحصيل الدفع عند الاستلام (COD)</span>
                        <span className="font-black text-rose-500 tabular-nums">
                          -{codFee.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
                        </span>
                      </div>
                    )}

                    {inspectionAdjustment > 0 && !order.inspectionFeePaidByCustomer && (
                      <div className="flex justify-between items-center flex-row-reverse text-sm font-bold p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl">
                        <span className="text-slate-600 dark:text-slate-300">رسوم فتح ومعاينة الشحنة (تتحملها الشركة)</span>
                        <span className="font-black text-rose-500 tabular-nums">
                          -{inspectionAdjustment.toFixed(2)} <span className="text-xs font-normal">ج.م</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center flex-row-reverse bg-rose-500/10 dark:bg-rose-500/15 p-4 rounded-2xl">
                    <span className="font-black text-slate-900 dark:text-white text-sm">إجمالي المصروفات التشغيلية =</span>
                    <span className="font-black text-rose-600 dark:text-rose-400 text-lg tabular-nums">
                      -{(safeProductCost + carrierFees).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-bold">ج.م</span>
                    </span>
                  </div>
                </div>

              </div>

              {/* Special Returned / Failed Delivery FlexShip Analysis Banner */}
              {isReturnedOrFailed && (
                <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-violet-500/15 rounded-[2rem] p-6 border border-amber-500/30 dark:border-amber-500/20 text-right space-y-4">
                  <div className="flex items-center justify-end gap-2.5">
                    <h4 className="font-black text-amber-900 dark:text-amber-200 text-base">
                      ⚠️ تحليل خسائر المرتجع وفليكس شيب (FlexShip Protection)
                    </h4>
                    <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed max-w-4xl ml-auto">
                    تم إلغاء بيع هذه الشحنة بسبب عدم الاستلام أو الارتجاع. تم إعادة السلع الأصلية (بقيمة {safeProductCost.toLocaleString()} ج.م) للمخزون بأمان دون خسارة في رأس المال، وتقتصر الخسارة المحسوبة هنا فقط على مصاريف بوليصة الشحن والمحاولات الضائعة.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-black pt-2">
                    <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1">خسارة بوليصة الذهاب والتأمين</span>
                      <span className="text-rose-600 dark:text-rose-400 text-sm">-{carrierFees.toFixed(2)} ج.م</span>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1">رسوم فليكس شيب المحصلة من العميل</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm">+{flexPaidAmount.toFixed(2)} ج.م</span>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1">الخسارة الفعلية الموقعة بعد التسوية</span>
                      <span className={`text-sm ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{profit.toFixed(2)} ج.م</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Actions / Adjustments Card */}
              {onAddTransaction && (
                <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 p-6 shadow-sm space-y-4 text-right">
                  <div className="flex justify-between items-center flex-row-reverse">
                    <h4 className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-2">
                      <Plus size={16} className="text-indigo-500" />
                      <span>إضافة تعديل مالي أو تسوية مصروفات إضافية على الأوردر</span>
                    </h4>
                    {!showAdjustmentForm && (
                      <button 
                        onClick={() => setShowAdjustmentForm(true)}
                        className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-black text-xs rounded-xl transition-all active:scale-95"
                      >
                        + إضافة رسم شحن أو مصروف جديد
                      </button>
                    )}
                  </div>

                  {showAdjustmentForm && (
                    <div className="p-5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-white/5 space-y-4 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-black text-slate-500 block mb-1.5 text-right">المبلغ (بالجنيه المصري)</label>
                          <input 
                            type="number"
                            placeholder="مثلاً: 25"
                            value={adjAmount}
                            onChange={e => setAdjAmount(e.target.value)}
                            className="w-full p-3 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-black text-slate-500 block mb-1.5 text-right">سبب الخصم / الوصف</label>
                          <input 
                            type="text"
                            placeholder="مثلاً: زيادة وزن شحنة / غرامة تأخير"
                            value={adjNote}
                            onChange={e => setAdjNote(e.target.value)}
                            className="w-full p-3 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <button 
                          onClick={() => setShowAdjustmentForm(false)}
                          className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl transition-all"
                        >
                          إلغاء
                        </button>
                        <button 
                          onClick={() => {
                            const amt = parseFloat(adjAmount);
                            if (amt > 0 && adjNote) {
                              onAddTransaction('سحب', amt, `${adjNote} - أوردر #${order.orderNumber || order.id.slice(0,6)}`, 'expense_shipping_fees');
                              setShowAdjustmentForm(false);
                              setAdjAmount('');
                              setAdjNote('');
                            }
                          }}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
                        >
                          تأكيد وقيد المصروف في المحفظة
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 3: TRACKING & TIMELINE (تتبع الحالات وسجل التدقيق) */}
          {activeTab === 'tracking' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200 max-w-4xl mx-auto">
              
              {/* Timeline Header Card */}
              <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 text-right">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Clock size={24} />
                  </div>
                  <div className="text-right">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">الجدول الزمني ومراحل تنفيذ الأوردر</h3>
                    <p className="text-xs font-bold text-slate-500">تتبع كامل لكل إجراء وتغيير حالة تم على الشحنة منذ لحظة إنشائها</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-400">الحالة الحالية:</span>
                  <span className={`px-3.5 py-1.5 rounded-xl font-black text-xs shadow-xs ${statusInfo.color} flex items-center gap-1.5`}>
                    <CheckCircle2 size={14} />
                    <span>{statusInfo.label}</span>
                  </span>
                </div>
              </div>

              {/* Step-by-Step Visual Progress Bar */}
              <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 p-6 shadow-sm">
                <h4 className="font-black text-slate-800 dark:text-white text-sm mb-6 text-right">مراحل التوصيل الرئيسية</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
                  
                  {/* Step 1 */}
                  <div className="flex sm:flex-col items-center sm:text-center gap-3 p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl relative">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-500/25 flex-shrink-0">
                      ✓
                    </div>
                    <div className="text-right sm:text-center">
                      <span className="text-xs font-black text-slate-900 dark:text-white block">1. إنشاء الأوردر</span>
                      <span className="text-[10px] font-bold text-slate-500 block mt-0.5">تم تسجيل البيانات بنجاح</span>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className={`flex sm:flex-col items-center sm:text-center gap-3 p-4 rounded-2xl border transition-all ${
                    !['في_انتظار_المكالمة', 'ملغي'].includes(order.status)
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/30 text-slate-900 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-white/5 text-slate-400'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      !['في_انتظار_المكالمة', 'ملغي'].includes(order.status)
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      2
                    </div>
                    <div className="text-right sm:text-center">
                      <span className="text-xs font-black block">2. المراجعة والتأكيد</span>
                      <span className="text-[10px] font-bold block mt-0.5">تأكيد العنوان والمنتجات</span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className={`flex sm:flex-col items-center sm:text-center gap-3 p-4 rounded-2xl border transition-all ${
                    ['تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'تم_التوصيل', 'تم_التحصيل', 'مدفوعة'].includes(order.status)
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-500/30 text-slate-900 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-white/5 text-slate-400'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      ['تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'تم_التوصيل', 'تم_التحصيل', 'مدفوعة'].includes(order.status)
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      3
                    </div>
                    <div className="text-right sm:text-center">
                      <span className="text-xs font-black block">3. الشحن والتوصيل</span>
                      <span className="text-[10px] font-bold block mt-0.5">إصدار بوليصة وتسليم للشاحن</span>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className={`flex sm:flex-col items-center sm:text-center gap-3 p-4 rounded-2xl border transition-all ${
                    ['تم_التحصيل', 'مدفوعة'].includes(order.status)
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/40 text-slate-900 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-white/5 text-slate-400'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      ['تم_التحصيل', 'مدفوعة'].includes(order.status)
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      4
                    </div>
                    <div className="text-right sm:text-center">
                      <span className="text-xs font-black block">4. التحصيل والتسوية</span>
                      <span className="text-[10px] font-bold block mt-0.5">استلام النقود وقيدها بالمحفظة</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Detailed Audit Logs Timeline Feed */}
              <div className="bg-white dark:bg-[#0f1523] rounded-[2rem] border border-slate-200/80 dark:border-white/10 p-6 shadow-sm space-y-6 text-right">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4 flex-row-reverse">
                  <h4 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
                    <FileSearch size={18} className="text-indigo-500" />
                    <span>سجل التدقيق والنشاطات التفصيلي (Audit Trail)</span>
                  </h4>
                  <span className="text-xs font-black text-slate-400">
                    عدد السجلات: {order.auditLogs?.length || 0} عملية
                  </span>
                </div>

                {order.auditLogs && order.auditLogs.length > 0 ? (
                  <div className="space-y-4 relative before:absolute before:right-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {order.auditLogs.slice().reverse().map((log, idx) => {
                      const isStatusChange = log.action.includes('حالة') || log.action.includes('تغيير');
                      const isFinancial = log.action.includes('مالي') || log.action.includes('سعر') || log.action.includes('عربون');
                      const isShipping = log.action.includes('بوليصة') || log.action.includes('شحن');

                      return (
                        <div key={idx} className="relative pr-14 group">
                          {/* Timeline Marker Bullet */}
                          <div className={`absolute right-3 top-4 w-6.5 h-6.5 rounded-full border-4 border-white dark:border-[#0f1523] flex items-center justify-center text-[10px] z-10 shadow-sm ${
                            isStatusChange ? 'bg-indigo-600 text-white' :
                            isFinancial ? 'bg-emerald-600 text-white' :
                            isShipping ? 'bg-purple-600 text-white' :
                            'bg-slate-500 text-white'
                          }`}>
                            {isStatusChange ? '🔄' : isFinancial ? '💰' : isShipping ? '📦' : '•'}
                          </div>

                          <div className="p-5 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 rounded-2xl border border-slate-200/60 dark:border-white/5 transition-all">
                            <div className="flex justify-between items-start mb-2 flex-row-reverse">
                              <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                                isStatusChange ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400' :
                                isFinancial ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' :
                                isShipping ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400' :
                                'bg-slate-200/60 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                                {log.action}
                              </span>
                              <span className="text-[11px] font-bold text-slate-400 font-mono">
                                {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.timestamp))}
                              </span>
                            </div>
                            
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed mb-3">
                              {log.details}
                            </p>
                            
                            <div className="flex items-center justify-end gap-2 text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-200/40 dark:border-white/5">
                              <span>بواسطة المستخدم: <strong className="text-slate-600 dark:text-slate-300 font-mono">{log.userEmail || 'النظام التلقائي'}</strong></span>
                              <UserIcon size={12} className="opacity-60" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <History size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-base font-black text-slate-600 dark:text-slate-300">لا يوجد سجل أنشطة مسجل لهذا الأوردر حتى الآن</p>
                    <p className="text-xs font-bold text-slate-400">سيظهر هنا أي تغيير في حالة الشحنة أو تعديل في الفاتورة مستقبلاً</p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
        
        {/* Footer Status Bar */}
        <div className="bg-white dark:bg-[#0f1523] border-t border-slate-200/80 dark:border-white/10 px-6 py-4 flex justify-between items-center text-xs font-black text-slate-500 flex-row-reverse">
          <div className="flex items-center gap-2">
            <span>مخزن الشحن والتسليم:</span>
            <span className="text-slate-800 dark:text-white font-black">{orderWarehouseName}</span>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black transition-all shadow-sm active:scale-95"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
