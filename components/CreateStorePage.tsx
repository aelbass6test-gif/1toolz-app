import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Move, Grid3x3, Palette, LayoutTemplate, MonitorSmartphone, 
  Sparkles, CheckCircle2, Globe, ShieldCheck, ArrowLeft, Store as StoreIcon,
  Coins, Layers, Rocket
} from 'lucide-react';
import { User, Store } from '../types';
import { motion } from 'framer-motion';

interface CreateStorePageProps {
  currentUser: User | null;
  onStoreCreated: (store: Store) => void;
}

const FeatureItem: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; }> = ({ icon, title, subtitle }) => (
  <div className="flex items-start gap-4 text-right group">
    <div className="flex-shrink-0 p-3 bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800/60 text-teal-600 dark:text-teal-400 rounded-2xl group-hover:scale-110 transition-transform shadow-sm">
      {icon}
    </div>
    <div>
      <h3 className="font-bold text-slate-800 dark:text-white text-base">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{subtitle}</p>
    </div>
  </div>
);

const CreateStorePage: React.FC<CreateStorePageProps> = ({ currentUser, onStoreCreated }) => {
  const [storeName, setStoreName] = useState('');
  const [specialization, setSpecialization] = useState('الصحة والجمال');
  const [language, setLanguage] = useState('عربي');
  const [currency, setCurrency] = useState('EGP');
  const [selectedPreset, setSelectedPreset] = useState('modern');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Auto-calculated live subdomain preview
  const slug = storeName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const previewDomain = slug ? `${slug.substring(0, 20)}.abdomedi.com` : 'yourstore.abdomedi.com';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!storeName.trim()) {
      setError('يرجى إدخال اسم المتجر بشكل صحيح.');
      return;
    }
    
    if (!currentUser) {
      setError('يجب أن تكون مسجلاً للدخول لإنشاء متجر.');
      return;
    }
    
    const cleanSlug = slug || 'store';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const generatedSubdomain = `${cleanSlug.substring(0, 20)}-${randomSuffix}`;
    const uniqueUrl = `${generatedSubdomain}.abdomedi.com`;

    const newStore: Store = {
      id: `store-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: storeName,
      specialization,
      language,
      currency,
      url: uniqueUrl,
      subdomain: generatedSubdomain,
      creationDate: new Date().toISOString(),
    };
    
    onStoreCreated(newStore);
    navigate('/');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] py-10 px-4 md:px-8 max-w-7xl mx-auto flex items-center" dir="rtl">
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
        {/* Left Informational Column */}
        <div className="lg:col-span-6 text-right space-y-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/80 px-3.5 py-1.5 rounded-full">
              <Sparkles size={14} className="animate-spin text-teal-500" />
              منصة تجارة إلكترونية سريعة ومتطورة
            </span>

            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight">
              أنشئ موقعك أو متجرك الإلكتروني <span className="bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">بطريقتك الخاصة</span>
            </h1>

            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium">
              طوّر منصتك وسهّل البيع لعملائك باستخدام أدوات السحب والإفلات والتخصيص الفوري.
            </p>
          </div>

          <div className="space-y-6 pt-2">
            <FeatureItem 
              icon={<Move size={22}/>} 
              title="أدوات تخصيص وتصميم مرنة" 
              subtitle="اختر القالب الأنسب لعلامتك التجارية وخصّص الألوان والصفحات بضغطة زر واحدة." 
            />
            <FeatureItem 
              icon={<Grid3x3 size={22}/>} 
              title="نظام شبكي متناسق ودقيق" 
              subtitle="تضمن الشاشات جودة عرض ممتازة على كافة أجهزة الكمبيوتر والهواتف الذكية." 
            />
            <FeatureItem 
              icon={<Palette size={22}/>} 
              title="مظهر وتصميم احترافي" 
              subtitle="اختر بين الأنماط العصرية، المظهر الداكن، أو التصميم الجريء المناسب لمنتجاتك." 
            />
            <FeatureItem 
              icon={<MonitorSmartphone size={22}/>} 
              title="تحكم وتوافق كامل عبر الجوال" 
              subtitle="إدارة سريعة للطلبات والمنتجات والمخزون أينما كنت مباشرة من هاتفك." 
            />
          </div>
        </div>

        {/* Right Creation Form Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-6 w-full bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-600" />

          <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <StoreIcon size={22} />
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">إنشاء متجر جديد</h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 pr-11">
              أدخل بيانات متجرك الأساسية للبدء في إضافة المنتجات فوراً.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="storeName" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                اسم المتجر الإلكتروني *
              </label>
              <input
                id="storeName"
                type="text"
                placeholder="مثال: متجر الأناقة للموضة"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>

            {/* Live Subdomain Preview Box */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Globe size={15} className="text-teal-500 shrink-0" />
                <span>رابط المتجر الافتراضي:</span>
              </div>
              <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 dir-ltr truncate">
                {previewDomain}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="specialization" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  تخصص المتجر
                </label>
                <select
                  id="specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option>الصحة والجمال</option>
                  <option>ملابس وموضة</option>
                  <option>إلكترونيات وأجهزة</option>
                  <option>أدوات منزلية</option>
                  <option>عدد وأدوات يدوي</option>
                  <option>أغذية ومشروبات</option>
                  <option>أخرى</option>
                </select>
              </div>

              <div>
                <label htmlFor="language" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  لغة الواجهة
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="عربي">العربية (Arabic)</option>
                  <option value="English">الانجليزية (English)</option>
                </select>
              </div>
            </div>

            {/* Currency Choice */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Coins size={15} className="text-emerald-500" />
                عملة المتجر الرئيسية
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'EGP', label: 'جنيه مصري (EGP)' },
                  { code: 'SAR', label: 'ريال سعودي (SAR)' },
                  { code: 'USD', label: 'دولار أمريكي (USD)' },
                ].map(item => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setCurrency(item.code)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                      currency === item.code
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-700 dark:text-teal-300 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preset Theme Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Layers size={15} className="text-indigo-500" />
                قالب ومتهم المتجر الأولي
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'modern', title: 'عصري ناصع' },
                  { id: 'dark', title: 'داكن فاخر' },
                  { id: 'vibrant', title: 'حيوي جذاب' },
                ].map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all text-center ${
                      selectedPreset === preset.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>
            
            {error && (
              <p className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-2xl border border-rose-200 dark:border-rose-800 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black py-4 rounded-2xl shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all flex items-center justify-center gap-2 text-sm active:scale-98"
            >
              <Rocket size={18} />
              <span>إطلاق وإنشاء المتجر الآن</span>
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateStorePage;
