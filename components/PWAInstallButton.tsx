import React, { useState } from 'react';
import { usePWAInstall } from '../src/hooks/usePWAInstall';
import { Download, Smartphone, X, Check, Share, PlusSquare } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  // Android / Desktop / Chromium Flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#008060] to-emerald-600 hover:from-[#086a51] hover:to-emerald-700 text-white font-black text-xs shadow-xs hover:shadow-sm transition-all active:scale-95 cursor-pointer ${className}`}
        title="تثبيت التطبيق على الموبايل أو الكمبيوتر"
      >
        <Download size={14} className="animate-bounce" />
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  // iOS Safari Flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700 ${className}`}
          title="تثبيت التطبيق على الآيفون والآيباد"
        >
          <Smartphone size={14} className="text-[#008060]" />
          <span>تثبيت على iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-right">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#008060] flex items-center justify-center font-black">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">تثبيت التطبيق على iOS</h3>
                    <p className="text-[11px] text-slate-500">iPhone & iPad</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                    <Share size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-black text-slate-900 dark:text-white">1. اضغط على زر المشاركة (Share)</p>
                    <p className="text-[11px] text-slate-500">الموجود في أسفل متصفح Safari.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                    <PlusSquare size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-black text-slate-900 dark:text-white">2. اختر "إضافة إلى الصفحة الرئيسية"</p>
                    <p className="text-[11px] text-slate-500">Add to Home Screen من القائمة.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                    <Check size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-black text-slate-900 dark:text-white">3. اضغط إضافة (Add)</p>
                    <p className="text-[11px] text-slate-500">سيعمل التطبيق في شاشة كاملة وبدون متصفح.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 rounded-2xl bg-[#008060] text-white text-xs font-black hover:bg-[#086a51] transition-colors"
              >
                فهمت، شكراً
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
