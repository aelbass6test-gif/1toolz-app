import React, { useState } from 'react';
import { 
  Boxes, Copy, Check, Terminal, ExternalLink, 
  ChevronDown, ChevronUp, Sparkles, Filter, Database
} from 'lucide-react';

interface DocOrdersTabProps {
  baseUrl: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  activeCodeLang: 'curl' | 'javascript' | 'python' | 'php';
  setActiveTab: (tab: any) => void;
}

export const DocOrdersTab: React.FC<DocOrdersTabProps> = ({
  baseUrl,
  copyToClipboard,
  copiedKey,
  activeCodeLang,
  setActiveTab,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('list');

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Boxes size={18} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            توثيق واجهة طلبات المتجر (Store Orders API)
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          تتيح لك واجهة الطلبات إدارة دورة حياة الطلبات بالكامل (Order Lifecycle)، استرجاع البيانات، تأكيد الطلبات عبر أزرار الواتساب (منصة أكد)، تعديل العناوين، تحديث حالات الشحن، وإلغاء الطلبات.
        </p>
      </div>

      {/* Endpoints List */}
      <div className="space-y-4">
        
        {/* Endpoint 1: GET /api/v1/orders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div 
            onClick={() => toggleSection('list')}
            className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                GET
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/orders
              </code>
              <span className="text-xs text-slate-500 font-sans hidden sm:inline">جلب قائمة الطلبات مع الفلترة والبحث</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                orders:read
              </span>
              {expandedSection === 'list' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedSection === 'list' && (
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">معاملات البحث والاستعلام (Query Parameters):</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                        <th className="py-2 px-2">المعامل (Parameter)</th>
                        <th className="py-2 px-2">النوع</th>
                        <th className="py-2 px-2">الوصف ومثال</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800 font-mono text-slate-600 dark:text-slate-300">
                      <tr>
                        <td className="py-2 px-2 text-indigo-600 font-bold" dir="ltr">status</td>
                        <td className="py-2 px-2 text-slate-400">string</td>
                        <td className="py-2 px-2 font-sans">تصفية حسب الحالة: <code>جديد</code>, <code>مؤكد</code>, <code>تم الشحن</code>, <code>تم التوصيل</code>, <code>ملغي</code></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-indigo-600 font-bold" dir="ltr">phone</td>
                        <td className="py-2 px-2 text-slate-400">string</td>
                        <td className="py-2 px-2 font-sans">البحث برقم هاتف العميل (مثال: <code>01012345678</code>)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-indigo-600 font-bold" dir="ltr">search</td>
                        <td className="py-2 px-2 text-slate-400">string</td>
                        <td className="py-2 px-2 font-sans">البحث باسم العميل أو رقم الطلب أو المنتجات</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-indigo-600 font-bold" dir="ltr">limit / page</td>
                        <td className="py-2 px-2 text-slate-400">number</td>
                        <td className="py-2 px-2 font-sans">عدد الطلبات لكل صفحة ورقم الصفحة (الافتراضي 50)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Code Snippet */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">مثال الطلب:</span>
                  <button
                    onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api/v1/orders?status=مؤكد&limit=10" \\\n  -H "Authorization: Bearer ak_live_xxxxxx"`, 'getOrders')}
                    className="text-xs text-slate-500 hover:text-emerald-500 flex items-center gap-1"
                  >
                    {copiedKey === 'getOrders' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>نسخ الكود</span>
                  </button>
                </div>
                <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X GET "${baseUrl}/api/v1/orders?status=مؤكد&limit=10" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json"`}
                </pre>
              </div>

              {/* Sample Response */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">نموذج الاستجابة (200 OK):</span>
                <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-60" dir="ltr">
{`{
  "total": 1,
  "page": 1,
  "limit": 10,
  "orders": [
    {
      "id": "ord_8921",
      "orderNumber": 101,
      "customerName": "أحمد محمود علي",
      "customerPhone": "01098765432",
      "customerAddress": "شارع الجمهورية، عمارة 5، المنصورة",
      "governorate": "الدقهلية",
      "status": "مؤكد",
      "totalPrice": 750,
      "shippingFee": 50,
      "items": [
        {
          "name": "ساعة ذكية Smart Watch Pro",
          "quantity": 1,
          "price": 700
        }
      ],
      "createdAt": "2026-09-05T14:30:00Z"
    }
  ]
}`}
                </pre>
              </div>

            </div>
          )}
        </div>

        {/* Endpoint 2: GET /api/v1/orders/:id */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div 
            onClick={() => toggleSection('single')}
            className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                GET
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/orders/:id
              </code>
              <span className="text-xs text-slate-500 font-sans hidden sm:inline">جلب تفاصيل طلب محدد برقم الطلب</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                orders:read
              </span>
              {expandedSection === 'single' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedSection === 'single' && (
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X GET "${baseUrl}/api/v1/orders/101" \\
  -H "Authorization: Bearer ak_live_xxxxxx"`}
              </pre>
            </div>
          )}
        </div>

        {/* Endpoint 3: POST /api/v1/orders (Create Order) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div 
            onClick={() => toggleSection('create')}
            className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                POST
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/orders
              </code>
              <span className="text-xs text-slate-500 font-sans hidden sm:inline">إنشاء طلب جديد في المتجر</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                orders:write
              </span>
              {expandedSection === 'create' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedSection === 'create' && (
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X POST "${baseUrl}/api/v1/orders" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerName": "سارة إبراهيم",
    "customerPhone": "01123456789",
    "customerAddress": "شارع التسعين، التجمع الخامس",
    "governorate": "القاهرة",
    "totalPrice": 1200,
    "shippingFee": 60,
    "items": [
      {
        "name": "فستان سهرة كلاسيك",
        "quantity": 1,
        "price": 1200
      }
    ],
    "notes": "الاستلام في الفترة المسائية"
  }'`}
              </pre>
            </div>
          )}
        </div>

        {/* Endpoint 4: POST /api/v1/orders/:id/confirm (Akked Quick Action) */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/80 rounded-2xl shadow-sm overflow-hidden">
          <div 
            onClick={() => toggleSection('confirm')}
            className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-600 text-white">
                POST
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/orders/:id/confirm
              </code>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                مطلوب لـ منصة أكد (Akked)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                orders:confirm
              </span>
              {expandedSection === 'confirm' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedSection === 'confirm' && (
            <div className="p-5 border-t border-emerald-200 dark:border-emerald-800/50 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                يتم استدعاء هذا المسار تلقائياً عندما ينقر العميل على زر <strong>"تأكيد الطلب"</strong> داخل رسالة الواتساب التفاعلية المرسلة عبر منصة أكد.
              </p>
              <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X POST "${baseUrl}/api/v1/orders/101/confirm" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json"`}
              </pre>
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-sans">
                النتيجة: تتغير حالة الطلب فورياً في متجرك إلى "مؤكد" مع توثيق وقت التأكيد واسم التطبيق المعتمد.
              </div>
            </div>
          )}
        </div>

        {/* Endpoint 5: POST /api/v1/orders/:id/cancel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div 
            onClick={() => toggleSection('cancel')}
            className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                POST
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/orders/:id/cancel
              </code>
              <span className="text-xs text-slate-500 font-sans hidden sm:inline">إلغاء الطلب مع تسجيل السبب</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                orders:confirm / write
              </span>
              {expandedSection === 'cancel' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedSection === 'cancel' && (
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X POST "${baseUrl}/api/v1/orders/101/cancel" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"reason": "العميل يرغب في تعديل المنتجات لاحقاً"}'`}
              </pre>
            </div>
          )}
        </div>

        {/* Endpoint 6: PUT /api/v1/orders/:id/address */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div 
            onClick={() => toggleSection('address')}
            className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                PUT
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/orders/:id/address
              </code>
              <span className="text-xs text-slate-500 font-sans hidden sm:inline">تعديل عنوان العميل وهاتف الاستلام</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                orders:write
              </span>
              {expandedSection === 'address' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedSection === 'address' && (
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X PUT "${baseUrl}/api/v1/orders/101/address" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "شارع النصر، عمارة 14، الدور الثالث، مدينة نصر",
    "governorate": "القاهرة",
    "phone": "01098765432"
  }'`}
              </pre>
            </div>
          )}
        </div>

        {/* Endpoint 7: PUT /api/v1/orders/:id/status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div 
            onClick={() => toggleSection('status')}
            className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                PUT / PATCH
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/orders/:id/status
              </code>
              <span className="text-xs text-slate-500 font-sans hidden sm:inline">تحديث حالة الطلب (قيد التجهيز، تم الشحن، تم التوصيل)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                orders:status
              </span>
              {expandedSection === 'status' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedSection === 'status' && (
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X PUT "${baseUrl}/api/v1/orders/101/status" \\
  -H "Authorization: Bearer ak_live_xxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "تم الشحن",
    "note": "تم تسليم الشحنة لمندوب التوزيع"
  }'`}
              </pre>
            </div>
          )}
        </div>

        {/* Endpoint 8: DELETE /api/v1/orders/:id */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div 
            onClick={() => toggleSection('delete')}
            className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                DELETE
              </span>
              <code className="text-sm font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                /api/v1/orders/:id
              </code>
              <span className="text-xs text-slate-500 font-sans hidden sm:inline">حذف أو أرشفة الطلب نهائياً</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded font-bold">
                orders:delete
              </span>
              {expandedSection === 'delete' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedSection === 'delete' && (
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto" dir="ltr">
{`curl -X DELETE "${baseUrl}/api/v1/orders/101" \\
  -H "Authorization: Bearer ak_live_xxxxxx"`}
              </pre>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
