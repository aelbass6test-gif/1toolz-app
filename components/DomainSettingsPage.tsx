import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Globe, RefreshCw, CheckCircle2, AlertTriangle, ArrowLeftRight, HelpCircle, Save, ExternalLink, Link2, Copy, Check } from 'lucide-react';

interface DomainSettingsPageProps {
  activeStoreId: string;
  storeData: any;
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export const DomainSettingsPage: React.FC<DomainSettingsPageProps> = ({ 
  activeStoreId, 
  storeData, 
  settings, 
  setSettings 
}) => {
  const [customDomain, setCustomDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState<'none' | 'pending' | 'verifying' | 'active'>('none');
  const [cfDetails, setCfDetails] = useState<any>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<{
    type: '405' | '404' | 'json' | 'generic' | null;
    message: string;
  } | null>(null);

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

  const handleSaveDomain = async () => {
    if (!customDomain.trim()) {
      alert("يرجى إدخال اسم نطاق صحيح (مثال: mystoredomain.com)");
      return;
    }
    
    // Simple regex check for domain
    const cleanDomain = customDomain
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '') // Remove any trailing paths
      .replace(/[^a-zA-Z0-9.-]/g, '') // Remove hidden chars, spaces, and invalid symbols
      .toLowerCase();
    
    if (!cleanDomain) {
      alert("يرجى إدخال اسم نطاق صحيح");
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
      
      // Save to global setSettings for SaaS configurations
      setSettings((prev: any) => ({
        ...prev,
        customAppDomain: `https://${cleanDomain}`
      }));

      alert(data.message || `⚡ تم تسجيل النطاق ${cleanDomain} بنجاح عبر API! يرجى إعداد سجلات الـ DNS في لوحة تحكم نطاقك لتبدأ شهادة SSL بالعمل.`);
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
      alert(`⚠️ خطأ: ${err.message === "405_METHOD_NOT_ALLOWED" ? "لقد تم رفع ملفات الـ Static فقط على الاستضافة ولا يوجد Node backend تشغيلي نشط (خطأ 405)." : err.message}`);
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
        alert("🎉 مبارك! تم التحقق من ربط النطاق بنجاح وهو الآن نشط ومحمي بشهادة SSL آمنة ومجانية.");
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
        alert(`ℹ️ حالة النطاق: ${statusText}\nيرجى التأكد من توجيه سجلات الـ DNS (خاصة TXT) بشكل صحيح والانتظار قليلاً.`);
      }
    } catch (err: any) {
      console.error(err);
      setDomainStatus('pending');
      if (err.message === "405_METHOD_NOT_ALLOWED") {
        setBackendError({
          type: '405',
          message: "خطأ 405 (Method Not Allowed) أثناء فحص السجلات. الاستضافة تدعم الملفات الثابتة فقط حالياً."
        });
      } else if (err.message === "JSON_PARSE_ERROR") {
        setBackendError({
          type: 'json',
          message: "لم نستطع قراءة رد فحص الدومين لأن السيرفر أرجع صفحة HTML بدلاً من JSON."
        });
      } else {
        alert(`❌ حدث خطأ: ${err.message}`);
      }
      alert(`⚠️ خطأ أثناء الفحص: ${err.message}`);
    }
  };

  const handleActivateDemoMode = () => {
    if (!customDomain.trim()) {
      alert("يرجى إدخال اسم نطاق أولاً.");
      return;
    }
    const cleanDomain = customDomain
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '')
      .replace(/[^a-zA-Z0-9.-]/g, '')
      .toLowerCase();
    setCustomDomain(cleanDomain);
    
    localStorage.setItem(`custom_domain_${activeStoreId}`, cleanDomain);
    localStorage.setItem(`custom_domain_status_${activeStoreId}`, 'active');
    setDomainStatus('active');
    
    setSettings((prev: any) => ({
      ...prev,
      customAppDomain: `https://${cleanDomain}`
    }));
    
    setBackendError(null);
    alert(`⚡ [وضع المحاكاة النشط]: تم تفعيل وحفظ الدومين ${cleanDomain} بنجاح محلياً لتجربته في المتجر ولوحة التحكم!`);
  };

  const handleDisconnect = () => {
    if (confirm("هل أنت متأكد من حذف وإلغاء ربط النطاق المخصص؟")) {
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
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

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
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">ربط نطاق مخصص (Custom Domain)</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">اربط متجرك وعلامتك التجارية بدومين احترافي خاص بك لزيادة مبيعاتك وثقة عملائك.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {domainStatus === 'active' ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 text-xs font-black rounded-xl border border-green-200/50 dark:border-green-900/30">
              <CheckCircle2 size={14} />
              <span>النطاق متصل بالكامل وجاهز 🚀</span>
            </span>
          ) : domainStatus === 'pending' || domainStatus === 'verifying' ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-black rounded-xl border border-amber-200/50 dark:border-amber-900/40 animate-pulse">
              <AlertTriangle size={14} />
              <span>بانتظار إعداد وتفعيل الـ DNS 🟡</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700">
              <span>غير مربوط بنطاق مخصص 🛡️</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Input custom Domain */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              <span>أدخل اسم النطاق (الدومين) الخاص بك</span>
            </h2>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                هل اشتريت دوميناً من GoDaddy أو Namecheap أو Cloudflare؟ اكتب عنوان الدومين هنا (مثال: <span className="font-semibold text-slate-700 dark:text-slate-350" dir="ltr">mystore.com</span>) لربطه بنظام إدارة الأوردرات والمتجر الإلكتروني فورياً.
              </p>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  disabled={domainStatus === 'verifying'}
                  placeholder="www.your-example-store.com"
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-left"
                  dir="ltr"
                />
              </div>

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
                          <span>1. الاستضافات المشتركة ولوحة تحكم cPanel (مثل GoDaddy أو Namecheap أو Bluehost):</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed pr-2">
                          صممنا لك ملفات API مكتوبة بـ <strong>PHP الأصلية</strong> في مسار <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">public/api/</code> وهي متوافقة تماماً وبشكل فوري مع أي استضافة مشتركة! 
                          فقط قم ببناء الكود (<code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold text-indigo-600">npm run build</code>) وارفع كود مجلد <code className="font-bold">dist</code> الناتج كاملاً لـ <code className="font-mono">public_html</code>. ثم افتح ملف <code className="font-mono text-red-600 dark:text-red-400">api/domains/add/index.php</code> على مدير ملفات cPanel، وضع الـ <code className="font-mono">API Token</code> والـ <code className="font-mono">Zone ID</code> لحسابك وسيعمل الربط الحقيقي 100% تلقائياً دون الحاجة لاستضافة Hostinger!
                        </p>
                      </div>

                      {/* VPS */}
                      <div className="space-y-1 pt-3">
                        <p className="font-extrabold text-indigo-600 dark:text-indigo-400">
                          <span>2. خادمك الخاص VPS (سواء Ubuntu أو Windows Server):</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed pr-2">
                          قم بتشغيل خادم الـ Node.js backend المكتوب في <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">server.ts</code>. نفّذ أمر البناء وتأكد من تشغيل Node.js بإنشاء خدمة أو باستعمال PM2 على بورت 3000، وقم بتهيئة Nginx كـ Reverse Proxy لتوجيه مسارات الـ <code className="font-mono">/api</code> السحابية حقيقياً.
                        </p>
                      </div>

                      {/* Static hosting */}
                      <div className="space-y-1 pt-3">
                        <p className="font-extrabold text-indigo-600 dark:text-indigo-400">
                          <span>3. استضافة Cloudflare Pages للواجهات (Static SPA):</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed pr-2">
                          بما أنك تستخدم Cloudflare Pages الآن، قمنا ببرمجة مجلد <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">functions/api/</code> داخل المشروع ليتكامل تلقائياً مع خوادمهم وبدون الحاجة لخادم Node.js خلفي!
                          فقط ارفع الكود الجديد إلى مستودعك، ثم من لوحة تحكم Cloudflare Pages اذهب إلى (<strong>Settings</strong>) ثم (<strong>Environment variables</strong>)، وأضف المتغيرات <code className="font-mono text-[10px]">CLOUDFLARE_API_TOKEN</code> و <code className="font-mono text-[10px]">CLOUDFLARE_ZONE_ID</code> وسيعمل الربط الحقيقي 100% فوراً. أو يمكنك تفعيل وضع المحاكاة أدناه لتجربته محلياً.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-red-200/40 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">هل تريد تجاوز هذا الفحص وحفظ وتفعيل الدومين محلياً فوراً لتجربة لوحة التحكم؟</span>
                    <button
                      type="button"
                      onClick={handleActivateDemoMode}
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-455 font-black rounded-lg border border-indigo-200/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition text-[10px] cursor-pointer"
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
                  disabled={domainStatus === 'verifying' || isSaving}
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

          {/* Step 2: DNS configuration records */}
          {domainStatus !== 'none' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
            >
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                <span>إعداد سجلات الـ DNS في لوحة تحكم النطاق</span>
              </h2>

              <div className="space-y-4">
                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-800/30">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">الإرشادات</h3>
                  <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full border border-indigo-200 bg-white dark:bg-slate-800 dark:border-indigo-800 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">1</span>
                      <span>اذهب إلى لوحة التحكم في الموقع الذي يستضيف الدومين الخاص بك.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full border border-indigo-200 bg-white dark:bg-slate-800 dark:border-indigo-800 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">2</span>
                      <span>انتقل إلى إعدادات إدارة ملفات DNS الخاصة بالدومين.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full border border-indigo-200 bg-white dark:bg-slate-800 dark:border-indigo-800 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">3</span>
                      <span><strong className="text-red-500">احذف سجلات A</strong> الخاصة بالنطاق (@) وأيضاً <strong className="text-red-500">سجلات AAAA</strong>، ثم أضف سجلات CNAME من الجدول أدناه.</span>
                    </li>
                  </ul>
                </div>

                {/* DNS Records Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/30 text-xs">
                  <div className="grid grid-cols-4 bg-slate-100 dark:bg-slate-800 py-3 px-4 font-black text-slate-700 dark:text-slate-300 text-center border-b border-slate-200 dark:border-slate-700">
                    <div>النوع (Type)</div>
                    <div>الاسم (Host/Name)</div>
                    <div>القيمة المستهدفة (Value/Points to)</div>
                    <div>نسخ سريع</div>
                  </div>

                  {/* Record 1: CNAME for root (@) */}
                  <div className="grid grid-cols-4 py-4 px-4 text-center border-b border-slate-200 dark:border-slate-850 items-center">
                    <div className="font-mono bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-indigo-400 py-1 px-2 rounded-lg text-[10px] w-fit mx-auto font-bold">CNAME</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">@</div>
                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all font-semibold" dir="ltr">
                      {window.location.hostname}
                    </div>
                    <div>
                      <button 
                        onClick={() => handleCopy(window.location.hostname, 'arecord')}
                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 justify-center mx-auto cursor-pointer"
                      >
                        {copiedText === 'arecord' ? (
                          <>
                            <Check size={12} className="text-green-500" />
                            <span>تم!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>نسخ</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Record 2: CNAME for www */}
                  <div className="grid grid-cols-4 py-4 px-4 text-center items-center border-slate-200 dark:border-slate-850">
                    <div className="font-mono bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 py-1 px-2 rounded-lg text-[10px] w-fit mx-auto font-bold">CNAME</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">www</div>
                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all truncate shrink px-1" dir="ltr">
                      {customDomain}
                    </div>
                    <div>
                      <button 
                        onClick={() => handleCopy(customDomain, 'cname')}
                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 justify-center mx-auto cursor-pointer"
                      >
                        {copiedText === 'cname' ? (
                          <>
                            <Check size={12} className="text-green-500" />
                            <span>تم!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>نسخ</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Cloudflare Validation Records */}
                  {cfDetails?.ownership_verification?.name && (
                    <div className="grid grid-cols-4 py-4 px-4 text-center items-center border-t border-slate-200 dark:border-slate-850 bg-indigo-50/30 dark:bg-indigo-900/10">
                      <div className="font-mono bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 py-1 px-2 rounded-lg text-[10px] w-fit mx-auto font-bold">TXT (التحقق)</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 select-all text-[11px] truncate px-1" dir="ltr">{cfDetails.ownership_verification.name.replace(`.${customDomain}`, '')}</div>
                      <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all truncate px-1" dir="ltr">
                        {cfDetails.ownership_verification.value}
                      </div>
                      <div>
                        <button 
                          onClick={() => handleCopy(cfDetails.ownership_verification.value, 'txt-own')}
                          className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 justify-center mx-auto cursor-pointer"
                        >
                          {copiedText === 'txt-own' ? (
                            <>
                              <Check size={12} className="text-green-500" />
                              <span>تم!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {cfDetails?.ssl?.validation_records?.[0]?.txt_name && (
                    <div className="grid grid-cols-4 py-4 px-4 text-center items-center border-t border-slate-200 dark:border-slate-850 bg-pink-50/30 dark:bg-pink-900/10">
                      <div className="font-mono bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 py-1 px-2 rounded-lg text-[10px] w-fit mx-auto font-bold">TXT (شهادة SSL)</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 select-all text-[11px] truncate px-1" dir="ltr">{cfDetails.ssl.validation_records[0].txt_name.replace(`.${customDomain}`, '')}</div>
                      <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all truncate px-1" dir="ltr">
                        {cfDetails.ssl.validation_records[0].txt_value}
                      </div>
                      <div>
                        <button 
                          onClick={() => handleCopy(cfDetails.ssl.validation_records[0].txt_value, 'txt-ssl')}
                          className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 justify-center mx-auto cursor-pointer"
                        >
                          {copiedText === 'txt-ssl' ? (
                            <>
                              <Check size={12} className="text-green-500" />
                              <span>تم!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-2 mb-2 p-2 px-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span className="w-5 h-5 rounded-full border border-emerald-200 bg-white dark:bg-slate-800 dark:border-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">4</span>
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">تأكد من أنك قمت بإعداده بالشكل المطلوب</p>
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                    <div className="flex gap-2 items-start text-amber-800 dark:text-amber-400">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold">يحتاج الدومين 24 ساعة لربطه ويظهر موقعك أونلاين على مستوى العالم</p>
                        <p className="text-[10px] leading-relaxed opacity-90">
                          يحتاج ربط الدومين 24 ساعة، لأن تغييرات DNS تستغرق وقتاً للظهور.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verify DNS mapping card */}
                <div className="pt-4 flex items-center justify-end flex-wrap gap-4">
                  
                  <button 
                    type="button"
                    onClick={handleVerify}
                    disabled={domainStatus === 'verifying'}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all ${
                      domainStatus === 'active' 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {domainStatus === 'verifying' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>جاري التحقق...</span>
                      </>
                    ) : domainStatus === 'active' ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>تم الربط بنجاح</span>
                      </>
                    ) : (
                      <>
                        <span>تحقق</span>
                        <CheckCircle2 size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}


        </div>

        {/* Informational Right Sidebar */}
        <div className="space-y-6">
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
                <p className="font-bold text-slate-700 dark:text-slate-300">أين أجد سجلات DNS؟</p>
                <p>ابحث عن خيار باسم DNS Management أو Name Servers أو Manage DNS في حساب الشركة التي اشتريت منها الدومين.</p>
              </div>

              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-2">
                <p className="font-bold text-slate-700 dark:text-slate-300">هل يمكنني ربط دومين فرعي؟</p>
                <p>نعم، بكل تأكيد! يمكنك إدخال دومين مثل <span className="font-bold" dir="ltr">shop.example.com</span> وإكمال الخطوات بنجاح.</p>
              </div>

              <div>
                <p className="font-bold text-slate-705 dark:text-slate-300">هل شهادة الـ SSL آمنة؟</p>
                <p>نعم، يتم إصدارها وتشفيرها تلقائياً بالكامل دون أي رسوم إضافية لضمان حماية بيانات عملائك وسلات التسوق.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
