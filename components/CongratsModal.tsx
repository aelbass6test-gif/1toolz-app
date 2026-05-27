import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, PartyPopper } from 'lucide-react';

interface CongratsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

const CongratsModal: React.FC<CongratsModalProps> = ({ isOpen, onClose, title, message }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative"
          >
            <div className="absolute top-4 left-4">
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Trophy size={40} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2">
                  <PartyPopper size={24} className="text-pink-500" />
                  {title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  {message}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-amber-500/25 active:scale-95"
              >
                رائع!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CongratsModal;
