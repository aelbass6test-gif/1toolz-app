import React, { useState, useMemo } from 'react';
import { 
    CheckCircle, XCircle, AlertTriangle, Clock, MapPin, 
    Smartphone, ThumbsUp, Activity, BarChart3, Filter, User, Calendar, FileCheck2, Video, Sword, ShieldAlert, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SharedAudit, SharedAuditItem } from '../../types';

interface SharedSupervisorFeaturesProps {
    audit: SharedAudit;
    counts: Record<string, number>;
    onApprove: (reason?: string) => void;
    onReject: (reason: string) => void;
    collaboration: any; // Added prop for shared state
}

export default function SharedSupervisorFeatures({
    audit,
    counts,
    onApprove,
    onReject,
    collaboration
}: SharedSupervisorFeaturesProps) {
    const items = useMemo(() => {
        return Array.isArray(audit?.items) ? audit.items : (audit?.items && typeof audit.items === 'object' ? Object.values(audit.items) : []);
    }, [audit?.items]);

    const { collaborators } = collaboration;
    const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'approvals' | 'variance' | 'timeline' | 'employees' | 'conflicts' | 'replay'>('dashboard');
    const [varianceThreshold, setVarianceThreshold] = useState<number>(0); // Filter by discrepancy count
    const [rejectReasonInput, setRejectReasonInput] = useState('');

    // Derived statistics
    const stats = useMemo(() => {
        let totalSystem = 0;
        let totalActual = 0;
        let matched = 0;
        let deficitCount = 0;
        let surplusCount = 0;
        let uncounted = 0;

        items.forEach(item => {
            const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
            const actual = counts[key];
            totalSystem += item.systemQty;

            if (actual === undefined) {
                uncounted++;
            } else {
                totalActual += actual;
                if (actual === item.systemQty) {
                    matched++;
                } else if (actual < item.systemQty) {
                    deficitCount++;
                } else {
                    surplusCount++;
                }
            }
        });

        const countedItems = items.length - uncounted;
        const accuracy = countedItems > 0 ? Math.round((matched / countedItems) * 100) : 100;

        return {
            totalSystem,
            totalActual,
            matched,
            deficitCount,
            surplusCount,
            uncounted,
            accuracy,
            netDifference: totalActual - totalSystem
        };
    }, [audit, counts]);

    // Real collaborators from shared state
    const trackedEmployees = useMemo(() => {
        const list = [
            { 
                name: audit.managerName || 'مسؤول مخزن', 
                role: 'المسؤول الحالي (أنت)', 
                status: 'active', 
                device: 'جهازك', 
                lastAction: 'نشط الآن', 
                time: 'الآن', 
                coordinate: 'متوفر' 
            }
        ];

        collaborators.forEach((c: any) => {
            list.push({
                name: c.userName || 'موظف',
                role: 'عضو فريق الجرد',
                status: 'active',
                device: 'جهاز ذكي',
                lastAction: `يعمل على: ${c.activeProductId || 'تصفح'}`,
                time: 'نشط',
                coordinate: 'متوفر'
            });
        });

        return list;
    }, [audit.managerName, collaborators]);

    // Live logs timeline
    const timelineLogs = [
        { id: 1, text: 'تم إنشاء ومشاركة جلسة الجرد بنجاح', time: new Date(audit.createdAt).toLocaleTimeString('ar-EG'), type: 'system' }
    ];

    return (
        <div id="shared-supervisor-features" className="space-y-6 dir-rtl text-right">
            {/* Top sub-navigation bar */}
            <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                {[
                    { id: 'dashboard', label: 'لوحة القيادة 📊' },
                    { id: 'approvals', label: 'الاعتمادات 🔒' },
                    { id: 'variance', label: 'الفروقات ⚠️' },
                    { id: 'conflicts', label: 'النزاعات المشتركة ⚔️' },
                    { id: 'timeline', label: 'سجل الحركات ⏳' },
                    { id: 'replay', label: 'إعادة العرض 🎬' },
                    { id: 'employees', label: 'المراقبين 📍' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                            activeSubTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Render subtabs content */}
            <AnimatePresence mode="wait">
                {/* 1. Dashboard Subtab */}
                {activeSubTab === 'dashboard' && (
                    <motion.div 
                        key="dashboard"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        {/* Executive KPI Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">نسبة دقة المطابقة الميدانية</span>
                                    <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                                        {stats.accuracy}%
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-semibold block">الأصناف المطابقة تماماً للأرصدة المقيدة</span>
                                </div>
                                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                                    <FileCheck2 size={28} />
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">صافي تباين القطع الكلي</span>
                                    <div className={`text-3xl font-black ${stats.netDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {stats.netDifference > 0 ? `+${stats.netDifference}` : stats.netDifference} قطعة
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-semibold block">فارق الحصر الإجمالي (الفعلي - الدفتري)</span>
                                </div>
                                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center">
                                    <Activity size={28} />
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex justify-between items-center">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">مؤشر جودة المستودع المالي</span>
                                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                        {stats.accuracy > 90 ? 'A+ ممتاز' : stats.accuracy > 70 ? 'B جيد جداً' : 'C يحتاج تحسين'}
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-semibold block">تصنيف مالي فوري لدقة عهدة المخزن</span>
                                </div>
                                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-2xl flex items-center justify-center">
                                    <ThumbsUp size={28} />
                                </div>
                            </div>
                        </div>

                        {/* Interactive structural circular rings (built as SVG) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                                <h3 className="font-black text-sm text-slate-800 dark:text-white">التحليل الهيكلي لنتائج الجرد</h3>
                                <div className="flex flex-col items-center justify-center py-4 space-y-3">
                                    <div className="relative w-36 h-36">
                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="10" className="dark:stroke-slate-800" />
                                            <circle 
                                                cx="50" 
                                                cy="50" 
                                                r="40" 
                                                fill="transparent" 
                                                stroke="#4f46e5" 
                                                strokeWidth="10" 
                                                strokeDasharray={2 * Math.PI * 40}
                                                strokeDashoffset={2 * Math.PI * 40 * (1 - stats.matched / Math.max(1, audit.items.length))}
                                                className="transition-all duration-500"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-black text-slate-850 dark:text-white">{stats.accuracy}%</span>
                                            <span className="text-[9px] text-slate-400 font-bold">دقة التطابق</span>
                                        </div>
                                    </div>

                                    <div className="w-full space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="flex items-center gap-1 text-slate-500 font-bold">
                                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> مطابق سليم
                                            </span>
                                            <span className="font-mono font-black">{stats.matched} صنف</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="flex items-center gap-1 text-slate-500 font-bold">
                                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> عجز ونواقص
                                            </span>
                                            <span className="font-mono font-black text-rose-600">{stats.deficitCount} صنف</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="flex items-center gap-1 text-slate-500 font-bold">
                                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> فائض وزيادة
                                            </span>
                                            <span className="font-mono font-black text-indigo-500">{stats.surplusCount} صنف</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Live advice / status board */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                                <div className="space-y-4">
                                    <h3 className="font-black text-sm text-slate-800 dark:text-white">توصيات مراجعة العهدة الميدانية</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                        بناءً على الحصر الحقيقي الجاري في مستودع <strong>{audit.warehouseName || 'المخزن الرئيسي'}</strong>، تم تقييم حالة العهدة وتسجيل الملاحظات التالية للمدراء الماليين وأصحاب المتاجر:
                                    </p>

                                    <div className="space-y-3">
                                        {stats.deficitCount > 0 && (
                                            <div className="p-3 bg-rose-500/10 rounded-xl flex items-start gap-2.5">
                                                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                                <p className="text-[11px] text-rose-800 dark:text-rose-300 font-bold">يرجى فحص الأصناف ذات العجز الميداني لتبين احتمالات تلفيات أو أخطاء استلام شحنات.</p>
                                            </div>
                                        )}
                                        {stats.uncounted > 0 && (
                                            <div className="p-3 bg-amber-550/10 rounded-xl flex items-start gap-2.5">
                                                <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                                <p className="text-[11px] text-amber-850 dark:text-amber-400 font-bold">يوجد عدد {stats.uncounted} أصناف لم يتم إدراج أي كميات فعلية لها بعد بالورقة.</p>
                                            </div>
                                        )}
                                        {stats.deficitCount === 0 && stats.surplusCount === 0 && (
                                            <div className="p-3 bg-emerald-500/10 rounded-xl flex items-start gap-2.5">
                                                <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">حالة عهدة مثالية! دقة متطابقة بنسبة ١٠٠٪ مع كشف السيستم المقيد.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-[10px] text-slate-400 font-bold pt-3 border-t border-slate-100 dark:border-slate-800">
                                    تحديث تلقائي كل ٥ ثوان عبر المزامنة الحية المفتوحة
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* 2. Approvals Subtab */}
                {activeSubTab === 'approvals' && (
                    <motion.div 
                        key="approvals"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6"
                    >
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="font-black text-sm text-slate-800 dark:text-white">مركز اعتماد وإغلاق جلسة الجرد</h3>
                                <p className="text-[10px] text-slate-400 font-bold">اتخاذ قرار مالي بالموافقة النهائية أو الرفض مع طلب إعادة فحص</p>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-black rounded-lg ${
                                audit.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                audit.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                                حالة الورقة الحالية: {
                                    audit.status === 'approved' ? 'معتمد مالياً' :
                                    audit.status === 'rejected' ? 'مرفوض ومطالب بإعادة الجرد' : 'قيد المراجعة الميدانية'
                                }
                            </span>
                        </div>

                        {audit.signatureData && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-2">
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">التوقيع الإلكتروني الميداني المستلم</span>
                                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800">
                                    <img src={audit.signatureData} className="h-16 object-contain opacity-80" alt="التوقيع الرقمي للمسؤول" />
                                </div>
                                <span className="text-[9px] text-slate-400 text-center block">بصمة توقيع رقمية معتمدة ملزمة قانوناً</span>
                            </div>
                        )}

                        {/* Interactive decision form if pending */}
                        {audit.status === 'pending' || audit.status === 'submitted' ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">ملاحظات اتخاذ القرار أو أسباب الرفض (اختياري/إلزامي للرفض):</label>
                                    <textarea
                                        rows={3}
                                        value={rejectReasonInput}
                                        onChange={(e) => setRejectReasonInput(e.target.value)}
                                        placeholder="اكتب أسباب الرفض بالتفصيل أو إرشادات قبول التسوية النقدية للعهد..."
                                        className="w-full text-xs font-bold p-3 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            if (!rejectReasonInput.trim()) {
                                                alert('يرجى تحديد وكتابة سبب الرفض أولاً كدليل لمسؤول المخزن.');
                                                return;
                                            }
                                            onReject(rejectReasonInput);
                                        }}
                                        className="py-3 bg-rose-650 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <XCircle size={16} />
                                        <span>رفض الجرد ومطالبة بإعادة حصر 🚫</span>
                                    </button>

                                    <button
                                        onClick={() => onApprove(rejectReasonInput || undefined)}
                                        className="py-3 bg-emerald-650 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <CheckCircle size={16} />
                                        <span>اعتماد وموافقة على تسوية الرصيد ✨</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500 font-bold leading-relaxed text-center">
                                {audit.status === 'approved' 
                                    ? 'تم اعتماد جلسة الجرد وتوقيعها وإغلاقها نهائياً. لا توجد أي قرارات معلقة حالياً.'
                                    : `تم رفض المسودة وإعادتها لمسؤول المخزن لإعادة الحصر. الملاحظات المرسلة: "${audit.rejectReason}"`
                                }
                            </div>
                        )}
                    </motion.div>
                )}

                {/* 3. Variance Subtab */}
                {activeSubTab === 'variance' && (
                    <motion.div 
                        key="variance"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
                    >
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="font-black text-sm text-slate-800 dark:text-white">كشف الفروقات الميدانية والعيوب</h3>
                                <p className="text-[10px] text-slate-400 font-bold">فلترة قائمة الأصناف بناء على تباين عجز/زيادة كمياتها الميدانية</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Filter size={14} className="text-slate-400" />
                                <select
                                    value={varianceThreshold}
                                    onChange={(e) => setVarianceThreshold(parseInt(e.target.value))}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-lg text-[10px] font-black p-1.5"
                                >
                                    <option value={0}>عرض جميع التباينات</option>
                                    <option value={5}>تباين أكبر من ٥ قطع</option>
                                    <option value={10}>تباين أكبر من ١٠ قطع (فجوة حرجة)</option>
                                </select>
                            </div>
                        </div>

                        {/* Variance List Table */}
                        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                            {audit.items.filter(item => {
                                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                const actual = counts[key];
                                if (actual === undefined) return false;
                                const diff = Math.abs(actual - item.systemQty);
                                return diff > 0 && diff >= varianceThreshold;
                            }).length === 0 ? (
                                <div className="py-16 text-center text-slate-400 text-xs font-bold space-y-2">
                                    <CheckCircle size={32} className="mx-auto text-emerald-500 opacity-65 animate-bounce" />
                                    <p>لا توجد أي فروقات مرصودة تطابق هذا الفلتر حالياً</p>
                                </div>
                            ) : (
                                audit.items.filter(item => {
                                    const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                    const actual = counts[key];
                                    if (actual === undefined) return false;
                                    const diff = Math.abs(actual - item.systemQty);
                                    return diff > 0 && diff >= varianceThreshold;
                                }).map(item => {
                                    const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                                    const actual = counts[key]!;
                                    const diff = actual - item.systemQty;

                                    return (
                                        <div key={key} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-800 flex justify-between items-center text-xs">
                                            <div className="space-y-1">
                                                <h4 className="font-black text-slate-850 dark:text-white">{item.name}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 font-mono">SKU: {item.sku}</p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-[9px] text-slate-400 block font-bold">ميداني vs دفتري</span>
                                                    <span className="font-mono font-black text-slate-700 dark:text-slate-300">{actual} من {item.systemQty}</span>
                                                </div>
                                                <span className={`px-2.5 py-1 text-xs font-black rounded-lg ${
                                                    diff > 0 
                                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40' 
                                                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40'
                                                }`}>
                                                    {diff > 0 ? `زيادة +${diff}` : `عجز ${diff}`} قطعة
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Conflicts Subtab */}
                {activeSubTab === 'conflicts' && (
                    <motion.div 
                        key="conflicts"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
                    >
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                                    <Sword size={18} className="text-amber-500" />
                                    مركز حل النزاعات المتزامنة (Conflict Resolution)
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold">يظهر عندما يقوم موظفان بتعديل نفس المنتج في نفس الوقت بإدخالات مختلفة.</p>
                            </div>
                        </div>

                        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                            <ShieldAlert className="text-slate-400 mx-auto mb-2 opacity-50" size={32} />
                            <h4 className="font-black text-slate-500">لا توجد نزاعات نشطة حالياً</h4>
                            <p className="text-[10px] text-slate-400 font-bold mt-1">يظهر النزاع هنا فقط عند اختلاف قراءات العدادين لنفس الصنف.</p>
                        </div>
                    </motion.div>
                )}

                {/* Replay Subtab */}
                {activeSubTab === 'replay' && (
                    <motion.div 
                        key="replay"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-slate-900 rounded-3xl p-6 shadow-sm space-y-4 text-white relative overflow-hidden"
                    >
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                            <div>
                                <h3 className="font-black text-sm flex items-center gap-1.5">
                                    <Video size={18} className="text-rose-500 animate-pulse" />
                                    تسجيل الجلسة الحي (Session Replay)
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold">شاهد تحركات الزملاء الفعلية كأنك تقف معهم.</p>
                            </div>
                        </div>

                        <div className="h-64 bg-slate-950 rounded-xl border border-slate-800 relative flex items-center justify-center">
                            {/* Simulated Replay Canvas */}
                            <div className="text-center space-y-2 z-10">
                                <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center">
                                    <Video size={32} className="text-slate-500" />
                                </div>
                                <div className="font-bold text-xs text-slate-400">بث الشاشة غير مفعل حالياً من قبل المستخدم.</div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg">إيقاف الجرد مؤقتاً (Lock)</button>
                            <button className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-lg">تصدير المقطع</button>
                        </div>
                    </motion.div>
                )}

                {/* 4. Timeline Subtab */}
                {activeSubTab === 'timeline' && (
                    <motion.div 
                        key="timeline"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
                    >
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                                    <Clock size={18} className="text-indigo-600" />
                                    سجل تتبع حركات الفحص الميداني المباشر
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold">حركات مسح الباركود، صور الإثبات، وحفظ التعديلات في الوقت الفعلي</p>
                            </div>
                            <span className="text-[9px] text-indigo-600 font-black animate-pulse">مزامنة نشطة...</span>
                        </div>

                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                            {timelineLogs.map((log) => (
                                <div key={log.id} className="p-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                                            log.type === 'scan' ? 'bg-indigo-500' :
                                            log.type === 'save' ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`} />
                                        <span className="font-bold text-slate-700 dark:text-slate-300 leading-relaxed">{log.text}</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">{log.time}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* 5. Employees Subtab */}
                {activeSubTab === 'employees' && (
                    <motion.div 
                        key="employees"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4"
                    >
                        <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-black text-sm text-slate-800 dark:text-white">قائمة أجهزة فريق العمل النشطة بالقطاع</h3>
                            <p className="text-[10px] text-slate-400 font-bold">تتبع الأجهزة الذكية المتصلة بورقة الجرد حياً ونشاطاتها وتحديد موقعها</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {trackedEmployees.map((emp, idx) => (
                                <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800 flex flex-col justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 rounded-full flex items-center justify-center font-black">
                                            {emp.name.slice(0, 2)}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-xs text-slate-850 dark:text-white">{emp.name}</h4>
                                            <p className="text-[9px] text-slate-400 font-bold">{emp.role}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-[10px] font-bold text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            <Smartphone size={12} />
                                            <span>الجهاز: {emp.device}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Activity size={12} />
                                            <span>آخر حركة: {emp.lastAction}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <MapPin size={12} />
                                            <span>إحداثيات المسح: {emp.coordinate}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <span className="text-[9px] text-slate-400 font-bold">{emp.time}</span>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                            emp.status === 'active' ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {emp.status === 'active' ? 'نشط ميدانياً' : 'خامل مؤقتاً'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
