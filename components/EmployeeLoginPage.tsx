import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building, 
  Phone, 
  KeyRound, 
  Loader2, 
  UserPlus, 
  User as UserIcon, 
  CheckCircle, 
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  Store,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  HelpCircle,
  X,
  PackageCheck,
  Truck,
  Headphones,
  Boxes,
  Shield,
  Activity,
  ArrowRight,
  Radio,
  FileCheck2,
  Lock,
  Copy,
  Check,
  Send,
  MailCheck,
  Crown,
  Briefcase
} from 'lucide-react';
import { User, StoreData } from '../types';

interface EmployeeRegisterRequestData {
  fullName: string;
  phone: string;
  password: string;
  storeId: string;
  email: string;
}

interface EmployeeLoginPageProps {
  onLoginAttempt: (data: { storeId: string; phone: string; password: string }) => Promise<void>;
  onRegisterRequest: (data: EmployeeRegisterRequestData) => Promise<void>;
  allStoresData: Record<string, StoreData>;
  users: User[];
}

export const EmployeeLoginPage: React.FC<EmployeeLoginPageProps> = ({ 
  onLoginAttempt, 
  onRegisterRequest, 
  allStoresData, 
  users 
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'help' | 'success'>('login');
  
  // Available stores list
  const availableStores = useMemo(() => {
    return Object.entries(allStoresData || {}).map(([id, data]) => ({
      id,
      name: data.settings?.storeName || data.name || id,
      orderCount: (data.orders || []).length,
      pendingCount: (data.orders || []).filter(o => ['جديد', 'قيد_المراجعة', 'معلق'].includes(o.status)).length
    }));
  }, [allStoresData]);

  // Selected Department / Role for interactive shift view
  const [selectedRole, setSelectedRole] = useState<'confirmation' | 'shipping' | 'support' | 'inventory'>('confirmation');

  // Live Clock state for operational shifts
  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Primary Portal Role Differentiation: الموظف vs مالك المتجر
  const [portalRole, setPortalRole] = useState<'employee' | 'owner'>('employee');

  // Login State
  const [loginStoreId, setLoginStoreId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const qStore = new URLSearchParams(window.location.search).get('storeId');
      if (qStore) return qStore.trim();
    }
    return localStorage.getItem('saved_employee_store_id') || '';
  });
  const [loginPhone, setLoginPhone] = useState<string>(() => {
    return localStorage.getItem('saved_employee_phone') || '';
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Store Code Recovery State (استرجاع كود المتجر عبر البريد الإلكتروني)
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<{
    success?: boolean;
    recipient?: string;
    message?: string;
    ownedCount?: number;
    employeeCount?: number;
    error?: string;
  } | null>(null);
  const [copiedStoreId, setCopiedStoreId] = useState<string | null>(null);

  // Employee Password Recovery State (استعادة كلمة مرور الموظف ذاتياً)
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetPhoneOrEmail, setResetPhoneOrEmail] = useState('');
  const [resetStoreId, setResetStoreId] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [resetStatus, setResetStatus] = useState<{
    success?: boolean;
    recipient?: string;
    message?: string;
    error?: string;
    noEmail?: boolean;
    employeeName?: string;
  } | null>(null);

  // Security Lockout (Brute-force protection)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    const raw = sessionStorage.getItem('emp_failed_attempts');
    return raw ? parseInt(raw, 10) : 0;
  });
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState<number>(0);

  // Registration State
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regStoreId, setRegStoreId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const qStore = new URLSearchParams(window.location.search).get('storeId');
      if (qStore) return qStore.trim();
    }
    return '';
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regError, setRegError] = useState('');

  // Lockout timer decrement
  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setLockoutSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSecondsLeft]);

  // Detected store info
  const activeStoreInfo = useMemo(() => {
    if (!loginStoreId.trim()) return null;
    const cleanId = loginStoreId.trim();
    const store = allStoresData[cleanId];
    if (store) {
      return {
        id: cleanId,
        name: store.settings?.storeName || store.name || cleanId,
        totalOrders: (store.orders || []).length,
        pendingOrders: (store.orders || []).filter(o => ['جديد', 'قيد_المراجعة', 'معلق'].includes(o.status)).length,
        employeesCount: (store.settings?.employees || []).length
      };
    }
    return null;
  }, [loginStoreId, allStoresData]);

  const passwordsMatch = Boolean(regPassword && regConfirmPassword && regPassword === regConfirmPassword);
  const passwordsMismatch = Boolean(regPassword && regConfirmPassword && regPassword !== regConfirmPassword);

  const handleRecoverStoreCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setRecoveryStatus({ error: 'يرجى إدخال عنوان بريد إلكتروني صالح لاسترجاع كود المتجر.' });
      return;
    }

    setIsRecovering(true);
    setRecoveryStatus(null);

    try {
      const res = await fetch('/api/recover-store-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          phone: recoveryPhone.trim()
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر إرسال كود المتجر، يرجى التحقق من صحة البريد وإعادة المحاولة.');
      }

      setRecoveryStatus({
        success: true,
        recipient: data.recipient || cleanEmail,
        message: data.note || `تم إرسال كود المتجر وتفاصيل الحساب بنجاح إلى البريد الإلكتروني (${data.recipient || cleanEmail}).`,
        ownedCount: data.ownedCount || 0,
        employeeCount: data.employeeCount || 0
      });
    } catch (err: any) {
      setRecoveryStatus({
        error: err.message || 'حدث خطأ في الاتصال بالخادم أثناء إرسال كود المتجر.'
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleCopyStoreCode = (storeId: string) => {
    navigator.clipboard.writeText(storeId);
    setCopiedStoreId(storeId);
    setTimeout(() => setCopiedStoreId(null), 2500);
  };

  const handleUseRecoveredStore = (storeId: string) => {
    setLoginStoreId(storeId);
    setShowRecoverModal(false);
    setActiveTab('login');
  };

  const openPasswordResetModal = () => {
    setResetPhoneOrEmail(loginPhone || '');
    setResetStoreId(loginStoreId || '');
    setResetOtpCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetStep(1);
    setResetStatus(null);
    setShowPasswordResetModal(true);
  };

  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPhoneOrEmail.trim()) {
      setResetStatus({ error: 'يرجى إدخال رقم الهاتف أو البريد الإلكتروني.' });
      return;
    }
    setIsResetSubmitting(true);
    setResetStatus(null);
    try {
      const res = await fetch('/api/employee-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneOrEmail: resetPhoneOrEmail.trim(),
          storeId: resetStoreId.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data.noEmail) {
          setResetStatus({
            noEmail: true,
            employeeName: data.employeeName,
            error: data.error || 'لا يوجد بريد إلكتروني مسجل لهذا الحساب.'
          });
        } else {
          setResetStatus({ error: data.error || 'فشل إرسال رمز التحقق. يرجى مراجعة البيانات المدخلة.' });
        }
        return;
      }
      setResetStatus({
        success: true,
        message: data.message,
        recipient: data.recipient,
        employeeName: data.employeeName
      });
      setResetStep(2);
    } catch (err: any) {
      setResetStatus({ error: err.message || 'حدث خطأ في الاتصال بالخادم.' });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOtpCode.trim()) {
      setResetStatus({ error: 'يرجى إدخال رمز التحقق المكون من 6 أرقام.' });
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetStatus({ error: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف أو أرقام على الأقل.' });
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetStatus({ error: 'كلمة المرور وتأكيد كلمة المرور غير متطابقين.' });
      return;
    }
    setIsResetSubmitting(true);
    try {
      const res = await fetch('/api/employee-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneOrEmail: resetPhoneOrEmail.trim(),
          resetCode: resetOtpCode.trim(),
          newPassword: resetNewPassword,
          storeId: resetStoreId.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setResetStatus({ error: data.error || 'فشل تعيين كلمة المرور الجديدة.' });
        return;
      }
      setResetStep(3);
      setLoginPassword(resetNewPassword);
      if (resetStoreId) setLoginStoreId(resetStoreId);
      if (resetPhoneOrEmail) setLoginPhone(resetPhoneOrEmail);
      setResetStatus({
        success: true,
        message: data.message || 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول مباشرة.'
      });
    } catch (err: any) {
      setResetStatus({ error: err.message || 'حدث خطأ أثناء حفظ كلمة المرور.' });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSecondsLeft > 0) return;

    setLoginError('');
    setIsLoading(true);

    try {
      await onLoginAttempt({
        storeId: loginStoreId.trim(),
        phone: loginPhone.trim(),
        password: loginPassword
      });

      sessionStorage.removeItem('emp_failed_attempts');
      setFailedAttempts(0);

      if (rememberMe) {
        localStorage.setItem('saved_employee_store_id', loginStoreId.trim());
        localStorage.setItem('saved_employee_phone', loginPhone.trim());
      } else {
        localStorage.removeItem('saved_employee_phone');
      }
    } catch (err: any) {
      console.error('Employee login error:', err);
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      sessionStorage.setItem('emp_failed_attempts', String(newAttempts));

      if (newAttempts >= 4) {
        setLockoutSecondsLeft(30);
      }

      const errorCode = err?.code || '';
      const errorMessage = err?.message || '';
      
      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorMessage.includes('invalid-credential') || errorMessage.includes('wrong-password')) {
        setLoginError('رقم الهاتف أو كلمة المرور غير صحيحة.');
      } else if (errorCode === 'auth/network-request-failed') {
        setLoginError('فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.');
      } else if (errorCode === 'auth/too-many-requests') {
        setLoginError('تمت محاولة تسجيل الدخول عدة مرات بشكل خاطئ. تم قفل الحساب مؤقتاً.');
      } else {
        setLoginError(errorMessage || 'حدث خطأ أثناء تسجيل الدخول.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setIsLoading(true);

    try {
      if (!regFullName.trim() || !regPhone.trim() || !regEmail.trim() || !regPassword.trim() || !regConfirmPassword.trim() || !regStoreId.trim()) {
        throw new Error('يرجى ملء كافة الحقول المطلوبة بما في ذلك تأكيد كلمة المرور.');
      }
      if (regPassword !== regConfirmPassword) {
        throw new Error('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      }
      if (regPassword.length < 8) { 
        throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.'); 
      }
      
      await onRegisterRequest({
        fullName: regFullName.trim(),
        phone: regPhone.trim(),
        password: regPassword,
        storeId: regStoreId.trim(),
        email: regEmail.trim().toLowerCase()
      });
      setActiveTab('success');
    } catch (err: any) {
      setRegError(err.message || 'حدث خطأ أثناء إرسال طلب الانضمام.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-11 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-bold';
  const fieldIconClass = 'pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400';

  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f8f4] text-slate-900 font-cairo select-none relative">
      <div className="relative isolate min-h-screen overflow-hidden">
        
        {/* Soft Ambient Diffuse Glows matching the exact design */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-1/3 h-96 w-96 rounded-full bg-lime-200/30 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/4 h-80 w-80 rounded-full bg-teal-100/30 blur-3xl" />

        {/* ======================================================== */}
        {/* 1. TOP HEADER & GLOBAL NAV                               */}
        {/* ======================================================== */}
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12 border-b border-slate-200/60 bg-white/40 backdrop-blur-md">
          <Link to="/owner-login" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Store size={21} />
            </span>
            <span>
              <strong className="block text-lg font-black tracking-tight text-slate-950">عبدو ميديا برايم</strong>
              <span className="block text-[11px] font-semibold text-slate-500">AbdoMedia Prime • مساحة طاقم العمليات والورديات</span>
            </span>
          </Link>

          {/* Center Tactical Status (Live Clock & System Health) */}
          <div className="hidden md:flex items-center gap-3 text-xs font-bold text-slate-600 bg-white/80 border border-slate-200/80 px-4 py-2 rounded-2xl shadow-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 font-black">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              الخادم نشط 100%
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5 font-mono text-slate-700">
              <Clock size={13} className="text-slate-400" />
              {currentTime || '00:00:00'}
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-[11px] text-slate-400">تشفير SSL 256-Bit</span>
          </div>

          {/* Left Action Buttons */}
          <div className="flex items-center gap-2">
            <Link
              to="/owner-login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 text-xs font-black shadow-md shadow-purple-600/20 transition active:scale-95 cursor-pointer"
            >
              <ShieldCheck size={16} />
              <span>دخول لوحة الإدارة (Admin)</span>
            </Link>
            <Link 
              to="/owner-login" 
              className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-emerald-700"
            >
              دخول المالك
            </Link>
          </div>
        </header>

        {/* ======================================================== */}
        {/* 2. MAIN REDESIGNED COCKPIT GRID (الرصة المطورة الجديدة)    */}
        {/* ======================================================== */}
        <main className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-8 lg:gap-14 px-5 py-8 sm:px-8 lg:grid-cols-[1.1fr_490px] lg:px-12">
          
          {/* ====================================================== */}
          {/* RIGHT / MAIN SIDE: OPERATIONS COCKPIT & LIVE STATS     */}
          {/* ====================================================== */}
          <section className="order-2 lg:order-1 space-y-7">
            
            {/* Header Kicker Badge */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>منظومة إدارة الورديات وتأكيد الطلبات الفورية</span>
                <span aria-hidden="true" className="text-emerald-300">·</span>
                <span className="text-emerald-600 font-mono text-[11px]">v2.6 Enterprise</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black leading-[1.2] tracking-tight text-slate-950">
                بوابة فريق العمليات، كل مهامك <span className="text-emerald-600">في شاشة واحدة.</span>
              </h1>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
                وصول مخصص وآمن لطاقم المتجر لتأكيد الطلبات، جدولة ومتابعة الشحنات مع شركات الشحن، والرد السريع على العملاء دون أي تعقيد.
              </p>
            </div>

            {/* Department / Shift Cockpit Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-700">
                <span>تحديد قسم العمل والوردية (Department Focus):</span>
                <span className="text-[11px] text-emerald-600 font-bold">صلاحيات مخصصة لكل موظف</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'confirmation', title: 'تأكيد الطلبات', desc: 'مراجعة وتأكيد العملاء', icon: PackageCheck, color: 'text-emerald-600' },
                  { id: 'shipping', title: 'الشحن والتوصيل', desc: 'بوليصات ومتابعة المناديب', icon: Truck, color: 'text-blue-600' },
                  { id: 'support', title: 'خدمة العملاء', desc: 'واتساب والدعم المباشر', icon: Headphones, color: 'text-purple-600' },
                  { id: 'inventory', title: 'المستودع والجرد', desc: 'المخزون وتجهيز الطرود', icon: Boxes, color: 'text-amber-600' }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = selectedRole === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedRole(item.id as any)}
                      className={`p-3.5 rounded-2xl text-right transition-all border cursor-pointer ${
                        isSelected 
                          ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                          : 'bg-white/70 border-slate-200/80 hover:bg-white hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${item.color}`} />
                      <strong className="block text-xs font-black text-slate-900">{item.title}</strong>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operational Role Clarity & Security Architecture Card (التمييز الواضح بين المالك والموظف) */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>منظومة التمييز الأمني والصلاحيات المعتمدة</span>
                </div>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-bold">
                  حماية وسرية مشفرة
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-xs text-amber-900">
                    <Crown size={15} className="text-amber-600" />
                    <span>مالك المتجر (Store Owner)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-semibold">
                    دخول مباشر برقم الموبايل دون الحاجة لأي كود متجر. يتيح التحكم الشامل في كافة الفروع، الخزائن المالية، وتعيين الموظفين.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-xs text-emerald-900">
                    <Briefcase size={15} className="text-emerald-600" />
                    <span>طاقم العمل (Staff & Employees)</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed font-semibold">
                    دخول مخصص بكود المتجر الممنوح له من الإدارة لمباشرة الوردية، تأكيد الطلبات، والشحن وفق الصلاحيات المحددة.
                  </p>
                </div>
              </div>
            </div>

            {/* Shift Rules & Operational Guidelines */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-xs">
                <span className="text-xs font-black text-emerald-600 block mb-1">01. توثيق الوردية</span>
                <p className="text-xs font-bold text-slate-700 leading-normal">
                  تسجيل حركات التأكيد باسم كل موظف بدقة لضمان المكافآت والعمولات.
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-xs">
                <span className="text-xs font-black text-emerald-600 block mb-1">02. تحديثات واتساب</span>
                <p className="text-xs font-bold text-slate-700 leading-normal">
                  إرسال فوري لتأكيدات الشحن وتحديثات التتبع مع العملاء بروابط حية.
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-xs">
                <span className="text-xs font-black text-emerald-600 block mb-1">03. أمان وحماية</span>
                <p className="text-xs font-bold text-slate-700 leading-normal">
                  تشفير بيانات العملاء وحماية الخصوصية عبر بيئة Firebase الآمنة.
                </p>
              </div>
            </div>

          </section>

          {/* ====================================================== */}
          {/* LEFT / CONSOLE SIDE: THE HIGH-SECURITY LOGIN CARD      */}
          {/* ====================================================== */}
          <section className="order-1 lg:order-2">
            <div className="rounded-[2.5rem] border border-white bg-white/95 p-6 sm:p-9 shadow-[0_24px_70px_rgba(23,60,45,0.12)] relative overflow-hidden transition-all">
              
              {/* SUCCESS VIEW */}
              {activeTab === 'success' ? (
                <div className="animate-in fade-in duration-300 text-center py-4 space-y-5">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/30">
                    <CheckCircle size={36} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">تم إرسال طلبك بنجاح!</h2>
                    <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-xs mx-auto">
                      سيقوم مالك المتجر بمراجعة طلبك واعتماد صلاحياتك في لوحة العمليات فورياً.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('login')} 
                    className="w-full rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition active:scale-[.98] cursor-pointer text-sm"
                  >
                    العودة لصفحة الدخول
                  </button>
                </div>
              ) : (
                <>
                  {/* Primary User Role Switcher: التفريق التام بين الموظف ومالك المتجر */}
                  <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5 mb-5 border border-slate-200/80 shadow-xs" role="tablist">
                    <button
                      type="button"
                      onClick={() => setPortalRole('employee')}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        portalRole === 'employee'
                          ? 'bg-white text-emerald-950 shadow-sm border border-emerald-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Briefcase size={16} className={portalRole === 'employee' ? 'text-emerald-600' : 'text-slate-400'} />
                      <span>دخول طاقم العمل (الموظف)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPortalRole('owner')}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        portalRole === 'owner'
                          ? 'bg-white text-purple-950 shadow-sm border border-purple-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Crown size={16} className={portalRole === 'owner' ? 'text-purple-600' : 'text-slate-400'} />
                      <span>دخول مالك المتجر (المدير)</span>
                    </button>
                  </div>

                  {/* IF OWNER PORTAL SELECTED */}
                  {portalRole === 'owner' ? (
                    <div className="space-y-4 animate-in fade-in py-1">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 text-purple-950 space-y-2.5 text-right">
                        <div className="flex items-center gap-2 font-black text-sm text-purple-900">
                          <Crown size={18} className="text-purple-600" />
                          <span>بوابة مالك المتجر والمسؤول العام</span>
                        </div>
                        <p className="text-xs text-purple-800 leading-relaxed font-semibold">
                          بصفتك مالك المتجر، <strong>لست بحاجة إلى أي كود متجر</strong>. حسابك مرتبط مركزياً برقم هاتفك أو بريدك الإلكتروني لإدارة كافة متاجرك، تقارير المبيعات، الخزائن المالية، وتعيين الموظفين.
                        </p>
                        <div className="p-2.5 rounded-xl bg-white/90 border border-purple-200 text-[11px] text-purple-900 space-y-1 font-bold">
                          <div>👑 <strong>صلاحيات المالك:</strong> إدارة شاملة لكل الفروع بدون قيود ورديات.</div>
                          <div>🔒 <strong>الأمان:</strong> مصادقة مباشرة برقم الهاتف أو البريد المعتمد.</div>
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-2">
                        <Link
                          to="/owner-login"
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white py-3.5 font-black text-sm shadow-lg shadow-purple-600/25 transition active:scale-[.98] cursor-pointer"
                        >
                          <ShieldCheck size={18} />
                          <span>الانتقال لشاشة دخول المالك (Owner Portal)</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setPortalRole('employee')}
                          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs transition cursor-pointer"
                        >
                          العودة إلى دخول طاقم العمل (الموظف)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Top Segmented Tabs: تسجيل الدخول vs حساب جديد vs المساعدة */}
                      <div className="flex bg-slate-100 border border-slate-100 rounded-2xl p-1.5 mb-5" role="tablist">
                        <button 
                          type="button" 
                          role="tab" 
                          aria-selected={activeTab === 'login'} 
                          onClick={() => { setActiveTab('login'); setLoginError(''); }} 
                          className={activeTab === 'login' 
                            ? 'flex-1 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-900 shadow-sm cursor-pointer' 
                            : 'flex-1 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:text-slate-800 cursor-pointer'}
                        >
                          تسجيل الدخول
                        </button>
                        <button 
                          type="button" 
                          role="tab" 
                          aria-selected={activeTab === 'register'} 
                          onClick={() => { setActiveTab('register'); setRegError(''); }} 
                          className={activeTab === 'register' 
                            ? 'flex-1 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-900 shadow-sm cursor-pointer' 
                            : 'flex-1 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:text-slate-800 cursor-pointer'}
                        >
                          طلب انضمام
                        </button>
                        <button 
                          type="button" 
                          role="tab" 
                          aria-selected={activeTab === 'help'} 
                          onClick={() => setActiveTab('help')} 
                          className={activeTab === 'help' 
                            ? 'flex-1 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-900 shadow-sm cursor-pointer' 
                            : 'flex-1 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:text-slate-800 cursor-pointer'}
                        >
                          المساعدة
                        </button>
                      </div>

                      {/* Heading & Subtitle */}
                      <div className="mb-4">
                        <h2 className="text-2xl font-black text-slate-950">
                          {activeTab === 'login' ? 'دخول طاقم العمليات' : activeTab === 'register' ? 'طلب انضمام لطاقم المتجر' : 'دليل الأمان والمساعدة'}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500 leading-normal">
                          {activeTab === 'login' 
                            ? 'أدخل كود المتجر المسلم لك من الإدارة وبيانات الوردية لمباشرة المهام.' 
                            : activeTab === 'register' 
                            ? 'املأ بياناتك وسيتم إرسالها إلى لوحة المالك للموافقة.'
                            : 'إرشادات استرجاع كود المتجر والتواصل مع إدارة المتجر.'}
                        </p>
                      </div>

                      {/* Owner Switcher Reminder Notice */}
                      <div className="mb-4 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] font-bold text-amber-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Crown size={14} className="text-amber-600 shrink-0" />
                          <span>هل أنت صاحب المتجر؟</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPortalRole('owner')}
                          className="text-amber-800 hover:text-amber-950 underline font-black cursor-pointer text-[10px]"
                        >
                          ادخل هنا كمالك (بدون كود متجر) 👑
                        </button>
                      </div>

                      {/* Lockout Warning Banner */}
                      {lockoutSecondsLeft > 0 && (
                        <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                          <Clock size={16} className="text-rose-500 shrink-0 animate-spin" />
                          <span>
                            تم تفعيل حماية الأمان ضد المحاولات المتكررة. يرجى الانتظار <strong>{lockoutSecondsLeft}</strong> ثانية.
                          </span>
                        </div>
                      )}

                      {/* TAB 1: LOGIN FORM */}
                      {activeTab === 'login' && (
                        <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                          
                          {/* Store ID Input (Confidential & Clean) */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5 px-1">
                              <span className="text-[11px] font-bold text-slate-600">كود المتجر التابع له (خاص بالموظف):</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setRecoveryStatus(null);
                                  setShowRecoverModal(true);
                                }}
                                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer transition"
                              >
                                <Mail size={12} className="text-emerald-600" />
                                <span>استرجاع الكود بالإيميل</span>
                              </button>
                            </div>
                            <div className="relative">
                              <Building size={17} className={fieldIconClass} />
                              <input 
                                type="text" 
                                autoComplete="organization" 
                                placeholder="أدخل كود المتجر المسلم لك من الإدارة" 
                                required 
                                className={inputClass} 
                                value={loginStoreId} 
                                onChange={t => setLoginStoreId(t.target.value)} 
                              />
                            </div>
                          </div>

                          {/* Phone Input */}
                          <div>
                            <div className="relative">
                              <Phone size={17} className={fieldIconClass} />
                              <input 
                                type="text" 
                                autoComplete="username" 
                                placeholder="رقم الموبايل المسجل (010xxxxxxxx)" 
                                required 
                                className={inputClass} 
                                value={loginPhone} 
                                onChange={t => setLoginPhone(t.target.value)} 
                              />
                            </div>
                          </div>

                          {/* Password Input with Visibility Toggle */}
                          <div>
                            <div className="relative">
                              <KeyRound size={17} className={fieldIconClass} />
                              <input 
                                type={showPassword ? 'text' : 'password'} 
                                autoComplete="current-password" 
                                placeholder="كلمة المرور" 
                                required 
                                className={inputClass} 
                                value={loginPassword} 
                                onChange={t => setLoginPassword(t.target.value)} 
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                              >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          {/* Options: Remember & Forgot Password */}
                          <div className="flex items-center justify-between text-xs px-1 pt-0.5">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-semibold">
                              <input 
                                type="checkbox" 
                                checked={rememberMe} 
                                onChange={e => setRememberMe(e.target.checked)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>تذكر هذا الجهاز</span>
                            </label>

                            <button 
                              type="button" 
                              onClick={openPasswordResetModal} 
                              className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                            >
                              نسيت كلمة المرور؟
                            </button>
                          </div>

                          {/* Error message */}
                          {loginError && (
                            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">
                              {loginError}
                            </div>
                          )}

                          {/* Primary Green Action Button */}
                          <button 
                            type="submit" 
                            disabled={isLoading || lockoutSecondsLeft > 0} 
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition hover:-translate-y-0.5 active:scale-[.98] disabled:cursor-wait disabled:opacity-60 cursor-pointer text-sm"
                          >
                            {isLoading ? (
                              <Loader2 className="animate-spin" size={19} />
                            ) : (
                              <>
                                <LogIn size={18} />
                                <span>دخول آمن للوردية</span>
                              </>
                            )}
                          </button>

                          {/* Secondary Purple Admin Button */}
                          <button 
                            type="button" 
                            onClick={() => window.location.href = '/owner-login'} 
                            disabled={isLoading} 
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 py-3 font-black text-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            <ShieldCheck size={16} className="text-purple-600" />
                            <span>الدخول المباشر كمسؤول النظام (Admin Portal)</span>
                          </button>
                        </form>
                      )}
                    </>
                  )}

                  {/* TAB 2: REGISTRATION FORM */}
                  {activeTab === 'register' && (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                      <div className="relative">
                        <UserIcon size={17} className={fieldIconClass} />
                        <input 
                          type="text" 
                          placeholder="الاسم الكامل" 
                          required 
                          className={inputClass} 
                          value={regFullName} 
                          onChange={t => setRegFullName(t.target.value)} 
                        />
                      </div>

                      <div className="relative">
                        <Mail size={17} className={fieldIconClass} />
                        <input 
                          type="email" 
                          placeholder="البريد الإلكتروني" 
                          required 
                          className={inputClass} 
                          value={regEmail} 
                          onChange={t => setRegEmail(t.target.value)} 
                        />
                      </div>

                      <div className="relative">
                        <Phone size={17} className={fieldIconClass} />
                        <input 
                          type="tel" 
                          placeholder="رقم الموبايل للتسجيل" 
                          required 
                          className={inputClass} 
                          value={regPhone} 
                          onChange={t => setRegPhone(t.target.value)} 
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1 px-1">
                          <span className="text-[11px] font-bold text-slate-600">كود المتجر المطلوب:</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (regEmail && !recoveryEmail) setRecoveryEmail(regEmail);
                              setRecoveryStatus(null);
                              setShowRecoverModal(true);
                            }}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Mail size={11} className="text-emerald-600" />
                            <span>استرجاع كود المتجر بالإيميل</span>
                          </button>
                        </div>
                        <div className="relative">
                          <Building size={17} className={fieldIconClass} />
                          <input 
                            type="text" 
                            placeholder="أدخل كود المتجر المطلوب الانضمام له (من إدارة المتجر)" 
                            required 
                            className={inputClass} 
                            value={regStoreId} 
                            onChange={t => setRegStoreId(t.target.value)} 
                          />
                        </div>
                      </div>

                      <div className="relative">
                        <KeyRound size={17} className={fieldIconClass} />
                        <input 
                          type={showRegPassword ? 'text' : 'password'} 
                          placeholder="كلمة المرور (8 أحرف على الأقل)" 
                          required 
                          className={inputClass} 
                          value={regPassword} 
                          onChange={t => setRegPassword(t.target.value)} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="relative">
                          <KeyRound size={17} className={fieldIconClass} />
                          <input 
                            type={showRegConfirm ? 'text' : 'password'} 
                            placeholder="تأكيد كلمة المرور" 
                            required 
                            className={`${inputClass} ${passwordsMismatch ? 'border-rose-400' : ''} ${passwordsMatch ? 'border-emerald-500' : ''}`} 
                            value={regConfirmPassword} 
                            onChange={t => setRegConfirmPassword(t.target.value)} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirm(!showRegConfirm)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showRegConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {passwordsMatch && (
                          <p className="text-[11px] font-bold text-emerald-600 pr-2">✓ كلمتا المرور متطابقتان</p>
                        )}
                        {passwordsMismatch && (
                          <p className="text-[11px] font-bold text-rose-500 pr-2">✕ كلمتا المرور غير متطابقتين بعد</p>
                        )}
                      </div>

                      {regError && (
                        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">
                          {regError}
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={isLoading} 
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition active:scale-[.98] disabled:cursor-wait cursor-pointer text-sm"
                      >
                        {isLoading ? <Loader2 className="animate-spin" size={19} /> : <><UserPlus size={18} /><span>إرسال طلب الانضمام</span></>}
                      </button>
                    </form>
                  )}

                  {/* TAB 3: HELP & RECOVERY */}
                  {activeTab === 'help' && (
                    <div className="space-y-4 animate-in fade-in text-xs">
                      {/* Store Code Recovery By Email Box */}
                      <div className="p-4 rounded-2xl bg-white border border-emerald-300 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                          <strong className="font-black text-sm flex items-center gap-2 text-emerald-800">
                            <Mail size={16} className="text-emerald-600" />
                            <span>استرجاع كود المتجر عبر البريد الإلكتروني</span>
                          </strong>
                          <span className="text-[10px] bg-emerald-100/80 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                            بيوصلك ميل
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                          أدخل بريدك الإلكتروني المسجل، وسيقوم النظام بإرسال رسالة فورية إلى بريدك تحتوي على كود المتجر التعريفي وروابط الدخول المباشر.
                        </p>

                        <form onSubmit={handleRecoverStoreCode} className="space-y-2.5 pt-1">
                          <div className="relative">
                            <Mail size={16} className={fieldIconClass} />
                            <input
                              type="email"
                              placeholder="البريد الإلكتروني المسجل"
                              required
                              value={recoveryEmail}
                              onChange={e => setRecoveryEmail(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-10 py-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 font-bold"
                            />
                          </div>

                          <div className="relative">
                            <Phone size={16} className={fieldIconClass} />
                            <input
                              type="tel"
                              placeholder="رقم الموبايل (اختياري لتدقيق البحث)"
                              value={recoveryPhone}
                              onChange={e => setRecoveryPhone(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-10 py-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 font-bold"
                            />
                          </div>

                          {recoveryStatus?.error && (
                            <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold text-center">
                              {recoveryStatus.error}
                            </div>
                          )}

                          {recoveryStatus?.success && (
                            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2.5 text-right animate-in fade-in">
                              <div className="flex items-start gap-2 font-black text-xs text-emerald-800">
                                <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{recoveryStatus.message}</span>
                              </div>

                              <div className="p-2.5 rounded-lg bg-white/90 border border-emerald-200 text-[11px] text-slate-700 space-y-1.5 leading-relaxed">
                                <span className="font-bold block text-slate-900">
                                  ✉️ تفقد صندوق الوارد أو البريد غير المرغوب فيه (Spam):
                                </span>
                                <p className="text-[10px] text-slate-600">
                                  تتضمن الرسالة المرسلة لبريدك تصنيفاً شاملاً:
                                </p>
                                <div className="space-y-1 pr-1 font-semibold text-[10px]">
                                  <div className="text-amber-800 flex items-center gap-1">
                                    <span>👑</span>
                                    <span>المتاجر التي تملكها (بصفتك مالك المتجر - Store Owner).</span>
                                  </div>
                                  <div className="text-emerald-800 flex items-center gap-1">
                                    <span>💼</span>
                                    <span>المتاجر التي تعمل بها (بصفتك موظف معتمد - Employee).</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-[10px] font-bold text-amber-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200/80">
                                🔒 <strong>حماية وسرية:</strong> لحماية خصوصية بيانات المتاجر، تُرسل الأكواد حصرياً إلى بريدك المسجل ولا تظهر على الشاشات العامة.
                              </div>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isRecovering}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black text-xs shadow-md shadow-[#00c48c]/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                          >
                            {isRecovering ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <>
                                <Send size={14} />
                                <span>إرسال كود المتجر إلى بريدي الإلكتروني</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Password Recovery Guide & Direct Action */}
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 text-emerald-950 space-y-3">
                        <div className="flex items-center justify-between">
                          <strong className="block font-black text-sm flex items-center gap-2 text-emerald-900">
                            <KeyRound size={17} className="text-emerald-700" /> نسيان كلمة مرور الموظف (طريقتان فوريتان)
                          </strong>
                          <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded-full">خدمة آلية 24/7</span>
                        </div>
                        <p className="text-[11px] text-emerald-800 leading-relaxed font-semibold">
                          إذا نسيت كلمة المرور الخاصة بك كموظف، نوفر لك طريقتين فوريتين للعودة لعملك دون تعطيل:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                          <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80 space-y-1">
                            <span className="font-bold text-emerald-950 block">1️⃣ استعادة ذاتية فورية:</span>
                            <span className="text-slate-600 text-[10px] leading-tight block">يصلك رمز تحقق أمني (OTP) على بريدك الإلكتروني لتعيين كلمة مرور جديدة في ثوانٍ.</span>
                          </div>
                          <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80 space-y-1">
                            <span className="font-bold text-emerald-950 block">2️⃣ مساعدة مالك المتجر:</span>
                            <span className="text-slate-600 text-[10px] leading-tight block">يمكن لمالك أو مدير المتجر الدخول للوحة الموظفين وتعيين كلمة سر جديدة لك فوراً.</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openPasswordResetModal}
                          className="w-full py-2.5 px-4 rounded-xl bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black text-xs shadow-md shadow-[#00c48c]/20 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <KeyRound size={15} />
                          <span>فتح نافذة استعادة وتعيين كلمة المرور الآن</span>
                        </button>
                      </div>

                      {/* Store Code Definition & Role Distinction */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2">
                        <strong className="block font-black text-sm text-slate-900 flex items-center gap-1.5">
                          <Building size={15} className="text-slate-500" /> كود المتجر التعريفي (خاص بالموظفين فقط)
                        </strong>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                          كود المتجر هو المعرف الرقمي الممنوح للموظف من إدارة المتجر لربط حسابه بالوردية. إذا لم تكن تتذكره، يمكنك استخدام نموذج استرجاع الكود أعلاه ليصلك في رسالة بريد إلكتروني فورية.
                        </p>
                        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-950 font-bold space-y-1">
                          <div className="flex items-center gap-1 text-amber-900 font-black">
                            <Crown size={14} className="text-amber-600" />
                            <span>تنبيه هام لمالك المتجر:</span>
                          </div>
                          <p className="text-[10px] text-amber-800 leading-normal">
                            إذا كنت أنت صاحب المتجر أو المدير، فلست بحاجة لأي كود متجر. يمكنك الدخول مباشرة عبر <strong>بوابة مالك المتجر</strong> باستخدام هاتفك أو بريدك وإدارة كل فروعك دفعة واحدة.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('login')}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-black text-xs transition cursor-pointer"
                      >
                        العودة لشاشة الدخول
                      </button>
                    </div>
                  )}

                  {/* Bottom Switch Link */}
                  <p className="mt-6 text-center text-xs sm:text-sm text-slate-500">
                    {activeTab === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}{' '}
                    <button 
                      type="button" 
                      onClick={() => {
                        setActiveTab(activeTab === 'login' ? 'register' : 'login');
                        setLoginError('');
                        setRegError('');
                      }} 
                      className="font-black text-emerald-700 hover:underline cursor-pointer"
                    >
                      {activeTab === 'login' ? 'أنشئ حساباً جديداً' : 'سجّل الدخول الآن'}
                    </button>
                  </p>

                  {/* Security Footer Note */}
                  <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
                    <ShieldCheck size={15} className="text-emerald-600" />
                    <span>حماية وأمان مشفر عبر Firebase Cloud</span>
                  </div>
                </>
              )}

            </div>
          </section>

        </main>

        {/* ======================================================== */}
        {/* STORE CODE RECOVERY MODAL DIALOG (استرجاع كود المتجر)      */}
        {/* ======================================================== */}
        {showRecoverModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recover-store-modal-title"
          >
            <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
              {/* Modal Close Button */}
              <button
                type="button"
                onClick={() => setShowRecoverModal(false)}
                className="absolute left-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div className="text-right pr-1 space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  <MailCheck size={14} className="text-emerald-600" />
                  <span>خدمة استرجاع كود المتجر الآلية</span>
                </div>
                <h3 id="recover-store-modal-title" className="text-xl font-black text-slate-900 pt-1">
                  استرجاع كود المتجر عبر البريد الإلكتروني
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  أدخل بريدك الإلكتروني المسجل التابع لمتجرك، وسنرسل لك فورياً رسالة تحتوي على كود المتجر وروابط الدخول المباشر.
                </p>
              </div>

              {/* Modal Body */}
              {recoveryStatus?.success ? (
                <div className="space-y-4 animate-in fade-in py-1">
                  {/* Big Security Success Banner */}
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-right space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                        <MailCheck size={22} />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-emerald-950">
                          تم إرسال كود المتجر وتفاصيل الحساب بنجاح!
                        </h4>
                        <p className="text-xs text-emerald-800 font-semibold mt-1 leading-relaxed">
                          {recoveryStatus.message}
                        </p>
                      </div>
                    </div>

                    {/* Role differentiation explanation box */}
                    <div className="p-3.5 rounded-xl bg-white border border-emerald-200 text-xs text-slate-700 space-y-2 leading-relaxed">
                      <span className="font-black text-slate-900 block">
                        ✉️ ستجد في الرسالة الواردة تصنيفاً دقيقاً ومفصلاً:
                      </span>
                      <div className="space-y-1.5 text-[11px] pr-1">
                        <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-amber-950 flex items-start gap-2">
                          <span className="text-base">👑</span>
                          <div>
                            <strong className="block font-black text-amber-900">المتاجر التي تملكها (بصفتك مالك المتجر - Store Owner):</strong>
                            <span className="text-[10px] text-amber-800 font-semibold">مصحوبة بروابط الدخول المباشر للوحة تحكم المالك (Owner Portal) والإدارة الكاملة.</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 flex items-start gap-2">
                          <span className="text-base">💼</span>
                          <div>
                            <strong className="block font-black text-emerald-900">المتاجر التي تعمل بها (بصفتك موظف معتمد - Employee / Staff):</strong>
                            <span className="text-[10px] text-emerald-800 font-semibold">مصحوبة بكود المتجر المخصص للوردية ورابط الدخول الفوري للعمليات.</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Security Privacy Notice */}
                    <div className="text-[11px] font-bold text-slate-600 bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                      <Lock size={15} className="text-slate-500 shrink-0" />
                      <span>حفاظاً على أمان متجرك وسرية بياناتك، تُرسل الأكواد حصرياً للبريد المسجل ولا تظهر علناً على الشاشة.</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecoverModal(false);
                        setRecoveryStatus(null);
                      }}
                      className="w-full rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition active:scale-[.98] cursor-pointer text-sm"
                    >
                      حسناً، الانتقال لشاشة تسجيل الدخول
                    </button>

                    {recoveryEmail.includes('@gmail.com') && (
                      <a
                        href="https://mail.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline transition flex items-center justify-center gap-1.5"
                      >
                        <Mail size={14} />
                        <span>فتح بريد Gmail الآن لفحص الرسالة</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRecoverStoreCode} className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      البريد الإلكتروني المسجل:
                    </label>
                    <div className="relative">
                      <Mail size={17} className={fieldIconClass} />
                      <input
                        type="email"
                        autoFocus
                        required
                        placeholder="example@domain.com"
                        value={recoveryEmail}
                        onChange={e => setRecoveryEmail(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم الهاتف للتأكيد (اختياري):
                    </label>
                    <div className="relative">
                      <Phone size={17} className={fieldIconClass} />
                      <input
                        type="tel"
                        placeholder="010xxxxxxxx"
                        value={recoveryPhone}
                        onChange={e => setRecoveryPhone(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Error Alert */}
                  {recoveryStatus?.error && (
                    <div role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                      {recoveryStatus.error}
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={isRecovering}
                    className="w-full rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition active:scale-[.98] disabled:cursor-wait flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    {isRecovering ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        <span>إرسال كود المتجر إلى بريدي الإلكتروني</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRecoverModal(false)}
                    className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    إلغاء والعودة
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* EMPLOYEE PASSWORD RESET MODAL DIALOG (استعادة كلمة مرور الموظف) */}
        {/* ======================================================== */}
        {showPasswordResetModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-modal-title"
          >
            <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
              {/* Modal Close Button */}
              <button
                type="button"
                onClick={() => setShowPasswordResetModal(false)}
                className="absolute left-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div className="text-right pr-1 space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  <KeyRound size={14} className="text-emerald-600" />
                  <span>خدمة استعادة كلمة المرور الأوتوماتيكية</span>
                </div>
                <h3 id="reset-password-modal-title" className="text-xl font-black text-slate-900 pt-1">
                  استعادة وتعيين كلمة مرور الموظف
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {resetStep === 1 && 'أدخل بياناتك المسجلة لنرسل لك رمز تحقق أمني (OTP) على بريدك الإلكتروني لتعيين كلمة مرور جديدة فورياً.'}
                  {resetStep === 2 && 'أدخل رمز التحقق الأمني المكون من 6 أرقام وكلمة المرور الجديدة لإتمام التحديث.'}
                  {resetStep === 3 && 'تم تحديث كلمة المرور الخاصة بك بنجاح!'}
                </p>
              </div>

              {/* STEP 1: Phone / Email & Store ID input */}
              {resetStep === 1 && (
                <form onSubmit={handleSendResetOtp} className="space-y-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      كود المتجر (اختياري إذا مسجل مسبقاً):
                    </label>
                    <div className="relative">
                      <Building size={17} className={fieldIconClass} />
                      <input
                        type="text"
                        placeholder="مثال: store-0"
                        value={resetStoreId}
                        onChange={e => setResetStoreId(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم هاتفك أو بريدك الإلكتروني المسجل: <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={17} className={fieldIconClass} />
                      <input
                        type="text"
                        required
                        placeholder="أدخل رقم الهاتف أو البريد المسجل"
                        value={resetPhoneOrEmail}
                        onChange={e => setResetPhoneOrEmail(e.target.value)}
                        className={inputClass}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* If Account has No Email: Show Help Banner with WhatsApp to Store Owner */}
                  {resetStatus?.noEmail && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-right space-y-2.5 animate-in fade-in">
                      <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                        <AlertCircle size={16} className="text-amber-600" />
                        <span>حساب الموظف لا يحتوي على بريد مسجل</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed font-semibold">
                        يا {resetStatus.employeeName || 'عزيزنا الموظف'}، لا تقلق! يمكن لمالك أو مدير المتجر الدخول فوراً إلى لوحة التحكم (شاشة الموظفين) وتعيين كلمة مرور جديدة لك بضغطة زر واحدة.
                      </p>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`مرحباً يا مديرنا، نسيت كلمة المرور الخاصة بحسابي كموظف (${resetStatus.employeeName || resetPhoneOrEmail}). أرجو الدخول إلى لوحة فريق العمل وتعيين كلمة مرور جديدة لي.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        <span>مراسلة مدير المتجر عبر واتساب 💬</span>
                      </a>
                    </div>
                  )}

                  {/* Error Alert */}
                  {resetStatus?.error && !resetStatus?.noEmail && (
                    <div role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                      {resetStatus.error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isResetSubmitting}
                    className="w-full rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition active:scale-[.98] disabled:cursor-wait flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    {isResetSubmitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        <span>إرسال رمز التحقق (OTP) إلى بريدي</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPasswordResetModal(false)}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    إلغاء والعودة
                  </button>
                </form>
              )}

              {/* STEP 2: Enter OTP & New Password */}
              {resetStep === 2 && (
                <form onSubmit={handleConfirmResetPassword} className="space-y-4 pt-1">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-right space-y-1">
                    <span className="text-xs font-bold text-emerald-900 block">
                      📩 أرسلنا رمز التحقق إلى: <span className="font-mono text-emerald-700" dir="ltr">{resetStatus?.recipient}</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 block">
                      تفقد صندوق الوارد أو البريد غير المرغوب فيه (Spam). الرمز صالح لمدة 10 دقائق.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رمز التحقق الأمني المكون من 6 أرقام (PIN): <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="------"
                      value={resetOtpCode}
                      onChange={e => setResetOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[8px] font-mono font-black text-xl py-3 rounded-2xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      كلمة المرور الجديدة: <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={17} className={fieldIconClass} />
                      <input
                        type={showResetNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="6 أحرف أو أرقام على الأقل"
                        value={resetNewPassword}
                        onChange={e => setResetNewPassword(e.target.value)}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label="إظهار كلمة المرور"
                      >
                        {showResetNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      تأكيد كلمة المرور الجديدة: <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={17} className={fieldIconClass} />
                      <input
                        type={showResetNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="أعد إدخال كلمة المرور"
                        value={resetConfirmPassword}
                        onChange={e => setResetConfirmPassword(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Error Alert */}
                  {resetStatus?.error && (
                    <div role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                      {resetStatus.error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isResetSubmitting}
                    className="w-full rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition active:scale-[.98] disabled:cursor-wait flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    {isResetSubmitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={17} />
                        <span>تأكيد وتعيين كلمة المرور الجديدة</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      تغيير البريد أو الهاتف
                    </button>
                    <button
                      type="button"
                      onClick={handleSendResetOtp}
                      disabled={isResetSubmitting}
                      className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
                    >
                      إعادة إرسال الرمز
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Success Screen */}
              {resetStep === 3 && (
                <div className="space-y-4 py-2 text-center animate-in fade-in">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-slate-900">تم تحديث كلمة المرور بنجاح! 🎉</h4>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      تم حفظ كلمة المرور الجديدة لحسابك. تم تجهيز بيانات الدخول الخاصة بك ويمكنك الآن تسجيل الدخول مباشرة للوردية.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordResetModal(false);
                      setActiveTab('login');
                    }}
                    className="w-full rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition active:scale-[.98] flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <LogIn size={18} />
                    <span>تسجيل الدخول الآن للوردية</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default EmployeeLoginPage;
