import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, User } from 'lucide-react';
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
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div 
           initial={{ opacity: 0 }} 
           animate={{ opacity: 1 }} 
           exit={{ opacity: 0 }} 
           className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
           onClick={onClose} 
        />
        <motion.div 
           initial={{ opacity: 0, scale: 0.95, y: 10 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 10 }}
           className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[80vh]"
        >
           <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                 <User className="text-indigo-500" size={20} />
                 اختيار عميل مسجل
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                 <X size={20} />
              </button>
           </div>
           
           <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="relative">
                 <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                   type="text" 
                   placeholder="ابحث بالاسم أو رقم الموبايل..."
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 h-14 pr-11 pl-4 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                 />
              </div>
           </div>

           <div className="overflow-y-auto p-4 flex-1 h-[400px]">
              {filteredCustomers.length === 0 ? (
                 <div className="text-center py-10 text-slate-400">
                    <p className="font-bold">لا يوجد نتائج تطابق بحثك</p>
                 </div>
              ) : (
                 <div className="space-y-2">
                    {filteredCustomers.map(customer => (
                       <button
                         key={customer.phone}
                         onClick={() => {
                            onSelect(customer);
                            onClose();
                         }}
                         className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-right group flex items-center justify-between"
                       >
                          <div>
                             <p className="font-black text-slate-800 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{customer.name || 'بدون اسم'}</p>
                             <p className="text-xs font-bold text-slate-500 mt-1">{customer.phone}</p>
                             {customer.address && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{customer.address}</p>}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                             <User size={14} />
                          </div>
                       </button>
                    ))}
                 </div>
              )}
           </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
