import { getSupabaseClient } from './databaseService';

export interface ProductImageUploadResult {
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function mediaApiBase(): string {
  return (import.meta.env.VITE_MEDIA_API_URL || 'https://app.abdomedi.com').replace(/\/$/, '');
}

export async function uploadProductImages(
  files: File[],
  params: { storeId: string; productId?: string }
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

  const response = await fetch(`${mediaApiBase()}/api/media/product-images`, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'تعذر رفع صور المنتج');
  }
  return data.images || [];
}
