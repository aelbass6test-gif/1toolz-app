
import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, ShoppingBag, ArrowLeft, Heart, Package, Truck, Clock } from 'lucide-react';
import { Settings, Order } from '../types';
import { motion } from 'motion/react';

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
        <h1 className="text-2xl font-black mb-4">لم يتم العثور على الطلب</h1>
        <p className="text-slate-500 mb-6 font-bold">قد يكون رقم الطلب غير صحيح أو تم حذفه.</p>
        <Link to="/store" className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hove:scale-105 transition-all">
          العودة للمتجر
        </Link>
      </div>
    );
  }
  
  const total = (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);
  const primaryColor = settings.customization.primaryColor || '#6366f1';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-6 py-20 flex flex-col items-center justify-center selection:bg-indigo-600 selection:text-white" dir="rtl" style={{ fontFamily: settings.customization.fontFamily }}>
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[4rem] p-10 sm:p-16 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] text-center relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: primaryColor }} />
            
            <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100, delay: 0.2 }}
                className="w-24 h-24 sm:w-32 sm:h-32 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mx-auto mb-10 text-emerald-500"
            >
                <CheckCircle size={64} strokeWidth={1} />
            </motion.div>

            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">شكراً لثقتك بنا!</h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 font-bold mb-12">يا <span className="text-slate-900 dark:text-white">{order.customerName.split(' ')[0]}</span>، طلبك وصل بسلام وجاري العمل عليه!</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
                {[
                    { icon: <Package size={20}/>, title: "جاري التجهيز", desc: "نحضر منتجاتك بعناية" },
                    { icon: <Truck size={20}/>, title: "شحن سريع", desc: "توصيل لباب منزلك" },
                    { icon: <Clock size={20}/>, title: "متابعة مستمرة", desc: "سنوافيك بكل جديد" }
                ].map((item, i) => (
                    <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                        <div className="text-slate-400 mb-2 flex justify-center">{item.icon}</div>
                        <h4 className="text-[10px] font-black uppercase text-slate-900 dark:text-white mb-1">{item.title}</h4>
                        <p className="text-[9px] text-slate-400 font-bold">{item.desc}</p>
                    </div>
                ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-[2.5rem] p-8 space-y-6 text-right border border-slate-100 dark:border-slate-800/50">
                <div className="flex justify-between items-center gap-4">
                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">رقم الطلب الخاص بك</span>
                    <span className="font-black text-lg bg-white dark:bg-slate-800 px-4 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-slate-900 dark:text-white">#{order.orderNumber}</span>
                </div>
                
                <div className="h-px bg-slate-200 dark:bg-slate-800" />
                
                <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-slate-400">إجمالي المدفوع</span>
                    <div className="text-right">
                        <span className="text-3xl font-black" style={{ color: primaryColor }}>{total.toLocaleString()}</span>
                        <span className="text-xs font-black text-slate-400 mr-2">ج.م</span>
                    </div>
                </div>
            </div>

            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link 
                    to="/store" 
                    className="w-full sm:w-auto px-12 py-5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl font-black text-lg shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                >
                    <ShoppingBag size={20} />
                    <span>مواصلة التسوق</span>
                </Link>
                <div className="flex items-center gap-2 text-slate-400 font-bold text-xs bg-slate-100 dark:bg-slate-800 px-6 py-5 rounded-2xl">
                    <Heart size={16} className="text-rose-500 fill-rose-500" />
                    <span>فريقنا ممتن لاختيارك لنا</span>
                </div>
            </div>
        </motion.div>
    </div>
  );
};

export default OrderSuccessPage;
