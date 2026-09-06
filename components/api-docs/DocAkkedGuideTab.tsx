import React from 'react';
import { 
  Smartphone, CheckCircle2, AlertCircle, Copy, Check, 
  ExternalLink, Zap, Key, ArrowRight, ShieldCheck, MessageSquare
} from 'lucide-react';

interface DocAkkedGuideTabProps {
  storeName: string;
  baseUrl: string;
  storeId: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  setActiveTab: (tab: any) => void;
}

export const DocAkkedGuideTab: React.FC<DocAkkedGuideTabProps> = ({
  storeName,
  baseUrl,
  storeId,
  copyToClipboard,
  copiedKey,
  setActiveTab,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-purple-700 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-bold text-purple-200">
            <Smartphone className="w-3.5 h-3.5" />
            <span>التكامل الرسمي المعتمد • منصة أكد (Akked.io)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            دليل الربط الشامل مع منصة أكد (Akked Integration Guide)
          </h2>
          <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
            اربط متجرك مع منصة <strong className="text-white underline decoration-purple-400 font-bold">أكد (Akked)</strong> لإرسال رسائل واتساب تفاعلية لحظية لتأكيد الطلبات، استرجاع السلات المتروكة، وتحديث مسار الطلب بضغطة زر واحدة من العميل!
          </p>
        </div>
      </div>

      {/* Integration Workflow Steps */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Zap className="text-purple-500" size={18} />
          <span>خطوات الربط البرمجي الكامل (5 خطوات عملية)</span>
        </h3>

        <div className="space-y-4">
          
          {/* Step 1 */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs">1</span>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">توليد مفتاح API مخصص لمنصة أكد</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mr-10 leading-relaxed">
              توجه لصفحة <strong className="text-indigo-600 dark:text-indigo-400">إدارة المفاتيح</strong>، ثم اختر نموذج <strong>"منصة أكد (Akked.io)"</strong> لتفعيل الصلاحيات التالية تلقائياً:
            </p>
            <div className="mr-10 flex flex-wrap gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">orders:read</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">orders:confirm</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">orders:status</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">messages:send</span>
              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">abandoned_carts:read</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs">2</span>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">إدخال بيانات المتجر في لوحة تحكم أكد</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mr-10 leading-relaxed">
              في لوحة تحكم <strong>Akked.io</strong>، افتح <strong>المتاجر (Integrations)</strong> -&gt; <strong>إضافة متجر جديد (Custom Store / Wuilt)</strong>، واملأ البيانات التالية:
            </p>
            
            <div className="mr-10 space-y-2 text-xs font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-2">
                <span className="text-slate-500 font-sans font-bold">اسم المتجر:</span>
                <span className="text-slate-900 dark:text-white font-sans">{storeName}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-2">
                <span className="text-slate-500 font-sans font-bold">رابط الـ API الأساسي (Store URL):</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold" dir="ltr">{baseUrl}</span>
                  <button onClick={() => copyToClipboard(baseUrl, 'akkedUrl')} className="text-slate-400 hover:text-white">
                    {copiedKey === 'akkedUrl' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-2">
                <span className="text-slate-500 font-sans font-bold">مسار جلب الطلبات (Orders Endpoint):</span>
                <span className="text-indigo-600 dark:text-indigo-400" dir="ltr">/api/v1/orders</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-2">
                <span className="text-slate-500 font-sans font-bold">مسار تأكيد الطلب (Confirm Endpoint):</span>
                <span className="text-indigo-600 dark:text-indigo-400" dir="ltr">/api/v1/orders/:id/confirm</span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs">3</span>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">اختبار دورة حياة التأكيد الحية (Live Test)</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mr-10 leading-relaxed">
              قم بإنشاء طلب تجريبي في متجرك، ثم راقب إرسال رسالة الواتساب عبر أكد. بمجرد النقر على زر <strong>"تأكيد الطلب"</strong>، ستتغير حالة الطلب فوراً في لوحة تحكم متجرك إلى <span className="text-emerald-600 font-bold">"مؤكد"</span> مع توثيق الوقت والمصدر.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
