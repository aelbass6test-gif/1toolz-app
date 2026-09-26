import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Sparkles, Database, ArrowLeft, Store, Zap } from 'lucide-react';

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
    { label: 'توثيق الاتصال المشفر وجلسة الأمان', icon: ShieldCheck, color: 'text-emerald-400' },
    { label: 'مزامنة كتالوج المنتجات والمخزون الحي', icon: Database, color: 'text-indigo-400' },
    { label: 'تهيئة لوحة التحكم والتحليلات الذكية', icon: Sparkles, color: 'text-amber-400' },
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
    <div dir="rtl" className="bg-[#030712] min-h-screen flex items-center justify-center relative overflow-hidden font-cairo select-none text-slate-100 p-4">
      
      {/* Dynamic Ambient Fluid Mesh Glows */}
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 left-1/3 w-[550px] h-[550px] bg-gradient-to-br from-emerald-600/15 via-teal-600/15 to-transparent blur-[150px] rounded-full pointer-events-none" />

      {/* Decorative Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg text-center"
      >
        
        {/* Glowing Central Avatar / Icon */}
        <div className="relative mx-auto w-24 h-24 mb-7 flex items-center justify-center">
          {/* Rotating Outer Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500/30"
          />
          {/* Inner Glowing Gradient Ring */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-[2px] shadow-2xl shadow-indigo-500/30">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
              <Zap className="w-9 h-9 text-indigo-400 animate-pulse" />
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
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-indigo-300 mb-3 backdrop-blur-sm">
            {getGreeting()} ✨
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            مرحباً بك، <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-300 bg-clip-text text-transparent">{displayName}</span>
          </h1>

          {/* Subtitle / Role Badge */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs">
            {userRole && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black">
                {userRole}
              </span>
            )}
            {storeName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                <Store size={12} />
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
          className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl mb-6 text-right"
        >
          {/* Progress Bar Header */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-3">
            <span>جاري تهيئة بيئة العمل...</span>
            <span className="font-mono text-indigo-400 font-black">{progress}%</span>
          </div>

          {/* Progress Bar Track */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-5 p-[1px]">
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeInOut", duration: 0.4 }}
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full shadow-lg shadow-indigo-500/50"
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
                  className={`flex items-center justify-between p-2.5 rounded-2xl transition-all duration-300 text-xs ${
                    isCurrent 
                      ? 'bg-white/5 border border-white/10 font-bold text-white' 
                      : isCompleted 
                        ? 'text-slate-300 opacity-90' 
                        : 'text-slate-500 opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-xl flex items-center justify-center ${
                      isCompleted 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : isCurrent 
                          ? 'bg-indigo-500/20 text-indigo-400 animate-pulse' 
                          : 'bg-white/5 text-slate-500'
                    }`}>
                      <Icon size={14} />
                    </div>
                    <span>{step.label}</span>
                  </div>

                  <span className="text-[11px] font-bold">
                    {isCompleted ? (
                      <span className="text-emerald-400 font-black">✓ مكتمل</span>
                    ) : isCurrent ? (
                      <span className="text-indigo-400 font-black animate-pulse">جاري المزامنة...</span>
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-bold text-xs transition active:scale-95 cursor-pointer backdrop-blur-sm"
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
