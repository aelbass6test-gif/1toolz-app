import React, { useState, useEffect } from 'react';
import { Sparkles, X, ChevronLeft, Bell, Star, CloudLightning, HelpCircle, HardDrive, Smartphone, Share2, CheckCircle2, ArrowLeft } from 'lucide-react';

interface UpdateItem {
  id: string;
  title: string;
  category: 'smart' | 'new' | 'performance' | 'system';
  categoryLabel: string;
  colorClass: string;
  desc: string;
  actionLabel?: string;
  interactiveContent?: React.ReactNode;
}

interface SmartUpdatesWidgetProps {
  primaryColor?: string;
  isAdminView?: boolean;
}

export const SmartUpdatesWidget: React.FC<SmartUpdatesWidgetProps> = ({ 
  primaryColor = '#4f46e5',
  isAdminView = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewHighlight, setHasNewHighlight] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UpdateItem | null>(null);
  const [testAppRating, setTestAppRating] = useState<number | null>(null);
  const [copiedFeature, setCopiedFeature] = useState<string | null>(null);

  // Check unique key in localStorage so we show active pulsing badge if unseen
  const STORAGE_KEY = isAdminView ? 'wuilt_merchant_updates_seen_v2' : 'wuilt_client_updates_seen_v2';
  const LATEST_VERSION = '2.5';

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen !== LATEST_VERSION) {
      setHasNewHighlight(true);
    }
  }, [STORAGE_KEY]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasNewHighlight(false);
    localStorage.setItem(STORAGE_KEY, LATEST_VERSION);
  };

  const shareStoreApp = () => {
    if (navigator.share) {
      navigator.share({
        title: 'متجرنا الإلكتروني الذكي',
        text: 'تصفح منتجاتنا المميزة واطلب بنقرة واحدة مباشرة من تطبيقنا السريع!',
        url: window.location.origin
      }).catch(err => console.log(err));
    } else {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedFeature('share');
      setTimeout(() => setCopiedFeature(null), 3000);
    }
  };

  // 📦 Customer System Features
  const clientUpdates: UpdateItem[] = [
    {
      id: 'pwa-install',
      title: 'تثبيت تطبيق متجرنا الإلكتروني 📱',
      category: 'smart',
      categoryLabel: 'تطبيق ذكي',
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      desc: 'يمكنك الآن إضافتنا كأيقونة على شاشة جوالك الرئيسية لطلب المنتجات مباشرة، تصفح الكتالوج حتى لو انقطع معك الإنترنت تماماً!',
      actionLabel: 'تثبيت البرنامج',
      interactiveContent: (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl text-right mt-2 space-y-3">
          <p className="text-xs text-slate-550 dark:text-slate-400 leading-relaxed font-bold">
            💡 كيف تقوم بالتحميل؟
          </p>
          <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5 list-disc list-inside">
            <li>لهواتف الآيفون (iOS): اضغط زر المشاركة <span className="underline">Share</span> ثم <span className="underline">"إضافة إلى الشاشة الرئيسية"</span>.</li>
            <li>لهواتف الأندرويد: اضغط زر الخيارات في المتصفح ثم <span className="underline">"تثبيت التطبيق"</span> وسيكون متجرك نشطاً فوراً!</li>
          </ul>
          <button 
            onClick={shareStoreApp}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 hover:scale-[1.01] transition-all cursor-pointer"
          >
            <Smartphone size={14} />
            <span>{copiedFeature === 'share' ? '✓ تم نسخ رابط المتجر للتثبيت' : 'مشاركة رابط التطبيق لتثبيته'}</span>
          </button>
        </div>
      )
    },
    {
      id: 'storefront-live-tracking',
      title: 'أداة تتبع الطلبات المباشرة 📦',
      category: 'new',
      categoryLabel: 'تتبع حيّ',
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      desc: 'لم تعد بحاجة لتذكر أرقام تتبع طويلة، فقط أدخل رقم هاتفك المسجل لدينا وسيعرض لك الذكاء الاصطناعي حالة طلبك الحالية، هل هو قيد التجهيز أو في سيارة الشحن!',
      actionLabel: 'جرب التتبع الآن',
      interactiveContent: (
        <div className="bg-slate-550/15 p-3 rounded-2xl border border-dashed border-indigo-200 dark:border-slate-800 mt-2">
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed">
            🔍 يمكنك تجربة هذه الميزة بالذهاب لصفحة "تتبع الطلب" في الجزء السفلي أو تصفح القائمة لمعرفة تقدم بوابات الشحن.
          </p>
        </div>
      )
    },
    {
      id: 'ai-search',
      title: 'البحث المطور الذكي بالمنتجات 🔍',
      category: 'performance',
      categoryLabel: 'فلترة ذكية',
      colorClass: 'bg-indigo-505/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      desc: 'فرز وبحث فوري بنقرة واحدة مع قراءة فورية للمقاسات والمواصفات والألوان وتقييمات العملاء لضمان أفضل تجربة تسوق.',
    },
    {
      id: 'bosta-address-validation',
      title: 'بوابة الشحن السريع لبورصة الشحن المصرية 🗺️',
      category: 'system',
      categoryLabel: 'شحن ذكي',
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      desc: 'تم دمج محافظات مصر لتحديد الرسوم بدقة وربط طلبك آلياً مع مناديب شركة الشحن Bosta لتسهيل وتنسيق التوصيل لك حتى الباب.',
    },
    {
      id: 'rating-system',
      title: 'رأيك يهمنا دائماً! ⭐',
      category: 'smart',
      categoryLabel: 'تقييم تفاعلي',
      colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      desc: 'مراجعات المنتجات أصبحت حقيقية وتفاعلية. يمكنك مشاركة تجربتك وتقييم جودة خامات المنتجات التي اشتريتها لمساعدة العملاء الآخرين وتطوير متجرنا.',
      interactiveContent: (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl mt-2 text-right">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-bold">قيم تجربتك الكلية مع نظامنا الذكي:</p>
          <div className="flex gap-2 justify-center py-2 flex-row-reverse">
            {[5, 4, 3, 2, 1].map((star) => (
              <button 
                key={star} 
                onClick={() => setTestAppRating(star)}
                className={`p-1.5 rounded-lg transition-all hover:scale-115 cursor-pointer ${testAppRating && testAppRating >= star ? 'text-amber-400' : 'text-slate-350 dark:text-slate-650'}`}
              >
                <Star size={24} fill={testAppRating && testAppRating >= star ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          {testAppRating && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold text-center mt-1 animate-pulse">
              ❤️ شكراً جزيلاً لتقييمك! نحن نعمل على تقديم أفضل المستويات لأجلك.
            </p>
          )}
        </div>
      )
    }
  ];

  // 📦 Merchant System Features
  const merchantUpdates: UpdateItem[] = [
    {
      id: 'live-cloud-sync-verified',
      title: 'الربط السحابي المباشر (Firebase Verified) ✅',
      category: 'system',
      categoryLabel: 'ربط أونلاين',
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      desc: 'تم التأكد من ربط لوحة التحكم والبيانات بالسحابة العالمية لـ Google Cloud و Firebase. بياناتك الآن مشفرة ومحفوظة أونلاين بشكل لحظي لضمان عدم فقدان أي أوردر حتى لو غيرت جهازك.',
    },
    {
      id: 'instant-subdomains',
      title: 'ربط النطاقات الاحترافية الفوري 🌐',
      category: 'smart',
      categoryLabel: 'إعداد نطاقات',
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      desc: 'إضافة نطاقاتك المخصصة بضغطة زر وتحديد سجلات DNS مثل (A records, CNAME Records, TXT Record لصالح تملك النطاق وتمرير SSL السحابية) بمحاكاة السيرفر آلياً دون الحاجة لشرح تقني معقد.',
      actionLabel: 'ربط نطاقي الآن'
    },
    {
      id: 'local-sync-engine',
      title: 'لوحة قياس المزامنة وصحة الـ Ping 🟢',
      category: 'new',
      categoryLabel: 'مزامنة فورتكس',
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      desc: 'تم ترقية الهيدر الذكي في نظام لوحة التحكم لعرض حجم الإحصائيات (قيمة الطلبات المسجلة بـ IndexedDB) وإتاحة قياس سرعة الاتصال بالسيرفر بشكل حي مع إمكانية المزامنة السحابية فائق الأداء.'
    },
    {
      id: 'dynamic-cashiers',
      title: 'الخزينة النقدية الذكية المتعددة 🏦',
      category: 'performance',
      categoryLabel: 'إدارة أرباح',
      colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      desc: 'دعم تعدد الخزن المالية (Vodafone Cash، خزنة رئيسية، بطاقة مدى أو الحساب البنكي) مع تتبع كامل للمعاملات والتقارير المالية والتحصيلات في لحظتها.'
    },
    {
      id: 'whatsapp-automation',
      title: 'بوابة إرسال وحجز قنوات الواتساب 💬',
      category: 'system',
      categoryLabel: 'أتمتة المبيعات',
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      desc: 'أطلق حملاتك الترويجية أو أرسل رسائل تأكيد الطلبات للعملاء مباشرة بشريط إرسال ديناميكي عبر قوالب معبأة ببيانات العميل واسمه ورقم الأوردر لقفل البيعات بسرعة.'
    },
    {
      id: 'speed-boost-v2',
      title: 'ترقية سرعة التنقل الشامل بفلترة بصرية ⚡',
      category: 'performance',
      categoryLabel: 'تحسين شامل',
      colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      desc: 'تم استخدام تقنيات React العلوية والأيقونات الفيكتورية لضمان تحميل صفحات الطلبات وتخصيص قوالب الألوان خلال 30 جزء من الثانية كأعلى أداء ممكن.'
    }
  ];

  const currentList = isAdminView ? merchantUpdates : clientUpdates;

  return (
    <>
      {/* Invisible/Floating Glowing Indicator Trigger Button */}
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[100] font-sans">
        <button
          onClick={handleOpen}
          style={{ backgroundColor: !isAdminView ? primaryColor : undefined }}
          className={`group relative p-4 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer ${
            isAdminView ? 'bg-indigo-650 hover:bg-indigo-755 shadow-indigo-600/20' : 'shadow-black/15'
          }`}
          title="ما الجديد؟ اضغط للاطلاع على أحدث التحديثات والميزات الذكية المضافة"
        >
          {/* Subtle glowing ring if unseen */}
          {hasNewHighlight && (
            <span className="absolute inset-0 rounded-full border-2 border-white dark:border-indigo-400 animate-ping opacity-75"></span>
          )}
          
          <Sparkles size={22} className="group-hover:rotate-12 transition-transform duration-300" />
          
          {/* Unread dot indicator */}
          {hasNewHighlight && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-black items-center justify-center text-white">!</span>
            </span>
          )}
        </button>
      </div>

      {/* Slide-over Drawer with Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-[110] font-sans text-right select-none" dir="rtl">
          {/* Backdrop */}
          <div 
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
          ></div>

          {/* Drawer Inner Panel */}
          <div className="absolute top-0 bottom-0 right-0 w-full max-w-md bg-white dark:bg-slate-950 shadow-2xl border-l border-slate-200/60 dark:border-slate-850 flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
            
            {/* Drawer Header */}
            <div className={`p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-right relative overflow-hidden ${
              isAdminView 
                ? 'bg-indigo-50/20 dark:bg-indigo-950/20' 
                : 'bg-emerald-50/20 dark:bg-emerald-950/10'
            }`}>
              {/* Subtle background glow decorative lines */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-full filter blur-xl"></div>
              
              <div className="flex items-center gap-3 relative z-10">
                <div className={`p-2.5 rounded-2xl flex items-center justify-center ${
                  isAdminView ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white leading-none">
                    {isAdminView ? 'جديد التحديثات والتحسينات 🛠️' : 'ما الجديد في متجرنا؟ ✨'}
                  </h3>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 font-black mt-1">
                    {isAdminView ? 'الإصدار الحالي المستقر للوحة التحكم v' : 'ميزات وتطبيقات ذكية مضافة لراحتك v'}{LATEST_VERSION}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl text-slate-450 dark:text-slate-550 transition-all cursor-pointer relative z-10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body - Split into list or detail view */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-200 text-right">
              {selectedItem ? (
                /* Item Detailed Inspector screen */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <ArrowLeft size={12} className="rotate-180" />
                    <span>الرجوع لكافة التحديثات</span>
                  </button>

                  <div className="space-y-3 mt-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black border uppercase tracking-wider ${selectedItem.colorClass}`}>
                      {selectedItem.categoryLabel}
                    </span>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white leading-snug">{selectedItem.title}</h4>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
                      {selectedItem.desc}
                    </p>
                  </div>

                  {/* Interactive container if provided */}
                  {selectedItem.interactiveContent ? (
                    selectedItem.interactiveContent
                  ) : (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-start gap-3 mt-4">
                      <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0 mt-0.5">
                        <CheckCircle2 size={13} />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                        هذه الميزة مدمجة ونشطة بشكل تلقائي بنسبة 100% ولا تتطلب أي خطوات إضافية منك للاستمتاع بها.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Feature Checklist overview with rich interactions */
                <>
                  <div className="p-4 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-2xl border border-indigo-500/10 flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                      <CloudLightning size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-indigo-650 dark:text-indigo-400">تطبيق محدّث بالكامل للتجارة الذكية 🚀</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold mt-0.5">
                        نحرص دائماً على إضافة ألمع الترقيات البرمجية لتسريع الشراء وضمان تدفقات نقدية ناجحة وآمنة.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <span className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase block">التحديثات الممتازة المتوفرة حالياً:</span>
                    
                    {currentList.map((item) => (
                      <div 
                        key={item.id}
                        className="p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl transition-colors hover:border-slate-300 dark:hover:border-slate-700 flex flex-col gap-2 relative group overflow-hidden"
                      >
                        {/* Interactive Sparkle Hover effect */}
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-500 transition-all"></div>

                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border tracking-wider leading-none uppercase ${item.colorClass}`}>
                            {item.categoryLabel}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold font-mono">نشط ومستقر 🟢</span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-black text-slate-905 dark:text-slate-200 mt-1">{item.title}</h4>
                        <p className="text-[11px] text-slate-450 dark:text-slate-405 leading-relaxed font-medium truncate-3-lines">
                          {item.desc}
                        </p>

                        <button
                          onClick={() => setSelectedItem(item)}
                          className="text-[10px] p-0 font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-750 dark:hover:text-indigo-300 flex items-center gap-1 mt-1 transition-all self-end cursor-pointer"
                        >
                          <span>عرض التفاصيل والتفاعل</span>
                          <ChevronLeft size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer info */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-black">طور بكل فخر مع الذكاء الاصطناعي ⚙️</span>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <HelpCircle size={12} />
                <span>شروط مأمونية البيانات</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
