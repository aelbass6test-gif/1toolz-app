import React, { useState } from 'react';
import { Settings, GlobalOption } from '../types';
import { Layers, Plus, Trash2 } from 'lucide-react';

interface ProductOptionsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const ProductOptionsPage: React.FC<ProductOptionsPageProps> = ({ settings, setSettings }) => {
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValues, setNewOptionValues] = useState('');

  const handleAddOption = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newOptionName || !newOptionValues) return;

      const valuesArray = newOptionValues.split(',').map(v => v.trim()).filter(v => v);
      const newOption: GlobalOption = {
          id: Date.now().toString(),
          name: newOptionName,
          values: valuesArray
      };

      setSettings(prev => ({
          ...prev,
          globalOptions: [...(prev.globalOptions || []), newOption]
      }));
      setNewOptionName('');
      setNewOptionValues('');
  };

  const deleteOption = (id: string) => {
      setSettings(prev => ({
          ...prev,
          globalOptions: prev.globalOptions.filter(o => o.id !== id)
      }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-4">
        <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><Layers size={28} /></div>
            <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">خيارات المنتجات</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">قم بتعريف الخيارات العامة مثل (المقاس، اللون) لاستخدامها في المنتجات.</p>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">إضافة خيار جديد</h3>
            <form onSubmit={handleAddOption} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">اسم الخيار</label>
                    <input type="text" placeholder="مثلاً: المقاس، اللون" value={newOptionName} onChange={e => setNewOptionName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">القيم (افصل بفاصلة)</label>
                    <input type="text" placeholder="S, M, L, XL" value={newOptionValues} onChange={e => setNewOptionValues(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dir-ltr text-right" />
                </div>
                <button type="submit" className="md:col-span-2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"><Plus size={20}/> حفظ الخيار</button>
            </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(settings.globalOptions || []).map(option => (
                <div key={option.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative group">
                    <button onClick={() => deleteOption(option.id)} className="absolute top-4 left-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18}/></button>
                    <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-3">{option.name}</h4>
                    <div className="flex flex-wrap gap-2">
                        {option.values.map((val, idx) => (
                            <span key={idx} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{val}</span>
                        ))}
                    </div>
                </div>
            ))}
            {(!settings.globalOptions || settings.globalOptions.length === 0) && (
                <div className="md:col-span-2 text-center py-12 text-slate-400">لا توجد خيارات مضافة.</div>
            )}
        </div>
    </div>
  );
};

export default ProductOptionsPage;
