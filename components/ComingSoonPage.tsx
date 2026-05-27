import React from 'react';
import { Wrench } from 'lucide-react';

const ComingSoonPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
      <div className="p-4 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full mb-6">
        <Wrench size={48} />
      </div>
      <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">قريباً... تحت الإنشاء</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-md">
        نحن نعمل بجد على تجهيز هذه الصفحة. ستكون متاحة قريباً لتقديم أفضل تجربة لك!
      </p>
    </div>
  );
};

export default ComingSoonPage;
