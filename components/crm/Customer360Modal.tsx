import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Phone, MapPin, DollarSign, Star, ShoppingBag, TrendingUp, Calendar, AlertTriangle, CheckCircle2, MessageCircle, PhoneCall, History, Tag, FileText, Plus, Check, CreditCard, ShieldAlert, Sparkles, Copy, ChevronRight, Clock } from 'lucide-react';
import { EnrichedCustomerProfile, getSegmentLabel } from './crmUtils';
import { CustomerProfile } from '../../types';

interface Props {
  customer: EnrichedCustomerProfile | null;
  onClose: () => void;
  onSave: (phone: string, updates: Partial<CustomerProfile>) => void;
}

const COMMON_TAGS = [
  'عميل VIP',
  'عميل جملة',
  'دفع عند الاستلام',
  'توصيل سريع',
  'عميل دائم',
  'توصيل مسائي',
  'يفضل الاتصال',
  'يحتاج متابعة'
];

export const Customer360Modal: React.FC<Props> = ({ customer, onClose, onSave }) => {
  if (!customer) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'debt' | 'tags'>('overview');
  const [copied, setCopied] = useState(false);

  // Debt tab states
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txType, setTxType] = useState<'decrease' | 'increase'>('decrease');
  const [txReason, setTxReason] = useState('');
  const [debtError, setDebtError] = useState('');

  // Tags tab states
  const [selectedTags, setSelectedTags] = useState<string[]>(customer.tags || []);
  const [customTag, setCustomTag] = useState('');
  const [notes, setNotes] = useState(customer.notes || '');
  const [loyaltyPoints, setLoyaltyPoints] = useState(customer.loyaltyPoints || 0);

  const segInfo = getSegmentLabel(customer.computedSegment);

  const copyPhone = () => {
    navigator.clipboard.writeText(customer.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = (template: string) => {
    let msg = '';
    const name = customer.name;
    if (template === 'welcome') {
      msg = `مرحباً بك أستاذ ${name} 🌟 تشرفنا بالتعامل معك وشكراً لثقتك الغالية بنا! نتمنى أن تكون تجربتك رائعة معنا.`;
    } else if (template === 'discount') {
      msg = `أهلاً بك أستاذ ${name} 🎁 تقديراً لكونك من عملائنا المميزين، نقدم لك كود خصم خاص (VIP10) خصم 10% على طلبك القادم!`;
    } else if (template === 'debt') {
      msg = `مرحباً أستاذ ${name} 🤝 نذكرك بلطف برصيد المديونية المستحق بقيمة ${customer.debtBalance || 0} ج.م. يسعدنا تواصلكم لترتيب السداد.`;
    } else if (template === 'feedback') {
      msg = `أهلاً بك أستاذ ${name} 📦 نود الاطمئنان على جودة طلبك الأخير ومستوى خدمة التوصيل. رأيك يهمنا جداً!`;
    }
    const url = `https://wa.me/2${customer.phone.replace(/^0+/, '0')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleAddDebtTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(txAmount);
    if (!amount || amount <= 0) {
      setDebtError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }
    if (!txReason.trim()) {
      setDebtError('يرجى كتابة سبب أو بيان الحركة');
      return;
    }

    const currentDebt = customer.debtBalance || 0;
    let newDebt = currentDebt;
    if (txType === 'decrease') {
      newDebt = Math.max(0, currentDebt - amount);
    } else {
      newDebt = currentDebt + amount;
    }

    const newEntry = {
      amount,
      type: txType,
      reason: txReason.trim(),
      date: new Date().toISOString()
    };

    const newHistory = [newEntry, ...(customer.debtHistory || [])];

    onSave(customer.phone, {
      debtBalance: newDebt,
      debtHistory: newHistory
    });

    setTxAmount(0);
    setTxReason('');
    setDebtError('');
  };

  const handleSaveTagsAndNotes = () => {
    onSave(customer.phone, {
      tags: selectedTags,
      notes: notes.trim(),
      loyaltyPoints: Number(loyaltyPoints) || 0
    });
    alert('تم حفظ البيانات والملاحظات بنجاح! ✔️');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (customTag && !selectedTags.includes(customTag)) {
      setSelectedTags(prev => [...prev, customTag]);
      setCustomTag('');
    }
  };

  // Health color
  let healthColor = 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200';
  let healthText = 'ممتاز (عميل دائم)';
  if (customer.healthScore < 50) {
    healthColor = 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200';
    healthText = 'يتطلب انتباه (مخاطر)';
  } else if (customer.healthScore < 75) {
    healthColor = 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200';
    healthText = 'جيد (مستقر)';
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 md:p-6 text-right">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" 
          onClick={onClose} 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 flex flex-col max-h-[92vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Top Profile Header */}
          <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-black shadow-xl shadow-indigo-500/30 border-2 border-white/20">
                  {customer.name.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-black tracking-tight">{customer.name}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${segInfo.bg}`}>
                      {segInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-slate-300 text-xs font-medium flex-wrap">
                    <button 
                      onClick={copyPhone} 
                      className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl transition-all font-mono font-bold"
                      title="نسخ رقم الهاتف"
                    >
                      <Phone size={12} className="text-indigo-400" />
                      {customer.phone}
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>

                    {(customer.governorate || customer.city || customer.address) && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <MapPin size={12} className="text-rose-400" />
                        {customer.governorate ? `${customer.governorate} - ` : ''}
                        {customer.city ? `${customer.city} - ` : ''}
                        {customer.address || ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Health Meter & Close Button */}
              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                <div className={`px-4 py-2.5 rounded-2xl border flex items-center gap-3 ${healthColor}`}>
                  <Sparkles size={18} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">مؤشر صحة العميل</div>
                    <div className="text-sm font-black flex items-center gap-1">
                      <span>{customer.healthScore}%</span>
                      <span className="text-[11px] opacity-90 font-medium">({healthText})</span>
                    </div>
                  </div>
                </div>

                <button onClick={onClose} className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 mt-6 pt-6 border-t border-white/10 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'overview' 
                    ? 'bg-white text-slate-900 shadow-lg scale-105' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <TrendingUp size={16} /> نظرة عامة ومؤشرات
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'orders' 
                    ? 'bg-white text-slate-900 shadow-lg scale-105' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <ShoppingBag size={16} /> سجل الطلبات ({customer.customerOrders.length})
              </button>

              <button
                onClick={() => setActiveTab('debt')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'debt' 
                    ? 'bg-white text-slate-900 shadow-lg scale-105' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <DollarSign size={16} /> المديونية والسداد
                {(customer.debtBalance || 0) > 0 && (
                  <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">
                    {(customer.debtBalance || 0).toLocaleString()}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('tags')}
                className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'tags' 
                    ? 'bg-white text-slate-900 shadow-lg scale-105' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <Tag size={16} /> التصنيفات والملاحظات
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
            {/* TAB 1: OVERVIEW & KPIs */}
            {activeTab === 'overview' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* 6 KPI Stat Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                      <DollarSign size={14} className="text-emerald-500" /> إجمالي الإنفاق (LTV)
                    </div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white mt-2">
                      {customer.totalSpent.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-indigo-500" /> متوسط قيمة الطلب
                    </div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white mt-2">
                      {Math.round(customer.averageOrderValue).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                      <ShoppingBag size={14} className="text-blue-500" /> إجمالي الطلبات
                    </div>
                    <div className="text-2xl font-black text-slate-800 dark:text-white mt-2">
                      {customer.totalOrders} <span className="text-xs font-bold text-slate-400">طلب</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" /> نسبة نجاح التوصيل
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-2xl font-black text-slate-800 dark:text-white">{customer.successRate.toFixed(0)}%</div>
                      <div className="text-xs font-bold text-slate-400">({customer.successfulOrders} ناجح / {customer.returnedOrders} مرتجع)</div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${customer.successRate}%` }} />
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                      <Star size={14} className="text-amber-500" /> نقاط الولاء المكتسبة
                    </div>
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                      {customer.loyaltyPoints.toLocaleString()} <span className="text-xs font-bold text-slate-400">نقطة</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                      <Calendar size={14} className="text-purple-500" /> تاريخ أول وآخر طلب
                    </div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2 space-y-1">
                      <div>أول طلب: <span className="font-mono text-indigo-600 dark:text-indigo-400">{customer.firstOrderDate ? new Date(customer.firstOrderDate).toLocaleDateString('ar-EG') : 'غير متوفر'}</span></div>
                      <div>آخر ظهور: <span className="font-mono text-purple-600 dark:text-purple-400">{customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('ar-EG') : 'غير متوفر'}</span></div>
                    </div>
                  </div>
                </div>

                {/* Quick WhatsApp Sender Box */}
                <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-4">
                  <h4 className="font-black text-base text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                    <MessageCircle className="text-emerald-600 dark:text-emerald-400" size={20} />
                    إرسال رسائل واتساب ذكية وسريعة
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">اختر قالباً جاهزاً ليتم فتحه في تطبيق الواتساب مباشرة مع هذا العميل:</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleSendWhatsApp('welcome')}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 hover:bg-emerald-600 hover:text-white text-slate-800 dark:text-white border border-emerald-200 dark:border-emerald-800/50 transition-all font-bold text-xs flex items-center justify-between group shadow-sm"
                    >
                      <span>🤝 رسالة ترحيب وشكر على الطلب</span>
                      <ChevronRight size={16} className="text-emerald-500 group-hover:text-white" />
                    </button>

                    <button
                      onClick={() => handleSendWhatsApp('discount')}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 hover:bg-emerald-600 hover:text-white text-slate-800 dark:text-white border border-emerald-200 dark:border-emerald-800/50 transition-all font-bold text-xs flex items-center justify-between group shadow-sm"
                    >
                      <span>🎁 إرسال كود خصم (VIP10) للعميل</span>
                      <ChevronRight size={16} className="text-emerald-500 group-hover:text-white" />
                    </button>

                    {(customer.debtBalance || 0) > 0 && (
                      <button
                        onClick={() => handleSendWhatsApp('debt')}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 transition-all font-bold text-xs flex items-center justify-between group shadow-sm"
                      >
                        <span>💰 تذكير لطيف بسداد المديونية</span>
                        <ChevronRight size={16} className="text-rose-500 group-hover:text-white" />
                      </button>
                    )}

                    <button
                      onClick={() => handleSendWhatsApp('feedback')}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 hover:bg-emerald-600 hover:text-white text-slate-800 dark:text-white border border-emerald-200 dark:border-emerald-800/50 transition-all font-bold text-xs flex items-center justify-between group shadow-sm"
                    >
                      <span>📦 استطلاع رأي ومتابعة جودة التوصيل</span>
                      <ChevronRight size={16} className="text-emerald-500 group-hover:text-white" />
                    </button>
                  </div>
                </div>

                {/* Direct Call Button */}
                <div className="flex justify-end">
                  <a
                    href={`tel:${customer.phone}`}
                    className="px-6 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                  >
                    <PhoneCall size={18} /> اتصال مباشر بالعميل الآن
                  </a>
                </div>
              </motion.div>
            )}

            {/* TAB 2: ORDER HISTORY */}
            {activeTab === 'orders' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                    <History size={18} className="text-indigo-500" />
                    سجل جميع الطلبات المسجلة ({customer.customerOrders.length} طلب)
                  </h4>
                </div>

                {customer.customerOrders.length === 0 ? (
                  <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-bold">
                    لا توجد طلبات مسجلة لهذا العميل في النظام حتى الآن.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-3xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                    {customer.customerOrders.map(order => {
                      const total = (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);
                      let statusBadge = 'bg-slate-100 text-slate-700';
                      if (order.status === 'تم_التحصيل' || order.status === 'تمت_الاعادة_لشركة_الشحن' || order.status === 'مدفوعة') {
                        statusBadge = 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300';
                      } else if (order.status === 'مرتجع' || order.status === 'فشل_التوصيل') {
                        statusBadge = 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300';
                      } else if ((order.status as string) === 'قيد_التجهيز' || (order.status as string) === 'جديد' || (order.status as string) === 'في_انتظار_المكالمة') {
                        statusBadge = 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300';
                      }

                      return (
                        <div key={order.id} className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-white dark:hover:bg-slate-800/80 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-base">
                                #{order.orderNumber || order.id?.slice(0, 8)}
                              </span>
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${statusBadge}`}>
                                {order.status}
                              </span>
                              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                <Clock size={12} /> {new Date(order.date).toLocaleDateString('ar-EG')}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-1">
                              {order.items ? order.items.map(p => `${p.name} (x${p.quantity || 1})`).join('، ') : 'منتجات الطلب'}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 self-end md:self-center">
                            <div className="text-left">
                              <div className="text-base font-black text-slate-800 dark:text-white">
                                {total.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                              </div>
                              {order.shippingFee ? (
                                <div className="text-[10px] text-slate-400 font-bold">شحن: {order.shippingFee} ج.م</div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 3: DEBT LEDGER & PAYMENTS */}
            {activeTab === 'debt' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Debt Balance Card */}
                <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border border-rose-200 dark:border-rose-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30">
                      <DollarSign size={28} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase">إجمالي رصيد المديونية المستحق</div>
                      <div className="text-3xl font-black text-slate-800 dark:text-white mt-1">
                        {(customer.debtBalance || 0).toLocaleString()} <span className="text-base font-bold text-slate-400">ج.م</span>
                      </div>
                    </div>
                  </div>

                  {(customer.debtBalance || 0) > 0 && (
                    <button
                      onClick={() => handleSendWhatsApp('debt')}
                      className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
                    >
                      <MessageCircle size={16} /> إرسال مطالبة عبر الواتساب
                    </button>
                  )}
                </div>

                {/* Log Payment Form */}
                <form onSubmit={handleAddDebtTx} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                    <CreditCard className="text-indigo-500" size={18} /> تسجيل حركة سداد أو مديونية جديدة
                  </h4>

                  {debtError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold">
                      ⚠️ {debtError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">نوع الحركة</label>
                      <select
                        value={txType}
                        onChange={e => setTxType(e.target.value as any)}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      >
                        <option value="decrease">🟢 سداد / تحصيل دفعة من المديونية</option>
                        <option value="increase">🔴 إضافة مديونية جديدة / حساب آجل</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">المبلغ (ج.م)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="0"
                        value={txAmount || ''}
                        onChange={e => setTxAmount(Number(e.target.value) || 0)}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase mb-1.5">البيان / السبب</label>
                      <input
                        type="text"
                        placeholder="مثال: تحصيل نقدي، تسوية فاتورة رقم..."
                        value={txReason}
                        onChange={e => setTxReason(e.target.value)}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                    >
                      <Check size={16} /> اعتماد وتسجيل الحركة
                    </button>
                  </div>
                </form>

                {/* Debt History Table */}
                <div className="space-y-3">
                  <h4 className="font-black text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <History size={16} /> سجل حركات المديونية والسداد ({customer.debtHistory?.length || 0} حركة)
                  </h4>

                  {(!customer.debtHistory || customer.debtHistory.length === 0) ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/30 text-slate-400 text-xs font-bold">
                      لا توجد حركات مديونية أو سداد مسجلة لهذا العميل حتى الآن.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      {customer.debtHistory.map((tx, idx) => {
                        const isPay = tx.type === 'decrease';
                        return (
                          <div key={idx} className="p-4 flex items-center justify-between text-xs font-medium">
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full ${isPay ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <div>
                                <div className="font-bold text-slate-800 dark:text-white">{tx.reason}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {new Date(tx.date).toLocaleDateString('ar-EG')} - {new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                            <div className={`font-black text-sm ${isPay ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isPay ? '-' : '+'}{tx.amount.toLocaleString()} ج.م
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 4: TAGS & NOTES */}
            {activeTab === 'tags' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Tags Section */}
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
                  <label className="block text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Tag size={18} className="text-indigo-500" /> تصنيفات العميل المخصصة
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">انقر لتفعيل أو إلغاء التصنيف، وتساعدك هذه التصنيفات في فلترة العملاء لاحقاً:</p>

                  <div className="flex flex-wrap gap-2">
                    {COMMON_TAGS.map(tag => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                            isSelected 
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105' 
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {isSelected && <Check size={14} />}
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input 
                      type="text"
                      placeholder="إضافة تصنيف خاص..."
                      value={customTag}
                      onChange={e => setCustomTag(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                      className="flex-1 px-4 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white font-bold"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      className="px-5 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Plus size={14} /> إضافة تصنيف
                    </button>
                  </div>
                </div>

                {/* Loyalty Points */}
                <div className="p-6 rounded-3xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-3">
                  <label className="block text-sm font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
                    <Star size={18} className="text-amber-500" /> رصيد نقاط الولاء المكافآت
                  </label>
                  <div className="flex items-center gap-4 max-w-xs">
                    <input
                      type="number"
                      value={loyaltyPoints}
                      onChange={e => setLoyaltyPoints(Number(e.target.value) || 0)}
                      className="w-full p-3.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-2xl text-xl font-black text-center text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-black text-amber-800 dark:text-amber-300 whitespace-nowrap">نقطة متاحة</span>
                  </div>
                </div>

                {/* Internal Notes */}
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                  <label className="block text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText size={18} className="text-indigo-500" /> ملاحظات الخدمة والمتابعة
                  </label>
                  <textarea 
                    rows={4}
                    placeholder="أي تعليمات أو ملاحظات خاصة بالعميل تظهر لموظف خدمة العملاء أو المبيعات..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white text-sm font-medium transition-all"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveTagsAndNotes}
                    className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 text-sm"
                  >
                    <Check size={18} /> حفظ التصنيفات والملاحظات
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
