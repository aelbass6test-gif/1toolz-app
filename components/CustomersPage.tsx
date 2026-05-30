import React, { useMemo, useState } from 'react';
import { Order, CustomerProfile } from '../types';
import { Search, User, Phone, MapPin, ShoppingBag, TrendingUp, AlertTriangle, Star, ArrowUpRight, ArrowDownRight, LayoutList, X, Save } from 'lucide-react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  }
};

interface CustomersPageProps {
  orders: Order[];
  loyaltyData: Record<string, number>;
  updateCustomerLoyaltyPoints: (phone: string, points: number) => void;
}

const CustomersPage: React.FC<CustomersPageProps> = ({ orders, loyaltyData, updateCustomerLoyaltyPoints }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof CustomerProfile>('lastOrderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);

  const customers = useMemo(() => {
    const customerMap = new Map<string, CustomerProfile>();

    orders.forEach(order => {
      const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
      if (!cleanPhone) return; // Skip orders without a phone number
      
      if (!customerMap.has(cleanPhone)) {
        customerMap.set(cleanPhone, {
          id: cleanPhone,
          name: order.customerName,
          phone: order.customerPhone || '',
          address: order.customerAddress,
          totalOrders: 0,
          successfulOrders: 0,
          returnedOrders: 0,
          totalSpent: 0,
          lastOrderDate: order.date,
          firstOrderDate: order.date,
          averageOrderValue: 0,
          loyaltyPoints: loyaltyData[cleanPhone] || 0,
          governorate: order.governorate || order.shippingArea || '',
          city: order.city || '',
          shippingFee: order.shippingFee || 0
        });
      }

      const customer = customerMap.get(cleanPhone)!;
      customer.loyaltyPoints = loyaltyData[cleanPhone] || 0;
      customer.totalOrders += 1;
      
      if (new Date(order.date) > new Date(customer.lastOrderDate)) {
          customer.name = order.customerName;
          customer.address = order.customerAddress;
          customer.governorate = order.governorate || order.shippingArea || customer.governorate;
          customer.city = order.city || customer.city;
          customer.shippingFee = order.shippingFee || customer.shippingFee;
          customer.lastOrderDate = order.date;
      }
      if (new Date(order.date) < new Date(customer.firstOrderDate)) {
          customer.firstOrderDate = order.date;
      }

      if (order.status === 'تم_التحصيل' || order.status === 'تم_توصيلها' || order.status === 'مدفوعة') {
          customer.successfulOrders += 1;
          const orderTotal = (order.productPrice + order.shippingFee) - (order.discount || 0);
          customer.totalSpent += orderTotal;
      } else if (order.status === 'مرتجع' || order.status === 'فشل_التوصيل' || order.status === 'تمت_الاعادة_لشركة_الشحن') {
          customer.returnedOrders += 1;
      }
    });

    return Array.from(customerMap.values()).map(c => ({
        ...c,
        averageOrderValue: c.successfulOrders > 0 ? c.totalSpent / c.successfulOrders : 0
    }));
  }, [orders, loyaltyData]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phone || '').includes(searchTerm)
    ).sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
    });
  }, [customers, searchTerm, sortField, sortDirection]);

  const stats = useMemo(() => ({
      totalCustomers: customers.length,
      totalLTV: customers.reduce((sum, c) => sum + c.totalSpent, 0),
      vipCustomers: customers.filter(c => c.totalSpent > 5000).length,
      riskCustomers: customers.filter(c => c.returnedOrders > 2 && (c.returnedOrders / c.totalOrders) > 0.5).length
  }), [customers]);

  const handleSort = (field: keyof CustomerProfile) => {
      if (sortField === field) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField(field);
          setSortDirection('desc');
      }
  };

  const handleSavePoints = (phone: string, points: number) => {
    updateCustomerLoyaltyPoints(phone, points);
    setEditingCustomer(null);
  };

  return (
    <motion.div 
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
    >
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <User size={32} className="text-indigo-600"/>
                إدارة العملاء (CRM)
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">تحليل بيانات العملاء، القيمة الدائمة، وتاريخ الطلبات.</p>
        </div>
      </motion.div>

      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div variants={itemVariants}><StatCard title="إجمالي العملاء" value={stats.totalCustomers} icon={<User/>} color="blue"/></motion.div>
          <motion.div variants={itemVariants}><StatCard title="إجمالي الإيرادات (LTV)" value={`${stats.totalLTV.toLocaleString()} ج.م`} icon={<TrendingUp/>} color="emerald"/></motion.div>
          <motion.div variants={itemVariants}><StatCard title="عملاء VIP" value={stats.vipCustomers} icon={<Star/>} color="amber"/></motion.div>
          <motion.div variants={itemVariants}><StatCard title="عملاء محتمل للمخاطر" value={stats.riskCustomers} icon={<AlertTriangle/>} color="red"/></motion.div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
                <LayoutList size={20}/> سجل العملاء
            </h3>
            <div className="relative w-full md:w-96">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="بحث بالاسم أو الهاتف..." 
                    className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider border-b dark:border-slate-700">
                    <tr>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('name')}>العميل</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 text-center" onClick={() => handleSort('totalOrders')}>الطلبات</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 text-center" onClick={() => handleSort('loyaltyPoints')}>نقاط الولاء</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 text-center" onClick={() => handleSort('totalSpent')}>LTV</th>
                        <th className="px-6 py-4 text-center">نسبة النجاح</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('lastOrderDate')}>آخر ظهور</th>
                        <th className="px-6 py-4 text-center">التصنيف</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCustomers.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-12 text-slate-400">لا يوجد عملاء يطابقون البحث.</td></tr>
                    ) : (
                        filteredCustomers.map(customer => {
                            const successRate = customer.totalOrders > 0 ? (customer.successfulOrders / customer.totalOrders) * 100 : 0;
                            let badgeColor = 'bg-slate-100 text-slate-600'; let badgeText = 'عادي';
                            if (customer.totalSpent > 5000) { badgeColor = 'bg-amber-100 text-amber-700'; badgeText = 'VIP'; }
                            else if (customer.returnedOrders > 2 && successRate < 50) { badgeColor = 'bg-red-100 text-red-700'; badgeText = 'عالي المخاطر'; }
                            else if (customer.totalOrders === 1 && new Date().getTime() - new Date(customer.firstOrderDate).getTime() < 7 * 24 * 60 * 60 * 1000) { badgeColor = 'bg-green-100 text-green-700'; badgeText = 'جديد'; }

                            return (
                                <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 dark:text-white">{customer.name}</div>
                                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1"><Phone size={10}/> {customer.phone}</div>
                                        <div className="text-[10px] text-slate-400 truncate max-w-[250px]" title={`${customer.governorate || ''} ${customer.city || ''} ${customer.address}`}>
                                            <MapPin size={10} className="inline mr-0.5 ml-0.5 text-indigo-500"/>
                                            {customer.governorate ? <span className="font-semibold text-slate-600 dark:text-slate-300">{customer.governorate}، {customer.city} - </span> : ''}
                                            {customer.address}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex items-center gap-1 font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg">
                                            <ShoppingBag size={14}/> {customer.totalOrders}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-amber-600 dark:text-amber-400 cursor-pointer" onClick={() => setEditingCustomer(customer)}>
                                        {customer.loyaltyPoints.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center"><span className="font-black text-emerald-600 dark:text-emerald-400">{customer.totalSpent.toLocaleString()} ج.م</span></td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`text-xs font-bold ${successRate >= 80 ? 'text-green-600' : successRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{successRate.toFixed(0)}%</span>
                                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden"><div className={`h-full rounded-full ${successRate >= 80 ? 'bg-green-500' : successRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${successRate}%` }}></div></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(customer.lastOrderDate).toLocaleDateString('ar-EG')}</td>
                                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-[10px] font-black ${badgeColor}`}>{badgeText}</span></td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
      </motion.div>
      {editingCustomer && (
          <PointsEditModal
              customer={editingCustomer}
              onSave={handleSavePoints}
              onClose={() => setEditingCustomer(null)}
          />
      )}
    </motion.div>
  );
};

const PointsEditModal = ({ customer, onSave, onClose }: { customer: CustomerProfile, onSave: (phone: string, points: number) => void, onClose: () => void }) => {
    const [points, setPoints] = useState(customer.loyaltyPoints);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 text-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg dark:text-white">تعديل نقاط {customer.name}</h3>
                    <button onClick={onClose}><X className="text-slate-400"/></button>
                </div>
                <p className="text-sm text-slate-500 mb-4">أدخل الرصيد الجديد من النقاط لهذا العميل.</p>
                <input
                    type="number"
                    value={points}
                    onChange={e => setPoints(Number(e.target.value))}
                    className="w-full text-center text-3xl font-black bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-6 focus:ring-2 focus:ring-amber-500 outline-none"
                    autoFocus
                />
                <button onClick={() => onSave(customer.phone, points)} className="w-full py-3 bg-amber-500 text-white rounded-lg font-bold flex items-center justify-center gap-2"><Save size={18}/> حفظ التغييرات</button>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color }: any) => {
    const colors: any = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600' };
    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${colors[color]} dark:bg-opacity-20`}>{icon}</div>
            <div>
                <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">{title}</div>
                <div className="text-xl font-black text-slate-800 dark:text-white">{value}</div>
            </div>
        </div>
    );
};

export default CustomersPage;