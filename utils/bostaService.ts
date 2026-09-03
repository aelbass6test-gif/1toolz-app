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
  districtName: string;
  districtNameAr?: string;
  zoneName?: string;
  zoneNameAr?: string;
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
 * Re-architected Bosta Service Layer
 * Compliant with Bosta API v2 (https://docs.bosta.co/api#/)
 */
export const bostaService = {
  /**
   * Verify API Key with Bosta Official Endpoint (/api/v2/users/me)
   */

  async getBusinessLocations(apiKey: string, isStaging: boolean = false): Promise<any> {
    try {
      const response = await fetch(`/api/bosta/business-locations?apiKey=${encodeURIComponent(apiKey)}&staging=${isStaging}`);
      if (!response.ok) {
        return { success: true, data: DEFAULT_BOSTA_BUSINESS_LOCATIONS };
      }
      const data = await response.json();
      const list = Array.isArray(data?.data) ? data.data : (data?.data?.list || data?.data?.locations || []);
      if (list && list.length > 0) {
        return { success: true, data: list };
      }
      return { success: true, data: DEFAULT_BOSTA_BUSINESS_LOCATIONS };
    } catch (error: any) {
      return { success: true, data: DEFAULT_BOSTA_BUSINESS_LOCATIONS };
    }
  },

  async verifyConnection(apiKey: string, environment?: 'production' | 'staging'): Promise<BostaVerifyResponse> {
    try {
      const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
      const res = await fetch('/api/bosta/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          apiKey: cleanKey,
          environment 
        }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'فشل الاتصال بخادم الربط مع بوسطة',
      };
    }
  },

  /**
   * Direct Login with Bosta Account (Email & Password)
   */
  async loginWithCredentials(email: string, password: string, environment?: 'production' | 'staging'): Promise<BostaVerifyResponse> {
    try {
      const res = await fetch('/api/bosta/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim(),
          password,
          environment 
        }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'فشل الاتصال بخادم بوسطة لتسجيل الدخول',
      };
    }
  },

  /**
   * Create Delivery / Shipment on Bosta
   */
  async createDelivery(order: Order, config?: BostaConfig): Promise<BostaCreateDeliveryResponse> {
    try {
      const res = await fetch('/api/bosta/deliveries/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order, config }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'فشل إرسال الشحنة إلى بوسطة',
      };
    }
  },

  /**
   * Fetch Air Waybill (AWB) for printing (Base64 PDF)
   */
  async getAwb(deliveryIdOrTrackingNumber: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (apiKey) params.append('apiKey', apiKey);
      if (isStaging) params.append('staging', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/bosta/deliveries/${encodeURIComponent(deliveryIdOrTrackingNumber)}/awb${query}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'تعذر جلب بوليصة الشحن من بوسطة',
      };
    }
  },

  /**
   * Fetch Mass AWB for multiple deliveries (Supports A4 standard & A6 Zebra thermal labels, ar/en)
   */
  async getMassAwb(
    trackingNumbers: string[], 
    apiKey?: string, 
    isStaging?: boolean,
    requestedAwbType: 'A4' | 'A6' = 'A4',
    lang: 'ar' | 'en' = 'ar'
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const res = await fetch('/api/bosta/deliveries/mass-awb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackingNumbers,
          apiKey,
          staging: isStaging,
          requestedAwbType,
          lang
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'تعذر جلب البوالص المجمعة من بوسطة',
      };
    }
  },

  /**
   * Create Bulk Deliveries (docs.bosta.co/docs/how-to/create-your-first-delivery)
   */
  async createBulkDeliveries(deliveries: any[], config?: BostaConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch('/api/bosta/deliveries/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveries, config })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل إنشاء الشحنات المجمعة' };
    }
  },

  /**
   * Track shipment in real-time
   */
  async trackShipment(trackingNumber: string, apiKey?: string, isStaging?: boolean): Promise<BostaTrackResponse> {
    try {
      const params = new URLSearchParams();
      if (apiKey) params.append('apiKey', apiKey);
      if (isStaging) params.append('staging', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/bosta/deliveries/track/${encodeURIComponent(trackingNumber)}${query}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'تعذر تتبع الشحنة مع بوسطة',
      };
    }
  },

  /**
   * Create a pickup request for orders (docs.bosta.co/docs/how-to/create-your-first-pickup)
   */
  async createPickup(params: {
    scheduledDate: string;
    scheduledSlot?: string;
    pickupAddress?: any;
    contactPerson: { name: string; phone: string; secPhone?: string; email?: string };
    notes?: string;
    businessLocationId?: string;
    numberOfParcels?: number;
    packageType?: 'Normal' | 'Light Bulky' | 'Heavy Bulky';
    repeatedData?: { repeatedType: 'One Time' | 'Daily' | 'Weekly' };
    config?: BostaConfig;
  }): Promise<BostaPickupResponse> {
    try {
      const res = await fetch('/api/bosta/pickups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'فشل إنشاء إذن استلام الشحنات من بوسطة',
      };
    }
  },

  /**
   * Fetch Live Official Bosta Cities (docs.bosta.co/docs/how-to/format-bosta-address)
   */
  async getCities(): Promise<{ success: boolean; list: BostaCity[]; error?: string }> {
    try {
      const res = await fetch('/api/bosta/cities');
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, list: [], error: err.message };
    }
  },

  /**
   * Fetch Live All Egyptian Districts (docs.bosta.co/docs/how-to/format-bosta-address)
   */
  async getDistricts(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const res = await fetch('/api/bosta/districts');
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch Live Districts for a specific City
   */
  async getCityDistricts(cityId: string): Promise<{ success: boolean; districts?: any[]; error?: string }> {
    try {
      const res = await fetch(`/api/bosta/cities/${encodeURIComponent(cityId)}/districts`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch Live Zones for a specific City
   */
  async getZones(cityId: string): Promise<{ success: boolean; zones: BostaZone[]; error?: string }> {
    try {
      const res = await fetch(`/api/bosta/cities/${encodeURIComponent(cityId)}/zones`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, zones: [], error: err.message };
    }
  },

  /**
   * Fetch Business Profile & Saved Pickup Locations (docs.bosta.co/docs/how-to/create-your-first-pickup-location)
   */
  async getBusiness(businessId: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; business?: any; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (apiKey) params.append('apiKey', apiKey);
      if (isStaging) params.append('staging', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/bosta/businesses/${encodeURIComponent(businessId)}${query}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Save / Update Business Pickup Locations (docs.bosta.co/docs/how-to/create-your-first-pickup-location)
   */
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

  /**
   * Fetch Whitelisted Official IPs (docs.bosta.co/docs/how-to/whitelisting)
   */
  async getWhitelistedIps(): Promise<{ success: boolean; ips: string[]; note?: string }> {
    try {
      const res = await fetch('/api/bosta/whitelisting');
      return await res.json();
    } catch {
      return { success: true, ips: ['34.89.199.241', '35.246.223.19'] };
    }
  },

  /**
   * Calculate Shipping Fee via Bosta Calculator API (docs.bosta.co/api#/paths/pricing-shipment-calculator/get)
   */
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
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل حساب رسوم الشحن' };
    }
  },

  /**
   * Estimate Insurance Fee via Bosta Insurance Calculator API
   */
  async estimateInsurance(declaredValue: number, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; insurance?: any; error?: string }> {
    try {
      const q = new URLSearchParams({ declaredValue: String(declaredValue) });
      if (apiKey) q.append('apiKey', apiKey);
      if (isStaging) q.append('staging', 'true');

      const res = await fetch(`/api/bosta/pricing/insurance?${q.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل تقدير رسوم التأمين' };
    }
  },

  /**
   * View Delivery Details by ID or Tracking Number
   */
  async getDelivery(id: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; delivery?: any; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (apiKey) q.append('apiKey', apiKey);
      if (isStaging) q.append('staging', 'true');

      const res = await fetch(`/api/bosta/deliveries/${encodeURIComponent(id)}?${q.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Terminate / Cancel Delivery on Bosta
   */
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

  /**
   * Get Available Pickup Dates from Bosta
   */
  async getAvailablePickupDates(businessLocationId?: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; dates?: any[]; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (businessLocationId) q.append('businessLocationId', businessLocationId);
      if (apiKey) q.append('apiKey', apiKey);
      if (isStaging) q.append('staging', 'true');

      const res = await fetch(`/api/bosta/pickups/available-dates?${q.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * List Pickups
   */
  async getPickupsList(page: number = 1, limit: number = 20, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; pickups?: any[]; error?: string }> {
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (apiKey) q.append('apiKey', apiKey);
      if (isStaging) q.append('staging', 'true');

      const res = await fetch(`/api/bosta/pickups?${q.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Cancel Pickup Request
   */
  async cancelPickup(id: string, apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (apiKey) q.append('apiKey', apiKey);
      if (isStaging) q.append('staging', 'true');

      const res = await fetch(`/api/bosta/pickups/${encodeURIComponent(id)}?${q.toString()}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch Customer Delivery Success Rate from Bosta API & Local system
   */
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

  /**
   * Fetch Webhook Logs
   */
  async getWebhookLogs(): Promise<{ success: boolean; logs: any[]; error?: string }> {
    try {
      const res = await fetch('/api/webhooks/bosta/logs');
      return await res.json();
    } catch (err: any) {
      return { success: false, logs: [], error: err.message };
    }
  },

  /**
   * Clean Disconnect
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/bosta/disconnect', { method: 'POST' });
      return await res.json();
    } catch {
      return { success: true, message: 'تم إلغاء الربط' };
    }
  },

  /**
   * Generate Direct Bosta Live Tracking URL for customer
   */
  getTrackingUrl(trackingNumber: string): string {
    if (!trackingNumber) return '';
    return `https://bosta.co/tracking-shipment/?track=${encodeURIComponent(trackingNumber.trim())}`;
  },

  /**
   * Format Default WhatsApp Tracking Message
   */
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

  /**
   * Format WhatsApp Status Update Message for Webhook notifications
   */
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

  /**
   * Simulate Bosta Webhook Event for testing delivery updates
   */
  async simulateWebhook(params: {
    trackingNumber: string;
    businessReference?: string;
    stateCode: number;
    stateValue: string;
    reason?: string;
  }): Promise<{ success: boolean; error?: string; mappedStatus?: string; updatedOrders?: number; timestamp?: string }> {
    try {
      const res = await fetch('/api/webhooks/bosta/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'فشل إرسال اختبار الـ Webhook',
      };
    }
  },
};
