import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Store as StoreIcon, Sparkles, CheckCircle2, Globe, ShieldCheck, 
  ArrowLeft, ArrowRight, Coins, Layers, Rocket, Check, 
  Palette, Truck, Phone, MessageSquare, ShoppingBag, 
  Boxes, CreditCard, HelpCircle, Eye, RefreshCw, Wand2,
  FileText, ExternalLink, Zap, Flame, Star, ShieldAlert,
  ChevronRight, Building2, BarChart3, AlertCircle, Smartphone,
  MapPin, DollarSign, Package, Sliders, ChevronLeft
} from 'lucide-react';
import { User, Store, Product, ShippingOption } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { oneToolzProducts } from '../data/one-toolz-products';
import { generateEgyptShippingOptions, generateTurboShippingOptions, generateBostaShippingOptions } from '../constants';

interface CreateStorePageProps {
  currentUser: User | null;
  onStoreCreated: (store: Store, initialCustomization?: any, initialSettingsOverride?: any) => void;
}

// Framer motion animation variants for steps
const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
    }
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.25,
      ease: [0.7, 0, 0.84, 0], // easeIn
    }
  })
};

// Supported Currencies
interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  description: string;
}

const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م', flag: '🇪🇬', description: 'العملة الأساسية للسوق المصري مع دعم الدفع عند الاستلام' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', flag: '🇸🇦', description: 'الريال السعودي لدول الخليج والمملكة العربية السعودية' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', flag: '🇦🇪', description: 'الدرهم الإماراتي للتجارة في دولة الإمارات' },
  { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك', flag: '🇰🇼', description: 'الدينار الكويتي للسوق الكويتي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', flag: '🇺🇸', description: 'الدولار العالمي للمبيعات الدولية والتصدير' },
  { code: 'EUR', name: 'يورو أوروبي', symbol: '€', flag: '🇪🇺', description: 'اليورو للسوق الأوروبي المشترك' },
];

// Presets for store specialization & templates
interface StoreTemplatePreset {
  id: string;
  name: string;
  badge: string;
  category: string;
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
  sampleProductsCount: number;
}

const STORE_TEMPLATES: StoreTemplatePreset[] = [
  {
    id: 'nature-fashion',
    name: 'بوتيك الأزياء والموضة (Fashion Boutique)',
    badge: 'الأكثر طلباً للأزياء 🔥',
    category: 'ملابس وموضة',
    description: 'قالب فائق الرقي مخصص للأزياء، العبايات، الكاجوال والأحذية بألوان ناعمة وكروت منتجات بارزة.',
    primaryColor: '#10b981',
    backgroundColor: '#f4fbf7',
    textColor: '#111827',
    fontFamily: 'Readex Pro',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-full',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '⚡️ عروض الموسم الحصرية: خصم 30% مع شحن مجاني لكافة محافظات الجمهورية!',
    bannerTitle: 'تألق بأحدث صيحات الموضة والأناقة',
    bannerSubtitle: 'أرقى الخامات العصرية المصممة لتعكس تميزك وحضورك الراقي بأسعار استثنائية.',
    bannerImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
    sampleProductsCount: 8,
  },
  {
    id: 'phoenix-cosmetics',
    name: 'الصحة والعناية والجمال (Beauty Lab)',
    badge: 'عناية ومكياج 🌸',
    category: 'الصحة والجمال',
    description: 'واجهة نقية مريحة للعين، مخصصة لمستحضرات التجميل، العناية بالبشرة، والمنتجات الطبيعية والتقييمات.',
    primaryColor: '#8b5cf6',
    backgroundColor: '#fafafc',
    textColor: '#1e1b4b',
    fontFamily: 'Tajawal',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-full',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '🌸 عناية حقيقية ببشرتك: منتجات طبيعية 100% مصرح بها وضمان استرجاع ذهبي!',
    bannerTitle: 'جمال طبيعي ونضارة تدوم طويلاً',
    bannerSubtitle: 'اكتشفي سر الإشراقة اليومية مع مستحضراتنا الآمنة والمجربة بأيدي خبراء.',
    bannerImage: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
    sampleProductsCount: 6,
  },
  {
    id: 'pearl-luxury',
    name: 'الشنط والأحذية والجلديات (Pearl Luxury)',
    badge: 'فخامة وبوتيك 💎',
    category: 'أدوات وإكسسوارات',
    description: 'طراز كلاسيكي راقٍ للشنط والأحذية مع بطاقات عرض فسيحة وأزرار عائمة للشراء السريع بنقرة واحدة.',
    primaryColor: '#db2777',
    backgroundColor: '#fdfafb',
    textColor: '#1c1917',
    fontFamily: 'Cairo',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-lg',
    cardStyle: 'elevated',
    productColumnsDesktop: 3,
    announcementBarText: '✨ حقائب ومنتجات أصلية: خصم إضافي 15% عند الدفع كاش أو الشحن السريع!',
    bannerTitle: 'تشكيلة راقية تليق بذوقك الرفيع',
    bannerSubtitle: 'مصنوعة بعناية فائقة وتفاصيل مبهرة لتكتمل إطلالتك في كل مناسبة.',
    bannerImage: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80',
    sampleProductsCount: 6,
  },
  {
    id: 'elite-tech-dark',
    name: 'الإلكترونيات والتقنية (Cyber Tech)',
    badge: 'ستايل داكن فخم ⚡',
    category: 'إلكترونيات وأجهزة',
    description: 'قالب داكن بالكامل للأجهزة الذكية، كماليات الموبايل، والجيمنج لإعطاء انطباع احترافي حديث.',
    primaryColor: '#3b82f6',
    backgroundColor: '#0a0d18',
    textColor: '#f8fafc',
    fontFamily: 'Cairo',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-lg',
    cardStyle: 'elevated',
    productColumnsDesktop: 4,
    announcementBarText: '🚀 شحن فوري بخلال 24-48 ساعة وضمان استبدال معتمد لمدة عام كامل!',
    bannerTitle: 'أقوى تكنولوجيا وإلكترونيات بين يديك',
    bannerSubtitle: 'أحدث الإكسسوارات والعتاد التقني الأصلي بأسعار الجملة وأداء غير مسبوق.',
    bannerImage: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80',
    sampleProductsCount: 8,
  },
  {
    id: 'tools-hardware',
    name: 'العدد والأدوات اليدوية (1Toolz Pro)',
    badge: 'دروب شيبينغ جاهز 🛠️',
    category: 'عدد وأدوات يدوية',
    description: 'قالب معدات ومستلزمات صيانة ودريلات احترافي مربوط بكتالوج المنتجات الجاهزة للشحن والربط الفوري.',
    primaryColor: '#00c48c',
    backgroundColor: '#f8fafc',
    textColor: '#0f172a',
    fontFamily: 'Cairo',
    headingFontWeight: 'font-black',
    buttonBorderRadius: 'rounded-lg',
    cardStyle: 'elevated',
    productColumnsDesktop: 4,
    announcementBarText: '🚚 معاينة المنتجات قبل الاستلام وسداد مصاريف الشحن عند باب بيتك!',
    bannerTitle: 'أقوى العدد والمعدات الأصلية لورش ومنازل المحترفين',
    bannerSubtitle: 'تشكيلة متكاملة من الدريلات والمفكات ومعدات الصيانة بأعلى معايير الأمان وقوة التحمل.',
    bannerImage: 'https://1toolz.sirv.com/Images/775/1.png',
    sampleProductsCount: 12,
  }
];

const SUGGESTED_NAMES: Record<string, string[]> = {
  'الصحة والجمال': ['لافندر كير - Lavender Care', 'روز بيوتي - Rose Beauty', 'بيور سكن - Pure Skin', 'جلوري بيوتي - Glory Beauty'],
  'ملابس وموضة': ['أناقة ستور - Enaqa Store', 'مودا ستايل - Moda Style', 'ڤيلفيت فاشون - Velvet Fashion', 'تريند زون - Trend Zone'],
  'إلكترونيات وأجهزة': ['تك إكسبريس - Tech Express', 'سمارت بلس - Smart Plus', 'إلكترو هاوس - Electro House', 'نيكست تك - Next Tech'],
  'أدوات منزلية': ['بيتك شيك - Modern Home', 'بيت الهنا - Home Bliss', 'كوين هاوس - Queen House', 'الدار ستور - Al-Dar Store'],
  'عدد وأدوات يدوية': ['متر ودريل - Toolz Hub', 'الورشة الذكية - Smart Gear', 'باور تك للعدد - Power Tech', 'المحترف للمعدات - Pro Toolz'],
  'أخرى': ['سوق بلس - Souq Plus', 'برايم ستور - Prime Store', 'فليكس مارت - Flex Mart', 'توب براند - Top Brand']
};

export const CreateStorePage: React.FC<CreateStorePageProps> = ({ currentUser, onStoreCreated }) => {
  const navigate = useNavigate();

  // Multi-step Wizard Navigation:
  // Step 1: اسم المتجر والتخصص (Store Name & Specialization)
  // Step 2: العملات والقالب البصري (Currencies & Theme Preset)
  // Step 3: تخصيصات الشحن والعمليات المبدئية (Shipping Setup & Operations)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<number>(1);

  // Step 1: Store Name & Specialization State
  const [storeName, setStoreName] = useState('');
  const [specialization, setSpecialization] = useState('الصحة والجمال');
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [language, setLanguage] = useState('عربي');

  // Step 2: Currency & Template State
  const [currency, setCurrency] = useState('EGP');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('nature-fashion');

  // Step 3: Shipping Customization & Operational Settings State
  const [shippingMode, setShippingMode] = useState<'standard' | 'flat' | 'free_threshold' | 'custom'>('standard');
  const [flatShippingRate, setFlatShippingRate] = useState<number>(50);
  const [cairoGizaShippingRate, setCairoGizaShippingRate] = useState<number>(35);
  const [alexDeltaShippingRate, setAlexDeltaShippingRate] = useState<number>(45);
  const [upperEgyptShippingRate, setUpperEgyptShippingRate] = useState<number>(65);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(500);
  const [enableFreeShipping, setEnableFreeShipping] = useState<boolean>(true);
  const [activeCarriers, setActiveCarriers] = useState<{ internal: boolean; bosta: boolean; turbo: boolean }>({
    internal: true,
    bosta: true,
    turbo: true,
  });

  // Additional Operational Switches
  const [supportCod, setSupportCod] = useState<boolean>(true);
  const [enableWhatsappAlerts, setEnableWhatsappAlerts] = useState<boolean>(true);
  const [importSampleProducts, setImportSampleProducts] = useState<boolean>(true);
  const [autoSetDefaultStore, setAutoSetDefaultStore] = useState<boolean>(true);
  const [storePhone, setStorePhone] = useState<string>(currentUser?.phone || '');
  const [storeDescription, setStoreDescription] = useState<string>('');

  // UI state
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessLaunched, setIsSuccessLaunched] = useState(false);
  const [createdStoreData, setCreatedStoreData] = useState<Store | null>(null);

  // Auto slug generation
  const slug = useMemo(() => {
    return storeName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 24);
  }, [storeName]);

  const previewDomain = slug ? `${slug}.abdomedi.com` : 'yourstore.abdomedi.com';

  const selectedTemplate = useMemo(() => {
    return STORE_TEMPLATES.find(t => t.id === selectedTemplateId) || STORE_TEMPLATES[0];
  }, [selectedTemplateId]);

  const selectedCurrencyObj = useMemo(() => {
    return SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
  }, [currency]);

  // Name suggestions based on current specialization
  const suggestions = SUGGESTED_NAMES[specialization] || SUGGESTED_NAMES['الصحة والجمال'];

  // Wizard Step Validations
  const validateStep1 = () => {
    if (!storeName.trim()) {
      setError('يرجى كتابة اسم المتجر للمتابعة.');
      return false;
    }
    if (storeName.trim().length < 3) {
      setError('اسم المتجر يجب ألا يقل عن 3 أحرف.');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!currency) {
      setError('يرجى تحديد عملة المتجر الرئيسية.');
      return false;
    }
    setError('');
    return true;
  };

  const goToStep = (targetStep: 1 | 2 | 3) => {
    if (targetStep > step) {
      if (step === 1 && !validateStep1()) return;
      if (step === 2 && !validateStep2()) return;
      setDirection(1);
    } else {
      setDirection(-1);
    }
    setError('');
    setStep(targetStep);
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (validateStep1()) {
        setDirection(1);
        setStep(2);
      }
    } else if (step === 2) {
      if (validateStep2()) {
        setDirection(1);
        setStep(3);
      }
    }
  };

  const handlePrevStep = () => {
    if (step === 3) {
      setDirection(-1);
      setStep(2);
    } else if (step === 2) {
      setDirection(-1);
      setStep(1);
    }
    setError('');
  };

  // Generate tailored initial shipping options based on user custom values
  const buildInitialShippingOptions = (): Record<string, ShippingOption[]> => {
    const egyptOptions = generateEgyptShippingOptions();

    // Customize Egypt options with user rates
    const customizedEgyptOptions: ShippingOption[] = egyptOptions.map(gov => {
      let price = alexDeltaShippingRate;
      if (["القاهرة", "الجيزة"].includes(gov.label)) {
        price = cairoGizaShippingRate;
      } else if (["الإسكندرية", "القليوبية", "المنوفية", "الدقهلية", "الغربية", "الشرقية", "البحيرة", "دمياط", "كفر الشيخ"].includes(gov.label)) {
        price = alexDeltaShippingRate;
      } else {
        price = upperEgyptShippingRate;
      }

      if (shippingMode === 'flat') {
        price = flatShippingRate;
      }

      return {
        ...gov,
        deliveryPrice: price,
        cities: (gov.cities || []).map(city => ({
          ...city,
          deliveryPrice: price,
        }))
      };
    });

    return {
      'شحن داخلي': customizedEgyptOptions,
      'بوسطة': generateBostaShippingOptions(),
      'تربو': generateTurboShippingOptions(),
    };
  };

  const handleCreateStore = async () => {
    if (!validateStep1()) {
      setDirection(-1);
      setStep(1);
      return;
    }

    if (!currentUser) {
      setError('يجب تسجيل الدخول أولاً لإنشاء المتجر.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const cleanSlug = slug || 'store';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const generatedSubdomain = `${cleanSlug}-${randomSuffix}`;
      const uniqueUrl = `${generatedSubdomain}.abdomedi.com`;

      const newStore: Store = {
        id: `store-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        name: storeName.trim(),
        specialization,
        language,
        currency,
        url: uniqueUrl,
        subdomain: generatedSubdomain,
        customDomain: customDomainInput.trim() || undefined,
        creationDate: new Date().toISOString(),
        templateId: selectedTemplate.id,
        description: storeDescription.trim() || undefined,
        phone: storePhone.trim() || undefined,
      };

      // Customization bundle derived from selected template
      const templateCustomization = {
        primaryColor: selectedTemplate.primaryColor,
        backgroundColor: selectedTemplate.backgroundColor,
        textColor: selectedTemplate.textColor,
        fontFamily: selectedTemplate.fontFamily,
        headingFontWeight: selectedTemplate.headingFontWeight,
        buttonBorderRadius: selectedTemplate.buttonBorderRadius,
        cardStyle: selectedTemplate.cardStyle,
        productColumnsDesktop: selectedTemplate.productColumnsDesktop,
        announcementBarText: enableFreeShipping 
          ? `✨ شحن مجاني للطلبات فوق ${freeShippingThreshold} ${currency}! ✨` 
          : selectedTemplate.announcementBarText,
        isAnnouncementBarVisible: true,
        banners: [
          {
            id: `banner-${Date.now()}`,
            imageUrl: selectedTemplate.bannerImage,
            title: selectedTemplate.bannerTitle,
            subtitle: selectedTemplate.bannerSubtitle,
            buttonText: 'تصفح العروض والمنتجات',
            link: '#products-section'
          }
        ],
        contactInfo: {
          phone: storePhone.trim() || '01012345678',
          whatsapp: storePhone.trim().replace(/^0/, '20') || '201012345678',
          email: `${cleanSlug}@support.com`,
          address: 'جمهورية مصر العربية',
          workHours: 'يومياً على مدار 24 ساعة'
        }
      };

      // Sample catalog products
      const sampleProductsToInject: Product[] = importSampleProducts 
        ? oneToolzProducts.slice(0, selectedTemplate.sampleProductsCount)
        : [];

      // Initial settings with custom shipping options
      const customizedShipping = buildInitialShippingOptions();

      const initialSettingsOverride = {
        storeName: storeName.trim(),
        currency,
        products: sampleProductsToInject,
        enableCodFees: supportCod,
        shippingOptions: customizedShipping,
        activeCompanies: {
          'شحن داخلي': activeCarriers.internal,
          'بوسطة': activeCarriers.bosta,
          'تربو': activeCarriers.turbo,
        },
        whatsappConfig: {
          apiUrl: 'https://api.ultramsg.com/instanceXXXX/messages/chat',
          instanceId: '',
          token: '',
          isActive: enableWhatsappAlerts,
          autoSendOnStatusChange: enableWhatsappAlerts
        }
      };

      // Submit to application state & cloud database
      onStoreCreated(newStore, templateCustomization, initialSettingsOverride);

      setCreatedStoreData(newStore);
      setIsSuccessLaunched(true);
      setIsSubmitting(false);

      // Trigger party celebration
      try {
        confetti({
          particleCount: 85,
          spread: 85,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Fallback
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'حدث خطأ أثناء إنشاء المتجر. يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto flex flex-col justify-center" dir="rtl">
      
      {/* Top Breadcrumb & Navigation Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link 
          to="/manage-stores" 
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs group"
        >
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          <span>الرجوع إلى قائمة المتاجر</span>
        </Link>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Building2 size={16} className="text-teal-500" />
          <span>معالج إطلاق متجر جديد (Multi-Step Wizard)</span>
        </div>
      </div>

      {/* Main Wizard Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden relative">
        <div className="h-2 w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-600" />

        {/* Wizard Steps Navigation Bar */}
        {!isSuccessLaunched && (
          <div className="border-b border-slate-100 dark:border-slate-800/80 px-6 sm:px-10 py-6 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-2">
                  <Sparkles size={14} className="animate-spin text-teal-500" />
                  <span>معالج خطوات إنشاء المتجر الذكي</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {step === 1 && 'الخطوة الأولى: اسم المتجر ونشاطه التجاري'}
                  {step === 2 && 'الخطوة الثانية: خيارات العملة والمظهر البصري'}
                  {step === 3 && 'الخطوة الثالثة: تخصيصات الشحن والتشغيل المبدئي'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {step === 1 && 'حدد اسم علامتك التجارية، التخصص الرئيسي، والنطاق الافتراضي.'}
                  {step === 2 && 'اختر العملة الرسمية للمبيعات والقالب الجاهز المناسب لنشاطك.'}
                  {step === 3 && 'اضبط أسعار الشحن للمحافظات، الدفع عند الاستلام، ومتابعة الطلبات.'}
                </p>
              </div>

              {/* Progress Steps Indicators with Framer Motion glow */}
              <div className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-slate-900/90 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                {[
                  { stepNum: 1, title: 'الاسم والتخصص', icon: <StoreIcon size={14} /> },
                  { stepNum: 2, title: 'العملة والقالب', icon: <Coins size={14} /> },
                  { stepNum: 3, title: 'خيارات الشحن', icon: <Truck size={14} /> },
                ].map((item, idx) => {
                  const isActive = step === item.stepNum;
                  const isCompleted = step > item.stepNum;

                  return (
                    <React.Fragment key={item.stepNum}>
                      <button
                        type="button"
                        onClick={() => goToStep(item.stepNum as 1 | 2 | 3)}
                        className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all relative cursor-pointer ${
                          isActive 
                            ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20' 
                            : isCompleted
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isActive 
                            ? 'bg-slate-950 text-teal-400' 
                            : isCompleted 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {isCompleted ? '✓' : item.stepNum}
                        </span>
                        <span className="hidden sm:inline font-bold">{item.title}</span>
                      </button>

                      {idx < 2 && (
                        <div className={`w-3 sm:w-5 h-0.5 rounded-full transition-colors ${
                          step > idx + 1 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                        }`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* Wizard Steps Animated Container */}
        <div className="p-6 sm:p-10">

          <AnimatePresence mode="wait" custom={direction}>
            
            {/* STEP 1: اسم المتجر والتخصص */}
            {step === 1 && !isSuccessLaunched && (
              <motion.div
                key="wizard-step-1"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start"
              >
                {/* Left Side: Form Controls */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Store Name Input */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <StoreIcon size={16} className="text-teal-500" />
                        اسم المتجر أو العلامة التجارية *
                      </label>
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
                        خطوة أساسية
                      </span>
                    </div>

                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => {
                        setStoreName(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="مثال: لافندر كير، أو متجر تولز إكسبريس"
                      className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs"
                      autoFocus
                    />

                    {/* Quick Smart Name Suggestions */}
                    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                        <Wand2 size={12} className="text-amber-500" /> اقتراحات أسماء جاهزة:
                      </span>
                      {suggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setStoreName(sug.split(' - ')[0])}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/40 text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-all border border-slate-200/60 dark:border-slate-700 active:scale-95"
                        >
                          {sug.split(' - ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Specialization & Category Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                        <Layers size={16} className="text-indigo-500" />
                        تخصص ونشاط المتجر الرئيسي *
                      </label>
                      <select
                        value={specialization}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSpecialization(val);
                          // Auto match recommended template
                          if (val === 'الصحة والجمال') setSelectedTemplateId('phoenix-cosmetics');
                          else if (val === 'ملابس وموضة') setSelectedTemplateId('nature-fashion');
                          else if (val === 'إلكترونيات وأجهزة') setSelectedTemplateId('elite-tech-dark');
                          else if (val === 'عدد وأدوات يدوية') setSelectedTemplateId('tools-hardware');
                          else if (val === 'أدوات منزلية') setSelectedTemplateId('pearl-luxury');
                        }}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      >
                        <option value="الصحة والجمال">الصحة والجمال والعناية الشخصية</option>
                        <option value="ملابس وموضة">ملابس وموضة وأزياء كاجوال</option>
                        <option value="إلكترونيات وأجهزة">إلكترونيات وأجهزة ذكية وإكسسوارات</option>
                        <option value="أدوات منزلية">أدوات منزلية ومطبخ وديكورات</option>
                        <option value="عدد وأدوات يدوية">عدد ومعدات يدوية وورش وصيانة</option>
                        <option value="أخرى">أخرى / متجر عام ومتنوع</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                        <Globe size={16} className="text-cyan-500" />
                        لغة واجهة المتجر الافتراضية
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      >
                        <option value="عربي">العربية (Arabic - RTL)</option>
                        <option value="English">الإنجليزية (English - LTR)</option>
                      </select>
                    </div>
                  </div>

                  {/* Subdomain & Custom Domain */}
                  <div className="space-y-3 pt-2">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Globe size={15} className="text-teal-500" />
                          النطاق الافتراضي المباشر المجهز لمتجرك:
                        </span>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          نشط ومجاني
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-xs font-black text-teal-600 dark:text-teal-400 dir-ltr">
                        <span>https://{previewDomain}</span>
                        <Sparkles size={14} className="text-teal-500 shrink-0" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                        ربط دومين مخصص (Custom Domain - اختياري)
                      </label>
                      <input
                        type="text"
                        value={customDomainInput}
                        onChange={(e) => setCustomDomainInput(e.target.value)}
                        placeholder="مثال: store.com أو shop.mybrand.eg"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 dir-ltr text-right"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-8 py-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <span>المتابعة إلى العملات والقالب</span>
                      <ArrowLeft size={16} />
                    </button>
                  </div>

                </div>

                {/* Right Side: Interactive Live Phone Preview */}
                <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/40 dark:to-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
                  
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Smartphone size={16} className="text-teal-500" />
                      معاينة حية للمتجر على الجوال
                    </span>
                    <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-md border border-teal-500/20">
                      LIVE PREVIEW
                    </span>
                  </div>

                  {/* Phone Frame */}
                  <div className="w-full max-w-[300px] mx-auto bg-white dark:bg-slate-900 rounded-[32px] border-4 border-slate-800 shadow-2xl overflow-hidden text-right">
                    
                    <div className="bg-slate-900 text-white px-4 py-1.5 flex justify-between items-center text-[10px] font-mono">
                      <span>9:41</span>
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="font-black text-xs text-slate-800 dark:text-white truncate max-w-[150px]">
                        {storeName.trim() || 'اسم المتجر'}
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <ShoppingBag size={14} />
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      </div>
                    </div>

                    <div className="h-28 bg-slate-900 relative overflow-hidden flex items-center justify-center p-3 text-center">
                      <img 
                        src={selectedTemplate.bannerImage} 
                        alt="Preview banner" 
                        className="absolute inset-0 w-full h-full object-cover opacity-60" 
                      />
                      <div className="relative z-10 text-white space-y-1">
                        <div className="text-[11px] font-black line-clamp-1">{selectedTemplate.bannerTitle}</div>
                        <span className="inline-block text-[9px] font-black px-2.5 py-0.5 rounded-full bg-teal-400 text-slate-950">
                          تسوق الآن
                        </span>
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="text-[10px] font-black text-slate-800 dark:text-slate-200">المنتجات الأكثر مبيعاً</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2].map(i => (
                          <div key={i} className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-right space-y-1">
                            <div className="h-14 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 text-[10px]">
                              <Boxes size={18} />
                            </div>
                            <div className="text-[9px] font-bold text-slate-800 dark:text-white truncate">منتج تجريبي #{i}</div>
                            <div className="text-[9px] font-black text-teal-600 dark:text-teal-400">199 {currency}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                    متجر سريع وخفيف ومتوافق بنسبة 100% مع كافة الهواتف وأجهزة الكمبيوتر.
                  </p>

                </div>

              </motion.div>
            )}

            {/* STEP 2: العملات والقالب البصري */}
            {step === 2 && !isSuccessLaunched && (
              <motion.div
                key="wizard-step-2"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-8"
              >
                {/* Currency Selection Section */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Coins size={18} className="text-emerald-500" />
                      <span>اختر عملة المتجر والتسعير الرئيسية</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      حدد العملة التي سيتم عرض أسعار المنتجات وتحصيل مبالغ الأوردرات بها.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {SUPPORTED_CURRENCIES.map((curr) => {
                      const isSelected = currency === curr.code;
                      return (
                        <button
                          key={curr.code}
                          type="button"
                          onClick={() => setCurrency(curr.code)}
                          className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer relative flex flex-col justify-between items-center gap-1.5 ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-800 dark:text-teal-300 shadow-md ring-2 ring-teal-500/20 scale-105'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="text-2xl">{curr.flag}</div>
                          <div className="text-sm font-black">{curr.code}</div>
                          <div className="text-[11px] font-bold opacity-75">{curr.name}</div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-teal-500 mt-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-teal-500 shrink-0" />
                    <span>العملة المحددة: {selectedCurrencyObj.name} ({selectedCurrencyObj.code}) - {selectedCurrencyObj.description}</span>
                  </div>
                </div>

                {/* Templates Grid Section */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Palette size={18} className="text-teal-500" />
                      <span>اختر القالب والمظهر البصري الأنسب لمنتجاتك</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      قوالب مجهزة بألوان وهوية متكاملة يمكنك تخصيص كافة عناصرها لاحقاً بكل سهولة.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {STORE_TEMPLATES.map((tmpl) => {
                      const isSelected = selectedTemplateId === tmpl.id;
                      return (
                        <div
                          key={tmpl.id}
                          onClick={() => setSelectedTemplateId(tmpl.id)}
                          className={`rounded-3xl border-2 p-5 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden group ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50/20 dark:bg-teal-950/20 shadow-xl ring-2 ring-teal-500/20 scale-[1.02]'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-4 left-4 z-20 w-7 h-7 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center shadow-md">
                              <Check size={16} strokeWidth={3} />
                            </div>
                          )}

                          <div className="space-y-3">
                            <div className="h-32 rounded-2xl relative overflow-hidden bg-slate-900 flex items-end p-3">
                              <img 
                                src={tmpl.bannerImage} 
                                alt={tmpl.name} 
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                              <div className="relative z-10 space-y-1 text-white">
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                                  {tmpl.badge}
                                </span>
                                <div className="text-xs font-black truncate">{tmpl.bannerTitle}</div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-black text-sm text-slate-900 dark:text-white mb-1">
                                {tmpl.name}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {tmpl.description}
                              </p>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <span 
                                className="w-3.5 h-3.5 rounded-full border border-white shadow-xs" 
                                style={{ backgroundColor: tmpl.primaryColor }}
                              />
                              <span>لون الهوية الرئيسي</span>
                            </div>
                            <span>{tmpl.sampleProductsCount} منتجات مجهزة</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2 Bottom Controls */}
                <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    الرجوع للخطوة السابقة
                  </button>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-8 py-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>المتابعة إلى خيارات الشحن المبدئية</span>
                    <ArrowLeft size={16} />
                  </button>
                </div>

              </motion.div>
            )}

            {/* STEP 3: تخصيصات الشحن المبدئية والتشغيل */}
            {step === 3 && !isSuccessLaunched && (
              <motion.div
                key="wizard-step-3"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-8"
              >
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck size={20} className="text-teal-500" />
                    <span>تخصيصات الشحن المبدئية والتسعير</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    حدد كيفية حساب مصاريف الشحن لعملائك والشركات الفعالة فور إطلاق المتجر.
                  </p>
                </div>

                {/* Shipping Calculation Mode Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                    نمط تسعير الشحن المبدئي:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { 
                        id: 'standard', 
                        title: 'حسب المحافظة والمناطق', 
                        desc: 'أسعار متباينة للقاهرة، الدلتا، والصعيد', 
                        badge: 'الأكثر واقعية' 
                      },
                      { 
                        id: 'flat', 
                        title: 'سعر شحن موحد (Flat Rate)', 
                        desc: 'سعر شحن ثابت لكافة المحافظات', 
                        badge: 'بسيط وسريع' 
                      },
                      { 
                        id: 'free_threshold', 
                        title: 'شحن مجاني عند حد معين', 
                        desc: 'مجاني للطلبات فوق سقف مالي محدد', 
                        badge: 'لزيادة المبيعات' 
                      },
                    ].map(item => (
                      <div
                        key={item.id}
                        onClick={() => setShippingMode(item.id as any)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer text-right flex flex-col justify-between ${
                          shippingMode === item.id
                            ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm ring-1 ring-teal-500'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs">{item.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping Rates Configuration Fields */}
                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Sliders size={16} className="text-indigo-500" />
                      إعداد أسعار التوصيل ({currency}):
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      يمكنك تعديل أي محافظة لاحقاً بالتفصيل
                    </span>
                  </div>

                  {shippingMode === 'flat' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        سعر الشحن الموحد لكافة المحافظات ({currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={flatShippingRate}
                        onChange={(e) => setFlatShippingRate(Number(e.target.value) || 0)}
                        className="w-full sm:w-64 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                          <MapPin size={13} className="text-teal-500" /> القاهرة والجيزة
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={cairoGizaShippingRate}
                            onChange={(e) => setCairoGizaShippingRate(Number(e.target.value) || 0)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">{currency}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                          <MapPin size={13} className="text-teal-500" /> الإسكندرية ومحافظات الدلتا
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={alexDeltaShippingRate}
                            onChange={(e) => setAlexDeltaShippingRate(Number(e.target.value) || 0)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">{currency}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                          <MapPin size={13} className="text-teal-500" /> محافظات الصعيد والمناطق البعيدة
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={upperEgyptShippingRate}
                            onChange={(e) => setUpperEgyptShippingRate(Number(e.target.value) || 0)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">{currency}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Free shipping threshold toggle */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700/80">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={enableFreeShipping}
                        onChange={(e) => setEnableFreeShipping(e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded-md cursor-pointer"
                      />
                      <span>تفعيل شريط وحافز الشحن المجاني التلقائي للطلبات الكبيرة</span>
                    </label>

                    {enableFreeShipping && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">للطلبات فوق:</span>
                        <input
                          type="number"
                          min="50"
                          value={freeShippingThreshold}
                          onChange={(e) => setFreeShippingThreshold(Number(e.target.value) || 0)}
                          className="w-24 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-teal-500 text-center"
                        />
                        <span className="text-xs font-bold text-teal-600">{currency}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Connected Shipping Carriers */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                    شركات الشحن النشطة مبدئياً:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { key: 'internal', label: 'شحن داخلي / مناديبك الخاصة', icon: '🛵' },
                      { key: 'bosta', label: 'شركة بوسطة (Bosta Delivery)', icon: '📦' },
                      { key: 'turbo', label: 'تربو إكسبريس (Turbo Express)', icon: '⚡' },
                    ].map(carrier => (
                      <label
                        key={carrier.key}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span className="text-lg">{carrier.icon}</span>
                          <span>{carrier.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={(activeCarriers as any)[carrier.key]}
                          onChange={(e) => setActiveCarriers(prev => ({ ...prev, [carrier.key]: e.target.checked }))}
                          className="w-4 h-4 text-teal-600 rounded-md cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Operations & COD Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div 
                    onClick={() => setSupportCod(!supportCod)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                      supportCod 
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' 
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <input type="checkbox" checked={supportCod} onChange={() => {}} className="w-4 h-4 text-emerald-600 rounded-md" />
                    <div>
                      <div className="font-black text-xs flex items-center gap-1.5">
                        <CreditCard size={14} /> تفعيل الدفع عند الاستلام (COD)
                      </div>
                      <div className="text-[11px] opacity-75 mt-0.5">الدفع نقداً للمندوب عند باب المنزل</div>
                    </div>
                  </div>

                  <div 
                    onClick={() => setEnableWhatsappAlerts(!enableWhatsappAlerts)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                      enableWhatsappAlerts 
                        ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-500/40 text-teal-900 dark:text-teal-200' 
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <input type="checkbox" checked={enableWhatsappAlerts} onChange={() => {}} className="w-4 h-4 text-teal-600 rounded-md" />
                    <div>
                      <div className="font-black text-xs flex items-center gap-1.5">
                        <MessageSquare size={14} /> إشعارات وتأكيدات الواتساب
                      </div>
                      <div className="text-[11px] opacity-75 mt-0.5">تأكيد الأوردر ومتابعة الشحنة آلياً</div>
                    </div>
                  </div>
                </div>

                {/* Final Launch Summary Bar */}
                <div className="p-5 rounded-3xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 border border-teal-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-right">
                    <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-teal-500" />
                      <span>متجر: {storeName || 'بدون اسم'} ({selectedTemplate.name})</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr">
                      https://{previewDomain} • العملة: {currency}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      السابق
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleCreateStore}
                      className="flex-1 sm:flex-initial bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black px-8 py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-teal-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>جاري تهيئة المتجر وإطلاقه...</span>
                        </>
                      ) : (
                        <>
                          <Rocket size={18} />
                          <span>إطلاق وإنشاء المتجر الآن 🚀</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 text-center">
                    {error}
                  </div>
                )}

              </motion.div>
            )}

            {/* SUCCESS CELEBRATION MODAL / VIEW */}
            {isSuccessLaunched && createdStoreData && (
              <motion.div
                key="launch-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 px-4 text-center max-w-2xl mx-auto space-y-6"
              >
                <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 size={44} />
                </div>

                <div className="space-y-2">
                  <span className="inline-block text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3.5 py-1 rounded-full border border-emerald-500/20">
                    🎉 مبروك! تم إطلاق المتجر بنجاح
                  </span>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                    {createdStoreData.name} أونلاين الآن!
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    تم إنشاء المتجر بنجاح وتوليد النطاق وقالب العرض وإعداد العملة ({currency}) وضبط خيارات الشحن المبدئية وحفظها في قاعدة البيانات.
                  </p>
                </div>

                {/* Store URL Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-400">رابط متجرك المباشر:</span>
                    <div className="font-mono text-xs font-black text-teal-600 dark:text-teal-400 dir-ltr">
                      https://{createdStoreData.url}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://${createdStoreData.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 hover:bg-slate-300 transition-colors"
                    >
                      <Eye size={14} /> معاينة المتجر
                    </a>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/store/${createdStoreData.id}/dashboard`)}
                    className="w-full sm:w-auto px-8 py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>الدخول إلى لوحة تحكم المتجر</span>
                    <Rocket size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/manage-stores')}
                    className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    <span>العودة لإدارة المتاجر</span>
                  </button>
                </div>

              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </div>

    </div>
  );
};

export default CreateStorePage;
