import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  User, 
  Phone, 
  MapPin, 
  Hash, 
  AlertCircle, 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  X,
  Package,
  Calendar,
  DollarSign,
  ClipboardList,
  Truck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Info
} from 'lucide-react';
import { MaintenanceRequest, MaintenancePart } from '../../types';

interface MaintenanceFormProps {
  initialData?: Partial<MaintenanceRequest>;
  onSubmit: (data: Partial<MaintenanceRequest>) => void;
  onCancel: () => void;
  settings: any;
  customers?: any[];
  products?: any[];
  treasury?: any;
}

const MaintenanceForm: React.FC<MaintenanceFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  settings,
  customers = [],
  products = [],
  treasury
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<MaintenanceRequest>>({
    customerName: '',
    customerPhone: '',
    itemDescription: '',
    itemSerial: '',
    itemValue: 0,
    initialProblemDescription: '',
    status: 'received',
    priority: 'medium',
    parts: [],
    laborCost: 0,
    shippingStatus: 'none',
    shippingCompany: '',
    shippingTrackingNumber: '',
    shippingCostToShop: 0,
    shippingCostToCustomer: 0,
    shippingPaymentMethod: 'cash',
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    treasuryAccountId: treasury?.accounts?.[0]?.id || '1',
    financialLogged: false,
    receivedDate: new Date().toISOString().split('T')[0],
    technicalReport: '',
    technicianName: '',
    commissionType: 'fixed',
    commissionValue: undefined,
    ...initialData
  });

  const [newPart, setNewPart] = useState<Partial<MaintenancePart>>({
    name: '',
    cost: 0,
    priceToCustomer: 0,
  });

  // Dynamically find selected customer's profile
  const selectedCustomer = useMemo(() => {
    if (!formData.customerPhone) return null;
    const phoneClean = formData.customerPhone.trim();
    return customers.find(c => c.phone?.trim() === phoneClean || c.name === formData.customerName);
  }, [formData.customerPhone, formData.customerName, customers]);

  const isStoreProductSelected = useMemo(() => {
    if (!newPart.name) return false;
    return products.some((p: any) => p.name?.trim().toLowerCase() === newPart.name?.trim().toLowerCase());
  }, [newPart.name, products]);

  const handleFieldChange = (field: keyof MaintenanceRequest, value: any) => {
    setFormData(prev => {
      const updates: any = { [field]: value };
      
      // Auto-fill customer data
      if (field === 'customerName') {
        const found = customers.find(c => c.name === value);
        if (found) updates.customerPhone = found.phone;
      } else if (field === 'customerPhone') {
        const found = customers.find(c => c.phone === value);
        if (found) updates.customerName = found.name;
      }
      
      return { ...prev, ...updates };
    });
  };

  const addPart = () => {
    if (!newPart.name) return;
    const part: MaintenancePart = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPart.name!,
      cost: Number(newPart.cost) || 0,
      priceToCustomer: Number(newPart.priceToCustomer) || 0,
      purchaseDate: new Date().toISOString().split('T')[0],
    };
    setFormData(prev => ({
      ...prev,
      parts: [...(prev.parts || []), part]
    }));
    setNewPart({ name: '', cost: 0, priceToCustomer: 0 });
  };

  const removePart = (id: string) => {
    setFormData(prev => ({
      ...prev,
      parts: (prev.parts || []).filter(p => p.id !== id)
    }));
  };

  const totals = useMemo(() => {
    const partsTotal = (formData.parts || []).reduce((sum, p) => sum + p.priceToCustomer, 0);
    const partsCost = (formData.parts || []).reduce((sum, p) => sum + p.cost, 0);
    const labor = Number(formData.laborCost) || 0;
    const shipping = Number(formData.shippingCostToCustomer || formData.shippingFee || 0);
    const shopShipping = Number(formData.shippingCostToShop || 0);
    return {
      total: partsTotal + labor + shipping,
      cost: partsCost + labor + shopShipping,
      profit: (partsTotal + labor + shipping) - (partsCost + labor + shopShipping)
    };
  }, [formData.parts, formData.laborCost, formData.shippingFee, formData.shippingCostToCustomer, formData.shippingCostToShop]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, totalCost: totals.total, shippingFee: formData.shippingCostToCustomer });
  };

  const stepsList = [
    { id: 1, title: 'العميل والجهاز', description: 'تفاصيل العميل والمنتج' },
    { id: 2, title: 'العطل والتشخيص', description: 'وصف العيب والأولوية' },
    { id: 3, title: 'قطع الغيار والتكاليف', description: 'المستلزمات ومصنعية الورشة' },
    { id: 4, title: 'الشحن والتسوية', description: 'طريقة الدفع والتسليم' }
  ];

  const canGoNext = () => {
    if (currentStep === 1) {
      return !!formData.customerName && !!formData.customerPhone && !!formData.itemDescription;
    }
    if (currentStep === 2) {
      return !!formData.initialProblemDescription;
    }
    return true;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-w-4xl mx-auto w-full flex flex-col"
      dir="rtl"
    >
      {/* Top Banner Header */}
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <Wrench className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-850 dark:text-white flex items-center gap-2">
              {initialData?.id ? 'تعديل طلب صيانة قائم' : 'مساعد الصيانة الذكي'}
              <span className="text-xs font-black bg-blue-100 dark:bg-blue-900/40 text-blue-600 px-3 py-1 rounded-full">
                {initialData?.id ? `#${formData.orderNumber}` : 'طلب جديد'}
              </span>
            </h2>
            <p className="text-slate-500 text-sm font-bold mt-1">
              {initialData?.id ? 'قم بتحديث دورة الصيانة والتسويات المالية' : 'مساعد تفاعلي خطوة بخطوة لتسجيل الأجهزة ومتابعتها بسهولة'}
            </p>
          </div>
        </div>
        <button 
          type="button"
          onClick={onCancel} 
          className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-all cursor-pointer text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Modern Stepper Indicator */}
      <div className="bg-slate-50/30 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800/80 p-6">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          {stepsList.map((step, idx) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            return (
              <React.Fragment key={step.id}>
                <div 
                  onClick={() => {
                    // Only allow clicking already accessible steps for safety
                    if (step.id < currentStep || canGoNext() || step.id <= currentStep) {
                      setCurrentStep(step.id);
                    }
                  }}
                  className={`flex items-center gap-3 flex-1 cursor-pointer transition-all p-2 rounded-2xl ${
                    isActive ? 'bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/60 dark:border-blue-900/20' : ''
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black transition-all ${
                    isCompleted 
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                      : isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-110' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black leading-none ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold hidden md:block">
                      {step.description}
                    </p>
                  </div>
                </div>
                {idx < stepsList.length - 1 && (
                  <div className="hidden md:block w-8 h-0.5 bg-slate-200 dark:bg-slate-800 shrink-0 self-center" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
        {/* Form Body with Transitions */}
        <div className="p-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2.5 text-blue-600 mb-2">
                  <User className="w-5 h-5" />
                  <h3 className="font-black text-sm uppercase tracking-wider">بيانات العميل والجهاز المستلم</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Autocompletes */}
                  <datalist id="m-customers-names">
                    {customers.map((c, i) => <option key={i} value={c.name} />)}
                  </datalist>
                  <datalist id="m-customers-phones">
                    {customers.map((c, i) => <option key={i} value={c.phone} />)}
                  </datalist>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 mr-1">اسم العميل بالكامل <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        required
                        type="text"
                        list="m-customers-names"
                        value={formData.customerName}
                        onChange={e => handleFieldChange('customerName', e.target.value)}
                        className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold"
                        placeholder="الاسم الثلاثي أو الثنائي للعميل"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 mr-1">رقم الهاتف النشط <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        required
                        type="tel"
                        list="m-customers-phones"
                        value={formData.customerPhone}
                        onChange={e => handleFieldChange('customerPhone', e.target.value)}
                        className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold"
                        placeholder="01xxxxxxxxx"
                      />
                    </div>
                  </div>
                </div>

                {/* Outstanding Debt Warning */}
                {selectedCustomer && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-5 rounded-2xl border transition-all ${
                      selectedCustomer.debtBalance && Number(selectedCustomer.debtBalance) > 0 
                        ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400' 
                        : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {selectedCustomer.debtBalance && Number(selectedCustomer.debtBalance) > 0 ? (
                      <div className="flex gap-3">
                        <AlertCircle size={22} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-black text-rose-800 dark:text-rose-300">ملاحظة هامة: توجد مديونية مستحقة لهذا العميل!</h4>
                          <p className="text-xs font-bold text-rose-700 dark:text-rose-400 mt-1 leading-relaxed">
                            هذا العميل لديه مديونية معلقة سابقة بقيمة <span className="underline decoration-2 text-base font-black">{Number(selectedCustomer.debtBalance).toLocaleString()} ج.م</span>. يرجى توجيه تنبيه له بضرورة تصفية الحساب أثناء الاستلام.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        <span className="text-xs font-black">حساب العميل ممتاز: لا توجد أي مديونيات سابقة معلقة (0 ج.م).</span>
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800/60 pt-6">
                  <div className="flex items-center gap-2.5 text-indigo-600 mb-4">
                    <Package className="w-5 h-5" />
                    <h3 className="font-black text-sm uppercase tracking-wider">تفاصيل الجهاز أو المنتج</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">وصف ونوع الجهاز المستلم <span className="text-red-500">*</span></label>
                      <input
                        required
                        type="text"
                        value={formData.itemDescription}
                        onChange={e => handleFieldChange('itemDescription', e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold"
                        placeholder="مثال: آيفون 13 برو أزرق، خلاط براون 800 وات..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">تاريخ الاستلام</label>
                      <input
                        type="date"
                        value={formData.receivedDate}
                        onChange={e => handleFieldChange('receivedDate', e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">الرقم التسلسلي (S/N) إن وجد</label>
                      <div className="relative">
                        <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          value={formData.itemSerial}
                          onChange={e => handleFieldChange('itemSerial', e.target.value)}
                          className="w-full pr-10 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold"
                          placeholder="مثال: SN-9283749"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">القيمة التقديرية (للتأمين/الحفظ)</label>
                      <div className="relative">
                        <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="number"
                          value={formData.itemValue || ''}
                          onChange={e => handleFieldChange('itemValue', Number(e.target.value))}
                          className="w-full pr-10 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-black"
                          placeholder="تأمين ضد التلف أو الفقد"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">توجيه صيانة إلى الفني</label>
                      <select
                        value={formData.technicianName || ''}
                        onChange={e => handleFieldChange('technicianName', e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-sm text-right"
                      >
                        <option value="">-- اختر فني الصيانة المسؤول --</option>
                        {(settings?.staffMembers || []).map((s: any) => (
                          <option key={s.id} value={s.name}>{s.name} ({s.position || 'فني'})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2.5 text-rose-600 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <h3 className="font-black text-sm uppercase tracking-wider">تشخيص المشكلة وتحديد الأولوية</h3>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 mr-1">وصف العيب والمشكلة الأساسية <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    value={formData.initialProblemDescription}
                    onChange={e => handleFieldChange('initialProblemDescription', e.target.value)}
                    className="w-full p-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-rose-500 rounded-3xl outline-none transition-all font-bold h-36 resize-none leading-relaxed text-sm"
                    placeholder="اكتب بالتفصيل العيوب التي يشتكي منها العميل والمشاكل الظاهرة..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-3">
                    <label className="block text-xs font-black text-slate-400 mr-1">أولوية وتصنيف سرعة الإصلاح</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'low', label: '🟢 منخفضة (عادي)', desc: 'خلال ٥ أيام' },
                        { id: 'medium', label: '🔵 متوسطة (متوسط)', desc: 'خلال ٣ أيام' },
                        { id: 'high', label: '🟡 عالية (عاجل)', desc: 'خلال ٢٤ ساعة' },
                        { id: 'urgent', label: '🔴 طارئ جداً', desc: 'إصلاح فوري' },
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleFieldChange('priority', p.id)}
                          className={`p-4 rounded-2xl text-right transition-all border-2 flex flex-col justify-between cursor-pointer ${
                            formData.priority === p.id 
                              ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-800 dark:border-slate-700' 
                              : 'bg-slate-50 dark:bg-slate-850 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <span className="font-black text-sm">{p.label}</span>
                          <span className={`text-[10px] mt-1 font-bold ${formData.priority === p.id ? 'text-slate-300' : 'text-slate-400'}`}>{p.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/30 p-6 rounded-3xl">
                      <div className="flex gap-3">
                        <Info className="text-blue-600 dark:text-blue-400 shrink-0 w-5 h-5 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-black text-blue-800 dark:text-blue-300 mb-1">خطوات دورة الصيانة السلسة:</h4>
                          <ul className="text-[11px] text-blue-700 dark:text-blue-400/80 space-y-1.5 list-disc list-inside font-bold leading-relaxed">
                            <li>تأكد من كتابة الرقم التسلسلي لتوثيق ملكية قطع الجهاز الأصلية.</li>
                            <li>سيقوم النظام تلقائياً بإنشاء رمز كودي صيانة مميز للطلب للبحث والمتابعة.</li>
                            <li>تلقائياً عند وضع حالة "جاهز للاستلام" سيتم موازنة الحساب المالي لقطع الغيار والمصنعية في دفاترك.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2.5 text-emerald-600 mb-2">
                  <Settings className="w-5 h-5" />
                  <h3 className="font-black text-sm uppercase tracking-wider">قطع الغيار، المصنعيات والربحية</h3>
                </div>

                {/* Add Part Section */}
                <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black text-slate-500 mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-500" />
                    إضافة قطع غيار مستهلكة من المتجر أو مخصصة
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block mr-1">اسم القطعة أو المنتج</span>
                      <datalist id="m-products-list">
                        {products.map((p, i) => <option key={i} value={p.name} />)}
                      </datalist>
                      <input
                        type="text"
                        list="m-products-list"
                        value={newPart.name}
                        onChange={e => {
                          const val = e.target.value;
                          const foundProd = products.find(p => p.name === val);
                          setNewPart(prev => ({
                            ...prev,
                            name: val,
                            ...(foundProd ? { cost: foundProd.cost || 0, priceToCustomer: foundProd.price || 0 } : {})
                          }));
                        }}
                        placeholder="اختر من المنتجات أو اكتب اسماً حراً..."
                        className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block mr-1">
                        {isStoreProductSelected ? 'سعر التكلفة (تلقائي من المخزن)' : 'سعر الشراء (التكلفة)'}
                      </span>
                      <input
                        type="number"
                        disabled={isStoreProductSelected}
                        value={newPart.cost || ''}
                        onChange={e => setNewPart(prev => ({ ...prev, cost: Number(e.target.value) }))}
                        placeholder="0"
                        className={`w-full px-4 py-3.5 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none font-bold text-sm text-center ${
                          isStoreProductSelected 
                            ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed' 
                            : 'bg-white dark:bg-slate-800'
                        }`}
                        title={isStoreProductSelected ? 'هذه القطعة متوفرة بالمتجر، يتم تحديد تكلفتها تلقائياً ولا يتم تكرار سحب تكلفتها كشراء نقدي جديد' : ''}
                      />
                    </div>
                    <div className="space-y-1 relative">
                      <span className="text-[10px] text-slate-400 font-bold block mr-1">سعر البيع للعميل</span>
                      <input
                        type="number"
                        value={newPart.priceToCustomer || ''}
                        onChange={e => setNewPart(prev => ({ ...prev, priceToCustomer: Number(e.target.value) }))}
                        placeholder="0"
                        className="w-full px-4 py-3.5 bg-emerald-50 dark:bg-emerald-500/10 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none font-black text-sm text-center text-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={addPart}
                        className="absolute -left-1 top-[30px] w-11 h-11 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="إضافة القطعة للقائمة"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Parts List */}
                {formData.parts && formData.parts.length > 0 ? (
                  <div className="space-y-3">
                    <h5 className="text-xs font-black text-slate-400 mr-1 uppercase tracking-wider">قائمة قطع الغيار الحالية ({formData.parts.length})</h5>
                    <div className="max-h-44 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                      {formData.parts.map((part) => (
                        <div
                          key={part.id}
                          className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-850 group hover:border-emerald-500/20 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl flex items-center justify-center font-black text-xs">
                              {part.name.charAt(0)}
                            </div>
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{part.name}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-left">
                              <p className="text-[9px] font-bold text-slate-400">للعميل</p>
                              <p className="font-black text-emerald-600 text-xs">{part.priceToCustomer} ج.م</p>
                            </div>
                            <div className="text-left">
                              <p className="text-[9px] font-bold text-slate-400">التكلفة</p>
                              <p className="font-bold text-slate-500 text-xs">{part.cost} ج.م</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePart(part.id)}
                              className="p-2 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400 text-xs font-bold">
                    لم يتم إضافة قطع غيار لهذا الطلب حتى الآن. يمكنك تخطي هذه الخطوة إذا كانت الصيانة خدمة مصنعية فقط.
                  </div>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800/60 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Labor Cost */}
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">تكلفة المصنعية أو اليد (أرباح المحل الفنية)</label>
                      <div className="relative">
                        <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="number"
                          value={formData.laborCost || ''}
                          onChange={e => handleFieldChange('laborCost', Number(e.target.value))}
                          className="w-full pr-10 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-black text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Technician Commission */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-400 mr-1">عمولة الفني</label>
                        <select
                          value={formData.commissionType || 'fixed'}
                          onChange={e => handleFieldChange('commissionType', e.target.value)}
                          className="w-full px-3 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold text-xs text-right"
                        >
                          <option value="fixed">ثابتة (ج.م)</option>
                          <option value="percentage">نسبة مئوية (%)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-400 mr-1">قيمة العمولة</label>
                        <input
                          type="number"
                          value={formData.commissionValue !== undefined ? formData.commissionValue : ''}
                          onChange={e => handleFieldChange('commissionValue', Number(e.target.value))}
                          className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-black text-center text-sm"
                          placeholder="الكل"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profit Box */}
                <div className="bg-slate-900 text-white rounded-[2rem] p-6 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  <div>
                    <h5 className="text-[10px] uppercase tracking-wider font-black text-slate-400">الحسبة المالية للربحية المتوقعة:</h5>
                    <div className="flex gap-4 mt-2">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold">إجمالي التكلفة للمحل</p>
                        <p className="text-sm font-black text-rose-400">{totals.cost} ج.م</p>
                      </div>
                      <div className="w-px h-8 bg-slate-800 self-center" />
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold">الربح الصافي المستهدف</p>
                        <p className="text-sm font-black text-emerald-400">+{totals.profit} ج.م</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-left md:text-left self-end md:self-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">السعر الإجمالي المطلوب من العميل</span>
                    <span className="text-3xl font-black text-white">{totals.total} <span className="text-xs font-bold text-slate-400">ج.م</span></span>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2.5 text-indigo-600 mb-2">
                  <Truck className="w-5 h-5" />
                  <h3 className="font-black text-sm uppercase tracking-wider">الشحن والتسوية المالية النهائية</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Delivery / Shipping Method */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 mr-1">حالة الشحن والتسليم</label>
                    <select
                      value={formData.shippingStatus || 'none'}
                      onChange={e => {
                        const sVal = e.target.value;
                        handleFieldChange('shippingStatus', sVal);
                        if (sVal === 'delivered') {
                          handleFieldChange('status', 'delivered');
                        } else if (sVal === 'received_at_shop') {
                          handleFieldChange('status', 'inspecting');
                        }
                      }}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-sm text-right"
                    >
                      <option value="none">استلام يدوي بالورشة (بدون شحن)</option>
                      <option value="pickup_requested">تم طلب سحب المنتج من العميل (تحت الشحن للمحل)</option>
                      <option value="picked_up">تم استلام المنتج بواسطة شركة الشحن</option>
                      <option value="received_at_shop">تم استلام المنتج بالورشة / المحل</option>
                      <option value="ready_for_shipping">تم الإصلاح - جاهز للشحن للتسليم</option>
                      <option value="shipped_to_customer">جار الشحن والتوصيل للعميل</option>
                      <option value="delivered">تم التسليم والتحصيل بنجاح</option>
                      <option value="returned_without_repair">مرتجع للعميل بدون إصلاح</option>
                    </select>
                  </div>

                  {/* Shipping Company */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 mr-1">شركة الشحن أو المندوب (إن وجد)</label>
                    <input
                      type="text"
                      value={formData.shippingCompany || ''}
                      onChange={e => handleFieldChange('shippingCompany', e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-sm"
                      placeholder="مثال: بوسطة، مندوب الصيانة..."
                    />
                  </div>

                  {/* Shipping Tracking Number */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 mr-1">رقم البوليصة أو التتبع</label>
                    <input
                      type="text"
                      value={formData.shippingTrackingNumber || ''}
                      onChange={e => handleFieldChange('shippingTrackingNumber', e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-sm"
                      placeholder="أدخل رقم التتبع للشحن"
                    />
                  </div>

                  {/* Shipping Costs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">الشحن (على المحل)</label>
                      <input
                        type="number"
                        value={formData.shippingCostToShop || ''}
                        onChange={e => handleFieldChange('shippingCostToShop', Number(e.target.value))}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-black text-center text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">الشحن / قيمة السحب (على العميل)</label>
                      <input
                        type="number"
                        value={formData.shippingCostToCustomer || ''}
                        onChange={e => handleFieldChange('shippingCostToCustomer', Number(e.target.value))}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-black text-center text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Shipping Payment Method Selector */}
                  {Number(formData.shippingCostToCustomer || 0) > 0 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">طريقة تسوية تكلفة الشحن (كاش أو آجل كدين)</label>
                      <select
                        value={formData.shippingPaymentMethod || 'cash'}
                        onChange={e => handleFieldChange('shippingPaymentMethod', e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold text-sm text-right"
                      >
                        <option value="cash">💵 دفع نقدي (كاش في الخزينة)</option>
                        <option value="add_to_debt">⏳ آجل (تضاف كدين على العميل وتدخل في حسابه)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800/60 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Payment Method */}
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400 mr-1">طريقة تسوية الدفع الفنية</label>
                      <select
                        value={formData.paymentMethod || 'cash'}
                        onChange={e => {
                          const method = e.target.value;
                          handleFieldChange('paymentMethod', method);
                          if (method === 'add_to_debt') {
                            handleFieldChange('paymentStatus', 'unpaid');
                          } else {
                            handleFieldChange('paymentStatus', 'paid');
                          }
                        }}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold text-sm text-right"
                      >
                        <option value="cash">💵 دفع نقدي (كاش في الخزينة)</option>
                        <option value="wallet">📱 محفظة إلكترونية (فودافون كاش أو مشابه)</option>
                        <option value="bank">🏦 تحويل بنكي مباشر</option>
                        <option value="add_to_debt">⏳ إضافة آجل على حساب مديونية العميل</option>
                      </select>
                    </div>

                    {/* Treasury Account Target */}
                    {formData.paymentMethod !== 'add_to_debt' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-400 mr-1">الحساب المالي لإيداع التحصيل</label>
                        <select
                          value={formData.treasuryAccountId || (treasury?.accounts?.[0]?.id || '1')}
                          onChange={e => handleFieldChange('treasuryAccountId', e.target.value)}
                          className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold text-sm text-right"
                        >
                          {(treasury?.accounts || [
                            { id: '1', name: 'الخزينة الرئيسية', balance: 0 },
                            { id: '2', name: 'فودافون كاش', balance: 0 },
                            { id: '3', name: 'الحساب البنكي', balance: 0 }
                          ]).map((acc: any) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} (الرصيد الحالي: {Number(acc.balance || 0).toLocaleString()} ج.م)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Technical / Operations Report */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-black text-slate-400 mr-1">التقرير الفني وتحديثات الصيانة للعميل (سجل الورشة)</label>
                  <textarea
                    value={formData.technicalReport || ''}
                    onChange={e => handleFieldChange('technicalReport', e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl outline-none transition-all font-bold h-20 resize-none text-xs leading-relaxed"
                    placeholder="مثال: تم فحص البوردة وتغيير مكثف الطاقة واختبار عمل الموتور بنجاح..."
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-4">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="px-6 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <ArrowRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              disabled={!canGoNext()}
              onClick={() => {
                if (canGoNext()) setCurrentStep(prev => prev + 1);
              }}
              className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                canGoNext()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-850 cursor-not-allowed'
              }`}
            >
              <span>الخطوة التالية</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              className="flex-1 bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xl shadow-emerald-500/10 active:scale-[0.98]"
            >
              <Save className="w-5 h-5" />
              <span>حفظ طلب وإرسال للصيانة</span>
            </button>
          )}
        </div>
      </form>
    </motion.div>
  );
};

export default MaintenanceForm;
