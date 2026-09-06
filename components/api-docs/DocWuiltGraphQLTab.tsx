import React, { useState, useMemo } from 'react';
import { 
  Code, 
  Search, 
  Copy, 
  Check, 
  Layers, 
  Database, 
  Hash, 
  Filter, 
  Terminal, 
  Key, 
  Info, 
  ChevronRight, 
  Zap, 
  FileCode, 
  Sliders,
  ExternalLink,
  BookOpen,
  Boxes
} from 'lucide-react';
import { 
  WUILT_MUTATIONS, 
  WUILT_QUERIES, 
  WUILT_ALL_ENUMS, 
  WUILT_ALL_INPUTS, 
  WUILT_SCALARS, 
  WUILT_DIRECTIVES, 
  WUILT_INTERFACES,
  WuiltOperation
} from '../../data/wuiltSchemaData';

interface DocWuiltGraphQLTabProps {
  storeName: string;
  baseUrl: string;
  storeId: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  setActiveTab: (tab: any) => void;
}

export const DocWuiltGraphQLTab: React.FC<DocWuiltGraphQLTabProps> = ({
  storeName,
  baseUrl,
  storeId,
  copyToClipboard,
  copiedKey,
  setActiveTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'operations' | 'schema-explorer' | 'api-keys-guide'>('operations');
  const [operationType, setOperationType] = useState<'ALL' | 'Query' | 'Mutation'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [schemaSearchQuery, setSchemaSearchQuery] = useState('');
  const [selectedOperation, setSelectedOperation] = useState<WuiltOperation>(WUILT_QUERIES[0]);
  const [schemaTypeFilter, setSchemaTypeFilter] = useState<'all' | 'enums' | 'inputs' | 'interfaces' | 'scalars' | 'directives'>('all');

  const allOperations = useMemo(() => {
    return [...WUILT_QUERIES, ...WUILT_MUTATIONS];
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    allOperations.forEach(op => cats.add(op.category));
    return ['ALL', ...Array.from(cats)];
  }, [allOperations]);

  const filteredOperations = useMemo(() => {
    return allOperations.filter(op => {
      const matchType = operationType === 'ALL' || op.type === operationType;
      const matchCategory = selectedCategory === 'ALL' || op.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || 
        op.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        op.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchCategory && matchSearch;
    });
  }, [allOperations, operationType, selectedCategory, searchQuery]);

  // Filtered Schema items
  const filteredEnums = useMemo(() => {
    if (!schemaSearchQuery.trim()) return WUILT_ALL_ENUMS;
    return WUILT_ALL_ENUMS.filter(e => e.toLowerCase().includes(schemaSearchQuery.toLowerCase()));
  }, [schemaSearchQuery]);

  const filteredInputs = useMemo(() => {
    if (!schemaSearchQuery.trim()) return WUILT_ALL_INPUTS;
    return WUILT_ALL_INPUTS.filter(i => i.toLowerCase().includes(schemaSearchQuery.toLowerCase()));
  }, [schemaSearchQuery]);

  return (
    <div className="space-y-6">
      
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Wuilt GraphQL API Engine
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              GraphQL v1.0
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            توثيق واستكشاف واجهة برمجيات ويلت (Wuilt GraphQL Operations & Schema)
          </h2>

          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            المرجع البرمجي الكامل والشامل لمنصة ويلت (Wuilt) — يشمل جميع استعلامات الـ Queries (29)، والعمليات الـ Mutations (18)، والأنواع Types، وEnums، وInputs، مع محرر تفاعلي جاهز للتجربة والربط المباشر.
          </p>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSubTab('operations')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'operations'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>العمليات البرمجية (Queries & Mutations)</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-900 text-[10px]">{allOperations.length}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('schema-explorer')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'schema-explorer'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>مستكشف المخطط والأنواع (Schema & Types Explorer)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('api-keys-guide')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'api-keys-guide'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>استخراج مفاتيح API ومعرّف المتجر</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: OPERATIONS (QUERIES & MUTATIONS) */}
      {activeSubTab === 'operations' && (
        <div className="space-y-6">
          
          {/* Controls & Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="ابحث عن عملية (مثال: orders, createProduct, markOrderAsPaid)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Type Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['ALL', 'Query', 'Mutation'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOperationType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      operationType === t
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {t === 'ALL' ? 'الكل' : t === 'Query' ? 'Queries (استعلام)' : 'Mutations (تعديل)'}
                  </button>
                ))}
              </div>

            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 text-[11px] font-bold ml-1 shrink-0">التصنيف:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-300 dark:border-indigo-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat === 'ALL' ? 'كافة التصنيفات' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Master Detail View: List + Viewer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Operations List (col-4) */}
            <div className="lg:col-span-4 space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredOperations.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
                  لا توجد عمليات مطابقة لخيارات البحث الحالية
                </div>
              ) : (
                filteredOperations.map((op) => {
                  const isSelected = selectedOperation.name === op.name;
                  return (
                    <button
                      key={op.name}
                      onClick={() => setSelectedOperation(op)}
                      className={`w-full text-right p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {op.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                          op.type === 'Query'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {op.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {op.description}
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Right Operation Code Viewer (col-8) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                
                {/* Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        selectedOperation.type === 'Query'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {selectedOperation.type}
                      </span>
                      <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                        {selectedOperation.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-sans">
                        {selectedOperation.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {selectedOperation.description}
                    </p>
                  </div>

                  <button
                    onClick={() => copyToClipboard(selectedOperation.graphql, `op_${selectedOperation.name}`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                  >
                    {copiedKey === `op_${selectedOperation.name}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الاستعلام</span>
                      </>
                    )}
                  </button>
                </div>

                {/* GraphQL Query Code Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                      استعلام GraphQL (Query / Mutation Payload):
                    </span>
                  </div>
                  <div className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
                    <pre className="text-indigo-300 whitespace-pre leading-relaxed">{selectedOperation.graphql}</pre>
                  </div>
                </div>

                {/* Variables Box */}
                {selectedOperation.variables && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-amber-500" />
                        متغيرات الاستعلام (GraphQL Variables):
                      </span>
                      <button
                        onClick={() => copyToClipboard(selectedOperation.variables || '', `vars_${selectedOperation.name}`)}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        نسخ المتغيرات
                      </button>
                    </div>
                    <div className="bg-slate-950 text-amber-300 rounded-xl p-3 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
                      <pre className="whitespace-pre leading-relaxed">{selectedOperation.variables}</pre>
                    </div>
                  </div>
                )}

                {/* Sample JSON Response */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                      الاستجابة النموذجية (Expected JSON Response):
                    </span>
                  </div>
                  <div className="bg-slate-950 text-emerald-300 rounded-xl p-3 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
                    <pre className="whitespace-pre leading-relaxed">{selectedOperation.responseExample}</pre>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* SUB-TAB 2: SCHEMA & TYPES EXPLORER */}
      {activeSubTab === 'schema-explorer' && (
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="ابحث في الأنواع (Enums, Inputs, Scalars, Interfaces)..."
                  value={schemaSearchQuery}
                  onChange={(e) => setSchemaSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Filter Type */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'enums', label: `Enums (${WUILT_ALL_ENUMS.length})` },
                  { id: 'inputs', label: `Inputs (${WUILT_ALL_INPUTS.length})` },
                  { id: 'scalars', label: `Scalars (${WUILT_SCALARS.length})` },
                  { id: 'directives', label: `Directives (${WUILT_DIRECTIVES.length})` },
                  { id: 'interfaces', label: `Interfaces (${WUILT_INTERFACES.length})` }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSchemaTypeFilter(item.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      schemaTypeFilter === item.id
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* Section: Directives */}
          {(schemaTypeFilter === 'all' || schemaTypeFilter === 'directives') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  التوجيهات القياسية (Directives)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {WUILT_DIRECTIVES.map((d) => (
                  <div key={d.name} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">@{d.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                        {d.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{d.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Scalars */}
          {(schemaTypeFilter === 'all' || schemaTypeFilter === 'scalars') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  القيم الأساسية (Scalars)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {WUILT_SCALARS.map((s) => (
                  <div key={s.name} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{s.name}</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Interfaces */}
          {(schemaTypeFilter === 'all' || schemaTypeFilter === 'interfaces') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  الواجهات المشتركة (Interfaces)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {WUILT_INTERFACES.map((i) => (
                  <div key={i.name} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{i.name}</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{i.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Enums */}
          {(schemaTypeFilter === 'all' || schemaTypeFilter === 'enums') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    قوائم الثوابت المعرفة (Enums)
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {filteredEnums.length} / {WUILT_ALL_ENUMS.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto p-1">
                {filteredEnums.map((e) => (
                  <span
                    key={e}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 hover:scale-105 transition-transform"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section: Inputs */}
          {(schemaTypeFilter === 'all' || schemaTypeFilter === 'inputs') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-purple-500" />
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    أنواع المدخلات (Input Types)
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {filteredInputs.length} / {WUILT_ALL_INPUTS.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto p-1">
                {filteredInputs.map((i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60 hover:scale-105 transition-transform"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 3: API KEYS & STORE ID GUIDE */}
      {activeSubTab === 'api-keys-guide' && (
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Generating API Keys in Wuilt (توليد مفاتيح الربط في ويلت)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  خطوات إنشاء وتفعيل مفاتيح الـ API للوصول إلى بيانات متجرك واستخدام الـ GraphQL
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">الدخول إلى لوحة التحكم</h4>
                  <p>قم بالدخول إلى لوحة إدارة متجرك على منصة ويلت (Wuilt Dashboard) باستخدام حساب المالك أو المدير.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">الانتقال إلى إعدادات المطورين (Developer Settings)</h4>
                  <p>من القائمة الجانبية، اختر <strong>الإعدادات (Settings)</strong> ثم توجه إلى <strong>واجهات الربط والمطورين (API & Integrations)</strong>.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">توليد مفتاح جديد (Generate New API Key)</h4>
                  <p>انقر على زر <strong>إنشاء مفتاح جديد</strong>، وحدد اسماً معبراً للمفتاح (مثل: <code>Smart-Orders-Bot</code>)، واختر الصلاحيات المطلوبة (Orders, Products, Shipping, Customers).</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">4</span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">نسخ المفتاح وحفظه بأمان</h4>
                  <p>انسخ المفتاح الذي يبدأ بـ <code>ak_live_...</code> أو <code>wuilt_key_...</code> واحتفظ به في مكان آمن، حيث لن تتمكن من رؤيته بالكامل مرة أخرى لأسباب أمنية.</p>
                </div>
              </div>
            </div>

            {/* How to Find Your Store ID */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-500" />
                How to Find Your Store ID (كيفية معرفة معرّف المتجر)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                معرّف المتجر (Store ID) هو المعرّف الفريد لمتجرك في منصة ويلت ويُطلب في ترويسات الاستعلامات وفي تطبيقات الربط مثل أكد (Akked.io) وبوابات الدفع:
              </p>
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-2 text-xs">
                <div className="font-bold text-emerald-900 dark:text-emerald-200">
                  الطريقة المباشرة:
                </div>
                <p className="text-emerald-800 dark:text-emerald-300">
                  ستجد الـ Store ID موجوداً في شريط عنوان المتصفح أثناء تصفحك للوحة التحكم على هيئة:
                  <code className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded mr-1 font-mono text-[11px]" dir="ltr">
                    https://admin.wuilt.com/stores/<strong>[STORE_ID]</strong>/dashboard
                  </code>
                </p>
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-emerald-300 dark:border-emerald-700 mt-2 font-mono">
                  <span className="text-slate-700 dark:text-slate-300">معرّف متجرك الحالي: <strong>{storeId}</strong></span>
                  <button
                    onClick={() => copyToClipboard(storeId, 'guide_store_id')}
                    className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    {copiedKey === 'guide_store_id' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    نسخ المعرّف
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
