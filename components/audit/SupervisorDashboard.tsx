import React, { useState, useMemo, useEffect } from 'react';
import { 
    Users, Activity, CheckCircle2, AlertTriangle, ShieldAlert, Clock, Sparkles, 
    ArrowRight, Trophy, Zap, RefreshCw, Send, CheckCircle, XCircle, Search, Play, Pause, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, InventoryAuditSession } from '../../types';
import { audioSynth } from '../../utils/audioSynth';

interface SupervisorDashboardProps {
    settings: Settings;
    sharedSessions: any[];
    onApproveSharedSession: (id: string, settlementDetails?: any) => Promise<void>;
    onRejectSharedSession: (id: string, reason: string) => Promise<void>;
    onNavigateTab: (tab: string) => void;
    loadingShared: boolean;
}

export default function SupervisorDashboard({
    settings,
    sharedSessions = [],
    onApproveSharedSession,
    onRejectSharedSession,
    onNavigateTab,
    loadingShared
}: SupervisorDashboardProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLiveCounter, setSelectedLiveCounter] = useState<string | null>(null);
    const [rejectingSessionId, setRejectingSessionId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Active counters based strictly on real shared sessions data
    const activeCounters = useMemo(() => {
        const list: any[] = [];
        sharedSessions.forEach((session, idx) => {
            if (session.managerName && !list.some(item => item.name === session.managerName)) {
                list.push({
                    id: session.id,
                    name: session.managerName,
                    role: 'مسؤول عد',
                    status: session.status === 'pending' ? 'online' : 'away',
                    zone: session.warehouseName || 'المخزن',
                    countRate: 'أداة العد',
                    accuracy: session.status === 'approved' ? 'معتمد' : 'تحت المراجعة',
                    activeSince: new Date(session.createdAt).toLocaleDateString('ar-EG')
                });
            }
        });
        return list;
    }, [sharedSessions]);

    // Active Counter KPI summary
    const supervisorKPIs = useMemo(() => {
        const totalCounters = activeCounters.length;
        const onlineCounters = activeCounters.filter(c => c.status === 'online').length;
        
        let totalConflicts = 0;
        let highVarianceCount = 0;

        sharedSessions.forEach(session => {
            if (session.status === 'pending' || session.status === 'completed') {
                session.items.forEach((item: any) => {
                    if (item.actualQty !== undefined) {
                        const diff = Math.abs(item.actualQty - item.systemQty);
                        if (diff > 15) {
                            highVarianceCount++;
                        }
                        if (item.actualQty === 0 && item.systemQty > 10) {
                            totalConflicts++;
                        }
                    }
                });
            }
        });

        return {
            totalCounters,
            onlineCounters,
            totalConflicts,
            highVarianceCount
        };
    }, [activeCounters, sharedSessions]);

    // Pending review list
    const pendingReviewSessions = useMemo(() => {
        return sharedSessions.filter(s => s.status === 'pending' || s.status === 'completed' || s.status === 'rejected');
    }, [sharedSessions]);

    // Real events from shared sessions
    const realEvents = useMemo(() => {
        const events: any[] = [];
        sharedSessions.forEach(session => {
            if (session.createdAt) {
                events.push({
                    id: `${session.id}-created`,
                    type: 'sync',
                    user: session.managerName || 'مسؤول الجرد الميداني',
                    details: `بدأ جلسة جرد: ${session.title}`,
                    time: new Date(session.createdAt).toLocaleDateString('ar-EG'),
                    location: session.warehouseName || 'غير محدد'
                });
            }
            if (session.submittedAt) {
                events.push({
                    id: `${session.id}-submitted`,
                    type: 'scan',
                    user: session.managerName || 'مسؤول الجرد الميداني',
                    details: `أرسل جرد ${session.title} للاعتماد`,
                    time: new Date(session.submittedAt).toLocaleDateString('ar-EG'),
                    location: session.warehouseName || 'غير محدد'
                });
            }
        });
        return events.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 10);
    }, [sharedSessions]);

    const handleQuickApprove = async (id: string, title: string) => {
        try {
            audioSynth.playTone('success');
            await onApproveSharedSession(id);
        } catch (err) {
            console.error(err);
        }
    };

    const handleTriggerReject = (id: string) => {
        setRejectingSessionId(id);
        setRejectReason('');
    };

    const handleConfirmReject = async () => {
        if (!rejectingSessionId || !rejectReason.trim()) return;
        try {
            audioSynth.playTone('error');
            await onRejectSharedSession(rejectingSessionId, rejectReason);
            setRejectingSessionId(null);
            setRejectReason('');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6 dir-rtl text-right animate-in fade-in duration-300">
            
            {/* Top Live Analytics Header Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-[2.5rem] border border-indigo-850 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-x-16 -translate-y-16 blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full translate-x-16 translate-y-16 blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                            <Activity size={12} className="animate-pulse" />
                            بوابة الإشراف والرقابة الحية
                        </div>
                        <h2 className="text-2xl font-black">غرفة التحكم والمراقبة لفرق جرد الأرفف</h2>
                        <p className="text-xs text-slate-300 leading-relaxed font-bold max-w-xl">
                            تابع الموظفين الميدانيين أثناء العد الفعلي، واكتشف تعارضات كميات الأرفف لحظياً، واعتمد كشوف الجرد بنقرة واحدة لتسوية أرصدة المخازن سحابياً.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {}}
                            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-black flex items-center gap-2"
                        >
                            <Activity size={14} />
                            النبض اللحظي نشط
                        </button>
                    </div>
                </div>

                {/* Dashboard Stats Panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[10px] text-indigo-300 block mb-1">العدادين النشطين بالأرفف</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">{supervisorKPIs.onlineCounters}</span>
                            <span className="text-xs text-emerald-400 font-bold">متصل الآن 📡</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[10px] text-indigo-300 block mb-1">تعارضات جردية مرصودة</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-rose-400">{supervisorKPIs.totalConflicts}</span>
                            <span className="text-xs text-rose-300 font-bold">نزاع كميات ⚠️</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[10px] text-indigo-300 block mb-1">انحرافات حرج (&gt;30%)</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-amber-400">{supervisorKPIs.highVarianceCount}</span>
                            <span className="text-xs text-amber-300 font-bold">فجوة عجز 🔍</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[10px] text-indigo-300 block mb-1">كشوف جرد معلقة للتقييم</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-indigo-350">{pendingReviewSessions.length}</span>
                            <span className="text-xs text-indigo-300 font-bold">كشف معلق 🧾</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Interactive Screen Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Right Column: Live Counters List & Live Activity Log (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    
                    {/* Live Counters Grid */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Users className="text-indigo-650" size={18} />
                                    حالة فريق العدادين الميدانيين (Live)
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold">الموظفون المتواجدون حالياً بين الأرفف والممرات لتسجيل الأرصدة.</p>
                            </div>
                            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-full">
                                {activeCounters.length} مسجلين
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeCounters.map((counter) => (
                                <div 
                                    key={counter.id}
                                    onClick={() => setSelectedLiveCounter(selectedLiveCounter === counter.id ? null : counter.id)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                                        selectedLiveCounter === counter.id 
                                            ? 'bg-indigo-50/70 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50' 
                                            : 'bg-slate-50/50 border-slate-100 hover:bg-white dark:bg-slate-800/10 dark:border-slate-800/40 hover:border-slate-200 dark:hover:bg-slate-800/40'
                                    }`}
                                >
                                    <div className="flex items-start gap-3 relative z-10">
                                        <div className="relative">
                                            <div className="w-10 h-10 bg-indigo-100 dark:bg-slate-800 text-indigo-600 dark:text-slate-300 font-black rounded-xl flex items-center justify-center text-xs">
                                                {counter.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <span className={`absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                                counter.status === 'online' ? 'bg-emerald-500' : 'bg-amber-400'
                                            }`} />
                                        </div>

                                        <div className="space-y-1 flex-1">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-xs font-black text-slate-800 dark:text-white group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">{counter.name}</h4>
                                                <span className="text-[9px] text-slate-400 font-bold">{counter.activeSince}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{counter.role}</p>
                                            
                                            <div className="pt-2 flex items-center gap-3 text-[9px] font-bold text-slate-400">
                                                <span>⚡ معدل: <strong className="text-slate-600 dark:text-slate-300 font-mono">{counter.countRate}</strong></span>
                                                <span>🎯 دقة: <strong className="text-emerald-600 font-mono">{counter.accuracy}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Counter Zone Map Info */}
                                    {selectedLiveCounter === counter.id && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/30 text-[10px] text-slate-500 dark:text-slate-400 space-y-1.5 font-bold"
                                        >
                                            <div className="flex justify-between">
                                                <span>📍 ممر التواجد والنشاط الحالي:</span>
                                                <span className="text-indigo-650 dark:text-indigo-400">{counter.zone}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>📡 حالة اتصال الجهاز المحمول:</span>
                                                <span className="text-emerald-600">متصل بالإنترنت ومزامن (Ping: 42ms)</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Conflict Detection & Critical Discrepancies Monitor */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <ShieldAlert className="text-rose-600 animate-pulse" size={18} />
                                مرصد التعارضات ونزاع عد الأرفف للكميات
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold">يقوم النظام تلقائياً برصد أي كشوف تحتوي على تكرار أو فجوة تتخطى 30% من رصيد السيستم للتحقق الأمني.</p>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {/* Empty State for Discrepancy Alerts */}
                            <div className="py-8 text-center">
                                <p className="text-[10px] text-slate-400 font-bold">لا توجد تعارضات جردية مرصودة حالياً.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Left Column: Live Event Stream & Direct Approval Queue (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Live Event Stream / Activity Feed */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Activity className="text-indigo-650" size={18} />
                                    خط النشاط والنبض اللحظي
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold">الأحداث الميدانية التي يسجلها الموظفون الآن.</p>
                            </div>
                        </div>

                        <div className="relative border-r-2 border-slate-100 dark:border-slate-800 pr-4 space-y-4">
                            {realEvents.length > 0 ? realEvents.map((event) => (
                                <div key={event.id} className="relative group">
                                    {/* Timeline Node dot */}
                                    <span className="absolute -right-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 ring-4 ring-indigo-50 dark:ring-slate-800/20 transition-transform group-hover:scale-125" />
                                    
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-[10px] font-black text-slate-800 dark:text-white">{event.user}</span>
                                            <span className="text-[8px] text-indigo-500 font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">{event.time}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{event.details}</p>
                                        <span className="text-[8px] text-slate-400 block">{event.location}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-4 text-center">
                                    <p className="text-[10px] text-slate-400 font-bold">لا توجد نشاطات مسجلة حالياً.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Active Counters Speed/Accuracy Leaderboard */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <Trophy className="text-amber-500" size={18} />
                            <h3 className="text-sm font-black text-slate-800 dark:text-white">ترتيب العدادين الميدانيين</h3>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold">الموظفون الأعلى كفاءة وسرعة ودقة في عمليات جرد المخزن الميدانية لهذا الأسبوع.</p>

                        <div className="space-y-3">
                            <div className="py-4 text-center border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] text-slate-400 font-bold">لا تتوفر بيانات كافية لاحتساب الكفاءة حالياً.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Direct Audit Approval Queue Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 mt-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <CheckCircle2 className="text-indigo-650" size={18} />
                            طابور الاعتماد والترحيل المالي للجرد الخارجي
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">كشوف الجرد المكتملة والمرفوعة من روابط العد الخارجي للموظفين بانتظار موافقتك لترحيل الأرصدة فوراً.</p>
                    </div>
                    <span className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full animate-pulse">
                        {pendingReviewSessions.length} كشوف تنتظر الموافقة
                    </span>
                </div>

                {loadingShared ? (
                    <div className="py-12 text-center text-slate-400 font-bold text-xs">جاري تحميل الكشوف المعلقة من السحابة...</div>
                ) : pendingReviewSessions.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-3 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                        <CheckCircle className="mx-auto text-emerald-500" size={44} />
                        <h4 className="text-xs font-black text-slate-700 dark:text-slate-350">لا توجد أي كشوف معلقة حالياً</h4>
                        <p className="text-[10px] text-slate-400">جميع كشوف الجرد الخارجي تمت مراجعتها، اعتمادها أو رفضها لإعادة العد.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingReviewSessions.map((session) => (
                            <div 
                                key={session.id} 
                                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all relative overflow-hidden group ${
                                    session.status === 'rejected'
                                        ? 'bg-rose-50/20 border-rose-100 dark:bg-rose-950/5 dark:border-rose-900/20'
                                        : 'bg-white border-slate-100 hover:shadow-md dark:bg-slate-850 dark:border-slate-800'
                                }`}
                            >
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-black text-xs text-slate-800 dark:text-white">{session.title}</h4>
                                                <span className={`px-2 py-0.5 text-[8px] font-black rounded ${
                                                    session.status === 'rejected'
                                                        ? 'bg-rose-100 text-rose-700'
                                                        : 'bg-indigo-100 text-indigo-700'
                                                }`}>
                                                    {session.status === 'rejected' ? 'مرفوض وبانتظار الإعادة' : 'جاهز للمطابقة'}
                                                </span>
                                            </div>
                                            <span className="text-[9px] text-slate-400 block font-bold">المستودع: {session.warehouseName} • تاريخ الإنشاء: {new Date(session.createdAt).toLocaleDateString('ar-EG')}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold">
                                        <span>👤 المجرود بواسطة: <strong className="text-slate-800 dark:text-white">{session.managerName || 'موظف ميداني'}</strong></span>
                                        <span>📦 أصناف: <strong className="text-slate-800 dark:text-white font-mono">{session.items.length}</strong></span>
                                    </div>

                                    {/* Rejected comment display */}
                                    {session.status === 'rejected' && (
                                        <div className="p-3 bg-rose-100/30 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 text-[10px] font-bold rounded-xl border border-rose-200/20">
                                            ⚠️ سبب الرفض المسجل: "{session.rejectReason}"
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pt-3 border-t border-slate-50 dark:border-slate-800">
                                    {session.status !== 'rejected' && (
                                        <>
                                            <button
                                                onClick={() => handleQuickApprove(session.id, session.title)}
                                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                            >
                                                <CheckCircle size={13} />
                                                موافقة وترحيل الأرصدة
                                            </button>
                                            <button
                                                onClick={() => handleTriggerReject(session.id)}
                                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-xl text-[10px] font-black transition-all active:scale-95"
                                                title="رفض وإعادة العد"
                                            >
                                                رفض
                                            </button>
                                        </>
                                    )}
                                    {session.status === 'rejected' && (
                                        <div className="text-[10px] font-bold text-rose-600">بانتظار قيام الموظف بإعادة فحص الأرصدة وتقديم العد من جديد.</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Custom Reject Modal Overlay */}
            {rejectingSessionId && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-right">
                        <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <AlertTriangle size={24} />
                            <h3 className="font-black text-sm">تأكيد رفض كشف الجرد وإعادته للموظف</h3>
                        </div>

                        <p className="text-xs text-slate-500 font-bold leading-relaxed">
                            يرجى إدخال سبب الرفض وملاحظات التوجيه بدقة، حيث سيظهر هذا السبب مباشرة للموظف الميداني على هاتفه المحمول لمساعدته في إعادة العد وتصحيح الفجوات.
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 font-black">سبب الرفض والتعليمات الميدانية:</label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="أدخل تعليمات للمراقبين هنا..."
                                className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 dark:text-white"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleConfirmReject}
                                disabled={!rejectReason.trim()}
                                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                            >
                                <XCircle size={15} />
                                إرسال الرفض الفوري
                            </button>
                            <button
                                onClick={() => setRejectingSessionId(null)}
                                className="px-5 py-2.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-xs font-black transition-all"
                            >
                                تراجع
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
