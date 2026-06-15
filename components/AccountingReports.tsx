import React, { useState, useMemo } from 'react';
import { Order, Settings, Wallet, Store, OrderStatus, TransactionCategory } from '../types';
import { calculateOrderProfitLoss, getLatestProductCost, getStandardShippingFee, calculateInsuranceFee, calculateBostaVat, calculateCodFee, isBosta } from '../utils/financials';
import { 
  BarChart, Wallet as WalletIcon, TrendingUp, Users, Truck, FileText, 
  ArrowDown, ArrowUp, DollarSign, Package, Download, Eye, X, Loader2, Printer, 
  PieChart, Calendar, Percent, Sparkles, TrendingDown, Layers, CheckCircle2, AlertCircle, ShoppingBag, ShoppingCart
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { exportHTMLToPDF } from '../utils/pdfHelper';
import { printHTMLDirectly } from '../utils/printHelper';

interface Props {
  orders: Order[];
  settings: Settings;
  wallet: Wallet;
  activeStore?: Store;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  setWallet?: React.Dispatch<React.SetStateAction<Wallet>>;
}

// Utility to verify date matching
const isWithinRange = (dateStr: string, filter: string, customStart?: string, customEnd?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    
    // Set hours to zero for consistent date-only comparison where appropriate
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    
    if (filter === 'all') return true;
    if (filter === 'today') {
        return d >= todayStart;
    }
    if (filter === 'this_week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return d >= oneWeekAgo && d <= now;
    }
    if (filter === 'this_month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (filter === 'last_month') {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    }
    if (filter === 'custom' && customStart && customEnd) {
        const s = new Date(customStart);
        s.setHours(0,0,0,0);
        const e = new Date(customEnd);
        e.setHours(23,59,59,999);
        return d >= s && d <= e;
    }
    return true;
};

export const AccountingReports: React.FC<Props> = ({ orders, settings, wallet, activeStore, setSettings, setWallet }) => {
    const [subTab, setSubTab] = useState<'income' | 'balance_sheet' | 'cash_flow' | 'suppliers' | 'receivables' | 'wallet' | 'product_profitability' | 'partner_equity' | 'marketing_roi' | 'inventory_velocity' | 'custody'>('income');
    const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const reportRef = React.useRef<HTMLDivElement>(null);

    // Dynamically filter both orders and wallet transactions for a unified database query simulation
    const filteredOrders = useMemo(() => {
        return orders.filter(o => isWithinRange(o.date, timeFilter, startDate, endDate));
    }, [orders, timeFilter, startDate, endDate]);

    const filteredWallet = useMemo(() => {
        const txs = (wallet.transactions || []).filter(t => isWithinRange(t.date, timeFilter, startDate, endDate));
        return {
            ...wallet,
            transactions: txs
        };
    }, [wallet, timeFilter, startDate, endDate]);

    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        try {
            await exportHTMLToPDF(reportRef.current, 'landscape', `التقرير_المالي_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('حدث خطأ أثناء تصدير PDF');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div ref={reportRef} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-0 overflow-hidden animate-in fade-in-5 duration-300">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600">
                        <BarChart size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-none">الحسابات الختامية والتقارير المالية</h2>
                        <p className="text-xs text-slate-400 mt-1">تقارير محاسبية متطابقة مع المعايير ومؤشرات الأداء التشغيلي</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white border border-transparent rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                        {isExporting ? 'تصدير...' : 'تصدير PDF'}
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-705 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-55 transition-colors shadow-sm"
                    >
                        <Printer size={16} /> معاينة الطباعة
                    </button>
                </div>
            </div>

            {/* Quick Master Time Period Filter Bar */}
            <div className="p-4 bg-slate-100/50 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <span className="text-xs text-slate-400 font-bold shrink-0 ml-1">تصفية الفترة:</span>
                    <FilterButton active={timeFilter === 'all'} onClick={() => setTimeFilter('all')} title="الكل" />
                    <FilterButton active={timeFilter === 'today'} onClick={() => setTimeFilter('today')} title="اليوم" />
                    <FilterButton active={timeFilter === 'this_week'} onClick={() => setTimeFilter('this_week')} title="آخر 7 أيام" />
                    <FilterButton active={timeFilter === 'this_month'} onClick={() => setTimeFilter('this_month')} title="الشهر الحالي" />
                    <FilterButton active={timeFilter === 'last_month'} onClick={() => setTimeFilter('last_month')} title="الشهر السابق" />
                    <FilterButton active={timeFilter === 'custom'} onClick={() => setTimeFilter('custom')} title="مخصص 📅" />
                </div>

                {timeFilter === 'custom' && (
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-850 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)} 
                            className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-350 focus:outline-none" 
                        />
                        <span className="text-xs text-slate-400">إلى</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)} 
                            className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-350 focus:outline-none" 
                        />
                    </div>
                )}
            </div>
            
            {/* Tabs List */}
            <div className="p-4 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800 flex gap-2">
                <TabButton active={subTab === 'income'} onClick={() => setSubTab('income')} icon={<TrendingUp size={16} />} title="قائمة الدخل" />
                <TabButton active={subTab === 'balance_sheet'} onClick={() => setSubTab('balance_sheet')} icon={<DollarSign size={16} />} title="الميزانية العمومية" />
                <TabButton active={subTab === 'cash_flow'} onClick={() => setSubTab('cash_flow')} icon={<ArrowUp size={16} />} title="التدفقات النقدية" />
                <TabButton active={subTab === 'product_profitability'} onClick={() => setSubTab('product_profitability')} icon={<Package size={16} />} title="أرباح المنتجات" />
                <TabButton active={subTab === 'marketing_roi'} onClick={() => setSubTab('marketing_roi')} icon={<Percent size={16} />} title="تحليل التسويق & CAC" />
                <TabButton active={subTab === 'inventory_velocity'} onClick={() => setSubTab('inventory_velocity')} icon={<Layers size={16} />} title="دوران المخزون" />
                <TabButton active={subTab === 'suppliers'} onClick={() => setSubTab('suppliers')} icon={<Users size={16} />} title="حساب الموردين" />
                <TabButton active={subTab === 'receivables'} onClick={() => setSubTab('receivables')} icon={<Truck size={16} />} title="ذمم الشحن" />
                <TabButton active={subTab === 'custody'} onClick={() => setSubTab('custody')} icon={<ShoppingBag size={16} />} title="عهد الموظفين والشركاء" />
                <TabButton active={subTab === 'partner_equity'} onClick={() => setSubTab('partner_equity')} icon={<PieChart size={16} />} title="حقوق الشركاء" />
                <TabButton active={subTab === 'wallet'} onClick={() => setSubTab('wallet')} icon={<WalletIcon size={16} />} title="حركة الصندوق" />
            </div>

            {/* Sub-Contents with Filtered Data */}
            <div className="p-6 min-h-[500px]">
                {subTab === 'income' && <IncomeStatement orders={filteredOrders} settings={settings} wallet={filteredWallet} />}
                {subTab === 'balance_sheet' && <BalanceSheet orders={filteredOrders} settings={settings} wallet={filteredWallet} />}
                {subTab === 'cash_flow' && <CashFlowStatement wallet={filteredWallet} />}
                {subTab === 'suppliers' && <SupplierLedger settings={settings} />}
                {subTab === 'receivables' && <ReceivablesAging orders={filteredOrders} />}
                {subTab === 'custody' && <CustodyLedger settings={settings} />}
                {subTab === 'wallet' && <WalletLedger wallet={filteredWallet} />}
                {subTab === 'product_profitability' && <ProductProfitability orders={filteredOrders} settings={settings} />}
                {subTab === 'partner_equity' && <PartnerEquity settings={settings} wallet={wallet} setSettings={setSettings} setWallet={setWallet} orders={orders} />}
                {subTab === 'marketing_roi' && <MarketingROI orders={filteredOrders} wallet={filteredWallet} />}
                {subTab === 'inventory_velocity' && <InventoryVelocity orders={filteredOrders} settings={settings} />}
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap text-xs border-2 ${active ? 'bg-purple-600 text-white border-purple-600 shadow-md translate-y-[-1px]' : 'bg-white dark:bg-slate-800 text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
    >
        {icon} {title}
    </button>
);

const FilterButton = ({ active, onClick, title }: { active: boolean; onClick: () => void; title: string }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${active ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/55'}`}
    >
        {title}
    </button>
);

// 1. Income Statement Component
const IncomeStatement = ({ orders, settings, wallet }: Omit<Props, 'activeStore'>) => {
    const stats = useMemo(() => {
        const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
        let productRevenue = 0;
        let shippingRevenue = 0;
        let cogs = 0;
        let totalOrderProfit = 0;
        let insuranceFees = 0;
        let inspectionFees = 0;
        let carrierShippingFees = 0;

        let totalShippingMarkup = 0;

        completedOrders.forEach(o => {
            const { profit } = calculateOrderProfitLoss(o, settings);
            totalOrderProfit += profit;

            (o.items || []).forEach(item => {
                const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                productRevenue += (item.price * item.quantity);
                cogs += (cost * item.quantity);
            });
            shippingRevenue += (o.shippingFee || 0);

            const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر';
            const standardShipping = isPosOrder ? 0 : getStandardShippingFee(o, settings);
            const shippingMarkup = isPosOrder ? 0 : Math.max(0, o.shippingFee - standardShipping);
            totalShippingMarkup += shippingMarkup;

            const safeProductPrice = Number(o.productPrice) || 0;
            const safeShippingFee = Number(o.shippingFee) || 0;
            const safeDiscount = Number(o.discount) || 0;
            const baseTotalExpected = safeProductPrice + safeShippingFee - safeDiscount;

            if (o.channel !== 'pos' && o.shippingCompany !== 'كاشير - بيع مباشر') {
                const compFees = settings.companySpecificFees?.[o.shippingCompany];
                const useCustom = compFees?.useCustomFees ?? false;
                const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
                const isInsured = o.isInsured ?? true;
                
                const insFee = isInsured ? calculateInsuranceFee(o, insuranceRate, settings) : 0;
                insuranceFees += insFee;
                
                const inspectionCost = (o.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
                inspectionFees += inspectionCost;

                const bostaVat = isBosta(o.shippingCompany) ? calculateBostaVat(o, insFee, settings) : 0;
                const codFee = calculateCodFee(o, settings);
                const standardShippingFee = getStandardShippingFee(o, settings);
                
                carrierShippingFees += (standardShippingFee + bostaVat + codFee);
            }
        });

        // Add standalone POS sales profit/revenue/cogs to match Dashboard
        let extraPosRevenue = 0;
        let extraPosCOGS = 0;
        let extraPosProfit = 0;
        const extraPosSales = (settings?.posSales || []).filter(s => !orders.some(o => o.id === s.id || o.orderNumber === s.saleNumber));
        extraPosSales.forEach(s => {
            (s.items || []).forEach(item => {
                const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                extraPosCOGS += (cost * (item.quantity || 1));
                extraPosRevenue += (item.price * (item.quantity || 1));
                extraPosProfit += ((item.price - cost) * (item.quantity || 1));
            });
        });

        productRevenue += extraPosRevenue;
        cogs += extraPosCOGS;

        // Expenses from wallet
        const expenseTxs = (wallet?.transactions || []).filter(t => t.type === 'سحب' && t.category && (t.category.startsWith('expense_') || t.category.startsWith('supply_expense_')));
        const totalExpenses = expenseTxs.reduce((sum, t) => sum + t.amount, 0);

        // Losses from returns/failures
        const lossFromReturnOrders = orders
            .filter(o => ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام'].includes(o.status))
            .reduce((sum, o) => sum + calculateOrderProfitLoss(o, settings).loss, 0);

        const totalRevenue = productRevenue + shippingRevenue;
        const grossProfit = productRevenue - cogs + totalShippingMarkup; // This perfectly represents product gross profit including shipping markups
        
        // Net profit matches the precise final financial logic (including extra POS sales profit!)
        const netProfit = totalOrderProfit + extraPosProfit - totalExpenses - lossFromReturnOrders;

        return { 
            productRevenue, shippingRevenue, totalRevenue, 
            cogs, grossProfit, totalExpenses, totalReturnFees: lossFromReturnOrders, 
            insuranceFees, inspectionFees, carrierShippingFees, netProfit,
            margin: productRevenue > 0 ? (grossProfit / productRevenue) * 100 : 0
        };
    }, [orders, settings, wallet]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard title="إجمالي الإيرادات" value={stats.totalRevenue} color="indigo" icon={<TrendingUp size={20} />} />
                <SummaryCard title="مجمل الربح" value={stats.grossProfit} color="emerald" icon={<DollarSign size={20} />} />
                <SummaryCard title="صافي الدخل" value={stats.netProfit} color="purple" icon={<BarChart size={20} />} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm max-w-3xl mx-auto space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b pb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">قائمة الدخل للفترة الحالية</h3>
                    <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold rounded-full">استحقاق تقديري</div>
                </div>
                
                <div className="space-y-4">
                    <ReportRow label="إيرادات المنتجات" value={stats.productRevenue} />
                    <ReportRow label="إيرادات خدمات الشحن من العملاء" value={stats.shippingRevenue} />
                    <ReportRow label="إجمالي الإيرادات" value={stats.totalRevenue} isBold />
                    
                    <div className="pt-4 border-t border-dashed space-y-3">
                        <ReportRow label="تكلفة البضاعة المباعة (COGS)" value={-stats.cogs} color="red" />
                        <ReportRow label="مجمل الربح" value={stats.grossProfit} isBold highlight />
                    </div>

                    <div className="pt-4 border-t border-dashed space-y-3">
                        <div className="text-xs font-extrabold text-slate-400 mb-1">مصاريف وتكاليف التشغيل والشحن:</div>
                        <ReportRow label="تكاليف ومصاريف شركات الشحن المباشرة" value={-stats.carrierShippingFees} color="red" />
                        <ReportRow label="رسوم تأمين شحنات الناقل" value={-stats.insuranceFees} color="red" />
                        <ReportRow label="رسوم معاينة شحنات الناقل" value={-stats.inspectionFees} color="red" />
                        <ReportRow label="المصروفات التشغيلية والإدارية (المحفظة)" value={-stats.totalExpenses} color="red" />
                        <ReportRow label="خسائر وتكاليف شحن المرتجعات" value={-stats.totalReturnFees} color="red" />
                    </div>

                    <div className="pt-6 border-t font-sans">
                        <ReportRow label="صافي الربح / (الخسارة)" value={stats.netProfit} isBold isLarge highlight color={stats.netProfit >= 0 ? 'emerald' : 'red'} />
                        <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                            <span>نسبة هامش مجمل الربح للمنتجات</span>
                            <span className="font-bold">{Math.max(0, stats.margin).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SummaryCard = ({ title, value, color, icon }: { title: string; value: number; color: 'indigo' | 'emerald' | 'purple' | 'red'; icon: React.ReactNode }) => {
    const bgColors = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800 text-indigo-600',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800 text-emerald-600',
        purple: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800 text-purple-600',
        red: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800 text-red-600'
    };
    
    return (
        <div className={`p-5 rounded-2xl border-2 ${bgColors[color]} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold opacity-80">{title}</span>
                {icon}
            </div>
            <p className="text-2xl font-black">{Math.abs(value).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-xs">ج.م</span></p>
        </div>
    );
};

const ReportRow = ({ label, value, isBold, isLarge, highlight, color = 'slate' }: { label: string; value: number; isBold?: boolean; isLarge?: boolean; highlight?: boolean; color?: 'slate' | 'red' | 'emerald' | 'indigo' }) => {
    const textColors = {
        slate: 'text-slate-700 dark:text-slate-300',
        red: 'text-red-600 dark:text-red-400 font-bold',
        emerald: 'text-emerald-600 dark:text-emerald-400 font-bold',
        indigo: 'text-indigo-600 dark:text-indigo-400 font-bold'
    };
    
    return (
        <div className={`flex justify-between items-center py-2 px-3 rounded-xl transition-colors ${highlight ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}>
            <span className={`${isBold ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500'} ${isLarge ? 'text-lg' : 'text-sm'}`}>{label}</span>
            <span className={`${textColors[color]} ${isBold ? 'font-black' : 'font-mono'} ${isLarge ? 'text-xl' : 'text-md'}`}>
                {value < 0 ? '(' : ''}{Math.abs(value).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{value < 0 ? ')' : ''} ج.م
            </span>
        </div>
    );
};

// 2. Balance Sheet Component
const BalanceSheet = ({ orders, settings, wallet }: Omit<Props, 'activeStore'>) => {
    const stats = useMemo(() => {
        const cashBalance = (wallet?.transactions || []).reduce((sum, t) => {
            const amount = Number(t.amount) || 0;
            if (t.category === 'supply_purchase' || t.category === 'supply_deposit') return sum;
            if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
            if (t.type === 'سحب') return t.status === 'cancelled' ? sum : sum - amount;
            return sum;
        }, 0);
        
        const supplyWalletBalance = wallet.supplyBalance || 0;
        
        let inventoryValue = 0;
        const products = settings?.products || [];
        products.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    inventoryValue += (v.stockQuantity || 0) * Math.max(v.costPrice ?? 0, p.costPrice || 0);
                });
            } else {
                inventoryValue += (p.stockQuantity || 0) * (p.costPrice || 0);
            }
        });

        let receivablesPending = orders
            .filter(o => o.status === 'تم_توصيلها')
            .reduce((sum, o) => sum + (o.productPrice + (o.shippingFee || 0) - (o.discount || 0)), 0);

        const totalAssets = cashBalance + supplyWalletBalance + inventoryValue + receivablesPending;

        const suppliers = settings?.suppliers || [];
        const accountPayables = suppliers.reduce((sum, s) => sum + Math.max(0, s.balance || 0), 0);

        const totalEquity = totalAssets - accountPayables;

        return { cashBalance, inventoryValue, receivablesPending, totalAssets, accountPayables, totalEquity };
    }, [orders, settings, wallet]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SummaryCard title="إجمالي الأصول" value={stats.totalAssets} color="emerald" icon={<Package size={20} />} />
                <SummaryCard title="إجمالي الخصوم وحقوق الملكية" value={stats.accountPayables + stats.totalEquity} color="indigo" icon={<Users size={20} />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Assets */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 border-b border-emerald-100 dark:border-emerald-800/50">
                        <h4 className="font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                             الأصول المتداولة (Assets)
                        </h4>
                    </div>
                    <div className="p-6 space-y-4">
                        <ReportRow label="السيولة النقدية (المحفظة العامة)" value={stats.cashBalance} />
                        <ReportRow label="محفظة التوريد (Supply Wallet)" value={wallet.supplyBalance || 0} />
                        <ReportRow label="بضاعة في المخزن (Inventory)" value={stats.inventoryValue} />
                        <ReportRow label="ذمم مدينة (معلقة لدى شركات الشحن)" value={stats.receivablesPending} />
                        <div className="pt-4 border-t">
                            <ReportRow label="إجمالي الأصول" value={stats.totalAssets} isBold isLarge color="emerald" />
                        </div>
                    </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 border-b border-amber-100 dark:border-amber-800/50">
                        <h4 className="font-black text-amber-800 dark:text-amber-400 flex items-center gap-2">
                             الخصوم وحقوق الملكية (Liabilities & Equity)
                        </h4>
                    </div>
                    <div className="p-6 space-y-4">
                        <ReportRow label="دائنون (حسابات الموردين)" value={-stats.accountPayables} color="red" />
                        <div className="pt-2">
                            <ReportRow label="صافي حقوق الملكية" value={stats.totalEquity} />
                            <p className="text-[10px] text-slate-400 px-3 mt-1">تتضمن رأس المال والأرباح المحتجزة للأنشطة المختلفة</p>
                        </div>
                        <div className="pt-4 border-t">
                            <ReportRow label="إجمالي الخصوم وحقوق الملكية" value={stats.accountPayables + stats.totalEquity} isBold isLarge color="indigo" />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                    <FileText size={14} /> المعادلة المحاسبية: الأصول ({stats.totalAssets.toLocaleString('ar-EG')}) = الخصوم ({stats.accountPayables.toLocaleString('ar-EG')}) + حقوق الملكية ({stats.totalEquity.toLocaleString('ar-EG')})
                </span>
            </div>
        </div>
    );
};

// 3. Cash Flow - Cash Flow Statement Component
const CashFlowStatement = ({ wallet }: { wallet: Wallet }) => {
    const stats = useMemo(() => {
        let operatingIn = 0;
        let operatingOut = 0;
        let financingIn = 0; 
        let financingOut = 0;
        
        wallet.transactions.forEach(t => {
            if (t.type === 'إيداع') {
                if (t.category === 'collection') {
                    operatingIn += t.amount;
                } else if (t.category === 'manual_deposit' || t.category === 'capital_addition') {
                    financingIn += t.amount;
                } else {
                    operatingIn += t.amount;
                }
            } else if (t.type === 'سحب') {
                if (t.category === 'manual_withdrawal' || t.category === 'profit_withdrawal') {
                    financingOut += t.amount;
                } else if (t.category === 'inventory_purchase') {
                    operatingOut += t.amount;
                } else {
                    operatingOut += t.amount;
                }
            }
        });
        
        const netCashFlow = (operatingIn + financingIn) - (operatingOut + financingOut);
        return { operatingIn, operatingOut, financingIn, financingOut, netCashFlow };
    }, [wallet]);

    return (
         <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SummaryCard title="صافي التدفق النقدي" value={stats.netCashFlow} color={stats.netCashFlow >= 0 ? 'emerald' : 'red'} icon={<WalletIcon size={20} />} />
                <SummaryCard title="إجمالي المتحصلات" value={stats.operatingIn + stats.financingIn} color="indigo" icon={<ArrowDown size={20} />} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-between border-b pb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">تقرير التدفقات النقدية (Cash Flow)</h3>
                    <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-full">الأساس النقدي</div>
                </div>

                <div className="space-y-6">
                    <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500"></div> الأنشطة التشغيلية
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
                            <ReportRow label="متحصلات من عملاء (تحصيل شحن)" value={stats.operatingIn} color="emerald" />
                            <ReportRow label="مدفوعات مشتريات ومصروفات" value={-stats.operatingOut} color="red" />
                            <div className="pt-2 border-t mt-1">
                                <ReportRow label="صافي التدفق من التشغيل" value={stats.operatingIn - stats.operatingOut} isBold />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500"></div> الأنشطة التمويلية والرأسمالية
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
                            <ReportRow label="زيادات رأس المال / إيداعات الشركاء" value={stats.financingIn} color="emerald" />
                            <ReportRow label="مسحوبات الشركاء / الأرباح" value={-stats.financingOut} color="red" />
                            <div className="pt-2 border-t mt-1">
                                <ReportRow label="صافي التدفق من التمويل" value={stats.financingIn - stats.financingOut} isBold />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t">
                        <ReportRow label="صافي الزيادة / (النقص) في النقدية" value={stats.netCashFlow} isBold isLarge highlight color={stats.netCashFlow >= 0 ? 'emerald' : 'red'} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// 4. Supplier Ledger Component
const SupplierLedger = ({ settings }: Omit<Props, 'orders' | 'wallet' | 'activeStore'>) => {
    const suppliers = settings?.suppliers || [];
    
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white px-2">كشف حساب الموردين والمديونيات</h3>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-right bg-white dark:bg-slate-900">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4 font-bold">المورد</th>
                            <th className="px-6 py-4 font-bold">رقم الهاتف</th>
                            <th className="px-6 py-4 font-bold text-center">المديونية الحالية</th>
                            <th className="px-6 py-4 font-bold">ملاحظات العنوان</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {suppliers.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-black text-slate-800 dark:text-slate-200">{s.name}</div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{s.phone}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex px-3 py-1 rounded-full font-black text-xs ${(s.balance || 0) > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                                        {(s.balance || 0).toLocaleString('ar-EG')} ج.م
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-[200px]">{s.address || s.notes || '-'}</td>
                            </tr>
                        ))}
                        {suppliers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center py-20 text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users size={40} className="opacity-20" />
                                        <p>لا يوجد موردين مسجلين</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 5. Receivables Aging Component
const ReceivablesAging = ({ orders }: { orders: Order[] }) => {
    const stats = useMemo(() => {
        const deliveredOrders = orders.filter(o => o.status === 'تم_توصيلها');
        const now = new Date().getTime();
        
        let aging0to7 = 0;
        let aging8to14 = 0;
        let agingOver14 = 0;

        let byCompany: Record<string, number> = {};

        deliveredOrders.forEach(o => {
            const ageDays = (now - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24);
            const amt = (o.productPrice + (o.shippingFee || 0) - (o.discount || 0));
            if (ageDays <= 7) aging0to7 += amt;
            else if (ageDays <= 14) aging8to14 += amt;
            else agingOver14 += amt;

            const comp = o.shippingCompany || 'أخرى';
            byCompany[comp] = (byCompany[comp] || 0) + amt;
        });

        return { aging0to7, aging8to14, agingOver14, byCompany, total: aging0to7 + aging8to14 + agingOver14 };
    }, [orders]);

    return (
        <div className="space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SummaryCard title="إجمالي المستحقات المعلقة" value={stats.total} color="indigo" icon={<Truck size={20} />} />
                <SummaryCard title="مبالغ متأخرة جداً" value={stats.agingOver14} color="red" icon={<FileText size={20} />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                    <h4 className="font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
                        <TrendingUp size={18} className="text-purple-500" /> أعمار المديونية لدى شركات الشحن
                    </h4>
                    <div className="space-y-4">
                        <AgingProgressBar label="حديث (1 - 7 أيام)" value={stats.aging0to7} total={stats.total} color="emerald" />
                        <AgingProgressBar label="متأخر (8 - 14 يوم)" value={stats.aging8to14} total={stats.total} color="amber" />
                        <AgingProgressBar label="متأخر جداً (+14 يوم)" value={stats.agingOver14} total={stats.total} color="red" />
                        
                        <div className="pt-4 border-t mt-4 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl">
                            <span className="font-black text-slate-700 dark:text-slate-300">الإجمالي المعلق</span>
                            <span className="text-xl font-black text-purple-600">{stats.total.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
                    <h4 className="font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
                        <Users size={18} className="text-indigo-500" /> التوزيع حسب شركة الشحن
                    </h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(stats.byCompany).sort((a,b) => b[1] - a[1]).map(([comp, amt]) => (
                             <div key={comp} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <span className="font-bold text-slate-600 dark:text-slate-400">{comp}</span>
                                <span className="font-black text-slate-800 dark:text-slate-200">{amt.toLocaleString('ar-EG')} ج.م</span>
                             </div>
                        ))}
                        {Object.keys(stats.byCompany).length === 0 && (
                            <div className="text-center py-10 opacity-30">
                                <Truck size={40} className="mx-auto mb-2" />
                                <p>لا توجد مبالغ معلقة حالياً</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const AgingProgressBar = ({ label, value, total, color }: { label: string; value: number; total: number; color: 'emerald' | 'amber' | 'red' }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const colors = {
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500'
    };
    const textColors = {
        emerald: 'text-emerald-600',
        amber: 'text-amber-600',
        red: 'text-red-600'
    };
    
    return (
        <div className="space-y-1.5 font-sans">
            <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">{label}</span>
                <span className={textColors[color]}>{value.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-1000 ${colors[color]}`} 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

// 7. Product Profitability Component
const ProductProfitability = ({ orders, settings }: { orders: Order[], settings: Settings }) => {
    const stats = useMemo(() => {
        const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
        
        let productStats: Record<string, {
            id: string;
            name: string;
            revenue: number;
            cogs: number;
            quantitySold: number;
        }> = {};

        completedOrders.forEach(o => {
            o.items.forEach(item => {
                const cost = getLatestProductCost(item.productId, settings);
                if (!productStats[item.productId]) {
                     const p = (settings?.products || []).find(x => x.id === item.productId);
                     productStats[item.productId] = {
                         id: item.productId,
                         name: p ? p.name : 'منتج غير معروف',
                         revenue: 0,
                         cogs: 0,
                         quantitySold: 0
                     };
                }
                productStats[item.productId].revenue += item.price * item.quantity;
                productStats[item.productId].cogs += cost * item.quantity;
                productStats[item.productId].quantitySold += item.quantity;
            });
        });

        const sortedProducts = Object.values(productStats).map(p => ({
            ...p,
            profit: p.revenue - p.cogs,
            margin: p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0
        })).sort((a, b) => b.profit - a.profit);

        return { products: sortedProducts };
    }, [orders, settings]);

    return (
        <div className="space-y-6">
             <div className="px-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">تحليل ربحية المنتجات للفترة المحددة</h3>
                <p className="text-sm text-slate-500 mt-1">ترتيب المنتجات حسب صافي الربح التقديري (بعد خصم تكلفة البضاعة)</p>
             </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-right bg-white dark:bg-slate-900">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4 font-bold">المنتج</th>
                            <th className="px-4 py-4 font-bold text-center">الكمية</th>
                            <th className="px-4 py-4 font-bold">المبيعات</th>
                            <th className="px-4 py-4 font-bold">التكلفة</th>
                            <th className="px-4 py-4 font-bold">الربح التقديري</th>
                            <th className="px-6 py-4 font-bold text-center">الهامش</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stats.products.map((p, idx) => (
                             <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">{idx + 1}</div>
                                        <div className="font-bold text-slate-800 dark:text-slate-200">{p.name}</div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-center font-black text-blue-600">{p.quantitySold}</td>
                                <td className="px-4 py-4 font-mono text-xs">{p.revenue.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-4 font-mono text-xs text-slate-400">{p.cogs.toLocaleString('ar-EG')}</td>
                                <td className="px-4 py-4">
                                    <span className={`font-black ${p.profit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {p.profit > 0 ? '+' : ''}{p.profit.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                     <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black ${p.margin >= 30 ? 'bg-emerald-100 text-emerald-700' : p.margin > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                        {p.margin.toFixed(1)}%
                                     </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 6. Custody Ledger Component
const CustodyLedger = ({ settings }: { settings: Settings }) => {
    const holders = settings.cashHolders || [];

    const handleExport = (mode: 'print' | 'pdf') => {
        const total = holders.reduce((sum, h) => sum + (h.currentBalance || 0), 0);
        const html = `
            <div dir="rtl" style="font-family: 'Segoe UI', sans-serif; padding: 40px; background: white;">
                <h1 style="text-align: center; color: #1e293b;">تقرير أرصدة العهد النقدية</h1>
                <p style="text-align: center; color: #64748b;">تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>
                
                <div style="margin: 30px 0; padding: 20px; border: 2px solid #e2e8f0; border-radius: 12px; background: #f8fafc;">
                    <div style="font-size: 14px; color: #64748b;">إجمالي العهد لدى الموظفين والشركاء</div>
                    <div style="font-size: 28px; font-weight: 900; color: #4f46e5;">${total.toLocaleString()} ج.م</div>
                </div>

                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #4f46e5; color: white;">
                            <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: right;">الاسم / الموظف</th>
                            <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: right;">الرصيد الحالي</th>
                            <th style="border: 1px solid #e2e8f0; padding: 12px; text-align: right;">آخر تحديث</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${holders.map(h => `
                            <tr>
                                <td style="border: 1px solid #e2e8f0; padding: 12px;">${h.userName}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: bold;">${(h.currentBalance || 0).toLocaleString()} ج.م</td>
                                <td style="border: 1px solid #e2e8f0; padding: 12px;">${new Date(h.lastUpdated).toLocaleDateString('ar-EG')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (mode === 'print') {
            printHTMLDirectly(html);
        } else {
            exportHTMLToPDF(html, 'portrait', `تقرير_العهد_${new Date().toISOString().split('T')[0]}.pdf`);
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="px-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">تقرير العهد والأمانات النقدية</h3>
                    <p className="text-sm text-slate-500 mt-1">المبالغ المتوفرة حالياً "بعهدة" الموظفين والشركاء من مبيعات الكاشير</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleExport('print')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all"
                    >
                        <Printer size={14} />
                        طباعة
                    </button>
                    <button 
                        onClick={() => handleExport('pdf')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black hover:bg-slate-700 transition-all"
                    >
                        <FileText size={14} />
                        تحميل PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               {holders.map(h => (
                   <div key={h.userId} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-500/50 group">
                       <div className="flex items-center justify-between mb-3">
                           <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                               <Users size={20} />
                           </div>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">بعهدة</span>
                       </div>
                       <h4 className="font-black text-slate-800 dark:text-white text-lg truncate" title={h.userName}>{h.userName}</h4>
                       <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden">
                           <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{h.currentBalance.toLocaleString()}</span>
                           <span className="text-xs font-bold text-slate-400">ج.م</span>
                       </div>
                       <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 uppercase font-black">آخر تحديث</span>
                            <span className="text-[10px] font-bold text-slate-500">{new Date(h.lastUpdated).toLocaleDateString('ar-EG')}</span>
                       </div>
                   </div>
               ))}
               {holders.length === 0 && (
                   <div className="col-span-full py-20 text-center text-slate-400 italic bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                       <ShoppingCart size={48} className="mx-auto mb-4 opacity-10" />
                       <p className="font-bold">لا توجد عهد نقدية مسجلة حالياً</p>
                       <p className="text-xs mt-2">تظهر العهد عند إجراء مبيعات عبر الكاشير واختيار مستلم للنقدية.</p>
                   </div>
               )}
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-5 rounded-2xl flex items-start gap-3 shadow-sm shadow-amber-500/5">
                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                <div className="space-y-1">
                    <h5 className="text-sm font-black text-amber-900 dark:text-amber-100">ملاحظة محاسبية هامة</h5>
                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-bold">
                        هذه المبالغ تم استلامها من العملاء في نقطة البيع ولكنها لم تورّد بعد للخزينة العامة (المحفظة). 
                        يتم تصفية العهدة عند قيام الموظف بتوريد المبلغ للمدير يدوياً وتسجيل عملية إيداع للمحفظة.
                    </p>
                </div>
            </div>
        </div>
    );
};

// 7. Wallet Ledger Component
const WalletLedger = ({ wallet }: { wallet: Wallet }) => {
    const transactionsWithRunningBalance = useMemo(() => {
        const txs = [...wallet.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let current = 0;
        return txs.map(tx => {
            if (tx.type === 'إيداع') current += tx.amount;
            else current -= tx.amount;
            return { ...tx, runningBalance: current };
        }).reverse(); // Display latest first
    }, [wallet.transactions]);

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">حركة الصندوق والقيود اليومية للفترة</h3>
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950 px-6 py-3 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                    <WalletIcon size={20} className="text-emerald-500" />
                    <div>
                        <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-wider">رصيد الصندوق المتاح</p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none">{wallet.balance.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-right bg-white dark:bg-slate-900">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-4 py-4 font-bold text-center">التاريخ</th>
                            <th className="px-4 py-4 font-bold">النوع</th>
                            <th className="px-4 py-4 font-bold">التصنيف</th>
                            <th className="px-4 py-4 font-bold">المبلغ</th>
                            <th className="px-4 py-4 font-bold">الرصيد التراكمي</th>
                            <th className="px-4 py-4 font-bold">البيان / الملاحظات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {transactionsWithRunningBalance.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-4 text-center">
                                    <div className="text-[10px] font-bold text-slate-400">{new Date(tx.date).toLocaleDateString('ar-EG')}</div>
                                    <div className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${tx.type === 'إيداع' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {tx.type}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 uppercase">{tx.category || 'عام'}</span>
                                </td>
                                <td className="px-4 py-4 font-black text-slate-800 dark:text-slate-200">
                                    {tx.type === 'إيداع' ? '+' : '-'}{tx.amount.toLocaleString('ar-EG')}
                                </td>
                                <td className="px-4 py-4 font-mono text-xs font-bold text-slate-400">
                                    {tx.runningBalance.toLocaleString('ar-EG')} ج.م
                                </td>
                                <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-[250px] whitespace-normal leading-relaxed">{tx.note || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 8. Partner Equity Component (with beautiful, secure profit allocation trigger)
const PartnerEquity = ({ settings, wallet, setSettings, setWallet, orders }: { settings: Settings, wallet: Wallet, setSettings?: React.Dispatch<React.SetStateAction<Settings>>, setWallet?: React.Dispatch<React.SetStateAction<Wallet>>, orders: Order[] }) => {
    const [fundingAmount, setFundingAmount] = useState('');
    const [fundingPartnerId, setFundingPartnerId] = useState('');
    const [fundingType, setFundingType] = useState<'loan' | 'capital_addition' | 'profit_withdrawal' | 'repayment' | 'supply_funding' | 'profit_distribution' | 'shipping_funding' | 'customer_advance'>('capital_addition');
    const [fundingDate, setFundingDate] = useState(new Date().toISOString().split('T')[0]);
    const [fundingNote, setFundingNote] = useState('');
    
    // Custom Confirmation Dialog states to strictly avoid window.alerts or iframe restrictions
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; payload?: any } | null>(null);
    const [successToast, setSuccessToast] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setSuccessToast(msg);
        setTimeout(() => setSuccessToast(null), 3500);
    };

    const stats = useMemo(() => {
        const partners = settings?.partners || [];
        const partnerTransactions = settings?.partnerTransactions || [];

        let perPartner: Record<string, {
            id: string;
            name: string;
            profitRatio: number;
            capital: number;
            drawings: number;
            repayments: number;
            distributions: number;
            advances: number;
            currentBalance: number;
        }> = {};

        partners.forEach(p => {
             perPartner[p.id] = {
                 id: p.id,
                 name: p.name,
                 profitRatio: p.profitRatio || 0,
                 capital: 0,
                 drawings: 0,
                 repayments: 0,
                 distributions: 0,
                 advances: 0,
                 currentBalance: p.balance
             };
        });

        partnerTransactions.forEach(t => {
            if (perPartner[t.partnerId]) {
                if (t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage') {
                    perPartner[t.partnerId].capital += t.amount;
                } else if (t.type === 'profit_withdrawal' || t.type === 'loan') {
                    perPartner[t.partnerId].drawings += t.amount;
                } else if (t.type === 'repayment') {
                    perPartner[t.partnerId].repayments += t.amount;
                } else if (t.type === 'profit_distribution') {
                    perPartner[t.partnerId].distributions += t.amount;
                } else if (t.type === 'customer_advance') {
                    perPartner[t.partnerId].advances += t.amount;
                }
            }
        });

        // Compute Operational profits
        let totalOrderProfit = 0;
        const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
        completedOrders.forEach(o => {
            const { profit } = calculateOrderProfitLoss(o, settings);
            totalOrderProfit += profit;
        });

        const extraPosSales = (settings?.posSales || []).filter(s => !orders.some(o => o.id === s.id || o.orderNumber === s.saleNumber));
        let extraPosProfit = 0;
        extraPosSales.forEach(s => {
            (s.items || []).forEach(item => {
                const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                extraPosProfit += ((item.price - cost) * (item.quantity || 1));
            });
        });

        const expenseTxs = (wallet?.transactions || []).filter(t => t.type === 'سحب' && t.category && (t.category.startsWith('expense_') || t.category.startsWith('supply_expense_')));
        const totalExpenses = expenseTxs.reduce((sum, t) => sum + t.amount, 0);

        const lossFromReturnOrders = orders
            .filter(o => ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام'].includes(o.status))
            .reduce((sum, o) => sum + calculateOrderProfitLoss(o, settings).loss, 0);

        const netProfit = totalOrderProfit + extraPosProfit - totalExpenses - lossFromReturnOrders;

        const totalDistributed = partnerTransactions
            .filter(t => t.type === 'profit_distribution')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const undistributedProfit = Math.max(0, netProfit - totalDistributed);

        return { 
            partners: Object.values(perPartner), 
            netProfit, 
            undistributedProfit, 
            totalDistributed 
        };
    }, [settings, wallet, orders]);

    const handleConfirmDistribute = () => {
        if (!setSettings) return;
        const totalRatios = stats.partners.reduce((sum, p) => sum + p.profitRatio, 0);
        if (totalRatios !== 100) {
            setConfirmModal({
                isOpen: true,
                title: 'مجموع نسب الأرباح غير متزن ⚠️',
                message: `لا يمكن توزيع الأرباح تلقائياً حالياً لأن مجموع نسب أرباح الشركاء هو ${totalRatios}% وليس 100% تماماً. يرجى تعديل النسب أولاً من صفحة الشركاء لتوزيع متوازن.`,
            });
            return;
        }

        if (stats.undistributedProfit <= 0) {
            showToast('لا توجد أرباح قابلة للتوزيع للفترة الجارية');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'تأكيد توزيع وصرف الأرباح',
            message: `سيتم توزيع مبلغ (${stats.undistributedProfit.toLocaleString()} ج.م) المسجل كربح تشغيلي على أرصدة الشركاء الحالية تزامناً مع نسبهم. هل تود المتابعة وتأكيد القيود؟`,
            payload: { action: 'distribute' }
        });
    };

    const handleExecuteDistribute = () => {
        if (!setSettings) return;
        const undistributedProfit = stats.undistributedProfit;
        const partnersList = settings.partners || [];
        const existingTx = settings.partnerTransactions || [];

        const newTransactions: any[] = [];
        const updatedPartners = partnersList.map(p => {
            const share = (undistributedProfit * (p.profitRatio || 0)) / 100;
            if (share <= 0) return p;

            newTransactions.push({
                id: `dist_${Date.now()}_${p.id}`,
                partnerId: p.id,
                type: 'profit_distribution',
                amount: share,
                date: new Date().toISOString(),
                note: `توزيع أرباح تلقائي متكامل بنسبة ${p.profitRatio}%`
            });

            return {
                ...p,
                balance: (p.balance || 0) + share
            };
        });

        setSettings({
            ...settings,
            partners: updatedPartners,
            partnerTransactions: [...existingTx, ...newTransactions]
        });

        setConfirmModal(null);
        showToast('🎉 تم توزيع الأرباح وحقنها في أرصدة الشركاء بنجاح!');
    };

    const handleAddFunding = (e: React.FormEvent) => {
        e.preventDefault();
        if (!setSettings || !fundingPartnerId || !fundingAmount) return;
        const amt = parseFloat(fundingAmount);
        if (isNaN(amt) || amt <= 0) return;

        const partner = (settings.partners || []).find(p => p.id === fundingPartnerId);
        if (!partner) return;

        let noteText = fundingNote.trim();
        if (!noteText) {
            if (fundingType === 'capital_addition') {
                noteText = `إضافة رأس مال وتمويل نقدي من الشريك ${partner.name}`;
            } else if (fundingType === 'profit_withdrawal') {
                noteText = `مسحوبات شخصية من الأرباح المستحقة للشريك ${partner.name}`;
            } else if (fundingType === 'loan') {
                noteText = `سحب سلفة شريك من الخزينة للشريك ${partner.name}`;
            } else if (fundingType === 'repayment') {
                noteText = `سداد قيمة سلفة / مديونية من الشريك ${partner.name} للخزينة`;
            } else if (fundingType === 'profit_distribution') {
                noteText = `توزيع أرباح يدوية للشريك ${partner.name}`;
            } else if (fundingType === 'customer_advance') {
                noteText = `استلام عربون عهدة مبيعات في حوزة الشريك ${partner.name}`;
            } else {
                noteText = `قيد معالجة مالية للشريك ${partner.name}`;
            }
        }

        const dateISO = fundingDate ? new Date(fundingDate).toISOString() : new Date().toISOString();

        const tx = {
            id: `fund_${Date.now()}`,
            partnerId: fundingPartnerId,
            type: fundingType,
            amount: amt,
            date: dateISO,
            note: noteText
        };

        let balanceImpact = 0;
        if (fundingType === 'capital_addition' || fundingType === 'profit_distribution' || fundingType === 'repayment') {
            balanceImpact = amt;
        } else if (fundingType === 'profit_withdrawal' || fundingType === 'loan' || fundingType === 'customer_advance') {
            balanceImpact = -amt;
        }

        const updatedPartners = (settings.partners || []).map(p => {
            if (p.id === fundingPartnerId) {
                return {
                    ...p,
                    balance: (p.balance || 0) + balanceImpact
                };
            }
            return p;
        });

        setSettings({
            ...settings,
            partners: updatedPartners,
            partnerTransactions: [...(settings.partnerTransactions || []), tx]
        });

        if (setWallet && fundingType !== 'profit_distribution') {
            const walletTxType = (fundingType === 'capital_addition' || fundingType === 'repayment' || fundingType === 'customer_advance') ? 'إيداع' : 'سحب';
            const newWalletTx = {
                id: `p_tx_${Date.now()}`,
                type: walletTxType as 'إيداع' | 'سحب',
                amount: amt,
                date: dateISO,
                note: `[معاملة شريك - ${partner.name}] ${noteText}`,
                category: fundingType as TransactionCategory,
                status: 'completed' as const
            };

            setWallet(prevWallet => {
                const currentBalance = prevWallet.balance || 0;
                const newBalance = walletTxType === 'إيداع' ? currentBalance + amt : currentBalance - amt;
                return {
                    ...prevWallet,
                    balance: newBalance,
                    transactions: [newWalletTx, ...(prevWallet.transactions || [])]
                };
            });
        }

        setFundingAmount('');
        setFundingNote('');
        showToast('تم تسجيل تمويل الشريك بنجاح وتسجيل عملية القيد المالي والربط بالخزينة');
    };

    return (
        <div className="space-y-6">
             <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 px-2">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">مراكز حقوق الشركاء والمسحوبات</h3>
                    <p className="text-sm text-slate-500 mt-1">متابعة إيداعات الشركاء الرأسمالية والمسحوبات الشخصية وتوزيع الأرباح</p>
                </div>
                
                {setSettings && (
                     <div className="flex flex-wrap items-center gap-3">
                         <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800 rounded-2xl flex items-center gap-3">
                             <div className="shrink-0">
                                 <p className="text-[10px] text-purple-600/70 font-semibold uppercase leading-none">أرباح تشغيلية غير موزعة</p>
                                 <p className="text-xl font-black text-purple-700 dark:text-purple-400 mt-1 leading-none">{(stats.undistributedProfit).toLocaleString('ar-EG')} ج.م</p>
                             </div>
                             <button
                                 onClick={handleConfirmDistribute}
                                 className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition-all shrink-0 hover:scale-102"
                             >
                                 وزع الأرباح تلقائياً
                             </button>
                         </div>
                     </div>
                )}
             </div>

             {/* Dynamic Alerts/Toasts */}
             {successToast && (
                  <div className="p-4 bg-emerald-100 text-emerald-800 font-bold text-sm rounded-xl border border-emerald-200 shadow-lg flex items-center gap-2 animate-in slide-in-from-top-6 duration-300">
                      <CheckCircle2 className="text-emerald-600" />
                      {successToast}
                  </div>
             )}

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.partners.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 dark:bg-slate-800/50 rounded-bl-[100%] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-black text-xl">
                                        {p.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800 dark:text-white text-lg leading-none">{p.name}</h4>
                                        <span className="text-xs text-slate-400 mt-1 inline-block">حصة أرباح {p.profitRatio}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6 font-sans">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">رأس المال والمصاريف المضافة (+)</span>
                                    <span className="font-bold text-emerald-600">{p.capital.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 font-medium">تمويلات الأرباح الموزعة (+)</span>
                                    <span className="font-bold text-blue-600">{p.distributions.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">المسحوبات الشخصية والسلف (-)</span>
                                    <span className="font-bold text-red-600">{p.drawings.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-teal-600 font-medium font-bold">العربونات المستلمة عهدة (-)</span>
                                    <span className="font-bold text-teal-600">{(p.advances || 0).toLocaleString('ar-EG')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 font-medium">السدادات للمديونية (+)</span>
                                    <span className="font-bold text-amber-600">{p.repayments.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">الرصيد الجاري المستحق له</p>
                                <p className={`text-2xl font-black ${p.currentBalance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                                    {p.currentBalance.toLocaleString('ar-EG')} <span className="text-sm">ج.م</span>
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
             </div>

             {/* Simple integrated Quick Transaction form for accounting operations */}
             {setSettings && (
                 <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-3xl mx-auto shadow-sm">
                     <h4 className="font-bold text-sm text-slate-850 dark:text-slate-200 mb-4 flex items-center gap-2">
                         <Layers size={16} className="text-purple-600" /> نموذج قيد وتسجيل تمويل الشركاء والمسحوبات
                     </h4>
                     <form onSubmit={handleAddFunding} className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                                 <label className="block text-xs text-slate-400 font-bold mb-1.5">اختر الشريك</label>
                                 <select
                                     value={fundingPartnerId}
                                     onChange={(e) => setFundingPartnerId(e.target.value)}
                                     className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all text-slate-700 dark:text-slate-200"
                                     required
                                 >
                                     <option value="">-- اختر شريكاً --</option>
                                     {(settings.partners || []).map(p => (
                                         <option key={p.id} value={p.id}>{p.name}</option>
                                     ))}
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-xs text-slate-400 font-bold mb-1.5">نوع التمويل / القيد</label>
                                 <select
                                     value={fundingType}
                                     onChange={(e) => setFundingType(e.target.value as any)}
                                     className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all text-slate-700 dark:text-slate-200"
                                 >
                                     <option value="capital_addition">تحويل مالي (إضافة رأس مال) (+)</option>
                                     <option value="profit_withdrawal">مسحوبات شخصية من الأرباح (-)</option>
                                     <option value="loan">سحب نقدي (سلفة شريك شخصية) (-)</option>
                                     <option value="repayment">سداد سلفة / مديونية شريك للخزينة (+)</option>
                                     <option value="profit_distribution">توزيع يدوي لأرباح مستحقة لشريك معين (+)</option>
                                     <option value="customer_advance">استلام عربون عهدة مبيعات في حوزة الشريك (-)</option>
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-xs text-slate-400 font-bold mb-1.5">تاريخ القيد</label>
                                 <input
                                     type="date"
                                     value={fundingDate}
                                     onChange={(e) => setFundingDate(e.target.value)}
                                     className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all text-slate-700 dark:text-slate-200"
                                     required
                                 />
                             </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="md:col-span-2">
                                 <label className="block text-xs text-slate-400 font-bold mb-1.5">البيان / ملاحظات القيد</label>
                                 <input
                                     type="text"
                                     value={fundingNote}
                                     onChange={(e) => setFundingNote(e.target.value)}
                                     placeholder="أدخل بياناً اختيارياً (مثال: تمويل توريد الشحنات أو شراء أصل)"
                                     className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold focus:outline-none"
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs text-slate-400 font-bold mb-1.5">المبلغ المطلوب (ج.م)</label>
                                 <div className="flex gap-2">
                                     <input
                                         type="number"
                                         value={fundingAmount}
                                         onChange={(e) => setFundingAmount(e.target.value)}
                                         placeholder="أدخل القيمة"
                                         className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all text-slate-700 dark:text-slate-200"
                                         required
                                         min="0.01"
                                         step="any"
                                     />
                                     <button
                                         type="submit"
                                         className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all hover:scale-102 shrink-0"
                                     >
                                         قيد وتسجيل ✅
                                     </button>
                                 </div>
                             </div>
                         </div>
                     </form>
                 </div>
             )}

             {/* Custom Confirmation Dialog avoids alerts / frame failures */}
             {confirmModal && confirmModal.isOpen && (
                 <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                     <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl animate-in scale-in duration-200 text-right">
                         <div className="flex items-center justify-between border-b pb-3 mb-4">
                             <h4 className="font-extrabold text-slate-850 dark:text-white flex items-center gap-2">
                                 <Sparkles size={18} className="text-indigo-500" />
                                 {confirmModal.title}
                             </h4>
                             <button onClick={() => setConfirmModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                         </div>
                         <p className="text-sm text-slate-600 dark:text-slate-350 leading-relaxed mb-6">{confirmModal.message}</p>
                         <div className="flex items-center justify-end gap-3">
                             <button
                                 onClick={() => setConfirmModal(null)}
                                 className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-bold text-xs rounded-xl transition-all"
                             >
                                 إلغاء
                             </button>
                             {confirmModal.payload?.action === 'distribute' && (
                                 <button
                                     onClick={handleExecuteDistribute}
                                     className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-200 dark:shadow-none"
                                 >
                                     توزيع وصرف الآن ✅
                                 </button>
                             )}
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

// 9. NEW REPORT: Marketing Profitability, ROI & CAC Analysis (العائد البيعي والاستحواذ)
const MarketingROI = ({ orders, wallet }: { orders: Order[], wallet: Wallet }) => {
    const stats = useMemo(() => {
        const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));

        // Get total advertising marketing expenses from the transactions list
        const adExpenses = wallet.transactions
            .filter(t => t.type === 'سحب' && (t.category === 'expense_ads' || t.note?.toLowerCase().includes('marketing') || t.note?.includes('إعلان')));
        
        const totalAdSpend = adExpenses.reduce((sum, t) => sum + t.amount, 0);
        const totalOrders = completedOrders.length;

        // Sales Revenue
        const totalSalesRevenue = completedOrders.reduce((sum, o) => sum + (o.productPrice - (o.discount || 0)), 0);

        // Client Acquisition Cost (CAC)
        const cac = totalOrders > 0 ? totalAdSpend / totalOrders : 0;

        // Return on Ad Spend (ROAS)
        const roas = totalAdSpend > 0 ? totalSalesRevenue / totalAdSpend : 0;

        let roasHealth: 'excellent' | 'good' | 'average' | 'poor' = 'poor';
        if (roas >= 5) roasHealth = 'excellent';
        else if (roas >= 3) roasHealth = 'good';
        else if (roas >= 1.5) roasHealth = 'average';

        return { totalAdSpend, totalOrders, totalSalesRevenue, cac, roas, roasHealth, sampleAdExpenses: adExpenses.slice(0, 5) };
    }, [orders, wallet]);

    return (
        <div className="space-y-6 animate-in fade-in-5 duration-300">
             <div className="px-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Sparkles className="text-indigo-500" /> قياس العائد التسويقي وتكلفة اكتساب العملاء (CAC / ROAS)
                </h3>
                <p className="text-sm text-slate-500 mt-1">دراسة فاعلية المصروفات الإعلانية ومجموع المبيعات الناتجة وتحديد العائد الفعلي</p>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs text-slate-400 font-bold mb-1">مصاريف الإعلانات المسجلة</p>
                     <p className="text-2xl font-black text-rose-500">{stats.totalAdSpend.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span></p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs text-slate-400 font-bold mb-1">عدد الطلبيات المكتملة</p>
                     <p className="text-2xl font-black text-indigo-500">{stats.totalOrders} <span className="text-xs">أوردر</span></p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs text-slate-400 font-bold mb-1">كلفة استحواذ العميل (CAC)</p>
                     <p className="text-2xl font-black text-violet-500">{stats.cac.toFixed(1)} <span className="text-xs">ج.م / عميل</span></p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
                     <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-50 dark:bg-emerald-900/10 rounded-bl-full shrink-0 -mr-4 -mt-4"></div>
                     <p className="text-xs text-slate-400 font-bold mb-1">مضاعف العائد الإعلاني (ROAS)</p>
                     <p className="text-2xl font-black text-emerald-500">{stats.roas.toFixed(2)}x</p>
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Analytical chart scale visual */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
                     <h4 className="font-extrabold text-sm border-b pb-3 text-slate-800 dark:text-white">مؤشر كفاءة العائد الإعلاني (ROAS Health)</h4>
                     <p className="text-xs text-slate-500">مقياس نجاح الحملة التسويقية بناءً على مضاعف المبيعات مقابل المصاريف:</p>
                     
                     <div className="space-y-3 font-sans pt-2">
                         <div className={`p-4 rounded-xl border flex justify-between items-center ${stats.roasHealth === 'excellent' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60'}`}>
                             <div>
                                 <p className="font-black text-xs text-emerald-700 dark:text-emerald-400">ممتاز جداً (Efficent) 🚀</p>
                                 <p className="text-[10px] text-slate-400 mt-1">عائد المبيعات أكثر من 5 أضعاف الصرف الإعلاني</p>
                             </div>
                             <span className="font-bold text-xs text-emerald-600">ROAS &gt; 5.0</span>
                         </div>

                         <div className={`p-4 rounded-xl border flex justify-between items-center ${stats.roasHealth === 'good' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60'}`}>
                             <div>
                                 <p className="font-black text-xs text-blue-700 dark:text-blue-400">جيد ومثالي (Healthy) 👍</p>
                                 <p className="text-[10px] text-slate-400 mt-1">عائد المبيعات بين 3 - 5 أضعاف الصرف الإعلاني</p>
                             </div>
                             <span className="font-bold text-xs text-blue-600">3.0 - 5.0</span>
                         </div>

                         <div className={`p-4 rounded-xl border flex justify-between items-center ${stats.roasHealth === 'average' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60'}`}>
                             <div>
                                 <p className="font-black text-xs text-amber-700 dark:text-amber-400">هامشي (Marginal) ⚖️</p>
                                 <p className="text-[10px] text-slate-400 mt-1">عائد المبيعات بين 1.5 - 3 أضعاف الصرف الإعلاني</p>
                             </div>
                             <span className="font-bold text-xs text-amber-600">1.5 - 3.0</span>
                         </div>
                     </div>
                 </div>

                 {/* Last spends */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                     <h4 className="font-extrabold text-sm border-b pb-3 mb-4 text-slate-800 dark:text-white">سجل القيود الحركية للتسويق للفترة</h4>
                     <div className="space-y-3">
                         {stats.sampleAdExpenses.map(t => (
                              <div key={t.id} className="flex justify-between items-center p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-dashed border-slate-100 last:border-0">
                                  <div className="text-right">
                                      <p className="font-bold text-xs text-slate-700 dark:text-slate-300">{t.note}</p>
                                      <span className="text-[10px] text-slate-400 mt-1 inline-block">{new Date(t.date).toLocaleDateString('ar-EG')}</span>
                                  </div>
                                  <span className="font-black text-rose-500 text-sm">-{t.amount.toLocaleString('ar-EG')} ج.م</span>
                              </div>
                         ))}
                         {stats.sampleAdExpenses.length === 0 && (
                              <div className="py-12 text-center text-slate-400 opacity-40">
                                  <Calendar size={32} className="mx-auto mb-2" />
                                  <p className="text-xs">لم يتم رصد حركات تسويقية منفصلة بالصندوق</p>
                              </div>
                         )}
                     </div>
                 </div>
             </div>
        </div>
    );
};

// 10. NEW REPORT: Inventory Turnover & Aging analysis (دوران المخزون وقيمة المشتريات)
const InventoryVelocity = ({ orders, settings }: { orders: Order[], settings: Settings }) => {
    const stats = useMemo(() => {
        const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));

        // 1. Calculate Cost of Goods Sold (COGS) in the filtered period
        let totalCOGS = 0;
        let productsSoldMap: Record<string, number> = {};

        completedOrders.forEach(o => {
            (o.items || []).forEach(item => {
                const cost = getLatestProductCost(item.productId, settings);
                totalCOGS += cost * item.quantity;
                productsSoldMap[item.productId] = (productsSoldMap[item.productId] || 0) + item.quantity;
            });
        });

        // 2. Average Inventory Value at purchase price
        let currentInventoryValue = 0;
        const productsList = settings.products || [];
        productsList.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    currentInventoryValue += (v.stockQuantity || 0) * Math.max(v.costPrice ?? 0, p.costPrice || 0);
                });
            } else {
                currentInventoryValue += (p.stockQuantity || 0) * (p.costPrice || 0);
            }
        });

        // Safe division to prevent zero values
        const turnoverRatio = currentInventoryValue > 0 ? totalCOGS / currentInventoryValue : 0;
        const dsi = turnoverRatio > 0 ? Math.round(365 / turnoverRatio) : 365;

        // Map velocity categories
        const mappedProducts = productsList.map(p => {
            const soldCount = productsSoldMap[p.id] || 0;
            let classification: 'fast' | 'normal' | 'slow' = 'normal';
            if (soldCount >= 20) classification = 'fast';
            else if (soldCount === 0) classification = 'slow';

            return {
                id: p.id,
                name: p.name,
                stockQuantity: p.stockQuantity || 0,
                costPrice: p.costPrice || 0,
                vBalance: (p.stockQuantity || 0) * (p.costPrice || 0),
                soldCount,
                classification
            };
        }).sort((a,b) => b.soldCount - a.soldCount);

        return { totalCOGS, currentInventoryValue, turnoverRatio, dsi, products: mappedProducts };
    }, [orders, settings]);

    return (
        <div className="space-y-6 animate-in fade-in-5 duration-300">
             <div className="px-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Package className="text-teal-500" /> تقرير دوران المخزون ومؤشر ركود البضاعة (Inventory Turnover Indicator)
                </h3>
                <p className="text-sm text-slate-500 mt-1">تتبع كفاءة بقاء المخازن والعمر التقديري وسرعة تصريف البضائع المباعة للعملاء</p>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs text-slate-400 font-bold mb-1">صافي قيمة المخازن الحالية (سعر الشراء)</p>
                     <p className="text-2xl font-black text-indigo-500">{(stats.currentInventoryValue).toLocaleString('ar-EG')} <span className="text-xs">ج.م</span></p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs text-slate-400 font-bold mb-1">تكلفة البضاعة المباعة (COGS)</p>
                     <p className="text-2xl font-black text-teal-500">{stats.totalCOGS.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span></p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs text-slate-400 font-bold mb-1">معدل دوران المخزون (Turns)</p>
                     <p className="text-2xl font-black text-violet-500">{stats.turnoverRatio.toFixed(2)}x <span className="text-xs">دورة</span></p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                     <p className="text-xs text-slate-400 font-bold mb-1">أيام الدوران التقريبية (DSI)</p>
                     <p className="text-2xl font-black text-amber-500">{stats.turnoverRatio > 0 ? stats.dsi : '365+'} <span className="text-xs">يوم لتصريف الستوك</span></p>
                 </div>
             </div>

             {/* Classification listing of velocity */}
             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                 <table className="w-full text-sm text-right bg-white dark:bg-slate-900	">
                     <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                         <tr>
                             <th className="px-6 py-4 font-bold">المنتج</th>
                             <th className="px-4 py-4 font-bold text-center">الكمية المسحوبة</th>
                             <th className="px-4 py-4 font-bold">القيمة الحالية بالمستجر</th>
                             <th className="px-6 py-4 font-bold text-center">حالة الدوران و الركود</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                         {stats.products.map(p => (
                             <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                 <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{p.name}</td>
                                 <td className="px-4 py-4 text-center font-bold text-slate-700">{p.soldCount} أوردر</td>
                                 <td className="px-4 py-4 font-mono text-xs text-slate-500">{(p.vBalance).toLocaleString('ar-EG')} ج.م</td>
                                 <td className="px-6 py-4 text-center">
                                      {p.classification === 'fast' && (
                                           <span className="inline-flex px-2.5 py-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-full">سريع الدوران 🔥</span>
                                      )}
                                      {p.classification === 'normal' && (
                                           <span className="inline-flex px-2.5 py-1 text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-full">طبيعي ⚖️</span>
                                      )}
                                      {p.classification === 'slow' && (
                                           <span className="inline-flex px-2.5 py-1 text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 rounded-full">بضاعة راكدة/تالفة ⏸️</span>
                                      )}
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
        </div>
    );
};
