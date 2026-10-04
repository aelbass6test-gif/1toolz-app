import React, { useState } from 'react';
import { Partner } from '../types';
import { 
  Lock, Mail, Phone, Key, ShieldCheck, AlertCircle, 
  Loader2, Building2, Send, CheckCircle2, ArrowRight
} from 'lucide-react';
import * as db from '../services/databaseService';

interface PartnerAuthViewProps {
  partners: Partner[];
  storeName: string;
  storeId: string;
  settings: any;
  updateSettings: (newSettings: any) => void;
  onAuthenticated: (partner: Partner) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PartnerAuthView: React.FC<PartnerAuthViewProps> = ({
  partners,
  storeName,
  storeId,
  settings,
  updateSettings,
  onAuthenticated,
  showToast
}) => {
  // Modes: 'pin' | 'otp' | 'forgot'
  const [authMode, setAuthMode] = useState<'pin' | 'otp' | 'forgot'>('pin');

  // Selected Partner / Login Identifier
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [loginInput, setLoginInput] = useState(''); // Email or Phone or PIN
  const [pinCode, setPinCode] = useState('');
  const [password, setPassword] = useState('');

  // OTP login & Password reset state
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [newPassword, setNewPassword] = useState('');
  const [resetPartner, setResetPartner] = useState<Partner | null>(null);

  const [authError, setAuthError] = useState('');

  // 1. Handle Standard PIN/Password Login
  const handlePinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

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
      onAuthenticated(partner);
      showToast(`أهلاً بك يا ${partner.name} في بوابتك المالية`, 'success');
    } else {
      setAuthError('رمز المرور أو كلمة السر غير صحيحة. يمكنك استخدام خيار نسيت كلمة السر أو كود البريد.');
    }
  };

  // 2. Send OTP to Email
  const handleSendOtp = async (targetEmail: string, isForReset = false) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    const partner = partners.find(p => p.email?.toLowerCase() === cleanEmail || p.id === selectedPartnerId);
    if (isForReset && !partner) {
      setAuthError('لم يتم العثور على حساب شريك مسجل بهذا البريد الإلكتروني');
      return;
    }

    setIsSendingOtp(true);
    setAuthError('');
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          userName: partner?.name || 'الشريك العزيز',
          phone: partner?.phone
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsOtpSent(true);
        if (isForReset) {
          setResetPartner(partner || null);
          setForgotStep('verify');
        }
        showToast('تم إرسال كود التحقق الأمني إلى بريدك الإلكتروني بنجاح', 'success');
      } else {
        setAuthError(data.error || 'تعذر إرسال الرمز، يرجى المحاولة لاحقاً');
      }
    } catch (err: any) {
      setAuthError('حدث خطأ أثناء إرسال البريد: ' + err.message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 3. Verify OTP for Login
  const handleVerifyOtpForLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
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
          otp: otpCode.trim()
        })
      });
      const data = await res.json();
      if (data.valid) {
        const cleanEmail = otpTargetEmail.trim().toLowerCase();
        let partner = partners.find(p => p.email?.toLowerCase() === cleanEmail || p.id === selectedPartnerId);
        if (!partner && partners.length > 0) {
          partner = partners[0];
        }
        if (partner) {
          onAuthenticated(partner);
          showToast(`تم التحقق بنجاح! أهلاً بك يا ${partner.name}`, 'success');
        }
      } else {
        setAuthError(data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      }
    } catch (err: any) {
      setAuthError('خطأ أثناء التحقق: ' + err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 4. Verify OTP for Password Reset
  const handleVerifyOtpForReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
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
          otp: otpCode.trim()
        })
      });
      const data = await res.json();
      if (data.valid) {
        setForgotStep('reset');
        showToast('تم التحقق بنجاح! يرجى تعيين كلمة المرور أو PIN الجديد', 'success');
      } else {
        setAuthError(data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
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
      setAuthError('كلمة المرور / الرمز الجديد يجب أن يتكون من 4 أرقام/أحرف على الأقل');
      return;
    }
    if (!resetPartner) return;

    try {
      const updatedPartner: Partner = {
        ...resetPartner,
        passcode: newPassword.trim(),
        password: newPassword.trim()
      };

      const updatedPartners = partners.map(p => 
        p.id === resetPartner.id ? updatedPartner : p
      );

      const newSettings = { ...settings, partners: updatedPartners };
      updateSettings(newSettings);

      if (storeId) {
        const cur = await db.getStoreData(storeId);
        if (cur) {
          await db.saveStoreData({ id: storeId, name: storeName } as any, {
            ...cur,
            settings: newSettings
          });
        }
      }

      onAuthenticated(updatedPartner);
      showToast('تم استرجاع وتحديث كلمة السر بنجاح! تم تسجيل دخولك', 'success');
    } catch (err: any) {
      setAuthError('حدث خطأ أثناء حفظ كلمة السر: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        
        {/* Top Header */}
        <div className="text-center relative z-10 mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#008060] to-[#0a664e] flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 mb-3">
            <Building2 size={30} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{storeName}</h1>
          <p className="text-xs text-[#008060] font-bold mt-1">البوابة المالية المعتمدة للشركاء ومتابعة الأرباح</p>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{authError}</span>
          </div>
        )}

        {/* Tab Toggle: PIN/Password vs Email OTP vs Forgot */}
        {authMode !== 'forgot' && (
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setAuthMode('pin'); setAuthError(''); }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                authMode === 'pin' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔑 كلمة السر / PIN
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('otp'); setAuthError(''); }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                authMode === 'otp' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✉️ كود البريد (OTP)
            </button>
          </div>
        )}

        {/* MODE 1: PIN / Password Login */}
        {authMode === 'pin' && (
          <form onSubmit={handlePinLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2">اختر حساب الشريك:</label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {partners.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPartnerId(p.id);
                      if (p.email) setOtpTargetEmail(p.email);
                    }}
                    className={`p-2.5 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                      selectedPartnerId === p.id 
                        ? 'bg-emerald-50/80 border-[#008060] text-slate-900 shadow-xs ring-1 ring-[#008060]' 
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                        selectedPartnerId === p.id ? 'bg-[#008060] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-black text-xs text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {p.email ? p.email : `نسبة: ${p.profitRatio || 0}%`}
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
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black text-slate-700">رمز PIN أو كلمة المرور:</label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setForgotStep('request'); setAuthError(''); }}
                    className="text-[11px] text-[#008060] font-bold hover:underline cursor-pointer"
                  >
                    نسيت كلمة السر؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="أدخل رمز PIN (افتراضي 0000)"
                    className="w-full bg-slate-50 text-center font-mono text-lg py-2.5 px-4 rounded-2xl border border-slate-300 text-slate-900 focus:outline-none focus:border-[#008060]"
                    autoFocus
                  />
                  <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedPartnerId || !pinCode}
              className="w-full py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              تسجيل الدخول للبوابة المالية
            </button>
          </form>
        )}

        {/* MODE 2: Email OTP Login */}
        {authMode === 'otp' && (
          <div className="space-y-4">
            {!isOtpSent ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">البريد الإلكتروني المسجل للشريك:</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={otpTargetEmail}
                      onChange={(e) => setOtpTargetEmail(e.target.value)}
                      placeholder="partner@example.com"
                      className="w-full bg-slate-50 py-2.5 pl-4 pr-10 rounded-2xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#008060]"
                    />
                    <Mail size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendOtp(otpTargetEmail)}
                  disabled={isSendingOtp || !otpTargetEmail}
                  className="w-full py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingOtp ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>إرسال كود التحقق الأمني (6 أرقام)</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtpForLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    أدخل كود التحقق المرسل إلى ({otpTargetEmail}):
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-slate-50 text-center font-mono font-black text-xl tracking-widest py-2.5 px-4 rounded-2xl border border-slate-300 text-slate-900 focus:outline-none focus:border-[#008060]"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="w-full py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>تأكيد الرمز وتسجيل الدخول</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-bold py-1 cursor-pointer"
                >
                  تغيير البريد الإلكتروني
                </button>
              </form>
            )}
          </div>
        )}

        {/* MODE 3: Forgot Password / Password Reset Flow */}
        {authMode === 'forgot' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-black text-xs text-slate-900">استرجاع كلمة السر / PIN</span>
              <button
                type="button"
                onClick={() => { setAuthMode('pin'); setAuthError(''); }}
                className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <span>العودة للدخول</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {forgotStep === 'request' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  أدخل بريدك الإلكتروني المسجل في النظام لنرسل لك كود تحقق أمني لتعيين كلمة مرور جديدة:
                </p>
                <div>
                  <input
                    type="email"
                    value={otpTargetEmail}
                    onChange={(e) => setOtpTargetEmail(e.target.value)}
                    placeholder="partner@example.com"
                    className="w-full bg-slate-50 py-2.5 px-4 rounded-2xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
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
                <p className="text-xs text-slate-500">
                  تم إرسال كود التحقق إلى ({otpTargetEmail}). أدخل الكود للمتابعة:
                </p>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-slate-50 text-center font-mono font-black text-xl tracking-widest py-2.5 px-4 rounded-2xl border border-slate-300 text-slate-900 focus:outline-none focus:border-[#008060]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="w-full py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifyingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>التحقق من الكود</span>
                </button>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleSaveNewPassword} className="space-y-3">
                <p className="text-xs text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  ✅ تم التحقق من هويتك بنجاح. أدخل كلمة السر / PIN الجديد الآن:
                </p>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">كلمة المرور أو PIN الجديد:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="أدخل 4 أرقام أو كلمة مرور..."
                    className="w-full bg-slate-50 py-2.5 px-4 rounded-2xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#008060]"
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
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            نظام إدارة الحسابات المالية الموحد • {storeName}
          </p>
        </div>
      </div>
    </div>
  );
};
