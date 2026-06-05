import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, WebhookIntegration, Store } from '../types';
import { Code, Webhook, Key, Trash, Plus, Save, Server, Shield, ShoppingCart, Copy, CheckCircle2, Database, RefreshCw, AlertCircle, Check, ExternalLink, ShieldAlert, History, Sparkles, Wifi, WifiOff, Layers, Cloud, CloudUpload, Download } from 'lucide-react';
import { getSupabaseRestrictedStatus, setSupabaseRestricted, isSupabaseActive } from '../services/databaseService';

const SupabaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#3ECF8E]">
    <path d="M13.35 21.05C12.45 21.95 11 21.31 11 20.04V15H5.43C4.08 15 3.4 13.37 4.35 12.42L10.65 6.12C11.55 5.22 13 5.86 13 7.13V12.17H18.57C19.92 12.17 20.6 13.8 19.65 14.75L13.35 21.05Z" fill="currentColor"/>
  </svg>
);

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
    status TEXT DEFAULT 'completed',
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
-- ⚡ تأمين وجود جميع الأعمدة اللازمة (SQL Patches) لضمان توافق جميع إصدارات البيانات
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fees NUMERIC DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS service TEXT;

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS timestamp NUMERIC;

-- تأمين أعمدة الربط لجميع الجداول
ALTER TABLE products ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS supplier_id TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "partnerPayments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "shippingFees" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "otherFees" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "taxRate" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "taxAmount" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "grandTotal" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "treasuryAccountId" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "totalCost" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "totalPaid" NUMERIC DEFAULT 0;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE custom_pages ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE custom_pages ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE global_options ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE global_options ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE shipping_integrations ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE shipping_integrations ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS store_id TEXT;

-- تأمين أعمدة البيانات الإضافية
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "costPrice" NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "inStock" BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockQuantity" NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "warehouseStock" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "collectionId" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "hasVariants" BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "profitMode" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "basePrice" NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "commissionPercentage" NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockThreshold" NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "profitPercentage" NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "useProfitPercentage" BOOLEAN DEFAULT false;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "waybillNumber" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "platformOrderId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingCompany" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingArea" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerPhone2" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS governorate TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingFee" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "adminFee" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "productName" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "productPrice" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "productCost" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "totalPrice" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "insuranceFee" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "inspectionFee" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS weight NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "totalAmountOverride" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "totalAmountOverrideReason" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "includeInspectionFee" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "isInsured" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "inspectionFeeDeducted" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "inspectionFeePaidByCustomer" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingAndInsuranceDeducted" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "returnFeeDeducted" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "collectionProcessed" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "preparationStatus" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS classification TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "redeemedPoints" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "pointsDiscount" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "loyaltyPointsAwarded" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "stockDeducted" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "orderType" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shipmentType" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "originalOrderId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "confirmationLogs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "followUpReminder" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "auditLogs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "callAttempts" JSONB DEFAULT '[]'::jsonb;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS "totalSpent" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "loyaltyPoints" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "totalOrders" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "successfulOrders" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "returnedOrders" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "lastOrderDate" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "firstOrderDate" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "averageOrderValue" NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS governorate TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "shippingFee" NUMERIC;

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action TEXT;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "senderId" TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "receiverId" TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "isFile" BOOLEAN DEFAULT false;

-- تأمين جداول الخزينة (Treasury)
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS "accountNumber" TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS "beneficiaryName" TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS "walletNumber" TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS "walletName" TEXT;

ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS "fromAccountId" TEXT;
ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS "toAccountId" TEXT;

-- تأمين جداول الشركاء (Partners)
ALTER TABLE partners ADD COLUMN IF NOT EXISTS "profitRatio" NUMERIC;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "partnerId" TEXT;

-- إعادة تفعيل الصلاحيات (RLS Disable is enough)
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;`;


interface DeveloperSettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStoreId?: string | null;
  activeStore?: Store;
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
  activeStore,
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
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      if (type === 'success') {
        const osc1 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc1.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc1.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.45);
      } else if (type === 'error') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        // A low buzzing warning horn sound (pulsing)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.setValueAtTime(150, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'warning') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(349.23, now + 0.12); // F4
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
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

  const handleSaveDatabaseCredentials = async () => {
    if (customCloudUrl.trim() && !customCloudUrl.startsWith('http')) {
      triggerAlarm("يرجى إدخال رابط Cloud URL صحيح يبدأ بـ http:// أو https://", 'warning', 'رابط غير صالح');
      return;
    }

    if (customCloudUrl.trim() && customCloudAnonKey.trim()) {
      setIsVerifying(true);
      try {
        const { verifySupabaseConnection } = await import('../services/databaseService');
        const verification = await verifySupabaseConnection(customCloudUrl.trim(), customCloudAnonKey.trim());
        
        if (!verification.success) {
          triggerAlarm(
            `⚠️ فشل التحقق من الاتصال بقاعدة البيانات: ${verification.error}\n\nهل تريد حفظ الإعدادات على أي حال والاستمرار؟`,
            'warning',
            'فشل الاتصال',
            {
              showCancel: true,
              confirmText: 'حفظ على أي حال',
              cancelText: 'إلغاء',
              onConfirm: () => {
                localStorage.setItem('custom_cloud_url', customCloudUrl.trim());
                localStorage.setItem('custom_cloud_anon_key', customCloudAnonKey.trim());
                setSupabaseRestricted(false);
                setIsRestricted(false);
                triggerAlarm("✅ تم حفظ إعدادات قاعدة البيانات! سيتم إعادة تحميل الصفحة الآن للتطبيق.", 'success', 'تم الحفظ', {
                  onConfirm: () => { window.location.reload(); }
                });
              }
            }
          );
          return;
        }

        localStorage.setItem('custom_cloud_url', customCloudUrl.trim());
        localStorage.setItem('custom_cloud_anon_key', customCloudAnonKey.trim());
        
        // Since they supplied a new fresh DB, let's auto-reactivate cloud connection
        setSupabaseRestricted(false);
        setIsRestricted(false);
        triggerAlarm("✅ تم التحقق وحفظ إعدادات قاعدة البيانات المخصصة بنجاح! سيتم إعادة تحميل التطبيق للاتصال بالخادم المخصص.", 'success', 'ربط ناجح', {
          onConfirm: () => { window.location.reload(); }
        });
      } catch (e: any) {
        triggerAlarm("خطأ أثناء التحقق: " + e.message, 'error', 'خطأ التحقق');
      } finally {
        setIsVerifying(false);
      }
    } else if (!customCloudUrl.trim() && !customCloudAnonKey.trim()) {
      handleRestoreDefaultDatabase();
    } else {
      triggerAlarm("يرجى ملء كلا الحقلين (الرابط ومفتاح Api Key) أو تركهما فارغين لاستعادة الافتراضي.", 'warning', 'حقول ناقصة');
    }
  };

  const handleRestoreDefaultDatabase = () => {
    localStorage.removeItem('custom_cloud_url');
    localStorage.removeItem('custom_cloud_anon_key');
    setSupabaseRestricted(false);
    setIsRestricted(false);
    setCustomCloudUrl('');
    setCustomCloudAnonKey('');
    triggerAlarm("تمت استعادة قاعدة البيانات السحابية الافتراضية بنجاح! سيتم إعادة تحميل الصفحة لتطبيق التغييرات.", 'success', 'استعادة الافتراضي', {
      onConfirm: () => { window.location.reload(); }
    });
  };

  const handleReactivateCloudSync = () => {
    setSupabaseRestricted(false);
    setIsRestricted(false);
    triggerAlarm("تم تنشيط الاتصال السحابي وإلغاء وضع الطوارئ المحلي. سيقوم النظام الآن بمحاولة المزامنة مع خوادم قاعدة البيانات.", 'success', 'تنشيط الاتصال', {
      onConfirm: () => { window.location.reload(); }
    });
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
              ) : isSupabaseActive() ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-xs font-bold rounded-xl border border-green-200/50 dark:border-green-900/30">
                  <Check size={14} />
                  <span>قاعدة البيانات المخصصة (Supabase) متصلة ونشطة</span>
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
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 justify-start">
                <SupabaseIcon />
                <span>رابط Supabase URL / Cloud Endpoint المخصص</span>
              </label>
              <input 
                type="text" 
                placeholder="https://xyz.supabase.co"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary/50 outline-none transition-all dark:text-white text-left"
                value={customCloudUrl}
                onChange={(e) => setCustomCloudUrl(e.target.value)}
                dir="ltr"
              />
            </div>
            
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 justify-start">
                <Key size={14} className="text-emerald-500" />
                <span>مفتاح Supabase Anon Key / API Key الخاص بالربط</span>
              </label>
              <input 
                type="text" 
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
                disabled={isVerifying}
                className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {isVerifying ? "جاري التحقق..." : "حفظ وتشغيل الاتصال السحابي المخصص"}
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

          {isSupabaseActive() && (
            <div className="w-full mt-4 p-5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-3xl border border-indigo-200/50 dark:border-indigo-900/30">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-right">
                <div className="flex-1">
                  <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                    <Sparkles size={16} />
                    نقل البيانات الحالية إلى قاعدتك الجديدة (Migration)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    بما أنك قمت للتو بربط Supabase، فإن الجداول هناك ستكون فارغة. 
                    اضغط على الزر أدناه لرفع كافة طلباتك ومنتجاتك الحالية من هذا الجهاز إلى السحابة فوراً لتظهر في جميع أجهزتك.
                  </p>
                </div>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    const btn = e.currentTarget as HTMLButtonElement;
                    
                    triggerAlarm(
                      "⚠️ هل أنت متأكد؟ سيتم رفع كافة البيانات المحلية من هذا الجهاز واستبدال ما هو موجود على قاعدة البيانات السحابية (Supabase) بها بالكامل.",
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
                            const { getLocal, saveStoreData } = await import('../services/databaseService');
                            const storeId = activeStoreId || localStorage.getItem('lastActiveStoreId');
                            const store = activeStore;
                            
                            if (!storeId || !store) throw new Error("لم يتم اختيار متجر");
                            
                            const localData = await getLocal(storeId);
                            if (!localData) throw new Error("لا توجد بيانات محلية للرفع");
                            
                            const res = await saveStoreData(store, localData);
                            
                            if (res.success) {
                              triggerAlarm("✅ تمت المزامنة والرفع بنجاح! جداول قاعدة البيانات السحابية أصبحت تحتوي على بياناتك الآن.", 'success', 'مزامنة ناجحة');
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
