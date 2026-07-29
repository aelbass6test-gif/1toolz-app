import React, { useState, useMemo } from 'react';
import { Store, Package, MapPin, Truck, Plus, Trash2, ArrowRightCircle } from 'lucide-react';
import { OrderItem, Settings, Order } from '../types';
import egyptCitiesData from '../data/egypt_cities.json';
import { getStandardShippingFee, calculateInsuranceFee, calculateCodFee, calculateBostaVat } from '../utils/financials';

const egyptCities = egyptCitiesData as Record<string, string[]>;

export interface NewOrderState {
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  customerAddress: string;
  governorate: string;
  city: string;
  items: OrderItem[];
  shippingCompany: string;
  shippingFee: number;
  discount: number;
  notes?: string;
  merchantBrandName?: string;
  merchantBrandPhone?: string;
  isInsured?: boolean;
  includeInspectionFee?: boolean;
  allowOpenShipment?: boolean;
  insurancePackageId?: string;
  [key: string]: any;
}

interface DropshippingOrderFormProps {
  orderData: NewOrderState;
  setOrderData: React.Dispatch<React.SetStateAction<NewOrderState>>;
  settings: Settings;
  onAddOrder: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const DropshippingOrderForm: React.FC<DropshippingOrderFormProps> = ({
  orderData,
  setOrderData,
  settings,
  onAddOrder,
  onCancel
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFieldChange = (field: string, value: any) => {
    setOrderData(prev => ({ ...prev, [field]: value }));
  };

  const addEmptyItem = () => {
    const newItem: OrderItem = {
      productId: `external-${Date.now()}`,
      name: "",
      quantity: 1,
      price: 0,
      cost: 0,
      weight: 1,
      thumbnail: "",
      discountValue: 0,
      discountType: "amount"
    };
    handleFieldChange("items", [...(orderData.items || []), newItem]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...(orderData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    handleFieldChange("items", newItems);
  };

  const removeItem = (index: number) => {
    const newItems = [...(orderData.items || [])];
    newItems.splice(index, 1);
    handleFieldChange("items", newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderData.customerName || !orderData.customerPhone) {
      setValidationError("يرجى إدخال اسم العميل ورقم الهاتف");
      return;
    }
    if (!orderData.items || orderData.items.length === 0) {
      setValidationError("يرجى إضافة صنف واحد على الأقل");
      return;
    }
    for (const item of orderData.items) {
      if (!item.name.trim()) {
        setValidationError("جميع الأصناف يجب أن يكون لها اسم");
        return;
      }
    }
    setValidationError(null);
    orderData.isExternalDropship = true; // Mark as explicit dropship order
    onAddOrder(e);
  };

  return (
    <div className="space-y-8 text-right max-w-5xl mx-auto pb-12" dir="rtl">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
              <Package size={28} />
            </div>
            <span>إنشاء طلب دروب شيبنج جديد</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold mt-2 pr-2 border-r-2 border-amber-500">
            سجل طلبات شحن لمنتجات خارجية بدون مخزون مسبق بشكل مباشر ومنظم.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {validationError && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-2xl font-black border-2 border-rose-200 dark:border-rose-900/40 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            ⚠️ {validationError}
          </div>
        )}

        {/* 1. Brand Section */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-5">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Store size={22} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 dark:text-white">بيانات البراند أو المورد (المرسل المطبوع)</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">ستتم طباعة بوليصة الشحن والفاتورة للعميل النهائي بهذا الاسم</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">اسم البراند / المتجر الخارجي *</label>
              <input
                type="text"
                required
                placeholder="مثال: متجر الأناقة لقطع الغيار"
                value={orderData.merchantBrandName || ""}
                onChange={(e) => handleFieldChange("merchantBrandName", e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">هاتف البراند (يُطبع كمرسل للتواصل)</label>
              <input
                type="text"
                placeholder="مثال: 01012345678"
                value={orderData.merchantBrandPhone || ""}
                onChange={(e) => handleFieldChange("merchantBrandPhone", e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold font-mono text-slate-800 dark:text-slate-100 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* 2. Customer Info Section */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-5">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <MapPin size={22} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 dark:text-white">بيانات المستلم (عميل المورد النهائي)</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">يرجى التحقق من أرقام الهواتف والمحافظة بدقة لضمان سرعة التوصيل</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">اسم المستلم بالكامل *</label>
              <input
                type="text"
                required
                placeholder="مثال: أحمد محمد علي"
                value={orderData.customerName}
                onChange={(e) => handleFieldChange("customerName", e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">رقم الهاتف الأساسي *</label>
              <input
                type="text"
                required
                placeholder="مثال: 01234567890"
                value={orderData.customerPhone}
                onChange={(e) => handleFieldChange("customerPhone", e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold font-mono text-slate-800 dark:text-slate-100 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">المحافظة</label>
              <select
                value={orderData.governorate}
                onChange={(e) => {
                  handleFieldChange("governorate", e.target.value);
                  handleFieldChange("city", "");
                }}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 cursor-pointer"
              >
                <option value="">اختر المحافظة...</option>
                {Object.keys(egyptCities).map((gov) => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">المدينة / المنطقة</label>
              <select
                value={orderData.city || ""}
                onChange={(e) => handleFieldChange("city", e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 cursor-pointer disabled:opacity-40"
                disabled={!orderData.governorate}
              >
                <option value="">اختر المدينة...</option>
                {orderData.governorate && egyptCities[orderData.governorate]?.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">رقم هاتف بديل (اختياري)</label>
              <input
                type="text"
                placeholder="مثال: 01512345678"
                value={orderData.customerPhone2 || ""}
                onChange={(e) => handleFieldChange("customerPhone2", e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold font-mono text-slate-800 dark:text-slate-100 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">العنوان التفصيلي (الشارع، العمارة، الشقة)</label>
              <input
                type="text"
                placeholder="مثال: 12 شارع أحمد عرابي - الدور الثالث - شقة 5"
                value={orderData.customerAddress}
                onChange={(e) => handleFieldChange("customerAddress", e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* 3. Items Section */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Package size={22} />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-800 dark:text-white">الأصناف والأسعار</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">أضف المنتجات المطلوبة مع تحديد سعر البيع للعميل وتكلفتها عليك</p>
              </div>
            </div>
            <button
              type="button"
              onClick={addEmptyItem}
              className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-550/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-emerald-200/50 dark:border-emerald-800/50 cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة صنف</span>
            </button>
          </div>

          <div className="space-y-4">
            {(orderData.items || []).length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold text-sm">
                📦 لم يتم إضافة أي أصناف بعد. اضغط على زر "إضافة صنف" للبدء.
              </div>
            ) : (
              (orderData.items || []).map((item, index) => (
                <div 
                  key={index} 
                  className="p-5 bg-slate-50 dark:bg-slate-800/40 border-2 border-slate-250 dark:border-slate-750 rounded-2xl flex flex-col md:flex-row items-end md:items-center gap-4 transition-all duration-200 hover:border-slate-350 dark:hover:border-slate-650"
                >
                  <div className="flex-1 w-full space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">اسم المنتج / الخدمة *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: دريل شحن AX 24 فولت"
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                  
                  <div className="w-full md:w-28 space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">سعر البيع (ج.م) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="0"
                      value={item.price}
                      onChange={(e) => updateItem(index, "price", parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500 transition-all text-center"
                    />
                  </div>

                  <div className="w-full md:w-28 space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">التكلفة (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.cost}
                      onChange={(e) => updateItem(index, "cost", parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black font-mono text-amber-600 dark:text-amber-400 outline-none focus:border-emerald-500 transition-all text-center"
                    />
                  </div>

                  <div className="w-full md:w-24 space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">الكمية</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black font-mono text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 transition-all text-center"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-3 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. Logistics & Financials Section */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-5">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <Truck size={22} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 dark:text-white">إعدادات الشحن والرسوم والخدمات</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">اختر شركة الشحن وتفاصيل الرسوم والخدمات الإضافية الملحقة بالشحنة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">شركة الشحن المطلوبة</label>
              <select
                value={orderData.shippingCompany}
                onChange={(e) => handleFieldChange("shippingCompany", e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 cursor-pointer"
              >
                {Object.keys(settings?.shippingOptions || {}).length > 0 ? (
                  Object.keys(settings.shippingOptions).map(co => (
                    <option key={co} value={co}>{co}</option>
                  ))
                ) : (
                  <option value="بوسطة">بوسطة</option>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">رسوم التوصيل (المحصلة من العميل)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={orderData.shippingFee}
                onChange={(e) => handleFieldChange("shippingFee", parseFloat(e.target.value) || 0)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-black font-mono text-purple-600 dark:text-purple-400 outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>هامش ربح إضافي مباشر (ج.م)</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">تطوير أو تعويض اختياري</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder="مثال: 150 (يضاف مباشرة للأرباح الصافية)"
                value={orderData.externalProfitMarkup || ""}
                onChange={(e) => handleFieldChange("externalProfitMarkup", parseFloat(e.target.value) || 0)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Premium Interactive Toggle Cards */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Insurance Option Card */}
              <div 
                onClick={() => handleFieldChange("isInsured", orderData.isInsured === false)}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-3 select-none ${
                  orderData.isInsured !== false 
                    ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-sm" 
                    : "bg-slate-50/40 dark:bg-slate-800/20 border-slate-200 dark:border-slate-750 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="font-extrabold text-sm text-slate-800 dark:text-white block">🛡️ تفعيل التأمين على الشحنة</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">لحماية الشحنة من التلف أو الفقد والتعويض التام</span>
                  </div>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    orderData.isInsured !== false ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-slate-600"
                  }`}>
                    {orderData.isInsured !== false && <span className="text-white text-xs font-black">✓</span>}
                  </div>
                </div>

                {orderData.isInsured !== false && settings?.insurancePackages && settings.insurancePackages.length > 0 && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="pt-3 border-t border-indigo-100 dark:border-indigo-900/60 space-y-1.5 animate-in slide-in-from-top-1 duration-200"
                  >
                    <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 block">
                      اختر باقة التأمين
                    </label>
                    <select
                      value={orderData.insurancePackageId || ""}
                      onChange={(e) => handleFieldChange("insurancePackageId", e.target.value || undefined)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold text-xs text-slate-850 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">-- الباقة الافتراضية للشركة --</option>
                      {settings.insurancePackages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} ({pkg.type === 'flat' ? `${pkg.value} ج.م` : `${pkg.value}%`})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Inspection Option Card */}
              <div 
                onClick={() => {
                  const val = orderData.includeInspectionFee === false;
                  handleFieldChange("includeInspectionFee", val);
                  handleFieldChange("allowOpenShipment", val);
                }}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-center gap-3 select-none ${
                  orderData.includeInspectionFee !== false 
                    ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-500 shadow-sm" 
                    : "bg-slate-50/40 dark:bg-slate-800/20 border-slate-200 dark:border-slate-750 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="font-extrabold text-sm text-slate-800 dark:text-white block">🔍 السماح بفتح الشحنة والمعاينة</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">تطبيق رسوم المعاينة والسماح للعميل بالفحص</span>
                  </div>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    orderData.includeInspectionFee !== false ? "bg-purple-600 border-purple-600" : "border-slate-300 dark:border-slate-600"
                  }`}>
                    {orderData.includeInspectionFee !== false && <span className="text-white text-xs font-black">✓</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">ملاحظات خاصة بالتسليم (أو داخلية للمندوب)</label>
              <textarea
                value={orderData.notes || ""}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                placeholder="اكتب أي ملاحظات للمندوب هنا (مثل: الاتصال قبل التسليم بنصف ساعة)"
                rows={2}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold outline-none focus:border-purple-500 resize-none"
              ></textarea>
            </div>
          </div>

          {/* Totals Preview Container */}
          {(() => {
            const itemsTotal = (orderData.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const totalCOD = itemsTotal + (orderData.shippingFee || 0);
            const costTotal = (orderData.items || []).reduce((sum, item) => sum + (item.cost * item.quantity), 0);
            
            const dummyOrder = {
               governorate: orderData.governorate,
               shippingCompany: orderData.shippingCompany,
               shippingFee: orderData.shippingFee,
               isInsured: orderData.isInsured,
               includeInspectionFee: orderData.includeInspectionFee,
               insurancePackageId: orderData.insurancePackageId,
               totalPrice: totalCOD,
               productPrice: itemsTotal,
               items: orderData.items,
               productCost: costTotal,
            } as Order;
            
            const actualShippingCost = getStandardShippingFee(dummyOrder, settings);
            const compFees = settings?.companySpecificFees?.[orderData.shippingCompany];
            const useCustom = compFees?.useCustomFees ?? false;
            
            const inspectionFee = (orderData.includeInspectionFee !== false) 
              ? (useCustom ? (compFees?.inspectionFee || 0) : (settings?.enableInspection ? settings.inspectionFee : 0)) 
              : 0;

            const insuranceRate = orderData.isInsured !== false
              ? (useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings?.enableInsurance ? settings.insuranceFeePercent : 0))
              : 0;

            const insuranceFee = calculateInsuranceFee(dummyOrder, insuranceRate, settings);
            const bostaVat = calculateBostaVat(dummyOrder, insuranceFee, settings);
            const codFee = calculateCodFee(dummyOrder, settings);

            const actualTotalFees = actualShippingCost + inspectionFee + insuranceFee + bostaVat + codFee;
            const shippingProfit = (orderData.shippingFee || 0) - actualTotalFees;
            
            const expectedProfit = itemsTotal - costTotal + shippingProfit + (Number(orderData.externalProfitMarkup) || 0);

            return (
              <div className="space-y-6 mt-6 pt-6 border-t-2 border-slate-200 dark:border-slate-850 animate-in fade-in duration-350">
                {/* Clear, elegant breakdown receipt */}
                <div className="p-6 bg-slate-50/80 dark:bg-slate-850/30 rounded-3xl border-2 border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="text-purple-600 dark:text-purple-400">📊</span>
                    <span>تفاصيل التكلفة ومصروفات شركة الشحن المقدرة ({orderData.shippingCompany})</span>
                  </h4>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 pt-2">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-1">شحن أساسي</span>
                      <span className="font-mono text-sm font-extrabold text-slate-800 dark:text-slate-200">{actualShippingCost.toLocaleString("ar-EG")} ج.م</span>
                    </div>
                    
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-1">رسوم المعاينة</span>
                      <span className={`font-mono text-sm font-extrabold ${inspectionFee > 0 ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`}>{inspectionFee > 0 ? `+${inspectionFee.toLocaleString("ar-EG")}` : "0"} ج.م</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-1">رسوم التأمين</span>
                      <span className={`font-mono text-sm font-extrabold ${insuranceFee > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>{insuranceFee > 0 ? `+${insuranceFee.toLocaleString("ar-EG")}` : "0"} ج.m</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-1">الضريبة (VAT)</span>
                      <span className={`font-mono text-sm font-extrabold ${bostaVat > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>{bostaVat > 0 ? `+${bostaVat.toLocaleString("ar-EG")}` : "0"} ج.م</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-1">رسوم الدفع (COD)</span>
                      <span className={`font-mono text-sm font-extrabold ${codFee > 0 ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`}>{codFee > 0 ? `+${codFee.toLocaleString("ar-EG")}` : "0"} ج.م</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-750 flex justify-between items-center px-2">
                    <span className="text-xs font-black text-slate-600 dark:text-slate-400">إجمالي مصروفات الشحن المستقطعة:</span>
                    <span className="font-mono text-base font-black text-slate-900 dark:text-white bg-slate-200/40 dark:bg-slate-800 px-3.5 py-1 rounded-xl">{actualTotalFees.toLocaleString("ar-EG")} ج.م</span>
                  </div>
                </div>

                {/* Overall Financial Invoice */}
                <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch justify-between gap-6">
                  <div className="flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-800 pb-4 md:pb-0 md:pl-6 space-y-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-black">إجمالي المنتجات المطلوبة</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-slate-800 dark:text-white">{itemsTotal}</span>
                      <span className="text-xs font-bold text-slate-400">ج.م</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">تكلفتها الإجمالية: {costTotal} ج.م</p>
                  </div>

                  <div className="flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-800 pb-4 md:pb-0 md:pl-6 space-y-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-black">إجمالي التحصيل من العميل (COD)</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">{totalCOD}</span>
                      <span className="text-xs font-bold text-amber-500">ج.م</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">يتضمن قيمة التوصيل: {orderData.shippingFee} ج.م</p>
                  </div>

                  <div className="flex-1 p-4 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.02] rounded-2xl border-2 border-emerald-500/20 flex flex-col justify-center space-y-2.5">
                    <span className="text-xs text-emerald-800 dark:text-emerald-400 font-black block">هامش الأرباح المقدرة للطلب</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">+{expectedProfit}</span>
                      <span className="text-xs font-black text-emerald-500">ج.م</span>
                    </div>
                    {shippingProfit !== 0 && (
                      <span className={`text-[10px] font-bold block px-2 py-0.5 rounded-lg border w-max ${
                        shippingProfit > 0 
                          ? 'text-emerald-700 bg-emerald-100/40 border-emerald-200/40 dark:text-emerald-300 dark:bg-emerald-950/20' 
                          : 'text-rose-700 bg-rose-100/40 border-rose-200/40 dark:text-rose-300 dark:bg-rose-950/20'
                      }`}>
                        {shippingProfit > 0 ? '🟢 يتضمن ربح شحن' : '🔴 يتضمن عجز شحن'} {Math.abs(shippingProfit)} ج.م
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Form Actions */}
        <div className="flex items-center gap-4 pt-6">
          <button
            type="submit"
            className="flex-1 py-4 sm:py-5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-lg shadow-amber-600/15 hover:shadow-amber-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>إنشاء الطلب وحفظه</span>
            <ArrowRightCircle size={20} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-4 sm:py-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-black rounded-2xl transition-all cursor-pointer active:scale-[0.99]"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
};

export default DropshippingOrderForm;
