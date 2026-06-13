import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, OrderItem, PlaceOrderData } from '../types';
import { Lock, ShoppingBag, Tag, CreditCard, Banknote, Smartphone, CheckCircle2, Truck, ShieldCheck, ChevronRight, Info, MapPin, Phone, User, MessageSquare, ArrowLeft, ShoppingCart, RefreshCw as LucideRefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CheckoutPageProps {
  settings: Settings;
  cart: OrderItem[];
  onPlaceOrder: (data: PlaceOrderData) => string;
}

const RefreshCw = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const RotateCcw = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} >
    <path d="M3 2v6h6" />
    <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
  </svg>
);

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ settings, cart, onPlaceOrder }) => {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Method Selection
  const activePaymentMethods = settings.paymentMethods?.filter(m => m.active) || [];
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(activePaymentMethods[0]?.id || 'cod');

  const activeCompanies = useMemo(() => Object.keys(settings.shippingOptions).filter(c => settings.activeCompanies[c] !== false), [settings]);
  const [shippingCompany, setShippingCompany] = useState(activeCompanies[0] || '');
  const [shippingArea, setShippingArea] = useState('');

  useEffect(() => {
    if (shippingCompany) {
      const defaultArea = settings.shippingOptions[shippingCompany]?.[0]?.label;
      if (defaultArea) {
        setShippingArea(defaultArea);
      }
    }
  }, [shippingCompany, settings.shippingOptions]);

  const shippingOptions = settings.shippingOptions[shippingCompany] || [];

  const { subtotal, shippingFee, total } = useMemo(() => {
    const sub = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const selectedOption = shippingOptions.find(opt => opt.label === shippingArea);
    const fee = selectedOption ? selectedOption.deliveryPrice : 0;
    return {
      subtotal: sub,
      shippingFee: fee,
      total: Math.max(0, sub + fee - discountAmount)
    };
  }, [cart, shippingArea, shippingOptions, discountAmount]);

  const handleApplyCoupon = () => {
    setCouponMessage('');
    setDiscountAmount(0);
    const code = settings.discountCodes?.find(c => c.code === couponCode.toUpperCase().trim() && c.active);
    if (!code) {
      setCouponMessage('الكود غير صحيح أو منتهي الصلاحية.');
      return;
    }
    let discount = 0;
    if (code.type === 'fixed') {
      discount = code.value;
    } else {
      const sub = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
      discount = (sub * code.value) / 100;
    }
    setDiscountAmount(discount);
    setCouponMessage(`تم تطبيق خصم بقيمة ${discount.toLocaleString()} ج.م`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("سلة المشتريات فارغة!");
      navigate('/store');
      return;
    }
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 800));

    const paymentMethodName = activePaymentMethods.find(m => m.id === selectedPaymentMethod)?.name || 'غير محدد';
    const finalNotes = `${notes} [دفع عبر: ${paymentMethodName}]${discountAmount > 0 ? ` [كوبون: ${couponCode}]` : ''}`;

    try {
      const orderId = onPlaceOrder({
        customerName,
        customerPhone,
        customerAddress,
        shippingCompany,
        shippingArea,
        shippingFee,
        paymentMethod: selectedPaymentMethod,
        notes: finalNotes,
        redeemedPoints: 0,
        discount: discountAmount,
      });
      navigate(`/order-success/${orderId}`);
    } catch (err) {
      console.error('Failed to place order:', err);
      alert('حدث خطأ أثناء تأكيد الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentMethod = activePaymentMethods.find(m => m.id === selectedPaymentMethod);
  const primaryColor = settings.customization.primaryColor || '#6366f1';

  return (
    <div className="bg-slate-50 min-h-screen font-store antialiased selection:bg-indigo-600 selection:text-white" dir="rtl">
      {/* Premium Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-100">
        <div className="container mx-auto px-6 h-20 sm:h-24 flex items-center justify-between">
          <button type="button" onClick={() => navigate('/store')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all group">
            <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
              <ArrowLeft size={20} />
            </div>
            <span className="font-black text-sm uppercase tracking-widest hidden sm:inline">الرجوع للمتجر</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <ShoppingBag size={20} />
            </div>
            {settings.customization.logoUrl ? (
              <img src={settings.customization.logoUrl} alt="Logo" className="h-10 object-contain" />
            ) : (
              <h1 className="text-2xl font-black tracking-tighter text-slate-900">{settings.products[0]?.name || 'CHECKOUT'}</h1>
            )}
          </div>

          <div className="flex items-center gap-3 text-emerald-500 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
            <ShieldCheck size={14} />
            <span>دفع آمن 100%</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Main Checkout Form - 7 columns */}
          <div className="lg:col-span-7 space-y-12">
            <form onSubmit={handleSubmit} className="space-y-16">
              {/* Section 1: Identity */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-none">معلومات الاتصال</h2>
                    <p className="text-xs text-slate-400 font-bold mt-2">سنستخدم هذه البيانات لمتابعة طلبك</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="group relative">
                    <input type="text" placeholder="الاسم الكامل" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full pt-8 pb-4 px-6 bg-white border-2 border-slate-100 rounded-3xl text-sm font-black focus:border-indigo-600 outline-none transition-all" />
                    <label className="absolute right-6 top-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">اسم العميل</label>
                  </div>
                  <div className="group relative">
                    <input type="tel" placeholder="01xxxxxxxxx" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full pt-8 pb-4 px-6 bg-white border-2 border-slate-100 rounded-3xl text-sm font-black focus:border-indigo-600 outline-none transition-all text-left" dir="ltr" />
                    <label className="absolute right-6 top-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">رقم الهاتف</label>
                  </div>
                </div>
              </motion.section>

              {/* Section 2: Shipping */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-none">تفاصيل الشحن</h2>
                    <p className="text-xs text-slate-400 font-bold mt-2">اختر منطقة التوصيل بدقة لضمان سرعة الوصول</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="group relative">
                    <select required value={shippingCompany} onChange={e => setShippingCompany(e.target.value)} className="w-full pt-8 pb-4 px-6 bg-white border-2 border-slate-100 rounded-3xl text-sm font-black focus:border-indigo-600 outline-none transition-all appearance-none cursor-pointer">
                      <option value="" disabled>اختر شركة الشحن</option>
                      {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <label className="absolute right-6 top-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">مزوّد الشحن</label>
                  </div>
                  <div className="group relative">
                    <select required value={shippingArea} onChange={e => setShippingArea(e.target.value)} className="w-full pt-8 pb-4 px-6 bg-white border-2 border-slate-100 rounded-3xl text-sm font-black focus:border-indigo-600 outline-none transition-all appearance-none cursor-pointer">
                      <option value="" disabled>اختر منطقة التوصيل</option>
                      {shippingOptions.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}
                    </select>
                    <label className="absolute right-6 top-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">المنطقة / المحافظة</label>
                  </div>
                </div>

                <div className="group relative">
                  <textarea placeholder="العنوان التفصيلي (رقم المبنى، الشقة، المعالم المميزة)..." required value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full pt-8 pb-4 px-6 bg-white border-2 border-slate-100 rounded-3xl text-sm font-black focus:border-indigo-600 outline-none transition-all h-32 resize-none" ></textarea>
                  <label className="absolute right-6 top-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">العنوان بالتفصيل</label>
                </div>
              </motion.section>

              {/* Section 3: Payment */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-none">طريقة الدفع</h2>
                    <p className="text-xs text-slate-400 font-bold mt-2">اختر الوسيلة التي تناسبك</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activePaymentMethods.map(method => (
                    <div key={method.id} onClick={() => setSelectedPaymentMethod(method.id)} className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all flex items-center gap-5 relative overflow-hidden ${selectedPaymentMethod === method.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedPaymentMethod === method.id ? 'border-indigo-600' : 'border-slate-300'}`}>
                        {selectedPaymentMethod === method.id && <motion.div layoutId="radio" className="w-3 h-3 bg-indigo-600 rounded-full" />}
                      </div>
                      <div className="flex-1 text-right">
                        <span className={`font-black block text-base mb-1 ${selectedPaymentMethod === method.id ? 'text-indigo-600' : 'text-slate-700'}`}>{method.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold block">{method.type === 'cod' ? 'ادفع عند الاستلام' : 'تحويل بنكي / محفظة'}</span>
                      </div>
                      <div className={`p-3 rounded-2xl ${selectedPaymentMethod === method.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                        {method.type === 'cod' ? <Banknote size={20}/> : <Smartphone size={20}/>}
                      </div>
                    </div>
                  ))}
                </div>

                <AnimatePresence>
                  {currentMethod && currentMethod.instructions && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-4">
                        <Info size={20} className="text-amber-600 mt-1 flex-shrink-0" />
                        <div className="text-right">
                          <p className="font-black text-amber-800 text-sm mb-2">تعليمات هامة للدفع:</p>
                          <p className="text-xs text-amber-700 leading-relaxed font-bold">{currentMethod.instructions}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>

              {/* Section 4: Notes */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-none">ملاحظات الطلب</h2>
                  </div>
                </div>
                <textarea placeholder="أي تعليمات خاصة لشركة الشحن أو للمتجر؟" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-6 bg-white border-2 border-slate-100 rounded-3xl text-sm font-black focus:border-indigo-600 outline-none transition-all h-28 resize-none" ></textarea>
              </motion.section>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={isSubmitting} type="submit" className="w-full py-8 rounded-[2.5rem] font-black text-white text-2xl shadow-[0_30px_60px_-15px_rgba(99,102,241,0.4)] flex items-center justify-center gap-4 disabled:opacity-70 transition-all active:shadow-none" style={{ backgroundColor: primaryColor }} >
                {isSubmitting ? (
                  <>
                    <LucideRefreshCw size={24} className="animate-spin" />
                    <span>جاري إرسال الطلب...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={24} />
                    <span>تأكيـد الشـراء الآن</span>
                  </>
                )}
              </motion.button>
            </form>
          </div>

          {/* Summary Sidebar - 5 columns */}
          <div className="lg:col-span-5">
            <div className="lg:sticky top-32 space-y-8">
              <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-2xl shadow-slate-200/50" >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <ShoppingCart size={24} className="text-indigo-600" />
                    <h2 className="text-2xl font-black text-slate-900">ملخص الحقيبة</h2>
                  </div>
                  <span className="bg-slate-100 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {cart.length} منتجات
                  </span>
                </div>

                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center justify-between group">
                      <div className="flex items-center gap-5">
                        <div className="relative flex-shrink-0">
                          <img src={item.thumbnail} alt={item.name} className="w-20 h-20 rounded-[2rem] object-cover bg-slate-50 p-2 border border-slate-100" />
                          <span className="absolute -top-2 -right-2 w-7 h-7 bg-indigo-600 text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-xl border-4 border-white group-hover:scale-110 transition-transform">
                            {item.quantity}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-slate-800 mb-1 line-clamp-1">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">السعر للقطعة: {item.price.toLocaleString()} ج.م</p>
                        </div>
                      </div>
                      <p className="font-black text-sm text-slate-900">{(item.price * item.quantity).toLocaleString()} <span className="text-[10px] text-slate-400 mr-1">ج.م</span></p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 pt-10 border-t-2 border-slate-50">
                  <div className="relative group">
                    <input type="text" placeholder="هل لديك كوبون خصم؟" value={couponCode} onChange={e => setCouponCode(e.target.value)} className="w-full pl-24 pr-6 py-5 bg-slate-50 rounded-2xl text-xs font-black outline-none border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all text-right uppercase" />
                    <button type="button" onClick={handleApplyCoupon} className="absolute left-2 top-2 bottom-2 px-6 bg-slate-950 text-white rounded-xl text-xs font-black hover:scale-[1.03] active:scale-95 transition-all shadow-xl" >
                      تطبيق
                    </button>
                  </div>
                  {couponMessage && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-[10px] mt-3 mr-4 font-black flex items-center gap-2 ${discountAmount > 0 ? 'text-emerald-500' : 'text-rose-500'}`} >
                      {discountAmount > 0 ? <CheckCircle2 size={12}/> : <Info size={12}/>}
                      {couponMessage}
                    </motion.p>
                  )}
                </div>

                <div className="space-y-5 mt-10 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                    <span>المجموع الفرعي</span>
                    <span className="font-black text-slate-900">{subtotal.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                    <span>رسوم الشحن والتوصيل</span>
                    <span className="font-black text-slate-900">
                      {shippingFee > 0 ? `${shippingFee.toLocaleString()} ج.م` : shippingArea ? '0 ج.م (مجاناً)' : 'يحدد لاحقاً'}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-sm font-black text-emerald-500">
                      <span>خصم الكوبون</span>
                      <span>-{discountAmount.toLocaleString()} ج.م</span>
                    </div>
                  )}
                  <div className="h-px bg-slate-200 my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-black text-slate-900">الإجمالي</span>
                    <div className="text-right">
                      <span className="text-3xl font-black text-indigo-600">
                        {total.toLocaleString()}
                      </span>
                      <span className="text-xs font-black text-indigo-400 mr-2 uppercase italic">ج.م</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-center gap-3 py-4 border-2 border-dashed border-slate-100 rounded-3xl opacity-50 group hover:opacity-100 transition-opacity">
                  <Lock size={16} className="text-emerald-500"/>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تشفير SSL 256-bit لمشتريات آمنة</span>
                </div>
              </motion.div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 px-6 text-center">
                {[
                  { icon: <Truck size={20}/>, text: "توصيل سريع" },
                  { icon: <RotateCcw size={20}/>, text: "استبدال مرن" },
                  { icon: <ShieldCheck size={20}/>, text: "ضمان جودة" }
                ].map((badge, i) => (
                  <div key={i} className="space-y-2">
                    <div className="w-full aspect-square bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 mb-2">
                      {badge.icon}
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{badge.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-6 py-12 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6 opacity-30">
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">© {new Date().getFullYear()} {settings.products[0]?.name || 'VOGUE'}. كل الحقوق محفوظة.</p>
        <div className="flex gap-4 items-center">
          <div className="h-4 w-8 bg-slate-200 rounded-sm" />
          <div className="h-4 w-8 bg-slate-200 rounded-sm" />
          <div className="h-4 w-8 bg-slate-200 rounded-sm" />
        </div>
      </footer>
    </div>
  );
};

export default CheckoutPage;
