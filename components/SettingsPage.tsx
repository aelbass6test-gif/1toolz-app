
import React, { useState } from 'react';
import { Settings, PlatformIntegration, Store } from '../types';
import { Link2, CheckCircle2, Database, Upload, RefreshCw, AlertTriangle, Check, Trash2, XCircle, Lock, ShoppingCart, Package, Users, Wallet, Activity, Tag, MessageSquare, PhoneCall, Plus, Edit3, Save, X, Link, AppWindow, Globe, CreditCard, Smartphone, Banknote, ShoppingBasket, LayoutDashboard, UserPlus, TrendingUp, Settings as SettingsIcon, Grid, UserCog, Loader2 } from 'lucide-react';
import { clearStoreData } from '../services/databaseService';

interface SettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onManualSave?: () => Promise<{ success: boolean, error?: string } | void>;
  activeStore?: Store;
  dbSyncMode?: 'manual' | 'auto';
  setDbSyncMode?: (mode: 'manual' | 'auto') => void;
  forceSync?: () => Promise<void>;
  saveStatus?: any;
}

const handleImportData = (file: File) => {
  const storeId = localStorage.getItem('lastActiveStoreId');
  if (!storeId) {
    alert('يرجى اختيار متجر أولاً');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const data = JSON.parse(content);
      
      // Basic validation
      if (!data.orders && !data.settings) {
        throw new Error('الملف لا يحتوي على بيانات متجر صحيحة');
      }

      const db = await import('../services/databaseService');
      await db.saveLocal(storeId, data);
      
      alert('تم استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة لتطبيق التغييرات.');
      window.location.reload();
    } catch (err) {
      alert('خطأ في قراءة ملف النسخة الاحتياطية: ' + (err as Error).message);
    }
  };
  reader.readAsText(file);
};

const handleExportData = () => {
  const storeId = localStorage.getItem('lastActiveStoreId');
  if (!storeId) {
    alert('يرجى اختيار متجر أولاً');
    return;
  }
  
  import('../services/databaseService').then(async (db) => {
    const data = await db.getLocal(storeId);
    if (!data) {
      alert('لم يتم العثور على بيانات محلية لهذا المتجر للتصدير');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${storeId}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
};

const DatabaseCard: React.FC<{
  dbSyncMode: 'manual' | 'auto';
  setDbSyncMode: (mode: 'manual' | 'auto') => void;
  forceSync: () => Promise<void>;
  saveStatus: any;
}> = ({ dbSyncMode, setDbSyncMode, forceSync, saveStatus }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-right">
      <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Database size={24}/></div>
        <div>
          <h2 className="text-xl font-black dark:text-white">وضع مزامنة وتأمين قاعدة البيانات (ديسك توب وسحابي)</h2>
          <p className="text-xs text-slate-500">اختر الطريقة الأكثر ملاءمة لطبيعة تشغيل متجرك وإدارة الطلبات بمرونة تامة.</p>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* وضع ديسك توب محلي */}
          <button 
            type="button"
            onClick={() => setDbSyncMode('manual')}
            className={`text-right p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              dbSyncMode === 'manual' 
                ? 'bg-indigo-50/20 border-indigo-500 dark:bg-indigo-950/20' 
                : 'border-slate-200 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-extrabold text-slate-800 dark:text-white">🖥️ وضع ديسك توب محلي (أقصى سرعة CRM)</span>
                {dbSyncMode === 'manual' && <CheckCircle2 size={20} className="text-indigo-500" />}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                تُحفظ البيانات وتُعالج على جهازك فوراً بصورة محلية فائقة السرعة وبدون انتظار استجابة السيرفر. مثالي لإدخال الطلبات والسرعة الفائقة لشركات الشحن. يتم فقط الرفع السحابي وتأمين البيانات عند النقر على المزامنة يدوياً.
              </p>
            </div>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold tracking-wider uppercase mt-4">
              تشغيل محلي بالكامل • أمان فائق للبيانات • استهلاك منعدم للإنترنت
            </div>
          </button>

          {/* وضع سحابي فوري تلقائي */}
          <button 
            type="button"
            onClick={() => setDbSyncMode('auto')}
            className={`text-right p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              dbSyncMode === 'auto' 
                ? 'bg-emerald-50/20 border-emerald-500 dark:bg-emerald-950/20' 
                : 'border-slate-200 dark:border-slate-850 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-extrabold text-slate-800 dark:text-white">☁️ وضع سحابي فوري تلقائي (متعدد الأجهزة)</span>
                {dbSyncMode === 'auto' && <CheckCircle2 size={20} className="text-emerald-500" />}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                يتم مزامنة كل طلب أو تعديل تجريه سحابياً فور إتمام الإجراء لضمان تطابق البيانات لحظياً بين كافة الأجهزة المفتوحة. يتطلب اتصال إنترنت مستمر وثابت لتقديم التزامن اللحظي.
              </p>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold tracking-wider uppercase mt-4">
              تزامن فوري تلقائي • متعدد الحسابات والأجهزة • تواصل حي
            </div>
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 gap-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"><RefreshCw size={18}/></div>
            <div>
              <h4 className="text-sm font-black dark:text-white text-right">بوابة المزامنة يدوية مع السحاب</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-right">اصنع ترحيلاً كاملاً لبياناتك المحلية إلى قواعد البيانات السحابية الآمنة واستقبل الجديد بضغطة واحدة.</p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={forceSync} 
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg text-white cursor-pointer ${
              saveStatus === 'saving' 
                ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
            }`}
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>جاري مزامنة قاعدة البيانات...</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>مزامنة سحابية يدوية الآن</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsPage: React.FC<SettingsPageProps> = ({ 
  settings, 
  setSettings, 
  onManualSave, 
  activeStore,
  dbSyncMode = 'manual',
  setDbSyncMode = () => {},
  forceSync = async () => {},
  saveStatus = 'idle'
}) => {
  
  const handleIntegrationSave = (integration: PlatformIntegration) => {
    setSettings(prev => ({ ...prev, integration }));
  };
  
  const togglePlatformIntegration = () => {
    setSettings(prevSettings => {
      const isEnabling = !prevSettings.enablePlatformIntegration;
      if (isEnabling) {
        return { ...prevSettings, enablePlatformIntegration: true };
      } else {
        return { 
          ...prevSettings, 
          enablePlatformIntegration: false,
          integration: { platform: 'none', apiKey: '' }
        };
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-right pb-12 px-4">
      <div className="bg-gradient-to-l from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between animate-in slide-in-from-top duration-700">
        <div className="flex items-center gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md">
            <CheckCircle2 className="text-emerald-500 w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black dark:text-white">نظام الحفظ المتقدم (Hybrid Database)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
              تطبيقك يستخدم تقنية **IndexedDB** وهي قاعدة بيانات حقيقية مخزنة على الهارد ديسك الخاص بجهازك. البيانات لا تضيع حتى لو انقطع الإنترنت أو تم تحديث الصفحة. المزامنة السحابية هي فقط "نسخة إضافية" للتأمين والوصول من أجهزة أخرى.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
            <button 
              onClick={handleExportData}
              className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs shadow-sm hover:shadow-md transition-all flex items-center gap-2 dark:text-white hover:bg-slate-50"
            >
              <Database size={16} className="text-indigo-500" /> تنزيل نسخة (Backup)
            </button>
            <label className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95">
              <Upload size={16} /> رفع نسخة احتياطية
              <input 
                type="file" 
                className="hidden" 
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportData(file);
                }}
              />
            </label>
        </div>
      </div>

      <DatabaseCard 
        dbSyncMode={dbSyncMode} 
        setDbSyncMode={setDbSyncMode} 
        forceSync={forceSync} 
        saveStatus={saveStatus} 
      />

      {onManualSave && (
          <DatabaseManagementCard onSync={onManualSave} />
      )}
      <DomainSettingsCard settings={settings} setSettings={setSettings} />
      <ExpenseCategoriesSettingsCard settings={settings} setSettings={setSettings} />
      <WalletFeesSettingsCard settings={settings} setSettings={setSettings} />
      <CommunicationSettingsCard settings={settings} setSettings={setSettings} />
      <EmployeeDashboardSettingsCard settings={settings} setSettings={setSettings} />
      <PlatformIntegrationCard 
        integration={settings.integration} 
        onSave={handleIntegrationSave} 
        isEnabled={settings.enablePlatformIntegration}
        onToggle={togglePlatformIntegration}
      />

      <DangerZone activeStore={activeStore} />
    </div>
  );
};

const ExpenseCategoriesSettingsCard: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> }> = ({ settings, setSettings }) => {
    const [newCategory, setNewCategory] = useState('');
    const categories = settings.expenseCategories || [];

    const addCategory = () => {
        if (!newCategory || categories.includes(newCategory)) return;
        setSettings(prev => ({ ...prev, expenseCategories: [...categories, newCategory] }));
        setNewCategory('');
    };

    const removeCategory = (cat: string) => {
        setSettings(prev => ({ ...prev, expenseCategories: categories.filter(c => c !== cat) }));
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg"><Tag size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">تصنيف المصروفات</h2>
                    <p className="text-xs text-slate-500">تحديد فئات المعاملات المالية التي يجب اعتبارها "مصاريف" لخصمها من الأرباح.</p>
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={newCategory} 
                        onChange={e => setNewCategory(e.target.value)}
                        placeholder="أضف تصنيف جديد (مثال: expense_ads)"
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none transition-all dark:text-white"
                    />
                    <button onClick={addCategory} className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700">إضافة</button>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                    {categories.map(cat => (
                        <div key={cat} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-sm">
                            {cat}
                            <button onClick={() => removeCategory(cat)} className="text-slate-500 hover:text-red-600"><X size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const EmployeeDashboardSettingsCard: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> }> = ({ settings, setSettings }) => {
    const dashboardSettings = settings.employeeDashboardSettings || { showAssignedOrders: true, showFollowUpReminders: true, showOrderStatuses: ['في_انتظار_المكالمة', 'جاري_المراجعة', 'قيد_التنفيذ'] };

    const toggleSetting = (key: keyof typeof dashboardSettings) => {
        setSettings(prev => ({
            ...prev,
            employeeDashboardSettings: {
                ...prev.employeeDashboardSettings,
                [key]: !dashboardSettings[key]
            }
        }));
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Users size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">إعدادات لوحة تحكم الموظفين</h2>
                    <p className="text-xs text-slate-500">تخصيص المعلومات التي تظهر للموظفين في لوحة التحكم.</p>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300">عرض الطلبات المعينة</span>
                    <ToggleButton active={dashboardSettings.showAssignedOrders} onToggle={() => toggleSetting('showAssignedOrders')} variant="blue" />
                </div>
                <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300">عرض تذكيرات المتابعة</span>
                    <ToggleButton active={dashboardSettings.showFollowUpReminders} onToggle={() => toggleSetting('showFollowUpReminders')} variant="blue" />
                </div>
            </div>
        </div>
    );
};

const DatabaseManagementCard: React.FC<{ onSync: () => Promise<{ success: boolean, error?: string } | void> }> = ({ onSync }) => {
    const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSyncClick = async () => {
        setStatus('syncing');
        try {
            const result = await onSync();
            if (result && result.success === false) {
                setStatus('error');
                setErrorMessage(result.error || 'حدث خطأ غير معروف');
            } else {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (e: any) {
            setStatus('error');
            setErrorMessage(e.message || 'فشل الاتصال بقاعدة البيانات');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"><Database size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">قواعد البيانات</h2>
                    <p className="text-xs text-slate-500">إدارة تخزين البيانات وتحديث الجداول.</p>
                </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 gap-4">
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">تحديث هيكل البيانات (Migration)</h3>
                    <p className="text-sm text-slate-500 mt-1">نقل البيانات من النظام القديم (JSON) إلى الجداول العلائقية الجديدة (SQL).</p>
                </div>
                <button 
                    onClick={handleSyncClick} 
                    disabled={status === 'syncing' || status === 'success'}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed ${
                        status === 'success' ? 'bg-green-500 text-white' : 
                        status === 'error' ? 'bg-red-500 text-white' : 
                        'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                >
                    {status === 'syncing' && <RefreshCw size={18} className="animate-spin" />}
                    {status === 'success' && <Check size={18} />}
                    {status === 'error' && <AlertTriangle size={18} />}
                    
                    {status === 'syncing' ? 'جاري النقل...' : 
                     status === 'success' ? 'تم النقل بنجاح' : 
                     status === 'error' ? 'فشل النقل' : 'مزامنة الآن'}
                </button>
            </div>
            {status === 'error' && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-bold flex items-center gap-2">
                    <AlertTriangle size={16}/>
                    حدث خطأ: {errorMessage}
                </div>
            )}
             {status === 'success' && (
                <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 size={16}/>
                    تم تحديث قاعدة البيانات بنجاح!
                </div>
            )}
        </div>
    );
};

const CommunicationSettingsCard: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> }> = ({ settings, setSettings }) => {
    const [activeTab, setActiveTab] = useState<'whatsapp' | 'scripts'>('whatsapp');
    const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
    const [editedText, setEditedText] = useState('');
    const [editedLabel, setEditedLabel] = useState('');

    const templates = settings.whatsappTemplates || [];
    const scripts = settings.callScripts || [];

    const handleSaveTemplate = (id: string, isScript: boolean) => {
        if (isScript) {
            setSettings(prev => ({
                ...prev,
                callScripts: prev.callScripts?.map(s => s.id === id ? { ...s, title: editedLabel, text: editedText } : s)
            }));
        } else {
            setSettings(prev => ({
                ...prev,
                whatsappTemplates: prev.whatsappTemplates?.map(t => t.id === id ? { ...t, label: editedLabel, text: editedText } : t)
            }));
        }
        setEditingTemplate(null);
    };

    const handleDelete = (id: string, isScript: boolean) => {
        if (isScript) {
            setSettings(prev => ({ ...prev, callScripts: prev.callScripts?.filter(s => s.id !== id) }));
        } else {
            setSettings(prev => ({ ...prev, whatsappTemplates: prev.whatsappTemplates?.filter(t => t.id !== id) }));
        }
    };

    const handleAdd = (isScript: boolean) => {
        const newId = Date.now().toString();
        if (isScript) {
            setSettings(prev => ({
                ...prev,
                callScripts: [...(prev.callScripts || []), { id: newId, title: 'سكريبت جديد', text: 'نص السكريبت هنا...' }]
            }));
        } else {
            setSettings(prev => ({
                ...prev,
                whatsappTemplates: [...(prev.whatsappTemplates || []), { id: newId, label: 'رسالة جديدة', text: 'نص الرسالة هنا...' }]
            }));
        }
        setEditingTemplate(newId);
        setEditedLabel(isScript ? 'سكريبت جديد' : 'رسالة جديدة');
        setEditedText(isScript ? 'نص السكريبت هنا...' : 'نص الرسالة هنا...');
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"><MessageSquare size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">التواصل والتأكيد</h2>
                    <p className="text-xs text-slate-500">تخصيص رسائل الواتساب وسكريبتات الرد على العملاء.</p>
                </div>
            </div>

            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-2">
                <button 
                    onClick={() => setActiveTab('whatsapp')}
                    className={`pb-2 px-4 font-bold text-sm transition-colors relative ${activeTab === 'whatsapp' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    رسائل الواتساب
                    {activeTab === 'whatsapp' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-t-full" />}
                </button>
                <button 
                    onClick={() => setActiveTab('scripts')}
                    className={`pb-2 px-4 font-bold text-sm transition-colors relative ${activeTab === 'scripts' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    سكريبتات المكالمات
                    {activeTab === 'scripts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-t-full" />}
                </button>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white">
                        {activeTab === 'whatsapp' ? 'قوالب رسائل الواتساب' : 'سكريبتات الرد الجاهزة'}
                    </h3>
                    <button 
                        onClick={() => handleAdd(activeTab === 'scripts')}
                        className="flex items-center gap-2 text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                    >
                        <Plus size={14} /> إضافة جديد
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {(activeTab === 'whatsapp' ? templates : scripts).map((item: any) => (
                        <div key={item.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            {editingTemplate === item.id ? (
                                <div className="space-y-3">
                                    <input 
                                        type="text" 
                                        value={editedLabel} 
                                        onChange={e => setEditedLabel(e.target.value)}
                                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                                        placeholder="عنوان الرسالة / السكريبت"
                                    />
                                    <textarea 
                                        value={editedText} 
                                        onChange={e => setEditedText(e.target.value)}
                                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                                        placeholder="النص..."
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setEditingTemplate(null)} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
                                        <button onClick={() => handleSaveTemplate(item.id, activeTab === 'scripts')} className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg"><Save size={16}/></button>
                                    </div>
                                    {activeTab === 'whatsapp' && (
                                        <p className="text-xs text-slate-500 mt-2">
                                            متغيرات متاحة: <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">[اسم العميل]</span> <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">[اسم المتجر]</span> <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">[اسم المنتج]</span>
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">{item.label || item.title}</h4>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingTemplate(item.id); setEditedLabel(item.label || item.title); setEditedText(item.text); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit3 size={14}/></button>
                                            <button onClick={() => handleDelete(item.id, activeTab === 'scripts')} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{item.text}</p>
                                </div>
                            )}
                        </div>
                    ))}
                    {(activeTab === 'whatsapp' ? templates : scripts).length === 0 && (
                        <div className="text-center p-6 text-slate-500 text-sm">لا توجد قوالب مضافة.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface PlatformIntegrationCardProps {
  integration: PlatformIntegration;
  onSave: (integration: PlatformIntegration) => void;
  isEnabled: boolean;
  onToggle: () => void;
}

const DomainSettingsCard: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> }> = ({ settings, setSettings }) => {
    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Link size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">إعدادات النطاق (SaaS Domain)</h2>
                    <p className="text-xs text-slate-500">تحديد الرابط الأساسي لمتجرك لاستخدامه في الـ Webhooks والروابط الخارجية.</p>
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mr-1">رابط النظام الأساسي (App Domain)</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="https://your-saas-domain.com"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-mono"
                            value={settings.customAppDomain || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, customAppDomain: e.target.value }))}
                            dir="ltr"
                        />
                        <div className="absolute left-4 top-3 text-slate-400">
                           <Globe size={18} />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                        اترك هذا الحقل فارغاً لاستخدام الرابط الحالي للتطبيق تلقائياً. 
                        أدخل رابطاً ثابتاً إذا كنت تستخدم التطبيق كمنصة (SaaS) على نطاق خاص بك لضمان صحة روابط الـ Webhook.
                    </p>
                </div>
            </div>
        </div>
    );
};

const PlatformIntegrationCard: React.FC<PlatformIntegrationCardProps> = ({ integration, isEnabled }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Link2 size={24}/></div>
          <div>
            <h2 className="text-xl font-black dark:text-white">تطبيقات الربط والمزامنة</h2>
            <p className="text-xs text-slate-500">إدارة ربط متجرك مع Wuilt و Shopify والمنصات الأخرى.</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isEnabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500'}`}>
           {isEnabled ? 'متصل' : 'غير متصل'}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 gap-6">
        <div className="flex items-center gap-4">
           {integration.platform === 'wuilt' && (
              <img src="https://wuilt.com/assets/images/logo/wuilt-logo-blue.svg" alt="Wuilt" className="w-12 h-12 p-2 bg-white rounded-xl border border-slate-100" />
           )}
           <div>
              <p className="font-bold text-slate-900 dark:text-white">
                {integration.platform === 'none' ? 'لم يتم ربط أي منصة بعد' : `متصل بـ ${integration.platform === 'wuilt' ? 'ويلت (Wuilt)' : integration.platform}`}
              </p>
              <p className="text-xs text-slate-500 mt-1">تستخدم هذه الإعدادات لمزامنة الطلبات والمنتجات تلقائياً.</p>
           </div>
        </div>
        
        <Link 
          to="/apps" 
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
        >
          <AppWindow size={18} />
          فتح مركز التحكم
        </Link>
      </div>
    </div>
  );
};

const DangerZone: React.FC<{ activeStore?: Store }> = ({ activeStore }) => {
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
    
    const isConfirmationMatch = confirmationText === activeStore?.name;

    const availableTargets = [
        { id: 'orders', label: 'الطلبات والسلات', icon: <ShoppingCart size={16}/> },
        { id: 'products', label: 'المنتجات والمخزون', icon: <Package size={16}/> },
        { id: 'customers', label: 'قاعدة العملاء', icon: <Users size={16}/> },
        { id: 'wallet', label: 'المعاملات المالية', icon: <Wallet size={16}/> },
        { id: 'activity', label: 'سجل النشاط', icon: <Activity size={16}/> },
        { id: 'coupons', label: 'الكوبونات', icon: <Tag size={16}/> },
        { id: 'reviews', label: 'التقييمات', icon: <MessageSquare size={16}/> },
        { id: 'abandoned_carts', label: 'السلات المتروكة', icon: <ShoppingBasket size={16}/> },
        { id: 'shipping', label: 'إعدادات الشحن', icon: <Package size={16}/> },
        { id: 'pages', label: 'الصفحات المخصصة', icon: <LayoutDashboard size={16}/> },
        { id: 'suppliers', label: 'الموردين', icon: <UserPlus size={16}/> },
        { id: 'supply_orders', label: 'طلبات التوريد', icon: <TrendingUp size={16}/> },
        { id: 'global_options', label: 'خيارات عامة', icon: <SettingsIcon size={16}/> },
        { id: 'payment_methods', label: 'طرق الدفع', icon: <Wallet size={16}/> },
        { id: 'collections', label: 'التصنيفات', icon: <Grid size={16}/> },
        { id: 'employees', label: 'الموظفين', icon: <UserCog size={16}/> },
        { id: 'partner_withdrawals', label: 'سحوبات الشركاء والمحفظة', icon: <Wallet size={16}/> },
    ];

    const toggleTarget = (id: string) => {
        setSelectedTargets(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedTargets.length === availableTargets.length) {
            setSelectedTargets([]);
        } else {
            setSelectedTargets(availableTargets.map(t => t.id));
        }
    };

    const handleClearData = async () => {
        if (!isConfirmationMatch) {
            setError('اسم المتجر غير متطابق.');
            return;
        }
        
        if (selectedTargets.length === 0) {
            setError('يجب اختيار عنصر واحد على الأقل للحذف.');
            return;
        }

        setIsDeleting(true);
        const storeId = localStorage.getItem('lastActiveStoreId');
        
        if (storeId) {
            const result = await clearStoreData(storeId, selectedTargets);
            if (result.success) {
                alert('تم حذف البيانات المحددة بنجاح. سيتم إعادة تحميل الصفحة.');
                window.location.reload();
            } else {
                setError(result.error || 'حدث خطأ أثناء المسح');
                setIsDeleting(false);
            }
        }
    };

    return (
        <div className="bg-red-50 dark:bg-red-950/20 p-8 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm mt-8">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><AlertTriangle size={24}/></div>
                <div>
                    <h2 className="text-xl font-black">منطقة الخطر</h2>
                    <p className="text-xs text-red-500 dark:text-red-400">إجراءات حساسة لا يمكن التراجع عنها.</p>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-slate-600 dark:text-slate-300 text-sm">
                    <p className="font-bold">تفريغ قاعدة البيانات (تصفير المتجر)</p>
                    <p className="mt-1">يمكنك اختيار حذف الطلبات، المنتجات، أو العملاء بشكل منفصل أو تصفير المتجر بالكامل.</p>
                </div>
                <button 
                    onClick={() => { setShowConfirm(true); setConfirmationText(''); setError(''); setSelectedTargets([]); }} 
                    className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-red-700 active:scale-95 transition-all whitespace-nowrap"
                >
                    <Trash2 size={18}/> تصفير البيانات
                </button>
            </div>

            {showConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 text-center border border-slate-300 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Trash2 size={20} className="text-red-600"/>
                                اختر ما تريد حذفه
                            </h3>
                            <button onClick={() => setShowConfirm(false)}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                        </div>

                        <div className="mb-6 space-y-3">
                            <button onClick={toggleAll} className="text-xs font-bold text-blue-600 hover:underline mb-2 block w-full text-right">
                                {selectedTargets.length === availableTargets.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                            </button>
                            <div className="grid grid-cols-2 gap-3 text-right">
                                {availableTargets.map(target => (
                                    <div 
                                        key={target.id}
                                        onClick={() => toggleTarget(target.id)}
                                        className={`cursor-pointer p-3 rounded-xl border flex items-center gap-2 transition-all ${selectedTargets.includes(target.id) ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedTargets.includes(target.id) ? 'bg-red-500 border-red-500 text-white' : 'border-slate-400'}`}>
                                            {selectedTargets.includes(target.id) && <Check size={12}/>}
                                        </div>
                                        <div className="text-xs font-bold flex items-center gap-1.5">
                                            {target.icon} {target.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                            <p className="text-slate-500 text-xs mb-3 font-bold">للتأكيد، يرجى كتابة اسم متجرك: <span className="font-black text-red-500">{activeStore?.name}</span></p>
                            <input 
                                type="text" 
                                className="w-full text-center text-lg font-bold p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="اكتب اسم المتجر هنا"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                autoFocus
                            />
                        </div>
                        
                        {error && <p className="text-red-500 text-xs font-bold mb-4 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}

                        <div className="flex gap-2">
                            <button 
                                onClick={handleClearData} 
                                disabled={isDeleting || !isConfirmationMatch}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? 'جاري المسح...' : `أنا متأكد، احذف (${selectedTargets.length})`}
                            </button>
                            <button 
                                onClick={() => { setShowConfirm(false); setConfirmationText(''); setError(''); }} 
                                className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
const WalletFeesSettingsCard: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> }> = ({ settings, setSettings }) => {

    const applicableMethods = settings.feeApplicableMethods || [];
    
    const methods = [
        { id: 'card', label: 'بطاقة دفع', icon: CreditCard },
        { id: 'wallet', label: 'محفظة هاتف', icon: Smartphone },
        { id: 'instapay', label: 'إنستاباي', icon: Banknote }
    ];

    const toggleMethod = (id: string) => {
        setSettings(prev => ({
            ...prev,
            feeApplicableMethods: applicableMethods.includes(id) 
                ? applicableMethods.filter(m => m !== id) 
                : [...applicableMethods, id]
        }));
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg"><Wallet size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">إعدادات رسوم المحفظة</h2>
                    <p className="text-xs text-slate-500">تحديد النسب المئوية لرسوم السحب والإيداع والطرق المطبق عليها.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">رسوم الإيداع (الشحن)</h3>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <input 
                                type="number" 
                                value={settings.depositFeePercent || 0}
                                onChange={e => setSettings(prev => ({ ...prev, depositFeePercent: parseFloat(e.target.value) }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                        <span className="text-xs text-slate-500 font-bold">نسبة رسوم الإيداع</span>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">تطبيق الرسوم على الطرق التالية:</p>
                        <div className="flex flex-wrap gap-2">
                            {methods.map(method => (
                                <button 
                                    key={method.id}
                                    onClick={() => toggleMethod(method.id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-[10px] font-bold ${
                                        applicableMethods.includes(method.id)
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                        : 'border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900'
                                    }`}
                                >
                                    <method.icon size={14} />
                                    {method.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">رسوم السحب</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <input 
                                    type="number" 
                                    value={settings.withdrawalFeePercent || 0}
                                    onChange={e => setSettings(prev => ({ ...prev, withdrawalFeePercent: parseFloat(e.target.value) }))}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                            </div>
                            <span className="text-xs text-slate-500 font-bold">نسبة السحب العادي</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <input 
                                    type="number" 
                                    value={settings.sameDayWithdrawalFeePercent || 0}
                                    onChange={e => setSettings(prev => ({ ...prev, sameDayWithdrawalFeePercent: parseFloat(e.target.value) }))}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                            </div>
                            <span className="text-xs text-slate-500 font-bold">نسبة السحب الفوري (Same Day)</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <input 
                                    type="number" 
                                    value={settings.minWithdrawalFee || 0}
                                    onChange={e => setSettings(prev => ({ ...prev, minWithdrawalFee: parseFloat(e.target.value) }))}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ج.م</span>
                            </div>
                            <span className="text-xs text-slate-500 font-bold">الحد الأدنى لرسوم السحب</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "blue", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ right: '4px', color: 'white' }}>On</span> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`} style={{ left: '4px', color: '#64748b' }}>Off</span> </button> );
};

export default SettingsPage;
