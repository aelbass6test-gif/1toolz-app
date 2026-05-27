
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, ShoppingCart, Eye, PhoneForwarded, Plus,
    Archive, Package, ClipboardList, ListOrdered, Star, Grid3x3, Users, Truck, Percent, 
    Wallet as WalletIcon, ArrowRightLeft, LayoutGrid, Brush, FileText, Globe, BarChart2, Shield, 
    AppWindow, Settings2, CreditCard, Landmark, Users2, Code, Receipt, ChevronRight, X, UserCog, History, Megaphone, MessageSquare, Wand2, DollarSign 
} from 'lucide-react';
import { Store as StoreType } from '../types';

interface SidebarProps {
  activeStore: StoreType | undefined;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeStore, isOpen, onClose }) => {
    const location = useLocation();
    const prevPathnameRef = useRef(location.pathname);
    
    // Close sidebar on route change (for mobile)
    useEffect(() => {
        // If the path has changed since the last render, it means navigation occurred.
        if (prevPathnameRef.current !== location.pathname) {
            if (onClose) {
                onClose();
            }
        }
        // Always update the ref to the current pathname for the next render.
        prevPathnameRef.current = location.pathname;
    }, [location.pathname, onClose]);

    const navItems = [
        { 
            type: 'group', 
            title: 'لوحة التحكم', 
            links: [
                { to: '/', label: 'الرئيسية', icon: <LayoutDashboard size={20} /> },
                { to: '/store', label: 'معاينة المتجر', icon: <Eye size={20} />, external: true },
            ]
        },
        {
            type: 'group',
            title: 'إدارة الطلبات',
            links: [
                { to: '/create-order', label: 'طلب جديد ＋', icon: <Plus size={20} /> },
                { to: '/confirmation-queue', label: 'تأكيد الطلبات', icon: <PhoneForwarded size={20} /> },
                { to: '/orders', label: 'الطلبات', icon: <ShoppingCart size={20} /> },
                { to: '/abandoned-carts', label: 'السلات المتروكة', icon: <Archive size={20} /> },
            ]
        },
        {
            type: 'group',
            title: 'المنتجات والمخزون',
            links: [
                { to: '/products', label: 'المنتجات', icon: <Package size={20} /> },
                { to: '/suppliers', label: 'الموردين والمخزون', icon: <UserCog size={20} /> },
                { to: '/product-options', label: 'خيارات المنتجات', icon: <ClipboardList size={20} /> },
                { to: '/product-attributes', label: 'خصائص المنتجات', icon: <ListOrdered size={20} /> },
                { to: '/reviews', label: 'التقييمات', icon: <Star size={20} /> },
                { to: '/collections', label: 'المجموعات', icon: <Grid3x3 size={20} /> },
            ]
        },
        { type: 'link', to: '/customers', label: 'العملاء', icon: <Users size={20} /> },
        {
            type: 'group',
            title: 'التسويق والنمو',
            links: [
                { to: '/ai-assistant', label: 'المساعد الذكي', icon: <Wand2 size={20} /> },
                { to: '/marketing', label: 'مساعد التسويق', icon: <Megaphone size={20} /> },
                { to: '/discounts', label: 'كوبونات الخصم', icon: <Percent size={20} /> },
            ]
        },
        {
            type: 'group',
            title: 'التواصل والشحن',
            links: [
                { to: '/whatsapp', label: 'واتساب', icon: <MessageSquare size={20} /> },
                { to: '/team-chat', label: 'دردشة الفريق', icon: <Users2 size={20} /> },
                { to: '/shipping', label: 'الشحن', icon: <Truck size={20} /> },
                { to: '/shipping', label: 'متجر التغليف', icon: <Package size={20} /> },
            ]
        },
        {
            type: 'group',
            title: 'النظام المالي',
            links: [
                { to: '/treasury', label: 'الخزينة والسيولة', icon: <Landmark size={20} /> },
                { to: '/wallet', label: 'المحفظة', icon: <WalletIcon size={20} /> },
                { to: '/partners', label: 'الشركاء والسلف', icon: <Users size={20} /> },
                { to: '/expenses', label: 'المصروفات', icon: <DollarSign size={20} /> },
                { to: '/collections-report', label: 'التحصيلات', icon: <Receipt size={20} /> },
                { to: '/withdrawals', label: 'عمليات السحب', icon: <ArrowRightLeft size={20} /> },
            ]
        },
        {
            type: 'group',
            title: 'إعداد المتجر',
            links: [
                { to: '/design-templates', label: 'القوالب', icon: <LayoutGrid size={20} /> },
                { to: '/customize-store', label: 'المظهر', icon: <Brush size={20} /> },
                { to: '/apps', label: 'الربط والتطبيقات', icon: <AppWindow size={20} /> },
                { to: '/pages', label: 'الصفحات', icon: <FileText size={20} /> },
                { to: '/domain', label: 'النطاق', icon: <Globe size={20} /> },
            ]
        },
        {
            type: 'group',
            title: 'التحليلات',
            links: [
                { to: '/reports', label: 'التحليلات الذكية', icon: <BarChart2 size={20} /> },
                { to: '/standard-reports', label: 'مركز التقارير', icon: <FileText size={20} /> },
                { to: '/activity-logs', label: 'سجل النشاط', icon: <History size={20} /> },
                { to: '/legal-pages', label: 'الصفحات القانونية', icon: <Shield size={20} /> },
            ]
        },
        {
            type: 'group',
            title: 'الإعدادات',
            links: [
                { to: '/settings', label: 'عام', icon: <Settings2 size={20} /> },
                { to: '/settings/payment', label: 'الدفع', icon: <CreditCard size={20} /> },
                { to: '/settings/tax', label: 'الضريبة', icon: <Landmark size={20} /> },
                { to: '/settings/employees', label: 'الموظفون', icon: <Users2 size={20} /> },
                { to: '/settings/developer', label: 'أدوات المطورين', icon: <Code size={20} /> },
            ]
        }
    ];

    const sidebarContentJSX = (
        <div className="h-full flex flex-col p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <div className="py-6 px-2 mb-2 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <ShoppingCart size={22} />
                    </div>
<div>
    <h2 className="text-lg font-display font-black text-slate-900 dark:text-white truncate max-w-[140px]" title={activeStore?.name}>
        {activeStore?.name || 'متجري'}
    </h2>
    <div className="flex flex-col gap-0.5">
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">المسؤول</p>
        <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">كود المتجر: {activeStore?.id}</p>
    </div>
</div>
                </div>
                {onClose && <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600 transition-colors"><X size={24}/></button>}
            </div>
            
            <nav className="flex-1 space-y-6 overflow-y-auto pb-10 no-scrollbar pr-1">
                {navItems.map((item, index) => {
                    if (item.type === 'link') {
                        return (
                             <NavLink 
                                to={item.to} 
                                key={item.to + index} 
                                end={item.to === '/'} 
                                className={({ isActive }) => `sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
                            >
                                {item.icon}
                                <span className="text-sm font-medium">{item.label}</span>
                            </NavLink>
                        );
                    }
                    if (item.type === 'group') {
                        return (
                            <div key={item.title} className="space-y-1">
                                <div className="px-4 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    {item.title}
                                </div>
                                {item.links.map(link => (
                                    <NavLink 
                                        to={link.to} 
                                        key={link.to + link.label}
                                        end={link.to === '/'}
                                        className={({ isActive }) => `sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
                                    >
                                        {link.icon}
                                        <span className="text-sm font-medium">{link.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        );
                    }
                    return null;
                })}
            </nav>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:flex w-72 bg-white dark:bg-slate-900 border-l border-slate-200/60 dark:border-slate-800/60 h-full flex-col sticky top-0">
                {sidebarContentJSX}
            </div>

            {/* Mobile Sidebar */}
            <div 
                className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden={!isOpen}
            >
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} tabIndex={-1}></div>
                <div 
                    className={`absolute top-0 right-0 h-full w-72 bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                >
                    {isOpen && sidebarContentJSX}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
