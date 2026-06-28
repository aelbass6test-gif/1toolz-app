import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Save, CheckCircle, Loader2 } from 'lucide-react';
import { auth } from '../services/firebaseClient';
import { verifyBeforeUpdateEmail } from 'firebase/auth';
import { updateUserInSupabase } from '../services/databaseService';

interface AccountSettingsPageProps {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const AccountSettingsPage: React.FC<AccountSettingsPageProps> = ({ currentUser, setCurrentUser, users, setUsers }) => {
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    language: 'العربية',
    country: 'Egypt'
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      const nameParts = currentUser.fullName.split(' ');
      const firstName = nameParts.shift() || '';
      const lastName = nameParts.join(' ');

      setFormData({
        firstName: firstName,
        lastName: lastName,
        email: currentUser.email,
        phone: currentUser.phone,
        language: 'العربية',
        country: 'Egypt'
      });
    }
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSaving(true);
    setError('');

    try {
      const updatedUser: User = {
        ...currentUser,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email, 
      };

      // 1. Update Firebase Auth Email if it's a real email and changed
      if (formData.email && formData.email.includes('@') && auth.currentUser) {
        const currentAuthEmail = auth.currentUser.email;
        if (currentAuthEmail !== formData.email) {
          // Check if the NEW email is a system-generated one (user trying to "revert" or something)
          if (formData.email.includes('@mystore-auth.app')) {
             setError('لا يمكن استخدام بريد النظام المؤقت كبريد أساسي للتواصل. يرجى إدخال بريد إلكتروني حقيقي (Gmail, Outlook, etc).');
             setIsSaving(false);
             return;
          }

          try {
            console.log('[AUTH] Attempting to initiate email update in Firebase Auth from', currentAuthEmail, 'to', formData.email);
            // verifyBeforeUpdateEmail is the modern, secure way that handles the "verify before update" policy
            await verifyBeforeUpdateEmail(auth.currentUser, formData.email);
            console.log('[AUTH] Email verification sent successfully');
            setSuccessMessage(`تم إرسال رابط تأكيد إلى: ${formData.email}. (يرجى مراجعة صندوق البريد الوارد أو الـ Spam). اضغط على الرابط في الرسالة لتتمكن من استعادة كلمة المرور بهذا البريد لاحقاً.`);
          } catch (authErr: any) {
            console.warn('[AUTH] Failed to initiate email update in Firebase Auth:', authErr);
            if (authErr.code === 'auth/requires-recent-login') {
               setError('لدواعي أمنية، يجب إعادة تسجيل الدخول لتغيير البريد الإلكتروني (Session Expired).');
               setIsSaving(false);
               return;
            } else if (authErr.code === 'auth/email-already-in-use') {
               setError('هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.');
               setIsSaving(false);
               return;
            } else if (authErr.code === 'auth/invalid-email') {
               setError('البريد الإلكتروني المدخل غير صالح.');
               setIsSaving(false);
               return;
            } else if (authErr.code === 'auth/operation-not-allowed') {
               setError('خاصية تحديث البريد معطلة في إعدادات Firebase (Email/Password). يرجى تفعيلها من لوحة التحكم.');
               setIsSaving(false);
               return;
            } else {
               setError(`حدث خطأ غير متوقع: ${authErr.message || 'يرجى المحاولة لاحقاً'}`);
               setIsSaving(false);
               return;
            }
          }
        }
      }

      // 2. Update Supabase for forgot password lookup
      const sbResult = await updateUserInSupabase(updatedUser);
      if (!sbResult.success) {
        console.warn('[SUPABASE] Update failed:', sbResult.error);
        // If it's a duplicate email error from Supabase, we should still show it even if Firebase succeeded 
        // (though usually they both would fail if the email is truly in use)
        if (sbResult.error?.includes('بالفعل')) {
          setError(sbResult.error);
          setIsSaving(false);
          return;
        }
      }

      // 3. Update State (which triggers Firestore save via App.tsx useEffect)
      setCurrentUser(updatedUser);
      setUsers(users.map(u => u.phone === currentUser.phone ? updatedUser : u));

      if (!successMessage) {
        setSuccessMessage('تم الحفظ بنجاح!');
      }
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
      }, 5000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError('حدث خطأ أثناء حفظ البيانات. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) {
    return <div className="text-center p-10">الرجاء تسجيل الدخول لعرض هذه الصفحة.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-right pb-12 px-4" dir="rtl">
        <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">إعدادات الحساب</h1>
            <p className="text-slate-500 mt-1">تأكد من إدخال بياناتك الصحيحة لحماية حسابك وسهولة تسجيل الدخول والتواصل.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-semibold">بيانات التواصل</h2>
            </div>
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput label="الاسم الأول" name="firstName" value={formData.firstName} onChange={handleChange} />
                    <FormInput label="الاسم الأخير" name="lastName" value={formData.lastName} onChange={handleChange} />
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">البريد الإلكتروني (لاستعادة كلمة المرور)</label>
                      <div className="relative">
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={`block w-full px-3 py-2 bg-white dark:bg-slate-800 border ${auth.currentUser?.email === formData.email ? 'border-slate-300 dark:border-slate-600' : 'border-amber-300 dark:border-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.2)]'} rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm`}
                          placeholder="example@gmail.com"
                        />
                        <div className="mt-1 flex items-center justify-between px-1">
                          {auth.currentUser?.email === formData.email ? (
                            <span className="text-[10px] text-green-500 flex items-center gap-1 font-bold">
                              <CheckCircle size={10} />
                              مرتبط ببيانات الدخول (Firebase)
                            </span>
                          ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-amber-500 font-bold">غير مرتبط ببيانات الدخول - اضغط حفظ للمزامنة</span>
                                {auth.currentUser?.email?.includes('@mystore-auth.app') ? (
                                  <span className="text-[10px] text-red-500 font-black animate-pulse">
                                    ⚠️ يجب ربط بريدك الحقيقي (Gmail/Outlook) لتتمكن من استعادة كلمة المرور لاحقاً.
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-indigo-500 font-bold">
                                    ℹ️ لتفعيل استعادة كلمة المرور بهذا البريد، يجب تأكيد الرابط المرسل إليك أولاً.
                                  </span>
                                )}
                                {auth.currentUser?.email !== formData.email && formData.email && (
                                  <button 
                                    type="button" 
                                    onClick={handleSubmit}
                                    className="text-[9px] text-blue-600 hover:underline text-right mt-1"
                                  >
                                    إعادة إرسال رابط التأكيد؟
                                  </button>
                                )}
                              </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الهاتف</label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-500 dark:text-slate-400">
                                +{formData.phone}
                            </div>
                            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                                <CheckCircle size={14}/> تم التحقق
                            </span>
                            <button type="button" className="px-4 py-2 text-sm font-semibold border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">تغيير</button>
                        </div>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormSelect label="اللغة المفضلة" name="language" value={formData.language} onChange={handleChange}>
                        <option value="العربية">العربية</option>
                        <option value="English">English</option>
                    </FormSelect>
                     <FormSelect label="بلد الإقامة" name="country" value={formData.country} onChange={handleChange}>
                        <option value="Egypt">Egypt</option>
                        <option value="Saudi Arabia">Saudi Arabia</option>
                        <option value="United Arab Emirates">United Arab Emirates</option>
                    </FormSelect>
                </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center gap-4">
                {showSuccess && <span className="text-sm text-green-600 animate-pulse font-bold">{successMessage}</span>}
                {error && <span className="text-sm text-red-600">{error}</span>}
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-teal-500 text-white px-6 py-2 rounded-md font-semibold hover:bg-teal-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : null}
                    حفظ
                </button>
            </div>
        </form>
    </div>
  );
};


interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}
const FormInput: React.FC<FormInputProps> = ({ label, ...props }) => (
  <div>
    <label htmlFor={props.id || props.name} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
      {label}
    </label>
    <input
      {...props}
      id={props.id || props.name}
      className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
    />
  </div>
);

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
}
const FormSelect: React.FC<FormSelectProps> = ({ label, children, ...props }) => (
    <div>
        <label htmlFor={props.id || props.name} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label}
        </label>
        <select
             {...props}
             id={props.id || props.name}
             className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
        >
            {children}
        </select>
    </div>
)

export default AccountSettingsPage;