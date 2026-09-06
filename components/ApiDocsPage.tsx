import React, { useState, useMemo } from 'react';
import { 
  Code, 
  Key, 
  BookOpen, 
  Zap, 
  Copy, 
  Check, 
  ChevronRight, 
  ExternalLink, 
  Play, 
  ShieldCheck, 
  RefreshCw, 
  Search, 
  Smartphone, 
  Boxes, 
  Package, 
  Truck, 
  Users, 
  FileJson,
  Terminal,
  Database,
  Sparkles,
  Layers
} from 'lucide-react';
import { Store, Settings } from '../types';
import { DocOverviewTab } from './api-docs/DocOverviewTab';
import { DocGenerateKeyTab } from './api-docs/DocGenerateKeyTab';
import { DocOrdersTab } from './api-docs/DocOrdersTab';
import { DocAbandonedCartsTab } from './api-docs/DocAbandonedCartsTab';
import { DocProductsInventoryTab } from './api-docs/DocProductsInventoryTab';
import { DocShippingTab } from './api-docs/DocShippingTab';
import { DocCustomersMessagesTab } from './api-docs/DocCustomersMessagesTab';
import { DocWebhooksTab } from './api-docs/DocWebhooksTab';
import { DocAkkedGuideTab } from './api-docs/DocAkkedGuideTab';
import { DocPlaygroundTab } from './api-docs/DocPlaygroundTab';
import { DocOpenApiTab } from './api-docs/DocOpenApiTab';
import { DocWuiltGraphQLTab } from './api-docs/DocWuiltGraphQLTab';
import { DocWuiltSampleApisTab } from './api-docs/DocWuiltSampleApisTab';
import { DocWuiltGuidesTab } from './api-docs/DocWuiltGuidesTab';

interface ApiDocsPageProps {
  activeStore?: Store | null;
  settings?: Settings;
  currentUser?: any;
}

export type TabType = 
  | 'overview' 
  | 'generate-key' 
  | 'akked-guide'
  | 'wuilt-graphql'
  | 'wuilt-samples'
  | 'wuilt-guides'
  | 'orders-api' 
  | 'abandoned-carts' 
  | 'products-inventory'
  | 'shipping-api'
  | 'customers-messages'
  | 'webhooks' 
  | 'playground'
  | 'openapi';

export default function ApiDocsPage({ activeStore, settings, currentUser }: ApiDocsPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'javascript' | 'python' | 'php'>('curl');

  // Playground state
  const [testEndpoint, setTestEndpoint] = useState('/api/v1/orders');
  const [testMethod, setTestMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('GET');
  const [testApiKey, setTestApiKey] = useState('');
  const [testRequestBody, setTestRequestBody] = useState('{\n  "status": "مؤكد",\n  "note": "تم التأكيد بنجاح عبر الواتساب"\n}');
  const [testOrderId, setTestOrderId] = useState('101');
  const [isLoadingTest, setIsLoadingTest] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);

  const storeName = activeStore?.name || (settings as any)?.storeName || (settings as any)?.companyName || 'متجري الذكي';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-store-domain.com';
  const storeId = activeStore?.id || 'store_default';

  // Helper copy function
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Run Playground API Request
  const handleRunPlayground = async () => {
    setIsLoadingTest(true);
    setTestResponse(null);

    try {
      let finalUrl = testEndpoint.replace(':id', testOrderId || '1');
      if (!finalUrl.startsWith('http')) {
        finalUrl = `${baseUrl}${finalUrl}`;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (testApiKey.trim()) {
        headers['Authorization'] = testApiKey.trim().startsWith('Bearer ') 
          ? testApiKey.trim() 
          : `Bearer ${testApiKey.trim()}`;
        headers['x-api-key'] = testApiKey.trim();
      }

      const options: RequestInit = {
        method: testMethod,
        headers,
      };

      if (testMethod !== 'GET' && testRequestBody.trim()) {
        options.body = testRequestBody;
      }

      const startTime = Date.now();
      const res = await fetch(finalUrl, options);
      const duration = Date.now() - startTime;
      
      let resData: any;
      try {
        resData = await res.json();
      } catch (e) {
        resData = await res.text();
      }

      setTestResponse({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        duration: `${duration}ms`,
        headers: {
          'content-type': res.headers.get('content-type') || 'application/json'
        },
        data: resData
      });
    } catch (err: any) {
      setTestResponse({
        status: 500,
        statusText: 'Client Network Error',
        ok: false,
        duration: '0ms',
        error: err.message || 'فشل الاتصال بالخادم'
      });
    } finally {
      setIsLoadingTest(false);
    }
  };

  // Pre-load default API Key if available in developer keys
  React.useEffect(() => {
    const keys = (settings as any)?.apiKeys || (settings as any)?.developerSettings?.apiKeys || [];
    if (keys.length > 0 && !testApiKey) {
      setTestApiKey(keys[0].key);
    }
  }, [(settings as any)?.apiKeys, (settings as any)?.developerSettings?.apiKeys]);

  // Search filtered nav items
  const navGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const items = [
      { id: 'overview', title: 'نظرة عامة والتوثيق', category: 'getting-started', icon: BookOpen, tag: null },
      { id: 'generate-key', title: 'إنشاء مفتاح API والصلاحيات', category: 'getting-started', icon: Key, tag: null },
      { id: 'akked-guide', title: 'دليل الربط مع أكد (Akked.io)', category: 'getting-started', icon: Smartphone, tag: 'تأكيد واتساب' },

      { id: 'wuilt-graphql', title: 'مخطط وعمليات ويلت (Wuilt GraphQL)', category: 'wuilt-spec', icon: Database, tag: '29 Q / 18 M' },
      { id: 'wuilt-samples', title: 'نماذج الـ API الجاهزة (Sample APIs)', category: 'wuilt-spec', icon: Sparkles, tag: '21 نموذج' },
      { id: 'wuilt-guides', title: 'أدلة اللاندينج بيج والـ AI (Context7)', category: 'wuilt-spec', icon: Layers, tag: 'جديد' },
      
      { id: 'orders-api', title: 'طلبات المتجر (Store Orders)', category: 'endpoints', icon: Boxes, tag: '8 مسارات' },
      { id: 'abandoned-carts', title: 'السلات المتروكة (Abandoned Carts)', category: 'endpoints', icon: Zap, tag: null },
      { id: 'products-inventory', title: 'المنتجات والمخزون (Stock & Products)', category: 'endpoints', icon: Package, tag: null },
      { id: 'shipping-api', title: 'الشحن والتوصيل (Shipping API)', category: 'endpoints', icon: Truck, tag: null },
      { id: 'customers-messages', title: 'العملاء والرسائل (Customers & Messages)', category: 'endpoints', icon: Users, tag: null },
      { id: 'webhooks', title: 'الـ Webhooks والربط اللحظي', category: 'endpoints', icon: RefreshCw, tag: null },

      { id: 'playground', title: 'مختبر التجارب الحي (Playground)', category: 'tools', icon: Play, tag: 'تفاعلي' },
      { id: 'openapi', title: 'تصدير OpenAPI & Postman', category: 'tools', icon: FileJson, tag: 'JSON' },
    ];

    if (!q) return items;
    return items.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.id.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-20">
      
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Brand Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                    {storeName} - وثائق المطورين
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                    REST API v1.0
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
                  {baseUrl}/api/v1
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5">
              <a
                href="/settings/developer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-300 dark:border-slate-700"
              >
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>إدارة المفاتيح</span>
              </a>
              <button
                onClick={() => setActiveTab('playground')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-emerald-600/30"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>تجربة الـ API مباشرة</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث في نقاط الـ API والوثائق..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Navigation Menu */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-sm space-y-1">
              
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                الدليل والبدء السريع
              </div>

              {navGroups.filter(item => item.category === 'getting-started').map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span>{item.title}</span>
                    </div>
                    {item.tag && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                        {item.tag}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Wuilt GraphQL & Spec Section */}
              <div className="pt-2 px-3 py-1 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                <span>مخطط وعمليات ويلت (Wuilt API)</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded font-mono">GraphQL</span>
              </div>

              {navGroups.filter(item => item.category === 'wuilt-spec').map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                      <span>{item.title}</span>
                    </div>
                    {item.tag && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                        {item.tag}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="pt-2 px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                نقاط النهاية (REST Endpoints)
              </div>

              {navGroups.filter(item => item.category === 'endpoints').map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span>{item.title}</span>
                    </div>
                    {item.tag && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono">
                        {item.tag}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="pt-2 px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                أدوات الفحص والاختبار
              </div>

              {navGroups.filter(item => item.category === 'tools').map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span>{item.title}</span>
                    </div>
                    {item.tag && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {item.tag}
                      </span>
                    )}
                  </button>
                );
              })}

            </div>

            {/* Store Quick Credentials Box */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-md space-y-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  بيانات متجرك للربط
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Store ID (معرّف المتجر)</span>
                  <div className="flex items-center justify-between bg-slate-950/70 px-2.5 py-1.5 rounded-lg mt-0.5 border border-slate-800">
                    <span className="text-emerald-300 truncate">{storeId}</span>
                    <button onClick={() => copyToClipboard(storeId, 'storeId')} className="text-slate-400 hover:text-white">
                      {copiedKey === 'storeId' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Store URL (رابط المتجر الأساسي)</span>
                  <div className="flex items-center justify-between bg-slate-950/70 px-2.5 py-1.5 rounded-lg mt-0.5 border border-slate-800">
                    <span className="text-slate-300 truncate" dir="ltr">{baseUrl}</span>
                    <button onClick={() => copyToClipboard(baseUrl, 'baseUrl')} className="text-slate-400 hover:text-white">
                      {copiedKey === 'baseUrl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-6">

            {/* Language Selector Header for Code Blocks */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">لغة الأكواد البرمجية:</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['curl', 'javascript', 'python', 'php'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveCodeLang(lang)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      activeCodeLang === lang
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {lang === 'curl' ? 'cURL' : lang === 'javascript' ? 'JavaScript' : lang === 'python' ? 'Python' : 'PHP'}
                  </button>
                ))}
              </div>
            </div>

            {/* Render Tab Content */}
            {activeTab === 'overview' && (
              <DocOverviewTab
                storeName={storeName}
                baseUrl={baseUrl}
                storeId={storeId}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                activeCodeLang={activeCodeLang}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'generate-key' && (
              <DocGenerateKeyTab
                storeName={storeName}
                baseUrl={baseUrl}
                storeId={storeId}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'akked-guide' && (
              <DocAkkedGuideTab
                storeName={storeName}
                baseUrl={baseUrl}
                storeId={storeId}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'wuilt-graphql' && (
              <DocWuiltGraphQLTab
                storeName={storeName}
                baseUrl={baseUrl}
                storeId={storeId}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'wuilt-samples' && (
              <DocWuiltSampleApisTab
                baseUrl={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'wuilt-guides' && (
              <DocWuiltGuidesTab
                storeName={storeName}
                baseUrl={baseUrl}
                storeId={storeId}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'orders-api' && (
              <DocOrdersTab
                baseUrl={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                activeCodeLang={activeCodeLang}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'abandoned-carts' && (
              <DocAbandonedCartsTab
                baseUrl={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                activeCodeLang={activeCodeLang}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'products-inventory' && (
              <DocProductsInventoryTab
                baseUrl={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                activeCodeLang={activeCodeLang}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'shipping-api' && (
              <DocShippingTab
                baseUrl={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                activeCodeLang={activeCodeLang}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'customers-messages' && (
              <DocCustomersMessagesTab
                baseUrl={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                activeCodeLang={activeCodeLang}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'webhooks' && (
              <DocWebhooksTab
                baseUrl={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
                activeCodeLang={activeCodeLang}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'playground' && (
              <DocPlaygroundTab
                baseUrl={baseUrl}
                testApiKey={testApiKey}
                setTestApiKey={setTestApiKey}
                testEndpoint={testEndpoint}
                setTestEndpoint={setTestEndpoint}
                testMethod={testMethod}
                setTestMethod={setTestMethod}
                testRequestBody={testRequestBody}
                setTestRequestBody={setTestRequestBody}
                testOrderId={testOrderId}
                setTestOrderId={setTestOrderId}
                isLoadingTest={isLoadingTest}
                testResponse={testResponse}
                handleRunPlayground={handleRunPlayground}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
              />
            )}

            {activeTab === 'openapi' && (
              <DocOpenApiTab
                storeName={storeName}
                baseUrl={baseUrl}
                copyToClipboard={copyToClipboard}
                copiedKey={copiedKey}
              />
            )}

          </div>
        </div>
      </div>

    </div>
  );
}
