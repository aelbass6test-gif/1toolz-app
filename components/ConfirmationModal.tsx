import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen?: boolean;
  title?: string;
  description?: string;
  message?: string;
  checkboxLabel?: string;
  onConfirm: (checkboxChecked?: boolean) => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen = true,
  title,
  description,
  message,
  checkboxLabel,
  onConfirm,
  onCancel,
}) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center border border-slate-200 dark:border-slate-800"
      >
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">
          {title || "تنبيه"}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 font-bold mb-6 text-sm leading-relaxed">
          {description || message}
        </p>

        {checkboxLabel && (
          <label className="flex items-center gap-2 justify-center mb-6 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span>{checkboxLabel}</span>
          </label>
        )}

        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={() => onConfirm(isChecked)}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-600/20 transition-all"
          >
            تأكيد
          </button>
        </div>
      </motion.div>
    </div>
  );
};
