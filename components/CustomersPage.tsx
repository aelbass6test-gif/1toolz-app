import React, { useMemo, useState } from 'react';
import { Order, CustomerProfile } from '../types';
import { 
  Search, User, Phone, MapPin, ShoppingBag, TrendingUp, AlertTriangle, Star, 
  LayoutList, X, Save, DollarSign, Plus, FileSpreadsheet, MessageCircle, 
  PhoneCall, Filter, ArrowUpDown, Eye, Award, CheckCircle2, BarChart3, 
  Users, Sparkles, RefreshCw, LayoutGrid, Layers, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { computeEnrichedCustomers, exportCustomersToExcel, getSegmentLabel, EnrichedCustomerProfile } from './crm/crmUtils';
import { AddCustomerModal } from './crm/AddCustomerModal';
import { Customer360Modal } from './crm/Customer360Modal';
import { CRMCardsGrid } from './crm/CRMCardsGrid';
import { CRMAnalyticsTab } from './crm/CRMAnalyticsTab';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

interface CustomersPageProps {
  orders: Order[];
  loyaltyData: Record<string, number>;
  customers?: CustomerProfile[];
  onUpdateCustomer?: (phone: string, updates: Partial<CustomerProfile>) => void;
}

const CustomersPage: React.FC<CustomersPageProps> = ({ orders, loyaltyData, customers: savedCustomers, onUpdateCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [selectedGov, setSelectedGov] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof EnrichedCustomerProfile>('lastOrderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'analytics'>('table');
  
  // Modals state
  const [selectedCustomer, setSelectedCustomer] = useState<EnrichedCustomerProfile | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Compute Enriched Customers
  const enrichedCustomers = useMemo(() => {
    return computeEnrichedCustomers(orders, loyaltyData, savedCustomers);
  }, [orders, loyaltyData, savedCustomers]);

  // Extract unique governorates
  const uniqueGovernorates = useMemo(() => {
    const govs = new Set<string>();
    enrichedCustomers.forEach(c => {
      const g = (c.governorate || '').trim();
      if (g) govs.add(g);
    });
    return Array.from(govs).sort();
  }, [enrichedCustomers]);

  // Filter & Sort
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter(c => {
      // Search
      const matchesSearch = 
        !searchTerm || 
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phone || '').includes(searchTerm) ||
        (c.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.tags || []).some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

      // Segment Filter
      const matchesSegment = 
        selectedSegment === 'all' || 
        c.computedSegment === selectedSegment ||
        (selectedSegment === 'debt' && (c.debtBalance || 0) > 0);

      // Governorate Filter
      const matchesGov = 
        selectedGov === 'all' || 
        (c.governorate || '').trim() === selectedGov;

      return matchesSearch && matchesSegment && matchesGov;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      }
      return 0;
    });
  }, [enrichedCustomers, searchTerm, selectedSegment, selectedGov, sortField, sortDirection]);

  // Stats summary
  const stats = useMemo(() => {
    return {
      totalCustomers: enrichedCustomers.length,
      vipCount: enrichedCustomers.filter(c => c.computedSegment === 'vip').length,
      debtCount: enrichedCustomers.filter(c => (c.debtBalance || 0) > 0).length,
      totalDebt: enrichedCustomers.reduce((sum, c) => sum + (c.debtBalance || 0), 0),
      newCount: enrichedCustomers.filter(c => c.computedSegment === 'new').length,
      riskCount: enrichedCustomers.filter(c => c.computedSegment === 'risk').length,
      inactiveCount: enrichedCustomers.filter(c => c.computedSegment === 'inactive').length,
      avgLTV: enrichedCustomers.length > 0 ? enrichedCustomers.reduce((sum, c) => sum + c.totalSpent, 0) / enrichedCustomers.length : 0
    };
  }, [enrichedCustomers]);

  const handleSort = (field: keyof EnrichedCustomerProfile) => {
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
    // Update selectedCustomer modal in real-time if open
    if (selectedCustomer && selectedCustomer.phone === phone) {
      setSelectedCustomer(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleExport = () => {
    exportCustomersToExcel(filteredCustomers);
  };

  return (
    <motion.div 
      className="space-y-6 text-right pb-16"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 1. Header Banner */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden shadow-2xl border border-indigo-500/20">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-black">
              <Sparkles size={14} className="text-amber-400 animate-pulse" /> نظام إدارة علاقات العملاء الذكي (CRM 360°)
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
              <span>قاعدة بيانات العملاء والذمم</span>
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
              تحليل شامل لسلوك الشراء، متابعة القيمة الدائمة (LTV)، تصنيف العملاء تلقائياً بالذكاء الاصطناعي، وإدارة أرصدة المديونيات وحركات السداد لحظياً.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 md:flex-none px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs md:text-sm"
            >
              <Plus size={18} /> إضافة عميل جديد
            </button>

            <button
              onClick={handleExport}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2 text-xs"
              title="تصدير قائمة العملاء المعروضة إلى ملف Excel"
            >
              <FileSpreadsheet size={18} className="text-emerald-400" /> تصدير إكسل ({filteredCustomers.length})
            </button>
          </div>
        </div>
      </motion.div>

      {/* 2. Clickable KPI Stat Cards Grid */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <StatCard 
          title="إجمالي العملاء" 
          value={stats.totalCustomers} 
          subtitle="قاعدة العملاء"
          icon={<Users />} 
          color="blue"
          isActive={selectedSegment === 'all'}
          onClick={() => setSelectedSegment('all')}
        />
        <StatCard 
          title="عملاء النخبة VIP" 
          value={stats.vipCount} 
          subtitle="الأكثر إنفاقاً"
          icon={<Award />} 
          color="amber"
          isActive={selectedSegment === 'vip'}
          onClick={() => setSelectedSegment(selectedSegment === 'vip' ? 'all' : 'vip')}
        />
        <StatCard 
          title="إجمالي المديونيات" 
          value={`${stats.totalDebt.toLocaleString()} ج.م`} 
          subtitle={`لدى ${stats.debtCount} عميل`}
          icon={<DollarSign />} 
          color="rose"
          isActive={selectedSegment === 'debt'}
          onClick={() => setSelectedSegment(selectedSegment === 'debt' ? 'all' : 'debt')}
        />
        <StatCard 
          title="عملاء جدد" 
          value={stats.newCount} 
          subtitle="خلال 14 يوماً"
          icon={<Sparkles />} 
          color="emerald"
          isActive={selectedSegment === 'new'}
          onClick={() => setSelectedSegment(selectedSegment === 'new' ? 'all' : 'new')}
        />
        <StatCard 
          title="عالي المخاطر" 
          value={stats.riskCount} 
          subtitle="مرتجعات متكررة"
          icon={<AlertTriangle />} 
          color="red"
          isActive={selectedSegment === 'risk'}
          onClick={() => setSelectedSegment(selectedSegment === 'risk' ? 'all' : 'risk')}
        />
        <StatCard 
          title="خاملون (يحتاج تنشيط)" 
          value={stats.inactiveCount} 
          subtitle="تجاوزوا 30 يوماً"
          icon={<TrendingUp />} 
          color="slate"
          isActive={selectedSegment === 'inactive'}
          onClick={() => setSelectedSegment(selectedSegment === 'inactive' ? 'all' : 'inactive')}
        />
      </motion.div>

      {/* 3. Action Bar & View Toggles & Filters */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث باسم العميل، رقم الهاتف، العنوان، المدينة، أو الوسوم (#)..." 
              className="w-full pr-11 pl-10 py-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-xs md:text-sm transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Governorate Dropdown & View Mode Toggles */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Governorate Filter */}
            <div className="relative">
              <select
                value={selectedGov}
                onChange={e => setSelectedGov(e.target.value)}
                className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer pl-8"
              >
                <option value="all">🌐 كل المحافظات والمدن</option>
                {uniqueGovernorates.map(gov => (
                  <option key={gov} value={gov}>📍 {gov}</option>
                ))}
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                  viewMode === 'table' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="عرض الجدول المتطور"
              >
                <LayoutList size={16} />
                <span className="hidden sm:inline">الجدول</span>
              </button>

              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="عرض بطاقات العملاء"
              >
                <LayoutGrid size={16} />
                <span className="hidden sm:inline">البطاقات</span>
              </button>

              <button
                onClick={() => setViewMode('analytics')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                  viewMode === 'analytics' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="لوحة التحليلات الذكية"
              >
                <BarChart3 size={16} />
                <span className="hidden sm:inline">التحليلات</span>
              </button>
            </div>
          </div>
        </div>

        {/* Segment Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-slate-100 dark:border-slate-800 pt-3">
          <span className="text-xs font-black text-slate-400 flex items-center gap-1 shrink-0 ml-1">
            <Filter size={14} /> التصنيف:
          </span>

          {[
            { id: 'all', label: '🌐 الكل', count: enrichedCustomers.length },
            { id: 'vip', label: '⭐ النخبة (VIP)', count: stats.vipCount },
            { id: 'regular', label: '🟢 منتظمون', count: enrichedCustomers.filter(c => c.computedSegment === 'regular').length },
            { id: 'debt', label: '🔴 عليهم مديونية', count: stats.debtCount },
            { id: 'new', label: '🌟 عملاء جدد', count: stats.newCount },
            { id: 'risk', label: '⚠️ عالي المخاطر', count: stats.riskCount },
            { id: 'inactive', label: '💤 خاملون', count: stats.inactiveCount }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedSegment(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedSegment === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${selectedSegment === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* 4. Body Rendering based on ViewMode */}
      <AnimatePresence mode="wait">
        {viewMode === 'table' && (
          <motion.div 
            key="table-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider border-b dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">العميل <ArrowUpDown size={12} /></div>
                    </th>
                    <th className="px-5 py-4 cursor-pointer hover:text-indigo-600 text-center transition-colors" onClick={() => handleSort('totalOrders')}>
                      <div className="flex items-center justify-center gap-1">الطلبات <ArrowUpDown size={12} /></div>
                    </th>
                    <th className="px-5 py-4 cursor-pointer hover:text-indigo-600 text-center transition-colors" onClick={() => handleSort('debtBalance')}>
                      <div className="flex items-center justify-center gap-1">المديونية <ArrowUpDown size={12} /></div>
                    </th>
                    <th className="px-5 py-4 cursor-pointer hover:text-indigo-600 text-center transition-colors" onClick={() => handleSort('loyaltyPoints')}>
                      <div className="flex items-center justify-center gap-1">نقاط الولاء <ArrowUpDown size={12} /></div>
                    </th>
                    <th className="px-5 py-4 cursor-pointer hover:text-indigo-600 text-center transition-colors" onClick={() => handleSort('totalSpent')}>
                      <div className="flex items-center justify-center gap-1">LTV (الإنفاق) <ArrowUpDown size={12} /></div>
                    </th>
                    <th className="px-5 py-4 text-center">نسبة النجاح والصحة</th>
                    <th className="px-5 py-4 cursor-pointer hover:text-indigo-600 text-center transition-colors" onClick={() => handleSort('lastOrderDate')}>
                      <div className="flex items-center justify-center gap-1">آخر ظهور <ArrowUpDown size={12} /></div>
                    </th>
                    <th className="px-5 py-4 text-center">التصنيف</th>
                    <th className="px-5 py-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-slate-400 font-bold">
                        <User size={40} className="mx-auto mb-3 opacity-30 text-indigo-500" />
                        لا يوجد عملاء يطابقون معايير البحث أو الفلترة الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(customer => {
                      const segInfo = getSegmentLabel(customer.computedSegment);
                      const hasDebt = (customer.debtBalance || 0) > 0;

                      let avatarGradient = 'from-blue-500 to-indigo-600';
                      if (customer.computedSegment === 'vip') avatarGradient = 'from-amber-500 to-yellow-600';
                      else if (customer.computedSegment === 'risk' || hasDebt) avatarGradient = 'from-rose-500 to-red-600';
                      else if (customer.computedSegment === 'new') avatarGradient = 'from-emerald-500 to-teal-600';

                      return (
                        <tr 
                          key={customer.id} 
                          onClick={() => setSelectedCustomer(customer)}
                          className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                        >
                          {/* Customer Info & Avatar */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${avatarGradient} text-white font-black text-sm flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
                                {customer.name ? customer.name.slice(0, 2) : 'ع'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm truncate">
                                  {customer.name}
                                </div>
                                <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5 dir-ltr">
                                  <Phone size={10} className="text-indigo-500 shrink-0" />
                                  <span>{customer.phone}</span>
                                </div>
                                {(customer.governorate || customer.city) && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] mt-0.5">
                                    <MapPin size={10} className="inline mr-0.5 ml-0.5 text-rose-500" />
                                    <span>{customer.governorate || ''} {customer.city ? `، ${customer.city}` : ''}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Orders */}
                          <td className="px-5 py-4 text-center">
                            <div className="inline-flex items-center gap-1 font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-xl text-xs">
                              <ShoppingBag size={13} /> {customer.totalOrders}
                            </div>
                          </td>

                          {/* Debt */}
                          <td className="px-5 py-4 text-center">
                            <span className={`font-black px-3 py-1 rounded-xl text-xs inline-block transition-all ${
                              hasDebt 
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 shadow-sm animate-pulse' 
                                : 'text-slate-400'
                            }`}>
                              {hasDebt ? `${(customer.debtBalance || 0).toLocaleString()} ج.م` : '0 ج.م'}
                            </span>
                          </td>

                          {/* Loyalty Points */}
                          <td className="px-5 py-4 text-center">
                            <span className="font-black text-amber-600 dark:text-amber-400 text-xs inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-xl">
                              <Star size={12} className="fill-amber-500 text-amber-500" />
                              {customer.loyaltyPoints.toLocaleString()}
                            </span>
                          </td>

                          {/* LTV */}
                          <td className="px-5 py-4 text-center">
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {customer.totalSpent.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span>
                            </span>
                          </td>

                          {/* Success Rate & Health Meter */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center gap-1 max-w-[100px] mx-auto">
                              <div className="flex items-center justify-between w-full text-[10px] font-black">
                                <span className={customer.successRate >= 80 ? 'text-emerald-600' : customer.successRate >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                                  نجاح: {customer.successRate.toFixed(0)}%
                                </span>
                                <span className="text-slate-400">| صحة: {customer.healthScore}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${customer.successRate >= 80 ? 'bg-emerald-500' : customer.successRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                  style={{ width: `${customer.successRate}%` }} 
                                />
                              </div>
                            </div>
                          </td>

                          {/* Last Seen */}
                          <td className="px-5 py-4 text-center font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                            {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('ar-EG') : 'غير متوفر'}
                          </td>

                          {/* Segment Badge */}
                          <td className="px-5 py-4 text-center">
                            <span className={`px-3 py-1 rounded-xl text-[10px] font-black border ${segInfo.bg}`}>
                              {segInfo.label}
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedCustomer(customer)}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 transition-colors"
                                title="عرض الملف الشامل 360°"
                              >
                                <Eye size={15} />
                              </button>

                              <a
                                href={`https://wa.me/2${customer.phone.replace(/^0+/, '0')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-colors"
                                title="مراسلة واتساب"
                              >
                                <MessageCircle size={15} />
                              </a>

                              <a
                                href={`tel:${customer.phone}`}
                                className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 text-blue-600 hover:text-white transition-colors"
                                title="اتصال مباشر"
                              >
                                <PhoneCall size={15} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {viewMode === 'grid' && (
          <motion.div key="grid-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CRMCardsGrid customers={filteredCustomers} onSelectCustomer={setSelectedCustomer} />
          </motion.div>
        )}

        {viewMode === 'analytics' && (
          <motion.div key="analytics-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CRMAnalyticsTab 
              customers={enrichedCustomers} 
              onFilterBySegment={(seg) => { 
                setSelectedSegment(seg); 
                setViewMode('table'); 
              }} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Modals */}
      <Customer360Modal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onSave={handleSaveCustomer}
      />

      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={(phone, newProfile) => {
          handleSaveCustomer(phone, newProfile);
          alert('تمت إضافة العميل الجديد بنجاح إلى قاعدة بيانات العملاء! ✔️');
        }}
      />
    </motion.div>
  );
};

const StatCard = ({ title, value, subtitle, icon, color, isActive, onClick }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
    amber: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
    rose: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50',
    red: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
    slate: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  };

  return (
    <div 
      onClick={onClick}
      className={`p-4 md:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
        isActive 
          ? 'ring-2 ring-indigo-500 shadow-xl scale-[1.02] bg-white dark:bg-slate-900 border-indigo-500' 
          : 'bg-white dark:bg-slate-900 hover:border-indigo-400/60 dark:hover:border-indigo-500/50 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className={`p-2.5 rounded-2xl border ${colors[color] || colors.blue}`}>
          {React.cloneElement(icon, { size: 18 })}
        </div>
        {isActive && (
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
        )}
      </div>

      <div>
        <div className="text-[11px] font-black text-slate-400 uppercase tracking-wide truncate">{title}</div>
        <div className="text-lg md:text-xl font-black text-slate-800 dark:text-white mt-0.5 truncate">{value}</div>
        {subtitle && (
          <div className="text-[10px] font-bold text-slate-400 mt-1 truncate">{subtitle}</div>
        )}
      </div>
    </div>
  );
};

export default CustomersPage;
