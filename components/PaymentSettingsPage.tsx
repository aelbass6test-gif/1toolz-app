import React, { useState } from 'react';
import { Settings, PaymentMethod } from '../types';
import { CreditCard, Plus, Trash2, Edit3, Smartphone, Banknote, Save, X } from 'lucide-react';

interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "emerald", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ right: '4px', color: 'white' }}>On</span> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`} style={{ left: '4px', color: '#64748b' }}>Off</span> </button> );
};

interface PaymentSettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const PaymentSettingsPage: React.FC<PaymentSettingsPageProps> = ({ settings, setSettings }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<Partial<PaymentMethod>>({ name: '', details: '', instructions: '', type: 'manual', active: true });

  const handleSaveMethod = () => {
      if (!editingMethod.name) return;
      
      const newMethod: PaymentMethod = {
          id: editingMethod.id || Date.now().toString(),
          name: editingMethod.name,
          details: editingMethod.details || '',
          instructions: editingMethod.instructions || '',
          active: editingMethod.active ?? true,
          type: editingMethod.type || 'manual'
      };

      if (editingMethod.id) {
          setSettings(prev => ({
              ...prev,
              paymentMethods: prev.paymentMethods.map(m => m.id === editingMethod.id ? newMethod : m)
          }));
      } else {
          setSettings(prev => ({
              ...prev,
              paymentMethods: [...prev.paymentMethods, newMethod]
          }));
      }
      setShowAddModal(false);
      setEditingMethod({ name: '', details: '', instructions: '', type: 'manual', active: true });
  };

  const toggleMethod = (id: string) => {
      setSettings(prev => ({
          ...prev,
          paymentMethods: prev.paymentMethods.map(m => m.id === id ? { ...m, active: !m.active } : m)
      }));
  };

  const deleteMethod = (id: string) => {
      if (!window.confirm("حذف وسيلة الدفع هذه؟")) return;
      setSettings(prev => ({
          ...prev,
          paymentMethods: prev.paymentMethods.filter(m => m.id !== id)
      }));
  };

  const openEdit = (method: PaymentMethod) => {
      setEditingMethod(method);
      setShowAddModal(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-4">
        <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-xl"><CreditCard size={28} /></div>
            <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">إعدادات الدفع</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">تحكم في طرق الدفع المتاحة لعملائك في المتجر.</p>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-black dark:text-white">طرق الدفع المفعلة</h3>
                <button onClick={() => { setEditingMethod({ type: 'manual', active: true }); setShowAddModal(true); }} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700 transition-all text-sm">
                    <Plus size={16}/> إضافة طريقة جديدة
                </button>
            </div>
            
            <div className="p-6 space-y-4">
                {settings.paymentMethods.map(method => (
                    <div key={method.id} className={`relative p-5 rounded-2xl border transition-all duration-300 group ${method.active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-lg' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${method.type === 'cod' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                    {method.type === 'cod' ? <Banknote size={24}/> : <Smartphone size={24}/>}
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white">{method.name}</h4>
                                    <p className="text-sm text-slate-500 font-mono mt-1">{method.details}</p>
                                </div>
                            </div>
                            <ToggleButton active={method.active} onToggle={() => toggleMethod(method.id)} />
                        </div>
                        {method.instructions && <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">{method.instructions}</p>}
                        
                        <div className="absolute top-4 left-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button onClick={() => openEdit(method)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit3 size={16}/></button>
                            {method.id !== 'cod' && (
                                <button onClick={() => deleteMethod(method.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 animate-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold dark:text-white">{editingMethod.id ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع'}</h3>
                        <button onClick={() => setShowAddModal(false)}><X className="text-slate-400"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">اسم الطريقة</label>
                            <input type="text" placeholder="مثلاً: انستا باي، فودافون كاش" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" value={editingMethod.name} onChange={e => setEditingMethod({...editingMethod, name: e.target.value})} disabled={editingMethod.id === 'cod'} />
                        </div>
                        {editingMethod.type !== 'cod' && (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">رقم المحفظة / الحساب</label>
                                    <input type="text" placeholder="مثلاً: 010xxxxxxx / IBAN" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-left dir-ltr" value={editingMethod.details} onChange={e => setEditingMethod({...editingMethod, details: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">تعليمات للدفع</label>
                                    <textarea placeholder="مثلاً: يرجى إرسال لقطة شاشة للتحويل على الواتساب..." className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-24" value={editingMethod.instructions} onChange={e => setEditingMethod({...editingMethod, instructions: e.target.value})} />
                                </div>
                            </>
                        )}
                        {editingMethod.id === 'cod' && (
                             <div className="p-4 bg-amber-50 text-amber-700 rounded-xl text-sm">
                                 الدفع عند الاستلام هو الطريقة الافتراضية. يمكنك فقط تفعيلها أو تعطيلها.
                             </div>
                        )}
                        <button onClick={handleSaveMethod} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-700 transition-all"><Save size={18}/> حفظ</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default PaymentSettingsPage;
