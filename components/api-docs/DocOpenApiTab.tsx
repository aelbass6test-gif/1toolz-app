import React from 'react';
import { Download, FileJson, Copy, Check, ExternalLink, Code } from 'lucide-react';

interface DocOpenApiTabProps {
  storeName: string;
  baseUrl: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
}

export const DocOpenApiTab: React.FC<DocOpenApiTabProps> = ({
  storeName,
  baseUrl,
  copyToClipboard,
  copiedKey,
}) => {
  const openApiSpec = {
    openapi: "3.0.0",
    info: {
      title: `${storeName} REST API`,
      description: `Official Store REST API documentation for orders, akked.io WhatsApp integration, abandoned carts, and shipping.`,
      version: "1.0.0"
    },
    servers: [
      {
        url: `${baseUrl}/api/v1`,
        description: "Live Store Production Server"
      }
    ],
    paths: {
      "/orders": {
        get: {
          summary: "List all orders",
          responses: {
            "200": { description: "Array of orders" }
          }
        },
        post: {
          summary: "Create a new order",
          responses: {
            "201": { description: "Order created successfully" }
          }
        }
      },
      "/orders/{id}/confirm": {
        post: {
          summary: "Confirm order via Akked / WhatsApp",
          responses: {
            "200": { description: "Order status updated to confirmed" }
          }
        }
      },
      "/orders/{id}/cancel": {
        post: {
          summary: "Cancel order with reason",
          responses: {
            "200": { description: "Order canceled" }
          }
        }
      },
      "/orders/{id}/address": {
        put: {
          summary: "Update delivery address and recipient phone",
          responses: {
            "200": { description: "Address updated" }
          }
        }
      },
      "/abandoned-carts": {
        get: {
          summary: "List abandoned shopping carts",
          responses: {
            "200": { description: "List of abandoned carts" }
          }
        }
      },
      "/shipping/orders": {
        get: {
          summary: "List shipping manifests for couriers",
          responses: {
            "200": { description: "Orders ready for shipment" }
          }
        }
      }
    }
  };

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(openApiSpec, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `openapi-spec-${storeName.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <FileJson size={18} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            مواصفات OpenAPI 3.0 وتصدير Postman Collection
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          يمكنك تنزيل ملف المواصفات القياسية (OpenAPI Specification) لاستيراده مباشرة في برنامج <strong>Postman</strong>، <strong>Swagger UI</strong>، أو <strong>Insomnia</strong> لاختبار كافة المسارات بنقرة زر واحدة.
        </p>
      </div>

      {/* Action Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-1">ملف المواصفات البرمجية الجاهز (openapi.json)</h3>
          <p className="text-xs text-slate-500">يتضمن كافة الـ Endpoints والـ Schemas المحدثة الخاصة بمتجرك.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => copyToClipboard(JSON.stringify(openApiSpec, null, 2), 'openapiJson')}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            {copiedKey === 'openapiJson' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            <span>نسخ JSON</span>
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>تنزيل ملف openapi.json</span>
          </button>
        </div>
      </div>

      {/* Preview JSON */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">معاينة ملف OpenAPI 3.0:</span>
        <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-96" dir="ltr">
          {JSON.stringify(openApiSpec, null, 2)}
        </pre>
      </div>

    </div>
  );
};
