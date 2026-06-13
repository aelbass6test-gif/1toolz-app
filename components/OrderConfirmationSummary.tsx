import React from 'react';
import { Order, Settings } from '../types';
import { calculateInsuranceFee } from '../utils/financials';
import { generateInvoiceHTML } from '../utils/invoiceGenerator';
import { printHTMLDirectly } from '../utils/printHelper';
import { generateShippingLabelHTML } from '../utils/shippingLabelGenerator';
import { CheckCircle, Printer, FileDown } from 'lucide-react';

interface OrderConfirmationSummaryProps {
    order: Order;
    settings: Settings;
    onClose: () => void;
    storeName: string;
}

export const OrderConfirmationSummary: React.FC<OrderConfirmationSummaryProps> = ({ order, settings, onClose, storeName }) => {
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const inspectionFee = order.includeInspectionFee ? (compFees?.useCustomFees ? compFees.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
    
    // Insurance
    const insuranceRate = order.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0)) : 0;
    const productValueForInsurance = order.productPrice - (order.discount || 0);
    const insuranceFee = productValueForInsurance > 0 ? Math.max(0, Math.round((productValueForInsurance * (insuranceRate / 100)) * 100) / 100) : 0;
    
    // VAT (Logistics)
    const vatRate = compFees?.useCustomFees ? (compFees?.shippingVatRate ?? 14) : (settings.shippingVatRate ?? 14);
    const taxableBase = order.shippingFee + inspectionFee;
    const vatAmount = Math.round(taxableBase * (vatRate / 100) * 100) / 100;
    
    const safeAdvance = Number(order.advancePayment) || 0;
    const credit = (order as any).creditAmount || 0;
    
    // Total calculation
    let total = order.productPrice + order.shippingFee + inspectionFee + insuranceFee + vatAmount - (order.discount || 0) - safeAdvance - credit;
    
    if (order.returnCashToCustomer && (order as any).cashToReturnAmount) {
        total -= Number((order as any).cashToReturnAmount);
    }
    
    const finalTotal = order.totalAmountOverride ?? Math.max(0, Math.round(total));
    
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-sm">
                    <CheckCircle size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">تم إنشاء الطلب بنجاح!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">ملخص الطلب المالي للعميل <span className="font-bold text-slate-700 dark:text-slate-200">{order.customerName}</span></p>
                <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-500">إجمالي المنتجات:</span>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.productPrice.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">مصاريف الشحن:</span>
                            {(order.weight || 0) > 0 && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">(الوزن: {order.weight.toFixed(2)} كجم)</span>
                            )}
                        </div>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.shippingFee.toLocaleString()} ج.م</span>
                    </div>
                    {inspectionFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم المعاينة:</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {insuranceFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم التأمين ({insuranceRate}%):</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{insuranceFee.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {vatAmount > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">ضريبة القيمة المضافة ({vatRate}%):</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{vatAmount.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {(order as any).creditAmount > 0 && (
                        <div className="flex justify-between items-center text-sm text-amber-600">
                             <span className="font-bold">رصيد مستخدم:</span>
                             <span className="font-black">-{Number((order as any).creditAmount).toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {order.discount > 0 && (
                        <div className="flex justify-between items-center text-sm text-red-500">
                            <span className="font-bold">الخصم:</span>
                            <span className="font-black">-{order.discount.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                    <div className="flex justify-between items-center text-xl">
                        <span className="font-black text-indigo-600 dark:text-indigo-400">الإجمالي المطلوب تحصيله:</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{finalTotal.toLocaleString()} ج.م</span>
                    </div>
                    {order.totalAmountOverride !== undefined && order.totalAmountOverrideReason && (
                        <div className="mt-3 text-right">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider mb-1">سبب تعديل الإجمالي</span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 italic">
                                "{order.totalAmountOverrideReason}"
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-3 mt-8">
                    <button 
                        onClick={() => {
                            const html = generateInvoiceHTML(order, settings, storeName);
                            printHTMLDirectly(html);
                        }}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3"
                    >
                        <Printer size={20} />
                        <span>طباعة الفاتورة</span>
                    </button>
                    <button 
                        onClick={() => {
                            const html = generateShippingLabelHTML(order, storeName);
                            printHTMLDirectly(html);
                        }}
                        className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-3"
                    >
                        <FileDown size={20} />
                        <span>طباعة بوليصة الشحن</span>
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-full py-3 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-all mt-2"
                    >
                        إغلاق الملخص
                    </button>
                </div>
            </div>
        </div>
    );
};
