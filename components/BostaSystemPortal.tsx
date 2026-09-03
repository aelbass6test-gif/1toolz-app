import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { User as AppUser, Order, BostaConfig, BostaPickupRequest } from '../types';
import { 
  ArrowLeft, Truck, Percent, Coins, Info, Calculator, 
  HelpCircle, Wallet, Banknote, MapPin, Sparkles, Link, 
  Calendar, DollarSign, CheckCircle2, ListFilter, Play,
  ChevronDown, ChevronUp, Globe, Search, RefreshCw, X, ShieldCheck,
  Package, ShoppingCart, Minus, Check, Plus, User, Settings, Trash2,
  ExternalLink, Eye, EyeOff, AlertCircle, FileText, Send, Clock, Printer,
  Code, Zap, CheckCheck, BookOpen, Radio, Key, MessageCircle
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { bostaService, DEFAULT_BOSTA_BUSINESS_LOCATIONS } from '../utils/bostaService';
import { printPdfBlob } from '../utils/printHelper';
import { BostaPickupModal } from './BostaPickupModal';
import { BostaTrackingModal } from './BostaTrackingModal';
import { inAppAlert, inAppToast } from '../utils/inAppAlert';

interface BostaSystemPortalProps {
  onBack: () => void;
  treasury?: any;
  setTreasury?: (updater: any) => void;
  wallet?: any;
  setWallet?: (updater: any) => void;
  settings?: any;
  setSettings?: (updater: any) => void;
  orders?: Order[];
  setOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
}

interface BostaRegionRates {
  delivery: number;
  exchange: number;
  returns: number;
  cashCollection: number;
  returnToYou: number;
}

// Bosta Official Egypt Shipping Rates Matrix
const BOSTA_PRICING: Record<string, Record<string, BostaRegionRates>> = {
  'القاهرة والجيزة': {
    'فلاير (حجم صغير ومتوسط)': { delivery: 55, exchange: 72, returns: 80, cashCollection: 60, returnToYou: 46 },
    'حجم كبير (L)': { delivery: 77, exchange: 94, returns: 102, cashCollection: 82, returnToYou: 68 },
    'حجم أكبر (XL)': { delivery: 77, exchange: 94, returns: 102, cashCollection: 82, returnToYou: 68 },
    'كيس أبيض (XXL)': { delivery: 92, exchange: 109, returns: 117, cashCollection: 97, returnToYou: 83 },
    'شحنة كبيرة': { delivery: 167, exchange: 184, returns: 192, cashCollection: 172, returnToYou: 158 },
    'شحنة ضخمة': { delivery: 348, exchange: 365, returns: 499, cashCollection: 479, returnToYou: 339 }
  },
  'الاسكندرية والبحيرة': {
    'فلاير (حجم صغير ومتوسط)': { delivery: 65, exchange: 82, returns: 90, cashCollection: 70, returnToYou: 56 },
    'حجم كبير (L)': { delivery: 87, exchange: 104, returns: 112, cashCollection: 92, returnToYou: 78 },
    'حجم أكبر (XL)': { delivery: 87, exchange: 104, returns: 112, cashCollection: 92, returnToYou: 78 },
    'كيس أبيض (XXL)': { delivery: 107, exchange: 124, returns: 132, cashCollection: 112, returnToYou: 98 },
    'شحنة كبيرة': { delivery: 187, exchange: 204, returns: 212, cashCollection: 192, returnToYou: 178 },
    'شحنة ضخمة': { delivery: 378, exchange: 395, returns: 529, cashCollection: 509, returnToYou: 369 }
  },
  'الدلتا والقناة': {
    'فلاير (حجم صغير ومتوسط)': { delivery: 63, exchange: 80, returns: 88, cashCollection: 68, returnToYou: 54 },
    'حجم كبير (L)': { delivery: 85, exchange: 102, returns: 110, cashCollection: 90, returnToYou: 76 },
    'حجم أكبر (XL)': { delivery: 85, exchange: 102, returns: 110, cashCollection: 90, returnToYou: 76 },
    'كيس أبيض (XXL)': { delivery: 105, exchange: 122, returns: 130, cashCollection: 110, returnToYou: 96 },
    'شحنة كبيرة': { delivery: 180, exchange: 197, returns: 205, cashCollection: 185, returnToYou: 171 },
    'شحنة ضخمة': { delivery: 368, exchange: 385, returns: 519, cashCollection: 499, returnToYou: 359 }
  },
  'شمال الصعيد': {
    'فلاير (حجم صغير ومتوسط)': { delivery: 73, exchange: 90, returns: 98, cashCollection: 78, returnToYou: 64 },
    'حجم كبير (L)': { delivery: 95, exchange: 112, returns: 120, cashCollection: 100, returnToYou: 86 },
    'حجم أكبر (XL)': { delivery: 95, exchange: 112, returns: 120, cashCollection: 100, returnToYou: 86 },
    'كيس أبيض (XXL)': { delivery: 115, exchange: 132, returns: 140, cashCollection: 120, returnToYou: 106 },
    'شحنة كبيرة': { delivery: 200, exchange: 217, returns: 225, cashCollection: 205, returnToYou: 191 },
    'شحنة ضخمة': { delivery: 398, exchange: 415, returns: 549, cashCollection: 529, returnToYou: 389 }
  },
  'جنوب الصعيد': {
    'فلاير (حجم صغير ومتوسط)': { delivery: 88, exchange: 105, returns: 113, cashCollection: 93, returnToYou: 79 },
    'حجم كبير (L)': { delivery: 110, exchange: 127, returns: 135, cashCollection: 115, returnToYou: 101 },
    'حجم أكبر (XL)': { delivery: 110, exchange: 127, returns: 135, cashCollection: 115, returnToYou: 101 },
    'كيس أبيض (XXL)': { delivery: 130, exchange: 147, returns: 155, cashCollection: 135, returnToYou: 121 },
    'شحنة كبيرة': { delivery: 220, exchange: 237, returns: 245, cashCollection: 225, returnToYou: 211 },
    'شحنة ضخمة': { delivery: 428, exchange: 445, returns: 579, cashCollection: 559, returnToYou: 419 }
  },
  'الساحل الشمالي': {
    'فلاير (حجم صغير ومتوسط)': { delivery: 103, exchange: 120, returns: 128, cashCollection: 108, returnToYou: 94 },
    'حجم كبير (L)': { delivery: 125, exchange: 142, returns: 150, cashCollection: 130, returnToYou: 116 },
    'حجم أكبر (XL)': { delivery: 125, exchange: 142, returns: 150, cashCollection: 130, returnToYou: 116 },
    'كيس أبيض (XXL)': { delivery: 145, exchange: 162, returns: 170, cashCollection: 150, returnToYou: 136 },
    'شحنة كبيرة': { delivery: 240, exchange: 257, returns: 265, cashCollection: 245, returnToYou: 231 },
    'شحنة ضخمة': { delivery: 458, exchange: 475, returns: 609, cashCollection: 589, returnToYou: 449 }
  },
  'سيناء والوادي الجديد': {
    'فلاير (حجم صغير ومتوسط)': { delivery: 123, exchange: 140, returns: 148, cashCollection: 128, returnToYou: 114 },
    'حجم كبير (L)': { delivery: 145, exchange: 162, returns: 170, cashCollection: 150, returnToYou: 136 },
    'حجم أكبر (XL)': { delivery: 145, exchange: 162, returns: 170, cashCollection: 150, returnToYou: 136 },
    'كيس أبيض (XXL)': { delivery: 165, exchange: 182, returns: 190, cashCollection: 170, returnToYou: 156 },
    'شحنة كبيرة': { delivery: 270, exchange: 287, returns: 295, cashCollection: 275, returnToYou: 261 },
    'شحنة ضخمة': { delivery: 498, exchange: 515, returns: 649, cashCollection: 629, returnToYou: 489 }
  }
};

const BOSTA_HUBS = [
  'القاهرة - فرع المهندسين الرئيسي',
  'القاهرة - فرع المعادي الإقليمي',
  'القاهرة - فرع مدينة نصر',
  'القاهرة - التجمع الخامس والمستثمرين',
  'الجيزة - فرع الدقي الرئيسي',
  'الجيزة - فرع حدائق الأهرام والشيخ زايد',
  'الاسكندرية - فرع سموحة والوسط',
  'الاسكندرية - فرع العجمي والمنتزه',
  'الدلتا والقليوبية - بنها وطوخ',
  'الغربية والمنوفية - طنطا وشبين الكوم',
  'الدقهلية والشرقية - المنصورة والزقازيق',
  'شمال الصعيد - الفيوم وبني سويف',
  'جنوب الصعيد - سوهاج وقنا والأقصر',
  'القناة - بورسعيد والسويس والإسماعيلية'
];

export default function BostaSystemPortal({ onBack, treasury, setTreasury, wallet, setWallet, settings, setSettings, orders = [], setOrders }: BostaSystemPortalProps) {
  const [activePortalTab, setActivePortalTab] = useState<'locations' | 'calculator' | 'api-integration' | 'packaging' | 'pickups' | 'tracking'>('locations');
  const [activeRegion, setActiveRegion] = useState<string>('القاهرة والجيزة');
  const [showVat, setShowVat] = useState<boolean>(true);
  const [pickupSearch, setPickupSearch] = useState<string>('');
  const [selectedHub, setSelectedHub] = useState<string>(BOSTA_HUBS[0]);
  const [isHubDropdownOpen, setIsHubDropdownOpen] = useState<boolean>(false);

  // Packaging Store Stats
  const walletStats = useMemo(() => {
    const transactions = wallet?.transactions || [];
    const calculatedBalance = transactions.reduce((sum, t) => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount) || 0;
        if (t.category === 'supply_purchase' || t.category === 'supply_deposit' || t.category?.startsWith('supply_expense_')) return sum;
        if (t.details?.paidByPartnerId) return sum;
        if (t.type === 'إيداع') {
            if (t.status === 'cancelled') return sum;
            if (t.status === 'pending' && (t.category === 'wallet_charge' || t.category === 'charge')) return sum;
            return sum + amount;
        }
        if (t.type === 'سحب') {
             return t.status === 'cancelled' ? sum : sum - amount;
        }
        return sum;
    }, 0);
    
    const storedBalance = Number(wallet?.balance) || 0;
    
    // We trust the transactions ledger as the primary source of truth for the live balance.
    // If the user has transactions, the balance is calculated from them.
    // This allows for corrections by deleting or adding transactions.
    // We only use the stored balance if no transactions exist.
    const liveBalance = (transactions.length > 0) ? calculatedBalance : storedBalance;
    
    return { liveBalance };
  }, [wallet?.transactions, wallet?.balance]);

  const [packagingCart, setPackagingCart] = useState<Record<string, number>>({});
  const [showPackagingCheckout, setShowPackagingCheckout] = useState(false);
  const [showPackagingHistory, setShowPackagingHistory] = useState(false);
  const [selectedPackagingPaymentId, setSelectedPackagingPaymentId] = useState<string>('wallet');
  const [packagingPaymentType, setPackagingPaymentType] = useState<'treasury' | 'wallet' | 'partner'>('wallet');
  const [isPackagingProcessing, setIsPackagingProcessing] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [isEditingPackagingPrices, setIsEditingPackagingPrices] = useState(false);
  const [tempPackagingPrices, setTempPackagingPrices] = useState<Record<string, number>>({});
  const [tempPackagingShippingFee, setTempPackagingShippingFee] = useState(55);

  const BASE_PACKAGING_PRODUCTS = [
    // فلايرات
    { id: 'f_sm', name: 'فلاير صغير (30 × 25) - ١٠ قطعة', price: 4, category: 'فلايرات', image: 'https://cdn-icons-png.flaticon.com/512/679/679821.png' },
    { id: 'f_md', name: 'فلاير متوسط (40 × 35) - ١٠ قطعة', price: 5, category: 'فلايرات', image: 'https://cdn-icons-png.flaticon.com/512/679/679821.png' },
    { id: 'f_lg', name: 'فلاير كبير (50 × 45) - ١٠ قطعة', price: 7, category: 'فلايرات', image: 'https://cdn-icons-png.flaticon.com/512/679/679821.png' },
    { id: 'f_xl', name: 'فلاير اكس لارج (60 × 50) - ١٠ قطعة', price: 7.5, category: 'فلايرات', image: 'https://cdn-icons-png.flaticon.com/512/679/679821.png' },
    { id: 'f_wb', name: 'وايت باج (50 × 100) - ١٠ قطعة', price: 8, category: 'فلايرات', image: 'https://cdn-icons-png.flaticon.com/512/679/679821.png' },
    
    // صناديق
    { id: 'b_sm', name: 'صندوق صغير (20 × 13 × 9)', price: 3.5, category: 'صناديق', image: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
    { id: 'b_md', name: 'صندوق متوسط (24 × 20 × 11)', price: 7, category: 'صناديق', image: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
    { id: 'b_lg', name: 'صندوق كبير (35 × 22 × 12)', price: 11, category: 'صناديق', image: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
    { id: 'b_xl', name: 'صندوق اكس لارج (35 × 27 × 15)', price: 12, category: 'صناديق', image: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
    
    // ملصقات
    { id: 's_fr', name: 'ملصق قابل للكسر - ٥٠ قطعة', price: 60, category: 'ملصقات', image: 'https://cdn-icons-png.flaticon.com/512/4359/4359858.png' },
    { id: 's_sec', name: 'ملصق تأمين - ٥٠ قطعة', price: 60, category: 'ملصقات', image: 'https://cdn-icons-png.flaticon.com/512/4359/4359858.png' },
    { id: 's_smt', name: 'الملصق الذكي - ١٠ قطعة', price: 60, category: 'ملصقات', image: 'https://cdn-icons-png.flaticon.com/512/4359/4359858.png' },
    { id: 's_th', name: 'لفة ملصقات لاصقة حرارية (500 ملصق)', price: 360, category: 'ملصقات', image: 'https://cdn-icons-png.flaticon.com/512/4359/4359858.png' },
    
    // شريط لاصق
    { id: 't_roll', name: 'شريط لاصق كرتون (4.2 سم × 40 متر)', price: 20, category: 'تغليف', image: 'https://cdn-icons-png.flaticon.com/512/9338/9338166.png' },
    
    // أخرى
    { id: 'o_bub', name: 'وسائد فقاعات هوائية - ١٠ قطعة', price: 40, category: 'أخرى', image: 'https://cdn-icons-png.flaticon.com/512/3014/3014605.png' },
    { id: 'o_seal', name: 'افيز تأمين', price: 150, category: 'أخرى', image: 'https://cdn-icons-png.flaticon.com/512/9338/9338166.png' },
    { id: 'o_a4', name: 'ورق A4 بوزن 70 جرام (500 ورقة)', price: 200, category: 'أخرى', image: 'https://cdn-icons-png.flaticon.com/512/3389/3389020.png' },
    { id: 'o_pr1', name: 'طابعة هانيويل باركود حرارية', price: 10500, category: 'أخرى', image: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
    { id: 'o_pr2', name: 'طابعة اكس برانتر حرارية', price: 6250, category: 'أخرى', image: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png' },
    { id: 'o_prot', name: 'ورق حماية رول ابيض (40 سم × 100 متر)', price: 120, category: 'أخرى', image: 'https://cdn-icons-png.flaticon.com/512/3014/3014605.png' },
    { id: 'o_hc1', name: 'رول هوني كومب 50سم × 100م', price: 450, category: 'أخرى', image: 'https://cdn-icons-png.flaticon.com/512/3014/3014605.png' },
    { id: 'o_hc2', name: 'رول هوني كومب 50سم × 50م', price: 240, category: 'أخرى', image: 'https://cdn-icons-png.flaticon.com/512/3014/3014605.png' },
  ];

  const PACKAGING_PRODUCTS = BASE_PACKAGING_PRODUCTS.map(p => ({
    ...p,
    price: settings?.data?.bostaPackagingPrices?.[p.id] ?? p.price
  }));

  const PACKAGING_SHIPPING_FEE = settings?.data?.bostaPackagingShippingFee !== undefined ? settings.data.bostaPackagingShippingFee : 55;

  const savePackagingPrices = () => {
    if (setSettings) {
      setSettings((prev: any) => ({
        ...prev,
        data: {
          ...(prev.data || {}),
          bostaPackagingPrices: tempPackagingPrices,
          bostaPackagingShippingFee: tempPackagingShippingFee
        }
      }));
    }
    setIsEditingPackagingPrices(false);
  };

  const startEditingPrices = () => {
    const initialTemp: Record<string, number> = {};
    PACKAGING_PRODUCTS.forEach(p => {
      initialTemp[p.id] = p.price;
    });
    setTempPackagingPrices(initialTemp);
    setTempPackagingShippingFee(PACKAGING_SHIPPING_FEE);
    setIsEditingPackagingPrices(true);
  };

  const handlePackagingCartUpdate = (id: string, delta: number) => {
    setPackagingCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const calculatePackagingTotal = () => {
    return Object.entries(packagingCart).reduce((sum, [id, qty]) => {
      const product = PACKAGING_PRODUCTS.find(p => p.id === id);
      return sum + (product?.price || 0) * qty;
    }, 0);
  };

  const handleConfirmPackagingPurchase = () => {
    const total = calculatePackagingTotal() + PACKAGING_SHIPPING_FEE;
    
    if (total === PACKAGING_SHIPPING_FEE) {
      alert('يرجى إضافة منتجات للسلة');
      return;
    }
    
    if (!selectedPackagingPaymentId && (packagingPaymentType === 'treasury' || packagingPaymentType === 'partner')) {
      alert('يرجى اختيار جهة الدفع');
      return;
    }

    setIsPackagingProcessing(true);
    
    // Simulate API call and state update
    setTimeout(() => {
      const itemsDetail = Object.entries(packagingCart).map(([id, qty]) => {
        const p = PACKAGING_PRODUCTS.find(prod => prod.id === id);
        return {
          id,
          name: p?.name,
          quantity: qty,
          price: p?.price
        };
      });

      const itemsDisplay = itemsDetail.map(i => `${i.name} (${i.quantity})`).join(' + ');

      const txId = `pkg-${packagingPaymentType === 'wallet' ? 'w-' : packagingPaymentType === 'partner' ? 'p-' : ''}${Date.now()}`;
      
      const orderData = {
        id: `B-${Math.floor(Math.random() * 90000) + 10000}`,
        date: new Date().toISOString(),
        items: itemsDetail,
        shippingFee: PACKAGING_SHIPPING_FEE,
        total: total,
        paymentMethod: packagingPaymentType,
        paymentId: selectedPackagingPaymentId,
        transactionId: txId
      };

      let paymentSourceName = '';

      if (packagingPaymentType === 'treasury' && setTreasury) {
        const treasuryAccounts = treasury?.accounts || [];
        const account = treasuryAccounts.find(a => a.id === selectedPackagingPaymentId);
        
        if (account && account.balance < total) {
          alert('الرصيد في الخزينة المختارة غير كافٍ');
          setIsPackagingProcessing(false);
          return;
        }
        paymentSourceName = account?.name || 'الخزينة';

        const newTx = {
          id: txId,
          date: new Date().toISOString(),
          type: 'withdrawal' as const,
          amount: total,
          description: `شراء مواد تغليف بوسطة: ${itemsDisplay}`,
          fromAccountId: selectedPackagingPaymentId,
        };

        setTreasury((prev: any) => ({
          ...prev,
          accounts: prev.accounts.map((a: any) => a.id === selectedPackagingPaymentId ? { ...a, balance: a.balance - total } : a),
          transactions: [newTx, ...prev.transactions]
        }));

        // Mirror in wallet for expenses tracking
        if (setWallet) {
          setWallet((prev: any) => ({
            ...prev,
            transactions: [{
              id: txId,
              date: new Date().toISOString(),
              type: 'سحب',
              amount: total,
              note: `شراء مواد تغليف بوسطة (خزينة: ${paymentSourceName}): ${itemsDisplay}`,
              category: 'expense_packaging',
              status: 'completed',
              details: { treasuryAccountId: selectedPackagingPaymentId }
            }, ...prev.transactions]
          }));
        }
      } else if (packagingPaymentType === 'wallet' && setWallet) {
          if (walletStats.liveBalance < total) {
              alert('الرصيد في المحفظة غير كافٍ');
              setIsPackagingProcessing(false);
              return;
          }
          paymentSourceName = 'محفظة الشحن';
          setWallet((prev: any) => ({
              ...prev,
              balance: prev.balance - total,
              transactions: [{
                  id: txId,
                  date: new Date().toISOString(),
                  type: 'سحب',
                  amount: total,
                  note: `شراء مواد تغليف بوسطة: ${itemsDisplay}`,
                  category: 'expense_packaging',
                  status: 'completed'
              }, ...prev.transactions]
          }));
      } else if (packagingPaymentType === 'partner' && setSettings && settings) {
          const partner = settings.partners?.find((p: any) => p.id === selectedPackagingPaymentId);
          if (!partner) {
               alert('لم يتم العثور على الشريك');
               setIsPackagingProcessing(false);
               return;
          }
          paymentSourceName = `حساب الشريك: ${partner.name}`;

          const newPartnerTx = {
              id: txId,
              partnerId: selectedPackagingPaymentId,
              type: 'supply_funding',
              amount: total,
              date: new Date().toISOString(),
              note: `شراء مواد تغليف بوسطة: ${itemsDisplay}`
          };

          setSettings((prev: any) => ({
              ...prev,
              partners: prev.partners.map((p: any) => p.id === selectedPackagingPaymentId ? { ...p, balance: (p.balance || 0) + total } : p),
              partnerTransactions: [newPartnerTx, ...(prev.partnerTransactions || [])]
          }));

          // Mirror in wallet for expenses tracking
          if (setWallet) {
            setWallet((prev: any) => ({
              ...prev,
              transactions: [{
                id: txId,
                date: new Date().toISOString(),
                type: 'سحب',
                amount: total,
                note: `شراء مواد تغليف بوسطة (بواسطة ${partner.name}): ${itemsDisplay}`,
                category: 'expense_packaging',
                status: 'completed',
                details: { paidByPartnerId: selectedPackagingPaymentId }
              }, ...prev.transactions]
            }));
          }
      }

      // Record in history
      if (setSettings) {
        setSettings((prev: any) => ({
          ...prev,
          data: {
            ...(prev.data || {}),
            packagingOrders: [orderData, ...(prev.data?.packagingOrders || [])]
          }
        }));
      }

      // Reset cart and state
      setPackagingCart({});
      setShowPackagingCheckout(false);
      setIsPackagingProcessing(false);
      alert(`تم تنفيذ الشراء بنجاح! رقم الطلب: ${orderData.id}`);
    }, 800);
  };

  const handleDeletePackagingOrder = (order: any) => {
    setOrderToDelete(order);
  };

  const confirmDeletePackagingOrder = () => {
    if (!orderToDelete) return;
    const order = orderToDelete;

    // 1. Revert payment
    if (order.paymentMethod === 'wallet' && setWallet) {
      setWallet((prev: any) => ({
        ...prev,
        balance: prev.balance + order.total,
        transactions: prev.transactions.filter((t: any) => t.id !== order.transactionId)
      }));
    } else if (order.paymentMethod === 'treasury' && setTreasury) {
      setTreasury((prev: any) => ({
        ...prev,
        accounts: prev.accounts.map((a: any) => a.id === order.paymentId ? { ...a, balance: a.balance + order.total } : a),
        transactions: prev.transactions.filter((t: any) => t.id !== order.transactionId)
      }));
      // Clean up mirrored wallet transaction
      if (setWallet) {
        setWallet((prev: any) => ({
          ...prev,
          transactions: prev.transactions.filter((t: any) => t.id !== order.transactionId)
        }));
      }
    } else if (order.paymentMethod === 'partner' && setSettings) {
      setSettings((prev: any) => ({
        ...prev,
        partners: prev.partners.map((p: any) => p.id === order.paymentId ? { ...p, balance: (p.balance || 0) - order.total } : p),
        partnerTransactions: (prev.partnerTransactions || []).filter((t: any) => t.id !== order.transactionId)
      }));
      // Clean up mirrored wallet transaction
      if (setWallet) {
        setWallet((prev: any) => ({
          ...prev,
          transactions: prev.transactions.filter((t: any) => t.id !== order.transactionId)
        }));
      }
    }

    // 2. Remove from history
    if (setSettings) {
      setSettings((prev: any) => ({
        ...prev,
        data: {
          ...prev.data,
          packagingOrders: (prev.data.packagingOrders || []).filter((o: any) => o.id !== order.id)
        }
      }));
    }
    
    setOrderToDelete(null);
    alert('تم حذف الطلب واستعادة المبلغ بنجاح');
  };

  // Cashout repeating system states
  const [cashoutSchedule, setCashoutSchedule] = useState<'weekly' | 'daily' | 'biweekly'>('weekly');
  const [cashoutDay, setCashoutDay] = useState<string>('الاثنين');
  const [bankInfo, setBankInfo] = useState({ bankName: 'البنك الأهلي المصري', accountNumber: 'EG12000300054002340050100', nameOnCard: 'الشركة العالمية للتجارة الذكية' });
  const [showCashoutModal, setShowCashoutModal] = useState<boolean>(false);

  // Calculator states
  const [calcRegion, setCalcRegion] = useState<string>('القاهرة والجيزة');
  const [calcSize, setCalcSize] = useState<string>('فلاير (حجم صغير ومتوسط)');
  const [calcAction, setCalcAction] = useState<'delivery' | 'exchange' | 'returns' | 'cashCollection' | 'returnToYou'>('delivery');
  const [calcCodValue, setCalcCodValue] = useState<number>(1500);

  // Modals
  const [showHowItCalculatedModal, setShowHowItCalculatedModal] = useState<boolean>(false);

  // Real Bosta API states
  const [apiSettings, setApiSettings] = useState({
    bostaApiKey: settings?.bostaConfig?.apiKey || '',
    businessId: settings?.bostaConfig?.businessId || '',
    environment: settings?.bostaConfig?.environment || 'production',
    isActive: settings?.bostaConfig?.isActive ?? false,
    pickupFirstLine: settings?.bostaConfig?.pickupAddress?.firstLine || settings?.storeAddress || '',
    pickupCity: settings?.bostaConfig?.pickupAddress?.city || 'Cairo',
    pickupContactName: settings?.bostaConfig?.pickupAddress?.contactPersonName || settings?.storeName || '',
    pickupContactPhone: settings?.bostaConfig?.pickupAddress?.contactPersonPhone || settings?.storePhone || '',
    defaultPackageType: settings?.bostaConfig?.defaultPackageType || 'Parcel',
    defaultPackageSize: settings?.bostaConfig?.defaultPackageSize || 'SMALL',
    defaultBusinessLocationId: settings?.bostaConfig?.defaultBusinessLocationId || '',
    defaultReturnLocationId: settings?.bostaConfig?.defaultReturnLocationId || '',
    allowToOpenPackage: settings?.bostaConfig?.allowToOpenPackage ?? true,
    autoSendOnConfirm: settings?.bostaConfig?.autoSendOnConfirm ?? false,
    autoSendWhatsAppTracking: settings?.bostaConfig?.autoSendWhatsAppTracking ?? true,
    whatsappTrackingMessageTemplate: settings?.bostaConfig?.whatsappTrackingMessageTemplate || '',
    autoSendWhatsAppOnStatusChange: settings?.bostaConfig?.autoSendWhatsAppOnStatusChange ?? true,
    whatsappStatusMessageTemplate: settings?.bostaConfig?.whatsappStatusMessageTemplate || '',
    webhookUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/bosta` : '/api/webhooks/bosta'
  });
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [businessLocations, setBusinessLocations] = useState<any[]>(() => {
    if (settings?.bostaConfig?.businessLocations && settings.bostaConfig.businessLocations.length > 0) {
      return settings.bostaConfig.businessLocations;
    }
    return DEFAULT_BOSTA_BUSINESS_LOCATIONS;
  });
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Modal State for Locations
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [editingLocIndex, setEditingLocIndex] = useState<number | null>(null);
  const [locFormName, setLocFormName] = useState<string>('');
  const [locFormContactName, setLocFormContactName] = useState<string>('');
  const [locFormContactPhone, setLocFormContactPhone] = useState<string>('');
  const [locFormCity, setLocFormCity] = useState<string>('كفر الشيخ - بلطيم');
  const [locFormAddress, setLocFormAddress] = useState<string>('بلطيم');
  const [locFormIsDefault, setLocFormIsDefault] = useState<boolean>(false);
  const [locationSearch, setLocationSearch] = useState<string>('');

  const saveLocationsList = (newList: any[]) => {
    setBusinessLocations(newList);
    if (setSettings) {
      setSettings((prev: any) => ({
        ...prev,
        bostaConfig: {
          ...(prev?.bostaConfig || {}),
          businessLocations: newList
        }
      }));
    }
  };

  useEffect(() => {
    if (apiSettings.bostaApiKey && apiSettings.isActive) {
      fetchBusinessLocations(apiSettings.bostaApiKey, apiSettings.environment === 'staging');
    }
  }, [apiSettings.bostaApiKey, apiSettings.isActive, apiSettings.environment]);

  const fetchBusinessLocations = async (key: string, isStaging: boolean) => {
    try {
      setIsLoadingLocations(true);
      const res = await bostaService.getBusinessLocations(key, isStaging);
      if (res && res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
        setBusinessLocations(res.data);
      } else if (!settings?.bostaConfig?.businessLocations || settings.bostaConfig.businessLocations.length === 0) {
        setBusinessLocations(DEFAULT_BOSTA_BUSINESS_LOCATIONS);
      }
    } catch (e) {
      console.error("Failed to load business locations", e);
    } finally {
      setIsLoadingLocations(false);
    }
  };
  const [isEditingApi, setIsEditingApi] = useState<boolean>(!settings?.bostaConfig?.apiKey);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<{ success: boolean; message: string; user?: any } | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState<boolean>(false);
  const [bostaCities, setBostaCities] = useState<Array<{ _id: string; name: string; nameAr: string }>>([]);

  // Fetch official live Bosta cities on load
  useEffect(() => {
    bostaService.getCities().then(res => {
      if (res.success && res.list && res.list.length > 0) {
        setBostaCities(res.list);
      }
    }).catch(() => {});
  }, []);

  // Connection Method: API Key vs Direct Account Login (Official Bosta Docs)
  const [authMethod, setAuthMethod] = useState<'apikey' | 'directLogin'>('apikey');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Clean Reset & Disconnect Handler
  const handleResetAndDisconnect = async () => {
    try {
      await bostaService.disconnect();
    } catch {
      // Ignore network errors on disconnect
    }

    const resetConfig: BostaConfig = {
      apiKey: '',
      businessId: '',
      isActive: false,
      environment: 'production',
      connectedUserName: '',
      connectedUserEmail: '',
      connectedUserPhone: '',
      pickupAddress: {
        firstLine: settings?.storeAddress || '',
        city: 'Cairo',
        contactPersonName: settings?.storeName || '',
        contactPersonPhone: settings?.storePhone || ''
      },
      defaultPackageType: 'Parcel',
      defaultPackageSize: 'SMALL',
      defaultBusinessLocationId: '',
      defaultReturnLocationId: '',
      allowToOpenPackage: true,
      autoSendOnConfirm: false
    };

    if (setSettings) {
      setSettings((prev: any) => ({
        ...prev,
        bostaConfig: resetConfig,
        shippingIntegrations: (prev.shippingIntegrations || []).filter((i: any) => i.provider !== 'bosta')
      }));
    }

    setApiSettings({
      bostaApiKey: '',
      businessId: '',
      environment: 'production',
      isActive: false,
      pickupFirstLine: settings?.storeAddress || '',
      pickupCity: 'Cairo',
      pickupContactName: settings?.storeName || '',
      pickupContactPhone: settings?.storePhone || '',
      defaultPackageType: 'Parcel',
      defaultPackageSize: 'SMALL',
      defaultBusinessLocationId: '',
      defaultReturnLocationId: '',
      allowToOpenPackage: true,
      autoSendOnConfirm: false,
      autoSendWhatsAppTracking: true,
      whatsappTrackingMessageTemplate: '',
      autoSendWhatsAppOnStatusChange: true,
      whatsappStatusMessageTemplate: '',
      webhookUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/bosta` : '/api/webhooks/bosta'
    });

    setLoginEmail('');
    setLoginPassword('');
    setVerifyStatus(null);
    setIsEditingApi(true);
    setShowDisconnectModal(false);
    inAppToast('تم حذف وإلغاء بيانات الربط القديمة بنجاح! يمكنك الآن ربط الحساب من جديد.', 'success');
  };

  // Webhook Simulator States
  const [simTrackingNumber, setSimTrackingNumber] = useState<string>('');
  const [simStateCode, setSimStateCode] = useState<number>(45);
  const [simStateValue, setSimStateValue] = useState<string>('Delivered');
  const [simReason, setSimReason] = useState<string>('تم تسليم الشحنة للعميل وتحصيل المبلغ بنجاح');
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState<boolean>(false);
  const [simLog, setSimLog] = useState<{ time: string; text: string; success: boolean }[]>([]);

  // Webhook Simulation Handler
  const handleSimulateWebhookEvent = async (overrideStateCode?: number, overrideStateValue?: string, overrideReason?: string) => {
    const code = overrideStateCode !== undefined ? overrideStateCode : simStateCode;
    const val = overrideStateValue || simStateValue;
    const reason = overrideReason || simReason;
    const tracking = simTrackingNumber.trim() || (orders.find(o => o.waybillNumber || o.bostaTrackingNumber)?.waybillNumber || '12345678');

    setIsSimulatingWebhook(true);
    try {
      const res = await bostaService.simulateWebhook({
        trackingNumber: tracking,
        stateCode: code,
        stateValue: val,
        reason: reason
      });

      const now = new Date().toLocaleTimeString('ar-EG');
      if (res.success) {
        setSimLog(prev => [
          {
            time: now,
            text: `[نجاح] تم استقبال حدث بوسطة: ${val} (كود ${code}) لشحنة #${tracking} -> تحولت الحالة تلقائياً إلى: ${res.mappedStatus}`,
            success: true
          },
          ...prev.slice(0, 9)
        ]);
        inAppToast(`تمت محاكاة تحديث بوسطة بنجاح! الحالة: ${res.mappedStatus} (${val})`, 'success');
      } else {
        setSimLog(prev => [
          {
            time: now,
            text: `[فشل] خطأ في محاكاة الـ Webhook: ${res.error}`,
            success: false
          },
          ...prev.slice(0, 9)
        ]);
        inAppToast(`فشل المحاكاة: ${res.error}`, 'error');
      }
    } catch (err: any) {
      inAppToast(`خطأ: ${err.message}`, 'error');
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  // Pickups and Tracking Modals
  const [showPickupModal, setShowPickupModal] = useState<boolean>(false);
  const [showTrackingModal, setShowTrackingModal] = useState<boolean>(false);
  const [activeTrackingNumber, setActiveTrackingNumber] = useState<string>('');
  const [trackingSearchInput, setTrackingSearchInput] = useState<string>('');
  const [quickTrackLoading, setQuickTrackLoading] = useState<boolean>(false);
  const [quickTrackResult, setQuickTrackResult] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleVerifyAndSave = async () => {
    const rawKey = apiSettings.bostaApiKey.trim().replace(/^["']|["']$/g, '');
    if (!rawKey) {
      inAppAlert('يرجى كتابة أو لصق مفتاح الـ API الخاص ببوسطة أولاً', { title: 'مفتاح الربط مطلوب', type: 'warning' });
      return;
    }

    setIsVerifying(true);
    setVerifyStatus(null);
    try {
      const res = await bostaService.verifyConnection(rawKey, apiSettings.environment as any);
      if (res.success) {
        const userInfo = res.user;
        const resolvedEnv = res.detectedEnvironment || apiSettings.environment || 'production';
        const finalKey = res.resolvedApiKey || rawKey;
        const updatedConfig: BostaConfig = {
          apiKey: finalKey,
          businessId: userInfo?.business?.id || apiSettings.businessId,
          environment: resolvedEnv,
          isActive: true,
          connectedUserName: userInfo?.name,
          connectedUserEmail: userInfo?.email,
          connectedUserPhone: userInfo?.phone,
          lastSync: new Date().toISOString(),
          pickupAddress: {
            firstLine: apiSettings.pickupFirstLine,
            city: apiSettings.pickupCity,
            contactPersonName: apiSettings.pickupContactName,
            contactPersonPhone: apiSettings.pickupContactPhone
          },
          defaultPackageType: apiSettings.defaultPackageType as any,
          defaultPackageSize: apiSettings.defaultPackageSize as any,
          defaultBusinessLocationId: apiSettings.defaultBusinessLocationId,
          defaultReturnLocationId: apiSettings.defaultReturnLocationId,
          allowToOpenPackage: apiSettings.allowToOpenPackage,
          autoSendOnConfirm: apiSettings.autoSendOnConfirm,
          autoSendWhatsAppTracking: apiSettings.autoSendWhatsAppTracking,
          whatsappTrackingMessageTemplate: apiSettings.whatsappTrackingMessageTemplate,
          autoSendWhatsAppOnStatusChange: apiSettings.autoSendWhatsAppOnStatusChange,
          whatsappStatusMessageTemplate: apiSettings.whatsappStatusMessageTemplate,
          webhookUrl: apiSettings.webhookUrl
        };

        if (setSettings) {
          setSettings((prev: any) => ({
            ...prev,
            bostaConfig: updatedConfig,
            shippingIntegrations: [
              ...(prev.shippingIntegrations || []).filter((i: any) => i.provider !== 'bosta'),
              {
                id: 'bosta_main',
                provider: 'bosta',
                apiKey: finalKey,
                isConnected: true
              }
            ]
          }));
        }

        setApiSettings(prev => ({
          ...prev,
          bostaApiKey: finalKey,
          environment: resolvedEnv,
          isActive: true,
          businessId: userInfo?.business?.id || prev.businessId
        }));

        setVerifyStatus({
          success: true,
          message: `تم التحقق بنجاح! حساب بوسطة (${resolvedEnv === 'staging' ? 'بيئة تجريبية Sandbox' : 'حساب فعلي Production'}) نشط باسم: ${userInfo?.name || userInfo?.email || 'المتجر'}`,
          user: userInfo
        });
        setIsEditingApi(false);
      } else {
        setVerifyStatus({
          success: false,
          message: res.error || 'مفتاح الربط غير صالح أو تم رفض الاتصال من بوسطة (Invalid authorization token or API key)'
        });
      }
    } catch (err: any) {
      setVerifyStatus({
        success: false,
        message: err.message || 'حدث خطأ في الاتصال بالخادم'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDirectSaveWithoutVerify = () => {
    const rawKey = apiSettings.bostaApiKey.trim().replace(/^["']+|["']+$/g, '');
    if (!rawKey) {
      inAppAlert('يرجى كتابة أو لصق مفتاح الـ API الخاص ببوسطة أولاً', { title: 'مفتاح الربط مطلوب', type: 'warning' });
      return;
    }
    const bareKey = rawKey.replace(/^bearer\s+/i, '').trim();
    const resolvedEnv = apiSettings.environment || 'production';
    const updatedConfig: BostaConfig = {
      apiKey: bareKey,
      businessId: apiSettings.businessId,
      environment: resolvedEnv as any,
      isActive: true,
      connectedUserName: 'حساب مفتاح API مخصص',
      connectedUserEmail: '',
      connectedUserPhone: '',
      lastSync: new Date().toISOString(),
      pickupAddress: {
        firstLine: apiSettings.pickupFirstLine,
        city: apiSettings.pickupCity,
        contactPersonName: apiSettings.pickupContactName,
        contactPersonPhone: apiSettings.pickupContactPhone
      },
      defaultPackageType: apiSettings.defaultPackageType as any,
      defaultPackageSize: apiSettings.defaultPackageSize as any,
      allowToOpenPackage: apiSettings.allowToOpenPackage,
      autoSendOnConfirm: apiSettings.autoSendOnConfirm,
      autoSendWhatsAppTracking: apiSettings.autoSendWhatsAppTracking,
      whatsappTrackingMessageTemplate: apiSettings.whatsappTrackingMessageTemplate,
      autoSendWhatsAppOnStatusChange: apiSettings.autoSendWhatsAppOnStatusChange,
      whatsappStatusMessageTemplate: apiSettings.whatsappStatusMessageTemplate,
      webhookUrl: apiSettings.webhookUrl
    };

    if (setSettings) {
      setSettings((prev: any) => ({
        ...prev,
        bostaConfig: updatedConfig,
        shippingIntegrations: [
          ...(prev.shippingIntegrations || []).filter((i: any) => i.provider !== 'bosta'),
          {
            id: 'bosta_main',
            provider: 'bosta',
            apiKey: bareKey,
            isConnected: true
          }
        ]
      }));
    }

    setApiSettings(prev => ({
      ...prev,
      bostaApiKey: bareKey,
      environment: resolvedEnv,
      isActive: true
    }));

    setVerifyStatus({
      success: true,
      message: `تم حفظ مفتاح الربط وتفعيل حساب بوسطة بنجاح (${resolvedEnv === 'staging' ? 'بيئة تجريبية Staging' : 'حساب فعلي Live'})! المفتاح نشط ومفعل الآن للأوردرات وطباعة البوالص.`,
    });
    setIsEditingApi(false);
    inAppToast('تم حفظ وتفعيل مفتاح بوسطة بنجاح!', 'success');
  };

  const handleDirectLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      inAppAlert('يرجى إدخال البريد الإلكتروني وكلمة المرور لحساب بوسطة', { title: 'بيانات غير مكتملة', type: 'warning' });
      return;
    }
    setIsLoggingIn(true);
    setVerifyStatus(null);
    try {
      const res = await bostaService.loginWithCredentials(loginEmail, loginPassword, apiSettings.environment as any);
      if (res.success && res.token) {
        const userInfo = res.user;
        const resolvedEnv = res.detectedEnvironment || apiSettings.environment || 'production';
        const acquiredToken = res.token;
        const updatedConfig: BostaConfig = {
          apiKey: acquiredToken,
          businessId: userInfo?.business?.id || apiSettings.businessId,
          environment: resolvedEnv,
          isActive: true,
          connectedUserName: userInfo?.name,
          connectedUserEmail: userInfo?.email || loginEmail.trim(),
          connectedUserPhone: userInfo?.phone,
          lastSync: new Date().toISOString(),
          pickupAddress: {
            firstLine: apiSettings.pickupFirstLine,
            city: apiSettings.pickupCity,
            contactPersonName: apiSettings.pickupContactName,
            contactPersonPhone: apiSettings.pickupContactPhone
          },
          defaultPackageType: apiSettings.defaultPackageType as any,
          defaultPackageSize: apiSettings.defaultPackageSize as any,
          allowToOpenPackage: apiSettings.allowToOpenPackage,
          autoSendOnConfirm: apiSettings.autoSendOnConfirm,
          autoSendWhatsAppTracking: apiSettings.autoSendWhatsAppTracking,
          whatsappTrackingMessageTemplate: apiSettings.whatsappTrackingMessageTemplate,
          autoSendWhatsAppOnStatusChange: apiSettings.autoSendWhatsAppOnStatusChange,
          whatsappStatusMessageTemplate: apiSettings.whatsappStatusMessageTemplate,
          webhookUrl: apiSettings.webhookUrl
        };

        if (setSettings) {
          setSettings((prev: any) => ({
            ...prev,
            bostaConfig: updatedConfig,
            shippingIntegrations: [
              ...(prev.shippingIntegrations || []).filter((i: any) => i.provider !== 'bosta'),
              {
                id: 'bosta_main',
                provider: 'bosta',
                apiKey: acquiredToken,
                isConnected: true
              }
            ]
          }));
        }

        setApiSettings(prev => ({
          ...prev,
          bostaApiKey: acquiredToken,
          environment: resolvedEnv,
          isActive: true,
          businessId: userInfo?.business?.id || prev.businessId
        }));

        setVerifyStatus({
          success: true,
          message: `تم تسجيل الدخول والربط بنجاح! تم التحقق من حساب بوسطة باسم: ${userInfo?.name || userInfo?.email || 'المتجر'}`,
          user: userInfo
        });
        setIsEditingApi(false);
      } else {
        setVerifyStatus({
          success: false,
          message: res.error || 'فشل تسجيل الدخول في حساب بوسطة. يرجى التأكد من صحة البريد الإلكتروني وكلمة المرور.'
        });
      }
    } catch (err: any) {
      setVerifyStatus({
        success: false,
        message: err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول'
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickTrackShipment = async () => {
    if (!trackingSearchInput.trim()) return;
    setQuickTrackLoading(true);
    setQuickTrackResult(null);
    try {
      const res = await bostaService.trackShipment(trackingSearchInput.trim(), apiSettings.bostaApiKey);
      if (res.success && res.tracking) {
        setQuickTrackResult(res.tracking);
      } else {
        alert(res.error || 'تعذر العثور على شحنة بهذا الرقم في بوسطة');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في تتبع الشحنة');
    } finally {
      setQuickTrackLoading(false);
    }
  };

  const handlePrintAwbDirect = async (trackingOrId: string) => {
    try {
      const res = await bostaService.getAwb(trackingOrId, apiSettings.bostaApiKey);
      if (res.success && res.data) {
        const cleanBase64 = res.data.startsWith('data:application/pdf;base64,')
          ? res.data.replace('data:application/pdf;base64,', '')
          : res.data;
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        printPdfBlob(blobUrl, `bosta-awb-${trackingOrId}.pdf`);
      } else {
        alert(res.error || 'فشل تحميل بوليصة الشحن من بوسطة');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في طباعة البوليصة');
    }
  };

  // Filtered Hubs based on search
  const filteredHubs = useMemo(() => {
    if (!pickupSearch) return BOSTA_HUBS;
    return BOSTA_HUBS.filter(h => h.toLowerCase().includes(pickupSearch.toLowerCase()));
  }, [pickupSearch]);

  const rawRatesList = BOSTA_PRICING[activeRegion] || {};

  // Calculator logic
  const calculatedResult = useMemo(() => {
    const regionRates = BOSTA_PRICING[calcRegion];
    if (!regionRates) return { base: 0, vat: 0, codFee: 0, total: 0 };
    const sizeRates = regionRates[calcSize];
    if (!sizeRates) return { base: 0, vat: 0, codFee: 0, total: 0 };

    const baseCost = sizeRates[calcAction] || 0;
    
    // VAT 14%
    const vatAmount = showVat ? Math.round(baseCost * 0.14 * 100) / 100 : 0;
    
    // 1% COD handling fee on portion above 3000 EGP
    let codFee = 0;
    if (calcAction === 'delivery' || calcAction === 'cashCollection') {
      if (calcCodValue > 3000) {
        codFee = Math.round((calcCodValue - 3000) * 0.01 * 100) / 100;
      }
    }

    const grandTotal = Math.round((baseCost + vatAmount + codFee) * 100) / 100;

    return {
      base: baseCost,
      vat: vatAmount,
      codFee: codFee,
      total: grandTotal
    };

  }, [calcRegion, calcSize, calcAction, calcCodValue, showVat]);

  const handleTriggerSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert('تم مزامنة محاكاة الأسعار وحالات التوصيل مع شركة بوسطة بنجاح!');
    }, 1200);
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Upper Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg"><Truck size={20} /></span>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white">نظام بوسطة في الشحن (Bosta Portal)</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold leading-relaxed">
              إدارة بوابة التسعير والتحصيل الرسمية من بوسطة، مع حاسبة الدفع التلقائي 14% وضريبة القيمة المضافة.
            </p>
          </div>
        </div>

        <div className="flex bg-slate-200/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit flex-wrap gap-1">
          <button 
            onClick={() => setActivePortalTab('locations')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'locations' ? 'bg-emerald-600 text-white shadow font-black' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800'}`}
          >
            <MapPin size={14} /> أماكن الشركة ({businessLocations.length})
          </button>
          <button 
            onClick={() => setActivePortalTab('calculator')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'calculator' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Calculator size={14} /> خطة ومحاكاة الأسعار
          </button>
          <button 
            onClick={() => setActivePortalTab('packaging')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'packaging' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Package size={14} /> متجر التغليف (Shop)
          </button>
          <button 
            onClick={() => setActivePortalTab('api-integration')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'api-integration' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Sparkles size={14} /> الربط الإلكتروني المباشر (API)
          </button>
          <button 
            onClick={() => setActivePortalTab('pickups')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'pickups' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Calendar size={14} /> أذونات الاستلام (Pickups)
          </button>
          <button 
            onClick={() => setActivePortalTab('tracking')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'tracking' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Truck size={14} /> تتبع الشحنات المباشر
          </button>
        </div>
      </div>

      {activePortalTab === 'locations' ? (
        <div className="space-y-6">
          {/* Header & Controls Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <MapPin className="text-emerald-600 dark:text-emerald-400" size={22} /> أماكن الشركة
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                الأماكن التي سنقوم باستلام الاوردات منها وإرجاعها لك.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (apiSettings.bostaApiKey) {
                    fetchBusinessLocations(apiSettings.bostaApiKey, apiSettings.environment === 'staging');
                    inAppToast("جاري تحديث قائمة الفروع والأماكن من بوسطة...", 'success');
                  } else {
                    inAppAlert("مفتاح API غير متوفر، يعرض النظام حالياً أماكن الشركة المسجلة محلياً.", { title: "ملاحظة" });
                  }
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={isLoadingLocations ? "animate-spin text-indigo-500" : ""} />
                مزامنة الفروع
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingLocIndex(null);
                  setLocFormName('');
                  setLocFormContactName('');
                  setLocFormContactPhone('');
                  setLocFormCity('كفر الشيخ - بلطيم');
                  setLocFormAddress('بلطيم');
                  setLocFormIsDefault(false);
                  setShowLocationModal(true);
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow transition flex items-center gap-1.5"
              >
                <Plus size={16} /> إضافة مكان جديد
              </button>
            </div>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="ابحث عن مكان، جهة اتصال، أو رقم هاتف..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Table displaying Locations matching Bosta UI */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">اسم المكان</th>
                    <th className="p-4 text-center">البلد</th>
                    <th className="p-4">العنوان</th>
                    <th className="p-4">جهة اتصال</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {businessLocations
                    .filter(loc => {
                      if (!locationSearch) return true;
                      const query = locationSearch.toLowerCase();
                      const name = (loc.locationName || loc.name || '').toLowerCase();
                      const contact = (loc.contactPersonName || '').toLowerCase();
                      const phone = (loc.contactPersonPhone || '').toLowerCase();
                      const addr = (loc.firstLine || loc.city || '').toLowerCase();
                      return name.includes(query) || contact.includes(query) || phone.includes(query) || addr.includes(query);
                    })
                    .map((loc, idx) => {
                      const isDefault = loc.isDefault || apiSettings.defaultBusinessLocationId === (loc._id || loc.id) || idx === 0;
                      return (
                        <tr key={loc._id || loc.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="p-4">
                            <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                              {loc.locationName || loc.name}
                            </div>
                            {isDefault && (
                              <span className="mt-1 inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded text-[10px] font-black border border-emerald-200 dark:border-emerald-800">
                                أساسي (الاستلامات والإرجاع)
                              </span>
                            )}
                          </td>

                          <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                            🇪🇬 مصر
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {loc.city || 'كفر الشيخ'}
                            </div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              {loc.firstLine || 'بلطيم'}
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {loc.contactPersonName || 'غير محدد'}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500" dir="ltr">
                              {loc.contactPersonPhone || '-'}
                            </div>
                          </td>

                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isDefault && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = businessLocations.map((item, i) => ({
                                      ...item,
                                      isDefault: i === idx
                                    }));
                                    saveLocationsList(updated);
                                    setApiSettings(prev => ({ ...prev, defaultBusinessLocationId: loc._id || loc.id }));
                                    inAppToast(`تم تعيين "${loc.locationName || loc.name}" كمكان أساسي`, 'success');
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold transition"
                                >
                                  تعيين كأساسي
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLocIndex(idx);
                                  setLocFormName(loc.locationName || loc.name || '');
                                  setLocFormContactName(loc.contactPersonName || '');
                                  setLocFormContactPhone(loc.contactPersonPhone || '');
                                  setLocFormCity(loc.city || 'كفر الشيخ - بلطيم');
                                  setLocFormAddress(loc.firstLine || 'بلطيم');
                                  setLocFormIsDefault(!!isDefault);
                                  setShowLocationModal(true);
                                }}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 rounded-lg text-xs transition"
                                title="تعديل المكان"
                              >
                                <Settings size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (businessLocations.length <= 1) {
                                    inAppAlert("يجب الإبقاء على مكان استلام واحد على الأقل.", { title: "تنبيه" });
                                    return;
                                  }
                                  const updated = businessLocations.filter((_, i) => i !== idx);
                                  saveLocationsList(updated);
                                  inAppToast("تم حذف المكان بنجاح", 'success');
                                }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-lg text-xs transition"
                                title="حذف المكان"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activePortalTab === 'calculator' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column Settings & Calculator */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* VAT 14% Toggle Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">ضريبة القيمة المضافة 14%</h3>
                  <p className="text-[10px] text-slate-400">تطبيق أو إلغاء تطبيق الضريبة على تسعير الجدول</p>
                </div>
                <button 
                  onClick={() => setShowVat(!showVat)} 
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${showVat ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${showVat ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} />
                </button>
              </div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-normal bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                {showVat 
                  ? '● الأسعار المعروضة بالجدول والآلة الحاسبة تشمل القيمة المضافة 14%.' 
                  : '○ الأسعار معروضة خام وبدون حساب ضريبة القيمة المضافة 14%.'}
              </p>
            </div>

            {/* Cashout System Schedule Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-xl"><Calendar size={18} /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">تكرار السحب النقدي لبوسطة</h3>
                  <p className="text-[10px] text-amber-600 font-bold">تكرار تحويل الأرباح للمتجر</p>
                </div>
              </div>
              
              <div className="bg-amber-50/50 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/50 dark:border-amber-900/30 text-xs font-bold leading-normal text-slate-600 dark:text-slate-300 space-y-2">
                <p>سيتم تحويل قيمة السحب النقدي والمتحصلات إلى حسابك البنكي كل أسبوع في يوم <span className="text-indigo-600 font-black underline">{cashoutDay}</span>.</p>
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-amber-100 dark:border-slate-700 text-[10px] text-slate-500 space-y-0.5 font-mono">
                  <div>البنك: {bankInfo.bankName}</div>
                  <div>رقم الحساب: {bankInfo.accountNumber}</div>
                </div>
              </div>

              <button 
                onClick={() => setShowCashoutModal(true)} 
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow transition active:scale-95"
              >
                تغيير النظام وتحديث حساب البنك
              </button>
            </div>

            {/* calculator Helper Button */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-indigo-600" />
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">كيفية حساب السعر الإجمالي؟</span>
              </div>
              <button 
                onClick={() => setShowHowItCalculatedModal(true)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 transition"
              >
                التفاصيل
              </button>
            </div>

            {/* Interactive Shipping Cost Calculator */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 dark:from-slate-950 dark:to-slate-900 text-white p-5 rounded-2xl shadow-xl space-y-4 border border-indigo-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-300 rounded-xl border border-indigo-500/20"><Calculator size={18} /></div>
                <div>
                  <h3 className="text-sm font-black">حاسبة رسوم شحن بوسطة الذكية</h3>
                  <p className="text-[9px] text-indigo-300">محاكاة فورية لتسعير الشحن وعقد كشوف التحصيل</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {/* Region select in Calc */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-350 block">منطقة وجهة العميل:</label>
                  <select 
                    value={calcRegion} 
                    onChange={(e) => setCalcRegion(e.target.value)}
                    className="w-full p-2.5 bg-slate-800/80 border border-indigo-950 rounded-xl font-bold font-sans text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {Object.keys(BOSTA_PRICING).map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>

                {/* Size select in Calc */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-350 block">فئة حجم الشحنة:</label>
                  <select 
                    value={calcSize} 
                    onChange={(e) => setCalcSize(e.target.value)}
                    className="w-full p-2.5 bg-slate-800/80 border border-indigo-950 rounded-xl font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="فلاير (حجم صغير ومتوسط)">فلاير (حجم صغير ومتوسط)</option>
                    <option value="حجم كبير (L)">حجم كبير (L)</option>
                    <option value="حجم أكبر (XL)">حجم أكبر (XL)</option>
                    <option value="كيس أبيض (XXL)">كيس أبيض (XXL)</option>
                    <option value="شحنة كبيرة">شحنة كبيرة</option>
                    <option value="شحنة ضخمة">شحنة ضخمة</option>
                  </select>
                </div>

                {/* Action select in Calc */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-350 block">نوع العملية المطلوبة:</label>
                  <select 
                    value={calcAction} 
                    onChange={(e) => setCalcAction(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-800/80 border border-indigo-950 rounded-xl font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="delivery">توصيل اعتيادي (Forward)</option>
                    <option value="exchange">استبدال شحنة (Exchange)</option>
                    <option value="returns">إرجاع شحنة لمرجعك (Return)</option>
                    <option value="cashCollection">تحصيل نقدي فقط (Cash Out)</option>
                    <option value="returnToYou">إرجاع بدون تسليم (Bounce Back)</option>
                  </select>
                </div>

                {/* COD amount input */}
                {(calcAction === 'delivery' || calcAction === 'cashCollection') && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-350 block">مبلغ الدفع عند الاستلام (COD):</label>
                      <span className="text-[9px] text-amber-400 font-mono">* 1% رسوم تحصيل للزيادة فوق 3000 ج.م</span>
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={calcCodValue} 
                        onChange={(e) => setCalcCodValue(Number(e.target.value))}
                        className="w-full py-2.5 pr-3 pl-12 bg-slate-800/80 border border-indigo-950 rounded-xl font-bold text-white text-right outline-none focus:ring-1 focus:ring-indigo-500" 
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">ج.م</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Price calculation receipt results */}
              <div className="p-4 bg-indigo-950/70 border border-indigo-900 rounded-xl space-y-2 text-xs font-bold font-sans">
                <div className="flex justify-between border-b border-indigo-900 pb-1.5">
                  <span className="text-indigo-200">سعر الخدمة الأساسي:</span>
                  <span className="font-mono text-white">{calculatedResult.base} ج.م</span>
                </div>
                {showVat && (
                  <div className="flex justify-between">
                    <span className="text-indigo-300 text-[11px]">ضريبة القيمة المضافة (14%):</span>
                    <span className="font-mono text-white text-[11px] font-normal">+{calculatedResult.vat} ج.م</span>
                  </div>
                )}
                {calculatedResult.codFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-amber-300 text-[11px]">رسوم التحصيل الإضافية (1%):</span>
                    <span className="font-mono text-white text-[11px] font-normal">+{calculatedResult.codFee} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-indigo-900 text-sm font-black">
                  <span className="text-indigo-400">إجمالي تكلفة شحن بوسطة:</span>
                  <span className="text-emerald-400 font-mono">{calculatedResult.total} ج.م</span>
                </div>
              </div>
            </div>

            {/* Sizing description sheet */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 border-b pb-2 flex items-center gap-2">
                <Truck size={16} className="text-indigo-600" /> المقاسات والأوزان المسموحة
              </h3>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-bold">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1">
                  <div className="text-indigo-600 text-[11px] font-extrabold">صغير / متوسط</div>
                  <div className="text-slate-700 dark:text-slate-300">أبعاد: 40 × 35 سم</div>
                  <div className="text-slate-500 font-semibold">أقصى وزن: 5 كجم</div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1">
                  <div className="text-indigo-600 text-[11px] font-extrabold">كبير (L)</div>
                  <div className="text-slate-700 dark:text-slate-300">أبعاد: 50 × 45 سم</div>
                  <div className="text-slate-500 font-semibold">أقصى وزن: 10 كجم</div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1">
                  <div className="text-indigo-600 text-[11px] font-extrabold">أكبر (XL)</div>
                  <div className="text-slate-700 dark:text-slate-300">أبعاد: 55 × 60 سم</div>
                  <div className="text-slate-500 font-semibold">أقصى وزن: 15 كجم</div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1">
                  <div className="text-indigo-600 text-[11px] font-extrabold">كيس أبيض (XXL)</div>
                  <div className="text-slate-700 dark:text-slate-300">أبعاد: 100 × 50 سم</div>
                  <div className="text-slate-500 font-semibold">أقصى وزن: 20 كجم</div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1 col-span-2 flex justify-between items-center">
                  <div>
                    <span className="text-indigo-600 text-[11px] font-extrabold block">شحنات كبيرة وضخمة</span>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold text-[9px]">أطوال تزيد عن 100سم وأوزان ثقيلة تصل لـ 35كجم</span>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded font-black text-[9px]">مخصص</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column Pricing Matrix View */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Pickup warehouse search card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin size={16} className="text-indigo-600" /> مكان الاستلام للتحصيل من التبادل السريع:
              </label>
              
              <div className="relative">
                <button 
                  onClick={() => setIsHubDropdownOpen(!isHubDropdownOpen)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-sans text-sm text-slate-800 dark:text-white"
                >
                  <span className="truncate">{selectedHub}</span>
                  <ChevronDown size={16} className="text-slate-500" />
                </button>

                {isHubDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-64 overflow-y-auto space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="ابحث عن مكان استلام / مستودع بوسطة..." 
                        value={pickupSearch}
                        onChange={(e) => setPickupSearch(e.target.value)}
                        className="w-full pr-8 pl-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                    
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredHubs.map(hub => (
                        <button 
                          key={hub}
                          onClick={() => {
                            setSelectedHub(hub);
                            setIsHubDropdownOpen(false);
                            setPickupSearch('');
                          }}
                          className={`w-full text-right py-2 px-3 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg ${hub === selectedHub ? 'text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' : 'text-slate-600 dark:text-slate-400'}`}
                        >
                          {hub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bosta pricing table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-100 md:text-slate-850 dark:text-white flex items-center gap-2">
                    <Percent size={18} className="text-indigo-650" /> خطة أسعار بوسطة الشريكة
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">يتم ترقية أو تخفيض تكلفة خطتك وحسابها بناءً على الفئة الإقليمية المعلمة.</p>
                </div>
                
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-[10px] font-black tracking-tight uppercase flex items-center gap-1">
                  <Sparkles size={11} /> خطة الدرع الفضي النشطة
                </span>
              </div>

              {/* Tab selector for regions */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/40 overflow-x-auto">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-max md:w-full">
                  {Object.keys(BOSTA_PRICING).map(region => (
                    <button 
                      key={region}
                      onClick={() => setActiveRegion(region)}
                      className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${region === activeRegion ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-55 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold text-xs border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4 text-right">فئة حجم الشحنة</th>
                      <th className="p-4 text-center">توصيل</th>
                      <th className="p-4 text-center">تبديل</th>
                      <th className="p-4 text-center">إرجاع</th>
                      <th className="p-4 text-center border-l border-slate-200/50 dark:border-slate-800">تحصيل نقدي</th>
                      <th className="p-4 text-center">إرجاع لك</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-805 bg-white dark:bg-slate-900">
                    {Object.entries(rawRatesList).map(([size, rates]: [string, any]) => {

                      // Calculate display values depending on VAT toggle active or inactive
                      const applyVat = (val: number) => showVat ? Math.round(val * 1.14) : val;

                      return (
                        <tr key={size} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 text-right">
                            <span className="font-extrabold text-slate-800 dark:text-white text-xs block">{size}</span>
                            <span className="text-[9px] text-slate-450 block font-normal">
                              {(size === 'حجم صغير ومتوسط' || size === 'فلاير (حجم صغير ومتوسط)') && '40 × 35 سم | (إلى 5 كجم)'}
                              {size === 'حجم كبير (L)' && '50 × 45 سم | (إلى 10 كجم)'}
                              {size === 'حجم أكبر (XL)' && '55 × 60 سم | (إلى 15 كجم)'}
                              {size === 'كيس أبيض (XXL)' && '100 × 50 سم | (إلى 20 كجم)'}
                              {size === 'شحنة كبيرة' && 'أطوال متوسطة | (إلى 25 كجم)'}
                              {size === 'شحنة ضخمة' && 'أبعاد كبيرة | (إلى 35 كجم)'}
                            </span>
                          </td>
                          <td className="p-4 text-center text-xs font-black text-indigo-650 dark:text-indigo-400 font-mono transition-all">
                            {applyVat(rates.delivery)} <span className="text-[8px] font-normal font-sans">ج.م</span>
                          </td>
                          <td className="p-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                            {applyVat(rates.exchange)} <span className="text-[8px] font-normal font-sans">ج.م</span>
                          </td>
                          <td className="p-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                            {applyVat(rates.returns)} <span className="text-[8px] font-normal font-sans">ج.م</span>
                          </td>
                          <td className="p-4 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono border-l border-slate-200/50 dark:border-slate-800">
                            {applyVat(rates.cashCollection)} <span className="text-[8px] font-normal font-sans">ج.م</span>
                          </td>
                          <td className="p-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                            {applyVat(rates.returnToYou)} <span className="text-[8px] font-normal font-sans">ج.م</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>

          </div>

        </div>
      ) : activePortalTab === 'packaging' ? (
        /* Packaging Store (Shop) View */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><Package size={22} /></div>
                متجر أدوات التغليف بوسطة
              </h2>
              <p className="text-xs font-bold text-slate-500 mt-1">تزود بمواد التغليف الرسمية من بوسطة (فلايرات، كراتين، بابلز) لشحن أوردراتك باحترافية.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-2 px-4 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-emerald-600">
                  <Coins size={16} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">رصيد المحفظة</p>
                  <p className={`text-sm font-black tabular-nums ${walletStats.liveBalance === 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                    {walletStats.liveBalance.toLocaleString('ar-EG')} <span className="text-[10px] font-bold">ج.م</span>
                  </p>
                </div>
              </div>

              {!isEditingPackagingPrices && (
                <button 
                  onClick={() => setShowPackagingHistory(true)}
                  className="flex items-center gap-2 p-3 px-4 text-slate-600 hover:text-indigo-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition shadow-sm font-bold text-xs"
                >
                  <ListFilter size={18} />
                  سجل المشتريات
                </button>
              )}
              
              {isEditingPackagingPrices ? (
                <>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 px-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-[10px] font-black text-slate-400 uppercase">مصاريف الشحن</label>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number"
                        min="0"
                        value={tempPackagingShippingFee}
                        onChange={(e) => setTempPackagingShippingFee(Number(e.target.value))}
                        className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2 text-xs font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                        dir="ltr"
                      />
                      <span className="text-[10px] font-bold text-slate-500">ج.م</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsEditingPackagingPrices(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={savePackagingPrices}
                    className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    حفظ الأسعار
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={startEditingPrices}
                    className="p-3 px-4 text-slate-600 hover:text-indigo-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition shadow-sm group flex items-center gap-2"
                    title="تعديل الأسعار ومصاريف الشحن"
                  >
                    <Settings size={18} />
                    <span className="text-xs font-bold">تعديل الأسعار والشحن</span>
                  </button>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي السلة</p>
                    <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{calculatePackagingTotal()} <span className="text-xs">ج.م</span></p>
                  </div>
                  <button 
                    onClick={() => setShowPackagingCheckout(true)}
                    disabled={Object.keys(packagingCart).length === 0}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition active:scale-95 flex items-center gap-2"
                  >
                    <ShoppingCart size={18} />
                    تأكيد الشراء (اتمام)
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PACKAGING_PRODUCTS.map(product => (
              <div key={product.id} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-black text-slate-500 uppercase">{product.category}</span>
                </div>
                
                <div className="pt-4 flex flex-col items-center text-center space-y-4">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center p-4 ring-1 ring-slate-100 dark:ring-slate-800 group-hover:scale-110 transition-transform duration-500">
                    <img src={product.image} alt={product.name} className="w-full h-full object-contain filter drop-shadow-md" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white line-clamp-2 h-10 leading-tight">{product.name}</h3>
                    {isEditingPackagingPrices ? (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={tempPackagingPrices[product.id] || 0}
                          onChange={(e) => setTempPackagingPrices(prev => ({ ...prev, [product.id]: Number(e.target.value) }))}
                          className="w-20 text-center bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg py-1 px-2 text-sm font-black text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          dir="ltr"
                        />
                        <span className="text-[10px] text-slate-500">ج.م</span>
                      </div>
                    ) : (
                      <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tighter">
                        {product.price} <span className="text-[10px] font-sans">ج.م</span>
                      </p>
                    )}
                  </div>

                  {!isEditingPackagingPrices && (
                    <div className="w-full flex items-center justify-between p-1 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 mt-2">
                      <button 
                        onClick={() => handlePackagingCartUpdate(product.id, -1)}
                        className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-slate-400 hover:text-red-500 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 transition active:scale-90"
                      >
                        <Minus size={16} />
                      </button>
                      
                      <span className="text-base font-black tabular-nums text-slate-800 dark:text-white">
                        {packagingCart[product.id] || 0}
                      </span>

                      <button 
                        onClick={() => handlePackagingCartUpdate(product.id, 1)}
                        className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition active:scale-95"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tips Info Card */}
          <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/40 p-6 rounded-3xl flex items-start gap-4">
            <div className="p-3 bg-white dark:bg-slate-800 text-amber-500 rounded-2xl shadow-sm border border-amber-100 dark:border-slate-700">
              <Info size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-800 dark:text-white">ما فائدة التغليف الرسمي؟</h4>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                استخدام فلايرات بوسطة وكراتين بوسطة الرسمية يسرع من عملية الفرز في الـ Hubs ويحمي شحنتك من الفقد، كما أنه يمنح العميل انطباعاً احترافياً عن متجرك ومصداقيتك في التعامل.
              </p>
            </div>
          </div>
        </div>
      ) : activePortalTab === 'api-integration' ? (
        /* Real Bosta API Configuration View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles size={20} className="text-indigo-600" /> إعدادات الربط المباشر مع بوسطة (Official Bosta API)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                توليد بوالص الشحن الرسمية، طباعة ملصقات الباركود AWB، وتتبع مسار الطرود مباشرة من خوادم بوسطة.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`p-2 px-4 rounded-2xl border text-xs font-black flex items-center gap-2.5 ${settings?.bostaConfig?.isActive ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-200 dark:border-emerald-800/60' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${settings?.bostaConfig?.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                <span>{settings?.bostaConfig?.isActive ? `متصل بحساب: ${settings.bostaConfig.connectedUserName || 'بوسطة المعتمد'}` : 'الاتصال غير مفعل'}</span>
              </div>

              {(settings?.bostaConfig?.isActive || apiSettings.bostaApiKey) && (
                <button
                  type="button"
                  onClick={() => setShowDisconnectModal(true)}
                  className="p-2 px-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-950/40 flex items-center gap-1.5 transition"
                  title="إلغاء الربط وتصفير المفتاح القديم"
                >
                  <Trash2 size={13} />
                  <span>إلغاء الربط والبدء من جديد</span>
                </button>
              )}
            </div>
          </div>

          {verifyStatus && (
            <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${verifyStatus.success ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 text-rose-700 dark:text-rose-300'}`}>
              {verifyStatus.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{verifyStatus.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Credentials Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-600" /> طريقة الربط مع خوادم بوسطة
                </h3>
                <a
                  href="https://docs.bosta.co/api#/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <BookOpen size={12} /> التوثيق الرسمي لبوسطة (API Docs)
                  <ExternalLink size={10} />
                </a>
              </div>

              {/* Environment Selector */}
              <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-2">
                  اختر بيئة العمل (Bosta Environment):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!isEditingApi}
                    onClick={() => setApiSettings(prev => ({ ...prev, environment: 'production' }))}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-1 ${apiSettings.environment === 'production' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-1.5">🏢 حساب حقيقي (Live / Production)</span>
                    <span className={`text-[10px] ${apiSettings.environment === 'production' ? 'text-indigo-100' : 'text-slate-400'}`}>business.bosta.co</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isEditingApi}
                    onClick={() => setApiSettings(prev => ({ ...prev, environment: 'staging' }))}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-1 ${apiSettings.environment === 'staging' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-1.5">🧪 بيئة تجريبية (Staging / Sandbox)</span>
                    <span className={`text-[10px] ${apiSettings.environment === 'staging' ? 'text-indigo-100' : 'text-slate-400'}`}>stg-app.bosta.co</span>
                  </button>
                </div>
              </div>

              {/* Method Tabs: API Key vs Direct Login */}
              <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-xl grid grid-cols-2 gap-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setAuthMethod('apikey')}
                  className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${authMethod === 'apikey' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  <Key size={14} /> مفتاح الربط (API Key)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('directLogin')}
                  className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${authMethod === 'directLogin' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  <Sparkles size={14} className="text-amber-500" /> تسجيل دخول مباشر (Email)
                </button>
              </div>

              {authMethod === 'apikey' ? (
                /* Method 1: API Key */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-600 dark:text-slate-400 block">
                        مفتاح الـ API الخاص بحسابك في بوسطة (Bosta API Key):
                      </label>
                      <a
                        href={apiSettings.environment === 'staging' ? "https://stg-app.bosta.co/settings/api-integration" : "https://business.bosta.co/settings/api-integration"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink size={11} /> فتح لوحة بوسطة لإنشاء المفتاح
                      </a>
                    </div>
                    <div className="relative">
                      <input 
                        type={showApiKey ? "text" : "password"}
                        disabled={!isEditingApi}
                        value={apiSettings.bostaApiKey}
                        onChange={(e) => setApiSettings({...apiSettings, bostaApiKey: e.target.value})}
                        placeholder="أدخل مفتاح الـ API من لوحة تحكم بوسطة"
                        className="w-full p-3 pl-12 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold dark:text-white disabled:opacity-75" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Official Bosta Instructions Box */}
                  <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl text-xs space-y-2 text-slate-700 dark:text-slate-300">
                    <div className="font-bold flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                      <BookOpen size={14} /> خطوات استخراج المفتاح من بوسطة (حسب التوثيق الرسمي):
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      <li>ادخل إلى حسابك في بوسطة ثم توجه إلى <b>Settings ➔ API Integration</b>.</li>
                      <li>اضغط على <b>Request OTP</b> لاستقبال رمز التحقق على هاتفك المحمول المسجل.</li>
                      <li>أدخل كود الـ OTP ثم اضغط <b>Create API Key</b>.</li>
                      <li>اختر الصلاحية: <b>Full Access</b> (أو Read/Write).</li>
                      <li><b className="text-rose-600 dark:text-rose-400">تنبيه هام جداً:</b> انسخ المفتاح فور ظهوره وقبل إغلاق النافذة (لن يظهر مرة أخرى).</li>
                      <li>الصق المفتاح في الحقل أعلاه واضغط <b>فحص وحفظ الربط</b> بالأسفل.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                /* Method 2: Direct Login with Bosta Credentials */
                <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-3">
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <b>الربط السريع بدون تعقيد:</b> أدخل البريد الإلكتروني وكلمة المرور لحسابك في بوسطة، وسيقوم النظام بتسجيل الدخول بأمان واستخراج رمز التفويض الرسمي (Authorization Token) وتنشيط الربط فوراً.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      البريد الإلكتروني المسجل في بوسطة:
                    </label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      كلمة مرور حساب بوسطة:
                    </label>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-2.5 pl-10 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isLoggingIn || !loginEmail.trim() || !loginPassword}
                    onClick={handleDirectLogin}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> جاري تسجيل الدخول واستخراج مفتاح الربط...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> تسجيل الدخول والربط تلقائياً
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Troubleshooting Card for Invalid Key Error */}
              {verifyStatus && !verifyStatus.success && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs space-y-3 text-amber-900 dark:text-amber-200">
                  <div className="font-black flex items-center justify-between text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1.5"><AlertCircle size={15} /> استجابة الفحص من بوسطة:</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">تنبيه اتصال</span>
                  </div>
                  <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-white/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                    {verifyStatus.message}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDirectSaveWithoutVerify}
                      className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} /> حفظ وتفعيل المفتاح مباشرة (تخطي الفحص)
                    </button>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      إذا كنت متأكداً من صحة المفتاح، يمكنك تفعيله فوراً واستخدامه لشحن الطلبات.
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 dark:text-slate-400 block">
                  رقم تعريف المنشأة التجاري (Business ID - اختياري):
                </label>
                <input 
                  type="text" 
                  disabled={!isEditingApi}
                  value={apiSettings.businessId}
                  onChange={(e) => setApiSettings({...apiSettings, businessId: e.target.value})}
                  placeholder="يتم جلبه تلقائياً عند فحص الاتصال"
                  className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold dark:text-white disabled:opacity-75" 
                />
              </div>

              <div className="space-y-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Radio size={14} className="text-indigo-600 animate-pulse" />
                    رابط استقبال التحديثات التلقائية (Bosta Webhook URL):
                  </label>
                  <a
                    href="https://docs.bosta.co/docs/how-to/get-delivery-status-via-webhook/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <BookOpen size={12} /> وثائق الـ Webhook الرسمية
                    <ExternalLink size={10} />
                  </a>
                </div>
                
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  عند تغيير حالة أي شحنة في بوسطة (تم الاستلام، جاري التوصيل، تم التسليم، مرتجع)، تقوم خوادم بوسطة بإرسال إشعار فوري لهذا الرابط لتحديث حالة الأوردر وحساباتك تلقائياً دون أي تدخل يدوي:
                </p>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={apiSettings.webhookUrl}
                    className="flex-1 p-3 font-mono text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-indigo-950 dark:text-indigo-200 font-bold select-all" 
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(apiSettings.webhookUrl);
                      inAppToast('تم نسخ رابط الـ Webhook بنجاح! ضعه في إعدادات Webhooks في بوسطة.', 'success');
                    }}
                    className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap shadow-sm shadow-indigo-600/20 flex items-center gap-1.5"
                  >
                    <CheckCheck size={14} /> نسخ الرابط
                  </button>
                </div>

                {/* Direct link to Bosta Dashboard */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>طريقة التفعيل في بوسطة: <b>Settings ➔ Webhooks ➔ Add Endpoint</b></span>
                  <a
                    href="https://business.bosta.co/settings/webhooks"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                  >
                    فتح إعدادات بوسطة الآن <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-3">
                {isEditingApi ? (
                  <>
                    <button 
                      onClick={handleVerifyAndSave}
                      disabled={isVerifying}
                      className="flex-1 min-w-[140px] py-3 bg-indigo-600 text-white font-black rounded-xl text-xs shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> جاري فحص مفتاح بوسطة...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} /> فحص وتأكيد الاتصال والحفظ
                        </>
                      )}
                    </button>
                    <button 
                      type="button"
                      onClick={handleDirectSaveWithoutVerify}
                      disabled={!apiSettings.bostaApiKey}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition flex items-center gap-1.5 justify-center disabled:opacity-50"
                      title="حفظ المفتاح فوراً وتفعيله بدون انتظار الفحص"
                    >
                      <CheckCircle2 size={14} />
                      <span>حفظ وتفعيل المفتاح مباشرة</span>
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditingApi(true)}
                    className="flex-1 min-w-[140px] py-3 bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 hover:bg-slate-900 font-extrabold rounded-xl text-xs shadow transition text-center"
                  >
                    تعديل بيانات المفاتيح
                  </button>
                )}
                
                <button 
                  onClick={handleVerifyAndSave}
                  disabled={isVerifying || !apiSettings.bostaApiKey}
                  className="px-4 py-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs transition flex items-center gap-2 justify-center"
                >
                  <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} />
                  إعادة الاختبار
                </button>

                {(settings?.bostaConfig?.isActive || apiSettings.bostaApiKey) && (
                  <button 
                    type="button"
                    onClick={() => setShowDisconnectModal(true)}
                    className="px-3 py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold rounded-xl text-xs transition flex items-center gap-1.5 justify-center border border-rose-200 dark:border-rose-900/50"
                    title="حذف وإلغاء الربط القديم والبدء من جديد"
                  >
                    <Trash2 size={14} />
                    <span>إلغاء الربط</span>
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Webhook Simulator & Tester */}
            <div className="space-y-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <Zap size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      مختبر تجربة ومحاكاة الـ Webhook (Live Bosta Webhook Tester)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      اختبار فوري لاستقبال تحديثات الحالات التلقائية وتطبيقها على الأوردرات كما توضح وثائق Bosta
                    </p>
                  </div>
                </div>

                <a
                  href="https://docs.bosta.co/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-bold flex items-center gap-1.5 self-start sm:self-auto transition"
                >
                  <BookOpen size={12} /> Bosta Docs API
                  <ExternalLink size={10} />
                </a>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">رقم البوليصة أو رقم الطلب للاختبار:</label>
                    <input 
                      type="text"
                      value={simTrackingNumber}
                      onChange={(e) => setSimTrackingNumber(e.target.value)}
                      placeholder={orders.find(o => o.waybillNumber)?.waybillNumber || "مثال: 45892134"}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">اختر حدث الحالة المطلوب محاكاته:</label>
                    <select
                      value={simStateCode}
                      onChange={(e) => {
                        const code = Number(e.target.value);
                        setSimStateCode(code);
                        if (code === 45) {
                          setSimStateValue("Delivered");
                          setSimReason("تم تسليم الشحنة للعميل وتحصيل المبلغ");
                        } else if (code === 40) {
                          setSimStateValue("Out for delivery");
                          setSimReason("الشحنة مع المندوب وفي الطريق للعميل");
                        } else if (code === 46) {
                          setSimStateValue("Returned to business");
                          setSimReason("رفض العميل الاستلام - مرتجع للتاجر");
                        } else if (code === 48) {
                          setSimStateValue("Customer Action Required");
                          setSimReason("تم تأجيل الموعد بناءً على رغبة العميل");
                        } else if (code === 21) {
                          setSimStateValue("Picked up");
                          setSimReason("تم استلام الشحنة من مقر المتجر");
                        }
                      }}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500"
                    >
                      <option value={45}>🟢 تم التسليم بنجاح (Delivered - كود 45)</option>
                      <option value={40}>🚚 جاري التوصيل مع المندوب (Out for delivery - كود 40)</option>
                      <option value={21}>📦 تم الاستلام من المتجر (Picked up - كود 21)</option>
                      <option value={46}>🔴 مرتجع للتاجر (Returned to business - كود 46)</option>
                      <option value={48}>⏳ تأجيل من العميل (Customer Action Required - كود 48)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">مرسل من متجر / الفرع (Business Location):</label>
                    <div className="relative">
                      <select 
                        value={apiSettings.defaultBusinessLocationId}
                        onChange={(e) => setApiSettings({...apiSettings, defaultBusinessLocationId: e.target.value})}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white appearance-none"
                      >
                        <option value="">-- الافتراضي (حسب الحساب) --</option>
                        {businessLocations.map(loc => (
                          <option key={loc._id} value={loc._id}>{loc.name || loc.nameAr} - {loc.city?.nameAr || loc.city?.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">موقع إرجاع الشحنة (Return Location):</label>
                    <div className="relative">
                      <select 
                        value={apiSettings.defaultReturnLocationId}
                        onChange={(e) => setApiSettings({...apiSettings, defaultReturnLocationId: e.target.value})}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white appearance-none"
                      >
                        <option value="">-- نفس موقع الإرسال / الافتراضي --</option>
                        {businessLocations.map(loc => (
                          <option key={loc._id} value={loc._id}>{loc.name || loc.nameAr} - {loc.city?.nameAr || loc.city?.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>

                </div>

                {/* Quick 1-Click Simulation Buttons */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">تجربة سريعة بنقرة واحدة:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      disabled={isSimulatingWebhook}
                      onClick={() => handleSimulateWebhookEvent(45, "Delivered", "تم تسليم الشحنة للعميل بنجاح")}
                      className="p-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> محاكاة: تم التسليم
                    </button>

                    <button
                      type="button"
                      disabled={isSimulatingWebhook}
                      onClick={() => handleSimulateWebhookEvent(40, "Out for delivery", "الشحنة في سيارة التوزيع")}
                      className="p-2 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/60 text-blue-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Truck size={13} /> محاكاة: جاري التوصيل
                    </button>

                    <button
                      type="button"
                      disabled={isSimulatingWebhook}
                      onClick={() => handleSimulateWebhookEvent(46, "Returned to business", "مرتجع لتعذر الوصول")}
                      className="p-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <AlertCircle size={13} /> محاكاة: مرتجع
                    </button>

                    <button
                      type="button"
                      disabled={isSimulatingWebhook}
                      onClick={() => handleSimulateWebhookEvent(48, "Customer Action Required", "طلب العميل تأجيل الاستلام للغد")}
                      className="p-2 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Clock size={13} /> محاكاة: مؤجل
                    </button>
                  </div>
                </div>

                {/* Simulation Logs */}
                {simLog.length > 0 && (
                  <div className="mt-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
                    <div className="text-[10px] text-slate-500 font-sans font-bold">سجل أحداث الـ Webhook المستلمة:</div>
                    {simLog.map((log, idx) => (
                      <div key={idx} className={`flex items-start gap-2 ${log.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <span className="text-slate-500 shrink-0">[{log.time}]</span>
                        <span>{log.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Warehouse & Shipping Defaults */}
            <div className="space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <MapPin size={16} className="text-indigo-600" /> عنوان استلام الشحنات والخيارات الافتراضية
              </h3>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">عنوان المتجر / المستودع:</label>
                  <input 
                    type="text"
                    value={apiSettings.pickupFirstLine}
                    onChange={(e) => setApiSettings({...apiSettings, pickupFirstLine: e.target.value})}
                    placeholder="مثال: شارع التحرير، الدقي، الجيزة"
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">المحافظة / المدينة في بوسطة:</label>
                    {bostaCities.length > 0 ? (
                      <select 
                        value={apiSettings.pickupCity}
                        onChange={(e) => setApiSettings({...apiSettings, pickupCity: e.target.value})}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white"
                      >
                        {bostaCities.map(c => (
                          <option key={c._id || c.name} value={c.name}>
                            {c.nameAr || c.name} ({c.name})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text"
                        value={apiSettings.pickupCity}
                        onChange={(e) => setApiSettings({...apiSettings, pickupCity: e.target.value})}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">حجم الطرد الافتراضي:</label>
                    <select 
                      value={apiSettings.defaultPackageSize}
                      onChange={(e) => setApiSettings({...apiSettings, defaultPackageSize: e.target.value as any})}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white"
                    >
                      <option value="SMALL">صغير (Small - حتى 2 كجم)</option>
                      <option value="MEDIUM">متوسط (Medium - حتى 5 كجم)</option>
                      <option value="LARGE">كبير (Large - حتى 15 كجم)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">اسم مسؤول التسليم:</label>
                    <input 
                      type="text"
                      value={apiSettings.pickupContactName}
                      onChange={(e) => setApiSettings({...apiSettings, pickupContactName: e.target.value})}
                      placeholder="اسم المستودع أو المدير"
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">هاتف مسؤول التسليم:</label>
                    <input 
                      type="text"
                      value={apiSettings.pickupContactPhone}
                      onChange={(e) => setApiSettings({...apiSettings, pickupContactPhone: e.target.value})}
                      placeholder="01xxxxxxxxx"
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-mono font-bold dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input 
                      type="checkbox"
                      checked={apiSettings.allowToOpenPackage}
                      onChange={(e) => setApiSettings({...apiSettings, allowToOpenPackage: e.target.checked})}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span>السماح للعميل بفتح الشحنة ومعاينتها قبل الاستلام (Open Package)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input 
                      type="checkbox"
                      checked={apiSettings.autoSendOnConfirm}
                      onChange={(e) => setApiSettings({...apiSettings, autoSendOnConfirm: e.target.checked})}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span>إرسال الشحنة لبوسطة تلقائياً فور تأكيد الأوردر</span>
                  </label>

                  {/* WhatsApp Tracking & Webhook Sync Automations */}
                  <div className="pt-2 mt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                        <input 
                          type="checkbox"
                          checked={apiSettings.autoSendWhatsAppTracking}
                          onChange={(e) => setApiSettings({...apiSettings, autoSendWhatsAppTracking: e.target.checked})}
                          className="rounded text-emerald-600 w-4 h-4"
                        />
                        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                          <MessageCircle size={15} /> إرسال رابط التتبع تلقائياً للعميل عبر WhatsApp فور إنشاء الشحنة
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                        <input 
                          type="checkbox"
                          checked={apiSettings.autoSendWhatsAppOnStatusChange}
                          onChange={(e) => setApiSettings({...apiSettings, autoSendWhatsAppOnStatusChange: e.target.checked})}
                          className="rounded text-indigo-600 w-4 h-4"
                        />
                        <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
                          <CheckCircle2 size={15} /> إرسال إشعار WhatsApp فوري للعميل عند تغير حالة الشحنة بالـ Webhook (مثل: جاري التوصيل / تم التسليم)
                        </span>
                      </label>
                    </div>

                    {apiSettings.autoSendWhatsAppTracking && (
                      <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-1">
                        <label className="font-bold text-[11px] text-emerald-900 dark:text-emerald-300 block">
                          قالب رسالة التتبع المخصصة (اختياري - اتركها فارغة لاستخدام القالب الافتراضي):
                        </label>
                        <textarea
                          rows={2}
                          value={apiSettings.whatsappTrackingMessageTemplate}
                          onChange={(e) => setApiSettings({...apiSettings, whatsappTrackingMessageTemplate: e.target.value})}
                          placeholder="المتغيرات المتاحة: {customerName}, {orderNumber}, {trackingNumber}, {trackingUrl}, {totalPrice}, {storeName}"
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] outline-none font-mono text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activePortalTab === 'pickups' ? (
        /* Pickups & Manifest Tab */
        <div className="space-y-6">
          {/* Explanation Card */}
          <div className="bg-gradient-to-l from-indigo-900 via-slate-900 to-slate-950 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-wider">
                <Calendar size={16} /> نظام دورة الشحن وأذونات الاستلام (Smart Pickup Workflow)
              </div>
              <h2 className="text-xl font-black">
                تجهيز الطرود وطباعة البوالص، ثم استدعاء المندوب بإذن استلام
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                كما تفضلتم: يمكنك إنشاء الشحنات وطباعة بوالص الشحن مسبقاً لكل طلب وتجهيز الكراتين في المستودع دون أي تكلفة شحن مسبقة. وعند الانتهاء من تجهيز الدفعة، يتم عمل «إذن استلام» ليحضر مندوب بوسطة ويستلم الشحنات دفعة واحدة.
              </p>
            </div>

            <button
              onClick={() => setShowPickupModal(true)}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center gap-2 shrink-0 transition"
            >
              <Plus size={18} /> طلب مندوب استلام جديد (Schedule Pickup)
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 block mb-1">الطرود المجهزة ببوليصة بوسطة:</span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {orders.filter(o => o.waybillNumber || o.bostaDeliveryId || o.shippingCompany === 'بوسطة').length} طلب
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي أذونات الاستلام المجدولة:</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {(settings?.bostaPickups || []).length} إذن
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 block mb-1">حالة اتصال بوسطة API:</span>
              <span className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${settings?.bostaConfig?.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                {settings?.bostaConfig?.isActive ? 'نشط ومفعل' : 'غير متصل'}
              </span>
            </div>
          </div>

          {/* Prepared Orders Ready for Pickup */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
                  <Package size={18} className="text-indigo-600" /> الطرود الجاهزة للاستلام والتسليم للمندوب
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  قائمة بالطلبات المجهزة التي تم توليد بوالص شحن بوسطة لها وبانتظار حضور المندوب
                </p>
              </div>
            </div>

            {orders.filter(o => o.waybillNumber || o.bostaDeliveryId || o.shippingCompany === 'بوسطة').length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Package size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-bold">لا توجد طلبات تم إرسالها لبوسطة بعد.</p>
                <p className="text-[11px] text-slate-400">
                  يمكنك الذهاب لقائمة الطلبات والضغط على "إرسال إلى بوسطة وتوليد البوليصة" لأي طلب أو تحديد عدة طلبات وإرسالها دفعة واحدة.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-slate-400 font-bold">
                      <th className="pb-3 pr-2">رقم الطلب</th>
                      <th className="pb-3">العميل والمحافظة</th>
                      <th className="pb-3">رقم البوليصة (AWB)</th>
                      <th className="pb-3">مبلغ التحصيل</th>
                      <th className="pb-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800 font-bold">
                    {orders
                      .filter(o => o.waybillNumber || o.bostaDeliveryId || o.shippingCompany === 'بوسطة')
                      .slice(0, 15)
                      .map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                          <td className="py-3 pr-2 font-mono text-indigo-600 dark:text-indigo-400">
                            #{ord.orderNumber || ord.id.slice(0, 6)}
                          </td>
                          <td className="py-3">
                            <span className="block font-black text-slate-800 dark:text-white">{ord.customerName}</span>
                            <span className="text-[11px] text-slate-400 font-normal">{ord.governorate || ord.customerAddress || '—'}</span>
                          </td>
                          <td className="py-3 font-mono">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black">
                              {ord.waybillNumber || ord.bostaTrackingNumber || 'قيد المعالجة'}
                            </span>
                          </td>
                          <td className="py-3 font-mono font-black text-emerald-600">
                            {ord.totalPrice || 0} ج.م
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-center gap-2">
                              {(ord.bostaDeliveryId || ord.waybillNumber) && (
                                <button
                                  onClick={() => handlePrintAwbDirect(ord.bostaDeliveryId || ord.waybillNumber!)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] transition flex items-center gap-1"
                                >
                                  <Printer size={12} /> طباعة البوليصة
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setActiveTrackingNumber(ord.waybillNumber || ord.bostaTrackingNumber || '');
                                  setShowTrackingModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[11px] transition flex items-center gap-1"
                              >
                                <Truck size={12} /> تتبع
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Past Pickup Requests */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
              <Calendar size={18} className="text-indigo-600" /> سجل أذونات الاستلام المحفوظة (Pickup History)
            </h3>

            {(settings?.bostaPickups || []).length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <Clock size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-bold">لم يتم تسجيل أي إذن استلام حتى الآن.</p>
                <p className="text-[11px] text-slate-400">عند طلب حضور المندوب سيظهر الإذن هنا مع تفاصيل الموعد.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-slate-400 font-bold">
                      <th className="pb-3 pr-2">رقم الإذن</th>
                      <th className="pb-3">موعد الحضور</th>
                      <th className="pb-3">الفترة الزمنية</th>
                      <th className="pb-3">عدد الطرود</th>
                      <th className="pb-3">عنوان الاستلام</th>
                      <th className="pb-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800 font-bold">
                    {(settings?.bostaPickups || []).map((pk: BostaPickupRequest) => (
                      <tr key={pk.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 pr-2 font-mono text-indigo-600 font-black">
                          {pk.bostaPickupId || pk.id.slice(0, 10)}
                        </td>
                        <td className="py-3 font-sans font-black text-slate-800 dark:text-white">
                          {pk.scheduledDate}
                        </td>
                        <td className="py-3 font-sans text-slate-500">
                          {pk.scheduledSlot}
                        </td>
                        <td className="py-3 font-mono font-black text-indigo-600">
                          {pk.ordersCount} طرد
                        </td>
                        <td className="py-3 text-slate-500 text-[11px]">
                          {pk.pickupAddress}
                        </td>
                        <td className="py-3">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                            {pk.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tracking Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Truck size={20} className="text-indigo-600" /> تتبع شحنات بوسطة المباشر (Bosta Live Tracking)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              استعلام حي ومباشر عن حالة أي شحنة مسجلة في بوسطة برقم البوليصة
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={trackingSearchInput}
              onChange={(e) => setTrackingSearchInput(e.target.value)}
              placeholder="أدخل رقم بوليصة الشحن (مثال: 54321098)"
              className="flex-1 p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleQuickTrackShipment}
              disabled={quickTrackLoading || !trackingSearchInput.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {quickTrackLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              استعلام وتتبع الآن
            </button>
          </div>

          {quickTrackResult && (
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">الحالة الحالية في خوادم بوسطة:</span>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                    {quickTrackResult?.state?.value || quickTrackResult?.state || quickTrackResult?.status || 'تم التسليم أو قيد النقل'}
                  </span>
                </div>
                <a
                  href={`https://bosta.co/tracking-shipment/?track=${encodeURIComponent(trackingSearchInput)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                >
                  <ExternalLink size={13} /> رابط بوسطة الرسمي
                </a>
              </div>

              {/* Transit events */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">مراحل الشحنة:</h4>
                <div className="space-y-3 pr-3 border-r-2 border-slate-200 dark:border-slate-700">
                  {(quickTrackResult?.timeline || quickTrackResult?.TransitEvents || []).map((ev: any, i: number) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <p className="font-black text-slate-800 dark:text-white">{ev.state || ev.status || ev.message}</p>
                      <p className="text-[11px] text-slate-400">{ev.timestamp ? new Date(ev.timestamp).toLocaleString('ar-EG') : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Weekly payout Transfer Setting Modal */}
      {showCashoutModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 border border-slate-300 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Calendar className="text-indigo-600" /> إعدادات سحب متحصلات بوسطة
              </h3>
              <button onClick={() => setShowCashoutModal(false)}><X className="text-slate-400 hover:text-red-500" /></button>
            </div>

            <div className="space-y-4 text-xs font-bold leading-normal">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500">نظام تكرار تحويل رصيدك من بوسطة:</label>
                <select 
                  value={cashoutSchedule} 
                  onChange={(e) => setCashoutSchedule(e.target.value as any)}
                  className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="weekly">تحويل أسبوعي (Weekly Cash Transfer)</option>
                  <option value="daily">تحويل يومي مستمر (Daily Rolling Cash)</option>
                  <option value="biweekly">تحويل كل أسبوعين (Bi-weekly Cash Transfer)</option>
                </select>
              </div>

              {cashoutSchedule === 'weekly' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500">اختر يوم التحويل الأسبوعي:</label>
                  <select 
                    value={cashoutDay} 
                    onChange={(e) => setCashoutDay(e.target.value)}
                    className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="الاثنين">الاثنين (Monday - الافتراضي والأسرع)</option>
                    <option value="الأربعاء">الأربعاء (Wednesday)</option>
                    <option value="الخميس">الخميس (Thursday)</option>
                  </select>
                </div>
              )}

              {/* Bank Account settings */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-105 rounded-xl space-y-3">
                <h4 className="font-extrabold text-[11px] text-indigo-700 dark:text-indigo-300">تفاصيل الحساب المصرفي (لتلقي الدفعات):</h4>
                
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400">اسم البنك:</span>
                  <input 
                    type="text" 
                    value={bankInfo.bankName} 
                    onChange={(e) => setBankInfo({...bankInfo, bankName: e.target.value})}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" 
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400">اسم صاحب الحساب بالكامل:</span>
                  <input 
                    type="text" 
                    value={bankInfo.nameOnCard} 
                    onChange={(e) => setBankInfo({...bankInfo, nameOnCard: e.target.value})}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" 
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400">رقم الحساب أو الآيبان (IBAN):</span>
                  <input 
                    type="text" 
                    value={bankInfo.accountNumber} 
                    onChange={(e) => setBankInfo({...bankInfo, accountNumber: e.target.value})}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono" 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => {
                  setShowCashoutModal(false);
                  alert('تم حفظ وتعديل جدولة السحب النقدي وباقة تحويل الأرباح بنجاح بنسبة 100%!');
                }}
                className="flex-1 py-3 bg-indigo-600 text-white font-black text-xs rounded-xl shadowhover:bg-indigo-700 active:scale-95"
              >
                حفظ الإعدادات
              </button>
              <button 
                onClick={() => setShowCashoutModal(false)}
                className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-xs font-bold"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: How It's Calculated info sheets Modal */}
      {showHowItCalculatedModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 border border-slate-300 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <HelpCircle className="text-indigo-600" /> كيفية حساب تسعير بوسطة للشحنات؟
              </h3>
              <button onClick={() => setShowHowItCalculatedModal(false)}><X className="text-slate-400 hover:text-red-500" /></button>
            </div>

            <div className="space-y-4 text-xs font-bold leading-normal text-slate-600 dark:text-slate-300">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-300 rounded-xl border border-indigo-100">
                <span className="block font-black text-xs mb-1">صيغة الحساب الرسمية:</span>
                <p className="text-[11px]">رسوم الخدمة الأساسية بجدول بوسطة + نسبة ضريبة القيمة المضافة الإلزامية في مصر (14%) + رسوم التحصيل الإضافية (1% على المبلغ فوق 3000 ج.م).</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-indigo-600 font-extrabold text-[12px] block">1. رسوم بوابات الشحن الأساسية:</span>
                  <p className="text-[11px] text-slate-500 leading-normal">يتم تسعير طرود بوسطة حسب فئة المحافظة/المنطقة (مثلاً القاهرة 77 ج.م، الصعيد 110 ج.م) وبناءً على فئة الوزن والحجم المسموحة للطرود.</p>
                </div>

                <div className="space-y-1">
                  <span className="text-indigo-600 font-extrabold text-[12px] block">2. الوزن الزائد (Extra KG):</span>
                  <p className="text-[11px] text-slate-500 leading-normal">كل كيلوغرام زائد عن الوزن الأساسي للفئة (مثال: طرد S/M أكبر من 5 كيلوغرام) سيتم احتسابه بسعر 10 جنيهات إضافية لكل كيلوغرام زائد تلقائياً.</p>
                </div>

                <div className="space-y-1">
                  <span className="text-indigo-600 font-extrabold text-[12px] block">3. آلية رسوم التحصيل النقدية (COD Handling):</span>
                  <p className="text-[11px] text-slate-500 leading-normal">تطبق رسوم بقيمة 1% من قيمة التحصيل النقدي بالأوردر، ويتم إعفاء أول 3000 ج.م من هذه الرسوم، لتخصم الـ 1% فقط على مقدار الزيادة الإضافية فوق 3000 ج.م.</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-left">
              <button 
                onClick={() => setShowHowItCalculatedModal(false)}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow transition active:scale-95"
              >
                علم ويتم الالتزام
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL Packaging Purchase */}
      {showPackagingCheckout && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-7 border border-slate-300 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-lg"><Sparkles size={18} /></div>
                تأكيد عملية الشراء
              </h3>
              <button 
                onClick={() => setShowPackagingCheckout(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <X className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-black text-slate-400 uppercase mb-3">تفاصيل السلة</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Object.entries(packagingCart).map(([id, qty]) => {
                    const product = PACKAGING_PRODUCTS.find(p => p.id === id);
                    return (
                      <div key={id} className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {product?.name} <span className="text-[10px] text-slate-400">× {qty}</span>
                        </span>
                        <span className="font-mono font-black text-slate-800 dark:text-white">
                          {(product?.price || 0) * qty} ج.م
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>مصاريف شحن أدوات التغليف:</span>
                    {isEditingPackagingPrices ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={tempPackagingShippingFee}
                          onChange={(e) => setTempPackagingShippingFee(Number(e.target.value))}
                          className="w-16 text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 text-xs font-bold outline-none"
                          dir="ltr"
                        />
                        <span>ج.م</span>
                      </div>
                    ) : (
                      <span>{PACKAGING_SHIPPING_FEE} ج.م</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-800 dark:text-white">الإجمالي النهائي:</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {calculatePackagingTotal() + PACKAGING_SHIPPING_FEE} ج.م
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300">طريقة الدفع:</label>
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <button
                    onClick={() => { 
                      setPackagingPaymentType('treasury'); 
                      if (treasury?.accounts?.length > 0) setSelectedPackagingPaymentId(treasury.accounts[0].id);
                      else setSelectedPackagingPaymentId('');
                    }}
                    className={`flex-1 py-2.5 text-xs font-black rounded-xl transition ${packagingPaymentType === 'treasury' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    الخزائن
                  </button>
                  <button
                    onClick={() => { setPackagingPaymentType('wallet'); setSelectedPackagingPaymentId('wallet'); }}
                    className={`flex-1 py-2.5 text-xs font-black rounded-xl transition ${packagingPaymentType === 'wallet' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    المحفظة
                  </button>
                  <button
                    onClick={() => { 
                      setPackagingPaymentType('partner'); 
                      if (settings?.partners?.length > 0) setSelectedPackagingPaymentId(settings.partners[0].id);
                      else setSelectedPackagingPaymentId('');
                    }}
                    className={`flex-1 py-2.5 text-xs font-black rounded-xl transition ${packagingPaymentType === 'partner' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    حساب شريك
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {packagingPaymentType === 'treasury' && treasury?.accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => setSelectedPackagingPaymentId(acc.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        selectedPackagingPaymentId === acc.id 
                        ? 'bg-indigo-50 border-indigo-600 dark:bg-indigo-900/20 ring-1 ring-indigo-600' 
                        : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${
                          acc.type === 'safe' ? 'bg-emerald-100 text-emerald-600' :
                          acc.type === 'bank' ? 'bg-blue-100 text-blue-600' :
                          'bg-purple-100 text-purple-600'
                        }`}>
                          <Wallet size={16} />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-800 dark:text-white">{acc.name}</p>
                          <p className="text-[10px] font-bold text-slate-500">الرصيد المتاح: {acc.balance.toLocaleString('ar-EG')} ج.م</p>
                        </div>
                      </div>
                      {selectedPackagingPaymentId === acc.id && <Check size={16} className="text-indigo-600" />}
                    </button>
                  ))}

                  {packagingPaymentType === 'wallet' && (
                    <button
                      onClick={() => setSelectedPackagingPaymentId('wallet')}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        selectedPackagingPaymentId === 'wallet' 
                        ? 'bg-indigo-50 border-indigo-600 dark:bg-indigo-900/20 ring-1 ring-indigo-600' 
                        : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                          <Coins size={16} />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-800 dark:text-white">محفظة المتجر</p>
                          <p className={`text-[10px] font-bold ${(walletStats.liveBalance === 0) ? 'text-red-500' : 'text-slate-500'}`}>
                            الرصيد المتاح: {walletStats.liveBalance.toLocaleString('ar-EG')} ج.م
                            {(walletStats.liveBalance === 0) && ' (لا يوجد رصيد كافٍ)'}
                          </p>
                        </div>
                      </div>
                      {selectedPackagingPaymentId === 'wallet' && <Check size={16} className="text-indigo-600" />}
                    </button>
                  )}

                  {packagingPaymentType === 'partner' && (settings?.partners || []).map((partner: any) => (
                    <button
                      key={partner.id}
                      onClick={() => setSelectedPackagingPaymentId(partner.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        selectedPackagingPaymentId === partner.id 
                        ? 'bg-indigo-50 border-indigo-600 dark:bg-indigo-900/20 ring-1 ring-indigo-600' 
                        : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                          <User size={16} />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-800 dark:text-white">{partner.name}</p>
                          <p className="text-[10px] font-bold text-slate-500">رصيد الشريك: {partner.balance?.toLocaleString('ar-EG')} ج.م</p>
                        </div>
                      </div>
                      {selectedPackagingPaymentId === partner.id && <Check size={16} className="text-indigo-600" />}
                    </button>
                  ))}

                  {packagingPaymentType === 'partner' && (!settings?.partners || settings.partners.length === 0) && (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                      <p className="text-sm text-slate-500 font-bold">لا يوجد شركاء مضافين حالياً</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-bold bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              * سيتم قيد هذه العملية كـ "مصروف" في سجلات المتجر، وسيتم خصم المبلغ من الرصيد المختار.
            </p>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleConfirmPackagingPurchase}
                disabled={isPackagingProcessing || !selectedPackagingPaymentId}
                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 transition flex items-center justify-center gap-2"
              >
                {isPackagingProcessing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    جاري المعالجة...
                  </>
                ) : (
                  <>تأكيد وخصم المبلغ</>
                )}
              </button>
              <button 
                onClick={() => setShowPackagingCheckout(false)}
                className="px-6 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Packaging History Modal */}
      {showPackagingHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                  <ListFilter size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">سجل مشتريات أدوات التغليف</h3>
                  <p className="text-[10px] font-bold text-slate-500">استعرض جميع الطلبيات السابقة وتفاصيل تكلفتها.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPackagingHistory(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!settings?.data?.packagingOrders || settings.data.packagingOrders.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <Package size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-400">لا توجد مشتريات مسجلة حتى الآن.</p>
                </div>
              ) : (
                settings.data.packagingOrders.map((order: any) => (
                  <div key={order.id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-indigo-200 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">طلب #{order.id}</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <span className="text-[10px] font-bold text-slate-500" dir="ltr">
                            {new Date(order.date).toLocaleDateString('ar-EG')} - {new Date(order.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                            order.paymentMethod === 'wallet' ? 'bg-indigo-100 text-indigo-600' :
                            order.paymentMethod === 'treasury' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-amber-100 text-amber-600'
                          }`}>
                            تم الدفع عبر: {
                              order.paymentMethod === 'wallet' ? 'محفظة المتجر' :
                              order.paymentMethod === 'treasury' ? 'الخزينة' : 'حساب شريك'
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-800 dark:text-white tabular-nums">{order.total} ج.م</p>
                          <p className="text-[9px] font-bold text-slate-400">الإجمالي شامل الشحن</p>
                        </div>
                        <button 
                          onClick={() => handleDeletePackagingOrder(order)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                          title="حذف الطلب واستعادة المبلغ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          <span>{item.name} × {item.quantity}</span>
                          <span className="tabular-nums">{(item.price * item.quantity).toFixed(2)} ج.م</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 italic pt-1">
                        <span>مصاريف شحن بوسطة</span>
                        <span className="tabular-nums">{order.shippingFee} ج.م</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setShowPackagingHistory(false)}
                className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl hover:bg-slate-50 transition"
              >
                إغلاق السجل
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!orderToDelete}
        message="هل أنت متأكد من حذف هذا الطلب؟ سيتم استعادة المبلغ المخصوم إلى جهة الدفع الأصلية."
        onConfirm={confirmDeletePackagingOrder}
        onCancel={() => setOrderToDelete(null)}
      />

      <ConfirmationModal 
        isOpen={showDisconnectModal}
        title="حذف وإلغاء الربط القديم مع بوسطة"
        message="هل أنت متأكد من رغبتك في حذف وإلغاء بيانات الربط القديمة وتصفيرها بالكامل للبدء من جديد؟"
        onConfirm={handleResetAndDisconnect}
        onCancel={() => setShowDisconnectModal(false)}
      />

      {showPickupModal && (
        <BostaPickupModal
          isOpen={showPickupModal}
          onClose={() => setShowPickupModal(false)}
          settings={settings || {}}
          setSettings={setSettings}
          orders={orders}
        />
      )}

      {showTrackingModal && (
        <BostaTrackingModal
          isOpen={showTrackingModal}
          onClose={() => setShowTrackingModal(false)}
          trackingNumber={activeTrackingNumber}
          apiKey={apiSettings.bostaApiKey}
        />
      )}

      {/* Modal to Add/Edit Bosta Location */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <MapPin size={18} className="text-teal-600" />
                {editingLocIndex !== null ? 'تعديل بيانات مكان الشركة' : 'إضافة مكان جديد لشحن بوسطة'}
              </h3>
              <button onClick={() => setShowLocationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">اسم المكان (المخزن / الفرع) *</label>
                <input
                  type="text"
                  placeholder="مثال: مخزن ابو زهره، حنوره اعلاف..."
                  value={locFormName}
                  onChange={(e) => setLocFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">اسم جهة الاتصال *</label>
                <input
                  type="text"
                  placeholder="اسم الشخص المسؤول عن تسليم المندوب..."
                  value={locFormContactName}
                  onChange={(e) => setLocFormContactName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">رقم هاتف التواصل *</label>
                <input
                  type="text"
                  placeholder="+2010..."
                  value={locFormContactPhone}
                  onChange={(e) => setLocFormContactPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">المحافظة / المدينة</label>
                  <input
                    type="text"
                    value={locFormCity}
                    onChange={(e) => setLocFormCity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">العنوان التفصيلي</label>
                  <input
                    type="text"
                    value={locFormAddress}
                    onChange={(e) => setLocFormAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkLocDefault"
                  checked={locFormIsDefault}
                  onChange={(e) => setLocFormIsDefault(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <label htmlFor="chkLocDefault" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  تعيين هذا المكان كفرع أساسي (الاستلامات والإرجاع)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!locFormName.trim()) {
                    inAppAlert("يرجى كتابة اسم المكان.", { title: "تنبيه" });
                    return;
                  }
                  const newLocObj = {
                    _id: editingLocIndex !== null ? businessLocations[editingLocIndex]?._id || `loc_${Date.now()}` : `loc_${Date.now()}`,
                    id: editingLocIndex !== null ? businessLocations[editingLocIndex]?.id || `loc_${Date.now()}` : `loc_${Date.now()}`,
                    locationName: locFormName.trim(),
                    contactPersonName: locFormContactName.trim(),
                    contactPersonPhone: locFormContactPhone.trim(),
                    city: locFormCity.trim(),
                    firstLine: locFormAddress.trim(),
                    isDefault: locFormIsDefault
                  };

                  let newList = [...businessLocations];
                  if (editingLocIndex !== null) {
                    newList[editingLocIndex] = newLocObj;
                  } else {
                    newList.push(newLocObj);
                  }

                  if (locFormIsDefault) {
                    newList = newList.map((item, i) => ({
                      ...item,
                      isDefault: editingLocIndex !== null ? i === editingLocIndex : i === newList.length - 1
                    }));
                  }

                  saveLocationsList(newList);
                  setShowLocationModal(false);
                  inAppToast(editingLocIndex !== null ? "تم تحديث بيانات المكان بنجاح" : "تمت إضافة المكان الجديد بنجاح", 'success');
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black"
              >
                حفظ المكان
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
