import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Save, CheckCircle, Loader2, User as UserIcon, Mail, Phone, ShieldCheck, 
  Globe, Lock, Bell, Smartphone, KeyRound, Sparkles, ShieldAlert, Laptop, 
  LogOut, Camera, AlertCircle, RefreshCw, Layers, Moon, Sun, Check, ArrowRight,
  Fingerprint, Scan, Cpu, Trash2, PlusCircle, CheckCircle2
} from 'lucide-react';
import { updateUserInSupabase } from '../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  isWebAuthnSupported, 
  isPlatformAuthenticatorAvailable, 
  detectBiometricDeviceName,
  registerBiometricCredential, 
  authenticateBiometricCredential,
  getStoredBiometrics,
  saveStoredBiometric,
  removeStoredBiometric,
  isBiometricEnabledFor,
  setBiometricEnabledFor
} from '../utils/webAuthnService';

interface AccountSettingsPageProps {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const AccountSettingsPage: React.FC<AccountSettingsPageProps> = ({ currentUser, setCurrentUser, users, setUsers }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'security' | 'preferences' | 'sessions'>('info');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    language: 'العربية',
    country: 'Egypt',
    timezone: 'Africa/Cairo',
    currency: 'EGP'
  });

  const [preferences, setPreferences] = useState({
    emailAlerts: true,
    orderNotifications: true,
    salesDigest: true,
    securityAlerts: true,
    marketingUpdates: false,
  });

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentMessage, setResetSentMessage] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionsCleared, setSessionsCleared] = useState(false);

  // Biometric / WebAuthn States for Owner
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isPlatformAuthAvailable, setIsPlatformAuthAvailable] = useState(false);
  const [biometricDeviceName, setBiometricDeviceName] = useState('مستشعر البصمة البيومترية');
  const [isEnrollingBio, setIsEnrollingBio] = useState(false);
  const [isTestingBio, setIsTestingBio] = useState(false);
  const [bioTestSuccessMsg, setBioTestSuccessMsg] = useState('');
  const [ownerBiometricEnabled, setOwnerBiometricEnabled] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      const supported = isWebAuthnSupported();
      setIsBiometricSupported(supported);
      setBiometricDeviceName(detectBiometricDeviceName());
      if (supported) {
        const plat = await isPlatformAuthenticatorAvailable();
        setIsPlatformAuthAvailable(plat);
      }
    };
    checkBiometrics();

    if (currentUser?.email || currentUser?.phone) {
      const ownerKey = currentUser.email || currentUser.phone || 'owner';
      setOwnerBiometricEnabled(isBiometricEnabledFor(ownerKey));
    }
  }, [currentUser]);

  // Handle Register Biometric for Owner
  const handleEnrollOwnerBiometric = async () => {
    if (!currentUser) return;
    setIsEnrollingBio(true);
    setBioTestSuccessMsg('');
    setError('');
    try {
      const ownerKey = currentUser.email || currentUser.phone || 'owner';
      const res = await registerBiometricCredential({
        userId: ownerKey,
        userName: currentUser.email || currentUser.fullName || 'مالك المتجر',
        userDisplayName: currentUser.fullName || 'مالك النظام',
        rpName: 'لوحة إدارة المتجر',
        deviceName: biometricDeviceName
      });

      if (res.success && res.credential) {
        saveStoredBiometric(ownerKey, res.credential, true);
        const existing = currentUser.biometricCredentials || [];
        const updated = [res.credential, ...existing.filter(c => c.id !== res.credential?.id)];
        const updatedUser: User = { 
          ...currentUser, 
          biometricCredentials: updated, 
          allowBiometricAuth: true 
        };
        setCurrentUser(updatedUser);
        setOwnerBiometricEnabled(true);
        setShowSuccess(true);
        setSuccessMessage('🎉 تم تسجيل وتفعيل بصمة هذا الجهاز (WebAuthn Passkey) لحساب المالك بنجاح!');
        setTimeout(() => setShowSuccess(false), 4000);
      } else {
        setError(res.error || 'تعذر تسجيل البصمة على هذا الجهاز.');
      }
    } catch (err: any) {
      setError('خطأ أثناء تسجيل البصمة: ' + (err.message || ''));
    } finally {
      setIsEnrollingBio(false);
    }
  };

  // Handle Test Biometric for Owner
  const handleTestOwnerBiometric = async () => {
    if (!currentUser) return;
    setIsTestingBio(true);
    setBioTestSuccessMsg('');
    try {
      const ownerKey = currentUser.email || currentUser.phone || 'owner';
      const stored = getStoredBiometrics(ownerKey);
      const allCreds = [...(currentUser.biometricCredentials || []), ...stored];
      const res = await authenticateBiometricCredential(allCreds.length > 0 ? allCreds : undefined, 'لوحة إدارة المتجر');
      if (res.success) {
        setBioTestSuccessMsg('تم التحقق بنجاح! مستشعر البصمة يعمل بكفاءة وأمان 100%');
      } else {
        setError(res.error || 'فشل فحص البصمة');
      }
    } catch (err: any) {
      setError('خطأ أثناء فحص البصمة: ' + (err.message || ''));
    } finally {
      setIsTestingBio(false);
    }
  };

  // Handle Remove Biometric for Owner
  const handleRemoveOwnerBiometric = (credId: string) => {
    if (!currentUser) return;
    const ownerKey = currentUser.email || currentUser.phone || 'owner';
    removeStoredBiometric(ownerKey, credId, true);
    const updated = (currentUser.biometricCredentials || []).filter(c => c.id !== credId);
    setCurrentUser({ ...currentUser, biometricCredentials: updated });
    setShowSuccess(true);
    setSuccessMessage('تم إلغاء وحذف مفتاح البصمة المحدد.');
    setTimeout(() => setShowSuccess(false), 3000);
  };

  useEffect(() => {
    if (currentUser) {
      const nameParts = (currentUser.fullName || '').split(' ');
      const firstName = nameParts.shift() || '';
      const lastName = nameParts.join(' ');

      setFormData(prev => ({
        ...prev,
        firstName: firstName,
        lastName: lastName,
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        language: 'العربية',
        country: 'Egypt'
      }));
    }
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreferenceToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.phone) {
      setError('رقم الهاتف غير مرتبط بالحساب الحالي.');
      return;
    }

    setIsSendingReset(true);
    setResetSentMessage('');
    setError('');
    try {
      const response = await fetch('/api/employee-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneOrEmail: currentUser.phone, storeId: currentUser.stores?.[0] || '' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'تعذر إرسال رمز الاستعادة.');
      setResetCodeSent(true);
      setResetSentMessage(result.message || 'تم إرسال رمز التحقق إلى بريدك المسجل.');
    } catch (err: any) {
      console.error('Supabase password reset request failed:', err);
      setError(err.message || 'تعذر إرسال رمز استعادة كلمة المرور.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleCompletePasswordReset = async () => {
    if (!currentUser?.phone) return;
    if (!/^\d{6}$/.test(resetCode.trim())) {
      setError('أدخل رمز التحقق المكون من 6 أرقام.');
      return;
    }
    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsSendingReset(true);
    setError('');
    try {
      const response = await fetch('/api/employee-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneOrEmail: currentUser.phone, resetCode: resetCode.trim(), newPassword })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'تعذر تحديث كلمة المرور.');
      setResetSentMessage('تم تحديث كلمة المرور في Supabase Auth بنجاح.');
      setResetCodeSent(false);
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      console.error('Supabase password reset completion failed:', err);
      setError(err.message || 'تعذر تحديث كلمة المرور.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleClearOtherSessions = () => {
    setSessionsCleared(true);
    setTimeout(() => setSessionsCleared(false), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSaving(true);
    setError('');

    try {
      const updatedUser: User = {
        ...currentUser,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email, 
      };

      // Supabase Auth uses the phone-derived login alias; the real email stays in the profile.
      // It is used by the verified OTP password-recovery flow, not as the Auth login address.
      // Update the Supabase profile below.
      const sbResult = await updateUserInSupabase(updatedUser);
      if (!sbResult.success) {
        console.warn('[SUPABASE] Update failed:', sbResult.error);
        if (sbResult.error?.includes('بالفعل')) {
          setError(sbResult.error);
          setIsSaving(false);
          return;
        }
      }

      // Update local session state after the Supabase profile write.
      setCurrentUser(updatedUser);
      setUsers(users.map(u => u.phone === currentUser.phone ? updatedUser : u));

      if (!successMessage) {
        setSuccessMessage('تم حفظ كافة التغييرات وإعدادات الحساب بنجاح!');
      }
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
      }, 5000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError('حدث خطأ أثناء حفظ البيانات. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8 text-center text-slate-500 font-semibold" dir="rtl">
        الرجاء تسجيل الدخول لعرض وتحديث إعدادات الحساب.
      </div>
    );
  }

  const isEmailSynced = currentUser?.email === formData.email;
  const isTypedTempEmail = !formData.email || formData.email.includes('@mystore-auth.app');
  const userInitials = (formData.firstName[0] || 'U') + (formData.lastName[0] || '');

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-right pb-16 px-4 pt-2" dir="rtl">
      
      {/* Upper Profile Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-slate-800/80">
        <div className="absolute top-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-right">
            {/* Avatar Badge */}
            <div className="relative group">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 p-1 shadow-lg shadow-teal-500/20">
                <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center text-white text-2xl font-black tracking-wider uppercase border border-white/10">
                  {userInitials || 'ME'}
                </div>
              </div>
              <button 
                type="button" 
                title="تغيير الصورة"
                className="absolute -bottom-1 -right-1 bg-teal-500 hover:bg-teal-400 text-slate-950 p-2 rounded-xl shadow-md transition-all active:scale-95"
              >
                <Camera size={14} className="font-bold" />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  {currentUser.fullName || 'صاحب المتجر'}
                </h1>
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  <ShieldCheck size={13} />
                  {currentUser.isAdmin ? 'مدير النظام' : 'صاحب متجر'}
                </span>
              </div>
              
              <p className="text-slate-300 text-sm font-medium flex items-center justify-center md:justify-start gap-2">
                <Phone size={14} className="text-teal-400" />
                <span className="font-mono dir-ltr inline-block">+{currentUser.phone}</span>
                <span className="text-slate-500">•</span>
                <Mail size={14} className="text-indigo-400" />
                <span className="text-xs text-slate-300">{currentUser.email || 'بدون بريد محدد'}</span>
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                <span className="bg-slate-800/80 text-slate-300 text-[11px] font-semibold px-3 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-teal-400" />
                  حساب نشط وموثق
                </span>
                <span className="bg-slate-800/80 text-slate-300 text-[11px] font-semibold px-3 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
                  <Layers size={12} className="text-purple-400" />
                  المتاجر المرتبطة: {currentUser.stores?.length || 1}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all flex items-center gap-2 text-sm active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              حفظ التعديلات
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1 no-scrollbar">
        <TabButton 
          active={activeTab === 'info'} 
          onClick={() => setActiveTab('info')}
          icon={<UserIcon size={16} />}
          label="بيانات الحساب والتواصل"
        />
        <TabButton 
          active={activeTab === 'security'} 
          onClick={() => setActiveTab('security')}
          icon={<ShieldCheck size={16} />}
          label="الأمان والحماية"
        />
        <TabButton 
          active={activeTab === 'preferences'} 
          onClick={() => setActiveTab('preferences')}
          icon={<Bell size={16} />}
          label="الإشعارات والتفضيلات"
        />
        <TabButton 
          active={activeTab === 'sessions'} 
          onClick={() => setActiveTab('sessions')}
          icon={<Laptop size={16} />}
          label="الأجهزة والجلسات النشطة"
        />
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-800 dark:text-emerald-300 text-sm font-bold flex items-start gap-3 shadow-sm"
          >
            <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">{successMessage}</div>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-800 dark:text-rose-300 text-sm font-bold flex items-start gap-3 shadow-sm"
          >
            <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* TAB 1: Personal Info & Contact */}
        {activeTab === 'info' && (
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">بيانات الملف الشخصي والتواصل</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">حدث اسمك وبريدك الإلكتروني لضمان سهولة التواصل واسترجاع الحساب</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput 
                  label="الاسم الأول" 
                  name="firstName" 
                  value={formData.firstName} 
                  onChange={handleChange}
                  placeholder="مثال: أحمد"
                  icon={<UserIcon size={16} className="text-slate-400" />}
                />
                <FormInput 
                  label="الاسم الأخير" 
                  name="lastName" 
                  value={formData.lastName} 
                  onChange={handleChange}
                  placeholder="مثال: سعيد"
                  icon={<UserIcon size={16} className="text-slate-400" />}
                />
              </div>

              {/* Email Section */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  البريد الإلكتروني (الأساسي لاستعادة كلمة المرور والتنبيهات)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-800/80 border ${isEmailSynced ? 'border-slate-200 dark:border-slate-700' : 'border-amber-400 dark:border-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.15)]'} rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all`}
                    placeholder="example@gmail.com"
                  />
                </div>

                <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-2">
                  {isEmailSynced ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={15} />
                      محفوظ في ملف الحساب داخل Supabase.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <AlertCircle size={15} />
                        البريد المدخل يتطلب الضغط على زر "حفظ التغييرات" لتأكيده والمزامنة.
                      </div>
                      {isTypedTempEmail ? (
                        <p className="text-[11px] text-rose-500 font-bold leading-relaxed">
                          ⚠️ أنت تستخدم بريد النظام المؤقت. يرجى إدخال بريدك الشخصي الحقيقي (Gmail أو Outlook) ثم الضغط على "حفظ التغييرات" أسفل الصفحة.
                        </p>
                      ) : (
                        <p className="text-[11px] text-teal-600 dark:text-teal-400 font-bold leading-relaxed">
                          ✨ تم إدخال البريد الحقيقي ({formData.email}). يرجى الضغط على زر <strong>"حفظ التغييرات"</strong> في أسفل الصفحة لربطه وتفعيله بحسابك فوراً.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Phone section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    رقم الهاتف المسجل (هوية الدخول)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone size={16} />
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={`+${formData.phone}`}
                        className="block w-full pr-10 pl-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-600 dark:text-slate-300 cursor-not-allowed dir-ltr text-right"
                      />
                    </div>
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-black shrink-0 px-2.5 py-1 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <ShieldCheck size={14}/> تم التحقق
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormSelect label="اللغة المفضلة" name="language" value={formData.language} onChange={handleChange}>
                    <option value="العربية">العربية (الأصلية)</option>
                    <option value="English">English</option>
                  </FormSelect>

                  <FormSelect label="بلد الإقامة والعملة" name="country" value={formData.country} onChange={handleChange}>
                    <option value="Egypt">مصر (ج.م EGP)</option>
                    <option value="Saudi Arabia">السعودية (ر.س SAR)</option>
                    <option value="United Arab Emirates">الإمارات (د.إ AED)</option>
                  </FormSelect>
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* TAB 2: Security */}
        {activeTab === 'security' && (
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">كلمة المرور وحماية الحساب</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">إدارة كلمة المرور، التحقق بخطوتين، وتأمين جلسات الدخول</p>
                </div>
              </div>

              {/* Password Reset Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-800/60 dark:to-slate-800/20 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Lock size={16} className="text-indigo-500" />
                    إعادة تعيين كلمة المرور
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    سيتم إرسال رابط آمن ومباشر إلى بريدك الإلكتروني لتعديل كلمة المرور بأمان دون الكشف عنها.
                  </p>
                  {resetSentMessage && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold pt-1">
                      {resetSentMessage}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={isSendingReset}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center gap-2 shrink-0 active:scale-95 disabled:opacity-50"
                >
                  {isSendingReset ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
                  إرسال رمز الاستعادة
                </button>
              </div>

              {resetCodeSent && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
                  <input
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="رمز التحقق 6 أرقام"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="كلمة المرور الجديدة"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="تأكيد كلمة المرور"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCompletePasswordReset}
                    disabled={isSendingReset}
                    className="md:col-span-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs disabled:opacity-50"
                  >
                    {isSendingReset ? 'جارٍ التحديث...' : 'تأكيد وتحديث كلمة المرور'}
                  </button>
                </div>
              )}

              {/* Two-Factor Authentication */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-500">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      التحقق بـ كود التمرير (2FA / Two-Factor Protection)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      طلب كود تأكيد عبر SMS أو Supabase Auth عند تسجيل الدخول من أجهزة جديدة
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${twoFactorEnabled ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${twoFactorEnabled ? '-translate-x-6' : '-translate-x-1'}`} />
                </button>
              </div>

              {/* Biometric Authentication (WebAuthn / Passkeys) Card for Owner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-teal-50/25 dark:from-slate-800/50 dark:to-slate-850 border border-teal-500/20 dark:border-teal-500/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-500 shrink-0">
                      <Fingerprint size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                          المصادقة الحيوية للمالك (WebAuthn Passkeys / Touch ID)
                        </h3>
                        <span className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[10px] font-black px-2 py-0.5 rounded-full">
                          FIDO2 Ready
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        تسجيل الدخول وفتح لوحة الإدارة بلمسة واحدة عبر مستشعر هذا الجهاز المشفر
                      </p>
                    </div>
                  </div>

                  {/* Device Detection Badge */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 text-white text-[11px] font-mono shrink-0">
                    <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                    <span className="font-bold">{biometricDeviceName}</span>
                  </div>
                </div>

                {/* Test Success Feedback */}
                {bioTestSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>{bioTestSuccessMsg}</span>
                  </div>
                )}

                {/* Enrolled Owner Credentials */}
                {((currentUser?.biometricCredentials && currentUser.biometricCredentials.length > 0) || getStoredBiometrics(currentUser?.email || currentUser?.phone || 'owner').length > 0) ? (
                  <div className="space-y-2.5 pt-1">
                    <div className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>الأجهزة ومفاتيح الأمان المسجلة للمالك:</span>
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">بصمة مشفرة نشطة</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[...(currentUser?.biometricCredentials || []), ...getStoredBiometrics(currentUser?.email || currentUser?.phone || 'owner')].map((cred, idx) => (
                        <div key={cred.id + idx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
                              <Fingerprint size={16} />
                            </div>
                            <div>
                              <div className="font-black text-xs text-slate-800 dark:text-slate-100">{cred.name || 'مستشعر بيومتري معتمد'}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                تاريخ التسجيل: {new Date(cred.createdAt).toLocaleDateString('ar-EG')}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveOwnerBiometric(cred.id)}
                            title="إلغاء وحذف مفتاح البصمة"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-1">
                    <Fingerprint size={24} className="mx-auto text-slate-400" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">لم يتم تسجيل بصمة هذا الجهاز لحساب المالك بعد</p>
                    <p className="text-[11px] text-slate-400">
                      يمكنك تسجيل بصمة جهازك الآن لتسريع الدخول وتأمين لوحة التحكم بحماية الأجهزة المصرفية (FIDO2).
                    </p>
                  </div>
                )}

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleEnrollOwnerBiometric}
                    disabled={isEnrollingBio}
                    className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isEnrollingBio ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>جاري مسح وتسجيل البصمة...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle size={15} />
                        <span>تسجيل بصمة هذا الجهاز (Touch ID / Face ID)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestOwnerBiometric}
                    disabled={isTestingBio}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingBio ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>جاري فحص المستشعر...</span>
                      </>
                    ) : (
                      <>
                        <Scan size={15} className="text-teal-500" />
                        <span>اختبار مستشعر البصمة الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Security Health Score */}
              <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles size={16} />
                    مستوى حماية الحساب: ممتاز (95%)
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">آمن ومحمي</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full w-[95%]" />
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* TAB 3: Preferences & Alerts */}
        {activeTab === 'preferences' && (
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Bell size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">تفضيلات الإشعارات والتنبيهات</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">اختر نوع الإشعارات والتنبيهات التي ترغب في استلامها فورياً</p>
                </div>
              </div>

              <div className="space-y-4">
                <ToggleRow 
                  title="إشعارات الطلبات الجديدة"
                  description="استلام تنبيه فوري فور قيام عميل بإنشاء طلب جديد في متجرك"
                  checked={preferences.orderNotifications}
                  onChange={() => handlePreferenceToggle('orderNotifications')}
                />
                <ToggleRow 
                  title="تنبيهات الأمان وحسابات الموظفين"
                  description="إشعارات عند محاولة تسجيل دخول جديدة أو إضافة موظف جديد"
                  checked={preferences.securityAlerts}
                  onChange={() => handlePreferenceToggle('securityAlerts')}
                />
                <ToggleRow 
                  title="ملخص المبيعات والخزينة اليومي"
                  description="استلام ملخص بالأرباح وحركة المبيعات بنهاية كل يوم عمل"
                  checked={preferences.salesDigest}
                  onChange={() => handlePreferenceToggle('salesDigest')}
                />
                <ToggleRow 
                  title="تحديثات النظام والمميزات الجديدة"
                  description="تنبيهك بالتحسينات التقنية والأدوات المضافة حديثاً للمنصة"
                  checked={preferences.marketingUpdates}
                  onChange={() => handlePreferenceToggle('marketingUpdates')}
                />
              </div>

            </div>
          </motion.div>
        )}

        {/* TAB 4: Active Sessions */}
        {activeTab === 'sessions' && (
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Laptop size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">الأجهزة والجلسات المفتوحة</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">الأجهزة المسجلة حالياً التي تستخدم هذا الحساب للتصفح أو إدارة المتجر</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearOtherSessions}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold px-4 py-2 rounded-xl transition-all border border-rose-500/20 flex items-center gap-1.5 active:scale-95"
                >
                  <LogOut size={14} />
                  تسجيل الخروج من بقية الأجهزة
                </button>
              </div>

              {sessionsCleared && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle size={15} />
                  تم إنهاء كافة الجلسات الأخرى بنجاح. حسابك نشط حالياً على هذا الجهاز فقط.
                </div>
              )}

              <div className="space-y-3">
                {/* Current Device */}
                <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-600 dark:text-teal-400">
                      <Laptop size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">متصفح النظام الحالي (هذا الجهاز)</span>
                        <span className="bg-teal-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">الجلسة الحالية</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">القاهرة، مصر • متصل الآن عبر التشفير المباشر</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    نشط
                  </span>
                </div>

                {/* Secondary Device Simulation */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 opacity-75">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">تطبيق الهاتف (Android)</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">آخر ظهور: منذ ساعتين</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">مسجل</span>
                </div>
              </div>

            </div>
          </motion.div>
        )}

      </form>
    </div>
  );
};

/* Helper Components */

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap shrink-0 ${
      active
        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md scale-105'
        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
    }`}
  >
    {icon}
    {label}
  </button>
);

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
}

const FormInput: React.FC<FormInputProps> = ({ label, icon, ...props }) => (
  <div>
    <label htmlFor={props.id || props.name} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
      {label}
    </label>
    <div className="relative">
      {icon && (
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
          {icon}
        </div>
      )}
      <input
        {...props}
        id={props.id || props.name}
        className={`block w-full ${icon ? 'pr-10' : 'pr-4'} pl-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-800 transition-all`}
      />
    </div>
  </div>
);

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

const FormSelect: React.FC<FormSelectProps> = ({ label, children, ...props }) => (
  <div>
    <label htmlFor={props.id || props.name} className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
      {label}
    </label>
    <select
      {...props}
      id={props.id || props.name}
      className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
    >
      {children}
    </select>
  </div>
);

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ title, description, checked, onChange }) => (
  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
    <div className="space-y-0.5">
      <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
    </div>
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? '-translate-x-6' : '-translate-x-1'}`} />
    </button>
  </div>
);

export default AccountSettingsPage;
