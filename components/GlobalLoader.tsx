import React from 'react';
import { Loader2 } from 'lucide-react';

const GlobalLoader: React.FC = () => {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in-5 slide-in-from-top-5 duration-300">
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
        <Loader2 className="animate-spin text-indigo-500" size={16} />
        <span className="font-bold text-sm text-slate-700 dark:text-slate-300">جاري التحميل...</span>
      </div>
    </div>
  );
};

export default GlobalLoader;
