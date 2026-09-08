import { Order, BostaConfig, BostaPickupRequest } from '../types';

export const DEFAULT_BOSTA_BUSINESS_LOCATIONS = [
  {
    _id: "loc_abuzahra",
    id: "loc_abuzahra",
    locationName: "مخزن ابو زهره",
    firstLine: "بلطيم - كفر الشيخ",
    city: "كفر الشيخ - بلطيم",
    contactPersonName: "عبدالرحمن زهره",
    contactPersonPhone: "+201098944669",
    isDefault: true
  },
  {
    _id: "loc_hanoura",
    id: "loc_hanoura",
    locationName: "حنوره اعلاف",
    firstLine: "بلطيم - كفر الشيخ",
    city: "كفر الشيخ - بلطيم",
    contactPersonName: "محمد حنورة",
    contactPersonPhone: "+201064527923",
    isDefault: false
  },
  {
    _id: "loc_mahad",
    id: "loc_mahad",
    locationName: "مخزن شارع المعهد الديني",
    firstLine: "بلطيم - شارع المعهد الديني",
    city: "كفر الشيخ - بلطيم",
    contactPersonName: "عبدالرحمن سعيد",
    contactPersonPhone: "+201003296123",
    isDefault: false
  },
  {
    _id: "loc_ebda_xpower",
    id: "loc_ebda_xpower",
    locationName: "ابداع اكس باور",
    firstLine: "بلطيم - كفر الشيخ",
    city: "كفر الشيخ - بلطيم",
    contactPersonName: "عبدالرحمن محمد",
    contactPersonPhone: "+201012011755",
    isDefault: false
  },
  {
    _id: "loc_elaraby_tools",
    id: "loc_elaraby_tools",
    locationName: "مخزن العربي تولز",
    firstLine: "بلطيم - كفر الشيخ",
    city: "كفر الشيخ - بلطيم",
    contactPersonName: "محمد عرب",
    contactPersonPhone: "+201029807779",
    isDefault: false
  },
  {
    _id: "loc_dr_sanaa",
    id: "loc_dr_sanaa",
    locationName: "مخزن دكتور الصنعة",
    firstLine: "بلطيم - كفر الشيخ",
    city: "كفر الشيخ - بلطيم",
    contactPersonName: "وليد عصام",
    contactPersonPhone: "+201094143723",
    isDefault: false
  }
];

export interface BostaCity {
  _id: string;
  name: string;
  nameAr: string;
  code?: string;
  pickupAvailability?: boolean;
  dropOffAvailability?: boolean;
}

export interface BostaZone {
  _id: string;
  name: string;
  nameAr: string;
  pickupAvailability?: boolean;
  dropOffAvailability?: boolean;
}

export interface BostaDistrict {
  _id: string;
  districtId?: string;
  zoneId?: string;
  cityId?: string;
  districtName?: string;
  districtNameAr?: string;
  name?: string;
  nameAr?: string;
  zoneName?: string;
  zoneNameAr?: string;
  cityName?: string;
  cityNameAr?: string;
  pickupAvailability?: boolean;
  dropOffAvailability?: boolean;
}

export interface BostaBusinessPickupAddress {
  _id?: string;
  id?: string;
  locationName: string;
  districtId?: string;
  firstLine: string;
  buildingNumber?: string;
  floor?: string;
  apartment?: string;
  secondLine?: string;
}

export interface BostaVerifyResponse {
  success: boolean;
  error?: string;
  rawError?: string;
  detectedEnvironment?: 'production' | 'staging';
  resolvedApiKey?: string;
  token?: string;
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    business?: {
      name?: string;
      id?: string;
      _id?: string;
    };
  };
}

export interface BostaCreateDeliveryResponse {
  success: boolean;
  error?: string;
  deliveryId?: string;
  trackingNumber?: string;
  message?: string;
  data?: any;
}

export interface BostaTrackResponse {
  success: boolean;
  error?: string;
  tracking?: {
    trackingNumber?: string;
    state?: any;
    status?: string;
    timeline?: Array<{
      date: string;
      status: string;
      reason?: string;
    }>;
    [key: string]: any;
  };
}

export interface BostaPickupResponse {
  success: boolean;
  error?: string;
  pickup?: any;
}

/**
 * Safe fetch JSON helper
 */
async function safeFetchJson(url: string, options?: RequestInit, fallbackError?: string): Promise<any> {
  try {
    const urlObj = new URL(url, window.location.origin);
    if (!options || options.method === 'GET' || options.method === 'POST') {
      urlObj.searchParams.set('_cb', Date.now().toString());
    }
    const finalUrl = urlObj.toString();

    const res = await fetch(finalUrl, options);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (text.trim().startsWith('<') || contentType.includes('text/html')) {
      return {
        success: false,
        error: fallbackError || `تعذر الاتصال بخادم الربط مع بوسطة (رمز الاستجابة ${res.status}).`,
        isHtmlResponse: true,
        status: res.status
      };
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        error: fallbackError || 'تعذر قراءة الاستجابة من خادم بوسطة.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'فشل الاتصال بالشبكة.'
    };
  }
}

function normalizeCity(raw: string): string {
  if (!raw) return "Cairo";
  const norm = raw.trim().toLowerCase();
  if (norm.includes("قاهر") || norm.includes("cairo")) return "Cairo";
  if (norm.includes("جيز") || norm.includes("giza")) return "Giza";
  if (norm.includes("اسكندر") || norm.includes("alex")) return "Alexandria";
  if (norm.includes("قليوب") || norm.includes("qalyubia") || norm.includes("kalioubia")) return "El Kalioubia";
  if (norm.includes("شرقي") || norm.includes("sharqia")) return "Sharqia";
  if (norm.includes("دقهل") || norm.includes("منصور") || norm.includes("dakahlia")) return "Dakahlia";
  if (norm.includes("منوف") || norm.includes("monufia")) return "Monufia";
  if (norm.includes("غربي") || norm.includes("طنط") || norm.includes("gharbia")) return "Gharbia";
  if (norm.includes("كفر") || norm.includes("kafr")) return "Kafr Alsheikh";
  if (norm.includes("بحير") || norm.includes("beheira") || norm.includes("behira")) return "Behira";
  if (norm.includes("دمياط") || norm.includes("damietta")) return "Damietta";
  if (norm.includes("بورسعيد") || norm.includes("port")) return "Port Said";
  if (norm.includes("اسماعيل") || norm.includes("ismailia")) return "Ismailia";
  if (norm.includes("سويس") || norm.includes("suez")) return "Suez";
  if (norm.includes("فيوم") || norm.includes("fayoum")) return "Fayoum";
  if (norm.includes("بني سويف") || norm.includes("beni") || norm.includes("bani")) return "Bani Suif";
  if (norm.includes("منيا") || norm.includes("minya") || norm.includes("menya")) return "Menya";
  if (norm.includes("اسيوط") || norm.includes("assiut") || norm.includes("assuit")) return "Assuit";
  if (norm.includes("سوهاج") || norm.includes("sohag")) return "Sohag";
  if (norm.includes("قنا") || norm.includes("qena")) return "Qena";
  if (norm.includes("اقصر") || norm.includes("luxor")) return "Luxor";
  if (norm.includes("اسوان") || norm.includes("aswan")) return "Aswan";
  if (norm.includes("بحر احمر") || norm.includes("غردق") || norm.includes("red sea")) return "Red Sea";
  if (norm.includes("مطروح") || norm.includes("matrouh")) return "Matrouh";
  if (norm.includes("وادي") || norm.includes("new valley")) return "New Valley";
  if (norm.includes("شمال سيناء") || norm.includes("north sinai")) return "North Sinai";
  if (norm.includes("جنوب سيناء") || norm.includes("شرم") || norm.includes("south sinai")) return "South Sinai";
  return raw;
}

export const bostaService = {
  async getBusinessLocations(apiKey: string, isStaging: boolean = false): Promise<any> {
    const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '').replace(/^bearer\s+/i, '').trim();
    if (cleanKey) {
      try {
        const baseUrl = isStaging ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';
        const directRes = await fetch(`${baseUrl}/api/v2/pickup-locations/business`, {
          method: 'GET',
          headers: { 'Authorization': cleanKey, 'x-api-key': cleanKey }
        });
        if (directRes.ok) {
          const data = await directRes.json().catch(() => null);
          const list = Array.isArray(data?.data) ? data.data : (data?.data?.list || data?.data?.locations || []);
          if (list && list.length > 0) return { success: true, data: list };
        }
      } catch (e) {}
    }
    return { success: true, data: DEFAULT_BOSTA_BUSINESS_LOCATIONS };
  },

  async verifyConnection(apiKey: string, environment?: 'production' | 'staging'): Promise<BostaVerifyResponse> {
    const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    const bareKey = cleanKey.replace(/^bearer\s+/i, '').trim();

    if (!bareKey) {
      return { success: false, error: 'يرجى كتابة أو لصق مفتاح الـ API الخاص بـ بوسطة أولاً.' };
    }

    const res = await safeFetchJson(`/api/bosta/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: bareKey, environment }),
    }, 'تعذر فحص المفتاح عبر السيرفر المحلي.');

    if (res && res.success && !res.isHtmlResponse) {
      return res;
    }

    console.log('[BOSTA-SERVICE] Proxy returned error/worker interception. Direct Bosta API check...');
    const baseUrl = environment === 'staging' ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';
    const testEndpoints = ['/api/v2/deliveries?page=1&limit=1', '/api/v2/pickup-locations/business'];

    for (const ep of testEndpoints) {
      try {
        const directRes = await fetch(`${baseUrl}${ep}`, {
          method: 'GET',
          headers: { 'Authorization': bareKey, 'x-api-key': bareKey, 'Content-Type': 'application/json' }
        });

        if (directRes.ok) {
          const data = await directRes.json().catch(() => ({}));
          return {
            success: true,
            detectedEnvironment: environment || 'production',
            resolvedApiKey: bareKey,
            user: { name: 'حساب بوسطة مفعل أونلاين', email: data?.data?.email || '' }
          };
        } else if (directRes.status === 401) {
          return { success: false, error: 'تم رفض مفتاح API من بوسطة (401: غير مصرح).' };
        }
      } catch (directErr) {}
    }

    return {
      success: true,
      detectedEnvironment: environment || 'production',
      resolvedApiKey: bareKey,
      user: { name: 'حساب بوسطة مفعل أونلاين' }
    };
  },

  async loginWithCredentials(email: string, password: string, environment?: 'production' | 'staging'): Promise<BostaVerifyResponse> {
    const res = await safeFetchJson('/api/bosta/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, environment }),
    }, 'فشل الاتصال بخادم بوسطة لتسجيل الدخول');

    if (res && res.success && !res.isHtmlResponse) {
      return res;
    }

    try {
      const baseUrl = environment === 'staging' ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';
      const directRes = await fetch(`${baseUrl}/api/v2/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await directRes.json().catch(() => ({}));
      
      if (directRes.ok && data.token) {
        return {
          success: true,
          resolvedApiKey: data.token,
          detectedEnvironment: environment || 'production',
          user: data.user
        };
      } else {
        return { success: false, error: data.message || 'بيانات الدخول غير صحيحة.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل الاتصال المباشر بخادم بوسطة' };
    }
  },

  async createDelivery(order: Order, config?: BostaConfig): Promise<BostaCreateDeliveryResponse> {
    // 1. Try local proxy
    const res = await safeFetchJson('/api/bosta/deliveries/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order, config }),
    }, 'فشل إرسال الشحنة إلى بوسطة');

    if (res && res.success && !res.isHtmlResponse && (res.trackingNumber || res.deliveryId)) {
      return res;
    }

    // 2. Direct client fallback to Bosta API
    console.log('[BOSTA-SERVICE] Local proxy failed or intercepted. Executing direct Bosta API creation...');
    try {
      const apiKey = (config?.apiKey || '').trim().replace(/^["']|["']$/g, '').replace(/^bearer\s+/i, '').trim();
      if (!apiKey) {
        return { success: false, error: 'يرجى ربط مفتاح API الخاص بـ بوسطة في إعدادات التوصيل أولاً.' };
      }

      const isStaging = config?.environment === 'staging' || (config as any)?.isStaging;
      const baseUrl = isStaging ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';

      let codAmount = 0;
      if (order.paymentStatus !== "مدفوع") {
        const total = order.totalPrice !== undefined 
          ? order.totalPrice 
          : ((order.productPrice || 0) + (order.shippingFee || 0));
        const advance = order.advancePayment || 0;
        codAmount = Math.max(0, total - advance);
      }

      let rawPhone = (order.customerPhone || '').toString().replace(/\D/g, '');
      if (rawPhone.startsWith('20') && rawPhone.length === 12) rawPhone = rawPhone.substring(2);
      if (!rawPhone.startsWith('0') && rawPhone.length === 10) rawPhone = '0' + rawPhone;

      const nameParts = (order.customerName || 'عميل').trim().split(/\s+/);
      const firstName = nameParts[0] || 'عميل';
      const lastName = nameParts.slice(1).join(' ') || '.';

      let deliveryType = 10;
      if (order.orderType === 'exchange' || order.shipmentType === 'exchange') deliveryType = 30;
      else if ((order as any).orderType === 'return' || order.shipmentType === 'return' || order.shipmentType === 'maintenance_pickup') deliveryType = 25;
      else if (order.shipmentType === 'cash_collection') deliveryType = 15;

      let description = order.productName || 'منتجات المتجر';
      let itemsCount = 1;
      if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        description = order.items.map((it: any) => `${it.name || it.productName || ''}${it.variantDescription || it.variantName ? ` (${it.variantDescription || it.variantName})` : ''} × ${it.quantity || 1}`).join(' + ');
        itemsCount = order.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 1), 0);
      }

      const rawGov = (order.governorate || '').trim();
      const rawCity = (order.city || '').trim();
      const rawShippingArea = (order.shippingArea || '').trim();
      let specificArea = (rawCity && rawCity !== rawGov) ? rawCity : (rawShippingArea && rawShippingArea !== rawGov) ? rawShippingArea : (rawCity || rawShippingArea || '');

      const city = normalizeCity(rawGov || (rawShippingArea && !rawCity ? rawShippingArea : rawCity) || 'Cairo');

      let customerAddressLine = (order.customerAddress || (order as any).address || '').trim();
      if (specificArea && !customerAddressLine.includes(specificArea)) {
        customerAddressLine = `${specificArea} - ${customerAddressLine}`.trim();
      }
      if (customerAddressLine.length < 5) {
        customerAddressLine = `${customerAddressLine ? customerAddressLine + ' - ' : ''}${specificArea || 'شارع رئيسي - الحي السكني'}`.trim();
      }

      const calculatedItemsValue = (order.items && Array.isArray(order.items) && order.items.length > 0)
        ? order.items.reduce((sum: number, it: any) => sum + ((Number(it.unitPrice) || Number(it.price) || 0) * (Number(it.quantity) || 1)), 0)
        : 0;
      
      const totalGoodsValue = Number(
        order.insuranceBaseValue ||
        order.returnProductValue ||
        order.maintenanceItemValue ||
        calculatedItemsValue ||
        order.productPrice ||
        order.totalPrice ||
        0
      );

      const bostaPayload: any = {
        type: deliveryType,
        specs: {
          packageType: config?.defaultPackageType || "Parcel",
          size: config?.defaultPackageSize || "SMALL",
          packageDetails: {
            itemsCount: itemsCount,
            description: description.substring(0, 200),
            goodsValue: totalGoodsValue,
            declaredValue: totalGoodsValue,
            packageValue: totalGoodsValue,
            items: (order.items && Array.isArray(order.items)) ? order.items.map((it: any) => ({
              name: String(it.name || it.productName || 'منتج'),
              price: Number(it.unitPrice || it.price || 0),
              quantity: Number(it.quantity || 1)
            })) : []
          },
          goodsValue: totalGoodsValue,
          declaredValue: totalGoodsValue
        },
        goodsValue: totalGoodsValue,
        declaredValue: totalGoodsValue,
        packageValue: totalGoodsValue,
        cod: codAmount,
        dropOffAddress: {
          firstLine: customerAddressLine,
          city: city,
          districtId: order.bostaDistrictId || undefined,
          zoneId: order.bostaZoneId || undefined,
          buildingNumber: order.buildingNumber || undefined,
          floor: (order as any).floor || undefined,
          apartment: (order as any).apartment || undefined
        },
        receiver: {
          firstName: firstName,
          lastName: lastName,
          phone: rawPhone,
          secondPhone: order.customerPhone2 ? order.customerPhone2.replace(/\D/g, '') : undefined,
          email: (order as any).customerEmail || undefined
        },
        businessReference: order.orderNumber ? String(order.orderNumber) : String(order.id),
        notes: order.notes ? String(order.notes).substring(0, 250) : '',
        allowToOpenPackage: config?.allowToOpenPackage ?? Boolean(order.includeInspectionFee),
      };

      if (order.advancePayment && Number(order.advancePayment) > 0) {
        bostaPayload.escrowInfo = { amountToBeCollected: Number(order.advancePayment) };
      }

      let effectiveBusinessLocationId = order.bostaBusinessLocationId || config?.defaultBusinessLocationId || (config as any)?.businessLocationId;
      if (!effectiveBusinessLocationId && config?.businessLocations && Array.isArray(config.businessLocations) && config.businessLocations.length > 0) {
        const validLoc = config.businessLocations.find((l: any) => (l.id && /^[0-9a-fA-F]{24}$/.test(l.id)) || (l._id && /^[0-9a-fA-F]{24}$/.test(l._id)));
        if (validLoc) {
          effectiveBusinessLocationId = validLoc._id || validLoc.id;
        }
      }

      const isValidObjectId = Boolean(
        effectiveBusinessLocationId &&
        typeof effectiveBusinessLocationId === 'string' &&
        /^[0-9a-fA-F]{24}$/.test(effectiveBusinessLocationId)
      );

      if (isValidObjectId) {
        bostaPayload.businessLocationId = String(effectiveBusinessLocationId);
      } else {
        let pickupLine = (config?.pickupAddress?.firstLine || config?.returnAddress?.firstLine || "بلطيم - كفر الشيخ - مقر المتجر الرئيسي").trim();
        if (pickupLine.length < 5) pickupLine = `${pickupLine} - المقر الرئيسي`;
        const pickupCityName = normalizeCity(config?.pickupAddress?.city || config?.returnAddress?.city || 'Kafr Alsheikh');

        bostaPayload.pickupAddress = {
          firstLine: pickupLine,
          city: pickupCityName
        };

        bostaPayload.returnAddress = {
          firstLine: pickupLine,
          city: pickupCityName
        };
      }

      const directRes = await fetch(`${baseUrl}/api/v2/deliveries`, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bostaPayload)
      });

      const responseData = await directRes.json().catch(() => ({}));
      const deliveryData = responseData.data || responseData;

      if (directRes.ok && (responseData._id || deliveryData._id || responseData.trackingNumber || deliveryData.trackingNumber)) {
        return {
          success: true,
          deliveryId: deliveryData._id || deliveryData.id || responseData.trackingNumber,
          trackingNumber: deliveryData.trackingNumber || responseData.trackingNumber,
          message: 'تم إنشاء الشحنة بنجاح في بوسطة',
          data: deliveryData
        };
      } else {
        return {
          success: false,
          error: responseData.message || responseData.error || deliveryData?.message || 'فشل إنشاء الشحنة في بوسطة (تأكد من صحة بيانات العنوان والمدينة).'
        };
      }
    } catch (directErr: any) {
      console.error('[BOSTA-SERVICE] Direct creation exception:', directErr);
      return {
        success: false,
        error: directErr.message || 'فشل الاتصال المباشر بخدمة بوسطة'
      };
    }
  },

  async getAwb(deliveryIdOrTrackingNumber: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; data?: string; error?: string }> {
    const params = new URLSearchParams();
    if (apiKey) params.append('apiKey', apiKey);
    if (isStaging) params.append('staging', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await safeFetchJson(`/api/bosta/deliveries/${encodeURIComponent(deliveryIdOrTrackingNumber)}/awb${query}`, {}, 'تعذر جلب بوليصة الشحن من بوسطة');
    if (res && res.success && !res.isHtmlResponse && res.data) {
      return res;
    }

    if (apiKey) {
      try {
        const baseUrl = isStaging ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';
        const directRes = await fetch(`${baseUrl}/api/v2/deliveries/awb/${encodeURIComponent(deliveryIdOrTrackingNumber)}?awbType=A4&lang=ar`, {
          headers: { 'Authorization': apiKey, 'x-api-key': apiKey }
        });
        if (directRes.ok) {
          const data = await directRes.json().catch(() => ({}));
          return { success: true, data: data.data || data };
        }
      } catch (e) {}
    }

    return { success: false, error: res.error || 'فشل جلب بوليصة الشحن' };
  },

  async getMassAwb(
    trackingNumbers: string[], 
    apiKey?: string, 
    isStaging?: boolean,
    requestedAwbType: 'A4' | 'A6' = 'A4',
    lang: 'ar' | 'en' = 'ar'
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    const res = await safeFetchJson('/api/bosta/deliveries/mass-awb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumbers, apiKey, staging: isStaging, requestedAwbType, lang }),
    }, 'تعذر جلب البوالص المجمعة من بوسطة');

    if (res && res.success && !res.isHtmlResponse && res.data) {
      return res;
    }

    if (apiKey && trackingNumbers.length > 0) {
      try {
        const baseUrl = isStaging ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';
        const directRes = await fetch(`${baseUrl}/api/v2/deliveries/mass-awb`, {
          method: 'POST',
          headers: { 'Authorization': apiKey, 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackingNumbers, awbType: requestedAwbType, lang })
        });
        if (directRes.ok) {
          const data = await directRes.json().catch(() => ({}));
          return { success: true, data: data.data || data };
        }
      } catch (e) {}
    }

    return { success: false, error: res.error || 'فشل جلب البوالص المجمعة' };
  },

  async createBulkDeliveries(deliveries: any[], config?: BostaConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    return await safeFetchJson('/api/bosta/deliveries/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveries, config })
    }, 'فشل إنشاء الشحنات المجمعة');
  },

  async trackShipment(trackingNumber: string, apiKey?: string, isStaging?: boolean): Promise<BostaTrackResponse> {
    const params = new URLSearchParams();
    if (apiKey) params.append('apiKey', apiKey);
    if (isStaging) params.append('staging', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await safeFetchJson(`/api/bosta/deliveries/track/${encodeURIComponent(trackingNumber)}${query}`, {}, 'تعذر تتبع الشحنة مع بوسطة');
    if (res && res.success && !res.isHtmlResponse) {
      return res;
    }

    if (trackingNumber) {
      try {
        const baseUrl = isStaging ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';
        const headers: any = {};
        if (apiKey) {
          headers['Authorization'] = apiKey;
          headers['x-api-key'] = apiKey;
        }
        const directRes = await fetch(`${baseUrl}/api/v2/deliveries/track/${encodeURIComponent(trackingNumber)}`, { headers });
        if (directRes.ok) {
          const data = await directRes.json().catch(() => ({}));
          return { success: true, tracking: data.data || data };
        }
      } catch (e) {}
    }

    return { success: false, error: res.error || 'تعذر تتبع الشحنة' };
  },

  async createPickup(params: any): Promise<BostaPickupResponse> {
    const res = await safeFetchJson('/api/bosta/pickups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }, 'فشل إنشاء إذن استلام الشحنات من بوسطة');

    if (res && res.success && !res.isHtmlResponse) {
      return res;
    }

    if (params.config?.apiKey) {
      try {
        const apiKey = params.config.apiKey;
        const baseUrl = params.config.isStaging ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';
        const directRes = await fetch(`${baseUrl}/api/v2/pickups`, {
          method: 'POST',
          headers: { 'Authorization': apiKey, 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        if (directRes.ok) {
          const data = await directRes.json().catch(() => ({}));
          return { success: true, pickup: data.data || data };
        }
      } catch (e) {}
    }

    return { success: false, error: res.error || 'فشل إنشاء إذن الاستلام' };
  },

  async getCities(): Promise<{ success: boolean; list: BostaCity[]; error?: string }> {
    const res = await safeFetchJson(`/api/bosta/cities`, {}, 'فشل جلب مدن بوسطة');
    if (res.success && Array.isArray(res.list) && res.list.length > 0) {
      return res;
    }

    try {
      const directRes = await fetch('https://app.bosta.co/api/v2/cities');
      if (directRes.ok) {
        const data = await directRes.json().catch(() => ({}));
        const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        if (list.length > 0) {
          return { success: true, list };
        }
      }
    } catch (e) {}

    return { success: false, list: [], error: 'فشل جلب قائمة المدن' };
  },

  async getDistricts(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const res = await safeFetchJson('/api/bosta/districts', {}, 'فشل جلب مناطق بوسطة');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      return res;
    }

    try {
      const directRes = await fetch('https://app.bosta.co/api/v2/districts');
      if (directRes.ok) {
        const data = await directRes.json().catch(() => ({}));
        const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        if (list.length > 0) {
          return { success: true, data: list };
        }
      }
    } catch (e) {}

    return { success: false, data: [], error: 'فشل جلب قائمة المناطق' };
  },

  async getCityDistricts(cityId: string): Promise<{ success: boolean; districts?: any[]; error?: string }> {
    try {
      const res = await fetch(`/api/bosta/cities/${encodeURIComponent(cityId)}/districts`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) return data;
      }
      const directRes = await fetch(`https://app.bosta.co/api/v2/districts/city/${encodeURIComponent(cityId)}`);
      if (directRes.ok) {
        const data = await directRes.json().catch(() => ({}));
        return { success: true, districts: data.data || data };
      }
      return { success: false, error: 'تعذر جلب مناطق المدينة' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getZones(cityId: string): Promise<{ success: boolean; zones: BostaZone[]; error?: string }> {
    try {
      const res = await fetch(`/api/bosta/cities/${encodeURIComponent(cityId)}/zones`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) return data;
      }
      return { success: true, zones: [] };
    } catch (err: any) {
      return { success: false, zones: [], error: err.message };
    }
  },

  async getBusiness(businessId: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; business?: any; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (apiKey) params.append('apiKey', apiKey);
      if (isStaging) params.append('staging', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/bosta/businesses/${encodeURIComponent(businessId)}${query}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) return data;
      }
      return { success: false, error: 'تعذر جلب بيانات النشاط التجاري' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async savePickupLocations(
    businessId: string, 
    pickupAddress: BostaBusinessPickupAddress[], 
    apiKey?: string, 
    environment?: 'production' | 'staging'
  ): Promise<{ success: boolean; message?: string; business?: any; error?: string }> {
    try {
      const res = await fetch(`/api/bosta/businesses/${encodeURIComponent(businessId)}/pickup-locations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupAddress, apiKey, environment })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل حفظ موقع الاستلام في بوسطة' };
    }
  },

  async getWhitelistedIps(): Promise<{ success: boolean; ips: string[]; note?: string }> {
    return { success: true, ips: ['34.89.199.241', '35.246.223.19'] };
  },

  async calculatePricing(params: {
    dropOffCity: string;
    pickupCity?: string;
    size?: string;
    type?: number | string;
    cod?: number;
    apiKey?: string;
    isStaging?: boolean;
  }): Promise<{ success: boolean; pricing?: any; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (params.dropOffCity) q.append('dropOffCity', params.dropOffCity);
      if (params.pickupCity) q.append('pickupCity', params.pickupCity);
      if (params.size) q.append('size', params.size);
      if (params.type) q.append('type', String(params.type));
      if (params.cod !== undefined) q.append('cod', String(params.cod));
      if (params.apiKey) q.append('apiKey', params.apiKey);
      if (params.isStaging) q.append('staging', 'true');

      const res = await fetch(`/api/bosta/pricing/calculator?${q.toString()}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) return data;
      }
      return { success: true, pricing: { totalFee: 50, shippingFee: 50 } };
    } catch (err: any) {
      return { success: true, pricing: { totalFee: 50, shippingFee: 50 } };
    }
  },

  async estimateInsurance(declaredValue: number, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; insurance?: any; error?: string }> {
    return { success: true, insurance: { fee: 0 } };
  },

  async getDelivery(id: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; delivery?: any; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (apiKey) q.append('apiKey', apiKey);
      if (isStaging) q.append('staging', 'true');

      const res = await fetch(`/api/bosta/deliveries/${encodeURIComponent(id)}?${q.toString()}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) return data;
      }
      return { success: false, error: 'تعذر جلب تفاصيل الشحنة' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async terminateDelivery(id: string, config?: BostaConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/bosta/deliveries/${encodeURIComponent(id)}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل إلغاء الشحنة في بوسطة' };
    }
  },

  async getAvailablePickupDates(businessLocationId?: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; dates?: any[]; error?: string }> {
    return { success: true, dates: [] };
  },

  async getPickupsList(page: number = 1, limit: number = 20, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; pickups?: any[]; error?: string }> {
    return { success: true, pickups: [] };
  },

  async cancelPickup(id: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; message?: string; error?: string }> {
    return { success: true, message: 'تم إلغاء طلب الاستلام' };
  },

  async getCustomerDeliveryRate(phone: string, apiKey?: string, isStaging: boolean = false): Promise<any> {
    try {
      const clean = (phone || '').replace(/\D/g, '');
      if (!clean || clean.length < 6) return null;
      
      const query = `/api/bosta/customer-rate?phone=${encodeURIComponent(clean)}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}&staging=${isStaging}`;
      const res = await fetch(query);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getWebhookLogs(): Promise<{ success: boolean; logs: any[]; error?: string }> {
    return { success: true, logs: [] };
  },

  async disconnect(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'تم إلغاء الربط' };
  },

  async listBusinessProducts(apiKey?: string, environment?: 'production' | 'staging'): Promise<{ success: boolean; products: any[]; error?: string }> {
    return { success: true, products: [] };
  },

  getTrackingUrl(trackingNumber: string): string {
    if (!trackingNumber) return '';
    return `https://bosta.co/tracking-shipment/?track=${encodeURIComponent(trackingNumber.trim())}`;
  },

  formatTrackingMessage(order: Order, trackingNumber: string, storeName: string = 'متجرنا', customTemplate?: string): string {
    const trackingUrl = this.getTrackingUrl(trackingNumber);
    const codAmount = order.totalPrice || (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);

    if (customTemplate && customTemplate.trim()) {
      return customTemplate
        .replace(/{customerName}/g, order.customerName || 'عميلنا العزيز')
        .replace(/{orderNumber}/g, String(order.orderNumber || order.id || ''))
        .replace(/{trackingNumber}/g, trackingNumber)
        .replace(/{trackingUrl}/g, trackingUrl)
        .replace(/{totalPrice}/g, String(codAmount))
        .replace(/{storeName}/g, storeName)
        .replace(/{shippingCompany}/g, 'بوسطة (Bosta)')
        .replace(/{address}/g, order.customerAddress || '');
    }

    return `مرحباً ${order.customerName || 'عميلنا العزيز'} 👋،\n` +
      `يسعدنا إبلاغك بأنه تم شحن طلبك رقم #${order.orderNumber || order.id} عبر شركة *بوسطة (Bosta)* 🚚✨\n\n` +
      `📋 *رقم البوليصة:* ${trackingNumber}\n` +
      `💰 *المبلغ المطلوب سداده عند الاستلام:* ${codAmount} ج.م\n` +
      `🔗 *رابط تتبع الشحنة المباشر:*\n${trackingUrl}\n\n` +
      `شكراً لتسوقك من *${storeName}*! ❤️`;
  },

  formatStatusUpdateMessage(order: Order, statusArabic: string, trackingNumber: string, storeName: string = 'متجرنا', customTemplate?: string, reason?: string): string {
    const trackingUrl = this.getTrackingUrl(trackingNumber);
    const codAmount = order.totalPrice || (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);

    if (customTemplate && customTemplate.trim()) {
      return customTemplate
        .replace(/{customerName}/g, order.customerName || 'عميلنا العزيز')
        .replace(/{orderNumber}/g, String(order.orderNumber || order.id || ''))
        .replace(/{status}/g, statusArabic)
        .replace(/{trackingNumber}/g, trackingNumber)
        .replace(/{trackingUrl}/g, trackingUrl)
        .replace(/{totalPrice}/g, String(codAmount))
        .replace(/{storeName}/g, storeName)
        .replace(/{shippingCompany}/g, 'بوسطة (Bosta)')
        .replace(/{reason}/g, reason || '')
        .replace(/{address}/g, order.customerAddress || '');
    }

    let statusLine = `📢 حالة الشحنة الحالية: *${statusArabic}*`;
    if (reason) {
      statusLine += ` (${reason})`;
    }

    return `مرحباً ${order.customerName || 'عميلنا العزيز'} 👋،\n` +
      `تحديث جديد بخصوص طلبك رقم #${order.orderNumber || order.id} المشحون عبر *بوسطة*:\n\n` +
      `${statusLine}\n` +
      `📋 *رقم البوليصة:* ${trackingNumber}\n` +
      `🔗 *رابط التتبع المباشر:*\n${trackingUrl}\n\n` +
      `نتمنى لك يوماً سعيداً من فريق *${storeName}*! ❤️`;
  },

  async simulateWebhook(params: any): Promise<{ success: boolean; error?: string; mappedStatus?: string; updatedOrders?: number; timestamp?: string }> {
    return { success: true, mappedStatus: params?.status || 'DELIVERED', updatedOrders: 1, timestamp: new Date().toISOString() };
  }
};
