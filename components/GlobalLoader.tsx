import React from 'react';
import { Loader2 } from 'lucide-react';

interface GlobalLoaderProps {
  message?: string;
}

const GlobalLoader: React.FC<GlobalLoaderProps> = ({ message = 'جاري التحميل...' }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in-5 slide-in-from-top-4 duration-300 pointer-events-none">
      <div className="flex items-center gap-2.5 px-4 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-lg border border-emerald-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold dir-rtl" dir="rtl">
        <Loader2 className="animate-spin text-[#008060] dark:text-emerald-400" size={16} />
        <span>{message}</span>
      </div>
    </div>
  );
};

export default GlobalLoader;
