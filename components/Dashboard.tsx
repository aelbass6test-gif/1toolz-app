import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Package, CheckCircle2, Wallet as WalletIcon, Truck, RefreshCcw, FileSearch, Check, PlayCircle, X, AlertTriangle, ArrowRight, Lightbulb, Loader, BrainCircuit, PhoneForwarded, PieChart as ChartIcon, Clock, AlertCircle, ShieldAlert, Layers, DollarSign, Monitor, ArrowLeft, Users2, ArrowUpLeft, ShoppingBag, Sparkles, Percent, ArrowDown } from 'lucide-react';
import { Order, Settings, Wallet, User, CustomerProfile, Store, Treasury } from '../types';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { generateDashboardSuggestions } from '../services/geminiService';
import { calculateOrderProfitLoss, getOrderProductCost, getLatestProductCost, calculateInsuranceFee, calculateBostaVat, getStandardShippingFee } from '../utils/financials';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

const StatusDistribution = ({ data }: { data: { name: string, value: number, color: string }[] }) => {
    const total = useMemo(() => (data || []).reduce((sum, item) => sum + item.value, 0), [data]);

    if (total === 0) {
        return <div className="h-full flex items-center justify-center text-slate-400">لا توجد بيانات لعرضها.</div>;
    }

    return (
        <div className="h-full flex flex-col justify-center gap-6 py-4">
            {data.map(item => {
                const percentage = total > 0 ? (item.value / total) * 100 : 0;
                return (
                    <div key={item.name}>
                        <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{item.name}</span>
</div>
<span className="text-xs font-black text-slate-600 dark:text-slate-300">{item.value} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full rounded-full" 
                                style={{ width: `${percentage}%`, backgroundColor: item.color, transition: 'width 0.5s ease-in-out' }}
                            ></div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

const SmartSuggestions = ({ orders, settings }: { orders: Order[], settings: Settings }) => {
    const [suggestions, setSuggestions] = useState('اضغط على زر التحديث للحصول على اقتراحات ذكية.');
    const [isLoading, setIsLoading] = useState(false);

    const customers = useMemo(() => {
        const customerMap = new Map<string, Pick<CustomerProfile, 'name' | 'successfulOrders' | 'totalSpent'>>();
        (orders || []).forEach(order => {
            const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
            if (!cleanPhone) return;
            if (!customerMap.has(cleanPhone)) {
                customerMap.set(cleanPhone, { name: order.customerName, successfulOrders: 0, totalSpent: 0 });
            }
            const customer = customerMap.get(cleanPhone)!;
            if (order.status === 'تم_التحصيل' || order.status === 'مدفوعة') {
                customer.successfulOrders += 1;
                customer.totalSpent += (order.productPrice + order.shippingFee) - (order.discount || 0);
            }
        });
        return Array.from(customerMap.values());
    }, [orders]);

    const fetchSuggestions = async () => {
        setIsLoading(true);
        setSuggestions('');
        const result = await generateDashboardSuggestions(orders || [], (settings?.products || []), customers);
        setSuggestions(result);
        setIsLoading(false);
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2"><Lightbulb className="text-amber-500"/> اقتراحات ذكية</h3>
                <button onClick={fetchSuggestions} disabled={isLoading} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-wait" title="تحديث الاقتراحات">
                    <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>
            {isLoading ? (
                <div className="flex items-center justify-center h-24 text-slate-400 gap-2">
                    <BrainCircuit size={20} className="animate-pulse" />
                    <span>المساعد الذكي يحلل بياناتك...</span>
                </div>
            ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none space-y-2 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {suggestions.split('\n').map((line, i) => <p key={i} className="my-1">{line}</p>)}
                </div>
            )}
        </div>
    );
};


const Dashboard = ({ orders, settings, wallet, treasury, currentUser, activeStore }: { orders: Order[], settings: Settings, wallet: Wallet, treasury: Treasury | undefined, currentUser: User | null, activeStore: Store | undefined }) => {
  const [showVideoBanner, setShowVideoBanner] = useState(true);
  const [financialFilter, setFinancialFilter] = useState<'all' | 'with' | 'dep'>('all');
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showDetailedFinancials, setShowDetailedFinancials] = useState(false);

  const [announcementText, setAnnouncementText] = useState<string | null>(() => {
    const text = localStorage.getItem('platform_announcement_text');
    const type = localStorage.getItem('platform_announcement_type');
    const dismissed = localStorage.getItem('platform_announcement_dismissed');
    if (text && type !== 'none' && dismissed !== text) {
      return text;
    }
    return null;
  });
  const announcementType = useMemo(() => localStorage.getItem('platform_announcement_type') || 'info', []);

  const handleDismissAnnouncement = () => {
    if (announcementText) {
      localStorage.setItem('platform_announcement_dismissed', announcementText);
      setAnnouncementText(null);
    }
  };

  const financialNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      body: string;
      date: string;
      type: 'سحب' | 'إيداع';
      status: string;
      amount: number;
    }> = [];

    // 1. Add withdrawals
    (wallet?.withdrawRequests || []).forEach(r => {
      let body = '';
      if (r.status === 'pending') {
        body = `طلب سحب بقيمة ${r.amount.toLocaleString()} ج.م ينتظر معالجة الإدارة الأولى.`;
      } else if (r.status === 'processing') {
        body = `طلب السحب بقيمة ${r.amount.toLocaleString()} ج.م جاري تحويله وتدقيقه الآن.`;
      } else if (r.status === 'accepted') {
        body = `تمت الموافقة على طلب سحب بقيمة ${r.amount.toLocaleString()} ج.م عبر ${r.method === 'bank' ? 'البنك' : 'محفظة الهاتف'}.`;
      } else if (r.status === 'rejected') {
        body = `تم رفض طلب سحب بقيمة ${r.amount.toLocaleString()} ج.م. أعيد المبلغ بالكامل لمحفظتكم لعدم مطابقة الشروط.`;
      }

      list.push({
        id: `w-${r.id}`,
        title: `طلب سحب رصيد`,
        body,
        date: r.date,
        type: 'سحب',
        status: r.status,
        amount: r.amount
      });
    });

    // 2. Add all completed or pending transactions
    (wallet?.transactions || []).forEach(t => {
      let title = t.category === 'wallet_charge' ? 'طلب شحن رصيد' : 
                  t.type === 'إيداع' ? 'حركة توريد / تحصيل' : 'حركة سحب / مصروف';
      
      let body = '';
      const amountStr = t.amount.toLocaleString();

      if (t.category === 'wallet_charge') {
        if (t.status === 'pending') {
          body = `طلب شحن رصيد بقيمة ${amountStr} ج.م بانتظار التحقق من الإيداع.`;
        } else if (t.status === 'completed') {
          body = `جرت بنجاح إضافة مبلغ شحن رصيد ${amountStr} ج.م إلى رصيدكم الأساسي.`;
        } else if (t.status === 'cancelled') {
          body = `تم رفض/إلغاء لطلب شحن الرصيد بقيمة ${amountStr} ج.م.`;
        }
      } else if (t.category === 'collection') {
        body = `تم إيداع مبلغ تحصيل طلب #${t.orderNumber || t.id} بقيمة ${amountStr} ج.م.`;
      } else if (t.category === 'manual_deposit') {
        body = `إيداع يدوي بقيمة ${amountStr} ج.م: ${t.note}`;
      } else if (t.category === 'manual_withdrawal') {
        body = `سحب يدوي بقيمة ${amountStr} ج.م: ${t.note}`;
      } else if (t.category?.startsWith('expense_')) {
        body = `صرف مصروفات التشغيل بقيمة ${amountStr} ج.م: ${t.note}`;
      } else {
        body = `${t.note || `عملية ${t.type} بقيمة ${amountStr} ج.م`}`;
      }

      list.push({
        id: `t-${t.id}`,
        title,
        body,
        date: t.date,
        type: t.type,
        status: t.status,
        amount: t.amount
      });
    });

    // Sort by date newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [wallet]);

  const filteredNotifications = useMemo(() => {
    if (financialFilter === 'all') return financialNotifications;
    if (financialFilter === 'with') return financialNotifications.filter(n => n.type === 'سحب');
    return financialNotifications.filter(n => n.type === 'إيداع');
  }, [financialNotifications, financialFilter]);

  const stats = useMemo(() => {
    let totalProfit = 0;
    let totalLoss = 0;
    let totalCOGS = 0;
    let totalShippingPaid = 0;
    let totalReturnedExpenses = 0;
    
    // Additional metrics for the new requested cards
    let awaitingDecisionCount = 0;
    let processingCount = 0;
    let outForDeliveryCount = 0;
    let awaitingPickupCount = 0;
    let headedToYouCount = 0;
    let successfulOrdersCount = 0;
    
    let actualCollection = 0;
    let expectedCollection = 0;

    let posSalesCount = 0;
    let websiteSalesCount = 0;
    let posRevenue = 0;
    let websiteRevenue = 0;

    let counts: Record<string, number> = {
      'في_انتظار_المكالمة': 0,
      'جاري_المراجعة': 0, 'قيد_التنفيذ': 0, 'تم_الارسال': 0, 'قيد_الشحن': 0,
      'تم_توصيلها': 0, 'تم_التوصيل': 0, 'تم_التحصيل': 0, 'مدفوعة': 0, 'مرتجع': 0, 'مرتجع_جزئي': 0,
      'فشل_التوصيل': 0, 'تمت_الاعادة_لشركة_الشحن': 0, 'ملغي': 0, 'مؤجل': 0, 'مجدول': 0
    };

    const getOrderCollectionAmount = (order: Order) => {
      if (!settings) return 0;
      const safeProductPrice = Number(order.productPrice) || 0;
      const safeShippingFee = Number(order.shippingFee) || 0;
      const safeTax = Number(order.tax) || 0;
      const safeDiscount = Number(order.discount) || 0;
      const safeAdvance = Number(order.advancePayment) || 0;
      
      const compFees = settings.companySpecificFees?.[order.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
      const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      const insuranceFee = (isPosOrder ? 0 : ((order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0));
      const inspectionFee = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
      const bostaVatFee = isPosOrder ? 0 : calculateBostaVat(order, insuranceFee, settings);
      
      const computedTotal = safeProductPrice + safeShippingFee + safeTax - safeDiscount - safeAdvance + inspectionFee;
      const totalAmount = order.totalAmountOverride != null ? Math.max(0, Math.round(Number(order.totalAmountOverride) - safeAdvance)) : computedTotal;
      const displayTotal = order.source === 'synced' && order.totalPrice != null ? Number(order.totalPrice) : totalAmount;
      return displayTotal;
    };

    (orders || []).forEach((o: Order) => {
      if (counts[o.status] !== undefined) counts[o.status]++;
      
      const isPos = o.channel === 'pos' || o.id.startsWith('POS-');
      const orderRevenue = getOrderCollectionAmount(o);

      if (isPos) {
          posSalesCount++;
          posRevenue += orderRevenue;
      } else {
          websiteSalesCount++;
          websiteRevenue += orderRevenue;
      }

      const { profit, loss } = calculateOrderProfitLoss(o, settings);
      totalProfit += profit;
      totalLoss += loss;

      const safeProductCost = getOrderProductCost(o, settings) || 0;
      const safeShippingFee = Number(o.shippingFee) || 0;

      // Mapping for the 8 requested cards
      if (o.status === 'جاري_المراجعة' || o.status === 'في_انتظار_المكالمة') {
          awaitingDecisionCount++;
      }
      if (o.status === 'قيد_التنفيذ') {
          processingCount++;
      }
      if (o.status === 'تم_الارسال' || o.status === 'قيد_الشحن') {
          outForDeliveryCount++;
      }
      
      if (o.status === 'مرتجع' || o.status === 'تمت_الاعادة_لشركة_الشحن' || o.status === 'فشل_التوصيل') {
          headedToYouCount++;
          totalReturnedExpenses += loss;
      }
      
      if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة' || o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل') {
          successfulOrdersCount++;
          actualCollection += orderRevenue;
          totalCOGS += safeProductCost;
          totalShippingPaid += safeShippingFee;
      } else if (!['ملغي', 'مرتجع', 'فشل_التوصيل'].includes(o.status)) {
          expectedCollection += orderRevenue;
      }
    });

    const cancelledCount = counts['ملغي'] || 0;
    const returnedCount = (counts['مرتجع'] || 0) + (counts['مرتجع_جزئي'] || 0) + (counts['تمت_الاعادة_لشركة_الشحن'] || 0);
    const failedCount = counts['فشل_التوصيل'] || 0;
    const delayedCount = (counts['مؤجل'] || 0) + (counts['مجدول'] || 0);

    // Logical fallback for "Awaiting Pickup" based on custom preparation status if available
    awaitingPickupCount = (orders || []).filter(o => o.status === 'قيد_التنفيذ' && (o as any).preparationStatus === 'بانتظار التجهيز').length;

    // Financial calculations for Inventory Value
    const totalInventoryValue = (settings?.products || []).reduce((acc, p) => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        return acc + p.variants.reduce((vAcc, v) => {
          const stock = v.stockQuantity ?? v.stock ?? 0;
          const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
          return vAcc + (stock * cost);
        }, 0);
      } else {
        const stock = p.stockQuantity ?? p.stock ?? 0;
        const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
        return acc + (stock * cost);
      }
    }, 0);

    // Liquid cash calculation - Exclude supply wallet transactions to avoid double counting
    const cashBalance = (wallet?.transactions || []).reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        if (t.details?.paidByPartnerId) return sum;
        
        // Exclude supply wallet categories from liquid cash
        const category = t.category || '';
        const isSupplyTx = ['supply_deposit', 'supply_purchase', 'supply_funding', 'partner_supply', 'supply_expense_shipping', 'supply_expense_other'].includes(category);
        if (isSupplyTx) return sum;

        if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
        if (t.type === 'سحب') return t.status === 'cancelled' ? sum : sum - amount;
        return sum;
    }, 0);

    const treasuryTotal = (treasury?.accounts || []).reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const workingCapital = treasuryTotal + (wallet?.supplyBalance || 0) + totalInventoryValue;

    // Calculate Admin & Operational Expenses
    const adminExpenses = (wallet?.transactions || [])
      .filter(t => {
        const isExpenseCategory = t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_') || (settings?.expenseCategories || []).includes(t.category || '');
        const isManualWithdrawal = t.category === 'manual_withdrawal';
        const isNotPartnerTx = !t.note?.includes('معاملة شريك');
        return t.type === 'سحب' && (isExpenseCategory || isManualWithdrawal) && isNotPartnerTx;
      })
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Calculate Partner Capital Contributions (Total Investment)
    const totalCapital = (settings?.partnerTransactions || [])
        .filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const bankBalance = (treasury?.accounts || []).filter(a => a.type === 'bank').reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const safeBalance = (treasury?.accounts || []).filter(a => a.type === 'safe').reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const digitalWalletBalance = (treasury?.accounts || []).filter(a => a.type === 'wallet').reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    // 💡 Pro KPI Calculations
    const totalOrdersCount = (orders || []).length;
    const deliveryRate = totalOrdersCount > 0 ? (successfulOrdersCount / totalOrdersCount) * 100 : 0;
    const aov = successfulOrdersCount > 0 ? (actualCollection / successfulOrdersCount) : 0;
    const cancellationRate = totalOrdersCount > 0 ? (cancelledCount / totalOrdersCount) * 100 : 0;
    const returnRate = totalOrdersCount > 0 ? (returnedCount / totalOrdersCount) * 100 : 0;

    // Calculate Receivables (Credit Sales from POS)
    const posReceivables = (settings?.posSales || [])
        .filter(s => s.cashHolderId === 'credit')
        .reduce((sum, s) => sum + s.totalAmount, 0);

    // Calculate Total Distributed Custody
    const totalCustodyBalance = (settings?.cashHolders || [])
        .reduce((sum, h) => sum + (h.currentBalance || 0), 0);

    // Build unique customer set
    const uniqueCustomerCount = (orders || []).reduce((acc, o) => {
      const clean = (o.customerPhone || '').trim();
      if (clean) acc.add(clean);
      return acc;
    }, new Set<string>()).size;

    // Calculate Revenue vs Expenses for the last 6 months
    const financeHistory = (() => {
       const months = [];
       for (let i = 5; i >= 0; i--) {
         const d = new Date();
         d.setDate(1); // Set to 1st to avoid month rolling issues
         d.setMonth(d.getMonth() - i);
         months.push({
           name: d.toLocaleString('ar-EG', { month: 'short' }),
           key: `${d.getMonth()}-${d.getFullYear()}`,
           revenue: 0,
           expenses: 0
         });
       }

       // Simple month-based revenue aggregation
       (orders || []).forEach(o => {
         const isSuccessful = ['تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'تم_الاستلام'].includes(o.status);
         if (isSuccessful) {
            const d = new Date(o.date);
            const key = `${d.getMonth()}-${d.getFullYear()}`;
            const m = months.find(item => item.key === key);
            if (m) m.revenue += getOrderCollectionAmount(o);
         }
       });

       // Simple month-based expense aggregation
       (wallet.transactions || []).forEach(t => {
         const isExpense = t.type === 'سحب' && (t.category?.startsWith('expense_') || t.category === 'manual_withdrawal');
         if (isExpense) {
            const d = new Date(t.date);
            const key = `${d.getMonth()}-${d.getFullYear()}`;
            const m = months.find(item => item.key === key);
            if (m) m.expenses += t.amount;
         }
       });

       return months;
    })();

    // Calculate Dead Stock (Products with high stock but no sales in last 30 days)
    const deadStockCount = (settings?.products || []).filter(p => {
        const stock = (p.stockQuantity || 0);
        if (stock < 5) return false; // low stock is not "dead" in this context
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const hasRecentSales = (orders || []).some(o => 
            o.status !== 'ملغي' && 
            new Date(o.date) >= thirtyDaysAgo && 
            (o.items || []).some(item => item.productId === p.id)
        );
        
        return !hasRecentSales;
    }).length;

    // Calculate Liquidity Coverage (Cash / Avg Monthly Expenses)
    const avgMonthlyExpense = adminExpenses / Math.max((orders.length > 0 ? (new Date().getTime() - new Date(orders[0].date).getTime()) / (1000 * 60 * 60 * 24 * 30) : 1), 1);
    const liquidityCoverage = avgMonthlyExpense > 0 ? (cashBalance / avgMonthlyExpense).toFixed(1) : '∞';

    // Top Selling Products logic
    const topProducts = (settings?.products || []).map(p => {
        const salesCount = (orders || []).filter(o => 
            ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status) &&
            (o.items || []).some(item => item.productId === p.id)
        ).length;
        return { ...p, salesCount };
    }).sort((a, b) => b.salesCount - a.salesCount).slice(0, 5);

    // New Financial Metrics & Consolidation
    // Calculate POS Profit/COGS for sales that are NOT in the orders list
    let extraPosProfit = 0;
    let extraPosCOGS = 0;
    const extraPosSales = (settings?.posSales || []).filter(s => !(orders || []).some(o => o.id === s.id || o.orderNumber === s.saleNumber));
    
    extraPosSales.forEach(s => {
        (s.items || []).forEach(item => {
            const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
            extraPosCOGS += (cost * (item.quantity || 1));
            extraPosProfit += ((item.price - cost) * (item.quantity || 1));
        });
    });

    const finalRevenue = actualCollection + extraPosSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const finalCOGS = totalCOGS + extraPosCOGS;
    const finalProfit = totalProfit + extraPosProfit;
    const finalSuccessfulCount = successfulOrdersCount + extraPosSales.length;
    
    // Gross Profit (Product Margin) = Revenue - Product Cost (COGS)
    // This represents the direct profit from products before shipping and fees, now including shipping markups and rounding markups
    const grossProfit = (orders || []).filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status)).reduce((sum, o) => {
        const itemProfit = (o.items || []).reduce((iSum, item) => {
            const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
            return iSum + ((item.price - cost) * (item.quantity || 1));
        }, 0);

        const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر';
        const standardShipping = isPosOrder ? 0 : getStandardShippingFee(o, settings);
        const shippingMarkup = isPosOrder ? 0 : Math.max(0, o.shippingFee - standardShipping);

        const safeProductPrice = Number(o.productPrice) || 0;
        const safeShippingFee = Number(o.shippingFee) || 0;
        const safeDiscount = Number(o.discount) || 0;
        const baseTotalExpected = safeProductPrice + safeShippingFee - safeDiscount;

        return sum + itemProfit + shippingMarkup;
    }, 0) + extraPosProfit;
    
    const supplierDebt = (settings?.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);
    const shippingReceivables = (orders || [])
        .filter(o => (o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل' || o.status === 'مدفوعة' || o.status === 'قيد_الشحن') && !o.collectionProcessed)
        .reduce((sum, o) => sum + getOrderCollectionAmount(o), 0);
    
    const netAvailableLiquidity = (treasuryTotal || 0) - supplierDebt;
    const netProfit = finalProfit - totalLoss - adminExpenses;
    
    const roi = totalCapital > 0 ? (netProfit / totalCapital) * 100 : 0;
    const expenseRatio = finalRevenue > 0 ? (adminExpenses / finalRevenue) * 100 : 0;
    const grossMarginPercentage = finalRevenue > 0 ? (grossProfit / finalRevenue) * 100 : 0;
    const netMarginPercentage = finalRevenue > 0 ? (netProfit / finalRevenue) * 100 : 0;
    const netMargin = Math.round(netMarginPercentage * 10) / 10;
    
    // Revenue Growth (Current month vs Previous month)
    const currentMonthKey = `${new Date().getMonth()}-${new Date().getFullYear()}`;
    const previousMonth = new Date();
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const prevMonthKey = `${previousMonth.getMonth()}-${previousMonth.getFullYear()}`;
    const currentMonthRevenue = (financeHistory.find(m => m.key === currentMonthKey)?.revenue || 0);
    const prevMonthRevenue = (financeHistory.find(m => m.key === prevMonthKey)?.revenue || 0);
    const revenueGrowth = prevMonthRevenue > 0 ? ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

    // Top Customers Calculation
    const customerMap = new Map();
    (orders || []).forEach(o => {
      if (!['ملغي', 'مرفوض'].includes(o.status)) {
        const key = o.customerPhone || o.customerName;
        if (key) {
           const current = customerMap.get(key) || { id: key, name: o.customerName, phone: o.customerPhone, totalSpend: 0, ordersCount: 0 };
           current.totalSpend += getOrderCollectionAmount(o);
           current.ordersCount += 1;
           customerMap.set(key, current);
        }
      }
    });
    const topCustomers = Array.from(customerMap.values())
      .sort((a: any, b: any) => b.totalSpend - a.totalSpend)
      .slice(0, 5);

    const inventoryValue = (settings?.products || []).reduce((sum, p) => sum + (Number(p.costPrice || 0) * Number(p.stock || 0)), 0);

    const productSalesMap = new Map();
    (orders || []).forEach(o => {
        if (!['ملغي', 'مرتجع', 'فشل_التوصيل'].includes(o.status)) {
            (o.items || []).forEach(item => {
                const current = productSalesMap.get(item.productId) || { id: item.productId, name: item.name, quantity: 0, revenue: 0 };
                current.quantity += (item.quantity || 1);
                current.revenue += (item.price * (item.quantity || 1));
                productSalesMap.set(item.productId, current);
            });
        }
    });
    const topSellingProducts = Array.from(productSalesMap.values())
        .sort((a: any, b: any) => b.quantity - a.quantity)
        .slice(0, 5);

    const funnel = {
        pending: (orders || []).filter(o => o.status === 'جاري_المراجعة' || o.status === 'في_انتظار_المكالمة').length,
        confirmed: (orders || []).filter(o => o.status === 'قيد_التنفيذ' || o.status === 'تم_الارسال').length,
        shipping: (orders || []).filter(o => o.status === 'قيد_الشحن').length,
        delivered: (orders || []).filter(o => o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل' || o.status === 'مدفوعة').length,
        collected: (orders || []).filter(o => o.status === 'تم_التحصيل').length
    };

    const avgProfitPerOrder = finalSuccessfulCount > 0 ? netProfit / finalSuccessfulCount : 0;

    return { 
      net: netProfit, 
      adminExpenses,
      totalCapital,
      counts, 
      total: totalOrdersCount,
      awaitingDecisionCount,
      processingCount,
      outForDeliveryCount,
      awaitingPickupCount,
      headedToYouCount,
      successfulOrdersCount: finalSuccessfulCount,
      actualCollection: finalRevenue,
      expectedCollection,
      totalCOGS: finalCOGS,
      totalShippingPaid,
      totalReturnedExpenses,
      totalInventoryValue,
      workingCapital,
      posSalesCount,
      websiteSalesCount,
      posRevenue,
      websiteRevenue,
      cancelledCount,
      returnedCount,
      failedCount,
      delayedCount,
      // Pro metrics
      deliveryRate,
      aov,
      cancellationRate,
      returnRate,
      netMargin,
      uniqueCustomerCount,
      posReceivables,
      totalCustodyBalance,
      financeHistory,
      deadStockCount,
      liquidityCoverage,
      topProducts: topSellingProducts,
      totalRevenue: finalRevenue,
      grossProfit,
      roi,
      expenseRatio,
      supplierDebt,
      shippingReceivables,
      grossMarginPercentage,
      netMarginPercentage,
      revenueGrowth,
      treasuryTotal,
      bankBalance,
      safeBalance,
      digitalWalletBalance,
      netAvailableLiquidity,
      topCustomers,
      inventoryValue,
      funnel,
      avgProfitPerOrder
    };
  }, [orders, settings, wallet, treasury]);

  const channelData = [
    { name: 'مبيعات الكاشير (POS)', value: stats.posRevenue, color: '#6366f1' },
    { name: 'مبيعات الأونلاين', value: stats.websiteRevenue, color: '#10b981' }
  ].filter(d => d.value > 0);

  const chartData = [
    { name: 'بانتظار مكالمة', value: stats.counts['في_انتظار_المكالمة'] || 0, color: '#06b6d4' },
    { name: 'مراجعة', value: stats.counts['جاري_المراجعة'] || 0, color: '#a855f7' },
    { name: 'تحصيل', value: (stats.counts['تم_التحصيل'] || 0) + (stats.counts['مدفوعة'] || 0), color: '#22c55e' },
    { name: 'مرتجع', value: (stats.counts['مرتجع'] || 0) + (stats.counts['فشل_التوصيل'] || 0) + (stats.counts['تمت_الاعادة_لشركة_الشحن'] || 0), color: '#ef4444' },
    { name: 'في الطريق', value: (stats.counts['قيد_الشحن'] || 0) + (stats.counts['تم_الارسال'] || 0), color: '#0ea5e9' },
    { name: 'مؤجل/مجدول', value: (stats.counts['مؤجل'] || 0) + (stats.counts['مجدول'] || 0), color: '#6366f1' }
  ];

  const lowStockProducts = (settings?.products || []).filter(p => (p.stockQuantity ?? 0) < 5);

  return (
    <motion.div 
      className="space-y-8 pb-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Platform Level Announcement Banner */}
      {announcementText && (
        <motion.div 
          variants={itemVariants}
          className={`p-4 rounded-3xl border flex items-center justify-between gap-4 transition-all ${
            announcementType === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-200'
              : announcementType === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200'
              : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/40 text-indigo-800 dark:text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {announcementType === 'warning' ? (
              <AlertTriangle className="text-amber-500 animate-pulse shrink-0" size={20} />
            ) : announcementType === 'error' ? (
              <ShieldAlert className="text-rose-500 shrink-0" size={20} />
            ) : (
              <AlertCircle className="text-indigo-500 shrink-0" size={20} />
            )}
            <div>
              <span className="text-xs font-black leading-relaxed">{announcementText}</span>
            </div>
          </div>
          <button 
            onClick={handleDismissAnnouncement}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2 sm:mb-3">
            أهلاً بك، {currentUser?.fullName.split(' ')[0]} 👋
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              متجرك نشط
            </span>
            <span className="text-[10px] sm:text-sm">تحديث: منذ دقيقتين</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:flex items-center gap-3">
          <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/store-preview`} className="glass-card px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
            <PlayCircle size={16} className="text-primary" />
            <span>معاينة</span>
          </Link>
          <button className="bg-primary text-white px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            إضافة منتج
          </button>
        </div>
      </motion.div>

      {/* AI Smart Assistant Banner */}
      <motion.div variants={itemVariants}>
        <SmartSuggestions orders={orders} settings={settings} />
      </motion.div>

      {/* 📊 E-commerce Pro KPIs Hub */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-primary" size={18} />
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">مؤشرات الأداء كفاءة المتجر (KPIs)</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* KPI 1: Delivery success rate */}
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all text-right font-sans">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full font-black">
                أداء الشحن
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black">معدل نجاح التسليم النهائي (Delivery Rate)</p>
            <div className="mt-2 flex items-baseline gap-2 justify-start" dir="rtl">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">{stats.deliveryRate}%</span>
              <span className="text-[10px] text-slate-400 font-bold">من إجمالي الطلبات</span>
            </div>
            {/* Miniature visual bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-4">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.deliveryRate > 75 
                    ? 'bg-emerald-500' 
                    : stats.deliveryRate > 50 
                    ? 'bg-amber-500' 
                    : 'bg-rose-500'
                }`}
                style={{ width: `${stats.deliveryRate}%` }}
              ></div>
            </div>
          </div>

          {/* KPI 2: Average Order Value */}
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all text-right font-sans">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <DollarSign size={20} />
              </div>
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-2.5 py-1 rounded-full font-black">
                المعدل التجاري
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black">متوسط قيمة السلة الشرائية (AOV)</p>
            <div className="mt-2 flex items-baseline gap-2 justify-start" dir="rtl">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">{stats.aov.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</span>
              <span className="text-xs font-black text-slate-400">ج.م / طلب</span>
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-3.5">
              💡 اقتراح: إعرض باقات مكملة لزيادة حجم السلة الشرائية.
            </p>
          </div>

          {/* KPI 3: Net Profit Margin */}
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-cyan-500/40 transition-all text-right font-sans">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-xl">
                <ChartIcon size={20} />
              </div>
              <span className="text-[10px] bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 px-2.5 py-1 rounded-full font-black">
                صحة الهامش
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black">هامش صافي ربح المتجر (Profit Margin)</p>
            <div className="mt-2 flex items-baseline gap-2 justify-start" dir="rtl">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">{stats.netMargin}%</span>
              <span className="text-[10px] text-slate-400 font-bold">من إجمالي المبيعات</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-4">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.netMargin > 30 
                    ? 'bg-emerald-500' 
                    : stats.netMargin > 15 
                    ? 'bg-cyan-500' 
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.max(stats.netMargin, 0)}%` }}
              ></div>
            </div>
          </div>

          {/* KPI 4: Active unique customers */}
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all text-right font-sans">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
                <Users2 size={20} />
              </div>
              <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2.5 py-1 rounded-full font-black">
                العملاء الفريدين
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black">قاعدة العملاء الفريدين (Unique Customers)</p>
            <div className="mt-2 flex items-baseline gap-2 justify-start" dir="rtl">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">{stats.uniqueCustomerCount}</span>
              <span className="text-xs font-bold text-slate-400">عميل فعال</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-3">
              🔁 معدل الشراء المتكرر: {(stats.successfulOrdersCount > 0 && stats.uniqueCustomerCount > 0 ? (stats.successfulOrdersCount / stats.uniqueCustomerCount).toFixed(1) : 1)}x لكل عميل
            </p>
          </div>

          {/* New KPI 5: POS Receivables */}
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-orange-500/40 transition-all text-right font-sans">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-orange-500/5 rounded-full blur-xl group-hover:bg-orange-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-xl">
                <AlertCircle size={20} />
              </div>
              <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-2.5 py-1 rounded-full font-black">
                مديونيات الكاشير
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black">مبيعات الكاشير الآجلة (Receivables)</p>
            <div className="mt-2 flex items-baseline gap-2 justify-start" dir="rtl">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">{stats.posReceivables.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400">ج.م مُعلق</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-3">
              ⚠️ مبالغ لدى العملاء لم يتم تحصيلها بعد في الفترات الحالية.
            </p>
          </div>

          {/* New KPI 6: Distributed Custody */}
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all text-right font-sans">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                <ShoppingBag size={20} />
              </div>
              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-full font-black">
                العهد الموزعة
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black">إجمالي المبالغ بعهدة الموظفين (In Custody)</p>
            <div className="mt-2 flex items-baseline gap-2 justify-start" dir="rtl">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">{stats.totalCustodyBalance.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400">ج.م نقدية</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-3">
              💰 مبالغ "خارج" الخزينة الرئيسية في انتظار التوريد اليدوي.
            </p>
          </div>

          {/* New KPI 7: Liquidity Coverage */}
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all text-right font-sans">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                <RefreshCcw size={20} />
              </div>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-full font-black">
                قدرة السداد
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black">معامل السيولة (Liquidity Months)</p>
            <div className="mt-2 flex items-baseline gap-2 justify-start" dir="rtl">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">{stats.liquidityCoverage}</span>
              <span className="text-xs font-bold text-slate-400">شهور تغطية</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-3">
              📊 عدد الشهور التي تكفيها السيولة الحالية للمصاريف الإدارية.
            </p>
          </div>

          {/* New KPI 8: Dead Stock */}
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-850 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-all text-right font-sans">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-colors" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
                <X size={20} />
              </div>
              <span className="text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 px-2.5 py-1 rounded-full font-black">
                المخزون الساكن
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black">إصناف لم تُبع آخر 30 يوم (Dead Stock)</p>
            <div className="mt-2 flex items-baseline gap-2 justify-start" dir="rtl">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-sans">{stats.deadStockCount}</span>
              <span className="text-xs font-bold text-slate-400">صنف راكد</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-3">
              🥀 أصناف عالية المخزون ولكنها لا تحقق مبيعات حالية.
            </p>
          </div>
        </div>
      </motion.div>

      {/* 🔄 Pipeline and tracking */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="text-indigo-500" size={18} />
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">دورة حياة المبيعات وحالات الطلبات اليومية</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 font-sans">
          <DashboardStatusCard title="الأوردرات الناجحة" value={`${stats.successfulOrdersCount} / ${stats.total}`} color="text-emerald-600" />
          <DashboardStatusCard title="في إنتظار قرارك" value={stats.awaitingDecisionCount} color="text-orange-500" />
          <DashboardStatusCard title="متجه للعميل" value={stats.outForDeliveryCount} color="text-blue-600" />
          <DashboardStatusCard title="قيد التنفيذ" value={stats.processingCount} color="text-purple-600" />
          <DashboardStatusCard title="التحصيل المتوقع" value={`${(stats.expectedCollection).toLocaleString()} ج.م`} color="text-indigo-600" />
          <DashboardStatusCard title="التحصيل الفعلي" value={`${(stats.actualCollection).toLocaleString()} ج.م`} color="text-emerald-500" />
        </div>

        <motion.div 
          initial={false}
          animate={{ height: showDetailedStats ? 'auto' : 0, opacity: showDetailedStats ? 1 : 0 }}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
            <DashboardStatusCard title="المرتجعات" value={stats.returnedCount} color="text-rose-600" />
            <DashboardStatusCard title="فشل التوصيل" value={stats.failedCount} color="text-red-500" />
            <DashboardStatusCard title="ملغي" value={stats.cancelledCount} color="text-slate-500" />
            <DashboardStatusCard title="مؤجل ومجدول" value={stats.delayedCount} color="text-amber-500" />
            <DashboardStatusCard title="في انتظار الاستلام" value={stats.awaitingPickupCount} color="text-slate-700" />
            <DashboardStatusCard title="متجه إليك" value={stats.headedToYouCount} color="text-rose-500" />
          </div>
        </motion.div>

        {/* Toggle button moved below the grid */}
        <div className="flex justify-center pt-2">
          <button 
            type="button"
            onClick={() => setShowDetailedStats(!showDetailedStats)}
            className="group flex items-center gap-2 px-6 py-1.5 rounded-full border border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            {showDetailedStats ? (
              <>
                <ArrowDown className="text-primary rotate-180 transition-transform" size={12} />
                <span>إخفاء الحالات الإضافية</span>
              </>
            ) : (
              <>
                <Layers className="text-primary group-hover:animate-bounce" size={12} />
                <span>عرض كافة حالات الطلبات</span>
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Main Stats - Optimized Layout */}
        <motion.div variants={itemVariants} className="md:col-span-8 glass-card p-10 rounded-[2.5rem] relative overflow-hidden group border-primary/5 shadow-xl shadow-slate-200/40 dark:shadow-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-colors" />
          
          <div className="relative z-10 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-6 text-right">
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                  <TrendingUp className="text-primary p-1.5 bg-primary/10 rounded-xl" size={32} />
                  الأداء المالي (Financial Performance)
                </h3>
                <p className="text-sm font-bold text-slate-400">تحليل الميزانية، الأرباح، والتدفقات النقدية اللحظية</p>
              </div>
               <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                    <span className="px-4 py-2 text-xs font-black text-slate-500">الفترة:</span>
                    <select className="bg-white dark:bg-slate-700 text-xs font-black px-4 py-2 rounded-xl outline-none shadow-sm cursor-pointer">
                      <option>آخر 7 أيام</option>
                      <option>الشهر الحالي</option>
                    </select>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowDetailedFinancials(!showDetailedFinancials)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black hover:bg-primary/20 transition-all border border-primary/10"
                  >
                    <ChartIcon size={14} />
                    <span>{showDetailedFinancials ? 'تقليل العرض' : 'تحليلات تفصيلية'}</span>
                  </button>
               </div>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 ${showDetailedFinancials ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6 transition-all duration-500`}>
              {/* صافي الأرباح */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <DollarSign size={16} className="text-primary" />
                  <span>صافي الأرباح (Net Profit)</span>
                </p>
                <h4 className={`text-2xl sm:text-3xl font-black tabular-nums ${stats.net >= 0 ? 'text-primary' : 'text-rose-500'}`}>
                  {stats.net.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${stats.revenueGrowth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {stats.revenueGrowth >= 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}%
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold">نمو المبيعات</p>
                </div>
              </div>

              {/* مجمل الأرباح */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <ShoppingBag size={16} className="text-emerald-500" />
                  <span>مجمل الربح (Gross Profit)</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">الأرباح قبل خصم المصاريف التشغيلية</p>
              </div>

              {/* هامش صافي الربح */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <Percent size={16} className="text-emerald-500" />
                  <span>هامش صافي الربح</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.netMarginPercentage.toFixed(1)}%
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">نسبة الأرباح النهائية من إجمالي المبيعات</p>
              </div>

              {/* ROI */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <ArrowUpLeft size={16} className="text-indigo-500" />
                  <span>ROI (Return on Investment)</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {stats.roi.toFixed(1)}%
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">كفاءة العائد على رأس المال المستثمر</p>
              </div>

              {/* قيمة المخزون الحالية */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <Layers size={16} className="text-amber-500" />
                  <span>قيمة المخزون (Stock Value)</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tabular-nums">
                  {stats.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">إجمالي تكلفة البضاعة الموجودة بالمستودعات</p>
              </div>

              {/* متوسط الأرباح لكل طلب */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-xs font-black text-slate-550 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-cyan-500" />
                  <span>صافي الربح / طلب</span>
                </p>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tabular-nums">
                  {stats.avgProfitPerOrder.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-bold">متوسط الربح الصافي المحقق من كل طلب ناجح</p>
              </div>
            </div>

            {/* Expanded Analytical Grid */}
            <motion.div 
              initial={false}
              animate={{ height: showDetailedFinancials ? 'auto' : 0, opacity: showDetailedFinancials ? 1 : 0 }}
              className="overflow-hidden"
            >
               <div className="pt-8 mt-8 border-t border-slate-100 dark:border-slate-800/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 mb-1">رأس المال العامل</p>
                    <h5 className="text-sm font-black text-slate-800 dark:text-white">{stats.workingCapital.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</h5>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 mb-1">إجمالي الاستثمارات</p>
                    <h5 className="text-sm font-black text-slate-800 dark:text-white">{stats.totalCapital.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</h5>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 mb-1">تكلفة البضاعة COGS</p>
                    <h5 className="text-sm font-black text-slate-800 dark:text-white">{stats.totalCOGS.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</h5>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 mb-1">مصاريف التشغيل</p>
                    <h5 className="text-sm font-black text-rose-500">{stats.adminExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</h5>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 mb-1">ديون الموردين</p>
                    <h5 className="text-sm font-black text-rose-600">{stats.supplierDebt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</h5>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 mb-1">صافي السيولة المتاحة</p>
                    <h5 className="text-sm font-black text-emerald-500">{stats.netAvailableLiquidity.toLocaleString()} ج.م</h5>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 mb-1">معدل الارتجاع (Return)</p>
                    <h5 className="text-sm font-black text-orange-500">{stats.returnRate.toFixed(1)}%</h5>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 mb-1">إصناف راكدة (Dead Stock)</p>
                    <h5 className="text-sm font-black text-rose-500">{stats.deadStockCount} صنف</h5>
                  </div>
                  <div className="col-span-full mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between">
                       <p className="text-[10px] font-black text-primary">تحليل السيولة النقدية والتدفق:</p>
                       <span className="text-[10px] font-black text-slate-500">معامل التغطية: {stats.liquidityCoverage} شهر</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                       <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(Number(stats.liquidityCoverage) * 10, 100)}%` }} />
                    </div>
                  </div>
               </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Growth & Liquidity Insights - Filling the 4-span space */}
        <motion.div variants={itemVariants} className="md:col-span-4 glass-card p-10 rounded-[2.5rem] border-primary/5 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative z-10 font-sans">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 italic">النمو والسيولة</h3>
              <Sparkles className="text-amber-500" size={18} />
            </div>
            <p className="text-xs text-slate-400 font-bold mb-8">تحليل التدفق النقدي ومعدلات النمو الشهري</p>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.financeHistory}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)', direction: 'rtl' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 6" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4 pt-6 relative z-10 font-sans">
             <div className="flex justify-between items-center text-xs font-black">
                <span className="text-slate-500">إجمالي الإيرادات:</span>
                <span className="text-slate-800 dark:text-white">{stats.totalRevenue.toLocaleString()} ج.م</span>
             </div>
             <div className="flex justify-between items-center text-xs font-black">
                <span className="text-slate-500">صافي المبيعات (نقد):</span>
                <span className="text-emerald-500">+{stats.actualCollection.toLocaleString()} ج.م</span>
             </div>
             <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
             <div className="flex justify-between items-center text-xs font-black">
                <span className="text-slate-500">كفاءة الإنفاق (Expense Ratio):</span>
                <span className={`px-2 py-0.5 rounded-full ${stats.expenseRatio < 25 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {stats.expenseRatio.toFixed(1)}%
                </span>
             </div>
          </div>
        </motion.div>
      </div>

        {/* Sales Funnel & Lifecycle - NEW SECTION */}
        <motion.div variants={itemVariants} className="md:col-span-12 glass-card p-8 rounded-3xl mb-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Layers size={20} className="text-indigo-500" />
              مراحل دورة المبيعات (Sales Funnel)
            </h3>
            <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full">مباشر</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
               <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                 <Clock size={16} className="text-slate-500" />
               </div>
               <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">قيد المراجعة</p>
               <p className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">{stats.funnel.pending}</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/40 flex flex-col items-center text-center">
               <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800/30 flex items-center justify-center mb-3">
                 <Check size={16} className="text-blue-500" />
               </div>
               <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">تم التأكيد</p>
               <p className="text-2xl font-black text-blue-700 dark:text-blue-400 tabular-nums">{stats.funnel.confirmed}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/40 flex flex-col items-center text-center">
               <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center mb-3">
                 <Truck size={16} className="text-amber-500" />
               </div>
               <p className="text-[10px] font-bold text-amber-500 uppercase mb-1">قيد الشحن</p>
               <p className="text-2xl font-black text-amber-700 dark:text-amber-400 tabular-nums">{stats.funnel.shipping}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/40 flex flex-col items-center text-center">
               <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center mb-3">
                 <ShieldAlert size={16} className="text-emerald-500" />
               </div>
               <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">تم التوصيل</p>
               <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{stats.funnel.delivered}</p>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/40 flex flex-col items-center text-center">
               <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-800/30 flex items-center justify-center mb-3">
                 <DollarSign size={16} className="text-indigo-500" />
               </div>
               <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1">تم التحصيل</p>
               <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400 tabular-nums">{stats.funnel.collected}</p>
            </div>
          </div>
        </motion.div>

        {/* Monthly Performance & Top Customers - Bento Layout */}
        <div className="md:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Monthly Sales & Profit Trends Chart */}
          <motion.div variants={itemVariants} className="lg:col-span-8 glass-card p-8 rounded-3xl min-h-[400px]">
            <div className="flex items-center justify-between mb-8 text-right">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">تحليل الأداء الشهري</h3>
                <p className="text-xs text-slate-500">مقارنة الإيرادات مقابل المصاريف وللأرباح</p>
              </div>
              <TrendingUp size={20} className="text-emerald-500" />
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.financeHistory}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 700}} 
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      backdropFilter: 'blur(10px)',
                      border: 'none',
                      borderRadius: '16px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name="الإيرادات"
                    stroke="#6366f1" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="profit" 
                    name="الأرباح"
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Top Customers Section */}
          <motion.div variants={itemVariants} className="lg:col-span-4 glass-card p-8 rounded-3xl flex flex-col">
            <div className="flex items-center justify-between mb-8 text-right">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">العملاء المميزون (V.I.P)</h3>
              <Users2 size={20} className="text-indigo-500" />
            </div>
            <div className="space-y-4 flex-1">
              {stats.topCustomers.map((customer: any) => (
                <div key={customer.id} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black">
                      {stats.topCustomers.indexOf(customer) + 1}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate max-w-[100px]">{customer.name || 'عميل مجهول'}</p>
                      <p className="text-[10px] font-bold text-slate-400">{customer.ordersCount} طلبات شراء </p>
                    </div>
                  </div>
                  <div className="text-left font-black text-emerald-600 text-sm">
                    {customer.totalSpend.toLocaleString()} <span className="text-[9px]">ج.م</span>
                  </div>
                </div>
              ))}
              {stats.topCustomers.length === 0 && (
                 <div className="text-center py-10 text-slate-400 italic text-sm">لا توجد بيانات عملاء كافية</div>
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/customers`} className="flex items-center justify-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors">
                <span>عرض قائمة العملاء بالكامل</span>
                <ArrowLeft size={14} />
              </Link>
            </div>
          </motion.div>

          {/* Top Products Performance */}
          <motion.div variants={itemVariants} className="lg:col-span-12 glass-card p-8 rounded-3xl mt-6">
            <div className="flex items-center justify-between mb-8 text-right">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">المنتجات الأكثر مبيعاً</h3>
              <div className="flex items-center gap-4">
                 <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/products`} className="text-xs font-bold text-primary hover:underline">إدارة المخزون</Link>
                 <Sparkles size={20} className="text-amber-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {stats.topProducts.map((product: any, idx: number) => (
                <div key={product.id || idx} className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-3">
                     <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                     <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{product.name}</p>
                  </div>
                  <div className="flex items-center justify-between">
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">مباع</p>
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{product.quantity} قطعة</p>
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">إيراد</p>
                        <p className="text-sm font-black text-slate-800 dark:text-white tabular-nums">{product.revenue.toLocaleString()} <span className="text-[9px]">ج.م</span></p>
                     </div>
                  </div>
                </div>
              ))}
              {stats.topProducts.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400 italic text-sm">لا توجد بيانات مبيعات منتجات كافية</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Status Distribution & Analytics - Modern Bento Grid */}
        <motion.div variants={itemVariants} className="md:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-8 rounded-3xl border-primary/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">توزيع الطلبات حسب الحالة</h3>
              <ChartIcon size={20} className="text-slate-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center h-[300px]">
              <div className="md:col-span-5 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} className="outline-none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                        backdropFilter: 'blur(10px)',
                        border: 'none',
                        borderRadius: '16px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="md:col-span-7">
                <StatusDistribution data={chartData} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 glass-card p-8 rounded-3xl border-indigo-500/10">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center justify-between">
              ملخص السيولة
              <WalletIcon size={18} className="text-indigo-500" />
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">السيولة النقدية (كاش ومحافظ)</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{(stats.safeBalance + stats.digitalWalletBalance).toLocaleString()} <span className="text-xs">ج.م</span></p>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase mb-1">الأرصدة البنكية</p>
                <p className="text-xl font-black text-blue-700 dark:text-blue-300">{stats.bankBalance.toLocaleString()} <span className="text-xs">ج.م</span></p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">المجموع الكلي بالحسابات</p>
                <p className="text-xl font-black text-slate-800 dark:text-white">{stats.treasuryTotal.toLocaleString()} <span className="text-xs">ج.م</span></p>
              </div>
              <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/treasury`} className="block text-center text-xs font-black text-primary hover:underline pt-2">عرض كافة الخزائن</Link>
            </div>
          </div>
        </motion.div>

        {/* Channel Breakdown - ONLY SHOW IF POS DATA EXISTS */}
        {channelData.length > 1 && (
          <motion.div variants={itemVariants} className="md:col-span-6 glass-card p-8 rounded-3xl min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">تحليل قنوات البيع (Online vs POS)</h3>
              <Monitor size={20} className="text-indigo-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 h-full items-center">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                {channelData.map(item => (
                  <div key={item.name} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-bold text-slate-500">{item.name}</span>
                    </div>
                    <p className="text-xl font-black text-slate-800 dark:text-white">{item.value.toLocaleString()} ج.م</p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {item.name.includes('POS') ? `${stats.posSalesCount} فاتورة` : `${stats.websiteSalesCount} طلب`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Financial Alerts & Team Performance */}
        <motion.div variants={itemVariants} className="md:col-span-12 glass-card p-8 rounded-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <WalletIcon className="text-primary" size={20} />
                    إشعارات القسم المالي
                  </h3>
                  
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold font-sans self-start">
                    <button
                      onClick={() => setFinancialFilter('all')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${financialFilter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      الكل
                    </button>
                    <button
                      onClick={() => setFinancialFilter('with')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${financialFilter === 'with' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      سحب
                    </button>
                    <button
                      onClick={() => setFinancialFilter('dep')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${financialFilter === 'dep' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      إيداع
                    </button>
                  </div>
                </div>

                {filteredNotifications.length > 0 ? (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {filteredNotifications.slice(0, 5).map(n => {
                      let alertBg = 'bg-slate-50 dark:bg-slate-800/40 border-slate-100';
                      let iconColor = 'text-slate-400';
                      let statusText = '';
                      let statusBg = 'bg-slate-100 text-slate-600';

                      if (n.status === 'accepted' || n.status === 'completed') {
                        alertBg = 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100/50 dark:border-emerald-900/40';
                        iconColor = 'text-emerald-500';
                        statusText = 'مقبول';
                        statusBg = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
                      } else if (n.status === 'rejected' || n.status === 'cancelled') {
                        alertBg = 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-100/50 dark:border-rose-900/40';
                        iconColor = 'text-rose-500';
                        statusText = 'مرفوض';
                        statusBg = 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300';
                      } else if (n.status === 'pending') {
                        alertBg = 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-100/50 dark:border-amber-900/40';
                        iconColor = 'text-amber-500 animate-pulse';
                        statusText = 'مراجعة';
                        statusBg = 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
                      }

                      return (
                        <div key={n.id} className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all hover:bg-white dark:hover:bg-slate-800 ${alertBg}`}>
                          <div className="mt-0.5">
                            {n.status === 'accepted' || n.status === 'completed' ? (
                              <CheckCircle2 size={16} className={iconColor} />
                            ) : n.status === 'rejected' || n.status === 'cancelled' ? (
                              <AlertCircle size={16} className={iconColor} />
                            ) : (
                              <Clock size={16} className={iconColor} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{n.title}</span>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {new Date(n.date).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">{n.body}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${statusBg}`}>
                                {statusText}
                              </span>
                              <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 tabular-nums">
                                {n.amount.toLocaleString()} ج.م
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 py-12">
                    <WalletIcon size={40} className="stroke-1 opacity-25 mb-3" />
                    <p className="text-sm font-bold">لا توجد حركات مالية مسجلة حالياً.</p>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                    <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/wallet`} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">
                      عرض كافة العمليات المالية من المحفظة <ArrowLeft size={12} />
                    </Link>
                </div>
            </div>

            <div className="lg:col-span-5 border-r lg:border-r-0 lg:border-right border-slate-100 dark:border-slate-800 lg:pr-8">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-6">
                    <TrendingUp className="text-emerald-500" size={20} />
                    أعلى الموظفين إنجازاً (اليوم)
                </h3>
                
                <div className="space-y-3">
                  {(() => {
                    const today = new Date().toISOString().split('T')[0];
                    const statsMap: Record<string, { name: string; confirmed: number; total: number }> = {};
                    
                    (settings.employees || []).filter(e => e.status === 'active' || !e.status).forEach(emp => {
                        statsMap[emp.phone] = { name: emp.name, confirmed: 0, total: 0 };
                    });

                    orders.forEach(o => {
                        (o.confirmationLogs || []).forEach(log => {
                            if (log.timestamp.startsWith(today)) {
                                if (!statsMap[log.userId]) {
                                    statsMap[log.userId] = { name: log.userName || 'موظف', confirmed: 0, total: 0 };
                                }
                                statsMap[log.userId].total++;
                                if (log.action === 'تم التأكيد') statsMap[log.userId].confirmed++;
                            }
                        });
                    });

                    const sortedStats = Object.entries(statsMap)
                        .filter(([_, info]) => info.total > 0)
                        .sort((a,b) => b[1].confirmed - a[1].confirmed)
                        .slice(0, 5);

                    if (sortedStats.length === 0) {
                        return (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
                                <Users2 size={32} className="opacity-20 mb-2" />
                                <p className="text-xs font-bold">لا يوجد نشاط للفريق حتى الآن</p>
                            </div>
                        );
                    }

                    return sortedStats.map(([id, info], idx) => (
                      <div key={id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-hover hover:border-indigo-200">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-white dark:bg-slate-700 text-slate-500'}`}>
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[100px]">{info.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 capitalize">{Math.round((info.confirmed/info.total)*100)}% معدل تأكيد</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-600 tabular-nums">{info.confirmed}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">مؤكد</p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/confirmation-queue`} className="mt-6 w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black hover:bg-indigo-50 transition-colors">
                    غرفة تأكيد الطلبات <Monitor size={14} />
                </Link>
            </div>
          </div>
        </motion.div>

        {/* Inventory & Alerts - Bento Card */}
        <motion.div variants={itemVariants} className="md:col-span-6 glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">تنبيهات المخزون</h3>
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          
          {lowStockProducts.length > 0 ? (
            <div className="space-y-4">
              {lowStockProducts.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                      <Package size={20} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500">SKU: {p.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-rose-500">{p.stockQuantity} قطع</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">مخزون منخفض</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <CheckCircle2 size={48} className="text-emerald-500/20 mb-4" />
              <p className="font-bold">المخزون سليم تماماً</p>
            </div>
          )}
        </motion.div>

        {/* Top Products - filling gap */}
        <motion.div variants={itemVariants} className="md:col-span-6 glass-card p-8 rounded-3xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">الأكثر مبيعاً هدا الشهر</h3>
              <Sparkles size={20} className="text-indigo-500" />
            </div>
            
            <div className="space-y-4">
              {stats.topProducts.map((p: any, idx: number) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/30 dark:bg-slate-800/30 border border-indigo-100/50 dark:border-slate-700/50">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center font-black text-xs text-indigo-600 shadow-sm">
                        {idx + 1}
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{p.name}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-indigo-600">{p.salesCount} بيعة</p>
                   </div>
                </div>
              ))}
              {stats.topProducts.length === 0 && (
                <div className="text-center py-10 text-slate-400 italic">لا توجد بيانات مبيعات كافية</div>
              )}
            </div>
        </motion.div>

        {/* Supplier Debt (Accounts Payable) - Bento Card */}
        <motion.div variants={itemVariants} className="md:col-span-12 glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Layers className="text-rose-500" size={24} />
              ديون الموردين (Accounts Payable)
            </h3>
            <div className="text-right">
                <span className="text-xs font-bold text-slate-400">إجمالي المديونية</span>
                <p className="text-lg font-black text-rose-600">-{stats.supplierDebt.toLocaleString()} ج.م</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(settings.suppliers || []).filter(s => (s.balance || 0) > 0).slice(0, 8).map(supplier => (
               <div key={supplier.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-rose-200 transition-colors group">
                  <div className="flex items-center gap-4 mb-4">
                     <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black text-lg transition-transform group-hover:scale-110">
                        {supplier.name.charAt(0)}
                     </div>
                     <div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate max-w-[120px]">{supplier.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">مورد خارجي</p>
                     </div>
                  </div>
                  <div className="flex items-end justify-between">
                     <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">مستحق السداد له</p>
                        <p className="text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums tracking-tighter">{(supplier.balance || 0).toLocaleString()} <span className="text-[10px]">ج.م</span></p>
                     </div>
                     <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/suppliers`} className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-400 hover:text-primary transition-colors shadow-sm">
                        <ArrowLeft size={16} />
                     </Link>
                  </div>
               </div>
            ))}
            {(settings.suppliers || []).filter(s => (s.balance || 0) > 0).length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                    <p className="text-sm font-bold italic">لا توجد مديونيات للموردين حالياً</p>
                </div>
            )}
          </div>
        </motion.div>

        {/* Distributed Custody - Bento Card */}
        <motion.div variants={itemVariants} className="md:col-span-12 glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users2 className="text-orange-500" size={24} />
              تفاصيل العهد النقدية الموزعة (الموظفين)
            </h3>
            <span className="text-xs font-bold text-slate-400">إجمالي العهد: {stats.totalCustodyBalance.toLocaleString()} ج.م</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(settings.cashHolders || []).slice(0, 8).map(holder => (
               <div key={holder.userId} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-orange-200 transition-colors group">
                  <div className="flex items-center gap-4 mb-4">
                     <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-lg transition-transform group-hover:scale-110">
                        {holder.userName.charAt(0)}
                     </div>
                     <div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate max-w-[120px]">{holder.userName}</p>
                        <p className="text-[10px] font-bold text-slate-400">موظف مفوض</p>
                     </div>
                  </div>
                  <div className="flex items-end justify-between">
                     <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">الرصيد في عهدته</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{holder.currentBalance.toLocaleString()} <span className="text-[10px]">ج.م</span></p>
                     </div>
                     <Link to={`${activeStore ? `/store/${activeStore.id}` : ''}/cash-management`} className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-400 hover:text-primary transition-colors shadow-sm">
                        <ArrowLeft size={16} />
                     </Link>
                  </div>
               </div>
            ))}
            {(settings.cashHolders || []).length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                    <p className="text-sm font-bold italic">لا توجد عهد موزعة حالياً</p>
                </div>
            )}
          </div>
        </motion.div>

      {/* Footer Branding */}
      <motion.div variants={itemVariants} className="pt-12 border-t border-slate-200 dark:border-slate-800/50">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">
            <div className="w-8 h-[1px] bg-current opacity-20" />
            OneToolz Dashboard v2.0
            <div className="w-8 h-[1px] bg-current opacity-20" />
          </div>
          <p className="text-[10px] text-slate-400 text-center max-w-xs leading-relaxed">
            تم التصميم والبرمجة بواسطة عبدالرحمن سعيد. جميع الحقوق محفوظة © 2026
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

const StatusItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="flex items-center justify-between group cursor-default">
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.1)]`} />
      <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">{label}</span>
    </div>
    <span className="text-sm font-black text-slate-800 dark:text-white tabular-nums">{value}</span>
  </div>
);

const DashboardStatusCard = ({ title, value, color, badge }: { title: string, value: string | number, color: string, badge?: string }) => (
  <div className="bg-white/60 dark:bg-[#0b0f19]/60 backdrop-blur-xl p-3.5 sm:p-4.5 rounded-2xl border border-slate-200/40 dark:border-white/5 shadow-xs relative overflow-hidden flex flex-col items-end justify-center min-h-[85px] sm:min-h-[105px] group hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300">
      <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 opacity-25 group-hover:opacity-100 transition-opacity duration-300">
           <Clock size={12} className="text-indigo-500 dark:text-indigo-400" />
      </div>
      <div className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-black mb-1 sm:mb-1.5">{title}</div>
      <div className={`text-base sm:text-2xl font-extrabold ${color} flex items-center gap-1 sm:gap-2 tabular-nums`}>
          {badge && (
              <span className="text-[8px] sm:text-[10px] bg-indigo-500/10 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-450 px-1 sm:px-1.5 py-0.5 rounded-full font-black">
                  {badge}
              </span>
          )}
          {value}
      </div>
  </div>
);


interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const StatCard = ({ title, value, icon }: StatCardProps) => (
  <div className="bg-white/70 dark:bg-[#0b0f19]/60 backdrop-blur-xl p-5.5 rounded-2xl border border-slate-200/45 dark:border-white/5 shadow-sm flex items-center gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/5">
    <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 rounded-xl">
        {icon}
    </div>
    <div>
      <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">{title}</div>
      <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums">{value}</div>
    </div>
  </div>
);

interface SmallStatProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

const SmallStat = ({ title, value, icon, colorClass }: SmallStatProps) => (
  <div className="bg-white/75 dark:bg-[#0b0f19]/65 backdrop-blur-xl p-4.5 rounded-2xl border border-slate-200/40 dark:border-white/5 text-center shadow-xs transition-all duration-300 hover:shadow-md">
      <div className={`flex items-center justify-center gap-2 font-bold text-slate-500 dark:text-slate-400 mb-1 ${colorClass}`}>
          {icon}
          <span className="text-sm">{title}</span>
      </div>
      <div className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">{value}</div>
  </div>
);

export default Dashboard;
