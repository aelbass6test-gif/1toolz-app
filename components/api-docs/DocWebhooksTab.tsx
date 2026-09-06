import React, { useState } from 'react';
import { RefreshCw, Copy, Check, Terminal, ExternalLink, ShieldCheck, Zap, Bell } from 'lucide-react';

interface DocWebhooksTabProps {
  baseUrl: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  activeCodeLang: 'curl' | 'javascript' | 'python' | 'php';
  setActiveTab: (tab: any) => void;
}

export const DocWebhooksTab: React.FC<DocWebhooksTabProps> = ({
  baseUrl,
  copyToClipboard,
  copiedKey,
}) => {
  const [activeEvent, setActiveEvent] = useState<'order.created' | 'order.confirmed' | 'order.cancelled' | 'cart.abandoned'>('order.created');

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
            <RefreshCw size={18} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            نظام الـ Webhooks والإشعارات اللحظية (Webhooks Integration)
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          تتيح لك الـ Webhooks تلقي إشعارات فورية (Real-time HTTP POST Callbacks) على خادمك أو على <strong className="text-emerald-500 font-bold">منصة أكد (Akked)</strong> بمجرد حدوث أي تغيير في المتجر، مثل إنشاء طلب جديد أو تأكيده أو إلغائه، دون الحاجة للقيام بعمليات استعلام متكررة (Polling).
        </p>
      </div>

      {/* Events Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <Bell size={16} className="text-cyan-500" />
            <span>الأحداث المدعومة ونموذج البيانات (Event Payloads)</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">POST JSON payload</span>
        </div>

        {/* Event Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'order.created', label: 'طلب جديد (order.created)' },
            { id: 'order.confirmed', label: 'تأكيد طلب (order.confirmed)' },
            { id: 'order.cancelled', label: 'إلغاء طلب (order.cancelled)' },
            { id: 'cart.abandoned', label: 'سلة متروكة (cart.abandoned)' },
          ].map(ev => (
            <button
              key={ev.id}
              onClick={() => setActiveEvent(ev.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                activeEvent === ev.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {ev.label}
            </button>
          ))}
        </div>

        {/* Event Payload Code Block */}
        <div>
          {activeEvent === 'order.created' && (
            <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`{
  "event": "order.created",
  "timestamp": "2026-09-05T17:30:00Z",
  "storeId": "store_12345",
  "data": {
    "id": "ord_9901",
    "orderNumber": 102,
    "customerName": "محمود سمير",
    "customerPhone": "01012345678",
    "customerAddress": "شارع البحر، المحلة الكبرى",
    "governorate": "الغربية",
    "totalPrice": 850,
    "shippingFee": 40,
    "status": "جديد",
    "paymentMethod": "الدفع عند الاستلام (COD)",
    "items": [
      {
        "productId": "prod_1",
        "name": "حذاء جلد طبيعي رجالي",
        "quantity": 1,
        "price": 850
      }
    ]
  }
}`}
            </pre>
          )}

          {activeEvent === 'order.confirmed' && (
            <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`{
  "event": "order.confirmed",
  "timestamp": "2026-09-05T17:35:10Z",
  "storeId": "store_12345",
  "data": {
    "id": "ord_9901",
    "orderNumber": 102,
    "customerName": "محمود سمير",
    "customerPhone": "01012345678",
    "status": "مؤكد",
    "confirmedAt": "2026-09-05T17:35:10Z",
    "confirmedVia": "Akked WhatsApp Interactive Button"
  }
}`}
            </pre>
          )}

          {activeEvent === 'order.cancelled' && (
            <pre className="bg-slate-950 text-rose-400 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`{
  "event": "order.cancelled",
  "timestamp": "2026-09-05T17:40:00Z",
  "storeId": "store_12345",
  "data": {
    "id": "ord_9901",
    "orderNumber": 102,
    "customerName": "محمود سمير",
    "customerPhone": "01012345678",
    "status": "ملغي",
    "cancelReason": "العميل طلب إلغاء الشحنة هاتفياً",
    "canceledAt": "2026-09-05T17:40:00Z"
  }
}`}
            </pre>
          )}

          {activeEvent === 'cart.abandoned' && (
            <pre className="bg-slate-950 text-amber-400 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`{
  "event": "cart.abandoned",
  "timestamp": "2026-09-05T17:45:00Z",
  "storeId": "store_12345",
  "data": {
    "cartId": "cart_902",
    "customerName": "كريم سامي",
    "customerPhone": "01234567890",
    "totalAmount": 950,
    "recoveryUrl": "${baseUrl}/checkout?recover=cart_902",
    "items": [
      {
        "name": "حذاء رياضي مريح",
        "quantity": 1,
        "price": 950
      }
    ]
  }
}`}
            </pre>
          )}
        </div>
      </div>

      {/* Security: Signature Verification */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span>التحقق من توقيع الويب هوك (HMAC SHA-256 Signature Verification)</span>
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          يتم إرسال ترويسة <code>X-Webhook-Signature</code> مع كل إشعار للتأكد من أن الطلب وارد فعلياً من خادم المتجر.
        </p>

        <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`// Node.js Verification Example
const crypto = require('crypto');

function verifyWebhook(payloadString, signatureHeader, webhookSecret) {
  const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString, 'utf8')
    .digest('hex');
    
  return hash === signatureHeader;
}`}
        </pre>
      </div>

    </div>
  );
};
