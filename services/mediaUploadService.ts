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

  const headers: Record<string, string> = {};
  const supabase = getSupabaseClient();
  const session = (await supabase?.auth.getSession())?.data.session;
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  return new Promise<ProductImageUploadResult[]>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${mediaApiBase()}/api/media/product-images`);
    xhr.withCredentials = true;
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
