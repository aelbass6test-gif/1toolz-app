import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Order, User, ConfirmationLog, AuditLog, OrderStatus, Settings, OrderItem, Product, Store } from '../types';
import { PhoneForwarded, Check, CheckCircle, X, User as UserIcon, MapPin, Package, CalendarDays, Phone, PhoneCall, MessageSquare, Edit3, Save, Plus, Clock, ChevronsUpDown, ArrowRight, Truck, Tag, XCircle, Eye, Search, RefreshCw, History as HistoryIcon, TrendingUp, AlertTriangle, Bell, Send, FileText, Filter, Lock, Unlock, Trophy, Medal, MessageCircle, ListChecks, Users, ArrowRightLeft } from 'lucide-react';
import EditableField from './EditableField';

const QUICK_WA_TEMPLATES = [
    { id: 'no_answer', label: 'لم يتم الرد', text: 'حاولنا الاتصال بك لتأكيد طلبك ولم نتمكن من الوصول إليك. برجاء إبلاغنا بالوقت المناسب للاتصال.' },
    { id: 'location', label: 'طلب اللوكيشن', text: 'برجاء إرسال الموقع (Location) على الواتساب لتسهيل وصول المندوب إليك.' },
    { id: 'address', label: 'تأكيد العنوان', text: 'برجاء تأكيد عنوانك بالتفصيل (رقم العمارة، الشقة، علامة مميزة).' }
];

const CONFIRMATION_ACTIONS = [
    'تم التأكيد',
    'العميل لم يرد',
    'رقم خاطئ',
    'تم الإلغاء',
    'مؤجل',
    'يحتاج متابعة'
];

const CANCELLATION_REASONS = [
    'سعر المنتج مرتفع',
    'مصاريف الشحن مرتفعة',
    'العميل طلب بالخطأ',
    'غير جدي / لا يرد',
    'وقت التوصيل طويل',
    'وجد بديل أرخص',
    'تغيير الرأي',
    'أخرى'
];

const REMINDER_OPTIONS = [
    { value: 1, label: 'بعد ساعة' },
    { value: 3, label: 'بعد 3 ساعات' },
    { value: 24, label: 'غداً' },
    { value: 48, label: 'بعد يومين' },
];

const QUICK_NOTES = [
    'العميل طلب المعاينة قبل الاستلام',
    'التسليم بعد الساعة 4 عصراً',
    'تغيير المقاس لـ XL',
    'تغيير المقاس لـ L',
    'تغيير المقاس لـ M',
    'العميل مسافر وسيستلم الأسبوع القادم',
    'يرجى الاتصال قبل الوصول بنصف ساعة',
];

const CALL_STATUS_ACTIONS = [
    { label: 'لم يرد', action: 'العميل لم يرد', color: 'bg-amber-500 text-white' },
    { label: 'مشغول', action: 'الخط مشغول', color: 'bg-orange-500 text-white' },
    { label: 'مغلق', action: 'الهاتف مغلق', color: 'bg-red-500 text-white' },
    { label: 'سيعاود الاتصال', action: 'سيعاود الاتصال لاحقاً', color: 'bg-blue-500 text-white' },
];

const SENTIMENT_OPTIONS = [
    { value: 'إيجابي', label: 'إيجابي', color: 'bg-emerald-500 text-white' },
    { value: 'محايد', label: 'محايد', color: 'bg-slate-500 text-white' },
    { value: 'سلبي', label: 'سلبي', color: 'bg-orange-500 text-white' },
    { value: 'غاضب', label: 'غاضب', color: 'bg-red-500 text-white' },
    { value: 'مستعجل', label: 'مستعجل', color: 'bg-purple-500 text-white' },
];

interface ConfirmationQueuePageProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: User | null;
  settings: Settings;
  activeStore?: Store;
  onRefresh?: () => void;
  forceSync?: () => Promise<void>;
}

interface DetailSectionProps {
    title: string;
    children?: React.ReactNode;
}

const DetailSection = ({ title, children }: DetailSectionProps) => (
    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <h4 className="font-bold text-slate-600 dark:text-slate-400 mb-3 text-sm">{title}</h4>
        <div className="space-y-3">{children}</div>
    </div>
);

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="space-y-1">
        <label className="text-xs text-slate-500 flex items-center gap-1">{icon} {label}</label>
        <p className="font-bold text-sm text-slate-800 dark:text-white">{value}</p>
    </div>
);

const timeSince = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return "الآن";
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `منذ ${days} يوم`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `منذ ${months} شهر`;
    
    return `منذ ${Math.floor(months / 12)} سنة`;
};

const formatOrderTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const CustomerHistory = ({ allOrders, customerPhone, currentOrderId }: { allOrders: Order[], customerPhone: string, currentOrderId: string }) => {
    const history = useMemo(() => {
        const customerOrders = allOrders.filter(o => o.customerPhone === customerPhone);
        const duplicates = customerOrders.filter(o => o.id !== currentOrderId && o.status === 'في_انتظار_المكالمة');
        
        const totalOrders = customerOrders.length;
        const successfulOrders = customerOrders.filter(o => ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'].includes(o.status)).length;
        const returnedOrders = customerOrders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)).length;
        const totalSpent = customerOrders.filter(o => ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'].includes(o.status)).reduce((sum, o) => sum + (o.totalAmountOverride ?? (o.productPrice + o.shippingFee - (o.discount || 0))), 0);
        const successRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;
        
        let classification = { text: 'عميل جديد', color: 'blue', icon: <UserIcon size={14}/> };
        if (totalOrders > 1) {
            if (successRate > 80 && totalSpent > 3000) {
                classification = { text: 'عميل مميز', color: 'amber', icon: <TrendingUp size={14}/> };
            } else if (returnedOrders > 1 && successRate < 50) {
                classification = { text: 'عميل مخاطرة', color: 'red', icon: <AlertTriangle size={14}/> };
            } else {
                classification = { text: 'عميل معتاد', color: 'green', icon: <UserIcon size={14}/> };
            }
        }
        
        return { totalOrders, successfulOrders, totalSpent, successRate, classification, duplicates };
    }, [allOrders, customerPhone, currentOrderId]);

    const colors = {
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };

    return (
        <div className="space-y-4">
            {history.duplicates.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400"
                >
                    <AlertTriangle size={24} className="flex-shrink-0" />
                    <div>
                        <p className="font-bold text-sm">تنبيه: طلب مكرر!</p>
                        <p className="text-xs opacity-80">هذا العميل لديه {history.duplicates.length} طلبات أخرى بانتظار التأكيد.</p>
                    </div>
                </motion.div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                 <div className="flex justify-between items-center mb-3">
                     <h4 className="font-bold text-slate-600 dark:text-slate-400 text-sm flex items-center gap-2"><HistoryIcon size={16}/> تاريخ العميل</h4>
                     <span className={`px-2 py-1 text-xs font-bold rounded-full flex items-center gap-1 ${colors[history.classification.color as keyof typeof colors]}`}>
                         {history.classification.icon} {history.classification.text}
                     </span>
                 </div>
                 <div className="grid grid-cols-3 gap-2 text-center">
                     <div className="bg-white dark:bg-slate-700/50 p-2 rounded">
                         <p className="text-xs text-slate-500">إجمالي الطلبات</p>
                         <p className="font-black text-lg text-slate-800 dark:text-white">{history.totalOrders}</p>
                     </div>
                     <div className="bg-white dark:bg-slate-700/50 p-2 rounded">
                         <p className="text-xs text-slate-500">نسبة النجاح</p>
                         <p className={`font-black text-lg ${history.successRate > 75 ? 'text-emerald-500' : 'text-amber-500'}`}>{history.successRate.toFixed(0)}%</p>
                     </div>
                     <div className="bg-white dark:bg-slate-700/50 p-2 rounded">
                         <p className="text-xs text-slate-500">إجمالي ما أنفقه</p>
                         <p className="font-black text-lg text-slate-800 dark:text-white">{history.totalSpent.toLocaleString()}</p>
                     </div>
                 </div>
            </div>
        </div>
    );
};

const EmployeePerformance = ({ orders, currentUser, setNotification }: { orders: Order[], currentUser: User | null, setNotification: (n: string | null) => void }) => {
    const stats = useMemo(() => {
        if (!currentUser) return { confirmed: 0, canceled: 0, total: 0, rank: 0, totalEmployees: 0 };
        const today = new Date().toISOString().split('T')[0];
        
        // Calculate stats for all employees
        const employeeStats: Record<string, { confirmed: number, canceled: number, total: number }> = {};
        
        orders.forEach(order => {
            const logs = order.confirmationLogs || [];
            logs.forEach(log => {
                if (log.timestamp.startsWith(today)) {
                    if (!employeeStats[log.userId]) {
                        employeeStats[log.userId] = { confirmed: 0, canceled: 0, total: 0 };
                    }
                    if (log.action === 'تم التأكيد') employeeStats[log.userId].confirmed++;
                    if (log.action === 'تم الإلغاء') employeeStats[log.userId].canceled++;
                    employeeStats[log.userId].total++;
                }
            });
        });

        // Sort employees by confirmed orders
        const sortedEmployees = Object.entries(employeeStats).sort((a, b) => b[1].confirmed - a[1].confirmed);
        const myRank = sortedEmployees.findIndex(([id]) => id === currentUser.phone) + 1;
        
        const myStats = employeeStats[currentUser.phone] || { confirmed: 0, canceled: 0, total: 0 };
        
        return { 
            ...myStats, 
            rank: myRank > 0 ? myRank : (sortedEmployees.length + 1),
            totalEmployees: Math.max(sortedEmployees.length, 1)
        };
    }, [orders, currentUser]);

    const prevRank = useRef<number | null>(null);
    useEffect(() => {
        if (prevRank.current && stats.rank < prevRank.current && stats.rank > 0) {
            setNotification(`تهانينا! لقد صعدت للمركز ${stats.rank} 🚀`);
        }
        prevRank.current = stats.rank;
    }, [stats.rank, setNotification]);

    return (
        <div className="bg-indigo-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 opacity-10 text-white rotate-12">
                <Trophy size={120} />
            </div>
            <div className="relative z-10 w-full sm:w-auto">
                <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xs sm:text-sm font-bold text-indigo-100 uppercase tracking-wider">إنجازك اليوم</h4>
                    {stats.rank === 1 && stats.confirmed > 0 && (
                        <span className="bg-yellow-400 text-yellow-900 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <Medal size={10} /> المركز الأول
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                        <CheckCircle size={16} className="text-emerald-400" />
                        <span className="font-black text-white text-sm sm:text-base">{stats.confirmed} مؤكد</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                        <XCircle size={16} className="text-rose-400" />
                        <span className="font-black text-white text-sm sm:text-base">{stats.canceled} ملغي</span>
                    </div>
                </div>
            </div>
            <div className="text-center sm:text-right relative z-10 border-t sm:border-t-0 sm:border-r border-white/10 pt-4 sm:pt-0 sm:pr-6 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto">
                <div className="flex flex-col sm:mb-1">
                    <p className="text-2xl sm:text-4xl font-black text-white leading-none">{stats.total}</p>
                    <p className="text-[8px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-widest leading-none mt-1">عملية</p>
                </div>
                {stats.rank > 0 && stats.confirmed > 0 && (
                    <div className="text-left sm:text-right">
                        <p className="text-[10px] sm:text-xs text-white font-bold bg-white/20 px-2 py-1 rounded-lg"># {stats.rank} على الفريق</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ConfirmationQueuePage: React.FC<ConfirmationQueuePageProps> = ({ orders, setOrders, currentUser, settings, activeStore, onRefresh, forceSync }) => {
    const [activeOrder, setActiveOrder] = useState<Order | null>(null);
    const [showDashboard, setShowDashboard] = useState(false);
    const [callStartTime, setCallStartTime] = useState<number | null>(null);
    const [callDuration, setCallDuration] = useState<number>(0);
    const [autoDialer, setAutoDialer] = useState(false);
    const [sentiment, setSentiment] = useState<'إيجابي' | 'محايد' | 'سلبي' | 'غاضب' | 'مستعجل'>('محايد');
    const [isScriptsOpen, setIsScriptsOpen] = useState(false);
    const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
    const [addressVerified, setAddressVerified] = useState<boolean | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const prevOrdersCount = useRef(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferTo, setTransferTo] = useState('');

    const [isEditingWaybill, setIsEditingWaybill] = useState(false);
    const [editedWaybill, setEditedWaybill] = useState('');
    const [isEditingTotalOverride, setIsEditingTotalOverride] = useState(false);
    const [editedTotalOverride, setEditedTotalOverride] = useState<number | ''>('');
    const [editedTotalOverrideReason, setEditedTotalOverrideReason] = useState('');

    const truncateString = (str: string, num: number) => {
        if (!str) return '';
        if (str.length <= num) return str;
        return str.slice(0, num) + '...';
    };

    const isReadOnly = useMemo(() => {
        if (!activeOrder) return false;
        if (currentUser?.isAdmin) return false;
        
        const isStoreOwner = currentUser?.stores?.some(s => s.id === activeStore?.id);
        
        // Read only if from synced source (per user request)
        if (activeOrder.source === 'synced' || activeOrder.platform === 'wuilt') return true;
        
        // Read only if cancelled or returned
        if (activeOrder.status === 'ملغي' || activeOrder.status === 'مرتجع' || activeOrder.status === 'مرتجع_جزئي' || activeOrder.status === 'فشل_التوصيل' || activeOrder.status === 'تمت_الاعادة_لشركة_الشحن') return true;
        // Read only if assigned to someone else and not me
        if (activeOrder.assignedTo && activeOrder.assignedTo !== currentUser?.phone && !isStoreOwner) return true;
        
        // Read only if status is 'جاري_المراجعة' and user is not the store owner
        if (activeOrder.status === 'جاري_المراجعة' && !isStoreOwner) return true;
        
        return false;
    }, [activeOrder, currentUser, activeStore]);

    const showNotification = (title: string, body: string) => {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            new Notification(title, { body, icon: '/favicon.ico' });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(title, { body, icon: '/favicon.ico' });
                }
            });
        }
    };

    const prevMyOrdersCount = useRef(0);
    const isFirstRender = useRef(true);

    useEffect(() => {
        const initAudio = () => {
            if (!audioRef.current) {
                audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audioRef.current.load();
                // Play and immediately pause to unlock audio context on iOS
                audioRef.current.play().then(() => {
                    if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.currentTime = 0;
                    }
                }).catch(() => {});
            }
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchstart', initAudio);
        };
        
        document.addEventListener('click', initAudio);
        document.addEventListener('touchstart', initAudio);
        
        return () => {
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchstart', initAudio);
        };
    }, []);

    useEffect(() => {
        const pendingCount = orders.filter(o => o.status === 'في_انتظار_المكالمة').length;
        const myPendingCount = orders.filter(o => o.status === 'في_انتظار_المكالمة' && o.assignedTo === currentUser?.phone).length;
        const isStoreOwner = currentUser?.stores?.some(s => s.id === activeStore?.id) || currentUser?.isAdmin;
        
        if (!isFirstRender.current) {
            if (myPendingCount > prevMyOrdersCount.current) {
                // Play sound for new orders assigned to me
                if (!audioRef.current) {
                    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                }
                audioRef.current.play().catch(e => console.error("Error playing sound:", e));
                showNotification("طلب جديد!", `تم تعيين طلب جديد لك. لديك ${myPendingCount} طلبات في الانتظار`);
                
                // Vibrate on mobile
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            } else if (pendingCount > prevOrdersCount.current) {
                // Notify for any new order
                if (!audioRef.current) {
                    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                }
                audioRef.current.play().catch(e => console.error("Error playing sound:", e));
                showNotification("طلب جديد!", `هناك ${pendingCount} طلب في انتظار التأكيد`);
                
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            }
        }

        prevOrdersCount.current = pendingCount;
        prevMyOrdersCount.current = myPendingCount;
        isFirstRender.current = false;
    }, [orders, currentUser, activeStore]);

    const [autoDistribute, setAutoDistribute] = useState(true);

    useEffect(() => {
        if (!autoDistribute) return;
        
        const unassignedOrders = orders.filter(o => !o.assignedTo && o.status === 'في_انتظار_المكالمة');
        const activeEmployees = settings.employees?.filter(e => e.status === 'active') || [];
        
        if (unassignedOrders.length > 0 && activeEmployees.length > 0) {
            setOrders(currentOrders => {
                const updated = [...currentOrders];
                let empIdx = 0;
                let hasChanges = false;

                unassignedOrders.forEach(order => {
                    const emp = activeEmployees[empIdx];
                    const idx = updated.findIndex(o => o.id === order.id);
                    if (idx !== -1 && !updated[idx].assignedTo) {
                        updated[idx] = {
                            ...updated[idx],
                            assignedTo: emp.phone || emp.id,
                            assignedToName: emp.name
                        };
                        hasChanges = true;
                    }
                    empIdx = (empIdx + 1) % activeEmployees.length;
                });

                return hasChanges ? updated : currentOrders;
            });
        }
    }, [orders.length, settings.employees, autoDistribute]);

    const [actionNotes, setActionNotes] = useState('');
    const [selectedAction, setSelectedAction] = useState(CONFIRMATION_ACTIONS[0]);
    const [cancellationReason, setCancellationReason] = useState('');
    const [reminderTime, setReminderTime] = useState<number | ''>('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [editedAddress, setEditedAddress] = useState('');
    const [editedGovernorate, setEditedGovernorate] = useState('');
    const [editedCity, setEditedCity] = useState('');
    const [isEditingPhone2, setIsEditingPhone2] = useState(false);
    const [editedPhone2, setEditedPhone2] = useState('');
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [editedNotes, setEditedNotes] = useState('');
    const [isEditingShippingCompany, setIsEditingShippingCompany] = useState(false);
    const [editedShippingCompany, setEditedShippingCompany] = useState('');
    const [isEditingDiscount, setIsEditingDiscount] = useState(false);
    const [editedDiscount, setEditedDiscount] = useState<number | ''>('');
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [filterGovernorate, setFilterGovernorate] = useState<string>('');
    const [filterShippingCompany, setFilterShippingCompany] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('في_انتظار_المكالمة');
    const [sortBy, setSortBy] = useState<'date_asc' | 'date_desc' | 'price_desc'>('date_asc');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showMyOrdersOnly, setShowMyOrdersOnly] = useState(!currentUser?.isAdmin);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const pendingOrders = useMemo(() => {
        let filtered = orders.filter(o => o.status === 'في_انتظار_المكالمة' || o.status === 'جاري_المراجعة' || o.status === 'ملغي');
        
        if (showMyOrdersOnly && currentUser) {
            filtered = filtered.filter(o => o.assignedTo === currentUser.phone);
        }

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(o => 
                (o.customerName || '').toLowerCase().includes(lowerSearch) ||
                (o.customerPhone || '').includes(searchTerm) ||
                (o.productName || '').toLowerCase().includes(lowerSearch)
            );
        }

        if (filterGovernorate) {
            filtered = filtered.filter(o => o.shippingArea === filterGovernorate);
        }

        if (filterShippingCompany) {
            filtered = filtered.filter(o => o.shippingCompany === filterShippingCompany);
        }

        if (filterStatus) {
            filtered = filtered.filter(o => o.status === filterStatus);
        }

        return filtered.sort((a, b) => {
            if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
            if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
            if (sortBy === 'price_desc') {
                const priceA = a.totalAmountOverride ?? (a.productPrice + a.shippingFee - (a.discount || 0));
                const priceB = b.totalAmountOverride ?? (b.productPrice + b.shippingFee - (b.discount || 0));
                return priceB - priceA;
            }
            return 0;
        });
    }, [orders, searchTerm, filterGovernorate, filterShippingCompany, filterStatus, sortBy, showMyOrdersOnly, currentUser]);

    // Removed auto-assign useEffect as user requested a manual button for this.

    const pendingTransfers = useMemo(() => {
        return orders.filter(o => o.transferTo === currentUser?.phone && o.transferStatus === 'pending');
    }, [orders, currentUser]);

    const handleAcceptTransfer = (orderId: string) => {
        const targetEmployee = settings.employees?.find(e => e.phone === currentUser?.phone || e.phone === currentUser?.phone);
        setOrders(current => current.map(o => 
            o.id === orderId 
                ? { 
                    ...o, 
                    transferStatus: 'accepted',
                    assignedTo: targetEmployee?.phone,
                    assignedToName: targetEmployee?.name,
                    transferTo: undefined,
                    transferFrom: undefined
                  } 
                : o
        ));
    };

    const handleCancelTransfer = (orderId: string) => {
        setOrders(current => current.map(o => 
            o.id === orderId 
                ? { 
                    ...o, 
                    transferStatus: undefined,
                    transferTo: undefined,
                    transferFrom: undefined,
                    assignedTo: currentUser?.phone,
                    assignedToName: currentUser?.fullName
                  } 
                : o
        ));
        setNotification("تم استرجاع الطلب بنجاح");
        setTimeout(() => setNotification(null), 3000);
    };

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (callStartTime) {
            interval = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [callStartTime]);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const upsellProducts = useMemo(() => {
        if (!activeOrder || !settings.products) return [];
        const currentProductIds = (activeOrder.items || []).map(item => item.productId);
        return settings.products.filter(p => !currentProductIds.includes(p.id)).slice(0, 3);
    }, [activeOrder, settings.products]);
    const [whatsappMenuOpen, setWhatsappMenuOpen] = useState(false);



    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const isStoreOwner = currentUser?.stores?.some(s => s.id === activeStore?.id) || currentUser?.isAdmin;
            const availableOrders = pendingOrders.filter(o => isStoreOwner || !o.assignedTo || o.assignedTo === currentUser?.phone);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!activeOrder && availableOrders.length > 0) {
                    handleSelectOrder(availableOrders[0]);
                } else if (activeOrder) {
                    const currentIndex = availableOrders.findIndex(o => o.id === activeOrder.id);
                    if (currentIndex !== -1 && currentIndex < availableOrders.length - 1) {
                        handleSelectOrder(availableOrders[currentIndex + 1]);
                    }
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeOrder) {
                    const currentIndex = availableOrders.findIndex(o => o.id === activeOrder.id);
                    if (currentIndex > 0) {
                        handleSelectOrder(availableOrders[currentIndex - 1]);
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setActiveOrder(null);
                setSelectedOrderIds([]);
            } else if (e.key === 'Enter' && e.ctrlKey && activeOrder) {
                e.preventDefault();
                handleActionSubmit('تم التأكيد');
            } else if (e.key === 'Backspace' && e.ctrlKey && activeOrder) {
                e.preventDefault();
                handleActionSubmit('تم الإلغاء');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeOrder, pendingOrders]);

    useEffect(() => {
        if (activeOrder) {
            const isStillPending = pendingOrders.some(o => o.id === activeOrder.id);
            if (!isStillPending) {
                setActiveOrder(null);
            } else {
                const freshActiveOrderData = pendingOrders.find(o => o.id === activeOrder.id);
                if (freshActiveOrderData) {
                    const updatedFreshData = { ...freshActiveOrderData };
                    if (!updatedFreshData.items || updatedFreshData.items.length === 0) {
                        updatedFreshData.items = activeOrder.items;
                    }
                    if (JSON.stringify(updatedFreshData) !== JSON.stringify(activeOrder)) {
                        setActiveOrder(updatedFreshData);
                    }
                }
            }
        }
    }, [orders, pendingOrders, activeOrder]);
    
    useEffect(() => {
        if (activeOrder) {
            setActionNotes('');
            setSelectedAction(CONFIRMATION_ACTIONS[0]);
            setCancellationReason('');
            setReminderTime('');
            setIsEditingName(false);
            setEditedName(activeOrder.customerName);
            setIsEditingAddress(false);
            setEditedAddress(activeOrder.customerAddress);
            setEditedGovernorate(activeOrder.shippingArea || '');
            setEditedCity(activeOrder.city || '');
            setIsEditingPhone2(false);
            setEditedPhone2(activeOrder.customerPhone2 || '');
            setIsEditingNotes(false);
            setEditedNotes(activeOrder.notes || '');
            setIsEditingShippingCompany(false);
            setEditedShippingCompany(activeOrder.shippingCompany || '');
            setIsEditingDiscount(false);
            setEditedDiscount(activeOrder.discount || 0);
            setIsEditingWaybill(false);
            setEditedWaybill(activeOrder.waybillNumber || '');
            setIsEditingTotalOverride(false);
            setEditedTotalOverride(activeOrder.totalAmountOverride ?? '');
            setEditedTotalOverrideReason(activeOrder.totalAmountOverrideReason || '');
            setCallStartTime(Date.now());
            setCallDuration(0);
        } else {
            setCallStartTime(null);
            setCallDuration(0);
        }
    }, [activeOrder]);

    const getWhatsAppLink = (order: Order, templateId?: string) => {
        let normalizedPhone = (order.customerPhone || '').replace(/\D/g, '');
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '20' + normalizedPhone.substring(1);
        } else if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('0')) {
            normalizedPhone = '20' + normalizedPhone;
        }
        
        const customerName = (order.customerName || '').split(' ')[0];
        const employeeName = currentUser?.fullName || 'مندوب المبيعات';
        const storeName = activeStore?.name || 'متجرنا';
        const productName = order.productName;
    
        const whatsappTemplates = settings.whatsappTemplates || [];
        let message = '';
        if (templateId) {
            const template = whatsappTemplates.find(t => t.id === templateId);
            if (template) {
                message = template.text
                    .replace('[اسم العميل]', customerName)
                    .replace('[اسم المتجر]', storeName)
                    .replace('[اسم المنتج]', productName);
            }
        } else {
             message = `أهلاً بك يا ${customerName} 👋، انا ${employeeName} نتصل بك من ${storeName} لتأكيد ${productName}. للتاكيد ارسل كلمة تاكيد او الغاء لالغاء الشحنه`;
        }

        return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
    };

    const handleCloseOrder = () => {
        if (activeOrder && currentUser) {
            setOrders(current => current.map(o => 
                o.id === activeOrder.id && o.lockedBy === currentUser.phone 
                    ? { ...o, lockedBy: undefined, lockedByName: undefined, lockedAt: undefined } 
                    : o
            ));
            // Trigger immediate sync to release lock
            if (forceSync) forceSync();
        }
        setActiveOrder(null);
    };

    const handleSelectOrder = (order: Order) => {
        if (order.lockedBy && order.lockedBy !== currentUser?.phone) {
            const lockTime = new Date(order.lockedAt || '').getTime();
            // Auto-unlock if locked for more than 15 minutes
            if (Date.now() - lockTime < 15 * 60 * 1000) {
                setNotification(`هذا الطلب مفتوح حالياً بواسطة ${order.lockedByName}`);
                return;
            }
        }

        const isStoreOwner = currentUser?.stores?.some(s => s.id === activeStore?.id) || currentUser?.isAdmin;
        if (order.assignedTo && order.assignedTo !== currentUser?.phone && !isStoreOwner) {
            setNotification(`هذا الطلب مخصص للموظف ${order.assignedToName}`);
            return;
        }

        const orderToActivate = { ...order };
        if (!orderToActivate.assignedTo) {
            orderToActivate.assignedTo = currentUser?.phone;
            orderToActivate.assignedToName = currentUser?.fullName;
            setOrders(prev => prev.map(o => o.id === orderToActivate.id ? orderToActivate : o));
            setNotification("تم إسناد الطلب إليك تلقائياً");
        }
        if (!orderToActivate.items || orderToActivate.items.length === 0) {
            orderToActivate.items = [{
                productId: settings.products?.find(p => p.name === order.productName)?.id || 'legacy-product-id',
                name: order.productName,
                quantity: 1,
                price: order.productPrice,
                cost: order.productCost,
                weight: order.weight,
            }];
        }
        
        // Lock the order and assign if unassigned
        if (currentUser) {
            const isUnassigned = !orderToActivate.assignedTo || orderToActivate.assignedTo === 'غير موزع';
            const updatedOrder = { 
                ...orderToActivate, 
                lockedBy: currentUser.phone, 
                lockedByName: currentUser.fullName, 
                lockedAt: new Date().toISOString(),
                ...(isUnassigned ? {
                    assignedTo: currentUser.phone,
                    assignedToName: currentUser.fullName || currentUser.name || currentUser.phone
                } : {})
            };
            setOrders(current => current.map(o => o.id === order.id ? updatedOrder : o));
            setActiveOrder(updatedOrder);
            // Trigger immediate sync to broadcast lock
            if (forceSync) forceSync();
        } else {
            setActiveOrder(orderToActivate);
        }
    };

    const handleTransferOrder = () => {
        if (!activeOrder || !transferTo || !currentUser) return;
        
        if (transferTo === currentUser.phone) {
            setNotification("لا يمكنك تحويل الطلب لنفسك");
            return;
        }

        const targetEmployee = settings.employees?.find(e => e.phone === transferTo || e.id === transferTo);
        if (!targetEmployee) return;

        const now = new Date().toISOString();
        const newLog: AuditLog = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: now,
            userId: currentUser.phone,
            userName: currentUser.fullName,
            action: 'transfer',
            details: `تم تحويل الطلب إلى ${targetEmployee.name}`,
            field: 'assignedTo',
            oldValue: activeOrder.assignedTo || 'غير محدد',
            newValue: targetEmployee.phone || targetEmployee.id
        };

        setOrders(current => current.map(o => 
            o.id === activeOrder.id 
                ? { 
                    ...o, 
                    transferStatus: 'pending',
                    transferTo: targetEmployee.phone || targetEmployee.id,
                    transferFrom: currentUser.phone,
                    lockedBy: undefined,
                    lockedByName: undefined,
                    lockedAt: undefined,
                    auditLogs: [...(o.auditLogs || []), newLog]
                  } 
                : o
        ));

        if (forceSync) forceSync();
        setActiveOrder(null);
        setIsTransferModalOpen(false);
        setTransferTo('');
        setNotification(`تم تحويل الطلب إلى ${targetEmployee.name} بنجاح`);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleActionSubmit = (action: string) => {
        if (!activeOrder || !currentUser || activeOrder.source === 'synced') return;
        
        if ((action === 'تم الإلغاء' || action === 'مؤجل') && !cancellationReason && !actionNotes) {
             alert('يرجى اختيار سبب الإلغاء/التأجيل أو كتابة ملاحظة.');
             return;
        }

        const activeOrderId = activeOrder.id;
        const notes = [
            actionNotes,
            cancellationReason ? `السبب: ${cancellationReason}` : '',
            reminderTime ? `تذكير بعد: ${REMINDER_OPTIONS.find(r => r.value === reminderTime)?.label}` : '',
            `مدة فتح الطلب: ${formatDuration(callDuration)}`
        ].filter(Boolean).join(' | ');

        const newLog: ConfirmationLog = { 
            userId: currentUser.phone, 
            userName: currentUser.fullName, 
            timestamp: new Date().toISOString(), 
            action: action, 
            notes: notes,
            duration: callDuration
        };

        let newStatus: OrderStatus | null = null;
        if (action === 'تم التأكيد') newStatus = 'قيد_التنفيذ';
        else if (action === 'تم الإلغاء' || action === 'رقم خاطئ') newStatus = 'ملغي';
        else if (['العميل لم يرد', 'مؤجل', 'يحتاج متابعة'].includes(action)) newStatus = 'جاري_المراجعة';
        
        if (newStatus && activeOrder) {
            logAudit(activeOrder.id, 'status', activeOrder.status, newStatus);
        }

        // Calculate reminder date if set
        let reminderDateStr = undefined;
        if (reminderTime) {
            const date = new Date();
            date.setHours(date.getHours() + Number(reminderTime));
            reminderDateStr = date.toISOString();
        }

        setOrders(currentOrders => currentOrders.map(order => 
            order.id === activeOrderId 
            ? { 
                ...order, 
                status: newStatus || order.status, 
                sentiment: sentiment,
                callAttempts: [...(Array.isArray(order.callAttempts) ? order.callAttempts : []), { 
                    id: `call-${Date.now()}`, 
                    userId: currentUser?.email || 'unknown', 
                    userName: currentUser?.fullName || 'unknown', 
                    timestamp: new Date().toISOString(), 
                    status: selectedAction, 
                    notes: actionNotes 
                }],
                confirmationLogs: [...(order.confirmationLogs || []), newLog],
                cancellationReason: cancellationReason || order.cancellationReason,
                followUpReminder: reminderDateStr || order.followUpReminder,
                lockedBy: undefined,
                lockedByName: undefined,
                lockedAt: undefined
              } 
            : order
        ));

        // Reset state for next order
        setActionNotes('');
        setSelectedAction(CONFIRMATION_ACTIONS[0]);
        setCancellationReason('');
        setReminderTime('');
        setCallStartTime(null);
        setCallDuration(0);
        setSentiment('محايد');
        setAddressVerified(null);

        // Auto-dialer logic
        if (autoDialer) {
            const isStoreOwner = currentUser?.stores?.some(s => s.id === activeStore?.id) || currentUser?.isAdmin;
            const availableOrders = pendingOrders.filter(o => o.id !== activeOrderId && (isStoreOwner || !o.assignedTo || o.assignedTo === currentUser?.phone));
            const nextOrder = availableOrders[0];
            if (nextOrder) {
                handleSelectOrder(nextOrder);
            } else {
                setActiveOrder(null);
            }
        } else {
            setActiveOrder(null);
        }
    };

    const logAudit = (orderId: string, field: string, oldValue: any, newValue: any) => {
        if (oldValue === newValue || !currentUser) return;
        const log = {
            id: Math.random().toString(36).substr(2, 9),
            userId: currentUser.phone || '',
            userName: currentUser.fullName || '',
            field,
            oldValue: String(oldValue),
            newValue: String(newValue),
            timestamp: new Date().toISOString()
        };
        setOrders(current => current.map(o => o.id === orderId ? { ...o, auditLogs: [...(o.auditLogs || []), log] } : o));
    };

    const updateActiveOrderField = (field: keyof Order, value: any) => {
        if (!activeOrder) return;
        logAudit(activeOrder.id, String(field), activeOrder[field], value);
        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, [field]: value } : o)
        );
    };

    const handleSaveName = () => {
        updateActiveOrderField('customerName', editedName);
        setIsEditingName(false);
    };
    const handleSaveAddress = () => {
        if (!activeOrder) return;
        
        let newShippingFee = activeOrder.shippingFee;
        if (editedGovernorate && (editedGovernorate !== activeOrder.shippingArea || editedCity !== activeOrder.city)) {
             const shippingOptions = settings.shippingOptions?.[activeOrder.shippingCompany] || [];
             const selectedOption = shippingOptions.find(opt => opt.label === editedGovernorate);
             if (selectedOption) {
                 const getPriceKey = (type?: string): 'deliveryPrice' | 'exchangePrice' | 'returnPrice' | 'cashCollectionPrice' | 'returnToSenderPrice' => {
                     if (type === 'exchange') return 'exchangePrice';
                     if (type === 'return') return 'returnPrice';
                     if (type === 'cash_collection') return 'cashCollectionPrice';
                     return 'deliveryPrice';
                 };
                 const priceKey = getPriceKey(activeOrder.shipmentType);
                 const cityOption = selectedOption.cities?.find(c => c.name === editedCity);
                 newShippingFee = cityOption && cityOption[priceKey] > 0 ? cityOption[priceKey] : (selectedOption[priceKey] || selectedOption.deliveryPrice || 0);
             }
        }

        logAudit(activeOrder.id, 'customerAddress', activeOrder.customerAddress, editedAddress);
        logAudit(activeOrder.id, 'shippingArea', activeOrder.shippingArea, editedGovernorate);
        logAudit(activeOrder.id, 'city', activeOrder.city, editedCity);

        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, customerAddress: editedAddress, shippingArea: editedGovernorate, city: editedCity, shippingFee: newShippingFee } : o)
        );
        setIsEditingAddress(false);
    };

    const handleSavePhone2 = () => {
        updateActiveOrderField('customerPhone2', editedPhone2);
        setIsEditingPhone2(false);
    };

    const handleSaveNotes = () => {
        updateActiveOrderField('notes', editedNotes);
        setIsEditingNotes(false);
    };

    const handleSaveShippingCompany = () => {
        if (!activeOrder) return;
        
        let newShippingFee = activeOrder.shippingFee;
        const shippingOptions = settings.shippingOptions?.[editedShippingCompany] || [];
        const selectedOption = shippingOptions.find(opt => opt.label === activeOrder.shippingArea);
        if (selectedOption) {
            const getPriceKey = (type?: string): 'deliveryPrice' | 'exchangePrice' | 'returnPrice' | 'cashCollectionPrice' | 'returnToSenderPrice' => {
                if (type === 'exchange') return 'exchangePrice';
                if (type === 'return') return 'returnPrice';
                if (type === 'cash_collection') return 'cashCollectionPrice';
                return 'deliveryPrice';
            };
            const priceKey = getPriceKey(activeOrder.shipmentType);
            const cityOption = selectedOption.cities?.find(c => c.name === activeOrder.city);
            newShippingFee = cityOption && cityOption[priceKey] > 0 ? cityOption[priceKey] : (selectedOption[priceKey] || selectedOption.deliveryPrice || 0);
        }

        logAudit(activeOrder.id, 'shippingCompany', activeOrder.shippingCompany, editedShippingCompany);

        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, shippingCompany: editedShippingCompany, shippingFee: newShippingFee } : o)
        );
        setIsEditingShippingCompany(false);
    };

    const handleSaveDiscount = () => {
        if (!activeOrder) return;
        const discountValue = typeof editedDiscount === 'number' ? editedDiscount : 0;
        logAudit(activeOrder.id, 'discount', activeOrder.discount, discountValue);
        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, discount: discountValue } : o)
        );
        setIsEditingDiscount(false);
    };

    const handleSaveWaybill = () => {
        if (!activeOrder) return;
        logAudit(activeOrder.id, 'waybillNumber', activeOrder.waybillNumber, editedWaybill);
        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, waybillNumber: editedWaybill } : o)
        );
        setIsEditingWaybill(false);
    };

    const handleSaveTotalOverride = () => {
        if (!activeOrder) return;
        const overrideValue = typeof editedTotalOverride === 'number' ? editedTotalOverride : undefined;
        logAudit(activeOrder.id, 'totalAmountOverride', activeOrder.totalAmountOverride, overrideValue);
        logAudit(activeOrder.id, 'totalAmountOverrideReason', activeOrder.totalAmountOverrideReason, editedTotalOverrideReason);
        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? { ...o, totalAmountOverride: overrideValue, totalAmountOverrideReason: editedTotalOverrideReason } : o)
        );
        setIsEditingTotalOverride(false);
    };

    const handleSaveProducts = (newItems: OrderItem[]) => {
        if (!activeOrder) return;

        const totalProductPrice = newItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
        const totalProductCost = newItems.reduce((sum, item) => sum + (item.cost || 0) * (item.quantity || 1), 0);
        const totalWeight = newItems.reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0);
        const productNames = newItems.map(item => item.name).join(', ');

        logAudit(activeOrder.id, 'items', JSON.stringify(activeOrder.items), JSON.stringify(newItems));

        const updatedOrder: Order = {
            ...activeOrder,
            items: newItems,
            productName: productNames,
            productPrice: totalProductPrice,
            productCost: totalProductCost,
            weight: totalWeight,
        };

        setOrders(currentOrders => 
            currentOrders.map(o => o.id === activeOrder.id ? updatedOrder : o)
        );
        setIsProductModalOpen(false);
    };
    
    const { productsTotal, totalAmount, inspectionFeeValue } = useMemo(() => {
        if (!activeOrder) return { productsTotal: 0, totalAmount: 0, inspectionFeeValue: 0 };
        const productsTotal = (activeOrder.items || []).reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
        
        // Calculate shipping fee based on city if available
        let shippingFee = activeOrder.shippingFee;
        const shippingOptions = settings.shippingOptions?.[activeOrder.shippingCompany] || [];
        const selectedOption = shippingOptions.find(opt => opt.label === activeOrder.shippingArea);
        if (selectedOption) {
            const getPriceKey = (type?: string): 'deliveryPrice' | 'exchangePrice' | 'returnPrice' | 'cashCollectionPrice' | 'returnToSenderPrice' => {
                if (type === 'exchange') return 'exchangePrice';
                if (type === 'return') return 'returnPrice';
                if (type === 'cash_collection') return 'cashCollectionPrice';
                return 'deliveryPrice';
            };
            const priceKey = getPriceKey(activeOrder.shipmentType);
            const cityOption = selectedOption.cities?.find(c => c.name === activeOrder.city);
            if (cityOption && cityOption[priceKey] > 0) {
                shippingFee = cityOption[priceKey];
            } else if (selectedOption[priceKey] > 0) {
                shippingFee = selectedOption[priceKey];
            }
        }

        const compFees = settings.companySpecificFees?.[activeOrder.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const inspectionFee = activeOrder.includeInspectionFee ? (useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
        const totalAmount = productsTotal + shippingFee - (activeOrder.discount || 0) + inspectionFee;
        return { productsTotal, totalAmount, inspectionFeeValue: inspectionFee };
    }, [activeOrder, settings]);
    
    const handleRefresh = () => {
        setIsRefreshing(true);
        if (onRefresh) onRefresh();
        // Data is live, this is for UX feedback
        setTimeout(() => setIsRefreshing(false), 750);
    };

    const activeShippingOptions = useMemo(() => {
        if (!activeOrder) return [];
        return settings.shippingOptions?.[activeOrder.shippingCompany] || [];
    }, [activeOrder, settings.shippingOptions]);

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Top Stats Bar / Dashboard Integration */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto no-scrollbar shrink-0 rounded-b-2xl shadow-sm z-10">
                <div className="flex items-center gap-3 sm:gap-4 min-w-max">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <ListChecks size={16} />
                        </div>
                        <div>
                            <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase leading-none">قيد التأكيد</p>
                            <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-white leading-none mt-0.5">{pendingOrders.length}</p>
                        </div>
                    </div>
                    <div className="h-6 sm:h-8 w-[1px] bg-slate-200 dark:bg-slate-800" />
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <TrendingUp size={16} />
                        </div>
                        <div>
                            <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase leading-none">معدل التأكيد</p>
                            <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-white leading-none mt-0.5">
                                {orders.length > 0 ? ((orders.filter(o => o.status === 'جاري_المراجعة').length / orders.length) * 100).toFixed(0) : 0}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
                    <button 
                        onClick={() => setShowDashboard(!showDashboard)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                            showDashboard 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <Trophy size={13} />
                        <span className="sm:inline">لوحة الإنجازات</span>
                    </button>
                    <button 
                        onClick={handleRefresh}
                        className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all"
                        title="تحديث القائمة"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {showDashboard && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="px-4 pt-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0"
                >
                    <EmployeePerformance orders={orders} currentUser={currentUser} setNotification={(msg) => console.log(msg)} />
                </motion.div>
            )}

            <div className="flex flex-1 overflow-hidden relative">
                {notification && (
                    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-3 rounded-full shadow-lg font-bold animate-in fade-in slide-in-from-top-4">
                        {notification}
                    </div>
                )}

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden min-h-0">
                <div className={`w-full md:w-1/3 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full transition-all duration-300 ${activeOrder ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                        <h2 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white whitespace-nowrap">الطلبات ({pendingOrders.length})</h2>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="بحث..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl border-transparent focus:ring-2 focus:ring-primary/20 outline-none pr-9 pl-3 py-1.5 text-xs sm:text-sm"
                                />
                            </div>
                            <div className="relative">
                                <button 
                                    onClick={() => setIsFilterOpen(!isFilterOpen)} 
                                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${isFilterOpen || filterGovernorate || filterShippingCompany ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    title="تصفية وفرز"
                                >
                                    <Filter size={18} />
                                </button>
                                {isFilterOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50">
                                        <h4 className="font-bold text-sm mb-3">تصفية وفرز</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={autoDistribute}
                                                        onChange={(e) => setAutoDistribute(e.target.checked)}
                                                        className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                                    />
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">توزيع تلقائي للطلبات</span>
                                                </label>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">ترتيب حسب</label>
                                                <select 
                                                    value={sortBy} 
                                                    onChange={(e) => setSortBy(e.target.value as any)}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                                                >
                                                    <option value="date_asc">الأقدم أولاً</option>
                                                    <option value="date_desc">الأحدث أولاً</option>
                                                    <option value="price_desc">الأعلى قيمة</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">المحافظة</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="اسم المحافظة..."
                                                    value={filterGovernorate}
                                                    onChange={(e) => setFilterGovernorate(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">شركة الشحن</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="اسم الشركة..."
                                                    value={filterShippingCompany}
                                                    onChange={(e) => setFilterShippingCompany(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                                                />
                                            </div>
                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                                <button 
                                                    onClick={() => { setFilterGovernorate(''); setFilterShippingCompany(''); setSortBy('date_asc'); }}
                                                    className="text-xs text-red-500 hover:text-red-600 font-bold"
                                                >
                                                    إعادة ضبط
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => setIsSelectionMode(!isSelectionMode)} 
                                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${isSelectionMode ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                title="تحديد متعدد"
                            >
                                <ListChecks size={18} />
                                <span className="hidden sm:inline">{isSelectionMode ? 'إلغاء التحديد' : 'تحديد'}</span>
                            </button>
                            <button 
                                onClick={() => setAutoDialer(!autoDialer)} 
                                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${autoDialer ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                title="وضع الاتصال التلقائي"
                            >
                                <PhoneCall size={18} />
                                <span className="hidden sm:inline">تلقائي</span>
                            </button>
                            <button 
                                onClick={() => setIsScriptsOpen(true)} 
                                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                                title="سكريبتات الرد"
                            >
                                <FileText size={18} />
                                <span className="hidden sm:inline">سكريبت</span>
                            </button>
                        </div>
                    </div>
                    
                    {/* Pending Transfers */}
                    {pendingTransfers.length > 0 && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 m-2">
                            <h3 className="font-bold text-indigo-800 dark:text-indigo-200 mb-3">طلبات محولة إليك:</h3>
                            <div className="space-y-2">
                                {pendingTransfers.map(order => {
                                    const sender = settings.employees?.find(e => e.phone === order.transferFrom);
                                    return (
                                        <div key={order.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">طلب #{order.orderNumber || order.id.slice(0, 4)}</span>
                                                <span className="text-xs text-slate-500">محول من: {sender?.name || order.transferFrom}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAcceptTransfer(order.id)} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-700">قبول</button>
                                                <button onClick={() => handleCancelTransfer(order.id)} className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-700">رفض</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {/* Filters */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-full m-2">
                        <button 
                            onClick={() => setShowMyOrdersOnly(false)}
                            className={`flex-1 py-2 text-sm font-bold text-center rounded-md transition-all ${!showMyOrdersOnly ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            كل الطلبات
                        </button>
                        <button 
                            onClick={() => setShowMyOrdersOnly(true)}
                            className={`flex-1 py-2 text-sm font-bold text-center rounded-md transition-all ${showMyOrdersOnly ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            طلباتي فقط
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                        {[{value: 'في_انتظار_المكالمة', label: 'في انتظار المكالمة'}, {value: 'جاري_المراجعة', label: 'جاري المراجعة'}, {value: 'ملغي', label: 'ملغي'}].map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setFilterStatus(tab.value)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                                    filterStatus === tab.value 
                                        ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {pendingOrders.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                            <Check size={48} className="mb-4 opacity-50"/>
                            <p className="font-bold">{searchTerm ? `لا توجد نتائج بحث لـ "${searchTerm}"` : "لا توجد طلبات في انتظار التأكيد."}</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto relative">
                            {/* Removed redundant EmployeePerformance from list */}
                            
                            {/* Bulk Actions Bar */}
                            {selectedOrderIds.length > 0 && (
                                <div className="sticky top-0 z-10 bg-indigo-50 dark:bg-indigo-900/40 border-b border-indigo-100 dark:border-indigo-800 p-3 flex items-center justify-between">
                                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                                        تم تحديد {selectedOrderIds.length} طلب
                                    </span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                if (window.confirm(`هل أنت متأكد من تأكيد ${selectedOrderIds.length} طلب؟`)) {
                                                    const now = new Date().toISOString();
                                                    setOrders(current => current.map(o => {
                                                        if (selectedOrderIds.includes(o.id)) {
                                                            const newLog: AuditLog = {
                                                                id: Math.random().toString(36).substr(2, 9),
                                                                timestamp: now,
                                                                userId: currentUser?.phone || 'unknown',
                                                                userName: currentUser?.name || 'مستخدم غير معروف',
                                                                field: 'status',
                                                                oldValue: o.status,
                                                                newValue: 'جاري_المراجعة'
                                                            };
                                                            return { 
                                                                ...o, 
                                                                status: 'جاري_المراجعة',
                                                                auditLogs: [...(o.auditLogs || []), newLog]
                                                            };
                                                        }
                                                        return o;
                                                    }));
                                                    setSelectedOrderIds([]);
                                                }
                                            }}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            تأكيد الكل
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (window.confirm(`هل أنت متأكد من حذف ${selectedOrderIds.length} طلب نهائياً؟`)) {
                                                    setOrders(current => current.filter(o => !selectedOrderIds.includes(o.id)));
                                                    setSelectedOrderIds([]);
                                                    setNotification("تم حذف الطلبات بنجاح");
                                                }
                                            }}
                                            className="bg-slate-500 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            حذف الكل
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Select All Checkbox */}
                            {isSelectionMode && (
                                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/20">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedOrderIds.length === pendingOrders.length && pendingOrders.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedOrderIds(pendingOrders.map(o => o.id));
                                            } else {
                                                setSelectedOrderIds([]);
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs text-slate-500 font-bold">تحديد الكل</span>
                                </div>
                            )}

                            {pendingOrders.map(order => {
                                const orderAgeHours = (new Date().getTime() - new Date(order.date).getTime()) / (1000 * 60 * 60);
                                const isHighPriority = orderAgeHours > 2;
                                const isSelected = selectedOrderIds.includes(order.id);
                                const isStoreOwner = currentUser?.stores?.some(s => s.id === activeStore?.id) || currentUser?.isAdmin;
                                const isPendingTransfer = order.transferStatus === 'pending' && order.transferFrom === currentUser?.phone;
                                const isAssignedToOther = (order.assignedTo && order.assignedTo !== currentUser?.phone && !isStoreOwner) || isPendingTransfer;
                                
                                return (
                                    <div 
                                        key={order.id} 
                                        className={`w-full text-right flex items-stretch transition-colors border-b border-slate-100 dark:border-slate-800 relative ${activeOrder?.id === order.id ? 'bg-cyan-50 dark:bg-cyan-900/30' : isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} ${isAssignedToOther ? 'opacity-50 grayscale cursor-not-allowed bg-slate-100 dark:bg-slate-900' : ''}`}
                                    >
                                        {isHighPriority && !isAssignedToOther && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" title="طلب قديم - أولوية عالية" />
                                        )}
                                        {isSelectionMode && (
                                            <div className="p-4 pr-4 flex items-center justify-center border-l border-slate-100 dark:border-slate-800/50">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedOrderIds(prev => [...prev, order.id]);
                                                        } else {
                                                            setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                />
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => handleSelectOrder(order)} 
                                            className="flex-1 p-4 pl-4 text-right relative"
                                            disabled={isAssignedToOther}
                                        >
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                                                    {order.customerName}
                                                    {(order.lockedBy && order.lockedBy !== currentUser?.phone) || order.source === 'synced' ? (
                                                        <span title={order.source === 'synced' ? "طلب متزامن - للقراءة فقط" : "يتم إدارته من قِبل موظف آخر"}>
                                                            <Lock size={12} className={order.source === 'synced' ? "text-indigo-500" : "text-red-500"} />
                                                        </span>
                                                    ) : null}
                                                    {order.status === 'في_انتظار_المكالمة' && (
                                                        <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                                            جديد
                                                        </span>
                                                    )}
                                                    {isPendingTransfer && (
                                                        <span className="bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                                                            معلق (تحويل)
                                                        </span>
                                                    )}
                                                </h4>
                                                <div className="text-left">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase">{formatOrderTime(order.date)}</div>
                                                    <div className={`text-[9px] font-bold mt-1 flex items-center gap-1 justify-end ${isAssignedToOther ? 'text-red-500' : 'text-slate-500'}`}>
                                                        <UserIcon size={10} />
                                                        {order.assignedToName || 'غير موزع'}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                                                {truncateString(order.productName || (order.items && order.items[0]?.name) || '', 25)}
                                            </p>
                                            <div className="flex justify-between items-center mt-2">
                                                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{(order.totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0))).toLocaleString()} ج.م</p>
                                                {Array.isArray(order.callAttempts) && order.callAttempts.length > 0 ? (
                                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                                        {order.callAttempts.length} محاولات
                                                    </span>
                                                ) : null}
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className={`w-full md:w-2/3 flex flex-col h-full transition-all duration-300 ${activeOrder ? 'flex' : 'hidden md:flex'} ${isReadOnly ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                    {activeOrder ? (
                        <>
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-shrink-0">
                                <button onClick={() => setActiveOrder(null)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowRight size={20}/></button>
                                <div className="flex-1 flex items-center justify-between">
                                    <h3 className="font-bold text-slate-800 dark:text-white">تفاصيل الطلب #{activeOrder.orderNumber || activeOrder.id.slice(0, 4)}</h3>
                                    <div className="flex items-center gap-2">
                                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${activeOrder.assignedTo ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                            <UserIcon size={12} />
                                            {activeOrder.assignedToName || 'غير موزع'}
                                        </div>
                                        {!isReadOnly && (
                                            <button 
                                                onClick={() => setIsTransferModalOpen(true)}
                                                className="flex items-center gap-1 bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-indigo-200 transition-colors"
                                            >
                                                <ArrowRightLeft size={14} />
                                                تحويل الطلب
                                            </button>
                                        )}
                                        {activeOrder.transferStatus === 'pending' && activeOrder.transferFrom === currentUser?.phone && (
                                            <button 
                                                onClick={() => handleCancelTransfer(activeOrder.id)}
                                                className="flex items-center gap-1 bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-amber-200 transition-colors"
                                            >
                                                <X size={14} />
                                                إلغاء التحويل
                                            </button>
                                        )}
                                        <div className="flex items-center gap-2 text-sm font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                            <PhoneCall size={14} className={callDuration > 0 ? "animate-pulse text-emerald-500" : ""} />
                                            {formatDuration(callDuration)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 p-6 space-y-6 overflow-y-auto md:pb-6 pb-28">
                                <CustomerHistory allOrders={orders} customerPhone={activeOrder.customerPhone} currentOrderId={activeOrder.id} />
                                
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 p-4 rounded-xl">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 text-sm flex items-center gap-2"><PhoneCall size={16}/> تتبع محاولات الاتصال</h4>
                                        <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                                            المحاولة رقم {(Array.isArray(activeOrder.callAttempts) ? activeOrder.callAttempts.length : 0) + 1}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {CALL_STATUS_ACTIONS.map(status => (
                                            <button
                                                key={status.label}
                                                disabled={isReadOnly}
                                                onClick={() => {
                                                    handleActionSubmit(status.action);
                                                }}
                                                className={`p-2 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 ${status.color} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {status.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <DetailSection title="بيانات العميل">
                                        <EditableField
                                            icon={<UserIcon size={14}/>}
                                            label="الاسم"
                                            isEditing={isEditingName}
                                            disabled={isReadOnly}
                                            onEdit={() => { setIsEditingName(true); setEditedName(activeOrder.customerName); }}
                                            onSave={handleSaveName}
                                            onCancel={() => setIsEditingName(false)}
                                            editComponent={
                                                <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold"/>
                                            }
                                            displayComponent={
                                                <p className="font-bold text-sm text-slate-800 dark:text-white">{activeOrder.customerName}</p>
                                            }
                                        />
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 flex items-center gap-1"><Phone size={14}/> الهاتف</label>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white font-mono tracking-wider">{activeOrder.customerPhone}</p>
                                                    <select 
                                                        onChange={(e) => {
                                                            const text = e.target.value;
                                                            if (text) {
                                                                window.open(`https://wa.me/2${(activeOrder.customerPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                                                            }
                                                        }}
                                                        className="p-1 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg font-bold outline-none"
                                                    >
                                                        <option value="">رسالة جاهزة</option>
                                                        <option value="أهلاً، لقد حاولنا الاتصال بك بخصوص طلبك ولم نتمكن من الوصول إليك.">حاولنا الاتصال</option>
                                                        <option value="برجاء إرسال اللوكيشن الخاص بك لتسهيل عملية التوصيل.">إرسال اللوكيشن</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-2 relative">
                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setWhatsappMenuOpen(!whatsappMenuOpen)}
                                                            className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full hover:bg-emerald-200 transition-colors relative z-10" 
                                                            title="مراسلة عبر واتساب"
                                                        >
                                                            <MessageSquare size={16}/>
                                                        </button>
                                                        {whatsappMenuOpen && (
                                                            <>
                                                                <div className="fixed inset-0 z-40" onClick={() => setWhatsappMenuOpen(false)}></div>
                                                                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                                                                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-900">قوالب سريعة</div>
                                                                    {QUICK_WA_TEMPLATES.map(template => (
                                                                        <a 
                                                                            key={template.id}
                                                                            href={`https://wa.me/${(activeOrder.customerPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(template.text)}`}
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                            className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-right transition-colors"
                                                                            onClick={() => setWhatsappMenuOpen(false)}
                                                                        >
                                                                            {template.label}
                                                                        </a>
                                                                    ))}
                                                                    {(settings.whatsappTemplates && settings.whatsappTemplates.length > 0) && (
                                                                        <>
                                                                            <div className="p-2 border-y border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-900">قوالب المتجر</div>
                                                                            {settings.whatsappTemplates.map(template => (
                                                                                <a 
                                                                                    key={template.id}
                                                                                    href={getWhatsAppLink(activeOrder, template.id)}
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer"
                                                                                    className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-right transition-colors"
                                                                                    onClick={() => setWhatsappMenuOpen(false)}
                                                                                >
                                                                                    {template.label}
                                                                                </a>
                                                                            ))}
                                                                        </>
                                                                    )}
                                                                    <a 
                                                                        href={getWhatsAppLink(activeOrder)}
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="block px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-right font-bold border-t border-slate-100 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-900/10"
                                                                        onClick={() => setWhatsappMenuOpen(false)}
                                                                    >
                                                                        رسالة التأكيد الافتراضية
                                                                    </a>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    
                                                    <a 
                                                        href={`tel:${activeOrder.customerPhone}`} 
                                                        onClick={() => setCallStartTime(Date.now())}
                                                        className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 transition-colors" 
                                                        title="اتصال"
                                                    >
                                                        <PhoneCall size={16}/>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                        <EditableField
                                            icon={<Phone size={14}/>}
                                            label="هاتف إضافي"
                                            isEditing={!isReadOnly && isEditingPhone2}
                                            disabled={isReadOnly}
                                            onEdit={() => { setIsEditingPhone2(true); setEditedPhone2(activeOrder.customerPhone2 || ''); }}
                                            onSave={handleSavePhone2}
                                            onCancel={() => setIsEditingPhone2(false)}
                                            editComponent={
                                                <input type="tel" value={editedPhone2} onChange={e => setEditedPhone2(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold" placeholder="أضف رقم هاتف آخر..."/>
                                            }
                                            displayComponent={
                                                <div className="flex items-center justify-between w-full">
                                                    {activeOrder.customerPhone2 ? (
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white font-mono tracking-wider">{activeOrder.customerPhone2}</p>
                                                    ) : (
                                                        <p className="text-sm text-slate-400 italic">لا يوجد</p>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        {activeOrder.customerPhone2 && (
                                                            <>
                                                                <a href={`https://wa.me/2${(activeOrder.customerPhone2 || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full hover:bg-emerald-200 transition-colors" title="مراسلة عبر واتساب">
                                                                    <MessageSquare size={16}/>
                                                                </a>
                                                                <a 
                                                                    href={`tel:${activeOrder.customerPhone2}`} 
                                                                    onClick={() => setCallStartTime(Date.now())}
                                                                    className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 transition-colors" 
                                                                    title="اتصال"
                                                                >
                                                                    <PhoneCall size={16}/>
                                                                </a>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <EditableField
                                            icon={<MapPin size={14}/>}
                                            label="العنوان"
                                            isEditing={!isReadOnly && isEditingAddress}
                                            disabled={isReadOnly}
                                            onEdit={() => { setIsEditingAddress(true); setEditedAddress(activeOrder.customerAddress); setEditedGovernorate(activeOrder.shippingArea); setEditedCity(activeOrder.city || ''); }}
                                            onSave={handleSaveAddress}
                                            onCancel={() => setIsEditingAddress(false)}
                                            editComponent={
                                                <div className="space-y-2 w-full">
                                                    <select 
                                                        value={editedGovernorate} 
                                                        onChange={e => {
                                                            setEditedGovernorate(e.target.value);
                                                            setEditedCity('');
                                                        }}
                                                        className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold"
                                                    >
                                                        <option value="">اختر المحافظة...</option>
                                                        {activeShippingOptions.map(opt => (
                                                            <option key={opt.id} value={opt.label}>{opt.label} ({opt.deliveryPrice} ج.م)</option>
                                                        ))}
                                                    </select>
                                                    {editedGovernorate && activeShippingOptions.find(opt => opt.label === editedGovernorate)?.cities && activeShippingOptions.find(opt => opt.label === editedGovernorate)!.cities!.length > 0 && (
                                                        <select
                                                            value={editedCity}
                                                            onChange={e => setEditedCity(e.target.value)}
                                                            className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold"
                                                        >
                                                            <option value="">اختر المدينة...</option>
                                                            {activeShippingOptions.find(opt => opt.label === editedGovernorate)?.cities?.map(city => (
                                                                <option key={city.id} value={city.name}>{city.name} {city.deliveryPrice > 0 ? `(${city.deliveryPrice} ج.م)` : ''}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    <input 
                                                        type="text" 
                                                        value={editedAddress} 
                                                        onChange={e => setEditedAddress(e.target.value)} 
                                                        className={`w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold ${editedAddress.length > 0 && editedAddress.length < 10 ? 'border-red-500 border' : ''}`}
                                                        placeholder="العنوان بالتفصيل..."
                                                     />
                                                </div>
                                            }
                                            displayComponent={
                                                <div className="flex items-start justify-between w-full">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white pr-4">{activeOrder.customerAddress}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{activeOrder.shippingArea} {activeOrder.city ? `- ${activeOrder.city}` : ''}</p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <button 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(`${activeOrder.customerAddress}, ${activeOrder.city || ''}, ${activeOrder.shippingArea}`);
                                                                    alert('تم نسخ العنوان');
                                                                }}
                                                                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                                                            >
                                                                <Save size={12}/> نسخ العنوان
                                                            </button>
                                                            <a 
                                                                href={`https://www.google.com/maps/search/${encodeURIComponent(`${activeOrder.customerAddress} ${activeOrder.city || ''} ${activeOrder.shippingArea}`)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[10px] font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1"
                                                            >
                                                                <MapPin size={12}/> خرائط جوجل
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={async () => {
                                                                setIsVerifyingAddress(true);
                                                                // Simulated verification
                                                                await new Promise(r => setTimeout(r, 1500));
                                                                setAddressVerified((activeOrder.customerAddress || '').length > 15);
                                                                setIsVerifyingAddress(false);
                                                            }} 
                                                            disabled={isVerifyingAddress || isReadOnly}
                                                            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold ${addressVerified === true ? 'bg-green-100 text-green-700' : addressVerified === false ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                            title="التحقق من العنوان"
                                                        >
                                                            {isVerifyingAddress ? <RefreshCw size={12} className="animate-spin"/> : addressVerified === true ? <CheckCircle size={12}/> : addressVerified === false ? <AlertTriangle size={12}/> : <MapPin size={12}/>}
                                                            {addressVerified === true ? 'موثق' : addressVerified === false ? 'غير دقيق' : 'تحقق'}
                                                        </button>
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </DetailSection>
                                    <DetailSection title="تفاصيل الطلب">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs text-slate-500 flex items-center gap-1"><Package size={14}/> المنتجات</label>
                                                {!isReadOnly && <button onClick={() => setIsProductModalOpen(true)} className="text-xs font-bold text-blue-600 hover:underline">تعديل</button>}
                                            </div>
                                            <div className="space-y-2">
                                                {(activeOrder.items || []).map(item => {
                                                    const product = settings.products?.find(p => p.id === item.productId);
                                                    const isLowStock = product && product.stockQuantity < 5;
                                                    return (
                                                        <div key={item.productId + (item.variantId || '')} className="flex justify-between items-center bg-slate-100 dark:bg-slate-700/50 p-2 rounded-lg">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{truncateString(item.name, 30)}</p>
                                                                    {isLowStock && (
                                                                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                                            <AlertTriangle size={10}/> مخزون منخفض ({product.stockQuantity})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500">{item.variantDescription || ''}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{item.quantity} x {item.price.toLocaleString()} ج.م</p>
                                                                <p className="font-black text-xs text-indigo-600 dark:text-indigo-400">{(item.quantity * item.price).toLocaleString()} ج.م</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <DetailItem icon={<CalendarDays size={14}/>} label="تاريخ الطلب" value={new Date(activeOrder.date).toLocaleString('ar-EG')} />
                                        <EditableField
                                            icon={<Truck size={14}/>}
                                            label="رقم البوليصة (Waybill)"
                                            isEditing={!isReadOnly && isEditingWaybill}
                                            disabled={isReadOnly}
                                            onEdit={() => { setIsEditingWaybill(true); setEditedWaybill(activeOrder.waybillNumber || ''); }}
                                            onSave={handleSaveWaybill}
                                            onCancel={() => setIsEditingWaybill(false)}
                                            editComponent={
                                                <input type="text" value={editedWaybill} onChange={e => setEditedWaybill(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold" placeholder="أدخل رقم البوليصة..."/>
                                            }
                                            displayComponent={
                                                <div className="flex items-center justify-between w-full">
                                                    {activeOrder.waybillNumber ? (
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white font-mono">{activeOrder.waybillNumber}</p>
                                                    ) : (
                                                        <p className="text-sm text-slate-400 italic">لا يوجد</p>
                                                    )}
                                                </div>
                                            }
                                        />
                                        <EditableField
                                            icon={<Truck size={14}/>}
                                            label="شركة الشحن"
                                            isEditing={!isReadOnly && isEditingShippingCompany}
                                            disabled={isReadOnly}
                                            onEdit={() => { setIsEditingShippingCompany(true); setEditedShippingCompany(activeOrder.shippingCompany); }}
                                            onSave={handleSaveShippingCompany}
                                            onCancel={() => setIsEditingShippingCompany(false)}
                                            editComponent={
                                                <select value={editedShippingCompany} onChange={e => setEditedShippingCompany(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold">
                                                    {Object.keys(settings.shippingOptions || {}).filter(c => settings.activeCompanies?.[c]).map(company => (
                                                        <option key={company} value={company}>{company}</option>
                                                    ))}
                                                </select>
                                            }
                                            displayComponent={
                                                <p className="font-bold text-sm text-slate-800 dark:text-white">{activeOrder.shippingCompany}</p>
                                            }
                                        />
                                        <EditableField
                                            icon={<Edit3 size={14}/>}
                                            label="ملاحظات الطلب"
                                            isEditing={!isReadOnly && isEditingNotes}
                                            disabled={isReadOnly}
                                            onEdit={() => { setIsEditingNotes(true); setEditedNotes(activeOrder.notes || ''); }}
                                            onSave={handleSaveNotes}
                                            onCancel={() => setIsEditingNotes(false)}
                                            editComponent={
                                                <textarea value={editedNotes} onChange={e => setEditedNotes(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold" rows={2}></textarea>
                                            }
                                            displayComponent={
                                                <p className="font-bold text-sm text-slate-800 dark:text-white">{activeOrder.notes || <span className="text-slate-400 italic">لا يوجد ملاحظات</span>}</p>
                                            }
                                        />
                                    </DetailSection>
                                </div>
                                <DetailSection title="الملخص المالي">
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 dark:text-slate-400">إجمالي المنتجات</span>
                                            <span className="font-bold text-slate-800 dark:text-white">{productsTotal.toLocaleString()} ج.م</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 dark:text-slate-400">مصاريف الشحن</span>
                                            <span className="font-bold text-slate-800 dark:text-white">{activeOrder.shippingFee.toLocaleString()} ج.م</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500 dark:text-slate-400">رسوم المعاينة</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-slate-800 dark:text-white">{inspectionFeeValue.toLocaleString()} ج.م</span>
                                                <button
                                                    onClick={() => updateActiveOrderField('includeInspectionFee', !activeOrder.includeInspectionFee)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${activeOrder.includeInspectionFee ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'}`}
                                                >
                                                    {activeOrder.includeInspectionFee ? 'إلغاء' : 'تفعيل'}
                                                </button>
                                            </div>
                                        </div>
                                        <EditableField
                                            icon={<Tag size={14}/>}
                                            label="الخصم"
                                            isEditing={isEditingDiscount}
                                            disabled={isReadOnly}
                                            onEdit={() => { setIsEditingDiscount(true); setEditedDiscount(activeOrder.discount || 0); }}
                                            onSave={handleSaveDiscount}
                                            onCancel={() => setIsEditingDiscount(false)}
                                            editComponent={
                                                <input type="number" value={editedDiscount} onChange={e => setEditedDiscount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-bold" min="0"/>
                                            }
                                            displayComponent={
                                                <span className="font-bold text-red-500">-{activeOrder.discount ? activeOrder.discount.toLocaleString() : 0} ج.م</span>
                                            }
                                        />
                                        <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-700 my-2 !mt-4 !mb-3"></div>
                                        <div className="flex justify-between items-center font-black text-lg">
                                            <span className="text-slate-800 dark:text-white">الإجمالي المطلوب:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-indigo-600 dark:text-indigo-400">{totalAmount.toLocaleString()} ج.م</span>
                                                <button 
                                                    onClick={() => setIsEditingTotalOverride(true)}
                                                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                                    title="تعديل الإجمالي يدوياً"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        {activeOrder.totalAmountOverride !== undefined && (
                                            <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-800/50 mt-1">
                                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">تم تعديل الإجمالي يدوياً</p>
                                                <p className="text-[10px] text-amber-600 dark:text-amber-500 italic">{activeOrder.totalAmountOverrideReason || 'لا يوجد سبب محدد'}</p>
                                                <button 
                                                    onClick={() => updateActiveOrderField('totalAmountOverride', undefined)}
                                                    className="text-[10px] text-red-500 font-bold hover:underline mt-1"
                                                >
                                                    استعادة الإقيمة التلقائية
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </DetailSection>

                                {upsellProducts.length > 0 && (
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl p-4">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-2">
                                            <Package size={16} /> اقتراحات للبيع المتقاطع (Upselling)
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {upsellProducts.map(product => (
                                                <div key={product.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-3">
                                                    {product.thumbnail ? (
                                                        <img src={product.thumbnail} alt={product.name} className="w-12 h-12 rounded-md object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                                            <Package size={20} />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{product.name}</p>
                                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-black">{product.price.toLocaleString()} ج.م</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400 text-sm">انطباع العميل</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {SENTIMENT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setSentiment(opt.value as any)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sentiment === opt.value ? opt.color + ' ring-2 ring-offset-2 ring-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400 text-sm">تسجيل إجراء ومتابعة</h4>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <select 
                                                value={selectedAction} 
                                                onChange={e => setSelectedAction(e.target.value)} 
                                                disabled={isReadOnly}
                                                className={`w-full p-3 pr-4 pl-8 appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {CONFIRMATION_ACTIONS.map(action => <option key={action} value={action}>{action}</option>)}
                                            </select>
                                            <ChevronsUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const text = `أهلاً ${activeOrder.customerName} 👋، نود تأكيد طلبك من ${activeStore?.name || 'متجرنا'}.\n\nالمنتجات: ${(activeOrder.items || []).map(i => i.name).join(', ')}\nالإجمالي: ${totalAmount} ج.م\nالعنوان: ${activeOrder.customerAddress}\n\nهل البيانات صحيحة؟`;
                                                window.open(`https://wa.me/2${(activeOrder.customerPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                                            }}
                                            className="p-3 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg font-bold hover:bg-emerald-200 transition-colors"
                                            title="إرسال ملخص الطلب"
                                        >
                                            <Send size={18}/>
                                        </button>
                                    </div>

                                    {(selectedAction === 'تم الإلغاء' || selectedAction === 'مؤجل') && (
                                        <div className="relative animate-in fade-in slide-in-from-top-2">
                                            <select 
                                                value={cancellationReason} 
                                                onChange={e => setCancellationReason(e.target.value)} 
                                                disabled={isReadOnly}
                                                className={`w-full p-3 pr-4 pl-8 appearance-none bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-red-500 text-red-700 dark:text-red-400 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <option value="">{selectedAction === 'تم الإلغاء' ? 'اختر سبب الإلغاء (إجباري)' : 'اختر سبب التأجيل (إجباري)'}</option>
                                                {CANCELLATION_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                                            </select>
                                            <AlertTriangle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400"/>
                                        </div>
                                    )}

                                    {(selectedAction === 'العميل لم يرد' || selectedAction === 'مؤجل') && (
                                        <div className="relative animate-in fade-in slide-in-from-top-2">
                                            <select 
                                                value={reminderTime} 
                                                onChange={e => setReminderTime(Number(e.target.value))} 
                                                disabled={isReadOnly}
                                                className={`w-full p-3 pr-4 pl-8 appearance-none bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-blue-700 dark:text-blue-400 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <option value="">تذكير بالمتابعة (اختياري)</option>
                                                {REMINDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                            <Bell size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400"/>
                                        </div>
                                    )}

                                    <textarea 
                                        placeholder="إضافة ملاحظات (اختياري)..." 
                                        rows={2} 
                                        value={actionNotes} 
                                        onChange={e => setActionNotes(e.target.value)} 
                                        disabled={isReadOnly}
                                        className={`w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    ></textarea>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {QUICK_NOTES.map(note => (
                                            <button
                                                key={note}
                                                onClick={() => setActionNotes(prev => prev ? `${prev} | ${note}` : note)}
                                                disabled={isReadOnly}
                                                className={`px-2 py-1 bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-400 rounded-full hover:bg-indigo-100 hover:text-indigo-600 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                + {note}
                                            </button>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => handleActionSubmit(selectedAction)} 
                                        disabled={isReadOnly}
                                        className={`w-full p-3 bg-indigo-600/10 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg font-bold hover:bg-indigo-600/20 flex flex-col items-center justify-center gap-1 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-2"><Save size={18}/> حفظ الإجراء</div>
                                        <span className="text-[10px] opacity-70 font-mono">Ctrl + Enter</span>
                                    </button>
                                </div>
                                
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400 mb-3 text-sm flex items-center gap-2"><HistoryIcon size={16}/> سجل المكالمات</h4>
                                    <div className="space-y-3">
                                        {activeOrder.confirmationLogs && activeOrder.confirmationLogs.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto p-1">
                                                {activeOrder.confirmationLogs.slice().reverse().map((log, index) => (
                                                    <div key={log.timestamp + index} className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-xs">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-slate-800 dark:text-white">{log.action}</span>
                                                            <span className="text-slate-500 font-mono">{timeSince(log.timestamp)}</span>
                                                        </div>
                                                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                                                            بواسطة: <span className="font-bold">{log.userName}</span>
                                                        </p>
                                                        {log.notes && (
                                                            <blockquote className="mt-2 p-2 bg-white dark:bg-slate-700 rounded border-r-4 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 italic">
                                                               {log.notes}
                                                            </blockquote>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-center text-slate-400 py-4">لا توجد سجلات سابقة.</p>
                                        )}
                                    </div>
                                </div>

                                {activeOrder.auditLogs && activeOrder.auditLogs.length > 0 && (
                                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-4">
                                        <h4 className="font-bold text-slate-600 dark:text-slate-400 mb-3 text-sm flex items-center gap-2"><HistoryIcon size={16}/> سجل التعديلات</h4>
                                        <div className="space-y-3">
                                            <div className="space-y-2 max-h-40 overflow-y-auto p-1">
                                                {activeOrder.auditLogs.slice().reverse().map((log, index) => (
                                                    <div key={log.timestamp + index} className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-xs">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-slate-800 dark:text-white">تعديل {log.field}</span>
                                                            <span className="text-slate-500 font-mono">{timeSince(log.timestamp)}</span>
                                                        </div>
                                                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                                                            بواسطة: <span className="font-bold">{log.userName}</span>
                                                        </p>
                                                        <div className="mt-2 text-[10px] text-slate-500 flex flex-col gap-1">
                                                            <div className="flex items-center gap-1"><span className="text-red-500 line-through truncate max-w-[150px]">{log.oldValue}</span> <span className="text-slate-400">←</span> <span className="text-emerald-500 font-bold truncate max-w-[150px]">{log.newValue}</span></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

                                <div>
                                    <h4 className="font-bold text-slate-600 dark:text-slate-400 text-sm mb-3">اتخاذ قرار نهائي</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => handleActionSubmit('تم الإلغاء')} disabled={isReadOnly} className={`w-full p-3 bg-red-600/10 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg font-bold hover:bg-red-600/20 flex flex-col items-center justify-center gap-1 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <div className="flex items-center gap-2"><X size={18}/> إلغاء الطلب</div>
                                            <span className="text-[10px] opacity-70 font-mono">Ctrl + Backspace</span>
                                        </button>
                                        <button onClick={() => handleActionSubmit('تم التأكيد')} disabled={isReadOnly} className={`w-full p-3 bg-emerald-600/10 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg font-bold hover:bg-emerald-600/20 flex flex-col items-center justify-center gap-1 transition-colors ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <div className="flex items-center gap-2"><Check size={18}/> تأكيد الطلب</div>
                                            <span className="text-[10px] opacity-70 font-mono">Ctrl + Enter</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 hidden md:flex items-center justify-center text-center text-slate-400 p-8"><div><PhoneForwarded size={64} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" /><h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">ابدأ بتأكيد الطلبات</h3><p className="text-sm mt-2">اختر طلباً من القائمة على اليمين لعرض تفاصيله.</p></div></div>
                    )}
                </div>
            </div>
            {isProductModalOpen && activeOrder && <ProductEditModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProducts} currentItems={activeOrder.items || []} allProducts={settings.products} />}
            {isLogModalOpen && activeOrder && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setIsLogModalOpen(false)}>
                    <motion.div 
                        initial={{ y: "100%" }} 
                        animate={{ y: "0%" }} 
                        exit={{ y: "100%" }} 
                        transition={{ type: "spring", stiffness: 300, damping: 30 }} 
                        className="w-full bg-white dark:bg-slate-900 rounded-t-2xl p-5 shadow-lg border-t border-slate-200 dark:border-slate-800" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4"></div>
                        <h3 className="font-bold text-lg mb-4 text-center text-slate-800 dark:text-white">تسجيل إجراء للمكالمة</h3>
                        <div className="space-y-3">
                            <div className="relative">
                                <select 
                                    value={selectedAction} 
                                    onChange={e => setSelectedAction(e.target.value)} 
                                    className="w-full p-3 pr-4 pl-8 appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {CONFIRMATION_ACTIONS.map(action => <option key={action} value={action}>{action}</option>)}
                                </select>
                                <ChevronsUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            </div>
                            <textarea 
                                placeholder="إضافة ملاحظات (اختياري)..." 
                                rows={3} 
                                value={actionNotes} 
                                onChange={e => setActionNotes(e.target.value)} 
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            ></textarea>
                            <button 
                                onClick={() => { handleActionSubmit(selectedAction); setIsLogModalOpen(false); }} 
                                className="w-full p-4 bg-indigo-600 text-white rounded-lg font-black hover:bg-indigo-700"
                            >
                                حفظ الإجراء
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {isScriptsOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-indigo-600 text-white">
                            <h3 className="font-bold flex items-center gap-2"><FileText size={20}/> سكريبتات الرد المقترحة</h3>
                            <button onClick={() => setIsScriptsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                            {(settings.callScripts || []).map((script, i) => (
                                <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                    <h4 className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{script.title}</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{script.text}</p>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(script.text);
                                            alert('تم نسخ النص بنجاح');
                                        }}
                                        className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                                    >
                                        <Save size={12}/> نسخ النص
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                            <button onClick={() => setIsScriptsOpen(false)} className="w-full p-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold">إغلاق</button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Transfer Order Modal */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <ArrowRightLeft className="text-indigo-600" size={20} />
                                تحويل الطلب لموظف آخر
                            </h3>
                            <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-400">اختر الموظف</label>
                                <select 
                                    value={transferTo}
                                    onChange={(e) => setTransferTo(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">اختر موظف...</option>
                                    {settings.employees?.filter(e => e.phone !== currentUser?.phone).map(emp => (
                                        <option key={emp.id} value={emp.phone || emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800/50 flex gap-3">
                                <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                                <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                                    سيتم نقل الطلب بالكامل للموظف المختار وسيتم تسجيل هذه العملية في سجل التدقيق.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                            <button 
                                onClick={() => setIsTransferModalOpen(false)}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button 
                                onClick={handleTransferOrder}
                                disabled={!transferTo}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                            >
                                تأكيد التحويل
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    </div>
    );
};

interface ProductEditModalProps {
    isOpen: boolean; onClose: () => void; onSave: (items: OrderItem[]) => void;
    currentItems: OrderItem[]; allProducts: Product[];
}
const ProductEditModal: React.FC<ProductEditModalProps> = ({ isOpen, onClose, onSave, currentItems, allProducts }) => {
    const [editedItems, setEditedItems] = useState<OrderItem[]>(currentItems);
    
    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        let newItems = [...editedItems];
        if (field === 'productId') {
            const product = allProducts.find(p => p.id === value);
            if(product) {
                newItems[index] = { 
                    ...newItems[index], 
                    productId: value, 
                    name: product.name, 
                    price: product.price, 
                    cost: product.costPrice, 
                    weight: product.weight, 
                    thumbnail: product.thumbnail,
                    variantId: undefined,
                    variantDescription: undefined
                };
            }
        } else if (field === 'variantId') {
            const product = allProducts.find(p => p.id === newItems[index].productId);
            const variant = product?.variants?.find(v => v.id === value);
            if (variant) {
                newItems[index] = {
                    ...newItems[index],
                    variantId: value,
                    variantDescription: Object.entries(variant.options).map(([k, v]) => `${k}: ${v}`).join(', '),
                    price: variant.price,
                    cost: variant.costPrice,
                    weight: variant.weight
                };
            } else {
                newItems[index] = {
                    ...newItems[index],
                    variantId: undefined,
                    variantDescription: undefined,
                    price: product?.price || 0,
                    cost: product?.costPrice || 0,
                    weight: product?.weight || 0
                };
            }
        } else {
            newItems[index] = { ...newItems[index], [field]: value };
        }
        setEditedItems(newItems);
    };

    const addItem = () => {
        if (allProducts.length === 0) return;
        const firstProduct = allProducts[0];
        setEditedItems([...editedItems, { productId: firstProduct.id, name: firstProduct.name, quantity: 1, price: firstProduct.price, cost: firstProduct.costPrice, weight: firstProduct.weight, thumbnail: firstProduct.thumbnail }]);
    };
    const removeItem = (index: number) => setEditedItems(editedItems.filter((_, i) => i !== index));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-[90vh] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-black dark:text-white flex items-center gap-3"><Package className="text-indigo-500"/> تعديل منتجات الطلب</h3>
                    <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {editedItems.map((item, index) => {
                        const product = allProducts.find(p => p.id === item.productId);
                        const hasVariants = product?.variants && product.variants.length > 0;
                        const selectedVariant = hasVariants ? product.variants?.find(v => v.id === item.variantId) : null;
                        const stock = hasVariants ? (selectedVariant?.stockQuantity || 0) : (product?.stockQuantity || 0);
                        
                        return (
                            <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 border rounded-lg space-y-2 relative">
                                <button onClick={() => removeItem(index)} className="absolute top-2 left-2 text-slate-400 hover:text-red-500"><XCircle size={16}/></button>
                                {product?.thumbnail && <img src={product.thumbnail} alt={product.name} className="w-16 h-16 object-cover rounded-lg" />}
                                <select value={item.productId} onChange={e => updateItem(index, 'productId', e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 rounded text-sm font-bold">{allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                
                                {hasVariants && (
                                    <select value={item.variantId || ''} onChange={e => updateItem(index, 'variantId', e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 rounded text-sm">
                                        <option value="">بدون متغيرات</option>
                                        {product.variants?.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(', ')}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                <div className="flex gap-2 items-center">
                                    <input type="number" placeholder="الكمية" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} className="w-1/3 p-2 bg-white dark:bg-slate-800 rounded font-bold" min="1" />
                                    <input type="number" placeholder="السعر" value={item.price} onChange={e => updateItem(index, 'price', Number(e.target.value))} className="w-1/3 p-2 bg-white dark:bg-slate-800 rounded font-bold" min="0" />
                                    <div className="w-1/3 text-center text-xs font-bold text-slate-500">
                                        المخزون: <span className={stock < item.quantity ? 'text-red-500' : 'text-emerald-500'}>{stock}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <button onClick={addItem} className="w-full mt-3 p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 font-bold rounded-lg text-sm">+ إضافة منتج آخر</button>
                </div>
                <div className="p-6 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center gap-3">
                    <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold border border-slate-200 dark:border-slate-600">إلغاء</button>
                    <button onClick={() => onSave(editedItems)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2"><Save size={16}/> حفظ التغييرات</button>
                </div>
            </div>
        </div>
    );
};


export default ConfirmationQueuePage;

