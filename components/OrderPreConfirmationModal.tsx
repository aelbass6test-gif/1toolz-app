import React from 'react';
import { Order, Settings } from '../types';
import { calculateInsuranceFee, getStandardShippingFee, calculateCodFee } from '../utils/financials';
import { AlertTriangle } from 'lucide-react';

interface OrderPreConfirmationModalProps {
    order: Omit<Order, 'id'>;
    settings: Settings;
    onConfirm: () => void;
    onCancel: () => void;
}

export const OrderPreConfirmationModal: React.FC<OrderPreConfirmationModalProps> = ({ order, settings, onConfirm, onCancel }) => {
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const inspectionFee = order.includeInspectionFee ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0;
    const insuranceRate = order.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0;
    const insuranceFee = calculateInsuranceFee(order as Order, insuranceRate, settings);
    const safeAdvance = Number((order as any).advancePayment) || 0;
    
    // Logic matching OrderForm VAT
    const useCustom = compFees?.useCustomFees ?? false;
    const vatRate = useCustom ? (compFees?.shippingVatRate ?? 0.14) : (settings.shippingVatRate ?? 0.14);
    const vatBasis = useCustom ? (compFees?.vatBasis || 'shipping_only') : 'shipping_only';
    const hasVat = compFees?.enableVat !== false;
    const insuranceValueForVat = (vatBasis === 'shipping_and_insurance' || vatBasis === 'shipping_insurance_and_cod') ? insuranceFee : 0;
    const codValueForVat = vatBasis === 'shipping_insurance_and_cod' ? calculateCodFee(order as Order, settings) : 0;
    const useStandard = order.vatOnStandardShipping === true;
    const standardShippingFee = useStandard ? getStandardShippingFee(order as Order, settings) : (order.shippingFee || 0);
    const taxableBase = standardShippingFee + inspectionFee + insuranceValueForVat + codValueForVat;
    const vatValue = (hasVat && vatRate > 0) ? (Math.round(taxableBase * vatRate * 100) / 100) : 0;

    const isMaintenance = order.orderType === 'maintenance';
    const basePrice = isMaintenance ? (Number((order as any).maintenanceCost) || 0) : (order.productPrice - (order.discount || 0));
    const baseTotal = basePrice + order.shippingFee - safeAdvance + inspectionFee + insuranceFee + vatValue;
    const credit = (order as any).creditAmount || 0;
    const returnCash = (order.returnCashToCustomer && (order as any).cashToReturnAmount) ? Number((order as any).cashToReturnAmount) : 0;
    const total = (order as any).totalAmountOverride !== undefined && (order as any).totalAmountOverride !== null
        ? Math.max(0, Math.round(Number((order as any).totalAmountOverride) - safeAdvance - credit - returnCash))
        : baseTotal;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] shadow-2xl p-7 text-center animate-in zoom-in-95 duration-300 border border-slate-200/80 dark:border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-indigo-600 to-emerald-500" />
                
                <div className="w-20 h-20 bg-gradient-to-tr from-amber-100 to-orange-100 dark:from-amber-950/60 dark:to-orange-950/40 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-200/60 dark:border-amber-800/60 shadow-lg shadow-amber-500/10">
                    <AlertTriangle size={38} className="animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">مراجعة الحسابات وتأكيد الطلب</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">يرجى التأكد من الحسابات المالية والرسوم قبل ترحيل الطلب للنظام</p>
                
                <div className="space-y-3 text-right bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-200/60 dark:divide-slate-700/60 text-xs sm:text-sm">
                    {isMaintenance ? (
                        <div className="flex justify-between items-center pb-2">
                            <span className="font-bold text-slate-500 dark:text-slate-400">تكلفة الصيانة:</span>
                            <span className="font-black text-slate-800 dark:text-slate-100 font-mono">{Number((order as any).maintenanceCost || 0).toLocaleString()} ج.م</span>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center pb-2">
                            <span className="font-bold text-slate-500 dark:text-slate-400">إجمالي المنتجات:</span>
                            <span className="font-black text-slate-800 dark:text-slate-100 font-mono">{(order.productPrice ?? 0).toLocaleString()} ج.م</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-2.5">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-500 dark:text-slate-400">مصاريف الشحن والتوصيل:</span>
                            {(order.weight || 0) > 0 && (
                                <span className="text-[10px] text-slate-400 font-mono">({order.weight.toFixed(2)} كجم)</span>
                            )}
                        </div>
                        <span className="font-black text-slate-800 dark:text-slate-100 font-mono">{(order.shippingFee ?? 0).toLocaleString()} ج.م</span>
                    </div>
                    {inspectionFee > 0 && (
                        <div className="flex justify-between items-center pt-2.5">
                            <span className="font-bold text-slate-500 dark:text-slate-400">رسوم معاينة الشحنة:</span>
                            <span className="font-black text-slate-800 dark:text-slate-100 font-mono">{(inspectionFee ?? 0).toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {insuranceFee > 0 && (
                        <div className="flex justify-between items-center pt-2.5">
                            <span className="font-bold text-slate-500 dark:text-slate-400">رسوم التأمين ({insuranceRate}%):</span>
                            <span className="font-black text-slate-800 dark:text-slate-100 font-mono">{insuranceFee.toFixed(2)} ج.م</span>
                        </div>
                    )}
                    {vatValue > 0 && (
                        <div className="flex justify-between items-center pt-2.5 text-blue-600 dark:text-blue-400">
                             <span className="font-bold">ضريبة القيمة المضافة ({Math.round(vatRate * 100)}%):</span>
                             <span className="font-black font-mono">{vatValue.toFixed(2)} ج.م</span>
                        </div>
                    )}
                    {order.discount > 0 && (
                        <div className="flex justify-between items-center pt-2.5 text-emerald-600 dark:text-emerald-400">
                            <span className="font-bold">الخصم الممنوح:</span>
                            <span className="font-black font-mono">-{(order.discount ?? 0).toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {safeAdvance > 0 && (
                        <div className="flex justify-between items-center pt-2.5 text-teal-600 dark:text-teal-400">
                            <span className="font-bold">عربون مقدم مدفوع:</span>
                            <span className="font-black font-mono">-{(safeAdvance ?? 0).toLocaleString()} ج.م</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-3 text-base sm:text-lg">
                        <span className="font-black text-indigo-600 dark:text-indigo-400">المطلوب تحصيله (COD):</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-xl sm:text-2xl">{(total ?? 0).toLocaleString()} ج.م</span>
                    </div>
                </div>
                <div className="mt-6 flex gap-3">
                    <button 
                        onClick={onConfirm} 
                        className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer text-sm"
                    >
                        تأكيد وإنشاء الطلب ✓
                    </button>
                    <button 
                        onClick={onCancel} 
                        className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer text-sm"
                    >
                        مراجعة وتعديل
                    </button>
                </div>
            </div>
        </div>
    );
};
