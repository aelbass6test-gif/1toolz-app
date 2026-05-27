
import React, { useState } from 'react';
// FIX: Updating react-router-dom import to be compatible with v5.
import { Link } from 'react-router-dom';
import { Search, Package, Truck, CheckCircle, XCircle } from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface OrderTrackingPageProps {
  orders: Order[];
}

const statusSteps: { status: OrderStatus; label: string; icon: React.ReactElement }[] = [
    { status: 'جاري_المراجعة', label: 'تم استلام الطلب', icon: <Package size={24} /> },
    { status: 'قيد_التنفيذ', label: 'قيد التجهيز', icon: <Package size={24} /> },
    { status: 'تم_الارسال', label: 'تم التسليم لشركة الشحن', icon: <Truck size={24} /> },
    { status: 'قيد_الشحن', label: 'الشحنة في الطريق', icon: <Truck size={24} /> },
    { status: 'تم_توصيلها', label: 'تم التوصيل', icon: <CheckCircle size={24} /> },
];

const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ orders }) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFoundOrder(null);
    setError('');

    setTimeout(() => {
        const order = orders.find(o => 
            o.orderNumber.toLowerCase() === orderNumber.toLowerCase().trim() &&
            o.customerPhone.slice(-4) === phone.slice(-4)
        );

        if (order) {
            setFoundOrder(order);
        } else {
            setError('لم يتم العثور على طلب بهذه البيانات. يرجى التأكد من رقم الطلب وآخر 4 أرقام من هاتفك.');
        }
        setIsLoading(false);
    }, 500);
  };

  const activeStepIndex = foundOrder ? statusSteps.findIndex(step => step.status === foundOrder.status) : -1;
  const isFailed = foundOrder && ['ملغي', 'مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن'].includes(foundOrder.status);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-right" dir="rtl">
        <div className="w-full max-w-lg">
            <div className="text-center mb-8">
                <Truck className="mx-auto text-indigo-500 mb-4" size={48} strokeWidth={1.5} />
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">تتبع شحنتك</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">أدخل رقم الطلب وآخر 4 أرقام من هاتفك لعرض حالة الشحنة.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
                {!foundOrder && (
                    <form onSubmit={handleTrackOrder} className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">رقم الطلب</label>
                            <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="WEB-XXXXXX" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">آخر 4 أرقام من هاتفك</label>
                            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={4} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="1234" />
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:bg-slate-400">
                            {isLoading ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : <><Search size={18}/> تتبع</>}
                        </button>
                    </form>
                )}

                {foundOrder && (
                    <div className="animate-in fade-in duration-300">
                        <div className="text-center mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold dark:text-white">تفاصيل الطلب #{foundOrder.orderNumber}</h2>
                            <p className="text-sm text-slate-500">مرحباً {foundOrder.customerName}</p>
                        </div>
                        
                        {isFailed ? (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-4 text-red-700 dark:text-red-400">
                                <XCircle size={40}/>
                                <div>
                                    <h3 className="font-bold">حالة الطلب: {foundOrder.status.replace(/_/g, ' ')}</h3>
                                    <p className="text-sm">نأسف، حدثت مشكلة في توصيل طلبك. يرجى التواصل معنا للمزيد من المعلومات.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="absolute left-1/2 -translate-x-1/2 top-4 bottom-4 w-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                                <div className="space-y-8">
                                    {statusSteps.map((step, index) => (
                                        <div key={step.status} className="flex items-center gap-4 relative">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${index <= activeStepIndex ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                {index <= activeStepIndex ? <CheckCircle size={24}/> : step.icon}
                                            </div>
                                            <div className={`font-bold ${index <= activeStepIndex ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{step.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={() => setFoundOrder(null)} className="w-full mt-8 text-sm text-indigo-600 font-bold hover:underline">البحث عن طلب آخر</button>
                    </div>
                )}
            </div>
            <Link to="/store" className="mt-8 text-sm text-slate-500 hover:text-indigo-600 transition-colors">العودة إلى المتجر</Link>
        </div>
    </div>
  );
};

export default OrderTrackingPage;