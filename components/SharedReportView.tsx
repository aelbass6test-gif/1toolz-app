import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharedReport } from '../services/reportShareService';
import { Loader2, AlertTriangle, FileText } from 'lucide-react';

export const SharedReportView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReport = async () => {
            if (!id) {
                setError('لم يتم توفير معرف التقرير');
                setLoading(false);
                return;
            }
            try {
                const content = await getSharedReport(id);
                if (content) {
                    setHtmlContent(content);
                } else {
                    setError('التقرير غير موجود أو تم حذفه');
                }
            } catch (err) {
                console.error("Error fetching report:", err);
                setError('حدث خطأ أثناء جلب التقرير');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
                <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                <p className="text-slate-600 dark:text-slate-400 font-bold">جاري تحميل التقرير...</p>
            </div>
        );
    }

    if (error || !htmlContent) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
                    <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">عذراً</h2>
                    <p className="text-slate-600 dark:text-slate-400 font-bold">{error || 'تعذر تحميل التقرير'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-8">
            <div className="max-w-[1200px] mx-auto">
                <div className="mb-6 flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                            <FileText size={20} />
                         </div>
                         <div>
                             <h1 className="font-black text-slate-800 dark:text-white text-lg">تقرير مالي شامل (مشارك)</h1>
                             <p className="text-xs font-bold text-slate-500 dark:text-slate-400">نسخة للعرض فقط</p>
                         </div>
                     </div>
                     <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all flex items-center gap-2">
                         طباعة
                     </button>
                </div>
                <div 
                    className="bg-white rounded-3xl shadow-2xl overflow-hidden report-container print:shadow-none print:rounded-none"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
            </div>
        </div>
    );
};
