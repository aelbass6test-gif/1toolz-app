import { useState, useEffect, useCallback } from 'react';
import { cfFetch } from '../services/cloudflareClient';
import * as db from '../services/databaseService';
import { StoreData, User, Settings } from '../types';

export interface PlatformSupportConfig {
  whatsapp: string;
  phone: string;
  defaultAgentName: string;
  defaultAgentTitle: string;
  updatedAt?: string;
}

const STORAGE_PHONE_KEY = 'platform_support_phone';
const STORAGE_AGENT_NAME_KEY = 'platform_support_agent_name';
const STORAGE_AGENT_TITLE_KEY = 'platform_support_agent_title';
const SUPPORT_UPDATED_EVENT = 'platform-support-updated';

export const normalizeWhatsappDigits = (rawPhone: string): string => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '201000000000';
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`;
  }
  if (digits.startsWith('20')) {
    return digits;
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `20${digits}`;
  }
  return digits;
};

export const buildSupportWhatsAppUrl = (rawPhone: string, message?: string): string => {
  const cleanIntl = normalizeWhatsappDigits(rawPhone);
  if (!message) {
    return `https://wa.me/${cleanIntl}`;
  }
  return `https://wa.me/${cleanIntl}?text=${encodeURIComponent(message)}`;
};

export const getCachedPlatformSupportPhone = (fallback: string = '01000000000'): string => {
  try {
    const saved = localStorage.getItem(STORAGE_PHONE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return fallback;
};

export const getCachedPlatformSupportAgent = (fallbackName: string = 'أحمد — الدعم الفني') => {
  try {
    const name = localStorage.getItem(STORAGE_AGENT_NAME_KEY) || fallbackName;
    const title = localStorage.getItem(STORAGE_AGENT_TITLE_KEY) || 'فريق الدعم الفني';
    return { name, title };
  } catch {
    return { name: fallbackName, title: 'فريق الدعم الفني' };
  }
};

export const fetchPlatformSupportConfig = async (
  fallbackPhone: string = '01000000000',
  fallbackAgentName: string = 'أحمد — الدعم الفني'
): Promise<PlatformSupportConfig> => {
  try {
    const res = await cfFetch<any>('/api/db/settings/platform_support_contact');
    const val = res?.value || res || {};
    const phone = String(val.whatsapp || val.phone || '').trim() || getCachedPlatformSupportPhone(fallbackPhone);
    const defaultAgentName = String(val.defaultAgentName || '').trim() || fallbackAgentName;
    const defaultAgentTitle = String(val.defaultAgentTitle || '').trim() || 'فريق الدعم الفني';

    try {
      if (phone) localStorage.setItem(STORAGE_PHONE_KEY, phone);
      if (defaultAgentName) localStorage.setItem(STORAGE_AGENT_NAME_KEY, defaultAgentName);
      if (defaultAgentTitle) localStorage.setItem(STORAGE_AGENT_TITLE_KEY, defaultAgentTitle);
    } catch {}

    return {
      whatsapp: phone,
      phone,
      defaultAgentName,
      defaultAgentTitle,
      updatedAt: val.updatedAt
    };
  } catch {
    const cachedPhone = getCachedPlatformSupportPhone(fallbackPhone);
    const cachedAgent = getCachedPlatformSupportAgent(fallbackAgentName);
    return {
      whatsapp: cachedPhone,
      phone: cachedPhone,
      defaultAgentName: cachedAgent.name,
      defaultAgentTitle: cachedAgent.title
    };
  }
};

export const saveProjectWideSupportConfig = async (params: {
  phone: string;
  defaultAgentName?: string;
  defaultAgentTitle?: string;
  users?: User[];
  allStoresData?: Record<string, StoreData>;
  setAllStoresData?: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
}): Promise<void> => {
  const cleanPhone = params.phone.trim();
  const agentName = (params.defaultAgentName || getCachedPlatformSupportAgent().name).trim();
  const agentTitle = (params.defaultAgentTitle || getCachedPlatformSupportAgent().title).trim();
  const updatedAt = new Date().toISOString();

  try {
    localStorage.setItem(STORAGE_PHONE_KEY, cleanPhone);
    if (agentName) localStorage.setItem(STORAGE_AGENT_NAME_KEY, agentName);
    if (agentTitle) localStorage.setItem(STORAGE_AGENT_TITLE_KEY, agentTitle);
    window.dispatchEvent(new CustomEvent(SUPPORT_UPDATED_EVENT, {
      detail: { phone: cleanPhone, defaultAgentName: agentName, defaultAgentTitle: agentTitle }
    }));
  } catch {}

  // 1. Save in central Cloudflare D1 app_settings
  await cfFetch('/api/db/settings/platform_support_contact', {
    method: 'PUT',
    body: JSON.stringify({
      value: {
        whatsapp: cleanPhone,
        phone: cleanPhone,
        defaultAgentName: agentName,
        defaultAgentTitle: agentTitle,
        updatedAt
      }
    })
  });

  // 2. Update active global settings state if provided
  if (params.setSettings) {
    params.setSettings(prev => ({
      ...prev,
      supportPhone: cleanPhone
    } as any));
  }

  // 3. Propagate supportPhone across all stores in memory & Cloudflare D1 so every portal/storefront uses it
  if (params.allStoresData && params.setAllStoresData) {
    const nextMap: Record<string, StoreData> = {};
    const storeList = (params.users || []).flatMap(u => u.stores || []);

    Object.entries(params.allStoresData).forEach(([storeId, storeData]) => {
      if (!storeData) return;
      nextMap[storeId] = {
        ...storeData,
        settings: {
          ...storeData.settings,
          supportPhone: cleanPhone
        } as any
      };
    });

    params.setAllStoresData(prev => ({ ...prev, ...nextMap }));

    await Promise.all(
      Object.entries(nextMap).map(([storeId, updatedStoreData]) => {
        const meta =
          storeList.find(s => s.id === storeId) ||
          ({ id: storeId, name: (updatedStoreData.settings as any)?.storeName || storeId } as any);
        return db.saveStoreData(meta, updatedStoreData).catch(() => {});
      })
    );
  }
};

export const usePlatformSupport = (fallbackPhone: string = '01000000000') => {
  const [supportPhone, setSupportPhone] = useState<string>(() =>
    getCachedPlatformSupportPhone(fallbackPhone)
  );
  const [agentName, setAgentName] = useState<string>(
    () => getCachedPlatformSupportAgent().name
  );
  const [agentTitle, setAgentTitle] = useState<string>(
    () => getCachedPlatformSupportAgent().title
  );

  const refresh = useCallback(async () => {
    const cfg = await fetchPlatformSupportConfig(fallbackPhone);
    if (cfg.phone) setSupportPhone(cfg.phone);
    if (cfg.defaultAgentName) setAgentName(cfg.defaultAgentName);
    if (cfg.defaultAgentTitle) setAgentTitle(cfg.defaultAgentTitle);
  }, [fallbackPhone]);

  useEffect(() => {
    void refresh();
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.phone) setSupportPhone(detail.phone);
      else setSupportPhone(getCachedPlatformSupportPhone(fallbackPhone));
      if (detail?.defaultAgentName) setAgentName(detail.defaultAgentName);
      if (detail?.defaultAgentTitle) setAgentTitle(detail.defaultAgentTitle);
    };
    window.addEventListener(SUPPORT_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(SUPPORT_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fallbackPhone, refresh]);

  const openSupportWhatsApp = useCallback(
    (message?: string) => {
      const url = buildSupportWhatsAppUrl(supportPhone, message);
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [supportPhone]
  );

  return {
    supportPhone,
    supportWhatsapp: normalizeWhatsappDigits(supportPhone),
    agentName,
    agentTitle,
    openSupportWhatsApp,
    buildUrl: (message?: string) => buildSupportWhatsAppUrl(supportPhone, message),
    refresh
  };
};
