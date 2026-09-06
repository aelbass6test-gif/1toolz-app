import React from 'react';
import { 
  Server, Shield, Key, AlertTriangle, CheckCircle, 
  Layers, Clock, Copy, Check, Terminal, ExternalLink, HelpCircle
} from 'lucide-react';

interface DocOverviewTabProps {
  storeName: string;
  baseUrl: string;
  storeId: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  activeCodeLang: 'curl' | 'javascript' | 'python' | 'php';
  setActiveTab: (tab: any) => void;
}

export const DocOverviewTab: React.FC<DocOverviewTabProps> = ({
  storeName,
  baseUrl,
  storeId,
  copyToClipboard,
  copiedKey,
  activeCodeLang,
  setActiveTab,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-bold text-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>RESTful API Documentation • إصدار 1.0</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            التوثيق البرمجي الشامل لمتجر {storeName}
          </h2>
          <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
            مرحباً بك في بوابة مطوري {storeName}. تتيح لك واجهة برمجة التطبيقات (REST API) دمج متجرك بسلاسة وبشكل آمن مع منصات أتمتة الواتساب مثل <strong className="text-white underline decoration-emerald-400 font-bold">منصة أكد (Akked.io)</strong>، أنظمة الشحن، برامج المحاسبة، وتطبيقات إدارة المخزون.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setActiveTab('akked-guide')}
              className="px-5 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2"
            >
              <span>دليل ربط منصة أكد خطوة بخطوة</span>
              <ExternalLink size={14} />
            </button>
            <button
              onClick={() => setActiveTab('generate-key')}
              className="px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-white border border-white/20 rounded-xl font-bold text-xs transition-all flex items-center gap-2"
            >
              <Key size={14} />
              <span>توليد مفاتيح الربط (API Keys)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Core Architecture & Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Server size={18} />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-white">الرابط الأساسي (Base URL)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono" dir="ltr">{baseUrl}/api/v1</p>
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">HTTPS Only (مشفر)</span>
            <button
              onClick={() => copyToClipboard(`${baseUrl}/api/v1`, 'baseUrlHeader')}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs flex items-center gap-1"
            >
              {copiedKey === 'baseUrlHeader' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span className="text-[10px]">نسخ</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Shield size={18} />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-white">طريقة المصادقة (Auth)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Bearer Token أو Header مخصص:</p>
          <div className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg text-slate-800 dark:text-slate-200" dir="ltr">
            Authorization: Bearer &lt;API_KEY&gt;
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock size={18} />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-white">حدود الاستخدام (Rate Limit)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            حتى <strong className="font-bold text-slate-700 dark:text-slate-300">120 طلب / دقيقة</strong> لكل مفتاح API. يتم إرجاع كود <code className="font-mono text-amber-600">429</code> في حال التجاوز.
          </p>
        </div>

      </div>

      {/* Getting Started Guide */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Terminal className="text-emerald-500" size={18} />
          <span>خطوات البدء السريع (Quickstart)</span>
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          للبدء في استخدام الـ API، يلزمك فقط تمرير مفتاح المصادقة في ترويسات الطلب (HTTP Request Headers) مع تحديد نوع البيانات كـ JSON:
        </p>

        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  <th className="py-2.5 px-3 font-bold">الترويسة (Header)</th>
                  <th className="py-2.5 px-3 font-bold">القيمة (Value)</th>
                  <th className="py-2.5 px-3 font-bold">الحالة</th>
                  <th className="py-2.5 px-3 font-bold">الوصف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                <tr>
                  <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold" dir="ltr">Authorization</td>
                  <td className="py-2.5 px-3" dir="ltr">Bearer ak_live_...</td>
                  <td className="py-2.5 px-3 font-sans"><span className="text-rose-500 font-bold">إلزامي</span></td>
                  <td className="py-2.5 px-3 font-sans">مفتاح الربط المستخرج من إعدادات المتجر</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold" dir="ltr">x-api-key</td>
                  <td className="py-2.5 px-3" dir="ltr">ak_live_...</td>
                  <td className="py-2.5 px-3 font-sans"><span className="text-slate-400">اختياري (بديل)</span></td>
                  <td className="py-2.5 px-3 font-sans">يمكن استخدام هذه الترويسة كبديل لـ Bearer Token</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold" dir="ltr">Content-Type</td>
                  <td className="py-2.5 px-3" dir="ltr">application/json</td>
                  <td className="py-2.5 px-3 font-sans"><span className="text-rose-500 font-bold">إلزامي لـ POST/PUT</span></td>
                  <td className="py-2.5 px-3 font-sans">تحديد نسق البيانات كـ JSON مشفر بـ UTF-8</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold" dir="ltr">X-Store-Id</td>
                  <td className="py-2.5 px-3" dir="ltr">{storeId}</td>
                  <td className="py-2.5 px-3 font-sans"><span className="text-slate-400">اختياري</span></td>
                  <td className="py-2.5 px-3 font-sans">معرف المتجر في حال إدارة متاجر متعددة</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* HTTP Status Codes Reference */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="text-teal-500" size={18} />
          <span>جدول استجابات الـ HTTP وأكواد الخطأ (Status Codes & Errors)</span>
        </h3>
        <p className="text-xs text-slate-500">
          تعتمد واجهة الـ API على أكواد استجابة HTTP القياسية للدلالة على نجاح العملية أو سبب الفشل:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          
          <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-600 text-white text-[11px]">200 OK</span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300 font-sans">نجاح الطلب</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">تم تنفيذ العملية وجلب أو تعديل البيانات بنجاح.</p>
          </div>

          <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-600 text-white text-[11px]">201 Created</span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300 font-sans">تم الإنشاء بنجاح</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">تم إنشاء العنصر (طلب جديد، منتج، بوليصة) وحفظه في المتجر.</p>
          </div>

          <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-amber-600 text-white text-[11px]">400 Bad Request</span>
              <span className="font-bold text-amber-800 dark:text-amber-300 font-sans">خطأ في البيانات</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">الحقول المدخلة غير مكتملة أو صياغة الـ JSON غير صحيحة.</p>
          </div>

          <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-rose-600 text-white text-[11px]">401 Unauthorized</span>
              <span className="font-bold text-rose-800 dark:text-rose-300 font-sans">غير مصرح</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">مفتاح الـ API مفقود، غير صحيح، أو تم إلغاء تفعيله.</p>
          </div>

          <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-rose-600 text-white text-[11px]">403 Forbidden</span>
              <span className="font-bold text-rose-800 dark:text-rose-300 font-sans">صلاحية مفقودة</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">المفتاح صالح لكنه يفتقر للصلاحية المطلوبة للوصول لهذا المسار.</p>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-600 text-white text-[11px]">404 Not Found</span>
              <span className="font-bold text-slate-800 dark:text-slate-300 font-sans">غير موجود</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">رقم الطلب أو العنصر المطلوب غير متواجد في المتجر.</p>
          </div>

        </div>
      </div>

    </div>
  );
};
