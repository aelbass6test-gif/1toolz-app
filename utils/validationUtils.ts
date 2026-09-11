/**
 * Phone & Address Validation Utilities
 * Specialized for Egyptian Logistics & WhatsApp Standards
 */

export interface PhoneValidationResult {
  isValid: boolean;
  cleanPhone: string;
  formattedLocal: string; // e.g. 01012345678
  formattedInternational: string; // e.g. 201012345678
  formattedWhatsAppUrl: string; // e.g. https://wa.me/201012345678
  operator?: 'فودافون (Vodafone)' | 'أورنج (Orange)' | 'اتصالات (Etisalat)' | 'وي (WE)' | 'أخرى';
  operatorColor?: string;
  error?: string;
  suggestion?: string;
}

export function validateEgyptianPhone(rawPhone: string): PhoneValidationResult {
  if (!rawPhone) {
    return {
      isValid: false,
      cleanPhone: '',
      formattedLocal: '',
      formattedInternational: '',
      formattedWhatsAppUrl: '',
      error: 'رقم الهاتف مطلوب'
    };
  }

  // Remove all non-digit characters
  let digits = rawPhone.replace(/\D/g, '');

  // Strip international prefix if present
  if (digits.startsWith('0020')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('20') && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('+20')) {
    digits = digits.slice(3);
  }

  // If starts with 1 instead of 01 (common typo e.g. 1012345678)
  if (digits.length === 10 && digits.startsWith('1')) {
    digits = '0' + digits;
  }

  // Check valid Egyptian mobile prefix: 010, 011, 012, 015
  const isLengthValid = digits.length === 11;
  const prefix = digits.slice(0, 3);
  
  let operator: PhoneValidationResult['operator'] = undefined;
  let operatorColor = 'slate';

  if (prefix === '010') {
    operator = 'فودافون (Vodafone)';
    operatorColor = 'rose';
  } else if (prefix === '011') {
    operator = 'اتصالات (Etisalat)';
    operatorColor = 'emerald';
  } else if (prefix === '012') {
    operator = 'أورنج (Orange)';
    operatorColor = 'amber';
  } else if (prefix === '015') {
    operator = 'وي (WE)';
    operatorColor = 'purple';
  }

  const isPrefixValid = Boolean(operator);

  if (!isLengthValid || !isPrefixValid) {
    let error = 'رقم هاتف غير صحيح';
    let suggestion = '';

    if (digits.length < 11) {
      error = `الرقم ناقص (${digits.length} أرقام بدلاً من 11)`;
    } else if (digits.length > 11) {
      error = `الرقم زائد (${digits.length} أرقام بدلاً من 11)`;
    } else if (!isPrefixValid) {
      error = 'يجب أن يبدأ الرقم بـ 010 أو 011 أو 012 أو 015';
    }

    return {
      isValid: false,
      cleanPhone: digits,
      formattedLocal: digits,
      formattedInternational: digits.startsWith('0') ? '2' + digits : '20' + digits,
      formattedWhatsAppUrl: `https://wa.me/${digits.startsWith('0') ? '2' + digits : '20' + digits}`,
      operator,
      operatorColor,
      error,
      suggestion
    };
  }

  const formattedLocal = digits;
  const formattedInternational = '2' + digits;
  const formattedWhatsAppUrl = `https://wa.me/2${digits}`;

  return {
    isValid: true,
    cleanPhone: digits,
    formattedLocal,
    formattedInternational,
    formattedWhatsAppUrl,
    operator,
    operatorColor
  };
}

export interface AddressQualityResult {
  score: 'weak' | 'medium' | 'good' | 'excellent';
  scoreLabel: string;
  scoreColor: string;
  scorePercentage: number;
  warnings: string[];
  tips: string[];
  isDetailedEnough: boolean;
}

export function validateAddressQuality(address: string = '', governorate: string = ''): AddressQualityResult {
  const cleanAddr = address.trim();
  const warnings: string[] = [];
  const tips: string[] = [];

  if (!cleanAddr) {
    return {
      score: 'weak',
      scoreLabel: 'فارغ',
      scoreColor: 'rose',
      scorePercentage: 0,
      warnings: ['العنوان فارغ، لا يمكن شحن الطلب بدون عنوان'],
      tips: ['اكتب اسم الشارع، رقم المبنى أو علامة مميزة بجوار العميل'],
      isDetailedEnough: false
    };
  }

  let points = 0;

  // Length check
  if (cleanAddr.length < 8) {
    warnings.push('العنوان قصير جداً (اسم المنطقة فقط)، قد ترفضه شركة الشحن لعدم وضوحه');
    tips.push('أضف رقم المنزل أو اسم الشارع بالتفصيل');
    points += 10;
  } else if (cleanAddr.length < 18) {
    warnings.push('العنوان مختصر نسبياً، يُفضل إضافة تفاصيل أوضح لتسليم سريع');
    points += 30;
  } else {
    points += 45;
  }

  // Keywords check for thorough delivery address
  const detailedKeywords = [
    'شارع', 'ش ', 'ش.', 'طريق', 'ميدان', 'عمارة', 'مبنى', 'برج', 
    'بجوار', 'امام', 'أمام', 'خلف', 'ناحية', 'دور', 'شقة', 'شقه', 
    'بلوك', 'قطعة', 'فيلا', 'محل', 'معرض', 'مكتب', 'تقاطع'
  ];

  const matchedKeywords = detailedKeywords.filter(kw => cleanAddr.includes(kw));
  if (matchedKeywords.length >= 2) {
    points += 35;
  } else if (matchedKeywords.length === 1) {
    points += 20;
    tips.push('يمكنك إضافة رقم الدور أو علامة مميزة شهيرة لتسهيل وصول المندوب');
  } else {
    tips.push('أضف كلمات توضيحية مثل (شارع - عمارة - بجوار)');
  }

  // Numbers check (building / apt / block numbers)
  if (/\d+/.test(cleanAddr)) {
    points += 20;
  } else {
    tips.push('يفضل ذكر رقم العمارة أو المحل إن وجد');
  }

  let score: AddressQualityResult['score'] = 'weak';
  let scoreLabel = 'ضعيف (معرض للتأخير)';
  let scoreColor = 'rose';

  if (points >= 75) {
    score = 'excellent';
    scoreLabel = 'ممتاز ومكتمل للشحن 🚀';
    scoreColor = 'emerald';
  } else if (points >= 50) {
    score = 'good';
    scoreLabel = 'جيد وواضح';
    scoreColor = 'indigo';
  } else if (points >= 30) {
    score = 'medium';
    scoreLabel = 'متوسط (ينقصه بعض التفاصيل)';
    scoreColor = 'amber';
  }

  return {
    score,
    scoreLabel,
    scoreColor,
    scorePercentage: Math.min(100, points),
    warnings,
    tips,
    isDetailedEnough: points >= 45
  };
}
