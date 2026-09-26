import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, User, Phone, MapPin } from 'lucide-react';
import { CustomerProfile } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerProfile[];
  onSelect: (customer: CustomerProfile) => void;
}

export function CustomerSelectModal({ isOpen, onClose, customers, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (c.phone || '').includes(search)
    );
  }, [search, customers]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl">
        <motion.div 
           initial={{ opacity: 0 }} 
           animate={{ opacity: 1 }} 
           exit={{ opacity: 0 }} 
           className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" 
           onClick={onClose} 
        />
        <motion.div 
           initial={{ opacity: 0, scale: 0.95, y: 15 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 15 }}
           className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[85vh] border-2 border-slate-200/80 dark:border-slate-800"
        >
           <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

           <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shadow-xs">
                    <User size={22} />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">قائمة العملاء المسجلين</h3>
                    <p className="text-xs text-slate-500 font-medium">اختر عميل لاسترجاع بياناته وعنوانه فورياً</p>
                 </div>
              </div>
              <button 
                onClick={onClose} 
                className="w-10 h-10 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400 flex items-center justify-center cursor-pointer"
              >
                 <X size={20} />
              </button>
           </div>
           
           <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
              <div className="relative">
                 <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                   type="text" 
                   placeholder="ابحث بالاسم أو رقم الهاتف..."
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 h-12 pr-11 pl-4 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-900 dark:text-white"
                 />
              </div>
           </div>

           <div className="overflow-y-auto p-4 sm:p-5 flex-1 max-h-[420px] space-y-2.5">
              {filteredCustomers.length === 0 ? (
                 <div className="text-center py-12 text-slate-400 space-y-2">
                    <p className="font-black text-sm">لا يوجد نتائج تطابق بحثك</p>
                    <p className="text-xs">جرب البحث برقم هاتف أو اسم مختلف</p>
                 </div>
              ) : (
                 filteredCustomers.map(customer => (
                    <button
                      key={customer.phone}
                      onClick={() => {
                         onSelect(customer);
                         onClose();
                      }}
                      className="w-full p-4 rounded-2xl border-2 border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 hover:border-indigo-500 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-all text-right group flex items-center justify-between shadow-xs cursor-pointer active:scale-[0.99]"
                    >
                       <div className="space-y-1">
                          <p className="font-black text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                             {customer.name || 'بدون اسم'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono font-bold">
                             <span className="flex items-center gap-1">
                                <Phone size={12} className="text-slate-400" />
                                {customer.phone}
                             </span>
                             {customer.governorate && (
                                <span className="flex items-center gap-1 font-sans text-indigo-600 dark:text-indigo-400">
                                   <MapPin size={12} />
                                   {customer.governorate}
                                </span>
                             )}
                          </div>
                          {customer.address && (
                             <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 max-w-md font-medium">
                                {customer.address}
                             </p>
                          )}
                       </div>
                       <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                          <User size={18} />
                       </div>
                    </button>
                 ))
              )}
           </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
