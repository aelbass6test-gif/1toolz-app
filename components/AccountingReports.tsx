import React, { useState, useMemo } from 'react';
import { Order, Settings, Wallet, Store, OrderStatus, TransactionCategory, POSSale } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateOrderProfitLoss, getLatestProductCost, getStandardShippingFee, calculateInsuranceFee, calculateBostaVat, calculateCodFee, isBosta } from '../utils/financials';
import { 
  BarChart, Wallet as WalletIcon, TrendingUp, Users, Truck, FileText, 
  ArrowDown, ArrowUp, DollarSign, Package, Download, Eye, X, Loader2, Printer, 
  PieChart, Calendar, Percent, Sparkles, TrendingDown, Layers, CheckCircle2, AlertCircle, ShoppingBag, ShoppingCart,
  ArrowUpRight, ArrowDownLeft, Clock, Search, Filter, ChevronLeft, FileCheck, Receipt, UserCheck, History
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

export const AccountingReports: React.FC<Props & { treasury?: any }> = ({ orders, settings, wallet, activeStore, setSettings, setWallet, treasury }) => {
    const [subTab, setSubTab] = useState<'wealth_reconciliation' | 'income' | 'balance_sheet' | 'cash_flow' | 'suppliers' | 'receivables' | 'wallet' | 'product_profitability' | 'partner_equity' | 'marketing_roi' | 'inventory_velocity' | 'custody'>('wealth_reconciliation');
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
        const hidden = settings.hiddenWalletAmount || 0;
        return {
            ...wallet,
            balance: Math.max(0, (wallet.balance || 0) - hidden),
            transactions: txs,
            hiddenAmount: hidden // Pass it down if needed
        };
    }, [wallet, timeFilter, startDate, endDate, settings.hiddenWalletAmount]);

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
                <TabButton active={subTab === 'wealth_reconciliation'} onClick={() => setSubTab('wealth_reconciliation')} icon={<Sparkles size={16} className="text-amber-500 animate-pulse" />} title="مطابقة السيولة ورأس المال (معايا كام؟)" />
                <TabButton active={subTab === 'income'} onClick={() => setSubTab('income')} icon={<TrendingUp size={16} />} title="قائمة الدخل" />
                <TabButton active={subTab === 'balance_sheet'} onClick={() => setSubTab('balance_sheet')} icon={<DollarSign size={16} />} title="الميزانية العمومية" />
                <TabButton active={subTab === 'cash_flow'} onClick={() => setSubTab('cash_flow')} icon={<ArrowUp size={16} />} title="التدفقات النقدية" />
                <TabButton active={subTab === 'product_profitability'} onClick={() => setSubTab('product_profitability')} icon={<Package size={16} />} title="أرباح المنتجات" />
                <TabButton active={subTab === 'marketing_roi'} onClick={() => setSubTab('marketing_roi')} icon={<Percent size={16} />} title="تحليل التسويق & CAC" />
                <TabButton active={subTab === 'inventory_velocity'} onClick={() => setSubTab('inventory_velocity')} icon={<Layers size={16} />} title="دوران المخزون" />
                <TabButton active={subTab === 'suppliers'} onClick={() => setSubTab('suppliers')} icon={<Users size={16} />} title="حساب الموردين" />
                <TabButton active={subTab === 'receivables'} onClick={() => setSubTab('receivables')} icon={<Truck size={16} />} title="ذمم الشحن" />
                <TabButton active={subTab === 'custody'} onClick={() => setSubTab('custody')} icon={<ShoppingBag size={16} />} title="العهد" />
                <TabButton active={subTab === 'partner_equity'} onClick={() => setSubTab('partner_equity')} icon={<PieChart size={16} />} title="حقوق الشركاء" />
                <TabButton active={subTab === 'wallet'} onClick={() => setSubTab('wallet')} icon={<WalletIcon size={16} />} title="حركة الصندوق" />
            </div>

            {/* Sub-Contents with Filtered Data */}
            <div className="p-6 min-h-[500px]">
                {subTab === 'wealth_reconciliation' && <WealthReconciliation orders={filteredOrders} settings={settings} wallet={filteredWallet} treasury={treasury} setSettings={setSettings} />}
                {subTab === 'income' && <IncomeStatement orders={filteredOrders} settings={settings} wallet={filteredWallet} />}
                {subTab === 'balance_sheet' && <BalanceSheet orders={filteredOrders} settings={settings} wallet={filteredWallet} />}
                {subTab === 'cash_flow' && <CashFlowStatement wallet={filteredWallet} />}
                {subTab === 'suppliers' && <SupplierLedger settings={settings} />}
                {subTab === 'receivables' && <ReceivablesAging orders={filteredOrders} />}
                {subTab === 'custody' && <CustodyLedger settings={settings} treasury={treasury} />}
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
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm border-2 ${active ? 'bg-purple-600 text-white border-purple-600 shadow-md translate-y-[-1px]' : 'bg-white dark:bg-slate-800 text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
    >
        {icon} <span>{title}</span>
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
        let productRevenuePos = 0;
        let productRevenueShipping = 0;
        let shippingRevenue = 0;
        let cogsPos = 0;
        let cogsShipping = 0;
        let totalOrderProfit = 0;
        let insuranceFees = 0;
        let inspectionFees = 0;
        let carrierShippingFees = 0;

        let totalShippingMarkup = 0;

        let totalRevenue = 0;

        completedOrders.forEach(o => {
            const { profit } = calculateOrderProfitLoss(o, settings);
            totalOrderProfit += profit;

            const isPos = o.channel === 'pos' || 
                          o.shippingCompany === 'كاشير - بيع مباشر' || 
                          o.shippingArea === 'نقطة البيع' ||
                          (o.id && o.id.startsWith('POS-'));

            (o.items || []).forEach(item => {
                const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                if (isPos) {
                    productRevenuePos += (item.price * item.quantity);
                    cogsPos += (cost * item.quantity);
                } else {
                    productRevenueShipping += (item.price * item.quantity);
                    cogsShipping += (cost * item.quantity);
                }
            });
            shippingRevenue += (o.shippingFee || 0);

            const safeProductPrice = Number(o.productPrice) || 0;
            const safeShippingFee = Number(o.shippingFee) || 0;
            const safeDiscount = Number(o.discount) || 0;
            const safeAdvance = Number(o.advancePayment) || 0;
            
            const isDefinitivelyPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'));
            const compFeesLocal = settings.companySpecificFees?.[o.shippingCompany];
            const useCustomLocal = compFeesLocal?.useCustomFees ?? false;
            const inspectionFeeParams = !isDefinitivelyPosOrder && (o.includeInspectionFee ?? true) ? (useCustomLocal ? (compFeesLocal?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
            
            const totalCollected = o.totalAmountOverride !== undefined && o.totalAmountOverride !== null
                ? o.totalAmountOverride + safeAdvance
                : (safeProductPrice + safeShippingFee - safeDiscount + (o.inspectionFeePaidByCustomer ? inspectionFeeParams : 0));
            
            totalRevenue += totalCollected;

            const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر';
            const standardShipping = isPosOrder ? 0 : getStandardShippingFee(o, settings);
            const shippingMarkup = isPosOrder ? 0 : Math.max(0, o.shippingFee - standardShipping);
            totalShippingMarkup += shippingMarkup;

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

        productRevenuePos += extraPosRevenue;
        cogsPos += extraPosCOGS;

        // Expenses from wallet
        const expenseTxs = (wallet?.transactions || []).filter(t => t.type === 'سحب' && t.category && (t.category.startsWith('expense_') || t.category.startsWith('supply_expense_') || (settings?.expenseCategories || []).includes(t.category)));
        const totalExpenses = expenseTxs.reduce((sum, t) => sum + t.amount, 0);

        // Losses from returns/failures
        const lossFromReturnOrders = orders
            .filter(o => ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام'].includes(o.status))
            .reduce((sum, o) => sum + calculateOrderProfitLoss(o, settings).loss, 0);

        const totalProductRevenue = productRevenuePos + productRevenueShipping;
        const totalCogs = cogsPos + cogsShipping;
        const grossProfit = totalProductRevenue - totalCogs; // Pure product gross profit without extra markups
        
        // Net profit matches the precise final financial logic (including extra POS sales profit!)
        const netProfit = totalOrderProfit + extraPosProfit - totalExpenses - lossFromReturnOrders;

        return { 
            productRevenuePos, productRevenueShipping, productRevenueTotal: totalProductRevenue, shippingRevenue, totalRevenue: totalProductRevenue + shippingRevenue, 
            cogsTotal: totalCogs, grossProfit, totalExpenses, totalReturnFees: lossFromReturnOrders, 
            insuranceFees, inspectionFees, carrierShippingFees, netProfit,
            margin: totalProductRevenue > 0 ? (grossProfit / totalProductRevenue) * 100 : 0
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
                    <ReportRow label="إيرادات مبيعات نقطة البيع (POS)" value={stats.productRevenuePos} />
                    <ReportRow label="إيرادات مبيعات الشحن (أونلاين)" value={stats.productRevenueShipping} />
                    <ReportRow label="إيرادات خدمات الشحن من العملاء" value={stats.shippingRevenue} />
                    <ReportRow label="إجمالي الإيرادات" value={stats.totalRevenue} isBold />
                    
                    <div className="pt-4 border-t border-dashed space-y-3">
                        <ReportRow label="تكلفة البضاعة المباعة (COGS)" value={-stats.cogsTotal} color="red" />
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
        const rawCashBalance = (wallet?.transactions || []).reduce((sum, t) => {
            const amount = Number(t.amount) || 0;
            if (t.category === 'supply_purchase' || t.category === 'supply_deposit') return sum;
            if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
            if (t.type === 'سحب') return t.status === 'cancelled' ? sum : sum - amount;
            return sum;
        }, 0);

        const hidden = settings.hiddenWalletAmount || 0;
        const cashBalance = Math.max(0, rawCashBalance - hidden);
        
        const supplyWalletBalance = wallet.supplyBalance || 0;
        
        let inventoryValue = 0;
        const products = settings?.products || [];
        products.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const stock = v.stockQuantity ?? (v as any).stock ?? 0;
                    const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
                    inventoryValue += stock * cost;
                });
            } else {
                const stock = p.stockQuantity ?? (p as any).stock ?? 0;
                const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
                inventoryValue += stock * cost;
            }
        });

        let receivablesPending = orders
            .filter(o => o.status === 'تم_توصيلها' || (o.status === 'تم_التوصيل' && o.paymentStatus !== 'مدفوع'))
            .reduce((sum, o) => {
                const { netRevenue, carrierFees } = calculateOrderProfitLoss(o, settings);
                const advance = Number(o.advancePayment) || 0;
                // The amount courier owes us is Revenue - CarrierFees - Advance (since advance was collected by us)
                return sum + Math.max(0, netRevenue - carrierFees - advance);
            }, 0);

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
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full ${colors[color]}`}
                />
            </div>
        </div>
    );
};

// Helper for normalizing names in custody ledger
const normalizeName = (name: string): string => {
  if (!name) return name;
  let normalized = name.trim().replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s*\((شريك|موظف|المدير|شريكه|partner|employee|admin)\)/gi, '');
  normalized = normalized.replace(/\s+(شريك|موظف|المدير|شريكه|partner|employee|admin)$/gi, '');
  normalized = normalized.trim();
  if (/^(زهره|زهرة)/.test(normalized)) {
      return 'زهره';
  }
  return normalized;
};

// 6. Custody Ledger Component
export const CustodyLedger = ({ settings, treasury }: { settings: Settings, treasury?: any }) => {
    const [selectedHolderId, setSelectedHolderId] = useState<string | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const holdersCustody = useMemo(() => {
        const raw = (settings.cashHolders || []).filter(h => h.currentBalance && h.currentBalance > 0);
        const grouped: Record<string, any> = {};
        raw.forEach(h => {
            const nName = normalizeName(h.userName);
            const isPartner = (settings.partners || []).some(p => normalizeName(p.name) === nName || h.userId === p.id || h.userId === `part_${p.id}` || h.userId === `partner_${p.id}`);
            const isEmp = (settings.employees || []).some(e => normalizeName(e.name) === nName || h.userId === e.id || h.userId === `emp_${e.id}` || h.userId === `employee_${e.id}`);
            const displayName = (h.userId === 'admin' || nName === 'المدير' || nName === 'المدير (أنت)') ? 'المدير (أنت)' : isPartner ? `${nName} (شريك)` : isEmp ? `${nName} (موظف)` : nName;
            
            if (!grouped[nName]) {
                grouped[nName] = {
                    id: h.userId,
                    name: displayName,
                    balance: h.currentBalance || 0,
                    date: h.lastUpdated,
                    type: isPartner ? 'partner' : 'employee',
                    originalIds: [h.userId]
                };
            } else {
                grouped[nName].balance += (h.currentBalance || 0);
                if (!grouped[nName].originalIds.includes(h.userId)) {
                    grouped[nName].originalIds.push(h.userId);
                }
                if (new Date(h.lastUpdated) > new Date(grouped[nName].date)) {
                    grouped[nName].date = h.lastUpdated;
                }
            }
        });
        return Object.values(grouped);
    }, [settings.cashHolders, settings.partners, settings.employees]);
    
    const treasuryCustody = (treasury?.accounts || []).filter((a: any) => a.type === 'custody' && a.balance > 0).map((a: any) => ({ 
        id: a.id,
        name: a.name, 
        balance: a.balance, 
        date: new Date().toISOString(),
        type: 'treasury',
        originalIds: [a.id]
    }));
    
    const holders = [...holdersCustody, ...treasuryCustody];

    const selectedHolder = holders.find(h => h.id === selectedHolderId);
    const holderSales = useMemo(() => {
        if (!selectedHolderId) return [];
        return (settings.posSales || [])
            .filter(s => s.cashHolderId === selectedHolderId || (selectedHolder?.originalIds && selectedHolder.originalIds.includes(s.cashHolderId)))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [settings.posSales, selectedHolderId, selectedHolder]);

    const handleExport = (mode: 'print' | 'pdf') => {
        const total = holders.reduce((sum, h) => sum + h.balance, 0);
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
                                <td style="border: 1px solid #e2e8f0; padding: 12px;">${h.name}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: bold;">${h.balance.toLocaleString()} ج.م</td>
                                <td style="border: 1px solid #e2e8f0; padding: 12px;">${new Date(h.date).toLocaleDateString('ar-EG')}</td>
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
               {holders.map((h, i) => (
                   <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-500/50 group flex flex-col">
                       <div className="flex items-center justify-between mb-3">
                           <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                               <Users size={20} />
                           </div>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">بعهدة</span>
                       </div>
                       <h4 className="font-black text-slate-800 dark:text-white text-lg truncate" title={h.name}>{h.name}</h4>
                       <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden">
                           <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{h.balance.toLocaleString()}</span>
                           <span className="text-xs font-bold text-slate-400">ج.م</span>
                       </div>
                       <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 uppercase font-black">آخر تحديث</span>
                            <span className="text-[10px] font-bold text-slate-500">{new Date(h.date).toLocaleDateString('ar-EG')}</span>
                       </div>
                       
                       <button 
                         onClick={() => {
                           setSelectedHolderId(h.id);
                           setShowHistoryModal(true);
                         }}
                         className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                       >
                         <History size={14} />
                         عرض سجل الحركات
                       </button>
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

            <AnimatePresence>
              {showHistoryModal && selectedHolder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col"
                  >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                          <Users size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight">سجل عهدة: {selectedHolder.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">الرصيد المفتوح</span>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{selectedHolder.balance.toLocaleString()} ج.م</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowHistoryModal(false)}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {holderSales.length > 0 ? (
                        <div className="space-y-3">
                          {holderSales.map((sale) => (
                            <div key={sale.id} className="group bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-indigo-500/30 transition-all">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-emerald-500 border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform shadow-sm">
                                    <Receipt size={20} />
                                  </div>
                                  <div>
                                    <div className="text-xs font-black text-slate-800 dark:text-white">مبيعات كاشير #{sale.saleNumber}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-bold">
                                      <Clock size={10} />
                                      {new Date(sale.date).toLocaleString('ar-EG')}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">+{sale.totalAmount.toLocaleString()} ج.م</div>
                                  <div className="text-[9px] font-black text-slate-400 uppercase mt-0.5">تحصيل نقدي</div>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                {sale.items.map((item, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-[9px] font-bold text-slate-500">
                                    {item.name} × {item.quantity}
                                  </span>
                                ))}
                              </div>
                              
                              <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[9px]">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 font-black uppercase">بواسطة:</span>
                                  <span className="text-slate-600 dark:text-slate-300 font-bold">{sale.performedBy}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 font-black uppercase">العميل:</span>
                                  <span className="text-slate-600 dark:text-slate-300 font-bold">{sale.customerName || 'عميل نقدي'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center space-y-3">
                          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-200 dark:text-slate-700">
                            <ShoppingCart size={32} />
                          </div>
                          <p className="text-sm font-bold text-slate-400">لا توجد حركات بيع مسجلة لهذه العهدة في السجلات الحالية</p>
                        </div>
                      )}
                    </div>

                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center">
                      <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                        يتم تحديث هذا السجل تلقائياً عند كل عملية بيع تتم في نقطة البيع. 
                        <br />
                        لتصفية الرصيد، يرجى إجراء "توريد للخزينة" من خلال قسم المحفظة.
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

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
    const categoryMap: Record<string, string> = {
        'collection': 'تحصيل شحنات',
        'manual_deposit': 'إيداع نقدي يدوي',
        'capital_addition': 'زيادة رأس المال',
        'manual_withdrawal': 'سحب نقدي يدوي',
        'profit_withdrawal': 'مسحوبات أرباح الشركاء',
        'inventory_purchase': 'شراء مخزون / بضاعة',
        'expense_ads': 'مصاريف إعلانات وتسويق',
        'expense_rent': 'إيجار المقر / المخزن',
        'expense_salaries': 'رواتب ومكافآت الموظفين',
        'expense_utilities': 'مرافق (كهرباء/ماء/إنترنت)',
        'supply_purchase': 'مشتريات من الموردين',
        'supply_deposit': 'شحن رصيد محفظة التوريد',
        'supply_expense_shipping': 'تكاليف شحن وتوريد بضاعة',
        'custody_transfer': 'توريد عهدة مالية',
        'partner_equity': 'حقوق ومسحوبات شركاء',
        'pos_digital': 'مبيعات كاشير (دفع إلكتروني)',
        'loan': 'سلفة شخصية',
        'repayment': 'سداد سلفة',
        'shipping': 'مصاريف شحن صادر',
        'insurance': 'تأمين شحنات',
        'inspection': 'رسوم معاينة',
        'cod': 'تحصيل عند الاستلام',
        'return': 'مرتجع / استرجاع مبلغ',
        'vat': 'ضريبة القيمة المضافة',
        'wallet_charge': 'شحن محفظة إلكترونية',
        'wallet_withdrawal': 'سحب من المحفظة',
        'withdrawal_fee': 'رسوم سحب بنكي/محفظة'
    };

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
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">حركة الصندوق والقيود اليومية</h3>
                    <p className="text-sm text-slate-500 mt-1">سجل تفصيلي لكافة الحركات النقدية الداخلة والخارجة من المحفظة</p>
                </div>
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950 px-6 py-3 rounded-2xl border border-emerald-100 dark:border-emerald-800 shadow-sm shadow-emerald-500/10">
                    <WalletIcon size={20} className="text-emerald-500" />
                    <div>
                        <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-wider">رصيد الصندوق المتاح</p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none">{wallet.balance.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right bg-white dark:bg-slate-900">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-4 font-black text-center whitespace-nowrap">التاريخ</th>
                                <th className="px-6 py-4 font-black whitespace-nowrap">البيان / الفئة</th>
                                <th className="px-6 py-4 font-black text-center whitespace-nowrap">المبلغ</th>
                                <th className="px-6 py-4 font-black text-center whitespace-nowrap">الرصيد</th>
                                <th className="px-6 py-4 font-black text-center whitespace-nowrap">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {transactionsWithRunningBalance.map((tx) => (
                                <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <div className="text-xs font-black text-slate-800 dark:text-slate-200">{new Date(tx.date).toLocaleDateString('ar-EG')}</div>
                                        <div className="text-[10px] text-slate-400 font-bold">{new Date(tx.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${tx.type === 'إيداع' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-500 dark:bg-rose-900/20'}`}>
                                                {tx.type === 'إيداع' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-800 dark:text-white text-sm">{tx.note}</div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-black uppercase tracking-tighter">
                                                        {categoryMap[tx.category] || tx.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <span className={`font-black text-sm tabular-nums ${tx.type === 'إيداع' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {tx.type === 'إيداع' ? '+' : '-'}{tx.amount.toLocaleString()} ج.م
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-xs font-black text-slate-500 tabular-nums">
                                        {tx.runningBalance.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${
                                            tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            tx.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {tx.status === 'completed' && <CheckCircle2 size={10} />}
                                            {tx.status === 'completed' ? 'مكتمل' : tx.status === 'pending' ? 'معلق' : 'ملغي'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {transactionsWithRunningBalance.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <WalletIcon size={48} />
                                            <p className="font-black text-sm italic">لا توجد حركات مالية مسجلة في هذا الصندوق</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
        </div>
    );
};

// 8. Product Profitability Component
const ProductProfitability = ({ orders, settings }: { orders: Order[], settings: Settings }) => {
    const stats = useMemo(() => {
        const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
        
        let productsMap: Record<string, { id: string, name: string, quantity: number, revenue: number, cost: number }> = {};
        
        completedOrders.forEach(o => {
            (o.items || []).forEach(item => {
                if (!productsMap[item.productId]) {
                    productsMap[item.productId] = {
                        id: item.productId,
                        name: item.name,
                        quantity: 0,
                        revenue: 0,
                        cost: 0
                    };
                }
                const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                productsMap[item.productId].quantity += item.quantity;
                productsMap[item.productId].revenue += (item.price * item.quantity);
                productsMap[item.productId].cost += (cost * item.quantity);
            });
        });

        // Add POS Sales standalone
        const extraPosSales = (settings?.posSales || []).filter(s => !orders.some(o => o.id === s.id || o.orderNumber === s.saleNumber));
        extraPosSales.forEach(s => {
            (s.items || []).forEach(item => {
                if (!productsMap[item.productId]) {
                    productsMap[item.productId] = {
                        id: item.productId,
                        name: item.name,
                        quantity: 0,
                        revenue: 0,
                        cost: 0
                    };
                }
                const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                productsMap[item.productId].quantity += item.quantity;
                productsMap[item.productId].revenue += (item.price * item.quantity);
                productsMap[item.productId].cost += (cost * item.quantity);
            });
        });

        return Object.values(productsMap).sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost));
    }, [orders, settings]);

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white px-2">تحليل ربحية المنتجات (Product Contribution)</h3>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-right bg-white dark:bg-slate-900">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4 font-bold">المنتج</th>
                            <th className="px-4 py-4 font-bold text-center">الكمية المباعة</th>
                            <th className="px-4 py-4 font-bold text-center">إجمالي الإيراد</th>
                            <th className="px-4 py-4 font-bold text-center">إجمالي التكلفة</th>
                            <th className="px-4 py-4 font-bold text-center">الربح المحقق</th>
                            <th className="px-4 py-4 font-bold text-center">نسبة الهامش</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stats.map(p => {
                            const profit = p.revenue - p.cost;
                            const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                            return (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 dark:text-slate-200">{p.name}</div>
                                    </td>
                                    <td className="px-4 py-4 text-center font-bold text-slate-600">{p.quantity}</td>
                                    <td className="px-4 py-4 text-center font-mono text-xs">{p.revenue.toLocaleString('ar-EG')}</td>
                                    <td className="px-4 py-4 text-center font-mono text-xs text-slate-400">{p.cost.toLocaleString('ar-EG')}</td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`font-black text-xs ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {profit.toLocaleString('ar-EG')} ج.م
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${margin > 30 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 9. Partner Equity & Dividends Component
const PartnerEquity = ({ settings, wallet, setSettings, setWallet, orders }: { settings: Settings, wallet: Wallet, setSettings?: any, setWallet?: any, orders: Order[] }) => {
    const stats = useMemo(() => {
        const partners = settings?.partners || [];
        // Calculate dynamic balances based on transactions from partnerTransactions
        const partnerLedgers = partners.map(p => {
            const txs = (settings.partnerTransactions || []).filter(t => t.partnerId === p.id && t.type !== 'pos_collection');
            const balance = txs.reduce((sum, t) => {
                const isPositive = ['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(t.type);
                return isPositive ? sum + t.amount : sum - t.amount;
            }, 0);
            return { ...p, currentBalance: balance };
        });
        
        return partnerLedgers;
    }, [settings.partners, settings.partnerTransactions]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">حقوق ومسحوبات الشركاء (Equity Management)</h3>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-2xl border border-indigo-100 dark:border-indigo-900">
                    <p className="text-[10px] text-indigo-600 font-bold uppercase">إجمالي رأس مال الشركاء الحالي</p>
                    <p className="text-xl font-black text-indigo-700 dark:text-indigo-400">{stats.reduce((s, p) => s + p.currentBalance, 0).toLocaleString()} ج.م</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-indigo-500/50 transition-colors group">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                <Users size={24} />
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">نسبة الشراكة</span>
                                <div className="text-lg font-black text-slate-800 dark:text-white">{p.profitRatio}%</div>
                            </div>
                        </div>
                        
                        <div>
                            <h4 className="font-black text-slate-800 dark:text-white text-lg">{p.name}</h4>
                            <p className="text-xs text-slate-400">شريك مساهم</p>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase">الرصيد المتاح</span>
                                <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{p.currentBalance.toLocaleString()} ج.م</div>
                            </div>
                            <button className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors">
                                <ArrowUpRight size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold">
                    <History size={18} className="text-slate-400" /> آخر حركات رؤوس الأموال والمسحوبات
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs text-right">
                        <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-bold">التاريخ</th>
                                <th className="px-4 py-3 font-bold">الشريك</th>
                                <th className="px-4 py-3 font-bold">النوع</th>
                                <th className="px-4 py-3 font-bold">المبلغ</th>
                                <th className="px-4 py-3 font-bold">البيان</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {(settings.partnerTransactions || []).filter(t => t.partnerId && t.type !== 'pos_collection').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(t => (
                                <tr key={t.id} className="hover:bg-white dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-3 text-slate-400">{new Date(t.date).toLocaleDateString('ar-EG')}</td>
                                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{settings.partners?.find(p => p.id === t.partnerId)?.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(t.type) ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {t.type === 'profit_distribution' ? 'توزيع أرباح' : 
                                             t.type === 'capital_addition' ? 'إضافة رأس مال' : 
                                             t.type === 'profit_withdrawal' ? 'مسحوبات أرباح' : 
                                             t.type === 'loan' ? 'سلفة / سحب شخصي' : 
                                             t.type === 'repayment' ? 'سداد سلفة' : 
                                             t.type === 'supply_funding' ? 'تمويل بضاعة' : 
                                             t.type === 'shipping_funding' ? 'تمويل شحن' : 
                                             t.type === 'expense_coverage' ? 'تغطية مصاريف' : 
                                             t.type === 'internal_transfer_in' ? 'تحويل وارد' : 
                                             t.type === 'internal_transfer_out' ? 'تحويل صادر' : 'معاملة أخرى'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-black">{t.amount.toLocaleString()} ج.م</td>
                                    <td className="px-4 py-3 text-slate-500">{t.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Marketing ROI Analysis
const MarketingROI = ({ orders, wallet }: { orders: Order[], wallet: Wallet }) => {
    const stats = useMemo(() => {
        // Filter marketing expense transactions
        const adExpenses = (wallet.transactions || []).filter(t => t.type === 'سحب' && t.category === 'expense_ads');
        const totalAdSpend = adExpenses.reduce((sum, t) => sum + t.amount, 0);
        
        // Revenue attributed to ads (assumed to be orders with marketing notes)
        const adDrivenOrders = orders.filter(o => (o.notes && o.notes.toLowerCase().includes('ad')) || (o.notes && o.notes.toLowerCase().includes('marketing')));
        const totalAdRevenue = adDrivenOrders.reduce((sum, o) => {
            const { netRevenue } = calculateOrderProfitLoss(o, { products: [], companySpecificFees: {} } as any); // Simplified
            return sum + netRevenue;
        }, 0);

        const roas = totalAdSpend > 0 ? totalAdRevenue / totalAdSpend : 0;
        const cac = adDrivenOrders.length > 0 ? totalAdSpend / adDrivenOrders.length : 0;

        return { totalAdSpend, totalAdRevenue, roas, cac, adOrdersCount: adDrivenOrders.length, sampleAdExpenses: adExpenses.slice(0, 5) };
    }, [orders, wallet]);

    return (
         <div className="space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500/20 p-5 rounded-2xl">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي الصرف التسويقي</p>
                     <p className="text-2xl font-black text-indigo-600">{stats.totalAdSpend.toLocaleString()} ج.م</p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/20 p-5 rounded-2xl">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-1">العائد على الإعلان (ROAS)</p>
                     <p className="text-2xl font-black text-emerald-600">{stats.roas.toFixed(2)}x</p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border-2 border-rose-500/20 p-5 rounded-2xl">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-1">تكلفة الاستحواذ (CAC)</p>
                     <p className="text-2xl font-black text-rose-600">{stats.cac.toFixed(0)} <span className="text-xs">ج.م/عميل</span></p>
                 </div>
                 <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/20 p-5 rounded-2xl">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-1">عدد الطلبات المسوقة</p>
                     <p className="text-2xl font-black text-blue-600">{stats.adOrdersCount}</p>
                 </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm">
                      <h4 className="font-bold mb-6 flex items-center gap-2">
                          <Sparkles size={18} className="text-amber-500" /> تحليل الفعالية الإعلانية
                      </h4>
                      <div className="space-y-6">
                          <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-500">جودة الحملات الحالية</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-black ${stats.roas >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {stats.roas >= 3 ? 'مرتفعة جداً' : 'تحتاج تحسين'}
                              </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                              يتم احتساب هذا التحليل بناءً على المسحوبات المصنفة "مصاريف إعلانية" من الصندوق والطلبات التي مصدرها قنوات تسويقية مدفوعة.
                          </p>
                      </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm">
                      <h4 className="font-bold mb-6 flex items-center gap-2">
                          <History size={18} className="text-slate-400" /> آخر فواتير التسويق المسجلة
                      </h4>
                      <div className="space-y-3">
                          {stats.sampleAdExpenses.map(t => (
                               <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                  <div>
                                      <p className="text-xs font-bold text-slate-800 dark:text-white">{t.note}</p>
                                      <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString('ar-EG')}</p>
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
                    const stock = v.stockQuantity ?? (v as any).stock ?? 0;
                    const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
                    currentInventoryValue += stock * cost;
                });
            } else {
                const stock = p.stockQuantity ?? (p as any).stock ?? 0;
                const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
                currentInventoryValue += stock * cost;
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

            const stock = p.stockQuantity ?? (p as any).stock ?? 0;
            const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
            return {
                id: p.id,
                name: p.name,
                stockQuantity: stock,
                costPrice: cost,
                vBalance: stock * cost,
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

const WealthReconciliation = ({ orders, settings, wallet, treasury, setSettings }: { orders: Order[]; settings: Settings; wallet: Wallet; treasury?: any; setSettings?: React.Dispatch<React.SetStateAction<Settings>> }) => {
    const [activeDetailTab, setActiveDetailTab] = useState<'shipping' | 'pos'>('shipping');
    const completedStatuses: OrderStatus[] = ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'];

    // Hidden Wallet Amount state
    const [hiddenAmount, setHiddenAmount] = useState<string>(settings.hiddenWalletAmount?.toString() || '0');
    const [enableHidden, setEnableHidden] = useState<boolean>(settings.enableHiddenWalletAmount || false);

    const handleSaveHiddenAmount = () => {
        if (!setSettings) return;
        const val = Number(hiddenAmount) || 0;
        setSettings(prev => ({
            ...prev,
            hiddenWalletAmount: val,
            enableHiddenWalletAmount: enableHidden
        }));
    };

    // Local state for the Shipping & Partner Withdrawal Calculator
    const [calcMode, setCalcMode] = useState<'deposits' | 'sales_withdrawal' | 'sales_plus_deposits' | 'simple_net'>('sales_plus_deposits');
    const [calcShippingDeposit, setCalcShippingDeposit] = useState<number>(1615); // 1500 + 115
    const [calcPartnerDeposit, setCalcPartnerDeposit] = useState<number>(2500); // Partner Zahra + Al-Bass
    const [calcShippingExpenses, setCalcShippingExpenses] = useState<string>('');
    const [calcShippingLosses, setCalcShippingLosses] = useState<string>('');
    const [calcOtherExpenses, setCalcOtherExpenses] = useState<number>(0);

    // States for custom/manual overrides for Mode B (Sales-based withdrawal)
    const [calcManualCOGS, setCalcManualCOGS] = useState<string>('');
    const [calcManualProfit, setCalcManualProfit] = useState<string>('');
    const [calcManualCollectedShipping, setCalcManualCollectedShipping] = useState<string>('');
    const [calcManualManualAdjustments, setCalcManualManualAdjustments] = useState<string>('');

    const computedShippingExpenses = useMemo(() => {
        // Sum of carrier fees for successfully delivered orders
        return orders
            .filter(o => completedStatuses.includes(o.status))
            .filter(o => !(o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'))))
            .reduce((sum, o) => {
                const { carrierFees } = calculateOrderProfitLoss(o, settings);
                return sum + carrierFees;
            }, 0);
    }, [orders, settings]);

    const computedShippingLosses = useMemo(() => {
        // Sum of shipping losses for returned/failed orders
        return orders
            .filter(o => ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام'].includes(o.status))
            .reduce((sum, o) => {
                const { loss } = calculateOrderProfitLoss(o, settings);
                return sum + loss;
            }, 0);
    }, [orders, settings]);

    // Mode B: Automatically computed components for "تكلفة الطلبات + صافي الربح + الشحن المحصل"
    const shipCompletedCOGS = useMemo(() => {
        return orders
            .filter(o => completedStatuses.includes(o.status))
            .filter(o => !(o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'))))
            .reduce((sum, o) => {
                const orderCogs = (o.items || []).reduce((s, item) => {
                    const costVal = getLatestProductCost(item.productId, settings) || item.cost || 0;
                    return s + (costVal * item.quantity);
                }, 0);
                return sum + orderCogs;
            }, 0);
    }, [orders, settings]);

    const shipCompletedProfit = useMemo(() => {
        return orders
            .filter(o => completedStatuses.includes(o.status))
            .filter(o => !(o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'))))
            .reduce((sum, o) => {
                const { profit } = calculateOrderProfitLoss(o, settings);
                return sum + profit;
            }, 0);
    }, [orders, settings]);

    const shipCollectedShippingFee = useMemo(() => {
        return orders
            .filter(o => completedStatuses.includes(o.status))
            .filter(o => !(o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'))))
            .reduce((sum, o) => sum + (Number(o.shippingFee) || 0), 0);
    }, [orders]);

    const shipManualAdjustments = useMemo(() => {
        return orders
            .filter(o => completedStatuses.includes(o.status))
            .filter(o => !(o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'))))
            .reduce((sum, o) => {
                const { netRevenue } = calculateOrderProfitLoss(o, settings);
                const safeProductPrice = Number(o.productPrice) || 0;
                const safeShippingFee = Number(o.shippingFee) || 0;
                const safeTax = Number(o.tax) || 0;
                const safeDiscount = Number(o.discount) || 0;
                const safeAdvance = Number(o.advancePayment) || 0;
                
                const isPos = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'));
                const compFees = settings.companySpecificFees?.[o.shippingCompany];
                const useCustom = compFees?.useCustomFees ?? false;
                const inspectionCost = isPos ? 0 : (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0));
                const inspectionRevenue = (!isPos && o.includeInspectionFee !== false && o.inspectionFeePaidByCustomer !== false) ? inspectionCost : 0;
                const flexShipRevenue = (o.enableFlexShip && o.flexShipFeePaidByCustomer) ? (o.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;

                const baseExpectedRevenue = safeProductPrice + safeShippingFee + safeTax - safeDiscount + inspectionRevenue + flexShipRevenue;
                const diff = netRevenue - baseExpectedRevenue;
                return sum + diff;
            }, 0);
    }, [orders, settings]);

    const activeShippingExpenses = calcShippingExpenses === '' ? computedShippingExpenses : (Number(calcShippingExpenses) || 0);
    const activeShippingLosses = calcShippingLosses === '' ? computedShippingLosses : (Number(calcShippingLosses) || 0);
    
    // Active components for Mode B
    const activeCOGS = calcManualCOGS === '' ? shipCompletedCOGS : (Number(calcManualCOGS) || 0);
    const activeProfit = calcManualProfit === '' ? shipCompletedProfit : (Number(calcManualProfit) || 0);
    const activeCollectedShipping = calcManualCollectedShipping === '' ? shipCollectedShippingFee : (Number(calcManualCollectedShipping) || 0);
    const activeManualAdjustments = calcManualManualAdjustments === '' ? shipManualAdjustments : (Number(calcManualManualAdjustments) || 0);

    const totalDeposits = calcShippingDeposit + calcPartnerDeposit;
    const totalSalesCollection = activeCOGS + activeProfit + activeCollectedShipping + activeManualAdjustments;

    const totalDeductions = activeShippingExpenses + activeShippingLosses + calcOtherExpenses;

    const netWithdrawable = calcMode === 'deposits' 
        ? totalDeposits - totalDeductions 
        : calcMode === 'sales_withdrawal'
            ? totalSalesCollection - totalDeductions
            : calcMode === 'simple_net'
                ? activeCOGS + activeProfit + totalDeposits - activeShippingLosses
                : totalSalesCollection + totalDeposits - totalDeductions;

    const stats = useMemo(() => {
        // 1. Current Cash Balances
        // Main Wallet
        const rawMainWalletBalance = (wallet?.transactions || []).reduce((sum: number, t: any) => {
            const amount = Number(t.amount) || 0;
            if (t.category === 'supply_purchase' || t.category === 'supply_deposit' || t.category?.startsWith('supply_expense_')) return sum;
            if ((t.details?.paidByPartnerId || t.details?.expensePaidBy || t.note?.includes('دفعهم') || t.note?.includes('شريك')) && !t.note?.includes('المحفظة المركزية')) return sum;
            if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
            if (t.type === 'سحب') {
                if (t.details?.treasuryAccountId && t.details.treasuryAccountId !== 'main_wallet') return sum;
                return t.status === 'cancelled' ? sum : sum - amount;
            }
            if (t.type === 'تحويل') {
                if (t.category === 'treasury_sync') {
                    const treasuryTxId = t.id.replace('TR-', '');
                    const tTx = treasury?.transactions?.find((x: any) => x.id === treasuryTxId);
                    if (tTx) {
                        if (tTx.toAccountId === 'main_wallet') return sum + amount;
                        if (tTx.fromAccountId === 'main_wallet') return sum - amount;
                    } else if (t.note?.includes('إنستاباي') || t.note?.includes('بنك') || t.note?.includes('إيداع') || t.note?.includes('تحويل')) {
                        return sum + amount;
                    }
                }
                return sum;
            }
            return sum;
        }, 0);

        const autoClosingDiff = settings.enableAutoClosingDifference 
            ? Math.abs(orders
                .filter(o => ['تم_توصيلها', 'تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'مرتجع_جزئي'].includes(o.status))
                .reduce((sum, o) => sum + (calculateOrderProfitLoss(o, settings).closingDifference || 0), 0))
            : (settings.hiddenWalletAmount || 0);

        const mainWalletBalance = Math.max(0, rawMainWalletBalance - (settings.enableHiddenWalletAmount ? autoClosingDiff : 0));

        const supplyWalletBalance = Number(wallet?.supplyBalance) || 0;
        const accounts = treasury?.accounts || [];
        const treasuryAccountsBalance = accounts.reduce((sum: number, acc: any) => sum + (Number(acc.balance) || 0), 0);
        const totalCashLiquidity = mainWalletBalance + supplyWalletBalance + treasuryAccountsBalance;

        // 2. Inventory Value at Cost
        let inventoryValue = 0;
        const products = settings?.products || [];
        products.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const stock = v.stockQuantity ?? (v as any).stock ?? 0;
                    const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
                    inventoryValue += stock * cost;
                });
            } else {
                const stock = p.stockQuantity ?? (p as any).stock ?? 0;
                const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
                inventoryValue += stock * cost;
            }
        });

        // 3. Sold Products & Net Profit (for delivered/collected orders)
        const completedOrders = orders.filter(o => completedStatuses.includes(o.status));
        
        let totalCOGSOfSoldGoods = 0;
        let totalNetProfitOfSoldGoods = 0;

        let shipCompletedCount = 0;
        let shipCOGSOfSoldGoods = 0;
        let shipNetProfitOfSoldGoods = 0;

        let posCompletedCount = 0;
        let posCOGSOfSoldGoods = 0;
        let posNetProfitOfSoldGoods = 0;

        completedOrders.forEach(o => {
            const isPos = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'));
            const { profit } = calculateOrderProfitLoss(o, settings);
            const orderCogs = (o.items || []).reduce((sum, item) => {
                const costVal = getLatestProductCost(item.productId, settings) || item.cost || 0;
                return sum + (costVal * item.quantity);
            }, 0);

            totalNetProfitOfSoldGoods += profit;
            totalCOGSOfSoldGoods += orderCogs;

            if (isPos) {
                posCompletedCount++;
                posCOGSOfSoldGoods += orderCogs;
                posNetProfitOfSoldGoods += profit;
            } else {
                shipCompletedCount++;
                shipCOGSOfSoldGoods += orderCogs;
                shipNetProfitOfSoldGoods += profit;
            }
        });

        const totalProductRevenueRecovered = totalCOGSOfSoldGoods + totalNetProfitOfSoldGoods;
        const shipProductRevenueRecovered = shipCOGSOfSoldGoods + shipNetProfitOfSoldGoods;
        const posProductRevenueRecovered = posCOGSOfSoldGoods + posNetProfitOfSoldGoods;

        // 4. Expenses & Purchases
        // General expenses
        const adminExpenses = (wallet?.transactions || []).filter(t => t.type === 'سحب' && (t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_') || (settings?.expenseCategories || []).includes(t.category || '')));
        const totalAdminExpenses = adminExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        // Inventory purchases
        const stockPurchases = (wallet?.transactions || []).filter(t => t.category === 'inventory_purchase' || t.category === 'supply_purchase');
        const totalStockPurchases = stockPurchases.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        // 5. External balances
        let receivablesPending = orders
            .filter(o => o.status === 'تم_توصيلها' || (o.status === 'تم_التوصيل' && o.paymentStatus !== 'مدفوع'))
            .reduce((sum, o) => {
                const { netRevenue, carrierFees } = calculateOrderProfitLoss(o, settings);
                const advance = Number(o.advancePayment) || 0;
                return sum + Math.max(0, netRevenue - carrierFees - advance);
            }, 0);

        const suppliers = settings?.suppliers || [];
        const supplierPayables = suppliers.reduce((sum, s) => sum + Math.max(0, s.balance || 0), 0);

        // Total activity worth (رأس المال والنشاط الكلي)
        const totalActivityNetWorth = totalCashLiquidity + inventoryValue + receivablesPending - supplierPayables;

        return {
            mainWalletBalance,
            supplyWalletBalance,
            treasuryAccountsBalance,
            totalCashLiquidity,
            inventoryValue,
            totalCOGSOfSoldGoods,
            totalNetProfitOfSoldGoods,
            totalProductRevenueRecovered,
            shipCompletedCount,
            shipCOGSOfSoldGoods,
            shipNetProfitOfSoldGoods,
            shipProductRevenueRecovered,
            posCompletedCount,
            posCOGSOfSoldGoods,
            posNetProfitOfSoldGoods,
            posProductRevenueRecovered,
            totalAdminExpenses,
            totalStockPurchases,
            receivablesPending,
            supplierPayables,
            totalActivityNetWorth
        };
    }, [orders, settings, wallet, treasury]);

    return (
        <div className="space-y-8 animate-in fade-in-5 duration-300 text-right" dir="rtl">
            {/* Introductory Header */}
            <div className="bg-gradient-to-l from-purple-50 to-indigo-50 dark:from-slate-800/40 dark:to-slate-900/40 border border-purple-100 dark:border-slate-800 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Sparkles className="text-amber-500" /> مطابقة السيولة النقدية ورأس المال للنشاط (معايا كام؟)
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    هذا الكشف مصمم خصيصاً لمطابقة ثروة مشروعك بالكامل والسيولة المتوفرة لديك. يوضح لك الكشف بالضبط كيف تحولت أموالك بين 
                    شراء بضاعة جديدة (مخزون)، وبيع بضاعة (استرداد التكلفة + صافي الأرباح)، وسحب المصاريف الإدارية والتشغيلية، لنخرج بالقيمة الإجمالية الصافية المتوفرة لديك حالياً.
                </p>
            </div>

            {/* Ultimate KPI displays */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-16 -translate-y-16" />
                    <div>
                        <span className="text-sm font-bold bg-white/20 px-3.5 py-1 rounded-full text-white/90">إجمالي ملاءة النشاط ورأس المال الحالي (معايا كام؟)</span>
                        <h2 className="text-4xl lg:text-5xl font-black mt-4 leading-none">{stats.totalActivityNetWorth.toLocaleString('ar-EG')} <span className="text-lg">ج.م</span></h2>
                        <p className="text-xs text-purple-100 mt-3 leading-relaxed font-medium">
                            هذه هي القيمة الفعلية الكلية لمشروعك الآن (السيولة الكاش + بضاعة المخازن بالتكلفة + الأموال المعلقة لدى الشحن - مديونيات الموردين).
                        </p>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-purple-100/90 font-mono">
                        المعادلة: السيولة ({stats.totalCashLiquidity.toLocaleString('ar-EG')}) + المخزون ({stats.inventoryValue.toLocaleString('ar-EG')}) + معلقات الشحن ({stats.receivablesPending.toLocaleString('ar-EG')}) - ديون الموردين ({stats.supplierPayables.toLocaleString('ar-EG')})
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-bold">السيولة النقدية الحاضرة (كاش فعلي)</span>
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
                                <WalletIcon size={20} />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-4">{stats.totalCashLiquidity.toLocaleString('ar-EG')} <span className="text-sm">ج.م</span></h3>
                        <p className="text-xs text-slate-450 dark:text-slate-400 mt-2">
                            النقدية الجاهزة حالياً للاستخدام في جميع الخزائن ومحفظة التوريد والعهد.
                        </p>
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div>
                            <span className="text-slate-400 block font-medium">المحفظة العامة</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200 block mt-1">{stats.mainWalletBalance.toLocaleString('ar-EG')}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">محفظة التوريد</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200 block mt-1">{stats.supplyWalletBalance.toLocaleString('ar-EG')}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">حسابات وبنوك</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200 block mt-1">{stats.treasuryAccountsBalance.toLocaleString('ar-EG')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Special Educational Formula explaining the COGS + Profit relation */}
            <div className="bg-amber-50/50 dark:bg-amber-950/10 border-2 border-dashed border-amber-200 dark:border-amber-800/50 p-6 rounded-2xl">
                <h4 className="font-black text-amber-800 dark:text-amber-400 flex items-center gap-2 mb-3">
                    <AlertCircle size={18} /> كيف تنظر للطلبات المباعة ومطابقتها؟ (توضيح هام)
                </h4>
                <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <p>
                        عندما تبيع منتجاً (أوردر ناجح)، فإن المبلغ المستلم من العميل يتكون من شقين:
                    </p>
                    <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl font-mono text-center flex flex-col md:flex-row justify-center items-center gap-2 text-sm border border-amber-100 dark:border-amber-900/30">
                        <span className="font-black text-slate-800 dark:text-white">تكلفة البضاعة المباعة (COGS)</span>
                        <span className="text-slate-400 font-bold">+</span>
                        <span className="font-black text-emerald-600">صافي الربح الفعلي</span>
                        <span className="text-slate-400 font-bold">=</span>
                        <span className="font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-lg">إجمالي قيمة البيع (أصل التكلفة مسترداً + الربح)</span>
                    </div>
                    <p>
                        <strong className="text-indigo-600 dark:text-indigo-400">💡 مثال توضيحي:</strong> في أوردر العميل <strong className="font-bold">"سيد المجري"</strong>، كانت تكلفة المنتجات بالمستجر هي <span className="font-mono font-bold text-slate-800 dark:text-slate-200">1,237.5 ج.م</span> وحققت صافي ربح قدره <span className="font-mono font-bold text-emerald-600">289.07 ج.م</span>. وبذلك دخل محفظتك مبلغ <span className="font-mono font-bold text-indigo-600">1,526.57 ج.م</span> وهو يمثل بالكامل <span className="underline decoration-indigo-300">استرداد قيمة رأس مال بضاعتك التي خرجت من المستودع لتشتري بها بضاعة جديدة</span> مضافاً إليها <span className="underline decoration-emerald-300">ربحك الحقيقي</span> لتغطية مصاريفك!
                    </p>
                </div>
            </div>

            {/* Bento Grid - Five Key Pillars of Wealth Reconciliation */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Pillar 1: Inventory Value at Cost */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 border-b border-blue-100 dark:border-blue-800/50 flex justify-between items-center">
                        <h4 className="font-black text-blue-800 dark:text-blue-400 flex items-center gap-2 text-sm">
                            <Package size={16} /> 1. قيمة بضاعة المخزن (بالتكلفة)
                        </h4>
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">بالمستودع</span>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">قيمة الستوك الحالي بالتكلفة</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{stats.inventoryValue.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed border-t pt-3">
                            يمثل رأس مال بضائعك المتواجدة حالياً على الرفوف والتي لم تُبع بعد. عند الشراء يزداد هذا البند ويقل الكاش، وعند البيع يقل هذا البند ويزداد الكاش.
                        </p>
                    </div>
                </div>

                {/* Pillar 2: Sold Products and Returned Value (Separated Shipping & POS) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm md:col-span-2 lg:col-span-1">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 border-b border-emerald-100 dark:border-emerald-800/50 flex justify-between items-center">
                        <h4 className="font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2 text-sm">
                            <TrendingUp size={16} /> 2. البضاعة المباعة المستردة
                        </h4>
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">مبيعات ناجحة</span>
                    </div>
                    <div className="p-4 space-y-3">
                        {/* Shipping segment */}
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                                    <Truck size={13} /> طلبات الشحن ({stats.shipCompletedCount})
                                </span>
                                <span className="text-xs font-black text-indigo-800 dark:text-indigo-300">{stats.shipProductRevenueRecovered.toLocaleString('ar-EG')} ج.م</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                    <span className="text-slate-450 block">التكلفة (COGS):</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{stats.shipCOGSOfSoldGoods.toLocaleString('ar-EG')}</span>
                                </div>
                                <div>
                                    <span className="text-emerald-600 block">صافي الربح:</span>
                                    <span className="font-bold text-emerald-600">+{stats.shipNetProfitOfSoldGoods.toLocaleString('ar-EG')}</span>
                                </div>
                            </div>
                        </div>

                        {/* POS segment */}
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <ShoppingCart size={13} /> نقاط البيع POS ({stats.posCompletedCount})
                                </span>
                                <span className="text-xs font-black text-amber-800 dark:text-amber-300">{stats.posProductRevenueRecovered.toLocaleString('ar-EG')} ج.م</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                    <span className="text-slate-450 block">التكلفة (COGS):</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{stats.posCOGSOfSoldGoods.toLocaleString('ar-EG')}</span>
                                </div>
                                <div>
                                    <span className="text-emerald-600 block">صافي الربح:</span>
                                    <span className="font-bold text-emerald-600">+{stats.posNetProfitOfSoldGoods.toLocaleString('ar-EG')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xs font-bold border-t pt-2 text-slate-800 dark:text-slate-200">
                            <span>إجمالي المسترد (تكلفة + ربح)</span>
                            <span className="font-black text-emerald-600">{stats.totalProductRevenueRecovered.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                    </div>
                </div>

                {/* Pillar 3: Outflow Payments (Purchases & Expenses) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-rose-50 dark:bg-rose-900/10 p-4 border-b border-rose-100 dark:border-rose-800/50 flex justify-between items-center">
                        <h4 className="font-black text-rose-800 dark:text-rose-400 flex items-center gap-2 text-sm">
                            <TrendingDown size={16} /> 3. المدفوعات والمصروفات الخارجة
                        </h4>
                        <span className="text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded font-bold">تدفقات خارجة</span>
                    </div>
                    <div className="p-6 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">مشتريات بضائع جديدة (تخزين)</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">-{stats.totalStockPurchases.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-rose-600">
                            <span className="font-bold">المصروفات الإدارية والتشغيلية</span>
                            <span className="font-bold">-{stats.totalAdminExpenses.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-550 border-t pt-2.5">
                            <span>إجمالي المصروفات والمشتريات</span>
                            <span className="font-bold">{(stats.totalStockPurchases + stats.totalAdminExpenses).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed pt-2">
                            مشتريات البضاعة تخرج من الكاش وتتحول لستوك بالمخزن، بينما المصروفات تخرج من الكاش نهائياً لتغطية العمليات.
                        </p>
                    </div>
                </div>

                {/* Pillar 4: External Receivables (معلقات الشحن) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 border-b border-indigo-100 dark:border-indigo-800/50 flex justify-between items-center">
                        <h4 className="font-black text-indigo-800 dark:text-indigo-400 flex items-center gap-2 text-sm">
                            <Truck size={16} /> 4. أموال معلقة بالخارج (ذمم شحن)
                        </h4>
                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-bold">مع شركات الشحن</span>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">مستحقات معلقة للاستلام</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{stats.receivablesPending.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed border-t pt-3">
                            هذه المبالغ تقع ضمن ثروة مشروعك ورأس مالك الفعلي ولكنها مؤجلة الكاش حالياً لحين إيداع شركات الشحن للمبالغ المحصلة في حساباتك.
                        </p>
                    </div>
                </div>

                {/* Pillar 5: Supplier Payables (ديون الموردين) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 border-b border-amber-100 dark:border-amber-800/50 flex justify-between items-center">
                        <h4 className="font-black text-amber-800 dark:text-amber-400 flex items-center gap-2 text-sm">
                            <Users size={16} /> 5. مديونيات معلقة للموردين
                        </h4>
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-bold">التزامات آجلة</span>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center text-sm text-rose-600">
                            <span>إجمالي مستحقات الموردين الآجلة</span>
                            <span className="font-bold">-{stats.supplierPayables.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed border-t pt-3">
                            المبالغ المعلقة التي قمت بشراء ستوك بضاعة بها بالآجل، ويجب تسديدها للموردين مستقبلاً من سيولتك النقدية.
                        </p>
                    </div>
                </div>

                {/* Summary Reconcile Statement Info Card */}
                <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
                    <div>
                        <h4 className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-2">
                            <CheckCircle2 className="text-emerald-500" size={16} /> خلاصة الملاءة الشاملة
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2.5">
                            عندما تجد أن مجموع كاش مشروعك + بضاعة مخازنك + مستحقات شركات الشحن مطروحاً منه ديون الموردين يساوي بدقة رأس مالك الفعلي مضافاً إليه صافي ربحك الحقيقي، فهذا يدل على أن <strong className="text-slate-700 dark:text-slate-300 font-bold">دورة الحسابات والسيولة لديك سليمة 100% ومضبوطة محاسبياً.</strong>
                        </p>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-center">
                        مركز التحليلات المالية الذكية 🔮
                    </div>
                </div>

            </div>

            {/* Interactive Withdrawal & Shipping Losses Calculator */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                <div className="border-b pb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <WalletIcon size={20} className="text-emerald-600" /> حاسبة سحب السيولة الصافية من شركات الشحن والمحفظة
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            احسب المبلغ الدقيق والآمن القابل للسحب بناءً على مستحقات المبيعات (التكلفة + الأرباح + الشحن المحصل + فروق التقفيل اليدوي) مضافاً إليها باقي الإيداعات بعد تسوية مصاريف الشحن وخسائر المرتجعات.
                        </p>
                    </div>

                    {/* Mode selector tab */}
                    <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 self-start xl:self-center">
                        <button
                            onClick={() => setCalcMode('sales_plus_deposits')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                calcMode === 'sales_plus_deposits'
                                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            سحب شامل (المستحقات + باقي الإيداعات)
                        </button>
                        <button
                            onClick={() => setCalcMode('sales_withdrawal')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                calcMode === 'sales_withdrawal'
                                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            سحب مستحقات المبيعات فقط
                        </button>
                        <button
                            onClick={() => setCalcMode('deposits')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                calcMode === 'deposits'
                                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            سحب إيداعات المحفظة فقط
                        </button>
                        <button
                            onClick={() => setCalcMode('simple_net')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                calcMode === 'simple_net'
                                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            سحب مبسط (تكلفة + ربح + إيداعات - خسائر)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Input controls (col-span-5) */}
                    <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider border-b pb-2 flex justify-between items-center">
                            <span>مدخلات التجميع والعمليات</span>
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                {calcMode === 'sales_plus_deposits' ? 'الحسبة الشاملة (طلبك)' : calcMode === 'sales_withdrawal' ? 'طريقة المبيعات المحصلة' : 'طريقة الإيداعات الشخصية'}
                            </span>
                        </h4>
                        
                        {/* Render Sales Inputs if sales_plus_deposits or sales_withdrawal */}
                        {(calcMode === 'sales_plus_deposits' || calcMode === 'sales_withdrawal') && (
                            <div className="space-y-3">
                                {calcMode === 'sales_plus_deposits' && (
                                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-lg">
                                        أولاً: مستحقات مبيعات الأوردرات الناجحة:
                                    </div>
                                )}
                                {/* COGS input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                        <span>تكلفة الطلبات (COGS)</span>
                                        <span className="text-[10px] text-emerald-600 font-bold">تلقائي: {shipCompletedCOGS.toLocaleString('ar-EG')} ج.م</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={calcManualCOGS}
                                            onChange={(e) => setCalcManualCOGS(e.target.value)}
                                            className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            placeholder={`${shipCompletedCOGS} (تلقائي)`}
                                        />
                                        <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                                    </div>
                                </div>

                                {/* Net Profit input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                        <span>صافي الربح</span>
                                        <span className="text-[10px] text-emerald-600 font-bold">تلقائي: {shipCompletedProfit.toLocaleString('ar-EG')} ج.م</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={calcManualProfit}
                                            onChange={(e) => setCalcManualProfit(e.target.value)}
                                            className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            placeholder={`${shipCompletedProfit} (تلقائي)`}
                                        />
                                        <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                                    </div>
                                </div>

                                {/* Collected Shipping input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                        <span>الشحن المحصل من العملاء</span>
                                        <span className="text-[10px] text-emerald-600 font-bold">تلقائي: {shipCollectedShippingFee.toLocaleString('ar-EG')} ج.م</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={calcManualCollectedShipping}
                                            onChange={(e) => setCalcManualCollectedShipping(e.target.value)}
                                            className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            placeholder={`${shipCollectedShippingFee} (تلقائي)`}
                                        />
                                        <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                                    </div>
                                </div>

                                {/* Manual Adjustments (Closing differences) input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                        <span>فرق التقفيل اليدوي ف المحفظة</span>
                                        <span className="text-[10px] text-emerald-600 font-bold">تلقائي: {shipManualAdjustments.toLocaleString('ar-EG')} ج.م</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={calcManualManualAdjustments}
                                            onChange={(e) => setCalcManualManualAdjustments(e.target.value)}
                                            className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            placeholder={`${shipManualAdjustments} (تلقائي)`}
                                        />
                                        <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Render Deposits Inputs if sales_plus_deposits or deposits */}
                        {(calcMode === 'sales_plus_deposits' || calcMode === 'deposits') && (
                            <div className="space-y-3 pt-2">
                                {calcMode === 'sales_plus_deposits' && (
                                    <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-lg border-t border-slate-200/60 dark:border-slate-700/60">
                                        ثانياً: رصيد إيداعات الشحن والشركاء:
                                    </div>
                                )}
                                {/* Shipping deposit */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                        <span>إيداع الشحن المالي</span>
                                        <span className="text-[10px] text-slate-400">مثال: 1500 + 115 للبص</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={calcShippingDeposit}
                                            onChange={(e) => setCalcShippingDeposit(Math.max(0, Number(e.target.value) || 0))}
                                            className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            placeholder="0"
                                        />
                                        <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                                    </div>
                                </div>

                                {/* Partner deposit */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                        <span>إيداعات الشركاء الإضافية</span>
                                        <span className="text-[10px] text-slate-400">مثال: 2500 لزهرة والبص</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={calcPartnerDeposit}
                                            onChange={(e) => setCalcPartnerDeposit(Math.max(0, Number(e.target.value) || 0))}
                                            className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            placeholder="0"
                                        />
                                        <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="border-t pt-3 my-2 border-slate-200/60 dark:border-slate-700/60">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">المصروفات والخصومات المشتركة</h5>
                        </div>

                        {/* Shipping Expenses override */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                <span>مصاريف الشحن للطلبات (ناجحة)</span>
                                <span className="text-[10px] text-rose-600 font-bold">تلقائي: {computedShippingExpenses.toLocaleString('ar-EG')} ج.م</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={calcShippingExpenses}
                                    onChange={(e) => setCalcShippingExpenses(e.target.value)}
                                    className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder={`${computedShippingExpenses} (تلقائي)`}
                                />
                                <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                            </div>
                        </div>

                        {/* Shipping Losses override */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                <span>خسائر الشحن للأوردرات المرتجعة</span>
                                <span className="text-[10px] text-rose-600 font-bold">تلقائي: {computedShippingLosses.toLocaleString('ar-EG')} ج.م</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={calcShippingLosses}
                                    onChange={(e) => setCalcShippingLosses(e.target.value)}
                                    className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder={`${computedShippingLosses} (تلقائي)`}
                                />
                                <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                            </div>
                        </div>

                        {/* Other expenses */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                أي مصروفات أو خصومات إضافية أخرى
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={calcOtherExpenses}
                                    onChange={(e) => setCalcOtherExpenses(Math.max(0, Number(e.target.value) || 0))}
                                    className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="0"
                                />
                                <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                            </div>
                        </div>

                        {/* Hidden Wallet Amount (Display setting) */}
                        <div className="space-y-1.5 border-t border-dashed border-slate-200 dark:border-slate-700 pt-4 mt-2">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                                    مبلغ مخفي من المحفظة (فرق التقفيل)
                                </label>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={enableHidden}
                                        onChange={(e) => setEnableHidden(e.target.checked)}
                                    />
                                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-rose-500"></div>
                                </label>
                            </div>
                            
                            {settings.enableHiddenWalletAmount && settings.hiddenWalletAmount ? (
                                <div className="mb-2">
                                    <span className="text-[10px] text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-lg">
                                        نشط حالياً: {settings.hiddenWalletAmount.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </div>
                            ) : null}

                            <div className={`space-y-2 transition-all duration-300 ${enableHidden ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={hiddenAmount}
                                        onChange={(e) => setHiddenAmount(e.target.value)}
                                        className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 pl-12 rounded-xl text-right focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                                        placeholder="القيمة"
                                    />
                                    <span className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">ج.م</span>
                                </div>
                                <button 
                                    onClick={handleSaveHiddenAmount}
                                    className="w-full py-2 bg-rose-600 dark:bg-rose-700 text-white text-[10px] font-black rounded-xl hover:bg-rose-700 transition-colors shadow-sm"
                                >
                                    حفظ وتطبيق فرق التقفيل
                                </button>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-tight">يتم خصم هذا المبلغ من رصيد "المحفظة العامة" المعروض في هذا التقرير فقط (أغراض الخصوصية أو التقفيل اليدوي).</p>
                        </div>
                    </div>

                    {/* Results & Explanation breakdown (col-span-7) */}
                    <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
                        <div className="space-y-3 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 p-5 rounded-2xl">
                            <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                                <CheckCircle2 size={16} /> المبلغ المتبقي القابل للسحب بأمان من شركة الشحن
                            </h4>
                            
                            <div className="py-4 border-y border-emerald-100 dark:border-emerald-900/50">
                                <span className="text-xs text-slate-500 block">صافي رصيدك المتاح للسحب الآن</span>
                                <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                                    {netWithdrawable.toLocaleString('ar-EG')} <span className="text-sm font-bold">ج.م</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                                <div>
                                    <span className="text-slate-500 block">
                                        {calcMode === 'deposits' ? 'إجمالي المودع (رأس مال):' : 'إجمالي المستحقات والمبيعات المحصلة:'}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-white">
                                        {calcMode === 'deposits' 
                                            ? totalDeposits.toLocaleString('ar-EG') 
                                            : calcMode === 'sales_withdrawal'
                                                ? totalSalesCollection.toLocaleString('ar-EG')
                                                : (totalSalesCollection + totalDeposits).toLocaleString('ar-EG')
                                        } ج.م
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">إجمالي الخصومات والمصاريف:</span>
                                    <span className="font-bold text-rose-600">-{totalDeductions.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                            </div>
                        </div>

                        {/* Detailed math explanation matching user request */}
                        <div className="bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl space-y-3">
                            <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                <AlertCircle size={14} /> شرح الحسبة والخصومات بطريقة محاسبية مبسطة:
                            </h4>
                            <ul className="text-xs leading-relaxed text-slate-650 dark:text-slate-350 space-y-2.5 list-disc list-inside">
                                {calcMode === 'sales_plus_deposits' ? (
                                    <>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">مستحقات المبيعات المحصلة:</strong> تتكون من تكلفة البضاعة المباعة <span className="font-bold text-slate-800 dark:text-slate-200">{activeCOGS.toLocaleString('ar-EG')} ج.م</span> + صافي الأرباح <span className="font-bold text-slate-800 dark:text-slate-200">{activeProfit.toLocaleString('ar-EG')} ج.م</span> + الشحن المحصل <span className="font-bold text-slate-800 dark:text-slate-200">{activeCollectedShipping.toLocaleString('ar-EG')} ج.م</span> + فرق التقفيل اليدوي في المحفظة <span className="font-bold text-slate-800 dark:text-slate-200">{activeManualAdjustments.toLocaleString('ar-EG')} ج.م</span>. (المجموع = <span className="font-bold text-indigo-600">{totalSalesCollection.toLocaleString('ar-EG')} ج.م</span>).
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">إيداعات الشحن والشركاء:</strong> قمت بإيداع <span className="font-bold text-slate-800 dark:text-slate-200">{(calcShippingDeposit + calcPartnerDeposit).toLocaleString('ar-EG')} ج.م</span> في المحفظة كأرصدة إضافية.
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">إجمالي الخصومات والمصاريف:</strong> تحتجز شركة الشحن رسوم التوصيل الناجح <span className="font-bold text-rose-500">{activeShippingExpenses.toLocaleString('ar-EG')} ج.م</span> وتخصم رسوم المرتجعات الفاشلة <span className="font-bold text-rose-500">{activeShippingLosses.toLocaleString('ar-EG')} ج.م</span> + مصاريف أخرى بقيمة <span className="font-bold text-rose-500">{calcOtherExpenses.toLocaleString('ar-EG')} ج.م</span> (المجموع = <span className="font-bold text-rose-600">-{totalDeductions.toLocaleString('ar-EG')} ج.م</span>).
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">الباقي من رصيد الإيداعات:</strong> المتبقي من إيداعك بعد المصاريف والخسائر هو <span className="font-bold text-emerald-600">{(totalDeposits - totalDeductions).toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li className="font-bold text-slate-800 dark:text-white bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-150 dark:border-emerald-900/30">
                                            💡 المعادلة (طلبك): [ {totalSalesCollection.toLocaleString('ar-EG')} (المبيعات المحصلة) ] + [ { (totalDeposits - totalDeductions).toLocaleString('ar-EG') } (باقي رصيد إيداعات الشحن والشركاء بعد خصم المصاريف والخسائر) ] = <span className="text-emerald-600 font-black">{netWithdrawable.toLocaleString('ar-EG')} ج.م</span> وهو الصافي الكلي الآمن القابل للسحب.
                                        </li>
                                    </>
                                ) : calcMode === 'sales_withdrawal' ? (
                                    <>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">إجمالي مستحقاتك الكلية:</strong> تتكون من تكلفة البضاعة المباعة <span className="font-bold text-slate-800 dark:text-slate-200">{activeCOGS.toLocaleString('ar-EG')} ج.م</span> + صافي أرباحك <span className="font-bold text-slate-800 dark:text-slate-200">{activeProfit.toLocaleString('ar-EG')} ج.م</span> + قيمة مصاريف الشحن المحصلة من العملاء <span className="font-bold text-slate-800 dark:text-slate-200">{activeCollectedShipping.toLocaleString('ar-EG')} ج.م</span> + فرق التقفيل اليدوي في المحفظة <span className="font-bold text-slate-800 dark:text-slate-200">{activeManualAdjustments.toLocaleString('ar-EG')} ج.م</span>. المجموع الكلي المستحق لك هو <span className="font-bold text-indigo-600">{totalSalesCollection.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">خصم مصاريف الشحن الفعلي:</strong> شركة الشحن تحتجز رسوم الشحن (التوصيل) الفعلي للأوردرات الناجحة وقيمتها <span className="font-bold text-rose-500">{activeShippingExpenses.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">خصم خسائر شحن المرتجعات:</strong> عند إرجاع الطلبات الفاشلة، تخصم شركة الشحن رسوم شحن المرتجع ولا يتم تحصيل شيء من العميل، مما يعتبر خسارة صافية قدرها <span className="font-bold text-rose-500">{activeShippingLosses.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li className="font-bold text-slate-800 dark:text-white bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100/40 dark:border-indigo-900/20">
                                            💡 المعادلة: [ {totalSalesCollection.toLocaleString('ar-EG')} (مستحقاتك) ] - [ {activeShippingExpenses.toLocaleString('ar-EG')} (الشحن الناجح) + {activeShippingLosses.toLocaleString('ar-EG')} (خسائر المرتجعات) + {calcOtherExpenses.toLocaleString('ar-EG')} (أي مصروفات أخرى) ] = <span className="text-emerald-600 font-black">{netWithdrawable.toLocaleString('ar-EG')} ج.م</span> وهو صافي المبلغ المتبقي والقابل للسحب بأمان من حسابك لدى شركة الشحن.
                                        </li>
                                    </>
                                ) : calcMode === 'simple_net' ? (
                                    <>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">مستحقات المبيعات المباشرة:</strong> تتكون من تكلفة البضاعة <span className="font-bold text-slate-800 dark:text-slate-200">{activeCOGS.toLocaleString('ar-EG')} ج.م</span> + صافي أرباحك <span className="font-bold text-slate-800 dark:text-slate-200">{activeProfit.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">إيداعات الشحن والشركاء:</strong> المبالغ المودعة مسبقاً في المحفظة وقدرها <span className="font-bold text-indigo-600">{totalDeposits.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">خصم خسائر المرتجعات (فقط):</strong> يتم خصم خسائر شحن الأوردرات المرتجعة الفاشلة من المجموع <span className="font-bold text-rose-500">{activeShippingLosses.toLocaleString('ar-EG')} ج.م</span>. 
                                            <br/><span className="text-[10px] text-slate-500">ملاحظة: هذا النمط يستبعد الشحن المحصل والشحن المدفوع والتسويات الأخرى باعتبارهم متطابقين تقريباً.</span>
                                        </li>
                                        <li className="font-bold text-slate-800 dark:text-white bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-100/40 dark:border-emerald-900/20">
                                            💡 المعادلة (حسب طلبك): [ {activeCOGS.toLocaleString('ar-EG')} (تكلفة) ] + [ {activeProfit.toLocaleString('ar-EG')} (ربح) ] + [ {totalDeposits.toLocaleString('ar-EG')} (إيداعات) ] - [ {activeShippingLosses.toLocaleString('ar-EG')} (خسائر مرتجعات) ] = <span className="text-emerald-600 font-black">{netWithdrawable.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                    </>
                                ) : (
                                    <>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">الإيداعات (السيولة المتاحة أصلاً):</strong> قمت بإيداع <span className="font-bold text-slate-800 dark:text-slate-200">{calcShippingDeposit.toLocaleString('ar-EG')} ج.م</span> (وهو مبلغ 1500 + 115 شحن البص) بالإضافة إلى <span className="font-bold text-slate-800 dark:text-slate-200">{calcPartnerDeposit.toLocaleString('ar-EG')} ج.م</span> للشريك زهرة والبص في المحفظة، مما يجعل مجموع كاش الإيداع الكلي بالمحفظة هو <span className="font-bold text-indigo-600">{totalDeposits.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">مصاريف الشحن الفعلي:</strong> شركة الشحن تخصم رسوم الشحن (التوصيل) للطلبات التي تم تسليمها بنجاح للعملاء. في هذه الفترة بلغت <span className="font-bold text-rose-500">{activeShippingExpenses.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li>
                                            <strong className="text-slate-800 dark:text-white">خسائر المرتجعات (خسائر شحن فاشل):</strong> عندما يفشل أوردر ويرجع بالكامل، فإن شركة الشحن تخصم قيمة شحن المرتجع ولا يتم تحصيل أي مبيعات من العميل، مما يعتبر خسارة صافية من محفظتك. في هذه الفترة بلغت خسائر المرتجعات <span className="font-bold text-rose-500">{activeShippingLosses.toLocaleString('ar-EG')} ج.م</span>.
                                        </li>
                                        <li className="font-bold text-slate-800 dark:text-white bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100/40 dark:border-indigo-900/20">
                                            💡 المعادلة: [ {totalDeposits.toLocaleString('ar-EG')} (المودع) ] - [ {activeShippingExpenses.toLocaleString('ar-EG')} (الشحن الناجح) + {activeShippingLosses.toLocaleString('ar-EG')} (خسائر المرتجعات) + {calcOtherExpenses.toLocaleString('ar-EG')} (مصاريف أخرى) ] = <span className="text-emerald-600 font-black">{netWithdrawable.toLocaleString('ar-EG')} ج.م</span> وهو المبلغ الصافي المتبقي القابل للسحب.
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>

                        <div className="mt-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                <WalletIcon size={16} className="text-slate-500" /> مقارنة مع رصيد المحفظة الفعلي
                            </h4>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4 text-sm">
                                    <div>
                                        <span className="block text-xs text-slate-500 mb-0.5">الرصيد الفعلي (الآن)</span>
                                        <span className="font-black text-slate-800 dark:text-white text-lg">{stats.mainWalletBalance.toLocaleString('ar-EG')} ج.م</span>
                                    </div>
                                    <div className="text-slate-300 dark:text-slate-700 font-light text-2xl">-</div>
                                    <div>
                                        <span className="block text-xs text-slate-500 mb-0.5">الرصيد المحسوب (أعلاه)</span>
                                        <span className="font-black text-slate-800 dark:text-white text-lg">{netWithdrawable.toLocaleString('ar-EG')} ج.م</span>
                                    </div>
                                </div>
                                <div className="text-left bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm min-w-[120px]">
                                    <span className="block text-[10px] text-slate-500 font-bold uppercase mb-1">الفرق</span>
                                    <span className={`font-black text-xl ${(stats.mainWalletBalance - netWithdrawable) > 0 ? 'text-emerald-600' : (stats.mainWalletBalance - netWithdrawable) < 0 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {((stats.mainWalletBalance - netWithdrawable) > 0 ? '+' : '')}{(stats.mainWalletBalance - netWithdrawable).toLocaleString('ar-EG')} ج.م
                                    </span>
                                </div>
                            </div>
                            {Math.abs(stats.mainWalletBalance - netWithdrawable) > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">💡 من أين يأتي هذا الفرق؟ عادةً ينتج عن:</p>
                                    <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1.5 marker:text-indigo-400">
                                        <li><strong>أوردرات الكاشير (نقطة البيع POS):</strong> الحاسبة أعلاه مخصصة لشركات الشحن واستبعدت أوردرات الكاشير (البيع المباشر)، بينما أرباحها تدخل في المحفظة الفعلية.</li>
                                        <li><strong>إيداعات / سحوبات أخرى:</strong> وجود إيداعات نقدية أو سحوبات ومصروفات (تسويات، ضرائب، استبدالات) مسجلة في المحفظة ولم تدخلها يدوياً في خانات "الإيداعات الإضافية" أو "المصروفات الأخرى".</li>
                                        <li><strong>اختلاف تكلفة أو رسوم الأوردرات:</strong> فروقات دقيقة بين المصروفات المحسوبة في الحاسبة وبين ما تم تقفيله وتسويته فعلياً كإيداعات في حركات المحفظة.</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Orders Breakdown Tables */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Receipt size={20} className="text-indigo-600" /> تفاصيل العمليات المباعة والمستردة
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            قائمة تفصيلية بالأوردرات المسلمة وعمليات الكاشير لحساب التكلفة والربح لكل عملية بدقة.
                        </p>
                    </div>
                    
                    {/* Switcher tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-center">
                        <button
                            onClick={() => setActiveDetailTab('shipping')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                activeDetailTab === 'shipping'
                                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                            }`}
                        >
                            <Truck size={14} /> طلبات الشحن ({stats.shipCompletedCount})
                        </button>
                        <button
                            onClick={() => setActiveDetailTab('pos')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                activeDetailTab === 'pos'
                                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                            }`}
                        >
                            <ShoppingCart size={14} /> نقاط البيع POS ({stats.posCompletedCount})
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {activeDetailTab === 'shipping' ? (
                        <table className="w-full text-right border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b">
                                    <th className="p-3 font-bold text-right">العميل / كود الطلب</th>
                                    <th className="p-3 font-bold text-right">المنتجات</th>
                                    <th className="p-3 font-bold text-right">مبلغ التحصيل من العميل</th>
                                    <th className="p-3 font-bold text-right">تكلفة البضاعة (COGS)</th>
                                    <th className="p-3 font-bold text-right">صافي الربح الفعلي</th>
                                    <th className="p-3 font-bold text-right">المسترد بالكامل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {orders
                                    .filter(o => completedStatuses.includes(o.status))
                                    .filter(o => !(o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'))))
                                    .map(o => {
                                        const { profit, netRevenue } = calculateOrderProfitLoss(o, settings);
                                        const orderCogs = (o.items || []).reduce((sum, item) => {
                                            const costVal = getLatestProductCost(item.productId, settings) || item.cost || 0;
                                            return sum + (costVal * item.quantity);
                                        }, 0);
                                        const totalRecovered = orderCogs + profit;
                                        return (
                                            <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-800 dark:text-white">{o.customerName || 'عميل مجهول'}</div>
                                                    <div className="text-[10px] text-slate-450 mt-0.5">#{o.orderNumber || o.id}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="space-y-1">
                                                        {(o.items || []).map((item, i) => (
                                                            <div key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                                                                {item.name} <span className="text-slate-400">(x{item.quantity})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{(netRevenue).toLocaleString('ar-EG')} ج.م</td>
                                                <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{(orderCogs).toLocaleString('ar-EG')} ج.م</td>
                                                <td className="p-3 font-mono font-bold text-emerald-600">+{profit.toLocaleString('ar-EG')} ج.م</td>
                                                <td className="p-3 font-mono font-bold text-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 rounded">{(totalRecovered).toLocaleString('ar-EG')} ج.م</td>
                                            </tr>
                                        );
                                    })}
                                {stats.shipCompletedCount === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                            لا توجد طلبات شحن مباعة في هذه الفترة.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-right border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b">
                                    <th className="p-3 font-bold text-right">رقم العملية / الكاشير</th>
                                    <th className="p-3 font-bold text-right">المنتجات</th>
                                    <th className="p-3 font-bold text-right">إجمالي المبيعات</th>
                                    <th className="p-3 font-bold text-right">تكلفة البضاعة (COGS)</th>
                                    <th className="p-3 font-bold text-right">صافي الربح الفعلي</th>
                                    <th className="p-3 font-bold text-right">المسترد بالكامل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {orders
                                    .filter(o => completedStatuses.includes(o.status))
                                    .filter(o => o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-')))
                                    .map(o => {
                                        const { profit, netRevenue } = calculateOrderProfitLoss(o, settings);
                                        const orderCogs = (o.items || []).reduce((sum, item) => {
                                            const costVal = getLatestProductCost(item.productId, settings) || item.cost || 0;
                                            return sum + (costVal * item.quantity);
                                        }, 0);
                                        const totalRecovered = orderCogs + profit;
                                        return (
                                            <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-800 dark:text-white">{o.customerName || 'مبيعات كاشير مباشر'}</div>
                                                    <div className="text-[10px] text-slate-450 mt-0.5">#{o.orderNumber || o.id}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="space-y-1">
                                                        {(o.items || []).map((item, i) => (
                                                            <div key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                                                                {item.name} <span className="text-slate-400">(x{item.quantity})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{(netRevenue).toLocaleString('ar-EG')} ج.م</td>
                                                <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{(orderCogs).toLocaleString('ar-EG')} ج.م</td>
                                                <td className="p-3 font-mono font-bold text-emerald-600">+{profit.toLocaleString('ar-EG')} ج.م</td>
                                                <td className="p-3 font-mono font-bold text-amber-600 bg-amber-50/30 dark:bg-amber-950/20 rounded">{(totalRecovered).toLocaleString('ar-EG')} ج.م</td>
                                            </tr>
                                        );
                                    })}
                                {stats.posCompletedCount === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                            لا توجد مبيعات نقاط بيع في هذه الفترة.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
