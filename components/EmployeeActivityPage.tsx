import React, { useMemo, useState } from 'react';
import { Order, User, OrderStatus as OrderStatusType, ConfirmationLog } from '../types';
import { History, Search, User as UserIcon, Calendar, ArrowRight, Package, CheckCircle, Clock, XCircle, RefreshCcw, Archive, ArrowRightLeft, Truck } from 'lucide-react';
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
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${colors[info.color]}`}>
            {info.icon}
            {info.label}
        </span>
    );
};

interface EmployeeActivityPageProps {
  orders: Order[];
  currentUser: User | null;
}

const EmployeeActivityPage: React.FC<EmployeeActivityPageProps> = ({ orders, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const myActivityOrders = useMemo(() => {
        if (!currentUser) return [];

        return orders
            .map(order => {
                const userLogs = (order.confirmationLogs || [])
                    .filter(log => log.userId === currentUser.phone)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                if (userLogs.length === 0) {
                    return null;
                }

                return {
                    order,
                    lastAction: userLogs[0]
                };
            })
            .filter((item): item is { order: Order; lastAction: ConfirmationLog } => item !== null)
            .filter(item => 
                 item.order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 item.order.orderNumber.includes(searchTerm)
            )
            .sort((a, b) => new Date(b.lastAction.timestamp).getTime() - new Date(a.lastAction.timestamp).getTime());
    }, [orders, currentUser, searchTerm]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl"><History size={28} /></div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white">سجل طلباتي</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">تتبع الطلبات التي قمت بالتعامل معها وحالتها الحالية.</p>
                    </div>
                </div>
            </motion.div>
            
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <div className="relative">
                    <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="ابحث باسم العميل أو رقم الطلب..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm pr-12 pl-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-4">
                {myActivityOrders.length > 0 ? (
                    myActivityOrders.map(({ order, lastAction }) => (
                        <div key={order.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">{order.customerName}</h3>
                                    <p className="text-xs text-slate-500 font-mono">#{order.orderNumber}</p>
                                </div>
                                <div className="text-right">
                                    <StatusBadge status={order.status} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                                    <p className="text-xs font-bold text-slate-400 mb-1">الإجراء الذي قمت به</p>
                                    <p className="font-bold text-purple-600 dark:text-purple-400">{lastAction.action}</p>
                                    <p className="text-xs text-slate-500 mt-1">{new Date(lastAction.timestamp).toLocaleString('ar-EG')}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                                    <p className="text-xs font-bold text-slate-400 mb-1">المنتجات</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-300 text-sm truncate">{order.productName}</p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                        <History size={48} className="mx-auto mb-4 opacity-50"/>
                        <p className="font-bold">لا يوجد نشاط مسجل لك حتى الآن.</p>
                        <p className="text-sm mt-1">الطلبات التي تتعامل معها ستظهر هنا.</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default EmployeeActivityPage;