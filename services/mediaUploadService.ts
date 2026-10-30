import { getSupabaseClient } from './databaseService';

export interface ProductImageUploadResult {
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const WEBP_QUALITY = 0.82;
const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function mediaApiBase(): string {
  return (import.meta.env.VITE_MEDIA_API_URL || 'https://app.abdomedi.com').replace(/\/$/, '');
}

export async function compressProductImages(files: File[]): Promise<File[]> {
  const prepared: File[] = [];

  for (const file of files) {
    if (!file.type.startsWith('image/')) throw new Error(`الملف ${file.name} ليس صورة`);
    if (file.size > MAX_IMAGE_SIZE) throw new Error(`حجم الصورة ${file.name} أكبر من 10 ميجابايت`);
    if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type) || typeof createImageBitmap === 'undefined') {
      prepared.push(file);
      continue;
    }

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size <= 250 * 1024) {
        prepared.push(file);
        continue;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        prepared.push(file);
        continue;
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
      if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) {
        prepared.push(file);
        continue;
      }

      const originalName = file.name.replace(/\.[^.]+$/, '') || 'product-image';
      prepared.push(new File([blob], `${originalName}.webp`, { type: 'image/webp', lastModified: file.lastModified }));
    } catch {
      // Keep the original when this browser cannot decode or convert the image.
      prepared.push(file);
    } finally {
      bitmap?.close();
    }
  }

  return prepared;
}

function sendUploadRequest(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress?: (percent: number) => void
): Promise<ProductImageUploadResult[]> {
  return new Promise<ProductImageUploadResult[]>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    // Note: Do NOT set withCredentials = true when sending Bearer token across origins,
    // because CORS with wildcard Access-Control-Allow-Origin: * strictly forbids credentials.
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });

    xhr.addEventListener('load', () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }

      if (xhr.status < 200 || xhr.status >= 300 || !data?.success) {
        reject(new Error(data?.error || 'تعذر رفع صور المنتج'));
        return;
      }
      resolve(data.images || []);
    });
    xhr.addEventListener('error', () => reject(new Error('تعذر الاتصال بخادم رفع الصور')));
    xhr.addEventListener('timeout', () => reject(new Error('انتهت مهلة رفع الصور؛ حاول مرة أخرى')));
    xhr.send(form);
  });
}

export async function uploadProductImages(
  files: File[],
  params: { storeId: string; productId?: string },
  onProgress?: (percent: number) => void
): Promise<ProductImageUploadResult[]> {
  if (!files.length) return [];
  if (!params.storeId) throw new Error('معرّف المتجر غير متوفر');

  const form = new FormData();
  form.append('storeId', params.storeId);
  if (params.productId) form.append('productId', params.productId);

  for (const file of files) {
    if (!file.type.startsWith('image/')) throw new Error(`الملف ${file.name} ليس صورة`);
    if (file.size > MAX_IMAGE_SIZE) throw new Error(`حجم الصورة ${file.name} أكبر من 10 ميجابايت`);
    form.append('files', file, file.name);
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('إعدادات Supabase غير متاحة.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error('يجب تسجيل الدخول بحساب Supabase قبل رفع الصور.');
  const accessToken = session.access_token;
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };

  const primaryUrl = `${mediaApiBase()}/api/media/product-images`;
  try {
    return await sendUploadRequest(primaryUrl, form, headers, onProgress);
  } catch (primaryErr: any) {
    // If running in development/preview on a different domain, fallback to local proxy route
    if (typeof window !== 'undefined' && primaryUrl.startsWith('http') && !primaryUrl.startsWith(window.location.origin)) {
      try {
        return await sendUploadRequest('/api/media/product-images', form, headers, onProgress);
      } catch {
        // Retain original error if fallback also fails
      }
    }
    throw primaryErr;
  }
}

/**
 * Extracts the storage key from a media URL or raw key.
 * Returns null if the URL is not hosted on our R2 storage.
 */
export function extractMediaStorageKey(urlOrKey: string): string | null {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  let raw = urlOrKey.trim();
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw);
      raw = parsed.pathname;
    }
  } catch {
    // If not a parseable URL, assume it's already a relative path or key
  }
  raw = decodeURIComponent(raw).replace(/^\/+/, '');
  if (raw.startsWith('images/') && !raw.includes('..')) {
    return raw;
  }
  return null;
}

/**
 * Deletes a single product image from Cloudflare R2 storage to save disk space.
 */
export async function deleteProductImage(imageUrlOrKey: string): Promise<boolean> {
  const key = extractMediaStorageKey(imageUrlOrKey);
  if (!key) {
    // Not on our R2 media storage (e.g. external URL or data URL)
    return false;
  }
  return deleteProductImages([imageUrlOrKey]);
}

/**
 * Deletes multiple product images in batch from Cloudflare R2 storage.
 */
export async function deleteProductImages(imageUrlsOrKeys: string[]): Promise<boolean> {
  const keys = imageUrlsOrKeys
    .map(extractMediaStorageKey)
    .filter((k): k is string => Boolean(k));

  if (!keys.length) return false;

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('إعدادات Supabase غير متاحة.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error('يجب تسجيل الدخول بحساب Supabase قبل حذف الصور.');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`
  };

  const payload = JSON.stringify({ keys, urls: imageUrlsOrKeys });
  const primaryUrl = `${mediaApiBase()}/api/media/product-images`;

  try {
    const res = await fetch(primaryUrl, {
      method: 'DELETE',
      headers,
      body: payload
    });
    if (res.ok) return true;
  } catch (primaryErr) {
    // Fallback to dev server proxy route if on different origin
    if (typeof window !== 'undefined' && primaryUrl.startsWith('http') && !primaryUrl.startsWith(window.location.origin)) {
      try {
        const fallbackRes = await fetch('/api/media/product-images', {
          method: 'DELETE',
          headers,
          body: payload
        });
        if (fallbackRes.ok) return true;
      } catch {
        // Fallback also failed
      }
    }
  }
  return false;
}

