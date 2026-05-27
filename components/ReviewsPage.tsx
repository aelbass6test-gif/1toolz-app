
import React, { useState } from 'react';
import { Settings, Review } from '../types';
import { Star, ThumbsUp, ThumbsDown, Trash2, CheckCircle, Clock, MessageSquare, XCircle } from 'lucide-react';

interface ReviewsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const ReviewsPage: React.FC<ReviewsPageProps> = ({ settings, setSettings }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  const handleStatusChange = (id: string, newStatus: 'approved' | 'rejected') => {
      setSettings(prev => ({
          ...prev,
          reviews: prev.reviews.map(r => r.id === id ? { ...r, status: newStatus } : r)
      }));
  };

  const handleDelete = (id: string) => {
      if(!window.confirm("حذف هذا التقييم نهائياً؟")) return;
      setSettings(prev => ({
          ...prev,
          reviews: prev.reviews.filter(r => r.id !== id)
      }));
  };

  const filteredReviews = (settings.reviews || []).filter(r => {
      if (filter === 'all') return true;
      return r.status === filter;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getProductName = (id: string) => settings.products.find(p => p.id === id)?.name || 'منتج غير معروف';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl"><Star size={28} /></div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white">تقييمات المنتجات</h1>
                    <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">إدارة آراء العملاء والموافقة على عرضها.</p>
                </div>
            </div>
        </div>

        <div className="flex flex-wrap gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 w-full md:w-fit overflow-x-auto">
            <FilterButton label="الكل" active={filter === 'all'} onClick={() => setFilter('all')} count={settings.reviews?.length || 0} />
            <FilterButton label="بانتظار الموافقة" active={filter === 'pending'} onClick={() => setFilter('pending')} count={settings.reviews?.filter(r => r.status === 'pending').length || 0} color="amber" />
            <FilterButton label="منشور" active={filter === 'approved'} onClick={() => setFilter('approved')} count={settings.reviews?.filter(r => r.status === 'approved').length || 0} color="green" />
        </div>

        <div className="grid gap-4">
            {filteredReviews.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-400">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50"/>
                    <p className="font-bold">لا توجد تقييمات مطابقة.</p>
                </div>
            ) : (
                filteredReviews.map(review => (
                    <div key={review.id} className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 transition-all hover:shadow-md">
                        <div className="flex-1">
                            <div className="flex flex-wrap items-start justify-between mb-2 gap-2">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-base md:text-lg">{review.customerName}</h3>
                                    <p className="text-xs text-slate-500">{new Date(review.date).toLocaleDateString('ar-EG')}</p>
                                </div>
                                <div className="flex bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg text-amber-500">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "text-amber-500" : "text-slate-300"} />
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 mb-3">
                                <p className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300">{getProductName(review.productId)}</p>
                            </div>
                            <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed">"{review.comment}"</p>
                        </div>
                        
                        <div className="flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-r border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pr-6 md:min-w-[140px]">
                            {review.status === 'pending' && (
                                <>
                                    <button onClick={() => handleStatusChange(review.id, 'approved')} className="flex-1 md:flex-none flex items-center justify-center gap-2 w-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-2 rounded-lg text-xs md:text-sm font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                                        <CheckCircle size={16}/> <span className="inline">نشر</span>
                                    </button>
                                    <button onClick={() => handleStatusChange(review.id, 'rejected')} className="flex-1 md:flex-none flex items-center justify-center gap-2 w-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-3 py-2 rounded-lg text-xs md:text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                        <ThumbsDown size={16}/> <span className="inline">رفض</span>
                                    </button>
                                </>
                            )}
                            {review.status === 'approved' && (
                                <span className="flex-1 md:flex-none flex items-center justify-center gap-1 text-emerald-600 text-xs md:text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 mb-0 md:mb-2 w-full">
                                    <CheckCircle size={14}/> منشور
                                </span>
                            )}
                            {review.status === 'rejected' && (
                                <span className="flex-1 md:flex-none flex items-center justify-center gap-1 text-red-600 text-xs md:text-sm font-bold bg-red-50 px-3 py-1 rounded-full border border-red-100 mb-0 md:mb-2 w-full">
                                    <XCircle size={14}/> مرفوض
                                </span>
                            )}
                            <button onClick={() => handleDelete(review.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors">
                                <Trash2 size={16}/> <span className="inline">حذف</span>
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

const FilterButton = ({ label, active, onClick, count, color = 'blue' }: any) => {
    const activeClasses = {
        blue: 'bg-blue-600 text-white',
        amber: 'bg-amber-500 text-white',
        green: 'bg-emerald-600 text-white'
    };
    return (
        <button onClick={onClick} className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${active ? activeClasses[color as keyof typeof activeClasses] : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>{count}</span>
        </button>
    );
};

export default ReviewsPage;
