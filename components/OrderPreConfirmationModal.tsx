import React from 'react';
import { Order, Settings } from '../types';
import { calculateInsuranceFee, getStandardShippingFee } from '../utils/financials';
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
    const insuranceValueForVat = vatBasis === 'shipping_and_insurance' ? insuranceFee : 0;
    const useStandard = order.vatOnStandardShipping === true;
    const standardShippingFee = useStandard ? getStandardShippingFee(order as Order, settings) : (order.shippingFee || 0);
    const taxableBase = standardShippingFee + inspectionFee + insuranceValueForVat;
    const vatValue = (hasVat && vatRate > 0) ? (Math.round(taxableBase * vatRate * 100) / 100) : 0;

    const isMaintenance = order.orderType === 'maintenance';
    const basePrice = isMaintenance ? (Number((order as any).maintenanceCost) || 0) : (order.productPrice - (order.discount || 0));
    const baseTotal = basePrice + order.shippingFee - safeAdvance + inspectionFee + insuranceFee + vatValue;
    const total = (order as any).totalAmountOverride ?? baseTotal;
    console.log("OrderPreConfirmationModal Debug:", { orderPrice: order.productPrice, shippingFee: order.shippingFee, insuranceFee, vatValue, baseTotal, total });
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-sm">
                    <AlertTriangle size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">هل أنت متأكد من تفاصيل الطلب؟</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">يرجى مراجعة الملخص المالي قبل تأكيد الطلب.</p>
                <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    {isMaintenance ? (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">تكلفة الصيانة:</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{Number((order as any).maintenanceCost || 0).toLocaleString()} ج.م</span>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">إجمالي المنتجات:</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{order.productPrice.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">مصاريف الشحن:</span>
                            {(order.weight || 0) > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">(الوزن: {order.weight.toFixed(2)} كجم)</span>
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
                            <span className="font-black text-slate-700 dark:text-slate-200">{insuranceFee.toFixed(2)} ج.م</span>
                        </div>
                    )}
                    {vatValue > 0 && (
                        <div className="flex justify-between items-center text-sm text-blue-600 dark:text-blue-400">
                             <span className="font-bold">ضريبة القيمة المضافة ({Math.round(vatRate * 100)}%):</span>
                             <span className="font-black">{vatValue.toFixed(2)} ج.م</span>
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
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} ج.م</span>
                    </div>
                </div>
                <div className="mt-8 flex gap-3">
                    <button onClick={onConfirm} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm hover:shadow">
                        تأكيد وإضافة
                    </button>
                    <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        رفض وتعديل
                    </button>
                </div>
            </div>
        </div>
    );
};
