import { Order } from '../types';
import { soundNotification } from './soundNotification';

export type WebNotificationPermissionState = NotificationPermission | 'unsupported';

/**
 * Checks if the Web Notifications API is supported in the current environment
 */
export const isWebNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Returns current permission status ('granted', 'denied', 'default', or 'unsupported')
 */
export const getWebNotificationPermission = (): WebNotificationPermissionState => {
  if (!isWebNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Checks user preference from localStorage (defaults to true)
 */
export const isWebNotificationEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem('web_notifications_enabled');
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

/**
 * Toggles user preference for web notifications
 */
export const setWebNotificationEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem('web_notifications_enabled', enabled ? 'true' : 'false');
  } catch {}
};

/**
 * Prompts user for browser notification permission
 */
export const requestWebNotificationPermission = async (): Promise<WebNotificationPermissionState> => {
  if (!isWebNotificationSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setWebNotificationEnabled(true);
    }
    return permission;
  } catch (error) {
    console.warn('Error requesting notification permission:', error);
    return Notification.permission || 'denied';
  }
};

/**
 * Check if the order status is considered 'pending'
 * Handles English 'pending' as requested by the user, and standard Arabic ERP equivalents ('في_انتظار_المكالمة', etc.)
 */
export const isPendingOrderStatus = (status?: string): boolean => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return (
    s === 'pending' ||
    s === 'في_انتظار_المكالمة' ||
    s === 'في انتظار المكالمة' ||
    s === 'بانتظار_المكالمة' ||
    s === 'بانتظار المكالمة' ||
    s === 'جاري_المراجعة' ||
    s === 'قيد_المراجعة' ||
    s.includes('pending') ||
    s.includes('انتظار')
  );
};

export interface ShowOrderNotificationOptions {
  storeName?: string;
  onOrderClick?: (order: Order) => void;
  playSound?: boolean;
}

/**
 * Dispatches an In-App alert event and a native OS/Browser Web Notification for an incoming pending order
 */
export const showOrderWebNotification = (
  order: Order,
  options?: ShowOrderNotificationOptions
): Notification | null => {
  // 1. Play auditory chime and mobile haptic feedback if enabled
  if (options?.playSound !== false) {
    try {
      soundNotification.playNewOrderChime();
    } catch (e) {
      console.warn('Could not play order chime:', e);
    }
  }

  // 2. Dispatch in-app manager alert event so the rich alert modal appears immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('NEW_PENDING_ORDER_ALERT', {
        detail: {
          order,
          storeName: options?.storeName || 'متجري'
        }
      })
    );
  }

  // 3. Check if Web Notification is enabled and supported
  if (!isWebNotificationSupported() || !isWebNotificationEnabled()) {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    const total = (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);
    const orderNum = order.orderNumber || order.id || 'جديد';
    const customer = order.customerName || 'عميل جديد';
    const city = order.governorate || order.shippingArea || 'غير محدد';
    const itemsCount = (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

    const title = `🔔 أوردر جديد وارد! #${orderNum}`;
    const body = `👤 العميل: ${customer}\n💰 الإجمالي: ${total.toLocaleString()} ج.م (${itemsCount} منتج)\n📍 ${city} • ⏳ بانتظار التأكيد`;

    const notification = new Notification(title, {
      body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: `pending-order-${order.id}`,
      requireInteraction: true,
      lang: 'ar',
      dir: 'rtl'
    });

    notification.onclick = () => {
      try {
        window.focus();
      } catch {}

      if (options?.onOrderClick) {
        options.onOrderClick(order);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('NAVIGATE_TO_ORDER', {
            detail: {
              orderId: order.id,
              order
            }
          })
        );
      }

      notification.close();
    };

    return notification;
  } catch (error) {
    console.warn('Failed to display browser notification:', error);
    return null;
  }
};

/**
 * Sends a test web notification to verify browser permissions and sound
 */
export const sendTestWebNotification = async (storeName: string = 'متجري'): Promise<{ success: boolean; message: string }> => {
  if (!isWebNotificationSupported()) {
    return {
      success: false,
      message: 'المتصفح الحالي لا يدعم إشعارات الويب (Web Notifications).'
    };
  }

  let permission: string = Notification.permission;
  if (permission === 'default') {
    const requested = await requestWebNotificationPermission();
    if (requested !== 'unsupported') {
      permission = requested;
    }
  }

  if (permission !== 'granted') {
    return {
      success: false,
      message: 'يرجى السماح بإشعارات المتصفح في إعدادات الموقع لتفعيل التنبيهات الفورية.'
    };
  }

  const dummyOrder = {
    id: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
    orderNumber: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: 'أحمد محمود (تجريبي)',
    customerPhone: '01012345678',
    customerAddress: 'شارع التحرير، الدقي',
    governorate: 'الجيزة',
    shippingArea: 'الجيزة',
    shippingCompany: 'بوسطة',
    paymentStatus: 'بانتظار الدفع',
    productName: 'منتج تجريبي فاخر',
    productCost: 300,
    productPrice: 650,
    shippingFee: 50,
    discount: 0,
    weight: 1,
    status: 'في_انتظار_المكالمة',
    date: new Date().toISOString(),
    paymentMethod: 'cash_on_delivery',
    items: [
      {
        productId: 'test-1',
        name: 'منتج تجريبي فاخر',
        price: 650,
        cost: 300,
        weight: 1,
        quantity: 1
      }
    ]
  } as unknown as Order;

  showOrderWebNotification(dummyOrder, { storeName });

  return {
    success: true,
    message: 'تم إرسال إشعار تجريبي فوري بنجاح وتشغيل نغمة التنبيه!'
  };
};
