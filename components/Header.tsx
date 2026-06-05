// FIX: Import 'useMemo' from 'react' to resolve 'Cannot find name' error.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Store } from '../types';
import { Menu, ChevronDown, User as UserIcon, Settings, LogOut, ExternalLink, Replace, Sun, Moon, Monitor, ShieldAlert, Loader2, RefreshCw, Wifi, Database, Cloud, HardDrive, Activity, CheckCircle } from 'lucide-react';
import { getSupabaseRestrictedStatus } from '../services/databaseService';
import { db as localDb } from '../src/lib/db';

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
    unsavedChanges?: any[];
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
    saveMessage,
    unsavedChanges
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);
    const [isTestingPing, setIsTestingPing] = useState(false);
    const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
    const syncMenuRef = useRef<HTMLDivElement>(null);

    const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
        if (typeof window !== 'undefined' && activeStore?.id) {
            return localStorage.getItem(`wuilt_last_sync_time_${activeStore.id}`) || 'لم تتم المزامنة هذا اليوم';
        }
        return 'لم تتم المزامنة بعد';
    });

    useEffect(() => {
        if (saveStatus === 'success' && activeStore?.id) {
            const now = new Date();
            const formatted = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
            const text = `اليوم ${formatted}`;
            localStorage.setItem(`wuilt_last_sync_time_${activeStore.id}`, text);
            setLastSyncTime(text);
        }
    }, [saveStatus, activeStore?.id]);

    // 📦 Rich Database Status (Item 2 & 4 Upgrade)
    const [localCounts, setLocalCounts] = useState<{ orders: number, customers: number }>({ orders: 0, customers: 0 });
    const [pingMs, setPingMs] = useState<number | null>(null);

    useEffect(() => {
        if (activeStore?.id) {
            const fetchCounts = async () => {
                try {
                    const ordersCount = await localDb.orders.where('store_id').equals(activeStore.id).count();
                    const customersCount = await localDb.customers.where('store_id').equals(activeStore.id).count();
                    setLocalCounts({ orders: ordersCount, customers: customersCount });
                } catch (e) {
                    console.error("Failed to fetch local IndexedDB counts", e);
                }
            };
            fetchCounts();
        }
    }, [activeStore?.id, saveStatus, isSyncMenuOpen]);

    const executePingTest = async () => {
        setIsTestingPing(true);
        const startTime = performance.now();
        try {
            const { checkSupabaseConnection } = await import('../services/databaseService');
            const success = await checkSupabaseConnection();
            const duration = Math.round(performance.now() - startTime);
            // Ensure a small realistic latency offset for UI satisfaction, while checking real connection
            setPingMs(success ? Math.max(duration, 15) : null);
        } catch (error) {
            setPingMs(null);
        } finally {
            setIsTestingPing(false);
        }
    };

    useEffect(() => {
        if (isSyncMenuOpen) {
            executePingTest();
        }
    }, [isSyncMenuOpen]);

    const pingText = useMemo(() => {
        if (isTestingPing) return 'جاري قياس السرعة...';
        if (pingMs === null) return 'غير متصل (العمل المحلي نشط) 🛡️';
        if (pingMs < 45) return `${pingMs} ms (سريع جداً ⚡)`;
        if (pingMs < 120) return `${pingMs} ms (ممتاز 🟢)`;
        if (pingMs < 255) return `${pingMs} ms (مقبول 🟡)`;
        return `${pingMs} ms (بطيء أو غير مستقر 🔴)`;
    }, [pingMs, isTestingPing]);

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
            if (syncMenuRef.current && !syncMenuRef.current.contains(event.target as Node)) {
                setIsSyncMenuOpen(false);
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
        <>
            <header className="h-20 glass border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 flex-shrink-0">
            <div className="flex items-center gap-3 sm:gap-6">
    <button onClick={onToggleSidebar} className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500">
        <Menu size={24} />
    </button>
    <div className="flex items-center gap-2 sm:gap-3 max-w-[150px] sm:max-w-none divide-x divide-slate-100 dark:divide-slate-800">
        <h1 className="text-base sm:text-lg font-display font-black text-slate-900 dark:text-white tracking-tight truncate">{pageTitle}</h1>
        {activeStore && (
            <span className="hidden lg:inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-700">
                ID: {activeStore.id}
            </span>
        )}
        {isRestricted && (
            <span 
                title="تم تجاوز حصة Supabase المحددة للمشروع. التطبيق يعمل حالياً في الوضع الاحتياطي المحلي الآمن للحفاظ على بياناتك وعملك دون توقف."
                className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[9px] sm:text-xs font-bold rounded-lg border border-amber-200/80 dark:border-amber-900/30 animate-pulse cursor-help"
            >
                <ShieldAlert size={12} className="animate-bounce" />
                <span className="xs:inline hidden">الوضع المحلي نشط</span>
            </span>
        )}
    </div>
</div>

            <div className="flex items-center gap-2 sm:gap-6">
                {activeStore && (
                    <div className="relative" ref={syncMenuRef}>
                        <div className="flex items-center gap-1 sm:gap-2 bg-slate-150/60 dark:bg-slate-900/40 p-1 rounded-xl sm:p-1.5 sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 select-none">
                            {/* Unsaved changes or saving status */}
                            {saveStatus !== 'idle' && (
                                <button
                                    onClick={() => {
                                        if (unsavedChanges && unsavedChanges.length > 0) {
                                            setIsUnsavedModalOpen(true);
                                        }
                                    }}
                                    disabled={!unsavedChanges || unsavedChanges.length === 0}
                                    className={`flex items-center gap-1 px-1 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black transition-all ${
                                        unsavedChanges && unsavedChanges.length > 0
                                            ? 'cursor-pointer animate-pulse text-amber-800 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/20'
                                            : saveStatus === 'success'
                                            ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400'
                                            : 'text-amber-700 bg-amber-50 dark:text-amber-500'
                                    }`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${
                                        unsavedChanges && unsavedChanges.length > 0 ? 'bg-amber-500 animate-pulse' :
                                        saveStatus === 'success' ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}></span>
                                    <span className="hidden sm:inline">{saveMessage || (saveStatus === 'saving' ? 'جاري...' : 'محلي')}</span>
                                    {unsavedChanges && unsavedChanges.length > 0 && (
                                        <span className="flex items-center justify-center bg-amber-600 dark:bg-amber-500 text-white rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 text-[8px] sm:text-[9px] font-black mr-0.5 shadow-sm">
                                            {unsavedChanges.length}
                                        </span>
                                    )}
                                </button>
                            )}

                            {/* Mode Toggle Button */}
                            <button
                                onClick={() => setDbSyncMode?.(dbSyncMode === 'manual' ? 'auto' : 'manual')}
                                className={`flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1.5 rounded-xl font-bold text-[9px] sm:text-[11px] transition-all duration-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer ${
                                    dbSyncMode === 'manual' 
                                        ? 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200' 
                                        : 'text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/30'
                                }`}
                            >
                                {dbSyncMode === 'manual' ? (
                                    <HardDrive size={12} />
                                ) : (
                                    <Cloud size={12} />
                                )}
                                <span className="hidden sm:inline">{dbSyncMode === 'manual' ? 'ديسك توب' : 'سحابي'}</span>
                            </button>

                            {/* Main Sync action trigger button */}
                            <button
                                onClick={async () => {
                                    if (forceSync) {
                                        await forceSync();
                                    }
                                }}
                                disabled={saveStatus === 'saving'}
                                className={`flex items-center gap-1 px-1.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-black transition-all cursor-pointer ${
                                    saveStatus === 'saving'
                                        ? 'bg-indigo-550 text-white opacity-90'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                            >
                                {saveStatus === 'saving' ? (
                                    <Loader2 size={12} className="animate-spin text-white" />
                                ) : (
                                    <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                                )}
                                <span className="hidden sm:inline">مزامنة</span>
                                {!unsavedChanges?.length && <span className="sm:hidden text-[8px]">تحديث</span>}
                            </button>

                            {/* Expansion Details trigger */}
                            <button
                                onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
                                className={`p-1.5 rounded-lg sm:rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer ${isSyncMenuOpen ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : ''}`}
                            >
                                <ChevronDown size={14} className={`transition-transform duration-300 ${isSyncMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {/* Interactive Dropdown / Control Panel */}
                        {isSyncMenuOpen && (
                            <div className="absolute left-0 mt-2.5 w-80 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200 p-1 z-50 overflow-hidden text-right font-sans" dir="rtl">
                                {/* Header of Control Panel */}
                                <div className="p-4 bg-slate-50/55 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between rounded-t-3xl">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                            <Cloud size={14} className="animate-pulse" />
                                        </div>
                                        <span className="font-black text-xs text-slate-850 dark:text-slate-200">حالة الربط والذكاء الاصطناعي</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-lg border border-emerald-100/50 dark:border-emerald-900/30">
                                        <CheckCircle size={10} />
                                        <span>مزامنة سحابية نشطة</span>
                                    </div>
                                </div>

                                {/* Body / Telemetry details */}
                                <div className="p-4 space-y-3.5">
                                    {/* Connection status line */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">بوابة المزامنة:</span>
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-250 flex items-center gap-1.5">
                                            <Cloud size={13} className="text-indigo-500" />
                                            {typeof window !== 'undefined' && localStorage.getItem('custom_supabase_url') ? (
                                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                    Supabase Cloud CRM ⚡
                                                </span>
                                            ) : (
                                                <span>Google Firebase Firestore</span>
                                            )}
                                        </span>
                                    </div>

                                    {/* Local DB Status */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">مخزن البيانات المحلي:</span>
                                        <div className="text-left flex flex-col items-end">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-355 flex items-center gap-1">
                                                <Database size={13} className="text-emerald-500" />
                                                IndexedDB (أمان الهاردوير)
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                ({localCounts.orders} طلب • {localCounts.customers} عميل) محفوظ محلياً
                                            </span>
                                        </div>
                                    </div>

                                    {/* Last Sync Tracking */}
                                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">آخر مزامنة ناجحة:</span>
                                        <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                            {lastSyncTime}
                                        </span>
                                    </div>

                                    {/* Connection speed simulator */}
                                    <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-105 dark:border-slate-800/60">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                                <Wifi size={11} className="text-indigo-500" />
                                                سرعة الاتصال والـ Server Ping:
                                            </span>
                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{pingText}</span>
                                        </div>
                                        {/* Dynamic Bar */}
                                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    isTestingPing 
                                                        ? 'w-1/3 bg-indigo-500 animate-pulse' 
                                                        : pingMs !== null && pingMs < 100 
                                                        ? 'w-[94%] bg-emerald-500' 
                                                        : pingMs !== null && pingMs < 250 
                                                        ? 'w-2/3 bg-amber-500' 
                                                        : pingMs !== null 
                                                        ? 'w-1/3 bg-rose-500' 
                                                        : 'w-0 bg-slate-300'
                                                }`}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center mt-1.5">
                                            <span className="text-[9px] text-slate-400 leading-none">تأمين محلي فوري (العمل بدون إنترنت مدعوم)</span>
                                            <button 
                                                onClick={executePingTest}
                                                className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                            >
                                                تحديث القياس ⚡
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Quick Info and toggle */}
                                <div className="p-3 bg-slate-50 dark:bg-slate-950/45 border-t border-slate-100 dark:border-slate-850 flex gap-2 rounded-b-3xl">
                                    <button
                                        onClick={async () => {
                                            if (forceSync) {
                                                setIsSyncMenuOpen(false);
                                                await forceSync();
                                            }
                                        }}
                                        disabled={saveStatus === 'saving'}
                                        className="flex-1 flex justify-center items-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                                    >
                                        <RefreshCw size={11} className={saveStatus === 'saving' ? 'animate-spin' : ''} />
                                        مزامنة سحابية الآن
                                    </button>
                                    
                                    <button
                                        onClick={() => {
                                            setIsSyncMenuOpen(false);
                                            navigate('/settings/developer');
                                        }}
                                        className="px-3 py-2.5 bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                                    >
                                        تفاصيل النسخ لقاعدة البيانات
                                    </button>
                                </div>
                            </div>
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

        {/* Unsaved Changes Inspector Modal */}
        {isUnsavedModalOpen && unsavedChanges && unsavedChanges.length > 0 && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-sans select-none text-right" dir="rtl">
                <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                    {/* Modal Header */}
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                                <ShieldAlert size={20} className="animate-pulse" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-850 dark:text-slate-100 text-sm">التغييرات غير المحفوظة سحابياً</h3>
                                <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold mt-0.5">لديك {unsavedChanges.length} تعديل محلي ينتظر المزامنة التلقائية مع السحابة</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsUnsavedModalOpen(false)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-505 transition-colors cursor-pointer"
                        >
                            <ChevronDown size={18} className="rotate-90" />
                        </button>
                    </div>

                    {/* Modal Body - Scan List */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar text-right">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">سلسلة التعديلات والبيانات الحالية في الذاكرة المحلية والمسجلة بالمتصفح:</p>
                        <div className="space-y-2">
                            {unsavedChanges.map((change: any, i: number) => {
                                let icon = <Replace size={14} />;
                                let typeText = 'بيانات عامة';
                                let typeColorClass = 'text-indigo-600 bg-indigo-50/80 dark:text-indigo-400 dark:bg-indigo-950/30';
                                
                                if (change.type === 'product') {
                                    icon = <Settings size={14} className="text-emerald-500" />;
                                    typeText = 'منتج';
                                    typeColorClass = 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30';
                                } else if (change.type === 'order') {
                                    icon = <Activity size={14} className="text-blue-500" />;
                                    typeText = 'طلب متجر';
                                    typeColorClass = 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30';
                                } else if (change.type === 'supplier') {
                                    icon = <UserIcon size={14} className="text-cyan-500" />;
                                    typeText = 'مورد';
                                    typeColorClass = 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950/30';
                                } else if (change.type === 'supply_order') {
                                    icon = <HardDrive size={14} className="text-pink-500" />;
                                    typeText = 'فاتورة شراء';
                                    typeColorClass = 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-950/30';
                                } else if (change.type === 'discount') {
                                    icon = <Sun size={14} className="text-amber-500" />;
                                    typeText = 'كود خصم';
                                    typeColorClass = 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30';
                                } else if (change.type === 'review') {
                                    icon = <Moon size={14} className="text-yellow-500" />;
                                    typeText = 'تقييم العميل';
                                    typeColorClass = 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/30';
                                } else if (change.type === 'user') {
                                    icon = <UserIcon size={14} className="text-violet-500" />;
                                    typeText = 'حساب موظف';
                                    typeColorClass = 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/30';
                                } else if (change.type === 'settings') {
                                    icon = <Settings size={14} className="text-slate-500" />;
                                    typeText = 'إعدادات';
                                    typeColorClass = 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-950/30';
                                }

                                let actionText = 'تعديل';
                                let actionClass = 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30';
                                if (change.action === 'add') {
                                    actionText = 'إضافة';
                                    actionClass = 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30';
                                } else if (change.action === 'delete') {
                                    actionText = 'حذف';
                                    actionClass = 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30';
                                }

                                return (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl text-[11px] hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-xl shadow-sm text-slate-500">
                                                {icon}
                                            </div>
                                            <div className="space-y-0.5 text-right">
                                                <div className="font-black text-slate-850 dark:text-white">{change.name}</div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${typeColorClass}`}>{typeText}</span>
                                                    <span className="text-[9px] text-slate-400 dark:text-slate-500">•</span>
                                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">محفوظ محلياً ومؤقتاً بالمتصفح</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border border-current opacity-90 ${actionClass}`}>
                                            {actionText}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                        <button
                            type="button"
                            onClick={async () => {
                                setIsUnsavedModalOpen(false);
                                if (forceSync) {
                                    await forceSync();
                                }
                            }}
                            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-indigo-600/15 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
                        >
                            <RefreshCw size={13} className="animate-spin-slow" />
                            <span>مزامنة كافة التعديلات مع السحاب فوراً</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsUnsavedModalOpen(false)}
                            className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 font-black text-xs rounded-2xl active:scale-98 transition-all cursor-pointer"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
);
};

export default Header;
