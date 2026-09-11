import { Order, BostaConfig, TurboConfig, OrderStatus } from '../types';
import { bostaService } from './bostaService';
import { turboService } from './turboService';

export interface ShippingResult {
  success: boolean;
  waybillNumber?: string;
  shipmentId?: string;
  error?: string;
  trackingUrl?: string;
  data?: any;
}

export interface TrackingResult {
  success: boolean;
  status?: string;
  statusArabic?: string;
  timeline?: any[];
  error?: string;
  data?: any;
}

export interface ShippingAdapter {
  createShipment(order: Order, config: any): Promise<ShippingResult>;
  trackShipment(trackingNumber: string, config: any): Promise<TrackingResult>;
  cancelShipment(trackingNumber: string, config: any): Promise<{ success: boolean; message?: string; error?: string }>;
  getAwb?(trackingNumber: string, config: any, order?: Order): Promise<{ success: boolean; data?: string; url?: string; error?: string }>;
  getCarrierName(): string;
}

export class TurboAdapter implements ShippingAdapter {
  async createShipment(order: Order, config: TurboConfig): Promise<ShippingResult> {
    const res = await turboService.createShipment(order, config);
    return {
      success: res.success,
      waybillNumber: res.waybillNumber,
      shipmentId: res.shipmentId,
      error: res.error,
      data: res
    };
  }

  async trackShipment(trackingNumber: string, config: TurboConfig): Promise<TrackingResult> {
    const res = await turboService.trackShipment(trackingNumber, config);
    const trackingInfo = res.trackingInfo || {};
    const status = res.status || trackingInfo.status || trackingInfo.status_text || 'قيد المتابعة';
    const statusArabic = res.statusArabic || trackingInfo.status_ar || trackingInfo.status || status;
    return {
      success: res.success,
      status: status,
      statusArabic: statusArabic,
      timeline: trackingInfo.history || [],
      error: res.error,
      data: trackingInfo
    };
  }

  async cancelShipment(trackingNumber: string, config: TurboConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    return turboService.cancelShipment(trackingNumber, config);
  }

  async getAwb(trackingNumber: string, config: TurboConfig, order?: Order): Promise<{ success: boolean; data?: string; url?: string; error?: string }> {
    return turboService.getAwb(trackingNumber, config, order);
  }

  getCarrierName(): string {
    return 'تربو';
  }
}

export class BostaAdapter implements ShippingAdapter {
  async createShipment(order: Order, config: BostaConfig): Promise<ShippingResult> {
    const res = await bostaService.createDelivery(order, config);
    return {
      success: res.success,
      waybillNumber: res.trackingNumber,
      shipmentId: res.deliveryId,
      error: res.error,
      trackingUrl: bostaService.getTrackingUrl(res.trackingNumber || ''),
      data: res.data
    };
  }

  async trackShipment(trackingNumber: string, config?: BostaConfig): Promise<TrackingResult> {
    const res = await bostaService.trackShipment(trackingNumber, config?.apiKey, config?.environment === 'staging');
    const t = res.tracking || (res as any).data || (res as any).delivery;
    const stateVal = t?.state?.value || t?.state?.name || t?.state || t?.status || t?.currentState;
    const stateArVal = t?.state?.name || t?.state?.value || t?.stateArabic || t?.statusArabic || (typeof stateVal === 'string' ? stateVal : undefined);
    
    return {
      success: res.success,
      status: (typeof stateVal === 'string' ? stateVal : (stateVal?.value || stateVal?.name)) || t?.status,
      statusArabic: (typeof stateArVal === 'string' ? stateArVal : (stateArVal?.name || stateArVal?.value)) || t?.statusArabic || (typeof stateVal === 'string' ? stateVal : undefined),
      timeline: t?.timeline || t?.transitEvents || t?.history,
      error: res.error,
      data: t
    };
  }

  async cancelShipment(trackingNumber: string, config?: BostaConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    return bostaService.terminateDelivery(trackingNumber, config);
  }

  async getAwb(trackingNumber: string, config?: BostaConfig, order?: Order): Promise<{ success: boolean; data?: string; error?: string }> {
    return bostaService.getAwb(trackingNumber, config?.apiKey, config?.environment === 'staging');
  }

  getCarrierName(): string {
    return 'بوسطة';
  }
}

export const getShippingAdapter = (companyName?: string): ShippingAdapter | null => {
  if (!companyName) return null;
  const normalized = companyName.toLowerCase().trim();
  if (normalized.includes('turbo') || normalized.includes('تربو') || normalized.includes('توربو')) return new TurboAdapter();
  if (normalized.includes('bosta') || normalized.includes('بوسطة') || normalized.includes('بوسطه')) return new BostaAdapter();
  return null;
};
