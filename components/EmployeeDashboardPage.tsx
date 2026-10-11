import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Order, User, Settings, OrderStatus, Store } from '../types';
import { 
  PhoneForwarded, 
  CheckCircle, 
  ArrowLeft, 
  XCircle, 
  Clock, 
  MessageCircle, 
  Phone, 
  Copy, 
  Search, 
  Filter, 
  Sparkles, 
  Coins, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Package, 
  Check, 
  AlertCircle, 
  ShoppingCart, 
  Coffee, 
  Play, 
  Square, 
  FileText, 
  Plus, 
  Trash2, 
  Calculator, 
  Share2,
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmployeeDashboardPageProps {
  orders: Order[];
  setOrders: (updater: (prev: Order[]) => Order[]) => void;
  currentUser: User | null;
  settings: Settings;
  activeStore?: Store | null;
}

interface ShiftTask {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export const EmployeeDashboardPage: React.FC<EmployeeDashboardPageProps> = ({ 
  orders, 
  setOrders, 
  currentUser, 
  settings,
  activeStore
}) => {
    const navigate = useNavigate();
    const canManageOrders = Boolean(currentUser?.isAdmin || currentUser?.permissions?.includes('ORDERS_MANAGE') || currentUser?.permissions?.includes('ORDERS_VIEW'));
    const canUsePOS = Boolean(currentUser?.isAdmin || currentUser?.permissions?.includes('POS_VIEW') || currentUser?.permissions?.includes('POS_MANAGE'));

    // Active operational tab
    const [activeTab, setActiveTab] = useState<'assigned' | 'scripts' | 'shipping_calc' | 'tasks'>('assigned');
    
    // Search and filter for assigned orders
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'reminders'>('all');
    
    // Copy toast feedback
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const triggerCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Employee specific tasks stored in localStorage
    const [tasks, setTasks] = useState<ShiftTask[]>(() => {
        try {
            const raw = localStorage.getItem(`emp_tasks_${currentUser?.phone}`);
            if (raw) return JSON.parse(raw);
        } catch {}
        return [
            { id: '1', text: 'مراجعة وتأكيد الطلبات الجديدة في قائمة الانتظار', done: false, createdAt: Date.now() },
            { id: '2', text: 'إعادة الاتصال بالعملاء الذين لم يردوا أمس', done: false, createdAt: Date.now() },
            { id: '3', text: 'التأكد من اكتمال العناوين ورقم الهاتف البديل', done: false, createdAt: Date.now() }
        ];
    });

    const [newTaskText, setNewTaskText] = useState('');

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;
        const updated = [...tasks, { id: String(Date.now()), text: newTaskText.trim(), done: false, createdAt: Date.now() }];
        setTasks(updated);
        setNewTaskText('');
        try {
            localStorage.setItem(`emp_tasks_${currentUser?.phone}`, JSON.stringify(updated));
        } catch {}
    };

    const toggleTask = (id: string) => {
        const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
        setTasks(updated);
        try {
            localStorage.setItem(`emp_tasks_${currentUser?.phone}`, JSON.stringify(updated));
        } catch {}
    };

    const deleteTask = (id: string) => {
        const updated = tasks.filter(t => t.id !== id);
        setTasks(updated);
        try {
            localStorage.setItem(`emp_tasks_${currentUser?.phone}`, JSON.stringify(updated));
        } catch {}
    };

    // Shift Status & Timer from LocalStorage
    const [shiftStatus, setShiftStatus] = useState<'working' | 'break' | 'stopped'>(() => {
        try {
            return (localStorage.getItem(`emp_shift_status_${currentUser?.phone}`) as any) || 'working';
        } catch {
            return 'working';
        }
    });

    // Assigned Orders
    const assignedOrders = useMemo(() => {
        if (!currentUser?.phone) return [];
        return orders.filter(o => o.assignedTo === currentUser.phone || o.assignedTo === currentUser.fullName);
    }, [orders, currentUser]);

    // Pending confirmation queue across store
    const unconfirmedOrders = useMemo(() => {
        const pendingStatuses = ['جديد', 'قيد_المراجعة', 'في_انتظار_المكالمة', 'مؤجل'];
        return orders.filter(o => pendingStatuses.includes(o.status));
    }, [orders]);

    // Statistics & Performance Calculations
    const stats = useMemo(() => {
        const pendingStatuses = ['في_انتظار_المكالمة', 'مؤجل', 'جديد', 'قيد_المراجعة'];
        const confirmedStatuses = ['تم_التأكيد', 'قيد_التنفيذ', 'تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'تم_التحصيل'];
        
        // Orders where current user performed a confirmation action
        const myConfirmedLogsCount = orders.filter(o => 
            o.confirmationLogs?.some(log => log.userId === currentUser?.phone && (log.action === 'تم التأكيد' || log.action === 'تأكيد'))
        ).length;

        // Current assigned pending
        const myPending = assignedOrders.filter(o => pendingStatuses.includes(o.status)).length;
        
        // Follow-up reminders
        const myFollowUps = assignedOrders.filter(o => Boolean(o.followUpReminder)).length;

        // Total orders handled by this user
        const totalHandled = orders.filter(o =>
            o.confirmationLogs?.some(log => log.userId === currentUser?.phone)
        ).length;

        const successRate = totalHandled > 0 ? Math.round((myConfirmedLogsCount / totalHandled) * 100) : 0;

        // Commission calculations
        const currentEmpConfig = settings?.employees?.find(e => e.id === currentUser?.phone);
        let earnedCommission = 0;
        if (currentEmpConfig?.commissionValue && currentEmpConfig.commissionValue > 0) {
            if (currentEmpConfig.commissionType === 'percentage') {
                // Sum product price of confirmed orders * percentage
                const confirmedTotalSales = orders
                    .filter(o => o.confirmationLogs?.some(log => log.userId === currentUser?.phone && log.action.includes('تأكيد')))
                    .reduce((sum, o) => sum + (o.totalPrice || o.productPrice || 0), 0);
                earnedCommission = Math.round((confirmedTotalSales * currentEmpConfig.commissionValue) / 100);
            } else {
                // Fixed per confirmed order
                earnedCommission = myConfirmedLogsCount * currentEmpConfig.commissionValue;
            }
        } else if (currentEmpConfig?.balance) {
            earnedCommission = currentEmpConfig.balance;
        }

        return {
            unconfirmedTotal: unconfirmedOrders.length,
            myPending,
            myConfirmed: myConfirmedLogsCount,
            myFollowUps,
            totalHandled,
            successRate,
            earnedCommission,
            commissionConfig: currentEmpConfig
        };
    }, [orders, assignedOrders, unconfirmedOrders, currentUser, settings]);

    // Filtered assigned orders list
    const filteredAssignedOrders = useMemo(() => {
        return assignedOrders.filter(order => {
            const matchesSearch = !searchQuery.trim() || 
                (order.customerName && order.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (order.customerPhone && order.customerPhone.includes(searchQuery)) ||
                (order.orderNumber && order.orderNumber.includes(searchQuery));

            if (!matchesSearch) return false;

            if (statusFilter === 'pending') {
                return ['في_انتظار_المكالمة', 'مؤجل', 'جديد', 'قيد_المراجعة'].includes(order.status);
            }
            if (statusFilter === 'confirmed') {
                return ['تم_التأكيد', 'قيد_التنفيذ', 'تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'تم_التحصيل'].includes(order.status);
            }
            if (statusFilter === 'reminders') {
                return Boolean(order.followUpReminder);
            }
            return true;
        });
    }, [assignedOrders, searchQuery, statusFilter]);

    // Greeting based on time of day
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'صباح الخير والإنتاجية';
        if (hour < 17) return 'طاب يومك ومرحباً بك';
        return 'مساء الخير والعمل الموفق';
    }, []);

    // Instant Shipping Calculator state
    const [calcGov, setCalcGov] = useState('القاهرة');
    const [calcWeight, setCalcWeight] = useState(1);
    
    // Quick script generator state
    const [selectedScriptOrder, setSelectedScriptOrder] = useState<Order | null>(assignedOrders[0] || null);

    const quickScripts = useMemo(() => {
        const customer = selectedScriptOrder?.customerName || 'عزيزي العميل';
        const orderNum = selectedScriptOrder?.orderNumber || '0000';
        const store = activeStore?.name || settings.storeName || 'متجرنا';
        const empName = currentUser?.fullName?.split(' ')[0] || 'خدمة العملاء';

        return [
            {
                id: 'confirm',
                title: 'تأكيد الطلب والعنوان',
                desc: 'رسالة ودية لتأكيد تفاصيل الطلب وتحديد موعد الشحن',
                text: `أهلاً بحضرتك أستاذ ${customer}، معك ${empName} من ${store}. بخصوص طلبك رقم #${orderNum}، يسعدنا تأكيد طلبك لتجهيزه للشحن فوراً. برجاء تأكيد العنوان المناسب للاستلام.`
            },
            {
                id: 'no_answer_1',
                title: 'لم يتم الرد (المحاولة الأولى)',
                desc: 'إشعار لطيف بعد تعذر الاتصال الهاتفي',
                text: `مرحباً أستاذ ${customer}، حاولنا التواصل هاتفياً لتأكيد طلبك #${orderNum} من ${store} ولم نتمكن من الوصول إليك. برجاء إبلاغنا بالوقت المناسب للاتصال، أو الرد لتأكيد شحن طلبك.`
            },
            {
                id: 'no_answer_2',
                title: 'تنبيه قبل الإلغاء (المحاولة الأخيرة)',
                desc: 'تنبيه لتفادي إلغاء الطلب التلقائي',
                text: `أستاذ ${customer}، حاولنا الاتصال بحضرتك عدة مرات بخصوص طلبك #${orderNum}. برجاء الرد خلال اليوم لتأكيد الشحن حرصاً على عدم إلغاء حجز المنتجات تلقائياً. شكراً لتفهمك.`
            },
            {
                id: 'location_req',
                title: 'طلب الموقع الجغرافي (Location)',
                desc: 'لتسهيل وصول مندوب شركة الشحن بدقة',
                text: `مرحباً أستاذ ${customer} من ${store} بخصوص طلبك #${orderNum}. لتسهيل وتسريع وصول مندوب الشحن لباب بيتك، برجاء إرسال اللوكيشن الحالي على هذا الرقم. شكراً لتعاونك!`
            },
            {
                id: 'shipped_notice',
                title: 'إشعار خروج الشحنة للمندوب',
                desc: 'لإعلام العميل بموعد الاستلام والمبلغ المطلوب',
                text: `بشرى سارة أستاذ ${customer}! طلبك #${orderNum} خرج الآن مع مندوب التوصيل وسيتواصل معك خلال ساعات للاستلام. نرجو تجهيز المبلغ المطلوب وإبقاء الهاتف متاحاً.`
            }
        ];
    }, [selectedScriptOrder, activeStore, settings, currentUser]);

    // Format phone for whatsapp
    const getCleanPhone = (phone: string) => {
        if (!phone) return '';
        let cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('01')) {
            cleaned = '2' + cleaned;
        }
        return cleaned;
    };

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
            
            {/* Top Executive Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-5 sm:p-8 shadow-xl border border-slate-700/60">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5">
                                <Sparkles size={13} />
                                <span>{activeStore?.name || settings.storeName || 'المتجر الرئيسي'}</span>
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">
                                • {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            {greeting}، {currentUser?.fullName?.split(' ')[0]}!
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
                            لوحة متابعة العمليات اليومية وتأكيد الطلبات. إليك نظرة سريعة على مهامك وأدائك الحالي.
                        </p>
                    </div>

                    {/* Quick Launch Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {canManageOrders && (
                            <Link
                                to="/employee/confirmation-queue"
                                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all hover:scale-102 cursor-pointer"
                            >
                                <PhoneForwarded size={18} />
                                <span>قائمة تأكيد الطلبات</span>
                                {stats.unconfirmedTotal > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-950 text-emerald-300 text-xs font-black">
                                        {stats.unconfirmedTotal}
                                    </span>
                                )}
                            </Link>
                        )}

                        {canUsePOS && (
                            <Link
                                to="/employee/pos"
                                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/15 backdrop-blur-md transition-all cursor-pointer"
                            >
                                <ShoppingCart size={17} />
                                <span>الكاشير (POS)</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Performance Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                
                {/* 1. Pending Confirmation */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">بانتظار التأكيد</span>
                        <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
                            <PhoneForwarded size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                            {stats.unconfirmedTotal}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-semibold">
                            <span>منها {stats.myPending} مخصصة لك مباشرة</span>
                        </div>
                    </div>
                </div>

                {/* 2. Confirmed Orders */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">تأكيداتي الناجحة</span>
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                            {stats.myConfirmed}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-semibold">
                            <span>نسبة النجاح: {stats.successRate}%</span>
                        </div>
                    </div>
                </div>

                {/* 3. Follow-up Reminders */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مواعيد المتابعة</span>
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                            <Clock size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
                            {stats.myFollowUps}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-semibold">
                            <span>تذكيرات بإعادة الاتصال</span>
                        </div>
                    </div>
                </div>

                {/* 4. Earnings / Commission or Handled */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {stats.commissionConfig?.commissionValue ? 'عمولتي المستحقة' : 'إجمالي العمليات'}
                        </span>
                        <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                            <Coins size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
                            {stats.commissionConfig?.commissionValue ? `${stats.earnedCommission} ج.م` : stats.totalHandled}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-semibold">
                            {stats.commissionConfig?.commissionValue 
                                ? `(${stats.commissionConfig.commissionValue} ${stats.commissionConfig.commissionType === 'percentage' ? '%' : 'ج.م/طلب'})`
                                : 'مكالمات وتأكيدات مسجلة'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs for Operations Hub */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                    onClick={() => setActiveTab('assigned')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition cursor-pointer ${
                        activeTab === 'assigned'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <UserCheck size={16} />
                    <span>مكتب الطلبات المعينة لي ({assignedOrders.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('scripts')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition cursor-pointer ${
                        activeTab === 'scripts'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <MessageCircle size={16} />
                    <span>قوالب الردود السريعة للواتساب</span>
                </button>

                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition cursor-pointer ${
                        activeTab === 'tasks'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <FileText size={16} />
                    <span>مهام الوردية ({tasks.filter(t => !t.done).length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('shipping_calc')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition cursor-pointer ${
                        activeTab === 'shipping_calc'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <Calculator size={16} />
                    <span>حاسبة الشحن الفورية للعميل</span>
                </button>
            </div>

            {/* TAB 1: Assigned Orders Operations Desk */}
            {activeTab === 'assigned' && (
                <div className="space-y-4">
                    {/* Search & Filter Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="relative w-full sm:w-80">
                            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="ابحث باسم العميل أو الهاتف أو رقم الطلب..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${statusFilter === 'all' ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                الكل ({assignedOrders.length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${statusFilter === 'pending' ? 'bg-cyan-600 text-white' : 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400'}`}
                            >
                                بانتظار التأكيد ({assignedOrders.filter(o => ['في_انتظار_المكالمة', 'مؤجل', 'جديد'].includes(o.status)).length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('reminders')}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${statusFilter === 'reminders' ? 'bg-amber-600 text-white' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'}`}
                            >
                                تذكيرات المتابعة ({assignedOrders.filter(o => Boolean(o.followUpReminder)).length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('confirmed')}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${statusFilter === 'confirmed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'}`}
                            >
                                مؤكد ({assignedOrders.filter(o => ['تم_التأكيد', 'قيد_التنفيذ', 'تم_الارسال'].includes(o.status)).length})
                            </button>
                        </div>
                    </div>

                    {/* Orders Cards Grid */}
                    {filteredAssignedOrders.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredAssignedOrders.map(order => {
                                const cleanPhone = getCleanPhone(order.customerPhone);
                                const isPending = ['في_انتظار_المكالمة', 'مؤجل', 'جديد', 'قيد_المراجعة'].includes(order.status);
                                
                                return (
                                    <div 
                                        key={order.id} 
                                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between hover:border-emerald-500/50 transition-all space-y-3"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-black text-xs text-slate-800 dark:text-white">
                                                        #{order.orderNumber}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                        isPending 
                                                            ? 'bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 animate-pulse'
                                                            : order.status.includes('تأكيد') || order.status.includes('تنفيذ')
                                                            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                    }`}>
                                                        {order.status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>

                                                <span className="text-[11px] font-mono text-slate-400">
                                                    {order.date ? new Date(order.date).toLocaleDateString('ar-EG') : ''}
                                                </span>
                                            </div>

                                            {/* Customer Name & Phone */}
                                            <div className="mt-3 space-y-1.5">
                                                <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                                                    {order.customerName}
                                                </div>

                                                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                                    <span className="font-mono dir-ltr select-all">{order.customerPhone}</span>
                                                    <button
                                                        onClick={() => triggerCopy(order.customerPhone, `phone-${order.id}`)}
                                                        className="text-[11px] text-slate-400 hover:text-emerald-600 flex items-center gap-1 cursor-pointer"
                                                        title="نسخ رقم الهاتف"
                                                    >
                                                        {copiedKey === `phone-${order.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                        <span>{copiedKey === `phone-${order.id}` ? 'تم النسخ' : 'نسخ'}</span>
                                                    </button>
                                                </div>

                                                {order.customerCity && (
                                                    <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                                                        <MapPin size={12} className="text-emerald-600 shrink-0" />
                                                        <span className="truncate">{order.customerCity} {order.customerAddress ? `- ${order.customerAddress}` : ''}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Products & Total */}
                                            <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-500 text-[11px]">المنتجات:</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                                                        {order.productName || (order.items && order.items[0]?.name) || 'منتج مخصص'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                                                    <span className="text-slate-500 text-[11px]">إجمالي التحصيل:</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">
                                                        {order.totalPrice || order.productPrice} ج.م
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Follow up reminder badge if present */}
                                            {order.followUpReminder && (
                                                <div className="mt-2.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                                                    <Clock size={13} className="shrink-0" />
                                                    <span className="truncate text-[11px] font-bold">{order.followUpReminder}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Actions Bar */}
                                        <div className="pt-2 flex items-center gap-1.5">
                                            {/* 1. Direct Call */}
                                            <a
                                                href={`tel:${order.customerPhone}`}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                                                title="اتصال هاتفي مباشر"
                                            >
                                                <Phone size={14} className="text-emerald-600" />
                                                <span>اتصال</span>
                                            </a>

                                            {/* 2. Direct WhatsApp */}
                                            {cleanPhone && (
                                                <a
                                                    href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`أهلاً بحضرتك أستاذ ${order.customerName}، بخصوص طلبك #${order.orderNumber} من ${activeStore?.name || settings.storeName || 'متجرنا'}. نود تأكيد تفاصيل الشحن والاستلام.`)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                                                    title="محادثة واتساب سريعة"
                                                >
                                                    <MessageCircle size={14} />
                                                    <span>واتساب</span>
                                                </a>
                                            )}

                                            {/* 3. Open in Confirmation Queue */}
                                            <Link
                                                to="/employee/confirmation-queue"
                                                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                                                title="فتح تفاصيل الطلب وتأكيده في قائمة العمليات"
                                            >
                                                <ExternalLink size={15} />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="font-black text-lg text-slate-800 dark:text-white">لا توجد طلبات معينة تحتاج إجراء حالياً</h3>
                            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                                أحسنت! كافة طلباتك المخصصة تم التعامل معها أو لا توجد طلبات معلقة تطابق فلتر البحث. يمكنك سحب طلبات جديدة من قائمة تأكيد الطلبات العامة.
                            </p>
                            <Link
                                to="/employee/confirmation-queue"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition"
                            >
                                <PhoneForwarded size={16} />
                                <span>الانتقال لقائمة تأكيد الطلبات العامة ({stats.unconfirmedTotal})</span>
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: Quick WhatsApp Response Scripts */}
            {activeTab === 'scripts' && (
                <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="font-black text-sm text-slate-900 dark:text-white">قوالب الردود السريعة الاحترافية</h3>
                            <p className="text-xs text-slate-500">انسخ القالب فوراً أو افتحه بالواتساب مباشرة مع اسم العميل ورقم الطلب</p>
                        </div>

                        {assignedOrders.length > 0 && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-xs font-bold text-slate-400 shrink-0">تخصيص للطلب:</span>
                                <select
                                    value={selectedScriptOrder?.id || ''}
                                    onChange={(e) => {
                                        const found = assignedOrders.find(o => o.id === e.target.value);
                                        if (found) setSelectedScriptOrder(found);
                                    }}
                                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                                >
                                    {assignedOrders.map(o => (
                                        <option key={o.id} value={o.id}>
                                            #{o.orderNumber} - {o.customerName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quickScripts.map(script => (
                            <div 
                                key={script.id} 
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-3"
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-black text-sm text-slate-900 dark:text-white">{script.title}</h4>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                                            جاهز للنسخ
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{script.desc}</p>
                                    
                                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                                        {script.text}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        onClick={() => triggerCopy(script.text, script.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                                    >
                                        {copiedKey === script.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                        <span>{copiedKey === script.id ? 'تم النسخ بنجاح!' : 'نسخ الرسالة'}</span>
                                    </button>

                                    {selectedScriptOrder?.customerPhone && (
                                        <a
                                            href={`https://wa.me/${getCleanPhone(selectedScriptOrder.customerPhone)}?text=${encodeURIComponent(script.text)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                                        >
                                            <MessageCircle size={14} />
                                            <span>إرسال واتساب</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: Shift Tasks Checklist */}
            {activeTab === 'tasks' && (
                <div className="space-y-4 max-w-3xl mx-auto">
                    {/* Add Task Form */}
                    <form onSubmit={handleAddTask} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="أضف مهمة سريعة للوردية (مثل: إعادة الاتصال بالعميل أحمد الساعة 4)..."
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                        />
                        <button
                            type="submit"
                            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                            <Plus size={18} />
                            <span>إضافة</span>
                        </button>
                    </form>

                    {/* Task List */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 divide-y divide-slate-100 dark:divide-slate-800 shadow-xs">
                        {tasks.length > 0 ? (
                            tasks.map(task => (
                                <div key={task.id} className="py-3 px-2 flex items-center justify-between gap-3 group">
                                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                                        <input
                                            type="checkbox"
                                            checked={task.done}
                                            onChange={() => toggleTask(task.id)}
                                            className="w-5 h-5 rounded-lg text-emerald-600 border-slate-300 dark:border-slate-700 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span className={`text-sm font-semibold transition ${task.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {task.text}
                                        </span>
                                    </label>

                                    <button
                                        onClick={() => deleteTask(task.id)}
                                        className="text-slate-400 hover:text-rose-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                        title="حذف المهمة"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                لا توجد مهام حالياً. أضف مهامك لتنظيم ورديتك!
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: Instant Shipping & Price Calculator for live phone calls */}
            {activeTab === 'shipping_calc' && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-2xl mx-auto space-y-5">
                    <div>
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                            <Calculator size={18} className="text-emerald-600" />
                            <span>حاسبة الشحن الفورية أثناء المكالمة</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            تمكنك من إعطاء العميل سعر الشحن وموعد التوصيل الدقيق فورياً أثناء التحدث معه.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">المحافظة أو المدينة</label>
                            <select
                                value={calcGov}
                                onChange={(e) => setCalcGov(e.target.value)}
                                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                            >
                                {['القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'المنوفية', 'القليوبية', 'الغربية', 'البحيرة', 'دمياط', 'كفر الشيخ', 'بورسعيد', 'الإسماعيلية', 'السويس', 'بني سويف', 'الفيوم', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'مطروح', 'البحر الأحمر', 'الوادي الجديد'].map(gov => (
                                    <option key={gov} value={gov}>{gov}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">الوزن التقديري (كجم)</label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={calcWeight}
                                onChange={(e) => setCalcWeight(Number(e.target.value))}
                                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none"
                            />
                        </div>
                    </div>

                    {/* Calculation result card */}
                    {(() => {
                        // Quick lookup for company and estimated cost
                        const isCairoGiza = ['القاهرة', 'الجيزة'].includes(calcGov);
                        const isAlexDelta = ['الإسكندرية', 'الدقهلية', 'الشرقية', 'المنوفية', 'القليوبية', 'الغربية', 'البحيرة', 'دمياط', 'كفر الشيخ'].includes(calcGov);
                        const isUpperEgypt = ['بني سويف', 'الفيوم', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان'].includes(calcGov);
                        
                        const baseFee = isCairoGiza ? 45 : isAlexDelta ? 55 : isUpperEgypt ? 70 : 85;
                        const weightFee = calcWeight > 1 ? (calcWeight - 1) * 7 : 0;
                        const totalEstimated = baseFee + weightFee;
                        const deliveryTime = isCairoGiza ? '24 - 48 ساعة' : isAlexDelta ? '2 - 3 أيام عمل' : '3 - 5 أيام عمل';

                        return (
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">سعر الشحن التقديري للعميل:</span>
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                        {totalEstimated} ج.م
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-emerald-500/10">
                                    <span>مدة التوصيل المتوقعة:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{deliveryTime}</span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    💡 يمكنك إبلاغ العميل: "الشحن لمحافظة {calcGov} بيكون حوالي {totalEstimated} جنيه، والاستلام خلال {deliveryTime}."
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Bottom Floating Operations Shortcut */}
            {canManageOrders && (
                <div className="rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-right">
                        <h3 className="text-xl sm:text-2xl font-black">جاهز للبدء في تأكيد الطلبات الجديدة؟</h3>
                        <p className="text-xs sm:text-sm text-indigo-100 max-w-md">
                            يوجد {stats.unconfirmedTotal} طلب بانتظار الاتصال والمراجعة. اضغط للانتقال مباشرة لشاشة تأكيد المكالمات وتسجيل النتيجة.
                        </p>
                    </div>

                    <Link
                        to="/employee/confirmation-queue"
                        className="px-6 py-3.5 rounded-2xl bg-white text-indigo-900 hover:bg-indigo-50 font-black text-sm shadow-lg transition-transform hover:scale-103 shrink-0 flex items-center gap-2 cursor-pointer"
                    >
                        <span>فتح قائمة التأكيد الآن</span>
                        <ArrowLeft size={18} />
                    </Link>
                </div>
            )}
        </div>
    );
};

export default EmployeeDashboardPage;
