
import React, { useState, useMemo, useEffect } from 'react';
// FIX: Using useNavigate for v6 compatibility.
import { useNavigate } from 'react-router-dom';
import { Settings, OrderItem, PlaceOrderData } from '../types';
import { Lock, ShoppingBag, Tag, CreditCard, Banknote, Smartphone, CheckCircle2, Truck } from 'lucide-react';

interface CheckoutPageProps {
  settings: Settings;
  cart: OrderItem[];
  onPlaceOrder: (data: PlaceOrderData) => string;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({ settings, cart, onPlaceOrder }) => {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  
  // Payment Method Selection
  const activePaymentMethods = settings.paymentMethods?.filter(m => m.active) || [];
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(activePaymentMethods[0]?.id || 'cod');

  const activeCompanies = useMemo(() => Object.keys(settings.shippingOptions).filter(c => settings.activeCompanies[c]), [settings]);
  
  const [shippingCompany, setShippingCompany] = useState(activeCompanies[0] || '');
  const [shippingArea, setShippingArea] = useState('');

  useEffect(() => {
      if(shippingCompany) {
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
    return { subtotal: sub, shippingFee: fee, total: Math.max(0, sub + fee - discountAmount) };
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
        alert("سلة المشتريات فارغة!");
        navigate('/store');
        return;
    }
    
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
    } catch(err) {
        console.error('Failed to place order:', err);
        alert('حدث خطأ أثناء تأكيد الطلب. يرجى المحاولة مرة أخرى.');
    }
  };

  const currentMethod = activePaymentMethods.find(m => m.id === selectedPaymentMethod);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen" style={{ fontFamily: settings.customization.fontFamily }}>
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center">
            {settings.customization.logoUrl ? (
                <img src={settings.customization.logoUrl} alt="Logo" className="h-10" />
            ) : (
                <h1 className="text-2xl font-black" style={{ color: settings.customization.textColor }}>{settings.products[0]?.name || 'متجري'}</h1>
            )}
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Right side: Form */}
          <div className="lg:pr-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Tag size={20}/> بيانات العميل</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="text" placeholder="الاسم بالكامل" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  <input type="tel" placeholder="رقم الهاتف" required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Truck size={20}/> بيانات الشحن</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <select required value={shippingCompany} onChange={e => setShippingCompany(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                        <option value="" disabled>اختر شركة الشحن</option>
                        {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <select required value={shippingArea} onChange={e => setShippingArea(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                        <option value="" disabled>اختر المنطقة</option>
                        {shippingOptions.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}
                     </select>
                 </div>
                 <textarea placeholder="العنوان بالكامل..." required value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full p-3 mt-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-24 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"></textarea>
              </div>

              {/* Payment Methods */}
              <div className="space-y-4">
                  <h2 className="text-xl font-bold flex items-center gap-2"><CreditCard size={20}/> طريقة الدفع</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activePaymentMethods.map(method => (
                          <div 
                            key={method.id} 
                            onClick={() => setSelectedPaymentMethod(method.id)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${selectedPaymentMethod === method.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300'}`}
                          >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPaymentMethod === method.id ? 'border-indigo-600' : 'border-slate-400'}`}>
                                  {selectedPaymentMethod === method.id && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                              </div>
                              <div className="flex-1">
                                  <span className="font-bold block text-slate-800 dark:text-white text-sm">{method.name}</span>
                                  {method.type === 'manual' && <span className="text-xs text-slate-500 font-mono">{method.details}</span>}
                              </div>
                              {method.type === 'cod' ? <Banknote size={20} className="text-emerald-500"/> : <Smartphone size={20} className="text-indigo-500"/>}
                          </div>
                      ))}
                  </div>
                  {currentMethod && currentMethod.instructions && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm rounded-lg border border-blue-100 dark:border-blue-800">
                          <p className="font-bold mb-1">تعليمات الدفع:</p>
                          <p>{currentMethod.instructions}</p>
                      </div>
                  )}
              </div>

               <div>
                <h2 className="text-xl font-bold mb-4">ملاحظات إضافية</h2>
                <textarea placeholder="أي تعليمات خاصة بالتوصيل؟" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-20 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"></textarea>
              </div>
              
              <button type="submit" className="w-full py-4 rounded-xl font-bold text-white text-lg transition-transform hover:scale-[1.01] shadow-lg" style={{ backgroundColor: settings.customization.primaryColor }}>
                تأكيد الطلب
              </button>
            </form>
          </div>
          
          {/* Left side: Summary */}
          <div className="lg:sticky top-28 self-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ShoppingBag size={20}/> ملخص الطلب</h2>
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {cart.map(item => (
                    <div key={item.productId} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                               <img src={item.thumbnail} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
                               <span className="absolute -top-2 -right-2 w-6 h-6 bg-slate-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md">{item.quantity}</span>
                            </div>
                            <p className="font-bold text-sm text-slate-800 dark:text-white">{item.name}</p>
                        </div>
                        <p className="font-bold text-sm">{(item.price * item.quantity).toLocaleString()} ج.م</p>
                    </div>
                ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="كود الخصم" 
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button onClick={handleApplyCoupon} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors">تطبيق</button>
                </div>
                {couponMessage && <p className={`text-xs mt-2 font-bold ${discountAmount > 0 ? 'text-green-600' : 'text-red-500'}`}>{couponMessage}</p>}
            </div>

            <div className="space-y-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400"><span>المجموع الفرعي</span><span className="font-bold text-slate-800 dark:text-white">{subtotal.toLocaleString()} ج.م</span></div>
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400"><span>الشحن</span><span className="font-bold text-slate-800 dark:text-white">{shippingFee > 0 ? `${shippingFee.toLocaleString()} ج.م` : 'سيتم تحديده'}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-sm text-green-600 font-bold"><span>الخصم</span><span>-{discountAmount.toLocaleString()} ج.م</span></div>}
                <div className="flex justify-between text-lg font-black mt-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"><span>الإجمالي</span><span style={{ color: settings.customization.primaryColor }}>{total.toLocaleString()} ج.م</span></div>
            </div>
            <div className="mt-6 text-xs text-slate-500 flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                <Lock size={20} className="text-emerald-500"/>
                <span>جميع البيانات مشفرة وآمنة تماماً.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CheckoutPage;