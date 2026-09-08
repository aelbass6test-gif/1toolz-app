import { Order, TurboConfig } from '../types';

export type { TurboConfig };

export const turboService = {
  /**
   * Get Airwaybill (AWB) for printing
   */
  async getAwb(trackingNumberOrRemoteId: string, config?: TurboConfig | { apiKey?: string; authenticationKey?: string; apiToken?: string; mainClientCode?: number }, order?: Order): Promise<{ success: boolean; data?: string; url?: string; error?: string }> {
    try {
      const authKey = (config as any)?.authenticationKey || (config as any)?.apiToken || (config as any)?.apiKey || '';
      const clientCode = (config as any)?.mainClientCode;
      const isStaging = (config as any)?.environment === 'staging';
      const res = await fetch('/api/shipping/turbo/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authentication_key: authKey,
          main_client_code: clientCode,
          remote_shipment_id: trackingNumberOrRemoteId,
          staging: isStaging,
          order: order || null,
          config: config || null
        })
      });
      return await res.json();
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
      const res = await fetch(`/api/turbo/verify?${q.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'تعذر الاتصال بخدمة تربو' };
    }
  },

  /**
   * Login with Email & Password to obtain Turbo API Token
   */
  async login(email: string, password: string, environment: 'production' | 'staging' = 'production'): Promise<{ success: boolean; apiKey?: string; user?: any; error?: string }> {
    try {
      const res = await fetch('/api/turbo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, environment })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل تسجيل الدخول لحساب تربو' };
    }
  },

  /**
   * Send single order to Turbo Courier
   */
  async createShipment(order: Order, config?: TurboConfig): Promise<{ success: boolean; waybillNumber?: string; shipmentId?: string; error?: string }> {
    try {
      const res = await fetch('/api/turbo/shipments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, config })
      });
      return await res.json();
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
      
      const res = await fetch('/api/shipping/turbo/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authentication_key: authKey,
          main_client_code: clientCode,
          remote_shipment_id: trackingNumber,
          staging: stagingFlag
        })
      });
      return await res.json();
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
      const res = await fetch(`/api/turbo/governorates?${q.toString()}`);
      return await res.json();
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

      const res = await fetch(`/api/turbo/pricing/calculator?${q.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل حساب رسوم الشحن مع تربو' };
    }
  },

  /**
   * Cancel shipment on Turbo
   */
  async cancelShipment(trackingNumber: string, config: TurboConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/turbo/shipments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, config })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل إلغاء الشحنة' };
    }
  },

  /**
   * Delete shipment from Turbo
   */
  async deleteShipment(trackingNumber: string, config: TurboConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/turbo/shipments/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, config })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل حذف الشحنة' };
    }
  },

  /**
   * Resend shipment request to Turbo
   */
  async resendRequest(trackingNumber: string, config: TurboConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/turbo/shipments/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, config })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل إعادة إرسال الطلب' };
    }
  },

  /**
   * Edit shipment on Turbo
   */
  async editShipment(trackingNumber: string, order: Order, config: TurboConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch('/api/turbo/shipments/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, order, config })
      });
      return await res.json();
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
      const res = await fetch(`/api/turbo/tickets/categories?${q.toString()}`);
      return await res.json();
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
      const res = await fetch(`/api/turbo/tickets/statuses?${q.toString()}`);
      return await res.json();
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
      const res = await fetch(`/api/turbo/tickets?${q.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async createTicket(payload: any, config: TurboConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch('/api/turbo/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          apiKey: config.apiKey,
          clientCode: config.mainClientCode,
          staging: config.environment === 'staging'
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async addTicketMessage(ticketId: string, content: string, config: TurboConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`/api/turbo/tickets/${ticketId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          apiKey: config.apiKey,
          clientCode: config.mainClientCode,
          staging: config.environment === 'staging'
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async rateTicket(ticketId: string, rate: number, config: TurboConfig): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`/api/turbo/tickets/${ticketId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate,
          apiKey: config.apiKey,
          clientCode: config.mainClientCode,
          staging: config.environment === 'staging'
        })
      });
      return await res.json();
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
      const res = await fetch(`/api/turbo/tickets/total-open?${q.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
