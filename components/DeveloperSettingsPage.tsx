import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { audioSynth } from '../utils/audioSynth';
import { Settings, WebhookIntegration, Store } from '../types';
import { Code, Webhook, Key, Trash, Plus, Save, Server, Shield, ShoppingCart, Copy, CheckCircle2, Database, RefreshCw, AlertCircle, AlertTriangle, Check, ExternalLink, ShieldAlert, History, Sparkles, Wifi, WifiOff, Layers, Cloud, CloudUpload, Download, Eye, Activity, Search, Wrench, CheckSquare, Square, Mail, Send } from 'lucide-react';
import { verifyCloudflareD1Connection, isHostingerActive, verifyHostingerConnection, getLocal, saveLocal, saveStoreData, pushLocalToHostinger } from '../services/databaseService';
import ApiKeysManager from './ApiKeysManager';
import WebhooksManager from './WebhooksManager';

const MYSQL_SCHEMA_SCRIPT = `-- =========================================================================
-- السكربت الشامل لإنشاء جداول Hostinger MySQL
-- قم بنسخ هذا الكود وتشغيله في phpMyAdmin (قسم SQL)
-- =========================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- 1. STORES_DATA
CREATE TABLE IF NOT EXISTS stores_data (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  settings JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
  phone VARCHAR(50) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  password TEXT NOT NULL,
  email VARCHAR(255),
  stores JSON,
  sites JSON,
  is_admin BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  join_date VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(255) PRIMARY KEY,
  store_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  description TEXT,
  price DECIMAL(15,2) DEFAULT 0,
  cost_price DECIMAL(15,2) DEFAULT 0,
  stock_quantity DECIMAL(15,2) DEFAULT 0,
  thumbnail TEXT,
  images JSON,
  options JSON,
  variants JSON,
  details JSON,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(255) PRIMARY KEY,
  store_id VARCHAR(255),
  order_number VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'قيد_المراجعة',
  date VARCHAR(100) NOT NULL,
  total_price DECIMAL(15,2) DEFAULT 0,
  shipping_fee DECIMAL(15,2) DEFAULT 0,
  items JSON,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store (store_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. MERCHANT_REQUESTS
CREATE TABLE IF NOT EXISTS merchant_requests (
  id VARCHAR(255) PRIMARY KEY,
  store_id VARCHAR(255),
  merchant_id VARCHAR(255),
  merchant_name VARCHAR(255),
  type VARCHAR(50),
  type_arabic VARCHAR(100),
  amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  date VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  payout_method VARCHAR(50),
  payout_account VARCHAR(255),
  transfer_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store (store_id),
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. PARTNER_TRANSACTIONS
CREATE TABLE IF NOT EXISTS partner_transactions (
  id VARCHAR(255) PRIMARY KEY,
  store_id VARCHAR(255),
  merchant_id VARCHAR(255),
  merchant_name VARCHAR(255),
  date VARCHAR(100),
  type VARCHAR(50),
  amount DECIMAL(15,2) DEFAULT 0,
  balance_after DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  reference_id VARCHAR(255),
  performed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_store (store_id),
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

COMMIT;
`;


interface DeveloperSettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStoreId?: string | null;
  activeStore?: Store;
  hostUrl?: string;
  dbSyncMode?: string;
  setDbSyncMode?: (mode: any) => void;
  forcePullFromCloud?: () => Promise<{ success: boolean; error?: string }>;
  forceSync?: () => Promise<void>;
  saveStatus?: string;
  saveMessage?: string;
  allStoresData: any;
  setAllStoresData: (updater: any) => void;
}

const DeveloperSettingsPage: React.FC<DeveloperSettingsPageProps> = ({ 
  settings, 
  setSettings, 
  activeStoreId, 
  activeStore,
  hostUrl,
  forcePullFromCloud,
  forceSync,
  saveStatus,
  saveMessage,
  allStoresData,
  setAllStoresData
}) => {
  const [integrations, setIntegrations] = useState<WebhookIntegration[]>(settings.webhookIntegrations || []);
  const [dbSyncMode, setDbSyncMode] = useState<string>(() => localStorage.getItem('dbSyncMode') || 'auto');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');
  const [syncPreview, setSyncPreview] = useState<{
    customers: any[];
    treasury: any[];
    wallet: any[];
    storeId: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'database' | 'security' | 'mail' | 'webhooks' | 'apikeys' | 'logs' | 'platforms'>('webhooks');

  // Central Mail Configuration State
  const [mailProvider, setMailProvider] = useState<'resend' | 'brevo' | 'gmail' | 'smtp'>('resend');
  const [mailFrom, setMailFrom] = useState('onboarding@resend.dev');
  const [mailResendKey, setMailResendKey] = useState('');
  const [mailBrevoKey, setMailBrevoKey] = useState('');
  const [mailSmtpHost, setMailSmtpHost] = useState('smtp.gmail.com');
  const [mailSmtpPort, setMailSmtpPort] = useState('587');
  const [mailSmtpUser, setMailSmtpUser] = useState('');
  const [mailSmtpPass, setMailSmtpPass] = useState('');
  const [isSavingMail, setIsSavingMail] = useState(false);
  const [mailStatusMsg, setMailStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);
  const [testMailResult, setTestMailResult] = useState<{ text: string; isError: boolean } | null>(null);
  const [isMailConfigured, setIsMailConfigured] = useState(false);

  useEffect(() => {
    fetch('/api/smtp-config')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.provider) setMailProvider(data.provider);
          if (data.from) setMailFrom(data.from);
          if (data.configured) setIsMailConfigured(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveMailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMail(true);
    setMailStatusMsg(null);
    try {
      const payload: any = {
        provider: mailProvider,
        from: mailFrom.trim(),
        user: mailSmtpUser.trim() || mailFrom.trim()
      };

      if (mailProvider === 'resend') {
        payload.resendApiKey = mailResendKey.trim();
      } else if (mailProvider === 'brevo') {
        payload.brevoApiKey = mailBrevoKey.trim();
      } else if (mailProvider === 'gmail') {
        payload.host = 'smtp.gmail.com';
        payload.port = 587;
        payload.pass = mailSmtpPass.trim();
      } else {
        payload.host = mailSmtpHost.trim();
        payload.port = Number(mailSmtpPort) || 587;
        payload.pass = mailSmtpPass.trim();
      }

      const res = await fetch('/api/save-smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsMailConfigured(true);
        setMailStatusMsg({ text: 'تم حفظ وتفعيل خادم البريد المركزي للنظام بنجاح!', isError: false });
      } else {
        setMailStatusMsg({ text: data.error || 'فشل حفظ إعدادات البريد.', isError: true });
      }
    } catch (err: any) {
      setMailStatusMsg({ text: err?.message || 'خطأ في الاتصال بالخادم.', isError: true });
    } finally {
      setIsSavingMail(false);
    }
  };

  const handleSendTestMail = async () => {
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setTestMailResult({ text: 'يرجى إدخال بريد إلكتروني صالح للتجربة.', isError: true });
      return;
    }
    setIsSendingTestMail(true);
    setTestMailResult(null);
    try {
      const res = await fetch('/api/send-account-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmailRecipient.trim(),
          userName: 'تجربة خادم البريد',
          activationCode: '123456'
        })
      });
      const data = await res.json();
      if (data.success || data.delivered) {
        setTestMailResult({ 
          text: `تم إرسال رسالة الاختبار بنجاح إلى (${data.recipient || testEmailRecipient})! ${data.note || ''}`, 
          isError: false 
        });
      } else {
        setTestMailResult({ text: data.error || 'فشل إرسال رسالة الاختبار. يرجى مراجعة بيانات الاعتماد.', isError: true });
      }
    } catch (err: any) {
      setTestMailResult({ text: err.message || 'خطأ أثناء الإرسال.', isError: true });
    } finally {
      setIsSendingTestMail(false);
    }
  };


  const handleApplySync = () => {
    if (!syncPreview) return;
    const { storeId, customers, treasury, wallet } = syncPreview;
    const storeData = allStoresData[storeId];
    if (!storeData) return;

    const selectedCustomersCount = customers.filter(c => c.selected).length;
    const selectedTreasuryCount = treasury.filter(t => t.selected).length;
    const selectedWalletCount = wallet.filter(w => w.selected).length;

    if (selectedCustomersCount === 0 && selectedTreasuryCount === 0 && selectedWalletCount === 0) {
      alert('يرجى اختيار تغيير واحد على الأقل لتطبيقه.');
      return;
    }

    // Apply customer changes
    const updatedCustomers = (storeData.customers || []).map((c: any) => {
      const change = customers.find(ch => ch.id === c.id && ch.selected);
      if (change) {
        return { ...c, debtBalance: change.newBalance };
      }
      return c;
    });

    // Apply treasury changes
    const originalTreasury = storeData.treasury || { accounts: [], transactions: [] };
    const updatedAccounts = originalTreasury.accounts.map((acc: any) => {
      const change = treasury.find(ch => ch.id === acc.id && ch.selected);
      if (change) {
        return { ...acc, balance: change.newBalance };
      }
      return acc;
    });

    // Apply wallet changes
    let originalWallet = storeData.wallet || { balance: 0, transactions: [] };
    let updatedWalletBalance = originalWallet.balance;
    let updatedWalletTxs = [...(originalWallet.transactions || [])];

    // Handle wallet balance fix
    const balanceFix = wallet.find(w => w.id === 'wallet_balance' && w.selected);
    if (balanceFix) {
      updatedWalletBalance = balanceFix.newBalance;
    }

    // Handle transaction removals (sort by index descending to avoid index shifts)
    const txRemovals = wallet
      .filter(w => w.type === 'tx_remove' && w.selected)
      .sort((a, b) => b.txIndex - a.txIndex);
    
    txRemovals.forEach(rem => {
      updatedWalletTxs.splice(rem.txIndex, 1);
    });

    setAllStoresData((prev: any) => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        customers: updatedCustomers,
        treasury: { ...originalTreasury, accounts: updatedAccounts },
        wallet: { ...originalWallet, balance: updatedWalletBalance, transactions: updatedWalletTxs }
      }
    }));

    setLog(prev => prev + `✅ تمت معالجة ${selectedCustomersCount + selectedTreasuryCount + selectedWalletCount} تغيير مختار بنجاح.\n`);
    setSyncPreview(null);
  };

  
  // Cloud Provider States (Cloudflare D1 primary, optional Hostinger MySQL backup)
  const [cloudProvider, setCloudProvider] = useState<string>(() => localStorage.getItem('custom_cloud_provider') || 'cloudflare');
  const [showMysqlSchema, setShowMysqlSchema] = useState(false);

  // Sync Conflict Strategy State
  const [syncConflictStrategy, setSyncConflictStrategy] = useState(
    localStorage.getItem('syncConflictStrategy') || 'last_write_wins'
  );
  
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isPullingRemote, setIsPullingRemote] = useState(false);

  // In-app Custom alarm / alert system state
  const [alarm, setAlarm] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    onConfirm?: () => void;
    showCancel?: boolean;
    cancelText?: string;
    confirmText?: string;
  } | null>(null);

  const playAlarmSound = (type: 'success' | 'warning' | 'error' | 'info') => {
    try {
      audioSynth.playTone(type);
    } catch (e) {
      console.error("Audio beep failed:", e);
    }
  };

  const triggerAlarm = (
    message: string, 
    type: 'success' | 'warning' | 'error' | 'info' = 'info', 
    title: string = 'تنبيه النظام', 
    options?: { onConfirm?: () => void; showCancel?: boolean; cancelText?: string; confirmText?: string }
  ) => {
    playAlarmSound(type);
    setAlarm({
      show: true,
      title,
      message,
      type,
      onConfirm: options?.onConfirm,
      showCancel: options?.showCancel,
      cancelText: options?.cancelText || 'إلغاء',
      confirmText: options?.confirmText || 'موافق'
    });
  };

  const handleSaveConflictStrategy = (strategy: string) => {
    localStorage.setItem('syncConflictStrategy', strategy);
    setSyncConflictStrategy(strategy);
    triggerAlarm("🚀 تم تعديل سياسة حل التعارض وتأمين المزامنة تلقائياً للفروع والديسك توب!", 'success', 'مزامنة حل التعارض');
  };

  const triggerManualSync = async () => {
    if (!forceSync) return;
    setIsManualSyncing(true);
    try {
      await forceSync();
      triggerAlarm("✅ تم دفع المزامنة السحابية وبدء الرفع بنجاح!", 'success', 'مكتمل');
    } catch (e: any) {
      console.error(e);
      triggerAlarm(`❌ فشلت عملية المزامنة: ${e.message || String(e)}`, 'error', 'خطأ مزامنة');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const triggerCloudPull = async () => {
    if (!forcePullFromCloud) return;
    triggerAlarm(
      "⚠️ هل أنت متأكد من رغبتك في سحب واستيراد البيانات من السحابة؟ هذا قد يستبدل أي بيانات محلية لم يتم رفعها بعد على خوادم قاعدة البيانات.",
      'warning',
      'تأكيد استرداد البيانات',
      {
        showCancel: true,
        confirmText: 'نعم، استرد الآن',
        cancelText: 'إلغاء',
        onConfirm: async () => {
          setIsPullingRemote(true);
          try {
            const res = await forcePullFromCloud();
            if (res && res.success) {
              triggerAlarm("✅ تم استيراد وسحب البيانات من السحابة وتحديث الذاكرة المحلية بنجاح!", 'success', 'مكتمل');
            } else if (res && res.error) {
              triggerAlarm(`❌ فشل استرداد البيانات: ${res.error}`, 'error', 'فشل الاسترداد');
            }
          } catch (e: any) {
            console.error(e);
            triggerAlarm(`❌ فشل استيراد البيانات: ${e.message || String(e)}`, 'error', 'فشل الاسترداد');
          } finally {
            setIsPullingRemote(false);
          }
        }
      }
    );
  };

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedLink(text);
      setTimeout(() => setCopiedLink(null), 2000);
  };

  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyCloudflareD1 = async () => {
    setIsVerifying(true);
    try {
      const check = await verifyCloudflareD1Connection();
      if (check.success) {
        triggerAlarm(
          `✅ قاعدة بيانات Cloudflare D1 متصلة وتعمل بكفاءة!\n\nالمتاجر المسجلة: ${check.storesCount ?? 0} | المستخدمون: ${check.usersCount ?? 0}`,
          'success',
          'اتصال Cloudflare D1 نشط'
        );
      } else {
        triggerAlarm(`❌ تعذر الاتصال بـ Cloudflare D1: ${check.error || 'خطأ غير معروف'}`, 'error', 'فشل الفحص');
      }
    } catch (e: any) {
      triggerAlarm('خطأ أثناء فحص الاتصال: ' + e.message, 'error', 'خطأ التحقق');
    } finally {
      setIsVerifying(false);
    }
  };

  const addIntegration = () => {
    setIntegrations([...integrations, {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      storeUrl: '',
      webhookUrl: '',
      secretKey: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      isActive: true
    }]);
  };

  const removeIntegration = (id: string) => {
    setIntegrations(integrations.filter(i => i.id !== id));
  };

  const updateIntegration = (id: string, field: keyof WebhookIntegration, value: any) => {
    setIntegrations(integrations.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const saveSettings = () => {
    setSettings(prev => ({ ...prev, webhookIntegrations: integrations }));
    triggerAlarm("تم حفظ الإعدادات والربط الخارجي بنجاح", 'success', 'مكتمل');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4">
      <div className="flex justify-between items-end mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-xl shadow-slate-900/20 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
              <Code size={24} className="text-white" />
            </div>
            أدوات المطورين
          </h1>
          <p className="text-slate-300 font-medium">لوحة التحكم المتقدمة بإعدادات التكامل وربط المنصات</p>
        </div>
        <button 
          onClick={saveSettings}
          className="relative z-10 btn bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-white/10 flex items-center gap-2 font-bold px-6 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
        >
          <Save size={18} />
          حفظ التغييرات
        </button>
      </div>

      
      {/* Modern Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        {[
          { id: 'webhooks', label: 'الربط البرمجي (Webhooks)', icon: <Webhook size={16} /> },
          { id: 'apikeys', label: 'مفاتيح الربط (API Keys)', icon: <Key size={16} /> },
          { id: 'platforms', label: 'ربط المنصات الخارجية', icon: <ShoppingCart size={16} /> },
          { id: 'logs', label: 'سجل النشاط البرمجي', icon: <History size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-primary text-white shadow-md shadow-primary/20' 
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      <AnimatePresence mode="wait">

        {activeTab === 'database' && (
          <motion.div
            key="database"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div id="custom-database-settings"  className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                 <Database size={20} />
              </div>
              <div className="text-right">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">إعدادات الربط السحابي وقاعدة البيانات</h2>
                <p className="text-sm text-slate-500">تمتع بحرية تامة وتزامن سحابي كامل من خلال إعدادات الربط المخصصة.</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                 {[
                   { id: 'cloudflare', label: 'Cloudflare D1', icon: <Cloud size={14} /> },
                   { id: 'hostinger', label: 'Hostinger (MySQL)', icon: <Server size={14} /> }
                 ].map(p => (
                   <button
                     key={p.id}
                     onClick={() => {
                       setCloudProvider(p.id);
                       localStorage.setItem('custom_cloud_provider', p.id);
                     }}
                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                       cloudProvider === p.id 
                         ? 'bg-white dark:bg-slate-700 text-primary shadow-sm border border-slate-200 dark:border-slate-600' 
                         : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                     }`}
                   >
                     {p.icon}
                     {p.label}
                   </button>
                 ))}
              </div>

              <div className="flex items-center gap-2">
                {cloudProvider === 'hostinger' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-200/50 dark:border-blue-900/30">
                    <Check size={14} />
                    <span>خادم Hostinger MySQL نشط</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
                    <Check size={14} />
                    <span>Cloudflare D1 متصل</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 text-right">
          {cloudProvider === 'hostinger' ? (
            <div className="bg-blue-50/50 dark:bg-blue-950/25 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
              <h3 className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2 justify-start">
                <Server size={16} /> <span>ربط خادم Hostinger MySQL الخاص بك 🚀</span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                  لقد اخترت استخدام خادم MySQL الخاص بك لتجاوز قيود القراءة والكتابة. 
                  تأكد من إدخال بيانات قاعدة البيانات في ملف <code>.env</code> بالخادم لكي يعمل الربط.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                 <div className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-mono">
                    MYSQL_HOST: {import.meta.env.VITE_MYSQL_HOST || 'config_in_backend'}
                 </div>
                 <div className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-mono">
                    STATUS: <span className="text-green-500 font-bold">READY</span>
                 </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-900/30 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
              <h3 className="font-bold text-emerald-900 dark:text-emerald-400 flex items-center gap-2 justify-start">
                <Shield size={16} /> <span>قاعدة بيانات Cloudflare D1 السحابية المدمجة ☁️</span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                  يعمل النظام بالكامل على بنية Cloudflare (Workers + D1 + IndexedDB Cache) بدون أي حدود قراءة يومية أو تقييد للنقل، مع مزامنة ثنائية فورية وحفظ آمن لجميع الطلبات، الحركات المالية، والويب هوكس.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-2.5">
              <button 
                onClick={handleVerifyCloudflareD1}
                disabled={isVerifying}
                className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Activity size={16} />
                )}
                {isVerifying ? "جاري التحقق..." : "فحص اتصال Cloudflare D1"}
              </button>

              <button
                onClick={() => {
                  const data = JSON.stringify(settings);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `data_export_${new Date().toISOString()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition flex items-center gap-2"
              >
                <Download size={16} />
                تنزيل البيانات
              </button>

              <button
                onClick={async () => {
                  try {
                    setLog(`جاري البدء في فحص وتحليل البيانات المالية...\n`);
                    const results: string[] = [];
                    
                    const storeId = activeStoreId;
                    if (!storeId) {
                      setLog(prev => prev + `⚠️ تنبيه: لم يتم اكتشاف متجر نشط حالياً لفحصه. يرجى اختيار متجر أولاً.\n`);
                      return;
                    }

                    const storeData = allStoresData[storeId];
                    if (!storeData) return;

                    // Check for 600 specific values
                    const treasury = storeData.treasury || { accounts: [], transactions: [] };
                    const treasuryMatch = treasury.accounts.filter((a: any) => a.balance === 600 || a.initialBalance === 600);
                    if (treasuryMatch.length > 0) {
                      results.push(`🚩 تم العثور على حسابات في الخزينة برصيد أو رصيد افتتاحي 600: ${treasuryMatch.map((a: any) => a.name).join(', ')}`);
                    }

                    const wallet = storeData.wallet || { balance: 0, transactions: [] };
                    if (wallet.balance === 600) results.push(`🚩 رصيد المحفظة الإجمالي هو 600 بالضبط`);
                    
                    const walletTxMatch = (wallet.transactions || []).filter((t: any) => t.amount === 600);
                    if (walletTxMatch.length > 0) {
                      results.push(`🚩 تم العثور على ${walletTxMatch.length} عملية في المحفظة بقيمة 600`);
                    }

                    const customersMatch = (storeData.customers || []).filter((c: any) => c.debtBalance === 600);
                    if (customersMatch.length > 0) {
                      results.push(`🚩 تم العثور على ${customersMatch.length} عملاء مديونيتهم 600`);
                    }

                    // Deep Debt Check
                    const posSales = storeData.settings?.posSales || [];
                    const creditSales = posSales.filter((s: any) => s.cashHolderId === 'credit');
                    
                    (storeData.customers || []).forEach((c: any) => {
                      const customerCreditSales = creditSales.filter((s: any) => s.customerPhone === c.phone);
                      const totalCredit = customerCreditSales.reduce((sum: number, s: any) => sum + s.totalAmount, 0);
                      if (totalCredit !== (c.debtBalance || 0)) {
                        results.push(`❗ فرق مديونية للعميل ${c.name} (${c.phone}): المسجل ${c.debtBalance}، المحسوب من السجلات ${totalCredit}`);
                      }
                    });

                    // Treasury Integrity Check
                    treasury.accounts.forEach((acc: any) => {
                      const accTxs = (treasury.transactions || []).filter((t: any) => t.fromAccountId === acc.id || t.toAccountId === acc.id);
                      const calculatedBalance = accTxs.reduce((sum: number, t: any) => {
                        if (t.toAccountId === acc.id) return sum + t.amount;
                        if (t.fromAccountId === acc.id) return sum - t.amount;
                        return sum;
                      }, acc.initialBalance || 0);

                      if (calculatedBalance !== acc.balance) {
                        results.push(`❗ فرق رصيد في الخزينة ${acc.name}: المسجل ${acc.balance}، المحسوب من العمليات ${calculatedBalance}`);
                      }
                    });

                    if (results.length === 0) {
                      setLog(prev => prev + `✅ لم يتم العثور على أي فروقات أو أخطاء في توازن الحسابات.\n`);
                    } else {
                      setLog(prev => prev + `⚠️ تم العثور على الملاحظات التالية:\n\n` + results.join('\n') + `\n\n💡 نصيحة: يمكنك استخدام زر "إعادة المزامنة" لتصحيح هذه الفروقات آلياً بناءً على سجلات العمليات.`);
                    }
                  } catch (err: any) {
                    setLog(prev => prev + `❌ خطأ في الفحص: ${err.message}\n`);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
              >
                <Search size={16} />
                فحص وتحليل الفروقات المالية (Audit)
              </button>

              <button
                onClick={async () => {
                  try {
                    setLog(`جاري تحليل السجلات لحساب الفروقات...\n`);
                    const storeId = activeStoreId;
                    if (!storeId) {
                      setLog(prev => prev + `⚠️ تنبيه: لم يتم اكتشاف متجر نشط حالياً للمزامنة. يرجى اختيار متجر أولاً.\n`);
                      return;
                    }

                    const storeData = allStoresData[storeId];
                    if (!storeData) return;

                    const posSales = storeData.settings?.posSales || [];
                    const creditSales = posSales.filter((s: any) => s.cashHolderId === 'credit');
                    
                    const customerChanges: any[] = [];
                    (storeData.customers || []).forEach((c: any) => {
                      const customerCreditSales = creditSales.filter((s: any) => s.customerPhone === c.phone);
                      const totalCredit = customerCreditSales.reduce((sum: number, s: any) => sum + s.totalAmount, 0);
                      if (totalCredit !== (c.debtBalance || 0)) {
                        customerChanges.push({
                          id: c.id,
                          phone: c.phone,
                          name: c.name,
                          oldBalance: c.debtBalance || 0,
                          newBalance: totalCredit,
                          description: "مديونية العميل الحالية لا تطابق مجموع فواتير الآجل المسجلة له. سيتم تصحيح المديونية بناءً على السجلات.",
                          selected: true
                        });
                      }
                    });

                    const treasury = storeData.treasury || { accounts: [], transactions: [] };
                    const treasuryChanges: any[] = [];
                    treasury.accounts.forEach((acc: any) => {
                      const accTxs = (treasury.transactions || []).filter((t: any) => t.fromAccountId === acc.id || t.toAccountId === acc.id);
                      const calculatedBalance = accTxs.reduce((sum: number, t: any) => {
                        if (t.toAccountId === acc.id) return sum + t.amount;
                        if (t.fromAccountId === acc.id) return sum - t.amount;
                        return sum;
                      }, acc.initialBalance || 0);
                      
                      if (calculatedBalance !== acc.balance) {
                        treasuryChanges.push({
                          id: acc.id,
                          name: acc.name,
                          oldBalance: acc.balance,
                          newBalance: calculatedBalance,
                          description: "رصيد الحساب المسجل يختلف عن ناتج العمليات. سيتم إعادة حساب الرصيد بدقة من واقع حركة الخزينة.",
                          selected: true
                        });
                      }
                    });

                    const wallet = storeData.wallet || { balance: 0, transactions: [] };
                    const walletChanges: any[] = [];
                    const walletTxs = wallet.transactions || [];
                    const calculatedWalletBalance = walletTxs.reduce((sum: number, t: any) => sum + (t.type === 'deposit' ? t.amount : -t.amount), 0);
                    
                    if (calculatedWalletBalance !== wallet.balance) {
                      walletChanges.push({
                        id: 'wallet_balance',
                        name: 'رصيد المحفظة الإجمالي',
                        oldBalance: wallet.balance,
                        newBalance: calculatedWalletBalance,
                        type: 'balance_fix',
                        description: "الرصيد الظاهر لا يطابق مجموع عمليات الإيداع والسحب. سيتم تصحيح الرصيد ليعبر عن حقيقة السجلات.",
                        selected: true
                      });
                    }

                    if (customerChanges.length === 0 && treasuryChanges.length === 0 && walletChanges.length === 0) {
                      setLog(prev => prev + `✅ البيانات مطابقة تماماً للسجلات، لا توجد فروقات للمزامنة.\n`);
                      return;
                    }

                    setSyncPreview({
                      customers: customerChanges,
                      treasury: treasuryChanges,
                      wallet: walletChanges,
                      storeId
                    });
                    setLog(prev => prev + `🔍 تم العثور على ${customerChanges.length + treasuryChanges.length + walletChanges.length} فرق مالي. يرجى مراجعتها أدناه.\n`);
                  } catch (err: any) {
                    setLog(prev => prev + `❌ خطأ في التحليل: ${err.message}\n`);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition flex items-center gap-2"
              >
                <Wrench size={16} />
                إعادة مزامنة المديونيات والخزينة من السجلات
              </button>

              {log && (
                <button
                  onClick={() => setLog('')}
                  className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-300 transition"
                >
                  مسح السجل
                </button>
              )}

            </div>
          </div>

          {syncPreview && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 overflow-hidden mb-6"
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white">مراجعة التغييرات المقترحة</h3>
                    <p className="text-xs text-slate-500 mt-1">راجع الفروقات المكتشفة واشِر إلى ما تريد تحديثه</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSyncPreview(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition text-slate-400"
                >
                  <Trash size={18} />
                </button>
              </div>

              <div className="space-y-6 max-h-[500px] overflow-auto px-1">
                {syncPreview.customers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <ShoppingCart size={16} className="text-indigo-500" />
                      مديونيات العملاء ({syncPreview.customers.length})
                    </h4>
                    <div className="space-y-2">
                      {syncPreview.customers.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setSyncPreview({
                                ...syncPreview,
                                customers: syncPreview.customers.map(item => item.id === c.id ? { ...item, selected: !item.selected } : item)
                              })}
                              className={`transition-colors ${c.selected ? 'text-indigo-600' : 'text-slate-300'}`}
                            >
                              {c.selected ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</p>
                              <p className="text-[10px] text-slate-500 mb-1">{c.phone}</p>
                              <p className="text-[10px] text-indigo-500 font-bold leading-tight max-w-[200px]">
                                {c.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-xs text-rose-500 line-through decoration-rose-500/30">{(c.oldBalance ?? 0).toLocaleString()}</span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span className="text-sm font-bold text-emerald-500">{(c.newBalance ?? 0).toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {syncPreview.treasury.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Database size={16} className="text-indigo-500" />
                      أرصدة الخزينة ({syncPreview.treasury.length})
                    </h4>
                    <div className="space-y-2">
                      {syncPreview.treasury.map((acc) => (
                        <div key={acc.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setSyncPreview({
                                ...syncPreview,
                                treasury: syncPreview.treasury.map(item => item.id === acc.id ? { ...item, selected: !item.selected } : item)
                              })}
                              className={`transition-colors ${acc.selected ? 'text-indigo-600' : 'text-slate-300'}`}
                            >
                              {acc.selected ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{acc.name}</p>
                              <p className="text-[10px] text-indigo-500 font-bold leading-tight max-w-[200px] mt-1">
                                {acc.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-xs text-rose-500 line-through decoration-rose-500/30">{(acc.oldBalance ?? 0).toLocaleString()}</span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span className="text-sm font-bold text-emerald-500">{(acc.newBalance ?? 0).toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {syncPreview.wallet.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Key size={16} className="text-indigo-500" />
                      المحفظة وتوازن العمليات ({syncPreview.wallet.length})
                    </h4>
                    <div className="space-y-2">
                      {syncPreview.wallet.map((w) => (
                        <div key={w.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setSyncPreview({
                                ...syncPreview,
                                wallet: syncPreview.wallet.map(item => item.id === w.id ? { ...item, selected: !item.selected } : item)
                              })}
                              className={`transition-colors ${w.selected ? 'text-indigo-600' : 'text-slate-300'}`}
                            >
                              {w.selected ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{w.name}</p>
                              <p className="text-[10px] text-indigo-500 font-bold leading-tight max-w-[200px] mt-1">
                                {w.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-xs text-rose-500 line-through decoration-rose-500/30">{(w.oldBalance ?? 0).toLocaleString()}</span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span className="text-sm font-bold text-emerald-500">{(w.newBalance ?? 0).toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={handleApplySync}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  اعتماد وتطبيق التغييرات المختارة
                </button>
                <button 
                  onClick={() => setSyncPreview(null)}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          )}

          {log && (
            <div className="mt-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-auto max-h-[300px] whitespace-pre-wrap" dir="ltr">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                <span className="text-slate-400 font-bold">نتائج الفحص والمزامنة:</span>
                <div className="flex gap-2">
                  <button onClick={() => setLog('')} className="text-rose-400 hover:text-rose-300">إغلاق</button>
                </div>
              </div>
              {log}
            </div>
          )}

          {cloudProvider === 'hostinger' && (
            <div className="w-full mt-4 p-5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-3xl border border-indigo-200/50 dark:border-indigo-900/30">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-right">
                <div className="flex-1">
                  <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                    <Sparkles size={16} />
                    نقل البيانات الحالية إلى Hostinger MySQL (Migration)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    بما أنك قمت بتفعيل Hostinger MySQL كنسخة احتياطية إضافية، اضغط على الزر أدناه لرفع كافة طلباتك ومنتجاتك الحالية من هذا الجهاز إلى MySQL فوراً.
                  </p>
                </div>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    const btn = e.currentTarget as HTMLButtonElement;
                    
                    triggerAlarm(
                      `⚠️ هل أنت متأكد؟ سيتم رفع كافة البيانات المحلية من هذا الجهاز إلى خادم Hostinger MySQL.`,
                      'warning',
                      'تأكيد المزامنة والرفع للسحابة',
                      {
                        showCancel: true,
                        confirmText: 'نعم، ابدأ الرفع',
                        cancelText: 'إلغاء',
                        onConfirm: async () => {
                          btn.disabled = true;
                          const originalContent = btn.innerHTML;
                          btn.innerHTML = '<span class="animate-spin">🔄</span> جاري الرفع...';
                          
                          try {
                            const storeId = activeStoreId || localStorage.getItem('lastActiveStoreId');
                            const store = activeStore;
                            
                            if (!storeId || !store) throw new Error("لم يتم اختيار متجر");
                            
                            const localData = await getLocal(storeId);
                            if (!localData) throw new Error("لا توجد بيانات محلية للرفع");
                            
                            const res = await pushLocalToHostinger(storeId, store.name, localData);
                            
                            if (res.success) {
                              triggerAlarm("✅ تمت المزامنة والرفع بنجاح!", 'success', 'مزامنة ناجحة');
                            } else {
                              throw new Error(res.error);
                            }
                          } catch (e: any) {
                            triggerAlarm("❌ فشل الرفع المباشر: " + e.message, 'error', 'خطأ مزامنة');
                          } finally {
                            btn.disabled = false;
                            btn.innerHTML = originalContent;
                          }
                        }
                      }
                    );
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 whitespace-nowrap"
                >
                  <CloudUpload size={18} />
                  ابدأ مزامنة ورفع البيانات الآن
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-right">
              <button 
                type="button"
                onClick={() => setShowMysqlSchema(!showMysqlSchema)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/30 text-right font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-2">
                  <Server size={16} className="text-blue-500" />
                  <span>كود SQL لـ Hostinger MySQL 🐬</span>
                </div>
                <span className="text-xs text-slate-400">{showMysqlSchema ? 'إخفاء' : 'عرض'}</span>
              </button>

              {showMysqlSchema && (
                <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-hidden relative">
                  <div className="absolute top-3 left-3 z-10">
                    <button 
                      onClick={() => handleCopy(MYSQL_SCHEMA_SCRIPT)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold border border-slate-700 transition active:scale-95"
                    >
                      {copiedLink === MYSQL_SCHEMA_SCRIPT ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      <span>{copiedLink === MYSQL_SCHEMA_SCRIPT ? 'تم النسخ!' : 'نسخ'}</span>
                    </button>
                  </div>
                  <pre className="max-h-48 overflow-y-auto pt-8 text-left dir-ltr" style={{ direction: 'ltr' }}>
                    {MYSQL_SCHEMA_SCRIPT}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
          </motion.div>
        )}

        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3 text-right">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
               <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">أمان المزامنة والوقاية من تعارض وتضارب البيانات 🔐</h2>
              <p className="text-sm text-slate-500">حماية المعاملات الحسابية والفواتير والطلبات عند العمل بأكثر من جهاز أو دون اتصال بالإنترنت.</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 text-right">
          <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            💬 يواجه أصحاب المتاجر أحياناً مشكلة تداخل البيانات وتضاربها إذا قام الكاشير بالاقتصاص بدون إنترنت ثم حدث تعديل لطلب من هاتف المدير سحابياً. يقوم هذا النظام المتكامل بمقارنة الحقول تلقائياً وتطبيق استراتيجيات دقيقة جداً مع ميزة 
            <strong className="text-indigo-600 dark:text-indigo-400 mx-1">مزامنة CDC الرقمية</strong> لحماية أرباحك وتجنب أي تعويضات أو ضياع للعمليات المالية.
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 justify-start">
              <Layers size={16} className="text-indigo-500" />
              <span>اختر سياسة المزامنة وحل الخلافات (Conflict Strategy)</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                onClick={() => handleSaveConflictStrategy('last_write_wins')}
                className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 relative ${
                  syncConflictStrategy === 'last_write_wins'
                    ? 'border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/10 ring-2 ring-indigo-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    syncConflictStrategy === 'last_write_wins' 
                      ? 'border-indigo-600 bg-indigo-600' 
                      : 'border-slate-300'
                  }`}>
                    {syncConflictStrategy === 'last_write_wins' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">الافتراضي والأقوى</span>
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1.5">الأحدث فوزاً (Last-Write)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  مقارنة البصمة الزمنية الفريدة <code className="font-mono bg-slate-100 dark:bg-black px-1 rounded">updatedAt</code> محلياً وسحابياً وحفظ التعديل الأحدث دائماً لمنع ضياع الفواتير المنقحة.
                </p>
              </div>

              <div 
                onClick={() => handleSaveConflictStrategy('local_wins')}
                className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 relative ${
                  syncConflictStrategy === 'local_wins'
                    ? 'border-blue-600 bg-blue-50/10 dark:bg-blue-950/10 ring-2 ring-blue-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    syncConflictStrategy === 'local_wins' 
                      ? 'border-blue-600 bg-blue-600' 
                      : 'border-slate-300'
                  }`}>
                    {syncConflictStrategy === 'local_wins' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">محلي يفوق</span>
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1.5">النسخ المحلي يفرض (Local Wins)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  تحديث السحابة فوراً بأي تغيير في هذا الجهاز، ممتاز للغاية عند الرغبة باعتماد بيانات الحاسوب المكتبي (الرئيسي) كمرجع دائم فوق أي تعديل خارجي.
                </p>
              </div>

              <div 
                onClick={() => handleSaveConflictStrategy('cloud_wins')}
                className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 relative ${
                  syncConflictStrategy === 'cloud_wins'
                    ? 'border-orange-600 bg-orange-50/10 dark:bg-orange-950/10 ring-2 ring-orange-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    syncConflictStrategy === 'cloud_wins' 
                      ? 'border-orange-600 bg-orange-600' 
                      : 'border-slate-300'
                  }`}>
                    {syncConflictStrategy === 'cloud_wins' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </span>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2 py-0.5 rounded-full">سحابي حاسم</span>
                </div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1.5">السحابة مهيمنة (Cloud Wins)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  تجاهل وإهمال المزامنة لأي بند محلي لو كان موجوداً وصالحاً مسبقاً في قواعد البيانات لتجنب أي تلاعب من الأجهزة الفرعية للعمال دون إذن.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 justify-start mb-4">
              <History size={16} className="text-indigo-500" />
              <span>التحكم اليدوي ومؤشرات الأمان الفورية ⚙️</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800/50 flex items-center justify-between">
                <div className="text-right">
                  <p className="text-xs text-slate-500">حالة الاتصال والبيئة</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                    {dbSyncMode === 'auto' ? (
                      <>
                        <Wifi size={14} className="text-green-500 animate-pulse" />
                        <span className="text-green-600">تزامن تلقائي فوري مفعّل</span>
                      </>
                    ) : (
                      <>
                        <WifiOff size={14} className="text-amber-500" />
                        <span className="text-amber-600 font-bold">وضع العمل محلياً (ديسك توب)</span>
                      </>
                    )}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    const nextMode = dbSyncMode === 'auto' ? 'manual' : 'auto';
                    if (setDbSyncMode) {
                      setDbSyncMode(nextMode);
                      localStorage.setItem('dbSyncMode', nextMode);
                      alert(`🔄 تم التحويل إلى وضع: ${nextMode === 'auto' ? 'التزامن التلقائي السحابي' : 'العمل دون إنترنت محلياً (ديسك توب)'}`);
                    }
                  }}
                  className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-bold transition"
                >
                  تغيير الوضع
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800/50">
                <p className="text-xs text-slate-500">حماية وسلامة العمليات المالية</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                  <Sparkles size={14} />
                  <span>محصنة تلقائياً من التداخلات المزدوجة</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">يقوم خادم CDC المدمج والمنفذ بحرص بمراجعة كل المعاملات.</p>
              </div>

              <div className="flex flex-col gap-2 justify-center">
                <button 
                  onClick={triggerManualSync}
                  disabled={isManualSyncing}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700 shadow-sm"
                >
                  <RefreshCw size={14} className={isManualSyncing ? "animate-spin" : ""} />
                  {isManualSyncing ? "جاري دفع المزامنة السحابية..." : "دفع المزامنة السحابية الآن (رفع) 📤"}
                </button>

                <button 
                  onClick={triggerCloudPull}
                  disabled={isPullingRemote}
                  className="w-full bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-indigo-200/50 dark:border-indigo-900/30"
                >
                  <RefreshCw size={14} className={isPullingRemote ? "animate-spin" : ""} />
                  {isPullingRemote ? "جاري الاسترداد كلياً..." : "استرداد البيانات سحابياً (تنزيل) 📥"}
                </button>
              </div>
            </div>

            {(saveStatus === 'saving' || saveStatus === 'success' || saveStatus === 'error') && (
              <div className={`mt-3 p-3 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2 transition ${
                saveStatus === 'saving' ? 'bg-indigo-50 text-indigo-600' :
                saveStatus === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}>
                <span>{saveMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
          </motion.div>
        )}

        {activeTab === 'webhooks' && (
          <motion.div
            key="webhooks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <WebhooksManager
              settings={settings}
              setSettings={setSettings}
              activeStoreId={activeStoreId || undefined}
              hostUrl={hostUrl}
              storeData={activeStoreId && allStoresData ? allStoresData[activeStoreId] : undefined}
              orders={activeStoreId && allStoresData ? allStoresData[activeStoreId]?.orders : undefined}
              customers={activeStoreId && allStoresData ? allStoresData[activeStoreId]?.customers : undefined}
              products={activeStoreId && allStoresData ? allStoresData[activeStoreId]?.settings?.products : undefined}
            />
          </motion.div>
        )}

        {activeTab === 'apikeys' && (
          <motion.div
            key="apikeys"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ApiKeysManager 
              settings={settings} 
              setSettings={setSettings} 
              activeStoreId={activeStoreId} 
              hostUrl={hostUrl} 
            />
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
      <div id="activity-movements" className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <History size={20} />
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">سجل التحركات والنشاط</h2>
              <p className="text-sm text-slate-500">مراقبة كافة العمليات والتحركات التي تتم في النظام.</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.href = `/store/${activeStoreId}/activity-logs`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
          >
            <Eye size={16} />
            فتح السجل الكامل
          </button>
        </div>
        <div className="p-6">
          <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-right text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-black">
                <tr>
                  <th className="px-4 py-3">الموظف</th>
                  <th className="px-4 py-3">الإجراء</th>
                  <th className="px-4 py-3">التفاصيل</th>
                  <th className="px-4 py-3">التوقيت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {(settings.activityLogs || []).slice(0, 5).map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{log.user}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-black">{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.details}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">{log.date}</td>
                  </tr>
                ))}
                {(settings.activityLogs || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic">لا توجد تحركات مسجلة حالياً.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
          </motion.div>
        )}

        {activeTab === 'mail' && (
          <motion.div
            key="mail"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 mt-4"
          >
            {/* Header info card */}
            <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Mail size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white">خادم البريد المركزي للمنصة (Platform Global Mailer)</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                        isMailConfigured 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {isMailConfigured ? '🟢 نشط ومفعل مركزياً' : '🟡 يعمل بالوضع التلقائي'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      يتم حفظ هذه الإعدادات مركزياً على مستوى الخادم لخدمة <strong>جميع التجار والمستخدمين تلقائياً</strong> (رسائل تفعيل الحسابات، رموز 2FA OTP، والإشعارات)، دون أن يطلب النظام أي بيانات بريد من التجار أو المستخدمين مطلقاً.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Config Form & Test Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form Card (2 Columns) */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Server size={18} className="text-emerald-500" />
                  <span>تكوين خادم الإرسال المركزي</span>
                </h3>

                <form onSubmit={handleSaveMailConfig} className="space-y-4">
                  
                  {/* Provider Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      مزود خدمة البريد الأساسي:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'resend', label: 'Resend API (موصى به)' },
                        { id: 'brevo', label: 'Brevo (Sendinblue)' },
                        { id: 'gmail', label: 'Gmail SMTP' },
                        { id: 'smtp', label: 'SMTP مخصص' }
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setMailProvider(p.id as any)}
                          className={`p-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                            mailProvider === p.id 
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm' 
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sender Email (From) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      عنوان البريد المرسل (From Address):
                    </label>
                    <input 
                      type="text"
                      value={mailFrom}
                      onChange={e => setMailFrom(e.target.value)}
                      placeholder={mailProvider === 'resend' ? 'onboarding@resend.dev أو info@yourdomain.com' : 'no-reply@yourdomain.com'}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 dir-ltr text-right"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      الاسم أو البريد الذي سيظهر للمستلم في ترويسة الرسائل.
                    </p>
                  </div>

                  {/* Resend Fields */}
                  {mailProvider === 'resend' && (
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            مفتاح Resend API Key:
                          </label>
                          <a 
                            href="https://resend.com/api-keys" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[11px] text-emerald-500 hover:underline inline-flex items-center gap-1"
                          >
                            <span>إنشاء مفتاح من Resend Console</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                        <input 
                          type="password"
                          value={mailResendKey}
                          onChange={e => setMailResendKey(e.target.value)}
                          placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 dir-ltr text-right"
                        />
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300">💡 تعليمات Resend الرسمية:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>للتجربة السريعة، استخدم <code>onboarding@resend.dev</code> في حقل البريد المرسل (From).</li>
                          <li>للإرسال لأي بريد خارجي بدون قيود Sandbox، أضف نطاقك المخصص عبر <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-emerald-500 underline font-bold">Resend Domains</a>.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Brevo Fields */}
                  {mailProvider === 'brevo' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        مفتاح Brevo API Key (v3):
                      </label>
                      <input 
                        type="password"
                        value={mailBrevoKey}
                        onChange={e => setMailBrevoKey(e.target.value)}
                        placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxx"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 dir-ltr text-right"
                      />
                    </div>
                  )}

                  {/* Gmail & SMTP Fields */}
                  {(mailProvider === 'gmail' || mailProvider === 'smtp') && (
                    <>
                      {mailProvider === 'smtp' && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                              مضيف SMTP (Host):
                            </label>
                            <input 
                              type="text"
                              value={mailSmtpHost}
                              onChange={e => setMailSmtpHost(e.target.value)}
                              placeholder="smtp.mailgun.org"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 dir-ltr text-right"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                              المنفذ (Port):
                            </label>
                            <input 
                              type="text"
                              value={mailSmtpPort}
                              onChange={e => setMailSmtpPort(e.target.value)}
                              placeholder="587"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 dir-ltr text-right"
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {mailProvider === 'gmail' ? 'بريد Gmail المركزي:' : 'اسم المستخدم (User):'}
                          </label>
                          <input 
                            type="text"
                            value={mailSmtpUser}
                            onChange={e => setMailSmtpUser(e.target.value)}
                            placeholder="myplatform@gmail.com"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 dir-ltr text-right"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {mailProvider === 'gmail' ? 'كلمة مرور التطبيقات (App Password):' : 'كلمة المرور (Password):'}
                          </label>
                          <input 
                            type="password"
                            value={mailSmtpPass}
                            onChange={e => setMailSmtpPass(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 dir-ltr text-right"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {mailStatusMsg && (
                    <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      mailStatusMsg.isError ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200'
                    }`}>
                      {mailStatusMsg.isError ? <AlertCircle size={15} /> : <Check size={15} />}
                      <span>{mailStatusMsg.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingMail}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingMail ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>حفظ وتطبيق إعدادات الخادم المركزي</span>
                  </button>
                </form>
              </div>

              {/* Test Email Box (1 Column) */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <Send size={18} className="text-indigo-500" />
                    <span>اختبار الإرسال المباشر</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                    أرسل رسالة تجريبية فورية للتحقق من كفاءة التوصيل دون الحاجة لتسجيل مستخدم جديد.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        البريد المستلم للتجربة:
                      </label>
                      <input 
                        type="email"
                        value={testEmailRecipient}
                        onChange={e => setTestEmailRecipient(e.target.value)}
                        placeholder="your-email@example.com"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-indigo-500 dir-ltr text-right"
                      />
                    </div>

                    {testMailResult && (
                      <div className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${
                        testMailResult.isError ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200'
                      }`}>
                        {testMailResult.isError ? <AlertCircle size={15} className="shrink-0 mt-0.5" /> : <Check size={15} className="shrink-0 mt-0.5" />}
                        <span>{testMailResult.text}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleSendTestMail}
                    disabled={isSendingTestMail || !testEmailRecipient.trim()}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSendingTestMail ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>إرسال بريد تجريبي الآن</span>
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {activeTab === 'platforms' && (
          <motion.div
            key="platforms"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
               <ShoppingCart size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">تكامل منصات التجارة الإلكترونية</h2>
              <p className="text-sm text-slate-500">استخدم هذه الروابط لربط متجرك بمنصات مثل ويلت (Wuilt) وغيرها.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 relative bg-slate-50/50 dark:bg-slate-800/20">
             <h3 className="font-bold text-slate-800 dark:text-white text-md mb-2 flex items-center gap-2">
               منصة ويلت (Wuilt)
             </h3>
             <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed max-w-2xl text-right">
               قم بنسخ الرابط التالي وإضافته في إعدادات متجرك على ويلت (قسم Webhooks) لاختيار الأحداث مثل (Order Created) لكي تنزل الطلبات تلقائياً هنا.
             </p>

             <div className="space-y-1.5 font-sans text-right">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1 justify-end"><Webhook size={14} /> رابط Webhook Cloud Function المشفر</label>
                <div className="flex gap-2 items-center font-sans">
                  <input 
                    type="text" 
                    readOnly
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono outline-none text-left"
                    value={`https://cloud-functions.abdomedi.com/webhook?storeId=${activeStoreId || 'YOUR_STORE_ID'}&platform=wuilt`}
                    dir="ltr"
                  />
                  <button 
                    onClick={() => handleCopy(`https://cloud-functions.abdomedi.com/webhook?storeId=${activeStoreId || 'YOUR_STORE_ID'}&platform=wuilt`)} 
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    title="نسخ الرابط"
                  >
                     {copiedLink === `https://cloud-functions.abdomedi.com/webhook?storeId=${activeStoreId || 'YOUR_STORE_ID'}&platform=wuilt` ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}
                  </button>
                </div>
             </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 relative bg-slate-50/50 dark:bg-slate-800/20 opacity-70">
             <h3 className="font-bold text-slate-800 dark:text-white text-md mb-2 flex items-center gap-2 justify-end">
               منصات أخرى قريباً (Salla, Zid, Shopify)
             </h3>
             <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed max-w-2xl text-right">
               سيتم إضافة تكاملات مخصصة لهذه المنصات في المستقبل القريب لضمان أعلى سرعة في المزامنة وأمان لبياناتك.
             </p>
          </div>
        </div>
      </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Alarm / Prompt Sound Alert Modal */}
      <AnimatePresence>
        {alarm && alarm.show && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!alarm.showCancel) setAlarm(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            {/* Alarm Dialog Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden text-right font-sans"
            >
              {/* Sound Ring Pulse Decorator */}
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <div className="flex flex-col items-center text-center mt-3">
                {/* Visual Icon based on Alarm TYPE */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg ${
                  alarm.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                  alarm.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' :
                  alarm.type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 font-bold' :
                  'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                }`}>
                  {alarm.type === 'success' && <CheckCircle2 size={32} />}
                  {alarm.type === 'error' && <ShieldAlert size={32} />}
                  {alarm.type === 'warning' && <AlertCircle size={32} />}
                  {alarm.type === 'info' && <Database size={32} />}
                </div>

                {/* Alarm Ringing Animation Indicator */}
                <div className="flex items-center gap-1.5 mb-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-wider animate-bounce">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                  <span>تنبيه داخلي نشط 🔔</span>
                </div>

                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1 leading-tight">
                  {alarm.title}
                </h3>
                
                <p className="text-sm text-slate-600 dark:text-slate-450 mt-3 leading-relaxed whitespace-pre-line text-center px-2">
                  {alarm.message}
                </p>
              </div>

              {/* Confirm / Cancel Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    const onConf = alarm.onConfirm;
                    setAlarm(null);
                    if (onConf) onConf();
                  }}
                  className={`flex-1 px-5 py-3 rounded-2xl text-xs font-black text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md cursor-pointer ${
                    alarm.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' :
                    alarm.type === 'error' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10' :
                    alarm.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10' :
                    'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10'
                  }`}
                >
                  {alarm.confirmText}
                </button>
                
                {alarm.showCancel && (
                  <button
                    onClick={() => setAlarm(null)}
                    className="flex-1 px-5 py-3 rounded-2xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    {alarm.cancelText}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeveloperSettingsPage;
