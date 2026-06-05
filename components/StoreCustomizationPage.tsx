import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, StoreCustomization, Store, StoreSection, Banner } from '../types';
import { 
  Brush, Save, Image, Type, Info, CheckCircle, Eye, Palette, LayoutDashboard, 
  CaseSensitive, Megaphone, Share2, Link as LinkIcon, LayoutTemplate, 
  GripVertical, ChevronsUpDown, X, Star, Plus, Trash2, Edit3, ShoppingCart, 
  Smartphone, Tablet, Monitor, ArrowUp, ArrowDown, Sparkles, Sliders, Check 
} from 'lucide-react';
import StorefrontPage from './StorefrontPage';

interface StoreCustomizationPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStore: Store | undefined;
  initialSection?: SectionKey;
}

type SectionKey = 'templates' | 'identity' | 'layout' | 'colorsAndFonts' | 'content';

const sidebarItems: { key: SectionKey; label: string; icon: React.ReactElement; description: string }[] = [
    { key: 'templates', label: 'قوالب المتجر الجاهزة', icon: <LayoutTemplate size={20} />, description: 'سمات متكاملة بنقرة واحدة' },
    { key: 'identity', label: 'الهوية البصرية والبطاقات', icon: <Star size={20} />, description: 'شعار المتجر وتصميم الكروت' },
    { key: 'colorsAndFonts', label: 'الألوان والخطوط', icon: <Brush size={20} />, description: 'باليت الألوان المتناسقة والخطوط' },
    { key: 'layout', label: 'ترتيب وعناصر الصفحة', icon: <LayoutDashboard size={20} />, description: 'ترتيب الأقسام وسلايدر البانرات' },
    { key: 'content', label: 'المحتوى وشريط التنبيهات', icon: <Type size={20} />, description: 'منصات التواصل والتنبيه العائم' },
];

const CustomizationSidebar: React.FC<{ activeSection: SectionKey; setActiveSection: (key: SectionKey) => void; }> = ({ activeSection, setActiveSection }) => (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-205 dark:border-slate-800 shadow-sm grid grid-cols-2 md:grid-cols-5 xl:flex xl:flex-col gap-2.5">
        {sidebarItems.map(item => (
            <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`flex flex-col xl:flex-row items-center xl:items-start gap-2 px-3 sm:px-4 py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-black transition-all text-center xl:text-right ${
                    activeSection === item.key
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
                <div className={`p-1.5 rounded-lg shrink-0 ${activeSection === item.key ? 'bg-white/20 text-white' : 'text-slate-400'}`}>
                    {item.icon}
                </div>
                <div className="flex flex-col gap-0.5 leading-tight overflow-hidden">
                    <span className="truncate">{item.label}</span>
                    <span className={`hidden xl:inline text-[10px] truncate ${activeSection === item.key ? 'text-indigo-150 text-white/70' : 'text-slate-400 font-bold'}`}>
                        {item.description}
                    </span>
                </div>
            </button>
        ))}
    </div>
);

const StoreCustomizationPage: React.FC<StoreCustomizationPageProps> = ({ settings, setSettings, activeStore, initialSection }) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('templates');
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('mobile');

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);
  
  const setCustomization = (updater: React.SetStateAction<StoreCustomization>) => {
    setSettings(prev => ({
        ...prev,
        customization: typeof updater === 'function' ? updater(prev.customization) : updater
    }));
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'templates': return <TemplatesSection customization={settings.customization} setCustomization={setCustomization} />;
      case 'identity': return <IdentitySection customization={settings.customization} setCustomization={setCustomization} />;
      case 'layout': return <LayoutSection customization={settings.customization} setCustomization={setCustomization} />;
      case 'colorsAndFonts': return <ColorsAndFontsSection customization={settings.customization} setCustomization={setCustomization} />;
      case 'content': return <ContentSection customization={settings.customization} setCustomization={setCustomization} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Upper Title Section */}
      <div className="bg-gradient-to-r from-indigo-50/60 to-purple-50/30 dark:from-slate-900/40 dark:to-slate-950 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-3">
            <Sparkles size={12} className="animate-pulse" /> مصمم الواجهات السحابي الذكي v2
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3"><Brush className="text-indigo-600" /> مخصّص التصميم العالمي</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">عدّل الهوية البصرية، شبكة كروت المنتجات، باليت الألوان، والترتيب المباشر لمتجرك بالسحب والإسقاط الفوري كالمنصات العالمية.</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <Link to="/store" target="_blank" className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 text-sm shadow-md shadow-indigo-600/10"><Eye size={18} /> معاينة المتجر بصفحة جديدة</Link>
        </div>
      </div>

       {/* Editor Layout Split Grid */}
       <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
         
         {/* Left Side: Customize Panel Form Controls */}
         <div className="xl:col-span-5 space-y-6">
           <CustomizationSidebar activeSection={activeSection} setActiveSection={setActiveSection} />
           <div className="transition-all duration-300">{renderSection()}</div>
         </div>
         
         {/* Right Side: High Fidelity Multi-Device Live Mockup Suite */}
         <div className="xl:col-span-7 xl:sticky xl:top-24 space-y-4">
            
            {/* Viewport Simulation Toolbar bar */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <span className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Sliders size={14} className="text-indigo-600" /> محاكي العرض المباشر</span>
              
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDeviceView('desktop')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${deviceView === 'desktop' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/40'}`}
                >
                  <Monitor size={14} /> <span className="hidden sm:inline">شاشة كمبيوتر</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceView('tablet')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${deviceView === 'tablet' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/40'}`}
                >
                  <Tablet size={14} /> <span className="hidden sm:inline">تابلت</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceView('mobile')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${deviceView === 'mobile' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/40'}`}
                >
                  <Smartphone size={14} /> <span className="hidden sm:inline">هاتف جوال</span>
                </button>
              </div>
            </div>

            {/* Simulated Frame with dynamic scaling */}
            <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center transition-all duration-300 min-h-[500px] h-[780px] overflow-hidden">
              
              {deviceView === 'mobile' && (
                <div className="relative w-[345px] h-[710px] rounded-[48px] border-[12px] border-slate-900 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-all duration-300 ring-2 ring-indigo-500/10">
                  {/* Dynamic Island Notch */}
                  <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 w-28 h-5.5 bg-slate-900 rounded-full z-50 flex items-center justify-between px-3 text-[8px] text-slate-400 font-bold overflow-hidden">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-800/80 shrink-0 inline-block" />
                    <span className="text-[7.5px] scale-[0.83] text-indigo-300 shrink-0 font-bold">LIVE STORE</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-850 inline-block" />
                  </div>
                  {/* Speaker slot */}
                  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-slate-800 rounded z-50" />
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar pt-6 pb-2 rounded-[36px]">
                    <StorefrontPage
                        settings={settings}
                        activeStore={activeStore}
                        cart={[]}
                        onAddToCart={() => {}}
                        onUpdateCartQuantity={() => {}}
                        onRemoveFromCart={() => {}}
                        setSettings={() => {}}
                    />
                  </div>
                </div>
              )}

              {deviceView === 'tablet' && (
                <div className="relative w-[540px] h-[710px] rounded-[36px] border-[14px] border-slate-900 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-all duration-300">
                  {/* Camera hole */}
                  <div className="absolute top-1.5 left-1/2 transform -translate-x-1/2 w-3.5 h-3.5 bg-slate-900 rounded-full z-50" />
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar rounded-[20px]">
                    <StorefrontPage
                        settings={settings}
                        activeStore={activeStore}
                        cart={[]}
                        onAddToCart={() => {}}
                        onUpdateCartQuantity={() => {}}
                        onRemoveFromCart={() => {}}
                        setSettings={() => {}}
                    />
                  </div>
                </div>
              )}

              {deviceView === 'desktop' && (
                <div className="w-full h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 shadow-2xl flex flex-col transition-all duration-350 overflow-hidden">
                  {/* Browser Bar Mock */}
                  <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850 px-4 py-2.5 flex items-center justify-between text-right">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    </div>
                    <div className="w-1/2 px-4 py-1.5 bg-slate-100 dark:bg-slate-850 rounded-xl text-center text-[11px] text-slate-500 font-mono tracking-wider max-w-sm border border-slate-200/40 dark:border-slate-800 truncate select-none">
                      https://{activeStore?.url || 'nature-fashion.mysaastore.io'}
                    </div>
                    <div className="w-10 h-1" />
                  </div>
                  
                  {/* Page contents */}
                  <div className="flex-1 overflow-y-auto no-scrollbar">
                    <StorefrontPage
                        settings={settings}
                        activeStore={activeStore}
                        cart={[]}
                        onAddToCart={() => {}}
                        onUpdateCartQuantity={() => {}}
                        onRemoveFromCart={() => {}}
                        setSettings={() => {}}
                    />
                  </div>
                </div>
              )}

            </div>
         </div>

       </div>
    </div>
  );
};

// --- Store Templates (Presets) Definition & Section ---

interface PresetTemplate {
  id: string;
  name: string;
  author: string;
  description: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: 'Cairo' | 'Readex Pro' | 'Tajawal';
  headingFontWeight: 'font-bold' | 'font-black';
  buttonBorderRadius: 'rounded-none' | 'rounded-md' | 'rounded-lg' | 'rounded-full';
  cardStyle: 'default' | 'elevated' | 'outlined';
  productColumnsDesktop: 2 | 3 | 4 | 5;
  announcementBarText: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  isDark: boolean;
  headerStyle: 'floating' | 'classic' | 'minimal' | 'luxury';
  footerStyle: 'simple' | 'multi-column' | 'glass';
  tabStyle: 'pills' | 'underline' | 'sidebar' | 'bento';
  cardHoverEffect: 'scale' | 'glow' | 'shadow' | 'none';
  cardInfoAlignment: 'right' | 'center' | 'left';
  cardShadowSize: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  category: string;
  // Mockup properties for rich layout preview rendering
  mockupDesktopBanner: string;
  mockupClass: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'nature-fashion',
    name: 'Nature Fashion',
    author: 'بواسطة EasyOrders',
    description: 'قالب أنيق وعصري للملابس والأزياء مع ألوان الباستيل الناعمة، كروت بارزة، زواجية عائمة، واستجابة تامة للهواتف.',
    category: 'ملابس وأزياء',
    primaryColor: '#10b981',
    backgroundColor: '#f4fbf7',
    textColor: '#111827',
    fontFamily: 'Readex Pro',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-full',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '⚡️ عروض الموسم الحصرية: خصم 40% على تشكيلة الصيف الصافية والشحن مجاني بالكامل!',
    bannerTitle: 'تألق طبيعي وأقمشة ساحرة',
    bannerSubtitle: 'تصاميم تنسيقية فريدة تعبر عن هويتك الحقيقية بأعلى جودة تصفح مريحة وهادئة',
    bannerImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
    isDark: false,
    headerStyle: 'floating',
    footerStyle: 'glass',
    tabStyle: 'pills',
    cardHoverEffect: 'scale',
    cardInfoAlignment: 'right',
    cardShadowSize: 'md',
    mockupDesktopBanner: 'Trend Collection',
    mockupClass: 'from-emerald-950 to-teal-900'
  },
  {
    id: 'pearl-bags',
    name: 'PEARL BAGS',
    author: 'تصميم بوتيك فاخر',
    description: 'قالب كلاسيكي عالي الجاذبية مخصص للبوتيكات ومتاجر الشنط والأحذية الفاخرة مع محاذاة في المنتصف ولمسات وردية ناعمة.',
    category: 'أحذية وشنط',
    primaryColor: '#db2777',
    backgroundColor: '#fdfafb',
    textColor: '#1c1917',
    fontFamily: 'Cairo',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-lg',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '✨ حقائب PEARL الفاخرة: احصلي على خصم إضافي ٢٠٪ عند استخدام كود لؤلؤة المميز',
    bannerTitle: 'حقائب لؤلؤية فاخرة تبرز لمعانك',
    bannerSubtitle: 'شنط يد جلدية وأحذية كلاسيكية مصممة لتبهر الحاضرين وتكمل أناقتكِ الفريدة',
    bannerImage: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80',
    isDark: false,
    headerStyle: 'floating',
    footerStyle: 'multi-column',
    tabStyle: 'underline',
    cardHoverEffect: 'glow',
    cardInfoAlignment: 'center',
    cardShadowSize: 'lg',
    mockupDesktopBanner: 'Pearl & Elegant Leather',
    mockupClass: 'from-pink-950 to-rose-900'
  },
  {
    id: 'phoenix-cosmetics',
    name: 'PHONEIX Cosmetics',
    author: 'بواسطة EasyOrders',
    description: 'تصميم ناعم جداً بألوان التوت الدافئة وتدرجات الأرجواني الفاتن، مخصص لماركات العناية بالبشرة ومستحضرات التجميل العضوية.',
    category: 'مستحضرات تجميل',
    primaryColor: '#8b5cf6',
    backgroundColor: '#fafafc',
    textColor: '#1e1b4b',
    fontFamily: 'Tajawal',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-full',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '🌸 اعتني بجمالك بلطف: منتجات طبيعية ١٠٠٪ مجربة سريرياً بدون أي إضافات كيميائية وضمان رضا',
    bannerTitle: 'جمال باهر ونضارة فائقة الجاذبية',
    bannerSubtitle: 'تشكيلة مستحضرات الطبيعة الساحرة لتتألقي ببشرة صحية وندية في كل المناسبات المبهجة',
    bannerImage: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
    isDark: false,
    headerStyle: 'classic',
    footerStyle: 'glass',
    tabStyle: 'pills',
    cardHoverEffect: 'scale',
    cardInfoAlignment: 'right',
    cardShadowSize: 'md',
    mockupDesktopBanner: 'Phoenix Beauty Lab',
    mockupClass: 'from-indigo-950 to-purple-900'
  },
  {
    id: 'elite-avyro',
    name: 'ELITE AVYRO',
    author: 'جيل الستريت وير الجديد',
    description: 'قالب غامق كلياً (Dark Mode) وذو نبرة خطوط قوية ومؤثر توهج أزرق رياضي. ممتاز للهوديز والأحذية والأزياء الكاجوال المعاصرة.',
    category: 'ملابس وأزياء',
    primaryColor: '#3b82f6',
    backgroundColor: '#0a0d18',
    textColor: '#f8fafc',
    fontFamily: 'Cairo',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-lg',
    cardStyle: 'elevated',
    productColumnsDesktop: 4,
    announcementBarText: '👟 AVYRO CLOTHING: أزياء مستوحاة من ثقافة الشارع الحرة مع شحن سريع وباب المنزل',
    bannerTitle: 'تخطى حدود الأناقة التقليدية تماماً',
    bannerSubtitle: 'ملابس مميزة وهوديز ستريت وير جريئة تميز حضورك وتكسبك ثقة متناهية وسط الجموع',
    bannerImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
    isDark: true,
    headerStyle: 'minimal',
    footerStyle: 'multi-column',
    tabStyle: 'bento',
    cardHoverEffect: 'glow',
    cardInfoAlignment: 'left',
    cardShadowSize: 'none',
    mockupDesktopBanner: 'Street Bold Drop',
    mockupClass: 'from-indigo-950 to-blue-950'
  },
  {
    id: 'nature-perfumes',
    name: 'Nature Perfumes',
    author: 'بواسطة EasyOrders',
    description: 'قالب فريد ذو طابع فخم مستوحى من الطبيعة الكلاسيكية مع خط سفلي فخم وتأثير ناعم للظل. مناسب تماماً للعطور العضوية والشرقية الفاخرة.',
    category: 'عطور',
    primaryColor: '#ea580c',
    backgroundColor: '#fdfbf7',
    textColor: '#1f2937',
    fontFamily: 'Tajawal',
    headingFontWeight: 'font-bold',
    buttonBorderRadius: 'rounded-lg',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '🍂 عبير فاخر يستحق الذكريات: ثبات يدوم لـ ٤٨ ساعة وضمان استرجاع ذهبي كامل للرضا',
    bannerTitle: 'عطور مستخلصة من عبق الطبيعة',
    bannerSubtitle: 'نفحات ساحرة من الأخشاب الذهبية والزهور النادرة تلائم ذوقك الرفيع وحضورك المهيب',
    bannerImage: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=1200&q=80',
    isDark: false,
    headerStyle: 'luxury',
    footerStyle: 'multi-column',
    tabStyle: 'underline',
    cardHoverEffect: 'shadow',
    cardInfoAlignment: 'center',
    cardShadowSize: 'lg',
    mockupDesktopBanner: 'Pure Niche Perfume',
    mockupClass: 'from-amber-950 to-orange-950'
  },
  {
    id: 'hype-perfumes',
    name: 'Hype Perfumes',
    author: 'خط العطور البلاتيني الفاخر',
    description: 'قالب ليلي غامق فائق الترف والإبهار البصري، يبرز زجاجات العطور النخبوية والفرنسية بلمسات ذهبية براقة متناسقة.',
    category: 'عطور',
    primaryColor: '#f59e0b',
    backgroundColor: '#070a12',
    textColor: '#e2e8f0',
    fontFamily: 'Cairo',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-lg',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '⚜️ أفخم عطور النيش المعتمدة دولياً بأفضل الأسعار المتاحة وتوصيل فائق السرعة لكافة المحافظات',
    bannerTitle: 'جاذبية تسحر القلوب والنفوس وتثبت الهيبة',
    bannerSubtitle: 'نكهات ومجموعات عطرية فرنسية وشرقية تمنحك فخامة وسحراً ملكياً غامراً مع كل ضخة',
    bannerImage: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=80',
    isDark: true,
    headerStyle: 'luxury',
    footerStyle: 'multi-column',
    tabStyle: 'pills',
    cardHoverEffect: 'glow',
    cardInfoAlignment: 'right',
    cardShadowSize: 'xl',
    mockupDesktopBanner: 'Luxury Fragrances',
    mockupClass: 'from-slate-950 to-amber-950'
  },
  {
    id: 'nature-pets',
    name: 'Nature Pets',
    author: 'بواسطة EasyOrders',
    description: 'تصميم مشرق ومتفائل بألوان الطبيعة الخضراء الهادئة وأرضيات الشوفان والبيج الفاتح، ممتاز للحيوان الأليف والأغذية الصحية والمستلزمات الكلابية والقططية.',
    category: 'الحيوانات الأليفة',
    primaryColor: '#16a34a',
    backgroundColor: '#fefcf6',
    textColor: '#1e381e',
    fontFamily: 'Readex Pro',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-full',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '🐱 خصومات الأصدقاء الأليفة: دلال وطعام صحي بأسعار لطيفة وتوصيل لباب منزلك مع هدايا عينية مجانية!',
    bannerTitle: 'كل الحب والرعاية لحيوانك الأليف المميز',
    bannerSubtitle: 'طعام صحي ومغذٍ، ألعاب ترفيهية تفاعلية، وأسرة نوم ناعمة مصممة بعناية لسعادة صديقك الوفي',
    bannerImage: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80',
    isDark: false,
    headerStyle: 'floating',
    footerStyle: 'glass',
    tabStyle: 'pills',
    cardHoverEffect: 'scale',
    cardInfoAlignment: 'right',
    cardShadowSize: 'md',
    mockupDesktopBanner: 'Daring Love For Pets',
    mockupClass: 'from-green-950 to-emerald-900'
  }
];

const TEMPLATE_CATEGORIES = [
  'الكل',
  'ملابس وأزياء',
  'أحذية وشنط',
  'مستحضرات تجميل',
  'عطور',
  'الحيوانات الأليفة'
];

interface SectionComponentProps {
    customization: StoreCustomization;
    setCustomization: React.Dispatch<React.SetStateAction<StoreCustomization>>;
}

const TemplatesSection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  const activeTemplateId = useMemo(() => {
    const matched = PRESET_TEMPLATES.find(
      t => t.primaryColor.toLowerCase() === customization.primaryColor.toLowerCase() &&
           t.headerStyle === customization.headerStyle &&
           t.tabStyle === customization.tabStyle
    );
    return matched ? matched.id : 'nature-fashion';
  }, [customization]);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'الكل') return PRESET_TEMPLATES;
    return PRESET_TEMPLATES.filter(tpl => tpl.category === selectedCategory);
  }, [selectedCategory]);

  const applyTemplate = (tpl: PresetTemplate) => {
    setCustomization(prev => {
      const currentBanners = prev.banners || [];
      const updatedBanners: Banner[] = currentBanners.length > 0 
        ? [
            {
              ...currentBanners[0],
              imageUrl: tpl.bannerImage,
              title: tpl.bannerTitle,
              subtitle: tpl.bannerSubtitle,
              buttonText: currentBanners[0].buttonText || 'اكتشف المزيد'
            },
            ...currentBanners.slice(1)
          ]
        : [
            {
              id: 'banner_init_tpl',
              imageUrl: tpl.bannerImage,
              title: tpl.bannerTitle,
              subtitle: tpl.bannerSubtitle,
              buttonText: 'تسوق الآن'
            }
          ];

      return {
        ...prev,
        primaryColor: tpl.primaryColor,
        backgroundColor: tpl.backgroundColor,
        textColor: tpl.textColor,
        fontFamily: tpl.fontFamily,
        headingFontWeight: tpl.headingFontWeight,
        buttonBorderRadius: tpl.buttonBorderRadius,
        cardStyle: tpl.cardStyle,
        productColumnsDesktop: tpl.productColumnsDesktop,
        announcementBarText: tpl.announcementBarText,
        isAnnouncementBarVisible: true,
        banners: updatedBanners,
        headerStyle: tpl.headerStyle,
        footerStyle: tpl.footerStyle,
        tabStyle: tpl.tabStyle,
        cardHoverEffect: tpl.cardHoverEffect,
        cardInfoAlignment: tpl.cardInfoAlignment,
        cardShadowSize: tpl.cardShadowSize
      };
    });

    setSuccessMsg(`🎉 تم تطبيق قالب "${tpl.name}" وتوحيد عناصر تخطيط المتجر بنجاح!`);
    setTimeout(() => {
        setSuccessMsg(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      <CustomizationSection title="قوالب المتجر والويب الاحترافية">
        <p className="text-slate-550 dark:text-slate-400 text-xs md:text-sm -mt-3 mb-4 leading-relaxed font-semibold">
          اختر من بين مجموعتنا الحصرية من القوالب والسمات المتزامنة مع الهواتف الذكية. يتم تطبيق الألوان والخطوط وخيارات التخطيط والفوتر تلقائياً لتناسب أسلوب علامتك التجارية بكفاءة مطلقة.
        </p>

        {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border-r-4 border-emerald-500 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs sm:text-sm font-bold flex items-start gap-2.5 shadow-sm">
                <CheckCircle className="shrink-0 text-emerald-500 mt-0.5" size={18} />
                <span>{successMsg}</span>
            </div>
        )}

        {/* Categories Tab Pill List */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 border-b border-slate-100 dark:border-slate-800">
          {TEMPLATE_CATEGORIES.map(category => {
            const isCatActive = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-xs font-black transition-all whitespace-nowrap ${
                  isCatActive
                    ? 'bg-indigo-600 text-white shadow-sm scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Templates Grid Mapping */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {filteredTemplates.map((tpl) => {
            const isActive = activeTemplateId === tpl.id;
            return (
              <div 
                key={tpl.id} 
                className={`flex flex-col bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden transition-all duration-300 group shadow-sm hover:shadow-xl hover:border-indigo-500/30 ${
                  isActive ? 'ring-2 ring-indigo-600 dark:ring-indigo-500 bg-white dark:bg-slate-900/60' : ''
                }`}
              >
                {/* 1. MOCKUP PREVIEW AREA */}
                <div className="h-56 bg-slate-100 dark:bg-slate-950 p-4 relative overflow-hidden flex items-end justify-center border-b border-slate-200 dark:border-slate-800/60">
                  
                  {/* Desktop view simulator in the background */}
                  <div className={`w-[85%] h-[90%] rounded-t-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-2.5 overflow-hidden transition-all duration-500 group-hover:scale-[1.01] ${isActive ? 'ring-1 ring-indigo-500/20' : ''}`}>
                    {/* Tiny header bar */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-350" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-350" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-355" />
                      </div>
                      <span className="text-[7px] font-black text-slate-700 dark:text-slate-300 tracking-wider">PREVIEW MATCH</span>
                      <div className="w-12 h-1 bg-slate-200 dark:bg-slate-705 rounded-full" />
                    </div>

                    {/* Banner slide simulation */}
                    <div className={`w-full h-18 rounded-lg bg-gradient-to-r ${tpl.mockupClass} p-3 flex flex-col justify-center relative overflow-hidden text-right`}>
                      <span className="text-[5px] text-white/50 tracking-widest leading-none font-black font-mono">TREND SELECT</span>
                      <h4 className="text-[9px] font-black text-white leading-tight mt-0.5" style={{ color: tpl.primaryColor === '#0f172a' ? '#fff' : tpl.primaryColor }}>{tpl.mockupDesktopBanner}</h4>
                      <p className="text-[4px] text-white/70 leading-none mt-1 max-w-[120px] line-clamp-1 font-semibold">بلمسات سحابية فريدة لرواد الـ E-commerce.</p>
                    </div>

                    {/* Collections / Grid simulation */}
                    <div className="mt-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-1 bg-slate-50 dark:bg-slate-950 rounded-md border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                          <div className="w-full h-5 rounded bg-slate-200/50 dark:bg-slate-800" />
                          <div className="mt-1 flex justify-between items-center">
                            <span className="text-[5px] text-slate-500 font-extrabold">EGP 290</span>
                            <div className="w-3 h-1 bg-indigo-500 rounded" style={{ backgroundColor: tpl.primaryColor }} />
                          </div>
                        </div>
                        <div className="p-1 bg-slate-50 dark:bg-slate-950 rounded-md border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                          <div className="w-full h-5 rounded bg-slate-200/50 dark:bg-slate-800" />
                          <div className="mt-1 flex justify-between items-center">
                            <span className="text-[5px] text-slate-500 font-extrabold">EGP 420</span>
                            <div className="w-3 h-1 bg-indigo-500 rounded" style={{ backgroundColor: tpl.primaryColor }} />
                          </div>
                        </div>
                        <div className="p-1 bg-slate-50 dark:bg-slate-950 rounded-md border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                          <div className="w-full h-5 rounded bg-slate-200/50 dark:bg-slate-800" />
                          <div className="mt-1 flex justify-between items-center">
                            <span className="text-[5px] text-slate-500 font-extrabold">EGP 880</span>
                            <div className="w-3 h-1 bg-indigo-500 rounded" style={{ backgroundColor: tpl.primaryColor }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Floating iPhone / Mobile Screen simulator on the bottom right */}
                  <div className="absolute right-4 bottom-0 w-[80px] h-[135px] bg-slate-950 rounded-t-xl border-t-4 border-x-[3px] border-slate-900 p-1 shadow-2xl flex flex-col overflow-hidden transition-all duration-500 group-hover:translate-y-[-4px]">
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-sm overflow-hidden flex flex-col justify-between text-right p-1 pb-0">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-0.5">
                        <ShoppingCart size={4} className="text-slate-400" />
                        <span className="text-[4px] font-black" style={{ color: tpl.primaryColor }}>{tpl.name}</span>
                      </div>
                      
                      <div className={`h-8 rounded bg-gradient-to-tr ${tpl.mockupClass} p-1 flex flex-col justify-center text-white relative`}>
                        <h5 className="text-[4px] font-extrabold text-white scale-[0.95]">{tpl.bannerTitle}</h5>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950 p-0.5 rounded border border-slate-100 flex flex-col justify-between h-8">
                        <div className="w-full h-3 bg-slate-250 dark:bg-slate-800 rounded-sm" />
                        <div className="flex items-center justify-between scale-[0.8] origin-bottom mt-0.5">
                          <span className="text-[3px] text-slate-800 dark:text-white font-bold">120 EGP</span>
                          <span className="w-2 h-2 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[3px]" style={{ backgroundColor: tpl.primaryColor }}>+</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CARD FOOTER AND INSTALL BUTTON */}
                <div className="p-4 flex items-center justify-between gap-4 w-full bg-white dark:bg-slate-900 text-right border-t border-slate-100 dark:border-slate-805">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                      {tpl.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded text-[9px] font-black">{tpl.category}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold">{tpl.author}</span>
                    </div>
                  </div>

                  <div>
                    {isActive ? (
                      <div className="bg-emerald-50 dark:bg-emerald-990 bg-emerald-500/10 text-emerald-600 dark:text-emerald-405 border border-emerald-200 dark:border-emerald-800 py-1.5 px-4 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm">
                        <Check size={12} className="stroke-[3.5px] text-emerald-500" />
                        <span>مفعّل</span>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyTemplate(tpl);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white py-1.5 px-4 rounded-full text-xs font-black transition-all flex items-center gap-1 shadow-md shadow-indigo-600/15"
                      >
                        <Plus size={12} className="stroke-[3.5px]" />
                        <span>تطبيق السلسلة</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* descriptive detail */}
                <div className="px-4 pb-4 pt-0 text-right bg-white dark:bg-slate-900">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                    {tpl.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CustomizationSection>
    </div>
  );
};

const IdentitySection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
    const update = (field: keyof StoreCustomization, value: any) => setCustomization(p => ({...p, [field]: value}));

    return (
        <div className="space-y-6">
            <CustomizationSection title="هوية المتجر والشعار">
                <p className="text-xs text-slate-500 leading-relaxed -mt-3 mb-4 font-bold">ارفع شعار متجرك ومجموعات الأيقونة التي تستقر في رأس الصفحة للموقع الإلكتروني.</p>
                <div className="grid grid-cols-2 gap-4">
                    <ImageControl label="شعار المتجر الرئيسي" value={customization.logoUrl} onSave={(val) => update('logoUrl', val)} />
                    <ImageControl label="أيقونة التصفح (Favicon)" value={customization.faviconUrl} onSave={(val) => update('faviconUrl', val)} />
                </div>
                <div className="pt-2">
                    <RadioGroup
                        label="مستوى حجم الشعار في الهيدر"
                        value={customization.logoSize || 'md'}
                        onChange={(val) => update('logoSize', val)}
                        options={[
                            { value: 'sm', label: 'صغير' },
                            { value: 'md', label: 'متوسط' },
                            { value: 'lg', label: 'كبير' },
                        ]}
                    />
                </div>
            </CustomizationSection>
            
            <CustomizationSection title="تصميم ومؤثرات كروت المنتجات">
                <p className="text-xs text-slate-500 leading-relaxed -mt-3 mb-4 font-bold">حدد ستايل حواف وأغطية بطاقات تصفح المنتجات في الصفحة الرئيسية وتفاعل مؤشر الماوس معها.</p>
                <RadioGroup
                    label="نمط إطار بطاقة المنتج"
                    value={customization.cardStyle}
                    onChange={(val) => update('cardStyle', val)}
                    options={[
                        { value: 'default', label: 'افتراضي مسطح' },
                        { value: 'elevated', label: 'بارز ذو ظل ناعم' },
                        { value: 'outlined', label: 'مُحدد ذو إطار خفيف' },
                    ]}
                />
                <RadioGroup
                    label="قوة ومساحة الظل لكارت المنتجات"
                    value={customization.cardShadowSize || 'none'}
                    onChange={(val) => update('cardShadowSize', val)}
                    options={[
                        { value: 'none', label: 'بدون ظل' },
                        { value: 'sm', label: 'خفيف' },
                        { value: 'md', label: 'متوسط' },
                        { value: 'lg', label: 'واضح' },
                        { value: 'xl', label: 'ثلاثي الأبعاد' },
                    ]}
                />
                <RadioGroup
                    label="مؤثر حركة مؤشر الماوس (Hover Animation)"
                    value={customization.cardHoverEffect || 'none'}
                    onChange={(val) => update('cardHoverEffect', val)}
                    options={[
                        { value: 'none', label: 'ثابت' },
                        { value: 'scale', label: 'تكبير وتضخيم' },
                        { value: 'glow', label: 'توهج ألوان رغوي' },
                        { value: 'shadow', label: 'ارتفاع وظلال دافئة' },
                    ]}
                />
                <RadioGroup
                    label="محاذاة الكلمات والمعلومات داخل الكارت"
                    value={customization.cardInfoAlignment || 'right'}
                    onChange={(val) => update('cardInfoAlignment', val)}
                    options={[
                        { value: 'right', label: 'يمين (RTL)' },
                        { value: 'center', label: 'توسيط المنتصف' },
                        { value: 'left', label: 'يسار (LTR)' },
                    ]}
                />
                <RadioGroup
                    label="استدارة حواف الكات وأزرار المتجر"
                    value={customization.buttonBorderRadius}
                    onChange={(val) => update('buttonBorderRadius', val)}
                    options={[
                        { value: 'rounded-none', label: 'زوايا حادة' },
                        { value: 'rounded-md', label: 'استدارة خفيفة' },
                        { value: 'rounded-lg', label: 'استدارة أنيقة' },
                        { value: 'rounded-full', label: 'دائرية بالكامل' },
                    ]}
                />
            </CustomizationSection>
        </div>
    );
};

const LayoutSection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
    const update = (field: keyof StoreCustomization, value: any) => setCustomization(p => ({...p, [field]: value}));
    
    // Handler to move a layout section up or down in the array order
    const handleMoveSection = (index: number, direction: 'up' | 'down') => {
        const sectionsList = [...(customization.pageSections || [])];
        const swapIndex = index + (direction === 'up' ? -1 : 1);
        if (swapIndex < 0 || swapIndex >= sectionsList.length) return;
        
        // swap items
        const temp = sectionsList[index];
        sectionsList[index] = sectionsList[swapIndex];
        sectionsList[swapIndex] = temp;
        
        update('pageSections', sectionsList);
    };

    const handleToggleSection = (index: number) => {
        const sectionsList = [...(customization.pageSections || [])];
        sectionsList[index] = {
            ...sectionsList[index],
            enabled: !sectionsList[index].enabled
        };
        update('pageSections', sectionsList);
    };

    return (
        <div className="space-y-6">
            
            {/* Dynamic Section Control Block (Shopify-like sections builder) */}
            <CustomizationSection title="ترتيب ومظهر أقسام الصفحة الرئيسية">
                <p className="text-xs text-slate-500 leading-relaxed -mt-3 mb-4 font-bold">
                    تحكم بالترتيب العام لمكونات المتجر بالسحب والإسقاط (كباس Up/Down) مع إمكانية إخفاء أي قسم لتركيز انتباه العميل.
                </p>

                <div className="space-y-3">
                    {(customization.pageSections || []).map((sect, idx) => {
                        const sectionName = sect.type === 'hero' ? 'بانر السلايدر الترويجي (الافتتاحية)' : 'شبكة المنتجات وتصنيفات الشراء';
                        const sectionDesc = sect.type === 'hero' ? 'يعرض العروض الدوارة والصور الكبيرة المحفزة للشراء' : 'العمود الفقري لعرض الفئات وبطاقات الطلب السريع';
                        return (
                            <div key={sect.id || sect.type} className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between text-right ${sect.enabled ? 'bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-150 border-dashed opacity-50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1 items-center justify-center text-slate-400 shrink-0">
                                        <button 
                                            type="button" 
                                            disabled={idx === 0}
                                            onClick={() => handleMoveSection(idx, 'up')}
                                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                                            title="نقل لأعلى"
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button 
                                            type="button"
                                            disabled={idx === (customization.pageSections || []).length - 1}
                                            onClick={() => handleMoveSection(idx, 'down')}
                                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded disabled:opacity-30"
                                            title="نقل لأسفل"
                                        >
                                            <ArrowDown size={14} />
                                        </button>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-sm text-slate-800 dark:text-white">{sectionName}</span>
                                            {sect.enabled ? (
                                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                                            ) : (
                                                <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">{sectionDesc}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleSection(idx)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-black tracking-wide transition-all ${sect.enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30' : 'bg-slate-100 text-slate-505 dark:bg-slate-800'}`}
                                    >
                                        {sect.enabled ? 'إخفاء القسم' : 'عرض وتحضير'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CustomizationSection>

            <CustomizationSection title="أنماط الهيدر والفوتر والتبويبات">
                <RadioGroup
                    label="نمط رأس المتجر (Header Header Style)"
                    value={customization.headerStyle || 'classic'}
                    onChange={(val) => update('headerStyle', val)}
                    options={[
                        { value: 'classic', label: 'كلاسيكي تقليدي' },
                        { value: 'floating', label: 'زجاجي عائم' },
                        { value: 'minimal', label: 'بسيط وهادئ' },
                        { value: 'luxury', label: 'فخم وملكـي' },
                    ]}
                />
                <RadioGroup
                    label="تصميم وعرض الفوتر (Footer Style)"
                    value={customization.footerStyle || 'simple'}
                    onChange={(val) => update('footerStyle', val)}
                    options={[
                        { value: 'simple', label: 'بسيط ومختصر' },
                        { value: 'multi-column', label: 'أعمدة مفصلة' },
                        { value: 'glass', label: 'عائم زجاجي' },
                    ]}
                />
                <RadioGroup
                    label="طريقة تبويب الفئات وتصنيفات الشراء"
                    value={customization.tabStyle || 'pills'}
                    onChange={(val) => update('tabStyle', val)}
                    options={[
                        { value: 'pills', label: 'كبسولات عائمة' },
                        { value: 'underline', label: 'خط سفلي رفيع' },
                        { value: 'sidebar', label: 'فلترة جانبية' },
                        { value: 'bento', label: 'مربعات بينتو الذكية' },
                    ]}
                />
            </CustomizationSection>

            <CustomizationSection title="البانرات الإعلانية في الواجهة (السلايدر)">
                <BannersEditor banners={customization.banners || []} onBannersChange={(val) => update('banners', val)} />
            </CustomizationSection>
            
            <CustomizationSection title="ترتيب أعمدة شبكة المنتجات">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-400">عدد الأعمدة في الشاشات الكبيرة</label>
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-black">{customization.productColumnsDesktop} أعمدة</span>
                    </div>
                    <input 
                      type="range" 
                      min="2" 
                      max="5" 
                      value={customization.productColumnsDesktop} 
                      onChange={(e) => update('productColumnsDesktop', Number(e.target.value))} 
                      className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-650" 
                    />
                    <div className="flex justify-between text-[11px] font-bold text-slate-400 px-1 mt-1 font-mono">
                        <span>2 Columns</span>
                        <span>3 Columns</span>
                        <span>4 Columns</span>
                        <span>5 Columns</span>
                    </div>
                </div>
            </CustomizationSection>
        </div>
    );
};

const PRESET_PALETTES = [
  {
    name: 'الزمرد الطبيعي 🌿',
    primary: '#10b981',
    bg: '#f4fbf7',
    text: '#111827',
    desc: 'للموضة والأغذية العضوية والحيوانات'
  },
  {
    name: 'الكوارتز الوردي 🌸',
    primary: '#db2777',
    bg: '#fdfafb',
    text: '#1c1917',
    desc: 'لمستحضرات التجميل والإكسسوارات'
  },
  {
    name: 'الأمبر الملكي ⚜️',
    primary: '#ea580c',
    bg: '#fdfbf7',
    text: '#1f2937',
    desc: 'للعطور الفاخرة والبخور والنيش'
  },
  {
    name: 'AVYRO ستريت وير 🛹',
    primary: '#3b82f6',
    bg: '#0a0d18',
    text: '#f8fafc',
    desc: 'ستريت كاجوال وغامق ليلي فخم'
  },
  {
    name: 'الأزرق التكنولوجي 🌊',
    primary: '#0284c7',
    bg: '#f0f9ff',
    text: '#0f172a',
    desc: 'للإلكترونيات والمنتجات السحابية'
  },
  {
    name: 'الكلاسيكي المريح ✨',
    primary: '#4f46e5',
    bg: '#ffffff',
    text: '#0f172a',
    desc: 'سمت متجانس يناسب كافة التخصصات'
  }
];

const ColorsAndFontsSection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
    const update = (field: keyof StoreCustomization, value: any) => setCustomization(p => ({...p, [field]: value}));
    
    const applyPalette = (p: typeof PRESET_PALETTES[0]) => {
        setCustomization(c => ({...c, primaryColor: p.primary, backgroundColor: p.bg, textColor: p.text}));
    };

    return (
        <div className="space-y-6">
            {/* Quick Themes Palettes Drawer */}
            <CustomizationSection title="لوحات ألوان جاهزة منسقة باحتراف">
                <p className="text-xs text-slate-500 leading-relaxed -mt-3 mb-4 font-bold">
                    اختر لوحة جاهزة مصممة خصيصاً على أيدي خبراء التصميم لتمنح متجرك تأثيراً نفسياً يحفز المبيعات فوراً.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {PRESET_PALETTES.map(palette => {
                        const isMatch = customization.primaryColor.toLowerCase() === palette.primary.toLowerCase() &&
                                        customization.backgroundColor.toLowerCase() === palette.bg.toLowerCase();
                        return (
                            <button
                                key={palette.name}
                                type="button"
                                onClick={() => applyPalette(palette)}
                                className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-3 ${isMatch ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 ring-1 ring-indigo-500' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className="font-extrabold text-xs text-slate-800 dark:text-white">{palette.name}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: palette.primary }} />
                                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: palette.bg }} />
                                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: palette.text }} />
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5 leading-snug">{palette.desc}</p>
                            </button>
                        );
                    })}
                </div>
            </CustomizationSection>

            <CustomizationSection title="تخصيص يدوي دقيق للألوان">
                <p className="text-xs text-slate-500 leading-relaxed -mt-3 mb-4 font-bold">استخدم ملقط الألوان لوضع درجات الهوية البصرية الحصرية لعلامتك التجارية.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ColorPicker label="اللون الأساسي (أزرار ونقاط)" color={customization.primaryColor} onChange={(c) => update('primaryColor', c)} />
                    <ColorPicker label="لون خلفية المتجر" color={customization.backgroundColor} onChange={(c) => update('backgroundColor', c)} />
                    <ColorPicker label="لون نصوص المتجر" color={customization.textColor} onChange={(c) => update('textColor', c)} />
                </div>
            </CustomizationSection>

            <CustomizationSection title="تخصيص الخطوط والتايبوجرافي">
                <p className="text-xs text-slate-500 leading-relaxed -mt-3 mb-4 font-bold">تغيير لغة وستايل خط التصفح يورث طابعاً كلاسيكياً أو مستقبلياً لعملائك.</p>
                <SelectControl 
                   label="عائلة الخطوط العربية المعتمدة" 
                   value={customization.fontFamily} 
                   onChange={(v) => update('fontFamily', v)} 
                   options={[ 
                     { value: 'Cairo', label: 'Cairo (جذّاب وسهل القراءة)' }, 
                     { value: 'Readex Pro', label: 'Readex Pro (عصري ومستقبلي نحيف)' }, 
                     { value: 'Tajawal', label: 'Tajawal (ناعم وهادئ للتصفح)' }
                   ]} 
                />
                
                <RadioGroup 
                   label="وزن خط عناوين المتجر الكبرى" 
                   value={customization.headingFontWeight} 
                   onChange={(v) => update('headingFontWeight', v)} 
                   options={[ 
                     { value: 'font-bold', label: 'عريض (Bold)' }, 
                     { value: 'font-black', label: 'أقصى عرض (Black Bold)' } 
                   ]}
                />
                
                <RadioGroup 
                   label="الحجم الافتراضي لنصوص الوصف والشراء" 
                   value={customization.bodyFontSize || 'text-base'} 
                   onChange={(v) => update('bodyFontSize', v)} 
                   options={[ 
                     { value: 'text-sm', label: 'صغير' }, 
                     { value: 'text-base', label: 'قياسي متوازن' }, 
                     { value: 'text-lg', label: 'كبير ومريح' } 
                   ]}
                />
            </CustomizationSection>
        </div>
    );
};

const ContentSection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
    const update = (field: keyof StoreCustomization, value: any) => setCustomization(p => ({...p, [field]: value}));
    const updateSocial = (platform: keyof StoreCustomization['socialLinks'], value: string) => {
        setCustomization(p => ({ ...p, socialLinks: { ...p.socialLinks, [platform]: value } }));
    };

    return (
        <div className="space-y-6">
            <CustomizationSection title="شريط التنبيهات العائم في الأعلى">
                <p className="text-xs text-slate-505 leading-relaxed -mt-3 mb-4 font-bold">يظهر في قمة الصفحة للإعلان عن كوبون خصم أو خبر شحن مجاني يزيد من مبيعاتك.</p>
                <ToggleControl label="تفعيل شريط التنبيهات علوياً" checked={customization.isAnnouncementBarVisible} onChange={(val) => update('isAnnouncementBarVisible', val)} />
                <div className={`transition-all duration-300 ${customization.isAnnouncementBarVisible ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                     <FormInput name="announcementBarText" label="نص شريط الإعلان المعروض لجميع المشترين" value={customization.announcementBarText} onChange={(e) => update('announcementBarText', e.target.value)} icon={<Megaphone/>} />
                </div>
            </CustomizationSection>
            
            <CustomizationSection title="منصات التواصل الاجتماعي والروابط">
                 <p className="text-xs text-slate-500 leading-relaxed -mt-3 mb-4 font-bold">ضع روابط حساباتك الرسمية لتظهر كأيقونات تفاعلية في أسفل الفوتر لعملائك.</p>
                 <div className="space-y-4">
                     <FormInput name="facebook" label="صفحة فيسبوك" value={customization.socialLinks.facebook} onChange={e => updateSocial('facebook', e.target.value)} icon={<LinkIcon className="text-blue-650" />} placeholder="https://facebook.com/yourpage" />
                     <FormInput name="instagram" label="حساب انستجرام" value={customization.socialLinks.instagram} onChange={e => updateSocial('instagram', e.target.value)} icon={<LinkIcon className="text-pink-600" />} placeholder="https://instagram.com/yourprofile" />
                     <FormInput name="x" label="حساب X (تويتر)" value={customization.socialLinks.x} onChange={e => updateSocial('x', e.target.value)} icon={<LinkIcon className="text-black" />} placeholder="https://x.com/yourhandle" />
                     <FormInput name="tiktok" label="قناة تيك توك" value={customization.socialLinks.tiktok} onChange={e => updateSocial('tiktok', e.target.value)} icon={<LinkIcon className="text-emerald-500" />} placeholder="https://tiktok.com/@yourusername" />
                 </div>
                 <div className="border-t border-slate-200 dark:border-slate-800 my-4"></div>
                 <FormInput name="footerText" label="نص حقوق الملكية والنشر لمذيل الصفحة" value={customization.footerText} onChange={(e) => update('footerText', e.target.value)} icon={<Type />} placeholder="© 2026 جميع الحقوق محفوظة" />
            </CustomizationSection>
        </div>
    );
};

// --- Form Generic Controls Components ---

const CustomizationSection: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-black text-slate-800 dark:text-white mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
            {title}
        </h2>
        <div className="space-y-5">
            {children}
        </div>
    </div>
);

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> { 
    label: string; 
    icon?: React.ReactElement; 
}

const FormInput: React.FC<FormInputProps> = ({ label, icon, ...props }) => (
    <div>
        <label htmlFor={props.id || props.name} className="block text-xs font-black text-slate-700 dark:text-slate-400 mb-2 flex items-center gap-1.5 select-none hover:cursor-pointer">
            {icon} {label}
        </label>
        <input 
            {...props} 
            id={props.id || props.name} 
            className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl outline-none text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-700 transition-all dark:text-white font-semibold text-right" 
        />
    </div>
);

const RadioGroup: React.FC<{ 
    label: string; 
    value: string; 
    options: {value: string; label: string}[]; 
    onChange: (value: string) => void;
}> = ({label, value, options, onChange}) => (
    <div>
        <label className="block text-xs font-black text-slate-700 dark:text-slate-400 mb-2">{label}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
            {options.map(opt => (
                <button 
                  type="button" 
                  key={opt.value} 
                  onClick={() => onChange(opt.value)} 
                  className={`py-2 px-1 rounded-lg text-xs font-black transition-all ${value === opt.value ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-650 dark:text-indigo-405' : 'text-slate-500 hover:bg-white/40'}`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

const SelectControl: React.FC<{ 
    label: string; 
    value: string; 
    options: {value: string; label: string}[]; 
    onChange: (value: string) => void;
}> = ({label, value, options, onChange}) => (
    <div>
        <label className="block text-xs font-black text-slate-700 dark:text-slate-400 mb-2">{label}</label>
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl outline-none text-sm font-black focus:ring-2 focus:ring-indigo-505"
        >
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

const ColorPicker: React.FC<{ 
    label: string; 
    color: string; 
    onChange: (color: string) => void;
}> = ({label, color, onChange}) => (
    <div>
        <label className="block text-xs font-black text-slate-700 dark:text-slate-400 mb-2">{label}</label>
        <div className="flex items-center gap-2">
            <input 
              type="color" 
              value={color} 
              onChange={(e) => onChange(e.target.value)} 
              className="w-10 h-10 p-0 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer bg-transparent shrink-0" 
            />
            <input 
              type="text" 
              value={color} 
              onChange={(e) => onChange(e.target.value)} 
              className="w-full px-3 py-2 bg-slate-55 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl font-mono text-xs font-extrabold text-right"
            />
        </div>
    </div>
);

const ToggleControl: React.FC<{ 
    label: string; 
    checked: boolean; 
    onChange: (checked: boolean) => void;
}> = ({label, checked, onChange}) => (
    <div className="flex items-center justify-between p-1 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-805 px-3 py-2.5">
        <label className="text-xs font-black text-slate-700 dark:text-slate-300">{label}</label>
        <div className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={checked} 
              onChange={(e) => onChange(e.target.checked)} 
              className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-650 peer-checked:bg-indigo-600"></div>
        </div>
    </div>
);

const BannersEditor: React.FC<{ 
    banners: Banner[], 
    onBannersChange: (banners: Banner[]) => void 
}> = ({ banners, onBannersChange }) => {
    const [editingBanner, setEditingBanner] = useState<Partial<Banner> | null>(null);

    const handleSave = () => {
        if (!editingBanner?.imageUrl) return;
        const newBanner: Banner = { ...editingBanner as Banner, id: editingBanner.id || Date.now().toString() };
        if (editingBanner.id) {
            onBannersChange(banners.map(b => b.id === newBanner.id ? newBanner : b));
        } else {
            onBannersChange([...banners, newBanner]);
        }
        setEditingBanner(null);
    };

    return (
        <div className="space-y-4">
            {banners.map(banner => (
                <div key={banner.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl flex items-center justify-between text-right border border-slate-105 dark:border-slate-850">
                    <div className="flex items-center gap-3">
                        <img src={banner.imageUrl} className="w-16 h-10 rounded-lg object-cover bg-slate-200" alt="slide banner"/>
                        <div>
                            <p className="font-extrabold text-xs text-slate-800 dark:text-white leading-normal">{banner.title}</p>
                            <p className="text-[10px] text-slate-500 leading-normal font-semibold mt-0.5">{banner.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button type="button" onClick={() => setEditingBanner(banner)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="تعديل"><Edit3 size={15}/></button>
                        <button type="button" onClick={() => onBannersChange(banners.filter(b => b.id !== banner.id))} className="p-2 text-rose-650 hover:bg-rose-50 rounded-lg" title="حذف"><Trash2 size={15}/></button>
                    </div>
                </div>
            ))}
            <button 
              type="button" 
              onClick={() => setEditingBanner({})} 
              className="w-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 text-slate-500 dark:text-slate-400 font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-indigo-400 transition-all"
            >
                <Plus size={15} className="stroke-[3px] text-indigo-600"/> إضافة بانر سلايدر جديد
            </button>

            {editingBanner && (
                 <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-lg text-right space-y-4 border border-slate-100 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-807">
                            <span className="font-black text-slate-800 dark:text-white">{editingBanner.id ? 'عدّل تصميم السلايدر' : 'إضافة تصميم سلايدر جديد'}</span>
                            <button type="button" onClick={() => setEditingBanner(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"><X size={16}/></button>
                        </div>
                        <FormInput label="رابط صور البانر الجودة العالية (URL)" icon={<Image size={14}/>} value={editingBanner.imageUrl || ''} onChange={e => setEditingBanner(p => ({...p, imageUrl: e.target.value}))} placeholder="https://unsplash.com/...image.png" />
                        <FormInput label="العنوان الرئيسي العريض" icon={<Type size={14}/>} value={editingBanner.title || ''} onChange={e => setEditingBanner(p => ({...p, title: e.target.value}))} placeholder="أحدث التصاميم والمنتجات العينية" />
                        <FormInput label="العنوان الفرعي" icon={<Type size={14}/>} value={editingBanner.subtitle || ''} onChange={e => setEditingBanner(p => ({...p, subtitle: e.target.value}))} placeholder="تخفيضات تصل إلى أكثر من 40% طوال الأسبوع" />
                        <FormInput label="نص كرت وزر الحركة" icon={<Type size={14}/>} value={editingBanner.buttonText || ''} onChange={e => setEditingBanner(p => ({...p, buttonText: e.target.value}))} placeholder="تسوق الآن" />
                        <FormInput label="رابط إعادة التوجيه" icon={<LinkIcon size={14}/>} value={editingBanner.link || ''} onChange={e => setEditingBanner(p => ({...p, link: e.target.value}))} placeholder="#products" />
                        
                        <div className="flex gap-2.5 justify-end pt-3">
                            <button type="button" onClick={() => setEditingBanner(null)} className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">إلغاء</button>
                            <button type="button" onClick={handleSave} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-md shadow-indigo-600/10">حفظ وحفظ التصميم</button>
                        </div>
                    </div>
                 </div>
            )}
        </div>
    );
};

const ImageControl: React.FC<{
    label: string; 
    value: string; 
    onSave: (value: string) => void;
}> = ({label, value, onSave}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [url, setUrl] = useState(value);
    
    const handleSave = () => { 
        onSave(url); 
        setIsModalOpen(false); 
    };

    return (
        <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-400 mb-2 truncate">{label}</label>
            <div className="w-full aspect-video bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-205 dark:border-slate-800 flex items-center justify-center p-2 shadow-inner overflow-hidden relative group">
                {value ? (
                    <img src={value} alt={label} className="max-w-full max-h-full object-contain rounded-xl" />
                ) : (
                    <span className="text-slate-400 text-[11px] font-bold">لم ترفع صورة بعد</span>
                )}
            </div>
            <button 
              type="button" 
              onClick={() => { setUrl(value); setIsModalOpen(true); }} 
              className="w-full mt-2 text-center text-xs font-black text-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/30 py-2.5 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
            >
                تعديل الرابط
            </button>
            
            {isModalOpen && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md text-right border border-slate-100 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-805">
                            <span className="font-black text-slate-850 dark:text-white">تعديل رابط الشعار</span>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-105 rounded-full text-slate-400"><X size={15}/></button>
                        </div>
                        <div className="space-y-4 pt-3">
                            <FormInput label="ضع رابط الصورة المباشر (URL)" icon={<LinkIcon size={14}/>} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/logo.png" />
                            
                            <div className="flex gap-2 justify-end pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-805 rounded-xl text-xs font-black">إلغاء</button>
                                <button type="button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-650/10">تحديث</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreCustomizationPage;
