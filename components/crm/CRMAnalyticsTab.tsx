import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Sparkles, TrendingUp, Users, MapPin, Award, AlertTriangle, ShieldCheck, DollarSign, ChevronLeft, ArrowUpRight } from 'lucide-react';
import { EnrichedCustomerProfile } from './crmUtils';

interface Props {
  customers: EnrichedCustomerProfile[];
  onFilterBySegment?: (segment: string) => void;
}

const SEGMENT_COLORS: Record<string, string> = {
  vip: '#F59E0B',      // Amber
  regular: '#3B82F6',  // Blue
  new: '#10B981',      // Emerald
  risk: '#EF4444',     // Red
  debt: '#E11D48',     // Rose
  inactive: '#64748B'  // Slate
};

const SEGMENT_NAMES: Record<string, string> = {
  vip: 'عملاء النخبة VIP ⭐',
  regular: 'عملاء منتظمون 🟢',
  new: 'عملاء جدد 🌟',
  risk: 'عالي المخاطر (مرتجعات) ⚠️',
  debt: 'عليهم مديونيات 🔴',
  inactive: 'خاملون / يحتاجون تنشيط 💤'
};

export const CRMAnalyticsTab: React.FC<Props> = ({ customers, onFilterBySegment }) => {
  // Segment Data for Pie Chart
  const segmentData = useMemo(() => {
    const counts: Record<string, number> = { vip: 0, regular: 0, new: 0, risk: 0, debt: 0, inactive: 0 };
    customers.forEach(c => {
      counts[c.computedSegment] = (counts[c.computedSegment] || 0) + 1;
    });

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: SEGMENT_NAMES[key] || key,
        key,
        value,
        color: SEGMENT_COLORS[key] || '#8884d8'
      }));
  }, [customers]);

  // Top Governorates / Cities Data for Bar Chart
  const govData = useMemo(() => {
    const govMap = new Map<string, { name: string; revenue: number; orders: number; customers: number }>();

    customers.forEach(c => {
      const gName = (c.governorate || c.city || 'غير محدد').trim() || 'غير محدد';
      if (!govMap.has(gName)) {
        govMap.set(gName, { name: gName, revenue: 0, orders: 0, customers: 0 });
      }
      const item = govMap.get(gName)!;
      item.revenue += c.totalSpent || 0;
      item.orders += c.totalOrders || 0;
      item.customers += 1;
    });

    return Array.from(govMap.values())
      .filter(g => g.name !== 'غير محدد' && g.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 7);
  }, [customers]);

  // AI Insights Generation
  const aiInsights = useMemo(() => {
    const insights: Array<{ title: string; desc: string; icon: any; color: string; actionText: string; segmentKey?: string }> = [];

    const vipCount = customers.filter(c => c.computedSegment === 'vip').length;
    const debtCount = customers.filter(c => (c.debtBalance || 0) > 0).length;
    const totalDebt = customers.reduce((sum, c) => sum + (c.debtBalance || 0), 0);
    const riskCount = customers.filter(c => c.computedSegment === 'risk').length;
    const inactiveCount = customers.filter(c => c.computedSegment === 'inactive').length;

    if (vipCount > 0) {
      insights.push({
        title: `👑 لديك ${vipCount} عميل نخبة (VIP) عالي القيمة`,
        desc: `يساهم هؤلاء العملاء بأكبر حصة من المبيعات. يُنصح بتخصيص كود خصم حصري أو هدية مجانية مع طلباتهم القادمة لتعزيز ولائهم.`,
        icon: Award,
        color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-900 dark:text-amber-300',
        actionText: 'عرض عملاء VIP',
        segmentKey: 'vip'
      });
    }

    if (totalDebt > 0) {
      insights.push({
        title: `🔴 إجمالي مديونيات وذمم بقيمة ${totalDebt.toLocaleString()} ج.م`,
        desc: `يوجد ${debtCount} عميل عليهم أرصدة مديونية مفتوحة. يمكنك استخدام زر واتساب السريع في جدول العملاء لإرسال تذكير سداد لطيف ومهذب.`,
        icon: DollarSign,
        color: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-300',
        actionText: 'عرض قائمة المديونيات',
        segmentKey: 'debt'
      });
    }

    if (inactiveCount > 0) {
      insights.push({
        title: `💤 فرصة تنشيط المبيعات: ${inactiveCount} عميل خامل`,
        desc: `هؤلاء العملاء لم يقوموا بأي طلب منذ أكثر من شهر. حملة ترويجية سريعة عبر الواتساب بعرض خصم لفترة محدودة قد تعيد تنشيط مبيعاتك بنسبة كبيرة!`,
        icon: TrendingUp,
        color: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 text-indigo-900 dark:text-indigo-300',
        actionText: 'عرض العملاء الخاملين',
        segmentKey: 'inactive'
      });
    }

    if (riskCount > 0) {
      insights.push({
        title: `⚠️ رصد ${riskCount} عملاء بنسبة مرتجعات تتجاوز 50%`,
        desc: `لحماية متجرك من تكاليف الشحن المهدرة، ننصح بتفعيل شرط (الدفع المسبق لرسوم الشحن) قبل إرسال أي شحنات جديدة لهؤلاء العملاء.`,
        icon: AlertTriangle,
        color: 'bg-red-50 dark:bg-red-950/40 border-red-200 text-red-900 dark:text-red-300',
        actionText: 'مراجعة عملاء المخاطر',
        segmentKey: 'risk'
      });
    }

    if (insights.length === 0) {
      insights.push({
        title: `✨ قاعدة العملاء في حالة صحية ممتازة`,
        desc: `تظهر المؤشرات أن معظم عملائك منتظمون ومعدلات المرتجعات منخفضة جداً. استمر في تقديم خدمة التوصيل الممتازة!`,
        icon: ShieldCheck,
        color: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-300',
        actionText: 'عرض كل العملاء',
        segmentKey: 'all'
      });
    }

    return insights;
  }, [customers]);

  return (
    <div className="space-y-8 text-right">
      {/* AI Insights Banner Box */}
      <div className="p-6 md:p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white relative overflow-hidden shadow-xl border border-indigo-500/30">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">مستشار الذكاء الاصطناعي لتنمية المبيعات (AI CRM Adviser)</h3>
              <p className="text-xs text-slate-300 mt-0.5">تحليل فوري لسلوكيات العملاء واقتراحات استراتيجية لرفع القيمة الدائمة وتقليل المرتجعات</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiInsights.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <div key={idx} className={`p-5 rounded-3xl border ${item.color} flex flex-col justify-between transition-all hover:scale-[1.01] shadow-sm`}>
                  <div>
                    <div className="flex items-center gap-2.5 font-black text-base mb-2">
                      <IconComp size={20} className="shrink-0" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90 font-medium mb-4">
                      {item.desc}
                    </p>
                  </div>

                  {onFilterBySegment && item.segmentKey && (
                    <button
                      onClick={() => onFilterBySegment(item.segmentKey!)}
                      className="self-start px-4 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white text-slate-900 dark:text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <span>{item.actionText}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Segmentation Donut */}
        <div className="p-6 md:p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-1">
              <Users className="text-indigo-500" size={20} />
              توزيع قاعدة العملاء حسب الفئات والتصنيف
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">نسبة كل فئة من إجمالي العملاء المسجلين في النظام</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name.split(' ')[0]} (${(percent * 100).toFixed(0)}%)`}
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value} عميل`, 'العدد']} 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Top Governorates Bar Chart */}
        <div className="p-6 md:p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-1">
              <MapPin className="text-rose-500" size={20} />
              أعلى المحافظات والمدن في المبيعات (LTV)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">المناطق الجغرافية الأكثر إدراراً للأرباح وأعداد العملاء</p>
          </div>

          <div className="h-72 w-full">
            {govData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                لا توجد بيانات جغرافية كافية في عناوين العملاء حتى الآن.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={govData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={val => `${val / 1000}k`} />
                  <Tooltip 
                    formatter={(val: any, name: any) => [
                      name === 'revenue' ? `${Number(val).toLocaleString()} ج.م` : `${val} طلب`,
                      name === 'revenue' ? 'إجمالي المبيعات' : 'عدد الطلبات'
                    ]}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold', direction: 'rtl' }}
                  />
                  <Legend formatter={val => val === 'revenue' ? 'إجمالي المبيعات (ج.م)' : 'عدد الطلبات'} />
                  <Bar dataKey="revenue" name="revenue" fill="#6366F1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="orders" name="orders" fill="#10B981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
