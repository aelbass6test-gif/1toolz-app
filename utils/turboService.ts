import { Order, TurboConfig } from '../types';

export type { TurboConfig };

const CARRIER_API_BASE = (import.meta.env.VITE_CARRIER_API_BASE_URL || '').replace(/\/$/, '');

async function safeFetchJson(url: string, options?: RequestInit, fallbackError?: string): Promise<any> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000';

  const doFetch = async (baseUrl: string) => {
    const urlObj = new URL(url, baseUrl);
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
          : (fallbackError || `تعذر الاتصال بخادم الربط مع تربو (رمز الاستجابة ${res.status}).`),
        isHtmlResponse: true,
        status: res.status
      };
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        error: fallbackError || 'تعذر قراءة الاستجابة من خادم تربو.'
      };
    }
  };

  // If external CARRIER_API_BASE is configured and valid, try it first
  if (CARRIER_API_BASE && CARRIER_API_BASE !== origin) {
    try {
      const externalRes = await doFetch(CARRIER_API_BASE);
      if (externalRes && !externalRes.isHtmlResponse && (externalRes.success !== false || externalRes.status !== 404)) {
        return externalRes;
      }
    } catch (err) {
      console.warn('External CARRIER_API_BASE unavailable, routing to local backend proxy:', err);
    }
  }

  // Primary: Always fetch from local origin
  try {
    return await doFetch(origin);
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'فشل الاتصال بالشبكة.'
    };
  }
}

function sanitizeTurboConfig(config?: Partial<TurboConfig>): Partial<TurboConfig> | undefined {
  if (!config) return undefined;
  const {
    accountPassword,
    webhookToken,
    connectedUserName,
    connectedUserEmail,
    connectedUserPhone,
    ...safeConfig
  } = config;
  return safeConfig;
}

export const turboService = {
  /**
   * Get Airwaybill (AWB) for printing
   */
  async getAwb(trackingNumberOrRemoteId: string, config?: TurboConfig | { apiKey?: string; authenticationKey?: string; apiToken?: string; mainClientCode?: number }, order?: Order): Promise<{ success: boolean; data?: string; url?: string; error?: string }> {
    try {
      const authKey = (config as any)?.authenticationKey || (config as any)?.apiToken || (config as any)?.apiKey || '';
      const clientCode = (config as any)?.mainClientCode;
      const isStaging = (config as any)?.environment === 'staging';
      return await safeFetchJson('/api/shipping/turbo/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authentication_key: authKey,
          main_client_code: clientCode,
          remote_shipment_id: trackingNumberOrRemoteId,
          staging: isStaging,
          order: order || null,
          config: sanitizeTurboConfig(config) || null
        })
      }, 'فشل تحميل بوليصة تربو');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل تحميل بوليصة تربو' };
    }
  },
  /**
   * Verify Turbo API Key or Login
   */
  async verifyApiKey(apiKey: string, environment: 'production' | 'staging' = 'production'): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const q = new URLSearchParams({ apiKey });
      if (environment === 'staging') q.append('staging', 'true');
      return await safeFetchJson(`/api/turbo/verify?${q.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, 'تعذر الاتصال بخدمة تربو');
    } catch (err: any) {
      return { success: false, error: err.message || 'تعذر الاتصال بخدمة تربو' };
    }
  },

  /**
   * Login with Email & Password to obtain Turbo API Token
   */
  async login(email: string, password: string, environment: 'production' | 'staging' = 'production'): Promise<{ success: boolean; apiKey?: string; user?: any; error?: string }> {
    try {
      return await safeFetchJson('/api/turbo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, environment })
      }, 'فشل تسجيل الدخول لحساب تربو');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل تسجيل الدخول لحساب تربو' };
    }
  },

  /**
   * Send single order to Turbo Courier
   */
  async createShipment(order: Order, config?: TurboConfig): Promise<{ success: boolean; waybillNumber?: string; shipmentId?: string; error?: string }> {
    try {
      const existingTrackingNumber = order.turboTrackingNumber || (order.shippingCompany?.toLowerCase().includes('turbo') ? order.waybillNumber : undefined);
      if (existingTrackingNumber) {
        return {
          success: true,
          waybillNumber: existingTrackingNumber,
          shipmentId: order.turboDeliveryId,
          error: undefined
        };
      }

      const res = await safeFetchJson('/api/turbo/shipments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, config: sanitizeTurboConfig(config) })
      }, 'فشل إرسال الشحنة لشركة تربو');

      if (res && res.success && (res.waybillNumber || res.shipmentId)) {
        return res;
      }

      return {
        success: false,
        error: res?.error || 'فشل إنشاء الشحنة في خوادم تربو (تأكد من صحة المفتاح وبيانات العنوان)'
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء إرسال الشحنة إلى تربو' };
    }
  },

  /**
   * Track Shipment on Turbo by Waybill / Tracking Number
   */
  async trackShipment(trackingNumber: string, configOrApiKey?: string | TurboConfig | Partial<TurboConfig> | any, isStaging?: boolean): Promise<{ success: boolean; trackingInfo?: any; status?: string; statusArabic?: string; error?: string }> {
    try {
      let authKey = '';
      let clientCode: any = 74068;
      let stagingFlag = isStaging === true;

      if (typeof configOrApiKey === 'string') {
        authKey = configOrApiKey;
      } else if (configOrApiKey) {
        authKey = (configOrApiKey as any)?.authenticationKey || (configOrApiKey as any)?.apiToken || (configOrApiKey as any)?.apiKey || '';
        clientCode = (configOrApiKey as any)?.mainClientCode || 74068;
        stagingFlag = (configOrApiKey as any)?.environment === 'staging' || isStaging === true;
      }
      
      return await safeFetchJson('/api/shipping/turbo/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authentication_key: authKey,
          main_client_code: clientCode,
          remote_shipment_id: trackingNumber,
          staging: stagingFlag
        })
      }, 'فشل تتبع الشحنة مع تربو');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل تتبع الشحنة مع تربو' };
    }
  },

  /**
   * Get Governorates and Sub-Zones covered by Turbo
   */
  async getGovernorates(apiKey?: string, isStaging?: boolean): Promise<{ success: boolean; governorates?: any[]; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (apiKey) q.append('apiKey', apiKey);
      if (isStaging) q.append('staging', 'true');
      return await safeFetchJson(`/api/turbo/governorates?${q.toString()}`, undefined, 'فشل جلب قائمة المحافظات من تربو');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل جلب قائمة المحافظات من تربو' };
    }
  },

  /**
   * Calculate Shipping Cost via Turbo API
   */
  async calculatePricing(params: {
    governorate: string;
    city?: string;
    weight?: number;
    cod?: number;
    apiKey?: string;
    isStaging?: boolean;
  }): Promise<{ success: boolean; price?: number; pricing?: any; error?: string }> {
    try {
      const q = new URLSearchParams();
      if (params.governorate) q.append('governorate', params.governorate);
      if (params.city) q.append('city', params.city);
      if (params.weight) q.append('weight', String(params.weight));
      if (params.cod !== undefined) q.append('cod', String(params.cod));
      if (params.apiKey) q.append('apiKey', params.apiKey);
      if (params.isStaging) q.append('staging', 'true');

      return await safeFetchJson(`/api/turbo/pricing/calculator?${q.toString()}`, undefined, 'فشل حساب رسوم الشحن مع تربو');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل حساب رسوم الشحن مع تربو' };
    }
  },

  /**
   * Cancel shipment on Turbo
   */
  async cancelShipment(trackingNumber: string, config: TurboConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      return await safeFetchJson('/api/turbo/shipments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, config: sanitizeTurboConfig(config) })
      }, 'فشل إلغاء الشحنة');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل إلغاء الشحنة' };
    }
  },

  /**
   * Delete shipment from Turbo
   */
  async deleteShipment(trackingNumber: string, config: TurboConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      return await safeFetchJson('/api/turbo/shipments/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, config: sanitizeTurboConfig(config) })
      }, 'فشل حذف الشحنة');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل حذف الشحنة' };
    }
  },

  /**
   * Resend shipment request to Turbo
   */
  async resendRequest(trackingNumber: string, config: TurboConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      return await safeFetchJson('/api/turbo/shipments/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, config: sanitizeTurboConfig(config) })
      }, 'فشل إعادة إرسال الطلب');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل إعادة إرسال الطلب' };
    }
  },

  /**
   * Edit shipment on Turbo
   */
  async editShipment(trackingNumber: string, order: Order, config: TurboConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      return await safeFetchJson('/api/turbo/shipments/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, order, config: sanitizeTurboConfig(config) })
      }, 'فشل تعديل الشحنة');
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل تعديل الشحنة' };
    }
  },

  /**
   * Ticket System Methods
   */
  async getTicketCategories(config: TurboConfig): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const q = new URLSearchParams({
        apiKey: config.apiKey || '',
        clientCode: String(config.mainClientCode || ''),
        staging: config.environment === 'staging' ? 'true' : 'false'
      });
      return await safeFetchJson(`/api/turbo/tickets/categories?${q.toString()}`);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getTicketStatuses(config: TurboConfig): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const q = new URLSearchParams({
        apiKey: config.apiKey || '',
        clientCode: String(config.mainClientCode || ''),
        staging: config.environment === 'staging' ? 'true' : 'false'
      });
      return await safeFetchJson(`/api/turbo/tickets/statuses?${q.toString()}`);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getTickets(config: TurboConfig): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const q = new URLSearchParams({
        apiKey: config.apiKey || '',
        clientCode: String(config.mainClientCode || ''),
        staging: config.environment === 'staging' ? 'true' : 'false'
      });
      return await safeFetchJson(`/api/turbo/tickets?${q.toString()}`);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async createTicket(payload: any, config: TurboConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      return await safeFetchJson('/api/turbo/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          apiKey: config.apiKey,
          clientCode: config.mainClientCode,
          staging: config.environment === 'staging'
        })
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async addTicketMessage(ticketId: string, content: string, config: TurboConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      return await safeFetchJson(`/api/turbo/tickets/${ticketId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          apiKey: config.apiKey,
          clientCode: config.mainClientCode,
          staging: config.environment === 'staging'
        })
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async rateTicket(ticketId: string, rate: number, config: TurboConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      return await safeFetchJson(`/api/turbo/tickets/${ticketId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate,
          apiKey: config.apiKey,
          clientCode: config.mainClientCode,
          staging: config.environment === 'staging'
        })
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getTotalOpenTickets(config: TurboConfig): Promise<{ success: boolean; data?: { total: number }; error?: string }> {
    try {
      const q = new URLSearchParams({
        apiKey: config.apiKey || '',
        clientCode: String(config.mainClientCode || ''),
        staging: config.environment === 'staging' ? 'true' : 'false'
      });
      return await safeFetchJson(`/api/turbo/tickets/total-open?${q.toString()}`);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
