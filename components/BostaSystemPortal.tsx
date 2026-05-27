import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { User as AppUser } from '../types';
import { 
  ArrowLeft, Truck, Percent, Coins, Info, Calculator, 
  HelpCircle, Wallet, Banknote, MapPin, Sparkles, Link, 
  Calendar, DollarSign, CheckCircle2, ListFilter, Play,
  ChevronDown, ChevronUp, Globe, Search, RefreshCw, X, ShieldCheck,
  Package, ShoppingCart, Minus, Check, Plus, User
} from 'lucide-react';

interface BostaSystemPortalProps {
  onBack: () => void;
  treasury?: any;
  setTreasury?: (updater: any) => void;
  wallet?: any;
  setWallet?: (updater: any) => void;
  settings?: any;
  setSettings?: (updater: any) => void;
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

export default function BostaSystemPortal({ onBack, treasury, setTreasury, wallet, setWallet, settings, setSettings }: BostaSystemPortalProps) {
  const [activePortalTab, setActivePortalTab] = useState<'calculator' | 'api-integration' | 'packaging'>('calculator');
  const [activeRegion, setActiveRegion] = useState<string>('القاهرة والجيزة');
  const [showVat, setShowVat] = useState<boolean>(true);
  const [pickupSearch, setPickupSearch] = useState<string>('');
  const [selectedHub, setSelectedHub] = useState<string>(BOSTA_HUBS[0]);
  const [isHubDropdownOpen, setIsHubDropdownOpen] = useState<boolean>(false);

  // Packaging Store Stats
  const [packagingCart, setPackagingCart] = useState<Record<string, number>>({});
  const [showPackagingCheckout, setShowPackagingCheckout] = useState(false);
  const [selectedPackagingPaymentId, setSelectedPackagingPaymentId] = useState<string>('');
  const [packagingPaymentType, setPackagingPaymentType] = useState<'treasury' | 'wallet' | 'partner'>('treasury');
  const [isPackagingProcessing, setIsPackagingProcessing] = useState(false);

  const PACKAGING_PRODUCTS = [
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
    const PACKAGING_SHIPPING_FEE = 55;
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
      const itemsDisplay = Object.entries(packagingCart).map(([id, qty]) => {
        const p = PACKAGING_PRODUCTS.find(prod => prod.id === id);
        return `${p?.name} (${qty})`;
      }).join(' + ');

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
          id: `pkg-${Date.now()}`,
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
      } else if (packagingPaymentType === 'wallet' && setWallet) {
          if (wallet.balance < total) {
              alert('الرصيد في المحفظة غير كافٍ');
              setIsPackagingProcessing(false);
              return;
          }
          paymentSourceName = 'محفظة الشحن';
          setWallet((prev: any) => ({
              ...prev,
              balance: prev.balance - total,
              transactions: [{
                  id: `pkg-w-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: 'سحب',
                  amount: total,
                  description: `شراء مواد تغليف بوسطة: ${itemsDisplay}`,
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
              id: `pkg-p-${Date.now()}`,
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
      }

      // Record in wallet transactions as expense regardless of source (except if already done for wallet)
      if (packagingPaymentType !== 'wallet' && setWallet) {
          const newWalletTx = {
            id: `pkg-exp-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'سحب' as const,
            amount: total,
            description: `شراء مواد تغليف بوسطة: ${itemsDisplay}`,
            category: 'expense_packaging',
            status: 'completed' as const
          };
          setWallet((prev: any) => ({
            ...prev,
            transactions: [newWalletTx, ...prev.transactions]
          }));
      }

      // Reset cart and state
      setPackagingCart({});
      setShowPackagingCheckout(false);
      setIsPackagingProcessing(false);
      alert(`تم تنفيذ الشراء بنجاح وخصم مبلغ ${total} ج.م من ${paymentSourceName}.`);
    }, 800);
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

  // API settings
  const [apiSettings, setApiSettings] = useState({
    bostaApiKey: 'bosta_live_key_9f3d9ecbc3e82a9d80d287fe1',
    businessId: 'bus_9340029',
    isActive: true,
    webhookUrl: 'https://ais-dev-xcte2r3fyl5agkthujufx4-222930444647.europe-west1.run.app/api/webhooks/bosta'
  });
  const [isEditingApi, setIsEditingApi] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

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

        <div className="flex bg-slate-200/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit">
          <button 
            onClick={() => setActivePortalTab('calculator')} 
            className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'calculator' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Calculator size={14} /> خطة ومحاكاة الأسعار
          </button>
          <button 
            onClick={() => setActivePortalTab('packaging')} 
            className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'packaging' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Package size={14} /> متجر التغليف (Shop)
          </button>
          <button 
            onClick={() => setActivePortalTab('api-integration')} 
            className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activePortalTab === 'api-integration' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Sparkles size={14} /> الربط الإلكتروني المباشر (API)
          </button>
        </div>
      </div>

      {activePortalTab === 'calculator' ? (
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
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-normal bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
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
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/40 overflow-x-auto">
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
            
            <div className="flex items-center gap-3">
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
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tighter">
                      {product.price} <span className="text-[10px] font-sans">ج.م</span>
                    </p>
                  </div>

                  <div className="w-full flex items-center justify-between p-1 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 mt-2">
                    <button 
                      onClick={() => handlePackagingCartUpdate(product.id, -1)}
                      className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-slate-400 hover:text-red-500 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 transition active:scale-90"
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
      ) : (
        /* Real Bosta API Configuration View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles size={20} className="text-indigo-600" /> إعدادات ربط بوسطة الذكية (Bosta API Sandbox)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">مزامنة كشوف استلام العملاء، الدفعات، وبوالص الشحن تلقائياً.</p>
            </div>
            
            <div className={`p-1.5 px-3 rounded-xl border text-[11px] font-black flex items-center gap-2 ${apiSettings.isActive ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              <span className={`w-2 h-2 rounded-full ${apiSettings.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              {apiSettings.isActive ? 'الاتصال مع بوسطة: متصل ونشط' : 'الاتصال مع بوسطة: معطل'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">فتاح الـ API لشركة بوسطة (Bosta API Key):</label>
                <input 
                  type="password" 
                  disabled={!isEditingApi}
                  value={apiSettings.bostaApiKey}
                  onChange={(e) => setApiSettings({...apiSettings, bostaApiKey: e.target.value})}
                  className="w-full p-3 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">رقم تعريف المنشأة التجاري (Business ID):</label>
                <input 
                  type="text" 
                  disabled={!isEditingApi}
                  value={apiSettings.businessId}
                  onChange={(e) => setApiSettings({...apiSettings, businessId: e.target.value})}
                  className="w-full p-3 font-sans bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-bold dark:text-white disabled:opacity-70 disabled:cursor-not-allowed" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">مستقبل الأحداث (Webhook Callback URL):</label>
                <div className="relative">
                  <input 
                    type="text" 
                    disabled 
                    value={apiSettings.webhookUrl}
                    className="w-full p-3 pl-20 font-sans bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-slate-450 opacity-60 pointer-events-none" 
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-bold text-slate-500 uppercase">Active</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
              <div className="space-y-3 text-xs leading-normal">
                <h4 className="font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-500" /> إرسال بوالص بوسطة بشكل مؤتمت بالكامل
                </h4>
                <p className="text-slate-600 dark:text-slate-350">
                  عند تفعيل الربط الإلكتروني، يتم إنشاء الشحنة تلقائياً على بوسطة فور تأكيد العميل للأوردر عبر صفحة تأكيد الطلبات، وسيتم طباعة بوليصة الشحن بنقرة زر واحدة.
                </p>
                <ul className="list-disc pr-4 space-y-1 text-slate-500 text-[11px]">
                  <li>توفير 10 دقائق لكل أوردر بدلاً من النقل اليدوي.</li>
                  <li>تأمين المرتجعات مع نظام تفعيل الفتح التجريبي (المعاينة).</li>
                  <li>المعالجة الفورية المباشرة لكشوف السداد والمحافظ المالية بأسعار بوسطة الشريكة.</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                {isEditingApi ? (
                  <button 
                    onClick={() => {
                      setIsEditingApi(false);
                      alert('تمت تهيئة وحفظ مفاتيح ربط بوسطة بنجاح!');
                    }}
                    className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-xs shadow-lg hover:bg-indigo-700 transition"
                  >
                    حفظ التغييرات ومزامنة بوسطة
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsEditingApi(true)}
                    className="flex-1 py-3 bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 hover:bg-slate-900 font-extrabold rounded-xl text-xs shadow transition text-center"
                  >
                    تعديل بيانات الربط المباشر
                  </button>
                )}
                
                <button 
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className="px-4 py-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs transition flex items-center gap-2 justify-center"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'مزامنة...' : 'مزامنة يدوية'}
                </button>
              </div>
            </div>

          </div>
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
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
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
                    <span>55 ج.م</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-800 dark:text-white">الإجمالي النهائي:</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {calculatePackagingTotal() + 55} ج.م
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300">طريقة الدفع:</label>
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <button
                    onClick={() => { setPackagingPaymentType('treasury'); setSelectedPackagingPaymentId(''); }}
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
                    onClick={() => { setPackagingPaymentType('partner'); setSelectedPackagingPaymentId(''); }}
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
                          <p className="text-[10px] font-bold text-slate-500">الرصيد المتاح: {acc.balance.toLocaleString()} ج.م</p>
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
                          <p className="text-sm font-black text-slate-800 dark:text-white">محفظة شحن المتجر</p>
                          <p className="text-[10px] font-bold text-slate-500">الرصيد المتاح: {wallet?.balance.toLocaleString()} ج.م</p>
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
                          <p className="text-[10px] font-bold text-slate-500">رصيد الشريك: {partner.balance?.toLocaleString()} ج.م</p>
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

            <p className="text-[10px] text-slate-500 font-bold bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
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
    </div>
  );
}
