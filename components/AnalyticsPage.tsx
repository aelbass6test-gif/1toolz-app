import React, { useState } from 'react';
import { Order, Wallet, Settings } from '../types';
// FIX: Aliased `BarChart` from `lucide-react` to avoid a name conflict with `recharts`.
import { BarChart2, Wand2, Send, BrainCircuit, AlertTriangle, PieChart as PieChartIcon, BarChart as BarChartIcon, LineChart as LineChartIcon } from 'lucide-react';
// FIX: Imported the `LineChart` and `Line` components from `recharts` which were missing.
import { BarChart, Bar, PieChart, Pie, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart } from 'recharts';
import { getAnalyticsFromAI } from '../services/geminiService';

interface AnalyticsPageProps {
  orders: Order[];
  wallet: Wallet;
  settings: Settings;
}

interface ChartData {
    type: 'bar' | 'pie' | 'line' | 'none';
    title: string;
    data: { name: string; value: number }[];
}

interface AnalysisResult {
    analysisText: string;
    chart: ChartData;
}

const DynamicChart: React.FC<{ chart: ChartData }> = ({ chart }) => {
    if (chart.type === 'none' || !chart.data || chart.data.length === 0) {
        return <div className="text-center text-slate-400 py-8">لا يوجد رسم بياني لهذه البيانات.</div>;
    }

    const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

    return (
        <div className="w-full h-80 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-center text-slate-700 dark:text-slate-300 mb-4">{chart.title}</h4>
            {/* 
                NOTE: The Recharts library currently produces a console warning about `defaultProps`.
                This is a known issue in the library and does not affect chart functionality.
                It can be safely ignored until a future version of Recharts resolves it.
                See: https://github.com/recharts/recharts/issues/3615
            */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                {chart.type === 'bar' ? (
                    <BarChart data={chart.data} layout="vertical" margin={{ left: 20, right: 30 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: 'rgb(100 116 139)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', direction: 'rtl' }} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
                        <Bar dataKey="value" name="القيمة" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                ) : chart.type === 'pie' ? (
                    <PieChart>
                        <Pie data={chart.data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name">
                            {chart.data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                ) : chart.type === 'line' ? (
                    <LineChart data={chart.data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                        <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} />
                    </LineChart>
                ) : <></>}
            </ResponsiveContainer>
        </div>
    );
};

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ orders, wallet, settings }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState('');

    const suggestedQueries = [
        "ما هو المنتج الأكثر مبيعاً هذا الشهر؟",
        "قارن بين مبيعات المحافظات المختلفة.",
        "ما هو صافي الربح من الطلبات المكتملة؟",
        "مين أكتر عميل بيطلب أوردرات؟"
    ];

    const handleQuery = async (q: string) => {
        if (!q.trim() || isLoading) return;
        setIsLoading(true);
        setResult(null);
        setError('');

        try {
            const response = await getAnalyticsFromAI(q, orders, settings, wallet);
            if (response && response.analysisText) {
                setResult(response);
            } else {
                throw new Error("لم يتمكن المساعد من تحليل البيانات بشكل صحيح.");
            }
        } catch (err: any) {
            setError(err.message || 'حدث خطأ غير متوقع.');
        } finally {
            setIsLoading(false);
            setQuery('');
        }
    };
    
    return (
        <div className="space-y-8 pb-16 text-right max-w-7xl mx-auto" dir="rtl">
            {/* 🚀 Dynamic Premium AI Analytics Hero Banner */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-[#0a192f] to-sky-950 text-white p-7 sm:p-10 shadow-2xl border border-slate-800">
                {/* Ambient glow effects */}
                <div className="absolute top-0 -left-20 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-400 text-xs font-black">
                                <BrainCircuit size={14} className="animate-pulse" />
                                <span>محرك التحليلات التنبؤية بالذكاء الاصطناعي</span>
                                <span className="bg-sky-400/20 text-sky-300 text-[10px] px-2 py-0.5 rounded-full font-mono">Gemini AI</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                                <span>التحليلات والاستشارات الذكية</span>
                            </h1>
                            <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
                                اسأل المساعد الذكي بأي لغة أو صياغة عامية عن مبيعاتك، أرباح المنتجات، محافظات التوصيل، أو سلوك العملاء واحصل على رؤى تفصيلية ورسوم بيانية فورية.
                            </p>
                        </div>
                    </div>

                    {/* AI Prompt Input Bar */}
                    <div className="bg-white/10 dark:bg-slate-950/40 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-white/15 shadow-xl">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleQuery(query)}
                                placeholder="اسأل مساعدك: ما هو المنتج الأكثر ربحاً هذا الشهر؟ أو قارن بين مبيعات المحافظات..."
                                className="flex-1 px-4 py-3.5 bg-slate-900/60 text-white placeholder-slate-400 border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-sky-400 font-bold text-sm transition-all"
                            />
                            <button 
                                onClick={() => handleQuery(query)} 
                                disabled={isLoading || !query.trim()} 
                                className="px-7 py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                            >
                                <Wand2 size={18} className={isLoading ? "animate-spin" : ""} />
                                <span>{isLoading ? "جاري التحليل..." : "تحليل ذكي"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Prompt suggestions pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                            <span>💡 نماذج أسئلة مقترحة:</span>
                        </span>
                        {suggestedQueries.map(q => (
                            <button 
                                key={q} 
                                onClick={() => handleQuery(q)} 
                                className="px-3.5 py-1.5 bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="surface-card p-12 text-center flex flex-col items-center justify-center gap-4 text-sky-600 dark:text-sky-400">
                    <div className="w-16 h-16 rounded-3xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center animate-bounce">
                        <BrainCircuit size={36} className="text-sky-500 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black text-lg text-slate-800 dark:text-white">جاري تحليل بيانات المتجر واستخراج المؤشرات...</h3>
                        <p className="text-xs text-slate-400 max-w-md">يقوم المساعد الذكي بمعالجة جداول الطلبات والمنتجات لتوليد تقرير بياني دقيق.</p>
                    </div>
                </div>
            )}
            
            {error && (
                <div className="bg-rose-50 dark:bg-rose-950/30 p-6 rounded-2xl border border-rose-200 dark:border-rose-800/60 flex items-center gap-4 text-rose-700 dark:text-rose-400">
                    <AlertTriangle size={32} className="shrink-0"/>
                    <div>
                        <h4 className="font-black text-sm">تعذر إتمام التحليل</h4>
                        <p className="text-xs mt-0.5">{error}</p>
                    </div>
                </div>
            )}
            
            {result && (
                <div className="surface-card p-6 sm:p-8 space-y-6 animate-in fade-in-5 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                            <h3 className="font-black text-lg text-slate-900 dark:text-white">نتيجة التحليل والرؤية الذكية</h3>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                            محدث الآن
                        </span>
                    </div>

                    <div className="text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 leading-relaxed text-sm font-medium">
                        <p className="whitespace-pre-line">{result.analysisText}</p>
                    </div>

                    <DynamicChart chart={result.chart} />
                </div>
            )}
        </div>
    );
};

export default AnalyticsPage;
