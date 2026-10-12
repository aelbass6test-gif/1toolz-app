import { soundManager } from './soundNotification';
import { Order } from '../types';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface NewOrderNotificationOptions {
  order: Order;
  storeName?: string;
  onClick?: () => void;
}

class WebNotificationService {
  private isSupported: boolean;
  private alertedOrderIds: Set<string> = new Set();
  private listeners: Set<(order: Order) => void> = new Set();

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'Notification' in window;
    
    // Load previously alerted order IDs from sessionStorage to prevent spamming on page refresh
    try {
      const stored = sessionStorage.getItem('alerted_new_order_ids');
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          this.alertedOrderIds = new Set(ids);
        }
      }
    } catch (_) {}
  }

  public getPermissionStatus(): NotificationPermissionStatus {
    if (!this.isSupported) return 'unsupported';
    return Notification.permission as NotificationPermissionStatus;
  }

  public async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!this.isSupported) return 'unsupported';
    try {
      const permission = await Notification.requestPermission();
      return permission as NotificationPermissionStatus;
    } catch (e) {
      console.warn('[WebNotification] Error requesting permission:', e);
      return this.getPermissionStatus();
    }
  }

  public subscribeNewOrder(listener: (order: Order) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notifyListeners(order: Order) {
    this.listeners.forEach(fn => {
      try {
        fn(order);
      } catch (e) {
        console.error('[WebNotification] Listener callback error:', e);
      }
    });
  }

  public markOrderAsAlerted(orderId: string) {
    this.alertedOrderIds.add(orderId);
    try {
      sessionStorage.setItem('alerted_new_order_ids', JSON.stringify(Array.from(this.alertedOrderIds)));
    } catch (_) {}
  }

  public hasBeenAlerted(orderId: string): boolean {
    return this.alertedOrderIds.has(orderId);
  }

  /**
   * Dispatches both browser Web Notification and triggers in-app sound & modal
   */
  public triggerNewOrderAlert(options: NewOrderNotificationOptions): boolean {
    const { order, storeName = 'المتجر', onClick } = options;
    const orderId = order.id || `ord_${Date.now()}`;

    // Mark as alerted so we don't duplicate
    this.markOrderAsAlerted(orderId);

    // 1. Play auditory cash / new order chime
    try {
      soundManager.playNewOrderChime();
    } catch (_) {}

    // 2. Notify in-app subscribers (opens popup alert window for the manager)
    this.notifyListeners(order);

    // 3. Dispatch native browser Web Notification if granted
    if (this.isSupported && Notification.permission === 'granted') {
      try {
        const orderNum = order.orderNumber || orderId.slice(-6);
        const customer = order.customerName || 'عميل جديد';
        const totalAmount = (order.totalPrice || order.productPrice || 0).toLocaleString();
        const itemsCount = (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

        const title = `📦 أوردر جديد وارد! (#${orderNum})`;
        const body = `👤 العميل: ${customer}\n💰 الإجمالي: ${totalAmount} ج.م (${itemsCount} قطعة)\n📞 هاتف: ${order.customerPhone || 'غير محدد'}\n🏪 ${storeName}`;

        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `new-order-${orderId}`,
          badge: '/favicon.ico',
          dir: 'rtl',
          lang: 'ar',
          requireInteraction: true // Stays on screen until user interacts with it
        });

        notification.onclick = () => {
          try {
            window.focus();
            notification.close();
            if (onClick) {
              onClick();
            } else {
              // Default to navigating to orders
              window.location.hash = '#/orders';
            }
          } catch (_) {}
        };
      } catch (err) {
        console.warn('[WebNotification] Error displaying native notification:', err);
      }
    }

    return true;
  }

  /**
   * Helper to send a test notification
   */
  public sendTestAlert(storeName = 'متجري') {
    const testOrder = {
      id: `test_${Date.now()}`,
      orderNumber: `${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: 'أحمد محمود (تجريبي)',
      customerPhone: '01012345678',
      customerAddress: 'شارع التسعين، التجمع الخامس',
      shippingArea: 'القاهرة',
      shippingCompany: 'بوسطة',
      shippingFee: 45,
      date: new Date().toISOString(),
      status: 'في_انتظار_المكالمة',
      items: [
        {
          productId: 'p_test',
          name: 'ساعة يد كلاسيكية فاخرة',
          quantity: 2,
          price: 650,
          cost: 350,
          weight: 0.5
        }
      ],
      productPrice: 1300,
      totalPrice: 1345,
      orderType: 'standard',
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'بانتظار الدفع',
      preparationStatus: 'بانتظار التجهيز'
    } as unknown as Order;

    return this.triggerNewOrderAlert({
      order: testOrder,
      storeName,
      onClick: () => {
        console.log('[TestNotification] Notification clicked');
      }
    });
  }
}

export const webNotificationService = new WebNotificationService();
