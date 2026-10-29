import React, { useState, useMemo } from 'react';
import { Order, Settings, Treasury, MerchantSettlement, MerchantTransaction, MerchantSettlementOrderSnapshot } from '../types';
import { 
  X, Check, Calculator, Building2, Truck, FileText, CheckCircle2, 
  AlertCircle, DollarSign, Wallet, ArrowRight, Layers, ShieldCheck, ChevronDown, ChevronUp
} from 'lucide-react';
import { inAppAlert, inAppConfirm, inAppToast } from '../utils/inAppAlert';
import { calculateCodFee, calculateInsuranceFee, calculateBostaVat, getStandardShippingFee, getCompanySpecificFees, calculateOrderShippingAndFees } from '../utils/financials';

const DELIVERED_STATUSES = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل'];
const RETURN_STATUSES = [
  'مرتجع',
  'فشل_التوصيل',
  'تمت_الاعادة_لشركة_الشحن',
  'مرتجع_جزئي',
  'مرتجع_بعد_الاستلام',
  'ملغي'
];

interface BulkOrderSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderIds: string[];
  orders: Order[];
  settings: Settings;
  updateSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  treasury?: Treasury;
  setTreasury?: React.Dispatch<React.SetStateAction<Treasury | undefined>>;
  currentUser?: any;
}

export const BulkOrderSettlementModal: React.FC<BulkOrderSettlementModalProps> = ({
  isOpen,
  onClose,
  orderIds,
  orders,
  settings,
  updateSettings,
  setOrders,
  treasury,
  setTreasury,
  currentUser
}) => {
  const [flatServiceFee, setFlatServiceFee] = useState<number>(10);
  const [payoutChannel, setPayoutChannel] = useState<'ledger_only' | 'cash' | 'bank_transfer' | 'instapay' | 'mobile_wallet'>('ledger_only');
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState<string>('');
  const [saveAsStatus, setSaveAsStatus] = useState<'paid' | 'draft'>('paid');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);

  // Filter orders matching selected IDs AND NOT ALREADY SETTLED
  const targetOrders = useMemo(() => {
    return orders.filter(o => orderIds.includes(o.id) && o.settlementStatus !== 'settled');
  }, [orders, orderIds]);

  // Calculate breakdown for a single order
  const calculateOrderRowFinancials = (order: Order, serviceFeeParam: number) => {
    const isDelivered = DELIVERED_STATUSES.includes(order.status);
    const isReturn = RETURN_STATUSES.includes(order.status);
    const compFees = getCompanySpecificFees(settings, order.shippingCompany);
    const useCustom = compFees?.useCustomFees ?? false;

    // Base shipping
    const baseShippingFee = Number(order.shippingFee) > 0 ? Number(order.shippingFee) : Math.max(0, getStandardShippingFee(order, settings));

    // Insurance
    const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
    const isInsured = order.isInsured ?? true;
    const insuranceFee = isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;

    // Inspection
    const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
    const isInspectionExplicitlyCharged = (order.includeInspectionFee === true || order.allowOpenShipment === true) && order.inspectionFeePaidByCustomer !== true;
    const inspectionFee = (order.inspectionFee !== undefined && order.inspectionFee !== null && Number(order.inspectionFee) > 0 && order.inspectionFeePaidByCustomer !== true)
      ? Number(order.inspectionFee)
      : (isInspectionExplicitlyCharged ? inspectionCost : 0);

    // VAT
    const vatFee = (order.vatValue !== undefined && order.vatValue !== null && Number(order.vatValue) > 0)
      ? Number(order.vatValue)
      : calculateBostaVat({ ...order, shippingFee: baseShippingFee }, insuranceFee, settings);

    // COD
    const codFee = isDelivered && order.status !== 'مدفوعة' ? calculateCodFee(order, settings) : 0;

    // Total carrier shipping & expenses
    const totalCarrierExpenses = Math.round((baseShippingFee + insuranceFee + inspectionFee + vatFee + codFee) * 100) / 100;

    // Goods cost
    const goodsCost = order.merchantItemCost || (order.items || []).reduce((sum, item) => sum + ((item.cost || 0) * (item.quantity || 1)), 0);

    // Service fee: 10 EGP default on delivered (منع الخصم المزدوج إذا كان الأوردر مشمولاً بالباقة أو مخصوماً مسبقاً)
    const isCoveredByPlanOrPrepaid = Boolean(
      (order as any).quotaIncludedOrder || 
      (order as any).isQuotaCovered ||
      (order as any).managerFeeDeducted
    );
    const serviceFee = isDelivered && !isCoveredByPlanOrPrepaid ? (order.serviceFeePerOrder !== undefined ? order.serviceFeePerOrder : serviceFeeParam) : 0;

    // Revenue collected
    const collected = isDelivered ? (Number(order.totalAmountOverride || order.totalPrice) || 0) : 0;

    // Net payout: collected - deductions (for fixed_fee mode default)
    const deductions = totalCarrierExpenses + serviceFee;
    const netPayout = isDelivered ? (collected - deductions) : (-deductions);

    return {
      isDelivered,
      isReturn,
      baseShippingFee,
      insuranceFee,
      inspectionFee,
      vatFee,
      codFee,
      totalCarrierExpenses,
      goodsCost,
      serviceFee,
      collected,
      deductions,
      netPayout
    };
  };

  // Group orders by merchant
  const groupedByMerchant = useMemo(() => {
    const map = new Map<string, { merchantId: string; merchantName: string; orders: Order[]; totalNetPayout: number; totalCollected: number; totalCarrierFees: number; totalServiceFees: number; totalGoodsCost: number }>();

    targetOrders.forEach(o => {
      const mId = (o.merchantId || '').trim();
      const mName = (o.merchantName || '').trim() || 'موكل عام / بدون موكل محدد';
      const key = mId || mName;

      if (!map.has(key)) {
        map.set(key, {
          merchantId: mId,
          merchantName: mName,
          orders: [],
          totalNetPayout: 0,
          totalCollected: 0,
          totalCarrierFees: 0,
          totalServiceFees: 0,
          totalGoodsCost: 0
        });
      }

      const group = map.get(key)!;
      group.orders.push(o);

      const calc = calculateOrderRowFinancials(o, flatServiceFee);
      group.totalNetPayout += calc.netPayout;
      group.totalCollected += calc.collected;
      group.totalCarrierFees += calc.totalCarrierExpenses;
      group.totalServiceFees += calc.serviceFee;
      group.totalGoodsCost += calc.goodsCost;
    });

    return Array.from(map.values());
  }, [targetOrders, flatServiceFee, settings]);

  const grandTotals = useMemo(() => {
    return groupedByMerchant.reduce((acc, g) => ({
      ordersCount: acc.ordersCount + g.orders.length,
      totalNetPayout: acc.totalNetPayout + g.totalNetPayout,
      totalCollected: acc.totalCollected + g.totalCollected,
      totalCarrierFees: acc.totalCarrierFees + g.totalCarrierFees,
      totalServiceFees: acc.totalServiceFees + g.totalServiceFees,
    }), { ordersCount: 0, totalNetPayout: 0, totalCollected: 0, totalCarrierFees: 0, totalServiceFees: 0 });
  }, [groupedByMerchant]);

  if (!isOpen) return null;

  // Execute Bulk Settlement
  const handleExecuteBulkSettlement = async () => {
    if (targetOrders.length === 0) {
      await inAppAlert('لا توجد أوردرات محددة للتسوية.', { title: 'تنبيه', type: 'warning' });
      return;
    }

    const confirmMsg = `هل ترغب في اعتماد تسوية مجمعة لعدد (${grandTotals.ordersCount}) أوردر موزعة على (${groupedByMerchant.length}) موكل؟ إجمالي صافي المستحق: ${grandTotals.totalNetPayout.toLocaleString()} ج.م`;
    const confirmed = await inAppConfirm(confirmMsg, {
      title: 'تأكيد التسوية المجمعة',
      confirmText: 'نعم، اعتماد التسويات دفعة واحدة',
      cancelText: 'تراجع',
      type: 'info'
    });
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const now = new Date().toISOString();
      const newSettlements: MerchantSettlement[] = [];
      const updatedOrdersMap = new Map<string, { settlementId: string }>();
      const newLedgerTransactions: MerchantTransaction[] = [];
      const supplierBalanceAdditions = new Map<string, number>();

      for (const group of groupedByMerchant) {
        const settlementId = `SETTLE-BULK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const settlementNumber = `SETTLE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const orderSnapshots: MerchantSettlementOrderSnapshot[] = group.orders.map(o => {
          const c = calculateOrderRowFinancials(o, flatServiceFee);
          return {
            orderId: o.id,
            orderNumber: o.orderNumber || o.id,
            date: o.date,
            customerName: o.customerName || 'عميل',
            status: o.status,
            shippingCompany: o.shippingCompany,
            accountingMode: 'fixed_fee',
            mode: 'fixed_fee',
            sharePercent: 0,
            goodsCost: c.goodsCost,
            merchantGoodsCost: c.goodsCost,
            shippingFee: c.baseShippingFee,
            officialShippingFee: c.baseShippingFee,
            customerPaidShipping: c.baseShippingFee,
            shippingDiscountDifference: 0,
            insuranceFee: c.insuranceFee,
            vatFee: c.vatFee,
            inspectionFee: c.inspectionFee,
            codFee: c.codFee,
            collectionFee: c.codFee,
            carrierAdditionalFees: c.insuranceFee + c.vatFee + c.inspectionFee,
            totalShippingAndCarrierFees: c.totalCarrierExpenses,
            serviceFee: c.serviceFee,
            marketingFee: 0,
            marketingCost: 0,
            returnFee: 0,
            returnLoss: 0,
            collectedRevenue: c.collected,
            collectedAmount: c.collected,
            netPayoutToMerchant: c.netPayout,
            netMerchantAmount: c.netPayout,
            operatorEarnings: c.serviceFee
          };
        });

        const newSettlement: MerchantSettlement = {
          id: settlementId,
          settlementNumber,
          merchantId: group.merchantId || group.merchantName,
          merchantName: group.merchantName,
          date: now,
          ordersCount: group.orders.length,
          totalCollected: group.totalCollected,
          totalMerchantGoodsCost: group.totalGoodsCost,
          totalServiceFees: group.totalServiceFees,
          totalShippingCosts: group.totalCarrierFees,
          totalMarketingCosts: 0,
          totalReturnFees: 0,
          totalCollectionFees: 0,
          netPayoutToMerchant: Math.round(group.totalNetPayout * 100) / 100,
          status: saveAsStatus,
          paidFromTreasuryAccountId: saveAsStatus === 'paid' && payoutChannel !== 'ledger_only' ? selectedTreasuryAccountId || undefined : undefined,
          paidFromTreasuryAccountName: payoutChannel === 'ledger_only' ? 'تسوية دفترية' : undefined,
          notes: `تسوية مجمعة للأوردرات (${group.orders.length} أوردر) - طريقة الصرف: ${payoutChannel === 'ledger_only' ? 'تسوية دفترية' : payoutChannel}`,
          performedBy: currentUser?.fullName || 'الإدارة',
          orderSnapshots
        };

        newSettlements.push(newSettlement);

        // Mark orders with settlementId
        group.orders.forEach(o => {
          updatedOrdersMap.set(o.id, { settlementId });
        });

        // Add to supplier balance and ledger if paid
        if (saveAsStatus === 'paid' && group.merchantId) {
          supplierBalanceAdditions.set(group.merchantId, (supplierBalanceAdditions.get(group.merchantId) || 0) + newSettlement.netPayoutToMerchant);

          const dateStr = new Date(now).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });

          // 1. Gross Revenue Credit (+): دورات المبالغ المجمعة
          newLedgerTransactions.push({
            id: String(Math.floor(1000000000 + Math.random() * 9000000000)),
            merchantId: group.merchantId,
            merchantName: group.merchantName,
            date: now,
            type: 'order_delivered',
            amount: group.totalCollected,
            balanceAfter: 0, // computed during balance update
            notes: `مقابل ${group.orders.length} شحنة تم إضافتها في ${dateStr}`,
            referenceId: settlementId,
            performedBy: currentUser?.fullName || 'الإدارة'
          });

          // 2. Shipping Fees Deduction (-): مصاريف بوسطة
          if (group.totalCarrierFees > 0) {
            newLedgerTransactions.push({
              id: String(Math.floor(1000000000 + Math.random() * 9000000000)),
              merchantId: group.merchantId,
              merchantName: group.merchantName,
              date: new Date(Date.now() + 10).toISOString(),
              type: 'carrier_fee',
              amount: -group.totalCarrierFees,
              balanceAfter: 0, // computed during balance update
              notes: `خصم مصاريف الشحن ورسوم الشحنات (${group.orders.length} أوردر)`,
              referenceId: settlementId,
              performedBy: currentUser?.fullName || 'الإدارة'
            });
          }

          // 3. Service / Manager Order Fee Deduction (-): رسوم المدير المخصص والخدمة
          if (group.totalServiceFees > 0) {
            newLedgerTransactions.push({
              id: String(Math.floor(1000000000 + Math.random() * 9000000000)),
              merchantId: group.merchantId,
              merchantName: group.merchantName,
              date: new Date(Date.now() + 20).toISOString(),
              type: 'manager_order_fee',
              amount: -group.totalServiceFees,
              balanceAfter: 0, // computed during balance update
              notes: `خصم رسوم تشغيل المدير المخصص وعمولة الخدمة (${group.orders.length} أوردر)`,
              referenceId: settlementId,
              performedBy: currentUser?.fullName || 'الإدارة'
            });
          }
        }
      }

      // 1. Update Orders
      if (saveAsStatus === 'paid') {
        setOrders(prevOrders => prevOrders.map(o => {
          const match = updatedOrdersMap.get(o.id);
          if (match) {
            return {
              ...o,
              settlementStatus: 'settled',
              settlementId: match.settlementId
            };
          }
          return o;
        }));
      }

      // 2. Update Settings (Suppliers balances + Settlements + Ledger)
      updateSettings(currSettings => {
        const updateList = (list: any[]) => (list || []).map(s => {
          const addition = supplierBalanceAdditions.get(s.id);
          if (addition !== undefined && saveAsStatus === 'paid') {
            const currentBal = Number(s.balance) || 0;
            const newBal = Number((currentBal + addition).toFixed(2));
            const txsForThisSupplier = newLedgerTransactions
              .filter(tx => tx.merchantId === s.id)
              .map(tx => ({ ...tx, balanceAfter: newBal }));

            return {
              ...s,
              balance: newBal,
              transactions: [...txsForThisSupplier, ...(s.transactions || [])]
            };
          }
          return s;
        });

        const updatedSuppliers = updateList(currSettings.suppliers || []);
        const updatedPartners = updateList(currSettings.partners || []);

        return {
          ...currSettings,
          suppliers: updatedSuppliers,
          partners: updatedPartners,
          merchantTransactions: [...newLedgerTransactions, ...(currSettings.merchantTransactions || [])],
          merchantSettlements: [...newSettlements, ...(currSettings.merchantSettlements || [])]
        };
      });

      inAppToast(`تم اعتماد التسوية المجمعة لـ (${grandTotals.ordersCount}) أوردر بنجاح! 🚀`, 'success', 5000);
      onClose();
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء إجراء التسوية: ' + (err.message || ''), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir="rtl">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Calculator size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>تسوية الأوردرات المحددة دفعة واحدة 💼</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black">
                  {grandTotals.ordersCount} أوردر
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                تصفية مستحقات الموكلين واحتساب الشحن، الضرائب، التأمين وعمولة الخدمة بدقة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Global Configuration Strip */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Service Fee Input */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
              عمولة الخدمة للطلب المسلم (ج.م)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={flatServiceFee}
                onChange={e => setFlatServiceFee(Number(e.target.value) || 0)}
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs text-center font-mono outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute left-3 top-2.5 text-[10px] text-slate-400 font-bold">ج.م</span>
            </div>
          </div>

          {/* Payout Channel */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
              طريقة الترحيل والصرف
            </label>
            <select
              value={payoutChannel}
              onChange={e => setPayoutChannel(e.target.value as any)}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ledger_only">تسوية دفترية فقط (زيادة رصيد المحفظة)</option>
              <option value="cash">نقداً من الخزينة</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="instapay">إنستاباي (InstaPay)</option>
              <option value="mobile_wallet">محفظة إلكترونية</option>
            </select>
          </div>

          {/* Status (Paid vs Draft) */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
              نوع الإجراء
            </label>
            <select
              value={saveAsStatus}
              onChange={e => setSaveAsStatus(e.target.value as any)}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="paid">اعتماد وترحيل مالي فوري (تحديث الرصيد وقفل الأوردرات)</option>
              <option value="draft">حفظ كمسودة للمراجعة (لا يغير الأرصدة)</option>
            </select>
          </div>
        </div>

        {/* Financial Formula Callout */}
        <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-mono">معادلة الخصم المعتمدة:</span>
            <span>صافي المستحق = التحصيل - (مصاريف الشحن + 14% ضريبة + التأمين + رسوم التحصيل COD + عمولة الخدمة)</span>
          </div>
          <div className="font-mono text-emerald-700 dark:text-emerald-300 font-black">
            مثال: 105 شحن + 14.88 ضريبة + 7 تأمين + 17.76 COD + 10 عمولة = 154.64 ج.م
          </div>
        </div>

        {/* Content: Groups List */}
        <div className="p-5 max-h-[50vh] overflow-y-auto space-y-4">
          {groupedByMerchant.map(group => {
            const isExpanded = expandedMerchant === group.merchantName;
            return (
              <div 
                key={group.merchantName} 
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
              >
                {/* Group Summary Row */}
                <div 
                  onClick={() => setExpandedMerchant(isExpanded ? null : group.merchantName)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 dark:text-white">
                          {group.merchantName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {group.orders.length} أوردر
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        تحصيل: {group.totalCollected.toLocaleString()} ج.م · شحن ورسوم: {group.totalCarrierFees.toLocaleString()} ج.م · عمولات: {group.totalServiceFees.toLocaleString()} ج.م
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="text-[10px] text-slate-400 font-bold">صافي مستحق الموكل</div>
                      <div className={`text-base font-black font-mono ${group.totalNetPayout >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {group.totalNetPayout.toLocaleString()} ج.م
                      </div>
                    </div>
                    <button type="button" className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Orders Table */}
                {isExpanded && (
                  <div className="p-3 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black">
                        <tr>
                          <th className="p-2.5">رقم الطلب والعميل</th>
                          <th className="p-2.5 text-center">الحالة</th>
                          <th className="p-2.5 text-center">التحصيل</th>
                          <th className="p-2.5 text-center">مصاريف الشحن والرسوم</th>
                          <th className="p-2.5 text-center">عمولة الخدمة</th>
                          <th className="p-2.5 text-center">الصافي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                        {group.orders.map(o => {
                          const calc = calculateOrderRowFinancials(o, flatServiceFee);
                          return (
                            <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="p-2.5">
                                <span className="font-mono text-indigo-600 font-black">#{o.orderNumber || o.id.slice(0, 8)}</span>
                                <span className="mr-2 text-slate-800 dark:text-slate-200">{o.customerName}</span>
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`text-[11px] font-black ${calc.isDelivered ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {o.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono">{calc.collected.toLocaleString()} ج.م</td>
                              <td className="p-2.5 text-center font-mono text-slate-600" title={`شحن: ${calc.baseShippingFee} + تأمين: ${calc.insuranceFee} + ضريبة: ${calc.vatFee} + COD: ${calc.codFee}`}>
                                {calc.totalCarrierExpenses.toLocaleString()} ج.م
                              </td>
                              <td className="p-2.5 text-center font-mono text-amber-600">{calc.serviceFee.toLocaleString()} ج.م</td>
                              <td className={`p-2.5 text-center font-mono font-black ${calc.netPayout >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {calc.netPayout.toLocaleString()} ج.م
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer / Grand Total and Action Buttons */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
          <div className="flex items-center gap-4 text-center sm:text-right">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block">إجمالي التحصيل</span>
              <span className="text-sm font-black font-mono text-slate-200">{grandTotals.totalCollected.toLocaleString()} ج.م</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[11px] text-slate-400 font-bold block">إجمالي الشحن والعمولات</span>
              <span className="text-sm font-black font-mono text-rose-400">
                {(grandTotals.totalCarrierFees + grandTotals.totalServiceFees).toLocaleString()} ج.م
              </span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[11px] text-emerald-400 font-bold block">صافي إجمالي المستحقات</span>
              <span className="text-lg font-black font-mono text-emerald-400">{grandTotals.totalNetPayout.toLocaleString()} ج.م</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleExecuteBulkSettlement}
              disabled={isProcessing || grandTotals.ordersCount === 0}
              className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>
                {isProcessing ? 'جاري تنفيذ التسوية...' : `تأكيد واعتماد تسوية (${grandTotals.ordersCount}) أوردر 🚀`}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
