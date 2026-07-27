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
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Package className="text-amber-500" />
            إنشاء طلب دروب شيبنج جديد
          </h2>
          <p className="text-sm text-slate-500 font-bold mt-1">
            تسجيل طلب لشحن منتجات خارجية (بدون مخزون) لحساب مورد أو براند.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {validationError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200">
          {validationError}
        </div>
      )}

      {/* Brand Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
            <Store size={20} />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-800 dark:text-white">تفاصيل براند المورد (الراسل المطبوع)</h3>
            <p className="text-xs text-slate-400">ستتم طباعة الفاتورة وبوليصة الشحن بهذا الاسم</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">اسم البراند / المتجر الخارجي *</label>
            <input
              type="text"
              required
              placeholder="مثال: متجر الأناقة"
              value={orderData.merchantBrandName || ""}
              onChange={(e) => handleFieldChange("merchantBrandName", e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">هاتف البراند (يُطبع كمرسل)</label>
            <input
              type="text"
              placeholder="مثال: 01012345678"
              value={orderData.merchantBrandPhone || ""}
              onChange={(e) => handleFieldChange("merchantBrandPhone", e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold font-mono outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Customer Info Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <MapPin size={20} />
          </div>
          <h3 className="font-black text-lg text-slate-800 dark:text-white">بيانات المستلم (عميل المورد)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">اسم المستلم *</label>
            <input
              type="text"
              required
              value={orderData.customerName}
              onChange={(e) => handleFieldChange("customerName", e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">رقم الهاتف *</label>
            <input
              type="text"
              required
              value={orderData.customerPhone}
              onChange={(e) => handleFieldChange("customerPhone", e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold font-mono outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">المحافظة</label>
            <select
              value={orderData.governorate}
              onChange={(e) => {
                handleFieldChange("governorate", e.target.value);
                // Reset city when governorate changes
                handleFieldChange("city", "");
              }}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
            >
              <option value="">اختر المحافظة...</option>
              {Object.keys(egyptCities).map((gov) => (
                <option key={gov} value={gov}>{gov}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">المدينة / المنطقة</label>
            <select
              value={orderData.city || ""}
              onChange={(e) => handleFieldChange("city", e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-blue-500 disabled:opacity-50"
              disabled={!orderData.governorate}
            >
              <option value="">اختر المدينة...</option>
              {orderData.governorate && egyptCities[orderData.governorate]?.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">هاتف بديل</label>
            <input
              type="text"
              value={orderData.customerPhone2 || ""}
              onChange={(e) => handleFieldChange("customerPhone2", e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold font-mono outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">العنوان التفصيلي</label>
            <input
              type="text"
              value={orderData.customerAddress}
              onChange={(e) => handleFieldChange("customerAddress", e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
              <Package size={20} />
            </div>
            <h3 className="font-black text-lg text-slate-800 dark:text-white">الأصناف والتكلفة</h3>
          </div>
          <button
            type="button"
            onClick={addEmptyItem}
            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-emerald-100"
          >
            <Plus size={16} /> إضافة صنف
          </button>
        </div>

        <div className="space-y-3">
          {(orderData.items || []).length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm font-bold">
              لم يتم إضافة أي أصناف بعد.
            </div>
          ) : (
            (orderData.items || []).map((item, index) => (
              <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">اسم المنتج / الخدمة</label>
                  <input
                    type="text"
                    required
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                
                <div className="w-full md:w-24 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">سعر البيع</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={item.price}
                    onChange={(e) => updateItem(index, "price", parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold font-mono outline-none focus:border-emerald-500 text-emerald-600"
                  />
                </div>

                <div className="w-full md:w-24 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">التكلفة</label>
                  <input
                    type="number"
                    min="0"
                    value={item.cost}
                    onChange={(e) => updateItem(index, "cost", parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold font-mono outline-none focus:border-emerald-500 text-amber-600"
                  />
                </div>

                <div className="w-full md:w-20 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">الكمية</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold font-mono outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-end pb-1">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Logistics & Financials Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
            <Truck size={20} />
          </div>
          <h3 className="font-black text-lg text-slate-800 dark:text-white">الشحن والماليات</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">شركة الشحن المطلوبة</label>
            <select
              value={orderData.shippingCompany}
              onChange={(e) => handleFieldChange("shippingCompany", e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-purple-500"
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

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">قيمة التوصيل (المطلوبة من العميل)</label>
            <input
              type="number"
              min="0"
              value={orderData.shippingFee}
              onChange={(e) => handleFieldChange("shippingFee", parseFloat(e.target.value) || 0)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold font-mono outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>هامش ربح إضافي مباشر (ج.م)</span>
              <span className="text-[10px] text-slate-400 font-normal">اختياري</span>
            </label>
            <input
              type="number"
              min="0"
              placeholder="مثال: 150"
              value={orderData.externalProfitMarkup || ""}
              onChange={(e) => handleFieldChange("externalProfitMarkup", parseFloat(e.target.value) || 0)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold font-mono outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-white block">التأمين على الشحنة</span>
                    <span className="text-[11px] text-slate-400 block">يتم حسابها حسب شركة الشحن</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={orderData.isInsured !== false}
                    onChange={(e) => handleFieldChange("isInsured", e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
                {orderData.isInsured !== false && settings?.insurancePackages && settings.insurancePackages.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                    <label className="text-[11px] font-extrabold text-slate-600 dark:text-slate-400 block">
                      باقة التأمين المحددة
                    </label>
                    <select
                      value={orderData.insurancePackageId || ""}
                      onChange={(e) => handleFieldChange("insurancePackageId", e.target.value || undefined)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-[11px] text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                      <option value="">-- الباقة الافتراضية --</option>
                      {settings.insurancePackages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} ({pkg.type === 'flat' ? `${pkg.value} ج.م` : `${pkg.value}%`})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-white block">السماح بفتح الشحنة</span>
                    <span className="text-[11px] text-slate-400 block">تطبيق رسوم المعاينة إن وجدت</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={orderData.includeInspectionFee !== false}
                    onChange={(e) => {
                      handleFieldChange("includeInspectionFee", e.target.checked);
                      handleFieldChange("allowOpenShipment", e.target.checked);
                    }}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1 md:col-span-2 mt-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">ملاحظات لشركة الشحن (أو داخلي)</label>
            <textarea
              value={orderData.notes || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              rows={2}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-purple-500 resize-none"
            ></textarea>
          </div>
        </div>

        {/* Totals Preview */}
        {(() => {
          const itemsTotal = (orderData.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const totalCOD = itemsTotal + (orderData.shippingFee || 0);
          const costTotal = (orderData.items || []).reduce((sum, item) => sum + (item.cost * item.quantity), 0);
          
          // Estimate actual shipping cost
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
            <div className="space-y-4 mt-4">
              {/* Detailed Cost Breakdown */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Truck size={14} className="text-purple-500" />
                  تفاصيل تكلفة الشحن المقدرة
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 block">شحن أساسي</span>
                    <span className="font-mono text-sm font-bold">{actualShippingCost.toLocaleString("ar-EG")} ج.م</span>
                  </div>
                  {inspectionFee > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 block">معاينة</span>
                      <span className="font-mono text-sm font-bold text-teal-600">+{inspectionFee.toLocaleString("ar-EG")} ج.م</span>
                    </div>
                  )}
                  {insuranceFee > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 block">تأمين</span>
                      <span className="font-mono text-sm font-bold text-indigo-600">+{insuranceFee.toLocaleString("ar-EG")} ج.م</span>
                    </div>
                  )}
                  {bostaVat > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 block">ضريبة (VAT)</span>
                      <span className="font-mono text-sm font-bold text-red-600">+{bostaVat.toLocaleString("ar-EG")} ج.م</span>
                    </div>
                  )}
                  {codFee > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 block">رسوم COD</span>
                      <span className="font-mono text-sm font-bold text-orange-600">+{codFee.toLocaleString("ar-EG")} ج.م</span>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">إجمالي التكلفة المقدرة</span>
                  <span className="font-mono text-sm font-black text-slate-800 dark:text-white">{actualTotalFees.toLocaleString("ar-EG")} ج.م</span>
                </div>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-500 font-bold block">إجمالي المنتجات</span>
                  <span className="text-lg font-black font-mono text-slate-800 dark:text-white">{itemsTotal} ج.م</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-bold block">الإجمالي المطلوب من العميل (COD)</span>
                  <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">{totalCOD} ج.م</span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold block">هامش الربح المتوقع</span>
                  <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">+{expectedProfit} ج.م</span>
                  {shippingProfit !== 0 && (
                    <span className={`text-[10px] block mt-1 ${shippingProfit > 0 ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-red-500/70 dark:text-red-400/70'}`}>
                      ({shippingProfit > 0 ? 'يتضمن ربح شحن' : 'يتضمن خسارة شحن'} {Math.abs(shippingProfit)} ج.م)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>إنشاء الطلب وحفظه</span>
          <ArrowRightCircle size={20} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 transition-all cursor-pointer"
        >
          إلغاء
        </button>
      </div>
      </form>
    </div>
  );
};

export default DropshippingOrderForm;
