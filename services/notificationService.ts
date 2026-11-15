import { soundManager } from '../utils/soundNotification';
import { cfFetch } from './cloudflareClient';

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
  private storeId: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private getStorageKey(): string {
    return this.storeId ? `app_inbox_notifications_${this.storeId}` : 'app_inbox_notifications';
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.getStorageKey()) || localStorage.getItem('app_inbox_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored).slice(0, 50);
      }
    } catch (_) {}
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.notifications.slice(0, 50)));
    } catch (_) {}
  }

  public async setStoreContext(storeId: string | null | undefined) {
    const normalized = storeId ? String(storeId).trim() : null;
    if (this.storeId === normalized && this.notifications.length > 0) return;
    this.storeId = normalized;
    this.loadFromStorage();
    this.listeners.forEach(l => l([...this.notifications]));

    if (!normalized) return;
    try {
      const res = await cfFetch<{ success?: boolean; notifications?: AppNotification[] }>(
        `/api/db/notifications/${encodeURIComponent(normalized)}`
      );
      if (Array.isArray(res?.notifications)) {
        this.notifications = res.notifications.slice(0, 50);
        this.notifyListeners();
      }
    } catch {
      // keep local cache when offline
    }
  }

  private resolveStoreId(): string | null {
    if (this.storeId) return this.storeId;
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('lastActiveStoreId') || localStorage.getItem('activeStoreId');
      } catch {
        return null;
      }
    }
    return null;
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
   * Dispatches an in-app and browser notification with sound + persists to Cloudflare D1
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

    const sid = this.resolveStoreId();
    if (sid) {
      void cfFetch(`/api/db/notifications/${encodeURIComponent(sid)}`, {
        method: 'POST',
        body: JSON.stringify({ notification: item })
      }).catch((err) => console.warn('[Notification] Failed cloud save:', err?.message || err));
    }

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
    const sid = this.resolveStoreId();
    if (sid) {
      void cfFetch(`/api/db/notifications/${encodeURIComponent(sid)}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ id })
      }).catch(() => {});
    }
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.notifyListeners();
    const sid = this.resolveStoreId();
    if (sid) {
      void cfFetch(`/api/db/notifications/${encodeURIComponent(sid)}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ all: true })
      }).catch(() => {});
    }
  }

  public clearAll() {
    this.notifications = [];
    this.notifyListeners();
    const sid = this.resolveStoreId();
    if (sid) {
      void cfFetch(`/api/db/notifications/${encodeURIComponent(sid)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
  }

  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }
}

export const notificationService = new NotificationService();
