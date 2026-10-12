import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Sparkles, Database, ArrowLeft, Store, Zap, Check } from 'lucide-react';

interface WelcomeLoaderProps {
  userName: string;
  userRole?: string;
  storeName?: string;
  storeSubdomain?: string;
  onFastPass?: () => void;
}

const WelcomeLoader: React.FC<WelcomeLoaderProps> = ({ 
  userName, 
  userRole, 
  storeName, 
  storeSubdomain,
  onFastPass 
}) => {
  const [progress, setProgress] = useState(15);
  const [currentStep, setCurrentStep] = useState(0);

  // Time-aware Arabic greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'صباح الخير والبركة والنشاط';
    if (hour >= 12 && hour < 17) return 'طاب يومك بكل خير وتوفيق';
    if (hour >= 17 && hour < 23) return 'مساء الخير والريادة والنجاح';
    return 'أهلاً بك في ساعات العمل والإنجاز';
  };

  const steps = [
    { label: 'توثيق الاتصال المشفر وجلسة الأمان', icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'مزامنة كتالوج المنتجات والمخزون الحي', icon: Database, color: 'text-teal-600 dark:text-teal-400' },
    { label: 'تهيئة لوحة التحكم والتحليلات الذكية', icon: Sparkles, color: 'text-emerald-600 dark:text-emerald-400' },
  ];

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(55);
      setCurrentStep(1);
    }, 550);

    const t2 = setTimeout(() => {
      setProgress(95);
      setCurrentStep(2);
    }, 1150);

    const t3 = setTimeout(() => {
      setProgress(100);
    }, 1600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const displayName = userName?.trim() ? userName.split(' ')[0] : 'عزيزنا الشريك';

  return (
    <div dir="rtl" className="bg-gradient-to-br from-emerald-50/80 via-slate-50 to-teal-50/70 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen flex items-center justify-center relative overflow-hidden font-cairo select-none text-slate-900 dark:text-slate-100 p-4 transition-colors duration-300">
      
      {/* Brand Identity Ambient Fluid Mesh Glows */}
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/15 to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 left-1/3 w-[550px] h-[550px] bg-gradient-to-br from-[#008060]/15 via-emerald-600/10 to-transparent blur-[150px] rounded-full pointer-events-none" />

      {/* Decorative Brand Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,128,96,0.5) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg text-center"
      >
        
        {/* Glowing Central Brand Avatar */}
        <div className="relative mx-auto w-24 h-24 mb-7 flex items-center justify-center">
          {/* Rotating Outer Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/30 dark:border-emerald-400/30"
          />
          {/* Inner Brand Gradient Ring */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#008060] via-emerald-500 to-teal-400 p-[3px] shadow-2xl shadow-emerald-500/25">
            <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden shadow-inner">
              <Zap className="w-9 h-9 text-[#008060] dark:text-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Greeting & User Name */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-6"
        >
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#008060] dark:text-emerald-300 mb-3 backdrop-blur-sm shadow-xs">
            {getGreeting()} ✨
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            مرحباً بك، <span className="bg-gradient-to-r from-[#008060] via-emerald-600 to-teal-600 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-300 bg-clip-text text-transparent">{displayName}</span>
          </h1>

          {/* Subtitle / Role Badge */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs">
            {userRole && (
              <span className="px-3.5 py-1.5 rounded-full bg-emerald-600 text-white font-black shadow-sm">
                {userRole}
              </span>
            )}
            {storeName && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-emerald-200 dark:border-slate-700 font-bold shadow-xs">
                <Store size={13} className="text-[#008060] dark:text-emerald-400" />
                متجر: {storeName}
              </span>
            )}
          </div>
        </motion.div>

        {/* Progress Pipeline Box */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-emerald-100/80 dark:border-slate-800 rounded-3xl p-6 shadow-xl shadow-emerald-950/5 mb-6 text-right"
        >
          {/* Progress Bar Header */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-3">
            <span>جاري تهيئة بيئة العمل...</span>
            <span className="font-mono text-[#008060] dark:text-emerald-400 font-black">{progress}%</span>
          </div>

          {/* Progress Bar Track */}
          <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-5 p-[1px] border border-slate-200/50 dark:border-slate-700/50">
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeInOut", duration: 0.4 }}
              className="h-full bg-gradient-to-r from-[#008060] via-emerald-500 to-teal-400 rounded-full shadow-md shadow-emerald-500/30"
            />
          </div>

          {/* 3 Step Indicators */}
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = currentStep > idx || progress === 100;
              const isCurrent = currentStep === idx && progress < 100;

              return (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all duration-300 text-xs ${
                    isCurrent 
                      ? 'bg-emerald-50/80 dark:bg-slate-800/80 border border-emerald-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white shadow-xs' 
                      : isCompleted 
                        ? 'bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300' 
                        : 'text-slate-400 dark:text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      isCompleted 
                        ? 'bg-emerald-100 text-[#008060] dark:bg-emerald-900/40 dark:text-emerald-400' 
                        : isCurrent 
                          ? 'bg-emerald-600 text-white animate-pulse shadow-xs' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}>
                      {isCompleted ? <Check size={14} className="stroke-[3]" /> : <Icon size={14} />}
                    </div>
                    <span className="font-bold">{step.label}</span>
                  </div>

                  <span className="text-[11px] font-bold">
                    {isCompleted ? (
                      <span className="text-[#008060] dark:text-emerald-400 font-black">✓ مكتمل</span>
                    ) : isCurrent ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-black animate-pulse">جاري المزامنة...</span>
                    ) : (
                      <span>في الانتظار</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Fast-Pass Action Button */}
        {onFastPass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <button
              type="button"
              onClick={onFastPass}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 hover:text-[#008060] dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 font-bold text-xs transition active:scale-95 cursor-pointer shadow-md shadow-slate-200/50 dark:shadow-none"
            >
              <span>دخول مباشر وفوري للوحة التحكم</span>
              <ArrowLeft size={14} />
            </button>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
};

export default WelcomeLoader;
