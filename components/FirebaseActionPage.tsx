import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getSupabaseSession,
  updateSupabasePassword,
  verifySupabaseEmailOtp
} from '../services/supabaseAuthService';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

type Mode = 'resetPassword' | 'verifyEmail' | null;

export default function FirebaseActionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const typeParam = searchParams.get('type') || searchParams.get('mode');
  const mode: Mode =
    typeParam === 'recovery' || typeParam === 'resetPassword'
      ? 'resetPassword'
      : typeParam === 'signup' || typeParam === 'email' || typeParam === 'verifyEmail'
        ? 'verifyEmail'
        : null;
  const tokenHash = searchParams.get('token_hash');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    const handleAction = async () => {
      try {
        if (!mode) {
          throw new Error('نوع الرابط غير معروف. يرجى طلب رابط جديد من صفحة تسجيل الدخول.');
        }

        // Supabase PKCE links exchange the ?code= parameter automatically
        // through detectSessionInUrl. Token-hash links are verified explicitly.
        if (tokenHash) {
          const otpType = typeParam === 'recovery' ? 'recovery' : 'signup';
          const user = await verifySupabaseEmailOtp(tokenHash, otpType);
          if (!active) return;
          setEmail(user.email || null);
          if (mode === 'verifyEmail') {
            setSuccess(true);
            triggerConfetti();
          }
          setLoading(false);
          return;
        }

        const session = await getSupabaseSession();
        if (!active) return;
        if (!session?.user) {
          throw new Error('الرابط منتهي أو غير صالح أو تم استخدامه من قبل. اطلب رابطاً جديداً.');
        }
        setEmail(session.user.email || null);
        if (mode === 'verifyEmail') {
          setSuccess(true);
          triggerConfetti();
        }
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        console.error('Supabase Auth Action Error:', err);
        setError(err?.message || 'تعذر التحقق من الرابط. يرجى طلب رابط جديد.');
        setLoading(false);
      }
    };

    void handleAction();
    return () => { active = false; };
  }, [mode, tokenHash, typeParam]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      setError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setResetting(true);
    setError(null);
    try {
      await updateSupabasePassword(newPassword);
      setSuccess(true);
      triggerConfetti();
    } catch (err: any) {
      console.error('Supabase Password Update Error:', err);
      setError(err?.message || 'تعذر تحديث كلمة المرور. يرجى طلب رابط استعادة جديد.');
    } finally {
      setResetting(false);
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#a855f7', '#ec4899']
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            <Loader2 className="w-12 h-12 text-indigo-600" />
          </motion.div>
          <p className="mt-4 text-gray-600 font-medium">جاري التحقق من الرابط...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-indigo-100 overflow-hidden border border-gray-100"
      >
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
              {mode === 'resetPassword' ? <Lock className="w-8 h-8" /> : <Mail className="w-8 h-8" />}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === 'resetPassword' ? 'إعادة تعيين كلمة المرور' : 'تفعيل الحساب'}
            </h1>
            {email && !success && (
              <p className="mt-2 text-gray-500 text-sm">
                للحساب: <span className="font-medium text-gray-700">{email}</span>
              </p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-4"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 text-red-500 mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-red-600 font-medium mb-6">{error}</p>
                <button
                  onClick={() => navigate('/owner-login')}
                  className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  العودة لتسجيل الدخول
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            ) : success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-500 mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">تم بنجاح!</h2>
                <p className="text-gray-600 mb-8">
                  {mode === 'resetPassword' 
                    ? 'تم تحديث كلمة المرور الخاصة بك بنجاح. يمكنك الآن تسجيل الدخول.' 
                    : 'تم تفعيل بريدك الإلكتروني بنجاح. يمكنك الآن استخدام كافة ميزات المنصة.'}
                </p>
                <button
                  onClick={() => navigate('/owner-login')}
                  className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group"
                >
                  تسجيل الدخول الآن
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-[-4px] transition-transform" />
                </button>
              </motion.div>
            ) : mode === 'resetPassword' ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleResetPassword}
                className="space-y-5"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 mr-1">
                    كلمة المرور الجديدة
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none pl-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 mr-1">
                    تأكيد كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none pl-12"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-xs text-indigo-800 leading-relaxed">
                    تأكد من اختيار كلمة مرور قوية تحتوي على مزيج من الأحرف والأرقام لضمان أمان حسابك.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={resetting}
                  className="w-full py-4 px-6 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  {resetting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'تحديث كلمة المرور'
                  )}
                </button>
              </motion.form>
            ) : null}
          </AnimatePresence>
        </div>
        
        {/* Footer info */}
        <div className="bg-gray-50 p-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} abdomedi.com - جميع الحقوق محفوظة
          </p>
        </div>
      </motion.div>
    </div>
  );
}
