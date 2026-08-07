import React from 'react';
import { 
    AlertCircle, AlertTriangle, Sparkles, ClipboardList, CheckCircle, 
    Wifi, WifiOff, FileText, X
} from 'lucide-react';
import { motion } from 'motion/react';
import { SharedAudit, SharedAuditItem } from '../../types';

interface SharedNotificationCenterProps {
    audit: SharedAudit;
    counts: Record<string, number>;
    isOnline: boolean;
    onGoToCounting: () => void;
}

export default function SharedNotificationCenter({
    audit,
    counts,
    isOnline,
    onGoToCounting
}: SharedNotificationCenterProps) {
    const items = useMemo(() => {
        return Array.isArray(audit?.items) ? audit.items : (audit?.items && typeof audit.items === 'object' ? Object.values(audit.items) : []);
    }, [audit?.items]);

    const totalItems = items.length;
    
    const countedCount = items.filter(item => {
        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
        return counts[key] !== undefined;
    }).length;

    const criticalDiscrepancyItems = items.filter(item => {
        const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
        const val = counts[key];
        if (val === undefined) return false;
        
        // Discrepancy deviation > 30% or critical shortage
        const deviationRatio = Math.abs(val - item.systemQty) / Math.max(1, item.systemQty);
        return deviationRatio >= 0.3 && val !== item.systemQty;
    });

    return (
        <div id="shared-notification-center" className="space-y-4 dir-rtl text-right">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-slate-800 dark:text-white">مركز التنبيهات وإشعارات الحصر المالي</h3>
                            <p className="text-[10px] text-slate-400 font-bold">تنبيهات فورية مبنية على جودة الفحص والعد الميداني الجاري</p>
                        </div>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg">قناة حية نشطة ⚡</span>
                </div>

                <div className="mt-6 space-y-4">
                    {/* 1. Sync & Offline/Online Status Notification */}
                    {isOnline ? (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-200/40 rounded-2xl flex items-start gap-3">
                            <Wifi className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                            <div className="space-y-1">
                                <h4 className="font-black text-emerald-800 dark:text-emerald-400 text-xs">اتصال آمن ومزامنة سحابية نشطة</h4>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                    تم استكمال مزامنة جميع المسودات بنجاح مع السيرفر الرئيسي. بياناتك مؤمنة ويمكن للمشرف رؤيتها أولاً بأول.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-amber-500/10 border border-amber-200/40 rounded-2xl flex items-start gap-3 animate-pulse">
                            <WifiOff className="text-amber-600 shrink-0 mt-0.5" size={18} />
                            <div className="space-y-1">
                                <h4 className="font-black text-amber-800 dark:text-amber-400 text-xs">وضع العمل دون اتصال نشط (مؤمن ومحلي)</h4>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                    أنت تعمل حالياً دون إنترنت. لا تقلق، سيتم حفظ ومطابقة جميع الحركات في الذاكرة المحلية للجهاز وإرسالها بمجرد عودة الاتصال.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 2. Rejection / Supervisor action alerts */}
                    {audit.status === 'rejected' && (
                        <div className="p-4 bg-rose-500/10 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-start gap-3">
                            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                            <div className="space-y-1">
                                <h4 className="font-black text-rose-800 dark:text-rose-300 text-xs">⚠️ عاجل: تم رفض الجرد بواسطة المشرف/التاجر</h4>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                                    السبب: "{audit.rejectReason || 'توجد فروقات كبيرة غير منطقية في بعض الأصناف الميدانية.'}"
                                </p>
                                <span className="text-[9.5px] text-rose-500 font-black block mt-1">يرجى الضغط على المنتجات وإعادة العد والتأكد للتسوية.</span>
                            </div>
                        </div>
                    )}

                    {/* 3. High discrepancy alarm notification (deviation > 30%) */}
                    {criticalDiscrepancyItems.length > 0 && (
                        <div className="p-4 bg-rose-500/10 border border-rose-200/40 rounded-2xl flex items-start gap-3">
                            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                            <div className="space-y-1">
                                <h4 className="font-black text-rose-800 dark:text-rose-400 text-xs">تنبيه فارق حاد وتغير عالي في الكميات ({criticalDiscrepancyItems.length} صنف)</h4>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                    تم الكشف عن تباين ميداني حرج يفوق ٣٠٪ بين كشف الكمية الفعلي وما هو مسجل بالدفتر. نوصي بتدقيق الحصر للأصناف الموضحة باللون الأحمر:
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {criticalDiscrepancyItems.slice(0, 4).map(item => (
                                        <span key={item.productId} className="px-2 py-0.5 bg-rose-200/40 text-rose-700 dark:text-rose-300 text-[10px] rounded font-black">
                                            {item.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Complete / Uncomplete alert progress */}
                    {totalItems - countedCount > 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-start gap-3">
                            <ClipboardList className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                            <div className="space-y-1">
                                <h4 className="font-black text-slate-850 dark:text-white text-xs">📋 تذكير: متبقي {totalItems - countedCount} سلع لم تجرد</h4>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                    لم نتمكن من العثور على قيم مدخلة لـ {totalItems - countedCount} أصناف من كشف الجرد. يرجى الضغط هنا للتصفية السريعة والانتهاء منها.
                                </p>
                                <button 
                                    onClick={onGoToCounting}
                                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 underline block mt-1"
                                >
                                    اضغط للانتقال إلى واجهة العد وحصر النواقص 🔍
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-200/40 rounded-2xl flex items-start gap-3">
                            <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                            <div className="space-y-1">
                                <h4 className="font-black text-emerald-800 dark:text-emerald-400 text-xs">🎉 رائع! تم إكمال كشف الجرد الميداني بالكامل</h4>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                    تم تغطية وجرد مائة بالمائة من السلع والمجموعات في كشف المستودع الميداني. يمكنك الآن الذهاب وتوقيع التقرير وتقديمه للمشرفين.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* General helpful advice cards */}
                    <div className="p-4 bg-indigo-500/5 border border-indigo-100 dark:border-indigo-950/30 rounded-2xl space-y-2">
                        <h4 className="font-black text-indigo-700 dark:text-indigo-400 text-xs flex items-center gap-1">
                            <Sparkles size={14} />
                            نصيحة الجرد الميداني السريع:
                        </h4>
                        <ul className="list-disc list-inside text-[11px] text-slate-500 dark:text-slate-400 font-semibold space-y-1 pr-2">
                            <li>تفعيل "وضع المساعد الصوتي" من الأعلى يتيح لك سماع تأكيد أعداد المنتجات دون النظر الدائم للشاشة.</li>
                            <li>تأكد من تنظيف عدسة كاميرا الهاتف للحصول على مسح باركود SKU سريع للغاية.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
