import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, X, CheckCircle2, ShieldCheck, Truck, Phone, 
  User, MapPin, ShoppingBag, ArrowRight, RefreshCw, Sparkles 
} from 'lucide-react';
import { Product, ProductVariant, Settings, PlaceOrderData } from '../types';
import { ProductImage } from './ProductImage';

interface QuickCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  selectedVariant?: ProductVariant | null;
  settings: Settings;
  onPlaceOrder: (data: PlaceOrderData) => string;
}

export const QuickCheckoutModal: React.FC<QuickCheckoutModalProps> = ({
  isOpen,
  onClose,
  product,
  selectedVariant,
  settings,
  onPlaceOrder
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  if (!isOpen) return null;

  const unitPrice = selectedVariant?.price ?? product.price ?? 0;
  const totalPrice = unitPrice * quantity;
  const currentImg = selectedVariant?.image || product.thumbnail || (product.images && product.images[0]) || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      alert("يرجى ملء جميع الحقول المطلوبة (الاسم، الهاتف، والعنوان)");
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 600));

      const variantTitle = selectedVariant ? Object.values(selectedVariant.options).join(' / ') : undefined;
      const orderId = onPlaceOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        items: [
          {
            productId: product.id,
            name: `${product.name}${variantTitle ? ` (${variantTitle})` : ''}`,
            price: unitPrice,
            cost: selectedVariant?.costPrice ?? product.costPrice ?? 0,
            weight: selectedVariant?.weight ?? product.weight ?? 0,
            quantity: quantity,
            thumbnail: currentImg,
            variantId: selectedVariant?.id,
            variantName: variantTitle,
            variantDescription: variantTitle
          }
        ],
        notes: `[طلب شراء مباشر سريع - 1-Click Checkout]${variantTitle ? ` [الخيار: ${variantTitle}]` : ''}`
      });

      setOrderNumber(orderId || `ORD-${Date.now().toString().slice(-4)}`);
      setIsSuccess(true);
    } catch (err: any) {
      alert("حدث خطأ أثناء تسجيل الطلب: " + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
              <Zap size={20} className="text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                شراء سريع بنقرة واحدة
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-extrabold">
                  دفع عند الاستلام
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">أدخل بياناتك وسنتواصل معك فوراً لتأكيد وشحن طلبك</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        {isSuccess ? (
          <div className="p-6 sm:p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-black text-slate-900 dark:text-white">تم استلام طلبك بنجاح! 🎉</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                رقم طلبك: <strong className="text-emerald-600 font-mono font-black">{orderNumber}</strong>
              </p>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
              شكرًا لثقتك بنا! سيقوم فريق خدمة العملاء بالتواصل معك هاتفياً على رقم <strong className="font-mono">{customerPhone}</strong> لتأكيد الطلب وشحنه إليك مباشرة.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/25 transition-all"
            >
              متابعة التسوق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[75vh]">
            {/* Product Summary Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shrink-0 overflow-hidden">
                <ProductImage 
                  src={currentImg} 
                  alt={product.name} 
                  containerClassName="w-full h-full" 
                  fallbackIconSize={20} 
                />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                  {product.name}
                </h4>
                {selectedVariant && (
                  <span className="inline-block text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md mt-0.5">
                    {Object.values(selectedVariant.options).join(' - ')}
                  </span>
                )}
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">
                    {(unitPrice).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">ج.م للقطعة</span>
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">الكمية:</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 flex items-center justify-center font-black text-sm"
                >
                  -
                </button>
                <span className="font-mono font-black text-sm w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 flex items-center justify-center font-black text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
                  />
                  <User size={15} className="absolute right-3.5 top-3 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  رقم الهاتف (للتواصل وتأكيد الشحن) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 text-right"
                  />
                  <Phone size={15} className="absolute left-3.5 top-3 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  عنوان التوصيل بالتفصيل <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <textarea
                    required
                    rows={2}
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                    placeholder="المحافظة، المدينة، اسم الشارع، رقم العمارة أو علامة مميزة"
                    className="w-full pr-10 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 leading-relaxed"
                  />
                  <MapPin size={15} className="absolute right-3.5 top-3 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Total and Guarantee */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-slate-500">إجمالي المبلغ عند الاستلام:</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                    {totalPrice.toLocaleString()}
                  </span>
                  <span className="text-xs font-black text-slate-500">ج.م</span>
                </div>
              </div>

              <div className="flex items-center justify-around py-2 px-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                <span className="flex items-center gap-1">
                  <Truck size={12} className="text-emerald-500" /> معاينة قبل الدفع
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-500" /> ضمان الاستبدال
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 active:scale-98 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>جارٍ تأكيد الطلب...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} className="text-amber-300" />
                    <span>تأكيد الطلب الفوري الآن</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
