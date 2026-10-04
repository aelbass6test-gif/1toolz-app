import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Store } from '../types';
import { 
    Menu, 
    ChevronDown, 
    User as UserIcon, 
    Settings, 
    LogOut, 
    ExternalLink, 
    Replace, 
    Sun, 
    Moon, 
    Monitor, 
    ShieldAlert, 
    Loader2, 
    RefreshCw, 
    Wifi, 
    WifiOff, 
    Database, 
    Cloud, 
    Activity, 
    CheckCircle, 
    CheckCircle2,
    Bell, 
    AlertCircle, 
    Package, 
    Clock, 
    ShoppingCart, 
    HandCoins, 
    Calendar, 
    Calculator, 
    Search, 
    X, 
    FileText, 
    MessageSquare, 
    ClipboardList, 
    Send, 
    Trash2, 
    Code, 
    PanelLeftClose, 
    PanelLeftOpen, 
    Store as StoreIcon,
    Sparkles,
    ArrowUpRight
} from 'lucide-react';
import { getSupabaseRestrictedStatus, isSupabaseActive, checkSupabaseConnection } from '../services/databaseService';
import { db as localDb } from '../src/lib/db';
import { audioSynth } from '../utils/audioSynth';
import { CommandPalette } from './CommandPalette';

const PATH_TITLES: { [key: string]: string } = {
    '/select-store': 'إدارة المتاجر',
    '/manage-stores': 'إدارة المتاجر',
    '/projects': 'إدارة المشاريع',
    '/create-store': 'إنشاء متجر جديد',
    '/admin/manage-stores': 'إدارة المتاجر',
    '/': 'لوحة التحكم',
    '/confirmation-queue': 'تأكيد الطلبات',
    '/orders': 'الطلبات والمبيعات',
    '/abandoned-carts': 'السلات المتروكة',
    '/products': 'كتالوج المنتجات',
    '/suppliers': 'الموردين والمخزون',
    '/customers': 'قاعدة العملاء',
    '/marketing': 'مساعد التسويق الذكي',
    '/discounts': 'كوبونات الخصم',
    '/shipping': 'الشحن واللوجستيات',
    '/wallet': 'المحفظة والأرباح',
    '/collections-report': 'التحصيلات النقدية',
    '/customize-store': 'تخصيص المظهر',
    '/pages': 'الصفحات الثابتة',
    '/reports': 'التحليلات الذكية',
    '/standard-reports': 'مركز التقارير',
    '/activity-logs': 'سجل النشاطات',
    '/settings': 'الإعدادات العامة',
    '/settings/employees': 'الموظفون والصلاحيات',
    '/admin/account-settings': 'إعدادات الحساب',
    '/account-settings': 'إعدادات الحساب',
};

interface HeaderProps {
    currentUser: User | null;
    onLogout: () => void;
    onToggleSidebar: () => void;
    isDesktopSidebarCollapsed?: boolean;
    onToggleDesktopSidebar?: () => void;
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
    isDesktopSidebarCollapsed = false,
    onToggleDesktopSidebar,
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
                if (!targetPath.startsWith('/store/')) {
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
                if (!targetPath.startsWith('/store/')) {
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
            path === '/' ||
            path === '/select-store' ||
            path === '/projects' ||
            path === '/manage-stores' ||
            path === '/create-store' ||
            path === '/admin/manage-stores' ||
            path.endsWith('/select-store') ||
            path.endsWith('/projects') ||
            path.endsWith('/manage-stores') ||
            path.endsWith('/create-store')
        );
    }, [location.pathname]);

    const handleManageStoresClick = () => {
        if (currentUser?.isAdmin) {
            navigate('/admin/manage-stores');
        } else {
            navigate('/select-store');
        }
    };

    const pageTitle = useMemo(() => {
        const path = location.pathname;
        const cleanPath = path.replace(/^\/store\/[^/]+/, '') || '/';
        const title = Object.entries(PATH_TITLES).find(([key, _]) => cleanPath.startsWith(key) && key !== '/');
        return PATH_TITLES[cleanPath] || (title ? title[1] : 'لوحة التحكم');
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
            if (alertsMenuRef.current && !alertsMenuRef.current.contains(event.target as Node)) {
                setIsAlertsOpen(false);
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
        if (!name) return "م";
        const parts = name.trim().split(/\s+/);
        if (parts.length > 1) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const storefrontUrl = useMemo(() => {
        if (!activeStore) return null;
        if (activeStore.customDomain) {
            return `https://${activeStore.customDomain}`;
        }
        return `/store/${activeStore.id}`;
    }, [activeStore]);

    return (
        <>
            <header className="h-16 bg-white/85 dark:bg-[#0c131a]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between px-3 sm:px-5 lg:px-6 sticky top-0 z-40 flex-shrink-0 transition-colors duration-200">
                
                {/* Right Zone (RTL Start): Context & Breadcrumbs */}
                <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    {!isStoreManagementOrCreationPage && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Mobile Drawer Toggle */}
                            <button 
                                onClick={onToggleSidebar} 
                                className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                                title="فتح القائمة الجانبية"
                                aria-label="فتح القائمة الجانبية"
                            >
                                <Menu size={20} />
                            </button>

                            {/* Desktop Sidebar Toggle Button */}
                            {onToggleDesktopSidebar && (
                                <button
                                    onClick={onToggleDesktopSidebar}
                                    className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                                        isDesktopSidebarCollapsed 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs' 
                                            : 'bg-slate-100/70 text-slate-600 border-slate-200/80 hover:bg-slate-200/60 hover:text-slate-900 dark:bg-white/[0.05] dark:text-slate-300 dark:border-white/[0.08] dark:hover:bg-white/[0.09] dark:hover:text-white'
                                    }`}
                                    title={isDesktopSidebarCollapsed ? "إظهار الشريط الجانبي (Ctrl + B)" : "طي الشريط وتوسيع الشاشة (Ctrl + B)"}
                                >
                                    {isDesktopSidebarCollapsed ? (
                                        <>
                                            <PanelLeftOpen size={15} className="text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-[11px] font-bold">توسيع القائمة</span>
                                        </>
                                    ) : (
                                        <>
                                            <PanelLeftClose size={15} />
                                            <span className="text-[11px]">طي القائمة</span>
                                        </>
                                    )}
                                    <kbd className="hidden lg:inline-block px-1 py-0.2 text-[9px] font-mono bg-white/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-800">
                                        ⌘B
                                    </kbd>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Breadcrumbs & Active Store Identity */}
                    <div className="flex items-center gap-2 min-w-0">
                        {activeStore && !isStoreManagementOrCreationPage ? (
                            <div className="flex items-center gap-1.5 text-xs truncate">
                                <button
                                    onClick={handleManageStoresClick}
                                    className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-bold transition-colors group cursor-pointer"
                                    title="انقر لتغيير المتجر"
                                >
                                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-black text-[11px] group-hover:scale-105 transition-transform">
                                        <StoreIcon size={12} />
                                    </div>
                                    <span className="max-w-[120px] md:max-w-[150px] truncate text-[12px] font-bold">
                                        {activeStore.name}
                                    </span>
                                </button>

                                <span className="hidden sm:inline-block text-slate-300 dark:text-slate-700 font-light select-none">/</span>

                                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                                    {pageTitle}
                                </h1>
                            </div>
                        ) : (
                            <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                                {pageTitle}
                            </h1>
                        )}

                        {/* Live Sync Status Indicator */}
                        {activeStore && !isStoreManagementOrCreationPage && (
                            <div className="hidden xl:flex items-center gap-1.5 select-none">
                                {saveStatus === 'saving' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                                        <Loader2 size={11} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                                        <span>جاري الحفظ...</span>
                                    </span>
                                ) : !isOnline ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40">
                                        <WifiOff size={11} />
                                        <span>غير متصل</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40" title="المتجر متصل بالسحابة وتعمل التحديثات لحظياً">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                        </span>
                                        <span>سحابي مباشر</span>
                                    </span>
                                )}

                                {isRestricted && (
                                    <span 
                                        title="الوضع الاحتياطي المحلي نشط لحماية بياناتك"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40"
                                    >
                                        <ShieldAlert size={11} />
                                        <span>محلي</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Zone: Sleek Spotlight Search Trigger */}
                {!isStoreManagementOrCreationPage && (
                    <div className="hidden md:flex items-center justify-center flex-1 max-w-sm px-4">
                        <button
                            onClick={() => setIsCommandPaletteOpen(true)}
                            className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 transition-all text-xs group cursor-pointer shadow-2xs hover:border-slate-300 dark:hover:border-white/[0.14]"
                            title="البحث السريع والتنقل في النظام (Ctrl+K)"
                            aria-label="البحث السريع"
                        >
                            <div className="flex items-center gap-2">
                                <Search size={14} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                <span className="font-medium text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                                    بحث سريع أو أمر...
                                </span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <kbd className="font-mono text-[9px] bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded-md shadow-2xs">
                                    Ctrl+K
                                </kbd>
                            </div>
                        </button>
                    </div>
                )}

                {/* Left Zone (RTL End): Actions & Profile */}
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                    {!isStoreManagementOrCreationPage && (
                        <>
                            {/* Mobile Search Button */}
                            <button
                                onClick={() => setIsCommandPaletteOpen(true)}
                                className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                                title="البحث السريع"
                                aria-label="البحث السريع"
                            >
                                <Search size={18} />
                            </button>

                            {/* Live Storefront Preview Link */}
                            {storefrontUrl && (
                                <a
                                    href={storefrontUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/70 dark:text-slate-300 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/30 transition-all border border-transparent hover:border-emerald-200/60 dark:hover:border-emerald-800/40 cursor-pointer"
                                    title="معاينة المتجر المباشر في تبويب جديد"
                                >
                                    <StoreIcon size={14} className="text-emerald-500" />
                                    <span>زيارة المتجر</span>
                                    <ArrowUpRight size={12} className="opacity-60" />
                                </a>
                            )}

                            {/* Shipping Calculator Trigger */}
                            {onOpenShippingCalculator && (
                                <button 
                                    onClick={onOpenShippingCalculator}
                                    title="حاسبة الشحن التفاعلية"
                                    aria-label="حاسبة الشحن التفاعلية"
                                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                                >
                                    <Calculator size={18} />
                                </button>
                            )}

                            {/* Notification Center */}
                            <div className="relative" ref={alertsMenuRef}>
                                <button 
                                    onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                                    aria-label="مركز التنبيهات"
                                    className={`p-2 rounded-xl transition-all relative cursor-pointer ${
                                        isAlertsOpen 
                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' 
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
                                    }`}
                                >
                                    <Bell size={18} className={visibleAlerts.length > 0 ? "animate-swing" : ""} />
                                    {visibleAlerts.length > 0 && (
                                        <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#0c131a] shadow-xs">
                                            {visibleAlerts.length > 99 ? '99+' : visibleAlerts.length}
                                        </span>
                                    )}
                                </button>

                                {/* Notification Popover */}
                                {isAlertsOpen && (
                                    <div className="absolute left-0 top-12 w-80 sm:w-[400px] bg-white dark:bg-[#0f1722] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-white/[0.1] z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
                                        {/* Popover Header */}
                                        <div className="p-3.5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                                                    <Bell size={16} />
                                                </div>
                                                <div>
                                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                        مركز التنبيهات
                                                    </h3>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                        إشعارات الجرد، الطلبات، والمالية
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {visibleAlerts.length > 0 && (
                                                    <button
                                                        onClick={handleClearAllAlerts}
                                                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-white/[0.05] dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                                        title="مسح كافة التنبيهات"
                                                    >
                                                        <Trash2 size={11} />
                                                        <span>مسح الكل</span>
                                                    </button>
                                                )}
                                                <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full">
                                                    {visibleAlerts.length}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Quick Search */}
                                        <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.05]">
                                            <div className="relative">
                                                <Search size={13} className="absolute right-3 top-2.5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={notificationSearch}
                                                    onChange={e => setNotificationSearch(e.target.value)}
                                                    placeholder="البحث في الإشعارات..."
                                                    className="w-full pr-8 pl-3 py-1.5 bg-slate-100/80 dark:bg-white/[0.05] text-xs text-slate-900 dark:text-white rounded-xl border-none focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-slate-400"
                                                />
                                                {notificationSearch && (
                                                    <button
                                                        onClick={() => setNotificationSearch('')}
                                                        className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Category Tabs */}
                                        <div className="flex items-center gap-1 p-1.5 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] overflow-x-auto no-scrollbar">
                                            {[
                                                { id: 'all', label: 'الكل', count: tabCounts.all },
                                                { id: 'audit', label: 'الجرد والمخزن', count: tabCounts.audit, icon: Package },
                                                { id: 'orders', label: 'الطلبات', count: tabCounts.orders, icon: ShoppingCart },
                                                { id: 'finance', label: 'المالية', count: tabCounts.finance, icon: HandCoins },
                                                { id: 'messages', label: 'المحادثات', count: tabCounts.messages, icon: MessageSquare }
                                            ].map(tab => {
                                                const Icon = tab.icon;
                                                const isActive = activeNotificationTab === tab.id;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setActiveNotificationTab(tab.id as any)}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                                                            isActive
                                                                ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-xs'
                                                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                                        }`}
                                                    >
                                                        {Icon && <Icon size={12} />}
                                                        <span>{tab.label}</span>
                                                        {tab.count > 0 && (
                                                            <span className="px-1.5 py-0.2 bg-slate-200/80 dark:bg-white/[0.15] text-slate-700 dark:text-slate-200 rounded-full text-[9px]">
                                                                {tab.count}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Notification Items List */}
                                        <div className="max-h-[340px] overflow-y-auto p-2 space-y-2 no-scrollbar">
                                            {filteredAlerts.length === 0 ? (
                                                <div className="py-10 text-center space-y-2">
                                                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                                                        <CheckCircle2 size={20} />
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">لا توجد إشعارات جديدة</p>
                                                    <p className="text-[11px] text-slate-400">جميع الأقسام محدثة ومستقرة</p>
                                                </div>
                                            ) : (
                                                filteredAlerts.map(alert => (
                                                    <div 
                                                        key={alert.id} 
                                                        onClick={() => handleAlertItemClick(alert)}
                                                        className={`p-3 rounded-xl border flex gap-3 transition-all cursor-pointer relative group hover:shadow-sm ${
                                                            alert.severity === 'critical' 
                                                                ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 hover:bg-rose-100/70' 
                                                                : alert.category === 'messages' || alert.type === 'team_message'
                                                                    ? 'bg-purple-50/70 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/40 hover:bg-purple-100/70'
                                                                    : alert.category === 'finance'
                                                                        ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 hover:bg-emerald-100/70'
                                                                        : alert.type === 'audit_overdue' || alert.type === 'pending_order'
                                                                            ? 'bg-blue-50/70 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40 hover:bg-blue-100/70'
                                                                            : 'bg-slate-50 border-slate-200/80 dark:bg-white/[0.03] dark:border-white/[0.07] hover:bg-slate-100/80'
                                                        }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs ${
                                                            alert.severity === 'critical' ? 'bg-rose-500 text-white' :
                                                            alert.category === 'messages' || alert.type === 'team_message' ? 'bg-purple-600 text-white' :
                                                            alert.category === 'finance' ? 'bg-emerald-600 text-white' :
                                                            alert.category === 'orders' ? 'bg-blue-600 text-white' :
                                                            'bg-amber-500 text-white'
                                                        }`}>
                                                            {alert.type === 'low_stock' ? <Package size={15} /> : 
                                                             alert.type === 'team_message' ? <MessageSquare size={15} /> :
                                                             alert.type === 'shared_audit_submitted' ? <Send size={15} /> :
                                                             alert.type === 'shared_audit_rejected' ? <ShieldAlert size={15} /> :
                                                             alert.type === 'shared_audit_pending' ? <ClipboardList size={15} /> :
                                                             alert.type === 'pending_order' ? <Activity size={15} /> :
                                                             alert.type === 'supplier_debt' ? <Database size={15} /> :
                                                             alert.type === 'cash_balance' ? <HandCoins size={15} /> :
                                                             alert.type === 'abandoned_cart' ? <ShoppingCart size={15} /> :
                                                             <Bell size={15} />}
                                                        </div>
                                                        <div className="flex-1 text-right pl-5 min-w-0">
                                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-snug truncate">
                                                                    {alert.title}
                                                                </h4>
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed line-clamp-2">
                                                                {alert.message}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDismissAlert(alert.id, e)}
                                                            title="إخفاء التنبيه"
                                                            className="absolute top-2 left-2 p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-white/80 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Popover Footer Links */}
                                        <div className="p-2.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2">
                                            <Link 
                                                to={activeStore ? `/store/${activeStore.id}/suppliers?tab=audit` : "/inventory-audit"} 
                                                onClick={() => setIsAlertsOpen(false)}
                                                className="flex-1 py-1.5 px-2.5 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold text-center transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Package size={12} />
                                                <span>الجرد والمخازن</span>
                                            </Link>
                                            <Link 
                                                to={activeStore ? `/store/${activeStore.id}/team-chat` : "/team-chat"} 
                                                onClick={() => setIsAlertsOpen(false)}
                                                className="flex-1 py-1.5 px-2.5 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold text-center transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <MessageSquare size={12} />
                                                <span>دردشة الفريق</span>
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Store Switcher Quick Button */}
                            <button 
                                onClick={handleManageStoresClick}
                                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100/90 hover:bg-slate-200/90 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200/80 dark:border-white/[0.08] transition-all cursor-pointer shadow-2xs"
                                title="تبديل المتجر أو إدارة المتاجر"
                            >
                                <Replace size={13} className="text-emerald-500" />
                                <span>تبديل المتجر</span>
                            </button>

                            <div className="h-4 w-px bg-slate-200 dark:bg-white/[0.1] hidden sm:block mx-0.5" />
                        </>
                    )}

                    {/* User Profile Menu */}
                    <div className="relative" ref={userMenuRef}>
                        <button 
                            onClick={() => setIsUserMenuOpen(prev => !prev)} 
                            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer group"
                            aria-expanded={isUserMenuOpen}
                            aria-label="قائمة المستخدم"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs ring-1 ring-emerald-500/20 group-hover:scale-105 transition-transform">
                                {currentUser ? getUserInitials(currentUser.fullName) : 'م'}
                            </div>

                            <div className="hidden md:block text-right leading-tight">
                                <div className="font-extrabold text-xs text-slate-900 dark:text-white truncate max-w-[110px]">
                                    {currentUser?.fullName || 'المستخدم'}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400">
                                    {currentUser?.isAdmin ? 'مدير عام' : 'صاحب المتجر'}
                                </div>
                            </div>

                            <ChevronDown 
                                size={13} 
                                className={`text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} 
                            />
                        </button>

                        {/* User Menu Dropdown */}
                        {isUserMenuOpen && (
                            <div className="absolute left-0 top-12 w-60 bg-white dark:bg-[#0f1722] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-white/[0.1] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-3 py-2.5 border-b border-slate-100 dark:border-white/[0.06] mb-1">
                                    <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                        {currentUser?.fullName}
                                    </p>
                                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                        {currentUser?.email}
                                    </p>
                                </div>

                                <Link 
                                    to={currentUser?.isAdmin ? "/admin/account-settings" : "/account-settings"} 
                                    onClick={() => setIsUserMenuOpen(false)} 
                                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
                                >
                                    <UserIcon size={14} className="text-slate-400" />
                                    <span>ملفي الشخصي</span>
                                </Link>

                                <Link 
                                    to="/docs" 
                                    onClick={() => setIsUserMenuOpen(false)} 
                                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Code size={14} />
                                        <span>توثيق الـ API والربط</span>
                                    </div>
                                    <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded font-mono font-bold">
                                        v1.0
                                    </span>
                                </Link>

                                <div className="w-full h-px bg-slate-100 dark:bg-white/[0.06] my-1" />

                                {/* Theme Mode Segmented Controller */}
                                <div className="px-3 py-2">
                                    <div className="text-[10px] font-bold text-slate-400 mb-1.5">
                                        المظهر
                                    </div>
                                    <div className="flex bg-slate-100 dark:bg-white/[0.05] rounded-xl p-0.5 gap-0.5">
                                        <button 
                                            onClick={() => setTheme('light')} 
                                            className={`flex-1 flex justify-center items-center gap-1 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer ${
                                                theme === 'light' 
                                                    ? 'bg-white dark:bg-slate-800 shadow-2xs text-emerald-600 dark:text-emerald-400' 
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            <Sun size={12}/>
                                            <span>فاتح</span>
                                        </button>
                                        <button 
                                            onClick={() => setTheme('dark')} 
                                            className={`flex-1 flex justify-center items-center gap-1 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer ${
                                                theme === 'dark' 
                                                    ? 'bg-white dark:bg-slate-800 shadow-2xs text-emerald-600 dark:text-emerald-400' 
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            <Moon size={12}/>
                                            <span>داكن</span>
                                        </button>
                                        <button 
                                            onClick={() => setTheme('system')} 
                                            className={`flex-1 flex justify-center items-center gap-1 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer ${
                                                theme === 'system' 
                                                    ? 'bg-white dark:bg-slate-800 shadow-2xs text-emerald-600 dark:text-emerald-400' 
                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            <Monitor size={12}/>
                                            <span>تلقائي</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="w-full h-px bg-slate-100 dark:bg-white/[0.06] my-1" />

                                <button 
                                    onClick={handleLogout} 
                                    className="w-full text-right flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors cursor-pointer"
                                >
                                    <LogOut size={14} />
                                    <span>تسجيل الخروج</span>
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
