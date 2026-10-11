import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Save, 
  CheckCircle, 
  User as UserIcon, 
  ShieldCheck, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  Clock, 
  Sliders, 
  History,
  Lock,
  Phone,
  Mail,
  Check
} from 'lucide-react';
import { auth, db } from '../services/firebaseClient';
import { updatePassword as firebaseUpdatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { playNotificationChime } from './EmployeeLayout';

interface EmployeeAccountSettingsPageProps {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

export const EmployeeAccountSettingsPage: React.FC<EmployeeAccountSettingsPageProps> = ({ 
  currentUser, 
  setCurrentUser, 
  users, 
  setUsers 
}) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Operational preferences stored in localStorage
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('sound_notifications_muted') !== 'true';
    } catch {
      return true;
    }
  });

  const [whatsappWebMode, setWhatsappWebMode] = useState(() => {
    try {
      return localStorage.getItem('emp_wa_mode') || 'web';
    } catch {
      return 'web';
    }
  });

  // Shift Attendance History
  const shiftHistory = React.useMemo(() => {
    if (!currentUser?.phone) return [];
    try {
      const raw = localStorage.getItem(`emp_shift_history_${currentUser.phone}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        fullName: currentUser.fullName,
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        password: '',
        confirmPassword: ''
      });
    }
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Password Strength Calculator
  const passwordStrength = React.useMemo(() => {
    const p = formData.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p) || /[a-z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;
    return score;
  }, [formData.password]);

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      localStorage.setItem('sound_notifications_muted', enabled ? 'false' : 'true');
    } catch {}
    if (enabled) {
      playNotificationChime();
    }
  };

  const handleToggleWaMode = (mode: string) => {
    setWhatsappWebMode(mode);
    try {
      localStorage.setItem('emp_wa_mode', mode);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowSuccess(false);

    if (!currentUser) return;

    if (formData.password) {
      if (formData.password !== formData.confirmPassword) {
        setError('كلمتا المرور غير متطابقتين.');
        return;
      }
      if (formData.password.length < 6) {
        setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل.');
        return;
      }
    }

    setLoading(true);

    try {
      // 1. If password is provided, try updating in Firebase Auth
      if (formData.password && auth.currentUser) {
        try {
          await firebaseUpdatePassword(auth.currentUser, formData.password);
        } catch (authErr: any) {
          console.warn('Firebase Auth direct update warning (may need reauth):', authErr);
        }
      }

      // 2. Update user document in Firestore if phone exists
      if (currentUser.phone) {
        try {
          const userDocRef = doc(db, 'users', currentUser.phone);
          const updatePayload: Record<string, any> = {
            fullName: formData.fullName.trim()
          };
          if (formData.password) {
            updatePayload.password = formData.password;
          }
          await updateDoc(userDocRef, updatePayload);
        } catch (dbErr) {
          console.warn('Firestore update warning:', dbErr);
        }
      }

      const updatedUser: User = {
        ...currentUser,
        fullName: formData.fullName.trim(),
        ...(formData.password ? { password: formData.password } : {})
      };

      setCurrentUser(updatedUser);
      setUsers(users.map(u => u.phone === currentUser.phone ? updatedUser : u));

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return <div className="text-center p-10 font-bold text-slate-500">الرجاء تسجيل الدخول لعرض هذه الصفحة.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-right pb-12 px-3 sm:px-4" dir="rtl">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <UserIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">إعدادات حسابي والأمان</h1>
            <p className="text-xs text-slate-500 mt-0.5">تحديث بياناتك الشخصية، كلمة المرور وتفضيلات بيئة العمل.</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-black">
          <ShieldCheck size={14} />
          <span>حساب موظف معتمد</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Personal Details Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <UserIcon size={16} className="text-emerald-600" />
            <span>البيانات الشخصية</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">الاسم بالكامل</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">رقم الهاتف (اسم المستخدم)</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.phone}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-500 outline-none cursor-not-allowed dir-ltr text-right"
                />
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">البريد الإلكتروني المعتمد</label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-500 outline-none cursor-not-allowed dir-ltr text-right"
                />
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound size={16} className="text-emerald-600" />
              <span>تغيير كلمة المرور</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold">اتركها فارغة إذا لم ترغب بتغييرها</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="كلمة مرور جديدة (6 أحرف فأكثر)"
                  className="w-full pr-3.5 pl-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {formData.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    <div className={`flex-1 rounded-full ${passwordStrength >= 1 ? 'bg-rose-500' : 'bg-slate-200'}`} />
                    <div className={`flex-1 rounded-full ${passwordStrength >= 2 ? 'bg-amber-500' : 'bg-slate-200'}`} />
                    <div className={`flex-1 rounded-full ${passwordStrength >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    <div className={`flex-1 rounded-full ${passwordStrength >= 4 ? 'bg-teal-500' : 'bg-slate-200'}`} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">
                    قوة كلمة المرور: {passwordStrength <= 1 ? 'ضعيفة' : passwordStrength <= 2 ? 'متوسطة' : 'قوية جداً'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">تأكيد كلمة المرور الجديدة</label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="أعد إدخال كلمة المرور"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Operational Work Preferences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders size={16} className="text-emerald-600" />
            <span>تفضيلات بيئة العمل للوردية</span>
          </h3>

          <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
            {/* Audio Toggle */}
            <div className="pt-3 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-white block">نغمات وتنبيهات الأوردرات الصوتية</span>
                <span className="text-[11px] text-slate-400 block">تشغيل تنبيه لطيف عند وصول أوردرات أو رسائل جديدة</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => playNotificationChime()}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-emerald-600 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  تجربة الصوت
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSound(!soundEnabled)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${soundEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'}`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>

            {/* WhatsApp mode */}
            <div className="pt-3 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-white block">طريقة فتح محادثات الواتساب</span>
                <span className="text-[11px] text-slate-400 block">اختر تطبيق الواتساب المفضل لديك للردود السريعة</span>
              </div>

              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleToggleWaMode('web')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${whatsappWebMode === 'web' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'}`}
                >
                  WhatsApp Web
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleWaMode('app')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${whatsappWebMode === 'app' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'}`}
                >
                  تطبيق الهاتف / الكمبيوتر
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Shift Attendance History Summary */}
        {shiftHistory.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
            <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <History size={16} className="text-emerald-600" />
              <span>سجل حضور الورديات السابقة (آخر الورديات)</span>
            </h3>

            <div className="space-y-2">
              {shiftHistory.slice(0, 5).map((shift: any, index: number) => {
                const hours = Math.floor((shift.durationSeconds || 0) / 3600);
                const minutes = Math.floor(((shift.durationSeconds || 0) % 3600) / 60);

                return (
                  <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {new Date(shift.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                    </span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {hours > 0 ? `${hours} ساعة و ` : ''}{minutes} دقيقة عمل
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold text-center border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        {/* Form Actions */}
        <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            {showSuccess && (
              <span className="text-xs font-bold text-emerald-600 animate-pulse flex items-center gap-1.5">
                <CheckCircle size={16} />
                <span>تم حفظ التعديلات بنجاح!</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            <span>{loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeAccountSettingsPage;
