import React, { useMemo, useState } from 'react';
import { Order, User, OrderStatus as OrderStatusType, ConfirmationLog } from '../types';
import { 
  History, 
  Search, 
  Calendar, 
  ArrowRight, 
  Package, 
  CheckCircle, 
  Clock, 
  XCircle, 
  RefreshCcw, 
  Archive, 
  ArrowRightLeft, 
  Truck, 
  Filter, 
  Download, 
  Copy, 
  Check, 
  Share2, 
  PhoneCall, 
  TrendingUp, 
  MessageCircle,
  Phone,
  Coins
} from 'lucide-react';
import { motion } from 'framer-motion';

const statusInfo: Record<OrderStatusType, { label: string; color: string; icon: React.ReactElement }> = {
  في_انتظار_المكالمة: { label: 'بانتظار المكالمة', color: 'cyan', icon: <Clock size={12}/> },
  جاري_المراجعة: { label: 'جاري المراجعة', color: 'purple', icon: <Clock size={12}/> },
  قيد_التنفيذ: { label: 'قيد التنفيذ', color: 'yellow', icon: <Clock size={12}/> },
  تم_الارسال: { label: 'تم الارسال', color: 'sky', icon: <Truck size={12}/> },
  قيد_الشحن: { label: 'قيد الشحن', color: 'blue', icon: <Truck size={12}/> },
  تم_توصيلها: { label: 'تم توصيلها', color: 'teal', icon: <CheckCircle size={12}/> },
  تم_التوصيل: { label: 'تم التوصيل', color: 'emerald', icon: <CheckCircle size={12}/> },
  تم_التحصيل: { label: 'تم التحصيل', color: 'emerald', icon: <CheckCircle size={12}/> },
  مرتجع: { label: 'مرتجع', color: 'red', icon: <RefreshCcw size={12}/> },
  مرتجع_جزئي: { label: 'مرتجع جزئي', color: 'orange', icon: <RefreshCcw size={12}/> },
  فشل_التوصيل: { label: 'فشل التوصيل', color: 'red', icon: <XCircle size={12}/> },
  ملغي: { label: 'ملغي', color: 'slate', icon: <XCircle size={12}/> },
  مؤرشف: { label: 'مؤرشف', color: 'slate', icon: <Archive size={12}/> },
  مرتجع_بعد_الاستلام: { label: 'مرتجع بعد الاستلام', color: 'orange', icon: <RefreshCcw size={12}/> },
  تم_الاستبدال: { label: 'تم الاستبدال', color: 'slate', icon: <ArrowRightLeft size={12}/> },
  تمت_الاعادة_لشركة_الشحن: { label: 'عادت لشركة الشحن', color: 'red', icon: <XCircle size={12}/> },
  مدفوعة: { label: 'مدفوعة', color: 'emerald', icon: <CheckCircle size={12}/> },
  مؤجل: { label: 'مؤجل', color: 'orange', icon: <Clock size={12}/> },
  مجدول: { label: 'مجدول', color: 'blue', icon: <Clock size={12}/> },
};

const StatusBadge = ({ status }: { status: OrderStatusType }) => {
    const info = statusInfo[status] || { label: status.replace(/_/g, ' '), color: 'slate', icon: <Clock size={12}/> };
    const colors: Record<string, string> = {
        cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400',
        purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400',
        yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400',
        sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400',
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
        teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400',
        emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
        red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
        orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
        slate: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[info.color] || colors.slate}`}>
            {info.icon}
            {info.label}
        </span>
    );
};

interface EmployeeActivityPageProps {
  orders: Order[];
  currentUser: User | null;
}

export const EmployeeActivityPage: React.FC<EmployeeActivityPageProps> = ({ orders, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState<'all' | 'confirmed' | 'no_answer' | 'canceled'>('all');
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [copiedReport, setCopiedReport] = useState(false);

    // Extract all log events performed by this employee
    const activityItems = useMemo(() => {
        if (!currentUser?.phone) return [];

        const items: Array<{
            order: Order;
            log: ConfirmationLog;
            timestamp: number;
        }> = [];

        orders.forEach(order => {
            (order.confirmationLogs || []).forEach(log => {
                if (log.userId === currentUser.phone || log.userId === (currentUser as any).id || log.userId === (currentUser as any).uid) {
                    items.push({
                        order,
                        log,
                        timestamp: new Date(log.timestamp).getTime()
                    });
                }
            });
        });

        // Filter by Date
        const now = Date.now();
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

        return items
            .filter(item => {
                if (dateRange === 'today') return item.timestamp >= startOfToday;
                if (dateRange === 'week') return item.timestamp >= oneWeekAgo;
                if (dateRange === 'month') return item.timestamp >= oneMonthAgo;
                return true;
            })
            .filter(item => {
                if (actionFilter === 'confirmed') return item.log.action.includes('تأكيد');
                if (actionFilter === 'no_answer') return item.log.action.includes('لم يرد');
                if (actionFilter === 'canceled') return item.log.action.includes('إلغاء') || item.log.action.includes('الغاء');
                return true;
            })
            .filter(item => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (
                    (item.order.customerName && item.order.customerName.toLowerCase().includes(term)) ||
                    (item.order.orderNumber && item.order.orderNumber.includes(term)) ||
                    (item.order.customerPhone && item.order.customerPhone.includes(term)) ||
                    (item.log.notes && item.log.notes.toLowerCase().includes(term))
                );
            })
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [orders, currentUser, dateRange, actionFilter, searchTerm]);

    // Statistics for the filtered view
    const stats = useMemo(() => {
        const total = activityItems.length;
        const confirmed = activityItems.filter(i => i.log.action.includes('تأكيد')).length;
        const noAnswer = activityItems.filter(i => i.log.action.includes('لم يرد')).length;
        const canceled = activityItems.filter(i => i.log.action.includes('إلغاء') || i.log.action.includes('الغاء')).length;
        const confirmedSales = activityItems
            .filter(i => i.log.action.includes('تأكيد'))
            .reduce((sum, i) => sum + (i.order.totalPrice || i.order.productPrice || 0), 0);

        const successRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

        return { total, confirmed, noAnswer, canceled, confirmedSales, successRate };
    }, [activityItems]);

    // Generate Shareable Daily Report for Manager
    const handleCopyDailyReport = () => {
        const dateStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const report = `📊 *تقرير إنجاز وردية الموظف*
👤 الموظف: ${currentUser?.fullName || 'موظف'}
📅 التاريخ: ${dateStr}
------------------------------
📞 إجمالي الإجراءات المسجلة: ${stats.total}
✅ الطلبات المؤكدة: ${stats.confirmed}
⏳ لم يتم الرد: ${stats.noAnswer}
❌ تم الإلغاء: ${stats.canceled}
🎯 نسبة النجاح: ${stats.successRate}%
💰 قيمة مبيعات الطلبات المؤكدة: ${stats.confirmedSales.toLocaleString()} ج.م
------------------------------
تم الاستخراج من بوابة عمليات الموظفين الذكية.`;

        navigator.clipboard.writeText(report);
        setCopiedReport(true);
        setTimeout(() => setCopiedReport(false), 2500);
    };

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
            
            {/* Header with Title and Report Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-2xl">
                        <History size={26} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">سجل العمليات والنشاط</h1>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            سجل تفصيلي لكافة مكالماتك وإجراءاتك على الطلبات مع إمكانية مشاركة التقرير.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleCopyDailyReport}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/20 transition cursor-pointer"
                >
                    {copiedReport ? <Check size={16} /> : <Share2 size={16} />}
                    <span>{copiedReport ? 'تم نسخ التقرير للواتساب!' : 'نسخ تقرير الوردية للمدير'}</span>
                </button>
            </div>

            {/* Performance KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-xs font-bold text-slate-500">إجمالي الإجراءات</span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                        {stats.total}
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">مكالمة ومتابعة</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-xs font-bold text-slate-500">تم التأكيد بنجاح</span>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {stats.confirmed}
                    </div>
                    <span className="text-[11px] text-emerald-600/80 font-bold">نسبة النجاح: {stats.successRate}%</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-xs font-bold text-slate-500">لم يتم الرد</span>
                    <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
                        {stats.noAnswer}
                    </div>
                    <span className="text-[11px] text-amber-600/80 font-bold">تحتاج معاودة اتصال</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-xs font-bold text-slate-500">قيمة المبيعات المؤكدة</span>
                    <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">
                        {stats.confirmedSales.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">من الطلبات المؤكدة</span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative w-full md:w-80">
                        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="ابحث باسم العميل أو الهاتف أو رقم الطلب أو الملاحظات..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    {/* Date Filter */}
                    <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
                        <button
                            onClick={() => setDateRange('all')}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${dateRange === 'all' ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                            كل الفترات
                        </button>
                        <button
                            onClick={() => setDateRange('today')}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${dateRange === 'today' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                            اليوم
                        </button>
                        <button
                            onClick={() => setDateRange('week')}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${dateRange === 'week' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                            آخر 7 أيام
                        </button>
                        <button
                            onClick={() => setDateRange('month')}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${dateRange === 'month' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                            هذا الشهر
                        </button>
                    </div>
                </div>

                {/* Action Filter */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto text-xs">
                    <span className="text-slate-400 font-bold shrink-0">نوع الإجراء:</span>
                    <button
                        onClick={() => setActionFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 ${actionFilter === 'all' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}
                    >
                        الكل
                    </button>
                    <button
                        onClick={() => setActionFilter('confirmed')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 ${actionFilter === 'confirmed' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}
                    >
                        تم التأكيد
                    </button>
                    <button
                        onClick={() => setActionFilter('no_answer')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 ${actionFilter === 'no_answer' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}
                    >
                        لم يتم الرد
                    </button>
                    <button
                        onClick={() => setActionFilter('canceled')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 ${actionFilter === 'canceled' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}
                    >
                        ملغي
                    </button>
                </div>
            </div>

            {/* Activity Timeline List */}
            <div className="space-y-3">
                {activityItems.length > 0 ? (
                    activityItems.map(({ order, log, timestamp }, index) => {
                        const isConfirmed = log.action.includes('تأكيد');
                        const isNoAnswer = log.action.includes('لم يرد');
                        const isCanceled = log.action.includes('إلغاء') || log.action.includes('الغاء');

                        return (
                            <div 
                                key={`${order.id}-${timestamp}-${index}`} 
                                className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-purple-500/40 transition"
                            >
                                <div className="space-y-1.5 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                                            isConfirmed ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                                            isNoAnswer ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                                            isCanceled ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' :
                                            'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                        }`}>
                                            {log.action}
                                        </span>

                                        <span className="font-mono font-bold text-xs text-slate-500">
                                            #{order.orderNumber}
                                        </span>

                                        <span className="text-[11px] text-slate-400">
                                            • {new Date(timestamp).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="font-black text-slate-900 dark:text-white">{order.customerName}</span>
                                        <span className="text-xs font-mono text-slate-500 dir-ltr">{order.customerPhone}</span>
                                    </div>

                                    {log.notes && (
                                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 max-w-2xl">
                                            📝 <span className="font-semibold">{log.notes}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Order Status & Price */}
                                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                    <StatusBadge status={order.status} />
                                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                        {order.totalPrice || order.productPrice} ج.م
                                    </span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
                        <History size={48} className="mx-auto opacity-40" />
                        <h3 className="font-black text-base text-slate-700 dark:text-slate-300">لا توجد عمليات مسجلة تطابق البحث</h3>
                        <p className="text-xs max-w-sm mx-auto">
                            العمليات التي تقوم بها عند تأكيد أو مراجعة الطلبات ستظهر هنا مرتبة زمنياً مع تفاصيلها.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmployeeActivityPage;
