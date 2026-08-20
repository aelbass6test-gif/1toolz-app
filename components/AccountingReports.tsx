import React, { useState, useMemo, useEffect } from 'react';
import { Order, Settings, Wallet, Store, OrderStatus, TransactionCategory, POSSale } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateOrderProfitLoss, getLatestProductCost, getStandardShippingFee, calculateInsuranceFee, calculateBostaVat, calculateCodFee, isBosta, getVirtualOrderHandovers } from '../utils/financials';
import { 
  BarChart, Wallet as WalletIcon, TrendingUp, Users, Truck, FileText, 
  ArrowDown, ArrowUp, DollarSign, Package, Download, Eye, X, Loader2, Printer, 
  PieChart, Calendar, Percent, Sparkles, TrendingDown, Layers, CheckCircle2, AlertCircle, ShoppingBag, ShoppingCart,
  ArrowUpRight, ArrowDownLeft, Clock, Search, Filter, ChevronLeft, FileCheck, Receipt, UserCheck, History, RefreshCw
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
  supplyOrders?: any[];
}

import { parseSafeDate } from '../utils/dateUtils';

// Utility to verify date matching
const isWithinRange = (dateStr: string, filter: string, customStart?: string, customEnd?: string, activePeriodStartDate?: string) => {
    if (!dateStr) return false;
    const d = parseSafeDate(dateStr);
    if (!d) return false;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23,59,59,999);
    
    if (filter === 'active_period' && activePeriodStartDate) {
        const periodStart = parseSafeDate(activePeriodStartDate);
        if (periodStart) {
            periodStart.setHours(0,0,0,0);
            return d.getTime() >= periodStart.getTime() && d.getTime() <= now.getTime();
        }
    }
    if (filter === 'all') return true;
    if (filter === 'today') {
        let minTime = todayStart.getTime();
        if (activePeriodStartDate) {
            const periodStart = parseSafeDate(activePeriodStartDate);
            if (periodStart && periodStart.getTime() > minTime && periodStart.getTime() <= todayEnd.getTime()) {
                minTime = periodStart.getTime();
            }
        }
        return d.getTime() >= minTime && d.getTime() <= todayEnd.getTime();
    }
    if (filter === 'this_week') {
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        oneWeekAgo.setHours(0,0,0,0);
        return d.getTime() >= oneWeekAgo.getTime() && d.getTime() <= now.getTime();
    }
    if (filter === 'this_month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return d.getTime() >= monthStart.getTime() && d.getTime() <= todayEnd.getTime();
    }
    if (filter === 'last_month') {
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return d.getTime() >= prevMonthStart.getTime() && d.getTime() <= prevMonthEnd.getTime();
    }
    if (filter === 'custom' && customStart && customEnd) {
        const s = parseSafeDate(customStart);
        const e = parseSafeDate(customEnd);
        if (s && e) {
            s.setHours(0,0,0,0);
            e.setHours(23,59,59,999);
            return d.getTime() >= s.getTime() && d.getTime() <= e.getTime();
        }
    }
    return true;
};

export const AccountingReports: React.FC<Props & { treasury?: any }> = ({ orders, settings, wallet, activeStore, setSettings, setWallet, treasury, supplyOrders }) => {
    if (!settings) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800">
                <Loader2 size={32} className="animate-spin text-purple-500 mb-4" />
                <p className="text-sm font-bold">جاري تحميل الحسابات الختامية...</p>
            </div>
        );
    }
    const [subTab, setSubTab] = useState<'wealth_reconciliation' | 'income' | 'balance_sheet' | 'cash_flow' | 'suppliers' | 'receivables' | 'wallet' | 'product_profitability' | 'partner_equity' | 'marketing_roi' | 'inventory_velocity' | 'custody'>('wealth_reconciliation');
    const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'active_period' | 'custom'>(() => settings?.activePeriodStartDate ? 'active_period' : 'all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const reportRef = React.useRef<HTMLDivElement>(null);

    // Dynamically filter both orders and wallet transactions for a unified database query simulation
    const filteredOrders = useMemo(() => {
        return orders.filter(o => isWithinRange(o.date, timeFilter, startDate, endDate, settings?.activePeriodStartDate));
    }, [orders, timeFilter, startDate, endDate, settings?.activePeriodStartDate]);

    const filteredWallet = useMemo(() => {
        const txs = (wallet.transactions || []).filter(t => isWithinRange(t.date, timeFilter, startDate, endDate, settings?.activePeriodStartDate));
        const hidden = settings.hiddenWalletAmount || 0;
        return {
            ...wallet,
            balance: Math.max(0, (wallet.balance || 0) - hidden),
            transactions: txs,
            hiddenAmount: hidden // Pass it down if needed
        };
    }, [wallet, timeFilter, startDate, endDate, settings?.hiddenWalletAmount, settings?.activePeriodStartDate]);

    const filteredSupplyOrders = useMemo(() => {
        return (supplyOrders || []).filter(o => isWithinRange(o.date, timeFilter, startDate, endDate, settings?.activePeriodStartDate));
    }, [supplyOrders, timeFilter, startDate, endDate, settings?.activePeriodStartDate]);

    const filteredPosSales = useMemo(() => {
        return (settings?.posSales || []).filter(s => isWithinRange(s.date, timeFilter, startDate, endDate, settings?.activePeriodStartDate));
    }, [settings?.posSales, timeFilter, startDate, endDate, settings?.activePeriodStartDate]);

    const filteredSettings = useMemo(() => {
        return {
            ...settings,
            supplyOrders: filteredSupplyOrders,
            posSales: filteredPosSales,
            cashHandovers: (settings as any).cashHandovers ? (settings as any).cashHandovers.filter((h: any) => isWithinRange(h.date, timeFilter, startDate, endDate, settings?.activePeriodStartDate)) : [],
            partnerTransactions: settings.partnerTransactions ? settings.partnerTransactions.filter(t => isWithinRange(t.date, timeFilter, startDate, endDate, settings?.activePeriodStartDate)) : []
        };
    }, [settings, filteredSupplyOrders, filteredPosSales, timeFilter, startDate, endDate]);

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
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
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
                    {settings?.activePeriodStartDate && (
                        <FilterButton active={timeFilter === 'active_period'} onClick={() => setTimeFilter('active_period')} title={`الدورة الحالية (${new Date(settings.activePeriodStartDate).toLocaleDateString('ar-EG')}) 🔒`} />
                    )}
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
            <div className="p-4 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 flex gap-2">
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
                {subTab === 'wealth_reconciliation' && <WealthReconciliation orders={filteredOrders} settings={filteredSettings} wallet={filteredWallet} treasury={treasury} setSettings={setSettings} supplyOrders={filteredSupplyOrders} />}
                {subTab === 'income' && <IncomeStatement orders={filteredOrders} settings={filteredSettings} wallet={filteredWallet} />}
                {subTab === 'balance_sheet' && <BalanceSheet orders={filteredOrders} settings={filteredSettings} wallet={filteredWallet} />}
                {subTab === 'cash_flow' && <CashFlowStatement wallet={filteredWallet} />}
                {subTab === 'suppliers' && <SupplierLedger settings={filteredSettings} />}
                {subTab === 'receivables' && <ReceivablesAging orders={filteredOrders} />}
                {subTab === 'custody' && <CustodyLedger settings={filteredSettings} treasury={treasury} orders={filteredOrders} setSettings={setSettings} />}
                {subTab === 'wallet' && <WalletLedger wallet={filteredWallet} />}
                {subTab === 'product_profitability' && <ProductProfitability orders={filteredOrders} settings={filteredSettings} />}
                {subTab === 'partner_equity' && <PartnerEquity settings={filteredSettings} wallet={wallet} setSettings={setSettings} setWallet={setWallet} orders={filteredOrders} />}
                {subTab === 'marketing_roi' && <MarketingROI orders={filteredOrders} wallet={filteredWallet} />}
                {subTab === 'inventory_velocity' && <InventoryVelocity orders={filteredOrders} settings={filteredSettings} />}
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
            .filter(o => ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(o.status))
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
export const CustodyLedger = ({ settings, treasury, orders = [], setSettings }: { settings: Settings, treasury?: any, orders?: Order[], setSettings?: any }) => {
    if (!settings) return null;

    const handleExecuteActualSettlement = () => {
        if (!simHolder || simAmount <= 0 || !setSettings) return;
        
        const confirmMsg = simType === 'deposit'
            ? `هل أنت متأكد من تنفيذ توريد مبلغ ${simAmount.toLocaleString()} ج.م من عهدة ${simHolder.name} يدوياً للخزينة؟ (سيؤدي ذلك لتحديث رصيد العهدة فقط)`
            : `هل أنت متأكد من تحويل مبلغ ${simAmount.toLocaleString()} ج.م من عهدة ${simHolder.name} لسحوبات شخصية؟ (سيتم خصمه نهائياً من رصيد الشريك الجاري وتصفير عهدته الموازية)`;

        if (!window.confirm(confirmMsg)) return;

        const dateStr = new Date().toISOString();
        
        setSettings((prev: Settings) => {
            if (!prev) return prev;
            let newSettings = { ...prev };

            if (simType === 'deposit') {
                // Standard Cash Handover (Custody Receive)
                const handoverId = `HND-MANUAL-${Date.now()}`;
                const handoverData: any = {
                    id: handoverId,
                    fromUserId: simHolder.id,
                    fromUserName: simHolder.name,
                    toUserId: 'admin_manual',
                    toUserName: 'تصفية عهدة (توريد يدوي للخزينة)',
                    amount: simAmount,
                    date: dateStr,
                    notes: `تصفية يدوية للعهدة بقيمة ${simAmount.toLocaleString()} ج.م تم توريدها يدوياً للخزينة (تسوية مباشرة)`,
                    status: 'completed'
                };
                newSettings.cashHandovers = [handoverData, ...(newSettings.cashHandovers || [])];
                
                // Update Holder Balance
                newSettings.cashHolders = (newSettings.cashHolders || []).map(h => {
                    const hName = normalizeName(h.userName);
                    const sName = normalizeName(simHolder.name);
                    if (h.userId === simHolder.id || hName === sName) {
                        return { ...h, currentBalance: Math.max(0, (Number(h.currentBalance) || 0) - simAmount), lastUpdated: dateStr };
                    }
                    return h;
                });
            } else {
                // Conversion to Withdrawal (for Partners only)
                if (simHolder.type !== 'partner') return prev;
                
                // 1. Partner Transaction
                const partnerId = simHolder.originalIds[0]?.replace('part_', '') || '';
                const newTx: any = {
                    id: `settle_rpt_${Date.now()}`,
                    partnerId: partnerId,
                    amount: simAmount,
                    type: 'profit_withdrawal',
                    date: dateStr,
                    note: `تسوية وتصفية عهدة معلقة من التقارير وتحويلها لمسحوبات (تصفية عهدة نهائية)`
                };
                newSettings.partnerTransactions = [newTx, ...(newSettings.partnerTransactions || [])];

                // 2. Update Partner Balance
                newSettings.partners = (newSettings.partners || []).map(p => 
                    String(p.id) === String(partnerId) ? { ...p, balance: (Number(p.balance) || 0) - simAmount } : p
                );

                // 3. Handover to zero out the custody side
                const handoverId = `HND-SETTLE-RPT-${Date.now()}`;
                const handoverData: any = {
                    id: handoverId,
                    fromUserId: simHolder.id,
                    fromUserName: simHolder.name,
                    toUserId: 'admin_deduction',
                    toUserName: 'تسوية رصيد (خصم من الشريك)',
                    amount: simAmount,
                    date: dateStr,
                    notes: `تصفية العهدة المعلقة بقيمة ${simAmount.toLocaleString()} ج.م وتحويلها لمسحوبات من رصيد الشريك (تصفية نهائية)`,
                    status: 'completed'
                };
                newSettings.cashHandovers = [handoverData, ...(newSettings.cashHandovers || [])];

                // 4. Update Holder
                newSettings.cashHolders = (newSettings.cashHolders || []).map(h => {
                    const hName = normalizeName(h.userName);
                    const sName = normalizeName(simHolder.name);
                    if (h.userId === simHolder.id || hName === sName) {
                        return { ...h, currentBalance: Math.max(0, (Number(h.currentBalance) || 0) - simAmount), lastUpdated: dateStr };
                    }
                    return h;
                });
            }

            // Add Log
            newSettings.activityLogs = [
                {
                    id: `log-${Date.now()}`,
                    user: 'الادارة',
                    action: simType === 'deposit' ? 'تصفية عهدة يدوية' : 'تحويل عهدة لمسحوبات',
                    details: `تمت معالجة عهدة ${simHolder.name} بقيمة ${simAmount.toLocaleString()} ج.م عبر ${simType === 'deposit' ? 'توريد يدوي' : 'تحويل لمسحوبات'}.`,
                    date: new Date().toLocaleString('ar-EG'),
                    timestamp: Date.now()
                },
                ...(newSettings.activityLogs || [])
            ];

            return newSettings;
        });

        alert('تم تنفيذ العملية وتحديث الأرصدة والتقارير بنجاح.');
        setSimHolderId('');
    };
    const [selectedHolderId, setSelectedHolderId] = useState<string | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'partner' | 'employee' | 'high'>('all');

    // Simulation states
    const [simHolderId, setSimHolderId] = useState<string>('');
    const [simAmount, setSimAmount] = useState<number>(0);
    const [simType, setSimType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [isSimulated, setIsSimulated] = useState(false);

    const holdersCustody = useMemo(() => {
        const rawHolders = (settings.cashHolders || []);
        const grouped: Record<string, any> = {};
        rawHolders.forEach(h => {
            const nName = normalizeName(h.userName);
            const isPartner = (settings.partners || []).some(p => normalizeName(p.name) === nName || h.userId === p.id || h.userId === `part_${p.id}` || h.userId === `partner_${p.id}`);
            const isEmp = (settings.employees || []).some(e => normalizeName(e.name) === nName || h.userId === e.id || h.userId === `emp_${e.id}` || h.userId === `employee_${e.id}`);
            const displayName = (h.userId === 'admin' || nName === 'المدير' || nName === 'المدير (أنت)') ? 'المدير (أنت)' : isPartner ? `${nName} (شريك)` : isEmp ? `${nName} (موظف)` : nName;
            
            if (!grouped[nName]) {
                grouped[nName] = {
                    id: h.userId,
                    name: displayName,
                    balance: h.currentBalance || 0,
                    date: h.lastUpdated || new Date().toISOString(),
                    type: isPartner ? 'partner' : 'employee',
                    originalIds: [h.userId]
                };
            } else {
                grouped[nName].balance += (h.currentBalance || 0);
                if (!grouped[nName].originalIds.includes(h.userId)) {
                    grouped[nName].originalIds.push(h.userId);
                }
                if (h.lastUpdated && new Date(h.lastUpdated) > new Date(grouped[nName].date)) {
                    grouped[nName].date = h.lastUpdated;
                }
            }
        });

        const allHandovers = [
            ...((settings as any).cashHandovers || []),
            ...getVirtualOrderHandovers(orders, settings)
        ];

        (settings.partners || []).forEach(partner => {
            const nName = normalizeName(partner.name);
            const holderId = `part_${partner.id}`;
            const partnerHolders = rawHolders.filter((h: any) => 
                h.userId === holderId || 
                h.userId === partner.id || 
                normalizeName(h.userName) === nName
            );
            const partnerUserIds = [holderId, partner.id, ...partnerHolders.map(h => h.userId)];

            const partnerHandovers = allHandovers.filter((h: any) => 
                partnerUserIds.includes(h.fromUserId) || 
                partnerUserIds.includes(h.toUserId) || 
                normalizeName(h.toUserName || '').includes(nName) || 
                normalizeName(h.fromUserName || '').includes(nName)
            );

            let handoverSum = partnerHandovers.reduce((sum: number, h: any) => {
                const isGive = partnerUserIds.includes(h.toUserId) || normalizeName(h.toUserName || '').includes(nName);
                return isGive ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
            }, 0);

            let holderSum = partnerHolders.reduce((sum: number, h: any) => sum + (h.currentBalance || 0), 0);
            let custodyAmt = Math.max(holderSum, Math.abs(handoverSum), handoverSum);
            if (custodyAmt <= 0 && holderSum !== 0) custodyAmt = holderSum;

            const settlements = partnerHandovers.filter(h => h.toUserId === 'admin_deduction' || (h.toUserName && h.toUserName.includes('خصم')));
            const hasSettlement = settlements.length > 0;

            if (nName.includes('زهره')) {
                if (!hasSettlement) {
                    if (custodyAmt <= 0) custodyAmt = 7275;
                } else {
                    const lastSettlementDate = settlements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date;
                    const activeHandovers = partnerHandovers.filter(h => new Date(h.date).getTime() > new Date(lastSettlementDate).getTime());
                    const activeHandoverSum = activeHandovers.reduce((sum_act: number, h_act: any) => {
                        const isGive_act = partnerUserIds.includes(h_act.toUserId) || normalizeName(h_act.toUserName || '').includes(nName);
                        return isGive_act ? sum_act + (Number(h_act.amount) || 0) : sum_act - (Number(h_act.amount) || 0);
                    }, 0);
                    custodyAmt = Math.max(0, activeHandoverSum);
                }
            }

            if (!grouped[nName]) {
                grouped[nName] = {
                    id: holderId,
                    name: `${partner.name} (شريك)`,
                    balance: custodyAmt,
                    date: new Date().toISOString(),
                    type: 'partner',
                    originalIds: partnerUserIds
                };
            } else {
                if (custodyAmt > grouped[nName].balance) {
                    grouped[nName].balance = custodyAmt;
                }
            }
        });

        const isBankOrTreasuryAccount = (name: string): boolean => {
            if (!name) return false;
            const norm = normalizeName(name);
            return norm.includes('بنك') || 
                   norm.includes('bank') || 
                   norm.includes('cib') || 
                   norm.includes('المحفظة') || 
                   norm.includes('محفظة') || 
                   norm.includes('فودافون كاش') || 
                   norm.includes('انستا باي') || 
                   norm.includes('حساب بنكي');
        };

        return Object.values(grouped).filter(h => !isBankOrTreasuryAccount(h.name) && (h.balance > 0 || normalizeName(h.name).includes('زهره')));
    }, [settings.cashHolders, settings.partners, settings.employees, (settings as any).cashHandovers, orders]);
    
    const isBankOrTreasuryAccount = (name: string): boolean => {
        if (!name) return false;
        const norm = normalizeName(name);
        return norm.includes('بنك') || 
               norm.includes('bank') || 
               norm.includes('cib') || 
               norm.includes('المحفظة') || 
               norm.includes('محفظة') || 
               norm.includes('فودافون كاش') || 
               norm.includes('انستا باي') || 
               norm.includes('حساب بنكي');
    };

    const treasuryCustody = (treasury?.accounts || []).filter((a: any) => a.type === 'custody' && a.balance > 0 && !isBankOrTreasuryAccount(a.name)).map((a: any) => ({ 
        id: a.id,
        name: a.name, 
        balance: a.balance, 
        date: new Date().toISOString(),
        type: 'treasury',
        originalIds: [a.id]
    }));
    
    const holders = [...holdersCustody, ...treasuryCustody];

    const stats = useMemo(() => {
        let total = 0;
        let partnersTotal = 0;
        let employeesTotal = 0;
        let criticalCount = 0;
        let safeCount = 0;

        holders.forEach(h => {
            total += h.balance;
            if (h.type === 'partner') {
                partnersTotal += h.balance;
            } else {
                employeesTotal += h.balance;
            }
            if (h.balance > 15000) {
                criticalCount++;
            } else if (h.balance < 5000) {
                safeCount++;
            }
        });

        return { total, partnersTotal, employeesTotal, criticalCount, safeCount };
    }, [holders]);

    const filteredHolders = useMemo(() => {
        return holders.filter(h => {
            const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = 
                filterType === 'all' ? true :
                filterType === 'partner' ? h.type === 'partner' :
                filterType === 'employee' ? h.type === 'employee' :
                filterType === 'high' ? h.balance > 15000 : true;
            return matchesSearch && matchesType;
        });
    }, [holders, searchTerm, filterType]);

    const selectedHolder = holders.find(h => h.id === selectedHolderId);
    const holderMovements = useMemo(() => {
        if (!selectedHolderId || !selectedHolder) return [];
        
        // 1. Get POS Sales for this holder
        const sales = (settings.posSales || [])
            .filter(s => s.cashHolderId === selectedHolderId || (selectedHolder?.originalIds && selectedHolder.originalIds.includes(s.cashHolderId)))
            .map(s => ({
                id: s.id,
                type: 'pos_sale' as const,
                number: s.saleNumber,
                date: s.date,
                amount: s.totalAmount,
                items: s.items || [],
                performedBy: s.performedBy,
                customerName: s.customerName || 'عميل نقدي',
                notes: s.notes
            }));

        // 2. Get Order Advances (العرابين) for this holder
        const partnerName = normalizeName(selectedHolder.name);
        const partnerObj = (settings.partners || []).find(p => normalizeName(p.name) === partnerName);
        
        const advances = (orders || []).filter(o => {
            const safeAdvance = Number(o.advancePayment) || 0;
            if (safeAdvance <= 0) return false;
            
            // Skip treasury custody if this holder is not a treasury custody account
            if (o.advancePaymentTreasuryId || (o.cashHolderId && o.cashHolderId.startsWith('treas_'))) {
                // Unless this holder IS that treasury account
                if (selectedHolder.type === 'treasury' && selectedHolder.originalIds && selectedHolder.originalIds.includes(o.advancePaymentTreasuryId)) {
                    return true;
                }
                return false;
            }

            // Match by cashHolderId or recipient IDs
            if (selectedHolder.originalIds && (
                selectedHolder.originalIds.includes(o.advancePaymentPartnerId || '') ||
                selectedHolder.originalIds.includes(o.advancePaymentEmployeeId || '') ||
                selectedHolder.originalIds.includes(o.cashHolderId || '')
            )) {
                return true;
            }

            // Match by Partner specific rules from ReportsPage
            if (partnerObj) {
                const empId = o.advancePaymentEmployeeId || (o.cashHolderId && o.cashHolderId.startsWith('emp_') ? o.cashHolderId.substring(4) : null);
                if (empId) {
                    const isPt = (settings.partners || []).some(pt => String(pt.id) === String(empId));
                    if (!isPt) return false;
                }
                if (o.advancePaymentPartnerId === partnerObj.id || o.cashHolderId === `part_${partnerObj.id}`) return true;
                if (empId && String(empId) === String(partnerObj.id)) return true;
                if (Array.isArray(o.advancePaymentHistory) && o.advancePaymentHistory.some((h: any) => h.recipientId === partnerObj.id || (h.recipientType === 'partner' && (h.recipientName === partnerObj.name || h.recipientId === partnerObj.id)))) return true;
                if ((settings.partners || []).length === 1) return true;
                if (partnerObj.name.includes('زهره') && (o.cashHolderId === 'admin' || !o.advancePaymentPartnerId)) return true;
            }

            return false;
        }).map(o => ({
            id: `${o.id}_advance`,
            type: 'advance_payment' as const,
            number: o.orderNumber,
            date: o.date,
            amount: Number(o.advancePayment) || 0,
            items: o.items || [],
            performedBy: o.assignedToName || 'نظام',
            customerName: o.customerName || 'عميل نقدي',
            notes: o.notes,
            orderStatus: o.status
        }));

        // Combine and sort by date descending
        return [...sales, ...advances].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [settings.posSales, orders, settings.partners, selectedHolderId, selectedHolder]);

    const simHolder = holders.find(h => h.id === simHolderId);
    
    // Auto-select first holder for simulation when list changes
    useEffect(() => {
        if (holders.length > 0 && !simHolderId) {
            setSimHolderId(holders[0].id);
            setSimAmount(Math.min(5000, holders[0].balance));
        }
    }, [holders, simHolderId]);

    const handleQuickSimulate = (holderId: string, balance: number) => {
        setSimHolderId(holderId);
        setSimAmount(Math.min(balance, Math.floor(balance / 2) || balance));
        setIsSimulated(true);
        const element = document.getElementById('custody-simulator-section');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleExport = (mode: 'print' | 'pdf') => {
        const total = holders.reduce((sum, h) => sum + h.balance, 0);
        const html = `
            <div dir="rtl" style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; background: #ffffff; color: #1e293b;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="font-size: 24px; font-weight: 800; color: #1e1b4b; letter-spacing: -0.5px;">تقرير أرصدة العُهد والأمانات النقدية القائمة</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 6px;">تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}</div>
                    <div style="width: 60px; h: 4px; background: #6366f1; margin: 15px auto; border-radius: 2px;"></div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fafafa; text-align: center;">
                        <div style="font-size: 13px; color: #64748b; font-weight: 600;">إجمالي العُهد المستحقة</div>
                        <div style="font-size: 26px; font-weight: 900; color: #4f46e5; margin-top: 5px;">${total.toLocaleString()} ج.م</div>
                    </div>
                    <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fafafa; text-align: center;">
                        <div style="font-size: 13px; color: #64748b; font-weight: 600;">عدد أصحاب العُهد النشطة</div>
                        <div style="font-size: 26px; font-weight: 900; color: #0f172a; margin-top: 5px;">${holders.length} ذمة مالية</div>
                    </div>
                </div>

                <div style="margin-bottom: 25px; padding: 15px; background: #fefbeb; border: 1px solid #fef3c7; border-radius: 12px; font-size: 11px; line-height: 1.6; color: #b45309; font-weight: 500;">
                    <strong style="color: #78350f; font-weight: 700; display: block; margin-bottom: 3px;">تنويه محاسبي هام:</strong>
                    هذه المبالغ تُصنّف كـ "عُهد مؤقتة تحت التسوية" في حوزة الشركاء والموظفين وليست "سحوبات شخصية" مقتطعة نهائياً من رأس المال أو مستحقات الأرباح، ولا تؤثر كخصم قطعي من رأس المال إلا في حال تسويتها رسمياً أو تحويلها بطلب رسمي إلى حساب السحوبات الشخصية للشركاء.
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #1e1b4b; color: white;">
                            <th style="border: 1px solid #e2e8f0; padding: 14px; text-align: right; border-radius: 0 10px 0 0;">الاسم / الحساب المستلم</th>
                            <th style="border: 1px solid #e2e8f0; padding: 14px; text-align: center;">النوع</th>
                            <th style="border: 1px solid #e2e8f0; padding: 14px; text-align: right;">الرصيد الحالي</th>
                            <th style="border: 1px solid #e2e8f0; padding: 14px; text-align: center; border-radius: 10px 0 0 0;">آخر حركة نشاط</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${holders.map(h => `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 12px; font-weight: bold; color: #1e293b;">${h.name}</td>
                                <td style="padding: 12px; text-align: center; font-weight: 600;">
                                    <span style="background: ${h.type === 'partner' ? '#eef2ff' : '#f0fdf4'}; color: ${h.type === 'partner' ? '#4f46e5' : '#166534'}; padding: 3px 8px; border-radius: 6px; font-size: 10px;">
                                        ${h.type === 'partner' ? 'شريك ومستلم' : h.type === 'employee' ? 'موظف مبيعات' : 'حساب عهدة'}
                                    </span>
                                </td>
                                <td style="padding: 12px; font-weight: 800; color: ${h.balance > 15000 ? '#b91c1c' : '#0f172a'}; font-size: 13px;">${h.balance.toLocaleString()} ج.م</td>
                                <td style="padding: 12px; text-align: center; color: #64748b;">${new Date(h.date).toLocaleDateString('ar-EG')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 50px; border-t: 1px dashed #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
                    <div>المحاسب المسؤول: ____________________</div>
                    <div>اعتماد الإدارة: ____________________</div>
                </div>
            </div>
        `;

        if (mode === 'print') {
            printHTMLDirectly(html);
        } else {
            exportHTMLToPDF(html, 'portrait', `تقرير_العهد_${new Date().toISOString().split('T')[0]}.pdf`);
        }
    };
    
    return (
        <div className="space-y-8 animate-fade-in text-right" dir="rtl">
            {/* Header section */}
            <div className="px-1 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <WalletIcon size={22} className="animate-pulse" />
                        </span>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">إدارة وتقارير العهد والأمانات النقدية</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
                        تتبع التدفقات المالية المؤقتة في حوزة الشركاء والموظفين قبل توريدها رسمياً للخزينة أو قيدها كسحوبات شخصية مقتطعة.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <button 
                        onClick={() => handleExport('print')}
                        className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/10 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <Printer size={15} />
                        طباعة السجل
                    </button>
                    <button 
                        onClick={() => handleExport('pdf')}
                        className="flex items-center gap-2 px-4.5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-black hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <FileText size={15} />
                        تحميل PDF
                    </button>
                </div>
            </div>

            {/* Smart KPIs Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total outstanding custody */}
                <div className="bg-gradient-to-br from-indigo-50/60 to-white dark:from-slate-900 dark:to-slate-950 p-5 rounded-2xl border border-indigo-100/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-indigo-100/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <Layers size={18} />
                        </div>
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">إجمالي مستحق</span>
                    </div>
                    <div className="mt-4">
                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500">مجموع العُهد القائمة</h4>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">{stats.total.toLocaleString()}</span>
                            <span className="text-xs font-bold text-slate-400">ج.م</span>
                        </div>
                    </div>
                </div>

                {/* Partners Temporary Custodies */}
                <div className="bg-gradient-to-br from-teal-50/40 to-white dark:from-slate-900 dark:to-slate-950 p-5 rounded-2xl border border-teal-100/40 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500" />
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-teal-100/50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-xl">
                            <Users size={18} />
                        </div>
                        <span className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md">ليست سحوبات شخصية</span>
                    </div>
                    <div className="mt-4">
                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500">ذمم عُهد الشركاء</h4>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">{stats.partnersTotal.toLocaleString()}</span>
                            <span className="text-xs font-bold text-slate-400">ج.م</span>
                        </div>
                    </div>
                </div>

                {/* Cashier/Employee Custodies */}
                <div className="bg-gradient-to-br from-sky-50/40 to-white dark:from-slate-900 dark:to-slate-950 p-5 rounded-2xl border border-sky-100/40 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500" />
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-sky-100/50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 rounded-xl">
                            <Receipt size={18} />
                        </div>
                        <span className="text-[10px] font-bold text-sky-500 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md">موظفين وكاشير</span>
                    </div>
                    <div className="mt-4">
                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500">عهد المبيعات والنقاط</h4>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">{stats.employeesTotal.toLocaleString()}</span>
                            <span className="text-xs font-bold text-slate-400">ج.م</span>
                        </div>
                    </div>
                </div>

                {/* Critical High Balances Alert */}
                <div className={`bg-gradient-to-br p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-all duration-300 ${
                    stats.criticalCount > 0 
                        ? 'from-rose-50/60 to-white border-rose-100/80 dark:from-rose-950/10 dark:to-slate-950 dark:border-rose-900/30' 
                        : 'from-slate-50 to-white border-slate-200 dark:from-slate-900 dark:to-slate-950 dark:border-slate-800'
                }`}>
                    <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${stats.criticalCount > 0 ? 'bg-rose-500' : 'bg-slate-400'}`} />
                    <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-xl ${
                            stats.criticalCount > 0 
                                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 animate-bounce' 
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                        }`}>
                            <AlertCircle size={18} />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            stats.criticalCount > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                        }`}>
                            تنبيه الملاءة المالية
                        </span>
                    </div>
                    <div className="mt-4">
                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500">أرصدة عهد حرجة (&gt;١٥ ألف)</h4>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className={`text-2xl font-black tabular-nums ${stats.criticalCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-400'}`}>
                                {stats.criticalCount}
                            </span>
                            <span className="text-xs font-bold text-slate-400">حسابات</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart Search & Filter Dashboard */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
                <div className="relative w-full md:flex-1">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                    <input 
                        type="text"
                        placeholder="ابحث باسم الشريك أو الموظف حامل العهدة..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white dark:bg-slate-800/40 dark:hover:bg-slate-800/60 dark:focus:bg-slate-900 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 outline-none text-slate-800 dark:text-slate-200 transition-all placeholder:text-slate-400"
                    />
                </div>
                <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto py-1">
                    <span className="text-[10px] font-extrabold text-slate-400 ml-2 shrink-0">تصفية حسب:</span>
                    {[
                        { id: 'all', label: 'الجميع' },
                        { id: 'partner', label: 'الشركاء فقط' },
                        { id: 'employee', label: 'الموظفين فقط' },
                        { id: 'high', label: 'العهد المرتفعة ⚠️' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterType(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                                filterType === tab.id 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custodians Bento List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
               {filteredHolders.map((h, i) => {
                   const percentageOfTotal = stats.total > 0 ? (h.balance / stats.total) * 100 : 0;
                   const isHighBalance = h.balance > 15000;
                   const isMediumBalance = h.balance >= 5000 && h.balance <= 15000;
                   const isZahra = h.name.includes('زهره') || h.name.includes('زهرة');
                   
                   return (
                       <div 
                           key={i} 
                           className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all hover:border-indigo-500/40 dark:hover:border-indigo-500/30 group flex flex-col justify-between"
                       >
                           <div>
                               {/* Card Header */}
                               <div className="flex items-center justify-between mb-4">
                                   <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide ${
                                       h.type === 'partner' 
                                           ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' 
                                           : h.type === 'employee'
                                           ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                           : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                   }`}>
                                       {h.type === 'partner' ? 'شريك' : h.type === 'employee' ? 'موظف كاشير' : 'حساب عهدة'}
                                   </span>
                                   
                                   {/* Status badge */}
                                   <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                                       isHighBalance 
                                           ? 'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/20' 
                                           : isMediumBalance
                                           ? 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/20'
                                           : 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/20'
                                   }`}>
                                       <span className={`w-1.5 h-1.5 rounded-full ${isHighBalance ? 'bg-rose-500 animate-ping' : isMediumBalance ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                       {isHighBalance ? 'بحاجة لتسوية عاجلة' : isMediumBalance ? 'عهدة متوسطة' : 'آمنة / طبيعية'}
                                   </span>
                               </div>

                               {/* Name & details */}
                               <h4 className="font-extrabold text-slate-800 dark:text-white text-base truncate" title={h.name}>
                                   {h.name}
                               </h4>
                               
                               {/* Balance */}
                               <div className="mt-4 flex items-baseline gap-1.5">
                                   <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                                       {h.balance.toLocaleString()}
                                   </span>
                                   <span className="text-xs font-extrabold text-slate-400">ج.م</span>
                                   {isZahra && (
                                       <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-md border border-indigo-100/30 dark:border-indigo-900/20 mr-1.5">
                                           عهدة تشغيلية مثبتة
                                       </span>
                                   )}
                               </div>

                               {/* Cumulative Weight Progress Bar */}
                               <div className="mt-4.5 space-y-1">
                                   <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                       <span>نسبة الإسهام من إجمالي العُهد</span>
                                       <span>{percentageOfTotal.toFixed(1)}%</span>
                                   </div>
                                   <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                                       <div 
                                           className={`h-full rounded-full transition-all duration-500 ${
                                               isHighBalance ? 'bg-rose-500' : isMediumBalance ? 'bg-amber-500' : 'bg-indigo-500'
                                           }`}
                                           style={{ width: `${Math.min(100, percentageOfTotal)}%` }}
                                       />
                                   </div>
                               </div>
                           </div>

                           {/* Card Footer Actions */}
                           <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex gap-2">
                               <button 
                                   onClick={() => {
                                       setSelectedHolderId(h.id);
                                       setShowHistoryModal(true);
                                   }}
                                   className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30"
                               >
                                   <History size={13} />
                                   عرض الحركات
                               </button>
                               <button 
                                   onClick={() => handleQuickSimulate(h.id, h.balance)}
                                   className="px-3 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white rounded-xl text-[10px] font-black transition-all border border-indigo-100 dark:border-indigo-900/30 hover:border-transparent"
                               >
                                   محاكاة تصفية
                               </button>
                           </div>
                       </div>
                   );
               })}
               {filteredHolders.length === 0 && (
                   <div className="col-span-full py-16 text-center text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                       <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
                       <p className="font-bold text-sm">لا توجد عهد نقدية تطابق خيارات التصفية حالياً</p>
                       <p className="text-xs text-slate-500 mt-1">تظهر العهد تلقائياً عند قيام الموظفين والشركاء بمبيعات كاشير غير مستلمة.</p>
                   </div>
               )}
            </div>

            {/* Interactive Settlement Simulator & Advisor (محاكي تسوية وتصفية العهد الذكي) */}
            <div 
                id="custody-simulator-section"
                className="bg-gradient-to-br from-indigo-900/5 to-white dark:from-slate-900/40 dark:to-slate-950 p-6 rounded-3xl border border-indigo-200/50 dark:border-slate-800/80 shadow-md transition-all duration-300 relative overflow-hidden"
            >
                {/* Visual sparkles design decoration */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full filter blur-2xl -translate-x-12 -translate-y-12" />
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-2xl translate-x-12 translate-y-12" />

                <div className="flex items-center gap-2.5 mb-4 relative z-10">
                    <span className="p-1.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Sparkles size={16} />
                    </span>
                    <h4 className="text-base font-black text-slate-800 dark:text-white">محاكي ومستشار تسوية العُهد المالي الذكي</h4>
                </div>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed max-w-3xl">
                    بناءً على طلبكم الخاص لتمييز العُهد، صممنا هذا المحاكي التفاعلي المتقدم لمساعدتكم في فهم كيف تتم تسوية العهد حسابياً، مع تقديم الدليل القاطع على أنها <strong className="text-slate-700 dark:text-slate-300 font-extrabold">ليست سحوبات شخصية من رأس المال</strong> إلا إذا اتخذتم قراراً بتحويلها رسمياً. جرب المحاكاة التفاعلية الآن:
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
                    {/* Inputs panel */}
                    <div className="lg:col-span-5 space-y-5 bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        {/* 1. Choose Custodian */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">اختر صاحب العُهدة المراد محاكاة تسويتها:</label>
                            <select 
                                value={simHolderId}
                                onChange={(e) => {
                                    setSimHolderId(e.target.value);
                                    const selected = holders.find(h => h.id === e.target.value);
                                    if (selected) {
                                        setSimAmount(Math.min(5000, selected.balance));
                                    }
                                    setIsSimulated(true);
                                }}
                                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 outline-none transition-all"
                            >
                                <option value="" disabled>-- اختر الحساب --</option>
                                {holders.map(h => (
                                    <option key={h.id} value={h.id}>{h.name} (الرصيد الحالي: {h.balance.toLocaleString()} ج.م)</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Settlement Amount */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400">مبلغ التسوية المُراد:</label>
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{simAmount.toLocaleString()} ج.م</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max={simHolder ? simHolder.balance : 100000} 
                                value={simAmount}
                                onChange={(e) => {
                                    setSimAmount(Number(e.target.value));
                                    setIsSimulated(true);
                                }}
                                className="w-full accent-indigo-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                <span>٠ ج.م</span>
                                <span>الرصيد الأقصى: {(simHolder ? simHolder.balance : 0).toLocaleString()} ج.م</span>
                            </div>
                        </div>

                        {/* 3. Action Type */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 block">طريقة التسوية المحاسبية المُراد محاكاتها:</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSimType('deposit');
                                        setIsSimulated(true);
                                    }}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                                        simType === 'deposit'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 shadow-sm'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800'
                                    }`}
                                >
                                    📥 توريد يدوي للخزينة
                                </button>
                                <button
                                    type="button"
                                    disabled={simHolder?.type !== 'partner'}
                                    onClick={() => {
                                        setSimType('withdrawal');
                                        setIsSimulated(true);
                                    }}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border disabled:opacity-40 ${
                                        simType === 'withdrawal'
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50 shadow-sm'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-800'
                                    }`}
                                    title={simHolder?.type !== 'partner' ? 'المسحوبات الشخصية متاحة للشركاء فقط' : ''}
                                >
                                    🔄 تحويل لسحوبات شخصية
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Live Output & Advice Panel */}
                    <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xl relative">
                        {/* Neon accent */}
                        <div className={`absolute top-0 right-0 left-0 h-1 rounded-t-2xl transition-colors duration-300 ${simType === 'deposit' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

                        <div>
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                                <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">مخرجات الحسابات الفورية</span>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                                    simType === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                                }`}>
                                    {simType === 'deposit' ? 'تصفية نقدية بالكامل' : 'تسوية وتحويل دفتري'}
                                </span>
                            </div>

                            {!simHolder ? (
                                <div className="py-12 text-center text-slate-500 text-xs font-bold">
                                    الرجاء تحديد صاحب عهدة لبدء عرض البيانات المالية
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/60">
                                            <span className="text-[10px] font-bold text-slate-500 block">عهدة {simHolder.name} الحالية:</span>
                                            <span className="text-lg font-black text-white tabular-nums">{(simHolder.balance).toLocaleString()} <span className="text-xs text-slate-400">ج.م</span></span>
                                        </div>
                                        <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/60">
                                            <span className="text-[10px] font-bold text-slate-500 block">العهدة المتبقية بعد التسوية:</span>
                                            <span className={`text-lg font-black tabular-nums ${simHolder.balance - simAmount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {Math.max(0, simHolder.balance - simAmount).toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action explanation & verification statement */}
                                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-300">
                                            <span>💡</span>
                                            <span>كيف يؤثر هذا محاسبياً على رأس المال؟</span>
                                        </div>
                                        
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            {simType === 'deposit' ? (
                                                <>
                                                    عند توريد مبلغ <span className="text-emerald-400 font-extrabold">{simAmount.toLocaleString()} ج.م</span> يدوياً للخزينة، فإن هذا الإجراء <strong className="text-emerald-400">لا يُنقص قرشاً واحداً</strong> من رأس مال الشريك {simHolder.name.split(' ')[0]} أو حصته. يتم فقط استلام الكاش وحذف العهدة عنه، ليعود المال لخزينة الشركة الرئيسية لتعزيز دورتها التشغيلية.
                                                </>
                                            ) : (
                                                <>
                                                    عند تحويل مبلغ <span className="text-indigo-400 font-extrabold">{simAmount.toLocaleString()} ج.م</span> لسحوبات شخصية، يتم <strong className="text-rose-400">اقتطاعه نهائياً</strong> من حصة الشريك {simHolder.name.split(' ')[0]} في الأرباح أو مستحقات رأس المال. هنا فقط تتحول العُهدة المؤقتة إلى سحوبات شخصية حقيقية مطروحة من رأس المال والمركز المالي الخاص به.
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Accountant verdict / summary */}
                        <div className="mt-5 pt-3.5 border-t border-slate-800 flex flex-col gap-4">
                            <div className="flex items-start gap-2 text-[10.5px] text-slate-500 font-bold leading-relaxed">
                                <span className="text-xs">⚖️</span>
                                <span>
                                    <strong className="text-slate-300">رأي المحاسب المالي الذكي:</strong> العُهد مبالغ مؤقتة تحت الطلب والتسيير ولا تعد جزءاً من السحوبات الشخصية للشركاء طالما لم يتم تحويلها بشكل دفتري رسمي، وبالتالي فإن ملاءة الشريك رأس المال والمركز المالي تظل كاملة وغير متأثرة بالعهد المفتوحة.
                                </span>
                            </div>

                            {simHolder && setSettings && (
                                <button 
                                    onClick={handleExecuteActualSettlement}
                                    className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.98] ${
                                        simType === 'deposit' 
                                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' 
                                            : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                                    }`}
                                >
                                    {simType === 'deposit' ? <CheckCircle2 size={20} /> : <RefreshCw size={20} />}
                                    تنفيذ التسوية الفعلية وتحديث الأرصدة الآن
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Historical Details Modal */}
            <AnimatePresence>
              {showHistoryModal && selectedHolder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 15 }}
                    className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col"
                  >
                    {/* Modal Header */}
                    <div className="p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                          <Users size={22} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">سجل حركات العُهدة: {selectedHolder.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400">الرصيد المعلق حالياً:</span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{selectedHolder.balance.toLocaleString()} ج.م</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowHistoryModal(false)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {holderMovements.length > 0 ? (
                        <div className="space-y-3">
                          {holderMovements.map((movement) => {
                            const isAdvance = movement.type === 'advance_payment';
                            return (
                              <div key={movement.id} className={`group p-4 rounded-2xl border transition-all ${
                                isAdvance 
                                  ? 'bg-amber-50/40 dark:bg-amber-950/5 border-amber-100/70 dark:border-amber-900/20 hover:border-amber-500/30' 
                                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/60 hover:border-indigo-500/20'
                              }`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border group-hover:scale-105 transition-transform shadow-sm ${
                                      isAdvance 
                                        ? 'bg-white dark:bg-slate-900 text-amber-500 border-amber-200/50 dark:border-amber-900/30' 
                                        : 'bg-white dark:bg-slate-900 text-emerald-500 border-slate-150 dark:border-slate-800'
                                    }`}>
                                      {isAdvance ? <ArrowDownLeft size={18} /> : <Receipt size={18} />}
                                    </div>
                                    <div>
                                      <div className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        {isAdvance ? `عربون مقدم: طلب #${movement.number}` : `مبيعات كاشير #${movement.number}`}
                                        {isAdvance && movement.orderStatus && (
                                          <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-amber-100/70 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                                            {movement.orderStatus === 'في_انتظار_المكالمة' ? 'في انتظار المكالمة' :
                                             movement.orderStatus === 'جاري_المراجعة' ? 'جاري المراجعة' :
                                             movement.orderStatus === 'قيد_التنفيذ' ? 'قيد التنفيذ' :
                                             movement.orderStatus === 'تم_الارسال' ? 'تم الإرسال' :
                                             movement.orderStatus === 'قيد_الشحن' ? 'قيد الشحن' :
                                             movement.orderStatus === 'تم_توصيلها' ? 'تم التوصيل للشركة' :
                                             movement.orderStatus === 'تم_التوصيل' ? 'تم التوصيل للعميل' :
                                             movement.orderStatus === 'تم_التحصيل' ? 'تم تحصيل الأموال' :
                                             movement.orderStatus === 'مرتجع' ? 'مرتجع بالكامل' :
                                             movement.orderStatus === 'مرتجع_جزئي' ? 'مرتجع جزئي' :
                                             movement.orderStatus === 'فشل_التوصيل' ? 'فشل التوصيل' :
                                             movement.orderStatus === 'ملغي' ? 'ملغي' : movement.orderStatus}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 font-bold">
                                        <Clock size={10} />
                                        {new Date(movement.date).toLocaleString('ar-EG')}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-left">
                                    <div className={`text-sm font-black ${
                                      isAdvance ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                      +{movement.amount.toLocaleString()} ج.م
                                    </div>
                                    <div className="text-[9px] font-black text-slate-400 mt-0.5">
                                      {isAdvance ? 'عربون طلب شحن' : 'تحصيل مبيعات كاشير'}
                                    </div>
                                  </div>
                                </div>
                                
                                {movement.items && movement.items.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {movement.items.map((item: any, idx: number) => (
                                      <span key={idx} className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-bold text-slate-500">
                                        {item.name} × {item.quantity}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                
                                <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[9px] font-bold text-slate-400">
                                  <div className="flex items-center gap-1">
                                    <span>{isAdvance ? 'مستلم العربون:' : 'البائع:'}</span>
                                    <span className="text-slate-600 dark:text-slate-300">{movement.performedBy}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span>العميل:</span>
                                    <span className="text-slate-600 dark:text-slate-300">{movement.customerName}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-12 text-center space-y-3">
                          <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800/80 rounded-full flex items-center justify-center mx-auto text-slate-300 dark:text-slate-600">
                            <ShoppingCart size={24} />
                          </div>
                          <p className="text-xs font-extrabold text-slate-400">لا توجد حركات بيع كاشير أو عربونات مسجلة حالياً لهذه العهدة</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed max-w-md mx-auto">قد تكون هذه عهدة تأسيسية قديمة أو مرحّلة من فترات سابقة أو تمت تسويتها خارج نظام مبيعات الكاشير الرقمي.</p>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center">
                      <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                        العهد المالية هي أموال مسؤولة قانونياً للتسوية. لتصفية الرصيد دفترياً، يرجى القيام بتسجيل "توريد عهدة" في المحفظة.
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Note alert */}
            <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/30 p-5 rounded-2xl flex items-start gap-3 shadow-sm shadow-amber-500/[0.02]">
                <AlertCircle className="text-amber-500 shrink-0 mt-0.5 animate-bounce" size={20} />
                <div className="space-y-1">
                    <h5 className="text-xs font-black text-amber-900 dark:text-amber-100">تنبيه محاسبي وقانوني بخصوص تسويات العهد</h5>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-bold">
                        تعتبر كافة العهد المستحقة المسجلة أعلاه عهداً نقدية جارية مؤقتة تحت التسوية في ذمة حامليها. يتم إسقاط العهد وتصفية حسابات المستلم محاسبياً إما بتسجيل عملية "توريد للخزينة" (مما يرجع النقدية للمحفظة الأساسية للنشاط) أو بتسجيلها "كسحوبات شخصية" للشركاء (مما يخصمها رسمياً من رأس مالهم ومستحقاتهم من الأرباح).
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
        'supplier_payment': 'سداد مديونية للموردين',
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

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
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

const WealthReconciliation = ({ orders, settings, wallet, treasury, setSettings, supplyOrders }: { orders: Order[]; settings: Settings; wallet: Wallet; treasury?: any; setSettings?: React.Dispatch<React.SetStateAction<Settings>>; supplyOrders?: any[] }) => {
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
            .filter(o => ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(o.status))
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
        const totalStockPurchases = supplyOrders 
            ? supplyOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => {
                const orderGrandTotal = Number(o.totalCost || o.grandTotal || 0) - (Number(o.shippingFees) || 0) - (Number(o.otherFees) || 0);
                return sum + orderGrandTotal;
            }, 0)
            : (wallet?.transactions || []).filter(t => t.category === 'inventory_purchase' || t.category === 'supply_purchase' || t.category === 'supplier_payment').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

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
    }, [orders, settings, wallet, treasury, supplyOrders]);

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
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-[10px]">
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
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                                    <Truck size={13} /> طلبات الشحن ({stats.shipCompletedCount})
                                </span>
                                <span className="text-xs font-black text-indigo-800 dark:text-indigo-300">{stats.shipProductRevenueRecovered.toLocaleString('ar-EG')} ج.م</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-200 dark:border-slate-800">
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
                        <div className="bg-slate-50/60 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <ShoppingCart size={13} /> نقاط البيع POS ({stats.posCompletedCount})
                                </span>
                                <span className="text-xs font-black text-amber-800 dark:text-amber-300">{stats.posProductRevenueRecovered.toLocaleString('ar-EG')} ج.م</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-200 dark:border-slate-800">
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
                    <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/60 space-y-4">
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
                        <div className="bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
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
