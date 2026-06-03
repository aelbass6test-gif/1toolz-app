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
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load saved domain from localStorage or storeData relative to current store
  useEffect(() => {
    if (activeStoreId) {
      const savedDomain = localStorage.getItem(`custom_domain_${activeStoreId}`) || '';
      const savedStatus = localStorage.getItem(`custom_domain_status_${activeStoreId}`) || 'none';
      setCustomDomain(savedDomain);
      setDomainStatus(savedStatus as any);
    }
  }, [activeStoreId]);

  const handleSaveDomain = async () => {
    if (!customDomain.trim()) {
      alert("يرجى إدخال اسم نطاق صحيح (مثال: mystoredomain.com)");
      return;
    }
    
    // Simple regex check for domain
    const cleanDomain = customDomain.replace(/^(https?:\/\/)?(www\.)?/, '').trim();
    setCustomDomain(cleanDomain);
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/domains/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: cleanDomain,
          storeId: activeStoreId
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "حدث خطأ غير متوقع أثناء إضافة النطاق.");
      }

      localStorage.setItem(`custom_domain_${activeStoreId}`, cleanDomain);
      
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
      setErrorMessage(err.message);
      alert(`⚠️ خطأ: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!customDomain) return;
    
    setDomainStatus('verifying');
    setErrorMessage(null);
    
    try {
      const response = await fetch('/api/domains/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: customDomain
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "فشل التحقق من حالة النطاق.");
      }

      if (data.status === 'active' && data.ssl_status === 'active') {
        setDomainStatus('active');
        localStorage.setItem(`custom_domain_status_${activeStoreId}`, 'active');
        alert("🎉 مبارك! تم التحقق من ربط النطاق بنجاح وهو الآن نشط ومحمي بشهادة SSL آمنة ومجانية.");
      } else {
        // Still pending
        setDomainStatus('pending');
        localStorage.setItem(`custom_domain_status_${activeStoreId}`, 'pending');
        
        let statusText = "النطاق ما زال قيد التحقق أو بانتظار تفعيل الـ SSL بـ Cloudflare.";
        if (data.verification_errors && data.verification_errors.length > 0) {
          statusText += `\n🔍 أخطاء التحقق: ${data.verification_errors[0].message}`;
        }
        alert(`ℹ️ حالة النطاق: ${statusText}\nيرجى التأكد من توجيه سجلات الـ DNS بشكل صحيح والانتظار قليلاً.`);
      }
    } catch (err: any) {
      console.error(err);
      setDomainStatus('pending');
      alert(`⚠️ خطأ أثناء الفحص: ${err.message}`);
    }
  };

  const handleDisconnect = () => {
    if (confirm("هل أنت متأكد من حذف وإلغاء ربط النطاق المخصص؟")) {
      setCustomDomain('');
      setDomainStatus('none');
      localStorage.removeItem(`custom_domain_${activeStoreId}`);
      localStorage.removeItem(`custom_domain_status_${activeStoreId}`);
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
                <p className="text-xs text-slate-500 leading-relaxed">
                  قم بتسجيل الدخول إلى حسابك لدى الشركة التي اشتريت منها الدومين (مثل GoDaddy أو Namecheap)، ثم توجه إلى لوحة إعدادات الـ <span className="font-bold text-slate-700 dark:text-slate-300">DNS Zones</span> وأضف السجلات التالية بدقة:
                </p>

                {/* DNS Records Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/30 text-xs">
                  <div className="grid grid-cols-4 bg-slate-100 dark:bg-slate-800 py-3 px-4 font-black text-slate-700 dark:text-slate-300 text-center border-b border-slate-200 dark:border-slate-700">
                    <div>النوع (Type)</div>
                    <div>الاسم (Host/Name)</div>
                    <div>القيمة المستهدفة (Value/Points to)</div>
                    <div>نسخ سريع</div>
                  </div>

                  {/* CNAME Record */}
                  <div className="grid grid-cols-4 py-4 px-4 text-center border-b border-slate-200 dark:border-slate-850 items-center">
                    <div className="font-mono bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-indigo-400 py-1 px-2 rounded-lg text-[10px] w-fit mx-auto font-bold">CNAME</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">www (أو أي اسم فرعي)</div>
                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all truncate shrink px-1" dir="ltr">
                      abdomedi.com
                    </div>
                    <div>
                      <button 
                        onClick={() => handleCopy('abdomedi.com', 'cname')}
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

                  {/* CNAME / A Record for main domain */}
                  <div className="grid grid-cols-4 py-4 px-4 text-center items-center">
                    <div className="font-mono bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 py-1 px-2 rounded-lg text-[10px] w-fit mx-auto font-bold">CNAME / A</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">@ (النطاق الرئيسي)</div>
                    <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 select-all font-semibold" dir="ltr">
                      fallback.abdomedi.com
                    </div>
                    <div>
                      <button 
                        onClick={() => handleCopy('fallback.abdomedi.com', 'arecord')}
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
                </div>

                <div className="space-y-2 mt-4 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                  <div className="flex gap-2 items-start text-amber-800 dark:text-amber-400">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-black">ملاحظة أمان وهام للربط:</p>
                      <p className="text-[10px] leading-relaxed opacity-90">
                        عملية تحديث الـ DNS عالمياً قد تستغرق من ساعتين إلى 24 ساعة كحد أقصى ليصبح نطاقك الجديد فعالاً بالكامل بكود التشفير المباشر SSL.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Verify DNS mapping card */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200">التحقق من صحة وسرعة الاتصال بالنطاق:</p>
                    <p className="text-[10px] text-slate-400">سيقوم برنامجنا بمحاكاة فحص السجلات عالمياً والتحقق من التوجيه الصحيح.</p>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={handleVerify}
                    disabled={domainStatus === 'verifying' || domainStatus === 'active'}
                    className={`px-5 py-3 rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all ${
                      domainStatus === 'active' 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 pointer-events-none' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {domainStatus === 'verifying' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>جاري فحص وتحديث النطاق...</span>
                      </>
                    ) : domainStatus === 'active' ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span>تم الربط بنجاح كامل 🛡️</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        <span>فحص حالة الاتصال والتحقق الآن ⚡</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* SaaS Automation & Developer Guide for SSL */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 md:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="text-base font-black">⚙️ نظام الأتمتة المتقدمة للـ SSL لكل المتاجر (SaaS Domain Automation)</h3>
                <p className="text-[11px] text-slate-350 mt-1">تفسير فني لحل مشكلة شهادة الأمان لربط الدومينات تلقائياً دون تدخل يدوي من الأدمن.</p>
              </div>
            </div>

            <div className="border border-slate-800/80 bg-slate-950/50 p-4 rounded-2xl space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <p className="font-extrabold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>تحليل سبب ظهور مشكلة (Your Connection is not Private):</span>
              </p>
              <p className="text-[11px]">
                تم توجيه سجلات الـ DNS بشكل صحيح في لوحة التحكم (الـ IP والـ CNAME). ولكن يظهر خطأ الأمان في المتصفح لأن <strong>خادم الاستقبال الأساسي لا يمتلك شهادة SSL مرخصة للدومين الجديد</strong>. المتصفحات تحظر الاتصالات بـ HTTPS فوراً إذا لم تطابق الشهادة اسم الدومين بدقة.
              </p>
              
              <div className="border-t border-slate-800/80 my-2 pt-2 space-y-2">
                <p className="font-black text-white">كيف نجعل هذا الربط تلقائياً وآمناً (Auto-SSL Seamless Linking) لجميع المتاجر؟</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                    <p className="font-bold text-indigo-400">1. استخدام Cloudflare for SaaS (الأقوى والأسهل)</p>
                    <p className="opacity-90 leading-normal">
                      تقوم بتهيئة نطاق رئيسي كـ Fallback Origin. عندما يكتب صاحب متجر دومينه المخصص، يقوم الكود عبر <strong>Cloudflare API</strong> بإرسال طلب لإضافة Custom Hostname. تقوم Cloudflare بإصدار وتجديد شهادة SSL مجانية وتلقائية فوراً دون إعادة تشغيل سيرفرك!
                    </p>
                  </div>
                  
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                    <p className="font-bold text-indigo-400">2. استخدام On-Demand TLS عبر خادم Caddy</p>
                    <p className="opacity-90 leading-normal">
                      إذا كنت تدير سيرفرك بنفسك، يمكنك استخدام واجهة <strong>Caddy Server</strong> حيث تدعم إصدار شهادات الـ SSL بشكل فوري ولحظي بمجرد استقبال أول تصفح (On-Demand TLS) من Let's Encrypt أو ZeroSSL، مما يجعل الدومينات آمنة تلقائياً مئة بالمئة بمجرد إعداد الـ DNS.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/65 p-4 rounded-xl space-y-2 border border-slate-800">
                <p className="text-[11px] font-black text-slate-200">الخطوات البرمجية لتحقيق الربط التلقائي عبر الـ API (مثال ربط الكود بـ Cloudflare):</p>
                <pre className="font-mono text-[10px] bg-black/40 p-3 rounded-lg overflow-x-auto text-emerald-400" dir="ltr">
{`// عند حفظ دومين مخصص جديد من صاحب متجر، يتم استدعاء هذا الـ endpoint في الخلفية:
import axios from 'axios';

async function registerCustomDomainInCloudflare(domainName) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  // إرسال طلب لـ Cloudflare لتقديم شهادة SSL فورية ودعم الدومين المخصص
  const response = await axios.post(
    \`https://api.cloudflare.com/client/v4/zones/\${zoneId}/custom_hostnames\`,
    {
      hostname: domainName,
      ssl: {
        method: "http", // للتحقق التلقائي وإصدار الشهادة
        type: "dv"      // Domain Validation
      }
    },
    {
      headers: {
        'Authorization': \`Bearer \${apiToken}\`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}`}
                </pre>
              </div>
            </div>
          </div>
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
