import React, { useState } from 'react';
import { X, Copy, MapPin, Phone, User as UserIcon, Package, AlertCircle, Wallet, Plus } from 'lucide-react';
import { Order, Settings } from '../types';
import { ORDER_STATUS_METADATA } from '../constants';
import { calculateCodFee, calculateInsuranceFee, calculateBostaVat, isBosta, calculateOrderProfitLoss } from '../utils/financials';
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
  const [activeTab, setActiveTab] = useState<'details' | 'tracking'>('details');
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');

  if (!settings) return null;

  const { profit, loss, carrierFees, productCost: safeProductCost, netRevenue } = calculateOrderProfitLoss(order, settings);

  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  
  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const insuranceFee = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const inspectionAdjustment = (order.includeInspectionFee ?? true) ? (order.inspectionFeePaidByCustomer ? 0 : (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0))) : 0;
  const bostaVatFee = calculateBostaVat(order, insuranceFee, settings);
  const codFee = calculateCodFee(order, settings);
  const currentVatRate = useCustom ? (compFees?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0)) : (settings?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0));
  
  const totalCarrierFees = carrierFees;
  
  const safeCredit = Number(order.creditAmount) || 0;
  const safeReturnCash = (order.returnCashToCustomer && order.cashToReturnAmount) ? Number(order.cashToReturnAmount) : 0;
  const computedTotal = Math.max(0, safeProductPrice + safeShippingFee - safeDiscount - safeAdvance - safeCredit - safeReturnCash + (order.inspectionFeePaidByCustomer ? inspectionAdjustment : 0));
  const totalAmountToCollect = order.totalAmountOverride != null 
    ? Math.max(0, Math.round(Number(order.totalAmountOverride) - safeAdvance - safeCredit - safeReturnCash)) 
    : computedTotal;
  
  const flexFeeValue = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);

  // Success rate calculations
  let customerSuccessRate = -1;
  let customerCompleted = 0;
  let customerTotal = 0;
  if (allOrders && allOrders.length > 0 && order.customerPhone) {
    const customerOrders = allOrders.filter(o => o.customerPhone === order.customerPhone);
    if (customerOrders.length > 0) {
        const successful = customerOrders.filter(o => ['تم_التوصيل', 'تم_التحصيل', 'مدفوعة'].includes(o.status)).length;
        customerSuccessRate = (successful / customerOrders.length) * 100;
        customerCompleted = successful;
        customerTotal = customerOrders.length;
    }
  }

  const successRateText = customerSuccessRate === -1 ? '' : (customerSuccessRate < 40 ? 'العميل نسبة استلامه منخفضة' : (customerSuccessRate > 80 ? 'عميل نشط وموثوق' : 'نسبة الاستلام متوسطة'));
  const successRateColor = customerSuccessRate === -1 ? '' : (customerSuccessRate < 40 ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400' : (customerSuccessRate > 80 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'));

  // Wallet logic calculations
  const isWalletSettled = order.paymentStatus === 'مدفوع';
  const isOrderCollected = ['تم_التحصيل', 'مدفوعة'].includes(order.status);
  const isOrderDelivered = ['تم_التوصيل', 'تم_توصيلها', 'تم_التوصيل'].includes(order.status);
  const isOrderFailedOrReturned = ['مرتجع', 'فشل_التوصيل', 'مرتجع_جزئي', 'ملغي', 'مؤرشف', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'].includes(order.status);

  let walletMessage = '';
  let walletStatusStyle = '';

  if (isWalletSettled) {
      walletMessage = 'تمت تسوية المستحقات وتحويلها بنجاح إلى حسابك ضمن الدورة المالية.';
      walletStatusStyle = 'emerald';
  } else if (isOrderCollected) {
      walletMessage = 'تم التحصيل. المبلغ متوفر بمحفظتك وقيد الانتظار لدورة السحب النقدي القادمة.';
      walletStatusStyle = 'indigo';
  } else if (isOrderDelivered) {
      walletMessage = 'تم تسليم الأوردر للعميل بنجاح. سيتم تحديث محفظتك وإضافة الرصيد بعد إتمام تسوية التحصيل من شركة الشحن.';
      walletStatusStyle = 'teal';
  } else if (isOrderFailedOrReturned) {
      walletMessage = 'لم يكتمل الأوردر. تم احتساب أو تسوية المصروفات والخسائر الناجمة عن الشحنة من المديونية.';
      walletStatusStyle = 'rose';
  } else {
      walletMessage = 'سيتم تحديث محفظتك وإضافة الرصيد المتاح مباشرة فور إتمام توصيل الأوردر وتحصيله.';
      walletStatusStyle = 'slate';
  }
  
  // Return Location logic
  const orderWarehouseName = order.warehouseId && settings.warehouses ? settings.warehouses.find(w => w.id === order.warehouseId)?.name : (settings.warehouses?.[0]?.name || 'الفرع الرئيسي');

  // Extract secondary details from address (heuristic)
  let building = '-', floor = '-', flat = '-', landmark = '-';
  if (order.shippingArea) {
      if (order.shippingArea.includes('مبنى')) {
          const match = order.shippingArea.match(/مبنى\s*([\d\w]+)/);
          if (match) building = match[1];
      }
      if (order.shippingArea.match(/دور\s*([\d\w]+)/)) {
          const match = order.shippingArea.match(/دور\s*([\d\w]+)/);
          if (match) floor = match[1];
      }
      if (order.shippingArea.match(/شقة\s*([\d\w]+)/)) {
          const match = order.shippingArea.match(/شقة\s*([\d\w]+)/);
          if (match) flat = match[1];
      }
      if (order.shippingArea.match(/علامة مميزة\s*([^\-،]+)/)) {
          const match = order.shippingArea.match(/علامة مميزة\s*([^\-،]+)/);
          if (match) landmark = match[1].trim();
      }
  }

  // Financial Cycle Logic
  const autoWithdrawalEnabled = settings?.wallet?.autoWithdrawal || false;
  const withdrawDaysCount = settings?.wallet?.autoWithdrawalDays?.length || 0;
  const cycleText = autoWithdrawalEnabled ? (withdrawDaysCount > 0 ? `${withdrawDaysCount} أيام بالأسبوع` : 'سحب تلقائي مفعل') : 'سحب عند الطلب';

  // The modal from the screenshot has specific financial presentation.
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

  const statusInfo = ORDER_STATUS_METADATA[order.status] || { label: order.status, color: 'bg-slate-500', icon: 'Package' };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-100 dark:bg-slate-950 w-full max-w-6xl h-full flex flex-col rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header Section */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                   <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors">
                     <X size={20} />
                   </button>
                   <button onClick={handlePrintSummary} className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-sm transition-colors">
                     <span className="text-xl">✨</span> ملخص الأوردر
                   </button>
                </div>
                
                <div className="text-right">
                   <div className="flex items-center justify-end gap-3 mb-1">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${statusInfo.color.replace('bg-', 'bg-opacity-20 text-').replace('text-white', '')} bg-emerald-100 text-emerald-700`}>
                        {statusInfo.label}
                      </span>
                      <h2 className="text-xl font-black text-slate-800 dark:text-white">توصيل #{order.orderNumber || order.id.slice(0,8)}</h2>
                   </div>
                   <p className="text-xs text-slate-500 dark:text-slate-400">
                     انشئ: {new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date(order.date))} {order.assignedToName ? `بواسطة ${order.assignedToName}` : ''}
                   </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-end gap-4 border-b border-slate-200 dark:border-slate-800 mt-2">
               <button 
                 onClick={() => setActiveTab('tracking')}
                 className={`pb-3 px-2 font-bold text-sm transition-colors ${activeTab === 'tracking' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 تتبع الاوردر
               </button>
               <button 
                 onClick={() => setActiveTab('details')}
                 className={`pb-3 px-2 font-bold text-sm transition-colors ${activeTab === 'details' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                 تفاصيل الاوردر
               </button>
            </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50 dark:bg-slate-900">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Right Main Area */}
            <div className="flex-1 space-y-6 lg:order-2">
                
                {/* Status Callout */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-4 flex justify-end">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                        {statusInfo.label}
                    </span>
                </div>

                {/* Operation Details */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-700 text-right">
                        <h3 className="font-bold text-slate-800 dark:text-white">تفاصيل العملية</h3>
                    </div>
                    <div className="p-4 sm:p-6 space-y-6 text-right">
                        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
                            <div className="flex gap-2">
                                <a 
                                  href={`https://wa.me/${order.customerPhone.replace(/\\D/g, '')}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md"
                                >
                                  عرض المحادثة
                                </a>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">تم التواصل</span>
                            </div>
                            <div className="text-sm">
                                <p className="text-slate-500 mb-1">تواصل مع العميل عبر الواتس آب</p>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-700 my-4"></div>

                        <div className="flex justify-end items-center gap-2">
                            <div className="text-sm text-right">
                                <p className="text-slate-500 mb-1">محاولات التوصيل <span className="inline-block w-4 h-4 text-[10px] text-center rounded-full bg-slate-200 text-slate-500">?</span></p>
                                <p className="font-bold text-slate-700 dark:text-slate-200">{order.callAttempts?.length || 1} من أصل 3 محاولات</p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Customer Details */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-700 text-right">
                        <h3 className="font-bold text-slate-800 dark:text-white">تفاصيل العميل</h3>
                    </div>
                    <div className="p-4 sm:p-6 space-y-5 text-right text-sm">
                        
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                             <div className="text-left w-1/2">
                                 <p className="text-slate-500 mb-1 text-right">رقم التليفون</p>
                                 <p className="font-bold text-slate-700 dark:text-slate-200 text-right" dir="ltr">{order.customerPhone}</p>
                             </div>
                             <div className="text-right w-1/2">
                                 <p className="text-slate-500 mb-1">الاسم بالكامل</p>
                                 <div className="flex flex-col items-end gap-1">
                                    <p className="font-bold text-slate-800 dark:text-white">{order.customerName}</p>
                                    {customerSuccessRate !== -1 && (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] font-bold text-slate-500">{customerCompleted} من {customerTotal} طلبات</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${successRateColor}`}>{successRateText} ({Math.round(customerSuccessRate)}%)</span>
                                        </div>
                                    )}
                                 </div>
                             </div>
                        </div>

                        <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                            <p className="text-slate-500 mb-1">العنوان بالتفصيل</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200">{order.shippingArea}</p>
                        </div>

                        <div>
                            <p className="text-slate-500 mb-2">تفاصيل ثانوية</p>
                            <div className="flex justify-end gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                                <span>مبنى: {building}</span>
                                <span>رقم الدور: {floor}</span>
                                <span>رقم الشقة: {flat}</span>
                                <span>علامة مميزة: {landmark}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shipment Details */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-700 text-right">
                        <h3 className="font-bold text-slate-800 dark:text-white">تفاصيل الشحنة</h3>
                    </div>
                    <div className="p-0">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/30 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="py-3 px-4 font-normal">السعر</th>
                                    <th className="py-3 px-4 font-normal">الكمية</th>
                                    <th className="py-3 px-4 font-normal">المنتج</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items?.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                        <td className="py-4 px-4 font-bold text-slate-700 dark:text-slate-200">{item.price?.toLocaleString()} ج.م</td>
                                        <td className="py-4 px-4 font-bold text-slate-700 dark:text-slate-200">{item.quantity}</td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{item.name}</span>
                                                {item.thumbnail && <img src={item.thumbnail} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />}
                                                {!item.thumbnail && <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><Package size={20} /></div>}
                                            </div>
                                        </td>
                                    </tr>
                                )) || (
                                    <tr className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                        <td colSpan={3} className="py-4 px-4 text-center text-slate-500">لا توجد منتجات مسجلة</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Additional Details */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-700 text-right">
                        <h3 className="font-bold text-slate-800 dark:text-white">تفاصيل إضافية</h3>
                    </div>
                    <div className="p-4 sm:p-6 space-y-4 text-right text-sm">
                        <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
                             <p className="text-slate-500 mb-1">مرجع الطلب</p>
                             <p className="font-bold text-slate-700 dark:text-slate-200">{order.platformOrderId || order.originalOrderId || '-'}</p>
                        </div>
                        <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
                             <p className="text-slate-500 mb-1">موقع إرجاع الشحنة</p>
                             <p className="font-bold text-slate-700 dark:text-slate-200">{orderWarehouseName}</p>
                        </div>
                        <div>
                             <p className="text-slate-500 mb-1">ملحوظات عند التوصيل</p>
                             <p className="font-bold text-slate-700 dark:text-slate-200">{order.notes || '-'}</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Left Sidebar (Financial Info) */}
            <div className="w-full lg:w-[350px] space-y-4 lg:order-1">
                
                {/* Main Collection Amount */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <p className="text-slate-500 text-sm mb-1">مبلغ التحصيل</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{totalAmountToCollect.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</p>
                </div>

                {/* Net Profit Summary Card */}
                <div className={`rounded-2xl border p-4 text-right transition-all sm:hover:scale-[1.02] ${profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800'}`}>
                    <div className="flex items-center justify-end gap-2 mb-1">
                        <p className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                            {profit >= 0 ? 'الصافي الربحي المتوقع' : 'صافي الخسارة المتوقعة'}
                        </p>
                        <Wallet size={16} className={profit >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
                    </div>
                    <p className={`text-2xl font-black ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {profit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م
                    </p>
                    {loss > 0 && (
                        <p className="text-[10px] text-rose-500 mt-1 font-bold">يتضمن رسوم مرتجع/فشل شحن بقيمة {loss.toFixed(2)} ج.م</p>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <p className="text-slate-500 text-sm mb-1">السماح للعميل بفتح الشحنة؟</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{order.includeInspectionFee ? 'نعم' : 'لا'}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <p className="text-slate-500 text-sm mb-1">تطبيق فليكس شيب</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{Number(flexFeeValue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-400">التكلفة: {safeProductCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span>
                        <p className="text-slate-500 text-sm">قيمة المنتج</p>
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{safeProductPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</p>
                    
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 flex-wrap">
                        <button className="text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors hover:bg-teal-100"><Copy size={12}/> تبديل الإثبات</button>
                        <button className="text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors hover:bg-teal-100"><Copy size={12}/> تحميل الإثبات</button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right space-y-3 text-sm">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-2 border-b border-slate-50 dark:border-slate-700 pb-2">تفصيل مصاريف شركة الشحن</h4>
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{safeShippingFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span>
                        <span className="text-slate-500">سعر الشحن</span>
                    </div>
                    {safeAdvance > 0 && (
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                           <span className="font-bold">-{safeAdvance.toLocaleString()} ج.م</span>
                           <span className="text-xs">عربون مقدم</span>
                        </div>
                    )}
                    {currentVatRate > 0 && (
                        <div className="flex justify-between items-center">
                           <span className="font-bold text-slate-700 dark:text-slate-200">{bostaVatFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span>
                           <span className="text-slate-500">ضريبة قيمة مضافة {(currentVatRate * 100).toFixed(0)}%</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{insuranceFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span>
                        <span className="text-slate-500">التأمين <AlertCircle size={12} className="inline opacity-50"/></span>
                    </div>
                    {codFee > 0 && (
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{codFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span>
                            <span className="text-slate-500">رسوم تحصيل (COD)</span>
                        </div>
                    )}
                    {inspectionAdjustment > 0 && (
                         <div className="flex justify-between items-center">
                             <span className="font-bold text-slate-700 dark:text-slate-200">{inspectionAdjustment.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span>
                             <span className="text-slate-500">رسوم معاينة</span>
                         </div>
                    )}
                    
                    <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-3 flex justify-between items-center">
                        <span className="font-black text-rose-600 dark:text-rose-400">-{totalCarrierFees.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">إجمالي مستحقات الشحن</span>
                    </div>

                    {onAddTransaction && (
                        <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
                            {showAdjustmentForm ? (
                                <div className="space-y-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg animate-in fade-in slide-in-from-top-1">
                                    <input 
                                        type="number"
                                        placeholder="المبلغ (مثلا 20)"
                                        value={adjAmount}
                                        onChange={e => setAdjAmount(e.target.value)}
                                        className="w-full p-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-indigo-500"
                                    />
                                    <input 
                                        type="text"
                                        placeholder="السبب (زيادة شحن / مديونية)"
                                        value={adjNote}
                                        onChange={e => setAdjNote(e.target.value)}
                                        className="w-full p-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none focus:border-indigo-500"
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                const amt = parseFloat(adjAmount);
                                                if (amt > 0 && adjNote) {
                                                    onAddTransaction('سحب', amt, `${adjNote} - أوردر #${order.orderNumber}`, 'expense_shipping_fees');
                                                    setShowAdjustmentForm(false);
                                                    setAdjAmount('');
                                                    setAdjNote('');
                                                }
                                            }}
                                            className="flex-1 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded"
                                        >
                                            تأكيد الخصم
                                        </button>
                                        <button 
                                            onClick={() => setShowAdjustmentForm(false)}
                                            className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setShowAdjustmentForm(true)}
                                    className="w-full py-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                                >
                                    <Plus size={12} /> إضافة زيادة في سعر الشحن أو مصروفات
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className={`bg-white dark:bg-slate-800 rounded-2xl border ${walletStatusStyle === 'emerald' ? 'border-emerald-200 dark:border-emerald-800' : walletStatusStyle === 'indigo' ? 'border-indigo-200 dark:border-indigo-800' : walletStatusStyle === 'teal' ? 'border-teal-200 dark:border-teal-800' : walletStatusStyle === 'rose' ? 'border-rose-200 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700'} p-4 text-center`}>
                    <p className={`font-bold mb-4 text-right ${walletStatusStyle === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : walletStatusStyle === 'indigo' ? 'text-indigo-700 dark:text-indigo-400' : walletStatusStyle === 'teal' ? 'text-teal-700 dark:text-teal-400' : walletStatusStyle === 'rose' ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>المحفظة</p>
                    <div className="py-6 flex flex-col items-center justify-center gap-3">
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center ${walletStatusStyle === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500' : walletStatusStyle === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500' : walletStatusStyle === 'teal' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-500' : walletStatusStyle === 'rose' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-500' : 'bg-slate-50 dark:bg-slate-900/30 text-slate-400'}`}>
                             <Wallet size={24} />
                         </div>
                         <p className={`${walletStatusStyle === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : walletStatusStyle === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' : walletStatusStyle === 'teal' ? 'text-teal-600 dark:text-teal-400' : walletStatusStyle === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'} text-sm font-bold max-w-xs`}>
                             {walletMessage}
                         </p>
                    </div>
                </div>

                <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <p className="font-bold text-slate-800 dark:text-white mb-4">الدورة المالية</p>
                    
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded opacity-50">تلقائي</span>
                            <span className="text-slate-500 text-xs">حجم الشحنة</span>
                        </div>
                        
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                             <div className="flex justify-between items-center">
                                 <span className={`font-black text-sm ${isWalletSettled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>{isWalletSettled ? 'مدفوع لمحفظتك' : 'غير مدفوع (معلق)'}</span>
                                 <span className="text-slate-500 text-xs">حالة السحب النقدي</span>
                             </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-3">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{cycleText}</span>
                            <span className="text-slate-500 text-xs">تكرار السحب النقدي</span>
                        </div>
                    </div>
                </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
