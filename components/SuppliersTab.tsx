import React, { useState, useMemo } from 'react';
import { 
  UserPlus, User, Phone, MapPin, DollarSign, FileText, ShoppingCart, 
  MessageCircle, Star, Shield, Award, CreditCard, Building, Building2, 
  Filter, Search, X, Check, ArrowUpRight, ArrowDownRight, RefreshCw, 
  Calendar, FileSpreadsheet, Printer, AlertCircle, Coins, Receipt, ArrowRight,
  Plus, Edit2, Trash2, HelpCircle, ExternalLink, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { Supplier, SupplyOrder, Settings } from '../types';
import { audioSynth } from '../utils/audioSynth';
import { motion, AnimatePresence } from 'motion/react';

interface SuppliersTabProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  showAlert: (title: string, message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onOpenPaymentModal: (supplier: Supplier) => void;
  onOpenNewOrderModal: (supplierId?: string) => void;
  wallet?: any;
  treasury?: any;
}

export const SuppliersTab: React.FC<SuppliersTabProps> = ({
  settings,
  setSettings,
  showAlert,
  showConfirm,
  onOpenPaymentModal,
  onOpenNewOrderModal,
  wallet,
  treasury
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debtFilter, setDebtFilter] = useState<'all' | 'indebted' | 'cleared' | 'credit'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);

  // Modals state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: '',
    phone: '',
    address: '',
    notes: '',
    balance: 0,
    category: 'general',
    creditLimit: undefined,
    taxNumber: '',
    bankAccount: '',
    rating: 5,
    tier: 'standard'
  });

  // Detailed Account Statement Modal
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  // Executive KPI summary
  const kpis = useMemo(() => {
    const suppliers = settings.suppliers || [];
    const orders = settings.supplyOrders || [];

    let totalLiabilities = 0;
    let clearedCount = 0;
    let indebtedCount = 0;
    let totalPurchasesAmount = 0;

    suppliers.forEach(s => {
      const bal = s.balance || 0;
      if (bal > 0) {
        totalLiabilities += bal;
        indebtedCount += 1;
      } else {
        clearedCount += 1;
      }
    });

    orders.forEach(o => {
      if (o.status === 'completed') {
        totalPurchasesAmount += (o.grandTotal || o.totalCost || 0);
      }
    });

    return {
      count: suppliers.length,
      totalLiabilities,
      clearedCount,
      indebtedCount,
      totalPurchasesAmount,
      totalOrders: orders.length
    };
  }, [settings.suppliers, settings.supplyOrders]);

  const handleCreateDefaultSuppliers = () => {
    const defaultSuppliers: Supplier[] = [
      {
        id: 'sup-1-' + Date.now(),
        name: 'شركة النور للتوريدات الغذائية والجملة',
        phone: '01011112222',
        address: 'شارع الهرم - الجيزة',
        category: 'raw_materials',
        tier: 'vip',
        rating: 5,
        balance: 12500,
        creditLimit: 50000,
        taxNumber: '302-401-889',
        notes: 'مورد معتمد لخامات التعبئة والمواد الأساسية - خصم تجاري 5%'
      },
      {
        id: 'sup-2-' + (Date.now() + 1),
        name: 'مؤسسة الأمانة للخدمات واللوجستيات',
        phone: '01033334444',
        address: 'مدينة العبور - المنطقة الصناعية الأولى',
        category: 'logistics',
        tier: 'standard',
        rating: 5,
        balance: 0,
        creditLimit: 20000,
        taxNumber: '110-220-330',
        notes: 'تجهيزات ومعدات تشغيل المخازن ونقاط البيع'
      }
    ];
    setSettings(prev => ({
      ...prev,
      suppliers: [...(prev.suppliers || []), ...defaultSuppliers]
    }));
    showAlert('تم الإضافة بنجاح', 'تم إدراج شركاء التوريد المعتمدين بنجاح في سجلات الموردين.', 'success');
  };

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return (settings.suppliers || []).filter(s => {
      // Search match
      const name = s.name || 'مورد بدون اسم';
      const address = s.address || '';
      const phone = s.phone || '';
      const tax = s.taxNumber || '';
      const bank = s.bankAccount || '';
      const matchesSearch = 
        !searchTerm ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.includes(searchTerm) ||
        address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tax.includes(searchTerm) ||
        bank.toLowerCase().includes(searchTerm.toLowerCase());

      // Debt filter
      const bal = s.balance || 0;
      let matchesDebt = true;
      if (debtFilter === 'indebted') matchesDebt = bal > 0;
      else if (debtFilter === 'cleared') matchesDebt = bal === 0;
      else if (debtFilter === 'credit') matchesDebt = bal < 0;

      // Category filter
      const matchesCat = categoryFilter === 'all' || s.category === categoryFilter || (!s.category && categoryFilter === 'general');

      return matchesSearch && matchesDebt && matchesCat;
    });
  }, [settings.suppliers, searchTerm, debtFilter, categoryFilter]);

  // Helper for avatar colors
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-500 text-white border-indigo-400',
      'bg-emerald-500 text-white border-emerald-400',
      'bg-amber-500 text-white border-amber-400',
      'bg-rose-500 text-white border-rose-400',
      'bg-cyan-500 text-white border-cyan-400',
      'bg-violet-500 text-white border-violet-400',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Helper for VIP Tier Badge
  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'vip':
        return { label: '💎 مورد استراتيجي VIP', color: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20' };
      case 'gold':
        return { label: '🥇 شريك معتمد Gold', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800' };
      default:
        return { label: '🤝 مورد معتمد', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  // Helper for Category Label
  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case 'raw_materials': return '📦 خامات ومواد أولية';
      case 'ready_products': return '🛍️ منتجات جاهزة للبيع';
      case 'logistics': return '🚚 خدمات شحن وتخليص';
      default: return '🏢 توريدات عامة';
    }
  };

  // Add / Edit Supplier Handlers
  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setNewSupplier({
      name: '',
      phone: '',
      address: '',
      notes: '',
      balance: 0,
      category: 'general',
      creditLimit: undefined,
      taxNumber: '',
      bankAccount: '',
      rating: 5,
      tier: 'standard'
    });
    setShowSupplierModal(true);
  };

  const handleOpenEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setNewSupplier({ ...s });
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = () => {
    if (!newSupplier.name?.trim()) {
      showAlert("تنبيه", "يرجى إدخال اسم المورد أو الشريك المالي", "warning");
      return;
    }

    setSettings(prev => {
      const suppliers = prev.suppliers || [];
      let updatedSuppliers: Supplier[];

      if (editingSupplier) {
        updatedSuppliers = suppliers.map(s => s.id === editingSupplier.id ? { ...s, ...newSupplier } as Supplier : s);
      } else {
        const created: Supplier = {
          id: Date.now().toString(),
          name: newSupplier.name || 'مورد جديد',
          phone: newSupplier.phone || '',
          address: newSupplier.address || '',
          notes: newSupplier.notes || '',
          balance: Number(newSupplier.balance || 0),
          category: newSupplier.category || 'general',
          creditLimit: newSupplier.creditLimit ? Number(newSupplier.creditLimit) : undefined,
          taxNumber: newSupplier.taxNumber || '',
          bankAccount: newSupplier.bankAccount || '',
          rating: (newSupplier.rating || 5) as any,
          tier: newSupplier.tier || 'standard'
        };
        updatedSuppliers = [...suppliers, created];
      }

      return { ...prev, suppliers: updatedSuppliers };
    });

    audioSynth.announce(editingSupplier ? "تم تحديث بيانات المورد" : "تم تسجيل المورد الجديد بنجاح", "success");
    setShowSupplierModal(false);
  };

  const handleDeleteSupplier = (id: string) => {
    const s = (settings.suppliers || []).find(x => x.id === id);
    if (!s) return;

    // Check associated orders
    const hasOrders = (settings.supplyOrders || []).some(o => o.supplierId === id);
    if (hasOrders) {
      showAlert(
        "خطأ في الحذف",
        `لا يمكن حذف المورد "${s.name}" لأنه مرتبط بفواتير وأوامر توريد مسجلة في النظام. يرجى حذف الفواتير التابعة له أولاً إذا كنت ترغب في إزالته بالكامل.`,
        "error"
      );
      return;
    }

    showConfirm("تأكيد الحذف", `هل أنت متأكد من حذف المورد "${s.name}"؟ لا يمكن التراجع عن هذا الإجراء.`, () => {
      setSettings(prev => ({
        ...prev,
        suppliers: (prev.suppliers || []).filter(x => x.id !== id)
      }));
      audioSynth.announce("تم حذف المورد بنجاح", "success");
    });
  };

  // WhatsApp helper
  const handleOpenWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      showAlert("تنبيه", "لا يوجد رقم هاتف مسجل لهذا المورد", "warning");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone.startsWith('2') ? cleanPhone : '2' + cleanPhone}?text=${encodeURIComponent(`مرحباً أستاذ ${name || 'الكريم'}، تواصل من إدارة المشتريات..`)}`;
    window.open(url, '_blank');
  };

  // Build statement entries for selected statement supplier
  const statementEntries = useMemo(() => {
    if (!statementSupplier) return [];
    const supId = statementSupplier.id;
    const orders = (settings.supplyOrders || []).filter(o => o.supplierId === supId);
    const returns = (settings.purchaseReturns || []).filter(r => r.supplierId === supId);

    const list: {
      id: string;
      date: string;
      type: 'order' | 'return' | 'payment';
      title: string;
      reference: string;
      debit: number; // زيادة المديونية (فاتورة شراء)
      credit: number; // سداد أو مرتجع
      notes?: string;
      isPaid?: boolean;
      isAutoPaid?: boolean;
      paymentMethod?: string;
    }[] = [];

    // Calculate autoPaidOrdersMap for this supplier
    const paidMap = new Map<string, boolean>();
    orders.forEach(o => {
      if (o.paymentMethod !== 'credit') {
        paidMap.set(o.id, true);
      } else if (o.isPaid) {
        paidMap.set(o.id, true);
      } else {
        paidMap.set(o.id, false);
      }
    });

    // Match by explicit reference in transaction notes
    const walletTxs = wallet?.transactions || [];
    const treasuryTxs = treasury?.transactions || [];
    const allTxs = [
      ...(walletTxs || []).map((t: any) => ({ note: t.note || '', amount: Number(t.amount) || 0 })),
      ...(treasuryTxs || []).map((t: any) => ({ note: t.description || '', amount: Number(t.amount) || 0 }))
    ];

    orders.forEach(o => {
      if (paidMap.get(o.id)) return;
      const ref = o.referenceNumber;
      const orderNo = o.orderNumber;
      const id = o.id;

      const foundExplicit = allTxs.some(t => {
        const noteLower = t.note.toLowerCase();
        const hasId = id && noteLower.includes(id.toLowerCase());
        const hasRef = ref && noteLower.includes(ref.toLowerCase());
        const hasOrderNo = orderNo && noteLower.includes(orderNo.toLowerCase());
        return hasId || hasRef || hasOrderNo;
      });

      if (foundExplicit) {
        paidMap.set(o.id, true);
      }
    });

    // FIFO balance matching for this supplier
    const supplierCreditOrders = [...orders]
      .filter(o => o.paymentMethod === 'credit')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute based on supplier balance (ultimate truth of paid amount)
    const currentBalance = statementSupplier.balance || 0;
    const totalCreditCost = supplierCreditOrders.reduce((sum, o) => sum + (o.grandTotal || o.totalCost || 0), 0);
    const totalPaidFromBalance = Math.max(0, totalCreditCost - Math.max(0, currentBalance));

    const nameToMatch = statementSupplier.name;
    const supplierPayments = [
      ...(walletTxs || []).filter((t: any) => {
        const isSupplierPayment = t.category === 'supplier_payment' || t.category === 'supply_purchase';
        const matchesName = t.note && t.note.includes(nameToMatch);
        return isSupplierPayment && matchesName;
      }).map((t: any) => Number(t.amount) || 0),
      ...(treasuryTxs || []).filter((t: any) => {
        const matchesName = t.description && t.description.includes(nameToMatch);
        return matchesName;
      }).map((t: any) => Number(t.amount) || 0)
    ];

    const totalPaidFromTxs = supplierPayments.reduce((sum, amt) => sum + amt, 0);
    let totalPaid = Math.max(totalPaidFromBalance, totalPaidFromTxs);

    supplierCreditOrders.forEach(o => {
      const cost = o.grandTotal || o.totalCost || 0;
      if (totalPaid >= cost) {
        paidMap.set(o.id, true);
        totalPaid -= cost;
      }
    });

    // Add orders
    orders.forEach(o => {
      const isPaid = !!paidMap.get(o.id);
      const isAutoPaid = isPaid && (o.paymentMethod === 'credit') && !o.isPaid;
      list.push({
        id: o.id,
        date: o.date || new Date().toISOString(),
        type: 'order',
        title: `فاتورة شراء وتوريد # ${o.referenceNumber || o.orderNumber || o.id.slice(-4)}`,
        reference: o.referenceNumber || o.orderNumber || o.id,
        debit: o.grandTotal || o.totalCost || 0,
        credit: 0,
        notes: o.notes,
        isPaid: isPaid,
        isAutoPaid: isAutoPaid,
        paymentMethod: o.paymentMethod
      });
    });

    // Add returns
    returns.forEach(r => {
      list.push({
        id: r.id,
        date: r.date || new Date().toISOString(),
        type: 'return',
        title: `إشعار مرتجع مشتريات # ${r.returnNumber || r.id.slice(-4)}`,
        reference: r.returnNumber || r.id,
        debit: 0,
        credit: r.totalRefundAmount || 0,
        notes: r.notes
      });
    });

    // Add wallet payments
    walletTxs.forEach((t: any) => {
      const isSupplierPayment = t.category === 'supplier_payment' || t.category === 'supply_purchase';
      const matchesName = t.note && t.note.includes(nameToMatch);
      if (isSupplierPayment && matchesName) {
        list.push({
          id: t.id,
          date: t.date || new Date().toISOString(),
          type: 'payment',
          title: `سداد مديونية للمورد (${t.category === 'supply_purchase' ? 'محفظة التوريد' : 'المحفظة العامة'})`,
          reference: t.id,
          debit: 0,
          credit: Number(t.amount) || 0,
          notes: t.note
        });
      }
    });

    // Add treasury payments
    treasuryTxs.forEach((t: any) => {
      const matchesName = t.description && t.description.includes(nameToMatch);
      if (matchesName) {
        list.push({
          id: t.id,
          date: t.date || new Date().toISOString(),
          type: 'payment',
          title: `سداد مديونية للمورد (الخزينة)`,
          reference: t.id,
          debit: 0,
          credit: Number(t.amount) || 0,
          notes: t.description
        });
      }
    });

    // Sort ascending by date
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance
    let running = 0;
    return list.map(item => {
      running = running + item.debit - item.credit;
      return { ...item, runningBalance: running };
    });
  }, [statementSupplier, settings.supplyOrders, settings.purchaseReturns, wallet, treasury]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300" dir="rtl">
      {/* 1. Executive KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden border border-indigo-500/20">
          <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <User size={24} className="text-indigo-400" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full">
              الشركاء الماليين
            </span>
          </div>
          <p className="text-xs font-bold text-slate-300">إجمالي الموردين والشركاء المسجلين</p>
          <h3 className="text-3xl font-black mt-1 tracking-tight flex items-baseline gap-2">
            {kpis.count}
            <span className="text-sm font-bold text-indigo-400">مورد معتمد</span>
          </h3>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl">
              <Coins size={24} />
            </div>
            <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-full">
              مديونيات مستحقة ({kpis.indebtedCount})
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400">إجمالي المديونيات المطلوبة للموردين</p>
          <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1 tracking-tight">
            {kpis.totalLiabilities.toLocaleString()}
            <span className="text-xs font-bold text-slate-400 mr-1.5">ج.م</span>
          </h3>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full">
              مخلص بالكامل
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400">موردين بدون مديونية قائمة</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {kpis.clearedCount}
            <span className="text-xs font-bold text-slate-400 mr-1.5">شريك</span>
          </h3>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl">
              <ShoppingCart size={24} />
            </div>
            <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full">
              حجم التعاملات
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400">إجمالي قيم التوريدات المكتملة</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {kpis.totalPurchasesAmount.toLocaleString()}
            <span className="text-xs font-bold text-slate-400 mr-1.5">ج.م</span>
          </h3>
        </div>
      </div>

      {/* 2. Action Toolbar & Filter Suite */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 sm:flex-none">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="ابحث باسم المورد، الهاتف، الرقم الضريبي أو الآيبان..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Debt Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'indebted', label: '🔴 علينا مديونية' },
              { id: 'cleared', label: '🟢 مخلصين بالكامل' },
              { id: 'credit', label: '🔵 رصيد دائن' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDebtFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  debtFilter === tab.id
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">كل التصنيفات</option>
            <option value="raw_materials">📦 خامات ومواد أولية</option>
            <option value="ready_products">🛍️ منتجات جاهزة للبيع</option>
            <option value="logistics">🚚 خدمات شحن وتخليص</option>
            <option value="general">🏢 توريدات عامة</option>
          </select>
        </div>

        {/* Add Supplier Button */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onOpenNewOrderModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-xs transition-all cursor-pointer shadow-sm"
          >
            <ShoppingCart size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span>طلب توريد جديد</span>
          </button>

          <button 
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
          >
            <UserPlus size={16} />
            <span>إضافة شريك توريد جديد</span>
          </button>
        </div>
      </div>

      {/* 3. Suppliers Cards Grid */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-16 text-center rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-500">
            <User size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
            {(settings.suppliers || []).length === 0 
              ? 'لا يوجد أي موردين أو شركاء توريد مسجلين حالياً' 
              : 'لا يوجد موردين مطابقين للبحث أو الفلتر المختار'}
          </h3>
          <p className="text-slate-400 text-sm font-bold max-w-md mx-auto mb-8">
            {(settings.suppliers || []).length === 0 
              ? 'قم بتسجيل بيانات شركاء التوريد الماليين وموردي الخامات لتمكين تسجيل الفواتير وسداد الصفقات الآجلة.'
              : 'قم بتغيير خيارات الفلترة المالية أو مسح كلمات البحث لعرض الموردين المسجلين في نظامك.'}
          </p>
          {(settings.suppliers || []).length === 0 ? (
            <button
              onClick={handleCreateDefaultSuppliers}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/30 transition-all cursor-pointer hover:-translate-y-0.5"
            >
              <Plus size={18} />
              <span>⚡ إضافة موردين نموذجيين معتمدين الآن (تجهيزات وخامات)</span>
            </button>
          ) : (
            <button
              onClick={() => { setDebtFilter('all'); setCategoryFilter('all'); setSearchTerm(''); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-xs transition-all cursor-pointer shadow-sm"
            >
              <span>🔄 عرض كل الموردين ({settings.suppliers.length})</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map(s => {
            const bal = s.balance || 0;
            const supplierOrders = (settings.supplyOrders || []).filter(o => o.supplierId === s.id);
            const supplierReturns = (settings.purchaseReturns || []).filter(r => r.supplierId === s.id);
            const completedPurchases = supplierOrders.filter(o => o.status === 'completed').length;
            const tierBadge = getTierBadge(s.tier);
            const isExpanded = expandedSupplierId === s.id;

            // Credit utilization if defined
            const creditPercent = s.creditLimit && s.creditLimit > 0
              ? Math.min(100, Math.round((bal / s.creditLimit) * 100))
              : null;

            return (
              <div 
                key={s.id}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden relative group"
              >
                <div className="p-6 space-y-4">
                  {/* Avatar, Tier & Action Buttons */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 shadow-sm shrink-0 ${getAvatarColor(s.name)}`}>
                        {(s.name || 'م')[0]}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black ${tierBadge.color}`}>
                            {tierBadge.label}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-xs">
                          {s.name}
                        </h4>
                        <p className="text-slate-400 text-xs font-extrabold flex items-center gap-1 mt-0.5" dir="ltr">
                          <Phone size={12} className="text-emerald-500" />
                          <span>{s.phone || 'بلا رقم هاتف'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(s)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all cursor-pointer"
                        title="تعديل المورد"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(s.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
                        title="حذف المورد"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Category & Rating */}
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 px-3.5 py-2 rounded-2xl border border-slate-100 dark:border-slate-800/60 text-xs">
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">
                      {getCategoryLabel(s.category)}
                    </span>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          size={12} 
                          className={star <= (s.rating || 5) ? 'fill-amber-500 text-amber-500' : 'text-slate-300 dark:text-slate-700'} 
                        />
                      ))}
                    </div>
                  </div>

                  {/* Financial Balance Pill Box */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    bal > 0 
                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40' 
                      : bal < 0
                      ? 'bg-cyan-50/70 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900/40'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60'
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                        {bal > 0 ? '🔴 مديونية قائمة علينا:' : bal < 0 ? '🔵 رصيد دائن لنا عنده:' : '🟢 موقف مالي مخلص:'}
                      </span>
                      {bal > 0 && (
                        <button
                          onClick={() => onOpenPaymentModal(s)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>سداد دفعة</span>
                          <DollarSign size={11}/>
                        </button>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className={`text-2xl font-black ${
                        bal > 0 ? 'text-rose-600 dark:text-rose-400' : bal < 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {Math.abs(bal).toLocaleString()}
                        <span className="text-xs font-bold ml-1">ج.م</span>
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {bal > 0 ? 'مستحق للمورد' : bal < 0 ? 'مدفوع بالزيادة' : 'صفر'}
                      </span>
                    </div>

                    {/* Credit Limit utilization */}
                    {creditPercent !== null && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1">
                        <div className="flex justify-between text-[10px] font-extrabold text-slate-500">
                          <span>الحد الائتماني: {s.creditLimit?.toLocaleString()} ج.م</span>
                          <span>استهلاك: {creditPercent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              creditPercent > 90 ? 'bg-rose-600' : creditPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${creditPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transaction Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">طلبيات مكتملة</span>
                      <span className="text-sm font-black text-slate-800 dark:text-slate-200">{completedPurchases} صفقة</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">مرتجعات واستبدال</span>
                      <span className="text-sm font-black text-slate-800 dark:text-slate-200">{supplierReturns.length} محضر</span>
                    </div>
                  </div>

                  {/* Expandable details (address, bank, tax) */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800"
                      >
                        {s.address && (
                          <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                            <MapPin size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                            <span><strong>العنوان:</strong> {s.address}</span>
                          </div>
                        )}
                        {s.taxNumber && (
                          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl font-mono">
                            <Receipt size={14} className="text-amber-500 shrink-0" />
                            <span><strong>الرقم الضريبي:</strong> {s.taxNumber}</span>
                          </div>
                        )}
                        {s.bankAccount && (
                          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl font-mono truncate">
                            <CreditCard size={14} className="text-emerald-500 shrink-0" />
                            <span className="truncate"><strong>الحساب/IBAN:</strong> {s.bankAccount}</span>
                          </div>
                        )}
                        {s.notes && (
                          <p className="p-2.5 bg-amber-50/50 dark:bg-amber-950/10 text-amber-900 dark:text-amber-200 rounded-xl text-[11px]">
                            <strong>ملاحظات:</strong> {s.notes}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Bottom Action Suite */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 px-6 py-3">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStatementSupplier(s)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                        title="كشف حساب زمني"
                      >
                        <FileText size={13} />
                        <span>كشف حساب</span>
                      </button>

                      <button
                        onClick={() => onOpenNewOrderModal(s.id)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                        title="طلب توريد من هذا المورد"
                      >
                        <ShoppingCart size={13} />
                        <span>طلب توريد</span>
                      </button>

                      <button
                        onClick={() => handleOpenWhatsApp(s.phone, s.name)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all cursor-pointer"
                        title="تواصل وتساب مباشر"
                      >
                        <MessageCircle size={16} />
                      </button>
                    </div>

                    <button
                      onClick={() => setExpandedSupplierId(isExpanded ? null : s.id)}
                      className="text-[11px] font-extrabold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {isExpanded ? 'إخفاء التفاصيل ▲' : 'التفاصيل ▼'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Add / Edit Supplier Modal Dialog */}
      <AnimatePresence>
        {showSupplierModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center font-black backdrop-blur-sm">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{editingSupplier ? 'تعديل بيانات المورد والشريك المالي' : 'إضافة شريك توريد ومورد جديد'}</h3>
                    <p className="text-xs text-indigo-100 font-bold">تسجيل جهات التوريد، الحدود الائتمانية والبيانات الضريبية</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSupplierModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      اسم الشريك أو الشركة <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: شركة النور للتوريدات، مؤسسة الأهرام..."
                      value={newSupplier.name || ''}
                      onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      رقم الهاتف / وتساب
                    </label>
                    <input
                      type="text"
                      placeholder="01xxxxxxxxx"
                      value={newSupplier.phone || ''}
                      onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Category & VIP Tier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      تصنيف المورد
                    </label>
                    <select
                      value={newSupplier.category || 'general'}
                      onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value as any })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="raw_materials">📦 خامات ومواد أولية</option>
                      <option value="ready_products">🛍️ منتجات جاهزة للبيع</option>
                      <option value="logistics">🚚 خدمات شحن وتخليص</option>
                      <option value="general">🏢 توريدات عامة</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      مستوى الشراكة (VIP Tier)
                    </label>
                    <select
                      value={newSupplier.tier || 'standard'}
                      onChange={e => setNewSupplier({ ...newSupplier, tier: e.target.value as any })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="standard">🤝 مورد معتمد Standard</option>
                      <option value="gold">🥇 شريك معتمد Gold</option>
                      <option value="vip">💎 مورد استراتيجي VIP</option>
                    </select>
                  </div>
                </div>

                {/* Rating & Opening Balance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      الرصيد الافتتاحي (مديونية قائمة ج.م)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={newSupplier.balance || ''}
                      onChange={e => setNewSupplier({ ...newSupplier, balance: Number(e.target.value) })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-rose-600 dark:text-rose-400 outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      الحد الائتماني المسموح (اختياري)
                    </label>
                    <input
                      type="number"
                      placeholder="مثال: 50000 ج.م كحد أقصى للآجل"
                      value={newSupplier.creditLimit || ''}
                      onChange={e => setNewSupplier({ ...newSupplier, creditLimit: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Tax Number & Bank Account */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      الرقم الضريبي للتفواتر
                    </label>
                    <input
                      type="text"
                      placeholder="xxx-xxx-xxx"
                      value={newSupplier.taxNumber || ''}
                      onChange={e => setNewSupplier({ ...newSupplier, taxNumber: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      الحساب البنكي أو الآيبان IBAN
                    </label>
                    <input
                      type="text"
                      placeholder="EGxx xxxx xxxx..."
                      value={newSupplier.bankAccount || ''}
                      onChange={e => setNewSupplier({ ...newSupplier, bankAccount: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    العنوان أو الموقع الجغرافي
                  </label>
                  <input
                    type="text"
                    placeholder="المدينة، المنطقة، أو عنوان المخزن الرئيسي للمورد..."
                    value={newSupplier.address || ''}
                    onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    ملاحظات اتفاقية أو شروط سداد خاصة
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: خصم تعجيل الدفع 2% خلال 7 أيام، مواعيد تسليم الخامات..."
                    value={newSupplier.notes || ''}
                    onChange={e => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setShowSupplierModal(false)}
                  className="px-6 py-3 rounded-2xl text-xs font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveSupplier}
                  className="px-8 py-3 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
                >
                  {editingSupplier ? 'حفظ التعديلات' : 'تسجيل المورد الآن'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Chronological Account Statement Modal/Drawer (كشف حساب شريك التوريد) */}
      <AnimatePresence>
        {statementSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center font-black text-lg border border-white/20">
                    {(statementSupplier.name || 'م')[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{statementSupplier.name}</h3>
                    <p className="text-xs text-indigo-300 font-bold flex items-center gap-2 mt-0.5">
                      <span>كشف حساب زمني مفصل وموقف المديونية</span>
                      {statementSupplier.phone && <span dir="ltr">({statementSupplier.phone})</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer size={15} />
                    <span>طباعة الكشف</span>
                  </button>
                  <button 
                    onClick={() => setStatementSupplier(null)}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Summary KPIs bar inside statement */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">الرصيد الافتتاحي</span>
                  <span className="text-base font-black text-slate-800 dark:text-white">0 ج.م</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">إجمالي التوريدات (مدين)</span>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400">
                    {statementEntries.reduce((s, x) => s + x.debit, 0).toLocaleString()} ج.م
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">إجمالي المرتجعات / السداد</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {statementEntries.reduce((s, x) => s + x.credit, 0).toLocaleString()} ج.م
                  </span>
                </div>
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm">
                  <span className="text-[10px] font-bold text-indigo-200 block mb-1">صافي الرصيد الحالي</span>
                  <span className="text-base font-black">
                    {(statementSupplier.balance || 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              {/* Chronological Table */}
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                {statementEntries.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-bold">
                    لا توجد فواتير أو حركات مالية مسجلة لهذا المورد حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 pb-3">
                          <th className="py-3 px-2">التاريخ</th>
                          <th className="py-3 px-2">نوع الحركة والبيان</th>
                          <th className="py-3 px-2">الرقم المرجعي</th>
                          <th className="py-3 px-2 text-rose-600 dark:text-rose-400">مدين (لنا بضاعة)</th>
                          <th className="py-3 px-2 text-emerald-600 dark:text-emerald-400">دائن (سداد/مرتجع)</th>
                          <th className="py-3 px-2 text-indigo-600 dark:text-indigo-400">الرصيد التراكمي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {statementEntries.map((entry, idx) => (
                          <tr key={entry.id + idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-2 text-slate-500 font-mono text-[11px]">
                              {new Date(entry.date).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="py-3.5 px-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold">{entry.title}</span>
                                {entry.type === 'order' && entry.paymentMethod === 'credit' && (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black leading-none ${
                                    entry.isPaid
                                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50'
                                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50'
                                  }`}>
                                    {entry.isAutoPaid ? 'تم السداد (تلقائي ⚡)' : entry.isPaid ? 'تم السداد' : 'آجل غير مسدد'}
                                  </span>
                                )}
                              </div>
                              {entry.notes && <span className="text-[10px] text-slate-400 font-normal block mt-1">{entry.notes}</span>}
                            </td>
                            <td className="py-3.5 px-2 font-mono text-slate-500 text-[11px]">
                              #{entry.reference}
                            </td>
                            <td className="py-3.5 px-2 font-black text-rose-600 dark:text-rose-400">
                              {entry.debit > 0 ? `${entry.debit.toLocaleString()} ج.م` : '-'}
                            </td>
                            <td className="py-3.5 px-2 font-black text-emerald-600 dark:text-emerald-400">
                              {entry.credit > 0 ? `${entry.credit.toLocaleString()} ج.م` : '-'}
                            </td>
                            <td className="py-3.5 px-2 font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20">
                              {entry.runningBalance.toLocaleString()} ج.م
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setStatementSupplier(null)}
                  className="px-6 py-3 rounded-2xl text-xs font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-all"
                >
                  إغلاق الكشف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
