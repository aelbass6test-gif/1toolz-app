import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Edit3, ChevronDown, Package, MapPin, Coins, FileSearch, AlertCircle, ShieldCheck, ShieldAlert, Banknote, ShoppingBag, Save, XCircle, Info, UploadCloud, User as UserIcon, Building, Download, Filter, Truck, CheckCircle, RefreshCcw, Briefcase, ChevronLeft, ChevronRight, MoreVertical, Percent, Lock, Unlock, Receipt, AlertTriangle, MessageCircle, Printer, Wand2, FileText, Phone, Archive, ArrowRightLeft, Image as ImageIcon, FileDown, LayoutList, LayoutGrid, Settings as SettingsIcon, X, PhoneForwarded, Users, ExternalLink, Link as LinkIcon, MessageSquare, Clock, Shield, Check, TrendingUp, TrendingDown } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(defaultShowAdd || false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Synchronize modal state on route/parameter change for "/create-order"
  useEffect(() => {
    if (defaultShowAdd) {
      setShowAddModal(true);
    } else {
      setShowAddModal(false);
    }
  }, [defaultShowAdd]);

  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState<Order | null>(null);
  const [autoWhatsappData, setAutoWhatsappData] = useState<{order: Order, newStatus: string} | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Polling for real-time updates
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
          const res = await fetch(`/api/sync/all/${activeStore.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
          });
          if (res.ok) {
              const data = await res.json();
              await onRefresh();
              const totalSynced = (data.results || []).reduce((acc: number, r: any) => acc + (r.inserted || 0), 0);
              const totalUpdated = (data.results || []).reduce((acc: number, r: any) => acc + (r.updated || 0), 0);
              
              if (totalSynced > 0 || totalUpdated > 0) {
                  let message = 'تمت المزامنة بنجاح!';
                  if (totalSynced > 0) message += `\n- تم استيراد ${totalSynced} طلب جديد.`;
                  if (totalUpdated > 0) message += `\n- تم تحديث حالة ${totalUpdated} طلب.`;
                  alert(message);
              } else {
                  alert('لا توجد طلبات جديدة أو تحديثات حالياً.');
              }
          }
      } else {
          await onRefresh();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };
  
  const [activeTab, setActiveTab] = useState('الجميع');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
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


  const getInitialNewOrder = (): NewOrderState => ({
    orderNumber: '', date: new Date().toISOString(), shippingCompany: activeCompanies[0] || 'ارامكس', shippingArea: '', customerName: '', customerPhone: '',
    customerPhone2: '', country: 'مصر', buildingDetails: '',
    items: [], shippingFee: 0, status: 'في_انتظار_المكالمة', includeInspectionFee: true, isInsured: true,
    paymentStatus: 'بانتظار الدفع', preparationStatus: 'بانتظار التجهيز', discount: 0, notes: '',
    orderType: 'standard', originalOrderId: undefined,
    shipmentType: 'delivery',
    totalAmountOverrideReason: '', paymentMethod: 'cod',
    advancePayment: 0, 
    advancePaymentPartnerId: '',
    advancePaymentTreasuryId: '',
    advancePaymentRecipientPhone: '',
    advancePaymentSenderDetails: '',
    useProductsForShipment: false,
    shipmentDescription: '',
    shipmentQuantity: 1,
    customShipmentPrice: 0,
    useProductsForReturn: false,
    returnProductId: '',
    returnVariantId: '',
    returnDescription: '',
    returnQuantity: 1,
    returnImage: ''
  });

  const [newOrder, setNewOrder] = useState<NewOrderState>(getInitialNewOrder());

  // Normalization logic for synced orders when editing
  const normalizeSyncedOrder = (order: Order): Order => {
    if (order.source !== 'synced') return order;

    const GOVERNORATE_MAP: Record<string, string> = {
        'CAIRO': 'القاهرة', 'GIZA': 'الجيزة', 'ALEXANDRIA': 'الإسكندرية', 'QALYUBIA': 'القليوبية',
        'DAKAHLIA': 'الدقهلية', 'SHARKIA': 'الشرقية', 'GHARBIA': 'الغربية', 'MONUFIA': 'المنوفية',
        'BEHEIRA': 'البحيرة', 'KAFR EL SHEIKH': 'كفر الشيخ', 'KAFRELSHEIKH': 'كفر الشيخ',
        'DAMIETTA': 'دمياط', 'PORT SAID': 'بورسعيد', 'ISMAILIA': 'الإسماعيلية', 'SUEZ': 'السويس',
        'BENI SUEF': 'بني سويف', 'FAYOUM': 'الفيوم', 'MINYA': 'المنيا', 'ASSUIT': 'أسيوط',
        'SOhag': 'سوهاج', 'QENA': 'قنا', 'LUXOR': 'الأقصر', 'ASWAN': 'أسوان', 'RED SEA': 'البحر الأحمر',
        'NEW VALLEY': 'الوادي الجديد', 'MATROUH': 'مطروح', 'NORTH SINAI': 'شمال سيناء', 'SOUTH SINAI': 'جنوب سيناء'
    };

    const govKey = (order.governorate || order.shippingArea || '').toUpperCase();
    const mappedGov = GOVERNORATE_MAP[govKey] || order.governorate || order.shippingArea || '';

    // Fix item prices and product IDs
    const normalizedItems = (order.items || []).map(item => ({
      ...item,
      productId: item.productId.startsWith('wuilt-') ? item.productId : `wuilt-${item.productId}`,
      price: (item.price === 0 && (order.items || []).length === 1 && order.productPrice > 0) ? order.productPrice : item.price
    }));

    return {
      ...order,
      governorate: mappedGov,
      shippingArea: mappedGov,
      items: normalizedItems,
      // If shipping fee is 0 but present at root, ensure it's in orderData
      shippingFee: order.shippingFee || 0
    };
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(normalizeSyncedOrder(order));
    setShowAddModal(true);
  };

  useEffect(() => {
    if (!showAddModal && !editingOrder) {
        setNewOrder(getInitialNewOrder());
    }
  }, [showAddModal, editingOrder, settings, activeCompanies]);

  useEffect(() => {
    const orderData = editingOrder || newOrder;
    if (!orderData.shippingCompany && !orderData.governorate && !orderData.shippingArea) return;

    const options = settings?.shippingOptions?.[orderData.shippingCompany!] || [];
    const effectiveOptions = options.length > 0 ? options : generateEgyptShippingOptions();

    const selectedOpt = effectiveOptions.find(o => o.label === (orderData.governorate || orderData.shippingArea)) || effectiveOptions[0];
    if (selectedOpt) {
      let baseFee = selectedOpt.deliveryPrice || 0;
      let extraKgPrice = selectedOpt.extraKgPrice || 0;
      if (orderData.city) {
          const cityOpt = selectedOpt.cities?.find((c: any) => c.name === orderData.city);
          if (cityOpt) {
              if (cityOpt.useParentFees) {
                  baseFee = selectedOpt.deliveryPrice || 0;
                  extraKgPrice = selectedOpt.extraKgPrice || 0;
              } else if (cityOpt.deliveryPrice !== undefined && cityOpt.deliveryPrice !== null) {
                  baseFee = cityOpt.deliveryPrice;
                  extraKgPrice = cityOpt.extraKgPrice || 0;
              }
          }
      }

      const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
      const baseWeight = compFees?.useCustomFees && compFees.baseWeight !== undefined 
          ? compFees.baseWeight 
          : (settings.baseWeight !== undefined ? settings.baseWeight : 5);
          
      const totalWeight = orderData.items?.reduce((sum, item) => {
          const itemWeight = parseFloat(item.weight?.toString() || '0');
          const itemQuantity = parseInt(item.quantity?.toString() || '1');
          return sum + (itemWeight * itemQuantity);
      }, 0) || 0;

      const extraWeight = Math.max(0, totalWeight - baseWeight);
      const totalFee = baseFee + (Math.ceil(extraWeight) * extraKgPrice);
      
      if (orderData.shippingFee !== totalFee || (selectedOpt && orderData.shippingArea !== selectedOpt.label)) {
        if (editingOrder) {
          setEditingOrder(prev => (prev ? { ...prev, shippingFee: totalFee, shippingArea: selectedOpt.label } : prev));
        } else {
          setNewOrder(prev => ({ ...prev, shippingFee: totalFee, shippingArea: selectedOpt.label }));
        }
      }
    }
  }, [
    (editingOrder || newOrder).shippingCompany,
    (editingOrder || newOrder).governorate,
    (editingOrder || newOrder).shippingArea,
    (editingOrder || newOrder).city,
    JSON.stringify((editingOrder || newOrder).items?.map(i => ({ w: i.weight, q: i.quantity }))),
    settings.shippingOptions,
    settings.companySpecificFees,
    settings.baseWeight
  ]);

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

    const getNextOrderNumber = () => {
        const nums = orders
            .map(o => {
                const match = o.orderNumber.match(/\d+/);
                return match ? parseInt(match[0]) : null;
            })
            .filter((n): n is number => n !== null);
        return nums.length > 0 ? Math.max(...nums) + 1 : 1;
    };

    const handleAddOrder = (e: React.FormEvent) => {
      e.preventDefault();
      const orderData: NewOrderState = editingOrder || newOrder;
      
      const isExchangeCustom = orderData.shipmentType === 'exchange' && orderData.useProductsForShipment === false;
      const isReturn = orderData.shipmentType === 'return';
      const isCashCollection = orderData.shipmentType === 'cash_collection';
      
      const items = isExchangeCustom
        ? [{
            productId: 'custom-shipment',
            name: orderData.shipmentDescription || 'شحنة تبديل مرسلة',
            quantity: orderData.shipmentQuantity || 1,
            price: orderData.customShipmentPrice || 0,
            cost: 0,
            weight: 1,
            thumbnail: ''
          }]
        : (isReturn ? [{
            productId: 'return-shipment',
            name: orderData.useProductsForReturn ? (orderData.returnDescription || 'طلب إرجاع شحنة') : (orderData.returnDescription || 'طلب إرجاع شحنة'),
            quantity: orderData.returnQuantity || 1,
            price: 0,
            cost: 0,
            weight: 1,
            thumbnail: orderData.returnImage || ''
        }] : (isCashCollection ? [{
            productId: 'cash-collection',
            name: 'طلب تحصيل نقدي',
            quantity: 1,
            price: orderData.customShipmentPrice || 0,
            cost: 0,
            weight: 1,
            thumbnail: ''
        }] : (orderData.items || [])));
      
      if (items.length === 0) {
        alert("يجب إضافة منتج واحد على الأقل.");
        return;
      }
      
      const fullAddress = `${orderData.customerAddress}, ${orderData.buildingDetails || ''}`.trim();
      const finalNotes = orderData.notes || '';

      const totalProductPrice = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
      const totalProductCost = items.reduce((sum, item) => sum + (item.cost || 0) * (item.quantity || 1), 0);
      const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0);
      const productNames = items.map(item => item.name).join(', ');

      const totalBeforeAdvance = totalProductPrice + (orderData.shippingFee || 0) - (orderData.discount || 0);
      if ((orderData.advancePayment || 0) > totalBeforeAdvance) {
          alert("عفواً، لا يمكن أن يكون مبلغ العربون أكبر من إجمالي الطلب.");
          return;
      }

      const orderToAdd: Omit<Order, 'id'> & { totalAmountOverride?: number } = {
        ...(orderData as Omit<Order, 'id'>),
        items,
        customerAddress: fullAddress,
        notes: finalNotes,
        orderNumber: orderData.orderNumber || `${getNextOrderNumber()}`,
        productPrice: totalProductPrice,
        productCost: totalProductCost,
        weight: totalWeight,
        productName: productNames,
      };
    
    const creditAmount = orderData.creditAmount || 0;
    if (orderData.orderType === 'exchange' && creditAmount > 0) {
        const newTotal = (orderToAdd.productPrice + orderToAdd.shippingFee) - (orderToAdd.discount || 0);
        const finalAmount = newTotal - creditAmount;
        
        orderToAdd.totalAmountOverride = finalAmount;
        
        if (finalAmount <= 0) {
            orderToAdd.paymentStatus = 'مدفوع';
        } else {
            orderToAdd.paymentStatus = 'بانتظار الدفع';
        }
        
        orderToAdd.notes = `طلب استبدال للطلب #${orderData.originalOrderId}. تم تطبيق رصيد بقيمة ${creditAmount.toLocaleString()} ج.م.\n${orderToAdd.notes || ''}`.trim();
    }
    
    if (editingOrder) {
      setOrders(prevOrders => prevOrders.map(o => o.id === editingOrder.id ? { ...editingOrder, ...orderToAdd } as Order : o));
      setShowAddModal(false);
      setEditingOrder(null);
    } else {
      setOrderToConfirm(orderToAdd);
    }

    const oldAdvance = editingOrder?.advancePayment || 0;
    const newAdvance = orderToAdd.advancePayment || 0;
    const difference = newAdvance - oldAdvance;
    
    if (difference !== 0 && orderToAdd.advancePaymentPartnerId) {
        const partnerTx = {
             id: `adv-${Date.now()}`,
             partnerId: orderToAdd.advancePaymentPartnerId,
             type: difference > 0 ? 'customer_advance' : 'repayment',
             amount: Math.abs(difference),
             date: new Date().toISOString(),
             note: `عربون / دفع مقدم للطلب #${orderToAdd.orderNumber} ${difference < 0 ? '(تعديل بالنقصان)' : ''}`
        } as any;
        
        setSettings(prev => ({
             ...prev,
             partnerTransactions: [...(prev.partnerTransactions || []), partnerTx],
             partners: (prev.partners || []).map(p => p.id === orderToAdd.advancePaymentPartnerId ? { ...p, balance: (p.balance || 0) - difference } : p)
        }));
    } else if (difference !== 0 && orderToAdd.advancePaymentTreasuryId && setTreasury) {
        // Record advance payment in Treasury Account directly
        const treasuryTxId = `tx-${Date.now()}`;
        setTreasury((prev: any) => {
            const currentTreasury = prev || { accounts: [], transactions: [] };
            
            const updatedAccounts = currentTreasury.accounts.map((acc: any) => 
                acc.id === orderToAdd.advancePaymentTreasuryId 
                ? { ...acc, balance: acc.balance + difference } 
                : acc
            );

            const newTx = {
                id: treasuryTxId,
                date: new Date().toISOString(),
                type: difference > 0 ? 'deposit' : 'withdrawal',
                amount: Math.abs(difference),
                description: `عربون / دفع مقدم للطلب #${orderToAdd.orderNumber} ${difference < 0 ? '(استرداد)' : ''}`,
                toAccountId: difference > 0 ? orderToAdd.advancePaymentTreasuryId : undefined,
                fromAccountId: difference < 0 ? orderToAdd.advancePaymentTreasuryId : undefined,
            };

            return {
                accounts: updatedAccounts,
                transactions: [newTx, ...currentTreasury.transactions]
            };
        });
    }

    // Save/Update Customer Data
    const cleanPhone = (orderData.customerPhone || '').replace(/\s/g, '').replace('+2', '');
    if (cleanPhone) {
        setCustomers(prev => {
            const existing = prev.find(c => c.phone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
            if (existing) {
                return prev.map(c => c.id === existing.id ? { 
                    ...c, 
                    name: orderData.customerName || c.name,
                    address: orderData.customerAddress || c.address,
                    lastOrderDate: new Date().toISOString()
                } : c);
            } else {
                const newCustomer: CustomerProfile = {
                    id: `cust-${Date.now()}`,
                    name: orderData.customerName || '',
                    phone: orderData.customerPhone || '',
                    address: orderData.customerAddress || '',
                    totalOrders: 1,
                    successfulOrders: 0,
                    returnedOrders: 0,
                    totalSpent: 0,
                    lastOrderDate: new Date().toISOString(),
                    firstOrderDate: new Date().toISOString(),
                    averageOrderValue: 0,
                    loyaltyPoints: 0
                };
                return [newCustomer, ...prev];
            }
        });
    }
  };
  
  const handleConfirmAddOrder = () => {
    if (!orderToConfirm) return;
    const orderWithId: Order = { ...orderToConfirm, id: `order-${Date.now()}` } as Order;
    
    if (orderWithId.orderType === 'exchange' && orderWithId.originalOrderId) {
        setOrders(prevOrders => {
            const originalOrderUpdated = prevOrders.map(o => 
                o.id === orderWithId.originalOrderId ? { ...o, status: 'تم_الاستبدال' as OrderStatus } : o
            );
            return [orderWithId, ...originalOrderUpdated];
        });
    } else {
        setOrders(prevOrders => [orderWithId, ...prevOrders]);
    }

    triggerWebhooks(orderWithId, settings);

    setShowAddModal(false);
    setOrderToConfirm(null);
    setShowSummaryModal(orderWithId);
  };
  
  const handleDeleteOrder = () => {
    if (!orderToDelete) {
        console.error("handleDeleteOrder called with no order to delete.");
        return;
    }
    
    const orderIdToDelete = orderToDelete.id;
    const orderNumberToDelete = orderToDelete.orderNumber;
    
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
                updatedProducts[pIdx] = {
                    ...updatedProducts[pIdx],
                    stockQuantity: (updatedProducts[pIdx].stockQuantity || 0) - orderItem.quantity
                };
            }
        });
        newStockDeducted = true;
    } else if (!shouldBeDeducted && isCurrentlyDeducted) {
        (order.items || []).forEach(orderItem => {
            const pIdx = updatedProducts.findIndex(p => p.id === orderItem.productId);
            if (pIdx > -1) {
                updatedProducts[pIdx] = {
                    ...updatedProducts[pIdx],
                    stockQuantity: (updatedProducts[pIdx].stockQuantity || 0) + orderItem.quantity
                };
            }
        });
        newStockDeducted = false;
    }

    return { updatedProducts, stockDeducted: newStockDeducted };
  };

  const updateOrderStatus = async (id: string, newStatus: OrderStatus) => {
    const orderToUpdate = orders.find((o) => o.id === id);
    if (!orderToUpdate) return;

    if (newStatus === 'تم_الارسال' && !orderToUpdate.waybillNumber) {
        setOrderForWaybill({orderId: id, newStatus: newStatus});
        return;
    }

    const compSpecificFees = settings.companySpecificFees?.[orderToUpdate.shippingCompany];
    const useCustomFees = compSpecificFees?.useCustomFees ?? false;
    const isFlexShipEnabled = useCustomFees ? (compSpecificFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false);
    const configuredFlexShipFee = useCustomFees ? (compSpecificFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);

    let isFlexShipPaid = false;
    if (['مرتجع', 'فشل_التوصيل'].includes(newStatus) && isFlexShipEnabled && configuredFlexShipFee > 0 && !orderToUpdate.flexShipFeePaidByCustomer) {
        isFlexShipPaid = window.confirm(
            `الأوردر رقم ${orderToUpdate.orderNumber}\nخدمة فليكس شيب مفعلة لشركة الشحن (${orderToUpdate.shippingCompany}).\nهل قام المستلم بدفع رسوم الخدمة الإضافية بقيمة (${configuredFlexShipFee} ج.م) لرفضه استلام الشحنة؟`
        );
    }

    const orderWithFlexShip = {
        ...orderToUpdate,
        ...(isFlexShipPaid ? { flexShipFeePaidByCustomer: true, flexShipFee: configuredFlexShipFee } : {})
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
        const customerPaidInspection = order.includeInspectionFee ? window.confirm(`الأوردر رقم ${order.orderNumber}\nهل قام العميل بدفع رسوم المعاينة (الـ ${inspectionFee} ج)؟`) : false;
        handleCollectAction(updatedOrder, customerPaidInspection);
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
        setNewOrder({
            ...getInitialNewOrder(),
            customerName: originalOrder.customerName,
            customerPhone: originalOrder.customerPhone,
            customerAddress: originalOrder.customerAddress,
            shippingCompany: originalOrder.shippingCompany,
            shippingArea: originalOrder.shippingArea,
            orderType: 'exchange',
            originalOrderId: originalOrder.id,
            creditAmount: creditAmount,
        });
        setShowAddModal(true);
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
    const activeEmployees = settings.employees?.filter(e => e.status === 'active') || [];
    if (activeEmployees.length === 0) {
      alert("لا يوجد موظفين نشطين متاحين للتوزيع.");
      return;
    }
    const unassignedOrders = orders.filter(o => !o.assignedTo && o.status === 'في_انتظار_المكالمة');
    if (unassignedOrders.length === 0) {
      alert("لا توجد طلبات غير معينة في حالة انتظار المكالمة.");
      return;
    }
    
    if (window.confirm(`سيتم توزيع ${unassignedOrders.length} طلب على ${activeEmployees.length} موظف. هل أنت متأكد؟`)) {
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
      alert("تم التوزيع بنجاح.");
    }
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-1 truncate">سجل الطلبات</h1>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleManualRefresh}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm ${isRefreshing ? 'animate-spin text-indigo-600 border-indigo-200' : ''}`}
                title="مزامنة الطلبات"
              >
                <RefreshCcw size={18} />
                <span className="text-sm font-black uppercase tracking-tight">Sync</span>
              </motion.button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30">
                {filteredOrders.length} طلب نشط
              </div>
              <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30">
                المتجر: {activeStore?.id}
              </div>
            </div>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/create-order')}
            className="lg:hidden bg-indigo-600 text-white p-4 rounded-2xl font-black shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center shrink-0"
          >
            <Plus size={24} />
          </motion.button>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
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
            onClick={() => navigate('/create-order')}
            className="hidden lg:flex bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-indigo-500/25 transition-all items-center gap-3 text-sm shrink-0"
          >
            <Plus size={20} />
            <span>طلب جديد</span>
          </motion.button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'بانتظار المراجعة', count: quickStats.awaitingWaybill, icon: FileSearch, color: 'indigo', hideOnMobile: false },
          { label: 'قيد الشحن', count: quickStats.onTheWay, icon: Truck, color: 'blue', hideOnMobile: false },
          { label: 'تم التوصيل', count: quickStats.delivered, icon: CheckCircle, color: 'emerald', hideOnMobile: false },
          { label: 'مرتجع / فشل', count: quickStats.failed, icon: XCircle, color: 'rose', hideOnMobile: false },
          { label: 'طلبات ملغاة', count: quickStats.canceled, icon: Trash2, color: 'slate', hideOnMobile: true },
        ].map((stat, idx) => (
          <div key={idx} className={`bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${stat.hideOnMobile ? 'hidden lg:flex' : 'flex'}`}>
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
                  <th className="p-6">الشحن</th>
                  <th className="p-6">الحالة</th>
                  <th className="p-6">الدفع</th>
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
      {(showAddModal || editingOrder) && (
        <OrderModal 
          isOpen={showAddModal || !!editingOrder} 
          onClose={() => {
            setShowAddModal(false); 
            setEditingOrder(null);
            if (defaultShowAdd) {
              navigate('/orders');
            }
          }} 
          onSubmit={handleAddOrder} 
          orderData={editingOrder || newOrder} 
          setOrderData={editingOrder ? setEditingOrder as React.Dispatch<React.SetStateAction<any>> : setNewOrder} 
          settings={settings} 
          isEditing={!!editingOrder} 
          customers={uniqueCustomers} 
          orders={orders} 
          treasury={treasury}
        />
      )}
      
      {orderToConfirm && ( 
        <OrderPreConfirmationModal 
          order={orderToConfirm} 
          settings={settings} 
          onConfirm={handleConfirmAddOrder} 
          onCancel={() => {
            setOrderToConfirm(null);
            if (defaultShowAdd) {
              navigate('/orders');
            }
          }} 
        /> 
      )}
      {showSummaryModal && ( 
        <OrderConfirmationSummary 
          order={showSummaryModal} 
          settings={settings} 
          onClose={() => {
            setShowSummaryModal(null);
            if (defaultShowAdd) {
              navigate('/orders');
            }
          }} 
        /> 
      )}
      {orderToDelete && ( <ConfirmationModal title="حذف الطلب؟" description={`هل أنت متأكد من حذف طلب العميل "${orderToDelete.customerName}"؟`} onConfirm={handleDeleteOrder} onCancel={() => setOrderToDelete(null)} /> )}
      {orderForWaybill && orderForModal && ( <WaybillModal order={orderForModal} onClose={() => setOrderForWaybill(null)} onSave={handleSaveWaybill} /> )}
      
      {autoWhatsappData && (
        <AutoWhatsappModal 
            order={autoWhatsappData.order} 
            newStatus={autoWhatsappData.newStatus} 
            onClose={() => setAutoWhatsappData(null)} 
            settings={settings} 
        />
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

      {/* Status Badge */}
      <div className="mb-8">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl ${statusInfo.color} text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-md`}>
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
              {statusInfo.label}
          </div>
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

const ProfitBreakdown: React.FC<{ order: Order; settings: Settings }> = ({ order, settings }) => {
    const safeProductPrice = Number(order.productPrice) || 0;
    const safeShippingFee = Number(order.shippingFee) || 0;
    const safeDiscount = Number(order.discount) || 0;
    const safeProductCost = Number(order.productCost) || 0;
    const safeAdvance = Number(order.advancePayment) || 0;
    
    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    
    const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
    const insuranceFee = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
    const inspectionFee = (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
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
    const netProfit = amountCollectedFromCustomer - totalExpenses;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-xl space-y-6 min-w-[320px] text-right">
            <h4 className="text-lg font-black text-slate-800 dark:text-white pb-4 border-b border-slate-50 dark:border-slate-800">تفاصيل معادلة الربح</h4>
            
            <div className="space-y-4">
                {/* الإيرادات */}
                <div className="py-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">الإيرادات (ما يدفعه العميل):</p>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                            <span className="text-slate-500 font-bold">سعر المنتجات</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{safeProductPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                            <span className="text-slate-500 font-bold">رسوم الشحن على العميل</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{safeShippingFee.toLocaleString()}</span>
                        </div>
                        {safeTax > 0 && (
                            <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                <span className="text-slate-500 font-bold">الضريبة المضافة للعميل</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{safeTax.toLocaleString()}</span>
                            </div>
                        )}
                        {safeDiscount > 0 && (
                            <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                <span className="text-slate-500 font-bold">خصومات ومسماحات للعميل</span>
                                <span className="font-black text-rose-500 tabular-nums">-{safeDiscount.toLocaleString()}</span>
                            </div>
                        )}
                        {extraAdjustment !== 0 && (
                            <div className="flex justify-between items-center flex-row-reverse text-sm mb-2 border-t border-slate-100 dark:border-slate-800/50 pt-2 mt-2">
                                <span className="text-slate-500 font-bold">تسوية المبلغ المطلوب يدوياً</span>
                                <span className={`font-black ${extraAdjustment > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'} tabular-nums`}>
                                    {extraAdjustment > 0 ? '+' : ''}{extraAdjustment.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center flex-row-reverse text-sm bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg mt-2 border border-slate-100 dark:border-slate-700/50">
                            <span className="text-slate-700 dark:text-slate-300 font-black">إجمالي الإيرادات =</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">+{amountCollectedFromCustomer.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* التكاليف */}
                <div className="py-3 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 mt-1">المصروفات والتكاليف:</p>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                            <span className="text-slate-500 font-bold">تكلفة شراء المنتجات</span>
                            <span className="font-black text-rose-500 tabular-nums">-{safeProductCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                            <span className="text-slate-500 font-bold">تكلفة بوليصة الشحن (للشركة)</span>
                            <span className="font-black text-rose-500 tabular-nums">-{safeShippingFee.toLocaleString()}</span>
                        </div>
                        {insuranceFee > 0 && (
                            <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                <span className="text-slate-500 font-bold">التأمين على الشحنة</span>
                                <span className="font-black text-rose-500 tabular-nums">-{insuranceFee.toFixed(2)}</span>
                            </div>
                        )}
                        {bostaVatFee > 0 && (
                            <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                <span className="text-slate-500 font-bold">{dynamicVatLabel}</span>
                                <span className="font-black text-rose-500 tabular-nums">-{bostaVatFee.toFixed(2)}</span>
                            </div>
                        )}
                        {inspectionAdjustment > 0 && (
                            <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                <span className="text-slate-500 font-bold">المعاينة</span>
                                <span className="font-black text-rose-500 tabular-nums">-{inspectionAdjustment.toFixed(2)}</span>
                            </div>
                        )}
                        {codFee > 0 && (
                            <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                                <span className="text-slate-500 font-bold">رسوم التحصيل (COD)</span>
                                <span className="font-black text-rose-500 tabular-nums">-{codFee.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center flex-row-reverse text-sm bg-rose-50 dark:bg-rose-900/10 p-2 rounded-lg mt-2 border border-rose-100 dark:border-rose-900/30">
                            <span className="text-rose-700 dark:text-rose-300 font-black">إجمالي المصروفات =</span>
                            <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">-{totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* Cash Collection & Advance Payment Breakdown */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2 mt-4 text-xs font-bold">
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

                {/* Flex Ship Service Display */}
                {(() => {
                    const isFlexEnabled = useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false);
                    const flexFee = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);
                    if (isFlexEnabled && flexFee > 0) {
                        return (
                            <div className="p-4 bg-violet-50 dark:bg-violet-950/20 rounded-2xl border border-violet-100 dark:border-violet-900/40 text-xs text-right mt-4 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center flex-row-reverse text-violet-800 dark:text-violet-400 font-bold">
                                    <span className="flex items-center gap-1 font-black"><Truck size={14} className="inline"/> خدمة فليكس شيب (Flex Ship)</span>
                                    <span className="bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full text-[10px]">نشط</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                                    يُطالب المستلم بدفع رسوم إضافية بقيمة <strong className="text-violet-700 dark:text-violet-400 font-black">{flexFee} ج.م</strong> إذا رفض استلام الشحنة.
                                </p>
                                {order.flexShipFeePaidByCustomer && (
                                    <div className="flex justify-between items-center flex-row-reverse mt-1 pt-1.5 border-t border-violet-100 dark:border-violet-900/30 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                        <span>حالة تحصيل الرسوم:</span>
                                        <span className="font-bold">تم تحصيل {order.flexShipFee || flexFee} ج.م من المستلم ✓</span>
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            <div className={`mt-6 p-5 rounded-3xl flex justify-between items-center flex-row-reverse ${netProfit >= 0 ? 'bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/50' : 'bg-rose-50 border border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/50'}`}>
                <span className={`text-sm font-black ${netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>الربح المتوقع</span>
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
  
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const calculatedInsuranceFee = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const calculatedInspectionFee = (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
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
      <td className="p-6">
        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="relative group/status" onClick={onShowAudit}>
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
              <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tighter cursor-pointer hover:text-indigo-600" onClick={onShowSummary}>#{order.orderNumber}</h4>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:scale-110 transition-transform p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <MessageCircle size={14} />
              </a>
            </div>
            <div className="group/customer relative inline-block text-right">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-help">{order.customerName}</div>
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
                {(order.items || []).length > 0 ? (order.items || [])[0].name.substring(0, 15) + '...' : '---'}
                </div>
            </div>
        </div>
      </td>
      <td className="p-6">
        <div className="text-right space-y-1 relative">
            <div className="flex items-center gap-2 justify-end overflow-hidden cursor-pointer" onClick={() => setShowShippingPopover(!showShippingPopover)}>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{order.shippingCompany}</span>
                <Truck size={14} className="text-slate-300" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{order.governorate}</p>
            
            <AnimatePresence>
                {showShippingPopover && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowShippingPopover(false)}/>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute bottom-full left-0 mb-4 z-50"
                        >
                            <ShippingDetailsCard order={order} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
      </td>
      <td className="p-6">
        <div className="relative group/status-select">
            <select 
              value={order.status}
              onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
              className={`appearance-none text-right pr-4 pl-10 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer shadow-sm transition-all ${statusInfo.color} text-white hover:brightness-110`}
            >
              {ORDER_STATUSES.map(s => (
                <option key={s} value={s} className="text-slate-900 bg-white font-bold">{ORDER_STATUS_METADATA[s]?.label || s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none" />
        </div>
      </td>
      <td className="p-6">
        <div className="text-right space-y-2 relative">
            <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-1 justify-end">
                    <span className="text-[10px] font-black text-indigo-600">ج.م</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums drop-shadow-sm">{displayTotal.toLocaleString()}</span>
                </div>
                {(order.advancePayment || 0) > 0 && (
                    <div className="text-[9px] text-teal-600 font-bold text-right">
                        <span>عربون: {order.advancePayment}</span>
                        {(order.advancePaymentRecipientPhone || order.advancePaymentSenderDetails) && (
                            <div className="text-[8px] text-slate-400 font-medium">
                                {order.advancePaymentRecipientPhone && <span>إلى: {order.advancePaymentRecipientPhone}</span>}
                                {order.advancePaymentRecipientPhone && order.advancePaymentSenderDetails && <span> | </span>}
                                {order.advancePaymentSenderDetails && <span>من: {order.advancePaymentSenderDetails}</span>}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-1 items-end">
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    order.paymentStatus === 'مدفوع' 
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                }`}>
                    {order.paymentStatus}
                </span>
                {safeProductCost > 0 && (
                    <div 
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-tight cursor-pointer p-1 rounded-lg ${isProfitable ? 'text-emerald-500 bg-emerald-50/50' : 'text-rose-500 bg-rose-50/50'} hover:scale-105 transition-transform`}
                    >
                        <span>{Math.abs(currentNetProfit).toLocaleString()} {profitLabel}</span>
                        {isProfitable ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    </div>
                )}
            </div>
        </div>
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
                        <button onClick={(e) => { e.stopPropagation(); setShowOps(false); onShowAssignment(); }} className="w-full h-12 text-right px-4 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors">
                            تعيين موظف <UserIcon size={16} className="text-purple-500" />
                        </button>
                        <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-2 mx-4" />
                        <button onClick={(e) => { e.stopPropagation(); setShowOps(false); onDelete(); }} className="w-full h-12 text-right px-4 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl flex items-center justify-end gap-3 transition-colors">
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
                                <ProfitBreakdown order={order} settings={settings} />
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
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black text-slate-400 tracking-wider">#{order.orderNumber || order.id.slice(0, 4)}</span>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
            <form onSubmit={onSubmit} className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[95vh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-3xl shadow-sm z-10">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <ShoppingBag size={20}/>
                        </div>
                        {isEditing ? `تعديل الطلب ${orderData.orderNumber}` : 'إنشاء طلب جديد'}
                    </h3>
                    <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                        <XCircle size={24}/>
                    </button>
                </div>

                {/* شريط اختيار نوع الشحنة / العملية */}
                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2.5 items-center justify-start z-10">
                    {(() => {
                        const compFees = (settings.companySpecificFees?.[orderData.shippingCompany] || {}) as any;
                        const tabs = [
                            { id: 'delivery', label: 'توصيل شحنة', icon: <Truck size={17} /> },
                            { id: 'partial_delivery', label: 'توصيل جزئي', icon: <Package size={17} />, badge: 'جديد' }
                        ];
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
                                className={`flex items-center gap-2 py-2.5 px-5 rounded-2xl text-xs font-black border transition-all duration-200 cursor-pointer ${
                                    isActive
                                        ? 'bg-indigo-600 border-indigo-605 text-white dark:bg-indigo-600 dark:border-indigo-605 dark:text-white shadow-lg shadow-indigo-600/20 scale-102'
                                        : 'bg-white border-slate-205 text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                                {tab.badge && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400 rounded-md font-bold leading-none animate-pulse">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6 custom-scrollbar">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-5 flex items-center gap-2">
                                <UserIcon size={18} className="text-blue-500"/> بيانات العميل
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative" ref={customerSearchRef}>
                                    <input type="text" placeholder="اسم العميل أو رقم الهاتف" required value={customerSearch || orderData.customerName || ''} onChange={e => { setCustomerSearch(e.target.value); handleFieldChange('customerName', e.target.value); }} onFocus={() => setIsCustomerListOpen(true)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                                    {isCustomerListOpen && filteredCustomers.length > 0 && (
                                        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto custom-scrollbar">
                                            {filteredCustomers.map(c => (
                                                <div key={c.phone} onClick={() => handleCustomerSelect(c)} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors">
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{c.name}</p>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{c.phone}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input type="tel" placeholder="رقم الهاتف" required value={orderData.customerPhone || ''} onChange={e => handleFieldChange('customerPhone', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                                <input type="tel" placeholder="رقم هاتف إضافي (اختياري)" value={(orderData as NewOrderState).customerPhone2 || ''} onChange={e => handleFieldChange('customerPhone2', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                                <input type="text" placeholder="الدولة" value={(orderData as NewOrderState).country || 'مصر'} onChange={e => handleFieldChange('country', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                            </div>
                            <textarea placeholder="العنوان بالتفصيل" required value={orderData.customerAddress || ''} onChange={e => handleFieldChange('customerAddress', e.target.value)} className="mt-4 w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-24 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none dark:text-white" />
                            <input type="text" placeholder="تفاصيل العنوان (رقم المبنى، الشقة...)" value={(orderData as NewOrderState).buildingDetails || ''} onChange={e => handleFieldChange('buildingDetails', e.target.value)} className="mt-4 w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" />
                        </div>
                        
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                           <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-5 flex items-center gap-2">
                               <Building size={18} className="text-emerald-500"/> بيانات الشحن والطلب
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

                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <select required value={orderData.shippingCompany} onChange={e => handleFieldChange('shippingCompany', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white">
                                    {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="grid grid-cols-2 gap-2">
                                    <select 
                                        required 
                                        value={orderData.governorate || orderData.shippingArea || ''} 
                                        onChange={e => {
                                            const gov = e.target.value;
                                            setOrderData((prev: any) => ({ ...prev, governorate: gov, shippingArea: gov, city: '' }));
                                        }} 
                                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white"
                                    >
                                        <option value="" disabled>المحافظة</option>
                                        {shippingOptions.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}
                                    </select>
                                    <select 
                                        required 
                                        value={orderData.city || ''} 
                                        onChange={e => handleFieldChange('city', e.target.value)} 
                                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white"
                                        disabled={!(orderData.governorate || orderData.shippingArea)}
                                    >
                                        <option value="" disabled>المدينة</option>
                                        {(shippingOptions.find(o => o.label === (orderData.governorate || orderData.shippingArea))?.cities || []).map(city => (
                                            <option key={city.id} value={city.name}>{city.name}</option>
                                        ))}
                                    </select>
                                </div>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                               <div>
                                   <label htmlFor="orderNumberInput" className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">رقم الطلب (اختياري)</label>
                                   <input id="orderNumberInput" type="text" placeholder="سيتم إنشاؤه تلقائياً إذا ترك فارغاً" value={orderData.orderNumber || ''} onChange={e => handleFieldChange('orderNumber', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white" />
                               </div>
                               <div>
                                   <label htmlFor="referenceNumberInput" className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">رقم المرجع (Invoice Ref)</label>
                                   <input id="referenceNumberInput" type="text" placeholder="أدخل رقم المرجع..." value={orderData.referenceNumber || ''} onChange={e => handleFieldChange('referenceNumber', e.target.value)} className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all dark:text-white" />
                               </div>
                           </div>
                        </div>
                        
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <FileText size={18} className="text-slate-500"/> ملاحظات إضافية
                            </h4>
                            <textarea placeholder="أي ملاحظات للمندوب أو الطلب..." value={orderData.notes || ''} onChange={e => handleFieldChange('notes', e.target.value)} className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-24 focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none transition-all resize-none dark:text-white" />
                        </div>

                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <ImageIcon size={18} className="text-pink-500"/> صور ومرفقات الطلب
                            </h4>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {(orderData.images || []).map((img: string, idx: number) => (
                                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        <button 
                                            type="button" 
                                            onClick={() => handleFieldChange('images', (orderData.images || []).filter((_: any, i: number) => i !== idx))}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const url = prompt('أدخل رابط الصورة:');
                                        if (url) handleFieldChange('images', [...(orderData.images || []), url]);
                                    }}
                                    className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-pink-300 hover:text-pink-500 transition-all bg-white dark:bg-slate-900"
                                >
                                    <Plus size={20} />
                                    <span className="text-[10px] font-bold mt-1">إضافة صورة</span>
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold italic">يمكنك إرفاق صور المنتج، بوليصة الشحن، أو أي مستندات متعلقة بالطلب.</p>
                        </div>
                    </div>
                    
                    <div className="lg:col-span-2 space-y-6">
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
                                                            className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-505" 
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
                        
                        {(!isExchange && !isReturn && !isCashCollection) && (
                            <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                 <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-5 flex items-center gap-2">
                                     <Package size={18} className="text-amber-500"/> المنتجات
                                 </h4>
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
                                            <div key={index} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 relative group">
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
                                                    <div className="w-20">
                                                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">الكمية</label>
                                                        <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-xs" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">السعر</label>
                                                        <input type="number" min="0" value={item.price} onChange={e => handleItemChange(index, 'price', Number(e.target.value))} className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-xs" />
                                                    </div>
                                                    <div className="flex-1">
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
                                 <button type="button" onClick={addItem} className="w-full mt-4 p-3 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-bold rounded-xl text-sm border border-amber-100 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2">
                                     <Plus size={16} /> إضافة منتج
                                 </button>
                            </div>
                        )}
                        
                        {isCashCollection && (
                            <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-5 flex items-center gap-2">
                                    <Coins size={18} className="text-amber-500"/> تفاصيل التحصيل النقدي
                                </h4>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">المبلغ المطلوب تحصيله من العميل (ج.م)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={orderData.customShipmentPrice || 0} 
                                        onChange={e => handleFieldChange('customShipmentPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-lg focus:ring-2 focus:ring-amber-500 text-center text-amber-600 dark:text-amber-400" 
                                        placeholder="أدخل قيمة التحصيل..."
                                    />
                                    <p className="text-xs text-slate-500 mt-3 text-center">لا يتضمن هذا المبلغ رسوم الشحن. سيتم احتساب رسوم التوصيل وإضافتها للمبلغ النهائي.</p>
                                </div>
                            </div>
                        )}
                        
                        <div className="p-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <FileText size={18} className="text-indigo-500"/> الملخص المالي
                            </h4>
                            
                            {/* Receipt Style Subtotal Info Panel */}
                            <div className="bg-slate-100/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/60 space-y-2.5 text-xs text-slate-650 dark:text-slate-350">
                                <div className="flex justify-between items-center">
                                    <span>إجمالي الأصناف (قبل الخصم)</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{subtotal.toLocaleString()} ج.م</span>
                                </div>
                                {itemDiscounts > 0 && (
                                    <div className="flex justify-between items-center text-red-500 pt-1 border-t border-slate-200/30 dark:border-slate-800/30">
                                        <span>خصومات المنتجات</span>
                                        <span className="font-bold">-{itemDiscounts.toLocaleString()} ج.م</span>
                                    </div>
                                )}
                                {inspectionFee > 0 && (
                                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/30 dark:border-slate-800/30">
                                        <span>رسوم المعاينة</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{inspectionFee.toLocaleString()} ج.م</span>
                                    </div>
                                )}
                                {orderData.tax && orderData.tax > 0 ? (
                                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/30 dark:border-slate-800/30">
                                        <span>الضريبة</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{orderData.tax.toLocaleString()} ج.م</span>
                                    </div>
                                ) : null}
                            </div>

                            {/* Side-by-side Customizable Inputs */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">مصاريف الشحن</label>
                                        {totalWeight > 0 && (
                                            <span className="text-[8px] text-slate-400 font-medium">({totalWeight.toFixed(1)} كجم)</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            value={orderData.shippingFee || 0} 
                                            onChange={e => handleFieldChange('shippingFee', Number(e.target.value))} 
                                            className="w-full text-xs font-bold bg-transparent outline-none text-slate-800 dark:text-slate-200" 
                                        />
                                        <span className="text-[9px] text-slate-400">ج.م</span>
                                    </div>
                                </div>

                                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all">
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block font-bold">خصم إضافي</label>
                                    <div className="flex items-center gap-1">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            value={orderData.discount || 0} 
                                            onChange={e => handleFieldChange('discount', Number(e.target.value))} 
                                            className="w-full text-xs font-bold bg-transparent outline-none text-red-500 dark:text-red-450" 
                                        />
                                        <span className="text-[9px] text-slate-400">ج.م</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* تحديد مبلغ فليكس شيب (مرتبط بالمعاينة) */}
                            {orderData.includeInspectionFee && (settings.companySpecificFees?.[orderData.shippingCompany!]?.useCustomFees ? settings.companySpecificFees?.[orderData.shippingCompany!]?.enableFlexShip : settings.enableFlexShip) && (
                                <div className="p-2.5 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-xl transition-all mt-3 text-right">
                                    <label className="text-[10px] text-violet-800 dark:text-violet-400 mb-1 block font-black">مبلغ خدمة فليكس شيب للطلب (Flex Ship Fee)</label>
                                    <div className="flex items-center gap-1 font-sans">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            value={orderData.flexShipFee !== undefined ? orderData.flexShipFee : (settings.companySpecificFees?.[orderData.shippingCompany!]?.useCustomFees ? (settings.companySpecificFees?.[orderData.shippingCompany!]?.flexShipFee || 0) : (settings.flexShipFee || 0))} 
                                            onChange={e => handleFieldChange('flexShipFee', Number(e.target.value))} 
                                            className="w-full text-xs font-black bg-transparent outline-none text-violet-700 dark:text-violet-400 animate-pulse-slow" 
                                            placeholder="0"
                                        />
                                        <span className="text-[9px] text-violet-400 font-bold">ج.م</span>
                                    </div>
                                </div>
                            )}
                            
                            {/* Advance payment & Destination selection */}
                            <div className={`grid gap-3 transition-all duration-300 ${((orderData.advancePayment || 0) > 0) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block font-bold">عربون / دفع مقدم</label>
                                    <div className="flex items-center gap-1">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            value={orderData.advancePayment || 0} 
                                            onChange={e => handleFieldChange('advancePayment', Number(e.target.value))} 
                                            className="w-full text-xs font-bold bg-transparent outline-none text-emerald-600 dark:text-emerald-400" 
                                        />
                                        <span className="text-[9px] text-slate-400">ج.م</span>
                                    </div>
                                </div>

                                {(orderData.advancePayment || 0) > 0 && (
                                    <>
                                        <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-indigo-505/20 focus-within:border-indigo-505 transition-all">
                                            <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block font-bold">حساب الخزينة / محصل العربون</label>
                                            <select 
                                                value={orderData.advancePaymentTreasuryId || orderData.advancePaymentPartnerId || ''} 
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val.startsWith('treasury_')) {
                                                        handleFieldChange('advancePaymentTreasuryId', val.replace('treasury_', ''));
                                                        handleFieldChange('advancePaymentPartnerId', undefined);
                                                    } else if (val.startsWith('partner_')) {
                                                        handleFieldChange('advancePaymentPartnerId', val.replace('partner_', ''));
                                                        handleFieldChange('advancePaymentTreasuryId', undefined);
                                                    } else {
                                                        handleFieldChange('advancePaymentPartnerId', undefined);
                                                        handleFieldChange('advancePaymentTreasuryId', undefined);
                                                    }
                                                }} 
                                                className="w-full bg-transparent outline-none font-bold text-slate-700 dark:text-slate-300 text-[10px] py-0.5"
                                            >
                                                <option value="">-- اختر الحساب --</option>
                                                {treasury?.accounts && treasury.accounts.length > 0 && <optgroup label="الخزينة والحسابات البنكية">
                                                    {treasury.accounts.map((acc: any) => (
                                                        <option key={`treasury_${acc.id}`} value={`treasury_${acc.id}`}>{acc.name} (خزينة)</option>
                                                    ))}
                                                </optgroup>}
                                                {settings.partners && settings.partners.length > 0 && <optgroup label="محافظ الشركاء (محصل العربون)">
                                                    {settings.partners.map(p => (
                                                        <option key={`partner_${p.id}`} value={`partner_${p.id}`}>{p.name} (شريك)</option>
                                                    ))}
                                                </optgroup>}
                                            </select>
                                        </div>

                                        {/* New tracking fields */}
                                        <div className="col-span-2 grid grid-cols-2 gap-3 mt-1">
                                            <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                                                <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block font-bold">هاتف المستلم / الشريك</label>
                                                <div className="flex items-center gap-2">
                                                    <Phone size={10} className="text-slate-400" />
                                                    <input 
                                                        type="text" 
                                                        value={orderData.advancePaymentRecipientPhone || ''} 
                                                        onChange={e => handleFieldChange('advancePaymentRecipientPhone', e.target.value)} 
                                                        placeholder="رقم هاتف المستلم..."
                                                        className="w-full text-[10px] font-bold bg-transparent outline-none text-slate-700 dark:text-slate-300"
                                                    />
                                                </div>
                                            </div>
                                            <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                                                <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block font-bold">بيانات المحول (هاتف/انستا باي)</label>
                                                <div className="flex items-center gap-2">
                                                    <PhoneForwarded size={10} className="text-slate-400" />
                                                    <input 
                                                        type="text" 
                                                        value={orderData.advancePaymentSenderDetails || ''} 
                                                        onChange={e => handleFieldChange('advancePaymentSenderDetails', e.target.value)} 
                                                        placeholder="رقم المحول / انستا باي..."
                                                        className="w-full text-[10px] font-bold bg-transparent outline-none text-slate-700 dark:text-slate-300"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="border-t border-slate-200/60 dark:border-slate-700/60 my-3"></div>
                            
                            <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200 text-sm">
                                <span>المجموع {orderData.source === 'synced' ? '(المرسل من المنصة)' : ''}</span>
                                <span>{(orderData.source === 'synced' && orderData.totalPrice ? orderData.totalPrice : totalBeforeCredit).toLocaleString()} ج.م</span>
                            </div>
                            
                            {isExchange && (
                                <div className="flex justify-between font-bold text-orange-500 bg-orange-50 dark:bg-orange-500/10 p-2.5 rounded-xl border border-orange-100 dark:border-orange-500/20 text-xs">
                                    <span>رصيد سابق (للاستبدال)</span>
                                    <span>-{creditAmount.toLocaleString()} ج.م</span>
                                </div>
                            )}
                            
                            <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-700 my-3"></div>
                            
                            <div className="flex justify-between items-center bg-indigo-55 dark:bg-indigo-500/10 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                                <span className="font-extrabold text-indigo-700 dark:text-indigo-400 text-sm">{finalAmount >= 0 ? 'المطلوب تحصيله' : 'المستحق للعميل'} {orderData.source === 'synced' ? '(النهائي من المنصة)' : ''}</span>
                                <div className="flex flex-col items-end">
                                    <span className="font-black text-indigo-700 dark:text-indigo-400 text-xl">{Math.abs(orderData.totalAmountOverride ?? (orderData.source === 'synced' && orderData.totalPrice ? orderData.totalPrice : finalAmount)).toLocaleString()} ج.م</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowEditTotalModal(true)}
                                        className="text-[9px] font-bold text-indigo-550 dark:text-indigo-500 hover:text-indigo-600 underline mt-0.5"
                                    >
                                        تعديل الإجمالي يدوياً
                                    </button>
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
                        </div>
                         <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                             <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                 <SettingsIcon size={18} className="text-slate-500"/> إعدادات إضافية
                             </h4>
                             <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                 <input type="checkbox" checked={orderData.includeInspectionFee} onChange={e => handleFieldChange('includeInspectionFee', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700" /> 
                                 <span className="font-medium text-slate-700 dark:text-slate-300">تفعيل رسوم المعاينة</span>
                             </label>
                             <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                 <input type="checkbox" checked={orderData.isInsured} onChange={e => handleFieldChange('isInsured', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700" /> 
                                 <span className="font-medium text-slate-700 dark:text-slate-300">تفعيل التأمين على الشحنة</span>
                             </label>
                         </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-b-3xl shadow-lg z-10">
                    <div>
                        {isExchange && <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">الطلب الجديد: {totalBeforeCredit.toLocaleString()} ج.م - رصيد سابق: {creditAmount.toLocaleString()} ج.م</div>}
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{finalAmount >= 0 ? 'الإجمالي المطلوب من العميل' : 'المبلغ المستحق للعميل'}</span>
                        <p className={`text-3xl font-black ${finalAmount >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-500'}`}>{Math.abs(orderData.totalAmountOverride ?? finalAmount).toLocaleString()} ج.م</p>
                        {(orderData.advancePayment || 0) > 0 && <p className="text-[11px] text-teal-600 dark:text-teal-400 font-bold mt-1">يتضمن خصم {orderData.advancePayment} ج.م عربون</p>}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                            إلغاء
                        </button>
                        <button type="submit" className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md flex items-center gap-2">
                            <Save size={20}/>{isEditing ? 'تحديث الطلب' : 'حفظ الطلب'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};
interface OrderConfirmationSummaryProps { order: Order; settings: Settings; onClose: () => void; }
const OrderConfirmationSummary: React.FC<OrderConfirmationSummaryProps> = ({ order, settings, onClose }) => {
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
                <button onClick={onClose} className="mt-8 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm hover:shadow">
                    إغلاق
                </button>
            </div>
        </div>
    );
};
const ConfirmationModal: React.FC<{ title: string; description: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, description, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{description}</p>
            <div className="flex flex-col gap-2">
                <button onClick={onConfirm} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-sm hover:shadow">
                    تأكيد الحذف
                </button>
                <button onClick={onCancel} className="w-full py-3 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all">
                    تراجع
                </button>
            </div>
        </div>
    </div>
);
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
