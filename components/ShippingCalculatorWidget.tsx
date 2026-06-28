import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calculator, 
  X, 
  ChevronDown, 
  HelpCircle, 
  Truck, 
  CheckCircle,
  Coins,
  Package,
  Shield,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Order } from '../types';
import { EGYPT_GOVERNORATES } from '../constants';
import { 
  calculateInsuranceFee, 
  getStandardShippingFee 
} from '../utils/financials';

interface ShippingCalculatorWidgetProps {
  settings: Settings;
  isOpen: boolean;
  onClose: () => void;
}

export const ShippingCalculatorWidget: React.FC<ShippingCalculatorWidgetProps> = ({ 
  settings, 
  isOpen, 
  onClose 
}) => {
  const [productValue, setProductValue] = useState<number>(0);
  const [shippingCompany, setShippingCompany] = useState<string>(
    Object.keys(settings.shippingOptions || {})[0] || 'aramex'
  );
  const [governorate, setGovernorate] = useState<string>(EGYPT_GOVERNORATES[0]?.name || '');
  const [city, setCity] = useState<string>('');
  const [isDuesExpanded, setIsDuesExpanded] = useState(true);
  const [payWithPoints, setPayWithPoints] = useState(false);
  const [vatOnStandardShipping, setVatOnStandardShipping] = useState(true);
  const [includeInspectionFee, setIncludeInspectionFee] = useState(false);

  const activeCompanies = useMemo(() => {
    const carrierKeys = Object.keys(settings.shippingOptions || {});
    return carrierKeys.filter(
      (company) => settings.activeCompanies?.[company] !== false,
    );
  }, [settings.shippingOptions, settings.activeCompanies]);

  const getCompanyDisplayName = (companyKey?: string) => {
    if (!companyKey) return "شركة الشحن";
    const name = companyKey.toLowerCase();
    if (name.includes("bosta") || name.includes("بوسطة") || name.includes("بوسطه")) {
      return "بوسطة";
    }
    if (name.includes("aramex") || name.includes("ارامكس")) {
      return "أرامكس";
    }
    if (name.includes("mylerz") || name.includes("مايلرز")) {
      return "مايلرز";
    }
    if (name.includes("turbo") || name.includes("توربو") || name.includes("تربو")) {
      return "توربو";
    }
    return companyKey;
  };

  const dummyOrder = useMemo(() => {
    return {
      shippingCompany,
      governorate,
      city,
      productPrice: productValue,
      shipmentType: 'delivery',
      items: [],
      discount: 0,
      isInsured: true,
      includeInspectionFee,
      vatOnStandardShipping
    } as unknown as Order;
  }, [shippingCompany, governorate, city, productValue, includeInspectionFee, vatOnStandardShipping]);

  const shippingFee = useMemo(() => {
    return getStandardShippingFee(dummyOrder, settings);
  }, [dummyOrder, settings]);

  const insuranceFee = useMemo(() => {
    const compFees = settings.companySpecificFees?.[shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const insuranceRate = useCustom
      ? (compFees?.insuranceFeePercent ?? 0)
      : settings.enableInsurance
        ? settings.insuranceFeePercent
        : 0;

    return calculateInsuranceFee(dummyOrder, insuranceRate, settings);
  }, [dummyOrder, settings, shippingCompany]);

  const inspectionFeeValue = useMemo(() => {
    if (!includeInspectionFee) return 0;
    const compFees = settings.companySpecificFees?.[shippingCompany];
    return compFees?.useCustomFees ? (compFees?.inspectionFee || 0) : (settings.inspectionFee || 0);
  }, [shippingCompany, settings, includeInspectionFee]);

  const vatAmount = useMemo(() => {
    const compFees = settings.companySpecificFees?.[shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const hasVat = compFees?.enableVat !== false;
    if (!hasVat) return 0;

    const vatRate = useCustom
      ? (compFees?.shippingVatRate ?? 0.14)
      : (settings.shippingVatRate ?? 0.14);
    
    const vatBasis = useCustom
      ? compFees?.vatBasis || "shipping_only"
      : "shipping_only";

    const taxableShipping = vatOnStandardShipping ? shippingFee : 0;
    const insuranceValue = vatBasis === "shipping_and_insurance" ? insuranceFee : 0;
    
    const taxableBase = taxableShipping + inspectionFeeValue + insuranceValue;
    return Math.round(taxableBase * vatRate * 100) / 100;
  }, [shippingFee, insuranceFee, shippingCompany, settings, vatOnStandardShipping, inspectionFeeValue]);

  const totalDues = useMemo(() => {
    return Math.round((shippingFee + vatAmount + insuranceFee + inspectionFeeValue) * 100) / 100;
  }, [shippingFee, vatAmount, insuranceFee, inspectionFeeValue]);

  const currentGovernorate = EGYPT_GOVERNORATES.find(g => g.name === governorate);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
              <Calculator size={22} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight">حاسبة الشحن الذكية</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">تقدير المصاريف والمستحقات</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* VAT Method Toggle */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest text-center">
              طريقة حساب ضريبة القيمة المضافة
            </label>
            <div className="flex bg-slate-200/50 dark:bg-slate-900 p-1 rounded-2xl relative">
              <button
                onClick={() => setVatOnStandardShipping(true)}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-black transition-all z-10 ${
                  vatOnStandardShipping ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
                }`}
              >
                الشحن القياسي بالمدن
              </button>
              <button
                onClick={() => setVatOnStandardShipping(false)}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-black transition-all z-10 ${
                  !vatOnStandardShipping ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
                }`}
              >
                الشحن المدخل بالطلب
              </button>
            </div>
          </div>

          {/* Company Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest text-right">
              شركة الشحن
            </label>
            <div className="grid grid-cols-2 gap-2">
              {activeCompanies.map(company => (
                <button
                  key={company}
                  onClick={() => setShippingCompany(company)}
                  className={`p-3 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-2 ${
                    shippingCompany === company 
                      ? "bg-amber-50 dark:bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 shadow-sm" 
                      : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Truck size={14} />
                  <span>{getCompanyDisplayName(company)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest text-right">
                المحافظة
              </label>
              <select
                value={governorate}
                onChange={(e) => {
                  setGovernorate(e.target.value);
                  setCity('');
                }}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-sm text-right outline-none focus:ring-4 focus:ring-amber-500/10"
              >
                {EGYPT_GOVERNORATES.map(gov => (
                  <option key={gov.name} value={gov.name}>{gov.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest text-right">
                المدينة
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-sm text-right outline-none focus:ring-4 focus:ring-amber-500/10"
              >
                <option value="">كل المدن</option>
                {currentGovernorate?.cities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Value Input */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-500 flex items-center gap-2 justify-end">
              <span className="text-[10px] text-slate-400">(لحساب تكلفة التأمين)</span>
              <span>قيمة المنتج (للتأمين)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={productValue || ''}
                onChange={(e) => setProductValue(Number(e.target.value))}
                className="w-full p-6 pl-16 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200/60 dark:border-slate-700/60 rounded-[2rem] font-black text-3xl text-right outline-none focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500 transition-all dark:text-white"
                placeholder="0"
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-xl text-slate-400">ج.م</span>
            </div>
            <p className="text-[11px] text-slate-400 font-bold text-right mr-1 flex items-center justify-end gap-1.5">
              <span>مصاريف التأمين = {insuranceFee} ج.م</span>
              <HelpCircle size={12} className="text-slate-300" />
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIncludeInspectionFee(!includeInspectionFee)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 relative flex items-center ${
                  includeInspectionFee ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 absolute ${
                    includeInspectionFee ? "right-1" : "left-1"
                  }`}
                />
              </button>
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">تفعيل مصاريف المعاينة</span>
            </div>
          </div>

          {/* Estimation Card */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => setIsDuesExpanded(!isDuesExpanded)}
              className="w-full p-5 flex justify-between items-center font-extrabold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronDown size={18} className={`transition-transform duration-300 ${isDuesExpanded ? "" : "rotate-180"}`} />
                <span className="text-amber-600 dark:text-amber-400 font-black text-lg">
                  {totalDues.toFixed(2)} ج.م
                </span>
              </div>
              <span className="flex items-center gap-2">
                <Calculator size={20} className="text-amber-500" />
                <span>تقدير مستحقات {getCompanyDisplayName(shippingCompany)}</span>
              </span>
            </button>

            <AnimatePresence>
              {isDuesExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-900 dark:text-white font-black">{shippingFee} ج.م</span>
                      <span className="text-slate-500">سعر الشحن</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-900 dark:text-white font-black">{vatAmount} ج.م</span>
                      <span className="text-slate-500">ضريبة قيمة مضافة 14%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-900 dark:text-white font-black">{insuranceFee} ج.م</span>
                      <span className="text-slate-500">التأمين</span>
                    </div>
                    {includeInspectionFee && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-900 dark:text-white font-black">{inspectionFeeValue} ج.م</span>
                        <span className="text-slate-500">مصاريف المعاينة</span>
                      </div>
                    )}
                    <div className="pt-4 border-t border-dashed border-slate-100 dark:border-slate-800 flex justify-between items-center font-black text-slate-900 dark:text-white">
                      <span className="text-amber-600 dark:text-amber-400 text-xl">
                        {totalDues.toFixed(2)} ج.م
                      </span>
                      <span className="text-lg">المجموع الكلي المقدر</span>
                    </div>

                    {/* Pay with Points */}
                    <div className="pt-4 border-t border-dashed border-slate-100 dark:border-slate-800 flex justify-end items-center gap-3">
                      <span className="text-xs font-black text-slate-600 dark:text-slate-400">
                        دفع الأوردر بنقاط {getCompanyDisplayName(shippingCompany)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPayWithPoints(!payWithPoints)}
                        className={`w-10 h-5 rounded-full p-1 transition-colors duration-300 relative flex items-center ${
                          payWithPoints ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 absolute ${
                            payWithPoints ? "right-1" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-black text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-all shadow-sm"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
};
