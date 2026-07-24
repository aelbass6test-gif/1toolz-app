import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, Settings, Treasury, TreasuryTransaction, TreasuryAccount, TransactionCategory, Wallet, Transaction } from '../types';
import { calculateInsuranceFee, calculateBostaVat, getCompanySpecificFees, calculateWalletLiveBalance } from '../utils/financials';
import { 
    DollarSign, Plus, CheckCircle2, AlertCircle, RefreshCw, X, Search, ChevronDown, Filter, 
    Trash2, Calendar, Edit, Eye, Check, AlertTriangle, Truck, ShieldAlert, Award, FileSpreadsheet,
    TrendingUp, Shield, BarChart2, Coins, ArrowUpRight, HelpCircle, User, FileText, ChevronRight,
    Printer, Download, ShieldCheck
} from 'lucide-react';

interface FailedDeliveryCompensationPageProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  forceSync: (customStoreData?: any) => Promise<void>;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  customers?: any[];
}

type CompensationStatus = 'none' | 'pending' | 'compensated' | 'rejected' | 'flexship';

export const FailedDeliveryCompensationPage: React.FC<FailedDeliveryCompensationPageProps> = ({
  orders,
  setOrders,
  treasury,
  setTreasury,
  settings,
  updateSettings,
  forceSync,
  wallet,
  setWallet,
  customers = []
}) => {
  // Navigation & View Tabs
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompensationStatus | 'all'>('all');
  const [carrierFilter, setCarrierFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Modal / Form States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [modalStatus, setModalStatus] = useState<CompensationStatus>('none');
  const [modalAmount, setModalAmount] = useState<string>('');
  const [modalCourierName, setModalCourierName] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalTreasuryAccountId, setModalTreasuryAccountId] = useState<string>('');
  const [modalRecordFinancial, setModalRecordFinancial] = useState<boolean>(true);
  const [modalShippingTax, setModalShippingTax] = useState<string>('');
  const [modalShippingInsurance, setModalShippingInsurance] = useState<string>('');
  const [modalShippingInspection, setModalShippingInspection] = useState<string>('');

  // Success / Error Alerts
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to calculate total lost shipping expenses including tax, insurance, inspection
  const getOrderTotalLoss = (o: Order) => {
    const base = Number(o.shippingFee || 0);
    
    // Check if custom fields were saved in Firestore
    const hasTax = (o as any).shippingTax !== undefined && (o as any).shippingTax !== null && (o as any).shippingTax !== '';
    const tax = hasTax ? Number((o as any).shippingTax) : Number(o.tax || 0);
    
    const hasIns = (o as any).shippingInsurance !== undefined && (o as any).shippingInsurance !== null && (o as any).shippingInsurance !== '';
    const ins = hasIns ? Number((o as any).shippingInsurance) : Number(o.insuranceFee || 0);
    
    const hasInsp = (o as any).shippingInspection !== undefined && (o as any).shippingInspection !== null && (o as any).shippingInspection !== '';
    const insp = hasInsp ? Number((o as any).shippingInspection) : Number(o.inspectionFee || 0);
    
    let finalTax = tax;
    let finalIns = ins;
    let finalInsp = insp;

    if (!hasIns && finalIns === 0 && settings) {
      const compFees = getCompanySpecificFees(settings, o.shippingCompany);
      const useCustom = compFees?.useCustomFees ?? false;
      const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      finalIns = (o.isInsured ?? true) ? calculateInsuranceFee(o, insuranceRate, settings) : 0;
    }

    if (!hasTax && finalTax === 0 && settings) {
      finalTax = calculateBostaVat(o, finalIns, settings);
    }

    if (!hasInsp && finalInsp === 0 && settings) {
      const compFees = getCompanySpecificFees(settings, o.shippingCompany);
      const useCustom = compFees?.useCustomFees ?? false;
      const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
      finalInsp = o.includeInspectionFee !== false ? inspectionCost : 0;
    }

    const total = base + finalTax + finalIns + finalInsp;
    return Math.round(total * 100) / 100;
  };

  // Helper to update recommended compensation amount dynamically
  const updateRecommendedAmount = (tax: string, insurance: string, inspection: string) => {
    if (!selectedOrder) return;
    const base = Number(selectedOrder.shippingFee || 0);
    const t = Number(tax) || 0;
    const i = Number(insurance) || 0;
    const ins = Number(inspection) || 0;
    const total = base + t + i + ins;
    setModalAmount(String(Math.round(total * 100) / 100));
  };

  // Helper: Show alert then hide it after 3s
  const showAlert = (message: string, type: 'success' | 'error' = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  // Get all orders that failed delivery (status is 'فشل_التوصيل' or returning)
  // We also include order types where the merchant might need compensation
  const failedOrders = useMemo(() => {
    return orders.filter(o => 
      o.status === 'فشل_التوصيل' || 
      o.status === 'تمت_الاعادة_لشركة_الشحن' || 
      (o as any).compensationStatus && (o as any).compensationStatus !== 'none'
    );
  }, [orders]);

  // Extract unique shipping carriers from failed orders for the filter
  const carrierOptions = useMemo(() => {
    const carriers = new Set<string>();
    failedOrders.forEach(o => {
      if (o.shippingCompany) carriers.add(o.shippingCompany);
    });
    return Array.from(carriers);
  }, [failedOrders]);

  // Filtered failed orders list
  const filteredOrders = useMemo(() => {
    return failedOrders.filter(o => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        (o as any).compensationCourierName?.toLowerCase().includes(q) ||
        (o as any).compensationNotes?.toLowerCase().includes(q);

      // 2. Status Filter
      const isFlexShip = !!(o.flexShipFeePaidByCustomer || (o.enableFlexShip && o.flexShipFeePaidByCustomer));
      const orderCompStatus = (o as any).compensationStatus || 'none';
      let matchesStatus = false;
      if (statusFilter === 'all') matchesStatus = true;
      else if (statusFilter === 'flexship') matchesStatus = isFlexShip;
      else if (statusFilter === 'compensated') matchesStatus = orderCompStatus === 'compensated' && !isFlexShip;
      else if (statusFilter === 'none') matchesStatus = orderCompStatus === 'none' && !isFlexShip;
      else matchesStatus = orderCompStatus === statusFilter;

      // 3. Carrier Filter
      const matchesCarrier = carrierFilter === 'all' || o.shippingCompany === carrierFilter;

      // 4. Time Filter
      if (!matchesSearch || !matchesStatus || !matchesCarrier) return false;
      
      if (timeFilter === 'all') return true;
      const orderDate = new Date(o.date);
      const now = new Date();
      const diffMs = now.getTime() - orderDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (timeFilter === 'today') return diffDays <= 1;
      if (timeFilter === 'week') return diffDays <= 7;
      if (timeFilter === 'month') return diffDays <= 30;

      return true;
    });
  }, [failedOrders, searchQuery, statusFilter, carrierFilter, timeFilter]);

  // Analytics & Aggregated Data Calculations
  const stats = useMemo(() => {
    let totalFailed = failedOrders.length;
    let totalClaimedCount = 0;
    let totalCompensatedCount = 0;
    let totalPendingCount = 0;
    let totalCompensatedAmount = 0;
    let totalPendingAmount = 0;
    let totalShippingLoss = 0;

    failedOrders.forEach(o => {
      const isFlexShip = !!(o.flexShipFeePaidByCustomer || (o.enableFlexShip && o.flexShipFeePaidByCustomer));
      const compStatus = (o as any).compensationStatus || (isFlexShip ? 'compensated' : 'none');
      const orderTotalLoss = getOrderTotalLoss(o);
      const compAmt = Number((o as any).compensationAmount || (isFlexShip ? (o.flexShipFee || orderTotalLoss) : 0));

      totalShippingLoss += orderTotalLoss;

      if (compStatus === 'compensated' || isFlexShip) {
        totalCompensatedCount++;
        totalCompensatedAmount += compAmt;
        totalClaimedCount++;
      } else if (compStatus === 'pending') {
        totalPendingCount++;
        totalPendingAmount += orderTotalLoss; // Use total loss (fee + tax + ins + insp) as estimated pending value
        totalClaimedCount++;
      } else if (compStatus === 'rejected') {
        totalClaimedCount++;
      }
    });

    return {
      totalFailed,
      totalClaimedCount,
      totalCompensatedCount,
      totalPendingCount,
      totalCompensatedAmount,
      totalPendingAmount,
      totalShippingLoss,
      netLoss: Math.max(0, totalShippingLoss - totalCompensatedAmount),
      claimSuccessRate: totalClaimedCount > 0 ? Math.round((totalCompensatedCount / totalClaimedCount) * 100) : 0
    };
  }, [failedOrders]);

  // Grouped by shipping carrier for visualization/reports
  const carrierStats = useMemo(() => {
    const map: Record<string, { total: number; compensated: number; pending: number; amount: number; loss: number }> = {};
    
    failedOrders.forEach(o => {
      const carrier = o.shippingCompany || 'غير محدد';
      if (!map[carrier]) {
        map[carrier] = { total: 0, compensated: 0, pending: 0, amount: 0, loss: 0 };
      }
      
      const isFlexShip = !!(o.flexShipFeePaidByCustomer || (o.enableFlexShip && o.flexShipFeePaidByCustomer));
      const compStatus = (o as any).compensationStatus || (isFlexShip ? 'compensated' : 'none');
      const orderTotalLoss = getOrderTotalLoss(o);
      const compAmt = Number((o as any).compensationAmount || (isFlexShip ? (o.flexShipFee || orderTotalLoss) : 0));

      map[carrier].total++;
      map[carrier].loss += orderTotalLoss;
      
      if (compStatus === 'compensated' || isFlexShip) {
        map[carrier].compensated++;
        map[carrier].amount += compAmt;
      } else if (compStatus === 'pending') {
        map[carrier].pending++;
      }
    });

    return Object.entries(map).map(([carrier, data]) => ({
      carrier,
      ...data,
      recoveryRate: data.loss > 0 ? Math.round((data.amount / data.loss) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [failedOrders]);

  // Print Compensation Report
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const storeName = (settings as any).storeName || 'متجري';
    const currentDate = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const tableRows = filteredOrders.map((o, idx) => {
      const isFlexShip = !!(o.flexShipFeePaidByCustomer || (o.enableFlexShip && o.flexShipFeePaidByCustomer));
      const compStatus = (o as any).compensationStatus || (isFlexShip ? 'compensated' : 'none');
      const compStatusLabel = isFlexShip ? 'فليكس شيب (Flex Ship)' : compStatus === 'compensated' ? 'معوّض' : compStatus === 'pending' ? 'قيد المتابعة' : compStatus === 'rejected' ? 'مرفوض' : 'غير معوّض';
      const compStatusClass = isFlexShip ? 'color: #4f46e5; font-weight: bold;' : compStatus === 'compensated' ? 'color: #059669; font-weight: bold;' : compStatus === 'pending' ? 'color: #d97706; font-weight: bold;' : compStatus === 'rejected' ? 'color: #dc2626; font-weight: bold;' : 'color: #6b7280;';
      
      const shippingCost = getOrderTotalLoss(o);
      const compAmount = Number((o as any).compensationAmount || (isFlexShip ? (o.flexShipFee || shippingCost) : 0));
      const courier = (o as any).compensationCourierName || (isFlexShip ? 'برنامج فليكس شيب' : '-');
      const notes = (o as any).compensationNotes || (isFlexShip ? 'مغطى بتأمين فليكس شيب' : '-');
      const accId = (o as any).compensationTreasuryAccountId || (isFlexShip ? 'central_wallet' : '');
      let accName = '-';
      if (accId === 'central_wallet') accName = 'المحفظة الإلكترونية المركزية';
      else if (treasury && treasury.accounts) {
        const accList = Array.isArray(treasury.accounts) ? treasury.accounts : Object.values(treasury.accounts || {});
        const match = accList.find((a: any) => a.id === accId) as any;
        if (match) accName = match.name;
      }

      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-weight: bold;">#${o.orderNumber}</td>
          <td><b>${o.customerName}</b><br/><span style="font-size: 10px; color: #64748b;">${o.customerPhone}</span></td>
          <td>${o.shippingCompany || 'غير محدد'}</td>
          <td>${o.status === 'فشل_التوصيل' ? 'فشل توصيل' : o.status === 'تمت_الاعادة_لشركة_الشحن' ? 'تمت الإعادة' : o.status}</td>
          <td style="text-align: center; color: #dc2626; font-weight: bold;">${shippingCost.toLocaleString()} ج.م</td>
          <td style="text-align: center; ${compStatusClass}">${compStatusLabel}</td>
          <td style="text-align: center; color: #059669; font-weight: bold;">${compAmount > 0 ? `${compAmount.toLocaleString()} ج.م` : '-'}</td>
          <td style="font-size: 11px;">${accName}</td>
          <td style="font-size: 11px;"><b>${courier}</b><br/>${notes}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير تعويضات شركات الشحن - ${storeName}</title>
        <style>
          body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 25px; color: #0f172a; direction: rtl; background-color: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 5px; font-weight: bold; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px; }
          .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 16px; }
          .kpi-title { font-size: 11px; color: #64748b; font-weight: bold; }
          .kpi-value { font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px; }
          th { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: 800; text-align: right; }
          td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; vertical-align: middle; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer-signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; font-weight: bold; color: #475569; }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: left;">
          <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">🖨️ طباعة التقرير</button>
        </div>
        <div class="header">
          <div>
            <h1 class="title">تقرير تعويضات شركات الشحن للطلبات المرتجعة والفاشلة</h1>
            <div class="subtitle">المتجر: ${storeName} | تاريخ الطباعة: ${currentDate}</div>
          </div>
          <div style="text-align: left; font-size: 11px; color: #475569;">
            <div>إجمالي الطلبات بالتقرير: <b>${filteredOrders.length} طلب</b></div>
            <div>شركة الشحن: <b>${carrierFilter === 'all' ? 'جميع الشركات' : carrierFilter}</b></div>
            <div>حالة التعويض: <b>${statusFilter === 'all' ? 'الكل' : statusFilter === 'compensated' ? 'معوض' : statusFilter === 'pending' ? 'قيد المتابعة' : statusFilter === 'rejected' ? 'مرفوض' : 'غير معوض'}</b></div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">إجمالي الطلبات المستهدفة</div>
            <div class="kpi-value">${stats.totalFailed}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">الطلبات المعوضة</div>
            <div class="kpi-value" style="color: #059669;">${stats.totalCompensatedCount}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">إجمالي التعويضات المحصلة</div>
            <div class="kpi-value" style="color: #059669;">${stats.totalCompensatedAmount.toLocaleString()} ج.م</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">صافي خسارة الشحن الفعلي</div>
            <div class="kpi-value" style="color: #dc2626;">${stats.netLoss.toLocaleString()} ج.م</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">#</th>
              <th>رقم الطلب</th>
              <th>اسم العميل</th>
              <th>شركة الشحن</th>
              <th>حالة الطلب</th>
              <th style="text-align: center;">تكلفة الشحن</th>
              <th style="text-align: center;">حالة التعويض</th>
              <th style="text-align: center;">مبلغ التعويض</th>
              <th>الحساب المودع فيه</th>
              <th>المندوب / الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.length > 0 ? tableRows : '<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 25px;">لا توجد طلبات مطابقة للفلاتر المختارة</td></tr>'}
          </tbody>
        </table>

        <div class="footer-signatures">
          <div>توقيع مسؤول متابعة الشحن: ...................................</div>
          <div>توقيع المدير المالي / المحاسب: ...................................</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["رقم الأوردر", "اسم العميل", "رقم الهاتف", "شركة الشحن", "حالة الطلب", "مصاريف الشحن والمصاريف", "حالة التعويض", "مبلغ التعويض المحصل", "الحساب المودع فيه", "اسم المندوب", "ملاحظات التعويض", "تاريخ التعويض"];
    const rows = filteredOrders.map(o => {
      const isFlexShip = !!(o.flexShipFeePaidByCustomer || (o.enableFlexShip && o.flexShipFeePaidByCustomer));
      const compStatus = (o as any).compensationStatus || (isFlexShip ? 'compensated' : 'none');
      const compStatusLabel = isFlexShip ? 'فليكس شيب (Flex Ship)' : compStatus === 'compensated' ? 'معوض' : compStatus === 'pending' ? 'قيد المتابعة' : compStatus === 'rejected' ? 'مرفوض' : 'غير معوض';
      const compAmount = Number((o as any).compensationAmount || (isFlexShip ? (o.flexShipFee || getOrderTotalLoss(o)) : 0));
      const accId = (o as any).compensationTreasuryAccountId || (isFlexShip ? 'central_wallet' : '');
      let accName = '-';
      if (accId === 'central_wallet') accName = 'المحفظة الإلكترونية المركزية';
      else if (treasury && treasury.accounts) {
        const accList = Array.isArray(treasury.accounts) ? treasury.accounts : Object.values(treasury.accounts || {});
        const match = accList.find((a: any) => a.id === accId) as any;
        if (match) accName = match.name;
      }

      return [
        o.orderNumber,
        o.customerName,
        o.customerPhone,
        o.shippingCompany || '',
        o.status,
        getOrderTotalLoss(o),
        compStatusLabel,
        compAmount,
        accName,
        (o as any).compensationCourierName || (isFlexShip ? 'برنامج فليكس شيب' : ''),
        (o as any).compensationNotes || (isFlexShip ? 'مغطى بتأمين فليكس شيب' : ''),
        (o as any).compensationDate || ''
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `تقرير_تعويضات_الشحن_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open manage compensation modal
  const handleOpenManageModal = (order: Order) => {
    setSelectedOrder(order);
    const isFlexShip = !!(order.flexShipFeePaidByCustomer || (order.enableFlexShip && order.flexShipFeePaidByCustomer));
    setModalStatus((order as any).compensationStatus || (isFlexShip ? 'compensated' : 'none'));
    
    let taxVal = (order as any).shippingTax !== undefined && (order as any).shippingTax !== null && (order as any).shippingTax !== ''
      ? Number((order as any).shippingTax)
      : (order.tax !== undefined && order.tax !== null ? Number(order.tax) : 0);
    
    let insVal = (order as any).shippingInsurance !== undefined && (order as any).shippingInsurance !== null && (order as any).shippingInsurance !== ''
      ? Number((order as any).shippingInsurance)
      : (order.insuranceFee !== undefined && order.insuranceFee !== null ? Number(order.insuranceFee) : 0);
      
    let inspVal = (order as any).shippingInspection !== undefined && (order as any).shippingInspection !== null && (order as any).shippingInspection !== ''
      ? Number((order as any).shippingInspection)
      : (order.inspectionFee !== undefined && order.inspectionFee !== null ? Number(order.inspectionFee) : 0);

    const hasTax = (order as any).shippingTax !== undefined && (order as any).shippingTax !== null && (order as any).shippingTax !== '';
    const hasIns = (order as any).shippingInsurance !== undefined && (order as any).shippingInsurance !== null && (order as any).shippingInsurance !== '';
    const hasInsp = (order as any).shippingInspection !== undefined && (order as any).shippingInspection !== null && (order as any).shippingInspection !== '';

    if (!hasIns && insVal === 0 && settings) {
      const compFees = getCompanySpecificFees(settings, order.shippingCompany);
      const useCustom = compFees?.useCustomFees ?? false;
      const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
      insVal = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
    }

    if (!hasTax && taxVal === 0 && settings) {
      taxVal = calculateBostaVat(order, insVal, settings);
    }

    if (!hasInsp && inspVal === 0 && settings) {
      const compFees = getCompanySpecificFees(settings, order.shippingCompany);
      const useCustom = compFees?.useCustomFees ?? false;
      const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
      inspVal = order.includeInspectionFee !== false ? inspectionCost : 0;
    }
    
    setModalShippingTax(String(taxVal));
    setModalShippingInsurance(String(insVal));
    setModalShippingInspection(String(inspVal));

    // Calculate total if none, else use stored compensation amount
    const baseFee = Number(order.shippingFee || 0);
    const calculatedTotal = Math.round((baseFee + taxVal + insVal + inspVal) * 100) / 100;
    setModalAmount(String((order as any).compensationAmount !== undefined && (order as any).compensationAmount !== null && (order as any).compensationAmount !== 0 ? (order as any).compensationAmount : (isFlexShip ? (order.flexShipFee || calculatedTotal) : calculatedTotal || '')));
    
    setModalCourierName((order as any).compensationCourierName || (isFlexShip ? 'برنامج فليكس شيب' : ''));
    setModalNotes((order as any).compensationNotes || (isFlexShip ? 'تعويض تلقائي لبرنامج فليكس شيب' : ''));
    setModalTreasuryAccountId((order as any).compensationTreasuryAccountId || (isFlexShip ? 'central_wallet' : ''));
    setModalRecordFinancial(true);
    setShowManageModal(true);
  };

  // Submit Compensation details
  const handleSaveCompensation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsSubmitting(true);
    try {
      const compAmount = modalStatus === 'compensated' ? Number(modalAmount) : 0;
      const taxAmt = Number(modalShippingTax) || 0;
      const insAmt = Number(modalShippingInsurance) || 0;
      const inspAmt = Number(modalShippingInspection) || 0;
      
      // Determine if status is changing TO compensated to log financial deposit
      const previousStatus = (selectedOrder as any).compensationStatus || 'none';
      const isNewCompensation = modalStatus === 'compensated' && previousStatus !== 'compensated';

      // 1. Calculate updated order list
      const updatedOrders = orders.map(o => {
        if (o.id === selectedOrder.id) {
          return {
            ...o,
            compensationStatus: modalStatus,
            compensationAmount: compAmount,
            compensationCourierName: modalCourierName,
            compensationNotes: modalNotes,
            compensationDate: modalStatus === 'compensated' ? new Date().toISOString().split('T')[0] : (o as any).compensationDate,
            compensationTreasuryAccountId: modalStatus === 'compensated' ? modalTreasuryAccountId : undefined,
            shippingTax: taxAmt,
            shippingInsurance: insAmt,
            shippingInspection: inspAmt
          } as any;
        }
        return o;
      });

      // 2. Financial Integration: Record deposit in Treasury or Wallet
      let updatedWallet = wallet;
      let updatedTreasury = treasury;

      if (isNewCompensation && modalRecordFinancial && modalTreasuryAccountId) {
        if (modalTreasuryAccountId === 'central_wallet' && wallet && setWallet) {
          const newTx: Transaction = {
            id: `tx-comp-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            amount: compAmount,
            type: 'إيداع',
            note: `تعويض شركة الشحن (${selectedOrder.shippingCompany}) للطلب الملغي رقم #${selectedOrder.orderNumber} - مندوب: ${modalCourierName || 'غير محدد'} (يشمل الشحن والمصاريف)`,
            category: 'shipping_compensation',
            status: 'completed',
            orderId: selectedOrder.id,
            orderNumber: String(selectedOrder.orderNumber)
          };
          updatedWallet = {
            ...wallet,
            balance: (wallet.balance || 0) + compAmount,
            transactions: [newTx, ...(wallet.transactions || [])]
          };
          setWallet(updatedWallet);
        } else if (setTreasury && treasury) {
          const newTx: TreasuryTransaction = {
            id: `tx-comp-${Date.now()}`,
            date: new Date().toISOString(),
            toAccountId: modalTreasuryAccountId,
            amount: compAmount,
            type: 'deposit',
            description: `تعويض شركة الشحن (${selectedOrder.shippingCompany}) للطلب الملغي رقم #${selectedOrder.orderNumber} - مندوب: ${modalCourierName || 'غير محدد'} (يشمل الشحن والمصاريف)`,
            category: 'manual_deposit' as TransactionCategory
          };

          const updatedAccounts = (treasury.accounts || []).map((acc: TreasuryAccount) => {
            if (acc.id === modalTreasuryAccountId) {
              return {
                ...acc,
                balance: Number(acc.balance || 0) + compAmount
              };
            }
            return acc;
          });

          updatedTreasury = {
            ...treasury,
            accounts: updatedAccounts,
            transactions: [newTx, ...(treasury.transactions || [])]
          };
          setTreasury(updatedTreasury);
        }
      }

      // Update orders in global React state
      setOrders(updatedOrders);

      // Build updated full store data payload for forceSync
      const customStoreData = {
        settings,
        orders: updatedOrders,
        wallet: updatedWallet,
        treasury: updatedTreasury,
        customers: customers || []
      };

      // 3. Save to database / local persistence with complete store data payload
      try {
        await forceSync(customStoreData);
        showAlert('تم حفظ تفاصيل التعويض ومزامنة البيانات بنجاح!', 'success');
        setShowManageModal(false);
        setSelectedOrder(null);
      } catch (syncErr) {
        console.error(syncErr);
        showAlert('تم الحفظ محلياً ولكن حدث خطأ أثناء المزامنة السحابية.', 'error');
      } finally {
        setIsSubmitting(false);
      }

    } catch (err: any) {
      console.error(err);
      showAlert('حدث خطأ غير متوقع أثناء حفظ التعويض.', 'error');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-sans text-right" dir="rtl" id="failed-delivery-comp-container">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/60 pb-5" id="page-header-block">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white" id="main-title">إدارة تعويضات فشل التوصيل</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            تتبع ومطالبة شركات الشحن بقيمة الشحن للطلبات المرتجعة الناتجة عن مخالفات المناديب (أوردر فيك / عدم تواصل).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrintReport}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            title="طباعة تقرير التعويضات مع التوقيعات"
          >
            <Printer size={14} />
            <span>طباعة التقرير</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            title="تصدير بيانات التعويضات إلى ملف Excel / CSV"
          >
            <Download size={14} />
            <span>تصدير Excel</span>
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>
          <button 
            id="view-list-tab-btn"
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'list' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
            }`}
          >
            سجل المطالبات والطلبات
          </button>
          <button 
            id="view-analytics-tab-btn"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'analytics' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <BarChart2 size={14} />
              تقرير شركات الشحن والمناديب
            </span>
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {alert && (
        <div 
          id="compensation-alert"
          className={`p-4 rounded-2xl flex items-center gap-3 border transition-all animate-fadeIn ${
            alert.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-300' 
              : 'bg-rose-50 text-rose-800 border-rose-200/60 dark:bg-rose-950/20 dark:text-rose-300'
          }`}
        >
          {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-xs font-bold">{alert.message}</span>
        </div>
      )}

      {/* Financial & General Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-grid">
        
        {/* Total Failed Orders (Potential loss) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0b101d] border border-slate-200/60 dark:border-slate-800/80 shadow-xs" id="stat-card-total-failed">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي الطلبيات الفاشلة</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
              <Truck size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalFailed}</span>
            <span className="text-xs text-slate-400">طلب مرتجع</span>
          </div>
          <div className="mt-2 text-[10px] text-red-600 font-bold bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded-lg inline-block">
            إجمالي تكلفة الشحن المفقودة: {stats.totalShippingLoss.toLocaleString()} ج.م
          </div>
        </div>

        {/* Claims in progress */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0b101d] border border-slate-200/60 dark:border-slate-800/80 shadow-xs" id="stat-card-pending-claims">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500">المطالبات المعلقة</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <RefreshCw className="animate-spin-slow" size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600">{stats.totalPendingCount}</span>
            <span className="text-xs text-slate-400">طلب قيد المراجعة</span>
          </div>
          <div className="mt-2 text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded-lg inline-block">
            القيمة المتوقعة: {stats.totalPendingAmount.toLocaleString()} ج.م
          </div>
        </div>

        {/* Compensations Received */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0b101d] border border-slate-200/60 dark:border-slate-800/80 shadow-xs" id="stat-card-received-compensations">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500">التعويضات المستلمة فعلياً</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Coins size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">+{stats.totalCompensatedAmount.toLocaleString()}</span>
            <span className="text-xs text-emerald-500 font-bold">ج.م</span>
          </div>
          <div className="mt-2 text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg inline-block">
            تم استردادها في {stats.totalCompensatedCount} طلب بنجاح
          </div>
        </div>

        {/* Net Loss & Claim Success Rate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0b101d] border border-slate-200/60 dark:border-slate-800/80 shadow-xs" id="stat-card-net-loss">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500">معدل استرداد الخسائر</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-600">{stats.claimSuccessRate}%</span>
            <span className="text-xs text-slate-400">نسبة نجاح المطالبة</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-600 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg inline-block">
            صافي خسارة الشحن الفعلي: {stats.netLoss.toLocaleString()} ج.م
          </div>
        </div>
      </div>

      {activeTab === 'list' ? (
        <>
          {/* Filtering & Searching Controls */}
          <div className="p-4 bg-white dark:bg-[#0b101d] border border-slate-200/60 dark:border-slate-800/80 rounded-2xl space-y-4" id="filters-container">
            <div className="flex flex-col lg:flex-row gap-3">
              
              {/* Search input */}
              <div className="flex-1 relative">
                <input 
                  id="search-input-field"
                  type="text" 
                  placeholder="ابحث برقم الطلب، اسم العميل، اسم المندوب أو الملاحظات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-3 pr-10 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <div className="absolute right-3.5 top-3.5 text-slate-400">
                  <Search size={16} />
                </div>
              </div>

              {/* Status Select */}
              <div className="w-full lg:w-48 relative">
                <select 
                  id="status-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-3 pr-2 pl-8 appearance-none text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="all">كل حالات التعويض</option>
                  <option value="flexship">فليكس شيب (Flex Ship) 🛡️</option>
                  <option value="none">لم يتم المطالبة بها</option>
                  <option value="pending">قيد المطالبة ⏳</option>
                  <option value="compensated">تم التعويض 💵</option>
                  <option value="rejected">مرفوضة ❌</option>
                </select>
                <div className="absolute left-3 top-4 text-slate-400 pointer-events-none">
                  <ChevronDown size={14} />
                </div>
              </div>

              {/* Carrier Select */}
              <div className="w-full lg:w-48 relative">
                <select 
                  id="carrier-filter-select"
                  value={carrierFilter}
                  onChange={(e) => setCarrierFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-3 pr-2 pl-8 appearance-none text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="all">كل شركات الشحن</option>
                  {carrierOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="absolute left-3 top-4 text-slate-400 pointer-events-none">
                  <ChevronDown size={14} />
                </div>
              </div>

              {/* Time Select */}
              <div className="w-full lg:w-40 relative">
                <select 
                  id="time-filter-select"
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-3 pr-2 pl-8 appearance-none text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="all">كل الأوقات</option>
                  <option value="today">آخر 24 ساعة</option>
                  <option value="week">آخر 7 أيام</option>
                  <option value="month">آخر 30 يوم</option>
                </select>
                <div className="absolute left-3 top-4 text-slate-400 pointer-events-none">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            {/* Quick status message */}
            <div className="text-[11px] text-slate-400 font-bold flex justify-between items-center px-1">
              <span>تم العثور على <strong className="text-slate-600 dark:text-slate-300">{filteredOrders.length}</strong> طلب مرتجع فاشل التوصيل يطابق خيارات البحث</span>
              {failedOrders.length === 0 && (
                <span className="text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md">لا توجد طلبات فاشلة التوصيل مسجلة حالياً بالمتجر</span>
              )}
            </div>
          </div>

          {/* Failed Orders Table/List */}
          <div className="bg-white dark:bg-[#0b101d] border border-slate-200/60 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs" id="failed-orders-table-wrapper">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs" id="failed-orders-table">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800 text-slate-500 font-bold">
                    <th className="p-4">رقم الطلب / التاريخ</th>
                    <th className="p-4">اسم العميل ورقم الهاتف</th>
                    <th className="p-4">شركة الشحن والمنطقة</th>
                    <th className="p-4">سعر الشحن المفقود</th>
                    <th className="p-4">المندوب المخالف / التفاصيل</th>
                    <th className="p-4">حالة التعويض</th>
                    <th className="p-4 text-center">العملية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-bold">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Truck size={36} className="text-slate-300 dark:text-slate-700" />
                          <p>لا توجد طلبات مطابقة للبحث أو المصفاة المحددة.</p>
                          <button 
                            id="reset-filters-btn"
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('all');
                              setCarrierFilter('all');
                              setTimeFilter('all');
                            }}
                            className="text-xs text-indigo-600 hover:underline font-bold mt-1"
                          >
                            إعادة ضبط فلاتر التصفية
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(o => {
                      const isFlexShip = !!(o.flexShipFeePaidByCustomer || (o.enableFlexShip && o.flexShipFeePaidByCustomer));
                      const compStatus = (o as any).compensationStatus || (isFlexShip ? 'compensated' : 'none');
                      const compAmount = (o as any).compensationAmount || (isFlexShip ? (o.flexShipFee || getOrderTotalLoss(o)) : 0);
                      const courier = (o as any).compensationCourierName || (isFlexShip ? 'برنامج فليكس شيب' : '');
                      const compNotes = (o as any).compensationNotes || (isFlexShip ? 'مغطى بتأمين فليكس شيب' : '');
                      const accId = (o as any).compensationTreasuryAccountId || (isFlexShip ? 'central_wallet' : '');
                      let accName = '';
                      if (accId === 'central_wallet') {
                        accName = 'المحفظة الإلكترونية المركزية';
                      } else if (accId && treasury?.accounts) {
                        const accList = Array.isArray(treasury.accounts) ? treasury.accounts : Object.values(treasury.accounts || {});
                        const match = accList.find((a: any) => a.id === accId) as any;
                        if (match) accName = match.name;
                      }

                      return (
                        <tr 
                          key={o.id} 
                          id={`compensation-row-${o.id}`}
                          className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-colors"
                        >
                          {/* Order number */}
                          <td className="p-4">
                            <div className="font-black text-slate-900 dark:text-white mb-0.5">#{o.orderNumber}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Calendar size={10} />
                              <span>{new Date(o.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span>
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="p-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{o.customerName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{o.customerPhone}</div>
                          </td>

                          {/* Carrier */}
                          <td className="p-4">
                            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <Truck size={12} className="text-slate-400" />
                              <span>{o.shippingCompany || 'شركة شحن غير محددة'}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{o.shippingArea || o.city || 'منطقة غير محددة'}</div>
                          </td>

                          {/* Loss */}
                          <td className="p-4">
                            <div className="font-black text-slate-800 dark:text-slate-200">
                              {getOrderTotalLoss(o)} ج.م
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {(() => {
                                const base = Number(o.shippingFee || 0);
                                const hasTax = (o as any).shippingTax !== undefined && (o as any).shippingTax !== null && (o as any).shippingTax !== '';
                                const tax = hasTax ? Number((o as any).shippingTax) : Number(o.tax || 0);
                                const hasIns = (o as any).shippingInsurance !== undefined && (o as any).shippingInsurance !== null && (o as any).shippingInsurance !== '';
                                const ins = hasIns ? Number((o as any).shippingInsurance) : Number(o.insuranceFee || 0);
                                const hasInsp = (o as any).shippingInspection !== undefined && (o as any).shippingInspection !== null && (o as any).shippingInspection !== '';
                                const insp = hasInsp ? Number((o as any).shippingInspection) : Number(o.inspectionFee || 0);
                                
                                let finalTax = tax;
                                let finalIns = ins;
                                let finalInsp = insp;

                                if (!hasIns && finalIns === 0 && settings) {
                                  const compFees = getCompanySpecificFees(settings, o.shippingCompany);
                                  const useCustom = compFees?.useCustomFees ?? false;
                                  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
                                  finalIns = (o.isInsured ?? true) ? calculateInsuranceFee(o, insuranceRate, settings) : 0;
                                }

                                if (!hasTax && finalTax === 0 && settings) {
                                  finalTax = calculateBostaVat(o, finalIns, settings);
                                }

                                if (!hasInsp && finalInsp === 0 && settings) {
                                  const compFees = getCompanySpecificFees(settings, o.shippingCompany);
                                  const useCustom = compFees?.useCustomFees ?? false;
                                  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
                                  finalInsp = o.includeInspectionFee !== false ? inspectionCost : 0;
                                }

                                const parts = [];
                                if (base > 0) parts.push(`شحن: ${Math.round(base * 100) / 100}`);
                                if (finalTax > 0) parts.push(`ضريبة: ${Math.round(finalTax * 100) / 100}`);
                                if (finalIns > 0) parts.push(`تأمين: ${Math.round(finalIns * 100) / 100}`);
                                if (finalInsp > 0) parts.push(`معاينة: ${Math.round(finalInsp * 100) / 100}`);
                                return parts.length > 1 ? parts.join(' + ') : 'سعر بوليصة الشحن';
                              })()}
                            </div>
                          </td>

                          {/* Courier violations */}
                          <td className="p-4 max-w-xs">
                            {courier ? (
                              <div className="mb-1">
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded-md">
                                  👤 المندوب: {courier}
                                </span>
                              </div>
                            ) : null}
                            {compNotes ? (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate-2-lines">{compNotes}</p>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700 font-mono">-</span>
                            )}
                          </td>

                          {/* Claim Status Badge */}
                          <td className="p-4">
                            {isFlexShip ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 shadow-xs">
                                  <ShieldCheck size={12} className="text-indigo-600 dark:text-indigo-400" />
                                  فليكس شيب (Flex Ship)
                                </span>
                                <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                  مبلغ التعويض: <span className="text-emerald-600 dark:text-emerald-400 font-black">{compAmount} ج.م</span>
                                </div>
                                {accName && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    الحساب: <span className="font-bold text-slate-800 dark:text-slate-200">{accName}</span>
                                  </div>
                                )}
                              </div>
                            ) : compStatus === 'compensated' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  تم التعويض ({compAmount} ج.م)
                                </span>
                                {accName && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                    الحساب: <span className="font-bold text-slate-800 dark:text-slate-200">{accName}</span>
                                  </div>
                                )}
                              </div>
                            ) : compStatus === 'pending' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                قيد المطالبة بالتعويض
                              </span>
                            ) : compStatus === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                تم رفض التعويض
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-50 text-slate-500 border border-slate-200/50 dark:bg-slate-900 dark:text-slate-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                غير مطالب بها بعد
                              </span>
                            )}
                          </td>

                          {/* Action trigger */}
                          <td className="p-4 text-center">
                            <button 
                              id={`manage-comp-btn-${o.id}`}
                              onClick={() => handleOpenManageModal(o)}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 text-[11px] font-bold text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                            >
                              إدارة المطالبة
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Analytics Tab/Sub-view */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="analytics-grid">
          
          {/* List of carrier totals */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0b101d] border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-5 space-y-4" id="carrier-performance-card">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">إحصائيات استرداد التعويضات حسب شركات الشحن</h3>
            <p className="text-[11px] text-slate-400">يساعدك هذا التحليل على معرفة أكثر شركات الشحن تسبباً في إتلاف الأوردرات أو فقدها وتصنيف مناديبهم.</p>
            
            <div className="space-y-4 mt-2">
              {carrierStats.length === 0 ? (
                <div className="text-center py-12 text-slate-400">لا توجد بيانات كافية لإجراء التحليل والفرز لشركات الشحن.</div>
              ) : (
                carrierStats.map(stat => (
                  <div key={stat.carrier} className="border border-slate-100 dark:border-slate-800/60 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                          <Truck size={14} />
                        </div>
                        <span className="font-black text-slate-800 dark:text-slate-200">{stat.carrier}</span>
                      </div>
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 px-2.5 py-0.5 rounded-md">
                        معدل الاسترداد: {stat.recoveryRate}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-slate-500">
                      <div className="bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg">
                        <span className="block text-slate-400">إجمالي الطلبات الفاشلة</span>
                        <strong className="block text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">{stat.total}</strong>
                      </div>
                      <div className="bg-emerald-500/5 p-2 rounded-lg">
                        <span className="block text-emerald-600/70">الطلبات المستردة</span>
                        <strong className="block text-xs font-black text-emerald-600 mt-0.5">{stat.compensated}</strong>
                      </div>
                      <div className="bg-amber-500/5 p-2 rounded-lg">
                        <span className="block text-amber-600/70">قيد المطالبة</span>
                        <strong className="block text-xs font-black text-amber-600 mt-0.5">{stat.pending}</strong>
                      </div>
                      <div className="bg-indigo-500/5 p-2 rounded-lg">
                        <span className="block text-indigo-600/70">التعويض المالي</span>
                        <strong className="block text-xs font-black text-indigo-600 mt-0.5">+{stat.amount} ج.م</strong>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>التعويضات المستلمة: {stat.amount} ج.م</span>
                        <span>إجمالي التكلفة المفقودة: {stat.loss} ج.م</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full" 
                          style={{ width: `${Math.min(100, stat.recoveryRate)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick tips & manual operations */}
          <div className="bg-white dark:bg-[#0b101d] border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-5 space-y-4" id="faqs-and-tips-card">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">دليل إثبات مخالفات الشحن والمطالبة</h3>
            <p className="text-[11px] text-slate-400">نصائح مخصصة لمتاجر الأونلاين لحماية أرباحك وضمان استرداد أموالك من شركات الشحن:</p>
            
            <div className="space-y-3.5 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 font-bold">1</div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">تسجيل تسريبات المندوبين فوراً</h4>
                  <p className="text-slate-500">في حالة تواصل العميل معك وأخبرك أن المندوب لم يتواصل معه أو طلب مبالغ زيادة، سجل الشكوى باسم المندوب ورقم هاتفه.</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 font-bold">2</div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">رفع المطالبات أسبوعياً</h4>
                  <p className="text-slate-500">لا تنتظر حتى نهاية الشهر، أرسل شيت إكسيل بالطلبات الفاشلة (فيك أوردر) التي مضى عليها 5-7 أيام للدعم اللوجستي للشركة.</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 font-bold">3</div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">التأثير المباشر على الخزينة</h4>
                  <p className="text-slate-500">تأكد دائماً عند وضع علامة "تم التعويض" من ربط العملية بخزينة المتجر الرئيسية لتسجيل الدفعات بشكل صحيح في تقارير الأرباح.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 text-center">
              <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-3 py-2.5 rounded-xl flex items-center gap-2 text-right">
                <Shield size={20} className="shrink-0" />
                <span>برنامج تعويض فشل التوصيل يساهم في توفير متوسط 15% من نفقات الشحن الضائعة سنوياً.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Form Modal - Manage Compensation */}
      {showManageModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="manage-compensation-modal">
          {/* Overlay backdrop */}
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setShowManageModal(false)} />
          
          {/* Modal Card */}
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0b101d] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden animate-slideUp text-right flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/80 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                  <Coins size={16} />
                </div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white">إدارة مطالبة الطلب #{selectedOrder.orderNumber}</h3>
              </div>
              <button 
                id="close-modal-btn"
                onClick={() => setShowManageModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCompensation} className="p-5 space-y-4 overflow-y-auto">
              
              {/* Order Info Summary */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/40 dark:border-slate-800/40 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="block text-slate-400">العميل:</span>
                  <strong className="text-slate-700 dark:text-slate-200">{selectedOrder.customerName}</strong>
                </div>
                <div>
                  <span className="block text-slate-400">شركة الشحن:</span>
                  <strong className="text-slate-700 dark:text-slate-200">{selectedOrder.shippingCompany || 'غير محددة'}</strong>
                </div>
                <div>
                  <span className="block text-slate-400">سعر الشحن الرئيسي:</span>
                  <strong className="text-slate-700 dark:text-slate-200">{selectedOrder.shippingFee} ج.م</strong>
                </div>
                <div>
                  <span className="block text-slate-400">إجمالي قيمة الطلب:</span>
                  <strong className="text-slate-700 dark:text-slate-200">{selectedOrder.totalPrice || selectedOrder.productPrice || 0} ج.م</strong>
                </div>
              </div>

              {/* Flex Ship Coverage Notice */}
              {!!(selectedOrder.flexShipFeePaidByCustomer || (selectedOrder.enableFlexShip && selectedOrder.flexShipFeePaidByCustomer)) && (
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl flex items-center gap-2.5 text-[11px] text-indigo-900 dark:text-indigo-200">
                  <ShieldCheck size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-black block">طلب مغطى ببرنامج فليكس شيب (Flex Ship)</span>
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-300 block mt-0.5">
                      العميل دفع رسوم فليكس شيب ({selectedOrder.flexShipFee || 150} ج.م). يتم إيداع مبلغ التعويض في المحفظة المركزية.
                    </span>
                  </div>
                </div>
              )}

              {/* Lost Shipping Expenses Section */}
              <div className="space-y-3 p-4 border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl">
                <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                  <ShieldAlert size={14} className="text-red-500" />
                  تفاصيل مصروفات الشحن المفقودة (التأمين، الضرائب والمعاينة)
                </h4>
                
                <div className="grid grid-cols-3 gap-2">
                  {/* Tax */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">الضرائب (ج.م)</label>
                    <input 
                      id="modal-shipping-tax-input"
                      type="number" 
                      placeholder="0"
                      value={modalShippingTax}
                      onChange={(e) => {
                        setModalShippingTax(e.target.value);
                        updateRecommendedAmount(e.target.value, modalShippingInsurance, modalShippingInspection);
                      }}
                      className="w-full bg-white dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-2.5 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>

                  {/* Insurance */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">التأمين (ج.م)</label>
                    <input 
                      id="modal-shipping-insurance-input"
                      type="number" 
                      placeholder="0"
                      value={modalShippingInsurance}
                      onChange={(e) => {
                        setModalShippingInsurance(e.target.value);
                        updateRecommendedAmount(modalShippingTax, e.target.value, modalShippingInspection);
                      }}
                      className="w-full bg-white dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-2.5 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>

                  {/* Inspection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">المعاينة (ج.م)</label>
                    <input 
                      id="modal-shipping-inspection-input"
                      type="number" 
                      placeholder="0"
                      value={modalShippingInspection}
                      onChange={(e) => {
                        setModalShippingInspection(e.target.value);
                        updateRecommendedAmount(modalShippingTax, modalShippingInsurance, e.target.value);
                      }}
                      className="w-full bg-white dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-2.5 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-bold flex justify-between items-center pt-1">
                  <span>إجمالي سعر الشحن والمصروفات المفقودة:</span>
                  <span className="text-red-600 dark:text-red-400">
                    {Math.round((Number(selectedOrder.shippingFee || 0) + (Number(modalShippingTax) || 0) + (Number(modalShippingInsurance) || 0) + (Number(modalShippingInspection) || 0)) * 100) / 100} ج.م
                  </span>
                </div>
              </div>

              {/* Compensation Status Selection (Segmented-style) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">تحديث حالة المطالبة بالتعويض</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'none', label: 'غير مطالب بها', color: 'border-slate-200 text-slate-700 hover:bg-slate-50' },
                    { id: 'pending', label: 'قيد المطالبة ⏳', color: 'border-amber-200 text-amber-700 hover:bg-amber-50/50' },
                    { id: 'compensated', label: 'تم التعويض 💵', color: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50/50' },
                    { id: 'rejected', label: 'تم الرفض ❌', color: 'border-rose-200 text-rose-700 hover:bg-rose-50/50' }
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      id={`modal-status-btn-${option.id}`}
                      onClick={() => setModalStatus(option.id as CompensationStatus)}
                      className={`py-2 px-3 border text-[11px] font-bold rounded-xl transition-all cursor-pointer text-center ${
                        modalStatus === option.id 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                          : option.color
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Inputs depending on compensated state */}
              {modalStatus === 'compensated' && (
                <div className="space-y-4 p-4 border border-emerald-200/60 bg-emerald-50/10 dark:bg-emerald-950/5 dark:border-emerald-900 rounded-xl animate-fadeIn">
                  
                  {/* Amount Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">مبلغ التعويض المستلم (ج.م)</label>
                    <input 
                      id="modal-comp-amount-input"
                      type="number" 
                      required
                      placeholder="أدخل مبلغ التعويض الذي استلمته من شركة الشحن..."
                      value={modalAmount}
                      onChange={(e) => setModalAmount(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  {/* Treasury Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">إيداع المبلغ المستلم في:</label>
                    <select 
                      id="modal-treasury-select"
                      required={modalRecordFinancial}
                      value={modalTreasuryAccountId}
                      onChange={(e) => setModalTreasuryAccountId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 appearance-none text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="">-- اختر حساب الخزينة أو المحفظة للإيداع --</option>
                      {wallet && (
                        <option value="central_wallet">
                          المحفظة الماليّة المركزيّة (الرصيد الأساسي) - الرصيد: {Math.round(calculateWalletLiveBalance(wallet, treasury) * 100) / 100} ج.م
                        </option>
                      )}
                      {treasury?.accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type === 'bank' ? 'بنك' : acc.type === 'wallet' ? 'محفظة' : 'خزينة'}) - الرصيد: {acc.balance} ج.م
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Toggle integration log */}
                  {modalTreasuryAccountId && (
                    <div className="flex items-center gap-2 pt-1">
                      <input 
                        id="modal-record-financial-checkbox"
                        type="checkbox"
                        checked={modalRecordFinancial}
                        onChange={(e) => setModalRecordFinancial(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-500/50"
                      />
                      <span className="text-[10px] font-bold text-slate-500">إضافة إيصال إيداع فوري تلقائياً بالخزينة المختارة</span>
                    </div>
                  )}
                </div>
              )}

              {/* Courier Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">اسم المندوب المخالف / رقم هاتفه</label>
                <div className="relative">
                  <input 
                    id="modal-courier-input"
                    type="text" 
                    placeholder="مثال: أحمد مصطفى (مندوب بوسطة الدقي)..."
                    value={modalCourierName}
                    onChange={(e) => setModalCourierName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <div className="absolute left-3 top-2.5 text-slate-400">
                    <User size={14} />
                  </div>
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">تفاصيل المخالفة وملاحظات المطالبة</label>
                <textarea 
                  id="modal-notes-textarea"
                  rows={3}
                  placeholder="سجل تفاصيل وسبب رفض المندوب لتسليم الطلب (مثال: المندوب كتب العميل لم يرد بالرغم من تواصل العميل معنا للتسليم)..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/40 text-xs border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {/* Submit Actions */}
              <div className="flex gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
                <button
                  type="submit"
                  id="modal-submit-btn"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ والمزامنة...' : 'حفظ تفاصيل المطالبة والتعويض'}
                </button>
                <button
                  type="button"
                  id="modal-cancel-btn"
                  onClick={() => setShowManageModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
