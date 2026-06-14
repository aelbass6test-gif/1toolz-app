import React, { useState } from 'react';
import { X, Copy, MapPin, Phone, User as UserIcon, Package, AlertCircle, Wallet } from 'lucide-react';
import { Order, Settings } from '../types';
import { ORDER_STATUS_METADATA } from '../constants';
import { calculateCodFee, calculateInsuranceFee, calculateBostaVat, isBosta } from '../utils/financials';
import { generateInvoiceHTML } from '../utils/invoiceGenerator';

interface OrderDetailsModalProps {
  order: Order;
  settings: Settings;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, settings, onClose }) => {
  if (!settings) return null;
  const [activeTab, setActiveTab] = useState<'details' | 'tracking'>('details');

  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  
  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const insuranceFee = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const inspectionFee = (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
  const bostaVatFee = calculateBostaVat(order, insuranceFee, settings);
  const currentVatRate = useCustom ? (compFees?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0)) : (settings?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0));
  
  const bostaDues = safeShippingFee + insuranceFee + bostaVatFee;
  
  const computedTotal = safeProductPrice + safeShippingFee - safeDiscount - safeAdvance + inspectionFee;
  const totalAmountToCollect = order.totalAmountOverride != null ? Number(order.totalAmountOverride) : computedTotal;
  
  const flexFeeValue = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);

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
                                 <div className="flex items-center justify-end gap-2">
                                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">العميل نسبة استلامه منخفضة</span>
                                    <p className="font-bold text-slate-800 dark:text-white">{order.customerName}</p>
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
                                <span>مبنى: -</span>
                                <span>رقم الدور: -</span>
                                <span>رقم الشقة: -</span>
                                <span>علامة مميزة: -</span>
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
                             <p className="font-bold text-slate-700 dark:text-slate-200">-</p>
                        </div>
                        <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
                             <p className="text-slate-500 mb-1">موقع إرجاع الشحنة</p>
                             <p className="font-bold text-slate-700 dark:text-slate-200">الفرع الرئيسي</p>
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
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{totalAmountToCollect.toLocaleString()} ج.م</p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <p className="text-slate-500 text-sm mb-1">السماح للعميل بفتح الشحنة؟</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{order.includeInspectionFee ? 'نعم' : 'لا'}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <p className="text-slate-500 text-sm mb-1">تطبيق فليكس شيب</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{flexFeeValue} ج.م</p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <p className="text-slate-500 text-sm mb-1">قيمة المنتج</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{safeProductPrice.toLocaleString()} ج.م</p>
                    
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-4">
                        <button className="text-xs font-bold text-teal-600 flex items-center gap-1"><Copy size={14}/> تبديل الإثبات</button>
                        <button className="text-xs font-bold text-teal-600 flex items-center gap-1"><Copy size={14}/> تحميل الإثبات</button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{safeShippingFee.toLocaleString()} ج.م</span>
                        <span className="text-slate-500">سعر الشحن</span>
                    </div>
                    {currentVatRate > 0 && (
                        <div className="flex justify-between items-center">
                           <span className="font-bold text-slate-700 dark:text-slate-200">{bostaVatFee.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                           <span className="text-slate-500">ضريبة قيمة مضافة {(currentVatRate * 100).toFixed(0)}%</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{insuranceFee.toLocaleString()} ج.م</span>
                        <span className="text-slate-500">التأمين <AlertCircle size={12} className="inline opacity-50"/></span>
                    </div>
                    
                    <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-3 flex justify-between items-center">
                        <span className="font-black text-slate-800 dark:text-white">{bostaDues.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">تقدير مستحقات بوسطة</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                    <p className="font-bold text-slate-800 dark:text-white mb-4 text-right">المحفظة</p>
                    <div className="py-6 flex flex-col items-center justify-center gap-3">
                        <Wallet className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                        <p className="text-slate-500 text-sm font-bold">سيتم تحديث محفظتك في خلال 24 ساعة من إتمام الأوردر.</p>
                    </div>
                </div>

                <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right">
                    <p className="font-bold text-slate-800 dark:text-white mb-4">الدورة المالية</p>
                    
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">حجم أكبر (XL)</span>
                            <span className="text-slate-500 text-xs">حجم الشحنة <AlertCircle size={12} className="inline opacity-50"/></span>
                        </div>
                        
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                             <div className="flex justify-between items-center">
                                 <span className="font-black text-slate-800 dark:text-white text-sm">غير مدفوع</span>
                                 <span className="text-slate-500 text-xs">السحب النقدي</span>
                             </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-3">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">أسبوعياً</span>
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
