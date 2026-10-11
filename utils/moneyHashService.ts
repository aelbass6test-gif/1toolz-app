import { MoneyHashConfig, MoneyHashMethodConfig, Order } from '../types';

export const MONEYHASH_DEFAULT_METHODS: MoneyHashMethodConfig[] = [
  {
    id: 'cards',
    name: 'بطاقات البنك والائتمان (Visa / MasterCard)',
    category: 'card',
    enabled: true,
    description: 'دفع مباشر آمن بواسطة الفيزا، الماستركارد وكروت البنوك المصرية والعالمية.',
    icon: '💳'
  },
  {
    id: 'vodafone_cash',
    name: 'المحافظ الإلكترونية (Vodafone Cash, Orange, Etisalat, WE)',
    category: 'wallet',
    enabled: true,
    description: 'تحويل لحظي من أي محفظة كاش إلكترونية عن طريق إدخال رقم الهاتف المسجل بالمحفظة.',
    icon: '📱'
  },
  {
    id: 'instapay',
    name: 'التحويل المباشر اللحظي (InstaPay / IPN)',
    category: 'instant_transfer',
    enabled: true,
    description: 'دفع فورياً عبر شبكة المدفوعات اللحظية إنستا باي من حسابك البنكي مباشرة.',
    icon: '⚡'
  },
  {
    id: 'valu',
    name: 'الدفع بالتقسيط المريح عبر فاليو (ValU)',
    category: 'bnpl',
    enabled: true,
    description: 'تقسيط مشترياتك على خطط سداد مريحة تبدأ من 3 شهور حتى 60 شهر عبر تطبيق فاليو.',
    icon: '🛍️'
  },
  {
    id: 'fawry',
    name: 'الدفع نقداً عبر منافذ فوري (Fawry Code)',
    category: 'kiosk',
    enabled: true,
    description: 'الحصول على كود مرجعي مدفوع بالسداد نقداً من أقرب ماكينة أو منفذ فوري.',
    icon: '🏪'
  },
  {
    id: 'tabby',
    name: 'تقسيط تابي (Tabby - 4 دفعات بدون فوائد)',
    category: 'bnpl',
    enabled: true,
    description: 'قسم قيمة مشترياتك على 4 دفعات متساوية بدون أي فوائد أو رسوم خفية.',
    icon: '📦'
  },
  {
    id: 'tamara',
    name: 'تقسيط تمارا (Tamara BNPL)',
    category: 'bnpl',
    enabled: true,
    description: 'ادفع قسطك الأول فوراً وقسّم المتبقي على دفعات شهرية مريحة.',
    icon: '✨'
  },
  {
    id: 'meeza',
    name: 'كارت ميزة المحلي (Meeza Card)',
    category: 'card',
    enabled: true,
    description: 'دفع آمن للبطاقات الوطنية المصرية ميزة للدفع الإلكتروني.',
    icon: '🇪🇬'
  },
  {
    id: 'apple_pay',
    name: 'أبل باي (Apple Pay)',
    category: 'card',
    enabled: true,
    description: 'دفع سريع بضغطة زر واحدة لأجهزة آبل باستخدام FaceID / TouchID.',
    icon: '🍏'
  },
  {
    id: 'souhoola',
    name: 'تقسيط سهولة (Souhoola)',
    category: 'bnpl',
    enabled: false,
    description: 'خطط تقسيط مخصصة للمشتريات عبر برنامج سهولة للتمويل الاستهلاكي.',
    icon: '🌀'
  },
  {
    id: 'sympl',
    name: 'تقسيط سيمبل بدون فوائد (Sympl)',
    category: 'bnpl',
    enabled: false,
    description: 'قسّم مشترياتك بدون إجراءات معقدة أو فوائد إضافية عند الخروج.',
    icon: '🎯'
  },
  {
    id: 'aman',
    name: 'منافذ أمان (Aman Kiosk)',
    category: 'kiosk',
    enabled: false,
    description: 'سداد المبلغ نقداً عبر كود تحصيل مخصص في جميع فروع ومنافذ أمان.',
    icon: '🛡️'
  }
];

export const DEFAULT_MONEYHASH_CONFIG: MoneyHashConfig = {
  isActive: false,
  mode: 'test',
  apiKey: '',
  publicApiKey: '',
  accountKey: '',
  webhookSecret: '',
  currency: 'EGP',
  selectedMethods: {
    cards: true,
    vodafone_cash: true,
    instapay: true,
    valu: true,
    fawry: true,
    tabby: true,
    tamara: true,
    meeza: true,
    apple_pay: true
  },
  methodsConfig: MONEYHASH_DEFAULT_METHODS,
  autoRedirectOnSuccess: true,
  testModeNotes: 'وضع الاختبار مُمكّن. يمكنك استخدام بطاقات وأكواد MoneyHash الاختبارية.'
};

/**
 * Creates a MoneyHash Payment Intent by calling proxy server API
 */
export async function createMoneyHashIntent(params: {
  amount: number;
  currency?: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  selectedMethodId?: string;
  config: MoneyHashConfig;
  storeName?: string;
}): Promise<{
  success: boolean;
  intentId?: string;
  embedUrl?: string;
  payUrl?: string;
  message?: string;
  raw?: any;
}> {
  try {
    const { amount, currency = 'EGP', orderNumber, customerName, customerPhone, customerEmail, selectedMethodId, config, storeName } = params;

    if (!config.apiKey && !config.publicApiKey) {
      return {
        success: false,
        message: 'بيانات الاعتماد لموني هاش (MoneyHash API Key) غير مكتملة في إعدادات المتجر.'
      };
    }

    const response = await fetch('/api/moneyhash/create-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        currency: currency || config.currency || 'EGP',
        orderNumber,
        customerName,
        customerPhone,
        customerEmail,
        selectedMethodId,
        storeName: storeName || 'المتجر الإلكتروني',
        mode: config.mode,
        apiKey: config.apiKey,
        publicApiKey: config.publicApiKey,
        accountKey: config.accountKey
      })
    });

    const data = await response.json();
    if (data.success && data.intentId) {
      return {
        success: true,
        intentId: data.intentId,
        embedUrl: data.embedUrl || data.payUrl,
        payUrl: data.payUrl || data.embedUrl,
        raw: data.data
      };
    } else {
      return {
        success: false,
        message: data.error || data.message || 'تعذر إنشاء نية الدفع عبر MoneyHash'
      };
    }
  } catch (err: any) {
    console.error('[MONEYHASH-CREATE-INTENT-ERROR]', err);
    return {
      success: false,
      message: err.message || 'خطأ في الاتصال بخادم MoneyHash'
    };
  }
}

/**
 * Checks status of a MoneyHash Payment Intent
 */
export async function fetchMoneyHashIntentStatus(intentId: string, apiKey?: string): Promise<{
  success: boolean;
  status?: string;
  isPaid?: boolean;
  raw?: any;
}> {
  try {
    const response = await fetch(`/api/moneyhash/status/${intentId}?apiKey=${encodeURIComponent(apiKey || '')}`);
    const data = await response.json();
    if (data.success) {
      const status = (data.status || '').toUpperCase();
      const isPaid = status === 'SUCCESSFUL' || status === 'PAID' || status === 'COMPLETED';
      return {
        success: true,
        status,
        isPaid,
        raw: data.data
      };
    }
    return { success: false, status: 'UNKNOWN' };
  } catch (err) {
    return { success: false, status: 'ERROR' };
  }
}

/**
 * Creates or registers a MoneyHash sub-account (v11_accounts_create)
 */
export async function createMoneyHashAccount(params: {
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  currency?: string;
  config: MoneyHashConfig;
}): Promise<{
  success: boolean;
  accountId?: string;
  accountKey?: string;
  message?: string;
  raw?: any;
}> {
  try {
    const { name, email, phone, country = 'EG', currency = 'EGP', config } = params;
    const response = await fetch('/api/moneyhash/accounts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone,
        country,
        currency,
        mode: config.mode,
        apiKey: config.apiKey
      })
    });
    const data = await response.json();
    if (data.success) {
      return {
        success: true,
        accountId: data.accountId,
        accountKey: data.accountKey,
        message: data.message || 'تم تسجيل/إنشاء حساب التاجر على MoneyHash بنجاح',
        raw: data.data
      };
    }
    return {
      success: false,
      message: data.error || 'تعذر إنشاء الحساب على MoneyHash'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'خطأ في الاتصال بالسيرفر أثناء إنشاء الحساب'
    };
  }
}

/**
 * Registers credentials for a specific payment method on a MoneyHash account (v11_accounts_payment_methods_create)
 */
export async function createMoneyHashAccountPaymentMethod(params: {
  accountId: string;
  provider: string;
  credentials?: Record<string, any>;
  config: MoneyHashConfig;
}): Promise<{
  success: boolean;
  message?: string;
  raw?: any;
}> {
  try {
    const { accountId, provider, credentials, config } = params;
    const response = await fetch('/api/moneyhash/accounts/payment-methods/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        provider,
        credentials,
        mode: config.mode,
        apiKey: config.apiKey
      })
    });
    const data = await response.json();
    if (data.success) {
      return {
        success: true,
        message: data.message || `تم تفعيل إعدادات المزود (${provider}) بنجاح`,
        raw: data.data
      };
    }
    return {
      success: false,
      message: data.error || 'تعذر إضافة وسيلة الدفع للحساب'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'خطأ في الاتصال'
    };
  }
}

/**
 * Generates WhatsApp payment link message for MoneyHash
 */
export function buildMoneyHashWhatsAppMessage(order: Partial<Order>, payUrl: string, storeName: string): string {
  return `مرحباً ${order.customerName || 'عميلنا العزيز'} 👋

رابط السداد الإلكتروني المباشر الخاص بطلبك رقم *#${order.orderNumber || ''}* من متجر *${storeName}*:

💳 **رابط الدفع المباشر عبر MoneyHash:**
${payUrl}

💵 *المبلغ المطلوب سداده:* ${order.totalPrice || order.productPrice || 0} ج.م
📌 يمكنك السداد بأي طريقة تناسبك (بطاقة بنكية، فودافون كاش، إنستا باي، فاليو، تابي، أو فوري).

لأي استفسارات يسعدنا التواصل معك دائماً! 🚀`;
}
