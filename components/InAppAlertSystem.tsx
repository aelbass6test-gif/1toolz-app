import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  HelpCircle, 
  X, 
  BellRing,
  ShieldAlert
} from 'lucide-react';
import { 
  inAppAlertManager, 
  InAppAlertOptions, 
  InAppToastOptions 
} from '../utils/inAppAlert';

export const InAppAlertSystem: React.FC = () => {
  const [dialog, setDialog] = useState<InAppAlertOptions | null>(null);
  const [toasts, setToasts] = useState<InAppToastOptions[]>([]);
  const [checkboxChecked, setCheckboxChecked] = useState<boolean>(false);

  useEffect(() => {
    const unsubDialog = inAppAlertManager.subscribeDialog((d) => {
      setDialog(d);
      setCheckboxChecked(false);
    });

    const unsubToasts = inAppAlertManager.subscribeToast((t) => {
      setToasts(t);
    });

    return () => {
      unsubDialog();
      unsubToasts();
    };
  }, []);

  // Keyboard shortcut listener for Enter and Escape
  useEffect(() => {
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dialog.showCancel && dialog.onCancel) {
          dialog.onCancel();
        } else if (!dialog.showCancel && dialog.onConfirm) {
          dialog.onConfirm();
        }
      } else if (e.key === 'Enter') {
        if (dialog.onConfirm) {
          dialog.onConfirm(checkboxChecked);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, checkboxChecked]);

  const getDialogTheme = (type?: string) => {
    switch (type) {
      case 'danger':
      case 'error':
        return {
          icon: <AlertCircle className="w-9 h-9 text-rose-600 dark:text-rose-400" />,
          bgIcon: 'bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30',
          badgeText: 'تحذير أمني ونظامي',
          badgeColor: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-9 h-9 text-amber-600 dark:text-amber-400" />,
          bgIcon: 'bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/30',
          badgeText: 'تنبيه هام',
          badgeColor: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />,
          bgIcon: 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/50',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30',
          badgeText: 'تم بنجاح',
          badgeColor: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        };
      case 'question':
        return {
          icon: <HelpCircle className="w-9 h-9 text-indigo-600 dark:text-indigo-400" />,
          bgIcon: 'bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/50',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30',
          badgeText: 'تأكيد الإجراء',
          badgeColor: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
        };
      default:
        return {
          icon: <Info className="w-9 h-9 text-blue-600 dark:text-blue-400" />,
          bgIcon: 'bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50',
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30',
          badgeText: 'تنبيه النظام الداخلي',
          badgeColor: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        };
    }
  };

  const currentTheme = getDialogTheme(dialog?.type);

  return (
    <>
      {/* 1. In-App Modal Dialog (Alert / Confirm) */}
      <AnimatePresence>
        {dialog && (
          <div
            id="in-app-alert-overlay"
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all select-none"
            dir="rtl"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                if (dialog.showCancel && dialog.onCancel) {
                  dialog.onCancel();
                } else if (!dialog.showCancel && dialog.onConfirm) {
                  dialog.onConfirm();
                }
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header decorative glow bar */}
              <div
                className={`h-2 w-full ${
                  dialog.type === 'danger' || dialog.type === 'error'
                    ? 'bg-rose-500'
                    : dialog.type === 'warning'
                    ? 'bg-amber-500'
                    : dialog.type === 'success'
                    ? 'bg-emerald-500'
                    : 'bg-indigo-500'
                }`}
              />

              <div className="p-6 sm:p-7 text-center">
                {/* Badge */}
                <div className="flex items-center justify-center mb-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wide border ${currentTheme.badgeColor}`}
                  >
                    <BellRing size={12} className="animate-pulse" />
                    {currentTheme.badgeText}
                  </span>
                </div>

                {/* Animated Icon Circle */}
                <motion.div
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className={`w-20 h-20 rounded-3xl ${currentTheme.bgIcon} flex items-center justify-center mx-auto mb-5 shadow-inner`}
                >
                  {currentTheme.icon}
                </motion.div>

                {/* Title */}
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 leading-snug">
                  {dialog.title}
                </h3>

                {/* Message Body */}
                <div className="max-h-60 overflow-y-auto px-2 py-1 scrollbar-thin">
                  <p className="text-slate-600 dark:text-slate-300 font-bold text-sm sm:text-base leading-relaxed whitespace-pre-line text-center">
                    {dialog.message}
                  </p>
                </div>

                {/* Optional Checkbox */}
                {dialog.checkboxLabel && (
                  <label className="mt-5 flex items-center justify-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl cursor-pointer border border-slate-200 dark:border-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={checkboxChecked}
                      onChange={(e) => setCheckboxChecked(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                    />
                    <span>{dialog.checkboxLabel}</span>
                  </label>
                )}

                {/* Action Buttons */}
                <div className="mt-7 flex items-center gap-3">
                  {dialog.showCancel && (
                    <button
                      type="button"
                      onClick={() => dialog.onCancel?.()}
                      className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-sm transition-all active:scale-95"
                    >
                      {dialog.cancelText || 'إلغاء'}
                    </button>
                  )}
                  <button
                    type="button"
                    autoFocus
                    onClick={() => dialog.onConfirm?.(checkboxChecked)}
                    className={`flex-1 py-3.5 px-4 rounded-2xl font-black text-sm transition-all active:scale-95 ${currentTheme.confirmBtn}`}
                  >
                    {dialog.confirmText || 'موافق'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. In-App Toast Notifications (Corner / Floating) */}
      <div
        id="in-app-toasts-container"
        className="fixed bottom-5 left-5 z-[99998] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        dir="rtl"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25 }}
              className={`pointer-events-auto p-4 rounded-2xl shadow-xl border backdrop-blur-md flex items-start gap-3 bg-white/95 dark:bg-slate-900/95 ${
                toast.type === 'error'
                  ? 'border-rose-300 dark:border-rose-900/60 text-rose-950 dark:text-rose-100'
                  : toast.type === 'warning'
                  ? 'border-amber-300 dark:border-amber-900/60 text-amber-950 dark:text-amber-100'
                  : toast.type === 'success'
                  ? 'border-emerald-300 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-100'
                  : 'border-blue-300 dark:border-blue-900/60 text-blue-950 dark:text-blue-100'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>

              <div className="flex-1 text-right">
                {toast.title && (
                  <h5 className="font-black text-xs text-slate-800 dark:text-white mb-0.5">
                    {toast.title}
                  </h5>
                )}
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => toast.id && inAppAlertManager.removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};
