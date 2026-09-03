import { audioSynth } from './audioSynth';

export type InAppAlertType = 'warning' | 'danger' | 'error' | 'success' | 'info' | 'question';

export interface InAppAlertOptions {
  id?: string;
  title?: string;
  message: string;
  type?: InAppAlertType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  checkboxLabel?: string;
  playSound?: boolean;
  onConfirm?: (checkboxChecked?: boolean) => void;
  onCancel?: () => void;
}

export interface InAppToastOptions {
  id?: string;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  durationMs?: number;
}

type DialogListener = (dialog: InAppAlertOptions | null) => void;
type ToastListener = (toasts: InAppToastOptions[]) => void;

class InAppAlertManager {
  private currentDialog: InAppAlertOptions | null = null;
  private dialogListeners: Set<DialogListener> = new Set();
  
  private toasts: InAppToastOptions[] = [];
  private toastListeners: Set<ToastListener> = new Set();

  private resolveConfirm: ((val: boolean) => void) | null = null;

  constructor() {
    this.setupGlobalOverrides();
  }

  public subscribeDialog(listener: DialogListener): () => void {
    this.dialogListeners.add(listener);
    listener(this.currentDialog);
    return () => this.dialogListeners.delete(listener);
  }

  public subscribeToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    listener(this.toasts);
    return () => this.toastListeners.delete(listener);
  }

  private notifyDialog() {
    this.dialogListeners.forEach((fn) => fn(this.currentDialog));
  }

  private notifyToasts() {
    this.toastListeners.forEach((fn) => fn([...this.toasts]));
  }

  /**
   * Shows an in-app Alert modal (replacing window.alert)
   */
  public alert(message: string, options?: Partial<InAppAlertOptions>): Promise<void> {
    return new Promise((resolve) => {
      const type = options?.type || (options?.title?.includes('خطأ') || message.includes('فشل') || message.includes('خطأ') ? 'error' : 'info');
      
      if (options?.playSound !== false) {
        try {
          if (type === 'error' || type === 'danger') {
            audioSynth.playTone('error');
          } else if (type === 'success') {
            audioSynth.playTone('success');
          } else {
            audioSynth.playTone('warning');
          }
        } catch {
          // Ignore audio errors
        }
      }

      this.currentDialog = {
        id: Math.random().toString(36).substring(2),
        message,
        title: options?.title || (type === 'error' ? 'تنبيه خطأ' : type === 'warning' ? 'تحذير هام' : 'تنبيه النظام'),
        type,
        confirmText: options?.confirmText || 'حسناً، فهمت',
        showCancel: false,
        onConfirm: () => {
          this.currentDialog = null;
          this.notifyDialog();
          options?.onConfirm?.();
          resolve();
        },
        onCancel: () => {
          this.currentDialog = null;
          this.notifyDialog();
          options?.onCancel?.();
          resolve();
        },
      };

      this.notifyDialog();
    });
  }

  /**
   * Shows an in-app Confirmation modal (replacing window.confirm)
   */
  public confirm(message: string, options?: Partial<InAppAlertOptions>): Promise<boolean> {
    return new Promise((resolve) => {
      const isDangerous = options?.type === 'danger' || message.includes('حذف') || message.includes('إلغاء') || message.includes('مسح');
      const type: InAppAlertType = options?.type || (isDangerous ? 'danger' : 'question');

      if (options?.playSound !== false) {
        try {
          if (type === 'danger' || type === 'error') {
            audioSynth.playTone('warning');
          } else {
            audioSynth.playTone('info');
          }
        } catch {
          // Ignore audio error
        }
      }

      this.resolveConfirm = resolve;

      this.currentDialog = {
        id: Math.random().toString(36).substring(2),
        message,
        title: options?.title || (isDangerous ? 'تأكيد الإجراء الهام' : 'تأكيد الطلب'),
        type,
        confirmText: options?.confirmText || (isDangerous ? 'نعم، تأكيد التنفيذ' : 'تأكيد'),
        cancelText: options?.cancelText || 'إلغاء وتراجع',
        showCancel: true,
        checkboxLabel: options?.checkboxLabel,
        onConfirm: (checked) => {
          this.currentDialog = null;
          this.notifyDialog();
          options?.onConfirm?.(checked);
          if (this.resolveConfirm) {
            this.resolveConfirm(true);
            this.resolveConfirm = null;
          }
        },
        onCancel: () => {
          this.currentDialog = null;
          this.notifyDialog();
          options?.onCancel?.();
          if (this.resolveConfirm) {
            this.resolveConfirm(false);
            this.resolveConfirm = null;
          }
        },
      };

      this.notifyDialog();
    });
  }

  /**
   * Shows a toast notification inside the project
   */
  public toast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', durationMs = 3500) {
    const id = Math.random().toString(36).substring(2);
    const newToast: InAppToastOptions = { id, message, type, durationMs };
    
    this.toasts.push(newToast);
    this.notifyToasts();

    setTimeout(() => {
      this.removeToast(id);
    }, durationMs);
  }

  public removeToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notifyToasts();
  }

  public closeDialog() {
    if (this.currentDialog) {
      if (this.currentDialog.onCancel) {
        this.currentDialog.onCancel();
      } else {
        this.currentDialog = null;
        this.notifyDialog();
      }
    }
  }

  /**
   * Override window.alert globally so existing codebase alert(...) calls
   * immediately become beautiful in-app alerts!
   */
  private setupGlobalOverrides() {
    if (typeof window === 'undefined') return;

    // Attach to window object for convenient debugging or external hooks
    (window as any).inAppAlert = (msg: string, opts?: any) => this.alert(msg, opts);
    (window as any).inAppConfirm = (msg: string, opts?: any) => this.confirm(msg, opts);
    (window as any).inAppToast = (msg: string, type?: any, dur?: any) => this.toast(msg, type, dur);

    // Save native handles if needed
    (window as any).__nativeAlert = window.alert;
    (window as any).__nativeConfirm = window.confirm;

    // Intercept window.alert completely
    window.alert = (message?: any) => {
      this.alert(String(message ?? ''));
    };

    // Note for window.confirm: Since native confirm is synchronously blocking,
    // we route to an in-app alert warning if called synchronously without await,
    // and provide inAppConfirm for true async promises.
  }
}

export const inAppAlertManager = new InAppAlertManager();

export const inAppAlert = (message: string, options?: Partial<InAppAlertOptions>) =>
  inAppAlertManager.alert(message, options);

export const inAppConfirm = (message: string, options?: Partial<InAppAlertOptions>) =>
  inAppAlertManager.confirm(message, options);

export const inAppToast = (
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  durationMs = 3500
) => inAppAlertManager.toast(message, type, durationMs);
