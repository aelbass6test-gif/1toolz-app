import React from 'react';
import { Zap, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface DocAbandonedCartsTabProps {
  baseUrl: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  activeCodeLang: 'curl' | 'javascript' | 'python' | 'php';
  setActiveTab: (tab: any) => void;
}

export const DocAbandonedCartsTab: React.FC<DocAbandonedCartsTabProps> = ({
  baseUrl,
  copyToClipboard,
  copiedKey,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/70 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
            <Zap size={18} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            توثيق السلات المتروكة (Abandoned Carts API)
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          تمكنك هذه الواجهة من استرداد جلسات السلات التي غادرها العملاء قبل إتمام الدفع، بهدف إرسال حملات الواتساب التلقائية لاستعادة السلات وتوليد كوبونات الخصم الذكية.
        </p>
      </div>

      {/* Endpoints */}
      <div className="space-y-4">
        
        {/* Endpoint: GET /api/v1/abandoned-carts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                GET
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/abandoned-carts
              </code>
            </div>
            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
              abandoned_carts:read
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            جلب قائمة السلات المتروكة مع أرقام هواتف العملاء وقيمة المنتجات المتبقية.
          </p>

          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X GET "${baseUrl}/api/v1/abandoned-carts" \\
  -H "Authorization: Bearer ak_live_xxxxxx"`}
          </pre>

          <div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">نموذج الاستجابة (JSON Response):</span>
            <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`{
  "total": 1,
  "carts": [
    {
      "id": "cart_902",
      "customerName": "كريم سامي",
      "customerPhone": "01234567890",
      "totalAmount": 950,
      "items": [
        {
          "name": "حذاء رياضي مريح",
          "quantity": 1,
          "price": 950
        }
      ],
      "abandonedAt": "2026-09-05T12:00:00Z",
      "recoveryStatus": "pending"
    }
  ]
}`}
            </pre>
          </div>
        </div>

        {/* Endpoint: POST /api/v1/abandoned-carts/:id/recover */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                POST
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/abandoned-carts/:id/recover
              </code>
            </div>
            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
              abandoned_carts:recover
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            تحديث حالة السلة كـ "تمت محاولة الاستعادة" وتسجيل وقت إرسال رابط الخصم للعميل.
          </p>

          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X POST "${baseUrl}/api/v1/abandoned-carts/cart_902/recover" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"notes": "تم إرسال كوبون خصم 10% عبر الواتساب"}'`}
          </pre>
        </div>

      </div>

    </div>
  );
};
