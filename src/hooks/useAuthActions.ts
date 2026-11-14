import { cfFetch } from '../../services/cloudflareClient';
import { useState } from 'react';

export const useAuthActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * إرسال بريد إعادة تعيين كلمة المرور عبر Cloudflare Workers
   */
  const handleCustomPasswordReset = async (email: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setError('عنوان البريد الإلكتروني غير صالح.');
        return;
      }

      const res = await cfFetch<any>('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail })
      });

      const resetLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://abdomedi.com'}/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(res.token)}`;
      await cfFetch('/api/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          type: 'password_reset',
          resetCode: res.code,
          resetLink
        })
      }).catch(() => null);

      setSuccess('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
    } catch (err: any) {
      console.error('Password Reset Error:', err);
      const msg = String(err?.message || '');
      if (msg.includes('غير مسجل') || err?.status === 404) {
        setError('عذراً، لا يوجد حساب مسجل بهذا البريد الإلكتروني.');
      } else {
        setError(msg || 'حدث خطأ أثناء محاولة إرسال البريد. يرجى المحاولة لاحقاً.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * تفعيل وتوثيق البريد الإلكتروني للمستخدم الحالي عبر Cloudflare Workers
   */
  const handleCustomEmailVerification = async (email?: string, phone?: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const storedRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('cf_auth_user') || localStorage.getItem('current_user') : null;
      const storedUser = storedRaw ? JSON.parse(storedRaw) : null;
      const targetEmail = (email || storedUser?.email || '').trim().toLowerCase();
      const targetPhone = phone || storedUser?.phone;

      if (!targetEmail && !targetPhone) {
        setError('يجب تسجيل الدخول أولاً لإرسال بريد التفعيل.');
        return;
      }

      await cfFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail, phone: targetPhone })
      });

      setSuccess('تم توثيق البريد الإلكتروني على حسابك بنجاح.');
    } catch (err: any) {
      console.error('Email Verification Error:', err);
      setError(err?.message || 'حدث خطأ أثناء محاولة تفعيل البريد.');
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
