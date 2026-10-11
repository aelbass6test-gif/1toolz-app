import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { User, Store, StoreData } from '../types';
import { getRoleName } from '../utils/roles';
import { 
  ShieldCheck, 
  LogOut, 
  Settings, 
  Sun, 
  Moon, 
  Monitor, 
  ChevronDown, 
  Check, 
  LayoutDashboard, 
  PhoneForwarded, 
  Download, 
  MessageSquare, 
  History, 
  Volume2, 
  VolumeX, 
  Clock, 
  Headphones, 
  Store as StoreIcon,
  ShoppingCart,
  Coffee,
  Play,
  Square,
  Sparkles,
  FileText,
  FileSpreadsheet,
  X,
  Bell
} from 'lucide-react';
import FloatingChat, { FloatingChatHandles } from './FloatingChat';
import IosInstallPrompt from './IosInstallPrompt';
import { db } from '../services/firebaseClient';
import { doc, setDoc, deleteDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { isSupabaseActive } from '../services/databaseService';

interface EmployeeLayoutProps {
    currentUser: User | null;
    onLogout: () => void;
    children: React.ReactNode;
    storeOwner: User | null;
    activeStoreId: string | null;
    theme: string;
    setTheme: (theme: string) => void;
    allStoresData: Record<string, StoreData>;
    users: User[];
    handleSetActiveStore: (storeId: string) => void;
    installPrompt: any;
    onInstall: () => void;
    isStandalone: boolean;
    isIos: boolean;
}

// Synthesized pleasant notification chime using Web Audio API
export const playNotificationChime = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
        // audio context might be blocked if no user interaction yet
    }
};

export const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ 
    currentUser, 
    onLogout, 
    children, 
    storeOwner, 
    activeStoreId, 
    theme, 
    setTheme, 
    allStoresData, 
    users, 
    handleSetActiveStore, 
    installPrompt, 
    onInstall, 
    isStandalone, 
    isIos 
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
    const [showIosInstallModal, setShowIosInstallModal] = useState(false);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [showScratchpad, setShowScratchpad] = useState(false);
    const [scratchpadText, setScratchpadText] = useState(() => {
        try {
            return localStorage.getItem(`emp_scratchpad_${currentUser?.phone}`) || '';
        } catch {
            return '';
        }
    });
    const [onlineUsers, setOnlineUsers] = useState<Record<string, { lastSeen: number }>>({});
    const userMenuRef = useRef<HTMLDivElement>(null);
    const storeMenuRef = useRef<HTMLDivElement>(null);
    const chatRef = useRef<FloatingChatHandles>(null);

    // Audio Notification Mute state
    const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => {
        try {
            return localStorage.getItem('sound_notifications_muted') === 'true';
        } catch {
            return false;
        }
    });

    const toggleSound = () => {
        const next = !isSoundMuted;
        setIsSoundMuted(next);
        try {
            localStorage.setItem('sound_notifications_muted', String(next));
        } catch {}
        if (!next) {
            playNotificationChime();
        }
    };

    // Shift Attendance & Punch-In/Out Management
    const [shiftStatus, setShiftStatus] = useState<'working' | 'break' | 'stopped'>(() => {
        try {
            const status = localStorage.getItem(`emp_shift_status_${currentUser?.phone}`);
            return (status as any) || 'working';
        } catch {
            return 'working';
        }
    });

    const [shiftSeconds, setShiftSeconds] = useState<number>(() => {
        try {
            const stored = localStorage.getItem(`emp_shift_start_ts_${currentUser?.phone}`);
            if (stored) {
                return Math.max(0, Math.floor((Date.now() - parseInt(stored, 10)) / 1000));
            }
            const now = Date.now();
            localStorage.setItem(`emp_shift_start_ts_${currentUser?.phone}`, String(now));
        } catch {}
        return 0;
    });

    // Timer loop for active shift
    useEffect(() => {
        if (shiftStatus !== 'working') return;
        const timer = setInterval(() => {
            try {
                const start = localStorage.getItem(`emp_shift_start_ts_${currentUser?.phone}`);
                if (start) {
                    setShiftSeconds(Math.max(0, Math.floor((Date.now() - parseInt(start, 10)) / 1000)));
                } else {
                    setShiftSeconds(s => s + 1);
                }
            } catch {
                setShiftSeconds(s => s + 1);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [shiftStatus, currentUser?.phone]);

    const formatShiftTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleShiftAction = (action: 'start' | 'break' | 'resume' | 'end') => {
        const phone = currentUser?.phone;
        const now = Date.now();
        if (action === 'start' || action === 'resume') {
            setShiftStatus('working');
            localStorage.setItem(`emp_shift_status_${phone}`, 'working');
            if (action === 'start') {
                localStorage.setItem(`emp_shift_start_ts_${phone}`, String(now));
                setShiftSeconds(0);
            }
        } else if (action === 'break') {
            setShiftStatus('break');
            localStorage.setItem(`emp_shift_status_${phone}`, 'break');
        } else if (action === 'end') {
            setShiftStatus('stopped');
            localStorage.setItem(`emp_shift_status_${phone}`, 'stopped');
            // Log completed shift to history
            try {
                const historyRaw = localStorage.getItem(`emp_shift_history_${phone}`);
                const history = historyRaw ? JSON.parse(historyRaw) : [];
                history.unshift({
                    date: new Date().toISOString(),
                    durationSeconds: shiftSeconds,
                    storeId: activeStoreId
                });
                localStorage.setItem(`emp_shift_history_${phone}`, JSON.stringify(history.slice(0, 30)));
            } catch {}
        }
        setShowShiftModal(false);
    };

    // Save scratchpad
    const handleScratchpadChange = (text: string) => {
        setScratchpadText(text);
        try {
            localStorage.setItem(`emp_scratchpad_${currentUser?.phone}`, text);
        } catch {}
    };

    // Check permissions for dynamic navigation
    const canManageOrders = Boolean(currentUser?.isAdmin || currentUser?.permissions?.includes('ORDERS_MANAGE') || currentUser?.permissions?.includes('ORDERS_VIEW'));
    const canUsePOS = Boolean(currentUser?.isAdmin || currentUser?.permissions?.includes('POS_VIEW') || currentUser?.permissions?.includes('POS_MANAGE'));

    // Presence Sync in Firestore
    useEffect(() => {
        if (!currentUser || !activeStoreId || isSupabaseActive()) return;

        const presenceDocRef = doc(db, 'presence', `${activeStoreId}_${currentUser.phone}`);

        const updateStatus = async () => {
            try {
                await setDoc(presenceDocRef, {
                    userId: currentUser.phone,
                    userName: currentUser.fullName,
                    storeId: activeStoreId,
                    shiftStatus: shiftStatus,
                    lastSeen: Date.now()
                }, { merge: true });
            } catch (err) {
                console.warn('Failed to update presence status:', err);
            }
        };

        updateStatus();
        const interval = setInterval(updateStatus, 120000); // every 2 mins

        const q = query(collection(db, 'presence'), where('storeId', '==', activeStoreId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersMap: Record<string, { lastSeen: number }> = {};
            const now = Date.now();
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data.lastSeen && (now - data.lastSeen) < 300000) {
                    usersMap[data.userId] = { lastSeen: data.lastSeen };
                }
            });
            setOnlineUsers(usersMap);
        }, (error) => {
            console.warn('[EmployeeLayout] Presence listener notice:', error?.message);
        });

        return () => {
            clearInterval(interval);
            unsubscribe();
            deleteDoc(presenceDocRef).catch(() => {});
        };
    }, [currentUser, activeStoreId, shiftStatus]);

    // Active Stores where employee has access
    const employeeStores = useMemo(() => {
        if (!currentUser) return [];
        const stores: Store[] = [];
        for (const storeId in allStoresData) {
            const storeData = allStoresData[storeId];
            if (storeData.settings?.employees?.some(e => e.id === currentUser.phone && (e.status === 'active' || !e.status))) {
                const owner = users.find(u => u.stores?.some(s => s.id === storeId));
                const storeInfo = owner?.stores?.find(s => s.id === storeId);
                if (storeInfo) {
                    stores.push(storeInfo);
                } else {
                    stores.push({
                        id: storeId,
                        name: storeData.settings?.storeName || storeData.name || storeId,
                        currency: 'ج.م'
                    } as any);
                }
            }
        }
        return stores;
    }, [allStoresData, currentUser, users]);

    const currentStoreName = useMemo(() => {
        return employeeStores.find(s => s.id === activeStoreId)?.name || 
               allStoresData[activeStoreId || '']?.settings?.storeName || 
               allStoresData[activeStoreId || '']?.name || 'المتجر الرئيسي';
    }, [employeeStores, activeStoreId, allStoresData]);

    // Real-time unconfirmed orders count
    const pendingConfirmationCount = useMemo(() => {
        const orders = activeStoreId ? (allStoresData[activeStoreId]?.orders || []) : [];
        return orders.filter(o => ['جديد', 'قيد_المراجعة', 'في_انتظار_المكالمة', 'مؤجل'].includes(o.status)).length;
    }, [allStoresData, activeStoreId]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
            if (storeMenuRef.current && !storeMenuRef.current.contains(event.target as Node)) {
                setIsStoreMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getUserInitials = (name: string) => {
        if (!name) return "م";
        const names = name.trim().split(' ');
        return names.length > 1 && names[names.length - 1]
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white" dir="rtl">
            
            {/* Top Operations Header */}
            <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-3 sm:px-6 h-18 sticky top-0 z-40 flex items-center justify-between shadow-xs transition-colors">
                
                {/* Right: Brand Emblem + Navigation + Store Switcher */}
                <div className="flex items-center gap-2 sm:gap-4">
                    
                    {/* Modern Operations Brand Badge */}
                    <Link to="/employee/dashboard" className="flex items-center gap-2.5 group cursor-pointer">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                            <Headphones size={20} className="text-white" />
                        </div>
                        <div className="hidden sm:block text-right">
                            <div className="flex items-center gap-1.5">
                                <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white">بوابة العمليات</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-black text-[10px]">
                                    الموظفين
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-none mt-0.5">
                                إدارة الطلبات وتأكيد العمليات
                            </p>
                        </div>
                    </Link>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 hidden md:block" />

                    {/* Desktop Navigation Links */}
                    <nav className="hidden md:flex items-center gap-1" aria-label="تنقل بوابة الموظف">
                        <NavLink 
                            to="/employee/dashboard" 
                            className={({ isActive }) => `flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                        >
                            <LayoutDashboard size={15} />
                            <span>الرئيسية</span>
                        </NavLink>

                        {canManageOrders && (
                            <NavLink 
                                to="/employee/confirmation-queue" 
                                className={({ isActive }) => `relative flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                            >
                                <PhoneForwarded size={15} />
                                <span>تأكيد الطلبات</span>
                                {pendingConfirmationCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                                        {pendingConfirmationCount}
                                    </span>
                                )}
                            </NavLink>
                        )}

                        {canUsePOS && (
                            <NavLink 
                                to="/employee/pos" 
                                className={({ isActive }) => `flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                            >
                                <ShoppingCart size={15} />
                                <span>نقطة البيع (POS)</span>
                            </NavLink>
                        )}

                        <NavLink 
                            to="/employee/quotations" 
                            className={({ isActive }) => `flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                        >
                            <FileSpreadsheet size={15} />
                            <span>عروض الأسعار</span>
                        </NavLink>

                        <NavLink 
                            to="/employee/my-activity" 
                            className={({ isActive }) => `flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                        >
                            <History size={15} />
                            <span>سجل أدائي</span>
                        </NavLink>
                    </nav>

                    {/* Active Store Switcher (if multi-store) */}
                    {employeeStores.length > 0 && (
                        <div className="relative" ref={storeMenuRef}>
                            <button 
                                onClick={() => setIsStoreMenuOpen(p => !p)} 
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-bold text-xs text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 transition cursor-pointer"
                                title="المتجر الحالي"
                            >
                                <StoreIcon size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="max-w-[110px] sm:max-w-[140px] truncate">{currentStoreName}</span>
                                {employeeStores.length > 1 && (
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isStoreMenuOpen ? 'rotate-180' : ''}`} />
                                )}
                            </button>

                            {isStoreMenuOpen && employeeStores.length > 1 && (
                                <div className="absolute left-0 top-11 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95">
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        اختر متجر العمل للوردية
                                    </div>
                                    {employeeStores.map(store => (
                                        <button 
                                            key={store.id} 
                                            onClick={() => { handleSetActiveStore(store.id); setIsStoreMenuOpen(false); }}
                                            className={`w-full text-right flex items-center justify-between gap-3 px-3 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${store.id === activeStoreId ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                        >
                                            <span className="truncate">{store.name}</span>
                                            {store.id === activeStoreId && <Check size={14} className="text-emerald-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Left: Live Shift Badge + Scratchpad + Sound + Chat + User Profile */}
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                    
                    {/* Live Shift Counter & Quick Action Button */}
                    <button
                        type="button"
                        onClick={() => setShowShiftModal(true)}
                        className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            shiftStatus === 'working' 
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100'
                                : shiftStatus === 'break'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/80 hover:bg-amber-100'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                        title="إدارة حضور وساعات الوردية"
                    >
                        <span className="relative flex h-2 w-2">
                            {shiftStatus === 'working' && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                shiftStatus === 'working' ? 'bg-emerald-500' : shiftStatus === 'break' ? 'bg-amber-500' : 'bg-slate-400'
                            }`}></span>
                        </span>
                        <span className="hidden sm:inline">
                            {shiftStatus === 'working' ? 'الوردية:' : shiftStatus === 'break' ? 'استراحة:' : 'الوردية متوقفة'}
                        </span>
                        {shiftStatus !== 'stopped' && (
                            <span className="font-mono font-black tracking-wider text-[11px]" dir="ltr">
                                {formatShiftTime(shiftSeconds)}
                            </span>
                        )}
                    </button>

                    {/* Shift Scratchpad / Quick Notes */}
                    <button
                        type="button"
                        onClick={() => setShowScratchpad(true)}
                        className={`p-2 rounded-xl transition border cursor-pointer ${
                            scratchpadText.trim() 
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title="مفكرة الملاحظات السريعة للوردية"
                        aria-label="الملاحظات السريعة"
                    >
                        <FileText size={17} />
                    </button>

                    {/* Sound Notification Chime Toggle */}
                    <button
                        type="button"
                        onClick={toggleSound}
                        className={`p-2 rounded-xl transition border cursor-pointer ${isSoundMuted ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-200 dark:border-rose-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        title={isSoundMuted ? 'تفعيل أصوات التنبيهات' : 'كتم أصوات التنبيهات (انقر للتجربة)'}
                        aria-label="التحكم بالصوت"
                    >
                        {isSoundMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                    </button>

                    {/* Team Chat Trigger */}
                    <button
                        type="button"
                        onClick={() => chatRef.current?.toggle()}
                        className="relative p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-transparent cursor-pointer"
                        title="محادثة الفريق المباشرة"
                        aria-label="فتح محادثة الفريق"
                    >
                        <MessageSquare size={17} />
                        {Object.keys(onlineUsers).length > 1 && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                        )}
                    </button>

                    {/* User Profile & Actions Dropdown */}
                    <div className="relative" ref={userMenuRef}>
                        <button 
                            type="button"
                            onClick={() => setIsUserMenuOpen(prev => !prev)} 
                            className="flex items-center gap-2 p-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            aria-expanded={isUserMenuOpen}
                            aria-label="قائمة المستخدم"
                        >
                            <div className="w-9 h-9 rounded-xl font-black flex items-center justify-center text-xs bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 shadow-sm border border-emerald-400/40">
                                {getUserInitials(currentUser?.fullName || '')}
                            </div>
                            <div className="text-right hidden sm:block">
                                <div className="font-black text-xs text-slate-900 dark:text-white leading-tight">
                                    {currentUser?.fullName?.split(' ')[0] || 'الموظف'}
                                </div>
                                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold leading-tight mt-0.5">
                                    {currentUser ? getRoleName(currentUser.permissions || []) : 'موظف معتمد'}
                                </div>
                            </div>
                            <ChevronDown size={14} className={`text-slate-400 hidden sm:block transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute left-0 top-12 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 space-y-1">
                                
                                {/* User Card Header */}
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-right space-y-1">
                                    <div className="font-black text-sm text-slate-900 dark:text-white">
                                        {currentUser?.fullName}
                                    </div>
                                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400 dir-ltr text-right">
                                        {currentUser?.phone}
                                    </div>
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                                        <ShieldCheck size={11} />
                                        <span>{currentUser ? getRoleName(currentUser.permissions || []) : 'موظف معتمد'}</span>
                                    </div>
                                </div>

                                {/* Install App */}
                                {!isStandalone && installPrompt && (
                                    <button
                                        type="button"
                                        onClick={() => { onInstall(); setIsUserMenuOpen(false); }}
                                        className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                                    >
                                        <Download size={15} className="text-emerald-600" />
                                        <span>تثبيت تطبيق الوردية (PWA)</span>
                                    </button>
                                )}

                                {!isStandalone && isIos && !installPrompt && (
                                    <button
                                        type="button"
                                        onClick={() => { setShowIosInstallModal(true); setIsUserMenuOpen(false); }}
                                        className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                                    >
                                        <Download size={15} className="text-emerald-600" />
                                        <span>تثبيت التطبيق على آيفون</span>
                                    </button>
                                )}

                                <Link 
                                    to="/employee/account-settings" 
                                    onClick={() => setIsUserMenuOpen(false)} 
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                                >
                                    <Settings size={15} className="text-slate-500" />
                                    <span>إعدادات حسابي والأمان</span>
                                </Link>

                                <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-1" />

                                {/* Theme Switcher */}
                                <div className="px-3 py-2 space-y-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 block">المظهر والعرض:</span>
                                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                                        <button 
                                            type="button"
                                            onClick={() => setTheme('light')} 
                                            className={`flex-1 flex justify-center items-center gap-1 py-1 text-[11px] rounded-lg font-bold transition ${theme === 'light' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                        >
                                            <Sun size={13} />
                                            <span>فاتح</span>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setTheme('dark')} 
                                            className={`flex-1 flex justify-center items-center gap-1 py-1 text-[11px] rounded-lg font-bold transition ${theme === 'dark' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                        >
                                            <Moon size={13} />
                                            <span>داكن</span>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setTheme('system')} 
                                            className={`flex-1 flex justify-center items-center gap-1 py-1 text-[11px] rounded-lg font-bold transition ${theme === 'system' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                        >
                                            <Monitor size={13} />
                                            <span>تلقائي</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-1" />

                                {/* Logout & End Shift */}
                                <button 
                                    type="button"
                                    onClick={() => {
                                        handleShiftAction('end');
                                        onLogout();
                                    }} 
                                    className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs transition cursor-pointer"
                                >
                                    <LogOut size={15} />
                                    <span>إنهاء الوردية وتسجيل الخروج</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Shift Modal Drawer */}
            {showShiftModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                                    <Clock size={20} />
                                </div>
                                <h3 className="font-black text-base text-slate-900 dark:text-white">إدارة الوردية وساعات العمل</h3>
                            </div>
                            <button onClick={() => setShowShiftModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Current Shift Timer Card */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center space-y-1">
                            <span className="text-xs font-bold text-slate-500">الوقت المنقضي في الوردية الحالية:</span>
                            <div className="text-3xl font-black font-mono tracking-wider text-emerald-600 dark:text-emerald-400" dir="ltr">
                                {formatShiftTime(shiftSeconds)}
                            </div>
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                shiftStatus === 'working' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                shiftStatus === 'break' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                                'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                                {shiftStatus === 'working' ? '● الوردية نشطة والوقت يحسب' : shiftStatus === 'break' ? '⏸ في استراحة مؤقتة' : '⏹ الوردية متوقفة'}
                            </span>
                        </div>

                        {/* Shift Actions */}
                        <div className="space-y-2">
                            {shiftStatus === 'working' ? (
                                <button
                                    onClick={() => handleShiftAction('break')}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition cursor-pointer"
                                >
                                    <Coffee size={17} />
                                    <span>أخذ استراحة مؤقتة (Break)</span>
                                </button>
                            ) : shiftStatus === 'break' ? (
                                <button
                                    onClick={() => handleShiftAction('resume')}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
                                >
                                    <Play size={17} />
                                    <span>استئناف الوردية والعمل</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleShiftAction('start')}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
                                >
                                    <Play size={17} />
                                    <span>بدء وردية جديدة الآن</span>
                                </button>
                            )}

                            {shiftStatus !== 'stopped' && (
                                <button
                                    onClick={() => handleShiftAction('end')}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-bold text-xs bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                                >
                                    <Square size={14} />
                                    <span>إنهاء الوردية وتسجيل إجمالي الساعات</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Shift Scratchpad Drawer */}
            {showScratchpad && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-base text-slate-900 dark:text-white">مفكرة الوردية السريعة</h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">سجل أرقام الهواتف، الملاحظات والمواعيد أثناء المكالمات - تحفظ تلقائياً</p>
                                </div>
                            </div>
                            <button onClick={() => setShowScratchpad(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        <textarea
                            value={scratchpadText}
                            onChange={(e) => handleScratchpadChange(e.target.value)}
                            placeholder="اكتب هنا أي ملاحظة، تذكير اتصال، رقم عميل، أو طلب خاص أثناء المكالمة..."
                            rows={8}
                            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        />

                        <div className="flex items-center justify-between pt-1">
                            <button
                                onClick={() => handleScratchpadChange('')}
                                className="text-xs text-rose-500 hover:underline font-bold"
                            >
                                مسح المفكرة
                            </button>
                            <button
                                onClick={() => setShowScratchpad(false)}
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                            >
                                إغلاق وحفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 pb-20 md:pb-8">
                {children}
            </main>

            {/* Mobile Bottom Navigation Dock */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/90 dark:border-slate-800/90 z-40 px-2 py-1.5 flex items-center justify-around shadow-lg">
                <NavLink 
                    to="/employee/dashboard" 
                    className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition text-[10px] font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    <LayoutDashboard size={18} />
                    <span>الرئيسية</span>
                </NavLink>

                {canManageOrders && (
                    <NavLink 
                        to="/employee/confirmation-queue" 
                        className={({ isActive }) => `relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition text-[10px] font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <PhoneForwarded size={18} />
                        <span>التأكيد</span>
                        {pendingConfirmationCount > 0 && (
                            <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                                {pendingConfirmationCount}
                            </span>
                        )}
                    </NavLink>
                )}

                {canUsePOS && (
                    <NavLink 
                        to="/employee/pos" 
                        className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition text-[10px] font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <ShoppingCart size={18} />
                        <span>الكاشير</span>
                    </NavLink>
                )}

                <NavLink 
                    to="/employee/quotations" 
                    className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition text-[10px] font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    <FileSpreadsheet size={18} />
                    <span>العروض</span>
                </NavLink>

                <NavLink 
                    to="/employee/my-activity" 
                    className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition text-[10px] font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    <History size={18} />
                    <span>أدائي</span>
                </NavLink>

                <NavLink 
                    to="/employee/account-settings" 
                    className={({ isActive }) => `flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition text-[10px] font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    <Settings size={18} />
                    <span>حسابي</span>
                </NavLink>
            </nav>

            <FloatingChat 
                ref={chatRef} 
                currentUser={currentUser} 
                storeOwner={storeOwner} 
                activeStoreId={activeStoreId} 
                employees={allStoresData[activeStoreId || '']?.settings.employees || []} 
                onlineUsers={onlineUsers} 
            />

            {showIosInstallModal && (
                <IosInstallPrompt onClose={() => setShowIosInstallModal(false)} />
            )}
        </div>
    );
};

export default EmployeeLayout;

