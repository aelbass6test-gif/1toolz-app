
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Move, Grid3x3, Palette, LayoutTemplate, MonitorSmartphone } from 'lucide-react';
import { User, Store } from '../types';

interface CreateStorePageProps {
  currentUser: User | null;
  onStoreCreated: (store: Store) => void;
}

const FeatureItem: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; }> = ({ icon, title, subtitle }) => (
    <div className="flex items-start gap-4 text-right">
        <div className="flex-shrink-0 p-3 bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 rounded-lg">
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-slate-800 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
    </div>
);


const CreateStorePage: React.FC<CreateStorePageProps> = ({ currentUser, onStoreCreated }) => {
  const [storeName, setStoreName] = useState('');
  const [specialization, setSpecialization] = useState('الصحة والجمال');
  const [language, setLanguage] = useState('عربي');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!storeName.trim()) {
      setError('يرجى إدخال اسم المتجر.');
      return;
    }
    
    if (!currentUser) {
        setError('يجب أن تكون مسجلاً للدخول لإنشاء متجر.');
        return;
    }
    
    // Simple slugify function for the URL
    const slug = storeName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const uniqueUrl = `${slug}-${Math.random().toString(36).substring(2, 8)}.wuitstore.com`;

    const newStore: Store = {
      id: `store-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: storeName,
      specialization,
      language,
      currency: 'EGP',
      url: uniqueUrl,
      creationDate: new Date().toISOString(),
    };
    
    onStoreCreated(newStore);
    navigate('/');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center p-4">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="text-right space-y-6">
                <h1 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white leading-tight">
                    أنشئ موقعك او متجرك الإلكتروني بطريقتك الخاصة
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400">
                    طوّر موقعك الإلكتروني بكل سهولة باستخدام أدوات التخصيص البديهية وسهلة الاستخدام.
                </p>
                <div className="space-y-5 pt-4">
                    <FeatureItem 
                        icon={<Move size={24}/>} 
                        title="السحب والإفلات" 
                        subtitle="ببساطة، اختر المحتوى الذي ترغب به، اسحبه إلى المكان الذي تريده، وأفلته في مكانه." 
                    />
                    <FeatureItem 
                        icon={<Grid3x3 size={24}/>} 
                        title="استخدم الشبكة الذكية" 
                        subtitle="حافظ على محاذاة كل العناصر بدقّة أثناء ضبط موقعك الإلكتروني." 
                    />
                    <FeatureItem 
                        icon={<Palette size={24}/>} 
                        title="غيّر الألوان والخطوط" 
                        subtitle="استكشف جوهر علامتك التجارية أو مشروعك." 
                    />
                     <FeatureItem 
                        icon={<LayoutTemplate size={24}/>} 
                        title="خصّص العناصر" 
                        subtitle="أعد ترتيب العناصر لإنشاء الموقع الإلكتروني او متجرك الذي لطالما رغبت فيه." 
                    />
                    <FeatureItem 
                        icon={<MonitorSmartphone size={24}/>} 
                        title="تحرير عبر الكمبيوتر والجوال" 
                        subtitle="أنشئ موقعك و متجرك الإلكتروني وحرّره وانشره بسهولة على الجهاز الذي تفضله." 
                    />
                </div>
            </div>

            <div className="w-full max-w-lg bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-right lg:justify-self-end">
                <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">أنشئ متجرًا جديدًا</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-6">املأ التفاصيل التالية لبدء متجرك.</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="storeName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    اسم المتجر الإلكتروني
                    </label>
                    <input
                    id="storeName"
                    type="text"
                    placeholder="أدخل اسم المتجر"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                <div>
                    <label htmlFor="specialization" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    تخصص المتجر
                    </label>
                    <select
                    id="specialization"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                    >
                    <option>الصحة والجمال</option>
                    <option>ملابس وموضة</option>
                    <option>إلكترونيات</option>
                    <option>أدوات منزلية</option>
                    <option>أخرى</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="language" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    لغة المتجر
                    </label>
                    <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                    >
                    <option>عربي</option>
                    <option>English</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    عملة المتجر
                    </label>
                    <div className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 flex justify-between items-center">
                    <span>جنيه مصري (EGP)</span>
                    <a href="#" className="text-teal-600 text-xs font-bold hover:underline">تغيير العملة؟</a>
                    </div>
                </div>
                
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                <button
                    type="submit"
                    className="w-full bg-teal-600 text-white font-bold py-4 rounded-lg hover:bg-teal-700 transition-colors duration-300 shadow-lg shadow-teal-500/20"
                >
                    أنشئ متجرك
                </button>
                </form>
            </div>
        </div>
    </div>
  );
};

export default CreateStorePage;