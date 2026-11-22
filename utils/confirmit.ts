import { Order, Settings } from '../types';

/**
 * Exact accepted governorates list from Confirm It Order API documentation (Section 3).
 * Capitalization doesn't matter to Confirm It, spelling MUST match this list.
 */
export const CONFIRMIT_ACCEPTED_PROVINCES = [
  'Cairo',
  'Giza',
  'Alexandria',
  '6th of October',
  'El Kalioubia',
  'Dakahlia',
  'Sharqia',
  'Gharbia',
  'Monufia',
  'Behira',
  'Kafr Alsheikh',
  'Damietta',
  'Port Said',
  'Ismailia',
  'Suez',
  'North Coast',
  'Matrouh',
  'Fayoum',
  'Bani Suif',
  'Menya',
  'Assuit',
  'Sohag',
  'Qena',
  'Luxor',
  'Aswan',
  'Red Sea',
  'New Valley',
  'North Sinai',
  'South Sinai',
] as const;

export type ConfirmItProvince = (typeof CONFIRMIT_ACCEPTED_PROVINCES)[number];

const PROVINCE_LOOKUP = new Map<string, ConfirmItProvince>();

const registerProvinceAliases = (canonical: ConfirmItProvince, aliases: string[]) => {
  const norm = (v: string) =>
    v
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  PROVINCE_LOOKUP.set(norm(canonical), canonical);
  for (const alias of aliases) {
    PROVINCE_LOOKUP.set(norm(alias), canonical);
  }
};

registerProvinceAliases('Cairo', [
  'cairo', 'eg-c', 'القاهره', 'القاهرة', 'قاهره', 'مدينة نصر', 'nasr city', 'المعادي', 'maadi',
  'مصر الجديده', 'heliopolis', 'التجمع', 'القاهره الجديده', 'new cairo', 'حلوان', 'helwan',
  'شبرا', 'الرحاب', 'مدينتي', 'الشروق', 'بدر', 'العبور الجديده', 'الزمالك', 'المقطم'
]);
registerProvinceAliases('Giza', [
  'giza', 'eg-gz', 'الجيزه', 'الجيزة', 'جيزه', 'الهرم', 'فيصل', 'الدقي', 'المهندسين',
  'امبابه', 'العجوزه', 'حدائق الاهرام', 'البدرشين', 'الحوامديه', 'العياط'
]);
registerProvinceAliases('6th of October', [
  '6th of october', '6th october', '6 october', 'october', '6 اكتوبر', 'السادس من اكتوبر',
  'اكتوبر', 'الشيخ زايد', 'sheikh zayed', 'zayed', 'حدائق اكتوبر'
]);
registerProvinceAliases('Alexandria', [
  'alexandria', 'alex', 'eg-alx', 'الاسكندريه', 'الإسكندرية', 'اسكندريه', 'برج العرب',
  'العجمي', 'سموحه', 'سيدي جابر', 'المنتزه'
]);
registerProvinceAliases('El Kalioubia', [
  'el kalioubia', 'kalioubia', 'qalyubia', 'qalyoubia', 'kalubia', 'eg-kb',
  'القليوبيه', 'القليوبية', 'قليوبيه', 'بنها', 'banha', 'شبرا الخيمه', 'قليوب', 'الخانكه', 'العبور'
]);
registerProvinceAliases('Dakahlia', [
  'dakahlia', 'el dakahlia', 'eg-dk', 'الدقهليه', 'الدقهلية', 'دقهليه',
  'المنصوره', 'mansoura', 'ميت غمر', 'السنبلاوين', 'طلخا', 'دكرنس', 'بلقاس'
]);
registerProvinceAliases('Sharqia', [
  'sharqia', 'sharkia', 'ash sharqia', 'el sharkia', 'eg-shr',
  'الشرقيه', 'الشرقية', 'شرقيه', 'الزقازيق', 'zagazig', 'العاشر من رمضان', '10th of ramadan',
  'بلبيس', 'منيا القمح', 'فاقوس', 'ابو كبير'
]);
registerProvinceAliases('Gharbia', [
  'gharbia', 'el gharbia', 'gharbiya', 'eg-gh', 'الغربيه', 'الغربية', 'غربيه',
  'طنطا', 'tanta', 'المحله الكبري', 'المحله', 'mahalla', 'كفر الزيات', 'زفتي'
]);
registerProvinceAliases('Monufia', [
  'monufia', 'menofia', 'menoufia', 'eg-mnf', 'المنوفيه', 'المنوفية', 'منوفيه',
  'شبين الكوم', 'السادات', 'sadat city', 'اشمون', 'منوف', 'قويسنا'
]);
registerProvinceAliases('Behira', [
  'behira', 'beheira', 'el behira', 'el beheira', 'eg-bh', 'البحيره', 'البحيرة', 'بحيره',
  'دمنهور', 'damanhour', 'كفر الدوار', 'ادكو', 'رشيد', 'كوم حماده', 'ايتاي البارود'
]);
registerProvinceAliases('Kafr Alsheikh', [
  'kafr alsheikh', 'kafr el sheikh', 'kafr el-sheikh', 'kafr elsheikh', 'eg-kfs',
  'كفر الشيخ', 'دسوق', 'فوه', 'سيدي سالم', 'الحامول', 'بيلا', 'بلطيم'
]);
registerProvinceAliases('Damietta', [
  'damietta', 'domyat', 'eg-dt', 'دمياط', 'دمياط الجديده', 'new damietta', 'رأس البر', 'فارسكور'
]);
registerProvinceAliases('Port Said', [
  'port said', 'portsaid', 'eg-pts', 'بورسعيد', 'بور سعيد', 'بورفؤاد'
]);
registerProvinceAliases('Ismailia', [
  'ismailia', 'ismailiya', 'eg-is', 'الاسماعيليه', 'الإسماعيلية', 'اسماعيليه', 'فايد', 'التل الكبير', 'القنطره'
]);
registerProvinceAliases('Suez', [
  'suez', 'eg-suz', 'السويس', 'سويس', 'العين السخنه', 'ain sokhna'
]);
registerProvinceAliases('North Coast', [
  'north coast', 'sahel', 'marina', 'الساحل الشمالي', 'الساحل', 'مارينا', 'العلمين', 'سيدي عبد الرحمن'
]);
registerProvinceAliases('Matrouh', [
  'matrouh', 'marsa matrouh', 'mersa matrouh', 'eg-mt', 'مطروح', 'مرسي مطروح', 'الحمام', 'الضبعه', 'سيوه'
]);
registerProvinceAliases('Fayoum', [
  'fayoum', 'faiyum', 'el fayoum', 'eg-fym', 'الفيوم', 'فيوم', 'سنورس', 'طاميه', 'ابشواي'
]);
registerProvinceAliases('Bani Suif', [
  'bani suif', 'beni suef', 'bani suef', 'beni suif', 'eg-bns', 'بني سويف', 'بنى سويف', 'الواسطي', 'ناصر', 'اهناسيا'
]);
registerProvinceAliases('Menya', [
  'menya', 'minya', 'el minya', 'el menya', 'eg-mn', 'المنيا', 'منيا', 'ملوي', 'سمالوط', 'بني مزار', 'مغاغه'
]);
registerProvinceAliases('Assuit', [
  'assuit', 'asyut', 'assiut', 'eg-ast', 'اسيوط', 'أسيوط', 'ديروط', 'منفلوط', 'القوصيه', 'ابنوب'
]);
registerProvinceAliases('Sohag', [
  'sohag', 'suhaj', 'eg-shg', 'سوهاج', 'جرجا', 'اخميم', 'طهطا', 'طما', 'البلينا'
]);
registerProvinceAliases('Qena', [
  'qena', 'qina', 'eg-kn', 'قنا', 'نجع حمادي', 'دشنا', 'قوص', 'فرشوط'
]);
registerProvinceAliases('Luxor', [
  'luxor', 'eg-lx', 'الاقصر', 'الأقصر', 'اقصر', 'اسنا', 'ارمنت'
]);
registerProvinceAliases('Aswan', [
  'aswan', 'eg-asn', 'اسوان', 'أسوان', 'كوم امبو', 'ادفو', 'دراو'
]);
registerProvinceAliases('Red Sea', [
  'red sea', 'hurghada', 'el gouna', 'eg-ba', 'البحر الاحمر', 'البحر الأحمر',
  'الغردقه', 'الجونه', 'سفاجا', 'القصير', 'مرسي علم', 'رأس غارب'
]);
registerProvinceAliases('New Valley', [
  'new valley', 'el wadi el gedid', 'eg-wad', 'الوادي الجديد', 'الوادى الجديد', 'الخارجه', 'الداخله', 'الفرافره'
]);
registerProvinceAliases('North Sinai', [
  'north sinai', 'eg-sin', 'شمال سيناء', 'العريش', 'arish', 'بئر العبد', 'رفح', 'الشيخ زويد'
]);
registerProvinceAliases('South Sinai', [
  'south sinai', 'eg-js', 'جنوب سيناء', 'شرم الشيخ', 'sharm el sheikh', 'دهب', 'dahab', 'نويبع', 'الطور', 'طابا'
]);

const normalizeForGovLookup = (raw: string): string =>
  String(raw || '')
    .toLowerCase()
    .replace(/محافظ[ةه]/g, ' ')
    .replace(/governorate/gi, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function mapGovernorateToConfirmItProvince(
  rawProvince?: string,
  ...fallbacks: Array<string | undefined>
): ConfirmItProvince | null {
  const candidates = [rawProvince, ...fallbacks].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );

  for (const cand of candidates) {
    const cleaned = normalizeForGovLookup(cand);
    if (!cleaned) continue;

    // 1. Direct exact alias match
    const exact = PROVINCE_LOOKUP.get(cleaned);
    if (exact) return exact;

    // 2. Token / substring containment match (longest alias first for specificity like "6th of october" / "الشيخ زايد")
    const sortedEntries = Array.from(PROVINCE_LOOKUP.entries()).sort(
      (a, b) => b[0].length - a[0].length
    );
    for (const [alias, canonical] of sortedEntries) {
      if (alias.length >= 3 && (cleaned === alias || cleaned.includes(alias))) {
        return canonical;
      }
    }
  }

  return null;
}

/**
 * Normalizes Egyptian mobile numbers to 01XXXXXXXXX or +201XXXXXXXXX as required by Confirm It.
 */
export function normalizeConfirmItPhone(rawPhone?: string): string {
  if (!rawPhone) return '';
  // Convert Arabic/Eastern numerals to ASCII digits
  let phone = String(rawPhone)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim();

  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // 00201XXXXXXXXX -> +201XXXXXXXXX -> 01XXXXXXXXX
  if (digits.startsWith('00201') && digits.length >= 14) {
    return `0${digits.slice(4)}`;
  }
  if (digits.startsWith('201') && digits.length === 12) {
    return hasPlus ? `+${digits}` : `0${digits.slice(2)}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `0${digits}`;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return digits;
  }
  return digits;
}

export interface ResolvedConfirmItTarget {
  valid: boolean;
  storeKey?: string;
  url?: string;
  maskedUrl?: string;
  error?: string;
}

const CONFIRMIT_HOSTS = new Set(['www.confirmit-eg.com', 'confirmit-eg.com']);
const SAFE_STORE_KEY_REGEX = /^[a-zA-Z0-9._-]{2,120}$/;

/**
 * Strictly validates and resolves either a bare Confirm It store ID or private brand URL.
 * Prevents SSRF by enforcing allowlisted Confirm It domain & path pattern.
 */
export function resolveConfirmItTarget(rawInput?: string): ResolvedConfirmItTarget {
  const input = String(rawInput || '').trim();
  if (!input) {
    return { valid: false, error: 'يرجى إدخال معرف المتجر أو الرابط السري الخاص بـ Confirm It.' };
  }

  // Case A: Bare Store ID (no URL/slashes)
  if (!input.includes('/') && !input.includes(':')) {
    if (!SAFE_STORE_KEY_REGEX.test(input)) {
      return {
        valid: false,
        error: 'معرّف متجر Confirm It غير صالح. يجب أن يحتوي على حروف وأرقام إنجليزية أو (-) أو (_) فقط.'
      };
    }
    return {
      valid: true,
      storeKey: input,
      url: `https://www.confirmit-eg.com/api/brands/${encodeURIComponent(input)}/orders/`,
      maskedUrl: 'https://www.confirmit-eg.com/api/brands/***/orders/'
    };
  }

  // Case B: Full Confirm It Endpoint URL
  try {
    const parsed = new URL(input.startsWith('http') ? input : `https://${input}`);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'بروتوكول الرابط غير مدعوم.' };
    }
    if (!CONFIRMIT_HOSTS.has(parsed.hostname.toLowerCase())) {
      return {
        valid: false,
        error: 'يُسمح فقط برابط Confirm It الرسمي (https://www.confirmit-eg.com/api/brands/.../orders/).'
      };
    }
    const match = parsed.pathname.match(/^\/api\/brands\/([a-zA-Z0-9._-]+)\/orders\/?$/i);
    if (!match || !match[1]) {
      return {
        valid: false,
        error: 'صيغة الرابط غير مكتملة. الصيغة الصحيحة: https://www.confirmit-eg.com/api/brands/YOUR-STORE-ID/orders/'
      };
    }
    const storeKey = decodeURIComponent(match[1]);
    if (!SAFE_STORE_KEY_REGEX.test(storeKey)) {
      return { valid: false, error: 'معرّف المتجر داخل الرابط غير صالح.' };
    }
    return {
      valid: true,
      storeKey,
      url: `https://www.confirmit-eg.com/api/brands/${encodeURIComponent(storeKey)}/orders/`,
      maskedUrl: 'https://www.confirmit-eg.com/api/brands/***/orders/'
    };
  } catch {
    return {
      valid: false,
      error: 'تعذر قراءة رابط Confirm It أو معرّف المتجر. تأكد من إدخاله بصيغة صحيحة.'
    };
  }
}

export function maskConfirmItTarget(rawInput?: string): string {
  const resolved = resolveConfirmItTarget(rawInput);
  if (resolved.valid && resolved.maskedUrl) return resolved.maskedUrl;
  return 'https://www.confirmit-eg.com/api/brands/***/orders/';
}

export function isConfirmItEnabled(settings?: Partial<Settings> | null): boolean {
  if (!settings) return false;
  const cfg = settings.confirmItConfig;
  if (cfg?.isActive) {
    const resolved = resolveConfirmItTarget(cfg.storeKey || cfg.endpointUrl);
    if (resolved.valid) return true;
  }
  const platCfg = (settings as any).platformConfigs?.confirmit;
  if (platCfg?.isActive) {
    const resolved = resolveConfirmItTarget(platCfg.apiKey || platCfg.shopUrl || platCfg.shopId);
    if (resolved.valid) return true;
  }
  return false;
}

export function resolveConfirmItConfigFromSettings(settings?: Partial<Settings> | null) {
  const cfg = settings?.confirmItConfig;
  const plat = (settings as any)?.platformConfigs?.confirmit;
  const rawTarget = cfg?.storeKey || cfg?.endpointUrl || plat?.apiKey || plat?.shopUrl || plat?.shopId || '';
  const resolved = resolveConfirmItTarget(rawTarget);
  return {
    isActive: Boolean(cfg?.isActive || (plat?.isActive && !cfg)),
    autoSendOnNewOrder: cfg?.autoSendOnNewOrder !== false,
    sendOnlinePaidOrders: Boolean(cfg?.sendOnlinePaidOrders),
    includeShippingLines: cfg?.includeShippingLines !== false,
    resolved
  };
}

export function isOrderPaidOnlineForConfirmIt(order: Partial<Order>): boolean {
  const method = String(order.paymentMethod || '').toLowerCase();
  const explicitlyCod =
    method.includes('cod') ||
    method.includes('cash') ||
    method.includes('عند الاستلام') ||
    method.includes('كاش') ||
    method.includes('نقد');
  if (explicitlyCod) return false;

  const explicitlyOnline =
    method.includes('visa') ||
    method.includes('mastercard') ||
    method.includes('card') ||
    method.includes('paymob') ||
    method.includes('fawry') ||
    method.includes('instapay') ||
    method.includes('vodafone') ||
    method.includes('wallet') ||
    method.includes('moneyhash') ||
    method.includes('online') ||
    method.includes('أونلاين') ||
    method.includes('فيزا') ||
    method.includes('بطاق') ||
    method.includes('محفظ') ||
    method.includes('انستا') ||
    method.includes('إنستا') ||
    method.includes('فودافون') ||
    method.includes('فوري');

  if (explicitlyOnline) return true;
  if (order.paymentStatus === 'مدفوع' && !explicitlyCod && Boolean(method.trim())) {
    return true;
  }
  return false;
}

export interface ConfirmItBuildResult {
  ok: boolean;
  payload?: Record<string, any>;
  error?: string;
  provinceResolved?: ConfirmItProvince;
}

/**
 * Formats an internal store order into Confirm It's exact Order API payload schema.
 */
export function buildConfirmItOrderPayload(
  order: Partial<Order>,
  options?: { includeShippingLines?: boolean }
): ConfirmItBuildResult {
  const rawOrderNumber = String(order.orderNumber || order.id || '')
    .replace(/^#/, '')
    .trim();

  if (!rawOrderNumber) {
    return { ok: false, error: 'رقم الطلب (order_number) مفقود.' };
  }

  const phone = normalizeConfirmItPhone(order.customerPhone);
  if (!phone || !/^(\+?20)?0?1[0125]\d{8}$/.test(phone)) {
    return {
      ok: false,
      error: `رقم هاتف العميل (${order.customerPhone || 'فارغ'}) غير صالح لإرسال تأكيد مصري (01XXXXXXXXX).`
    };
  }

  const province = mapGovernorateToConfirmItProvince(
    order.governorate || order.shippingArea,
    order.city,
    order.customerCity,
    order.customerAddress
  );

  if (!province) {
    return {
      ok: false,
      error: `تعذر مطابقة المحافظة "${order.governorate || order.shippingArea || 'غير محدد'}" مع قائمة المحافظات المعتمدة لدى Confirm It.`
    };
  }

  const isPaidOnline = isOrderPaidOnlineForConfirmIt(order);
  const shippingFee = Math.max(0, Number(order.shippingFee) || 0);
  const computedTotal =
    order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
      ? Number(order.totalAmountOverride)
      : order.totalPrice !== undefined && order.totalPrice !== null
      ? Number(order.totalPrice)
      : (Number(order.productPrice) || 0) +
        shippingFee +
        (Number((order as any).tax) || 0) -
        (Number(order.discount) || 0);
  const safeTotal = Math.max(0, Number.isFinite(computedTotal) ? computedTotal : 0);

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const lineItems =
    rawItems.length > 0
      ? rawItems.map((item) => {
          const entry: Record<string, any> = {
            name: String(item.name || (item as any).productName || order.productName || 'منتج').trim(),
            quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
            price: Math.max(0, Number(item.price) || 0).toFixed(2),
          };
          if ((item as any).sku) {
            entry.sku = String((item as any).sku).trim();
          }
          const variantTitle =
            (item as any).variantTitle ||
            (item as any).variantName ||
            (item as any).variant ||
            '';
          if (variantTitle) {
            entry.variant_title = String(variantTitle).trim();
          }
          return entry;
        })
      : [
          {
            name: String(order.productName || 'طلب من المتجر').trim(),
            quantity: Math.max(1, Math.round(Number(order.shipmentQuantity) || 1)),
            price: Math.max(0, Number(order.productPrice) || safeTotal).toFixed(2),
          },
        ];

  const fullName = String(order.customerName || 'عميل').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'عميل';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-';

  const address1 =
    String(order.customerAddress || '').trim() ||
    String(order.city || order.customerCity || '').trim() ||
    province;

  const address2Parts = [
    order.buildingNumber ? `عمارة ${order.buildingNumber}` : '',
    order.floorNumber ? `دور ${order.floorNumber}` : '',
    order.apartmentNumber ? `شقة ${order.apartmentNumber}` : '',
  ].filter(Boolean);

  const cityArea = String(order.city || order.customerCity || '').trim();

  const shippingAddress: Record<string, any> = {
    first_name: firstName,
    last_name: lastName,
    phone,
    address1,
    province,
    country: 'EG',
  };

  if (address2Parts.length > 0) {
    shippingAddress.address2 = address2Parts.join(' - ');
  }
  if (cityArea && cityArea.toLowerCase() !== province.toLowerCase()) {
    shippingAddress.city = cityArea;
  }

  const customerObj: Record<string, any> = {};
  if (order.customerEmail && String(order.customerEmail).trim()) {
    customerObj.email = String(order.customerEmail).trim();
  }

  const payload: Record<string, any> = {
    order_number: rawOrderNumber,
    gateway: isPaidOnline ? String(order.paymentMethod || 'online').trim() : 'cash on delivery',
    financial_status: isPaidOnline ? 'paid' : 'pending',
    total_price: safeTotal.toFixed(2),
    customer: customerObj,
    line_items: lineItems,
    shipping_address: shippingAddress,
  };

  if (options?.includeShippingLines !== false) {
    payload.shipping_lines = [{ price: shippingFee.toFixed(2) }];
  }

  return { ok: true, payload, provinceResolved: province };
}
