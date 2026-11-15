/**
 * Cloudflare D1 & Worker Auth Client SDK
 * Replaces all Firebase Auth/Firestore and Supabase calls with unified Cloudflare API requests.
 */

const CF_AUTH_TOKEN_KEY = 'cf_auth_token';
const CF_AUTH_USER_KEY = 'cf_auth_user';

export function getCfApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    // Always use same-origin relative requests on AI Studio preview (*.run.app) and localhost
    if (host.endsWith('.run.app') || host === 'localhost' || host === '127.0.0.1') {
      return window.location.origin.replace(/\/$/, '');
    }
  }
  const configured = (import.meta as any).env?.VITE_CLOUDFLARE_API_URL;
  if (configured && typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

export function getCfAuthToken(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CF_AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setCfAuthToken(token: string | null, user?: any): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem(CF_AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(CF_AUTH_TOKEN_KEY);
    }
    if (user !== undefined) {
      if (user) {
        const sanitized = { ...user };
        delete sanitized.password;
        delete sanitized.password_hash;
        localStorage.setItem(CF_AUTH_USER_KEY, JSON.stringify(sanitized));
      } else {
        localStorage.removeItem(CF_AUTH_USER_KEY);
      }
    }
  } catch {
    // Ignore storage quota issues
  }
}

export function clearCfAuthToken(): void {
  setCfAuthToken(null, null);
}

export function getStoredCfAuthUser<T = any>(): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(CF_AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cfFetch<T = any>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 15000, headers: customHeaders, ...rest } = options;
  const normalizedPath = path.startsWith('http') ? path : (path.startsWith('/') ? path : `/${path}`);
  const base = getCfApiBaseUrl();
  const primaryUrl = path.startsWith('http') ? path : `${base}${normalizedPath}`;

  const headers = new Headers(customHeaders || {});
  if (!headers.has('Content-Type') && !(rest.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getCfAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const executeAttempt = async (targetUrl: string): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(targetUrl, {
        ...rest,
        headers,
        signal: rest.signal || controller.signal
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: res.ok, raw: text };
      }
      if (!res.ok) {
        const err: any = new Error(data?.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.code = data?.code;
        err.data = data;
        throw err;
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await executeAttempt(primaryUrl);
  } catch (err: any) {
    // If transient network fetch error ("Failed to fetch"), wait 450ms and retry once (using relative path if origin differs)
    const isNetworkError =
      !err?.status &&
      (err?.name === 'TypeError' || String(err?.message || '').toLowerCase().includes('failed to fetch'));
    if (isNetworkError && !rest.signal?.aborted) {
      await new Promise(resolve => setTimeout(resolve, 450));
      const fallbackUrl =
        typeof window !== 'undefined' && !path.startsWith('http')
          ? `${window.location.origin.replace(/\/$/, '')}${normalizedPath}`
          : primaryUrl;
      return await executeAttempt(fallbackUrl);
    }
    throw err;
  }
}

export async function cfAuthLogin(identifier: string, password: string): Promise<{ success: boolean; user: any; token: string }> {
  const res = await cfFetch<{ success: boolean; user: any; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, phone: identifier, password })
  });
  if (res.token) {
    setCfAuthToken(res.token, res.user);
  }
  return res;
}

export async function cfAuthSignup(payload: {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  stores?: any[];
  sites?: any[];
  isAdmin?: boolean;
}): Promise<{ success: boolean; user: any; token: string }> {
  const res = await cfFetch<{ success: boolean; user: any; token: string }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (res.token) {
    setCfAuthToken(res.token, res.user);
  }
  return res;
}

export async function cfAuthEmployeeLogin(
  storeId: string,
  phoneOrEmail: string,
  password: string
): Promise<{ success: boolean; token: string; storeId: string; storeName: string; employee: any; user?: any }> {
  const res = await cfFetch<{ success: boolean; token: string; storeId: string; storeName: string; employee: any; user?: any }>(
    '/api/auth/employee-login',
    {
      method: 'POST',
      body: JSON.stringify({ storeId, phone: phoneOrEmail, password })
    }
  );
  if (res.token) {
    setCfAuthToken(res.token, res.user || res.employee);
  }
  return res;
}

export async function cfAuthCreateUser(payload: {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  storeId?: string;
  isAdmin?: boolean;
}): Promise<{ success: boolean; user: any }> {
  return cfFetch('/api/auth/admin-create-user', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function cfAuthUpdatePassword(params: {
  phone?: string;
  storeId?: string;
  newPassword: string;
  adminOverride?: boolean;
}): Promise<{ success: boolean; message?: string }> {
  return cfFetch('/api/auth/update-password', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function cfAuthRequestPasswordReset(emailOrPhone: string): Promise<{
  success: boolean;
  token: string;
  code: string;
  email: string;
  phone: string;
}> {
  return cfFetch('/api/auth/request-reset', {
    method: 'POST',
    body: JSON.stringify({ email: emailOrPhone, phone: emailOrPhone })
  });
}

export async function cfAuthLogout(): Promise<void> {
  try {
    await cfFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  }
  clearCfAuthToken();
}

export function subscribePolling<T>(
  fetcher: () => Promise<T>,
  onData: (data: T) => void,
  intervalMs: number = 12000,
  onError?: (err: any) => void
): () => void {
  let active = true;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveErrors = 0;

  const scheduleNext = (delayMs: number) => {
    if (!active) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!active) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        scheduleNext(delayMs);
        return;
      }
      void tick();
    }, delayMs);
  };

  const tick = async () => {
    if (!active || inFlight) return;
    inFlight = true;
    try {
      const data = await fetcher();
      consecutiveErrors = 0;
      if (active) onData(data);
      scheduleNext(intervalMs);
    } catch (err) {
      consecutiveErrors += 1;
      if (active && onError) onError(err);
      const backoffMs = Math.min(Math.max(intervalMs, 15000) * Math.pow(2, Math.min(consecutiveErrors - 1, 2)), 60000);
      scheduleNext(backoffMs);
    } finally {
      inFlight = false;
    }
  };

  void tick();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
  };
}
