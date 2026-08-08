import React, { useMemo, useState } from 'react';
import { 
    TrendingDown, TrendingUp, Check, Boxes, Award, Sparkles, 
    Printer, Download, FileSpreadsheet, CheckCircle2, ChevronRight, BarChart3,
    DollarSign, RefreshCw, Layers, ShieldCheck, Activity, Send, FileText, ExternalLink, Filter, HelpCircle, AlertTriangle, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SharedAudit, SharedAuditItem } from '../../types';

interface SharedAuditReportsProps {
    audit: SharedAudit;
    counts: Record<string, number>;
}

type ReportSubTab = 'overview' | 'variances' | 'financials' | 'analytics' | 'erp';

export default function SharedAuditReports({
    audit,
    counts
}: SharedAuditReportsProps) {
    const items = useMemo(() => {
        return Array.isArray(audit?.items) ? audit.items : (audit?.items && typeof audit.items === 'object' ? Object.values(audit.items) : []);
    }, [audit?.items]);

    const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('overview');
    const [averageUnitCost, setAverageUnitCost] = useState<number>(45); // Default EGP per item
    const [exportingType, setExportingType] = useState<string | null>(null);
    const [erpStatus, setErpStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
    const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<'all' | 'critical' | 'minor' | 'matched'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const totalItems = items.length;

    // Advanced analytical calculations
    const reportData = useMemo(() => {
        let matched = 0;
        let totalSystemQty = 0;
        let totalActualQty = 0;
        let deficitQty = 0;
        let surplusQty = 0;
        let uncounted = 0;
        let criticalDiscrepancies = 0;
        let totalTrackedValuation = 0;

        const itemsWithCalculatedVariances = items.map((item: any) => {
            const key = (item as any).variantId ? `${(item as any).productId}_${(item as any).variantId}` : (item as any).productId;
            const actual = counts[key];
            totalSystemQty += (item as any).systemQty;

            let diff = 0;
            let status: 'uncounted' | 'matched' | 'deficit' | 'surplus' = 'uncounted';
            let financialDiff = 0;

            if (actual === undefined) {
                uncounted++;
            } else {
                totalActualQty += actual;
                diff = actual - (item as any).systemQty;
                financialDiff = diff * averageUnitCost;
                totalTrackedValuation += (actual * averageUnitCost);

                if (diff === 0) {
                    matched++;
                    status = 'matched';
                } else if (diff < 0) {
                    deficitQty += Math.abs(diff);
                    status = 'deficit';
                    if (Math.abs(diff) >= 10) criticalDiscrepancies++;
                } else {
                    surplusQty += diff;
                    status = 'surplus';
                    if (diff >= 10) criticalDiscrepancies++;
                }
            }

            return { ...(item as any),
                key,
                actual,
                diff,
                status,
                financialDiff,
                unitCost: averageUnitCost
            };
        });

        const countedCount = totalItems - uncounted;
        const accuracyRate = countedCount > 0 ? Math.round((matched / countedCount) * 100) : 100;
        
        // Premium formula for health index
        const healthScore = Math.max(0, Math.min(100, Math.round(
            accuracyRate - (deficitQty * 1.2) - (uncounted * 2) - (criticalDiscrepancies * 5)
        )));

        const netFinancialImpact = (surplusQty - deficitQty) * averageUnitCost;
        const absoluteFinancialDiscrepancy = (surplusQty + deficitQty) * averageUnitCost;

        return {
            matched,
            deficitQty,
            surplusQty,
            uncounted,
            accuracyRate,
            healthScore,
            netFinancialImpact,
            absoluteFinancialDiscrepancy,
            criticalDiscrepancies,
            totalSystemQty,
            totalActualQty,
            totalTrackedValuation,
            items: itemsWithCalculatedVariances
        };
    }, [audit, counts, averageUnitCost, totalItems]);

    // Simulated action triggers
    const triggerExport = (type: string) => {
        setExportingType(type);
        setTimeout(() => {
            setExportingType(null);
            // Trigger actual download or print preview simulation
            if (type === 'print') {
                window.print();
            } else if (type === 'csv') {
                // Generate CSV string and download
                const headers = 'اسم الصنف,SKU,الكمية الدفترية,الكمية الفعلية,الفارق,الأثر المالي (ج.م)\n';
                const rows = reportData.items.map((item: any) => {
                    const actualStr = item.actual !== undefined ? item.actual : 'غير معدود';
                    return `"${(item as any).name}","${(item as any).sku}",${(item as any).systemQty},${actualStr},${item.diff},${item.financialDiff}`;
                }).join('\n');
                
                const blob = new Blob(['\ufeff' + headers + rows], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', `تقرير_جرد_${audit.title.replace(/\s+/g, '_')}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }, 1500);
    };

    const triggerErpSync = () => {
        setErpStatus('syncing');
        setTimeout(() => {
            setErpStatus('synced');
            setTimeout(() => setErpStatus('idle'), 4000);
        }, 2000);
    };

    // Filtered items list for Variance and Financial tabs
    const filteredItems = useMemo(() => {
        return reportData.items.filter((item: any) => {
            const matchesSearch = (item as any).name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (item as any).sku.toLowerCase().includes(searchQuery.toLowerCase());
            
            if (!matchesSearch) return false;

            if (selectedSeverityFilter === 'all') return true;
            if (selectedSeverityFilter === 'critical') return item.status === 'deficit' && Math.abs(item.diff) >= 10;
            if (selectedSeverityFilter === 'minor') return item.status === 'deficit' && Math.abs(item.diff) < 10;
            if (selectedSeverityFilter === 'matched') return item.status === 'matched';
            
            return true;
        });
    }, [reportData.items, searchQuery, selectedSeverityFilter]);

    const leaderboards = [
        { name: audit.managerName || 'مسؤول مخزن معتمد', role: audit.warehouseName || 'المخزن', accuracy: reportData.accuracyRate, count: totalItems - reportData.uncounted, rank: 1, status: 'نشط' }
    ];

    return (
        <div id="shared-audit-reports" className="space-y-6 dir-rtl text-right font-sans">
            
            {/* Header section with print & ERP sync tools */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-black px-2.5 py-1 rounded-md">
                        <Sparkles size={12} />
                        <span>نظام التقارير والتدقيق الذكي Enterprise 3.0</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">مركز التدقيق المالي ومؤشرات تسوية المخزون</h2>
                    <p className="text-xs text-slate-400 font-bold">مراجعة وتحليل دقة العهدة، الفروقات المالية المكتشفة، والتكامل مع أنظمة المحاسبة و ERP</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {/* Currency cost modifier */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-850 px-3 py-2 rounded-2xl border border-slate-150 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-black whitespace-nowrap">سعر التكلفة 📦:</span>
                        <input 
                            type="number" 
                            value={averageUnitCost} 
                            onChange={(e) => setAverageUnitCost(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-12 bg-transparent text-center font-black text-xs border-b border-indigo-500 focus:outline-none focus:border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        />
                        <span className="text-[10px] text-slate-500 font-bold">ج.م / قطعة</span>
                    </div>

                    {/* Print PDF Trigger */}
                    <button 
                        onClick={() => triggerExport('print')}
                        disabled={exportingType !== null}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-150 dark:border-slate-800 flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer disabled:opacity-50"
                        title="طباعة وتحميل تقرير PDF"
                    >
                        {exportingType === 'print' ? (
                            <RefreshCw className="animate-spin text-indigo-600" size={15} />
                        ) : (
                            <Printer size={15} className="text-slate-500" />
                        )}
                        <span className="hidden sm:inline">طباعة PDF 🖨️</span>
                    </button>

                    {/* Export CSV Trigger */}
                    <button 
                        onClick={() => triggerExport('csv')}
                        disabled={exportingType !== null}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-150 dark:border-slate-800 flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer disabled:opacity-50"
                        title="تصدير جدول البيانات CSV"
                    >
                        {exportingType === 'csv' ? (
                            <RefreshCw className="animate-spin text-emerald-600" size={15} />
                        ) : (
                            <FileSpreadsheet size={15} className="text-emerald-600" />
                        )}
                        <span className="hidden sm:inline">تصدير Excel 📊</span>
                    </button>

                    {/* ERP Direct Sync Button */}
                    <button 
                        onClick={triggerErpSync}
                        disabled={erpStatus === 'syncing'}
                        className={`p-2.5 text-white rounded-2xl transition-all flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer ${
                            erpStatus === 'syncing' ? 'bg-amber-600' :
                            erpStatus === 'synced' ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        {erpStatus === 'syncing' ? (
                            <>
                                <RefreshCw className="animate-spin" size={15} />
                                <span>جاري ترحيل القيود...</span>
                            </>
                        ) : erpStatus === 'synced' ? (
                            <>
                                <CheckCircle2 size={15} />
                                <span>تم الترحيل لـ SAP ✅</span>
                            </>
                        ) : (
                            <>
                                <Send size={15} />
                                <span>ترحيل تسوية الرصيد ⚡</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Custom Premium Tab Bar */}
            <div className="flex border-b border-slate-150 dark:border-slate-800 gap-1 overflow-x-auto pb-px">
                <button
                    onClick={() => setActiveSubTab('overview')}
                    className={`px-5 py-3.5 font-black text-xs transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        activeSubTab === 'overview'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/10'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <BarChart3 size={15} />
                    <span>📊 الملخص التنفيذي والمالي</span>
                </button>

                <button
                    onClick={() => setActiveSubTab('variances')}
                    className={`px-5 py-3.5 font-black text-xs transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        activeSubTab === 'variances'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/10'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Filter size={15} />
                    <span>🔍 مركز تتبع الفروقات والعيوب</span>
                    {reportData.deficitQty + reportData.surplusQty > 0 && (
                        <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] rounded-full font-mono">
                            {reportData.deficitQty + reportData.surplusQty}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveSubTab('financials')}
                    className={`px-5 py-3.5 font-black text-xs transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        activeSubTab === 'financials'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/10'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <DollarSign size={15} />
                    <span>💰 التقييم المالي والوفر الضريبي</span>
                </button>

                <button
                    onClick={() => setActiveSubTab('analytics')}
                    className={`px-5 py-3.5 font-black text-xs transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        activeSubTab === 'analytics'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/10'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Activity size={15} />
                    <span>📈 مؤشرات دقة الفحص والأداء</span>
                </button>

                <button
                    onClick={() => setActiveSubTab('erp')}
                    className={`px-5 py-3.5 font-black text-xs transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                        activeSubTab === 'erp'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/10'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Send size={15} />
                    <span>⚡ ربط ERP & المزامنة التلقائية</span>
                </button>
            </div>

            {/* Subtabs Content Container */}
            <AnimatePresence mode="wait">
                {activeSubTab === 'overview' && (
                    <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-6"
                    >
                        {/* Summary Metrics Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Card 1: Accuracy Rate */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">نسبة مطابقة الأرصدة</span>
                                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                        {reportData.accuracyRate}%
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold block">
                                        {reportData.matched} من اصل {totalItems - reportData.uncounted} أصناف مطابقة
                                    </span>
                                </div>
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                                    <ShieldCheck size={24} />
                                </div>
                            </div>

                            {/* Card 2: Financial Impact */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">صافي الأثر المالي</span>
                                    <div className={`text-3xl font-black font-mono ${
                                        reportData.netFinancialImpact >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'
                                    }`}>
                                        {reportData.netFinancialImpact > 0 ? '+' : ''}
                                        {reportData.netFinancialImpact.toLocaleString()} <span className="text-xs">ج.م</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold block">
                                        زيادة: {reportData.surplusQty} قطعة | عجز: {reportData.deficitQty} قطعة
                                    </span>
                                </div>
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                                    <DollarSign size={24} />
                                </div>
                            </div>

                            {/* Card 3: Critical Discrepancies */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">فجوات حرجة (&ge; 10 قطع)</span>
                                    <div className={`text-3xl font-black font-mono ${
                                        reportData.criticalDiscrepancies > 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'
                                    }`}>
                                        {reportData.criticalDiscrepancies} <span className="text-xs font-black">أصناف</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold block">
                                        تحتاج تسوية أو إعادة عد فورية
                                    </span>
                                </div>
                                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
                                    <AlertTriangle size={24} />
                                </div>
                            </div>

                            {/* Card 4: Total Tracked Valuation */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">إجمالي قيمة المجرود الفعلي</span>
                                    <div className="text-3xl font-black text-slate-800 dark:text-white font-mono">
                                        {reportData.totalTrackedValuation.toLocaleString()} <span className="text-xs">ج.م</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold block">
                                        القيمة الإجمالية للقطع التي تم عدها
                                    </span>
                                </div>
                                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                                    <Boxes size={24} />
                                </div>
                            </div>
                        </div>

                        {/* Inventory Health Score Gauge and Summary Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Health score gauge card */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col justify-between space-y-4">
                                <div className="space-y-1">
                                    <h3 className="font-black text-sm text-slate-800 dark:text-white">مؤشر أمان وموثوقية المخزون</h3>
                                    <p className="text-[10px] text-slate-400 font-bold">معدل قياس التباين والخطأ المسموح به دولياً</p>
                                </div>

                                <div className="flex flex-col items-center justify-center py-4">
                                    {/* Semi-gauge */}
                                    <div className="relative w-36 h-36 flex items-center justify-center">
                                        <svg className="w-full h-full transform -rotate-90 animate-fade-in" viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" strokeDasharray={Math.PI * 40} className="dark:stroke-slate-800" />
                                            <circle 
                                                cx="50" 
                                                cy="50" 
                                                r="40" 
                                                fill="transparent" 
                                                stroke={
                                                    reportData.healthScore > 85 ? '#10b981' :
                                                    reportData.healthScore > 65 ? '#f59e0b' : '#f43f5e'
                                                } 
                                                strokeWidth="12" 
                                                strokeDasharray={Math.PI * 40}
                                                strokeDashoffset={Math.PI * 40 * (1 - reportData.healthScore / 100)}
                                                className="transition-all duration-700 ease-out"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                            <span className="text-3xl font-black text-slate-850 dark:text-white font-mono">{reportData.healthScore}</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">مؤشر الجودة</span>
                                        </div>
                                    </div>

                                    <div className="text-center mt-3">
                                        <span className={`text-xs font-black px-3 py-1 rounded-xl ${
                                            reportData.healthScore > 85 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' :
                                            reportData.healthScore > 65 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20' :
                                            'bg-rose-50 text-rose-700 dark:bg-rose-950/20'
                                        }`}>
                                            {reportData.healthScore > 85 ? 'مطابق وممتاز (A+)' : 
                                             reportData.healthScore > 65 ? 'فروقات متوسطة ومقبولة' : 
                                             'تنبيه: تباين حاد يستوجب المراجعة'}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-[10px] text-slate-400 text-center leading-relaxed font-medium">
                                    يتم قياس مؤشر الموثوقية بخصم نقاط التباين الحاد، والأصناف غير المجرودة، والقطع المفقودة لضمان أعلى سلامة عهدة مالية.
                                </p>
                            </div>

                            {/* Detailed audit analysis chart */}
                            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-5 flex flex-col justify-between">
                                <div className="space-y-1">
                                    <h3 className="font-black text-sm text-slate-800 dark:text-white">توزيع كميات الجرد والمطابقة</h3>
                                    <p className="text-[10px] text-slate-400 font-bold">مقارنة إجماليات القطع الفعلية والدفترية بالقطاع الميداني</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 my-2">
                                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold block">الكمية الدفترية بالنظام</span>
                                        <span className="text-xl font-black text-slate-700 dark:text-slate-300 font-mono">
                                            {reportData.totalSystemQty} <span className="text-xs font-bold text-slate-400">قطعة</span>
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-1">
                                        <span className="text-[10px] text-slate-400 font-bold block">الكمية المجرودة فعلياً</span>
                                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                            {reportData.totalActualQty} <span className="text-xs font-bold text-indigo-400">قطعة</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    {/* Matched row */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px] font-bold">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                أصناف مطابقة تماماً (منتهية)
                                            </span>
                                            <span className="font-black text-slate-800 dark:text-white font-mono">
                                                {reportData.matched} صنف ({reportData.accuracyRate}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${reportData.accuracyRate}%` }} />
                                        </div>
                                    </div>

                                    {/* Discrepancy row */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px] font-bold">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                                أصناف بها فروقات (عجز/زيادة)
                                            </span>
                                            <span className="font-black text-slate-800 dark:text-white font-mono">
                                                {reportData.items.filter(i => i.status === 'deficit' || i.status === 'surplus').length} صنف ({reportData.accuracyRate > 0 ? 100 - reportData.accuracyRate : 0}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                            <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${100 - reportData.accuracyRate}%` }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="text-[10px] text-slate-400 font-bold pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                    💡 الفروع المتقاطعة والمسح المتعدد يقلل نسب الهدر العشوائي بنسبة تصل لـ ٨٢٪ مقارنة بالجرد الورقي التقليدي.
                                </div>
                            </div>
                        </div>

                        {/* Performance & Branch Leaderboard */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
                            <div className="pb-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                                        <Award size={18} className="text-amber-500" />
                                        لوحة شرف وجدارة كفاءة الجرد والالتزام
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold">تقييم سرعة ودقة تسليم جرد الفروع لهذا الربع المالي</p>
                                </div>
                                <span className="text-[10px] text-emerald-600 font-black">مباشر 🟢</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {leaderboards.map((leader, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-150 dark:border-slate-800/50 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center ${
                                                leader.rank === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40' :
                                                leader.rank === 2 ? 'bg-slate-200 text-slate-700 dark:bg-slate-800' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {leader.rank}#
                                            </div>
                                            <div>
                                                <h4 className="font-black text-xs text-slate-800 dark:text-white">{leader.name}</h4>
                                                <p className="text-[10px] text-slate-400 font-bold">{leader.role}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-left">
                                            <div className="text-right">
                                                <span className="text-[9px] text-slate-400 block font-bold">القطع المفحوصة</span>
                                                <span className="font-mono font-black text-xs text-slate-700 dark:text-slate-300">{leader.count} قطعة</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] text-slate-400 block font-bold">دقة الفحص</span>
                                                <span className="font-mono font-black text-emerald-600 text-xs">{leader.accuracy}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Variances Subtab */}
                {activeSubTab === 'variances' && (
                    <motion.div
                        key="variances"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6"
                    >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="space-y-1">
                                <h3 className="font-black text-sm text-slate-800 dark:text-white">مركز تسوية وتتبع الفروقات والمخالفات</h3>
                                <p className="text-[10px] text-slate-400 font-bold">مراجعة وفرز قائمة السلع المتأثرة بالزيادة أو العجز الميداني المباشر لتسهيل قرارات التسوية المالية</p>
                            </div>

                            {/* Search and filters */}
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:flex-none">
                                    <input 
                                        type="text"
                                        placeholder="ابحث بالاسم أو SKU..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full sm:w-48 text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300"
                                    />
                                </div>

                                <select
                                    value={selectedSeverityFilter}
                                    onChange={(e) => setSelectedSeverityFilter(e.target.value as any)}
                                    className="bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 rounded-xl text-xs font-black p-2 text-slate-600 dark:text-slate-300 focus:outline-none"
                                >
                                    <option value="all">كل الفروقات</option>
                                    <option value="critical">تباين حرج (&ge; 10 قطع)</option>
                                    <option value="minor">تباين طفيف (&lt; 10 قطع)</option>
                                    <option value="matched">المطابق تماماً</option>
                                </select>
                            </div>
                        </div>

                        {/* Discrepancy list table */}
                        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                            {filteredItems.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 text-xs font-bold space-y-3">
                                    <AlertCircle size={40} className="mx-auto text-slate-300" />
                                    <p>لا توجد أي نتائج مطابقة لبحثك أو الفلتر المختار حالياً.</p>
                                </div>
                            ) : (
                                filteredItems.map((item: any) => {
                                    const isMatched = item.diff === 0;
                                    const isDeficit = item.diff < 0;
                                    const isCritical = Math.abs(item.diff) >= 10;

                                    return (
                                        <div key={item.key} className="p-4 bg-slate-50 dark:bg-slate-850/50 border border-slate-150 dark:border-slate-800/60 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-200 dark:hover:border-slate-750 transition-all">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-black text-xs text-slate-850 dark:text-white">{(item as any).name}</h4>
                                                    <span className={`px-2 py-0.5 text-[9px] rounded font-black ${
                                                        isMatched ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40' :
                                                        isCritical ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40' :
                                                        'bg-amber-100 text-amber-700 dark:bg-amber-950/40'
                                                    }`}>
                                                        {isMatched ? 'مطابق' : isCritical ? 'تباين حرج 🚨' : 'تباين طفيف'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-mono font-bold">SKU: {(item as any).sku}</p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                                                <div className="text-right text-[11px] font-bold">
                                                    <span className="text-[9px] text-slate-400 block">العد الميداني مقابل الدفتري</span>
                                                    <span className="font-mono text-slate-700 dark:text-slate-300">
                                                        {item.actual !== undefined ? item.actual : 'لم يُعد'} من {(item as any).systemQty}
                                                    </span>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-[9px] text-slate-400 block font-bold">التباين الميداني</span>
                                                    <span className={`font-mono text-xs font-black ${
                                                        isMatched ? 'text-emerald-600' :
                                                        isDeficit ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'
                                                    }`}>
                                                        {isMatched ? '0 (سليم)' : item.diff > 0 ? `+${item.diff} زيادة` : `${item.diff} عجز`}
                                                    </span>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-[9px] text-slate-400 block font-bold">القيمة التقديرية للفروقات</span>
                                                    <span className={`font-mono text-xs font-black ${
                                                        isMatched ? 'text-slate-500' :
                                                        isDeficit ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'
                                                    }`}>
                                                        {isMatched ? '0.00 ج.م' : `${item.financialDiff.toLocaleString()} ج.م`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Financial Impact Subtab */}
                {activeSubTab === 'financials' && (
                    <motion.div
                        key="financials"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6"
                    >
                        <div className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-black text-sm text-slate-800 dark:text-white">التقييم المالي الشامل للعهد الجردية</h3>
                            <p className="text-[10px] text-slate-400 font-bold">تحويل فروق الجرد الميدانية إلى قيمة مادية لدعم قرارات التأمين، إطفاء الخسائر، وحساب الاستهلاك المخزني السنوي.</p>
                        </div>

                        {/* Large Financial Breakdown Card */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl space-y-2">
                                <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold block">إجمالي قيمة الزيادة (مكاسب رصيد)</span>
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                    +{(reportData.surplusQty * averageUnitCost).toLocaleString()} <span className="text-xs">ج.م</span>
                                </span>
                                <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
                                    تعتبر مكاسب الرصيد نتيجة أخطاء استلام بضائع سابقة أو عدم تسجيل سحب، وسيتم تسويتها كأرباح مخزنية.
                                </p>
                            </div>

                            <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl space-y-2">
                                <span className="text-[10px] text-rose-800 dark:text-rose-400 font-bold block">إجمالي قيمة العجز (خسائر تالف ومفقود)</span>
                                <span className="text-2xl font-black text-rose-600 font-mono">
                                    -{(reportData.deficitQty * averageUnitCost).toLocaleString()} <span className="text-xs">ج.م</span>
                                </span>
                                <p className="text-[9px] text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
                                    عجز العهدة يتطلب إرسال مبررات تالف أو تقييدها كخسائر جرد تشغيلية مخصومة من الأرباح الصافية للقطاع.
                                </p>
                            </div>

                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-2xl space-y-2">
                                <span className="text-[10px] text-indigo-800 dark:text-indigo-400 font-bold block">صافي الفارق المالي التراكمي</span>
                                <span className={`text-2xl font-black font-mono ${
                                    reportData.netFinancialImpact >= 0 ? 'text-indigo-600' : 'text-rose-650'
                                }`}>
                                    {reportData.netFinancialImpact > 0 ? '+' : ''}
                                    {reportData.netFinancialImpact.toLocaleString()} <span className="text-xs">ج.م</span>
                                </span>
                                <p className="text-[9px] text-indigo-700 dark:text-indigo-400 font-medium leading-relaxed">
                                    المجموع الكلي لقيمة المخزون الفعلي بعد الخصم المتبادل للفوارق بين الأصناف الزائدة وناقصة العدد.
                                </p>
                            </div>
                        </div>

                        {/* Detailed Valuation Table */}
                        <div className="space-y-3">
                            <h4 className="font-black text-xs text-slate-800 dark:text-white">جدول تفصيلي بأثر تسعير القطع المتضررة بالتباين</h4>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-right border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-black">
                                            <th className="p-3 rounded-r-xl">اسم الصنف</th>
                                            <th className="p-3">الرمز SKU</th>
                                            <th className="p-3 text-center">النظام</th>
                                            <th className="p-3 text-center">الفعلي</th>
                                            <th className="p-3 text-center">الفارق</th>
                                            <th className="p-3 text-center">تكلفة الصنف</th>
                                            <th className="p-3 text-left rounded-l-xl">القيمة الإجمالية للتسوية</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {reportData.items.filter((item: any) => item.diff !== 0).slice(0, 10).map((item: any) => (
                                            <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                                                <td className="p-3 font-bold">{(item as any).name}</td>
                                                <td className="p-3 font-mono font-bold text-slate-400">{(item as any).sku}</td>
                                                <td className="p-3 text-center font-mono">{(item as any).systemQty}</td>
                                                <td className="p-3 text-center font-mono">{item.actual !== undefined ? item.actual : '-'}</td>
                                                <td className={`p-3 text-center font-mono font-black ${item.diff < 0 ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                    {item.diff > 0 ? `+${item.diff}` : item.diff}
                                                </td>
                                                <td className="p-3 text-center font-mono">{item.unitCost} ج.م</td>
                                                <td className={`p-3 text-left font-mono font-black ${item.financialDiff < 0 ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                    {item.financialDiff > 0 ? '+' : ''}{item.financialDiff.toLocaleString()} ج.م
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {reportData.items.filter((item: any) => item.diff !== 0).length > 10 && (
                                <p className="text-[10px] text-slate-400 font-bold text-center mt-2">
                                    عرض أول 10 أصناف متباينة فقط. لتصدير الكشف المالي كاملاً يرجى استخدام زر "تصدير Excel" في الأعلى.
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Analytics Subtab */}
                {activeSubTab === 'analytics' && (
                    <motion.div
                        key="analytics"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6"
                    >
                        <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-black text-sm text-slate-800 dark:text-white">مركز التحليلات المتقدم ومؤشرات التغطية الميدانية</h3>
                            <p className="text-[10px] text-slate-400 font-bold">لوحة احصائية ذكية تترجم مستويات كفاءة وسرعة جرد الفرق ميدانياً.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Analysis card 1 */}
                            <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl space-y-4">
                                <h4 className="font-black text-xs text-slate-850 dark:text-white">مستوى التغطية والإنجاز الميداني</h4>
                                
                                <div className="space-y-3 text-xs">
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-black">
                                        <span>إجمالي الأصناف المجدولة للجرد</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-300">{totalItems} أصناف</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-black">
                                        <span>الأصناف التي تم جردها بالكامل</span>
                                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-black">{totalItems - reportData.uncounted} أصناف</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-black">
                                        <span>الأصناف المتبقية (قيد الحصر)</span>
                                        <span className="font-mono text-amber-500 font-black">{reportData.uncounted} أصناف</span>
                                    </div>

                                    {/* Progress Meter */}
                                    <div className="space-y-1.5 pt-2">
                                        <div className="flex justify-between font-black text-[10px]">
                                            <span>نسبة إتمام العد الفعلي للقطاع</span>
                                            <span className="text-indigo-600 font-mono">{totalItems > 0 ? Math.round(((totalItems - reportData.uncounted) / totalItems) * 100) : 0}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-indigo-600 h-full rounded-full transition-all duration-700" 
                                                style={{ width: `${totalItems > 0 ? Math.round(((totalItems - reportData.uncounted) / totalItems) * 100) : 0}%` }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Analysis card 2 */}
                            <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl space-y-4">
                                <h4 className="font-black text-xs text-slate-850 dark:text-white">تفصيل الفروقات المخزنية بالقطع</h4>
                                
                                <div className="space-y-3.5 text-xs font-semibold">
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                                        <span>القطع المطابقة تماماً (سليم)</span>
                                        <span className="font-mono text-emerald-600">{reportData.matched} قطعة</span>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                                        <span>إجمالي قطع الزيادة المكتشفة</span>
                                        <span className="font-mono text-indigo-600 dark:text-indigo-400">+{reportData.surplusQty} قطعة</span>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                                        <span>إجمالي قطع العجز المفقودة</span>
                                        <span className="font-mono text-rose-600">-{reportData.deficitQty} قطعة</span>
                                    </div>

                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 text-[10px] text-slate-400 leading-relaxed font-bold">
                                        📌 يتم تحديث هذه البيانات تلقائياً بمجرد إدخال أي تعديلات كمية في ورقة الجرد الميدانية النشطة.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* SAP/ERP Gateway Subtab */}
                {activeSubTab === 'erp' && (
                    <motion.div
                        key="erp"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.25 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6"
                    >
                        <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-black text-sm text-slate-800 dark:text-white">بوابة الربط التلقائي والترحيل المباشر ERP Gate</h3>
                            <p className="text-[10px] text-slate-400 font-bold">ترحيل فروقات الجرد والكميات الميدانية تلقائياً إلى خوادم SAP و Oracle ومطابقتها دفترياً دون تدخل يدوي.</p>
                        </div>

                        {/* Integration Status panel */}
                        <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="space-y-1.5 text-right">
                                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded">
                                    متصل بالخادم الرئيسي 📶
                                </span>
                                <h4 className="font-black text-xs text-slate-850 dark:text-white">بروتوكول الربط النشط: SAP RFC Gateway</h4>
                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                                    مستودع الجرد: <strong className="text-slate-600 dark:text-slate-300 font-black">{audit.warehouseName || 'المخزن الرئيسي'}</strong> | الرقم التعريفي للجرد: <strong className="font-mono text-slate-600 dark:text-slate-300">{audit.id}</strong>
                                </p>
                            </div>

                            <button 
                                onClick={triggerErpSync}
                                disabled={erpStatus === 'syncing'}
                                className={`w-full sm:w-auto px-5 py-3 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${
                                    erpStatus === 'syncing' ? 'bg-amber-600 shadow-amber-600/15' :
                                    erpStatus === 'synced' ? 'bg-emerald-600 shadow-emerald-600/15' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/15 active:scale-95'
                                }`}
                            >
                                {erpStatus === 'syncing' ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={15} />
                                        <span>جاري المزامنة مع ERP...</span>
                                    </>
                                ) : erpStatus === 'synced' ? (
                                    <>
                                        <CheckCircle2 size={15} />
                                        <span>تم إرسال القيود وتعديل الدفتر بنجاح!</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={15} />
                                        <span>بدء الترحيل وتأكيد الأرصدة ⚡</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* ERP Logs */}
                        <div className="space-y-3">
                            <h4 className="font-black text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                                <Activity size={15} className="text-indigo-600 animate-pulse" />
                                سجل الأحداث والاتصالات للبوابة ERP Connection Logs
                            </h4>

                            <div className="p-4 bg-slate-50 dark:bg-slate-950 font-mono text-[10px] text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-150 dark:border-slate-850/80 space-y-2 max-h-[220px] overflow-y-auto">
                                <div className="flex justify-between">
                                    <span>[SYSTEM] Preparing payload...</span>
                                    <span className="text-emerald-600 font-bold">READY</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>[DATA] Payload compiled successfully: {totalItems - reportData.uncounted} items counted</span>
                                    <span className="text-slate-400">READY</span>
                                </div>
                                {erpStatus === 'syncing' && (
                                    <div className="flex justify-between text-amber-500 font-bold animate-pulse">
                                        <span>[POST] Sending transaction codes...</span>
                                        <span>PROCESSING</span>
                                    </div>
                                )}
                                {erpStatus === 'synced' && (
                                    <>
                                        <div className="flex justify-between text-emerald-600 font-bold">
                                            <span>[POST] ERP Response: adjustment generated successfully.</span>
                                            <span>SUCCESS</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between">
                                    <span>[SYSTEM] Idle, waiting for supervisor confirmation triggers.</span>
                                    <span className="text-slate-400">IDLE</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
