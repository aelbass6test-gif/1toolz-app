import React, { useState, useMemo } from 'react';
import { 
    Printer, Search, Calendar, FileText, Download, TrendingUp, 
    TrendingDown, Package, User, Award, ShieldAlert, AlertTriangle
} from 'lucide-react';
import { Settings, InventoryAuditSession } from '../../types';

interface AuditAnalyticsReportsProps {
    settings: Settings;
    pastSessions: InventoryAuditSession[];
    onViewPastSession: (session: InventoryAuditSession) => void;
    onPrintSession: (session: InventoryAuditSession) => void;
}

export default function AuditAnalyticsReports({
    settings,
    pastSessions = [],
    onViewPastSession,
    onPrintSession
}: AuditAnalyticsReportsProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState('all');

    // Filter sessions
    const filteredSessions = useMemo(() => {
        return pastSessions.filter(s => {
            const matchesSearch = 
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.performedBy.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (warehouseFilter !== 'all' && s.warehouseId !== warehouseFilter) return false;

            return true;
        });
    }, [pastSessions, searchQuery, warehouseFilter]);

    // Problematic products analytics
    const problematicProducts = useMemo(() => {
        const itemFreq: Record<string, { name: string; sku: string; count: number; totalAbsQty: number; totalAbsValue: number }> = {};
        
        pastSessions.forEach(s => {
            s.discrepancies?.forEach(d => {
                const key = d.variantId ? `${d.productId}_${d.variantId}` : d.productId;
                if (!itemFreq[key]) {
                    itemFreq[key] = {
                        name: d.name,
                        sku: d.sku,
                        count: 0,
                        totalAbsQty: 0,
                        totalAbsValue: 0
                    };
                }
                itemFreq[key].count += 1;
                itemFreq[key].totalAbsQty += Math.abs(d.variance);
                itemFreq[key].totalAbsValue += Math.abs(d.varianceValue);
            });
        });

        return Object.values(itemFreq)
            .sort((a, b) => b.totalAbsValue - a.totalAbsValue)
            .slice(0, 5);
    }, [pastSessions]);

    // Counter/Employee performance leaderboard
    const counterPerformance = useMemo(() => {
        const perf: Record<string, { sessions: number; totalItems: number; accuracySum: number }> = {};
        
        pastSessions.forEach(s => {
            const user = s.performedBy || 'مسؤول مخزن';
            if (!perf[user]) {
                perf[user] = {
                    sessions: 0,
                    totalItems: 0,
                    accuracySum: 0
                };
            }
            const total = s.totalSystemQty || 1;
            const diff = Math.abs(s.totalVarianceQty || 0);
            const accuracy = Math.max(0, Math.min(100, ((total - diff) / total) * 100));

            perf[user].sessions += 1;
            perf[user].totalItems += s.totalItemsAudited;
            perf[user].accuracySum += accuracy;
        });

        return Object.entries(perf).map(([name, data]) => ({
            name,
            sessions: data.sessions,
            totalItems: data.totalItems,
            avgAccuracy: Math.round((data.accuracySum / data.sessions) * 10) / 10
        })).sort((a, b) => b.avgAccuracy - a.avgAccuracy);
    }, [pastSessions]);

    return (
        <div className="space-y-6 dir-rtl text-right animate-in fade-in duration-300">
            
            {/* Top Problematic Products and Top Counter Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Product with highest variance */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                    <div>
                        <h3 className="text-sm font-black text-slate-850 dark:text-white flex items-center gap-1.5">
                            <ShieldAlert size={16} className="text-rose-500 animate-pulse" />
                            السلع الأكثر عجزاً وفاقداً (نزيف المخزون)
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">المنتجات التي تواجه أكبر فروق مالية تراكمية في الجرود الأخيرة</p>
                    </div>

                    {problematicProducts.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                            لا توجد بيانات عجز كافية حتى الآن
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {problematicProducts.map((p, index) => (
                                <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{p.name}</h4>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                            <span>SKU: {p.sku}</span>
                                            <span>•</span>
                                            <span className="text-rose-500">تكرر الفرق {p.count} مرات</span>
                                        </div>
                                    </div>
                                    <div className="text-left font-sans space-y-0.5 shrink-0">
                                        <span className="text-xs font-black text-rose-600 block">-{p.totalAbsValue.toLocaleString()} ج.م</span>
                                        <span className="text-[9px] text-slate-400 block font-bold">مجموع العجز: {p.totalAbsQty} قطعة</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Best Counters Leaderboard */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                    <div>
                        <h3 className="text-sm font-black text-slate-850 dark:text-white flex items-center gap-1.5">
                            <Award size={16} className="text-emerald-500" />
                            لوحة شرف مدققي المخازن (دقة الجرد)
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">أفضل Counters يحققون أعلى معدلات مطابقة فعلية للأرفف</p>
                    </div>

                    {counterPerformance.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                            لا توجد عمليات جرد معتمدة حتى الآن
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {counterPerformance.map((c, index) => (
                                <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-full flex items-center justify-center font-black text-xs font-mono">
                                            #{index + 1}
                                        </div>
                                        <div className="space-y-0.5">
                                            <h4 className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[150px]">{c.name}</h4>
                                            <span className="text-[9px] text-slate-400 font-bold block">أشرف على {c.sessions} جلسات ({c.totalItems} صنف)</span>
                                        </div>
                                    </div>
                                    <div className="text-left shrink-0">
                                        <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-black font-sans">
                                            {c.avgAccuracy}% دقة
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Reports Center & Session logs search list */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                
                {/* Filter and Search header */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pb-3 border-b border-slate-50 dark:border-slate-800">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">مركز إصدار وتقارير الجرد المالي الكلي</h3>
                        <p className="text-[10px] text-slate-400 font-bold">يمكنك معاينة أو طباعة أي تقرير جرد وإثباته لتقديمه لقطاع الحسابات والمراجعة.</p>
                    </div>

                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                        {/* Warehouse selector */}
                        <select 
                            value={warehouseFilter}
                            onChange={e => setWarehouseFilter(e.target.value)}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none"
                        >
                            <option value="all">كل المستودعات</option>
                            {(settings.warehouses || []).map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>

                        {/* Search field */}
                        <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5">
                            <Search size={14} className="text-slate-400 ml-1.5" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ابحث باسم الجرد..."
                                className="bg-transparent border-none outline-none text-xs font-bold dark:text-white w-28 sm:w-44"
                            />
                        </div>
                    </div>
                </div>

                {/* Session List */}
                {filteredSessions.length === 0 ? (
                    <div className="p-16 text-center text-slate-400">
                        <FileText className="mx-auto text-slate-300 opacity-20 mb-2" size={44} />
                        <p className="text-xs font-black">لا توجد أي تقارير جرد معتمدة تطابق البحث</p>
                    </div>
                ) : (
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3">عنوان تقرير الجرد</th>
                                    <th className="px-4 py-3">التاريخ والوقت</th>
                                    <th className="px-4 py-3">المدقق المسؤول</th>
                                    <th className="px-4 py-3 text-center">الأصناف</th>
                                    <th className="px-4 py-3 text-center">فارق الكمية</th>
                                    <th className="px-4 py-3 text-center">قيمة التسوية الكلية</th>
                                    <th className="px-4 py-3 text-left">التحكم</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {filteredSessions.map(session => {
                                    const valueAdjust = session.totalVarianceValue || 0;
                                    const qtyAdjust = session.totalVarianceQty || 0;
                                    
                                    return (
                                        <tr key={session.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                                            <td className="px-4 py-3.5 font-black text-slate-800 dark:text-slate-200">{session.title}</td>
                                            <td className="px-4 py-3.5 text-slate-400 font-sans font-bold">
                                                {new Date(session.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-3.5 font-bold text-indigo-600">{session.performedBy}</td>
                                            <td className="px-4 py-3.5 text-center font-bold">{session.totalItemsAudited} صنف</td>
                                            <td className="px-4 py-3.5 text-center font-mono font-bold">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${qtyAdjust < 0 ? 'bg-red-50 text-red-650' : 'bg-emerald-50 text-emerald-650'}`}>
                                                    {qtyAdjust > 0 ? '+' : ''}{qtyAdjust} وحدة
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center font-mono font-black">
                                                <span className={valueAdjust >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                                    {valueAdjust > 0 ? '+' : ''}{valueAdjust.toLocaleString()} ج.م
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-left">
                                                <div className="flex justify-end gap-1.5">
                                                    <button 
                                                        onClick={() => onViewPastSession(session)}
                                                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-slate-200/50 dark:border-slate-700 transition-all"
                                                    >
                                                        المطابقة الفنية
                                                    </button>
                                                    <button 
                                                        onClick={() => onPrintSession(session)}
                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 text-indigo-600 rounded-lg transition-all"
                                                        title="طباعة التقرير"
                                                    >
                                                        <Printer size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
