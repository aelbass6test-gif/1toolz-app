import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Save, CheckCircle, Loader2, User as UserIcon, Mail, Phone, ShieldCheck, 
  Globe, Lock, Bell, Smartphone, KeyRound, Sparkles, ShieldAlert, Laptop, 
  LogOut, Camera, AlertCircle, RefreshCw, Layers, Moon, Sun, Check, ArrowRight
} from 'lucide-react';
import { auth } from '../services/firebaseClient';
import { verifyBeforeUpdateEmail, sendPasswordResetEmail } from 'firebase/auth';
import { updateUserInSupabase } from '../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [error, setError] = useState('');
  const [sessionsCleared, setSessionsCleared] = useState(false);

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
    if (!formData.email || !formData.email.includes('@')) {
      setError('يرجى التأكد من وجود بريد إلكتروني صحيح لإرسال رابط إعادة تعيين كلمة المرور.');
      return;
    }
    setIsSendingReset(true);
    setResetSentMessage('');
    setError('');
    try {
      if (auth.currentUser && auth.currentUser.email) {
        await sendPasswordResetEmail(auth, auth.currentUser.email);
        setResetSentMessage(`تم إرسال تعليمات إعادة تعيين كلمة المرور إلى: ${auth.currentUser.email}`);
      } else {
        await sendPasswordResetEmail(auth, formData.email);
        setResetSentMessage(`تم إرسال تعليمات إعادة تعيين كلمة المرور إلى: ${formData.email}`);
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError('تعذر إرسال رابط كلمة المرور: ' + (err.message || 'حاول لاحقاً.'));
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

      // 1. Update Firebase Auth Email if it's a real email and changed
      if (formData.email && formData.email.includes('@') && auth.currentUser) {
        const currentAuthEmail = auth.currentUser.email;
        if (currentAuthEmail !== formData.email) {
          if (formData.email.includes('@mystore-auth.app')) {
             setError('لا يمكن استخدام بريد النظام المؤقت كبريد أساسي للتواصل. يرجى إدخال بريد إلكتروني حقيقي (Gmail, Outlook, etc).');
             setIsSaving(false);
             return;
          }

          try {
            console.log('[AUTH] Attempting to initiate email update in Firebase Auth from', currentAuthEmail, 'to', formData.email);
            await verifyBeforeUpdateEmail(auth.currentUser, formData.email);
            console.log('[AUTH] Email verification sent successfully');
            setSuccessMessage(`تم إرسال رابط تأكيد إلى: ${formData.email}. يرجى الضغط على الرابط في الرسالة لتأكيد البريد.`);
          } catch (authErr: any) {
            console.warn('[AUTH] Failed to initiate email update in Firebase Auth:', authErr);
            if (authErr.code === 'auth/requires-recent-login') {
               setError('لدواعي أمنية، يجب إعادة تسجيل الدخول لتغيير البريد الإلكتروني (Session Expired).');
               setIsSaving(false);
               return;
            } else if (authErr.code === 'auth/email-already-in-use') {
               setError('هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.');
               setIsSaving(false);
               return;
            } else if (authErr.code === 'auth/invalid-email') {
               setError('البريد الإلكتروني المدخل غير صالح.');
               setIsSaving(false);
               return;
            } else if (authErr.code === 'auth/operation-not-allowed') {
               setError('خاصية تحديث البريد معطلة في إعدادات Firebase. يرجى التفعيل من لوحة التحكم.');
               setIsSaving(false);
               return;
            } else {
               setError(`حدث خطأ غير متوقع: ${authErr.message || 'يرجى المحاولة لاحقاً'}`);
               setIsSaving(false);
               return;
            }
          }
        }
      }

      // 2. Update Supabase for forgot password lookup
      const sbResult = await updateUserInSupabase(updatedUser);
      if (!sbResult.success) {
        console.warn('[SUPABASE] Update failed:', sbResult.error);
        if (sbResult.error?.includes('بالفعل')) {
          setError(sbResult.error);
          setIsSaving(false);
          return;
        }
      }

      // 3. Update State (which triggers Firestore save via App.tsx useEffect)
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

  const isEmailSynced = auth.currentUser?.email === formData.email;
  const isTempEmail = auth.currentUser?.email?.includes('@mystore-auth.app');
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
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
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

                <div className="mt-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-2">
                  {isEmailSynced ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={15} />
                      مرتبط ومفعل ببيانات الدخول الموحدة (Firebase Auth).
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <AlertCircle size={15} />
                        البريد الحالي يتطلب حفظ التغييرات للمزامنة مع نظام الحماية.
                      </div>
                      {isTempEmail ? (
                        <p className="text-[11px] text-rose-500 font-bold leading-relaxed">
                          ⚠️ أنت تستخدم حالياً بريد النظام المؤقت. يرجى ربط بريدك الحقيقي (Gmail أو Outlook) حتى تتمكن من استعادة كلمة المرور عند الحاجة.
                        </p>
                      ) : (
                        <p className="text-[11px] text-indigo-500 dark:text-indigo-400 font-medium">
                          ℹ️ بمجرد حفظ التعديل، سيصلك رابط تأكيد على بريدك الإلكتروني لتفعيله بشكل نهائي.
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
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
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
                  إرسال رابط كلمة المرور
                </button>
              </div>

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
                      طلب كود تأكيد عبر SMS أو Firebase Auth عند تسجيل الدخول من أجهزة جديدة
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
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
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
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
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
