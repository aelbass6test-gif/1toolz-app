import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, ShoppingCart, Eye, PhoneForwarded, Plus,
    Archive, Package, ClipboardList, ListOrdered, Star, Grid3x3, Users, Truck, Percent, 
    Wallet as WalletIcon, ArrowRightLeft, LayoutGrid, Brush, FileText, Globe, BarChart2, Shield, ShieldAlert,
    AppWindow, Settings2, CreditCard, Landmark, Users2, Code, Receipt, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, X, UserCog, History, Megaphone, MessageSquare, Wand2, DollarSign, RotateCcw, RotateCw, Monitor, Handshake,
    Search, ChevronDown, Minimize2, Maximize2, Wrench, FileSpreadsheet, Activity, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { Store as StoreType, Settings } from '../types';

interface SidebarProps {
  activeStore: StoreType | undefined;
  settings?: Settings;
  isOpen?: boolean;
  onClose?: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    activeStore, 
    settings, 
    isOpen, 
    onClose,
    isDesktopCollapsed = false,
    onToggleDesktopCollapse
}) => {
    const location = useLocation();
    const isPosEnabled = settings?.isPosEnabled !== false;
    const storePrefix = activeStore ? `/store/${activeStore.id}` : '';
    const prevPathnameRef = useRef(location.pathname);
    
    // Close sidebar on route change (for mobile)
    useEffect(() => {
        if (prevPathnameRef.current !== location.pathname) {
            if (onClose) {
                onClose();
            }
        }
        prevPathnameRef.current = location.pathname;
    }, [location.pathname, onClose]);

    // Define Navigation Items with Custom Badges and Sizes
    const navItems = [
        { 
            type: 'group', 
            title: 'الرئيسية والمتابعة العامة', 
            links: [
                { to: `${storePrefix}/dashboard`, label: 'لوحة التحكم الرئيسية', icon: <LayoutDashboard size={18} /> },
                { to: '/store', label: 'معاينة المتجر المباشر', icon: <Eye size={18} />, external: true },
                { to: `${storePrefix}/reports`, label: 'تحليلات الأداء الذكية', icon: <BarChart2 size={18} /> },
                { to: `${storePrefix}/standard-reports`, label: 'تقارير المبيعات التفصيلية', icon: <FileSpreadsheet size={18} /> },
                { to: `${storePrefix}/activity-logs`, label: 'سجل نشاط النظام والعمليات', icon: <Activity size={18} /> },
                { to: `${storePrefix}/webhook-monitor`, label: 'مراقب الربط البرمجي Webhooks', icon: <Activity size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'إدارة المبيعات والطلبيات',
            links: [
                ...(isPosEnabled ? [{ 
                    to: `${storePrefix}/pos`, 
                    label: 'كاشير - نقطة البيع (POS)', 
                    icon: <Monitor size={18} />, 
                    badge: { text: "نشط ⚡", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 text-[9px] font-bold" } 
                }] : []),
                { to: `${storePrefix}/create-order`, label: 'إنشاء طلب جديد', icon: <Plus size={18} /> },
                { to: `${storePrefix}/orders`, label: 'سجل الطلبيات والمبيعات', icon: <ShoppingCart size={18} /> },
                { 
                    to: `${storePrefix}/confirmation-queue`, 
                    label: 'تأكيد الطلبات والمعالجة', 
                    icon: <PhoneForwarded size={18} />,
                    badge: { text: "تأكيد", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/10 text-[9px]" }
                },
                { to: `${storePrefix}/dropshipping`, label: 'إدارة الدروب شيبينغ والتوريد', icon: <Package size={18} /> },
                { to: `${storePrefix}/returns`, label: 'إدارة مرتجعات المبيعات', icon: <RotateCcw size={18} /> },
                { to: `${storePrefix}/abandoned-carts`, label: 'السلات الشرائية المتروكة', icon: <Archive size={18} /> },
                { to: `${storePrefix}/failed-delivery-compensation`, label: 'تعويضات الشحن الفاشل', icon: <ShieldAlert size={18} /> },
                { to: `${storePrefix}/tracking`, label: 'تتبع الشحنات الموحد', icon: <Search size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'كتالوج المنتجات والمخزون',
            links: [
                { to: `${storePrefix}/products`, label: 'المنظومة والمخزون الموحد', icon: <Package size={18} /> },
                { to: `${storePrefix}/collections`, label: 'مجموعات وتصنيفات المنتجات', icon: <Grid3x3 size={18} /> },
                { to: `${storePrefix}/collections-report`, label: 'تقرير مبيعات المجموعات', icon: <BarChart2 size={14} /> },
                { to: `${storePrefix}/product-options`, label: 'خيارات ومتغيرات المنتجات', icon: <ClipboardList size={18} /> },
                { to: `${storePrefix}/reviews`, label: 'تقييمات وآراء العملاء', icon: <Star size={18} /> },
                { to: `${storePrefix}/suppliers`, label: 'إدارة الموردين والمخازن', icon: <Handshake size={18} /> },
                { to: `${storePrefix}/inventory-transfers`, label: 'تحويلات المخزون الداخلية', icon: <ArrowRightLeft size={18} /> },
                { to: `${storePrefix}/purchase-returns`, label: 'مرتجعات المشتريات (موردين)', icon: <RotateCw size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'التسويق وعلاقات العملاء CRM',
            links: [
                { to: `${storePrefix}/customers`, label: 'قاعدة بيانات العملاء', icon: <Users size={18} /> },
                { 
                    to: `${storePrefix}/whatsapp`, 
                    label: 'شات ورسائل واتساب للعملاء', 
                    icon: <MessageSquare size={18} />, 
                    badge: { text: "شات 💬", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold" } 
                },
                { 
                    to: `${storePrefix}/ai-assistant`, 
                    label: 'مستشار الذكاء الاصطناعي (AI)', 
                    icon: <Wand2 size={18} />,
                    badge: { text: "AI ✨", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/10 text-[9px] font-bold animate-pulse" }
                },
                { to: `${storePrefix}/marketing`, label: 'الحملات التسويقية والترويج', icon: <Megaphone size={18} /> },
                { to: `${storePrefix}/discounts`, label: 'قسائم التخفيض وكوبونات الترويج', icon: <Percent size={18} /> },
                { to: `${storePrefix}/team-chat`, label: 'الدردشة الداخلية للفريق', icon: <MessageSquare size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'المالية والشركاء والرواتب',
            links: [
                { to: `${storePrefix}/treasury`, label: 'الخزائن وصناديق السيولة المالية', icon: <Landmark size={18} /> },
                { to: `${storePrefix}/expenses`, label: 'المصروفات والتكاليف العامة', icon: <DollarSign size={18} /> },
                { to: `${storePrefix}/wallet`, label: 'محفظة عمولات المتجر', icon: <WalletIcon size={18} /> },
                { to: `${storePrefix}/partners`, label: 'إدارة الشركاء والمسوقين', icon: <Users size={18} /> },
                { to: `${storePrefix}/employees-payroll`, label: 'كشوف المرتبات والأجور', icon: <Receipt size={18} /> },
                { to: `${storePrefix}/reconciliation`, label: 'مطابقة الحسابات (إكسيل)', icon: <FileSpreadsheet size={18} /> },
                { to: `${storePrefix}/cash-management`, label: 'إدارة العهد النقدية', icon: <Landmark size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'الشحن والتوصيل اللوجستي',
            links: [
                { to: `${storePrefix}/shipping`, label: 'شركات وقنوات الشحن اللوجستي', icon: <Truck size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'مظهر المتجر والتطبيقات',
            links: [
                { to: `${storePrefix}/customize-store`, label: 'تنسيق الخطوط والألوان والمظهر', icon: <Brush size={18} /> },
                { to: `${storePrefix}/design-templates`, label: 'قوالب وثيمات المتجر الجاهزة', icon: <LayoutGrid size={18} /> },
                { to: `${storePrefix}/domain`, label: 'ربط النطاق المخصص والدومين', icon: <Globe size={18} /> },
                { to: `${storePrefix}/pages`, label: 'الصفحات الإضافية والمدونة', icon: <FileText size={18} /> },
                { to: `${storePrefix}/apps`, label: 'متجر التطبيقات والربط البرمجي', icon: <AppWindow size={18} />, badge: { text: "Apps", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 text-[9px]" } },
            ]
        },
        {
            type: 'group',
            title: 'النظام وإعدادات التحكم الشاملة',
            links: [
                { to: `${storePrefix}/settings`, label: 'الإعدادات العامة وإدارة المتجر ⚙️', icon: <Settings2 size={18} /> },
                { to: `${storePrefix}/settings/payment`, label: 'بوابات وطرق الدفع والتحصيل', icon: <CreditCard size={18} /> },
                { to: `${storePrefix}/settings/employees`, label: 'سجل صلاحيات طاقم العمل والـ CRM', icon: <Users2 size={18} /> },
                { to: `${storePrefix}/settings/developer`, label: 'إعدادات المطورين والربط التقني', icon: <Code size={18} />, badge: { text: "Dev 🛠️", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/10 text-[9px]" } },
                { to: `${storePrefix}/api-docs`, label: 'وثائق المطورين API Docs', icon: <FileText size={18} /> },
                { to: `${storePrefix}/maintenance`, label: 'صيانة وفحص سلامة البيانات', icon: <Wrench size={18} /> },
                { to: `/select-store`, label: 'إدارة واختيار المتاجر والمشاريع', icon: <LayoutGrid size={18} /> },
                { to: `${storePrefix}/account-settings`, label: 'إعدادات حساب المالك', icon: <UserCog size={18} /> },
                { to: '/admin', label: 'لوحة تحكم النظام (أدمن)', icon: <Shield size={18} /> },
            ]
        }
    ];

    // Flatten all links to determine most specific match
    const allLinks = useMemo(() => {
        return navItems.flatMap(group => (group.type === 'group' ? group.links : []));
    }, [navItems]);

    // Precise link active evaluator - prevents parent/prefix overlaps (e.g. /store vs /store/:id/dashboard)
    const isLinkActive = useCallback((link: { to: string; external?: boolean }) => {
        if (link.external) {
            // External preview or standalone links should only highlight on exact path
            return location.pathname === link.to;
        }
        if (location.pathname === link.to) {
            return true;
        }
        // Subroutes check (e.g. /orders/ORD-123 under /orders)
        // Strictly prevent generic root paths or store prefixes from highlighting on nested pages
        if (
            link.to !== '/' && 
            link.to !== '/store' && 
            link.to !== storePrefix && 
            link.to !== `${storePrefix}/dashboard` &&
            location.pathname.startsWith(link.to + '/')
        ) {
            // Verify there is no other link in navItems that provides a more specific match
            const hasMoreSpecific = allLinks.some(other => 
                other.to !== link.to && 
                other.to.startsWith(link.to) && 
                (location.pathname === other.to || location.pathname.startsWith(other.to + '/'))
            );
            return !hasMoreSpecific;
        }
        return false;
    }, [location.pathname, storePrefix, allLinks]);

    // --- State Management ---
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('sidebar_collapsed_groups_v4');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Error loading sidebar settings', e);
        }
        // Keep all dashboard sections visible on first load so no navigation items
        // appear to be missing. Users can still collapse individual sections.
        return {
            'الرئيسية والمتابعة العامة': false,
            'إدارة المبيعات والطلبيات': false,
            'كتالوج المنتجات والمخزون': false,
            'التسويق وعلاقات العملاء CRM': false,
            'المالية والشركاء والرواتب': false,
            'الشحن والتوصيل اللوجستي': false,
            'مظهر المتجر والتطبيقات': false,
            'النظام وإعدادات التحكم الشاملة': false,
        };
    });

    const saveCollapsedState = (newState: Record<string, boolean>) => {
        setCollapsedGroups(newState);
        localStorage.setItem('sidebar_collapsed_groups_v4', JSON.stringify(newState));
    };

    const toggleGroup = (title: string) => {
        const newState = {
            ...collapsedGroups,
            [title]: !collapsedGroups[title]
        };
        saveCollapsedState(newState);
    };

    const expandAll = () => {
        const newState = navItems.reduce((acc, item) => {
            if (item.type === 'group') {
                acc[item.title] = false;
            }
            return acc;
        }, {} as Record<string, boolean>);
        saveCollapsedState(newState);
    };

    const collapseAll = () => {
        const newState = navItems.reduce((acc, item) => {
            if (item.type === 'group') {
                acc[item.title] = true;
            }
            return acc;
        }, {} as Record<string, boolean>);
        saveCollapsedState(newState);
    };

    // Auto-expand group carrying the current route
    useEffect(() => {
        const currentPath = location.pathname;
        let changed = false;
        const updated = { ...collapsedGroups };

        navItems.forEach(group => {
            if (group.type === 'group') {
                const hasActiveRoute = group.links.some(l => isLinkActive(l));
                if (hasActiveRoute && updated[group.title] !== false) {
                    updated[group.title] = false; // Expand
                    changed = true;
                }
            }
        });

        if (changed) {
            saveCollapsedState(updated);
        }
    }, [location.pathname]);

    // Filtering items based on search query (Fuzzy Arabic/English text search)
    const filteredNavItems = navItems.map(item => {
        if (item.type === 'group') {
            const query = searchQuery.trim().toLowerCase();
            if (!query) return item;

            const matchedLinks = item.links.filter(link => 
                link.label.toLowerCase().includes(query) || 
                item.title.toLowerCase().includes(query)
            );

            if (matchedLinks.length > 0) {
                return {
                    ...item,
                    links: matchedLinks
                };
            }
            return null;
        }
        return item;
    }).filter(Boolean) as typeof navItems;

    const hasActiveSearch = searchQuery.trim().length > 0;

    const sidebarContentJSX = (
        <div className="h-full flex flex-col p-3 sm:p-3.5 bg-white/95 dark:bg-[#0d1714]/95 backdrop-blur-2xl border-l border-slate-200/80 dark:border-emerald-950/80 font-sans text-right select-none" dir="rtl">
            
            {/* Header section */}
            <div className="p-3 mb-2.5 rounded-2xl bg-gradient-to-r from-slate-100/90 via-indigo-50/50 to-purple-50/50 dark:from-slate-900/90 dark:via-indigo-950/30 dark:to-purple-950/30 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#008060] to-[#0f5c48] flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                        <ShoppingCart size={20} />
                    </div>
                    <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                            <h2 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[110px]" title={activeStore?.name}>
                                {activeStore?.name || 'منظومة التشغيل'}
                            </h2>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="المتجر نشط" />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">الإدارة العامة</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-white/80 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 border border-slate-200/60 dark:border-slate-700/60">
                                {activeStore?.id ? activeStore.id.slice(-8) : 'm-media'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {/* Desktop Collapse Trigger to Expand Workspace */}
                    {onToggleDesktopCollapse && (
                        <button 
                            onClick={onToggleDesktopCollapse}
                            className="hidden md:flex p-1.5 text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700/80"
                            title="طي الشريط الجانبي وتوسيع الشاشة (Ctrl + B)"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                            <X size={18}/>
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Screen Expand System Bar */}
            {onToggleDesktopCollapse && (
                <div className="hidden md:flex items-center justify-between px-3 py-1.5 mb-2.5 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50/70 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900/30 rounded-xl border border-indigo-100/80 dark:border-indigo-900/40 text-slate-700 dark:text-slate-200 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <Maximize2 size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span>نظام توسيع الشاشة</span>
                    </div>
                    <button
                        onClick={onToggleDesktopCollapse}
                        className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white border border-indigo-200/60 dark:border-indigo-800/60 transition-all cursor-pointer shadow-2xs group"
                        title="طي الشريط وتوسيع مساحة العمل بالكامل (Ctrl + B)"
                    >
                        <span>طي</span>
                        <kbd className="text-[9px] font-mono opacity-70 group-hover:opacity-100">Ctrl+B</kbd>
                    </button>
                </div>
            )}

            {/* Smart Search Filter */}
            <div className="mb-3 relative">
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="بحث سريع في القائمة..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-100/80 dark:bg-slate-950/80 text-xs border border-slate-200/90 dark:border-slate-800/90 rounded-2xl py-2.5 px-3 pl-8 pr-9 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    />
                    <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                        <Search size={14} />
                    </div>
                    {searchQuery ? (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                            <X size={14} />
                        </button>
                    ) : null}
                </div>

                {/* Collapse / Expand all quick triggers */}
                {!hasActiveSearch && (
                    <div className="flex justify-between items-center mt-2 px-1 text-[10px] text-slate-400 font-bold">
                        <button 
                            onClick={expandAll}
                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                        >
                            <Maximize2 size={10} />
                            <span>توسيع المجموعات</span>
                        </button>
                        <button 
                            onClick={collapseAll}
                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                        >
                            <Minimize2 size={10} />
                            <span>طي المجموعات</span>
                        </button>
                    </div>
                )}
            </div>
            
            {/* Nav Links & Scrollable Container */}
            <nav className="flex-1 space-y-2.5 overflow-y-auto pb-8 no-scrollbar pr-0.5 pl-0.5">
                {filteredNavItems.length === 0 ? (
                    <div className="text-center py-8 px-2 text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        لا توجد نتائج مطابقة لبحثك
                    </div>
                ) : (
                    filteredNavItems.map((item) => {
                        if (item.type === 'group') {
                            const isCollapsed = hasActiveSearch ? false : !!collapsedGroups[item.title];
                            const containsActivePath = item.links.some(link => isLinkActive(link));

                            return (
                                <div key={item.title} className="space-y-1 bg-slate-50/60 dark:bg-slate-950/30 rounded-2xl p-1.5 border border-slate-200/40 dark:border-slate-800/40 transition-all duration-200">
                                    
                                    {/* Actionable Header representing a grouping */}
                                    <button 
                                        onClick={() => toggleGroup(item.title)}
                                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-right hover:bg-slate-200/50 dark:hover:bg-slate-800/40 rounded-xl transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-wider">
                                                {item.title}
                                            </span>
                                            {containsActivePath && isCollapsed && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" title="الصفحة الحالية داخل هذا القسم" />
                                            )}
                                        </div>
                                        
                                        {!hasActiveSearch && (
                                            <ChevronDown 
                                                size={13} 
                                                className={`text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                                                    !isCollapsed ? 'rotate-180 text-indigo-500' : ''
                                                }`} 
                                            />
                                        )}
                                    </button>

                                    {/* Sub Items under the Category Accordion */}
                                    {!isCollapsed && (
                                        <div className="space-y-0.5 mt-1 transition-all">
                                            {item.links.map(link => {
                                                const active = isLinkActive(link);
                                                return (
                                                    <NavLink 
                                                        to={link.to} 
                                                        key={link.to + link.label}
                                                        end={true}
                                                        target={link.external ? "_blank" : undefined}
                                                        rel={link.external ? "noopener noreferrer" : undefined}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 text-xs font-bold ${
                                                            active 
                                                                ? 'bg-gradient-to-r from-[#008060] to-[#0f5c48] text-white shadow-md shadow-emerald-600/20 font-black' 
                                                                : 'text-slate-700 dark:text-slate-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400'
                                                        }`}
                                                    >
                                                        {() => (
                                                            <>
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <span className={`shrink-0 transition-colors duration-200 ${
                                                                        active 
                                                                            ? 'text-white' 
                                                                            : 'text-slate-400 group-hover:text-indigo-500'
                                                                    }`}>
                                                                        {link.icon}
                                                                    </span>
                                                                    <span className="truncate pr-0.5">{link.label}</span>
                                                                </div>

                                                                {/* Interactive Status Badge */}
                                                                {link.badge && (
                                                                    <span className={`shrink-0 px-1.5 py-0.5 text-[8px] font-black rounded-md leading-none ${
                                                                        active ? 'bg-white/20 text-white' : link.badge.color
                                                                    }`}>
                                                                        {link.badge.text}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </NavLink>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })
                )}
            </nav>

            {/* Brand Credit Signature */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-center text-[10px] text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-0.5">
                <span className="font-black text-slate-700 dark:text-slate-300">عبدو ميديا برايم | AbdoMedia Prime © 2026</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500">منظومة التجارة والتسويق الرقمي المتكاملة</span>
            </div>
        </div>
    );

    const sidebarCollapsedRailJSX = (
        <div className="h-full flex flex-col items-center py-3 px-1.5 bg-white/85 dark:bg-[#090d16]/90 backdrop-blur-2xl border-l border-slate-200/70 dark:border-slate-800/80 font-sans select-none relative" dir="rtl">
            {/* Store Icon & Quick Expand */}
            <div className="flex flex-col items-center gap-2 mb-2 pb-2.5 border-b border-slate-200/60 dark:border-slate-800/60 w-full">
                <div 
                    className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0 cursor-pointer group relative"
                    title={activeStore?.name || 'منظومة التشغيل'}
                    onClick={onToggleDesktopCollapse}
                >
                    <ShoppingCart size={18} />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </div>

                {/* Main Expand Button */}
                {onToggleDesktopCollapse && (
                    <button
                        onClick={onToggleDesktopCollapse}
                        className="w-10 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-100/80 hover:bg-indigo-50 dark:bg-slate-800/80 dark:hover:bg-indigo-950/40 border border-slate-200/70 dark:border-slate-700/80 transition-all cursor-pointer group shadow-2xs"
                        title="توسيع القائمة بالكامل (Ctrl + B)"
                    >
                        <PanelLeftOpen size={16} className="group-hover:scale-110 transition-transform" />
                    </button>
                )}
            </div>

            {/* Scrollable Icon Rail */}
            <nav className="flex-1 w-full overflow-y-auto no-scrollbar space-y-1 py-1">
                {navItems.map((group, groupIdx) => {
                    if (group.type === 'group') {
                        return (
                            <div key={group.title} className="space-y-1">
                                {groupIdx > 0 && (
                                    <div className="w-5 h-px bg-slate-200/70 dark:bg-slate-800/70 mx-auto my-2" />
                                )}
                                {group.links.map(link => {
                                    const active = isLinkActive(link);
                                    return (
                                        <NavLink
                                            key={link.to}
                                            to={link.to}
                                            end={true}
                                            target={link.external ? "_blank" : undefined}
                                            rel={link.external ? "noopener noreferrer" : undefined}
                                            className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-all duration-200 relative group cursor-pointer ${
                                                active
                                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30 font-black'
                                                    : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400'
                                            }`}
                                        >
                                            {() => (
                                                <>
                                                    <span className={`shrink-0 transition-transform ${active ? 'scale-105' : 'group-hover:scale-110'}`}>
                                                        {link.icon}
                                                    </span>

                                                    {/* Sleek Floating Hover Tooltip (Left side in RTL) */}
                                                    <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-black rounded-xl shadow-2xl border border-slate-700/80 z-50 pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                                                        <span>{link.label}</span>
                                                        {link.badge && (
                                                            <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${link.badge.color}`}>
                                                                {link.badge.text}
                                                            </span>
                                                        )}
                                                        {/* Little arrow pointing right toward icon */}
                                                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45 border-t border-r border-slate-700/80" />
                                                    </div>
                                                </>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        );
                    }
                    return null;
                })}
            </nav>

            {/* Bottom Expand Button */}
            {onToggleDesktopCollapse && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 w-full flex flex-col items-center">
                    <button
                        onClick={onToggleDesktopCollapse}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                        title="توسيع القائمة بالكامل (Ctrl + B)"
                    >
                        <Maximize2 size={16} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar with Expand / Collapse Screen System */}
            <div 
                className={`hidden md:flex ${
                    isDesktopCollapsed ? 'w-20' : 'w-72'
                } bg-white/70 dark:bg-[#0b0f19]/75 backdrop-blur-2xl border-l border-slate-200/45 dark:border-white/5 h-full flex-col sticky top-0 shadow-xl shadow-slate-200/10 dark:shadow-none relative z-20 transition-all duration-300 ease-in-out shrink-0`}
            >
                {/* Floating Edge Toggle Handle on Left Border (in RTL) */}
                {onToggleDesktopCollapse && (
                    <button
                        onClick={onToggleDesktopCollapse}
                        className="hidden md:flex absolute top-16 -left-3.5 z-40 w-7 h-7 bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-700/80 shadow-md rounded-full items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer hover:scale-110 active:scale-95 group"
                        title={isDesktopCollapsed ? "توسيع الشريط الجانبي (Ctrl + B)" : "طي الشريط الجانبي وتوسيع الشاشة (Ctrl + B)"}
                    >
                        {isDesktopCollapsed ? (
                            <ChevronLeft size={15} className="group-hover:translate-x-[-1px] transition-transform text-indigo-600 dark:text-indigo-400" />
                        ) : (
                            <ChevronRight size={15} className="group-hover:translate-x-[1px] transition-transform" />
                        )}
                    </button>
                )}

                {isDesktopCollapsed ? sidebarCollapsedRailJSX : sidebarContentJSX}
            </div>

            {/* Mobile Sidebar */}
            <div 
                className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden={!isOpen}
            >
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} tabIndex={-1}></div>
                <div 
                    className={`absolute top-0 right-0 h-full w-72 bg-white/85 dark:bg-[#0b0f19]/90 backdrop-blur-2xl shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-[100%]'}`}
                >
                    {isOpen && sidebarContentJSX}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
