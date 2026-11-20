import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  Landmark,
  Package,
  RotateCcw,
  Search,
  Truck,
  Upload,
  Wallet
} from 'lucide-react';
import { Order } from '../types';
import {
  TwoWayCodAuditResult,
  SheetAuditRow,
  TransactionCashoutEntry
} from '../utils/codReconciliation';
import { BankConfirmationRecord } from '../utils/codStorage';

export interface OrdersLifecycleHubProps {
  storeName: string;
  orders: Order[];
  auditResult: TwoWayCodAuditResult;
  uploadedFilesCount: number;
  matchWithStoreOrders: boolean;
  bankConfirmedCashouts: Record<string, BankConfirmationRecord>;
  orderBasePath: string;
  onInspectWaybill: (trackingCode: string, cashoutId?: string) => void;
  onInspectCashout: (tx: TransactionCashoutEntry) => void;
  onUploadSheets: () => void;
  onOpenAuditWorkspace: () => void;
  onOpenWallet: () => void;
  onNotify?: (msg: string, type?: 'success' | 'error') => void;
}

type DeliveryStage = 'delivered' | 'in_transit' | 'returned' | 'pending';
type PaymentStage = 'collected_cod' | 'paid_online' | 'pending_collection' | 'uncollected';
type CashoutStage =
  | 'bank_confirmed'
  | 'transferred_pending_bank'
  | 'in_bosta_wallet'
  | 'awaiting_delivery'
  | 'no_payout_return';

interface UnifiedOrderRecord {
  id: string;
  source: 'sheet_and_store' | 'sheet_only' | 'store_only';
  orderNumber: string;
  orderId?: string;
  trackingNumber: string;
  brandName: string;
  customerName: string;
  customerPhone: string;
  city: string;
  dateStr: string;
  sortTime: number;
  deliveryStage: DeliveryStage;
  deliveryLabel: string;
  deliverySubtext: string;
  paymentStage: PaymentStage;
  paymentLabel: string;
  grossAmount: number;
  feesAmount: number;
  netAmount: number;
  cashoutStage: CashoutStage;
  cashoutLabel: string;
  cashoutId?: string;
  cashoutEntry?: TransactionCashoutEntry;
  cashoutDate?: string;
  sheetRow?: SheetAuditRow;
  matchedOrder?: Order | null;
}

const PAGE_SIZE = 30;

const formatEgp = (val: number): string => {
  const num = Number.isFinite(val) ? val : 0;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} ج.م`;
};

const parseSortTimestamp = (val?: string): number => {
  if (!val) return 0;
  const t = Date.parse(val);
  return Number.isFinite(t) ? t : 0;
};

const normalizeBrandLabel = (raw?: string, fallback?: string): string => {
  const cleaned = (raw || '').trim().replace(/\s+/g, ' ');
  if (cleaned) return cleaned;
  return (fallback || 'المتجر الرئيسي').trim();
};

const inferOrderDeliveryStage = (order: Order): { stage: DeliveryStage; label: string } => {
  const s = order.status;
  if (s === 'تم_التوصيل' || s === 'تم_توصيلها' || s === 'تم_التحصيل' || s === 'مدفوعة') {
    return { stage: 'delivered', label: 'تم التسليم' };
  }
  if (
    s === 'مرتجع' ||
    s === 'مرتجع_جزئي' ||
    s === 'فشل_التوصيل' ||
    s === 'ملغي' ||
    s === 'مرتجع_بعد_الاستلام' ||
    s === 'تمت_الاعادة_لشركة_الشحن'
  ) {
    return { stage: 'returned', label: 'مرتجع / ملغي' };
  }
  if (s === 'تم_الارسال' || s === 'قيد_الشحن' || s === 'تم_الاستبدال') {
    return { stage: 'in_transit', label: 'في الطريق للتوصيل' };
  }
  return { stage: 'pending', label: 'قيد التجهيز' };
};

const inferSheetDeliveryStage = (row: SheetAuditRow): { stage: DeliveryStage; label: string } => {
  const st = (row.sheetStatus || '').toLowerCase();
  if (
    row.category === 'not_collected_customer' ||
    st.includes('return') ||
    st.includes('cancel') ||
    st.includes('fail') ||
    st.includes('مرتجع') ||
    st.includes('ملغي') ||
    st.includes('مرفوض')
  ) {
    return { stage: 'returned', label: 'مرتجع / لم يُسلّم' };
  }
  if (
    row.category === 'in_transit_sheet' ||
    st.includes('transit') ||
    st.includes('picked') ||
    st.includes('out for delivery') ||
    st.includes('route') ||
    st.includes('pending') ||
    st.includes('created') ||
    st.includes('hub') ||
    st.includes('جاري') ||
    st.includes('قيد')
  ) {
    return { stage: 'in_transit', label: 'قيد التوصيل' };
  }
  if (
    st.includes('deliver') ||
    st.includes('تم التسليم') ||
    st.includes('تم التوصيل') ||
    row.sheetDeliveredAt ||
    row.sheetGrossAmount > 0
  ) {
    return { stage: 'delivered', label: 'تم التسليم' };
  }
  return { stage: 'pending', label: row.sheetStatus || 'قيد المتابعة' };
};

export default function OrdersLifecycleHub({
  storeName,
  orders,
  auditResult,
  uploadedFilesCount,
  matchWithStoreOrders,
  bankConfirmedCashouts,
  orderBasePath,
  onInspectWaybill,
  onInspectCashout,
  onUploadSheets,
  onOpenAuditWorkspace,
  onOpenWallet,
  onNotify
}: OrdersLifecycleHubProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | DeliveryStage>('all');
  const [cashoutFilter, setCashoutFilter] = useState<'all' | CashoutStage>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'highest_cod' | 'highest_net' | 'brand'>('newest');
  const [page, setPage] = useState(1);

  // Build lookup map for cashouts by normalized ID
  const cashoutById = useMemo(() => {
    const map = new Map<string, TransactionCashoutEntry>();
    for (const entry of auditResult.transactionsSummary.entries) {
      const key = (entry.cashoutId || '').trim().toUpperCase();
      if (key && key !== '-') {
        map.set(key, entry);
      }
    }
    return map;
  }, [auditResult.transactionsSummary.entries]);

  // Fuse uploaded sheet rows (source of truth for courier delivery + cashout) with live store orders
  const unifiedOrders = useMemo<UnifiedOrderRecord[]>(() => {
    const list: UnifiedOrderRecord[] = [];
    const seenOrderIds = new Set<string>();
    const seenTrackings = new Set<string>();

    // 1. Add all non-duplicate rows from uploaded sheets
    for (const row of auditResult.sheetRows) {
      if (row.category === 'duplicate') continue;
      if (row.matchedOrder) {
        seenOrderIds.add(row.matchedOrder.id);
      }
      const trkClean = (row.trackingKey || '').trim().toUpperCase();
      if (trkClean) seenTrackings.add(trkClean);

      const { stage: deliveryStage, label: deliveryLabel } = inferSheetDeliveryStage(row);
      const isOnlineOrFlex = Boolean(
        row.hasFlexShip ||
          (row.matchedOrder?.paymentMethod || '').toLowerCase().includes('online') ||
          (row.matchedOrder?.paymentMethod || '').toLowerCase().includes('card') ||
          (row.matchedOrder?.paymentMethod || '').toLowerCase().includes('instapay')
      );

      let paymentStage: PaymentStage = 'pending_collection';
      let paymentLabel = 'بانتظار التحصيل';
      if (deliveryStage === 'returned') {
        paymentStage = 'uncollected';
        paymentLabel = 'لم يُحصّل (مرتجع)';
      } else if (isOnlineOrFlex && row.sheetGrossAmount === 0) {
        paymentStage = 'paid_online';
        paymentLabel = row.hasFlexShip ? 'فليكس / مدفوع مسبقاً' : 'مدفوع أونلاين';
      } else if (deliveryStage === 'delivered' || row.sheetGrossAmount > 0) {
        paymentStage = 'collected_cod';
        paymentLabel = 'تم التحصيل (COD)';
      } else {
        paymentStage = 'pending_collection';
        paymentLabel = 'قيد التحصيل مع المندوب';
      }

      const cashoutKey = (row.sheetCashoutId || '').trim().toUpperCase();
      const cashoutEntry = cashoutKey ? cashoutById.get(cashoutKey) : undefined;
      const isBankConfirmed = Boolean(
        (cashoutKey && bankConfirmedCashouts[cashoutKey]) ||
          (cashoutEntry?.id && bankConfirmedCashouts[cashoutEntry.id]) ||
          row.matchedOrder?.collectionProcessed
      );

      let cashoutStage: CashoutStage = 'awaiting_delivery';
      let cashoutLabel = 'بانتظار التسليم';
      if (deliveryStage === 'returned') {
        if (cashoutKey) {
          cashoutStage = isBankConfirmed ? 'bank_confirmed' : 'transferred_pending_bank';
          cashoutLabel = isBankConfirmed ? 'سُوّيت رسومه بالبنك' : 'سُوّيت رسومه بدفعة بوسطة';
        } else {
          cashoutStage = 'no_payout_return';
          cashoutLabel = 'لا يوجد سحب (مرتجع)';
        }
      } else if (cashoutKey) {
        if (isBankConfirmed) {
          cashoutStage = 'bank_confirmed';
          cashoutLabel = 'وصل البنك (مؤكّد)';
        } else {
          cashoutStage = 'transferred_pending_bank';
          cashoutLabel = 'محوّل — بانتظار تأكيد البنك';
        }
      } else if (deliveryStage === 'delivered' || row.category === 'collected_untransferred') {
        cashoutStage = 'in_bosta_wallet';
        cashoutLabel = 'محصّل ولم يُسحب بعد';
      } else {
        cashoutStage = 'awaiting_delivery';
        cashoutLabel = 'بانتظار التسليم';
      }

      const brandName = normalizeBrandLabel(
        row.brandName ||
          row.matchedOrder?.merchantBrandName ||
          row.matchedOrder?.subSenderName ||
          row.matchedOrder?.storeName,
        storeName
      );

      const dateStr =
        row.sheetDeliveredAt ||
        row.sheetPaidAt ||
        row.sheetDate ||
        row.matchedOrder?.date ||
        row.matchedOrder?.createdAt ||
        '';

      const deliverySubtext =
        deliveryStage === 'delivered'
          ? row.sheetDeliveredAt || row.dropoffCity || 'تم التسليم للعميل'
          : deliveryStage === 'returned'
          ? row.exceptionReason || row.warehouseReturnNote || row.sheetStatus || 'مرتجع'
          : row.currentHub || row.dropoffCity || row.sheetStatus || 'مع شركة الشحن';

      list.push({
        id: `sheet_${row.id}`,
        source: row.matchedOrder ? 'sheet_and_store' : 'sheet_only',
        orderNumber: row.matchedOrder?.orderNumber || row.businessRefKey || '-',
        orderId: row.matchedOrder?.id,
        trackingNumber: row.trackingKey,
        brandName,
        customerName: row.matchedOrder?.customerName || row.customerName || 'عميل غير مسمّى',
        customerPhone: row.matchedOrder?.customerPhone || row.phoneRaw || '',
        city: row.dropoffCity || row.matchedOrder?.governorate || row.matchedOrder?.city || '',
        dateStr,
        sortTime: parseSortTimestamp(dateStr),
        deliveryStage,
        deliveryLabel,
        deliverySubtext,
        paymentStage,
        paymentLabel,
        grossAmount: row.sheetGrossAmount,
        feesAmount: row.sheetFeesAmount,
        netAmount: row.sheetNetPayout,
        cashoutStage,
        cashoutLabel,
        cashoutId: row.sheetCashoutId || undefined,
        cashoutEntry,
        cashoutDate: cashoutEntry?.date || row.sheetPaidAt,
        sheetRow: row,
        matchedOrder: row.matchedOrder
      });
    }

    // 2. Include live store orders not present in uploaded sheets (or all orders if no sheets uploaded)
    if (matchWithStoreOrders || uploadedFilesCount === 0) {
      for (const order of orders) {
        if (seenOrderIds.has(order.id)) continue;
        const trk = (order.waybillNumber || order.bostaTrackingNumber || '').trim();
        if (trk && seenTrackings.has(trk.toUpperCase())) continue;

        const { stage: deliveryStage, label: deliveryLabel } = inferOrderDeliveryStage(order);
        const gross =
          order.totalAmountOverride ??
          order.totalPrice ??
          Math.max(
            0,
            (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0)
          );
        const fees = (order.shippingFee || 0) + (order.insuranceFee || 0) + (order.codFee || 0);
        const net =
          deliveryStage === 'returned'
            ? -fees
            : order.netRevenue !== undefined
            ? order.netRevenue
            : Math.round((gross - fees) * 100) / 100;

        const isOnline =
          order.paymentStatus === 'مدفوع' &&
          (order.paymentMethod || '').toLowerCase() !== 'cod' &&
          !(order.paymentMethod || '').includes('استلام');

        let paymentStage: PaymentStage = 'pending_collection';
        let paymentLabel = 'بانتظار التحصيل';
        if (deliveryStage === 'returned' || order.paymentStatus === 'مرتجع') {
          paymentStage = 'uncollected';
          paymentLabel = 'لم يُحصّل (مرتجع)';
        } else if (isOnline) {
          paymentStage = 'paid_online';
          paymentLabel = order.paymentMethod || 'مدفوع أونلاين';
        } else if (
          order.paymentStatus === 'مدفوع' ||
          deliveryStage === 'delivered'
        ) {
          paymentStage = 'collected_cod';
          paymentLabel = 'تم التحصيل (COD)';
        }

        let cashoutStage: CashoutStage = 'awaiting_delivery';
        let cashoutLabel = 'بانتظار التسليم';
        if (deliveryStage === 'returned') {
          cashoutStage = 'no_payout_return';
          cashoutLabel = 'لا يوجد سحب (مرتجع)';
        } else if (order.collectionProcessed || order.status === 'تم_التحصيل' || order.status === 'مدفوعة') {
          cashoutStage = 'bank_confirmed';
          cashoutLabel = 'تم التحصيل بالمتجر';
        } else if (deliveryStage === 'delivered') {
          cashoutStage = 'in_bosta_wallet';
          cashoutLabel = 'محصّل — لم يُسحب بعد';
        }

        const brandName = normalizeBrandLabel(
          order.merchantBrandName || order.subSenderName || order.storeName,
          storeName
        );
        const dateStr = order.date || order.createdAt || '';

        list.push({
          id: `order_${order.id}`,
          source: 'store_only',
          orderNumber: order.orderNumber || order.id,
          orderId: order.id,
          trackingNumber: trk || '-',
          brandName,
          customerName: order.customerName || 'عميل',
          customerPhone: order.customerPhone || '',
          city: order.governorate || order.city || order.shippingArea || '',
          dateStr,
          sortTime: parseSortTimestamp(dateStr),
          deliveryStage,
          deliveryLabel,
          deliverySubtext: order.shippingCompany || order.shippingArea || 'من المتجر',
          paymentStage,
          paymentLabel,
          grossAmount: deliveryStage === 'returned' ? 0 : gross,
          feesAmount: fees,
          netAmount: net,
          cashoutStage,
          cashoutLabel,
          matchedOrder: order
        });
      }
    }

    return list;
  }, [
    auditResult.sheetRows,
    orders,
    matchWithStoreOrders,
    uploadedFilesCount,
    cashoutById,
    bankConfirmedCashouts,
    storeName
  ]);

  // Brand breakdown for the top Brand Selector
  const brandStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; delivered: number; inWallet: number; netSum: number }
    >();
    for (const item of unifiedOrders) {
      const curr = map.get(item.brandName) || {
        name: item.brandName,
        total: 0,
        delivered: 0,
        inWallet: 0,
        netSum: 0
      };
      curr.total += 1;
      if (item.deliveryStage === 'delivered') curr.delivered += 1;
      if (item.cashoutStage === 'in_bosta_wallet') curr.inWallet += 1;
      curr.netSum = Math.round((curr.netSum + item.netAmount) * 100) / 100;
      map.set(item.brandName, curr);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [unifiedOrders]);

  // Orders filtered by selected Brand ONLY (for Executive KPIs & sub-filter counters)
  const brandOrders = useMemo(() => {
    if (selectedBrand === 'all') return unifiedOrders;
    return unifiedOrders.filter(o => o.brandName === selectedBrand);
  }, [unifiedOrders, selectedBrand]);

  // Executive KPIs for the currently selected Brand
  const kpis = useMemo(() => {
    let deliveredCount = 0;
    let inTransitCount = 0;
    let returnedCount = 0;
    let pendingCount = 0;

    let totalGross = 0;
    let totalFees = 0;
    let totalNet = 0;

    let bankConfirmedNet = 0;
    let bankConfirmedCount = 0;
    let transferredPendingNet = 0;
    let transferredPendingCount = 0;
    let unwithdrawnNet = 0;
    let unwithdrawnCount = 0;
    let inTransitValue = 0;

    for (const o of brandOrders) {
      if (o.deliveryStage === 'delivered') deliveredCount += 1;
      else if (o.deliveryStage === 'in_transit') {
        inTransitCount += 1;
        inTransitValue += o.grossAmount;
      } else if (o.deliveryStage === 'returned') returnedCount += 1;
      else pendingCount += 1;

      totalGross += o.grossAmount;
      totalFees += o.feesAmount;
      totalNet += o.netAmount;

      if (o.cashoutStage === 'bank_confirmed') {
        bankConfirmedNet += o.netAmount;
        bankConfirmedCount += 1;
      } else if (o.cashoutStage === 'transferred_pending_bank') {
        transferredPendingNet += o.netAmount;
        transferredPendingCount += 1;
      } else if (o.cashoutStage === 'in_bosta_wallet') {
        unwithdrawnNet += o.netAmount;
        unwithdrawnCount += 1;
      }
    }

    const finishedTotal = deliveredCount + returnedCount;
    const deliveryRate =
      finishedTotal > 0 ? Math.round((deliveredCount / finishedTotal) * 1000) / 10 : 0;

    return {
      totalCount: brandOrders.length,
      deliveredCount,
      inTransitCount,
      returnedCount,
      pendingCount,
      deliveryRate,
      totalGross: Math.round(totalGross * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      bankConfirmedNet: Math.round(bankConfirmedNet * 100) / 100,
      bankConfirmedCount,
      transferredPendingNet: Math.round(transferredPendingNet * 100) / 100,
      transferredPendingCount,
      unwithdrawnNet: Math.round(unwithdrawnNet * 100) / 100,
      unwithdrawnCount,
      inTransitValue: Math.round(inTransitValue * 100) / 100
    };
  }, [brandOrders]);

  // Apply delivery filter, cashout filter, search & sort
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = brandOrders.filter(o => {
      if (deliveryFilter !== 'all' && o.deliveryStage !== deliveryFilter) return false;
      if (cashoutFilter !== 'all' && o.cashoutStage !== cashoutFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.trackingNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.brandName.toLowerCase().includes(q) ||
        (o.cashoutId || '').toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q)
      );
    });

    const sorted = [...rows];
    if (sortBy === 'highest_cod') {
      sorted.sort((a, b) => b.grossAmount - a.grossAmount);
    } else if (sortBy === 'highest_net') {
      sorted.sort((a, b) => b.netAmount - a.netAmount);
    } else if (sortBy === 'brand') {
      sorted.sort((a, b) => a.brandName.localeCompare(b.brandName, 'ar'));
    } else {
      sorted.sort((a, b) => b.sortTime - a.sortTime);
    }
    return sorted;
  }, [brandOrders, deliveryFilter, cashoutFilter, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, safePage]);

  const handleSelectBrand = (brand: string) => {
    setSelectedBrand(brand);
    setPage(1);
  };

  const handleExportBrandXlsx = () => {
    if (filteredOrders.length === 0) return;
    const rows = filteredOrders.map((o, idx) => ({
      '#': idx + 1,
      البراند: o.brandName,
      'رقم الأوردر': o.orderNumber,
      'رقم البوليصة': o.trackingNumber,
      العميل: o.customerName,
      الهاتف: o.customerPhone || '-',
      المحافظة: o.city || '-',
      التاريخ: o.dateStr || '-',
      'حالة التوصيل': o.deliveryLabel,
      'حالة الدفع': o.paymentLabel,
      'تحصيل COD (ج.م)': o.grossAmount,
      'مصاريف الشحن (ج.م)': o.feesAmount,
      'الصافي (ج.م)': o.netAmount,
      'حالة سحب الفلوس': o.cashoutLabel,
      'كود دفعة التحويل': o.cashoutId || '-',
      'تاريخ التحويل': o.cashoutDate || '-'
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'الأوردرات والماليات');
    const brandSlug = selectedBrand === 'all' ? 'all_brands' : selectedBrand.replace(/\s+/g, '_');
    XLSX.writeFile(wb, `orders_lifecycle_${brandSlug}.xlsx`);
    onNotify?.(`تم تصدير ${filteredOrders.length} أوردر لملف Excel بنجاح.`);
  };

  // Top 5 brands shown as direct segmented buttons; any extras placed in a clean dropdown
  const primaryBrands = brandStats.slice(0, 5);
  const overflowBrands = brandStats.slice(5);
  const isOverflowSelected =
    selectedBrand !== 'all' && !primaryBrands.some(b => b.name === selectedBrand);

  return (
    <div className="space-y-5">
      {/* 1. Brand Selection Bar — Modern, Clean, Single-Line Controls */}
      <section className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3.5">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
              متابعة الأوردرات: التوصيل · الدفع · سحب الفلوس
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              اختر البراند لعرض كل أوردراته وحالة تحصيلها وتحويل فلوسها للبنك في شاشة واحدة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onUploadSheets}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadedFilesCount > 0 ? `تحديث الشيتات (${uploadedFilesCount})` : 'رفع شيتات بوسطة'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportBrandXlsx}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        {/* Interactive Brand Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 shrink-0">
            <Building2 className="w-3.5 h-3.5" />
            <span>البراند:</span>
          </span>

          <button
            type="button"
            onClick={() => handleSelectBrand('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              selectedBrand === 'all'
                ? 'bg-[#008060] dark:bg-[#00ab84] text-white'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
            }`}
          >
            <span>كل البراندات</span>
            <span className="font-mono tabular-nums opacity-80 mr-1.5">
              ({unifiedOrders.length.toLocaleString('en-US')})
            </span>
          </button>

          {primaryBrands.map(b => {
            const active = selectedBrand === b.name;
            return (
              <button
                key={b.name}
                type="button"
                onClick={() => handleSelectBrand(b.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                <span>{b.name}</span>
                <span className="font-mono tabular-nums opacity-75 mr-1.5">
                  ({b.total.toLocaleString('en-US')})
                </span>
              </button>
            );
          })}

          {overflowBrands.length > 0 && (
            <select
              value={isOverflowSelected ? selectedBrand : ''}
              onChange={e => {
                if (e.target.value) handleSelectBrand(e.target.value);
              }}
              aria-label="اختيار براند آخر"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                isOverflowSelected
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <option value="">
                براندات أخرى ({overflowBrands.length})...
              </option>
              {overflowBrands.map(b => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.total})
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* 2. Executive 4-KPI Strip (Live for Selected Brand) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold">إجمالي الأوردرات والتوصيل</span>
            <Truck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-black text-slate-900 dark:text-white">
            {kpis.totalCount.toLocaleString('en-US')}
            <span className="text-xs font-sans font-semibold text-slate-400 mr-1.5">أوردر</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {kpis.deliveredCount} مسلّم ({kpis.deliveryRate}%)
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-600 dark:text-amber-400">{kpis.inTransitCount} في الطريق</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-600 dark:text-rose-400">{kpis.returnedCount} مرتجع</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold">تحصيل الكاش والصافي</span>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-black text-slate-900 dark:text-white">
            {formatEgp(kpis.totalNet)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>تحصيل COD: {formatEgp(kpis.totalGross)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-600 dark:text-rose-400">مصاريف: -{formatEgp(kpis.totalFees)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold">تم سحبه وتحويله للبنك</span>
            <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatEgp(kpis.bankConfirmedNet + kpis.transferredPendingNet)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              مؤكّد بالبنك: {formatEgp(kpis.bankConfirmedNet)} ({kpis.bankConfirmedCount})
            </span>
            {kpis.transferredPendingCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  بانتظار التأكيد: {formatEgp(kpis.transferredPendingNet)} ({kpis.transferredPendingCount})
                </span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold">محصّل ولم يُسحب بعد</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div
            className={`mt-2 font-mono tabular-nums text-2xl font-black ${
              kpis.unwithdrawnNet > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {formatEgp(kpis.unwithdrawnNet)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>{kpis.unwithdrawnCount} أوردر بانتظار السحب</span>
            {kpis.inTransitValue > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>في الطريق: {formatEgp(kpis.inTransitValue)}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 3. Main Unified Orders Ledger — Search, Lifecycle Filters & High-Density Table */}
      <section className="bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 overflow-hidden">
        {/* Filter & Search Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="بحث برقم الأوردر، البوليصة، اسم العميل، الهاتف، أو كود الدفعة..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#008060]/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  aria-label="ترتيب الأوردرات"
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <option value="newest">الأحدث أولاً</option>
                  <option value="highest_cod">الأعلى تحصيل (COD)</option>
                  <option value="highest_net">الأعلى صافي</option>
                  <option value="brand">ترتيب حسب البراند</option>
                </select>
              </div>

              {(deliveryFilter !== 'all' || cashoutFilter !== 'all' || searchQuery.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryFilter('all');
                    setCashoutFilter('all');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>مسح الفلاتر</span>
                </button>
              )}
            </div>
          </div>

          {/* Segmented Filters: Delivery Status & Cashout Status */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/70">
              {(
                [
                  { id: 'all', label: 'كل التوصيل' },
                  { id: 'delivered', label: `مسلّم (${kpis.deliveredCount})` },
                  { id: 'in_transit', label: `في الطريق (${kpis.inTransitCount})` },
                  { id: 'returned', label: `مرتجع (${kpis.returnedCount})` }
                ] as const
              ).map(btn => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => {
                    setDeliveryFilter(btn.id);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    deliveryFilter === btn.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/70">
              {(
                [
                  { id: 'all', label: 'كل حالات السحب' },
                  { id: 'bank_confirmed', label: `وصل البنك (${kpis.bankConfirmedCount})` },
                  {
                    id: 'transferred_pending_bank',
                    label: `محوّل بانتظار التأكيد (${kpis.transferredPendingCount})`
                  },
                  { id: 'in_bosta_wallet', label: `لم يُسحب بعد (${kpis.unwithdrawnCount})` }
                ] as const
              ).map(btn => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => {
                    setCashoutFilter(btn.id);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cashoutFilter === btn.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* High-Density Unified Orders Table */}
        {unifiedOrders.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              لا توجد أوردرات أو شيتات محمّلة بعد
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              ارفع شيتات بوسطة (Cash Cycles / Deliveries / Transactions) لظهور كل الأوردرات بحالة توصيلها ودفعها وسحب فلوسها للبنك تلقائياً.
            </p>
            <div className="pt-1 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onUploadSheets}
                className="px-4 py-2 rounded-xl bg-[#008060] hover:bg-[#006b50] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                رفع شيتات بوسطة الآن
              </button>
              <button
                type="button"
                onClick={onOpenAuditWorkspace}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                فتح التدقيق المتقدم
              </button>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
            لا توجد أوردرات تطابق البحث أو الفلاتر الحالية للبراند المحدد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-bold">الأوردر والعميل</th>
                  <th className="py-3 px-3 font-bold">حالة التوصيل</th>
                  <th className="py-3 px-3 font-bold">حالة الدفع والمبالغ</th>
                  <th className="py-3 px-3 font-bold">سحب الفلوس للبنك</th>
                  <th className="py-3 px-3 font-bold text-center">المسار</th>
                  <th className="py-3 px-4 font-bold text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedOrders.map(item => {
                  const step1Done = item.deliveryStage === 'delivered';
                  const step1Fail = item.deliveryStage === 'returned';
                  const step2Done =
                    item.paymentStage === 'collected_cod' || item.paymentStage === 'paid_online';
                  const step3Done = item.cashoutStage === 'bank_confirmed';
                  const step3Pending = item.cashoutStage === 'transferred_pending_bank';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/35 transition-colors"
                    >
                      {/* 1. Order, Waybill, Brand, Customer */}
                      <td className="py-3 px-4 align-top">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {item.orderId ? (
                            <Link
                              to={`${orderBasePath}/${item.orderId}`}
                              className="font-mono tabular-nums font-black text-slate-900 dark:text-white hover:text-[#008060] dark:hover:text-emerald-400 hover:underline"
                            >
                              #{item.orderNumber}
                            </Link>
                          ) : (
                            <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                              {item.orderNumber !== '-' ? `#${item.orderNumber}` : item.trackingNumber}
                            </span>
                          )}

                          {item.trackingNumber !== '-' && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                                ·
                              </span>
                              <button
                                type="button"
                                onClick={() => onInspectWaybill(item.trackingNumber, item.cashoutId)}
                                title="فحص البوليصة فوراً"
                                className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                {item.trackingNumber}
                              </button>
                            </>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="font-semibold truncate max-w-[170px]">
                            {item.customerName}
                          </span>
                          {item.customerPhone && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono tabular-nums text-slate-500">
                                {item.customerPhone}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-400">
                          <span className="font-bold text-slate-500 dark:text-slate-400">
                            {item.brandName}
                          </span>
                          {item.city && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{item.city}</span>
                            </>
                          )}
                          {item.dateStr && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{item.dateStr}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 2. Delivery Status */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div
                          className={`font-bold flex items-center gap-1.5 ${
                            item.deliveryStage === 'delivered'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.deliveryStage === 'returned'
                              ? 'text-rose-600 dark:text-rose-400'
                              : item.deliveryStage === 'in_transit'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {item.deliveryStage === 'delivered' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : item.deliveryStage === 'in_transit' ? (
                            <Truck className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{item.deliveryLabel}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 max-w-[165px] truncate">
                          {item.deliverySubtext}
                        </div>
                      </td>

                      {/* 3. Payment Status & Figures */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div
                          className={`font-bold ${
                            item.paymentStage === 'collected_cod'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.paymentStage === 'paid_online'
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : item.paymentStage === 'uncollected'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {item.paymentLabel}
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-mono tabular-nums text-[11px]">
                          <span className="font-black text-slate-900 dark:text-white">
                            صافي: {formatEgp(item.netAmount)}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            (COD {formatEgp(item.grossAmount)}
                            {item.feesAmount > 0 ? ` · شحن -${formatEgp(item.feesAmount)}` : ''})
                          </span>
                        </div>
                      </td>

                      {/* 4. Cashout / Bank Withdrawal Status */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div
                          className={`font-bold flex items-center gap-1.5 ${
                            item.cashoutStage === 'bank_confirmed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.cashoutStage === 'transferred_pending_bank'
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : item.cashoutStage === 'in_bosta_wallet'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.cashoutStage === 'bank_confirmed' ? (
                            <Landmark className="w-3.5 h-3.5 shrink-0" />
                          ) : item.cashoutStage === 'transferred_pending_bank' ? (
                            <Landmark className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Wallet className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{item.cashoutLabel}</span>
                        </div>

                        {item.cashoutId ? (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono tabular-nums">
                            {item.cashoutEntry ? (
                              <button
                                type="button"
                                onClick={() => onInspectCashout(item.cashoutEntry!)}
                                title="اضغط لعرض كل الأوردرات المرتبطة بهذه الدفعة"
                                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                {item.cashoutId}
                              </button>
                            ) : (
                              <span className="font-bold text-slate-600 dark:text-slate-300">
                                {item.cashoutId}
                              </span>
                            )}
                            {item.cashoutDate && (
                              <span className="text-slate-400 text-[10px]">· {item.cashoutDate}</span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-slate-400">
                            {item.cashoutStage === 'in_bosta_wallet'
                              ? 'لم يصدر كود تحويل بعد'
                              : item.cashoutStage === 'no_payout_return'
                              ? 'بضاعة مرتجعة'
                              : 'بانتظار إغلاق دورة الشحن'}
                          </div>
                        )}
                      </td>

                      {/* 5. Compact 3-Step Visual Progress Track */}
                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <div
                          className="flex flex-col items-center gap-1"
                          title="المسار: 1) التوصيل ← 2) التحصيل ← 3) السحب للبنك"
                        >
                          <div className="flex items-center gap-1 w-24">
                            <span
                              className={`h-1.5 flex-1 rounded-full ${
                                step1Done
                                  ? 'bg-emerald-500'
                                  : step1Fail
                                  ? 'bg-rose-500'
                                  : 'bg-amber-400'
                              }`}
                            />
                            <span
                              className={`h-1.5 flex-1 rounded-full ${
                                step2Done
                                  ? 'bg-emerald-500'
                                  : step1Fail
                                  ? 'bg-rose-300 dark:bg-rose-900'
                                  : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            />
                            <span
                              className={`h-1.5 flex-1 rounded-full ${
                                step3Done
                                  ? 'bg-emerald-500'
                                  : step3Pending
                                  ? 'bg-indigo-500'
                                  : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {step3Done
                              ? 'مكتمل 3/3'
                              : step3Pending
                              ? 'محوّل 2.5/3'
                              : step2Done
                              ? 'محصّل 2/3'
                              : step1Fail
                              ? 'مرتجع'
                              : 'شحن 1/3'}
                          </div>
                        </div>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {item.trackingNumber !== '-' && (
                            <button
                              type="button"
                              onClick={() => onInspectWaybill(item.trackingNumber, item.cashoutId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>فحص</span>
                            </button>
                          )}
                          {item.orderId && (
                            <Link
                              to={`${orderBasePath}/${item.orderId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-[11px] font-bold transition-opacity"
                            >
                              <span>الأوردر</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination & Quick Navigation Links */}
        {filteredOrders.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-slate-900/40">
            <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              عرض {((safePage - 1) * PAGE_SIZE + 1).toLocaleString('en-US')} –{' '}
              {Math.min(safePage * PAGE_SIZE, filteredOrders.length).toLocaleString('en-US')} من{' '}
              <strong className="text-slate-900 dark:text-white">
                {filteredOrders.length.toLocaleString('en-US')}
              </strong>{' '}
              أوردر
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenWallet}
                className="text-[11px] font-bold text-[#008060] dark:text-emerald-400 hover:underline ml-2 cursor-pointer"
              >
                فتح محفظة الصافي
              </button>
              <button
                type="button"
                onClick={onOpenAuditWorkspace}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:underline ml-3 cursor-pointer"
              >
                التدقيق المحاسبي المفصّل
              </button>

              {totalPages > 1 && (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="الصفحة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="الصفحة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
