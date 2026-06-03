import React, { useState } from 'react';
import { StoreData, Product } from '../types';
import { CheckCircle2, ChevronLeft, Cable, HardDriveDownload, Search, Shapes, X, RefreshCw, ListChecks, CheckCircle, Package, ImageIcon, Save, XCircle } from 'lucide-react';

interface AppsPageProps {
  storeId: string;
  storeData: StoreData | null;
  onUpdateSettings: (settings: any) => void;
  onUpdateOrders?: (orders: any) => void;
  onRefresh?: () => Promise<void>;
  hostUrl: string;
}

interface PlatformConfig {
  appId: string;
  apiKey?: string;
  apiSecret?: string;
  shopUrl?: string;
  shopId?: string;
  lastSync?: string;
  lastProductSync?: string;
  isActive: boolean;
}

const AVAILABLE_APPS = [
  {
    id: 'wuilt',
    name: 'ويلت (Wuilt)',
    description: 'ربط مباشر عبر API لاستيراد الطلبات وتحديث حالتها تلقائياً، مع دعم مزامنة المنتجات بشكل كامل.',
    logo: 'https://cdn.prod.website-files.com/614319338322d2f96eb4dd96/62124643bd803240ec14b13a_Wuilt%20logo.svg',
    type: 'store',
    tags: ['E-commerce', 'Full Sync', 'API'],
    needsApi: true,
    supportedFeatures: ['orders', 'products']
  },
  {
    id: 'shopify',
    name: 'شوبيفاي (Shopify)',
    description: 'استيراد كامل للطلبات والمخزون عبر Shopify Admin API.',
    logo: 'https://cdn.shopify.com/assets/images/logos/shopify-bag.png',
    type: 'store',
    tags: ['E-commerce', 'API'],
    needsApi: true,
    supportedFeatures: ['orders']
  },
  {
    id: 'salla',
    name: 'سلة (Salla)',
    description: 'ربط كامل مع أوامر سلة، المبيعات وحالة الشحن عبر API.',
    logo: 'https://cdn.salla.network/images/logo/logo-square.png',
    type: 'store',
    tags: ['E-commerce', 'Saudi Arabia', 'API'],
    needsApi: true,
    supportedFeatures: ['orders']
  },
  {
    id: 'zid',
    name: 'زد (Zid)',
    description: 'إدارة طلبات زد وتحديث محفظة المتجر عبر API.',
    logo: 'https://zid.sa/wp-content/uploads/2021/04/Zid-Logo-01.png',
    type: 'store',
    tags: ['E-commerce', 'Saudi Arabia', 'API'],
    needsApi: true,
    supportedFeatures: ['orders']
  },
  {
    id: 'taager',
    name: 'تاجر (Taager)',
    description: 'لربط نظام الدروبشيبينج بالمنصة وإرسال الطلبات تلقائياً عبر API.',
    logo: 'https://taager.com/assets/images/taager-logo-colored.svg',
    type: 'supplier',
    tags: ['Dropshipping', 'API'],
    needsApi: true,
    supportedFeatures: ['orders']
  }
];

export default function AppsPage({ storeId, storeData, onUpdateSettings, onUpdateOrders, onRefresh, hostUrl }: AppsPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<Partial<PlatformConfig>>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingProducts, setSyncingProducts] = useState<string | null>(null);

  // Selective Sync State
  const [showSelectiveModal, setShowSelectiveModal] = useState(false);
  const [selectableProducts, setSelectableProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isFetchingSelectable, setIsFetchingSelectable] = useState(false);

  const connectedPlatforms = storeData?.settings?.connectedPlatforms || [];
  const platformConfigs: Record<string, PlatformConfig> = (storeData?.settings as any)?.platformConfigs || {};

  const [appToUninstall, setAppToUninstall] = useState<string | null>(null);

  const handleInstallApp = () => {
    if (!storeData || !selectedApp) return;
    
    let currentPlatforms = storeData.settings.connectedPlatforms || [];
    const currentConfigs = (storeData.settings as any).platformConfigs || {};

    const updatedSettings = {
        ...storeData.settings,
        connectedPlatforms: currentPlatforms.includes(selectedApp.id) 
            ? currentPlatforms 
            : [...currentPlatforms, selectedApp.id],
        platformConfigs: {
            ...currentConfigs,
            [selectedApp.id]: {
               appId: selectedApp.id,
               ...config,
               isActive: true
            }
        }
    };
    onUpdateSettings(updatedSettings);
    setIsModalOpen(false);
    setConfig({});
  };

  const confirmUninstallApp = () => {
      if (!storeData || !appToUninstall) return;

      const currentPlatforms = storeData.settings.connectedPlatforms || [];
      const currentConfigs = (storeData.settings as any).platformConfigs || {};
      
      const newConfigs = { ...currentConfigs };
      delete newConfigs[appToUninstall];

      const updatedSettings = {
          ...storeData.settings,
          connectedPlatforms: currentPlatforms.filter(id => id !== appToUninstall),
          platformConfigs: newConfigs
      };
      onUpdateSettings(updatedSettings);
      setAppToUninstall(null);
  };

  const updateSyncTime = (appId: string, syncType: 'orders' | 'products', additionalData?: any) => {
    onUpdateSettings((prev: any) => {
        const currentConfigs = prev.platformConfigs || {};
        const fieldName = syncType === 'orders' ? 'lastSync' : 'lastProductSync';
        
        let newProducts = prev.products || [];
        if (additionalData?.items && additionalData.items.length > 0) {
            const existingMap = new Map(newProducts.map((p: any) => [p.id, p]));
            additionalData.items.forEach((item: any) => existingMap.set(item.id, item));
            newProducts = Array.from(existingMap.values());
        }

        return {
            ...prev,
            products: newProducts,
            platformConfigs: {
                ...currentConfigs,
                [appId]: {
                    ...currentConfigs[appId],
                    [fieldName]: new Date().toLocaleString('ar-EG')
                }
            }
        };
    });
  };

  const handleSyncOrders = async (appId: string) => {
    setSyncing(appId);
    try {
        const response = await fetch(`/api/sync/platform/${appId}/${storeId}?type=orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (response.ok) {
            if (data.items && data.items.length > 0 && onUpdateOrders) {
                onUpdateOrders((prev: any) => {
                    const newOrders = prev || [];
                    const existingMap = new Map(newOrders.map((o: any) => [o.id, o]));
                    data.items.forEach((item: any) => existingMap.set(item.id, item));
                    return Array.from(existingMap.values());
                });
            }
            updateSyncTime(appId, 'orders');
            // Background refresh to true up any other fields if needed, 
            // the state is already optimistic so auto-save won't wipe it locally.
            if (onRefresh) onRefresh();
            alert(`نجحت المزامنة! تم إضافة/تحديث ${data.updated + data.inserted} طلب.`);
        } else {
            alert(`خطأ في المزامنة: ${data.error}`);
        }
    } catch (error) {
        console.error('Sync error:', error);
        alert('حدث خطأ أثناء محاولة الاتصال بالسيرفر للمزامنة.');
    } finally {
        setSyncing(null);
    }
  };

  const handleSyncProducts = async (appId: string, selectedIds?: string[]) => {
    const isSelective = !!selectedIds;
    if (isSelective) setSyncingProducts(appId); // Use local state for modal button
    else setSyncing(appId + '-products');

    try {
        const response = await fetch(`/api/sync/platform/${appId}/${storeId}?type=products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: selectedIds ? JSON.stringify({ selectedIds }) : undefined
        });

        const data = await response.json();

        if (response.ok) {
            updateSyncTime(appId, 'products', { items: data.items });
            alert(isSelective ? `تم استيراد ${data.updated + data.inserted} منتج بنجاح!` : `نجحت المزامنة! تم تحديث/إضافة ${data.updated + data.inserted} منتج.`);
            if (isSelective) setShowSelectiveModal(false);
        } else {
            alert(`خطأ في مزامنة المنتجات: ${data.error}`);
        }
    } catch (error) {
        console.error('Product sync error:', error);
        alert('حدث خطأ أثناء محاولة التزامن للمنتجات.');
    } finally {
        setSyncingProducts(null);
        setSyncing(null);
    }
  };

  const handleFetchSelectable = async (appId: string) => {
     setIsFetchingSelectable(true);
     console.log(`[DEBUG] Fetching selectable products for ${appId}, storeId: ${storeId}`);
     try {
         const response = await fetch(`/api/sync/platform/${appId}/${storeId}/preview?type=products`);
         const text = await response.text();
         console.log(`[DEBUG] Preview response status: ${response.status}, length: ${text.length}`);
         
         let data;
         try {
             data = JSON.parse(text);
         } catch (e) {
             console.error(`[DEBUG] JSON parse error. First 200 chars of response: ${text.substring(0, 200)}`);
             throw new Error('فشل في قراءة بيانات السيرفر (تنسيق غير مدعوم). قد تكون هناك مشكلة في الاتصال.');
         }

         if (response.ok) {
             setSelectableProducts(data.items || []);
             setShowSelectiveModal(true);
         } else {
             alert(`فشل جلب المنتجات: ${data.error}`);
         }
     } catch (error) {
         console.error('[DEBUG] Fetch error:', error);
         alert('حدث خطأ أثناء محاولة الاتصال بالسيرفر.');
     } finally {
         setIsFetchingSelectable(false);
     }
  };

  const openSettings = (app) => {
      setSelectedApp(app);
      setConfig(platformConfigs[app.id] || {});
      setIsModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredApps = AVAILABLE_APPS.filter(app => app.name.includes(searchTerm) || app.description.includes(searchTerm));

  const getWebhookUrl = (appId: string) => {
     return `${hostUrl}/api/webhook/platform/${appId}/${storeId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">مركز التحكم والربط (Integrations)</h2>
          <p className="text-slate-500 dark:text-slate-400 mr-1 mt-1">تحكم في جميع أتمتة متجرك وعمليات المزامنة من مكان واحد.</p>
        </div>
        <div className="bg-indigo-100 p-3 rounded-full hidden sm:block dark:bg-indigo-900/30">
           <Shapes className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>

      <div className="flex gap-4 items-center">
         <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
               type="text"
               placeholder="ابحث عن تطبيق أو منصة..." 
               className="w-full pr-9 pl-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {filteredApps.map((app) => {
            const isConnected = connectedPlatforms.includes(app.id);
            const appConfig = platformConfigs[app.id];
            
            return (
              <div key={app.id} className={`flex flex-col bg-white dark:bg-slate-800 rounded-xl overflow-hidden transition-all duration-200 shadow-sm border ${isConnected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                <div className="p-5 pb-4">
                   <div className="flex items-start justify-between">
                       <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center p-2 shadow-sm border border-slate-100">
                           {app.logo.endsWith('svg') || app.logo.endsWith('png') ? (
                              <img src={app.logo} alt={app.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                           ) : (
                              <div className="font-bold text-xl text-indigo-600">{app.name[0]}</div>
                           )}
                       </div>
                       {isConnected && (
                           <div className="flex flex-col items-end gap-1">
                               <span className="flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2.5 py-1 rounded-full font-medium">
                                  مُثبت <CheckCircle2 className="w-3 h-3 block" />
                               </span>
                               {appConfig?.lastSync && (
                                  <span className="text-[10px] text-slate-400">آخر مزامنة: {appConfig.lastSync}</span>
                               )}
                           </div>
                       )}
                   </div>
                   <h3 className="text-lg font-semibold mt-4 text-slate-900 dark:text-white">{app.name}</h3>
                   <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 min-h-[40px]">{app.description}</p>
                </div>
                <div className="px-5 flex-1 mt-auto">
                    <div className="flex gap-2 flex-wrap pb-4">
                       {app.tags.map(tag => (
                           <span key={tag} className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                               {tag}
                           </span>
                       ))}
                    </div>
                </div>
                <div className="pt-0 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                   {isConnected ? (
                       <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => handleSyncOrders(app.id)}
                                disabled={syncing === app.id}
                                className={`py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${syncing === app.id ? 'bg-indigo-100 text-indigo-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                             >
                                <Cable className={`w-3.5 h-3.5 ${syncing === app.id ? 'animate-spin' : ''}`} />
                                {syncing === app.id ? 'جاري...' : 'مزامنة الطلبات'}
                            </button>
                            <button 
                                onClick={() => handleFetchSelectable(app.id)}
                                disabled={syncing === app.id + '-products' || isFetchingSelectable}
                                className={`py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${syncing === app.id + '-products' ? 'bg-indigo-100 text-indigo-400' : 'bg-slate-900 text-white dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600'}`}
                             >
                                {syncing === app.id + '-products' || isFetchingSelectable ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDriveDownload className="w-3.5 h-3.5" />}
                                {isFetchingSelectable ? 'جاري...' : 'مزامنة المنتجات'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                             <button 
                                onClick={() => openSettings(app)}
                                className="py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              >
                                 الإعدادات
                             </button>
                             <button 
                                onClick={() => setAppToUninstall(app.id)}
                                className="py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-100 dark:border-red-900/20 rounded-lg transition-colors"
                              >
                                 إيقاف الربط
                             </button>
                          </div>
                       </div>
                   ) : (
                       <button 
                          onClick={() => openSettings(app)}
                          className="w-full py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          بدء الربط (API) <ChevronLeft className="w-4 h-4" />
                       </button>
                   )}
                </div>
              </div>
            );
         })}
      </div>

      {isModalOpen && selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  
                  <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
                     <div className="flex items-center gap-3">
                        <img src={selectedApp.logo} alt={selectedApp.name} className="w-10 h-10 object-contain bg-white rounded-lg p-1.5 border" referrerPolicy="no-referrer" />
                        <div>
                           <h3 className="font-bold text-lg">إعدادات ربط {selectedApp.name}</h3>
                           <p className="text-[10px] text-slate-400">تحكم كامل في الاتصال والمزامنة اللحظية.</p>
                        </div>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-full p-2 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6">
                     {/* Integration Status Toggle */}
                     <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                              <RefreshCw size={20} className={config.isActive !== false ? "animate-spin" : ""} />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">التحديث التلقائي (Auto-Sync)</p>
                              <p className="text-xs text-indigo-600 dark:text-indigo-400">جلب الطلبات الجديدة كل دقيقتين تلقائياً.</p>
                           </div>
                        </div>
                        <ToggleButton active={config.isActive !== false} onToggle={() => setConfig({...config, isActive: !config.isActive})} variant="blue" />
                     </div>

                     {/* API Configuration Section */}
                     <div className={`space-y-4 transition-all duration-300 ${config.isActive === false ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 ">
                           <Key className="w-4 h-4" />
                           <h4 className="font-bold text-sm uppercase tracking-wider">إعدادات الـ API</h4>
                        </div>
                        
                        <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl">
                           <div className="space-y-1.5">
                              <label className="text-xs font-black text-slate-600 dark:text-slate-400 block mr-1">معرف المتجر (Store ID)</label>
                              <input 
                                type="text"
                                placeholder="Store_cm84j35..."
                                value={config.shopId || ''}
                                onChange={(e) => setConfig({...config, shopId: e.target.value})}
                                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                dir="ltr"
                              />
                              <p className="text-[10px] text-slate-400 mt-1 mr-1">تجد الـ Store ID في رابط لوحة تحكم ويلت الخاص بك.</p>
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-xs font-black text-slate-600 dark:text-slate-400 block mr-1">مفتاح الـ API (Access Token / API Key)</label>
                              <input 
                                type="password"
                                placeholder="أدخل مفتاح الربط هنا"
                                value={config.apiKey || ''}
                                onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                dir="ltr"
                              />
                           </div>
                        </div>
                     </div>

                     {/* Webhook Configuration Section */}
                     <div className={`space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700 ${config.isActive === false ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 ">
                           <Webhook className="w-4 h-4" />
                           <h4 className="font-bold text-sm uppercase tracking-wider">إعدادات الـ Webhook (للاستقبال اللحظي)</h4>
                        </div>
                        
                        <div className="space-y-3">
                           <p className="text-[11px] text-slate-500 mr-1 leading-relaxed">انسخ الرابط التالي وضعه في إعدادات الـ Webhook في لوحة تحكم {selectedApp.name} لاستقبال الطلبات والسلات بمجرد حدوثها.</p>
                           <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 group">
                             <input 
                               type="text"
                               readOnly 
                               value={getWebhookUrl(selectedApp.id)} 
                               className="w-full px-4 py-3 text-xs font-mono bg-transparent text-left focus:outline-none"
                               dir="ltr"
                             />
                             <button 
                               onClick={() => copyToClipboard(getWebhookUrl(selectedApp.id))} 
                               className={`px-6 flex items-center justify-center transition-all border-r dark:border-slate-700 min-w-[80px] font-bold text-xs ${copied ? 'bg-green-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                             >
                               {copied ? 'تم النسخ!' : 'نسخ الرابط'}
                             </button>
                           </div>
                        </div>
                     </div>

                     <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 p-4 rounded-xl text-xs leading-relaxed border border-amber-100 dark:border-amber-900/20">
                         <strong>توصية:</strong> الربط عبر الـ API يضمن جلب البيانات السابقة، بينما الـ Webhook يضمن استمرارية العمل اللحظي دون تدخل منك.
                     </div>
                  </div>

                  <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 items-center">
                     <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 transition-all">
                        إلغاء
                     </button>
                     <button onClick={handleInstallApp} className="px-8 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-95">
                       {connectedPlatforms.includes(selectedApp.id) ? 'حفظ التفييرات' : 'تفعيل الربط الآن'}
                     </button>
                  </div>

              </div>
          </div>
      )}

      {showSelectiveModal && selectedApp && (
          <SelectiveSyncModal 
            isOpen={showSelectiveModal}
            onClose={() => setShowSelectiveModal(false)}
            products={selectableProducts}
            selectedIds={selectedProductIds}
            setSelectedIds={setSelectedProductIds}
            onConfirm={() => handleSyncProducts(selectedApp.id, Array.from(selectedProductIds))}
            isSyncing={syncingProducts === selectedApp.id}
          />
      )}

      {/* Custom Unlink Confirmation Modal */}
      {appToUninstall && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
                  <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                      <XCircle size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">تأكيد إيقاف الربط</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                      هل أنت متأكد من رغبتك في إيقاف الربط مع <strong>{AVAILABLE_APPS.find(a => a.id === appToUninstall)?.name}</strong>؟ 
                      <br />سيتم تعطيل المزامنة اللحظية والتحكم في الطلبات والمنتجات.
                  </p>
                  <div className="flex gap-3">
                      <button 
                          onClick={confirmUninstallApp}
                          className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
                      >
                          نعم، إيقاف الربط
                      </button>
                      <button 
                          onClick={() => setAppToUninstall(null)}
                          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl font-black text-sm transition-all"
                      >
                          تراجع
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

// --- Selective Sync Modal Component ---
interface SelectiveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onConfirm: () => void;
  isSyncing: boolean;
}

const SelectiveSyncModal: React.FC<SelectiveSyncModalProps> = ({ 
  isOpen, onClose, products, selectedIds, setSelectedIds, onConfirm, isSyncing 
}) => {
  if (!isOpen) return null;

  const toggleProduct = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xl font-bold dark:text-white flex items-center gap-2"><ListChecks size={20} className="text-indigo-500" /> اختيار منتجات للمزامنة</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XCircle size={24} className="text-slate-400 dark:text-slate-600" /></button>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 flex justify-between items-center px-6">
          <button onClick={toggleAll} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            {selectedIds.size === products.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
          </button>
          <span className="text-sm font-bold text-slate-500">{selectedIds.size} من {products.length} تم اختيارهم</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 text-right" dir="rtl">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
               <Package size={48} className="mb-4 opacity-20"/>
               <p className="font-bold">لا توجد منتجات متاحة للمزامنة</p>
            </div>
          ) : (
            products.map(product => (
              <div 
                key={product.id} 
                onClick={() => toggleProduct(product.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedIds.has(product.id) ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedIds.has(product.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                  {selectedIds.has(product.id) && <CheckCircle size={14} />}
                </div>
                {product.thumbnail ? (
                  <img src={product.thumbnail} alt={product.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><ImageIcon size={20}/></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm dark:text-white truncate">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.sku}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{product.price.toLocaleString()} ج.م</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-xl font-bold border border-slate-200 dark:border-slate-600">إلغاء</button>
          <button 
            onClick={onConfirm} 
            disabled={selectedIds.size === 0 || isSyncing}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-slate-400 flex items-center gap-2"
          >
            {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {isSyncing ? 'جاري الاستيراد...' : `استيراد المختار (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "blue", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-10 h-5 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-22px]' : 'translate-x-[-2px]'}`} /> </button> );
};
const Key = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.2 8.4-4.4 4.4a5.5 5.5 0 0 1-7.7-7.7l4.4-4.4a5.5 5.5 0 0 1 7.7 7.7Z"/><path d="m18 11 4 4"/><path d="m14 7 8 8"/><path d="m21 15 3 3"/><path d="m22 22-2-2"/></svg>
);

const Webhook = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M7 10v4"/><path d="M11 10v4"/></svg>
);
