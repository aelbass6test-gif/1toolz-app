import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, ShoppingCart, Eye, PhoneForwarded, Plus,
    Archive, Package, ClipboardList, ListOrdered, Star, Grid3x3, Users, Truck, Percent, 
    Wallet as WalletIcon, ArrowRightLeft, LayoutGrid, Brush, FileText, Globe, BarChart2, Shield, 
    AppWindow, Settings2, CreditCard, Landmark, Users2, Code, Receipt, ChevronRight, X, UserCog, History, Megaphone, MessageSquare, Wand2, DollarSign, RotateCcw, RotateCw, Monitor, Handshake,
    Search, ChevronDown, Minimize2, Maximize2, Wrench
} from 'lucide-react';
import { Store as StoreType, Settings } from '../types';

interface SidebarProps {
  activeStore: StoreType | undefined;
  settings?: Settings;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeStore, settings, isOpen, onClose }) => {
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
            title: 'لوحة القيادة والمتابعة العامة', 
            links: [
                { to: `${storePrefix}/dashboard`, label: 'لوحة التحكم الرئيسية', icon: <LayoutDashboard size={18} /> },
                { to: '/store', label: 'معاينة المتجر المباشر', icon: <Eye size={18} />, external: true },
                { to: `${storePrefix}/reports`, label: 'التحليلات ومؤشرات النمو', icon: <BarChart2 size={18} /> },
                { to: `${storePrefix}/standard-reports`, label: 'التقارير وسجلات الطباعة', icon: <FileText size={18} /> },
                { to: `${storePrefix}/activity-logs`, label: 'نشاطات العمليات الفورية', icon: <History size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'المبيعات الفورية ونقطة الكاشير',
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
                { to: `${storePrefix}/returns`, label: 'إدارة مرتجعات المبيعات', icon: <RotateCcw size={18} /> },
                { to: `${storePrefix}/abandoned-carts`, label: 'السلات الشرائية المتروكة', icon: <Archive size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'كتالوج المنتجات والمستودعات',
            links: [
                { to: `${storePrefix}/products`, label: 'المنظومة والمخزون الموحد', icon: <Package size={18} /> },
                { to: `${storePrefix}/collections`, label: 'مجموعات وتصنيفات المنتجات', icon: <Grid3x3 size={18} /> },
                { to: `${storePrefix}/product-options`, label: 'خيارات ومتغيرات المنتجات', icon: <ClipboardList size={18} /> },
                { to: `${storePrefix}/product-attributes`, label: 'خصائص وسمات المنتجات', icon: <ListOrdered size={18} /> },
                { to: `${storePrefix}/inventory-transfers`, label: 'نقل وتحويلات المقاصة', icon: <ArrowRightLeft size={18} /> },
                { to: `${storePrefix}/suppliers`, label: 'الموردين والفروع والمستودعات', icon: <UserCog size={18} /> },
                { to: `${storePrefix}/purchase-returns`, label: 'مرتجع فواتير المشتريات', icon: <RotateCw size={18} /> },
                { to: `${storePrefix}/reviews`, label: 'تقييمات وآراء العملاء', icon: <Star size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'قسم الصيانة والدعم الفني',
            links: [
                { to: `${storePrefix}/maintenance`, label: 'مركز إدارة عمليات الصيانة 🛠️', icon: <Wrench size={18} />, badge: { text: "جديد", color: "bg-blue-500/10 text-blue-600 border border-blue-500/10 text-[9px]" } },
                { to: `${storePrefix}/reports?tab=maintenance`, label: 'تقارير الأداء الفني والتكاليف', icon: <BarChart2 size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'التسويق وعلاقات العملاء CRM',
            links: [
                { to: `${storePrefix}/customers`, label: 'قاعدة بيانات العملاء', icon: <Users size={18} /> },
                { to: `${storePrefix}/whatsapp`, label: 'إرسال حملات واتساب متكاملة', icon: <MessageSquare size={18} /> },
                { to: `${storePrefix}/team-chat`, label: 'دردشة ومناقشات طاقم العمل', icon: <Users2 size={18} /> },
                { 
                    to: `${storePrefix}/ai-assistant`, 
                    label: 'مستشار الذكاء الاصطناعي (AI)', 
                    icon: <Wand2 size={18} />,
                    badge: { text: "AI ✨", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/10 text-[9px] font-bold animate-pulse" }
                },
                { to: `${storePrefix}/marketing`, label: 'توليد الرسائل والمحتوى الإعلاني', icon: <Megaphone size={18} /> },
                { to: `${storePrefix}/discounts`, label: 'قسائم التخفيض وكوبونات الترويج', icon: <Percent size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'الخزينة والمنظومة المالية والمصروفات',
            links: [
                { to: `${storePrefix}/treasury`, label: 'الخزائن وصناديق السيولة المالية', icon: <Landmark size={18} />, badge: { text: "رئيسية", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 text-[9px]" } },
                { to: `${storePrefix}/cash-management`, label: 'حركات العُهد وتسليم الوردية', icon: <Handshake size={18} /> },
                { to: `${storePrefix}/expenses`, label: 'المصروفات والتكاليف العامة', icon: <DollarSign size={18} /> },
                { to: `${storePrefix}/employees-payroll`, label: 'إدارة شؤون الموظفين والرواتب', icon: <Users size={18} />, badge: { text: "جديد", color: "bg-blue-500/10 text-blue-600 border border-blue-500/10 text-[9px]" } },
                { to: `${storePrefix}/partners`, label: 'حسابات الشركاء والمسحوبات الشخصية', icon: <Users size={18} /> },
                { to: `${storePrefix}/collections-report`, label: 'سجلات التحصيل والمقاصة المالية', icon: <Receipt size={18} /> },
                { to: `${storePrefix}/wallet`, label: 'المحفظة الإلكترونية لعمولات المتجر', icon: <WalletIcon size={18} /> },
                { to: `${storePrefix}/withdrawals`, label: 'معاملات وتفاصيل سحب الأموال', icon: <ArrowRightLeft size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'قنوات الشحن اللوجستي والتعبئة',
            links: [
                { to: `${storePrefix}/shipping`, label: 'شركات وقنوات الشحن اللوجستي', icon: <Truck size={18} /> },
                { to: `${storePrefix}/shipping-wrapping`, label: 'مستلزمات التعبئة والتغليف والشحن', icon: <Package size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'الهندسة البرمجية وتصميم ومظهر الويب',
            links: [
                { to: `${storePrefix}/design-templates`, label: 'قوالب واجهة المتجر والويب', icon: <LayoutGrid size={18} /> },
                { to: `${storePrefix}/customize-store`, label: 'تنسيق الخطوط والألوان والمظهر', icon: <Brush size={18} /> },
                { to: `${storePrefix}/apps`, label: 'تثبيت التطبيقات وأدوات التكامل', icon: <AppWindow size={18} /> },
                { to: `${storePrefix}/pages`, label: 'مدونة المتجر والصفحات الإضافية', icon: <FileText size={18} /> },
                { to: `${storePrefix}/domain`, label: 'ربط النطاق المخصص والدومين', icon: <Globe size={18} /> },
                { to: `${storePrefix}/legal-pages`, label: 'السياسات والشروط القانونية', icon: <Shield size={18} /> },
            ]
        },
        {
            type: 'group',
            title: 'النظام وإعدادات التحكم الشاملة',
            links: [
                { to: `${storePrefix}/settings`, label: 'الإعدادات العامة وإدارة المتجر ⚙️', icon: <Settings2 size={18} /> },
                { to: `${storePrefix}/settings/payment`, label: 'بوابات وطرق الدفع والتحصيل للعملاء', icon: <CreditCard size={18} /> },
                { to: `${storePrefix}/settings/tax`, label: 'الضرائب ورسوم القيمة المضافة للبائع', icon: <Landmark size={18} /> },
                { to: `${storePrefix}/settings/employees`, label: 'سجل صلاحيات طاقم العمل والـ CRM', icon: <Users2 size={18} /> },
                { 
                    to: `${storePrefix}/settings/developer`, 
                    label: 'أدوات المطورين والربط السحابي (Cloud Sync)', 
                    icon: <Code size={18} />,
                    badge: { text: "مطور 🛠️", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10 text-[9px] font-medium" }
                }
            ]
        }
    ];

    // --- State Management ---
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('sidebar_collapsed_groups_v2');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Error loading sidebar settings', e);
        }
        // Premium default behavior: Keep primary open, collapse others for streamlined workspace
        return {
            'لوحة القيادة والمتابعة العامة': false,
            'المبيعات الفورية ونقطة الكاشير': false,
            'قسم الصيانة والدعم الفني': false,
            'كتالوج المنتجات والمستودعات': true,
            'التسويق وعلاقات العملاء CRM': true,
            'الخزينة والمنظومة المالية والمصروفات': false,
            'قنوات الشحن اللوجستي والتعبئة': true,
            'الهندسة البرمجية وتصميم ومظهر الويب': true,
            'النظام وإعدادات التحكم الشاملة': true,
        };
    });

    const saveCollapsedState = (newState: Record<string, boolean>) => {
        setCollapsedGroups(newState);
        localStorage.setItem('sidebar_collapsed_groups_v2', JSON.stringify(newState));
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
                const hasActiveRoute = group.links.some(l => l.to === currentPath);
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
        <div className="h-full flex flex-col p-4 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-slate-200/60 dark:border-slate-800/60 font-sans text-right" dir="rtl">
            
            {/* Header section */}
            <div className="py-4 px-2 mb-2 flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800/50 pb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                        <ShoppingCart size={22} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[150px]" title={activeStore?.name}>
                            {activeStore?.name || 'منظومة التشغيل'}
                        </h2>
                        <div className="flex flex-col gap-0.5">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest leading-none">الإدارة المتكاملة</p>
                            <p className="text-[9px] font-mono text-indigo-500 dark:text-indigo-400 mt-1">كود: {activeStore?.id || 'm-media'}</p>
                        </div>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20}/>
                    </button>
                )}
            </div>

            {/* Smart Search Filter */}
            <div className="mb-4 px-1.5 relative">
                <div className="relative">
                    <input 
                        type="text"
                        placeholder="ابحث عن التبويب أو الخدمة..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 text-xs border border-slate-200/80 dark:border-slate-800/80 rounded-xl py-2 px-3 pl-8 pr-8 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100"
                    />
                    <div className="absolute right-2.5 top-2.5 text-slate-400">
                        <Search size={14} />
                    </div>
                    {searchQuery ? (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    ) : (
                        <div className="absolute left-3 top-2 flex items-center gap-1.5 pointer-events-none text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                            🔍
                        </div>
                    )}
                </div>

                {/* Collapse / Expand all quick triggers */}
                {!hasActiveSearch && (
                    <div className="flex justify-between items-center mt-2.5 px-0.5 text-[10px] text-slate-400 font-bold">
                        <button 
                            onClick={expandAll}
                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        >
                            <Maximize2 size={10} />
                            <span>توسيع المجموعات</span>
                        </button>
                        <button 
                            onClick={collapseAll}
                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        >
                            <Minimize2 size={10} />
                            <span>طي المجموعات</span>
                        </button>
                    </div>
                )}
            </div>
            
            {/* Nav Links & Scrollable Container */}
            <nav className="flex-1 space-y-3 overflow-y-auto pb-10 no-scrollbar pr-1 pl-1">
                {filteredNavItems.length === 0 ? (
                    <div className="text-center py-8 px-2 text-xs text-slate-400">
                        😔 عذراً، لا توجد نتائج مطابقة لبحثك.
                    </div>
                ) : (
                    filteredNavItems.map((item, index) => {
                        if (item.type === 'group') {
                            const isCollapsed = hasActiveSearch ? false : !!collapsedGroups[item.title];
                            
                            // Check if this group contains the currently active route
                            const containsActivePath = item.links.some(link => link.to === location.pathname);

                            return (
                                <div key={item.title} className="space-y-1 bg-white/40 dark:bg-slate-900/40 rounded-xl p-1 border border-slate-100/50 dark:border-slate-800/10 shadow-sm/5 hover:border-slate-200/50 dark:hover:border-slate-800/30 transition-all duration-300">
                                    
                                    {/* Actionable Header representing a grouping */}
                                    <button 
                                        onClick={() => toggleGroup(item.title)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-right hover:bg-slate-100/50 dark:hover:bg-slate-800/20 rounded-lg transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-wide">
                                                {item.title}
                                            </span>
                                            {/* Beautiful Dot indicator to show there is an active subpage inside this collapsed category */}
                                            {containsActivePath && isCollapsed && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" title="الصفحة الحالية داخل هذا القسم" />
                                            )}
                                        </div>
                                        
                                        {!hasActiveSearch && (
                                            <ChevronDown 
                                                size={14} 
                                                className={`text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                                                    !isCollapsed ? 'rotate-180 text-indigo-500' : ''
                                                }`} 
                                            />
                                        )}
                                    </button>

                                    {/* Sub Items under the Category Accordion */}
                                    {!isCollapsed && (
                                        <div className="space-y-0.5 mt-1 transition-all pl-1">
                                            {item.links.map(link => {
                                                const isActive = location.pathname === link.to;
                                                return (
                                                    <NavLink 
                                                        to={link.to} 
                                                        key={link.to + link.label}
                                                        end={link.to === '/'}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 group ${
                                                            isActive 
                                                                ? 'bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 font-extrabold shadow-sm' 
                                                                : 'hover:text-indigo-600 dark:hover:text-indigo-400'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <span className={`transition-colors duration-200 ${
                                                                isActive 
                                                                    ? 'text-indigo-600 dark:text-indigo-400 translate-x-[-1px]' 
                                                                    : 'text-slate-400 group-hover:text-indigo-500'
                                                            }`}>
                                                                {link.icon}
                                                            </span>
                                                            <span className="truncate max-w-[160px] pr-0.5">{link.label}</span>
                                                        </div>

                                                        {/* Interactive Status Badge */}
                                                        {link.badge && (
                                                            <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-md leading-none ${link.badge.color}`}>
                                                                {link.badge.text}
                                                            </span>
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
            <div className="pt-3 border-t border-slate-200/40 dark:border-slate-800/40 text-center text-[10px] text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-1">
                <span className="font-bold text-slate-600 dark:text-slate-400">عبدو ميديا لإدارة الأعمال © 2026</span>
                <span className="text-[9px] opacity-75">المستوى الاحترافي للخدمات التجارية المترابطة</span>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:flex w-72 bg-white/70 dark:bg-[#0b0f19]/75 backdrop-blur-2xl border-l border-slate-200/45 dark:border-white/5 h-full flex-col sticky top-0 shadow-xl shadow-slate-200/10 dark:shadow-none relative z-20 transition-all duration-500 hover:border-l-indigo-500/15">
                {sidebarContentJSX}
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
