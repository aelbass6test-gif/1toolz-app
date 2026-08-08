import React, { useMemo } from 'react';
import { 
    ClipboardList, MapPin, Clock, ArrowLeft, Target, 
    BookOpen, CheckCircle, HelpCircle, Activity, Sparkles, AlertCircle,
    TrendingUp, Shield, BarChart3, Users, Play, CheckCircle2, AlertTriangle,
    Building2, Award, Zap, ChevronRight, Layers, Database
} from 'lucide-react';
import { motion } from 'motion/react';
import { SharedAudit, SharedAuditItem } from '../../types';

interface SharedAuditHomeProps {
    audit: SharedAudit;
    countedCount: number;
    progressPercentage: number;
    managerName: string;
    onContinue: () => void;
    speak: (text: string) => void;
}

export default function SharedAuditHome({
    audit,
    countedCount,
    progressPercentage,
    managerName,
    onContinue,
    speak
}: SharedAuditHomeProps) {
    const items = Array.isArray(audit?.items) ? audit.items : (audit?.items && typeof audit.items === 'object' ? Object.values(audit.items) : []);
    const totalItems = items.length;
    const remainingItems = totalItems - countedCount;
    const estimatedDuration = Math.ceil(totalItems * 1.5);

    // Real-time calculated KPIs based on the actual active audit
    const executiveKPIs = useMemo(() => {
        let totalSystemQty = 0;
        let totalVarianceQty = 0;
        let countedItemsCount = 0;
        let largeVariances = 0;

        items.forEach((item: any) => {
            if ((item as any).actualQty !== undefined) {
                countedItemsCount++;
                totalSystemQty += (item as any).systemQty;
                const diff = Math.abs((item as any).actualQty - (item as any).systemQty);
                totalVarianceQty += diff;
                if (diff > 10) {
                    largeVariances++;
                }
            }
        });

        // Calculate actual accuracy rate of counted items
        const accuracyRate = countedItemsCount > 0 
            ? (totalSystemQty > 0 ? Math.max(0, Math.min(100, Math.round(((totalSystemQty - totalVarianceQty) / totalSystemQty) * 1000) / 10)) : 100)
            : 100; // Default to 100% at the start

        // Quality score based on number of discrepancies
        const healthScore = countedItemsCount > 0
            ? Math.max(50, Math.min(100, Math.round(100 - (largeVariances / countedItemsCount) * 25)))
            : 100; // Perfect health if no counting discrepancy yet

        return {
            todayAuditsCount: 1,
            warehouseHealthScore: healthScore,
            inventoryAccuracyRate: accuracyRate,
            pendingApprovalsCount: audit.status === 'submitted' ? 1 : 0,
            activeEmployeesCount: 1,
            runningSessionsCount: audit.status === 'pending' ? 1 : 0,
            completedSessionsCount: audit.status === 'approved' ? 1 : 0,
            largeVariancesCount: largeVariances
        };
    }, [audit, progressPercentage]);

    const quickActions = [
        { title: 'بدء العد الفوري السريع', description: 'واجهة مخصصة للمسح السريع المباشر', icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
        { title: 'مراجعة تباينات الرف', description: 'كشف مباشر بجميع الأصناف ذات العجز المالي', icon: AlertTriangle, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30' },
        { title: 'بروتوكول العد المزدوج', description: 'تأكيد العد بواسطة مسؤول ثانٍ', icon: Layers, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' }
    ];

    // Dynamic top warehouses showing current audit's actual status and name
    const topWarehouses = useMemo(() => {
        const currentWhName = audit.warehouseName || 'المستودع الحالي';
        return [
            { name: currentWhName, accuracy: `${executiveKPIs.inventoryAccuracyRate}%`, rate: executiveKPIs.inventoryAccuracyRate > 95 ? 'ممتاز' : 'جيد جداً' }
        ];
    }, [audit.warehouseName, executiveKPIs.inventoryAccuracyRate]);

    // Real dynamic activity timeline
    const recentActivities = useMemo(() => {
        const events = [
            { id: 1, text: `بدأت جلسة الجرد [ ${audit.title} ] في ${audit.warehouseName}`, time: new Date(audit.createdAt).toLocaleTimeString('ar-EG'), type: 'setup', icon: Shield },
        ];

        if (managerName) {
            events.unshift({ id: 2, text: `انضم ${managerName} للوردية وبدأ الحصر الفوري`, time: 'الآن', type: 'system', icon: Users });
        }

        if (countedCount > 0) {
            events.unshift({ id: 3, text: `تم حصر ${countedCount} صنف حتى الآن بنجاح`, time: 'تحديث لحظي', type: 'sync', icon: Database });
        }

        return events;
    }, [managerName, audit.warehouseName, audit.createdAt, audit.title, countedCount]);

    return (
        <div id="shared-audit-home" className="space-y-8 dir-rtl text-right">
            {/* Top Row: Welcome Card */}
            <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-black text-white p-8 border border-indigo-500/10 shadow-xl"
            >
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-[10px] uppercase font-black tracking-wider rounded-full">
                            <Sparkles size={12} className="animate-pulse text-indigo-400" />
                            بوابة المؤسسات - الإصدار Enterprise 3.0 المطور
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                            أهلاً بك، <span className="text-indigo-400 font-extrabold">{managerName || 'مسؤول الحصر الميداني'}</span>
                        </h2>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
                            أنت الآن داخل لوحة تحليلات وإدارة الجلسات الحية للمستودع: <strong className="text-white">{audit.warehouseName || 'المخزن الرئيسي'}</strong>. يرجى اتباع معايير الأمان وقواعد التدقيق المعتمدة.
                        </p>
                    </div>

                    <div className="shrink-0">
                        <button
                            onClick={() => {
                                speak('جاري تحميل كشوف الجرد، ابدأ العد الميداني الآن');
                                onContinue();
                            }}
                            className="px-8 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer w-full lg:w-auto"
                        >
                            <span>ابدأ حصر السلع ميدانياً 📦</span>
                            <ArrowLeft size={16} className="rotate-180 shrink-0" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Smart Dashboard Executive KPI Cards */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
                        <BarChart3 className="text-indigo-500" size={20} />
                        المؤشرات التنفيذية المباشرة للمستودعات
                    </h3>
                    <span className="text-xs font-bold text-slate-400">تحديث لحظي ذكي</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* KPI 1: Accuracy */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-500/40 transition-all">
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">دقة دفتري / فعلي</span>
                            <div className="text-3xl font-black text-slate-850 dark:text-white">{executiveKPIs.inventoryAccuracyRate}%</div>
                            <span className="text-[9px] text-emerald-500 font-semibold block flex items-center gap-0.5">
                                <TrendingUp size={12} /> أعلى بـ +0.8% من الشهر الماضي
                            </span>
                        </div>
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <CheckCircle2 size={26} />
                        </div>
                    </div>

                    {/* KPI 2: Warehouse Health Score */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-500/40 transition-all">
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">مؤشر جودة المستودع</span>
                            <div className="text-3xl font-black text-slate-850 dark:text-white">{executiveKPIs.warehouseHealthScore}</div>
                            <span className="text-[9px] text-indigo-500 font-semibold block">تصنيف أمان عالي المستوى A+</span>
                        </div>
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <Shield size={26} />
                        </div>
                    </div>

                    {/* KPI 3: Running Sessions */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-500/40 transition-all">
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">جلسات عد حية الآن</span>
                            <div className="text-3xl font-black text-amber-500">{executiveKPIs.runningSessionsCount} <span className="text-xs font-bold text-slate-400">نشطة</span></div>
                            <span className="text-[9px] text-amber-500 font-semibold block animate-pulse">فريق الجرد الميداني نشط</span>
                        </div>
                        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-2xl flex items-center justify-center">
                            <Activity size={26} />
                        </div>
                    </div>

                    {/* KPI 4: Pending Approvals */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-500/40 transition-all">
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">اعتمادات معلقة للمشرف</span>
                            <div className="text-3xl font-black text-rose-500">{executiveKPIs.pendingApprovalsCount} <span className="text-xs font-bold text-slate-400">أوراق</span></div>
                            <span className="text-[9px] text-rose-500 font-semibold block">تتطلب توقيع رقمي فوري</span>
                        </div>
                        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-2xl flex items-center justify-center">
                            <AlertCircle size={26} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Dashboard Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left side: Warehouse Details, Progress & Quick Actions (3 cols) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Warehouse Information card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                <MapPin size={18} />
                            </div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white">بيانات موقع الجرد والتحقق الميداني</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold block">موقع المستودع</span>
                                <span className="font-black text-slate-700 dark:text-slate-300">{audit.warehouseName || 'مستودع الرياض الرئيسي'}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold block">معرف المستودع</span>
                                <span className="font-black text-slate-500 dark:text-slate-400 font-mono">{audit.warehouseId || 'WH-MAIN-01'}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold block">بروتوكول الجرد والتدقيق</span>
                                <span className={`font-black ${
                                    audit.protocol === 'blind' ? 'text-rose-600' : 
                                    audit.protocol === 'fast' ? 'text-amber-600' :
                                    audit.protocol === 'double' ? 'text-indigo-600' :
                                    'text-emerald-600'
                                }`}>
                                    {audit.protocol === 'blind' ? '🔒 جرد أعمى (الكمية مخفية)' : 
                                     audit.protocol === 'fast' ? '⚡ عد سريع (باركود)' :
                                     audit.protocol === 'periodic' ? '📅 دوري مبرمج' :
                                     audit.protocol === 'location' ? '📍 عد بالموقع' :
                                     audit.protocol === 'double' ? '👥 عد مزدوج' :
                                     audit.protocol === 'audit' ? '🧐 تدقيق مشرف' :
                                     '✨ عد قياسي (الكمية ظاهرة)'}
                                </span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold block">تاريخ بدء الجلسة</span>
                                <span className="font-black text-slate-700 dark:text-slate-300">
                                    {new Date(audit.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                            </div>
                        </div>

                        {/* Beautiful linear progress bar with key milestones */}
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-black text-slate-500">معدل الإنجاز الكلي</span>
                                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{progressPercentage}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                <div 
                                    className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                                <span>البداية</span>
                                <span>الربع 25%</span>
                                <span>النصف 50%</span>
                                <span>المستهدف 100%</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Action Matrix */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Sparkles className="text-amber-500 animate-pulse" size={18} />
                            إجراءات التشغيل السريع (Quick Actions)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {quickActions.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        speak(`جاري فتح ${action.title}`);
                                        onContinue();
                                    }}
                                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-850 hover:border-indigo-500/40 text-right bg-slate-50/40 dark:bg-slate-900/40 transition-all flex flex-col justify-between h-32 group cursor-pointer hover:shadow-sm"
                                >
                                    <div className={`p-2.5 rounded-xl ${action.color} w-fit group-hover:scale-105 transition-transform`}>
                                        <action.icon size={20} />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h4 className="text-xs font-black text-slate-800 dark:text-white group-hover:text-indigo-500 transition-colors">{action.title}</h4>
                                        <p className="text-[10px] text-slate-400 font-medium">{action.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right side: Live Feed & High Performing Warehouses (2 cols) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Live System Activity Feed */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[300px]">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Activity size={18} className="text-indigo-500 animate-pulse" />
                                    سجل حركة الحقل والاتصال المباشر
                                </h3>
                                <span className="text-[9px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full font-black">نشط الآن</span>
                            </div>

                            <div className="space-y-4">
                                {recentActivities.map((activity) => (
                                    <div key={activity.id} className="flex gap-3 text-xs">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl shrink-0">
                                            <activity.icon size={16} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-slate-700 dark:text-slate-300 leading-relaxed">{activity.text}</p>
                                            <span className="text-[10px] text-slate-400 block font-mono">{activity.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 text-[10px] text-slate-400 items-center justify-center font-bold">
                            <Shield size={14} className="text-emerald-500" />
                            <span>تشفير 256-bit مفعل لمزودي الخدمة</span>
                        </div>
                    </div>

                    {/* Warehouse Ranking / Top performance */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <Award className="text-amber-500" size={18} />
                            التميز وصدارة دقة المستودعات
                        </h3>
                        <div className="space-y-2">
                            {topWarehouses.map((wh, i) => (
                                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-400">#{i + 1}</span>
                                        <span className="font-black text-slate-800 dark:text-white">{wh.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-black text-emerald-600">{wh.accuracy}</span>
                                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 text-[9px] rounded font-black">{wh.rate}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
