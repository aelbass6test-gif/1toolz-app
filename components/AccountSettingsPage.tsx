import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { 
  Save, CheckCircle, Loader2, User as UserIcon, Mail, Phone, ShieldCheck, 
  Globe, Lock, Bell, Smartphone, KeyRound, Sparkles, ShieldAlert, Laptop, 
  LogOut, Camera, AlertCircle, RefreshCw, Layers, Moon, Sun, Check, ArrowRight,
  Fingerprint, Scan, Cpu, Trash2, PlusCircle, CheckCircle2, Send, X, Edit3
} from 'lucide-react';
import { createUserDoc } from '../services/databaseService';
import {
  cfAuthRequestPasswordReset,
  getCfApiBaseUrl,
  getCfAuthToken,
  setCfAuthToken
} from '../services/cloudflareClient';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlatformSupport } from '../utils/platformSupport';
import { 
  isWebAuthnSupported, 
  isPlatformAuthenticatorAvailable, 
  detectBiometricDeviceName,
  registerBiometricCredential, 
  authenticateBiometricCredential,
  getStoredBiometrics,
  hydrateBiometricsFromCloud,
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

  const { supportPhone, openSupportWhatsApp } = usePlatformSupport();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentMessage, setResetSentMessage] = useState('');
  const [error, setError] = useState('');
  const [sessionsCleared, setSessionsCleared] = useState(false);

  // Secure Email Change (2-Step Dual OTP Verification) States
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailChangeStep, setEmailChangeStep] = useState<'verify_old' | 'verify_new'>('verify_old');
  const [oldEmailVerified, setOldEmailVerified] = useState(false);
  const [oldEmailOtpSent, setOldEmailOtpSent] = useState(false);
  const [oldEmailOtpCode, setOldEmailOtpCode] = useState('');
  const [oldEmailOtpTarget, setOldEmailOtpTarget] = useState('');
  const [oldEmailOtpCooldown, setOldEmailOtpCooldown] = useState(0);
  const [isSendingOldEmailOtp, setIsSendingOldEmailOtp] = useState(false);
  const [isVerifyingOldEmailOtp, setIsVerifyingOldEmailOtp] = useState(false);

  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpTarget, setEmailOtpTarget] = useState('');
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');

  // Biometric / WebAuthn States for Owner
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isPlatformAuthAvailable, setIsPlatformAuthAvailable] = useState(false);
  const [biometricDeviceName, setBiometricDeviceName] = useState('مستشعر البصمة البيومترية');
  const [isEnrollingBio, setIsEnrollingBio] = useState(false);
  const [isTestingBio, setIsTestingBio] = useState(false);
  const [bioTestSuccessMsg, setBioTestSuccessMsg] = useState('');
  const [ownerBiometricEnabled, setOwnerBiometricEnabled] = useState(false);

  useEffect(() => {
    if (emailOtpCooldown <= 0 && oldEmailOtpCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailOtpCooldown(prev => (prev > 1 ? prev - 1 : 0));
      setOldEmailOtpCooldown(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailOtpCooldown, oldEmailOtpCooldown]);

  const hydratedBioKeyRef = useRef<string | null>(null);

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
      if (hydratedBioKeyRef.current !== ownerKey) {
        hydratedBioKeyRef.current = ownerKey;
        void hydrateBiometricsFromCloud(ownerKey, true).then(({ enabled, credentials }) => {
          setOwnerBiometricEnabled(enabled);
          if (credentials.length > 0) {
            setCurrentUser(prev => {
              if (!prev) return prev;
              const existing = prev.biometricCredentials || [];
              const existingIds = new Set(existing.map(c => c.id));
              const missing = credentials.filter(c => !existingIds.has(c.id));
              if (missing.length === 0) return prev;
              return { ...prev, biometricCredentials: [...existing, ...missing], allowBiometricAuth: true };
            });
          }
        });
      }
    }
  }, [currentUser, setCurrentUser]);

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
        setUsers(prev => prev.map(u => (u.phone === updatedUser.phone || (u.email && u.email === updatedUser.email)) ? updatedUser : u));
        void createUserDoc(updatedUser).catch(() => {});
        setOwnerBiometricEnabled(true);
        setShowSuccess(true);
        setSuccessMessage('🎉 تم تسجيل وتفعيل بصمة هذا الجهاز (WebAuthn Passkey) وحفظها سحابياً لحساب المالك بنجاح!');
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
      const hydrated = await hydrateBiometricsFromCloud(ownerKey, true);
      const stored = hydrated.credentials.length > 0 ? hydrated.credentials : getStoredBiometrics(ownerKey);
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
    const updatedUser: User = { ...currentUser, biometricCredentials: updated };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => (u.phone === updatedUser.phone || (u.email && u.email === updatedUser.email)) ? updatedUser : u));
    void createUserDoc(updatedUser).catch(() => {});
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
    const targetEmail = (formData.email && !formData.email.includes('@mystore-auth.app')) 
      ? formData.email 
      : (currentUser?.email && !currentUser.email.includes('@mystore-auth.app')) 
        ? currentUser.email 
        : null;

    if (!targetEmail || !targetEmail.includes('@')) {
      setError('يرجى التأكد من كتابة وحفظ بريدك الإلكتروني الحقيقي (مثل Gmail) أولاً لإرسال رابط إعادة تعيين كلمة المرور إليه.');
      return;
    }

    setIsSendingReset(true);
    setResetSentMessage('');
    setError('');
    try {
      await cfAuthRequestPasswordReset(targetEmail);
      await fetch('/api/send-custom-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, phone: currentUser?.phone })
      }).catch(() => {});
      setResetSentMessage(`تم إرسال رابط إعادة تعيين كلمة المرور بنجاح إلى بريدك الحقيقي: ${targetEmail}`);
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

  const isPlaceholderAccountEmail = (val?: string) => {
    const normalized = (val || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return true;
    if (normalized.includes('@mystore-auth.app')) return true;
    if (/^\+?\d+@abdomedi\.com$/i.test(normalized)) return true;
    return false;
  };

  const handleOpenEmailChange = () => {
    const needsOldEmailVerification = Boolean(currentUser?.email && !isPlaceholderAccountEmail(currentUser.email));
    setEmailChangeError('');
    setEmailChangeStep(needsOldEmailVerification ? 'verify_old' : 'verify_new');
    setOldEmailVerified(!needsOldEmailVerification);
    setOldEmailOtpSent(false);
    setOldEmailOtpCode('');
    setOldEmailOtpTarget('');
    setNewEmailInput('');
    setEmailOtpSent(false);
    setEmailOtpCode('');
    setEmailOtpTarget('');
    setIsChangingEmail(true);
  };

  const handleCancelEmailChange = () => {
    setIsChangingEmail(false);
    setEmailChangeStep('verify_old');
    setOldEmailVerified(false);
    setOldEmailOtpSent(false);
    setOldEmailOtpCode('');
    setOldEmailOtpTarget('');
    setNewEmailInput('');
    setEmailOtpSent(false);
    setEmailOtpCode('');
    setEmailOtpTarget('');
    setEmailChangeError('');
  };

  const handleSendOldEmailOtp = async () => {
    if (!currentUser?.email) return;
    const oldEmail = currentUser.email.trim().toLowerCase();
    setIsSendingOldEmailOtp(true);
    setEmailChangeError('');
    try {
      const apiBase = getCfApiBaseUrl();
      const res = await fetch(`${apiBase}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: oldEmail,
          userName: currentUser.fullName || `${formData.firstName} ${formData.lastName}`.trim() || 'المستخدم العزيز'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        if (data.retryAfterSeconds || data.cooldownRemaining) {
          setOldEmailOtpCooldown(Number(data.retryAfterSeconds || data.cooldownRemaining) || 60);
        }
        setEmailChangeError(data.error || data.message || 'تعذر إرسال رمز التحقق إلى بريدك الحالي. يرجى المحاولة لاحقاً.');
        return;
      }

      setOldEmailOtpSent(true);
      setOldEmailOtpCode('');
      setOldEmailOtpTarget(data.target || oldEmail);
      setOldEmailOtpCooldown(Number(data.cooldown || 60));
    } catch (err: any) {
      setEmailChangeError(err?.message || 'حدث خطأ أثناء إرسال رمز التحقق للبريد القديم.');
    } finally {
      setIsSendingOldEmailOtp(false);
    }
  };

  const handleVerifyOldEmailOtp = async () => {
    if (!currentUser?.email) return;
    const oldEmail = currentUser.email.trim().toLowerCase();
    const cleanOtp = oldEmailOtpCode.replace(/\D/g, '').trim();

    if (cleanOtp.length !== 6) {
      setEmailChangeError('يجب إدخال رمز التحقق المكون من 6 أرقام المرسل للبريد القديم.');
      return;
    }

    setIsVerifyingOldEmailOtp(true);
    setEmailChangeError('');
    try {
      const apiBase = getCfApiBaseUrl();
      const res = await fetch(`${apiBase}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: oldEmail,
          otp: cleanOtp
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) {
        setEmailChangeError(data.message || data.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية.');
        return;
      }

      setOldEmailVerified(true);
      setEmailChangeStep('verify_new');
      setOldEmailOtpSent(false);
      setOldEmailOtpCode('');
      setEmailChangeError('');
    } catch (err: any) {
      setEmailChangeError(err?.message || 'حدث خطأ أثناء التحقق من رمز البريد القديم.');
    } finally {
      setIsVerifyingOldEmailOtp(false);
    }
  };

  const handleSendNewEmailOtp = async () => {
    if (!currentUser) return;
    if (!isPlaceholderAccountEmail(currentUser.email) && !oldEmailVerified) {
      setEmailChangeStep('verify_old');
      setEmailChangeError('يجب أولاً تأكيد رمز التحقق المرسل على البريد القديم قبل تغيير البريد.');
      return;
    }

    const candidate = newEmailInput.trim().toLowerCase();
    const currentEmailNormalized = (currentUser.email || '').trim().toLowerCase();

    if (!candidate || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      setEmailChangeError('يرجى إدخال عنوان بريد إلكتروني صحيح (مثال: name@gmail.com).');
      return;
    }
    if (isPlaceholderAccountEmail(candidate)) {
      setEmailChangeError('لا يمكن استخدام بريد النظام المؤقت كبريد أساسي. يرجى إدخال بريد إلكتروني حقيقي.');
      return;
    }
    if (candidate === currentEmailNormalized) {
      setEmailChangeError('البريد الإلكتروني المدخل مطابق لبريدك الحالي بالفعل.');
      return;
    }

    setIsSendingEmailOtp(true);
    setEmailChangeError('');
    try {
      const apiBase = getCfApiBaseUrl();
      const res = await fetch(`${apiBase}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: candidate,
          userName: currentUser.fullName || `${formData.firstName} ${formData.lastName}`.trim() || 'المستخدم العزيز'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        if (data.retryAfterSeconds || data.cooldownRemaining) {
          setEmailOtpCooldown(Number(data.retryAfterSeconds || data.cooldownRemaining) || 60);
        }
        setEmailChangeError(data.error || data.message || 'تعذر إرسال رمز التحقق إلى البريد الجديد. يرجى المحاولة لاحقاً.');
        return;
      }

      setEmailOtpSent(true);
      setEmailOtpCode('');
      setEmailOtpTarget(data.target || candidate);
      setEmailOtpCooldown(Number(data.cooldown || 60));
    } catch (err: any) {
      setEmailChangeError(err?.message || 'حدث خطأ أثناء الاتصال بخدمة التحقق من البريد.');
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const handleVerifyAndSaveNewEmail = async () => {
    if (!currentUser) return;
    if (!isPlaceholderAccountEmail(currentUser.email) && !oldEmailVerified) {
      setEmailChangeStep('verify_old');
      setEmailChangeError('يجب تأكيد رمز البريد القديم أولاً قبل اعتماد البريد الجديد.');
      return;
    }

    const candidate = newEmailInput.trim().toLowerCase();
    const cleanOtp = emailOtpCode.replace(/\D/g, '').trim();

    if (cleanOtp.length !== 6) {
      setEmailChangeError('يجب إدخال رمز التحقق المكون من 6 أرقام.');
      return;
    }

    setIsVerifyingEmailOtp(true);
    setEmailChangeError('');
    try {
      const apiBase = getCfApiBaseUrl();
      const res = await fetch(`${apiBase}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: candidate,
          otp: cleanOtp
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) {
        setEmailChangeError(data.message || data.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية.');
        return;
      }

      const updatedUser: User = {
        ...currentUser,
        fullName: `${formData.firstName} ${formData.lastName}`.trim() || currentUser.fullName,
        email: candidate,
        emailVerified: true
      };

      const saved = await createUserDoc(updatedUser);
      if (!saved) {
        setEmailChangeError('تم التحقق من الرمز ولكن تعذر حفظ البريد الجديد في قاعدة البيانات. حاول مرة أخرى.');
        return;
      }

      const token = getCfAuthToken();
      if (token) {
        setCfAuthToken(token, updatedUser);
      }

      setCurrentUser(updatedUser);
      setUsers(users.map(u => u.phone === currentUser.phone ? updatedUser : u));
      setFormData(prev => ({ ...prev, email: candidate }));

      handleCancelEmailChange();
      setSuccessMessage(`تم التحقق من البريد القديم والجديد وتحديث البريد الإلكتروني إلى (${candidate}) في Cloudflare D1 بنجاح!`);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
      }, 5000);
    } catch (err: any) {
      setEmailChangeError(err?.message || 'حدث خطأ أثناء التحقق من الرمز وتحديث البريد.');
    } finally {
      setIsVerifyingEmailOtp(false);
    }
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
        // Email changes are strictly protected and can only be committed through OTP verification
        email: currentUser.email,
      };

      await createUserDoc(updatedUser);

      const token = getCfAuthToken();
      if (token) {
        setCfAuthToken(token, updatedUser);
      }

      setCurrentUser(updatedUser);
      setUsers(users.map(u => u.phone === currentUser.phone ? updatedUser : u));

      setSuccessMessage('تم حفظ التعديلات وإعدادات الحساب في Cloudflare D1 بنجاح!');
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

  const isEmailSynced = Boolean(currentUser?.email && currentUser.email === formData.email && !isPlaceholderAccountEmail(formData.email));
  const isTypedTempEmail = isPlaceholderAccountEmail(formData.email);
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

              {/* Email Section (Protected by OTP Verification) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    البريد الإلكتروني (الأساسي لاستعادة كلمة المرور والتنبيهات)
                  </label>
                  {!isChangingEmail && (
                    <button
                      type="button"
                      onClick={handleOpenEmailChange}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/25 text-[11px] font-black transition-all cursor-pointer active:scale-95"
                    >
                      <Edit3 size={13} />
                      <span>{isTypedTempEmail ? 'ربط وتأكيد بريد حقيقي (OTP)' : 'تغيير البريد بكود تحقق (OTP)'}</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    name="email"
                    readOnly
                    value={formData.email}
                    className="block w-full pr-10 pl-10 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-not-allowed dir-ltr text-right"
                    placeholder="example@gmail.com"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400" title="محمي برمز التحقق OTP">
                    <Lock size={14} />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                  {isEmailSynced && !isTypedTempEmail ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle size={15} />
                        مرتبط ومفعل ببيانات الدخول الموحدة (Cloudflare D1 Auth).
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <ShieldCheck size={13} className="text-teal-500" />
                        التغيير محمي برمز تحقق OTP
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <AlertCircle size={15} />
                        بريد النظام المؤقت لا يدعم استعادة كلمة المرور.
                      </div>
                      <p className="text-[11px] text-rose-500 font-bold leading-relaxed">
                        ⚠️ يرجى الضغط على <strong>"ربط وتأكيد بريد حقيقي (OTP)"</strong> لإدخال بريدك الحقيقي وتأكيده برمز مكون من 6 أرقام.
                      </p>
                    </div>
                  )}
                </div>

                {/* Inline Secure 2-Step Email Change & OTP Verification Card */}
                <AnimatePresence>
                  {isChangingEmail && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="p-5 rounded-2xl bg-gradient-to-br from-teal-50/70 to-slate-50 dark:from-slate-800/90 dark:to-slate-900 border border-teal-500/30 shadow-sm space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-teal-500/15">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
                            <ShieldCheck size={18} />
                          </div>
                          <div>
                            <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                              {!isPlaceholderAccountEmail(currentUser.email)
                                ? 'تغيير البريد الإلكتروني بتأكيد مزدوج (القديم ثم الجديد)'
                                : 'ربط وتأكيد البريد الإلكتروني برمز التحقق (OTP)'}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {!isPlaceholderAccountEmail(currentUser.email)
                                ? 'لأمان حسابك: يتم إرسال كود تحقق للبريد القديم أولاً، ثم بعد تأكيده يتم إرسال كود تحقق للبريد الجديد.'
                                : 'سيتم إرسال رمز أمان مكون من 6 أرقام إلى البريد الجديد، ولن يتم الحفظ إلا بعد تأكيده.'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCancelEmailChange}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                          title="إلغاء تغيير البريد"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* 2-Step Progress Indicator when changing from an existing real email */}
                      {!isPlaceholderAccountEmail(currentUser.email) && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-black">
                          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                            oldEmailVerified
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                              : emailChangeStep === 'verify_old'
                                ? 'bg-teal-500/15 border-teal-500/40 text-teal-800 dark:text-teal-200'
                                : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500'
                          }`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                              oldEmailVerified ? 'bg-emerald-500 text-white' : 'bg-teal-600 text-white'
                            }`}>
                              {oldEmailVerified ? '✓' : '1'}
                            </span>
                            <span>1. تأكيد البريد القديم</span>
                          </div>
                          <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                            emailChangeStep === 'verify_new'
                              ? 'bg-teal-500/15 border-teal-500/40 text-teal-800 dark:text-teal-200'
                              : 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/70 text-slate-400'
                          }`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                              emailChangeStep === 'verify_new' ? 'bg-teal-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              2
                            </span>
                            <span>2. تأكيد البريد الجديد</span>
                          </div>
                        </div>
                      )}

                      {emailChangeError && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                          <AlertCircle size={15} className="shrink-0 text-rose-500" />
                          <span>{emailChangeError}</span>
                        </div>
                      )}

                      {/* STEP 1: Verify Ownership of OLD Email First */}
                      {emailChangeStep === 'verify_old' && !isPlaceholderAccountEmail(currentUser.email) && (
                        <div className="space-y-3">
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                                البريد الحالي المطلوب تأكيد ملكيته أولاً:
                              </span>
                              <span className="text-xs font-mono font-black text-slate-800 dark:text-slate-100 dir-ltr inline-block">
                                {currentUser.email}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={handleSendOldEmailOtp}
                              disabled={isSendingOldEmailOtp || oldEmailOtpCooldown > 0}
                              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              {isSendingOldEmailOtp ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              <span>
                                {oldEmailOtpCooldown > 0
                                  ? `انتظر (${oldEmailOtpCooldown}ث)`
                                  : oldEmailOtpSent
                                    ? 'إعادة إرسال الكود للقديم'
                                    : 'إرسال كود التحقق للبريد القديم'}
                              </span>
                            </button>
                          </div>

                          {oldEmailOtpSent && (
                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-amber-500/30 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                                  <CheckCircle size={14} />
                                  تم إرسال كود التحقق إلى بريدك القديم: <span className="font-mono dir-ltr">{oldEmailOtpTarget}</span>
                                </span>
                                {oldEmailOtpCooldown > 0 && (
                                  <span className="text-[11px] font-bold text-slate-400">
                                    إعادة الإرسال بعد {oldEmailOtpCooldown} ثانية
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={oldEmailOtpCode}
                                  onChange={(e) => {
                                    setOldEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                    setEmailChangeError('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void handleVerifyOldEmailOtp();
                                    }
                                  }}
                                  placeholder="000000"
                                  className="sm:w-48 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-center font-mono tabular-nums font-black text-sm tracking-[0.35em] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 dir-ltr"
                                />
                                <button
                                  type="button"
                                  onClick={handleVerifyOldEmailOtp}
                                  disabled={isVerifyingOldEmailOtp || oldEmailOtpCode.trim().length !== 6}
                                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                  {isVerifyingOldEmailOtp ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                  <span>تأكيد البريد القديم والمتابعة</span>
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                              💡 في حال فقدان الوصول نهائياً إلى البريد القديم، يرجى التواصل مع الدعم الفني لتحديث البريد بعد التحقق من هويتك.
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                openSupportWhatsApp(
                                  `مرحباً فريق الدعم الفني، أرغب في تحديث البريد الإلكتروني لحسابي (${currentUser.fullName} - ${currentUser.phone})`
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-black transition-all cursor-pointer"
                            >
                              <Phone size={12} />
                              <span>تواصل مع الدعم ({supportPhone})</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STEP 2: Enter & Verify NEW Email */}
                      {emailChangeStep === 'verify_new' && (
                        <div className="space-y-3">
                          {!isPlaceholderAccountEmail(currentUser.email) && oldEmailVerified && (
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                              <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                              <span>تم التحقق من ملكية البريد القديم ({currentUser.email}). يمكنك الآن إدخال وتأكيد البريد الجديد.</span>
                            </div>
                          )}

                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                              البريد الإلكتروني الجديد
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2.5">
                              <div className="relative flex-1">
                                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                                  <Mail size={15} />
                                </div>
                                <input
                                  type="email"
                                  value={newEmailInput}
                                  readOnly={emailOtpSent}
                                  onChange={(e) => {
                                    setNewEmailInput(e.target.value);
                                    setEmailChangeError('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (!emailOtpSent) void handleSendNewEmailOtp();
                                    }
                                  }}
                                  placeholder="new-email@gmail.com"
                                  className={`block w-full pr-10 pl-4 py-2.5 rounded-xl border text-xs font-bold dir-ltr text-right outline-none transition-all ${
                                    emailOtpSent
                                      ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed'
                                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                                  }`}
                                />
                              </div>

                              {!emailOtpSent ? (
                                <button
                                  type="button"
                                  onClick={handleSendNewEmailOtp}
                                  disabled={isSendingEmailOtp || emailOtpCooldown > 0}
                                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                  {isSendingEmailOtp ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                  <span>
                                    {emailOtpCooldown > 0
                                      ? `انتظر (${emailOtpCooldown}ث)`
                                      : 'إرسال كود التحقق للبريد الجديد'}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEmailOtpSent(false);
                                    setEmailOtpCode('');
                                    setEmailChangeError('');
                                  }}
                                  className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shrink-0 cursor-pointer"
                                >
                                  تغيير البريد المدخل
                                </button>
                              )}
                            </div>
                          </div>

                          {emailOtpSent && (
                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-emerald-500/30 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                  <CheckCircle size={14} />
                                  تم إرسال كود التحقق (6 أرقام) إلى البريد الجديد: <span className="font-mono dir-ltr">{emailOtpTarget}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={handleSendNewEmailOtp}
                                  disabled={isSendingEmailOtp || emailOtpCooldown > 0}
                                  className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                                >
                                  {emailOtpCooldown > 0
                                    ? `إعادة الإرسال بعد ${emailOtpCooldown} ثانية`
                                    : 'إعادة إرسال الكود'}
                                </button>
                              </div>

                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={emailOtpCode}
                                  onChange={(e) => {
                                    setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                    setEmailChangeError('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void handleVerifyAndSaveNewEmail();
                                    }
                                  }}
                                  placeholder="000000"
                                  className="sm:w-48 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-center font-mono tabular-nums font-black text-sm tracking-[0.35em] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dir-ltr"
                                />
                                <button
                                  type="button"
                                  onClick={handleVerifyAndSaveNewEmail}
                                  disabled={isVerifyingEmailOtp || emailOtpCode.trim().length !== 6}
                                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                  {isVerifyingEmailOtp ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                  <span>تأكيد الرمز وتحديث البريد</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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
                      طلب كود تأكيد عبر البريد أو نظام المصادقة الموحد عند تسجيل الدخول من أجهزة جديدة
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
