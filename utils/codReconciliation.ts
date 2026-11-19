import * as XLSX from 'xlsx';
import {
  CodSettlementBatch,
  CodSheetAmountMode,
  CodSheetColumnProfile,
  Order,
  Settings
} from '../types';
import { calculateOrderProfitLoss } from './financials';

export type UploadedSheetRole =
  | 'bosta_orders'
  | 'cash_cycles'
  | 'transactions'
  | 'compensations'
  | 'pickup_requests'
  | 'bosta_credits'
  | 'warehouse_orders';

export interface UploadedSheetFile {
  id: string;
  fileName: string;
  role: UploadedSheetRole;
  sheetNames: string[];
  headers: string[];
  rows: Array<{
    sheetName: string;
    rowIndex: number;
    raw: Record<string, unknown>;
  }>;
  uploadedAt: string;
}

export interface ColumnMappingConfig {
  amountMode: CodSheetAmountMode;
  trackingCol: string;
  netAmountCol: string;
  grossAmountCol: string;
  feesAmountCol: string;
  codFeeCol: string;
  statusCol: string;
  phoneCol: string;
  dateCol: string;
  paymentStatusCol?: string;
  cashoutIdCol?: string;
  deliveredAtCol?: string;
  businessRefCol?: string;
}

export interface OrderCodExpectation {
  order: Order;
  isPrepaidOrPos: boolean;
  isAlreadySettled: boolean;
  settledBatchNumber?: string;
  expectedGrossCod: number;
  expectedCarrierFees: number;
  expectedNetPayout: number;
  orderDateMs: number;
  daysElapsed: number;
}

export type SheetRowCategory =
  | 'matched_ready'
  | 'collected_untransferred'
  | 'not_collected_customer'
  | 'in_transit_sheet'
  | 'short_paid'
  | 'over_paid'
  | 'duplicate'
  | 'not_found';

export interface SheetRowFeeBreakdown {
  shippingFees: number;
  insuranceFees: number;
  vat: number;
  openingPackageFees: number;
  otherFees: number;
  discountsAndCredits: number;
  flexShipAmount: number;
}

export type WarehouseReturnStatus =
  | 'returned_to_merchant_confirmed'
  | 'still_at_bosta_hub'
  | 'no_return_proof'
  | 'returned_stock_not_restored'
  | 'canceled_before_pickup';

export interface SheetAuditRow {
  id: string;
  fileName: string;
  fileRole: UploadedSheetRole;
  sheetName: string;
  rowIndex: number;
  trackingKey: string;
  businessRefKey?: string;
  phoneRaw: string;
  customerName?: string;
  brandName?: string;
  pickupCity?: string;
  dropoffCity?: string;
  dropoffAddress?: string;
  packageDescription?: string;
  sheetType?: string;
  currentHub?: string;
  exceptionReason?: string;
  attemptsCount?: number;
  returnAttemptsCount?: number;
  awbPrinted?: string;
  whatsappStatus?: string;
  notes?: string;
  expectedPickupDate?: string;
  expectedDeliveryDate?: string;
  scheduledAt?: string;
  onHoldTrials?: number;
  deliveryDelayDays?: number;
  warehouseReturnStatus?: WarehouseReturnStatus;
  warehouseReturnNote?: string;
  wrongReturnWarehouseNote?: string;
  hasFlexShip?: boolean;
  flexShipPaid?: boolean;
  flexShipValue?: number;
  sheetStatus: string;
  sheetPaymentStatus?: string;
  sheetCashoutId?: string;
  sheetDeliveredAt?: string;
  sheetPaidAt?: string;
  payoutLagDays?: number;
  sheetDate?: string;
  sheetGrossAmount: number;
  sheetFeesAmount: number;
  sheetNetPayout: number;
  feeBreakdown?: SheetRowFeeBreakdown;
  matchedOrder: Order | null;
  matchedBy?: 'waybill' | 'order_number' | 'phone_amount' | 'cross_sheet';
  expectation: OrderCodExpectation | null;
  category: SheetRowCategory;
  netVariance: number;
  grossVariance: number;
  feesVariance: number;
  moneyStatusLabel: string;
  reasonSummary: string;
  hasGeneralUnlinkedTransaction?: boolean;
}

export interface MissingOrderAlert {
  id: string;
  order: Order;
  category: 'uncollected_delivered' | 'in_transit_overdue';
  expectation: OrderCodExpectation;
  daysElapsed: number;
  trackingDisplay: string;
  reasonSummary: string;
}

export interface TransactionCashoutEntry {
  id: string;
  fileName: string;
  rowIndex: number;
  cashoutId: string;
  date: string;
  cashoutAmount: number;
  transferFees: number;
  balanceBeforeCashout: number | null;
  balanceAfterCashout: number | null;
  collectionCycleAmount: number;
  bostaFeesCycleAmount: number;
  linkedOrderCount: number;
  linkedDeliveredCount: number;
  linkedReturnedCount: number;
  linkedGrossTotal: number;
  linkedFeesTotal: number;
  linkedNetTotal: number;
  linkedAdjustmentsTotal: number;
  linkedCompensationsTotal: number;
  linkedPackingTotal: number;
  linkedPickupTotal: number;
  bankVariance: number;
  isUnlinkedGeneralPayout: boolean;
}

export interface TransactionLedgerRow {
  id: string;
  fileName: string;
  rowIndex: number;
  transactionId: string;
  date: string;
  category: string;
  categoryAr: string;
  amount: number;
  balance: number | null;
  cashoutId?: string;
  cashoutDate?: string;
  cashoutAmount?: number;
}

export interface WalletBalanceGap {
  id: string;
  fileName: string;
  newerTxId: string;
  olderTxId: string;
  newerDate: string;
  olderDate: string;
  olderBalance: number;
  newerAmount: number;
  expectedNewBalance: number;
  actualNewBalance: number;
  gapAmount: number;
  reasonSummary: string;
}

export interface WalletCompensationAuditEntry {
  id: string;
  transactionId: string;
  date: string;
  category: string;
  categoryAr: string;
  amount: number;
  preVatEquivalent: number;
  cashoutId?: string;
  cashoutDate?: string;
  matchedCompensationOrderId?: string;
  matchedCompensationId?: string;
  matchedCustomerName?: string;
  matchedProduct?: string;
  auditStatus:
    | 'documented_in_comp_sheet'
    | 'undocumented_in_comp_sheet'
    | 'packing_refund'
    | 'balance_adjustment';
  isSuspectedShippingOnlyRefund: boolean;
  inferredNoteAr: string;
}

export interface TransactionsAuditSummary {
  hasTransactionsSheet: boolean;
  currentWalletBalance: number | null;
  totalCollectionCycles: number;
  totalBostaFeesCycles: number;
  netCycleBalance: number;
  totalCashouts: number;
  totalTransferFees: number;
  totalCompensations: number;
  packingMaterialNet: number;
  pickupFeesTotal: number;
  adjustmentsTotal: number;
  unlinkedCashoutTotal: number;
  walletIntegrityStatus: 'verified' | 'mismatch_found' | 'partial_filtered' | 'single_or_empty';
  walletGaps: WalletBalanceGap[];
  walletCompensations: WalletCompensationAuditEntry[];
  undocumentedWalletCompCount: number;
  undocumentedWalletCompAmount: number;
  entries: TransactionCashoutEntry[];
  ledgerRows: TransactionLedgerRow[];
}

export type CompensationAuditVerdict =
  | 'returned_to_warehouse_shipping_refund'
  | 'rto_status_shipping_refund_outside_deliveries'
  | 'true_under_compensated'
  | 'valid_or_full_compensation';

export interface CompensationSheetEntry {
  id: string;
  fileName: string;
  rowIndex: number;
  orderId: string;
  orderReference?: string;
  orderType: string;
  orderStatus: string;
  orderStatusLabel: string;
  compensationId: string;
  compensationAmount: number;
  preVatEquivalent?: number;
  compensationDate: string;
  cashoutId?: string;
  brandName?: string;
  customerName?: string;
  customerPhone?: string;
  packageDescription?: string;
  packageSize?: string;
  pickupCity?: string;
  dropoffCity?: string;
  completedAt?: string;
  confirmedAt?: string;
  matchedOrder: Order | null;
  isPaidOut: boolean;
  expectedProductValue?: number;
  isUnderCompensated?: boolean;
  shortfallAmount?: number;
  underCompReasonAr?: string;
  compAuditVerdict?: CompensationAuditVerdict;
  deliveriesReturnConfirmed?: boolean;
  deliveriesState?: string;
  deliveriesReturnedAt?: string;
  deliveriesReturnAttempts?: number;
  deliveriesCurrentHub?: string;
  shippingRefundBreakdownAr?: string;
}

export interface CompensationsAuditSummary {
  hasCompensationsSheet: boolean;
  totalCompensatedAmount: number;
  paidOutCompensationAmount: number;
  pendingCompensationAmount: number;
  underCompensatedCount: number;
  underCompensatedShortfallAmount: number;
  returnedRtoShippingRefundCount: number;
  outsideDeliveriesRtoCount: number;
  entries: CompensationSheetEntry[];
}

export interface PickupRequestAuditEntry {
  id: string;
  fileName: string;
  rowIndex: number;
  pickupId: string;
  scheduledDate: string;
  creationDate: string;
  brandName?: string;
  businessTier?: string;
  contactName?: string;
  contactNumber?: string;
  addressLine?: string;
  city?: string;
  zone?: string;
  hubName?: string;
  firstMileDistrictCode?: string;
  starName?: string;
  starPhone?: string;
  parcelType?: string;
  repetition?: string;
  noOfSchedulings?: string;
  isFirstPickup?: boolean;
  newPickupId?: string;
  oldPickupId?: string;
  status: string;
  requestedCount: number;
  pickedUpCount: number;
  scannedCount?: number;
  receivedCount?: number;
  confirmedCount?: number;
  sampleTrackingNumber?: string;
  exceptionReason?: string;
  notes?: string;
  variancePickedVsReceived: number;
  variancePickedVsConfirmed?: number;
  isSmallPickupFeeRisk: boolean;
  isRescheduledOrDelayed?: boolean;
  pickupDelayDays?: number;
  assignedDate?: string;
  firstPickedUpDate?: string;
  attemptDate?: string;
  attemptEpochSec?: number | null;
  lastUpdateDate?: string;
  chargedPickupFee?: number;
  chargedTxId?: string;
  chargedCashoutId?: string;
  pickupFeeVerdict?: 'wrongful_deduction' | 'valid_under_limit';
  brandFamily?: string;
  expectedWarehouseBrand?: string;
  sampleTrackingBrand?: string;
  crossBrandSwapId?: string;
  isCrossBrandSwapped?: boolean;
  crossBrandSwapSummary?: string;
  alertFlag:
    | 'wrongful_pickup_fee'
    | 'variance_gap'
    | 'pending_hub_receipt'
    | 'small_pickup_fee_risk'
    | 'canceled'
    | 'ok';
  reasonSummary: string;
}

export interface CrossBrandReturnedTrackingItem {
  trackingKey: string;
  actualBrandName: string;
  expectedReturnWarehouse: string;
  expectedReturnContact?: string;
  routedReturnWarehouse: string;
  routedReturnContact?: string;
  deliveryState: string;
  currentHub?: string;
  customerName?: string;
  dropoffCity?: string;
  packageDescription?: string;
  pickedUpDate?: string;
  updatedAt?: string;
  deliveredAt?: string;
  isAlreadyReturnedToOrigin: boolean;
  isInTransitOrHub: boolean;
}

export interface CrossBrandPickupSwapAlert {
  id: string;
  date: string;
  kind: 'paired_two_way_swap' | 'single_misrouted_pickup';
  pickupId: string;
  recordedBrandName: string;
  warehouseAddress: string;
  warehouseContact?: string;
  warehouseHomeBrand: string;
  actualShipmentsBrand: string;
  pickedUpCount: number;
  confirmedCount?: number;
  sampleTrackingNumber?: string;
  sampleTrackingBrand?: string;
  partnerPickupId?: string;
  partnerWarehouseAddress?: string;
  partnerWarehouseContact?: string;
  partnerWarehouseHomeBrand?: string;
  partnerActualShipmentsBrand?: string;
  partnerPickedUpCount?: number;
  partnerConfirmedCount?: number;
  partnerSampleTrackingNumber?: string;
  affectedTotalShipmentsCount: number;
  affectedReturnsCount: number;
  affectedReturnedShipments: CrossBrandReturnedTrackingItem[];
  reasonSummary: string;
}

export interface PickupFeeAuditEntry {
  id: string;
  transactionId: string;
  txDate: string;
  feeAmount: number;
  cashoutId?: string;
  cashoutDate?: string;
  cashoutAmount?: number;
  matchedSource: 'pickup_requests' | 'deliveries_export' | 'none';
  matchedPickupIds: string[];
  pickupDates: string[];
  shipmentsPickedCount: number;
  scannedCount?: number;
  receivedCount?: number;
  requestedCount?: number;
  minRequiredForFree: number;
  verdict: 'wrongful_deduction' | 'valid_under_limit' | 'unverified_no_pickup_sheet';
  overchargeAmount: number;
  reasonSummary: string;
}

export interface PickupRequestsAuditSummary {
  hasPickupSheet: boolean;
  businessTier?: string;
  totalPickups: number;
  pickedUpRequestsCount: number;
  canceledRequestsCount: number;
  totalPickedUpParcels: number;
  totalReceivedParcels: number;
  varianceGapCount: number;
  confirmedByBusinessMismatchCount: number;
  rescheduledOrDelayedCount: number;
  smallPickupCount: number;
  wrongfulPickupFeeCount: number;
  wrongfulPickupFeeAmount: number;
  crossBrandSwapCount: number;
  crossBrandSwappedReturnsCount: number;
  crossBrandSwaps: CrossBrandPickupSwapAlert[];
  entries: PickupRequestAuditEntry[];
}

export interface BostaCreditEntry {
  id: string;
  fileName: string;
  rowIndex: number;
  businessId?: string;
  transactionId: string;
  trackingNumber?: string;
  manualBoundTracking?: boolean;
  date: string;
  category: string;
  categoryAr: string;
  subCategory?: string;
  amount: number;
  balance: number | null;
  preVatEquivalent?: number;
  inferredReasonAr?: string;
  matchStatus?:
    | 'matched_by_tracking'
    | 'matched_by_fingerprint'
    | 'ambiguous_pool_needs_binding'
    | 'matched_in_deliveries_earlier_cycle'
    | 'surplus_unmatched_voucher'
    | 'spent_deduction';
  candidateTrackingKeys?: string[];
  matchedAnomalyTrackingKey?: string;
  matchedAnomalyCustomerName?: string;
  matchedAnomalyProduct?: string;
  matchedAnomalyZone?: string;
  matchedAnomalySize?: string;
  matchedAnomalyDate?: string;
  matchedAnomalyState?: string;
}

export interface BostaCreditsAuditSummary {
  hasCreditsSheet: boolean;
  currentCreditsBalance: number | null;
  totalAddedCredits: number;
  totalSpentCredits: number;
  voucherCreditsAmount: number;
  packagingPaymentsAmount: number;
  walletIntegrityStatus: 'verified' | 'mismatch_found' | 'single_or_empty';
  matchedVoucherCount: number;
  matchedVoucherAmount: number;
  earlierCycleMatchedCount: number;
  earlierCycleMatchedAmount: number;
  surplusUnmatchedVoucherCount: number;
  surplusUnmatchedVoucherAmount: number;
  uncompensatedRateSizeAnomaliesCount: number;
  uncompensatedRateSizeAnomaliesAmount: number;
  creditsUsedInCashCycles: number;
  entries: BostaCreditEntry[];
}

export interface MissingCompensationAlert {
  id: string;
  alertKind?: 'lost_uncompensated' | 'under_compensated';
  trackingKey: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
  dropoffCity?: string;
  packageDescription?: string;
  sheetStatus: string;
  exceptionReason?: string;
  sheetDate?: string;
  estimatedValue: number;
  paidCompensationAmount?: number;
  matchedOrder: Order | null;
  reasonSummary: string;
}

export type BostaZoneId =
  | 'cairo_giza'
  | 'alex_beheira'
  | 'delta_canal'
  | 'north_upper'
  | 'south_upper'
  | 'north_coast'
  | 'sinai_new_valley';

export type BostaPackageSizeId =
  | 'normal'
  | 'large'
  | 'xlarge'
  | 'xxl'
  | 'light_bulky'
  | 'heavy_bulky';

export type BostaServiceTypeId =
  | 'send'
  | 'exchange'
  | 'customer_return_pickup'
  | 'cash_collection'
  | 'rto';

export type BostaZoneSizeRateRow = Record<BostaServiceTypeId, number>;
export type BostaZoneRateTable = Record<BostaPackageSizeId, BostaZoneSizeRateRow>;
export type BostaRateMatrix = Record<BostaZoneId, BostaZoneRateTable>;

export const BOSTA_ZONE_META: Array<{
  id: BostaZoneId;
  labelAr: string;
  subtitleAr: string;
}> = [
  {
    id: 'cairo_giza',
    labelAr: 'القاهرة والجيزة',
    subtitleAr: 'القاهرة، الجيزة، شبرا الخيمة'
  },
  {
    id: 'alex_beheira',
    labelAr: 'الإسكندرية والبحيرة',
    subtitleAr: 'الإسكندرية والبحيرة'
  },
  {
    id: 'delta_canal',
    labelAr: 'الدلتا والقناة',
    subtitleAr: 'الدقهلية، القليوبية، الغربية، كفر الشيخ، المنوفية، الشرقية، دمياط، الإسماعيلية، بورسعيد، السويس'
  },
  {
    id: 'north_upper',
    labelAr: 'شمال الصعيد',
    subtitleAr: 'الفيوم، بني سويف، المنيا، أسيوط، سوهاج'
  },
  {
    id: 'south_upper',
    labelAr: 'جنوب الصعيد',
    subtitleAr: 'قنا، الأقصر، أسوان، البحر الأحمر، مطروح'
  },
  {
    id: 'north_coast',
    labelAr: 'الساحل الشمالي',
    subtitleAr: 'الساحل الشمالي والعلمين'
  },
  {
    id: 'sinai_new_valley',
    labelAr: 'سيناء والوادي الجديد',
    subtitleAr: 'شمال سيناء، جنوب سيناء، الوادي الجديد'
  }
];

export const BOSTA_PACKAGE_SIZE_META: Array<{
  id: BostaPackageSizeId;
  labelAr: string;
  bostaCsvValues: string;
}> = [
  { id: 'normal', labelAr: 'حجم صغير ومتوسط (Normal)', bostaCsvValues: 'Normal / Small / Medium' },
  { id: 'large', labelAr: 'حجم كبير (L)', bostaCsvValues: 'Large' },
  { id: 'xlarge', labelAr: 'حجم أكبر (XL)', bostaCsvValues: 'X-Large' },
  { id: 'xxl', labelAr: 'كيس أبيض (XXL)', bostaCsvValues: 'XXL / White Bag' },
  { id: 'light_bulky', labelAr: 'شحنة كبيرة (Light Bulky)', bostaCsvValues: 'Light Bulky' },
  { id: 'heavy_bulky', labelAr: 'شحنة ضخمة (Heavy Bulky)', bostaCsvValues: 'Heavy Bulky' }
];

export const BOSTA_SERVICE_TYPE_META: Array<{
  id: BostaServiceTypeId;
  labelAr: string;
}> = [
  { id: 'send', labelAr: 'توصيل' },
  { id: 'exchange', labelAr: 'تبديل' },
  { id: 'customer_return_pickup', labelAr: 'إرجاع' },
  { id: 'cash_collection', labelAr: 'تحصيل نقدي' },
  { id: 'rto', labelAr: 'إرجاع لك' }
];

export const DEFAULT_BOSTA_RATE_MATRIX: BostaRateMatrix = {
  cairo_giza: {
    normal: { send: 77, exchange: 94, customer_return_pickup: 102, cash_collection: 82, rto: 68 },
    large: { send: 77, exchange: 94, customer_return_pickup: 102, cash_collection: 82, rto: 68 },
    xlarge: { send: 77, exchange: 94, customer_return_pickup: 102, cash_collection: 82, rto: 68 },
    xxl: { send: 92, exchange: 109, customer_return_pickup: 117, cash_collection: 97, rto: 83 },
    light_bulky: { send: 167, exchange: 184, customer_return_pickup: 192, cash_collection: 172, rto: 158 },
    heavy_bulky: { send: 348, exchange: 365, customer_return_pickup: 499, cash_collection: 479, rto: 339 }
  },
  alex_beheira: {
    normal: { send: 83, exchange: 100, customer_return_pickup: 102, cash_collection: 82, rto: 74 },
    large: { send: 83, exchange: 100, customer_return_pickup: 102, cash_collection: 82, rto: 74 },
    xlarge: { send: 83, exchange: 100, customer_return_pickup: 102, cash_collection: 82, rto: 74 },
    xxl: { send: 98, exchange: 115, customer_return_pickup: 117, cash_collection: 97, rto: 89 },
    light_bulky: { send: 173, exchange: 190, customer_return_pickup: 192, cash_collection: 172, rto: 164 },
    heavy_bulky: { send: 408, exchange: 425, customer_return_pickup: 499, cash_collection: 479, rto: 399 }
  },
  delta_canal: {
    normal: { send: 91, exchange: 108, customer_return_pickup: 102, cash_collection: 82, rto: 82 },
    large: { send: 91, exchange: 108, customer_return_pickup: 102, cash_collection: 82, rto: 82 },
    xlarge: { send: 91, exchange: 108, customer_return_pickup: 102, cash_collection: 82, rto: 82 },
    xxl: { send: 106, exchange: 123, customer_return_pickup: 117, cash_collection: 97, rto: 97 },
    light_bulky: { send: 181, exchange: 198, customer_return_pickup: 192, cash_collection: 172, rto: 172 },
    heavy_bulky: { send: 488, exchange: 505, customer_return_pickup: 499, cash_collection: 479, rto: 479 }
  },
  north_upper: {
    normal: { send: 106, exchange: 123, customer_return_pickup: 102, cash_collection: 82, rto: 97 },
    large: { send: 106, exchange: 123, customer_return_pickup: 102, cash_collection: 82, rto: 97 },
    xlarge: { send: 106, exchange: 123, customer_return_pickup: 102, cash_collection: 82, rto: 97 },
    xxl: { send: 121, exchange: 138, customer_return_pickup: 117, cash_collection: 97, rto: 112 },
    light_bulky: { send: 196, exchange: 213, customer_return_pickup: 192, cash_collection: 172, rto: 187 },
    heavy_bulky: { send: 638, exchange: 655, customer_return_pickup: 499, cash_collection: 479, rto: 629 }
  },
  south_upper: {
    normal: { send: 123, exchange: 140, customer_return_pickup: 102, cash_collection: 82, rto: 114 },
    large: { send: 123, exchange: 140, customer_return_pickup: 102, cash_collection: 82, rto: 114 },
    xlarge: { send: 123, exchange: 140, customer_return_pickup: 102, cash_collection: 82, rto: 114 },
    xxl: { send: 138, exchange: 155, customer_return_pickup: 117, cash_collection: 97, rto: 129 },
    light_bulky: { send: 213, exchange: 230, customer_return_pickup: 192, cash_collection: 172, rto: 204 },
    heavy_bulky: { send: 808, exchange: 825, customer_return_pickup: 499, cash_collection: 479, rto: 799 }
  },
  north_coast: {
    normal: { send: 127, exchange: 144, customer_return_pickup: 102, cash_collection: 82, rto: 118 },
    large: { send: 127, exchange: 144, customer_return_pickup: 102, cash_collection: 82, rto: 118 },
    xlarge: { send: 127, exchange: 144, customer_return_pickup: 102, cash_collection: 82, rto: 118 },
    xxl: { send: 142, exchange: 159, customer_return_pickup: 117, cash_collection: 97, rto: 133 },
    light_bulky: { send: 217, exchange: 234, customer_return_pickup: 192, cash_collection: 172, rto: 208 },
    heavy_bulky: { send: 848, exchange: 865, customer_return_pickup: 499, cash_collection: 479, rto: 839 }
  },
  sinai_new_valley: {
    normal: { send: 141, exchange: 158, customer_return_pickup: 102, cash_collection: 82, rto: 132 },
    large: { send: 141, exchange: 158, customer_return_pickup: 102, cash_collection: 82, rto: 132 },
    xlarge: { send: 141, exchange: 158, customer_return_pickup: 102, cash_collection: 82, rto: 132 },
    xxl: { send: 156, exchange: 173, customer_return_pickup: 117, cash_collection: 97, rto: 147 },
    light_bulky: { send: 231, exchange: 248, customer_return_pickup: 192, cash_collection: 172, rto: 222 },
    heavy_bulky: { send: 988, exchange: 1005, customer_return_pickup: 499, cash_collection: 479, rto: 979 }
  }
};

export interface ZoneRateConfig {
  cairoGizaMax: number;
  deltaAlexMax: number;
  upperCanalRedSeaMax: number;
  largeSizeSurcharge: number;
  minFreePickupShipments?: number;
  rateMatrix?: BostaRateMatrix;
}

export const DEFAULT_ZONE_RATE_CONFIG: ZoneRateConfig = {
  cairoGizaMax: 77,
  deltaAlexMax: 91,
  upperCanalRedSeaMax: 141,
  largeSizeSurcharge: 90,
  minFreePickupShipments: 3,
  rateMatrix: DEFAULT_BOSTA_RATE_MATRIX
};

export interface FeeAnomalyAlert {
  id: string;
  trackingKey: string;
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
  dropoffCity?: string;
  zoneLabelAr?: string;
  packageDescription?: string;
  packageSize?: string;
  dominantProductSize?: string;
  orderType?: string;
  serviceLabelAr?: string;
  sheetStatus: string;
  sheetCashoutId?: string;
  sheetGrossAmount: number;
  sheetFeesAmount: number;
  shippingFees: number;
  expectedBaseShippingFee?: number;
  expectedNormalSizeShippingFee?: number;
  insuranceFees: number;
  openingPackageFees: number;
  vat: number;
  nextDayFees?: number;
  posFees?: number;
  collectionFees?: number;
  zoneExpectedShippingMax?: number;
  mathCheckDiff?: number;
  otherFees: number;
  expectedLimit: number;
  overchargeEstimate: number;
  rateAndSizeOverchargeWithVat?: number;
  netUncompensatedOvercharge: number;
  isRateOrSizeOvercharge?: boolean;
  isReturnedInsuranceAnomaly?: boolean;
  isInvalidOpeningOnUntouchedReturn?: boolean;
  isForbiddenOpenFeeAnomaly?: boolean;
  isZeroCodDeliveredAnomaly?: boolean;
  orderNotes?: string;
  exceptionReason?: string;
  forwardAttempts?: number;
  compensatedInCredits?: boolean;
  compensatedVia?: 'bosta_credits' | 'cash_wallet' | 'compensations_sheet';
  creditVoucherTxId?: string;
  creditVoucherAmount?: number;
  creditVoucherDate?: string;
  creditMatchType?: 'tracking_number' | 'amount_fingerprint';
  anomalyTags: string[];
  matchedOrder: Order | null;
  reasonSummary: string;
}

export interface ZeroAttemptReturnAlert {
  id: string;
  trackingKey: string;
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
  dropoffCity?: string;
  sheetStatus: string;
  exceptionReason?: string;
  forwardAttempts: number;
  totalAttempts: number;
  shippingFeesDeducted: number;
  sheetCashoutId?: string;
  matchedOrder: Order | null;
  reasonSummary: string;
}

export type InternalFraudCategory =
  | 'cancelled_in_store_delivered_in_bosta'
  | 'cod_downgraded_or_zero'
  | 'product_price_anomaly'
  | 'settled_in_store_no_cashout'
  | 'double_waybill_same_order'
  | 'status_conflict_between_sheets';

export interface InternalFraudAlert {
  id: string;
  fraudType: InternalFraudCategory;
  severity: 'critical' | 'high' | 'medium';
  trackingKey: string;
  secondaryTrackingKey?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
  storeAmount: number;
  bostaAmount: number;
  financialRiskAmount: number;
  storeStatus?: string;
  bostaStatus?: string;
  sheetDate?: string;
  referenceSourceLabel?: string;
  priceDropPercent?: number;
  matchedOrder: Order | null;
  reasonSummary: string;
}

export interface ExchangeAuditAlert {
  id: string;
  trackingKey: string;
  secondaryTrackingKey?: string;
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
  dropoffCity?: string;
  packageDescription?: string;
  orderType: string;
  sheetStatus: string;
  shippingFees: number;
  expectedExchangeFee?: number;
  feeOvercharge: number;
  oldItemStatusFlag: 'old_item_unreturned' | 'fee_overcharge' | 'split_send_and_crp' | 'exchange_ok';
  isPickAndChoose?: boolean;
  returnAttemptsCount?: number;
  collectedCod?: number;
  expectedFullCod?: number;
  sheetDate?: string;
  cashoutId?: string;
  reasonSummary: string;
}

export interface CustomerRiskAlert {
  id: string;
  phone: string;
  customerNames: string[];
  cities: string[];
  totalOrders: number;
  deliveredCount: number;
  returnedCount: number;
  returnRatePercent: number;
  totalReturnedFees: number;
  totalReturnedCodValue: number;
  lastOrderDate?: string;
  sampleTrackingKeys: string[];
  riskLevel: 'critical' | 'high' | 'medium';
  reasonSummary: string;
}

export interface StuckReturnAlert {
  id: string;
  trackingKey: string;
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
  dropoffCity?: string;
  packageDescription?: string;
  sheetStatus: string;
  currentHub?: string;
  exceptionReason?: string;
  expectedReturnDate?: string;
  updatedAt?: string;
  daysOverdue: number;
  returnAttemptsCount: number;
  onHoldTrials: number;
  codAmount: number;
  matchedOrder: Order | null;
  wrongReturnWarehouseNote?: string;
  reasonSummary: string;
}

export interface OnlineFlexAuditRow {
  id: string;
  trackingKey: string;
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
  sheetStatus: string;
  sheetPaymentStatus?: string;
  sheetCashoutId?: string;
  onlinePaymentAmount: number;
  depositAmount: number;
  hasFlexShip: boolean;
  flexShipPaid?: boolean;
  flexShipValue: number;
  flexShipAmount: number;
  flexShipFees: number;
  sheetNetPayout: number;
  statusFlag: 'unpaid_flex' | 'untransferred_online' | 'returned_with_flex' | 'settled_ok';
  matchedOrder: Order | null;
  reasonSummary: string;
}

export interface PayoutSlaEntry {
  trackingKey: string;
  customerName?: string;
  cashoutId?: string;
  confirmedDate: string;
  paidDate: string;
  lagDays: number;
  netAmount: number;
  statusFlag?: 'paid_delayed' | 'unpaid_overdue' | 'skipped_out_of_order';
}

export interface PayoutSlaSummary {
  hasPaidAtData: boolean;
  evaluatedCount: number;
  avgLagDays: number;
  maxLagDays: number;
  slaThresholdDays: number;
  delayedCount: number;
  unpaidOverdueCount: number;
  skippedOutOfOrderCount: number;
  delayedAmount: number;
  delayedRows: PayoutSlaEntry[];
}

export interface DeliverySlaItem {
  id: string;
  trackingKey: string;
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
  dropoffCity?: string;
  deliveryState: string;
  expectedPickupDate?: string;
  pickedUpDate?: string;
  expectedDeliveryDate?: string;
  scheduledAt?: string;
  actualDeliveredAt?: string;
  delayDays: number;
  pickupDelayDays: number;
  onHoldTrials: number;
  whatsappStatus?: string;
  notes?: string;
  latestExceptionReason?: string;
  slaCategory: 'returned_after_delay' | 'delivered_late' | 'overdue_active' | 'pickup_delayed';
  reasonSummary: string;
}

export interface DeliverySlaSummary {
  hasDeliveriesSlaData: boolean;
  totalWithExpectedDate: number;
  delayedDeliveredCount: number;
  overdueActiveCount: number;
  returnedAfterDelayCount: number;
  pickupDelayedCount: number;
  onHoldAffectedCount: number;
  whatsappStats: {
    totalWithStatus: number;
    confirmedCount: number;
    confirmedReturnedCount: number;
    confirmedReturnRate: number;
    noResponseCount: number;
    noResponseReturnedCount: number;
    noResponseReturnRate: number;
    failedCount: number;
    failedReturnedCount: number;
    failedReturnRate: number;
  };
  items: DeliverySlaItem[];
}

export interface TwoWayCodAuditResult {
  matchWithStoreOrders: boolean;
  availableSheetBrands: string[];
  sheetRows: SheetAuditRow[];
  matchedReady: SheetAuditRow[];
  collectedUntransferred: SheetAuditRow[];
  notCollectedCustomer: SheetAuditRow[];
  inTransitInSheet: SheetAuditRow[];
  shortPaid: SheetAuditRow[];
  overPaid: SheetAuditRow[];
  duplicates: SheetAuditRow[];
  notFound: SheetAuditRow[];
  uncollectedDelivered: MissingOrderAlert[];
  inTransitOverdue: MissingOrderAlert[];
  missingCompensations: MissingCompensationAlert[];
  feeAnomalies: FeeAnomalyAlert[];
  stuckReturns: StuckReturnAlert[];
  onlineAndFlexAlerts: OnlineFlexAuditRow[];
  zeroAttemptReturns: ZeroAttemptReturnAlert[];
  internalFraudAlerts: InternalFraudAlert[];
  exchangeAudits: ExchangeAuditAlert[];
  customerRiskAlerts: CustomerRiskAlert[];
  transactionsSummary: TransactionsAuditSummary;
  compensationsSummary: CompensationsAuditSummary;
  pickupRequestsSummary: PickupRequestsAuditSummary;
  pickupFeeAudits: PickupFeeAuditEntry[];
  bostaCreditsSummary: BostaCreditsAuditSummary;
  payoutSlaSummary: PayoutSlaSummary;
  deliverySlaSummary: DeliverySlaSummary;
  healthyInTransitCount: number;
  alreadySettledCount: number;
  totals: {
    uncollectedDeliveredAmount: number;
    collectedUntransferredAmount: number;
    collectedUntransferredGross: number;
    inTransitOverdueAmount: number;
    shortPaidDeficitAmount: number;
    overPaidSurplusAmount: number;
    matchedReadyNetAmount: number;
    matchedReadyExpectedNet: number;
    totalSheetNetAmount: number;
    returnedFeesDeducted: number;
    returnedInsuranceCount: number;
    returnedInsuranceWithVat: number;
    returnedOpeningCount: number;
    returnedOpeningWithVat: number;
    returnedUntouchedOpeningCount: number;
    returnedUntouchedOpeningWithVat: number;
    forbiddenOpenFeeCount: number;
    forbiddenOpenFeeWithVat: number;
    returnedConfirmedToWarehouseCount: number;
    returnedNotInWarehouseCount: number;
    returnedStockNotRestoredCount: number;
    zeroCodDeliveredCount: number;
    missingCompensationsAmount: number;
    underCompensatedCount: number;
    underCompensatedShortfallAmount: number;
    totalFeeOverchargeAmount: number;
    grossFeeOverchargeAmount: number;
    compensatedInCreditsFeeAmount: number;
    uncompensatedRateSizeOverchargeAmount: number;
    stuckReturnsValueAmount: number;
    onlineAndFlexAmount: number;
    zeroAttemptFeesAmount: number;
    internalFraudRiskAmount: number;
    productPriceAnomalyCount: number;
    productPriceAnomalyAmount: number;
    exchangeIssueCount: number;
    exchangeRiskAmount: number;
    customerRiskBurnedFees: number;
    wrongfulPickupFeeAmount: number;
    wrongfulPickupFeeCount: number;
    crossBrandSwapCount: number;
    crossBrandSwappedReturnsCount: number;
    undocumentedWalletCompCount: number;
    undocumentedWalletCompAmount: number;
    delayedPayoutsCount: number;
    avgPayoutLagDays: number;
  };
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toWesternDigits(input: unknown): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(ARABIC_INDIC_DIGITS[i], 'g'), String(i));
  }
  return str;
}

export function normalizeTrackingCode(input: unknown): string {
  const s = toWesternDigits(input)
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!s || s === 'N/A' || s === 'NA' || s === 'NONE' || s === 'NULL' || s === '-') return '';
  return s;
}

export function normalizePhoneKey(input: unknown): string {
  const digits = toWesternDigits(input).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20') && digits.length >= 12) {
    return digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `0${digits}`;
  }
  return digits;
}

export function parseNumericCell(input: unknown): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) / 100 : 0;
  }
  if (input === null || input === undefined) return 0;
  let cleaned = toWesternDigits(input).trim();
  if (!cleaned || cleaned.toUpperCase() === 'N/A' || cleaned === '-') return 0;
  const isParenNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  // Bosta uses Arabic decimal separator U+066B (٫) in CSV exports! Convert BEFORE stripping noise.
  cleaned = cleaned
    .replace(/\u066B/g, '.')
    .replace(/[\u066C,،\s]/g, '')
    .replace(/[^\d.-]/g, '');
  const val = parseFloat(cleaned);
  if (!Number.isFinite(val)) return 0;
  const signed = isParenNeg ? -Math.abs(val) : val;
  return Math.round(signed * 100) / 100;
}

export function formatSheetDateCell(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'number' && Number.isFinite(input) && input >= 25000 && input <= 90000) {
    const parsed = XLSX.SSF.parse_date_code(input);
    if (parsed && parsed.y > 1970) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const str = String(input).trim();
  if (!str) return '';
  if (/^\d{13}$/.test(str)) {
    const ms = Number(str);
    if (Number.isFinite(ms) && ms > 946684800000) {
      const dt = new Date(ms);
      if (!Number.isNaN(dt.getTime())) {
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      }
    }
  }
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num >= 25000 && num <= 90000) {
      const parsed = XLSX.SSF.parse_date_code(num);
      if (parsed && parsed.y > 1970) {
        const mm = String(parsed.m).padStart(2, '0');
        const dd = String(parsed.d).padStart(2, '0');
        return `${parsed.y}-${mm}-${dd}`;
      }
    }
  }
  const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,T\s]+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(str);
  if (slashMatch) {
    const p1 = Number(slashMatch[1]);
    const p2 = Number(slashMatch[2]);
    const yyyy = slashMatch[3];
    // Bosta CSV/XLSX exports use MM/DD/YYYY or MM-DD-YYYY, HH:mm:ss; handle DD/MM/YYYY if first > 12
    const month = p1 > 12 ? p2 : p1;
    const day = p1 > 12 ? p1 : p2;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return str;
}

export function parseSheetTimestampEpochSec(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number' && Number.isFinite(input) && input >= 25000 && input <= 90000) {
    const parsed = XLSX.SSF.parse_date_code(input);
    if (parsed && parsed.y > 1970) {
      return Math.floor(
        Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0)) /
          1000
      );
    }
  }
  const str = String(input).trim();
  if (!str) return null;
  const slashTimeMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[,T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(str);
  if (slashTimeMatch) {
    const p1 = Number(slashTimeMatch[1]);
    const p2 = Number(slashTimeMatch[2]);
    const yyyy = Number(slashTimeMatch[3]);
    const month = p1 > 12 ? p2 : p1;
    const day = p1 > 12 ? p1 : p2;
    const hh = Number(slashTimeMatch[4]);
    const mm = Number(slashTimeMatch[5]);
    const ss = Number(slashTimeMatch[6] || 0);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return Math.floor(Date.UTC(yyyy, month - 1, day, hh, mm, ss) / 1000);
    }
  }
  const isoTimeMatch = /^(\d{4})-(\d{2})-(\d{2})[,T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(str);
  if (isoTimeMatch) {
    const yyyy = Number(isoTimeMatch[1]);
    const month = Number(isoTimeMatch[2]);
    const day = Number(isoTimeMatch[3]);
    const hh = Number(isoTimeMatch[4]);
    const mm = Number(isoTimeMatch[5]);
    const ss = Number(isoTimeMatch[6] || 0);
    return Math.floor(Date.UTC(yyyy, month - 1, day, hh, mm, ss) / 1000);
  }
  return null;
}

export function detectUploadedSheetRole(
  fileName: string,
  sheetNames: string[],
  headers: string[]
): UploadedSheetRole {
  const lowHeaders = headers.map(h => String(h ?? '').trim().toLowerCase());
  const hasHeader = (patterns: string[], excludes: string[] = []) =>
    lowHeaders.some(
      h => patterns.some(p => h.includes(p)) && !excludes.some(ex => h.includes(ex))
    );
  const hasExactHeader = (names: string[]) => lowHeaders.some(h => names.includes(h));

  const lowName = `${fileName} ${sheetNames.join(' ')}`.toLowerCase();

  // 0. Compensations Export Sheet (Bosta Compensation Table: Compensation Amount / Compensation ID / Compensation Date)
  if (
    hasExactHeader(['compensation amount', 'compensation id']) ||
    hasHeader(['compensation amount', 'compensation date']) ||
    (lowName.includes('compensation') && hasHeader(['order id', 'cash-out id']))
  ) {
    return 'compensations';
  }

  // 0b. Pickup Requests Sheet (Bosta Business Pickup Export: Pickup ID + Scheduled Date / Star Name / Hub Name)
  if (
    hasExactHeader(['pickup id', 'star name']) ||
    hasExactHeader(['pickup id', 'scheduled date']) ||
    (lowName.includes('pickup') && hasHeader(['pickup id', 'hub name']))
  ) {
    return 'pickup_requests';
  }

  // 0c. Bosta Credits Wallet Sheet (business_id, tracking_number, balance, amount, transaction_id, category, sub_category, created_at)
  if (
    (hasExactHeader(['transaction_id']) && hasExactHeader(['balance']) && hasExactHeader(['amount'])) ||
    (lowName.includes('credit') && hasExactHeader(['balance']) && hasExactHeader(['amount']) && hasExactHeader(['category']))
  ) {
    return 'bosta_credits';
  }

  // 1. Transactions Sheet (Bosta Account Statement: Transactions ID / Category / Balance / Cashout Amount)
  if (
    hasExactHeader(['transactions id', 'category', 'balance']) ||
    hasHeader(['transactions id', 'cashout amount', 'cashout date']) ||
    (lowName.includes('transaction') && !hasHeader(['cod', 'delivery state', 'order status']))
  ) {
    return 'transactions';
  }

  // 2. Bosta Orders Sheet (Deliveries Export: Delivery State / Tracking Number / Confirmed Delivery At)
  if (
    hasExactHeader(['delivery state', 'tracking number']) ||
    hasHeader(['delivery state', 'confirmed delivery at'])
  ) {
    return 'bosta_orders';
  }

  // 3. Cash Cycles Sheet (Bosta financial order-level settlement breakdown)
  if (
    hasExactHeader(['payment status', 'cash-out id', 'net value', 'total fees']) ||
    hasHeader(['net value', 'cash-out id']) ||
    (hasHeader(['payment status'], ['flex']) && hasHeader(['cod', 'order status'])) ||
    lowName.includes('cash cycle') ||
    lowName.includes('cash_cycle') ||
    lowName.includes('cashcycle')
  ) {
    return 'cash_cycles';
  }

  // 4. Warehouse / Internal Orders Sheet
  if (
    hasHeader(['صاحب البضاعة', 'المستودع', 'الموكل', 'اسم التاجر', 'merchant']) &&
    !hasHeader(['delivery state', 'confirmed delivery at'])
  ) {
    return 'warehouse_orders';
  }

  // Default fallback
  return hasHeader(['net value', 'صافي', 'total fees', 'شحن'], ['flex'])
    ? 'cash_cycles'
    : 'bosta_orders';
}

function readWorkbookSafely(buffer: ArrayBuffer, fileName: string): XLSX.WorkBook {
  const bytes = new Uint8Array(buffer);
  const isZipXlsx = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b; // PK..
  const isOleXls =
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;
  const lowerName = fileName.toLowerCase();
  const isTextCsv =
    !isZipXlsx &&
    !isOleXls &&
    (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt') || (!lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')));

  if (isTextCsv) {
    // Decode as UTF-8 with raw: true so BOM-less Arabic CSV exports keep exact dates, Arabic text, and U+066B decimals!
    let text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (text.includes('\uFFFD')) {
      try {
        text = new TextDecoder('windows-1256').decode(bytes);
      } catch {
        // Keep UTF-8 text if windows-1256 isn't supported in environment
      }
    }
    return XLSX.read(text, { type: 'string', raw: true });
  }

  return XLSX.read(buffer, { type: 'array' });
}

export async function parseExcelOrCsvFiles(
  fileList: FileList | File[],
  forcedRole?: UploadedSheetRole
): Promise<UploadedSheetFile[]> {
  const files = Array.from(fileList);
  const parsedFiles: UploadedSheetFile[] = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const workbook = readWorkbookSafely(buffer, file.name);
    const headerSet = new Set<string>();
    const combinedRows: UploadedSheetFile['rows'] = [];

    workbook.SheetNames.forEach(sheetName => {
      const ws = workbook.Sheets[sheetName];
      if (!ws) return;
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (json.length === 0) return;

      json.forEach((rawRow, idx) => {
        Object.keys(rawRow).forEach(k => {
          const cleanKey = String(k).trim();
          if (cleanKey && !cleanKey.startsWith('__EMPTY')) {
            headerSet.add(cleanKey);
          }
        });
        combinedRows.push({
          sheetName,
          rowIndex: idx + 2,
          raw: rawRow
        });
      });
    });

    if (combinedRows.length > 0) {
      const headers = Array.from(headerSet);
      const role = forcedRole || detectUploadedSheetRole(file.name, workbook.SheetNames, headers);
      parsedFiles.push({
        id: `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        role,
        sheetNames: workbook.SheetNames,
        headers,
        rows: combinedRows,
        uploadedAt: new Date().toISOString()
      });
    }
  }

  return parsedFiles;
}

const findBestHeader = (
  headers: string[],
  patterns: string[],
  excludePatterns: string[] = []
): string => {
  const normalized = headers.map(h => ({ raw: h, low: h.trim().toLowerCase() }));
  for (const pat of patterns) {
    const exact = normalized.find(
      h => h.low === pat && !excludePatterns.some(ex => h.low.includes(ex))
    );
    if (exact) return exact.raw;
  }
  for (const pat of patterns) {
    const found = normalized.find(
      h => h.low.includes(pat) && !excludePatterns.some(ex => h.low.includes(ex))
    );
    if (found) return found.raw;
  }
  return '';
};

export function autoDetectSheetMapping(
  headers: string[],
  savedProfile?: CodSheetColumnProfile | null
): ColumnMappingConfig {
  if (savedProfile && headers.includes(savedProfile.trackingCol)) {
    return {
      amountMode: savedProfile.amountMode,
      trackingCol: savedProfile.trackingCol,
      netAmountCol:
        savedProfile.netAmountCol && headers.includes(savedProfile.netAmountCol)
          ? savedProfile.netAmountCol
          : '',
      grossAmountCol:
        savedProfile.grossAmountCol && headers.includes(savedProfile.grossAmountCol)
          ? savedProfile.grossAmountCol
          : '',
      feesAmountCol:
        savedProfile.feesAmountCol && headers.includes(savedProfile.feesAmountCol)
          ? savedProfile.feesAmountCol
          : '',
      codFeeCol:
        savedProfile.codFeeCol && headers.includes(savedProfile.codFeeCol)
          ? savedProfile.codFeeCol
          : '',
      statusCol:
        savedProfile.statusCol && headers.includes(savedProfile.statusCol)
          ? savedProfile.statusCol
          : '',
      phoneCol:
        savedProfile.phoneCol && headers.includes(savedProfile.phoneCol)
          ? savedProfile.phoneCol
          : '',
      dateCol:
        savedProfile.dateCol && headers.includes(savedProfile.dateCol)
          ? savedProfile.dateCol
          : '',
      paymentStatusCol: findBestHeader(headers, ['payment status', 'حالة الدفع', 'حالة التحويل'], ['flex']),
      cashoutIdCol: findBestHeader(headers, ['cash-out id', 'cashout id', 'رقم التحويل', 'cashout_id']),
      deliveredAtCol: findBestHeader(headers, ['delivered at', 'confirmed delivery at', 'تاريخ التسليم']),
      businessRefCol: findBestHeader(headers, [
        'business reference number',
        'business reference',
        'order reference',
        'الرقم المرجعي',
        'رقم الأوردر'
      ])
    };
  }

  const trackingCol =
    findBestHeader(headers, [
      'tracking number',
      'trackingnumber',
      'tracking_number',
      'tracking',
      'order id',
      'waybill',
      'awb',
      'بوليصة',
      'بوليصه',
      'رقم الشحنة',
      'رقم الشحنه',
      'رقم البوليصة',
      'رقم التتبع',
      'رقم الطلب',
      'order number',
      'كود الشحنة',
      'كود'
    ]) ||
    headers[0] ||
    '';

  const businessRefCol = findBestHeader(headers, [
    'business reference number',
    'business reference',
    'order reference',
    'businessreference',
    'الرقم المرجعي',
    'مرجع الأوردر',
    'رقم الأوردر الداخلي'
  ]);

  const netAmountCol = findBestHeader(
    headers,
    [
      'net value',
      'net payout',
      'net amount',
      'payout',
      'transferred',
      'صافي التحويل',
      'صافي التحصيل',
      'الصافي',
      'صافي المستحق',
      'المحول',
      'المستحق للتاجر',
      'صافي',
      'net'
    ],
    ['phone', 'date']
  );

  const grossAmountCol = findBestHeader(
    headers,
    [
      'cod amount',
      'cod',
      'collected amount',
      'cash collected',
      'total amount',
      'gross',
      'إجمالي التحصيل',
      'اجمالي التحصيل',
      'المبلغ المحصل',
      'قيمة التحصيل',
      'قيمة الاوردر',
      'التحصيل',
      'المحصل',
      'المطلوب',
      'المبلغ',
      'amount'
    ],
    ['fee', 'رسوم', 'عمولة', 'شحن', 'net', 'صافي', 'cashout', 'online', 'flex', 'deposit']
  );

  const feesAmountCol = findBestHeader(
    headers,
    [
      'total fees',
      'shipping fee',
      'shipping cost',
      'delivery fee',
      'fees',
      'deduction',
      'مصاريف الشحن',
      'تكلفة الشحن',
      'قيمة الشحن',
      'رسوم الشحن',
      'إجمالي المصاريف',
      'اجمالي الرسوم',
      'الخصم',
      'شحن'
    ],
    ['address', 'area', 'company', 'منطقة', 'شركة', 'transfer']
  );

  // If feesAmountCol is already Total Fees, it already includes VAT, COD Fees, Insurance & Opening Package Fees!
  const isTotalFeesCol = feesAmountCol.toLowerCase().includes('total') || feesAmountCol.includes('إجمالي');
  const codFeeCol = isTotalFeesCol
    ? ''
    : findBestHeader(headers, [
        'cod fee',
        'collection fee',
        'cash fee',
        'رسوم تحصيل',
        'عمولة تحصيل',
        'ضريبة',
        'vat',
        'تأمين',
        'insurance'
      ]);

  const statusCol = findBestHeader(
    headers,
    ['delivery state', 'order status', 'status', 'state', 'حالة الشحنة', 'حالة', 'حاله', 'الحالة'],
    ['payment', 'whatsapp', 'flex']
  );

  const paymentStatusCol = findBestHeader(
    headers,
    ['payment status', 'حالة الدفع', 'حالة التحويل', 'حالة التسوية'],
    ['flex']
  );

  const cashoutIdCol = findBestHeader(headers, [
    'cash-out id',
    'cashout id',
    'cashout_id',
    'remittance id',
    'رقم التحويل',
    'رقم التسوية'
  ]);

  const deliveredAtCol = findBestHeader(headers, [
    'delivered at',
    'confirmed delivery at',
    'delivery date',
    'تاريخ التسليم'
  ]);

  const phoneCol = findBestHeader(headers, [
    'consignee phone',
    'phone',
    'mobile',
    'tel',
    'هاتف',
    'تليفون',
    'موبايل',
    'جوال',
    'رقم العميل'
  ]);

  const dateCol = findBestHeader(headers, [
    'paid at',
    'payout date',
    'settlement date',
    'delivered at',
    'delivery date',
    'created at',
    'تاريخ التحويل',
    'تاريخ التسليم',
    'التاريخ',
    'date'
  ]);

  let amountMode: CodSheetAmountMode = 'net_payout';
  if (grossAmountCol && feesAmountCol && !netAmountCol) {
    amountMode = 'gross_and_fees';
  } else if (grossAmountCol && feesAmountCol && netAmountCol) {
    // Bosta Cash Cycles has COD, Total Fees, AND Net Value — gross_and_fees validates both!
    amountMode = 'gross_and_fees';
  } else if (netAmountCol) {
    amountMode = 'net_payout';
  } else if (grossAmountCol) {
    amountMode = 'gross_only';
  }

  return {
    amountMode,
    trackingCol,
    netAmountCol: netAmountCol || grossAmountCol || '',
    grossAmountCol: grossAmountCol || netAmountCol || '',
    feesAmountCol,
    codFeeCol,
    statusCol,
    phoneCol,
    dateCol,
    paymentStatusCol,
    cashoutIdCol,
    deliveredAtCol,
    businessRefCol
  };
}

export function isOrderPosOrPrepaid(order: Order): boolean {
  const isPos =
    order.channel === 'pos' ||
    order.shippingCompany === 'كاشير - بيع مباشر' ||
    order.shippingArea === 'نقطة البيع' ||
    Boolean(order.id && order.id.startsWith('POS-'));
  if (isPos) return true;
  if (order.status === 'مدفوعة') return true;
  const pm = String(order.paymentMethod || '').toLowerCase();
  const isOnlinePrepaid =
    (pm.includes('card') ||
      pm.includes('instapay') ||
      pm.includes('wallet') ||
      pm.includes('visa') ||
      pm.includes('بطاقة')) &&
    order.paymentStatus === 'مدفوع' &&
    !order.codPayoutBatchId;
  return isOnlinePrepaid;
}

export function isOrderCancelledOrReturned(order: Order): boolean {
  return [
    'ملغي',
    'مؤرشف',
    'مرتجع',
    'فشل_التوصيل',
    'تمت_الاعادة_لشركة_الشحن',
    'مرتجع_بعد_الاستلام'
  ].includes(order.status);
}

export function isOrderDeliveredStatus(order: Order): boolean {
  return ['تم_التوصيل', 'تم_توصيلها', 'تم_التحصيل', 'تم_الاستبدال', 'مرتجع_جزئي'].includes(
    order.status
  );
}

export function isOrderAlreadySettled(
  order: Order,
  settledOrderIdsInBatches: Set<string>
): { settled: boolean; batchNumber?: string } {
  if (order.codPayoutBatchId) {
    return { settled: true, batchNumber: order.codPayoutSheetRef || order.codPayoutBatchId };
  }
  if (settledOrderIdsInBatches.has(order.id)) {
    return { settled: true };
  }
  if (order.status === 'تم_التحصيل' || order.collectionProcessed === true) {
    return { settled: true };
  }
  return { settled: false };
}

export function computeOrderCodExpectation(
  order: Order,
  settings: Settings,
  settledOrderIdsInBatches: Set<string>,
  nowMs: number = Date.now()
): OrderCodExpectation {
  const isPrepaidOrPos = isOrderPosOrPrepaid(order);
  const settledCheck = isOrderAlreadySettled(order, settledOrderIdsInBatches);

  const pl = calculateOrderProfitLoss(order, settings);
  const advancePaidDirectly = Number(order.advancePayment) || 0;
  const rawTotalPrice = Number(order.totalPrice) || 0;
  const calculatedGross =
    pl.netRevenue > 0
      ? Math.max(0, pl.netRevenue - advancePaidDirectly)
      : Math.max(
          0,
          rawTotalPrice > 0
            ? rawTotalPrice
            : Number(order.productPrice || 0) +
                Number(order.shippingFee || 0) +
                Number(order.tax || 0) -
                Number(order.discount || 0) -
                advancePaidDirectly
        );

  const expectedGrossCod = isPrepaidOrPos ? 0 : Math.round(calculatedGross * 100) / 100;
  const expectedCarrierFees = isPrepaidOrPos ? 0 : Math.round((pl.carrierFees || 0) * 100) / 100;
  const expectedNetPayout = Math.max(
    0,
    Math.round((expectedGrossCod - expectedCarrierFees) * 100) / 100
  );

  const dateSource =
    order.lastShippingEventAt || order.confirmedAt || order.date || order.createdAt || '';
  const parsedMs = dateSource ? new Date(dateSource).getTime() : nowMs;
  const orderDateMs = Number.isFinite(parsedMs) ? parsedMs : nowMs;
  const daysElapsed = Math.max(0, Math.floor((nowMs - orderDateMs) / 86400000));

  return {
    order,
    isPrepaidOrPos,
    isAlreadySettled: settledCheck.settled,
    settledBatchNumber: settledCheck.batchNumber,
    expectedGrossCod,
    expectedCarrierFees,
    expectedNetPayout,
    orderDateMs,
    daysElapsed
  };
}

const isReturnedOrUncollectedStatus = (statusStr: string): boolean => {
  const low = statusStr.trim().toLowerCase();
  if (!low) return false;
  return (
    low.includes('return') ||
    low.includes('cancel') ||
    low.includes('terminat') ||
    low.includes('deleted') ||
    low.includes('exception') ||
    low.includes('fail') ||
    low.includes('lost') ||
    low.includes('damaged') ||
    low.includes('مرتجع') ||
    low.includes('ملغي') ||
    low.includes('محذوف') ||
    low.includes('فشل')
  );
};

const isSheetInTransitStatus = (statusStr: string): boolean => {
  const low = statusStr.trim().toLowerCase();
  if (!low) return false;
  return (
    low.includes('ready to dispatch') ||
    low.includes('picked up') ||
    low.includes('received at warehouse') ||
    low.includes('in transit') ||
    low.includes('out for delivery') ||
    low.includes('heading') ||
    low.includes('in progress') ||
    low.includes('قيد الشحن') ||
    low.includes('جاري التوصيل') ||
    low.includes('تم الاستلام من التاجر')
  );
};

const isExplicitDeliveredStatus = (statusStr: string): boolean => {
  const low = statusStr.trim().toLowerCase();
  if (!low) return false;
  return (
    low === 'delivered' ||
    low.includes('delivered') ||
    low.includes('تم التسليم') ||
    low.includes('تم التوصيل') ||
    low.includes('تم التحصيل')
  );
};

const isExplicitNotPaid = (paymentStatusStr: string): boolean => {
  const low = paymentStatusStr.trim().toLowerCase();
  if (!low) return false;
  return (
    low === 'not paid' ||
    low === 'unpaid' ||
    low.includes('not paid') ||
    low.includes('pending') ||
    low.includes('غير مدفوع') ||
    low.includes('لم يدفع')
  );
};

const isExplicitPaid = (paymentStatusStr: string): boolean => {
  const low = paymentStatusStr.trim().toLowerCase();
  if (!low) return false;
  return (
    (low === 'paid' || low.includes('paid') || low.includes('مدفوع') || low.includes('محول')) &&
    !isExplicitNotPaid(low)
  );
};

const pickCell = (
  raw: Record<string, unknown>,
  colName?: string,
  fallbackNames: string[] = [],
  excludeSubstrings: string[] = []
): unknown => {
  if (colName && raw[colName] !== undefined && raw[colName] !== '') return raw[colName];
  const keys = Object.keys(raw);
  for (const pat of fallbackNames) {
    const exact = keys.find(k => k.trim().toLowerCase() === pat);
    if (exact && raw[exact] !== undefined && raw[exact] !== '') return raw[exact];
    const found = keys.find(k => {
      const low = k.trim().toLowerCase();
      return low.includes(pat) && !excludeSubstrings.some(ex => low.includes(ex));
    });
    if (found && raw[found] !== undefined && raw[found] !== '') return raw[found];
  }
  return '';
};

export function runTwoWayCodAudit(params: {
  orders: Order[];
  settings: Settings;
  uploadedFiles: UploadedSheetFile[];
  mapping: ColumnMappingConfig;
  toleranceEgp: number;
  graceDaysForInTransit: number;
  maxExpectedShippingFee?: number;
  zoneRates?: ZoneRateConfig;
  carrierFilter?: string;
  sheetBrandFilter?: string;
  matchWithStoreOrders?: boolean;
  enableProductPriceAudit?: boolean;
  productPriceAuditSource?: 'hybrid' | 'inventory_only' | 'sheet_median';
  manualMatches?: Record<string, string>;
  manualCreditTrackingMap?: Record<string, string>;
  nowMs?: number;
}): TwoWayCodAuditResult {
  const {
    orders,
    settings,
    uploadedFiles,
    mapping,
    toleranceEgp,
    graceDaysForInTransit,
    maxExpectedShippingFee = 110,
    zoneRates = DEFAULT_ZONE_RATE_CONFIG,
    carrierFilter = 'all',
    sheetBrandFilter = 'all',
    matchWithStoreOrders = true,
    enableProductPriceAudit = true,
    productPriceAuditSource = 'hybrid',
    manualMatches = {},
    manualCreditTrackingMap = {},
    nowMs = Date.now()
  } = params;

  const batches: CodSettlementBatch[] = settings.codReconciliationBatches || [];
  const settledOrderIdsInBatches = new Set<string>();
  const batchNumberByOrderId = new Map<string, string>();
  batches.forEach(b => {
    (b.settledOrderIds || []).forEach(oid => {
      settledOrderIdsInBatches.add(oid);
      batchNumberByOrderId.set(oid, b.batchNumber);
    });
  });

  // Store Orders Index (used when matchWithStoreOrders === true)
  const waybillMap = new Map<string, Order>();
  const orderNumberMap = new Map<string, Order>();
  const phoneOrdersMap = new Map<string, Order[]>();
  const expectationsByOrderId = new Map<string, OrderCodExpectation>();

  if (matchWithStoreOrders) {
    orders.forEach(order => {
      const exp = computeOrderCodExpectation(order, settings, settledOrderIdsInBatches, nowMs);
      if (!exp.settledBatchNumber && batchNumberByOrderId.has(order.id)) {
        exp.settledBatchNumber = batchNumberByOrderId.get(order.id);
      }
      expectationsByOrderId.set(order.id, exp);

      const wbKeys = [
        order.waybillNumber,
        order.bostaTrackingNumber,
        order.turboTrackingNumber,
        order.bostaDeliveryId,
        order.turboDeliveryId,
        order.returnTrackingNumber
      ];
      wbKeys.forEach(k => {
        const norm = normalizeTrackingCode(k);
        if (norm && !waybillMap.has(norm)) waybillMap.set(norm, order);
      });

      const idKeys = [order.orderNumber, order.referenceNumber, order.platformOrderId, order.id];
      idKeys.forEach(k => {
        const norm = normalizeTrackingCode(k);
        if (norm && !orderNumberMap.has(norm)) orderNumberMap.set(norm, order);
      });

      const phoneKey = normalizePhoneKey(order.customerPhone);
      if (phoneKey) {
        const list = phoneOrdersMap.get(phoneKey) || [];
        list.push(order);
        phoneOrdersMap.set(phoneKey, list);
      }
    });
  }

  // Separate uploaded files by role
  const cashCycleFiles = uploadedFiles.filter(f => f.role === 'cash_cycles');
  const bostaOrderFiles = uploadedFiles.filter(f => f.role === 'bosta_orders');
  const warehouseFiles = uploadedFiles.filter(f => f.role === 'warehouse_orders');
  const transactionFiles = uploadedFiles.filter(f => f.role === 'transactions');
  const compensationFiles = uploadedFiles.filter(f => f.role === 'compensations');
  const pickupFiles = uploadedFiles.filter(f => f.role === 'pickup_requests');
  const creditsFiles = uploadedFiles.filter(f => f.role === 'bosta_credits');

  // Index Cash Cycles by Tracking / Order Id so we know which Bosta Orders entered Cash Cycles
  const cashCyclesByKey = new Map<
    string,
    {
      fileName: string;
      rowIndex: number;
      cod: number;
      fees: number;
      net: number;
      paymentStatus: string;
      cashoutId: string;
      orderStatus: string;
    }
  >();

  const bostaOrdersByKey = new Map<
    string,
    {
      trackingKey: string;
      businessRefKey: string;
      deliveryState: string;
      codAmount: number;
      deliveredAt: string;
      phoneRaw: string;
    }
  >();

  // Extra operational metadata from Bosta Deliveries Export for Stuck Returns, Lost/Damaged, Zero-Attempt Returns & Fraud hunters
  const bostaOpMetaByKey = new Map<
    string,
    {
      trackingKey: string;
      businessRefKey: string;
      deliveryState: string;
      exceptionReason: string;
      currentHub: string;
      expectedReturnDate: string;
      expectedPickupDate: string;
      expectedDeliveryDate: string;
      scheduledAt: string;
      pickedUpDate: string;
      pickedUpEpochSec: number | null;
      deliveredAt: string;
      createdAt: string;
      updatedAt: string;
      forwardAttemptsCount: number;
      totalAttemptsCount: number;
      returnAttemptsCount: number;
      onHoldTrials: number;
      codAmount: number;
      sheetType: string;
      oldType: string;
      brandName: string;
      customerName: string;
      phoneRaw: string;
      dropoffAddress: string;
      dropoffCity: string;
      packageDescription: string;
      awbPrinted: string;
      whatsappStatus: string;
      notes: string;
      hasFlexShip: boolean;
      flexShipPaid?: boolean;
      flexShipValue: number;
    }
  >();

  // First pass: index Bosta Orders and Cash Cycles
  bostaOrderFiles.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const tKey = normalizeTrackingCode(
        pickCell(raw, mapping.trackingCol, ['tracking number', 'tracking', 'waybill', 'order id'])
      );
      const refKey = normalizeTrackingCode(
        pickCell(raw, mapping.businessRefCol, ['business reference number', 'business reference', 'order reference'])
      );
      const dState = String(
        pickCell(raw, mapping.statusCol, ['delivery state', 'order status', 'status']) || ''
      ).trim();
      const cod = parseNumericCell(pickCell(raw, mapping.grossAmountCol, ['cod amount', 'cod']));
      const delAt = formatSheetDateCell(
        pickCell(raw, mapping.deliveredAtCol, ['delivered at', 'confirmed delivery at'])
      );
      const createdAt = formatSheetDateCell(pickCell(raw, undefined, ['created at']));
      const ph = normalizePhoneKey(pickCell(raw, mapping.phoneCol, ['consignee phone', 'phone']));
      const expRetDate = formatSheetDateCell(pickCell(raw, undefined, ['expected return date']));
      const expPickupDate = formatSheetDateCell(pickCell(raw, undefined, ['expected pickup date']));
      const expDeliveryDate = formatSheetDateCell(pickCell(raw, undefined, ['expected delivery date']));
      const scheduledAt = formatSheetDateCell(pickCell(raw, undefined, ['scheduled at']));
      const pickedUpRawCell = pickCell(raw, undefined, ['picked-up date', 'picked up date']);
      const pickedUpDate = formatSheetDateCell(pickedUpRawCell);
      const pickedUpEpochSec = parseSheetTimestampEpochSec(pickedUpRawCell);
      const updatedAt = formatSheetDateCell(pickCell(raw, undefined, ['updated at']));
      const currentHub = String(pickCell(raw, undefined, ['current hub', 'المحطة']) || '').trim();
      const exceptionReason = String(
        pickCell(raw, undefined, ['latest exception reason', 'exception reason']) || ''
      ).trim();
      const fwdRaw = pickCell(raw, undefined, ['forward attempts count']);
      const totAttRaw = pickCell(raw, undefined, ['number of attempts']);
      const forwardAttemptsCount = fwdRaw !== '' && fwdRaw !== undefined ? parseNumericCell(fwdRaw) : -1;
      const totalAttemptsCount = totAttRaw !== '' && totAttRaw !== undefined ? parseNumericCell(totAttRaw) : -1;
      const returnAttemptsCount = parseNumericCell(pickCell(raw, undefined, ['return attempts count']));
      const onHoldTrials = parseNumericCell(pickCell(raw, undefined, ['on hold trials number']));
      const sheetType = String(pickCell(raw, undefined, ['type', 'order type']) || '').trim();
      const oldType = String(pickCell(raw, undefined, ['old type']) || '').trim();
      const brandName = String(pickCell(raw, undefined, ['brand name', 'business name']) || '').trim();
      const customerName = String(pickCell(raw, undefined, ['consignee name', 'customer name']) || '').trim();
      const dropoffAddress = String(pickCell(raw, undefined, ['dropoff first line', 'address']) || '').trim();
      const dropoffCity = String(pickCell(raw, undefined, ['dropoff city', 'drop off city']) || '').trim();
      const packageDescription = String(pickCell(raw, undefined, ['description', 'package description']) || '').trim();
      const awbPrinted = String(pickCell(raw, undefined, ['awb printed']) || '').trim();
      const whatsappStatus = String(pickCell(raw, undefined, ['whatsapp status']) || '').trim();
      const notesRaw = String(pickCell(raw, undefined, ['notes']) || '').trim();
      const notes = notesRaw && notesRaw !== 'N/A' ? notesRaw : '';
      const hasFlexRaw = String(pickCell(raw, undefined, ['has flexship']) || '').trim().toUpperCase();
      const flexPaidRaw = String(pickCell(raw, undefined, ['flex ship payment status']) || '').trim().toUpperCase();
      const flexValue = parseNumericCell(pickCell(raw, undefined, ['flex ship value']));

      if (tKey) {
        bostaOrdersByKey.set(tKey, {
          trackingKey: tKey,
          businessRefKey: refKey,
          deliveryState: dState,
          codAmount: cod,
          deliveredAt: delAt,
          phoneRaw: ph
        });
        if (!bostaOpMetaByKey.has(tKey)) {
          bostaOpMetaByKey.set(tKey, {
            trackingKey: tKey,
            businessRefKey: refKey,
            deliveryState: dState,
            exceptionReason,
            currentHub,
            expectedReturnDate: expRetDate,
            expectedPickupDate: expPickupDate,
            expectedDeliveryDate: expDeliveryDate,
            scheduledAt,
            pickedUpDate,
            pickedUpEpochSec,
            deliveredAt: delAt,
            createdAt,
            updatedAt,
            forwardAttemptsCount,
            totalAttemptsCount,
            returnAttemptsCount,
            onHoldTrials,
            codAmount: cod,
            sheetType: sheetType || oldType,
            oldType,
            brandName,
            customerName,
            phoneRaw: ph,
            dropoffAddress,
            dropoffCity,
            packageDescription,
            awbPrinted,
            whatsappStatus,
            notes,
            hasFlexShip: hasFlexRaw === 'TRUE',
            flexShipPaid: flexPaidRaw === 'TRUE' ? true : flexPaidRaw === 'FALSE' ? false : undefined,
            flexShipValue: flexValue
          });
        }
      }
      if (refKey && !bostaOrdersByKey.has(refKey)) {
        bostaOrdersByKey.set(refKey, {
          trackingKey: tKey || refKey,
          businessRefKey: refKey,
          deliveryState: dState,
          codAmount: cod,
          deliveredAt: delAt,
          phoneRaw: ph
        });
      }
    });
  });

  cashCycleFiles.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const tKey = normalizeTrackingCode(
        pickCell(raw, mapping.trackingCol, ['order id', 'tracking number', 'tracking', 'waybill'])
      );
      if (!tKey) return;
      const cod = parseNumericCell(pickCell(raw, mapping.grossAmountCol, ['cod', 'cod amount']));
      const fees = Math.abs(
        parseNumericCell(pickCell(raw, mapping.feesAmountCol, ['total fees', 'fees']))
      );
      const net = parseNumericCell(pickCell(raw, mapping.netAmountCol, ['net value', 'net payout', 'net']));
      const paymentStatus = String(
        pickCell(raw, mapping.paymentStatusCol, ['payment status']) || ''
      ).trim();
      const cashoutId = normalizeTrackingCode(
        pickCell(raw, mapping.cashoutIdCol, ['cash-out id', 'cashout id'])
      );
      const orderStatus = String(
        pickCell(raw, mapping.statusCol, ['order status', 'delivery state', 'status']) || ''
      ).trim();
      cashCyclesByKey.set(tKey, {
        fileName: file.fileName,
        rowIndex: entry.rowIndex,
        cod,
        fees,
        net: net || Math.round((cod - fees) * 100) / 100,
        paymentStatus,
        cashoutId,
        orderStatus
      });
    });
  });

  // Process primary shipment rows (Cash Cycles take financial priority; Bosta Orders / Warehouse catch rows missing from Cash Cycles!)
  const sheetRows: SheetAuditRow[] = [];
  const matchedOrderIdsInSheets = new Set<string>();
  const seenKeysInAudit = new Set<string>();

  // Track Transactions Statement (Category-aware Bosta Ledger: Cash Out, Collection Cycles, Bosta Fees Cycle, Transfer Fees, Compensation, Packing Material, Pickup Fees, Running Balance)
  const cashoutMap = new Map<string, TransactionCashoutEntry>();
  const cashoutByDate = new Map<string, string>();
  const orphanTransferFees: Array<{
    file: UploadedSheetFile;
    rowIndex: number;
    dateStr: string;
    feeAmt: number;
  }> = [];
  const ledgerRows: TransactionLedgerRow[] = [];
  let currentWalletBalance: number | null = null;
  let totalCollectionCycles = 0;
  let totalBostaFeesCycles = 0;
  let totalCashouts = 0;
  let totalTransferFees = 0;
  let totalCompensations = 0;
  let packingMaterialNet = 0;
  let pickupFeesTotal = 0;
  let adjustmentsTotal = 0;

  const translateTxCategory = (cat: string): string => {
    const low = cat.toLowerCase();
    if (low.includes('cash collection cycle')) return 'دورة تحصيل كاش';
    if (low.includes('bosta fees cycle')) return 'دورة مصاريف بوسطة';
    if (low === 'cash out' || low.includes('cash out')) return 'تحويل بنكي (Cash Out)';
    if (low.includes('transfer fee')) return 'رسوم تحويل بنكي';
    if (low.includes('compensation')) return 'تعويض شحنة';
    if (low.includes('packaging material refund') || low.includes('packing material refund')) {
      return 'استرداد مستلزمات تغليف';
    }
    if (low.includes('packing material') || low.includes('packaging material')) {
      return 'خصم مستلزمات تغليف';
    }
    if (low.includes('pickup fee')) return 'رسوم بيك أب';
    if (low.includes('balance adjustment')) return 'تسوية رصيد';
    return cat || 'حركة مالية';
  };

  const ensureCashoutEntry = (
    idKey: string,
    file: UploadedSheetFile,
    rowIndex: number,
    dateStr: string
  ): TransactionCashoutEntry => {
    const existing = cashoutMap.get(idKey);
    if (existing) return existing;
    const created: TransactionCashoutEntry = {
      id: `${file.id}_tx_${idKey}_${rowIndex}`,
      fileName: file.fileName,
      rowIndex,
      cashoutId: idKey,
      date: dateStr,
      cashoutAmount: 0,
      transferFees: 0,
      balanceBeforeCashout: null,
      balanceAfterCashout: null,
      collectionCycleAmount: 0,
      bostaFeesCycleAmount: 0,
      linkedOrderCount: 0,
      linkedDeliveredCount: 0,
      linkedReturnedCount: 0,
      linkedGrossTotal: 0,
      linkedFeesTotal: 0,
      linkedNetTotal: 0,
      linkedAdjustmentsTotal: 0,
      linkedCompensationsTotal: 0,
      linkedPackingTotal: 0,
      linkedPickupTotal: 0,
      bankVariance: 0,
      isUnlinkedGeneralPayout: false
    };
    cashoutMap.set(idKey, created);
    return created;
  };

  const seenTxKeys = new Set<string>();
  transactionFiles.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const categoryStr = String(pickCell(raw, undefined, ['category', 'النوع', 'الفئة']) || '').trim();
      const catLow = categoryStr.toLowerCase().replace(/\s+/g, ' ');
      const txId = normalizeTrackingCode(
        pickCell(raw, undefined, ['transactions id', 'transaction id', 'المعرف'])
      );
      const amountVal = parseNumericCell(pickCell(raw, undefined, ['amount', 'القيمة', 'المبلغ']));
      const balanceRaw = pickCell(raw, undefined, ['balance', 'الرصيد']);
      const hasBalance = String(balanceRaw ?? '').trim() !== '';
      const balanceVal = hasBalance ? parseNumericCell(balanceRaw) : null;

      const refCashoutId = normalizeTrackingCode(
        pickCell(raw, undefined, ['cashout id', 'cash-out id', 'remittance id'])
      );
      const refCashoutAmt = Math.abs(
        parseNumericCell(pickCell(raw, undefined, ['cashout amount', 'cash out amount']))
      );
      const dateStr = formatSheetDateCell(
        pickCell(raw, undefined, ['date', 'cashout date', 'created at', 'التاريخ'])
      );
      const cashoutDateStr = formatSheetDateCell(pickCell(raw, undefined, ['cashout date']));

      const txDedupeKey = txId
        ? `${txId}|${catLow}|${amountVal}`
        : `${dateStr}|${catLow}|${amountVal}|${balanceVal ?? ''}`;
      if (seenTxKeys.has(txDedupeKey)) return;
      seenTxKeys.add(txDedupeKey);

      ledgerRows.push({
        id: `${file.id}_ledger_${entry.rowIndex}`,
        fileName: file.fileName,
        rowIndex: entry.rowIndex,
        transactionId: txId || `ROW_${entry.rowIndex}`,
        date: dateStr,
        category: categoryStr,
        categoryAr: translateTxCategory(categoryStr),
        amount: amountVal,
        balance: balanceVal,
        cashoutId:
          refCashoutId || (catLow.includes('cash out') && txId ? txId : undefined),
        cashoutDate: cashoutDateStr || undefined,
        cashoutAmount: refCashoutAmt > 0 ? refCashoutAmt : undefined
      });

      if (catLow.includes('cash collection cycle')) {
        totalCollectionCycles += amountVal;
      } else if (catLow.includes('bosta fees cycle')) {
        totalBostaFeesCycles += Math.abs(amountVal);
      } else if (catLow === 'cash out' || catLow.includes('cash out')) {
        const cashId = refCashoutId || txId || `TX_${entry.rowIndex}`;
        const outAmt = refCashoutAmt > 0 ? refCashoutAmt : Math.abs(amountVal);
        const item = ensureCashoutEntry(cashId, file, entry.rowIndex, dateStr);
        if (item.cashoutAmount === 0) {
          totalCashouts += outAmt;
          item.cashoutAmount = Math.round(outAmt * 100) / 100;
        }
        if (balanceVal !== null && item.balanceAfterCashout === null) {
          item.balanceAfterCashout = balanceVal;
          item.balanceBeforeCashout = Math.round((balanceVal + item.cashoutAmount) * 100) / 100;
        }
        if (!item.date && dateStr) item.date = dateStr;
        if (dateStr) cashoutByDate.set(dateStr, cashId);
      } else if (catLow.includes('transfer fee')) {
        const feeAmt = Math.abs(amountVal);
        totalTransferFees += feeAmt;
        if (refCashoutId) {
          const item = ensureCashoutEntry(refCashoutId, file, entry.rowIndex, dateStr);
          item.transferFees = Math.round((item.transferFees + feeAmt) * 100) / 100;
          if (item.cashoutAmount === 0 && refCashoutAmt > 0) {
            item.cashoutAmount = Math.round(refCashoutAmt * 100) / 100;
          }
        } else if (dateStr) {
          orphanTransferFees.push({ file, rowIndex: entry.rowIndex, dateStr, feeAmt });
        }
      } else if (catLow.includes('balance adjustment')) {
        if (amountVal === -25) {
          totalTransferFees += 25;
          if (refCashoutId) {
            const item = ensureCashoutEntry(refCashoutId, file, entry.rowIndex, dateStr);
            item.transferFees = Math.round((item.transferFees + 25) * 100) / 100;
          } else if (dateStr) {
            orphanTransferFees.push({ file, rowIndex: entry.rowIndex, dateStr, feeAmt: 25 });
          }
        } else {
          adjustmentsTotal += amountVal;
          if (refCashoutId) {
            const item = ensureCashoutEntry(refCashoutId, file, entry.rowIndex, dateStr);
            item.linkedAdjustmentsTotal =
              Math.round((item.linkedAdjustmentsTotal + amountVal) * 100) / 100;
          }
        }
      } else if (catLow.includes('compensation')) {
        totalCompensations += amountVal;
        if (refCashoutId) {
          const item = ensureCashoutEntry(refCashoutId, file, entry.rowIndex, dateStr);
          item.linkedCompensationsTotal =
            Math.round((item.linkedCompensationsTotal + amountVal) * 100) / 100;
          item.linkedAdjustmentsTotal =
            Math.round((item.linkedAdjustmentsTotal + amountVal) * 100) / 100;
        }
      } else if (catLow.includes('packing material') || catLow.includes('packaging material')) {
        packingMaterialNet += amountVal;
        if (refCashoutId) {
          const item = ensureCashoutEntry(refCashoutId, file, entry.rowIndex, dateStr);
          item.linkedPackingTotal =
            Math.round((item.linkedPackingTotal + amountVal) * 100) / 100;
          item.linkedAdjustmentsTotal =
            Math.round((item.linkedAdjustmentsTotal + amountVal) * 100) / 100;
        }
      } else if (catLow.includes('pickup fee')) {
        pickupFeesTotal += Math.abs(amountVal);
        if (refCashoutId) {
          const item = ensureCashoutEntry(refCashoutId, file, entry.rowIndex, dateStr);
          item.linkedPickupTotal =
            Math.round((item.linkedPickupTotal + amountVal) * 100) / 100;
          item.linkedAdjustmentsTotal =
            Math.round((item.linkedAdjustmentsTotal + amountVal) * 100) / 100;
        }
      } else if (refCashoutId && refCashoutAmt > 0) {
        const item = ensureCashoutEntry(refCashoutId, file, entry.rowIndex, dateStr);
        if (item.cashoutAmount === 0) {
          item.cashoutAmount = Math.round(refCashoutAmt * 100) / 100;
          totalCashouts += refCashoutAmt;
        }
      }
    });
  });

  // Match date-based orphan transfer fees (like older Bosta statements where Cashout ID was blank)
  orphanTransferFees.forEach(tf => {
    const matchedCashId = cashoutByDate.get(tf.dateStr);
    if (matchedCashId) {
      const entry = cashoutMap.get(matchedCashId);
      if (entry && entry.transferFees === 0) {
        entry.transferFees = Math.round((entry.transferFees + tf.feeAmt) * 100) / 100;
      }
    }
  });

  const transactionsEntries = Array.from(cashoutMap.values());
  totalCashouts = Math.round(transactionsEntries.reduce((s, e) => s + e.cashoutAmount, 0) * 100) / 100;
  const hasGeneralTransactionsCashout = transactionsEntries.some(e => e.cashoutAmount > 0);

  // Order of processing: Cash Cycles first (authoritative financial sheet), then Bosta Orders (catches orders missing from Cash Cycles), then Warehouse Orders
  const auditFilesOrder: UploadedSheetFile[] = [
    ...cashCycleFiles,
    ...bostaOrderFiles,
    ...warehouseFiles
  ];

  // Cross-sheet baseline when matchWithStoreOrders === false
  const crossSheetWarehouseMap = new Map<
    string,
    { gross: number; tracking: string; phone: string }
  >();
  if (!matchWithStoreOrders) {
    warehouseFiles.forEach(wf => {
      wf.rows.forEach(entry => {
        const t = normalizeTrackingCode(
          pickCell(entry.raw, mapping.trackingCol, ['tracking', 'waybill', 'رقم الشحنة', 'رقم الأوردر'])
        );
        const g = parseNumericCell(
          pickCell(entry.raw, mapping.grossAmountCol, ['cod', 'المبلغ', 'التحصيل', 'قيمة الأوردر'])
        );
        const ph = normalizePhoneKey(pickCell(entry.raw, mapping.phoneCol, ['phone', 'الهاتف']));
        if (t) crossSheetWarehouseMap.set(t, { gross: g, tracking: t, phone: ph });
      });
    });
  }

  // Prevent identical rows from overlapping uploaded files (e.g. CSV + XLSX exports) from creating false duplicates or 2x cashout sums
  const seenCrossFileRows = new Map<string, string>();

  auditFilesOrder.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const trackingRaw = pickCell(raw, mapping.trackingCol, [
        'tracking number',
        'order id',
        'tracking',
        'waybill',
        'بوليصة',
        'رقم الشحنة'
      ]);
      const trackingKey = normalizeTrackingCode(trackingRaw);
      const businessRefKey = normalizeTrackingCode(
        pickCell(raw, mapping.businessRefCol, [
          'business reference number',
          'business reference',
          'order reference'
        ])
      );
      const phoneRaw = normalizePhoneKey(
        pickCell(raw, mapping.phoneCol, ['consignee phone', 'phone', 'الهاتف', 'موبايل'])
      );
      if (!trackingKey && !businessRefKey && !phoneRaw) return;

      // Avoid double-listing a Bosta Orders row if the exact same tracking already came from Cash Cycles
      if (
        file.role === 'bosta_orders' &&
        trackingKey &&
        cashCyclesByKey.has(trackingKey)
      ) {
        return;
      }
      // Avoid double-listing a Warehouse Orders row if it already appeared in Cash Cycles or Bosta Orders
      if (
        file.role === 'warehouse_orders' &&
        ((trackingKey && (cashCyclesByKey.has(trackingKey) || bostaOrdersByKey.has(trackingKey))) ||
          (businessRefKey && (cashCyclesByKey.has(businessRefKey) || bostaOrdersByKey.has(businessRefKey))))
      ) {
        return;
      }

      const customerName = String(
        pickCell(raw, undefined, ['consignee name', 'customer name', 'اسم العميل', 'العميل']) || ''
      ).trim();
      const brandName = String(
        pickCell(raw, undefined, ['brand name', 'business name', 'البراند', 'اسم المتجر']) || ''
      ).trim();
      const pickupCity = String(
        pickCell(raw, undefined, ['pickup city', 'مدينة الاستلام']) || ''
      ).trim();
      const dropoffCity = String(
        pickCell(raw, undefined, ['dropoff city', 'drop off city', 'المدينة', 'المحافظة']) || ''
      ).trim();
      const opRowMeta = trackingKey ? bostaOpMetaByKey.get(trackingKey) : undefined;
      const dropoffAddress = String(
        pickCell(raw, undefined, ['dropoff first line', 'address', 'العنوان']) || opRowMeta?.dropoffAddress || ''
      ).trim();
      const packageDescription = String(
        pickCell(raw, undefined, ['package description', 'description', 'المنتجات', 'الوصف']) || ''
      ).trim();
      const sheetType = String(
        pickCell(raw, undefined, ['order type', 'type', 'old type', 'نوع الشحنة']) || ''
      ).trim();
      const currentHub = String(
        pickCell(raw, undefined, ['current hub', 'الفرع الحالي', 'المحطة']) || opRowMeta?.currentHub || ''
      ).trim();
      const exceptionReason = String(
        pickCell(raw, undefined, ['latest exception reason', 'exception reason', 'سبب التأخير', 'سبب الرفض']) || opRowMeta?.exceptionReason || ''
      ).trim();
      const attemptsCount = parseNumericCell(
        pickCell(raw, undefined, ['number of attempts', 'forward attempts count', 'عدد المحاولات'])
      );
      const returnAttemptsCount = opRowMeta
        ? opRowMeta.returnAttemptsCount
        : parseNumericCell(pickCell(raw, undefined, ['return attempts count']));
      const awbPrinted = String(
        pickCell(raw, undefined, ['awb printed']) || opRowMeta?.awbPrinted || ''
      ).trim();
      const whatsappStatus = String(
        pickCell(raw, undefined, ['whatsapp status']) || opRowMeta?.whatsappStatus || ''
      ).trim();
      const rowNotesRaw = String(pickCell(raw, undefined, ['notes']) || opRowMeta?.notes || '').trim();
      const rowNotes = rowNotesRaw && rowNotesRaw !== 'N/A' ? rowNotesRaw : '';
      const hasFlexShipRaw = String(pickCell(raw, undefined, ['has flexship']) || '').trim().toUpperCase();
      const flexShipPaidRaw = String(
        pickCell(raw, undefined, ['flex ship payment status']) || ''
      ).trim().toUpperCase();
      const flexShipValue = parseNumericCell(pickCell(raw, undefined, ['flex ship value']));

      // Detailed fee breakdown from Cash Cycles
      const shippingFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['shipping fees'])));
      const insuranceFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['insurance fees'])));
      const vatFee = Math.abs(parseNumericCell(pickCell(raw, undefined, ['vat'])));
      const openingPackageFees = Math.abs(
        parseNumericCell(pickCell(raw, undefined, ['opening package fees']))
      );
      const collectionFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['collection fees'])));
      const nextDayFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['next day transfer fees'])));
      const posFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['pos fees'])));
      const codFeesCell = Math.abs(parseNumericCell(pickCell(raw, undefined, ['cod fees'])));
      const fulfillmentFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['fulfillment fees'])));
      const testingFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['testing package fees'])));
      const flexShipFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['flex ship fees'])));
      const depositFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['deposit fees'])));
      const flexShipAmount = parseNumericCell(pickCell(raw, undefined, ['flex ship amount']));
      const discountsAndCredits =
        parseNumericCell(pickCell(raw, undefined, ['0 cod discount'])) +
        parseNumericCell(pickCell(raw, undefined, ['promotion discount'])) +
        parseNumericCell(pickCell(raw, undefined, ['bosta credits'])) +
        parseNumericCell(pickCell(raw, undefined, ['bundle discount']));
      const otherFees =
        Math.round(
          (collectionFees +
            nextDayFees +
            posFees +
            codFeesCell +
            fulfillmentFees +
            testingFees +
            flexShipFees +
            depositFees) *
            100
        ) / 100;

      const sheetStatus = String(
        pickCell(raw, mapping.statusCol, ['delivery state', 'order status', 'status', 'الحالة']) || ''
      ).trim();
      const sheetPaymentStatus = String(
        pickCell(raw, mapping.paymentStatusCol, ['payment status', 'حالة الدفع'], ['flex']) || ''
      ).trim();
      const sheetCashoutId = normalizeTrackingCode(
        pickCell(raw, mapping.cashoutIdCol, ['cash-out id', 'cashout id', 'رقم التحويل'])
      );
      const sheetDeliveredAt = formatSheetDateCell(
        pickCell(raw, mapping.deliveredAtCol, ['delivered at', 'confirmed delivery at', 'confirmed at', 'completed at'])
      );
      const sheetConfirmedAt = formatSheetDateCell(
        pickCell(raw, undefined, ['confirmed at', 'confirmed delivery at', 'delivered at', 'completed at'])
      );
      const sheetPaidAt = formatSheetDateCell(
        pickCell(raw, undefined, ['paid at', 'payout date', 'settlement date'])
      );
      const sheetDate = formatSheetDateCell(
        pickCell(raw, mapping.dateCol, ['paid at', 'completed at', 'delivered at', 'date', 'التاريخ'])
      );
      let payoutLagDays: number | undefined;
      if (sheetConfirmedAt && sheetPaidAt && /^\d{4}-\d{2}-\d{2}$/.test(sheetConfirmedAt) && /^\d{4}-\d{2}-\d{2}$/.test(sheetPaidAt)) {
        const cMs = Date.parse(`${sheetConfirmedAt}T00:00:00Z`);
        const pMs = Date.parse(`${sheetPaidAt}T00:00:00Z`);
        if (Number.isFinite(cMs) && Number.isFinite(pMs)) {
          payoutLagDays = Math.max(0, Math.round((pMs - cMs) / 86400000));
        }
      }

      let sheetGrossAmount = 0;
      let sheetFeesAmount = 0;
      let sheetNetPayout = 0;

      if (mapping.amountMode === 'net_payout') {
        sheetNetPayout = parseNumericCell(
          pickCell(raw, mapping.netAmountCol, ['net value', 'net payout', 'net', 'صافي'])
        );
        sheetFeesAmount = Math.abs(
          parseNumericCell(pickCell(raw, mapping.feesAmountCol, ['total fees', 'fees', 'شحن']))
        );
        const explicitGross = parseNumericCell(
          pickCell(raw, mapping.grossAmountCol, ['cod amount', 'cod', 'gross'])
        );
        sheetGrossAmount =
          mapping.grossAmountCol && mapping.grossAmountCol !== mapping.netAmountCol && explicitGross > 0
            ? explicitGross
            : Math.round((sheetNetPayout + sheetFeesAmount) * 100) / 100;
      } else if (mapping.amountMode === 'gross_and_fees') {
        sheetGrossAmount = parseNumericCell(
          pickCell(raw, mapping.grossAmountCol, ['cod amount', 'cod', 'التحصيل', 'المبلغ'])
        );
        const primaryFee = Math.abs(
          parseNumericCell(pickCell(raw, mapping.feesAmountCol, ['total fees', 'fees', 'مصاريف الشحن', 'شحن']))
        );
        const extraCodFee = mapping.codFeeCol
          ? Math.abs(parseNumericCell(raw[mapping.codFeeCol]))
          : 0;
        sheetFeesAmount = Math.round((primaryFee + extraCodFee) * 100) / 100;
        const explicitNet = parseNumericCell(
          pickCell(raw, mapping.netAmountCol, ['net value', 'net payout', 'صافي'])
        );
        sheetNetPayout =
          mapping.netAmountCol &&
          mapping.netAmountCol !== mapping.grossAmountCol &&
          (explicitNet !== 0 || file.role === 'cash_cycles')
            ? explicitNet
            : Math.round((sheetGrossAmount - sheetFeesAmount) * 100) / 100;
      } else {
        sheetGrossAmount = parseNumericCell(
          pickCell(raw, mapping.grossAmountCol, ['cod amount', 'cod', 'المبلغ'])
        );
        sheetNetPayout = sheetGrossAmount;
      }

      if (!trackingKey && !businessRefKey && sheetNetPayout === 0 && sheetGrossAmount === 0) return;

      const crossFileKey = `${file.role}|${trackingKey || businessRefKey || phoneRaw}|${sheetCashoutId}|${sheetNetPayout}|${sheetGrossAmount}|${sheetStatus.toLowerCase()}`;
      const prevFileId = seenCrossFileRows.get(crossFileKey);
      if (prevFileId && prevFileId !== file.id) {
        return;
      }
      if (!prevFileId) seenCrossFileRows.set(crossFileKey, file.id);

      // Match Order (when matchWithStoreOrders === true)
      let matchedOrder: Order | null = null;
      let matchedBy: SheetAuditRow['matchedBy'];
      let expectation: OrderCodExpectation | null = null;

      if (matchWithStoreOrders) {
        const rowManualKey = `${file.id}_${entry.sheetName}_${entry.rowIndex}`;
        const manualOrderId = manualMatches[rowManualKey] || (trackingKey ? manualMatches[trackingKey] : '');
        if (manualOrderId) {
          const foundManual = orders.find(o => o.id === manualOrderId);
          if (foundManual) {
            matchedOrder = foundManual;
            matchedBy = 'order_number';
          }
        }

        if (!matchedOrder && trackingKey && waybillMap.has(trackingKey)) {
          matchedOrder = waybillMap.get(trackingKey)!;
          matchedBy = 'waybill';
        } else if (!matchedOrder && trackingKey && orderNumberMap.has(trackingKey)) {
          matchedOrder = orderNumberMap.get(trackingKey)!;
          matchedBy = 'order_number';
        } else if (!matchedOrder && businessRefKey && orderNumberMap.has(businessRefKey)) {
          matchedOrder = orderNumberMap.get(businessRefKey)!;
          matchedBy = 'order_number';
        } else if (!matchedOrder && businessRefKey && waybillMap.has(businessRefKey)) {
          matchedOrder = waybillMap.get(businessRefKey)!;
          matchedBy = 'waybill';
        }

        if (!matchedOrder && phoneRaw) {
          const candidates = phoneOrdersMap.get(phoneRaw) || [];
          if (candidates.length === 1) {
            matchedOrder = candidates[0];
            matchedBy = 'phone_amount';
          } else if (candidates.length > 1) {
            const targetAmt = sheetGrossAmount || sheetNetPayout;
            const byAmount = candidates.find(c => {
              const exp = expectationsByOrderId.get(c.id);
              if (!exp) return false;
              return (
                Math.abs(exp.expectedGrossCod - targetAmt) <= Math.max(toleranceEgp, 5) ||
                Math.abs(exp.expectedNetPayout - sheetNetPayout) <= Math.max(toleranceEgp, 5)
              );
            });
            if (byAmount) {
              matchedOrder = byAmount;
              matchedBy = 'phone_amount';
            }
          }
        }
        expectation = matchedOrder ? expectationsByOrderId.get(matchedOrder.id) || null : null;
      }

      const primaryKey = trackingKey || businessRefKey || phoneRaw;
      const dedupeKey = matchedOrder ? matchedOrder.id : primaryKey;
      const isDuplicateInUpload = Boolean(dedupeKey && seenKeysInAudit.has(dedupeKey));
      if (dedupeKey) seenKeysInAudit.add(dedupeKey);
      if (matchedOrder) matchedOrderIdsInSheets.add(matchedOrder.id);

      // Determine Bosta / Carrier Cash-out Status Signals
      const returnedOrFailed = isReturnedOrUncollectedStatus(sheetStatus);
      const deliveredInSheet = isExplicitDeliveredStatus(sheetStatus) || Boolean(sheetDeliveredAt && !returnedOrFailed && !isSheetInTransitStatus(sheetStatus));
      const inTransitInSheet = isSheetInTransitStatus(sheetStatus) && !deliveredInSheet && !returnedOrFailed;

      // Update Transactions cashout linkage counters (only once per unique shipment row)
      if (sheetCashoutId && !isDuplicateInUpload) {
        const tx = cashoutMap.get(sheetCashoutId);
        if (tx) {
          tx.linkedOrderCount += 1;
          if (returnedOrFailed) tx.linkedReturnedCount += 1;
          else tx.linkedDeliveredCount += 1;
          tx.linkedGrossTotal = Math.round((tx.linkedGrossTotal + sheetGrossAmount) * 100) / 100;
          tx.linkedNetTotal = Math.round((tx.linkedNetTotal + sheetNetPayout) * 100) / 100;
          tx.linkedFeesTotal =
            Math.round((tx.linkedGrossTotal - tx.linkedNetTotal) * 100) / 100;
        }
      }

      const hasCashCyclesSchema = Boolean(sheetPaymentStatus) || file.role === 'cash_cycles';
      const notPaidFlag = isExplicitNotPaid(sheetPaymentStatus);
      const missingCashoutId = !sheetCashoutId;
      const paidProofFlag = isExplicitPaid(sheetPaymentStatus) || Boolean(sheetCashoutId);

      let category: SheetRowCategory = 'not_found';
      let netVariance = 0;
      let grossVariance = 0;
      let feesVariance = 0;
      let moneyStatusLabel = 'غير محدد';
      let reasonSummary = '';

      let warehouseReturnStatus: WarehouseReturnStatus | undefined;
      let warehouseReturnNote: string | undefined;

      if (isDuplicateInUpload || expectation?.isAlreadySettled) {
        category = 'duplicate';
        moneyStatusLabel = 'مكرر / محصّل مسبقاً';
        reasonSummary = isDuplicateInUpload
          ? 'تم تكرار هذه البوليصة أكثر من مرة في الشيتات المرفوعة'
          : `تم تحصيل هذا الأوردر مسبقاً${
              expectation?.settledBatchNumber ? ` (دفعة ${expectation.settledBatchNumber})` : ' بالنظام'
            }`;
      } else if (returnedOrFailed) {
        category = 'not_collected_customer';
        const sheetLow = sheetStatus.toLowerCase();
        const isDeletedState =
          sheetLow.includes('deleted') || sheetLow.includes('canceled') || sheetLow.includes('cancelled');
        const opDeliveryStr = opRowMeta?.deliveryState || sheetStatus;
        const opDeliveryLow = opDeliveryStr.toLowerCase();
        const isReturnedToOriginConfirmed =
          (opDeliveryLow.includes('returned to origin') || opDeliveryLow.includes('returned to business')) &&
          (returnAttemptsCount > 0 || Boolean(opRowMeta?.deliveredAt));
        const isStillAtBostaHubOrTransit =
          opDeliveryLow.includes('received at warehouse') ||
          opDeliveryLow.includes('returning') ||
          opDeliveryLow.includes('exception') ||
          opDeliveryLow.includes('hold') ||
          opDeliveryLow.includes('terminat');

        if (isDeletedState && !opRowMeta?.pickedUpDate) {
          warehouseReturnStatus = 'canceled_before_pickup';
          warehouseReturnNote = 'بوليصة ملغاة/محذوفة قبل استلام المندوب — المنتج لم يخرج من مخزنك';
        } else if (isReturnedToOriginConfirmed) {
          const retDateDisplay = opRowMeta?.deliveredAt || sheetDeliveredAt || sheetDate;
          if (
            matchWithStoreOrders &&
            matchedOrder &&
            matchedOrder.stockDeducted === true &&
            !isOrderCancelledOrReturned(matchedOrder)
          ) {
            warehouseReturnStatus = 'returned_stock_not_restored';
            warehouseReturnNote = `بوسطة أكدت عودة الطرد للراسل (${retDateDisplay || 'Returned to origin'} · محاولة إرجاع ${Math.max(1, returnAttemptsCount)}) لكن الأوردر #${matchedOrder.orderNumber} مازال مخصوماً من المخزون بالنظام (${matchedOrder.status})!`;
          } else {
            warehouseReturnStatus = 'returned_to_merchant_confirmed';
            warehouseReturnNote = `رجع لمخزنك بتأكيد بوسطة (${retDateDisplay ? `تسليم للراسل ${retDateDisplay}` : 'Returned to origin'}${returnAttemptsCount > 0 ? ` · ${returnAttemptsCount} محاولة إرجاع` : ''})${currentHub ? ` — عبر ${currentHub}` : ''}`;
          }
        } else if (opRowMeta && isStillAtBostaHubOrTransit) {
          warehouseReturnStatus = 'still_at_bosta_hub';
          warehouseReturnNote = `لم يرجع لمخزنك بعد: حالة الشحنة ببوسطة (${opDeliveryStr}) في ${currentHub || 'فرع بوسطة'} بعدد محاولات إرجاع (${returnAttemptsCount})`;
        } else {
          warehouseReturnStatus = 'no_return_proof';
          warehouseReturnNote =
            bostaOrderFiles.length === 0
              ? 'مسجل مرتجع في Cash Cycles فقط — ارفع شيت Deliveries_Export للتأكد من Return Attempts Count ووصوله لمخزنك'
              : `مسجل (${opDeliveryStr}) بدون إثبات تسليم للراسل (Return Attempts = ${returnAttemptsCount}) — راجع جرد مخزنك الفعلي`;
        }

        moneyStatusLabel = isDeletedState
          ? 'بوليصة ملغاة / محذوفة'
          : file.role === 'cash_cycles' && sheetNetPayout < 0
          ? `مرتجع — خُصم ${Math.abs(sheetNetPayout).toLocaleString()} ج.م`
          : 'لم يتم التحصيل من العميل';
        reasonSummary = isDeletedState
          ? 'بوليصة محذوفة (Deleted) — لا تأثير مالي'
          : file.role === 'cash_cycles'
          ? `مرتجع (Cash-out: ${sheetCashoutId || '-'}) — خصم شحن ${sheetFeesAmount.toLocaleString()} ج.م${
              flexShipAmount > 0 ? ` (منه Flex Ship ${flexShipAmount.toLocaleString()} ج.م)` : ''
            }`
          : `حالة الشحنة بالشيت (${sheetStatus})${exceptionReason ? ` — ${exceptionReason}` : ' — لم يُحصّل لها كاش'}`;
      } else if (inTransitInSheet && file.role === 'bosta_orders') {
        category = 'in_transit_sheet';
        const isAtBostaHubWarehouse = sheetStatus.toLowerCase().includes('received at warehouse');
        const isRtoSittingAtHub = isAtBostaHubWarehouse && (sheetType.toLowerCase() === 'rto' || (opRowMeta?.exceptionReason || '').toLowerCase().includes('cancel'));
        if (isRtoSittingAtHub) {
          warehouseReturnStatus = 'still_at_bosta_hub';
          warehouseReturnNote = `عبارة Received at warehouse تعني مخزن بوسطة (${currentHub || 'Hub'}) — مرتجع لم يرجع لمخزنك بعد!`;
          moneyStatusLabel = `بمخزن بوسطة (${currentHub || 'RTO'})`;
          reasonSummary = `مرتجع (RTO) وصل مخزن/فرع بوسطة (${currentHub || 'بوسطة'}) ولم يرجع لمخزنك بعد${exceptionReason ? ` — ${exceptionReason}` : ''}`;
        } else {
          moneyStatusLabel = `قيد التشغيل (${sheetStatus})`;
          reasonSummary = `الشحنة حالياً في بوسطة (${sheetStatus}${currentHub ? ` — ${currentHub}` : ''}) ولم تُسلّم بعد`;
        }
      } else if (
        // Case A: Warehouse sheet row missing from uploaded Bosta Orders & Cash Cycles (in OFF mode)
        !matchWithStoreOrders &&
        file.role === 'warehouse_orders'
      ) {
        category = 'collected_untransferred';
        moneyStatusLabel = 'مفقود من شيتات بوسطة';
        reasonSummary = 'الأوردر موجود بشيت المستودع المرفوع ولم يظهر في شيت أوردرات بوسطة أو Cash Cycles';
      } else if (
        // Case B: Bosta Orders row is DELIVERED with COD > 0, and has no Cash-out ID / Cash Cycles entry
        file.role === 'bosta_orders' &&
        deliveredInSheet &&
        sheetGrossAmount > 0 &&
        !sheetCashoutId
      ) {
        category = 'collected_untransferred';
        moneyStatusLabel =
          cashCycleFiles.length > 0
            ? 'تم التسليم ولم يدخل Cash Cycles'
            : 'متحصل من العميل — لم يثبت تحويله';
        reasonSummary =
          cashCycleFiles.length > 0
            ? 'أوردر مسلّم ببوسطة (COD > 0) ولم يظهر في شيت Cash Cycles المرفوع'
            : 'أوردر مسلّم بشيت بوسطة وحُصّل الكاش من العميل، لكن لا يوجد إثبات تحويل أو Cash-out ID';
      } else if (
        // Case C: Cash Cycles row where Delivered & COD > 0, but Payment Status = Not Paid & no Cash-out ID!
        hasCashCyclesSchema &&
        (deliveredInSheet || sheetGrossAmount > 0) &&
        (notPaidFlag || missingCashoutId) &&
        !paidProofFlag
      ) {
        category = 'collected_untransferred';
        moneyStatusLabel = hasGeneralTransactionsCashout
          ? 'محتجز / يوجد تحويل عام غير مربوط'
          : 'متحصل وموجود بدورة الحساب — لم يُحوّل';
        reasonSummary = hasGeneralTransactionsCashout
          ? `بوسطة حصلت ${sheetGrossAmount.toLocaleString()} ج.م (Payment Status: ${sheetPaymentStatus || 'Not Paid'}, Cash-out ID: N/A) — يوجد تحويل إجمالي في Transactions لكن هذا الأوردر غير مربوط به`
          : `بوسطة حصلت ${sheetGrossAmount.toLocaleString()} ج.م من العميل، لكن الحالة (${sheetPaymentStatus || 'Not Paid'}) ولا يوجد رقم تحويل Cash-out ID`;
      } else if (matchWithStoreOrders && !matchedOrder) {
        category = 'not_found';
        moneyStatusLabel = 'غير مسجل بالطلبات';
        reasonSummary = 'رقم البوليصة / المرجع غير مطابق لأي أوردر مسجل بقسم الطلبات في المتجر';
      } else if (!matchWithStoreOrders && warehouseFiles.length > 0 && !crossSheetWarehouseMap.has(trackingKey) && !crossSheetWarehouseMap.has(businessRefKey)) {
        category = 'not_found';
        moneyStatusLabel = 'غير موجود بشيت المستودع';
        reasonSummary = 'الشحنة موجودة بشيت بوسطة ولكنها غير مسجلة بشيت أوردرات المستودع المرفوع';
      } else {
        // Financial Comparison (against Store Order if ON, or against Sheet internal/Warehouse math if OFF)
        if (matchWithStoreOrders && expectation) {
          const targetExpected =
            mapping.amountMode === 'gross_only'
              ? expectation.expectedGrossCod
              : expectation.expectedNetPayout;
          const actualCompared =
            mapping.amountMode === 'gross_only' ? sheetGrossAmount : sheetNetPayout;

          netVariance = Math.round((actualCompared - targetExpected) * 100) / 100;
          grossVariance = Math.round((sheetGrossAmount - expectation.expectedGrossCod) * 100) / 100;
          feesVariance = Math.round((sheetFeesAmount - expectation.expectedCarrierFees) * 100) / 100;

          if (Math.abs(netVariance) <= toleranceEgp) {
            category = 'matched_ready';
            moneyStatusLabel = sheetCashoutId ? `تم التحويل (${sheetCashoutId})` : 'مطابق وجاهز للاعتماد';
            reasonSummary =
              matchedOrder && isOrderDeliveredStatus(matchedOrder)
                ? 'مطابقة مالية تامة — جاهز للاعتماد كـ تم التحصيل'
                : `مطابق مالياً — سيتم ترقية حالته من (${matchedOrder?.status}) إلى (تم التحصيل)`;
          } else if (netVariance < -toleranceEgp) {
            category = 'short_paid';
            moneyStatusLabel = 'يوجد عجز في المبلغ';
            if (mapping.amountMode === 'gross_and_fees' && feesVariance > toleranceEgp) {
              reasonSummary = `عجز ${Math.abs(netVariance).toLocaleString()} ج.م (شركة الشحن خصمت مصاريف إضافية بقيمة ${feesVariance.toLocaleString()} ج.م)`;
            } else {
              reasonSummary = `عجز في التحويل: ناقص ${Math.abs(netVariance).toLocaleString()} ج.م عن المستحق بالطلب`;
            }
          } else {
            category = 'over_paid';
            moneyStatusLabel = 'زيادة عن حساب الطلب';
            reasonSummary = `زيادة في المبلغ المحول قدرها +${netVariance.toLocaleString()} ج.م عن حساب المتجر`;
          }
        } else {
          // Cross-sheet ONLY mode (matchWithStoreOrders === false)
          const wh = crossSheetWarehouseMap.get(trackingKey) || crossSheetWarehouseMap.get(businessRefKey);
          const expectedGrossFromWh = wh ? wh.gross : sheetGrossAmount;
          const computedNet = Math.round((sheetGrossAmount - sheetFeesAmount + flexShipAmount + discountsAndCredits) * 100) / 100;
          grossVariance = Math.round((sheetGrossAmount - expectedGrossFromWh) * 100) / 100;
          netVariance =
            wh && Math.abs(grossVariance) > toleranceEgp
              ? grossVariance
              : Math.round((sheetNetPayout - computedNet) * 100) / 100;

          if (Math.abs(netVariance) <= toleranceEgp) {
            category = 'matched_ready';
            moneyStatusLabel = sheetCashoutId ? `تم التحويل (${sheetCashoutId})` : 'مطابق بالشيتات';
            reasonSummary = wh
              ? 'مطابق بين شيت المستودع وشيت شركة الشحن'
              : 'حسابات الشيت (التحصيل − المصاريف = الصافي) متزنة ومطابقة';
          } else if (netVariance < -toleranceEgp) {
            category = 'short_paid';
            moneyStatusLabel = 'عجز بالشيتات';
            reasonSummary = wh
              ? `تحصيل الشيت أقل من قيمة شيت المستودع بـ ${Math.abs(netVariance).toLocaleString()} ج.م`
              : `صافي الشيت أقل من المعادلة الحسابية بـ ${Math.abs(netVariance).toLocaleString()} ج.م`;
          } else {
            category = 'over_paid';
            moneyStatusLabel = 'فرق زيادة بالشيتات';
            reasonSummary = `زيادة قدرها +${netVariance.toLocaleString()} ج.م`;
          }
        }
      }

      sheetRows.push({
        id: `${file.id}_${entry.sheetName}_${entry.rowIndex}`,
        fileName: file.fileName,
        fileRole: file.role,
        sheetName: entry.sheetName,
        rowIndex: entry.rowIndex,
        trackingKey: trackingKey || businessRefKey || phoneRaw || `#${entry.rowIndex}`,
        businessRefKey: businessRefKey || undefined,
        phoneRaw,
        customerName: customerName || undefined,
        brandName: brandName || undefined,
        pickupCity: pickupCity || undefined,
        dropoffCity: dropoffCity || undefined,
        dropoffAddress: dropoffAddress || undefined,
        packageDescription: packageDescription || undefined,
        sheetType: sheetType || undefined,
        currentHub: currentHub || undefined,
        exceptionReason: exceptionReason || undefined,
        attemptsCount: attemptsCount > 0 ? attemptsCount : undefined,
        returnAttemptsCount: returnAttemptsCount > 0 ? returnAttemptsCount : 0,
        awbPrinted: awbPrinted || undefined,
        whatsappStatus: whatsappStatus || undefined,
        notes: rowNotes || undefined,
        expectedPickupDate: opRowMeta?.expectedPickupDate || undefined,
        expectedDeliveryDate: opRowMeta?.expectedDeliveryDate || undefined,
        scheduledAt: opRowMeta?.scheduledAt || undefined,
        onHoldTrials: opRowMeta && opRowMeta.onHoldTrials > 0 ? opRowMeta.onHoldTrials : undefined,
        deliveryDelayDays:
          opRowMeta?.expectedDeliveryDate &&
          opRowMeta?.deliveredAt &&
          /^\d{4}-\d{2}-\d{2}$/.test(opRowMeta.expectedDeliveryDate) &&
          /^\d{4}-\d{2}-\d{2}$/.test(opRowMeta.deliveredAt)
            ? Math.max(
                0,
                Math.floor(
                  (Date.parse(`${opRowMeta.deliveredAt}T00:00:00Z`) -
                    Date.parse(`${opRowMeta.expectedDeliveryDate}T00:00:00Z`)) /
                    86400000
                )
              )
            : undefined,
        warehouseReturnStatus,
        warehouseReturnNote,
        hasFlexShip: hasFlexShipRaw === 'TRUE' || undefined,
        flexShipPaid: flexShipPaidRaw === 'TRUE' ? true : flexShipPaidRaw === 'FALSE' ? false : undefined,
        flexShipValue: flexShipValue > 0 ? flexShipValue : undefined,
        sheetStatus,
        sheetPaymentStatus: sheetPaymentStatus || undefined,
        sheetCashoutId: sheetCashoutId || undefined,
        sheetDeliveredAt: sheetDeliveredAt || undefined,
        sheetPaidAt: sheetPaidAt || undefined,
        payoutLagDays,
        sheetDate: sheetDate || undefined,
        sheetGrossAmount,
        sheetFeesAmount,
        sheetNetPayout,
        feeBreakdown:
          shippingFees > 0 ||
          vatFee > 0 ||
          openingPackageFees > 0 ||
          insuranceFees > 0 ||
          otherFees > 0 ||
          flexShipAmount > 0
            ? {
                shippingFees,
                insuranceFees,
                vat: vatFee,
                openingPackageFees,
                otherFees,
                discountsAndCredits: Math.round(discountsAndCredits * 100) / 100,
                flexShipAmount
              }
            : undefined,
        matchedOrder,
        matchedBy,
        expectation,
        category,
        netVariance,
        grossVariance,
        feesVariance,
        moneyStatusLabel,
        reasonSummary,
        hasGeneralUnlinkedTransaction:
          category === 'collected_untransferred' && hasGeneralTransactionsCashout
      });
    });
  });

  // Finalize Transactions summary
  let unlinkedCashoutTotal = 0;
  transactionsEntries.forEach(tx => {
    const netExpectedFromCyclesAndAdj =
      Math.round((tx.linkedNetTotal + tx.linkedAdjustmentsTotal - tx.transferFees) * 100) / 100;
    tx.bankVariance =
      tx.linkedOrderCount > 0
        ? Math.round((tx.cashoutAmount - netExpectedFromCyclesAndAdj) * 100) / 100
        : 0;
    if (tx.cashoutAmount > 0 && tx.cashoutId !== '-' && tx.linkedOrderCount === 0) {
      tx.isUnlinkedGeneralPayout = true;
      unlinkedCashoutTotal = Math.round((unlinkedCashoutTotal + tx.cashoutAmount) * 100) / 100;
    }
  });

  // Sort merged ledger rows chronologically newest-first so split category CSVs form one unified statement
  ledgerRows.sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    if (da !== db) return db.localeCompare(da);
    return a.rowIndex - b.rowIndex;
  });

  // Verify running-balance continuity across the merged Transactions ledger using before/after multiset conservation
  // (Supports both a single full statement with intra-day out-of-order rows AND multiple category-filtered Bosta CSVs merged together)
  const walletGaps: WalletBalanceGap[] = [];
  const withBalAll = ledgerRows.filter(r => r.balance !== null);
  const pickLatestDateRow = (rows: TransactionLedgerRow[]): TransactionLedgerRow | undefined => {
    if (rows.length === 0) return undefined;
    return [...rows].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (da !== db) return db.localeCompare(da);
      return a.rowIndex - b.rowIndex;
    })[0];
  };

  const hasCollectionsInLedger = ledgerRows.some(r =>
    r.category.toLowerCase().includes('cash collection cycle')
  );
  const hasFeesOrCashoutsInLedger = ledgerRows.some(r => {
    const c = r.category.toLowerCase();
    return c.includes('bosta fees cycle') || c.includes('cash out');
  });
  const isCompleteLedgerMix = hasCollectionsInLedger && hasFeesOrCashoutsInLedger;

  let walletIntegrityStatus: TransactionsAuditSummary['walletIntegrityStatus'] = 'single_or_empty';

  if (withBalAll.length === 1) {
    currentWalletBalance = withBalAll[0].balance;
    walletIntegrityStatus = 'single_or_empty';
  } else if (withBalAll.length >= 2 && !isCompleteLedgerMix) {
    // User uploaded only a partial single-category export (e.g., Cash Out only or Compensation only)
    currentWalletBalance = pickLatestDateRow(withBalAll)?.balance ?? null;
    walletIntegrityStatus = 'partial_filtered';
  } else if (withBalAll.length >= 2 && isCompleteLedgerMix) {
    // Pool of "after-transaction balances" in piastres (1/100 EGP) across the unified ledger
    const afterPool = new Map<number, TransactionLedgerRow[]>();
    withBalAll.forEach(r => {
      const k = Math.round((r.balance as number) * 100);
      const list = afterPool.get(k) || [];
      list.push(r);
      afterPool.set(k, list);
    });

    const consumeAfter = (key: number): TransactionLedgerRow | null => {
      const list = afterPool.get(key);
      if (!list || list.length === 0) return null;
      const popped = list.pop() || null;
      if (list.length === 0) afterPool.delete(key);
      return popped;
    };

    const stillNeedBefore: TransactionLedgerRow[] = [];
    // Pass 1: exact cent match (0 tolerance) first so 0-amount or identical timestamps never steal fractional slots
    withBalAll.forEach(r => {
      const expectedBeforeCents = Math.round(((r.balance as number) - r.amount) * 100);
      if (!consumeAfter(expectedBeforeCents)) {
        stillNeedBefore.push(r);
      }
    });

    // Pass 2: allow <= 0.10 EGP cumulative floating-point rounding drift
    const unmatchedBefore: Array<{ row: TransactionLedgerRow; expectedBefore: number }> = [];
    stillNeedBefore.forEach(r => {
      const expectedBeforeCents = Math.round(((r.balance as number) - r.amount) * 100);
      let matched = false;
      for (let d = 1; d <= 10; d++) {
        if (consumeAfter(expectedBeforeCents + d) || consumeAfter(expectedBeforeCents - d)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        unmatchedBefore.push({
          row: r,
          expectedBefore: Math.round(expectedBeforeCents) / 100
        });
      }
    });

    const leftoverAfter: TransactionLedgerRow[] = [];
    afterPool.forEach(list => {
      list.forEach(r => leftoverAfter.push(r));
    });

    const sortedAfterDesc = [...leftoverAfter].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (da !== db) return db.localeCompare(da);
      return a.rowIndex - b.rowIndex;
    });

    // The unconsumed closing row in the newest date slice is guaranteed to be the true final wallet balance
    currentWalletBalance =
      sortedAfterDesc[0]?.balance ?? pickLatestDateRow(withBalAll)?.balance ?? null;

    if (unmatchedBefore.length <= 1 && leftoverAfter.length <= 1) {
      walletIntegrityStatus = 'verified';
    } else {
      const sortedBeforeAsc = [...unmatchedBefore].sort((a, b) => {
        const da = a.row.date || '';
        const db = b.row.date || '';
        if (da !== db) return da.localeCompare(db);
        return b.row.rowIndex - a.row.rowIndex;
      });

      const brokenNewerList = sortedBeforeAsc.slice(1);
      const brokenOlderList = sortedAfterDesc.slice(1);

      const pairCount = Math.max(brokenNewerList.length, brokenOlderList.length);
      for (let i = 0; i < pairCount; i++) {
        const newerEntry = brokenNewerList[i];
        const olderRow = brokenOlderList[i] || brokenOlderList[brokenOlderList.length - 1];
        if (!newerEntry && !olderRow) continue;

        const newer = newerEntry ? newerEntry.row : withBalAll[0];
        const olderBalance = olderRow && olderRow.balance !== null ? olderRow.balance : 0;
        const expectedNewBal = Math.round((olderBalance + newer.amount) * 100) / 100;
        const actualNewBal = newer.balance as number;
        const gap =
          Math.round(
            (newerEntry ? newerEntry.expectedBefore - olderBalance : actualNewBal - expectedNewBal) *
              100
          ) / 100;

        if (Math.abs(gap) <= 0.5 && brokenNewerList.length === 0) continue;

        walletGaps.push({
          id: `wgap_${newer.fileName}_${newer.transactionId}_${olderRow?.transactionId || i}`,
          fileName: newer.fileName,
          newerTxId: newer.transactionId,
          olderTxId: olderRow?.transactionId || '-',
          newerDate: newer.date,
          olderDate: olderRow?.date || '',
          olderBalance,
          newerAmount: newer.amount,
          expectedNewBalance: expectedNewBal,
          actualNewBalance: actualNewBal,
          gapAmount: gap,
          reasonSummary: olderRow
            ? `فجوة أو تلاعب غير مفسر في تسلسل رصيد المحفظة بين (${olderRow.transactionId} رصيد ${olderBalance.toLocaleString()} ج.م) و(${newer.transactionId}): الرصيد المفترض قبل الحركة كان ${newerEntry?.expectedBefore.toLocaleString()} ج.م (فارق ${gap > 0 ? '+' : ''}${gap} ج.م)`
            : `فجوة أو تلاعب في رصيد الحركة ${newer.transactionId}: الرصيد السابق المفترض ${newerEntry?.expectedBefore.toLocaleString()} ج.م غير موجود بأي حركة سابقة`
        });
      }

      walletIntegrityStatus = walletGaps.length > 0 ? 'mismatch_found' : 'verified';
    }
  }

  const transactionsSummary: TransactionsAuditSummary = {
    hasTransactionsSheet: transactionFiles.length > 0,
    currentWalletBalance,
    totalCollectionCycles: Math.round(totalCollectionCycles * 100) / 100,
    totalBostaFeesCycles: Math.round(totalBostaFeesCycles * 100) / 100,
    netCycleBalance: Math.round((totalCollectionCycles - totalBostaFeesCycles) * 100) / 100,
    totalCashouts: Math.round(totalCashouts * 100) / 100,
    totalTransferFees: Math.round(totalTransferFees * 100) / 100,
    totalCompensations: Math.round(totalCompensations * 100) / 100,
    packingMaterialNet: Math.round(packingMaterialNet * 100) / 100,
    pickupFeesTotal: Math.round(pickupFeesTotal * 100) / 100,
    adjustmentsTotal: Math.round(adjustmentsTotal * 100) / 100,
    unlinkedCashoutTotal,
    walletIntegrityStatus,
    walletGaps,
    walletCompensations: [],
    undocumentedWalletCompCount: 0,
    undocumentedWalletCompAmount: 0,
    entries: transactionsEntries,
    ledgerRows
  };

  // Reverse Hunter on Live Store Orders (only active when matchWithStoreOrders === true)
  const uncollectedDelivered: MissingOrderAlert[] = [];
  const inTransitOverdue: MissingOrderAlert[] = [];
  let healthyInTransitCount = 0;
  let alreadySettledCount = 0;

  if (matchWithStoreOrders) {
    orders.forEach(order => {
      if (carrierFilter !== 'all' && (order.shippingCompany || 'غير محدد') !== carrierFilter) {
        return;
      }

      const exp = expectationsByOrderId.get(order.id);
      if (!exp) return;

      if (exp.isAlreadySettled) {
        alreadySettledCount += 1;
        return;
      }

      if (exp.isPrepaidOrPos || isOrderCancelledOrReturned(order)) {
        return;
      }

      if (matchedOrderIdsInSheets.has(order.id)) {
        return;
      }

      const trackingDisplay =
        order.waybillNumber ||
        order.bostaTrackingNumber ||
        order.turboTrackingNumber ||
        order.orderNumber ||
        order.id;

      if (isOrderDeliveredStatus(order) || order.paymentStatus === 'مدفوع') {
        uncollectedDelivered.push({
          id: `missing_${order.id}`,
          order,
          category: 'uncollected_delivered',
          expectation: exp,
          daysElapsed: exp.daysElapsed,
          trackingDisplay,
          reasonSummary:
            uploadedFiles.length > 0
              ? 'حالة الأوردر مسلّم بالطلبات ولم يظهر في أي من الشيتات المرفوعة ولا في الدفعات السابقة'
              : 'أوردر مسلّم بالطلبات ولم يتم تسوية تحصيله أو ربطه بأي دفعة تحويل بعد'
        });
      } else if (['تم_الارسال', 'قيد_الشحن', 'مؤجل', 'مجدول'].includes(order.status)) {
        if (exp.daysElapsed >= graceDaysForInTransit) {
          inTransitOverdue.push({
            id: `overdue_${order.id}`,
            order,
            category: 'in_transit_overdue',
            expectation: exp,
            daysElapsed: exp.daysElapsed,
            trackingDisplay,
            reasonSummary: `مضى ${exp.daysElapsed} يوم في الشحن بدون تسليم أو ارتجاع أو ظهور في كشف التحويل`
          });
        } else {
          healthyInTransitCount += 1;
        }
      }
    });

    uncollectedDelivered.sort(
      (a, b) => b.daysElapsed - a.daysElapsed || b.expectation.expectedNetPayout - a.expectation.expectedNetPayout
    );
    inTransitOverdue.sort(
      (a, b) => b.daysElapsed - a.daysElapsed || b.expectation.expectedNetPayout - a.expectation.expectedNetPayout
    );
  }

  const translateBostaNumericStatus = (rawStatus: string): string => {
    const clean = rawStatus.trim();
    if (clean === '45') return 'Delivered (45)';
    if (clean === '46') return 'مرتجع للراسل / RTO (46)';
    if (clean === '47') return 'استثناء / مشكلة توصيل (47)';
    if (clean === '48') return 'منتهي / ملغي (48)';
    if (clean === '49') return 'ملغي من العميل (49)';
    if (clean === '60') return 'مفقود / تعويض (60)';
    return clean || '-';
  };

  const rawCompensations: CompensationSheetEntry[] = [];
  const seenCompKeys = new Set<string>();
  compensationFiles.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const orderId = normalizeTrackingCode(
        pickCell(raw, undefined, ['order id', 'tracking number', 'tracking'])
      );
      const compAmt = parseNumericCell(
        pickCell(raw, undefined, ['compensation amount', 'amount', 'قيمة التعويض'])
      );
      const compId = normalizeTrackingCode(
        pickCell(raw, undefined, ['compensation id', 'رقم التعويض'])
      );
      const compDate = formatSheetDateCell(
        pickCell(raw, undefined, ['compensation date', 'date', 'تاريخ التعويض'])
      );
      const cashoutId = normalizeTrackingCode(
        pickCell(raw, undefined, ['cash-out id', 'cashout id', 'رقم التحويل'])
      );
      if (!orderId && !compId && compAmt === 0) return;

      const compDedupeKey = `${compId || orderId}|${orderId}|${compAmt}`;
      if (seenCompKeys.has(compDedupeKey)) return;
      seenCompKeys.add(compDedupeKey);

      const orderRef = normalizeTrackingCode(
        pickCell(raw, undefined, ['order reference', 'business reference'])
      );
      const orderType = String(pickCell(raw, undefined, ['order type', 'type']) || '').trim();
      const orderStatus = String(pickCell(raw, undefined, ['order status', 'status']) || '').trim();
      const brandName = String(
        pickCell(raw, undefined, ['business name', 'brand name', 'البراند']) || ''
      ).trim();
      const customerName = String(
        pickCell(raw, undefined, ['customer name', 'consignee name', 'اسم العميل']) || ''
      ).trim();
      const customerPhone = normalizePhoneKey(
        pickCell(raw, undefined, ['customer phone', 'consignee phone', 'phone'])
      );
      const packageDescription = String(
        pickCell(raw, undefined, ['package description', 'description']) || ''
      ).trim();
      const packageSize = String(pickCell(raw, undefined, ['package size']) || '').trim();
      const pickupCity = String(pickCell(raw, undefined, ['pickup city']) || '').trim();
      const dropoffCity = String(pickCell(raw, undefined, ['dropoff city']) || '').trim();
      const completedAt = formatSheetDateCell(pickCell(raw, undefined, ['completed at']));
      const confirmedAt = formatSheetDateCell(pickCell(raw, undefined, ['confirmed at']));

      let matchedOrder: Order | null = null;
      if (matchWithStoreOrders) {
        if (orderId && waybillMap.has(orderId)) matchedOrder = waybillMap.get(orderId)!;
        else if (orderId && orderNumberMap.has(orderId)) matchedOrder = orderNumberMap.get(orderId)!;
        else if (orderRef && orderNumberMap.has(orderRef)) matchedOrder = orderNumberMap.get(orderRef)!;
        else if (customerPhone) {
          const candidates = phoneOrdersMap.get(customerPhone) || [];
          if (candidates.length === 1) matchedOrder = candidates[0];
        }
      }

      rawCompensations.push({
        id: `${file.id}_comp_${entry.rowIndex}`,
        fileName: file.fileName,
        rowIndex: entry.rowIndex,
        orderId: orderId || '-',
        orderReference: orderRef || undefined,
        orderType: orderType || '-',
        orderStatus: orderStatus || '-',
        orderStatusLabel: translateBostaNumericStatus(orderStatus),
        compensationId: compId || '-',
        compensationAmount: compAmt,
        preVatEquivalent: compAmt > 0 ? Math.round((compAmt / 1.14) * 100) / 100 : undefined,
        compensationDate: compDate,
        cashoutId: cashoutId || undefined,
        brandName: brandName || undefined,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        packageDescription: packageDescription || undefined,
        packageSize: packageSize || undefined,
        pickupCity: pickupCity || undefined,
        dropoffCity: dropoffCity || undefined,
        completedAt: completedAt || undefined,
        confirmedAt: confirmedAt || undefined,
        matchedOrder,
        isPaidOut: Boolean(cashoutId)
      });
    });
  });

  const rawPickupRequests: PickupRequestAuditEntry[] = [];
  const pickupEntryById = new Map<string, PickupRequestAuditEntry>();
  const sortedPickupFiles = [...pickupFiles].sort((a, b) => {
    const aDetailed = a.headers.some(h => h.trim().toLowerCase() === 'received') ? 1 : 0;
    const bDetailed = b.headers.some(h => h.trim().toLowerCase() === 'received') ? 1 : 0;
    return bDetailed - aDetailed;
  });

  sortedPickupFiles.forEach(file => {
    const hasReceivedCol = file.headers.some(h => h.trim().toLowerCase() === 'received');
    const hasScannedCol = file.headers.some(h => h.trim().toLowerCase() === 'scanned');
    const hasConfirmedCol = file.headers.some(h => h.trim().toLowerCase() === 'confirmed by business');

    file.rows.forEach(entry => {
      const raw = entry.raw;
      const pickupId = normalizeTrackingCode(pickCell(raw, undefined, ['pickup id']));
      if (!pickupId) return;

      const brandName = String(pickCell(raw, undefined, ['business name', 'brand name']) || '').trim();
      const businessTier = String(pickCell(raw, undefined, ['business tier']) || '').trim();
      const contactName = String(pickCell(raw, undefined, ['contact name']) || '').trim();
      const contactNumber = normalizePhoneKey(pickCell(raw, undefined, ['contact number']));
      const addressLine = String(pickCell(raw, undefined, ['address line']) || '').trim();
      const city = String(pickCell(raw, undefined, ['city']) || '').trim();
      const zone = String(pickCell(raw, undefined, ['zone']) || '').trim();
      const scheduledDate = formatSheetDateCell(pickCell(raw, undefined, ['scheduled date']));
      const creationDate = formatSheetDateCell(pickCell(raw, undefined, ['creation date']));
      const assignedDate = formatSheetDateCell(pickCell(raw, undefined, ['assigned date']));
      const firstPickedUpRaw = pickCell(raw, undefined, ['first picked up date']);
      const firstPickedUpDate = formatSheetDateCell(firstPickedUpRaw);
      const attemptRaw = pickCell(raw, undefined, ['attempt date']);
      const attemptDate = formatSheetDateCell(attemptRaw);
      const attemptEpochSec =
        parseSheetTimestampEpochSec(attemptRaw) ?? parseSheetTimestampEpochSec(firstPickedUpRaw);
      const lastUpdateDate = formatSheetDateCell(pickCell(raw, undefined, ['last update date']));
      const hubName = String(pickCell(raw, undefined, ['hub name']) || '').trim();
      const firstMileDistrictCode = String(pickCell(raw, undefined, ['first mile district code']) || '').trim();
      const starName = String(pickCell(raw, undefined, ['star name']) || '').trim();
      const starPhone = normalizePhoneKey(pickCell(raw, undefined, ['star phone']));
      const parcelType = String(pickCell(raw, undefined, ['parcel type']) || '').trim();
      const repetition = String(pickCell(raw, undefined, ['repetition']) || '').trim();
      const noOfSchedulings = String(pickCell(raw, undefined, ['no. of schedulings']) || '').trim();
      const firstPickupRaw = String(pickCell(raw, undefined, ['first pickup']) || '').trim().toUpperCase();
      const isFirstPickup = firstPickupRaw === 'TRUE';
      const newPickupId = normalizeTrackingCode(pickCell(raw, undefined, ['new pickup id']));
      const oldPickupId = normalizeTrackingCode(pickCell(raw, undefined, ['old pickup id']));
      const status = String(pickCell(raw, undefined, ['status']) || '').trim();
      const requestedCount = parseNumericCell(pickCell(raw, undefined, ['requested', 'number of parcels']));
      const pickedUpCount = parseNumericCell(pickCell(raw, undefined, ['picked up', 'no. of deliveries']));
      const scannedCount = hasScannedCol ? parseNumericCell(pickCell(raw, undefined, ['scanned'])) : undefined;
      const receivedCount = hasReceivedCol ? parseNumericCell(pickCell(raw, undefined, ['received'])) : undefined;
      const confirmedCount = hasConfirmedCol
        ? parseNumericCell(pickCell(raw, undefined, ['confirmed by business']))
        : undefined;
      const sampleTn = normalizeTrackingCode(pickCell(raw, undefined, ['tns. of deliveries', 'tn']));
      const excRaw = String(pickCell(raw, undefined, ['exception reason']) || '').trim();
      const exceptionReason = excRaw && excRaw !== '<nil>' ? excRaw : undefined;
      const notesRaw = String(pickCell(raw, undefined, ['notes']) || '').trim();
      const notes = notesRaw && notesRaw !== 'N/A' ? notesRaw : undefined;

      const existingEntry = pickupEntryById.get(pickupId);
      if (existingEntry) {
        if (!existingEntry.businessTier && businessTier) existingEntry.businessTier = businessTier;
        if (!existingEntry.firstPickedUpDate && firstPickedUpDate) existingEntry.firstPickedUpDate = firstPickedUpDate;
        if (!existingEntry.noOfSchedulings && noOfSchedulings) existingEntry.noOfSchedulings = noOfSchedulings;
        if (!existingEntry.newPickupId && newPickupId) existingEntry.newPickupId = newPickupId;
        if (!existingEntry.oldPickupId && oldPickupId) existingEntry.oldPickupId = oldPickupId;
        if (!existingEntry.parcelType && parcelType) existingEntry.parcelType = parcelType;
        if (!existingEntry.addressLine && addressLine) existingEntry.addressLine = addressLine;
        if (!existingEntry.firstMileDistrictCode && firstMileDistrictCode) {
          existingEntry.firstMileDistrictCode = firstMileDistrictCode;
        }
        if (!existingEntry.assignedDate && assignedDate) existingEntry.assignedDate = assignedDate;
        if (!existingEntry.isFirstPickup && isFirstPickup) existingEntry.isFirstPickup = true;
        if (
          newPickupId ||
          oldPickupId ||
          (noOfSchedulings && !/^(first|1)$/i.test(noOfSchedulings))
        ) {
          existingEntry.isRescheduledOrDelayed = true;
        }
        return;
      }

      const minFreePickup = Math.max(1, zoneRates.minFreePickupShipments ?? 3);
      const isCanceled = status.toLowerCase().includes('cancel');
      const variancePickedVsReceived =
        typeof receivedCount === 'number' && !isCanceled
          ? Math.max(0, pickedUpCount - receivedCount)
          : 0;
      const variancePickedVsConfirmed =
        typeof confirmedCount === 'number' && !isCanceled && pickedUpCount > confirmedCount
          ? Math.max(0, pickedUpCount - confirmedCount)
          : 0;

      let pickupDelayDays = 0;
      if (
        !isCanceled &&
        scheduledDate &&
        attemptDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) &&
        /^\d{4}-\d{2}-\d{2}$/.test(attemptDate)
      ) {
        pickupDelayDays = Math.max(
          0,
          Math.floor(
            (Date.parse(`${attemptDate}T00:00:00Z`) - Date.parse(`${scheduledDate}T00:00:00Z`)) / 86400000
          )
        );
      }
      const isRescheduledOrDelayed = Boolean(
        newPickupId ||
          oldPickupId ||
          (noOfSchedulings && !/^(first|1)$/i.test(noOfSchedulings)) ||
          pickupDelayDays >= 1
      );

      const isSmallPickupFeeRisk =
        !isCanceled && !isFirstPickup && pickedUpCount > 0 && pickedUpCount < minFreePickup;

      let alertFlag: PickupRequestAuditEntry['alertFlag'] = 'ok';
      let reasonSummary = `تم استلام ${pickedUpCount} طرد بنجاح`;
      if (isFirstPickup && !isCanceled) {
        reasonSummary += ' · (أول بيك أب معفى First Pickup)';
      }
      if (isCanceled) {
        alertFlag = 'canceled';
        reasonSummary = exceptionReason ? `ملغي (${exceptionReason})` : 'تم إلغاء طلب البيك أب';
      } else if (typeof receivedCount === 'number' && pickedUpCount > 0 && receivedCount === 0) {
        alertFlag = 'pending_hub_receipt';
        reasonSummary = `المندوب أخذ ${pickedUpCount} طرد ولم يُسجل استلامها في الفرع بعد (Received = 0)`;
      } else if (variancePickedVsReceived > 0) {
        alertFlag = 'variance_gap';
        reasonSummary = `فرق استلام: المندوب أخذ ${pickedUpCount} طرد والمسجل مستلم بالفرع ${receivedCount} فقط (فارق ${variancePickedVsReceived})`;
      } else if (variancePickedVsConfirmed > 0) {
        alertFlag = 'variance_gap';
        reasonSummary = `فرق تأكيد التاجر (Confirmed By Business): المسحوب ${pickedUpCount} طرد والمؤكد من التاجر ${confirmedCount} فقط (فارق ${variancePickedVsConfirmed})`;
      } else if (isSmallPickupFeeRisk) {
        alertFlag = 'small_pickup_fee_risk';
        reasonSummary = `بيك أب بعدد قليل (${pickedUpCount} أقل من ${minFreePickup} شحنات) — تخضع لرسوم البيك أب إذا تم خصمها`;
      }
      if (isRescheduledOrDelayed && !isCanceled) {
        reasonSummary += pickupDelayDays >= 1 ? ` · تأخر سحب المندوب ${pickupDelayDays} يوم` : ' · تمت إعادة جدولته';
      }

      const newEntry: PickupRequestAuditEntry = {
        id: `${file.id}_pu_${pickupId}_${entry.rowIndex}`,
        fileName: file.fileName,
        rowIndex: entry.rowIndex,
        pickupId,
        scheduledDate,
        creationDate,
        assignedDate: assignedDate || undefined,
        firstPickedUpDate: firstPickedUpDate || undefined,
        attemptDate: attemptDate || undefined,
        attemptEpochSec,
        lastUpdateDate: lastUpdateDate || undefined,
        brandName: brandName || undefined,
        businessTier: businessTier || undefined,
        contactName: contactName || undefined,
        contactNumber: contactNumber || undefined,
        addressLine: addressLine || undefined,
        city: city || undefined,
        zone: zone || undefined,
        hubName: hubName || undefined,
        firstMileDistrictCode: firstMileDistrictCode || undefined,
        starName: starName || undefined,
        starPhone: starPhone || undefined,
        parcelType: parcelType || undefined,
        repetition: repetition || undefined,
        noOfSchedulings: noOfSchedulings || undefined,
        isFirstPickup: isFirstPickup || undefined,
        newPickupId: newPickupId || undefined,
        oldPickupId: oldPickupId || undefined,
        status,
        requestedCount,
        pickedUpCount,
        scannedCount,
        receivedCount,
        confirmedCount,
        sampleTrackingNumber: sampleTn || undefined,
        exceptionReason,
        notes,
        variancePickedVsReceived,
        variancePickedVsConfirmed: variancePickedVsConfirmed || undefined,
        isSmallPickupFeeRisk,
        isRescheduledOrDelayed: isRescheduledOrDelayed || undefined,
        pickupDelayDays: pickupDelayDays > 0 ? pickupDelayDays : undefined,
        alertFlag,
        reasonSummary
      };
      pickupEntryById.set(pickupId, newEntry);
      rawPickupRequests.push(newEntry);
    });
  });

  // Cross-audit every Pickup Fees deduction (-70 EGP etc.) in Transactions against Pickup Requests & Deliveries Export
  const minFreePickupShipments = Math.max(1, zoneRates.minFreePickupShipments ?? 3);
  const toUtcDayIndex = (ymd?: string): number | null => {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const ms = Date.parse(`${ymd}T00:00:00Z`);
    return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null;
  };

  // Pre-aggregate Deliveries_Export picked-up counts by pickedUpDate (fallback when Pickup Requests is missing or doesn't cover that date)
  const deliveriesPickedCountByDay = new Map<number, { date: string; count: number }>();
  bostaOpMetaByKey.forEach(meta => {
    const dayIdx = toUtcDayIndex(meta.pickedUpDate);
    if (dayIdx === null) return;
    const cur = deliveriesPickedCountByDay.get(dayIdx);
    if (cur) {
      cur.count += 1;
    } else {
      deliveriesPickedCountByDay.set(dayIdx, { date: meta.pickedUpDate, count: 1 });
    }
  });

  const pickupFeeAudits: PickupFeeAuditEntry[] = [];
  const consumedSmallPickupIds = new Set<string>();
  const pickupFeeTxRows = ledgerRows.filter(
    r => r.category.toLowerCase().includes('pickup fee') && r.amount < 0
  );

  pickupFeeTxRows.forEach(tx => {
    const feeAmount = Math.round(Math.abs(tx.amount) * 100) / 100;
    const txDay = toUtcDayIndex(tx.date);

    // 1) Try matching non-canceled Pickup Requests within [txDate - 2 days .. txDate]
    const scoredCandidates: Array<{
      entry: PickupRequestAuditEntry;
      score: number;
      effectiveCount: number;
    }> = [];

    if (txDay !== null && rawPickupRequests.length > 0) {
      rawPickupRequests.forEach(p => {
        if (p.status.toLowerCase().includes('cancel')) return;
        const effectiveCount = Math.max(
          p.pickedUpCount || 0,
          p.scannedCount ?? 0,
          p.receivedCount ?? 0,
          p.confirmedCount ?? 0
        );
        if (effectiveCount <= 0 && !p.status.toLowerCase().includes('pick')) return;

        let bestScore: number | null = null;
        const luDay = toUtcDayIndex(p.lastUpdateDate);
        if (luDay !== null) {
          const diff = txDay - luDay;
          if (diff === 0) bestScore = 0;
          else if (diff === 1) bestScore = 1;
        }
        const opDay = toUtcDayIndex(p.attemptDate || p.scheduledDate);
        if (opDay !== null) {
          const diff = txDay - opDay;
          if (diff >= 0 && diff <= 2) {
            const s = diff <= 1 ? 1 : 2;
            if (bestScore === null || s < bestScore) bestScore = s;
          }
        }
        if (bestScore !== null) {
          scoredCandidates.push({ entry: p, score: bestScore, effectiveCount });
        }
      });
    }

    if (scoredCandidates.length > 0) {
      const minScore = Math.min(...scoredCandidates.map(c => c.score));
      const tier = scoredCandidates.filter(c => c.score === minScore);
      const validSmallMatch = tier.find(
        c =>
          !consumedSmallPickupIds.has(c.entry.pickupId) &&
          !c.entry.isFirstPickup &&
          c.effectiveCount > 0 &&
          c.effectiveCount < minFreePickupShipments
      );

      if (validSmallMatch) {
        const p = validSmallMatch.entry;
        consumedSmallPickupIds.add(p.pickupId);
        p.chargedPickupFee = feeAmount;
        p.chargedTxId = tx.transactionId;
        p.chargedCashoutId = tx.cashoutId;
        p.pickupFeeVerdict = 'valid_under_limit';
        p.reasonSummary = `تم خصم ${feeAmount.toLocaleString('en-US')} ج.م رسوم بيك أب (حركة ${tx.transactionId}) — خصم سليم لأن عدد الشحنات ${validSmallMatch.effectiveCount} (< ${minFreePickupShipments} شحنات)`;

        pickupFeeAudits.push({
          id: `pf_audit_${tx.transactionId}`,
          transactionId: tx.transactionId,
          txDate: tx.date,
          feeAmount,
          cashoutId: tx.cashoutId,
          cashoutDate: tx.cashoutDate,
          cashoutAmount: tx.cashoutAmount,
          matchedSource: 'pickup_requests',
          matchedPickupIds: [p.pickupId],
          pickupDates: [p.attemptDate || p.scheduledDate || p.lastUpdateDate || tx.date],
          shipmentsPickedCount: validSmallMatch.effectiveCount,
          scannedCount: p.scannedCount,
          receivedCount: p.receivedCount,
          requestedCount: p.requestedCount,
          minRequiredForFree: minFreePickupShipments,
          verdict: 'valid_under_limit',
          overchargeAmount: 0,
          reasonSummary: `خصم سليم (-${feeAmount.toLocaleString('en-US')} ج.م): طلب بيك أب #${p.pickupId} تم سحب ${validSmallMatch.effectiveCount} شحنة فقط (أقل من الحد المجاني ${minFreePickupShipments} شحنات).`
        });
        return;
      }

      // Otherwise, either First Pickup = TRUE (exempt) OR EVERY matched pickup in this window had >= minFreePickupShipments -> WRONGFUL DEDUCTION!
      const sortedOver = [...tier].sort((a, b) => a.effectiveCount - b.effectiveCount);
      const primary = sortedOver[0];
      const p = primary.entry;
      p.chargedPickupFee = feeAmount;
      p.chargedTxId = tx.transactionId;
      p.chargedCashoutId = tx.cashoutId;
      p.pickupFeeVerdict = 'wrongful_deduction';
      p.alertFlag = 'wrongful_pickup_fee';
      p.reasonSummary = p.isFirstPickup
        ? `خصم بيك أب خاطئ (-${feeAmount.toLocaleString('en-US')} ج.م في حركة ${tx.transactionId}): الشيت يثبت أنه أول طلب بيك أب (First Pickup = TRUE) ومعفى من الرسوم!`
        : `خصم بيك أب خاطئ (-${feeAmount.toLocaleString('en-US')} ج.م في حركة ${tx.transactionId}${tx.cashoutId ? ` · دفعة ${tx.cashoutId}` : ''}): المندوب سحب ${primary.effectiveCount} شحنات (≥ ${minFreePickupShipments} الحد المجاني — مستحق الاسترداد!)`;

      pickupFeeAudits.push({
        id: `pf_audit_${tx.transactionId}`,
        transactionId: tx.transactionId,
        txDate: tx.date,
        feeAmount,
        cashoutId: tx.cashoutId,
        cashoutDate: tx.cashoutDate,
        cashoutAmount: tx.cashoutAmount,
        matchedSource: 'pickup_requests',
        matchedPickupIds: sortedOver.map(c => c.entry.pickupId),
        pickupDates: Array.from(
          new Set(sortedOver.map(c => c.entry.attemptDate || c.entry.scheduledDate || tx.date))
        ),
        shipmentsPickedCount: primary.effectiveCount,
        scannedCount: p.scannedCount,
        receivedCount: p.receivedCount,
        requestedCount: p.requestedCount,
        minRequiredForFree: minFreePickupShipments,
        verdict: 'wrongful_deduction',
        overchargeAmount: feeAmount,
        reasonSummary: p.isFirstPickup
          ? `خصم خاطئ مستحق الاسترداد (+${feeAmount.toLocaleString('en-US')} ج.م): طلب بيك أب #${p.pickupId} مسجل كـ First Pickup (أول بيك أب مجاني) ومع ذلك خصمت بوسطة -${feeAmount.toLocaleString('en-US')} ج.م!`
          : `خصم خاطئ مستحق الاسترداد (+${feeAmount.toLocaleString('en-US')} ج.م): طلب بيك أب #${sortedOver.map(c => c.entry.pickupId).join(' / ')} تم فيه سحب ${primary.effectiveCount} شحنات (الحد المجاني ≥ ${minFreePickupShipments} شحنات) ومع ذلك خصمت بوسطة -${feeAmount.toLocaleString('en-US')} ج.م!`
      });
      return;
    }

    // 2) Fallback: check Deliveries_Export Picked-Up Date counts in [txDay - 1 .. txDay]
    if (txDay !== null) {
      const candidateDays = [txDay - 1, txDay, txDay - 2]
        .map(d => deliveriesPickedCountByDay.get(d))
        .filter((x): x is { date: string; count: number } => Boolean(x));

      if (candidateDays.length > 0) {
        const bestDeliv = [...candidateDays].sort((a, b) => b.count - a.count)[0];
        if (bestDeliv.count >= minFreePickupShipments) {
          pickupFeeAudits.push({
            id: `pf_audit_${tx.transactionId}`,
            transactionId: tx.transactionId,
            txDate: tx.date,
            feeAmount,
            cashoutId: tx.cashoutId,
            cashoutDate: tx.cashoutDate,
            cashoutAmount: tx.cashoutAmount,
            matchedSource: 'deliveries_export',
            matchedPickupIds: [],
            pickupDates: [bestDeliv.date],
            shipmentsPickedCount: bestDeliv.count,
            minRequiredForFree: minFreePickupShipments,
            verdict: 'wrongful_deduction',
            overchargeAmount: feeAmount,
            reasonSummary: `خصم خاطئ مستحق الاسترداد (+${feeAmount.toLocaleString('en-US')} ج.م): وفق شيت الشحنات، تم تسليم ${bestDeliv.count} شحنات للمندوب بتاريخ ${bestDeliv.date} (≥ ${minFreePickupShipments} شحنات مجانية)!`
          });
          return;
        }
        pickupFeeAudits.push({
          id: `pf_audit_${tx.transactionId}`,
          transactionId: tx.transactionId,
          txDate: tx.date,
          feeAmount,
          cashoutId: tx.cashoutId,
          cashoutDate: tx.cashoutDate,
          cashoutAmount: tx.cashoutAmount,
          matchedSource: 'deliveries_export',
          matchedPickupIds: [],
          pickupDates: [bestDeliv.date],
          shipmentsPickedCount: bestDeliv.count,
          minRequiredForFree: minFreePickupShipments,
          verdict: 'valid_under_limit',
          overchargeAmount: 0,
          reasonSummary: `خصم سليم (-${feeAmount.toLocaleString('en-US')} ج.م): شيت الشحنات يظهر ${bestDeliv.count} شحنة فقط بتاريخ ${bestDeliv.date} (أقل من ${minFreePickupShipments}).`
        });
        return;
      }
    }

    // 3) Could not verify because neither Pickup Requests nor Deliveries covered that date
    pickupFeeAudits.push({
      id: `pf_audit_${tx.transactionId}`,
      transactionId: tx.transactionId,
      txDate: tx.date,
      feeAmount,
      cashoutId: tx.cashoutId,
      cashoutDate: tx.cashoutDate,
      cashoutAmount: tx.cashoutAmount,
      matchedSource: 'none',
      matchedPickupIds: [],
      pickupDates: [],
      shipmentsPickedCount: 0,
      minRequiredForFree: minFreePickupShipments,
      verdict: 'unverified_no_pickup_sheet',
      overchargeAmount: 0,
      reasonSummary: `خصم بيك أب -${feeAmount.toLocaleString('en-US')} ج.م بتاريخ ${tx.date}: ارفع شيت Pickup Requests الذي يغطي هذا التاريخ للتحقق من عدد الشحنات.`
    });
  });

  const normalizeBrandKey = (name?: string): string =>
    (name || '')
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/\s+/g, ' ')
      .toLowerCase();

  // Brand Family normalization merges ONLY spelling/orthography variants of the exact same brand (NO merging of distinct brands like "وان تولز" vs "إن تولز")
  const getBrandFamilyMeta = (name?: string): { key: string; label: string } => {
    const raw = (name || '').trim();
    if (!raw) return { key: '', label: '' };
    const norm = raw
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
    const stripped = norm
      .replace(/\s*(للعدد والادوات|للعدد|للعده|للعد|والادوات|ستور|store)\s*$/g, '')
      .trim();
    if (stripped.includes('وان تولز') || stripped.includes('onetoolz') || stripped.includes('one toolz')) {
      return { key: 'وان تولز', label: 'وان تولز' };
    }
    if (stripped === 'ان تولز' || stripped.startsWith('ان تولز ')) {
      return { key: 'ان تولز', label: 'إن تولز' };
    }
    const displayLabel =
      raw.replace(/\s*(للعدد والادوات|للعدد|للعده|للعد|والادوات)\s*$/g, '').trim() || raw;
    return { key: stripped || norm, label: displayLabel };
  };

  // Generalized Cross-Brand Pickup & Return-Address Swap Detector (100% Data-Driven from Sheets)
  const normalizeWarehouseAddrKey = (addr?: string, contact?: string): string => {
    const base = (addr || contact || '')
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[.,،\-_/\\()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
    return base;
  };

  type BostaOpMetaItem = typeof bostaOpMetaByKey extends Map<string, infer V> ? V : never;

  // 1) Index non-deleted Deliveries_Export shipments by exact Picked-Up timestamp (in seconds) and by date
  const deliveriesByEpochSec = new Map<number, BostaOpMetaItem[]>();
  const deliveriesByDateAndFamily = new Map<string, Map<string, BostaOpMetaItem[]>>();
  bostaOpMetaByKey.forEach(op => {
    const delLow = (op.deliveryState || '').toLowerCase();
    if (delLow.includes('deleted')) return;
    if (typeof op.pickedUpEpochSec === 'number') {
      const list = deliveriesByEpochSec.get(op.pickedUpEpochSec) || [];
      list.push(op);
      deliveriesByEpochSec.set(op.pickedUpEpochSec, list);
    }
    const dt = op.pickedUpDate;
    if (!dt) return;
    const bf = getBrandFamilyMeta(op.brandName);
    if (!bf.key) return;
    let dayMap = deliveriesByDateAndFamily.get(dt);
    if (!dayMap) {
      dayMap = new Map();
      deliveriesByDateAndFamily.set(dt, dayMap);
    }
    const list = dayMap.get(bf.key) || [];
    list.push(op);
    dayMap.set(bf.key, list);
  });

  // 2) Link each Pickup Request to its exact Deliveries batch via Sample TN's Picked-Up timestamp or Attempt Date timestamp (±15 seconds)
  const pickupDeliveriesBatchById = new Map<string, BostaOpMetaItem[]>();
  const pickupBatchBrandCountsById = new Map<string, Map<string, { count: number; label: string }>>();

  rawPickupRequests.forEach(p => {
    const bf = getBrandFamilyMeta(p.brandName);
    p.brandFamily = bf.label || undefined;
    const sampleOp = p.sampleTrackingNumber ? bostaOpMetaByKey.get(p.sampleTrackingNumber) : undefined;
    if (sampleOp?.brandName) {
      p.sampleTrackingBrand = sampleOp.brandName;
    }

    const isCanceled = p.status.toLowerCase().includes('cancel');
    if (isCanceled || p.pickedUpCount <= 0) return;

    const anchorSec = sampleOp?.pickedUpEpochSec ?? p.attemptEpochSec ?? null;
    const batchMap = new Map<string, BostaOpMetaItem>();
    if (sampleOp && !(sampleOp.deliveryState || '').toLowerCase().includes('deleted')) {
      batchMap.set(sampleOp.trackingKey, sampleOp);
    }
    if (anchorSec !== null) {
      deliveriesByEpochSec.forEach((opsAtSec, sec) => {
        if (Math.abs(sec - anchorSec) <= 15) {
          opsAtSec.forEach(op => batchMap.set(op.trackingKey, op));
        }
      });
    }
    const batch = Array.from(batchMap.values());
    if (batch.length > 0) {
      pickupDeliveriesBatchById.set(p.pickupId, batch);
      const bCounts = new Map<string, { count: number; label: string }>();
      batch.forEach(op => {
        const obf = getBrandFamilyMeta(op.brandName);
        if (!obf.key) return;
        const prev = bCounts.get(obf.key) || { count: 0, label: obf.label };
        prev.count += 1;
        bCounts.set(obf.key, prev);
      });
      pickupBatchBrandCountsById.set(p.pickupId, bCounts);
    }
  });

  // 3) Pre-detect same-day inverse-count swapped pickup pairs (e.g., PickedUp_A == Confirmed_B && PickedUp_B == Confirmed_A at two different warehouses)
  // so swapped days never pollute warehouse brand learning!
  const activePickupsByDate = new Map<string, PickupRequestAuditEntry[]>();
  rawPickupRequests.forEach(p => {
    if (p.status.toLowerCase().includes('cancel') || p.pickedUpCount <= 0) return;
    const dayKey = p.attemptDate || p.firstPickedUpDate || p.scheduledDate;
    if (!dayKey) return;
    const arr = activePickupsByDate.get(dayKey) || [];
    arr.push(p);
    activePickupsByDate.set(dayKey, arr);
  });

  const preDetectedInverseSwapIds = new Set<string>();
  activePickupsByDate.forEach(dayPickups => {
    for (let i = 0; i < dayPickups.length; i++) {
      const a = dayPickups[i];
      const whA = normalizeWarehouseAddrKey(a.addressLine, a.contactName || a.contactNumber);
      if (!whA) continue;
      for (let j = i + 1; j < dayPickups.length; j++) {
        const b = dayPickups[j];
        const whB = normalizeWarehouseAddrKey(b.addressLine, b.contactName || b.contactNumber);
        if (!whB || whA === whB) continue;
        const inverseCountSwap =
          typeof a.confirmedCount === 'number' &&
          typeof b.confirmedCount === 'number' &&
          a.pickedUpCount > 0 &&
          b.pickedUpCount > 0 &&
          a.pickedUpCount !== b.pickedUpCount &&
          a.pickedUpCount === b.confirmedCount &&
          b.pickedUpCount === a.confirmedCount;
        if (inverseCountSwap) {
          preDetectedInverseSwapIds.add(a.pickupId);
          preDetectedInverseSwapIds.add(b.pickupId);
        }
      }
    }
  });

  // 4) Learn Warehouse <-> Brand associations purely from the sheets:
  //    - Every Brand Name found inside a clean pickup's matched Deliveries batch (e.g. "إن تولز للعدد" + "العربي تولز للعدد" picked up together in #35350408 and #14389102) is automatically learned as a resident brand of that warehouse!
  //    - Clean pickup Business Name rows also vote for their warehouse.
  interface WarehouseBrandStat {
    warehouseKey: string;
    addressDisplay: string;
    contactDisplay: string;
    brandVotes: Map<string, { weight: number; parcelCount: number; label: string; latestDate: string }>;
  }
  const warehouseStatsMap = new Map<string, WarehouseBrandStat>();

  rawPickupRequests.forEach(p => {
    const isCanceled = p.status.toLowerCase().includes('cancel');
    if (isCanceled || p.pickedUpCount <= 0) return;

    const whKey = normalizeWarehouseAddrKey(p.addressLine, p.contactName || p.contactNumber);
    if (!whKey) return;

    const contactStr = [p.contactName, p.contactNumber].filter(Boolean).join(' · ');
    let stat = warehouseStatsMap.get(whKey);
    if (!stat) {
      stat = {
        warehouseKey: whKey,
        addressDisplay: p.addressLine || p.hubName || contactStr || whKey,
        contactDisplay: contactStr,
        brandVotes: new Map()
      };
      warehouseStatsMap.set(whKey, stat);
    }
    if (p.addressLine && p.addressLine.length > stat.addressDisplay.length) {
      stat.addressDisplay = p.addressLine;
    }
    if (contactStr && !stat.contactDisplay) {
      stat.contactDisplay = contactStr;
    }

    // Skip pickups that are part of an inverse-count swap so swapped parcels don't vote for the wrong warehouse
    if (preDetectedInverseSwapIds.has(p.pickupId)) return;

    const pickupDay = p.attemptDate || p.firstPickedUpDate || p.scheduledDate || p.creationDate || '';
    const batchBrands = pickupBatchBrandCountsById.get(p.pickupId);
    const recBf = getBrandFamilyMeta(p.brandName);
    const sampleBf = getBrandFamilyMeta(p.sampleTrackingBrand);

    const addVote = (familyKey: string, familyLabel: string, weight: number, parcels: number) => {
      if (!familyKey || weight <= 0) return;
      const prev = stat!.brandVotes.get(familyKey) || {
        weight: 0,
        parcelCount: 0,
        label: familyLabel,
        latestDate: pickupDay
      };
      prev.weight += weight;
      prev.parcelCount += parcels;
      if (pickupDay > prev.latestDate) prev.latestDate = pickupDay;
      stat!.brandVotes.set(familyKey, prev);
    };

    if (batchBrands && batchBrands.size > 0) {
      // Actual parcels picked up in this clean batch directly prove which brands operate out of this warehouse!
      batchBrands.forEach((bInfo, bKey) => {
        const matchesRec = recBf.key === bKey;
        const w = matchesRec ? 5 + bInfo.count : 3 + bInfo.count;
        addVote(bKey, bInfo.label, w, bInfo.count);
      });
    } else if (sampleBf.key && recBf.key && sampleBf.key === recBf.key) {
      addVote(recBf.key, recBf.label, 5, p.pickedUpCount);
    } else if (!sampleBf.key && recBf.key) {
      addVote(recBf.key, recBf.label, 1, p.pickedUpCount);
    }
  });

  // Fallback pass for warehouses that had zero clean votes
  rawPickupRequests.forEach(p => {
    const isCanceled = p.status.toLowerCase().includes('cancel');
    if (isCanceled || p.pickedUpCount <= 0) return;
    const whKey = normalizeWarehouseAddrKey(p.addressLine, p.contactName || p.contactNumber);
    const stat = whKey ? warehouseStatsMap.get(whKey) : undefined;
    if (!stat || stat.brandVotes.size > 0) return;
    const fb = getBrandFamilyMeta(p.sampleTrackingBrand || p.brandName);
    if (!fb.key) return;
    const pickupDay = p.attemptDate || p.firstPickedUpDate || p.scheduledDate || '';
    stat.brandVotes.set(fb.key, {
      weight: 1,
      parcelCount: p.pickedUpCount,
      label: fb.label,
      latestDate: pickupDay
    });
  });

  // Determine each Brand's Active Primary Home Warehouse (prioritizing most recent active warehouse date, then vote weight)
  const homeWarehouseByBrandFamily = new Map<
    string,
    {
      warehouseKey: string;
      addressDisplay: string;
      contactDisplay: string;
      weight: number;
      parcelCount: number;
      latestDate: string;
      brandLabel: string;
    }
  >();

  warehouseStatsMap.forEach((stat, whKey) => {
    stat.brandVotes.forEach((v, brandKey) => {
      const existing = homeWarehouseByBrandFamily.get(brandKey);
      if (
        !existing ||
        v.latestDate > existing.latestDate ||
        (v.latestDate === existing.latestDate && v.weight > existing.weight)
      ) {
        homeWarehouseByBrandFamily.set(brandKey, {
          warehouseKey: whKey,
          addressDisplay: stat.addressDisplay,
          contactDisplay: stat.contactDisplay,
          weight: v.weight,
          parcelCount: v.parcelCount,
          latestDate: v.latestDate,
          brandLabel: v.label
        });
      }
    });
  });

  // Determine each Warehouse's resident brands (brands whose active home is this warehouse, or that have repeated clean pickup history at this warehouse)
  const warehouseHomeBrandByKey = new Map<
    string,
    {
      familyKey: string;
      familyLabel: string;
      residentBrandKeys: Set<string>;
      residentBrandLabels: string[];
      addressDisplay: string;
      contactDisplay: string;
      weight: number;
      latestDate: string;
    }
  >();

  warehouseStatsMap.forEach((stat, whKey) => {
    let bestKey = '';
    let bestLabel = '';
    let bestWeight = -1;
    let bestDate = '';
    const residentKeys = new Set<string>();
    const residentLabels: string[] = [];

    // Sort brands at this warehouse by weight descending
    const sortedEntries = Array.from(stat.brandVotes.entries()).sort(
      (a, b) => b[1].weight - a[1].weight || b[1].latestDate.localeCompare(a[1].latestDate)
    );
    sortedEntries.forEach(([k, v]) => {
      if (v.weight > bestWeight || (v.weight === bestWeight && v.latestDate > bestDate)) {
        bestWeight = v.weight;
        bestKey = k;
        bestLabel = v.label;
        bestDate = v.latestDate;
      }
      const brandHome = homeWarehouseByBrandFamily.get(k);
      if (brandHome?.warehouseKey === whKey || v.weight >= 3) {
        residentKeys.add(k);
        if (!residentLabels.includes(v.label)) residentLabels.push(v.label);
      }
    });

    if (!bestKey) return;
    if (residentKeys.size === 0) {
      residentKeys.add(bestKey);
      residentLabels.push(bestLabel);
    }

    warehouseHomeBrandByKey.set(whKey, {
      familyKey: bestKey,
      familyLabel: residentLabels.join(' + '),
      residentBrandKeys: residentKeys,
      residentBrandLabels: residentLabels,
      addressDisplay: stat.addressDisplay,
      contactDisplay: stat.contactDisplay,
      weight: bestWeight,
      latestDate: bestDate
    });
  });

  rawPickupRequests.forEach(p => {
    const whKey = normalizeWarehouseAddrKey(p.addressLine, p.contactName || p.contactNumber);
    const whHome = whKey ? warehouseHomeBrandByKey.get(whKey) : undefined;
    if (whHome) {
      p.expectedWarehouseBrand = whHome.familyLabel;
    }
  });

  const allCrossBrandSwaps: CrossBrandPickupSwapAlert[] = [];
  const wrongReturnWarehouseNoteByTracking = new Map<string, string>();
  const swappedPickupIdsConsumed = new Set<string>();

  const buildReturnedItemsForPickupOrBrand = (paramsItem: {
    pickupId: string;
    dayKey: string;
    foreignBrandKeys: Set<string>;
    routedWarehouseAddress: string;
    routedWarehouseContact?: string;
    fallbackExpectedAddress: string;
    fallbackExpectedContact?: string;
  }): { totalCount: number; returnedItems: CrossBrandReturnedTrackingItem[] } => {
    // Prefer exact timestamp-matched Deliveries batch for this pickup; fallback to same-day Deliveries for those foreign brands
    const exactBatch = pickupDeliveriesBatchById.get(paramsItem.pickupId);
    let candidateOps: BostaOpMetaItem[] = [];
    if (exactBatch && exactBatch.length > 0) {
      candidateOps = exactBatch.filter(op =>
        paramsItem.foreignBrandKeys.has(getBrandFamilyMeta(op.brandName).key)
      );
    }
    if (candidateOps.length === 0) {
      const dayMap = deliveriesByDateAndFamily.get(paramsItem.dayKey);
      if (dayMap) {
        paramsItem.foreignBrandKeys.forEach(fk => {
          const list = dayMap.get(fk) || [];
          candidateOps.push(...list);
        });
      }
    }

    const returnedItems: CrossBrandReturnedTrackingItem[] = [];
    candidateOps.forEach(op => {
      const stLow = (op.deliveryState || '').toLowerCase();
      if (stLow.includes('canceled') || stLow.includes('cancelled') || stLow.includes('deleted')) return;
      const isAlreadyReturnedToOrigin =
        stLow.includes('returned to origin') ||
        stLow.includes('returned to business') ||
        stLow === 'returned';
      const isInTransitOrHub =
        !isAlreadyReturnedToOrigin &&
        (stLow.includes('returning') ||
          stLow.includes('return') ||
          stLow.includes('received at warehouse') ||
          stLow.includes('in transit') ||
          stLow.includes('exception') ||
          stLow.includes('hold') ||
          op.returnAttemptsCount > 0);
      if (!isAlreadyReturnedToOrigin && !isInTransitOrHub) return;

      const opBf = getBrandFamilyMeta(op.brandName);
      const opTrueHome = opBf.key ? homeWarehouseByBrandFamily.get(opBf.key) : undefined;
      const expAddr = opTrueHome?.addressDisplay || paramsItem.fallbackExpectedAddress;
      const expContact = opTrueHome?.contactDisplay || paramsItem.fallbackExpectedContact;

      returnedItems.push({
        trackingKey: op.trackingKey,
        actualBrandName: op.brandName,
        expectedReturnWarehouse: expAddr,
        expectedReturnContact: expContact,
        routedReturnWarehouse: paramsItem.routedWarehouseAddress,
        routedReturnContact: paramsItem.routedWarehouseContact,
        deliveryState: op.deliveryState,
        currentHub: op.currentHub || undefined,
        customerName: op.customerName || undefined,
        dropoffCity: op.dropoffCity || undefined,
        packageDescription: op.packageDescription || undefined,
        pickedUpDate: op.pickedUpDate || undefined,
        updatedAt: op.updatedAt || undefined,
        deliveredAt: op.deliveredAt || undefined,
        isAlreadyReturnedToOrigin,
        isInTransitOrHub
      });

      const dirNote = isAlreadyReturnedToOrigin
        ? `⚠️ مرتجع موجه لمخزن خاطئ: البوليصة تخص (${op.brandName}) وسُحبت في بيك أب تبدل مخزنه، لذا ارتجعت/تُسلم إلى (${paramsItem.routedWarehouseAddress}${
            paramsItem.routedWarehouseContact ? ` — ${paramsItem.routedWarehouseContact}` : ''
          }) بدلاً من مخزنها الأصلي (${expAddr})`
        : `⚠️ في طريق الإرجاع لمخزن خاطئ: تخص (${op.brandName}) ومتوجهة حالياً نحو (${paramsItem.routedWarehouseAddress}) بدلاً من (${expAddr})`;
      if (!wrongReturnWarehouseNoteByTracking.has(op.trackingKey)) {
        wrongReturnWarehouseNoteByTracking.set(op.trackingKey, dirNote);
      }
    });

    returnedItems.sort((a, b) => {
      if (a.isAlreadyReturnedToOrigin !== b.isAlreadyReturnedToOrigin) {
        return a.isAlreadyReturnedToOrigin ? -1 : 1;
      }
      return a.trackingKey.localeCompare(b.trackingKey);
    });

    return { totalCount: candidateOps.length, returnedItems };
  };

  activePickupsByDate.forEach((dayPickups, dayKey) => {
    // 1) Detect Paired Two-Way Swaps between two warehouses on the same day
    for (let i = 0; i < dayPickups.length; i++) {
      const a = dayPickups[i];
      if (swappedPickupIdsConsumed.has(a.pickupId)) continue;
      const whAKey = normalizeWarehouseAddrKey(a.addressLine, a.contactName || a.contactNumber);
      const homeA = whAKey ? warehouseHomeBrandByKey.get(whAKey) : undefined;
      if (!homeA) continue;

      const sampleABf = getBrandFamilyMeta(a.sampleTrackingBrand);
      const recABf = getBrandFamilyMeta(a.brandName);

      for (let j = i + 1; j < dayPickups.length; j++) {
        const b = dayPickups[j];
        if (swappedPickupIdsConsumed.has(b.pickupId)) continue;
        const whBKey = normalizeWarehouseAddrKey(b.addressLine, b.contactName || b.contactNumber);
        const homeB = whBKey ? warehouseHomeBrandByKey.get(whBKey) : undefined;
        if (!homeB || whAKey === whBKey || homeA.familyKey === homeB.familyKey) continue;

        const sampleBBf = getBrandFamilyMeta(b.sampleTrackingBrand);
        const recBBf = getBrandFamilyMeta(b.brandName);

        const aSampleBelongsToB = Boolean(sampleABf.key && homeB.residentBrandKeys.has(sampleABf.key));
        const bSampleBelongsToA = Boolean(sampleBBf.key && homeA.residentBrandKeys.has(sampleBBf.key));
        const inverseCountSwap =
          typeof a.confirmedCount === 'number' &&
          typeof b.confirmedCount === 'number' &&
          a.pickedUpCount > 0 &&
          b.pickedUpCount > 0 &&
          a.pickedUpCount !== b.pickedUpCount &&
          a.pickedUpCount === b.confirmedCount &&
          b.pickedUpCount === a.confirmedCount;
        const bMislabeledAsA = Boolean(recBBf.key && homeA.residentBrandKeys.has(recBBf.key) && bSampleBelongsToA);
        const aMislabeledAsB = Boolean(recABf.key && homeB.residentBrandKeys.has(recABf.key) && aSampleBelongsToB);

        const isTwoWaySwap =
          (aSampleBelongsToB && bSampleBelongsToA) ||
          (inverseCountSwap && (aSampleBelongsToB || bSampleBelongsToA || bMislabeledAsA || aMislabeledAsB)) ||
          (bMislabeledAsA && (aSampleBelongsToB || inverseCountSwap)) ||
          (aMislabeledAsB && (bSampleBelongsToA || inverseCountSwap));

        if (!isTwoWaySwap) continue;

        swappedPickupIdsConsumed.add(a.pickupId);
        swappedPickupIdsConsumed.add(b.pickupId);
        const swapId = `xswap_${dayKey}_${a.pickupId}_${b.pickupId}`;

        // Shipments pulled under Pickup A belong to B's warehouse brands (so their return goes to A's warehouse wrongly!)
        const resA = buildReturnedItemsForPickupOrBrand({
          pickupId: a.pickupId,
          dayKey,
          foreignBrandKeys: homeB.residentBrandKeys,
          routedWarehouseAddress: homeA.addressDisplay,
          routedWarehouseContact: homeA.contactDisplay,
          fallbackExpectedAddress: homeB.addressDisplay,
          fallbackExpectedContact: homeB.contactDisplay
        });
        // Shipments pulled under Pickup B belong to A's warehouse brands (so their return goes to B's warehouse wrongly!)
        const resB = buildReturnedItemsForPickupOrBrand({
          pickupId: b.pickupId,
          dayKey,
          foreignBrandKeys: homeA.residentBrandKeys,
          routedWarehouseAddress: homeB.addressDisplay,
          routedWarehouseContact: homeB.contactDisplay,
          fallbackExpectedAddress: homeA.addressDisplay,
          fallbackExpectedContact: homeA.contactDisplay
        });

        const combinedReturns = [...resA.returnedItems, ...resB.returnedItems];
        const actualBrandAtA = a.sampleTrackingBrand || homeB.familyLabel;
        const actualBrandAtB = b.sampleTrackingBrand || homeA.familyLabel;
        const swapSummaryA = `🚨 تبديل متبادل مع بيك أب #${b.pickupId} (${dayKey}): المندوب سحب ${a.pickedUpCount} شحنة تخص "${actualBrandAtA}" من مخزن "${homeA.familyLabel}" (المؤكد ${a.confirmedCount ?? '-'}) — العينة #${a.sampleTrackingNumber || '-'} · أي مرتجع من الـ ${a.pickedUpCount} شحنة هيرجع لمخزن "${homeA.contactDisplay || homeA.addressDisplay}" بالغلط!`;
        const swapSummaryB = `🚨 تبديل متبادل مع بيك أب #${a.pickupId} (${dayKey}): المندوب سحب ${b.pickedUpCount} شحنة تخص "${actualBrandAtB}" تحت اسم "${b.brandName || homeA.familyLabel}" من مخزن "${homeB.familyLabel}" (المؤكد ${b.confirmedCount ?? '-'}) — العينة #${b.sampleTrackingNumber || '-'} · أي مرتجع من الـ ${b.pickedUpCount} شحنة هيرجع لمخزن "${homeB.contactDisplay || homeB.addressDisplay}" بالغلط!`;

        a.isCrossBrandSwapped = true;
        a.crossBrandSwapId = swapId;
        a.crossBrandSwapSummary = swapSummaryA;
        a.reasonSummary = `${swapSummaryA}${a.reasonSummary ? ` | ${a.reasonSummary}` : ''}`;

        b.isCrossBrandSwapped = true;
        b.crossBrandSwapId = swapId;
        b.crossBrandSwapSummary = swapSummaryB;
        b.reasonSummary = `${swapSummaryB}${b.reasonSummary ? ` | ${b.reasonSummary}` : ''}`;

        allCrossBrandSwaps.push({
          id: swapId,
          date: dayKey,
          kind: 'paired_two_way_swap',
          pickupId: a.pickupId,
          recordedBrandName: a.brandName || homeA.familyLabel,
          warehouseAddress: homeA.addressDisplay,
          warehouseContact: homeA.contactDisplay,
          warehouseHomeBrand: homeA.familyLabel,
          actualShipmentsBrand: actualBrandAtA,
          pickedUpCount: a.pickedUpCount,
          confirmedCount: a.confirmedCount,
          sampleTrackingNumber: a.sampleTrackingNumber,
          sampleTrackingBrand: a.sampleTrackingBrand,
          partnerPickupId: b.pickupId,
          partnerWarehouseAddress: homeB.addressDisplay,
          partnerWarehouseContact: homeB.contactDisplay,
          partnerWarehouseHomeBrand: homeB.familyLabel,
          partnerActualShipmentsBrand: actualBrandAtB,
          partnerPickedUpCount: b.pickedUpCount,
          partnerConfirmedCount: b.confirmedCount,
          partnerSampleTrackingNumber: b.sampleTrackingNumber,
          affectedTotalShipmentsCount: resA.totalCount + resB.totalCount || a.pickedUpCount + b.pickedUpCount,
          affectedReturnsCount: combinedReturns.length,
          affectedReturnedShipments: combinedReturns,
          reasonSummary: `تبديل متبادل يوم ${dayKey} بين #${a.pickupId} (مخزن ${homeA.familyLabel} — سُحب منه ${a.pickedUpCount} لـ ${actualBrandAtA} مقابل تأكيد ${a.confirmedCount ?? '-'}) ↔ #${b.pickupId} (مخزن ${homeB.familyLabel} — سُحب منه ${b.pickedUpCount} لـ ${actualBrandAtB} مقابل تأكيد ${b.confirmedCount ?? '-'}). إجمالي المرتجعات المعرّضة للرجوع للعنوان العكسي: ${combinedReturns.length} بوليصة.`
        });
        break;
      }
    }

    // 2) Detect Single-Side Misrouted Pickups (only when the actual picked-up parcels in Deliveries belong to a brand whose home warehouse is a DIFFERENT warehouse!)
    dayPickups.forEach(p => {
      if (swappedPickupIdsConsumed.has(p.pickupId)) return;
      const whKey = normalizeWarehouseAddrKey(p.addressLine, p.contactName || p.contactNumber);
      const whHome = whKey ? warehouseHomeBrandByKey.get(whKey) : undefined;
      const whStat = whKey ? warehouseStatsMap.get(whKey) : undefined;
      if (!whHome) return;

      const recBf = getBrandFamilyMeta(p.brandName);
      const sampleBf = getBrandFamilyMeta(p.sampleTrackingBrand);
      const batchBrands = pickupBatchBrandCountsById.get(p.pickupId);

      // Check if any brand in the picked-up batch (or sample TN) actually belongs to a DIFFERENT home warehouse
      const foreignBrandKeys = new Set<string>();
      const foreignBrandLabels: string[] = [];
      if (batchBrands && batchBrands.size > 0) {
        batchBrands.forEach((bInfo, bKey) => {
          const bHome = homeWarehouseByBrandFamily.get(bKey);
          if (bHome && bHome.warehouseKey !== whKey && !whHome.residentBrandKeys.has(bKey)) {
            foreignBrandKeys.add(bKey);
            if (!foreignBrandLabels.includes(bInfo.label)) foreignBrandLabels.push(bInfo.label);
          }
        });
      } else if (sampleBf.key && !whHome.residentBrandKeys.has(sampleBf.key)) {
        const bHome = homeWarehouseByBrandFamily.get(sampleBf.key);
        if (!bHome || bHome.warehouseKey !== whKey) {
          foreignBrandKeys.add(sampleBf.key);
          foreignBrandLabels.push(sampleBf.label);
        }
      }

      if (foreignBrandKeys.size === 0) return;

      const primaryForeignKey = Array.from(foreignBrandKeys)[0] || sampleBf.key || recBf.key;
      const primaryForeignLabel =
        foreignBrandLabels.join(' + ') || p.sampleTrackingBrand || sampleBf.label || recBf.label;
      const expectedHome = primaryForeignKey ? homeWarehouseByBrandFamily.get(primaryForeignKey) : undefined;

      const returnedStats = buildReturnedItemsForPickupOrBrand({
        pickupId: p.pickupId,
        dayKey,
        foreignBrandKeys,
        routedWarehouseAddress: whHome.addressDisplay,
        routedWarehouseContact: whHome.contactDisplay,
        fallbackExpectedAddress: expectedHome?.addressDisplay || `مخزن ${primaryForeignLabel}`,
        fallbackExpectedContact: expectedHome?.contactDisplay
      });

      const swapId = `xsingle_${dayKey}_${p.pickupId}`;
      const summary = `⚠️ تداخل براند ومخزن في بيك أب #${p.pickupId} (${dayKey}): تم السحب من مخزن "${whHome.familyLabel}" (${whHome.addressDisplay}) لكن الشحنات المسحوبة تخص براند "${primaryForeignLabel}" ومخزنها الأصلي (${expectedHome?.addressDisplay || '-'})`;

      swappedPickupIdsConsumed.add(p.pickupId);
      p.isCrossBrandSwapped = true;
      p.crossBrandSwapId = swapId;
      p.crossBrandSwapSummary = summary;
      p.reasonSummary = `${summary}${p.reasonSummary ? ` | ${p.reasonSummary}` : ''}`;

      allCrossBrandSwaps.push({
        id: swapId,
        date: dayKey,
        kind: 'single_misrouted_pickup',
        pickupId: p.pickupId,
        recordedBrandName: p.brandName || '-',
        warehouseAddress: whHome.addressDisplay,
        warehouseContact: whHome.contactDisplay,
        warehouseHomeBrand: whHome.familyLabel,
        actualShipmentsBrand: primaryForeignLabel,
        pickedUpCount: p.pickedUpCount,
        confirmedCount: p.confirmedCount,
        sampleTrackingNumber: p.sampleTrackingNumber,
        sampleTrackingBrand: p.sampleTrackingBrand,
        affectedTotalShipmentsCount: Math.max(p.pickedUpCount, returnedStats.totalCount),
        affectedReturnsCount: returnedStats.returnedItems.length,
        affectedReturnedShipments: returnedStats.returnedItems,
        reasonSummary: summary
      });
    });
  });

  allCrossBrandSwaps.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'paired_two_way_swap' ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  // Attach wrongReturnWarehouseNote to matching sheetRows built earlier
  sheetRows.forEach(r => {
    const note = wrongReturnWarehouseNoteByTracking.get(r.trackingKey);
    if (note) {
      r.wrongReturnWarehouseNote = note;
      r.warehouseReturnNote = r.warehouseReturnNote
        ? `${note} · (${r.warehouseReturnNote})`
        : note;
    }
  });

  const brandDisplayByKey = new Map<string, string>();
  sheetRows.forEach(r => {
    if (!r.brandName) return;
    const k = normalizeBrandKey(r.brandName);
    const existing = brandDisplayByKey.get(k);
    // Prefer spelling with Hamza (e.g., "إن تولز للعدد") if available
    if (!existing || (/[أإآ]/.test(r.brandName) && !/[أإآ]/.test(existing))) {
      brandDisplayByKey.set(k, r.brandName);
    }
  });
  rawCompensations.forEach(c => {
    if (!c.brandName) return;
    const k = normalizeBrandKey(c.brandName);
    if (!brandDisplayByKey.has(k)) {
      brandDisplayByKey.set(k, c.brandName);
    }
  });
  rawPickupRequests.forEach(p => {
    if (!p.brandName) return;
    const k = normalizeBrandKey(p.brandName);
    if (!brandDisplayByKey.has(k)) {
      brandDisplayByKey.set(k, p.brandName);
    }
  });
  const availableSheetBrands = Array.from(brandDisplayByKey.values()).sort((a, b) =>
    a.localeCompare(b, 'ar')
  );

  const normalizedBrandFilter = sheetBrandFilter !== 'all' ? normalizeBrandKey(sheetBrandFilter) : 'all';
  const filterBrandFamily =
    sheetBrandFilter !== 'all' ? getBrandFamilyMeta(sheetBrandFilter) : { key: '', label: '' };

  const filteredCrossBrandSwaps =
    normalizedBrandFilter === 'all'
      ? allCrossBrandSwaps
      : allCrossBrandSwaps.filter(s => {
          const candidates = [
            s.recordedBrandName,
            s.warehouseHomeBrand,
            s.actualShipmentsBrand,
            s.sampleTrackingBrand,
            s.partnerWarehouseHomeBrand,
            s.partnerActualShipmentsBrand
          ];
          return candidates.some(
            c =>
              Boolean(c) &&
              (normalizeBrandKey(c) === normalizedBrandFilter ||
                (filterBrandFamily.key && getBrandFamilyMeta(c).key === filterBrandFamily.key))
          );
        });
  const visibleSwapIds = new Set(filteredCrossBrandSwaps.map(s => s.id));

  const filteredSheetRows = sheetRows.filter(r => {
    if (matchWithStoreOrders && carrierFilter !== 'all') {
      if (r.matchedOrder && (r.matchedOrder.shippingCompany || 'غير محدد') !== carrierFilter) {
        return false;
      }
    }
    if (normalizedBrandFilter !== 'all') {
      if (normalizeBrandKey(r.brandName) !== normalizedBrandFilter) return false;
    }
    return true;
  });

  const filteredCompensations = rawCompensations.filter(c => {
    if (normalizedBrandFilter !== 'all') {
      if (normalizeBrandKey(c.brandName) !== normalizedBrandFilter) return false;
    }
    return true;
  });

  const filteredPickups = rawPickupRequests
    .filter(p => {
      if (normalizedBrandFilter !== 'all') {
        const directMatch = normalizeBrandKey(p.brandName) === normalizedBrandFilter;
        const swapMatch = Boolean(p.crossBrandSwapId && visibleSwapIds.has(p.crossBrandSwapId));
        if (!directMatch && !swapMatch) return false;
      }
      return true;
    })
    .sort((a, b) => (b.scheduledDate || b.creationDate).localeCompare(a.scheduledDate || a.creationDate));

  // Build Unified Inventory (settings.products) matcher for Price Anomaly (#5) & Under-Compensations (#1)
  const normalizeArabicTokens = (rawText: string): string => {
    return toWesternDigits(rawText || '')
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[-_/\\.,+|()[\]{}]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  interface CatalogPriceEntry {
    id: string;
    name: string;
    sku: string;
    normName: string;
    tokens: string[];
    price: number;
  }
  const catalogEntries: CatalogPriceEntry[] = [];
  (Array.isArray(settings?.products) ? settings.products : []).forEach(prod => {
    const basePrice = Number(prod.price) || 0;
    const normName = normalizeArabicTokens(prod.name || '');
    if (normName && basePrice > 0) {
      const tokens = normName.split(' ').filter(t => t.length >= 2);
      catalogEntries.push({
        id: prod.id,
        name: prod.name,
        sku: String(prod.sku || '').trim().toLowerCase(),
        normName,
        tokens,
        price: basePrice
      });
    }
    if (prod.hasVariants && Array.isArray(prod.variants)) {
      prod.variants.forEach(v => {
        const vPrice = Number(v.price) || 0;
        const optSuffix = v.options ? Object.values(v.options).join(' ') : '';
        const combined = normalizeArabicTokens(`${prod.name || ''} ${optSuffix}`);
        if (combined && vPrice > 0 && combined !== normName) {
          catalogEntries.push({
            id: `${prod.id}_${v.id}`,
            name: optSuffix ? `${prod.name} (${optSuffix})` : prod.name,
            sku: String(v.sku || prod.sku || '').trim().toLowerCase(),
            normName: combined,
            tokens: combined.split(' ').filter(t => t.length >= 2),
            price: vPrice
          });
        }
      });
    }
  });

  const matchSingleSegmentToCatalog = (segmentRaw: string): { entry: CatalogPriceEntry; score: number } | null => {
    const cleaned = normalizeArabicTokens(segmentRaw.replace(/\b[x×*]\s*\d+\b/gi, ' '));
    if (!cleaned || catalogEntries.length === 0) return null;
    const segTokens = cleaned.split(' ').filter(t => t.length >= 2);
    let best: { entry: CatalogPriceEntry; score: number } | null = null;
    for (const entry of catalogEntries) {
      if (entry.sku && entry.sku.length >= 3 && cleaned.includes(entry.sku)) {
        return { entry, score: 1.0 };
      }
      if (cleaned === entry.normName) {
        return { entry, score: 1.0 };
      }
      if (cleaned.includes(entry.normName) || (entry.normName.length >= 5 && entry.normName.includes(cleaned))) {
        const sc = 0.92;
        if (!best || sc > best.score) best = { entry, score: sc };
        continue;
      }
      if (entry.tokens.length === 0 || segTokens.length === 0) continue;
      let hit = 0;
      for (const tok of entry.tokens) {
        if (segTokens.includes(tok)) hit += 1;
      }
      const recall = hit / entry.tokens.length;
      const precision = hit / segTokens.length;
      const f1 = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0;
      if (hit >= 2 && f1 >= 0.6) {
        if (!best || f1 > best.score) best = { entry, score: f1 };
      }
    }
    return best;
  };

  const matchUnifiedInventoryProduct = (
    pkgDesc?: string
  ): { productName: string; expectedBundlePrice: number; matchScore: number } | null => {
    if (!pkgDesc || pkgDesc === 'N/A' || catalogEntries.length === 0) return null;
    // Split multi-item Bosta descriptions like "Product A X 1 Product B X 2"
    const segRegex = /(.+?)\s*[x×*]\s*(\d+)/gi;
    const segs: Array<{ text: string; qty: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = segRegex.exec(pkgDesc)) !== null) {
      const txt = m[1].trim();
      const qty = Math.max(1, Number(m[2]) || 1);
      if (txt) segs.push({ text: txt, qty });
    }
    if (segs.length >= 2) {
      let sumPrice = 0;
      let allMatched = true;
      const names: string[] = [];
      let minScore = 1;
      for (const s of segs) {
        const hit = matchSingleSegmentToCatalog(s.text);
        if (!hit) {
          allMatched = false;
          break;
        }
        sumPrice += hit.entry.price * s.qty;
        names.push(s.qty > 1 ? `${hit.entry.name} ×${s.qty}` : hit.entry.name);
        minScore = Math.min(minScore, hit.score);
      }
      if (allMatched && sumPrice > 0) {
        return {
          productName: names.join(' + '),
          expectedBundlePrice: Math.round(sumPrice * 100) / 100,
          matchScore: minScore
        };
      }
    }
    const singleQtyMatch = pkgDesc.match(/[x×*]\s*(\d+)\s*$/i);
    const qty = singleQtyMatch ? Math.max(1, Number(singleQtyMatch[1]) || 1) : 1;
    const single = matchSingleSegmentToCatalog(pkgDesc);
    if (!single) return null;
    return {
      productName: qty > 1 ? `${single.entry.name} ×${qty}` : single.entry.name,
      expectedBundlePrice: Math.round(single.entry.price * qty * 100) / 100,
      matchScore: single.score
    };
  };

  // Build product median COD baseline from Deliveries Export & Cash Cycles to catch Under-Compensated Shipments & Product Price Drops
  const normalizeProdDescKey = (desc: string): string =>
    desc.trim().toLowerCase().replace(/\s+/g, ' ');
  const productCodSamples = new Map<string, number[]>();
  const addProductCodSample = (desc?: string, codVal?: number) => {
    if (!desc || desc === 'N/A' || !codVal || codVal <= 0) return;
    const k = normalizeProdDescKey(desc);
    const list = productCodSamples.get(k) || [];
    list.push(codVal);
    productCodSamples.set(k, list);
  };
  sheetRows.forEach(r => {
    if (r.category !== 'duplicate' && r.sheetGrossAmount > 0 && !r.sheetStatus.toLowerCase().includes('deleted')) {
      addProductCodSample(r.packageDescription, r.sheetGrossAmount);
    }
  });
  bostaOpMetaByKey.forEach(op => {
    if (op.codAmount > 0 && !op.deliveryState.toLowerCase().includes('deleted')) {
      addProductCodSample(op.packageDescription, op.codAmount);
    }
  });
  const productMedianCodMap = new Map<
    string,
    { medianCod: number; sampleCount: number; minCod: number; maxCod: number }
  >();
  productCodSamples.forEach((vals, key) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianCod =
      sorted.length % 2 === 1 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
    productMedianCodMap.set(key, {
      medianCod,
      sampleCount: sorted.length,
      minCod: sorted[0],
      maxCod: sorted[sorted.length - 1]
    });
  });

  const activeRateMatrix: BostaRateMatrix = zoneRates.rateMatrix || DEFAULT_BOSTA_RATE_MATRIX;

  const resolveBostaZoneId = (cityRaw: string): BostaZoneId | null => {
    const c = cityRaw.trim().toLowerCase();
    if (!c) return null;
    if (
      c.includes('sinai') ||
      c.includes('سيناء') ||
      c.includes('sharm') ||
      c.includes('شرم') ||
      c.includes('arish') ||
      c.includes('عريش') ||
      c.includes('new valley') ||
      c.includes('الوادي الجديد') ||
      c.includes('وادي الجديد')
    ) {
      return 'sinai_new_valley';
    }
    if (
      c.includes('north coast') ||
      c.includes('الساحل') ||
      c.includes('ساحل شمالي') ||
      c.includes('alamein') ||
      c.includes('العلمين')
    ) {
      return 'north_coast';
    }
    if (
      c.includes('qena') ||
      c.includes('قنا') ||
      c.includes('luxor') ||
      c.includes('أقصر') ||
      c.includes('اقصر') ||
      c.includes('aswan') ||
      c.includes('أسوان') ||
      c.includes('اسوان') ||
      c.includes('red sea') ||
      c.includes('البحر الأحمر') ||
      c.includes('بحر احمر') ||
      c.includes('hurghada') ||
      c.includes('غردقة') ||
      c.includes('matrouh') ||
      c.includes('مطروح')
    ) {
      return 'south_upper';
    }
    if (
      c.includes('fayoum') ||
      c.includes('فيوم') ||
      c.includes('beni suef') ||
      c.includes('bani suif') ||
      c.includes('بني سويف') ||
      c.includes('minya') ||
      c.includes('menya') ||
      c.includes('منيا') ||
      c.includes('assiut') ||
      c.includes('assuit') ||
      c.includes('asyut') ||
      c.includes('أسيوط') ||
      c.includes('اسيوط') ||
      c.includes('sohag') ||
      c.includes('سوهاج')
    ) {
      return 'north_upper';
    }
    if (
      c.includes('alex') ||
      c.includes('إسكندرية') ||
      c.includes('اسكندرية') ||
      c.includes('اسكندريه') ||
      c.includes('behira') ||
      c.includes('beheira') ||
      c.includes('بحيرة') ||
      c.includes('بحيره')
    ) {
      return 'alex_beheira';
    }
    if (
      c.includes('cairo') ||
      c.includes('giza') ||
      c.includes('قاهرة') ||
      c.includes('القاهرة') ||
      c.includes('جيزة') ||
      c.includes('الجيزة') ||
      c.includes('6th') ||
      c.includes('october') ||
      c.includes('أكتوبر') ||
      c.includes('helwan') ||
      c.includes('حلوان') ||
      c.includes('maadi') ||
      c.includes('nasr') ||
      c.includes('tagamo') ||
      c.includes('shobra') ||
      c.includes('شبرا')
    ) {
      return 'cairo_giza';
    }
    if (
      c.includes('dakahlia') ||
      c.includes('دقهلية') ||
      c.includes('منصورة') ||
      c.includes('kalioubia') ||
      c.includes('qalyubia') ||
      c.includes('قليوبية') ||
      c.includes('gharbia') ||
      c.includes('غربية') ||
      c.includes('kafr') ||
      c.includes('كفر الشيخ') ||
      c.includes('menoufia') ||
      c.includes('monufia') ||
      c.includes('منوفية') ||
      c.includes('sharqia') ||
      c.includes('sharkia') ||
      c.includes('شرقية') ||
      c.includes('damietta') ||
      c.includes('دمياط') ||
      c.includes('ismailia') ||
      c.includes('إسماعيلية') ||
      c.includes('اسماعيلية') ||
      c.includes('port said') ||
      c.includes('بورسعيد') ||
      c.includes('suez') ||
      c.includes('سويس')
    ) {
      return 'delta_canal';
    }
    return 'delta_canal';
  };

  const resolveBostaPackageSizeId = (sizeRaw: string): BostaPackageSizeId => {
    const s = sizeRaw.trim().toLowerCase();
    if (!s || s === 'normal' || s === 'small' || s === 'medium' || s.includes('صغير') || s.includes('متوسط')) {
      return 'normal';
    }
    if (s.includes('heavy') || s.includes('ضخم')) return 'heavy_bulky';
    if (s.includes('light bulky') || s.includes('bulky') || s.includes('شحنة كبيرة')) return 'light_bulky';
    if (s.includes('xxl') || s.includes('white bag') || s.includes('كيس أبيض')) return 'xxl';
    if (s.includes('x-large') || s.includes('xlarge') || s === 'xl' || s.includes('أكبر')) return 'xlarge';
    if (s.includes('large') || s === 'l' || s.includes('كبير')) return 'large';
    return 'normal';
  };

  // Evaluate Compensations automatically against Deliveries_Export return proof + Bosta tariff math!
  filteredCompensations.forEach(c => {
    const storeVal = c.matchedOrder ? Number(c.matchedOrder.totalPrice) || 0 : 0;
    const prodStats = c.packageDescription
      ? productMedianCodMap.get(normalizeProdDescKey(c.packageDescription))
      : undefined;
    const invMatch = matchUnifiedInventoryProduct(c.packageDescription);
    const opMeta = c.orderId && c.orderId !== '-' ? bostaOpMetaByKey.get(c.orderId) : undefined;
    const ccMeta = c.orderId && c.orderId !== '-' ? cashCyclesByKey.get(c.orderId) : undefined;

    const preVat = c.preVatEquivalent ?? Math.round((c.compensationAmount / 1.14) * 100) / 100;
    const zoneId = resolveBostaZoneId(c.dropoffCity);
    const sizeId = resolveBostaPackageSizeId(c.packageSize);
    const zoneRatesObj = zoneId ? activeRateMatrix[zoneId]?.[sizeId] : undefined;
    const expectedRtoBase = zoneRatesObj?.rto;
    const expectedSendBase = zoneRatesObj?.send;
    const zoneLabelAr = zoneId ? BOSTA_ZONE_META.find(z => z.id === zoneId)?.labelAr : undefined;

    // Auto-deduce WHY this compensation amount matches shipping + fees + VAT
    if (ccMeta && ccMeta.fees > 0 && Math.abs(c.compensationAmount - ccMeta.fees) <= 1.2) {
      c.shippingRefundBreakdownAr = `استرداد مطابق لإجمالي رسوم الشحنة في Cash Cycles (${ccMeta.fees.toLocaleString()} ج.م شاملة الضريبة)`;
    } else if (
      expectedRtoBase &&
      preVat >= expectedRtoBase - 2 &&
      preVat <= (expectedSendBase || expectedRtoBase) + 45
    ) {
      const extraFees = Math.round((preVat - expectedRtoBase) * 100) / 100;
      const cycleDates =
        opMeta?.pickedUpDate && opMeta?.deliveredAt
          ? ` · مسار الإرجاع: ${opMeta.pickedUpDate} → ${opMeta.deliveredAt}`
          : '';
      const flexTag = opMeta?.hasFlexShip ? ' · (طلب FlexShip)' : '';
      c.shippingRefundBreakdownAr = `استرداد مصاريف شحن المرتجع (${zoneLabelAr || c.dropoffCity || '-'}): ${preVat} ج.م قبل الضريبة = ${expectedRtoBase} شحن RTO${
        extraFees > 0.5 ? ` + ${extraFees} تأمين/فتح شحنة` : ''
      } (+14% ض = ${c.compensationAmount.toLocaleString()} ج.م)${flexTag}${cycleDates}`;
    } else if (opMeta?.exceptionReason) {
      c.shippingRefundBreakdownAr = `تعويض بـ ${preVat} ج.م قبل الضريبة (+14% ض = ${c.compensationAmount.toLocaleString()} ج.م) — ${opMeta.exceptionReason}`;
    }

    const expectedVal = Math.max(
      storeVal,
      opMeta?.codAmount || 0,
      prodStats?.medianCod || 0,
      invMatch?.expectedBundlePrice || 0
    );

    const stLow = (c.orderStatus || '').trim().toLowerCase();
    const isLostOrTerminatedStatus =
      stLow === '60' ||
      stLow === '48' ||
      stLow === '47' ||
      stLow.includes('lost') ||
      stLow.includes('damag') ||
      stLow.includes('terminat');
    const isRtoStatus46 =
      !isLostOrTerminatedStatus &&
      (stLow === '46' || stLow.includes('rto') || stLow.includes('return') || c.orderType.toUpperCase() === 'RTO');

    const opDelLow = (opMeta?.deliveryState || '').toLowerCase();
    const opReturnedToOriginConfirmed = Boolean(
      opMeta &&
        (opDelLow.includes('returned to origin') || opDelLow.includes('returned to business')) &&
        (opMeta.returnAttemptsCount > 0 || Boolean(opMeta.deliveredAt))
    );

    if (opMeta) {
      c.deliveriesReturnConfirmed = opReturnedToOriginConfirmed;
      c.deliveriesState = opMeta.deliveryState;
      c.deliveriesReturnedAt = opMeta.deliveredAt || opMeta.updatedAt || undefined;
      c.deliveriesReturnAttempts = opMeta.returnAttemptsCount;
      c.deliveriesCurrentHub = opMeta.currentHub || undefined;
    }

    if (expectedVal > 0) {
      c.expectedProductValue = expectedVal;
    }

    const looksLikeShippingRefundOnly =
      c.compensationAmount > 0 &&
      ((expectedVal >= 200 && c.compensationAmount < expectedVal * 0.45) ||
        (expectedVal < 200 && Boolean(c.shippingRefundBreakdownAr) && c.compensationAmount <= 260));

    if (looksLikeShippingRefundOnly) {
      const shortfall = expectedVal >= 200 ? Math.round((expectedVal - c.compensationAmount) * 100) / 100 : 0;

      if (opReturnedToOriginConfirmed && !isLostOrTerminatedStatus) {
        // PROVEN IN DELIVERIES_EXPORT: Product returned to merchant's warehouse + Bosta refunded RTO shipping fees!
        c.compAuditVerdict = 'returned_to_warehouse_shipping_refund';
        c.isUnderCompensated = false;
        c.shortfallAmount = 0;
        const retDate = c.deliveriesReturnedAt || c.confirmedAt || c.completedAt || '-';
        c.underCompReasonAr = `تأكد أوتوماتيكياً من Deliveries Export: المنتج رجع لمخزنك (${opMeta!.deliveryState} بتاريخ ${retDate} · ${Math.max(1, opMeta!.returnAttemptsCount)} محاولة إرجاع${opMeta!.currentHub ? ` — ${opMeta!.currentHub}` : ''})، والتعويض (+${c.compensationAmount.toLocaleString()} ج.م) هو استرداد مصاريف الشحن فقط — حسابك سليم ✅`;
      } else if (!opMeta && isRtoStatus46 && Boolean(c.confirmedAt || c.completedAt)) {
        // Older than uploaded Deliveries_Export window, but Compensations itself marks Status = 46 (RTO) & amount = shipping refund!
        c.compAuditVerdict = 'rto_status_shipping_refund_outside_deliveries';
        c.isUnderCompensated = false;
        c.shortfallAmount = shortfall;
        const valueNote = expectedVal >= 200 ? ` (قيمتها ${expectedVal.toLocaleString()} ج.م)` : '';
        c.underCompReasonAr = `مسجل بشيت التعويضات كـ مرتجع للراسل RTO (46) بتاريخ اكتمال (${c.completedAt || c.confirmedAt}) وتعويض يطابق مصاريف الشحن فقط (+${c.compensationAmount.toLocaleString()} ج.م) — لكن البوليصة أقدم من شيت Deliveries المرفوع؛ ارفع Deliveries أقدم أو تأكد من دخول "${c.packageDescription || 'المنتج'}" المخزن${valueNote}.`;
      } else if (expectedVal >= 200) {
        // TRUE UNDER-COMPENSATION: Status 60 (Lost/Damaged), Terminated, or Deliveries shows NOT returned to warehouse!
        c.compAuditVerdict = 'true_under_compensated';
        c.isUnderCompensated = true;
        c.shortfallAmount = shortfall;
        const sourceTxt =
          invMatch && invMatch.expectedBundlePrice >= expectedVal
            ? `المخزون الموحد (${invMatch.productName})`
            : 'متوسط/سعر الشيت';
        const opProofGap = opMeta
          ? ` وحالة Deliveries: (${opMeta.deliveryState}${opMeta.currentHub ? ` في ${opMeta.currentHub}` : ''} · محاولات الإرجاع: ${opMeta.returnAttemptsCount}) — لم يرجع لمخزنك!`
          : ` وكود الحالة بالشيت (${c.orderStatusLabel}) يثبت عدم تمام الإرجاع!`;
        c.underCompReasonAr = `تعويض جزئي/رسوم شحن فقط (+${c.compensationAmount.toLocaleString()} ج.م ≈ ${preVat} ج.م قبل الضريبة) بينما قيمة "${
          c.packageDescription || 'المنتج'
        }" حسب ${sourceTxt} = ${expectedVal.toLocaleString()} ج.م.${opProofGap} طالب بباقي القيمة (${shortfall.toLocaleString()} ج.م)!`;
      } else {
        c.compAuditVerdict = 'valid_or_full_compensation';
      }
    } else {
      c.compAuditVerdict = 'valid_or_full_compensation';
    }
  });

  // Audit Cash Wallet Compensations & Positive Adjustments inside Transactions (Dual-Wallet Coverage)
  const walletCompensations: WalletCompensationAuditEntry[] = [];
  const matchedCompRowIds = new Set<string>();
  ledgerRows.forEach(tx => {
    const catLow = tx.category.toLowerCase();
    const isWalletComp = catLow.includes('compensation');
    const isPackingRefund =
      catLow.includes('packaging material refund') || catLow.includes('packing material refund');
    const isPosAdj = catLow.includes('balance adjustment') && tx.amount > 0;
    if (!isWalletComp && !isPackingRefund && !isPosAdj) return;

    const preVat = Math.round((Math.abs(tx.amount) / 1.14) * 100) / 100;
    const compMatch = isWalletComp
      ? rawCompensations.find(
          c =>
            !matchedCompRowIds.has(c.id) &&
            Math.abs(c.compensationAmount - tx.amount) <= 0.5 &&
            (!tx.cashoutId || !c.cashoutId || tx.cashoutId === c.cashoutId)
        )
      : undefined;
    if (compMatch) matchedCompRowIds.add(compMatch.id);

    const isSuspectedShippingOnlyRefund =
      isWalletComp &&
      tx.amount > 0 &&
      tx.amount <= 260 &&
      compMatch?.compAuditVerdict !== 'returned_to_warehouse_shipping_refund';

    let auditStatus: WalletCompensationAuditEntry['auditStatus'] = 'undocumented_in_comp_sheet';
    let inferredNoteAr = '';
    if (isPackingRefund) {
      auditStatus = 'packing_refund';
      inferredNoteAr = `استرداد تكلفة مستلزمات تغليف إلى المحفظة النقدية (+${tx.amount.toLocaleString()} ج.م)`;
    } else if (isPosAdj) {
      auditStatus = 'balance_adjustment';
      inferredNoteAr = `تسوية رصيد موجبة بالمحفظة (+${tx.amount.toLocaleString()} ج.م)`;
    } else if (compMatch) {
      auditStatus = 'documented_in_comp_sheet';
      if (compMatch.compAuditVerdict === 'returned_to_warehouse_shipping_refund') {
        inferredNoteAr = `موثق (بوليصة ${compMatch.orderId}) — رجع لمخزنك بتأكيد Deliveries (${compMatch.deliveriesReturnedAt || 'Returned to origin'}) + استرداد مصاريف الشحن ✅`;
      } else if (compMatch.compAuditVerdict === 'rto_status_shipping_refund_outside_deliveries') {
        inferredNoteAr = `موثق كـ RTO 46 (بوليصة ${compMatch.orderId}) — استرداد مصاريف شحن (خارج مدى Deliveries المرفوع، تأكد من وجود المنتج بالمخزن)`;
      } else if (compMatch.isUnderCompensated) {
        inferredNoteAr = `موثق في جدول التعويضات (بوليصة ${compMatch.orderId}) — تنبيه: تعويض رسوم شحن فقط لبضاعة لم ترجع للمخزن!`;
      } else {
        inferredNoteAr = `موثق ومطابق لبوليصة #${compMatch.orderId} في جدول Compensations (${compMatch.customerName || '-'})`;
      }
    } else {
      auditStatus = 'undocumented_in_comp_sheet';
      inferredNoteAr = isSuspectedShippingOnlyRefund
        ? `تعويض نزل بالمحفظة النقدية (${preVat} ج.م قبل 14% ض.ق.م) بدون صف مقابل في جدول Compensations المرفوع — راجع هل هو رد رسوم شحن أم تعويض مفقود منقوص`
        : `تعويض نزل بالمحفظة النقدية (${preVat} ج.م قبل الضريبة) ولم يظهر في جدول Compensations المرفوع`;
    }

    walletCompensations.push({
      id: `wcomp_${tx.transactionId}_${tx.rowIndex}`,
      transactionId: tx.transactionId,
      date: tx.date,
      category: tx.category,
      categoryAr: tx.categoryAr,
      amount: tx.amount,
      preVatEquivalent: preVat,
      cashoutId: tx.cashoutId,
      cashoutDate: tx.cashoutDate,
      matchedCompensationOrderId: compMatch?.orderId,
      matchedCompensationId: compMatch?.compensationId,
      matchedCustomerName: compMatch?.matchedOrder?.customerName || compMatch?.customerName,
      matchedProduct: compMatch?.packageDescription,
      auditStatus,
      isSuspectedShippingOnlyRefund,
      inferredNoteAr
    });
  });

  const undocumentedWalletComps = walletCompensations.filter(
    w => w.auditStatus === 'undocumented_in_comp_sheet'
  );
  transactionsSummary.walletCompensations = walletCompensations;
  transactionsSummary.undocumentedWalletCompCount = undocumentedWalletComps.length;
  transactionsSummary.undocumentedWalletCompAmount =
    Math.round(undocumentedWalletComps.reduce((s, w) => s + w.amount, 0) * 100) / 100;

  const underCompensatedRows = filteredCompensations.filter(c => c.isUnderCompensated);
  const returnedRtoShippingRefundCount = filteredCompensations.filter(
    c => c.compAuditVerdict === 'returned_to_warehouse_shipping_refund'
  ).length;
  const outsideDeliveriesRtoCount = filteredCompensations.filter(
    c => c.compAuditVerdict === 'rto_status_shipping_refund_outside_deliveries'
  ).length;
  const compensationsSummary: CompensationsAuditSummary = {
    hasCompensationsSheet: compensationFiles.length > 0,
    totalCompensatedAmount:
      Math.round(filteredCompensations.reduce((s, c) => s + c.compensationAmount, 0) * 100) / 100,
    paidOutCompensationAmount:
      Math.round(
        filteredCompensations
          .filter(c => c.isPaidOut)
          .reduce((s, c) => s + c.compensationAmount, 0) * 100
      ) / 100,
    pendingCompensationAmount:
      Math.round(
        filteredCompensations
          .filter(c => !c.isPaidOut)
          .reduce((s, c) => s + c.compensationAmount, 0) * 100
      ) / 100,
    underCompensatedCount: underCompensatedRows.length,
    underCompensatedShortfallAmount:
      Math.round(underCompensatedRows.reduce((s, c) => s + (c.shortfallAmount || 0), 0) * 100) / 100,
    returnedRtoShippingRefundCount,
    outsideDeliveriesRtoCount,
    entries: filteredCompensations
  };

  const wrongfulPickupFeeEntries = pickupFeeAudits.filter(a => a.verdict === 'wrongful_deduction');
  const wrongfulPickupFeeAmount =
    Math.round(wrongfulPickupFeeEntries.reduce((s, a) => s + a.overchargeAmount, 0) * 100) / 100;

  const crossBrandSwappedReturnsCount = Array.from(
    new Set(
      filteredCrossBrandSwaps.flatMap(s => s.affectedReturnedShipments.map(it => it.trackingKey))
    )
  ).length;

  const pickupRequestsSummary: PickupRequestsAuditSummary = {
    hasPickupSheet: pickupFiles.length > 0,
    businessTier: filteredPickups.find(p => p.businessTier)?.businessTier,
    totalPickups: filteredPickups.length,
    pickedUpRequestsCount: filteredPickups.filter(p => !p.status.toLowerCase().includes('cancel')).length,
    canceledRequestsCount: filteredPickups.filter(p => p.status.toLowerCase().includes('cancel')).length,
    totalPickedUpParcels: filteredPickups.reduce((s, p) => s + p.pickedUpCount, 0),
    totalReceivedParcels: filteredPickups.reduce((s, p) => s + (p.receivedCount ?? p.pickedUpCount), 0),
    varianceGapCount: filteredPickups.filter(
      p => p.alertFlag === 'variance_gap' || p.alertFlag === 'pending_hub_receipt'
    ).length,
    confirmedByBusinessMismatchCount: filteredPickups.filter(
      p => (p.variancePickedVsConfirmed || 0) > 0
    ).length,
    rescheduledOrDelayedCount: filteredPickups.filter(p => p.isRescheduledOrDelayed).length,
    smallPickupCount: filteredPickups.filter(p => p.isSmallPickupFeeRisk).length,
    wrongfulPickupFeeCount: wrongfulPickupFeeEntries.length,
    wrongfulPickupFeeAmount,
    crossBrandSwapCount: filteredCrossBrandSwaps.length,
    crossBrandSwappedReturnsCount,
    crossBrandSwaps: filteredCrossBrandSwaps,
    entries: filteredPickups
  };

  // Bosta Credits Sheet (Customer Care Vouchers, Packaging Material Payments, Credit Balance)
  const translateCreditCategory = (cat: string): string => {
    const low = cat.trim().toLowerCase();
    if (low.includes('customer care voucher') || low.includes('voucher')) {
      return 'قسيمة رصيد / تعويض دعم (Voucher)';
    }
    if (low.includes('packaging material payment') || low.includes('packing material payment')) {
      return 'سداد خامات تغليف من الرصيد';
    }
    if (low.includes('packaging material refund') || low.includes('packing material refund')) {
      return 'استرداد خامات تغليف للرصيد';
    }
    if (low.includes('promo') || low.includes('bonus')) {
      return 'رصيد ترويجي / هدية';
    }
    if (low.includes('refund')) return 'استرداد للرصيد';
    return cat || 'حركة رصيد بوسطة';
  };

  const creditEntries: BostaCreditEntry[] = [];
  const seenCreditKeys = new Set<string>();
  let currentCreditsBalance: number | null = null;
  let totalAddedCredits = 0;
  let totalSpentCredits = 0;
  let voucherCreditsAmount = 0;
  let packagingPaymentsAmount = 0;

  creditsFiles.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const txId = normalizeTrackingCode(
        pickCell(raw, undefined, ['transaction_id', 'transactions id', 'transaction id'])
      );
      const businessId = String(pickCell(raw, undefined, ['business_id', 'business id']) || '').trim();
      const trackingNumberFromSheet = normalizeTrackingCode(
        pickCell(raw, undefined, ['tracking_number', 'tracking number', 'order id'])
      );
      const manualTracking = txId ? normalizeTrackingCode(manualCreditTrackingMap[txId]) : '';
      const trackingNumber = trackingNumberFromSheet || manualTracking;
      const manualBoundTracking = Boolean(!trackingNumberFromSheet && manualTracking);
      const amt = parseNumericCell(pickCell(raw, undefined, ['amount', 'credit amount']));
      const balCell = pickCell(raw, undefined, ['balance']);
      const bal = balCell !== '' && balCell !== undefined ? parseNumericCell(balCell) : null;
      const dateStr = formatSheetDateCell(
        pickCell(raw, undefined, ['created_at', 'created at', 'date'])
      );
      const cat = String(pickCell(raw, undefined, ['category']) || '').trim();
      const subCat = String(pickCell(raw, undefined, ['sub_category', 'sub category']) || '').trim();

      if (!txId && !cat && amt === 0 && bal === null) return;
      const dedupeKey = txId ? `${txId}|${amt}|${dateStr}` : `${file.fileName}_${entry.rowIndex}`;
      if (seenCreditKeys.has(dedupeKey)) return;
      seenCreditKeys.add(dedupeKey);

      if (currentCreditsBalance === null && bal !== null) {
        currentCreditsBalance = bal;
      }
      if (amt > 0) totalAddedCredits += amt;
      else if (amt < 0) totalSpentCredits += Math.abs(amt);

      const catLow = cat.toLowerCase();
      if (catLow.includes('voucher')) {
        voucherCreditsAmount += amt;
      } else if (catLow.includes('packaging') || catLow.includes('packing')) {
        packagingPaymentsAmount += Math.abs(amt);
      }

      const preVatEq = amt > 0 ? Math.round((amt / 1.14) * 100) / 100 : undefined;
      let inferredReasonAr = '';
      if (amt > 0) {
        if (Math.abs(amt - 102.6) <= 0.15) {
          inferredReasonAr =
            'تعويض فرق حجم شحنة كبيرة (Light Bulky) بدل عادي/كبير (90 ج.م شحن + 14% ض.ق.م = 102.60 ج.م)';
        } else if (Math.abs(amt - 85.5) <= 0.15) {
          inferredReasonAr =
            'تعويض فرق حجم شحنة كبيرة (Light Bulky) بدل كيس أبيض XXL (75 ج.م شحن + 14% ض.ق.م = 85.50 ج.م)';
        } else if (Math.abs(amt - 17.1) <= 0.15) {
          inferredReasonAr =
            'تعويض فرق حجم كيس أبيض (XXL) بدل حجم عادي/كبير (15 ج.م شحن + 14% ض.ق.م = 17.10 ج.م)';
        } else if (Math.abs(amt - 15.96) <= 0.15) {
          inferredReasonAr =
            'تعويض فرق منطقة شحن — دلتا 91 ج.م بدل القاهرة 77 ج.م (14 ج.م + 14% ض.ق.م = 15.96 ج.م)';
        } else if (Math.abs(amt - 7.98) <= 0.15) {
          inferredReasonAr =
            'استرداد رسوم فتح/فحص شحنة (7 ج.م + 14% ض.ق.م = 7.98 ج.م)';
        } else if (Math.abs(amt - 70) <= 0.15 || Math.abs(amt - 79.8) <= 0.15) {
          inferredReasonAr = 'استرداد رسوم بيك أب مخصومة بالخطأ (70 ج.م)';
        } else {
          inferredReasonAr = `تعويض دعم فني (${preVatEq} ج.م قبل الضريبة + 14% ض.ق.م)`;
        }
      } else if (amt < 0) {
        inferredReasonAr = trackingNumber
          ? `خصم سداد خامات تغليف (بوليصة #${trackingNumber})`
          : 'خصم من رصيد محفظة النقاط';
      }

      const opForCredit = trackingNumber ? bostaOpMetaByKey.get(trackingNumber) : undefined;

      creditEntries.push({
        id: `${file.id}_cr_${entry.rowIndex}`,
        fileName: file.fileName,
        rowIndex: entry.rowIndex,
        businessId: businessId || undefined,
        transactionId: txId || `#${entry.rowIndex}`,
        trackingNumber: trackingNumber || undefined,
        manualBoundTracking: manualBoundTracking || undefined,
        date: dateStr,
        category: cat,
        categoryAr: translateCreditCategory(cat),
        subCategory: subCat || undefined,
        amount: amt,
        balance: bal,
        preVatEquivalent: preVatEq,
        inferredReasonAr: inferredReasonAr || undefined,
        matchStatus: amt < 0 ? 'spent_deduction' : 'surplus_unmatched_voucher',
        matchedAnomalyTrackingKey: trackingNumber || undefined,
        matchedAnomalyCustomerName: opForCredit?.customerName || undefined,
        matchedAnomalyProduct: opForCredit?.packageDescription || undefined,
        matchedAnomalyZone: opForCredit?.dropoffCity || undefined,
        matchedAnomalyDate: opForCredit?.deliveredAt || opForCredit?.updatedAt || opForCredit?.pickedUpDate || undefined,
        matchedAnomalyState: opForCredit?.deliveryState || undefined
      });
    });
  });

  // Verify Bosta Credits wallet balance continuity using before/after multiset conservation
  const creditsWithBal = creditEntries.filter(r => r.balance !== null);
  let creditsIntegrityStatus: BostaCreditsAuditSummary['walletIntegrityStatus'] = 'single_or_empty';
  if (creditsWithBal.length >= 2) {
    const crAfterPool = new Map<number, number>();
    creditsWithBal.forEach(r => {
      const k = Math.round((r.balance as number) * 100);
      crAfterPool.set(k, (crAfterPool.get(k) || 0) + 1);
    });
    let crUnmatchedBefore = 0;
    creditsWithBal.forEach(r => {
      const expBefore = Math.round(((r.balance as number) - r.amount) * 100);
      let found = false;
      for (let d = 0; d <= 5; d++) {
        const kPlus = expBefore + d;
        const kMinus = expBefore - d;
        if ((crAfterPool.get(kPlus) || 0) > 0) {
          crAfterPool.set(kPlus, (crAfterPool.get(kPlus) || 1) - 1);
          found = true;
          break;
        }
        if (d > 0 && (crAfterPool.get(kMinus) || 0) > 0) {
          crAfterPool.set(kMinus, (crAfterPool.get(kMinus) || 1) - 1);
          found = true;
          break;
        }
      }
      if (!found) crUnmatchedBefore += 1;
    });
    creditsIntegrityStatus = crUnmatchedBefore <= 1 ? 'verified' : 'mismatch_found';
  }

  const matchedReady = filteredSheetRows.filter(r => r.category === 'matched_ready');
  const collectedUntransferred = filteredSheetRows.filter(
    r => r.category === 'collected_untransferred'
  );
  const notCollectedCustomer = filteredSheetRows.filter(
    r => r.category === 'not_collected_customer'
  );
  const inTransitInSheet = filteredSheetRows.filter(
    r => r.category === 'in_transit_sheet'
  );
  const shortPaid = filteredSheetRows.filter(r => r.category === 'short_paid');
  const overPaid = filteredSheetRows.filter(r => r.category === 'over_paid');
  const duplicates = filteredSheetRows.filter(r => r.category === 'duplicate');
  const notFound = filteredSheetRows.filter(r => r.category === 'not_found');

  // --- 4 Advanced Leak Hunters ---
  const compensatedOrderIdSet = new Set<string>();
  rawCompensations.forEach(c => {
    if (c.orderId && c.orderId !== '-') compensatedOrderIdSet.add(c.orderId);
    if (c.orderReference) compensatedOrderIdSet.add(c.orderReference);
  });

  const missingCompensationsRaw: MissingCompensationAlert[] = [];
  const seenMissingCompKeys = new Set<string>();
  const isLostOrDamagedText = (st: string, exc = '') => {
    const low = `${st} ${exc}`.toLowerCase();
    return (
      low.includes('lost') ||
      low.includes('damage') ||
      low.includes('stolen') ||
      low.includes('destroy') ||
      low.includes('missing') ||
      low.includes('مفقود') ||
      low.includes('تالف') ||
      low.includes('فقد') ||
      low.includes('تلف')
    );
  };

  sheetRows.forEach(r => {
    if (r.category === 'duplicate') return;
    if (seenMissingCompKeys.has(r.trackingKey)) return;
    const op = bostaOpMetaByKey.get(r.trackingKey);
    const lostByStatus = isLostOrDamagedText(r.sheetStatus, r.exceptionReason || op?.exceptionReason);
    const terminatedAfterPickup =
      r.sheetStatus.toLowerCase().includes('terminat') && Boolean(op?.pickedUpDate);
    if (!lostByStatus && !terminatedAfterPickup) return;
    if (compensatedOrderIdSet.has(r.trackingKey) || (r.businessRefKey && compensatedOrderIdSet.has(r.businessRefKey))) {
      return;
    }
    seenMissingCompKeys.add(r.trackingKey);
    const estVal =
      r.sheetGrossAmount > 0
        ? r.sheetGrossAmount
        : r.expectation?.expectedGrossCod || op?.codAmount || 0;
    missingCompensationsRaw.push({
      id: `mcomp_${r.trackingKey}`,
      trackingKey: r.trackingKey,
      orderNumber: r.matchedOrder?.orderNumber || r.businessRefKey,
      customerName: r.matchedOrder?.customerName || r.customerName || op?.customerName,
      customerPhone: r.phoneRaw || r.matchedOrder?.customerPhone || op?.phoneRaw,
      brandName: r.brandName || op?.brandName,
      dropoffCity: r.dropoffCity || op?.dropoffCity,
      packageDescription: r.packageDescription || op?.packageDescription,
      sheetStatus: r.sheetStatus,
      exceptionReason: r.exceptionReason || op?.exceptionReason,
      sheetDate: r.sheetDate || r.sheetDeliveredAt || op?.updatedAt,
      estimatedValue: Math.round(estVal * 100) / 100,
      matchedOrder: r.matchedOrder,
      reasonSummary: lostByStatus
        ? `الشحنة حالتها (${r.sheetStatus}) ولم يظهر لها أي تعويض في شيت التعويضات`
        : `شحنة منتهية (Terminated) بعد الاستلام من الراسل بدون تعويض مسجل`
    });
  });
  bostaOpMetaByKey.forEach(op => {
    if (seenMissingCompKeys.has(op.trackingKey)) return;
    const lostByStatus = isLostOrDamagedText(op.deliveryState, op.exceptionReason);
    const terminatedAfterPickup =
      op.deliveryState.toLowerCase().includes('terminat') && Boolean(op.pickedUpDate);
    if (!lostByStatus && !terminatedAfterPickup) return;
    if (compensatedOrderIdSet.has(op.trackingKey) || (op.businessRefKey && compensatedOrderIdSet.has(op.businessRefKey))) {
      return;
    }
    seenMissingCompKeys.add(op.trackingKey);
    const matchedOrder =
      (matchWithStoreOrders && (waybillMap.get(op.trackingKey) || orderNumberMap.get(op.trackingKey))) || null;
    const exp = matchedOrder ? expectationsByOrderId.get(matchedOrder.id) : undefined;
    missingCompensationsRaw.push({
      id: `mcomp_op_${op.trackingKey}`,
      trackingKey: op.trackingKey,
      orderNumber: matchedOrder?.orderNumber || op.businessRefKey,
      customerName: matchedOrder?.customerName || op.customerName,
      customerPhone: op.phoneRaw || matchedOrder?.customerPhone,
      brandName: op.brandName,
      dropoffCity: op.dropoffCity,
      packageDescription: op.packageDescription,
      sheetStatus: op.deliveryState,
      exceptionReason: op.exceptionReason,
      sheetDate: op.updatedAt || op.pickedUpDate,
      estimatedValue: Math.round((op.codAmount || exp?.expectedGrossCod || 0) * 100) / 100,
      matchedOrder,
      reasonSummary: lostByStatus
        ? `الشحنة في شيت الأوردرات بحالة (${op.deliveryState}) بدون تعويض`
        : `تم استلام الشحنة ثم أُغلقت (${op.deliveryState}) بدون إدراجها في جدول التعويضات`
    });
  });

  // Also flag Severely Under-Compensated Shipments (e.g. paid shipping-only refund instead of product value) inside Missing Compensations!
  underCompensatedRows.forEach(c => {
    if (!c.orderId || c.orderId === '-' || seenMissingCompKeys.has(`ucomp_${c.orderId}`)) return;
    seenMissingCompKeys.add(`ucomp_${c.orderId}`);
    missingCompensationsRaw.push({
      id: `mcomp_under_${c.orderId}_${c.compensationId}`,
      alertKind: 'under_compensated',
      trackingKey: c.orderId,
      orderNumber: c.matchedOrder?.orderNumber || c.orderReference,
      customerName: c.matchedOrder?.customerName || c.customerName,
      customerPhone: c.customerPhone || c.matchedOrder?.customerPhone,
      brandName: c.brandName,
      dropoffCity: c.dropoffCity,
      packageDescription: c.packageDescription,
      sheetStatus: `تعويض منقوص (+${c.compensationAmount} من ${c.expectedProductValue?.toLocaleString() || '-'})`,
      exceptionReason: `تعويض #${c.compensationId} (${c.orderStatusLabel})`,
      sheetDate: c.compensationDate,
      estimatedValue: c.shortfallAmount || 0,
      paidCompensationAmount: c.compensationAmount,
      matchedOrder: c.matchedOrder,
      reasonSummary: c.underCompReasonAr || `تعويض منقوص بقيمة ${c.compensationAmount} ج.م فقط`
    });
  });

  // Fee & Overweight Auditor (with Exact 7-Zone x 6-Size x 5-DeliveryType Bosta Rate Matrix + Size Inflation Detector + Hidden Surcharges + Cash Cycles Math Audit) + Online/FlexShip Auditor
  const feeAnomaliesRaw: FeeAnomalyAlert[] = [];
  const onlineFlexRaw: OnlineFlexAuditRow[] = [];
  const seenFeeKeys = new Set<string>();
  const seenOnlineFlexKeys = new Set<string>();
  const safeMaxFee = Math.max(20, Number(maxExpectedShippingFee) || 110);


  const resolveBostaServiceTypeId = (orderTypeRaw: string, statusRaw: string): BostaServiceTypeId => {
    const t = orderTypeRaw.trim().toLowerCase();
    const isRet = isReturnedOrUncollectedStatus(statusRaw);
    if (t.includes('cash') || t.includes('تحصيل')) return 'cash_collection';
    if (t.includes('return') || t.includes('crp') || t.includes('إرجاع')) return 'customer_return_pickup';
    if (t.includes('exchange') || t.includes('pick_and_choose') || t.includes('تبديل')) {
      return isRet ? 'rto' : 'exchange';
    }
    if (t === 'rto') return 'rto';
    return isRet ? 'rto' : 'send';
  };

  // Pre-scan Cash Cycles by normalized Package Description to detect when the exact same product
  // is normally shipped as Normal/Large/X-Large (tier 0) but inflated to Light Bulky / Heavy Bulky / XXL on specific orders!
  const normalizeDescKey = (desc: string): string =>
    desc
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const sizeTierRank = (sizeId: BostaPackageSizeId): number => {
    if (sizeId === 'normal' || sizeId === 'large' || sizeId === 'xlarge') return 0; // Same base price in Bosta!
    if (sizeId === 'xxl') return 1;
    if (sizeId === 'light_bulky') return 2;
    return 3; // heavy_bulky
  };

  const descSizeCounts = new Map<
    string,
    { totalCount: number; standardTierCount: number; dominantStandardLabel: string }
  >();
  cashCycleFiles.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const desc = String(pickCell(raw, undefined, ['package description', 'description']) || '').trim();
      const pkgSize = String(pickCell(raw, undefined, ['package size']) || '').trim();
      if (!desc || desc === 'N/A' || !pkgSize) return;
      const dKey = normalizeDescKey(desc);
      const sizeId = resolveBostaPackageSizeId(pkgSize);
      const cur = descSizeCounts.get(dKey) || {
        totalCount: 0,
        standardTierCount: 0,
        dominantStandardLabel: 'Normal / L / XL'
      };
      cur.totalCount += 1;
      if (sizeTierRank(sizeId) === 0) {
        cur.standardTierCount += 1;
        cur.dominantStandardLabel = pkgSize;
      }
      descSizeCounts.set(dKey, cur);
    });
  });

  cashCycleFiles.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const tKey = normalizeTrackingCode(
        pickCell(raw, mapping.trackingCol, ['order id', 'tracking number', 'tracking'])
      );
      if (!tKey) return;
      const pkgSize = String(pickCell(raw, undefined, ['package size']) || '').trim();
      const pkgDesc = String(pickCell(raw, undefined, ['package description', 'description']) || '').trim();
      const orderTypeRaw = String(pickCell(raw, undefined, ['order type', 'type']) || 'SEND').trim();
      const dropoffCity = String(pickCell(raw, undefined, ['dropoff city', 'drop off city']) || '').trim();
      const st = String(pickCell(raw, mapping.statusCol, ['order status', 'status']) || '').trim();
      const cod = parseNumericCell(pickCell(raw, mapping.grossAmountCol, ['cod', 'cod amount']));
      const onlineAmt = parseNumericCell(pickCell(raw, undefined, ['online payment amount']));
      const depositAmt = parseNumericCell(pickCell(raw, undefined, ['deposit amount']));
      const shippingFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['shipping fees'])));
      const insuranceFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['insurance fees'])));
      const openingFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['opening package fees'])));
      const testingFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['testing package fees'])));
      const collectionFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['collection fees'])));
      const nextDayFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['next day transfer fees'])));
      const posFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['pos fees'])));
      const codFeesCell = Math.abs(parseNumericCell(pickCell(raw, undefined, ['cod fees'])));
      const fulfillmentFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['fulfillment fees'])));
      const vat = Math.abs(parseNumericCell(pickCell(raw, undefined, ['vat'])));
      const flexAmt = parseNumericCell(pickCell(raw, undefined, ['flex ship amount']));
      const flexFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['flex ship fees'])));
      const zeroCodDiscountVal = Math.abs(parseNumericCell(pickCell(raw, undefined, ['0 cod discount'])));
      const discountsCredits =
        parseNumericCell(pickCell(raw, undefined, ['0 cod discount'])) +
        parseNumericCell(pickCell(raw, undefined, ['promotion discount'])) +
        parseNumericCell(pickCell(raw, undefined, ['bosta credits'])) +
        parseNumericCell(pickCell(raw, undefined, ['bundle discount']));
      const totalFees = Math.abs(parseNumericCell(pickCell(raw, mapping.feesAmountCol, ['total fees', 'fees'])));
      const netVal = parseNumericCell(pickCell(raw, mapping.netAmountCol, ['net value', 'net payout', 'net']));
      const payStatus = String(pickCell(raw, mapping.paymentStatusCol, ['payment status'], ['flex']) || '').trim();
      const cashoutId = normalizeTrackingCode(pickCell(raw, mapping.cashoutIdCol, ['cash-out id', 'cashout id']));
      const brandName = String(pickCell(raw, undefined, ['business name', 'brand name']) || '').trim();
      const customerName = String(pickCell(raw, undefined, ['customer name', 'consignee name']) || '').trim();
      const phoneRaw = normalizePhoneKey(pickCell(raw, mapping.phoneCol, ['customer phone', 'consignee phone', 'phone']));
      const op = bostaOpMetaByKey.get(tKey);
      const matchedOrder =
        (matchWithStoreOrders && (waybillMap.get(tKey) || orderNumberMap.get(tKey))) || null;
      const exp = matchedOrder ? expectationsByOrderId.get(matchedOrder.id) : undefined;

      if (!seenFeeKeys.has(tKey)) {
        seenFeeKeys.add(tKey);
        const tags: string[] = [];
        const isRet = isReturnedOrUncollectedStatus(st);
        const isDeliveredRow = isExplicitDeliveredStatus(st);
        const typeLow = (orderTypeRaw || op?.sheetType || 'SEND').toLowerCase();
        const isReplacementOrCrpType =
          typeLow.includes('exchange') || typeLow.includes('compensat') || typeLow.includes('return') || typeLow.includes('crp');
        const effectiveCity = dropoffCity || op?.dropoffCity || '';
        const zoneId = resolveBostaZoneId(effectiveCity);
        const sizeId = resolveBostaPackageSizeId(pkgSize);
        const serviceId = resolveBostaServiceTypeId(orderTypeRaw || op?.sheetType || 'SEND', st);

        const zoneMeta = BOSTA_ZONE_META.find(z => z.id === zoneId);
        const serviceMeta = BOSTA_SERVICE_TYPE_META.find(s => s.id === serviceId);

        const expectedBaseFee =
          zoneId && activeRateMatrix[zoneId]?.[sizeId]?.[serviceId] !== undefined
            ? activeRateMatrix[zoneId][sizeId][serviceId]
            : null;
        const expectedStandardTierFee =
          zoneId && activeRateMatrix[zoneId]?.normal?.[serviceId] !== undefined
            ? activeRateMatrix[zoneId].normal[serviceId]
            : null;

        // 1) Check if Shipping Fees (before VAT) exceed the exact Bosta Rate Plan for (Zone, Package Size, Service Type)
        let exactRateExcess = 0;
        if (expectedBaseFee !== null && shippingFees > expectedBaseFee + 1) {
          exactRateExcess = Math.round((shippingFees - expectedBaseFee) * 100) / 100;
          tags.push(
            `شحن أساسي (${shippingFees} ج.م) أعلى من خطة أسعار ${zoneMeta?.labelAr || effectiveCity} (${serviceMeta?.labelAr}: ${expectedBaseFee} ج.م، بفارق +${exactRateExcess} ج.م قبل الضريبة)`
          );
        }

        // 2) Check Package Size Inflation: e.g. same product shipped as Normal/Large/XL on other orders, but billed as Light Bulky (+90 EGP + 14% VAT = +102.60 EGP)!
        let sizeInflationExcessWithVat = 0;
        let dominantStandardSize: string | undefined;
        if (sizeTierRank(sizeId) > 0 && expectedStandardTierFee !== null) {
          const dStats = pkgDesc ? descSizeCounts.get(normalizeDescKey(pkgDesc)) : undefined;
          const baseSizeSurcharge = Math.max(0, shippingFees - expectedStandardTierFee);
          const withVatSurcharge = Math.round(baseSizeSurcharge * 1.14 * 100) / 100;
          if (dStats && dStats.standardTierCount > 0) {
            dominantStandardSize = dStats.dominantStandardLabel;
            sizeInflationExcessWithVat = withVatSurcharge;
            tags.push(
              `تضخيم حجم الشحنة إلى (${pkgSize}) رغم شحن نفس المنتج (${dStats.standardTierCount} مرة) بحجم (${dStats.dominantStandardLabel}) — فرق شحن +${baseSizeSurcharge} ج.م (+${withVatSurcharge} ج.م بالضريبة)`
            );
          } else if (baseSizeSurcharge > 0) {
            sizeInflationExcessWithVat = withVatSurcharge;
            tags.push(
              `علاوة حجم كبير (${pkgSize}): شحن ${shippingFees} ج.م بدلاً من ${expectedStandardTierFee} ج.م للحجم العادي (+${withVatSurcharge} ج.م بالضريبة)`
            );
          }
        }

        if (expectedBaseFee === null && totalFees > safeMaxFee && tags.length === 0) {
          tags.push(`إجمالي المصاريف فوق الحد العام (${safeMaxFee} ج.م)`);
        }

        // Radar #2: Delivered with 0 COD (missing 0 COD Discount and/or wrongful insurance/opening fees)
        let isZeroCodDeliveredAnomaly = false;
        let zeroCodExtraFeesWithVat = 0;
        if (
          isDeliveredRow &&
          cod === 0 &&
          onlineAmt === 0 &&
          depositAmt === 0 &&
          !isReplacementOrCrpType &&
          !st.toLowerCase().includes('deleted')
        ) {
          isZeroCodDeliveredAnomaly = true;
          zeroCodExtraFeesWithVat = Math.round((openingFees + insuranceFees) * 1.14 * 100) / 100;
          tags.push(
            `تسليم بـ 0 COD (صافي ${netVal} ج.م · فتح ${openingFees} + تأمين ${insuranceFees}${
              zeroCodDiscountVal === 0 ? ' · بدون 0 COD Discount' : ''
            })`
          );
        }

        // Radar #3: Insurance Fees deducted on Returned shipments OR > 1% on Delivered COD
        let isReturnedInsuranceAnomaly = false;
        let insuranceOverchargeWithVat = 0;
        if (isRet && insuranceFees > 0) {
          isReturnedInsuranceAnomaly = true;
          insuranceOverchargeWithVat = Math.round(insuranceFees * 1.14 * 100) / 100;
          tags.push(`تأمين مخصوم على مرتجع (${insuranceFees} ج.م + ضريبة = ${insuranceOverchargeWithVat} ج.م)`);
        } else if (!isRet && cod >= 600 && insuranceFees > 0 && (insuranceFees / cod) * 100 > 1.05) {
          const expectedMaxIns = Math.max(5, Math.round(cod * 0.01 * 100) / 100);
          if (insuranceFees > expectedMaxIns + 1) {
            insuranceOverchargeWithVat = Math.round((insuranceFees - expectedMaxIns) * 1.14 * 100) / 100;
            tags.push(
              `نسبة تأمين مرتفعة (${Math.round((insuranceFees / cod) * 1000) / 10}% = ${insuranceFees} ج.م بدل ${expectedMaxIns} ج.م)`
            );
          }
        }

        // Radar #4: Opening Package Fees (7.98 EGP) on Untouched Returns cross-checked with Exception Reason & Forward Attempts
        let isInvalidOpeningOnUntouchedReturn = false;
        const excReason = op?.exceptionReason || '';
        const fwdAttempts = op?.forwardAttemptsCount;
        const sheetRowNotesRaw = String(pickCell(raw, undefined, ['notes']) || '').trim();
        const orderNotes = op?.notes || (sheetRowNotesRaw && sheetRowNotesRaw !== 'N/A' ? sheetRowNotesRaw : '');
        const untouchedExcPattern =
          /no answer|did not answer|unreachable|phone closed|switched off|postpon|waiting for data|address|wrong|cancel.*before|not respond|لا يرد|لم يرد|مغلق|تأجيل|عنوان/i;
        if (isRet && (openingFees > 0 || testingFees > 0)) {
          const openingWithVatVal = Math.round((openingFees + testingFees) * 1.14 * 100) / 100;
          if ((typeof fwdAttempts === 'number' && fwdAttempts === 0) || untouchedExcPattern.test(excReason)) {
            isInvalidOpeningOnUntouchedReturn = true;
            tags.push(
              `خصم فتح شحنة باطل (${openingWithVatVal} ج.م) — لم يفتحها العميل (${
                excReason || `محاولات: ${fwdAttempts ?? 0}`
              })`
            );
          } else {
            tags.push(
              `رسوم فتح/فحص شحنة على مرتجع (${openingFees + testingFees} ج.م + ضريبة${
                excReason ? ` · ${excReason}` : ''
              })`
            );
          }
        }

        // Radar #4B: Opening/Testing Fees deducted despite Notes explicitly forbidding inspection ("غير مسموح بالمعاينة")
        const forbiddenOpeningPattern =
          /غير مسموح بالمعاينة|ممنوع المعاينة|ممنوع فتح|لا يسمح بالفتح|بدون معاينة|without opening|no opening|do not open|disallow.*open|not allowed to open/i;
        let isForbiddenOpenFeeAnomaly = false;
        if (orderNotes && forbiddenOpeningPattern.test(orderNotes) && (openingFees > 0 || testingFees > 0)) {
          isForbiddenOpenFeeAnomaly = true;
          const openWithVatVal = Math.round((openingFees + testingFees) * 1.14 * 100) / 100;
          tags.push(
            `خصم فتح شحنة (${openWithVatVal} ج.م) رغم أن ملاحظات البوليصة تمنع المعاينة ("${orderNotes}")`
          );
        }

        if (nextDayFees > 0) tags.push(`تحويل سريع Next-Day (${nextDayFees} ج.م)`);
        if (posFees > 0) tags.push(`رسوم POS (${posFees} ج.م)`);
        if (collectionFees > 0) tags.push(`Collection Fees (${collectionFees} ج.م)`);
        if (fulfillmentFees > 0) tags.push(`Fulfillment (${fulfillmentFees} ج.م)`);
        if (cod === 0 && codFeesCell > 0) tags.push('رسوم COD على أوردر بـ 0 كاش');
        if (matchWithStoreOrders && exp && exp.expectedCarrierFees > 0 && totalFees - exp.expectedCarrierFees > toleranceEgp) {
          tags.push('أعلى من تسعيرة الطلب');
        }
        if (!isRet && cod > 0 && totalFees / cod > 0.35 && totalFees > 80) {
          tags.push('رسوم > 35% من التحصيل');
        }
        const computedRowNet =
          Math.round((cod + onlineAmt + depositAmt + discountsCredits + flexAmt - totalFees) * 100) / 100;
        const mathDiff = Math.round((netVal - computedRowNet) * 100) / 100;
        if (Math.abs(mathDiff) > 1.5) {
          tags.push(`خلل معادلة الشيت (${mathDiff > 0 ? '+' : ''}${mathDiff} ج.م)`);
        }

        if (tags.length > 0) {
          const exactRateExcessWithVat = Math.round(exactRateExcess * 1.14 * 100) / 100;
          const returnOpenWithVat = isRet ? Math.round((openingFees + testingFees) * 1.14 * 100) / 100 : 0;
          const forbiddenNonReturnOpenWithVat =
            !isRet && isForbiddenOpenFeeAnomaly
              ? Math.round((openingFees + testingFees) * 1.14 * 100) / 100
              : 0;
          const surchargeExcess =
            Math.round(
              ((nextDayFees + posFees + collectionFees) * 1.14 +
                returnOpenWithVat +
                forbiddenNonReturnOpenWithVat +
                insuranceOverchargeWithVat +
                (isZeroCodDeliveredAnomaly &&
                returnOpenWithVat === 0 &&
                insuranceOverchargeWithVat === 0 &&
                forbiddenNonReturnOpenWithVat === 0
                  ? zeroCodExtraFeesWithVat
                  : 0)) *
                100
            ) / 100;

          const itemizedOvercharge =
            Math.round((exactRateExcessWithVat + sizeInflationExcessWithVat + surchargeExcess) * 100) / 100;

          const overEst =
            itemizedOvercharge > 0
              ? itemizedOvercharge
              : totalFees > safeMaxFee
              ? Math.round((totalFees - safeMaxFee) * 100) / 100
              : Math.abs(mathDiff) > 1.5
              ? Math.abs(mathDiff)
              : Math.round(Math.max(0, totalFees - (exp?.expectedCarrierFees || 0)) * 100) / 100;

          const rateAndSizeOverchargeWithVat =
            Math.round((exactRateExcessWithVat + sizeInflationExcessWithVat) * 100) / 100;
          const isRateOrSizeOvercharge = rateAndSizeOverchargeWithVat > 0;

          feeAnomaliesRaw.push({
            id: `fee_${tKey}`,
            trackingKey: tKey,
            customerName: matchedOrder?.customerName || customerName,
            customerPhone: phoneRaw || matchedOrder?.customerPhone,
            brandName,
            dropoffCity: effectiveCity || undefined,
            zoneLabelAr: zoneMeta?.labelAr,
            packageDescription: pkgDesc || op?.packageDescription || undefined,
            packageSize: pkgSize || '-',
            dominantProductSize: dominantStandardSize,
            orderType: orderTypeRaw || op?.sheetType || 'SEND',
            serviceLabelAr: serviceMeta?.labelAr,
            sheetStatus: st,
            sheetCashoutId: cashoutId || undefined,
            sheetGrossAmount: cod,
            sheetFeesAmount: totalFees,
            shippingFees,
            expectedBaseShippingFee: expectedBaseFee ?? undefined,
            expectedNormalSizeShippingFee: expectedStandardTierFee ?? undefined,
            insuranceFees,
            openingPackageFees: openingFees,
            vat,
            nextDayFees: nextDayFees || undefined,
            posFees: posFees || undefined,
            collectionFees: collectionFees || undefined,
            zoneExpectedShippingMax: expectedBaseFee ?? undefined,
            mathCheckDiff: Math.abs(mathDiff) > 1.5 ? mathDiff : undefined,
            otherFees: Math.round(Math.max(0, totalFees - shippingFees - insuranceFees - openingFees - vat) * 100) / 100,
            expectedLimit: expectedBaseFee ?? safeMaxFee,
            overchargeEstimate: overEst,
            rateAndSizeOverchargeWithVat,
            netUncompensatedOvercharge: overEst,
            isRateOrSizeOvercharge,
            isReturnedInsuranceAnomaly,
            isInvalidOpeningOnUntouchedReturn,
            isForbiddenOpenFeeAnomaly,
            isZeroCodDeliveredAnomaly,
            orderNotes: orderNotes || undefined,
            exceptionReason: excReason || undefined,
            forwardAttempts: typeof fwdAttempts === 'number' ? fwdAttempts : undefined,
            compensatedInCredits: false,
            anomalyTags: tags,
            matchedOrder,
            reasonSummary: `${tags.join(' + ')} — إجمالي رسوم الشيت ${totalFees.toLocaleString()} ج.م`
          });
        }
      }

      if ((onlineAmt > 0 || depositAmt > 0 || flexAmt !== 0 || flexFees > 0) && !seenOnlineFlexKeys.has(tKey)) {
        seenOnlineFlexKeys.add(tKey);
        const notPaid = isExplicitNotPaid(payStatus) || !cashoutId;
        const isRet = isReturnedOrUncollectedStatus(st);
        const flag: OnlineFlexAuditRow['statusFlag'] =
          (onlineAmt > 0 || depositAmt > 0) && notPaid
            ? 'untransferred_online'
            : isRet && (flexAmt !== 0 || flexFees > 0)
            ? 'returned_with_flex'
            : op?.hasFlexShip && op.flexShipPaid === false && flexFees > 0 && flexAmt === 0
            ? 'unpaid_flex'
            : 'settled_ok';
        onlineFlexRaw.push({
          id: `oflex_${tKey}`,
          trackingKey: tKey,
          customerName: matchedOrder?.customerName || customerName || op?.customerName,
          customerPhone: phoneRaw || op?.phoneRaw,
          brandName: brandName || op?.brandName,
          sheetStatus: st,
          sheetPaymentStatus: payStatus || undefined,
          sheetCashoutId: cashoutId || undefined,
          onlinePaymentAmount: onlineAmt,
          depositAmount: depositAmt,
          hasFlexShip: Boolean(op?.hasFlexShip || flexAmt !== 0 || flexFees !== 0),
          flexShipPaid: op?.flexShipPaid,
          flexShipValue: op?.flexShipValue || Math.abs(flexAmt),
          flexShipAmount: flexAmt,
          flexShipFees: flexFees,
          sheetNetPayout: netVal,
          statusFlag: flag,
          matchedOrder,
          reasonSummary:
            flag === 'unpaid_flex'
              ? 'تم احتساب رسوم FlexShip ولم يظهر تحصيلها من العميل'
              : flag === 'untransferred_online'
              ? `دفع أونلاين/مقدم (${(onlineAmt + depositAmt).toLocaleString()} ج.م) ولم يُحوّل في دفعة بنكية بعد`
              : flag === 'returned_with_flex'
              ? `مرتجع مع استقطاع/تسوية FlexShip (${flexAmt.toLocaleString()} ج.م · رسوم ${flexFees} ج.م)`
              : `مدفوع ومسوى في دفعة (${cashoutId || payStatus})`
        });
      }
    });
  });

  // Catch FlexShip orders in Deliveries Export ONLY when customer actually paid FlexShip (flexShipPaid === true) & it's not yet in Cash Cycles
  bostaOpMetaByKey.forEach(op => {
    if (seenOnlineFlexKeys.has(op.trackingKey)) return;
    if (op.flexShipPaid !== true) return;
    seenOnlineFlexKeys.add(op.trackingKey);
    const matchedOrder =
      (matchWithStoreOrders && (waybillMap.get(op.trackingKey) || orderNumberMap.get(op.trackingKey))) || null;
    onlineFlexRaw.push({
      id: `oflex_op_${op.trackingKey}`,
      trackingKey: op.trackingKey,
      customerName: matchedOrder?.customerName || op.customerName,
      customerPhone: op.phoneRaw,
      brandName: op.brandName,
      sheetStatus: op.deliveryState,
      onlinePaymentAmount: 0,
      depositAmount: 0,
      hasFlexShip: true,
      flexShipPaid: op.flexShipPaid,
      flexShipValue: op.flexShipValue,
      flexShipAmount: 0,
      flexShipFees: 0,
      sheetNetPayout: 0,
      statusFlag: isReturnedOrUncollectedStatus(op.deliveryState) ? 'returned_with_flex' : 'untransferred_online',
      matchedOrder,
      reasonSummary: `دفع العميل رسوم FlexShip (${op.flexShipValue} ج.م) ولم يظهر تسويتها في Cash Cycles بعد`
    });
  });

  // Stuck Returns & Hub Exceptions Hunter (Inventories stuck at Bosta Hubs — excluding completed Returned to origin/business)
  const stuckReturnsRaw: StuckReturnAlert[] = [];
  bostaOpMetaByKey.forEach(op => {
    const low = op.deliveryState.toLowerCase();
    const excLow = (op.exceptionReason || '').toLowerCase();
    const isCompletedFinal =
      low.includes('returned to business') ||
      low.includes('returned to origin') ||
      low === 'returned' ||
      low.includes('delivered') ||
      low.includes('deleted') ||
      low.includes('canceled') ||
      low.includes('cancelled') ||
      low.includes('terminat');
    if (isCompletedFinal) return;

    const isExceptionOrCancel =
      low.includes('exception') ||
      low.includes('hold') ||
      low.includes('fail') ||
      excLow.includes('cancel') ||
      excLow.includes('postpon') ||
      excLow.includes('damage') ||
      excLow.includes('lost') ||
      Boolean(op.expectedReturnDate) ||
      op.returnAttemptsCount > 0 ||
      op.onHoldTrials > 0;
    const isReturning = low.includes('returning');

    let daysOverdue = 0;
    if (op.expectedReturnDate) {
      const expMs = new Date(op.expectedReturnDate).getTime();
      if (Number.isFinite(expMs) && nowMs > expMs) {
        daysOverdue = Math.floor((nowMs - expMs) / 86400000);
      }
    }
    let daysSincePickup = 0;
    if (op.pickedUpDate) {
      const pickMs = new Date(op.pickedUpDate).getTime();
      if (Number.isFinite(pickMs) && nowMs > pickMs) {
        daysSincePickup = Math.floor((nowMs - pickMs) / 86400000);
      }
    }
    if (daysOverdue === 0 && (op.updatedAt || op.pickedUpDate)) {
      const refMs = new Date(op.updatedAt || op.pickedUpDate).getTime();
      if (Number.isFinite(refMs) && nowMs > refMs) {
        const diff = Math.floor((nowMs - refMs) / 86400000);
        if (diff >= graceDaysForInTransit) daysOverdue = diff;
      }
    }
    if (daysOverdue === 0 && daysSincePickup >= graceDaysForInTransit) {
      daysOverdue = daysSincePickup;
    }

    if (!isReturning && !isExceptionOrCancel && daysSincePickup < graceDaysForInTransit) return;

    const matchedOrder =
      (matchWithStoreOrders && (waybillMap.get(op.trackingKey) || orderNumberMap.get(op.trackingKey))) || null;
    const wrongWarehouseNote = wrongReturnWarehouseNoteByTracking.get(op.trackingKey);
    stuckReturnsRaw.push({
      id: `stuck_${op.trackingKey}`,
      trackingKey: op.trackingKey,
      customerName: matchedOrder?.customerName || op.customerName,
      customerPhone: op.phoneRaw || matchedOrder?.customerPhone,
      brandName: op.brandName,
      dropoffCity: op.dropoffCity,
      packageDescription: op.packageDescription,
      sheetStatus: op.deliveryState,
      currentHub: op.currentHub,
      exceptionReason: op.exceptionReason,
      expectedReturnDate: op.expectedReturnDate || undefined,
      updatedAt: op.updatedAt || undefined,
      daysOverdue,
      returnAttemptsCount: op.returnAttemptsCount,
      onHoldTrials: op.onHoldTrials,
      codAmount: op.codAmount || matchedOrder?.totalPrice || 0,
      matchedOrder,
      wrongReturnWarehouseNote: wrongWarehouseNote || undefined,
      reasonSummary:
        wrongWarehouseNote
          ? `${wrongWarehouseNote} — ${op.deliveryState}${op.currentHub ? ` في ${op.currentHub}` : ''}`
          : low.includes('received at warehouse')
          ? `وصلت مخزن بوسطة (${op.currentHub || 'Hub'}) — لم ترجع لمخزنك بعد! (${op.deliveryState}${op.exceptionReason ? ` · ${op.exceptionReason}` : ''})`
          : op.expectedReturnDate && daysOverdue > 0
          ? `تأخر عن موعد الإرجاع المتوقع (${op.expectedReturnDate}) بـ ${daysOverdue} يوم في ${op.currentHub || 'بوسطة'}`
          : `شحنة معلقة (${op.deliveryState}) في ${op.currentHub || 'بوسطة'}${op.exceptionReason ? ` — ${op.exceptionReason}` : daysSincePickup > 0 ? ` (منذ ${daysSincePickup} يوم من الاستلام)` : ''}`
    });
  });

  const filterByBrand = <T extends { brandName?: string }>(arr: T[]): T[] =>
    normalizedBrandFilter === 'all'
      ? arr
      : arr.filter(item => normalizeBrandKey(item.brandName) === normalizedBrandFilter);

  // Zero-Attempt Return Hunter (Returned with 0 forward delivery attempts while shipping was deducted)
  const zeroAttemptRaw: ZeroAttemptReturnAlert[] = [];
  bostaOpMetaByKey.forEach(op => {
    const low = op.deliveryState.toLowerCase();
    if (low.includes('deleted') || low.includes('canceled') || low.includes('cancelled')) return;
    if (!isReturnedOrUncollectedStatus(op.deliveryState)) return;
    if (op.forwardAttemptsCount !== 0) return;

    const cc = cashCyclesByKey.get(op.trackingKey);
    const feesDeducted = cc ? Math.abs(cc.fees) : 0;
    const matchedOrder =
      (matchWithStoreOrders && (waybillMap.get(op.trackingKey) || orderNumberMap.get(op.trackingKey))) || null;
    zeroAttemptRaw.push({
      id: `zatt_${op.trackingKey}`,
      trackingKey: op.trackingKey,
      customerName: matchedOrder?.customerName || op.customerName,
      customerPhone: op.phoneRaw || matchedOrder?.customerPhone,
      brandName: op.brandName,
      dropoffCity: op.dropoffCity,
      sheetStatus: op.deliveryState,
      exceptionReason: op.exceptionReason || undefined,
      forwardAttempts: op.forwardAttemptsCount,
      totalAttempts: Math.max(0, op.totalAttemptsCount),
      shippingFeesDeducted: feesDeducted,
      sheetCashoutId: cc?.cashoutId || undefined,
      matchedOrder,
      reasonSummary: `شحنة مرتجعة (${op.deliveryState}) بعدد 0 محاولة توصيل للعميل${
        feesDeducted > 0 ? ` — تم خصم ${feesDeducted.toLocaleString()} ج.م رسوم شحن` : ''
      }`
    });
  });

  // Internal Fraud, Staff Tampering & Cross-Sheet Conflict Hunter
  const internalFraudRaw: InternalFraudAlert[] = [];
  const seenFraudKeys = new Set<string>();
  const nonDeletedRowsByRef = new Map<string, SheetAuditRow[]>();
  const nonDeletedRowsByPhone = new Map<string, SheetAuditRow[]>();

  sheetRows.forEach(row => {
    const stLow = row.sheetStatus.toLowerCase();
    const isCancelledOrDel = stLow.includes('deleted') || stLow.includes('canceled') || stLow.includes('cancelled');

    if (row.businessRefKey && !isCancelledOrDel) {
      const list = nonDeletedRowsByRef.get(row.businessRefKey) || [];
      if (!list.some(x => x.trackingKey === row.trackingKey)) list.push(row);
      nonDeletedRowsByRef.set(row.businessRefKey, list);
    }
    if (row.phoneRaw && !isCancelledOrDel && row.sheetGrossAmount > 0) {
      const list = nonDeletedRowsByPhone.get(row.phoneRaw) || [];
      if (!list.some(x => x.trackingKey === row.trackingKey)) list.push(row);
      nonDeletedRowsByPhone.set(row.phoneRaw, list);
    }

    if (row.category === 'duplicate') return;

    // 1. Cross-sheet Status Conflict (Deliveries says Delivered vs Cash Cycles says Returned/Terminated or vice versa)
    const op = bostaOpMetaByKey.get(row.trackingKey);
    const cc = cashCyclesByKey.get(row.trackingKey);
    if (op && cc) {
      const opDelivered = isExplicitDeliveredStatus(op.deliveryState);
      const opReturned = isReturnedOrUncollectedStatus(op.deliveryState);
      const ccDelivered = isExplicitDeliveredStatus(cc.orderStatus);
      const ccReturned = isReturnedOrUncollectedStatus(cc.orderStatus);
      if ((opDelivered && ccReturned) || (opReturned && ccDelivered)) {
        const fKey = `conflict_${row.trackingKey}`;
        if (!seenFraudKeys.has(fKey)) {
          seenFraudKeys.add(fKey);
          internalFraudRaw.push({
            id: fKey,
            fraudType: 'status_conflict_between_sheets',
            severity: 'high',
            trackingKey: row.trackingKey,
            orderNumber: row.matchedOrder?.orderNumber || row.businessRefKey,
            customerName: row.matchedOrder?.customerName || row.customerName,
            customerPhone: row.phoneRaw,
            brandName: row.brandName,
            storeAmount: cc.cod || op.codAmount,
            bostaAmount: cc.net,
            financialRiskAmount: Math.max(op.codAmount, cc.cod, Math.abs(cc.net)),
            storeStatus: op.deliveryState,
            bostaStatus: cc.orderStatus,
            sheetDate: row.sheetDate,
            matchedOrder: row.matchedOrder,
            reasonSummary: `تعارض صريح بين شيتات بوسطة: حالة Deliveries (${op.deliveryState}) عكس حالة Cash Cycles (${cc.orderStatus})`
          });
        }
      }
    }

    // 2. Store Order vs Bosta Tampering (when ON mode is active & matchedOrder exists)
    if (matchWithStoreOrders && row.matchedOrder && row.expectation) {
      const order = row.matchedOrder;
      const exp = row.expectation;
      const orderCancelled = isOrderCancelledOrReturned(order);
      const bostaDelivered = isExplicitDeliveredStatus(row.sheetStatus);

      if (orderCancelled && bostaDelivered) {
        const fKey = `cancelled_del_${row.trackingKey}`;
        if (!seenFraudKeys.has(fKey)) {
          seenFraudKeys.add(fKey);
          internalFraudRaw.push({
            id: fKey,
            fraudType: 'cancelled_in_store_delivered_in_bosta',
            severity: 'critical',
            trackingKey: row.trackingKey,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            brandName: row.brandName,
            storeAmount: exp.expectedGrossCod,
            bostaAmount: row.sheetGrossAmount,
            financialRiskAmount: Math.max(exp.expectedGrossCod, row.sheetGrossAmount),
            storeStatus: order.status,
            bostaStatus: row.sheetStatus,
            sheetDate: row.sheetDate || row.sheetDeliveredAt,
            matchedOrder: order,
            reasonSummary: `تلاعب خطير: الأوردر #${order.orderNumber} مسجل في المتجر (${order.status}) لكنه مُسلّم في بوسطة (COD ${row.sheetGrossAmount.toLocaleString()} ج.م)`
          });
        }
      }

      const isReplacementType = (row.sheetType || '').toLowerCase().includes('exchange') || (row.sheetType || '').toLowerCase().includes('compensat');
      if (
        !exp.isPrepaidOrPos &&
        (Number(order.advancePayment) || 0) === 0 &&
        !isCancelledOrDel &&
        !isReplacementType &&
        exp.expectedGrossCod > 50 &&
        row.sheetGrossAmount < exp.expectedGrossCod - Math.max(toleranceEgp, 25)
      ) {
        const fKey = `cod_down_${row.trackingKey}`;
        if (!seenFraudKeys.has(fKey)) {
          seenFraudKeys.add(fKey);
          const diff = Math.round((exp.expectedGrossCod - row.sheetGrossAmount) * 100) / 100;
          internalFraudRaw.push({
            id: fKey,
            fraudType: 'cod_downgraded_or_zero',
            severity: row.sheetGrossAmount === 0 ? 'critical' : 'high',
            trackingKey: row.trackingKey,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            brandName: row.brandName,
            storeAmount: exp.expectedGrossCod,
            bostaAmount: row.sheetGrossAmount,
            financialRiskAmount: diff,
            storeStatus: order.status,
            bostaStatus: row.sheetStatus,
            sheetDate: row.sheetDate,
            matchedOrder: order,
            reasonSummary:
              row.sheetGrossAmount === 0
                ? `خطر تلاعب: الأوردر #${order.orderNumber} قيمته بالمتجر ${exp.expectedGrossCod.toLocaleString()} ج.م واتشحن على بوسطة بـ 0 ج.م COD!`
                : `تخفيض قيمة التحصيل: بالمتجر ${exp.expectedGrossCod.toLocaleString()} ج.م وعلى بوسطة ${row.sheetGrossAmount.toLocaleString()} ج.م فقط (فارق ${diff.toLocaleString()} ج.م)`
          });
        }
      }

      if (
        !exp.isPrepaidOrPos &&
        (order.status === 'تم_التحصيل' || order.paymentStatus === 'مدفوع') &&
        !order.codPayoutBatchId &&
        row.category === 'collected_untransferred'
      ) {
        const fKey = `settled_nocashout_${row.trackingKey}`;
        if (!seenFraudKeys.has(fKey)) {
          seenFraudKeys.add(fKey);
          internalFraudRaw.push({
            id: fKey,
            fraudType: 'settled_in_store_no_cashout',
            severity: 'high',
            trackingKey: row.trackingKey,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            brandName: row.brandName,
            storeAmount: exp.expectedNetPayout,
            bostaAmount: row.sheetNetPayout,
            financialRiskAmount: Math.max(row.sheetNetPayout, exp.expectedNetPayout),
            storeStatus: `${order.status} / ${order.paymentStatus}`,
            bostaStatus: `${row.sheetPaymentStatus || 'Not Paid'} (بدون Cash-out)`,
            sheetDate: row.sheetDate,
            matchedOrder: order,
            reasonSummary: `مُقفل بالمتجر (${order.status}) بدون رقم دفعة، وشيت بوسطة يثبت أنه لم يُحوّل بعد (${row.sheetPaymentStatus || 'Not Paid'})`
          });
        }
      }
    }

    // 2b. Sheet-Intrinsic Fraud & Typo Traps (Works in BOTH ON & OFF modes!)
    const rowDelivered = isExplicitDeliveredStatus(row.sheetStatus);
    const rowTypeLow = (row.sheetType || op?.sheetType || '').toLowerCase();
    const isRowReplacementOrCrp =
      rowTypeLow.includes('exchange') ||
      rowTypeLow.includes('compensat') ||
      rowTypeLow.includes('return') ||
      rowTypeLow.includes('crp');
    const prodDescForCod = row.packageDescription || op?.packageDescription || '';
    const prodCodBaseline = prodDescForCod
      ? productMedianCodMap.get(normalizeProdDescKey(prodDescForCod))
      : undefined;
    const baselineMedian = prodCodBaseline?.medianCod || 0;

    // Case I: Delivered with 0 EGP COD & 0 Online/Deposit (e.g. typo or unauthorized 0-COD dispatch while deducting shipping fees)
    const hasOnlineOrFlexCover =
      Boolean(row.hasFlexShip) ||
      (row.feeBreakdown?.flexShipAmount || 0) > 0 ||
      Boolean(onlineFlexRaw.find(o => o.trackingKey === row.trackingKey && (o.onlinePaymentAmount > 0 || o.depositAmount > 0)));
    if (
      rowDelivered &&
      row.sheetGrossAmount === 0 &&
      !isCancelledOrDel &&
      !isRowReplacementOrCrp &&
      !hasOnlineOrFlexCover &&
      (!matchWithStoreOrders || !row.matchedOrder || !row.expectation?.isPrepaidOrPos)
    ) {
      const fKey = `cod_down_${row.trackingKey}`;
      if (!seenFraudKeys.has(fKey)) {
        seenFraudKeys.add(fKey);
        const estProductVal =
          baselineMedian > 0
            ? baselineMedian
            : Math.abs(row.sheetNetPayout || row.sheetFeesAmount);
        internalFraudRaw.push({
          id: fKey,
          fraudType: 'cod_downgraded_or_zero',
          severity: 'critical',
          trackingKey: row.trackingKey,
          orderNumber: row.matchedOrder?.orderNumber || row.businessRefKey,
          customerName: row.matchedOrder?.customerName || row.customerName,
          customerPhone: row.phoneRaw,
          brandName: row.brandName,
          storeAmount: baselineMedian,
          bostaAmount: 0,
          financialRiskAmount: Math.round(estProductVal * 100) / 100,
          storeStatus: baselineMedian > 0 ? `متوسط المنتج ${baselineMedian.toLocaleString()} ج.م` : 'شحنة توصيل/تحصيل',
          bostaStatus: `${row.sheetStatus} (0 COD · خصم ${Math.abs(row.sheetNetPayout).toLocaleString()} ج.م)`,
          sheetDate: row.sheetDate || row.sheetDeliveredAt,
          matchedOrder: row.matchedOrder,
          reasonSummary: `فخ تسليم بـ 0 جنيه COD: الشحنة (${prodDescForCod || row.trackingKey}) سُلمت للعميل بـ 0 ج.م تحصيل وبوسطة خصمت عليك ${Math.abs(
            row.sheetNetPayout || row.sheetFeesAmount
          ).toLocaleString()} ج.م شحن${
            baselineMedian > 0 ? ` (متوسط سعر هذا المنتج في شيتاتك ${baselineMedian.toLocaleString()} ج.م!)` : ' — راجع هل استلمت ثمنها كاش أم خُدِع الحساب!'
          }`
        });
      }
    } else if (enableProductPriceAudit) {
      // Radar #5: Product COD Price Anomaly (ON/OFF toggleable, compares with Unified Inventory settings.products and/or CSV median at 15% drop threshold, catches before & after delivery!)
      const isRetRow = isReturnedOrUncollectedStatus(row.sheetStatus);
      const invMatch = prodDescForCod ? matchUnifiedInventoryProduct(prodDescForCod) : null;
      const medianBaseline = prodCodBaseline && prodCodBaseline.sampleCount >= 2 ? prodCodBaseline.medianCod : 0;

      let refPrice = 0;
      let refSourceLabel = '';
      if (productPriceAuditSource === 'inventory_only') {
        if (invMatch) {
          refPrice = invMatch.expectedBundlePrice;
          refSourceLabel = `المخزون الموحد (${invMatch.productName})`;
        }
      } else if (productPriceAuditSource === 'sheet_median') {
        if (medianBaseline > 0) {
          refPrice = medianBaseline;
          refSourceLabel = `متوسط الشيتات (${prodCodBaseline!.sampleCount} شحنة)`;
        }
      } else {
        if (invMatch) {
          refPrice = invMatch.expectedBundlePrice;
          refSourceLabel = `المخزون الموحد (${invMatch.productName})`;
        } else if (medianBaseline > 0) {
          refPrice = medianBaseline;
          refSourceLabel = `متوسط الشيتات (${prodCodBaseline!.sampleCount} شحنة)`;
        }
      }

      if (
        !isRetRow &&
        !isCancelledOrDel &&
        !isRowReplacementOrCrp &&
        !hasOnlineOrFlexCover &&
        row.sheetGrossAmount > 0 &&
        refPrice >= 150 &&
        row.sheetGrossAmount < refPrice * 0.85 &&
        refPrice - row.sheetGrossAmount >= 50
      ) {
        const fKey = `cod_drop_${row.trackingKey}`;
        const existingDown = seenFraudKeys.has(`cod_down_${row.trackingKey}`);
        if (!existingDown && !seenFraudKeys.has(fKey)) {
          seenFraudKeys.add(fKey);
          const dropDiff = Math.round((refPrice - row.sheetGrossAmount) * 100) / 100;
          const dropPct = Math.round(((refPrice - row.sheetGrossAmount) / refPrice) * 100);
          const stageLabel = rowDelivered ? 'بعد التسليم' : 'قبل التحصيل (في التشغيل)';
          internalFraudRaw.push({
            id: fKey,
            fraudType: 'product_price_anomaly',
            severity: dropPct >= 30 || dropDiff >= 300 ? 'critical' : 'high',
            trackingKey: row.trackingKey,
            orderNumber: row.matchedOrder?.orderNumber || row.businessRefKey,
            customerName: row.matchedOrder?.customerName || row.customerName,
            customerPhone: row.phoneRaw,
            brandName: row.brandName,
            storeAmount: refPrice,
            bostaAmount: row.sheetGrossAmount,
            financialRiskAmount: dropDiff,
            storeStatus: refSourceLabel,
            bostaStatus: `COD ${row.sheetGrossAmount.toLocaleString()} ج.م (-${dropPct}% · ${stageLabel})`,
            sheetDate: row.sheetDate || row.sheetDeliveredAt,
            referenceSourceLabel: refSourceLabel,
            priceDropPercent: dropPct,
            matchedOrder: row.matchedOrder,
            reasonSummary: `شذوذ تسعير منتج (-${dropPct}% · ${stageLabel}) لـ "${prodDescForCod}": بوليصة بـ ${row.sheetGrossAmount.toLocaleString()} ج.م أقل بـ ${dropDiff.toLocaleString()} ج.م عن السعر المرجعي (${refPrice.toLocaleString()} ج.م — ${refSourceLabel})`
          });
        }
      }
    }
  });

  // 3. Double-Waybill for Same Business Reference OR Same Phone + Same COD within 3 days
  nonDeletedRowsByRef.forEach((rows, refKey) => {
    if (rows.length < 2) return;
    const fKey = `dblref_${refKey}`;
    if (seenFraudKeys.has(fKey)) return;
    seenFraudKeys.add(fKey);
    const first = rows[0];
    const second = rows[1];
    internalFraudRaw.push({
      id: fKey,
      fraudType: 'double_waybill_same_order',
      severity: 'high',
      trackingKey: first.trackingKey,
      secondaryTrackingKey: second.trackingKey,
      orderNumber: refKey,
      customerName: first.matchedOrder?.customerName || first.customerName,
      customerPhone: first.phoneRaw,
      brandName: first.brandName,
      storeAmount: first.sheetGrossAmount,
      bostaAmount: second.sheetGrossAmount,
      financialRiskAmount: Math.round((first.sheetFeesAmount + first.sheetGrossAmount) * 100) / 100,
      storeStatus: first.sheetStatus,
      bostaStatus: second.sheetStatus,
      sheetDate: first.sheetDate || second.sheetDate,
      matchedOrder: first.matchedOrder,
      reasonSummary: `طلب رقم (${refKey}) خرج ببوليصتين مختلفتين (${first.trackingKey} و ${second.trackingKey}) — تحقق من عدم شحن بضاعة مرتين لنفس العميل`
    });
  });

  nonDeletedRowsByPhone.forEach((rows, phone) => {
    if (rows.length < 2) return;
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        if (Math.abs(a.sheetGrossAmount - b.sheetGrossAmount) > 5) continue;
        const da = a.sheetDate ? new Date(a.sheetDate).getTime() : NaN;
        const db = b.sheetDate ? new Date(b.sheetDate).getTime() : NaN;
        if (!Number.isFinite(da) || !Number.isFinite(db)) continue;
        const daysApart = Math.abs(da - db) / 86400000;
        if (daysApart > 3) continue;
        const pairKey = [a.trackingKey, b.trackingKey].sort().join('|');
        const fKey = `dblphone_${pairKey}`;
        if (seenFraudKeys.has(fKey)) continue;
        seenFraudKeys.add(fKey);
        internalFraudRaw.push({
          id: fKey,
          fraudType: 'double_waybill_same_order',
          severity: 'medium',
          trackingKey: a.trackingKey,
          secondaryTrackingKey: b.trackingKey,
          orderNumber: a.matchedOrder?.orderNumber || a.businessRefKey,
          customerName: a.matchedOrder?.customerName || a.customerName,
          customerPhone: phone,
          brandName: a.brandName,
          storeAmount: a.sheetGrossAmount,
          bostaAmount: b.sheetGrossAmount,
          financialRiskAmount: a.sheetGrossAmount,
          storeStatus: a.sheetStatus,
          bostaStatus: b.sheetStatus,
          sheetDate: a.sheetDate || b.sheetDate,
          matchedOrder: a.matchedOrder,
          reasonSummary: `اشتباه شحن مزدوج لنفس الهاتف (${phone}): بوليصتين بنفس قيمة الـ COD (${a.sheetGrossAmount.toLocaleString()} ج.م) خلال ${Math.round(daysApart * 10) / 10} يوم (${a.trackingKey} و ${b.trackingKey})`
        });
      }
    }
  });

  // Serial Returner & Fraudulent Customer Phone Blacklist
  const customerAggByPhone = new Map<
    string,
    {
      names: Set<string>;
      cities: Set<string>;
      trackingKeys: Set<string>;
      brandNames: Set<string>;
      deliveredCount: number;
      returnedCount: number;
      totalReturnedFees: number;
      totalReturnedCodValue: number;
      lastDate: string;
    }
  >();

  const seenPhoneTracking = new Set<string>();
  const ingestPhoneShipment = (paramsShip: {
    phone: string;
    trackingKey: string;
    name?: string;
    city?: string;
    brand?: string;
    status: string;
    cod: number;
    fees: number;
    date?: string;
  }) => {
    const ph = paramsShip.phone;
    if (!ph || !paramsShip.trackingKey) return;
    const dedupe = `${ph}|${paramsShip.trackingKey}`;
    if (seenPhoneTracking.has(dedupe)) return;
    seenPhoneTracking.add(dedupe);
    const stLow = paramsShip.status.toLowerCase();
    if (stLow.includes('deleted')) return;

    let entry = customerAggByPhone.get(ph);
    if (!entry) {
      entry = {
        names: new Set(),
        cities: new Set(),
        trackingKeys: new Set(),
        brandNames: new Set(),
        deliveredCount: 0,
        returnedCount: 0,
        totalReturnedFees: 0,
        totalReturnedCodValue: 0,
        lastDate: ''
      };
      customerAggByPhone.set(ph, entry);
    }
    if (paramsShip.name) entry.names.add(paramsShip.name);
    if (paramsShip.city) entry.cities.add(paramsShip.city);
    if (paramsShip.brand) entry.brandNames.add(paramsShip.brand);
    entry.trackingKeys.add(paramsShip.trackingKey);
    if (paramsShip.date && paramsShip.date > entry.lastDate) entry.lastDate = paramsShip.date;

    if (isReturnedOrUncollectedStatus(paramsShip.status)) {
      entry.returnedCount += 1;
      entry.totalReturnedFees += Math.abs(paramsShip.fees);
      entry.totalReturnedCodValue += paramsShip.cod;
    } else if (isExplicitDeliveredStatus(paramsShip.status)) {
      entry.deliveredCount += 1;
    }
  };

  sheetRows.forEach(r => {
    if (r.category === 'duplicate') return;
    if (normalizedBrandFilter !== 'all' && normalizeBrandKey(r.brandName) !== normalizedBrandFilter) return;
    ingestPhoneShipment({
      phone: r.phoneRaw,
      trackingKey: r.trackingKey,
      name: r.matchedOrder?.customerName || r.customerName,
      city: r.dropoffCity,
      brand: r.brandName,
      status: r.sheetStatus,
      cod: r.sheetGrossAmount,
      fees: r.sheetFeesAmount,
      date: r.sheetDate || r.sheetDeliveredAt
    });
  });

  if (matchWithStoreOrders) {
    orders.forEach(o => {
      const ph = normalizePhoneKey(o.customerPhone);
      const tk = normalizeTrackingCode(o.waybillNumber || o.bostaTrackingNumber || o.orderNumber || o.id);
      if (!ph || !tk) return;
      if (o.status === 'ملغي' && !o.waybillNumber) return;
      const isRetOrder = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام'].includes(o.status);
      const isDelOrder = isOrderDeliveredStatus(o);
      if (!isRetOrder && !isDelOrder) return;
      ingestPhoneShipment({
        phone: ph,
        trackingKey: tk,
        name: o.customerName,
        city: o.shippingArea,
        status: isRetOrder ? 'Returned' : 'Delivered',
        cod: Number(o.totalPrice) || 0,
        fees: Number(o.shippingFee) || 0,
        date: (o.date || '').slice(0, 10)
      });
    });
  }

  const customerRiskAlerts: CustomerRiskAlert[] = [];
  customerAggByPhone.forEach((agg, phone) => {
    if (agg.returnedCount < 2) return;
    const total = agg.trackingKeys.size;
    const rate = total > 0 ? Math.round((agg.returnedCount / total) * 100) : 100;
    const riskLevel: CustomerRiskAlert['riskLevel'] =
      agg.returnedCount >= 3 || (agg.returnedCount >= 2 && agg.deliveredCount === 0)
        ? 'critical'
        : rate >= 60
        ? 'high'
        : 'medium';
    customerRiskAlerts.push({
      id: `crisk_${phone}`,
      phone,
      customerNames: Array.from(agg.names),
      cities: Array.from(agg.cities),
      totalOrders: total,
      deliveredCount: agg.deliveredCount,
      returnedCount: agg.returnedCount,
      returnRatePercent: rate,
      totalReturnedFees: Math.round(agg.totalReturnedFees * 100) / 100,
      totalReturnedCodValue: Math.round(agg.totalReturnedCodValue * 100) / 100,
      lastOrderDate: agg.lastDate || undefined,
      sampleTrackingKeys: Array.from(agg.trackingKeys).slice(0, 6),
      riskLevel,
      reasonSummary: `سجّل ${agg.returnedCount} مرتجع من أصل ${total} طلب (نسبة رفض ${rate}%)${
        agg.names.size > 1 ? ` · استخدم ${agg.names.size} أسماء مختلفة على نفس الرقم` : ''
      }`
    });
  });
  customerRiskAlerts.sort((a, b) => b.returnedCount - a.returnedCount || b.returnRatePercent - a.returnRatePercent);

  // Radar #6: Exchange Shipments & Partial Delivery (PICK_AND_CHOOSE) Audit
  const exchangeAuditsRaw: ExchangeAuditAlert[] = [];
  const seenExchangeKeys = new Set<string>();
  const sheetRowByKeyForExch = new Map<string, SheetAuditRow>();
  sheetRows.forEach(sr => {
    if (sr.trackingKey && !sheetRowByKeyForExch.has(sr.trackingKey)) {
      sheetRowByKeyForExch.set(sr.trackingKey, sr);
    }
  });

  const evaluateExchangeOrPickOrder = (params: {
    tKey: string;
    effectiveType: string;
    st: string;
    pkgSize: string;
    pkgDesc: string;
    dropoffCity: string;
    brandName: string;
    customerName: string;
    phoneRaw: string;
    cashoutId?: string;
    shippingFees: number;
    cashCyclesCod: number;
    sheetDate?: string;
    op?: typeof bostaOpMetaByKey extends Map<string, infer V> ? V : never;
    idPrefix: string;
  }): ExchangeAuditAlert => {
    const {
      tKey,
      effectiveType,
      st,
      pkgSize,
      pkgDesc,
      dropoffCity,
      brandName,
      customerName,
      phoneRaw,
      cashoutId,
      shippingFees,
      cashCyclesCod,
      sheetDate,
      op,
      idPrefix
    } = params;

    const isPickAndChoose =
      /pick_and_choose|pick.*choose|جزئي|partial/i.test(effectiveType) ||
      /pick_and_choose|pick.*choose/i.test(op?.oldType || '');

    const zoneId = resolveBostaZoneId(dropoffCity);
    const sizeId = resolveBostaPackageSizeId(pkgSize);
    const expectedExch =
      zoneId && activeRateMatrix[zoneId]?.[sizeId]?.exchange !== undefined
        ? activeRateMatrix[zoneId][sizeId].exchange
        : undefined;
    const feeOver =
      shippingFees > 0 && expectedExch !== undefined && shippingFees > expectedExch + 1
        ? Math.round((shippingFees - expectedExch) * 1.14 * 100) / 100
        : 0;

    const effectiveStatusText = (op?.deliveryState || st || '').trim();
    const opStateLow = effectiveStatusText.toLowerCase();
    const isReturnedToOrigin =
      opStateLow.includes('returned to business') ||
      opStateLow.includes('returned to origin') ||
      opStateLow === 'returned';
    const isCancelledOrDeleted = opStateLow.includes('deleted') || opStateLow.includes('canceled');

    const matchedSheet = sheetRowByKeyForExch.get(tKey);
    const storeTotal = matchedSheet?.matchedOrder ? Number(matchedSheet.matchedOrder.totalPrice) || 0 : 0;
    const expectedFullCod = Math.max(storeTotal, op?.codAmount || 0);
    const collectedCod = cashCyclesCod > 0 ? cashCyclesCod : op?.codAmount || 0;
    const returnAttempts = op?.returnAttemptsCount || 0;

    let flag: ExchangeAuditAlert['oldItemStatusFlag'] = 'exchange_ok';
    const reasons: string[] = [];

    if (feeOver > 0) {
      flag = 'fee_overcharge';
      reasons.push(
        `شحن ${isPickAndChoose ? 'التسليم الجزئي' : 'التبديل'} ${shippingFees} ج.م أعلى من تعريفة الخطة (${expectedExch} ج.م، فرق +${feeOver} ج.م بالضريبة)`
      );
    }

    if (isPickAndChoose) {
      const hasPartialDeliveredState = opStateLow.includes('partial');
      const hasReducedCodCollection =
        cashCyclesCod > 0 &&
        expectedFullCod > 0 &&
        cashCyclesCod < expectedFullCod - Math.max(20, toleranceEgp);
      const hasPartialReturnSignal =
        returnAttempts > 0 ||
        hasPartialDeliveredState ||
        isReturnedToOrigin ||
        opStateLow.includes('returning') ||
        opStateLow.includes('rto') ||
        hasReducedCodCollection;

      if (!isCancelledOrDeleted) {
        if (!hasPartialReturnSignal && (isExplicitDeliveredStatus(effectiveStatusText) || opStateLow.includes('deliver'))) {
          // Customer accepted and paid for ALL items (0 return attempts, full COD, Delivered state)!
          reasons.push(
            `شحنة تسليم جزئي (PICK_AND_CHOOSE): الحالة (${effectiveStatusText}) · محاولات الإرجاع (${returnAttempts})${
              collectedCod > 0 ? ` · تحصيل كامل المبلغ (${collectedCod.toLocaleString()} ج.م)` : ''
            } ← العميل استلم جميع الأصناف ولم يرتجع شيء لمخزنك ✅${
              expectedExch && feeOver === 0 ? ` (تعريفة ${expectedExch} ج.م مطابقة)` : ''
            }`
          );
        } else if (hasPartialReturnSignal && isReturnedToOrigin) {
          reasons.push(
            `شحنة جزئي (PICK_AND_CHOOSE): رجع الصنف المرفوض لمخزنك (${effectiveStatusText} · محاولات الإرجاع: ${Math.max(1, returnAttempts)}${
              op?.deliveredAt ? ` بتاريخ ${op.deliveredAt}` : ''
            }) ✅`
          );
        } else if (
          hasPartialReturnSignal &&
          (opStateLow.includes('deliver') ||
            opStateLow.includes('returning') ||
            opStateLow.includes('hold') ||
            opStateLow.includes('exception') ||
            hasPartialDeliveredState)
        ) {
          if (flag === 'exchange_ok') flag = 'old_item_unreturned';
          const proofTxt = hasReducedCodCollection
            ? `تحصيل جزئي (${cashCyclesCod.toLocaleString()} من ${expectedFullCod.toLocaleString()} ج.م)`
            : `محاولات الإرجاع: ${returnAttempts}`;
          reasons.push(
            `شحنة جزئي (PICK_AND_CHOOSE): يوجد ارتجاع جزئي (${proofTxt}) وحالة Deliveries (${effectiveStatusText}) لم تصل بعد لـ Returned to origin — راجع استلام الصنف المرفوض!`
          );
        } else {
          reasons.push(`شحنة تسليم جزئي (PICK_AND_CHOOSE) حالتها: ${effectiveStatusText || '-'}`);
        }
      } else {
        reasons.push(`شحنة تسليم جزئي ملغاة (${effectiveStatusText})`);
      }
    } else {
      const isOldItemStuck =
        !isReturnedToOrigin &&
        !isCancelledOrDeleted &&
        (isExplicitDeliveredStatus(effectiveStatusText) ||
          opStateLow.includes('returning') ||
          opStateLow.includes('hold') ||
          opStateLow.includes('exception'));

      if (isOldItemStuck) {
        if (flag === 'exchange_ok') flag = 'old_item_unreturned';
        reasons.push(
          `بوليصة التبديل حالتها (${effectiveStatusText}) — تأكد من عودة الطرد القديم المستبدل لمخزنك`
        );
      }
      if (reasons.length === 0) {
        reasons.push(
          `تبديل مطابق لتعريفة الخطة${expectedExch ? ` (${expectedExch} ج.م)` : ''} وحالته: ${effectiveStatusText || '-'}`
        );
      }
    }

    return {
      id: `${idPrefix}_${tKey}`,
      trackingKey: tKey,
      customerName,
      customerPhone: phoneRaw,
      brandName,
      dropoffCity,
      packageDescription: pkgDesc || undefined,
      orderType: effectiveType,
      sheetStatus: effectiveStatusText,
      shippingFees,
      expectedExchangeFee: expectedExch,
      feeOvercharge: feeOver,
      oldItemStatusFlag: flag,
      isPickAndChoose,
      returnAttemptsCount: op ? returnAttempts : undefined,
      collectedCod: collectedCod > 0 ? collectedCod : undefined,
      expectedFullCod: expectedFullCod > 0 ? expectedFullCod : undefined,
      sheetDate,
      cashoutId: cashoutId || undefined,
      reasonSummary: reasons.join(' · ')
    };
  };

  cashCycleFiles.forEach(file => {
    file.rows.forEach(entry => {
      const raw = entry.raw;
      const tKey = normalizeTrackingCode(pickCell(raw, mapping.trackingCol, ['order id', 'tracking number', 'tracking']));
      if (!tKey || seenExchangeKeys.has(tKey)) return;
      const orderTypeRaw = String(pickCell(raw, undefined, ['order type', 'type']) || '').trim();
      const op = bostaOpMetaByKey.get(tKey);
      const effectiveType = orderTypeRaw || op?.sheetType || '';
      if (!/exchange|pick_and_choose|pick.*choose|تبديل/i.test(effectiveType)) return;
      seenExchangeKeys.add(tKey);

      const st = String(pickCell(raw, mapping.statusCol, ['order status', 'status']) || op?.deliveryState || '').trim();
      const pkgSize = String(pickCell(raw, undefined, ['package size']) || '').trim();
      const pkgDesc = String(pickCell(raw, undefined, ['package description', 'description']) || op?.packageDescription || '').trim();
      const dropoffCity = String(pickCell(raw, undefined, ['dropoff city', 'drop off city']) || op?.dropoffCity || '').trim();
      const brandName = String(pickCell(raw, undefined, ['business name', 'brand name']) || op?.brandName || '').trim();
      const customerName = String(pickCell(raw, undefined, ['customer name', 'consignee name']) || op?.customerName || '').trim();
      const phoneRaw = normalizePhoneKey(pickCell(raw, mapping.phoneCol, ['customer phone', 'consignee phone', 'phone']) || op?.phoneRaw);
      const cashoutId = normalizeTrackingCode(pickCell(raw, mapping.cashoutIdCol, ['cash-out id', 'cashout id']));
      const shippingFees = Math.abs(parseNumericCell(pickCell(raw, undefined, ['shipping fees'])));
      const cashCyclesCod = Math.abs(parseNumericCell(pickCell(raw, mapping.grossAmountCol, ['cod', 'cod amount'])));
      const sheetDate = formatSheetDateCell(pickCell(raw, mapping.dateCol, ['paid at', 'completed at', 'delivered at', 'date']));

      exchangeAuditsRaw.push(
        evaluateExchangeOrPickOrder({
          tKey,
          effectiveType,
          st,
          pkgSize,
          pkgDesc,
          dropoffCity,
          brandName,
          customerName,
          phoneRaw,
          cashoutId,
          shippingFees,
          cashCyclesCod,
          sheetDate,
          op,
          idPrefix: 'exch'
        })
      );
    });
  });

  bostaOpMetaByKey.forEach(op => {
    if (seenExchangeKeys.has(op.trackingKey)) return;
    if (!/exchange|pick_and_choose|pick.*choose|تبديل/i.test(op.sheetType || '')) return;
    seenExchangeKeys.add(op.trackingKey);

    exchangeAuditsRaw.push(
      evaluateExchangeOrPickOrder({
        tKey: op.trackingKey,
        effectiveType: op.sheetType || 'EXCHANGE',
        st: op.deliveryState,
        pkgSize: '',
        pkgDesc: op.packageDescription,
        dropoffCity: op.dropoffCity,
        brandName: op.brandName,
        customerName: op.customerName,
        phoneRaw: op.phoneRaw,
        shippingFees: 0,
        cashCyclesCod: 0,
        sheetDate: op.deliveredAt || op.updatedAt || op.pickedUpDate,
        op,
        idPrefix: 'exch_op'
      })
    );
  });

  // Also catch Split Send + Separate Customer Return Pickup (CRP) on same phone within 7 days instead of single Exchange fee
  const crpAndSendByPhone = new Map<string, SheetAuditRow[]>();
  sheetRows.forEach(r => {
    if (!r.phoneRaw || r.sheetStatus.toLowerCase().includes('deleted')) return;
    const arr = crpAndSendByPhone.get(r.phoneRaw) || [];
    arr.push(r);
    crpAndSendByPhone.set(r.phoneRaw, arr);
  });
  crpAndSendByPhone.forEach((rows, ph) => {
    const sends = rows.filter(r => /send|توصيل/i.test(r.sheetType || 'SEND') && !/crp|return/i.test(r.sheetType || ''));
    const crps = rows.filter(r => /crp|customer.*return|إرجاع من العميل/i.test(r.sheetType || ''));
    if (sends.length === 0 || crps.length === 0) return;
    const s = sends[0];
    const c = crps[0];
    if (seenExchangeKeys.has(`split_${ph}`)) return;
    seenExchangeKeys.add(`split_${ph}`);
    const estCombinedFees = Math.round((s.sheetFeesAmount + c.sheetFeesAmount) * 100) / 100;
    exchangeAuditsRaw.push({
      id: `exch_split_${s.trackingKey}_${c.trackingKey}`,
      trackingKey: s.trackingKey,
      secondaryTrackingKey: c.trackingKey,
      customerName: s.customerName || c.customerName,
      customerPhone: ph,
      brandName: s.brandName || c.brandName,
      dropoffCity: s.dropoffCity || c.dropoffCity,
      packageDescription: s.packageDescription || c.packageDescription,
      orderType: 'SEND + CRP (استبدال منفصل)',
      sheetStatus: `${s.sheetStatus} / ${c.sheetStatus}`,
      shippingFees: estCombinedFees,
      feeOvercharge: Math.round(Math.max(0, estCombinedFees - 120) * 100) / 100,
      oldItemStatusFlag: 'split_send_and_crp',
      sheetDate: s.sheetDate || c.sheetDate,
      reasonSummary: `تم عمل بوليصة إرسال (${s.trackingKey}) وبوليصة استرجاع منفصلة (${c.trackingKey}) لنفس الهاتف (${ph}) بإجمالي رسوم ${estCombinedFees.toLocaleString()} ج.م بدلاً من أوردرات تبديل (Exchange) موحدة الأرخص!`
    });
  });

  const missingCompensations = filterByBrand(missingCompensationsRaw);
  const feeAnomalies = filterByBrand(feeAnomaliesRaw).sort((a, b) => b.sheetFeesAmount - a.sheetFeesAmount);
  const stuckReturns = filterByBrand(stuckReturnsRaw).sort((a, b) => b.daysOverdue - a.daysOverdue);
  const onlineAndFlexAlerts = filterByBrand(onlineFlexRaw);
  const zeroAttemptReturns = filterByBrand(zeroAttemptRaw);
  const internalFraudAlerts = filterByBrand(internalFraudRaw);
  const exchangeAudits = filterByBrand(exchangeAuditsRaw);

  // --- Cross-Match Bosta Credits Vouchers (Customer Care Vouchers) against Fee Anomalies & Deliveries Export ---
  // Pass 1: Match by explicit or manually-bound trackingNumber on the Bosta Credit row
  const positiveCreditVouchers = creditEntries.filter(c => c.amount > 0);
  positiveCreditVouchers.forEach(cr => {
    if (!cr.trackingNumber) return;
    const targetAnomaly = feeAnomalies.find(
      a => !a.compensatedInCredits && a.trackingKey === cr.trackingNumber
    );
    if (targetAnomaly) {
      targetAnomaly.compensatedInCredits = true;
      targetAnomaly.compensatedVia = 'bosta_credits';
      targetAnomaly.creditVoucherTxId = cr.transactionId;
      targetAnomaly.creditVoucherAmount = cr.amount;
      targetAnomaly.creditVoucherDate = cr.date;
      targetAnomaly.creditMatchType = 'tracking_number';
      targetAnomaly.netUncompensatedOvercharge = Math.max(
        0,
        Math.round((targetAnomaly.overchargeEstimate - cr.amount) * 100) / 100
      );
      cr.matchStatus = 'matched_by_tracking';
      cr.matchedAnomalyTrackingKey = targetAnomaly.trackingKey;
      cr.matchedAnomalyCustomerName = targetAnomaly.customerName;
      cr.matchedAnomalyProduct = targetAnomaly.packageDescription;
      cr.matchedAnomalyZone = targetAnomaly.zoneLabelAr || targetAnomaly.dropoffCity;
      cr.matchedAnomalySize = targetAnomaly.packageSize;
      return;
    }

    // Check if the trackingNumber appears in Cash Cycles (even without anomaly) or in Deliveries Export (earlier Cash Cycle!)
    const opMatch = bostaOpMetaByKey.get(cr.trackingNumber);
    const rowMatch = sheetRows.find(r => r.trackingKey === cr.trackingNumber);
    if (opMatch || rowMatch) {
      cr.matchStatus = 'matched_in_deliveries_earlier_cycle';
      cr.matchedAnomalyTrackingKey = cr.trackingNumber;
      cr.matchedAnomalyCustomerName = rowMatch?.customerName || opMatch?.customerName || cr.matchedAnomalyCustomerName;
      cr.matchedAnomalyProduct = rowMatch?.packageDescription || opMatch?.packageDescription || cr.matchedAnomalyProduct;
      cr.matchedAnomalyZone = rowMatch?.dropoffCity || opMatch?.dropoffCity || cr.matchedAnomalyZone;
      cr.matchedAnomalyDate =
        rowMatch?.sheetDeliveredAt ||
        rowMatch?.sheetDate ||
        opMatch?.deliveredAt ||
        opMatch?.updatedAt ||
        opMatch?.pickedUpDate;
      cr.matchedAnomalyState = rowMatch?.sheetStatus || opMatch?.deliveryState;
    }
  });

  // Pass 2: Match blank-tracking Customer Care Vouchers by exact tax-inclusive amount fingerprint
  // Only pin a 1-to-1 tracking key when unambiguous (1 voucher + 1 anomaly at that amount);
  // when multiple identical-amount vouchers have blank CSV tracking_numbers, cover the anomalies pool
  // financially without guessing which transaction_id belongs to which tracking number!
  const remainingVouchers = positiveCreditVouchers.filter(
    cr =>
      cr.matchStatus !== 'matched_by_tracking' &&
      cr.matchStatus !== 'matched_in_deliveries_earlier_cycle'
  );
  const vouchersByAmtBucket = new Map<number, BostaCreditEntry[]>();
  remainingVouchers.forEach(cr => {
    const bucket = Math.round(cr.amount * 100);
    const list = vouchersByAmtBucket.get(bucket) || [];
    list.push(cr);
    vouchersByAmtBucket.set(bucket, list);
  });

  vouchersByAmtBucket.forEach(groupVouchers => {
    const sampleAmt = groupVouchers[0].amount;
    const rateAnoms = feeAnomalies.filter(
      a =>
        !a.compensatedInCredits &&
        a.isRateOrSizeOvercharge &&
        (Math.abs(a.overchargeEstimate - sampleAmt) <= 0.5 ||
          (typeof a.rateAndSizeOverchargeWithVat === 'number' &&
            Math.abs(a.rateAndSizeOverchargeWithVat - sampleAmt) <= 0.5))
    );
    const fallbackAnoms =
      rateAnoms.length > 0
        ? rateAnoms
        : feeAnomalies.filter(
            a => !a.compensatedInCredits && Math.abs(a.overchargeEstimate - sampleAmt) <= 0.5
          );

    if (groupVouchers.length === 1 && fallbackAnoms.length === 1) {
      const cr = groupVouchers[0];
      const candidateAnomaly = fallbackAnoms[0];
      candidateAnomaly.compensatedInCredits = true;
      candidateAnomaly.compensatedVia = 'bosta_credits';
      candidateAnomaly.creditVoucherTxId = cr.transactionId;
      candidateAnomaly.creditVoucherAmount = cr.amount;
      candidateAnomaly.creditVoucherDate = cr.date;
      candidateAnomaly.creditMatchType = 'amount_fingerprint';
      candidateAnomaly.netUncompensatedOvercharge = Math.max(
        0,
        Math.round((candidateAnomaly.overchargeEstimate - cr.amount) * 100) / 100
      );
      cr.matchStatus = 'matched_by_fingerprint';
      cr.matchedAnomalyTrackingKey = candidateAnomaly.trackingKey;
      cr.matchedAnomalyCustomerName = candidateAnomaly.customerName;
      cr.matchedAnomalyProduct = candidateAnomaly.packageDescription;
      cr.matchedAnomalyZone = candidateAnomaly.zoneLabelAr || candidateAnomaly.dropoffCity;
      cr.matchedAnomalySize = candidateAnomaly.packageSize;
      return;
    }

    if (fallbackAnoms.length > 0) {
      // Financially mark up to groupVouchers.length anomalies as covered by the Credits pool
      // so user does not double-claim them, while keeping Credit rows honest as ambiguous until bound/pasted.
      const coveredCount = Math.min(groupVouchers.length, fallbackAnoms.length);
      const candidateKeys = fallbackAnoms.slice(0, coveredCount).map(a => a.trackingKey);
      for (let i = 0; i < coveredCount; i++) {
        const a = fallbackAnoms[i];
        a.compensatedInCredits = true;
        a.compensatedVia = 'bosta_credits';
        a.creditVoucherTxId = `مجموعة قسائم (${sampleAmt.toFixed(2)})`;
        a.creditVoucherAmount = sampleAmt;
        a.creditVoucherDate = groupVouchers[0].date;
        a.creditMatchType = 'amount_fingerprint';
        a.netUncompensatedOvercharge = Math.max(
          0,
          Math.round((a.overchargeEstimate - sampleAmt) * 100) / 100
        );
      }
      groupVouchers.forEach(cr => {
        cr.matchStatus = 'ambiguous_pool_needs_binding';
        cr.candidateTrackingKeys = candidateKeys;
      });
    } else {
      groupVouchers.forEach(cr => {
        cr.matchStatus = 'surplus_unmatched_voucher';
      });
    }
  });

  // Pass 3: Cross-check uncompensated FeeAnomalies against Cash Wallet Compensations & Compensations CSV so no fee anomaly is double-claimed
  feeAnomalies.forEach(a => {
    if (a.compensatedInCredits) return;
    const compDirect = rawCompensations.find(
      c => c.orderId === a.trackingKey || (c.orderReference && c.orderReference === a.trackingKey)
    );
    if (compDirect && Math.abs(compDirect.compensationAmount - a.overchargeEstimate) <= 2) {
      a.compensatedInCredits = true;
      a.compensatedVia = 'compensations_sheet';
      a.creditVoucherTxId = compDirect.compensationId;
      a.creditVoucherAmount = compDirect.compensationAmount;
      a.creditVoucherDate = compDirect.compensationDate;
      a.netUncompensatedOvercharge = Math.max(
        0,
        Math.round((a.overchargeEstimate - compDirect.compensationAmount) * 100) / 100
      );
      return;
    }
    const walletCompMatch = walletCompensations.find(
      w =>
        w.auditStatus === 'undocumented_in_comp_sheet' &&
        (Math.abs(w.amount - a.overchargeEstimate) <= 0.5 ||
          (typeof a.rateAndSizeOverchargeWithVat === 'number' &&
            Math.abs(w.amount - a.rateAndSizeOverchargeWithVat) <= 0.5))
    );
    if (walletCompMatch && a.sheetCashoutId && walletCompMatch.cashoutId === a.sheetCashoutId) {
      a.compensatedInCredits = true;
      a.compensatedVia = 'cash_wallet';
      a.creditVoucherTxId = walletCompMatch.transactionId;
      a.creditVoucherAmount = walletCompMatch.amount;
      a.creditVoucherDate = walletCompMatch.date;
      a.creditMatchType = 'amount_fingerprint';
      a.netUncompensatedOvercharge = Math.max(
        0,
        Math.round((a.overchargeEstimate - walletCompMatch.amount) * 100) / 100
      );
    }
  });

  const matchedVouchers = positiveCreditVouchers.filter(
    c => c.matchStatus === 'matched_by_tracking' || c.matchStatus === 'matched_by_fingerprint'
  );
  const earlierCycleMatchedVouchers = positiveCreditVouchers.filter(
    c => c.matchStatus === 'matched_in_deliveries_earlier_cycle'
  );
  const surplusVouchers = positiveCreditVouchers.filter(
    c =>
      c.matchStatus === 'surplus_unmatched_voucher' ||
      c.matchStatus === 'ambiguous_pool_needs_binding'
  );
  const uncompensatedRateSizeAnomalies = feeAnomalies.filter(
    a => a.isRateOrSizeOvercharge && !a.compensatedInCredits
  );
  let creditsUsedInCashCycles = 0;
  cashCycleFiles.forEach(file => {
    file.rows.forEach(entry => {
      const bCr = parseNumericCell(pickCell(entry.raw, undefined, ['bosta credits']));
      if (bCr > 0) creditsUsedInCashCycles += bCr;
    });
  });

  const bostaCreditsSummary: BostaCreditsAuditSummary = {
    hasCreditsSheet: creditsFiles.length > 0,
    currentCreditsBalance,
    totalAddedCredits: Math.round(totalAddedCredits * 100) / 100,
    totalSpentCredits: Math.round(totalSpentCredits * 100) / 100,
    voucherCreditsAmount: Math.round(voucherCreditsAmount * 100) / 100,
    packagingPaymentsAmount: Math.round(packagingPaymentsAmount * 100) / 100,
    walletIntegrityStatus: creditsIntegrityStatus,
    matchedVoucherCount: matchedVouchers.length,
    matchedVoucherAmount:
      Math.round(matchedVouchers.reduce((s, c) => s + c.amount, 0) * 100) / 100,
    earlierCycleMatchedCount: earlierCycleMatchedVouchers.length,
    earlierCycleMatchedAmount:
      Math.round(earlierCycleMatchedVouchers.reduce((s, c) => s + c.amount, 0) * 100) / 100,
    surplusUnmatchedVoucherCount: surplusVouchers.length,
    surplusUnmatchedVoucherAmount:
      Math.round(surplusVouchers.reduce((s, c) => s + c.amount, 0) * 100) / 100,
    uncompensatedRateSizeAnomaliesCount: uncompensatedRateSizeAnomalies.length,
    uncompensatedRateSizeAnomaliesAmount:
      Math.round(
        uncompensatedRateSizeAnomalies.reduce((s, a) => s + a.netUncompensatedOvercharge, 0) * 100
      ) / 100,
    creditsUsedInCashCycles: Math.round(creditsUsedInCashCycles * 100) / 100,
    entries: creditEntries
  };

  // Payout SLA Lag Summary (#7: Delayed Paid + Unpaid Overdue + Skipped Out-of-Order Cashouts)
  const slaThresholdDays = Math.max(graceDaysForInTransit, 7);
  const lagRowsWithDays = filteredSheetRows.filter(
    r =>
      r.category !== 'duplicate' &&
      r.sheetNetPayout > 0 &&
      typeof r.payoutLagDays === 'number' &&
      Boolean(r.sheetPaidAt)
  );
  const delayedPaidRows: PayoutSlaEntry[] = lagRowsWithDays
    .filter(r => (r.payoutLagDays as number) > slaThresholdDays)
    .map(r => ({
      trackingKey: r.trackingKey,
      customerName: r.matchedOrder?.customerName || r.customerName,
      cashoutId: r.sheetCashoutId,
      confirmedDate: r.sheetDeliveredAt || '-',
      paidDate: r.sheetPaidAt || '-',
      lagDays: r.payoutLagDays as number,
      netAmount: r.sheetNetPayout,
      statusFlag: 'paid_delayed'
    }));

  const maxPaidConfirmedMs = lagRowsWithDays.reduce((maxMs, r) => {
    const dt = r.sheetDeliveredAt && /^\d{4}-\d{2}-\d{2}$/.test(r.sheetDeliveredAt)
      ? Date.parse(`${r.sheetDeliveredAt}T00:00:00Z`)
      : NaN;
    return Number.isFinite(dt) && dt > maxMs ? dt : maxMs;
  }, 0);
  const maxPaidAtMs = lagRowsWithDays.reduce((maxMs, r) => {
    const dt = r.sheetPaidAt && /^\d{4}-\d{2}-\d{2}$/.test(r.sheetPaidAt)
      ? Date.parse(`${r.sheetPaidAt}T00:00:00Z`)
      : NaN;
    return Number.isFinite(dt) && dt > maxMs ? dt : maxMs;
  }, 0);
  const slaRefMs = Math.max(nowMs, maxPaidAtMs);

  let unpaidOverdueCount = 0;
  let skippedOutOfOrderCount = 0;
  const unpaidSlaRows: PayoutSlaEntry[] = [];
  collectedUntransferred.forEach(r => {
    const confStr = r.sheetDeliveredAt || r.sheetDate || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(confStr) || r.sheetNetPayout <= 0) return;
    const confMs = Date.parse(`${confStr}T00:00:00Z`);
    if (!Number.isFinite(confMs)) return;
    const lagDays = Math.max(0, Math.round((slaRefMs - confMs) / 86400000));
    const isSkipped = maxPaidConfirmedMs > 0 && confMs < maxPaidConfirmedMs;
    const isOverdue = lagDays > slaThresholdDays;
    if (isSkipped || isOverdue) {
      if (isSkipped) skippedOutOfOrderCount += 1;
      else unpaidOverdueCount += 1;
      unpaidSlaRows.push({
        trackingKey: r.trackingKey,
        customerName: r.matchedOrder?.customerName || r.customerName,
        cashoutId: r.sheetCashoutId || 'لم ينزل Cash-out',
        confirmedDate: confStr,
        paidDate: isSkipped ? 'تخطاه التحويل (شحنات أحدث اتدفعت)' : 'لم يُحوّل بعد',
        lagDays,
        netAmount: r.sheetNetPayout,
        statusFlag: isSkipped ? 'skipped_out_of_order' : 'unpaid_overdue'
      });
    }
  });

  const allDelayedSlaRows = [...delayedPaidRows, ...unpaidSlaRows].sort((a, b) => b.lagDays - a.lagDays);

  const avgPayoutLagDays =
    lagRowsWithDays.length > 0
      ? Math.round(
          (lagRowsWithDays.reduce((s, r) => s + (r.payoutLagDays as number), 0) /
            lagRowsWithDays.length) *
            10
        ) / 10
      : 0;
  const maxPayoutLagDays =
    lagRowsWithDays.length > 0
      ? Math.max(...lagRowsWithDays.map(r => r.payoutLagDays as number))
      : 0;

  const payoutSlaSummary: PayoutSlaSummary = {
    hasPaidAtData: lagRowsWithDays.length > 0 || unpaidSlaRows.length > 0,
    evaluatedCount: lagRowsWithDays.length,
    avgLagDays: avgPayoutLagDays,
    maxLagDays: Math.max(maxPayoutLagDays, ...unpaidSlaRows.map(u => u.lagDays), 0),
    slaThresholdDays,
    delayedCount: allDelayedSlaRows.length,
    unpaidOverdueCount,
    skippedOutOfOrderCount,
    delayedAmount: Math.round(allDelayedSlaRows.reduce((s, r) => s + r.netAmount, 0) * 100) / 100,
    delayedRows: allDelayedSlaRows
  };

  let returnedInsuranceCount = 0;
  let returnedInsuranceWithVat = 0;
  let returnedOpeningCount = 0;
  let returnedOpeningWithVat = 0;
  let returnedConfirmedToWarehouseCount = 0;
  let returnedNotInWarehouseCount = 0;
  let returnedStockNotRestoredCount = 0;
  notCollectedCustomer.forEach(r => {
    const ins = r.feeBreakdown?.insuranceFees || 0;
    const opn = r.feeBreakdown?.openingPackageFees || 0;
    if (ins > 0) {
      returnedInsuranceCount += 1;
      returnedInsuranceWithVat += Math.round(ins * 1.14 * 100) / 100;
    }
    if (opn > 0) {
      returnedOpeningCount += 1;
      returnedOpeningWithVat += Math.round(opn * 1.14 * 100) / 100;
    }
    if (r.warehouseReturnStatus === 'returned_to_merchant_confirmed') {
      returnedConfirmedToWarehouseCount += 1;
    } else if (r.warehouseReturnStatus === 'returned_stock_not_restored') {
      returnedStockNotRestoredCount += 1;
    } else if (
      r.warehouseReturnStatus === 'still_at_bosta_hub' ||
      r.warehouseReturnStatus === 'no_return_proof'
    ) {
      returnedNotInWarehouseCount += 1;
    }
  });
  returnedInsuranceWithVat = Math.round(returnedInsuranceWithVat * 100) / 100;
  returnedOpeningWithVat = Math.round(returnedOpeningWithVat * 100) / 100;

  const untouchedOpenRows = feeAnomalies.filter(f => f.isInvalidOpeningOnUntouchedReturn);
  const returnedUntouchedOpeningCount = untouchedOpenRows.length;
  const returnedUntouchedOpeningWithVat =
    Math.round(
      untouchedOpenRows.reduce((s, f) => s + Math.round(f.openingPackageFees * 1.14 * 100) / 100, 0) * 100
    ) / 100;
  const forbiddenOpenRows = feeAnomalies.filter(f => f.isForbiddenOpenFeeAnomaly);
  const forbiddenOpenFeeCount = forbiddenOpenRows.length;
  const forbiddenOpenFeeWithVat =
    Math.round(
      forbiddenOpenRows.reduce((s, f) => s + Math.round(f.openingPackageFees * 1.14 * 100) / 100, 0) * 100
    ) / 100;
  const zeroCodDeliveredCount = feeAnomalies.filter(f => f.isZeroCodDeliveredAnomaly).length;
  const productPriceAlerts = internalFraudAlerts.filter(f => f.fraudType === 'product_price_anomaly');
  const productPriceAnomalyCount = productPriceAlerts.length;
  const productPriceAnomalyAmount =
    Math.round(productPriceAlerts.reduce((s, f) => s + f.financialRiskAmount, 0) * 100) / 100;
  const exchangeIssues = exchangeAudits.filter(e => e.oldItemStatusFlag !== 'exchange_ok');
  const exchangeIssueCount = exchangeIssues.length;
  const exchangeRiskAmount =
    Math.round(exchangeIssues.reduce((s, e) => s + e.feeOvercharge, 0) * 100) / 100;

  // Delivery & Pickup Operational SLA + WhatsApp Confirmation vs Return Impact + On Hold Trials
  const nowYmdStr = new Date(nowMs).toISOString().slice(0, 10);
  const dayDiffUtc = (laterYmd?: string, earlierYmd?: string): number => {
    if (!laterYmd || !earlierYmd || !/^\d{4}-\d{2}-\d{2}$/.test(laterYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(earlierYmd)) {
      return 0;
    }
    const msLater = Date.parse(`${laterYmd}T00:00:00Z`);
    const msEarlier = Date.parse(`${earlierYmd}T00:00:00Z`);
    if (!Number.isFinite(msLater) || !Number.isFinite(msEarlier)) return 0;
    return Math.floor((msLater - msEarlier) / 86400000);
  };

  let totalWithExpectedDate = 0;
  let delayedDeliveredCount = 0;
  let overdueActiveCount = 0;
  let returnedAfterDelayCount = 0;
  let pickupDelayedCount = 0;
  let onHoldAffectedCount = 0;
  let waTotalWithStatus = 0;
  let waConfirmedCount = 0;
  let waConfirmedReturnedCount = 0;
  let waNoResponseCount = 0;
  let waNoResponseReturnedCount = 0;
  let waFailedCount = 0;
  let waFailedReturnedCount = 0;
  const deliverySlaItemsRaw: DeliverySlaItem[] = [];
  let hasDeliveriesSlaData = false;

  bostaOpMetaByKey.forEach(op => {
    if (normalizedBrandFilter !== 'all' && normalizeBrandKey(op.brandName) !== normalizedBrandFilter) {
      return;
    }
    hasDeliveriesSlaData = true;
    const stLow = (op.deliveryState || '').toLowerCase();
    const isDelOp = isExplicitDeliveredStatus(op.deliveryState);
    const isRetOp = isReturnedOrUncollectedStatus(op.deliveryState);
    const isCanceledBeforePickup = stLow.includes('cancel');
    const isTerminatedOp = stLow.includes('terminat') || stLow.includes('lost') || stLow.includes('damag');

    const waLow = (op.whatsappStatus || '').trim().toLowerCase();
    if (waLow && waLow !== 'n/a') {
      waTotalWithStatus += 1;
      if (waLow.includes('confirm')) {
        waConfirmedCount += 1;
        if (isRetOp) waConfirmedReturnedCount += 1;
      } else if (waLow.includes('no response') || waLow.includes('no_response')) {
        waNoResponseCount += 1;
        if (isRetOp) waNoResponseReturnedCount += 1;
      } else if (waLow.includes('fail')) {
        waFailedCount += 1;
        if (isRetOp) waFailedReturnedCount += 1;
      }
    }

    if (op.onHoldTrials > 0) {
      onHoldAffectedCount += 1;
    }

    let delayDays = 0;
    let slaCat: DeliverySlaItem['slaCategory'] | null = null;
    if (op.expectedDeliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(op.expectedDeliveryDate)) {
      totalWithExpectedDate += 1;
      if (isDelOp && op.deliveredAt && /^\d{4}-\d{2}-\d{2}$/.test(op.deliveredAt)) {
        const diff = dayDiffUtc(op.deliveredAt, op.expectedDeliveryDate);
        if (diff >= 1) {
          delayDays = diff;
          delayedDeliveredCount += 1;
          slaCat = 'delivered_late';
        }
      } else if (isRetOp && !isCanceledBeforePickup) {
        const refEnd =
          (op.updatedAt && /^\d{4}-\d{2}-\d{2}$/.test(op.updatedAt) ? op.updatedAt : '') ||
          (op.deliveredAt && /^\d{4}-\d{2}-\d{2}$/.test(op.deliveredAt) ? op.deliveredAt : '') ||
          nowYmdStr;
        const diff = dayDiffUtc(refEnd, op.expectedDeliveryDate);
        if (diff >= 1) {
          delayDays = diff;
          returnedAfterDelayCount += 1;
          slaCat = 'returned_after_delay';
        }
      } else if (!isDelOp && !isRetOp && !isCanceledBeforePickup && !isTerminatedOp) {
        const diff = dayDiffUtc(nowYmdStr, op.expectedDeliveryDate);
        if (diff >= 1) {
          delayDays = diff;
          overdueActiveCount += 1;
          slaCat = 'overdue_active';
        }
      }
    }

    let pickupDelayDays = 0;
    if (
      op.expectedPickupDate &&
      op.pickedUpDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(op.expectedPickupDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(op.pickedUpDate)
    ) {
      const pDiff = dayDiffUtc(op.pickedUpDate, op.expectedPickupDate);
      if (pDiff >= 1) {
        pickupDelayDays = pDiff;
        pickupDelayedCount += 1;
      }
    }

    if (slaCat || pickupDelayDays >= 1 || op.onHoldTrials > 0) {
      const finalCat: DeliverySlaItem['slaCategory'] = slaCat || 'pickup_delayed';
      const reasonParts: string[] = [];
      if (slaCat === 'returned_after_delay') {
        reasonParts.push(
          `ارتجعت بعد تأخير ${delayDays} يوم عن موعد التسليم المتوقع (${op.expectedDeliveryDate})`
        );
      } else if (slaCat === 'overdue_active') {
        reasonParts.push(
          `شحنة جارية متجاوزة لموعد التسليم المتوقع (${op.expectedDeliveryDate}) بـ ${delayDays} يوم`
        );
      } else if (slaCat === 'delivered_late') {
        reasonParts.push(
          `سُلّمت متأخرة ${delayDays} يوم (متوقع ${op.expectedDeliveryDate} ← فعلي ${op.deliveredAt})`
        );
      }
      if (pickupDelayDays >= 1) {
        reasonParts.push(
          `تأخر البيك أب عن الموعد المتوقع بـ ${pickupDelayDays} يوم (${op.expectedPickupDate} ← ${op.pickedUpDate})`
        );
      }
      if (op.onHoldTrials > 0) {
        reasonParts.push(`مرات تعليق On-Hold: ${op.onHoldTrials}`);
      }
      if (op.whatsappStatus) {
        reasonParts.push(`واتساب بوسطة: ${op.whatsappStatus}`);
      }
      if (op.exceptionReason) {
        reasonParts.push(`سبب الاستثناء: ${op.exceptionReason}`);
      }

      deliverySlaItemsRaw.push({
        id: `dsla_${op.trackingKey}`,
        trackingKey: op.trackingKey,
        customerName: op.customerName || undefined,
        customerPhone: op.phoneRaw || undefined,
        brandName: op.brandName || undefined,
        dropoffCity: op.dropoffCity || undefined,
        deliveryState: op.deliveryState,
        expectedPickupDate: op.expectedPickupDate || undefined,
        pickedUpDate: op.pickedUpDate || undefined,
        expectedDeliveryDate: op.expectedDeliveryDate || undefined,
        scheduledAt: op.scheduledAt || undefined,
        actualDeliveredAt: op.deliveredAt || undefined,
        delayDays,
        pickupDelayDays,
        onHoldTrials: op.onHoldTrials,
        whatsappStatus: op.whatsappStatus || undefined,
        notes: op.notes || undefined,
        latestExceptionReason: op.exceptionReason || undefined,
        slaCategory: finalCat,
        reasonSummary: reasonParts.join(' · ')
      });
    }
  });

  const slaOrderPriority: Record<DeliverySlaItem['slaCategory'], number> = {
    returned_after_delay: 0,
    overdue_active: 1,
    delivered_late: 2,
    pickup_delayed: 3
  };
  deliverySlaItemsRaw.sort((a, b) => {
    const pDiff = slaOrderPriority[a.slaCategory] - slaOrderPriority[b.slaCategory];
    if (pDiff !== 0) return pDiff;
    return Math.max(b.delayDays, b.pickupDelayDays) - Math.max(a.delayDays, a.pickupDelayDays);
  });

  const deliverySlaSummary: DeliverySlaSummary = {
    hasDeliveriesSlaData,
    totalWithExpectedDate,
    delayedDeliveredCount,
    overdueActiveCount,
    returnedAfterDelayCount,
    pickupDelayedCount,
    onHoldAffectedCount,
    whatsappStats: {
      totalWithStatus: waTotalWithStatus,
      confirmedCount: waConfirmedCount,
      confirmedReturnedCount: waConfirmedReturnedCount,
      confirmedReturnRate:
        waConfirmedCount > 0 ? Math.round((waConfirmedReturnedCount / waConfirmedCount) * 1000) / 10 : 0,
      noResponseCount: waNoResponseCount,
      noResponseReturnedCount: waNoResponseReturnedCount,
      noResponseReturnRate:
        waNoResponseCount > 0 ? Math.round((waNoResponseReturnedCount / waNoResponseCount) * 1000) / 10 : 0,
      failedCount: waFailedCount,
      failedReturnedCount: waFailedReturnedCount,
      failedReturnRate:
        waFailedCount > 0 ? Math.round((waFailedReturnedCount / waFailedCount) * 1000) / 10 : 0
    },
    items: deliverySlaItemsRaw
  };

  const returnedFeesDeducted =
    Math.round(
      notCollectedCustomer
        .filter(r => r.sheetNetPayout < 0)
        .reduce((s, r) => s + Math.abs(r.sheetNetPayout), 0) * 100
    ) / 100;

  const grossFeeOverchargeAmount =
    Math.round(feeAnomalies.reduce((s, i) => s + i.overchargeEstimate, 0) * 100) / 100;
  const compensatedInCreditsFeeAmount =
    Math.round(
      feeAnomalies
        .filter(i => i.compensatedInCredits)
        .reduce((s, i) => s + (i.creditVoucherAmount || 0), 0) * 100
    ) / 100;
  const netFeeOverchargeAmount =
    Math.round(feeAnomalies.reduce((s, i) => s + i.netUncompensatedOvercharge, 0) * 100) / 100;

  return {
    matchWithStoreOrders,
    availableSheetBrands,
    sheetRows: filteredSheetRows,
    matchedReady,
    collectedUntransferred,
    notCollectedCustomer,
    inTransitInSheet,
    shortPaid,
    overPaid,
    duplicates,
    notFound,
    uncollectedDelivered,
    inTransitOverdue,
    missingCompensations,
    feeAnomalies,
    stuckReturns,
    onlineAndFlexAlerts,
    zeroAttemptReturns,
    internalFraudAlerts,
    exchangeAudits,
    customerRiskAlerts,
    transactionsSummary,
    compensationsSummary,
    pickupRequestsSummary,
    pickupFeeAudits,
    bostaCreditsSummary,
    payoutSlaSummary,
    deliverySlaSummary,
    healthyInTransitCount,
    alreadySettledCount,
    totals: {
      uncollectedDeliveredAmount:
        Math.round(
          uncollectedDelivered.reduce((s, i) => s + i.expectation.expectedNetPayout, 0) * 100
        ) / 100,
      collectedUntransferredAmount:
        Math.round(collectedUntransferred.reduce((s, i) => s + i.sheetNetPayout, 0) * 100) / 100,
      collectedUntransferredGross:
        Math.round(collectedUntransferred.reduce((s, i) => s + i.sheetGrossAmount, 0) * 100) / 100,
      inTransitOverdueAmount:
        Math.round(
          inTransitOverdue.reduce((s, i) => s + i.expectation.expectedNetPayout, 0) * 100
        ) / 100,
      shortPaidDeficitAmount:
        Math.round(shortPaid.reduce((s, i) => s + Math.abs(i.netVariance), 0) * 100) / 100,
      overPaidSurplusAmount:
        Math.round(overPaid.reduce((s, i) => s + Math.max(0, i.netVariance), 0) * 100) / 100,
      matchedReadyNetAmount:
        Math.round(matchedReady.reduce((s, i) => s + i.sheetNetPayout, 0) * 100) / 100,
      matchedReadyExpectedNet:
        Math.round(
          matchedReady.reduce((s, i) => s + (i.expectation?.expectedNetPayout || 0), 0) * 100
        ) / 100,
      totalSheetNetAmount:
        Math.round(filteredSheetRows.reduce((s, i) => s + i.sheetNetPayout, 0) * 100) / 100,
      returnedFeesDeducted,
      returnedInsuranceCount,
      returnedInsuranceWithVat,
      returnedOpeningCount,
      returnedOpeningWithVat,
      returnedUntouchedOpeningCount,
      returnedUntouchedOpeningWithVat,
      forbiddenOpenFeeCount,
      forbiddenOpenFeeWithVat,
      returnedConfirmedToWarehouseCount,
      returnedNotInWarehouseCount,
      returnedStockNotRestoredCount,
      zeroCodDeliveredCount,
      missingCompensationsAmount:
        Math.round(missingCompensations.reduce((s, i) => s + i.estimatedValue, 0) * 100) / 100,
      underCompensatedCount: compensationsSummary.underCompensatedCount,
      underCompensatedShortfallAmount: compensationsSummary.underCompensatedShortfallAmount,
      totalFeeOverchargeAmount: netFeeOverchargeAmount,
      grossFeeOverchargeAmount,
      compensatedInCreditsFeeAmount,
      uncompensatedRateSizeOverchargeAmount: bostaCreditsSummary.uncompensatedRateSizeAnomaliesAmount,
      stuckReturnsValueAmount:
        Math.round(stuckReturns.reduce((s, i) => s + i.codAmount, 0) * 100) / 100,
      onlineAndFlexAmount:
        Math.round(
          onlineAndFlexAlerts.reduce(
            (s, i) => s + i.onlinePaymentAmount + i.depositAmount + i.flexShipValue,
            0
          ) * 100
        ) / 100,
      zeroAttemptFeesAmount:
        Math.round(zeroAttemptReturns.reduce((s, i) => s + i.shippingFeesDeducted, 0) * 100) / 100,
      internalFraudRiskAmount:
        Math.round(internalFraudAlerts.reduce((s, i) => s + i.financialRiskAmount, 0) * 100) / 100,
      productPriceAnomalyCount,
      productPriceAnomalyAmount,
      exchangeIssueCount,
      exchangeRiskAmount,
      customerRiskBurnedFees:
        Math.round(customerRiskAlerts.reduce((s, i) => s + i.totalReturnedFees, 0) * 100) / 100,
      wrongfulPickupFeeAmount,
      wrongfulPickupFeeCount: wrongfulPickupFeeEntries.length,
      crossBrandSwapCount: filteredCrossBrandSwaps.length,
      crossBrandSwappedReturnsCount,
      undocumentedWalletCompCount: transactionsSummary.undocumentedWalletCompCount,
      undocumentedWalletCompAmount: transactionsSummary.undocumentedWalletCompAmount,
      delayedPayoutsCount: payoutSlaSummary.delayedCount,
      avgPayoutLagDays: payoutSlaSummary.avgLagDays
    }
  };
}

export function exportCodClaimWorkbook(result: TwoWayCodAuditResult, storeName: string) {
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      'البند المالي': 'شحنات حصلتها بوسطة ولم تحولها (Not Paid / بدون Cash-out ID)',
      'العدد': result.collectedUntransferred.length,
      'الإجمالي (ج.م)': result.totals.collectedUntransferredAmount
    },
    {
      'البند المالي': 'أوردرات مسلّمة بالطلبات لم تظهر بأي شيت أو دفعة',
      'العدد': result.uncollectedDelivered.length,
      'الإجمالي (ج.م)': result.totals.uncollectedDeliveredAmount
    },
    {
      'البند المالي': 'عجز في التحويلات بالشيت (ناقص فلوس)',
      'العدد': result.shortPaid.length,
      'الإجمالي (ج.م)': result.totals.shortPaidDeficitAmount
    },
    {
      'البند المالي': 'شحنات في الطريق متجاوزة المهلة',
      'العدد': result.inTransitOverdue.length,
      'الإجمالي (ج.م)': result.totals.inTransitOverdueAmount
    },
    {
      'البند المالي': 'شحنات مطابقة ومثبت تحويلها وجاهزة للاعتماد',
      'العدد': result.matchedReady.length,
      'الإجمالي (ج.م)': result.totals.matchedReadyNetAmount
    },
    {
      'البند المالي': 'مرتجعات وفشل تحصيل (إجمالي رسوم الشحن المخصومة)',
      'العدد': result.notCollectedCustomer.length,
      'الإجمالي (ج.م)': result.totals.returnedFeesDeducted
    },
    {
      'البند المالي': 'شحنات قيد التشغيل بالشيت (Ready / Warehouse / Picked Up)',
      'العدد': result.inTransitInSheet.length,
      'الإجمالي (ج.م)': result.inTransitInSheet.reduce((s, r) => s + r.sheetGrossAmount, 0)
    }
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'الملخص التنفيذي');

  const untransferredRows = result.collectedUntransferred.map(item => ({
    'رقم التتبع / البوليصة': item.trackingKey,
    'رقم الأوردر بالمتجر': item.matchedOrder?.orderNumber || item.businessRefKey || '-',
    'العميل': item.matchedOrder?.customerName || item.customerName || '-',
    'الهاتف': item.phoneRaw || item.matchedOrder?.customerPhone || '-',
    'البراند / المتجر': item.brandName || '-',
    'المحافظة / المدينة': item.dropoffCity || '-',
    'شركة الشحن': item.matchedOrder?.shippingCompany || 'بوسطة',
    'حالة الشحنة بالشيت': item.sheetStatus || '-',
    'تاريخ التسليم': item.sheetDeliveredAt || item.sheetDate || '-',
    'حالة الدفع (Payment Status)': item.sheetPaymentStatus || 'Not Paid',
    'رقم التحويل (Cash-out ID)': item.sheetCashoutId || 'N/A',
    'قيمة التحصيل (COD)': item.sheetGrossAmount,
    'مصاريف الشحن': item.sheetFeesAmount,
    'الصافي المستحق للتحويل (ج.م)': item.sheetNetPayout,
    'التشخيص': item.reasonSummary
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      untransferredRows.length ? untransferredRows : [{ 'ملاحظة': 'لا توجد شحنات متحصلة بدون تحويل في الشيتات' }]
    ),
    'متحصل ولم يحول'
  );

  const uncollectedRows = result.uncollectedDelivered.map(item => ({
    'رقم الأوردر': item.order.orderNumber,
    'رقم البوليصة': item.trackingDisplay,
    'شركة الشحن': item.order.shippingCompany || '-',
    'العميل': item.order.customerName,
    'الهاتف': item.order.customerPhone,
    'تاريخ الطلب': item.order.date,
    'أيام التأخير': item.daysElapsed,
    'إجمالي التحصيل المتوقع': item.expectation.expectedGrossCod,
    'مصاريف الشحن المتوقعة': item.expectation.expectedCarrierFees,
    'صافي المستحق للتحويل (ج.م)': item.expectation.expectedNetPayout,
    'حالة النظام': item.order.status
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      uncollectedRows.length ? uncollectedRows : [{ 'ملاحظة': 'لا توجد أوردرات مسلّمة مفقودة من الشيتات' }]
    ),
    'مسلمة لم تظهر بالشيت'
  );

  const discrepancyRows = [...result.shortPaid, ...result.overPaid].map(item => ({
    'رقم البوليصة بالشيت': item.trackingKey,
    'رقم الأوردر بالمتجر': item.matchedOrder?.orderNumber || item.businessRefKey || '-',
    'العميل': item.matchedOrder?.customerName || item.customerName || '-',
    'البراند': item.brandName || '-',
    'اسم الملف': item.fileName,
    'إجمالي الشيت': item.sheetGrossAmount,
    'مصاريف الشيت': item.sheetFeesAmount,
    'صافي المحول بالشيت': item.sheetNetPayout,
    'صافي المستحق بالمتجر': item.expectation?.expectedNetPayout || 0,
    'الفرق (ج.م)': item.netVariance,
    'تفاصيل الفحص': item.reasonSummary
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      discrepancyRows.length ? discrepancyRows : [{ 'ملاحظة': 'لا توجد فروقات مالية' }]
    ),
    'عجز وفروقات الشيت'
  );

  const returnedRows = result.notCollectedCustomer.map(item => ({
    'رقم البوليصة': item.trackingKey,
    'العميل': item.matchedOrder?.customerName || item.customerName || '-',
    'البراند': item.brandName || '-',
    'المدينة': item.dropoffCity || '-',
    'الحالة': item.sheetStatus || '-',
    'حالة عودة المنتج لمخزنك':
      item.warehouseReturnStatus === 'returned_to_merchant_confirmed'
        ? 'رجع لمخزنك (بتأكيد بوسطة)'
        : item.warehouseReturnStatus === 'returned_stock_not_restored'
        ? 'رجع ببوسطة ولم يُردّ لمخزون النظام!'
        : item.warehouseReturnStatus === 'still_at_bosta_hub'
        ? 'مازال في بوسطة — لم يرجع لمخزنك'
        : item.warehouseReturnStatus === 'canceled_before_pickup'
        ? 'ملغي قبل الاستلام (بالمخزن)'
        : 'بدون إثبات تسليم للراسل',
    'محاولات الإرجاع / ملاحظات المخزن': item.warehouseReturnNote || '-',
    'سبب الرفض / التأخير': item.exceptionReason || '-',
    'كود التسوية': item.sheetCashoutId || '-',
    'رسوم الشحن': item.feeBreakdown?.shippingFees ?? item.sheetFeesAmount,
    'التأمين': item.feeBreakdown?.insuranceFees ?? 0,
    'فتح الشحنة': item.feeBreakdown?.openingPackageFees ?? 0,
    'الضريبة (VAT)': item.feeBreakdown?.vat ?? 0,
    'Flex Ship مسترد': item.feeBreakdown?.flexShipAmount ?? item.flexShipValue ?? 0,
    'إجمالي الرسوم': item.sheetFeesAmount,
    'الصافي المخصوم (ج.م)': item.sheetNetPayout
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(returnedRows.length ? returnedRows : [{ 'ملاحظة': 'لا توجد مرتجعات' }]),
    'مرتجعات وخصوماتها'
  );

  if (result.transactionsSummary.hasTransactionsSheet && result.transactionsSummary.ledgerRows.length > 0) {
    const ledgerExportRows = result.transactionsSummary.ledgerRows.map(tx => ({
      'معرف الحركة (Transactions ID)': tx.transactionId,
      'التاريخ': tx.date || '-',
      'التصنيف (Category)': tx.category,
      'البيان بالعربي': tx.categoryAr,
      'القيمة (ج.م)': tx.amount,
      'الرصيد بعد الحركة (Balance)': tx.balance ?? '-',
      'كود التحويل (Cashout ID)': tx.cashoutId || '-',
      'تاريخ التحويل': tx.cashoutDate || '-',
      'مبلغ التحويل (ج.م)': tx.cashoutAmount ?? '-'
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(ledgerExportRows),
      'سجل Transactions النظيف'
    );
  }

  if (result.compensationsSummary.hasCompensationsSheet && result.compensationsSummary.entries.length > 0) {
    const compExportRows = result.compensationsSummary.entries.map(c => ({
      'رقم البوليصة (Order ID)': c.orderId,
      'رقم التعويض (Compensation ID)': c.compensationId,
      'العميل': c.matchedOrder?.customerName || c.customerName || '-',
      'الهاتف': c.customerPhone || '-',
      'البراند': c.brandName || '-',
      'نوع الشحنة (Order Type)': c.orderType,
      'كود الحالة': c.orderStatusLabel,
      'التحقق من رجوع البضاعة (Deliveries)':
        c.compAuditVerdict === 'returned_to_warehouse_shipping_refund'
          ? `رجع لمخزنك بتأكيد بوسطة (${c.deliveriesReturnedAt || 'Returned to origin'} · ${c.deliveriesReturnAttempts || 1} محاولة)`
          : c.compAuditVerdict === 'rto_status_shipping_refund_outside_deliveries'
          ? 'RTO (46) — خارج مدى Deliveries المرفوع (تحقق من الجرد)'
          : c.compAuditVerdict === 'true_under_compensated'
          ? 'غير راجع لمخزنك — عجز تعويض!'
          : c.deliveriesState || '-',
      'المنتج (Package Description)': c.packageDescription || '-',
      'من / إلى': `${c.pickupCity || '-'} → ${c.dropoffCity || '-'}`,
      'تاريخ التعويض': c.compensationDate || '-',
      'كود التحويل (Cash-out ID)': c.cashoutId || 'غير محول بعد',
      'قيمة التعويض (ج.م)': c.compensationAmount,
      'سبب وتحليل تعويض الشحن': c.shippingRefundBreakdownAr || c.underCompReasonAr || '-'
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(compExportRows),
      'جدول التعويضات (Compensations)'
    );
  }

  if (result.missingCompensations.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.missingCompensations.map(m => ({
          'رقم البوليصة': m.trackingKey,
          'العميل': m.customerName || '-',
          'البراند': m.brandName || '-',
          'الحالة': m.sheetStatus,
          'نوع التنبيه': m.alertKind === 'under_compensated' ? 'تعويض منقوص (أقل من قيمة البضاعة)' : 'مفقود/تالف بدون تعويض',
          'التعويض المدفوع فعلاً (ج.م)': m.paidCompensationAmount ?? 0,
          'سبب الاستثناء': m.exceptionReason || '-',
          'صافي المطالبة المستحقة (ج.م)': m.estimatedValue,
          'التشخيص': m.reasonSummary
        }))
      ),
      'تعويضات مفقودة ومنقوصة'
    );
  }

  if (result.feeAnomalies.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.feeAnomalies.map(f => ({
          'رقم البوليصة': f.trackingKey,
          'البراند': f.brandName || '-',
          'المحافظة / نطاق التسعير': `${f.dropoffCity || '-'}${f.zoneLabelAr ? ` (${f.zoneLabelAr})` : ''}`,
          'المنتج': f.packageDescription || '-',
          'حجم الطرد بالشيت': f.packageSize || '-',
          'الحجم المعتاد للمنتج': f.dominantProductSize || '-',
          'نوع الخدمة': f.serviceLabelAr || f.orderType || '-',
          'الحالة': f.sheetStatus,
          'سبب الاستثناء (Deliveries)': f.exceptionReason || '-',
          'محاولات التسليم للعميل': f.forwardAttempts ?? '-',
          'ملاحظات البوليصة (Notes)': f.orderNotes || '-',
          'حظر المعاينة (Notes vs Opening)': f.isForbiddenOpenFeeAnomaly ? 'نعم — خصم فتح رغم منع المعاينة' : 'لا',
          'الشحن الأساسي بالشيت': f.shippingFees,
          'الشحن المتوقع بالخطة': f.expectedBaseShippingFee ?? '-',
          'شحن الحجم العادي بالخطة': f.expectedNormalSizeShippingFee ?? '-',
          'التأمين': f.insuranceFees,
          'فتح الشحنة': f.openingPackageFees,
          'الضريبة (14%)': f.vat,
          'إجمالي الرسوم بالشيت': f.sheetFeesAmount,
          'إجمالي فرق الرسوم (شامل الضريبة)': f.overchargeEstimate,
          'حالة التعويض في محفظة النقاط (Bosta Credits)': f.compensatedInCredits
            ? `تم التعويض بقسيمة #${f.creditVoucherTxId} (+${f.creditVoucherAmount} ج.م)`
            : 'لم يُعوض — مستحق المطالبة',
          'الصافي المتبقي للمطالبة (ج.م)': f.netUncompensatedOvercharge,
          'تفاصيل المخالفة': f.anomalyTags.join(' + ')
        }))
      ),
      'مصاريف شحن ومقاسات زائدة'
    );
  }

  if (result.stuckReturns.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.stuckReturns.map(s => ({
          'رقم البوليصة': s.trackingKey,
          'العميل': s.customerName || '-',
          'الهاتف': s.customerPhone || '-',
          'البراند': s.brandName || '-',
          'المحطة الحالية (Hub)': s.currentHub || '-',
          'تاريخ الإرجاع المتوقع': s.expectedReturnDate || '-',
          'أيام التأخير': s.daysOverdue,
          'قيمة الشحنة (COD)': s.codAmount,
          'التشخيص': s.reasonSummary
        }))
      ),
      'مرتجعات محتجزة بالفروع'
    );
  }

  if (result.onlineAndFlexAlerts.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.onlineAndFlexAlerts.map(o => ({
          'رقم البوليصة': o.trackingKey,
          'البراند': o.brandName || '-',
          'الحالة': o.sheetStatus,
          'دفع أونلاين': o.onlinePaymentAmount,
          'مقدم/عربون': o.depositAmount,
          'FlexShip': o.flexShipValue,
          'حالة دفع FlexShip': o.flexShipPaid === false ? 'FALSE' : o.flexShipPaid ? 'TRUE' : '-',
          'صافي الشيت': o.sheetNetPayout,
          'التشخيص': o.reasonSummary
        }))
      ),
      'أونلاين و FlexShip'
    );
  }

  if (result.pickupRequestsSummary.hasPickupSheet && result.pickupRequestsSummary.entries.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.pickupRequestsSummary.entries.map(p => ({
          'رقم البيك أب (Pickup ID)': p.pickupId,
          'التاريخ': p.scheduledDate || p.creationDate || '-',
          'فئة الحساب (Tier)': p.businessTier || '-',
          'البراند': p.brandName || '-',
          'المندوب': p.starName || '-',
          'الفرع': p.hubName || '-',
          'كود المنطقة (District)': p.firstMileDistrictCode || '-',
          'نوع الطرود': p.parcelType || '-',
          'أول بيك أب (First Pickup)': p.isFirstPickup ? 'نعم (معفى)' : 'لا',
          'إعادة الجدولة / التأخير': p.isRescheduledOrDelayed
            ? `${p.noOfSchedulings || 'مؤجل'}${p.pickupDelayDays ? ` (${p.pickupDelayDays} يوم)` : ''}`
            : p.noOfSchedulings || '-',
          'الحالة': p.status,
          'المطلوب': p.requestedCount,
          'المسحوب (Picked Up)': p.pickedUpCount,
          'المسجل مستلم (Received)': p.receivedCount ?? '-',
          'المؤكد من التاجر (Confirmed)': p.confirmedCount ?? '-',
          'فارق الاستلام': p.variancePickedVsReceived,
          'فارق تأكيد التاجر': p.variancePickedVsConfirmed ?? 0,
          'تبديل براند/مخزن': p.isCrossBrandSwapped ? 'نعم — تبديل مخزن/براند!' : 'لا',
          'التشخيص': p.reasonSummary
        }))
      ),
      'طلبات البيك أب'
    );
  }

  if (result.pickupRequestsSummary.crossBrandSwaps.length > 0) {
    const swapReturnRows = result.pickupRequestsSummary.crossBrandSwaps.flatMap(sw =>
      sw.affectedReturnedShipments.length > 0
        ? sw.affectedReturnedShipments.map(ret => ({
            'التاريخ': sw.date,
            'نوع التداخل': sw.kind === 'paired_two_way_swap' ? 'تبديل متبادل بين مخزنين' : 'تداخل براند ببيك أب واحد',
            'رقم البيك أب': sw.partnerPickupId ? `${sw.pickupId} ↔ ${sw.partnerPickupId}` : sw.pickupId,
            'رقم البوليصة': ret.trackingKey,
            'البراند الفعلي للشحنة': ret.actualBrandName,
            'المنتج': ret.packageDescription || '-',
            'العميل': ret.customerName || '-',
            'المدينة': ret.dropoffCity || '-',
            'الحالة التشغيلية': ret.deliveryState,
            'رجعت لمخزن (خطأ)': `${ret.routedReturnWarehouse}${ret.routedReturnContact ? ` (${ret.routedReturnContact})` : ''}`,
            'المفروض ترجع لمخزن': `${ret.expectedReturnWarehouse}${ret.expectedReturnContact ? ` (${ret.expectedReturnContact})` : ''}`
          }))
        : [
            {
              'التاريخ': sw.date,
              'نوع التداخل': sw.kind === 'paired_two_way_swap' ? 'تبديل متبادل بين مخزنين' : 'تداخل براند ببيك أب واحد',
              'رقم البيك أب': sw.partnerPickupId ? `${sw.pickupId} ↔ ${sw.partnerPickupId}` : sw.pickupId,
              'رقم البوليصة': sw.sampleTrackingNumber || '-',
              'البراند الفعلي للشحنة': sw.actualShipmentsBrand,
              'المنتج': '-',
              'العميل': '-',
              'المدينة': '-',
              'الحالة التشغيلية': 'تداخل في الحساب/العينة',
              'رجعت لمخزن (خطأ)': sw.warehouseAddress,
              'المفروض ترجع لمخزن': sw.partnerWarehouseAddress || '-',
              'ملاحظات': sw.reasonSummary
            }
          ]
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(swapReturnRows),
      'تبديل البيك أب والمرتجعات'
    );
  }

  if (result.bostaCreditsSummary.hasCreditsSheet && result.bostaCreditsSummary.entries.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.bostaCreditsSummary.entries.map(c => ({
          'معرف الحركة (Transaction ID)': c.transactionId,
          'التاريخ': c.date || '-',
          'التصنيف بالعربي': c.categoryAr,
          'التصنيف الأصلي': c.category,
          'البصمة وتفسير الحركة': c.inferredReasonAr || '-',
          'حالة الربط بالشحنات':
            c.matchStatus === 'matched_by_tracking'
              ? `مربوط مباشرة ببوليصة ${c.matchedAnomalyTrackingKey}`
              : c.matchStatus === 'matched_by_fingerprint'
              ? `مربوط بالبصمة السعرية ببوليصة ${c.matchedAnomalyTrackingKey}`
              : c.matchStatus === 'matched_in_deliveries_earlier_cycle'
              ? `مربوط ببوليصة ${c.matchedAnomalyTrackingKey} (شيت الشحنات - دورة سابقة)`
              : c.matchStatus === 'ambiguous_pool_needs_binding'
              ? `متطابق ضمنياً بالقيمة مع أكثر من بوليصة مرشحة (${(c.candidateTrackingKeys || []).join(', ')})`
              : c.matchStatus === 'surplus_unmatched_voucher'
              ? 'قسيمة تعويض إضافية / تخص دورة سابقة غير مرفوعة'
              : `خصم مسحوب (${c.trackingNumber || '-'})`,
          'البوليصة المقابلة': c.matchedAnomalyTrackingKey || c.trackingNumber || '-',
          'العميل / المنتج المقابل':
            [c.matchedAnomalyCustomerName, c.matchedAnomalyProduct, c.matchedAnomalyZone].filter(Boolean).join(' · ') || '-',
          'القيمة (ج.م)': c.amount,
          'ما يعادله قبل الضريبة (÷1.14)': c.preVatEquivalent ?? '-',
          'الرصيد بعد الحركة (ج.م)': c.balance ?? '-'
        }))
      ),
      'محفظة رصيد بوسطة Credits'
    );
  }

  if (result.transactionsSummary.walletCompensations.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.transactionsSummary.walletCompensations.map(w => ({
          'معرف الحركة (Transactions ID)': w.transactionId,
          'التاريخ': w.date || '-',
          'التصنيف': w.categoryAr,
          'القيمة بالمحفظة (ج.م)': w.amount,
          'ما يعادله قبل 14% ض.ق.م': w.preVatEquivalent,
          'كود التحويل (Cashout ID)': w.cashoutId || '-',
          'التوثيق بجدول Compensations':
            w.auditStatus === 'documented_in_comp_sheet'
              ? `موثق (بوليصة ${w.matchedCompensationOrderId})`
              : w.auditStatus === 'undocumented_in_comp_sheet'
              ? 'غير موثق في جدول Compensations'
              : w.categoryAr,
          'التشخيص': w.inferredNoteAr
        }))
      ),
      'تعويضات المحفظة النقدية'
    );
  }

  if (result.internalFraudAlerts.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.internalFraudAlerts.map(f => ({
          'رقم البوليصة': f.trackingKey,
          'بوليصة ثانية (إن وجدت)': f.secondaryTrackingKey || '-',
          'رقم الأوردر': f.orderNumber || '-',
          'العميل': f.customerName || '-',
          'الهاتف': f.customerPhone || '-',
          'حالة المتجر': f.storeStatus || '-',
          'حالة بوسطة': f.bostaStatus || '-',
          'القيمة المرجعية / المتجر': f.storeAmount,
          'قيمة بوسطة': f.bostaAmount,
          'نسبة الانخفاض %': f.priceDropPercent ? `${f.priceDropPercent}%` : '-',
          'مصدر المقارنة': f.referenceSourceLabel || '-',
          'الخطر المالي (ج.م)': f.financialRiskAmount,
          'التشخيص': f.reasonSummary
        }))
      ),
      'كاشف التلاعب وشذوذ الأسعار'
    );
  }

  if (result.zeroAttemptReturns.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.zeroAttemptReturns.map(z => ({
          'رقم البوليصة': z.trackingKey,
          'العميل': z.customerName || '-',
          'المدينة': z.dropoffCity || '-',
          'الحالة': z.sheetStatus,
          'محاولات التوصيل للعميل': z.forwardAttempts,
          'إجمالي المحاولات': z.totalAttempts,
          'رسوم الشحن المخصومة (ج.م)': z.shippingFeesDeducted,
          'التشخيص': z.reasonSummary
        }))
      ),
      'مرتجعات بدون محاولات'
    );
  }

  if (result.customerRiskAlerts.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.customerRiskAlerts.map(r => ({
          'رقم الهاتف': r.phone,
          'الأسماء المسجلة': r.customerNames.join(' / ') || '-',
          'المدن': r.cities.join(' / ') || '-',
          'إجمالي الطلبات': r.totalOrders,
          'المستلم': r.deliveredCount,
          'المرتجع': r.returnedCount,
          'نسبة الرفض %': r.returnRatePercent,
          'مصاريف شحن مهدرة (ج.م)': r.totalReturnedFees,
          'أرقام بوالص عينة': r.sampleTrackingKeys.join(', ')
        }))
      ),
      'العملاء الخطِرين (مرتجعات)'
    );
  }

  if (result.pickupFeeAudits.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.pickupFeeAudits.map(a => ({
          'معرف حركة الخصم (Transactions ID)': a.transactionId,
          'تاريخ الخصم': a.txDate || '-',
          'قيمة الخصم (ج.م)': -a.feeAmount,
          'كود التحويل (Cashout ID)': a.cashoutId || '-',
          'مصدر المطابقة':
            a.matchedSource === 'pickup_requests'
              ? 'شيت طلبات البيك أب'
              : a.matchedSource === 'deliveries_export'
              ? 'شيت الشحنات'
              : 'غير متوفر',
          'رقم البيك أب (Pickup ID)': a.matchedPickupIds.join(' / ') || '-',
          'عدد الشحنات المسحوبة': a.shipmentsPickedCount,
          'الحد المجاني المتفق عليه': a.minRequiredForFree,
          'الحكم':
            a.verdict === 'wrongful_deduction'
              ? 'خصم خاطئ مستحق الاسترداد'
              : a.verdict === 'valid_under_limit'
              ? 'خصم سليم (أقل من الحد المجاني)'
              : 'غير متحقق (ارفع شيت البيك أب)',
          'المبلغ المستحق استرداده (ج.م)': a.overchargeAmount,
          'التشخيص': a.reasonSummary
        }))
      ),
      'تدقيق خصومات البيك أب'
    );
  }

  if (result.transactionsSummary.walletGaps.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.transactionsSummary.walletGaps.map(g => ({
          'الملف': g.fileName,
          'الحركة الأقدم': g.olderTxId,
          'الحركة الأحدث': g.newerTxId,
          'الرصيد السابق': g.olderBalance,
          'قيمة الحركة': g.newerAmount,
          'الرصيد المتوقع': g.expectedNewBalance,
          'الرصيد الفعلي بالشيت': g.actualNewBalance,
          'الفارق (ج.م)': g.gapAmount,
          'التشخيص': g.reasonSummary
        }))
      ),
      'فجوات رصيد كشف الحساب'
    );
  }

  if (result.exchangeAudits.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.exchangeAudits.map(ex => ({
          'رقم البوليصة': ex.trackingKey,
          'نوع الشحنة': ex.orderType,
          'بوليصة مقابلة (إن وجدت)': ex.secondaryTrackingKey || '-',
          'نوع التنبيه':
            ex.oldItemStatusFlag === 'fee_overcharge'
              ? 'رسوم استبدال/جزئي زائدة عن تعريفة الخطة'
              : ex.oldItemStatusFlag === 'old_item_unreturned'
              ? ex.isPickAndChoose
                ? 'شحنة جزئي بها إشارة ارتجاع دون عودة للمخزن'
                : 'شحنة استبدال مسلّمة بدون إثبات رجوع الطرد القديم'
              : ex.oldItemStatusFlag === 'split_send_and_crp'
              ? 'استبدال مجزأ على بوليصتين (SEND + CRP)'
              : ex.isPickAndChoose
              ? 'تسليم جزئي سليم (استلم العميل كل الأصناف / أو ارتجع المرفوض)'
              : 'استبدال سليم ومطابق',
          'العميل': ex.customerName || '-',
          'الهاتف': ex.customerPhone || '-',
          'المدينة': ex.dropoffCity || '-',
          'الحالة': ex.sheetStatus || '-',
          'محاولات الإرجاع (Return Attempts)': ex.returnAttemptsCount ?? '-',
          'COD المحصل': ex.collectedCod ?? '-',
          'الشحن المخصوم': ex.shippingFees,
          'الشحن المتوقع بالخطة': ex.expectedExchangeFee ?? '-',
          'فرق الرسوم / المطالبة (ج.م)': ex.feeOvercharge,
          'التشخيص': ex.reasonSummary
        }))
      ),
      'تدقيق الاستبدال والجزئي'
    );
  }

  if (result.payoutSlaSummary.delayedRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.payoutSlaSummary.delayedRows.map(d => ({
          'رقم البوليصة': d.trackingKey,
          'العميل': d.customerName || '-',
          'النوع':
            d.statusFlag === 'skipped_out_of_order'
              ? 'تم تخطيها وتحويل شحنات أحدث قبلها'
              : d.statusFlag === 'unpaid_overdue'
              ? 'مسلّمة ومتأخرة بلا Cash-out ID'
              : 'تحويل متأخر عن المهلة SLA',
          'تاريخ التسليم': d.confirmedDate,
          'تاريخ التحويل (Paid At)': d.paidDate || 'غير محوّل بعد',
          'أيام التأخير': d.lagDays,
          'كود التحويل': d.cashoutId || '-',
          'صافي المبلغ (ج.م)': d.netAmount
        }))
      ),
      'تأخيرات التحويل (SLA)'
    );
  }

  if (result.deliverySlaSummary.hasDeliveriesSlaData && result.deliverySlaSummary.items.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.deliverySlaSummary.items.map(s => ({
          'رقم البوليصة': s.trackingKey,
          'العميل': s.customerName || '-',
          'البراند': s.brandName || '-',
          'المدينة': s.dropoffCity || '-',
          'الحالة التشغيلية': s.deliveryState,
          'التصنيف':
            s.slaCategory === 'returned_after_delay'
              ? 'ارتجع بعد تأخير التسليم'
              : s.slaCategory === 'overdue_active'
              ? 'شحنة جارية متجاوزة الموعد'
              : s.slaCategory === 'delivered_late'
              ? 'سُلّم متأخر عن الموعد'
              : 'تأخير بيك أب / تعليق',
          'الموعد المتوقع للتسليم (Expected)': s.expectedDeliveryDate || '-',
          'تاريخ الجدولة (Scheduled)': s.scheduledAt || '-',
          'تاريخ التسليم الفعلي': s.actualDeliveredAt || '-',
          'أيام تأخير التسليم': s.delayDays,
          'أيام تأخير البيك أب': s.pickupDelayDays,
          'مرات التعليق (On Hold)': s.onHoldTrials,
          'حالة الواتساب': s.whatsappStatus || '-',
          'الملاحظات (Notes)': s.notes || '-',
          'التشخيص': s.reasonSummary
        }))
      ),
      'تأخيرات التسليم والواتساب SLA'
    );
  }

  const safeName = (storeName || 'store').replace(/[^\w\u0600-\u06FF-]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `مطالبة_تحصيل_COD_${safeName}_${dateStamp}.xlsx`);
}

export function buildWhatsappClaimMessage(
  result: TwoWayCodAuditResult,
  storeName: string,
  carrierFilter: string
): string {
  const lines: string[] = [];
  const carrierLabel = carrierFilter === 'all' ? 'شركة الشحن' : carrierFilter;
  lines.push(`السلام عليكم، طلب مراجعة وتحصيل مستحقات: *${storeName}* (${carrierLabel})`);
  lines.push('');

  if (result.collectedUntransferred.length > 0) {
    lines.push(
      `⚠️ *شحنات تم تسليمها وتحصيل الكاش ولم ينزل لها Cash-out ID (${result.collectedUntransferred.length} شحنة — صافي ${result.totals.collectedUntransferredAmount.toLocaleString()} ج.م):*`
    );
    result.collectedUntransferred.slice(0, 20).forEach((item, i) => {
      lines.push(
        `${i + 1}) بوليصة: ${item.trackingKey} | COD: ${item.sheetGrossAmount.toLocaleString()} ج.م | صافي: ${item.sheetNetPayout.toLocaleString()} ج.م (${item.sheetPaymentStatus || 'Not Paid'})`
      );
    });
    lines.push('');
  }

  if (result.uncollectedDelivered.length > 0) {
    lines.push(
      `🚨 *أوردرات مسلّمة بالنظام ولم تظهر في كشف التحويل (${result.uncollectedDelivered.length} أوردر — إجمالي صافي ${result.totals.uncollectedDeliveredAmount.toLocaleString()} ج.م):*`
    );
    result.uncollectedDelivered.slice(0, 20).forEach((item, i) => {
      lines.push(
        `${i + 1}) بوليصة: ${item.trackingDisplay} | أوردر: ${item.order.orderNumber} | منذ ${item.daysElapsed} يوم | صافي: ${item.expectation.expectedNetPayout.toLocaleString()} ج.م`
      );
    });
    lines.push('');
  }

  if (result.shortPaid.length > 0) {
    lines.push(
      `📉 *بوالص بها عجز/خصم زائد في التحويل (${result.shortPaid.length} بوليصة — عجز ${result.totals.shortPaidDeficitAmount.toLocaleString()} ج.م):*`
    );
    result.shortPaid.slice(0, 15).forEach((item, i) => {
      lines.push(
        `${i + 1}) بوليصة: ${item.trackingKey} | محوّل: ${item.sheetNetPayout.toLocaleString()} ج.م من أصل ${(item.expectation?.expectedNetPayout || 0).toLocaleString()} ج.م (عجز ${Math.abs(item.netVariance).toLocaleString()} ج.م)`
      );
    });
    lines.push('');
  }

  const wrongfulPickups = result.pickupFeeAudits.filter(p => p.verdict === 'wrongful_deduction');
  if (wrongfulPickups.length > 0) {
    lines.push(
      `🚐 *خصومات رسوم بيك أب خاطئة رغم استيفاء الحد المجاني (${wrongfulPickups.length} خصم — إجمالي ${result.totals.wrongfulPickupFeeAmount.toLocaleString()} ج.م):*`
    );
    wrongfulPickups.forEach((p, i) => {
      lines.push(
        `${i + 1}) حركة: ${p.transactionId} (${p.txDate}) | بيك أب: ${p.matchedPickupIds.join(', ') || p.pickupDates.join(', ')} | عدد الشحنات: ${p.shipmentsPickedCount} (≥ ${p.minRequiredForFree}) | خصم خاطئ: ${p.overchargeAmount.toLocaleString()} ج.م`
      );
    });
    lines.push('');
  }

  const uncompensatedRateAnoms = result.feeAnomalies.filter(
    f => f.isRateOrSizeOvercharge && !f.compensatedInCredits && f.netUncompensatedOvercharge > 0
  );
  if (uncompensatedRateAnoms.length > 0) {
    lines.push(
      `📦 *فروقات تسعير مناطق ومقاسات شحن لم تنزل في محفظة النقاط Bosta Credits (${uncompensatedRateAnoms.length} شحنة — إجمالي ${result.totals.uncompensatedRateSizeOverchargeAmount.toLocaleString()} ج.م):*`
    );
    uncompensatedRateAnoms.slice(0, 15).forEach((f, i) => {
      lines.push(
        `${i + 1}) بوليصة: ${f.trackingKey} | ${f.dropoffCity || '-'} | حجم مسجل: ${f.packageSize} | شحن مخصوم: ${f.shippingFees} ج.م بدل ${f.expectedNormalSizeShippingFee ?? f.expectedBaseShippingFee ?? '-'} ج.م | فرق شامل الضريبة: +${f.netUncompensatedOvercharge.toLocaleString()} ج.م`
      );
    });
    lines.push('');
  }

  if (
    result.totals.returnedInsuranceCount > 0 ||
    result.totals.returnedUntouchedOpeningCount > 0 ||
    result.totals.forbiddenOpenFeeCount > 0
  ) {
    lines.push(
      `🔍 *خصومات غير مستحقة على الرسوم:*` +
        (result.totals.returnedInsuranceCount > 0
          ? `\n- تأمين تحصيل على مرتجعات لم تُحصّل: ${result.totals.returnedInsuranceCount} شحنة (${result.totals.returnedInsuranceWithVat.toLocaleString()} ج.م شاملة الضريبة)`
          : '') +
        (result.totals.returnedUntouchedOpeningCount > 0
          ? `\n- رسوم فتح شحنة على مرتجعات لم تصل للعميل / لم يفتحها: ${result.totals.returnedUntouchedOpeningCount} شحنة (${result.totals.returnedUntouchedOpeningWithVat.toLocaleString()} ج.م شاملة الضريبة)`
          : '') +
        (result.totals.forbiddenOpenFeeCount > 0
          ? `\n- خصم فتح شحنة رغم وجود نص «غير مسموح بالمعاينة» في ملاحظات البوليصة: ${result.totals.forbiddenOpenFeeCount} شحنة (${result.totals.forbiddenOpenFeeWithVat.toLocaleString()} ج.م شاملة الضريبة)`
          : '')
    );
    lines.push('');
  }

  const actionableExchangeIssues = result.exchangeAudits.filter(ex => ex.oldItemStatusFlag !== 'exchange_ok');
  if (actionableExchangeIssues.length > 0) {
    lines.push(
      `🔄 *مخالفات شحنات الاستبدال والجزئي (${actionableExchangeIssues.length} تنبيه — ${result.totals.exchangeRiskAmount.toLocaleString()} ج.م):*`
    );
    actionableExchangeIssues.slice(0, 10).forEach((ex, i) => {
      lines.push(`${i + 1}) بوليصة: ${ex.trackingKey} | ${ex.reasonSummary}`);
    });
    lines.push('');
  }

  if (result.missingCompensations.length > 0) {
    lines.push(
      `🛡️ *شحنات مفقودة/تالفة أو بتعويض منقوص (${result.missingCompensations.length} شحنة — إجمالي الفجوة ${result.totals.missingCompensationsAmount.toLocaleString()} ج.م):*`
    );
    result.missingCompensations.slice(0, 15).forEach((m, i) => {
      lines.push(
        `${i + 1}) بوليصة: ${m.trackingKey} | ${m.packageDescription || m.customerName || '-'} | ${m.sheetStatus} | مطالب بـ: ${m.estimatedValue.toLocaleString()} ج.م`
      );
    });
    lines.push('');
  }

  if (result.pickupRequestsSummary.crossBrandSwaps.length > 0) {
    const actionableSwaps = result.pickupRequestsSummary.crossBrandSwaps.filter(
      s => s.kind === 'paired_two_way_swap' || s.affectedReturnedShipments.length > 0
    );
    if (actionableSwaps.length > 0) {
      const totalSwappedReturns = actionableSwaps.reduce(
        (acc, s) => acc + s.affectedReturnedShipments.length,
        0
      );
      lines.push(
        `🔀 *تبديل مخازن وعنوان رجوع الشحنات أثناء البيك أب (${actionableSwaps.length} واقعة — ${totalSwappedReturns} بوليصة مرتجعة متأثرة):*`
      );
      actionableSwaps.forEach((s, i) => {
        if (s.kind === 'paired_two_way_swap') {
          lines.push(
            `${i + 1}) يوم ${s.date}: بيك أب #${s.pickupId} (مخزن ${s.warehouseHomeBrand}: سُحب ${s.pickedUpCount} وتأكد ${s.confirmedCount ?? '-'}) ↔ بيك أب #${s.partnerPickupId} (مخزن ${s.partnerWarehouseHomeBrand}: سُحب ${s.partnerPickedUpCount} وتأكد ${s.partnerConfirmedCount ?? '-'})`
          );
        } else {
          lines.push(
            `${i + 1}) يوم ${s.date}: بيك أب #${s.pickupId} (حساب ${s.recordedBrandName} عند مخزن ${s.warehouseHomeBrand} — شحنات فعلية: ${s.actualShipmentsBrand})`
          );
        }
        if (s.affectedReturnedShipments.length > 0) {
          const sampleRets = s.affectedReturnedShipments
            .slice(0, 15)
            .map(r => `${r.trackingKey} (${r.actualBrandName} ← راجعة خطأ لـ ${r.routedReturnWarehouse})`)
            .join(' | ');
          lines.push(`   بوالص المرتجعات المتأثرة: ${sampleRets}`);
        }
      });
      lines.push('');
    }
  }

  const grandClaim =
    Math.round(
      (result.totals.collectedUntransferredAmount +
        result.totals.uncollectedDeliveredAmount +
        result.totals.shortPaidDeficitAmount +
        result.totals.wrongfulPickupFeeAmount +
        result.totals.uncompensatedRateSizeOverchargeAmount +
        result.totals.returnedInsuranceWithVat +
        result.totals.returnedUntouchedOpeningWithVat +
        result.totals.missingCompensationsAmount) *
        100
    ) / 100;
  lines.push(`💰 *إجمالي المطالبة المستحقة للمراجعة والتحويل:* ${grandClaim.toLocaleString()} ج.م`);
  lines.push('يرجى الإفادة بموعد التوريد المالي أو كود التسوية (Cash-out ID). شكراً لكم.');
  return lines.join('\n');
}
