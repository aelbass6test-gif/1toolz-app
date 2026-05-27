import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Mail, RefreshCw, Loader2 } from 'lucide-react';
import { User } from '../types';

interface OtpVerificationPageProps {
  user: User;
  onVerifyAttempt: (otp: string) => void;
  onCancel: () => void;
  error: string;
}

const OtpVerificationPage: React.FC<OtpVerificationPageProps> = ({ user, onVerifyAttempt, onCancel, error: externalError }) => {
  const [otp, setOtp] = useState('');
  const [internalError, setInternalError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [showResendSuccess, setShowResendSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  useEffect(() => {
      setInternalError(externalError);
      if (externalError) {
          setIsVerifying(false); // Stop loading on external error
          setOtp(''); // Clear OTP on error
      }
  }, [externalError]);


  useEffect(() => {
    if (countdown > 0 && !isResending) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, isResending]);

  const handleResend = () => {
    if (countdown === 0) {
      setIsResending(true);
      // In a real app, you'd call a function here to resend the OTP via backend
      // For now, we simulate it.
      setTimeout(() => {
        setShowResendSuccess(true);
        setTimeout(() => setShowResendSuccess(false), 3000);
        setCountdown(30);
        setInternalError('');
        setIsResending(false);
      }, 1000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
        setInternalError('يجب أن يتكون الرمز من 6 أرقام.');
        return;
    }
    setIsVerifying(true);
    setInternalError('');
    await onVerifyAttempt(otp);
    // isVerifying will be set to false on success (component unmount) or error (useEffect)
  };

  return (
    <div dir="rtl" className="font-cairo bg-slate-100 dark:bg-slate-950 min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 flex items-center justify-center bg-teal-50 dark:bg-teal-900/40 rounded-full border-4 border-white dark:border-slate-800 shadow-md mb-5">
            <KeyRound className="w-8 h-8 text-teal-500" />
        </div>
        
        <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">التحقق بخطوتين</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">أرسلنا لك رمز تحقق من 6 أرقام عبر البريد الإلكتروني.</p>
        
        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-2">
                <Mail size={16} className="text-slate-400" />
                <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{user.email}</span>
            </div>
            <button onClick={onCancel} className="text-xs font-bold text-teal-600 hover:underline">تغيير</button>
        </div>

        <form onSubmit={handleSubmit}>
            <input
                ref={inputRef}
                type="text"
                maxLength={6}
                placeholder="ادخل الرمز هنا"
                value={otp}
                onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setOtp(value);
                    setInternalError('');
                }}
                className={`w-full text-center tracking-[0.5em] text-2xl font-bold bg-slate-50 dark:bg-slate-800 border-2 rounded-lg py-4 outline-none transition-all ${internalError ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200 dark:border-slate-700 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10'}`}
                disabled={isVerifying}
            />
            {internalError && <p className="text-sm text-red-500 mt-2">{internalError}</p>}
            <button
                type="submit"
                className="w-full bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition-colors duration-300 mt-4 shadow-lg shadow-teal-500/20 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-wait flex items-center justify-center gap-2"
                disabled={otp.length !== 6 || isVerifying}
            >
                {isVerifying && <Loader2 className="animate-spin" size={20}/>}
                {isVerifying ? 'جاري التحقق...' : 'تحقق من الرمز'}
            </button>
        </form>

        <div className="mt-6 text-sm text-slate-500 h-5">
            {showResendSuccess ? (
                <p className="text-green-600 font-bold animate-in fade-in">تم إعادة إرسال الرمز بنجاح!</p>
            ) : countdown > 0 ? (
                <span>لم يصلك رمز التحقق؟ إعادة إرساله خلال <span className="font-bold text-teal-600">{`00:${countdown.toString().padStart(2, '0')}`}</span></span>
            ) : (
                <button onClick={handleResend} disabled={isResending} className="font-bold text-teal-600 hover:underline disabled:text-slate-400 disabled:cursor-wait flex items-center gap-1 mx-auto">
                    {isResending && <RefreshCw size={14} className="animate-spin" />}
                    إعادة إرسال الرمز
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default OtpVerificationPage;
