import { cfFetch } from '../../services/cloudflareClient';
import { useState } from 'react';

export interface PasswordResetRequestResult {
  ok: boolean;
  deliveryMode?: 'link' | 'otp';
  targetEmail?: string;
  maskedEmail?: string;
  phone?: string;
  resetToken?: string;
  error?: string;
}

function maskEmailAddress(email: string): string {
  const clean = (email || '').trim();
  if (!clean.includes('@')) return clean;
  const [userPart, domain] = clean.split('@');
  return `${userPart.slice(0, 2)}***@${domain}`;
}

export const useAuthActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * إرسال رابط إعادة تعيين كلمة المرور (مع التحقق التلقائي بالرمز كخطة بديلة مضمونة)
   */
  const handleCustomPasswordReset = async (emailOrPhone: string): Promise<PasswordResetRequestResult> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const cleanInput = (emailOrPhone || '').trim();
      if (!cleanInput) {
        const msg = 'يرجى إدخال رقم الموبايل أو البريد الإلكتروني.';
        setError(msg);
        return { ok: false, error: msg };
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://abdomedi.com';
      const res = await cfFetch<any>('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanInput.includes('@') ? cleanInput.toLowerCase() : cleanInput,
          phone: cleanInput,
          origin
        })
      });

      const targetEmail = String(res?.email || (cleanInput.includes('@') ? cleanInput : '')).trim().toLowerCase();
      const maskedEmail = maskEmailAddress(targetEmail);
      const resetToken = String(res?.token || '').trim();

      if (!targetEmail || !targetEmail.includes('@') || targetEmail.includes('@mystore-auth.app')) {
        const msg = 'لا يوجد بريد إلكتروني حقيقي مرتبط بهذا الحساب. يرجى التواصل مع الدعم الفني.';
        setError(msg);
        return { ok: false, error: msg };
      }

      // 1. إذا قام الخادم السحابي بإرسال رابط التعيين مباشرةً
      if (res?.emailSent === true) {
        setSuccess(`تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني (${maskedEmail}).`);
        return {
          ok: true,
          deliveryMode: 'link',
          targetEmail,
          maskedEmail,
          phone: res?.phone,
          resetToken
        };
      }

      // 2. محاولة إرسال رابط التعيين المباشر عبر بريد الخادم المحلي إن وجد
      const resetLink = `${origin}/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(resetToken)}`;
      let linkDelivered = false;
      try {
        const linkRes = await cfFetch<any>('/api/send-password-reset-email', {
          method: 'POST',
          body: JSON.stringify({
            email: targetEmail,
            userName: res?.fullName || 'المستخدم العزيز',
            resetLink,
            resetCode: res?.code
          })
        });
        linkDelivered = Boolean(linkRes?.delivered || linkRes?.success);
      } catch {
        linkDelivered = false;
      }

      if (linkDelivered) {
        setSuccess(`تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني (${maskedEmail}).`);
        return {
          ok: true,
          deliveryMode: 'link',
          targetEmail,
          maskedEmail,
          phone: res?.phone,
          resetToken
        };
      }

      // 3. في حال عدم تهيئة رابط البريد المباشر، نرسل رمز التحقق الأمني (OTP) ليتم تأكيده وتعيين كلمة المرور فوراً من نفس النافذة
      const otpRes = await cfFetch<any>('/api/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: targetEmail,
          phone: res?.phone || cleanInput,
          userName: res?.fullName || 'المستخدم العزيز'
        })
      });

      if (otpRes?.success) {
        setSuccess(`تم إرسال رمز التحقق المكون من 6 أرقام إلى بريدك الإلكتروني (${otpRes?.target || maskedEmail}). أدخل الرمز وكلمة المرور الجديدة أدناه.`);
        return {
          ok: true,
          deliveryMode: 'otp',
          targetEmail,
          maskedEmail: otpRes?.target || maskedEmail,
          phone: res?.phone,
          resetToken
        };
      }

      const fallbackErr = otpRes?.error || 'تعذر إرسال بريد الاستعادة حالياً.';
      setError(fallbackErr);
      return { ok: false, error: fallbackErr };
    } catch (err: any) {
      console.error('Password Reset Error:', err);
      const msg = String(err?.message || '');
      const friendly = (msg.includes('غير مسجل') || msg.includes('لا يوجد حساب') || err?.status === 404)
        ? 'عذراً، لا يوجد حساب مسجل بهذه البيانات.'
        : (msg || 'حدث خطأ أثناء محاولة إرسال البريد. يرجى المحاولة لاحقاً.');
      setError(friendly);
      return { ok: false, error: friendly };
    } finally {
      setLoading(false);
    }
  };

  /**
   * تأكيد رمز التحقق المرسل للبريد وتحديث كلمة المرور فوراً
   */
  const confirmOtpPasswordReset = async (params: {
    email: string;
    phone?: string;
    otp: string;
    resetToken: string;
    newPassword: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    setLoading(true);
    setError(null);
    try {
      const verifyRes = await cfFetch<any>('/api/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          phone: params.phone || '',
          otp: params.otp.trim()
        })
      });

      if (!verifyRes?.valid) {
        const errMsg = verifyRes?.message || verifyRes?.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية.';
        setError(errMsg);
        return { ok: false, error: errMsg };
      }

      await cfFetch('/api/auth/action', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'resetPassword',
          oobCode: params.resetToken,
          newPassword: params.newPassword
        })
      });

      setSuccess('تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.');
      return { ok: true };
    } catch (err: any) {
      const errMsg = err?.message || 'حدث خطأ أثناء تأكيد الرمز وتحديث كلمة المرور.';
      setError(errMsg);
      return { ok: false, error: errMsg };
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
    confirmOtpPasswordReset,
    handleCustomEmailVerification,
    loading,
    error,
    success,
    setError,
    setSuccess
  };
};
