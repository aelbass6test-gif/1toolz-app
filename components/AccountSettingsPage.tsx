import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Save, CheckCircle } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const updatedUser: User = {
      ...currentUser,
      fullName: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email, 
    };

    setCurrentUser(updatedUser);
    setUsers(users.map(u => u.phone === currentUser.phone ? updatedUser : u));

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
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
                    <FormInput label="البريد الإلكتروني" name="email" value={formData.email} onChange={handleChange} type="email" />
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
                {showSuccess && <span className="text-sm text-green-600 animate-pulse">تم الحفظ بنجاح!</span>}
                <button type="submit" className="bg-teal-500 text-white px-6 py-2 rounded-md font-semibold hover:bg-teal-600 transition-colors shadow-sm">
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