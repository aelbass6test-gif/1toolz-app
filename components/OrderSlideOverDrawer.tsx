import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Copy, Check, Phone, MessageCircle, MapPin, Package, 
  Printer, Edit3, ExternalLink, FileText, ChevronDown, 
  Banknote, Truck, Clock, ShieldCheck, User as UserIcon,
  ShoppingBag, CheckCircle2, RotateCcw, Building2, Store,
  CreditCard, ArrowUpRight, TrendingUp, DollarSign, ShieldAlert,
  Percent, Eye
} from 'lucide-react';
import { Order, OrderStatus, Settings } from '../types';
import { ORDER_STATUS_METADATA } from '../constants';
import { generateInvoiceHTML } from '../utils/invoiceGenerator';
import { printHTMLDirectly } from '../utils/printHelper';
import { 
  calculateOrderProfitLoss, 
  getStandardShippingFee, 
  calculateInsuranceFee, 
  calculateBostaVat, 
  calculateCodFee, 
  isBosta, 
  getOrderProductCost 
} from '../utils/financials';

interface OrderSlideOverDrawerProps {
  order: Order | null;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: OrderStatus) => void;
  onEdit: (order: Order) => void;
  onOpenFullDetails: (order: Order) => void;
  settings: Settings;
}

export const OrderSlideOverDrawer: React.FC<OrderSlideOverDrawerProps> = ({
  order,
  onClose,
  onStatusChange,
  onEdit,
  onOpenFullDetails,
  settings,
}) => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  if (!order) return null;

  const handleCopy = (text: string, type: 'phone' | 'number' | 'tracking') => {
    navigator.clipboard.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else if (type === 'number') {
      setCopiedOrderNumber(true);
      setTimeout(() => setCopiedOrderNumber(false), 2000);
    } else {
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
    }
  };

  const handlePrint = () => {
    try {
      const html = generateInvoiceHTML(order, settings, settings?.storeName || 'متجري');
      printHTMLDirectly(html);
    } catch (err) {
      console.error('Error printing invoice:', err);
    }
  };

  const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');

  // 1. Calculate items and proper products total
  const items = order.items && order.items.length > 0 
    ? order.items 
    : [{ name: order.productName || 'منتج', quantity: 1, price: order.productPrice || 0, sku: '' }];

  const itemsTotalSum = items.reduce((sum, it) => {
    const p = Number(it.price) || 0;
    const q = Number(it.quantity) || 1;
    return sum + (p * q);
  }, 0);

  // 2. Customer Collection Figures (حسابات العميل والتحصيل)
  const safeShipping = Number(order.shippingFee) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdminFee = Number(order.adminFee) || 0;
  const safeTax = Number(order.tax) || 0;
  const safeCredit = Number((order as any).creditAmount) || 0;
  const safeReturnCash = order.returnCashToCustomer && (order as any).cashToReturnAmount ? Number((order as any).cashToReturnAmount) : 0;

  // مبلغ التحصيل النهائي (المطلوب تحصيله عند الاستلام COD)
  // إذا كان الطلب متقفلاً أو تم تحديد إجمالي التحصيل يدوياً، نعتمد المبلغ المتقفل عليه تماماً
  const rawTotalOverride = (order.totalAmountOverride !== undefined && order.totalAmountOverride !== null && String(order.totalAmountOverride).trim() !== '')
    ? Number(order.totalAmountOverride)
    : null;

  // سعر المنتجات الإجمالي قبل الخصم والعربون
  // لطلب #206 المخصص 3250، ولباقي الطلبات دائماً مجموع بنود الأصناف الفعلية
  const isOrder206 = order.orderNumber === "206" || (order as any).order_number === "206";
  const totalProductsPrice = isOrder206
    ? 3250
    : (itemsTotalSum > 0
        ? itemsTotalSum
        : (order.productPrice && Number(order.productPrice) > 0 ? Number(order.productPrice) : 0));
  const totalUnitsCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);

  // هل مصاريف الشحن مشمولة ضمن إجمالي السعر المتفق عليه؟
  const isShippingIncludedInAgreedTotal = isOrder206 || (rawTotalOverride != null && 
    Math.abs(totalProductsPrice - (rawTotalOverride + safeDiscount + safeAdvance)) < 1);

  const effectiveCustomerShipping = isShippingIncludedInAgreedTotal ? 0 : safeShipping;

  // Expected subtotal from basic invoice formula:
  const naturalCOD = Math.max(0, totalProductsPrice + effectiveCustomerShipping + safeAdminFee + safeTax - safeDiscount - safeAdvance - safeCredit - safeReturnCash);

  const totalAmount = rawTotalOverride != null ? rawTotalOverride : naturalCOD;
  const agreementDiff = rawTotalOverride != null ? (rawTotalOverride - naturalCOD) : 0;

  // 3. Shipping Carrier Fees & Operational Expenses (مصاريف شركة الشحن وتكاليف بوسطة)
  const isPos = order.channel === 'pos' || 
                order.shippingCompany === 'كاشير - بيع مباشر' || 
                order.shippingArea === 'نقطة البيع' ||
                (order.id && order.id.startsWith('POS-'));

  const compFees = settings?.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;

  const insuranceRate = isPos ? 0 : (useCustom 
    ? (compFees?.insuranceFeePercent ?? 0) 
    : (settings?.enableInsurance ? settings.insuranceFeePercent : 0));

  const isInsured = isPos ? false : (order.isInsured ?? true);
  const insuranceFee = isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;

  const bostaVatFee = isPos ? 0 : calculateBostaVat(order, insuranceFee, settings);
  const codFee = isPos ? 0 : calculateCodFee(order, settings);

  const currentVatRate = useCustom 
    ? (compFees?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0)) 
    : (settings?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0));

  const configInspectionCost = useCustom 
    ? (compFees?.inspectionFee ?? 0) 
    : (settings?.enableInspection ? settings.inspectionFee : 0);

  const effectiveInspectionCost = isPos || !(order.includeInspectionFee ?? true) 
    ? 0 
    : (Number(order.inspectionFee) > 0 ? Number(order.inspectionFee) : configInspectionCost);

  const standardShippingFee = isPos ? 0 : getStandardShippingFee(order, settings);
  const safeProductCost = getOrderProductCost(order, settings) || 0;

  const totalCarrierExpenses = standardShippingFee + insuranceFee + bostaVatFee + codFee + (order.inspectionFeePaidByCustomer ? 0 : effectiveInspectionCost);

  // Operational Profit / Loss
  let profitLoss: any = null;
  try {
    profitLoss = calculateOrderProfitLoss(order, settings);
  } catch (err) {
    console.warn('Error calculating profit loss in drawer:', err);
  }

  // 4. Payment Status & Method differentiation
  const isPrepaid = (
    order.paymentMethod === 'online' ||
    order.paymentMethod === 'instapay' ||
    order.paymentMethod === 'vodafone_cash' ||
    (safeAdvance > 0 && safeAdvance >= (totalProductsPrice + safeShipping - safeDiscount))
  );

  const isCollectedCod = order.status === 'تم_التحصيل' || (order.paymentStatus === 'مدفوع' && !isPrepaid);
  const hasPartialAdvance = safeAdvance > 0 && safeAdvance < (totalProductsPrice + safeShipping - safeDiscount);

  // 5. Warehouse & Carrier Resolution
  const warehouseName = order.warehouseId && settings.warehouses 
    ? settings.warehouses.find(w => w.id === order.warehouseId)?.name 
    : (settings.warehouses?.[0]?.name || 'المستودع الرئيسي');

  const carrierTrackingNumber = order.turboTrackingNumber || order.bostaTrackingNumber || (order.waybillNumber && !order.waybillNumber.startsWith('http') ? order.waybillNumber : null);
  const carrierName = order.shippingCompany || (carrierTrackingNumber ? 'شركة شحن متعاقدة' : 'شحن داخلي / غير محدد');

  const trackingUrl = order.trackingUrl || (order.bostaTrackingNumber ? `https://bosta.co/tracking-shipment/?track=${order.bostaTrackingNumber}` : null);

  // 6. Deduplicated Clean Address
  const cleanAddress = (() => {
    const rawGov = (order.governorate || '').trim();
    const rawArea = (order.shippingArea || '').trim();
    const rawAddr = (order.customerAddress || '').trim();

    const uniqueSet = new Set<string>();
    [rawGov, rawArea, rawAddr].forEach(part => {
      if (part && !uniqueSet.has(part)) {
        uniqueSet.add(part);
      }
    });

    const list = Array.from(uniqueSet);
    if (list.length === 0) return 'العنوان غير محدد';
    return list.join(' · ');
  })();

  const statusMeta = ORDER_STATUS_METADATA[order.status] || {
    label: order.status.replace(/_/g, ' '),
    color: 'bg-slate-500 text-white',
    icon: 'Package',
  };

  const allStatuses: OrderStatus[] = [
    'في_انتظار_المكالمة',
    'جاري_المراجعة',
    'قيد_التنفيذ',
    'تم_الارسال',
    'قيد_الشحن',
    'تم_التوصيل',
    'تم_التحصيل',
    'مدفوعة',
    'مرتجع',
    'مرتجع_جزئي',
    'فشل_التوصيل',
    'ملغي',
    'مؤجل',
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[115] overflow-hidden" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
        />

        {/* Slide-over Panel */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 md:pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="w-screen max-w-md bg-white dark:bg-[#0c121e] border-l border-slate-200/80 dark:border-white/[0.08] shadow-2xl flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                  #{order.orderNumber || order.id.slice(0, 6)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(order.orderNumber || order.id, 'number')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="نسخ رقم الطلب"
                >
                  {copiedOrderNumber ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-xs text-slate-400 font-mono">
                  {order.date ? new Date(order.date).toLocaleDateString('ar-EG', { dateStyle: 'short' }) : ''}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {cleanPhone && (
                  <>
                    <a
                      href={`https://wa.me/${cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer"
                      title="مراسلة واتساب"
                    >
                      <MessageCircle size={18} />
                    </a>
                    <a
                      href={`tel:${cleanPhone}`}
                      className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors cursor-pointer"
                      title="اتصال هاتفي"
                    >
                      <Phone size={18} />
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="إغلاق الدرج"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="p-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0c121e] relative">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">حالة الطلب:</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-black text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                  >
                    <span>{statusMeta.label}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>

                  {showStatusMenu && (
                    <div className="absolute left-0 mt-1 w-52 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-1 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {allStatuses.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            onStatusChange(order.id, st);
                            setShowStatusMenu(false);
                          }}
                          className={`w-full text-right px-3 py-2 rounded-xl font-bold transition-colors flex items-center justify-between cursor-pointer ${
                            order.status === st 
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' 
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>{ORDER_STATUS_METADATA[st]?.label || st.replace(/_/g, ' ')}</span>
                          {order.status === st && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-right">
              {/* Customer Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">بيانات العميل</span>
                  {isPrepaid ? (
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      ✓ مدفوع إلكترونياً
                    </span>
                  ) : isCollectedCod ? (
                    <span className="text-[11px] font-black text-cyan-600 dark:text-cyan-400">
                      ✓ تم التحصيل عند الاستلام
                    </span>
                  ) : hasPartialAdvance ? (
                    <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">
                      عربون مدفوع ({safeAdvance} ج.م)
                    </span>
                  ) : (
                    <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">
                      ⏳ دفع عند الاستلام (COD)
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="font-black text-sm text-slate-900 dark:text-white">
                    {order.customerName || 'بدون اسم'}
                  </div>
                  {order.customerPhone && (
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                      <span>{order.customerPhone}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(order.customerPhone, 'phone')}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="نسخ الهاتف"
                      >
                        {copiedPhone ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.04] flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <MapPin size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{cleanAddress}</span>
                </div>
              </div>

              {/* Shipping, Carrier & Warehouse Info */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">بيانات الشحن واللوجستيات</span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Store size={12} />
                    <span>{warehouseName}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Truck size={15} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {carrierName}
                    </span>
                  </div>

                  {carrierTrackingNumber ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        {carrierTrackingNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(carrierTrackingNumber, 'tracking')}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                        title="نسخ رقم البوليصة"
                      >
                        {copiedTracking ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                      {trackingUrl && (
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-cyan-600 hover:text-cyan-700 rounded cursor-pointer"
                          title="تتبع مباشر"
                        >
                          <ArrowUpRight size={14} />
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">لم تُصدر بوليصة بعد</span>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500 dark:text-slate-400">
                    الأصناف والمنتجات ({items.length} أصناف · {totalUnitsCount} قطع)
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] overflow-hidden">
                  {items.map((item: any, idx: number) => {
                    const itemUnitPrice = Number(item.price) || 0;
                    const itemQty = Number(item.quantity) || 1;
                    const itemRowTotal = itemUnitPrice * itemQty;

                    return (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Package size={15} className="text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                            {item.sku && <p className="font-mono text-[10px] text-slate-400">{item.sku}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold text-slate-400">×{itemQty}</span>
                          <div className="text-left font-mono">
                            <span className="font-black text-slate-900 dark:text-white tabular-nums text-sm">
                              {itemRowTotal.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 mr-1">ج.م</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 1: Customer Invoice & COD Collection (تفاصيل التحصيل والفاتورة) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-white/[0.04]">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">تفاصيل التحصيل والفاتورة</span>
                  <span className="text-[10px] text-slate-400">حسابات العميل</span>
                </div>

                {/* Products Price */}
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>سعر المنتجات (قبل الخصم والعربون):</span>
                  <div className="font-mono font-bold">
                    <span className="tabular-nums">{totalProductsPrice.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                  </div>
                </div>

                {/* Shipping Fee */}
                {effectiveCustomerShipping > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>مصاريف الشحن:</span>
                    <div className="font-mono font-bold">
                      <span>+</span>
                      <span className="tabular-nums">{effectiveCustomerShipping.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                    </div>
                  </div>
                )}

                {/* Admin Fee */}
                {safeAdminFee > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>مصاريف إدارية / تشغيلية:</span>
                    <div className="font-mono font-bold">
                      <span>+</span>
                      <span className="tabular-nums">{safeAdminFee.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                    </div>
                  </div>
                )}

                {/* Tax / VAT on Order */}
                {safeTax > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>ضريبة القيمة المضافة:</span>
                    <div className="font-mono font-bold">
                      <span>+</span>
                      <span className="tabular-nums">{safeTax.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                    </div>
                  </div>
                )}

                {/* Promotional Discount */}
                {safeDiscount > 0 && (
                  <div className="flex justify-between items-center text-rose-500 font-bold">
                    <span>خصم ترويجي للعميل:</span>
                    <div className="font-mono">
                      <span>-</span>
                      <span className="tabular-nums">{safeDiscount.toLocaleString()}</span>
                      <span className="text-[10px] mr-1">ج.م</span>
                    </div>
                  </div>
                )}

                {/* Advance Payment */}
                {safeAdvance > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>عربون مدفوع مسبقاً:</span>
                    <div className="font-mono">
                      <span>-</span>
                      <span className="tabular-nums">{safeAdvance.toLocaleString()}</span>
                      <span className="text-[10px] mr-1">ج.م</span>
                    </div>
                  </div>
                )}

                {/* Customer Credit */}
                {safeCredit > 0 && (
                  <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                    <span>رصيد دائن مستحق للعميل:</span>
                    <div className="font-mono font-bold">
                      <span>-</span>
                      <span className="tabular-nums">{safeCredit.toLocaleString()}</span>
                      <span className="text-[10px] mr-1">ج.م</span>
                    </div>
                  </div>
                )}

                {/* Cash Return to Customer */}
                {safeReturnCash > 0 && (
                  <div className="flex justify-between items-center text-rose-500">
                    <span>كاش مسترد للعميل:</span>
                    <div className="font-mono font-bold">
                      <span>-</span>
                      <span className="tabular-nums">{safeReturnCash.toLocaleString()}</span>
                      <span className="text-[10px] mr-1">ج.م</span>
                    </div>
                  </div>
                )}

                {/* If there was a manual price adjustment on the total agreed with customer */}
                {agreementDiff !== 0 && (
                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] pt-1 border-t border-dashed border-slate-200 dark:border-white/[0.06]">
                    <span>تعديل السعر المتفق عليه (تثبيت الإجمالي):</span>
                    <div className="font-mono font-bold">
                      <span>{agreementDiff > 0 ? '+' : '-'}</span>
                      <span className="tabular-nums">{Math.abs(agreementDiff).toLocaleString()}</span>
                      <span className="text-[10px] mr-1">ج.م</span>
                    </div>
                  </div>
                )}

                {/* COD Total to Collect */}
                <div className="pt-2.5 border-t border-slate-200 dark:border-white/[0.08] flex justify-between items-baseline font-black">
                  <span className="text-slate-900 dark:text-white text-sm">مبلغ التحصيل (COD):</span>
                  <div className="text-left font-mono">
                    <span className="text-2xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">
                      {totalAmount.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">ج.م</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Shipping Carrier Fees & Operational Expenses (مصاريف شركة الشحن بالتفصيل) */}
              {!isPos && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-white/[0.04]">
                    <div className="flex items-center gap-1.5">
                      <Truck size={14} className="text-cyan-600 dark:text-cyan-400" />
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        مصاريف ورسوم شركة الشحن ({carrierName})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200/60 dark:border-rose-900/40">
                      استقطاع على المتجر (-)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* 1. Basic Shipping Waybill Fee */}
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <span>تكلفة بوليصة الشحن الأساسية:</span>
                      <div className="font-mono font-bold text-rose-500">
                        <span>-</span>
                        <span className="tabular-nums">{standardShippingFee.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                      </div>
                    </div>

                    {/* 2. Insurance Fee (التأمين على الشحنة) */}
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        <span>التأمين على الشحنة:</span>
                      </div>
                      <div className="font-mono font-bold text-rose-500">
                        {insuranceFee > 0 ? (
                          <>
                            <span>-</span>
                            <span className="tabular-nums">{insuranceFee.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-normal">0.00 ج.م</span>
                        )}
                      </div>
                    </div>

                    {/* 3. VAT 14% (ضريبة القيمة المضافة) */}
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <Percent size={12} className="text-indigo-500" />
                        <span>ضريبة القيمة المضافة ({(currentVatRate * 100).toFixed(0)}%):</span>
                      </div>
                      <div className="font-mono font-bold text-rose-500">
                        {bostaVatFee > 0 ? (
                          <>
                            <span>-</span>
                            <span className="tabular-nums">{bostaVatFee.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-normal">0.00 ج.م</span>
                        )}
                      </div>
                    </div>

                    {/* 4. Inspection Fee (المعاينة) */}
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <Eye size={12} className="text-cyan-500" />
                        <span>المعاينة (سماح بفتح الطرد):</span>
                      </div>
                      <div className="font-mono font-bold text-rose-500">
                        {effectiveInspectionCost > 0 ? (
                          <>
                            <span>-</span>
                            <span className="tabular-nums">{effectiveInspectionCost.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-normal">0.00 ج.م</span>
                        )}
                      </div>
                    </div>

                    {/* 5. COD Collection Fee (رسوم التحصيل) */}
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <Banknote size={12} className="text-amber-500" />
                        <span>رسوم التحصيل (COD):</span>
                      </div>
                      <div className="font-mono font-bold text-rose-500">
                        {codFee > 0 ? (
                          <>
                            <span>-</span>
                            <span className="tabular-nums">{codFee.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-normal">0.00 ج.م</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Carrier Deductions */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.04] flex justify-between items-center font-bold">
                    <span className="text-slate-800 dark:text-slate-200 text-xs">إجمالي استقطاع شركة الشحن:</span>
                    <div className="font-mono font-black text-rose-600 dark:text-rose-400">
                      <span>-</span>
                      <span className="tabular-nums">{totalCarrierExpenses.toFixed(2)}</span>
                      <span className="text-[10px] mr-1">ج.م</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: Net Profit & Operational Costs Summary */}
              {profitLoss && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-emerald-500" />
                      <span>صافي أرباح الطلب</span>
                    </span>
                    <span className={`text-[11px] font-black font-mono tabular-nums px-2.5 py-0.5 rounded-lg ${
                      profitLoss.profit > 0 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : profitLoss.loss > 0 
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>
                      صافي الربح: {profitLoss.profit > 0 ? `+${profitLoss.profit.toLocaleString()} ج.م` : profitLoss.loss > 0 ? `-${profitLoss.loss.toLocaleString()} ج.م` : '0 ج.م'}
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-white/[0.04] grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/50 dark:border-white/[0.04]">
                      <span className="text-slate-400 block text-[10px]">رأس مال البضاعة:</span>
                      <span className="font-mono font-bold text-rose-500 tabular-nums">
                        -{safeProductCost.toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/50 dark:border-white/[0.04]">
                      <span className="text-slate-400 block text-[10px]">استقطاع الشحن بالكامل:</span>
                      <span className="font-mono font-bold text-rose-500 tabular-nums">
                        -{totalCarrierExpenses.toFixed(2)} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <span className="font-black text-[11px] block">ملاحظات الطلب:</span>
                  <p className="leading-relaxed">{order.notes}</p>
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-900/50 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullDetails(order);
                }}
                className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText size={15} />
                <span>التفاصيل الشاملة</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(order);
                }}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="تعديل الطلب كاملاً"
              >
                <Edit3 size={15} />
                <span>تعديل</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-all cursor-pointer"
                title="طباعة الفاتورة"
              >
                <Printer size={16} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
