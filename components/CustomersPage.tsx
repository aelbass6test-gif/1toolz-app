import React, { useMemo, useState } from 'react';
import { Order, CustomerProfile } from '../types';
import { Search, User, Phone, MapPin, ShoppingBag, TrendingUp, AlertTriangle, Star, LayoutList, X, Save, DollarSign } from 'lucide-react';
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
  customers?: CustomerProfile[];
  onUpdateCustomer?: (phone: string, updates: Partial<CustomerProfile>) => void;
}

const CustomersPage: React.FC<CustomersPageProps> = ({ orders, loyaltyData, customers: savedCustomers, onUpdateCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof CustomerProfile>('lastOrderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);

  const customers = useMemo(() => {
    const computedMap = new Map<string, CustomerProfile>();
    
    // Process orders first
    orders.forEach(order => {
      const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
      if (!cleanPhone) return;
      
      if (!computedMap.has(cleanPhone)) {
        computedMap.set(cleanPhone, {
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
          shippingFee: order.shippingFee || 0,
          debtBalance: 0
        });
      }

      const customer = computedMap.get(cleanPhone)!;
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

    // Merge with savedCustomers
    (savedCustomers || []).forEach(savedC => {
        const cleanPhone = (savedC.phone || '').replace(/\s/g, '').replace('+2', '');
        if (!cleanPhone) return;
        
        if (computedMap.has(cleanPhone)) {
            const compC = computedMap.get(cleanPhone)!;
            compC.totalOrders = Math.max(compC.totalOrders, savedC.totalOrders || 0);
            compC.successfulOrders = Math.max(compC.successfulOrders, savedC.successfulOrders || 0);
            compC.returnedOrders = Math.max(compC.returnedOrders, savedC.returnedOrders || 0);
            compC.totalSpent = Math.max(compC.totalSpent, savedC.totalSpent || 0);
            compC.loyaltyPoints = savedC.loyaltyPoints || compC.loyaltyPoints;
            compC.debtBalance = savedC.debtBalance || 0;
            compC.notes = savedC.notes;
        } else {
            computedMap.set(cleanPhone, { ...savedC, loyaltyPoints: savedC.loyaltyPoints || loyaltyData[cleanPhone] || 0 });
        }
    });

    return Array.from(computedMap.values()).map(c => ({
        ...c,
        averageOrderValue: c.successfulOrders > 0 ? c.totalSpent / c.successfulOrders : 0
    }));
  }, [orders, loyaltyData, savedCustomers]);

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
            return sortDirection === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
        }
        return 0;
    });
  }, [customers, searchTerm, sortField, sortDirection]);

  const stats = useMemo(() => ({
      totalCustomers: customers.length,
      totalLTV: customers.reduce((sum, c) => sum + c.totalSpent, 0),
      vipCustomers: customers.filter(c => c.totalSpent > 5000).length,
      riskCustomers: customers.filter(c => c.returnedOrders > 2 && (c.returnedOrders / c.totalOrders) > 0.5).length,
      totalDebt: customers.reduce((sum, c) => sum + (c.debtBalance || 0), 0)
  }), [customers]);

  const handleSort = (field: keyof CustomerProfile) => {
      if (sortField === field) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField(field);
          setSortDirection('desc');
      }
  };

  const handleSaveCustomer = (phone: string, updates: Partial<CustomerProfile>) => {
    if (onUpdateCustomer) {
        onUpdateCustomer(phone, updates);
    }
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
            <p className="text-slate-500 dark:text-slate-400 mt-1">تحليل بيانات العملاء، القيمة الدائمة، والمديونيات.</p>
        </div>
      </motion.div>

      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div variants={itemVariants}><StatCard title="إجمالي العملاء" value={stats.totalCustomers} icon={<User/>} color="blue"/></motion.div>
          <motion.div variants={itemVariants}><StatCard title="إجمالي الديون المستحقة" value={`${stats.totalDebt.toLocaleString()} ج.م`} icon={<DollarSign/>} color="red"/></motion.div>
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
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 text-center" onClick={() => handleSort('debtBalance' as any)}>المديونية</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 text-center" onClick={() => handleSort('loyaltyPoints')}>نقاط الولاء</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 text-center" onClick={() => handleSort('totalSpent')}>LTV</th>
                        <th className="px-6 py-4 text-center">نسبة النجاح</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('lastOrderDate')}>آخر ظهور</th>
                        <th className="px-6 py-4 text-center">التصنيف</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCustomers.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-12 text-slate-400">لا يوجد عملاء يطابقون البحث.</td></tr>
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
                                    <td className="px-6 py-4 text-center">
                                        <span onClick={() => setEditingCustomer(customer)} className={`font-black cursor-pointer px-2 py-1 rounded-lg ${customer.debtBalance && customer.debtBalance > 0 ? 'bg-red-50 dark:bg-red-950/30 text-red-600' : 'text-slate-400'}`}>
                                            {(customer.debtBalance || 0).toLocaleString()} ج.م
                                        </span>
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
          <CustomerDetailsModal
              customer={editingCustomer}
              onSave={handleSaveCustomer}
              onClose={() => setEditingCustomer(null)}
          />
      )}
    </motion.div>
  );
};

const CustomerDetailsModal = ({ customer, onSave, onClose }: { customer: CustomerProfile, onSave: (phone: string, updates: Partial<CustomerProfile>) => void, onClose: () => void }) => {
    const [points, setPoints] = useState(customer.loyaltyPoints);
    const [debt, setDebt] = useState(customer.debtBalance || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 animate-in zoom-in-95 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600">
                            <User size={24}/>
                        </div>
                        <div>
                            <h3 className="font-black text-xl dark:text-white leading-tight">{customer.name}</h3>
                            <p className="text-xs text-slate-500 font-bold">{customer.phone}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X className="text-slate-400"/></button>
                </div>
                
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase mb-3 block mr-1">رصيد المديونية (ج.م)</label>
                        <div className="relative">
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
                            <input
                                type="number"
                                value={debt}
                                onChange={e => setDebt(Number(e.target.value))}
                                className="w-full text-right text-2xl font-black bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-red-500 rounded-2xl p-4 pr-10 outline-none transition-all"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold leading-relaxed">
                            ملاحظة: هذا المبلغ سيظهر كتنبيه عند إنشاء أي طلب جديد لهذا العميل.
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase mb-3 block mr-1">نقاط الولاء</label>
                        <div className="relative">
                            <Star className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500" size={20}/>
                            <input
                                type="number"
                                value={points}
                                onChange={e => setPoints(Number(e.target.value))}
                                className="w-full text-right text-2xl font-black bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-amber-500 rounded-2xl p-4 pr-12 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => onSave(customer.phone, { loyaltyPoints: points, debtBalance: debt })} 
                    className="w-full py-4 mt-8 bg-slate-900 dark:bg-white dark:text-slate-950 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-900/10"
                >
                    <Save size={20}/> حفظ البيانات
                </button>
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
