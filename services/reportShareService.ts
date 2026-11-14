import { cfFetch } from './cloudflareClient';
import LZString from 'lz-string';

export const shareReport = async (htmlContent: string): Promise<string> => {
  const compressedHtml = LZString.compressToBase64(htmlContent);
  const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 1. Persist to Cloudflare D1 via Server/Worker API
  try {
    await cfFetch('/api/shared-reports', {
      method: 'POST',
      body: JSON.stringify({ id, content: compressedHtml })
    }).catch((err) => console.warn('Cloudflare shared report write notice:', err));
  } catch (_) {}

  // 2. LocalStorage fallback
  try {
    localStorage.setItem(`shared_report_${id}`, compressedHtml);
  } catch (_) {}

  return id;
};

export const getSharedReport = async (id: string): Promise<string | null> => {
  if (!id) return null;

  // 1. Try fetching from Cloudflare D1 API
  try {
    const data = await cfFetch<any>(`/api/shared-reports/${encodeURIComponent(id)}`);
    if (data?.content) {
      const decompressed = LZString.decompressFromBase64(data.content);
      if (decompressed) return decompressed;
    }
  } catch (_) {}

  // 2. Try fetching from LocalStorage
  try {
    const local = localStorage.getItem(`shared_report_${id}`);
    if (local) {
      const decompressed = LZString.decompressFromBase64(local);
      if (decompressed) return decompressed;
    }
  } catch (_) {}

  return null;
};
