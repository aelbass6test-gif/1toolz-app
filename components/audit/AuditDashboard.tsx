import React, { useMemo } from 'react';
import { 
    Gauge, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, 
    Calendar, CheckCircle, Clock, Zap, ArrowRight, User, Package,
    ShieldAlert, Sparkles, AlertCircle, Users, Activity, Play, FileText,
    CheckSquare, HelpCircle, ArrowUpRight, BarChart3, LayoutGrid, Check, Info
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { motion } from 'motion/react';
import { Settings, InventoryAuditSession } from '../../types';

interface AuditDashboardProps {
    settings: Settings;
    pastSessions: InventoryAuditSession[];
    sharedSessions: any[];
    onNavigateTab: (tab: 'hub' | 'variance' | 'analytics') => void;
    onViewPastSession: (session: InventoryAuditSession) => void;
    onViewSharedSession: (session: any) => void;
    loadingShared: boolean;
}

export default function AuditDashboard({
    settings,
    pastSessions = [],
    sharedSessions = [],
    onNavigateTab,
    onViewPastSession,
    onViewSharedSession,
    loadingShared
}: AuditDashboardProps) {

    // 1. Calculations for stats
    const totalSessions = pastSessions.length;
    
    // Average accuracy calculation
    const avgAccuracy = useMemo(() => {
        if (pastSessions.length === 0) return 100; // start at perfect accuracy
        const sumAccuracy = pastSessions.reduce((acc, session) => {
            const total = session.totalSystemQty || 1;
            const diff = Math.abs(session.totalVarianceQty || 0);
            const accuracy = Math.max(0, Math.min(100, ((total - diff) / total) * 100));
            return acc + accuracy;
        }, 0);
        return Math.round((sumAccuracy / pastSessions.length) * 10) / 10;
    }, [pastSessions]);

    // Financial impacts
    const totalVarianceValue = useMemo(() => {
        return pastSessions.reduce((acc, s) => acc + (s.totalVarianceValue || 0), 0);
    }, [pastSessions]);

    const absoluteLosses = useMemo(() => {
        return pastSessions.reduce((acc, s) => {
            const sumDiscrepancies = s.discrepancies?.reduce((sum, d) => {
                return d.varianceValue < 0 ? sum + Math.abs(d.varianceValue) : sum;
            }, 0) || 0;
            return acc + sumDiscrepancies;
        }, 0);
    }, [pastSessions]);

    // Warehouse health metric
    const warehouseHealthScore = useMemo(() => {
        const base = 100;
        const deductions = (absoluteLosses / 100000) * 15; // scaled deduction
        return Math.max(78, Math.min(100, Math.round(base - deductions)));
    }, [absoluteLosses]);

    // Pending external submissions
    const pendingReviewCount = sharedSessions.filter(s => s.status === 'submitted').length;
    const pendingCount = sharedSessions.filter(s => s.status === 'pending').length;

    // Heatmap variance by Warehouse / Zone
    const varianceHeatmapData = useMemo(() => {
        const warehouseMap: Record<string, { totalVarianceValue: number; totalDiscrepancies: number; accuracy: number; colorClass: string }> = {};
        
        // Default list from settings warehouses
        const list = settings.warehouses || [{ id: 'all', name: 'الرصيد الإجمالي' }];
        list.forEach(w => {
            warehouseMap[w.id] = { totalVarianceValue: 0, totalDiscrepancies: 0, accuracy: 100, colorClass: 'bg-emerald-50 text-emerald-700' };
        });

        pastSessions.forEach(s => {
            const whId = s.warehouseId || 'all';
            if (!warehouseMap[whId]) {
                warehouseMap[whId] = { totalVarianceValue: 0, totalDiscrepancies: 0, accuracy: 95, colorClass: 'bg-slate-50' };
            }
            warehouseMap[whId].totalVarianceValue += Math.abs(s.totalVarianceValue || 0);
            warehouseMap[whId].totalDiscrepancies += s.discrepancies?.length || 0;
            
            const total = s.totalSystemQty || 1;
            const diff = Math.abs(s.totalVarianceQty || 0);
            const accuracy = Math.max(0, Math.min(100, ((total - diff) / total) * 100));
            warehouseMap[whId].accuracy = Math.round((warehouseMap[whId].accuracy + accuracy) / 2 * 10) / 10;
        });

        return Object.entries(warehouseMap).map(([id, data]) => {
            const whName = settings.warehouses?.find(w => w.id === id)?.name || (id === 'all' ? 'الرصيد الإجمالي' : 'مستودع فرعي');
            let color = 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400';
            let status = 'آمن ومطابق';
            
            if (data.accuracy < 90) {
                color = 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400';
                status = 'حرجة وعالية الفجوات';
            } else if (data.accuracy < 96) {
                color = 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400';
                status = 'تحذيرية متوسطة الفوارق';
            }

            return {
                id,
                name: whName,
                ...data,
                colorClass: color,
                status
            };
        });
    }, [pastSessions, settings.warehouses]);

    // Real-time Audit Activity based on active shared sessions and past sessions
    const employeeActivities = useMemo(() => {
        const activities = [];
        sharedSessions.forEach(s => {
            if (s.status === 'submitted') {
                activities.push({
                    id: `act-1-${s.id}`,
                    employee: s.managerName || 'مسؤول الجرد الميداني',
                    text: `أتم عملية العد الفعلي وسلّم الجلسة "${s.title}" للمراجعة`,
                    time: s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'منذ قليل',
                    icon: 'check',
                    type: 'success'
                });
            } else if (s.status === 'pending') {
                activities.push({
                    id: `act-2-${s.id}`,
                    employee: 'نظام الجرد',
                    text: `رابط جرد خارجي نشط للعد الميداني: "${s.title}" بانتظار استجابة الموظف`,
                    time: 'نشط الآن',
                    icon: 'clock',
                    type: 'info'
                });
            }
        });

        pastSessions.slice(0, 3).forEach(s => {
            activities.push({
                id: `act-3-${s.id}`,
                employee: s.performedBy.split(':')[1]?.trim() || s.performedBy || 'المشرف المسؤول',
                text: `اعتمد الترحيل المالي والربط للسيستم عن الجلسة "${s.title}" بقيمة تسوية ${s.totalVarianceValue.toLocaleString()} ج.م`,
                time: new Date(s.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
                icon: 'approve',
                type: 'approve'
            });
        });

        if (activities.length === 0) {
            activities.push({
                id: 'act-default',
                employee: 'نظام المستودعات',
                text: 'لا توجد أنشطة لوجستية جارية حالياً، يرجى بدء جرد جديد.',
                time: 'الآن',
                icon: 'info',
                type: 'slate'
            });
        }
        return activities.slice(0, 5);
    }, [sharedSessions, pastSessions]);

    // 2. Format chart data
    const trendData = useMemo(() => {
        if (pastSessions.length === 0) {
            return [];
        }
        return [...pastSessions]
            .slice(0, 8)
            .reverse()
            .map((session, i) => {
                const total = session.totalSystemQty || 1;
                const diff = Math.abs(session.totalVarianceQty || 0);
                const accuracy = Math.max(0, Math.min(100, ((total - diff) / total) * 100));
                return {
                    name: session.title.slice(0, 15) + '...',
                    accuracy: Math.round(accuracy * 10) / 10,
                    value: session.totalVarianceValue,
                    date: new Date(session.date).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' })
                };
            });
    }, [pastSessions]);

    // Smart Recommendations Generator (AI-like)
    const smartRecommendations = useMemo(() => {
        const list = [];
        
        if (warehouseHealthScore < 90) {
            list.push({
                id: 'rec-1',
                title: 'تدهور مؤشر صحة دقة المستودعات',
                desc: `تم رصد عجز فجائي تراكمي بقيمة ${absoluteLosses.toLocaleString()} ج.م. يوصى بفرض نظام "العد الأعمى (Blind Count)" لروابط الجرد الخارجية لمنع الموظفين من مطابقة أرقام السيستم تلقائياً دون تفتيش حقيقي على الأرفف.`,
                type: 'critical',
                action: 'تفعيل العد الأعمى'
            });
        }

        // Check if there are unapproved submitted sessions
        if (pendingReviewCount > 0) {
            list.push({
                id: 'rec-2',
                title: 'طلبات جرد خارجية بانتظار القرار المالي',
                desc: `يوجد عدد ${pendingReviewCount} جلسة جرد ميدانية مكتملة من موظفيك. نوصي بمراجعتها فوراً لمنع تعارض الأرصدة مع حركة البيع النشطة وحماية السيستم من المبيعات السالبة.`,
                type: 'action',
                action: 'اعتماد الميداني'
            });
        }

        // Analyze which product has high frequent anomalies
        const itemFreq: Record<string, { name: string; count: number; totalQty: number }> = {};
        pastSessions.forEach(s => {
            s.discrepancies?.forEach(d => {
                if (!itemFreq[d.productId]) {
                    itemFreq[d.productId] = { name: d.name, count: 0, totalQty: 0 };
                }
                itemFreq[d.productId].count += 1;
                itemFreq[d.productId].totalQty += Math.abs(d.variance);
            });
        });

        const highAnomalousProduct = Object.values(itemFreq).sort((a, b) => b.count - a.count)[0];
        if (highAnomalousProduct && highAnomalousProduct.count >= 2) {
            list.push({
                id: 'rec-3',
                title: `تكرار عدم المطابقة بصنف [ ${highAnomalousProduct.name} ]`,
                desc: `تكررت الفروقات على هذا المنتج بمجموع ${highAnomalousProduct.totalQty} قطعة خلال آخر جرود. نقترح فحص كاميرات المراقبة للرف المخصص ومطابقة كشوفات فواتير استلام الموردين والتحقق من عدم وجود خلط SKUs متشابهة.`,
                type: 'warning',
                action: 'تحقيق بالباركود'
            });
        }

        // Default standard recommendation
        if (list.length === 0) {
            list.push({
                id: 'rec-default',
                title: 'الاستفادة القصوى من دورات الجرد',
                desc: 'مؤشرات الدقة ممتازة ومستقرة تماماً. يُنصح بجدولة الجرد العشوائي (Cycle Counting) مرتين شهرياً للسلع سريعة الدوران (High Velocity Items) لتجنب انقطاع المخزون بالمواسم.',
                type: 'success',
                action: 'جدولة جرد دوري'
            });
        }

        return list;
    }, [pastSessions, warehouseHealthScore, absoluteLosses, pendingReviewCount]);

    return (
        <div className="space-y-6 dir-rtl text-right">
            
            {/* Quick Actions Panel */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-indigo-900/50 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -translate-x-12 -translate-y-12 pointer-events-none" />
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1.5 max-w-xl">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] rounded-full font-black border border-indigo-400/20 uppercase tracking-widest">Advanced Actions</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <h2 className="text-base font-black">أدوات الإدارة والتحكم السريع بالجرد</h2>
                        <p className="text-[11px] text-slate-300 font-medium">ابدأ جلسات الجرد المالي الفوري، أو أصدر كشوف الروابط الخارجية لتتبع أداء موظفي المستودعات.</p>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => {
                                onNavigateTab('hub');
                            }}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/15"
                        >
                            <Play size={13} />
                            إصدار رابط عد خارجي
                        </button>
                        <button 
                            onClick={() => onNavigateTab('variance')}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5"
                        >
                            <AlertTriangle size={13} className="text-amber-400" />
                            تحليل الفروقات الكبرى
                        </button>
                        <button 
                            onClick={() => onNavigateTab('analytics')}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5"
                        >
                            <FileText size={13} className="text-slate-400" />
                            التقارير والمقاصة
                        </button>
                    </div>
                </div>
            </div>

            {/* Bento Grid Executive KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* 1. Warehouse Health Score */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">مؤشر صحة المستودعات</span>
                            <span className="p-1 px-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-lg text-[9px] font-black">Warehouse Health</span>
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                            <div className="text-3xl font-black text-slate-800 dark:text-white">{warehouseHealthScore}%</div>
                            
                            {/* SVG mini circular indicator */}
                            <div className="relative w-10 h-10">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-slate-100 dark:text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className="text-emerald-500" strokeDasharray={`${warehouseHealthScore}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[8px] font-bold text-emerald-600">Health</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-4">
                        {warehouseHealthScore >= 95 ? '✅ المخازن في أعلى مستويات الأمان والدقة.' : '⚠️ رصد ثغرات عجز تتطلب تشديد الرقابة وتعيين عدادين مستقلين.'}
                    </p>
                </div>

                {/* 2. Inventory Accuracy Ratio */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">دقة مطابقة كميات الأرفف</span>
                            <span className="p-1 px-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 rounded-lg text-[9px] font-black">Match Accuracy</span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <Gauge className="text-indigo-650 dark:text-indigo-400 animate-pulse" size={24} />
                            <div className="text-3xl font-black text-slate-800 dark:text-white">{avgAccuracy}%</div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-4">
                        <span>المعيار العالمي: 99%</span>
                        <span className={avgAccuracy >= 95 ? 'text-emerald-500' : 'text-amber-500'}>
                            {avgAccuracy >= 95 ? 'أداء ممتاز دفترياً' : 'تحت الملاحظة لوجستياً'}
                        </span>
                    </div>
                </div>

                {/* 3. Variance Impact (Net & Absolute) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">القيمة الإجمالية للفروقات والتسويات</span>
                            <span className="p-1 px-2 bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 rounded-lg text-[9px] font-black">Net Fiscal Impact</span>
                        </div>
                        <div className="mt-3">
                            <div className={`text-2xl font-black font-sans leading-none ${totalVarianceValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {totalVarianceValue >= 0 ? '+' : ''}{totalVarianceValue.toLocaleString()} <span className="text-xs">ج.م</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold mt-1.5 block">عجز فجائي مطلق: {absoluteLosses.toLocaleString()} ج.م</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => onNavigateTab('variance')}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black text-right underline mt-4 hover:text-indigo-700 transition-colors block"
                    >
                        تحليل ومطابقة الفروقات بالتفصيل ←
                    </button>
                </div>

                {/* 4. Active Field & Submissions Pending */}
                <div className="bg-indigo-650 text-white p-5 rounded-2xl flex flex-col justify-between shadow-lg shadow-indigo-650/10 relative overflow-hidden group hover:brightness-105 transition-all">
                    <Zap className="absolute -bottom-6 -right-6 w-24 h-24 text-white/5 rotate-12" />
                    <div>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black text-indigo-100 uppercase tracking-wider block mb-1">العد الميداني والطلبات الخارجية</span>
                            <span className="p-1 px-2 bg-white/20 text-white rounded-lg text-[9px] font-black">Live Workflows</span>
                        </div>
                        <div className="mt-3 space-y-1">
                            <div className="text-2xl font-black">{pendingReviewCount} بانتظار الاعتماد</div>
                            <p className="text-[10px] text-indigo-200 font-medium leading-relaxed">يوجد {pendingCount} جلسة جرد نشطة أو بانتظار تعبئة كميات الأرفف من الموظفين ميدانياً.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => onNavigateTab('hub')}
                        className="text-[10px] text-white font-black text-right underline mt-4 hover:text-indigo-100 transition-colors block"
                    >
                        اعتماد جرد الموظفين الفعلي والمخازن ←
                    </button>
                </div>
            </div>

            {/* Smart AI Recommendations Panel */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-900/60 dark:to-slate-800/40 p-5 rounded-3xl border border-indigo-100/50 dark:border-indigo-950/40 space-y-3 relative">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={18} />
                    <h3 className="text-xs font-black text-slate-800 dark:text-white">توصيات وملاحظات نظام الجرد والمراقبة الذكي (AI Insight)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {smartRecommendations.map(rec => (
                        <div key={rec.id} className="bg-white dark:bg-slate-900/80 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-2 shadow-sm">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        rec.type === 'critical' ? 'bg-rose-500' :
                                        rec.type === 'warning' ? 'bg-amber-500' :
                                        rec.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'
                                    }`} />
                                    <h4 className="text-[11px] font-black text-slate-800 dark:text-white">{rec.title}</h4>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{rec.desc}</p>
                            </div>
                            <button 
                                onClick={() => {
                                    if (rec.type === 'critical') onNavigateTab('variance');
                                    else if (rec.type === 'action') onNavigateTab('hub');
                                    else onNavigateTab('variance');
                                }}
                                className="text-[9px] text-indigo-600 dark:text-indigo-400 font-black hover:underline text-left block w-full mt-2"
                            >
                                {rec.action} ←
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Graphs & Heatmaps Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Accuracy Trends Chart */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl lg:col-span-2 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white">منحنى دقة المطابقة واستقرار المخزون</h3>
                            <p className="text-[10px] text-slate-400 font-bold">يتتبع جودة المطابقة الفعلية وعلاج السرقات والعجز في الجلسات المتتالية</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">آخر 8 جلسات جرد</span>
                    </div>

                    <div className="h-64 font-sans text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#94a3b8" />
                                <YAxis domain={[80, 100]} tickLine={false} axisLine={false} stroke="#94a3b8" />
                                <Tooltip />
                                <Area type="monotone" dataKey="accuracy" name="نسبة الدقة" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAccuracy)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Variance Heatmap by Warehouse */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                            <LayoutGrid size={16} className="text-indigo-600" />
                            خريطة الخطورة وفروقات المستودعات (Heatmap)
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">تحديد عاجل وسريع للمخازن غير الدقيقة وذات معدلات الهدر والفاقد العالية</p>
                    </div>

                    <div className="space-y-3 my-4">
                        {varianceHeatmapData.map(wh => (
                            <div key={wh.id} className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${wh.colorClass}`}>
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black">{wh.name}</h4>
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold">
                                        <span>فجوات العد: {wh.totalDiscrepancies} صنف</span>
                                        <span>•</span>
                                        <span>القيمة: {wh.totalVarianceValue.toLocaleString()} ج.م</span>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <span className="text-xs font-black font-mono block">{wh.accuracy}% دقة</span>
                                    <span className="text-[8px] font-bold block opacity-80">{wh.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-[10px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl flex items-start gap-1">
                        <Info size={12} className="shrink-0 text-indigo-500 mt-0.5" />
                        <p>اللون الأحمر يشير لمخازن تتطلب فوراً إلزام الموظفين بالعد الأعمى ومطابقة كشوف كاميرات الأرفف.</p>
                    </div>
                </div>
            </div>

            {/* Interactive Section: Live Feed / Activity / Timeline vs Pending list */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Employee Activity Timeline */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4 lg:col-span-2 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                                <Activity className="text-indigo-600" size={16} />
                                سجل العمليات والأنشطة اللوجستية المباشرة (Live Timeline)
                            </h3>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        </div>

                        <div className="mt-4 space-y-4 relative pr-4 border-r border-slate-100 dark:border-slate-800">
                            {employeeActivities.map((act, index) => (
                                <div key={act.id} className="relative group">
                                    {/* Line connector node */}
                                    <div className={`absolute -right-[21px] top-1 w-2.5 h-2.5 rounded-full border bg-white dark:bg-slate-950 transition-colors ${
                                        act.type === 'success' ? 'border-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-950/20' :
                                        act.type === 'info' ? 'border-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-950/20' :
                                        'border-slate-400 ring-4 ring-slate-100 dark:ring-slate-800/20'
                                    }`} />
                                    
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[11px] font-black text-slate-800 dark:text-white">{act.employee}</span>
                                            <span className="text-[9px] text-slate-400 font-bold">{act.time}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">{act.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={() => onNavigateTab('analytics')}
                        className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-all text-center mt-4"
                    >
                        مراجعة سجلات الأرشفة والتقارير المالية الكاملة ←
                    </button>
                </div>

                {/* Pending submissions list */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                                <Clock className="text-amber-500 animate-spin" style={{ animationDuration: '4s' }} size={16} />
                                طلبات الجرد الخارجية المعلقة والمستلمة
                            </h3>
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[9px] font-black">Waiting Approvals</span>
                        </div>

                        {loadingShared ? (
                            <div className="py-12 text-center text-slate-400">
                                <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-2" size={20} />
                                <p className="text-[10px] font-bold">جاري تحديث الجرود السحابية...</p>
                            </div>
                        ) : sharedSessions.filter(s => s.status === 'submitted' || s.status === 'pending').length === 0 ? (
                            <div className="py-12 text-center text-slate-400 space-y-2">
                                <CheckSquare className="mx-auto text-emerald-500" size={32} />
                                <p className="text-xs font-black text-slate-700 dark:text-slate-300">مخازنك مطابقة ولا طلبات متأخرة</p>
                                <p className="text-[10px] text-slate-400 leading-relaxed">كل روابط الجرد الخارجية التي أصدرتها معتمدة تماماً، وأرصدة المستودع معالجة ومسواة مالياً.</p>
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                                {sharedSessions
                                    .filter(s => s.status === 'submitted' || s.status === 'pending')
                                    .slice(0, 4)
                                    .map(session => {
                                        const isSubmitted = session.status === 'submitted';
                                        return (
                                            <div 
                                                key={session.id} 
                                                onClick={() => isSubmitted ? onViewSharedSession(session) : onNavigateTab('hub')}
                                                className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-all flex items-center justify-between"
                                            >
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{session.title}</h4>
                                                    <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold">
                                                        <span>📦 {session.warehouseName || 'مستودع عام'}</span>
                                                        <span>•</span>
                                                        <span>⏱️ {new Date(session.createdAt).toLocaleDateString('ar-EG')}</span>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black shrink-0 ${
                                                    isSubmitted 
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' 
                                                        : 'bg-indigo-50 text-indigo-650 dark:bg-indigo-950/20 dark:text-indigo-400'
                                                }`}>
                                                    {isSubmitted ? '📝 جاهز للمراجعة' : '⏳ جاري العد الميداني'}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => onNavigateTab('hub')}
                        className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 rounded-xl text-xs font-black transition-all text-center mt-4"
                    >
                        فتح لوحة الجرد المشترك والروابط الميدانية ←
                    </button>
                </div>
            </div>

            {/* Past Audit History List & Quick Overview */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">سجلات ومحاضر ترحيل الجرد والتسوية المالية الأخيرة</h3>
                        <p className="text-[10px] text-slate-400 font-bold">سجل تاريخي لإثبات دقة الجرود الأخيرة وحالة المخازن المعتمدة على السحابة</p>
                    </div>
                    <button 
                        onClick={() => onNavigateTab('analytics')}
                        className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                        سجل التقارير والتحليلات الكلي ←
                    </button>
                </div>

                {pastSessions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <Package className="mx-auto text-slate-300 opacity-20 mb-2" size={40} />
                        <p className="text-xs font-black">لا توجد جلسات جرد سابقة معتمدة حالياً على السيستم</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {pastSessions.slice(0, 4).map(session => {
                            const isNetLoss = session.totalVarianceValue < 0;
                            return (
                                <div 
                                    key={session.id} 
                                    onClick={() => onViewPastSession(session)}
                                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/10 px-2 rounded-xl transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60 text-slate-500">
                                            <Calendar size={16} />
                                        </div>
                                        <div className="space-y-0.5">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-white">{session.title}</h4>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                <span className="flex items-center gap-1"><User size={10} /> {session.performedBy}</span>
                                                <span>•</span>
                                                <span>📦 تم جرد {session.totalItemsAudited} صنف</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-left sm:text-right">
                                        <div className="space-y-0.5">
                                            <span className={`text-xs font-black font-sans block ${isNetLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {session.totalVarianceValue >= 0 ? '+' : ''}{session.totalVarianceValue.toLocaleString()} ج.م
                                            </span>
                                            <span className="text-[9px] text-slate-400 block font-bold">فارق: {session.totalVarianceQty > 0 ? '+' : ''}{session.totalVarianceQty} قطعة</span>
                                        </div>
                                        <ArrowRight size={14} className="text-slate-300 rotate-180 hidden sm:block" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
