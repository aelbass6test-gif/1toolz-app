import { Order } from '../types';

/**
 * Extract shipping tracking / waybill number from order
 */
export function getTrackingNumber(order: Order): string {
  if (!order) return '';
  const num = 
    order.waybillNumber || 
    order.bostaTrackingNumber || 
    order.turboTrackingNumber || 
    (order as any).trackingNumber || 
    (order as any).trackingCode || 
    (order as any).shipmentId || 
    (order as any).airwayBill || 
    (order as any).bostaDeliveryId ||
    '';
  return String(num).trim();
}

/**
 * Generate live shipping tracking URL based on carrier and tracking number
 */
export function getShippingTrackingUrl(order: Order): string | null {
  if (!order) return null;
  
  if (order.trackingUrl && order.trackingUrl.trim().startsWith('http')) {
    return order.trackingUrl.trim();
  }

  const trackNum = getTrackingNumber(order);
  const company = (order.shippingCompany || '').toLowerCase().trim();

  // 1. Bosta
  if (company.includes('بوسطة') || company.includes('bosta')) {
    if (trackNum) {
      return `https://bosta.co/ar-eg/tracking-shipments?shipment-number=${encodeURIComponent(trackNum)}`;
    }
    return `https://bosta.co/ar-eg/tracking-shipments`;
  }

  // 2. Turbo Express
  if (company.includes('توربو') || company.includes('turbo')) {
    if (trackNum) {
      return `https://turboeg.com/track/${encodeURIComponent(trackNum)}`;
    }
    return `https://turboeg.com/track`;
  }

  // 3. J&T Express
  if (company.includes('j&t') || company.includes('جي اند تي') || company.includes('جي آند تي') || company.includes('jt')) {
    if (trackNum) {
      return `https://www.jtexpress.eg/trajectoryQuery?billCode=${encodeURIComponent(trackNum)}`;
    }
    return `https://www.jtexpress.eg`;
  }

  // 4. Aramex
  if (company.includes('أرامكس') || company.includes('aramex')) {
    if (trackNum) {
      return `https://www.aramex.com/express/track-results-multiple?shipmentItems=${encodeURIComponent(trackNum)}`;
    }
    return `https://www.aramex.com`;
  }

  // 5. Mylerz
  if (company.includes('مايلرز') || company.includes('mylerz')) {
    if (trackNum) {
      return `https://mylerz.net/track-package?trackingNumber=${encodeURIComponent(trackNum)}`;
    }
    return `https://mylerz.net`;
  }

  // 6. Overnight
  if (company.includes('أوفرنايت') || company.includes('overnight')) {
    if (trackNum) {
      return `https://overnight-eg.com/track/${encodeURIComponent(trackNum)}`;
    }
  }

  // Fallback: If tracking number exists, default to Bosta tracking page or google search
  if (trackNum) {
    return `https://bosta.co/ar-eg/tracking-shipments?shipment-number=${encodeURIComponent(trackNum)}`;
  }

  return null;
}
