import React, { useState, useMemo } from 'react';
import { 
  Layers, Plus, Edit2, Trash2, ArrowRightLeft, Search, Filter, 
  MapPin, Phone, User, CheckCircle2, AlertCircle, Package, 
  Building2, Store, Box, Truck, HelpCircle, Star, X, Check,
  ArrowRight, ShieldCheck, Sparkles, BarChart3
} from 'lucide-react';
import { Warehouse, Product, Settings } from '../types';
import { audioSynth } from '../utils/audioSynth';
import { getLatestProductCost } from '../utils/financials';
import { motion, AnimatePresence } from 'motion/react';

const EGYPT_GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية", 
  "المنوفية", "الغربية", "البحيرة", "دمياط", "بورسعيد", "الإسماعيلية", 
  "السويس", "كفر الشيخ", "الفيوم", "بني سويف", "المنيا", "أسيوط", 
  "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", 
  "مطروح", "شمال سيناء", "جنوب سيناء"
];

interface WarehousesTabProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  showAlert: (title: string, message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  orders?: any[];
}

export const WarehousesTab: React.FC<WarehousesTabProps> = ({
  settings,
  setSettings,
  showAlert,
  showConfirm,
  orders = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDepletionDashboard, setShowDepletionDashboard] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(null);
  const [branchItemSearch, setBranchItemSearch] = useState<Record<string, string>>({});

  // --- Smart Routing & Stock Depletion Predictor Analytics ---
  const depletionAnalytics = useMemo(() => {
    const warehouses = settings.warehouses || [];
    const products = settings.products || [];
    const recentOrders = Array.isArray(orders) ? orders : [];

    const salesRate: Record<string, Record<string, number>> = {};
    
    products.forEach(p => {
      salesRate[p.id] = {};
      warehouses.forEach(w => {
        salesRate[p.id][w.id] = 0;
      });
    });

    recentOrders.forEach(o => {
      const whId = o.warehouseId || o.warehouse_id;
      if (!whId) return;
      const orderItems = Array.isArray(o.items) ? o.items : [];
      
      orderItems.forEach(item => {
        const prodId = item.productId;
        if (salesRate[prodId] && salesRate[prodId][whId] !== undefined) {
          salesRate[prodId][whId] += Number(item.quantity) || 1;
        }
      });
    });

    products.forEach(p => {
      warehouses.forEach(w => {
        const totalSales = salesRate[p.id][w.id];
        salesRate[p.id][w.id] = totalSales > 0 ? totalSales / 14 : 0.05 + (Math.random() * 0.1);
      });
    });

    const warnings: Array<{
      id: string;
      productId: string;
      productName: string;
      warehouseName: string;
      currentStock: number;
      daysRemaining: number;
      recommendedAction: string;
      severity: 'high' | 'medium' | 'low';
    }> = [];

    products.forEach(p => {
      warehouses.forEach(w => {
        let currentStock = p.warehouseStock?.[w.id] || 0;
        if (p.hasVariants && Array.isArray(p.variants)) {
          currentStock = p.variants.reduce((sum, v) => sum + (v.warehouseStock?.[w.id] || 0), 0);
        }

        const rate = salesRate[p.id][w.id] || 0.1;
        const daysRemaining = Math.ceil(currentStock / rate);
        const safetyStock = p.minStockLevel || 5;

        if (currentStock <= safetyStock || daysRemaining < 7) {
          const surplusWh = warehouses.find(other => {
            if (other.id === w.id) return false;
            let otherStock = p.warehouseStock?.[other.id] || 0;
            if (p.hasVariants && Array.isArray(p.variants)) {
              otherStock = p.variants.reduce((sum, v) => sum + (v.warehouseStock?.[other.id] || 0), 0);
            }
            return otherStock > (p.minStockLevel || 10) * 2;
          });

          const action = surplusWh
            ? `نوصي بعمل نقل مخزون فوري بنقل ${Math.ceil(safetyStock * 3)} قطع من مستودع "${surplusWh.name}" لتوفر الفائض لديهم.`
            : `نوصي بطلب توريد عاجل من الموردين لعدم وجود فائض كافٍ في الفروع الأخرى.`;

          const severity = currentStock === 0 
            ? 'high' 
            : daysRemaining <= 3 
              ? 'high' 
              : daysRemaining <= 7 
                ? 'medium' 
                : 'low';

          warnings.push({
            id: `${p.id}-${w.id}`,
            productId: p.id,
            productName: p.name,
            warehouseName: w.name,
            currentStock,
            daysRemaining: isFinite(daysRemaining) ? daysRemaining : 999,
            recommendedAction: action,
            severity
          });
        }
      });
    });

    warnings.sort((a, b) => {
      const sevWeight = { high: 3, medium: 2, low: 1 };
      if (sevWeight[a.severity] !== sevWeight[b.severity]) {
        return sevWeight[b.severity] - sevWeight[a.severity];
      }
      return a.daysRemaining - b.daysRemaining;
    });

    return {
      salesRate,
      warnings: warnings.slice(0, 5)
    };
  }, [settings.warehouses, settings.products, orders]);

  // Modals state
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [newWarehouse, setNewWarehouse] = useState<Partial<Warehouse>>({
    name: '',
    location: '',
    isDefault: false,
    type: 'pos',
    managerName: '',
    phone: '',
    capacity: undefined,
    notes: ''
  });

  // Stock Transfer Modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState<string>('');
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [transferProductId, setTransferProductId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState<string>('');

  // Calculate executive statistics
  const stats = useMemo(() => {
    const warehouses = settings.warehouses || [];
    const products = settings.products || [];

    let totalUnits = 0;
    let totalValuation = 0;
    const branchStats: Record<string, { units: number; valuation: number; itemsCount: number }> = {};

    warehouses.forEach(w => {
      branchStats[w.id] = { units: 0, valuation: 0, itemsCount: 0 };
    });

    products.forEach(p => {
      warehouses.forEach(w => {
        let whUnits = 0;
        let whValuation = 0;
        let hasStock = false;

        const baseStock = p.warehouseStock?.[w.id] || 0;
        if (baseStock > 0) {
          const cost = getLatestProductCost(p.id, settings) || p.costPrice || 0;
          whUnits += baseStock;
          whValuation += baseStock * cost;
          hasStock = true;
        }

        if (p.variants && p.variants.length > 0) {
          p.variants.forEach(v => {
            const vStock = v.warehouseStock?.[w.id] || 0;
            if (vStock > 0) {
              const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || v.costPrice || p.costPrice || 0;
              whUnits += vStock;
              whValuation += vStock * cost;
              hasStock = true;
            }
          });
        }

        if (hasStock && branchStats[w.id]) {
          branchStats[w.id].units += whUnits;
          branchStats[w.id].valuation += whValuation;
          branchStats[w.id].itemsCount += 1;
          totalUnits += whUnits;
          totalValuation += whValuation;
        }
      });
    });

    return { totalUnits, totalValuation, branchStats, count: warehouses.length };
  }, [settings]);

  const handleCreateDefaultBranches = () => {
    const defaultBranches: Warehouse[] = [
      {
        id: 'wh-main-' + Date.now(),
        name: '🏢 المستودع المركزي الرئيسي (القاهرة - مدينة نصر)',
        location: 'المنطقة الصناعية - مدينة نصر، القاهرة',
        isDefault: true,
        type: 'central',
        capacity: 15000,
        managerName: 'م. أحمد محمود',
        phone: '01000000001',
        notes: 'المستودع الرئيسي المغذّي لكافة فروع ونقاط البيع'
      },
      {
        id: 'wh-pos-' + (Date.now() + 1),
        name: '🏬 فرع مبيعات وكاشير POS (المعادي - سيتي سنتر)',
        location: 'سيتي سنتر المعادي، القاهرة',
        isDefault: false,
        type: 'pos',
        capacity: 3500,
        managerName: 'أ. سارة خالد',
        phone: '01000000002',
        notes: 'فرع مبيعات التجزئة المباشرة للجمهور ونقطة بيع POS'
      }
    ];
    setSettings(prev => ({
      ...prev,
      warehouses: [...(prev.warehouses || []), ...defaultBranches]
    }));
    showAlert('تم الإضافة بنجاح', 'تم إعداد وإضافة الفروع والمستودعات الأساسية بنجاح.', 'success');
  };

  // Filtered warehouses
  const filteredWarehouses = useMemo(() => {
    return (settings.warehouses || []).filter(w => {
      const name = w.name || 'فرع بدون اسم';
      const location = w.location || '';
      const manager = w.managerName || '';
      const matchesSearch = 
        !searchTerm ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        manager.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'all' || 
        w.type === typeFilter || 
        (!w.type && typeFilter === 'pos') ||
        (typeFilter === 'central' && (w.isDefault || w.type === 'central'));
      return matchesSearch && matchesType;
    });
  }, [settings.warehouses, searchTerm, typeFilter]);

  // Branch Type badge helper
  const getBranchTypeBadge = (type?: string) => {
    switch (type) {
      case 'central':
        return { label: '🏢 مستودع مركزي رئيسي', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' };
      case 'pos':
        return { label: '🏬 فرع مبيعات ونقطة بيع POS', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
      case 'backup':
        return { label: '📦 مخزن احتياطي لوجستي', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      case 'logistics':
        return { label: '🚚 مركز شحن وتوزيع', color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' };
      default:
        return { label: '🏬 فرع مبيعات عام', color: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  // Handlers for Add / Edit Warehouse
  const handleOpenAddModal = () => {
    setEditingWarehouse(null);
    setNewWarehouse({
      name: '',
      location: '',
      isDefault: (settings.warehouses || []).length === 0,
      type: 'pos',
      managerName: '',
      phone: '',
      capacity: undefined,
      notes: ''
    });
    setShowWarehouseModal(true);
  };

  const handleOpenEditModal = (w: Warehouse) => {
    setEditingWarehouse(w);
    setNewWarehouse({ ...w });
    setShowWarehouseModal(true);
  };

  const handleSaveWarehouse = () => {
    if (!newWarehouse.name?.trim()) {
      showAlert("تنبيه", "يرجى إدخال اسم الفرع أو المستودع", "warning");
      return;
    }

    setSettings(prev => {
      const warehouses = prev.warehouses || [];
      let updatedWarehouses: Warehouse[];

      if (editingWarehouse) {
        updatedWarehouses = warehouses.map(w => w.id === editingWarehouse.id ? { ...w, ...newWarehouse } as Warehouse : w);
      } else {
        const created: Warehouse = {
          id: Date.now().toString(),
          name: newWarehouse.name || 'فرع جديد',
          location: newWarehouse.location || '',
          isDefault: newWarehouse.isDefault || false,
          type: newWarehouse.type || 'pos',
          managerName: newWarehouse.managerName || '',
          phone: newWarehouse.phone || '',
          capacity: newWarehouse.capacity ? Number(newWarehouse.capacity) : undefined,
          notes: newWarehouse.notes || '',
          coveredGovernorates: newWarehouse.coveredGovernorates || []
        };
        updatedWarehouses = [...warehouses, created];
      }

      // Handle default flag
      if (newWarehouse.isDefault) {
        const targetId = editingWarehouse?.id || updatedWarehouses[updatedWarehouses.length - 1].id;
        updatedWarehouses = updatedWarehouses.map(w => ({
          ...w,
          isDefault: w.id === targetId
        }));
      }

      return { ...prev, warehouses: updatedWarehouses };
    });

    audioSynth.announce(editingWarehouse ? "تم تحديث بيانات الفرع بنجاح" : "تم إضافة الفرع الجديد بنجاح", "success");
    setShowWarehouseModal(false);
  };

  const handleDeleteWarehouse = (id: string) => {
    const w = (settings.warehouses || []).find(x => x.id === id);
    if (!w) return;

    // Check if branch has products stock
    const bStats = stats.branchStats[id];
    if (bStats && bStats.units > 0) {
      showConfirm(
        "تنبيه: فرع يحتوي على مخزون مسجل",
        `هذا الفرع "${w.name}" يحتوي على (${bStats.units}) قطعة من المخزون بقيمة تقريبية (${bStats.valuation.toLocaleString()} ج.م). هل ترغب حقاً في حذفه؟ سيتم تصفير الرصيد المسجل في هذا الفرع من كل المنتجات تلقائياً.`,
        () => {
          setSettings(prev => {
            const updProducts = (prev.products || []).map(p => {
              const newWhStock = { ...(p.warehouseStock || {}) };
              delete newWhStock[id];
              return { ...p, warehouseStock: newWhStock };
            });
            return {
              ...prev,
              warehouses: (prev.warehouses || []).filter(x => x.id !== id),
              products: updProducts
            };
          });
          audioSynth.announce("تم حذف الفرع وتصفير أرصدته", "success");
        }
      );
      return;
    }

    showConfirm("تأكيد حذف الفرع", `هل أنت متأكد من حذف فرع "${w.name}"؟`, () => {
      setSettings(prev => ({
        ...prev,
        warehouses: (prev.warehouses || []).filter(x => x.id !== id)
      }));
      audioSynth.announce("تم حذف الفرع بنجاح", "success");
    });
  };

  const handleSetDefault = (id: string) => {
    setSettings(prev => ({
      ...prev,
      warehouses: (prev.warehouses || []).map(w => ({
        ...w,
        isDefault: w.id === id
      }))
    }));
    audioSynth.playTone('success');
    showAlert("تم التحديث", "تم تعيين هذا الفرع كمستودع افتراضي رئيسي للنظام", "success");
  };

  // Stock Transfer Engine
  const handleOpenTransferModal = (sourceId?: string) => {
    const warehouses = settings.warehouses || [];
    if (warehouses.length < 2) {
      showAlert("تنبيه", "يجب أن يكون لديك فرعين أو مستودعين على الأقل لتتمكن من نقل المخزون بينهما", "warning");
      return;
    }

    const initialSource = sourceId || warehouses[0]?.id || '';
    const initialTarget = warehouses.find(w => w.id !== initialSource)?.id || warehouses[1]?.id || '';

    setTransferSourceId(initialSource);
    setTransferTargetId(initialTarget);
    setTransferProductId('');
    setTransferQty(1);
    setTransferNotes('');
    setShowTransferModal(true);
  };

  // Products available in source warehouse
  const availableProductsForTransfer = useMemo(() => {
    if (!transferSourceId) return [];
    return (settings.products || []).filter(p => {
      const stock = p.warehouseStock?.[transferSourceId] || 0;
      return stock > 0;
    });
  }, [settings.products, transferSourceId]);

  const selectedTransferProductStock = useMemo(() => {
    if (!transferProductId || !transferSourceId) return 0;
    const p = (settings.products || []).find(x => x.id === transferProductId);
    return p?.warehouseStock?.[transferSourceId] || 0;
  }, [settings.products, transferProductId, transferSourceId]);

  const handleExecuteTransfer = () => {
    if (!transferSourceId || !transferTargetId) {
      showAlert("تنبيه", "يرجى تحديد فرع المصدر وفرع الوجهة", "warning");
      return;
    }
    if (transferSourceId === transferTargetId) {
      showAlert("تنبيه", "لا يمكن نقل المخزون لنفس الفرع! يرجى اختيار فرع وجهة مختلف.", "warning");
      return;
    }
    if (!transferProductId) {
      showAlert("تنبيه", "يرجى تحديد المنتج المراد نقله", "warning");
      return;
    }
    if (transferQty <= 0 || transferQty > selectedTransferProductStock) {
      showAlert("تنبيه", `الكمية المدخلة غير صحيحة أو تتجاوز الرصيد المتاح في فرع المصدر (${selectedTransferProductStock} قطعة)`, "warning");
      return;
    }

    const sourceWh = (settings.warehouses || []).find(w => w.id === transferSourceId);
    const targetWh = (settings.warehouses || []).find(w => w.id === transferTargetId);
    const prod = (settings.products || []).find(p => p.id === transferProductId);

    setSettings(prev => {
      const updatedProducts = (prev.products || []).map(p => {
        if (p.id !== transferProductId) return p;

        const currentSourceStock = p.warehouseStock?.[transferSourceId] || 0;
        const currentTargetStock = p.warehouseStock?.[transferTargetId] || 0;

        const newWhStock = {
          ...(p.warehouseStock || {}),
          [transferSourceId]: Math.max(0, currentSourceStock - transferQty),
          [transferTargetId]: currentTargetStock + transferQty
        };

        return {
          ...p,
          warehouseStock: newWhStock
        };
      });

      return { ...prev, products: updatedProducts };
    });

    audioSynth.announce(`تم نقل ${transferQty} قطعة من ${prod?.name} بنجاح إلى ${targetWh?.name}`, "success");
    showAlert(
      "نجاح نقل المخزون",
      `تم نقل (${transferQty} قطعة) من صنف "${prod?.name}" من فرع (${sourceWh?.name}) إلى فرع (${targetWh?.name}) بنجاح.`,
      "success"
    );
    setShowTransferModal(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300" dir="rtl">
      {/* 1. Executive Hero KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden border border-indigo-500/20">
          <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <Building2 size={24} className="text-indigo-400" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full">
              شبكة الفروع
            </span>
          </div>
          <p className="text-xs font-bold text-slate-300">إجمالي الفروع والمستودعات</p>
          <h3 className="text-3xl font-black mt-1 tracking-tight flex items-baseline gap-2">
            {stats.count}
            <span className="text-sm font-bold text-indigo-400">نقطة مسجلة</span>
          </h3>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <Package size={24} />
            </div>
            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full">
              المخزون الفعلي
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400">إجمالي القطع المخزنة بالفروع</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {stats.totalUnits.toLocaleString()}
            <span className="text-xs font-bold text-slate-400 mr-1.5">قطعة</span>
          </h3>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl">
              <BarChart3 size={24} />
            </div>
            <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full">
              التقييم المالي
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400">قيمة بضاعة الفروع بسعر التكلفة</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {stats.totalValuation.toLocaleString()}
            <span className="text-xs font-bold text-slate-400 mr-1.5">ج.م</span>
          </h3>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-2xl">
              <ArrowRightLeft size={24} />
            </div>
            <button 
              onClick={() => handleOpenTransferModal()}
              className="text-[11px] font-black bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded-full shadow-sm transition-all cursor-pointer flex items-center gap-1"
            >
              <span>نقل مخزون</span>
              <ArrowRightLeft size={12}/>
            </button>
          </div>
          <p className="text-xs font-bold text-slate-400">الربط اللوجستي السريع</p>
          <h3 className="text-base font-black text-slate-800 dark:text-white mt-2 flex items-center gap-2">
            <span>نقل وتوزيع فوري بين الفروع</span>
          </h3>
        </div>
      </div>

      {/* 1.5 Smart Routing & Stock Depletion Predictor Dashboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                🤖 محاكي ومحلل التوجيه الجغرافي ونفاد بضائع المستودعات (Smart Routing & Depletion Predictor)
              </h2>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">محرك ذكي لتوزيع الطلبات جغرافياً والتنبؤ بنسب نقص البضاعة وإدارة مخازن تغطية الفروع</p>
            </div>
          </div>
          <button
            onClick={() => setShowDepletionDashboard(!showDepletionDashboard)}
            className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            {showDepletionDashboard ? "إخفاء التفاصيل ⬆️" : "عرض التفاصيل ⬇️"}
          </button>
        </div>

        {showDepletionDashboard && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-200">
            {/* Right: Stock Depletion Predictor */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <AlertCircle size={16} className="text-rose-500" />
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-300">
                  مؤشر الخطر: توقعات نفاد المخزون وتوصيات النقل الذكية
                </h3>
              </div>

              {depletionAnalytics.warnings.length === 0 ? (
                <div className="p-8 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl text-center">
                  <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">جميع بضائع المستودعات تتمتع بمخزون آمن ومستقر!</p>
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/50 mt-1 font-bold">لا يوجد أي نقص متوقع أو طلب نفاد خلال الـ 7 أيام القادمة.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {depletionAnalytics.warnings.map(warning => (
                    <div 
                      key={warning.id} 
                      className={`p-4 rounded-2xl border transition-all ${
                        warning.severity === 'high'
                          ? 'bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30'
                          : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full mb-1.5 inline-block ${
                            warning.severity === 'high'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                          }`}>
                            {warning.currentStock === 0 
                              ? "منفذ تماماً ❌" 
                              : `النفاد خلال ${warning.daysRemaining} يوم ⌛`}
                          </span>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white">{warning.productName}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-bold">الموقع: 🏪 {warning.warehouseName} | الرصيد الحالي: {warning.currentStock} قطعة</p>
                        </div>
                        
                        <button
                          onClick={() => {
                            const wh = (settings.warehouses || []).find(w => w.name === warning.warehouseName);
                            if (wh) {
                              setTransferTargetId(wh.id);
                              setTransferProductId(warning.productId);
                              const otherWh = (settings.warehouses || []).find(w => w.id !== wh.id);
                              if (otherWh) setTransferSourceId(otherWh.id);
                              setTransferQty(5);
                              setShowTransferModal(true);
                            }
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <span>نقل ذكي ⚡</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800 rounded-lg mt-2 font-bold leading-relaxed">
                        💡 {warning.recommendedAction}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Left: Geofencing Coverage Map */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <MapPin size={16} className="text-indigo-500" />
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-300">
                  خريطة تغطية المحافظات الجغرافية ومسؤوليات الشحن
                </h3>
              </div>

              <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                {(settings.warehouses || []).map(w => {
                  const covered = Array.isArray(w.coveredGovernorates) ? w.coveredGovernorates : [];
                  return (
                    <div key={w.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-start gap-3">
                      <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-black shrink-0">
                        🏪
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black text-slate-800 dark:text-white">{w.name}</h4>
                          <span className="text-[9px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                            {w.isDefault ? "مستودع افتراضي" : "مستودع تغطية جغرافية"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-bold">نوع التشغيل: {w.type === 'central' ? 'مركزي رئيسي' : w.type === 'pos' ? 'فرع مبيعات' : w.type === 'backup' ? 'مخزن احتياطي' : 'مركز شحن وتوزيع'}</p>
                        
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {covered.length === 0 ? (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                              التغطية: يستقبل الطلبات الافتراضية المتبقية
                            </span>
                          ) : (
                            covered.map(gov => (
                              <span key={gov} className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                📍 {gov}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Action Toolbar & Filtering */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1 sm:flex-none">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="ابحث باسم الفرع، الموقع، أو المسؤول..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'central', label: '🏢 مستودعات مركزية' },
              { id: 'pos', label: '🏬 فروع مبيعات POS' },
              { id: 'backup', label: '📦 مخازن احتياطية' },
              { id: 'logistics', label: '🚚 مراكز شحن' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  typeFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add Branch / Transfer Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenTransferModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-xs transition-all cursor-pointer shadow-sm"
          >
            <ArrowRightLeft size={15} className="text-cyan-600 dark:text-cyan-400" />
            <span>نقل مخزون</span>
          </button>

          <button 
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={16} />
            <span>إضافة فرع / نقطة بيع جديدة</span>
          </button>
        </div>
      </div>

      {/* 3. Branches & Warehouses Grid */}
      {filteredWarehouses.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-16 text-center rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-500">
            <Building2 size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
            {(settings.warehouses || []).length === 0 
              ? 'لا توجد أي فروع أو مستودعات مسجلة بعد' 
              : 'لا توجد فروع أو مستودعات مطابقة للبحث أو الفلتر'}
          </h3>
          <p className="text-slate-400 text-sm font-bold max-w-md mx-auto mb-8">
            {(settings.warehouses || []).length === 0 
              ? 'قم بإنشاء وهيكلة فروعك ونقاط البيع لتتبع المخزون اللامركزي وإدارة التحويلات المباشرة بين المقرات.'
              : 'قم بتغيير خيارات الفلترة أو مسح كلمات البحث لعرض الفروع والمستودعات المسجلة في نظامك.'}
          </p>
          {(settings.warehouses || []).length === 0 ? (
            <button
              onClick={handleCreateDefaultBranches}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/30 transition-all cursor-pointer hover:-translate-y-0.5"
            >
              <Plus size={18} />
              <span>⚡ إنشاء الفروع الأساسية نموذجياً الآن (الفرع الرئيسي وفرع مبيعات POS)</span>
            </button>
          ) : (
            <button
              onClick={() => { setTypeFilter('all'); setSearchTerm(''); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-xs transition-all cursor-pointer shadow-sm"
            >
              <span>🔄 عرض كل الفروع والمستودعات ({settings.warehouses.length})</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWarehouses.map(w => {
            const bStats = stats.branchStats[w.id] || { units: 0, valuation: 0, itemsCount: 0 };
            const badge = getBranchTypeBadge(w.type);
            const isExpanded = expandedWarehouseId === w.id;
            const branchSearch = branchItemSearch[w.id] || '';

            // Products stored in this warehouse
            const branchProducts = (settings.products || []).filter(p => {
              const mainStock = p.warehouseStock?.[w.id] || 0;
              const hasVariantStock = (p.variants || []).some(v => (v.warehouseStock?.[w.id] || 0) > 0);
              return mainStock > 0 || hasVariantStock;
            }).filter(p => {
              if (!branchSearch) return true;
              return p.name.toLowerCase().includes(branchSearch.toLowerCase()) || 
                     (p.sku && p.sku.toLowerCase().includes(branchSearch.toLowerCase()));
            });

            // Calculate capacity percentage if capacity exists
            const capacityPercent = w.capacity && w.capacity > 0 
              ? Math.min(100, Math.round((bStats.units / w.capacity) * 100))
              : null;

            return (
              <div 
                key={w.id}
                className={`bg-white dark:bg-slate-900 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between overflow-hidden relative shadow-sm hover:shadow-md ${
                  w.isDefault 
                    ? 'border-amber-400/80 dark:border-amber-500/60 ring-2 ring-amber-400/20' 
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {w.isDefault && (
                  <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-1.5 rounded-br-2xl text-[10px] font-black flex items-center gap-1 shadow-md z-10">
                    <Star size={11} className="fill-white" />
                    <span>الفرع الافتراضي الرئيسي</span>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  {/* Top header with badge and actions */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1 text-right flex-1">
                      <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-black border mb-2 ${badge.color}`}>
                        {badge.label}
                      </span>
                      <h4 className="text-xl font-black text-slate-900 dark:text-white truncate">
                        {w.name}
                      </h4>
                      {w.location && (
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center gap-1.5 mt-1">
                          <MapPin size={13} className="text-indigo-500 shrink-0" />
                          <span className="truncate">{w.location}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-1">
                      {!w.isDefault && (
                        <button
                          onClick={() => handleSetDefault(w.id)}
                          className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-all cursor-pointer"
                          title="تعيين كافتراضي"
                        >
                          <Star size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditModal(w)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all cursor-pointer"
                        title="تعديل الفرع"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteWarehouse(w.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
                        title="حذف الفرع"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Manager & Contact Info */}
                  {(w.managerName || w.phone) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {w.managerName && (
                        <span className="flex items-center gap-1.5">
                          <User size={13} className="text-indigo-500" />
                          <span>المسؤول: {w.managerName}</span>
                        </span>
                      )}
                      {w.phone && (
                        <span className="flex items-center gap-1.5" dir="ltr">
                          <span>{w.phone}</span>
                          <Phone size={13} className="text-emerald-500" />
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stock KPI Box */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 relative overflow-hidden">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                        <Box size={14} className="text-indigo-400" />
                        <span>رصيد المخزون الحالي</span>
                      </span>
                      <span className="text-xs font-black bg-indigo-600/30 text-indigo-300 px-2.5 py-0.5 rounded-lg">
                        {bStats.itemsCount} صنف مختلف
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1">
                      <div>
                        <span className="text-2xl font-black text-white">{bStats.units.toLocaleString()}</span>
                        <span className="text-xs font-bold text-slate-400 mr-1.5">قطعة</span>
                      </div>
                      <div className="text-left" dir="ltr">
                        <span className="text-sm font-black text-emerald-400">{bStats.valuation.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-slate-400 ml-1">ج.م</span>
                      </div>
                    </div>

                    {/* Capacity bar if defined */}
                    {capacityPercent !== null && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] font-extrabold text-slate-400">
                          <span>نسبة امتلاء المخزن: {capacityPercent}%</span>
                          <span>{bStats.units} / {w.capacity} قطعة</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              capacityPercent > 90 ? 'bg-rose-500' : capacityPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${capacityPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes if any */}
                  {w.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
                      {w.notes}
                    </p>
                  )}
                </div>

                {/* Bottom expandable inventory browser */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 px-6 py-3">
                  <div className="flex justify-between items-center gap-2">
                    <button
                      onClick={() => handleOpenTransferModal(w.id)}
                      className="flex items-center gap-1 text-xs font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline py-1"
                    >
                      <ArrowRightLeft size={13} />
                      <span>نقل من هذا الفرع</span>
                    </button>

                    <button
                      onClick={() => setExpandedWarehouseId(isExpanded ? null : w.id)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 py-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'إخفاء أصناف الفرع ▲' : 'استعراض أصناف المخزون ▼'}</span>
                    </button>
                  </div>

                  {/* Accordion Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pt-3 space-y-2.5"
                      >
                        {/* Search SKU inside branch */}
                        <div className="relative">
                          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text"
                            placeholder="ابحث بصنف أو SKU في هذا الفرع..."
                            value={branchSearch}
                            onChange={e => setBranchItemSearch(prev => ({ ...prev, [w.id]: e.target.value }))}
                            className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold outline-none"
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {branchProducts.length === 0 ? (
                            <p className="text-[11px] font-bold text-slate-400 text-center py-4">
                              لا توجد أصناف مطابقة أو مخزنة حالياً في هذا الفرع.
                            </p>
                          ) : (
                            branchProducts.map(p => {
                              const mainStock = p.warehouseStock?.[w.id] || 0;
                              const variantDetails = (p.variants || []).filter(v => (v.warehouseStock?.[w.id] || 0) > 0);
                              
                              return (
                                <div key={p.id} className="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 text-xs">
                                  <div className="flex justify-between items-center gap-2">
                                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-right flex-1 truncate">{p.name}</span>
                                    {mainStock > 0 && (
                                      <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-lg text-[11px]">
                                        {mainStock} قطعة
                                      </span>
                                    )}
                                  </div>
                                  {p.sku && <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</p>}

                                  {variantDetails.length > 0 && (
                                    <div className="mt-1.5 space-y-1 pl-2 border-r-2 border-indigo-500/30">
                                      {variantDetails.map(vd => (
                                        <div key={vd.id} className="flex justify-between items-center text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg">
                                          <span>النوع: {Object.values(vd.options || {}).join(' - ') || vd.sku}</span>
                                          <span className="font-black text-indigo-600 dark:text-indigo-400">{vd.warehouseStock?.[w.id]} قطعة</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Add / Edit Warehouse Modal Dialog */}
      <AnimatePresence>
        {showWarehouseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center font-black">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{editingWarehouse ? 'تعديل بيانات الفرع / المستودع' : 'إضافة فرع / نقطة بيع جديدة'}</h3>
                    <p className="text-xs text-slate-400">إدارة تفاصيل الموقع والسعة ومسؤول التخزين</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowWarehouseModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Name */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    اسم الفرع أو المستودع <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: المستودع الرئيسي بالعاشر، فرع سيتي ستارز، إلخ..."
                    value={newWarehouse.name}
                    onChange={e => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    نوع الفرع / تصنيف نقطة البيع
                  </label>
                  <select
                    value={newWarehouse.type || 'pos'}
                    onChange={e => setNewWarehouse({ ...newWarehouse, type: e.target.value as any })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="central">🏢 مستودع مركزي رئيسي</option>
                    <option value="pos">🏬 فرع مبيعات ونقطة بيع مباشر (POS)</option>
                    <option value="backup">📦 مخزن احتياطي وتخزين طويل المدى</option>
                    <option value="logistics">🚚 مركز شحن وتوزيع وتوصيل</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    العنوان أو الموقع الجغرافي
                  </label>
                  <input
                    type="text"
                    placeholder="المدينة، المنطقة، أو التفاصيل الجغرافية..."
                    value={newWarehouse.location || ''}
                    onChange={e => setNewWarehouse({ ...newWarehouse, location: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Manager & Phone in two columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      اسم مسؤول الفرع / أمين المخزن
                    </label>
                    <input
                      type="text"
                      placeholder="اسم المسؤول..."
                      value={newWarehouse.managerName || ''}
                      onChange={e => setNewWarehouse({ ...newWarehouse, managerName: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      رقم التواصل مع الفرع
                    </label>
                    <input
                      type="text"
                      placeholder="01xxxxxxxxx"
                      value={newWarehouse.phone || ''}
                      onChange={e => setNewWarehouse({ ...newWarehouse, phone: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    السعة التخزينية القصوى بالقطع (اختياري)
                  </label>
                  <input
                    type="number"
                    placeholder="مثال: 5000 قطعة (لحساب مؤشر نسبة الامتلاء)"
                    value={newWarehouse.capacity || ''}
                    onChange={e => setNewWarehouse({ ...newWarehouse, capacity: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    ملاحظات أو تعليمات خاصة بالفرع
                  </label>
                  <textarea
                    rows={2}
                    placeholder="أي ملاحظات تشغيلية أو أوقات عمل الفرع..."
                    value={newWarehouse.notes || ''}
                    onChange={e => setNewWarehouse({ ...newWarehouse, notes: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Covered Governorates */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    المحافظات الجغرافية المغطاة (للتوجيه التلقائي الذكي للطلبات)
                  </label>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                    <p className="text-[10px] text-slate-500 font-bold mb-2">اختر المحافظات التي يقوم هذا المستودع بتغطية طلباتها جغرافياً:</p>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                      {EGYPT_GOVERNORATES.map(gov => {
                        const currentCovered = Array.isArray(newWarehouse.coveredGovernorates) 
                          ? newWarehouse.coveredGovernorates 
                          : [];
                        const isChecked = currentCovered.includes(gov);
                        return (
                          <label key={gov} className="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                let updated: string[] = [];
                                if (e.target.checked) {
                                  updated = [...currentCovered, gov];
                                } else {
                                  updated = currentCovered.filter(g => g !== gov);
                                }
                                setNewWarehouse({ ...newWarehouse, coveredGovernorates: updated });
                              }}
                              className="w-4 h-4 text-indigo-600 rounded focus:ring-0 cursor-pointer"
                            />
                            {gov}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Set default toggle */}
                <label className="flex items-center gap-3 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newWarehouse.isDefault || false}
                    onChange={e => setNewWarehouse({ ...newWarehouse, isDefault: e.target.checked })}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 block">تعيين كفرع ومستودع افتراضي رئيسي</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">سيتم استقبال وتوجيه فواتير الشراء والمرتجعات لهذا المستودع تلقائياً ما لم يتم تحديد غيره.</span>
                  </div>
                </label>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setShowWarehouseModal(false)}
                  className="px-6 py-3 rounded-2xl text-xs font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveWarehouse}
                  className="px-8 py-3 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
                >
                  {editingWarehouse ? 'حفظ التعديلات' : 'إضافة الفرع الآن'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Stock Transfer Modal Dialog (نقل مخزون بين الفروع) */}
      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-6 bg-gradient-to-r from-cyan-600 to-indigo-700 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center font-black backdrop-blur-sm">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">نقل وتوزيع المخزون بين الفروع</h3>
                    <p className="text-xs text-cyan-100 font-bold">تحويل رصيد البضاعة من مستودع لآخر لحظياً</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTransferModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Source & Target Warehouses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      من فرع المصدر (المحول منه)
                    </label>
                    <select
                      value={transferSourceId}
                      onChange={e => {
                        setTransferSourceId(e.target.value);
                        setTransferProductId('');
                      }}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-extrabold text-slate-800 dark:text-white outline-none focus:border-cyan-500 transition-all cursor-pointer"
                    >
                      {(settings.warehouses || []).map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      إلى فرع الوجهة (المستقبل)
                    </label>
                    <select
                      value={transferTargetId}
                      onChange={e => setTransferTargetId(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-extrabold text-slate-800 dark:text-white outline-none focus:border-cyan-500 transition-all cursor-pointer"
                    >
                      {(settings.warehouses || []).map(w => (
                        <option key={w.id} value={w.id} disabled={w.id === transferSourceId}>
                          {w.name} {w.id === transferSourceId ? '(المصدر الحالي)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Product to transfer */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    تحديد الصنف المراد نقله <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={transferProductId}
                    onChange={e => {
                      setTransferProductId(e.target.value);
                      setTransferQty(1);
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-cyan-500 transition-all cursor-pointer"
                  >
                    <option value="">-- اختر من الأصناف المتاحة في فرع المصدر --</option>
                    {availableProductsForTransfer.map(p => {
                      const stock = p.warehouseStock?.[transferSourceId] || 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} (المتاح في المصدر: {stock} قطعة) {p.sku ? `[${p.sku}]` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {transferSourceId && availableProductsForTransfer.length === 0 && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1">
                      لا يوجد أي مخزون مسجل في الفرع المختار كمصدر حالياً.
                    </p>
                  )}
                </div>

                {/* Quantity */}
                {transferProductId && (
                  <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-4 rounded-2xl border border-cyan-100 dark:border-cyan-900/40 space-y-3">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span className="text-slate-700 dark:text-slate-300">الكمية المراد نقلها:</span>
                      <span className="text-cyan-600 dark:text-cyan-400">الحد الأقصى المتاح: {selectedTransferProductStock} قطعة</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTransferQty(Math.max(1, transferQty - 1))}
                        className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-base shadow-sm hover:bg-slate-100"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={selectedTransferProductStock}
                        value={transferQty || ''}
                        onChange={e => setTransferQty(Math.min(selectedTransferProductStock, Math.max(1, Number(e.target.value))))}
                        className="flex-1 p-2.5 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-base outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setTransferQty(Math.min(selectedTransferProductStock, transferQty + 1))}
                        className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-base shadow-sm hover:bg-slate-100"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferQty(selectedTransferProductStock)}
                        className="px-3 py-2 bg-cyan-600 text-white rounded-xl text-[11px] font-black hover:bg-cyan-500 transition-all"
                      >
                        نقل الكل
                      </button>
                    </div>
                  </div>
                )}

                {/* Transfer Notes */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    ملاحظات أو رقم إذن الصرف وتحويل البضاعة (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: تحويل لسد عجز فرع المبيعات، إذن تحويل #8841..."
                    value={transferNotes}
                    onChange={e => setTransferNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="px-6 py-3 rounded-2xl text-xs font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleExecuteTransfer}
                  disabled={!transferProductId || transferQty <= 0}
                  className="px-8 py-3 rounded-2xl text-xs font-black bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ArrowRightLeft size={16} />
                  <span>تأكيد نقل المخزون الآن</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
