
import React, { useMemo } from 'react';
// FIX: Updating react-router-dom import to be compatible with v5.
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Settings, Order } from '../types';

interface OrderSuccessPageProps {
  orders: Order[];
  settings: Settings;
}

const OrderSuccessPage: React.FC<OrderSuccessPageProps> = ({ orders, settings }) => {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useMemo(() => orders.find(o => o.id === orderId), [orders, orderId]);

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">لم يتم العثور على الطلب</h1>
        <p className="text-slate-500 mb-6">قد يكون رقم الطلب غير صحيح أو تم حذفه.</p>
        <Link to="/store" className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold">
          العودة للمتجر
        </Link>
      </div>
    );
  }
  
  const total = order.productPrice + order.shippingFee - order.discount;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" style={{ fontFamily: settings.customization.fontFamily }}>
        <div className="w-full max-w-lg text-center">
            <CheckCircle className="mx-auto text-emerald-500 mb-6" size={80} strokeWidth={1.5} />
            <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-3">شكراً لك، {order.customerName.split(' ')[0]}!</h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 mb-8">تم استلام طلبك بنجاح. سنتواصل معك قريباً لتأكيد التفاصيل.</p>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4 text-right">
                <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-500">رقم الطلب:</span>
                    <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{order.orderNumber}</span>
                </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-500">تاريخ الطلب:</span>
                    <span className="font-bold">{new Date(order.date).toLocaleDateString('ar-EG')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-500">الإجمالي:</span>
                    <span className="font-bold text-lg" style={{ color: settings.customization.primaryColor }}>{total.toLocaleString()} ج.م</span>
                </div>
            </div>
            
            <Link 
                to="/store" 
                className="mt-10 inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-white transition-colors"
                style={{ backgroundColor: settings.customization.primaryColor }}
            >
                <ArrowLeft size={20}/>
                <span>العودة إلى المتجر</span>
            </Link>
        </div>
    </div>
  );
};

export default OrderSuccessPage;