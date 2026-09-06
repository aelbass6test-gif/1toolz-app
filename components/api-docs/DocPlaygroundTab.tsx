import React, { useState } from 'react';
import { Play, Send, RefreshCw, Copy, Check, Terminal, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DocPlaygroundTabProps {
  baseUrl: string;
  testApiKey: string;
  setTestApiKey: (key: string) => void;
  testEndpoint: string;
  setTestEndpoint: (ep: string) => void;
  testMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  setTestMethod: (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') => void;
  testRequestBody: string;
  setTestRequestBody: (body: string) => void;
  testOrderId: string;
  setTestOrderId: (id: string) => void;
  isLoadingTest: boolean;
  testResponse: any;
  handleRunPlayground: () => void;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
}

const PRESET_REQUESTS = [
  {
    name: 'استعلام الطلبات (GET /api/v1/orders)',
    method: 'GET' as const,
    endpoint: '/api/v1/orders',
    body: '',
  },
  {
    name: 'تأكيد طلب (POST /api/v1/orders/:id/confirm)',
    method: 'POST' as const,
    endpoint: '/api/v1/orders/:id/confirm',
    body: '',
  },
  {
    name: 'إلغاء طلب مع السبب (POST /api/v1/orders/:id/cancel)',
    method: 'POST' as const,
    endpoint: '/api/v1/orders/:id/cancel',
    body: '{\n  "reason": "العميل يرغب في تغيير وقت التوصيل"\n}',
  },
  {
    name: 'تعديل عنوان الطلب (PUT /api/v1/orders/:id/address)',
    method: 'PUT' as const,
    endpoint: '/api/v1/orders/:id/address',
    body: '{\n  "address": "شارع النصر، عمارة 14، الدور الثالث، مدينة نصر",\n  "governorate": "القاهرة"\n}',
  },
  {
    name: 'تحديث حالة الطلب (PUT /api/v1/orders/:id/status)',
    method: 'PUT' as const,
    endpoint: '/api/v1/orders/:id/status',
    body: '{\n  "status": "تم الشحن",\n  "note": "تم تسليم الشحنة لمندوب التوزيع"\n}',
  },
  {
    name: 'قراءة السلات المتروكة (GET /api/v1/abandoned-carts)',
    method: 'GET' as const,
    endpoint: '/api/v1/abandoned-carts',
    body: '',
  },
  {
    name: 'قراءة المخزون (GET /api/v1/inventory)',
    method: 'GET' as const,
    endpoint: '/api/v1/inventory',
    body: '',
  },
  {
    name: 'قراءة شحنات التوصيل (GET /api/v1/shipping/orders)',
    method: 'GET' as const,
    endpoint: '/api/v1/shipping/orders',
    body: '',
  },
  {
    name: 'إرسال رسالة واتساب (POST /api/v1/messages/send)',
    method: 'POST' as const,
    endpoint: '/api/v1/messages/send',
    body: '{\n  "phone": "01012345678",\n  "message": "مرحباً يا فندم، طلبك قيد التجهيز الآن!"\n}',
  }
];

export const DocPlaygroundTab: React.FC<DocPlaygroundTabProps> = ({
  baseUrl,
  testApiKey,
  setTestApiKey,
  testEndpoint,
  setTestEndpoint,
  testMethod,
  setTestMethod,
  testRequestBody,
  setTestRequestBody,
  testOrderId,
  setTestOrderId,
  isLoadingTest,
  testResponse,
  handleRunPlayground,
  copyToClipboard,
  copiedKey,
}) => {
  const applyPreset = (pr: typeof PRESET_REQUESTS[0]) => {
    setTestMethod(pr.method);
    setTestEndpoint(pr.endpoint);
    if (pr.body) {
      setTestRequestBody(pr.body);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Play size={18} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            مختبر التجارب التفاعلي (Interactive Live API Playground)
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          قم بتجربة أي نقطة نهاية (Endpoint) مباشرة ضد خادم متجرك وفحص الاستجابة الحية والـ Status Code وسرعة المعالجة في الوقت الفعلي.
        </p>
      </div>

      {/* Preset Quick Selectors */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">نماذج طلبات جاهزة للتجربة الفورية:</span>
        <div className="flex flex-wrap gap-2">
          {PRESET_REQUESTS.map((pr, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(pr)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-slate-700 dark:text-slate-300 transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                pr.method === 'GET' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600' :
                pr.method === 'POST' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' :
                'bg-amber-100 dark:bg-amber-950 text-amber-600'
              }`}>
                {pr.method}
              </span>
              <span>{pr.name.split(' (')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Request Configurator Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        
        {/* Method & Endpoint Input */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">نوع الطلب (Method)</label>
            <select
              value={testMethod}
              onChange={(e) => setTestMethod(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div className="sm:col-span-9">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المسار (Endpoint)</label>
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono">
              <span className="text-slate-400 select-none pl-1" dir="ltr">{baseUrl}</span>
              <input
                type="text"
                value={testEndpoint}
                onChange={(e) => setTestEndpoint(e.target.value)}
                className="w-full bg-transparent text-slate-900 dark:text-white focus:outline-none"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Dynamic ID Parameter if endpoint contains :id */}
        {testEndpoint.includes(':id') && (
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              معرف أو رقم الطلب (:id) المراد اختباره:
            </label>
            <input
              type="text"
              value={testOrderId}
              onChange={(e) => setTestOrderId(e.target.value)}
              placeholder="مثال: 101 أو ord_8921"
              className="w-full sm:w-64 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>
        )}

        {/* API Key Header */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
            مفتاح المصادقة (API Key Header):
          </label>
          <input
            type="text"
            value={testApiKey}
            onChange={(e) => setTestApiKey(e.target.value)}
            placeholder="ak_live_xxxxxxxxxxxxxxxx"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
            dir="ltr"
          />
        </div>

        {/* Request Body for POST / PUT / PATCH */}
        {testMethod !== 'GET' && (
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              جسم الطلب (JSON Request Body):
            </label>
            <textarea
              rows={4}
              value={testRequestBody}
              onChange={(e) => setTestRequestBody(e.target.value)}
              className="w-full bg-slate-950 text-slate-100 rounded-xl p-3 text-xs font-mono focus:outline-none border border-slate-800"
              dir="ltr"
            />
          </div>
        )}

        {/* Execute Button */}
        <button
          onClick={handleRunPlayground}
          disabled={isLoadingTest}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
        >
          {isLoadingTest ? (
            <>
              <RefreshCw className="animate-spin" size={16} />
              <span>جاري إرسال الطلب ومعالجة الاستجابة...</span>
            </>
          ) : (
            <>
              <Send size={16} />
              <span>إرسال الطلب وتجربة الاستجابة الحية (Send Request)</span>
            </>
          )}
        </button>
      </div>

      {/* Response Display Box */}
      {testResponse && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                testResponse.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                {testResponse.status} {testResponse.statusText}
              </span>
              <span className="text-xs text-slate-500 font-mono">الزمن: {testResponse.duration}</span>
            </div>
            <button
              onClick={() => copyToClipboard(JSON.stringify(testResponse.data, null, 2), 'testRes')}
              className="text-xs text-slate-500 hover:text-emerald-500 flex items-center gap-1"
            >
              {copiedKey === 'testRes' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span>نسخ الاستجابة</span>
            </button>
          </div>

          <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-96" dir="ltr">
            {JSON.stringify(testResponse.data || testResponse.error, null, 2)}
          </pre>
        </div>
      )}

    </div>
  );
};
