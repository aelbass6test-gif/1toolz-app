// FIX: Import 'useMemo' from 'react' to resolve 'Cannot find name' error.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Store } from '../types';
import { Menu, ChevronDown, User as UserIcon, Settings, LogOut, ExternalLink, Replace, Sun, Moon, Monitor, ShieldAlert, Loader2, RefreshCw, Wifi, WifiOff, Database, Cloud, HardDrive, Activity, CheckCircle, Bell, AlertCircle, Package, Clock, ShoppingCart, HandCoins, Calendar, Calculator, Search, Command, X, FileText, MessageSquare, ClipboardList, Send, Trash2, Code } from 'lucide-react';
import { getSupabaseRestrictedStatus, isSupabaseActive, checkSupabaseConnection } from '../services/databaseService';
import { db as localDb } from '../src/lib/db';
import { audioSynth } from '../utils/audioSynth';
import { CommandPalette } from './CommandPalette';

const PATH_TITLES: { [key: string]: string } = {
    '/': 'الرئيسية',
    '/manage-stores': 'تغيير وإدارة المتاجر',
    '/create-store': 'إنشاء متجر جديد',
    '/admin/manage-stores': 'تغيير وإدارة المتاجر',
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
    forcePullFromCloud?: () => Promise<any>;
    saveStatus?: any;
    saveMessage?: string;
    unsavedChanges?: any[];
    inventoryAlerts?: any[];
    onOpenShippingCalculator?: () => void;
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
    forcePullFromCloud,
    saveStatus,
    saveMessage,
    unsavedChanges,
    inventoryAlerts = [],
    onOpenShippingCalculator
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const [isAlertsOpen, setIsAlertsOpen] = useState(false);
    const alertsMenuRef = useRef<HTMLDivElement>(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean>(typeof window !== 'undefined' ? window.navigator.onLine : true);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Notification filtering & dismiss state
    const [activeNotificationTab, setActiveNotificationTab] = useState<'all' | 'audit' | 'orders' | 'finance' | 'messages'>('all');
    const [notificationSearch, setNotificationSearch] = useState('');
    const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('wuilt_dismissed_alerts');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const handleDismissAlert = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const updated = [...dismissedIds, id];
        setDismissedIds(updated);
        try {
            localStorage.setItem('wuilt_dismissed_alerts', JSON.stringify(updated));
        } catch (err) {}
    };

    const handleClearAllAlerts = () => {
        const allIds = inventoryAlerts.map(a => a.id);
        const updated = Array.from(new Set([...dismissedIds, ...allIds]));
        setDismissedIds(updated);
        try {
            localStorage.setItem('wuilt_dismissed_alerts', JSON.stringify(updated));
        } catch (err) {}
    };

    const visibleAlerts = useMemo(() => {
        return inventoryAlerts.filter(a => !dismissedIds.includes(a.id));
    }, [inventoryAlerts, dismissedIds]);

    const tabCounts = useMemo(() => {
        const counts = { all: visibleAlerts.length, audit: 0, orders: 0, finance: 0, messages: 0 };
        visibleAlerts.forEach(a => {
            const cat = a.category || 'audit';
            if (cat === 'audit') counts.audit++;
            else if (cat === 'orders') counts.orders++;
            else if (cat === 'finance') counts.finance++;
            else if (cat === 'messages') counts.messages++;
        });
        return counts;
    }, [visibleAlerts]);

    const filteredAlerts = useMemo(() => {
        let result = visibleAlerts;
        if (activeNotificationTab !== 'all') {
            result = result.filter(a => (a.category || 'audit') === activeNotificationTab);
        }
        if (notificationSearch.trim()) {
            const q = notificationSearch.toLowerCase();
            result = result.filter(a =>
                (a.title || '').toLowerCase().includes(q) ||
                (a.message || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [visibleAlerts, activeNotificationTab, notificationSearch]);

    const handleAlertItemClick = (alertItem: any) => {
        setIsAlertsOpen(false);
        const rawLink = alertItem.link || '/inventory-audit';
        
        if (activeStore?.id) {
            let targetPath = rawLink;
            if (targetPath === '/inventory-audit') {
                targetPath = `/store/${activeStore.id}/suppliers?tab=audit`;
            } else if (!targetPath.startsWith(`/store/${activeStore.id}`)) {
                if (targetPath.startsWith('/store/')) {
                    // Already starts with store prefix, keep as is
                } else {
                    targetPath = `/store/${activeStore.id}${targetPath}`;
                }
            }
            navigate(targetPath);
        } else if (currentUser?.stores && currentUser.stores.length > 0) {
            const firstStoreId = currentUser.stores[0].id;
            let targetPath = rawLink;
            if (targetPath === '/inventory-audit') {
                targetPath = `/store/${firstStoreId}/suppliers?tab=audit`;
            } else if (!targetPath.startsWith(`/store/${firstStoreId}`)) {
                if (targetPath.startsWith('/store/')) {
                    // Already starts with store prefix
                } else {
                    targetPath = `/store/${firstStoreId}${targetPath}`;
                }
            }
            navigate(targetPath);
        } else {
            navigate(rawLink);
        }
    };

    useEffect(() => {
        const handleOpen = () => setIsCommandPaletteOpen(true);
        window.addEventListener('open-command-palette', handleOpen);
        return () => window.removeEventListener('open-command-palette', handleOpen);
    }, []);

    // Audio alarm logic
    useEffect(() => {
        if (inventoryAlerts.length > 0) {
            // Play a warning sound if there are critical alerts
            const hasCritical = inventoryAlerts.some(a => a.severity === 'critical');
            if (hasCritical) {
                audioSynth.playTone('error');
            } else {
                audioSynth.playTone('warning');
            }
        }
    }, [inventoryAlerts.length]);

    const location = useLocation();
    const [isRestricted, setIsRestricted] = useState(getSupabaseRestrictedStatus());

    const isStoreManagementOrCreationPage = useMemo(() => {
        const path = location.pathname;
        return (
            path === '/manage-stores' ||
            path === '/create-store' ||
            path === '/admin/manage-stores' ||
            path.endsWith('/manage-stores') ||
            path.endsWith('/create-store')
        );
    }, [location.pathname]);

    const handleManageStoresClick = () => {
        if (currentUser?.isAdmin) {
            navigate('/admin/manage-stores');
        } else {
            navigate('/manage-stores');
        }
    };

    const pageTitle = useMemo(() => {
        const path = location.pathname;
        const cleanPath = path.replace(/^\/store\/[^/]+/, '') || '/';
        const title = Object.entries(PATH_TITLES).find(([key, _]) => cleanPath.startsWith(key) && key !== '/');
        return PATH_TITLES[cleanPath] || (title ? title[1] : 'الرئيسية');
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
        if (!name) return "";
        const names = name.split(' ');
        return names.length > 1 && names[names.length - 1]
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    return (
        <>
            <header className="h-16 sm:h-20 bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-2xl border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40 flex-shrink-0 shadow-xs">
            <div className="flex items-center gap-2 sm:gap-4">
    {!isStoreManagementOrCreationPage && (
        <button onClick={onToggleSidebar} className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-300 cursor-pointer">
            <Menu size={22} />
        </button>
    )}
    <div className="flex items-center gap-2 sm:gap-3 max-w-[160px] sm:max-w-none">
        <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">{pageTitle}</h1>
        </div>
        {activeStore && !isStoreManagementOrCreationPage && (
            <div className="hidden sm:flex items-center gap-1.5">
                <span className="hidden lg:inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[10px] font-black rounded-lg border border-slate-200/80 dark:border-slate-700/80 font-mono">
                    ID: {activeStore.id.slice(-8)}
                </span>
                {isSupabaseActive() && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-200/80 dark:border-emerald-900/30">
                        <Database size={10} className="text-emerald-500" />
                        <span>Supabase Active</span>
                    </span>
                )}
            </div>
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

            <div className="flex items-center gap-1.5 sm:gap-3">
                {!isStoreManagementOrCreationPage && (
                    <>
                        {/* Quick Command Search Trigger Button */}
                        <button
                            onClick={() => setIsCommandPaletteOpen(true)}
                            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 transition-all text-xs font-black shadow-2xs hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            title="البحث السريع والتنقل (Ctrl+K)"
                        >
                            <Search size={14} className="text-indigo-500 animate-pulse" />
                            <span className="hidden md:inline text-[11px] font-bold">بحث سريع...</span>
                            <kbd className="hidden sm:inline-block font-mono text-[9px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md text-slate-500 dark:text-slate-400">
                                Ctrl+K
                            </kbd>
                        </button>

                        {activeStore && (
                            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs select-none transition-all shadow-2xs">
                                {saveStatus === 'saving' ? (
                                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-black">
                                        <Loader2 size={13} className="animate-spin" />
                                        <span className="text-[11px]">جاري الحفظ...</span>
                                    </div>
                                ) : !isOnline ? (
                                    <div className="flex items-center gap-1.5 text-rose-500 font-bold" title="لا يوجد اتصال إنترنت">
                                        <WifiOff size={13} />
                                        <span className="hidden sm:inline text-[11px]">غير متصل</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black" title="المتجر متصل بالسحابة وتعمل التحديثات أونلاين لحظياً">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <Cloud size={13} className="text-emerald-500" />
                                        <span className="hidden sm:inline text-[11px]">سحابي مباشر</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="relative" ref={alertsMenuRef}>
                            <button 
                                onClick={onOpenShippingCalculator}
                                title="حاسبة الشحن"
                                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                            >
                                <Calculator size={20} />
                            </button>
                        </div>

                        <div className="relative" ref={alertsMenuRef}>
                            <button 
                                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                                className={`p-2 rounded-xl transition-all relative ${isAlertsOpen ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <Bell size={20} className={visibleAlerts.length > 0 ? "animate-swing" : ""} />
                                {visibleAlerts.length > 0 && (
                                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-4 px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
                                        {visibleAlerts.length > 99 ? '99+' : visibleAlerts.length}
                                    </span>
                                )}
                            </button>
                            {isAlertsOpen && (
                                <div className="absolute left-0 top-14 w-80 sm:w-[420px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 z-[60] overflow-hidden flex flex-col max-h-[85vh]">
                                    {/* Header */}
                                    <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                                                <Bell size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-800 dark:text-white text-xs sm:text-sm">
                                                    مركز التنبيهات والرسائل
                                                </h3>
                                                <p className="text-[10px] text-slate-400 font-medium">متابعة إشعارات الجرد والطلبات والمالية والمحادثات</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {visibleAlerts.length > 0 && (
                                                <button
                                                    onClick={handleClearAllAlerts}
                                                    title="مسح الكل"
                                                    className="px-2 py-1 bg-slate-200/60 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <Trash2 size={12} />
                                                    <span>مسح الكل</span>
                                                </button>
                                            )}
                                            <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full">
                                                {visibleAlerts.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Search input */}
                                    <div className="px-3 pt-2 pb-1 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/60">
                                        <div className="relative">
                                            <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                                            <input
                                                type="text"
                                                value={notificationSearch}
                                                onChange={e => setNotificationSearch(e.target.value)}
                                                placeholder="البحث في التنبيهات..."
                                                className="w-full pr-8 pl-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-white rounded-xl border-none focus:ring-1 focus:ring-amber-500 outline-none"
                                            />
                                            {notificationSearch && (
                                                <button
                                                    onClick={() => setNotificationSearch('')}
                                                    className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Category Filter Tabs */}
                                    <div className="flex items-center gap-1 p-1.5 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 overflow-x-auto no-scrollbar">
                                        <button
                                            onClick={() => setActiveNotificationTab('all')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                                activeNotificationTab === 'all'
                                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            <span>الكل</span>
                                            {tabCounts.all > 0 && (
                                                <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full text-[9px]">
                                                    {tabCounts.all}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => setActiveNotificationTab('audit')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                                activeNotificationTab === 'audit'
                                                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            <Package size={12} />
                                            <span>الجرد والمخزن</span>
                                            {tabCounts.audit > 0 && (
                                                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px]">
                                                    {tabCounts.audit}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => setActiveNotificationTab('orders')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                                activeNotificationTab === 'orders'
                                                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            <ShoppingCart size={12} />
                                            <span>الطلبات</span>
                                            {tabCounts.orders > 0 && (
                                                <span className="px-1.5 py-0.2 bg-blue-500 text-white rounded-full text-[9px]">
                                                    {tabCounts.orders}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => setActiveNotificationTab('finance')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                                activeNotificationTab === 'finance'
                                                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            <HandCoins size={12} />
                                            <span>المالية</span>
                                            {tabCounts.finance > 0 && (
                                                <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[9px]">
                                                    {tabCounts.finance}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => setActiveNotificationTab('messages')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                                activeNotificationTab === 'messages'
                                                    ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            <MessageSquare size={12} />
                                            <span>المحادثات</span>
                                            {tabCounts.messages > 0 && (
                                                <span className="px-1.5 py-0.2 bg-purple-500 text-white rounded-full text-[9px]">
                                                    {tabCounts.messages}
                                                </span>
                                            )}
                                        </button>
                                    </div>

                                    {/* List */}
                                    <div className="max-h-[360px] overflow-y-auto p-2 space-y-2 no-scrollbar">
                                        {filteredAlerts.length === 0 ? (
                                            <div className="py-10 text-center space-y-2">
                                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                                                    <CheckCircle size={24} />
                                                </div>
                                                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">لا توجد إشعارات حالياً</p>
                                                <p className="text-[11px] text-slate-400">كل الأمور مستقرة ومحدثة في هذا القسم!</p>
                                            </div>
                                        ) : (
                                            filteredAlerts.map(alert => (
                                                <div 
                                                    key={alert.id} 
                                                    onClick={() => handleAlertItemClick(alert)}
                                                    className={`p-3 rounded-xl border flex gap-3 transition-all cursor-pointer relative group hover:shadow-md ${
                                                        alert.severity === 'critical' 
                                                            ? 'bg-rose-50/90 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 hover:bg-rose-100/90' 
                                                            : alert.category === 'messages' || alert.type === 'team_message'
                                                                ? 'bg-purple-50/90 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/40 hover:bg-purple-100/90'
                                                            : alert.category === 'finance'
                                                                ? 'bg-emerald-50/90 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 hover:bg-emerald-100/90'
                                                            : alert.type === 'audit_overdue' || alert.type === 'pending_order'
                                                                ? 'bg-blue-50/90 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40 hover:bg-blue-100/90'
                                                            : 'bg-amber-50/90 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 hover:bg-amber-100/90'
                                                    }`}
                                                >
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                                                        alert.severity === 'critical' ? 'bg-rose-500 text-white' :
                                                        alert.category === 'messages' || alert.type === 'team_message' ? 'bg-purple-600 text-white' :
                                                        alert.type === 'shared_audit_submitted' ? 'bg-indigo-600 text-white' :
                                                        alert.type === 'shared_audit_rejected' ? 'bg-rose-600 text-white' :
                                                        alert.type === 'shared_audit_pending' ? 'bg-amber-500 text-white' :
                                                        alert.category === 'finance' ? 'bg-emerald-600 text-white' :
                                                        alert.category === 'orders' ? 'bg-blue-600 text-white' :
                                                        'bg-amber-500 text-white'
                                                    }`}>
                                                        {alert.type === 'low_stock' ? <Package size={17} /> : 
                                                         alert.type === 'team_message' ? <MessageSquare size={17} /> :
                                                         alert.type === 'shared_audit_submitted' ? <Send size={17} /> :
                                                         alert.type === 'shared_audit_rejected' ? <ShieldAlert size={17} /> :
                                                         alert.type === 'shared_audit_pending' ? <ClipboardList size={17} /> :
                                                         alert.type === 'pending_order' ? <Activity size={17} /> :
                                                         alert.type === 'supplier_debt' ? <Database size={17} /> :
                                                         alert.type === 'expiry' || alert.type === 'expiry_expired' ? <Calendar size={17} /> :
                                                         alert.type === 'cash_balance' ? <HandCoins size={17} /> :
                                                         alert.type === 'abandoned_cart' ? <ShoppingCart size={17} /> :
                                                         <Bell size={17} />}
                                                    </div>
                                                    <div className="flex-1 text-right pl-6">
                                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                                            <h4 className="text-xs font-black text-slate-800 dark:text-white leading-snug">{alert.title}</h4>
                                                            {alert.category && (
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                    {alert.category === 'audit' ? 'الجرد والمخزن' :
                                                                     alert.category === 'orders' ? 'الطلبات' :
                                                                     alert.category === 'finance' ? 'المالية' :
                                                                     alert.category === 'messages' ? 'المحادثات' : 'تنبيه'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{alert.message}</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDismissAlert(alert.id, e)}
                                                        title="إخفاء التنبيه"
                                                        className="absolute top-2 left-2 p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-white/60 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                                        <Link 
                                            to={activeStore ? `/store/${activeStore.id}/suppliers?tab=audit` : "/inventory-audit"} 
                                            onClick={() => setIsAlertsOpen(false)}
                                            className="flex-1 py-1.5 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-black text-center transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <Package size={13} />
                                            <span>صفحة الجرد والمخازن</span>
                                        </Link>
                                        <Link 
                                            to={activeStore ? `/store/${activeStore.id}/team-chat` : "/team-chat"} 
                                            onClick={() => setIsAlertsOpen(false)}
                                            className="flex-1 py-1.5 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-black text-center transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <MessageSquare size={13} />
                                            <span>دردشة الفريق</span>
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {!isStoreManagementOrCreationPage && (
                    <button 
                        onClick={handleManageStoresClick}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                    >
                        <Replace size={16} />
                        <span>تغيير المتجر</span>
                    </button>
                )}
                
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
                            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 mb-2">
                                <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{currentUser?.fullName}</p>
                                <p className="text-xs text-slate-400 truncate">{currentUser?.email}</p>
                            </div>
                            <Link to={currentUser?.isAdmin ? "/admin/account-settings" : "/account-settings"} onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-colors">
                                <UserIcon size={16} /> <span>ملفي الشخصي</span>
                            </Link>
                            <Link to="/docs" onClick={() => setIsUserMenuOpen(false)} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-sm transition-colors">
                                <div className="flex items-center gap-3">
                                    <Code size={16} /> <span>توثيق الـ API والربط</span>
                                </div>
                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded font-mono">v1.0</span>
                            </Link>
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

        {/* Command Palette Overlay */}
        <CommandPalette 
            isOpen={isCommandPaletteOpen} 
            onClose={() => setIsCommandPaletteOpen(false)} 
            activeStore={activeStore}
        />
    </>
);
};

export default Header;
