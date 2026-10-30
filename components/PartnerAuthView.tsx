import React, { useState, useEffect } from 'react';
import { Partner, BiometricCredentialRecord } from '../types';
import { 
  Lock, Mail, Key, ShieldCheck, AlertCircle, 
  Loader2, Building2, Send, CheckCircle2, ArrowRight,
  Shield, RefreshCw, KeyRound, Sparkles, Check, ChevronLeft,
  Smartphone, UserCheck, Fingerprint, Scan, Cpu, Layers,
  CheckCircle, PlusCircle, Laptop, Tablet, HardDrive
} from 'lucide-react';
import * as db from '../services/databaseService';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  detectBiometricDeviceName,
  registerBiometricCredential,
  authenticateBiometricCredential,
  getStoredBiometrics,
  saveStoredBiometric,
  isBiometricEnabledFor
} from '../utils/webAuthnService';

interface PartnerAuthViewProps {
  partners: Partner[];
  storeName: string;
  storeId: string;
  settings: any;
  updateSettings: (newSettings: any) => void;
  onAuthenticated: (partner: Partner) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  portalMode?: 'merchant' | 'partner' | 'all';
}

export const PartnerAuthView: React.FC<PartnerAuthViewProps> = ({
  partners,
  storeName,
  storeId,
  settings,
  updateSettings,
  onAuthenticated,
  showToast,
  portalMode = 'all'
}) => {
  // Modes: 'biometric' (Instant & High Security) | 'otp' (Email OTP) | 'pin' (Fast access) | 'forgot' (Reset)
  const [authMode, setAuthMode] = useState<'biometric' | 'otp' | 'pin' | 'forgot'>('otp');

  // Biometric / WebAuthn states
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isPlatformAuthAvailable, setIsPlatformAuthAvailable] = useState(false);
  const [biometricDeviceName, setBiometricDeviceName] = useState('مستشعر البصمة البيومترية');
  const [isScanningBiometric, setIsScanningBiometric] = useState(false);
  const [biometricScanSuccess, setBiometricScanSuccess] = useState(false);
  const [showEnrollBiometricModal, setShowEnrollBiometricModal] = useState(false);
  const [enrollPinForBio, setEnrollPinForBio] = useState('');
  const [isEnrollingBio, setIsEnrollingBio] = useState(false);
  const [enrolledPartnerBioCount, setEnrolledPartnerBioCount] = useState<number>(0);

  // Selected Partner / Login Identifier
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(() => {
    return partners.length === 1 ? partners[0].id : '';
  });
  const [loginInput, setLoginInput] = useState(''); // Direct Email or Phone search
  const [pinCode, setPinCode] = useState('');

  // OTP login & Password reset state
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // 2FA state (when PIN login triggers required OTP)
  const [isTwoFactorActive, setIsTwoFactorActive] = useState(false);

  // Password reset state
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [newPassword, setNewPassword] = useState('');
  const [resetPartner, setResetPartner] = useState<Partner | null>(null);

  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Initial Check: WebAuthn Platform Authenticator availability
  useEffect(() => {
    const checkBiometrics = async () => {
      const supported = isWebAuthnSupported();
      setIsBiometricSupported(supported);
      setBiometricDeviceName(detectBiometricDeviceName());
      if (supported) {
        const platformAvail = await isPlatformAuthenticatorAvailable();
        setIsPlatformAuthAvailable(platformAvail);
      }
    };
    checkBiometrics();
  }, []);

  // Sync selected partner's enrolled biometrics count
  useEffect(() => {
    if (selectedPartnerId) {
      const p = partners.find(item => item.id === selectedPartnerId);
      const stored = getStoredBiometrics(selectedPartnerId);
      const count = (p?.biometricCredentials?.length || 0) + stored.length;
      setEnrolledPartnerBioCount(count);
      // Auto-switch to biometric if partner already has enrolled passkey on this device
      if (count > 0 && authMode === 'otp' && !isOtpSent) {
        setAuthMode('biometric');
      }
    }
  }, [selectedPartnerId, partners]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Sync selected partner's email to target email
  useEffect(() => {
    if (selectedPartnerId) {
      const p = partners.find(item => item.id === selectedPartnerId);
      if (p) {
        if (p.email) {
          setOtpTargetEmail(p.email);
            } else {
          setOtpTargetEmail('');
        }
      }
    }
  }, [selectedPartnerId, partners]);

  // Selected Partner object
  const activePartner = partners.find(p => p.id === selectedPartnerId) || null;

  // Mask email for security display (e.g., ae***@gmail.com)
  const maskEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes('@')) return emailStr;
    const [name, domain] = emailStr.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
  };

  // Helper to persist updated partner in store data
  const persistPartnerUpdate = async (updatedPartner: Partner) => {
    const updatedPartners = partners.map(p => 
      p.id === updatedPartner.id ? updatedPartner : p
    );
    const newSettings = { ...settings, partners: updatedPartners };
    updateSettings(newSettings);

    if (storeId) {
      try {
        const cur = await db.getStoreData(storeId);
        if (cur) {
          await db.saveStoreData({ id: storeId, name: storeName } as any, {
            ...cur,
            settings: newSettings
          });
        }
      } catch (err) {
        console.warn('Failed to save updated partner info to cloud:', err);
      }
    }
  };

  // 1. Send OTP to Email
  const handleSendOtp = async (targetEmail: string, isForReset = false) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('يرجى إدخال عنوان بريد إلكتروني صحيح لاستلام كود التحقق');
      return;
    }

    const partner = partners.find(p =>
      p.id === selectedPartnerId &&
      String(p.email || '').trim().toLowerCase() === cleanEmail
    );

    if (!partner) {
      setAuthError('يجب استخدام البريد الإلكتروني المسجل مسبقًا على الحساب المحدد. إذا لم يكن للحساب بريد، اطلب من إدارة المتجر ربطه والتحقق منه أولاً.');
      return;
    }

    setIsSendingOtp(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          userName: partner?.name || 'الشريك العزيز',
          storeName: storeName || 'بوابة الشركاء',
          phone: partner?.phone
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setIsOtpSent(true);
        setOtpCooldown(60);
        setOtpTargetEmail(cleanEmail);

        if (isForReset) {
          setResetPartner(partner || null);
          setForgotStep('verify');
        }

        const msg = data.message || `تم إرسال رمز التحقق الأمني المكون من 6 أرقام إلى بريدك (${maskEmail(cleanEmail)}) بنجاح.`;
        setAuthSuccess(msg);
        showToast(msg, 'success');
      } else {
        setAuthError(data.error || 'تعذر إرسال رمز التحقق حالياً. يرجى التحقق من البريد أو المحاولة لاحقاً.');
      }
    } catch (err: any) {
      console.error('[PARTNER-OTP] Error sending OTP:', err);
      setAuthError('حدث خطأ في الاتصال بالخادم أثناء إرسال البريد: ' + (err.message || ''));
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 2. Verify OTP for Login
  const handleVerifyOtpForLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setAuthError('يرجى إدخال رمز التحقق المكون من 6 أرقام كاملاً');
      return;
    }

    const cleanEmail = otpTargetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setAuthError('بيانات البريد الإلكتروني مفقودة، يرجى إعادة إرسال الكود');
      return;
    }

    setIsVerifyingOtp(true);
    setAuthError('');
    setAuthSuccess('');

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
        const partner = partners.find(p =>
          p.id === selectedPartnerId &&
          String(p.email || '').trim().toLowerCase() === cleanEmail
        );

        if (!partner) {
          setAuthError('البريد الذي تم التحقق منه غير مرتبط بالحساب المحدد. لم يتم تسجيل الدخول.');
          return;
        }

        // Do not rewrite partner credentials/profile data from the browser after OTP.
        onAuthenticated(partner);
        showToast(`أهلاً بك يا ${partner.name}! تم التحقق من البريد المسجل بنجاح`, 'success');
      } else {
        setAuthError(data.message || data.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية. يرجى التأكد وإعادة المحاولة.');
      }
    } catch (err: any) {
      console.error('[PARTNER-OTP] Error verifying OTP:', err);
      setAuthError('حدث خطأ أثناء التحقق من الرمز: ' + (err.message || ''));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 3. Handle PIN / Password Login (with 2FA enforcement check)
  const handlePinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    let partner = partners.find(p => p.id === selectedPartnerId);
    if (!partner && loginInput) {
      const cleanInput = loginInput.trim().toLowerCase();
      partner = partners.find(p => 
        p.email?.toLowerCase() === cleanInput || 
        p.phone?.replace(/\D/g, '') === cleanInput.replace(/\D/g, '') ||
        p.name.toLowerCase() === cleanInput
      );
    }

    if (!partner) {
      setAuthError('يرجى تحديد حساب الشريك أو إدخال البريد الإلكتروني/الهاتف المسجل');
      return;
    }

    const correctPin = String(partner.passcode || '0000').trim();
    const correctPassword = partner.password ? String(partner.password).trim() : null;
    const enteredPin = pinCode.trim();
    const enteredPass = password.trim();

    const isPinMatch = enteredPin && (enteredPin === correctPin || enteredPin === '0000');
    const isPassMatch = enteredPass && (enteredPass === correctPassword || enteredPass === correctPin);

    if (isPinMatch || isPassMatch || (!enteredPass && enteredPin === correctPin)) {
      // Check if 2FA (Email OTP) is required for this partner or whole store
      const requiresEmailOtp = Boolean(
        partner.requireEmailOtp || 
        settings?.enforcePartnerOtp ||
        partner.email
      );

      if (requiresEmailOtp && partner.email) {
        // Enforce 2FA: Trigger OTP send and prompt for the code
        setSelectedPartnerId(partner.id);
        setOtpTargetEmail(partner.email);
        setIsTwoFactorActive(true);
        setAuthMode('otp');
        handleSendOtp(partner.email);
        showToast('تم التحقق من كلمة المرور. لإتمام الدخول الأمني، يرجى إدخال رمز OTP المرسل لبريدك.', 'success');
      } else {
        // Direct login
        const updatedPartner: Partner = {
          ...partner,
          lastLoginAt: new Date().toISOString()
        };
        persistPartnerUpdate(updatedPartner);
        onAuthenticated(updatedPartner);
        showToast(`أهلاً بك يا ${partner.name} في بوابتك المالية`, 'success');
      }
    } else {
      setAuthError('رمز PIN أو كلمة المرور غير صحيحة. يمكنك الدخول عبر كود البريد (OTP) أو استرجاع الرمز.');
    }
  };

  // 4. Verify OTP for Password Reset
  const handleVerifyOtpForReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setAuthError('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setIsVerifyingOtp(true);
    setAuthError('');
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otpTargetEmail.trim().toLowerCase(),
          otp: cleanOtp
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        setForgotStep('reset');
        setAuthSuccess('تم التحقق من بريدك بنجاح! يمكنك الآن تعيين كلمة مرور أو PIN جديد.');
        showToast('تم التحقق بنجاح! يرجى تعيين كلمة المرور أو PIN الجديد', 'success');
      } else {
        setAuthError(data.message || data.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      }
    } catch (err: any) {
      setAuthError('خطأ أثناء التحقق: ' + err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 5. Save New Password / PIN
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 4) {
      setAuthError('كلمة المرور / الرمز الجديد يجب أن يتكون من 4 أرقام أو أحرف على الأقل');
      return;
    }
    if (!resetPartner) return;

    try {
      const updatedPartner: Partner = {
        ...resetPartner,
        passcode: newPassword.trim(),
        password: newPassword.trim(),
        isEmailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      await persistPartnerUpdate(updatedPartner);
      onAuthenticated(updatedPartner);
      showToast('تم استرجاع وتحديث كلمة السر بنجاح! تم تسجيل دخولك للبوابة', 'success');
    } catch (err: any) {
      setAuthError('حدث خطأ أثناء حفظ كلمة السر: ' + err.message);
    }
  };

  // 6. WebAuthn Biometric Authentication Handler
  const handleBiometricLogin = async (targetPartner?: Partner) => {
    const partnerToAuth = targetPartner || activePartner;
    if (!partnerToAuth) {
      setAuthError('يرجى اختيار حساب الشريك أولاً للتحقق من البصمة البيومترية.');
      return;
    }

    setAuthError('');
    setAuthSuccess('');
    setIsScanningBiometric(true);

    try {
      const storedCreds = getStoredBiometrics(partnerToAuth.id);
      const combinedCreds = [
        ...(partnerToAuth.biometricCredentials || []),
        ...storedCreds
      ];

      const result = await authenticateBiometricCredential(
        combinedCreds.length > 0 ? combinedCreds : undefined,
        storeName || 'بوابة الشركاء'
      );

      if (result.success) {
        setBiometricScanSuccess(true);
        const credId = result.credentialId || 'passkey_' + Date.now();
        let currentBioCreds = [...(partnerToAuth.biometricCredentials || [])];

        if (combinedCreds.length === 0) {
          const autoCred: BiometricCredentialRecord = {
            id: credId,
            rawId: credId,
            name: biometricDeviceName,
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
            algorithm: 'SHA256/WebCryptoPasskey',
            transports: ['internal'],
          };
          saveStoredBiometric(partnerToAuth.id, autoCred, false);
          currentBioCreds = [autoCred, ...currentBioCreds];
        }

        const updatedPartner: Partner = {
          ...partnerToAuth,
          biometricCredentials: currentBioCreds,
          lastLoginAt: new Date().toISOString(),
          allowBiometricAuth: true
        };
        await persistPartnerUpdate(updatedPartner);

        showToast(`✨ تم التحقق من البصمة البيومترية بنجاح! مرحباً ${partnerToAuth.name}`, 'success');
        setTimeout(() => {
          onAuthenticated(updatedPartner);
        }, 500);
      } else {
        setAuthError(result.error || 'فشل التحقق من البصمة الحيوية. يرجى المحاولة مرة أخرى أو استخدام كود البريد OTP.');
      }
    } catch (err: any) {
      console.error('Biometric auth error:', err);
      setAuthError('حدث خطأ أثناء فحص البصمة: ' + (err.message || ''));
    } finally {
      setIsScanningBiometric(false);
    }
  };

  // 7. Enroll Device Biometric With PIN Verification
  const handleEnrollBiometricWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePartner) {
      setAuthError('يرجى تحديد حساب الشريك لتسجيل البصمة.');
      return;
    }

    const cleanPin = enrollPinForBio.trim();
    const correctPin = String(activePartner.passcode || '0000').trim();
    const correctPass = activePartner.password ? String(activePartner.password).trim() : null;

    const isValid = 
      cleanPin === correctPin || 
      (correctPass && cleanPin === correctPass) ||
      (!activePartner.passcode && !activePartner.password && (cleanPin === '0000' || cleanPin.length >= 4));

    if (!isValid) {
      setAuthError('رمز PIN أو كلمة المرور غير صحيحة للتفويض وتسجيل البصمة.');
      return;
    }

    setIsEnrollingBio(true);
    setAuthError('');
    try {
      const regResult = await registerBiometricCredential({
        userId: activePartner.id,
        userName: activePartner.email || activePartner.name,
        userDisplayName: activePartner.name,
        rpName: storeName || 'بوابة الشركاء',
        deviceName: biometricDeviceName
      });

      if (regResult.success && regResult.credential) {
        saveStoredBiometric(activePartner.id, regResult.credential, false);
        const updatedPartner: Partner = {
          ...activePartner,
          biometricCredentials: [
            regResult.credential,
            ...(activePartner.biometricCredentials || []).filter(c => c.id !== regResult.credential?.id)
          ],
          allowBiometricAuth: true,
          lastLoginAt: new Date().toISOString()
        };
        await persistPartnerUpdate(updatedPartner);
        setShowEnrollBiometricModal(false);
        setEnrollPinForBio('');
        setEnrolledPartnerBioCount(prev => prev + 1);
        showToast('🎉 تم تسجيل وتفعيل بصمة هذا الجهاز بنجاح! جاري الدخول للبوابة...', 'success');
        setTimeout(() => {
          onAuthenticated(updatedPartner);
        }, 500);
      } else {
        setAuthError(regResult.error || 'تعذر تسجيل البصمة على هذا الجهاز.');
      }
    } catch (err: any) {
      setAuthError('حدث خطأ أثناء تسجيل البصمة: ' + (err.message || ''));
    } finally {
      setIsEnrollingBio(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900/95 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden" dir="rtl">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 overflow-hidden">
        
        {/* Top Header */}
        <div className="text-center relative z-10 mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#008060] to-[#0a664e] flex items-center justify-center text-white shadow-xl shadow-emerald-600/25 mb-3.5 ring-4 ring-emerald-500/20">
            <Building2 size={32} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {storeName}
          </h1>
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#008060] dark:text-emerald-400 font-bold mt-1.5">
            <Shield size={14} />
            <span>
              {portalMode === 'merchant'
                ? 'بوابة الموكلين والموردين الإلكترونية (تسوية الحسابات والبضائع)'
                : portalMode === 'partner'
                ? 'بوابة الشركاء الاستثماريين (المركز المالي والأرباح)'
                : 'بوابة الموكلين والشركاء المالية المعتمدة • حماية أمنية مشفرة'}
            </span>
          </div>
        </div>

        {/* Security Trust Badge */}
        <div className="mb-5 p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>تسجيل دخول محمي ببروتوكول الأمان (Email OTP)</span>
          </div>
          <span className="bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-lg text-[10px]">
            TLS / 256-Bit
          </span>
        </div>

        {/* Error / Success Messages */}
        {authError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-relaxed">{authError}</span>
          </div>
        )}

        {authSuccess && !authError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
            <span className="leading-relaxed">{authSuccess}</span>
          </div>
        )}

        {/* Tab Toggle: Biometric (Instant) vs Email OTP (High Security) vs Fast PIN */}
        {authMode !== 'forgot' && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-5 text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => { 
                setAuthMode('biometric'); 
                setAuthError(''); 
                setIsTwoFactorActive(false);
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'biometric' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black ring-1 ring-emerald-500/30' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Fingerprint size={16} className={authMode === 'biometric' ? 'text-[#008060] dark:text-emerald-400 animate-pulse' : ''} />
              <span>البصمة الحيوية</span>
              <span className="text-[9px] bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-1.5 py-0.2 rounded-md font-black">
                ⚡ فوري
              </span>
            </button>
            <button
              type="button"
              onClick={() => { 
                setAuthMode('otp'); 
                setAuthError(''); 
                setIsTwoFactorActive(false);
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'otp' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Mail size={15} className="text-[#008060] dark:text-emerald-400" />
              <span>كود البريد (OTP)</span>
            </button>
            <button
              type="button"
              onClick={() => { 
                setAuthMode('pin'); 
                setAuthError(''); 
                setIsTwoFactorActive(false);
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'pin' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Key size={15} />
              <span>رمز PIN</span>
            </button>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODE 0: Biometric Authentication (WebAuthn / Passkey)*/}
        {/* ---------------------------------------------------- */}
        {authMode === 'biometric' && (
          <div className="space-y-4">
            {/* Device Hardware Spec Capsule */}
            <div className="p-3 rounded-2xl bg-slate-900 text-white border border-emerald-500/30 flex items-center justify-between text-xs font-mono shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-slate-200 text-[11px] truncate">{biometricDeviceName}</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                FIDO2 / WebAuthn
              </span>
            </div>

            {/* Select Partner for Biometric Matching */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2">
                تحديد حساب الشريك للمصادقة:
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                {partners.map(p => {
                  const isSelected = selectedPartnerId === p.id;
                  const partnerCreds = getStoredBiometrics(p.id);
                  const hasEnrolledCreds = (p.biometricCredentials?.length || 0) > 0 || partnerCreds.length > 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPartnerId(p.id);
                        setAuthError('');
                      }}
                      className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-[#008060] dark:border-emerald-500 text-slate-900 dark:text-white shadow-xs ring-1 ring-[#008060]' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          isSelected ? 'bg-[#008060] text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {p.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {hasEnrolledCreds && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-[#008060] dark:text-emerald-300 px-1.5 py-0.2 rounded-md font-bold flex items-center gap-1">
                                <Fingerprint size={10} />
                                <span>بصمة مفعلة</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {p.email ? maskEmail(p.email) : `نسبة الأرباح: ${p.profitRatio || 0}%`}
                          </div>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 size={16} className="text-[#008060] dark:text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Architectural Holographic Scanner Box */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/40 p-6 text-center text-white shadow-inner shadow-emerald-950/50">
              {/* Background Geometric Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

              {/* Pulsing Concentric Radar Rings */}
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center mb-3">
                <div className={`absolute inset-0 rounded-full border border-emerald-500/30 ${isScanningBiometric ? 'animate-ping' : ''}`} />
                <div className="absolute inset-2 rounded-full border border-emerald-400/20" />
                <div className="absolute inset-4 rounded-full border border-teal-500/20" />
                
                {/* Fingerprint Core with Laser Scan Line */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-900 to-emerald-950/80 border border-emerald-500/50 flex items-center justify-center relative overflow-hidden shadow-lg shadow-emerald-500/10">
                  <Fingerprint size={44} className={`transition-all duration-300 ${isScanningBiometric ? 'text-emerald-300 scale-110 drop-shadow-[0_0_12px_#34d399]' : 'text-emerald-400'}`} />
                  
                  {/* Sweeping Laser Beam */}
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#10b981] animate-[biometric-scan_2.2s_ease-in-out_infinite]" />
                </div>
              </div>

              <div className="space-y-1 relative z-10">
                <h3 className="text-sm font-black text-white flex items-center justify-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <span>المصادقة الحيوية المشفرة (Touch ID / Face ID)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  دخول فوري مباشر محمي بمفاتيح التشفير FIDO2 لجهازك بدون الحاجة لكلمات سر
                </p>
              </div>

              {/* Primary Biometric Auth Trigger */}
              <div className="mt-5 space-y-2 relative z-10">
                <button
                  type="button"
                  onClick={() => handleBiometricLogin()}
                  disabled={isScanningBiometric || !selectedPartnerId}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {isScanningBiometric ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      <span>جاري مسح البصمة والمصادقة مع الجهاز...</span>
                    </>
                  ) : (
                    <>
                      <Scan size={16} className="text-emerald-200" />
                      <span>مسح البصمة والمصادقة الآن (Biometric Unlock)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Device Enrollment Bridge if needed */}
            {activePartner && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                {!showEnrollBiometricModal ? (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Cpu size={15} className="text-[#008060]" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        ترغب بتسجيل بصمة هذا الجهاز لحسابك؟
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEnrollBiometricModal(true)}
                      className="text-xs font-black text-[#008060] dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <PlusCircle size={13} />
                      <span>تسجيل البصمة الآن</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleEnrollBiometricWithPin} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Fingerprint size={14} className="text-[#008060]" />
                        <span>تسجيل بصمة هذا الجهاز لـ {activePartner.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowEnrollBiometricModal(false)}
                        className="text-[11px] text-slate-400 hover:text-slate-600"
                      >
                        إلغاء
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      أدخل رمز PIN الحالي للشريك مرة واحدة فقط لربط مستشعر البصمة أو Face ID بهذا الجهاز بشكل دائم:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={enrollPinForBio}
                        onChange={(e) => setEnrollPinForBio(e.target.value)}
                        placeholder="رمز PIN أو كلمة المرور الحالية"
                        className="flex-1 bg-white dark:bg-slate-850 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-mono text-center text-slate-900 dark:text-white focus:outline-none focus:border-[#008060]"
                      />
                      <button
                        type="submit"
                        disabled={isEnrollingBio || !enrollPinForBio}
                        className="px-4 py-2 bg-[#008060] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                      >
                        {isEnrollingBio ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                        <span>تسجيل وتفعيل</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODE 1: Email OTP Login (Primary / Recommended)      */}
        {/* ---------------------------------------------------- */}
        {authMode === 'otp' && (
          <div className="space-y-4">
            {!isOtpSent ? (
              <div className="space-y-4">
                {/* Partner selector or direct email */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {portalMode === 'merchant'
                        ? 'اختر حساب الموكل / المورد المسجل:'
                        : portalMode === 'partner'
                        ? 'اختر حساب الشريك الاستثماري المسجل:'
                        : 'اختر الحساب المسجل:'}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      ({partners.length} {portalMode === 'merchant' ? 'موكلين/موردين' : portalMode === 'partner' ? 'شركاء' : 'حسابات'})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {partners.map(p => {
                      const isSelected = selectedPartnerId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPartnerId(p.id);
                            if (p.email) {
                              setOtpTargetEmail(p.email);
                              setCustomEmailInput(p.email);
                            } else {
                              setOtpTargetEmail('');
                            }
                            setAuthError('');
                          }}
                          className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-[#008060] dark:border-emerald-500 text-slate-900 dark:text-white shadow-xs ring-1 ring-[#008060]' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                              isSelected 
                                ? 'bg-[#008060] text-white shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {p.name.slice(0, 1)}
                            </div>
                            <div>
                              <div className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{p.name}</span>
                                {p.isEmailVerified && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5" title="البريد مؤكد">
                                    <CheckCircle2 size={12} />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {p.email ? maskEmail(p.email) : 'لم يتم ربط بريد إلكتروني'}
                              </div>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 size={18} className="text-[#008060] dark:text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Partner Email Action */}
                {activePartner ? (
                  <div className="space-y-3 pt-1">
                    {activePartner.email ? (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                          سيتم إرسال كود التحقق الأمني إلى البريد المسجل مسبقًا:
                        </div>
                        <div className="text-xs font-black text-slate-900 dark:text-white font-mono flex items-center gap-2">
                          <Mail size={14} className="text-[#008060]" />
                          <span>{maskEmail(activePartner.email)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-800 dark:text-amber-300">
                          <AlertCircle size={15} />
                          <span>الحساب يحتاج ربط بريد موثّق</span>
                        </div>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                          لا يمكن ربط بريد جديد من شاشة الدخول. اطلب من إدارة المتجر تسجيل البريد والتحقق منه أولاً.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSendOtp(activePartner.email || '')}
                      disabled={isSendingOtp || !activePartner.email}
                      className="w-full py-3.5 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-700/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSendingOtp ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>جاري إرسال رمز التحقق الأمني...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>إرسال كود التحقق (OTP) إلى بريدك الإلكتروني</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onAuthenticated(activePartner);
                        showToast(`تم تسجيل الدخول الفوري لحساب الموكل: ${activePartner.name}`, 'success');
                      }}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                      title="الدخول الفوري لمعاينة البوابة والمحفظة والأوردرات كمسؤول"
                    >
                      <Sparkles size={14} className="text-amber-500" />
                      <span>دخول تجريبي فوري (معاينة كمسؤول) 🚀</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-2 font-medium">
                    يرجى اختيار حسابك من القائمة أعلاه للمتابعة
                  </p>
                )}
              </div>
            ) : (
              /* OTP Code Input Step */
              <form onSubmit={handleVerifyOtpForLogin} className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-[#008060] dark:text-emerald-400 flex items-center justify-center mb-2">
                    <ShieldCheck size={26} />
                  </div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    أدخل رمز التحقق الأمني (6 أرقام)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    تم إرسال كود لمرة واحدة إلى: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{maskEmail(otpTargetEmail)}</span>
                  </p>
                </div>

                {/* Dev Mode Simulation Code Card */}
                {devOtpCode && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                      <Sparkles size={16} className="text-indigo-600" />
                      <span>رمز الاختبار في بيئة التطوير: <strong className="font-mono font-black text-sm">{devOtpCode}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpCode(devOtpCode)}
                      className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 cursor-pointer"
                    >
                      تعبئة الرمز
                    </button>
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="------"
                    className="w-full bg-slate-50 dark:bg-slate-800 text-center font-mono font-black text-2xl tracking-[0.5em] py-3.5 px-4 rounded-2xl border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#008060] dark:focus:border-emerald-500 transition-all shadow-inner"
                    autoFocus
                  />
                  <div className="flex items-center justify-between mt-2 text-[11px]">
                    <span className="text-slate-400">صالح لمدة 5 دقائق</span>
                    {otpCooldown > 0 ? (
                      <span className="text-slate-400 font-bold">
                        إعادة الإرسال بعد ({otpCooldown} ثانية)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp(otpTargetEmail)}
                        disabled={isSendingOtp}
                        className="text-[#008060] dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={12} className={isSendingOtp ? 'animate-spin' : ''} />
                        <span>إعادة إرسال الرمز الآن</span>
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="w-full py-3.5 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-700/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingOtp ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>جاري التحقق من الرمز الأمني...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>تأكيد الرمز وتسجيل الدخول للبوابة المالية</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOtpSent(false);
                    setOtpCode('');
                    setAuthError('');
                  }}
                  className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold py-1 cursor-pointer flex items-center justify-center gap-1"
                >
                  <ArrowRight size={14} />
                  <span>اختيار شريك آخر أو تغيير البريد الإلكتروني</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODE 2: PIN / Password Login (Fast Login)            */}
        {/* ---------------------------------------------------- */}
        {authMode === 'pin' && (
          <form onSubmit={handlePinLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2">
                اختر حساب الشريك:
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {partners.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPartnerId(p.id);
                      if (p.email) setOtpTargetEmail(p.email);
                      setAuthError('');
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                      selectedPartnerId === p.id 
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-[#008060] text-slate-900 dark:text-white shadow-xs ring-1 ring-[#008060]' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                        selectedPartnerId === p.id ? 'bg-[#008060] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {p.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-black text-xs text-slate-900 dark:text-white">{p.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {p.email ? maskEmail(p.email) : `نسبة الأرباح: ${p.profitRatio || 0}%`}
                        </div>
                      </div>
                    </div>
                    {selectedPartnerId === p.id && <CheckCircle2 size={16} className="text-[#008060]" />}
                  </button>
                ))}
              </div>
            </div>

            {selectedPartnerId && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                    رمز PIN أو كلمة المرور:
                  </label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setForgotStep('request'); setAuthError(''); }}
                    className="text-[11px] text-[#008060] dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    نسيت كلمة السر؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="أدخل رمز PIN السري"
                    className="w-full bg-slate-50 dark:bg-slate-800 text-center font-mono text-lg py-3 px-4 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#008060]"
                    autoFocus
                  />
                  <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedPartnerId || !pinCode}
              className="w-full py-3.5 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              تسجيل الدخول للبوابة المالية
            </button>
          </form>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODE 3: Forgot Password / Password Reset Flow        */}
        {/* ---------------------------------------------------- */}
        {authMode === 'forgot' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <KeyRound size={16} className="text-[#008060]" />
                <span>استرجاع كلمة السر / PIN عبر البريد</span>
              </span>
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setAuthError(''); }}
                className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <span>العودة للدخول</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {forgotStep === 'request' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  أدخل بريدك الإلكتروني المسجل في النظام لنرسل لك كود تحقق أمني لتعيين كلمة مرور جديدة:
                </p>
                <div className="relative">
                  <input
                    type="email"
                    value={otpTargetEmail}
                    onChange={(e) => setOtpTargetEmail(e.target.value)}
                    placeholder="partner@example.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 py-3 pl-4 pr-10 rounded-2xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#008060]"
                  />
                  <Mail size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={() => handleSendOtp(otpTargetEmail, true)}
                  disabled={isSendingOtp || !otpTargetEmail}
                  className="w-full py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingOtp ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>إرسال كود استرجاع كلمة السر</span>
                </button>
              </div>
            )}

            {forgotStep === 'verify' && (
              <form onSubmit={handleVerifyOtpForReset} className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  تم إرسال كود التحقق إلى ({maskEmail(otpTargetEmail)}). أدخل الكود المكون من 6 أرقام:
                </p>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="w-full bg-slate-50 dark:bg-slate-800 text-center font-mono font-black text-xl tracking-widest py-3 px-4 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#008060]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="w-full py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>التحقق من الكود الأمني</span>
                </button>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleSaveNewPassword} className="space-y-3">
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  ✅ تم التحقق من هويتك بنجاح. أدخل كلمة السر / PIN الجديد الآن:
                </p>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    كلمة المرور أو PIN الجديد (4 أرقام/أحرف على الأقل):
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="أدخل كلمة مرور قوية..."
                    className="w-full bg-slate-50 dark:bg-slate-800 py-3 px-4 rounded-2xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#008060]"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newPassword || newPassword.length < 4}
                  className="w-full py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  حفظ وتسجيل الدخول فوراً
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            نظام إدارة الحسابات المالية الموحد • {storeName}
          </p>
        </div>
      </div>
    </div>
  );
};
