import React, { useState } from 'react';
import { Settings, WebhookIntegration } from '../types';
import { Code, Webhook, Key, Trash, Plus, Save, Server, Shield, ShoppingCart, Copy, CheckCircle2, Database, RefreshCw, AlertCircle, Check, ExternalLink, ShieldAlert, History, Sparkles, Wifi, WifiOff, Layers, Cloud } from 'lucide-react';
import { getSupabaseRestrictedStatus, setSupabaseRestricted } from '../services/databaseService';

const SQL_SCHEMA_SCRIPT = `-- 1. STORES_DATA (قاعدة بيانات المتاجر)
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
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;`;

interface DeveloperSettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStoreId?: string | null;
  hostUrl?: string;
  dbSyncMode?: 'auto' | 'manual';
  setDbSyncMode?: (mode: 'auto' | 'manual') => void;
  forcePullFromCloud?: () => Promise<{ success: boolean; error?: string }>;
  forceSync?: () => Promise<void>;
  saveStatus?: string;
  saveMessage?: string;
}

const DeveloperSettingsPage: React.FC<DeveloperSettingsPageProps> = ({ 
  settings, 
  setSettings, 
  activeStoreId, 
  hostUrl,
  dbSyncMode = 'auto',
  setDbSyncMode,
  forcePullFromCloud,
  forceSync,
  saveStatus,
  saveMessage
}) => {
  const [integrations, setIntegrations] = useState<WebhookIntegration[]>(settings.webhookIntegrations || []);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  
  // Custom Database Credentials States
  const [customCloudUrl, setCustomCloudUrl] = useState(localStorage.getItem('custom_cloud_url') || '');
  const [customCloudAnonKey, setCustomCloudAnonKey] = useState(localStorage.getItem('custom_cloud_anon_key') || '');
  const [isRestricted, setIsRestricted] = useState(getSupabaseRestrictedStatus());
  const [showSqlSchema, setShowSqlSchema] = useState(false);

  // Sync Conflict Strategy State
  const [syncConflictStrategy, setSyncConflictStrategy] = useState(
    localStorage.getItem('syncConflictStrategy') || 'last_write_wins'
  );
  
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isPullingRemote, setIsPullingRemote] = useState(false);

  const handleSaveConflictStrategy = (strategy: string) => {
    localStorage.setItem('syncConflictStrategy', strategy);
    setSyncConflictStrategy(strategy);
    alert("🚀 تم تعديل سياسة حل التعارض وتأمين المزامنة تلقائياً للفروع والديسك توب!");
  };

  const triggerManualSync = async () => {
    if (!forceSync) return;
    setIsManualSyncing(true);
    try {
      await forceSync();
    } catch (e) {
      console.error(e);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const triggerCloudPull = async () => {
    if (!forcePullFromCloud) return;
    if (!window.confirm("⚠️ هل أنت متأكد من رغبتك في سحب البيانات من السحابة؟ هذا قد يستبدل أي بيانات محلية لم يتم رفعها بعد.")) return;
    setIsPullingRemote(true);
    try {
      await forcePullFromCloud();
    } catch (e) {
      console.error(e);
    } finally {
      setIsPullingRemote(false);
    }
  };

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedLink(text);
      setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleSaveDatabaseCredentials = () => {
    if (customCloudUrl.trim() && !customCloudUrl.startsWith('http')) {
      alert("يرجى إدخال رابط Cloud URL صحيح يبدأ بـ http:// أو https://");
      return;
    }

    if (customCloudUrl.trim() && customCloudAnonKey.trim()) {
      localStorage.setItem('custom_cloud_url', customCloudUrl.trim());
      localStorage.setItem('custom_cloud_anon_key', customCloudAnonKey.trim());
      
      // Since they supplied a new fresh DB, let's auto-reactivate cloud connection
      setSupabaseRestricted(false);
      setIsRestricted(false);
      alert("تم حفظ إعدادات قاعدة البيانات المخصصة بنجاح! سيتم إعادة تحميل التطبيق تلقائياً للاتصال بقاعدة بياناتك الجديدة.");
      window.location.reload();
    } else if (!customCloudUrl.trim() && !customCloudAnonKey.trim()) {
      handleRestoreDefaultDatabase();
    } else {
      alert("يرجى ملء كلا الحقلين (الرابط ومفتاح Api Key) أو تركهما فارغين لاستعادة الافتراضي.");
    }
  };

  const handleRestoreDefaultDatabase = () => {
    localStorage.removeItem('custom_cloud_url');
    localStorage.removeItem('custom_cloud_anon_key');
    setSupabaseRestricted(false);
    setIsRestricted(false);
    setCustomCloudUrl('');
    setCustomCloudAnonKey('');
    alert("تمت استعادة قاعدة البيانات السحابية الافتراضية بنجاح! سيتم إعادة تحميل الصفحة لتطبيق التغييرات.");
    window.location.reload();
  };

  const handleReactivateCloudSync = () => {
    setSupabaseRestricted(false);
    setIsRestricted(false);
    alert("تم تنشيط الاتصال السحابي وإلغاء وضع الطوارئ المحلي. سيقوم النظام الآن بمحاولة المزامنة مع خوادم قاعدة البيانات.");
    window.location.reload();
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
    alert("تم حفظ الإعدادات بنجاح");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4">
      <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2 ml-2">أدوات المطورين </h1>
            <p className="text-slate-500 dark:text-slate-400">إدارة التكاملات وربط المتاجر الأخرى عبر Webhooks.</p>
          </div>
          <button 
            onClick={saveSettings}
            className="btn btn-primary shadow-lg shadow-primary/30 flex items-center gap-2"
          >
            <Save size={18} />
             حفظ
          </button>
      </div>

      <div id="custom-database-settings" className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
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
            
            <div className="flex items-center gap-2">
              {isRestricted ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-xl border border-amber-200/50 dark:border-amber-900/40 animate-pulse">
                  <AlertCircle size={14} />
                  <span>وضع الطوارئ (تخزين محلي فقط)</span>
                </span>
              ) : localStorage.getItem('custom_cloud_url') ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-xs font-bold rounded-xl border border-green-200/50 dark:border-green-900/30">
                  <Check size={14} />
                  <span>ربط مخصص متصل</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-200/50 dark:border-blue-900/30">
                  <Check size={14} />
                  <span>قاعدة البيانات الافتراضية (Firebase) متصلة</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 text-right">
          <div className="bg-blue-50/50 dark:bg-blue-950/25 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
            <h3 className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2 justify-start">
              <Shield size={16} /> <span>دليل هيكلية البيانات والمزامنة الشاملة 🌐</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300">
                يعتمد النظام على هندسة برمجية متطورة تضمن توافق البيانات بين الأجهزة المختلفة محلياً وسحابياً. يمكنك استخدام كود الـ SQL بالأسفل لإعادة بناء هيكل البيانات إذا كنت ترغب في تصدير مشروعك لمنظومة خارجية أو لإجراء عمليات فحص تقنية متقدمة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 justify-start">رابط Cloud Endpoint / URL المخصص</label>
              <input 
                type="text" 
                placeholder="https://your-custom-endpoint.com"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white text-left"
                value={customCloudUrl}
                onChange={(e) => setCustomCloudUrl(e.target.value)}
                dir="ltr"
              />
            </div>
            
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 justify-start">مفتاح API Key الخاص بالربط</label>
              <input 
                type="text" 
                placeholder="PRO-KEY-..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white text-left"
                value={customCloudAnonKey}
                onChange={(e) => setCustomCloudAnonKey(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-2.5">
              <button 
                onClick={handleSaveDatabaseCredentials}
                className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition flex items-center gap-2"
              >
                <Save size={16} />
                حفظ وتشغيل الاتصال السحابي الخاص
              </button>

              {(localStorage.getItem('custom_cloud_url') || localStorage.getItem('custom_cloud_anon_key')) && (
                <button 
                  onClick={handleRestoreDefaultDatabase}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  استعادة الافتراضي
                </button>
              )}
            </div>

            {isRestricted && (
              <button 
                onClick={handleReactivateCloudSync}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 animate-pulse"
              >
                <RefreshCw size={16} className="animate-spin" />
                إلغاء وضع الطوارئ والاتصال فوراً
              </button>
            )}
          </div>

          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden text-right">
            <button 
              type="button"
              onClick={() => setShowSqlSchema(!showSqlSchema)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/30 text-right font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
            >
              <div className="flex items-center gap-2">
                <Code size={16} className="text-indigo-500" />
                <span>إظهار كود SQL لإنشاء وتجهيز جميع الجداول والأعمدة تلقائياً (نسخ سريع) ⚡</span>
              </div>
              <span className="text-xs text-slate-400">{showSqlSchema ? 'إخفاء' : 'عرض كود المزامنة'}</span>
            </button>

            {showSqlSchema && (
              <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-hidden relative">
                <div className="absolute top-3 left-3 z-10">
                  <button 
                    onClick={() => handleCopy(SQL_SCHEMA_SCRIPT)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition active:scale-95"
                  >
                    {copiedLink === SQL_SCHEMA_SCRIPT ? (
                      <>
                        <Check size={14} className="text-green-400" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>نسخ الكود بالكامل</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-72 overflow-y-auto pt-8 text-left dir-ltr" style={{ direction: 'ltr' }}>
                  {SQL_SCHEMA_SCRIPT}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
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

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 justify-start mb-4">
              <History size={16} className="text-indigo-500" />
              <span>التحكم اليدوي ومؤشرات الأمان الفورية ⚙️</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
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

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
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

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
               <Webhook size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">إعدادات الـ Webhook</h2>
              <p className="text-sm text-slate-500">إرسال واستقبال الطلبات من وإلى المتاجر الأخرى.</p>
            </div>
          </div>
          <button 
            onClick={addIntegration}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2"
           >
             <Plus size={16} /> اضافة رابط جديد
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {integrations.length === 0 ? (
            <div className="text-center py-10">
               <Webhook className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
               <h3 className="text-sm font-medium text-slate-900 dark:text-white">لا توجد روابط Webhooks مضافة</h3>
               <p className="mt-1 text-sm text-slate-500">قم بإضافة رابط جديد للربط مع متجر آخر.</p>
            </div>
          ) : (
             integrations.map((integration, index) => (
                <div key={integration.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 relative bg-slate-50/50 dark:bg-slate-800/20">
                   <div className="absolute top-4 left-4 flex gap-2">
                     <span className="flex items-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={integration.isActive} onChange={(e) => updateIntegration(integration.id, 'isActive', e.target.checked)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                        </label>
                     </span>
                     <button onClick={() => removeIntegration(integration.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded-lg transition-colors">
                        <Trash size={16} />
                     </button>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Server size={14} /> رابط المتجر الآخر (إختياري للاستدلال)</label>
                         <input 
                           type="text" 
                           placeholder="https://other-store.com"
                           className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white text-right"
                           value={integration.storeUrl}
                           onChange={(e) => updateIntegration(integration.id, 'storeUrl', e.target.value)}
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Webhook size={14} /> رابط الـ Webhook (لاستقبال الطلب)</label>
                         <input 
                           type="text" 
                           placeholder="https://.../api/webhook/orders"
                           className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white text-right"
                           value={integration.webhookUrl}
                           onChange={(e) => updateIntegration(integration.id, 'webhookUrl', e.target.value)}
                         />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                         <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Shield size={14} /> رمز الأمان (Secret Key)</label>
                         <div className="relative">
                           <input 
                             type="text" 
                             readOnly
                             className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono outline-none text-right"
                             value={integration.secretKey}
                           />
                         </div>
                      </div>
                   </div>
                </div>
             ))
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
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
             <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed max-w-2xl">
               قم بنسخ الرابط التالي وإضافته في إعدادات متجرك على ويلت (قسم Webhooks) لاختيار الأحداث مثل (Order Created) لكي تنزل الطلبات تلقائياً هنا.
             </p>

             <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Webhook size={14} /> رابط Webhook Cloud Function المشفر</label>
                <div className="flex gap-2 items-center">
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
             <h3 className="font-bold text-slate-800 dark:text-white text-md mb-2 flex items-center gap-2">
               منصات أخرى قريباً (Salla, Zid, Shopify)
             </h3>
             <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed max-w-2xl text-right">
               سيتم إضافة تكاملات مخصصة لهذه المنصات في المستقبل القريب لضمان أعلى سرعة في المزامنة وأمان لبياناتك.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperSettingsPage;
