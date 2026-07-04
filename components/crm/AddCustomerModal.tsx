import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Phone, MapPin, Tag, DollarSign, Star, FileText, Plus, Check } from 'lucide-react';
import { CustomerProfile } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (phone: string, updates: Partial<CustomerProfile>) => void;
}

const COMMON_TAGS = [
  'عميل VIP',
  'عميل جملة',
  'دفع عند الاستلام',
  'توصيل سريع',
  'عميل دائم',
  'توصيل مسائي',
  'يفضل الاتصال',
  'يحتاج متابعة'
];

export const AddCustomerModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [debtBalance, setDebtBalance] = useState<number>(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (customTag && !selectedTags.includes(customTag)) {
      setSelectedTags(prev => [...prev, customTag]);
      setCustomTag('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s/g, '').replace('+2', '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('يرجى إدخال رقم هاتف صحيح (10 أرقام على الأقل)');
      return;
    }
    if (!name.trim()) {
      setError('يرجى إدخال اسم العميل');
      return;
    }

    const newProfile: Partial<CustomerProfile> = {
      id: cleanPhone,
      name: name.trim(),
      phone: cleanPhone,
      governorate: governorate.trim(),
      city: city.trim(),
      address: address.trim(),
      debtBalance: Number(debtBalance) || 0,
      loyaltyPoints: Number(loyaltyPoints) || 0,
      notes: notes.trim(),
      tags: selectedTags,
      lastOrderDate: new Date().toISOString(),
      firstOrderDate: new Date().toISOString(),
      totalOrders: 0,
      successfulOrders: 0,
      returnedOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      debtHistory: (Number(debtBalance) || 0) > 0 ? [{
        amount: Number(debtBalance),
        type: 'increase',
        reason: 'رصيد افتتاحي عند إضافة العميل',
        date: new Date().toISOString()
      }] : []
    };

    onSave(cleanPhone, newProfile);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
          onClick={onClose} 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">إضافة عميل جديد لقاعدة البيانات</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">تسجيل بيانات العميل، تصنيفه، والأرصدة المستحقة</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 text-right">
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-2">
                <span>⚠️ {error}</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-2">اسم العميل *</label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    required 
                    placeholder="مثال: أحمد محمد"
                    value={name}
                    onChange={e => { setName(e.target.value); setError(''); }}
                    className="w-full pr-11 pl-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white font-bold transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-2">رقم الهاتف (واتساب) *</label>
                <div className="relative">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="tel" 
                    required 
                    placeholder="01xxxxxxxxx"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    className="w-full pr-11 pl-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white font-mono font-bold transition-all text-right dir-ltr"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-2">المحافظة</label>
                <input 
                  type="text" 
                  placeholder="القاهرة، الجيزة..."
                  value={governorate}
                  onChange={e => setGovernorate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white font-medium text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-2">المدينة / المنطقة</label>
                <input 
                  type="text" 
                  placeholder="مدينة نصر، المعادي..."
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white font-medium text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-2">العنوان بالتفصيل</label>
                <input 
                  type="text" 
                  placeholder="شارع، عمارة، شقة..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white font-medium text-sm transition-all"
                />
              </div>
            </div>

            {/* Financial Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-black text-rose-600 dark:text-rose-400 uppercase mb-2 flex items-center gap-1.5">
                  <DollarSign size={14} /> رصيد المديونية الافتتاحي (ج.م)
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={debtBalance || ''}
                  onChange={e => setDebtBalance(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-rose-600 dark:text-rose-400 font-black text-lg transition-all text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-amber-600 dark:text-amber-400 uppercase mb-2 flex items-center gap-1.5">
                  <Star size={14} /> نقاط الولاء الابتدائية
                </label>
                <input 
                  type="number" 
                  min="0"
                  value={loyaltyPoints || ''}
                  onChange={e => setLoyaltyPoints(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-amber-600 dark:text-amber-400 font-black text-lg transition-all text-center"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                <Tag size={14} className="text-indigo-500" /> تصنيفات العميل (اختر أو أضف جديد)
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMON_TAGS.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="إضافة تصنيف مخصص..."
                  value={customTag}
                  onChange={e => setCustomTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                  className="flex-1 px-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addCustomTag}
                  className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Plus size={14} /> إضافة
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-500" /> ملاحظات داخلية
              </label>
              <textarea 
                rows={3}
                placeholder="أي ملاحظات خاصة بالعميل، تفضيلات التوصيل، مواعيد الاتصال..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white text-sm font-medium transition-all"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 text-base"
              >
                <Check size={20} /> حفظ العميل في قاعدة البيانات
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-2xl transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
