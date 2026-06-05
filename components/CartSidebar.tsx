
import React from 'react';
import { Link } from 'react-router-dom';
import { X, ShoppingCart, Trash2, Plus, Minus, Package, ArrowRight, ArrowLeft } from 'lucide-react';
import { OrderItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cart: OrderItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  primaryColor: string;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose, cart, onUpdateQuantity, onRemoveItem, primaryColor }) => {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-[-20px_0_50px_rgba(0,0,0,0.2)] z-[110] flex flex-col"
      >
        <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl flex items-center justify-center">
                <ShoppingCart size={24} />
             </div>
             <div className="text-right">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">سلة التسوق</h2>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mt-1">{cart.length} منتجات في الحقيبة</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          <AnimatePresence mode="popLayout">
            {cart.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6"
              >
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-700">
                   <Package size={48} />
                </div>
                <div>
                   <h3 className="font-black text-xl text-slate-800 dark:text-slate-200 mb-2">سلتك بانتظار منتجاتك</h3>
                   <p className="text-sm text-slate-400 font-bold max-w-[250px]">تصفح المتجر الآن وأضف ما يعجبك لإتمام طلبك بكل سهولة.</p>
                </div>
                <button 
                  onClick={onClose}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-800 transition-all"
                >
                  <ArrowRight size={18} />
                  <span>العودة للتسوق</span>
                </button>
              </motion.div>
            ) : (
              cart.map(item => (
                <motion.div 
                  key={item.productId} 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative flex items-center gap-6 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-[2rem] border border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:bg-white dark:hover:bg-slate-800 transition-all"
                >
                  <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[1.5rem] flex-shrink-0 overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
                      {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                      ) : (
                          <Package className="w-full h-full p-6 text-slate-200 dark:text-slate-700" />
                      )}
                  </div>
                  
                  <div className="flex-1 text-right">
                    <h4 className="font-black text-base text-slate-900 dark:text-slate-100 line-clamp-1 mb-2">{item.name}</h4>
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 mb-4">{item.price.toLocaleString()} <span className="text-[10px] text-slate-400 mr-1 uppercase">ج.م</span></p>
                    
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <button onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)} className="p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"><Minus size={14}/></button>
                            <span className="font-black text-sm w-6 text-center dark:text-white">{item.quantity}</span>
                            <button onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)} className="p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"><Plus size={14}/></button>
                         </div>
                         <button onClick={() => onRemoveItem(item.productId)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all">
                            <Trash2 size={18}/>
                         </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {cart.length > 0 && (
          <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-sm font-bold text-slate-400">المجموع الفرعي</span>
                   <span className="font-black text-slate-900 dark:text-white">{subtotal.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-50 dark:border-slate-800">
                   <span className="text-xl font-black text-slate-900 dark:text-white">الإجمالي النهائي</span>
                   <span className="text-3xl font-black" style={{ color: primaryColor }}>{subtotal.toLocaleString()} <span className="text-xs text-slate-400 mr-1">ج.م</span></span>
                </div>
            </div>
            
            <Link
              to="/checkout"
              onClick={onClose}
              className="group relative w-full h-20 bg-slate-900 hover:bg-slate-950 text-white rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-4 transition-all shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] overflow-hidden"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span>إتمام الشراء</span>
              <ArrowLeft size={24} className="group-hover:-translate-x-2 transition-transform" />
            </Link>
            
            <p className="text-[10px] text-center font-black text-slate-400 uppercase tracking-widest">توصيل آمن وسريع لجميع المحافظات 🚚</p>
          </div>
        )}
      </motion.div>
    </>
  );
};

export default CartSidebar;
