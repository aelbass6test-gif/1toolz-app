import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Order, Settings, Wallet, Store } from '../types';
import { FileText, TrendingUp, Package, Truck, DollarSign, ArrowUp, ArrowDown, PieChart as PieChartIcon, Printer, AlertTriangle, MapPin, Calendar, Wallet as WalletIcon, Download, Loader2, ArrowUpLeft, ArrowDownRight, X, Eye, Coins, Monitor, ShoppingBasket } from 'lucide-react';
import { AccountingReports } from './AccountingReports';
import { calculateOrderProfitLoss, calculateCodFee, getLatestProductCost, isBosta, calculateInsuranceFee, calculateBostaVat, getOrderProductCost, getStandardShippingFee } from '../utils/financials';
import { generateLossesReportHTML, generateComprehensiveFinancialReportHTML, generatePartnersFinancialReportHTML, generatePurchasesAndInventoryReportHTML } from '../utils/reportGenerator';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { printHTMLDirectly } from '../utils/printHelper';
import { exportHTMLToPDF } from '../utils/pdfHelper';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface ReportsPageProps {
  orders: Order[];
  settings: Settings;
  wallet: Wallet;
  activeStore?: Store;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  setWallet?: React.Dispatch<React.SetStateAction<Wallet>>;
  dateRangeText?: string;
}

const ReportCard: React.FC<{ title: string; value: string; icon: React.ReactNode; subValue?: string; color: 'emerald' | 'red' | 'amber' | 'blue' | 'teal'; tooltip?: string }> = ({ title, value, icon, subValue, color, tooltip }) => {
    const colorClasses = {
        emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', border: 'border-emerald-200 dark:border-emerald-800' },
        red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600', border: 'border-red-200 dark:border-red-800' },
        amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', border: 'border-amber-200 dark:border-amber-800' },
        blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600', border: 'border-blue-200 dark:border-blue-800' },
        teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600', border: 'border-teal-200 dark:border-teal-800' },
    };
    const currentColors = colorClasses[color];

    return (
        <div className={`p-6 rounded-2xl border ${currentColors.border} bg-white dark:bg-slate-900 shadow-sm relative group`} title={tooltip}>
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        {title}
                        {tooltip && <span className="text-slate-300 cursor-help">ⓘ</span>}
                    </h3>
                    <p className="text-3xl font-black text-slate-800 dark:text-white">{value}</p>
                    {subValue && <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{subValue}</p>}
                </div>
                <div className={`p-3 rounded-xl ${currentColors.bg} ${currentColors.text}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

const SalesSummaryReport: React.FC<Omit<ReportsPageProps, 'activeStore'>> = ({ orders, settings, wallet }) => {
    const reportData = useMemo(() => {
        if (!settings) return null;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const currentMonthOrders = orders.filter(o => {
            const d = new Date(o.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonthOrders = orders.filter(o => {
            const d = new Date(o.date);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });

        const getRevenue = (os: Order[]) => os.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status)).reduce((sum, o) => sum + ((o.items || []).reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0) + o.shippingFee - (o.discount || 0)), 0);
        
        const currentRevenue = getRevenue(currentMonthOrders);
        const prevRevenue = getRevenue(prevMonthOrders);
        const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        const collectedOrders = orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status));
        const totalProductRevenue = collectedOrders.reduce((sum, o) => sum + (o.items || []).reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0), 0);
        const totalRevenue = collectedOrders.reduce((sum, o) => sum + ((o.items || []).reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0) + o.shippingFee - (o.discount || 0)), 0);
        const totalOrders = orders.length;
        const avgOrderValue = collectedOrders.length > 0 ? totalRevenue / collectedOrders.length : 0;
        
        let totalProfit = 0;
        let totalLoss = 0;
        orders.forEach(order => {
            const { net } = calculateOrderProfitLoss(order, settings);
            if (net > 0) totalProfit += net;
            else totalLoss += Math.abs(net);
        });

        const totalExpenses = (wallet?.transactions || []).filter(t => t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_')).reduce((sum, t) => sum + t.amount, 0);
        
        // Compute trend based on standard days in filtered data
        // If they chose custom range, map those days; otherwise last 7 days as default
        const datesInOrders = Array.from(new Set(orders.map(o => o.date.split('T')[0]))).sort();
        const targetDates = datesInOrders.length > 1 ? datesInOrders.slice(-10) : [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const salesTrend = targetDates.map(date => {
            const dayOrders = orders.filter(o => o.date.startsWith(date) && (o.status === 'تم_التحصيل' || o.status === 'مدفوعة'));
            return {
                date: date.split('-').slice(1).join('/'),
                revenue: dayOrders.reduce((sum, o) => sum + ((o.items || []).reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0) + o.shippingFee - (o.discount || 0)), 0)
            };
        });

        const productPerformance = settings.products.map(product => {
            const soldItems = orders
                .filter(o => o.status === 'تم_التحصيل' || o.status === 'مدفوعة' || o.status === 'تم_توصيلها')
                .flatMap(o => o.items || [])
                .filter(i => i.productId === product.id);
            
            const quantitySold = soldItems.reduce((sum, i) => sum + i.quantity, 0);
            const cost = product.costPrice || 0;
            const price = product.price || 0;
            const netProfit = soldItems.reduce((sum, i) => sum + ((i.price - (i.cost || cost)) * i.quantity), 0);
            
            return { name: product.name, quantitySold, netProfit };
        }).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5);

        const shippingPerformance: { name: string; count: number; successRate: number }[] = [];
        const companies = Object.keys(settings.shippingOptions);
        companies.forEach(company => {
            const companyOrders = orders.filter(o => o.shippingCompany === company);
            if (companyOrders.length > 0) {
                const successful = companyOrders.filter(o => o.status === 'تم_التحصيل' || o.status === 'تم_توصيلها').length;
                shippingPerformance.push({ name: company, count: companyOrders.length, successRate: (successful / companyOrders.length) * 100 });
            }
        });

        // Delivery breakdown for Pie chart
        const deliveredCount = orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(o.status)).length;
        const returnedCount = orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)).length;
        const processingCount = orders.length - deliveredCount - returnedCount;

        const deliveryBreakdown = [
            { name: 'توصيل وتحصيل ناجح ✅', value: deliveredCount, color: '#10b981' },
            { name: 'مرتجع وفشل شحن ❌', value: returnedCount, color: '#ef4444' },
            { name: 'قيد التجهيز والمعالجة ⏱️', value: processingCount, color: '#3b82f6' }
        ].filter(d => d.value > 0);

        return { 
            totalRevenue, totalProductRevenue, totalOrders, avgOrderValue, 
            totalProfit, totalLoss, totalExpenses, 
            netFinancial: totalProfit - totalLoss - totalExpenses, 
            productPerformance, shippingPerformance,
            salesTrend, revenueGrowth, currentRevenue, deliveryBreakdown
        };
    }, [orders, settings, wallet]);

    // Income Statement Breakdown
    const incomeStatement = useMemo(() => {
        if (!settings || !reportData) return null;
        const grossSales = orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(o.status)).reduce((sum, o) => {
            const itemsRevenue = (o.items || []).reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
            return sum + (itemsRevenue + o.shippingFee - (o.discount || 0));
        }, 0);
        
        let totalCogs = 0;
        let returnsLoss = 0;
        orders.forEach(order => {
            const { loss } = calculateOrderProfitLoss(order, settings);
            if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(order.status)) {
                totalCogs += getOrderProductCost(order, settings);
            }
            if (['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(order.status)) {
                returnsLoss += loss;
            }
        });

        const totalExpenses = (wallet?.transactions || []).filter(t => t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_')).reduce((sum, t) => sum + t.amount, 0);
        
        const marketingAds = (wallet?.transactions || [])
            .filter(t => t.category === 'expense_ads' || (t.note && (t.note.toLowerCase().includes('تسويق') || t.note.toLowerCase().includes('إعلان') || t.note.toLowerCase().includes('ads') || t.note.toLowerCase().includes('marketing'))))
            .reduce((sum, t) => sum + t.amount, 0);

        const otherAdmin = totalExpenses - marketingAds;
        
        let successfulShippingOperations = 0;
        orders.forEach(order => {
            if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(order.status)) {
                const { profit } = calculateOrderProfitLoss(order, settings);
                const safeProductCost = getOrderProductCost(order, settings);
                const itemsRevenue = (order.items || []).reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
                const totalCollected = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
                    ? order.totalAmountOverride + (order.advancePayment || 0)
                    : (itemsRevenue + order.shippingFee - order.discount);
                successfulShippingOperations += Math.max(0, totalCollected - profit - safeProductCost);
            }
        });

        const realNetProfit = reportData.netFinancial;
        const marginRate = grossSales > 0 ? (realNetProfit / grossSales) * 100 : 0;

        return {
            grossSales,
            totalCogs,
            returnsLoss,
            marketingAds,
            otherAdmin,
            successfulShippingOperations,
            realNetProfit,
            marginRate
        };
    }, [orders, settings, wallet, reportData.netFinancial]);

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    const handleExportCSV = () => {
        const headers = ['إحصائية', 'القيمة'];
        const rows = [
            ['إجمالي الأرباح المستلمة', `${reportData.totalProfit} ج.م`],
            ['إجمالي خسائر شركات الشحن للمرتجعات', `${reportData.totalLoss} ج.م`],
            ['إجمالي المبيعات الإجمالية الناجحة', `${incomeStatement.grossSales} ج.م`],
            ['تكلفة المنتج الأصلي (COGS)', `${incomeStatement.totalCogs} ج.م`],
            ['تكاليف التسويق والإعلانات الممولة', `${incomeStatement.marketingAds} ج.م`],
            ['مصروفات إدارية ورقية وتشغيلية أخرى', `${incomeStatement.otherAdmin} ج.م`],
            ['أتعاب عمليات الشحن والتوصيل الناجح', `${incomeStatement.successfulShippingOperations} ج.م`],
            ['صافي الربح الفعلي الحقيقي', `${incomeStatement.realNetProfit} ج.م`],
            ['هامش صافي الربح %', `${incomeStatement.marginRate.toFixed(1)}%`],
            ['متوسط قيمة الفاتورة الناجحة', `${reportData.avgOrderValue.toFixed(1)} ج.م`],
            ['إجمالي عدد الطلبات الكلي', `${reportData.totalOrders}`],
        ];

        reportData.productPerformance.forEach((p, i) => {
            rows.push([`المنتج الأكثر مبيعاً #${i+1}: ${p.name}`, `عدد: ${p.quantitySold} قطعة (أرباح صافية منه: ${p.netProfit} ج.م)`]);
        });

        reportData.shippingPerformance.forEach(s => {
            rows.push([`شركة الشحن: ${s.name}`, `طلبات: ${s.count} (معدل تسليم ناجح: ${s.successRate.toFixed(1)}%)`]);
        });
        
        const csvContent = "\uFEFF" + [
            headers.join(","),
            ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ملخص_أداء_المبيعات_والأرباح_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const [isExporting, setIsExporting] = useState(false);
    const reportRef = React.useRef<HTMLDivElement>(null);

    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        try {
            await exportHTMLToPDF(reportRef.current, 'landscape', `ملخص_أداء_المبيعات_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF Export Error:', error);
            alert('حدث خطأ أثناء تصدير PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (!reportData || !incomeStatement) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                <Loader2 size={32} className="animate-spin text-indigo-500 mb-4" />
                <p className="text-sm font-bold">جاري تحميل التقارير المالية...</p>
            </div>
        );
    }

    return (
         <div className="space-y-6 animate-in fade-in-5 duration-300" ref={reportRef}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        <Coins className="text-blue-500" />
                        الملخص التفصيلي للحالة المالية والأرباح
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">توضح هذه اللوحة التحاليل المتكاملة والتكاليف بما فيها الإعلانات وسعر تكلفة المنتجات.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto no-print">
                    <button 
                        onClick={handleExportCSV}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        <Download size={14}/>
                        CSV
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all border border-transparent disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        PDF
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        <Printer size={14}/>
                        طباعة
                    </button>
                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl text-left hidden sm:block">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">مقارنة مبيعات الشهر الحالي</p>
                        <p className={`text-sm font-black flex items-center gap-1 ${reportData.revenueGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {reportData.revenueGrowth >= 0 ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
                            {Math.abs(reportData.revenueGrowth).toFixed(1)}%
                        </p>
                    </div>
                </div>
                
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <ReportCard title="إجمالي الأرباح" value={`${reportData.totalProfit.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م`} icon={<ArrowUp size={24}/>} color='emerald' tooltip="مجموع الأرباح الصافية من جميع الطلبات الناجحة (بعد خصم تكلفة المنتجات ومصاريف الشحن والرسوم)." />
                <ReportCard title="إجمالي الخسائر" value={`${reportData.totalLoss.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م`} icon={<ArrowDown size={24}/>} color='red' tooltip="مجموع مصاريف الشحن والارتجاع الضائع للطلبات المرتجعة والفاشلة." />
                <ReportCard title="مبيعات المنتجات" value={`${reportData.totalProductRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م`} icon={<Package size={24}/>} color='blue' tooltip="إجمالي قيمة المنتجات المباعة في الطلبات الناجحة بدون الشحن." />
                <ReportCard title="إجمالي المصروفات" value={`${reportData.totalExpenses.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م`} icon={<DollarSign size={24}/>} color='amber' tooltip="مجموع المصروفات الإدارية المسجلة بالخزنة كإعلانات وصيانة ورواتب لتخصم من الأرباح الكلية." />
                <ReportCard title="الصافي الفعلي الحقيقي" value={`${reportData.netFinancial.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م`} icon={<PieChartIcon size={24}/>} color='blue' tooltip="الربح الباقي النهائي والحقيقي بعد طرح إجمالي الخسائر وإجمالي المصاريف من أصل الربح." />
            </div>

            {/* Income Statement & Net Profit Margin Board */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <span className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><Coins size={18}/></span>
                            كشف الأرباح والتحليل التشريحي للتكاليف (Income Statement)
                        </h3>
                        <p className="text-xs text-slate-400 mb-6">يقوم النظام بفرز الدخل التشغيلي للمتجر وخصم تكلفة البضاعة بدقة وخصم تكاليف التسويق للوصول لصافي الربح الفعلي.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1 text-sm font-bold">
                                    <span className="text-slate-600 dark:text-slate-300">إجمالي حجم المبيعات الناجحة (إيرادات المبيعات + التوصيل)</span>
                                    <span>{incomeStatement.grossSales.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م (100%)</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: '100%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1 text-sm font-bold">
                                    <span className="text-slate-600 dark:text-slate-300">تكلفة شراء البضاعة المباعة الأصلية (COGS)</span>
                                    <span className="text-red-500">
                                        {incomeStatement.totalCogs.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م
                                        ({incomeStatement.grossSales > 0 ? ((incomeStatement.totalCogs / incomeStatement.grossSales) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-400" style={{ width: `${incomeStatement.grossSales > 0 ? (incomeStatement.totalCogs / incomeStatement.grossSales) * 100 : 0}%` }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1 text-sm font-bold">
                                    <span className="text-slate-600 dark:text-slate-300">تكاليف التسويق والإعلانات الممولة</span>
                                    <span className="text-orange-500">
                                        {incomeStatement.marketingAds.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م
                                        ({incomeStatement.grossSales > 0 ? ((incomeStatement.marketingAds / incomeStatement.grossSales) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-400" style={{ width: `${incomeStatement.grossSales > 0 ? (incomeStatement.marketingAds / incomeStatement.grossSales) * 100 : 0}%` }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1 text-sm font-bold">
                                    <span className="text-slate-600 dark:text-slate-300">أتعاب وتكاليف خدمات التوصيل والتحصيل للطلبات الناجحة</span>
                                    <span className="text-amber-500">
                                        {incomeStatement.successfulShippingOperations.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م
                                        ({incomeStatement.grossSales > 0 ? ((incomeStatement.successfulShippingOperations / incomeStatement.grossSales) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400" style={{ width: `${incomeStatement.grossSales > 0 ? (incomeStatement.successfulShippingOperations / incomeStatement.grossSales) * 100 : 0}%` }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1 text-sm font-bold">
                                    <span className="text-slate-600 dark:text-slate-300">خسائر التوصيل والارتجاع للطلبيات المرجوعة</span>
                                    <span className="text-red-500">
                                        {incomeStatement.returnsLoss.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م
                                        ({incomeStatement.grossSales > 0 ? ((incomeStatement.returnsLoss / incomeStatement.grossSales) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${incomeStatement.grossSales > 0 ? (incomeStatement.returnsLoss / incomeStatement.grossSales) * 100 : 0}%` }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1 text-sm font-bold">
                                    <span className="text-slate-600 dark:text-slate-300">أي مصروفات تشغيلية ورواتب ومصاريف إدارية أخرى</span>
                                    <span className="text-purple-500">
                                        {incomeStatement.otherAdmin.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م
                                        ({incomeStatement.grossSales > 0 ? ((incomeStatement.otherAdmin / incomeStatement.grossSales) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-400" style={{ width: `${incomeStatement.grossSales > 0 ? (incomeStatement.otherAdmin / incomeStatement.grossSales) * 100 : 0}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl">
                        <div>
                            <p className="text-xs text-slate-400 font-bold">هامش صافي الربح الفعلي الحقيقي:</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">الربح المتبقي للشركاء بعد تصفية كل المصاريف المترتبة على حجم المبيعات الكلي.</p>
                        </div>
                        <div className="text-left w-full sm:w-auto">
                            <span className="text-2xl font-black text-emerald-500 tabular-nums">
                                {incomeStatement.marginRate.toFixed(1)}% 🚀
                            </span>
                            <div className="text-xs text-slate-400 font-bold">({incomeStatement.realNetProfit.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م)</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Ring Chart: Delivery Breakdown */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-1.5 pb-2 border-b border-rose-50 dark:border-slate-800">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                تحليل كفاءة التوصيل والارتداد
                            </h3>
                            <div className="h-44 relative flex items-center justify-center">
                                {reportData.deliveryBreakdown.length === 0 ? (
                                    <p className="text-xs text-slate-400">لا توجد بيانات كافية</p>
                                ) : (
                                    <>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={reportData.deliveryBreakdown}
                                                    innerRadius={50}
                                                    outerRadius={70}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {reportData.deliveryBreakdown.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', direction: 'rtl' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute text-center">
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">معدل النجاح</span>
                                            <span className="text-xl font-black text-emerald-500">
                                                {reportData.totalOrders > 0 
                                                    ? ((orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(o.status)).length / reportData.totalOrders) * 100).toFixed(0) 
                                                    : 0}%
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 mt-4">
                            {reportData.deliveryBreakdown.map((item, idx) => {
                                const percentage = reportData.totalOrders > 0 ? (item.value / reportData.totalOrders) * 100 : 0;
                                return (
                                    <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="font-bold text-slate-600 dark:text-slate-300">{item.name}</span>
                                        </div>
                                        <span className="font-black text-slate-700 dark:text-slate-100">{item.value} طلب ({percentage.toFixed(0)}%)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="text-blue-500" />
                        منحنى تطور المبيعات (حجم الإيرادات التاريخي)
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={reportData.salesTrend}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', direction: 'rtl' }} />
                                <Line type="monotone" dataKey="revenue" name="الإيرادات ج.م" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">
                        <h3 className="text-md font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Package className="text-emerald-500" />
                            المنتجات الـ 5 الأكثر بيعاً وربحاً
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1">يقارن هذا المخطط عدد القطع الكلية المباعة مقابل هامش الربح المحقق منها.</p>
                    </div>
                    
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.productPerformance} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgb(100 116 139)' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" orientation="left" stroke="#4f46e5" tick={{ fontSize: 9 }} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 9 }} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', direction: 'rtl' }} />
                                <Bar yAxisId="left" dataKey="quantitySold" name="القطع المباعة" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={15} />
                                <Bar yAxisId="right" dataKey="netProfit" name="الربح الصافي (ج.م)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

             <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Truck/> أداء شركات الشحن</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reportData.shippingPerformance.map(company => (
                         <div key={company.name} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h4 className="font-bold text-slate-700 dark:text-white">{company.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي الطلبات: {company.count}</p>
                            <div className="mt-3">
                                <div className="flex justify-between items-center text-xs font-bold mb-1">
                                    <span className="text-emerald-600 dark:text-emerald-400">نسبة النجاح</span>
                                    <span>{company.successRate.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${company.successRate}%` }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const LossesReport: React.FC<Omit<ReportsPageProps, 'wallet'>> = ({ orders, settings, activeStore, dateRangeText }) => {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [isContinuous, setIsContinuous] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const failedOrders = useMemo(() => {
        return orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status))
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders]);

    const stats = useMemo(() => {
        let totalLoss = 0;
        failedOrders.forEach(order => {
            const { loss } = calculateOrderProfitLoss(order, settings);
            totalLoss += loss;
        });
        return { totalLoss, count: failedOrders.length };
    }, [failedOrders, settings]);

    // Return Reasons and Company Auditing
    const returnAudit = useMemo(() => {
        const reasons = {
            'no_response': 0, // العميل لا يرد / هاتف مغلق
            'damaged': 0,     // منتج تالف / عيب مصنعي
            'delay': 0,       // تأخر في الشحن والتسليم
            'canceled': 0,    // تغيير رأي العميل / إلغاء الطلب
            'price_issue': 0, // اعتراض على السعر / قيمة التوصيل
            'mismatch': 0,    // المنتج غير مطابق للمواصفات أو المقاس
            'other': 0,       // أخرى / غير محدد
        };

        const companyStats: Record<string, { total: number; returned: number; delivered: number; loss: number }> = {};

        // Initialize companyStats with active companies
        Object.keys(settings.shippingOptions || {}).forEach(c => {
            companyStats[c] = { total: 0, returned: 0, delivered: 0, loss: 0 };
        });

        // Loop over ALL orders in selection to get proper denominators
        orders.forEach(o => {
            const company = o.shippingCompany || 'غير معروف';
            if (!companyStats[company]) {
                companyStats[company] = { total: 0, returned: 0, delivered: 0, loss: 0 };
            }
            companyStats[company].total += 1;

            const isReturned = ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status);
            const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(o.status);

            if (isReturned) {
                companyStats[company].returned += 1;
                const { loss } = calculateOrderProfitLoss(o, settings);
                companyStats[company].loss += loss;

                // Classify reason
                const notesText = ((o.notes || '') + ' ' + (o.cancellationReason || '') + ' ' + (o.returnDescription || '')).toLowerCase();
                if (notesText.includes('لا يرد') || notesText.includes('لا يجيب') || notesText.includes('مغلق') || notesText.includes('موبايل غير متاح') || notesText.includes('المشترك مغلق') || notesText.includes('يردش') || notesText.includes('تليفون مقفول')) {
                    reasons.no_response += 1;
                } else if (notesText.includes('تالف') || notesText.includes('عيب') || notesText.includes('مكسور') || notesText.includes('قطع') || notesText.includes('مفتوح') || notesText.includes('خربش')) {
                    reasons.damaged += 1;
                } else if (notesText.includes('تأخر') || notesText.includes('تأخير') || notesText.includes('اتأخر') || notesText.includes('بطيء') || notesText.includes('غاب') || notesText.includes('طول')) {
                    reasons.delay += 1;
                } else if (notesText.includes('مقاس') || notesText.includes('شكل') || notesText.includes('لون') || notesText.includes('مختلف') || notesText.includes('غير مطابق') || notesText.includes('اللون') || notesText.includes('المقاس')) {
                    reasons.mismatch += 1;
                } else if (notesText.includes('سعر') || notesText.includes('غالي') || notesText.includes('فلوس') || notesText.includes('مصاريف')) {
                    reasons.price_issue += 1;
                } else if (notesText.includes('الغاء') || notesText.includes('الغي') || notesText.includes('مش عايز') || notesText.includes('تراجع') || notesText.includes('رفض') || notesText.includes('غير رأيه')) {
                    reasons.canceled += 1;
                } else {
                    reasons.other += 1;
                }
            } else if (isDelivered) {
                companyStats[company].delivered += 1;
            }
        });

        const reasonLabels: Record<string, string> = {
            'no_response': 'العميل لا يرد / هاتف مغلق',
            'damaged': 'منتج تالف / عيب مصنعي',
            'delay': 'تأخر في الشحن والتسليم',
            'canceled': 'تغيير رأي العميل / إلغاء',
            'price_issue': 'اعتراض على السعر / الشحن',
            'mismatch': 'المنتج غير مطابق للمقاس/الموديل',
            'other': 'أسباب أخرى / غير محددة',
        };

        const chartData = Object.entries(reasons).map(([key, count]) => ({
            name: reasonLabels[key],
            value: count,
        })).filter(r => r.value > 0);

        const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

        return { chartData, companyStats: Object.entries(companyStats).map(([name, stats]) => ({ name, ...stats })).filter(c => c.total > 0), COLORS };
    }, [orders, settings]);

    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    const handlePreview = () => {
        const storeName = activeStore?.name || 'متجري';
        const html = generateLossesReportHTML(failedOrders, settings, storeName, orientation, isContinuous, dateRangeText);
        setPreviewHtml(html);
    };

    const handleActualExportPDF = async () => {
        if (!previewHtml) return;
        setIsExporting(true);
        try {
            await exportHTMLToPDF(previewHtml, orientation, `تقرير_الخسائر_${new Date().toISOString().split('T')[0]}.pdf`, isContinuous);
        } catch (error) {
            console.error('PDF Export Error:', error);
            alert('حدث خطأ أثناء تصدير PDF.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleActualPrint = () => {
        if (!previewHtml) return;
        printHTMLDirectly(previewHtml);
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const storeName = activeStore?.name || 'متجري';
            const html = generateLossesReportHTML(failedOrders, settings, storeName, orientation, isContinuous, dateRangeText);
            await exportHTMLToPDF(html, orientation, `تقرير_الخسائر_${new Date().toISOString().split('T')[0]}.pdf`, isContinuous);
        } catch (error) {
            console.error('PDF Export Error:', error);
            alert('حدث خطأ أثناء تصدير PDF.');
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        const storeName = activeStore?.name || 'متجري';
        const html = generateLossesReportHTML(failedOrders, settings, storeName, orientation, isContinuous, dateRangeText);
        printHTMLDirectly(html);
    };

    const handleExportCSV = () => {
        const headers = ['رقم الطلب', 'العميل', 'الهاتف', 'شركة الشحن', 'المنتجات', 'الكمية', 'التكلفة', 'مصاريف الشحن', 'الخسارة ج.م', 'السبب والملاحظات'];
        const rows = failedOrders.map(o => {
            const { loss } = calculateOrderProfitLoss(o, settings);
            const itemsText = (o.items || []).map(i => `${i.name} (x${i.quantity})`).join(' + ');
            const qty = (o.items || []).reduce((sum, item) => sum + item.quantity, 0);
            return [
                o.orderNumber,
                o.customerName,
                o.customerPhone,
                o.shippingCompany,
                itemsText,
                qty,
                (o.items || []).reduce((sum, item) => sum + (item.cost * item.quantity), 0),
                o.shippingFee,
                loss,
                o.cancellationReason || o.notes || ''
            ];
        });

        const csvContent = "\uFEFF" + [
            headers.join(","),
            ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `تقرير_المرتجعات_والخسائر_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="text-red-500" />
                        تشريح أسباب المرتجعات والخسائر المالية (Losses Analysis)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">يحلل هذا الجزء أسباب الارتداد الكامنة ومستويات إخفاق شركات الشحن في تسليم شحناتك.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button 
                        onClick={handleExportCSV}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        <Download size={14}/> CSV
                    </button>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setIsContinuous(false)}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${!isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            صفحات
                        </button>
                        <button 
                            onClick={() => setIsContinuous(true)}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            متصل
                        </button>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setOrientation('portrait')}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${orientation === 'portrait' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            طولي
                        </button>
                        <button 
                            onClick={() => setOrientation('landscape')}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${orientation === 'landscape' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            عرضي
                        </button>
                    </div>
                    <button 
                        onClick={handlePreview} 
                        disabled={isExporting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-all shadow-sm"
                    >
                        <Eye size={12}/>
                        معاينة الطباعة / PDF
                    </button>
                </div>
            </div>
            
            <div className="text-xs text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border-r-4 border-red-500">
                <strong>شرح توضيحي:</strong> يعرض هذا القسم تفاصيل الطلبات التي لم تنجح (مرتجع، فشل توصيل). يوضح تكلفة الشحن المهدرة وأي رسوم أخرى تحملتها بالإضافة إلى تصنيف آلي لأسباب الفشل وتصنيف فاعلية شركات الشحن.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportCard title="إجمالي الخسائر المقدرة" value={`${stats.totalLoss.toLocaleString('ar-EG')} ج.م`} icon={<ArrowDown size={24}/>} color="red" tooltip="إجمالي المبالغ المهدرة على مصاريف الشحن للطلبات التي لم يتم تسليمها." />
                <ReportCard title="عدد الطلبات الفاشلة/المرتجعة" value={stats.count.toString()} icon={<AlertTriangle size={24}/>} color="amber" tooltip="إجمالي عدد الطلبات التي حالتها مرتجع أو فشل توصيل." />
            </div>

            {/* RETURN REASONS AUDITING & SHIPPING AUDITING VISUALS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Return Reasons Analysis */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-md font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg"><AlertTriangle size={16}/></span>
                            تشريح وتحليل أسباب المرتجعات الأكثر شيوعاً
                        </h3>
                        <p className="text-xs text-slate-400 mb-6">يصنف النظام أسباب فشل التوصيل والارتداد بشكل تلقائي عبر مسح الملاحظات للوقوف على الخلل الحقيقي.</p>

                        <div className="h-64">
                            {returnAudit.chartData.length === 0 ? (
                                <p className="text-center py-12 text-slate-400 text-xs">لا توجد بيانات مرتجعات متاحة حالياً للتصنيف.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={returnAudit.chartData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {returnAudit.chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={returnAudit.COLORS[index % returnAudit.COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', direction: 'rtl' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2 mt-4">
                        {returnAudit.chartData.map((item, idx) => {
                            const ratio = stats.count > 0 ? (item.value / stats.count) * 100 : 0;
                            return (
                                <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: returnAudit.COLORS[idx % returnAudit.COLORS.length] }} />
                                        <span className="font-bold text-slate-600 dark:text-slate-300">{item.name}</span>
                                    </div>
                                    <span className="font-black text-slate-700 dark:text-slate-100">{item.value} حالة ({ratio.toFixed(1)}%)</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Shipping Companies Performance Auditing */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-md font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><Truck size={16}/></span>
                            تحليل ومساءلة شركات الشحن (معدلات المرتجعات والأموال المهدرة)
                        </h3>
                        <p className="text-xs text-slate-400 mb-6">يقارن هذا الجدول كفاءة كل شركة شحن بشكل دقيق: نسبة الارتداد والمال الضائع في الشحن المهدر.</p>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold">
                                    <tr>
                                        <th className="px-3 py-2">شركة الشحن</th>
                                        <th className="px-3 py-2 text-center">إجمالي الشحنات</th>
                                        <th className="px-3 py-2 text-center">المرتجعة</th>
                                        <th className="px-3 py-2 text-center">معدل المرتجعات</th>
                                        <th className="px-3 py-2">الشحن الضائع (خسارة)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {returnAudit.companyStats.map(c => {
                                        const returnRate = c.total > 0 ? (c.returned / c.total) * 100 : 0;
                                        return (
                                            <tr key={c.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                <td className="px-3 py-3 font-bold text-slate-800 dark:text-white">{c.name}</td>
                                                <td className="px-3 py-3 text-center font-mono">{c.total}</td>
                                                <td className="px-3 py-3 text-center font-mono text-red-500">{c.returned}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className={`font-mono font-bold ${returnRate > 15 ? 'text-red-500' : 'text-slate-500'}`}>
                                                            {returnRate.toFixed(1)}%
                                                        </span>
                                                        <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden inline-block sm:inline-block">
                                                            <div className={`h-full ${returnRate > 15 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${returnRate}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 font-mono font-bold text-red-600">
                                                    -{c.loss.toLocaleString('ar-EG')} ج.م
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

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">سجل الطلبات الفاشلة بالتفصيل</h3>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-right font-sans">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                           <tr>
                                <th className="px-4 py-3" title="اسم العميل ورقم هاتفه.">العميل</th>
                                <th className="px-4 py-3" title="المنتجات التي تم طلبها.">المنتجات</th>
                                <th className="px-4 py-3 text-center" title="إجمالي عدد القطع في الطلب.">الكمية</th>
                                <th className="px-4 py-3" title="سعر بيع المنتجات للعميل.">السعر</th>
                                <th className="px-4 py-3" title="تكلفة الشحن المدفوعة لشركة الشحن.">الشحن</th>
                                <th className="px-4 py-3" title="رسوم التأمين والمعاينة إن وجدت.">تأمين/معاينة</th>
                                <th className="px-4 py-3" title="تكلفة البضاعة الأصلية (سعر الجملة).">التكلفة</th>
                                <th className="px-4 py-3" title="حالة الطلب الحالية.">الحالة</th>
                                <th className="px-4 py-3" title="حالة تحصيل الأموال من شركة الشحن.">الدفع</th>
                                <th className="px-4 py-3 text-center" title="قيمة الخسارة الناتجة عن هذا الطلب (عادة مصاريف الشحن المهدرة).">الخسارة/التحصيل</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {failedOrders.length === 0 ? (
                                <tr><td colSpan={10} className="text-center py-12 text-slate-400">لا توجد طلبات فاشلة أو مرتجعة.</td></tr>
                            ) : (
                                failedOrders.map(order => {
                                    const { loss } = calculateOrderProfitLoss(order, settings);
                                    const codFee = calculateCodFee(order, settings);
                                    
                                    const compFees = settings.companySpecificFees?.[order.shippingCompany];
                                    const useCustom = compFees?.useCustomFees ?? false;
                                    const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
                                    const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
                                    const inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
                                    const isInsured = order.isInsured ?? true;
                                    const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
                                    const bostaVat = !isPosOrder && isBosta(order.shippingCompany) ? calculateBostaVat(order, insuranceFee, settings) : 0;

                                    const productsList = (order.items || []).map(i => `${i.name} (الكمية: ${i.quantity})`).join(' + ') || order.productName;

                                    return (
                                        <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs text-right">
                                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                                                <div>{order.customerName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{order.customerPhone}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={productsList}>{productsList}</td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{(order.items || []).reduce((sum, item) => sum + item.quantity, 0)}</td>
                                            <td className="px-4 py-3 font-mono">{(order.productPrice || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 font-mono">{(order.shippingFee || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 font-mono">{(insuranceFee + inspectionCost + bostaVat).toLocaleString()}</td>
                                            <td className="px-4 py-3 font-mono">{(order.items || []).reduce((sum, item) => sum + (item.cost * item.quantity), 0).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full whitespace-nowrap">
                                                    {order.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] text-slate-500">{order.paymentStatus}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="font-black text-red-600">-{(loss || 0).toLocaleString()}</div>
                                                {codFee > 0 && <div className="text-[9px] text-slate-400">تحصيل: {codFee}</div>}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>

            {previewHtml && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                    <div className="bg-slate-200 dark:bg-slate-800 w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-300 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-t-2xl">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileText className="text-red-500" />
                                معاينة تقرير الخسائر
                            </h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleActualExportPDF} 
                                    disabled={isExporting}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
                                >
                                    {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>}
                                    <span className="hidden sm:inline">{isExporting ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                                </button>
                                <button onClick={handleActualPrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all">
                                    <Printer size={16}/> <span className="hidden sm:inline">طباعة التقرير</span>
                                </button>
                                <button onClick={() => setPreviewHtml(null)} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-xl transition-colors mr-2">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-800/50 flex align-top justify-center">
                            <div className="bg-white rounded-xl shadow-lg w-full overflow-hidden h-fit min-h-full" style={{ maxWidth: orientation === 'landscape' ? '1122.5px' : '793px' }}>
                                <iframe srcDoc={previewHtml} className="w-full h-[800px] border-0" title="Report Preview" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ComprehensiveReport: React.FC<ReportsPageProps> = ({ orders, settings, wallet, activeStore, dateRangeText }) => {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [isContinuous, setIsContinuous] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    
    const stats = useMemo(() => {
        const collectedOrders = orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status));
        const failedOrders = orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status));

        let totalRevenue = 0;
        let totalProductRevenue = 0;
        let totalProductExtraMarkup = 0;
        let totalExtraMarkup = 0;
        let totalShippingRevenue = 0;
        let totalActualShipping = 0;
        let totalShippingMarkup = 0;
        let totalCogs = 0;
        let totalInsuranceFees = 0;
        let totalInspectionFees = 0;
        let totalCodFees = 0;
        let totalProfit = 0;
        let totalPercentageProfit = 0;
        let totalCommissionProfit = 0;

        collectedOrders.forEach(order => {
            const { profit } = calculateOrderProfitLoss(order, settings);
            const codFee = calculateCodFee(order, settings);
            
            const compFees = settings.companySpecificFees?.[order.shippingCompany];
            const useCustom = compFees?.useCustomFees ?? false;
            const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
            const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
            const inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
            const isInsured = order.isInsured ?? true;
            const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
            const inspectionAdjustment = (!isPosOrder && order.inspectionFeePaidByCustomer) ? 0 : inspectionCost;

            const safeProductPrice = Number(order.productPrice) || 0;
            const safeShippingFee = Number(order.shippingFee) || 0;
            const safeDiscount = Number(order.discount) || 0;
            const safeAdvance = Number(order.advancePayment) || 0;

            const totalCollected = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
                ? order.totalAmountOverride + safeAdvance
                : (safeProductPrice + safeShippingFee - safeDiscount);

            totalRevenue += totalCollected;
            totalShippingRevenue += order.shippingFee;

            const standardShipping = isPosOrder ? 0 : getStandardShippingFee(order, settings);
            totalActualShipping += standardShipping;

            const shippingMarkup = isPosOrder ? 0 : Math.max(0, order.shippingFee - standardShipping);
            totalShippingMarkup += shippingMarkup;

            totalCogs += (order.items || []).reduce((sum, item) => {
                const actualCost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                return sum + (actualCost * item.quantity);
            }, 0);
            totalInsuranceFees += insuranceFee;
            totalInspectionFees += inspectionAdjustment;
            totalCodFees += codFee;
            totalProfit += profit;

            // Calculate item-level profits and separate base revenue from markup
            let orderProductExtraMarkup = 0;
            order.items.forEach(item => {
                const product = settings.products.find(p => p.id === item.productId || p.variants?.some(v => v.id === item.productId));
                const actualCost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                const itemProfit = (item.price - actualCost) * item.quantity;
                
                if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                    const basePriceRevenue = product.basePrice * item.quantity;
                    const extraMarkup = (item.price - product.basePrice) * item.quantity;
                    totalProductRevenue += basePriceRevenue;
                    orderProductExtraMarkup += extraMarkup;
                    totalCommissionProfit += itemProfit;
                } else {
                    totalProductRevenue += item.price * item.quantity;
                    if (product?.profitMode === 'commission') {
                        totalCommissionProfit += itemProfit;
                    } else {
                        totalPercentageProfit += itemProfit;
                    }
                }
            });
            totalProductExtraMarkup += orderProductExtraMarkup;
            totalExtraMarkup += (orderProductExtraMarkup + shippingMarkup);
        });

        let totalLoss = 0;
        let totalFailedShipping = 0;
        let totalFailedInsurance = 0;
        let totalFailedInspection = 0;
        let totalReturnFees = 0;

        failedOrders.forEach(order => {
            const { loss } = calculateOrderProfitLoss(order, settings);
            const compFees = settings.companySpecificFees?.[order.shippingCompany];
            const useCustom = compFees?.useCustomFees ?? false;
            
            const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
            const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
            const inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
            const isInsured = order.isInsured ?? true;
            const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
            const bostaVat = !isPosOrder && isBosta(order.shippingCompany) ? calculateBostaVat(order, insuranceFee, settings) : 0;
            
            const applyReturnFee = !isPosOrder && (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
            const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
            const inspectionFeeCollected = (!isPosOrder && order.inspectionFeePaidByCustomer) ? inspectionCost : 0;

            totalFailedShipping += order.shippingFee;
            totalFailedInsurance += insuranceFee;
            totalFailedInspection += (inspectionCost - inspectionFeeCollected);
            totalReturnFees += returnFeeAmount;
            totalLoss += loss;
        });

        const extraPosSales = (settings?.posSales || []).filter(s => !orders.some(o => o.id === s.id || o.orderNumber === s.saleNumber));
        let extraPosProfit = 0;
        let extraPosRevenue = 0;
        let extraPosCOGS = 0;
        extraPosSales.forEach(s => {
            (s.items || []).forEach(item => {
                const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                extraPosCOGS += (cost * (item.quantity || 1));
                extraPosRevenue += (item.price * (item.quantity || 1));
                const itemProfit = (item.price - cost) * (item.quantity || 1);
                extraPosProfit += itemProfit;
                totalPercentageProfit += itemProfit; // Add to percentage profit out of simplicity
            });
        });

        totalRevenue += extraPosRevenue;
        totalProductRevenue += extraPosRevenue;
        totalCogs += extraPosCOGS;
        totalProfit += extraPosProfit;

        const totalExpenses = (wallet?.transactions || []).filter(t => t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_')).reduce((sum, t) => sum + t.amount, 0);

        const finalNet = totalProfit - totalLoss - totalExpenses;

        // --- NEW CALCULATIONS ---
        const successRate = orders.length > 0 ? (collectedOrders.length / orders.length) * 100 : 0;
        const grossProfit = totalPercentageProfit + totalCommissionProfit;
        const lossRatio = grossProfit > 0 ? (totalLoss / grossProfit) * 100 : 0;
        const avgProfitPerOrder = orders.length > 0 ? finalNet / orders.length : 0;

        // Demographic Analysis (Exclude cancelled/draft/reviewing orders for accurate success rates & profits)
        const geoStats: Record<string, { count: number, success: number, revenue: number, loss: number, netProfit: number }> = {};
        orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل', 'مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)).forEach(o => {
            const area = o.governorate || o.shippingArea || 'غير محدد';
            if (!geoStats[area]) geoStats[area] = { count: 0, success: 0, revenue: 0, loss: 0, netProfit: 0 };
            geoStats[area].count++;
            const { net, loss } = calculateOrderProfitLoss(o, settings);
            geoStats[area].netProfit += net;
            if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status)) {
                geoStats[area].success++;
                geoStats[area].revenue += (o.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) + o.shippingFee);
            }
            geoStats[area].loss += loss;
        });

        const geoData = Object.entries(geoStats).map(([name, s]) => ({
            name,
            successRate: s.count > 0 ? (s.success / s.count) * 100 : 0,
            revenue: s.revenue,
            loss: s.loss,
            net: s.netProfit
        })).sort((a, b) => b.revenue - a.revenue);

        // Expense Categories for Pie Chart
        const expenseCategories = [
            { name: 'إعلانات', value: (wallet?.transactions || []).filter(t => t.category === 'expense_ads').reduce((sum, t) => sum + t.amount, 0), color: '#4f46e5' },
            { name: 'رواتب', value: (wallet?.transactions || []).filter(t => t.category === 'expense_salary').reduce((sum, t) => sum + t.amount, 0), color: '#06b6d4' },
            { name: 'إيجار', value: (wallet?.transactions || []).filter(t => t.category === 'expense_rent').reduce((sum, t) => sum + t.amount, 0), color: '#8b5cf6' },
            { name: 'شحن مشتريات (توريد)', value: (wallet?.transactions || []).filter(t => (t.category as string) === 'supply_expense_shipping' || t.category === 'expense_shipping_fees').reduce((sum, t) => sum + t.amount, 0), color: '#f59e0b' },
            { name: 'مصاريف توريد أخرى', value: (wallet?.transactions || []).filter(t => (t.category as string) === 'supply_expense_other').reduce((sum, t) => sum + t.amount, 0), color: '#059669' },
            { name: 'أخرى', value: (wallet?.transactions || []).filter(t => t.category === 'expense_other').reduce((sum, t) => sum + t.amount, 0), color: '#ec4899' },
        ].filter(c => c.value > 0);

        // Carrier Performance (Filter to processed orders only)
        const carrierStats: Record<string, { count: number, success: number, shipping: number, profit: number }> = {};
        orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل', 'مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)).forEach(o => {
            const name = o.shippingCompany || 'غير محدد';
            if (!carrierStats[name]) carrierStats[name] = { count: 0, success: 0, shipping: 0, profit: 0 };
            carrierStats[name].count++;
            if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status)) carrierStats[name].success++;
            carrierStats[name].shipping += o.shippingFee;
            const { net } = calculateOrderProfitLoss(o, settings);
            carrierStats[name].profit += net;
        });

        // Product Profitability
        const productStats: Record<string, { revenue: number, extra: number, cost: number, sold: number, returns: number }> = {};
        orders.forEach(o => {
            o.items.forEach(item => {
                if (!productStats[item.name]) productStats[item.name] = { revenue: 0, extra: 0, cost: 0, sold: 0, returns: 0 };
                if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة') {
                    const product = settings.products.find(p => p.id === item.productId || p.variants?.some(v => v.id === item.productId));
                    if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                        productStats[item.name].revenue += product.basePrice * item.quantity;
                        productStats[item.name].extra += (item.price - product.basePrice) * item.quantity;
                    } else {
                        productStats[item.name].revenue += item.price * item.quantity;
                    }
                    productStats[item.name].cost += item.cost * item.quantity;
                    productStats[item.name].sold += item.quantity;
                } else if (['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)) {
                    productStats[item.name].returns += item.quantity;
                }
            });
        });

        // Wallet Sync
        const pendingCollection = orders.filter(o => o.status === 'تم_توصيلها' && !o.collectionProcessed).reduce((sum, o) => sum + (o.productPrice + o.shippingFee), 0);
        
        // --- PARTNER CALCULATIONS ---
        const partners = settings.partners || [];
        const partnerTransactions = settings.partnerTransactions || [];
        
        const totalCapital = partnerTransactions
            .filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage')
            .reduce((sum, t) => sum + t.amount, 0);
            
        const totalLoans = partnerTransactions
            .filter(t => t.type === 'loan')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalAdvances = partnerTransactions
            .filter(t => t.type === 'customer_advance')
            .reduce((sum, t) => sum + t.amount, 0);
            
        const totalProfitWithdrawals = partnerTransactions
            .filter(t => t.type === 'profit_distribution')
            .reduce((sum, t) => sum + t.amount, 0);

        const partnerPerformance = partners.map(partner => {
            const partnerTx = partnerTransactions.filter(t => t.partnerId === partner.id);
            const capitalContribution = partnerTx.filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage').reduce((sum, t) => sum + t.amount, 0);
            const loans = partnerTx.filter(t => t.type === 'loan').reduce((sum, t) => sum + t.amount, 0);
            const advances = partnerTx.filter(t => t.type === 'customer_advance').reduce((sum, t) => sum + t.amount, 0);
            const withdrawals = partnerTx.filter(t => t.type === 'profit_withdrawal').reduce((sum, t) => sum + t.amount, 0);
            const distributions = partnerTx.filter(t => t.type === 'profit_distribution').reduce((sum, t) => sum + t.amount, 0);
            const repayments = partnerTx.filter(t => t.type === 'repayment').reduce((sum, t) => sum + t.amount, 0);
            
            const currentProfitShare = (finalNet * (partner.profitRatio || 0)) / 100;
            const undistributedShare = Math.max(0, currentProfitShare - distributions);
            const currentBalance = partner.balance || 0; 
            
            return {
                ...partner,
                capitalContribution,
                loans,
                advances,
                withdrawals,
                distributions,
                repayments,
                netLoan: loans - repayments,
                currentProfitShare: undistributedShare,
                currentBalance
            };
        });

        // Inventory Value
        const inventoryValue = settings.products.reduce((sum, p) => {
            if (p.hasVariants && p.variants) {
                return sum + p.variants.reduce((vSum, v) => vSum + (getLatestProductCost(v.id, settings) * (v.stockQuantity || 0)), 0);
            }
            return sum + (getLatestProductCost(p.id, settings) * (p.stockQuantity || 0));
        }, 0);

        const inventorySalesValue = settings.products.reduce((sum, p) => {
            if (p.hasVariants && p.variants) {
                return sum + p.variants.reduce((vSum, v) => vSum + (v.price * (v.stockQuantity || 0)), 0);
            }
            return sum + (p.price * (p.stockQuantity || 0));
        }, 0);

        return { 
            totalRevenue, totalProductRevenue, totalProductExtraMarkup, totalExtraMarkup, totalShippingRevenue, totalActualShipping, totalShippingMarkup, totalCogs, 
            totalInsuranceFees, totalInspectionFees, totalCodFees, totalProfit, 
            totalLoss, totalFailedShipping, totalFailedInsurance, totalFailedInspection, 
            totalReturnFees, totalExpenses, finalNet, totalPercentageProfit, totalCommissionProfit,
            successRate, lossRatio, avgProfitPerOrder, carrierStats, productStats, pendingCollection,
            collectedOrdersCount: collectedOrders.length, geoData, expenseCategories, inventoryValue, inventorySalesValue,
            partnerPerformance, totalCapital, totalLoans, totalAdvances, totalProfitWithdrawals
        };
    }, [orders, settings, wallet]);

    const handlePreview = () => {
        const storeName = activeStore?.name || 'متجري';
        const html = generateComprehensiveFinancialReportHTML(orders, settings, wallet, storeName, orientation, isContinuous, dateRangeText);
        setPreviewHtml(html);
    };

    const handleActualExportPDF = async () => {
        if (!previewHtml) return;
        setIsExporting(true);
        try {
            await exportHTMLToPDF(previewHtml, orientation, `التقرير_الختامي_الشامل_${new Date().toISOString().split('T')[0]}.pdf`, isContinuous);
        } catch (error) {
            console.error('PDF Export Error:', error);
            alert('حدث خطأ أثناء تصدير PDF.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleActualPrint = () => {
        if (!previewHtml) return;
        printHTMLDirectly(previewHtml);
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const storeName = activeStore?.name || 'متجري';
            const html = generateComprehensiveFinancialReportHTML(orders, settings, wallet, storeName, orientation, isContinuous, dateRangeText);
            await exportHTMLToPDF(html, orientation, `التقرير_الختامي_الشامل_${new Date().toISOString().split('T')[0]}.pdf`, isContinuous);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('حدث خطأ أثناء تصدير PDF. قد تحتاج لتجربة الطباعة والحفظ.');
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        const storeName = activeStore?.name || 'متجري';
        const html = generateComprehensiveFinancialReportHTML(orders, settings, wallet, storeName, orientation, isContinuous, dateRangeText);
        printHTMLDirectly(html);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-col sm:flex-row gap-4 mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-slate-700 dark:text-white">ملخص شامل لأداء متجرك والمركز المالي للشركاء</h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 justify-center">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setIsContinuous(false)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            صفحات
                        </button>
                        <button 
                            onClick={() => setIsContinuous(true)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            متصل
                        </button>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setOrientation('portrait')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'portrait' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            طولي
                        </button>
                        <button 
                            onClick={() => setOrientation('landscape')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'landscape' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            عرضي
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handlePreview} 
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                        >
                            <Eye size={16}/>
                            معاينة للطباعة / PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Stage 1: Revenues */}
            <div className="bg-blue-50/30 dark:bg-blue-900/5 p-6 rounded-3xl border border-blue-100 dark:border-blue-800/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">1</div>
                    <div>
                        <h3 className="text-lg font-black text-blue-900 dark:text-blue-100">المرحلة الأولى: الإيرادات والتدفقات (ماذا دخل إلينا؟)</h3>
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70">كل المبالغ التي تم تحصيلها من العملاء قبل أي خصومات.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ReportCard title="إجمالي مبيعات المنتجات" value={`${(stats.totalProductRevenue + stats.totalExtraMarkup).toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="blue" subValue="ثمن البيع (الأساسي + الزيادة)" tooltip="إجمالي المبالغ التي تم بيع المنتجات بها للعملاء (السعر الأساسي للمنتج + أي زيادة أضفتها على السعر)." />
                    <ReportCard title="مبيعات المنتجات (بالأساسي)" value={`${stats.totalProductRevenue.toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="blue" subValue="أصل ثمن البيع قبل الزيادة" tooltip="إجمالي السعر الأساسي للمنتجات المباعة، بدون حساب أي زيادة إضافية قمت بوضعها." />
                    <ReportCard title="الربح الإضافي (الزيادة)" value={`${stats.totalExtraMarkup.toLocaleString('ar-EG')} ج.م`} icon={<TrendingUp size={24}/>} color="emerald" subValue="الفرق بين سعر البيع والأساسي" tooltip="إجمالي الأرباح الناتجة عن بيع المنتجات بسعر أعلى من سعرها الأساسي الموصى به." />
                    <ReportCard title="تحصيل الشحن" value={`${stats.totalShippingRevenue.toLocaleString('ar-EG')} ج.م`} icon={<Truck size={24}/>} color="blue" subValue="المبالغ المدفوعة للشحن" tooltip="إجمالي رسوم الشحن التي دفعها العملاء عند استلام الطلبات." />
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 2: Direct Costs */}
            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-slate-700 text-white rounded-full flex items-center justify-center font-black shadow-lg">2</div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">المرحلة الثانية: التكاليف المباشرة (ماذا خرج فوراً؟)</h3>
                        <p className="text-xs text-slate-500">تكلفة البضاعة ومصاريف الشحن الأساسية للطلبات الناجحة.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ReportCard title="إجمالي تكلفة البضاعة" value={`${stats.totalCogs.toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="blue" subValue="للطلبات التي تم تحصيلها" tooltip="إجمالي التكلفة الأصلية للمنتجات (سعر الجملة) للطلبات التي تم تسليمها بنجاح." />
                    <ReportCard title="مصاريف شحن الذهاب" value={`${stats.totalShippingRevenue.toLocaleString('ar-EG')} ج.م`} icon={<Truck size={24}/>} color="red" subValue="المدفوعة لشركات الشحن" tooltip="إجمالي مصاريف الشحن التي تم دفعها لشركات الشحن مقابل توصيل الطلبات الناجحة." />
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 3: Fees */}
            <div className="bg-amber-50/30 dark:bg-amber-900/5 p-6 rounded-3xl border border-amber-100 dark:border-amber-800/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-amber-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">3</div>
                    <div>
                        <h3 className="text-lg font-black text-amber-900 dark:text-amber-100">المرحلة الثالثة: الرسوم والأعباء (ماذا استنزف الربح؟)</h3>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70">رسوم الخدمات المخصومة من كل طلب ناجح.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ReportCard title="إجمالي التأمين (ناجح)" value={`${stats.totalInsuranceFees.toLocaleString('ar-EG')} ج.م`} icon={<FileText size={24}/>} color="blue" subValue="رسوم التأمين للطلبات المحصلة" tooltip="إجمالي رسوم التأمين التي تم خصمها على الطلبات التي تم تسليمها بنجاح." />
                    <ReportCard title="إجمالي المعاينة (ناجح)" value={`${stats.totalInspectionFees.toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="blue" subValue="رسوم المعاينة للطلبات المحصلة" tooltip="إجمالي رسوم المعاينة التي تم خصمها على الطلبات التي تم تسليمها بنجاح." />
                    <ReportCard title="إجمالي الـ COD (ناجح)" value={`${stats.totalCodFees.toLocaleString('ar-EG')} ج.م`} icon={<DollarSign size={24}/>} color="blue" subValue="رسوم التحصيل للطلبات المحصلة" tooltip="إجمالي رسوم الدفع عند الاستلام (COD) التي تم خصمها على الطلبات التي تم تسليمها بنجاح." />
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 4: Losses & Expenses */}
            <div className="bg-red-50/30 dark:bg-red-900/5 p-6 rounded-3xl border border-red-100 dark:border-red-800/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">4</div>
                    <div>
                        <h3 className="text-lg font-black text-red-900 dark:text-red-100">المرحلة الرابعة: الخسائر والمصروفات العامة (التحديات الإدارية)</h3>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70">تكلفة المرتجعات والمصروفات الإدارية الثابتة.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <ReportCard title="إجمالي خسائر المرتجعات" value={`${stats.totalLoss.toLocaleString('ar-EG')} ج.م`} icon={<ArrowDown size={24}/>} color="red" subValue="شحن مهدر (فشل/مرتجع)" tooltip="إجمالي الخسائر الناتجة عن مصاريف الشحن المهدرة للطلبات التي لم يتم تسليمها." />
                    <ReportCard title="إجمالي المصروفات الإدارية" value={`${stats.totalExpenses.toLocaleString('ar-EG')} ج.م`} icon={<DollarSign size={24}/>} color="amber" subValue="إعلانات، مرتبات، إلخ." tooltip="إجمالي المصروفات الإدارية المسجلة في المحفظة (مثل الإعلانات، الرواتب، الإيجار)." />
                </div>

                {/* Final Net Banner */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl text-white text-center shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <h3 className="text-lg font-bold opacity-80 relative z-10">صافي الربح النهائي</h3>
                    <p className="text-6xl font-black tracking-tighter mt-2 relative z-10">{stats.finalNet.toLocaleString('ar-EG')} ج.م</p>
                    <p className="text-xs opacity-70 mt-2 relative z-10">(إجمالي الأرباح - إجمالي الخسائر - إجمالي المصروفات والرسوم)</p>
                    <div className="mt-6 pt-6 border-t border-white/20 text-sm relative z-10">
                        نقطة التعادل: تحتاج إلى <span className="font-black underline text-yellow-300">{Math.ceil(stats.totalExpenses / (stats.totalProfit / stats.collectedOrdersCount || 1))}</span> أوردر ناجح إضافي لتغطية المصروفات الإدارية.
                    </div>
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 5: Analysis */}
            <div className="bg-emerald-50/30 dark:bg-emerald-900/5 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800/50">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">5</div>
                    <div>
                        <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-100">المرحلة الخامسة: تحليل الأداء والنمو (كيف نتحسن؟)</h3>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">مؤشرات الأداء وتحليل البيانات لاتخاذ قرارات أفضل.</p>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className={`p-6 rounded-2xl border-2 text-center relative group ${stats.successRate >= 70 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'}`} title="نسبة الطلبات التي تم تسليمها بنجاح من إجمالي الطلبات.">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center justify-center gap-1">نسبة نجاح التوصيل <span className="text-slate-300 cursor-help">ⓘ</span></h4>
                        <p className={`text-3xl font-black ${stats.successRate >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>{stats.successRate.toFixed(1)}%</p>
                        <p className="text-[10px] mt-1 text-slate-400">{stats.successRate < 70 ? 'تحتاج لتحسين الشحن/التأكيد' : 'أداء ممتاز'}</p>
                    </div>
                    <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center relative group" title="نسبة الخسائر (المرتجعات) مقارنة بإجمالي الأرباح التشغيلية. كلما قلت النسبة كان أفضل.">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center justify-center gap-1">نسبة الخسارة إلى الربح <span className="text-slate-300 cursor-help">ⓘ</span></h4>
                        <p className="text-3xl font-black text-red-600">{stats.lossRatio.toFixed(1)}%</p>
                        <p className="text-[10px] mt-1 text-slate-400">المرتجعات تلتهم هذه النسبة من أرباحك</p>
                    </div>
                    <div className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center relative group" title="متوسط الربح الصافي الذي تحققه من كل طلب (بما في ذلك الطلبات الفاشلة).">
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center justify-center gap-1">متوسط الربح للطلب <span className="text-slate-300 cursor-help">ⓘ</span></h4>
                        <p className="text-3xl font-black text-blue-600">{stats.avgProfitPerOrder.toLocaleString()} ج.م</p>
                        <p className="text-[10px] mt-1 text-slate-400">صافي الربح الفعلي لكل طلب</p>
                    </div>
                </div>

                {/* Wallet & Inventory */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                        <h4 className="font-bold text-emerald-800 dark:text-emerald-400 mb-1 flex items-center gap-2"><WalletIcon size={18}/> النقدية المحققة</h4>
                        <p className="text-2xl font-black text-emerald-600">{(stats.totalCogs + (stats.totalProfit - stats.totalLoss)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</p>
                        <p className="text-[10px] text-emerald-500 mt-1">تكلفة البضاعة المباعة + صافي الربح التشغيلي</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                        <h4 className="font-bold text-blue-800 dark:text-blue-400 mb-1 flex items-center gap-2"><Truck size={18}/> مستحقات الشحن</h4>
                        <p className="text-2xl font-black text-blue-600">{stats.pendingCollection.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</p>
                        <p className="text-[10px] text-blue-400 mt-1">مبالغ تم توصيلها ولم تُحصل بعد</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-200 dark:border-amber-800">
                        <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-2"><Package size={18}/> قيمة المخزون</h4>
                        <p className="text-2xl font-black text-amber-600">{stats.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</p>
                        <p className="text-[10px] text-amber-500 mt-1">قيمة البضاعة المتاحة في المخزن</p>
                    </div>
                </div>

                {/* NEW: Final Comprehensive Report Section */}
                <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden mt-8">
                    <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                        <FileText className="text-blue-400" /> التقرير الختامي الشامل
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-2">إجمالي المبيعات (كلي)</p>
                            <p className="text-2xl font-black">{(stats.totalProductRevenue + stats.totalExtraMarkup + stats.totalShippingRevenue).toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                        </div>
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-2">إجمالي تكلفة البضاعة (COGS)</p>
                            <p className="text-2xl font-black text-red-400">{stats.totalCogs.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                        </div>
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-2">إجمالي الخسائر (مرتجع)</p>
                            <p className="text-2xl font-black text-red-400">{stats.totalLoss.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                        </div>
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-2">إجمالي المصروفات الإدارية</p>
                            <p className="text-2xl font-black text-amber-400">{stats.totalExpenses.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                        </div>
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                            <p className="text-slate-400 text-xs font-bold uppercase mb-2">الصافي النهائي</p>
                            <p className="text-3xl font-black text-emerald-400">{stats.finalNet.toLocaleString('ar-EG')} <span className="text-base font-normal">ج.م</span></p>
                        </div>
                        
                        <div className="lg:col-span-3 border-t border-slate-700 pt-6 mt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <p className="text-slate-400 text-xs font-bold uppercase mb-4">قيمة البضاعة المتاحة (في المخازن)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                        <p className="text-slate-400 text-[10px]">بسعر الشراء</p>
                                        <p className="font-black">{stats.inventoryValue.toLocaleString('ar-EG')} ج.م</p>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                        <p className="text-slate-400 text-[10px]">بسعر البيع</p>
                                        <p className="font-black text-emerald-300">{stats.inventorySalesValue.toLocaleString('ar-EG')} ج.م</p>
                                    </div>
                                </div>
                             </div>
                             <div>
                                <p className="text-slate-400 text-xs font-bold uppercase mb-4">أرصدة وعهدة الشركاء</p>
                                <div className="space-y-2">
                                    {stats.partnerPerformance.map(p => (
                                        <div key={p.id} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg text-sm">
                                            <span className="font-bold">{p.name}</span>
                                            <span className={`${p.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'} font-black tabular-nums`}>
                                                {p.currentBalance.toLocaleString('ar-EG')} ج.م
                                            </span>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-center py-2">
                <ArrowDown className="text-slate-300 animate-bounce" size={24} />
            </div>

            {/* Stage 6: Partners */}
            <div className="bg-indigo-50/30 dark:bg-indigo-900/5 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/50">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black shadow-lg">6</div>
                    <div>
                        <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-100">المرحلة السادسة: إدارة الشركاء وتوزيع الأرباح (من يملك ماذا؟)</h3>
                        <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">متابعة رؤوس الأموال، السلف، ونسبة كل شريك من الأرباح المحققة.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <ReportCard title="إجمالي رأس المال" value={`${stats.totalCapital.toLocaleString('ar-EG')} ج.م`} icon={<DollarSign size={24}/>} color="blue" subValue="رؤوس الأموال المودعة" tooltip="إجمالي المبالغ التي ساهم بها الشركاء كرأس مال للمشروع." />
                    <ReportCard title="إجمالي السلف" value={`${stats.totalLoans.toLocaleString('ar-EG')} ج.م`} icon={<ArrowUp size={24}/>} color="red" subValue="مبالغ مسحوبة كسلف" tooltip="إجمالي المبالغ التي سحبها الشركاء كسلف أو قروض من المشروع." />
                    <ReportCard title="إجمالي العرابين" value={`${(stats.totalAdvances || 0).toLocaleString('ar-EG')} ج.م`} icon={<Coins size={24}/>} color="teal" subValue="العرابين المحصلة للشركاء" tooltip="إجمالي مبالغ العربون المستلمة والمودعة لدى الشركاء كعهد مبيعات." />
                    <ReportCard title="أرباح تحت التوزيع" value={`${stats.finalNet.toLocaleString('ar-EG')} ج.م`} icon={<TrendingUp size={24}/>} color="emerald" subValue="صافي ربح الفترة الحالية" tooltip="صافي الأرباح المحققة في هذه الفترة والجاهزة للتوزيع حسب النسب." />
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                             موقف الشركاء الحالي
                        </h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">الشريك</th>
                                    <th className="px-4 py-3">النسبة</th>
                                    <th className="px-4 py-3">المساهمة</th>
                                    <th className="px-4 py-3">الربح المستحق</th>
                                    <th className="px-4 py-3">صافي السلف</th>
                                    <th className="px-4 py-3">العرابين المستلمة</th>
                                    <th className="px-4 py-3">الرصيد التراكمي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stats.partnerPerformance.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">لا يوجد شركاء مسجلين.</td></tr>
                                ) : (
                                    stats.partnerPerformance.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{p.name}</td>
                                            <td className="px-4 py-3"><span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">{p.profitRatio}%</span></td>
                                            <td className="px-4 py-3 font-mono">{p.capitalContribution.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                                            <td className="px-4 py-3 font-mono text-emerald-600">+{p.currentProfitShare.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                                            <td className="px-4 py-3 font-mono text-red-600">-{p.netLoan.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                                            <td className="px-4 py-3 font-mono text-teal-600">-{p.advances ? p.advances.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : '0'}</td>
                                            <td className={`px-4 py-3 font-black ${p.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {p.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 6. Unified Financial Statement */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <FileText className="text-blue-500"/> القائمة المالية الموحدة (Unified Financial Statement)
                </h3>
                
                <div className="text-sm text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6 border-r-4 border-blue-500">
                    <strong>شرح توضيحي:</strong> هذه القائمة توضح حركة الأموال بالتفصيل. تبدأ بـ <b>الإيرادات</b> (كل ما تم تحصيله)، ثم نخصم منها <b>تكلفة المبيعات</b> (ثمن البضاعة ومصاريف الشحن) لنصل إلى <b>الربح التشغيلي</b> (أرباحك الصافية من الطلبات الناجحة). أخيراً نخصم <b>الخسائر والمصروفات والرسوم</b> لنصل إلى <b>صافي الربح النهائي</b>.
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <tbody>
                            <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" colSpan={2} title="إجمالي الأموال التي دخلت إلى النظام من الطلبات الناجحة.">1. الإيرادات (Revenues)</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي قيمة المنتجات المباعة بالسعر الأساسي.">إجمالي مبيعات المنتجات (بالسعر الأساسي)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold">+{stats.totalProductRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="الفروقات الإيجابية الناتجة عن تعلية السعر وتجاوز رسوم الشحن المدخلة بالطلب.">(+) إيرادات الزيادة في السعر وفرق الشحن</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold">+{stats.totalExtraMarkup.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي رسوم الشحن التي دفعها العملاء.">إجمالي تحصيل الشحن من العملاء</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold">+{stats.totalShippingRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</td>
                            </tr>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" title="مجموع الإيرادات بالكامل.">(=) إجمالي الإيرادات (Total Revenue)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700">{(stats.totalProductRevenue + stats.totalExtraMarkup + stats.totalShippingRevenue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</td>
                            </tr>

                            <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" colSpan={2} title="التكاليف المباشرة المرتبطة بالطلبات الناجحة.">2. تكلفة المبيعات (Cost of Goods Sold)</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي التكلفة الأصلية للمنتجات (سعر الجملة).">(-) إجمالي مستحقات الموردين (ثمن البضاعة)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${stats.totalCogs.toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="مصاريف الشحن المدفوعة لشركات الشحن للطلبات الناجحة.">(-) إجمالي مصاريف شحن الذهاب (لشركات الشحن)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${stats.totalActualShipping.toLocaleString()} ج.م</td>
                            </tr>

                            <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" colSpan={2} title="الربح المتبقي بعد خصم تكلفة المبيعات من الإيرادات.">3. إجمالي الربح التشغيلي (Gross Profit)</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8 text-sm text-slate-500" title="الربح الأساسي من نظام العمولة.">تفصيل الربح: ربح العمولة</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold text-sm">+{(stats.totalCommissionProfit - stats.totalProductExtraMarkup).toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8 text-sm text-slate-500" title="الأثر المالي لتجاوز سعر الشحن الفعلي بناءً على الشحن المدخل بالطلب.">تفصيل الربح: الزيادة في السعر وفرق الشحن</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold text-sm">+{stats.totalExtraMarkup.toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8 text-sm text-slate-500" title="الربح من نظام المبيعات (النسبة المئوية).">تفصيل الربح: ربح المبيعات</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-emerald-600 font-bold text-sm">+{stats.totalPercentageProfit.toLocaleString()} ج.م</td>
                            </tr>
                            <tr className="bg-blue-100 dark:bg-blue-900/40 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" title="مجموع الأرباح التشغيلية.">(=) إجمالي الربح التشغيلي</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-300">{(stats.totalCommissionProfit + stats.totalPercentageProfit + stats.totalShippingMarkup).toLocaleString()} ج.م</td>
                            </tr>

                            <tr className="bg-red-50 dark:bg-red-900/20 font-bold">
                                <td className="p-3 border border-slate-200 dark:border-slate-700" colSpan={2} title="الخسائر والمصروفات الإدارية.">4. الخسائر والمصروفات (Losses & Expenses)</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="مجموع رسوم التأمين والمعاينة والدفع عند الاستلام المخصومة من الطلبات الناجحة.">(-) إجمالي رسوم التأمين والمعاينة والتحصيل (للطلبات الناجحة)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${(stats.totalInsuranceFees + stats.totalInspectionFees + stats.totalCodFees).toLocaleString(undefined, {maximumFractionDigits: 2})} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي مصاريف الشحن المهدرة على الطلبات الفاشلة والمرتجعة.">(-) إجمالي خسائر المرتجعات والفشل</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${stats.totalLoss.toLocaleString()} ج.م</td>
                            </tr>
                            <tr>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 pr-8" title="إجمالي المصروفات الإدارية المسجلة في المحفظة.">(-) إجمالي المصروفات الإدارية (إعلانات، رواتب...)</td>
                                <td className="p-3 border border-slate-200 dark:border-slate-700 text-red-600 font-bold">-${stats.totalExpenses.toLocaleString()} ج.م</td>
                            </tr>

                            <tr className="bg-indigo-600 text-white font-black text-lg">
                                <td className="p-4 border border-indigo-700" title="الربح النهائي بعد خصم جميع التكاليف والخسائر والمصروفات.">(=) صافي الربح النهائي (Net Profit)</td>
                                <td className="p-4 border border-indigo-700">{stats.finalNet.toLocaleString()} ج.م</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 7. Charts & Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2"><MapPin className="text-blue-500"/> تحليل المناطق (الأكثر ربحية)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.geoData.slice(0, 8)} margin={{ top: 20 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', direction: 'rtl' }} />
                                <Bar dataKey="revenue" name="الإيرادات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="net" name="صافي الربح" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-xs text-right">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-2" title="اسم المحافظة أو المنطقة.">المنطقة</th>
                                    <th className="pb-2" title="نسبة الطلبات الناجحة في هذه المنطقة.">النجاح</th>
                                    <th className="pb-2" title="إجمالي الإيرادات المحصلة من هذه المنطقة.">الإيرادات</th>
                                    <th className="pb-2" title="صافي الربح بعد خصم الخسائر في هذه المنطقة.">الصافي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.geoData.slice(0, 5).map(g => (
                                    <tr key={g.name} className="border-b border-slate-50 dark:border-slate-800/50">
                                        <td className="py-2 font-bold">{g.name}</td>
                                        <td className="py-2">{g.successRate.toFixed(1)}%</td>
                                        <td className="py-2">{g.revenue.toLocaleString()}</td>
                                        <td className={`py-2 font-bold ${g.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{g.net.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2"><DollarSign className="text-amber-500"/> توزيع المصروفات الإدارية</h3>
                    <div className="h-64 flex items-center justify-center">
                        {stats.expenseCategories.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.expenseCategories} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {stats.expenseCategories.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-slate-400 text-sm">لا توجد مصروفات مسجلة حالياً</div>
                        )}
                    </div>
                    <div className="mt-4 space-y-2">
                        {stats.expenseCategories.map(cat => (
                            <div key={cat.name} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                    <span className="text-slate-600 dark:text-slate-400">{cat.name}</span>
                                </div>
                                <span className="font-bold">{cat.value.toLocaleString()} ج.م</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">أداء شركات الشحن</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-2" title="اسم شركة الشحن.">الشركة</th>
                                    <th className="pb-2" title="إجمالي عدد الطلبات المسندة للشركة.">الطلبات</th>
                                    <th className="pb-2" title="نسبة الطلبات التي تم تسليمها بنجاح.">النجاح</th>
                                    <th className="pb-2" title="صافي الربح المحقق من الطلبات المشحونة عبر هذه الشركة.">الربح</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(stats.carrierStats).map(([name, s]) => (
                                    <tr key={name} className="border-b border-slate-50 dark:border-slate-800/50">
                                        <td className="py-3 font-bold">{name}</td>
                                        <td className="py-3">{s.count}</td>
                                        <td className="py-3">{(s.success / s.count * 100).toFixed(1)}%</td>
                                        <td className={`py-3 font-bold ${s.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{s.profit.toLocaleString()} ج.م</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold mb-4 text-slate-800 dark:text-white">تحليل ربحية المنتجات</h3>
                    <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg mb-4 border-r-2 border-slate-300">
                        يوضح هذا الجدول أداء كل منتج على حدة. الكمية المباعة (للطلبات الناجحة)، الكمية المرتجعة (للطلبات الفاشلة والمرتجعة)، وإجمالي الربح الصافي من هذا المنتج.
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-2" title="اسم المنتج.">المنتج</th>
                                    <th className="pb-2" title="إجمالي الكمية المباعة (في الطلبات الناجحة).">المباع</th>
                                    <th className="pb-2" title="إجمالي الكمية المرتجعة (في الطلبات الفاشلة).">المرتجع</th>
                                    <th className="pb-2" title="صافي الربح المحقق من هذا المنتج.">الربح</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(stats.productStats).map(([name, s]) => {
                                    const isMultiProfit = s.extra > 0;
                                    return (
                                        <tr key={name} className={`border-b border-slate-50 dark:border-slate-800/50 ${isMultiProfit ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                            <td className="py-3 font-bold">
                                                {name}
                                                {isMultiProfit && <span className="block text-[8px] text-blue-500 font-normal">ربح مركب (أساسي + زيادة)</span>}
                                            </td>
                                            <td className="py-3">{s.sold}</td>
                                            <td className="py-3">{s.returns}</td>
                                            <td className="py-3 font-bold text-emerald-600">{(s.revenue - s.cost + s.extra).toLocaleString()} ج.م</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 8. Detailed Orders (Successful) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="text-emerald-500"/> تفاصيل الأرباح (الطلبات الناجحة)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="رقم الطلب التعريفي.">رقم الطلب</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="اسم العميل.">العميل</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="المنتجات التي تم بيعها في هذا الطلب.">المنتجات</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="سعر البيع الإجمالي للطلب.">سعر البيع</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800" title="صافي الربح المحقق من هذا الطلب بعد خصم التكاليف.">صافي الربح</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.filter(o => o.status === 'تم_التحصيل' || o.status === 'مدفوعة').length > 0 ? (
                                orders.filter(o => o.status === 'تم_التحصيل' || o.status === 'مدفوعة').map(order => {
                                    const { profit } = calculateOrderProfitLoss(order, settings);
                                    let orderExtraMarkup = 0;
                                    order.items.forEach(item => {
                                        const product = settings.products.find(p => p.id === item.productId || p.variants?.some(v => v.id === item.productId));
                                        if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                                            orderExtraMarkup += Math.max(0, (item.price - product.basePrice) * item.quantity);
                                        }
                                    });
                                    const isMultiProfit = orderExtraMarkup > 0;
                                    return (
                                        <tr key={order.id} className={`border-b border-slate-50 dark:border-slate-800/50 ${isMultiProfit ? 'bg-blue-50/50 dark:bg-blue-900/10 border-r-4 border-r-blue-500' : ''}`}>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold">{order.orderNumber}</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">{order.customerName}</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                                                {order.items.map((item, idx) => {
                                                    const p = settings.products.find(prod => prod.id === item.productId || prod.variants?.some(v => v.id === item.productId));
                                                    const isItemMulti = p?.profitMode === 'commission' && p.basePrice !== undefined && item.price > p.basePrice;
                                                    return (
                                                        <div key={`${order.id}-${item.productId}-${idx}`} className="mb-1">
                                                            {item.name} ({item.quantity})
                                                            {isItemMulti && <span className="block text-[8px] text-blue-500 font-normal">ربح مركب (أساسي + زيادة)</span>}
                                                        </div>
                                                    );
                                                })}
                                            </td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">{order.productPrice.toLocaleString()} ج.م</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold text-emerald-600">{profit.toLocaleString()} ج.م</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد طلبات ناجحة حالياً</td>
                                </tr>
                            )}
                        </tbody>
                        {orders.filter(o => o.status === 'تم_التحصيل' || o.status === 'مدفوعة').length > 0 && (
                            <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-black text-slate-900 dark:text-white">
                                <tr>
                                    <td colSpan={3} className="p-2 border border-slate-100 dark:border-slate-800 text-left">الإجمالي:</td>
                                    <td className="p-2 border border-slate-100 dark:border-slate-800">{(stats.totalProductRevenue + stats.totalExtraMarkup).toLocaleString()} ج.م</td>
                                    <td className="p-2 border border-slate-100 dark:border-slate-800 text-emerald-600">{stats.totalProfit.toLocaleString()} ج.م</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* 9. Detailed Orders (Failed) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-red-500"/> تفاصيل الخسائر (الطلبات الفاشلة)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                <th className="p-2 border border-slate-100 dark:border-slate-800">رقم الطلب</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800">العميل</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800">المنتجات</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800">الحالة</th>
                                <th className="p-2 border border-slate-100 dark:border-slate-800">الخسارة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)).length > 0 ? (
                                orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)).map(order => {
                                    const { loss } = calculateOrderProfitLoss(order, settings);
                                    return (
                                        <tr key={order.id} className="border-b border-slate-50 dark:border-slate-800/50">
                                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold">{order.orderNumber}</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">{order.customerName}</td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                                                {order.items.map((item, idx) => (
                                                    <div key={`${order.id}-${item.productId}-${idx}`} className="mb-1">
                                                        {item.name} ({item.quantity})
                                                    </div>
                                                ))}
                                            </td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800">
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full text-[10px]">
                                                    {order.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="p-2 border border-slate-100 dark:border-slate-800 font-bold text-red-600">-{loss.toLocaleString()} ج.م</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد طلبات فاشلة حالياً</td>
                                </tr>
                            )}
                        </tbody>
                        {orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)).length > 0 && (
                            <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-black text-slate-900 dark:text-white">
                                <tr>
                                    <td colSpan={4} className="p-2 border border-slate-100 dark:border-slate-800 text-left">الإجمالي:</td>
                                    <td className="p-2 border border-slate-100 dark:border-slate-800 text-red-600">-{stats.totalLoss.toLocaleString()} ج.م</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {previewHtml && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                    <div className="bg-slate-200 dark:bg-slate-800 w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-300 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-t-2xl">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileText className="text-blue-500" />
                                معاينة التقرير الختامي الشامل
                            </h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleActualExportPDF} 
                                    disabled={isExporting}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
                                >
                                    {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>}
                                    <span className="hidden sm:inline">{isExporting ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                                </button>
                                <button onClick={handleActualPrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all">
                                    <Printer size={16}/> <span className="hidden sm:inline">طباعة التقرير</span>
                                </button>
                                <button onClick={() => setPreviewHtml(null)} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-xl transition-colors mr-2">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-800/50 flex align-top justify-center">
                            <div className="bg-white rounded-xl shadow-lg w-full overflow-hidden h-fit min-h-full" style={{ maxWidth: orientation === 'landscape' ? '1122.5px' : '793px' }}>
                                <iframe srcDoc={previewHtml} className="w-full h-[800px] border-0" title="Report Preview" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PartnersFinancialReport: React.FC<ReportsPageProps> = ({ orders, settings, wallet, activeStore, dateRangeText }) => {
    const { storeId } = useParams<{ storeId: string }>();
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [isContinuous, setIsContinuous] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const transactions = useMemo(() => settings.partnerTransactions || [], [settings.partnerTransactions]);
    const partners = useMemo(() => settings.partners || [], [settings.partners]);

    const stats = useMemo(() => {
        let grossMargin = 0;
        let operationalFees = 0;
        let returnsLosses = 0;

        orders.forEach(order => {
            const { profit, loss } = calculateOrderProfitLoss(order, settings);
            if (order.status === 'تم_التحصيل' || order.status === 'مدفوعة') {
                const totalItemsRevenue = (order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const totalItemsCost = (order.items || []).reduce((sum, item) => sum + (item.cost * item.quantity), 0);
                grossMargin += (totalItemsRevenue - totalItemsCost);
                operationalFees += (totalItemsRevenue - totalItemsCost) - profit;
            } else if (['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام'].includes(order.status)) {
                returnsLosses += loss;
            }
        });

        const adminExpenses = (wallet?.transactions || [])
            .filter(t => {
                const isExpenseCategory = t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_') || (settings.expenseCategories || []).includes(t.category || '');
                const isManualWithdrawal = t.category === 'manual_withdrawal';
                const isNotPartnerTx = !t.note?.includes('معاملة شريك');
                return t.type === 'سحب' && (isExpenseCategory || isManualWithdrawal) && isNotPartnerTx;
            })
            .reduce((sum, t) => sum + t.amount, 0);

        const totalOperationalExpenses = operationalFees + returnsLosses + adminExpenses;
        const allTimeNetProfit = grossMargin - totalOperationalExpenses;

        const distributed = transactions
            .filter(t => t.type === 'profit_distribution')
            .reduce((sum, t) => sum + t.amount, 0);

        const undistributedProfit = Math.max(0, allTimeNetProfit - distributed);

        const totals = {
            capital: transactions.filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage').reduce((a, b) => a + b.amount, 0),
            loans: transactions.filter(t => t.type === 'loan').reduce((a, b) => a + b.amount, 0),
            advances: transactions.filter(t => t.type === 'customer_advance').reduce((a, b) => a + b.amount, 0),
            repayments: transactions.filter(t => t.type === 'repayment').reduce((a, b) => a + b.amount, 0),
            withdrawals: distributed
        };

        return {
            allTimeNetProfit,
            undistributedProfit,
            distributedProfit: distributed,
            totals,
            grossMargin,
            totalOperationalExpenses,
            partnerDetails: partners.map(p => {
                const pTx = transactions.filter(t => t.partnerId === p.id);
                const capital = pTx.filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage').reduce((a, b) => a + b.amount, 0);
                const loans = pTx.filter(t => t.type === 'loan').reduce((a, b) => a + b.amount, 0);
                const advances = pTx.filter(t => t.type === 'customer_advance').reduce((a, b) => a + b.amount, 0);
                const repayments = pTx.filter(t => t.type === 'repayment').reduce((a, b) => a + b.amount, 0);
                const withdrawals = pTx.filter(t => t.type === 'profit_withdrawal').reduce((a, b) => a + b.amount, 0);
                const distributions = pTx.filter(t => t.type === 'profit_distribution').reduce((a, b) => a + b.amount, 0);
                const profitShare = undistributedProfit * (p.profitRatio / 100);
                const supplyFunding = pTx.filter(t => t.type === 'supply_funding').reduce((a, b) => a + b.amount, 0);
                const balance = p.balance; // Use the actual partner balance 
                
                return {
                    ...p,
                    capital,
                    loans,
                    advances,
                    repayments,
                    withdrawals,
                    distributions,
                    balance
                };
            })
        };
    }, [orders, settings, wallet, transactions, partners]);

    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    const handlePreview = () => {
        const html = generatePartnersFinancialReportHTML(stats, activeStore?.name || 'المتجر', orientation, isContinuous, dateRangeText);
        setPreviewHtml(html);
    };

    const handleActualPrint = () => {
        if (!previewHtml) return;
        printHTMLDirectly(previewHtml);
    };

    const handleActualExportPDF = async () => {
        if (!previewHtml) return;
        setIsExporting(true);
        try {
            await exportHTMLToPDF(previewHtml, orientation, `تقرير_الشركاء_والمركز_المالي_${new Date().toISOString().split('T')[0]}.pdf`, isContinuous);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert('حدث خطأ أثناء تصدير PDF. قد تحتاج لتجربة الطباعة وحفظ كملف PDF.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-700 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="text-indigo-500" /> تقرير الشركاء والمركز المالي
                </h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setIsContinuous(false)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            صفحات
                        </button>
                        <button 
                            onClick={() => setIsContinuous(true)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            متصل
                        </button>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={() => setOrientation('portrait')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'portrait' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            طولي
                        </button>
                        <button 
                            onClick={() => setOrientation('landscape')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'landscape' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            عرضي
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handlePreview} 
                            disabled={isExporting}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                        >
                            <Eye size={18}/>
                            معاينة التقرير للطباعة والتصدير
                        </button>
                    </div>
                </div>
            </div>

            <div className="text-left bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 sm:py-2 rounded-xl border border-indigo-100 dark:border-indigo-800 self-start sm:self-auto w-full sm:w-auto inline-block">
                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">إجمالي الربح التاريخي</p>
                <p className="text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-300">{stats.allTimeNetProfit.toLocaleString('ar-EG')} ج.م</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                <ReportCard title="إجمالي رأس المال" value={`${stats.totals.capital.toLocaleString()} ج.م`} icon={<ArrowUpLeft size={24}/>} color="blue" tooltip="مجموع رؤوس الأموال التي تم إيداعها من قبل جميع الشركاء." />
                <ReportCard title="الأرباح الموزعة" value={`${stats.distributedProfit.toLocaleString()} ج.م`} icon={<TrendingUp size={24}/>} color="emerald" tooltip="إجمالي الأرباح التي تم سحبها بالفعل من قبل الشركاء." />
                <ReportCard title="الأرباح غير الموزعة" value={`${stats.undistributedProfit.toLocaleString()} ج.م`} icon={<PieChartIcon size={24}/>} color="amber" tooltip="الأرباح المحققة التي لم يتم توزيعها على الشركاء بعد." />
                <ReportCard title="إجمالي السلف القائمة" value={`${(stats.totals.loans - stats.totals.repayments).toLocaleString()} ج.م`} icon={<ArrowDownRight size={24}/>} color="red" tooltip="إجمالي مديونات الشركاء (السلف التي لم يتم سدادها بعد)." />
                <ReportCard title="إجمالي العربونات المستلمة" value={`${stats.totals.advances.toLocaleString()} ج.م`} icon={<Coins size={24}/>} color="teal" tooltip="إجمالي عربونات العملاء التي تم استلامها ومقودها لدى الشركاء كعهدة مبيعات." />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-8">
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">تفاصيل المركز المالي لكل شريك</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs sm:text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3">الشريك</th>
                                <th className="px-4 py-3">النسبة</th>
                                <th className="px-4 py-3">رأس المال</th>
                                <th className="px-4 py-3">أرباح حصل عليها</th>
                                <th className="px-4 py-3">سحوبات شخصية</th>
                                <th className="px-4 py-3">السلف القائمة</th>
                                <th className="px-4 py-3">العربونات المستلمة</th>
                                <th className="px-4 py-3">الرصيد الكلي</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {stats.partnerDetails.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-12 text-slate-400 font-medium">لا يوجد شركاء مسجلين حالياً.</td></tr>
                            ) : (
                                stats.partnerDetails.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                                            <Link to={`/store/${storeId}/partners/${p.id}`} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors">
                                                {p.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3"><span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">{p.profitRatio}%</span></td>
                                        <td className="px-4 py-3 font-mono">{p.capital.toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-emerald-600">+{p.distributions.toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-amber-600">-{p.withdrawals.toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-red-600">{(p.loans - p.repayments).toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-teal-600">-{p.advances ? p.advances.toLocaleString() : '0'}</td>
                                        <td className={`px-4 py-3 font-black ${p.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {p.balance.toLocaleString()} ج.م
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><ArrowUpLeft className="text-blue-500"/> تحليل حصص الشركاء</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={stats.partnerDetails.map(p => ({ name: p.name, value: p.profitRatio }))} 
                                    innerRadius={60} 
                                    outerRadius={80} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                >
                                    {stats.partnerDetails.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><ArrowDownRight className="text-red-500"/> سلف الشركاء المسددة وغير المسددة</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.partnerDetails}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip contentStyle={{ borderRadius: '12px' }} />
                                <Bar dataKey="loans" name="إجمالي السلف" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="repayments" name="المسدد منها" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {previewHtml && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                    <div className="bg-slate-200 dark:bg-slate-800 w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-300 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-t-2xl">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileText className="text-indigo-500" />
                                معاينة تقرير الشركاء
                            </h3>
                            <div className="flex items-center gap-2">
                                 <button 
                                    onClick={handleActualExportPDF} 
                                    disabled={isExporting}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
                                >
                                    {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>}
                                    <span className="hidden sm:inline">{isExporting ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                                </button>
                                <button onClick={handleActualPrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all">
                                    <Printer size={16}/> <span className="hidden sm:inline">طباعة التقرير</span>
                                </button>
                                <button onClick={() => setPreviewHtml(null)} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-xl transition-colors mr-2">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-800/50 flex align-top justify-center">
                            <div className="bg-white rounded-xl shadow-lg w-full overflow-hidden h-fit min-h-full" style={{ maxWidth: orientation === 'landscape' ? '1122.5px' : '793px' }}>
                                <iframe srcDoc={previewHtml} className="w-full h-[800px] border-0" title="Report Preview" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const InventoryReport: React.FC<{ activeStore?: Store; settings: Settings; dateRangeText?: string }> = ({ activeStore, settings, dateRangeText }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [isContinuous, setIsContinuous] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    const products = settings?.products || [];
    const suppliers = settings?.suppliers || [];
    const supplyOrders = settings?.supplyOrders || [];

    const stats = useMemo(() => {
        let totalInventoryValue = 0;
        let totalPurchasesValue = 0;
        let totalOrdersCount = supplyOrders.length;

        const productHistory: Record<string, {
            name: string;
            purchaseCount: number;
            totalPurchasedQuantity: number;
            lastPurchaseDate: string | null;
            suppliers: Set<string>;
            currentStock: number;
            stockValue: number;
        }> = {};

        // Compute product purchase history AND inventory value
        products.forEach(p => {
            let currentStock = 0;
            let stockValue = 0;
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    currentStock += (v.stockQuantity || 0);
                    // Use getLatestProductCost, fallback to variant costPrice or product costPrice
                    const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
                    const vStockValue = (v.stockQuantity || 0) * cost;
                    stockValue += vStockValue;
                    totalInventoryValue += vStockValue;
                });
            } else {
                currentStock = p.stockQuantity || 0;
                const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
                stockValue = currentStock * cost;
                totalInventoryValue += stockValue;
            }

            productHistory[p.id] = {
                name: p.name,
                purchaseCount: 0,
                totalPurchasedQuantity: 0,
                lastPurchaseDate: null,
                suppliers: new Set(),
                currentStock,
                stockValue
            };
        });

        // Calculate total purchases value
        supplyOrders.forEach(o => {
            if (o.status !== 'cancelled') {
                totalPurchasesValue += o.totalCost;
            }
            
            const supplierName = suppliers.find(s => s.id === o.supplierId)?.name || 'غير معروف';

            o.items.forEach(item => {
                // Find matching product by ID. Product ID could be the main product ID, or a variant ID.
                let matchingProductId = item.productId;
                if (!productHistory[matchingProductId]) {
                    // Try to find if this is a variant ID
                    const parentProduct = products.find(p => p.variants?.some(v => v.id === item.productId));
                    if (parentProduct && productHistory[parentProduct.id]) {
                        matchingProductId = parentProduct.id;
                    }
                }

                if (productHistory[matchingProductId]) {
                    productHistory[matchingProductId].purchaseCount += 1;
                    productHistory[matchingProductId].totalPurchasedQuantity += item.quantity;
                    productHistory[matchingProductId].suppliers.add(supplierName);
                    
                    if (!productHistory[matchingProductId].lastPurchaseDate || new Date(o.date) > new Date(productHistory[matchingProductId].lastPurchaseDate as string)) {
                        productHistory[matchingProductId].lastPurchaseDate = o.date;
                    }
                }
            });
        });

        const sortedProductHistory = Object.values(productHistory).sort((a, b) => b.stockValue - a.stockValue);
        const sortedSupplyOrders = [...supplyOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(o => ({
            ...o,
            supplierName: suppliers.find(s => s.id === o.supplierId)?.name || 'غير معروف'
        }));

        return {
            totalInventoryValue,
            totalPurchasesValue,
            totalOrdersCount,
            productHistory: sortedProductHistory,
            supplyOrders: sortedSupplyOrders
        };
    }, [products, suppliers, supplyOrders, settings]);

    const handlePreview = () => {
        const html = generatePurchasesAndInventoryReportHTML(stats, activeStore?.name || 'متجري', orientation, isContinuous, dateRangeText);
        setPreviewHtml(html);
    };

    const handleActualExportPDF = async () => {
        if (!previewHtml) return;
        setIsExporting(true);

        try {
            await exportHTMLToPDF(previewHtml, orientation, `تقرير_المشتريات_والمخزون_${new Date().toISOString().split('T')[0]}.pdf`, isContinuous);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('حدث خطأ أثناء تصدير PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const handleActualPrint = () => {
        if (!previewHtml) return;
        printHTMLDirectly(previewHtml);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-6 mb-8 animate-in fade-in-5 duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 sm:mb-8 gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 sm:pb-6">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Package className="text-emerald-500" /> تقرير المشتريات والمخزون
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handlePreview} 
                            disabled={isExporting}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50"
                        >
                            <Eye size={18}/>
                            معاينة التقرير للطباعة والتصدير
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
                <ReportCard title="إجمالي قيمة المخزون (رأس المال)" value={`${stats.totalInventoryValue.toLocaleString('ar-EG')} ج.م`} icon={<Package size={24}/>} color="emerald" tooltip="إجمالي قيمة المخزون الحالي بناءً على تكلفة المنتجات." />
                <ReportCard title="إجمالي المشتريات التاريخية" value={`${stats.totalPurchasesValue.toLocaleString('ar-EG')} ج.م`} icon={<TrendingUp size={24}/>} color="blue" tooltip="إجمالي قيمة فواتير الشراء التي تم تسجيلها." />
                <ReportCard title="عدد مرات الشراء (الفواتير)" value={`${stats.totalOrdersCount} طلب`} icon={<FileText size={24}/>} color="amber" />
            </div>

            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">حركة المنتجات والمخزون الحالي</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">المنتج</th>
                                    <th className="px-4 py-3 font-semibold">المخزون المتوفر</th>
                                    <th className="px-4 py-3 font-semibold">قيمة المخزون</th>
                                    <th className="px-4 py-3 font-semibold">مرات الشراء</th>
                                    <th className="px-4 py-3 font-semibold">تاريخ آخر شراء</th>
                                    <th className="px-4 py-3 font-semibold">الموردين</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                {stats.productHistory.slice(0, 10).map((p: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{p.name}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            {p.currentStock > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold">
                                                    {p.currentStock}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold">
                                                    نفذ
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-800 dark:text-white font-mono">{p.stockValue.toLocaleString('ar-EG')} ج.م</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.purchaseCount}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hover:text-slate-800">
                                            {p.lastPurchaseDate ? new Date(p.lastPurchaseDate).toLocaleDateString('ar-EG') : 'لم يشترى'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">
                                            {Array.from(p.suppliers).join('، ') || 'لا يوجد'}
                                        </td>
                                    </tr>
                                ))}
                                {stats.productHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">لا توجد منتجات مسجلة</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">أحدث طلبات التوريد</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">رقم المرجع / الفاتورة</th>
                                    <th className="px-4 py-3 font-semibold">التاريخ</th>
                                    <th className="px-4 py-3 font-semibold">المورد</th>
                                    <th className="px-4 py-3 font-semibold">القيمة الإجمالية</th>
                                    <th className="px-4 py-3 font-semibold">عدد الأصناف</th>
                                    <th className="px-4 py-3 font-semibold">طريقة الدفع</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                {stats.supplyOrders.slice(0, 10).map((o: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 font-bold">{o.referenceNumber || o.orderNumber || o.id.slice(-6).toUpperCase()}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(o.date).toLocaleDateString('ar-EG')}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{o.supplierName}</td>
                                        <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{o.totalCost.toLocaleString('ar-EG')} ج.م</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                            <div className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold">{(o.items || []).reduce((sum: number, item: any) => sum + item.quantity, 0)}</div>
                                            منتج
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">{o.paymentMethod === 'cash' ? 'نقدي' : o.paymentMethod === 'credit' ? 'آجل' : 'غير محدد'}</td>
                                    </tr>
                                ))}
                                {stats.supplyOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">لا توجد طلبات توريد</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {previewHtml && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                    <div className="bg-slate-200 dark:bg-slate-800 w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-300 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-t-2xl">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileText className="text-emerald-500" />
                                معاينة تقرير المشتريات والمخزون
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <button 
                                        onClick={() => setIsContinuous(false)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        صفحات
                                    </button>
                                    <button 
                                        onClick={() => setIsContinuous(true)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        متصل
                                    </button>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <button 
                                        onClick={() => setOrientation('portrait')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'portrait' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        طولي
                                    </button>
                                    <button 
                                        onClick={() => setOrientation('landscape')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${orientation === 'landscape' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        عرضي
                                    </button>
                                </div>
                                 <button 
                                    onClick={handleActualExportPDF} 
                                    disabled={isExporting}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
                                >
                                    {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>}
                                    <span className="hidden sm:inline">{isExporting ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                                </button>
                                <button onClick={handleActualPrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all">
                                    <Printer size={16}/> <span className="hidden sm:inline">طباعة</span>
                                </button>
                                <button onClick={() => setPreviewHtml(null)} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-xl transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-800/50 flex align-top justify-center">
                            <div className="bg-white rounded-xl shadow-lg w-full overflow-hidden h-fit min-h-full" style={{ maxWidth: orientation === 'landscape' ? '1122.5px' : '793px' }}>
                                <iframe srcDoc={previewHtml} className="w-full h-[800px] border-0" title="Report Preview" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const FinalReport: React.FC<ReportsPageProps> = ({ orders, settings, wallet, activeStore }) => {
    const stats = useMemo(() => {
        const collectedOrders = orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status));
        const failedOrders = orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status));

        let totalProductRevenue = 0;
        let totalExtraMarkup = 0;
        let totalShippingRevenue = 0;
        let totalCogs = 0;
        let totalProfit = 0;

        collectedOrders.forEach(order => {
            const { profit } = calculateOrderProfitLoss(order, settings);
            totalProductRevenue += (order.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
            totalShippingRevenue += order.shippingFee;
            totalCogs += (order.items || []).reduce((sum, item) => {
                const actualCost = getLatestProductCost(item.productId, settings) || item.cost || 0;
                return sum + (actualCost * item.quantity);
            }, 0);
            totalProfit += profit;
            
            (order.items || []).forEach(item => {
                const product = settings.products.find(p => p.id === item.productId || p.variants?.some(v => v.id === item.productId));
                if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                    totalExtraMarkup += (item.price - product.basePrice) * item.quantity;
                }
            });
        });

        let totalLoss = 0;
        failedOrders.forEach(order => {
            const { loss } = calculateOrderProfitLoss(order, settings);
            totalLoss += loss;
        });

        const totalExpenses = (wallet?.transactions || []).filter(t => t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_')).reduce((sum, t) => sum + t.amount, 0);
        const finalNet = totalProfit - totalLoss - totalExpenses;

        const inventoryValue = (settings?.products || []).reduce((sum, p) => {
            if (p.hasVariants && p.variants) return sum + p.variants.reduce((vSum, v) => vSum + (getLatestProductCost(v.id, settings) * (v.stockQuantity || 0)), 0);
            return sum + (getLatestProductCost(p.id, settings) * (p.stockQuantity || 0));
        }, 0);

        const inventorySalesValue = settings.products.reduce((sum, p) => {
            if (p.hasVariants && p.variants) return sum + p.variants.reduce((vSum, v) => vSum + (v.price * (v.stockQuantity || 0)), 0);
            return sum + (p.price * (p.stockQuantity || 0));
        }, 0);

        const partners = settings.partners || [];
        const partnerTransactions = settings.partnerTransactions || [];
        const totalCapital = partnerTransactions
            .filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage')
            .reduce((sum, t) => sum + t.amount, 0);

        const pendingCollection = orders.filter(o => o.status === 'تم_توصيلها' && !o.collectionProcessed).reduce((sum, o) => sum + (o.productPrice + o.shippingFee), 0);

        const partnerPerformance = partners.map(partner => {
             const partnerTx = partnerTransactions.filter(t => t.partnerId === partner.id);
             const distributions = partnerTx.filter(t => t.type === 'profit_distribution').reduce((sum, t) => sum + t.amount, 0);
             const currentProfitShare = (finalNet * (partner.profitRatio || 0)) / 100;
             const undistributedShare = Math.max(0, currentProfitShare - distributions);
             return { ...partner, currentBalance: partner.balance || 0 };
        });

        return { totalProductRevenue, totalExtraMarkup, totalShippingRevenue, totalCogs, totalLoss, totalExpenses, finalNet, inventoryValue, inventorySalesValue, partnerPerformance, totalCapital, pendingCollection };
    }, [orders, settings, wallet]);

    return (
        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden mt-8">
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                <FileText className="text-blue-400" /> التقرير الختامي الشامل
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">رأس المال</p>
                    <p className="text-2xl font-black text-blue-400">{stats.totalCapital.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">إجمالي المبيعات (كلي)</p>
                    <p className="text-2xl font-black">{(stats.totalProductRevenue + stats.totalExtraMarkup + stats.totalShippingRevenue).toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">مستحقات الشحن (الاستلام)</p>
                    <p className="text-2xl font-black text-amber-400">{stats.pendingCollection.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">الصافي النهائي</p>
                    <p className="text-3xl font-black text-emerald-400">{stats.finalNet.toLocaleString('ar-EG')} <span className="text-base font-normal">ج.م</span></p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">إجمالي تكلفة البضاعة (COGS)</p>
                    <p className="text-2xl font-black text-red-400">{stats.totalCogs.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">إجمالي الخسائر (مرتجع)</p>
                    <p className="text-2xl font-black text-red-400">{stats.totalLoss.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-2">إجمالي المصروفات الإدارية</p>
                    <p className="text-2xl font-black text-amber-400">{stats.totalExpenses.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span></p>
                </div>
                
                <div className="lg:col-span-3 border-t border-slate-700 pt-6 mt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                        <p className="text-slate-400 text-xs font-bold uppercase mb-4">قيمة البضاعة المتاحة (في المخازن)</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                <p className="text-slate-400 text-[10px]">بسعر الشراء</p>
                                <p className="font-black">{stats.inventoryValue.toLocaleString('ar-EG')} ج.م</p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                <p className="text-slate-400 text-[10px]">بسعر البيع</p>
                                <p className="font-black text-emerald-300">{stats.inventorySalesValue.toLocaleString('ar-EG')} ج.م</p>
                            </div>
                        </div>
                        </div>
                        <div>
                        <p className="text-slate-400 text-xs font-bold uppercase mb-4">أرصدة وعهدة الشركاء</p>
                        <div className="space-y-2">
                            {stats.partnerPerformance.map(p => (
                                <div key={p.id} className="flex justify-between items-center bg-slate-800 p-2 rounded-lg text-sm">
                                    <span className="font-bold">{p.name}</span>
                                    <span className={`${p.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'} font-black tabular-nums`}>
                                        {p.currentBalance.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </div>
                            ))}
                        </div>
                        </div>
                </div>
            </div>
        </div>
    );
};

const POSSalesReport: React.FC<{ orders: Order[], settings: Settings }> = ({ orders, settings }) => {
    const stats = useMemo(() => {
        const posOrders = orders.filter(o => o.channel === 'pos' || o.id.startsWith('POS-'));
        
        let totalRevenue = 0;
        let totalItems = 0;
        let totalProfit = 0;
        let totalDiscount = 0;

        const productMelt: Record<string, { label: string, quantity: number, revenue: number }> = {};
        const cashierPerformance: Record<string, { label: string, count: number, revenue: number }> = {};

        posOrders.forEach(o => {
            const revenue = (o.totalPrice || (o.productPrice + o.shippingFee));
            totalRevenue += revenue;
            totalDiscount += (o.discount || 0);
            
            const { profit } = calculateOrderProfitLoss(o, settings);
            totalProfit += profit;

            (o.items || []).forEach(item => {
                totalItems += item.quantity;
                if (!productMelt[item.productId]) {
                    productMelt[item.productId] = { label: item.name, quantity: 0, revenue: 0 };
                }
                productMelt[item.productId].quantity += item.quantity;
                productMelt[item.productId].revenue += (item.price * item.quantity);
            });

            const cashierId = o.createdBy || 'Unknown';
            if (!cashierPerformance[cashierId]) {
                cashierPerformance[cashierId] = { label: o.customerName || 'كاشير مجهول', count: 0, revenue: 0 };
            }
            cashierPerformance[cashierId].count += 1;
            cashierPerformance[cashierId].revenue += revenue;
        });

        const bestProducts = Object.values(productMelt).sort((a,b) => b.revenue - a.revenue).slice(0, 5);

        return {
            totalRevenue,
            totalItems,
            totalProfit,
            totalDiscount,
            count: posOrders.length,
            bestProducts,
            cashierPerformance: Object.values(cashierPerformance)
        };
    }, [orders, settings]);

    if (stats.count === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <Monitor size={48} />
                </div>
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">لا توجد مبيعات كاشير (POS) حالياً</h3>
                <p className="text-slate-400 text-sm max-w-sm">بمجرد إجراء عمليات بيع من خلال نقطة البيع، ستظهر التحليلات هنا بالتفصيل.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in-5 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5 uppercase">
                        <ShoppingBasket size={12} className="text-indigo-500" />
                        إجمالي مبيعات الـ POS
                    </p>
                    <h4 className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">
                        {stats.totalRevenue.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                    </h4>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase">عدد الفواتير</p>
                    <h4 className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">{stats.count}</h4>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase text-emerald-500">الربح الصافي</p>
                    <h4 className="text-3xl font-black text-emerald-600 tabular-nums">
                        {stats.totalProfit.toLocaleString()} <span className="text-xs font-bold text-emerald-400">ج.م</span>
                    </h4>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase text-red-500">إجمالي الخصم الممنوح</p>
                    <h4 className="text-3xl font-black text-red-500 tabular-nums">
                        {stats.totalDiscount.toLocaleString()} <span className="text-xs font-bold text-red-400">ج.م</span>
                    </h4>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 font-black">
                        <Package className="text-indigo-500" />
                        المنتجات الأكثر مبيعاً في الكاشير
                    </h3>
                    <div className="space-y-4">
                        {stats.bestProducts.map((p, idx) => {
                            const percentage = (p.revenue / stats.totalRevenue) * 100;
                            return (
                                <div key={idx}>
                                    <div className="flex justify-between items-center mb-1 text-xs font-bold">
                                        <span className="text-slate-600 dark:text-slate-300">{p.label}</span>
                                        <span>{p.revenue.toLocaleString()} ج.م ({p.quantity} قطعة)</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${percentage}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm font-sans">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 font-black">
                        <Monitor className="text-blue-500" />
                        أداء بائعي الكاشير
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead>
                                <tr className="text-slate-400 text-xs border-b border-slate-100 dark:border-slate-800">
                                    <th className="pb-3 px-2">اسم البائع</th>
                                    <th className="pb-3 px-2">العمليات</th>
                                    <th className="pb-3 px-2 text-left">إجمالي التحصيل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {stats.cashierPerformance.map((c, idx) => (
                                    <tr key={idx}>
                                        <td className="py-3 px-2 text-sm font-bold text-slate-700 dark:text-slate-200">{c.label}</td>
                                        <td className="py-3 px-2 text-sm">{c.count}</td>
                                        <td className="py-3 px-2 text-sm text-left font-black text-indigo-600">{c.revenue.toLocaleString()} ج.م</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ReportsPage: React.FC<ReportsPageProps> = ({ orders, settings, wallet, activeStore, setSettings, setWallet }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'losses' | 'comprehensive' | 'final' | 'partners' | 'inventory' | 'accounting' | 'pos'>('summary');
    const [dateRangeType, setDateRangeType] = useState<string>('all');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

    const filteredData = useMemo(() => {
        if (dateRangeType === 'all') {
            return { orders, wallet };
        }

        const now = new Date();
        const startOfDay = (d: Date) => {
            const res = new Date(d);
            res.setHours(0,0,0,0);
            return res;
        };
        const endOfDay = (d: Date) => {
            const res = new Date(d);
            res.setHours(23,59,59,999);
            return res;
        };

        let minDate: Date | null = null;
        let maxDate: Date | null = null;

        if (dateRangeType === 'today') {
            minDate = startOfDay(now);
            maxDate = endOfDay(now);
        } else if (dateRangeType === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            minDate = startOfDay(yesterday);
            maxDate = endOfDay(yesterday);
        } else if (dateRangeType === '7days') {
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            minDate = startOfDay(weekAgo);
            maxDate = endOfDay(now);
        } else if (dateRangeType === 'thisMonth') {
            minDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            maxDate = endOfDay(now);
        } else if (dateRangeType === 'lastMonth') {
            minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            maxDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        } else if (dateRangeType === 'custom') {
            if (customStartDate) {
                minDate = startOfDay(new Date(customStartDate));
            }
            if (customEndDate) {
                maxDate = endOfDay(new Date(customEndDate));
            }
        }

        const filteredOrders = orders.filter(o => {
            if (!o.date) return false;
            const itemTime = new Date(o.date).getTime();
            if (minDate && itemTime < minDate.getTime()) return false;
            if (maxDate && itemTime > maxDate.getTime()) return false;
            return true;
        });

        const filteredTransactions = (wallet?.transactions || []).filter(t => {
            if (!t.date) return false;
            const itemTime = new Date(t.date).getTime();
            if (minDate && itemTime < minDate.getTime()) return false;
            if (maxDate && itemTime > maxDate.getTime()) return false;
            return true;
        });

        const filteredWallet = wallet ? {
            ...wallet,
            transactions: filteredTransactions
        } : wallet;

        return { orders: filteredOrders, wallet: filteredWallet };
    }, [orders, wallet, dateRangeType, customStartDate, customEndDate]);

    const dateRangeText = useMemo(() => {
        if (dateRangeType === 'all') return 'كل البيانات';
        if (dateRangeType === 'today') return 'اليوم';
        if (dateRangeType === 'yesterday') return 'أمس';
        if (dateRangeType === '7days') return 'آخر 7 أيام';
        if (dateRangeType === 'thisMonth') return 'هذا الشهر';
        if (dateRangeType === 'lastMonth') return 'الشهر السابق';
        if (dateRangeType === 'custom') {
            const start = customStartDate ? new Date(customStartDate).toLocaleDateString('ar-EG') : 'البداية';
            const end = customEndDate ? new Date(customEndDate).toLocaleDateString('ar-EG') : 'النهاية';
            return `مخصص (${start} - ${end})`;
        }
        return 'غير محدد';
    }, [dateRangeType, customStartDate, customEndDate]);

    return (
        <div className="space-y-6 sm:space-y-8 pb-12" dir="rtl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">الذكاء التحليلي والموازنة</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <FileText size={32} className="text-indigo-500"/>
                        مركز التقارير والتحليلات
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">ملخص شامل ومؤشرات الأداء لمتجرك والمركز المالي الدقيق لجميع الشركاء</p>
                </div>
            </div>

            {/* Dynamic Date Range Picker Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                            <Calendar size={18} />
                        </span>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">نطاق فلترة تاريخ التقارير</h3>
                            <p className="text-[11px] text-slate-400">حدد الفترة الزمنية لتحديث كافة الرسوم والأرباح وإحصاءات الخسائر والشركاء بشكل منسق.</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800/80 w-fit">
                        {[
                            { id: 'all', label: 'كل البيانات' },
                            { id: 'today', label: 'اليوم' },
                            { id: 'yesterday', label: 'أمس' },
                            { id: '7days', label: 'آخر 7 أيام' },
                            { id: 'thisMonth', label: 'هذا الشهر' },
                            { id: 'lastMonth', label: 'الشهر السابق' },
                            { id: 'custom', label: 'نطاق مخصص 📅' }
                        ].map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => setDateRangeType(preset.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    dateRangeType === preset.id
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>

                {dateRangeType === 'custom' && (
                    <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs animate-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold">من تاريخ:</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-slate-200"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold">إلى تاريخ:</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-slate-200"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar scroll-smooth w-full sm:w-fit">
                <button onClick={() => setActiveTab('summary')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'summary' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>ملخص المبيعات</button>
                <button onClick={() => setActiveTab('losses')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'losses' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>تقرير الخسائر</button>
                <button onClick={() => setActiveTab('pos')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'pos' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>تقرير الكاشير (POS)</button>
                <button onClick={() => setActiveTab('comprehensive')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'comprehensive' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>التقرير الشامل</button>
                <button onClick={() => setActiveTab('final')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'final' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>التقرير الختامي الشامل</button>
                <button onClick={() => setActiveTab('partners')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'partners' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>تقرير الشركاء</button>
                <button onClick={() => setActiveTab('inventory')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'inventory' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>المشتريات والمخزون</button>
                <button onClick={() => setActiveTab('accounting')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'accounting' ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 dark:shadow-none' : 'text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50'}`}>الحسابات الختامية 📊</button>
            </div>
            <div className="relative min-h-[calc(100vh-200px)] mt-6 animate-in fade-in-5 duration-300">
                {activeTab === 'summary' && <SalesSummaryReport orders={filteredData.orders} settings={settings} wallet={filteredData.wallet} />}
                {activeTab === 'losses' && <LossesReport orders={filteredData.orders} settings={settings} activeStore={activeStore} dateRangeText={dateRangeText} />}
                {activeTab === 'pos' && <POSSalesReport orders={filteredData.orders} settings={settings} />}
                {activeTab === 'comprehensive' && <ComprehensiveReport orders={filteredData.orders} settings={settings} wallet={filteredData.wallet} activeStore={activeStore} dateRangeText={dateRangeText} />}
                {activeTab === 'final' && <FinalReport orders={filteredData.orders} settings={settings} wallet={filteredData.wallet} activeStore={activeStore} dateRangeText={dateRangeText} />}
                {activeTab === 'partners' && <PartnersFinancialReport orders={filteredData.orders} settings={settings} wallet={filteredData.wallet} activeStore={activeStore} dateRangeText={dateRangeText} />}
                {activeTab === 'inventory' && <InventoryReport activeStore={activeStore} settings={settings} dateRangeText={dateRangeText} />}
                {activeTab === 'accounting' && <AccountingReports orders={filteredData.orders} settings={settings} wallet={filteredData.wallet} activeStore={activeStore} setSettings={setSettings} setWallet={setWallet} />}
            </div>
        </div>
    );
};

export default ReportsPage;
