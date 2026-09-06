import React, { useState, useMemo } from 'react';
import { 
  Code, 
  Search, 
  Copy, 
  Check, 
  ShoppingCart, 
  Package, 
  Users, 
  Zap, 
  Sliders, 
  Terminal, 
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { WUILT_SAMPLE_APIS, WuiltSampleApi } from '../../data/wuiltSchemaData';

interface DocWuiltSampleApisTabProps {
  baseUrl: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  setActiveTab: (tab: any) => void;
}

export const DocWuiltSampleApisTab: React.FC<DocWuiltSampleApisTabProps> = ({
  baseUrl,
  copyToClipboard,
  copiedKey,
  setActiveTab
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApi, setSelectedApi] = useState<WuiltSampleApi>(WUILT_SAMPLE_APIS[0]);

  const categories = ['ALL', 'Cart & Checkout', 'Products & Collections', 'Orders & Customers'];

  const filteredApis = useMemo(() => {
    return WUILT_SAMPLE_APIS.filter(api => {
      const matchCat = selectedCategory === 'ALL' || api.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || 
        api.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        api.arabicTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Wuilt Sample APIs Library
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              21 نماذج جاهزة
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            نماذج الـ API الجاهزة (Wuilt Sample APIs)
          </h2>

          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            مجموعة متكاملة من 21 نموذج واستعلام GraphQL مع المتغيرات وهياكل الاستجابة الجاهزة لبناء سلات الشراء المخصصة، صفحات الهبوط، استرجاع الطلبات، وإدارة المخزون والتصنيفات.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="ابحث في نماذج الـ API (مثل: AddToCart, ApplyPromoCode, CheckoutCart)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'جميع النماذج (21)' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layout: Sidebar list + Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* List of Sample APIs (col-4) */}
        <div className="lg:col-span-4 space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {filteredApis.map((api) => {
            const isSelected = selectedApi.id === api.id;
            return (
              <button
                key={api.id}
                onClick={() => setSelectedApi(api)}
                className={`w-full text-right p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {api.name}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                    api.type === 'Query'
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {api.type}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                  {api.arabicTitle}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {api.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* API Code & Example Details (col-8) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    selectedApi.type === 'Query'
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {selectedApi.type}
                  </span>
                  <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {selectedApi.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-sans">
                    {selectedApi.category}
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  {selectedApi.arabicTitle}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {selectedApi.description}
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(selectedApi.query, `sample_${selectedApi.id}`)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
              >
                {copiedKey === `sample_${selectedApi.id}` ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الكود</span>
                  </>
                )}
              </button>
            </div>

            {/* GraphQL Query Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-emerald-500" />
                  GraphQL Query / Mutation:
                </span>
              </div>
              <div className="bg-slate-950 text-emerald-300 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
                <pre className="whitespace-pre leading-relaxed">{selectedApi.query}</pre>
              </div>
            </div>

            {/* Variables Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                  GraphQL Variables:
                </span>
                <button
                  onClick={() => copyToClipboard(selectedApi.variables, `vars_${selectedApi.id}`)}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  نسخ المتغيرات
                </button>
              </div>
              <div className="bg-slate-950 text-amber-300 rounded-xl p-3 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
                <pre className="whitespace-pre leading-relaxed">{selectedApi.variables}</pre>
              </div>
            </div>

            {/* Response Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                  الاستجابة المتوقعة (Response JSON):
                </span>
              </div>
              <div className="bg-slate-950 text-cyan-300 rounded-xl p-3 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
                <pre className="whitespace-pre leading-relaxed">{selectedApi.response}</pre>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
