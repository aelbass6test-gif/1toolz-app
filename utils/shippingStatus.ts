import { OrderStatus } from '../types';

export interface ShippingStatusUpdate {
  carrier: string;
  externalStatus: string;
  externalCode?: string | number | null;
  internalStatus?: OrderStatus;
  reason?: string;
  eventAt: string;
  receivedAt: string;
  trackingNumber?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
  source: 'webhook' | 'polling' | 'manual';
}

const STATUS_RANK: Record<string, number> = {
  'في_انتظار_المكالمة': 10,
  'جاري_المراجعة': 20,
  'قيد_التنفيذ': 30,
  'تم_الارسال': 40,
  'قيد_الشحن': 50,
  'فشل_التوصيل': 60,
  'مؤجل': 65,
  'مرتجع': 70,
  'مرتجع_جزئي': 70,
  'تم_توصيلها': 80,
  'تم_التحصيل': 90,
  'ملغي': 100,
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function mapBostaStatus(stateValue?: unknown, stateCode?: number | null): OrderStatus | undefined {
  if (stateCode === 45) return 'تم_توصيلها';
  if ([46, 47, 49].includes(Number(stateCode))) return 'مرتجع';
  if (stateCode === 48) return 'مؤجل';
  if ([10, 11].includes(Number(stateCode))) return 'قيد_التنفيذ';
  if ([20, 21, 22, 23, 24, 30, 40, 41, 42].includes(Number(stateCode))) return 'تم_الارسال';

  const value = normalize(stateValue);
  if (value.includes('deliver') && !value.includes('attempt') && !value.includes('out for')) return 'تم_توصيلها';
  if (value.includes('return') || value.includes('cancel') || value.includes('terminate')) return 'مرتجع';
  if (value.includes('postpone') || value.includes('action required') || value.includes('delay')) return 'مؤجل';
  if (value.includes('pickup request') || value.includes('waiting for route')) return 'قيد_التنفيذ';
  if (value.includes('transit') || value.includes('out for delivery') || value.includes('picked up') || value.includes('warehouse')) return 'تم_الارسال';
  return undefined;
}

export function mapTurboStatus(statusCode?: number | string | null, statusValue?: unknown): OrderStatus | undefined {
  const code = Number(statusCode);
  if ([1, 2].includes(code)) return 'تم_الارسال';
  if (code === 3) return 'تم_توصيلها';
  if (code === 4) return 'مرتجع_جزئي';
  if (code === 5) return 'مرتجع';
  if (code === 6) return 'قيد_الشحن';
  if (code === 10) return 'فشل_التوصيل';
  if (code === 12) return 'ملغي';

  const value = normalize(statusValue);
  if (value.includes('deliver')) return 'تم_توصيلها';
  if (value.includes('return') || value.includes('rts')) return 'مرتجع';
  if (value.includes('fail')) return 'فشل_التوصيل';
  if (value.includes('transit') || value.includes('out for')) return 'قيد_الشحن';
  if (value.includes('cancel')) return 'ملغي';
  return undefined;
}

export function getEventAt(body: any): string {
  const candidate = body?.eventAt || body?.event_at || body?.updatedAt || body?.updated_at || body?.createdAt || body?.created_at;
  const date = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function buildEventKey(update: Pick<ShippingStatusUpdate, 'carrier' | 'trackingNumber' | 'externalId' | 'externalStatus' | 'externalCode' | 'eventAt'>): string {
  return [
    update.carrier,
    update.trackingNumber || '',
    update.externalId || '',
    update.externalStatus || '',
    update.externalCode ?? '',
    update.eventAt,
  ].join('|').toLowerCase();
}

export function shouldApplyShippingUpdate(current: any, update: ShippingStatusUpdate, eventKey: string): boolean {
  if (current?.lastShippingEventKey === eventKey) return false;
  const previousAt = current?.lastShippingEventAt ? new Date(current.lastShippingEventAt).getTime() : 0;
  const incomingAt = new Date(update.eventAt).getTime();
  return !previousAt || !Number.isFinite(incomingAt) || incomingAt >= previousAt;
}

export function appendShippingTimeline(current: any, update: ShippingStatusUpdate, eventKey: string): any[] {
  const existing = Array.isArray(current?.shipmentTimeline) ? current.shipmentTimeline : [];
  if (existing.some((item: any) => item?.eventKey === eventKey)) return existing;
  return [...existing, { ...update, eventKey }].sort((a, b) => String(a.eventAt).localeCompare(String(b.eventAt))).slice(-100);
}

export function statusRank(status?: string): number {
  return STATUS_RANK[status || ''] || 0;
}
