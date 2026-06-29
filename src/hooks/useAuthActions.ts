import { 
  sendPasswordResetEmail, 
  sendEmailVerification, 
  ActionCodeSettings 
} from 'firebase/auth';
import { auth } from '../../services/firebaseClient';
import { useState } from 'react';

/**
 * إعدادات الـ Action Code للتحويل إلى الرابط المخصص
 */
const actionCodeSettings: ActionCodeSettings = {
  // الرابط الذي سيتم توجيه المستخدم إليه بعد الضغط على لينك الإيميل
  url: 'https://abdomedi.com/auth/action',
  // يجب أن يكون true لضمان معالجة الكود داخل التطبيق
  handleCodeInApp: true,
  // اختياري: إذا كان لديك تطبيق موبايل وتريد فتحه مباشرة
  /*
  iOS: {
    bundleId: 'com.abdomedi.ios'
  },
  android: {
    packageName: 'com.abdomedi.android',
    installApp: true,
    minimumVersion: '12'
  },
  */
};

export const useAuthActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * إرسال بريد إعادة تعيين كلمة المرور
   */
  const handleCustomPasswordReset = async (email: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSuccess('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
    } catch (err: any) {
      console.error('Password Reset Error:', err);
      switch (err.code) {
        case 'auth/user-not-found':
          setError('عذراً، لا يوجد حساب مسجل بهذا البريد الإلكتروني.');
          break;
        case 'auth/invalid-email':
          setError('عنوان البريد الإلكتروني غير صالح.');
          break;
        case 'auth/too-many-requests':
          setError('لقد قمت بمحاولات كثيرة جداً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.');
          break;
        default:
          setError('حدث خطأ أثناء محاولة إرسال البريد. يرجى المحاولة لاحقاً.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * إرسال بريد تفعيل الحساب للمستخدم الحالي
   */
  const handleCustomEmailVerification = async () => {
    if (!auth.currentUser) {
      setError('يجب تسجيل الدخول أولاً لإرسال بريد التفعيل.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await sendEmailVerification(auth.currentUser, actionCodeSettings);
      setSuccess('تم إرسال رابط تفعيل الحساب إلى بريدك الإلكتروني بنجاح.');
    } catch (err: any) {
      console.error('Email Verification Error:', err);
      switch (err.code) {
        case 'auth/too-many-requests':
          setError('لقد طلبت بريداً إلكترونياً بالفعل. يرجى التحقق من صندوق الوارد أو المحاولة لاحقاً.');
          break;
        default:
          setError('حدث خطأ أثناء محاولة إرسال بريد التفعيل.');
      }
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
