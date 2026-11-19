import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  Filter,
  Landmark,
  Layers,
  Link2,
  MessageSquare,
  Package,
  Pencil,
  Power,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Truck,
  Unlink,
  Upload,
  UserX,
  Wallet,
  X,
  XCircle
} from 'lucide-react';
import {
  CodSettlementBatch,
  CodSheetAmountMode,
  CodSheetColumnProfile,
  Order,
  Settings,
  TreasuryAccount
} from '../types';
import {
  autoDetectSheetMapping,
  BOSTA_PACKAGE_SIZE_META,
  BOSTA_SERVICE_TYPE_META,
  BOSTA_ZONE_META,
  BostaPackageSizeId,
  BostaRateMatrix,
  BostaServiceTypeId,
  BostaZoneId,
  buildWhatsappClaimMessage,
  ColumnMappingConfig,
  DEFAULT_BOSTA_RATE_MATRIX,
  DEFAULT_ZONE_RATE_CONFIG,
  exportCodClaimWorkbook,
  InternalFraudCategory,
  parseExcelOrCsvFiles,
  runTwoWayCodAudit,
  SheetAuditRow,
  TransactionCashoutEntry,
  UploadedSheetFile,
  UploadedSheetRole,
  ZoneRateConfig
} from '../utils/codReconciliation';
import {
  BankConfirmationRecord,
  clearCodHunterFiles,
  loadCodHunterState,
  saveCodHunterState
} from '../utils/codStorage';

export interface CodHunterWorkspaceProps {
  storeId: string;
  storeName: string;
  orders: Order[];
  settings: Settings;
  treasuryAccounts?: TreasuryAccount[];
  allowBatchSettlement?: boolean;
  isDark?: boolean;
  showBackToDashboard?: boolean;
  orderDetailBasePath?: string;
  onSaveCarrierProfile?: (profileKey: string, profile: CodSheetColumnProfile, graceDays: number) => void;
  onUpdateGraceDays?: (graceDays: number) => void;
  onSettleBatch?: (params: {
    batchNumber: string;
    notes: string;
    treasuryAccountId: string;
    selectedRows: SheetAuditRow[];
    carrierFilter: string;
    fileNames: string[];
    amountMode: CodSheetAmountMode;
    totalSheetRows: number;
    totalSheetNet: number;
    totalExpectedNet: number;
    totalDiscrepancy: number;
  }) => void;
  onReverseBatch?: (batch: CodSettlementBatch) => void;
  onOpenOrder?: (order: Order) => void;
  onNotify?: (msg: string, type?: 'success' | 'error') => void;
}

type AuditTabId =
  | 'untransferred'
  | 'uncollected'
  | 'discrepancy'
  | 'not_collected'
  | 'missing_comp'
  | 'fee_anomalies'
  | 'fraud_alerts'
  | 'zero_attempt_returns'
  | 'customer_risk'
  | 'exchange_audits'
  | 'stuck_returns'
  | 'online_flex'
  | 'in_transit_sheet'
  | 'overdue'
  | 'matched'
  | 'transactions_ledger'
  | 'compensations'
  | 'pickup_requests'
  | 'bosta_credits'
  | 'duplicate'
  | 'not_found'
  | 'batches';

const ROLE_LABELS: Record<UploadedSheetRole, string> = {
  cash_cycles: 'Cash Cycles (دورات التحصيل)',
  bosta_orders: 'أوردرات بوسطة / الشحن',
  transactions: 'Transactions (حركة الحساب)',
  compensations: 'جدول التعويضات (Compensations)',
  pickup_requests: 'طلبات البيك أب (Pickup Requests)',
  bosta_credits: 'محفظة رصيد بوسطة (Bosta Credits)',
  warehouse_orders: 'أوردرات المستودع (خارجي)'
};

const formatEgp = (val: number): string => {
  const num = Number.isFinite(val) ? val : 0;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م`;
};

const formatDateShort = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9'
};

function normalizeDigitsOnlyText(raw: string): string {
  return raw.replace(/[٠-٩]/g, ch => ARABIC_DIGITS_MAP[ch] ?? ch);
}

/**
 * Parses copied rows from Bosta Points Wallet UI ("قائمة المعاملات" / Customer Care Voucher)
 * Supports multi-line table copies, TSV, CSV, or "txId -> tracking" pairs while ignoring
 * decimal amounts (e.g. 102.60) and timestamps (e.g. 08:02).
 */
function parseBostaCreditsUiPaste(
  rawText: string,
  knownVoucherTxIds?: Set<string>
): Array<{ transactionId: string; trackingNumber: string }> {
  const clean = normalizeDigitsOnlyText(rawText || '').trim();
  if (!clean) return [];

  const resultMap = new Map<string, string>();

  // 1) Fast path: explicit line pairs "2038811 -> 8500877172" or tab/comma/dash separated
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const explicit = line.match(
      /^[^\d]*(\d{6,9})\s*(?:->|=>|:|,|\t|\||-|↔)\s*(\d{8,14})(?!\.\d)/
    );
    if (explicit) {
      const txId = explicit[1];
      const tracking = explicit[2];
      if (txId !== tracking) {
        resultMap.set(txId, tracking);
      }
    }
  }

  // 2) Structured UI block / table scan:
  // Remove decimal currency numbers (e.g. 102.60, 718.20, 555.00-) and HH:MM timestamps
  const sanitized = clean
    .replace(/\d+[.,]\d{1,3}-?/g, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ');

  const tokenRegex = /\b\d{6,14}\b/g;
  const tokens: Array<{ val: string; idx: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(sanitized)) !== null) {
    tokens.push({ val: match[0], idx: match.index });
  }

  for (let i = 0; i < tokens.length; i++) {
    const curr = tokens[i];
    const isKnownTx = knownVoucherTxIds ? knownVoucherTxIds.has(curr.val) : false;
    const looksLikeTxId =
      knownVoucherTxIds && knownVoucherTxIds.size > 0
        ? isKnownTx
        : curr.val.length >= 6 && curr.val.length <= 8;
    if (!looksLikeTxId) continue;
    if (resultMap.has(curr.val)) continue;

    // Look ahead for the closest tracking number (8..14 digits, not another known txId)
    for (let j = i + 1; j < Math.min(i + 5, tokens.length); j++) {
      const candidate = tokens[j];
      if (candidate.idx - curr.idx > 260) break;
      if (knownVoucherTxIds && knownVoucherTxIds.has(candidate.val)) break;
      if (candidate.val === curr.val) continue;
      if (candidate.val.length >= 8 && candidate.val.length <= 14) {
        resultMap.set(curr.val, candidate.val);
        break;
      }
    }
  }

  return Array.from(resultMap.entries()).map(([transactionId, trackingNumber]) => ({
    transactionId,
    trackingNumber
  }));
}

export default function CodHunterWorkspace({
  storeId,
  storeName,
  orders,
  settings,
  treasuryAccounts = [],
  allowBatchSettlement = true,
  isDark = false,
  showBackToDashboard = true,
  orderDetailBasePath,
  onSaveCarrierProfile,
  onUpdateGraceDays,
  onSettleBatch,
  onReverseBatch,
  onOpenOrder,
  onNotify
}: CodHunterWorkspaceProps) {
  const savedProfiles = settings?.codCarrierColumnProfiles || {};
  const savedBatches = useMemo(
    () =>
      [...(settings?.codReconciliationBatches || [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [settings?.codReconciliationBatches]
  );

  // Upload & files state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedSheetFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // ON / OFF Toggle Switch: match against live store orders vs uploaded sheets only
  const [matchWithStoreOrders, setMatchWithStoreOrders] = useState<boolean>(true);
  // Radar #5 ON / OFF Toggle Switch + Comparison Source (Unified Inventory / Hybrid / Sheet Median)
  const [enableProductPriceAudit, setEnableProductPriceAudit] = useState<boolean>(true);
  const [productPriceAuditSource, setProductPriceAuditSource] = useState<
    'hybrid' | 'inventory_only' | 'sheet_median'
  >('hybrid');

  // Configuration & mapping state
  const [carrierFilter, setCarrierFilter] = useState<string>('all');
  const [sheetBrandFilter, setSheetBrandFilter] = useState<string>('all');
  const [graceDays, setGraceDays] = useState<number>(settings?.codExpectedPayoutGraceDays ?? 5);
  const [toleranceEgp, setToleranceEgp] = useState<number>(2);
  const [maxExpectedShippingFee, setMaxExpectedShippingFee] = useState<number>(110);
  const [zoneRates, setZoneRates] = useState<ZoneRateConfig>(DEFAULT_ZONE_RATE_CONFIG);
  const [activeRatePlanZone, setActiveRatePlanZone] = useState<BostaZoneId>('cairo_giza');
  const [showMappingDrawer, setShowMappingDrawer] = useState(false);

  const [mapping, setMapping] = useState<ColumnMappingConfig>({
    amountMode: 'gross_and_fees',
    trackingCol: '',
    netAmountCol: '',
    grossAmountCol: '',
    feesAmountCol: '',
    codFeeCol: '',
    statusCol: '',
    phoneCol: '',
    dateCol: '',
    paymentStatusCol: '',
    cashoutIdCol: '',
    deliveredAtCol: '',
    businessRefCol: ''
  });

  // Audit workspace navigation & filters
  const [activeTab, setActiveTab] = useState<AuditTabId>('untransferred');
  const [searchQuery, setSearchQuery] = useState('');
  const [delayFilterDays, setDelayFilterDays] = useState<'all' | '3' | '7' | '14'>('all');
  const [fraudTypeFilter, setFraudTypeFilter] = useState<'all' | InternalFraudCategory>('all');
  const [feeAnomalyFilter, setFeeAnomalyFilter] = useState<
    | 'all'
    | 'rate_size'
    | 'returned_insurance'
    | 'untouched_opening'
    | 'forbidden_open_fee'
    | 'zero_cod_delivered'
  >('all');
  const [returnWarehouseFilter, setReturnWarehouseFilter] = useState<
    'all' | 'returned_to_merchant' | 'not_returned_yet' | 'stock_mismatch'
  >('all');
  const [showSlaDelayedTable, setShowSlaDelayedTable] = useState(false);
  const [showDeliverySlaTable, setShowDeliverySlaTable] = useState(false);
  const [collapsedSwapIds, setCollapsedSwapIds] = useState<Set<string>>(new Set());
  const [txCategoryFilter, setTxCategoryFilter] = useState<
    'all' | 'cashout_fees' | 'compensations' | 'packing_pickup' | 'cycles'
  >('all');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Modals & action states
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [batchNumberInput, setBatchNumberInput] = useState('');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [batchNotes, setBatchNotes] = useState('');
  const [isSettling, setIsSettling] = useState(false);
  const [batchToReverse, setBatchToReverse] = useState<CodSettlementBatch | null>(null);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  // Manual row-to-order linking & unlinked Transactions cashout assignment & Bank confirm checklist
  const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
  const [manualCreditTrackingMap, setManualCreditTrackingMap] = useState<Record<string, string>>({});
  const [showCreditsPasteBox, setShowCreditsPasteBox] = useState(false);
  const [creditsPasteText, setCreditsPasteText] = useState('');
  const [editingCreditTxId, setEditingCreditTxId] = useState<string | null>(null);
  const [editingCreditTrackingInput, setEditingCreditTrackingInput] = useState('');
  const [bankConfirmedCashouts, setBankConfirmedCashouts] = useState<
    Record<string, BankConfirmationRecord>
  >({});
  const hasHydratedStorageRef = useRef(false);
  const [manualLinkRow, setManualLinkRow] = useState<SheetAuditRow | null>(null);
  const [manualOrderSearch, setManualOrderSearch] = useState('');
  const [activeLinkedCashoutId, setActiveLinkedCashoutId] = useState('');
  const [inspectedCashout, setInspectedCashout] = useState<TransactionCashoutEntry | null>(null);

  // Internal fallback toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
    if (onNotify) onNotify(msg, type);
  };

  useEffect(() => {
    if (typeof settings?.codExpectedPayoutGraceDays === 'number') {
      setGraceDays(settings.codExpectedPayoutGraceDays);
    }
  }, [settings?.codExpectedPayoutGraceDays]);

  // Hydrate persisted uploaded sheets, bank confirmations & settings per store from IndexedDB
  useEffect(() => {
    let cancelled = false;
    hasHydratedStorageRef.current = false;

    loadCodHunterState(storeId)
      .then(saved => {
        if (cancelled) return;
        if (saved) {
          if (Array.isArray(saved.uploadedFiles) && saved.uploadedFiles.length > 0) {
            setUploadedFiles(saved.uploadedFiles);
            setActiveTab(prev =>
              prev === 'uncollected' ? 'untransferred' : prev
            );
          } else {
            setUploadedFiles([]);
            setActiveTab(prev =>
              prev === 'untransferred' && matchWithStoreOrders ? 'uncollected' : prev
            );
          }
          setBankConfirmedCashouts(saved.bankConfirmedCashouts || {});
          setManualMatches(saved.manualMatches || {});
          setManualCreditTrackingMap(saved.manualCreditTrackingMap || {});
          setMaxExpectedShippingFee(
            typeof saved.maxExpectedShippingFee === 'number' ? saved.maxExpectedShippingFee : 110
          );
          if (saved.zoneRates) {
            setZoneRates({ ...DEFAULT_ZONE_RATE_CONFIG, ...saved.zoneRates });
          } else {
            setZoneRates(DEFAULT_ZONE_RATE_CONFIG);
          }
          if (typeof saved.matchWithStoreOrders === 'boolean') {
            setMatchWithStoreOrders(saved.matchWithStoreOrders);
          }
          if (typeof saved.enableProductPriceAudit === 'boolean') {
            setEnableProductPriceAudit(saved.enableProductPriceAudit);
          }
          if (saved.productPriceAuditSource) {
            setProductPriceAuditSource(saved.productPriceAuditSource);
          }
          setSheetBrandFilter(saved.sheetBrandFilter || 'all');
        } else if (matchWithStoreOrders) {
          setActiveTab('uncollected');
        }
      })
      .finally(() => {
        if (!cancelled) {
          hasHydratedStorageRef.current = true;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  // Debounced auto-save to IndexedDB whenever files, bank confirmations, or preferences change
  useEffect(() => {
    if (!hasHydratedStorageRef.current || !storeId) return;
    const timer = window.setTimeout(() => {
      saveCodHunterState({
        storeId,
        uploadedFiles,
        bankConfirmedCashouts,
        manualMatches,
        manualCreditTrackingMap,
        maxExpectedShippingFee: Math.max(0, Number(maxExpectedShippingFee) || 110),
        zoneRates,
        matchWithStoreOrders,
        enableProductPriceAudit,
        productPriceAuditSource,
        sheetBrandFilter,
        updatedAt: new Date().toISOString()
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    storeId,
    uploadedFiles,
    bankConfirmedCashouts,
    manualMatches,
    manualCreditTrackingMap,
    maxExpectedShippingFee,
    zoneRates,
    matchWithStoreOrders,
    enableProductPriceAudit,
    productPriceAuditSource,
    sheetBrandFilter
  ]);

  const toggleBankConfirm = (tx: TransactionCashoutEntry) => {
    const key = tx.cashoutId && tx.cashoutId !== '-' ? tx.cashoutId : tx.id;
    setBankConfirmedCashouts(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
        notify(`تم إلغاء تأكيد دخول البنك للدفعة ${key}.`);
      } else {
        next[key] = {
          cashoutId: key,
          confirmedAt: new Date().toISOString(),
          amount: tx.cashoutAmount
        };
        notify(`تم تأكيد وصول الدفعة ${key} (${formatEgp(tx.cashoutAmount)}) لحسابك البنكي.`);
      }
      return next;
    });
  };

  // Merge headers from primary shipment sheets (exclude ledger/pickup/credits sheets unless no primary sheet exists)
  const allHeaders = useMemo(() => {
    const set = new Set<string>();
    const primarySheets = uploadedFiles.filter(
      f =>
        f.role !== 'transactions' &&
        f.role !== 'compensations' &&
        f.role !== 'pickup_requests' &&
        f.role !== 'bosta_credits'
    );
    const source = primarySheets.length > 0 ? primarySheets : uploadedFiles;
    source.forEach(f => f.headers.forEach(h => set.add(h)));
    return Array.from(set);
  }, [uploadedFiles]);

  const availableCarriers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.shippingCompany && o.shippingCompany !== 'كاشير - بيع مباشر') {
        set.add(o.shippingCompany);
      }
    });
    Object.values(savedProfiles).forEach(p => {
      if (p.carrierName && p.carrierName !== 'all') set.add(p.carrierName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [orders, savedProfiles]);

  useEffect(() => {
    if (allHeaders.length === 0) return;
    const profileKey = carrierFilter === 'all' ? '__default__' : carrierFilter;
    const saved = savedProfiles[profileKey] || savedProfiles['__default__'];
    setMapping(autoDetectSheetMapping(allHeaders, saved));
  }, [allHeaders, carrierFilter]);

  useEffect(() => {
    if (treasuryAccounts.length > 0 && !selectedTreasuryId) {
      const def = treasuryAccounts.find(a => a.isDefault) || treasuryAccounts[0];
      if (def) setSelectedTreasuryId(def.id);
    }
  }, [treasuryAccounts, selectedTreasuryId]);

  const unifiedPricedProductsCount = useMemo(() => {
    return (settings?.products || []).filter(p => (p.price || 0) > 0 || (p.variants || []).some(v => (v.price || 0) > 0)).length;
  }, [settings?.products]);

  const auditResult = useMemo(() => {
    return runTwoWayCodAudit({
      orders,
      settings,
      uploadedFiles,
      mapping,
      toleranceEgp: Math.max(0, Number(toleranceEgp) || 0),
      graceDaysForInTransit: Math.max(1, Number(graceDays) || 1),
      maxExpectedShippingFee: Math.max(0, Number(maxExpectedShippingFee) || 110),
      zoneRates,
      carrierFilter,
      sheetBrandFilter,
      matchWithStoreOrders,
      enableProductPriceAudit,
      productPriceAuditSource,
      manualMatches,
      manualCreditTrackingMap
    });
  }, [
    orders,
    settings,
    uploadedFiles,
    mapping,
    toleranceEgp,
    graceDays,
    maxExpectedShippingFee,
    zoneRates,
    carrierFilter,
    sheetBrandFilter,
    matchWithStoreOrders,
    enableProductPriceAudit,
    productPriceAuditSource,
    manualMatches,
    manualCreditTrackingMap
  ]);

  useEffect(() => {
    if (uploadedFiles.length === 0) {
      setSelectedRowIds(new Set());
      return;
    }
    setSelectedRowIds(new Set(auditResult.matchedReady.map(r => r.id)));
  }, [
    uploadedFiles,
    mapping.trackingCol,
    mapping.amountMode,
    mapping.netAmountCol,
    mapping.grossAmountCol,
    mapping.feesAmountCol,
    mapping.codFeeCol,
    mapping.paymentStatusCol,
    mapping.cashoutIdCol,
    carrierFilter,
    sheetBrandFilter,
    toleranceEgp,
    matchWithStoreOrders,
    manualMatches
  ]);

  const manualCandidateOrders = useMemo(() => {
    if (!manualLinkRow) return [];
    const term = manualOrderSearch.trim().toLowerCase();
    const list = term
      ? orders.filter(
          o =>
            o.orderNumber.toLowerCase().includes(term) ||
            o.customerName.toLowerCase().includes(term) ||
            o.customerPhone.toLowerCase().includes(term) ||
            (o.waybillNumber || '').toLowerCase().includes(term) ||
            (o.bostaTrackingNumber || '').toLowerCase().includes(term)
        )
      : orders;
    return list.slice(0, 30);
  }, [manualLinkRow, manualOrderSearch, orders]);

  const handleFilesProcess = async (fileList: FileList | File[], forcedRole?: UploadedSheetRole) => {
    if (!fileList || fileList.length === 0) return;
    setIsParsing(true);
    try {
      const parsed = await parseExcelOrCsvFiles(fileList, forcedRole);
      if (parsed.length === 0) {
        notify('الملفات المحددة فارغة أو لا تحتوي على صفوف بيانات صالحة.', 'error');
        return;
      }
      const incomingNames = new Set(parsed.map(f => f.fileName.trim().toLowerCase()));
      const remainingOld = uploadedFiles.filter(
        f => !incomingNames.has(f.fileName.trim().toLowerCase())
      );
      const nextFiles = [...remainingOld, ...parsed];
      setUploadedFiles(nextFiles);
      const totalRows = parsed.reduce((s, f) => s + f.rows.length, 0);
      const roleSummary = parsed.map(f => ROLE_LABELS[f.role]).join('، ');
      notify(`تم تحميل ${parsed.length} ملف (${totalRows.toLocaleString('en-US')} صف) — ${roleSummary}`, 'success');
      if (nextFiles.every(f => f.role === 'compensations') || parsed.every(f => f.role === 'compensations')) {
        setActiveTab('compensations');
      } else if (
        nextFiles.every(f => f.role === 'pickup_requests') ||
        parsed.every(f => f.role === 'pickup_requests')
      ) {
        setActiveTab('pickup_requests');
      } else if (
        nextFiles.every(f => f.role === 'bosta_credits') ||
        parsed.every(f => f.role === 'bosta_credits')
      ) {
        setActiveTab('bosta_credits');
      } else if (nextFiles.every(f => f.role === 'transactions') || parsed.every(f => f.role === 'transactions')) {
        setActiveTab('transactions_ledger');
      } else if (
        activeTab === 'batches' ||
        activeTab === 'uncollected' ||
        activeTab === 'transactions_ledger' ||
        activeTab === 'compensations' ||
        activeTab === 'pickup_requests' ||
        activeTab === 'bosta_credits'
      ) {
        setActiveTab('untransferred');
      }
    } catch (err) {
      console.error(err);
      notify('تعذر قراءة أحد ملفات الإكسيل. تأكد من صيغة (.xlsx, .xls, .csv).', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      await handleFilesProcess(e.dataTransfer.files);
    }
  };

  const handleRoleChange = (fileId: string, newRole: UploadedSheetRole) => {
    setUploadedFiles(prev => prev.map(f => (f.id === fileId ? { ...f, role: newRole } : f)));
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSaveCarrierProfile = () => {
    if (!onSaveCarrierProfile || allHeaders.length === 0) {
      notify('يرجى رفع شيت إكسيل أولاً لتعيين الأعمدة وحفظ القالب.', 'error');
      return;
    }
    const profileKey = carrierFilter === 'all' ? '__default__' : carrierFilter;
    const carrierName = carrierFilter === 'all' ? 'القالب العام الافتراضي' : carrierFilter;

    const newProfile: CodSheetColumnProfile = {
      profileKey,
      carrierName,
      amountMode: mapping.amountMode,
      trackingCol: mapping.trackingCol,
      netAmountCol: mapping.netAmountCol,
      grossAmountCol: mapping.grossAmountCol,
      feesAmountCol: mapping.feesAmountCol,
      codFeeCol: mapping.codFeeCol,
      statusCol: mapping.statusCol,
      phoneCol: mapping.phoneCol,
      dateCol: mapping.dateCol,
      updatedAt: new Date().toISOString()
    };

    onSaveCarrierProfile(profileKey, newProfile, Math.max(1, Number(graceDays) || 5));
    notify(`تم حفظ قالب أعمدة "${carrierName}" وسيتعرف عليه النظام تلقائياً مستقبلاً.`);
  };

  const handleSaveGraceDays = (val: number) => {
    const clean = Math.max(1, Math.min(60, Number(val) || 5));
    setGraceDays(clean);
    if (onUpdateGraceDays) onUpdateGraceDays(clean);
  };

  const selectableSheetRows = useMemo(() => {
    return [
      ...auditResult.matchedReady,
      ...auditResult.shortPaid,
      ...auditResult.overPaid,
      ...auditResult.collectedUntransferred
    ];
  }, [auditResult]);

  const selectedRowsList = useMemo(() => {
    return selectableSheetRows.filter(r => selectedRowIds.has(r.id) && r.matchedOrder);
  }, [selectableSheetRows, selectedRowIds]);

  const selectedSummary = useMemo(() => {
    const totalSheetNet =
      Math.round(selectedRowsList.reduce((s, r) => s + r.sheetNetPayout, 0) * 100) / 100;
    const totalExpectedNet =
      Math.round(
        selectedRowsList.reduce((s, r) => s + (r.expectation?.expectedNetPayout || 0), 0) * 100
      ) / 100;
    const totalDiscrepancy = Math.round((totalSheetNet - totalExpectedNet) * 100) / 100;
    return {
      count: selectedRowsList.length,
      totalSheetNet,
      totalExpectedNet,
      totalDiscrepancy
    };
  }, [selectedRowsList]);

  const toggleRowSelection = (rowId: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleSelectAllInTab = (rows: SheetAuditRow[]) => {
    const ids = rows.map(r => r.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedRowIds.has(id));
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const openSettleModal = (overrideBatchNumber?: string) => {
    if (!matchWithStoreOrders) {
      notify('فعّل زر المطابقة مع أوردرات الطلبات (ON) أولاً لاعتماد التحصيل على أوردرات المتجر.', 'error');
      return;
    }
    if (selectedRowsList.length === 0) {
      notify('حدد أوردراً واحداً على الأقل مرتبطاً بأوردرات النظام لاعتماد تحصيله.', 'error');
      return;
    }
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(savedBatches.length + 1).padStart(2, '0');
    setBatchNumberInput(overrideBatchNumber || activeLinkedCashoutId || `COD-${dateStamp}-${seq}`);
    setBatchNotes(activeLinkedCashoutId ? `ربط وتحميل على دفعة ${activeLinkedCashoutId}` : '');
    setShowSettleModal(true);
  };

  const handleConfirmSettlement = () => {
    if (!onSettleBatch || selectedRowsList.length === 0) return;
    setIsSettling(true);
    try {
      const cleanBatchNum = batchNumberInput.trim() || `COD-${Date.now()}`;
      onSettleBatch({
        batchNumber: cleanBatchNum,
        notes: batchNotes.trim(),
        treasuryAccountId: selectedTreasuryId,
        selectedRows: selectedRowsList,
        carrierFilter,
        fileNames: uploadedFiles.map(f => f.fileName),
        amountMode: mapping.amountMode,
        totalSheetRows: auditResult.sheetRows.length,
        totalSheetNet: selectedSummary.totalSheetNet,
        totalExpectedNet: selectedSummary.totalExpectedNet,
        totalDiscrepancy: selectedSummary.totalDiscrepancy
      });
      setShowSettleModal(false);
      setSelectedRowIds(new Set());
      setActiveLinkedCashoutId('');
      notify(`تم اعتماد الدفعة ${cleanBatchNum} وتحصيل ${selectedRowsList.length} أوردر بنجاح.`);
    } catch (err) {
      console.error(err);
      notify('حدث خطأ أثناء حفظ تسوية التحصيل.', 'error');
    } finally {
      setIsSettling(false);
    }
  };

  const handleConfirmReverseBatch = () => {
    if (!onReverseBatch || !batchToReverse) return;
    onReverseBatch(batchToReverse);
    notify(`تم عكس الدفعة ${batchToReverse.batchNumber} وإرجاع أوردراتها لقائمة المتابعة.`);
    setBatchToReverse(null);
  };

  const handleCopyWhatsappClaim = async () => {
    const text = buildWhatsappClaimMessage(auditResult, storeName, carrierFilter);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 2600);
      notify('تم نسخ رسالة المطالبة بصيغة واتساب جاهزة للإرسال لشركة الشحن.');
    } catch {
      notify('تعذر النسخ التلقائي للحافظة.', 'error');
    }
  };

  const handleExportClaimWorkbook = () => {
    exportCodClaimWorkbook(auditResult, storeName);
    notify('تم تصدير شيت المطالبة التفصيلي بالإكسيل.');
  };

  const q = searchQuery.trim().toLowerCase();

  const filterSheetRows = (rows: SheetAuditRow[]) => {
    if (!q) return rows;
    return rows.filter(r => {
      return (
        r.trackingKey.toLowerCase().includes(q) ||
        (r.businessRefKey || '').toLowerCase().includes(q) ||
        r.fileName.toLowerCase().includes(q) ||
        (r.sheetCashoutId || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.brandName || '').toLowerCase().includes(q) ||
        (r.dropoffCity || '').toLowerCase().includes(q) ||
        (r.currentHub || '').toLowerCase().includes(q) ||
        (r.exceptionReason || '').toLowerCase().includes(q) ||
        (r.packageDescription || '').toLowerCase().includes(q) ||
        (r.matchedOrder?.orderNumber || '').toLowerCase().includes(q) ||
        (r.matchedOrder?.customerName || '').toLowerCase().includes(q) ||
        (r.matchedOrder?.customerPhone || '').toLowerCase().includes(q) ||
        r.phoneRaw.toLowerCase().includes(q)
      );
    });
  };

  const filteredUntransferred = useMemo(
    () => filterSheetRows(auditResult.collectedUntransferred),
    [auditResult.collectedUntransferred, q]
  );

  const filteredUncollected = useMemo(() => {
    return auditResult.uncollectedDelivered.filter(item => {
      if (delayFilterDays !== 'all' && item.daysElapsed < Number(delayFilterDays)) return false;
      if (!q) return true;
      return (
        item.trackingDisplay.toLowerCase().includes(q) ||
        item.order.orderNumber.toLowerCase().includes(q) ||
        item.order.customerName.toLowerCase().includes(q) ||
        item.order.customerPhone.toLowerCase().includes(q) ||
        (item.order.shippingCompany || '').toLowerCase().includes(q)
      );
    });
  }, [auditResult.uncollectedDelivered, delayFilterDays, q]);

  const filteredDiscrepancies = useMemo(
    () => filterSheetRows([...auditResult.shortPaid, ...auditResult.overPaid]),
    [auditResult.shortPaid, auditResult.overPaid, q]
  );

  const filteredNotCollectedCustomer = useMemo(() => {
    const base = filterSheetRows(auditResult.notCollectedCustomer);
    if (returnWarehouseFilter === 'all') return base;
    if (returnWarehouseFilter === 'returned_to_merchant') {
      return base.filter(
        r =>
          r.warehouseReturnStatus === 'returned_to_merchant_confirmed' ||
          r.warehouseReturnStatus === 'returned_stock_not_restored'
      );
    }
    if (returnWarehouseFilter === 'not_returned_yet') {
      return base.filter(
        r =>
          r.warehouseReturnStatus === 'still_at_bosta_hub' ||
          r.warehouseReturnStatus === 'no_return_proof'
      );
    }
    if (returnWarehouseFilter === 'stock_mismatch') {
      return base.filter(r => r.warehouseReturnStatus === 'returned_stock_not_restored');
    }
    return base;
  }, [auditResult.notCollectedCustomer, q, returnWarehouseFilter]);

  const filteredInTransitSheet = useMemo(
    () => filterSheetRows(auditResult.inTransitInSheet),
    [auditResult.inTransitInSheet, q]
  );

  const filteredOverdue = useMemo(() => {
    return auditResult.inTransitOverdue.filter(item => {
      if (!q) return true;
      return (
        item.trackingDisplay.toLowerCase().includes(q) ||
        item.order.orderNumber.toLowerCase().includes(q) ||
        item.order.customerName.toLowerCase().includes(q) ||
        item.order.customerPhone.toLowerCase().includes(q) ||
        (item.order.shippingCompany || '').toLowerCase().includes(q)
      );
    });
  }, [auditResult.inTransitOverdue, q]);

  const filteredMatched = useMemo(
    () => filterSheetRows(auditResult.matchedReady),
    [auditResult.matchedReady, q]
  );

  const filteredDuplicates = useMemo(
    () => filterSheetRows(auditResult.duplicates),
    [auditResult.duplicates, q]
  );

  const filteredNotFound = useMemo(
    () => filterSheetRows(auditResult.notFound),
    [auditResult.notFound, q]
  );

  const filteredTxLedger = useMemo(() => {
    return auditResult.transactionsSummary.ledgerRows.filter(row => {
      const catLow = row.category.toLowerCase();
      if (txCategoryFilter === 'cashout_fees') {
        if (
          !catLow.includes('cash out') &&
          !catLow.includes('transfer fee') &&
          !catLow.includes('balance adjustment')
        ) {
          return false;
        }
      } else if (txCategoryFilter === 'compensations') {
        if (!catLow.includes('compensation')) return false;
      } else if (txCategoryFilter === 'packing_pickup') {
        if (
          !catLow.includes('packing') &&
          !catLow.includes('packaging') &&
          !catLow.includes('pickup')
        ) {
          return false;
        }
      } else if (txCategoryFilter === 'cycles') {
        if (!catLow.includes('cycle')) return false;
      }
      if (!q) return true;
      return (
        row.transactionId.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        row.categoryAr.toLowerCase().includes(q) ||
        (row.cashoutId || '').toLowerCase().includes(q) ||
        row.date.toLowerCase().includes(q)
      );
    });
  }, [auditResult.transactionsSummary.ledgerRows, txCategoryFilter, q]);

  const filteredCompensations = useMemo(() => {
    const entries = auditResult.compensationsSummary.entries;
    if (!q) return entries;
    return entries.filter(c => {
      return (
        c.orderId.toLowerCase().includes(q) ||
        c.compensationId.toLowerCase().includes(q) ||
        (c.orderReference || '').toLowerCase().includes(q) ||
        (c.cashoutId || '').toLowerCase().includes(q) ||
        (c.customerName || '').toLowerCase().includes(q) ||
        (c.customerPhone || '').toLowerCase().includes(q) ||
        (c.brandName || '').toLowerCase().includes(q) ||
        (c.packageDescription || '').toLowerCase().includes(q) ||
        (c.dropoffCity || '').toLowerCase().includes(q) ||
        (c.pickupCity || '').toLowerCase().includes(q) ||
        c.compensationDate.toLowerCase().includes(q) ||
        c.orderStatusLabel.toLowerCase().includes(q) ||
        (c.matchedOrder?.orderNumber || '').toLowerCase().includes(q)
      );
    });
  }, [auditResult.compensationsSummary.entries, q]);

  const compensationsByCashoutId = useMemo(() => {
    const map = new Map<string, typeof auditResult.compensationsSummary.entries>();
    auditResult.compensationsSummary.entries.forEach(c => {
      if (!c.cashoutId) return;
      const list = map.get(c.cashoutId) || [];
      list.push(c);
      map.set(c.cashoutId, list);
    });
    return map;
  }, [auditResult.compensationsSummary.entries]);

  const filteredMissingComp = useMemo(() => {
    if (!q) return auditResult.missingCompensations;
    return auditResult.missingCompensations.filter(
      item =>
        item.trackingKey.toLowerCase().includes(q) ||
        (item.orderNumber || '').toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.customerPhone || '').toLowerCase().includes(q) ||
        (item.brandName || '').toLowerCase().includes(q) ||
        (item.dropoffCity || '').toLowerCase().includes(q) ||
        item.sheetStatus.toLowerCase().includes(q) ||
        (item.exceptionReason || '').toLowerCase().includes(q)
    );
  }, [auditResult.missingCompensations, q]);

  const filteredFeeAnomalies = useMemo(() => {
    return auditResult.feeAnomalies.filter(item => {
      if (feeAnomalyFilter === 'rate_size' && !item.isRateOrSizeOvercharge) return false;
      if (feeAnomalyFilter === 'returned_insurance' && !item.isReturnedInsuranceAnomaly) return false;
      if (feeAnomalyFilter === 'untouched_opening' && !item.isInvalidOpeningOnUntouchedReturn) return false;
      if (feeAnomalyFilter === 'forbidden_open_fee' && !item.isForbiddenOpenFeeAnomaly) return false;
      if (feeAnomalyFilter === 'zero_cod_delivered' && !item.isZeroCodDeliveredAnomaly) return false;
      if (!q) return true;
      return (
        item.trackingKey.toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.customerPhone || '').toLowerCase().includes(q) ||
        (item.brandName || '').toLowerCase().includes(q) ||
        (item.packageSize || '').toLowerCase().includes(q) ||
        (item.packageDescription || '').toLowerCase().includes(q) ||
        (item.orderNotes || '').toLowerCase().includes(q) ||
        (item.exceptionReason || '').toLowerCase().includes(q) ||
        (item.creditVoucherTxId || '').toLowerCase().includes(q) ||
        (item.sheetCashoutId || '').toLowerCase().includes(q) ||
        (item.matchedOrder?.orderNumber || '').toLowerCase().includes(q) ||
        item.anomalyTags.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [auditResult.feeAnomalies, feeAnomalyFilter, q]);

  const filteredStuckReturns = useMemo(() => {
    if (!q) return auditResult.stuckReturns;
    return auditResult.stuckReturns.filter(
      item =>
        item.trackingKey.toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.customerPhone || '').toLowerCase().includes(q) ||
        (item.brandName || '').toLowerCase().includes(q) ||
        (item.currentHub || '').toLowerCase().includes(q) ||
        (item.dropoffCity || '').toLowerCase().includes(q) ||
        (item.exceptionReason || '').toLowerCase().includes(q) ||
        (item.matchedOrder?.orderNumber || '').toLowerCase().includes(q)
    );
  }, [auditResult.stuckReturns, q]);

  const filteredOnlineFlex = useMemo(() => {
    if (!q) return auditResult.onlineAndFlexAlerts;
    return auditResult.onlineAndFlexAlerts.filter(
      item =>
        item.trackingKey.toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.customerPhone || '').toLowerCase().includes(q) ||
        (item.brandName || '').toLowerCase().includes(q) ||
        (item.sheetCashoutId || '').toLowerCase().includes(q) ||
        (item.matchedOrder?.orderNumber || '').toLowerCase().includes(q)
    );
  }, [auditResult.onlineAndFlexAlerts, q]);

  const filteredPickupRequests = useMemo(() => {
    const entries = auditResult.pickupRequestsSummary.entries;
    if (!q) return entries;
    return entries.filter(
      p =>
        p.pickupId.toLowerCase().includes(q) ||
        p.scheduledDate.toLowerCase().includes(q) ||
        (p.brandName || '').toLowerCase().includes(q) ||
        (p.businessTier || '').toLowerCase().includes(q) ||
        (p.parcelType || '').toLowerCase().includes(q) ||
        (p.firstMileDistrictCode || '').toLowerCase().includes(q) ||
        (p.hubName || '').toLowerCase().includes(q) ||
        (p.starName || '').toLowerCase().includes(q) ||
        (p.starPhone || '').toLowerCase().includes(q) ||
        (p.contactName || '').toLowerCase().includes(q) ||
        (p.contactNumber || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.zone || '').toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q) ||
        (p.sampleTrackingNumber || '').toLowerCase().includes(q) ||
        (p.sampleTrackingBrand || '').toLowerCase().includes(q) ||
        (p.expectedWarehouseBrand || '').toLowerCase().includes(q) ||
        (p.exceptionReason || '').toLowerCase().includes(q) ||
        p.reasonSummary.toLowerCase().includes(q)
    );
  }, [auditResult.pickupRequestsSummary.entries, q]);

  const pickupFeeAuditByTxId = useMemo(() => {
    const map = new Map<string, (typeof auditResult.pickupFeeAudits)[number]>();
    auditResult.pickupFeeAudits.forEach(a => map.set(a.transactionId, a));
    return map;
  }, [auditResult.pickupFeeAudits]);

  const filteredBostaCredits = useMemo(() => {
    const entries = auditResult.bostaCreditsSummary.entries;
    if (!q) return entries;
    return entries.filter(
      c =>
        c.transactionId.toLowerCase().includes(q) ||
        (c.trackingNumber || '').toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.categoryAr.toLowerCase().includes(q) ||
        (c.inferredReasonAr || '').toLowerCase().includes(q) ||
        (c.matchedAnomalyTrackingKey || '').toLowerCase().includes(q) ||
        (c.matchedAnomalyCustomerName || '').toLowerCase().includes(q) ||
        (c.matchedAnomalyProduct || '').toLowerCase().includes(q) ||
        (c.matchedAnomalyState || '').toLowerCase().includes(q) ||
        (c.candidateTrackingKeys || []).some(k => k.toLowerCase().includes(q)) ||
        (c.subCategory || '').toLowerCase().includes(q) ||
        c.date.toLowerCase().includes(q)
    );
  }, [auditResult.bostaCreditsSummary.entries, q]);

  const filteredWalletCompensations = useMemo(() => {
    const entries = auditResult.transactionsSummary.walletCompensations;
    if (!q) return entries;
    return entries.filter(
      w =>
        w.transactionId.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.categoryAr.toLowerCase().includes(q) ||
        (w.cashoutId || '').toLowerCase().includes(q) ||
        (w.matchedCompensationOrderId || '').toLowerCase().includes(q) ||
        (w.matchedCustomerName || '').toLowerCase().includes(q) ||
        (w.matchedProduct || '').toLowerCase().includes(q) ||
        w.inferredNoteAr.toLowerCase().includes(q) ||
        w.date.toLowerCase().includes(q)
    );
  }, [auditResult.transactionsSummary.walletCompensations, q]);

  const parsedCreditsPastePreview = useMemo(() => {
    if (!creditsPasteText.trim()) return [];
    const knownTxIds = new Set(
      auditResult.bostaCreditsSummary.entries.map(e => e.transactionId).filter(Boolean)
    );
    return parseBostaCreditsUiPaste(creditsPasteText, knownTxIds);
  }, [creditsPasteText, auditResult.bostaCreditsSummary.entries]);

  const filteredFraudAlerts = useMemo(() => {
    return auditResult.internalFraudAlerts.filter(item => {
      if (fraudTypeFilter !== 'all' && item.fraudType !== fraudTypeFilter) return false;
      if (!q) return true;
      return (
        item.trackingKey.toLowerCase().includes(q) ||
        (item.secondaryTrackingKey || '').toLowerCase().includes(q) ||
        (item.orderNumber || '').toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.customerPhone || '').toLowerCase().includes(q) ||
        (item.brandName || '').toLowerCase().includes(q) ||
        (item.referenceSourceLabel || '').toLowerCase().includes(q) ||
        item.reasonSummary.toLowerCase().includes(q)
      );
    });
  }, [auditResult.internalFraudAlerts, fraudTypeFilter, q]);

  const filteredZeroAttempt = useMemo(() => {
    if (!q) return auditResult.zeroAttemptReturns;
    return auditResult.zeroAttemptReturns.filter(
      item =>
        item.trackingKey.toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.customerPhone || '').toLowerCase().includes(q) ||
        (item.brandName || '').toLowerCase().includes(q) ||
        (item.dropoffCity || '').toLowerCase().includes(q) ||
        (item.exceptionReason || '').toLowerCase().includes(q) ||
        (item.matchedOrder?.orderNumber || '').toLowerCase().includes(q)
    );
  }, [auditResult.zeroAttemptReturns, q]);

  const filteredCustomerRisk = useMemo(() => {
    if (!q) return auditResult.customerRiskAlerts;
    return auditResult.customerRiskAlerts.filter(
      item =>
        item.phone.toLowerCase().includes(q) ||
        item.customerNames.some(n => n.toLowerCase().includes(q)) ||
        item.cities.some(c => c.toLowerCase().includes(q)) ||
        item.sampleTrackingKeys.some(t => t.toLowerCase().includes(q))
    );
  }, [auditResult.customerRiskAlerts, q]);

  const filteredExchangeAudits = useMemo(() => {
    if (!q) return auditResult.exchangeAudits;
    return auditResult.exchangeAudits.filter(
      item =>
        item.trackingKey.toLowerCase().includes(q) ||
        (item.secondaryTrackingKey || '').toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.customerPhone || '').toLowerCase().includes(q) ||
        (item.dropoffCity || '').toLowerCase().includes(q) ||
        item.reasonSummary.toLowerCase().includes(q)
    );
  }, [auditResult.exchangeAudits, q]);

  const bankConfirmStats = useMemo(() => {
    const payouts = auditResult.transactionsSummary.entries.filter(e => e.cashoutAmount > 0);
    let confirmedCount = 0;
    let confirmedAmount = 0;
    let totalAmount = 0;
    payouts.forEach(tx => {
      const key = tx.cashoutId && tx.cashoutId !== '-' ? tx.cashoutId : tx.id;
      totalAmount += tx.cashoutAmount;
      if (bankConfirmedCashouts[key]) {
        confirmedCount += 1;
        confirmedAmount += tx.cashoutAmount;
      }
    });
    return {
      totalCount: payouts.length,
      confirmedCount,
      confirmedAmount: Math.round(confirmedAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100
    };
  }, [auditResult.transactionsSummary.entries, bankConfirmedCashouts]);

  const totalClaimsAmount =
    Math.round(
      (auditResult.totals.collectedUntransferredAmount +
        auditResult.totals.uncollectedDeliveredAmount +
        auditResult.totals.shortPaidDeficitAmount) *
        100
    ) / 100;

  const totalClaimsCount =
    auditResult.collectedUntransferred.length +
    auditResult.uncollectedDelivered.length +
    auditResult.shortPaid.length;

  const orderBasePath = orderDetailBasePath || `/store/${storeId}/orders`;

  const renderOrderTrigger = (
    order: Order,
    content: React.ReactNode,
    className = 'font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
  ) => {
    if (onOpenOrder) {
      return (
        <button type="button" onClick={() => onOpenOrder(order)} className={className}>
          {content}
        </button>
      );
    }
    return (
      <Link to={`${orderBasePath}/${order.id}`} className={className}>
        {content}
      </Link>
    );
  };

  const renderDeliverySlaPanel = () => {
    const dsla = auditResult.deliverySlaSummary;
    if (!dsla.hasDeliveriesSlaData) return null;
    const wa = dsla.whatsappStats;
    return (
      <div className="mx-4 mt-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              رادار الالتزام بمواعيد التسليم والبيك أب (Expected Dates) + تأثير الواتساب والتعليق (On-Hold)
            </span>
          </div>
          {dsla.items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeliverySlaTable(v => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <span>
                {showDeliverySlaTable
                  ? 'إخفاء جدول التأخيرات'
                  : `عرض جدول الشحنات المتأخرة (${dsla.items.length})`}
              </span>
              {showDeliverySlaTable ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">تأخر التسليم رغم التوقع</div>
            <div className="font-mono tabular-nums font-black text-sm text-amber-600 dark:text-amber-400 mt-0.5">
              {dsla.delayedDeliveredCount} متأخرة
            </div>
            <div className="font-mono tabular-nums text-[10px] text-slate-400">
              من {dsla.totalWithExpectedDate} بموعد متوقع
            </div>
          </div>
          <div
            className={`p-2.5 rounded-lg border ${
              dsla.returnedAfterDelayCount > 0
                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="text-[11px] text-slate-500">مرتجع بعد تأخير التسليم</div>
            <div
              className={`font-mono tabular-nums font-black text-sm mt-0.5 ${
                dsla.returnedAfterDelayCount > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {dsla.returnedAfterDelayCount} شحنة
            </div>
            <div className="font-mono tabular-nums text-[10px] text-slate-500">
              {dsla.overdueActiveCount > 0 ? `+ ${dsla.overdueActiveCount} جارية متجاوزة` : 'شحنات جارية سليمة'}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">تأخر البيك أب / On-Hold</div>
            <div className="font-mono tabular-nums font-black text-sm text-slate-800 dark:text-slate-100 mt-0.5">
              {dsla.pickupDelayedCount} بيك أب
            </div>
            <div className="font-mono tabular-nums text-[10px] text-slate-500">
              محاولات تعليق: {dsla.onHoldAffectedCount} شحنة
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300">واتساب: Confirmed</div>
            <div className="font-mono tabular-nums font-black text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
              {wa.confirmedCount} شحنة
            </div>
            <div className="font-mono tabular-nums text-[10px] text-slate-500">
              ارتجع {wa.confirmedReturnedCount} ({wa.confirmedReturnRate}%)
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
            <div className="text-[11px] text-amber-700 dark:text-amber-300">واتساب: No Response</div>
            <div className="font-mono tabular-nums font-black text-sm text-amber-600 dark:text-amber-400 mt-0.5">
              {wa.noResponseCount} شحنة
            </div>
            <div className="font-mono tabular-nums text-[10px] text-slate-500">
              ارتجع {wa.noResponseReturnedCount} ({wa.noResponseReturnRate}%)
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50">
            <div className="text-[11px] text-rose-700 dark:text-rose-300">واتساب: Failed</div>
            <div className="font-mono tabular-nums font-black text-sm text-rose-600 dark:text-rose-400 mt-0.5">
              {wa.failedCount} شحنة
            </div>
            <div className="font-mono tabular-nums text-[10px] text-slate-500">
              ارتجع {wa.failedReturnedCount} ({wa.failedReturnRate}%)
            </div>
          </div>
        </div>

        {showDeliverySlaTable && dsla.items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-72">
            <table className="w-full text-right text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                <tr>
                  <th className="py-2 px-3 font-bold">البوليصة</th>
                  <th className="py-2 px-3 font-bold">العميل والمدينة</th>
                  <th className="py-2 px-3 font-bold">الحالة وواتساب</th>
                  <th className="py-2 px-3 font-bold">المتوقع ← الفعلي</th>
                  <th className="py-2 px-3 font-bold text-center">التأخير / On-Hold</th>
                  <th className="py-2 px-3 font-bold">التشخيص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dsla.items.slice(0, 80).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {item.trackingKey}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {item.customerName || '-'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.dropoffCity || '-'}
                        {item.brandName ? ` · ${item.brandName}` : ''}
                      </div>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-700 dark:text-slate-200">
                        {item.deliveryState}
                      </div>
                      {item.whatsappStatus && (
                        <div className="text-[10px] text-slate-500">
                          WA: {item.whatsappStatus}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-[10px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div>متوقع: {item.expectedDeliveryDate || item.expectedPickupDate || '-'}</div>
                      <div>
                        {item.actualDeliveredAt
                          ? `فعلي: ${item.actualDeliveredAt}`
                          : item.scheduledAt
                          ? `مجدول: ${item.scheduledAt}`
                          : item.pickedUpDate
                          ? `بيك أب: ${item.pickedUpDate}`
                          : ''}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                      {item.delayDays > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black">
                          +{item.delayDays}ي تسليم
                        </span>
                      )}
                      {item.pickupDelayDays > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold ml-1">
                          +{item.pickupDelayDays}ي بيك أب
                        </span>
                      )}
                      {item.onHoldTrials > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold ml-1">
                          تعليق {item.onHoldTrials}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 max-w-[280px] text-slate-600 dark:text-slate-300">
                      {item.reasonSummary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`space-y-5 text-slate-900 dark:text-slate-100 ${isDark ? 'dark' : ''}`}
      dir="rtl"
    >
      {/* Floating Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 left-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-200 ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-slate-900 dark:bg-emerald-700 text-white border-slate-700 dark:border-emerald-600'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header + ON/OFF Master Match Mode Toggle + Export Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          {showBackToDashboard && (
            <Link
              to={`/store/${storeId}/dashboard`}
              className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 shrink-0"
              title="العودة للوحة التحكم"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </Link>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>كاشف التحصيلات ومطابقة بوسطة والإكسيل (COD)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>متجر {storeName}</span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                {orders.length.toLocaleString('en-US')} طلب بالنظام
              </span>
              {matchWithStoreOrders && (
                <>
                  <span>·</span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                    {auditResult.alreadySettledCount.toLocaleString('en-US')} محصّل ومصفّى
                  </span>
                </>
              )}
              {allowBatchSettlement && (
                <>
                  <span>·</span>
                  <span className="font-mono tabular-nums">{savedBatches.length} دفعة محفوظة</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right Controls: ON/OFF Master Toggle + Claims + Settle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* ON / OFF Toggle Switch: Match with Live Store Orders vs Uploaded Sheets Only */}
          <button
            type="button"
            role="switch"
            aria-checked={matchWithStoreOrders}
            onClick={() => {
              const next = !matchWithStoreOrders;
              setMatchWithStoreOrders(next);
              notify(
                next
                  ? 'وضع ON مفعّل: سيتم مطابقة الشيتات مع أوردرات قسم الطلبات بالنظام.'
                  : 'وضع OFF مفعّل: سيتم مطابقة الشيتات المرفوعة ببعضها فقط بدون أوردرات الطلبات.'
              );
              if (!next && activeTab === 'uncollected') {
                setActiveTab('untransferred');
              }
            }}
            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
              matchWithStoreOrders
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Power
              className={`w-4 h-4 shrink-0 ${
                matchWithStoreOrders ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            />
            <span>
              {matchWithStoreOrders
                ? 'ربط المطابقة بأوردرات الطلبات: ON'
                : 'مطابقة الشيتات المرفوعة فقط: OFF'}
            </span>
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                matchWithStoreOrders
                  ? 'bg-emerald-600 justify-start'
                  : 'bg-slate-400 dark:bg-slate-600 justify-end'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </span>
          </button>

          {/* ON / OFF Toggle Switch: Radar #5 Product Price vs Unified Inventory */}
          <button
            type="button"
            role="switch"
            aria-checked={enableProductPriceAudit}
            onClick={() => {
              const next = !enableProductPriceAudit;
              setEnableProductPriceAudit(next);
              notify(
                next
                  ? 'تم تفعيل رادار أسعار المنتجات (#5): يقارن السعر في بوسطة مع المخزون الموحد ومتوسط الشيتات.'
                  : 'تم إيقاف رادار أسعار المنتجات (#5).'
              );
            }}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
              enableProductPriceAudit
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
            title="مقارنة سعر COD الفعلي للمنتج مع المخزون الموحد"
          >
            <Power
              className={`w-3.5 h-3.5 shrink-0 ${
                enableProductPriceAudit ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
              }`}
            />
            <span>
              {enableProductPriceAudit
                ? `مقارنة أسعار المخزون: ON`
                : 'مقارنة أسعار المخزون: OFF'}
            </span>
            <span
              className={`w-8 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                enableProductPriceAudit
                  ? 'bg-indigo-600 justify-start'
                  : 'bg-slate-400 dark:bg-slate-600 justify-end'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopyWhatsappClaim}
            disabled={
              totalClaimsCount === 0 &&
              auditResult.missingCompensations.length === 0 &&
              auditResult.totals.uncompensatedRateSizeOverchargeAmount === 0 &&
              auditResult.totals.returnedInsuranceCount === 0 &&
              auditResult.totals.returnedUntouchedOpeningCount === 0 &&
              auditResult.totals.wrongfulPickupFeeCount === 0 &&
              auditResult.totals.crossBrandSwapCount === 0
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedWhatsapp ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <MessageSquare className="w-4 h-4 text-emerald-600" />
            )}
            <span>{copiedWhatsapp ? 'تم نسخ المطالبة' : 'نسخ مطالبة واتساب'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportClaimWorkbook}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>تصدير مطالبة (XLSX)</span>
          </button>

          {allowBatchSettlement && onSettleBatch && uploadedFiles.length > 0 && matchWithStoreOrders && (
            <button
              type="button"
              onClick={() => openSettleModal()}
              disabled={selectedRowsList.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-40 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>اعتماد وتحصيل ({selectedRowsList.length.toLocaleString('en-US')})</span>
            </button>
          )}
        </div>
      </div>

      {/* Executive 4-KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Collected by Courier, NOT Transferred (Not Paid / No Cash-out ID) */}
        <button
          type="button"
          onClick={() => setActiveTab('untransferred')}
          className={`text-right bg-white dark:bg-slate-900 rounded-xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:border-rose-300 dark:hover:border-rose-700 cursor-pointer ${
            activeTab === 'untransferred'
              ? 'border-rose-400 dark:border-rose-600 ring-1 ring-rose-500/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              متحصل ولم يُحوّل (Not Paid / بلا Cash-out)
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatEgp(auditResult.totals.collectedUntransferredAmount)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {auditResult.collectedUntransferred.length.toLocaleString('en-US')} شحنة · COD{' '}
            {formatEgp(auditResult.totals.collectedUntransferredGross)}
          </div>
        </button>

        {/* KPI 2: Delivered in Store Orders Missing From Sheets */}
        <button
          type="button"
          onClick={() => matchWithStoreOrders && setActiveTab('uncollected')}
          className={`text-right bg-white dark:bg-slate-900 rounded-xl border p-4 sm:p-5 shadow-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'uncollected'
              ? 'border-rose-400 dark:border-rose-600 ring-1 ring-rose-500/20'
              : 'border-slate-200 dark:border-slate-800'
          } ${!matchWithStoreOrders ? 'opacity-65' : 'hover:border-rose-300 dark:hover:border-rose-700'}`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              مسلّمة بالطلبات لم تظهر بالشيت
            </span>
            <Clock className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {matchWithStoreOrders
              ? formatEgp(auditResult.totals.uncollectedDeliveredAmount)
              : 'OFF (شيتات فقط)'}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {matchWithStoreOrders
              ? `${auditResult.uncollectedDelivered.length.toLocaleString('en-US')} أوردر مسلّم بالنظام بدون شيت`
              : 'فعّل زر الطلبات (ON) لمطابقة أوردرات المتجر'}
          </div>
        </button>

        {/* KPI 3: Short Paid + Returned / Not Collected */}
        <button
          type="button"
          onClick={() => setActiveTab('discrepancy')}
          className={`text-right bg-white dark:bg-slate-900 rounded-xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:border-amber-300 dark:hover:border-amber-700 cursor-pointer ${
            activeTab === 'discrepancy'
              ? 'border-amber-400 dark:border-amber-600 ring-1 ring-amber-500/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              عجز وخصومات زائدة بالشيت
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatEgp(auditResult.totals.shortPaidDeficitAmount)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {auditResult.shortPaid.length} عجز · {auditResult.notCollectedCustomer.length} مرتجع (خصم {formatEgp(auditResult.totals.returnedFeesDeducted)})
          </div>
        </button>

        {/* KPI 4: Paid & Matched Ready for Settlement */}
        <button
          type="button"
          onClick={() => setActiveTab('matched')}
          className={`text-right bg-white dark:bg-slate-900 rounded-xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer ${
            activeTab === 'matched'
              ? 'border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              مثبت تحويله ومطابق (جاهز)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatEgp(auditResult.totals.matchedReadyNetAmount)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {auditResult.matchedReady.length.toLocaleString('en-US')} بوليصة مطابقة
          </div>
        </button>
      </div>

      {/* Interactive 4-Stage Sheet Lifecycle Map: What Went Where? */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>خريطة الشيتات المرفوعة — إيه راح فين بسهولة؟</span>
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              اضغط على أي مرحلة للانتقال المباشر إلى جدولها وتفاصيلها
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
            {/* Stage 1: Pickup */}
            <button
              type="button"
              onClick={() => {
                if (auditResult.pickupRequestsSummary.hasPickupSheet) {
                  setActiveTab('pickup_requests');
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className={`text-right p-3.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                activeTab === 'pickup_requests'
                  ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-black text-slate-800 dark:text-slate-100">
                  1. الاستلام (Pickup)
                </span>
                <Package className="w-4 h-4 text-indigo-600 shrink-0" />
              </div>
              {auditResult.pickupRequestsSummary.hasPickupSheet ? (
                <>
                  <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                    {auditResult.pickupRequestsSummary.totalPickedUpParcels.toLocaleString('en-US')} طرد مسحوب ·{' '}
                    {auditResult.pickupRequestsSummary.totalReceivedParcels.toLocaleString('en-US')} مستلم بالفرع
                  </div>
                  <div
                    className={`mt-1 text-[11px] font-semibold font-mono tabular-nums ${
                      auditResult.pickupRequestsSummary.crossBrandSwapCount > 0 ||
                      auditResult.pickupRequestsSummary.wrongfulPickupFeeCount > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : auditResult.pickupRequestsSummary.varianceGapCount > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {auditResult.pickupRequestsSummary.wrongfulPickupFeeCount > 0
                      ? `${auditResult.pickupRequestsSummary.wrongfulPickupFeeCount} خصم بيك أب خاطئ (-${formatEgp(auditResult.pickupRequestsSummary.wrongfulPickupFeeAmount)})`
                      : `${auditResult.pickupRequestsSummary.totalPickups} طلب · ${
                          auditResult.pickupRequestsSummary.varianceGapCount > 0
                            ? `${auditResult.pickupRequestsSummary.varianceGapCount} فرق استلام بالفرع`
                            : 'كل المسحوب مستلم بالفرع'
                        }`}
                    {auditResult.pickupRequestsSummary.crossBrandSwapCount > 0 && (
                      <span className="block text-[10px] font-black text-rose-600 dark:text-rose-400 mt-0.5">
                        🔀 {auditResult.pickupRequestsSummary.crossBrandSwapCount} تبديل مخزن/براند (
                        {auditResult.pickupRequestsSummary.crossBrandSwappedReturnsCount} مرتجع)
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-slate-500 dark:text-slate-400">
                    شيت البيك أب غير مرفوع
                  </div>
                  <div className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    اضغط لرفع Pickup Requests وتتبع استلام الفرع
                  </div>
                </>
              )}
            </button>

            {/* Stage 2: Deliveries & Hubs */}
            <button
              type="button"
              onClick={() =>
                setActiveTab(auditResult.stuckReturns.length > 0 ? 'stuck_returns' : 'in_transit_sheet')
              }
              className={`text-right p-3.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                activeTab === 'stuck_returns' || activeTab === 'in_transit_sheet'
                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-black text-slate-800 dark:text-slate-100">
                  2. الشحن والفروع (Deliveries)
                </span>
                <Truck className="w-4 h-4 text-amber-500 shrink-0" />
              </div>
              <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                {auditResult.inTransitInSheet.length.toLocaleString('en-US')} قيد التشغيل ·{' '}
                {auditResult.notCollectedCustomer.length.toLocaleString('en-US')} مرتجع
              </div>
              <div
                className={`mt-1 text-[11px] font-semibold font-mono tabular-nums ${
                  auditResult.stuckReturns.length > 0 ||
                  auditResult.deliverySlaSummary.returnedAfterDelayCount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {auditResult.stuckReturns.length > 0
                  ? `${auditResult.stuckReturns.length} مرتجع/عالق بالفروع (${formatEgp(auditResult.totals.stuckReturnsValueAmount)})`
                  : 'لا توجد مرتجعات عالقة بالفروع'}
                {auditResult.deliverySlaSummary.hasDeliveriesSlaData &&
                  (auditResult.deliverySlaSummary.returnedAfterDelayCount > 0 ||
                    auditResult.deliverySlaSummary.delayedDeliveredCount > 0 ||
                    auditResult.deliverySlaSummary.overdueActiveCount > 0) && (
                    <span className="block text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                      SLA التسليم: {auditResult.deliverySlaSummary.returnedAfterDelayCount} ارتجع بعد تأخير ·{' '}
                      {auditResult.deliverySlaSummary.delayedDeliveredCount} تسليم متأخر
                    </span>
                  )}
              </div>
            </button>

            {/* Stage 3: Cash Cycles & Fees */}
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  auditResult.collectedUntransferred.length > 0
                    ? 'untransferred'
                    : auditResult.feeAnomalies.length > 0
                    ? 'fee_anomalies'
                    : 'matched'
                )
              }
              className={`text-right p-3.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                activeTab === 'untransferred' || activeTab === 'fee_anomalies' || activeTab === 'matched'
                  ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-black text-slate-800 dark:text-slate-100">
                  3. التحصيل والخصم (Cash Cycles)
                </span>
                <Scale className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                {auditResult.matchedReady.length.toLocaleString('en-US')} محوّل مطابق ·{' '}
                <span
                  className={
                    auditResult.collectedUntransferred.length > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-600 dark:text-slate-300'
                  }
                >
                  {auditResult.collectedUntransferred.length.toLocaleString('en-US')} معلق
                </span>
              </div>
              <div
                className={`mt-1 text-[11px] font-semibold font-mono tabular-nums ${
                  auditResult.feeAnomalies.length > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {auditResult.feeAnomalies.length > 0
                  ? `${auditResult.feeAnomalies.length} شحنة بمصاريف زائدة (+${formatEgp(auditResult.totals.totalFeeOverchargeAmount)})`
                  : `إجمالي صافي الشيتات ${formatEgp(auditResult.totals.totalSheetNetAmount)}`}
              </div>
            </button>

            {/* Stage 4: Bank Cashouts, Dual-Wallet Compensations & Bosta Credits */}
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  auditResult.missingCompensations.length > 0
                    ? 'missing_comp'
                    : auditResult.bostaCreditsSummary.hasCreditsSheet &&
                      !auditResult.transactionsSummary.hasTransactionsSheet
                    ? 'bosta_credits'
                    : auditResult.compensationsSummary.hasCompensationsSheet ||
                      auditResult.transactionsSummary.walletCompensations.length > 0
                    ? 'compensations'
                    : auditResult.bostaCreditsSummary.hasCreditsSheet
                    ? 'bosta_credits'
                    : 'transactions_ledger'
                )
              }
              className={`text-right p-3.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                activeTab === 'transactions_ledger' ||
                activeTab === 'compensations' ||
                activeTab === 'bosta_credits' ||
                activeTab === 'missing_comp'
                  ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-black text-slate-800 dark:text-slate-100">
                  4. البنك والتعويضات (محفظة + نقاط)
                </span>
                <Landmark className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                {bankConfirmStats.totalCount > 0
                  ? `${bankConfirmStats.confirmedCount}/${bankConfirmStats.totalCount} دفعة مؤكدة بالبنك`
                  : auditResult.bostaCreditsSummary.hasCreditsSheet
                  ? `نقاط Credits: ${formatEgp(auditResult.bostaCreditsSummary.currentCreditsBalance || 0)}`
                  : 'لا توجد دفعات Transactions'}
              </div>
              <div
                className={`mt-1 text-[11px] font-semibold font-mono tabular-nums ${
                  auditResult.missingCompensations.length > 0 ||
                  auditResult.totals.underCompensatedCount > 0 ||
                  auditResult.totals.undocumentedWalletCompCount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {auditResult.missingCompensations.length > 0
                  ? `${auditResult.missingCompensations.length} تالف/مفقود/منقوص يستحق مطالبة`
                  : auditResult.totals.undocumentedWalletCompCount > 0
                  ? `${auditResult.totals.undocumentedWalletCompCount} تعويض محفظة غير موثق (${formatEgp(auditResult.totals.undocumentedWalletCompAmount)})`
                  : auditResult.bostaCreditsSummary.hasCreditsSheet && bankConfirmStats.totalCount > 0
                  ? `محفظة ${formatEgp(auditResult.transactionsSummary.totalCompensations)} · نقاط +${formatEgp(auditResult.bostaCreditsSummary.voucherCreditsAmount)}`
                  : auditResult.compensationsSummary.hasCompensationsSheet
                  ? `${auditResult.compensationsSummary.entries.length} تعويض (${formatEgp(auditResult.compensationsSummary.totalCompensatedAmount)})`
                  : auditResult.bostaCreditsSummary.hasCreditsSheet
                  ? `قسائم نقاط +${formatEgp(auditResult.bostaCreditsSummary.totalAddedCredits)} · صرف -${formatEgp(auditResult.bostaCreditsSummary.totalSpentCredits)}`
                  : 'كل التالف/المفقود مغطى أو غير موجود'}
              </div>
            </button>
          </div>

          {/* Anti-Fraud & 7 Loopholes Defense Radar Strip */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('fraud_alerts')}
              className={`text-right p-3 rounded-lg border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer ${
                activeTab === 'fraud_alerts'
                  ? 'border-rose-400 dark:border-rose-600 bg-rose-50/60 dark:bg-rose-950/30'
                  : auditResult.internalFraudAlerts.length > 0
                  ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-300'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>التلاعب و0 COD وشذوذ الأسعار</span>
                </div>
                <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                  {auditResult.internalFraudAlerts.length > 0
                    ? `${auditResult.internalFraudAlerts.length} شبهة (${formatEgp(auditResult.totals.internalFraudRiskAmount)})`
                    : enableProductPriceAudit
                    ? `مقارنة المخزون مفعّلة (${unifiedPricedProductsCount} منتج)`
                    : 'رادار الأسعار OFF'}
                </div>
              </div>
              <span
                className={`font-mono tabular-nums font-black text-sm ${
                  auditResult.internalFraudAlerts.length > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {auditResult.internalFraudAlerts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFeeAnomalyFilter(
                  auditResult.totals.returnedUntouchedOpeningCount > 0
                    ? 'untouched_opening'
                    : auditResult.totals.returnedInsuranceCount > 0
                    ? 'returned_insurance'
                    : 'all'
                );
                setActiveTab('fee_anomalies');
              }}
              className={`text-right p-3 rounded-lg border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer ${
                activeTab === 'fee_anomalies'
                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-950/30'
                  : auditResult.totals.returnedInsuranceCount > 0 ||
                    auditResult.totals.returnedUntouchedOpeningCount > 0 ||
                    auditResult.totals.zeroCodDeliveredCount > 0
                  ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-300'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>تأمين وفتح باطل وتأخير SLA</span>
                </div>
                <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                  {auditResult.totals.returnedInsuranceCount > 0 || auditResult.totals.returnedUntouchedOpeningCount > 0
                    ? `${auditResult.totals.returnedInsuranceCount} تأمين مرتجع · ${auditResult.totals.returnedUntouchedOpeningCount} فتح باطل`
                    : auditResult.payoutSlaSummary.delayedCount > 0
                    ? `${auditResult.payoutSlaSummary.delayedCount} شحنة متأخرة التحويل`
                    : 'لا توجد خصومات غير مستحقة'}
                </div>
              </div>
              <span
                className={`font-mono tabular-nums font-black text-sm ${
                  auditResult.totals.returnedInsuranceCount + auditResult.totals.returnedUntouchedOpeningCount > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {auditResult.totals.returnedInsuranceCount + auditResult.totals.returnedUntouchedOpeningCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('zero_attempt_returns')}
              className={`text-right p-3 rounded-lg border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer ${
                activeTab === 'zero_attempt_returns'
                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-950/30'
                  : auditResult.zeroAttemptReturns.length > 0
                  ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-300'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>مرتجعات بـ 0 محاولة توصيل</span>
                </div>
                <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                  {auditResult.zeroAttemptReturns.length > 0
                    ? `${auditResult.zeroAttemptReturns.length} مرتجع وهمي (خصم ${formatEgp(auditResult.totals.zeroAttemptFeesAmount)})`
                    : 'كل المرتجعات تمت محاولة تسليمها'}
                </div>
              </div>
              <span
                className={`font-mono tabular-nums font-black text-sm ${
                  auditResult.zeroAttemptReturns.length > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {auditResult.zeroAttemptReturns.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab(auditResult.exchangeAudits.length > 0 ? 'exchange_audits' : 'customer_risk')
              }
              className={`text-right p-3 rounded-lg border transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer ${
                activeTab === 'customer_risk' || activeTab === 'exchange_audits'
                  ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/25'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>العملاء الخطرين والاستبدال والجزئي</span>
                </div>
                <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                  {auditResult.exchangeAudits.length > 0
                    ? auditResult.totals.exchangeIssueCount > 0
                      ? `${auditResult.totals.exchangeIssueCount} مخالفة استبدال/جزئي · ${auditResult.customerRiskAlerts.length} رقم خطر`
                      : `${auditResult.exchangeAudits.length} استبدال/جزئي سليم ✅ · ${auditResult.customerRiskAlerts.length} رقم خطر`
                    : auditResult.customerRiskAlerts.length > 0
                    ? `${auditResult.customerRiskAlerts.length} رقم خطر (حرق ${formatEgp(auditResult.totals.customerRiskBurnedFees)})`
                    : 'سليم (لا أرقام خطرة أو أخطاء استبدال)'}
                </div>
              </div>
              <span
                className={`font-mono tabular-nums font-black text-sm ${
                  auditResult.customerRiskAlerts.length + auditResult.totals.exchangeIssueCount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {auditResult.customerRiskAlerts.length + auditResult.totals.exchangeIssueCount}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Transactions Sheet Summary Panel (if Transactions sheet uploaded) */}
      {auditResult.transactionsSummary.hasTransactionsSheet && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600" />
              <span>ملخص كشف حركة الحساب والتحويلات (Transactions)</span>
              {auditResult.transactionsSummary.currentWalletBalance !== null && (
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono tabular-nums text-xs font-black">
                  الرصيد الحالي بالمحفظة: {formatEgp(auditResult.transactionsSummary.currentWalletBalance)}
                </span>
              )}
              {auditResult.transactionsSummary.walletIntegrityStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>تسلسل رصيد المحفظة سليم 100%</span>
                </span>
              )}
              {auditResult.transactionsSummary.walletIntegrityStatus === 'mismatch_found' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>تحذير: {auditResult.transactionsSummary.walletGaps.length} فجوة في الرصيد التراكمي</span>
                </span>
              )}
              {auditResult.transactionsSummary.walletIntegrityStatus === 'partial_filtered' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>كشف فئة جزئية (ارفع باقي فئات Transactions لفحص تسلسل الرصيد)</span>
                </span>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {bankConfirmStats.totalCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
                  <Landmark className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    مؤكد بالبنك: {bankConfirmStats.confirmedCount} من {bankConfirmStats.totalCount} دفعة
                    {bankConfirmStats.confirmedAmount > 0
                      ? ` (${formatEgp(bankConfirmStats.confirmedAmount)})`
                      : ''}
                  </span>
                </span>
              )}
              {auditResult.transactionsSummary.unlinkedCashoutTotal > 0 && (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                  تحويلات عامة غير مربوطة بـ Cash Cycles: {formatEgp(auditResult.transactionsSummary.unlinkedCashoutTotal)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('transactions_ledger')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                عرض كل الحركات ({auditResult.transactionsSummary.ledgerRows.length.toLocaleString('en-US')})
              </button>
            </div>
          </div>

          {auditResult.transactionsSummary.walletGaps.length > 0 && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-xs space-y-1">
              <div className="font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>تحذير: تم رصد فجوة أو حذف/تعديل في تسلسل الرصيد التراكمي لملف Transactions:</span>
              </div>
              {auditResult.transactionsSummary.walletGaps.slice(0, 5).map(g => (
                <div key={g.id} className="text-[11px] font-mono tabular-nums text-rose-700 dark:text-rose-200">
                  • {g.reasonSummary}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <div className="text-slate-500 text-[11px]">دورات التحصيل</div>
              <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white mt-0.5">
                {formatEgp(auditResult.transactionsSummary.totalCollectionCycles)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <div className="text-slate-500 text-[11px]">مصاريف بوسطة</div>
              <div className="font-mono tabular-nums font-black text-rose-600 mt-0.5">
                -{formatEgp(auditResult.transactionsSummary.totalBostaFeesCycles)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <div className="text-slate-500 text-[11px]">صافي الدورات</div>
              <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white mt-0.5">
                {formatEgp(auditResult.transactionsSummary.netCycleBalance)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <div className="text-slate-500 text-[11px]">إجمالي المحوّل للبنك</div>
              <div className="font-mono tabular-nums font-black text-emerald-600 mt-0.5">
                {formatEgp(auditResult.transactionsSummary.totalCashouts)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <div className="text-slate-500 text-[11px]">تعويضات بوسطة</div>
              <div className="font-mono tabular-nums font-black text-emerald-600 mt-0.5">
                +{formatEgp(auditResult.transactionsSummary.totalCompensations)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <div className="text-slate-500 text-[11px]">تحويل + تغليف + بيك أب</div>
              <div className="font-mono tabular-nums font-bold text-slate-600 dark:text-slate-300 mt-0.5 text-[11px]">
                رسوم {formatEgp(auditResult.transactionsSummary.totalTransferFees)} · تغليف {formatEgp(auditResult.transactionsSummary.packingMaterialNet)} · بيك أب {formatEgp(auditResult.transactionsSummary.pickupFeesTotal)}
              </div>
              {auditResult.totals.wrongfulPickupFeeCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      auditResult.pickupRequestsSummary.hasPickupSheet
                        ? 'pickup_requests'
                        : 'fee_anomalies'
                    )
                  }
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-black font-mono tabular-nums text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>
                    منها {formatEgp(auditResult.totals.wrongfulPickupFeeAmount)} خصم خاطئ ({auditResult.totals.wrongfulPickupFeeCount})
                  </span>
                </button>
              )}
            </div>
          </div>

          {auditResult.transactionsSummary.entries.filter(e => e.cashoutAmount > 0).length > 0 && (
            <div className="overflow-x-auto pt-1">
              <table className="w-full text-right text-xs">
                <thead className="text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3 font-bold whitespace-nowrap">كود التحويل (Cashout ID)</th>
                    <th className="py-2 px-3 font-bold whitespace-nowrap">التاريخ</th>
                    <th className="py-2 px-3 font-bold text-left whitespace-nowrap">مبلغ التحويل للبنك</th>
                    <th className="py-2 px-3 font-bold text-left whitespace-nowrap">رسوم التحويل</th>
                    <th className="py-2 px-3 font-bold text-center whitespace-nowrap">أوردرات Cash Cycles</th>
                    <th className="py-2 px-3 font-bold">التعويضات وخصم التغليف</th>
                    <th className="py-2 px-3 font-bold">الحالة والمطابقة البنكية</th>
                    <th className="py-2 px-3 font-bold whitespace-nowrap">وصول البنك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditResult.transactionsSummary.entries
                    .filter(e => e.cashoutAmount > 0)
                    .map(tx => {
                      const bankMatched =
                        !tx.isUnlinkedGeneralPayout &&
                        tx.linkedOrderCount > 0 &&
                        Math.abs(tx.bankVariance) <= 1;
                      const otherAdj =
                        Math.round(
                          (tx.linkedAdjustmentsTotal -
                            tx.linkedCompensationsTotal -
                            tx.linkedPackingTotal -
                            tx.linkedPickupTotal) *
                            100
                        ) / 100;
                      const hasAnyAdj =
                        tx.linkedCompensationsTotal !== 0 ||
                        tx.linkedPackingTotal !== 0 ||
                        tx.linkedPickupTotal !== 0 ||
                        otherAdj !== 0;

                      const eqParts: string[] = [tx.linkedNetTotal.toLocaleString('en-US')];
                      if (tx.linkedCompensationsTotal !== 0) {
                        eqParts.push(
                          `${tx.linkedCompensationsTotal > 0 ? '+' : '-'} ${Math.abs(tx.linkedCompensationsTotal).toLocaleString('en-US')}`
                        );
                      }
                      if (tx.linkedPackingTotal !== 0) {
                        eqParts.push(
                          `${tx.linkedPackingTotal > 0 ? '+' : '-'} ${Math.abs(tx.linkedPackingTotal).toLocaleString('en-US')}`
                        );
                      }
                      if (tx.linkedPickupTotal !== 0) {
                        eqParts.push(
                          `${tx.linkedPickupTotal > 0 ? '+' : '-'} ${Math.abs(tx.linkedPickupTotal).toLocaleString('en-US')}`
                        );
                      }
                      if (otherAdj !== 0) {
                        eqParts.push(
                          `${otherAdj > 0 ? '+' : '-'} ${Math.abs(otherAdj).toLocaleString('en-US')}`
                        );
                      }
                      if (tx.transferFees !== 0) {
                        eqParts.push(`- ${tx.transferFees.toLocaleString('en-US')}`);
                      }

                      return (
                        <tr key={tx.id}>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setInspectedCashout(tx)}
                              className="font-mono tabular-nums font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                              title="فتح فاتورة السحب النقدي التفصيلية"
                            >
                              <span>{tx.cashoutId}</span>
                              <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300">
                                الفاتورة
                              </span>
                            </button>
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {tx.date || '-'}
                          </td>
                          <td className="py-2 px-3 text-left font-mono tabular-nums font-bold text-emerald-600 whitespace-nowrap">
                            {formatEgp(tx.cashoutAmount)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {tx.transferFees > 0 ? `-${formatEgp(tx.transferFees)}` : '0 ج.م'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums font-bold whitespace-nowrap">
                            {tx.linkedOrderCount > 0 ? (
                              <div>
                                <span>{formatEgp(tx.linkedNetTotal)}</span>
                                <span className="text-[11px] font-normal text-slate-500 block">
                                  ({tx.linkedDeliveredCount} مسلّم · {tx.linkedReturnedCount} مرتجع)
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {hasAnyAdj ? (
                              <div className="space-y-0.5 text-[11px]">
                                {tx.linkedCompensationsTotal !== 0 && (
                                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                                    <span className="text-slate-500 font-sans">تعويض:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      +{formatEgp(tx.linkedCompensationsTotal)}
                                    </span>
                                  </div>
                                )}
                                {compensationsByCashoutId.get(tx.cashoutId)?.map(comp => (
                                  <button
                                    key={comp.id}
                                    type="button"
                                    onClick={() => setActiveTab('compensations')}
                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline block cursor-pointer"
                                  >
                                    بوليصة {comp.orderId} ({comp.customerName || formatEgp(comp.compensationAmount)})
                                  </button>
                                ))}
                                {tx.linkedPackingTotal !== 0 && (
                                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                                    <span className="text-slate-500 font-sans">تغليف:</span>
                                    <span
                                      className={`font-bold ${
                                        tx.linkedPackingTotal < 0
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {tx.linkedPackingTotal > 0 ? '+' : ''}
                                      {formatEgp(tx.linkedPackingTotal)}
                                    </span>
                                  </div>
                                )}
                                {tx.linkedPickupTotal !== 0 && (
                                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                                    <span className="text-slate-500 font-sans">بيك أب:</span>
                                    <span className="font-bold text-rose-600 dark:text-rose-400">
                                      {formatEgp(tx.linkedPickupTotal)}
                                    </span>
                                  </div>
                                )}
                                {otherAdj !== 0 && (
                                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                                    <span className="text-slate-500 font-sans">تسوية:</span>
                                    <span
                                      className={`font-bold ${
                                        otherAdj < 0
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {otherAdj > 0 ? '+' : ''}
                                      {formatEgp(otherAdj)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">لا يوجد</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {tx.isUnlinkedGeneralPayout ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  تحويل إجمالي غير مربوط بشيت Cash Cycles
                                </span>
                                {allowBatchSettlement && matchWithStoreOrders && tx.cashoutId !== '-' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveLinkedCashoutId(tx.cashoutId);
                                      setActiveTab('untransferred');
                                      notify(
                                        `اختر الشحنات المرتبطة بالتحويل ${tx.cashoutId} من التبويب ثم اضغط اعتماد وتحصيل.`
                                      );
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    <span>ربط وتوزيع على شحنات</span>
                                  </button>
                                )}
                              </div>
                            ) : bankMatched ? (
                              <div>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold block whitespace-nowrap">
                                  مطابق 100% للبنك (فرق {formatEgp(tx.bankVariance)})
                                </span>
                                <span
                                  dir="ltr"
                                  className="text-[11px] text-slate-500 font-mono tabular-nums inline-block whitespace-nowrap mt-0.5"
                                >
                                  {`${eqParts.join(' ')} = ${tx.cashoutAmount.toLocaleString('en-US')}`}
                                </span>
                              </div>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-bold font-mono tabular-nums whitespace-nowrap">
                                مربوط بـ {tx.linkedOrderCount} شحنة · فرق بنكي {formatEgp(tx.bankVariance)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {(() => {
                              const confirmKey =
                                tx.cashoutId && tx.cashoutId !== '-' ? tx.cashoutId : tx.id;
                              const confirmed = bankConfirmedCashouts[confirmKey];
                              return (
                                <button
                                  type="button"
                                  onClick={() => toggleBankConfirm(tx)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                                    confirmed
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                  }`}
                                  title={
                                    confirmed
                                      ? `تأكيد بتاريخ ${formatDateShort(confirmed.confirmedAt)} — اضغط للإلغاء`
                                      : 'اضغط بعد مراجعة كشف حساب البنك وتأكيد دخول المبلغ'
                                  }
                                >
                                  {confirmed ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>وصل البنك</span>
                                    </>
                                  ) : (
                                    <>
                                      <Landmark className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      <span>تأكيد دخول البنك</span>
                                    </>
                                  )}
                                </button>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Multi-Sheet Upload + 4-Sheet Role Classifier + Calculation Mode Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Drag & Drop Upload Box */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`lg:col-span-5 cursor-pointer rounded-xl border-2 border-dashed p-4 flex flex-col justify-center items-center text-center transition-all duration-200 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.tsv,.txt"
              className="hidden"
              onChange={e => {
                if (e.target.files?.length) {
                  handleFilesProcess(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              {isParsing ? (
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              اسحب وارفع شيتات بوسطة / الشحن معاً (متعدد الملفات)
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ارفع أي شيت بوسطة وسيتعرف تلقائياً على <strong>Orders</strong> و<strong>Cash Cycles</strong> و<strong>Transactions</strong> و<strong>Compensations</strong> و<strong>Pickup Requests</strong> و<strong>Bosta Credits</strong>
            </p>
          </div>

          {/* Right Side: Calculation Mode Switch & Filters */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  نظام احتساب المبالغ (يدعم صافي التحويل وإجمالي التحصيل + الشحن معاً)
                </label>
                {allHeaders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMappingDrawer(v => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>تخصيص ربط الأعمدة</span>
                    {showMappingDrawer ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                {(
                  [
                    {
                      id: 'net_payout' as CodSheetAmountMode,
                      title: 'صافي التحويل مباشرة',
                      desc: 'الشحن مخصوم مسبقاً بالشيت'
                    },
                    {
                      id: 'gross_and_fees' as CodSheetAmountMode,
                      title: 'إجمالي التحصيل + الشحن',
                      desc: 'يدقق COD و Total Fees و Net Value'
                    },
                    {
                      id: 'gross_only' as CodSheetAmountMode,
                      title: 'إجمالي التحصيل فقط',
                      desc: 'مقارنة قيمة الكاش المحصّل فقط'
                    }
                  ] as const
                ).map(modeOpt => {
                  const active = mapping.amountMode === modeOpt.id;
                  return (
                    <button
                      key={modeOpt.id}
                      type="button"
                      onClick={() => setMapping(prev => ({ ...prev, amountMode: modeOpt.id }))}
                      className={`text-right px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between gap-1">
                        <span>{modeOpt.title}</span>
                        {active && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {modeOpt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 ${auditResult.availableSheetBrands.length > 0 ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  تصفية شركة الشحن
                </label>
                <div className="relative">
                  <Truck className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={carrierFilter}
                    onChange={e => setCarrierFilter(e.target.value)}
                    className="w-full pr-8 pl-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="all">جميع شركات الشحن</option>
                    {availableCarriers.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {auditResult.availableSheetBrands.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    تصفية البراند / الحساب بالشيت
                  </label>
                  <select
                    value={sheetBrandFilter}
                    onChange={e => setSheetBrandFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="all">كل البراندات ({auditResult.availableSheetBrands.length})</option>
                    {auditResult.availableSheetBrands.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  مهلة تحذير الشحنات (أيام)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={graceDays}
                  onChange={e => handleSaveGraceDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  سماحية فرق الكسور (ج.م)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={toleranceEgp}
                  onChange={e => setToleranceEgp(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  حد مصاريف الشحن (ج.م)
                </label>
                <input
                  type="number"
                  min={20}
                  step={5}
                  value={maxExpectedShippingFee}
                  onChange={e =>
                    setMaxExpectedShippingFee(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  title="أي شحنة تتجاوز مصاريفها هذا الحد تظهر تلقائياً في تبويب مصاريف ووزن زائد"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Uploaded Files with Role Selector */}
        {uploadedFiles.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                <span>الشيتات المرفوعة ({uploadedFiles.length}):</span>
              </span>
              {uploadedFiles.map(f => (
                <div
                  key={f.id}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="max-w-[150px] truncate font-bold">{f.fileName}</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    ({f.rows.length})
                  </span>
                  <select
                    value={f.role}
                    onChange={e => handleRoleChange(f.id, e.target.value as UploadedSheetRole)}
                    className="text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400"
                    title="تصنيف نوع الشيت"
                  >
                    <option value="cash_cycles">Cash Cycles (دورات)</option>
                    <option value="bosta_orders">أوردرات بوسطة/الشحن</option>
                    <option value="transactions">Transactions (تحويلات)</option>
                    <option value="compensations">تعويضات (Compensations)</option>
                    <option value="pickup_requests">طلبات البيك أب (Pickup)</option>
                    <option value="bosta_credits">رصيد بوسطة (Bosta Credits)</option>
                    <option value="warehouse_orders">أوردرات المستودع</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(f.id)}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="إزالة الملف"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {Object.keys(manualMatches).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setManualMatches({});
                    notify('تم مسح جميع المطابقات اليدوية.');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>مسح الربط اليدوي ({Object.keys(manualMatches).length})</span>
                </button>
              )}
              {Object.keys(manualCreditTrackingMap).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setManualCreditTrackingMap({});
                    notify('تم مسح ربط قسائم النقاط اليدوي.');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>مسح ربط النقاط ({Object.keys(manualCreditTrackingMap).length})</span>
                </button>
              )}
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                محفوظ تلقائياً بالمتصفح
              </span>
              <button
                type="button"
                onClick={() => {
                  setUploadedFiles([]);
                  clearCodHunterFiles(storeId);
                  notify('تم مسح الشيتات المرفوعة مع الاحتفاظ بتأكيدات البنك المحفوظة.');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح جميع الشيتات</span>
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Column Mapping Panel */}
        {showMappingDrawer && allHeaders.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span>ضبط أعمدة الشيتات يدوياً (شامل أعمدة بوسطة Cash Cycles و Orders)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMapping(autoDetectSheetMapping(allHeaders))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>كشف تلقائي</span>
                </button>
                {onSaveCarrierProfile && (
                  <button
                    type="button"
                    onClick={handleSaveCarrierProfile}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>حفظ قالب {carrierFilter === 'all' ? 'عام' : carrierFilter}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود البوليصة / Order Id *
                </label>
                <select
                  value={mapping.trackingCol}
                  onChange={e => setMapping(p => ({ ...p, trackingCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- غير محدد --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود صافي التحويل (Net Value)
                </label>
                <select
                  value={mapping.netAmountCol}
                  onChange={e => setMapping(p => ({ ...p, netAmountCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- غير محدد --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود إجمالي التحصيل (COD)
                </label>
                <select
                  value={mapping.grossAmountCol}
                  onChange={e => setMapping(p => ({ ...p, grossAmountCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- غير محدد --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود مصاريف الشحن (Total Fees)
                </label>
                <select
                  value={mapping.feesAmountCol}
                  onChange={e => setMapping(p => ({ ...p, feesAmountCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- غير محدد --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود حالة الدفع (Payment Status)
                </label>
                <select
                  value={mapping.paymentStatusCol || ''}
                  onChange={e => setMapping(p => ({ ...p, paymentStatusCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- لا يوجد بالشيت --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود كود التحويل (Cash-out ID)
                </label>
                <select
                  value={mapping.cashoutIdCol || ''}
                  onChange={e => setMapping(p => ({ ...p, cashoutIdCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- لا يوجد بالشيت --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود الحالة (Delivery State)
                </label>
                <select
                  value={mapping.statusCol}
                  onChange={e => setMapping(p => ({ ...p, statusCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- غير محدد --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود المرجع الداخلي (Business Reference)
                </label>
                <select
                  value={mapping.businessRefCol || ''}
                  onChange={e => setMapping(p => ({ ...p, businessRefCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- غير محدد --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  عمود الهاتف للمطابقة الاحتياطية (Phone)
                </label>
                <select
                  value={mapping.phoneCol || ''}
                  onChange={e => setMapping(p => ({ ...p, phoneCol: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- غير محدد --</option>
                  {allHeaders.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Audit Workspace */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Segmented Navigation Bar & Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0">
            {(
              [
                {
                  id: 'untransferred' as AuditTabId,
                  label: 'متحصل ولم يُحوّل',
                  count: auditResult.collectedUntransferred.length,
                  accent: 'text-rose-600 dark:text-rose-400',
                  hidden: false
                },
                {
                  id: 'uncollected' as AuditTabId,
                  label: 'مسلّمة لم تظهر بالشيت',
                  count: auditResult.uncollectedDelivered.length,
                  accent: 'text-rose-600 dark:text-rose-400',
                  hidden: !matchWithStoreOrders
                },
                {
                  id: 'discrepancy' as AuditTabId,
                  label: 'عجز وفروقات الشيت',
                  count: auditResult.shortPaid.length + auditResult.overPaid.length,
                  accent: 'text-amber-600 dark:text-amber-400',
                  hidden: false
                },
                {
                  id: 'not_collected' as AuditTabId,
                  label: 'لم يُحصّل (مرتجع)',
                  count: auditResult.notCollectedCustomer.length,
                  accent: 'text-slate-600 dark:text-slate-400',
                  hidden: false
                },
                {
                  id: 'missing_comp' as AuditTabId,
                  label: 'تعويضات مفقودة',
                  count: auditResult.missingCompensations.length,
                  accent: 'text-rose-600 dark:text-rose-400',
                  hidden: uploadedFiles.length === 0
                },
                {
                  id: 'fee_anomalies' as AuditTabId,
                  label: 'مصاريف ووزن وبيك أب',
                  count: auditResult.feeAnomalies.length + auditResult.totals.wrongfulPickupFeeCount,
                  accent:
                    auditResult.totals.wrongfulPickupFeeCount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400',
                  hidden: uploadedFiles.length === 0
                },
                {
                  id: 'fraud_alerts' as AuditTabId,
                  label: 'كاشف النصب والتلاعب',
                  count: auditResult.internalFraudAlerts.length,
                  accent: 'text-rose-600 dark:text-rose-400',
                  hidden: uploadedFiles.length === 0 && !matchWithStoreOrders
                },
                {
                  id: 'zero_attempt_returns' as AuditTabId,
                  label: 'مرتجعات بدون محاولات',
                  count: auditResult.zeroAttemptReturns.length,
                  accent: 'text-amber-600 dark:text-amber-400',
                  hidden: uploadedFiles.length === 0
                },
                {
                  id: 'customer_risk' as AuditTabId,
                  label: 'العملاء الخطِرين',
                  count: auditResult.customerRiskAlerts.length,
                  accent: 'text-rose-600 dark:text-rose-400',
                  hidden: uploadedFiles.length === 0 && !matchWithStoreOrders
                },
                {
                  id: 'exchange_audits' as AuditTabId,
                  label: 'الاستبدال والجزئي (Exchange / Pick&Choose)',
                  count: auditResult.totals.exchangeIssueCount,
                  accent:
                    auditResult.totals.exchangeIssueCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400',
                  hidden: uploadedFiles.length === 0
                },
                {
                  id: 'stuck_returns' as AuditTabId,
                  label: 'مرتجعات محتجزة بالفروع',
                  count: auditResult.stuckReturns.length,
                  accent: 'text-amber-600 dark:text-amber-400',
                  hidden: uploadedFiles.length === 0
                },
                {
                  id: 'online_flex' as AuditTabId,
                  label: 'أونلاين و FlexShip',
                  count: auditResult.onlineAndFlexAlerts.length,
                  accent: 'text-indigo-600 dark:text-indigo-400',
                  hidden: uploadedFiles.length === 0
                },
                {
                  id: 'in_transit_sheet' as AuditTabId,
                  label: 'قيد التشغيل بالشيت',
                  count: auditResult.inTransitInSheet.length,
                  accent: 'text-indigo-600 dark:text-indigo-400',
                  hidden: auditResult.inTransitInSheet.length === 0
                },
                {
                  id: 'overdue' as AuditTabId,
                  label: 'متأخرة بالشحن',
                  count: auditResult.inTransitOverdue.length,
                  accent: 'text-amber-600 dark:text-amber-400',
                  hidden: !matchWithStoreOrders
                },
                {
                  id: 'matched' as AuditTabId,
                  label: 'مثبت ومطابق',
                  count: auditResult.matchedReady.length,
                  accent: 'text-emerald-600 dark:text-emerald-400',
                  hidden: false
                },
                {
                  id: 'transactions_ledger' as AuditTabId,
                  label: 'سجل Transactions',
                  count: auditResult.transactionsSummary.ledgerRows.length,
                  accent: 'text-indigo-600 dark:text-indigo-400',
                  hidden: !auditResult.transactionsSummary.hasTransactionsSheet
                },
                {
                  id: 'compensations' as AuditTabId,
                  label: 'مركز التعويضات (محفظة + شيت)',
                  count:
                    auditResult.compensationsSummary.entries.length +
                    auditResult.transactionsSummary.walletCompensations.length,
                  accent:
                    auditResult.totals.underCompensatedCount > 0 ||
                    auditResult.totals.undocumentedWalletCompCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400',
                  hidden:
                    !auditResult.compensationsSummary.hasCompensationsSheet &&
                    auditResult.transactionsSummary.walletCompensations.length === 0
                },
                {
                  id: 'pickup_requests' as AuditTabId,
                  label: 'طلبات البيك أب',
                  count: auditResult.pickupRequestsSummary.totalPickups,
                  accent:
                    auditResult.pickupRequestsSummary.crossBrandSwapCount > 0 ||
                    auditResult.pickupRequestsSummary.wrongfulPickupFeeCount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-indigo-600 dark:text-indigo-400',
                  hidden: !auditResult.pickupRequestsSummary.hasPickupSheet
                },
                {
                  id: 'bosta_credits' as AuditTabId,
                  label: 'رصيد بوسطة (Credits)',
                  count: auditResult.bostaCreditsSummary.entries.length,
                  accent: 'text-emerald-600 dark:text-emerald-400',
                  hidden: !auditResult.bostaCreditsSummary.hasCreditsSheet
                },
                {
                  id: 'duplicate' as AuditTabId,
                  label: 'مكرر / محصّل سابقاً',
                  count: auditResult.duplicates.length,
                  accent: 'text-amber-600 dark:text-amber-400',
                  hidden: false
                },
                {
                  id: 'not_found' as AuditTabId,
                  label: 'غير مسجل',
                  count: auditResult.notFound.length,
                  accent: 'text-slate-500',
                  hidden: false
                },
                {
                  id: 'batches' as AuditTabId,
                  label: 'أرشيف الدفعات',
                  count: savedBatches.length,
                  accent: 'text-indigo-600 dark:text-indigo-400',
                  hidden: !allowBatchSettlement
                }
              ] as const
            )
              .filter(t => !t.hidden)
              .map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`font-mono tabular-nums text-[11px] ${isActive ? 'opacity-90' : tab.accent}`}>
                      ({tab.count.toLocaleString('en-US')})
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'uncollected' && matchWithStoreOrders && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <Filter className="w-3.5 h-3.5 text-slate-400 mx-1" />
                {(
                  [
                    { id: 'all', label: 'الكل' },
                    { id: '3', label: '+3 أيام' },
                    { id: '7', label: '+7 أيام' },
                    { id: '14', label: '+14 يوم' }
                  ] as const
                ).map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDelayFilterDays(d.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      delayFilterDays === d.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث بالبوليصة، الأوردر، العميل، Cash-out ID..."
                className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>
        </div>

        {/* Active Linked General Cashout Guidance Banner */}
        {activeLinkedCashoutId && allowBatchSettlement && matchWithStoreOrders && activeTab !== 'batches' && (
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold">
              <Link2 className="w-4 h-4 shrink-0" />
              <span>
                وضع ربط التحويل العام{' '}
                <span className="font-mono tabular-nums font-black">{activeLinkedCashoutId}</span>: حدد الشحنات المشمولة ثم اضغط اعتماد.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={selectedRowsList.length === 0}
                onClick={() => openSettleModal(activeLinkedCashoutId)}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                اعتماد ({selectedRowsList.length}) برقم {activeLinkedCashoutId}
              </button>
              <button
                type="button"
                onClick={() => setActiveLinkedCashoutId('')}
                className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-bold text-[11px] cursor-pointer whitespace-nowrap"
              >
                إلغاء التوجيه
              </button>
            </div>
          </div>
        )}

        {/* Claim Summary Ribbon */}
        {totalClaimsAmount > 0 && activeTab !== 'batches' && (
          <div className="px-4 py-2.5 bg-rose-50/70 dark:bg-rose-950/25 border-b border-rose-100 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>إجمالي المطالبة المالية المعلّقة أو الناقصة:</span>
              <span className="font-mono tabular-nums text-sm font-black">
                {formatEgp(totalClaimsAmount)}
              </span>
            </div>
            <span className="text-[11px] text-rose-600/80 dark:text-rose-300/80 font-mono tabular-nums">
              {auditResult.collectedUntransferred.length} متحصل بلا تحويل ·{' '}
              {auditResult.uncollectedDelivered.length} مسلّم لم يظهر بالشيت ·{' '}
              {auditResult.shortPaid.length} عجز
            </span>
          </div>
        )}

        {/* TAB: COLLECTED BY COURIER, NOT TRANSFERRED TO YOU (Bosta Not Paid / Missing Cash-out ID) */}
        {activeTab === 'untransferred' && (
          <div className="overflow-x-auto">
            {uploadedFiles.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  ارفع شيت أوردرات بوسطة أو Cash Cycles لاصطياد الشحنات المتحصلة التي لم تُحوّل لك.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يمسك النظام تلقائياً أي شحنة حالتها DELIVERED و COD &gt; 0 لكن حالة دفعها Not Paid أو بدون Cash-out ID.
                </p>
              </div>
            ) : filteredUntransferred.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  لا توجد شحنات متحصلة بدون تحويل (Not Paid) في الشيتات المرفوعة!
                </p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {allowBatchSettlement && matchWithStoreOrders && (
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredUntransferred.some(r => r.matchedOrder) &&
                            filteredUntransferred
                              .filter(r => r.matchedOrder)
                              .every(r => selectedRowIds.has(r.id))
                          }
                          onChange={() =>
                            toggleSelectAllInTab(filteredUntransferred.filter(r => r.matchedOrder))
                          }
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4 font-bold">رقم التتبع / البوليصة</th>
                    <th className="py-3 px-3 font-bold">الأوردر والعميل</th>
                    <th className="py-3 px-3 font-bold">حالة الشحنة والدفع بالشيت</th>
                    <th className="py-3 px-3 font-bold text-left">قيمة COD</th>
                    <th className="py-3 px-3 font-bold text-left">المصاريف</th>
                    <th className="py-3 px-3 font-bold text-left">صافي مستحق لم يُحوّل</th>
                    <th className="py-3 px-4 font-bold">التشخيص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUntransferred.map(row => {
                    const checked = selectedRowIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {allowBatchSettlement && matchWithStoreOrders && (
                          <td className="py-3 px-3 text-center">
                            {row.matchedOrder ? (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRowSelection(row.id)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {row.trackingKey}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {row.fileName} (صف {row.rowIndex})
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {row.matchedOrder ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                {renderOrderTrigger(
                                  row.matchedOrder,
                                  `#${row.matchedOrder.orderNumber}`
                                )}
                                {manualMatches[row.id] && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setManualMatches(prev => {
                                        const next = { ...prev };
                                        delete next[row.id];
                                        return next;
                                      })
                                    }
                                    className="text-[10px] text-amber-600 hover:underline cursor-pointer"
                                    title="إلغاء الربط اليدوي"
                                  >
                                    فك
                                  </button>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {row.matchedOrder.customerName}
                              </div>
                            </>
                          ) : (
                            <div className="space-y-1">
                              <div className="font-bold text-slate-800 dark:text-slate-100">
                                {row.customerName || row.businessRefKey || 'عميل الشيت'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {row.phoneRaw || row.businessRefKey || '-'}
                                {row.dropoffCity ? ` · ${row.dropoffCity}` : ''}
                                {row.brandName ? ` · ${row.brandName}` : ''}
                              </div>
                              {matchWithStoreOrders && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManualLinkRow(row);
                                    setManualOrderSearch(row.phoneRaw || row.businessRefKey || row.customerName || '');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 text-[10px] font-bold cursor-pointer"
                                >
                                  <Link2 className="w-3 h-3" />
                                  <span>ربط بأوردر</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-700 dark:text-slate-200">
                            {row.sheetStatus || 'DELIVERED'} ·{' '}
                            <span className="text-rose-600 dark:text-rose-400">
                              {row.sheetPaymentStatus || 'Not Paid'}
                            </span>
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            Cash-out: {row.sheetCashoutId || 'N/A'}
                            {(row.sheetDeliveredAt || row.sheetDate) ? ` · ${row.sheetDeliveredAt || row.sheetDate}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatEgp(row.sheetGrossAmount)}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {formatEgp(row.sheetFeesAmount)}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {formatEgp(row.sheetNetPayout)}
                        </td>
                        <td className="py-3 px-4 max-w-[280px] text-[11px] text-slate-600 dark:text-slate-300">
                          <div className="font-bold text-rose-600 dark:text-rose-400 mb-0.5">
                            {row.moneyStatusLabel}
                          </div>
                          <div>{row.reasonSummary}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: DELIVERED IN LIVE ORDERS MISSING FROM SHEETS */}
        {activeTab === 'uncollected' && matchWithStoreOrders && (
          <div className="overflow-x-auto">
            {filteredUncollected.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  ممتاز! لا توجد أوردرات مسلّمة بالطلبات بدون شيت أو دفعة تحصيل.
                </p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">الأوردر والبوليصة</th>
                    <th className="py-3 px-3 font-bold">العميل والهاتف</th>
                    <th className="py-3 px-3 font-bold">شركة الشحن</th>
                    <th className="py-3 px-3 font-bold">التاريخ والتأخير</th>
                    <th className="py-3 px-3 font-bold text-left">إجمالي التحصيل</th>
                    <th className="py-3 px-3 font-bold text-left">شحن متوقع</th>
                    <th className="py-3 px-3 font-bold text-left">صافي مستحق لك</th>
                    <th className="py-3 px-4 font-bold">تشخيص النظام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUncollected.map(item => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderOrderTrigger(item.order, `#${item.order.orderNumber}`)}
                        <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                          {item.trackingDisplay}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {item.order.customerName}
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                          {item.order.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-300">
                        {item.order.shippingCompany || 'غير محدد'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {formatDateShort(item.order.date)}
                        </div>
                        <div
                          className={`font-mono tabular-nums text-[11px] font-bold mt-0.5 ${
                            item.daysElapsed >= 7 ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        >
                          منذ {item.daysElapsed} يوم
                        </div>
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatEgp(item.expectation.expectedGrossCod)}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {formatEgp(item.expectation.expectedCarrierFees)}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {formatEgp(item.expectation.expectedNetPayout)}
                      </td>
                      <td className="py-3 px-4 max-w-[260px] text-[11px] text-slate-600 dark:text-slate-400">
                        {item.reasonSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: DISCREPANCIES (SHORT PAID / OVER PAID) */}
        {activeTab === 'discrepancy' && (
          <div className="overflow-x-auto">
            {uploadedFiles.length === 0 ? (
              <div className="py-16 px-4 text-center text-slate-500 text-xs">
                ارفع شيتات الإكسيل أولاً لكشف أي عجز في التحويل أو خصم مصاريف شحن زائدة.
              </div>
            ) : filteredDiscrepancies.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  لا توجد أي فروقات مالية أو عجز في الشيتات المرفوعة!
                </p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {allowBatchSettlement && matchWithStoreOrders && (
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredDiscrepancies.some(r => r.matchedOrder) &&
                            filteredDiscrepancies
                              .filter(r => r.matchedOrder)
                              .every(r => selectedRowIds.has(r.id))
                          }
                          onChange={() =>
                            toggleSelectAllInTab(filteredDiscrepancies.filter(r => r.matchedOrder))
                          }
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                    )}
                    <th className="py-3 px-3 font-bold">البوليصة والأوردر</th>
                    <th className="py-3 px-3 font-bold">الشيت</th>
                    <th className="py-3 px-3 font-bold text-left">صافي الشيت</th>
                    <th className="py-3 px-3 font-bold text-left">مصاريف الشيت</th>
                    <th className="py-3 px-3 font-bold text-left">المستحق</th>
                    <th className="py-3 px-3 font-bold text-left">الفرق (العجز)</th>
                    <th className="py-3 px-4 font-bold">سبب الفرق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDiscrepancies.map(row => {
                    const isShort = row.category === 'short_paid';
                    const checked = selectedRowIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          checked ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        {allowBatchSettlement && matchWithStoreOrders && (
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRowSelection(row.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        )}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-bold">{row.trackingKey}</div>
                          {row.matchedOrder &&
                            renderOrderTrigger(
                              row.matchedOrder,
                              `#${row.matchedOrder.orderNumber} · ${row.matchedOrder.customerName}`,
                              'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block mt-0.5 text-right cursor-pointer'
                            )}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-500">
                          <div className="max-w-[140px] truncate">{row.fileName}</div>
                          <div className="font-mono tabular-nums">صف {row.rowIndex}</div>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums font-bold whitespace-nowrap">
                          {formatEgp(row.sheetNetPayout)}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {formatEgp(row.sheetFeesAmount)}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums font-bold whitespace-nowrap">
                          {formatEgp(row.expectation?.expectedNetPayout ?? row.sheetGrossAmount - row.sheetFeesAmount)}
                        </td>
                        <td
                          className={`py-3 px-3 text-left font-mono tabular-nums font-black whitespace-nowrap ${
                            isShort
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {row.netVariance > 0
                            ? `+${formatEgp(row.netVariance)}`
                            : formatEgp(row.netVariance)}
                        </td>
                        <td className="py-3 px-4 max-w-[260px] text-[11px] text-slate-600 dark:text-slate-300">
                          {row.reasonSummary}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: NOT COLLECTED FROM CUSTOMER (RETURNED / EXCEPTION / CANCELED IN SHEET) */}
        {activeTab === 'not_collected' && (
          <div className="space-y-3">
            {auditResult.notCollectedCustomer.length > 0 && (
              <div className="mx-4 mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                    <span>إجمالي رسوم المرتجعات المخصومة:</span>
                    <span className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                      -{formatEgp(auditResult.totals.returnedFeesDeducted)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-[11px]">
                    <span
                      className={`px-2.5 py-1 rounded-lg border font-bold ${
                        auditResult.totals.returnedInsuranceCount > 0
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      تأمين مخصوم على مرتجعات: {auditResult.totals.returnedInsuranceCount} شحنة (
                      {formatEgp(auditResult.totals.returnedInsuranceWithVat)} شاملة الضريبة)
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg border font-bold ${
                        auditResult.totals.returnedOpeningCount > 0
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      رسوم فتح شحنة على مرتجعات: {auditResult.totals.returnedOpeningCount} شحنة (
                      {formatEgp(auditResult.totals.returnedOpeningWithVat)} شاملة الضريبة)
                    </span>
                    {auditResult.totals.returnedUntouchedOpeningCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFeeAnomalyFilter('untouched_opening');
                          setActiveTab('fee_anomalies');
                        }}
                        className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-100/80 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 font-black hover:underline cursor-pointer"
                      >
                        منها فتح باطل (لم يلمسها العميل): {auditResult.totals.returnedUntouchedOpeningCount} شحنة (
                        {formatEgp(auditResult.totals.returnedUntouchedOpeningWithVat)}) ↗
                      </button>
                    )}
                  </div>
                </div>

                {/* Warehouse Return Proof Summary & Quick Filter Pills */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-bold text-slate-600 dark:text-slate-300 ml-1">
                      تأكيد رجوع البضاعة لمخزنك:
                    </span>
                    <button
                      type="button"
                      onClick={() => setReturnWarehouseFilter('all')}
                      className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                        returnWarehouseFilter === 'all'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      الكل ({auditResult.notCollectedCustomer.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnWarehouseFilter('returned_to_merchant')}
                      className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer font-mono tabular-nums ${
                        returnWarehouseFilter === 'returned_to_merchant'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      رجع لمخزنك ✅ ({auditResult.totals.returnedConfirmedToWarehouseCount + auditResult.totals.returnedStockNotRestoredCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnWarehouseFilter('not_returned_yet')}
                      className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer font-mono tabular-nums ${
                        returnWarehouseFilter === 'not_returned_yet'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      لسه ببوسطة / بلا إثبات ⚠️ ({auditResult.totals.returnedNotInWarehouseCount})
                    </button>
                    {auditResult.totals.returnedStockNotRestoredCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setReturnWarehouseFilter('stock_mismatch')}
                        className={`px-2.5 py-1 rounded-lg border font-black transition-all cursor-pointer font-mono tabular-nums ${
                          returnWarehouseFilter === 'stock_mismatch'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        رجع ببوسطة ولم يُردّ للمخزون 🚨 ({auditResult.totals.returnedStockNotRestoredCount})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              {filteredNotCollectedCustomer.length === 0 ? (
                <div className="py-16 px-4 text-center text-slate-500 text-xs">
                  لا توجد شحنات مرتجعة مطابقة للتصفية المحددة.
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">البوليصة والأوردر</th>
                    <th className="py-3 px-3 font-bold">العميل والبراند</th>
                    <th className="py-3 px-3 font-bold">حالة رجوع البضاعة لمخزنك</th>
                    <th className="py-3 px-3 font-bold">التسوية والحالة</th>
                    <th className="py-3 px-3 font-bold text-left">تفصيل رسوم الشحن</th>
                    <th className="py-3 px-3 font-bold text-left">صافي الشيت</th>
                    <th className="py-3 px-4 font-bold">التشخيص وسبب الارتجاع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredNotCollectedCustomer.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold">{row.trackingKey}</div>
                        {row.matchedOrder &&
                          renderOrderTrigger(
                            row.matchedOrder,
                            `#${row.matchedOrder.orderNumber}`,
                            'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
                          )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {row.matchedOrder?.customerName || row.customerName || '-'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {row.brandName || '-'}
                          {row.dropoffCity ? ` · ${row.dropoffCity}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-[230px]">
                        {row.warehouseReturnStatus === 'returned_to_merchant_confirmed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-[11px]">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            رجع لمخزنك بتأكيد بوسطة
                          </span>
                        ) : row.warehouseReturnStatus === 'returned_stock_not_restored' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 font-black text-[11px]">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            رجع ببوسطة ولم يُردّ للمخزون!
                          </span>
                        ) : row.warehouseReturnStatus === 'still_at_bosta_hub' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-black text-[11px]">
                            <Clock className="w-3 h-3 shrink-0" />
                            مازال في بوسطة — لم يرجع
                          </span>
                        ) : row.warehouseReturnStatus === 'canceled_before_pickup' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                            ملغي قبل الخروج (بمخزنك)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            بدون إثبات تسليم للراسل
                          </span>
                        )}
                        {row.wrongReturnWarehouseNote && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>مرتجع لمخزن خاطئ (تبديل بيك أب!)</span>
                          </div>
                        )}
                        {row.warehouseReturnNote && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {row.warehouseReturnNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-700 dark:text-slate-200">
                          {row.sheetStatus || '-'}
                        </div>
                        {row.sheetCashoutId && (
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            {row.sheetCashoutId}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left whitespace-nowrap">
                        <div className="font-mono tabular-nums text-slate-600 dark:text-slate-300 font-bold">
                          {formatEgp(row.sheetFeesAmount)}
                        </div>
                        {row.feeBreakdown && (
                          <div className="font-mono tabular-nums text-[10px] text-slate-500 mt-0.5">
                            شحن {row.feeBreakdown.shippingFees} · تأمين {row.feeBreakdown.insuranceFees} · فتح {row.feeBreakdown.openingPackageFees} · ض {row.feeBreakdown.vat}
                            {row.feeBreakdown.flexShipAmount > 0 ? ` · Flex -${row.feeBreakdown.flexShipAmount}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {formatEgp(row.sheetNetPayout)}
                      </td>
                      <td className="py-3 px-4 max-w-[260px] text-[11px] text-slate-600 dark:text-slate-400">
                        {row.reasonSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>
        )}

        {/* TAB: MISSING COMPENSATIONS (LOST / DAMAGED / MISSING UNCOMPENSATED OR UNDER-COMPENSATED) */}
        {activeTab === 'missing_comp' && (
          <div className="space-y-3">
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  شحنات تالفة أو مفقودة بلا تعويض أو تعويضها منقوص ولم يثبت رجوعها للمخزن في Deliveries Export
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                {auditResult.totals.underCompensatedCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 font-black text-amber-700 dark:text-amber-300 text-[11px]">
                    {auditResult.totals.underCompensatedCount} تعويض منقوص (عجز{' '}
                    {formatEgp(auditResult.totals.underCompensatedShortfallAmount)})
                  </span>
                )}
                {auditResult.totals.missingCompensationsAmount > 0 && (
                  <div className="font-black text-rose-600 dark:text-rose-400">
                    إجمالي المستحق للمطالبة: {formatEgp(auditResult.totals.missingCompensationsAmount)}
                  </div>
                )}
              </div>
            </div>

            {(auditResult.compensationsSummary.returnedRtoShippingRefundCount > 0 ||
              auditResult.compensationsSummary.outsideDeliveriesRtoCount > 0) && (
              <div className="mx-4 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2 text-emerald-800 dark:text-emerald-200 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {auditResult.compensationsSummary.returnedRtoShippingRefundCount > 0 && (
                      <>
                        تم استبعاد{' '}
                        <strong className="font-mono tabular-nums">
                          {auditResult.compensationsSummary.returnedRtoShippingRefundCount}
                        </strong>{' '}
                        تعويض مرتجع (RTO 46) أوتوماتيكياً بعد إثبات عودة البضاعة لمخزنك في{' '}
                        <code className="font-mono">Deliveries Export</code> + استرداد مصاريف الشحن.
                      </>
                    )}
                    {auditResult.compensationsSummary.outsideDeliveriesRtoCount > 0 && (
                      <>
                        {' '}
                        يوجد{' '}
                        <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                          {auditResult.compensationsSummary.outsideDeliveriesRtoCount}
                        </strong>{' '}
                        تعويض RTO (46) أقدم من شيت Deliveries المرفوع (تحقق منه في تبويب التعويضات).
                      </>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('compensations')}
                  className="font-black text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer shrink-0"
                >
                  عرض تحليل التعويضات ↗
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              {filteredMissingComp.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    لا توجد شحنات مفقودة أو تالفة غير معوضة أو منقوصة في الشيتات المرفوعة.
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">البوليصة والأوردر</th>
                      <th className="py-3 px-3 font-bold">العميل والبراند</th>
                      <th className="py-3 px-3 font-bold">الحالة بالشيت ونوع التنبيه</th>
                      <th className="py-3 px-3 font-bold">التاريخ</th>
                      <th className="py-3 px-3 font-bold text-left">العجز / المطالبة</th>
                      <th className="py-3 px-4 font-bold">التشخيص والمطالبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMissingComp.map(item => {
                      const isUnder = item.alertKind === 'under_compensated';
                      return (
                        <tr
                          key={item.id}
                          className={
                            isUnder
                              ? 'bg-amber-50/35 dark:bg-amber-950/15 hover:bg-amber-50/60'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                              {item.trackingKey}
                            </div>
                            {item.matchedOrder ? (
                              renderOrderTrigger(
                                item.matchedOrder,
                                `#${item.matchedOrder.orderNumber}`,
                                'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
                              )
                            ) : item.orderNumber ? (
                              <div className="font-mono tabular-nums text-[11px] text-slate-500">
                                #{item.orderNumber}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {item.customerName || '-'}
                            </div>
                            <div className="font-mono tabular-nums text-[11px] text-slate-500">
                              {item.customerPhone || '-'}
                              {item.brandName ? ` · ${item.brandName}` : ''}
                              {item.dropoffCity ? ` · ${item.dropoffCity}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`font-bold ${
                                  isUnder
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {item.sheetStatus}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  isUnder
                                    ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                    : 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {isUnder
                                  ? `تعويض منقوص · دُفع +${formatEgp(item.paidCompensationAmount || 0)} فقط`
                                  : 'بلا تعويض'}
                              </span>
                            </div>
                            {item.exceptionReason && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.exceptionReason}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {item.sheetDate || '-'}
                          </td>
                          <td className="py-3 px-3 text-left font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {formatEgp(item.estimatedValue)}
                          </td>
                          <td className="py-3 px-4 max-w-[280px] text-[11px] text-slate-600 dark:text-slate-300">
                            {item.reasonSummary}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: FEE ANOMALIES & OVERWEIGHT AUDIT + ZONE RATE CARD */}
        {activeTab === 'fee_anomalies' && (
          <div className="space-y-3">
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  فاحص تعريفة المحافظات، السحب السريع/POS الخفي، الوزن الزائد، ودقة معادلات Cash Cycles (الحد العام:{' '}
                  <strong className="font-mono tabular-nums">{formatEgp(maxExpectedShippingFee)}</strong>)
                </span>
              </div>
              {auditResult.totals.totalFeeOverchargeAmount > 0 && (
                <div className="font-mono tabular-nums font-black text-amber-600 dark:text-amber-400">
                  إجمالي التجاوز التقديري: {formatEgp(auditResult.totals.totalFeeOverchargeAmount)}
                </div>
              )}
            </div>

            {/* Interactive 7-Zone x 6-Size x 5-DeliveryType Bosta Rate Plan */}
            <div className="mx-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    خطة الأسعار الحالية حسب المنطقة والحجم ونوع التوصيل (بالجنيه المصري — قبل الضريبة 14%):
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    مطابقة 100% لجدول أسعار بوسطة (7 مناطق × 6 أحجام × 5 أنواع توصيل) وتُحفظ تلقائياً لكل متجر
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span>الحد المجاني للبيك أب (شحنات):</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      value={zoneRates.minFreePickupShipments ?? 3}
                      onChange={e =>
                        setZoneRates(p => ({
                          ...p,
                          minFreePickupShipments: Math.max(1, Number(e.target.value) || 3)
                        }))
                      }
                      className="w-16 px-2 py-1 text-center font-mono tabular-nums font-black bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setZoneRates(DEFAULT_ZONE_RATE_CONFIG);
                      notify('تمت إعادة ضبط خطة الأسعار الكاملة (7 مناطق × 6 أحجام) للقيم الافتراضية.');
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    إعادة لخطة بوسطة الافتراضية
                  </button>
                </div>
              </div>

              {/* 7 Bosta Zone Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                {BOSTA_ZONE_META.map(z => {
                  const isActive = activeRatePlanZone === z.id;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setActiveRatePlanZone(z.id)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all duration-200 border text-center cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {z.labelAr}
                    </button>
                  );
                })}
              </div>

              {/* Active Zone Subtitle */}
              <div className="text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {BOSTA_ZONE_META.find(z => z.id === activeRatePlanZone)?.subtitleAr}
              </div>

              {/* 6 Sizes x 5 Service Types Editable Matrix Table */}
              <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">حجم الشحنة</th>
                      {BOSTA_SERVICE_TYPE_META.map(srv => (
                        <th key={srv.id} className="py-2.5 px-3 font-bold text-center whitespace-nowrap">
                          {srv.labelAr}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {BOSTA_PACKAGE_SIZE_META.map(sz => {
                      const activeMatrix: BostaRateMatrix =
                        zoneRates.rateMatrix || DEFAULT_BOSTA_RATE_MATRIX;
                      const rowRates =
                        activeMatrix[activeRatePlanZone]?.[sz.id] ||
                        DEFAULT_BOSTA_RATE_MATRIX[activeRatePlanZone][sz.id];

                      const updateCell = (srvId: BostaServiceTypeId, val: number) => {
                        setZoneRates(prev => {
                          const baseMatrix: BostaRateMatrix =
                            prev.rateMatrix || DEFAULT_BOSTA_RATE_MATRIX;
                          const nextZoneTable = {
                            ...baseMatrix[activeRatePlanZone],
                            [sz.id]: {
                              ...baseMatrix[activeRatePlanZone][sz.id],
                              [srvId]: Math.max(0, val)
                            }
                          };
                          return {
                            ...prev,
                            rateMatrix: {
                              ...baseMatrix,
                              [activeRatePlanZone]: nextZoneTable
                            }
                          };
                        });
                      };

                      return (
                        <tr key={sz.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {sz.labelAr}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {sz.bostaCsvValues}
                            </div>
                          </td>
                          {BOSTA_SERVICE_TYPE_META.map(srv => (
                            <td key={srv.id} className="py-1.5 px-2 text-center">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={rowRates[srv.id]}
                                onChange={e => updateCell(srv.id, Number(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-center font-mono tabular-nums font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:outline-none"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {auditResult.pickupFeeAudits.length > 0 && (
              <div className="mx-4 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/60 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      تدقيق خصومات البيك أب في Transactions (القاعدة: أقل من{' '}
                      <span className="font-mono tabular-nums">{zoneRates.minFreePickupShipments ?? 3}</span> شحنات = 70 ج.م، ≥{' '}
                      <span className="font-mono tabular-nums">{zoneRates.minFreePickupShipments ?? 3}</span> شحنات = مجاني)
                    </span>
                  </div>
                  {auditResult.totals.wrongfulPickupFeeCount > 0 ? (
                    <span className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                      خصم خاطئ مستحق الاسترداد: +{formatEgp(auditResult.totals.wrongfulPickupFeeAmount)} ({auditResult.totals.wrongfulPickupFeeCount})
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      كل خصومات البيك أب المسجلة سليمة
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2 px-3 font-bold">معرف الحركة والتاريخ</th>
                        <th className="py-2 px-3 font-bold">البيك أب / التاريخ المطابق</th>
                        <th className="py-2 px-3 font-bold text-center">الشحنات المسحوبة</th>
                        <th className="py-2 px-3 font-bold text-left">الخصم</th>
                        <th className="py-2 px-3 font-bold">الحكم والتشخيص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {auditResult.pickupFeeAudits.map(a => (
                        <tr
                          key={a.id}
                          className={
                            a.verdict === 'wrongful_deduction'
                              ? 'bg-rose-50/50 dark:bg-rose-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                            <div className="font-black text-slate-900 dark:text-white">{a.transactionId}</div>
                            <div className="text-[11px] text-slate-500">{a.txDate || '-'}</div>
                            {a.cashoutId && <div className="text-[10px] text-slate-400">{a.cashoutId}</div>}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {a.matchedPickupIds.length > 0
                                ? `Pickup #${a.matchedPickupIds.join(' / ')}`
                                : a.matchedSource === 'deliveries_export'
                                ? 'من شيت الشحنات'
                                : 'غير مطابق'}
                            </div>
                            <div className="text-[11px] text-slate-500">{a.pickupDates.join(' · ') || '-'}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono tabular-nums font-black whitespace-nowrap">
                            {a.matchedSource === 'none' ? (
                              <span className="text-slate-400">-</span>
                            ) : (
                              <span
                                className={
                                  a.verdict === 'wrongful_deduction'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }
                              >
                                {a.shipmentsPickedCount} / {a.minRequiredForFree}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            -{formatEgp(a.feeAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            <span
                              className={`inline-block font-black mb-0.5 ${
                                a.verdict === 'wrongful_deduction'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : a.verdict === 'valid_under_limit'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {a.verdict === 'wrongful_deduction'
                                ? `خصم خاطئ مستحق الاسترداد (+${formatEgp(a.overchargeAmount)})`
                                : a.verdict === 'valid_under_limit'
                                ? 'خصم سليم (أقل من الحد المجاني)'
                                : 'يحتاج شيت Pickup Requests لهذا التاريخ'}
                            </span>
                            <div className="text-slate-600 dark:text-slate-300">{a.reasonSummary}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(auditResult.bostaCreditsSummary.hasCreditsSheet ||
              auditResult.transactionsSummary.walletCompensations.length > 0 ||
              auditResult.compensationsSummary.hasCompensationsSheet) && (
              <div className="mx-4 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/25 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      الربط المزدوج للتعويضات: محفظة النقاط (Bosta Credits) + المحفظة النقدية (Cash Wallet & Compensations)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    تم فحص الشحنات ذات الفروقات مقابل قسائم <strong>Bosta Credits</strong> و<strong>تعويضات المحفظة النقدية</strong> وشيت <strong>Compensations</strong> لمنع المطالبة المزدوجة وفصل المستحق فعلياً.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-xs">
                  <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-sans ml-1">إجمالي الفروقات:</span>
                    <span className="font-black text-slate-800 dark:text-slate-100">
                      {formatEgp(auditResult.totals.grossFeeOverchargeAmount)}
                    </span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-emerald-700 dark:text-emerald-300 font-sans ml-1">
                      عُوّض (نقاط + محفظة):
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      -{formatEgp(auditResult.totals.compensatedInCreditsFeeAmount)}
                    </span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800">
                    <span className="text-rose-700 dark:text-rose-300 font-sans ml-1">متبقي للمطالبة:</span>
                    <span className="font-black text-rose-600 dark:text-rose-400">
                      +{formatEgp(auditResult.totals.totalFeeOverchargeAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {auditResult.payoutSlaSummary.hasPaidAtData && (
              <div className="mx-4 space-y-2">
                <div
                  className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                    auditResult.payoutSlaSummary.delayedCount > 0 ||
                    auditResult.payoutSlaSummary.skippedOutOfOrderCount > 0 ||
                    auditResult.payoutSlaSummary.unpaidOverdueCount > 0
                      ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      رادار تجميد الكاش وسرعة التحويل (Paid At vs Confirmed · مهلة SLA{' '}
                      <span className="font-mono tabular-nums">{auditResult.payoutSlaSummary.slaThresholdDays}</span>{' '}
                      أيام):
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 font-mono tabular-nums text-[11px]">
                    <span className="text-slate-600 dark:text-slate-300">
                      المتوسط: <strong>{auditResult.payoutSlaSummary.avgLagDays} يوم</strong> · الأقصى:{' '}
                      <strong>{auditResult.payoutSlaSummary.maxLagDays} يوم</strong> ({auditResult.payoutSlaSummary.evaluatedCount} شحنة)
                    </span>
                    {auditResult.payoutSlaSummary.skippedOutOfOrderCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-black">
                        تم تخطيها وتحويل الأحدث: {auditResult.payoutSlaSummary.skippedOutOfOrderCount}
                      </span>
                    )}
                    {auditResult.payoutSlaSummary.unpaidOverdueCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-black">
                        معلقة متأخرة بلا Cash-out: {auditResult.payoutSlaSummary.unpaidOverdueCount}
                      </span>
                    )}
                    {auditResult.payoutSlaSummary.delayedCount > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-black">
                        إجمالي المتأخر: {auditResult.payoutSlaSummary.delayedCount} شحنة (
                        {formatEgp(auditResult.payoutSlaSummary.delayedAmount)})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-black">
                        كل التحويلات ضمن المهلة
                      </span>
                    )}
                    {auditResult.payoutSlaSummary.delayedRows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowSlaDelayedTable(p => !p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-sans font-bold hover:bg-amber-50 cursor-pointer"
                      >
                        {showSlaDelayedTable ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>إخفاء تفاصيل التأخير</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>عرض البوالص المتأخرة ({auditResult.payoutSlaSummary.delayedRows.length})</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {showSlaDelayedTable && auditResult.payoutSlaSummary.delayedRows.length > 0 && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-white dark:bg-slate-900 overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-amber-50/70 dark:bg-amber-950/30 text-slate-600 dark:text-slate-300 border-b border-amber-200 dark:border-amber-800/60">
                        <tr>
                          <th className="py-2 px-3 font-bold">البوليصة</th>
                          <th className="py-2 px-3 font-bold">العميل</th>
                          <th className="py-2 px-3 font-bold">الحالة بالرادار</th>
                          <th className="py-2 px-3 font-bold">تاريخ التسليم</th>
                          <th className="py-2 px-3 font-bold">تاريخ التحويل</th>
                          <th className="py-2 px-3 font-bold text-center">أيام التجميد</th>
                          <th className="py-2 px-3 font-bold">Cash-out ID</th>
                          <th className="py-2 px-3 font-bold text-left">الصافي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {auditResult.payoutSlaSummary.delayedRows.slice(0, 60).map((d, idx) => (
                          <tr key={`${d.trackingKey}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                              {d.trackingKey}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
                              {d.customerName || '-'}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  d.statusFlag === 'skipped_out_of_order' || d.statusFlag === 'unpaid_overdue'
                                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                }`}
                              >
                                {d.statusFlag === 'skipped_out_of_order'
                                  ? 'تم تخطيها (حُوّل الأحدث قبلها)'
                                  : d.statusFlag === 'unpaid_overdue'
                                  ? 'مسلّمة ومتأخرة بلا Cash-out'
                                  : 'تحويل متأخر عن المهلة'}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {d.confirmedDate}
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {d.paidDate || <span className="text-rose-600 font-bold">غير محوّل</span>}
                            </td>
                            <td className="py-2 px-3 text-center font-mono tabular-nums font-black text-amber-600 dark:text-amber-400">
                              {d.lagDays} يوم
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                              {d.cashoutId || '-'}
                            </td>
                            <td className="py-2 px-3 text-left font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {formatEgp(d.netAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Filter pills for Fee Anomaly Categories (Radars #2, #3, #4, Rate/Size) */}
            <div className="mx-4 flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: `الكل (${auditResult.feeAnomalies.length})` },
                  {
                    id: 'rate_size',
                    label: `تسعير ومقاسات (${auditResult.feeAnomalies.filter(f => f.isRateOrSizeOvercharge).length})`
                  },
                  {
                    id: 'returned_insurance',
                    label: `تأمين على مرتجعات (${auditResult.totals.returnedInsuranceCount})`
                  },
                  {
                    id: 'untouched_opening',
                    label: `فتح باطل (لم يفتحها العميل) (${auditResult.totals.returnedUntouchedOpeningCount})`
                  },
                  {
                    id: 'forbidden_open_fee',
                    label: `رغم منع المعاينة Notes (${auditResult.totals.forbiddenOpenFeeCount})`
                  },
                  {
                    id: 'zero_cod_delivered',
                    label: `تسليم بـ 0 COD (${auditResult.totals.zeroCodDeliveredCount})`
                  }
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFeeAnomalyFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    feeAnomalyFilter === opt.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {filteredFeeAnomalies.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    لا توجد مصاريف شحن شاذة أو مخالفات في هذا التصنيف حالياً.
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">البوليصة والأوردر</th>
                      <th className="py-3 px-3 font-bold">العميل والمنطقة والحالة</th>
                      <th className="py-3 px-3 font-bold">نوع المخالفة</th>
                      <th className="py-3 px-3 font-bold text-left">COD</th>
                      <th className="py-3 px-3 font-bold text-left">إجمالي المصاريف والتفصيل</th>
                      <th className="py-3 px-3 font-bold text-left">فرق الرسوم وحالة التعويض</th>
                      <th className="py-3 px-4 font-bold">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredFeeAnomalies.map(item => (
                      <tr
                        key={item.id}
                        className={
                          item.compensatedInCredits
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/15 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/25'
                            : item.isZeroCodDeliveredAnomaly
                            ? 'bg-rose-50/35 dark:bg-rose-950/20 hover:bg-rose-50/55'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {item.trackingKey}
                          </div>
                          {item.matchedOrder &&
                            renderOrderTrigger(
                              item.matchedOrder,
                              `#${item.matchedOrder.orderNumber}`,
                              'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
                            )}
                          {item.sheetCashoutId && (
                            <div className="font-mono tabular-nums text-[10px] text-slate-500">
                              {item.sheetCashoutId}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {item.customerName || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.dropoffCity ? `${item.dropoffCity}` : ''}
                            {item.zoneLabelAr ? ` (${item.zoneLabelAr})` : ''}
                            {item.serviceLabelAr ? ` · ${item.serviceLabelAr}` : ` · ${item.sheetStatus}`}
                            {item.packageSize && item.packageSize !== '-' ? ` · حجم ${item.packageSize}` : ''}
                            {item.dominantProductSize ? ` (المعتاد: ${item.dominantProductSize})` : ''}
                          </div>
                          {item.packageDescription && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[240px]" title={item.packageDescription}>
                              {item.packageDescription}
                            </div>
                          )}
                          {(item.exceptionReason || typeof item.forwardAttempts === 'number') && (
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                              {typeof item.forwardAttempts === 'number' ? `محاولات: ${item.forwardAttempts}` : ''}
                              {item.exceptionReason ? `${typeof item.forwardAttempts === 'number' ? ' · ' : ''}${item.exceptionReason}` : ''}
                            </div>
                          )}
                          {item.orderNotes && (
                            <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold mt-0.5 truncate max-w-[240px]" title={item.orderNotes}>
                              ملاحظات البوليصة: {item.orderNotes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 max-w-[230px]">
                          <div className="flex flex-wrap gap-1 mb-1">
                            {item.isZeroCodDeliveredAnomaly && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                                تسليم بـ 0 COD
                              </span>
                            )}
                            {item.isForbiddenOpenFeeAnomaly && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                                فتح رغم منع المعاينة
                              </span>
                            )}
                            {item.isInvalidOpeningOnUntouchedReturn && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                                فتح باطل بدون لمس
                              </span>
                            )}
                            {item.isReturnedInsuranceAnomaly && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                                تأمين على مرتجع
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            {item.anomalyTags.join(' · ')}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatEgp(item.sheetGrossAmount)}
                        </td>
                        <td className="py-3 px-3 text-left whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                            {formatEgp(item.sheetFeesAmount)}
                          </div>
                          <div className="font-mono tabular-nums text-[10px] text-slate-500 mt-0.5">
                            شحن فعلي {item.shippingFees}
                            {item.expectedBaseShippingFee !== undefined
                              ? ` (بالخطة ${item.expectedBaseShippingFee})`
                              : ''}{' '}
                            · فتح {item.openingPackageFees} · تأمين {item.insuranceFees} · ض {item.vat}
                            {item.nextDayFees ? ` · سريع ${item.nextDayFees}` : ''}
                            {item.posFees ? ` · POS ${item.posFees}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums whitespace-nowrap">
                          <div
                            className={`font-black ${
                              item.compensatedInCredits
                                ? 'text-slate-400 line-through'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {item.overchargeEstimate > 0 ? `+${formatEgp(item.overchargeEstimate)}` : '-'}
                          </div>
                          {item.compensatedInCredits ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveTab(
                                  item.compensatedVia === 'cash_wallet' ||
                                    item.compensatedVia === 'compensations_sheet'
                                    ? 'compensations'
                                    : 'bosta_credits'
                                )
                              }
                              className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-sans font-black hover:underline cursor-pointer"
                              title="عرض مستند التعويض"
                            >
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>
                                {item.compensatedVia === 'cash_wallet'
                                  ? `عُوّض بالمحفظة النقدية (#${item.creditVoucherTxId})`
                                  : item.compensatedVia === 'compensations_sheet'
                                  ? `عُوّض بجدول التعويضات (#${item.creditVoucherTxId})`
                                  : item.creditVoucherTxId?.startsWith('مجموعة')
                                  ? `عُوّض بالنقاط (${item.creditVoucherTxId})`
                                  : `عُوّض بالنقاط (#${item.creditVoucherTxId})`}
                              </span>
                            </button>
                          ) : item.isRateOrSizeOvercharge ||
                            item.isReturnedInsuranceAnomaly ||
                            item.isInvalidOpeningOnUntouchedReturn ? (
                            <span className="mt-1 inline-block px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-sans font-black">
                              لم يُعوض — طالب به
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 px-4 max-w-[260px] text-[11px] text-slate-600 dark:text-slate-300">
                          {item.reasonSummary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: INTERNAL FRAUD, STAFF TAMPERING, PRODUCT PRICE ANOMALY (#5) & CROSS-SHEET CONFLICTS */}
        {activeTab === 'fraud_alerts' && (
          <div className="space-y-3">
            {/* Radar #5 Control Bar: ON/OFF + Unified Inventory Comparison Mode */}
            <div className="mx-4 mt-3 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/25 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>رادار شذوذ تسعير المنتجات قبل التحصيل أو بعد التسليم (#5 — مقارنة بالمخزون الموحد)</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  يكشف كتابة COD أقل من السعر الرسمي بـ 15% فأكثر (مثلاً بيع ميزان أو ماكينة لحام بسعر منخفض بالخطأ أو بالتلاعب).{' '}
                  <span className="font-mono tabular-nums font-bold text-indigo-700 dark:text-indigo-300">
                    ({unifiedPricedProductsCount} منتج مسعّر بالمخزون الموحد)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enableProductPriceAudit}
                  onClick={() => setEnableProductPriceAudit(v => !v)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    enableProductPriceAudit
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{enableProductPriceAudit ? 'مفعّل: ON' : 'متوقف: OFF'}</span>
                </button>

                {enableProductPriceAudit && (
                  <select
                    value={productPriceAuditSource}
                    onChange={e =>
                      setProductPriceAuditSource(e.target.value as 'hybrid' | 'inventory_only' | 'sheet_median')
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="hybrid">المصدر: المخزون الموحد أولاً ثم متوسط الشيتات (موصى به)</option>
                    <option value="inventory_only">المصدر: المخزون الموحد فقط ({unifiedPricedProductsCount} منتج)</option>
                    <option value="sheet_median">المصدر: متوسط أسعار الشيتات السابقة فقط</option>
                  </select>
                )}
              </div>
            </div>

            <div className="px-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'كل الشبهات' },
                    { id: 'cancelled_in_store_delivered_in_bosta', label: 'ملغي بالمتجر ومسلّم ببوسطة' },
                    { id: 'cod_downgraded_or_zero', label: 'تخفيض / تصفير COD (و 0 COD)' },
                    { id: 'product_price_anomaly', label: `شذوذ أسعار المنتجات (${auditResult.totals.productPriceAnomalyCount})` },
                    { id: 'settled_in_store_no_cashout', label: 'مُقفل بالمتجر بلا Cash-out' },
                    { id: 'double_waybill_same_order', label: 'تكرار بوالص / شحن مزدوج' },
                    { id: 'status_conflict_between_sheets', label: 'تعارض شيتات بوسطة' }
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFraudTypeFilter(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      fraudTypeFilter === opt.id
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {auditResult.totals.internalFraudRiskAmount > 0 && (
                <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                  إجمالي المبالغ المعرضة للخطر: {formatEgp(auditResult.totals.internalFraudRiskAmount)}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {filteredFraudAlerts.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    لا توجد مؤشرات تلاعب داخلي أو شذوذ تسعير أو تعارض بين الشيتات في البيانات الحالية.
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">البوليصة والأوردر</th>
                      <th className="py-3 px-3 font-bold">العميل والهاتف</th>
                      <th className="py-3 px-3 font-bold">مقارنة الحالة / المرجع</th>
                      <th className="py-3 px-3 font-bold text-left">المرجع / المتجر vs بوسطة</th>
                      <th className="py-3 px-3 font-bold text-left">الخطر المالي</th>
                      <th className="py-3 px-4 font-bold">التشخيص وخطوة المراجعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredFraudAlerts.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {item.trackingKey}
                            {item.secondaryTrackingKey ? ` ↔ ${item.secondaryTrackingKey}` : ''}
                          </div>
                          {item.matchedOrder ? (
                            renderOrderTrigger(
                              item.matchedOrder,
                              `#${item.matchedOrder.orderNumber}`,
                              'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
                            )
                          ) : item.orderNumber ? (
                            <div className="font-mono tabular-nums text-[11px] text-slate-500">
                              #{item.orderNumber}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {item.customerName || '-'}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            {item.customerPhone || '-'}
                            {item.brandName ? ` · ${item.brandName}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-700 dark:text-slate-200">
                            {item.storeStatus || '-'} →{' '}
                            <span className="text-rose-600 dark:text-rose-400">{item.bostaStatus || '-'}</span>
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                            {item.sheetDate || '-'}
                          </div>
                          {item.referenceSourceLabel && (
                            <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                              {item.referenceSourceLabel}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums whitespace-nowrap">
                          <div className="text-slate-700 dark:text-slate-200 font-bold">
                            {formatEgp(item.storeAmount)}
                            {item.priceDropPercent ? (
                              <span className="mr-1 px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px]">
                                -{item.priceDropPercent}%
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-slate-500">بوسطة: {formatEgp(item.bostaAmount)}</div>
                        </td>
                        <td
                          className={`py-3 px-3 text-left font-mono tabular-nums font-black whitespace-nowrap ${
                            item.severity === 'critical'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {formatEgp(item.financialRiskAmount)}
                        </td>
                        <td className="py-3 px-4 max-w-[290px] text-[11px] text-slate-600 dark:text-slate-300">
                          <span
                            className={`font-bold block mb-0.5 ${
                              item.severity === 'critical'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.severity === 'critical'
                              ? 'حرج (تلاعب / خسارة فورية)'
                              : item.severity === 'high'
                              ? 'أولوية عالية'
                              : 'تنبيه مراجعة'}
                          </span>
                          <span>{item.reasonSummary}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: ZERO-ATTEMPT FAKE RETURNS */}
        {activeTab === 'zero_attempt_returns' && (
          <div className="space-y-3">
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  شحنات عادت كمرتجع رغم أن عدد محاولات التوصيل للعميل (Forward Attempts Count) = 0 — يحق لك الاعتراض على رسوم الشحن!
                </span>
              </div>
              {auditResult.totals.zeroAttemptFeesAmount > 0 && (
                <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                  رسوم مخصومة بلا محاولة توصيل: {formatEgp(auditResult.totals.zeroAttemptFeesAmount)}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {filteredZeroAttempt.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    لا توجد مرتجعات بـ 0 محاولة توصيل في شيتات Deliveries المرفوعة.
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">البوليصة والأوردر</th>
                      <th className="py-3 px-3 font-bold">العميل والمدينة</th>
                      <th className="py-3 px-3 font-bold">الحالة وسبب الاستثناء</th>
                      <th className="py-3 px-3 font-bold text-center">محاولات التسليم</th>
                      <th className="py-3 px-3 font-bold text-left">رسوم شحن مخصومة</th>
                      <th className="py-3 px-4 font-bold">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredZeroAttempt.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {item.trackingKey}
                          </div>
                          {item.matchedOrder &&
                            renderOrderTrigger(
                              item.matchedOrder,
                              `#${item.matchedOrder.orderNumber}`,
                              'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
                            )}
                          {item.sheetCashoutId && (
                            <div className="font-mono tabular-nums text-[10px] text-slate-500">
                              {item.sheetCashoutId}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {item.customerName || '-'}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            {item.customerPhone || '-'}
                            {item.dropoffCity ? ` · ${item.dropoffCity}` : ''}
                            {item.brandName ? ` · ${item.brandName}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-amber-700 dark:text-amber-300">
                            {item.sheetStatus}
                          </div>
                          {item.exceptionReason && (
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.exceptionReason}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                          <span className="font-black text-rose-600 dark:text-rose-400">
                            {item.forwardAttempts} تسليم
                          </span>
                          <div className="text-[10px] text-slate-500">الإجمالي: {item.totalAttempts}</div>
                        </td>
                        <td
                          className={`py-3 px-3 text-left font-mono tabular-nums font-black whitespace-nowrap ${
                            item.shippingFeesDeducted > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.shippingFeesDeducted > 0 ? formatEgp(item.shippingFeesDeducted) : '0 ج.م'}
                        </td>
                        <td className="py-3 px-4 max-w-[270px] text-[11px] text-slate-600 dark:text-slate-300">
                          {item.reasonSummary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: SERIAL RETURNERS & RISKY CUSTOMER PHONES */}
        {activeTab === 'customer_risk' && (
          <div className="space-y-3">
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  رادار أرقام الهواتف متكررة المرتجعات (مرتجعان فأكثر) لتأكيد الطلب قبل الشحن أو طلب عربون مقدم
                </span>
              </div>
              {auditResult.totals.customerRiskBurnedFees > 0 && (
                <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                  شحن محروق بسببهم: {formatEgp(auditResult.totals.customerRiskBurnedFees)}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {filteredCustomerRisk.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    لا توجد أرقام عملاء بـ 2 مرتجع فأكثر في البيانات المحملة حالياً.
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">هاتف العميل والأسماء</th>
                      <th className="py-3 px-3 font-bold">المحافظات وأمثلة البوالص</th>
                      <th className="py-3 px-3 font-bold text-center">مرتجع / إجمالي</th>
                      <th className="py-3 px-3 font-bold text-center">نسبة الرفض</th>
                      <th className="py-3 px-3 font-bold text-left">مصاريف شحن محروقة</th>
                      <th className="py-3 px-4 font-bold">التقييم والتشخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCustomerRisk.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {item.phone}
                          </div>
                          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                            {item.customerNames.join(' / ') || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-[230px]">
                          <div className="text-slate-700 dark:text-slate-200 font-semibold">
                            {item.cities.join('، ') || '-'}
                          </div>
                          <div className="font-mono tabular-nums text-[10px] text-slate-500 mt-0.5 truncate">
                            {item.sampleTrackingKeys.join(' · ')}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                          <span className="font-black text-rose-600 dark:text-rose-400">
                            {item.returnedCount} مرتجع
                          </span>
                          <div className="text-[11px] text-slate-500">
                            من {item.totalOrders} ({item.deliveredCount} مسلّم)
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums font-black whitespace-nowrap">
                          <span
                            className={
                              item.returnRatePercent >= 75
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {item.returnRatePercent}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {formatEgp(item.totalReturnedFees)}
                        </td>
                        <td className="py-3 px-4 max-w-[260px] text-[11px] text-slate-600 dark:text-slate-300">
                          <span
                            className={`font-bold block mb-0.5 ${
                              item.riskLevel === 'critical'
                                ? 'text-rose-600 dark:text-rose-400'
                                : item.riskLevel === 'high'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {item.riskLevel === 'critical'
                              ? 'قائمة حظر / عربون إجباري'
                              : item.riskLevel === 'high'
                              ? 'مخاطرة عالية جداً'
                              : 'يحتاج تأكيد هاتفي'}
                          </span>
                          <span>{item.reasonSummary}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: EXCHANGE AUDIT RADAR (#6) */}
        {activeTab === 'exchange_audits' && (
          <div className="space-y-3">
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  رادار تدقيق الاستبدال (Exchange) والتسليم الجزئي (PICK_AND_CHOOSE): يفحص تعريفة الخطة، محاولات الإرجاع (Return Attempts)، مقارنة الـ COD، وكشف تجزئة الاستبدال (SEND + CRP)
                </span>
              </div>
              {auditResult.totals.exchangeRiskAmount > 0 && (
                <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                  فروقات / مخاطر الاستبدال: {formatEgp(auditResult.totals.exchangeRiskAmount)}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {filteredExchangeAudits.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    لا توجد مخالفات تسعير أو طرود استبدال/جزئي غير مرتجعة في الشيتات المرفوعة.
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">البوليصة والنوع</th>
                      <th className="py-3 px-3 font-bold">العميل والمنطقة</th>
                      <th className="py-3 px-3 font-bold">النتيجة / المخالفة</th>
                      <th className="py-3 px-3 font-bold text-left">الشحن المخصوم vs الخطة</th>
                      <th className="py-3 px-3 font-bold text-left">الخطر / المطالبة</th>
                      <th className="py-3 px-4 font-bold">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredExchangeAudits.map(ex => (
                      <tr key={ex.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                          <div>
                            {ex.trackingKey}
                            {ex.secondaryTrackingKey ? ` ↔ ${ex.secondaryTrackingKey}` : ''}
                          </div>
                          <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {ex.orderType}
                            {ex.returnAttemptsCount !== undefined ? ` · Ret: ${ex.returnAttemptsCount}` : ''}
                          </div>
                          {ex.sheetDate && (
                            <div className="text-[10px] font-normal text-slate-500">{ex.sheetDate}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {ex.customerName || '-'}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            {ex.customerPhone || '-'}
                            {ex.dropoffCity ? ` · ${ex.dropoffCity}` : ''}
                            {ex.sheetStatus ? ` · ${ex.sheetStatus}` : ''}
                            {ex.collectedCod ? ` · COD ${formatEgp(ex.collectedCod)}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              ex.oldItemStatusFlag === 'old_item_unreturned'
                                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                : ex.oldItemStatusFlag === 'exchange_ok'
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {ex.oldItemStatusFlag === 'fee_overcharge'
                              ? 'رسوم استبدال/جزئي زائدة'
                              : ex.oldItemStatusFlag === 'old_item_unreturned'
                              ? ex.isPickAndChoose
                                ? 'صنف جزئي غير مرتجع'
                                : 'طرد قديم غير مرتجع'
                              : ex.oldItemStatusFlag === 'split_send_and_crp'
                              ? 'استبدال مجزأ SEND+CRP'
                              : ex.isPickAndChoose
                              ? (ex.returnAttemptsCount || 0) > 0
                                ? 'مرتجع جزئي مستلم ✅'
                                : 'استلم كل الأصناف (سليم ✅)'
                              : 'استبدال مطابق ✅'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums whitespace-nowrap">
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {formatEgp(ex.shippingFees)}
                          </span>
                          {ex.expectedExchangeFee !== undefined && (
                            <span className="text-[11px] text-slate-500 mr-1">
                              (متوقع {formatEgp(ex.expectedExchangeFee)})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {ex.feeOvercharge > 0 ? formatEgp(ex.feeOvercharge) : '-'}
                        </td>
                        <td className="py-3 px-4 max-w-[290px] text-[11px] text-slate-600 dark:text-slate-300">
                          {ex.reasonSummary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: STUCK RETURNS / INVENTORY HUNTER */}
        {activeTab === 'stuck_returns' && (
          <div className="space-y-3">
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  بضاعة متوقفة أو مرتجعات متأخرة بفروع شركة الشحن وتحتاج متابعة للاستلام للمخزن
                </span>
              </div>
              {auditResult.totals.stuckReturnsValueAmount > 0 && (
                <div className="font-mono tabular-nums font-black text-amber-600 dark:text-amber-400">
                  قيمة البضاعة المحتجزة: {formatEgp(auditResult.totals.stuckReturnsValueAmount)}
                </div>
              )}
            </div>

            {renderDeliverySlaPanel()}

            <div className="overflow-x-auto">
              {filteredStuckReturns.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    لا توجد مرتجعات محتجزة أو متجاوزة لموعد الإرجاع في شيت الأوردرات!
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">البوليصة والأوردر</th>
                      <th className="py-3 px-3 font-bold">العميل والمنتج</th>
                      <th className="py-3 px-3 font-bold">الحالة والمحطة (Hub)</th>
                      <th className="py-3 px-3 font-bold">موعد الإرجاع والتأخير</th>
                      <th className="py-3 px-3 font-bold text-left">قيمة البضاعة (COD)</th>
                      <th className="py-3 px-4 font-bold">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStuckReturns.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {item.trackingKey}
                          </div>
                          {item.matchedOrder &&
                            renderOrderTrigger(
                              item.matchedOrder,
                              `#${item.matchedOrder.orderNumber}`,
                              'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
                            )}
                          <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                            {item.returnAttemptsCount > 0 ? `محاولات إرجاع: ${item.returnAttemptsCount}` : ''}
                            {item.onHoldTrials > 0 ? ` · تعليق: ${item.onHoldTrials}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {item.customerName || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]" title={item.packageDescription}>
                            {item.packageDescription || item.customerPhone || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-amber-700 dark:text-amber-300">
                            {item.sheetStatus}
                          </div>
                          {item.sheetStatus.toLowerCase().includes('received at warehouse') && (
                            <div className="text-[10px] font-black text-rose-600 dark:text-rose-400">
                              (مخزن بوسطة — لم يرجع لمخزنك!)
                            </div>
                          )}
                          {item.wrongReturnWarehouseNote && (
                            <div className="text-[10px] font-black text-rose-600 dark:text-rose-400 mt-0.5">
                              🔀 موجه لمخزن خاطئ (تبديل بيك أب)
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500">
                            {item.currentHub || item.dropoffCity || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono tabular-nums">
                          <div className="text-slate-600 dark:text-slate-300">
                            {item.expectedReturnDate || item.updatedAt || '-'}
                          </div>
                          {item.daysOverdue > 0 && (
                            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                              متأخر {item.daysOverdue} يوم
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                          {formatEgp(item.codAmount)}
                        </td>
                        <td className="py-3 px-4 max-w-[260px] text-[11px] text-slate-600 dark:text-slate-300">
                          {item.reasonSummary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: ONLINE PAYMENTS & FLEXSHIP CHECKER */}
        {activeTab === 'online_flex' && (
          <div className="space-y-3">
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  فحص شحنات الدفع الإلكتروني (Online / Deposit) وخدمات FlexShip والمرتجعات المرتبطة بها
                </span>
              </div>
              {auditResult.totals.onlineAndFlexAmount > 0 && (
                <div className="font-mono tabular-nums font-black text-indigo-600 dark:text-indigo-400">
                  إجمالي المبالغ المرصودة: {formatEgp(auditResult.totals.onlineAndFlexAmount)}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {filteredOnlineFlex.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    لا توجد شحنات Online Payment أو FlexShip معلقة أو مخالفة في الشيتات المرفوعة.
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">البوليصة والأوردر</th>
                      <th className="py-3 px-3 font-bold">العميل والبراند</th>
                      <th className="py-3 px-3 font-bold">الحالة وكود التحويل</th>
                      <th className="py-3 px-3 font-bold text-left">أونلاين / عربون</th>
                      <th className="py-3 px-3 font-bold text-left">بيانات FlexShip</th>
                      <th className="py-3 px-3 font-bold text-left">صافي الشيت</th>
                      <th className="py-3 px-4 font-bold">التشخيص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOnlineFlex.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {item.trackingKey}
                          </div>
                          {item.matchedOrder &&
                            renderOrderTrigger(
                              item.matchedOrder,
                              `#${item.matchedOrder.orderNumber}`,
                              'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
                            )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {item.customerName || '-'}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            {item.customerPhone || '-'}
                            {item.brandName ? ` · ${item.brandName}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-700 dark:text-slate-200">
                            {item.sheetStatus}
                            {item.sheetPaymentStatus ? ` · ${item.sheetPaymentStatus}` : ''}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            {item.sheetCashoutId || 'بدون Cash-out ID'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums whitespace-nowrap">
                          {item.onlinePaymentAmount > 0 && (
                            <div className="font-bold text-indigo-600 dark:text-indigo-400">
                              Online: {formatEgp(item.onlinePaymentAmount)}
                            </div>
                          )}
                          {item.depositAmount > 0 && (
                            <div className="text-[11px] text-slate-500">
                              Deposit: {formatEgp(item.depositAmount)}
                            </div>
                          )}
                          {item.onlinePaymentAmount === 0 && item.depositAmount === 0 && '-'}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums whitespace-nowrap">
                          {item.hasFlexShip || item.flexShipAmount > 0 || item.flexShipValue > 0 ? (
                            <div>
                              <div
                                className={`font-bold ${
                                  item.flexShipPaid === false
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {formatEgp(item.flexShipAmount || item.flexShipValue)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.flexShipPaid === false
                                  ? 'Flex غير مدفوع'
                                  : item.flexShipPaid === true
                                  ? 'Flex مدفوع'
                                  : `رسوم Flex: ${formatEgp(item.flexShipFees)}`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-3 text-left font-mono tabular-nums font-bold whitespace-nowrap ${
                            item.sheetNetPayout < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {formatEgp(item.sheetNetPayout)}
                        </td>
                        <td className="py-3 px-4 max-w-[260px] text-[11px] text-slate-600 dark:text-slate-300">
                          <span
                            className={`font-bold block mb-0.5 ${
                              item.statusFlag === 'unpaid_flex' || item.statusFlag === 'untransferred_online'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.statusFlag === 'unpaid_flex'
                              ? 'FlexShip غير مدفوع'
                              : item.statusFlag === 'untransferred_online'
                              ? 'تحصيل أونلاين لم يُحوّل'
                              : item.statusFlag === 'returned_with_flex'
                              ? 'مرتجع عليه تسوية FlexShip'
                              : 'مطابق'}
                          </span>
                          <span>{item.reasonSummary}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: IN TRANSIT IN UPLOADED BOSTA SHEET (Ready to Dispatch / Warehouse / Picked up) */}
        {activeTab === 'in_transit_sheet' && (
          <div className="space-y-3">
            {renderDeliverySlaPanel()}
            <div className="overflow-x-auto">
              {filteredInTransitSheet.length === 0 ? (
                <div className="py-16 px-4 text-center text-slate-500 text-xs">
                  لا توجد شحنات قيد التشغيل في شيتات بوسطة المرفوعة.
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">رقم البوليصة</th>
                      <th className="py-3 px-3 font-bold">العميل والهاتف</th>
                      <th className="py-3 px-3 font-bold">البراند والمدينة</th>
                      <th className="py-3 px-3 font-bold">الحالة والمحطة (Hub)</th>
                      <th className="py-3 px-3 font-bold text-left">قيمة التحصيل (COD)</th>
                      <th className="py-3 px-4 font-bold">الموعد المتوقع وتفاصيل التشغيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredInTransitSheet.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-black">{row.trackingKey}</div>
                          <div className="text-[11px] text-slate-500">
                            {row.sheetType || 'SEND'} {row.attemptsCount ? `· ${row.attemptsCount} محاولة` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {row.matchedOrder?.customerName || row.customerName || '-'}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            {row.phoneRaw || row.matchedOrder?.customerPhone || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-700 dark:text-slate-200">
                            {row.brandName || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500">{row.dropoffCity || '-'}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-indigo-600 dark:text-indigo-400">
                            {row.sheetStatus || '-'}
                          </div>
                          {row.wrongReturnWarehouseNote && (
                            <div className="text-[10px] font-black text-rose-600 dark:text-rose-400 mt-0.5">
                              🔀 موجه لمخزن خاطئ (تبديل بيك أب)
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500">
                            {row.currentHub || '-'}
                            {row.whatsappStatus ? ` · WA: ${row.whatsappStatus}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          {formatEgp(row.sheetGrossAmount)}
                        </td>
                        <td className="py-3 px-4 max-w-[280px] text-[11px] text-slate-600 dark:text-slate-400">
                          {(row.expectedDeliveryDate || row.scheduledAt || row.onHoldTrials) && (
                            <div className="font-mono tabular-nums text-[10px] text-amber-700 dark:text-amber-300 font-bold mb-0.5">
                              {row.expectedDeliveryDate ? `متوقع: ${row.expectedDeliveryDate}` : ''}
                              {row.scheduledAt ? ` · مجدول: ${row.scheduledAt}` : ''}
                              {row.onHoldTrials ? ` · تعليق On-Hold: ${row.onHoldTrials}` : ''}
                            </div>
                          )}
                          <div>{row.reasonSummary}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: FULL BOSTA TRANSACTIONS LEDGER */}
        {activeTab === 'transactions_ledger' && auditResult.transactionsSummary.hasTransactionsSheet && (
          <div className="space-y-3">
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'كل الحركات' },
                    { id: 'cashout_fees', label: 'التحويلات والرسوم' },
                    { id: 'compensations', label: 'التعويضات' },
                    { id: 'packing_pickup', label: 'التغليف والبيك أب' },
                    { id: 'cycles', label: 'دورات التحصيل والمصاريف' }
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTxCategoryFilter(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      txCategoryFilter === opt.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500">
                المعروض: {filteredTxLedger.length.toLocaleString('en-US')} من أصل{' '}
                {auditResult.transactionsSummary.ledgerRows.length.toLocaleString('en-US')} حركة
              </div>
            </div>

            {auditResult.transactionsSummary.walletCompensations.length > 0 && (
              <div className="mx-4 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                  <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    رصد النظام{' '}
                    <span className="font-mono tabular-nums font-black">
                      {auditResult.transactionsSummary.walletCompensations.length}
                    </span>{' '}
                    حركة تعويض/رد مبلغ بالمحفظة النقدية (إجمالي{' '}
                    <span className="font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400">
                      +{formatEgp(auditResult.transactionsSummary.totalCompensations)}
                    </span>
                    )
                    {auditResult.totals.undocumentedWalletCompCount > 0 && (
                      <span className="mr-2 text-amber-700 dark:text-amber-300 font-black">
                        · منها {auditResult.totals.undocumentedWalletCompCount} غير موثق بشيت Compensations (
                        {formatEgp(auditResult.totals.undocumentedWalletCompAmount)})
                      </span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('compensations')}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  فتح مركز التعويضات الموحّد
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              {filteredTxLedger.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-500 text-xs">
                  لا توجد حركات مطابقة للتصفية الحالية.
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">معرف الحركة (ID)</th>
                      <th className="py-3 px-3 font-bold">التاريخ</th>
                      <th className="py-3 px-3 font-bold">التصنيف (البيان)</th>
                      <th className="py-3 px-3 font-bold text-left">القيمة</th>
                      <th className="py-3 px-3 font-bold text-left">الرصيد بعد الحركة</th>
                      <th className="py-3 px-4 font-bold">كود التحويل (Cashout ID)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTxLedger.map(tx => {
                      const isPositive = tx.amount > 0;
                      const isNegative = tx.amount < 0;
                      const pickupAudit = pickupFeeAuditByTxId.get(tx.transactionId);
                      return (
                        <tr
                          key={tx.id}
                          className={
                            pickupAudit?.verdict === 'wrongful_deduction'
                              ? 'bg-rose-50/50 dark:bg-rose-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {tx.transactionId}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {tx.date || '-'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {tx.categoryAr}
                            </span>
                            <span className="text-[11px] text-slate-400 mr-1.5 font-mono">
                              ({tx.category})
                            </span>
                            {pickupAudit && (
                              <span
                                className={`mr-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black font-mono tabular-nums ${
                                  pickupAudit.verdict === 'wrongful_deduction'
                                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                    : pickupAudit.verdict === 'valid_under_limit'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {pickupAudit.verdict === 'wrongful_deduction'
                                  ? `خصم خاطئ (سُحب ${pickupAudit.shipmentsPickedCount} ≥ ${pickupAudit.minRequiredForFree})`
                                  : pickupAudit.verdict === 'valid_under_limit'
                                  ? `سليم (سُحب ${pickupAudit.shipmentsPickedCount} < ${pickupAudit.minRequiredForFree})`
                                  : 'ارفع شيت البيك أب للتحقق'}
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-left font-mono tabular-nums font-black whitespace-nowrap ${
                              isPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isNegative
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {isPositive ? `+${formatEgp(tx.amount)}` : formatEgp(tx.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {tx.balance !== null ? formatEgp(tx.balance) : '-'}
                          </td>
                          <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {tx.cashoutId || '-'}
                            {tx.cashoutAmount ? ` (${formatEgp(tx.cashoutAmount)})` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: UNIFIED DUAL-WALLET COMPENSATIONS (CASH WALLET + COMPENSATIONS CSV + POINTS LINK) */}
        {activeTab === 'compensations' &&
          (auditResult.compensationsSummary.hasCompensationsSheet ||
            auditResult.transactionsSummary.walletCompensations.length > 0) && (
            <div className="space-y-4 pb-4">
              {/* Dual-Wallet KPI Strip */}
              <div className="px-4 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <div className="text-slate-500 text-[11px]">تعويضات شيت Compensations</div>
                  <div className="font-mono tabular-nums font-black text-base text-slate-900 dark:text-white mt-0.5">
                    +{formatEgp(auditResult.compensationsSummary.totalCompensatedAmount)}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                    {auditResult.compensationsSummary.entries.length} شحنة موثّقة (محوّل{' '}
                    {formatEgp(auditResult.compensationsSummary.paidOutCompensationAmount)})
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="text-emerald-700 dark:text-emerald-300 text-[11px]">
                    تعويضات المحفظة النقدية (Cash Wallet)
                  </div>
                  <div className="font-mono tabular-nums font-black text-base text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{formatEgp(auditResult.transactionsSummary.totalCompensations)}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {auditResult.transactionsSummary.walletCompensations.length} حركة بـ Transactions (كاش للبنك)
                  </div>
                </div>

                <div
                  className={`p-3 rounded-lg border ${
                    auditResult.compensationsSummary.underCompensatedCount > 0
                      ? 'bg-rose-50/80 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800/70'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                  }`}
                >
                  <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                    فحص عودة البضاعة والتعويض
                  </div>
                  <div
                    className={`font-mono tabular-nums font-black text-base mt-0.5 ${
                      auditResult.compensationsSummary.underCompensatedCount > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {auditResult.compensationsSummary.underCompensatedCount > 0
                      ? `-${formatEgp(auditResult.compensationsSummary.underCompensatedShortfallAmount)}`
                      : '0 ج.م (سليم ✅)'}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                    {auditResult.compensationsSummary.underCompensatedCount > 0
                      ? `${auditResult.compensationsSummary.underCompensatedCount} تعويض لبضاعة غير راجعة`
                      : `${auditResult.compensationsSummary.returnedRtoShippingRefundCount} رجع لمخزنك · ${auditResult.compensationsSummary.outsideDeliveriesRtoCount} خارج مدى Deliveries`}
                  </div>
                </div>

                <div
                  className={`p-3 rounded-lg border ${
                    auditResult.transactionsSummary.undocumentedWalletCompCount > 0
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                  }`}
                >
                  <div className="text-amber-800 dark:text-amber-300 text-[11px]">
                    بالمحفظة وغير موثق بشيت Compensations
                  </div>
                  <div
                    className={`font-mono tabular-nums font-black text-base mt-0.5 ${
                      auditResult.transactionsSummary.undocumentedWalletCompCount > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {formatEgp(auditResult.transactionsSummary.undocumentedWalletCompAmount)}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                    {auditResult.transactionsSummary.undocumentedWalletCompCount} حركة بدون سجل تفصيلي بالبوليصة
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => auditResult.bostaCreditsSummary.hasCreditsSheet && setActiveTab('bosta_credits')}
                  className="text-right p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-400 transition-colors cursor-pointer"
                >
                  <div className="text-indigo-700 dark:text-indigo-300 text-[11px]">
                    تعويضات محفظة النقاط (Bosta Credits)
                  </div>
                  <div className="font-mono tabular-nums font-black text-base text-indigo-700 dark:text-indigo-300 mt-0.5">
                    +{formatEgp(auditResult.bostaCreditsSummary.voucherCreditsAmount)}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {auditResult.bostaCreditsSummary.hasCreditsSheet
                      ? `${auditResult.bostaCreditsSummary.entries.filter(e => e.amount > 0).length} قسيمة نقاط ← اضغط للعرض`
                      : 'شيت Bosta Credits غير مرفوع'}
                  </div>
                </button>
              </div>

              {/* Section 1: Compensations Sheet Table */}
              {auditResult.compensationsSummary.hasCompensationsSheet && (
                <div className="space-y-2">
                  <div className="px-4 flex items-center justify-between text-xs">
                    <span className="font-black text-slate-800 dark:text-slate-100">
                      1) سجل التعويضات التفصيلي (Compensations Sheet)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      ({filteredCompensations.length} شحنة)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    {filteredCompensations.length === 0 ? (
                      <div className="py-10 px-4 text-center text-slate-500 text-xs">
                        لا توجد سجلات تعويضات مطابقة للبحث أو البراند المحدد.
                      </div>
                    ) : (
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-3 px-4 font-bold">البوليصة والتعويض</th>
                            <th className="py-3 px-3 font-bold">العميل والبراند والمسار</th>
                            <th className="py-3 px-3 font-bold">المنتج وقيمته المعتادة</th>
                            <th className="py-3 px-3 font-bold">حالة الشحنة والتواريخ</th>
                            <th className="py-3 px-3 font-bold">كود التحويل (Cash-out ID)</th>
                            <th className="py-3 px-4 font-bold text-left">قيمة التعويض والتدقيق</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredCompensations.map(comp => (
                            <tr
                              key={comp.id}
                              className={
                                comp.isUnderCompensated
                                  ? 'bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50/70'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }
                            >
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                                  {comp.orderId}
                                </div>
                                {comp.matchedOrder &&
                                  renderOrderTrigger(
                                    comp.matchedOrder,
                                    `#${comp.matchedOrder.orderNumber}`,
                                    'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block text-right cursor-pointer'
                                  )}
                                <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                                  تعويض #{comp.compensationId} · {comp.orderType}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800 dark:text-slate-100">
                                  {comp.matchedOrder?.customerName || comp.customerName || '-'}
                                </div>
                                <div className="font-mono tabular-nums text-[11px] text-slate-500">
                                  {comp.customerPhone || '-'}
                                  {comp.brandName ? ` · ${comp.brandName}` : ''}
                                </div>
                                {(comp.pickupCity || comp.dropoffCity) && (
                                  <div className="text-[11px] text-slate-400">
                                    {comp.pickupCity || '-'} → {comp.dropoffCity || '-'}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 max-w-[260px]">
                                <div
                                  className="font-semibold text-slate-700 dark:text-slate-200 truncate"
                                  title={comp.packageDescription}
                                >
                                  {comp.packageDescription || '-'}
                                </div>
                                <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                                  {comp.packageSize ? `الحجم: ${comp.packageSize}` : ''}
                                  {comp.expectedProductValue
                                    ? `${comp.packageSize ? ' · ' : ''}سعر معتاد ~${formatEgp(comp.expectedProductValue)}`
                                    : ''}
                                </div>
                              </td>
                              <td className="py-3 px-3 max-w-[260px]">
                                <div className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {comp.orderStatusLabel}
                                </div>
                                <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                                  {comp.confirmedAt ? `تأكيد: ${comp.confirmedAt}` : ''}
                                  {comp.confirmedAt && comp.completedAt ? ' · ' : ''}
                                  {comp.completedAt ? `اكتمال: ${comp.completedAt}` : ''}
                                </div>
                                {comp.compAuditVerdict === 'returned_to_warehouse_shipping_refund' && (
                                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    رجع لمخزنك ({comp.deliveriesReturnedAt || '-'} · {Math.max(1, comp.deliveriesReturnAttempts || 1)} محاولة)
                                  </div>
                                )}
                                {comp.compAuditVerdict === 'rto_status_shipping_refund_outside_deliveries' && (
                                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    أقدم من مدى Deliveries — تأكد من الجرد
                                  </div>
                                )}
                                {comp.shippingRefundBreakdownAr && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    {comp.shippingRefundBreakdownAr}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div
                                  className={`font-mono tabular-nums font-bold ${
                                    comp.isPaidOut
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {comp.cashoutId || 'لم يُحوّل بعد'}
                                </div>
                                <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                                  تاريخ التعويض: {comp.compensationDate || '-'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-left whitespace-nowrap">
                                <div className="font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400">
                                  +{formatEgp(comp.compensationAmount)}
                                </div>
                                {comp.preVatEquivalent !== undefined && (
                                  <div className="text-[10px] font-mono tabular-nums text-slate-500">
                                    قبل 14% ض: {formatEgp(comp.preVatEquivalent)}
                                  </div>
                                )}
                                {comp.compAuditVerdict === 'returned_to_warehouse_shipping_refund' && (
                                  <div className="mt-1 inline-block px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                                    استرداد شحن + رجع المخزن ✅
                                  </div>
                                )}
                                {comp.compAuditVerdict === 'rto_status_shipping_refund_outside_deliveries' && (
                                  <div className="mt-1 inline-block px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                                    استرداد شحن (RTO 46) · خارج Deliveries
                                  </div>
                                )}
                                {comp.isUnderCompensated && (
                                  <div className="mt-1 inline-block px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                                    عجز -{formatEgp(comp.shortfallAmount || 0)} (بضاعة لم ترجع!)
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* Section 2: Cash Wallet Compensations & Refunds (from Transactions Sheet) */}
              {auditResult.transactionsSummary.walletCompensations.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="px-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        2) تعويضات واستردادات المحفظة النقدية (Transactions Cash Wallet — منفصلة عن محفظة النقاط)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      ({filteredWalletCompensations.length} حركة بالمحفظة)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4 font-bold">معرف الحركة</th>
                          <th className="py-2.5 px-3 font-bold">التاريخ</th>
                          <th className="py-2.5 px-3 font-bold">البند بالمحفظة النقدية</th>
                          <th className="py-2.5 px-3 font-bold">كود التحويل للبنك</th>
                          <th className="py-2.5 px-3 font-bold">التوثيق والملاحظة</th>
                          <th className="py-2.5 px-4 font-bold text-left">المبلغ (وقبل الضريبة)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredWalletCompensations.map(w => (
                          <tr
                            key={w.id}
                            className={
                              w.auditStatus === 'undocumented_in_comp_sheet'
                                ? 'bg-amber-50/40 dark:bg-amber-950/15 hover:bg-amber-50/60'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }
                          >
                            <td className="py-2.5 px-4 font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                              {w.transactionId}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {w.date || '-'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-bold text-slate-800 dark:text-slate-100">
                                {w.categoryAr}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{w.category}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {w.cashoutId || '-'}
                            </td>
                            <td className="py-2.5 px-3 max-w-[320px]">
                              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                    w.auditStatus === 'documented_in_comp_sheet'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                                      : w.auditStatus === 'undocumented_in_comp_sheet'
                                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {w.auditStatus === 'documented_in_comp_sheet'
                                    ? `موثق ببوليصة #${w.matchedCompensationOrderId}`
                                    : w.auditStatus === 'undocumented_in_comp_sheet'
                                    ? 'نزل بالمحفظة مباشرة · غير موثق في Compensations'
                                    : w.auditStatus === 'packing_refund'
                                    ? 'استرداد تغليف'
                                    : 'تسوية رصيد'}
                                </span>
                                {w.isSuspectedShippingOnlyRefund && (
                                  <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                                    مشتبه: رد شحن فقط
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                {w.inferredNoteAr}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-left whitespace-nowrap">
                              <div className="font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400">
                                +{formatEgp(w.amount)}
                              </div>
                              <div className="text-[10px] font-mono tabular-nums text-slate-500">
                                قبل 14% ض: {formatEgp(w.preVatEquivalent)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* TAB: BOSTA PICKUP REQUESTS AUDIT */}
        {activeTab === 'pickup_requests' && auditResult.pickupRequestsSummary.hasPickupSheet && (
          <div className="space-y-3">
            <div className="px-4 pt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between gap-1 text-slate-500 text-[11px]">
                  <span>إجمالي طلبات البيك أب</span>
                  {auditResult.pickupRequestsSummary.businessTier && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                      Tier: {auditResult.pickupRequestsSummary.businessTier}
                    </span>
                  )}
                </div>
                <div className="font-mono tabular-nums font-black text-base text-slate-900 dark:text-white mt-0.5">
                  {auditResult.pickupRequestsSummary.totalPickups.toLocaleString('en-US')} طلب
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                  {auditResult.pickupRequestsSummary.pickedUpRequestsCount} منفّذ ·{' '}
                  {auditResult.pickupRequestsSummary.canceledRequestsCount} ملغي
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="text-slate-500 text-[11px]">طرود سحبها المندوب / المستلم</div>
                <div className="font-mono tabular-nums font-black text-base text-slate-900 dark:text-white mt-0.5">
                  {auditResult.pickupRequestsSummary.totalPickedUpParcels.toLocaleString('en-US')} /{' '}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {auditResult.pickupRequestsSummary.totalReceivedParcels.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                  مسحوب من المندوب / مستلم بالفرع
                </div>
              </div>
              <div
                className={`p-3 rounded-lg border ${
                  auditResult.pickupRequestsSummary.confirmedByBusinessMismatchCount > 0
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">فروق تأكيد التاجر (Confirmed)</div>
                <div
                  className={`font-mono tabular-nums font-black text-base mt-0.5 ${
                    auditResult.pickupRequestsSummary.confirmedByBusinessMismatchCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {auditResult.pickupRequestsSummary.confirmedByBusinessMismatchCount.toLocaleString('en-US')} طلب
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Confirmed By Business &lt; المسحوب
                </div>
              </div>
              <div
                className={`p-3 rounded-lg border ${
                  auditResult.pickupRequestsSummary.varianceGapCount > 0
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">فروقات / لم يُستلم بالفرع</div>
                <div
                  className={`font-mono tabular-nums font-black text-base mt-0.5 ${
                    auditResult.pickupRequestsSummary.varianceGapCount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {auditResult.pickupRequestsSummary.varianceGapCount.toLocaleString('en-US')} طلب
                </div>
                <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                  تأخير/إعادة جدولة: {auditResult.pickupRequestsSummary.rescheduledOrDelayedCount}
                </div>
              </div>
              <div
                className={`p-3 rounded-lg border ${
                  auditResult.pickupRequestsSummary.smallPickupCount > 0
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                  بيك أب أقل من {(zoneRates.minFreePickupShipments ?? 3)} شحنات
                </div>
                <div
                  className={`font-mono tabular-nums font-black text-base mt-0.5 ${
                    auditResult.pickupRequestsSummary.smallPickupCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {auditResult.pickupRequestsSummary.smallPickupCount.toLocaleString('en-US')} طلب
                </div>
              </div>
              <div
                className={`p-3 rounded-lg border ${
                  auditResult.pickupRequestsSummary.wrongfulPickupFeeCount > 0
                    ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/70'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">خصم 70 ج.م خاطئ</div>
                <div
                  className={`font-mono tabular-nums font-black text-base mt-0.5 ${
                    auditResult.pickupRequestsSummary.wrongfulPickupFeeCount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {auditResult.pickupRequestsSummary.wrongfulPickupFeeCount > 0
                    ? `${auditResult.pickupRequestsSummary.wrongfulPickupFeeCount} (${formatEgp(auditResult.pickupRequestsSummary.wrongfulPickupFeeAmount)})`
                    : '0 (سليم)'}
                </div>
              </div>
            </div>

            {auditResult.pickupRequestsSummary.crossBrandSwaps.length > 0 && (
              <div className="mx-4 space-y-3">
                {auditResult.pickupRequestsSummary.crossBrandSwaps.map(sw => {
                  const isPaired = sw.kind === 'paired_two_way_swap';
                  const isExpanded = !collapsedSwapIds.has(sw.id);
                  const toggleExpand = () => {
                    setCollapsedSwapIds(prev => {
                      const next = new Set(prev);
                      if (next.has(sw.id)) next.delete(sw.id);
                      else next.add(sw.id);
                      return next;
                    });
                  };
                  return (
                    <div
                      key={sw.id}
                      className={`p-4 rounded-xl border space-y-3 text-xs ${
                        isPaired
                          ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80'
                          : 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              isPaired
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-600 text-white'
                            }`}
                          >
                            {isPaired ? 'تبديل متبادل بين مخزنين 🚨' : 'تداخل براند/حساب عند البيك أب ⚠️'}
                          </span>
                          <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {sw.date} ·{' '}
                            {sw.partnerPickupId ? `#${sw.pickupId} ↔ #${sw.partnerPickupId}` : `#${sw.pickupId}`}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] font-bold text-rose-700 dark:text-rose-300">
                            ({sw.affectedTotalShipmentsCount} شحنة إجمالاً · {sw.affectedReturnsCount} مرتجع متأثر بالعنوان العكسي)
                          </span>
                        </div>
                        {sw.affectedReturnedShipments.length > 0 && (
                          <button
                            type="button"
                            onClick={toggleExpand}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                          >
                            <span>
                              {isExpanded
                                ? 'إخفاء بوالص المرتجعات المتأثرة'
                                : `عرض بوالص المرتجعات (${sw.affectedReturnedShipments.length})`}
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      {isPaired ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/90 border border-rose-200 dark:border-rose-800/60 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                                بيك أب #{sw.pickupId}
                              </span>
                              <span className="font-mono tabular-nums text-[11px] font-black text-rose-600 dark:text-rose-400">
                                سحب {sw.pickedUpCount} / مؤكد {sw.confirmedCount ?? '-'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300">
                              <span className="font-bold">عنوان المخزن:</span> {sw.warehouseAddress}
                              {sw.warehouseContact ? ` (${sw.warehouseContact})` : ''} ·{' '}
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                مخزن {sw.warehouseHomeBrand}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                              البوالص المسحوبة تخص: «{sw.actualShipmentsBrand}» (عينة:{' '}
                              <span className="font-mono tabular-nums">{sw.sampleTrackingNumber || '-'}</span>) ← أي
                              مرتجع منها هيرجع بالغلط لمخزن «{sw.warehouseHomeBrand}»!
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/90 border border-rose-200 dark:border-rose-800/60 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                                بيك أب #{sw.partnerPickupId}
                              </span>
                              <span className="font-mono tabular-nums text-[11px] font-black text-rose-600 dark:text-rose-400">
                                سحب {sw.partnerPickedUpCount} / مؤكد {sw.partnerConfirmedCount ?? '-'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300">
                              <span className="font-bold">عنوان المخزن:</span> {sw.partnerWarehouseAddress}
                              {sw.partnerWarehouseContact ? ` (${sw.partnerWarehouseContact})` : ''} ·{' '}
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                مخزن {sw.partnerWarehouseHomeBrand}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                              البوالص المسحوبة تخص: «{sw.partnerActualShipmentsBrand}» (عينة:{' '}
                              <span className="font-mono tabular-nums">{sw.partnerSampleTrackingNumber || '-'}</span>) ← أي
                              مرتجع منها هيرجع بالغلط لمخزن «{sw.partnerWarehouseHomeBrand}»!
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                          {sw.reasonSummary}
                        </div>
                      )}

                      {isExpanded && sw.affectedReturnedShipments.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <table className="w-full text-right text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                <th className="py-2 px-3 font-bold">رقم البوليصة</th>
                                <th className="py-2 px-3 font-bold">البراند الفعلي</th>
                                <th className="py-2 px-3 font-bold">العميل والمنتج</th>
                                <th className="py-2 px-3 font-bold">الحالة بالـ Deliveries</th>
                                <th className="py-2 px-3 font-bold text-rose-600 dark:text-rose-400">
                                  رجعت خطأ لمخزن
                                </th>
                                <th className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                                  المفروض ترجع لمخزن
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {sw.affectedReturnedShipments.map(ret => (
                                <tr key={`${sw.id}_${ret.trackingKey}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="py-2 px-3 font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                                    {ret.trackingKey}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                                    {ret.actualBrandName}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="font-bold text-slate-800 dark:text-slate-100">
                                      {ret.customerName || '-'}
                                      {ret.dropoffCity ? ` · ${ret.dropoffCity}` : ''}
                                    </div>
                                    {ret.packageDescription && (
                                      <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={ret.packageDescription}>
                                        {ret.packageDescription}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 whitespace-nowrap">
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                        ret.isAlreadyReturnedToOrigin
                                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                      }`}
                                    >
                                      {ret.deliveryState}
                                    </span>
                                    {ret.currentHub && (
                                      <div className="text-[10px] text-slate-400 mt-0.5">{ret.currentHub}</div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-rose-600 dark:text-rose-400">
                                    <div>{ret.routedReturnWarehouse}</div>
                                    {ret.routedReturnContact && (
                                      <div className="text-[10px] text-rose-500/80 font-mono tabular-nums">
                                        {ret.routedReturnContact}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-emerald-700 dark:text-emerald-300">
                                    <div>{ret.expectedReturnWarehouse}</div>
                                    {ret.expectedReturnContact && (
                                      <div className="text-[10px] text-emerald-600/80 font-mono tabular-nums">
                                        {ret.expectedReturnContact}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {auditResult.pickupFeeAudits.length > 0 && (
              <div className="mx-4 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>تدقيق خصومات رسوم البيك أب في كشف Transactions</span>
                  </div>
                  <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span>الحد المجاني (شحنات فأكثر):</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      value={zoneRates.minFreePickupShipments ?? 3}
                      onChange={e =>
                        setZoneRates(p => ({
                          ...p,
                          minFreePickupShipments: Math.max(1, Number(e.target.value) || 3)
                        }))
                      }
                      className="w-16 px-2 py-1 text-center font-mono tabular-nums font-black bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  {auditResult.pickupFeeAudits.map(a => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-lg border ${
                        a.verdict === 'wrongful_deduction'
                          ? 'bg-rose-50 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800'
                          : a.verdict === 'valid_under_limit'
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                          حركة {a.transactionId} ({a.txDate})
                          {a.matchedPickupIds.length > 0 ? ` ← Pickup #${a.matchedPickupIds.join(', ')}` : ''}
                        </span>
                        <span
                          className={`font-mono tabular-nums font-black ${
                            a.verdict === 'wrongful_deduction'
                              ? 'text-rose-600 dark:text-rose-400'
                              : a.verdict === 'valid_under_limit'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          -{formatEgp(a.feeAmount)}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] font-bold ${
                          a.verdict === 'wrongful_deduction'
                            ? 'text-rose-700 dark:text-rose-300'
                            : a.verdict === 'valid_under_limit'
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {a.reasonSummary}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {filteredPickupRequests.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-500 text-xs">
                  لا توجد طلبات بيك أب مطابقة للبحث أو البراند المحدد.
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">Pickup ID والتاريخ</th>
                      <th className="py-3 px-3 font-bold">الفرع والبراند والمنطقة</th>
                      <th className="py-3 px-3 font-bold">المندوب (Star)</th>
                      <th className="py-3 px-3 font-bold">الحالة والجدولة</th>
                      <th className="py-3 px-3 font-bold text-center">مطلوب / مسحوب</th>
                      <th className="py-3 px-3 font-bold text-center">مستلم بالفرع / مؤكد</th>
                      <th className="py-3 px-4 font-bold">التشخيص والملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPickupRequests.map(p => (
                      <tr
                        key={p.id}
                        className={
                          p.isCrossBrandSwapped || p.alertFlag === 'wrongful_pickup_fee'
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                              {p.pickupId}
                            </span>
                            {p.isCrossBrandSwapped && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black">
                                تبديل براند/مخزن
                              </span>
                            )}
                            {p.isFirstPickup && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                                أول بيك أب
                              </span>
                            )}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                            {p.scheduledDate || p.creationDate || '-'}
                            {p.firstPickedUpDate && p.firstPickedUpDate !== p.scheduledDate
                              ? ` · أول سحب ${p.firstPickedUpDate}`
                              : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {p.hubName || '-'}
                            {p.firstMileDistrictCode ? ` (${p.firstMileDistrictCode})` : ''}
                          </div>
                          <div className="text-[11px] text-slate-500" title={p.addressLine}>
                            {p.brandName || '-'}
                            {p.zone || p.city ? ` · ${p.zone || p.city}` : ''}
                            {p.parcelType ? ` · ${p.parcelType}` : ''}
                            {p.businessTier ? ` · ${p.businessTier}` : ''}
                          </div>
                          {p.isCrossBrandSwapped && p.expectedWarehouseBrand && (
                            <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                              عنوان مخزن: {p.expectedWarehouseBrand}
                              {p.sampleTrackingBrand ? ` · العينة: ${p.sampleTrackingBrand}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-700 dark:text-slate-200">
                            {p.starName || '-'}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-slate-500">
                            {p.starPhone || p.contactNumber || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              p.alertFlag === 'wrongful_pickup_fee' ||
                              p.alertFlag === 'pending_hub_receipt'
                                ? 'text-rose-600 dark:text-rose-400'
                                : p.alertFlag === 'variance_gap' ||
                                  p.alertFlag === 'small_pickup_fee_risk'
                                ? 'text-amber-600 dark:text-amber-400'
                                : p.alertFlag === 'canceled'
                                ? 'text-slate-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {p.status}
                          </span>
                          {(p.noOfSchedulings || p.isRescheduledOrDelayed) && (
                            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                              {p.isRescheduledOrDelayed ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  إعادة جدولة / تأخير
                                  {p.pickupDelayDays ? ` (+${p.pickupDelayDays} يوم)` : ''}
                                </span>
                              ) : (
                                `الجدولة: ${p.noOfSchedulings}`
                              )}
                              {p.newPickupId ? ` → ${p.newPickupId}` : ''}
                              {p.oldPickupId ? ` ← ${p.oldPickupId}` : ''}
                            </div>
                          )}
                          {p.sampleTrackingNumber && (
                            <div className="font-mono tabular-nums text-[10px] text-slate-500 mt-0.5">
                              بوليصة عينة: {p.sampleTrackingNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                          <span className="text-slate-500">{p.requestedCount}</span>
                          <span className="mx-1 text-slate-400">/</span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {p.pickedUpCount}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums whitespace-nowrap">
                          <div>
                            <span
                              className={`font-black ${
                                p.alertFlag === 'pending_hub_receipt' || p.alertFlag === 'variance_gap'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {typeof p.receivedCount === 'number' ? p.receivedCount : '-'}
                            </span>
                            <span className="mx-1 text-slate-400">/</span>
                            <span
                              className={`font-bold ${
                                (p.variancePickedVsConfirmed || 0) > 0
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {typeof p.confirmedCount === 'number' ? p.confirmedCount : '-'}
                            </span>
                          </div>
                          {(p.variancePickedVsConfirmed || 0) > 0 && (
                            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                              فارق تأكيد (-{p.variancePickedVsConfirmed})
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-[300px] text-[11px] text-slate-600 dark:text-slate-300">
                          <div
                            className={`font-bold mb-0.5 ${
                              p.isCrossBrandSwapped ||
                              p.alertFlag === 'wrongful_pickup_fee' ||
                              p.alertFlag === 'pending_hub_receipt'
                                ? 'text-rose-600 dark:text-rose-400'
                                : p.alertFlag === 'variance_gap' ||
                                  p.alertFlag === 'small_pickup_fee_risk'
                                ? 'text-amber-600 dark:text-amber-400'
                                : p.alertFlag === 'canceled'
                                ? 'text-slate-500'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {p.isCrossBrandSwapped
                              ? 'تبديل / تداخل براند ومخزن!'
                              : p.alertFlag === 'wrongful_pickup_fee'
                              ? `خصم -${formatEgp(p.chargedPickupFee || 70)} خاطئ (حركة ${p.chargedTxId})`
                              : p.alertFlag === 'pending_hub_receipt'
                              ? 'سُحب ولم يُسجّل استلامه بالفرع بعد'
                              : p.alertFlag === 'variance_gap'
                              ? `فرق استلام (${p.variancePickedVsReceived} طرد)`
                              : p.alertFlag === 'small_pickup_fee_risk'
                              ? `عدد قليل (< ${(zoneRates.minFreePickupShipments ?? 3)} شحنات${p.chargedPickupFee ? ` · خُصم ${formatEgp(p.chargedPickupFee)}` : ''})`
                              : p.alertFlag === 'canceled'
                              ? 'طلب ملغي'
                              : 'مستلم ومطابق'}
                          </div>
                          <div>{p.reasonSummary}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: BOSTA CREDITS WALLET */}
        {activeTab === 'bosta_credits' && auditResult.bostaCreditsSummary.hasCreditsSheet && (
          <div className="space-y-3">
            <div className="px-4 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50">
                <div className="flex items-center justify-between gap-1 text-indigo-700 dark:text-indigo-300 text-[11px]">
                  <span>الرصيد المتاح بالـ Credits</span>
                  {auditResult.bostaCreditsSummary.walletIntegrityStatus === 'verified' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      متسلسل 100%
                    </span>
                  )}
                </div>
                <div className="font-mono tabular-nums font-black text-base text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {auditResult.bostaCreditsSummary.currentCreditsBalance !== null
                    ? formatEgp(auditResult.bostaCreditsSummary.currentCreditsBalance)
                    : '-'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50">
                <div className="text-emerald-700 dark:text-emerald-300 text-[11px]">إجمالي قسائم النقاط (Vouchers)</div>
                <div className="font-mono tabular-nums font-black text-base text-emerald-600 dark:text-emerald-400 mt-0.5">
                  +{formatEgp(auditResult.bostaCreditsSummary.totalAddedCredits)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono tabular-nums">
                  {auditResult.bostaCreditsSummary.entries.filter(e => e.amount > 0).length} قسيمة تعويض نقاط
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-300 dark:border-emerald-800/70">
                <div className="text-emerald-800 dark:text-emerald-200 text-[11px]">طابقت شحنات (حالية + سابقة)</div>
                <div className="font-mono tabular-nums font-black text-base text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatEgp(
                    auditResult.bostaCreditsSummary.matchedVoucherAmount +
                      auditResult.bostaCreditsSummary.earlierCycleMatchedAmount
                  )}
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono tabular-nums">
                  {auditResult.bostaCreditsSummary.matchedVoucherCount} دورة حالية ·{' '}
                  {auditResult.bostaCreditsSummary.earlierCycleMatchedCount} دورة سابقة
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60">
                <div className="text-amber-800 dark:text-amber-300 text-[11px]">قسائم غير مربوطة ببوليصة</div>
                <div className="font-mono tabular-nums font-black text-base text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatEgp(auditResult.bostaCreditsSummary.surplusUnmatchedVoucherAmount)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono tabular-nums">
                  {auditResult.bostaCreditsSummary.surplusUnmatchedVoucherCount} قسيمة تحتاج لصق/ربط أو شيت أقدم
                </div>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  auditResult.bostaCreditsSummary.uncompensatedRateSizeAnomaliesCount > 0
                    ? 'bg-rose-50/80 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800/70'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="text-slate-600 dark:text-slate-300 text-[11px]">فروقات شحن/مقاس لم تُعوض</div>
                <div
                  className={`font-mono tabular-nums font-black text-base mt-0.5 ${
                    auditResult.bostaCreditsSummary.uncompensatedRateSizeAnomaliesCount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {auditResult.bostaCreditsSummary.uncompensatedRateSizeAnomaliesCount > 0
                    ? `+${formatEgp(auditResult.bostaCreditsSummary.uncompensatedRateSizeAnomaliesAmount)}`
                    : '0 ج.م (مُغطى)'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono tabular-nums">
                  {auditResult.bostaCreditsSummary.uncompensatedRateSizeAnomaliesCount} شحنة مستحقة المطالبة
                </div>
              </div>

              <div className="p-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/50">
                <div className="text-rose-700 dark:text-rose-300 text-[11px]">المسحوب من النقاط (تغليف)</div>
                <div className="font-mono tabular-nums font-black text-base text-rose-600 dark:text-rose-400 mt-0.5">
                  -{formatEgp(auditResult.bostaCreditsSummary.totalSpentCredits)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono tabular-nums">
                  نُزل بالمحفظة كتعويض: +{formatEgp(auditResult.transactionsSummary.totalCompensations)}
                </div>
              </div>
            </div>

            {/* Smart Paste Bar for Bosta Points Wallet UI ("Customer Care Vouchers" missing CSV tracking_number) */}
            <div className="mx-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-black text-slate-800 dark:text-slate-100">
                    كيف نربط قسائم محفظة النقاط حتى لو CSV بوسطة ساب خانة البوليصة فاضية؟
                  </div>
                  <p className="text-[11px] leading-relaxed mt-0.5">
                    انسخ جدول «قائمة المعاملات» من صفحة نقاط بوسطة والصقه هنا دفعة واحدة (مثال: رقم المعاملة + رقم البوليصة الأزرق) لربط القسائم بشيت <strong>Cash Cycles</strong> وشيت <strong>Deliveries</strong> للأشهر السابقة، بينما باقي التعويضات التي نزلت كاش تظهر في{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('compensations')}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      مركز التعويضات الموحّد (المحفظة النقدية)
                    </button>
                    .
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.keys(manualCreditTrackingMap).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualCreditTrackingMap({});
                        notify('تم مسح ربط البوالص اليدوي لمحفظة النقاط.');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>مسح الربط ({Object.keys(manualCreditTrackingMap).length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCreditsPasteBox(v => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>{showCreditsPasteBox ? 'إغلاق صندوق اللصق' : 'لصق ذكي من صفحة نقاط بوسطة'}</span>
                  </button>
                </div>
              </div>

              {showCreditsPasteBox && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <textarea
                    value={creditsPasteText}
                    onChange={e => setCreditsPasteText(e.target.value)}
                    rows={4}
                    dir="auto"
                    placeholder="حدد صفوف قائمة المعاملات من صفحة نقاط بوسطة (Ctrl+C) والصقها هنا (Ctrl+V)، أو الصق كل سطر بصيغة: 2038811 -> 8500877172"
                    className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-bold">
                      {parsedCreditsPastePreview.length > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                          تم التقاط {parsedCreditsPastePreview.length} قسيمة ↔ بوليصة (
                          {parsedCreditsPastePreview
                            .slice(0, 3)
                            .map(p => `${p.transactionId}→${p.trackingNumber}`)
                            .join(' · ')}
                          {parsedCreditsPastePreview.length > 3 ? ' ...' : ''})
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          في انتظار لصق النص لاستخراج أرقام المعاملات والبوالص تلقائياً...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCreditsPasteText('');
                          setShowCreditsPasteBox(false);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        disabled={parsedCreditsPastePreview.length === 0}
                        onClick={() => {
                          const next = { ...manualCreditTrackingMap };
                          parsedCreditsPastePreview.forEach(p => {
                            next[p.transactionId] = p.trackingNumber;
                          });
                          setManualCreditTrackingMap(next);
                          setCreditsPasteText('');
                          setShowCreditsPasteBox(false);
                          notify(`تم ربط ${parsedCreditsPastePreview.length} قسيمة نقاط بأرقام البوالص بنجاح.`);
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        تطبيق وربط ({parsedCreditsPastePreview.length})
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {filteredBostaCredits.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-500 text-xs">
                  لا توجد حركات رصيد مطابقة للبحث الحالي.
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">معرف الحركة (transaction_id)</th>
                      <th className="py-3 px-3 font-bold">التاريخ</th>
                      <th className="py-3 px-3 font-bold">البيان والبصمة السعرية المكتشفة</th>
                      <th className="py-3 px-3 font-bold">الشحنة المقابلة وحالة المطابقة</th>
                      <th className="py-3 px-3 font-bold text-left">القيمة</th>
                      <th className="py-3 px-4 font-bold text-left">الرصيد بعد الحركة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredBostaCredits.map(cr => {
                      const isPos = cr.amount > 0;
                      const isNeg = cr.amount < 0;
                      const isEditing = editingCreditTxId === cr.transactionId;
                      return (
                        <tr key={cr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono tabular-nums font-black text-slate-900 dark:text-white whitespace-nowrap">
                            {cr.transactionId}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {cr.date || '-'}
                          </td>
                          <td className="py-3 px-3 max-w-[320px]">
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {cr.categoryAr}
                            </div>
                            {cr.inferredReasonAr && (
                              <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                {cr.inferredReasonAr}
                              </div>
                            )}
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {cr.category}
                              {cr.subCategory ? ` · ${cr.subCategory}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingCreditTrackingInput}
                                  onChange={e => setEditingCreditTrackingInput(e.target.value)}
                                  placeholder="رقم البوليصة (مثال: 8500877172)"
                                  className="w-40 px-2 py-1 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-indigo-400 rounded-md focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cleanTrk = normalizeDigitsOnlyText(editingCreditTrackingInput).replace(/[^\dA-Za-z-]/g, '');
                                    if (!cleanTrk) return;
                                    setManualCreditTrackingMap(prev => ({
                                      ...prev,
                                      [cr.transactionId]: cleanTrk
                                    }));
                                    setEditingCreditTxId(null);
                                    setEditingCreditTrackingInput('');
                                    notify(`تم ربط القسيمة ${cr.transactionId} بالبوليصة ${cleanTrk}.`);
                                  }}
                                  className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  حفظ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCreditTxId(null);
                                    setEditingCreditTrackingInput('');
                                  }}
                                  className="px-1.5 py-1 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : cr.matchStatus === 'matched_by_tracking' ||
                              cr.matchStatus === 'matched_by_fingerprint' ||
                              cr.matchStatus === 'matched_in_deliveries_earlier_cycle' ? (
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSearchQuery(cr.matchedAnomalyTrackingKey || '');
                                      setActiveTab(
                                        cr.matchStatus === 'matched_in_deliveries_earlier_cycle'
                                          ? 'matched'
                                          : 'fee_anomalies'
                                      );
                                    }}
                                    className="font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                    title="البحث بهذه البوليصة"
                                  >
                                    بوليصة #{cr.matchedAnomalyTrackingKey}
                                  </button>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      cr.matchStatus === 'matched_in_deliveries_earlier_cycle'
                                        ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                                        : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                                    }`}
                                  >
                                    {cr.matchStatus === 'matched_in_deliveries_earlier_cycle'
                                      ? 'شيت الشحنات · دورة سابقة'
                                      : cr.matchStatus === 'matched_by_tracking'
                                      ? 'مطابقة بالبوليصة'
                                      : 'مطابقة بالبصمة السعرية'}
                                  </span>
                                  {cr.manualBoundTracking && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                      يدوي/ذكي
                                    </span>
                                  )}
                                  {isPos && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCreditTxId(cr.transactionId);
                                        setEditingCreditTrackingInput(cr.matchedAnomalyTrackingKey || cr.trackingNumber || '');
                                      }}
                                      className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                                      title="تعديل رقم البوليصة"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                  {cr.manualBoundTracking && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setManualCreditTrackingMap(prev => {
                                          const next = { ...prev };
                                          delete next[cr.transactionId];
                                          return next;
                                        });
                                      }}
                                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                      title="فك الربط اليدوي"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                {(cr.matchedAnomalyCustomerName || cr.matchedAnomalyZone || cr.matchedAnomalyState) && (
                                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                    {cr.matchedAnomalyCustomerName || '-'}
                                    {cr.matchedAnomalyZone ? ` · ${cr.matchedAnomalyZone}` : ''}
                                    {cr.matchedAnomalySize ? ` (${cr.matchedAnomalySize})` : ''}
                                    {cr.matchedAnomalyState ? ` · ${cr.matchedAnomalyState}` : ''}
                                    {cr.matchedAnomalyDate ? ` · ${cr.matchedAnomalyDate}` : ''}
                                  </div>
                                )}
                                {cr.matchedAnomalyProduct && (
                                  <div
                                    className="text-[10px] text-slate-400 truncate max-w-[240px]"
                                    title={cr.matchedAnomalyProduct}
                                  >
                                    {cr.matchedAnomalyProduct}
                                  </div>
                                )}
                              </div>
                            ) : cr.matchStatus === 'ambiguous_pool_needs_binding' ? (
                              (() => {
                                const alreadyBoundSet = new Set(Object.values(manualCreditTrackingMap));
                                const availableCandidates = (cr.candidateTrackingKeys || []).filter(
                                  k => !alreadyBoundSet.has(k)
                                );
                                return (
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="inline-block px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                                        الـ CSV بدون بوليصة — تحتاج ربط/لصق لتأكيد أي شحنة
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setShowCreditsPasteBox(true)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                                      >
                                        <Clipboard className="w-3 h-3" />
                                        <span>لصق جدول النقاط</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCreditTxId(cr.transactionId);
                                          setEditingCreditTrackingInput('');
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold hover:bg-indigo-100 cursor-pointer"
                                      >
                                        <Link2 className="w-3 h-3" />
                                        <span>ربط ببوليصة</span>
                                      </button>
                                    </div>
                                    {availableCandidates.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                                        <span className="text-slate-500">
                                          مُغطاة مالياً ضمن مجموعة — بوالص متوقعة بنفس القيمة:
                                        </span>
                                        {availableCandidates.map(candKey => (
                                          <button
                                            key={candKey}
                                            type="button"
                                            onClick={() => {
                                              setManualCreditTrackingMap(prev => ({
                                                ...prev,
                                                [cr.transactionId]: candKey
                                              }));
                                              notify(`تم ربط القسيمة ${cr.transactionId} بالبوليصة #${candKey}.`);
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-200 font-mono tabular-nums font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                            title="اضغط لربط هذه القسيمة بهذه البوليصة"
                                          >
                                            #{candKey}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            ) : cr.matchStatus === 'surplus_unmatched_voucher' ? (
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-block px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                                    {cr.trackingNumber
                                      ? `مرتبطة ببوليصة #${cr.trackingNumber} (شيت دورة أقدم غير مرفوع)`
                                      : 'قسيمة تعويض إضافية / تخص دورة سابقة'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCreditTxId(cr.transactionId);
                                      setEditingCreditTrackingInput(cr.trackingNumber || '');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold hover:bg-indigo-100 cursor-pointer"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    <span>{cr.trackingNumber ? 'تعديل البوليصة' : 'ربط ببوليصة'}</span>
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  الصق من صفحة النقاط أو ارفع شيت Cash Cycles الأقدم لربطها بالعميل تلقائياً
                                </div>
                              </div>
                            ) : (
                              <div className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                {cr.trackingNumber ? `بوليصة تغليف #${cr.trackingNumber}` : '-'}
                              </div>
                            )}
                          </td>
                          <td
                            className={`py-3 px-3 text-left font-mono tabular-nums font-black whitespace-nowrap ${
                              isPos
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isNeg
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {isPos ? `+${formatEgp(cr.amount)}` : formatEgp(cr.amount)}
                          </td>
                          <td className="py-3 px-4 text-left font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {cr.balance !== null ? formatEgp(cr.balance) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB: OVERDUE IN TRANSIT */}
        {activeTab === 'overdue' && matchWithStoreOrders && (
          <div className="overflow-x-auto">
            {filteredOverdue.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <Truck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  لا توجد شحنات في الطريق متجاوزة لمهلة {graceDays} أيام.
                </p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">الأوردر والبوليصة</th>
                    <th className="py-3 px-3 font-bold">العميل</th>
                    <th className="py-3 px-3 font-bold">شركة الشحن والحالة</th>
                    <th className="py-3 px-3 font-bold">مدة التوقف</th>
                    <th className="py-3 px-3 font-bold text-left">صافي متوقع</th>
                    <th className="py-3 px-4 font-bold">التنبيه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOverdue.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderOrderTrigger(item.order, `#${item.order.orderNumber}`)}
                        <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                          {item.trackingDisplay}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {item.order.customerName}
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-500">
                          {item.order.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold">{item.order.shippingCompany || 'غير محدد'}</div>
                        <div className="text-[11px] text-slate-500">{item.order.status}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                        {item.daysElapsed} يوم
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {formatEgp(item.expectation.expectedNetPayout)}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-400">
                        {item.reasonSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: MATCHED READY FOR SETTLEMENT */}
        {activeTab === 'matched' && (
          <div className="overflow-x-auto">
            {uploadedFiles.length === 0 ? (
              <div className="py-16 px-4 text-center text-slate-500 text-xs">
                ارفع ملف إكسيل واحد أو أكثر لعرض البوالص المطابقة المثبت تحويلها.
              </div>
            ) : filteredMatched.length === 0 ? (
              <div className="py-16 px-4 text-center text-slate-500 text-xs">
                لا توجد صفوف مثبت تحويلها ومطابقة تماماً حالياً. راجع تبويب «متحصل ولم يُحوّل» أو «عجز وفروقات الشيت».
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {allowBatchSettlement && matchWithStoreOrders && (
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredMatched.length > 0 &&
                            filteredMatched.every(r => selectedRowIds.has(r.id))
                          }
                          onChange={() => toggleSelectAllInTab(filteredMatched)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                    )}
                    <th className="py-3 px-3 font-bold">البوليصة والأوردر</th>
                    <th className="py-3 px-3 font-bold">Cash-out ID / الدفع</th>
                    <th className="py-3 px-3 font-bold text-left">إجمالي الشيت</th>
                    <th className="py-3 px-3 font-bold text-left">صافي المحوّل</th>
                    <th className="py-3 px-3 font-bold text-left">صافي الطلب</th>
                    <th className="py-3 px-4 font-bold">النتيجة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMatched.map(row => {
                    const checked = selectedRowIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          checked ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : ''
                        }`}
                      >
                        {allowBatchSettlement && matchWithStoreOrders && (
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRowSelection(row.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        )}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-bold">{row.trackingKey}</div>
                          {row.matchedOrder ? (
                            renderOrderTrigger(
                              row.matchedOrder,
                              `#${row.matchedOrder.orderNumber} · ${row.matchedOrder.customerName}`,
                              'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block mt-0.5 text-right cursor-pointer'
                            )
                          ) : (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {row.customerName || '-'}
                              {row.brandName ? ` · ${row.brandName}` : ''}
                              {row.dropoffCity ? ` · ${row.dropoffCity}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          <div>{row.sheetCashoutId || '-'}</div>
                          <div className="text-[11px] text-emerald-600">
                            {row.sheetPaymentStatus || 'مطابق'}
                            {row.sheetDate ? ` · ${row.sheetDate}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {formatEgp(row.sheetGrossAmount)}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatEgp(row.sheetNetPayout)}
                        </td>
                        <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatEgp(
                            row.expectation?.expectedNetPayout ??
                              row.sheetGrossAmount - row.sheetFeesAmount
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-emerald-700 dark:text-emerald-300">
                          {row.reasonSummary}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: DUPLICATES */}
        {activeTab === 'duplicate' && (
          <div className="overflow-x-auto">
            {filteredDuplicates.length === 0 ? (
              <div className="py-16 px-4 text-center text-slate-500 text-xs">
                لا توجد بوالص مكررة أو محصّلة مسبقاً في الشيتات المرفوعة.
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">البوليصة والأوردر</th>
                    <th className="py-3 px-3 font-bold">الشيت</th>
                    <th className="py-3 px-3 font-bold text-left">صافي الشيت</th>
                    <th className="py-3 px-4 font-bold">سبب الحظر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDuplicates.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold">{row.trackingKey}</div>
                        {row.matchedOrder &&
                          renderOrderTrigger(
                            row.matchedOrder,
                            `#${row.matchedOrder.orderNumber} · ${row.matchedOrder.customerName}`,
                            'font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline block mt-0.5 text-right cursor-pointer'
                          )}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        {row.fileName} (صف {row.rowIndex})
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums font-bold whitespace-nowrap">
                        {formatEgp(row.sheetNetPayout)}
                      </td>
                      <td className="py-3 px-4 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        {row.reasonSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: NOT FOUND */}
        {activeTab === 'not_found' && (
          <div className="overflow-x-auto">
            {filteredNotFound.length === 0 ? (
              <div className="py-16 px-4 text-center text-slate-500 text-xs">
                كل صفوف الشيتات المرفوعة مطابقة.
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">رقم البوليصة / المرجع بالشيت</th>
                    <th className="py-3 px-3 font-bold">الهاتف بالشيت</th>
                    <th className="py-3 px-3 font-bold">الشيت</th>
                    <th className="py-3 px-3 font-bold">حالة الشيت</th>
                    <th className="py-3 px-3 font-bold text-left">صافي الشيت</th>
                    <th className="py-3 px-4 font-bold">ملاحظة</th>
                    {matchWithStoreOrders && <th className="py-3 px-4 font-bold">مطابقة يدوية</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredNotFound.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono tabular-nums font-bold">{row.trackingKey}</td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-500">
                        {row.phoneRaw || '-'}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        {row.fileName} (صف {row.rowIndex})
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {row.sheetStatus || '-'}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums font-bold whitespace-nowrap">
                        {formatEgp(row.sheetNetPayout)}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{row.reasonSummary}</span>
                        </div>
                      </td>
                      {matchWithStoreOrders && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setManualLinkRow(row);
                              setManualOrderSearch(row.phoneRaw || row.businessRefKey || '');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>ربط يدوي بأوردر</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: BATCHES ARCHIVE */}
        {activeTab === 'batches' && allowBatchSettlement && (
          <div className="overflow-x-auto">
            {savedBatches.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <Archive className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  لا توجد دفعات تحصيل معتمدة في الأرشيف بعد.
                </p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">رقم الدفعة والتاريخ</th>
                    <th className="py-3 px-3 font-bold">الشركة والملفات</th>
                    <th className="py-3 px-3 font-bold text-center">عدد الأوردرات</th>
                    <th className="py-3 px-3 font-bold text-left">صافي الشيت المورد</th>
                    <th className="py-3 px-3 font-bold text-left">صافي المتجر</th>
                    <th className="py-3 px-3 font-bold text-left">فرق الدفعة</th>
                    <th className="py-3 px-4 font-bold">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {savedBatches.map(batch => (
                    <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                          {batch.batchNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                          {formatDateShort(batch.createdAt)} · {batch.createdBy}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-700 dark:text-slate-200">
                          {batch.carrierName}
                        </div>
                        <div className="text-[11px] text-slate-500 max-w-[220px] truncate">
                          {batch.fileNames.join('، ') || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums font-bold">
                        {batch.settledOrderIds.length.toLocaleString('en-US')}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatEgp(batch.totalSheetNetAmount)}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatEgp(batch.totalExpectedNetAmount)}
                      </td>
                      <td
                        className={`py-3 px-3 text-left font-mono tabular-nums font-bold whitespace-nowrap ${
                          batch.totalDiscrepancyAmount < 0
                            ? 'text-rose-600'
                            : batch.totalDiscrepancyAmount > 0
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {batch.totalDiscrepancyAmount === 0
                          ? '0 ج.م'
                          : batch.totalDiscrepancyAmount > 0
                          ? `+${formatEgp(batch.totalDiscrepancyAmount)}`
                          : formatEgp(batch.totalDiscrepancyAmount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {onReverseBatch && (
                          <button
                            type="button"
                            onClick={() => setBatchToReverse(batch)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>عكس الدفعة</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal 1: Approve & Settle Batch */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>اعتماد وتحصيل دفعة COD</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  سيتم تحديث حالة الأوردرات المحددة في الطلبات إلى «تم التحصيل» وحفظها في أرشيف الدفعات لمنع تكرار صرفها.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettleModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
              <div>
                <div className="text-[11px] text-slate-500">الأوردرات المحددة</div>
                <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {selectedSummary.count}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">صافي التوريد الفعلي</div>
                <div className="text-base font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatEgp(selectedSummary.totalSheetNet)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">صافي فرق المطابقة</div>
                <div
                  className={`text-base font-black font-mono tabular-nums mt-0.5 ${
                    selectedSummary.totalDiscrepancy < 0
                      ? 'text-rose-600'
                      : selectedSummary.totalDiscrepancy > 0
                      ? 'text-amber-600'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {selectedSummary.totalDiscrepancy > 0
                    ? `+${formatEgp(selectedSummary.totalDiscrepancy)}`
                    : formatEgp(selectedSummary.totalDiscrepancy)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رقم مرجع الدفعة / كود التحويل (Cashout / Batch ID)
                </label>
                <input
                  type="text"
                  value={batchNumberInput}
                  onChange={e => setBatchNumberInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                  <span>إيداع صافي التحصيل تلقائياً في الخزينة / البنك</span>
                </label>
                <select
                  value={selectedTreasuryId}
                  onChange={e => setSelectedTreasuryId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">بدون إيداع خزينة — تصفية أوردرات فقط</option>
                  {treasuryAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (الرصيد الحالي: {formatEgp(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات محاسبية (اختياري)
                </label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={e => setBatchNotes(e.target.value)}
                  placeholder="مثال: دفعة بوسطة MONCOD16NOV26"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSettleModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSettling}
                onClick={handleConfirmSettlement}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد الاعتماد والتحصيل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Confirm Batch Reversal */}
      {batchToReverse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  تأكيد عكس الدفعة {batchToReverse.batchNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  سيتم إرجاع {batchToReverse.settledOrderIds.length} أوردر إلى حالة «تم التوصيل» وعكس حركة إيداع الخزينة بقيمة{' '}
                  <span className="font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200">
                    {formatEgp(batchToReverse.totalSheetNetAmount)}
                  </span>
                  .
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBatchToReverse(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmReverseBatch}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                نعم، عكس الدفعة الآن
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal 3: Manual Link Sheet Row to Store Order */}
      {manualLinkRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-indigo-600" />
                  <span>مطابقة يدوية — ربط صف الشيت بأوردر بالنظام</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                  البوليصة: {manualLinkRow.trackingKey} · صافي الشيت: {formatEgp(manualLinkRow.sheetNetPayout)}
                  {manualLinkRow.phoneRaw ? ` · هاتف: ${manualLinkRow.phoneRaw}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualLinkRow(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={manualOrderSearch}
                onChange={e => setManualOrderSearch(e.target.value)}
                placeholder="ابحث برقم الأوردر، اسم العميل، الهاتف، أو البوليصة..."
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
              {manualCandidateOrders.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  لا توجد أوردرات مطابقة لكلمة البحث.
                </div>
              ) : (
                manualCandidateOrders.map(order => {
                  const totalCod =
                    Number(order.totalPrice) > 0
                      ? Number(order.totalPrice)
                      : Number(order.productPrice || 0) +
                        Number(order.shippingFee || 0) +
                        Number(order.tax || 0) -
                        Number(order.discount || 0);
                  return (
                    <div
                      key={order.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                          <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                            #{order.orderNumber}
                          </span>
                          <span className="truncate">{order.customerName}</span>
                          <span className="text-[11px] font-normal text-slate-500">
                            ({order.status})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                          {order.customerPhone} · تحصيل: {formatEgp(totalCod)}
                          {order.waybillNumber ? ` · بوليصة: ${order.waybillNumber}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setManualMatches(prev => ({ ...prev, [manualLinkRow.id]: order.id }));
                          notify(
                            `تم ربط البوليصة ${manualLinkRow.trackingKey} يدوياً بالأوردر #${order.orderNumber}.`
                          );
                          setManualLinkRow(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        ربط بالأوردر
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Bosta Cash-out Invoice Drawer/Modal */}
      {inspectedCashout && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  <span>فاتورة السحب النقدي — {inspectedCashout.cashoutId}</span>
                </h2>
                <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  تاريخ الحركة: {inspectedCashout.date || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCashout(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(inspectedCashout.balanceBeforeCashout !== null || inspectedCashout.balanceAfterCashout !== null) && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                <div>
                  <div className="text-slate-500 text-[11px]">الرصيد السابق (قبل التحويل)</div>
                  <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white mt-0.5">
                    {inspectedCashout.balanceBeforeCashout !== null
                      ? formatEgp(inspectedCashout.balanceBeforeCashout)
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[11px]">الرصيد الحالي (بعد التحويل)</div>
                  <div
                    className={`font-mono tabular-nums font-black mt-0.5 ${
                      (inspectedCashout.balanceAfterCashout ?? 0) < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {inspectedCashout.balanceAfterCashout !== null
                      ? formatEgp(inspectedCashout.balanceAfterCashout)
                      : '-'}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">دورات المبالغ المجمعة (COD)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                    {inspectedCashout.linkedOrderCount > 0
                      ? `مقابل ${inspectedCashout.linkedOrderCount} شحنة في Cash Cycles (${inspectedCashout.linkedDeliveredCount} مسلّم · ${inspectedCashout.linkedReturnedCount} مرتجع)`
                      : 'ارفع شيت Cash Cycles الخاص بهذه الدفعة لعرض الشحنات'}
                  </div>
                </div>
                <div className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                  {inspectedCashout.linkedOrderCount > 0
                    ? formatEgp(inspectedCashout.linkedGrossTotal)
                    : '-'}
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">مصاريف بوسطة (شحن + تأمين + ضريبة)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                    {inspectedCashout.linkedOrderCount > 0
                      ? `صافي الدورات بعد المصاريف: ${formatEgp(inspectedCashout.linkedNetTotal)}`
                      : 'مشمولة في صافي الدورات بعد رفع Cash Cycles'}
                  </div>
                </div>
                <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                  {inspectedCashout.linkedOrderCount > 0
                    ? `-${formatEgp(inspectedCashout.linkedFeesTotal)}`
                    : '-'}
                </div>
              </div>

              {inspectedCashout.linkedCompensationsTotal !== 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">تعويض</div>
                    {compensationsByCashoutId.get(inspectedCashout.cashoutId)?.length ? (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono tabular-nums">
                        {compensationsByCashoutId
                          .get(inspectedCashout.cashoutId)!
                          .map(c => `بوليصة ${c.orderId} (${c.customerName || c.orderType})`)
                          .join(' · ')}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 mt-0.5">مقابل شحنات تمت مراجعتها</div>
                    )}
                  </div>
                  <div className="font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400">
                    +{formatEgp(inspectedCashout.linkedCompensationsTotal)}
                  </div>
                </div>
              )}

              {inspectedCashout.transferFees !== 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="font-bold text-slate-800 dark:text-slate-100">رسوم التحويل البنكي</div>
                  <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                    -{formatEgp(inspectedCashout.transferFees)}
                  </div>
                </div>
              )}

              {inspectedCashout.linkedPackingTotal !== 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">طلبات مواد التغليف</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">مقابل خامات تغليف</div>
                  </div>
                  <div
                    className={`font-mono tabular-nums font-black ${
                      inspectedCashout.linkedPackingTotal < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {inspectedCashout.linkedPackingTotal > 0 ? '+' : ''}
                    {formatEgp(inspectedCashout.linkedPackingTotal)}
                  </div>
                </div>
              )}

              {inspectedCashout.linkedPickupTotal !== 0 && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="font-bold text-slate-800 dark:text-slate-100">رسوم البيك أب</div>
                  <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                    {formatEgp(inspectedCashout.linkedPickupTotal)}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60">
                <div>
                  <div className="font-black text-slate-900 dark:text-white">إثبات التحويل البنكي</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono tabular-nums">
                    {inspectedCashout.linkedOrderCount > 0
                      ? Math.abs(inspectedCashout.bankVariance) <= 1
                        ? `مطابق 100% للبنك (فرق ${formatEgp(inspectedCashout.bankVariance)})`
                        : `فرق بنكي: ${formatEgp(inspectedCashout.bankVariance)}`
                      : `التحويل من حساب بوسطة بتاريخ ${inspectedCashout.date || '-'}`}
                  </div>
                </div>
                <div className="font-mono tabular-nums font-black text-base text-emerald-600 dark:text-emerald-400">
                  {formatEgp(inspectedCashout.cashoutAmount)}
                </div>
              </div>

              {(() => {
                const modalConfirmKey =
                  inspectedCashout.cashoutId && inspectedCashout.cashoutId !== '-'
                    ? inspectedCashout.cashoutId
                    : inspectedCashout.id;
                const modalConfirmed = bankConfirmedCashouts[modalConfirmKey];
                return (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500">
                      {modalConfirmed
                        ? `تم تأكيد دخول المبلغ للبنك بتاريخ ${formatDateShort(modalConfirmed.confirmedAt)}`
                        : 'هل راجعت كشف حسابك البنكي وظهر لك هذا الإيداع؟'}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBankConfirm(inspectedCashout)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                        modalConfirmed
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                      }`}
                    >
                      {modalConfirmed ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>وصل البنك (اضغط للإلغاء)</span>
                        </>
                      ) : (
                        <>
                          <Landmark className="w-4 h-4 shrink-0" />
                          <span>تأكيد دخول البنك</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
