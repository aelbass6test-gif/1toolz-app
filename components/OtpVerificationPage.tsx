import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  Phone, 
  RefreshCw, 
  Loader2, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { User } from '../types';

interface OtpVerificationPageProps {
  user: User;
  onVerifyAttempt: (otp: string) => Promise<boolean | void> | void;
  onCancel: () => void;
  error?: string;
  targetEmail?: string;
}

const OtpVerificationPage: React.FC<OtpVerificationPageProps> = ({ 
  user, 
  onVerifyAttempt, 
  onCancel, 
  error: externalError,
  targetEmail
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [internalError, setInternalError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [showResendSuccess, setShowResendSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentEmail, setCurrentEmail] = useState(targetEmail || user.email || (user.phone ? `${user.phone}@gmail.com` : ''));
  const [customSuccessMessage, setCustomSuccessMessage] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Sync external error
  useEffect(() => {
    if (externalError) {
      setInternalError(externalError);
      setIsVerifying(false);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  }, [externalError]);

  // 60-second countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleDigitChange = (index: number, val: string) => {
    const numericChar = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = numericChar;
    setDigits(newDigits);
    setInternalError('');

    if (numericChar && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (numericChar && index === 5) {
      const completeCode = newDigits.join('');
      if (completeCode.length === 6) {
        triggerVerify(completeCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim().replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setDigits(newDigits);
    setInternalError('');

    const targetFocus = Math.min(pastedData.length, 5);
    inputRefs.current[targetFocus]?.focus();

    if (pastedData.length === 6) {
      triggerVerify(pastedData);
    }
  };

  const triggerVerify = async (codeToVerify: string) => {
    if (codeToVerify.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setInternalError('');
    try {
      await onVerifyAttempt(codeToVerify);
    } catch (err: any) {
      setIsVerifying(false);
      setInternalError(err?.message || 'رمز التحقق غير صحيح، يرجى المحاولة ثانية.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerVerify(digits.join(''));
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setInternalError('');

    try {
      const resp = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          email: currentEmail,
          userName: user.fullName
        })
      });
      const data = await resp.json();
      if (!resp.ok && !data.success) {
        throw new Error(data.error || 'تعذر إعادة إرسال الرمز إلى بريدك الإلكتروني.');
      }

      if (data.email) {
        setCurrentEmail(data.email);
      }
      if (data.message) {
        setCustomSuccessMessage(data.message);
      }

      setShowResendSuccess(true);
      setCountdown(60);
      setTimeout(() => setShowResendSuccess(false), 8000);
    } catch (err: any) {
      setInternalError(err.message || 'حدث خطأ أثناء إعادة إرسال الرمز.');
    } finally {
      setIsResending(false);
    }
  };

  const formattedCountdown = `00:${countdown.toString().padStart(2, '0')}`;

  // Mask user email for privacy
  const getMaskedEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes('@')) return emailStr;
    const [name, domain] = emailStr.split('@');
    if (name.length <= 3) return `${name.slice(0, 1)}***@${domain}`;
    return `${name.slice(0, 3)}***@${domain}`;
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-cairo selection:bg-emerald-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 right-1/4 w-[450px] h-[450px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-800/90 backdrop-blur-2xl p-7 sm:p-10 rounded-3xl border border-white/10 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <button 
            type="button" 
            onClick={onCancel}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition active:scale-95 cursor-pointer"
          >
            <ArrowRight size={16} />
            الرجوع لتسجيل الدخول
          </button>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck size={13} />
            <span>حماية مشفرة</span>
          </div>
        </div>

        {/* Shield Icon Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 flex items-center justify-center bg-gradient-to-tr from-emerald-600 to-teal-400 text-white rounded-2xl shadow-xl shadow-emerald-500/20 mb-4 ring-4 ring-emerald-500/20">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            رمز التحقق الأمني (2FA)
          </h1>
          <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
            تم إرسال رمز التحقق الأمني المكون من 6 أرقام إلى بريدك الإلكتروني لإتمام تسجيل الدخول بأمان.
          </p>
        </div>

        {/* Target Email Info Card */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-white/10 mb-6 flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400">الحساب المسجل:</span>
            <div className="flex items-center gap-2 text-slate-200">
              <Phone size={14} className="text-emerald-400 shrink-0" />
              <span className="font-mono font-bold">{user.phone}</span>
            </div>
          </div>
          {currentEmail && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mail size={14} className="text-indigo-400" />
                البريد المستلم للرمز:
              </span>
              <span className="font-mono font-bold text-emerald-400 dir-ltr">{getMaskedEmail(currentEmail)}</span>
            </div>
          )}
        </div>

        {/* Instruction Note */}
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-3.5 mb-6 text-xs text-indigo-200 flex items-start gap-2.5">
          <Mail size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            يرجى فتح بريدك الإلكتروني، نسخ رمز التحقق (6 أرقام)، وإدخاله أدناه. تحقق أيضاً من مجلد <b>الرسائل غير المرغوب فيها (Spam)</b>.
          </p>
        </div>

        {/* 6 Digit Input Form */}
        <form onSubmit={handleManualSubmit}>
          <div className="flex justify-center gap-2 sm:gap-3 mb-6" dir="ltr" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={isVerifying}
                className={`w-11 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-black rounded-2xl bg-slate-900/90 border-2 text-white outline-none transition-all duration-200 select-all ${
                  internalError 
                    ? 'border-rose-500 ring-4 ring-rose-500/20 bg-rose-950/20' 
                    : digit 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-950/10' 
                      : 'border-white/10 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20'
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {internalError && (
            <div className="mb-5 flex flex-col gap-2 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl animate-in shake">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{internalError}</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={digits.join('').length !== 6 || isVerifying}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isVerifying ? (
              <>
                <Loader2 className="animate-spin text-slate-950" size={20} />
                <span>جاري التحقق من الرمز...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                <span>تأكيد الرمز والدخول إلى الحساب</span>
              </>
            )}
          </button>
        </form>

        {/* Resend & Cooldown Controls */}
        <div className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-slate-400">
          {showResendSuccess ? (
            <div className="flex flex-col items-center justify-center gap-1.5 text-emerald-400 font-bold animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{customSuccessMessage || 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني بنجاح!'}</span>
              </div>
            </div>
          ) : countdown > 0 ? (
            <p>
              لم يصلك الرمز في بريدك؟ يمكنك طلب إعادة الإرسال بعد{' '}
              <span className="font-mono font-bold text-emerald-400">{formattedCountdown}</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="inline-flex items-center gap-1.5 font-bold text-emerald-400 hover:text-emerald-300 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isResending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              إعادة إرسال رمز التحقق إلى البريد الآن
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default OtpVerificationPage;
