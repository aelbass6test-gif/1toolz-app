
import React from 'react';
import { Link } from 'react-router-dom';
import { X, ShoppingCart, Trash2, Plus, Minus, Package } from 'lucide-react';
import { OrderItem } from '../types';

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
      <div 
        className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-[60] flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
            <ShoppingCart />
            سلة المشتريات
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
            <X />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <Package size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">سلتك فارغة</h3>
            <p className="text-sm">أضف بعض المنتجات لتبدأ.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.map(item => (
              <div key={item.productId} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-md flex-shrink-0 overflow-hidden">
                    {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <Package className="w-full h-full p-4 text-slate-300 dark:text-slate-600" />
                    )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm line-clamp-1 dark:text-slate-200">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.price.toLocaleString()} ج.م</p>
                  <div className="flex items-center gap-2 mt-2">
                     <button onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)} className="p-1.5 bg-slate-200 dark:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"><Minus size={14}/></button>
                     <span className="font-bold text-sm w-8 text-center dark:text-white">{item.quantity}</span>
                     <button onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)} className="p-1.5 bg-slate-200 dark:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"><Plus size={14}/></button>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="font-black text-lg" style={{ color: primaryColor }}>{(item.price * item.quantity).toLocaleString()} ج.م</p>
                  <button onClick={() => onRemoveItem(item.productId)} className="mt-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-4">
            <div className="flex justify-between font-bold text-lg text-slate-800 dark:text-white">
              <span>المجموع الفرعي</span>
              <span>{subtotal.toLocaleString()} ج.م</span>
            </div>
            <Link
              to="/checkout"
              onClick={onClose}
              className="block w-full text-center py-4 rounded-lg font-bold text-white transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              إتمام الطلب
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default CartSidebar;