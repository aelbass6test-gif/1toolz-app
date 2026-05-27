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
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-xl"><BarChart2 size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">التحليلات الذكية</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">اطرح أي سؤال عن بيانات متجرك واحصل على إجابة فورية.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleQuery(query)}
                        placeholder="اسأل مساعدك التحليلي أي سؤال عن بياناتك..."
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-bold"
                    />
                    <button onClick={() => handleQuery(query)} disabled={isLoading} className="px-6 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:bg-slate-400">
                        <Send size={18}/> <span>تحليل</span>
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                    {suggestedQueries.map(q => (
                        <button key={q} onClick={() => handleQuery(q)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                            {q}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center flex flex-col items-center gap-4 text-sky-600 dark:text-sky-400">
                    <BrainCircuit size={40} className="animate-pulse" />
                    <h3 className="font-bold text-lg">جاري تحليل البيانات...</h3>
                    <p className="text-sm text-slate-500">يقوم المساعد الذكي بمعالجة الأرقام الآن، قد يستغرق الأمر بضع لحظات.</p>
                </div>
            )}
            
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-200 dark:border-red-800 flex items-center gap-4 text-red-700 dark:text-red-400">
                    <AlertTriangle size={32}/>
                    <div>
                        <h4 className="font-bold">حدث خطأ</h4>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}
            
            {result && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in-5 duration-300 space-y-6">
                    <div className="prose prose-base dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-xl">
                        <p>{result.analysisText}</p>
                    </div>
                    <DynamicChart chart={result.chart} />
                </div>
            )}

        </div>
    );
};

export default AnalyticsPage;
