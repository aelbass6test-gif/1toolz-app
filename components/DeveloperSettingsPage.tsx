import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { audioSynth } from '../utils/audioSynth';
import { Settings, WebhookIntegration, Store } from '../types';
import { Code, Webhook, Key, Trash, Plus, Save, Server, Shield, ShoppingCart, Copy, CheckCircle2, Database, RefreshCw, AlertCircle, Check, ExternalLink, ShieldAlert, History, Sparkles, Wifi, WifiOff, Layers, Cloud, CloudUpload, Download, Eye, Activity, Search, Wrench, CheckSquare, Square } from 'lucide-react';
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
    min_stock_level NUMERIC DEFAULT 0,
    minStockLevel NUMERIC DEFAULT 0,
    last_audited JSONB DEFAULT '{}'::jsonb,
    lastAudited JSONB DEFAULT '{}'::jsonb,
    details JSONB DEFAULT '{}'::jsonb,
    expiry_date TEXT,
    expiryDate TEXT
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
    customerPhone TEXT,
    customer_phone TEXT,
    shippingCompany TEXT,
    shipping_company TEXT,
    status TEXT NOT NULL,
    date TEXT NOT NULL,
    total_price NUMERIC NOT NULL,
    totalPrice NUMERIC,
    shippingFee NUMERIC,
    shipping_fee NUMERIC,
    flexShipFee NUMERIC,
    flexShipCompanyFee NUMERIC,
    enableFlexShip BOOLEAN,
    flexShipFeePaidByCustomer BOOLEAN,
    channel TEXT DEFAULT 'online',
    warehouse_id TEXT,
    warehouseId TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    "advancePayment" NUMERIC DEFAULT 0,
    "advancePaymentPartnerId" TEXT,
    "advancePaymentTreasuryId" TEXT,
    "advancePaymentEmployeeId" TEXT,
    "advancePaymentRecipientPhone" TEXT,
    "advancePaymentSenderDetails" TEXT
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
    details JSONB DEFAULT '{}'::jsonb,
    "distributeExpensesEqually" BOOLEAN DEFAULT false,
    "recordExpensesFormally" BOOLEAN DEFAULT false,
    "shippingFeesNote" TEXT,
    "otherFeesNote" TEXT,
    "expensePaidBy" TEXT
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
    "user" TEXT,
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
    name TEXT,
    email TEXT,
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
    notes TEXT,
    debtBalance NUMERIC DEFAULT 0,
    debtHistory JSONB DEFAULT '[]'::jsonb
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
    treasury_account_id TEXT,
    treasuryAccountId TEXT,
    type TEXT NOT NULL, -- loan, capital_addition, profit_withdrawal, repayment, etc.
    amount NUMERIC NOT NULL,
    date TEXT NOT NULL,
    note TEXT
);

-- Ensure columns exist for partner_transactions
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS treasury_account_id TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS treasuryAccountId TEXT;

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

-- 25. WAREHOUSES (المخازن والمستودعات)
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    name TEXT NOT NULL,
    location TEXT,
    is_default BOOLEAN DEFAULT false,
    isDefault BOOLEAN DEFAULT false
);

-- 26. INVENTORY_AUDITS (جلسات جرد المخزون)
CREATE TABLE IF NOT EXISTS inventory_audits (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    performed_by TEXT,
    performedBy TEXT,
    scope TEXT,
    warehouse_id TEXT,
    warehouseId TEXT,
    total_system_qty NUMERIC DEFAULT 0,
    totalSystemQty NUMERIC DEFAULT 0,
    total_actual_qty NUMERIC DEFAULT 0,
    totalActualQty NUMERIC DEFAULT 0,
    total_variance_qty NUMERIC DEFAULT 0,
    totalVarianceQty NUMERIC DEFAULT 0,
    total_variance_value NUMERIC DEFAULT 0,
    totalVarianceValue NUMERIC DEFAULT 0,
    discrepancies JSONB DEFAULT '[]'::jsonb,
    notes TEXT
);

-- 27. STOCK_TRANSFERS (تحويلات المخزون بين المستودعات)
CREATE TABLE IF NOT EXISTS stock_transfers (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    transfer_number TEXT NOT NULL,
    transferNumber TEXT,
    date TEXT NOT NULL,
    source_warehouse_id TEXT,
    sourceWarehouseId TEXT,
    destination_warehouse_id TEXT,
    destinationWarehouseId TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL,
    notes TEXT,
    performed_by TEXT,
    performedBy TEXT
);

-- 28. ORDER_RETURNS (مرتجعات طلبات البيع)
CREATE TABLE IF NOT EXISTS order_returns (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    return_number TEXT NOT NULL,
    returnNumber TEXT,
    order_id TEXT,
    orderId TEXT,
    order_number TEXT,
    orderNumber TEXT,
    date TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    total_refund NUMERIC DEFAULT 0,
    totalRefund NUMERIC DEFAULT 0,
    reason TEXT,
    warehouse_id TEXT,
    warehouseId TEXT,
    restock_items BOOLEAN DEFAULT true,
    restockItems BOOLEAN DEFAULT true,
    status TEXT NOT NULL,
    performed_by TEXT,
    performedBy TEXT,
    notes TEXT
);

-- 29. PURCHASE_RETURNS (مرتجعات طلبات الشراء من الموردين)
CREATE TABLE IF NOT EXISTS purchase_returns (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    return_number TEXT NOT NULL,
    returnNumber TEXT,
    supplier_id TEXT,
    supplierId TEXT,
    supplier_name TEXT,
    supplierName TEXT,
    date TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    total_refund_amount NUMERIC DEFAULT 0,
    totalRefundAmount NUMERIC DEFAULT 0,
    warehouse_id TEXT,
    warehouseId TEXT,
    status TEXT NOT NULL,
    notes TEXT,
    performed_by TEXT,
    performedBy TEXT
);

-- 30. POS_SALES (مبيعات الكاشير ونقاط البيع)
CREATE TABLE IF NOT EXISTS pos_sales (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    sale_number TEXT NOT NULL,
    saleNumber TEXT,
    date TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    totalAmount NUMERIC DEFAULT 0,
    payment_method TEXT,
    paymentMethod TEXT,
    warehouse_id TEXT,
    warehouseId TEXT,
    customer_phone TEXT,
    customerPhone TEXT,
    customer_name TEXT,
    customerName TEXT,
    customer_address TEXT,
    customerAddress TEXT,
    performed_by TEXT,
    performedBy TEXT,
    cash_holder_id TEXT,
    cashHolderId TEXT,
    cash_holder_name TEXT,
    cashHolderName TEXT,
    notes TEXT
);

-- 31. CASH_HOLDERS (عهد الكاشير والمناديب)
CREATE TABLE IF NOT EXISTS cash_holders (
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    user_id TEXT NOT NULL,
    userId TEXT,
    user_name TEXT,
    userName TEXT,
    current_balance NUMERIC DEFAULT 0,
    currentBalance NUMERIC DEFAULT 0,
    last_updated TEXT,
    lastUpdated TEXT,
    PRIMARY KEY (store_id, user_id)
);

-- 32. CASH_HANDOVERS (تسليمات العهد النقدية)
CREATE TABLE IF NOT EXISTS cash_handovers (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    from_user_id TEXT,
    fromUserId TEXT,
    from_user_name TEXT,
    fromUserName TEXT,
    to_user_id TEXT,
    toUserId TEXT,
    to_user_name TEXT,
    toUserName TEXT,
    amount NUMERIC NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL
);

-- 33. WHATSAPP_TEMPLATES (قوالب رسائل الواتساب)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    label TEXT NOT NULL,
    text TEXT NOT NULL
);

-- 34. CALL_SCRIPTS (قوالب سيناريو المكالمات)
CREATE TABLE IF NOT EXISTS call_scripts (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    storeId TEXT,
    title TEXT NOT NULL,
    text TEXT NOT NULL
);

-- 35. CUSTOMER_TRANSACTIONS (سجل حركات مديونيات العملاء)
CREATE TABLE IF NOT EXISTS customer_transactions (
    id TEXT PRIMARY KEY,
    customerId TEXT,
    date TEXT,
    amount NUMERIC,
    type TEXT, -- debt, payment, refund
    note TEXT,
    orderId TEXT,
    storeId TEXT
);

-- 36. SUPPLIER_TRANSACTIONS (سجل حركات مديونيات الموردين)
CREATE TABLE IF NOT EXISTS supplier_transactions (
    id TEXT PRIMARY KEY,
    supplierId TEXT,
    date TEXT,
    amount NUMERIC,
    type TEXT, -- credit, payment, refund
    note TEXT,
    orderId TEXT,
    storeId TEXT
);

-- 37. WITHDRAWAL_REQUESTS (سجل طلبات سحب الرصيد)
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    storeId TEXT,
    amount NUMERIC NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, completed, cancelled
    method TEXT, -- bank, wallet, instapay, treasury
    details TEXT,
    fee NUMERIC DEFAULT 0,
    netAmount NUMERIC,
    isSameDay BOOLEAN DEFAULT false
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
ALTER TABLE warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audits DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_returns DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_returns DISABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_holders DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_handovers DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_scripts DISABLE ROW LEVEL SECURITY;

-- ⚡ تأمين وجود جميع الأعمدة اللازمة (SQL Patches) لضمان توافق جميع إصدارات البيانات
ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStockLevel" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_level NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockQuantity" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "lastAudited" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_audited JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "expiryDate" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "warehouseStock" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "profitMode" TEXT DEFAULT 'manual';
ALTER TABLE products ADD COLUMN IF NOT EXISTS "basePrice" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "profitPercentage" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "commissionPercentage" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockThreshold" NUMERIC DEFAULT 0;

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
ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStockLevel" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_level NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockQuantity" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "lastAudited" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_audited JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "expiryDate" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "warehouseStock" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "profitMode" TEXT DEFAULT 'manual';
ALTER TABLE products ADD COLUMN IF NOT EXISTS "basePrice" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "profitPercentage" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "commissionPercentage" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockThreshold" NUMERIC DEFAULT 0;

-- تأمين أعمدة الموظفين
ALTER TABLE employees ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "storeId" TEXT;
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
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "shippingFeesNote" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "otherFeesNote" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "expensePaidBy" TEXT;

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
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "treasuryAccountId" TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS treasury_account_id TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS store_id TEXT;

-- تأمين أعمدة العربون والديون
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentPartnerId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentTreasuryId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentEmployeeId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentRecipientPhone" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentSenderDetails" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "vatOnStandardShipping" BOOLEAN DEFAULT false;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS "debtBalance" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "debtHistory" JSONB DEFAULT '[]'::jsonb;

ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "fromUserId" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "fromUserName" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "toUserId" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "toUserName" TEXT;

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
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "expiryDate" TEXT;

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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'online';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_id TEXT;

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

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "user" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action TEXT;

ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "cashHolderId" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "cashHolderName" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS cash_holder_id TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS cash_holder_name TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "performedBy" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS performed_by TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS warehouse_id TEXT;

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
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "treasuryAccountId" TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS treasury_account_id TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "distributeExpensesEqually" BOOLEAN DEFAULT false;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "recordExpensesFormally" BOOLEAN DEFAULT false;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "shippingFeesNote" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "otherFeesNote" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "expensePaidBy" TEXT;

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
  allStoresData: any;
  setAllStoresData: (updater: any) => void;
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
  saveMessage,
  allStoresData,
  setAllStoresData
}) => {
  const [integrations, setIntegrations] = useState<WebhookIntegration[]>(settings.webhookIntegrations || []);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');
  const [syncPreview, setSyncPreview] = useState<{
    customers: any[];
    treasury: any[];
    wallet: any[];
    storeId: string;
  } | null>(null);

  const handleFixFlexShipSchema = () => {
    handleFixDBSchema();
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

  const handleFixDBSchema = () => {
    const instructions = `
-- انسخ هذا الكود والصقه في SQL Editor في Supabase
-- لإصلاح وإضافة جميع الأعمدة المفقودة في جميع الجداول لضمان عدم ضياع أو اختفاء أي بيانات

-- 1. جدول الطلبات (orders) - إضافة جميع الأعمدة المفقودة وحل مشكلة اختفاء المنتجات والبيانات
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "items" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentPartnerId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentTreasuryId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentEmployeeId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentRecipientPhone" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentSenderDetails" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "vatOnStandardShipping" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customer_phone" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerPhone2" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingCompany" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shipping_company" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingFee" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shipping_fee" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "flexShipFee" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "flexShipCompanyFee" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "enableFlexShip" BOOLEAN;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "flexShipFeePaidByCustomer" BOOLEAN;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT 'online';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "warehouse_id" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "governorate" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingArea" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "discount" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "isInsured" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "includeInspectionFee" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "inspectionFeePaidByCustomer" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "recordedAsDebt" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "deferPaymentToReturn" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "returnCashToCustomer" BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "cashToReturnAmount" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "creditAmount" NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "totalAmountOverride" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "totalAmountOverrideReason" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "orderType" TEXT DEFAULT 'standard';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shipmentType" TEXT DEFAULT 'delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "maintenanceCost" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "maintenanceItemDescription" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "maintenanceItemSerial" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "maintenanceItemValue" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "maintenanceTechnicalReport" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "maintenanceStatus" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "originalOrderId" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "exchangeDifference" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "returnProductValue" NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "returnTrackingNumber" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- 2. جدول المنتجات (products)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "min_stock_level" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStockLevel" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stock_quantity" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockQuantity" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "last_audited" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "lastAudited" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "expiry_date" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "expiryDate" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "warehouseStock" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "profitMode" TEXT DEFAULT 'manual';
ALTER TABLE products ADD COLUMN IF NOT EXISTS "basePrice" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "profitPercentage" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "commissionPercentage" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stockThreshold" NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- 3. جدول المستخدمين (users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "full_name" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "is_banned" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "join_date" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "joinDate" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "stores" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "sites" JSONB DEFAULT '[]'::jsonb;

-- 4. جدول الموظفين (employees)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "permissions" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "status" TEXT;

-- 5. جدول أوامر الإمداد (supply_orders)
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "distributeExpensesEqually" BOOLEAN DEFAULT false;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "recordExpensesFormally" BOOLEAN DEFAULT false;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "shippingFeesNote" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "otherFeesNote" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "expensePaidBy" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "supplier_id" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "total_cost" NUMERIC;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "totalCost" NUMERIC;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "date" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "items" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- 6. جدول العملاء (customers)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "debtBalance" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "debtHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "balance" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "loyalty_points" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "loyaltyPoints" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "total_spent" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "totalSpent" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "first_order_date" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "firstOrderDate" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "last_order_date" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "lastOrderDate" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- 6.1 جدول الموردين (suppliers)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "balance" NUMERIC DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "creditLimit" NUMERIC DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "taxNumber" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "rating" NUMERIC;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "tier" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- 7. جدول مبيعات الكاشير (pos_sales)
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "cashHolderId" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "cashHolderName" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "cash_holder_id" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "cash_holder_name" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "sale_number" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "saleNumber" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "total_amount" NUMERIC;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "totalAmount" NUMERIC;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "warehouse_id" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customer_phone" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customer_name" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customer_address" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "performed_by" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "performedBy" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- 8. جدول تسليمات العهد (cash_handovers)
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "fromUserId" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "from_user_id" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "fromUserName" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "from_user_name" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "toUserId" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "to_user_id" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "toUserName" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "to_user_name" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "amount" NUMERIC;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "date" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS "storeId" TEXT;

-- 9. جداول الحركات والمديونيات الجديدة
CREATE TABLE IF NOT EXISTS customer_transactions (
    id TEXT PRIMARY KEY,
    customerId TEXT,
    customer_id TEXT,
    date TEXT,
    amount NUMERIC,
    type TEXT,
    note TEXT,
    orderId TEXT,
    order_id TEXT,
    storeId TEXT,
    store_id TEXT
);

CREATE TABLE IF NOT EXISTS supplier_transactions (
    id TEXT PRIMARY KEY,
    supplierId TEXT,
    supplier_id TEXT,
    date TEXT,
    amount NUMERIC,
    type TEXT,
    note TEXT,
    orderId TEXT,
    order_id TEXT,
    storeId TEXT,
    store_id TEXT
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    storeId TEXT,
    store_id TEXT,
    amount NUMERIC NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    method TEXT,
    details TEXT,
    fee NUMERIC DEFAULT 0,
    netAmount NUMERIC,
    isSameDay BOOLEAN DEFAULT false
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS "debtBalance" NUMERIC DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS "debtHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "balance" NUMERIC DEFAULT 0;

-- 9. حركات الشركاء والخزائن والشركاء وسجل النشاط
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "treasuryAccountId" TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "treasury_account_id" TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "partner_id" TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
ALTER TABLE partner_transactions ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS "profitRatio" NUMERIC DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE treasury_accounts ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "user" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "details" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "date" TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "timestamp" NUMERIC;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN DEFAULT false;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE inventory_audits ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE cash_holders ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE call_scripts ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE custom_pages ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE global_options ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE shipping_integrations ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "storeId" TEXT;
`;
    navigator.clipboard.writeText(instructions);
    triggerAlarm("✅ تم نسخ كود التحديث الشامل لجميع الأعمدة المفقودة! قم بلصقه وتشغيله في Supabase SQL Editor لإصلاح جميع الجداول ومنع اختفاء أي بيانات.", 'success', 'إصلاح شامل لقاعدة البيانات');
  };
  
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
                setSettings(prev => ({
                    ...prev,
                    supabaseUrl: customCloudUrl.trim(),
                    supabaseAnonKey: customCloudAnonKey.trim()
                }));
                setSupabaseRestricted(false);
                setIsRestricted(false);
                triggerAlarm("✅ تم حفظ إعدادات قاعدة البيانات! سيتم إعادة تحميل الصفحة الآن للتطبيق.", 'success', 'تم الحفظ', {
                  onConfirm: async () => { 
                      if (forceSync) await forceSync();
                      window.location.reload(); 
                  }
                });
              }
            }
          );
          return;
        }

        localStorage.setItem('custom_cloud_url', customCloudUrl.trim());
        localStorage.setItem('custom_cloud_anon_key', customCloudAnonKey.trim());
        setSettings(prev => ({
            ...prev,
            supabaseUrl: customCloudUrl.trim(),
            supabaseAnonKey: customCloudAnonKey.trim()
        }));
        
        // Since they supplied a new fresh DB, let's auto-reactivate cloud connection
        setSupabaseRestricted(false);
        setIsRestricted(false);
        triggerAlarm("✅ تم التحقق وحفظ إعدادات قاعدة البيانات المخصصة بنجاح! سيتم إعادة تحميل التطبيق للاتصال بالخادم المخصص.", 'success', 'ربط ناجح', {
          onConfirm: async () => { 
              if (forceSync) await forceSync();
              window.location.reload(); 
          }
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
    setSettings(prev => {
        const newSettings = { ...prev };
        delete newSettings.supabaseUrl;
        delete newSettings.supabaseAnonKey;
        return newSettings;
    });
    setSupabaseRestricted(false);
    setIsRestricted(false);
    setCustomCloudUrl('');
    setCustomCloudAnonKey('');
    triggerAlarm("تمت استعادة قاعدة البيانات السحابية الافتراضية بنجاح! سيتم إعادة تحميل الصفحة لتطبيق التغييرات.", 'success', 'استعادة الافتراضي', {
      onConfirm: async () => { 
          if (forceSync) await forceSync();
          window.location.reload(); 
      }
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

          {syncPreview && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 overflow-hidden mb-6"
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
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
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
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
                            <span className="text-xs text-rose-500 line-through decoration-rose-500/30">{c.oldBalance.toLocaleString()}</span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span className="text-sm font-bold text-emerald-500">{c.newBalance.toLocaleString()}</span>
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
                        <div key={acc.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
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
                            <span className="text-xs text-rose-500 line-through decoration-rose-500/30">{acc.oldBalance.toLocaleString()}</span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span className="text-sm font-bold text-emerald-500">{acc.newBalance.toLocaleString()}</span>
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
                        <div key={w.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
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
                            <span className="text-xs text-rose-500 line-through decoration-rose-500/30">{w.oldBalance.toLocaleString()}</span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span className="text-sm font-bold text-emerald-500">{w.newBalance.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-400 mr-1">ج.م</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
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

                <button 
                  onClick={handleFixDBSchema}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw size={18} />
                  ⚡ إصلاح وتحديث شامل لجميع الأعمدة المفقودة (شامل لحل اختفاء المنتجات والبيانات)
                </button>
                <button 
                  onClick={handleFixFlexShipSchema}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-xl shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw size={18} />
                  إصلاح "flexShip" وأعمدة الشحن
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
                             className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-450 font-mono outline-none text-right"
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

      <div id="activity-movements" className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
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
          <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-xl">
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
