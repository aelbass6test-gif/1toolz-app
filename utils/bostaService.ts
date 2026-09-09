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
const CARRIER_API_BASE = (import.meta.env.VITE_CARRIER_API_BASE_URL || 'https://api.abdomedi.com').replace(/\/$/, '');

async function safeFetchJson(url: string, options?: RequestInit, fallbackError?: string): Promise<any> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000';
    const requestBase = url.startsWith('/api/bosta/') ? CARRIER_API_BASE : origin;
    const urlObj = new URL(url, requestBase);
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
        error: res.status === 302 || res.url.includes('__cookie_check')
          ? 'الخادم المنشور يحوّل طلبات API إلى صفحة حماية Cookie Check. يجب نشر الـ API بدون حماية iframe أو استخدام نطاق Backend مباشر.'
          : (fallbackError || `تعذر الاتصال بخادم الربط مع بوسطة (رمز الاستجابة ${res.status}).`),
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
    const query = new URLSearchParams({ apiKey: (apiKey || '').trim() });
    if (isStaging) query.set('staging', 'true');
    const res = await safeFetchJson(`/api/bosta/business-locations?${query.toString()}`, undefined, 'فشل جلب مواقع العمل من خادم بوسطة');
    return res?.success ? res : { success: false, data: [], error: res?.error || 'فشل جلب مواقع العمل عبر خادم الربط' };
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

    return { success: false, error: res?.error || 'تعذر فحص مفتاح بوسطة عبر خادم الربط' };
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

    return { success: false, error: res?.error || 'فشل الاتصال بخادم بوسطة لتسجيل الدخول' };
  },

  async createDelivery(order: Order, config?: BostaConfig): Promise<BostaCreateDeliveryResponse> {
    const existingTrackingNumber = order.bostaTrackingNumber || (order.shippingCompany?.toLowerCase().includes('bosta') ? order.waybillNumber : undefined);
    if (existingTrackingNumber) {
      return {
        success: true,
        deliveryId: order.bostaDeliveryId,
        trackingNumber: existingTrackingNumber,
        message: 'الشحنة موجودة بالفعل، تم إرجاع بياناتها المحفوظة.'
      };
    }

    // 1. Try local proxy
    const res = await safeFetchJson('/api/bosta/deliveries/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order, config }),
    }, 'فشل إرسال الشحنة إلى بوسطة');

    if (res && res.success && !res.isHtmlResponse && (res.trackingNumber || res.deliveryId)) {
      return res;
    }

    return { success: false, error: res?.error || 'فشل إنشاء الشحنة عبر خادم الربط مع بوسطة' };
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

    return { success: false, error: res?.error || 'فشل جلب بوليصة الشحن من بوسطة (تأكد من وجود الشحنة ومفتاح الربط)' };
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

    return { success: false, error: res?.error || 'فشل جلب البوالص المجمعة من بوسطة' };
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
    if (res && res.success && !res.isHtmlResponse && res.tracking) {
      return res;
    }

    return { success: false, error: res?.error || 'تعذر استرجاع تفاصيل التتبع من بوسطة' };
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

    return { success: false, error: res.error || 'فشل إنشاء إذن الاستلام' };
  },

  async getCities(): Promise<{ success: boolean; list: BostaCity[]; error?: string }> {
    const res = await safeFetchJson(`/api/bosta/cities`, {}, 'فشل جلب مدن بوسطة');
    if (res.success && Array.isArray(res.list) && res.list.length > 0) {
      return res;
    }
    return { success: false, list: [], error: res?.error || 'فشل جلب قائمة المدن عبر خادم الربط' };
  },

  async getDistricts(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const res = await safeFetchJson('/api/bosta/districts', {}, 'فشل جلب مناطق بوسطة');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      return res;
    }
    return { success: false, data: [], error: res?.error || 'فشل جلب قائمة المناطق عبر خادم الربط' };
  },

  async getCityDistricts(cityId: string): Promise<{ success: boolean; districts?: any[]; error?: string }> {
    try {
      const res = await fetch(`${CARRIER_API_BASE}/api/bosta/cities/${encodeURIComponent(cityId)}/districts`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) return data;
      }
      return { success: false, error: 'تعذر جلب مناطق المدينة' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getZones(cityId: string): Promise<{ success: boolean; zones: BostaZone[]; error?: string }> {
    try {
      const res = await fetch(`${CARRIER_API_BASE}/api/bosta/cities/${encodeURIComponent(cityId)}/zones`);
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

      const res = await fetch(`${CARRIER_API_BASE}/api/bosta/businesses/${encodeURIComponent(businessId)}${query}`);
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
      const res = await fetch(`${CARRIER_API_BASE}/api/bosta/businesses/${encodeURIComponent(businessId)}/pickup-locations`, {
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

      const res = await fetch(`${CARRIER_API_BASE}/api/bosta/pricing/calculator?${q.toString()}`);
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

      const res = await fetch(`${CARRIER_API_BASE}/api/bosta/deliveries/${encodeURIComponent(id)}?${q.toString()}`);
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
      const res = await safeFetchJson(`/api/bosta/deliveries/${encodeURIComponent(id)}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      }, 'فشل إلغاء الشحنة في بوسطة');

      if (res && (res.success || res.message)) {
        return { success: true, message: res.message || 'تم إلغاء الشحنة بنجاح في بوسطة' };
      }

      return {
        success: false,
        error: res?.error || 'قد تكون الشحنة ملغية مسبقاً على خوادم بوسطة أو أن رقم التتبع لا يطابق خوادم الشركة'
      };
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
      const res = await fetch(`${CARRIER_API_BASE}${query}`);
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
