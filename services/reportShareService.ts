import { getSupabaseClient } from './databaseService';
import { db } from './firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LZString from 'lz-string';

export const shareReport = async (htmlContent: string): Promise<string> => {
  const compressedHtml = LZString.compressToBase64(htmlContent);
  const id = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // 1. Sync via Server API
  try {
    fetch('/api/shared-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content: compressedHtml })
    }).catch((err) => console.warn('Server API report share fallback:', err));
  } catch (_) {}

  // 2. Sync via Firestore Client directly
  try {
    if (db) {
      const docRef = doc(db, 'shared_reports', id);
      setDoc(docRef, {
        id,
        content: compressedHtml,
        createdAt: new Date().toISOString()
      }, { merge: true }).catch((err) => console.warn('Firestore direct write fallback:', err));
    }
  } catch (_) {}

  // 3. Sync via Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('shared_reports').insert({
        id,
        content: compressedHtml,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Supabase report share fallback:', err);
    }
  }
  
  // 4. LocalStorage fallback
  try {
    localStorage.setItem(`shared_report_${id}`, compressedHtml);
  } catch (_) {}

  return id;
};

export const getSharedReport = async (id: string): Promise<string | null> => {
  if (!id) return null;

  // 1. Try fetching from Server API
  try {
    const res = await fetch(`/api/shared-reports/${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.content) {
        const decompressed = LZString.decompressFromBase64(data.content);
        if (decompressed) return decompressed;
      }
    }
  } catch (_) {}

  // 2. Try fetching from Firestore directly
  try {
    if (db) {
      const docRef = doc(db, 'shared_reports', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data?.content) {
          const decompressed = LZString.decompressFromBase64(data.content);
          if (decompressed) return decompressed;
        }
      }
    }
  } catch (_) {}

  // 3. Try fetching from Supabase
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.from('shared_reports').select('content').eq('id', id).maybeSingle();
      if (data?.content) {
        const decompressed = LZString.decompressFromBase64(data.content);
        if (decompressed) return decompressed;
      }
    }
  } catch (_) {}

  // 4. Try fetching from LocalStorage
  try {
    const local = localStorage.getItem(`shared_report_${id}`);
    if (local) {
      const decompressed = LZString.decompressFromBase64(local);
      if (decompressed) return decompressed;
    }
  } catch (_) {}

  return null;
};

