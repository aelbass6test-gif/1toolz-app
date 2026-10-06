import { soundManager } from '../utils/soundNotification';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'order' | 'partner' | 'treasury' | 'inventory' | 'system';
  timestamp: string;
  read: boolean;
  link?: string;
  amount?: number;
}

class NotificationService {
  private notifications: AppNotification[] = [];
  private listeners: Array<(notifications: AppNotification[]) => void> = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('app_inbox_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored).slice(0, 50);
      }
    } catch (_) {}
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('app_inbox_notifications', JSON.stringify(this.notifications.slice(0, 50)));
    } catch (_) {}
  }

  public subscribe(listener: (notifications: AppNotification[]) => void) {
    this.listeners.push(listener);
    listener([...this.notifications]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l([...this.notifications]));
    this.saveToStorage();
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      return await Notification.requestPermission();
    } catch (e) {
      console.warn('Notification permission request error:', e);
      return 'denied';
    }
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Dispatches an in-app and browser notification with sound
   */
  public triggerNotification(data: {
    title: string;
    body: string;
    type: AppNotification['type'];
    link?: string;
    amount?: number;
  }) {
    const item: AppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: data.title,
      body: data.body,
      type: data.type,
      timestamp: new Date().toISOString(),
      read: false,
      link: data.link,
      amount: data.amount
    };

    // Play Sound
    if (data.type === 'order') {
      soundManager.playNewOrderChime();
    } else {
      soundManager.playAlertChime();
    }

    // Add to In-App Inbox
    this.notifications = [item, ...this.notifications].slice(0, 50);
    this.notifyListeners();

    // Trigger Browser / System Notification if allowed
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(data.title, {
          body: data.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: item.id
        });

        notif.onclick = () => {
          window.focus();
          if (data.link) {
            window.location.hash = data.link;
          }
          notif.close();
        };
      } catch (e) {
        console.warn('Browser system notification dispatch error:', e);
      }
    }
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    this.notifyListeners();
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.notifyListeners();
  }

  public clearAll() {
    this.notifications = [];
    this.notifyListeners();
  }

  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }
}

export const notificationService = new NotificationService();
