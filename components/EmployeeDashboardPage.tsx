import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Order, User, Settings, OrderStatus } from '../types';
import { PhoneForwarded, CheckCircle, ArrowLeft, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmployeeDashboardPageProps {
  orders: Order[];
  setOrders: (updater: (prev: Order[]) => Order[]) => void;
  currentUser: User | null;
  settings: Settings;
}

const StatCard = ({ title, value, icon, colorClass }: { title: string, value: number, icon: React.ReactNode, colorClass: string }) => (
    <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4`}>
        <div className={`p-3 rounded-lg ${colorClass}`}>
            {icon}
        </div>
        <div>
            <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">{title}</div>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{value}</div>
        </div>
    </div>
);


const EmployeeDashboardPage: React.FC<EmployeeDashboardPageProps> = ({ orders, setOrders, currentUser, settings }) => {
    
    const assignedOrders = useMemo(() => {
        return orders.filter(o => o.assignedTo === currentUser?.phone);
    }, [orders, currentUser]);

    const stats = useMemo(() => {
        const dashboardSettings = settings.employeeDashboardSettings;
        const pendingStatuses = ['في_انتظار_المكالمة', 'مؤجل'];
        const confirmedStatuses = dashboardSettings?.showOrderStatuses || ['قيد_التنفيذ', 'تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'تم_التحصيل'];
        const canceledStatuses = ['ملغي', 'مرتجع'];

        const pending = assignedOrders.filter(o => pendingStatuses.includes(o.status)).length;
        const confirmed = assignedOrders.filter(o => 
            o.confirmationLogs?.some(log => log.userId === currentUser?.phone && log.action === 'تم التأكيد')
        ).length;
        const canceled = assignedOrders.filter(o => canceledStatuses.includes(o.status)).length;
        
        return { pending, confirmed, canceled };
    }, [assignedOrders, settings, currentUser]);

    const handleStatusUpdate = (orderId: string, newStatus: OrderStatus) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">
                    أهلاً بعودتك، {currentUser?.fullName.split(' ')[0]}!
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    هنا ملخص سريع لمهامك اليوم.
                </p>
            </motion.div>

            <motion.div 
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
            >
                <StatCard title="طلبات بانتظار التأكيد" value={stats.pending} icon={<PhoneForwarded size={24}/>} colorClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" />
                <StatCard title="طلبات مؤكدة" value={stats.confirmed} icon={<CheckCircle size={24}/>} colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
                <StatCard title="طلبات ملغاة" value={stats.canceled} icon={<XCircle size={24}/>} colorClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
            </motion.div>

            {settings.employeeDashboardSettings?.showAssignedOrders && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"
                >
                    <h2 className="text-xl font-bold mb-4">الطلبات المعينة لك</h2>
                    <div className="space-y-4">
                        {assignedOrders.map(order => (
                            <div key={order.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                <div>
                                    <p className="font-bold">{order.orderNumber}</p>
                                    <p className="text-sm text-slate-500">{order.customerName}</p>
                                </div>
                                <select 
                                    value={order.status} 
                                    onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
                                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm"
                                >
                                    {['في_انتظار_المكالمة', 'جاري_المراجعة', 'قيد_التنفيذ', 'تم_الارسال', 'قيد_الشحن', 'تم_توصيلها', 'تم_التحصيل', 'مرتجع', 'ملغي'].map(status => (
                                        <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
            
            {settings.employeeDashboardSettings?.showFollowUpReminders && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"
                >
                    <h2 className="text-xl font-bold mb-4">تذكيرات المتابعة</h2>
                    <div className="space-y-4">
                        {assignedOrders.filter(o => o.followUpReminder).map(order => (
                            <div key={order.id} className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                                <p className="font-bold text-amber-800 dark:text-amber-200">{order.orderNumber}</p>
                                <p className="text-sm text-amber-700 dark:text-amber-300">{order.followUpReminder}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
            >
                <Link to="/employee/confirmation-queue" className="block bg-indigo-600 text-white p-8 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all group">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-black">اذهب إلى قائمة تأكيد الطلبات</h2>
                            <p className="opacity-80 mt-1">ابدأ في التواصل مع العملاء لتأكيد طلباتهم الجديدة.</p>
                        </div>
                        <ArrowLeft size={32} className="transform transition-transform group-hover:-translate-x-2" />
                    </div>
                </Link>
            </motion.div>
        </div>
    );
};

export default EmployeeDashboardPage;
