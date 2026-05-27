import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, X, AlertCircle } from 'lucide-react';

interface SaveBarProps {
  isVisible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isLoading?: boolean;
}

const SaveBar: React.FC<SaveBarProps> = ({ isVisible, onSave, onDiscard, isLoading }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4"
        >
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="font-bold text-sm">لديك تغييرات غير محفوظة</p>
                <p className="text-slate-400 text-xs">تأكد من حفظ تغييراتك قبل مغادرة الصفحة</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onDiscard}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                تجاهل
              </button>
              <button
                onClick={onSave}
                disabled={isLoading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                حفظ التغييرات
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SaveBar;
