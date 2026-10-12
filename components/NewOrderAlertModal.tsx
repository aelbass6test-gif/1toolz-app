import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BellRing, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  ExternalLink, 
  X, 
  Package, 
  MapPin, 
  Clock, 
  Volume2, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  ShoppingBag,
  CreditCard
} from 'lucide-react';
import { Order } from '../types';
import { soundNotification } from '../utils/soundNotification';
import { audioSynth } from '../utils/audioSynth';

interface NewOrderAlertModalProps {
  activeStoreId?: string | null;
  storeName?: string;
  onUpdateOrderStatus?: (orderId: string, newStatus: string) => void;
  onNavigateToOrder?: (orderId: string) => void;
}

export const NewOrderAlertModal: React.FC<NewOrderAlertModalProps> = ({
  activeStoreId,
  storeName = 'متجري',
  onUpdateOrderStatus,
  onNavigateToOrder
}) => {
  const [orderQueue, setOrderQueue] = useState<Order[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Listen for the incoming new pending order event
  useEffect(() => {
    const handleNewOrder = (event: Event) => {
      const customEvent = event as CustomEvent<{ order: Order; storeName?: string }>;
      const newOrder = customEvent.detail?.order;
      if (!newOrder) return;

      setOrderQueue(prev => {
        // Prevent adding duplicate orders
        const exists = prev.some(o => o.id === newOrder.id);
        if (exists) return prev;
        return [...prev, newOrder];
      });
    };

    window.addEventListener('NEW_PENDING_ORDER_ALERT', handleNewOrder);
    return () => window.removeEventListener('NEW_PENDING_ORDER_ALERT', handleNewOrder);
  }, []);

  const currentOrder = orderQueue[currentIndex] || null;

  const handleDismissCurrent = useCallback(() => {
    audioSynth.playTone('click');
    setOrderQueue(prev => {
      const next = prev.filter((_, idx) => idx !== currentIndex);
      return next;
    });
    if (currentIndex >= orderQueue.length - 1) {
      setCurrentIndex(Math.max(0, orderQueue.length - 2));
    }
  }, [currentIndex, orderQueue.length]);

  const handleDismissAll = useCallback(() => {
    audioSynth.playTone('warning');
    setOrderQueue([]);
    setCurrentIndex(0);
  }, []);

  const handleReplaySound = () => {
    soundNotification.playNewOrderChime();
  };

  const handleQuickConfirm = async () => {
    if (!currentOrder) return;
    setIsConfirming(true);
    audioSynth.playTone('success');

    try {
      if (onUpdateOrderStatus) {
        onUpdateOrderStatus(currentOrder.id, 'قيد_التنفيذ');
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('UPDATE_ORDER_STATUS_EVENT', {
            detail: { orderId: currentOrder.id, status: 'قيد_التنفيذ' }
          })
        );
      }
    } catch (e) {
      console.warn('Error confirming order:', e);
    } finally {
      setIsConfirming(false);
      handleDismissCurrent();
    }
  };

  const handleOpenOrder = () => {
    if (!currentOrder) return;
    audioSynth.playTone('info');

    if (onNavigateToOrder) {
      onNavigateToOrder(currentOrder.id);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('NAVIGATE_TO_ORDER', {
          detail: { orderId: currentOrder.id, order: currentOrder }
        })
      );
    }

    handleDismissCurrent();
  };

  // Keyboard navigation & quick shortcuts
  useEffect(() => {
    if (!currentOrder) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismissCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentOrder, handleDismissCurrent]);

  if (!currentOrder) return null;

  const total = (currentOrder.productPrice || 0) + (currentOrder.shippingFee || 0) - (currentOrder.discount || 0);
  const items = currentOrder.items || [];
  const cleanPhone = (currentOrder.customerPhone || '').replace(/\D/g, '');
  const waPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
  const waGreeting = encodeURIComponent(
    `أهلاً بحضرتك أستاذ ${currentOrder.customerName || ''} 👋\nمعاك متجر ${storeName}، بخصوص طلبك رقم #${currentOrder.orderNumber || currentOrder.id} بقيمة ${total} ج.م.\nبنأكد مع حضرتك تفاصيل الشحن والعنوان: ${currentOrder.shippingArea || currentOrder.governorate || ''}.`
  );

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200" 
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-xl bg-white dark:bg-[#0d141e] rounded-[2rem] border border-emerald-500/30 dark:border-emerald-500/25 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Ambient Glowing Header Orb */}
          <div className="absolute top-0 right-0 w-64 h-32 bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 w-64 h-32 bg-cyan-500/10 blur-3xl pointer-events-none" />

          {/* Top Header Bar */}
          <div className="relative p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                <BellRing size={22} className="animate-bounce" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white dark:border-[#0d141e]"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                    أوردر جديد وارد الآن!
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    بانتظار التأكيد (Pending)
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>وصول لحظي للمدير • #{currentOrder.orderNumber || currentOrder.id}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleReplaySound}
                title="إعادة تشغيل نغمة التنبيه"
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 rounded-xl transition-colors cursor-pointer"
              >
                <Volume2 size={18} />
              </button>
              <button
                onClick={handleDismissCurrent}
                title="إغلاق التنبيه"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Queue Navigation Bar (if more than 1 order) */}
          {orderQueue.length > 1 && (
            <div className="px-6 py-2 bg-emerald-500/10 dark:bg-emerald-500/5 border-b border-emerald-500/20 flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <Sparkles size={14} />
                <span>لديك {orderQueue.length} طلبات جديدة متتالية</span>
              </div>
              <div className="flex items-center gap-2">
                <span>طلب {currentIndex + 1} من {orderQueue.length}</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
                    className="p-1 rounded bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    disabled={currentIndex === orderQueue.length - 1}
                    onClick={() => setCurrentIndex(p => Math.min(orderQueue.length - 1, p + 1))}
                    className="p-1 rounded bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Order Details Body */}
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 no-scrollbar text-xs">
            {/* Customer & Location Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {currentOrder.customerName || 'عميل غير مسجل الاسم'}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] mt-0.5" dir="ltr">
                    {currentOrder.customerPhone || 'بدون هاتف'}
                  </div>
                </div>

                {/* Direct Calling & WhatsApp Fast Buttons */}
                <div className="flex items-center gap-2">
                  {currentOrder.customerPhone && (
                    <>
                      <a
                        href={`tel:${currentOrder.customerPhone}`}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5 transition-all shadow-2xs border border-blue-200/70 dark:border-blue-800/40"
                        title="اتصال هاتفي مباشر"
                      >
                        <Phone size={13} />
                        <span>اتصال</span>
                      </a>
                      <a
                        href={`https://wa.me/${waPhone}?text=${waGreeting}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-500/20"
                        title="محادثة واتساب سريعة"
                      >
                        <MessageSquare size={13} />
                        <span>واتساب</span>
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Address details */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06] flex items-start gap-2 text-slate-600 dark:text-slate-300">
                <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {currentOrder.shippingArea || currentOrder.governorate || 'المحافظة غير محددة'}
                  </span>
                  {currentOrder.customerAddress && (
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5">
                      — {currentOrder.customerAddress}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Products Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-emerald-500" />
                  <span>المنتجات المطلوبة ({items.length})</span>
                </span>
                <span>الكمية × السعر</span>
              </div>

              <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.thumbnail ? (
                          <img 
                            src={item.thumbnail} 
                            alt={item.name} 
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-800 shrink-0" 
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <Package size={15} />
                          </div>
                        )}
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.quantity} × {item.price?.toLocaleString()} ج.م
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-center py-2">
                    {currentOrder.productName || 'منتج عام'}
                  </div>
                )}
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-600 dark:text-slate-400">
                <span>سعر المنتجات:</span>
                <span className="font-mono">{(currentOrder.productPrice || 0).toLocaleString()} ج.م</span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-600 dark:text-slate-400">
                <span>مصاريف الشحن:</span>
                <span className="font-mono">{(currentOrder.shippingFee || 0).toLocaleString()} ج.م</span>
              </div>
              {Number(currentOrder.discount) > 0 && (
                <div className="flex items-center justify-between font-bold text-rose-600 dark:text-rose-400">
                  <span>الخصم:</span>
                  <span className="font-mono">-{(currentOrder.discount || 0).toLocaleString()} ج.م</span>
                </div>
              )}
              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-black text-sm sm:text-base">
                <span className="flex items-center gap-1.5">
                  <CreditCard size={16} />
                  <span>إجمالي التحصيل المستحق:</span>
                </span>
                <span className="font-mono font-black text-base sm:text-lg">
                  {total.toLocaleString()} ج.م
                </span>
              </div>
            </div>

            {/* Order Notes if available */}
            {currentOrder.notes && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                <span className="font-bold">ملاحظات العميل: </span>
                {currentOrder.notes}
              </div>
            )}
          </div>

          {/* Action Buttons Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleOpenOrder}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>عرض في اللوحة</span>
              </button>
              {orderQueue.length > 1 && (
                <button
                  onClick={handleDismissAll}
                  className="px-3 py-2.5 rounded-xl text-slate-500 hover:text-rose-600 font-bold transition-colors cursor-pointer text-[11px]"
                >
                  تخطي الكل
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleDismissCurrent}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer"
              >
                تأجيل / إغلاق
              </button>
              <button
                onClick={handleQuickConfirm}
                disabled={isConfirming}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <CheckCircle2 size={16} />
                <span>{isConfirming ? 'جاري التأكيد...' : 'تأكيد الطلب الآن'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NewOrderAlertModal;
