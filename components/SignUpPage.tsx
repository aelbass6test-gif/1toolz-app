import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Store, Mail, User as UserIcon, ShieldAlert, Phone, KeyRound, LogIn, UserPlus, Loader2, X, BarChart, Settings, Users, ArrowLeft, CheckCircle, Database, AlertCircle, Copy, Check, RefreshCw, Shield } from 'lucide-react';
import { User } from '../types';
import { getUserByPhone, createUserDoc, getUserByPhoneFromSupabase, updateUserInSupabase } from '../services/databaseService';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebaseClient';
import { motion } from 'framer-motion';

// --- Reusable UI Components ---
const FeatureCard: React.FC<{ icon: React.ReactElement<{ size?: number, className?: string }>; title: string; description: string; }> = ({ icon, title, description }) => (
  <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 text-center transition-all hover:-translate-y-2 hover:border-indigo-500/50">
    <div className="inline-block p-4 bg-slate-700/50 rounded-full mb-4 border border-slate-600">
        {React.cloneElement(icon, { size: 32, className:"text-indigo-400" })}
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-slate-400 text-sm">{description}</p>
  </div>
);

const StepCard: React.FC<{ number: string; title: string; description: string; }> = ({ number, title, description }) => (
  <div className="text-center">
    <div className="relative inline-block">
      <div className="w-16 h-16 bg-slate-800/80 border border-slate-700 rounded-full flex items-center justify-center font-black text-3xl text-indigo-400 mb-4">{number}</div>
    </div>
    <h3 className="text-2xl font-bold mb-2">{title}</h3>
    <p className="text-slate-400 max-w-xs mx-auto">{description}</p>
  </div>
);

const AuthModal: React.FC<{
  onClose: () => void;
  children: React.ReactNode;
}> = ({ onClose, children }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 20 }}
      className="relative w-full max-w-md"
      onClick={e => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute -top-3 -right-3 z-10 p-2 bg-slate-700 hover:bg-red-500 rounded-full text-white transition-colors">
        <X size={20} />
      </button>
      {children}
    </motion.div>
  </motion.div>
);


// --- SQL Schema Script for Custom DB setup ---
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
    password TEXT NOT NULL,
    email TEXT,
    stores JSONB DEFAULT '[]'::jsonb,
    sites JSONB DEFAULT '[]'::jsonb,
    is_admin BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    join_date TEXT
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
    status TEXT NOT NULL,
    date TEXT NOT NULL,
    total_price NUMERIC NOT NULL,
    totalPrice NUMERIC,
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
    note TEXT,
    details JSONB DEFAULT '{}'::jsonb
);

-- 6. SUPPLIERS (الموردين)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT
);

-- 7. SUPPLY_ORDERS (أوردرات الإمداد والمخزون)
CREATE TABLE IF NOT EXISTS supply_orders (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    supplier_id TEXT,
    total_cost NUMERIC NOT NULL,
    date TEXT NOT NULL,
    items JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL,
    "distributeExpensesEqually" BOOLEAN DEFAULT false,
    "recordExpensesFormally" BOOLEAN DEFAULT false
);

-- 8. REVIEWS (مراجعات وآراء التقاطعات)
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    customer_name TEXT,
    rating NUMERIC DEFAULT 5,
    comment TEXT,
    status TEXT
);

-- 9. ABANDONED_CARTS (السلات المتروكة)
CREATE TABLE IF NOT EXISTS abandoned_carts (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_phone TEXT,
    total_value NUMERIC,
    date TEXT,
    items JSONB DEFAULT '[]'::jsonb
);

-- 10. ACTIVITY_LOGS (سجل الحركات العام)
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    "user" TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    details JSONB,
    timestamp TEXT,
    date TEXT
);

-- 11. EMPLOYEES (الموظفون وصلاحياتهم)
CREATE TABLE IF NOT EXISTS employees (
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
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
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    usage_limit NUMERIC,
    usage_count NUMERIC DEFAULT 0,
    expiration_date TEXT,
    is_active BOOLEAN DEFAULT true
);

-- 13. COLLECTIONS (التصنيفات والجموعات للمنتجات)
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true
);

-- 14. CUSTOM_PAGES (الصفحات التعريفية المخصصة)
CREATE TABLE IF NOT EXISTS custom_pages (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT,
    is_active BOOLEAN DEFAULT true
);

-- 15. PAYMENT_METHODS (طرق الدفع المفعلة)
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    details JSONB DEFAULT '{}'::jsonb
);

-- 16. CUSTOMERS (بيانات العملاء وتقييمات الولاء)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    loyalty_points NUMERIC DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    first_order_date TEXT,
    last_order_date TEXT,
    notes TEXT
);

-- 17. GLOBAL_OPTIONS (خيارات الضبط العام للمتجر)
CREATE TABLE IF NOT EXISTS global_options (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    is_active BOOLEAN DEFAULT true
);

-- 18. SHIPPING_INTEGRATIONS (تكاملات شركات الشحن والدليفري)
CREATE TABLE IF NOT EXISTS shipping_integrations (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores_data(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    api_key TEXT,
    api_secret TEXT,
    account_number TEXT,
    is_connected BOOLEAN DEFAULT false
);

-- 19. DOCUMENTS (الملفات وأرشيف الفواتير الموروثة)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    content JSONB DEFAULT '{}'::jsonb
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
    sale_number TEXT,
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

-- تعطيل نظام الحماية لتمكين الاتصال المباشر وتسهيل عملية المزامنة
ALTER TABLE stores_data DISABLE ROW LEVEL SECURITY;
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
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "distributeExpensesEqually" BOOLEAN DEFAULT false;
ALTER TABLE supply_orders ADD COLUMN IF NOT EXISTS "recordExpensesFormally" BOOLEAN DEFAULT false;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'online';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS "user" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "cashHolderId" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS "cashHolderName" TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS cash_holder_id TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS cash_holder_name TEXT;
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
`;

// --- Main Page Component ---
interface SignUpPageProps {
  onPasswordSuccess: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onPasswordSuccess, users, setUsers }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const [showAdminTab, setShowAdminTab] = useState(false);
  
  // User form state
  const [isLoginView, setIsLoginView] = useState(true);
  const [fullName, setFullName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [userError, setUserError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If coming from another page with forgot=true, show the modal
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('forgot') === 'true') {
      setShowResetModal(true);
    }
  }, []);

  // Admin form state
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  // Custom database state and actions
  const [hasCustomDb, setHasCustomDb] = useState(
    typeof window !== 'undefined' ? !!localStorage.getItem('custom_supabase_url') : false
  );
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlDetails, setShowSqlDetails] = useState(false);

  const handleRestoreDefaultDb = () => {
    localStorage.removeItem('custom_supabase_url');
    localStorage.removeItem('custom_supabase_anon_key');
    alert("تمت استعادة قاعدة البيانات الافتراضية بنجاح! سيتم إعادة تشغيل ومزامنة حسابك القديم.");
    window.location.reload();
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const openAuthModal = (isLogin: boolean) => {
    setIsLoginView(isLogin);
    setShowAuthModal(true);
  };
  
  useEffect(() => {
    if (userPhone === 'ADMINLOGIN') {
      setShowAdminTab(true);
      setUserPhone(''); // Clear input after triggering
    }
  }, [userPhone]);

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setIsLoading(true);

    const firebaseEmail = `${userPhone.trim()}@mystore-auth.app`;

    if (isLoginView) {
      console.log('[AUTH DEBUG]', {
        phone: userPhone,
        firebaseEmail,
        passwordLength: userPassword?.length
      });
      try {
        await signInWithEmailAndPassword(auth, firebaseEmail, userPassword);
        const foundUser = await getUserByPhone(userPhone.trim());
        if (foundUser) {
          if (!Array.isArray(foundUser.stores) && !foundUser.isAdmin) {
            setUserError('أنت مسجل كموظف. يرجى تسجيل الدخول من صفحة دخول الموظفين.');
            setIsLoading(false);
            return;
          }
          onPasswordSuccess(foundUser);
        } else {
          setUserError('لم يتم العثور على بيانات المستخدم.');
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err.code === 'auth/network-request-failed') {
          setUserError("فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.");
          setIsLoading(false);
          return;
        }
        console.error('Login error:', err);
        const isUserNotFoundOrInvalid = err.code === 'auth/user-not-found' || 
                                       err.code === 'auth/invalid-credential' || 
                                       err?.message?.includes('user-not-found') || 
                                       err?.message?.includes('invalid-credential');
        if (isUserNotFoundOrInvalid) {
          console.log('[MIGRATION/AUTH] Login failed. Checking Supabase for user:', userPhone);
          try {
            const legacyUser = await getUserByPhoneFromSupabase(userPhone.trim());
            
            // 1. Check if they have a CUSTOM email in Supabase (meaning they updated it in settings)
            if (legacyUser && legacyUser.email && legacyUser.email !== `${userPhone.trim()}@mystore-auth.app`) {
              console.log('[AUTH] Found custom email in Supabase, trying login with:', legacyUser.email);
              try {
                await signInWithEmailAndPassword(auth, legacyUser.email, userPassword);
                const foundUser = await getUserByPhone(userPhone.trim());
                if (foundUser) {
                  onPasswordSuccess(foundUser);
                  return;
                }
              } catch (secondErr: any) {
                console.log('[AUTH] Custom email login also failed:', secondErr.code);
              }
            }
            
            // 2. Original Migration Logic (Legacy users)
            if (legacyUser) {
              console.log('[MIGRATION] Legacy user found in Supabase. Checking password...');
              const storedPassword = legacyUser.password;
              if (storedPassword === userPassword) {
                if (userPassword.length < 6) {
                  console.warn('[MIGRATION] Weak password detected (<6 characters) during legacy user login:', userPhone);
                  setUserError("يجب إعادة تعيين كلمة المرور لأن كلمة المرور القديمة لا تستوفي متطلبات Firebase Authentication.");
                  setIsLoading(false);
                  return;
                }
                
                // Use real email if available, otherwise generated one
                const emailToCreate = legacyUser.email || firebaseEmail;

                try {
                  console.log('[MIGRATION] Creating Firebase Auth account for legacy user:', userPhone, 'using email:', emailToCreate);
                  await createUserWithEmailAndPassword(auth, emailToCreate, userPassword);
                  console.log('[MIGRATION] Creating Firestore user doc for legacy user:', userPhone);
                  await createUserDoc(legacyUser);
                  onPasswordSuccess(legacyUser);
                } catch (createErr: any) {
                  if (createErr.code === 'auth/email-already-in-use') {
                    console.log('[MIGRATION] Firebase Auth account already exists for legacy user, attempting sign-in...');
                    try {
                      // Try signing in with BOTH potential emails
                      try {
                        await signInWithEmailAndPassword(auth, emailToCreate, userPassword);
                      } catch (signInErr: any) {
                        if (emailToCreate !== firebaseEmail) {
                          await signInWithEmailAndPassword(auth, firebaseEmail, userPassword);
                        } else {
                          throw signInErr;
                        }
                      }
                      
                      const existingFsUser = await getUserByPhone(userPhone.trim());
                      if (!existingFsUser) {
                        await createUserDoc(legacyUser);
                      }
                      onPasswordSuccess(legacyUser);
                    } catch (signInErr: any) {
                      if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
                        console.warn('[MIGRATION] Existing account found but password mismatch for legacy user:', userPhone);
                        setUserError('رقم الموبايل أو كلمة المرور غير صحيحة.');
                      } else {
                        console.error('[MIGRATION] Sign-in failed after email-already-in-use:', signInErr);
                        setUserError('رقم الموبايل أو كلمة المرور غير صحيحة.');
                      }
                      setIsLoading(false);
                    }
                  } else {
                    console.error('[MIGRATION] On-the-fly signup failed for legacy user:', createErr);
                    setUserError('فشل إنشاء حساب المصادقة.');
                    setIsLoading(false);
                  }
                }
                return;
              } else {
                console.log('[MIGRATION] Legacy password mismatch for user:', userPhone);
              }
            } else {
              console.log('[MIGRATION] Legacy user not found in Supabase for user:', userPhone);
            }
          } catch (migrationErr) {
            console.error('[MIGRATION] On login legacy check failed:', migrationErr);
          }
        }
        setUserError('رقم الموبايل أو كلمة المرور غير صحيحة.');
        setIsLoading(false);
      }
    } else {
      if (!fullName.trim() || !userPhone.trim() || !userPassword.trim() || !userEmail.trim()) {
        setUserError('يرجى ملء جميع الحقول.');
        setIsLoading(false);
        return;
      }
      if (userPassword.length < 8) {
        setUserError('يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.');
        setIsLoading(false);
        return;
      }
      
      try {
        // ALWAYS use the generated email for the initial Firebase Auth account.
        // This ensures the security rules can verify phone ownership via the email pattern.
        // The real email will be stored in Firestore and used for recovery/login lookups.
        const emailToUse = firebaseEmail;
          
        console.log('[SIGNUP] Creating account with identity email:', emailToUse);
        await createUserWithEmailAndPassword(auth, emailToUse, userPassword);
        
        const newUser: User = { 
          fullName, 
          phone: userPhone.trim(), 
          email: userEmail, 
          password: userPassword, // Include password for Supabase sync
          stores: [],
          joinDate: new Date().toISOString() 
        };
        const success = await createUserDoc(newUser);
        if (success) {
          // Sync to Supabase as well for legacy compatibility
          try {
            await updateUserInSupabase(newUser);
          } catch (e) {
            console.warn('[SIGNUP] Failed to sync to Supabase (optional):', e);
          }
          
          setUsers(prevUsers => [...prevUsers, newUser]);
          onPasswordSuccess(newUser);
        } else {
          setUserError('فشل تسجيل الحساب في قاعدة البيانات. يرجى المحاولة لاحقاً.');
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Signup error:', err);
        if (err.code === 'auth/email-already-in-use') {
           setUserError('هذا الرقم مسجل بالفعل.');
        } else {
           setUserError('حدث خطأ أثناء التسجيل. يرجى المحاولة لاحقاً.');
        }
        setIsLoading(false);
      }
    }
  };

  const [sentToEmail, setSentToEmail] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setResetError('');
    setIsLoading(true);
    setSentToEmail('');

    if (!userPhone.trim()) {
      setResetError('يرجى إدخال رقم الموبايل أولاً.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Try to find user in Firestore (already migrated)
      let userEmailToUse = '';
      const firestoreUser = await getUserByPhone(userPhone.trim());
      
      if (firestoreUser && firestoreUser.email) {
        userEmailToUse = firestoreUser.email;
        console.log('[RESET] Found email in Firestore:', userEmailToUse);
      } else {
        // 2. Try Supabase
        const legacyUser = await getUserByPhoneFromSupabase(userPhone.trim());
        if (legacyUser && legacyUser.email && legacyUser.email.includes('@') && !legacyUser.email.includes('mystore-auth.app')) {
          userEmailToUse = legacyUser.email;
          console.log('[RESET] Found valid email in Supabase:', userEmailToUse);
        } else {
          // 3. Fallback to generated
          userEmailToUse = `${userPhone.trim()}@mystore-auth.app`;
          console.log('[RESET] Using generated email fallback:', userEmailToUse);
        }
      }
      
      console.log('[RESET] Final attempt to send reset link to:', userEmailToUse);
      
      // Before sending, check if it's the generated one and we are in a context where we can warn
      const isGeneratedEmail = userEmailToUse.includes('@mystore-auth.app');
      
      if (isGeneratedEmail) {
        setResetError('عذراً، لم تقم بربط بريد إلكتروني حقيقي بحسابك سابقاً (تستخدم بريد النظام التلقائي). يرجى التواصل مع الدعم الفني لاستعادة حسابك.');
        setIsLoading(false);
        return;
      }
      
      await sendPasswordResetEmail(auth, userEmailToUse);
      
      setSentToEmail(userEmailToUse);
      setResetSuccess(true);
      
      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess(false);
        setSentToEmail('');
      }, 8000); // Longer timeout to let them read it
    } catch (err: any) {
      console.error('Reset password error:', err);
      if (err.code === 'auth/user-not-found') {
        setResetError('هذا الحساب غير مسجل لدينا في نظام المصادقة.');
      } else if (err.code === 'auth/invalid-email') {
        setResetError('البريد الإلكتروني المرتبط بالحساب غير صالح.');
      } else {
        setResetError('حدث خطأ أثناء إرسال طلب إعادة التعيين. يرجى المحاولة لاحقاً.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [resetError, setResetError] = useState('');

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setIsLoading(true);
    
    const firebaseEmail = `${adminPhone.trim()}@mystore-auth.app`;

    console.log('[AUTH DEBUG]', {
      phone: adminPhone,
      firebaseEmail,
      passwordLength: adminPassword?.length
    });

    try {
      await signInWithEmailAndPassword(auth, firebaseEmail, adminPassword);
      const adminUser = await getUserByPhone(adminPhone.trim());
      if (adminUser && adminUser.isAdmin) {
        onPasswordSuccess(adminUser);
      } else {
        setAdminError('ليس لديك صلاحيات المدير.');
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setAdminError("فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.");
        setIsLoading(false);
        return;
      }
      console.error('Admin login error:', err);
      const isUserNotFoundOrInvalid = err.code === 'auth/user-not-found' || 
                                     err.code === 'auth/invalid-credential' || 
                                     err?.message?.includes('user-not-found') || 
                                     err?.message?.includes('invalid-credential');
      if (isUserNotFoundOrInvalid) {
        console.log('[MIGRATION] Firebase Auth failed for admin. Checking legacy Supabase table for phone:', adminPhone);
        // Search ONLY in Supabase for user
        try {
          const legacyUser = await getUserByPhoneFromSupabase(adminPhone.trim());
          if (legacyUser && legacyUser.isAdmin) {
            console.log('[MIGRATION] Legacy admin found in Supabase. Checking password...');
            const storedPassword = legacyUser.password;
            if (storedPassword === adminPassword) {
              if (adminPassword.length < 6) {
                console.warn('[MIGRATION] Weak password detected (<6 characters) during legacy admin login:', adminPhone);
                setAdminError("يجب إعادة تعيين كلمة المرور لأن كلمة المرور القديمة لا تستوفي متطلبات Firebase Authentication.");
                setIsLoading(false);
                return;
              }
              try {
                console.log('[MIGRATION] Creating Firebase Auth account for legacy admin:', adminPhone);
                await createUserWithEmailAndPassword(auth, firebaseEmail, adminPassword);
                console.log('[MIGRATION] Creating Firestore user doc for legacy admin:', adminPhone);
                await createUserDoc(legacyUser);
                onPasswordSuccess(legacyUser);
              } catch (createErr: any) {
                if (createErr.code === 'auth/email-already-in-use') {
                  console.log('[MIGRATION] Firebase Auth account already exists for legacy admin, attempting sign-in...');
                  try {
                    await signInWithEmailAndPassword(auth, firebaseEmail, adminPassword);
                    const existingFsUser = await getUserByPhone(adminPhone.trim());
                    if (!existingFsUser) {
                      await createUserDoc(legacyUser);
                    }
                    onPasswordSuccess(legacyUser);
                  } catch (signInErr: any) {
                    if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
                      console.warn('[MIGRATION] Existing account found but password mismatch for legacy admin:', adminPhone);
                      setAdminError('رقم الهاتف أو كلمة المرور غير صحيحة للمدير.');
                    } else {
                      console.error('[MIGRATION] Sign-in failed after email-already-in-use:', signInErr);
                      setAdminError('رقم الهاتف أو كلمة المرور غير صحيحة للمدير.');
                    }
                    setIsLoading(false);
                  }
                } else {
                  console.error('[MIGRATION] On-the-fly signup failed for legacy admin:', createErr);
                  setAdminError('فشل إنشاء حساب المصادقة للمدير.');
                  setIsLoading(false);
                }
              }
              return;
            } else {
              console.log('[MIGRATION] Legacy password mismatch for admin:', adminPhone);
            }
          } else {
            console.log('[MIGRATION] Legacy admin user not found in Supabase for admin:', adminPhone);
          }
        } catch (migrationErr) {
          console.error('[MIGRATION] On admin login legacy check failed:', migrationErr);
        }
      }
      setAdminError('بيانات دخول المدير غير صحيحة.');
      setIsLoading(false);
    }
  };

  const toggleView = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsLoginView(!isLoginView);
    setUserError('');
    setFullName('');
    setUserPhone('');
    setUserEmail('');
    setUserPassword('');
  };
  
  const navItemClasses = "font-bold text-slate-300 hover:text-white transition-colors";

  return (
    <div dir="rtl" className="font-cairo bg-slate-950 text-white overflow-x-hidden">
      
      {/* --- Header --- */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/70 backdrop-blur-lg border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="font-black text-2xl">منصتي</Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className={navItemClasses}>الميزات</a>
            <a href="#pricing" className={navItemClasses}>الأسعار</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={() => openAuthModal(true)} className="font-bold text-sm text-slate-300 hover:text-white">تسجيل الدخول</button>
            <button onClick={() => openAuthModal(false)} className="bg-indigo-600 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
              ابدأ الآن
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* --- Hero Section --- */}
        <section className="relative pt-40 pb-24 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/30 to-slate-950 opacity-50"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[150%] rounded-full bg-[radial-gradient(circle_at_center,_rgba(129,_140,_248,_0.15),_transparent_40%)] -z-10"></div>
          
          <div className="container mx-auto px-6 relative z-10">
            <motion.h1 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                className="text-4xl md:text-6xl font-black leading-tight"
            >
              أنشئ متجرك الإلكتروني الاحترافي في دقائق
            </motion.h1>
            <motion.p 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-slate-300 max-w-2xl mx-auto mt-6"
            >
              منصة متكاملة لإدارة المنتجات، الطلبات، والعملاء بسهولة. ابدأ مجاناً، بدون عمولات على المبيعات.
            </motion.p>
            <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-10"
            >
              <button onClick={() => openAuthModal(false)} className="bg-indigo-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-indigo-500 transition-transform hover:scale-105 shadow-2xl shadow-indigo-600/30">
                أنشئ متجرك مجاناً
              </button>
            </motion.div>
          </div>
        </section>

        {/* --- Features Section --- */}
        <section id="features" className="py-24 bg-slate-900">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-4xl font-black">كل ما تحتاجه لتبدأ البيع أونلاين</h2>
              <p className="text-slate-400 mt-4">نقدم لك مجموعة من الأدوات القوية لمساعدتك على النجاح في تجارتك الإلكترونية.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard icon={<Store />} title="متجر إلكتروني متكامل" description="واجهة عرض احترافية لمنتجاتك مع تجربة شراء سهلة لعملائك." />
              <FeatureCard icon={<ShoppingCart />} title="إدارة الطلبات" description="نظام متكامل لتتبع الطلبات من التأكيد وحتى التحصيل." />
              <FeatureCard icon={<BarChart />} title="تحليلات وتقارير" description="احصل على رؤى دقيقة حول مبيعاتك وأرباحك لاتخاذ قرارات أفضل." />
              <FeatureCard icon={<Users />} title="إدارة العملاء" description="سجل بيانات عملائك وتاريخ طلباتهم لتحسين علاقتك بهم." />
              <FeatureCard icon={<Settings />} title="تخصيص كامل" description="تحكم كامل في إعدادات الشحن، الدفع، والسياسات المالية لمتجرك." />
              <FeatureCard icon={<UserPlus />} title="صلاحيات الموظفين" description="أضف فريق عملك وحدد صلاحيات كل موظف بدقة وأمان." />
            </div>
          </div>
        </section>

        {/* --- How It Works Section --- */}
        <section className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl font-black">ابدأ في 3 خطوات بسيطة</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                    <StepCard number="01" title="أنشئ حسابك" description="سجل حسابك المجاني في أقل من دقيقة واحدة." />
                    <StepCard number="02" title="أضف منتجاتك" description="أضف صور ووصف منتجاتك بسهولة تامة." />
                    <StepCard number="03" title="ابدأ البيع" description="شارك رابط متجرك مع عملائك وابدأ في استقبال الطلبات." />
                </div>
            </div>
        </section>

        {/* --- Pricing Section --- */}
        <section id="pricing" className="py-24 bg-slate-900">
          <div className="container mx-auto px-6">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-10 rounded-3xl text-center max-w-4xl mx-auto shadow-2xl">
              <h3 className="text-4xl font-black">الخطة المجانية. مدى الحياة.</h3>
              <p className="text-indigo-200 mt-4 text-lg">نحن نؤمن بدعم المشاريع الناشئة. لهذا، منصتنا مجانية بالكامل.</p>
              <ul className="mt-8 space-y-3 text-indigo-100 max-w-md mx-auto">
                <li className="flex items-center justify-center gap-2 font-bold"><CheckCircle className="text-green-400"/> عدد لا محدود من المنتجات</li>
                <li className="flex items-center justify-center gap-2 font-bold"><CheckCircle className="text-green-400"/> عدد لا محدود من الطلبات</li>
                <li className="flex items-center justify-center gap-2 font-bold"><CheckCircle className="text-green-400"/> 0% عمولة على المبيعات</li>
              </ul>
              <button onClick={() => openAuthModal(false)} className="mt-10 bg-white text-indigo-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-indigo-100 transition-transform hover:scale-105">
                ابدأ رحلتك الآن
              </button>
            </div>
          </div>
        </section>

        {/* --- Final CTA --- */}
        <section className="py-24 text-center">
            <div className="container mx-auto px-6">
                <h2 className="text-4xl font-black">جاهز لبدء مشروعك؟</h2>
                <p className="text-slate-400 mt-4">انضم لآلاف التجار الذين يستخدمون منصتنا لتحقيق النجاح.</p>
                <button onClick={() => openAuthModal(false)} className="mt-8 bg-indigo-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-500 transition-transform hover:scale-105 shadow-2xl shadow-indigo-600/30 flex items-center gap-3 mx-auto">
                    <span>أنشئ متجرك مجاناً</span>
                    <ArrowLeft />
                </button>
            </div>
        </section>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="container mx-auto px-6 text-center text-slate-500">
          <p>
            تم تأسيس وبرمجة المنصة بالكامل بواسطة <span className="font-bold text-slate-400">عبدالرحمن سعيد</span>.
          </p>
        </div>
      </footer>

      {/* --- Password Reset Modal --- */}
      {showResetModal && (
        <AuthModal onClose={() => {
          setShowResetModal(false);
          setResetError('');
          setResetSuccess(false);
        }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-indigo-500/10 rounded-2xl mb-4">
                <KeyRound className="text-indigo-400" size={32} />
              </div>
              <h2 className="text-2xl font-bold mb-2">استعادة كلمة المرور</h2>
              <p className="text-slate-400 text-sm">سنرسل رابطاً لتعيين كلمة مرور جديدة إلى بريدك الإلكتروني المسجل لهذا الرقم:</p>
              <div className="mt-2 text-indigo-400 font-bold">{userPhone}</div>
            </div>

            {resetSuccess ? (
              <div className="bg-green-900/30 border border-green-700/50 text-green-400 p-4 rounded-xl space-y-2 mb-6">
                <div className="flex items-center gap-3 animate-pulse">
                  <CheckCircle size={20} />
                  <span className="text-sm font-bold">تم إرسال رابط إعادة التعيين بنجاح.</span>
                </div>
                <p className="text-xs text-slate-300">
                  تم الإرسال إلى: <span className="text-indigo-300 font-mono" dir="ltr">
                    {sentToEmail.includes('@mystore-auth.app') 
                      ? "⚠️ بريد النظام المؤقت (لن تستلم شيئاً)" 
                      : (sentToEmail.split('@')[0].length > 3 
                          ? `${sentToEmail.split('@')[0].substring(0, 3)}***@${sentToEmail.split('@')[1]}`
                          : sentToEmail)
                    }
                  </span>
                </p>
                <p className="text-[10px] text-slate-400">يرجى التحقق من بريدك الإلكتروني (بما في ذلك ملفات الـ Spam).</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {resetError && (
                  <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-center font-bold text-xs">
                    {resetError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : 'إرسال الرابط'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full text-slate-500 hover:text-white text-xs font-bold py-2 transition-colors"
                >
                  إلغاء
                </button>
              </form>
            )}
          </div>
        </AuthModal>
      )}

      {/* --- Auth Modal --- */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)}>
          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
            <div className="flex bg-slate-800/50 border border-slate-700 rounded-lg p-1 mb-6">
                <button onClick={() => setActiveTab('user')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'user' ? 'bg-slate-700/50 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-700/20'}`}><UserIcon size={16}/> المستخدمين</button>
                {showAdminTab && (
                  <button onClick={() => setActiveTab('admin')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-slate-700/50 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-700/20'}`}><ShieldAlert size={16}/> المدير</button>
                )}
            </div>
            
            {activeTab === 'user' && (
              <div className="animate-in fade-in duration-300">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{isLoginView ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</h2>
                  <p className="text-slate-400 mt-1">{isLoginView ? 'مرحباً بعودتك! أدخل بياناتك للمتابعة.' : 'ابدأ بإنشاء متجرك الإلكتروني الآن'}</p>
                </div>

                {hasCustomDb && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mt-4 text-right space-y-3">
                    <div className="flex gap-2.5 items-start">
                      <Database size={18} className="text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-xs font-bold text-indigo-300">منبه: السيرفر المخصص مفعل</h3>
                        <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                          أنت متصل بقاعدة بيانات مخصصة جديدة وفارغة. حساباتك القديمة موجودة على السيرفر الافتراضي الأصلي. يمكنك <strong>إنشاء حساب جديد</strong> لتشغيل السيرفر المخصص، أو الرجوع فوراً للسيرفر الافتراضي لاسترجاع بياناتك.
                        </p>
                      </div>
                    </div>

                    <div className="pt-1 flex flex-wrap gap-2 text-[11px]">
                      <button 
                        type="button" 
                        onClick={handleCopySql} 
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-950/50 hover:bg-indigo-900/50 text-indigo-300 rounded-lg font-bold border border-indigo-900/50 transition active:scale-95"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="text-green-400" size={12} />
                            <span>تم نسخ كود SQL!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>نسخ كود إنشاء الجداول</span>
                          </>
                        )}
                      </button>
                      
                      <button 
                        type="button" 
                        onClick={handleRestoreDefaultDb} 
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-lg font-bold border border-red-950/30 transition active:scale-95"
                      >
                        <RefreshCw size={12} />
                        <span>استعادة السيرفر الافتراضي</span>
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleUserSubmit} className="space-y-4 mt-6">
                  {!isLoginView && (
                    <>
                      <div className="relative"><UserIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="text" placeholder="الاسم الكامل" required className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                      <div className="relative"><Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="email" placeholder="البريد الإلكتروني" required className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} /></div>
                    </>
                  )}
                  <div className="relative"><Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="text" placeholder="رقم الموبايل / اسم المستخدم" required className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} /></div>
                  <div className="relative"><KeyRound size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="password" placeholder="كلمة المرور" required className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} /></div>
                  
                  {isLoginView && (
                    <div className="text-left">
                      <button 
                        type="button" 
                        onClick={() => setShowResetModal(true)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                  )}

                  {userError && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-center font-bold text-sm">{userError}</div>}
                  <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-wait">
                      {isLoading ? <Loader2 className="animate-spin" /> : (isLoginView ? <><LogIn size={18}/> تسجيل الدخول</> : <><UserPlus size={18}/> إنشاء حساب</>)}
                  </button>
                </form>
                <p className="text-center text-sm text-slate-400 mt-6">{isLoginView ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}{' '}<a href="#" onClick={toggleView} className="font-bold text-indigo-400 hover:underline">{isLoginView ? 'أنشئ حساباً' : 'تسجيل الدخول'}</a></p>
                <div className="mt-4 text-center"><Link to="/employee-login" className="text-sm text-slate-400 hover:text-indigo-400 hover:underline">تسجيل دخول الموظفين</Link></div>
                <div className="mt-3 text-center border-t border-slate-800 pt-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAdminTab(true);
                      setActiveTab('admin');
                      setAdminPhone('admin');
                      setAdminPassword('admin');
                    }} 
                    className="text-xs text-slate-400 hover:text-red-400 hover:underline inline-flex items-center gap-1 transition-colors"
                  >
                    <Shield size={12} />
                    <span>هل أنت المدير العام (الادمن)؟ اضغط هنا للدخول المباشر السريع</span>
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'admin' && (
              <div className="animate-in fade-in duration-300">
                 <div className="text-center"><h2 className="text-2xl font-bold">لوحة تحكم المدير</h2><p className="text-slate-400 mt-1">تسجيل دخول خاص بالإدارة.</p></div>
                 <form onSubmit={handleAdminSubmit} className="space-y-4 mt-6">
                  <div className="relative"><Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="text" required value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  <div className="relative"><KeyRound size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"/><input type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                   {adminError && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-center font-bold text-sm">{adminError}</div>}
                   <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-90 text-white rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-wait">
                      {isLoading ? <Loader2 className="animate-spin"/> : <><LogIn size={18}/> الدخول كمدير</>}
                   </button>
                 </form>
              </div>
            )}
          </div>
        </AuthModal>
      )}
    </div>
  );
};

export default SignUpPage;