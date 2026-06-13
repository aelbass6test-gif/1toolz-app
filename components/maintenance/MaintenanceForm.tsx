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
  ClipboardList
} from 'lucide-react';
import { MaintenanceRequest, MaintenancePart } from '../../types';

interface MaintenanceFormProps {
  initialData?: Partial<MaintenanceRequest>;
  onSubmit: (data: Partial<MaintenanceRequest>) => void;
  onCancel: () => void;
  settings: any;
}

const MaintenanceForm: React.FC<MaintenanceFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  settings
}) => {
  const [formData, setFormData] = useState<Partial<MaintenanceRequest>>({
    customerName: '',
    customerPhone: '',
    itemDescription: '',
    initialProblemDescription: '',
    status: 'received',
    priority: 'medium',
    parts: [],
    laborCost: 0,
    receivedDate: new Date().toISOString().split('T')[0],
    ...initialData
  });

  const [newPart, setNewPart] = useState<Partial<MaintenancePart>>({
    name: '',
    cost: 0,
    priceToCustomer: 0,
  });

  const handleFieldChange = (field: keyof MaintenanceRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    const shipping = Number(formData.shippingFee) || 0;
    return {
      total: partsTotal + labor + shipping,
      cost: partsCost + labor,
      profit: (partsTotal + labor) - (partsCost + labor)
    };
  }, [formData.parts, formData.laborCost, formData.shippingFee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, totalCost: totals.total });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-w-4xl mx-auto w-full"
      dir="rtl"
    >
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <Wrench size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">
              {initialData?.id ? 'تعديل طلب صيانة' : 'إنشاء طلب صيانة جديد'}
            </h2>
            <p className="text-slate-500 text-sm font-bold mt-0.5">إدارة فنية شاملة للمنتج والتكاليف</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-3 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-2xl transition-colors">
          <X className="text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Customer Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <User size={18} />
              <h3 className="font-black text-sm uppercase tracking-wider">بيانات العميل</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-1">اسم العميل</label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    required
                    type="text"
                    value={formData.customerName}
                    onChange={e => handleFieldChange('customerName', e.target.value)}
                    className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold"
                    placeholder="الاسم الكامل للعميل"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-1">رقم الهاتف</label>
                <div className="relative">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    required
                    type="tel"
                    value={formData.customerPhone}
                    onChange={e => handleFieldChange('customerPhone', e.target.value)}
                    className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold"
                    placeholder="01xxxxxxxxx"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Product Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Package size={18} />
              <h3 className="font-black text-sm uppercase tracking-wider">بيانات المنتج</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-1">وصف المنتج</label>
                <input
                  required
                  type="text"
                  value={formData.itemDescription}
                  onChange={e => handleFieldChange('itemDescription', e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold"
                  placeholder="مثال: غسالة توشيبا، خلاط مولينكس..."
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-1">السيريال نمبر (إن وجد)</label>
                <div className="relative">
                  <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={formData.itemSerial}
                    onChange={e => handleFieldChange('itemSerial', e.target.value)}
                    className="w-full pr-10 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold"
                    placeholder="S/N: xxxxxxxx"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-1">القيمة التقديرية للمنتج (للتأمين)</label>
                <div className="relative">
                  <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="number"
                    value={formData.itemValue || ''}
                    onChange={e => handleFieldChange('itemValue', Number(e.target.value))}
                    className="w-full pr-10 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all font-bold"
                    placeholder="قيمة المنتج"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Problem Description */}
        <div className="mt-8">
          <label className="block text-xs font-black text-slate-400 mb-2 mr-1">وصف العطل الأساسي</label>
          <textarea
            required
            value={formData.initialProblemDescription}
            onChange={e => handleFieldChange('initialProblemDescription', e.target.value)}
            className="w-full p-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-red-500 rounded-3xl outline-none transition-all font-bold h-32 resize-none"
            placeholder="اشرح العطل كما وصفه العميل..."
          />
        </div>

        {/* Status & Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
           <div>
             <label className="block text-xs font-black text-slate-400 mb-3 mr-1">الحالة الحالية</label>
             <div className="flex flex-wrap gap-2">
                {[
                  { id: 'received', label: 'تم إنشاء طلب', color: 'bg-slate-100 text-slate-600' },
                  { id: 'inspecting', label: 'قيد الفحص', color: 'bg-blue-100 text-blue-600' },
                  { id: 'waiting_for_parts', label: 'انتظار قطع غيار', color: 'bg-amber-100 text-amber-600' },
                  { id: 'in_repair', label: 'قيد الإصلاح', color: 'bg-indigo-100 text-indigo-600' },
                  { id: 'ready', label: 'جاهز للاستلام', color: 'bg-emerald-100 text-emerald-600' },
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleFieldChange('status', s.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                        formData.status === s.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
             </div>
           </div>

           <div>
              <label className="block text-xs font-black text-slate-400 mb-3 mr-1">الأولوية</label>
              <div className="flex gap-2">
                {[
                  { id: 'low', label: 'منخفضة', color: 'bg-slate-100' },
                  { id: 'medium', label: 'متوسطة', color: 'bg-blue-100' },
                  { id: 'high', label: 'عالية', color: 'bg-amber-100' },
                  { id: 'urgent', label: 'طارئ', color: 'bg-red-100' },
                ].map(p => (
                   <button
                    key={p.id}
                    type="button"
                    onClick={() => handleFieldChange('priority', p.id)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                        formData.priority === p.id 
                        ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-lg' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
           </div>
        </div>

        {/* Parts Section */}
        <div className="mt-12 bg-slate-50 dark:bg-slate-900/40 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white">قطع الغيار المستخدمة</h3>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="md:col-span-2">
                <input
                  type="text"
                  value={newPart.name}
                  onChange={e => setNewPart(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="اسم القطعة (مثال: ماتور، حساس...)"
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none font-bold text-sm"
                />
              </div>
              <div>
                <input
                  type="number"
                  value={newPart.cost || ''}
                  onChange={e => setNewPart(prev => ({ ...prev, cost: Number(e.target.value) }))}
                  placeholder="تكلفة الشراء"
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none font-bold text-sm text-center"
                />
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={newPart.priceToCustomer || ''}
                  onChange={e => setNewPart(prev => ({ ...prev, priceToCustomer: Number(e.target.value) }))}
                  placeholder="سعر البيع"
                  className="w-full px-4 py-3.5 bg-emerald-50 dark:bg-emerald-500/10 border-2 border-transparent focus:border-emerald-500 rounded-xl outline-none font-black text-sm text-center text-emerald-600"
                />
                <button
                  type="button"
                  onClick={addPart}
                  className="absolute -left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
           </div>

           <div className="space-y-3">
              <AnimatePresence>
                {formData.parts?.map((part) => (
                  <motion.div
                    key={part.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 group hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-500 font-bold text-xs">
                        {part.name.charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{part.name}</span>
                    </div>
                    <div className="flex items-center gap-8">
                       <div className="text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase">البيع للعميل</p>
                          <p className="font-black text-emerald-600">{part.priceToCustomer} ج.م</p>
                       </div>
                       <div className="text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase">التكلفة</p>
                          <p className="font-bold text-slate-400">{part.cost} ج.م</p>
                       </div>
                       <button
                        type="button"
                        onClick={() => removePart(part.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                       >
                        <Trash2 size={16} />
                       </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
           </div>
        </div>

        {/* Financial Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-1">مصنعية الفني</label>
                <div className="relative">
                  <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="number"
                    value={formData.laborCost || ''}
                    onChange={e => handleFieldChange('laborCost', Number(e.target.value))}
                    className="w-full pr-10 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-black"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-1">اسم الفني المسؤول</label>
                <input
                  type="text"
                  value={formData.technicianName}
                  onChange={e => handleFieldChange('technicianName', e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold"
                  placeholder="اسم الفني"
                />
              </div>
           </div>

           <div className="bg-slate-800 dark:bg-slate-950 p-8 rounded-[2.5rem] text-white flex flex-col justify-center gap-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-slate-400 font-bold">إجمالي قطع الغيار:</span>
                <span className="font-black">{(formData.parts || []).reduce((sum, p) => sum + p.priceToCustomer, 0)} ج.م</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-slate-400 font-bold">مصنعية الصيانة:</span>
                <span className="font-black">{formData.laborCost || 0} ج.م</span>
              </div>
              <div className="flex justify-between items-end">
                 <div>
                   <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">صافي الربح المتوقع</p>
                   <p className="text-2xl font-black text-emerald-400">+{totals.profit} ج.م</p>
                 </div>
                 <div className="text-left">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">الإجمالي المطلوب</p>
                   <p className="text-4xl font-black text-white">{totals.total} <span className="text-sm">ج.م</span></p>
                 </div>
              </div>
           </div>
        </div>

        <div className="mt-8">
           <label className="block text-xs font-black text-slate-400 mb-2 mr-1">تقرير الصيانة الفني (يحدث دورياً)</label>
           <textarea
             value={formData.technicalReport}
             onChange={e => handleFieldChange('technicalReport', e.target.value)}
             className="w-full p-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-3xl outline-none transition-all font-bold h-24 resize-none text-sm"
             placeholder="اكتب ما تم تم فحصه أو إصلاحه..."
           />
        </div>

        <div className="mt-12 flex gap-4">
           <button
             type="submit"
             className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98]"
           >
             <Save size={24} />
             حفظ بيانات الصيانة
           </button>
           <button
             type="button"
             onClick={onCancel}
             className="px-10 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-5 rounded-2xl font-black transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
           >
             إلغاء
           </button>
        </div>
      </form>
    </motion.div>
  );
};

export default MaintenanceForm;
