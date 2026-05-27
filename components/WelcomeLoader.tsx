
import React from 'react';
import { motion } from 'motion/react';

interface WelcomeLoaderProps {
  userName: string;
}

const WelcomeLoader: React.FC<WelcomeLoaderProps> = ({ userName }) => {
  return (
    <div dir="rtl" className="bg-[#020617] min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center relative z-10"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 relative inline-block"
        >
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
            مرحباً بك، <span className="text-indigo-400">{userName}</span>
          </h1>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ delay: 0.5, duration: 1, ease: 'easeInOut' }}
            className="h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent mt-4" 
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-12 h-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-full h-full border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"
            />
          </div>
          <p className="text-slate-400 font-medium tracking-wide text-sm flex items-center gap-2">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              جاري مزامنة بيانات متجرك الآن...
            </motion.span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default WelcomeLoader;
