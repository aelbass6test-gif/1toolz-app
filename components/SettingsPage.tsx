
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, PlatformIntegration, Store } from '../types';
import { 
  Link2, CheckCircle2, Database, Upload, RefreshCw, AlertTriangle, Check, Trash2, XCircle, Lock, 
  ShoppingCart, Package, Users, Wallet, Activity, Tag, MessageSquare, PhoneCall, Plus, Edit3, 
  Save, X, Link as LinkIcon, AppWindow, Globe, CreditCard, Smartphone, Banknote, ShoppingBasket, LayoutDashboard, 
  UserPlus, TrendingUp, Settings as SettingsIcon, Grid, UserCog, Loader2, Cloud, CloudDownload, 
  CloudUpload, ShieldCheck, Wifi, WifiOff, FileJson, Clock, HardDrive
} from 'lucide-react';
import { clearStoreData } from '../services/databaseService';

interface SettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onManualSave?: () => Promise<{ success: boolean, error?: string } | void>;
  activeStore?: Store;
  dbSyncMode?: 'manual' | 'auto';
  setDbSyncMode?: (mode: 'manual' | 'auto') => void;
  forceSync?: () => Promise<void>;
  forcePullFromCloud?: () => Promise<{ success: boolean, error?: string }>;
  saveStatus?: any;
  orders?: any[];
  products?: any[];
  customers?: any[];
  wallet?: any;
  treasury?: any;
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

const handleExportMasterBackup = async () => {
  try {
    const { db: localDb } = await import('../src/lib/db');
    
    // 1. Read IndexedDB Tables
    const orders = await localDb.orders.toArray();
    const settings = await localDb.settings.toArray();
    const wallet = await localDb.wallet.toArray();
    const treasury = await localDb.treasury.toArray();
    const customers = await localDb.customers.toArray();

    // 2. Read LocalStorage metadata
    const localStorageMetadata: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wuilt_') || key.startsWith('emergency_') || key === 'dbSyncMode' || key === 'lastActiveStoreId')) {
        const val = localStorage.getItem(key);
        if (val) localStorageMetadata[key] = val;
      }
    }

    const masterBackup = {
      _type: 'wuilt_master_backup_v1',
      version: 2,
      timestamp: new Date().toISOString(),
      indexedDb: {
        orders,
        settings,
        wallet,
        treasury,
        customers
      },
      localStorage: localStorageMetadata
    };

    const blob = new Blob([JSON.stringify(masterBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wuilt_master_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    alert('فشل تصدير النسخة الشاملة للسيستم: ' + err.message);
  }
};

const handleImportMasterBackup = (file: File) => {
  const confirmMsg = "⚠️ تحذير النظام الشامل:\n\nأنت على وشك استيراد نسخة احتياطية شاملة للنظام بأكمله.\n\nتنبيه: سيؤدي هذا الإيجاز إلى حذف ومسح وإعادة كتابة كافة المتاجر، الإعدادات، طلبات العملاء، سجلات اللقطات والعملاء المخزنة حالياً في هذا المتصفح.\n\nهل تود المتابعة ومسح البيانات الحالية واستبدالها بالكامل ببيانات ملف النسخ الاحتياطي؟";
  if (!window.confirm(confirmMsg)) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const data = JSON.parse(content);
      
      if (data._type !== 'wuilt_master_backup_v1' || !data.indexedDb) {
        throw new Error('الملف لا يحتوي على نسخة احتياطية شاملة صالحة لنظام Wuilt.');
      }

      const { db: localDb } = await import('../src/lib/db');

      // Clear current IndexedDB tables safely
      await localDb.orders.clear();
      await localDb.settings.clear();
      await localDb.wallet.clear();
      await localDb.treasury.clear();
      await localDb.customers.clear();

      // Write IndexedDB Tables
      if (data.indexedDb.orders) await localDb.orders.bulkPut(data.indexedDb.orders);
      if (data.indexedDb.settings) await localDb.settings.bulkPut(data.indexedDb.settings);
      if (data.indexedDb.wallet) await localDb.wallet.bulkPut(data.indexedDb.wallet);
      if (data.indexedDb.treasury) await localDb.treasury.bulkPut(data.indexedDb.treasury);
      if (data.indexedDb.customers) await localDb.customers.bulkPut(data.indexedDb.customers);

      // Write LocalStorage
      if (data.localStorage) {
        Object.entries(data.localStorage).forEach(([key, val]) => {
          localStorage.setItem(key, val as string);
        });
      }

      alert('تم استيراد النسخة الشاملة للنظام وتحديث المتكامل للمتصفح بنجاح! سيتم الآن إعادة تحميل النظام بالكامل لتطبيق الحالة الجديدة.');
      window.location.reload();
    } catch (err: any) {
      alert('فشل استيراد النسخة الشاملة: ' + err.message);
    }
  };
  reader.readAsText(file);
};

const DatabaseCard: React.FC<{
  dbSyncMode: 'manual' | 'auto';
  setDbSyncMode: (mode: 'manual' | 'auto') => void;
  forceSync: () => Promise<void>;
  forcePullFromCloud?: () => Promise<{ success: boolean; error?: string }>;
  saveStatus: any;
  activeStore?: Store;
  orders?: any[];
  products?: any[];
  customers?: any[];
  settings?: Settings;
  wallet?: any;
  treasury?: any;
}> = ({ 
  dbSyncMode, 
  setDbSyncMode, 
  forceSync, 
  forcePullFromCloud, 
  saveStatus,
  activeStore,
  orders = [],
  products = [],
  customers = [],
  settings,
  wallet,
  treasury
}) => {
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);
  const [pingStatus, setPingStatus] = useState<'idle' | 'checking' | 'completed' | 'failed'>('idle');
  const [latency, setLatency] = useState<number | null>(null);
  const [pullStatus, setPullStatus] = useState<'idle' | 'pulling' | 'success' | 'error'>('idle');
  const [pullError, setPullError] = useState('');

  // Local Snapshots State
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [snapshotSuccessMsg, setSnapshotSuccessMsg] = useState('');

  // Compare & Restore point interactive states
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedSnapForRestore, setSelectedSnapForRestore] = useState<any>(null);

  // Auto snapshot before cloud push key
  const [autoSnapshotBeforeSync, setAutoSnapshotBeforeSync] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wuilt_auto_snapshot_before_sync') !== 'false';
    }
    return true;
  });

  const handleToggleAutoSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.checked;
    setAutoSnapshotBeforeSync(newVal);
    localStorage.setItem('wuilt_auto_snapshot_before_sync', String(newVal));
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load available local snapshots
    if (activeStore?.id) {
      loadSnapshotsList();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeStore?.id]);

  const loadSnapshotsList = () => {
    const storeId = activeStore?.id || 'default';
    const listKey = `wuilt_snapshots_list_${storeId}`;
    try {
      const saved = localStorage.getItem(listKey);
      if (saved) {
        setSnapshots(JSON.parse(saved));
      } else {
        setSnapshots([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestPing = async () => {
    setPingStatus('checking');
    const start = performance.now();
    try {
      const { checkSupabaseConnection } = await import('../services/databaseService');
      const isConnected = await checkSupabaseConnection();
      if (isConnected) {
        const duration = Math.round(performance.now() - start);
        setLatency(duration);
        setPingStatus('completed');
      } else {
        setPingStatus('failed');
      }
    } catch (err) {
      setPingStatus('failed');
    }
  };

  const handleForcePull = async () => {
    if (!forcePullFromCloud) {
       alert('خاصية السحب السحابي غير معرّفة حالياً');
       return;
    }
    const confirmMessage = "⚠️ تحذير مستودع البيانات:\n\nسيتم سحب كامل الملفات والمعاملات والطلبات المخزنة على السحابة واستبدال قاعدة البيانات الحالية على هذا الجهاز بها كلياً.\n\nتنبيه: أي تعديلات محلية لم يتم رفعها سحابياً ستضيع على الفور.\n\nهل تود الاستمرار واسترجاع النسخة السحابية لمتجرك؟";
    if (!window.confirm(confirmMessage)) return;

    setPullStatus('pulling');
    setPullError('');
    try {
      const res = await forcePullFromCloud();
      if (res.success) {
        setPullStatus('success');
        setTimeout(() => {
          setPullStatus('idle');
          window.location.reload();
        }, 1500);
      } else {
        setPullStatus('error');
        setPullError(res.error || 'فشلت عملية سحب البيانات');
      }
    } catch (err: any) {
      setPullStatus('error');
      setPullError(err.message || 'خطأ غير متوقع');
    }
  };

  const handleUploadAndSync = async () => {
    if (autoSnapshotBeforeSync) {
      const storeId = activeStore?.id || 'default';
      const snapshotId = `wuilt_snap_${Date.now()}`;
      const timestamp = new Date().toLocaleString('ar-EG', { hour12: true });

      try {
        const snapshotPayload = {
          orders,
          settings,
          wallet,
          treasury,
          customers
        };

        localStorage.setItem(`wuilt_snapshot_data_${snapshotId}`, JSON.stringify(snapshotPayload));

        const listKey = `wuilt_snapshots_list_${storeId}`;
        const autoName = `تلقائي: قبل رفع المجموع السحابي [${new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}]`;
        const newSnapshotItem = {
          id: snapshotId,
          name: autoName,
          timestamp,
          ordersCount: orders.length,
          productsCount: products.length,
          customersCount: customers.length,
          size: Math.round(JSON.stringify(snapshotPayload).length / 1024)
        };

        let existingList: any[] = [];
        try {
          const saved = localStorage.getItem(listKey);
          if (saved) existingList = JSON.parse(saved);
        } catch {}

        const updatedList = [newSnapshotItem, ...existingList];
        localStorage.setItem(listKey, JSON.stringify(updatedList));
        setSnapshots(updatedList);
      } catch (err) {
        console.warn('Failed to take automatic pre-sync snapshot:', err);
      }
    }

    try {
      await forceSync();
    } catch (err) {
      console.error(err);
    }
  };

  // Create local snapshot recovery point
  const handleCreateSnapshot = () => {
    if (!newSnapshotName.trim()) {
      alert('يرجى إدخال اسم مميز لللقطة الاحتياطية');
      return;
    }
    const storeId = activeStore?.id || 'default';
    const snapshotId = `wuilt_snap_${Date.now()}`;
    const timestamp = new Date().toLocaleString('ar-EG', { hour12: true });

    try {
      const snapshotPayload = {
        orders,
        settings,
        wallet,
        treasury,
        customers
      };

      // Save payload to localstorage
      localStorage.setItem(`wuilt_snapshot_data_${snapshotId}`, JSON.stringify(snapshotPayload));

      // Update manifest list
      const listKey = `wuilt_snapshots_list_${storeId}`;
      const newSnapshotItem = {
        id: snapshotId,
        name: newSnapshotName.trim(),
        timestamp,
        ordersCount: orders.length,
        productsCount: products.length,
        customersCount: customers.length,
        size: Math.round(JSON.stringify(snapshotPayload).length / 1024) // size in KB
      };

      const updatedList = [newSnapshotItem, ...snapshots];
      localStorage.setItem(listKey, JSON.stringify(updatedList));
      setSnapshots(updatedList);
      setNewSnapshotName('');
      
      setSnapshotSuccessMsg('تم التقاط لقطة استرجاع كاملة للنظام وحفظها بذاكرة المتصفح بأمان!');
      setTimeout(() => setSnapshotSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('فشل التقاط النسخة الاحتياطية: قد يكون حجم البيانات الإجمالي تجاوز الحد المسموح به في متصفحك.');
    }
  };

  const handleRestoreSnapshot = async (snap: any) => {
    const confirmMessage = `تنبيه استعادة:\n\nهل أنت متأكد من رغبتك في استعادة المتجر كلياً لنقطة استرداد النظام: "${snap.name}"؟\n\nتاريخ الحفظ: (${snap.timestamp}).`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const savedData = localStorage.getItem(`wuilt_snapshot_data_${snap.id}`);
      if (!savedData) {
        alert('يتعذر العثور على ملفات النسخة في ذاكرة هذا المتصفح');
        return;
      }

      const parsed = JSON.parse(savedData);
      const dbService = await import('../services/databaseService');
      const storeId = activeStore?.id || 'default';

      // Rewrite IndexedDB
      await dbService.saveLocal(storeId, parsed);

      alert(`تم استرداد لقطة النظام "${snap.name}" بنجاح! سيتم الآن إعادة تحميل المتجر.`);
      window.location.reload();
    } catch (e: any) {
      alert('فشلت حركة الاسترداد والتبديل: ' + e.message);
    }
  };

  const handleDeleteSnapshot = (snapId: string) => {
    if (!window.confirm('هل تود بالتأكيد حذف هذه اللقطة بشكل نهائي من جهازك؟')) return;
    const storeId = activeStore?.id || 'default';
    const listKey = `wuilt_snapshots_list_${storeId}`;
    try {
      localStorage.removeItem(`wuilt_snapshot_data_${snapId}`);
      const filtered = snapshots.filter(s => s.id !== snapId);
      localStorage.setItem(listKey, JSON.stringify(filtered));
      setSnapshots(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportSnapshotFile = (snap: any) => {
    try {
      const savedData = localStorage.getItem(`wuilt_snapshot_data_${snap.id}`);
      if (!savedData) {
        alert('الملفات التالفة أو غير متوفرة');
        return;
      }
      const parsed = JSON.parse(savedData);
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_snapshot_${activeStore?.id || 'store'}_${snap.name.replace(/\s+/g, '_')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('خطأ في تصدير وتصدير ملف اللقطة');
    }
  };

  // Get financial transactions count
  const financialCount = (wallet?.transactions?.length || 0) + (treasury?.transactions?.length || 0);

  return (
    <div className="space-y-6">
      {/* 1. Main Sync Card & Indicators */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-right">
        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><Database size={24}/></div>
          <div>
            <h2 className="text-xl font-black dark:text-white">مركز المزامنة وأمان قاعدة البيانات الهجينة (CRM & Cloud Engine)</h2>
            <p className="text-xs text-slate-500">مراقبة التزامن الفوري والمحلي لقواعد بيانات المتجر وأمان البيانات بأرقى التقنيات.</p>
          </div>
        </div>
        
        {/* Connection Diagnostics Board */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 font-sans">
          {/* Internet Status */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/50 flex items-center justify-between">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block">حالة الاتصال والشبكة</span>
              <span className="text-xs font-black dark:text-white">
                {isOnline ? 'وضع متصل أونلاين' : 'وضع العمل أوفلاين'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`}></span>
              {isOnline ? <Wifi size={20} className="text-emerald-500" /> : <WifiOff size={20} className="text-amber-500" />}
            </div>
          </div>

          {/* Test Ping Tool */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/50 flex items-center justify-between">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block">اختبار استجابة السحابة</span>
              <span className="text-xs font-black dark:text-white block">
                {pingStatus === 'checking' && 'جاري الفحص...'}
                {pingStatus === 'completed' && latency && `${latency}ms (ممتاز)`}
                {pingStatus === 'failed' && 'فشل الاتصال'}
                {pingStatus === 'idle' && 'جاهز للاختبار'}
              </span>
            </div>
            <button 
              type="button"
              onClick={handleTestPing}
              disabled={pingStatus === 'checking'}
              className="px-2.5 py-1 text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 rounded-lg active:scale-95 transition-all cursor-pointer"
            >
              🚀 فحص الآن
            </button>
          </div>

          {/* IndexedDB Status */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/50 flex items-center justify-between">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block">قاعدة البيانات المحلية</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">نشطة (IndexedDB)</span>
            </div>
            <HardDrive size={20} className="text-emerald-500" />
          </div>

          {/* Cloud Core Status */}
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/50 flex items-center justify-between">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block">المزامنة والنسخة السحابية</span>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">متصلة (Firestore)</span>
            </div>
            <ShieldCheck size={20} className="text-indigo-500" />
          </div>
        </div>

        {/* Sync Mode Selection Grid */}
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
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  تُحفظ البيانات وتُعالج على جهازك فوراً بصورة محلية فائقة السرعة وبدون انتظار استجابة السيرفر. مروعة لادخال الطلبات ومزامي الشحن.
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
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                  يتم مزامنة كل طلب أو تعديل تجريه سحابياً فور إتمام الإجراء لضمان تطابق البيانات لحظياً بين كافة الأجهزة المفتوحة. يتطلب اتصال إنترنت مستمر وثابت لتقديم التزامن اللحظي.
                </p>
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold tracking-wider uppercase mt-4">
                تزامن فوري تلقائي • متعدد الحسابات والأجهزة • تواصل حي
              </div>
            </button>
          </div>

          {/* Sync Stats Summary Bar */}
          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-right">
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2">📊 جرد البيانات المحلية الحالية بمتصفحك:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block pb-1">المنتجات النشطة</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{products.length} منتج</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block pb-1">إجمالي طلبات النظام</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{orders.length} طلب</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block pb-1">قاعدة بيانات العملاء</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{customers.length} عميل</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block pb-1">المعاملات المالية المسجلة</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{financialCount} حركة مالية</span>
              </div>
            </div>
          </div>

          {/* Two Way Action Controller (Push & Pull) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Action 1: Push To Cloud */}
            <div className="bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/10 dark:to-slate-950 p-5 rounded-xl border border-indigo-100 dark:border-indigo-950 flex flex-col justify-between text-right">
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 justify-start" dir="rtl">
                  <CloudUpload className="text-indigo-500" size={16} />
                  رفع وحفظ النسخة الاحتياطية سحابياً (Push)
                </h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  يقوم بترحيل وحفظ كافة المعاملات والطلبات المحلية المخزنة بذاكرة هذا الجهاز إلى قاعدة البيانات السحابية الآمنة لضمان أمانها وسهولة الوصول لها من الأجهزة الأخرى.
                </p>
              </div>
              <button 
                type="button"
                onClick={handleUploadAndSync} 
                disabled={saveStatus === 'saving'}
                className="mt-4 flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-xs font-black shadow-md bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>جاري التحديث والحفظ السحابي...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload size={14} />
                    <span>مزامنة ورفع البيانات للسحاب الآن</span>
                  </>
                )}
              </button>
            </div>

            {/* Action 2: Pull From Cloud */}
            <div className="bg-gradient-to-br from-amber-50/20 to-white dark:from-amber-950/5 dark:to-slate-950 p-5 rounded-xl border border-amber-100/50 dark:border-amber-950/40 flex flex-col justify-between text-right">
              <div>
                <h4 className="text-sm font-black text-amber-700 dark:text-amber-400 flex items-center gap-2 justify-start" dir="rtl">
                  <CloudDownload className="text-amber-500" size={16} />
                  سحب ودمج البيانات السحابية الحية (Pull)
                </h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed text-right">
                  هل قمت بتعديلات من هاتف أو جهاز آخر؟ يسحب هذا الخيار قاعدة البيانات السحابية بالكامل ويستبدل الذاكرة المحلية بها فوراً. يستعمل للتغلب على أي نقص أو مشاكل تزامن.
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button 
                  type="button"
                  onClick={handleForcePull} 
                  disabled={pullStatus === 'pulling' || !forcePullFromCloud}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-xs font-black shadow-md bg-amber-500 hover:bg-amber-600 text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {pullStatus === 'pulling' ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>جاري سحب الجداول من السحاب...</span>
                    </>
                  ) : (
                    <>
                      <CloudDownload size={14} />
                      <span>سحب البيانات السحابية للمحلي الآن</span>
                    </>
                  )}
                </button>
                {pullError && <p className="text-[10px] text-red-500 text-center font-bold">{pullError}</p>}
                {pullStatus === 'success' && <p className="text-[10px] text-emerald-500 text-center font-bold">تم سحب وتحديث قاعدة البيانات بنجاح!</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Enhanced Local Snapshots System Cabinet */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-right">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg"><Clock size={24}/></div>
            <div>
              <h2 className="text-xl font-black dark:text-white">سجل اللقطات لنقاط استرداد النظام المحلية (System Restore Points)</h2>
              <p className="text-xs text-slate-500 font-sans">التقاط نقاط استرجاع تاريخية مرنة بدون إنترنت، للرجوع إليها في متصفحك الحالي بضغطة زر وبدون قيود.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] font-black rounded-full select-none">
            إجمالي اللقطات: {snapshots.length}
          </span>
        </div>

        {/* Capture Snapshot Section */}
        <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4 mb-6 text-right">
          <h4 className="text-sm font-black text-slate-800 dark:text-white">صناعة نقطة استعادة فورية جديدة:</h4>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="مثال: لقطة جرد المنتجات أو قبل تصفير الأرقام..."
              value={newSnapshotName}
              onChange={(e) => setNewSnapshotName(e.target.value)}
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none ring-offset-2 focus:ring-2 focus:ring-indigo-500 text-right dark:text-white"
            />
            <button 
              type="button"
              onClick={handleCreateSnapshot}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 font-extrabold text-xs text-white rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Plus size={16} />
              حفظ نقطة استعادة جديدة
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2 select-none border-t border-slate-150 dark:border-slate-800 pt-3">
            <input 
              type="checkbox" 
              id="autoSnapshotCheckbox" 
              checked={autoSnapshotBeforeSync}
              onChange={handleToggleAutoSnapshot}
              className="accent-indigo-600 h-4 w-4 cursor-pointer" 
            />
            <label htmlFor="autoSnapshotCheckbox" className="text-xs font-bold text-slate-650 dark:text-slate-450 cursor-pointer select-none">
              🛡️ تأمين فوري: التقاط نقطة تراجع تلقائية للنظام بالكامل قبل كل عملية رفع سحابي لحماية البيانات من التلف المفاجئ
            </label>
          </div>
          {snapshotSuccessMsg && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-lg flex items-center gap-1.5 leading-relaxed">
              <CheckCircle2 size={14} />
              {snapshotSuccessMsg}
            </p>
          )}
        </div>

        {/* Snapshots Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-slate-500 dark:text-slate-400 border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-700">
                <th className="p-4 rounded-r-xl">مسمى نقطة الاسترداد واللقطة الاحتياطية</th>
                <th className="p-4 text-center">تاريخ ووقت الحفظ</th>
                <th className="p-4 text-center">حجم البيانات بالتقريب</th>
                <th className="p-4 text-center">العناصر المحفوظة داخلياً</th>
                <th className="p-4 text-center rounded-l-xl">عمليات التحكم والاسترداد</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <tr key={snap.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-start">
                      <FileJson className="text-indigo-500 shrink-0" size={16} />
                      <span className="font-extrabold text-slate-800 dark:text-white">{snap.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center font-mono font-medium text-[11px] text-slate-500 dark:text-slate-400">{snap.timestamp}</td>
                  <td className="p-4 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">{snap.size || '12'} KB</td>
                  <td className="p-4 text-center text-[11px]">
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">{snap.ordersCount} طلب</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">{snap.productsCount} منتج</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">{snap.customersCount} عميل</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Restore */}
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedSnapForRestore(snap);
                          setIsCompareModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 font-black text-[11px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={12} />
                        استرجاع
                      </button>

                      {/* Download File */}
                      <button 
                        type="button"
                        onClick={() => handleExportSnapshotFile(snap)}
                        title="تحميل كملف JSON"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Upload size={14} className="transform rotate-180" />
                      </button>

                      {/* Delete */}
                      <button 
                        type="button"
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic font-medium">
                    لا توجد لقطات نقاط استرجاع مسجلة لهذا المتجر حالياً في الذاكرة المحلية. ابدأ بكتابة اسم بالفلتر بالأعلى والتقط أول نقطة استرداد فورية!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-Side Comparison & Restorepoint Selection Modal */}
      {isCompareModalOpen && selectedSnapForRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-250 dark:border-slate-800 shadow-2xl p-6 md:p-8 max-w-2xl w-full text-right font-sans relative">
            <button 
              onClick={() => { setIsCompareModalOpen(false); setSelectedSnapForRestore(null); }}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                <RefreshCw size={24} className="animate-spin duration-300" />
              </div>
              <div>
                <h3 className="text-xl font-black dark:text-white">مقارنة نقاط الاسترداد واسترجاع الحالة</h3>
                <p className="text-xs text-slate-500 mt-1">راجع الفروقات التفصيلية بين قاعدة البيانات الحالية والنقطة المحددة قبل الإرجاع.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Current State */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span className="font-bold text-xs text-indigo-650 dark:text-indigo-400">الوضع الحالي النشط على السيستم</span>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-350 font-sans">
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                    <span>📦 عدد المنتجات:</span>
                    <span className="font-mono font-bold dark:text-white">{products.length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                    <span>🛍️ عدد الطلبات الكلي:</span>
                    <span className="font-mono font-bold dark:text-white">{orders.length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                    <span>👥 سجل الـعملاء:</span>
                    <span className="font-mono font-bold dark:text-white">{customers.length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                    <span>💰 الحركات المالية:</span>
                    <span className="font-mono font-bold dark:text-white">{financialCount}</span>
                  </div>
                </div>
              </div>

              {/* Restore Point State */}
              <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-950/30 bg-emerald-50/10 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]" title={selectedSnapForRestore.name}>
                    لقطة الاسترداد: {selectedSnapForRestore.name}
                  </span>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-350 font-sans">
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                    <span>📦 عدد المنتجات:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      {selectedSnapForRestore.productsCount}
                      {selectedSnapForRestore.productsCount !== products.length && (
                        <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${selectedSnapForRestore.productsCount > products.length ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          ({selectedSnapForRestore.productsCount > products.length ? '+' : ''}{selectedSnapForRestore.productsCount - products.length})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                    <span>🛍️ عدد الطلبات الكلي:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      {selectedSnapForRestore.ordersCount}
                      {selectedSnapForRestore.ordersCount !== orders.length && (
                        <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${selectedSnapForRestore.ordersCount > orders.length ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          ({selectedSnapForRestore.ordersCount > orders.length ? '+' : ''}{selectedSnapForRestore.ordersCount - orders.length})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                    <span>👥 سجل الـعملاء:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      {selectedSnapForRestore.customersCount}
                      {selectedSnapForRestore.customersCount !== customers.length && (
                        <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${selectedSnapForRestore.customersCount > customers.length ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          ({selectedSnapForRestore.customersCount > customers.length ? '+' : ''}{selectedSnapForRestore.customersCount - customers.length})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                    <span>⏱️ تاريخ الحفظ:</span>
                    <span className="font-mono font-medium text-slate-500 dark:text-slate-400 text-[10px]">{selectedSnapForRestore.timestamp}</span>
                  </div>
                </div>
              </div>
            </div>

                        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-850 dark:text-amber-400 flex items-start gap-3 text-xs leading-relaxed mb-6 font-sans">
              <AlertTriangle className="shrink-0 mt-0.5 text-amber-600" size={16} />
              <div>
                <span className="font-black block mb-0.5">⚠️ تحذير أمان ممتلكات البيانات:</span>
                عند تنفيذ الاستعادة، سيتم استبدال كامل مخزون البيانات وسجل الطلبات على هذا الجهاز بالبيانات المسجلة في نقطة الاسترداد.
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                type="button"
                onClick={() => { setIsCompareModalOpen(false); setSelectedSnapForRestore(null); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs"
              >
                تراجع وإلغاء
              </button>
              <button 
                type="button"
                onClick={() => { handleRestoreSnapshot(selectedSnapForRestore); setIsCompareModalOpen(false); }}
                className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 active:scale-95 transition-all"
              >
                <Check size={14} /> تأكيد استعادة البيانات 🔄
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


const SQL_SCHEMA_SCRIPT = ``;
/*
-- 1. STORES_DATA (قاعدة بيانات المتاجر)
CREATE TABLE IF NOT EXISTS stores_data (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb
);

-- 2. USERS (المستخدمون والمدراء)
CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    fullName TEXT,
    password TEXT NOT NULL,
    email TEXT,
    stores JSONB DEFAULT '[]'::jsonb,
    sites JSONB DEFAULT '[]'::jsonb,
    is_admin BOOLEAN DEFAULT false,
    isAdmin BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    isBanned BOOLEAN DEFAULT false,
    join_date TEXT,
    joinDate TEXT
);

-- 3. PRODUCTS (المنتجات)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    name TEXT NOT NULL,
    sku TEXT,
    price NUMERIC NOT NULL,
    stock_quantity NUMERIC DEFAULT 0,
    stockQuantity NUMERIC DEFAULT 0,
    details JSONB DEFAULT '{}'::jsonb
);

-- 4. ORDERS (الطلبات والأوردرات)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    order_number TEXT NOT NULL,
    orderNumber TEXT,
    customer_name TEXT NOT NULL,
    customerName TEXT,
    status TEXT NOT NULL,
    date TEXT NOT NULL,
    total_price NUMERIC NOT NULL,
    totalPrice NUMERIC,
    details JSONB DEFAULT '{}'::jsonb
);

-- 5. TRANSACTIONS (الحركات المالية والمحفظة)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date TEXT NOT NULL,
    category TEXT,
    note TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- 6. SUPPLIERS (الموردين)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    balance NUMERIC DEFAULT 0
);

-- 7. SUPPLY_ORDERS (أوردرات الإمداد والمخزون)
CREATE TABLE IF NOT EXISTS supply_orders (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    supplier_id TEXT,
    supplierId TEXT,
    total_cost NUMERIC NOT NULL,
    totalCost NUMERIC,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- 8. REVIEWS (مراجعات وآراء التقاطعات)
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    productId TEXT,
    customer_name TEXT,
    customerName TEXT,
    rating NUMERIC DEFAULT 5,
    comment TEXT,
    status TEXT
);

-- 9. ABANDONED_CARTS (السلات المتروكة)
CREATE TABLE IF NOT EXISTS abandoned_carts (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    customer_name TEXT,
    customerName TEXT,
    customer_phone TEXT,
    customerPhone TEXT,
    total_value NUMERIC,
    totalValue NUMERIC,
    date TEXT,
    items JSONB DEFAULT '[]'::jsonb
);

-- 10. ACTIVITY_LOGS (سجل الحركات العام)
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    user_name TEXT,
    userName TEXT,
    action TEXT NOT NULL,
    details JSONB,
    timestamp TEXT,
    date TEXT
);

-- 11. EMPLOYEES (الموظفون وصلاحياتهم)
CREATE TABLE IF NOT EXISTS employees (
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    phone TEXT NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL,
    PRIMARY KEY (store_id, phone)
);

-- 12. DISCOUNT_CODES (أكواد الخصم)
CREATE TABLE IF NOT EXISTS discount_codes (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL,
    discountType TEXT,
    value NUMERIC NOT NULL,
    usage_limit NUMERIC,
    usageLimit TEXT,
    usage_count NUMERIC DEFAULT 0,
    usageCount NUMERIC,
    expiration_date TEXT,
    expirationDate TEXT,
    is_active BOOLEAN DEFAULT true,
    isActive BOOLEAN DEFAULT true
);

-- 13. COLLECTIONS (التصنيفات والجموعات للمنتجات)
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    imageUrl TEXT,
    is_active BOOLEAN DEFAULT true,
    isActive BOOLEAN DEFAULT true
);

-- 14. CUSTOM_PAGES (الصفحات التعريفية المخصصة)
CREATE TABLE IF NOT EXISTS custom_pages (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT,
    is_active BOOLEAN DEFAULT true,
    isActive BOOLEAN DEFAULT true
);

-- 15. PAYMENT_METHODS (طرق الدفع المفعلة)
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    logo_url TEXT,
    logoUrl TEXT,
    is_active BOOLEAN DEFAULT true,
    isActive BOOLEAN DEFAULT true,
    details JSONB DEFAULT '{}'::jsonb
);

-- 16. CUSTOMERS (بيانات العملاء وتقييمات الولاء)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    loyalty_points NUMERIC DEFAULT 0,
    loyaltyPoints NUMERIC,
    total_spent NUMERIC DEFAULT 0,
    totalSpent NUMERIC,
    first_order_date TEXT,
    firstOrderDate TEXT,
    last_order_date TEXT,
    lastOrderDate TEXT,
    notes TEXT
);

-- 17. GLOBAL_OPTIONS (خيارات الضبط العام للمتجر)
CREATE TABLE IF NOT EXISTS global_options (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    key TEXT NOT NULL,
    value TEXT,
    is_active BOOLEAN DEFAULT true,
    isActive BOOLEAN DEFAULT true
);

-- 18. SHIPPING_INTEGRATIONS (تكاملات شركات الشحن والدليفري)
CREATE TABLE IF NOT EXISTS shipping_integrations (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    provider TEXT NOT NULL,
    api_key TEXT,
    apiKey TEXT,
    api_secret TEXT,
    apiSecret TEXT,
    account_number TEXT,
    accountNumber TEXT,
    is_connected BOOLEAN DEFAULT false,
    isConnected BOOLEAN DEFAULT false
);

-- 19. DOCUMENTS (الملفات وأرشيف الفواتير الموروثة)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    content JSONB DEFAULT '{}'::jsonb
);

-- 20. TREASURY_ACCOUNTS (خزائن وحسابات السيولة المالية)
CREATE TABLE IF NOT EXISTS treasury_accounts (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- safe, bank, wallet, custody
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'EGP',
    account_number TEXT,
    accountNumber TEXT,
    beneficiary_name TEXT,
    beneficiaryName TEXT,
    bank_name TEXT,
    bankName TEXT,
    wallet_number TEXT,
    walletNumber TEXT,
    wallet_name TEXT,
    walletName TEXT
);

-- 21. TREASURY_TRANSACTIONS (الحركات والمعاملات المالية الخزينة)
CREATE TABLE IF NOT EXISTS treasury_transactions (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    date TEXT NOT NULL,
    from_account_id TEXT,
    fromAccountId TEXT,
    to_account_id TEXT,
    toAccountId TEXT,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL, -- deposit, withdrawal, transfer, advance
    description TEXT,
    reference TEXT
);

-- 22. PARTNERS (بيانات الشركاء وحصص رأس المال)
CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    balance NUMERIC DEFAULT 0,
    profit_ratio NUMERIC DEFAULT 0,
    profitRatio NUMERIC DEFAULT 0
);

-- 23. PARTNER_TRANSACTIONS (الحركات والمسحوبات مع الشركاء)
CREATE TABLE IF NOT EXISTS partner_transactions (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    partner_id TEXT,
    partnerId TEXT,
    type TEXT NOT NULL, -- loan, capital_addition, profit_withdrawal, repayment, etc.
    amount NUMERIC NOT NULL,
    date TEXT NOT NULL,
    note TEXT
);

-- 24. CHAT_MESSAGES (سجل المحادثات ورسائل الدعم الفني والداخلي)
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    sender_id TEXT NOT NULL,
    senderId TEXT,
    receiver_id TEXT NOT NULL,
    receiverId TEXT,
    content TEXT NOT NULL,
    created_at TEXT,
    createdAt TEXT,
    is_read BOOLEAN DEFAULT false,
    isRead BOOLEAN DEFAULT false,
    is_file BOOLEAN DEFAULT false,
    isFile BOOLEAN DEFAULT false
);

-- تعطيل نظام الحماية لتمكين الاتصال المباشر وتسهيل عملية المزامنة
ALTER TABLE stores_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE supply_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_carts DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_integrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE partner_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
*/

const SettingsPage: React.FC<SettingsPageProps> = ({ 
  settings, 
  setSettings, 
  onManualSave, 
  activeStore,
  dbSyncMode = 'manual',
  setDbSyncMode = () => {},
  forceSync = async () => {},
  forcePullFromCloud,
  saveStatus = 'idle',
  orders = [],
  products = [],
  customers = [],
  wallet,
  treasury
}) => {
  const [activeTab, setActiveTab ] = useState<'general' | 'database'>('general');

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
    <div className="max-w-6xl mx-auto space-y-8 text-right pb-12 px-4" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">التحكم والإدارة الشاملة</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <SettingsIcon size={32} className="text-indigo-500"/>
            الإعدادات العامة وإدارة المتجر
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">التحكم الموحد في المزامنة وقواعد البيانات، وتخصيص إعدادات المتجر الأساسية.</p>
        </div>
      </div>

      {/* 🚀 قسم التبويبات الموحد والمنسق لمنع التشتت */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-black text-sm transition-all duration-200 active:scale-95 ${
            activeTab === 'general'
              ? 'border-indigo-600 text-indigo-650 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <SettingsIcon size={18} />
          إدارة وتخصيص المتجر ⚙️
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-black text-sm transition-all duration-200 active:scale-95 ${
            activeTab === 'database'
              ? 'border-indigo-600 text-indigo-650 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Database size={18} />
          المزامنة والاتصال السحابي والنسخ الاحتياطي ☁️
        </button>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <POSSettingsCard settings={settings} setSettings={setSettings} />
          <DomainSettingsCard settings={settings} setSettings={setSettings} activeStore={activeStore} />
          <PlatformIntegrationCard 
            integration={settings.integration} 
            onSave={handleIntegrationSave} 
            isEnabled={settings.enablePlatformIntegration}
            onToggle={togglePlatformIntegration}
          />
          <WalletFeesSettingsCard settings={settings} setSettings={setSettings} />
          <ExpenseCategoriesSettingsCard settings={settings} setSettings={setSettings} />
          <CommunicationSettingsCard settings={settings} setSettings={setSettings} />
          <EmployeeDashboardSettingsCard settings={settings} setSettings={setSettings} />
        </div>
      )}

      {activeTab === 'database' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Hybrid Database Explain Banner */}
          <div className="bg-gradient-to-l from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 p-6 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/40 shadow-sm flex flex-col lg:flex-row items-center gap-6 justify-between animate-in slide-in-from-top duration-700">
            <div className="flex items-center gap-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md shrink-0">
                <CheckCircle2 className="text-emerald-500 w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black dark:text-white">نظام الحفظ المتقدم (Hybrid Database)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
                  تطبيقك يستخدم تقنية **IndexedDB** وهي قاعدة بيانات حقيقية مخزنة على الهارد ديسك الخاص بجهازك. البيانات لا تضيع حتى لو انقطع الإنترنت أو تم تحديث الصفحة. المزامنة السحابية هي فقط "نسخة إضافية" للتأمين والوصول من أجهزة أخرى.
                </p>
              </div>
            </div>
            <div className="flex gap-4 flex-wrap justify-end">
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-[10px] text-slate-400 font-bold">المتجر الحالي الفردي:</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleExportData}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-xl font-bold text-[11px] shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 dark:text-white hover:bg-slate-50 cursor-pointer"
                    >
                      <Database size={14} className="text-indigo-500" /> تصدير المتجر النشط (.json)
                    </button>
                    <label className="px-4 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-705 dark:text-white text-slate-700 rounded-xl font-bold text-[11px] shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
                      <Upload size={14} className="text-indigo-500" /> استيراد المتجر النشط
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

                <div className="flex flex-col gap-1 items-end border-r border-slate-200 dark:border-slate-800 pr-4">
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">🔧 النظام بالكامل وجميع المتاجر:</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleExportMasterBackup}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-150 dark:border-indigo-900 rounded-xl font-bold text-[11px] shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CloudUpload size={14} /> تصدير نسخة النظام الكلي
                    </button>
                    <label className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-[11px] shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
                      <CloudDownload size={14} /> استيراد نسخة النظام الكلي
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImportMasterBackup(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
            </div>
          </div>

          {/* Sync mode options & Manual Sync push/pull */}
          <DatabaseCard 
            dbSyncMode={dbSyncMode} 
            setDbSyncMode={setDbSyncMode} 
            forceSync={forceSync} 
            forcePullFromCloud={forcePullFromCloud}
            saveStatus={saveStatus} 
            activeStore={activeStore}
            orders={orders}
            products={products}
            customers={customers}
            settings={settings}
            wallet={wallet}
            treasury={treasury}
          />

          {onManualSave && (
              <DatabaseManagementCard onSync={onManualSave} />
          )}

          <DangerZone activeStore={activeStore} />
        </div>
      )}
    </div>
  );
};

const POSSettingsCard: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> }> = ({ settings, setSettings }) => {
    const isPosEnabled = settings.isPosEnabled !== false; // Default to true

    const togglePos = () => {
        setSettings(prev => ({
            ...prev,
            isPosEnabled: !isPosEnabled
        }));
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><ShoppingBasket size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">إعدادات نقطة البيع (POS)</h2>
                    <p className="text-xs text-slate-500">التحكم في إتاحة نقطة البيع المباشر (POS) للشركاء والموظفين.</p>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">تفعيل نقطة البيع</span>
                        <p className="text-[10px] text-slate-500 mt-1">عند الإيقاف، سيتم إخفاء نقطة البيع من القائمة الجانبية ومنع الوصول إليها.</p>
                    </div>
                    <ToggleButton active={isPosEnabled} onToggle={togglePos} variant="indigo" />
                </div>
            </div>
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

const DomainSettingsCard: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>>, activeStore?: Store }> = ({ settings, setSettings, activeStore }) => {
    const [isVerifying, setIsVerifying] = React.useState(false);
    const [verifyError, setVerifyError] = React.useState<string | null>(null);
    const [lastSyncResult, setLastSyncResult] = React.useState<any>(null);

    const handleAddDomain = async () => {
        if (!settings.customDomain) {
            setVerifyError('يرجى إدخال اسم النطاق أولاً (مثال: example.com)');
            return;
        }
        if (!activeStore?.id) {
            setVerifyError('خطأ: معرف المتجر غير متوفر');
            return;
        }

        setIsVerifying(true);
        setVerifyError(null);
        try {
            const res = await fetch('/api/domains/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: settings.customDomain,
                    storeId: activeStore.id
                })
            });
            const data = await res.json();
            if (data.success) {
                setLastSyncResult(data.details);
                // The server also updates Firestore, but we can update local state too
                setSettings(prev => ({
                    ...prev,
                    domainStatus: data.details.status === 'active' && data.details.ssl?.status === 'active' ? 'active' : 'pending_validation',
                    domainDNSRecords: data.details
                }));
                alert('تم تسجيل النطاق بنجاح! يرجى إعداد سجلات DNS الموضحة بالأسفل لتفعيل النطاق والـ SSL.');
            } else {
                setVerifyError(data.error || 'فشلت عملية إضافة النطاق');
            }
        } catch (err: any) {
            setVerifyError('حدث خطأ أثناء الاتصال بالخادم: ' + err.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleCheckStatus = async () => {
        if (!settings.customDomain || !activeStore?.id) return;
        
        setIsVerifying(true);
        setVerifyError(null);
        try {
            const res = await fetch('/api/domains/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: settings.customDomain,
                    storeId: activeStore.id
                })
            });
            const data = await res.json();
            if (data.success) {
                setLastSyncResult(data.details);
                setSettings(prev => ({
                    ...prev,
                    domainStatus: data.domainStatus,
                    domainDNSRecords: data.details
                }));
            } else {
                setVerifyError(data.error || 'فشل فحص الحالة');
            }
        } catch (err: any) {
            setVerifyError('حدث خطأ أثناء فحص الحالة: ' + err.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const hostnameInfo = settings.domainDNSRecords || lastSyncResult;
    const records = hostnameInfo?.ownership_verification || hostnameInfo?.ssl?.validation_records?.[0];

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-right">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><LinkIcon size={24}/></div>
                <div>
                    <h2 className="text-xl font-black dark:text-white">أتمتة النطاقات المخصصة (Cloudflare Enterprise Automation)</h2>
                    <p className="text-xs text-slate-500 font-sans">ربط وتفعيل النطاقات المخصصة وتوليد شهادات SSL تلقائياً عبر منصتنا.</p>
                </div>
            </div>
            
            <div className="space-y-6">
                {/* 1. Subdomain Setting */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mr-1">نطاق المتجر المجاني (Subdomain)</label>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                placeholder="اسم-متجرك"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-mono"
                                value={settings.subdomain || ''}
                                onChange={(e) => setSettings(prev => ({ ...prev, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                                dir="ltr"
                            />
                        </div>
                        <span className="text-sm font-bold text-slate-400 dark:text-slate-500 font-mono" dir="ltr">.abdomedi.com</span>
                    </div>
                    {settings.subdomain && (
                        <a href={`https://${settings.subdomain}.abdomedi.com`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline mt-1">
                            <Globe size={12} /> زيارة المتجر: {settings.subdomain}.abdomedi.com
                        </a>
                    )}
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                {/* 2. Custom Domain Setting */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mr-1">النطاق المخصص (3bdomedia.com)</label>
                        {settings.domainStatus && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                settings.domainStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                                settings.domainStatus === 'pending_validation' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {settings.domainStatus === 'active' ? 'متصل ونشط' : 
                                 settings.domainStatus === 'pending_validation' ? 'بانتظار سجلات DNS' : 'خطأ في الربط'}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                placeholder="example.com"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-mono"
                                value={settings.customDomain || ''}
                                onChange={(e) => setSettings(prev => ({ ...prev, customDomain: e.target.value.toLowerCase().trim() }))}
                                dir="ltr"
                            />
                            <div className="absolute left-4 top-3.5 text-slate-400">
                                <Globe size={18} />
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={handleAddDomain}
                            disabled={isVerifying}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            {isVerifying ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            ربط النطاق الآن
                        </button>
                    </div>

                    {verifyError && <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded-lg">{verifyError}</p>}

                    {/* Verification Records Table */}
                    {settings.domainDNSRecords && settings.domainStatus !== 'active' && (
                        <div className="mt-6 bg-slate-50 dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Cloud size={16} className="text-blue-500" />
                                    سجلات توثيق النطاق والـ SSL المطلوبة:
                                </h4>
                                <button 
                                    onClick={handleCheckStatus} 
                                    disabled={isVerifying}
                                    className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    {isVerifying ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                    تحديث الحالة
                                </button>
                            </div>

                            <p className="text-[10px] text-slate-500 mb-4 font-sans leading-relaxed">
                                يرجى إضافة السجلات التالية في لوحة تحكم النطاق (Hostinger / Cloudflare) لتوثيق ملكية النطاق وتفعيل شهادة الـ SSL المجانية.
                            </p>

                            <div className="space-y-3 font-mono">
                                {/* Ownership Verification */}
                                {hostnameInfo.ownership_verification && (
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                                        <div className="flex justify-between items-center mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                                            <span className="bg-indigo-50 text-indigo-600 px-1.5 rounded font-black text-[9px]">TXT Record (Ownership)</span>
                                            <span className="text-slate-400">سجل إثبات الملكية</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-400">Name:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300 select-all" dir="ltr">{hostnameInfo.ownership_verification.name}</span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-400">Value:</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400 select-all break-all text-left" dir="ltr">{hostnameInfo.ownership_verification.value}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SSL Validation */}
                                {hostnameInfo.ssl?.validation_records?.map((record: any, idx: number) => (
                                    <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                                        <div className="flex justify-between items-center mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                                            <span className="bg-emerald-50 text-emerald-600 px-1.5 rounded font-black text-[9px] uppercase">{record.type} Record (SSL)</span>
                                            <span className="text-slate-400">سجل توثيق SSL</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-400">Name:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300 select-all" dir="ltr">{record.name}</span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <span className="text-slate-400">Value:</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 select-all break-all text-left" dir="ltr">{record.value}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Standard CNAME Points to fallback */}
                                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                                    <div className="flex justify-between items-center mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                                        <span className="bg-blue-50 text-blue-600 px-1.5 rounded font-black text-[9px]">CNAME Record (Routing)</span>
                                        <span className="text-slate-400">سجل توجيه المتجر</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-400">Name:</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300 select-all" dir="ltr">@</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-400">Value:</span>
                                            <span className="font-bold text-blue-600 dark:text-blue-400 select-all" dir="ltr">fallback.abdomedi.com</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                {/* 3. Custom App Domain (The original setting) */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mr-1">رابط النظام الأساسي (App Domain) - اختياري</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="https://app.example.com"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-mono"
                            value={settings.customAppDomain || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, customAppDomain: e.target.value }))}
                            dir="ltr"
                        />
                        <div className="absolute left-4 top-3.5 text-slate-400">
                           <Globe size={18} />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                        اترك هذا الحقل فارغاً لاستخدام الرابط الحالي للتطبيق تلقائياً. 
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

interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber" | "indigo"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "blue", disabled = false }) => {
  const colors = { 
    blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', 
    emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', 
    amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700',
    indigo: active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
  };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ right: '4px', color: 'white' }}>On</span> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`} style={{ left: '4px', color: '#64748b' }}>Off</span> </button> );
};

export default SettingsPage;
