import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Package, X, Plus, Trash2, Edit2, Percent, Coins, AlertCircle, CheckCircle2, User, Building2, Wallet, 
  CreditCard, DollarSign, ArrowRight, ArrowLeft, Check, Sparkles, Layers, ListChecks, Receipt, ShieldCheck, 
  RefreshCw, HelpCircle, Calendar, Hash, Truck, Tag, Info, Sliders, Box, Layers3, Flame, TrendingUp, Search, 
  AlertTriangle, FileText, RotateCw, CheckSquare, Square
} from 'lucide-react';

export interface SupplyOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingOrder: any | null;
  settings: any;
  selectedSupplierId: string;
  setSelectedSupplierId: (id: string) => void;
  paymentMethod: 'cash' | 'supply_wallet' | 'partner' | 'treasury' | 'credit' | 'custody';
  setPaymentMethod: (pm: any) => void;
  selectedWarehouseId: string;
  setSelectedWarehouseId: (id: string) => void;
  selectedTreasuryAccountId: string;
  setSelectedTreasuryAccountId: (id: string) => void;
  treasury: any;
  partnerPayments: Array<{ partnerId: string; amount: number }>;
  setPartnerPayments: (payments: any[]) => void;
  custodyPayments?: Array<{ cashHolderId: string; amount: number }>;
  setCustodyPayments?: (payments: any[]) => void;
  cashHolders?: any[];
  totalCost: number;
  orderReference: string;
  setOrderReference: (val: string) => void;
  orderNotes: string;
  setOrderNotes: (val: string) => void;
  shippingFees: number;
  setShippingFees: (val: number) => void;
  shippingFeesNote: string;
  setShippingFeesNote: (val: string) => void;
  shippingFeesPaymentMethod: 'with_order' | 'wallet';
  setShippingFeesPaymentMethod: (val: any) => void;
  otherFees: number;
  setOtherFees: (val: number) => void;
  otherFeesNote: string;
  setOtherFeesNote: (val: string) => void;
  taxRate: number;
  setTaxRate: (val: number) => void;
  expensePaidBy: string;
  setExpensePaidBy: (val: string) => void;
  recordExpensesFormally: boolean;
  setRecordExpensesFormally: (val: boolean) => void;
  distributeExpensesEqually: boolean;
  setDistributeExpensesEqually: (val: boolean) => void;
  costUpdateMethod: 'last_purchase' | 'weighted_average';
  setCostUpdateMethod: (val: any) => void;
  orderItems: any[];
  setOrderItems: (val: any[]) => void;
  addItemToOrder: () => void;
  itemsSubtotal: number;
  taxAmount: number;
  grandTotal: number;
  handleAddOrder: () => void;
  isSplitTreasury?: boolean;
  setIsSplitTreasury?: (val: boolean) => void;
  treasuryPayments?: Array<{ treasuryAccountId: string; amount: number }>;
  setTreasuryPayments?: (val: any[]) => void;
}

// Embedded ProductSelect Component with barcode & quick search
const ProductSelect: React.FC<{ value: string; onChange: (val: string) => void; products: any[] }> = ({ value, onChange, products }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedProduct = products.find(p => p.id === value);
  const filtered = products.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-right hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all outline-none shadow-sm group"
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex-shrink-0 overflow-hidden border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center">
          {selectedProduct?.thumbnail ? (
            <img src={selectedProduct.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Package size={16} className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
          )}
        </div>
        <div className="flex-1 text-right overflow-hidden">
          <span className="block text-slate-800 dark:text-slate-100 truncate font-extrabold text-xs">
            {selectedProduct?.name || '-- اختر منتجاً أو ابحث بالباركود --'}
          </span>
          {selectedProduct && (
            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
              التكلفة الحالية: {selectedProduct.costPrice || 0} ج.م | المخزون الحالي: {selectedProduct.stockQuantity || 0}
            </span>
          )}
        </div>
        <Plus size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-45 text-rose-500' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
            <div className="relative">
              <input 
                autoFocus
                type="text" 
                placeholder="ابحث باسم المنتج، الكود، أو الباركود..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="w-full p-2 pl-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white outline-none focus:border-indigo-500 font-semibold"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-bold">لم يتم العثور على منتجات مطابقة</div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full p-3 flex items-center justify-between hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-colors text-right cursor-pointer ${p.id === value ? 'bg-indigo-50/80 dark:bg-indigo-950/60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                      {p.thumbnail ? <img src={p.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={16} className="text-slate-400 m-2" />}
                    </div>
                    <div>
                      <span className="block text-xs font-black text-slate-800 dark:text-white">{p.name}</span>
                      <span className="block text-[10px] text-slate-400 font-bold">
                        كود: {p.sku || 'N/A'} | شراء الحبة: {p.costPrice || 0} ج.م
                      </span>
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                      رصيد: {p.stockQuantity || 0}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SupplyOrderModal: React.FC<SupplyOrderModalProps> = ({
  isOpen,
  onClose,
  editingOrder,
  settings,
  selectedSupplierId,
  setSelectedSupplierId,
  paymentMethod,
  setPaymentMethod,
  selectedWarehouseId,
  setSelectedWarehouseId,
  selectedTreasuryAccountId,
  setSelectedTreasuryAccountId,
  treasury,
  partnerPayments,
  setPartnerPayments,
  custodyPayments = [],
  setCustodyPayments = () => {},
  cashHolders = [],
  totalCost,
  orderReference,
  setOrderReference,
  orderNotes,
  setOrderNotes,
  shippingFees,
  setShippingFees,
  shippingFeesNote,
  setShippingFeesNote,
  shippingFeesPaymentMethod,
  setShippingFeesPaymentMethod,
  otherFees,
  setOtherFees,
  otherFeesNote,
  setOtherFeesNote,
  taxRate,
  setTaxRate,
  expensePaidBy,
  setExpensePaidBy,
  recordExpensesFormally,
  setRecordExpensesFormally,
  distributeExpensesEqually,
  setDistributeExpensesEqually,
  costUpdateMethod,
  setCostUpdateMethod,
  orderItems,
  setOrderItems,
  addItemToOrder,
  itemsSubtotal,
  taxAmount,
  grandTotal,
  handleAddOrder,
  isSplitTreasury = false,
  setIsSplitTreasury,
  treasuryPayments = [],
  setTreasuryPayments
}) => {
  // Mode: step-by-step (stepper) vs all-in-one
  const [viewMode, setViewMode] = useState<'stepper' | 'all-in-one'>('stepper');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Selected supplier details
  const selectedSupplier = useMemo(() => {
    return (settings?.suppliers || []).find((s: any) => s.id === selectedSupplierId);
  }, [settings?.suppliers, selectedSupplierId]);

  // Pricing Synchronizer helper for item pricing calculations
  const syncItemPricing = (item: any, field: string, val: any) => {
    let updated = { ...item };
    if (field === 'cost') updated.cost = Number(val) || 0;
    else if (field === 'profitMode') updated.profitMode = val;
    else if (field === 'sellingPrice') updated.sellingPrice = Number(val) || 0;
    else if (field === 'profitPercentage') updated.profitPercentage = Number(val) || 0;
    else if (field === 'basePrice') updated.basePrice = Number(val) || 0;
    else if (field === 'commissionPercentage') updated.commissionPercentage = Number(val) || 0;

    const mode = updated.profitMode || 'manual';
    const cost = updated.cost || 0;
    if (mode === 'margin') {
      const margin = updated.profitPercentage || 0;
      if (margin < 100 && margin >= 0) {
        updated.sellingPrice = Number((cost / (1 - (margin / 100))).toFixed(2));
      } else {
        updated.sellingPrice = cost;
      }
    } else if (mode === 'commission') {
      const comm = updated.commissionPercentage || 0;
      let base = updated.basePrice || 0;
      if (base === 0 && cost > 0 && comm < 100) {
        base = Number((cost / (1 - (comm / 100))).toFixed(2));
        updated.basePrice = base;
      }
    }
    return updated;
  };

  // Calculations for summary stats
  const totalUnitsOrdered = useMemo(() => {
    return orderItems.reduce((acc, curr) => acc + (Number(curr.orderedQuantity || curr.quantity) || 0), 0);
  }, [orderItems]);

  const totalUnitsReceived = useMemo(() => {
    return orderItems.reduce((acc, curr) => acc + (curr.receivedQuantity !== undefined ? Number(curr.receivedQuantity) : (Number(curr.quantity) || 0)), 0);
  }, [orderItems]);

  const totalBonusUnits = useMemo(() => {
    return orderItems.reduce((acc, curr) => acc + (Number(curr.bonusQuantity) || 0), 0);
  }, [orderItems]);

  const totalDamagedUnits = useMemo(() => {
    return orderItems.reduce((acc, curr) => acc + (Number(curr.damagedQuantity) || 0), 0);
  }, [orderItems]);

  const distributedPartnerTotal = useMemo(() => {
    return partnerPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [partnerPayments]);

  const distributedTreasuryTotal = useMemo(() => {
    return (treasuryPayments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [treasuryPayments]);

  const distributedCustodyTotal = useMemo(() => {
    return custodyPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [custodyPayments]);

  // Step validation helpers
  const canGoToStep2 = selectedSupplierId !== '' && selectedWarehouseId !== '';
  const canGoToStep3 = canGoToStep2 && orderItems.length > 0;
  const canGoToStep4 = canGoToStep3;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 dark:bg-black p-5 sm:p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Receipt size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {editingOrder ? 'تعديل تفاصيل أمر التوريد والشحنة' : 'تسجيل فاتورة شراء واستلام شحنة بضاعة'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  نظام التوريد الذكي
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">تؤثر هذه الفاتورة تلقائياً على رصيد المخازن وتُحدث الحسابات العامة وأرصدة الموردين فوراً.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Mode Toggle */}
            <div className="bg-slate-800/80 p-1 rounded-xl flex border border-white/5">
              <button
                type="button"
                onClick={() => setViewMode('stepper')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'stepper' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers size={13} />
                <span>مسار مخصص (4 خطوات)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all-in-one')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'all-in-one' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText size={13} />
                <span>العرض الشامل</span>
              </button>
            </div>

            <button 
              onClick={onClose} 
              className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stepper Navigation Bar (Only in Stepper Mode) */}
        {viewMode === 'stepper' && (
          <div className="bg-slate-50 dark:bg-slate-900/60 px-6 py-3.5 border-b border-slate-200/60 dark:border-slate-800/80 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex items-center justify-between min-w-[500px] max-w-4xl mx-auto">
              {[
                { id: 1, label: 'المورد وآلية السداد', icon: Building2, active: currentStep === 1, done: currentStep > 1 },
                { id: 2, label: 'السلع والكميات المستلمة', icon: Package, active: currentStep === 2, done: currentStep > 2, badge: orderItems.length },
                { id: 3, label: 'المصاريف وسياسة التكلفة', icon: Sliders, active: currentStep === 3, done: currentStep > 3 },
                { id: 4, label: 'المراجعة والاعتماد المالي', icon: ShieldCheck, active: currentStep === 4, done: currentStep > 4 }
              ].map((step, idx) => (
                <React.Fragment key={step.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (step.id === 1) setCurrentStep(1);
                      if (step.id === 2 && canGoToStep2) setCurrentStep(2);
                      if (step.id === 3 && canGoToStep3) setCurrentStep(3);
                      if (step.id === 4 && canGoToStep4) setCurrentStep(4);
                    }}
                    className={`flex items-center gap-2.5 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                      step.active 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-black' 
                        : step.done 
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-100'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                      step.active ? 'bg-white/20 text-white' : step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {step.done ? <Check size={14} /> : <step.icon size={14} />}
                    </div>
                    <span className="text-xs">{step.label}</span>
                    {step.badge !== undefined && step.badge > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${step.active ? 'bg-white text-indigo-600' : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300'}`}>
                        {step.badge}
                      </span>
                    )}
                  </button>
                  {idx < 3 && (
                    <div className="w-10 h-0.5 bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Modal Main Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-right flex-1 custom-scrollbar">
          
          {/* STEP 1: SUPPLIER AND PAYMENT SETUP */}
          {(viewMode === 'all-in-one' || (viewMode === 'stepper' && currentStep === 1)) && (
            <div className="space-y-6 animate-in slide-in-from-right-3 duration-200">
              {viewMode === 'all-in-one' && (
                <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Building2 size={18} className="text-indigo-500" />
                  <span>1. المورد المعتمد وآلية التمويل والسداد</span>
                </h4>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Supplier Selection */}
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                    <span>مورد الشحنة / الفاتورة المعتمد *</span>
                    {selectedSupplier && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-black ${
                        (selectedSupplier.balance || 0) > 0 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                      }`}>
                        {(selectedSupplier.balance || 0) > 0 ? `مديونية له: ${selectedSupplier.balance.toLocaleString()} ج.م` : 'لا توجد مديونية سابقة'}
                      </span>
                    )}
                  </label>
                  <select 
                    value={selectedSupplierId || ''} 
                    onChange={e => setSelectedSupplierId(e.target.value)} 
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-250 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs sm:text-sm dark:text-white shadow-sm"
                  >
                    <option value="">-- اختر مورد الشحنة --</option>
                    {(settings.suppliers || []).map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {(s.balance || 0) > 0 ? `(مديونية: ${s.balance.toLocaleString()} ج.م)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Warehouse Selection */}
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 block">
                    مستودع الاستلام الافتراضي (تخزين البضاعة) *
                  </label>
                  <select 
                    value={selectedWarehouseId || ''} 
                    onChange={e => setSelectedWarehouseId(e.target.value)} 
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-250 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs sm:text-sm dark:text-white shadow-sm"
                  >
                    <option value="">-- اختر مستودع الاستلام --</option>
                    {(settings.warehouses || []).map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.isDefault ? '(المستودع الرئيسي الافتراضي)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Method Selector Grid */}
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2.5 block">
                  طريقة تمويل وسداد تكلفة الفاتورة *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[
                    { id: 'cash', label: 'كاش (العامة)', icon: Wallet, color: 'indigo', desc: 'خصم مباشر من المحفظة العامة' },
                                        { id: 'partner', label: 'تمويل شركاء', icon: User, color: 'amber', desc: 'توزيع التكلفة على أرصدة الشركاء' },
                    { id: 'treasury', label: 'الخزينة البنكية', icon: Building2, color: 'blue', desc: 'سحب من حساب خزينة أو بنك' },
                    { id: 'custody', label: 'عهدة شخصية', icon: Coins, color: 'teal', desc: 'سحب من العهد وحاملي النقدية' },
                    { id: 'credit', label: 'آجل مديونية', icon: CreditCard, color: 'rose', desc: 'تسجيل كحساب دائن للمورد' }
                  ].map((pm) => {
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? `border-${pm.color}-500 bg-${pm.color}-50/60 dark:bg-${pm.color}-950/30 text-${pm.color}-600 dark:text-${pm.color}-400 ring-2 ring-${pm.color}-500/20 shadow-md font-black`
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 font-bold'
                        }`}
                      >
                        <pm.icon size={20} className={`mb-1.5 ${isSelected ? `text-${pm.color}-600 dark:text-${pm.color}-400` : 'text-slate-400'}`} />
                        <span className="text-xs">{pm.label}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{pm.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method Explanation & Specific Configurations */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-4">
                <div className="flex items-center gap-2 font-black text-indigo-600 dark:text-indigo-400">
                  <Info size={16} />
                  <span>آلية سداد الفاتورة المختارة والتأثير المحاسبي:</span>
                </div>
                <p className="font-bold text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {paymentMethod === 'cash' && 'سيتم خصم إجمالي تكلفة الفاتورة فورياً وتلقائياً من السيولة المتواجدة بالمحفظة العامة (الكاشير).'}
                  {paymentMethod === 'supply_wallet' && 'رأس مال التوريد: يخصم المبلغ بالكامل من محفظة التوريد المركزية المستقلة المخصصة لمشتريات البضائع.'}
                  {paymentMethod === 'treasury' && 'الخزينة المخصصة: سيتم الخصم المباشر من الحساب البنكي أو عهدة الخزنة المحددة بالأسفل، أو التوزيع على أكثر من حساب.'}
                  {paymentMethod === 'credit' && 'مديونية معلقة (آجل): لن يتم سحب أي سيولة حالياً، وسيتم تسجيل إجمالي التكلفة كحساب دائن للمورد (تلتزم بدفعه لاحقاً في قائمة مديونيات الموردين).'}
                  {paymentMethod === 'partner' && 'تمويل الشركاء المباشر: سيتم توزيع تكلفة الفاتورة على أرصدة الشركاء من حساباتهم الجارية بالتفصيل قبل الشراء.'}
                  {paymentMethod === 'custody' && 'سداد من العهد الشخصية (كاشير/مندوب/شريك): سيتم خصم الفاتورة من رصيد العهدة المسجل لديهم.'}
                </p>

                {/* Treasury Sub-config */}
                {paymentMethod === 'treasury' && (
                  <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-indigo-600 dark:text-indigo-400 block">
                        خصم التمويل من الخزينة:
                      </label>
                      {setIsSplitTreasury && (
                        <button
                          type="button"
                          onClick={() => setIsSplitTreasury(!isSplitTreasury)}
                          className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {isSplitTreasury ? <Square size={14} /> : <CheckSquare size={14} />}
                          <span>توزيع السداد على أكثر من خزينة/بنك</span>
                        </button>
                      )}
                    </div>

                    {!isSplitTreasury ? (
                      <select 
                        value={selectedTreasuryAccountId} 
                        onChange={e => setSelectedTreasuryAccountId(e.target.value)} 
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-700 rounded-xl outline-none dark:text-white text-xs font-bold shadow-sm"
                        required
                      >
                        <option value="">-- اختر حساب الخزينة أو البنك لسحب المال --</option>
                        {(treasury?.accounts || []).map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} (الرصيد المتاح: {acc.balance.toLocaleString()} ج.م)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center text-xs font-black text-slate-500 mb-2">
                          <span>توزيع السداد على الخزائن والحسابات</span>
                          {setTreasuryPayments && (
                            <button
                              type="button"
                              onClick={() => setTreasuryPayments([...treasuryPayments, { treasuryAccountId: '', amount: 0 }])}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-black"
                            >
                              <Plus size={12} /> إضافة خزينة ثانية
                            </button>
                          )}
                        </div>
                        {treasuryPayments.map((tp, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select
                              value={tp.treasuryAccountId}
                              onChange={e => {
                                if (setTreasuryPayments) {
                                  const newTps = [...treasuryPayments];
                                  newTps[idx].treasuryAccountId = e.target.value;
                                  setTreasuryPayments(newTps);
                                }
                              }}
                              className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none"
                            >
                              <option value="">اختر حساب الخزينة...</option>
                              {(treasury?.accounts || []).map((acc: any) => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={tp.amount || ''}
                              onChange={e => {
                                if (setTreasuryPayments) {
                                  const newTps = [...treasuryPayments];
                                  newTps[idx].amount = Number(e.target.value);
                                  setTreasuryPayments(newTps);
                                }
                              }}
                              placeholder="المبلغ ج.م"
                              className="w-32 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center dark:text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setTreasuryPayments && setTreasuryPayments(treasuryPayments.filter((_, i) => i !== idx))}
                              className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Partner Funding Sub-config */}
                {paymentMethod === 'custody' && (
                  <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                        <Coins size={16} />
                        <span>توزيع السداد على العهد الشخصية (كاشير / شريك):</span>
                      </label>
                      <button 
                        type="button"
                        onClick={() => {
                           const remaining = Math.max(0, totalCost - distributedCustodyTotal);
                           setCustodyPayments([...custodyPayments, { cashHolderId: '', amount: remaining }]);
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 dark:text-teal-400 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 px-2 py-1 rounded transition-colors"
                      >
                        <Plus size={12} />
                        <span>إضافة عهدة</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {custodyPayments.map((cp, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={cp.cashHolderId}
                            onChange={(e) => {
                                const newP = [...custodyPayments];
                                newP[idx].cashHolderId = e.target.value;
                                setCustodyPayments(newP);
                            }}
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="">-- اختر صاحب العهدة --</option>
                            {(cashHolders || []).map(h => (
                                <option key={h.userId} value={h.userId}>{h.userName} (العهدة الحالية: {h.currentBalance} ج.م)</option>
                            ))}
                          </select>
                          <div className="relative w-28">
                             <input
                                type="number"
                                min="0"
                                step="any"
                                value={cp.amount || ''}
                                onChange={(e) => {
                                    const newP = [...custodyPayments];
                                    newP[idx].amount = parseFloat(e.target.value) || 0;
                                    setCustodyPayments(newP);
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pr-7 pl-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                             />
                             <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">ج.م</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setCustodyPayments(custodyPayments.filter((_, i) => i !== idx))}
                            className="text-rose-400 hover:text-rose-600 p-1.5"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      
                      {custodyPayments.length === 0 && (
                          <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                             <p className="text-[11px] text-slate-500 font-medium">لم يتم تحديد عهد شخصية. سيتم طلب الفاتورة بالكامل من محفظة التوريد إذا لم تحدد.</p>
                          </div>
                      )}
                    </div>
                    
                    {custodyPayments.length > 0 && (
                        <div className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-bold ${
                            distributedCustodyTotal === totalCost 
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
                        }`}>
                            <span>إجمالي الموزع على العهد:</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{distributedCustodyTotal.toLocaleString()} ج.م</span>
                                {distributedCustodyTotal !== totalCost && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-white/50 dark:bg-black/20 rounded">
                                        المتبقي: {(totalCost - distributedCustodyTotal).toLocaleString()} ج.م
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'partner' && (
                  <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <User size={16} />
                        <span>توزيع حصص تمويل ودفع الفاتورة على الشركاء:</span>
                      </label>
                      <button 
                        type="button"
                        onClick={() => setPartnerPayments([...partnerPayments, { partnerId: '', amount: 0 }])}
                        className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg"
                      >
                        <Plus size={14}/> إضافة شريك ثانٍ للتمويل
                      </button>
                    </div>

                    {partnerPayments.map((payment, pidx) => (
                      <div key={pidx} className="flex gap-2.5 items-center">
                        <div className="flex-1">
                          <select 
                            value={payment.partnerId} 
                            onChange={e => {
                              const newPayments = [...partnerPayments];
                              newPayments[pidx].partnerId = e.target.value;
                              setPartnerPayments(newPayments);
                            }}
                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white font-extrabold shadow-sm"
                          >
                            <option value="">-- اختر اسم الشريك الممول --</option>
                            {settings.partners?.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (رصيده الجاري: {p.balance?.toLocaleString() || 0} ج.م)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32 sm:w-40 relative">
                          <input 
                            type="number" 
                            value={payment.amount || ''}
                            onChange={e => {
                              const newPayments = [...partnerPayments];
                              newPayments[pidx].amount = Number(e.target.value);
                              setPartnerPayments(newPayments);
                            }}
                            placeholder="المبلغ ج.م"
                            className="w-full p-2.5 pl-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-center font-black outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white shadow-sm"
                          />
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">ج.م</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setPartnerPayments(partnerPayments.filter((_, i) => i !== pidx))}
                          className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all cursor-pointer"
                          title="حذف الشريك"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}

                    {/* Progress & Distribution status bar */}
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        {(() => {
                          const remains = totalCost - distributedPartnerTotal;
                          const isComplete = Math.abs(remains) < 0.01 && totalCost > 0;
                          return (
                            <div className="flex items-center gap-2 font-extrabold text-xs">
                              <span className="text-slate-500">إجمالي المطلوب: <span className="font-mono font-black text-slate-800 dark:text-white">{totalCost.toLocaleString()} ج.م</span></span>
                              <span className="text-slate-300">|</span>
                              <span className="text-indigo-600 dark:text-indigo-400">الموزع: <span className="font-mono font-black">{distributedPartnerTotal.toLocaleString()} ج.م</span></span>
                              <span className="text-slate-300">|</span>
                              <span className={`font-black ${isComplete ? 'text-emerald-500' : 'text-rose-500'}`}>
                                المتبقي: {remains.toLocaleString()} ج.م
                              </span>
                            </div>
                          );
                        })()}

                        <div className="flex gap-2 flex-wrap">
                          {distributedPartnerTotal < totalCost && partnerPayments.length > 0 && (
                            <button 
                              type="button"
                              onClick={() => {
                                const remaining = totalCost - distributedPartnerTotal;
                                const newPayments = [...partnerPayments];
                                const emptyIdx = newPayments.findIndex(p => p.amount === 0);
                                if (emptyIdx > -1) {
                                  newPayments[emptyIdx].amount += remaining;
                                } else {
                                  newPayments[newPayments.length - 1].amount += remaining;
                                }
                                setPartnerPayments(newPayments);
                              }}
                              className="text-[11px] font-black bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                            >
                              تغطية المتبقي بالكامل ({(totalCost - distributedPartnerTotal).toLocaleString()})
                            </button>
                          )}
                          {partnerPayments.length > 1 && (
                            <button 
                              type="button"
                              onClick={() => {
                                const equalShare = Number((totalCost / partnerPayments.length).toFixed(2));
                                const newPayments = partnerPayments.map((p, i) => ({
                                  ...p,
                                  amount: i === partnerPayments.length - 1 
                                    ? Number((totalCost - (equalShare * (partnerPayments.length - 1))).toFixed(2))
                                    : equalShare
                                }));
                                setPartnerPayments(newPayments);
                              }}
                              className="text-[11px] font-black bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                            >
                              توزيع بالتساوي
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      {totalCost > 0 && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${Math.abs(totalCost - distributedPartnerTotal) < 0.01 ? 'bg-emerald-500' : distributedPartnerTotal > totalCost ? 'bg-rose-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, (distributedPartnerTotal / (totalCost || 1)) * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Reference Number and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Hash size={14} className="text-indigo-500" />
                    <span>رقم مرجع فاتورة الشراء (ID أو رقم فاتورة المورد)</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="مثال: Inv-9952 أو رقم إيصال المورد" 
                    value={orderReference || ''} 
                    onChange={e => setOrderReference(e.target.value)} 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs dark:text-white shadow-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <FileText size={14} className="text-indigo-500" />
                    <span>بيان أو ملاحظات الفاتورة والشحنة</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="أمثلة: بضاعة صيفية، عروض موسمية، استلام عبر شركة شحن..." 
                    value={orderNotes || ''} 
                    onChange={e => setOrderNotes(e.target.value)} 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs dark:text-white shadow-sm" 
                  />
                </div>
              </div>

              {viewMode === 'stepper' && (
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={!canGoToStep2}
                    onClick={() => setCurrentStep(2)}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <span>الخطوة التالية: إدراج السلع والكميات</span>
                    <ArrowLeft size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PRODUCTS AND SHIPMENT RECEPTION */}
          {(viewMode === 'all-in-one' || (viewMode === 'stepper' && currentStep === 2)) && (
            <div className="space-y-6 animate-in slide-in-from-right-3 duration-200">
              {viewMode === 'all-in-one' && (
                <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Package size={18} className="text-indigo-500" />
                  <span>2. السلع المستوردة لإدخالها في مخازن الفروع واستلام الشحنة</span>
                </h4>
              )}

              {/* Items Summary Statistics Header */}
              <div className="bg-indigo-950/10 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-500/20 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black">
                    <ListChecks size={20} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-indigo-900 dark:text-indigo-200">قائمة أصناف الفاتورة واستلام الشحنة</h5>
                    <p className="text-[10px] text-indigo-600/80 dark:text-indigo-300/80">قم بإضافة الأصناف المشتراة وتدقيق الكميات المستلمة فعلياً في المخزن</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-center font-mono font-black text-xs">
                  <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                    <span className="text-[9px] text-slate-400 block font-sans">عدد الأصناف</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{orderItems.length}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                    <span className="text-[9px] text-slate-400 block font-sans">الوحدات المطلوبة</span>
                    <span className="text-slate-800 dark:text-slate-200">{totalUnitsOrdered}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[9px] text-emerald-600 block font-sans">المستلمة فعلياً</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{totalUnitsReceived}</span>
                  </div>
                  {totalBonusUnits > 0 && (
                    <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-900/40">
                      <span className="text-[9px] text-amber-600 block font-sans">بونص مجاني</span>
                      <span className="text-amber-600 dark:text-amber-400">+{totalBonusUnits}</span>
                    </div>
                  )}
                  {totalDamagedUnits > 0 && (
                    <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/40">
                      <span className="text-[9px] text-rose-600 block font-sans">تالف/مرفوض</span>
                      <span className="text-rose-600 dark:text-rose-400">{totalDamagedUnits}</span>
                    </div>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={addItemToOrder} 
                  className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-black transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <Plus size={16}/>
                  <span>إدراج صنف جديد</span>
                </button>
              </div>

              {/* Order Items List */}
              <div className="space-y-5">
                {orderItems.length === 0 ? (
                  <div className="bg-slate-50/50 dark:bg-slate-800/20 p-12 rounded-3xl text-center border-2 border-dashed border-slate-200 dark:border-slate-700/80 space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                      <Package size={32} />
                    </div>
                    <h5 className="text-sm font-black text-slate-700 dark:text-slate-200">لم يتم إدراج أي سلع في هذه الفاتورة بعد</h5>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">انقر على الزر بالأسفل لإدراج أول منتج أو اختيار السلع المستوردة لتسجيل التكلفة والكميات</p>
                    <button 
                      type="button"
                      onClick={addItemToOrder} 
                      className="text-xs font-black bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-6 py-3 rounded-xl inline-flex items-center gap-2 cursor-pointer transition-all mt-2"
                    >
                      <Plus size={16}/>
                      <span>إدراج أول منتج للتوريد</span>
                    </button>
                  </div>
                ) : (
                  orderItems.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`p-5 rounded-3xl border transition-all duration-200 space-y-4 shadow-sm ${
                        item.isReturn 
                          ? 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40' 
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-indigo-200'
                      }`}
                    >
                      {/* Top Row: Product Select & Return Checkbox */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center border-b border-slate-100 dark:border-slate-700/60 pb-4">
                        <div className="lg:col-span-8">
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-mono text-[10px] font-black">
                                #{idx + 1}
                              </span>
                              <span>تحديد الموديل / المنتج المطلوب من الكتالوج</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer select-none bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200/50 dark:border-rose-900/30">
                              <input 
                                type="checkbox" 
                                checked={item.isReturn || false} 
                                onChange={e => {
                                  const newItems = [...orderItems];
                                  newItems[idx].isReturn = e.target.checked;
                                  setOrderItems(newItems);
                                }} 
                                className="accent-rose-500 rounded cursor-pointer size-3.5"
                              />
                              <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                <RotateCw size={12} />
                                <span>إرجاع للمورد (مخصوم من الفاتورة والمخزون)</span>
                              </span>
                            </label>
                          </div>

                          <ProductSelect 
                            value={item.productId || ''} 
                            onChange={val => {
                              const newItems = [...orderItems];
                              const product = settings.products.find((p: any) => p.id === val);
                              if (product) {
                                let updatedItem = {
                                  ...newItems[idx],
                                  productId: val,
                                  name: product.name,
                                  cost: product.costPrice || 0,
                                  profitMode: product.profitMode || 'manual',
                                  profitPercentage: product.profitPercentage || 0,
                                  basePrice: product.basePrice || 0,
                                  commissionPercentage: product.commissionPercentage || 0,
                                  sellingPrice: product.price || 0
                                };
                                if (updatedItem.profitMode === 'commission' && (!updatedItem.basePrice || updatedItem.basePrice === 0)) {
                                  const comm = updatedItem.commissionPercentage || 0;
                                  if (comm < 100) {
                                    updatedItem.basePrice = updatedItem.cost / (1 - (comm / 100));
                                    updatedItem.sellingPrice = updatedItem.basePrice;
                                  }
                                }
                                newItems[idx] = updatedItem;
                              }
                              setOrderItems(newItems);
                            }} 
                            products={settings.products}
                          />

                          {/* If Return item, show warehouse selector and max returnable stock */}
                          {item.isReturn && item.productId && (
                            <div className="mt-2 p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200/60 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-rose-700 dark:text-rose-300">سحب المرتجع من مخزن مستقل:</span>
                                <select
                                  value={item.warehouseId || selectedWarehouseId || ''}
                                  onChange={e => {
                                    const newItems = [...orderItems];
                                    newItems[idx].warehouseId = e.target.value;
                                    setOrderItems(newItems);
                                  }}
                                  className="p-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold outline-none"
                                >
                                  {settings.warehouses?.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </div>
                              {(() => {
                                let maxQty = 0;
                                const targetWarehouse = item.warehouseId || selectedWarehouseId;
                                const prod = settings.products.find((p: any) => p.id === item.productId);
                                if (prod) {
                                  if (item.variantId && prod.variants) {
                                    const v = prod.variants.find((vx: any) => vx.id === item.variantId);
                                    maxQty = v?.warehouseStock?.[targetWarehouse] || 0;
                                  } else {
                                    maxQty = prod.warehouseStock?.[targetWarehouse] || 0;
                                  }
                                }
                                const whName = settings.warehouses?.find((w: any) => w.id === targetWarehouse)?.name || 'المستودع المحدد';
                                return (
                                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                                    رصيد {whName} القابل للارتجاع: {maxQty} قطعة
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* Quick Delete Item Button */}
                        <div className="lg:col-span-4 flex justify-end">
                          <button 
                            type="button"
                            onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))} 
                            className="px-4 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            title="حذف هذا الصنف من الفاتورة"
                          >
                            <Trash2 size={16}/>
                            <span>حذف من الفاتورة</span>
                          </button>
                        </div>
                      </div>

                      {/* Middle Row: Quantities Grid & Shipment Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 mb-1 block text-center">الكمية المطلوبة بالمستند</label>
                          <input 
                            type="number" 
                            min="1" 
                            value={item.orderedQuantity !== undefined ? item.orderedQuantity : (item.quantity || '')} 
                            onChange={e => {
                              const newItems = [...orderItems];
                              const val = Number(e.target.value);
                              newItems[idx].orderedQuantity = val;
                              newItems[idx].quantity = val;
                              newItems[idx].receivedQuantity = val;
                              setOrderItems(newItems);
                            }} 
                            className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white text-center font-black outline-none shadow-sm focus:border-indigo-500" 
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 mb-1 block text-center">الكمية المستلمة فعلياً بالمخزن</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={item.receivedQuantity !== undefined ? item.receivedQuantity : (item.quantity || 0)} 
                            onChange={e => {
                              const newItems = [...orderItems];
                              newItems[idx].receivedQuantity = Number(e.target.value);
                              setOrderItems(newItems);
                            }} 
                            className="w-full p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs dark:text-emerald-300 text-emerald-700 text-center font-black outline-none shadow-sm focus:border-emerald-500" 
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-extrabold text-rose-500 mb-1 block text-center">تالف / مرفوض أثناء الفرز</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={item.damagedQuantity || ''} 
                            onChange={e => {
                              const newItems = [...orderItems];
                              newItems[idx].damagedQuantity = Number(e.target.value);
                              setOrderItems(newItems);
                            }} 
                            className="w-full p-2.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl text-xs dark:text-rose-300 text-rose-600 text-center font-black outline-none shadow-sm focus:border-rose-500" 
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 mb-1 block text-center">بونص مجاني (يقلل متوسط التكلفة)</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={item.bonusQuantity || ''} 
                            onChange={e => {
                              const newItems = [...orderItems];
                              newItems[idx].bonusQuantity = Number(e.target.value);
                              setOrderItems(newItems);
                            }} 
                            className="w-full p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs dark:text-amber-300 text-amber-700 text-center font-black outline-none shadow-sm focus:border-amber-500" 
                          />
                        </div>
                      </div>

                      {/* Expiry and Batch Drawer */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                          <Calendar size={16} className="text-indigo-500 shrink-0" />
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">تاريخ انتهاء الصلاحية (Expiry):</label>
                          <input 
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={e => {
                              const newItems = [...orderItems];
                              newItems[idx].expiryDate = e.target.value;
                              setOrderItems(newItems);
                            }}
                            className="flex-1 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-center font-bold outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                          <Hash size={16} className="text-indigo-500 shrink-0" />
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">رقم دفعة الشحنة (Batch No):</label>
                          <input 
                            type="text"
                            placeholder="مثال: BAT-2026-07"
                            value={item.batchNumber || ''}
                            onChange={e => {
                              const newItems = [...orderItems];
                              newItems[idx].batchNumber = e.target.value;
                              setOrderItems(newItems);
                            }}
                            className="flex-1 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-center font-bold outline-none"
                          />
                        </div>
                      </div>

                      {/* Pricing, Discounts, and Landed Cost Engine */}
                      {item.productId && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs font-black text-slate-600 dark:text-slate-300 mb-1 block">تكلفة شراء الحبة بالمستند</label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  min="0" 
                                  value={item.cost || ''} 
                                  onChange={e => {
                                    const newItems = [...orderItems];
                                    newItems[idx] = syncItemPricing(newItems[idx], 'cost', e.target.value);
                                    setOrderItems(newItems);
                                  }} 
                                  className="w-full p-2.5 pl-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-black outline-none shadow-sm" 
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">ج.م</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-black text-slate-600 dark:text-slate-300 mb-1 block">الخصم الإضافي من المورد</label>
                              <div className="flex gap-1.5">
                                <input 
                                  type="number" 
                                  min="0" 
                                  value={item.discountValue || ''} 
                                  onChange={e => {
                                    const newItems = [...orderItems];
                                    newItems[idx].discountValue = Number(e.target.value);
                                    setOrderItems(newItems);
                                  }} 
                                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-bold outline-none shadow-sm" 
                                />
                                <select 
                                  value={item.discountType || 'amount'} 
                                  onChange={e => {
                                    const newItems = [...orderItems];
                                    newItems[idx].discountType = e.target.value as 'amount' | 'percentage';
                                    setOrderItems(newItems);
                                  }} 
                                  className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white outline-none font-black"
                                >
                                  <option value="amount">ج.م</option>
                                  <option value="percentage">%</option>
                                </select>
                              </div>
                            </div>

                            {/* Selling Price Method Selector */}
                            {!item.isReturn && (
                              <div>
                                <label className="text-xs font-black text-slate-600 dark:text-slate-300 mb-1 block">نظام احتساب سعر البيع والربح</label>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...orderItems];
                                      newItems[idx] = syncItemPricing(newItems[idx], 'profitMode', 'manual');
                                      setOrderItems(newItems);
                                    }}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                      (item.profitMode || 'manual') === 'manual' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'
                                    }`}
                                  >
                                    يدوي
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...orderItems];
                                      newItems[idx] = syncItemPricing(newItems[idx], 'profitMode', 'margin');
                                      setOrderItems(newItems);
                                    }}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                      item.profitMode === 'margin' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'
                                    }`}
                                  >
                                    هامش %
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...orderItems];
                                      newItems[idx] = syncItemPricing(newItems[idx], 'profitMode', 'commission');
                                      setOrderItems(newItems);
                                    }}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                      item.profitMode === 'commission' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'
                                    }`}
                                  >
                                    عمولة %
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Dynamic Pricing Config Inputs (if Margin or Commission) */}
                          {!item.isReturn && (
                            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">سعر البيع المقترح بالمتجر:</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.sellingPrice || ''}
                                      onChange={e => {
                                        const newItems = [...orderItems];
                                        newItems[idx] = syncItemPricing(newItems[idx], 'sellingPrice', e.target.value);
                                        setOrderItems(newItems);
                                      }}
                                      className="w-28 p-2 pl-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center outline-none"
                                      placeholder="سعر البيع"
                                    />
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">ج.م</span>
                                  </div>
                                </div>

                                {item.profitMode === 'margin' && (
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">نسبة هامش الربح %:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={item.profitPercentage || ''}
                                      onChange={e => {
                                        const newItems = [...orderItems];
                                        newItems[idx] = syncItemPricing(newItems[idx], 'profitPercentage', e.target.value);
                                        setOrderItems(newItems);
                                      }}
                                      className="w-20 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center outline-none"
                                      placeholder="20%"
                                    />
                                  </div>
                                )}

                                {item.profitMode === 'commission' && (
                                  <div className="flex gap-3 items-center flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300">سعر البيع الأساسي:</label>
                                      <input
                                        type="number"
                                        value={item.basePrice || ''}
                                        onChange={e => {
                                          const newItems = [...orderItems];
                                          newItems[idx] = syncItemPricing(newItems[idx], 'basePrice', e.target.value);
                                          setOrderItems(newItems);
                                        }}
                                        className="w-24 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center outline-none"
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300">العمولة %:</label>
                                      <input
                                        type="number"
                                        value={item.commissionPercentage || ''}
                                        onChange={e => {
                                          const newItems = [...orderItems];
                                          newItems[idx] = syncItemPricing(newItems[idx], 'commissionPercentage', e.target.value);
                                          setOrderItems(newItems);
                                        }}
                                        className="w-20 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center outline-none"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Update Catalog Checkbox */}
                              <label className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 cursor-pointer select-none">
                                <input 
                                  type="checkbox"
                                  checked={item.updateCatalogPrice !== false}
                                  onChange={e => {
                                    const newItems = [...orderItems];
                                    newItems[idx].updateCatalogPrice = e.target.checked;
                                    setOrderItems(newItems);
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                                />
                                <span>تحديث السعر وتكلفة الكتالوج العام عند الاعتماد</span>
                              </label>
                            </div>
                          )}

                          {/* Live Landed Cost Summary Banner */}
                          {(() => {
                            const itemLiveCost = Number(item.cost || 0);
                            const itemLiveQty = Number(item.orderedQuantity || item.quantity || 0);
                            const itemLiveDiscount = Number(item.discountValue || 0);
                            const itemLiveBonus = Number(item.bonusQuantity || 0);
                            const itemLiveReceived = Number(item.receivedQuantity !== undefined ? item.receivedQuantity : itemLiveQty);
                            const itemLiveTotalUnits = itemLiveReceived + itemLiveBonus;

                            const itemGrossSubtotal = itemLiveCost * itemLiveQty;
                            let itemNetSubtotal = itemGrossSubtotal;
                            if (itemLiveDiscount > 0) {
                              if (item.discountType === 'percentage') {
                                itemNetSubtotal -= itemGrossSubtotal * (itemLiveDiscount / 100);
                              } else {
                                itemNetSubtotal -= itemLiveDiscount * itemLiveQty;
                              }
                            }
                            const itemNetUnitCost = itemLiveQty > 0 ? (itemNetSubtotal / itemLiveQty) : itemLiveCost;

                            const currentItemsSubtotal = itemsSubtotal || 0;
                            const currentGrandTotal = grandTotal || 0;
                            const liveFeesFactor = currentItemsSubtotal > 0 ? (currentGrandTotal / currentItemsSubtotal) : 1;

                            const itemLiveLandedCost = itemLiveTotalUnits > 0 
                              ? (itemNetSubtotal * liveFeesFactor / itemLiveTotalUnits) 
                              : (itemLiveCost * liveFeesFactor);

                            const itemProfitMode = item.profitMode || 'manual';
                            let itemCalculatedSellingPrice = Number(item.sellingPrice || 0);
                            
                            if ((!item.sellingPrice || item.sellingPrice === 0) && itemProfitMode === 'manual') {
                              itemCalculatedSellingPrice = Number(item.cost || 0);
                            } else if ((!item.sellingPrice || item.sellingPrice === 0) && itemProfitMode === 'margin') {
                              const margin = Number(item.profitPercentage || 0);
                              if (margin < 100 && margin >= 0) {
                                itemCalculatedSellingPrice = itemLiveLandedCost / (1 - (margin / 100));
                              } else {
                                itemCalculatedSellingPrice = itemLiveLandedCost;
                              }
                            } else if ((!item.sellingPrice || item.sellingPrice === 0) && itemProfitMode === 'commission') {
                              itemCalculatedSellingPrice = Number(item.basePrice || 0);
                            }

                            if (item.isReturn) {
                              return (
                                <div className="bg-rose-100/50 dark:bg-rose-950/20 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/30 flex justify-between items-center text-xs font-mono">
                                  <span className="text-rose-700 dark:text-rose-300 font-extrabold flex items-center gap-1.5 font-sans">
                                    <RotateCw size={14} className="animate-spin-slow" />
                                    <span>إجمالي قيمة المرتجع المخصومة من الفاتورة:</span>
                                  </span>
                                  <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                                    {(itemLiveCost * itemLiveQty).toLocaleString()} ج.م
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 grid grid-cols-2 sm:grid-cols-4 gap-4 text-right">
                                <div>
                                  <span className="text-slate-400 text-[10px] block font-bold mb-0.5">شراء الحبة الأساسي</span>
                                  <span className="font-mono font-black text-slate-800 dark:text-white text-xs">{itemLiveCost.toFixed(2)} ج.م</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-[10px] block font-bold mb-0.5">الشراء الصافي (بعد الخصم)</span>
                                  <span className="font-mono font-black text-slate-800 dark:text-white text-xs">
                                    {itemNetUnitCost.toFixed(2)} ج.م
                                    {itemLiveDiscount > 0 && <span className="text-[10px] text-emerald-600 block font-sans">(-{itemLiveDiscount}{item.discountType === 'percentage' ? '%' : ' ج.م'})</span>}
                                  </span>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40">
                                  <span className="text-indigo-600 dark:text-indigo-400 text-[10px] block font-black mb-0.5">التكلفة المحملة (Landed Cost)</span>
                                  <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 text-xs">
                                    {itemLiveLandedCost.toFixed(2)} ج.م
                                    {itemLiveBonus > 0 && <span className="text-[9px] text-emerald-500 block font-sans">مخفضة بـ {itemLiveBonus} بونص مجاني</span>}
                                  </span>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200/50 dark:border-amber-800/40">
                                  <span className="text-amber-600 dark:text-amber-400 text-[10px] block font-black mb-0.5">سعر البيع النهائي بالمتجر</span>
                                  <span className="font-mono font-black text-amber-700 dark:text-amber-300 text-xs">
                                    {itemCalculatedSellingPrice.toFixed(2)} ج.م
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {viewMode === 'stepper' && (
                <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowRight size={16} />
                    <span>السابق: المورد والسداد</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canGoToStep3}
                    onClick={() => setCurrentStep(3)}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <span>الخطوة التالية: المصاريف وسياسة التكلفة</span>
                    <ArrowLeft size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: EXPENSES AND SAAS COSTING ENGINE */}
          {(viewMode === 'all-in-one' || (viewMode === 'stepper' && currentStep === 3)) && (
            <div className="space-y-6 animate-in slide-in-from-right-3 duration-200">
              {viewMode === 'all-in-one' && (
                <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Sliders size={18} className="text-indigo-500" />
                  <span>3. المصاريف الإضافية للشحنة ونظام تسعير تكلفة المخزون</span>
                </h4>
              )}

              {/* Shipping, Other Fees, and Taxes Grid */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {/* Shipping Fees */}
                  <div>
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Truck size={14} className="text-indigo-500" />
                      <span>مصاريف الشحن / النقل</span>
                    </label>
                    <div className="space-y-2">
                      <div className="relative">
                        <input 
                          type="number" 
                          min="0"
                          value={shippingFees || ''} 
                          onChange={e => setShippingFees(Number(e.target.value))} 
                          className="w-full p-3 pl-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-extrabold text-xs dark:text-white shadow-sm" 
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">ج.م</span>
                      </div>
                      <input 
                        type="text"
                        placeholder="وصف مصروف الشحن (مثال: نقل، عمالة تفريغ...)"
                        value={shippingFeesNote || ''}
                        onChange={e => setShippingFeesNote(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs dark:text-white font-semibold shadow-sm"
                      />
                      {shippingFees > 0 && (
                        <div className="flex bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl mt-2">
                          <button 
                            type="button"
                            onClick={() => setShippingFeesPaymentMethod('with_order')}
                            className={`flex-1 text-xs py-1.5 rounded-lg transition font-black cursor-pointer ${shippingFeesPaymentMethod === 'with_order' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                          >
                            دفع مع الفاتورة
                          </button>
                          <button 
                            type="button"
                            onClick={() => setShippingFeesPaymentMethod('wallet')}
                            className={`flex-1 text-xs py-1.5 rounded-lg transition font-black cursor-pointer ${shippingFeesPaymentMethod === 'wallet' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                          >
                            سحب من محفظة المتجر
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Other Fees */}
                  <div>
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <DollarSign size={14} className="text-amber-500" />
                      <span>مصاريف أخرى / إضافية</span>
                    </label>
                    <div className="space-y-2">
                      <div className="relative">
                        <input 
                          type="number" 
                          min="0"
                          value={otherFees || ''} 
                          onChange={e => setOtherFees(Number(e.target.value))} 
                          className="w-full p-3 pl-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-extrabold text-xs dark:text-white shadow-sm" 
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">ج.م</span>
                      </div>
                      <input 
                        type="text"
                        placeholder="وصف المصاريف الإضافية (مثال: تأمين، جمارك...)"
                        value={otherFeesNote || ''}
                        onChange={e => setOtherFeesNote(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs dark:text-white font-semibold shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Tax Rate % */}
                  <div>
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Percent size={14} className="text-emerald-500" />
                      <span>نسبة ضريبة القيمة المضافة %</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0" 
                        max="100"
                        value={taxRate || ''} 
                        onChange={e => setTaxRate(Number(e.target.value))} 
                        className="w-full p-3 pl-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-extrabold text-xs dark:text-white shadow-sm" 
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                    </div>
                    {taxRate > 0 && (
                      <div className="mt-2 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                        قيمة الضريبة المحتسبة: {taxAmount.toLocaleString()} ج.م
                      </div>
                    )}
                  </div>
                </div>

                {/* Expense Paid By input */}
                {(shippingFees > 0 || otherFees > 0) && (
                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-3.5">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block flex items-center justify-between">
                      <span>مصدر دفع المصروفات الإضافية / الشحن (المحفظة، الخزائن، العهد أو الشركاء):</span>
                      <span className="text-[10px] text-indigo-500 font-bold">يحدد جهة الصرف في سجل المصروفات</span>
                    </label>
                    <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      {/* Basic Wallet & Partners */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500">السيولة الأساسية والشركاء:</div>
                        <div className="flex flex-wrap gap-2">
                          <button 
                            type="button"
                            onClick={() => setExpensePaidBy('المحفظة العامة')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${expensePaidBy === 'المحفظة العامة' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}`}
                          >
                            💳 دفع من المحفظة العامة
                          </button>
                          {settings.partners?.map((p: any) => (
                            <button 
                              key={p.id}
                              type="button"
                              onClick={() => {
                                if (!expensePaidBy || expensePaidBy === 'المحفظة العامة') {
                                  setExpensePaidBy(p.name);
                                } else if (!expensePaidBy.includes(p.name)) {
                                  setExpensePaidBy(`${expensePaidBy} و ${p.name}`);
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
                            >
                              👤 + شريك: {p.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Treasury Accounts */}
                      {(treasury?.accounts || []).length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500">الحسابات والخزائن البنكية:</div>
                          <div className="flex flex-wrap gap-2">
                            {treasury.accounts.map((acc: any) => (
                              <button 
                                key={acc.id}
                                type="button"
                                onClick={() => {
                                  if (!expensePaidBy || expensePaidBy === 'المحفظة العامة') {
                                    setExpensePaidBy(acc.name);
                                  } else if (!expensePaidBy.includes(acc.name)) {
                                    setExpensePaidBy(`${expensePaidBy} و ${acc.name}`);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition cursor-pointer"
                              >
                                🏦 + خزينة: {acc.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cash Holders (Custodies) */}
                      {(cashHolders || []).length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500">العهد النقدية طرف الموظفين/الشركاء:</div>
                          <div className="flex flex-wrap gap-2">
                            {(cashHolders || []).map((h: any) => (
                              <button 
                                key={h.userId}
                                type="button"
                                onClick={() => {
                                  if (!expensePaidBy || expensePaidBy === 'المحفظة العامة') {
                                    setExpensePaidBy(h.userName);
                                  } else if (!expensePaidBy.includes(h.userName)) {
                                    setExpensePaidBy(`${expensePaidBy} و ${h.userName}`);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition cursor-pointer"
                              >
                                💼 + عهدة: {h.userName}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <input 
                        type="text"
                        list="partnersListModal"
                        placeholder="اختر من الأزرار بالأعلى أو اكتب التفاصيل (مثال: 300 دفعهم زهره شريك و 300 دفعهم البص شريك)..."
                        value={expensePaidBy || ''}
                        onChange={e => setExpensePaidBy(e.target.value)}
                        className="w-full p-3 pl-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs dark:text-white font-extrabold shadow-sm"
                      />
                      <datalist id="partnersListModal">
                        <option value="المحفظة العامة" />
                        {settings.partners?.map((p: any) => (
                          <option key={p.id} value={p.name} />
                        ))}
                        {(treasury?.accounts || []).map((acc: any) => (
                          <option key={acc.id} value={acc.name} />
                        ))}
                        {(cashHolders || []).map((h: any) => (
                          <option key={h.userId} value={h.userName} />
                        ))}
                      </datalist>
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    </div>
                  </div>
                )}

                {/* Expenses Accounting Toggles */}
                {(shippingFees > 0 || otherFees > 0) && (
                  <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center gap-2.5 cursor-pointer bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex-1">
                      <input 
                        type="checkbox" 
                        checked={recordExpensesFormally} 
                        onChange={e => setRecordExpensesFormally(e.target.checked)} 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        إدراج كمصروفات منفصلة في دفتر المصروفات (تظهر في تقارير المصروفات والأرباح)
                      </span>
                    </label>
                    
                    <label className="flex items-center gap-2.5 cursor-pointer bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex-1">
                      <input 
                        type="checkbox" 
                        checked={distributeExpensesEqually} 
                        onChange={e => setDistributeExpensesEqually(e.target.checked)} 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        توزيع هذه المصاريف بالتساوي على تكلفة المنتجات (Landed Cost) بدلاً من التوزيع النسبي حسب القيمة
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* SaaS Cost Pricing Engine Selection */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 p-5 sm:p-6 rounded-3xl border border-indigo-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-800 dark:text-white">نظام تسعير تكلفة المخزون المركزي (SaaS Cost System)</h5>
                    <p className="text-xs text-slate-500">حدد كيف تؤثر أسعار الشراء الحالية لهذه الفاتورة على تكلفة المنتجات في كتالوج السلع والتقارير المالية</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setCostUpdateMethod('last_purchase')}
                    className={`flex flex-col items-start p-4 rounded-2xl border text-right transition-all duration-200 cursor-pointer ${
                      costUpdateMethod === 'last_purchase'
                        ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/30 shadow-lg'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-xs font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <span className={`w-3 h-3 rounded-full ${costUpdateMethod === 'last_purchase' ? 'bg-indigo-600 ring-4 ring-indigo-500/20' : 'bg-slate-300 dark:bg-slate-700'}`} />
                        سعر آخر شراء (مباشر - Last Purchase)
                      </span>
                      <Tag size={16} className={costUpdateMethod === 'last_purchase' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                      سيتم استبدال تكلفة المنتجات المشتراة في الكتالوج مباشرة بتكلفة هذه الفاتورة المحمّلة (Landed Cost).
                    </p>
                    <span className="mt-3 text-[10px] font-mono font-bold bg-white/80 dark:bg-black/40 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-800">
                      مثالي للسلع سريعة التغير في الأسعار أو عند الرغبة في التسعير على آخر سعر استيراد.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCostUpdateMethod('weighted_average')}
                    className={`flex flex-col items-start p-4 rounded-2xl border text-right transition-all duration-200 cursor-pointer ${
                      costUpdateMethod === 'weighted_average'
                        ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/30 shadow-lg'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-xs font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <span className={`w-3 h-3 rounded-full ${costUpdateMethod === 'weighted_average' ? 'bg-indigo-600 ring-4 ring-indigo-500/20' : 'bg-slate-300 dark:bg-slate-700'}`} />
                        المتوسط المرجح للتكلفة (WAC - Weighted Average)
                      </span>
                      <Layers3 size={16} className={costUpdateMethod === 'weighted_average' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                      يُحسب متوسط جديد وعادل بناءً على معادلة المخزون: <span className="font-mono text-indigo-600 dark:text-indigo-400">(الكمية القديمة × تكلفتها + الكمية الجديدة × تكلفتها) ÷ إجمالي الكمية</span>.
                    </p>
                    <span className="mt-3 text-[10px] font-mono font-bold bg-white/80 dark:bg-black/40 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-800">
                      المعيار المحاسبي الذهبي لمنع قفزات الأسعار المفاجئة وحماية هامش الربح.
                    </span>
                  </button>
                </div>
              </div>

              {viewMode === 'stepper' && (
                <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowRight size={16} />
                    <span>السابق: السلع والكميات</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canGoToStep4}
                    onClick={() => setCurrentStep(4)}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <span>الخطوة التالية: المراجعة والاعتماد</span>
                    <ArrowLeft size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: FINAL REVIEW AND FINANCIAL AUDIT */}
          {(viewMode === 'all-in-one' || (viewMode === 'stepper' && currentStep === 4)) && (
            <div className="space-y-6 animate-in slide-in-from-right-3 duration-200">
              {viewMode === 'all-in-one' && (
                <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  <span>4. المراجعة النهائية والتدقيق المالي قبل الترحيل</span>
                </h4>
              )}

              {/* 4 Financial KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800/80 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-slate-400 text-xs block font-bold mb-1">مجموع الأصناف (Subtotal)</span>
                  <div className="text-xl font-mono font-black text-slate-800 dark:text-white">
                    {itemsSubtotal.toLocaleString()} <span className="text-xs font-sans font-bold text-slate-400">ج.م</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">لعدد {orderItems.length} أصناف</span>
                </div>

                <div className="bg-white dark:bg-slate-800/80 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-slate-400 text-xs block font-bold mb-1">الشحن والرسوم الإضافية</span>
                  <div className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                    {(shippingFees + otherFees).toLocaleString()} <span className="text-xs font-sans font-bold text-slate-400">ج.م</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {shippingFeesPaymentMethod === 'wallet' ? 'الشحن يدفع من المحفظة' : 'مضافة على التكلفة المحملة'}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-800/80 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-slate-400 text-xs block font-bold mb-1">ضريبة القيمة المضافة ({taxRate}%)</span>
                  <div className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {taxAmount.toLocaleString()} <span className="text-xs font-sans font-bold text-slate-400">ج.م</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">تحتسب تلقائياً</span>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-3xl text-white shadow-lg shadow-emerald-500/20">
                  <span className="text-emerald-100 text-xs block font-bold mb-1">صافي إجمالي الفاتورة النهائي</span>
                  <div className="text-2xl font-mono font-black tracking-tight">
                    {totalCost.toLocaleString()} <span className="text-sm font-sans font-bold text-emerald-100">ج.م</span>
                  </div>
                  <span className="text-[10px] text-emerald-100 mt-1 block font-extrabold">التكلفة الإجمالية المحملة (Landed Cost)</span>
                </div>
              </div>

              {/* System Impact Preview Box */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4 border border-slate-800 shadow-xl">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <Sparkles className="text-amber-400 animate-pulse shrink-0" size={20} />
                  <div>
                    <h5 className="text-sm font-black text-white">ملخص التأثير التلقائي على النظام عند الاعتماد:</h5>
                    <p className="text-xs text-slate-400">تدقيق مالي ومخزني فوري لضمان دقة العمليات</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="flex items-start gap-2.5 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
                    <Building2 size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-slate-200 block">التأثير المالي على المورد ({selectedSupplier?.name || 'غير محدد'}):</span>
                      <span className="text-slate-400 font-medium">
                        {paymentMethod === 'credit' 
                          ? `تسجيل مديونية جديدة للمورد بقيمة ${totalCost.toLocaleString()} ج.م تضاف לרصيده.`
                          : `سداد فوري بنظام (${paymentMethod === 'cash' ? 'كاش المحفظة' : paymentMethod === 'supply_wallet' ? 'محفظة التوريد' : paymentMethod === 'partner' ? 'تمويل الشركاء' : 'الخزينة البنكية'}) دون إضافة مديونية.`
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
                    <Package size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-slate-200 block">التأثير على رصيد المخازن والكتالوج:</span>
                      <span className="text-slate-400 font-medium">
                        إدخال <span className="text-emerald-400 font-mono font-bold">{totalUnitsReceived}</span> قطعة فعلياً إلى مستودع ({settings.warehouses?.find((w: any) => w.id === selectedWarehouseId)?.name || 'الافتراضي'})، وتحديث أسعار وتكلفة <span className="text-indigo-400 font-mono font-bold">{orderItems.filter(i => i.updateCatalogPrice !== false).length}</span> منتج في الكتالوج بنظام {costUpdateMethod === 'weighted_average' ? 'المتوسط المرجح (WAC)' : 'آخر سعر شراء'}.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Items Review Table */}
              <div className="bg-white dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-black text-xs text-slate-700 dark:text-slate-200 flex justify-between items-center">
                  <span>تدقيق سريع لأصناف الفاتورة ({orderItems.length} صنف)</span>
                  <span className="text-slate-400 text-[11px] font-normal">إجمالي الوحدات المستلمة: {totalUnitsReceived}</span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
                  {orderItems.map((item, idx) => {
                    const rQty = item.receivedQuantity !== undefined ? item.receivedQuantity : item.quantity;
                    return (
                      <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-mono font-black text-[10px]">
                            #{idx + 1}
                          </span>
                          <span className="font-black text-slate-800 dark:text-white">{item.name || 'منتج غير مسمى'}</span>
                          {item.isReturn && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black">مرتجع</span>}
                        </div>
                        <div className="flex items-center gap-4 font-mono font-bold">
                          <span className="text-slate-500">الكمية: {rQty} {item.bonusQuantity ? `(+${item.bonusQuantity} بونص)` : ''}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-black">{(item.cost * (item.quantity || 0)).toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {viewMode === 'stepper' && (
                <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowRight size={16} />
                    <span>السابق: المصاريف والتكلفة</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Sticky Footer */}
        <div className="p-5 sm:p-6 bg-slate-900 dark:bg-black flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 border-t border-white/10 select-none">
          <div className="flex flex-wrap gap-6 text-right items-center">
            <div>
              <span className="text-slate-400 text-[10px] block mb-0.5">صافي الفاتورة النهائي</span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 tracking-tight">
                {totalCost.toLocaleString()} <span className="text-xs font-sans font-bold text-white/60">ج.م</span>
              </div>
            </div>
            <div className="hidden md:block border-r border-white/10 pr-6">
              <span className="text-slate-400 text-[10px] block mb-0.5">حالة التمويل</span>
              <span className="text-xs font-bold text-indigo-300">
                {paymentMethod === 'cash' && 'كاش المحفظة العامة'}
                {paymentMethod === 'supply_wallet' && 'محفظة التوريد المركزية'}
                {paymentMethod === 'partner' && `تمويل الشركاء (${partnerPayments.length} ممول)`}
                {paymentMethod === 'treasury' && 'الخزينة البنكية'}
                {paymentMethod === 'credit' && 'آجل (مديونية مورد)'}
              </span>
            </div>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="flex-1 sm:flex-none px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl font-bold transition-all text-xs cursor-pointer"
            >
              إلغاء وتجاهل
            </button>
            <button 
              type="button"
              onClick={handleAddOrder} 
              className="flex-1 sm:flex-none px-10 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <ShieldCheck size={18} />
              <span>{editingOrder ? 'حفظ وتحديث الفاتورة' : 'تأكيد وترحيل الفاتورة للمخازن'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
