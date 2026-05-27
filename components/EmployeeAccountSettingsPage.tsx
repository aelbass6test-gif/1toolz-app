
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Save, CheckCircle, User as UserIcon } from 'lucide-react';

interface EmployeeAccountSettingsPageProps {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const EmployeeAccountSettingsPage: React.FC<EmployeeAccountSettingsPageProps> = ({ currentUser, setCurrentUser, users, setUsers }) => {
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setFormData({
        fullName: currentUser.fullName,
        email: currentUser.email,
        phone: currentUser.phone,
        password: '',
        confirmPassword: ''
      });
    }
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowSuccess(false);

    if (!currentUser) return;

    if (formData.password && formData.password !== formData.confirmPassword) {
        setError('كلمتا المرور غير متطابقتين.');
        return;
    }
    if (formData.password && formData.password.length < 8) {
        setError('يجب أن تكون كلمة المرور 8 أحرف على الأقل.');
        return;
    }
    
    const updatedUser: User = {
      ...currentUser,
      fullName: formData.fullName.trim(),
      password: formData.password ? formData.password : currentUser.password,
    };

    setCurrentUser(updatedUser);
    setUsers(users.map(u => u.phone === currentUser.phone ? updatedUser : u));

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setFormData(prev => ({...prev, password: '', confirmPassword: ''}));
  };

  if (!currentUser) {
    return <div className="text-center p-10">الرجاء تسجيل الدخول لعرض هذه الصفحة.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-right pb-12 px-4" dir="rtl">
        <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <UserIcon />
                إعدادات حسابي
            </h1>
            <p className="text-slate-500 mt-1">قم بتحديث بياناتك الشخصية وكلمة المرور.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            <div className="p-6 space-y-6">
                <FormInput label="الاسم الكامل" name="fullName" value={formData.fullName} onChange={handleChange} />
                <FormInput label="البريد الإلكتروني" name="email" value={formData.email} type="email" readOnly />
                <FormInput label="رقم الهاتف" name="phone" value={formData.phone} readOnly />
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                    <p className="font-bold mb-2">تغيير كلمة المرور</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormInput label="كلمة المرور الجديدة" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="اتركها فارغة لعدم التغيير" />
                        <FormInput label="تأكيد كلمة المرور" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} />
                    </div>
                </div>
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center gap-4">
                {showSuccess && <span className="text-sm text-green-600 animate-pulse flex items-center gap-1"><CheckCircle size={16}/> تم الحفظ بنجاح!</span>}
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
                    <Save size={16}/>
                    حفظ التغييرات
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
      className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
    />
  </div>
);

export default EmployeeAccountSettingsPage;
