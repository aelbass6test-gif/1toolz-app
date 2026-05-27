import React, { useState, useEffect } from 'react';
import { Settings, DiscountCode } from '../types';
import { Tag, Plus, Trash2, Power, Percent, DollarSign } from 'lucide-react';
import SaveBar from './SaveBar';

interface DiscountsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const DiscountsPage: React.FC<DiscountsPageProps> = ({ settings, setSettings }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    setIsDirty(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);
  
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<'fixed' | 'percentage'>('fixed');
  const [newValue, setNewValue] = useState(0);

  const handleSave = () => {
    setSettings(localSettings);
  };

  const handleDiscard = () => {
    setLocalSettings(settings);
  };

  const addCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || newValue <= 0) return;
    
    const code: DiscountCode = {
        id: Date.now().toString(),
        code: newCode.toUpperCase().trim(),
        type: newType,
        value: newValue,
        active: true,
        usageCount: 0
    };

    setLocalSettings(prev => ({ ...prev, discountCodes: [...(prev.discountCodes || []), code] }));
    setNewCode('');
    setNewValue(0);
  };

  const toggleCode = (id: string) => {
    setLocalSettings(prev => ({
        ...prev,
        discountCodes: prev.discountCodes.map(c => c.id === id ? { ...c, active: !c.active } : c)
    }));
  };

  const deleteCode = (id: string) => {
    setLocalSettings(prev => ({
        ...prev,
        discountCodes: prev.discountCodes.filter(c => c.id !== id)
    }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-xl"><Tag size={28} /></div>
        <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white">كوبونات الخصم</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">أنشئ أكواد خصم لزيادة مبيعاتك.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">إضافة كوبون جديد</h3>
        <form onSubmit={addCode} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-bold text-slate-500">كود الكوبون</label>
                <input type="text" placeholder="مثلاً: SUMMER2024" value={newCode} onChange={e => setNewCode(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-black uppercase" />
            </div>
            <div className="space-y-1">
                <label className="text-sm font-bold text-slate-500">نوع الخصم</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    <button type="button" onClick={() => setNewType('fixed')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 ${newType === 'fixed' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500'}`}><DollarSign size={14}/> مبلغ</button>
                    <button type="button" onClick={() => setNewType('percentage')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 ${newType === 'percentage' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500'}`}><Percent size={14}/> نسبة</button>
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-sm font-bold text-slate-500">القيمة</label>
                <input type="number" value={newValue} onChange={e => setNewValue(Number(e.target.value))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold" />
            </div>
            <button type="submit" className="md:col-span-4 py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 transition-all shadow-lg flex items-center justify-center gap-2"><Plus size={20}/> إنشاء الكوبون</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {localSettings.discountCodes?.map(code => (
            <div key={code.id} className={`p-5 rounded-2xl border transition-all ${code.active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-75'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-slate-800 dark:text-white tracking-wider">{code.code}</span>
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${code.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>{code.active ? 'نشط' : 'غير نشط'}</span>
                        </div>
                        <p className="text-sm font-bold text-pink-600 dark:text-pink-400 mt-1">خصم {code.value} {code.type === 'percentage' ? '%' : 'ج.م'}</p>
                    </div>
                    <button onClick={() => toggleCode(code.id)} className={`p-2 rounded-lg transition-colors ${code.active ? 'text-green-500 bg-green-50' : 'text-slate-400 bg-slate-100'}`}><Power size={20}/></button>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500">استخدم {code.usageCount} مرة</span>
                    <button onClick={() => deleteCode(code.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={16}/></button>
                </div>
            </div>
        ))}
        {(!localSettings.discountCodes || localSettings.discountCodes.length === 0) && (
            <div className="md:col-span-2 text-center py-12 text-slate-400">لا توجد كوبونات خصم حالياً.</div>
        )}
      </div>
      <SaveBar isVisible={isDirty} onSave={handleSave} onDiscard={handleDiscard} />
    </div>
  );
};

export default DiscountsPage;
