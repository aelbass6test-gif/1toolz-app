import React from 'react';
import { motion } from 'motion/react';
import { User, Phone, MapPin, ShoppingBag, DollarSign, Star, MessageCircle, PhoneCall, Eye, ShieldAlert, Sparkles } from 'lucide-react';
import { EnrichedCustomerProfile, getSegmentLabel } from './crmUtils';

interface Props {
  customers: EnrichedCustomerProfile[];
  onSelectCustomer: (customer: EnrichedCustomerProfile) => void;
}

export const CRMCardsGrid: React.FC<Props> = ({ customers, onSelectCustomer }) => {
  if (customers.length === 0) {
    return (
      <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm text-slate-400 font-bold">
        <User size={48} className="mx-auto mb-4 opacity-30 text-indigo-500" />
        لا يوجد عملاء يطابقون معايير البحث والفلترة المحددة.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 text-right">
      {customers.map((customer, idx) => {
        const segInfo = getSegmentLabel(customer.computedSegment);
        const hasDebt = (customer.debtBalance || 0) > 0;
        
        // Initial badge gradient
        let avatarGradient = 'from-blue-500 to-indigo-600';
        if (customer.computedSegment === 'vip') avatarGradient = 'from-amber-500 to-yellow-600';
        else if (customer.computedSegment === 'risk' || hasDebt) avatarGradient = 'from-rose-500 to-red-600';
        else if (customer.computedSegment === 'new') avatarGradient = 'from-emerald-500 to-teal-600';

        return (
          <motion.div
            key={customer.id || idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            onClick={() => onSelectCustomer(customer)}
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
          >
            {/* Top accent glow */}
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarGradient} text-white font-black text-lg flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
                    {customer.name ? customer.name.slice(0, 2) : 'ع'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-800 dark:text-white text-base truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {customer.name}
                    </h4>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5 dir-ltr">
                      <Phone size={10} className="text-indigo-500 shrink-0" />
                      <span className="truncate">{customer.phone}</span>
                    </div>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border shrink-0 ${segInfo.bg}`}>
                  {segInfo.label}
                </span>
              </div>

              {/* Location & Tags */}
              <div className="space-y-2 mb-4 text-xs">
                {(customer.governorate || customer.city || customer.address) && (
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate font-medium bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl">
                    <MapPin size={12} className="text-rose-500 shrink-0" />
                    <span className="truncate">
                      {customer.governorate ? `${customer.governorate} - ` : ''}
                      {customer.city ? `${customer.city} - ` : ''}
                      {customer.address || 'عنوان غير محدد'}
                    </span>
                  </div>
                )}

                {customer.tags && customer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.slice(0, 2).map((tag, tIdx) => (
                      <span key={tIdx} className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        #{tag}
                      </span>
                    ))}
                    {customer.tags.length > 2 && (
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-lg text-[10px] font-bold">
                        +{customer.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 mb-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">إجمالي الإنفاق LTV</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {customer.totalSpent.toLocaleString()} <span className="text-[10px]">ج.م</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">إجمالي الطلبات</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white mt-0.5 flex items-center gap-1">
                    <ShoppingBag size={12} className="text-indigo-500" />
                    <span>{customer.totalOrders} طلب</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Debt & Health & Action Buttons */}
            <div>
              {hasDebt && (
                <div className="mb-3 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
                  <span className="flex items-center gap-1"><DollarSign size={14} /> مديونية:</span>
                  <span className="font-black">{(customer.debtBalance || 0).toLocaleString()} ج.م</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>صحة: <span className="text-slate-800 dark:text-white font-black">{customer.healthScore}%</span></span>
                </div>

                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <a
                    href={`https://wa.me/2${customer.phone.replace(/^0+/, '0')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-colors"
                    title="مراسلة واتساب"
                  >
                    <MessageCircle size={16} />
                  </a>
                  <a
                    href={`tel:${customer.phone}`}
                    className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 text-indigo-600 hover:text-white transition-colors"
                    title="اتصال هاتف"
                  >
                    <PhoneCall size={16} />
                  </a>
                  <button
                    onClick={() => onSelectCustomer(customer)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-800 hover:text-white text-slate-600 dark:text-slate-300 transition-colors"
                    title="الملف الشامل 360°"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
