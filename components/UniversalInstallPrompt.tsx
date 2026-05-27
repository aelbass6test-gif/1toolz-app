import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Smartphone, Monitor, Share, PlusSquare } from 'lucide-react';

interface UniversalInstallPromptProps {
  installPrompt: any;
  onInstall: () => void;
  isStandalone: boolean;
  isIos: boolean;
}

const UniversalInstallPrompt: React.FC<UniversalInstallPromptProps> = ({ 
  installPrompt, 
  onInstall, 
  isStandalone,
  isIos 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(localStorage.getItem('pwa_prompt_dismissed') === 'true');

  useEffect(() => {
    // Show prompt if not standalone and not dismissed
    if (!isStandalone && !dismissed) {
      // Show immediately for the user to see it
      setIsVisible(true);
    }
  }, [isStandalone, dismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const handleInstallClick = () => {
    if (installPrompt) {
      onInstall();
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-6 left-6 right-6 z-[999] flex justify-center pointer-events-none" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 pointer-events-auto overflow-hidden relative"
        >
          {/* Background Decorative element */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />
          
          <button 
            onClick={handleDismiss}
            className="absolute top-3 left-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              {isIos ? <Smartphone size={24} /> : (!installPrompt ? <Monitor size={24} /> : <Download size={24} />)}
            </div>
            
            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-slate-800 dark:text-white">تثبيت مدير الأوردرات الذكي</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isIos 
                  ? 'يمكنك إضافة التطبيق للشاشة الرئيسية للوصول إليه بسرعة كالبرامج المستقلة. سيتم حفظ بياناتك محلياً على هذا الهاتف.'
                  : (!installPrompt && !isIos) 
                    ? 'يمكنك تثبيت التطبيق يدوياً من قائمة المتصفح لفتحه كبرنامج مستقل على سطح المكتب. هذا يضمن بقاء بياناتك محفوظة على هذا الجهاز.'
                    : 'قم بتثبيت التطبيق كبرنامج مستقل لفتحه من سطح المكتب. سيتم حفظ كافة الطلبات والبيانات محلياً على جهازك لتجنب فقدانها.'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {installPrompt && !isIos ? (
              <button 
                onClick={handleInstallClick}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <Download size={14} />
                تثبيت الآن
              </button>
            ) : isIos ? (
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 text-[10px] text-slate-600 dark:text-slate-300 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Share size={12} className="text-blue-500" />
                  <span>1. اضغط على أيقونة المشاركة بالأسفل</span>
                </div>
                <div className="flex items-center gap-2">
                  <PlusSquare size={12} />
                  <span>2. اختر "إضافة للشاشة الرئيسية"</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 text-[10px] text-slate-600 dark:text-slate-300 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                  <span>1. اضغط على أيقونة (⋮) بالأعلى (كما في صورتك)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                  <span>2. اختر "حفظ ومشاركة" (Save and share)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                  <span>3. ثم اضغط على "تثبيت" (Install)</span>
                </div>
              </div>
            )}
            <button 
              onClick={handleDismiss}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              ليس الآن
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UniversalInstallPrompt;
