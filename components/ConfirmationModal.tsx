import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, message, onConfirm, onCancel }) => {
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
        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-4">تنبيه</h3>
        <p className="text-slate-600 dark:text-slate-400 font-bold mb-8">{message}</p>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-slate-600 dark:text-slate-300">إلغاء</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black">حذف</button>
        </div>
      </motion.div>
    </div>
  );
};
