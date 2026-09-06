import React, { useState, useMemo } from 'react';
import { Settings, StoreApiKey, ApiKeyScope } from '../types';
import { 
  Key, Plus, Shield, Check, Copy, CheckCircle2, AlertTriangle, 
  Trash2, RefreshCw, Eye, EyeOff, Lock, Globe, Code, ExternalLink, 
  Calendar, Layers, CheckSquare, Square, Zap, Info, ArrowRight, Clock,
  Smartphone, Database, ShoppingBag, Users, FileSpreadsheet, Send,
  Truck, MessageSquare, ShoppingCart, Search, Filter, Sparkles,
  CheckCheck, X
} from 'lucide-react';
import { audioSynth } from '../utils/audioSynth';

interface ApiKeysManagerProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStoreId?: string;
  hostUrl?: string;
}

export type ScopeCategory = 
  | 'orders' 
  | 'shipping' 
  | 'whatsapp' 
  | 'abandoned_carts' 
  | 'products' 
  | 'inventory' 
  | 'customers' 
  | 'reports' 
  | 'webhooks';

export interface ScopeDefinition {
  id: ApiKeyScope;
  name: string;
  description: string;
  category: ScopeCategory;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  isDangerous?: boolean;
  recommendedTag?: string;
}

export const SCOPE_DEFINITIONS: ScopeDefinition[] = [
  // --- 1. الطلبات والمبيعات (Orders) ---
  { 
    id: 'orders:read', 
    name: 'استعلام وقراءة الطلبات', 
    description: 'جلب قائمة الطلبات، البحث بالاسم والهاتف، استعراض بيانات العميل، وحالات التجهيز', 
    category: 'orders',
    method: 'GET',
    endpoint: '/api/v1/orders'
  },
  { 
    id: 'orders:write', 
    name: 'إنشاء وتعديل الطلبات', 
    description: 'إضافة طلبات جديدة من المنصات الخارجية وتحديث بيانات العميل، المنتجات، والعناوين', 
    category: 'orders',
    method: 'POST',
    endpoint: '/api/v1/orders'
  },
  { 
    id: 'orders:confirm', 
    name: 'تأكيد واعتماد الطلبات', 
    description: 'تغيير حالة الطلب إلى "مؤكد" وتسجيل وقت التأكيد (مطلوب للربط مع منصة أكد وواتساب)', 
    category: 'orders',
    method: 'POST',
    endpoint: '/api/v1/orders/:id/confirm',
    recommendedTag: 'أكد'
  },
  { 
    id: 'orders:status', 
    name: 'تحديث مسار وحالات الطلب', 
    description: 'تحديث حالة الطلب (قيد التجهيز، تم الشحن، تم التوصيل، ملغي، مرتجع) مع الملاحظات', 
    category: 'orders',
    method: 'PATCH',
    endpoint: '/api/v1/orders/:id',
    recommendedTag: 'شحن'
  },
  { 
    id: 'orders:delete', 
    name: 'حذف وأرشفة الطلبات', 
    description: 'حذف الطلب نهائياً من قاعدة بيانات المتجر (صلاحية حساسة للمديرين فقط)', 
    category: 'orders',
    method: 'DELETE',
    endpoint: '/api/v1/orders/:id',
    isDangerous: true 
  },

  // --- 2. الشحن والتوصيل (Shipping & Logistics) ---
  { 
    id: 'shipping:read', 
    name: 'استعراض بيانات وبوالص الشحن', 
    description: 'استخراج شحنات اليوم، عناوين التسليم، هواتف المستلمين، وقوائم التوزيع للمناديب', 
    category: 'shipping',
    method: 'GET',
    endpoint: '/api/v1/shipping/orders',
    recommendedTag: 'شحن'
  },
  { 
    id: 'shipping:write', 
    name: 'إصدار وتحديث بوالص الشحن والتتبع', 
    description: 'ربط رقم البوليصة والتتبع AWB، تعيين شركة الشحن أو المندوب، وتحديث أجور التوصيل', 
    category: 'shipping',
    method: 'PATCH',
    endpoint: '/api/v1/shipping/orders/:id',
    recommendedTag: 'شحن'
  },

  // --- 3. الواتساب والإشعارات (WhatsApp & Messaging) ---
  { 
    id: 'messages:send', 
    name: 'إرسال رسائل وتأكيدات الواتساب', 
    description: 'إرسال رسائل آلية وقوالب تأكيد الطلبات، التتبع، وروابط السلات للعملاء لحظياً', 
    category: 'whatsapp',
    method: 'POST',
    endpoint: '/api/v1/messages/send',
    recommendedTag: 'أكد'
  },
  { 
    id: 'messages:read', 
    name: 'استعراض سجل الرسائل والمراسلات', 
    description: 'الاطلاع على تاريخ الرسائل المرسلة للعملاء وحالة التسليم وتفاصيل الإرسال', 
    category: 'whatsapp',
    method: 'GET',
    endpoint: '/api/v1/messages/logs'
  },

  // --- 4. السلات المتروكة (Abandoned Carts) ---
  { 
    id: 'abandoned_carts:read', 
    name: 'قراءة السلات المتروكة', 
    description: 'استعراض سلات التسوق التي لم تكتمل، أرقام هواتف العملاء، وقيمة المنتجات المتروكة', 
    category: 'abandoned_carts',
    method: 'GET',
    endpoint: '/api/v1/abandoned-carts',
    recommendedTag: 'أكد'
  },
  { 
    id: 'abandoned_carts:recover', 
    name: 'استرجاع السلات بروابط الشراء', 
    description: 'توليد وإرسال روابط استكمال الدفع وقسائم التخفيض المخصصة للعملاء', 
    category: 'abandoned_carts',
    method: 'POST',
    endpoint: '/api/v1/abandoned-carts/recover'
  },

  // --- 5. المنتجات والكتالوج (Products) ---
  { 
    id: 'products:read', 
    name: 'قراءة كتالوج المنتجات', 
    description: 'استعراض قائمة المنتجات والأسعار والتصنيفات، الصور، الباركود، والـ SKU', 
    category: 'products',
    method: 'GET',
    endpoint: '/api/v1/products'
  },
  { 
    id: 'products:write', 
    name: 'إنشاء وتعديل المنتجات', 
    description: 'إضافة منتجات جديدة وتحديث أسعار البيع والتكلفة، الوصف، والخيارات والمواصفات', 
    category: 'products',
    method: 'POST',
    endpoint: '/api/v1/products'
  },
  { 
    id: 'products:delete', 
    name: 'حذف المنتجات من الكتالوج', 
    description: 'حذف المنتجات نهائياً من متجرك (صلاحية حساسة تتطلب الحذر)', 
    category: 'products',
    method: 'DELETE',
    endpoint: '/api/v1/products/:id',
    isDangerous: true 
  },

  // --- 6. المخازن والمستودعات (Inventory) ---
  { 
    id: 'inventory:read', 
    name: 'قراءة أرصدة المخزون', 
    description: 'الاطلاع على الكميات المتوفرة في المستودعات، المنتجات المنتهية، وأرصدة الفروع', 
    category: 'inventory',
    method: 'GET',
    endpoint: '/api/v1/inventory'
  },
  { 
    id: 'inventory:write', 
    name: 'تسوية وحركات المخزون', 
    description: 'تعديل الكميات المتاحة، الصرف والإضافة، تسجيل نتائج الجرد، وحركات المستودعات', 
    category: 'inventory',
    method: 'POST',
    endpoint: '/api/v1/inventory/adjust'
  },

  // --- 7. العملاء والـ CRM (Customers) ---
  { 
    id: 'customers:read', 
    name: 'قراءة بيانات العملاء والـ CRM', 
    description: 'استعراض سجلات العملاء، أرقام الهواتف، العناوين، وإجمالي مبالغ المشتريات', 
    category: 'customers',
    method: 'GET',
    endpoint: '/api/v1/customers'
  },
  { 
    id: 'customers:write', 
    name: 'إنشاء وتعديل ملفات العملاء', 
    description: 'إضافة عملاء جدد، تحديث العناوين وأرقام الهواتف، وإدارة الملاحظات الخاصة بهم', 
    category: 'customers',
    method: 'POST',
    endpoint: '/api/v1/customers'
  },

  // --- 8. التقارير والأرباح (Reports) ---
  { 
    id: 'reports:read', 
    name: 'قراءة التقارير والمؤشرات المالية', 
    description: 'الاطلاع على إحصائيات المبيعات الإجمالية، الأرباح الصافية، وتكلفة الشحن والمصاريف', 
    category: 'reports',
    method: 'GET',
    endpoint: '/api/v1/reports/summary'
  },

  // --- 9. الـ Webhooks والربط اللحظي ---
  { 
    id: 'webhooks:manage', 
    name: 'إدارة اشتراكات الـ Webhooks', 
    description: 'تسجيل خطافات الويب وتعديل روابط الاستماع للأحداث الفورية (طلبات، شحن)', 
    category: 'webhooks',
    method: 'POST',
    endpoint: '/api/v1/webhooks'
  },
];

export const CATEGORY_INFO: Record<ScopeCategory, { title: string; icon: any; color: string; desc: string }> = {
  orders: { 
    title: 'الطلبات والمبيعات', 
    icon: ShoppingBag, 
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    desc: 'التحكم في الطلبات، الحالات، تأكيد الشراء، وتفاصيل المبيعات'
  },
  shipping: { 
    title: 'الشحن وشركات التوصيل', 
    icon: Truck, 
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    desc: 'بوالص الشحن، التتبع AWB، وتعيين المناديب وشركات التوصيل'
  },
  whatsapp: { 
    title: 'الواتساب والمراسلات (أكد)', 
    icon: MessageSquare, 
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    desc: 'إرسال الرسائل والتأكيدات اللحظية عبر الواتساب وقوالب الإشعارات'
  },
  abandoned_carts: { 
    title: 'السلات المتروكة', 
    icon: ShoppingCart, 
    color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
    desc: 'استعراض واسترجاع السلات التي لم يكمل العملاء طلبها'
  },
  products: { 
    title: 'المنتجات والكتالوج', 
    icon: Layers, 
    color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
    desc: 'الكتالوج، الأسعار، المواصفات، والباركود'
  },
  inventory: { 
    title: 'المستودعات والمخزون', 
    icon: Database, 
    color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    desc: 'أرصدة المستودعات، حركات الجرد، وتسوية الكميات'
  },
  customers: { 
    title: 'العملاء والـ CRM', 
    icon: Users, 
    color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
    desc: 'سجلات العملاء، الهواتف، العناوين، وسجل المشتريات'
  },
  reports: { 
    title: 'التقارير والمحاسبة', 
    icon: FileSpreadsheet, 
    color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
    desc: 'المؤشرات المالية، الأرباح، وإحصائيات المبيعات'
  },
  webhooks: { 
    title: 'Webhooks والربط اللحظي', 
    icon: Zap, 
    color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
    desc: 'استقبال وتوجيه الأحداث اللحظية للتطبيقات الخارجية'
  },
};

export const REAL_WORLD_PRESETS = [
  {
    id: 'akked',
    title: 'منصة أكد (Akked WhatsApp)',
    subtitle: 'تأكيد الطلبات بالسلة والواتساب واسترجاع السلات',
    badge: 'موصى به للواتساب',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    icon: MessageSquare,
    scopes: ['orders:read', 'orders:confirm', 'messages:send', 'abandoned_carts:read', 'customers:read'] as ApiKeyScope[],
    defaultName: 'منصة أكد (Akked.app)'
  },
  {
    id: 'shipping',
    title: 'شركات الشحن والتوصيل',
    subtitle: 'Bosta, Aramex, بوسطة, والمناديب',
    badge: 'لوجستيات',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    icon: Truck,
    scopes: ['orders:read', 'orders:status', 'shipping:read', 'shipping:write', 'customers:read'] as ApiKeyScope[],
    defaultName: 'تكامل شركة الشحن والتوصيل'
  },
  {
    id: 'mobile_pos',
    title: 'تطبيقات الجوال والـ POS',
    subtitle: 'نقاط البيع والمبيعات المباشرة بالمتجر',
    badge: 'نقاط البيع',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    icon: Smartphone,
    scopes: ['orders:read', 'orders:write', 'products:read', 'inventory:read', 'customers:read', 'customers:write'] as ApiKeyScope[],
    defaultName: 'تطبيق الجوال ونقاط البيع POS'
  },
  {
    id: 'erp',
    title: 'أنظمة المحاسبة والـ ERP',
    subtitle: 'دفترة, قيود, Odoo, Zoho Books',
    badge: 'محاسبة',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    icon: FileSpreadsheet,
    scopes: ['orders:read', 'products:read', 'inventory:read', 'customers:read', 'reports:read'] as ApiKeyScope[],
    defaultName: 'نظام المحاسبة والـ ERP'
  },
  {
    id: 'readonly',
    title: 'قراءة فقط (تحليلات ومراقبة)',
    subtitle: 'صلاحيات آمنة للاستعلام دون أي تعديل',
    badge: 'آمن جداً',
    badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    icon: Shield,
    scopes: [
      'orders:read', 
      'shipping:read', 
      'products:read', 
      'inventory:read', 
      'customers:read', 
      'messages:read', 
      'abandoned_carts:read', 
      'reports:read'
    ] as ApiKeyScope[],
    defaultName: 'مفتاح التحليلات والمراقبة (Read Only)'
  },
  {
    id: 'full',
    title: 'صلاحيات كاملة (Full Access)',
    subtitle: 'جميع الصلاحيات الإدارية في النظام',
    badge: 'مدير كامل',
    badgeColor: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    icon: Zap,
    scopes: SCOPE_DEFINITIONS.map(s => s.id),
    defaultName: 'مفتاح الصلاحيات الكاملة (Admin Key)'
  }
];

export const ApiKeysManager: React.FC<ApiKeysManagerProps> = ({
  settings,
  setSettings,
  activeStoreId,
  hostUrl = typeof window !== 'undefined' ? window.location.origin : ''
}) => {
  const apiKeys: StoreApiKey[] = settings.storeApiKeys || [];

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState(false);

  // Form State
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>([
    'orders:read',
    'orders:confirm',
    'messages:send',
    'abandoned_carts:read',
    'customers:read'
  ]);
  const [expirationDays, setExpirationDays] = useState<'never' | '30' | '90' | '365'>('never');
  const [keyNotes, setKeyNotes] = useState('');

  // Search & Filter within Modal
  const [scopeSearchQuery, setScopeSearchQuery] = useState('');
  const [activeFilterCategory, setActiveFilterCategory] = useState<string>('all');

  // Live Playground Test State
  const [testKeyInput, setTestKeyInput] = useState('');
  const [testEndpoint, setTestEndpoint] = useState<string>('/api/v1/validate-key');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const generateSecureKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint8Array(32);
      window.crypto.getRandomValues(buffer);
      for (let i = 0; i < 32; i++) {
        randomPart += chars[buffer[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 32; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return `ak_live_${randomPart}`;
  };

  const openCreateModal = () => {
    setKeyName('');
    setSelectedScopes([
      'orders:read',
      'orders:confirm',
      'messages:send',
      'abandoned_carts:read',
      'customers:read'
    ]);
    setExpirationDays('never');
    setKeyNotes('');
    setEditingKeyId(null);
    setScopeSearchQuery('');
    setActiveFilterCategory('all');
    setIsCreateModalOpen(true);
  };

  const openEditModal = (item: StoreApiKey) => {
    setKeyName(item.name);
    setSelectedScopes(item.permissions || []);
    setKeyNotes(item.notes || '');
    setEditingKeyId(item.id);
    setScopeSearchQuery('');
    setActiveFilterCategory('all');
    setIsCreateModalOpen(true);
  };

  const toggleScope = (scopeId: ApiKeyScope) => {
    setSelectedScopes(prev => 
      prev.includes(scopeId) ? prev.filter(s => s !== scopeId) : [...prev, scopeId]
    );
  };

  const applyPreset = (preset: typeof REAL_WORLD_PRESETS[0]) => {
    setSelectedScopes(preset.scopes);
    if (!keyName.trim() || !editingKeyId) {
      setKeyName(preset.defaultName);
    }
    audioSynth?.playCash?.();
  };

  const selectAllScopes = () => {
    setSelectedScopes(SCOPE_DEFINITIONS.map(s => s.id));
  };

  const clearAllScopes = () => {
    setSelectedScopes([]);
  };

  const toggleCategoryScopes = (catKey: ScopeCategory) => {
    const catScopeIds = SCOPE_DEFINITIONS.filter(s => s.category === catKey).map(s => s.id);
    const allSelected = catScopeIds.every(id => selectedScopes.includes(id));
    if (allSelected) {
      setSelectedScopes(prev => prev.filter(id => !catScopeIds.includes(id)));
    } else {
      setSelectedScopes(prev => Array.from(new Set([...prev, ...catScopeIds])));
    }
  };

  const handleSaveKey = () => {
    if (!keyName.trim()) {
      alert('يرجى كتابة اسم تعريفي للمفتاح أو التطبيق المرتبط (مثال: منصة أكد أو تطبيق الشحن).');
      return;
    }

    if (selectedScopes.length === 0) {
      alert('يرجى اختيار صلاحية واحدة على الأقل للمفتاح.');
      return;
    }

    if (editingKeyId) {
      // Edit existing key permissions / name
      const updated = apiKeys.map(k => {
        if (k.id === editingKeyId) {
          return {
            ...k,
            name: keyName.trim(),
            permissions: selectedScopes,
            notes: keyNotes.trim() || undefined,
          };
        }
        return k;
      });

      setSettings(prev => ({ ...prev, storeApiKeys: updated }));
      setIsCreateModalOpen(false);
      audioSynth?.playSuccess?.();
    } else {
      // Generate new key
      const rawKey = generateSecureKey();
      const masked = `${rawKey.slice(0, 11)}••••••••••••${rawKey.slice(-4)}`;

      let expiresAt: string | undefined = undefined;
      if (expirationDays !== 'never') {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(expirationDays, 10));
        expiresAt = d.toISOString();
      }

      const newKeyItem: StoreApiKey = {
        id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: keyName.trim(),
        key: rawKey,
        maskedKey: masked,
        permissions: selectedScopes,
        createdAt: new Date().toISOString(),
        expiresAt,
        isActive: true,
        notes: keyNotes.trim() || undefined,
      };

      setSettings(prev => ({ ...prev, storeApiKeys: [newKeyItem, ...(prev.storeApiKeys || [])] }));
      setNewlyCreatedKey(rawKey);
      setTestKeyInput(rawKey);
      setIsCreateModalOpen(false);
      audioSynth?.playCash?.();
    }
  };

  const toggleKeyActive = (id: string) => {
    const updated = apiKeys.map(k => {
      if (k.id === id) {
        return { ...k, isActive: !k.isActive };
      }
      return k;
    });
    setSettings(prev => ({ ...prev, storeApiKeys: updated }));
    audioSynth?.playSuccess?.();
  };

  const handleRegenerateKey = (id: string) => {
    if (!confirm('هل أنت متأكد من إعادة توليد هذا المفتاح؟ سيتوقف المفتاح القديم فوراً عن العمل في التطبيقات المرتبطة به.')) {
      return;
    }
    const rawKey = generateSecureKey();
    const masked = `${rawKey.slice(0, 11)}••••••••••••${rawKey.slice(-4)}`;

    const updated = apiKeys.map(k => {
      if (k.id === id) {
        return {
          ...k,
          key: rawKey,
          maskedKey: masked,
          createdAt: new Date().toISOString(),
        };
      }
      return k;
    });

    setSettings(prev => ({ ...prev, storeApiKeys: updated }));
    setNewlyCreatedKey(rawKey);
    setTestKeyInput(rawKey);
    audioSynth?.playCash?.();
  };

  const handleDeleteKey = (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف مفتاح الربط "${name}" نهائياً؟`)) {
      return;
    }
    const updated = apiKeys.filter(k => k.id !== id);
    setSettings(prev => ({ ...prev, storeApiKeys: updated }));
    audioSynth?.playSuccess?.();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2500);
    audioSynth?.playSuccess?.();
  };

  const runLiveKeyTest = async () => {
    const keyToTest = (testKeyInput || newlyCreatedKey || (apiKeys[0]?.key) || '').trim();
    if (!keyToTest) {
      alert('يرجى إدخال مفتاح API للتجربة.');
      return;
    }

    setIsTestingKey(true);
    setTestResult(null);

    try {
      const res = await fetch(testEndpoint, {
        headers: {
          'Authorization': `Bearer ${keyToTest}`,
          'X-Store-Id': activeStoreId || ''
        }
      });
      const data = await res.json();
      setTestResult({
        endpoint: testEndpoint,
        status: res.status,
        ok: res.ok,
        data
      });
      if (res.ok) {
        audioSynth?.playSuccess?.();
      } else {
        audioSynth?.playAlarm?.();
      }
    } catch (err: any) {
      setTestResult({
        endpoint: testEndpoint,
        status: 500,
        ok: false,
        data: { error: err.message || 'فشل الاتصال بالخادم' }
      });
      audioSynth?.playAlarm?.();
    } finally {
      setIsTestingKey(false);
    }
  };

  // Filter scopes in modal based on search and category
  const filteredScopes = useMemo(() => {
    return SCOPE_DEFINITIONS.filter(sc => {
      const matchesCategory = activeFilterCategory === 'all' || sc.category === activeFilterCategory;
      if (!matchesCategory) return false;

      if (!scopeSearchQuery.trim()) return true;
      const q = scopeSearchQuery.toLowerCase();
      return (
        sc.name.toLowerCase().includes(q) ||
        sc.id.toLowerCase().includes(q) ||
        sc.description.toLowerCase().includes(q) ||
        sc.endpoint.toLowerCase().includes(q) ||
        (sc.recommendedTag && sc.recommendedTag.toLowerCase().includes(q))
      );
    });
  }, [scopeSearchQuery, activeFilterCategory]);

  const activeKeysCount = apiKeys.filter(k => k.isActive).length;

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-indigo-900/50 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold">
              <Key size={14} className="animate-pulse" />
              <span>مفاتيح الربط البرمجي REST API (OAuth / API Keys)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              إدارة صلاحيات مفاتيح الربط البرمجي (API Keys)
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              قم بإنشاء وتعيين صلاحيات دقيقة وحقيقية للمنصات الخارجية مثل <strong className="text-emerald-400 font-bold">منصة أكد (Akked)</strong>، شركات الشحن، أنظمة الـ POS، والمحاسبة، للتحكم التام في ما يمكن للتطبيقات قراءته أو تعديله.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl px-5 py-3 text-sm border border-white/20 flex items-center justify-center gap-2 transition-all"
            >
              <Code size={18} className="text-emerald-400" />
              <span>وثائق الـ API والـ Endpoints</span>
              <ExternalLink size={14} className="opacity-70" />
            </a>
            <button
              onClick={openCreateModal}
              className="btn bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl px-6 py-3 text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <Plus size={18} />
              <span>إنشاء مفتاح ربط جديد</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-indigo-900/50 text-xs">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px] mb-1">إجمالي المفاتيح</span>
            <span className="text-lg font-black text-white">{apiKeys.length}</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px] mb-1">المفاتيح النشطة</span>
            <span className="text-lg font-black text-emerald-400">{activeKeysCount}</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px] mb-1">الصلاحيات المتاحة</span>
            <span className="text-lg font-black text-indigo-300">{SCOPE_DEFINITIONS.length} صلاحية دقيقة</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px] mb-1">المصادقة المدعومة</span>
            <span className="text-lg font-black text-cyan-300 font-mono">Bearer / X-API-KEY</span>
          </div>
        </div>
      </div>

      {/* Real Presets Showcase Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span>نماذج صلاحيات جاهزة للربط الفوري (Real-World Presets)</span>
          </h3>
          <span className="text-xs text-slate-500">اختر قالباً لإنشاء المفتاح المخصص فوراً بنقرة واحدة</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REAL_WORLD_PRESETS.map(preset => {
            const Icon = preset.icon;
            return (
              <div
                key={preset.id}
                onClick={() => {
                  openCreateModal();
                  applyPreset(preset);
                }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer shadow-sm hover:shadow-md group relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <Icon size={18} />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${preset.badgeColor}`}>
                    {preset.badge}
                  </span>
                </div>

                <h4 className="text-xs font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {preset.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                  {preset.subtitle}
                </p>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-600 dark:text-slate-400">
                    {preset.scopes.length} صلاحيات حقيقية
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                    <span>استخدام القالب</span>
                    <ArrowRight size={12} className="rotate-180" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Newly Created Key Alert */}
      {newlyCreatedKey && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-3xl p-6 space-y-3 animate-in fade-in shadow-sm">
          <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300 font-black text-sm">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <span>تم توليد مفتاح الـ API بنجاح! يرجى حفظه الآن في مكان آمن.</span>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            لأسباب أمنية، لن تتمكن من رؤية هذا المفتاح بالكامل مرة أخرى بعد مغادرة هذه الصفحة.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              readOnly
              value={newlyCreatedKey}
              className="input input-sm flex-1 bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 rounded-xl font-mono text-xs text-left"
              dir="ltr"
            />
            <button
              onClick={() => copyToClipboard(newlyCreatedKey, 'newly_created')}
              className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-4 flex items-center gap-1.5 shrink-0"
            >
              {copiedKeyId === 'newly_created' ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedKeyId === 'newly_created' ? 'تم النسخ!' : 'نسخ المفتاح'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Keys List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span>المفاتيح المصرح بها حالياً</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                {apiKeys.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              إدارة المفاتيح المصرح لها بالوصول لبيانات متجرك والتحكم بصلاحيات كل مفتاح بدقة
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
          >
            <Plus size={16} />
            <span>إنشاء مفتاح مخصص</span>
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-500 mx-auto mb-4">
              <Key size={32} />
            </div>
            <h4 className="text-base font-black text-slate-800 dark:text-white mb-2">
              لا توجد مفاتيح API منشأة حتى الآن
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              قم بإنشاء مفتاحك الأول لتمكين منصة أكد أو شركات الشحن وتطبيقات الجوال من مزامنة وتأكيد الطلبات بشكل آمن.
            </p>
            <button
              onClick={openCreateModal}
              className="btn bg-indigo-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2"
            >
              <Plus size={16} />
              <span>إنشاء مفتاح ربط الآن</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {apiKeys.map(item => {
              const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
              return (
                <div key={item.id} className="p-5 sm:p-6 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Key Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-black text-slate-800 dark:text-white text-base">
                          {item.name}
                        </span>

                        {item.isActive && !isExpired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>نشط ومفعّل</span>
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800">
                            <span>منتهي الصلاحية</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold">
                            <span>معطّل مؤقتاً</span>
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock size={12} />
                          <span>أنشئ: {new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                        </span>

                        {item.lastUsedAt && (
                          <span className="text-[11px] text-indigo-500 dark:text-indigo-400 font-mono">
                            آخر استخدام: {new Date(item.lastUsedAt).toLocaleDateString('ar-EG')}
                          </span>
                        )}
                      </div>

                      {/* Masked Key Display & Copy */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Key size={13} className="text-slate-400" />
                          <span>{item.maskedKey || `${item.key.slice(0, 11)}••••••••••••${item.key.slice(-4)}`}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(item.key, item.id)}
                          title="نسخ المفتاح"
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                        >
                          {copiedKeyId === item.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => {
                            setTestKeyInput(item.key);
                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40"
                        >
                          اختبار في الكونسول ↓
                        </button>
                      </div>

                      {/* Scopes Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        <span className="text-[11px] font-bold text-slate-400 ml-1">
                          الصلاحيات الممنوحة ({item.permissions?.length || 0}):
                        </span>
                        {(item.permissions || []).map(sc => {
                          const def = SCOPE_DEFINITIONS.find(s => s.id === sc);
                          const isDelete = sc.includes('delete');
                          const isConfirm = sc.includes('confirm');
                          const isWrite = sc.includes('write') || sc.includes('status') || sc.includes('adjust') || sc.includes('send');

                          let badgeStyle = 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                          if (isDelete) {
                            badgeStyle = 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
                          } else if (isConfirm) {
                            badgeStyle = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-black';
                          } else if (isWrite) {
                            badgeStyle = 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
                          }

                          return (
                            <span
                              key={sc}
                              title={`${def?.description || sc} (${def?.endpoint || ''})`}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${badgeStyle}`}
                            >
                              {def?.name || sc}
                            </span>
                          );
                        })}
                      </div>

                      {item.notes && (
                        <p className="text-xs text-slate-400 italic pt-1">
                          ملاحظة: {item.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => toggleKeyActive(item.id)}
                        className={`text-xs font-bold px-3 py-2 rounded-xl transition-all border ${
                          item.isActive
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {item.isActive ? 'تعطيل مؤقت' : 'تفعيل'}
                      </button>

                      <button
                        onClick={() => openEditModal(item)}
                        className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      >
                        تعديل الصلاحيات
                      </button>

                      <button
                        onClick={() => handleRegenerateKey(item.id)}
                        title="إعادة توليد المفتاح (Regenerate)"
                        className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all border border-transparent hover:border-indigo-200"
                      >
                        <RefreshCw size={16} />
                      </button>

                      <button
                        onClick={() => handleDeleteKey(item.id, item.name)}
                        title="حذف المفتاح نهائياً"
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Testing Console & API Documentation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Testing Console */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
              <Zap size={20} />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-800 dark:text-white">
                فحص الصلاحيات والاستجابة الحية (Live Testing Console)
              </h4>
              <p className="text-xs text-slate-500">
                اختبر استجابة الـ Endpoints وتأكد من أن المفتاح يحمل الصلاحيات المطلوبة فعلياً
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                المسار المطلوب اختباره (API Endpoint):
              </label>
              <select
                value={testEndpoint}
                onChange={e => setTestEndpoint(e.target.value)}
                className="select select-sm w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-left"
                dir="ltr"
              >
                <option value="/api/v1/validate-key">GET /api/v1/validate-key (فحص صحة المفتاح والصلاحيات)</option>
                <option value="/api/v1/orders">GET /api/v1/orders (قراءة الطلبات - يتطلب orders:read)</option>
                <option value="/api/v1/shipping/orders">GET /api/v1/shipping/orders (بوالص الشحن - يتطلب shipping:read)</option>
                <option value="/api/v1/inventory">GET /api/v1/inventory (أرصدة المخزون - يتطلب inventory:read)</option>
                <option value="/api/v1/customers">GET /api/v1/customers (قائمة العملاء - يتطلب customers:read)</option>
                <option value="/api/v1/abandoned-carts">GET /api/v1/abandoned-carts (السلات المتروكة - يتطلب abandoned_carts:read)</option>
                <option value="/api/v1/reports/summary">GET /api/v1/reports/summary (التقارير والأرباح - يتطلب reports:read)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                المفتاح المراد فحصه:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={testKeyInput}
                  onChange={e => setTestKeyInput(e.target.value)}
                  placeholder="ak_live_..."
                  className="input input-sm flex-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-left"
                  dir="ltr"
                />
                <button
                  onClick={runLiveKeyTest}
                  disabled={isTestingKey}
                  className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-4 flex items-center gap-1.5 shrink-0"
                >
                  {isTestingKey ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>تنفيذ الفحص</span>
                </button>
              </div>
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-2xl border text-xs font-mono transition-all ${
              testResult.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}>
              <div className="flex items-center justify-between font-bold pb-2 mb-2 border-b border-current/20">
                <span>المسار: {testResult.endpoint}</span>
                <span>HTTP {testResult.status} {testResult.ok ? '✅ مصرح وناجح' : '❌ محظور (Missing Scope)'}</span>
              </div>
              <pre className="text-[11px] overflow-x-auto text-left max-h-48" dir="ltr">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Integration Documentation Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                <Code size={20} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-800 dark:text-white">
                  طريقة تمرير المفتاح في المنصات الخارجية
                </h4>
                <p className="text-xs text-slate-500">
                  HTTP Headers الرسمية المعتمدة في منصة أكد وشركات التوصيل
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const sample = `curl -X GET "${hostUrl}/api/v1/orders" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json"`;
                navigator.clipboard.writeText(sample);
                setCopiedCodeSnippet(true);
                setTimeout(() => setCopiedCodeSnippet(false), 2000);
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              {copiedCodeSnippet ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedCodeSnippet ? 'تم النسخ!' : 'نسخ كود cURL'}</span>
            </button>
          </div>

          <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-xs space-y-2 overflow-x-auto text-left" dir="ltr">
            <div className="text-slate-400">// 1. Header القياسي الأساسي (Bearer Token):</div>
            <div className="text-emerald-400">Authorization: Bearer ak_live_...</div>
            <div className="text-slate-400 pt-1">// 2. أو الترويسة المباشرة X-API-KEY:</div>
            <div className="text-cyan-400">X-API-KEY: ak_live_...</div>
          </div>

          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="font-bold text-slate-800 dark:text-white">أهم المسارات للمنصات المشهورة:</div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-400" dir="ltr">
              <li>• <span className="text-emerald-600 font-bold">POST</span> /api/v1/orders/:id/confirm <span className="text-slate-400 font-sans">(تأكيد الطلب بالواتساب - أكد)</span></li>
              <li>• <span className="text-blue-600 font-bold">GET</span> /api/v1/orders <span className="text-slate-400 font-sans">(استعلام الطلبات المعلقة)</span></li>
              <li>• <span className="text-amber-600 font-bold">PATCH</span> /api/v1/shipping/orders/:id <span className="text-slate-400 font-sans">(تحديث بوليصة الشحن AWB)</span></li>
              <li>• <span className="text-blue-600 font-bold">GET</span> /api/v1/inventory <span className="text-slate-400 font-sans">(أرصدة المستودعات)</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create / Edit Key Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                  <Key size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {editingKeyId ? 'تعديل صلاحيات المفتاح البرمجي' : 'إنشاء مفتاح واجهة برمجة التطبيقات (API Key)'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اختر الصلاحيات الدقيقة التي يستطيع هذا المفتاح الوصول إليها وتنفيذها
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Content */}
            <div className="space-y-5">
              {/* Presets Quick Selector */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-850/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span>تطبيق نموذج جاهز بنقرة واحدة:</span>
                  </span>
                  <span className="text-[11px] text-slate-400">يحدد الصلاحيات المناسبة تلقائياً</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {REAL_WORLD_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center gap-1.5"
                    >
                      <span>{preset.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Key Name */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم المفتاح / التطبيق المستهدف: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={e => setKeyName(e.target.value)}
                  placeholder="مثال: منصة أكد (Akked)، شركة الشحن بوسطة، تطبيق الجوال، برنامج الحسابات"
                  className="input w-full bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {!editingKeyId && (
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    مدة الصلاحية (Expiration):
                  </label>
                  <select
                    value={expirationDays}
                    onChange={e => setExpirationDays(e.target.value as any)}
                    className="select w-full bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium"
                  >
                    <option value="never">دائم (بدون تاريخ انتهاء - موصى به لتكاملات السيرفرات)</option>
                    <option value="30">30 يوماً</option>
                    <option value="90">90 يوماً</option>
                    <option value="365">سنة كاملة</option>
                  </select>
                </div>
              )}

              {/* Scopes Selection Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Shield size={15} className="text-indigo-500" />
                    <span>صلاحيات الـ API الممنوحة:</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black text-xs">
                      {selectedScopes.length} من أصل {SCOPE_DEFINITIONS.length}
                    </span>
                  </label>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllScopes}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={clearAllScopes}
                      className="px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar inside Modal */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={scopeSearchQuery}
                      onChange={e => setScopeSearchQuery(e.target.value)}
                      placeholder="ابحث بالصلاحية (مثال: أكد، شحن، تأكيد، حذف، orders...)"
                      className="input input-sm w-full pr-10 pl-3 bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveFilterCategory('all')}
                      className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all text-[11px] ${
                        activeFilterCategory === 'all'
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      الكل ({SCOPE_DEFINITIONS.length})
                    </button>

                    {Object.entries(CATEGORY_INFO).map(([catKey, info]) => {
                      const countInCat = SCOPE_DEFINITIONS.filter(s => s.category === catKey).length;
                      const selectedInCat = SCOPE_DEFINITIONS.filter(s => s.category === catKey && selectedScopes.includes(s.id)).length;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setActiveFilterCategory(catKey)}
                          className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all text-[11px] flex items-center gap-1 ${
                            activeFilterCategory === catKey
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span>{info.title}</span>
                          {selectedInCat > 0 && (
                            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px]">
                              {selectedInCat}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scopes by Category List */}
                <div className="space-y-4 max-h-72 overflow-y-auto p-1 pr-2">
                  {Object.entries(CATEGORY_INFO).map(([categoryKey, catInfo]) => {
                    const scopesInCat = filteredScopes.filter(s => s.category === categoryKey);
                    if (scopesInCat.length === 0) return null;

                    const IconComponent = catInfo.icon;
                    const allCatSelected = scopesInCat.every(s => selectedScopes.includes(s.id));

                    return (
                      <div key={categoryKey} className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-850/50 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                            <IconComponent size={15} className="text-indigo-500" />
                            <span>{catInfo.title}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({catInfo.desc})</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleCategoryScopes(categoryKey as ScopeCategory)}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            {allCatSelected ? 'إلغاء القسم' : 'تحديد القسم'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {scopesInCat.map(sc => {
                            const isChecked = selectedScopes.includes(sc.id);
                            const methodColors = {
                              GET: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
                              POST: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
                              PATCH: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
                              DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
                            };

                            return (
                              <div
                                key={sc.id}
                                onClick={() => toggleScope(sc.id)}
                                className={`p-2.5 rounded-xl border text-right cursor-pointer select-none transition-all flex items-start gap-2.5 ${
                                  isChecked
                                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 shadow-sm'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                }`}
                              >
                                <div className="mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0">
                                  {isChecked ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300 dark:text-slate-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-black text-slate-800 dark:text-white flex items-center justify-between gap-1">
                                    <span className="truncate">{sc.name}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {sc.recommendedTag && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                          {sc.recommendedTag}
                                        </span>
                                      )}
                                      <span className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded ${methodColors[sc.method]}`}>
                                        {sc.method}
                                      </span>
                                      {sc.isDangerous && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                                          حساس
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                    {sc.description}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400 mt-1" dir="ltr">
                                    {sc.id} • {sc.endpoint}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات إضافية (اختياري):
                </label>
                <input
                  type="text"
                  value={keyNotes}
                  onChange={e => setKeyNotes(e.target.value)}
                  placeholder="مثال: مستخدم للربط مع متجر فرع المعادي ونظام الشحن"
                  className="input input-sm w-full bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="btn btn-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-xl px-5 font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveKey}
                className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 font-black shadow-md shadow-indigo-600/20"
              >
                {editingKeyId ? 'حفظ التعديلات' : 'تأكيد وإنشاء المفتاح'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeysManager;
