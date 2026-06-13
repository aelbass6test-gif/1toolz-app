import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Trash2, Edit3, ChevronDown, Package, MapPin, Coins, FileSearch, AlertCircle, ShieldCheck, ShieldAlert, Banknote, ShoppingBag, Save, XCircle, Info, UploadCloud, User as UserIcon, Building, Download, Filter, Truck, CheckCircle, RefreshCcw, Briefcase, ChevronLeft, ChevronRight, MoreVertical, Percent, Lock, Unlock, Receipt, AlertTriangle, MessageCircle, Printer, Wand2, FileText, Phone, Archive, ArrowRightLeft, Image as ImageIcon, FileDown, LayoutList, LayoutGrid, Settings as SettingsIcon, X, PhoneForwarded, Users, ExternalLink, Link as LinkIcon, MessageSquare, Clock, Shield, Check, TrendingUp, TrendingDown, Sparkles, Calculator, ArrowLeft } from 'lucide-react';
import { db } from '../services/firebaseClient';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Order, Settings, OrderStatus, Wallet, Transaction, PaymentStatus, PreparationStatus, OrderItem, Product, CustomerProfile, Store, Employee, User, AuditLog } from '../types';
import { ORDER_STATUSES, EGYPT_GOVERNORATES, ORDER_STATUS_METADATA, generateEgyptShippingOptions } from '../constants';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { generateInvoiceHTML } from '../utils/invoiceGenerator';
import { generateShippingLabelHTML } from '../utils/shippingLabelGenerator';
import { generateShippingNote } from '../services/geminiService';
import { calculateCodFee, getLatestProductCost, isBosta, calculateInsuranceFee, calculateBostaVat } from '../utils/financials';
import { generateOrdersReportHTML } from '../utils/reportGenerator';
import { triggerWebhooks } from '../utils/webhook';
import { printHTMLDirectly } from '../utils/printHelper';
import { OrderDetailsModal } from './OrderDetailsModal';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

const PREPARATION_STATUSES: PreparationStatus[] = ['بانتظار التجهيز', 'جاهز'];
const PAYMENT_STATUSES: PaymentStatus[] = ['بانتظار الدفع', 'مدفوع', 'مدفوع جزئياً', 'مرتجع'];

interface OrdersListProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  settings: Settings;
  currentUser: User | null;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  addLoyaltyPointsForOrder: (order: Order) => void;
  activeStore?: Store;
  customers: CustomerProfile[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerProfile[]>>;
  treasury?: any;
  setTreasury?: (updater: any) => void;
  defaultShowAdd?: boolean;
}

interface NewOrderState extends Partial<Omit<Order, 'id'>> {
  items: OrderItem[];
  customerPhone2?: string;
  country?: string;
  buildingDetails?: string;
  creditAmount?: number;
  totalAmountOverrideReason?: string;
  advancePayment?: number;
  advancePaymentPartnerId?: string;
  advancePaymentTreasuryId?: string;
  advancePaymentRecipientPhone?: string;
  advancePaymentSenderDetails?: string;
}

const EditTotalModal: React.FC<{ 
    currentTotal: number; 
    onClose: () => void; 
    onApply: (amount: number, reason: string) => void; 
}> = ({ currentTotal, onClose, onApply }) => {
    const [amount, setAmount] = useState(currentTotal);
    const [reason, setReason] = useState('');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            >
                <div className="p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">تعديل إجمالي الطلب</h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        عميلك سيدفع هذا المبلغ لمندوب الشحن عند استلام الطلب
                    </p>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">إجمالي الطلب</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl text-2xl font-black text-slate-800 dark:text-white outline-none focus:border-emerald-500 transition-all text-left pr-16"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">ج.م</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">Reason</label>
                            <textarea 
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="أدخل سببًا..."
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px] resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => onApply(amount, reason)}
                            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                        >
                            تطبيق
                        </button>
                        <button 
                            onClick={onClose}
                            className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        >
                            إلغاء
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const WaybillModal: React.FC<{ order: Order; onClose: () => void; onSave: (waybill: string) => void; }> = ({ order, onClose, onSave }) => {
    const [waybill, setWaybill] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!waybill.trim()) return;
        onSave(waybill);
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-6">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20">
                        <FileSearch size={24}/>
                    </div>
                    <h3 className="text-xl font-black dark:text-white">إدخال رقم بوليصة الشحن</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    لتغيير حالة الطلب إلى "تم الارسال"، يجب إدخال رقم بوليصة الشحن أولاً.
                </p>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        value={waybill}
                        onChange={e => setWaybill(e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-center text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
                        placeholder="رقم البوليصة"
                        autoFocus
                    />
                    <div className="flex gap-3 mt-8">
                        <button type="submit" disabled={!waybill.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 shadow-sm hover:shadow">
                            حفظ وتغيير الحالة
                        </button>
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const OrdersList: React.FC<OrdersListProps & { onRefresh?: () => void }> = ({ orders, setOrders, products, settings, currentUser, setWallet, setSettings, addLoyaltyPointsForOrder, activeStore, customers, setCustomers, onRefresh, treasury, setTreasury, defaultShowAdd }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const storePrefix = activeStore ? `/store/${activeStore.id}` : '';
  const [searchTerm, setSearchTerm] = useState('');
    useEffect(() => {
        if (defaultShowAdd) {
            navigate(`${storePrefix}/orders/new`, { replace: true });
        }
    }, [defaultShowAdd, navigate]);

  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [pendingFlexShipConfirm, setPendingFlexShipConfirm] = useState<{
    orderId: string;
    newStatus: OrderStatus;
    fee: number;
    companyName: string;
    orderNumber: string;
  } | null>(null);
  const [pendingInspectionConfirm, setPendingInspectionConfirm] = useState<{
    order: Order;
    newPaymentStatus: PaymentStatus;
    inspectionFee: number;
  } | null>(null);
  const [autoWhatsappData, setAutoWhatsappData] = useState<{order: Order, newStatus: string} | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showSummaryModal, setShowSummaryModal] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<Order | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      if (onRefresh && document.visibilityState === 'visible') {
        onRefresh();
      }
    }, 10000); // UI poll every 10 seconds for smoothness
    return () => clearInterval(interval);
  }, [onRefresh]);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      if (activeStore?.id) {
          const connectedPlatforms = settings?.connectedPlatforms || [];
          const platformConfigs = settings?.platformConfigs || {};
          const activePlatforms = connectedPlatforms.filter((p: string) => platformConfigs[p]?.isActive);

          if (activePlatforms.length === 0) {
              await onRefresh();
              alert('لا توجد منصات ربط نشطة (مثل سلة أو وويلت) لمزامنة الطلبات منها حالياً. تم تحديث سجل الطلبات من السحابة بنجاح.');
              return;
          }

          let anySuccess = false;
          let totalSynced = 0;
          let totalUpdated = 0;
          let errors: string[] = [];

          for (const platformId of activePlatforms) {
              try {
                  const res = await fetch(`/api/sync/platform/${platformId}/${activeStore.id}?type=orders`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                  });
                  if (res.ok) {
                      const data = await res.json();
                      anySuccess = true;
                      totalSynced += data.processed || 0;
                      totalUpdated += data.actualWrites || 0;
                  } else {
                      const errData = await res.json().catch(() => ({}));
                      errors.push(`فشلت المزامنة مع ${platformId}: ${errData.error || res.statusText}`);
                  }
              } catch (err: any) {
                  errors.push(`خطأ اتصال مع ${platformId}: ${err.message || err}`);
              }
          }

          await onRefresh();

          if (errors.length > 0) {
              alert(`تنبيهات أثناء المزامنة مع بعض المنصات:\n${errors.join('\n')}\n\nتم تحديث وعرض الطلبات السحابية والمحلية المتوفرة.`);
          } else if (anySuccess) {
              if (totalSynced > 0 || totalUpdated > 0) {
                  alert(`تمت المزامنة بنجاح من كافة المنصات!\n- تم معالجة ${totalSynced} سجل.\n- تم تحديث ${totalUpdated} طلب في قاعدة البيانات.`);
              } else {
                  alert('تمت المزامنة بنجاح: لا توجد طلبات جديدة أو تحديثات حالية في متاجرك المتصلة.');
              }
          } else {
              alert('لم نتمكن من المزامنة مع المنصات المتصلة. يرجى التحقق من إعدادات الربط ومفاتيح API في صفحة الإعدادات.');
          }
      } else {
          await onRefresh();
      }
    } catch (e: any) {
        alert(`فشلت مزامنة التطبيق: ${e.message || e}`);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };
  
  const [activeTab, setActiveTab ] = useState('الجميع');
  const [showAnalyticsHub, setShowAnalyticsHub] = useState(false);
  const [viewMode, setViewMode ] = useState<'list' | 'kanban'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<Omit<Order, 'id'> | null>(null);
  const [orderForWaybill, setOrderForWaybill] = useState<{ orderId: string, newStatus: OrderStatus } | null>(null);
  
  // Advanced Filters
  const [filterGov, setFilterGov] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState<Order | null>(null);
  const [showAssignment, setShowAssignment] = useState<Order | null>(null);
  const [reportPreviewHtml, setReportPreviewHtml] = useState<string | null>(null);
  
  const addAuditLog = (orderId: string, action: string, details: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const newLog: AuditLog = {
          id: Math.random().toString(36).substr(2, 9),
          action,
          details,
          timestamp: new Date().toISOString(),
          userEmail: currentUser?.email || 'System'
        };
        return {
          ...o,
          auditLogs: [...(o.auditLogs || []), newLog]
        };
      }
      return o;
    }));
  };
  
  const activeCompanies = useMemo(() => 
    Object.keys(settings.shippingOptions || {}).filter(company => settings.activeCompanies?.[company] !== false),
    [settings.shippingOptions, settings.activeCompanies]
  );
  
  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map<string, Pick<CustomerProfile, 'name' | 'phone' | 'address'>>();
    orders.forEach(order => {
      const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
      if (cleanPhone && !customerMap.has(cleanPhone)) {
        customerMap.set(cleanPhone, {
          name: order.customerName,
          phone: order.customerPhone,
          address: order.customerAddress,
        });
      }
    });
    return Array.from(customerMap.values());
  }, [orders]);


  const handleEditOrder = (order: Order) => {
    navigate(`${storePrefix}/orders/edit/${order.id}`);
  };

  useEffect(() => {
    if (onRefresh && orders.length > 0) {
      // Logic for refresh if needed
    }
  }, [orders.length, onRefresh]);

  const filteredOrders = useMemo(() => {
    let baseFilter;
    if (activeTab === 'مؤرشف') {
        baseFilter = orders.filter(o => o.status === 'مؤرشف');
    } else {
        baseFilter = orders.filter(o => o.status !== 'مؤرشف');
    }

    const searched = baseFilter.filter((o: Order) => {
      const matchesSearch = (o.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (o.orderNumber && o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.waybillNumber && o.waybillNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesGov = !filterGov || (o.governorate || o.shippingArea) === filterGov;
      const matchesCompany = !filterCompany || o.shippingCompany === filterCompany;
      const matchesEmployee = !filterEmployee || o.assignedTo === filterEmployee;
      
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
          const orderDate = new Date(o.date).getTime();
          if (dateRange.start) {
              matchesDate = matchesDate && orderDate >= new Date(dateRange.start).getTime();
          }
          if (dateRange.end) {
              const endDate = new Date(dateRange.end);
              endDate.setHours(23, 59, 59, 999);
              matchesDate = matchesDate && orderDate <= endDate.getTime();
          }
      }

      return matchesSearch && matchesGov && matchesCompany && matchesEmployee && matchesDate;
    });
      
    let tabFiltered = searched;
    if (activeTab !== 'الجميع') {
        tabFiltered = searched.filter(o => o.status === activeTab);
    }

    return tabFiltered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, searchTerm, activeTab]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const filteredMetrics = useMemo(() => {
    let salesTotal = 0;
    let expectedCollection = 0;
    let shippingExpenses = 0;
    let productCostTotal = 0;
    let flexFeesTotal = 0;
    let netProfitTotal = 0;
    let successCount = 0;
    let returnCount = 0;

    filteredOrders.forEach(o => {
      const safeProductPrice = Number(o.productPrice) || 0;
      const safeShippingFee = Number(o.shippingFee) || 0;
      const safeDiscount = Number(o.discount) || 0;
      const safeProductCost = Number(o.productCost) || 0;
      const safeTax = Number(o.tax) || 0;
      const safeAdvance = Number(o.advancePayment) || 0;

      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      const insuranceFee = (o.isInsured ?? true) ? calculateInsuranceFee(o, insuranceRate, settings) : 0;
      const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر';
      const inspectionFee = !isPosOrder && (o.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
      const codFee = calculateCodFee(o, settings);
      const bostaVatFee = calculateBostaVat(o, insuranceFee, settings);

      const inspectionAdjustment = o.inspectionFeePaidByCustomer ? 0 : inspectionFee;
      
      const computedTotal = safeProductPrice + safeShippingFee + safeTax - safeDiscount - safeAdvance + inspectionFee;
      const orderTotal = o.totalAmountOverride != null ? Number(o.totalAmountOverride) : computedTotal;

      const baseRevenue = safeProductPrice + safeShippingFee + safeTax;
      const amountCollectedFromCustomer = o.totalAmountOverride !== undefined && o.totalAmountOverride !== null
          ? o.totalAmountOverride + safeAdvance 
          : (baseRevenue - safeDiscount);

      const totalCarrierExpenses = safeShippingFee + insuranceFee + bostaVatFee;
      const totalExpenses = safeProductCost + safeShippingFee + insuranceFee + inspectionAdjustment + codFee + bostaVatFee;

      const isReturnedOrFailed = ['مرتجع', 'فشل_التوصيل'].includes(o.status);
      const flexFeeValue = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);
      const flexPaidAmount = o.flexShipFeePaidByCustomer ? (o.flexShipFee || flexFeeValue) : 0;
      const flexCompanyFeeValue = useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0);
      const flexCompanyFeePaid = o.flexShipFeePaidByCustomer ? (o.flexShipCompanyFee ?? flexCompanyFeeValue) : 0;

      const oProfit = isReturnedOrFailed
          ? (flexPaidAmount - totalCarrierExpenses - flexCompanyFeePaid)
          : (amountCollectedFromCustomer - totalExpenses);

      salesTotal += safeProductPrice;
      expectedCollection += orderTotal;
      shippingExpenses += totalCarrierExpenses;
      productCostTotal += safeProductCost;
      flexFeesTotal += (o.flexShipFee || flexFeeValue);
      netProfitTotal += oProfit;

      if (o.status === 'تم_التحصيل' || o.status === 'تم_توصيلها') {
        successCount++;
      } else if (['مرتجع', 'فشل_التوصيل'].includes(o.status)) {
        returnCount++;
      }
    });

    const activeDeliveredOrReturned = successCount + returnCount;
    const returnRate = activeDeliveredOrReturned > 0 ? (returnCount / activeDeliveredOrReturned) * 100 : 0;

    return {
      salesTotal,
      expectedCollection,
      shippingExpenses,
      productCostTotal,
      flexFeesTotal,
      netProfitTotal,
      returnRate
    };
  }, [filteredOrders, settings]);

    const handleDeleteOrder = (deleteRelated?: boolean) => {
    if (!orderToDelete) {
        console.error("handleDeleteOrder called with no order to delete.");
        return;
    }
    
    // Logic for deleting related maintenance request...
    if (deleteRelated && orderToDelete.orderType === 'maintenance') {
        const maintenanceQuery = query(collection(db, 'maintenance_requests'), where("orderNumber", "==", orderToDelete.orderNumber));
        getDocs(maintenanceQuery).then(snapshot => {
            snapshot.forEach(doc => {
                deleteDoc(doc.ref);
            });
        }).catch(err => console.error("Error deleting maintenance request:", err));
    }
    
    const orderIdToDelete = orderToDelete.id;
    const orderNumberToDelete = orderToDelete.orderNumber;
    
    // Check if the deleted order indicates whether stock was deducted
    const isPos = orderToDelete.channel === 'pos' || orderToDelete.id.startsWith('POS-') || orderToDelete.shippingCompany === 'كاشير - بيع مباشر';
    const isStockDeducted = orderToDelete.stockDeducted || isPos;

    // Do not delete from partner transactions as per user request
    let updatedPartnerTransactions = [...(settings.partnerTransactions || [])];

    if (isStockDeducted) {
        // Return stock to inventory
        let updatedProducts = [...(settings.products || [])];
        (orderToDelete.items || []).forEach(orderItem => {
            const pIdx = updatedProducts.findIndex(p => p.id === orderItem.productId);
            if (pIdx > -1) {
                const prod = { ...updatedProducts[pIdx] };
                const newQty = (prod.stockQuantity || 0) + orderItem.quantity;
                
                // Return to warehouse stock
                let updatedWhStock = prod.warehouseStock ? { ...prod.warehouseStock } : {};
                const whId = orderToDelete.warehouseId || settings.warehouses?.find(w => w.isDefault)?.id;
                if (whId) {
                     updatedWhStock[whId] = (updatedWhStock[whId] || 0) + orderItem.quantity;
                }
                
                // Return variant stock if variantId is matched
                if (orderItem.variantId && prod.variants) {
                    prod.variants = prod.variants.map(v => {
                        if (v.id === orderItem.variantId) {
                            const vUpdated = { ...v };
                            vUpdated.stockQuantity = (vUpdated.stockQuantity || 0) + orderItem.quantity;
                            vUpdated.warehouseStock = vUpdated.warehouseStock ? { ...vUpdated.warehouseStock } : {};
                            if (whId) {
                                vUpdated.warehouseStock[whId] = (vUpdated.warehouseStock[whId] || 0) + orderItem.quantity;
                            }
                            return vUpdated;
                        }
                        return v;
                    });
                }
                
                updatedProducts[pIdx] = {
                    ...prod,
                    stockQuantity: newQty,
                    warehouseStock: updatedWhStock
                };
            }
        });
        
        // Remove from posSales as well if it was a POS order
        let updatedPosSales = settings.posSales || [];
        if (isPos) {
            updatedPosSales = (settings.posSales || []).filter(sale => sale.id !== orderIdToDelete);
        }
        
        setSettings(prev => ({
            ...prev,
            products: updatedProducts,
            posSales: updatedPosSales,
            partnerTransactions: updatedPartnerTransactions
        }));
    } else {
        let updatedPosSales = (settings.posSales || []).filter(sale => sale.id !== orderIdToDelete);
        setSettings(prev => ({
            ...prev,
            posSales: updatedPosSales,
            partnerTransactions: updatedPartnerTransactions
        }));
    }

    // Cascade delete from Treasury if treasury set_treasury is available
    if (setTreasury && treasury) {
       setTreasury((prev: any) => {
           if (!prev) return prev;
           const updatedTransactions = (prev.transactions || []).filter((tx: any) => {
               const desc = tx.description || '';
               const ref = tx.reference || '';
               const matchOrderNumber = orderNumberToDelete ? (desc.includes(`#${orderNumberToDelete}`) || ref.includes(orderNumberToDelete)) : false;
               const matchOrderId = orderIdToDelete ? (desc.includes(orderIdToDelete) || ref.includes(orderIdToDelete)) : false;
               return !(matchOrderNumber || matchOrderId);
           });
           return {
               ...prev,
               transactions: updatedTransactions
           };
       });
    }

    // Preserve the customer's current stats before deleting the order so we don't lose the success rate!
    if (setCustomers && orderToDelete) {
        setCustomers((prev: CustomerProfile[]) => {
            const cleanPhone = (orderToDelete.customerPhone || '').replace(/\s/g, '').replace('+2', '');
            if (!cleanPhone) return prev;
            
            // First, calculate the current customer stats from ALL existing orders (BEFORE DELETION)
            let currentTotal = 0;
            let currentSuccess = 0;
            let currentReturn = 0;
            let currentSpent = 0;
            
            orders.forEach(o => {
                const p = (o.customerPhone || '').replace(/\s/g, '').replace('+2', '');
                if (p === cleanPhone) {
                    currentTotal++;
                    if (['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'].includes(o.status)) {
                        currentSuccess++;
                        currentSpent += (o.productPrice + o.shippingFee) - (o.discount || 0);
                    } else if (['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)) {
                        currentReturn++;
                    }
                }
            });

            const existingIdx = prev.findIndex(c => c.phone && c.phone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
            if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    totalOrders: Math.max(updated[existingIdx].totalOrders || 0, currentTotal),
                    successfulOrders: Math.max(updated[existingIdx].successfulOrders || 0, currentSuccess),
                    returnedOrders: Math.max(updated[existingIdx].returnedOrders || 0, currentReturn),
                    totalSpent: Math.max(updated[existingIdx].totalSpent || 0, currentSpent),
                };
                return updated;
            } else {
                return [...prev, {
                    id: `cust-${Date.now()}`,
                    name: orderToDelete.customerName || '',
                    phone: orderToDelete.customerPhone || '',
                    address: orderToDelete.customerAddress || '',
                    totalOrders: currentTotal,
                    successfulOrders: currentSuccess,
                    returnedOrders: currentReturn,
                    totalSpent: currentSpent,
                    lastOrderDate: orderToDelete.date,
                    firstOrderDate: orderToDelete.date,
                    averageOrderValue: currentSuccess > 0 ? currentSpent / currentSuccess : 0,
                    loyaltyPoints: 0
                }];
            }
        });
    }
    
    // 1. Remove Order from the main orders list
    setOrders(prevOrders => prevOrders.filter(o => o.id !== orderIdToDelete));
    
    // 2. Remove associated transactions from Wallet
    setWallet(prevWallet => {
        // Ensure transactions is an array to prevent errors
        const currentTransactions = prevWallet.transactions || [];

        const updatedTransactions = currentTransactions.filter(t => {
            const note = t.note || '';
            const id = t.id || '';

            // Check if transaction is related by order number in note
            const relatedByNote = orderNumberToDelete ? note.includes(`#${orderNumberToDelete}`) : false;

            const relatedByField = t.orderId === orderIdToDelete;

            // Check if transaction is related by a conventional ID
            const relatedById = id.endsWith(`_${orderIdToDelete}`);

            // If it's related, we want to remove it, so we return false from filter
            return !(relatedByNote || relatedById || relatedByField);
        });

        // If nothing changed, return original wallet to avoid re-render
        if (updatedTransactions.length === currentTransactions.length) {
            return prevWallet;
        }

        return {
            ...prevWallet,
            transactions: updatedTransactions
        };
    });

    // 3. Close the confirmation modal
    setOrderToDelete(null);
  };

  const updateOrderField = (id: string, field: keyof Order, value: any) => {
    setOrders(prevOrders => prevOrders.map(o => o.id === id ? { ...o, [field]: value } : o));
  };
  
  const processFinancialsForStatusChange = (orderToUpdate: Order, newStatus: OrderStatus): { updatedOrderData: Order, newTransactions: Transaction[] } => {
    let updatedOrderData = { ...orderToUpdate, status: newStatus };
    const newTransactions: Transaction[] = [];
    const compFees = settings.companySpecificFees?.[orderToUpdate.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    
    if (newStatus === 'تم_الارسال' && !updatedOrderData.shippingAndInsuranceDeducted) {
        newTransactions.push({ 
            id: `ship_${orderToUpdate.id}`, 
            type: 'سحب', 
            amount: orderToUpdate.shippingFee, 
            date: new Date().toISOString(), 
            note: `إصدار بوليصة شحن أوردر #${orderToUpdate.orderNumber}`, 
            category: 'shipping', 
            status: 'completed',
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber
        });
        
        const insuranceRate = useCustom ? compFees!.insuranceFeePercent : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        let insuranceFee = 0;
        if (orderToUpdate.isInsured && insuranceRate > 0) {
            insuranceFee = calculateInsuranceFee(orderToUpdate, insuranceRate, settings);
            newTransactions.push({ 
                id: `insure_${orderToUpdate.id}`, 
                type: 'سحب', 
                amount: insuranceFee, 
                date: new Date().toISOString(), 
                note: `خصم رسوم تأمين أوردر #${orderToUpdate.orderNumber}`, 
                category: 'insurance', 
                status: 'completed',
                orderId: orderToUpdate.id,
                orderNumber: orderToUpdate.orderNumber
            });
        }

        const bostaVatAmount = calculateBostaVat(orderToUpdate, insuranceFee, settings);
        if (bostaVatAmount > 0) {
            const companySpecificVat = useCustom ? (compFees?.shippingVatRate ?? (isBosta(orderToUpdate.shippingCompany) ? 0.14 : 0)) : (settings?.shippingVatRate ?? (isBosta(orderToUpdate.shippingCompany) ? 0.14 : 0));
            const vatPercentageText = `${(companySpecificVat * 100).toFixed(0)}%`;
            newTransactions.push({ 
                id: `vat_${orderToUpdate.id}`, 
                type: 'سحب', 
                amount: bostaVatAmount, 
                date: new Date().toISOString(), 
                note: `خصم ضريبة القيمة المضافة لطلب شحن (${vatPercentageText}) #${orderToUpdate.orderNumber}`, 
                category: 'expense_other', 
                status: 'completed',
                orderId: orderToUpdate.id,
                orderNumber: orderToUpdate.orderNumber
            });
        }

        if (orderToUpdate.includeInspectionFee && !updatedOrderData.inspectionFeeDeducted) {
            const feeAmount = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
            if (feeAmount > 0) {
                newTransactions.push({ 
                    id: `insp_${orderToUpdate.id}`, 
                    type: 'سحب', 
                    amount: feeAmount, 
                    date: new Date().toISOString(), 
                    note: `خصم رسوم معاينة أوردر #${orderToUpdate.orderNumber}`, 
                    category: 'inspection', 
                    status: 'completed',
                    orderId: orderToUpdate.id,
                    orderNumber: orderToUpdate.orderNumber
                });
                updatedOrderData.inspectionFeeDeducted = true;
            }
        }
        updatedOrderData.shippingAndInsuranceDeducted = true;
    }
    
    if ((newStatus === 'مرتجع' || newStatus === 'فشل_التوصيل') && !updatedOrderData.returnFeeDeducted) {
        const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
        if (applyReturnFee) {
            const returnFeeAmount = useCustom ? compFees!.returnShippingFee : settings.returnShippingFee;
            if (returnFeeAmount > 0) {
                newTransactions.push({ 
                    id: `return_${orderToUpdate.id}`, 
                    type: 'سحب', 
                    amount: returnFeeAmount, 
                    date: new Date().toISOString(), 
                    note: `خصم مصاريف مرتجع أوردر #${orderToUpdate.orderNumber}`, 
                    category: 'return', 
                    status: 'completed',
                    orderId: orderToUpdate.id,
                    orderNumber: orderToUpdate.orderNumber
                });
                updatedOrderData.returnFeeDeducted = true;
            }
        }
    }

    if (['مرتجع', 'فشل_التوصيل'].includes(newStatus) && updatedOrderData.flexShipFeePaidByCustomer) {
        const flexShipFeeAmount = updatedOrderData.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0));
        if (flexShipFeeAmount > 0 && !orderToUpdate.flexShipFeePaidByCustomer) {
            newTransactions.push({
                id: `flexship_${orderToUpdate.id}`,
                type: 'إيداع',
                amount: flexShipFeeAmount,
                date: new Date().toISOString(),
                note: `تحصيل رسوم خدمة فليكس شيب أوردر #${orderToUpdate.orderNumber}`,
                category: 'collection',
                status: 'completed',
                orderId: orderToUpdate.id,
                orderNumber: orderToUpdate.orderNumber
            });
        }
    }
    
    // Handling reversal of collection if it was already processed
    if (orderToUpdate.collectionProcessed && newStatus !== 'تم_التحصيل') {
        const baseAmountToCollect = orderToUpdate.totalAmountOverride ?? (orderToUpdate.productPrice + orderToUpdate.shippingFee - (orderToUpdate.discount || 0));
        
        newTransactions.push({ 
            id: `revert_collect_${orderToUpdate.id}`, 
            type: 'سحب', 
            amount: baseAmountToCollect,
            date: new Date().toISOString(), 
            note: `عكس عملية تحصيل أوردر #${orderToUpdate.orderNumber} (تغيير الحالة)`, 
            category: 'collection',
            status: 'completed',
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber
        });

        updatedOrderData.collectionProcessed = false;
        updatedOrderData.paymentStatus = 'بانتظار الدفع';
    }

    // Handling reversal of shipping, vat, insurance, and inspection fees if transitioned back to pre-shipping status
    const preShippingStatuses = ['في_انتظار_المكالمة', 'جاري_المراجعة', 'قيد_التنفيذ', 'ملغي', 'مؤجل', 'مجدول'];
    if (orderToUpdate.shippingAndInsuranceDeducted && preShippingStatuses.includes(newStatus)) {
        // 1. Revert shipping fee
        newTransactions.push({ 
            id: `revert_ship_${orderToUpdate.id}`, 
            type: 'إيداع', 
            amount: orderToUpdate.shippingFee, 
            date: new Date().toISOString(), 
            note: `إعادة مصاريف شحن أوردر #${orderToUpdate.orderNumber} (تغيير الحالة إلى ${newStatus})`, 
            category: 'shipping', 
            status: 'completed',
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber
        });
        
        // 2. Revert insurance fee if any
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        let insuranceFee = 0;
        if (orderToUpdate.isInsured && insuranceRate > 0) {
            insuranceFee = calculateInsuranceFee(orderToUpdate, insuranceRate, settings);
            newTransactions.push({ 
                id: `revert_insure_${orderToUpdate.id}`, 
                type: 'إيداع', 
                amount: insuranceFee, 
                date: new Date().toISOString(), 
                note: `إعادة رسوم تأمين أوردر #${orderToUpdate.orderNumber} (تغيير الحالة)`, 
                category: 'insurance', 
                status: 'completed',
                orderId: orderToUpdate.id,
                orderNumber: orderToUpdate.orderNumber
            });
        }

        // 3. Revert VAT fee if any
        const bostaVatAmount = calculateBostaVat(orderToUpdate, insuranceFee, settings);
        if (bostaVatAmount > 0) {
            newTransactions.push({ 
                id: `revert_vat_${orderToUpdate.id}`, 
                type: 'إيداع', 
                amount: bostaVatAmount, 
                date: new Date().toISOString(), 
                note: `إعادة ضريبة القيمة المضافة لطلب شحن أوردر #${orderToUpdate.orderNumber}`, 
                category: 'expense_other', 
                status: 'completed',
                orderId: orderToUpdate.id,
                orderNumber: orderToUpdate.orderNumber
            });
        }

        // 4. Revert inspection fee if any
        if (orderToUpdate.includeInspectionFee && orderToUpdate.inspectionFeeDeducted) {
            const feeAmount = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
            if (feeAmount > 0) {
                newTransactions.push({ 
                    id: `revert_insp_${orderToUpdate.id}`, 
                    type: 'إيداع', 
                    amount: feeAmount, 
                    date: new Date().toISOString(), 
                    note: `إعادة رسوم معاينة أوردر #${orderToUpdate.orderNumber} (تغيير الحالة)`, 
                    category: 'inspection', 
                    status: 'completed',
                    orderId: orderToUpdate.id,
                    orderNumber: orderToUpdate.orderNumber
                });
            }
        }

        updatedOrderData.shippingAndInsuranceDeducted = false;
        updatedOrderData.inspectionFeeDeducted = false;
    }

    // Handling reversal of return shipping fee if moved out of return status
    if (orderToUpdate.returnFeeDeducted && !['مرتجع', 'فشل_التوصيل'].includes(newStatus)) {
        const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
        if (applyReturnFee) {
            const returnFeeAmount = useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee;
            if (returnFeeAmount > 0) {
                newTransactions.push({ 
                    id: `revert_return_${orderToUpdate.id}`, 
                    type: 'إيداع', 
                    amount: returnFeeAmount, 
                    date: new Date().toISOString(), 
                    note: `إعادة مصاريف مرتجع أوردر #${orderToUpdate.orderNumber} (تغيير الحالة إلى ${newStatus})`, 
                    category: 'return', 
                    status: 'completed',
                    orderId: orderToUpdate.id,
                    orderNumber: orderToUpdate.orderNumber
                });
                updatedOrderData.returnFeeDeducted = false;
            }
        }
    }
    
    if (newStatus === 'تم_توصيلها' && !updatedOrderData.collectionProcessed) {
        // Order delivered, now pending collection
        updatedOrderData.status = 'تم_توصيلها' as OrderStatus;
        updatedOrderData.paymentStatus = 'بانتظار الدفع';
    } else if (newStatus === 'تم_التحصيل' && !updatedOrderData.collectionProcessed) {
        // Order payment processed
        const baseAmountToCollect = updatedOrderData.totalAmountOverride ?? (updatedOrderData.productPrice + updatedOrderData.shippingFee - (updatedOrderData.discount || 0));
        
        newTransactions.push({ 
            id: `collect_${orderToUpdate.id}`, 
            type: 'إيداع', 
            amount: baseAmountToCollect, 
            date: new Date().toISOString(), 
            note: `رصيد من الدفع عند الاستلام أوردر #${orderToUpdate.orderNumber}`, 
            category: 'collection', 
            status: 'completed',
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber
        });
        
        updatedOrderData.collectionProcessed = true;
        updatedOrderData.paymentStatus = 'مدفوع';
        updatedOrderData.status = 'تم_التحصيل' as OrderStatus;
    } else {
        updatedOrderData.status = newStatus;
    }

    return { updatedOrderData, newTransactions };
    
  };

  const updateInventoryForOrder = (order: Order, newStatus: OrderStatus, currentProducts: Product[]): { updatedProducts: Product[], stockDeducted: boolean } => {
    const deductStatuses: OrderStatus[] = ['قيد_التنفيذ', 'تم_الارسال', 'تم_توصيلها'];
    // All other statuses are considered "returnable" to stock if they were deducted
    const shouldBeDeducted = deductStatuses.includes(newStatus);
    const isCurrentlyDeducted = order.stockDeducted || false;
    let updatedProducts = [...currentProducts];
    let newStockDeducted = isCurrentlyDeducted;

    if (shouldBeDeducted && !isCurrentlyDeducted) {
        (order.items || []).forEach(orderItem => {
            const pIdx = updatedProducts.findIndex(p => p.id === orderItem.productId);
            if (pIdx > -1) {
                const prod = updatedProducts[pIdx];
                const newQty = (prod.stockQuantity || 0) - orderItem.quantity;
                
                // Deduct from warehouse stock
                let updatedWhStock = prod.warehouseStock ? { ...prod.warehouseStock } : undefined;
                const whId = order.warehouseId || settings.warehouses?.find(w => w.isDefault)?.id;
                
                if (whId && updatedWhStock) {
                    updatedWhStock[whId] = (updatedWhStock[whId] || 0) - orderItem.quantity;
                }

                updatedProducts[pIdx] = {
                    ...prod,
                    stockQuantity: newQty,
                    warehouseStock: updatedWhStock
                };
            }
        });
        newStockDeducted = true;
    } else if (!shouldBeDeducted && isCurrentlyDeducted) {
        (order.items || []).forEach(orderItem => {
            const pIdx = updatedProducts.findIndex(p => p.id === orderItem.productId);
            if (pIdx > -1) {
                const prod = updatedProducts[pIdx];
                const newQty = (prod.stockQuantity || 0) + orderItem.quantity;

                // Return to warehouse stock
                let updatedWhStock = prod.warehouseStock ? { ...prod.warehouseStock } : undefined;
                const whId = order.warehouseId || settings.warehouses?.find(w => w.isDefault)?.id;
                
                if (whId && updatedWhStock) {
                    updatedWhStock[whId] = (updatedWhStock[whId] || 0) + orderItem.quantity;
                }

                updatedProducts[pIdx] = {
                    ...prod,
                    stockQuantity: newQty,
                    warehouseStock: updatedWhStock
                };
            }
        });
        newStockDeducted = false;
    }

    return { updatedProducts, stockDeducted: newStockDeducted };
  };

  const updateOrderStatus = async (id: string, newStatus: OrderStatus, forcePaidFlexShip?: boolean) => {
    const orderToUpdate = orders.find((o) => o.id === id);
    if (!orderToUpdate) return;

    if (newStatus === 'تم_الارسال' && !orderToUpdate.waybillNumber) {
        setOrderForWaybill({orderId: id, newStatus: newStatus});
        return;
    }

    const compSpecificFees = settings.companySpecificFees?.[orderToUpdate.shippingCompany];
    const useCustomFees = compSpecificFees?.useCustomFees ?? false;
    const isFlexShipEnabled = orderToUpdate.enableFlexShip !== undefined ? orderToUpdate.enableFlexShip : (useCustomFees ? (compSpecificFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false));
    const configuredFlexShipFee = orderToUpdate.flexShipFee !== undefined ? orderToUpdate.flexShipFee : (useCustomFees ? (compSpecificFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0));

    let isFlexShipPaid = false;
    if (['مرتجع', 'فشل_التوصيل'].includes(newStatus) && isFlexShipEnabled && configuredFlexShipFee > 0 && !orderToUpdate.flexShipFeePaidByCustomer && forcePaidFlexShip === undefined) {
        setPendingFlexShipConfirm({
            orderId: id,
            newStatus,
            fee: configuredFlexShipFee,
            companyName: orderToUpdate.shippingCompany || '',
            orderNumber: orderToUpdate.orderNumber
        });
        return;
    }

    if (forcePaidFlexShip !== undefined) {
        isFlexShipPaid = forcePaidFlexShip;
    }

    const orderWithFlexShip = {
        ...orderToUpdate,
        ...(isFlexShipPaid ? { 
            flexShipFeePaidByCustomer: true, 
            flexShipFee: orderToUpdate.flexShipFee !== undefined ? orderToUpdate.flexShipFee : configuredFlexShipFee,
            flexShipCompanyFee: orderToUpdate.flexShipCompanyFee !== undefined ? orderToUpdate.flexShipCompanyFee : (useCustomFees ? (compSpecificFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))
        } : {})
    };
    
    // 1. Sync Inventory
    const { updatedProducts, stockDeducted } = updateInventoryForOrder(orderWithFlexShip, newStatus, settings.products);
    if (stockDeducted !== orderToUpdate.stockDeducted) {
        setSettings(prev => ({ ...prev, products: updatedProducts }));
    }

    // 2. Update State
    const { updatedOrderData: financialUpdatedOrder, newTransactions } = processFinancialsForStatusChange(orderWithFlexShip, newStatus);
    const updatedOrderData = { ...financialUpdatedOrder, stockDeducted };

    if (newTransactions.length > 0) {
        setWallet(prev => {
            let newBalance = prev.balance || 0;
            newTransactions.forEach(t => {
                if (t.type === 'إيداع') newBalance += t.amount;
                else if (t.type === 'سحب') newBalance -= t.amount;
            });
            return {
                ...prev,
                balance: newBalance,
                transactions: [...newTransactions, ...prev.transactions]
            };
        });
    }
    
    setOrders(prevOrders => prevOrders.map(o => o.id === id ? updatedOrderData : o));
    addAuditLog(id, 'تغيير الحالة', `تغيير حالة الطلب من ${orderToUpdate.status} إلى ${newStatus}`);

    // Trigger WhatsApp notification prompt
    if (orderToUpdate.customerPhone && orderToUpdate.status !== newStatus) {
        setAutoWhatsappData({ order: updatedOrderData, newStatus });
    }

    // 3. Push to External Platform if Synced (Two-Way Sync)
    if (orderToUpdate.platform === 'wuilt' || orderToUpdate.source === 'synced') {
        try {
            const res = await fetch(`/api/sync/platform/wuilt/${orderToUpdate.store_id}/push-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: id,
                    newStatus: newStatus
                })
            });
            const result = await res.json();
            if (!res.ok) console.error("Failed to push status to Wuilt:", result);
            else console.log("Wuilt Sync Push Triggered:", result);
        } catch (e) {
            console.error("Two-way sync fetch error:", e);
        }
    }
  };

  const handleSaveWaybill = (waybill: string) => {
    if (!orderForWaybill || !waybill.trim()) return;
    const { orderId, newStatus } = orderForWaybill;
    
    const orderToUpdate = orders.find((o) => o.id === orderId);
    if (!orderToUpdate) return;
    
    const orderWithWaybill = { ...orderToUpdate, waybillNumber: waybill };
    
    // Inventory Sync for Waybill update too
    const { updatedProducts, stockDeducted } = updateInventoryForOrder(orderWithWaybill, newStatus, settings.products);
    if (stockDeducted !== orderToUpdate.stockDeducted) {
        setSettings(prev => ({ ...prev, products: updatedProducts }));
    }

    const { updatedOrderData: financialUpdatedOrder, newTransactions } = processFinancialsForStatusChange(orderWithWaybill, newStatus);
    const updatedOrderData = { ...financialUpdatedOrder, stockDeducted };
    
    if (newTransactions.length > 0) {
        setWallet(prev => {
            let newBalance = prev.balance || 0;
            newTransactions.forEach(t => {
                if (t.type === 'إيداع') newBalance += t.amount;
                else if (t.type === 'سحب') newBalance -= t.amount;
            });
            return {
                ...prev,
                balance: newBalance,
                transactions: [...newTransactions, ...prev.transactions]
            };
        });
    }
    
    setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? updatedOrderData : o));

    setOrderForWaybill(null);
    addAuditLog(orderId, 'إضافة بوليصة', `تم إضافة بوليصة رقم ${waybill} وتغيير الحالة إلى ${newStatus}`);
  };

  const handleToggleFlexShipPaid = (orderId: string) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;
    
    const compFees = settings.companySpecificFees?.[orderToUpdate.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const flexShipFeeAmount = orderToUpdate.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0));
    
    if (flexShipFeeAmount <= 0) return;
    
    const isCurrentlyPaid = !!orderToUpdate.flexShipFeePaidByCustomer;
    const isNowPaid = !isCurrentlyPaid;
    
    const newTransactions: Transaction[] = [];
    if (isNowPaid) {
        newTransactions.push({
            id: `flexship_${orderToUpdate.id}_${Date.now()}`,
            type: 'إيداع',
            amount: flexShipFeeAmount,
            date: new Date().toISOString(),
            note: `تحصيل رسوم خدمة فليكس شيب أوردر #${orderToUpdate.orderNumber}`,
            category: 'collection',
            status: 'completed',
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber
        });
    } else {
        newTransactions.push({
            id: `revert_flexship_${orderToUpdate.id}_${Date.now()}`,
            type: 'سحب',
            amount: flexShipFeeAmount,
            date: new Date().toISOString(),
            note: `عكس تحصيل رسوم فليكس شيب أوردر #${orderToUpdate.orderNumber} (رفض الدفع / إلغاء)`,
            category: 'collection',
            status: 'completed',
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber
        });
    }
    
    setWallet(prev => {
        let newBalance = prev.balance || 0;
        newTransactions.forEach(t => {
            if (t.type === 'إيداع') newBalance += t.amount;
            else if (t.type === 'سحب') newBalance -= t.amount;
        });
        return {
            ...prev,
            balance: newBalance,
            transactions: [...newTransactions, ...prev.transactions]
        };
    });
    
    const updatedOrderData = {
        ...orderToUpdate,
        flexShipFeePaidByCustomer: isNowPaid,
        flexShipFee: flexShipFeeAmount
    };
    
    setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? updatedOrderData : o));
    addAuditLog(orderId, 'تعديل رسوم الشحن', isNowPaid ? 'تم تسجيل سداد رسوم فليكس شيب من العميل' : 'تم تفريغ/إلغاء رسوم فليكس شيب بسبب رفض العميل الدفع');
  };


  const handleCollectAction = (order: Order, customerPaidInspection: boolean) => {
    if (order.status !== 'تم_توصيلها' || order.collectionProcessed) return;

    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const inspectionFee = useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);

    const newTransactions: Transaction[] = [];
    const baseAmountToCollect = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - order.discount);
    const totalCollected = baseAmountToCollect + (customerPaidInspection ? inspectionFee : 0);
    
    newTransactions.push({ 
        id: `collect_${order.id}`, 
        type: 'إيداع', 
        amount: totalCollected, 
        date: new Date().toISOString(), 
        note: `رصيد من الدفع عند الاستلام أوردر #${order.orderNumber}`, 
        category: 'collection', 
        status: 'completed',
        orderId: order.id,
        orderNumber: order.orderNumber
    });

    const codFee = calculateCodFee(order, settings);
    if (codFee > 0) {
        newTransactions.push({ 
            id: `cod_${order.id}`, 
            type: 'سحب', 
            amount: codFee, 
            date: new Date().toISOString(), 
            note: `خصم رسوم COD أوردر #${order.orderNumber}`, 
            category: 'cod', 
            status: 'completed',
            orderId: order.id,
            orderNumber: order.orderNumber
        });
    }
    
    const updatedOrderData = { ...order, status: 'تم_توصيلها' as OrderStatus, paymentStatus: 'مدفوع' as PaymentStatus, inspectionFeePaidByCustomer: customerPaidInspection, collectionProcessed: true };
    
    setWallet(prev => {
        let newBalance = prev.balance || 0;
        newTransactions.forEach(t => {
            if (t.type === 'إيداع') newBalance += t.amount;
            else if (t.type === 'سحب') newBalance -= t.amount;
        });
        return { 
            ...prev, 
            balance: newBalance,
            transactions: [...newTransactions, ...prev.transactions] 
        };
    });
    setOrders(prevOrders => prevOrders.map(o => (o.id === order.id ? updatedOrderData : o)));
    addLoyaltyPointsForOrder(updatedOrderData);
  };
  
  const handlePaymentStatusChange = (order: Order, newPaymentStatus: PaymentStatus) => {
    const updatedOrder = {...order, paymentStatus: newPaymentStatus};
    
    if (newPaymentStatus === 'مدفوع' && order.status === 'تم_توصيلها') {
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const inspectionFee = useCustom ? (compFees?.inspectionFee ?? settings.inspectionFee) : settings.inspectionFee;
        
        if (order.includeInspectionFee && inspectionFee && inspectionFee > 0) {
            setPendingInspectionConfirm({
                order,
                newPaymentStatus,
                inspectionFee
            });
        } else {
            handleCollectAction(updatedOrder, false);
        }
    } else {
        updateOrderField(order.id, 'paymentStatus', newPaymentStatus);
    }
    addAuditLog(order.id, 'تغيير حالة الدفع', `تغيير حالة الدفع إلى ${newPaymentStatus}`);
  };

    const handlePostCollectionReturn = (order: Order) => {
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;

        const shouldRefundProduct = useCustom ? (compFees.postCollectionReturnRefundsProductPrice ?? true) : true;
        const returnShippingFee = useCustom && compFees.enableFixedReturn ? compFees.returnShippingFee : (settings.enableReturnShipping ? settings.returnShippingFee : 0);
        const inspectionFee = useCustom ? compFees.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0);
            
        let confirmationMessage = `هل أنت متأكد من إرجاع الطلب #${order.orderNumber}؟\n`;
        const transactions: Transaction[] = [];

        if (shouldRefundProduct) {
            const returnAmount = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0));

            let inspectionFeeMessage = "";
            if (order.inspectionFeePaidByCustomer) {
                inspectionFeeMessage = `\nلن يتم إرجاع رسوم المعاينة (${inspectionFee} ج.م) لأنها غير قابلة للاسترداد.`;
            }
            
            confirmationMessage += `سيتم إرجاع مبلغ (${returnAmount.toLocaleString()} ج.م) للعميل وخصمه من المحفظة.${inspectionFeeMessage}`;
            transactions.push({ id: `post_return_refund_${order.id}`, type: 'سحب', amount: returnAmount, date: new Date().toISOString(), note: `إرجاع مبلغ للعميل بعد استلام الطلب #${order.orderNumber}`, category: 'return', status: 'completed' });
        } else {
            confirmationMessage += `لن يتم خصم قيمة المنتج من المحفظة حسب سياسة الشركة.`;
        }

        if (returnShippingFee > 0) {
            confirmationMessage += `\nسيتم خصم مصاريف شحن المرتجع (${returnShippingFee} ج.م).`;
            transactions.push({ id: `post_return_fee_${order.id}`, type: 'سحب', amount: returnShippingFee, date: new Date().toISOString(), note: `مصاريف شحن مرتجع بعد الاستلام للطلب #${order.orderNumber}`, category: 'return', status: 'completed' });
        }

    const confirmCollectionReturn = () => {
        confirmAction({
            title: 'إرجاع بعد الاستلام',
            message: confirmationMessage,
            type: 'warning',
            confirmText: 'تأكيد الإرجاع',
            onConfirm: () => {
                if (transactions.length > 0) {
                    setWallet(prev => {
                        let newBalance = prev.balance || 0;
                        transactions.forEach(t => {
                            if (t.type === 'إيداع') newBalance += t.amount;
                            else if (t.type === 'سحب') newBalance -= t.amount;
                        });
                        return {
                            ...prev,
                            balance: newBalance,
                            transactions: [...transactions, ...prev.transactions]
                        };
                    });
                }

                // Return Stock
                const { updatedProducts, stockDeducted } = updateInventoryForOrder(order, 'مرتجع_بعد_الاستلام' as OrderStatus, settings.products);
                if (stockDeducted !== order.stockDeducted) {
                    setSettings(prev => ({ ...prev, products: updatedProducts }));
                }

                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'مرتجع_بعد_الاستلام', stockDeducted } : o));
                setConfirmation(prev => ({ ...prev, isOpen: false }));
                addAuditLog(order.id, 'إرجاع بعد الاستلام', 'تم إرجاع الطلب وإعادة المخزون');
            }
        });
    };

    confirmCollectionReturn();
  };

    const handleStartExchange = (originalOrder: Order) => {
        const creditAmount = originalOrder.totalAmountOverride ?? (originalOrder.productPrice + originalOrder.shippingFee - (originalOrder.discount || 0));
        navigate('/orders/new', { 
            state: { 
                exchangeData: {
                    customerName: originalOrder.customerName,
                    customerPhone: originalOrder.customerPhone,
                    customerAddress: originalOrder.customerAddress,
                    shippingCompany: originalOrder.shippingCompany,
                    shippingArea: originalOrder.shippingArea,
                    orderType: 'exchange',
                    originalOrderId: originalOrder.id,
                    creditAmount: creditAmount,
                }
            } 
        });
    };

  const handlePrintInvoice = (order: Order) => {
    const html = generateInvoiceHTML(order, settings, activeStore?.name || 'متجري');
    printHTMLDirectly(html);
  };

  const handlePrintShippingLabel = (order: Order) => {
    if (!activeStore) {
        alert("لا يمكن طباعة البوليصة: اسم المتجر غير معروف.");
        return;
    }
    const html = generateShippingLabelHTML(order, activeStore.name);
    printHTMLDirectly(html);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedOrders(paginatedOrders.map(o => o.id));
      } else {
          setSelectedOrders([]);
      }
  };


  const handleSelectRow = (id: string) => {
      setSelectedOrders(prev => prev.includes(id) ? prev.filter(oId => oId !== id) : [...prev, id]);
  };
  
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const confirmAction = (config: Omit<typeof confirmation, 'isOpen'>) => {
    setConfirmation({ ...config, isOpen: true });
  };

  const handleBulkDelete = () => {
    if (selectedOrders.length === 0) return;
    confirmAction({
        title: 'حذف حماعي',
        message: `هل أنت متأكد من حذف ${selectedOrders.length} طلبات نهائياً؟ هذا الإجراء سيقوم بإزالة بياناتهم تماماً من النظام.`,
        type: 'danger',
        confirmText: 'حذف نهائي',
        onConfirm: () => {
            let updatedProducts = [...(settings.products || [])];
            let listChanged = false;
            let updatedPosSales = [...(settings.posSales || [])];
            let posSalesChanged = false;
            
            const ordersBeingDeleted = orders.filter(o => selectedOrders.includes(o.id));
            
            ordersBeingDeleted.forEach(orderToDelete => {
                const isPos = orderToDelete.channel === 'pos' || orderToDelete.id.startsWith('POS-') || orderToDelete.shippingCompany === 'كاشير - بيع مباشر';
                const isStockDeducted = orderToDelete.stockDeducted || isPos;
                
                if (isStockDeducted) {
                    listChanged = true;
                    (orderToDelete.items || []).forEach(orderItem => {
                        const pIdx = updatedProducts.findIndex(p => p.id === orderItem.productId);
                        if (pIdx > -1) {
                            const prod = { ...updatedProducts[pIdx] };
                            const newQty = (prod.stockQuantity || 0) + orderItem.quantity;
                            
                            // Return to warehouse stock
                            let updatedWhStock = prod.warehouseStock ? { ...prod.warehouseStock } : {};
                            const whId = orderToDelete.warehouseId || settings.warehouses?.find(w => w.isDefault)?.id;
                            if (whId) {
                                updatedWhStock[whId] = (updatedWhStock[whId] || 0) + orderItem.quantity;
                            }
                            
                            // Return variant stock if variantId is matched
                            if (orderItem.variantId && prod.variants) {
                                prod.variants = prod.variants.map(v => {
                                    if (v.id === orderItem.variantId) {
                                        const vUpdated = { ...v };
                                        vUpdated.stockQuantity = (vUpdated.stockQuantity || 0) + orderItem.quantity;
                                        vUpdated.warehouseStock = vUpdated.warehouseStock ? { ...vUpdated.warehouseStock } : {};
                                        if (whId) {
                                            vUpdated.warehouseStock[whId] = (vUpdated.warehouseStock[whId] || 0) + orderItem.quantity;
                                        }
                                        return vUpdated;
                                    }
                                    return v;
                                });
                            }
                            
                            updatedProducts[pIdx] = {
                                ...prod,
                                stockQuantity: newQty,
                                warehouseStock: updatedWhStock
                            };
                        }
                    });
                }
                
                if (isPos) {
                    const originalLength = updatedPosSales.length;
                    updatedPosSales = updatedPosSales.filter(sale => sale.id !== orderToDelete.id);
                    if (updatedPosSales.length !== originalLength) {
                        posSalesChanged = true;
                    }
                }
            });
            
            // Keep partner transactions intact as per user request
            let updatedPartnerTransactions = [...(settings.partnerTransactions || [])];

            setSettings(prev => ({
                ...prev,
                products: updatedProducts,
                posSales: updatedPosSales,
                partnerTransactions: updatedPartnerTransactions
            }));

            // Cascade delete from Wallet
            setWallet(prevWallet => {
                const currentTransactions = prevWallet.transactions || [];
                const updatedTransactions = currentTransactions.filter(t => {
                    const note = t.note || '';
                    const id = t.id || '';
                    
                    const isRelated = ordersBeingDeleted.some(orderToDelete => {
                        const orderIdToDelete = orderToDelete.id;
                        const orderNumberToDelete = orderToDelete.orderNumber;
                        const relatedByNote = orderNumberToDelete ? note.includes(`#${orderNumberToDelete}`) : false;
                        const relatedByField = t.orderId === orderIdToDelete;
                        const relatedById = id.endsWith(`_${orderIdToDelete}`);
                        return relatedByNote || relatedByField || relatedById;
                    });
                    
                    return !isRelated;
                });
                return {
                    ...prevWallet,
                    transactions: updatedTransactions
                };
            });

            // Cascade delete from Treasury
            if (setTreasury && treasury) {
               setTreasury((prev: any) => {
                   if (!prev) return prev;
                   let txs = [...(prev.transactions || [])];
                   ordersBeingDeleted.forEach(orderToDelete => {
                       const orderIdToDelete = orderToDelete.id;
                       const orderNumberToDelete = orderToDelete.orderNumber;
                       txs = txs.filter((tx: any) => {
                           const desc = tx.description || '';
                           const ref = tx.reference || '';
                           const matchOrderNumber = orderNumberToDelete ? (desc.includes(`#${orderNumberToDelete}`) || ref.includes(orderNumberToDelete)) : false;
                           const matchOrderId = orderIdToDelete ? (desc.includes(orderIdToDelete) || ref.includes(orderIdToDelete)) : false;
                           return !(matchOrderNumber || matchOrderId);
                       });
                   });
                   return {
                       ...prev,
                       transactions: txs
                   };
               });
            }

            setOrders(prevOrders => prevOrders.filter(o => !selectedOrders.includes(o.id)));
            setSelectedOrders([]);
            setConfirmation(prev => ({ ...prev, isOpen: false }));
        }
    });
  };

  const handleBulkStatusChange = (newStatus: string) => {
    const selectElement = document.getElementById('bulk-status-select') as HTMLSelectElement;
    if (!newStatus || newStatus === "default") {
        if(selectElement) selectElement.value = 'default';
        return;
    }
    
    confirmAction({
        title: 'تغيير الحالة جماعياً',
        message: `هل أنت متأكد من تغيير حالة ${selectedOrders.length} طلبات إلى "${newStatus.replace(/_/g, ' ')}"?`,
        type: 'warning',
        confirmText: 'تأكيد التغيير',
        onConfirm: () => {
            const allNewTransactions: Transaction[] = [];
            let currentProducts = [...settings.products];
            const updatedOrders = orders.map(o => {
                if (selectedOrders.includes(o.id)) {
                    // 1. Inventory Sync
                    const { updatedProducts: nextProducts, stockDeducted } = updateInventoryForOrder(o, newStatus as OrderStatus, currentProducts);
                    currentProducts = nextProducts;

                    // 2. Create a copy to avoid side effects during financial processing
                    let orderToUpdate: Order = { ...o, status: newStatus as OrderStatus, stockDeducted };
                    
                    // 3. Add Audit Log
                    const newLog: AuditLog = {
                        id: `log_bulk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        action: 'تغيير الحالة (جماعي)',
                        details: `تم تغيير حالة الطلب من ${o.status.replace(/_/g, ' ')} إلى ${newStatus.replace(/_/g, ' ')} خلال عملية تحديث جماعية`,
                        timestamp: new Date().toISOString(),
                        userEmail: currentUser?.email || 'موظف'
                    };
                    orderToUpdate.auditLogs = [...(o.auditLogs || []), newLog];
                    
                    // Financial logic consolidated from processFinancialsForStatusChange
                    const { updatedOrderData, newTransactions } = processFinancialsForStatusChange(orderToUpdate, newStatus as OrderStatus);
                    orderToUpdate = updatedOrderData;
                    allNewTransactions.push(...newTransactions);

                    return orderToUpdate;
                }
                return o;
            });

            // Update Both states once
            if (allNewTransactions.length > 0) {
                setWallet(prev => {
                    let newBalance = prev.balance || 0;
                    allNewTransactions.forEach(t => {
                        if (t.type === 'إيداع') newBalance += t.amount;
                        else if (t.type === 'سحب') newBalance -= t.amount;
                    });
                    return { ...prev, balance: newBalance, transactions: [...allNewTransactions, ...prev.transactions] };
                });
            }
            setSettings(prev => ({ ...prev, products: currentProducts }));
            setOrders(updatedOrders);

            setSelectedOrders([]);
            if(selectElement) selectElement.value = 'default';
            setConfirmation(prev => ({ ...prev, isOpen: false }));
        }
    });
  };


  const handleBulkPrintLabels = () => {
    const selected = orders.filter(o => selectedOrders.includes(o.id));
    if (selected.length === 0) return;
    
    const html = selected.map(o => generateShippingLabelHTML(o, activeStore?.name || 'متجري')).join('<div style="page-break-after: always;"></div>');
    printHTMLDirectly(`<html><head><title>طباعة بوالص</title></head><body>${html}</body></html>`);
  };

  const handleExportCSV = () => {
    const headers = ['رقم الطلب', 'رقم البوليصة', 'العميل', 'الهاتف', 'المحافظة', 'المدينة', 'المنتجات', 'الإجمالي', 'الحالة', 'التاريخ'];
    const rows = filteredOrders.map(o => [ 
        o.orderNumber, 
        o.waybillNumber || '-', 
        o.customerName, 
        o.customerPhone, 
        o.governorate || o.shippingArea, 
        o.city || '-',
        o.items.map(i => `${i.name} (x${i.quantity})`).join(' | '), 
        o.totalAmountOverride ?? (o.productPrice + o.shippingFee - (o.discount || 0)), 
        o.status, 
        new Date(o.date).toLocaleDateString('ar-EG') 
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportOrders = () => {
    const storeName = activeStore?.name || 'متجري';
    const html = generateOrdersReportHTML(filteredOrders, settings, storeName);
    setReportPreviewHtml(html);
  };

  const handleExportPDF = () => {
    const storeName = activeStore?.name || 'متجري';
    const html = generateOrdersReportHTML(filteredOrders, settings, storeName);
    setReportPreviewHtml(html);
  };

  const handleAutoAssign = () => {
    const activeEmployees = settings.employees?.filter(e => e.status === 'active' || !e.status) || [];
    if (activeEmployees.length === 0) {
      confirmAction({
         title: "تنبيه",
         message: "لا يوجد موظفين نشطين متاحين للتوزيع. يرجى تفعيل موظف واحد على الأقل في الإعدادات.",
         type: "warning",
         onConfirm: () => {}
      });
      return;
    }
    const unassignedOrders = orders.filter(o => !o.assignedTo && o.status === 'في_انتظار_المكالمة');
    if (unassignedOrders.length === 0) {
      confirmAction({
         title: "تنبيه",
         message: "لا توجد طلبات غير معينة في حالة انتظار المكالمة لتوزيعها.",
         type: "info",
         onConfirm: () => {}
      });
      return;
    }
    
    confirmAction({
      title: "توزيع الطلبات تلقائياً",
      message: `سيتم توزيع ${unassignedOrders.length} طلب على ${activeEmployees.length} موظف دليفري/اتصالات نشطين بالتساوي. هل تريد الاستمرار بالفعل؟`,
      type: "info",
      confirmText: "تأكيد وتوزيع الآن",
      onConfirm: () => {
        let empIndex = 0;
        setOrders(prev => prev.map(o => {
          if (!o.assignedTo && o.status === 'في_انتظار_المكالمة') {
            const emp = activeEmployees[empIndex];
            empIndex = (empIndex + 1) % activeEmployees.length;
            return {
              ...o,
              assignedTo: emp.phone || emp.id,
              assignedToName: emp.name
            };
          }
          return o;
        }));
      }
    });
  };

  const getWhatsAppLink = (order: Order) => {
      let msg = '';
      const name = (order.customerName || '').split(' ')[0];
      switch(order.status) {
          case 'جاري_المراجعة': msg = `أهلاً بك يا ${name} 👋، بنأكد مع حضرتك طلبك (${order.productName}) من متجرنا. العنوان: ${order.customerAddress}. هل البيانات صحيحة؟`; break;
          case 'قيد_التنفيذ': msg = `يا ${name}، طلبك قيد التجهيز حالياً وهيسلم لشركة الشحن قريباً.`; break;
          case 'تم_الارسال': msg = `مرحباً ${name}، تم شحن طلبك ورقم البوليصة هو ${order.waybillNumber || order.orderNumber}.`; break;
          case 'فشل_التوصيل': msg = `يا ${name}، المندوب حاول يوصلك النهاردة وماعرفش. ياريت ترد عليه أو تأكد معانا ميعاد تاني.`; break;
          default: msg = `أهلاً ${name}، بخصوص طلبك رقم ${order.orderNumber}...`;
      }
      let phone = (order.customerPhone || '').replace(/\D/g, '');
      if (phone.startsWith('0')) {
          phone = '20' + phone.substring(1);
      } else if (phone.length === 10 && !phone.startsWith('0')) {
          phone = '20' + phone;
      }
      return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const quickStats = useMemo(() => {
    const nonArchivedOrders = orders.filter(o => o.status !== 'مؤرشف');
    return {
      awaitingWaybill: nonArchivedOrders.filter(o => o.status === 'جاري_المراجعة').length,
      onTheWay: nonArchivedOrders.filter(o => o.status === 'تم_الارسال').length,
      delivered: nonArchivedOrders.filter(o => o.status === 'تم_التحصيل').length,
      failed: nonArchivedOrders.filter(o => ['مرتجع', 'فشل_التوصيل'].includes(o.status)).length,
      canceled: nonArchivedOrders.filter(o => o.status === 'ملغي').length,
    };
  }, [orders]);

  const orderForModal = useMemo(() => {
    if (!orderForWaybill) return null;
    return orders.find(o => o.id === orderForWaybill.orderId);
  }, [orderForWaybill, orders]);

  return (
    <motion.div 
      className="space-y-8 pb-20"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800" dir="rtl">
        <div className="flex items-center justify-between w-full lg:w-auto shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">نظام الطلبات واللوجستيات المركزي</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                سجل الطلبات المركزي
              </h1>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleManualRefresh}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm cursor-pointer ${isRefreshing ? 'animate-spin text-indigo-600 border-indigo-200' : ''}`}
                title="مزامنة الطلبات"
              >
                <RefreshCcw size={18} />
                <span className="text-xs font-black uppercase tracking-tight">مزامنة سحابية</span>
              </motion.button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black border border-indigo-100 dark:border-indigo-900/30">
                {filteredOrders.length} طلب نشط
              </div>
              <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black border border-emerald-100 dark:border-emerald-900/30">
                المتجر النشط: {activeStore?.id}
              </div>
            </div>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`${storePrefix}/orders/new`)}
            className="lg:hidden bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center shrink-0"
          >
            <Plus size={24} />
          </motion.button>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 lg:pb-0 px-1">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
            {[
                { id: 'list', icon: LayoutList },
                { id: 'kanban', icon: LayoutGrid }
            ].map(mode => (
                <button 
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as any)}
                  className={`p-2.5 rounded-xl transition-all ${viewMode === mode.id ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <mode.icon size={20} />
                </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
              <button 
                onClick={handleAutoAssign}
                className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-all shadow-sm"
                title="توزيع الطلبات"
              >
                <Users size={20} />
              </button>

              <button 
                onClick={handleExportPDF}
                className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-all shadow-sm"
                title="تصدير PDF"
              >
                <FileText size={20} />
              </button>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`${storePrefix}/orders/new`)}
            className="hidden lg:flex bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black shadow-xl shadow-indigo-500/25 transition-all items-center gap-3 text-sm shrink-0"
          >
            <Plus size={20} />
            <span>طلب جديد</span>
          </motion.button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'بانتظار المراجعة', count: quickStats.awaitingWaybill, icon: FileSearch, color: 'indigo', targetTab: 'جاري_المراجعة', isSelected: activeTab === 'جاري_المراجعة', hideOnMobile: false },
          { label: 'قيد الشحن', count: quickStats.onTheWay, icon: Truck, color: 'blue', targetTab: 'تم_الارسال', isSelected: activeTab === 'تم_الارسال', hideOnMobile: false },
          { label: 'تم التوصيل', count: quickStats.delivered, icon: CheckCircle, color: 'emerald', targetTab: 'تم_التحصيل', isSelected: activeTab === 'تم_التحصيل', hideOnMobile: false },
          { label: 'مرتجع / فشل', count: quickStats.failed, icon: XCircle, color: 'rose', targetTab: 'مرتجع', isSelected: ['مرتجع', 'فشل_التوصيل'].includes(activeTab), hideOnMobile: false },
          { label: 'طلبات ملغاة', count: quickStats.canceled, icon: Trash2, color: 'slate', targetTab: 'ملغي', isSelected: activeTab === 'ملغي', hideOnMobile: true },
        ].map((stat, idx) => (
          <div 
            key={idx} 
            onClick={() => {
              if (stat.isSelected) {
                setActiveTab('الجميع');
              } else {
                setActiveTab(stat.targetTab);
              }
            }}
            className={`cursor-pointer select-none active:scale-[0.98] bg-white dark:bg-slate-900 p-5 rounded-[2rem] border transition-all flex flex-col justify-between group ${
              stat.isSelected 
                ? `border-indigo-600 dark:border-indigo-500 ring-4 ring-indigo-500/10 shadow-md` 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow-md'
            } ${stat.hideOnMobile ? 'hidden lg:flex' : 'flex'}`}
          >
            <div className="flex items-start justify-between">
                <div className={`p-3 bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400 rounded-2xl group-hover:scale-110 transition-transform`}>
                    <stat.icon size={22} />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums leading-none">{stat.count}</p>
                </div>
            </div>
            {/* Minimal Trend or Sparkline mockup */}
            <div className="mt-6 flex items-end gap-1 h-4">
                {[40, 70, 45, 90, 35, 60].map((h, i) => (
                    <div key={i} className={`flex-1 rounded-full bg-${stat.color}-500/10 dark:bg-${stat.color}-500/20 overflow-hidden`}>
                        <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ delay: 0.1 + (i * 0.05) }}
                            className={`w-full bg-${stat.color}-500/40`}
                        />
                    </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Filter Analytics Hub Option Trigger */}
      <div className="w-full">
         <div 
           onClick={() => setShowAnalyticsHub(!showAnalyticsHub)}
           className="flex justify-between items-center text-right bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/15 dark:border-indigo-500/10 rounded-2xl p-3 px-5 cursor-pointer transition-all select-none"
         >
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex-row-reverse">
               <Sparkles size={14} className="animate-pulse" />
               <span>اضغط لعرض التحليلات والتقارير المالية التفاعلية ({filteredOrders.length} طلب معروض حالياً)</span>
            </div>
            <div className="text-slate-400 dark:text-slate-600">
               <ChevronDown size={16} className={`transform transition-transform duration-200 ${showAnalyticsHub ? 'rotate-180' : ''}`} />
            </div>
         </div>

         <AnimatePresence>
            {showAnalyticsHub && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3"
              >
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 space-y-4 text-right">
                      <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-slate-800 pb-3">
                          <span className="text-xs text-slate-400 font-bold">مبني بالاعتماد على المدخلات وخيارات التصفية النشطة</span>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5 flex-row-reverse">
                             <Coins className="text-indigo-600" size={16} /> ملخص الحسابات المالية الحقيقية
                          </h4>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-right">
                          
                          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                              <p className="text-[10px] text-slate-400 font-bold mb-1">إجمالي المبيعات المفلترة</p>
                              <p className="text-lg font-black text-slate-800 dark:text-white tabular-nums">{filteredMetrics.salesTotal.toLocaleString()} ج.م</p>
                              <div className="w-full bg-slate-150 dark:bg-slate-850 h-[3px] rounded-full mt-2.5 overflow-hidden">
                                  <div className="bg-emerald-500 h-full w-[80%]" />
                              </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                              <p className="text-[10px] text-slate-400 font-bold mb-1">المطلوب تحصيله</p>
                              <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{filteredMetrics.expectedCollection.toLocaleString()} ج.م</p>
                              <div className="w-full bg-slate-150 dark:bg-slate-850 h-[3px] rounded-full mt-2.5 overflow-hidden">
                                  <div className="bg-indigo-500 h-full w-[65%]" />
                              </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                              <p className="text-[10px] text-slate-400 font-bold mb-1">تقدير رسوم الشحن والتأمين</p>
                              <p className="text-lg font-black text-slate-850 dark:text-slate-200 tabular-nums">{filteredMetrics.shippingExpenses.toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</p>
                              <div className="w-full bg-slate-150 dark:bg-slate-850 h-[3px] rounded-full mt-2.5 overflow-hidden">
                                  <div className="bg-amber-500 h-full w-[45%]" />
                              </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                              <p className="text-[10px] text-slate-400 font-bold mb-1">صافي الأرباح المتوقعة</p>
                              <p className={`text-lg font-black tabular-nums ${filteredMetrics.netProfitTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                                 {filteredMetrics.netProfitTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م
                              </p>
                              <div className="w-full bg-slate-150 dark:bg-slate-850 h-[3px] rounded-full mt-2.5 overflow-hidden">
                                  <div className={`h-full ${filteredMetrics.netProfitTotal >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} w-[75%]`} />
                              </div>
                          </div>

                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pt-2">
                          <div className="bg-white dark:bg-slate-900/80 p-3 px-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center flex-row-reverse text-slate-600 dark:text-slate-350">
                              <span className="font-bold flex items-center gap-1.5 flex-row-reverse">
                                 <Percent size={14} className="text-rose-500" />
                                 معدل مرتجعات المفلتر (الفعلية)
                              </span>
                              <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">{filteredMetrics.returnRate.toFixed(1)}%</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900/80 p-3 px-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center flex-row-reverse text-slate-600 dark:text-slate-350">
                              <span className="font-bold flex items-center gap-1.5 flex-row-reverse">
                                 <Briefcase size={14} className="text-slate-400" />
                                 متوسط تكلفة البضائع المعروضة
                              </span>
                              <span className="font-black text-slate-700 dark:text-slate-300 tabular-nums">{filteredMetrics.productCostTotal.toLocaleString()} ج.م</span>
                          </div>
                      </div>
                  </div>
              </motion.div>
            )}
         </AnimatePresence>
      </div>

      {/* Floating Filter Hub */}
      <div className="sticky top-4 z-40 px-4 md:px-0">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-2 rounded-[2.5rem] shadow-2xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex flex-row-reverse items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-[2rem] overflow-x-auto no-scrollbar scroll-smooth">
                {['الجميع', 'في_انتظار_المكالمة', 'جاري_المراجعة', 'قيد_التنفيذ', 'تم_الارسال', 'تم_التحصيل', 'مرتجع', 'فشل_التوصيل', 'ملغي', 'مؤرشف'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-2.5 rounded-[1.5rem] text-[11px] font-black transition-all whitespace-nowrap ${
                      activeTab === tab 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 p-1">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="ابحث عن عميل، رقم طلب، أو تفاصيل..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-12 pl-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] text-xs font-bold focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-200 transition-all outline-none dark:text-white"
                  />
                </div>
                <button 
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`p-3.5 rounded-[1.5rem] border transition-all shrink-0 ${
                    showAdvancedFilters 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={20} />
                </button>
              </div>
          </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'المحافظة', element: (
                    <select 
                        value={filterGov}
                        onChange={(e) => setFilterGov(e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-right"
                    >
                        <option value="">كل المحافظات</option>
                        {EGYPT_GOVERNORATES.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                    </select>
                  )},
                  { label: 'شركة الشحن', element: (
                    <select 
                        value={filterCompany}
                        onChange={(e) => setFilterCompany(e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-right"
                    >
                        <option value="">كل الشركات</option>
                        {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )},
                  { label: 'تاريخ البداية', element: (
                    <input 
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-right"
                    />
                  )},
                  { label: 'تاريخ النهاية', element: (
                    <input 
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-right"
                    />
                  )}
                ].map((field, i) => (
                    <div key={i} className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{field.label}</p>
                        {field.element}
                    </div>
                ))}
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      {selectedOrders.length > 0 && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-8"
        >
          <span className="text-sm font-bold whitespace-nowrap">تم تحديد {selectedOrders.length} طلب</span>
          <div className="h-6 w-[1px] bg-white/20" />
          <div className="flex items-center gap-4">
            <select 
              id="bulk-status-select"
              onChange={(e) => handleBulkStatusChange(e.target.value)}
              className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
            >
              <option value="default">تغيير الحالة لـ...</option>
              {ORDER_STATUSES.map(s => <option key={s} value={s} className="text-slate-900">{ORDER_STATUS_METADATA[s]?.label || s}</option>)}
            </select>
            <button 
              onClick={() => handleBulkStatusChange('مؤرشف')} 
              className="px-3 py-1 flex items-center gap-1 hover:text-amber-500 transition-colors bg-white/10 rounded-lg text-xs"
              title="أرشفة المحددة"
            >
              <Archive size={16} /> أرشفة
            </button>
            <button 
              onClick={() => handleBulkStatusChange('ملغي')} 
              className="px-3 py-1 flex items-center gap-1 hover:text-red-500 transition-colors bg-white/10 rounded-lg text-xs"
              title="إلغاء المحددة"
            >
              <XCircle size={16} /> إلغاء
            </button>
            <button onClick={handleBulkPrintLabels} className="hover:text-primary transition-colors"><Printer size={20}/></button>
            <button onClick={handleBulkDelete} className="hover:text-rose-500 transition-colors"><Trash2 size={20}/></button>
          </div>
          <button onClick={() => setSelectedOrders([])} className="p-1 hover:bg-white/10 rounded-full"><X size={18}/></button>
        </motion.div>
      )}

      {/* Orders View */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          {/* Table for Desktop */}
          <div className="overflow-x-auto hidden lg:block glass-card rounded-[32px] border-none">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-widest font-black border-b border-slate-200/50 dark:border-slate-700/50">
                <tr>
                  <th className="p-6 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-lg border-slate-300 dark:bg-slate-900 dark:border-slate-700 text-primary focus:ring-primary/20" 
                      onChange={handleSelectAll} 
                      checked={selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0}
                    />
                  </th>
                  <th className="p-6">الطلب والعميل</th>
                  <th className="p-6">المنتجات</th>
                  <th className="p-6">مبلغ التحصيل</th>
                  <th className="p-6">رسوم فليكس شيب</th>
                  <th className="p-6">الحالة</th>
                  <th className="p-6">المحاولات</th>
                  <th className="p-6">حالة المبلغ المحصل</th>
                  <th className="p-6 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {paginatedOrders.map(order => (
                  <OrderRow 
                    key={order.id} 
                    order={order} 
                    isSelected={selectedOrders.includes(order.id)}
                    onSelect={() => handleSelectRow(order.id)}
                    onStatusChange={(status) => updateOrderStatus(order.id, status)}
                    onPaymentChange={(status) => handlePaymentStatusChange(order, status)}
                    onEdit={() => handleEditOrder(order)}
                    onDelete={() => setOrderToDelete(order)}
                    onPrintInvoice={() => handlePrintInvoice(order)}
                    onPrintLabel={() => handlePrintShippingLabel(order)}
                    onCollect={(inspectionPaid) => handleCollectAction(order, inspectionPaid)}
                    onStartExchange={() => handleStartExchange(order)}
                    onPostReturn={() => handlePostCollectionReturn(order)}
                    onShowSummary={() => setShowSummaryModal(order)}
                    onShowAudit={() => setShowAuditLog(order)}
                    onShowAssignment={() => setShowAssignment(order)}
                    onShowDetails={() => setShowDetailsModal(order)}
                    onToggleFlexShipPaid={() => handleToggleFlexShipPaid(order.id)}
                    whatsappLink={getWhatsAppLink(order)}
                    settings={settings}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Cards for Mobile/Tablet */}
          <div className="lg:hidden flex items-center justify-between mb-4 px-2">
             <span className="text-xs font-black text-slate-500 uppercase tracking-widest">قائمة الطلبات ({paginatedOrders.length})</span>
             <button 
                onClick={() => {
                   if (selectedOrders.length === paginatedOrders.length) {
                      setSelectedOrders([]);
                   } else {
                      setSelectedOrders(paginatedOrders.map(o => o.id));
                   }
                }}
                className="text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-lg"
             >
                {selectedOrders.length === paginatedOrders.length ? 'إلغاء التحديد' : 'تحديد الكل'}
             </button>
          </div>
          <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginatedOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                isSelected={selectedOrders.includes(order.id)}
                onSelect={() => handleSelectRow(order.id)}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
                onPaymentChange={(status) => handlePaymentStatusChange(order, status)}
                onEdit={() => handleEditOrder(order)}
                onDelete={() => setOrderToDelete(order)}
                onPrintInvoice={() => handlePrintInvoice(order)}
                onPrintLabel={() => handlePrintShippingLabel(order)}
                onCollect={(inspectionPaid) => handleCollectAction(order, inspectionPaid)}
                onStartExchange={() => handleStartExchange(order)}
                onPostReturn={() => handlePostCollectionReturn(order)}
                onShowSummary={() => setShowSummaryModal(order)}
                onShowAudit={() => setShowAuditLog(order)}
                onShowAssignment={() => setShowAssignment(order)}
                whatsappLink={getWhatsAppLink(order)}
                settings={settings}
              />
            ))}
          </div>
        </div>
      ) : (
        <KanbanView 
          orders={filteredOrders} 
          onStatusChange={updateOrderStatus}
          onEdit={handleEditOrder}
          settings={settings}
        />
      )}

      {/* Empty State */}
      {filteredOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
            <Package size={48} className="opacity-20" />
          </div>
          <h3 className="text-xl font-bold mb-2">لا توجد طلبات</h3>
          <p className="text-sm">جرب تغيير فلاتر البحث أو إضافة طلب جديد</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <div className="font-bold">عرض {paginatedOrders.length} من {filteredOrders.length} طلبات</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronRight/></button>
            <span>صفحة {currentPage} من {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronLeft/></button>
          </div>
        </div>
      )}

      {/* Report Preview Modal */}
      {reportPreviewHtml && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">معاينة التقرير</h3>
                            <p className="text-xs font-bold text-slate-500">راجع البيانات قبل الطباعة أو التحميل</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                printHTMLDirectly(reportPreviewHtml);
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            <Printer size={18} />
                            <span>طباعة / تحميل</span>
                        </button>
                        <button onClick={() => setReportPreviewHtml(null)} className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 overflow-hidden">
                    <iframe 
                        srcDoc={reportPreviewHtml} 
                        className="w-full h-full border-none rounded-xl shadow-inner bg-white"
                        title="Report Preview"
                    />
                </div>
            </div>
        </div>
      )}

      {/* Modals */}
      
      {showDetailsModal && (
        <OrderDetailsModal
          order={showDetailsModal}
          settings={settings}
          onClose={() => setShowDetailsModal(null)}
        />
      )}
      {orderToDelete && ( 
          <ConfirmationModal 
            title="حذف الطلب؟" 
            description={`هل أنت متأكد من حذف طلب العميل "${orderToDelete.customerName}"؟`} 
            onConfirm={handleDeleteOrder} 
            onCancel={() => setOrderToDelete(null)}
            checkboxLabel={orderToDelete.orderType === 'maintenance' ? "حذف طلب الصيانة المرتبط أيضاً" : undefined}
          /> 
      )}
      {orderForWaybill && orderForModal && ( <WaybillModal order={orderForModal} onClose={() => setOrderForWaybill(null)} onSave={handleSaveWaybill} /> )}
      
      {autoWhatsappData && (
        <AutoWhatsappModal 
            order={autoWhatsappData.order} 
            newStatus={autoWhatsappData.newStatus} 
            onClose={() => setAutoWhatsappData(null)} 
            settings={settings} 
        />
      )}

      {pendingFlexShipConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800" style={{ direction: 'rtl' }}>
                <div className="w-16 h-16 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-violet-100 dark:border-violet-500/20">
                    <Truck size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">تأكيد رسوم الفليكس شيب (Flex Ship)</h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-6">
                    الطلب رقم <span className="text-slate-800 dark:text-slate-200 font-extrabold">#{pendingFlexShipConfirm.orderNumber}</span> لشركة الشحن ({pendingFlexShipConfirm.companyName}).
                    <br />
                    هل قام المستلم بدفع الرسوم الإضافية بقيمة <span className="text-violet-600 dark:text-violet-400 font-black">{pendingFlexShipConfirm.fee} ج.م</span> لرفضه استلام الشحنة؟
                </p>
                
                <div className="grid grid-cols-1 gap-2.5">
                    <button 
                        onClick={() => {
                            updateOrderStatus(pendingFlexShipConfirm.orderId, pendingFlexShipConfirm.newStatus, true);
                            setPendingFlexShipConfirm(null);
                        }}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <span>نعم، تم الدفع والمستلم سدد الرسوم ✓</span>
                    </button>
                    <button 
                        onClick={() => {
                            updateOrderStatus(pendingFlexShipConfirm.orderId, pendingFlexShipConfirm.newStatus, false);
                            setPendingFlexShipConfirm(null);
                        }}
                        className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-extrabold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <span>لا، رفض الدفع (لم يتم التحصيل) ✗</span>
                    </button>
                    <button 
                        onClick={() => {
                            setPendingFlexShipConfirm(null);
                        }}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                        <span>إلغاء التغيير والرجوع</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {pendingInspectionConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800" style={{ direction: 'rtl' }}>
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
                    <Coins size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">تأكيد رسوم المعاينة</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 font-sans leading-relaxed">
                     الطلب رقم <span className="text-slate-800 dark:text-slate-200 font-extrabold">#{pendingInspectionConfirm.order.orderNumber}</span>.
                     <br />
                     هل قام العميل بدفع رسوم المعاينة بقيمة <span className="text-emerald-600 dark:text-emerald-400 font-black">{pendingInspectionConfirm.inspectionFee} ج.م</span>؟
                </p>
                
                <div className="grid grid-cols-1 gap-2.5">
                    <button 
                        onClick={() => {
                            const updatedOrder = { ...pendingInspectionConfirm.order, paymentStatus: pendingInspectionConfirm.newPaymentStatus, inspectionFeePaidByCustomer: true };
                            handleCollectAction(updatedOrder, true);
                            setPendingInspectionConfirm(null);
                        }}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                        <span>✓ نعم، العميل سدد كامل رسوم المعاينة</span>
                    </button>
                    <button 
                        onClick={() => {
                            const updatedOrder = { ...pendingInspectionConfirm.order, paymentStatus: pendingInspectionConfirm.newPaymentStatus, inspectionFeePaidByCustomer: false };
                            handleCollectAction(updatedOrder, false);
                            setPendingInspectionConfirm(null);
                        }}
                        className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-extrabold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                        <span>✗ لا، لم يسدد رسوم المعاينة بالزيادة</span>
                    </button>
                    <button 
                        onClick={() => {
                            setPendingInspectionConfirm(null);
                        }}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                        <span>إلغاء الإجراء</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {confirmation.isOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 ${
                    confirmation.type === 'danger' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 
                    confirmation.type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' : 
                    'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500'
                }`}>
                    <AlertTriangle size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">{confirmation.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium">{confirmation.message}</p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={confirmation.onConfirm}
                        className={`w-full py-4 text-white rounded-2xl font-black text-lg shadow-lg transition-all active:scale-[0.98] ${
                            confirmation.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 
                            confirmation.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' : 
                            'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                        }`}
                    >
                        {confirmation.confirmText || 'تأكيد'}
                    </button>
                    <button 
                        onClick={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
                        className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
                    >
                        تراجع
                    </button>
                </div>
            </div>
        </div>
      )}
      
      {showAuditLog && (
        <AuditLogModal 
          order={showAuditLog} 
          onClose={() => setShowAuditLog(null)} 
        />
      )}

      {showAssignment && (
        <AssignmentModal 
          order={showAssignment} 
          employees={settings.employees || []}
          onClose={() => setShowAssignment(null)} 
          onAssign={(empId, empName) => {
            updateOrderField(showAssignment.id, 'assignedTo', empId);
            updateOrderField(showAssignment.id, 'assignedToName', empName);
            setShowAssignment(null);
          }}
        />
      )}
    </motion.div>
  );
};

const ShipmentTypeBadge: React.FC<{ type?: string }> = ({ type }) => {
  const t = type || 'delivery';
  switch (t) {
    case 'partial_delivery':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-sky-55/60 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-850 whitespace-nowrap">
          <Package size={12} />
          <span>توصيل جزئي</span>
          <span className="px-1 py-0.5 bg-cyan-400 dark:bg-cyan-500 text-white rounded-[4px] text-[8px] font-black leading-none animate-pulse">جديد</span>
        </span>
      );
    case 'exchange':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-indigo-55/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-205 dark:border-indigo-850 whitespace-nowrap">
          <ArrowRightLeft size={12} />
          <span>تبديل شحنات</span>
        </span>
      );
    case 'return':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-rose-55/60 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-205 dark:border-rose-850 whitespace-nowrap">
          <RefreshCcw size={12} />
          <span>إرجاع شحنة</span>
        </span>
      );
    case 'cash_collection':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-emerald-55/60 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-205 dark:border-emerald-850 whitespace-nowrap">
          <Coins size={12} />
          <span>تحصيل نقدي</span>
        </span>
      );
    case 'maintenance_pickup':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 whitespace-nowrap">
          <SettingsIcon size={12} />
          <span>سحب للصيانة</span>
        </span>
      );
    case 'maintenance_return':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50 whitespace-nowrap">
          <Wand2 size={12} />
          <span>توصيل صيانة</span>
        </span>
      );
    case 'delivery':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-750 whitespace-nowrap">
          <Truck size={12} />
          <span>توصيل شحنة</span>
        </span>
      );
  }
};

const PosSourceBadge: React.FC<{ order: Order }> = ({ order }) => {
  if (order.channel !== 'pos' && !order.shippingCompany?.startsWith('كاشير -')) return null;
  const storeName = order.shippingCompany?.replace('كاشير - ', '') || 'بيع مباشر';
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 whitespace-nowrap">
      <Building size={12} />
      <span>{storeName}</span>
    </span>
  );
};

const OrderCard = ({ 
  order, 
  isSelected, 
  onSelect, 
  onStatusChange, 
  onPaymentChange,
  onEdit, 
  onDelete, 
  onPrintInvoice, 
  onPrintLabel,
  onCollect,
  onStartExchange,
  onPostReturn,
  onShowSummary,
  onShowAudit,
  onShowAssignment,
  whatsappLink,
  settings
}: { 
  order: Order, 
  isSelected: boolean, 
  onSelect: () => void,
  onStatusChange: (status: OrderStatus) => void,
  onPaymentChange: (status: PaymentStatus) => void,
  onEdit: () => void,
  onDelete: () => void,
  onPrintInvoice: () => void,
  onPrintLabel: () => void,
  onCollect: (inspectionPaid: boolean) => void,
  onStartExchange: () => void,
  onPostReturn: () => void,
  onShowSummary: () => void,
  onShowAudit: () => void,
  onShowAssignment: () => void,
  whatsappLink: string,
  settings: Settings,
  key?: any
}) => {
  const navigate = useNavigate();
  const statusInfo = ORDER_STATUS_METADATA[order.status] || { label: order.status, color: 'bg-slate-500', icon: 'Package' };
  const StatusIcon = {
    PhoneForwarded, FileSearch, Package, Truck, CheckCircle, Coins, RefreshCcw, XCircle, Archive
  }[statusInfo.icon as string] || Package;
  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeTax = Number(order.tax) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  const computedTotal = safeProductPrice + safeShippingFee + safeTax - safeDiscount - safeAdvance;
  const totalAmount = order.totalAmountOverride ?? computedTotal;
  const displayTotal = order.source === 'synced' && order.totalPrice != null ? Number(order.totalPrice) : totalAmount;

  return (
    <motion.div 
      variants={itemVariants}
      className={`bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 transition-all relative group shadow-sm hover:shadow-xl ${
        isSelected ? 'border-indigo-600 ring-4 ring-indigo-500/10' : 'border-slate-100 dark:border-slate-800'
      }`}
    >
      {/* Selection Hub */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
          <button 
            onClick={onShowAudit}
            className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"
            title="سجل النشاط"
          >
            <Shield size={16} />
          </button>
          <button 
            onClick={onSelect}
            className={`w-6 h-6 rounded-xl border-2 transition-all flex items-center justify-center ${
              isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 group-hover:border-indigo-300'
            }`}
          >
            {isSelected && <Check size={14} className="text-white" />}
          </button>
      </div>

      {/* Card Header & Status */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-16 h-16 rounded-2xl ${statusInfo.color} flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform duration-500`}>
              <StatusIcon size={32} />
            </div>
            {order.platform && order.platform !== 'system' && (
              <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-1 rounded-full shadow-md border border-slate-100 dark:border-slate-700">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white uppercase ${
                  order.platform === 'wuilt' ? 'bg-black' : 
                  order.platform === 'salla' ? 'bg-[#004d5a]' :
                  order.platform === 'shopify' ? 'bg-[#95bf47]' : 'bg-indigo-600'
                }`}>
                   {order.platform.substring(0, 1)}
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1">#{order.orderNumber}</h3>
            <div className="flex items-center gap-2 flex-row-reverse">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(order.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{order.shippingCompany}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status & Shipment Type Badges */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl ${statusInfo.color} text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-md`}>
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
              {statusInfo.label}
          </div>
          {order.channel !== 'pos' && !order.shippingCompany?.startsWith('كاشير -') && <ShipmentTypeBadge type={order.shipmentType} />}
          <PosSourceBadge order={order} />
      </div>

      {/* Profile Section */}
      <div className="space-y-6 mb-8">
        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
            <UserIcon size={20} />
          </div>
          <div className="text-right flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">العميل</p>
              <h4 className="text-sm font-black text-slate-800 dark:text-white">{order.customerName}</h4>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <MapPin size={20} />
          </div>
          <div className="text-right flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">العنوان</p>
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{order.governorate} - {order.shippingArea}</h4>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Phone size={20} />
          </div>
          <div className="text-right flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">اتصال</p>
              <div className="flex items-center gap-2 justify-end">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:scale-110 transition-transform">
                    <MessageCircle size={16} />
                </a>
                <h4 className="text-sm font-black text-slate-800 dark:text-white tabular-nums">{order.customerPhone}</h4>
              </div>
          </div>
        </div>
      </div>

      {/* Order Items Micro-view */}
      <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800/50 mb-8">
        <div className="flex items-center justify-between flex-row-reverse mb-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">محتويات الطلب</span>
          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black">{(order.items || []).length} قطع</span>
        </div>
        <div className="space-y-3">
          {(order.items || []).slice(0, 2).map((item, idx) => {
            const product = settings.products.find(p => p.id === item.productId);
            return (
              <div key={idx} className="flex gap-3 items-center flex-row-reverse">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 p-1 flex-shrink-0 shadow-sm">
                   {product?.thumbnail ? (
                     <img src={product.thumbnail} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                   ) : <Package size={16} className="m-auto text-slate-300" />}
                </div>
                <div className="text-right min-w-0 flex-1">
                   <p className="text-slate-800 dark:text-slate-200 font-black text-[11px] truncate leading-tight">{item.name}</p>
                   <p className="text-[10px] text-slate-400 font-bold">{item.variantDescription || 'وحدة قياسية'} <span className="text-slate-700 dark:text-slate-300">× {item.quantity}</span></p>
                </div>
              </div>
            );
          })}
          {(order.items || []).length > 2 && (
            <button onClick={onShowSummary} className="w-full text-center py-2 bg-white dark:bg-slate-800/50 rounded-xl text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 transition-all">
                + {(order.items || []).length - 2} منتجات أخرى
            </button>
          )}
        </div>
      </div>

      {/* Financial Statement */}
      <div className="flex items-center justify-between flex-row-reverse mb-8 group/total">
          <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المبلغ الإجمالي</p>
              <div className="flex items-baseline gap-1 justify-end">
                  <span className="text-xs font-black text-indigo-600">ج.م</span>
                  <h4 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums group-hover/total:scale-105 transition-transform origin-right">
                    {displayTotal.toLocaleString()}
                  </h4>
              </div>
              {(order.advancePayment || 0) > 0 && (
                <div className="text-[10px] text-teal-600 font-bold mt-1 text-right space-y-0.5">
                    <p>عربون: {order.advancePayment}</p>
                    {order.advancePaymentRecipientPhone && <p className="text-[9px] text-slate-500">المستلم: {order.advancePaymentRecipientPhone}</p>}
                    {order.advancePaymentSenderDetails && <p className="text-[9px] text-slate-400">المحول: {order.advancePaymentSenderDetails}</p>}
                </div>
              )}
          </div>
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Receipt size={24} />
          </div>
      </div>

      {/* Card Actions Overlay */}
      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
          <button 
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-black text-white rounded-2xl text-xs font-black hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            تعديل <Edit3 size={14} />
          </button>
          <button 
            onClick={onPrintInvoice}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            فاتورة <Printer size={14} />
          </button>

          <div className="relative group/more-card">
            <button className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
              <MoreVertical size={18} />
            </button>
            <div className="absolute bottom-full left-0 mb-3 w-52 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-2 hidden group-hover/more-card:block z-20">
              <button 
                  onClick={() => {
                    if (order.source === 'synced' && order.waybillNumber?.startsWith('http')) {
                      window.open(order.waybillNumber, '_blank');
                    } else {
                      onPrintLabel();
                    }
                  }} 
                  className="w-full text-right px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors"
              >
                بوليصة شحن <LayoutList size={16} /> {order.source === 'synced' && order.waybillNumber?.startsWith('http') && <ExternalLink size={12} className="text-blue-500 mr-auto" />}
              </button>
              <button 
                  onClick={(e) => { 
                      e.stopPropagation(); 
                      navigate('/orders/new', { state: { exchangeData: order } }); 
                  }} 
                  className="w-full text-right px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors"
              >
                  إنشاء بوليصة استبدال <RefreshCcw size={16} />
              </button>
              <button onClick={onShowAudit} className="w-full text-right px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                سجل التدقيق <FileSearch size={16} />
              </button>
              <button onClick={onShowAssignment} className="w-full text-right px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                تعيين موظف <UserIcon size={16} />
              </button>
              <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1 mx-2" />
              <button onClick={onDelete} className="w-full text-right px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                حذف نهائي <Trash2 size={16} />
              </button>
            </div>
          </div>
      </div>
    </motion.div>
  );
};

const ShippingDetailsCard: React.FC<{ order: Order }> = ({ order }) => {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl space-y-4 min-w-[280px]">
             <div className="flex flex-col items-center text-center space-y-2 pb-2 border-b border-slate-50 dark:border-slate-800">
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{order.shippingCompany}</span>
                <span className="text-[10px] font-bold text-slate-400">{order.governorate}</span>
             </div>
             
             <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300">
                    <Truck size={32} />
                </div>
                <div className="text-center">
                    <p className="text-sm font-black text-slate-800 dark:text-white">{order.shippingCompany}</p>
                    <div className="mt-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400">لا توجد بوليصة حالياً</p>
                    </div>
                </div>
             </div>
        </div>
    );
};

const ProfitBreakdown: React.FC<{ order: Order; settings: Settings; onToggleFlexShipPaid?: () => void }> = ({ order, settings, onToggleFlexShipPaid }) => {
    const safeProductPrice = Number(order.productPrice) || 0;
    const safeShippingFee = Number(order.shippingFee) || 0;
    const safeDiscount = Number(order.discount) || 0;
    const safeProductCost = Number(order.productCost) || 0;
    const safeAdvance = Number(order.advancePayment) || 0;
    
    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    
    const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
    const insuranceFee = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
    const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
    const inspectionFee = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
    const codFee = calculateCodFee(order, settings);
    const bostaVatFee = calculateBostaVat(order, insuranceFee, settings);
    const currentVatRate = useCustom ? (compFees?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0)) : (settings?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0));
    const dynamicVatLabel = `ضريبة القيمة المضافة (${(currentVatRate * 100).toFixed(0)}%)`;
    
    const safeTax = Number(order.tax) || 0;
    const inspectionAdjustment = order.inspectionFeePaidByCustomer ? 0 : inspectionFee;

    const baseRevenue = safeProductPrice + safeShippingFee + safeTax;
    const amountCollectedFromCustomer = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
        ? order.totalAmountOverride + safeAdvance 
        : (baseRevenue - safeDiscount);
        
    const extraAdjustment = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
        ? order.totalAmountOverride - ((baseRevenue - safeDiscount) - safeAdvance) 
        : 0;
        
    const totalExpenses = safeProductCost + safeShippingFee + insuranceFee + inspectionAdjustment + codFee + bostaVatFee;
    
    // Dynamic Profit/Loss calculations based on status
    const carrierCost = safeShippingFee + insuranceFee + bostaVatFee;
    const isReturnedOrFailed = ['مرتجع', 'فشل_التوصيل'].includes(order.status);
    const flexFeeValue = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);
    const flexPaidAmount = order.flexShipFeePaidByCustomer ? (order.flexShipFee || flexFeeValue) : 0;
    const flexCompanyFeeValue = useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0);
    const flexCompanyFeePaid = order.flexShipFeePaidByCustomer ? (order.flexShipCompanyFee ?? flexCompanyFeeValue) : 0;

    const netProfit = isReturnedOrFailed
        ? (flexPaidAmount - carrierCost - flexCompanyFeePaid) // Loss is carrier costs minus what was recouped via Flex Ship
        : (amountCollectedFromCustomer - totalExpenses);

    const profitLabel = isReturnedOrFailed 
        ? (netProfit >= 0 ? 'صافي ربح تسوية الشحن' : 'الخسارة الفعلية الموقعة')
        : (order.status === 'تم_التحصيل' ? 'الربح الصافي المحقق' : 'الربح المتوقع من الأوردر');

    return (
        <div id="profit-breakdown shadow-lg" className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-xl space-y-6 min-w-[320px] text-right">
            <h4 className="text-lg font-black text-slate-800 dark:text-white pb-4 border-b border-slate-50 dark:border-slate-800">تفاصيل معادلة الربح والخسارة</h4>
            
            <div className="space-y-4">
                {!isReturnedOrFailed ? (
                    <>
                        {/* الإيرادات */}
                        <div className="py-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">الإيرادات (ما يدفعه العميل):</p>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                    <span className="text-slate-500 font-bold">سعر المنتجات</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{safeProductPrice.toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                    <span className="text-slate-500 font-bold">رسوم الشحن على العميل</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{safeShippingFee.toLocaleString()} ج.م</span>
                                </div>
                                {safeTax > 0 && (
                                    <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                        <span className="text-slate-500 font-bold">الضريبة المضافة للعميل</span>
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{safeTax.toLocaleString()} ج.م</span>
                                    </div>
                                )}
                                {safeDiscount > 0 && (
                                    <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                        <span className="text-slate-500 font-bold">خصومات ومسماحات للعميل</span>
                                        <span className="font-black text-rose-500 tabular-nums">-{safeDiscount.toLocaleString()} ج.م</span>
                                    </div>
                                )}
                                {extraAdjustment !== 0 && (
                                    <div className="flex justify-between items-center flex-row-reverse text-sm mb-2 border-t border-slate-100 dark:border-slate-800/50 pt-2 mt-2">
                                        <span className="text-slate-500 font-bold">تسوية المبلغ المطلوب يدوياً</span>
                                        <span className={`font-black ${extraAdjustment > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'} tabular-nums`}>
                                            {extraAdjustment > 0 ? '+' : ''}{extraAdjustment.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center flex-row-reverse text-sm bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg mt-2 border border-slate-100 dark:border-slate-700/50">
                                    <span className="text-slate-700 dark:text-slate-300 font-black">إجمالي الإيرادات =</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{amountCollectedFromCustomer.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                                </div>
                            </div>
                        </div>

                        {/* التكاليف */}
                        <div className="py-3 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 mt-1">المصروفات والتكاليف:</p>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                    <span className="text-slate-500 font-bold">تكلفة شراء المنتجات</span>
                                    <span className="font-black text-rose-500 tabular-nums">-{safeProductCost.toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                    <span className="text-slate-500 font-bold">تكلفة بوليصة الشحن (للشركة)</span>
                                    <span className="font-black text-rose-500 tabular-nums">-{safeShippingFee.toLocaleString()} ج.م</span>
                                </div>
                                {insuranceFee > 0 && (
                                    <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                        <span className="text-slate-500 font-bold">التأمين على الشحنة</span>
                                        <span className="font-black text-rose-500 tabular-nums">-{insuranceFee.toFixed(2)} ج.م</span>
                                    </div>
                                )}
                                {bostaVatFee > 0 && (
                                    <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                        <span className="text-slate-500 font-bold">{dynamicVatLabel}</span>
                                        <span className="font-black text-rose-500 tabular-nums">-{bostaVatFee.toFixed(2)} ج.م</span>
                                    </div>
                                )}
                                {inspectionAdjustment > 0 && (
                                    <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                        <span className="text-slate-500 font-bold">المعاينة</span>
                                        <span className="font-black text-rose-500 tabular-nums">-{inspectionAdjustment.toFixed(2)} ج.م</span>
                                    </div>
                                )}
                                {codFee > 0 && (
                                    <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                        <span className="text-slate-500 font-bold">رسوم التحصيل (COD)</span>
                                        <span className="font-black text-rose-500 tabular-nums">-{codFee.toFixed(2)} ج.m</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center flex-row-reverse text-sm bg-rose-50 dark:bg-rose-900/10 p-2 rounded-lg mt-2 border border-rose-100 dark:border-rose-900/30">
                                    <span className="text-rose-700 dark:text-rose-300 font-black">إجمالي المصروفات =</span>
                                    <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">-{totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Returned/Failed loss presentation breakdown */
                    <div className="space-y-4">
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-400 font-bold mb-2">
                            ⚠️ تم إلغاء بيع الشحنة بسبب المرتجع. تم إرجاع المنتجات ذات تكلفة ({safeProductCost.toLocaleString()} ج.م) للمخزون دون أي خسارة في قيمة السلعة نفسها.
                        </div>
                        
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">حساب مصروفات الشحن الضائعة:</p>
                        
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center flex-row-reverse text-sm">
                                <span className="text-slate-500 font-semibold">بوليصة الشحن (الذهاب):</span>
                                <span className="font-black text-rose-500">-{safeShippingFee.toLocaleString()} ج.م</span>
                            </div>
                            {insuranceFee > 0 && (
                                <div className="flex justify-between items-center flex-row-reverse text-sm">
                                    <span className="text-slate-500 font-semibold">التأمين المقتطع:</span>
                                    <span className="font-black text-rose-500">-{insuranceFee.toFixed(2)} ج.م</span>
                                </div>
                            )}
                            {bostaVatFee > 0 && (
                                <div className="flex justify-between items-center flex-row-reverse text-sm">
                                    <span className="text-slate-500 font-semibold">ضريبة القيمة المضافة للبوليصة:</span>
                                    <span className="font-black text-rose-500">-{bostaVatFee.toFixed(2)} ج.م</span>
                                </div>
                            )}
                            <div className="h-[1px] bg-slate-200/50 dark:bg-slate-700/50" />
                            <div className="flex justify-between items-center flex-row-reverse text-sm font-bold text-rose-700 dark:text-rose-400">
                                <span>إجمالي خسائر الشحن لشركة النقل:</span>
                                <span>-{carrierCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                            </div>
                        </div>

                        {/* Interactive Explanation card */}
                        <div className="p-4 bg-violet-500/5 border border-violet-550/20 dark:border-violet-500/20 rounded-2xl text-xs space-y-2 mt-4">
                            <h5 className="font-black text-violet-800 dark:text-violet-405 flex items-center justify-end gap-1.5">
                                💡 كيف يتم تفادي هذه الخسائر بالفليكس شيب المعجل؟
                            </h5>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                                عندما يرفض المستلم الاستلام، يتم استدعاء خدمة فليكس شيب للمطالبة بـ <strong className="text-violet-750 font-black">{flexFeeValue} ج.م</strong>.
                            </p>
                            <div className="space-y-1.5 mt-2 pt-2 border-t border-violet-200/50 dark:border-violet-850/50 text-[11px]">
                                <div className="flex justify-between items-center flex-row-reverse text-slate-700 dark:text-slate-300">
                                    <span>خسارة بوليصة الذهاب:</span>
                                    <span>-{carrierCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                                </div>
                                {flexCompanyFeePaid > 0 && (
                                    <div className="flex justify-between items-center flex-row-reverse text-rose-500">
                                        <span>استقطاع شركة الشحن من فليكس شيب:</span>
                                        <span>-{flexCompanyFeePaid.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center flex-row-reverse text-emerald-600 dark:text-emerald-400">
                                    <span>الفليكس شيب المسترد من العميل:</span>
                                    <span>+{flexPaidAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                                </div>
                                <div className="h-[1.5px] bg-violet-200/50 dark:bg-violet-850/50" />
                                <div className="flex justify-between items-center flex-row-reverse font-black text-indigo-700 dark:text-indigo-400 text-xs">
                                    <span>صافي الخسارة الفعلية المترتبة:</span>
                                    <span className={netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                        {netProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م
                                    </span>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-normal text-right mt-1 bg-white/50 dark:bg-slate-900/40 p-2 rounded-xl">
                                {flexPaidAmount > 0 ? (
                                    <span className="text-emerald-600 font-black">✓ فليكس الكابتن نشط! لقد وفرت {Math.round(((flexPaidAmount - flexCompanyFeePaid) / carrierCost) * 100)}% من تكلفة البوليصة بفضل تحصيل الرسوم من العميل (بعد عمولة شركة الشحن).</span>
                                ) : (
                                    <span className="text-rose-600 font-black">ℹ️ العميل لم يدفع فليكس شيب (رفض السداد)، لذا تتحمل الشركة خسارة الشحن كاملة بقيمة {carrierCost.toLocaleString()} ج.م.</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Cash Collection & Advance Payment Breakdown */}
                {!isReturnedOrFailed && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2 mt-4 text-xs font-bold font-sans">
                        <div className="flex justify-between items-center flex-row-reverse">
                            <span className="text-slate-500">إجمالي فاتورة العميل:</span>
                            <span className="text-slate-700 dark:text-slate-300">{amountCollectedFromCustomer.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                        </div>
                        {safeAdvance > 0 && (
                            <div className="space-y-1 py-1 border-y border-slate-100/50 dark:border-slate-800/50 my-1">
                                <div className="flex justify-between items-center flex-row-reverse text-teal-600 dark:text-teal-400">
                                    <span>العربون المستلم مقدماً:</span>
                                    <span>-{safeAdvance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                                </div>
                                {(order.advancePaymentRecipientPhone || order.advancePaymentSenderDetails) && (
                                    <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-xl mt-1">
                                        {order.advancePaymentRecipientPhone && <div className="flex justify-between items-center flex-row-reverse"><span>رقم المستلم:</span> <span className="font-black text-slate-700 dark:text-slate-300">{order.advancePaymentRecipientPhone}</span></div>}
                                        {order.advancePaymentSenderDetails && <div className="flex justify-between items-center flex-row-reverse mt-1"><span>المحول (من):</span> <span className="font-black text-slate-700 dark:text-slate-300">{order.advancePaymentSenderDetails}</span></div>}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex justify-between items-center flex-row-reverse text-indigo-600 dark:text-indigo-400 border-t border-slate-200/50 dark:border-slate-800/50 pt-1.5 font-black text-sm">
                            <span>المتبقي للتحصيل عند الاستلام:</span>
                            <span>{Math.max(0, amountCollectedFromCustomer - safeAdvance).toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م</span>
                        </div>
                    </div>
                )}

                {/* Flex Ship Service Display */}
                {(() => {
                    const isFlexEnabled = useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false);
                    const flexFee = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);
                    const flexCompanyFee = useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0);
                    if (isFlexEnabled && flexFee > 0 && !isReturnedOrFailed) {
                        return (
                            <div className="p-4 bg-violet-50 dark:bg-violet-950/20 rounded-2xl border border-violet-100 dark:border-violet-900/40 text-xs text-right mt-4 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center flex-row-reverse text-violet-800 dark:text-violet-400 font-bold">
                                    <span className="flex items-center gap-1 font-black"><Truck size={14} className="inline"/> خدمة فليكس شيب (Flex Ship)</span>
                                    <span className="bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full text-[10px]">نشط</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                                    يُطالب المستلم بدفع رسوم إضافية بقيمة <strong className="text-violet-700 dark:text-violet-400 font-black">{flexFee} ج.م</strong> إذا رفض استلام الشحنة، ويستقطع منها لشركة الشحن <strong className="text-rose-700 dark:text-rose-400 font-black">{flexCompanyFee} ج.م</strong>.
                                </p>
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            <div className={`mt-6 p-5 rounded-3xl flex justify-between items-center flex-row-reverse ${netProfit >= 0 ? 'bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/50' : 'bg-rose-50 border border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/50'}`}>
                <span className={`text-sm font-black ${netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{profitLabel}</span>
                <div className="flex items-baseline gap-1 flex-row-reverse">
                    <span className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{netProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className="text-xs font-bold opacity-60">ج.م</span>
                </div>
            </div>
        </div>
    );
};

const ProductDetailsList: React.FC<{ order: Order }> = ({ order }) => {
    return (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-inner w-full max-w-xl mx-auto my-4 space-y-6">
            <h5 className="text-sm font-black text-slate-400 flex items-center justify-end gap-2 px-4 italic uppercase tracking-wider">
                تفاصيل المنتجات ({(order.items || []).length}) <Info size={14} />
            </h5>
            
            <div className="space-y-4">
                {(order.items || []).map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-3xl flex items-center gap-4 flex-row-reverse border border-slate-50 dark:border-slate-800 shadow-sm group hover:border-indigo-200 transition-colors">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-100 dark:border-slate-700">
                             {item.thumbnail ? (
                                <img src={item.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                                <Package size={24} className="m-auto text-slate-300" />
                             )}
                        </div>
                        <div className="flex-1 text-right">
                             <p className="text-sm font-black text-slate-800 dark:text-white leading-tight mb-1">{item.name}</p>
                             <p className="text-[10px] font-bold text-slate-400 line-clamp-1">{item.description || 'لم يتم إضافة وصف'}</p>
                             <div className="flex items-center gap-3 justify-end mt-2">
                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{item.price} ج.م</span>
                                <span className="text-[10px] font-bold text-slate-300">×</span>
                                <span className="text-xs font-black text-slate-600 dark:text-slate-400">{item.quantity}</span>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const OrderRow = ({ 
  order, 
  isSelected, 
  onSelect, 
  onStatusChange, 
  onPaymentChange,
  onEdit, 
  onDelete, 
  onPrintInvoice, 
  onPrintLabel,
  onCollect,
  onStartExchange,
  onPostReturn,
  onShowSummary,
  onShowAudit,
  onShowAssignment,
  onShowDetails,
  onToggleFlexShipPaid,
  whatsappLink,
  settings
}: { 
  order: Order, 
  isSelected: boolean, 
  onSelect: () => void,
  onStatusChange: (status: OrderStatus) => void,
  onPaymentChange: (status: PaymentStatus) => void,
  onEdit: () => void,
  onDelete: () => void,
  onPrintInvoice: () => void,
  onPrintLabel: () => void,
  onCollect: (inspectionPaid: boolean) => void,
  onStartExchange: () => void,
  onPostReturn: () => void,
  onShowSummary: () => void,
  onShowAudit: () => void,
  onShowAssignment: () => void,
  onShowDetails: () => void,
  onToggleFlexShipPaid?: () => void,
  whatsappLink: string,
  settings: Settings,
  key?: any
}) => {
  const navigate = useNavigate();
  const statusInfo = ORDER_STATUS_METADATA[order.status] || { label: order.status, color: 'bg-slate-500', icon: 'Package' };
  const StatusIcon = {
    PhoneForwarded, FileSearch, Package, Truck, CheckCircle, Coins, RefreshCcw, XCircle, Archive
  }[statusInfo.icon as string] || Package;
  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeTax = Number(order.tax) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeProductCost = Number(order.productCost) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  
  const computedTotal = safeProductPrice + safeShippingFee + safeTax - safeDiscount - safeAdvance;
  const totalAmount = order.totalAmountOverride != null ? Number(order.totalAmountOverride) : computedTotal;
  const displayTotal = order.source === 'synced' && order.totalPrice != null ? Number(order.totalPrice) : totalAmount;

  // Detailed Profit Calculation
  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  const getStatusBadgeStyle = (status: OrderStatus) => {
      switch (status) {
          case 'تم_التحصيل':
          case 'تم_توصيلها':
          case 'مدفوعة':
              return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
          case 'مرتجع':
          case 'فشل_التوصيل':
          case 'مرتجع_جزئي':
          case 'مرتجع_بعد_الاستلام':
              return 'bg-rose-50 text-rose-605 border-rose-100 dark:bg-rose-500/10 dark:text-rose-405 dark:border-rose-500/20';
          case 'في_انتظار_المكالمة':
          case 'جاري_المراجعة':
              return 'bg-indigo-50 text-indigo-650 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20';
          default:
              return 'bg-slate-50 text-slate-650 border-slate-100 dark:bg-slate-500/10 dark:text-slate-405 dark:border-slate-500/20';
      }
  };
  const attemptsCount = (order.callAttempts || []).length;
  const flexFeeValue = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);
  
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const calculatedInsuranceFee = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
  const calculatedInspectionFee = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
  const calculatedCodFeeAmount = calculateCodFee(order, settings);
  const bostaVatFee = calculateBostaVat(order, calculatedInsuranceFee, settings);
  
  const totalFees = calculatedInsuranceFee + calculatedInspectionFee + calculatedCodFeeAmount + bostaVatFee;
  const currentNetProfit = (safeProductPrice - safeDiscount) - safeProductCost - totalFees;
  const isDelivered = order.status === 'تم_التحصيل';
  const profitLabel = isDelivered ? 'الربح الصافي' : 'الربح المتوقع';
  const isProfitable = currentNetProfit >= 0;

  const [isExpanded, setIsExpanded] = useState(false);
  const [showOps, setShowOps] = useState(false);
  const opsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (opsRef.current && !opsRef.current.contains(e.target as Node)) {
        setShowOps(false);
      }
    };
    if (showOps) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOps]);
  const [showProfitPopover, setShowProfitPopover] = useState(false);
  const [showShippingPopover, setShowShippingPopover] = useState(false);

  return (
    <>
    <tr className={`group transition-all ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'} border-b border-slate-100 dark:border-slate-800/50`}>
      <td className="p-6 text-center">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={onSelect}
          className="w-5 h-5 rounded-lg border-slate-300 dark:bg-slate-800 dark:border-slate-700 text-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
        />
      </td>
      <td className="p-6 cursor-pointer" onClick={onShowDetails}>
        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="relative group/status" onClick={(e) => { e.stopPropagation(); onShowAudit(); }}>
            <div className={`w-14 h-14 rounded-2xl ${statusInfo.color} flex items-center justify-center text-white shadow-lg group-hover/status:scale-110 transition-transform cursor-pointer`}>
              <StatusIcon size={24} />
            </div>
            {order.platform && order.platform !== 'system' && (
              <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 p-0.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-800">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white uppercase ${
                   order.platform === 'wuilt' ? 'bg-black' : 
                   order.platform === 'salla' ? 'bg-[#004d5a]' :
                   order.platform === 'shopify' ? 'bg-[#95bf47]' : 'bg-indigo-600'
                }`}>
                   {order.platform.substring(0, 1)}
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-1 justify-end">
              {order.channel !== 'pos' && !order.shippingCompany?.startsWith('كاشير -') && <ShipmentTypeBadge type={order.shipmentType} />}
              <PosSourceBadge order={order} />
              <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tighter cursor-pointer hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); onShowDetails(); }}>#{order.orderNumber}</h4>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-emerald-500 hover:scale-110 transition-transform p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <MessageCircle size={14} />
              </a>
            </div>
            <div className="group/customer relative inline-block text-right">
              <div className="flex items-center gap-1.5 justify-end">
                  {order.recordedAsDebt && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-[9px] font-black border border-rose-100 dark:border-rose-500/20">
                          <Banknote size={10} />
                          <span>دين</span>
                      </div>
                  )}
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-help">{order.customerName}</div>
              </div>
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 flex items-center gap-2 justify-end mt-0.5">
                  <span className="tabular-nums">{order.customerPhone}</span>
                  <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                  <span>{new Date(order.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          </div>
        </div>
      </td>
      <td className="p-6">
        <div className="max-w-[200px] text-right flex flex-col items-end">
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center justify-end gap-2 p-1.5 rounded-xl transition-all cursor-pointer ${isExpanded ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black">
                    <Package size={10} />
                    <span>{(order.items || []).length} قطع</span>
                </div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                {(order.items || []).length > 0 ? ((order.items || [])[0].name || "").substring(0, 15) + '...' : '---'}
                </div>
            </div>
        </div>
      </td>
      {/* 4. مبلغ التحصيل */}
      <td className="p-6">
        <div className="text-right space-y-1 relative">
            <div className="flex items-center gap-2 justify-end">
                <div className="flex items-baseline gap-1 justify-end flex-row-reverse">
                    <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums drop-shadow-sm">{displayTotal.toLocaleString()}</span>
                    <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400">ج.م</span>
                </div>
                <Coins size={14} className="text-amber-500/80" />
            </div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 flex items-center gap-1 justify-end">
                <span>الدفع عند الاستلام</span>
                <span className="w-1 h-1 bg-slate-200/60 rounded-full"></span>
                <span className="text-indigo-600 dark:text-indigo-400">{order.shippingCompany}</span>
            </p>
            <p className="text-[9px] font-bold text-slate-405 dark:text-slate-500 text-right">{order.governorate}</p>
        </div>
      </td>

      {/* 5. رسوم فليكس شيب */}
      <td className="p-6">
        <div className="text-right space-y-0.5">
            <div className="flex items-center gap-1 justify-end">
                <span className="cursor-help text-slate-350 hover:text-indigo-600" title="رسوم فليكس شيب المستحقة">
                    <Info size={11} className="inline-block" />
                </span>
                <span className="text-xs font-black text-slate-850 dark:text-slate-200">
                    {flexFeeValue || 105} ج.م
                </span>
            </div>
            <span className="text-[10px] font-bold block text-slate-400 text-right">
                {['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(order.status) ? 'مستحق للفصل' : 'غير مستحق بعد'}
            </span>
        </div>
      </td>

      {/* 6. الحالة */}
      <td className="p-6">
        <div className="relative group/status-select inline-block text-right">
            {/* Overlay a custom beautiful badge below while keeping select fully functional for events */}
            <div className={`relative flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${getStatusBadgeStyle(order.status)}`}>
                <span>{statusInfo.label}</span>
                {order.status === 'تم_التحصيل' ? <span>✓</span> : <StatusIcon size={12} />}
                <ChevronDown size={11} className="opacity-50" />
                
                {/* Fully transparent interactive select positioned over the badge */}
                <select 
                  value={order.status}
                  onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                >
                  {ORDER_STATUSES.map(s => (
                    <option key={s} value={s} className="text-slate-900 bg-white font-bold">{ORDER_STATUS_METADATA[s]?.label || s}</option>
                  ))}
                </select>
            </div>
        </div>
      </td>

      {/* 7. المحاولات */}
      <td className="p-6">
        <div className="flex items-center gap-2 justify-end text-xs font-bold text-slate-600 dark:text-slate-400 font-sans">
            <div className="relative w-4.5 h-7.5 border border-slate-300 dark:border-slate-705 rounded-[6px] p-[2.5px] flex flex-col justify-end gap-[1.5px] bg-slate-50/50 dark:bg-slate-800/10">
                {/* Top terminal pin on battery */}
                <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-[3px] bg-slate-300 dark:bg-slate-705 rounded-t-[1.5px]" />
                {/* 3 bars */}
                <div className={`h-1.5 rounded-[2px] transition-colors ${attemptsCount >= 3 ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
                <div className={`h-1.5 rounded-[2px] transition-colors ${attemptsCount >= 2 ? 'bg-amber-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
                <div className={`h-1.5 rounded-[2px] transition-colors ${attemptsCount >= 1 ? 'bg-emerald-500' : 'bg-emerald-500'}`} />
            </div>
            <span className="tabular-nums font-extrabold">{attemptsCount === 0 ? '1' : attemptsCount}/3</span>
        </div>
      </td>

      {/* 8. حالة المبلغ المحصل */}
      <td className="p-6">
        <span 
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-center inline-block cursor-default ${
            order.paymentStatus === 'مدفوع' 
            ? 'bg-emerald-50 text-emerald-650 border border-emerald-110 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
            : 'bg-rose-50 text-rose-650 border border-rose-110 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
          }`}
        >
          {order.paymentStatus === 'مدفوع' ? 'مدفوع' : 'غير مدفوع'}
        </span>
      </td>
      <td className="p-6">
        <div className="flex items-center gap-2 justify-end">
            <div className="relative" ref={opsRef}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowOps(!showOps); }}
                  className={`flex items-center gap-3 px-6 py-2.5 rounded-[1.5rem] font-black text-xs transition-all shadow-md active:scale-95 ${isSelected ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-slate-200 dark:shadow-none'}`}
                >
                   <span>العمليات</span>
                   <ChevronDown size={16} className={`${showOps ? 'rotate-180' : ''} transition-transform`} />
                </button>
                
                <AnimatePresence>
                {showOps && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute top-full left-0 mt-3 w-56 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-[60] origin-top-left"
                >
                    <div className="p-4 mb-2 border-b border-slate-50 dark:border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">إدارة الطلب</p>
                    </div>
                    <div className="space-y-1">
                        <button onClick={(e) => { e.stopPropagation(); setShowOps(false); onEdit(); }} className="w-full h-12 text-right px-4 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                            تعديل البيانات <Edit3 size={16} className="text-indigo-500" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setShowOps(false); onPaymentChange(order.paymentStatus === 'مدفوع' ? 'بانتظار الدفع' : 'مدفوع'); }} className="w-full h-12 text-right px-4 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                            {order.paymentStatus === 'مدفوع' ? 'تحديد كغير مدفوع' : 'تحديد كمدفوع'} <Coins size={16} className="text-amber-500" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setShowOps(false); onPrintInvoice(); }} className="w-full h-12 text-right px-4 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                            طباعة الفاتورة <Printer size={16} className="text-emerald-500" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setShowOps(false); onPrintLabel(); }} className="w-full h-12 text-right px-4 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                            بوليصة شحن <LayoutList size={16} className="text-blue-500" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setShowOps(false); navigate('/orders/new', { state: { exchangeData: order } }); }} className="w-full h-12 text-right px-4 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                            إنشاء بوليصة استبدال <RefreshCcw size={16} className="text-teal-500" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setShowOps(false); onShowAssignment(); }} className="w-full h-12 text-right px-4 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                            تعيين موظف <UserIcon size={16} className="text-purple-500" />
                        </button>
                        <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-2 mx-4" />
                        <button onClick={(e) => { 
                            e.stopPropagation(); 
                            setShowOps(false); 
                            if (confirm('هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.')) {
                                onDelete(); 
                            }
                        }} className="w-full h-12 text-right px-4 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                            حذف الطلب <Trash2 size={16} />
                        </button>
                    </div>
                </motion.div>
                )}
                </AnimatePresence>
            </div>
        </div>
      </td>
    </tr>
    <AnimatePresence>
        {isExpanded && (
            <tr>
                <td colSpan={7} className="p-0 border-none">
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-slate-50/50 dark:bg-slate-800/30"
                    >
                        <div className="flex flex-col md:flex-row gap-6 p-6">
                            <div className="flex-1">
                                <ProductDetailsList order={order} />
                            </div>
                            <div className="w-full md:w-[350px]">
                                <ProfitBreakdown order={order} settings={settings} onToggleFlexShipPaid={onToggleFlexShipPaid} />
                            </div>
                        </div>
                    </motion.div>
                </td>
            </tr>
        )}
    </AnimatePresence>
    </>
  );
};

const KanbanView: React.FC<{ orders: Order[]; onStatusChange: (id: string, newStatus: OrderStatus) => void; onEdit: (order: Order) => void; settings: Settings; }> = ({ orders, onStatusChange, onEdit, settings }) => {
  const columns: OrderStatus[] = ['في_انتظار_المكالمة', 'جاري_المراجعة', 'قيد_التنفيذ', 'تم_الارسال', 'تم_التحصيل', 'مرتجع', 'فشل_التوصيل', 'ملغي'];
  
  const statusColors: Record<OrderStatus, string> = { 
    في_انتظار_المكالمة: 'border-indigo-500 bg-indigo-500/5', 
    جاري_المراجعة: 'border-purple-500 bg-purple-500/5', 
    قيد_التنفيذ: 'border-amber-500 bg-amber-500/5', 
    تم_الارسال: 'border-blue-500 bg-blue-500/5', 
    قيد_الشحن: 'border-sky-500 bg-sky-500/5', 
    تم_توصيلها: 'border-emerald-500 bg-emerald-500/5', 
    تم_التحصيل: 'border-teal-500 bg-teal-500/5', 
    مدفوعة: 'border-emerald-600 bg-emerald-600/5',
    مرتجع: 'border-rose-500 bg-rose-500/5', 
    مرتجع_بعد_الاستلام: 'border-orange-500 bg-orange-500/5', 
    تم_الاستبدال: 'border-slate-500 bg-slate-500/5', 
    مرتجع_جزئي: 'border-orange-500 bg-orange-500/5', 
    فشل_التوصيل: 'border-rose-600 bg-rose-600/5', 
    تمت_الاعادة_لشركة_الشحن: 'border-rose-800 bg-rose-800/5',
    ملغي: 'border-slate-500 bg-slate-500/5', 
    مؤرشف: 'border-slate-500 bg-slate-500/5',
    مؤجل: 'border-amber-600 bg-amber-600/5',
    مجدول: 'border-indigo-600 bg-indigo-600/5'
  };

  return (
    <div className="flex gap-6 p-4 overflow-x-auto min-h-[70vh] no-scrollbar scroll-smooth">
      {columns.map((status, idx) => {
        const columnOrders = orders.filter(o => o.status === status);
        return (
          <div key={status} className="flex-shrink-0 w-80 flex flex-col gap-4">
            <div className={`p-4 rounded-[1.5rem] border-t-4 shadow-sm ${statusColors[status]} flex justify-between items-center bg-white dark:bg-slate-900`}>
              <h3 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-widest">{status.replace(/_/g, ' ')}</h3>
              <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl text-[10px] font-black shadow-inner">{columnOrders.length}</span>
            </div>
            <div className="flex-1 space-y-4">
              {columnOrders.map((order, oIdx) => (
                <motion.div 
                  key={order.id}
                  layoutId={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (idx * 0.1) + (oIdx * 0.05) }}
                  className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
                  onClick={() => onEdit(order)}
                >
                  <div className="absolute top-0 right-0 w-1 h-full opacity-20" style={{ backgroundColor: statusColors[status].split(' ')[0].split('-')[1] }}></div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 tracking-wider">#{order.orderNumber || order.id.slice(0, 4)}</span>
                      {order.channel !== 'pos' && !order.shippingCompany?.startsWith('كاشير -') && <ShipmentTypeBadge type={order.shipmentType} />}
                      <PosSourceBadge order={order} />
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"><Edit3 size={14}/></button>
                    </div>
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-white text-sm mb-1">{order.customerName}</h4>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">{order.productName}</p>
                  <div className="flex justify-between items-center flex-row-reverse border-t border-slate-50 dark:border-slate-800/50 pt-3">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-black text-indigo-600">ج.م</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">{(order.totalAmountOverride ?? order.productPrice).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <MapPin size={10} className="text-slate-400" />
                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{order.governorate || '---'}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
              {columnOrders.length === 0 && (
                <div className="h-32 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] flex items-center justify-center text-slate-300 dark:text-slate-700 text-xs font-black uppercase tracking-widest italic p-8 text-center">
                    لا تتوفر طلبات
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
const AuditLogModal: React.FC<{ order: Order; onClose: () => void; }> = ({ order, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">سجل التدقيق (Audit Log)</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
            {order.auditLogs && order.auditLogs.length > 0 ? (
              order.auditLogs.map((log, idx) => (
                <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{log.action}</span>
                    <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString('ar-EG')}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{log.details}</p>
                  <div className="text-[10px] text-slate-500 font-bold">بواسطة: {log.userEmail}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400">لا يوجد سجل تدقيق لهذا الطلب.</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AssignmentModal: React.FC<{ 
  order: Order; 
  employees: Employee[];
  onClose: () => void; 
  onAssign: (id: string, name: string) => void; 
}> = ({ order, employees, onClose, onAssign }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">تعيين موظف للطلب</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          
          <div className="space-y-3">
            {employees.length > 0 ? (
              employees.map(emp => (
                <button 
                  key={emp.id}
                  onClick={() => onAssign(emp.id, emp.name)}
                  className={`w-full p-4 rounded-2xl border-2 text-right transition-all flex justify-between items-center ${order.assignedTo === emp.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'}`}
                >
                  <span className="font-bold text-slate-800 dark:text-white">{emp.name}</span>
                  {order.assignedTo === emp.id && <CheckCircle size={18} className="text-indigo-500" />}
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Users size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-bold">لا يوجد موظفين مضافين حالياً.</p>
                <p className="text-xs mt-1">يمكنك إضافة موظفين من صفحة الإعدادات.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const LowStockAlert: React.FC<{ products: Product[] }> = ({ products }) => {
  if (!products) return null;
  const lowStockProducts = products.filter(p => p.stockQuantity !== null && p.stockQuantity !== undefined && p.stockQuantity <= (p.stockThreshold || 5));
  
  if (lowStockProducts.length === 0) return null;

  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl mb-6 flex items-start gap-3"
    >
      <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
      <div>
        <h4 className="font-bold text-red-800 dark:text-red-300 text-sm mb-1">تنبيه: مخزون منخفض</h4>
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">المنتجات التالية وصلت للحد الأدنى للمخزون:</p>
        <div className="flex flex-wrap gap-2">
          {lowStockProducts.map(p => (
            <span key={p.id} className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold border border-red-100 dark:border-red-900/50 shadow-sm">
              {p.name} ({p.stockQuantity} قطعة)
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
interface QuickStatProps { icon: React.ReactNode; label: string; value: number; color: string; }
const QuickStat: React.FC<QuickStatProps> = ({ icon, label, value, color }) => {
  const colors: Record<string, string> = {
    purple: "text-purple-600 bg-purple-50/80 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20",
    sky: "text-sky-600 bg-sky-50/80 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20",
    emerald: "text-emerald-600 bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20",
    red: "text-red-600 bg-red-50/80 dark:bg-red-500/10 border-red-100 dark:border-red-500/20",
  };
  return (
    <div className={`p-5 rounded-2xl border flex flex-col gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div className="p-2.5 bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm backdrop-blur-sm">{icon}</div>
        <div className="text-3xl font-black tracking-tight">{value}</div>
      </div>
      <div className="text-sm font-bold opacity-80">{label}</div>
    </div>
  );
};
interface TabButtonProps { label: string; activeTab: string; setActiveTab: (label: string) => void; count: number; }
const TabButton: React.FC<TabButtonProps> = ({ label, activeTab, setActiveTab, count }) => {
    const isActive = activeTab === label;
    return (
        <button
            onClick={() => setActiveTab(label)}
            className={`flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${
                isActive
                ? 'bg-indigo-600 text-white border-transparent shadow-md hover:bg-indigo-700'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
            <span>{label}</span>
            <span
                className={`px-2 py-0.5 rounded-lg text-xs font-black transition-colors ${
                    isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                }`}
            >
                {count}
            </span>
        </button>
    );
};
interface OrderModalProps { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (e: React.FormEvent) => void; 
  orderData: NewOrderState | Order; 
  setOrderData: React.Dispatch<React.SetStateAction<any>>; 
  settings: Settings; 
  isEditing: boolean; 
  customers: any[]; 
  orders: Order[]; 
  treasury?: any;
}

const OrderModal: React.FC<OrderModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  orderData, 
  setOrderData, 
  settings, 
  isEditing, 
  customers, 
  orders,
  treasury
}) => {
    if (!isOpen) return null;
    
    const isExchange = (orderData as NewOrderState).orderType === 'exchange' || (orderData as NewOrderState).shipmentType === 'exchange';
    const isReturn = (orderData as NewOrderState).shipmentType === 'return';
    const isCashCollection = (orderData as NewOrderState).shipmentType === 'cash_collection';
    let creditAmount = (orderData as NewOrderState).creditAmount || 0;

    // Customer Search State
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
    const [showEditTotalModal, setShowEditTotalModal] = useState(false);
    const customerSearchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
                setIsCustomerListOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return [];
        return customers.filter(c => 
            (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || 
            (c.phone || '').includes(customerSearch)
        );
    }, [customerSearch, customers]);
    
    if (isEditing && isExchange && !creditAmount && orderData.originalOrderId) {
        const originalOrder = orders.find(o => o.id === orderData.originalOrderId);
        if (originalOrder) {
            creditAmount = originalOrder.totalAmountOverride ?? (originalOrder.productPrice + originalOrder.shippingFee - (originalOrder.discount || 0));
        }
    }

    const subtotal = useMemo(() => {
        if ((isExchange && orderData.useProductsForShipment === false) || isCashCollection) {
            return Number(orderData.customShipmentPrice) || 0;
        }
        if (isReturn) {
            return 0;
        }
        return (orderData.items || []).reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    }, [orderData.items, isExchange, orderData.useProductsForShipment, orderData.customShipmentPrice, isReturn, isCashCollection]);
    
    // Custom Product Dropdown Component
    const ProductSelect = ({ value, onChange, products, index }: { value: string, onChange: (val: string) => void, products: any[], index: number }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [search, setSearch] = useState('');
        const containerRef = useRef<HTMLDivElement>(null);
        
        const selectedProduct = products.find(p => p.id === value);
        const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

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
                    className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-right hover:bg-slate-100 dark:hover:bg-slate-700 transition-all outline-none"
                >
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                        {selectedProduct?.thumbnail ? (
                            <img src={selectedProduct.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Package size={20} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 text-right">
                        <p className="text-slate-800 dark:text-slate-200 leading-tight">{selectedProduct?.name || 'اختر منتجاً'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">#{selectedProduct?.id.slice(-6)}</p>
                    </div>
                    <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                            <input 
                                autoFocus
                                type="text"
                                placeholder="ابحث عن منتج..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {filtered.length > 0 ? (
                                filtered.map(p => (
                                    <div 
                                        key={p.id} 
                                        onClick={() => { onChange(p.id); setIsOpen(false); }} 
                                        className={`flex items-center gap-3 p-3 hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors ${value === p.id ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                                            {p.thumbnail ? (
                                                <img src={p.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : <Package size={24} className="m-auto text-slate-300" />}
                                        </div>
                                        <div className="flex-1 text-right">
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{p.name}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-xs font-black text-amber-600 truncate">{p.price} ج.م</span>
                                                <span className={`text-[10px] font-bold ${(p.stock || p.stockQuantity || 0) <= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    مخزون: {p.stock || p.stockQuantity || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    لا توجد نتائج للبحث
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const itemDiscounts = useMemo(() => (orderData.items || []).reduce((sum, item) => {
        let discount = 0;
        if (item.discountValue) {
            if (item.discountType === 'percentage') {
                discount = ((item.price || 0) * (item.quantity || 1)) * (item.discountValue / 100);
            } else {
                discount = item.discountValue * (item.quantity || 1);
            }
        }
        return sum + discount;
    }, 0), [orderData.items]);
    
    const inspectionFee = useMemo(() => {
        if (!orderData.includeInspectionFee) return 0;
        const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
        const useCustom = compFees?.useCustomFees ?? false;
        return useCustom ? (compFees?.inspectionFee || 0) : (settings.enableInspection ? settings.inspectionFee : 0);
    }, [orderData.includeInspectionFee, orderData.shippingCompany, settings]);

    const totalBeforeCredit = useMemo(() => subtotal - itemDiscounts + (orderData.shippingFee || 0) - (orderData.discount || 0) + inspectionFee, [subtotal, itemDiscounts, orderData.shippingFee, orderData.discount, inspectionFee]);
    const finalAmount = totalBeforeCredit - creditAmount - (orderData.advancePayment || 0);

    const liveProfitMargin = useMemo(() => {
        const costOfItems = (orderData.items || []).reduce((sum: number, item: any) => {
            const prod = settings.products.find(p => p.id === item.productId);
            let itemCostByQty = Number(prod?.costPrice) || 0;
            if (prod?.hasVariants && item.variantId) {
                const variant = prod.variants?.find(v => v.id === item.variantId);
                itemCostByQty = Number(variant?.costPrice) || itemCostByQty;
            }
            return sum + (itemCostByQty * (Number(item.quantity) || 1));
        }, 0);

        const totalCollected = orderData.totalAmountOverride !== undefined && orderData.totalAmountOverride !== null && (orderData.totalAmountOverride as any) !== ''
            ? Number(orderData.totalAmountOverride)
            : Number(finalAmount || 0);

        const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
        const useCustom = compFees?.useCustomFees ?? false;
        
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
        
        const mockOrderForInsurance = {
            ...orderData,
            productPrice: subtotal - itemDiscounts,
            shippingFee: Number(orderData.shippingFee) || 0,
            isInsured: orderData.isInsured !== false,
            items: orderData.items || []
        } as any;
        const insuranceFee = calculateInsuranceFee(mockOrderForInsurance, insuranceRate, settings);
        const effectiveInspectionCost = orderData.includeInspectionFee ? Number(inspectionCost) : 0;
        const codFee = Number(calculateCodFee({ status: 'تم_التحصيل', totalPrice: totalCollected, shippingFee: orderData.shippingFee || 0 } as any, settings)) || 0;
        
        const totalExpenses = costOfItems + Number(orderData.shippingFee || 0) + insuranceFee + effectiveInspectionCost + codFee;
        const profit = totalCollected - totalExpenses;
        
        return {
            costOfItems,
            insuranceFee,
            effectiveInspectionCost,
            codFee,
            totalExpenses,
            profit,
            profitPercent: totalCollected > 0 ? Math.round((profit / totalCollected) * 100) : 0
        };
    }, [orderData.items, orderData.totalAmountOverride, orderData.shippingFee, orderData.discount, orderData.isInsured, orderData.includeInspectionFee, orderData.shippingCompany, finalAmount, settings]);

    const handleFieldChange = (field: keyof NewOrderState, value: any) => setOrderData((prev: any) => ({ ...prev, [field]: value }));
    const handleReturnProductChange = (productId: string) => {
        const prod = settings.products.find(p => p.id === productId);
        handleFieldChange('returnProductId', productId);
        handleFieldChange('returnVariantId', undefined);
        const qty = orderData.returnQuantity || 1;
        const desc = prod ? `${prod.name}` : '';
        handleFieldChange('returnDescription', desc);
    };

    const handleReturnVariantChange = (variantId: string) => {
        const prod = settings.products.find(p => p.id === orderData.returnProductId);
        const variant = prod?.variants?.find(v => v.id === variantId);
        handleFieldChange('returnVariantId', variantId);
        let desc = prod ? prod.name : '';
        if (variant) {
            const varDesc = Object.entries(variant.options || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
            desc += ` (${varDesc})`;
        }
        handleFieldChange('returnDescription', desc);
    };
    const handleCustomerSelect = (customer: Pick<CustomerProfile, 'name'|'phone'|'address'>) => {
        setOrderData((prev: any) => ({ ...prev, customerName: customer.name, customerPhone: customer.phone, customerAddress: customer.address }));
        setCustomerSearch('');
        setIsCustomerListOpen(false);
    };

    const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
        let newItems = [...(orderData.items || [])];
    
        if (field === 'productId') {
            const product = settings.products.find(p => p.id === value);
            if (!product) {
                handleFieldChange('items', newItems);
                return;
            }
            
            const existingItemIndex = newItems.findIndex((item, i) => item.productId === value && !item.variantId && i !== index);
    
            if (existingItemIndex !== -1) {
                // Product exists, merge them
                const existingItem = newItems[existingItemIndex];
                const currentItem = newItems[index];
    
                newItems[existingItemIndex] = {
                    ...existingItem,
                    quantity: existingItem.quantity + currentItem.quantity
                };
                
                newItems = newItems.filter((_, i) => i !== index);
            } else {
                 newItems[index] = { ...newItems[index], productId: value, name: product.name, price: product.price, cost: getLatestProductCost(value, settings), weight: product.weight, thumbnail: product.thumbnail, variantId: undefined, variantDescription: undefined };
            }
        } else if (field === 'variantId') {
            const product = settings.products.find(p => p.id === newItems[index].productId);
            const variant = product?.variants?.find(v => v.id === value);
            if (variant) {
                newItems[index] = {
                    ...newItems[index],
                    variantId: value,
                    variantDescription: Object.entries(variant.options || {}).map(([k, v]) => `${k}: ${v}`).join(', '),
                    price: variant.price,
                    cost: variant.costPrice,
                    weight: variant.weight
                };
            } else {
                newItems[index] = {
                    ...newItems[index],
                    variantId: undefined,
                    variantDescription: undefined,
                    price: product?.price || 0,
                    cost: product?.costPrice || 0,
                    weight: product?.weight || 0
                };
            }
        } else {
            const updatedItem = { ...newItems[index], [field]: value };
            newItems[index] = updatedItem;
        }
    
        handleFieldChange('items', newItems);
    };

    const addItem = () => {
        const firstProduct = settings.products[0];
        if (!firstProduct) return;
        handleFieldChange('items', [...(orderData.items || []), { 
            productId: firstProduct.id, 
            name: firstProduct.name, 
            quantity: 1, 
            price: firstProduct.price, 
            cost: firstProduct.costPrice, 
            weight: firstProduct.weight, 
            thumbnail: firstProduct.thumbnail,
            discountValue: 0,
            discountType: 'amount'
        }]);
    };

    const removeItem = (index: number) => handleFieldChange('items', (orderData.items || []).filter((_, i) => i !== index));
    const activeCompanies = Object.keys(settings.shippingOptions || {}).filter(company => settings.activeCompanies?.[company] !== false);
    const shippingOptions = useMemo(() => {
        const options = settings.shippingOptions?.[orderData.shippingCompany!] || [];
        if (options.length > 0) return options;
        return EGYPT_GOVERNORATES.map((gov, index) => ({
            id: `gov_fallback_${index}`,
            label: gov.name,
            cities: gov.cities.map((city, cIndex) => ({ id: `city_fallback_${index}_${cIndex}`, name: city }))
        })) as any[];
    }, [settings.shippingOptions, orderData.shippingCompany]);

    useEffect(() => {
        const selectedOption = shippingOptions.find(opt => opt.label === (orderData.governorate || orderData.shippingArea));
            if (selectedOption) {
                const getPriceKey = (type?: string): 'deliveryPrice' | 'exchangePrice' | 'returnPrice' | 'cashCollectionPrice' | 'returnToSenderPrice' => {
                    if (type === 'exchange') return 'exchangePrice';
                    if (type === 'return') return 'returnPrice';
                    if (type === 'cash_collection') return 'cashCollectionPrice';
                    return 'deliveryPrice';
                };
                const priceKey = getPriceKey(orderData.shipmentType);
                let fee = (selectedOption[priceKey] as number) || selectedOption.deliveryPrice || 0;
                let extraKgPrice = selectedOption.extraKgPrice || 0;
                if (orderData.city) {
                    const cityOpt = selectedOption.cities?.find(c => c.name === orderData.city);
                    if (cityOpt) {
                        if (cityOpt.useParentFees) {
                            fee = (selectedOption[priceKey] as number) || selectedOption.deliveryPrice || 0;
                            extraKgPrice = selectedOption.extraKgPrice || 0;
                        } else {
                            const cityFee = cityOpt[priceKey] !== undefined && cityOpt[priceKey] !== null ? cityOpt[priceKey] : cityOpt.deliveryPrice;
                            if (cityFee !== undefined && cityFee !== null) {
                                fee = cityFee;
                                extraKgPrice = cityOpt.extraKgPrice || 0;
                            }
                        }
                    }
                }
                
                const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
                const baseWeight = compFees?.useCustomFees && compFees.baseWeight !== undefined 
                    ? compFees.baseWeight 
                    : (settings.baseWeight !== undefined ? settings.baseWeight : 5);
                
                const totalWeight = orderData.items?.reduce((sum: number, item: any) => {
                    const itemWeight = parseFloat(item.weight?.toString() || '0');
                    const itemQuantity = parseInt(item.quantity?.toString() || '1');
                    return sum + (itemWeight * itemQuantity);
                }, 0) || 0;
                const extraWeight = Math.max(0, totalWeight - baseWeight);
                const totalFee = fee + (Math.ceil(extraWeight) * extraKgPrice);

                if (totalFee !== orderData.shippingFee) {
                    handleFieldChange('shippingFee', totalFee);
                }
            }
    }, [orderData.governorate, orderData.shippingArea, orderData.city, shippingOptions, orderData.items, orderData.shipmentType]);

    const totalWeight = useMemo(() => (orderData.items || []).reduce((sum, item) => {
        const itemWeight = parseFloat(item.weight?.toString() || '0');
        const itemQuantity = parseInt(item.quantity?.toString() || '1');
        return sum + (itemWeight * itemQuantity);
    }, 0), [orderData.items]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-hidden">
            <motion.form 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onSubmit={onSubmit} 
                className="bg-white/95 dark:bg-slate-900/95 w-full max-w-6xl h-[92vh] rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] flex flex-col border border-white/20 dark:border-slate-800/50 backdrop-blur-xl"
            >
                {/* Header Section */}
                <div className="px-8 py-7 flex justify-between items-center bg-gradient-to-l from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-900 rounded-t-[2.5rem] border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white transform -rotate-3">
                            <ShoppingBag size={28} strokeWidth={2.5}/>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                                {isEditing ? `تعديل الطلب #${orderData.orderNumber}` : 'إنشاء طلب جديد'}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">أكمل بيانات الطلب لبدء عملية الشحن والتحصيل.</p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all duration-300"
                    >
                        <X size={28}/>
                    </button>
                </div>

                {/* Shipment Type Selector - Modern Segmented Control */}
                <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap gap-2 items-center justify-start bg-white/30 dark:bg-slate-900/30">
                    <div className="flex p-1.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-[1.25rem] border border-slate-200/50 dark:border-slate-700/50 gap-1 overflow-x-auto no-scrollbar">
                        {(() => {
                            const compFees = (settings.companySpecificFees?.[orderData.shippingCompany] || {}) as any;
                            const tabs: { id: string; label: string; icon: React.ReactNode; badge?: string }[] = [
                                { id: 'delivery', label: 'توصيل شحنة', icon: <Truck size={17} /> }
                            ];
                            if (compFees.enablePartialDelivery !== false) {
                                tabs.push({ id: 'partial_delivery', label: 'توصيل جزئي', icon: <Package size={17} />, badge: 'جديد' });
                            }
                            if (compFees.enableExchange !== false) {
                                tabs.push({ id: 'exchange', label: 'تبديل شحنات', icon: <ArrowRightLeft size={17} /> });
                            }
                            if (compFees.enableReturn !== false) {
                                tabs.push({ id: 'return', label: 'إرجاع شحنة', icon: <RefreshCcw size={17} /> });
                            }
                            if (compFees.enableCashCollection !== false) {
                                tabs.push({ id: 'cash_collection', label: 'تحصيل نقدي', icon: <Coins size={17} /> });
                            }
                            return tabs;
                        })().map(tab => {
                            const isActive = (orderData.shipmentType || 'delivery') === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleFieldChange('shipmentType', tab.id)}
                                    className={`relative flex items-center gap-2.5 py-2.5 px-6 rounded-xl text-xs font-black transition-all duration-300 shrink-0 ${
                                        isActive
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                    }`}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                    {tab.badge && (
                                        <span className="text-[10px] px-2 py-0.5 bg-indigo-500 text-white rounded-lg font-bold leading-none">
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/50">
                    <div className="lg:col-span-7 space-y-8">
                        {/* Customer Details Card */}
                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-110"></div>
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-lg">
                                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                                    <UserIcon size={20}/>
                                </div>
                                بيانات العميل
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="relative" ref={customerSearchRef}>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">اسم العميل</label>
                                    <input type="text" placeholder="اسم العميل أو رقم الهاتف" required value={customerSearch || orderData.customerName || ''} onChange={e => { setCustomerSearch(e.target.value); handleFieldChange('customerName', e.target.value); }} onFocus={() => setIsCustomerListOpen(true)} className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold" />
                                    {isCustomerListOpen && filteredCustomers.length > 0 && (
                                        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-20 max-h-60 overflow-y-auto custom-scrollbar">
                                            {filteredCustomers.map(c => (
                                                <div key={c.phone} onClick={() => handleCustomerSelect(c)} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors">
                                                    <p className="font-black text-slate-800 dark:text-slate-200">{c.name}</p>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                                        {c.phone}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">رقم الهاتف الأساسي</label>
                                    <input type="tel" placeholder="01xxxxxxxxx" required value={orderData.customerPhone || ''} onChange={e => handleFieldChange('customerPhone', e.target.value)} className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold text-right" dir="rtl" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">رقم هاتف إضافي (اختياري)</label>
                                    <input type="tel" placeholder="رقم بديل للعميل" value={(orderData as NewOrderState).customerPhone2 || ''} onChange={e => handleFieldChange('customerPhone2', e.target.value)} className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold text-right" dir="rtl" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">الدولة</label>
                                    <input type="text" placeholder="مصر" value={(orderData as NewOrderState).country || 'مصر'} onChange={e => handleFieldChange('country', e.target.value)} className="p-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl w-full opacity-70 cursor-not-allowed dark:text-slate-400 font-bold" disabled />
                                </div>
                            </div>
                            <div className="mt-5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">العنوان بالتفصيل</label>
                                <textarea placeholder="المحافظة، المنطقة، واسم الشارع..." required value={orderData.customerAddress || ''} onChange={e => handleFieldChange('customerAddress', e.target.value)} className="w-full p-5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl h-28 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all resize-none dark:text-white font-medium" />
                            </div>
                            <div className="mt-5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">تفاصيل المبنى (رقم الشقة، الدور...)</label>
                                <input type="text" placeholder="مثال: عمارة رقم 5، الدور الثالث، شقة 10" value={(orderData as NewOrderState).buildingDetails || ''} onChange={e => handleFieldChange('buildingDetails', e.target.value)} className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-medium" />
                            </div>
                        </div>
                        
                        {/* Shipping Details Card */}
                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                           <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-lg">
                               <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                   <Building size={20}/>
                               </div>
                               بيانات الشحن والطلب
                           </h4>
                           
                           {orderData.waybillNumber && (
                              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                 <div>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1 uppercase tracking-wider">رقم البوليصة (Waybill)</p>
                                    {orderData.waybillNumber.startsWith('http') ? (
                                        <a 
                                          href={orderData.waybillNumber} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="inline-flex items-center gap-2 mt-1 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 font-black rounded-xl text-sm transition-all"
                                        >
                                           <ExternalLink size={16} /> فتح البوليصة بصيغة PDF
                                        </a>
                                    ) : (
                                        <p className="text-lg font-black text-blue-800 dark:text-blue-200 tabular-nums break-all">{orderData.waybillNumber}</p>
                                    )}
                                 </div>
                                 {orderData.trackingUrl && (
                                    <a 
                                      href={orderData.trackingUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-black rounded-xl text-sm shadow-md hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                                    >
                                       <LinkIcon size={16} /> تتبع الشحنة
                                    </a>
                                 )}
                              </div>
                           )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                 <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">شركة الشحن</label>
                                    <select required value={orderData.shippingCompany} onChange={e => handleFieldChange('shippingCompany', e.target.value)} className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-bold cursor-pointer">
                                        {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                 </div>
                                 <div className="grid grid-cols-2 gap-3">
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">المحافظة</label>
                                        <select 
                                            required 
                                            value={orderData.governorate || orderData.shippingArea || ''} 
                                            onChange={e => {
                                                const gov = e.target.value;
                                                setOrderData((prev: any) => ({ ...prev, governorate: gov, shippingArea: gov, city: '' }));
                                            }} 
                                            className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-bold cursor-pointer"
                                        >
                                            <option value="" disabled>اختر المحافظة</option>
                                            {shippingOptions.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}
                                        </select>
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">المدينة</label>
                                        <select 
                                            required 
                                            value={orderData.city || ''} 
                                            onChange={e => handleFieldChange('city', e.target.value)} 
                                            className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!(orderData.governorate || orderData.shippingArea)}
                                        >
                                            <option value="" disabled>اختر المدينة</option>
                                            {(shippingOptions.find(o => o.label === (orderData.governorate || orderData.shippingArea))?.cities || []).map(city => (
                                                <option key={city.id} value={city.name}>{city.name}</option>
                                            ))}
                                        </select>
                                     </div>
                                 </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                                <div>
                                    <label htmlFor="orderNumberInput" className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">رقم الطلب (اختياري)</label>
                                    <input id="orderNumberInput" type="text" placeholder="تلقائي" value={orderData.orderNumber || ''} onChange={e => handleFieldChange('orderNumber', e.target.value)} className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="referenceNumberInput" className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">رقام المرجع للفاتورة</label>
                                    <input id="referenceNumberInput" type="text" placeholder="#" value={orderData.referenceNumber || ''} onChange={e => handleFieldChange('referenceNumber', e.target.value)} className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white text-sm" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-lg">
                                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-500/10 rounded-xl flex items-center justify-center text-slate-600">
                                    <FileText size={20}/>
                                </div>
                                ملاحظات إضافية
                            </h4>
                            <textarea placeholder="اكتب أي ملاحظات للمندوب أو الطلب هنا..." value={orderData.notes || ''} onChange={e => handleFieldChange('notes', e.target.value)} className="w-full p-5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl h-28 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 outline-none transition-all resize-none dark:text-white text-right font-medium" />
                        </div>

                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-lg">
                                <div className="w-10 h-10 bg-pink-50 dark:bg-pink-500/10 rounded-xl flex items-center justify-center text-pink-600">
                                    <ImageIcon size={20}/>
                                </div>
                                صور ومرفقات الطلب
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-5">
                                {(orderData.images || []).map((img: string, idx: number) => (
                                    <div key={idx} className="relative aspect-square rounded-[1.5rem] overflow-hidden border border-slate-200/50 dark:border-slate-700/50 group shadow-sm transition-transform duration-300 hover:scale-[1.03]">
                                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button 
                                                type="button" 
                                                onClick={() => handleFieldChange('images', (orderData.images || []).filter((_: any, i: number) => i !== idx))}
                                                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const url = prompt('أدخل رابط الصورة:');
                                        if (url) handleFieldChange('images', [...(orderData.images || []), url]);
                                    }}
                                    className="aspect-square rounded-[1.5rem] border-2 border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-slate-400 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50/10 transition-all bg-slate-50/30 dark:bg-slate-800/30 group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                        <Plus size={22} />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-tight">إضافة صورة</span>
                                </button>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                <p className="text-[11px] text-slate-400 font-bold italic leading-relaxed text-center">
                                    إرفاق صور المنتج أو بوليصة الشحن يسهل عملية المتابعة ويقلل من الأخطاء في التوصيل أو الإرجاع.
                                </p>
                            </div>
                        </div>
                        {/* Products Section */}
                        {(!isExchange && !isReturn && !isCashCollection) && (
                            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                                 <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center justify-between text-lg">
                                     <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                                            <Package size={20}/>
                                        </div>
                                        المنتجات المطلوبة
                                     </div>
                                     <span className="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                                        {(orderData.items || []).length} صنف
                                     </span>
                                 </h4>
                                 <div className="space-y-5">
                                    {(orderData.items || []).length === 0 && (
                                        <div className="p-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] text-center bg-slate-50/30 dark:bg-slate-900/10">
                                            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                                <Package size={28} className="text-slate-300" />
                                            </div>
                                            <p className="text-sm font-black text-slate-800 dark:text-white">قائمة المنتجات فارغة</p>
                                            <p className="text-xs text-slate-500 mt-1.5 font-medium">ابدأ بإضافة المنتجات التي طلبها العميل لتفصيل الفاتورة.</p>
                                        </div>
                                    )}
                                    {(orderData.items || []).map((item, index) => {
                                        const product = settings.products.find(p => p.id === item.productId);
                                        const hasVariants = product?.variants && product.variants.length > 0;
                                        const selectedVariant = hasVariants ? product.variants?.find(v => v.id === item.variantId) : null;
                                        const stock = hasVariants ? (selectedVariant?.stock || 0) : (product?.stock || 0);

                                        return (
                                            <div key={index} className="p-6 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl relative group transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600">
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeItem(index)} 
                                                    className="absolute -top-3 -left-3 w-8 h-8 bg-white dark:bg-slate-700 text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-600 opacity-0 group-hover:opacity-100 transition-all z-10"
                                                >
                                                    <X size={16} />
                                                </button>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                    <div className="space-y-4">
                                                        <ProductSelect 
                                                             value={item.productId} 
                                                             onChange={val => handleItemChange(index, 'productId', val)} 
                                                             products={settings.products}
                                                             index={index}
                                                        />
                                                        
                                                        {hasVariants && (
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1">المتغير (المقاس / اللون)</label>
                                                                <select value={item.variantId || ''} onChange={e => handleItemChange(index, 'variantId', e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white font-bold cursor-pointer">
                                                                    <option value="">اختر المتغير...</option>
                                                                    {product?.variants?.map(v => (
                                                                        <option key={v.id} value={v.id}>
                                                                            {Object.entries(v.options || {}).map(([k, val]) => `${k}: ${val}`).join(', ')}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1">الكمية</label>
                                                                <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-xs" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1">السعر</label>
                                                                <input type="number" min="0" value={item.price} onChange={e => handleItemChange(index, 'price', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-xs" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1">الخصم</label>
                                                                <div className="flex gap-1">
                                                                    <input type="number" min="0" value={item.discountValue || 0} onChange={e => handleItemChange(index, 'discountValue', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-xs" />
                                                                    <select value={item.discountType || 'amount'} onChange={e => handleItemChange(index, 'discountType', e.target.value)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold outline-none dark:text-white">
                                                                        <option value="amount">ج.م</option>
                                                                        <option value="percentage">%</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2">
                                                            <span className={`text-[10px] font-bold ${stock < item.quantity ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                المخزون المتوفر: {stock} قطعة
                                                            </span>
                                                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                                                المجموع: {((item.price * item.quantity) - (item.discountType === 'amount' ? (item.discountValue || 0) : (item.price * item.quantity * (item.discountValue || 0) / 100))).toLocaleString()} ج.م
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl flex flex-col items-center justify-center p-4 border border-slate-100 dark:border-slate-700/50">
                                                        {item.thumbnail ? (
                                                            <img src={item.thumbnail} className="w-full aspect-square object-cover rounded-xl shadow-sm mb-3" referrerPolicy="no-referrer" />
                                                        ) : (
                                                            <div className="w-full aspect-square bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center mb-3">
                                                                <Package size={40} className="text-slate-300" />
                                                            </div>
                                                        )}
                                                        <div className="text-center">
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">الوزن التقديري</p>
                                                            <p className="text-xs font-black text-slate-700 dark:text-slate-200">{item.weight || 0} كجم</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    <button 
                                        type="button" 
                                        onClick={addItem} 
                                        className="w-full py-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={20} />
                                        <span>إضافة منتج آخر</span>
                                    </button>
                                 </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="lg:col-span-5 space-y-8">
                        {isExchange && (
                            <>
                                {/* تفاصيل الشحنة المرسلة جديدة */}
                                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-5 text-right">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
                                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                                            <Package size={18} className="text-indigo-500" />
                                            تفاصيل الشحنة
                                        </h4>
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">اختر من المنتجات</span>
                                            <div className="relative">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer" 
                                                    checked={!!orderData.useProductsForShipment}
                                                    onChange={e => handleFieldChange('useProductsForShipment', e.target.checked)}
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:content-[''] after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                            </div>
                                        </label>
                                    </div>

                                    {orderData.useProductsForShipment ? (
                                        <div className="space-y-3">
                                            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                                {(orderData.items || []).length === 0 && (
                                                    <div className="p-5 border border-dashed border-slate-200 dark:border-slate-700/60 rounded-xl text-center bg-white/40 dark:bg-slate-900/10">
                                                        <Package className="mx-auto mb-2 opacity-35 text-slate-400" size={20} />
                                                        <p className="text-xs font-bold text-slate-500">لم يتم إضافة أي منتج للطلب بعد</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">اضغط على زر "إضافة منتج" بالأسفل لبدء التحديد.</p>
                                                    </div>
                                                )}
                                                {(orderData.items || []).map((item, index) => {
                                                    const product = settings.products.find(p => p.id === item.productId);
                                                    const hasVariants = product?.variants && product.variants.length > 0;
                                                    const selectedVariant = hasVariants ? product.variants?.find(v => v.id === item.variantId) : null;
                                                    const stock = hasVariants ? (selectedVariant?.stock || 0) : (product?.stock || 0);

                                                    return (
                                                        <div key={index} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 relative group text-right">
                                                            <button type="button" onClick={() => removeItem(index)} className="absolute top-3 left-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded-full z-10">
                                                                <XCircle size={20}/>
                                                            </button>
                                                            <ProductSelect 
                                                                 value={item.productId} 
                                                                 onChange={val => handleItemChange(index, 'productId', val)} 
                                                                 products={settings.products}
                                                                 index={index}
                                                            />
                                                            
                                                            {hasVariants && (
                                                                <select value={item.variantId || ''} onChange={e => handleItemChange(index, 'variantId', e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all dark:text-white">
                                                                    <option value="">بدون متغيرات</option>
                                                                    {product.variants?.map(v => (
                                                                        <option key={v.id} value={v.id}>
                                                                            {Object.entries(v.options || {}).map(([k, val]) => `${k}: ${val}`).join(', ')}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}

                                                            <div className="flex gap-3 items-center">
                                                                <div className="w-20 font-sans">
                                                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">الكمية</label>
                                                                    <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-xs" />
                                                                </div>
                                                                <div className="flex-1 font-sans">
                                                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">السعر</label>
                                                                    <input type="number" min="0" value={item.price} onChange={e => handleItemChange(index, 'price', Number(e.target.value))} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-xs" />
                                                                </div>
                                                                <div className="flex-1 font-sans">
                                                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">الخصم</label>
                                                                    <div className="flex gap-1">
                                                                        <input type="number" min="0" value={item.discountValue || 0} onChange={e => handleItemChange(index, 'discountValue', Number(e.target.value))} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-xs" />
                                                                        <select value={item.discountType || 'amount'} onChange={e => handleItemChange(index, 'discountType', e.target.value)} className="p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] outline-none dark:text-white">
                                                                            <option value="amount">مبلغ</option>
                                                                            <option value="percentage">%</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 text-center text-[10px] font-bold text-slate-500 pt-5">
                                                                    المخزون: <span className={stock < item.quantity ? 'text-red-500' : 'text-emerald-500'}>{stock}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <button type="button" onClick={addItem} className="w-full mt-2 p-3 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-bold rounded-xl text-sm border border-amber-100 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2">
                                                <Plus size={16} /> إضافة منتج
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="sm:col-span-1">
                                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">عدد القطع</label>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        value={orderData.shipmentQuantity || 1} 
                                                        onChange={e => handleFieldChange('shipmentQuantity', Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500" 
                                                    />
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="text-xs font-bold text-slate-605 dark:text-slate-400 mb-1 block flex justify-between">
                                                        <span>وصف المنتج</span>
                                                        <span className="text-[10px] text-slate-400">اختياري</span>
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="تيشيرت، إكسسوارات، عطر، كتاب ...إلخ"
                                                        value={orderData.shipmentDescription || ''}
                                                        onChange={e => handleFieldChange('shipmentDescription', e.target.value)}
                                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500" 
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">سعر الشحنة المرسلة جديدة (ج.م)</label>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    value={orderData.customShipmentPrice || 0} 
                                                    onChange={e => handleFieldChange('customShipmentPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                                    className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500" 
                                                    placeholder="أدخل قيمة المنتجات المرسلة"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-100/50 dark:border-cyan-900/40 rounded-xl flex gap-3.5 text-right items-start">
                                        <Info size={16} className="text-cyan-500 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-cyan-850 dark:text-cyan-300 leading-relaxed font-medium">
                                            إضافة صورة ووصف للمنتج تساعدنا علي التحقق من الشحنة في حالات الإرجاع أو الاستبدال و تقلل إمكانية فقد الشحنة.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {(isExchange || isReturn) && (
                            <>
                                {/* تفاصيل الشحنة المرتجعة */}
                                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-5 text-right">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
                                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                                            <RefreshCcw size={18} className="text-rose-500 animate-spin-slow" />
                                            تفاصيل الشحنة المرتجعة
                                        </h4>
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">اختر من المنتجات</span>
                                            <div className="relative">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer" 
                                                    checked={!!orderData.useProductsForReturn}
                                                    onChange={e => handleFieldChange('useProductsForReturn', e.target.checked)}
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:content-[''] after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                            </div>
                                        </label>
                                    </div>

                                    {orderData.useProductsForReturn ? (
                                        <div className="space-y-4 text-right">
                                            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 relative">
                                                <label className="text-xs font-black text-slate-600 dark:text-slate-400 mb-1 block">المنتج المرتجع</label>
                                                <ProductSelect 
                                                     value={orderData.returnProductId || ''} 
                                                     onChange={val => handleReturnProductChange(val)} 
                                                     products={settings.products}
                                                     index={0}
                                                />
                                                
                                                {(() => {
                                                    const prod = settings.products.find(p => p.id === orderData.returnProductId);
                                                    const hasVariants = prod?.variants && prod.variants.length > 0;
                                                    if (!hasVariants) return null;
                                                    return (
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">اختر نوع/متغير المنتج المرتجع</label>
                                                            <select 
                                                                value={orderData.returnVariantId || ''} 
                                                                onChange={e => handleReturnVariantChange(e.target.value)} 
                                                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all dark:text-white"
                                                            >
                                                                <option value="">بدون متغيرات</option>
                                                                {prod.variants?.map(v => (
                                                                    <option key={v.id} value={v.id}>
                                                                        {Object.entries(v.options || {}).map(([k, val]) => `${k}: ${val}`).join(', ')}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    );
                                                })()}

                                                <div className="flex gap-4 items-center">
                                                    <div className="w-24 font-sans">
                                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">الكمية</label>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={orderData.returnQuantity || 1} 
                                                            onChange={e => {
                                                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                handleFieldChange('returnQuantity', val);
                                                            }} 
                                                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-sm" 
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">الوصف للمستودع</label>
                                                        <input 
                                                            type="text" 
                                                            disabled 
                                                            value={orderData.returnDescription || 'يرجى اختيار المنتج مرتجع'} 
                                                            className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-500" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="sm:col-span-1">
                                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">عدد القطع</label>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        value={orderData.returnQuantity || 1} 
                                                        onChange={e => handleFieldChange('returnQuantity', Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500" 
                                                    />
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="text-xs font-bold text-slate-605 dark:text-slate-400 mb-1 block flex justify-between">
                                                        <span>وصف المنتج</span>
                                                        <span className="text-[10px] text-slate-400">اختياري</span>
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="تيشيرت، إكسسوارات، عطر، كتاب ...إلخ"
                                                        value={orderData.returnDescription || ''}
                                                        onChange={e => handleFieldChange('returnDescription', e.target.value)}
                                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500" 
                                                    />
                                                </div>
                                            </div>

                                            {/* صورة المنتج اختياري */}
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block flex justify-between">
                                                    <span>صورة المنتج المرتجع</span>
                                                    <span className="text-[10px] text-slate-400">اختياري</span>
                                                </label>

                                                {orderData.returnImage ? (
                                                    <div className="relative border border-slate-200 dark:border-slate-850 p-2.5 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 overflow-hidden border border-slate-100 dark:border-slate-700 flex-shrink-0">
                                                                <img src={orderData.returnImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                            </div>
                                                            <span className="text-xs text-slate-500 select-none truncate max-w-[150px] font-mono">{orderData.returnImage}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFieldChange('returnImage', '')}
                                                            className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-550 text-xs font-bold rounded-lg transition-colors border border-red-200/50"
                                                        >
                                                            إلغاء
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        onClick={() => {
                                                            const url = prompt('أدخل رابط الصورة أو الصق رابط صورة المنتج المرتجع:');
                                                            if (url) {
                                                                handleFieldChange('returnImage', url);
                                                            }
                                                        }}
                                                        className="border-2 border-dashed border-slate-205 dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-amber-500/80 p-8 rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer bg-white/50 dark:bg-slate-900/40 text-center shadow-inner"
                                                    >
                                                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-full">
                                                            <UploadCloud size={22}/>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">اضغط للرفع أو اسحب وأرفق صورة المنتجات</p>
                                                            <p className="text-[10px] text-slate-400 mt-1">يدعم JPG, PNG - بحد أقصى (800x400px)</p>
                                                        </div>
                                                    </div>
                                                )}
                                                <p className="text-[10px] text-slate-400 font-bold block mt-1">هذا سيساعدنا في استلام الشحنة الصحيحة من عميلك.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-100/50 dark:border-cyan-900/40 rounded-xl flex gap-3.5 text-right items-start">
                                        <Info size={16} className="text-cyan-500 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-cyan-850 dark:text-cyan-300 leading-relaxed font-medium">
                                            إضافة صورة ووصف للمنتج تساعدنا علي التحقق من الشحنة في حالات الإرجاع أو الاستبدال و تقلل إمكانية فقد الشحنة.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}

                        {isCashCollection && (
                             <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                                 <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-lg">
                                     <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                                         <Coins size={20}/>
                                     </div>
                                     تفاصيل التحصيل النقدي
                                 </h4>
                                 <div className="space-y-5">
                                     <div>
                                         <label className="text-[10px] text-slate-500 font-bold uppercase mr-1 mb-2 block">المبلغ المطلوب تحصيله من العميل</label>
                                         <input 
                                             type="number" 
                                             min="0" 
                                             value={orderData.customShipmentPrice || 0} 
                                             onChange={e => handleFieldChange('customShipmentPrice', Number(e.target.value))} 
                                             className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl font-black text-xl text-center text-amber-600 outline-none focus:border-amber-400 transition-all"
                                             placeholder="0"
                                         />
                                     </div>
                                     <div>
                                         <label className="text-[10px] text-slate-500 font-bold uppercase mr-1 mb-2 block">سبب التحصيل / ملاحظات</label>
                                         <textarea 
                                             value={orderData.shipmentDescription || ''} 
                                             onChange={e => handleFieldChange('shipmentDescription', e.target.value)} 
                                             className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl h-24 text-sm font-bold resize-none outline-none dark:text-white"
                                             placeholder="مثال: تحصيل مديونية سابقة، عربون طلب كبير..."
                                         />
                                     </div>
                                 </div>
                             </div>
                        )}
                        
                        {/* Financial Summary */}
                            <div className="p-8 bg-indigo-900 dark:bg-indigo-950 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-110"></div>
                                <h4 className="font-black text-white mb-8 flex items-center gap-3 text-lg relative z-10">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                                        <FileText size={20} className="text-indigo-200"/>
                                    </div>
                                    الملخص المالي للطلب
                                </h4>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between font-bold text-slate-300 text-sm">
                                        <span>المجموع الفرعي {orderData.source === 'synced' ? '(المنصة)' : ''}</span>
                                        <span>{(orderData.source === 'synced' && orderData.totalPrice ? orderData.totalPrice : subtotal).toLocaleString()} ج.م</span>
                                    </div>

                                    {!isReturn && !isCashCollection && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                                                    <span>مصاريف الشحن</span>
                                                    <span className="text-indigo-400">تلقائي</span>
                                                </label>
                                                <input 
                                                    type="number" 
                                                    value={orderData.shippingFee || 0} 
                                                    onChange={e => handleFieldChange('shippingFee', Number(e.target.value))} 
                                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white outline-none focus:bg-white/10 transition-all text-sm" 
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] text-slate-400 font-bold uppercase">خصم إضافي</label>
                                                <input 
                                                    type="number" 
                                                    value={orderData.discount || 0} 
                                                    onChange={e => handleFieldChange('discount', Number(e.target.value))} 
                                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white outline-none focus:bg-white/10 transition-all text-sm" 
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {isExchange && (
                                        <div className="flex justify-between font-bold text-orange-400 bg-orange-400/10 p-3.5 rounded-2xl border border-orange-400/20 text-xs">
                                            <span>رصيد سابق (إستبدال)</span>
                                            <span>-{creditAmount.toLocaleString()} ج.م</span>
                                        </div>
                                    )}
                                    
                                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex justify-between items-center group transition-all hover:bg-white/10">
                                        <div>
                                            <span className="font-black text-indigo-200 text-sm flex items-center gap-2">
                                                {finalAmount >= 0 ? 'المطلوب تحصيله' : 'المستحق للعميل'}
                                            </span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="font-black text-white text-2xl">{Math.abs(orderData.totalAmountOverride ?? (orderData.source === 'synced' && orderData.totalPrice ? orderData.totalPrice : finalAmount)).toLocaleString()} ج.م</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowEditTotalModal(true)}
                                                    className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 shadow-lg group-hover:scale-110 transition-transform"
                                                >
                                                    <Edit3 size={12}/>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-200 border border-indigo-500/30">
                                            <Calculator size={20}/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Advance Payment Section */}
                            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                                <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center justify-between text-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                            <Coins size={20}/>
                                        </div>
                                        العربون والدفع المقدم
                                    </div>
                                    {orderData.advancePayment > 0 && (
                                        <span className="text-xs font-black px-3 py-1 bg-emerald-500 text-white rounded-full">مفعل</span>
                                    )}
                                </h4>
                                
                                <div className="space-y-5">
                                    <div className="relative group">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mr-1 mb-2 block tracking-wider">مبلغ العربون المستلم من العميل</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            value={orderData.advancePayment || 0} 
                                            onChange={e => handleFieldChange('advancePayment', Number(e.target.value))} 
                                            className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl font-black text-xl text-center text-emerald-600 outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all"
                                            placeholder="0"
                                        />
                                        <div className="absolute top-[3.25rem] left-5 pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors text-xs font-black uppercase">ج.م</div>
                                    </div>

                                    {orderData.advancePayment > 0 && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-5 bg-slate-50/50 dark:bg-slate-800/50 rounded-3xl border border-slate-200/50 dark:border-slate-700/50">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1 tracking-wider leading-none mb-1 block">حساب الاستلام / الخزينة</label>
                                                <select 
                                                    value={orderData.advancePaymentTreasuryId ? `treasury_${orderData.advancePaymentTreasuryId}` : (orderData.advancePaymentPartnerId ? `partner_${orderData.advancePaymentPartnerId}` : '')} 
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val.startsWith('treasury_')) {
                                                            handleFieldChange('advancePaymentTreasuryId', val.replace('treasury_', ''));
                                                            handleFieldChange('advancePaymentPartnerId', '');
                                                        } else if (val.startsWith('partner_')) {
                                                            handleFieldChange('advancePaymentPartnerId', val.replace('partner_', ''));
                                                            handleFieldChange('advancePaymentTreasuryId', '');
                                                        } else {
                                                            handleFieldChange('advancePaymentPartnerId', ''); handleFieldChange('advancePaymentTreasuryId', '');
                                                        }
                                                    }} 
                                                    className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black outline-none"
                                                >
                                                    <option value="">-- اختر حساب الاستلام --</option>
                                                    {treasury?.accounts && <optgroup label="الحسابات البنكية">
                                                        {treasury.accounts.map((acc: any) => (<option key={`treasury_${acc.id}`} value={`treasury_${acc.id}`}>{acc.name}</option>))}
                                                    </optgroup>}
                                                    {settings.partners && <optgroup label="محافظ الشركاء">
                                                        {settings.partners.map(p => (<option key={`partner_${p.id}`} value={`partner_${p.id}`}>{p.name}</option>))}
                                                    </optgroup>}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input type="text" placeholder="هاتف المستلم..." value={orderData.advancePaymentRecipientPhone || ''} onChange={e => handleFieldChange('advancePaymentRecipientPhone', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black outline-none" />
                                                <input type="text" placeholder="بيانات المحول..." value={orderData.advancePaymentSenderDetails || ''} onChange={e => handleFieldChange('advancePaymentSenderDetails', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black outline-none" />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>

                            {/* Profit Simulator - Modernized */}
                            <div className="p-8 bg-emerald-950 dark:bg-black rounded-[2rem] border border-emerald-500/20 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
                                <h4 className="font-extrabold text-emerald-400 text-sm flex items-center gap-2 mb-6 uppercase tracking-[0.2em] relative z-10 leading-none">
                                    <Sparkles size={16} className="animate-pulse" />
                                    محاكي الربحية الحية
                                </h4>
                                <div className="grid grid-cols-2 gap-2 relative z-10">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                                        <p className="text-[9px] text-emerald-300/60 font-black uppercase tracking-tight mb-1">تكلفة البضاعة</p>
                                        <p className="text-sm font-black text-white italic">{liveProfitMargin.costOfItems.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                                        <p className="text-[9px] text-emerald-300/60 font-black uppercase tracking-tight mb-1">مصاريف التشغيل</p>
                                        <p className="text-sm font-black text-white italic">{(liveProfitMargin.insuranceFee + liveProfitMargin.codFee).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="mt-4 p-5 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 flex justify-between items-center relative z-10">
                                    <div>
                                        <p className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.15em] mb-1">صافي الربح المتوقع</p>
                                        <h3 className="text-2xl font-black text-emerald-400 tracking-tighter italic">
                                            {liveProfitMargin.profit.toLocaleString()}
                                            <span className="text-[10px] ml-1 uppercase not-italic opacity-60">L.E</span>
                                        </h3>
                                    </div>
                                    <div className="text-right">
                                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-emerald-950 font-black text-xs shadow-lg shadow-emerald-500/20">
                                            {liveProfitMargin.profitPercent}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Settings - Modernized */}
                            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
                                 <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                                     <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <SettingsIcon size={18}/>
                                     </div>
                                     إعدادات إضافية
                                 </h4>
                                 <div className="grid grid-cols-1 gap-3">
                                    <button type="button" onClick={() => handleFieldChange('includeInspectionFee', !orderData.includeInspectionFee)} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${orderData.includeInspectionFee ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${orderData.includeInspectionFee ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                            {orderData.includeInspectionFee && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                        </div>
                                        <span className="font-black text-xs uppercase tracking-wider">تفعيل رسوم المعاينة</span>
                                    </button>
                                    <button type="button" onClick={() => handleFieldChange('isInsured', !orderData.isInsured)} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${orderData.isInsured !== false ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${orderData.isInsured !== false ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                            {orderData.isInsured !== false && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                        </div>
                                        <span className="font-black text-xs uppercase tracking-wider">تأمين الشحنة</span>
                                    </button>
                                 </div>
                            </div>
                        </div>
                    </div>

                    {showEditTotalModal && (
                        <EditTotalModal 
                            currentTotal={orderData.totalAmountOverride ?? finalAmount}
                            onClose={() => setShowEditTotalModal(false)}
                            onApply={(amount, reason) => {
                                handleFieldChange('totalAmountOverride', amount);
                                handleFieldChange('totalAmountOverrideReason', reason);
                                setShowEditTotalModal(false);
                            }}
                        />
                    )}

                    <div className="px-10 py-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 flex items-center justify-between rounded-b-[2.5rem] sticky bottom-0 z-50">
                        <div className="flex items-center gap-10">
                             <div className="hidden sm:block text-right">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2 leading-none">الإجمالي المطلوب</p>
                                <h3 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 leading-none italic tracking-tighter">
                                    {finalAmount.toLocaleString()} <span className="text-xs uppercase opacity-30 not-italic tracking-normal">ج.م</span>
                                </h3>
                             </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button type="button" onClick={onClose} className="px-8 font-black text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all text-sm uppercase tracking-widest">إلغاء</button>
                            <button type="submit" className="h-16 px-12 bg-indigo-600 dark:bg-indigo-500 text-white font-black rounded-3xl shadow-[0_20px_40px_-5px_rgba(79,70,229,0.3)] hover:bg-indigo-700 hover:scale-[1.05] active:scale-[0.98] transition-all flex items-center gap-4 text-base">
                                <span>{isEditing ? 'حفظ التحديثات' : 'تأكيد الطلب'}</span>
                                <ArrowLeft size={20} strokeWidth={3}/>
                            </button>
                        </div>
                    </div>
                </motion.form>
            </div>
        );
};
interface OrderConfirmationSummaryProps { order: Order; settings: Settings; onClose: () => void; storeName: string; }
const OrderConfirmationSummary: React.FC<OrderConfirmationSummaryProps> = ({ order, settings, onClose, storeName }) => {
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const inspectionFee = order.includeInspectionFee ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0;
    const insuranceRate = order.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0;
    const insuranceFee = calculateInsuranceFee(order, insuranceRate, settings);
    const safeAdvance = Number(order.advancePayment) || 0;
    const total = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - order.discount - safeAdvance + inspectionFee);
    
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-sm">
                    <CheckCircle size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">تم إنشاء الطلب بنجاح!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">ملخص الطلب المالي للعميل <span className="font-bold text-slate-700 dark:text-slate-200">{order.customerName}</span></p>
                <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-500">إجمالي المنتجات:</span>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.productPrice.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">مصاريف الشحن:</span>
                            {(order.weight || 0) > 0 && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">(الوزن: {order.weight.toFixed(2)} كجم)</span>
                            )}
                        </div>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.shippingFee.toLocaleString()} ج.م</span>
                    </div>
                    {inspectionFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم المعاينة:</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {insuranceFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم التأمين ({insuranceRate}%):</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{insuranceFee.toFixed(2)} ج.م</span>
                        </div>
                    )}
                    {order.discount > 0 && (
                        <div className="flex justify-between items-center text-sm text-red-500">
                            <span className="font-bold">الخصم:</span>
                            <span className="font-black">-{order.discount.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                    <div className="flex justify-between items-center text-xl">
                        <span className="font-black text-indigo-600 dark:text-indigo-400">الإجمالي المطلوب تحصيله:</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} ج.م</span>
                    </div>
                    {order.totalAmountOverride !== undefined && order.totalAmountOverrideReason && (
                        <div className="mt-3 text-right">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider mb-1">سبب تعديل الإجمالي</span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 italic">
                                "{order.totalAmountOverrideReason}"
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-3 mt-8">
                    <button 
                        onClick={() => {
                            const html = generateInvoiceHTML(order, settings, storeName);
                            printHTMLDirectly(html);
                        }}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3"
                    >
                        <Printer size={20} />
                        <span>طباعة الفاتورة</span>
                    </button>
                    <button 
                        onClick={() => {
                            const html = generateShippingLabelHTML(order, storeName);
                            printHTMLDirectly(html);
                        }}
                        className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-3"
                    >
                        <FileDown size={20} />
                        <span>طباعة بوليصة الشحن</span>
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-full py-3 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-all mt-2"
                    >
                        إغلاق الملخص
                    </button>
                </div>
            </div>
        </div>
    );
};
const ConfirmationModal: React.FC<{ title: string; description: string; onConfirm: (deleteRelated?: boolean) => void; onCancel: () => void; checkboxLabel?: string; }> = ({ title, description, onConfirm, onCancel, checkboxLabel }) => {
    const [deleteRelated, setDeleteRelated] = React.useState(false);
    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{description}</p>
                
                {checkboxLabel && (
                    <label className="flex items-center gap-2 mb-6 text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-3 rounded-xl transition-all">
                        <input 
                            type="checkbox" 
                            checked={deleteRelated}
                            onChange={(e) => setDeleteRelated(e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{checkboxLabel}</span>
                    </label>
                )}
                
                <div className="flex flex-col gap-2">
                    <button onClick={() => onConfirm(deleteRelated)} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-sm hover:shadow">
                        تأكيد الحذف
                    </button>
                    <button onClick={onCancel} className="w-full py-3 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all">
                        تراجع
                    </button>
                </div>
            </div>
        </div>
    );
};
interface OrderPreConfirmationModalProps { order: Omit<Order, 'id'>; settings: Settings; onConfirm: () => void; onCancel: () => void; }
const OrderPreConfirmationModal: React.FC<OrderPreConfirmationModalProps> = ({ order, settings, onConfirm, onCancel }) => {
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const inspectionFee = order.includeInspectionFee ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0;
    const insuranceRate = order.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0;
    const insuranceFee = calculateInsuranceFee(order as Order, insuranceRate, settings);
    const safeAdvance = Number((order as any).advancePayment) || 0;
    const total = (order as any).totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0) - safeAdvance + inspectionFee);
    
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-sm">
                    <AlertTriangle size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">هل أنت متأكد من تفاصيل الطلب؟</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">يرجى مراجعة الملخص المالي قبل تأكيد الطلب.</p>
                <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-500">إجمالي المنتجات:</span>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.productPrice.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">مصاريف الشحن:</span>
                            {(order.weight || 0) > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">(الوزن: {order.weight.toFixed(2)} كجم)</span>
                            )}
                        </div>
                        <span className="font-black text-slate-700 dark:text-slate-200">{order.shippingFee.toLocaleString()} ج.م</span>
                    </div>
                    {inspectionFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم المعاينة:</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    {insuranceFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">رسوم التأمين ({insuranceRate}%):</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{insuranceFee.toFixed(2)} ج.م</span>
                        </div>
                    )}
                    {order.discount > 0 && (
                        <div className="flex justify-between items-center text-sm text-red-500">
                            <span className="font-bold">الخصم:</span>
                            <span className="font-black">-{order.discount.toLocaleString()} ج.م</span>
                        </div>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                    <div className="flex justify-between items-center text-xl">
                        <span className="font-black text-indigo-600 dark:text-indigo-400">الإجمالي المطلوب تحصيله:</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{total.toLocaleString()} ج.م</span>
                    </div>
                </div>
                <div className="mt-8 flex gap-3">
                    <button onClick={onConfirm} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm hover:shadow">
                        تأكيد وإضافة
                    </button>
                    <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        رفض وتعديل
                    </button>
                </div>
            </div>
        </div>
    );
};

const AutoWhatsappModal: React.FC<{
    order: Order;
    newStatus: string;
    onClose: () => void;
    settings: Settings;
}> = ({ order, newStatus, onClose, settings }) => {
    const defaultTemplate = settings.whatsappTemplates?.find((t) => t.id === 'confirm')?.text || 
        'أهلاً [اسم العميل] 👋، تم تحديث حالة طلبك [اسم المنتج] إلى [حالة الطلب].';
    
    const [message, setMessage] = useState('');

    useEffect(() => {
        let msg = defaultTemplate;
        msg = msg.replace(/\[اسم العميل\]/g, order.customerName || 'عميلنا العزيز');
        msg = msg.replace(/\[اسم المتجر\]/g, 'متجرنا');
        msg = msg.replace(/\[اسم المنتج\]/g, (order.items || []).map(i => i.name).join(' و '));
        msg = msg.replace(/\[حالة الطلب\]/g, newStatus.replace(/_/g, ' '));
        setMessage(msg);
    }, [order, newStatus, defaultTemplate, settings]);

    const handleSend = () => {
        const phone = order.customerPhone.replace(/[^0-9]/g, '');
        const formattedPhone = phone.startsWith('20') ? phone : `20${phone.replace(/^0+/, '')}`;
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                            <MessageSquare size={24}/>
                        </div>
                        <h3 className="text-xl font-black dark:text-white">إشعار تحديث الحالة</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                    هل تود تنبيه العميل بتغير حالة الطلب إلى <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg">{newStatus.replace(/_/g, ' ')}</span>؟
                </p>
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 mb-2">نص رسالة الواتساب:</label>
                    <textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[120px] resize-none"
                    />
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={handleSend}
                        className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                    >
                        إرسال عبر الواتساب
                        <ExternalLink size={18} />
                    </button>
                    <button 
                        onClick={onClose}
                        className="py-3.5 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-50 dark:hover:bg-slate-700 transition-all whitespace-nowrap"
                    >
                        تخطي
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrdersList;
