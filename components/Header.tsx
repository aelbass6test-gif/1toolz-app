// FIX: Import 'useMemo' from 'react' to resolve 'Cannot find name' error.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Store } from '../types';
import { Menu, ChevronDown, User as UserIcon, Settings, LogOut, ExternalLink, Replace, Sun, Moon, Monitor, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import { getSupabaseRestrictedStatus } from '../services/databaseService';

const PATH_TITLES: { [key: string]: string } = {
    '/': 'الرئيسية',
    '/confirmation-queue': 'تأكيد الطلبات',
    '/orders': 'الطلبات',
    '/abandoned-carts': 'السلات المتروكة',
    '/products': 'المنتجات',
    '/suppliers': 'الموردين والمخزون',
    '/customers': 'العملاء',
    '/marketing': 'مساعد التسويق الذكي',
    '/discounts': 'كوبونات الخصم',
    '/shipping': 'الشحن',
    '/wallet': 'المحفظة',
    '/collections-report': 'التحصيلات',
    '/customize-store': 'المظهر',
    '/pages': 'الصفحات',
    '/reports': 'التحليلات الذكية',
    '/standard-reports': 'مركز التقارير',
    '/activity-logs': 'سجل النشاط',
    '/settings': 'الإعدادات العامة',
    '/settings/employees': 'الموظفون',
    '/admin/account-settings': 'إعدادات الحساب',
    '/account-settings': 'إعدادات الحساب',
};

interface HeaderProps {
    currentUser: User | null;
    onLogout: () => void;
    onToggleSidebar: () => void;
    theme: string;
    setTheme: (theme: string) => void;
    activeStore?: Store;
    dbSyncMode?: 'manual' | 'auto';
    setDbSyncMode?: (mode: 'manual' | 'auto') => void;
    forceSync?: () => Promise<void>;
    saveStatus?: any;
    saveMessage?: string;
}

const Header: React.FC<HeaderProps> = ({ 
    currentUser, 
    onLogout, 
    onToggleSidebar, 
    theme, 
    setTheme, 
    activeStore,
    dbSyncMode,
    setDbSyncMode,
    forceSync,
    saveStatus,
    saveMessage
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [isRestricted, setIsRestricted] = useState(getSupabaseRestrictedStatus());

    const handleManageStoresClick = () => {
        if (currentUser?.isAdmin) {
            navigate('/admin/manage-stores');
        } else {
            navigate('/manage-stores');
        }
    };

    const pageTitle = useMemo(() => {
        const path = location.pathname;
        const title = Object.entries(PATH_TITLES).find(([key, _]) => path.startsWith(key) && key !== '/');
        return PATH_TITLES[path] || (title ? title[1] : 'الرئيسية');
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const handleRestrictionChange = () => {
            setIsRestricted(getSupabaseRestrictedStatus());
        };
        window.addEventListener('supabase_restricted_changed', handleRestrictionChange);
        return () => window.removeEventListener('supabase_restricted_changed', handleRestrictionChange);
    }, []);
    
    const handleLogout = () => {
        setIsUserMenuOpen(false);
        onLogout();
    };

    const getUserInitials = (name: string) => {
        const names = name.split(' ');
        return names.length > 1 && names[names.length - 1]
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    return (
        <header className="h-20 glass border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 flex-shrink-0">
            <div className="flex items-center gap-3 sm:gap-6">
    <button onClick={onToggleSidebar} className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500">
        <Menu size={24} />
    </button>
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <h1 className="text-lg sm:text-xl font-display font-black text-slate-900 dark:text-white tracking-tight">{pageTitle}</h1>
        {activeStore && (
            <span className="hidden sm:inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-700">
                ID: {activeStore.id}
            </span>
        )}
        {isRestricted && (
            <span 
                title="تم تجاوز حصة Supabase المحددة للمشروع. التطبيق يعمل حالياً في الوضع الاحتياطي المحلي الآمن للحفاظ على بياناتك وعملك دون توقف."
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-xl border border-amber-200/80 dark:border-amber-900/30 animate-pulse cursor-help"
            >
                <ShieldAlert size={14} className="animate-bounce" />
                <span>الوضع المحلي نشط</span>
            </span>
        )}
    </div>
</div>

            <div className="flex items-center gap-2 sm:gap-6">
                {activeStore && (
                    <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-900/40 p-1 rounded-2xl border border-slate-200 dark:border-slate-850">
                        <button
                            onClick={() => setDbSyncMode?.(dbSyncMode === 'manual' ? 'auto' : 'manual')}
                            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl font-black text-[9px] sm:text-[11px] transition-all hover:bg-white dark:hover:bg-slate-800 cursor-pointer ${
                                dbSyncMode === 'manual' 
                                    ? 'text-slate-600 dark:text-slate-300' 
                                    : 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                            }`}
                            title={
                                dbSyncMode === 'manual' 
                                    ? 'وضع ديسك توب (محلي وسريع بالكامل). اضغط للتحويل إلى الوضع السحابي التلقائي.' 
                                    : 'وضع سحابي تلقائي (مزامنة فورية لكل خطوة). اضغط للتحويل إلى وضع ديسك توب محلي.'
                            }
                        >
                            {dbSyncMode === 'manual' ? (
                                <>
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                                    </span>
                                    <span>ديسك توب (محلي)</span>
                                </>
                            ) : (
                                <>
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span>سحابي (تلقائي)</span>
                                </>
                            )}
                        </button>
                        
                        <button
                            onClick={async () => {
                                if (forceSync) {
                                    await forceSync();
                                }
                            }}
                            disabled={saveStatus === 'saving'}
                            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-[9px] sm:text-[11px] font-black transition-all cursor-pointer ${
                                saveStatus === 'saving'
                                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 hover:scale-102 active:scale-98'
                            }`}
                            title="مزامنة مع السحاب الآن (رفع وتنزيل البيانات)"
                        >
                            {saveStatus === 'saving' ? (
                                <>
                                    <Loader2 size={12} className="animate-spin" />
                                    <span>جاري المزامنة...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={12} />
                                    <span>مزامنة السحاب</span>
                                </>
                            )}
                        </button>
                        
                        {saveStatus !== 'idle' && (
                            <span className={`hidden sm:inline-block text-[10px] font-black px-2 py-1 rounded-lg ${
                                saveStatus === 'success' ? 'bg-emerald-100 text-emerald-700' :
                                saveStatus === 'error' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {saveMessage || (saveStatus === 'saving' ? 'جاري...' : saveStatus)}
                            </span>
                        )}
                    </div>
                )}

                <button 
                    onClick={handleManageStoresClick}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                >
                    <Replace size={16} />
                    <span>تغيير المتجر</span>
                </button>
                
                <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(prev => !prev)} className="flex items-center gap-3 p-1 pr-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <div className="hidden md:block text-right">
                            <div className="font-bold text-sm text-slate-800 dark:text-white leading-none mb-1">{currentUser?.fullName}</div>
                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{currentUser?.isAdmin ? 'مدير النظام' : 'صاحب المتجر'}</div>
                        </div>
                        <div className="w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm bg-primary text-white shadow-lg shadow-primary/20">
                            {currentUser ? getUserInitials(currentUser.fullName) : '..'}
                        </div>
                        <ChevronDown size={14} className={`hidden md:block text-slate-400 transition-transform duration-300 ${isUserMenuOpen && 'rotate-180'}`} />
                    </button>
                    {isUserMenuOpen && (
                        <div className="absolute left-0 top-14 w-64 glass rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 p-2 z-50">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 mb-2">
                                <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{currentUser?.fullName}</p>
                                <p className="text-xs text-slate-400 truncate">{currentUser?.email}</p>
                            </div>
                            <Link to={currentUser?.isAdmin ? "/admin/account-settings" : "/account-settings"} onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-colors">
                                <UserIcon size={16} /> <span>ملفي الشخصي</span>
                            </Link>
                            <a href="https://docs.wuilt.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-colors">
                                <div className="flex items-center gap-3">
                                    <Settings size={16} /> <span>مركز المساعدة</span>
                                </div>
                                <ExternalLink size={14} />
                            </a>
                            <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-2"></div>
                            <div className="px-4 py-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">المظهر</p>
                                <div className="flex bg-slate-100 dark:bg-slate-900/50 rounded-xl p-1 gap-1">
                                    <button onClick={() => setTheme('light')} className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 text-xs rounded-lg font-bold transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}><Sun size={14}/><span>فاتح</span></button>
                                    <button onClick={() => setTheme('dark')} className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 text-xs rounded-lg font-bold transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}><Moon size={14}/><span>داكن</span></button>
                                    <button onClick={() => setTheme('system')} className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 text-xs rounded-lg font-bold transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}><Monitor size={14}/><span>تلقائي</span></button>
                                </div>
                            </div>
                            <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-2"></div>
                            <button onClick={handleLogout} className="w-full text-right flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 font-bold text-sm transition-colors">
                                <LogOut size={16} /> <span>تسجيل الخروج</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
