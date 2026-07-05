
import { Settings, PERMISSIONS, StoreCustomization, ShippingOption } from './types';

const INITIAL_CUSTOMIZATION: StoreCustomization = {
  logoUrl: '',
  faviconUrl: '',
  logoSize: 'md',
  banners: [
    {
        id: 'banner-1',
        imageUrl: 'https://picsum.photos/1600/500?random=1',
        title: 'أهلاً بك في متجرنا!',
        subtitle: 'اكتشف أفضل المنتجات بأفضل الأسعار.',
        buttonText: 'تصفح المنتجات',
        link: '#products-section'
    }
  ],
  footerText: `© ${new Date().getFullYear()} جميع الحقوق محفوظة.`,
  primaryColor: '#4f46e5', // indigo-600
  backgroundColor: '#f8fafc', // slate-50
  textColor: '#0f172a',      // slate-900
  fontFamily: 'Cairo',
  headingFontWeight: 'font-black',
  bodyFontSize: 'text-base',
  announcementBarText: '✨ شحن مجاني للطلبات فوق 500 جنيه! ✨',
  isAnnouncementBarVisible: true,
  socialLinks: {
    facebook: '',
    instagram: '',
    x: '',
    tiktok: '',
  },
  pageSections: [
    { id: 'hero-section', type: 'hero', enabled: true },
    { id: 'products-section', type: 'products', enabled: true },
  ],
  buttonBorderRadius: 'rounded-lg',
  cardStyle: 'elevated',
  productColumnsDesktop: 4,
  navigationLinks: [
    { label: 'الرئيسية', url: '#hero-section' },
    { label: 'المنتجات', url: '#products-section' },
    { label: 'من نحن', url: '#about-section' },
    { label: 'روابط السوشيال', url: '#footer-section' }
  ],
  aboutUs: {
    enabled: true,
    title: 'قصة علامتنا التجارية',
    subtitle: 'نقاء الطبيعة ومصداقية المنتجات بين يديك',
    content: 'نحن نؤمن بأن الطبيعة تقدم لنا أفضل الحلول لكل احتياجاتنا. لذلك، كرسنا أنفسنا لتوفير منتجات نقية، أصلية، ومصنوعة بأعلى جودة تليق بثقتكم الغالية وتمنحكم تجربة تسوق فريدة ومميزة.',
    imageUrl: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=600&q=80'
  },
  contactInfo: {
    phone: '01012345678',
    whatsapp: '201012345678',
    email: 'support@yourstore.com',
    address: 'شارع التسعين، التجمع الخامس، القاهرة، مصر',
    workHours: 'يومياً من الساعة 10 صباحاً وحتى 10 مساءً'
  },
  checkoutFieldsOptions: {
    fullName: { show: true, required: true },
    phone: { show: true, required: true },
    address: { show: true, required: true },
    email: { show: false, required: false },
    notes: { show: true, required: false }
  },
  successScreen: {
    title: 'تم استلام طلبك بنجاح! 🎉',
    description: 'شكراً لتسوقك معنا. سيتواصل معك أحد ممثلي الدعم الفني خلال ساعات معدودة لتأكيد الشحن وتفاصيل التوصيل.',
    buttonText: 'العودة للمتجر الرئيسي'
  },
  emailNotifications: {
    customerEnabled: true,
    adminEnabled: true,
    templateType: 'minimal'
  },
  socialLinksExtended: {
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    x: 'https://twitter.com',
    tiktok: 'https://tiktok.com',
    youtube: 'https://youtube.com',
    snapchat: '',
    pinterest: ''
  }
};

export const EGYPT_GOVERNORATES = [
    { name: "القاهرة", cities: ["مدينة نصر", "مصر الجديدة", "المعادي", "التجمع الخامس", "الرحاب", "مدينتي", "الشروق", "العبور", "بدر", "المقطم", "وسط البلد", "شبرا", "عين شمس", "المطرية", "المرج", "الزيتون", "حدائق القبة", "الوايلي", "الزاوية الحمراء", "الشرابية", "الساحل", "روض الفرج", "بولاق", "منشأة ناصر", "الجمالية", "الدرب الأحمر", "باب الشعرية", "الموسكي", "الأزبكية", "عابدين", "السيدة زينب", "مصر القديمة", "البساتين", "دار السلام", "المعصرة", "حلوان", "التبين", "15 مايو", "الزمالك", "جاردن سيتي", "المنيل", "الفسطاط", "الأميرية", "الحلمية", "طره"] },
    { name: "الجيزة", cities: ["6 أكتوبر", "الشيخ زايد", "الهرم", "فيصل", "الدقي", "المهندسين", "العجوزة", "إمبابة", "الوراق", "بولاق الدكرور", "العمرانية", "الطالبية", "الجيزة", "الحوامدية", "البدرشين", "العياط", "الصف", "أطفيح", "الواحات البحرية", "أوسيم", "كرداسة", "أبو النمرس", "منشأة القناطر", "الحرانية", "سقارة", "ميت رهينة", "أرض اللواء"] },
    { name: "الإسكندرية", cities: ["برج العرب", "برج العرب الجديدة", "المنتزه", "شرق", "وسط", "الجمرك", "غرب", "العجمي", "العامرية", "الرمل", "سيدي جابر", "محرم بك", "اللبان", "العطارين", "المنشية", "كرموز", "الدخيلة", "ميامي", "فيكتوريا", "سموحة", "كفر عبده", "رشدي", "ستانلي"] },
    { name: "القليوبية", cities: ["بنها", "قليوب", "شبرا الخيمة", "القناطر الخيرية", "الخانكة", "كفر شكر", "طوخ", "قها", "العبور", "الخصوص", "شبين القناطر", "مسطرد", "أبو زعبل"] },
    { name: "الدقهلية", cities: ["المنصورة", "طلخا", "ميت غمر", "دكرنس", "أجا", "منية النصر", "السنبلاوين", "الكردي", "بني عبيد", "المنزلة", "تمى الأمديد", "الجمالية", "شربين", "المطرية", "بلقاس", "ميت سلسيل", "جمصة", "محلة دمنة", "نبروه"] },
    { name: "الشرقية", cities: ["الزقازيق", "العشر من رمضان", "منيا القمح", "بلبيس", "مشتول السوق", "القنايات", "أبو حماد", "القرين", "ههيا", "أبو كبير", "فاقوس", "الصالحية الجديدة", "الإبراهيمية", "ديرب نجم", "كفر صقر", "أولاد صقر", "الحسينية", "صان الحجر القبلية", "منشأة أبو عمر", "أولاد صقر"] },
    { name: "الغربية", cities: ["طنطا", "المحلة الكبرى", "كفر الزيات", "زفتى", "السنطة", "قطور", "بسيون", "سمنود"] },
    { name: "المنوفية", cities: ["شبين الكوم", "مدينة السادات", "منوف", "سرس الليان", "أشمون", "الباجور", "قويسنا", "بركة السبع", "تلا", "الشهداء"] },
    { name: "البحيرة", cities: ["دمنهور", "كفر الدوار", "رشيد", "إدكو", "أبو المطامير", "أبو حمص", "الدلنجات", "المحمودية", "الرحمانية", "إيتاي البارود", "حوش عيسى", "شبراخيت", "كوم حمادة", "بدر", "وادي النطرون", "النوبارية الجديدة"] },
    { name: "كفر الشيخ", cities: ["كفر الشيخ", "دسوق", "فوه", "مطوبس", "برج البرلس", "الحامول", "بلطيم", "مصيف بلطيم", "الرياض", "سيدي سالم", "قلين", "سيدي غازي", "بيلا"] },
    { name: "دمياط", cities: ["دمياط", "دمياط الجديدة", "رأس البر", "فارسكور", "الزرقا", "السرو", "الروضة", "كفر البطيخ", "عزبة البرج", "ميت أبو غالب", "كفر سعد"] },
    { name: "بورسعيد", cities: ["بورسعيد", "بورفؤاد", "حي العرب", "حي الضواحي", "حي الزهور", "حي المناخ", "حي الشرق", "حي الجنوب"] },
    { name: "الإسماعيلية", cities: ["الإسماعيلية", "فايد", "القنطرة شرق", "القنطرة غرب", "التل الكبير", "أبو صوير", "القصاصين الجديدة", "مدينة المستقبل"] },
    { name: "السويس", cities: ["السويس", "الأربعين", "عتاقة", "الجناين", "فيصل", "العين السخنة"] },
    { name: "بني سويف", cities: ["بني سويف", "بني سويف الجديدة", "الواسطى", "ناصر", "إهناسيا", "ببا", "الفشن", "سمسطا"] },
    { name: "الفيوم", cities: ["الفيوم", "الفيوم الجديدة", "طامية", "سنورس", "إطسا", "إبشواي", "يوسف الصديق"] },
    { name: "المنيا", cities: ["المنيا", "المنيا الجديدة", "العدوة", "مغاغة", "بني مزار", "مطاي", "سمالوط", "أبو قرقاص", "ملوي", "دير مواس"] },
    { name: "أسيوط", cities: ["أسيوط", "أسيوط الجديدة", "ديروط", "منفلوط", "القوصية", "أبنوب", "أبو تيج", "الغنايم", "ساحل سليم", "البداري", "صدفا", "الفتح"] },
    { name: "سوهاج", cities: ["سوهاج", "سوهاج الجديدة", "أخميم", "أخميم الجديدة", "البلينا", "المراغة", "المنشأة", "دار السلام", "جرجا", "جهينة", "ساقلتة", "طما", "طهطا", "الكوثر"] },
    { name: "قنا", cities: ["قنا", "قنا الجديدة", "أبو تشت", "فرشوط", "نجع حمادي", "الوقف", "دشنا", "قوص", "نقادة", "قفط"] },
    { name: "الأقصر", cities: ["الأقصر", "الأقصر الجديدة", "طيبة الجديدة", "الزينية", "البياضية", "القرنة", "أرمنت", "إسنا"] },
    { name: "أسوان", cities: ["أسوان", "أسوان الجديدة", "دراو", "كوم أمبو", "نصر النوبة", "كلابشة", "إدفو", "الرديسية", "البصيلية", "السباعية", "أبو سمبل السياحية"] },
    { name: "البحر الأحمر", cities: ["الغردقة", "رأس غارب", "سفاجا", "القصير", "مرسى علم", "شلاتين", "حلايب", "الجونة"] },
    { name: "الوادي الجديد", cities: ["الخارجة", "باريس", "موط", "الفرافرة", "بلاط", "الداخلة"] },
    { name: "مطروح", cities: ["مرسى مطروح", "الحمام", "العلمين", "العلمين الجديدة", "الضبعة", "النجيلة", "سيدي براني", "السلوم", "سيوة", "مارينا"] },
    { name: "شمال سيناء", cities: ["العريش", "الشيخ زويد", "رفح", "بئر العبد", "الحسنة", "نخل"] },
    { name: "جنوب سيناء", cities: ["الطور", "شرم الشيخ", "دهب", "نويبع", "طابا", "سانت كاترين", "أبو رديس", "أبو زنيمة", "رأس سدر"] },
];

export const generateEgyptShippingOptions = (): ShippingOption[] => {
  return EGYPT_GOVERNORATES.map((gov, index) => {
    // Sensible defaults
    let defaultPrice = 60;
    if (["القاهرة", "الجيزة", "الإسكندرية"].includes(gov.name)) defaultPrice = 35;
    else if (["القليوبية", "المنوفية", "الدقهلية", "الغربية", "الشرقية", "البحيرة", "دمياط", "كفر الشيخ"].includes(gov.name)) defaultPrice = 45;
    else if (["بورسعيد", "الإسماعيلية", "السويس"].includes(gov.name)) defaultPrice = 50;

    return {
      id: `gov_${index + 1}`,
      label: gov.name,
      details: 'شحن محافظات',
      deliveryPrice: defaultPrice, 
      baseWeight: 1,
      extraKgPrice: 10,
      returnPrice: 35,
      exchangePrice: 35,
      cashCollectionPrice: 15,
      returnToSenderPrice: 35,
      cities: gov.cities.map((city, cIndex) => ({
        id: `city_${index + 1}_${cIndex + 1}`,
        name: city,
        deliveryPrice: defaultPrice,
        extraKgPrice: 10,
        returnPrice: 35,
        exchangePrice: 35,
        cashCollectionPrice: 15,
        returnToSenderPrice: 35,
        useParentFees: true
      }))
    };
  });
};

export const DEFAULT_WHATSAPP_TEMPLATES = [
    { id: 'no_answer', label: 'لم يرد', text: 'أهلاً [اسم العميل] 👋، حاولنا الاتصال بك من [اسم المتجر] لتأكيد طلبك [اسم المنتج]. يرجى تأكيد الطلب لنتمكن من شحنه لك.' },
    { id: 'location', label: 'طلب الموقع', text: 'أهلاً [اسم العميل] 👋، من فضلك أرسل لنا الموقع (Location) لتسهيل عملية توصيل طلبك [اسم المنتج] من [اسم المتجر].' },
    { id: 'offer', label: 'عرض خاص', text: 'أهلاً [اسم العميل] 👋، لدينا عرض خاص لك اليوم على [اسم المنتج] من [اسم المتجر]. لا تفوت الفرصة!' },
    { id: 'confirm', label: 'تأكيد الطلب', text: 'أهلاً [اسم العميل] 👋، نود تأكيد طلبك [اسم المنتج] من [اسم المتجر]. هل البيانات صحيحة؟' },
];

export const DEFAULT_CALL_SCRIPTS = [
    { id: 'price', title: 'الاعتراض على السعر', text: 'أفهمك تماماً، لكن جودة المنتج تستحق، ونحن نقدم ضمان استبدال مجاني في حال وجود أي عيب.' },
    { id: 'shipping', title: 'الاعتراض على الشحن', text: 'مصاريف الشحن تشمل التوصيل لباب البيت والمعاينة قبل الاستلام لضمان حقك.' },
    { id: 'hesitation', title: 'التردد في الطلب', text: 'المنتج عليه طلب كبير والكمية محدودة، إذا أكدت الآن سأحجز لك قطعة فوراً.' },
    { id: 'inspection', title: 'طلب المعاينة', text: 'بالتأكيد، يمكنك فتح الطرد ومعاينة المنتج مع المندوب قبل دفع أي مليم.' },
];

export const INITIAL_SETTINGS: Settings = {
  enableGlobalFinancials: false, 
  insuranceFeePercent: 1, 
  enableInsurance: true,
  inspectionFee: 7,
  enableInspection: true,
  returnShippingFee: 35,
  enableReturnShipping: true,
  enableReturnAfterPrice: true,
  enableReturnWithoutPrice: true,
  enableExchangePrice: true,
  baseWeight: 5,
  defaultProductPrice: 2100,
  enableDefaultPrice: true,
  sku: 'XP-LZ5-160',
  products: [],
  warehouses: [],
  shippingOptions: {
    'شحن داخلي': generateEgyptShippingOptions()
  },
  activeCompanies: { 'شحن داخلي': true },
  exchangeSupported: { 'شحن داخلي': true },
  companySpecificFees: {
    'شحن داخلي': {
      insuranceFeePercent: 1,
      inspectionFee: 7,
      returnShippingFee: 35,
      useCustomFees: false,
      defaultInspectionActive: true,
      enableCodFees: true,
      codThreshold: 2000,
      codFeeRate: 0.01,
      codTaxRate: 0.14,
      enableReturnAfter: true,
      enableReturnWithout: true,
      enableExchange: true,
      enableFixedReturn: true,
      postCollectionReturnRefundsProductPrice: true,
    }
  },
  enableGlobalCod: true,
  codThreshold: 2000,
  codFeeRate: 0.01,
  codTaxRate: 0.14,
  connectedPlatforms: [],
  integration: {
    platform: 'none',
    apiKey: ''
  },
  enablePlatformIntegration: false,
  customDomain: '',
  subdomain: '',
  employees: [],
  staffMembers: [],
  payrollTransactions: [],
  customization: INITIAL_CUSTOMIZATION,
  discountCodes: [],
  abandonedCarts: [],
  reviews: [],
  shippingIntegrations: [],
  suppliers: [],
  supplyOrders: [],
  activityLogs: [],
  customPages: [],
  paymentMethods: [
    { id: 'cod', name: 'الدفع عند الاستلام', details: '', instructions: 'الدفع نقداً للمندوب عند استلام الشحنة.', active: true, type: 'cod' }
  ],
  globalOptions: [
      { id: 'opt1', name: 'المقاس', values: ['S', 'M', 'L', 'XL'] },
      { id: 'opt2', name: 'اللون', values: ['أحمر', 'أزرق', 'أسود', 'أبيض'] }
  ],
  collections: [],
  whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES,
  callScripts: DEFAULT_CALL_SCRIPTS,
  expenseCategories: ['expense_ads', 'expense_salary', 'expense_rent', 'expense_packaging', 'expense_shipping_fees', 'expense_other', 'supply_expense_shipping', 'supply_expense_other', 'vat'],
  employeeDashboardSettings: {
    showAssignedOrders: true,
    showOrderStatuses: ['في_انتظار_المكالمة', 'قيد_التنفيذ', 'جاري_المراجعة'],
    showFollowUpReminders: true,
  },
  partners: [],
  partnerTransactions: [],
  // Wallet Fees Defaults
  depositFeePercent: 1,
  withdrawalFeeType: 'flat',
  withdrawalFeePercent: 1,
  withdrawalFlatFee: 10,
  sameDayWithdrawalFeeType: 'percent',
  sameDayWithdrawalFeePercent: 1.5,
  sameDayWithdrawalFlatFee: 50,
  minWithdrawalFee: 25,
  feeApplicableMethods: ['card', 'instapay', 'wallet'],
  enableWithdrawalFees: true,
  enableInternalWithdrawalFees: false,
};

export const TRANSACTION_CATEGORY_LABELS: Record<string, string> = {
    'shipping': 'شحن',
    'insurance': 'تأمين',
    'inspection': 'معاينة',
    'collection': 'تحصيل',
    'cod': 'الدفع عند الاستلام',
    'return': 'مرتجعات',
    'manual_deposit': 'إيداع يدوي',
    'manual_withdrawal': 'سحب يدوي',
    'expense_ads': 'إعلانات وتسويق',
    'expense_salary': 'رواتب ومكافآت',
    'expense_rent': 'إيجار ومرافق',
    'expense_packaging': 'أدوات تغليف',
    'expense_shipping_fees': 'مصاريف شحن إدارية',
    'expense_other': 'مصاريف أخرى',
    'inventory_purchase': 'شراء مخزون',
    'capital_addition': 'إضافة رأس مال',
    'profit_withdrawal': 'سحب أرباح',
    'loan': 'قرض / سلفة',
    'repayment': 'سداد مديونية',
    'wallet_charge': 'شحن محفظة',
    'wallet_withdrawal': 'سحب من المحفظة',
    'withdrawal_fee': 'عمولة سحب رصيد',
    'partner_supply': 'توريد شريك',
    'supplier_payment': 'سداد مورد',
    'supply_purchase': 'أمر توريد مخزون',
    'supply_deposit': 'إيداع توريد',
    'supply_funding': 'تمويل توريد',
    'supply_expense_shipping': 'مصاريف شحن مشتريات',
    'supply_expense_other': 'مصاريف أخرى / إضافية مشتريات',
    'pos_digital': 'مبيعات POS رقمية',
    'pos_cash': 'مبيعات POS كاش (إيداع محفظة)',
    'vat': 'ضريبة القيمة المضافة'
};

export const ORDER_STATUSES = [
  'في_انتظار_المكالمة',
  'جاري_المراجعة',
  'قيد_التنفيذ', 
  'تم_الارسال', 
  'تم_التوصيل',
  'مرتجع', 
  'فشل_التوصيل',
  'ملغي',
  'مؤرشف'
] as const;

export const ORDER_STATUS_METADATA: Record<string, { label: string, color: string, icon: any }> = {
  'في_انتظار_المكالمة': { label: 'بانتظار مكالمة', color: 'bg-cyan-500', icon: 'PhoneForwarded' },
  'جاري_المراجعة': { label: 'قيد المراجعة', color: 'bg-purple-500', icon: 'FileSearch' },
  'قيد_التنفيذ': { label: 'قيد التنفيذ', color: 'bg-amber-500', icon: 'Package' },
  'تم_الارسال': { label: 'تم الارسال', color: 'bg-blue-500', icon: 'Truck' },
  'تم_التوصيل': { label: 'تم التوصيل', color: 'bg-emerald-600', icon: 'Coins' },
  'مرتجع': { label: 'مرتجع', color: 'bg-rose-500', icon: 'RefreshCcw' },
  'فشل_التوصيل': { label: 'فشل التوصيل', color: 'bg-red-500', icon: 'XCircle' },
  'ملغي': { label: 'ملغي', color: 'bg-slate-500', icon: 'XCircle' },
  'مؤرشف': { label: 'مؤرشف', color: 'bg-slate-400', icon: 'Archive' },
  'مرتجع_بعد_الاستلام': { label: 'مرتجع بعد الاستلام', color: 'bg-rose-600', icon: 'RefreshCcw' }, // Legacy
  'تم_الاستبدال': { label: 'تم الاستبدال', color: 'bg-indigo-500', icon: 'RefreshCcw' }, // Legacy
  'مرتجع_جزئي': { label: 'مرتجع جزئي', color: 'bg-orange-500', icon: 'RefreshCcw' }, // Legacy
  'تمت_الاعادة_لشركة_الشحن': { label: 'عادت لشركة الشحن', color: 'bg-red-600', icon: 'XCircle' }, // Legacy
  'مؤجل': { label: 'طلب مؤجل (هولد)', color: 'bg-orange-600', icon: 'AlertCircle' }, // Legacy
  'مجدول': { label: 'طلب مجدول', color: 'bg-indigo-600', icon: 'Clock' }, // Legacy
  'تم_توصيلها': { label: 'تم التوصيل', color: 'bg-emerald-500', icon: 'CheckCircle' }, // Legacy
  'تم_التحصيل': { label: 'تم التحصيل', color: 'bg-emerald-600', icon: 'Coins' }, // Legacy
  'مدفوعة': { label: 'مدفوعة', color: 'bg-emerald-700', icon: 'CreditCard' }, // Legacy
  'قيد_الشحن': { label: 'قيد الشحن', color: 'bg-sky-500', icon: 'Truck' }, // Legacy
};
