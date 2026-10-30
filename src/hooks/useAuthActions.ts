import { useState } from 'react';
import {
  getSupabaseAuthUser,
  requestSupabasePasswordReset,
  resendSupabaseSignupConfirmation
} from '../../services/supabaseAuthService';

const getAuthActionRedirect = (): string => {
  if (typeof window === 'undefined') return 'https://abdomedi.com/auth/action';
  return new URL('/auth/action', window.location.origin).toString();
};

const getFriendlyAuthError = (err: any, fallback: string): string => {
  const message = String(err?.message || '');
  const code = String(err?.code || '');
  if (/rate limit|too many requests/i.test(message) || code.includes('over_email_send_rate_limit')) {
    return 'تم إجراء محاولات كثيرة. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
  }
  if (/invalid email/i.test(message) || code.includes('invalid_email')) {
    return 'عنوان البريد الإلكتروني غير صالح.';
  }
  if (/user not found/i.test(message)) {
    return 'تعذر العثور على حساب مرتبط بهذا البريد الإلكتروني.';
  }
  if (/session|not authenticated/i.test(message)) {
    return 'انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.';
  }
  return fallback;
};

export const useAuthActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCustomPasswordReset = async (email: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await requestSupabasePasswordReset(email, getAuthActionRedirect());
      setSuccess('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
      return true;
    } catch (err: any) {
      console.error('Supabase Password Reset Error:', err);
      setError(getFriendlyAuthError(err, 'حدث خطأ أثناء إرسال رابط الاستعادة. يرجى المحاولة لاحقاً.'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleCustomEmailVerification = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const user = await getSupabaseAuthUser();
      if (!user?.email) throw new Error('يجب تسجيل الدخول أولاً لإرسال بريد التفعيل.');
      if (user.email_confirmed_at) {
        setSuccess('البريد الإلكتروني مؤكد بالفعل.');
        return true;
      }
      await resendSupabaseSignupConfirmation(user.email, getAuthActionRedirect());
      setSuccess('تم إرسال رابط تفعيل الحساب إلى بريدك الإلكتروني بنجاح.');
      return true;
    } catch (err: any) {
      console.error('Supabase Email Verification Error:', err);
      setError(getFriendlyAuthError(err, 'حدث خطأ أثناء إرسال رسالة التفعيل.'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    handleCustomPasswordReset,
    handleCustomEmailVerification,
    loading,
    error,
    success,
    setError,
    setSuccess
  };
};
