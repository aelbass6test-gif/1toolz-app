import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../src/hooks/usePWAInstall';
import { Download, Smartphone, X, Sparkles, Zap } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed') === 'true';
      setIsDismissed(dismissed);
    } catch (_) {}
  }, []);

  if (isInstalled || isDismissed || (!isInstallable && !isIOS)) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('pwa_banner_dismissed', 'true');
    } catch (_) {}
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-3xl bg-slate-900/95 dark:bg-slate-950/95 text-white border border-emerald-500/30 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#008060] to-emerald-400 text-white flex items-center justify-center font-black flex-shrink-0 shadow-sm">
            <Zap size={22} className="text-white" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5 truncate">
              <span>تثبيت تطبيق مدير الأوردرات</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">سريع وخفيف</span>
            </h4>
            <p className="text-[11px] text-slate-300 truncate">
              تصفح فوري، إشعارات أوردرات بالصوت، وعمل بدون إنترنت
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isInstallable ? (
            <button
              onClick={install}
              className="px-3.5 py-2 rounded-xl bg-[#008060] hover:bg-[#086a51] text-white text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download size={14} />
              <span>تثبيت الآن</span>
            </button>
          ) : (
            <button
              onClick={() => setShowIOSModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black transition-all border border-slate-700 cursor-pointer"
            >
              <Smartphone size={14} />
              <span>تثبيت iOS</span>
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
