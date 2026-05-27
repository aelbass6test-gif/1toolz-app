import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, PlusSquare, Smartphone } from 'lucide-react';

interface IosInstallPromptProps {
  onClose: () => void;
}

const IosInstallPrompt: React.FC<IosInstallPromptProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
      >
        <div className="p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={24} />
          </button>

          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Smartphone size={40} />
            </div>

            <h2 className="text-2xl font-black text-slate-800 dark:text-white">تثبيت التطبيق على آيفون</h2>
            <p className="text-slate-500 dark:text-slate-400">تصفح أسرع وتنبيهات مباشرة عن طريق إضافة مدير الأوردرات لشاشتك الرئيسية</p>

            <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-4 text-right">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center shadow-sm">
                  <Share size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200">1. اضغط على أيقونة المشاركة</p>
                  <p className="text-xs text-slate-500">موجودة في شريط الأدوات بالأسفل</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center shadow-sm">
                  <PlusSquare size={20} className="text-slate-700 dark:text-slate-200" />
                </div>
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200">2. اختر "إضافة للشاشة الرئيسية"</p>
                  <p className="text-xs text-slate-500">قم بالتمرير للأسفل في القائمة حتى تجدها</p>
                </div>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-indigo-500/25"
            >
              فهمت ذلك
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default IosInstallPrompt;
