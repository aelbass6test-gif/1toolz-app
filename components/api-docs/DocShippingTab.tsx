import React from 'react';
import { Truck, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface DocShippingTabProps {
  baseUrl: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  activeCodeLang: 'curl' | 'javascript' | 'python' | 'php';
  setActiveTab: (tab: any) => void;
}

export const DocShippingTab: React.FC<DocShippingTabProps> = ({
  baseUrl,
  copyToClipboard,
  copiedKey,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Truck size={18} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            توثيق الشحن واللوجستيات (Shipping API)
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          تسهيل الربط مع شركات الشحن والتوصيل (Bosta, Oto, Aramex, Shipblu, Mylerz) وتطبيقات المناديب لإصدار البوالص وتحديث أرقام التتبع تلقائياً.
        </p>
      </div>

      {/* Endpoints */}
      <div className="space-y-4">
        
        {/* Endpoint: GET /api/v1/shipping/orders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                GET
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/shipping/orders
              </code>
            </div>
            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
              shipping:read
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            جلب الشحنات المجهزة للتسليم مع بيانات العناوين وأرقام الهواتف وأجور التوصيل.
          </p>

          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X GET "${baseUrl}/api/v1/shipping/orders" \\
  -H "Authorization: Bearer ak_live_xxxxxx"`}
          </pre>
        </div>

        {/* Endpoint: PATCH /api/v1/shipping/orders/:id */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                PATCH
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/shipping/orders/:id
              </code>
            </div>
            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
              shipping:write
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            ربط رقم البوليصة والتتبع (AWB)، تحديد شركة الشحن، وتحديث حالة التوصيل.
          </p>

          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X PATCH "${baseUrl}/api/v1/shipping/orders/101" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trackingNumber": "AWB-987654321",
    "shippingCompany": "Bosta",
    "status": "تم الشحن"
  }'`}
          </pre>
        </div>

      </div>

    </div>
  );
};
