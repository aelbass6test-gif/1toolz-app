import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeftRight, 
  HelpCircle, 
  Save, 
  ExternalLink, 
  Link2, 
  Copy, 
  Check, 
  Trash2,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';

interface User {
  phone: string;
  stores?: Array<{
    id: string;
    name: string;
    customDomain?: string;
    subdomain?: string;
  }>;
}

interface DomainSettingsPageProps {
  activeStoreId: string;
  storeData: any;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  users?: User[];
}

export const DomainSettingsPage: React.FC<DomainSettingsPageProps> = ({ 
  activeStoreId, 
  storeData, 
  settings, 
  setSettings,
  users = []
}) => {
  const [customDomain, setCustomDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState<'none' | 'pending' | 'verifying' | 'active' | 'pending_validation' | 'error'>('none');
  const [cfDetails, setCfDetails] = useState<any>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<{
    type: '405' | '404' | 'json' | 'generic' | null;
    message: string;
  } | null>(null);

  // Custom Modal State
  const [modal, setModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    onConfirm?: () => void;
    isConfirm?: boolean;
    buttonText?: string;
  }>({
    show: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setModal({
      show: true,
      title,
      message,
      type,
      isConfirm: false,
      buttonText: 'حسناً'
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'error' = 'warning') => {
    setModal({
      show: true,
      title,
      message,
      type,
      onConfirm,
      isConfirm: true,
      buttonText: 'تأكيد'
    });
  };

  // Subdomain Local State
  const [localSubdomain, setLocalSubdomain] = useState(settings.subdomain || '');
  const [isSubdomainSaving, setIsSubdomainSaving] = useState(false);

  // Sync state if settings update
  useEffect(() => {
    if (settings.subdomain) {
      setLocalSubdomain(settings.subdomain);
    } else {
      setLocalSubdomain('');
    }
  }, [settings.subdomain]);

  useEffect(() => {
    if (settings.domainDNSRecords) {
      setCfDetails(settings.domainDNSRecords);
    }
    if (settings.domainStatus && settings.domainStatus !== 'none') {
      setDomainStatus(settings.domainStatus as any);
    }
    if (settings.customAppDomain && !customDomain) {
      setCustomDomain(settings.customAppDomain);
    }
  }, [settings.domainDNSRecords, settings.domainStatus, settings.customAppDomain]);

  // Load saved domain from localStorage or storeData relative to current store
  useEffect(() => {
    if (activeStoreId) {
      const savedDomain = localStorage.getItem(`custom_domain_${activeStoreId}`) || '';
      const savedStatus = localStorage.getItem(`custom_domain_status_${activeStoreId}`) || 'none';
      const savedDetails = localStorage.getItem(`custom_domain_details_${activeStoreId}`);
      setCustomDomain(savedDomain);
      setDomainStatus(savedStatus as any);
      if (savedDetails) {
        try { setCfDetails(JSON.parse(savedDetails)); } catch (e) {}
      }
    }
  }, [activeStoreId]);

  // Helper: Checks if subdomain is already used by another store
  const isSubdomainTaken = (sub: string) => {
    if (!sub) return false;
    const cleanSub = sub.trim().toLowerCase();
    for (const u of users) {
      if (!u.stores) continue;
      for (const s of u.stores) {
        if (s.id !== activeStoreId && s.subdomain?.trim().toLowerCase() === cleanSub) {
          return true;
        }
      }
    }
    return false;
  };

  // Helper: Checks if custom domain is already used by another store
  const isCustomDomainTaken = (dom: string) => {
    if (!dom) return false;
    const cleanDom = dom.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').toLowerCase().trim();
    for (const u of users) {
      if (!u.stores) continue;
      for (const s of u.stores) {
        if (s.id !== activeStoreId) {
          const sDom = s.customDomain?.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').toLowerCase().trim();
          if (sDom === cleanDom) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Validate subdomain format (lowercase letters, numbers, hyphens)
  const isSubdomainFormatValid = (sub: string) => {
    if (!sub) return true; // empty is allowed for removing
    return /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/.test(sub);
  };

  const currentSubdomainStatus = () => {
    if (!localSubdomain) return 'empty';
    if (!isSubdomainFormatValid(localSubdomain)) return 'invalid';
    if (isSubdomainTaken(localSubdomain)) return 'taken';
    if (localSubdomain === settings.subdomain) return 'active';
    return 'available';
  };

  const handleSaveSubdomain = async () => {
    const cleanSub = localSubdomain.trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, '');
    
    if (!cleanSub) {
      showAlert("تنبيه", "الرجاء إدخال اسم نطاق فرعي", "warning");
      return;
    }

    if (cleanSub.length < 3 || cleanSub.length > 30) {
      showAlert("تنبيه", "يجب أن يتراوح طول النطاق الفرعي بين 3 و 30 رمزاً", "warning");
      return;
    }

    if (!isSubdomainFormatValid(cleanSub)) {
      showAlert("تنبيه", "صيغة النطاق غير صالحة. يرجى استخدام الأحرف والأرقام الإنجليزية والشرطات فقط (-) بدون رموز خاصة أو مسافات.", "warning");
      return;
    }

    if (isSubdomainTaken(cleanSub)) {
      showAlert("تنبيه", "⚠️ عذراً، هذا النطاق الفرعي محجوز لمتجر آخر حالياً. يرجى اختيار اسم مستخدم آخر.", "error");
      return;
    }

    setIsSubdomainSaving(true);
    try {
      setSettings((prev: any) => ({
        ...prev,
        subdomain: cleanSub
      }));
      showAlert("نجاح", `🎉 تم حفظ وتفعيل النطاق الفرعي المجاني (${cleanSub}.abdomedi.com) لمتجرك المباشر بنجاح!`, "success");
    } catch (e) {
      showAlert("خطأ", "حدث خطأ أثناء حفظ النطاق الفرعي.", "error");
    } finally {
      setIsSubdomainSaving(false);
    }
  };

  const handleDeleteSubdomain = () => {
    showConfirm(
      "تأكيد إعادة التعيين", 
      "هل أنت متأكد من إعادة تعيين النطاق الفرعي؟ سيتم توليد اسم عشوائي جديد تلقائياً لضمان بقاء المتجر متاحاً.",
      () => {
        setLocalSubdomain('');
        setSettings((prev: any) => ({
          ...prev,
          subdomain: ''
        }));
        showAlert("تمت العملية", "تمت إعادة تعيين النطاق الفرعي بنجاح.", "success");
      },
      "warning"
    );
  };

  const handleSaveDomain = async () => {
    if (!customDomain.trim()) {
      showAlert("تنبيه", "يرجى إدخال اسم نطاق صحيح (مثال: mystoredomain.com)", "warning");
      return;
    }
    
    // Simple regex check for domain
    const cleanDomain = customDomain
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '') // Remove any trailing paths
      .replace(/[^a-zA-Z0-9.-]/g, '') // Remove hidden chars, spaces, and invalid symbols
      .toLowerCase();
    
    if (!cleanDomain) {
      showAlert("تنبيه", "يرجى إدخال اسم نطاق صحيح", "warning");
      return;
    }

    if (isCustomDomainTaken(cleanDomain)) {
      showAlert("تنبيه", "⚠️ هذا النطاق المخصص مستخدم بالفعل بواسطة متجر آخر على النظام. يرجى مراجعة الدعم الفني أو التأكد من النطاق لضمان حظر التداخل.", "error");
      return;
    }
    
    setCustomDomain(cleanDomain);
    setIsSaving(true);
    setErrorMessage(null);
    setBackendError(null);

    try {
      let response = await fetch('/api/domains/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: cleanDomain,
          storeId: activeStoreId
        })
      });

      // 🔥 Auto-fallback for shared hosting (Hostinger/cPanel) if .htaccess is missing!
      if (response.status === 405 || response.status === 404) {
        console.warn(`[API] Endpoint /api/domains/add returned ${response.status}. Attempting direct PHP file execution /api/domains/add/index.php...`);
        const fallbackResponse = await fetch('/api/domains/add/index.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: cleanDomain, storeId: activeStoreId })
        });
        
        if (fallbackResponse.ok || fallbackResponse.status === 400 || fallbackResponse.status === 500) {
            response = fallbackResponse; // Use the PHP response if it executed!
        }
      }

      if (response.status === 405) {
        throw new Error("405_METHOD_NOT_ALLOWED");
      }
      if (response.status === 404) {
        throw new Error("404_NOT_FOUND");
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("JSON_PARSE_ERROR");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "حدث خطأ غير متوقع أثناء إضافة النطاق.");
      }

      localStorage.setItem(`custom_domain_${activeStoreId}`, cleanDomain);
      
      if (data.details) {
        localStorage.setItem(`custom_domain_details_${activeStoreId}`, JSON.stringify(data.details));
        setCfDetails(data.details);
      }

      const nextStatus = data.simulation ? 'pending' : (data.details?.status || 'pending');
      localStorage.setItem(`custom_domain_status_${activeStoreId}`, nextStatus);
      setDomainStatus(nextStatus as any);
      
      // Save conflict state if any
      if (data.isConflict) {
        setSettings((prev: any) => ({
          ...prev,
          domainConflict: true,
          domainDNSRecords: data.details
        }));
      }
      
      // Save to global setSettings for SaaS configurations
      setSettings((prev: any) => ({
        ...prev,
        customAppDomain: cleanDomain
      }));

      showAlert("نجاح", data.message || `⚡ تم تسجيل النطاق ${cleanDomain} بنجاح عبر API! يرجى إعداد سجلات الـ DNS في لوحة تحكم نطاقك لتبدأ شهادة SSL بالعمل.`, "success");
    } catch (err: any) {
      console.error(err);
      if (err.message === "405_METHOD_NOT_ALLOWED") {
        setBackendError({
          type: '405',
          message: "خطأ 405 (Method Not Allowed): السيرفر المستضيف على app.abdomedi.com يستقبل ملفات الـ Static فقط. لا توجد بيئة Node.js نشطة أو مفعلة لمعالجة طلب الـ POST لـ API الدومينات المخصصة."
        });
      } else if (err.message === "404_NOT_FOUND") {
        setBackendError({
          type: '404',
          message: "خطأ 404 (Not Found): لم يتم العثور على endpoint في السيرفر. ربما لم يتم رفع كود server.ts المحدّث أو أن خادم الويب لا يوجه المسار /api بشكل صحيح."
        });
      } else if (err.message === "JSON_PARSE_ERROR") {
        setBackendError({
          type: 'json',
          message: "فشلت قراءة رد السيرفر بنجاح (JSON Parse Error). السيرفر قام بإرجاع صفحة خطأ HTML مثل 405 أو 404 بسبب رفع مجلد الـ dist للـ React فقط على Hostinger دون تشغيل الـ Node backend."
        });
      } else {
        setBackendError({
          type: 'generic',
          message: err.message || "حدث خطأ غير متوقع أثناء الاتصال بالـ API."
        });
      }
      setErrorMessage(err.message);
      showAlert("خطأ", `⚠️ خطأ: ${err.message === "405_METHOD_NOT_ALLOWED" ? "لقد تم رفع ملفات الـ Static فقط على الاستضافة ولا يوجد Node backend تشغيلي نشط (خطأ 405)." : err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!customDomain) return;
    
    setDomainStatus('verifying');
    setErrorMessage(null);
    setBackendError(null);
    
    try {
      let response = await fetch('/api/domains/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: customDomain
        })
      });

      // 🔥 Auto-fallback for shared hosting (Hostinger/cPanel) if .htaccess is missing!
      if (response.status === 405 || response.status === 404) {
        console.warn(`[API] Endpoint /api/domains/status returned ${response.status}. Attempting direct PHP file execution /api/domains/status/index.php...`);
        const fallbackResponse = await fetch('/api/domains/status/index.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: customDomain })
        });
        
        if (fallbackResponse.ok || fallbackResponse.status === 400 || fallbackResponse.status === 500) {
            response = fallbackResponse;
        }
      }

      if (response.status === 405) {
        throw new Error("405_METHOD_NOT_ALLOWED");
      }
      if (response.status === 404) {
        throw new Error("404_NOT_FOUND");
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("JSON_PARSE_ERROR");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "فشل التحقق من حالة النطاق.");
      }

      if (data.status === 'active' && data.ssl_status === 'active') {
        setDomainStatus('active');
        localStorage.setItem(`custom_domain_status_${activeStoreId}`, 'active');
        if (data.details) {
           localStorage.setItem(`custom_domain_details_${activeStoreId}`, JSON.stringify(data.details));
           setCfDetails(data.details);
        }
        showAlert("تم الربط بنجاح", "🎉 مبارك! تم التحقق من ربط النطاق بنجاح وهو الآن نشط ومحمي بشهادة SSL آمنة ومجانية.", "success");
      } else {
        // Still pending
        setDomainStatus('pending');
        localStorage.setItem(`custom_domain_status_${activeStoreId}`, 'pending');
        if (data.details) {
           localStorage.setItem(`custom_domain_details_${activeStoreId}`, JSON.stringify(data.details));
           setCfDetails(data.details);
        }
        
        let statusText = "النطاق ما زال قيد التحقق أو بانتظار تفعيل الـ SSL بـ Cloudflare.";
        if (data.verification_errors && data.verification_errors.length > 0) {
          const firstErr = data.verification_errors[0];
          const errMessage = typeof firstErr === 'string' ? firstErr : (firstErr?.message || firstErr?.error || JSON.stringify(firstErr));
          statusText += `\n🔍 أخطاء إثبات الملكية: ${errMessage}`;
        }
        if (data.ssl_validation_errors && data.ssl_validation_errors.length > 0) {
          const firstErr = data.ssl_validation_errors[0];
          const errMessage = typeof firstErr === 'string' ? firstErr : (firstErr?.message || firstErr?.error || JSON.stringify(firstErr));
          statusText += `\n🔒 أخطاء شهادة الـ SSL: ${errMessage}`;
        }
        showAlert("حالة النطاق", `ℹ️ ${statusText}\nيرجى التأكد من توجيه سجلات الـ DNS (خاصة TXT) بشكل صحيح والانتظار قليلاً.`, "info");
      }
    } catch (err: any) {
      console.error(err);
      setDomainStatus('pending');
      showAlert("تنبيه", `⚠️ خطأ أثناء الفحص: ${err.message}`, "error");
    }
  };

  const handleActivateDemoMode = () => {
    if (!customDomain.trim()) {
      showAlert("تنبيه", "يرجى إدخال اسم نطاق أولاً.", "warning");
      return;
    }
    const cleanDomain = customDomain
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '')
      .replace(/[^a-zA-Z0-9.-]/g, '')
      .toLowerCase();

    if (isCustomDomainTaken(cleanDomain)) {
      showAlert("تنبيه", "⚠️ هذا النطاق المخصص محجوز بالفعل لمتجر آخر.", "error");
      return;
    }

    setCustomDomain(cleanDomain);
    
    localStorage.setItem(`custom_domain_${activeStoreId}`, cleanDomain);
    localStorage.setItem(`custom_domain_status_${activeStoreId}`, 'active');
    setDomainStatus('active');
    
    setSettings((prev: any) => ({
      ...prev,
      customAppDomain: cleanDomain
    }));
    
    setBackendError(null);
    showAlert("وضع المحاكاة", `⚡ [وضع المحاكاة النشط]: تم تفعيل وحفظ الدومين ${cleanDomain} بنجاح محلياً لتجربته في المتجر المباشر ولوحة التحكم!`, "success");
  };

  const handleDisconnect = () => {
    showConfirm(
      "تأكيد حذف النطاق", 
      "هل أنت متأكد من حذف وإلغاء ربط النطاق المخصص؟ سيتم فك ارتباط متجرك بعنوان الويب الحالي فوراً.",
      () => {
        setCustomDomain('');
        setDomainStatus('none');
        setCfDetails(null);
        localStorage.removeItem(`custom_domain_${activeStoreId}`);
        localStorage.removeItem(`custom_domain_status_${activeStoreId}`);
        localStorage.removeItem(`custom_domain_details_${activeStoreId}`);
        setSettings((prev: any) => ({
          ...prev,
          customAppDomain: ''
        }));
        showAlert("تمت العملية", "تم إلغاء ربط النطاق المخصص بنجاح.", "success");
      },
      "error"
    );
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const currentStatus = currentSubdomainStatus();

  return (
    <div className="space-y-6 text-right font-sans max-w-5xl mx-auto p-4 md:p-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400 font-bold">
              <Globe size={28} className="animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">إعدادات النطاقات والروابط</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">تحكم بالروابط المباشرة لمتجرك الإلكتروني المباشر (Storefront) بكل سلاسة وسهولة.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {settings.subdomain && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-450 text-xs font-black rounded-xl border border-green-200/50 dark:border-green-900/30">
              <CheckCircle2 size={12} />
              <span>النطاق الفرعي نشط: {settings.subdomain}.abdomedi.com</span>
            </span>
          )}
          {domainStatus === 'active' ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-black rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
              <CheckCircle2 size={12} />
              <span>الدومين المخصص نشط: {customDomain}</span>
            </span>
          ) : domainStatus === 'pending' || domainStatus === 'verifying' ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-black rounded-xl border border-amber-200/50 dark:border-amber-900/40 animate-pulse">
              <AlertTriangle size={12} />
              <span>الدومين بانتظار إعداد الـ DNS</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Controls */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Subdomain (النطاق الفرعي المجاني) */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              <span>النطاق الفرعي المجاني من المنصة</span>
            </h2>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                أنشئ فوراً عنوان متجر فرعي فوري ومجاني بدون شراء أي نطاق إضافي. يمكنك تهيئته بدقائق وعرض متجرك للعملاء فورياً.
              </p>

              <div className="flex bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all items-stretch" dir="ltr">
                <input 
                  type="text" 
                  value={localSubdomain}
                  onChange={(e) => setLocalSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="name-of-store"
                  className="flex-1 bg-transparent px-4 py-3 text-sm font-mono outline-none dark:text-white text-left"
                />
                <div className="bg-slate-100 dark:bg-slate-900 px-4 py-3 text-sm font-mono font-medium text-slate-500 border-l border-slate-200 dark:border-slate-800 flex items-center shrink-0">
                  .abdomedi.com
                </div>
              </div>

              {/* Subdomain interactive feedback */}
              {localSubdomain && (
                <div className="flex items-center gap-2 text-xs font-bold pt-1">
                  {currentStatus === 'invalid' && (
                    <span className="text-red-500 flex items-center gap-1">
                      <AlertTriangle size={14} />
                      صيغة الربط غير صالحة (استخدم أحرف إنجليزية صغيرة، أرقام، وشرطات فقط)
                    </span>
                  )}
                  {currentStatus === 'taken' && (
                    <span className="text-red-500 flex items-center gap-1">
                      <AlertTriangle size={14} />
                      عذراً، هذا النطاق مستخدم ومحجوز لمتجر آخر بالمنصة!
                    </span>
                  )}
                  {currentStatus === 'available' && (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 size={14} />
                      رائع! هذا العنوان الفرعي مميز ومتاح للاستخدام فوراً.
                    </span>
                  )}
                  {currentStatus === 'active' && (
                    <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <ShieldCheck size={14} />
                      هذا هو رابط متجرك الفرعي النشط حالياً!
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons to Edit/Save */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveSubdomain}
                  disabled={isSubdomainSaving || currentStatus === 'taken' || currentStatus === 'invalid' || !localSubdomain}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isSubdomainSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>حفظ وتفعيل النطاق الفرعي ⚡</span>
                </button>

                {settings.subdomain && (
                  <button
                    type="button"
                    onClick={handleDeleteSubdomain}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-900/20 dark:text-red-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    <span>إعادة تعيين (عشوائي)</span>
                  </button>
                )}

                {settings.subdomain && (
                  <button
                    type="button"
                    onClick={() => {
                        const isInternal = window.location.hostname.includes('run.app') || window.location.hostname.includes('pages.dev') || window.location.hostname.includes('localhost');
                        const url = isInternal 
                            ? `${window.location.origin}${window.location.pathname}?preview_store=${activeStoreId}`
                            : `https://${settings.customAppDomain || settings.subdomain + '.abdomedi.com'}`;
                        window.open(url, '_blank');
                    }}
                    className="px-4 py-2.5 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>زيارة المتجر المباشر</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Custom Domain (النطاق المخصص الخاص بك) */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              <span>ربط نطاق مخصص (GoDaddy, Cloudflare, Hostinger)</span>
            </h2>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                هل اشتريت دوميناً خاصاً بك؟ اكتب العنوان هنا (مثال: <span className="font-semibold text-slate-700 dark:text-slate-350" dir="ltr">mystore.com</span>) للربط التلقائي عبر المنظومة السحابية.
              </p>
              <div className="p-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-lg">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
                  ⚠️ تأكد من إضافة <strong>CLOUDFLARE_API_TOKEN</strong> و <strong>CLOUDFLARE_ZONE_ID</strong> في إعدادات التطبيق (Settings) لضمان عمل الربط التلقائي وشهادات الـ SSL.
                </p>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  disabled={domainStatus === 'verifying'}
                  placeholder="www.yourstore.com"
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-left"
                  dir="ltr"
                />
              </div>

              {customDomain && isCustomDomainTaken(customDomain) && (
                <div className="p-3 bg-red-50/50 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-xs font-bold rounded-xl border border-red-200/40 flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle size={14} />
                  <span>تحذير: هذا الدومين المخصص محتجز لمتجر آخر على النظام. إذا كنت أنت المالك، يرجى حذفه من المتجر الآخر أولاً.</span>
                </div>
              )}

              {settings.domainConflict && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-xl border border-amber-200/40 flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle size={14} />
                  <span>تنبيه: هذا النطاق محجوز في حساب Cloudflare آخر. يرجى إضافة سجلات التوثيق أدناه لإثبات ملكيتك ونقله لمتجرك الحالي أوتوماتيكياً.</span>
                </div>
              )}

              {backendError && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200/50 dark:border-red-900/30 space-y-3">
                  <div className="flex gap-2.5 items-start text-red-800 dark:text-red-400">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-black">تشخيص سبب الفشل وحل المشكلة على استضافتك ⚠️</p>
                      <p className="text-[11px] leading-relaxed opacity-95">
                        {backendError.message}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white/80 dark:bg-slate-900/50 p-4 rounded-xl border border-red-100 dark:border-red-900/10 space-y-5 text-[11px]">
                    <div className="font-bold text-slate-800 dark:text-white text-xs">🚀 دليل الربط السحابي الحقيقي لجميع أنواع الاستضافات:</div>
                    
                    <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                      {/* cPanel / Shared Hosting */}
                      <div className="space-y-1">
                        <p className="font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <span>1. الاستضافات المشتركة ولوحة تحكم cPanel:</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed pr-2">
                          صممنا لك ملفات API مكتوبة بـ <strong>PHP الأصلية</strong> في مسار <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">public/api/</code> وهي متوافقة تماماً وبشكل فوري مع أي استضافة مشتركة! 
                          فقط قم ببناء الكود (<code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold text-indigo-600">npm run build</code>) وارفع كود مجلد <code className="font-bold">dist</code> الناتج كاملاً لـ <code className="font-mono">public_html</code>.
                        </p>
                      </div>

                      {/* Static hosting */}
                      <div className="space-y-1 pt-3">
                        <p className="font-extrabold text-indigo-600 dark:text-indigo-400">
                          <span>2. استضافة Cloudflare Pages للواجهات (Static SPA):</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed pr-2">
                          بما أنك تستخدم Cloudflare Pages الآن، قمنا ببرمجة مجلد <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">functions/api/</code> داخل المشروع ليتكامل تلقائياً مع خوادمهم وبدون الحاجة لخادم Node.js خلفي!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-red-200/40 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">هل تريد تجاوز هذا الفحص وحفظ وتفعيل الدومين محلياً فوراً لتجربة لوحة التحكم؟</span>
                    <button
                      type="button"
                      onClick={handleActivateDemoMode}
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-450 font-black rounded-lg border border-indigo-200/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition text-[10px] cursor-pointer"
                    >
                      تفعيل الدومين الآن (وضع المحاكاة) ⚡
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button 
                  type="button"
                  onClick={handleSaveDomain}
                  disabled={domainStatus === 'verifying' || isSaving || !customDomain}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-55"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>جاري تسجيل النطاق برمجياً...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>حفظ وتأكيد الدومين تلقائياً 📥</span>
                    </>
                  )}
                </button>

                {domainStatus !== 'none' && (
                  <button 
                    type="button"
                    onClick={handleDisconnect}
                    disabled={domainStatus === 'verifying' || isSaving}
                    className="bg-transparent hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    إلغاء ربط النطاق الحالي
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* DNS Configuration Table and details */}
          {(domainStatus !== 'none' || cfDetails || settings.domainDNSRecords) && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5 mb-6 gap-4 md:gap-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <RefreshCw size={18} />
                  </div>
                  <span className="font-bold text-lg md:text-xl text-slate-900 dark:text-white" dir="ltr">{customDomain || settings.customDomain}</span>
                  
                  {domainStatus === 'active' || (settings.domainStatus === 'active' && !domainStatus) ? (
                    <span className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      متصل ونشط
                    </span>
                  ) : domainStatus === 'pending_validation' || domainStatus === 'pending' ? (
                    <span className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50 text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      بانتظار التوثيق
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50 text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      غير متصل
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleVerify}
                    disabled={domainStatus === 'verifying'}
                    className={`px-6 py-2.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all ${
                      domainStatus === 'active' 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 cursor-default' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {domainStatus === 'verifying' ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>جاري التحقق...</span>
                      </>
                    ) : domainStatus === 'active' ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>تحقق ناجح</span>
                      </>
                    ) : (
                      <>
                        <span>تحقق من الاتصال</span>
                        <CheckCircle2 size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">خطوات الربط والـ DNS</h3>
                  <ul className="space-y-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 flex items-center justify-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">1</span>
                      <span className="pt-1">اذهب إلى لوحة التحكم في الموقع الذي يستضيف الدومين الخاص بك (GoDaddy, Namecheap, Hostinger, GoDaddy ... إلخ).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 flex items-center justify-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">2</span>
                      <span className="pt-1">انتقل إلى إعدادات إدارة سجلات DNS (DNS Management).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 flex items-center justify-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">3</span>
                      <span className="pt-1">احذف أي سجلات قديمة تشير للروت (@) أو الـ (www)، ثم أضف السجلين التاليين من نوع CNAME ليشيروا إلى <code className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">fallback.abdomedi.com</code>:</span>
                    </li>
                  </ul>
                </div>

                {/* DNS Records Table */}
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 text-xs shadow-sm">
                  <div className="grid grid-cols-4 bg-slate-50/50 dark:bg-slate-800/20 py-4 px-4 font-bold text-slate-500 dark:text-slate-400 text-center border-b border-slate-100 dark:border-slate-800">
                    <div>النوع</div>
                    <div>الاسم</div>
                    <div>القيمة / Target</div>
                    <div>TTL</div>
                  </div>

                  {/* Record 1: CNAME for root (@) */}
                  <div className="grid grid-cols-4 py-5 px-4 text-center border-b border-slate-100 dark:border-slate-800 items-center">
                    <div className="font-mono text-slate-800 dark:text-slate-200 font-medium">CNAME</div>
                    <div className="font-mono text-slate-600 dark:text-slate-400">@</div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all font-medium" dir="ltr">
                        fallback.abdomedi.com
                      </div>
                      <button 
                        onClick={() => handleCopy('fallback.abdomedi.com', 'arecord')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      >
                        {copiedText === 'arecord' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="font-mono text-slate-600 dark:text-slate-400">Auto</div>
                  </div>

                  {/* Record 2: CNAME for www */}
                  <div className="grid grid-cols-4 py-5 px-4 text-center border-b border-slate-100 dark:border-slate-800 items-center">
                    <div className="font-mono text-slate-800 dark:text-slate-200 font-medium">CNAME</div>
                    <div className="font-mono text-slate-600 dark:text-slate-400">www</div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all font-medium" dir="ltr">
                        fallback.abdomedi.com
                      </div>
                      <button 
                        onClick={() => handleCopy('fallback.abdomedi.com', 'cname')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      >
                        {copiedText === 'cname' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="font-mono text-slate-600 dark:text-slate-400">Auto</div>
                  </div>

                  {/* TXT Records from Cloudflare */}
                  {(cfDetails || settings.domainDNSRecords) && (
                    <>
                      {/* Record 3: Ownership Verification TXT */}
                      {(cfDetails?.ownership_verification || settings.domainDNSRecords?.ownership_verification) && (
                        <div className="grid grid-cols-4 py-5 px-4 text-center items-center border-b border-slate-100 dark:border-slate-800 bg-indigo-50/20 dark:bg-indigo-900/10">
                          <div className="font-mono text-slate-800 dark:text-slate-200 font-medium text-[10px]">TXT (Ownership)</div>
                          <div className="font-mono text-slate-600 dark:text-slate-400" dir="ltr">
                            {(cfDetails?.ownership_verification?.name || settings.domainDNSRecords?.ownership_verification?.name || "").replace(`.${customDomain || settings.customDomain}`, '')}
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all font-medium truncate max-w-[150px]" dir="ltr">
                              {cfDetails?.ownership_verification?.value || settings.domainDNSRecords?.ownership_verification?.value}
                            </div>
                            <button 
                              onClick={() => handleCopy(cfDetails?.ownership_verification?.value || settings.domainDNSRecords?.ownership_verification?.value, 'txt-own')}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
                            >
                              {copiedText === 'txt-own' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                          <div className="font-mono text-slate-600 dark:text-slate-400">Auto</div>
                        </div>
                      )}

                      {/* Record 4: SSL Verification TXT */}
                      {(cfDetails?.ssl?.validation_records?.[0] || settings.domainDNSRecords?.ssl?.validation_records?.[0]) && (
                        <div className="grid grid-cols-4 py-5 px-4 text-center items-center bg-pink-50/20 dark:bg-pink-900/10">
                          <div className="font-mono text-slate-800 dark:text-slate-200 font-medium text-[10px]">TXT (SSL)</div>
                          <div className="font-mono text-slate-600 dark:text-slate-400" dir="ltr">
                            {(cfDetails?.ssl?.validation_records?.[0]?.txt_name || settings.domainDNSRecords?.ssl?.validation_records?.[0]?.txt_name || "").replace(`.${customDomain || settings.customDomain}`, '')}
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all font-medium truncate max-w-[150px]" dir="ltr">
                              {cfDetails?.ssl?.validation_records?.[0]?.txt_value || settings.domainDNSRecords?.ssl?.validation_records?.[0]?.txt_value}
                            </div>
                            <button 
                              onClick={() => handleCopy(cfDetails?.ssl?.validation_records?.[0]?.txt_value || settings.domainDNSRecords?.ssl?.validation_records?.[0]?.txt_value, 'txt-ssl')}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
                            >
                              {copiedText === 'txt-ssl' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                          <div className="font-mono text-slate-600 dark:text-slate-400">Auto</div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 flex items-center justify-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">4</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">تأكد من أنك قمت بإعداده بالشكل المطلوب</p>
                  </div>
                  
                  <div className="bg-amber-50/50 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center justify-center gap-2 mb-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle size={18} className="shrink-0" />
                      <p className="text-sm font-bold">يحتاج الدومين 24-48 ساعة لربطه ويظهر موقعك أونلاين على مستوى العالم</p>
                    </div>
                    <p className="text-xs text-center text-amber-600/80 dark:text-amber-500/80 font-medium font-arabic leading-relaxed">
                      يحتاج ربط الدومين الجديد وقتاً، لأن خوادم الـ DNS العالمية تبدأ في تبادل السجلات وتحديث جهة توجيه الزوار تدريجياً.
                    </p>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </div>

        {/* Informational Right Sidebar */}
        <div className="space-y-6">
          
          {/* Active store address summary block */}
          {(settings.subdomain || customDomain) ? (
            <div className="bg-slate-900 text-white p-6 rounded-3xl border border-indigo-950 shadow-md space-y-4">
              <h4 className="font-black text-xs text-indigo-400 tracking-wider">الروابط النشطة لمتجرك المباشر 🔗</h4>
              
              <div className="space-y-3 pt-1">
                {settings.subdomain && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">الرابط الفرعي المجاني:</span>
                    <a 
                      href={`http://${settings.subdomain}.abdomedi.com`} 
                      target="_blank" 
                      className="text-xs font-mono text-indigo-300 hover:underline flex items-center gap-1 shrink-0 break-all"
                      dir="ltr"
                    >
                      <span>{settings.subdomain}.abdomedi.com</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                {customDomain && (
                  <div className="space-y-1 pt-1 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">النطاق الخاص المخصص:</span>
                    <a 
                      href={`http://${customDomain}`} 
                      target="_blank" 
                      className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 shrink-0 break-all"
                      dir="ltr"
                    >
                      <span>{customDomain}</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Why bind domain cards */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Link2 size={16} className="text-indigo-500" />
              <span>لماذا نطاق مخصص لمشروعك؟</span>
            </h3>
            
            <ul className="space-y-3.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span><strong className="text-slate-800 dark:text-slate-200">هوية مستقلة:</strong> يظهر اسم متجرك بشكل مميز لدى العملاء وتتخلص من روابط الأنظمة الفرعية الطويلة.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span><strong className="text-slate-800 dark:text-slate-200">محركات البحث SEO:</strong> الدومينات المخصصة المستقلة تحظى بـ 10 أضعاف الثقة في أرشفة Google وتصنيفات البحث.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span><strong className="text-slate-800 dark:text-slate-200">أمان كامل SSL:</strong> يوفر نظامنا شهادة تصفح آمنة وتشفير مجاني مدي الحياة (https) عند تفعيل الدومين.</span>
              </li>
            </ul>
          </div>

          {/* DNS Instructions FAQ */}
          <div className="bg-gradient-to-br from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle size={16} className="text-indigo-500" />
              <span>دليل سريع للربط</span>
            </h3>

            <div className="space-y-3.5 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-2">
                <p className="font-bold text-slate-705 dark:text-slate-350">أين أجد سجلات DNS؟</p>
                <p>ابحث عن خيار باسم DNS Management أو Name Servers أو Manage DNS في حساب الشركة التي اشتريت منها الدومين.</p>
              </div>

              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-2">
                <p className="font-bold text-slate-705 dark:text-slate-350">هل يمكنني ربط دومين فرعي؟</p>
                <p>نعم، بكل تأكيد! يمكنك إدخال دومين مثل <span className="font-bold" dir="ltr">shop.example.com</span> وإكمال الخطوات بنجاح.</p>
              </div>

              <div>
                <p className="font-bold text-slate-705 dark:text-slate-350 font-arabic">هل شهادة الـ SSL آمنة؟</p>
                <p>نعم، يتم إصدارها وتشفيرها تلقائياً بالكامل دون أي رسوم إضافية لضمان حماية بيانات عملائك وسلات التسوق.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Modal Prompt */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full overflow-hidden"
          >
            <div className={`p-8 text-center space-y-4`}>
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                modal.type === 'success' ? 'bg-green-100 text-green-600' :
                modal.type === 'error' ? 'bg-red-100 text-red-600' :
                modal.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                'bg-indigo-100 text-indigo-600'
              }`}>
                {modal.type === 'success' && <CheckCircle2 size={32} />}
                {modal.type === 'error' && <AlertTriangle size={32} />}
                {modal.type === 'warning' && <AlertTriangle size={32} />}
                {modal.type === 'info' && <Info size={32} />}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{modal.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  {modal.message}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
              {modal.isConfirm && (
                <button
                  onClick={() => setModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 transition duration-200"
                >
                  إلغاء
                </button>
              )}
              <button
                onClick={() => {
                  if (modal.onConfirm) modal.onConfirm();
                  setModal(prev => ({ ...prev, show: false }));
                }}
                className={`flex-1 px-6 py-3 rounded-2xl font-black text-white shadow-lg transition duration-200 ${
                  modal.type === 'error' ? 'bg-red-600 hover:bg-red-700' :
                  modal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {modal.buttonText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
