import React from 'react';
import { 
  Key, Shield, CheckCircle2, AlertTriangle, 
  ExternalLink, Copy, Check, Lock, Sparkles, Layers
} from 'lucide-react';
import { SCOPE_DEFINITIONS } from '../ApiKeysManager';

interface DocGenerateKeyTabProps {
  storeName: string;
  baseUrl: string;
  storeId: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  setActiveTab: (tab: any) => void;
}

export const DocGenerateKeyTab: React.FC<DocGenerateKeyTabProps> = ({
  storeName,
  baseUrl,
  storeId,
  copyToClipboard,
  copiedKey,
  setActiveTab,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Title & Introduction */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Key size={18} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            دليل توليد وإدارة مفاتيح الـ API والصلاحيات (API Keys & Scopes)
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          تعتمد المنصة على نظام مفاتيح API آمن ومبني على مبدأ أقل الصلاحيات (Least Privilege). يمكنك إنشاء مفاتيح متعددة وتخصيص صلاحيات محددة لكل منصة أو تطبيق خارجي، مثل تخصيص مفتاح مقتصر على تأكيد الطلبات لمنصة <strong className="text-emerald-500 font-bold">أكد (Akked)</strong>، ومفتاح آخر مقتصر على الشحن لشركات اللوجستيات.
        </p>
        <div className="pt-2">
          <a
            href="/settings/developer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
          >
            <Key size={14} />
            <span>الانتقال لصفحة إدارة وتوليد المفاتيح الآن</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Step by Step Guide */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="text-amber-500" size={18} />
          <span>خطوات إنشاء مفتاح جديد (Step-by-Step)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 relative">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-3">1</div>
            <h4 className="font-bold text-xs text-slate-800 dark:text-white mb-1">الدخول لأدوات المطورين</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              توجه إلى القائمة الجانبية أو الإعدادات وافتح قسم <strong>"مفاتيح الربط البرمجي (API Keys)"</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 relative">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-3">2</div>
            <h4 className="font-bold text-xs text-slate-800 dark:text-white mb-1">تسمية المفتاح</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              اكتب اسماً واضحاً للخدمة (مثلاً: <code>منصة أكد لتأكيد الطلبات</code> أو <code>تطبيق الشحن</code>).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 relative">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-3">3</div>
            <h4 className="font-bold text-xs text-slate-800 dark:text-white mb-1">تحديد الصلاحيات الدقيقة</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              اختر الصلاحيات المطلوبة فقط، أو استخدم أحد النماذج الجاهزة بنقرة واحدة (Preset).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 relative">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-3">4</div>
            <h4 className="font-bold text-xs text-slate-800 dark:text-white mb-1">نسخ المفتاح وحفظه</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              انسخ المفتاح السري الذي يبدأ بـ <code>ak_live_</code> وضعه في إعدادات المنصة الخارجية فوراً.
            </p>
          </div>

        </div>
      </div>

      {/* Complete Granular Scopes Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="text-indigo-500" size={18} />
              <span>دليل الصلاحيات الكاملة (Available Scopes Catalog)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              كل نقطة نهاية في الـ API تتطلب صلاحية واحدة أو أكثر من الصلاحيات التالية:
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
            {SCOPE_DEFINITIONS.length} صلاحية معتمدة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <th className="py-3 px-3 font-bold">الصلاحية (Scope Key)</th>
                <th className="py-3 px-3 font-bold">الاسم العربي</th>
                <th className="py-3 px-3 font-bold">المسار ونوع الطلب</th>
                <th className="py-3 px-3 font-bold">الوصف والاستخدام الشائع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
              {SCOPE_DEFINITIONS.map((scope) => (
                <tr key={scope.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400" dir="ltr">
                    {scope.id}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                    {scope.name}
                    {scope.recommendedTag && (
                      <span className="mr-2 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        موصى لـ {scope.recommendedTag}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px]" dir="ltr">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold mr-1 ${
                      scope.method === 'GET' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                      scope.method === 'POST' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
                      scope.method === 'PATCH' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                      'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    }`}>
                      {scope.method}
                    </span>
                    {scope.endpoint}
                  </td>
                  <td className="py-3 px-3 text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                    {scope.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
