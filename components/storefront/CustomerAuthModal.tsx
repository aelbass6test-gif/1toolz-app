import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  Lock, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Package, 
  LogOut, 
  Sparkles, 
  Award,
  ChevronRight,
  Eye, 
  EyeOff, 
  Settings as SettingsIcon,
  ShieldCheck, 
  Save, 
  RotateCcw, 
  KeyRound, 
  FileText,
  Mail,
  Send,
  RefreshCw,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Order, CustomerProfile } from '../../types';
import { normalizePhone } from '../../utils/phoneUtils';

export interface StoreCustomer {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  address?: string;
  governorate?: string;
  city?: string;
  email?: string;
  isEmailVerified?: boolean;
  pinCode?: string;
  points?: number;
}

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  customers: CustomerProfile[];
  onSaveCustomer: (customer: StoreCustomer) => void;
  primaryColor?: string;
  storeName?: string;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  orders,
  customers,
  onSaveCustomer,
  primaryColor = '#059669',
  storeName = 'متجرنا'
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'account'>('login');
  const [activeTab, setActiveTab] = useState<'orders' | 'settings'>('orders');
  const [loginMethod, setLoginMethod] = useState<'email_otp' | 'phone_pin'>('email_otp');
  
  // Form states
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [phone2, setPhone2] = useState('');
  const [address, setAddress] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Settings edit states
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhone2, setEditPhone2] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGovernorate, setEditGovernorate] = useState('');
  const [editPin, setEditPin] = useState('');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active logged-in customer session
  const [activeCustomer, setActiveCustomer] = useState<StoreCustomer | null>(() => {
    try {
      const saved = localStorage.getItem('storefront_logged_customer');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (activeCustomer) {
      setMode('account');
      setEditName(activeCustomer.name || '');
      setEditEmail(activeCustomer.email || '');
      setEditPhone(activeCustomer.phone || '');
      setEditPhone2(activeCustomer.phone2 || '');
      setEditAddress(activeCustomer.address || '');
      setEditGovernorate(activeCustomer.governorate || '');
      setEditPin(activeCustomer.pinCode || '');
    }
  }, [activeCustomer]);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  // 60-second OTP countdown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Customer orders matching their phone number or email
  const customerOrders = useMemo(() => {
    if (!activeCustomer) return [];
    const normPhone = normalizePhone(activeCustomer.phone);
    const normEmail = (activeCustomer.email || '').toLowerCase().trim();
    return orders.filter(o => {
      const p1 = normalizePhone(o.customerPhone);
      const p2 = normalizePhone(o.customerPhone2);
      const oEmail = (o.customerEmail || (o as any).email || '').toLowerCase().trim();
      const phoneMatch = normPhone && ((p1 && p1 === normPhone) || (p2 && p2 === normPhone));
      const emailMatch = normEmail && oEmail && oEmail === normEmail;
      return Boolean(phoneMatch || emailMatch);
    });
  }, [orders, activeCustomer]);

  // Send OTP to customer's email
  const handleSendOtp = async (targetEmail: string, targetName: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('يرجى إدخال عنوان بريد إلكتروني صحيح لإرسال رمز التحقق');
      return;
    }

    setIsSendingOtp(true);
    setError('');
    setSuccessMsg('');
    setDevOtpCode(null);

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          userName: targetName.trim() || 'عميل المتجر',
          storeName: storeName || 'المتجر الإلكتروني'
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setIsOtpSent(true);
        setOtpCooldown(60);
        if (data.debugCode) {
          setDevOtpCode(data.debugCode);
        }
        setSuccessMsg(data.message || `تم إرسال رمز التحقق الأمني المكون من 6 أرقام إلى بريدك (${data.target || cleanEmail}) بنجاح.`);
      } else {
        setError(data.error || 'تعذر إرسال رمز التحقق إلى بريدك حالياً. يرجى التأكد من البريد والمحاولة مرة أخرى.');
      }
    } catch (err: any) {
      console.error('[CUSTOMER-OTP] Send OTP error:', err);
      setError('حدث خطأ في الاتصال بالخادم. يرجى المحاولة بعد لحظات.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP code helper
  const verifyOtpCode = async (targetEmail: string, code: string): Promise<boolean> => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    const cleanOtp = code.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('يرجى إدخال رمز التحقق كاملاً المكون من 6 أرقام');
      return false;
    }

    setIsVerifyingOtp(true);
    setError('');

    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanOtp
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        return true;
      } else {
        setError(data.message || data.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية. يرجى التحقق وإعادة المحاولة.');
        return false;
      }
    } catch (err: any) {
      console.error('[CUSTOMER-OTP] Verify OTP error:', err);
      setError('حدث خطأ أثناء التحقق من الرمز. يرجى المحاولة مرة أخرى.');
      return false;
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Login via Email OTP
  const handleEmailOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isOtpSent) {
      await handleSendOtp(email, '');
      return;
    }

    const isValid = await verifyOtpCode(email, otpCode);
    if (!isValid) return;

    const cleanEmail = email.trim().toLowerCase();

    // Match existing customer profile by email or phone or past orders
    const matchedCustomer = customers.find(c => 
      (c.email && c.email.toLowerCase() === cleanEmail) || 
      (c.phone && phone && normalizePhone(c.phone) === normalizePhone(phone))
    );

    const matchedOrder = orders.find(o => 
      ((o.customerEmail || (o as any).email || '').toLowerCase() === cleanEmail) ||
      (phone && normalizePhone(o.customerPhone) === normalizePhone(phone))
    );

    const customerSession: StoreCustomer = {
      id: matchedCustomer?.id || matchedCustomer?.phone || cleanEmail,
      name: matchedCustomer?.name || matchedOrder?.customerName || cleanEmail.split('@')[0],
      email: cleanEmail,
      phone: matchedCustomer?.phone || matchedOrder?.customerPhone || phone || '',
      address: matchedCustomer?.address || matchedOrder?.customerAddress || '',
      governorate: matchedCustomer?.governorate || matchedOrder?.governorate || matchedOrder?.shippingArea || '',
      city: matchedCustomer?.city || '',
      isEmailVerified: true,
      points: matchedCustomer?.loyaltyPoints || 50,
      pinCode: matchedCustomer ? (localStorage.getItem(`customer_pin_${matchedCustomer.phone}`) || '') : ''
    };

    setActiveCustomer(customerSession);
    localStorage.setItem('storefront_logged_customer', JSON.stringify(customerSession));
    onSaveCustomer(customerSession);
    setMode('account');
    setSuccessMsg('🎉 تم التحقق بنجاح وتأكيد هويتك بالبريد الإلكتروني! مرحباً بك.');
  };

  // Login via Phone & PIN
  const handlePhoneLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      setError('يرجى إدخال رقم هاتف صحيح (8 أرقام على الأقل)');
      return;
    }

    // Find in customers list or past orders
    const matchedCustomer = customers.find(c => normalizePhone(c.phone) === cleanPhone);
    const matchedOrder = orders.find(o => normalizePhone(o.customerPhone) === cleanPhone);

    // If PIN is saved in local registry or profile, verify it if entered
    const storedPin = localStorage.getItem(`customer_pin_${cleanPhone}`);
    if (storedPin && password && storedPin !== password) {
      setError('رمز المرور السري (PIN) غير صحيح. يرجى التأكد وإعادة المحاولة.');
      return;
    }

    const customerSession: StoreCustomer = {
      id: matchedCustomer?.id || cleanPhone,
      name: matchedCustomer?.name || matchedOrder?.customerName || 'عميل المتجر',
      phone: cleanPhone,
      email: matchedCustomer?.email || (matchedOrder as any)?.customerEmail || '',
      address: matchedCustomer?.address || matchedOrder?.customerAddress || '',
      governorate: matchedCustomer?.governorate || matchedOrder?.governorate || matchedOrder?.shippingArea || '',
      city: matchedCustomer?.city || '',
      points: matchedCustomer?.loyaltyPoints || 50,
      pinCode: storedPin || ''
    };

    setActiveCustomer(customerSession);
    localStorage.setItem('storefront_logged_customer', JSON.stringify(customerSession));
    onSaveCustomer(customerSession);
    setMode('account');
    setSuccessMsg('تم تسجيل الدخول بنجاح! مرحباً بك.');
  };

  // Register with Email OTP Verification
  const handleRegisterWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('يرجى إدخال بريد إلكتروني صحيح لتأكيد حسابك');
      return;
    }

    if (!name.trim()) {
      setError('يرجى إدخال الاسم بالكامل');
      return;
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      setError('يرجى إدخال رقم هاتف صحيح للتواصل');
      return;
    }

    // If OTP has not been sent yet, send it
    if (!isOtpSent) {
      await handleSendOtp(cleanEmail, name);
      return;
    }

    // Verify OTP code
    const isValid = await verifyOtpCode(cleanEmail, otpCode);
    if (!isValid) return;

    if (password) {
      localStorage.setItem(`customer_pin_${cleanPhone}`, password);
    }

    const newCustomer: StoreCustomer = {
      id: cleanPhone,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      phone2: phone2.trim(),
      address: address.trim(),
      governorate: governorate.trim(),
      isEmailVerified: true,
      pinCode: password,
      points: 100 // Welcome bonus loyalty points for email verification
    };

    setActiveCustomer(newCustomer);
    localStorage.setItem('storefront_logged_customer', JSON.stringify(newCustomer));
    onSaveCustomer(newCustomer);
    setMode('account');
    setSuccessMsg('🎉 تم تأكيد بريدك الإلكتروني بنجاح وتفعيل حسابك وحصلت على 100 نقطة مكافأة ترحيبية!');
  };

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    setError('');

    const cleanPhone = normalizePhone(editPhone) || activeCustomer.phone;

    if (editPin) {
      localStorage.setItem(`customer_pin_${cleanPhone}`, editPin);
    }

    const updatedCustomer: StoreCustomer = {
      ...activeCustomer,
      name: editName.trim() || activeCustomer.name,
      email: editEmail.trim() || activeCustomer.email,
      phone: cleanPhone,
      phone2: editPhone2.trim(),
      address: editAddress.trim(),
      governorate: editGovernorate.trim(),
      pinCode: editPin
    };

    setActiveCustomer(updatedCustomer);
    localStorage.setItem('storefront_logged_customer', JSON.stringify(updatedCustomer));
    onSaveCustomer(updatedCustomer);
    setSuccessMsg('✅ تم تحديث بياناتك وحفظ إعدادات حسابك بنجاح!');
  };

  const handleLogout = () => {
    setActiveCustomer(null);
    localStorage.removeItem('storefront_logged_customer');
    setMode('login');
    setEmail('');
    setOtpCode('');
    setIsOtpSent(false);
    setPhone('');
    setPassword('');
    setSuccessMsg('تم تسجيل الخروج بنجاح.');
  };

  const resetOtpFlow = () => {
    setIsOtpSent(false);
    setOtpCode('');
    setDevOtpCode(null);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md" 
        onClick={onClose}
        dir="rtl"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                <User size={22} />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {mode === 'account' ? `حسابي - ${activeCustomer?.name}` : mode === 'register' ? 'إنشاء حساب عميل جديد' : 'تسجيل دخول العملاء'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {mode === 'account' ? 'بوابة العميل الآمنة ومتابعة الطلبات' : `تسجيل دخول آمن ومشفر برمز OTP لدى ${storeName}`}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Simulated Dev OTP notification */}
          {devOtpCode && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
              <span className="font-bold">رمز التحقق السريع (تجريبي): <strong className="font-mono text-sm tracking-widest">{devOtpCode}</strong></span>
              <button 
                type="button" 
                onClick={() => setOtpCode(devOtpCode)} 
                className="px-2.5 py-1 bg-amber-200 dark:bg-amber-800 rounded-lg font-black text-[11px] hover:bg-amber-300 transition-colors"
              >
                تعبئة الرمز
              </button>
            </div>
          )}

          {/* --- VIEW 1: MY ACCOUNT & ORDERS --- */}
          {mode === 'account' && activeCustomer && (
            <div className="mt-6 space-y-6 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Customer Hero Card */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 to-emerald-50/40 dark:from-slate-800 dark:to-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-600/30">
                    {activeCustomer.name.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">{activeCustomer.name}</h4>
                      {activeCustomer.isEmailVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-full text-[10px] font-black" title="تم التحقق من البريد برمز OTP">
                          <ShieldCheck size={12} />
                          <span>إيميل مؤكد ✓</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {activeCustomer.email && <span>{activeCustomer.email}</span>}
                      {activeCustomer.email && activeCustomer.phone && <span>•</span>}
                      {activeCustomer.phone && <span>{activeCustomer.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <div className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">نقاط الولاء</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {activeCustomer.points ?? 50} نقطة 🎁
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Navigation Tabs */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center gap-2 pb-3 px-4 border-b-2 text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'orders'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <ShoppingBag size={16} />
                  <span>طلباتي ({customerOrders.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-2 pb-3 px-4 border-b-2 text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'settings'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <SettingsIcon size={16} />
                  <span>العناوين وإعدادات الحساب</span>
                </button>
              </div>

              {/* TAB 1: ORDERS LIST */}
              {activeTab === 'orders' && (
                <div className="space-y-3">
                  {customerOrders.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 space-y-3">
                      <Package size={36} className="mx-auto text-slate-300" />
                      <h4 className="font-black text-sm text-slate-800 dark:text-slate-200">لا توجد طلبات مسجلة بهذا الحساب بعد</h4>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        تصفح المتجر الآن وأضف طلبك الأول وسيظهر تلقائياً هنا مع إمكانية التتبع المباشر.
                      </p>
                      <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                      >
                        تسوق الآن 🛍️
                      </button>
                    </div>
                  ) : (
                    customerOrders.map(order => {
                      const totalAmount = (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);
                      const isDelivered = order.status === 'تم_التوصيل' || order.status === 'تم_توصيلها' || order.status === 'مدفوعة' || order.status === 'تم_التحصيل';
                      const isShipping = order.status === 'قيد_الشحن' || order.status === 'تم_الارسال';

                      return (
                        <div 
                          key={order.id} 
                          className="p-4 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200">
                                #{order.orderNumber || order.id.slice(-6)}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {new Date(order.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>

                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                              isDelivered
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                : isShipping
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                            }`}>
                              {order.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* Items brief */}
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {order.productName || (order.items || []).map(i => i.name).join('، ')}
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-400">الإجمالي:</span>
                            <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono text-sm">
                              {totalAmount.toLocaleString()} ج.م
                            </span>
                          </div>

                          {(order.waybillNumber || order.trackingUrl || order.bostaTrackingNumber) && (
                            <div className="pt-2 flex items-center justify-between text-xs">
                              <span className="text-[11px] font-mono text-slate-500">
                                شحنة: {order.waybillNumber || order.bostaTrackingNumber}
                              </span>
                              {order.trackingUrl && (
                                <a 
                                  href={order.trackingUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-emerald-600 hover:underline font-bold flex items-center gap-1 text-[11px]"
                                >
                                  <span>تتبع مباشر</span>
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: PROFILE & ADDRESS SETTINGS */}
              {activeTab === 'settings' && (
                <form onSubmit={handleUpdateSettings} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                        البريد الإلكتروني
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dir-ltr text-right"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                        رقم الهاتف الأساسي
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={e => setEditPhone(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dir-ltr text-right"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                        المحافظة
                      </label>
                      <input
                        type="text"
                        value={editGovernorate}
                        onChange={e => setEditGovernorate(e.target.value)}
                        placeholder="القاهرة / الجيزة..."
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                        هاتف بديل (اختياري)
                      </label>
                      <input
                        type="tel"
                        value={editPhone2}
                        onChange={e => setEditPhone2(e.target.value)}
                        placeholder="01xxxxxxxxx"
                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dir-ltr text-right"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                      العنوان الافتراضي للشحن
                    </label>
                    <textarea
                      rows={2}
                      value={editAddress}
                      onChange={e => setEditAddress(e.target.value)}
                      placeholder="الشارع، رقم المبنى، علامة مميزة..."
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                      رمز المرور السري للحساب (PIN)
                    </label>
                    <input
                      type="password"
                      value={editPin}
                      onChange={e => setEditPin(e.target.value)}
                      placeholder="••••"
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                  >
                    <Save size={16} />
                    <span>حفظ التعديلات في الملف الشخصي</span>
                  </button>
                </form>
              )}

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>تسجيل الخروج</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black hover:opacity-90 transition-opacity cursor-pointer"
                >
                  متابعة التسوق
                </button>
              </div>
            </div>
          )}

          {/* --- VIEW 2: LOGIN --- */}
          {mode === 'login' && (
            <div className="mt-6 space-y-5">
              {/* Login Method Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => { setLoginMethod('email_otp'); resetOtpFlow(); }}
                  className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    loginMethod === 'email_otp'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Mail size={15} />
                  <span>رمز OTP بالإيميل ⚡</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setLoginMethod('phone_pin'); resetOtpFlow(); }}
                  className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    loginMethod === 'phone_pin'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Phone size={15} />
                  <span>الهاتف و PIN</span>
                </button>
              </div>

              {/* METHOD 1: EMAIL OTP (Default & Secure) */}
              {loginMethod === 'email_otp' && (
                <form onSubmit={handleEmailOtpLogin} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                      البريد الإلكتروني المسجل
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        disabled={isOtpSent}
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your-name@example.com"
                        className="w-full p-3.5 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dir-ltr text-right disabled:opacity-70"
                      />
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    </div>
                  </div>

                  {/* OTP Code Input (when OTP sent) */}
                  {isOtpSent && (
                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                          رمز التحقق الأمني (6 أرقام)
                        </label>
                        <button
                          type="button"
                          onClick={resetOtpFlow}
                          className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                        >
                          تغيير الإيميل
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          maxLength={6}
                          autoFocus
                          required
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="• • • • • •"
                          className="w-full p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500/60 rounded-2xl text-center text-xl font-mono font-black tracking-[0.5em] focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-400 text-[11px]">
                          تفقد صندوق الوارد أو البريد غير الهام (Junk/Spam)
                        </span>

                        {otpCooldown > 0 ? (
                          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                            <Clock size={12} />
                            <span>إعادة الإرسال بعد {otpCooldown}ث</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendOtp(email, '')}
                            disabled={isSendingOtp}
                            className="text-[11px] font-black text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw size={12} className={isSendingOtp ? "animate-spin" : ""} />
                            <span>إعادة إرسال الرمز</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSendingOtp || isVerifyingOtp}
                    className="w-full py-4 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>جاري إرسال رمز OTP...</span>
                      </>
                    ) : isVerifyingOtp ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>جاري التحقق والدخول...</span>
                      </>
                    ) : isOtpSent ? (
                      <>
                        <ShieldCheck size={18} />
                        <span>تأكيد الرمز ودخول حسابي 🚀</span>
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        <span>إرسال رمز التحقق OTP إلى البريد 📨</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* METHOD 2: PHONE & PIN */}
              {loginMethod === 'phone_pin' && (
                <form onSubmit={handlePhoneLogin} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                      رقم الهاتف المسجل
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="01012345678"
                        className="w-full p-3.5 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dir-ltr text-right"
                      />
                      <Phone size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block flex items-center justify-between">
                      <span>رمز المرور / PIN (اختياري)</span>
                      <span className="text-[10px] text-slate-400 font-normal">إذا قمت بتعيين رمز مسبقاً</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••"
                        className="w-full p-3.5 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  >
                    تسجيل الدخول ومتابعة طلباتي
                  </button>
                </form>
              )}

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  ليس لديك حساب بعد؟{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); resetOtpFlow(); setError(''); }}
                    className="font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    إنشاء حساب جديد الآن ✨
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* --- VIEW 3: REGISTER WITH EMAIL OTP --- */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterWithOtp} className="mt-6 space-y-4">
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Sparkles size={16} className="shrink-0 text-emerald-600" />
                <span>أنشئ حسابك وأكده برمز OTP للإيميل للحصول على 100 نقطة ولاء ومتابعة شحناتك بسهولة!</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  الاسم بالكامل
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="محمد أحمد"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    البريد الإلكتروني (لتأكيد OTP)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      disabled={isOtpSent}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full p-3.5 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dir-ltr text-right disabled:opacity-75"
                    />
                    <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    رقم الهاتف (للتوصيل)
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full p-3.5 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dir-ltr text-right"
                    />
                    <Phone size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    المحافظة
                  </label>
                  <input
                    type="text"
                    value={governorate}
                    onChange={e => setGovernorate(e.target.value)}
                    placeholder="القاهرة / الجيزة"
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    العنوان التفصيلي
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="الشارع، رقم العمارة"
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* OTP Code Step for registration */}
              {isOtpSent && (
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-500/50 rounded-2xl space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                      أدخل رمز التحقق (OTP) المرسل إلى بريدك:
                    </span>
                    {otpCooldown > 0 ? (
                      <span className="text-[11px] font-mono text-slate-400">إعادة إرسال بعد {otpCooldown}ث</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp(email, name)}
                        disabled={isSendingOtp}
                        className="text-[11px] font-black text-emerald-600 hover:underline"
                      >
                        إعادة الإرسال
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-xl text-center text-lg font-mono font-black tracking-[0.4em] outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingOtp || isVerifyingOtp}
                className="w-full py-4 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                style={{ backgroundColor: primaryColor }}
              >
                {isSendingOtp ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>جاري إرسال رمز التحقق...</span>
                  </>
                ) : isVerifyingOtp ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>جاري تأكيد الرمز وإنشاء الحساب...</span>
                  </>
                ) : isOtpSent ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>تأكيد الإيميل وتفعيل الحساب 🎁</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>إرسال رمز OTP لتأكيد الحساب 📨</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  لديك حساب بالفعل؟{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); resetOtpFlow(); setError(''); }}
                    className="font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </p>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
