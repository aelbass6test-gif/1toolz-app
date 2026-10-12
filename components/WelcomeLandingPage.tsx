import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Package, 
  Truck, 
  ShieldCheck, 
  BarChart3, 
  Wallet, 
  Users, 
  Sparkles, 
  ArrowLeft, 
  CheckCircle2, 
  Smartphone, 
  MessageSquare, 
  ChevronRight, 
  Search, 
  Store, 
  Layers, 
  Clock, 
  TrendingUp,
  Building2,
  Lock,
  Globe,
  Star,
  Receipt,
  Headphones,
  Check,
  Send,
  PieChart
} from 'lucide-react';

export const WelcomeLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [trackInput, setTrackInput] = useState('');
  const [activeFeatureTab, setActiveFeatureTab] = useState<'orders' | 'shipping' | 'treasury' | 'pos' | 'whatsapp'>('orders');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackInput.trim()) return;
    navigate(`/track-order?search=${encodeURIComponent(trackInput.trim())}`);
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-cairo dir-rtl selection:bg-[#008060] selection:text-white" dir="rtl">
      
      {/* Dynamic Ambient Background Elements */}
      <div className="fixed top-0 right-1/4 w-[650px] h-[650px] bg-gradient-to-br from-[#008060]/12 via-emerald-400/8 to-transparent blur-[160px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-teal-500/12 via-emerald-600/8 to-transparent blur-[170px] rounded-full pointer-events-none -z-10" />

      {/* Modern Grid Overlay Pattern */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none -z-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,128,96,0.6) 1px, transparent 0)`,
          backgroundSize: '36px 36px'
        }}
      />

      {/* TOP NAVIGATION NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-emerald-100/90 shadow-2xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#008060] via-emerald-500 to-teal-400 p-[2.5px] shadow-lg shadow-emerald-700/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-white rounded-[13px] flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#008060] animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg sm:text-xl tracking-tight bg-gradient-to-r from-[#008060] via-emerald-700 to-teal-700 bg-clip-text text-transparent">
                  عبده ميديا برايم
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-[#008060] border border-emerald-200">
                  AbdoMedia Prime
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-bold">منظومة إدارة التجارة والتسويق الإلكتروني</p>
            </div>
          </div>

          {/* Center Links (Hidden on small mobile) */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-black text-slate-600">
            <a href="#features" className="hover:text-[#008060] transition-colors">المميزات التشغيلية</a>
            <a href="#shipping" className="hover:text-[#008060] transition-colors">ربط الشحن (بوسطة وتربو)</a>
            <a href="#pos" className="hover:text-[#008060] transition-colors">الكاشير POS</a>
            <a href="#tracking" className="hover:text-[#008060] transition-colors">تتبع الشحنات</a>
            <a href="#stats" className="hover:text-[#008060] transition-colors">الأرقام والإحصائيات</a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link 
              to="/employee-login"
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold transition flex items-center gap-1.5"
            >
              <Users size={14} className="text-[#008060]" />
              <span className="hidden sm:inline">دخول</span> الموظفين
            </Link>

            <Link 
              to="/owner-login"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#008060] via-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-700/20 transition active:scale-95 flex items-center gap-1.5"
            >
              <span>دخول مالك المتجر</span>
              <ArrowLeft size={14} />
            </Link>
          </div>

        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        
        {/* Top Kicker Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100/80 border border-emerald-200 text-[#008060] text-xs font-black shadow-xs mb-6 animate-fade-in">
          <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
          <span>المنصة رقم #1 لإدارة الأوردرات والشحن والسيولة في مصر والوطن العربي</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.2] max-w-4xl mx-auto">
          كل متاجرك، أوردراتك، وشحناتك <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-[#008060] via-emerald-600 to-teal-600 bg-clip-text text-transparent">
            في منصة سحابية واحدة بكل سهولة
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-sm sm:text-base text-slate-600 font-semibold max-w-2xl mx-auto leading-relaxed">
          منظومة متكاملة تتيح لك ربطاً أوتوماتيكياً مع شركات الشحن (بوسطة وتربو)، إرسال إشعارات الواتساب، إدارة الخزينة والمبيعات الحية، والتحويل المباشر للكاشير مع تقارير أرباح الشركاء لحظة بلحظة.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
          <Link
            to="/owner-login"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#008060] via-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-xl shadow-emerald-700/25 transition active:scale-[0.98] flex items-center justify-center gap-2.5"
          >
            <Store className="w-5 h-5" />
            <span>ابدأ الآن - لوحة التاجر</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <Link
            to="/employee-login"
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-sm transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Users className="w-4 h-4 text-[#008060]" />
            <span>بوابة طاقم العمل</span>
          </Link>
        </div>

        {/* Trust Points */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 font-black">
          <div className="flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#008060]" />
            ربط أوتوماتيكي مع Bosta & Turbo
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#008060]" />
            مزامنة المخزون والخزينة فورياً
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-[#008060]" />
            تأكيد أوردرات وتتبع بالواتساب
          </div>
        </div>

        {/* DASHBOARD PREVIEW MOCKUP */}
        <div className="mt-12 relative max-w-5xl mx-auto rounded-3xl bg-white border border-emerald-100/90 p-4 sm:p-7 shadow-2xl shadow-emerald-950/5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-xs font-black text-slate-500 mr-2">لوحة التحكم التنفيذية المباشرة - عبده ميديا برايم</span>
            </div>
            <span className="text-xs font-black text-[#008060] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#008060] animate-ping" />
              مباشر وحي (Realtime Sync)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-right">
            <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200/80">
              <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي المبيعات المؤكدة</span>
              <p className="text-xl font-black text-[#008060]">148,250 ج.م</p>
              <span className="text-[10px] font-extrabold text-emerald-700 mt-1 block">↑ +28% مقارنة بالشهر السابق</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-500 block mb-1">الأوردرات الجاهزة للشحن</span>
              <p className="text-xl font-black text-slate-900">342 طلب</p>
              <span className="text-[10px] font-bold text-teal-600 mt-1 block">تم إنشاء البوالص بنجاح</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-500 block mb-1">سيولة الخزينة المتاحة</span>
              <p className="text-xl font-black text-slate-900">82,400 ج.م</p>
              <span className="text-[10px] font-bold text-slate-500 mt-1 block">تحديث أوتوماتيكي مع الكاشير</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <span className="text-xs font-bold text-slate-500 block mb-1">نسبة تسليم الشحنات</span>
              <p className="text-xl font-black text-[#008060]">98.4%</p>
              <span className="text-[10px] font-bold text-[#008060] mt-1 block">أقل نسبة مرتجعات شحن</span>
            </div>
          </div>
        </div>

      </section>

      {/* QUICK ORDER TRACKING SECTION */}
      <section id="tracking" className="py-12 bg-white border-y border-emerald-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#008060] text-xs font-black">
            <Truck className="w-3.5 h-3.5" />
            خدمة عملاء المتاجر والطلبات
          </div>
          <h2 className="text-2xl font-black text-slate-900">هل أنت عميل وتريد تتبع شحنتك؟</h2>
          <p className="text-xs sm:text-sm text-slate-600 font-bold max-w-lg mx-auto">
            أدخل رقم الطلب أو رقم موبايلك لمتابعة خط سير الشحنة وتاريخ التسليم أونلاين فوراً.
          </p>

          <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto mt-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                placeholder="أدخل رقم الأوردر أو رقم الموبايل..."
                className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#008060] outline-none text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[#008060] hover:bg-emerald-700 text-white font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>تتبع الطلب</span>
              <ArrowLeft size={14} />
            </button>
          </form>
        </div>
      </section>

      {/* CORE FEATURES TABS SECTION */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-black text-[#008060] uppercase tracking-widest block">
            حلول متكاملة ومصممة للتجار 💎
          </span>
          <h2 className="text-3xl font-black text-slate-950">كل ما يحتاجه متجرك للنمو والسيطرة التامة</h2>
          <p className="text-xs sm:text-sm text-slate-600 font-bold max-w-xl mx-auto">
            منظومة تشغيلية ذكية تلغي العمل اليدوي وتختصر زمن معالجة الطلبات بنسبة 80%.
          </p>
        </div>

        {/* Feature Tab Selector Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {[
            { id: 'orders', label: 'إدارة الطلبات والعملاء', icon: Package },
            { id: 'shipping', label: 'الربط مع شركات الشحن', icon: Truck },
            { id: 'treasury', label: 'الخزينة والسيولة المالية', icon: Wallet },
            { id: 'pos', label: 'الكاشير والـ POS', icon: Store },
            { id: 'whatsapp', label: 'الواتساب والتسويق الذكي', icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFeatureTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFeatureTab(tab.id as any)}
                className={`px-5 py-3 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#008060] text-white shadow-lg shadow-emerald-700/20'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Feature Tab Details Box */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-emerald-100 shadow-xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          
          {activeFeatureTab === 'orders' && (
            <>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#008060] flex items-center justify-center">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">دورات معالجة وتأكيد الطلبات بكل سهولة</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  تأكيد أوتوماتيكي عبر روابط العميل بضغطة زر، فرز طلبات التجهيز، معالجة المرتجعات والمرتجعات الجزئية، وتتبع سجل تعديلات كل أوردر لحظة بلحظة.
                </p>
                <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    فلترة متقدمة بحالة الطلب، المحافظة، والشركة
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    موافقة العميل أونلاين على عروض الأسعار والشحن
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    سجل تاريخ التعديلات للموظفين والورديات
                  </li>
                </ul>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b pb-3">
                  <span>طلب رقم #ORD-8921</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#008060] font-black">مؤكد ومجهز</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-600 font-bold">
                  <p><strong>العميل:</strong> أسامة محمود - القاهرة</p>
                  <p><strong>الإجمالي:</strong> 1,450 ج.م</p>
                  <p><strong>شركة الشحن:</strong> بوسطة Bosta Express</p>
                </div>
              </div>
            </>
          )}

          {activeFeatureTab === 'shipping' && (
            <>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">ربط أوتوماتيكي مباشر مع Bosta & Turbo</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  أنشئ بوالص الشحن بنقرة واحدة، اطبع الملصقات بصيغ A4 وA6، وتتبع تحديثات الشحنة أوتوماتيكياً مع تحديث حالة الأوردر بدون أي تدخل يدوي.
                </p>
                <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    توليد بوالص Bosta وTurbo بنقرة واحدة
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    حساب مصاريف الشحن والمحافظات تلقائياً
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    طباعة تجميعية للبوالص لتجهيز المخزن
                  </li>
                </ul>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b pb-3">
                  <span>تتبع الشحنة أوتوماتيكياً</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-black">جاري التوصيل</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-600 font-bold">
                  <p><strong>رقم البوليسة:</strong> 7289102391</p>
                  <p><strong>المندوب:</strong> أحمد علي (بوسطة)</p>
                  <p><strong>التحديث:</strong> خرجت للتسليم صباح اليوم</p>
                </div>
              </div>
            </>
          )}

          {activeFeatureTab === 'treasury' && (
            <>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Wallet className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">إدارة الخزينة والسيولة وحسابات الشركاء</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  سجل الإيداعات، المسحوبات، وتوريدات شركات الشحن والكاشير في خزينات متعددة (كاش، شبكة، تحويل بنكي) مع احتساب أرباح الشركاء بدقة.
                </p>
                <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    دعم خزائن متعددة (كاشير، بنك، محفظة)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    تسجيل مسحوبات وإيداعات الشركاء بنسب محددة
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    تقرير حركة الخزينة اليومي والشهر المباشر
                  </li>
                </ul>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b pb-3">
                  <span>حساب الخزينة الرئيسي</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#008060] font-black">نشط ومحدث</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-600 font-bold">
                  <p><strong>إجمالي المقبوضات:</strong> 52,800 ج.م</p>
                  <p><strong>توريد كاشير الفرع:</strong> +12,400 ج.م</p>
                  <p><strong>صافي الرصيد الحالي:</strong> 40,400 ج.م</p>
                </div>
              </div>
            </>
          )}

          {activeFeatureTab === 'pos' && (
            <>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Store className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">نظام الكاشير والبيع المباشر بالفرع POS</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  حّول عروض الأسعار والطلبات المباشرة لمبيعة كاشير فورية، مع طباعة الفاتورة وتحديث المخزون وتوريد النقدية للخزينة تلقائياً.
                </p>
                <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    تحويل عروض الأسعار لمبيعات كاشير بضغطة واحدة
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    تحديث لحظي للمخزون ومنع البيع بدون رصيد
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    دعم وسائل الدفع (كاش، شبكة، تحويل)
                  </li>
                </ul>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b pb-3">
                  <span>فاتورة كاشير #POS-391</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-black">مدفوع ومسلم</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-600 font-bold">
                  <p><strong>طريقة الدفع:</strong> كاش نقدي (خزينة الفرع)</p>
                  <p><strong>الإجمالي الصافي:</strong> 850 ج.م</p>
                  <p><strong>الحالة:</strong> تم خصم المنتجات من المخزون</p>
                </div>
              </div>
            </>
          )}

          {activeFeatureTab === 'whatsapp' && (
            <>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#008060] flex items-center justify-center">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">إشعارات الواتساب والحملات التسويقية</h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  أرسل رسائل تأكيد الأوردر ورابط التتبع وتنبيهات الشحن للعملاء بالواتساب أوتوماتيكياً مع قوالب جاهزة ومخصصة باسم متجرك.
                </p>
                <ul className="space-y-2.5 text-xs font-bold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    روابط تأكيد تفاعلية بضغطة زر
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    قوالب جاهزة للترحيب وإشعار الشحن
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#008060]" />
                    تقليل حوادث إلغاء الشحنات
                  </li>
                </ul>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold border-b pb-3">
                  <span>إشعار واتساب للعميل</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#008060] font-black">مرسل بنجاح</span>
                </div>
                <div className="text-xs space-y-1.5 text-slate-600 font-bold">
                  <p><strong>المرسل:</strong> متجر عبده ميديا برايم</p>
                  <p><strong>الرسالة:</strong> أهلاً بك! تم إعداد شحنتك ورقم التتبع 728910</p>
                </div>
              </div>
            </>
          )}

        </div>
      </section>

      {/* STATS BREAKDOWN SECTION */}
      <section id="stats" className="py-16 bg-[#008060] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl font-black">منظومة موثوقة تعتمد عليها أفضل المتاجر</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <span className="text-3xl sm:text-4xl font-black block mb-1">100K+</span>
              <span className="text-xs font-bold text-emerald-100">أوردر جاري معالجته سنوياً</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <span className="text-3xl sm:text-4xl font-black block mb-1">99.9%</span>
              <span className="text-xs font-bold text-emerald-100">استقرار الخوادم والسيرفرات</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <span className="text-3xl sm:text-4xl font-black block mb-1">Bosta & Turbo</span>
              <span className="text-xs font-bold text-emerald-100">ربط مباشر مع الشحن</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <span className="text-3xl sm:text-4xl font-black block mb-1">24/7</span>
              <span className="text-xs font-bold text-emerald-100">دعم فني وحماية مشفرة</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CALL TO ACTION */}
      <section className="py-16 bg-gradient-to-r from-emerald-900 via-[#008060] to-teal-800 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black">جاهز للارتقاء بمتجرك إلى تجربة تشغيلية متكاملة؟</h2>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium max-w-xl mx-auto">
            سجل الآن وابدأ في استخدام منظومة عبده ميديا برايم لإدارة المتاجر والأوردرات بكل سهولة.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              to="/owner-login"
              className="px-8 py-4 rounded-2xl bg-white text-[#008060] hover:bg-emerald-50 font-black text-sm shadow-xl transition active:scale-95 flex items-center gap-2"
            >
              <span>تسجيل دخول مالك المتجر</span>
              <ArrowLeft size={16} />
            </Link>
            <Link
              to="/employee-login"
              className="px-6 py-4 rounded-2xl bg-emerald-800/80 hover:bg-emerald-800 text-white border border-emerald-400/40 font-bold text-sm transition flex items-center gap-2"
            >
              <Users size={16} />
              <span>دخول فريق العمليات</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 bg-slate-900 text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-200">عبده ميديا برايم | AbdoMedia Prime</span>
            <span>- جميع الحقوق محفوظة © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-bold">
            <Link to="/track-order" className="hover:text-emerald-400 transition">تتبع أوردر</Link>
            <Link to="/owner-login" className="hover:text-emerald-400 transition">دخول التاجر</Link>
            <Link to="/employee-login" className="hover:text-emerald-400 transition">دخول الموظفين</Link>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default WelcomeLandingPage;
