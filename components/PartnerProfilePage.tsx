import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Partner, PartnerTransaction, Wallet, Transaction, Order } from '../types';
import { User, ArrowLeft, TrendingUp, DollarSign, ArrowDownRight, ArrowUpLeft, History, PieChart, Activity, Calendar, Download, Check, Package as PackageIcon, Truck, Coins } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion } from 'motion/react';

interface PartnerProfilePageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  orders: Order[];
}

const PartnerProfilePage: React.FC<PartnerProfilePageProps> = ({ settings, updateSettings, wallet, setWallet, orders }) => {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const partner = settings.partners?.find(p => p.id === partnerId);
  const transactions = (settings.partnerTransactions || []).filter(t => t.partnerId === partnerId);

  if (!partner) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
           <User size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">الشريك غير موجود</h2>
        <button onClick={() => navigate('/partners')} className="text-indigo-600 font-bold hover:underline">العودة للشركاء</button>
      </div>
    );
  }

  const stats = useMemo(() => {
    return {
       totalInvested: transactions.filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding').reduce((sum, t) => sum + t.amount, 0),
       totalWithdrawn: transactions.filter(t => t.type === 'profit_withdrawal').reduce((sum, t) => sum + t.amount, 0),
       totalLoans: transactions.filter(t => t.type === 'loan').reduce((sum, t) => sum + t.amount, 0),
       totalAdvances: transactions.filter(t => t.type === 'customer_advance').reduce((sum, t) => sum + t.amount, 0),
       totalRepaid: transactions.filter(t => t.type === 'repayment').reduce((sum, t) => sum + t.amount, 0),
    };
  }, [transactions]);

  const chartData = useMemo(() => {
    let currentBalance = 0;
    return transactions
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(t => {
            if (['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage'].includes(t.type)) {
                currentBalance += t.amount;
            } else {
                currentBalance -= t.amount;
            }
            return {
                date: new Date(t.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
                balance: currentBalance,
                amount: t.amount,
                type: t.type
            };
        });
  }, [transactions]);

  return (
    <div className="p-4 sm:p-6 space-y-8 bg-slate-50/30 dark:bg-slate-900/10 min-h-screen">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/partners')} 
          className="group flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors"
        >
          <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-50 transition-colors">
            <ArrowLeft size={20} />
          </div>
          العودة للشركاء
        </button>

        <div className="flex gap-2">
            <button className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 transition-all shadow-sm">
                <Download size={20} />
            </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-6 sm:gap-8 justify-between relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        <div className="flex items-center gap-4 sm:gap-6 relative z-10 w-full sm:w-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 flex-shrink-0">
                <User size={40} className="sm:hidden" />
                <User size={48} className="hidden sm:block" />
            </div>
            <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white truncate max-w-[150px] sm:max-w-none">{partner.name}</h1>
                  <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase">نشط</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                  <PieChart size={14} className="sm:hidden" />
                  <PieChart size={16} className="hidden sm:block" />
                  <span className="hidden sm:inline">نسبة المشاركة في الأرباح:</span>
                  <span className="sm:hidden">أرباح:</span>
                  <span className="text-indigo-600 font-black">{partner.profitRatio}%</span>
                </p>
            </div>
        </div>

        <div className="text-center md:text-left relative z-10 w-full sm:w-auto mt-4 sm:mt-0">
            <p className="text-[10px] sm:text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">صافي الرصيد الحالي</p>
            <p className={`text-3xl sm:text-5xl font-black tracking-tighter ${partner.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {partner.balance.toLocaleString()} 
                <span className="text-lg sm:text-xl font-bold ml-2 text-slate-300">ج.م</span>
            </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
          {[
            { label: 'إجمالي الاستثمار', value: stats.totalInvested, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20', icon: ArrowUpLeft },
            { label: 'الأرباح المسحوبة', value: stats.totalWithdrawn, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20', icon: DollarSign },
            { label: 'إجمالي السلف', value: stats.totalLoans, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/20', icon: ArrowDownRight },
            { label: 'إجمالي العرابين', value: stats.totalAdvances, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/20', icon: Coins },
            { label: 'صافي مديونية السلف', value: stats.totalLoans - stats.totalRepaid, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700/20', icon: History },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
               <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <stat.icon size={14} className="sm:hidden" />
                    <stat.icon size={16} className="hidden sm:block" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase line-clamp-1">{stat.label}</span>
               </div>
               <p className={`text-lg sm:text-2xl font-black ${stat.color} dark:text-white tracking-tight`}>
                  {stat.value.toLocaleString()} 
                  <span className="text-[10px] sm:text-xs font-bold ml-1 opacity-50">ج.م</span>
               </p>
            </motion.div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><Activity size={20}/></div>
                  منحنى المحفظة المالية
              </h2>
              <div className="flex gap-2">
                 <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><div className="w-2 h-2 rounded-full bg-indigo-600"></div>الرصيد</span>
              </div>
            </div>
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                          tickFormatter={(val) => val.toLocaleString()}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '16px', 
                            border: 'none', 
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                            fontWeight: 800,
                            direction: 'rtl'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="balance" 
                          stroke="#4f46e5" 
                          strokeWidth={4} 
                          fillOpacity={1} 
                          fill="url(#colorBalance)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl"><History size={18}/></div>
              سجل المعاملات
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[600px] p-6 space-y-4 custom-scrollbar">
            {transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((t, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={t.id} 
                  className="group flex flex-col p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all duration-300"
                >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl flex items-center justify-center ${
                          ['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage'].includes(t.type) 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' 
                            : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
                        }`}>
                          {['loan', 'customer_advance'].includes(t.type) ? <ArrowDownRight size={16}/> : 
                           t.type === 'capital_addition' ? <ArrowUpLeft size={16}/> : 
                           t.type === 'shipping_funding' ? <Truck size={16}/> : 
                           t.type === 'expense_repayment' ? <Check size={16}/> : 
                           t.type === 'expense_coverage' ? <DollarSign size={16}/> :
                           t.type === 'repayment' ? <Check size={16}/> :
                           t.type === 'supply_funding' ? <PackageIcon size={16}/> : <DollarSign size={16}/>}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 dark:text-white text-sm">
                            {t.type === 'loan' ? 'سلفة / سحب يدوي' : 
                             t.type === 'customer_advance' ? 'عربون محصل من عميل' :
                             t.type === 'capital_addition' ? 'إيداع رأس مال جديد' : 
                             t.type === 'shipping_funding' ? 'إيداع مصاريف الشحن' : 
                             t.type === 'profit_withdrawal' ? 'سحب من حصة الأرباح' : 
                             t.type === 'profit_distribution' ? 'إضافة أرباح من المستحقات' : 
                             t.type === 'supply_funding' ? 'تمويل شراء بضاعة' : 
                             t.type === 'expense_coverage' ? 'مصروف شخصي مدفوع' :
                             t.type === 'expense_repayment' ? 'رد مصروفات شخصية' : 'سداد سلفة مالية'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-0.5">
                             <Calendar size={10} />
                             {new Date(t.date).toLocaleString('ar-EG', { dateStyle: 'medium' })}
                          </div>
                        </div>
                      </div>
                      <span className={`text-base font-black ${['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage'].includes(t.type) ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {['loan', 'profit_withdrawal', 'expense_repayment'].includes(t.type) ? '-' : '+'}{t.amount.toLocaleString()} 
                          <span className="text-[10px] ml-1">ج.م</span>
                      </span>
                    </div>
                    {t.note && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50 mt-1">
                        {t.note}
                      </div>
                    )}
                </motion.div>
            ))}
            {transactions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-300 gap-3">
                 <History size={40} className="opacity-20" />
                 <p className="text-sm font-bold opacity-50">لا يوجد معاملات مسجلة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerProfilePage;
