import { getSupabaseClient } from './databaseService';
import LZString from 'lz-string';

export const shareReport = async (htmlContent: string): Promise<string> => {
  const compressedHtml = LZString.compressToBase64(htmlContent);
  const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('shared_reports').insert({
      id,
      content: compressedHtml,
      created_at: new Date().toISOString()
    }).catch((err) => console.warn('Supabase report share fallback to localStorage:', err));
  }
  
  try {
    localStorage.setItem(`shared_report_${id}`, compressedHtml);
  } catch (_) {}

  return id;
};

export const getSharedReport = async (id: string): Promise<string | null> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from('shared_reports').select('content').eq('id', id).maybeSingle();
    if (data?.content) {
      return LZString.decompressFromBase64(data.content);
    }
  }

  const local = localStorage.getItem(`shared_report_${id}`);
  if (local) {
    return LZString.decompressFromBase64(local);
  }

  return null;
};
