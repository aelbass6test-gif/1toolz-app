import React, { useState, useMemo } from 'react';
import { 
    AlertTriangle, Search, Filter, ShieldAlert, ArrowRight, 
    RefreshCw, Sparkles, TrendingDown, TrendingUp, Info, AlertCircle, MapPin
} from 'lucide-react';
import { Settings, InventoryAuditSession, InventoryAuditItemDiscrepancy } from '../../types';

interface AuditVarianceCenterProps {
    settings: Settings;
    pastSessions: InventoryAuditSession[];
    onNavigateTab: (tab: string) => void;
}

export default function AuditVarianceCenter({
    settings,
    pastSessions = [],
    onNavigateTab
}: AuditVarianceCenterProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<'all' | 'scrap' | 'surplus' | 'missing' | 'correction'>('all');
    const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all');

    // 1. Gather all discrepancies from past audit sessions
    const allDiscrepancies = useMemo(() => {
        const list: (InventoryAuditItemDiscrepancy & { sessionTitle: string; date: string })[] = [];
        pastSessions.forEach(s => {
            if (s.discrepancies && s.discrepancies.length > 0) {
                s.discrepancies.forEach(d => {
                    list.push({
                        ...d,
                        sessionTitle: s.title,
                        date: s.date
                    });
                });
            }
        });
        // Sort by date (newest first)
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [pastSessions]);

    // 2. Risk Score calculation & categorization
    const enhancedDiscrepancies = useMemo(() => {
        return allDiscrepancies.map(d => {
            const absValue = Math.abs(d.varianceValue);
            const absQty = Math.abs(d.variance);
            const systemQty = d.systemQty || 1;
            const percentage = Math.round((absQty / systemQty) * 100);

            // Risk calculation algorithm
            let riskLevel: 'high' | 'medium' | 'low' = 'low';
            let riskScore = absValue; // primary weight

            if (percentage > 50 && absQty > 5) {
                riskLevel = 'high';
            } else if (absValue > 2000) {
                riskLevel = 'high';
            } else if (absValue > 500 || percentage > 20) {
                riskLevel = 'medium';
            }

            // Proactive recommendations generator
            let recommendations = 'مراقبة الرصيد في دورة الجرد القادمة.';
            if (d.method === 'scrap') {
                recommendations = 'تحقق من أسباب الهلاك، عزل المواد التالفة وإتلافها فوراً بمحضر رسمي.';
            } else if (d.method === 'missing' || (d.variance < 0 && riskLevel === 'high')) {
                recommendations = '🚨 عجز حرج! يرجى مراجعة كاميرات الرف خلال 48 ساعة الماضية، ومراجعة فواتير الصرف اليدوية أو التحقق من احتمالية وجود سرقة.';
            } else if (d.variance < 0) {
                recommendations = 'مراجعة أذونات الصرف والطلبات المعلقة للتحقق من عدم إهمال الخروج.';
            } else if (d.variance > 0) {
                recommendations = 'زيادة غير مبررة. تحقق من فواتير التوريد الأخيرة أو وجود خلط بين أصناف متشابهة SKU.';
            }

            return {
                ...d,
                percentage,
                riskLevel,
                riskScore,
                recommendations
            };
        });
    }, [allDiscrepancies]);

    // 3. Filtering
    const filteredDiscrepancies = useMemo(() => {
        return enhancedDiscrepancies.filter(d => {
            const matchesSearch = 
                d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.sessionTitle.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (filterCategory !== 'all' && d.method !== filterCategory) return false;
            if (filterRisk !== 'all' && d.riskLevel !== filterRisk) return false;

            return true;
        });
    }, [enhancedDiscrepancies, searchQuery, filterCategory, filterRisk]);

    // Stats for overview
    const stats = useMemo(() => {
        const total = enhancedDiscrepancies.length;
        const highRisk = enhancedDiscrepancies.filter(d => d.riskLevel === 'high').length;
        const mediumRisk = enhancedDiscrepancies.filter(d => d.riskLevel === 'medium').length;
        const totalLossValue = enhancedDiscrepancies.reduce((acc, d) => {
            return d.variance < 0 ? acc + Math.abs(d.varianceValue) : acc;
        }, 0);
        const totalGainValue = enhancedDiscrepancies.reduce((acc, d) => {
            return d.variance > 0 ? acc + d.varianceValue : acc;
        }, 0);

        return {
            total,
            highRisk,
            mediumRisk,
            totalLossValue,
            totalGainValue
        };
    }, [enhancedDiscrepancies]);

    return (
        <div className="space-y-6 dir-rtl text-right animate-in fade-in duration-300">
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* High Risk Count */}
                <div className="bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 p-5 rounded-2xl flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black text-red-700 dark:text-red-400 block mb-1">فجوات عالية الخطورة 🚨</span>
                        <span className="text-3xl font-black text-red-800 dark:text-red-350">{stats.highRisk}</span>
                    </div>
                    <p className="text-[9px] text-red-600 dark:text-red-400 font-bold mt-3">تتطلب فحصاً عاجلاً ومراجعة للسرقة أو التلف الشديد.</p>
                </div>

                {/* Medium Risk Count */}
                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-5 rounded-2xl flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 block mb-1">فجوات متوسطة الخطورة ⚠️</span>
                        <span className="text-3xl font-black text-amber-800 dark:text-amber-350">{stats.mediumRisk}</span>
                    </div>
                    <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-3">تتطلب تسوية دورية وتنبيه الموظفين لزيادة التركيز.</p>
                </div>

                {/* Cumulative Losses */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 block mb-1">إجمالي الخسائر / العجز التراكمي</span>
                        <span className="text-2xl font-black text-rose-600 font-sans">
                            -{stats.totalLossValue.toLocaleString()} <small className="text-xs">ج.م</small>
                        </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-3 font-bold">بسبب الهالك، البضائع الضائعة والمفقودات غير المسجلة.</p>
                </div>

                {/* Cumulative Gains */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 block mb-1">إجمالي فوائض التوريد / الزيادات</span>
                        <span className="text-2xl font-black text-emerald-600 font-sans">
                            +{stats.totalGainValue.toLocaleString()} <small className="text-xs">ج.م</small>
                        </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-3 font-bold">بسبب بضاعة زائدة لم تثبت أو أخطاء في فواتير الإدخال.</p>
                </div>
            </div>

            {/* Smart Recommendations Banner */}
            {stats.highRisk > 0 && (
                <div className="p-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShieldAlert size={20} className="animate-bounce" />
                        <div>
                            <h4 className="text-xs font-black">يوجد {stats.highRisk} فجوة حرجة تتجاوز خسائرها الحدود المالية المسموحة!</h4>
                            <p className="text-[10px] text-red-100 font-bold">يرجى مراجعة جدول التوصيات والأعمال الأمنية أدناه للحد من الاختلاس والسرقات.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            setFilterRisk('high');
                            setSearchQuery('');
                        }}
                        className="bg-white/20 px-3 py-1.5 rounded-xl text-[10px] font-black underline hover:bg-white/35 transition-all"
                    >
                        تصفية الفجوات الحرجة فوراً
                    </button>
                </div>
            )}

            {/* Main Interactive Table / List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                {/* Search, Filter, and Categories bar */}
                <div className="p-5 border-b border-slate-50 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-800/10">
                    <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                        <div>
                            <h3 className="text-sm font-black text-slate-850 dark:text-white">مركز تسويات ومطابقة الفروقات الذكي</h3>
                            <p className="text-[10px] text-slate-400 font-bold">يساعدك في تحليل مسببات عدم المطابقة وتوجيه موظفي المخازن للحلول الأمنية.</p>
                        </div>

                        {/* Search Input */}
                        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 w-full max-w-sm shadow-sm">
                            <Search size={16} className="text-slate-400 ml-2" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ابحث باسم السلعة، SKU، أو عنوان الجلسة..."
                                className="bg-transparent border-none outline-none text-xs font-bold w-full dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Interactive Filter Chips */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                            <Filter size={12} />
                            <span>تصنيف التسوية:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                            <button
                                onClick={() => setFilterCategory('all')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterCategory === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-400'}`}
                            >
                                الكل ({enhancedDiscrepancies.length})
                            </button>
                            <button
                                onClick={() => setFilterCategory('scrap')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterCategory === 'scrap' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-400'}`}
                            >
                                شطب تالف/هالك
                            </button>
                            <button
                                onClick={() => setFilterCategory('missing')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterCategory === 'missing' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-400'}`}
                            >
                                مفقود/ضائع
                            </button>
                            <button
                                onClick={() => setFilterCategory('surplus')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterCategory === 'surplus' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-400'}`}
                            >
                                بضاعة زائدة
                            </button>
                            <button
                                onClick={() => setFilterCategory('correction')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterCategory === 'correction' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-400'}`}
                            >
                                تصحيح مباشر
                            </button>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block" />

                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                            <span>مستوى الخطورة:</span>
                        </div>
                        <div className="flex gap-1.5 text-[10px] font-bold">
                            <button
                                onClick={() => setFilterRisk('all')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterRisk === 'all' ? 'bg-slate-800 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                الكل
                            </button>
                            <button
                                onClick={() => setFilterRisk('high')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterRisk === 'high' ? 'bg-red-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-red-600'}`}
                            >
                                عالي الخطورة 🚨
                            </button>
                            <button
                                onClick={() => setFilterRisk('medium')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterRisk === 'medium' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-amber-500'}`}
                            >
                                متوسط ⚠️
                            </button>
                            <button
                                onClick={() => setFilterRisk('low')}
                                className={`px-2.5 py-1.5 rounded-lg transition-all ${filterRisk === 'low' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-emerald-600'}`}
                            >
                                آمن ومطابق ✅
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid of Anomalies with Smart Action Buttons */}
                {filteredDiscrepancies.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 space-y-3">
                        <AlertCircle className="mx-auto text-slate-300 dark:text-slate-700" size={44} />
                        <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">لا توجد أي فجوات جردية مطابقة للتصنيف الحالي</h4>
                        <p className="text-[10px] text-slate-400">كل الأصناف مجرودة بشكل مطابق تماماً مع الدفاتر أو الأرصدة الرقمية.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredDiscrepancies.map((d, index) => {
                            const isHigh = d.riskLevel === 'high';
                            const isMed = d.riskLevel === 'medium';
                            
                            return (
                                <div key={index} className="p-5 hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-black text-slate-850 dark:text-white text-xs">{d.name}</h4>
                                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-mono font-bold dark:text-slate-400">{d.sku}</span>
                                            
                                            {/* Risk badge */}
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                                                isHigh ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
                                                isMed ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' :
                                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                            }`}>
                                                {isHigh ? 'عالي الخطورة 🚨' : isMed ? 'خطورة متوسطة ⚠️' : 'خطر منخفض'}
                                            </span>
                                            
                                            <span className="text-[9px] text-slate-400">في جلسة: <strong className="text-slate-600 dark:text-slate-300">{d.sessionTitle}</strong></span>
                                        </div>

                                        {/* Difference details row */}
                                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold flex-wrap">
                                            <span className="flex items-center gap-1">💻 كمية النظام: <span className="font-mono text-slate-700 dark:text-slate-300">{d.systemQty}</span></span>
                                            <span className="flex items-center gap-1">📦 الكمية الفعلية: <span className="font-mono text-indigo-600">{d.actualQty}</span></span>
                                            <span className="flex items-center gap-1">📊 فارق الجرد: 
                                                <span className={`font-mono px-1.5 py-0.5 rounded text-[9px] font-black ${d.variance < 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'}`}>
                                                    {d.variance > 0 ? '+' : ''}{d.variance}
                                                </span>
                                            </span>
                                            {d.zone && <span className="flex items-center gap-0.5 text-indigo-500 font-bold"><MapPin size={10}/> رف: {d.zone}</span>}
                                        </div>

                                        {/* AI Recommendation Box */}
                                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/30 dark:border-indigo-900/10 text-[10px] text-indigo-900 dark:text-indigo-300 flex items-start gap-1.5 leading-relaxed max-w-2xl">
                                            <Sparkles size={13} className="shrink-0 mt-0.5 text-indigo-500 animate-pulse" />
                                            <p className="font-bold font-sans">
                                                <strong className="text-indigo-600 dark:text-indigo-400 block mb-0.5">الإجراء الفوري المقترح:</strong>
                                                {d.recommendations}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action button & Cost indicators */}
                                    <div className="flex items-center gap-4 text-left lg:text-right shrink-0 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
                                        <div className="space-y-0.5">
                                            <span className={`text-xs font-black font-mono block ${d.varianceValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {d.varianceValue >= 0 ? '+' : ''}{d.varianceValue.toLocaleString()} ج.م
                                            </span>
                                            <span className="text-[9px] text-slate-400 block font-bold">تكلفة الوحدة: {d.costPrice.toLocaleString()} ج.م</span>
                                        </div>

                                        <button 
                                            onClick={() => onNavigateTab('hub')}
                                            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 text-indigo-600 rounded-xl text-[10px] font-black transition-all flex items-center gap-1"
                                        >
                                            جدولة إعادة التحقق
                                            <ArrowRight size={12} className="rotate-180" />
                                        </button>
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
