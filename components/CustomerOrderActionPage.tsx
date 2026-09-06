import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  Truck, 
  Clock, 
  ShoppingBag, 
  AlertCircle, 
  Edit3, 
  ChevronRight,
  ShieldCheck,
  Send,
  Loader2
} from 'lucide-react';

export const CustomerOrderActionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || searchParams.get('id') || '';
  const orderNumber = searchParams.get('orderNumber') || searchParams.get('num') || '';
  const initialAction = searchParams.get('action') || ''; // 'confirm' | 'cancel' | 'edit_address'
  const phone = searchParams.get('phone') || '';

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [storeName, setStoreName] = useState('متجرنا');
  const [actionDone, setActionDone] = useState<string | null>(null); // 'confirmed' | 'cancelled' | 'address_updated'
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit address state
  const [isEditingAddress, setIsEditingAddress] = useState(initialAction === 'edit_address');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');

  // 1. Fetch public order details
  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const url = `/api/order/public-details?orderId=${encodeURIComponent(orderId)}&orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (isMounted) {
          if (data.success && data.order) {
            setOrder(data.order);
            setStoreName(data.storeName || 'متجرنا');
            setNewAddress(data.order.customerAddress || '');
            setNewCity(data.order.customerCity || data.order.governorate || '');

            // Auto-trigger confirmation or cancellation if specified in URL
            if (initialAction === 'confirm' && data.order.status !== 'قيد_التنفيذ' && data.order.status !== 'تم_التوصيل') {
              handleExecuteAction('confirm', data.order.id);
            } else if (initialAction === 'cancel' && data.order.status !== 'ملغي') {
              handleExecuteAction('cancel', data.order.id);
            } else if (data.order.status === 'قيد_التنفيذ') {
              setActionDone('confirmed');
            } else if (data.order.status === 'ملغي') {
              setActionDone('cancelled');
            }
          } else {
            setErrorMsg(data.error || 'عذراً، تعذر الوصول إلى بيانات الطلب.');
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg('حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.');
          setLoading(false);
        }
      }
    };

    fetchDetails();
    return () => { isMounted = false; };
  }, [orderId, orderNumber, initialAction]);

  // 2. Execute Action (Confirm or Cancel or Address Update)
  const handleExecuteAction = async (actionType: 'confirm' | 'cancel' | 'edit_address', targetOrderId?: string) => {
    try {
      setExecuting(true);
      setErrorMsg(null);
      const res = await fetch('/api/order/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: targetOrderId || order?.id || orderId,
          orderNumber: order?.orderNumber || orderNumber,
          phone: phone || order?.customerPhone,
          action: actionType,
          newAddress: actionType === 'edit_address' ? newAddress : undefined,
          newCity: actionType === 'edit_address' ? newCity : undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        if (actionType === 'confirm') {
          setActionDone('confirmed');
          setOrder((prev: any) => prev ? { ...prev, status: 'قيد_التنفيذ' } : null);
        } else if (actionType === 'cancel') {
          setActionDone('cancelled');
          setOrder((prev: any) => prev ? { ...prev, status: 'ملغي' } : null);
        } else if (actionType === 'edit_address') {
          setActionDone('address_updated');
          setIsEditingAddress(false);
          setOrder((prev: any) => prev ? { ...prev, status: 'قيد_التنفيذ', customerAddress: newAddress, customerCity: newCity } : null);
        }
      } else {
        setErrorMsg(data.error || 'تعذر تحديث حالة الطلب، يرجى المحاولة مرة أخرى.');
      }
    } catch (err: any) {
      setErrorMsg('حدث خطأ أثناء إرسال طلبك. يرجى التحقق من اتصال الإنترنت.');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm max-w-sm w-full space-y-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">جاري جلب تفاصيل طلبك...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-900 dark:text-slate-100" dir="rtl">
      <div className="max-w-md w-full space-y-4">
        
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black">
              🛍️
            </div>
            <div>
              <h1 className="text-base font-black text-slate-800 dark:text-white leading-tight">{storeName}</h1>
              <p className="text-xs text-slate-500 font-medium">بوابة خدمة العملاء الذكية</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-200 dark:border-emerald-800/50">
            <ShieldCheck size={14} />
            <span>آمن ومعتمد</span>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Main Status Display */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          
          {/* Confirmed View */}
          {actionDone === 'confirmed' && (
            <div className="text-center space-y-3 py-2">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-emerald-700 dark:text-emerald-400">تم تأكيد طلبك بنجاح! 👍</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                شكراً لثقتك بنا. تم تسجيل تأكيدك بنجاح في النظام، وجاري تجهيز الشحنة لتسليمها لشركة الشحن فوراً.
              </p>
            </div>
          )}

          {/* Cancelled View */}
          {actionDone === 'cancelled' && (
            <div className="text-center space-y-3 py-2">
              <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <XCircle size={36} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-rose-700 dark:text-rose-400">تم إلغاء الطلب بنجاح ❌</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                تم إلغاء الشحنة بناءً على رغبتك. نأسف لعدم إتمام الطلب هذه المرة ونتمنى خدمتك دائماً في المرات القادمة!
              </p>
            </div>
          )}

          {/* Address Updated View */}
          {actionDone === 'address_updated' && (
            <div className="text-center space-y-3 py-2">
              <div className="w-16 h-16 rounded-3xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                <MapPin size={36} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-blue-700 dark:text-blue-400">تم تحديث العنوان وتأكيد الشحن! 📍</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                تم حفظ عنوانك الجديد بنجاح في بيانات الطلب وسيقوم المندوب بالتسليم عليه.
              </p>
            </div>
          )}

          {/* If No Action is Executed Yet (Options Selection) */}
          {!actionDone && order && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-black text-slate-800 dark:text-white">تأكيد تفاصيل الطلب</h2>
                <p className="text-xs text-slate-500">يرجى تأكيد طلبك أو تحديد الإجراء المناسب لك:</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleExecuteAction('confirm')}
                  disabled={executing}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
                >
                  {executing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  <span>تأكيد الطلب والشحن فوراً 👍</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingAddress(true)}
                  disabled={executing}
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.99] text-slate-800 dark:text-slate-200 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                >
                  <Edit3 size={16} />
                  <span>تعديل عنوان التوصيل ✍️</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من رغبتك في إلغاء الطلب؟')) {
                      handleExecuteAction('cancel');
                    }
                  }}
                  disabled={executing}
                  className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-400 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all border border-rose-200 dark:border-rose-900/40 text-xs"
                >
                  <XCircle size={16} />
                  <span>إلغاء الطلب ❌</span>
                </button>
              </div>
            </div>
          )}

          {/* Edit Address Form Drawer */}
          {isEditingAddress && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
              <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin size={14} className="text-blue-600" />
                <span>تعديل عنوان التوصيل:</span>
              </h3>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">العنوان بالتفصيل (الشارع - رقم العمارة - علامة مميزة):</label>
                <textarea
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                  placeholder="مثال: شارع الجمهورية، عمارة 5، بجوار المسجد الكبير..."
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1 block">المدينة / المحافظة:</label>
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                  placeholder="مثال: القاهرة / الجيزة / الإسكندرية..."
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleExecuteAction('edit_address')}
                  disabled={executing || !newAddress.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {executing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>حفظ وتأكيد الطلب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(false)}
                  className="px-3 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Order Details Summary Box */}
          {order && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500">تفاصيل الطلب:</span>
                <span className="text-xs font-mono font-black text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                  #{order.orderNumber}
                </span>
              </div>

              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl text-xs">
                {order.customerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">العميل:</span>
                    <span className="font-black text-slate-800 dark:text-slate-200">{order.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">إجمالي المبلغ:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {order.totalPrice} {order.currency || 'ج.م'}
                  </span>
                </div>
                {order.customerAddress && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-500 font-medium shrink-0">العنوان:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-left" dir="rtl">
                      {order.customerAddress} {order.customerCity ? `(${order.customerCity})` : ''}
                    </span>
                  </div>
                )}
                {order.items && order.items.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block mb-1">المنتجات:</span>
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span className="text-slate-700 dark:text-slate-300">▫️ {item.name || item.productName || 'منتج'} (x{item.quantity || item.qty || 1})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Action / Tracking Link */}
          <div className="pt-2 text-center">
            <Link
              to={`/track-order?orderNumber=${encodeURIComponent(order?.orderNumber || '')}&phone=${encodeURIComponent((phone || '').slice(-4))}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
            >
              <Truck size={14} />
              <span>تتبع حالة الشحنة المباشرة</span>
              <ChevronRight size={14} className="rotate-180" />
            </Link>
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 font-medium">
          تم إرسال هذا الإشعار من نظام إدارة الطلبات لمتجر {storeName} ©
        </p>

      </div>
    </div>
  );
};

export default CustomerOrderActionPage;
