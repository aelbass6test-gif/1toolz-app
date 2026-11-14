/**
 * Cloudflare D1 & Worker Auth Client SDK
 * Replaces all Firebase Auth/Firestore and Supabase calls with unified Cloudflare API requests.
 */

const CF_AUTH_TOKEN_KEY = 'cf_auth_token';
const CF_AUTH_USER_KEY = 'cf_auth_user';

export function getCfApiBaseUrl(): string {
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
  const base = getCfApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(customHeaders || {});
  if (!headers.has('Content-Type') && !(rest.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getCfAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
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
  let timer: any = null;

  const tick = async () => {
    if (!active) return;
    try {
      const data = await fetcher();
      if (active) onData(data);
    } catch (err) {
      if (active && onError) onError(err);
    }
  };

  void tick();
  timer = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      void tick();
    }
  }, intervalMs);

  return () => {
    active = false;
    if (timer) clearInterval(timer);
  };
}
