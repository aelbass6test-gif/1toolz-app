
import React from 'react';
import { Settings, AbandonedCart } from '../types';
import { Archive, MessageCircle, Trash2, Clock, DollarSign, Package } from 'lucide-react';

interface AbandonedCartsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const AbandonedCartsPage: React.FC<AbandonedCartsPageProps> = ({ settings, setSettings }) => {
  
  const deleteCart = (id: string) => {
    setSettings(prev => ({
        ...prev,
        abandonedCarts: prev.abandonedCarts.filter(c => c.id !== id)
    }));
  };

  const sendRecoveryMessage = (cart: AbandonedCart) => {
      const message = `أهلاً بك يا ${cart.customerName || 'عميلنا العزيز'} 👋،\nلاحظنا إنك ما كملتش طلبك في متجرنا. منتجاتك لسه محجوزة ليك:\n${cart.items.map(i => `- ${i.name}`).join('\n')}\n\nتحب نساعدك تكمل الطلب؟`;
      const url = `https://wa.me/2${cart.customerPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl"><Archive size={28} /></div>
        <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white">السلّات المتروكة</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">استعد مبيعاتك الضائعة وتواصل مع العملاء الذين لم يكملوا الطلب.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {settings.abandonedCarts?.map(cart => (
            <div key={cart.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between gap-6 transition-transform hover:-translate-y-1">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{cart.customerName || 'عميل غير مسجل'}</h3>
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500 font-mono">{cart.customerPhone}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                        <span className="flex items-center gap-1"><Clock size={14}/> {new Date(cart.date).toLocaleDateString('ar-EG')}</span>
                        <span className="flex items-center gap-1 font-bold text-emerald-600"><DollarSign size={14}/> {cart.totalValue.toLocaleString()} ج.م</span>
                    </div>
                    <div className="space-y-1">
                        {cart.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Package size={14} className="text-slate-400"/>
                                <span>{item.name}</span>
                                <span className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 rounded">x{item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-r border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pr-6">
                    <button onClick={() => sendRecoveryMessage(cart)} className="flex items-center justify-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 active:scale-95">
                        <MessageCircle size={18}/> استعادة عبر واتساب
                    </button>
                    <button onClick={() => deleteCart(cart.id)} className="flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 px-6 py-2 transition-colors font-bold text-sm">
                        <Trash2 size={16}/> حذف السلة
                    </button>
                </div>
            </div>
        ))}
        {(!settings.abandonedCarts || settings.abandonedCarts.length === 0) && (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                <Archive size={48} className="mx-auto mb-4 opacity-50"/>
                <p className="font-bold">لا توجد سلّات متروكة حالياً.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AbandonedCartsPage;
