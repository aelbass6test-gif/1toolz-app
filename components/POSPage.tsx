import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CustomerSelectModal } from './CustomerSelectModal';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Monitor, 
  Search, 
  ShoppingCart, 
  Trash2, 
  CheckCircle2, 
  User, 
  Hash, 
  CreditCard, 
  Banknote, 
  Wallet,
  Warehouse,
  Plus,
  Minus,
  X,
  Package,
  Receipt,
  Printer,
  ChevronLeft,
  SearchCode,
  PauseCircle,
  PlayCircle,
  Calculator,
  Sparkles,
  Tag,
  FileText,
  Clock,
  RefreshCw,
  Zap,
  HelpCircle,
  Check,
  Copy,
  ArrowLeft,
  DollarSign
} from 'lucide-react';
import { Settings, Product, ProductVariant, POSSale, POSSaleItem, Order, Wallet as WalletType, Transaction, Treasury } from '../types';

import { exportHTMLToPDF } from '../utils/pdfHelper';
import { printHTMLDirectly } from '../utils/printHelper';
import { triggerCelebration } from '../utils/celebration';

const normalizeName = (name: string): string => {
  if (!name) return '';
  let normalized = name.trim().replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s*\((شريك|موظف|المدير|شريكه|partner|employee|admin|أنت|انت)\)/gi, '');
  normalized = normalized.replace(/\s+(شريك|موظف|المدير|شريكه|partner|employee|admin)$/gi, '');
  normalized = normalized
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
  if (/^(زهره)/.test(normalized)) {
      return 'زهره';
  }
  return normalized;
};

interface POSPageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  orders: Order[];
  wallet: WalletType;
  treasury?: Treasury;
  updateStoreData: (data: any) => void;
  currentUser: any;
  activeStore?: any;
  customers?: any[];
}

interface ParkedOrder {
  id: string;
  timestamp: string;
  items: POSSaleItem[];
  customerInfo: { name: string; phone: string; address: string; debtBalance: number };
  warehouseId: string;
  notes?: string;
}

const POSPage: React.FC<POSPageProps> = (props) => {
  const { settings, updateSettings, orders, wallet, treasury, updateStoreData, currentUser, activeStore, customers } = props;
  
  if (settings.isPosEnabled === false) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6" dir="rtl">
        <div className="w-24 h-24 bg-red-50 dark:bg-red-950/30 rounded-3xl flex items-center justify-center text-red-500 shadow-xl shadow-red-500/10">
          <Monitor size={48} className="opacity-50" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white">نقطة البيع معطلة حالياً</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            تم إيقاف ميزة نقطة البيع من قبل المدير. يرجى مراجعة إعدادات المتجر إذا كنت تعتقد أن هذا خطأ.
          </p>
        </div>
        <button 
          onClick={() => window.history.back()}
          className="px-8 py-3 bg-slate-800 dark:bg-white dark:text-slate-950 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg active:scale-95"
        >
          العودة للخلف
        </button>
      </div>
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<POSSaleItem[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(settings.warehouses?.find(w => w.isDefault)?.id || settings.warehouses?.[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentStatusType, setPaymentStatusType] = useState<'paid' | 'credit'>('paid');
  const [selectedCashHolder, setSelectedCashHolder] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: 'عميل نقدي', phone: '', address: '', debtBalance: 0 });
  const [activeTab, setActiveTab] = useState<'checkout' | 'history'>('checkout');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Cashier Calculator (الباقي والدفع)
  const [paidCashAmount, setPaidCashAmount] = useState<number | ''>('');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Parked Carts System
  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>([]);
  const [showParkedModal, setShowParkedModal] = useState(false);

  // Keyboard Shortcuts Drawer & Receipt Preview
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);
  const [lastReceiptSale, setLastReceiptSale] = useState<POSSale | null>(null);

  // Search Input Ref for Shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Registered Customers Integration
  const customersList = customers || [];
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);

  const products = settings.products || [];
  const warehouses = settings.warehouses || [];

  // Extract Categories
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if ((p as any).category) cats.add((p as any).category);
    });
    return Array.from(cats);
  }, [products]);
  
  const treasuryAccountsList = useMemo(() => {
    if (treasury) {
      if (Array.isArray(treasury)) return treasury;
      if (Array.isArray(treasury.accounts)) return treasury.accounts;
      if (typeof treasury === "object" && treasury !== null) return Object.values(treasury);
    }
    const settingsAccounts = (settings as any).treasuryAccounts || (settings as any).treasury?.accounts || [];
    if (Array.isArray(settingsAccounts)) return settingsAccounts;
    if (typeof settingsAccounts === "object" && settingsAccounts !== null) return Object.values(settingsAccounts);
    return [];
  }, [treasury, settings]);

  const partnersList = settings.partners || [];
  const employeesList = settings.employees || [];

  const allPossibleHolders = useMemo(() => [
    { id: 'admin', name: 'المدير (أنت)' },
    ...(employeesList).map((e, index) => ({ id: `emp_${e.id || e.phone || index}`, name: normalizeName(e.name) })),
    ...(partnersList).map((p, index) => ({ id: `part_${p.id || index}`, name: `${normalizeName(p.name)} (شريك)` })),
    ...(treasuryAccountsList).map((a: any) => ({ id: `treas_${a.id}`, name: normalizeName(a.name) }))
  ], [employeesList, partnersList, treasuryAccountsList]);

  // Today's POS Stats
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const posSales = settings.posSales || [];
    const todaySales = posSales.filter(s => s.date && s.date.startsWith(today));
    const totalAmount = todaySales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    return {
      count: todaySales.length,
      revenue: totalAmount
    };
  }, [settings.posSales]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }
      if (e.key === '/' || e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) handleParkOrder();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && confirm('هل تريد إفراغ السلة الحالية؟')) setCart([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Set default cash holder
  useEffect(() => {
    if (allPossibleHolders.length > 0) {
      const match = allPossibleHolders.find(h => 
        h.id === `emp_${currentUser?.id}` || 
        h.id === `part_${currentUser?.id}` ||
        h.id === currentUser?.id ||
        (currentUser?.role === 'admin' && h.id === 'admin')
      );
      if (match) {
        setSelectedCashHolder(match.id);
      } else {
        setSelectedCashHolder(allPossibleHolders[0].id);
      }
    }
  }, [allPossibleHolders, currentUser]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedCategory !== 'all') {
      if (selectedCategory === 'low_stock') {
        list = list.filter(p => (p.stockQuantity || 0) <= ((p as any).minStockThreshold || (p as any).stockThreshold || 5));
      } else {
        list = list.filter(p => (p as any).category === selectedCategory);
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(term) || 
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        ((p as any).barcode && (p as any).barcode.toLowerCase().includes(term))
      );
    }

    return list.slice(0, 30);
  }, [products, searchTerm, selectedCategory]);

  // Handle direct barcode scanner enter key
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    const term = searchTerm.trim().toLowerCase();
    const foundProduct = products.find(p => 
      ((p as any).barcode && (p as any).barcode.toLowerCase() === term) ||
      (p.sku && p.sku.toLowerCase() === term) ||
      p.name.toLowerCase() === term
    );

    if (foundProduct) {
      addToCart(foundProduct);
      setSearchTerm('');
    }
  };

  const addToCart = (product: Product, variant?: ProductVariant) => {
    const existingIdx = cart.findIndex(item => 
      variant ? (item.productId === product.id && item.variantId === variant.id) : (item.productId === product.id && !item.variantId)
    );

    if (existingIdx > -1) {
      const newCart = [...cart];
      newCart[existingIdx].quantity += 1;
      setCart(newCart);
    } else {
      const newItem: POSSaleItem = {
        productId: product.id,
        variantId: variant?.id,
        name: variant ? `${product.name} (${Object.values(variant.options).join(' / ')})` : product.name,
        quantity: 1,
        price: variant?.price || product.price || 0,
        cost: variant?.costPrice || product.costPrice || 0
      };
      setCart([...cart, newItem]);
    }
  };

  const updateQuantity = (idx: number, delta: number) => {
    const newCart = [...cart];
    newCart[idx].quantity = Math.max(1, newCart[idx].quantity + delta);
    setCart(newCart);
  };

  const updatePrice = (idx: number, newPrice: number) => {
    const newCart = [...cart];
    newCart[idx].price = Math.max(0, newPrice);
    setCart(newCart);
  };

  const removeFromCart = (idx: number) => {
    const newCart = [...cart];
    newCart.splice(idx, 1);
    setCart(newCart);
  };

  // Park current order
  const handleParkOrder = () => {
    if (cart.length === 0) return;
    const newParked: ParkedOrder = {
      id: `parked-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      items: cart,
      customerInfo,
      warehouseId: selectedWarehouse
    };
    setParkedOrders([newParked, ...parkedOrders]);
    setCart([]);
    setDiscountAmount(0);
    setCustomerInfo({ name: 'عميل نقدي', phone: '', address: '', debtBalance: 0 });
    alert('⏸️ تم تعليق الطلب بنجاح! يمكنك استرجاعه في أي وقت من زر الطلبات المعلقة.');
  };

  // Restore parked order
  const handleRestoreParkedOrder = (parked: ParkedOrder) => {
    setCart(parked.items);
    setCustomerInfo(parked.customerInfo);
    if (parked.warehouseId) setSelectedWarehouse(parked.warehouseId);
    setParkedOrders(parkedOrders.filter(p => p.id !== parked.id));
    setShowParkedModal(false);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const totalAmountBeforeDiscount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalAmount = Math.max(0, totalAmountBeforeDiscount - discountAmount);

  // Cash change calculations
  const numericPaidCash = typeof paidCashAmount === 'number' ? paidCashAmount : 0;
  const cashChangeAmount = Math.max(0, numericPaidCash - totalAmount);

  const handleCheckout = async () => {
    if (isProcessing) return;
    if (cart.length === 0) return alert('السلة فارغة!');
    if (!selectedWarehouse) return alert('يرجى اختيار المستودع المتوفر به البضاعة');

    setIsProcessing(true);
    try {
      const saleId = `POS-${Date.now()}`;
      const saleNumber = `P-${String((settings.posSales?.length || 0) + 1).padStart(5, '0')}`;
      
      const finalCashHolder = selectedCashHolder || allPossibleHolders[0]?.id || 'admin';
      const receiver = allPossibleHolders.find(h => h.id === finalCashHolder);
      const isCredit = paymentStatusType === 'credit';
      
      const newSale: POSSale = {
        id: saleId,
        saleNumber,
        date: new Date().toISOString(),
        items: cart,
        totalAmount,
        paymentMethod: (isCredit ? 'cash' : paymentMethod) as 'cash' | 'card' | 'wallet',
        warehouseId: selectedWarehouse,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerAddress: customerInfo.address,
        performedBy: currentUser?.fullName || currentUser?.email || 'كاشير',
        cashHolderId: isCredit ? 'credit' : (settings.disableCustodySelling ? 'wallet' : finalCashHolder),
        cashHolderName: isCredit ? 'حساب أجل' : (settings.disableCustodySelling ? 'المحفظة العامة' : normalizeName(receiver?.name || '')),
        notes: `${isCredit ? '[أجل] ' : ''}${customerInfo.address ? `بيع مباشر - ${customerInfo.address}` : `بيع مباشر من منفذ ${activeStore?.name || 'الرئيسي'}`}`
      };

      // Update Stocks
      const updatedProducts = [...(settings.products || [])];
      newSale.items.forEach(item => {
        const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
        if (pIdx > -1) {
          const prod = { ...updatedProducts[pIdx] };
          if (item.variantId && prod.variants) {
            prod.variants = prod.variants.map(v => {
              if (v.id === item.variantId) {
                const vUpdated = { ...v };
                vUpdated.stockQuantity = Math.max(0, (vUpdated.stockQuantity || 0) - item.quantity);
                vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
                vUpdated.warehouseStock[selectedWarehouse] = Math.max(0, (vUpdated.warehouseStock[selectedWarehouse] || 0) - item.quantity);
                return vUpdated;
              }
              return v;
            });
          } else {
            prod.stockQuantity = Math.max(0, (prod.stockQuantity || 0) - item.quantity);
            prod.warehouseStock = { ...(prod.warehouseStock || {}) };
            prod.warehouseStock[selectedWarehouse] = Math.max(0, (prod.warehouseStock[selectedWarehouse] || 0) - item.quantity);
          }
          updatedProducts[pIdx] = prod;
        }
      });

      // Update Cash Holder Balance
      let updatedHolders = [...(settings.cashHolders || [])];
      let updatedPartners = [...(settings.partners || [])];
      let updatedPartnerTransactions = [...(settings.partnerTransactions || [])];
      let updatedHandovers = [...(settings.cashHandovers || [])];
      let updatedTreasury = treasury ? { ...treasury, accounts: [...treasury.accounts], transactions: [...(treasury.transactions || [])] } : null;

      if (!isCredit && !settings.disableCustodySelling) {
        if (finalCashHolder.startsWith('treas_') && updatedTreasury) {
          const treasuryId = finalCashHolder.substring(6);
          const accIdx = updatedTreasury.accounts.findIndex(a => a.id === treasuryId);
          if (accIdx > -1) {
            updatedTreasury.accounts[accIdx] = {
              ...updatedTreasury.accounts[accIdx],
              balance: updatedTreasury.accounts[accIdx].balance + totalAmount
            };
            updatedTreasury.transactions.unshift({
              id: `POS-TR-${Date.now()}`,
              date: new Date().toISOString(),
              type: 'deposit',
              amount: totalAmount,
              description: `مبيعات كاشير - طلب #${saleNumber}`,
              toAccountId: treasuryId,
              reference: saleId
            });
          }
        } else {
          const hIdx = updatedHolders.findIndex(h => String(h.userId) === String(finalCashHolder));
          const receiverName = normalizeName(receiver?.name || 'مستلم');
          
          if (hIdx > -1) {
            updatedHolders[hIdx].currentBalance += totalAmount;
            updatedHolders[hIdx].lastUpdated = new Date().toISOString();
          } else {
            updatedHolders.push({
              userId: finalCashHolder,
              userName: receiverName,
              currentBalance: totalAmount,
              lastUpdated: new Date().toISOString()
            });
          }

          // Add to Cash Handovers log
          updatedHandovers.unshift({
            id: `pos-handover-${Date.now()}`,
            fromUserId: 'system',
            fromUserName: 'النظام',
            toUserId: finalCashHolder,
            toUserName: receiverName,
            amount: totalAmount,
            date: new Date().toISOString(),
            notes: `مبيعات كاشير - طلب #${saleNumber}`,
            type: 'handover',
            status: 'completed',
            orderId: saleId
          });
        }
      }

      const newSettings: Settings = {
        ...settings,
        products: updatedProducts,
        cashHolders: updatedHolders,
        partners: updatedPartners,
        partnerTransactions: updatedPartnerTransactions,
        cashHandovers: updatedHandovers,
        posSales: [newSale, ...(settings.posSales || [])],
        activityLogs: [
          {
            id: `log-${Date.now()}`,
            user: currentUser?.fullName || 'POS',
            action: 'عملية بيع سريعة',
            details: `بيع مباشر بقيمة ${totalAmount} ج.م استلمها ${receiver?.name}`,
            date: new Date().toLocaleString('ar-EG'),
            timestamp: Date.now()
          },
          ...(settings.activityLogs || [])
        ]
      };

      // Create equivalent Order
      const newOrder: Order = {
        id: saleId,
        orderNumber: saleNumber,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone || '0000000000',
        customerAddress: customerInfo.address || 'بيع مباشر - المنفذ',
        shippingCompany: activeStore?.name ? `كاشير - ${activeStore.name}` : 'كاشير - بيع مباشر',
        shippingArea: warehouses.find(w => w.id === selectedWarehouse)?.name || 'نقطة البيع',
        productName: cart.length > 1 ? `${cart[0].name} + ${cart.length - 1} منتجات أخرى` : cart[0]?.name || '',
        productPrice: totalAmount,
        productCost: cart.reduce((acc, i) => acc + (i.cost * i.quantity), 0),
        weight: 0,
        discount: discountAmount,
        preparationStatus: 'جاهز',
        items: cart.map(i => ({ ...i, image: '', weight: 0 })),
        totalPrice: totalAmount,
        shippingFee: 0,
        status: isCredit ? 'جاري_المراجعة' : 'تم_التحصيل',
        date: new Date().toISOString(),
        paymentStatus: isCredit ? 'بانتظار الدفع' : 'مدفوع',
        warehouseId: selectedWarehouse,
        channel: 'pos',
        stockDeducted: true,
        includeInspectionFee: false,
        inspectionFee: 0,
        isInsured: false,
        insuranceFee: 0,
        cashHolderId: isCredit ? 'credit' : (settings.disableCustodySelling ? 'wallet' : finalCashHolder),
        cashHolderName: isCredit ? 'حساب أجل' : (settings.disableCustodySelling ? 'المحفظة العامة' : (normalizeName(receiver?.name || '') || 'نقطة البيع')),
        advancePayment: isCredit ? 0 : totalAmount,
        advancePaymentPartnerId: !isCredit && !settings.disableCustodySelling && finalCashHolder.startsWith('part_') ? finalCashHolder.substring(5) : undefined,
        advancePaymentEmployeeId: !isCredit && !settings.disableCustodySelling && (finalCashHolder.startsWith('emp_') || finalCashHolder === 'admin') ? (finalCashHolder === 'admin' ? 'admin' : finalCashHolder.substring(4)) : undefined,
        advancePaymentTreasuryId: !isCredit && !settings.disableCustodySelling && finalCashHolder.startsWith('treas_') ? finalCashHolder.substring(6) : undefined,
      };

      // Wallet transaction
      let updatedWallet: WalletType = { ...wallet };
      if (!isCredit && (paymentMethod !== 'cash' || settings.disableCustodySelling)) {
        const isDigital = paymentMethod !== 'cash';
        const newTransaction: Transaction = {
          id: `pos-tx-${Date.now()}`,
          type: 'إيداع',
          amount: totalAmount,
          date: new Date().toISOString(),
          note: isDigital 
            ? `مبيعات كاشير (دفع إلكتروني) - طلب #${saleNumber}`
            : `مبيعات كاشير (إيداع مباشر بالمحفظة) - طلب #${saleNumber}`,
          category: isDigital ? 'pos_digital' : 'pos_cash',
          status: 'completed',
          orderId: saleId,
          orderNumber: saleNumber
        };

        updatedWallet = {
          ...wallet,
          balance: (wallet.balance || 0) + totalAmount,
          transactions: [newTransaction, ...(wallet.transactions || [])]
        };
      }

      // Update Debt
      let updatedCustomers = [...(customers || [])];
      if (isCredit && customerInfo.phone) {
        const cIdx = updatedCustomers.findIndex(c => c.phone === customerInfo.phone);
        const debtEntry = {
          id: `debt-${Date.now()}`,
          amount: totalAmount,
          type: 'increase',
          reason: `مبيعات آجل - طلب #${saleNumber}`,
          date: new Date().toISOString()
        };

        if (cIdx > -1) {
          updatedCustomers[cIdx] = {
            ...updatedCustomers[cIdx],
            debtBalance: (updatedCustomers[cIdx].debtBalance || 0) + totalAmount,
            debtHistory: [debtEntry, ...(updatedCustomers[cIdx].debtHistory || [])]
          };
        } else {
          updatedCustomers.push({
            id: customerInfo.phone,
            name: customerInfo.name || 'عميل آجل',
            phone: customerInfo.phone,
            debtBalance: totalAmount,
            debtHistory: [debtEntry],
            totalOrders: 1,
            successfulOrders: 0,
            returnedOrders: 0,
            totalSpent: 0,
            firstOrderDate: new Date().toISOString(),
            lastOrderDate: new Date().toISOString(),
            tags: ['عميل آجل'],
            loyaltyPoints: 0
          });
        }
      }

      // Update store data atomic
      updateStoreData({ 
        settings: newSettings, 
        orders: [newOrder, ...orders],
        wallet: updatedWallet,
        treasury: updatedTreasury,
        customers: updatedCustomers
      });

      // Celebration
      triggerCelebration('pos_sale', settings);

      // Open Last Receipt modal for thermal print
      setLastReceiptSale(newSale);

      // Reset Form
      setCart([]);
      setDiscountAmount(0);
      setPaidCashAmount('');
      setCustomerInfo({ name: 'عميل نقدي', phone: '', address: '', debtBalance: 0 });
      setPaymentStatusType('paid');
    } catch (err) {
      console.error('Checkout failed:', err);
      alert('فشلت عملية البيع، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4" dir="rtl">
      {/* Top Banner & Quick Metrics Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 font-bold shadow-inner">
              <Monitor size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">كاشير نقطة البيع الذكية (POS)</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  نشط ومعتمد
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">إدارة المبيعات المباشرة والفواتير مع مزامنة فورية للمخزن والعهدة المالية</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Today's Sales Metric */}
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Sparkles size={18} />
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-300 block font-bold">مبيعات اليوم ({todayStats.count})</span>
                <span className="text-sm font-black text-emerald-400 tabular-nums">{todayStats.revenue.toLocaleString()} ج.م</span>
              </div>
            </div>

            {/* Parked Carts Trigger */}
            <button
              onClick={() => setShowParkedModal(true)}
              className="relative bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-2xl border border-white/10 font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
            >
              <PauseCircle size={18} className="text-amber-400" />
              <span>الطلبات المعلقة</span>
              {parkedOrders.length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                  {parkedOrders.length}
                </span>
              )}
            </button>

            {/* Shortcuts Guide Trigger */}
            <button
              onClick={() => setShowHotkeysModal(true)}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all"
              title="اختصارات لوحة المفاتيح"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs & Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('checkout')}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'checkout' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            {warehouses.find(w => w.id === selectedWarehouse)?.name || 'نقطة البيع (كاشير)'}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            سجل الحركات (POS Log)
          </button>
        </div>

        {activeTab === 'checkout' && (
          <button
            onClick={() => updateSettings({ ...settings, disableCustodySelling: !settings.disableCustodySelling })}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all ${
              settings.disableCustodySelling 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.disableCustodySelling ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.disableCustodySelling ? 'left-6' : 'left-1'}`} />
            </div>
            <span className="text-xs font-black">إيقاف البيع بالعهدة (إيداع للمحفظة)</span>
          </button>
        )}
      </div>

      {activeTab === 'checkout' ? (
        <div className="flex flex-col lg:flex-row flex-1 gap-6 p-1 lg:p-0 pb-32 lg:pb-0 overflow-hidden">
          {/* Products Catalog - Left Side */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden backdrop-blur-xl">
            {/* Search & Barcode Bar */}
            <div className="p-5 border-b border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 space-y-3">
               <form onSubmit={handleBarcodeSubmit} className="relative max-w-2xl mx-auto flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
                    <input 
                      ref={searchInputRef}
                      type="text"
                      placeholder="ابحث بالاسم، SKU أو امسح الباركود (اضغط / للتركيز)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 h-14 pr-12 pl-12 rounded-2xl text-sm font-black outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                      /
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="h-14 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                    title="إضافة بالباركود"
                  >
                    <Zap size={18} />
                    <span>مسح</span>
                  </button>
               </form>

               {/* Categories Filters Chips */}
               <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-2xl mx-auto hide-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${selectedCategory === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'}`}
                  >
                    الكل ({products.length})
                  </button>
                  <button
                    onClick={() => setSelectedCategory('low_stock')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${selectedCategory === 'low_stock' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700 hover:bg-amber-50'}`}
                  >
                    مخزون منخفض ⚠️
                  </button>
                  {categoriesList.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'}`}
                    >
                      {cat}
                    </button>
                  ))}
               </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="space-y-2 flex flex-col">
                       {product.hasVariants ? (
                         product.variants.map(variant => (
                           <button
                             key={variant.id}
                             onClick={() => addToCart(product, variant)}
                             className="w-full bg-white dark:bg-slate-800 p-4 rounded-3xl border hover:border-indigo-500 border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-right flex flex-col gap-2 active:scale-95 group relative overflow-hidden"
                           >
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="w-full aspect-square bg-slate-100 dark:bg-slate-900 rounded-2xl mb-2 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                                {product.thumbnail || (product.images && product.images[0]) ? (
                                  <img src={product.thumbnail || product.images?.[0]} alt={product.name} className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal" />
                                ) : (
                                  <Package size={32} className="text-slate-300 dark:text-slate-600" />
                                )}
                              </div>
                              <span className="font-bold text-xs text-slate-800 dark:text-white line-clamp-2 leading-snug">{product.name}</span>
                              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-lg w-fit">{Object.values(variant.options).join(' / ')}</span>
                              <div className="flex items-end justify-between mt-auto pt-2 w-full">
                                 <span className="text-base font-black text-slate-900 dark:text-white tabular-nums tracking-tight">{variant.price.toLocaleString()} <span className="text-[10px] text-slate-500">ج.م</span></span>
                                 <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg">
                                    مخزن: {
                                      selectedWarehouse && variant.warehouseStock && variant.warehouseStock[selectedWarehouse] !== undefined
                                        ? variant.warehouseStock[selectedWarehouse]
                                        : (variant.stockQuantity || 0)
                                    }
                                 </span>
                              </div>
                           </button>
                         ))
                       ) : (
                         <button
                           onClick={() => addToCart(product)}
                           className="w-full flex-1 bg-white dark:bg-slate-800 p-4 rounded-3xl border hover:border-indigo-500 border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-right flex flex-col gap-2 active:scale-95 group relative overflow-hidden h-full"
                         >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-full aspect-square bg-slate-100 dark:bg-slate-900 rounded-2xl mb-2 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                              {product.thumbnail || (product.images && product.images[0]) ? (
                                <img src={product.thumbnail || product.images?.[0]} alt={product.name} className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal" />
                              ) : (
                                <Package size={32} className="text-slate-300 dark:text-slate-600" />
                              )}
                            </div>
                            <span className="font-bold text-xs text-slate-800 dark:text-white line-clamp-2 leading-snug">{product.name}</span>
                            <div className="mt-auto flex items-end justify-between pt-2 w-full">
                                <span className="text-base font-black text-slate-900 dark:text-white tabular-nums tracking-tight">{product.price.toLocaleString()} <span className="text-[10px] text-slate-500">ج.م</span></span>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg">
                                   مخزن: {
                                     selectedWarehouse && product.warehouseStock && product.warehouseStock[selectedWarehouse] !== undefined
                                       ? product.warehouseStock[selectedWarehouse]
                                       : (product.stockQuantity || 0)
                                   }
                                </span>
                            </div>
                         </button>
                       )}
                    </div>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400">
                      <Package size={48} className="mx-auto opacity-30 mb-2" />
                      <p className="font-bold text-sm">لا توجد منتجات تطابق البحث</p>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* Cart & Checkout - Right Side */}
          <div className="w-full lg:w-[420px] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-2xl shadow-indigo-500/5 overflow-y-auto shrink-0 relative z-10 no-scrollbar">
            {/* Header with Quick Actions */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-between">
               <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3">
                 <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                   <ShoppingCart size={18} />
                 </div>
                 السلة الفاتورة
               </h2>

               <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <>
                      <button
                        onClick={handleParkOrder}
                        className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded-xl font-bold text-xs flex items-center gap-1 transition-all"
                        title="تعليق الطلب (F4)"
                      >
                        <PauseCircle size={14} /> تعليق
                      </button>
                      <button
                        onClick={() => setCart([])}
                        className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-xs transition-all"
                        title="مسح السلة (F8)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-3 py-1 rounded-lg font-bold">
                    {cart.length} أصناف
                  </span>
               </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 px-5 py-4 space-y-3 shrink-0 min-h-[220px]">
               <AnimatePresence>
                 {cart.length === 0 ? (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full min-h-[180px] flex flex-col items-center justify-center text-slate-400 gap-3">
                     <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                       <ShoppingCart size={32} className="opacity-20" />
                     </div>
                     <p className="text-xs font-bold tracking-tight text-slate-400">امسح الباركود أو انقر على المنتج للإضافة</p>
                   </motion.div>
                 ) : (
                   cart.map((item, idx) => (
                     <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.98 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.95, height: 0 }}
                        key={idx} 
                        className="bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-3.5 flex flex-col gap-2.5 group transition-all hover:border-indigo-200 dark:hover:border-indigo-900/40"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-tight flex-1 pl-3">{item.name}</h4>
                          <button onClick={() => removeFromCart(idx)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"><Trash2 size={14}/></button>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                           <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5 rounded-xl">
                              <button onClick={() => updateQuantity(idx, 1)} className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors"><Plus size={12}/></button>
                              <span className="w-7 text-center text-xs font-black tabular-nums">{item.quantity}</span>
                              <button onClick={() => updateQuantity(idx, -1)} className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 hover:text-rose-500 transition-colors"><Minus size={12}/></button>
                           </div>

                           <div className="flex items-center justify-end gap-1 text-left">
                              <input 
                                 type="number"
                                 value={item.price || ''}
                                 onChange={(e) => updatePrice(idx, parseFloat(e.target.value) || 0)}
                                 className="w-20 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all tabular-nums"
                                 min="0"
                              />
                              <span className="text-[10px] font-bold text-slate-500">ج.م</span>
                           </div>
                        </div>
                     </motion.div>
                   ))
                 )}
               </AnimatePresence>
            </div>

            {/* Checkout Form & Calculations */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200/60 dark:border-slate-800 space-y-4 relative z-20 shrink-0">
               {/* Warehouse Select */}
               <div className="space-y-1 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">خصم الكمية من مستودع</label>
                  <select 
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-9 px-3 rounded-xl text-xs font-black outline-none"
                  >
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
               </div>

               {/* Sale Type (Paid vs Credit) */}
               <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentStatusType('paid')}
                    className={`p-2.5 rounded-xl font-black text-xs transition-all border-2 ${paymentStatusType === 'paid' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}
                  >
                    بيع نقدي
                  </button>
                  <button
                    onClick={() => setPaymentStatusType('credit')}
                    className={`p-2.5 rounded-xl font-black text-xs transition-all border-2 ${paymentStatusType === 'credit' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}
                  >
                    بيع أجل (دين)
                  </button>
               </div>

               {/* Custody / Cash Receiver */}
               <AnimatePresence>
                 {paymentStatusType === 'paid' && !settings.disableCustodySelling && (
                   <motion.div 
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     exit={{ opacity: 0, height: 0 }}
                     className="space-y-1 text-right overflow-hidden"
                   >
                      <label className="text-[10px] font-black text-slate-500 uppercase flex items-center justify-between">
                         <span>المستلم (في العهدة)</span>
                         <User size={12} />
                      </label>
                      <select 
                        value={selectedCashHolder || (allPossibleHolders[0]?.id || '')}
                        onChange={(e) => setSelectedCashHolder(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 h-10 px-3 rounded-xl text-xs font-black outline-none focus:border-indigo-500 cursor-pointer"
                      >
                         <option value="">-- اختر جهة الاستلام --</option>
                         {treasuryAccountsList.length > 0 && (
                            <optgroup label="🏦 الحسابات البنكية والخزائن">
                              {treasuryAccountsList.map((acc: any) => (
                                <option key={`treas_${acc.id}`} value={`treas_${acc.id}`}>
                                  🏦 {acc.name} ({acc.type || "خزينة"})
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {(employeesList.length > 0 || partnersList.length > 0) && (
                            <optgroup label="👤 العهدة النقدية (المدير والموظفين)">
                              <option value="admin">👤 عهدة المدير (أنت)</option>
                              {partnersList.map((p: any, index: number) => (
                                <option key={`part_${p.id || index}`} value={`part_${p.id || index}`}>
                                  🤝 {p.name} (عهدة شريك)
                                </option>
                              ))}
                              {employeesList.map((emp: any, index: number) => (
                                <option key={`emp_${emp.id || emp.phone || index}`} value={`emp_${emp.id || emp.phone || index}`}>
                                  👤 {emp.name} (عهدة موظف)
                                </option>
                              ))}
                            </optgroup>
                          )}
                      </select>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Payment Methods */}
               {paymentStatusType === 'paid' && (
                 <div className="grid grid-cols-3 gap-2">
                   {[
                     { id: 'cash', icon: <Banknote size={16}/>, label: 'كاش' },
                     { id: 'card', icon: <CreditCard size={16}/>, label: 'فيزا' },
                     { id: 'wallet', icon: <Wallet size={16}/>, label: 'محفظة' }
                   ].map(method => (
                     <button
                       key={method.id}
                       onClick={() => setPaymentMethod(method.id as any)}
                       className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border-2 transition-all ${paymentMethod === method.id ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 border-indigo-500 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}
                     >
                       {method.icon}
                       <span className="text-xs font-black">{method.label}</span>
                     </button>
                   ))}
                 </div>
               )}

               {/* Customer Quick Info */}
               <div className="space-y-2 w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-3 rounded-2xl relative">
                  <div className="flex items-center justify-between px-1">
                     <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><User size={12}/> بيانات العميل</span>
                     <button 
                       type="button"
                       onClick={() => setIsCustomerListOpen(true)}
                       className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md hover:bg-indigo-100 flex items-center gap-1"
                     >
                       <SearchCode size={11}/> المسجلين
                     </button>
                     <CustomerSelectModal 
                       isOpen={isCustomerListOpen}
                       onClose={() => setIsCustomerListOpen(false)}
                       customers={customersList}
                       onSelect={(c) => {
                          setCustomerInfo({ name: c.name || '', phone: c.phone || '', address: c.address || '', debtBalance: c.debtBalance || 0 });
                          setIsCustomerListOpen(false);
                       }}
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     <input 
                        type="text" 
                        placeholder="اسم العميل"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-9 px-2.5 rounded-xl text-xs font-bold outline-none focus:border-indigo-500" 
                     />
                     <div className="relative">
                       <input 
                          type="text" 
                          placeholder="الموبايل"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-9 px-2.5 rounded-xl text-xs font-bold outline-none focus:border-indigo-500" 
                       />
                       {(customerInfo as any).debtBalance > 0 && (
                          <div className="absolute -top-5 left-0 bg-red-100 dark:bg-red-500/20 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1">
                             مديونية: {(customerInfo as any).debtBalance} ج.م
                          </div>
                       )}
                     </div>
                  </div>
               </div>

               {/* Quick Cash Calculator (الباقي والدفع) */}
               {paymentMethod === 'cash' && paymentStatusType === 'paid' && (
                 <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-1">
                       <Calculator size={14} className="text-indigo-500" />
                       حاسبة النقدية والباقي
                     </span>
                     {numericPaidCash > 0 && (
                       <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                         الباقي: {cashChangeAmount.toLocaleString()} ج.م
                       </span>
                     )}
                   </div>

                   <div className="flex items-center gap-2">
                     <input
                       type="number"
                       placeholder="المبلغ المدفوع كاش..."
                       value={paidCashAmount}
                       onChange={(e) => setPaidCashAmount(e.target.value ? Number(e.target.value) : '')}
                       className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 h-9 px-3 rounded-xl text-xs font-black outline-none focus:border-indigo-500 tabular-nums"
                     />
                     <div className="flex gap-1">
                       {[totalAmount, 100, 200, 500, 1000].map(val => (
                         <button
                           key={val}
                           type="button"
                           onClick={() => setPaidCashAmount(val)}
                           className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black rounded-lg hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                         >
                           {val}
                         </button>
                       ))}
                     </div>
                   </div>
                 </div>
               )}

               {/* Discount Chips & Total */}
               <div className="pt-3 border-t-2 border-slate-200 border-dashed dark:border-slate-700/50 space-y-3">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-1">
                       <span className="text-xs font-black text-slate-500">خصم إضافي</span>
                       <div className="flex gap-1 ml-2">
                          {[0, 5, 10, 15].map(pct => {
                            const val = Math.round((totalAmountBeforeDiscount * pct) / 100);
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setDiscountAmount(val)}
                                className={`px-2 py-0.5 text-[9px] font-black rounded-md border ${discountAmount === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200'}`}
                              >
                                {pct}%
                              </button>
                            );
                          })}
                       </div>
                     </div>
                     <div className="relative">
                        <input
                           type="number"
                           value={discountAmount || ''}
                           onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                           className="w-20 text-left pr-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-8 px-2 rounded-xl text-xs font-black outline-none focus:border-indigo-500 tabular-nums"
                           placeholder="0"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">ج.م</span>
                     </div>
                  </div>
                  
                  <div className="flex items-end justify-between my-2">
                     <span className="text-sm font-black text-slate-500">الإجمالي النهائي</span>
                     <div className="text-left">
                        <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{totalAmount.toLocaleString()}</span>
                        <span className="text-xs font-bold text-slate-400 ml-1">ج.م</span>
                     </div>
                  </div>
                  
                  <button 
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isProcessing}
                    className={`w-full h-14 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-50 ${paymentStatusType === 'credit' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30 text-white'}`}
                  >
                     <CheckCircle2 size={22} />
                     {paymentStatusType === 'credit' ? 'حفظ كطلب أجل (غير مدفوع)' : 'تأكيد البيع وطباعة الفاتورة'}
                  </button>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <POSSalesLog 
          sales={settings.posSales || []} 
          settings={settings} 
          updateSettings={updateSettings} 
          updateStoreData={updateStoreData}
          allHolders={allPossibleHolders}
          orders={orders}
          wallet={wallet}
          treasury={treasury}
          selectedWarehouse={selectedWarehouse}
          customers={customersList}
          onSelectReceipt={(sale) => setLastReceiptSale(sale)}
        />
      )}

      {/* Parked Orders Modal */}
      {showParkedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <PauseCircle className="text-amber-500" size={22} />
                الطلبات المعلقة ({parkedOrders.length})
              </h3>
              <button onClick={() => setShowParkedModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>

            <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {parkedOrders.length === 0 ? (
                <p className="text-center text-slate-400 py-8 font-bold text-xs">لا توجد طلبات معلقة حالياً</p>
              ) : (
                parkedOrders.map((parked) => {
                  const total = parked.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                  return (
                    <div key={parked.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                      <div className="space-y-1 text-right">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-slate-800 dark:text-white">{parked.customerInfo.name || 'عميل نقدي'}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">{parked.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">{parked.items.length} أصناف • إجمالي {total.toLocaleString()} ج.م</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreParkedOrder(parked)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all"
                        >
                          استرجاع 📂
                        </button>
                        <button
                          onClick={() => setParkedOrders(parkedOrders.filter(p => p.id !== parked.id))}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Keyboard Shortcuts Drawer */}
      {showHotkeysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="text-indigo-500" size={22} />
                اختصارات لوحة المفاتيح
              </h3>
              <button onClick={() => setShowHotkeysModal(false)} className="p-1 text-slate-400"><X size={20}/></button>
            </div>

            <div className="py-4 space-y-3">
              {[
                { key: '/ أو F2', desc: 'التركيز المباشر على مربع البحث والباركود' },
                { key: 'Enter', desc: 'إضافة سريعة بالباركود' },
                { key: 'F4', desc: 'تعليق السلة الحالية' },
                { key: 'F8', desc: 'تفريع وتأكيد مسح السلة' },
                { key: 'Esc', desc: 'إلغاء التركيز أو إغلاق النوافذ' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.desc}</span>
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-black text-indigo-600 rounded-lg">{item.key}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Thermal Receipt Preview Modal */}
      {lastReceiptSale && (
        <ThermalReceiptModal
          sale={lastReceiptSale}
          settings={settings}
          onClose={() => setLastReceiptSale(null)}
        />
      )}
    </div>
  );
};

// Thermal Receipt Modal Component
const ThermalReceiptModal: React.FC<{
  sale: POSSale;
  settings: Settings;
  onClose: () => void;
}> = ({ sale, settings, onClose }) => {
  const storeName = (settings as any).storeName || (settings as any).name || 'متجر الكاشير المباشر';

  const handlePrint = () => {
    const receiptHtml = `
      <div dir="rtl" style="font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; margin: 0 auto; color: #000; background: #fff;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <h2 style="font-size: 16px; font-weight: bold; margin: 0;">${storeName}</h2>
          <p style="font-size: 11px; margin: 4px 0 0 0;">فاتورة بيع مباشر #${sale.saleNumber}</p>
          <p style="font-size: 10px; margin: 2px 0 0 0;">التاريخ: ${new Date(sale.date).toLocaleString('ar-EG')}</p>
        </div>

        <div style="font-size: 11px; margin-bottom: 8px;">
          <p style="margin: 2px 0;">العميل: ${sale.customerName || 'عميل نقدي'}</p>
          <p style="margin: 2px 0;">الكاشير: ${sale.performedBy}</p>
        </div>

        <table style="width: 100%; font-size: 11px; border-collapse: collapse; border-bottom: 1px dashed #000; margin-bottom: 8px;">
          <thead>
            <tr style="border-bottom: 1px solid #000; text-align: right;">
              <th style="padding: 4px 0;">الصنف</th>
              <th style="padding: 4px 0; text-align: center;">العدد</th>
              <th style="padding: 4px 0; text-align: left;">السعر</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td style="padding: 4px 0;">${item.name}</td>
                <td style="padding: 4px 0; text-align: center;">${item.quantity}</td>
                <td style="padding: 4px 0; text-align: left;">${(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="font-size: 12px; font-weight: bold; text-align: right; space-y: 2px;">
          <p style="margin: 4px 0; font-size: 14px;">الإجمالي: ${sale.totalAmount.toLocaleString()} ج.م</p>
          <p style="margin: 2px 0; font-size: 10px; font-weight: normal;">طريقة الدفع: ${sale.paymentMethod === 'cash' ? 'نقداً (كاش)' : sale.paymentMethod === 'card' ? 'فيزا' : 'محفظة'}</p>
        </div>

        <div style="text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 8px; font-size: 10px;">
          <p style="margin: 0;">شكراً لزيارتكم! نعتز بخدمتكم دائماً</p>
        </div>
      </div>
    `;
    printHTMLDirectly(receiptHtml);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Printer size={18} className="text-indigo-600" /> معاينة الإيصال الحراري
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18}/></button>
        </div>

        {/* Paper Thermal Effect Receipt */}
        <div className="my-4 bg-amber-50/60 dark:bg-slate-950 p-4 rounded-2xl border border-amber-200/60 dark:border-slate-800 font-mono text-slate-900 dark:text-slate-100 text-xs space-y-3 shadow-inner">
          <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-3">
            <h4 className="font-black text-sm">{storeName}</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">فاتورة بيع مباشر #{sale.saleNumber}</p>
            <p className="text-[9px] text-slate-400">{new Date(sale.date).toLocaleString('ar-EG')}</p>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-slate-500">العميل:</span><span>{sale.customerName || 'عميل نقدي'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">الكاشير:</span><span>{sale.performedBy}</span></div>
          </div>

          <div className="border-t border-b border-dashed border-slate-300 dark:border-slate-700 py-2 space-y-1.5">
            {sale.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span className="truncate max-w-[160px]">{item.name} ×{item.quantity}</span>
                <span className="font-bold">{(item.price * item.quantity).toLocaleString()} ج.م</span>
              </div>
            ))}
          </div>

          <div className="pt-1 flex items-center justify-between font-black text-sm">
            <span>المبلغ الإجمالي:</span>
            <span className="text-indigo-600 dark:text-indigo-400">{sale.totalAmount.toLocaleString()} ج.م</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Printer size={16} /> طباعة حرارية فورية
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-xs"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
};

interface POSSalesLogProps {
  sales: POSSale[];
  settings: Settings;
  updateSettings: (s: Settings) => void;
  updateStoreData: (data: any) => void;
  allHolders: { id: string; name: string }[];
  orders: Order[];
  wallet: WalletType;
  treasury?: Treasury;
  selectedWarehouse: string;
  customers?: any[];
  onSelectReceipt?: (sale: POSSale) => void;
}

const POSSalesLog: React.FC<POSSalesLogProps> = ({ sales, settings, updateSettings, updateStoreData, allHolders, orders, wallet, treasury, selectedWarehouse, customers, onSelectReceipt }) => {
  const warehouses = settings.warehouses || [];
  const [filter, setFilter] = useState({
    startDate: '',
    endDate: '',
    cashier: '',
    paymentType: '',
    searchTerm: ''
  });

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const saleDate = new Date(sale.date);
      const start = filter.startDate ? new Date(filter.startDate) : null;
      const end = filter.endDate ? new Date(filter.endDate) : null;
      
      const dateMatch = (!start || saleDate >= start) && (!end || saleDate <= end);
      const cashierMatch = !filter.cashier || sale.performedBy === filter.cashier;
      const paymentMatch = !filter.paymentType || 
                          (filter.paymentType === 'credit' ? sale.cashHolderId === 'credit' : sale.cashHolderId !== 'credit');
      const searchMatch = !filter.searchTerm || 
                          sale.saleNumber.includes(filter.searchTerm) || 
                          sale.customerName?.toLowerCase().includes(filter.searchTerm.toLowerCase()) ||
                          sale.customerPhone?.includes(filter.searchTerm);

      return dateMatch && cashierMatch && paymentMatch && searchMatch;
    });
  }, [sales, filter]);

  const totalFilteredAmount = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);

  const [editingSale, setEditingSale] = useState<POSSale | null>(null);
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<POSSale | null>(null);

  const handleUpdateSale = (updated: POSSale) => {
     const newSales = sales.map(s => s.id === updated.id ? updated : s);
     
     const newOrders = orders.map(o => {
       if (o.id === updated.id) {
         return {
           ...o,
           customerName: updated.customerName || o.customerName,
           customerPhone: updated.customerPhone || o.customerPhone,
           customerAddress: updated.customerAddress || o.customerAddress,
           notes: updated.notes || o.notes
         };
       }
       return o;
     });

     updateStoreData({
       settings: { ...settings, posSales: newSales },
       orders: newOrders
     });
     setEditingSale(null);
  };

  const handleDeleteSale = (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    // 1. Restore Stock
    const updatedProducts = [...(settings.products || [])];
    sale.items.forEach(item => {
      const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
      if (pIdx > -1) {
        const prod = { ...updatedProducts[pIdx] };
        if (item.variantId && prod.variants) {
          prod.variants = prod.variants.map(v => {
            if (v.id === item.variantId) {
              const vUpdated = { ...v };
              vUpdated.stockQuantity = (vUpdated.stockQuantity || 0) + item.quantity;
              vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
              vUpdated.warehouseStock[sale.warehouseId] = (vUpdated.warehouseStock[sale.warehouseId] || 0) + item.quantity;
              return vUpdated;
            }
            return v;
          });
        } else {
          prod.stockQuantity = (prod.stockQuantity || 0) + item.quantity;
          prod.warehouseStock = { ...(prod.warehouseStock || {}) };
          prod.warehouseStock[sale.warehouseId] = (prod.warehouseStock[sale.warehouseId] || 0) + item.quantity;
        }
        updatedProducts[pIdx] = prod;
      }
    });

    // 2. Remove Wallet Transaction if applicable
    let updatedWallet = { ...wallet || { balance: 0, transactions: [] } };
    const affectedWallet = sale.paymentMethod !== 'cash' && sale.cashHolderId !== 'credit';
    if (affectedWallet) {
      updatedWallet.balance = Math.max(0, (updatedWallet.balance || 0) - sale.totalAmount);
      updatedWallet.transactions = (updatedWallet.transactions || []).filter(t => t.orderId !== sale.id);
    }

    // Revert Cash Holder Balance
    let updatedHolders = [...(settings.cashHolders || [])];
    let updatedTreasury = treasury ? { ...treasury, accounts: [...treasury.accounts], transactions: [...(treasury.transactions || [])] } : null;

    if (sale.cashHolderId && sale.cashHolderId !== 'credit' && sale.cashHolderId !== 'wallet') {
      if (String(sale.cashHolderId).startsWith('treas_') && updatedTreasury) {
        const treasuryId = String(sale.cashHolderId).substring(6);
        const accIdx = updatedTreasury.accounts.findIndex(a => a.id === treasuryId);
        if (accIdx > -1) {
          updatedTreasury.accounts[accIdx] = {
            ...updatedTreasury.accounts[accIdx],
            balance: Math.max(0, updatedTreasury.accounts[accIdx].balance - sale.totalAmount)
          };
          updatedTreasury.transactions = updatedTreasury.transactions.filter(t => t.reference !== saleId);
        }
      } else {
        const cleanTargetId = String(sale.cashHolderId).replace(/^(emp_|part_|treas_)/, '');
        const hIdx = updatedHolders.findIndex(h => {
          const cleanHolderId = String(h.userId).replace(/^(emp_|part_|treas_)/, '');
          return String(h.userId) === String(sale.cashHolderId) || (cleanHolderId === cleanTargetId && cleanHolderId !== '');
        });
        if (hIdx > -1) {
          updatedHolders[hIdx] = {
            ...updatedHolders[hIdx],
            currentBalance: Math.max(0, (updatedHolders[hIdx].currentBalance || 0) - sale.totalAmount),
            lastUpdated: new Date().toISOString()
          };
        }
      }
    }
    
    const updatedHandovers = (settings.cashHandovers || []).filter(h => {
      const notes = h.notes || "";
      const matchOrderId = h.orderId === saleId || notes.includes(saleId);
      const matchOrderNum = sale.saleNumber ? notes.includes(`#${sale.saleNumber}`) || notes.includes(sale.saleNumber) : false;
      return !(matchOrderId || matchOrderNum);
    });

    const newSales = sales.filter(s => s.id !== saleId);
    const newOrders = orders.filter(o => o.id !== saleId);

    let updatedCustomers = [...(customers || [])];
    if (sale.cashHolderId === 'credit' && sale.customerPhone) {
      const cIdx = updatedCustomers.findIndex(c => c.phone === sale.customerPhone);
      if (cIdx > -1) {
        const debtEntry = {
          id: `debt-revert-${Date.now()}`,
          amount: sale.totalAmount,
          type: 'decrease',
          reason: `إلغاء مبيعات آجل - طلب #${sale.saleNumber}`,
          date: new Date().toISOString()
        };
        updatedCustomers[cIdx] = {
          ...updatedCustomers[cIdx],
          debtBalance: Math.max(0, (updatedCustomers[cIdx].debtBalance || 0) - sale.totalAmount),
          debtHistory: [debtEntry, ...(updatedCustomers[cIdx].debtHistory || [])]
        };
      }
    }

    updateStoreData({
      settings: { ...settings, products: updatedProducts, posSales: newSales, cashHolders: updatedHolders, cashHandovers: updatedHandovers },
      orders: newOrders,
      wallet: updatedWallet,
      treasury: updatedTreasury,
      customers: updatedCustomers
    });
  };

  const handlePrintReport = (mode: 'print' | 'pdf') => {
    const html = `
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: white !important; color: #1e293b;">
        <style>
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background-color: #4f46e5 !important; color: white !important; -webkit-print-color-adjust: exact; }
          td, th { border: 1px solid #e2e8f0; padding: 12px; text-align: right; }
          .summary-box { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc !important; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; -webkit-print-color-adjust: exact; }
        </style>
        
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #4f46e5; padding-bottom: 20px;">
          <h1 style="color: #1e293b; font-size: 28px; margin: 0;">تقرير مبيعات ${warehouses.find(w => w.id === selectedWarehouse)?.name || 'نقطة البيع'} (POS)</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 8px;">تاريخ استخراج التقرير: ${new Date().toLocaleString('ar-EG')}</p>
        </div>

        <div class="summary-box">
          <div>
            <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 4px;">إجمالي المبيعات (الفلتر الحالي)</span>
            <span style="color: #4f46e5; font-size: 24px; font-weight: 900;">${totalFilteredAmount.toLocaleString()} ج.م</span>
          </div>
          <div style="text-align: left;">
            <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 4px;">إجمالي العمليات</span>
            <span style="color: #1e293b; font-size: 24px; font-weight: 900;">${filteredSales.length} حركة</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%;">رقم الحركة</th>
              <th style="width: 15%;">التاريخ</th>
              <th style="width: 20%;">العميل</th>
              <th style="width: 15%;">الكاشير</th>
              <th style="width: 20%;">المستلم (في العهدة)</th>
              <th style="width: 15%;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSales.map(s => `
              <tr>
                <td style="font-weight: bold; color: #4f46e5;">#${s.saleNumber}</td>
                <td style="font-size: 11px;">${new Date(s.date).toLocaleDateString('ar-EG')}</td>
                <td style="font-size: 11px;">${s.customerName || 'عميل نقدي'}</td>
                <td style="font-size: 11px;">${s.performedBy}</td>
                <td style="font-size: 11px; font-weight: bold; background: #fff7ed !important; -webkit-print-color-adjust: exact;">
                  <div style="color: #9a3412; font-size: 9px; margin-bottom: 2px;">بعهدة:</div>
                  <div style="color: ${s.cashHolderId === 'credit' ? '#b45309' : '#1e293b'};">
                    ${s.cashHolderName || (s.cashHolderId === 'credit' ? 'حساب آجل (مديونية)' : 'غير محدد')}
                  </div>
                </td>
                <td style="font-size: 13px; font-weight: 900; background: #f1f5f9 !important; text-align: center; -webkit-print-color-adjust: exact;">${s.totalAmount.toLocaleString()} ج.م</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc !important; font-weight: bold; -webkit-print-color-adjust: exact;">
              <td colspan="5" style="padding: 15px; text-align: left; font-size: 14px;">إجمالي القيمة المستخرجة</td>
              <td style="padding: 15px; text-align: center; color: #4f46e5; font-size: 16px;">${totalFilteredAmount.toLocaleString()} ج.م</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="margin-top: 50px; border-top: 1px dashed #e2e8f0; padding-top: 20px; font-size: 10px; color: #94a3b8; text-align: center;">
          هذا المستند يعتبر تقرير داخلي ولا يعتد به كفاتورة ضريبية • تم الاستخراج بنجاح بواسطة النظام الذكي
        </div>
      </div>
    `;
    
    if (mode === 'print') {
      printHTMLDirectly(html);
    } else {
      exportHTMLToPDF(html, 'landscape', `تقرير_مبيعات_POS_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6" dir="rtl">
       <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
             <h2 className="text-2xl font-black text-slate-800 dark:text-white">سجل حركات {warehouses.find(w => w.id === selectedWarehouse)?.name || 'نقطة البيع'}</h2>
             <p className="text-sm text-slate-500 font-bold">عرض وفلترة جميع العمليات التي تمت عبر الكاشير</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-indigo-50 dark:bg-indigo-950/30 px-6 py-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[10px] font-black text-indigo-400 block uppercase">إجمالي مبيعات الفلتر</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{totalFilteredAmount.toLocaleString()} ج.م</span>
             </div>
             <button 
                onClick={() => handlePrintReport('print')}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:scale-105 transition-all"
             >
                <Printer size={20} />
                معاينة وطباعة
             </button>
             <button 
                onClick={() => handlePrintReport('pdf')}
                className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
             >
                تحميل PDF
             </button>
          </div>
       </div>

       {/* Filters */}
       <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">البحث برقم الطلب أو العميل</label>
             <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="بحث..."
                  value={filter.searchTerm}
                  onChange={(e) => setFilter({...filter, searchTerm: e.target.value})}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 pl-10 pr-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
             </div>
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">من تاريخ</label>
             <input 
               type="date"
               value={filter.startDate}
               onChange={(e) => setFilter({...filter, startDate: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
             />
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">إلى تاريخ</label>
             <input 
               type="date"
               value={filter.endDate}
               onChange={(e) => setFilter({...filter, endDate: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
             />
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">الموظف (الكاشير)</label>
             <select 
               value={filter.cashier}
               onChange={(e) => setFilter({...filter, cashier: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
             >
                <option value="">الكل</option>
                {Array.from(new Set(sales.map(s => s.performedBy))).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">نوع الدفع</label>
             <select 
               value={filter.paymentType}
               onChange={(e) => setFilter({...filter, paymentType: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
             >
                <option value="">الكل</option>
                <option value="cash">نقدي</option>
                <option value="credit">آجل / عهدة</option>
             </select>
          </div>
       </div>

       {/* Sales Table */}
       <div className="flex-1 overflow-x-auto min-h-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">رقم البيع</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">التاريخ</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">العميل</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">بواسطة</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">المستلم</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">الإجمالي</th>
                   <th className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">الإجراءات</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.map(sale => (
                   <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4">
                         <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Receipt size={14} className="text-indigo-500" />
                            {sale.saleNumber}
                         </span>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col">
                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{new Date(sale.date).toLocaleDateString('ar-EG')}</span>
                            <span className="text-[9px] font-bold text-slate-400">{new Date(sale.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                         </div>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col max-w-[150px]">
                            <span className="text-xs font-black text-slate-800 dark:text-white truncate">{sale.customerName || 'عميل نقدي'}</span>
                            <span className="text-[10px] font-bold text-slate-400">{sale.customerPhone || '-'}</span>
                         </div>
                      </td>
                      <td className="p-4">
                         <span className="text-xs font-black text-slate-700 dark:text-slate-300">{sale.performedBy}</span>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase mb-0.5">طريقة التحصيل:</span>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-block w-fit ${sale.cashHolderId === 'credit' ? 'bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30'}`}>
                                  {sale.cashHolderName || 
                                   (sale.cashHolderId === 'credit' ? 'حساب آجل' : 
                                    sale.cashHolderId === 'wallet' ? 'المحفظة العامة' : 
                                    allHolders.find(h => h.id === sale.cashHolderId)?.name || 'غير محدد')}
                            </span>
                         </div>
                      </td>
                      <td className="p-4">
                         <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{sale.totalAmount.toLocaleString()} ج.م</span>
                      </td>
                      <td className="p-4">
                         <div className="flex items-center justify-center gap-1.5">
                            <button 
                               onClick={() => onSelectReceipt && onSelectReceipt(sale)}
                               className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all"
                               title="طباعة الإيصال الحراري"
                            >
                               <Printer size={16} />
                            </button>
                            <button 
                               onClick={() => setEditingSale(sale)}
                               className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all"
                               title="تعديل"
                            >
                               <Monitor size={16} />
                            </button>
                            <button 
                               onClick={() => setDeleteConfirmSale(sale)}
                               className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                               title="حذف"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                      </td>
                   </tr>
                ))}
                {filteredSales.length === 0 && (
                   <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400/50">
                         <div className="flex flex-col items-center gap-4">
                            <SearchCode size={48} className="opacity-20" />
                            <p className="font-black text-sm italic">لا توجد عمليات مبيعات تطابق الفلتر الحالي</p>
                         </div>
                      </td>
                   </tr>
                )}
             </tbody>
          </table>
       </div>

        {/* Delete Modal */}
        {deleteConfirmSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
             <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
             >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                   <h3 className="text-xl font-black text-rose-600 dark:text-rose-500 flex items-center gap-2">
                      <Trash2 size={24} />
                      تأكيد حذف حركة البيع
                   </h3>
                   <button onClick={() => setDeleteConfirmSale(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400"><X size={24}/></button>
                </div>
                <div className="p-8 space-y-4" dir="rtl">
                   <div className="text-center space-y-2">
                      <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center mx-auto mb-2 text-rose-500">
                         <Trash2 size={32} />
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 font-extrabold text-lg">
                         هل أنت متأكد من حذف حركة البيع؟
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold leading-relaxed px-4">
                         سيتم إلغاء العملية واستعادة كميات المخزون لجميع الأصناف تلقائياً إلى المستودع المحدد.
                      </p>
                   </div>

                   <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-bold font-sans">
                         <span className="text-slate-400">رقم حركة البيع:</span>
                         <span className="font-black text-slate-700 dark:text-slate-300">#{deleteConfirmSale.saleNumber}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold font-sans">
                         <span className="text-slate-400">قيمة المعاملة:</span>
                         <span className="font-extrabold text-slate-900 dark:text-white">{deleteConfirmSale.totalAmount.toLocaleString()} ج.م</span>
                      </div>
                   </div>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                   <button 
                      onClick={() => {
                         handleDeleteSale(deleteConfirmSale.id);
                         setDeleteConfirmSale(null);
                      }}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-12 rounded-2xl font-black shadow-lg shadow-rose-600/20 transition-all active:scale-95 font-sans"
                   >
                      تأكيد الحذف النهائي
                   </button>
                   <button 
                      onClick={() => setDeleteConfirmSale(null)}
                      className="px-8 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-2xl font-black hover:bg-slate-50 active:scale-95 font-sans"
                   >
                      إلغاء
                   </button>
                </div>
             </motion.div>
          </div>
        )}

       {/* Edit Sale Modal */}
       {editingSale && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                     <Receipt className="text-indigo-500" size={24} />
                     تعديل عملية بيع #{editingSale.saleNumber}
                  </h3>
                  <button onClick={() => setEditingSale(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400"><X size={24}/></button>
               </div>
               <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 mr-2 uppercase italic">اسم العميل</label>
                        <input 
                           type="text" 
                           value={editingSale.customerName || ''}
                           onChange={(e) => setEditingSale({...editingSale, customerName: e.target.value})}
                           className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-black focus:border-indigo-500 outline-none" 
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 mr-2 uppercase italic">رقم الموبايل</label>
                        <input 
                           type="text" 
                           value={editingSale.customerPhone || ''}
                           onChange={(e) => setEditingSale({...editingSale, customerPhone: e.target.value})}
                           className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-black focus:border-indigo-500 outline-none" 
                        />
                     </div>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 mr-2 uppercase italic">العنوان / ملاحظات البيع</label>
                     <textarea 
                        value={editingSale.notes || ''}
                        onChange={(e) => setEditingSale({...editingSale, notes: e.target.value})}
                        className="w-full h-24 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-2xl p-5 text-sm font-black focus:border-indigo-500 outline-none resize-none" 
                     />
                  </div>
               </div>
               <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button 
                     onClick={() => handleUpdateSale(editingSale)}
                     className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-2xl font-black shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                  >
                     حفظ التغييرات
                  </button>
                  <button 
                     onClick={() => setEditingSale(null)}
                     className="px-8 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-2xl font-black hover:bg-slate-50 active:scale-95"
                  >
                     إلغاء
                  </button>
               </div>
            </motion.div>
         </div>
       )}
    </div>
  );
};

export default POSPage;
