import React, { useState } from 'react';
import { ShieldCheck, Phone, KeyRound, LogIn, Loader2, Lock, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { User } from '../types';
import { cfAuthLogin, clearCfAuthToken } from '../services/cloudflareClient';
import { getUserByPhone } from '../services/databaseService';
import { verifyPasswordSecure } from '../utils/syncIntegrity';
import { useAuthActions } from '../src/hooks/useAuthActions';

interface AdminSecretLoginGateProps {
  onPasswordSuccess: (user: User, password?: string) => void;
  currentMerchantUser?: User | null;
}

const AdminSecretLoginGate: React.FC<AdminSecretLoginGateProps> = ({
  onPasswordSuccess,
  currentMerchantUser,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password Reset inside Admin Gate
  const [showResetMode, setShowResetMode] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'link_sent' | 'otp_verify' | 'done'>('request');
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [resetMaskedTarget, setResetMaskedTarget] = useState('');
  const [resetTargetPhone, setResetTargetPhone] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const {
    handleCustomPasswordReset,
    confirmOtpPasswordReset,
    loading: resetLoading,
    error: resetError,
    setError: setResetError,
  } = useAuthActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedId = identifier.trim();
    if (!trimmedId || !password) {
      setError('يرجى إدخال معرف مدير المنظومة وكلمة المرور.');
      return;
    }

    setIsLoading(true);
    try {
      const loginRes = await cfAuthLogin(trimmedId, password);
      const user = (loginRes?.user || (await getUserByPhone(trimmedId))) as User | null;

      if (!user || !user.isAdmin) {
        clearCfAuthToken();
        setError('⛔ هذا الحساب لا يملك صلاحيات مدير المنظومة.');
        setIsLoading(false);
        return;
      }

      onPasswordSuccess(user, password);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('Failed to fetch') || msg.includes('Network')) {
        try {
          const fallbackUser = await getUserByPhone(trimmedId);
          if (
            fallbackUser &&
            fallbackUser.isAdmin &&
            fallbackUser.password &&
            (await verifyPasswordSecure(password, fallbackUser.password)).valid
          ) {
            onPasswordSuccess(fallbackUser, password);
            return;
          }
        } catch {}
        setError('تعذر الاتصال بالخادم للتحقق من بيانات الدخول.');
      } else {
        setError(msg || 'بيانات دخول مدير المنظومة غير صحيحة.');
      }
      setIsLoading(false);
    }
  };

  const handleRequestAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    const input = resetIdentifier.trim();
    if (!input) {
      setResetError('يرجى إدخال رقم الهاتف أو البريد الإلكتروني.');
      return;
    }

    let lookupTarget = input;
    let resolvedPhone = input.includes('@') ? '' : input;
    if (!input.includes('@')) {
      const u = await getUserByPhone(input).catch(() => null);
      if (u?.email) {
        lookupTarget = u.email;
        resolvedPhone = u.phone || resolvedPhone;
      }
    }

    const res = await handleCustomPasswordReset(lookupTarget);
    if (res.ok) {
      setResetTargetEmail(res.targetEmail || lookupTarget);
      setResetMaskedTarget(res.maskedEmail || res.targetEmail || lookupTarget);
      setResetTargetPhone(res.phone || resolvedPhone);
      setResetToken(res.resetToken || '');
      setResetStep(res.deliveryMode === 'link' ? 'link_sent' : 'otp_verify');
    }
  };

  const handleConfirmAdminOtpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (resetOtp.trim().length !== 6) {
      setResetError('يرجى إدخال رمز التحقق المكون من 6 أرقام.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError('كلمتا المرور غير متطابقتين.');
      return;
    }
    const res = await confirmOtpPasswordReset({
      email: resetTargetEmail,
      phone: resetTargetPhone,
      otp: resetOtp.trim(),
      resetToken,
      newPassword,
    });
    if (res.ok) {
      setResetStep('done');
    }
  };

  const closeResetMode = () => {
    setShowResetMode(false);
    setResetStep('request');
    setResetOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetError(null);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden"
      dir="rtl"
    >
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-600/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              {showResetMode ? 'استعادة كلمة مرور المدير' : 'بوابة دخول مدير المنظومة'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {showResetMode
                ? 'إرسال رابط إعادة التعيين أو تأكيد الرمز البريدي'
                : 'وصول إداري محمي — يتطلب التحقق من كلمة المرور ورمز OTP البريدي'}
            </p>
          </div>
        </div>

        {!showResetMode ? (
          <>
            {currentMerchantUser && !currentMerchantUser.isAdmin && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <span>
                  أنت مسجل حالياً بحساب تاجر ({currentMerchantUser.fullName || currentMerchantUser.phone}). أدخل بيانات مدير المنظومة أدناه للتبديل إلى لوحة الإدارة.
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs font-medium text-rose-300 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  رقم الهاتف أو البريد أو المعرف الإداري
                </label>
                <div className="relative">
                  <Phone
                    size={16}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="010010010"
                    autoComplete="username"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pr-10 pl-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 tabular-nums"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  كلمة المرور
                </label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pr-10 pl-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="text-left">
                <button
                  type="button"
                  onClick={() => {
                    setResetIdentifier(identifier);
                    setResetError(null);
                    setResetStep('request');
                    setShowResetMode(true);
                  }}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm py-3 px-4 shadow-lg shadow-indigo-600/25 transition-all duration-200 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>دخول إلى لوحة مدير المنظومة</span>
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            {resetStep === 'done' ? (
              <div className="space-y-4 text-center">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-bold text-emerald-300 flex items-center gap-2 justify-center">
                  <CheckCircle2 size={18} />
                  <span>تم تحديث كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.</span>
                </div>
                <button
                  type="button"
                  onClick={closeResetMode}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-2.5 cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            ) : resetStep === 'link_sent' ? (
              <div className="space-y-4 text-center">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-bold text-emerald-300 leading-5">
                  تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني ({resetMaskedTarget}).
                </div>
                <button
                  type="button"
                  onClick={closeResetMode}
                  className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm py-2.5 cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            ) : resetStep === 'otp_verify' ? (
              <form onSubmit={handleConfirmAdminOtpReset} className="space-y-3.5">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-200 leading-5">
                  تم إرسال رمز تحقق (6 أرقام) إلى بريدك (<span dir="ltr">{resetMaskedTarget}</span>). أدخل الرمز وكلمة المرور الجديدة:
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="رمز التحقق (6 أرقام)"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-700 px-4 py-2.5 text-center font-mono tracking-[0.35em] text-sm text-white"
                  dir="ltr"
                  required
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-700 px-4 py-2.5 text-sm text-white"
                  dir="ltr"
                  required
                />
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="تأكيد كلمة المرور الجديدة"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-700 px-4 py-2.5 text-sm text-white"
                  dir="ltr"
                  required
                />
                {resetError && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                    {resetError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 cursor-pointer disabled:opacity-60"
                >
                  {resetLoading ? <Loader2 size={18} className="animate-spin" /> : 'تأكيد الرمز وتحديث كلمة المرور'}
                </button>
                <button
                  type="button"
                  onClick={closeResetMode}
                  className="w-full text-xs text-slate-400 hover:text-white py-1 cursor-pointer"
                >
                  إلغاء
                </button>
              </form>
            ) : (
              <form onSubmit={handleRequestAdminReset} className="space-y-4">
                <input
                  type="text"
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  placeholder="010010010 أو البريد الإلكتروني"
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-700 px-4 py-2.5 text-sm text-white"
                  dir="ltr"
                  required
                />
                {resetError && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                    {resetError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-3 cursor-pointer disabled:opacity-60"
                >
                  {resetLoading ? <Loader2 size={18} className="animate-spin" /> : 'إرسال رابط / رمز الاستعادة'}
                </button>
                <button
                  type="button"
                  onClick={closeResetMode}
                  className="w-full text-xs text-slate-400 hover:text-white py-1 cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </form>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Lock size={12} />
          <span>جلسة مشفرة ومحمية بالتحقق الثنائي</span>
        </div>
      </div>
    </div>
  );
};

export default AdminSecretLoginGate;
