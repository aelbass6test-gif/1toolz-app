import React from 'react';
import { MessageSquare, Users, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface DocCustomersMessagesTabProps {
  baseUrl: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  activeCodeLang: 'curl' | 'javascript' | 'python' | 'php';
  setActiveTab: (tab: any) => void;
}

export const DocCustomersMessagesTab: React.FC<DocCustomersMessagesTabProps> = ({
  baseUrl,
  copyToClipboard,
  copiedKey,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            <MessageSquare size={18} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            توثيق العملاء والرسائل (Customers & Messaging API)
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          استعلام بيانات العملاء، إجمالي المشتريات، وإرسال رسائل آلية وإشعارات التتبع وحفظ سجلات المراسلة في النظام.
        </p>
      </div>

      {/* Endpoints */}
      <div className="space-y-4">
        
        {/* Endpoint: GET /api/v1/customers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                GET
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/customers
              </code>
            </div>
            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
              customers:read
            </span>
          </div>

          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X GET "${baseUrl}/api/v1/customers" \\
  -H "Authorization: Bearer ak_live_xxxxxx"`}
          </pre>
        </div>

        {/* Endpoint: POST /api/v1/messages/send */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                POST
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/messages/send
              </code>
            </div>
            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
              messages:send
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            إرسال رسالة نصية أو رسالة واتساب للعميل مع تسجيلها في سجل تاريخ المحادثات.
          </p>

          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X POST "${baseUrl}/api/v1/messages/send" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "01012345678",
    "message": "مرحباً يا أحمد، تم شحن طلبك رقم 101 بنجاح مع مندوب شركة بوسطة!",
    "type": "whatsapp",
    "orderId": "101"
  }'`}
          </pre>
        </div>

      </div>

    </div>
  );
};
