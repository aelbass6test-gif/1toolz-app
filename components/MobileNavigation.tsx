
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Plus, Settings2, UserCog } from 'lucide-react';

const MobileNavigation: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 px-6 py-3 flex justify-between items-center safe-area-bottom shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
      <NavLink 
        to="/" 
        className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
      >
        <LayoutDashboard size={22} className="transition-transform active:scale-90" />
        <span className="text-[10px] font-black uppercase tracking-tighter">الرئيسية</span>
      </NavLink>
      
      <NavLink 
        to="/orders" 
        className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
      >
        <ShoppingCart size={22} className="transition-transform active:scale-90" />
        <span className="text-[10px] font-black uppercase tracking-tighter">الطلبات</span>
      </NavLink>
      
      <NavLink 
        to="/create-order" 
        className="flex flex-col items-center justify-center -mt-12 bg-indigo-600 text-white w-14 h-14 rounded-2xl shadow-lg shadow-indigo-500/30 border-4 border-white dark:border-slate-950 transition-all active:scale-90"
      >
        <Plus size={28} />
      </NavLink>
      
      <NavLink 
        to="/products" 
        className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
      >
        <Package size={22} className="transition-transform active:scale-90" />
        <span className="text-[10px] font-black uppercase tracking-tighter">المنتجات</span>
      </NavLink>
      
      <NavLink 
        to="/settings" 
        className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
      >
        <Settings2 size={22} className="transition-transform active:scale-90" />
        <span className="text-[10px] font-black uppercase tracking-tighter">الإعدادات</span>
      </NavLink>
    </nav>
  );
};

export default MobileNavigation;
