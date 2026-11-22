import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  CheckCircle2,
  ExternalLink,
  Link2,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Truck,
  Unlink,
  X
} from 'lucide-react';
import { Order, OrderItem, OrderStatus, PaymentStatus, Product, Settings, ShippingOption } from '../types';
import { generateBostaShippingOptions } from '../constants';
import { SheetAuditRow, normalizeTrackingCode } from '../utils/codReconciliation';
import {
  calculateBostaVat,
  calculateCodFee,
  calculateInsuranceFee,
  getCompanySpecificFees,
  isBosta
} from '../utils/financials';

export interface SheetOrderImportPayload {
  sheetRow: SheetAuditRow;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  city: string;
  brandName: string;
  codAmount: number;
  customerShippingFee: number;
  actualCarrierFee: number;
  walletShippingFee: number;
  walletShippingSource: 'customer' | 'carrier';
  isInsured: boolean;
  insuranceFee: number;
  includeInspectionFee: boolean;
  inspectionFee: number;
  vatValue: number;
  shippingVatRate: number;
  codFee: number;
  returnShippingFee: number;
  totalStoreCarrierFees: number;
  shippingSpread: number;
  productPrice: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  collectionProcessed: boolean;
  cashoutId?: string;
  items: OrderItem[];
  deductFromInventory: boolean;
  pickedFromInventory?: boolean;
  warehouseId?: string;
  notes: string;
}

export interface SheetOrderLinkUpdatePayload {
  orderId: string;
  sheetRow: SheetAuditRow;
  customerShippingFee: number;
  actualCarrierFee: number;
  shippingSpread: number;
  deductFromInventory: boolean;
  itemsToDeduct?: OrderItem[];
  warehouseId?: string;
  notes?: string;
}

export interface SheetOrderUpdatePayload {
  orderId: string;
  sheetRow: SheetAuditRow;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  city: string;
  brandName: string;
  codAmount: number;
  customerShippingFee: number;
  actualCarrierFee: number;
  walletShippingFee: number;
  walletShippingSource: 'customer' | 'carrier';
  isInsured: boolean;
  insuranceFee: number;
  includeInspectionFee: boolean;
  inspectionFee: number;
  vatValue: number;
  shippingVatRate: number;
  codFee: number;
  returnShippingFee: number;
  totalStoreCarrierFees: number;
  shippingSpread: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  notes: string;
}

export interface SheetOrderLinkAndImportModalProps {
  sheetRow: SheetAuditRow;
  orders: Order[];
  settings: Settings;
  storeName: string;
  canWriteStore: boolean;
  initialMode?: 'create' | 'link' | 'edit';
  orderBasePath?: string;
  onClose: () => void;
  onCreateOrderFromSheet?: (payload: SheetOrderImportPayload) => void;
  onLinkOrderWithSettlement?: (payload: SheetOrderLinkUpdatePayload) => void;
  onUpdateOrderFromSheet?: (payload: SheetOrderUpdatePayload) => void;
  onLocalManualLinkOnly: (trackingKey: string, orderId: string) => void;
  onDeleteOrderFromStore?: (orderId: string) => void;
}

const formatEgp = (val: number): string => {
  const num = Number.isFinite(val) ? val : 0;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} ج.م`;
};

const round2 = (v: number): number => Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;

const normalizeArabicText = (input: string): string =>
  (input || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeProductMatchText = (input: string): string =>
  normalizeArabicText(input)
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const EN_TO_AR_GOV_MAP: Record<string, string[]> = {
  cairo: ['القاهره', 'القاهرة', 'مدينه نصر', 'المعادي', 'التجمع', 'هليوبوليس'],
  'new cairo': ['القاهره', 'التجمع الخامس'],
  giza: ['الجيزه', 'الجيزة', 'الهرم', 'فيصل', '6 اكتوبر', 'الشيخ زايد', 'اكتوبر'],
  october: ['الجيزه', '6 اكتوبر', 'اكتوبر'],
  '6th of october': ['الجيزه', '6 اكتوبر'],
  alexandria: ['الاسكندريه', 'الإسكندرية', 'اسكندريه'],
  alex: ['الاسكندريه', 'اسكندريه'],
  'red sea': ['البحر الاحمر', 'الغردقه', 'الغردقة'],
  dakahlia: ['الدقهليه', 'المنصوره'],
  sharqia: ['الشرقيه', 'الزقازيق', 'العاشر'],
  qalyubia: ['القليوبيه', 'بنها', 'شبرا الخيمه'],
  gharbia: ['الغربيه', 'طنطا', 'المحله'],
  monufia: ['المنوفيه', 'شبين الكوم'],
  beheira: ['البحيره', 'دمنهور'],
  'kafr el sheikh': ['كفر الشيخ'],
  damietta: ['دمياط'],
  'port said': ['بورسعيد', 'بور سعيد'],
  ismailia: ['الاسماعيليه'],
  suez: ['السويس'],
  fayoum: ['الفيوم'],
  'beni suef': ['بني سويف'],
  minya: ['المنيا'],
  assiut: ['اسيوط'],
  asyut: ['اسيوط'],
  sohag: ['سوهاج'],
  qena: ['قنا'],
  luxor: ['الاقصر'],
  aswan: ['اسوان'],
  matrouh: ['مطروح'],
  'north coast': ['الساحل الشمالي', 'مطروح'],
  'new valley': ['الوادي الجديد'],
  'north sinai': ['شمال سيناء'],
  'south sinai': ['جنوب سيناء', 'شرم الشيخ']
};

const buildLocationTokens = (text: string): string[] => {
  const norm = normalizeArabicText(text);
  if (!norm) return [];
  const tokens = new Set<string>([norm]);
  for (const [en, arList] of Object.entries(EN_TO_AR_GOV_MAP)) {
    const normEn = normalizeArabicText(en);
    const normArList = arList.map(normalizeArabicText);
    if (norm.includes(normEn) || normArList.some(ar => norm.includes(ar))) {
      tokens.add(normEn);
      normArList.forEach(ar => tokens.add(ar));
    }
  }
  return Array.from(tokens).filter(Boolean);
};

export const resolveBostaShippingQuote = (
  cityText: string,
  addressText: string,
  settings: Settings
): { price: number; label: string; isConfigured: boolean } => {
  const shippingOptionsMap = settings?.shippingOptions || {};
  let bostaOpts: ShippingOption[] = [];

  if (Array.isArray(shippingOptionsMap['بوسطة']) && shippingOptionsMap['بوسطة'].length > 0) {
    bostaOpts = shippingOptionsMap['بوسطة'];
  } else {
    const bostaKey = Object.keys(shippingOptionsMap).find(
      k =>
        (k.includes('بوسطة') || k.includes('بوسطه') || k.toLowerCase().includes('bosta')) &&
        Array.isArray(shippingOptionsMap[k]) &&
        shippingOptionsMap[k].length > 0
    );
    if (bostaKey) {
      bostaOpts = shippingOptionsMap[bostaKey];
    }
  }

  const isConfiguredInStore = bostaOpts.length > 0;
  const searchPool = isConfiguredInStore ? bostaOpts : generateBostaShippingOptions();

  const cityTokens = buildLocationTokens(cityText);
  const addressNorm = normalizeArabicText(`${cityText} ${addressText}`);
  const addressTokens = buildLocationTokens(`${cityText} ${addressText}`);

  // 1. Direct governorate match from city field (or full address)
  let matchedOpt: ShippingOption | undefined = searchPool.find(opt => {
    const lblNorm = normalizeArabicText(opt.label || '');
    return lblNorm && cityTokens.some(tok => lblNorm === tok || lblNorm.includes(tok) || tok.includes(lblNorm));
  });

  if (!matchedOpt) {
    matchedOpt = searchPool.find(opt => {
      const lblNorm = normalizeArabicText(opt.label || '');
      if (lblNorm && addressTokens.some(tok => lblNorm === tok || lblNorm.includes(tok) || tok.includes(lblNorm))) {
        return true;
      }
      return Boolean(
        opt.cities?.some(c => {
          const cNorm = normalizeArabicText(c.name || '');
          return cNorm.length >= 3 && addressNorm.includes(cNorm);
        })
      );
    });
  }

  if (matchedOpt) {
    // Check for city/district override inside the matched governorate
    const cityHit = matchedOpt.cities?.find(c => {
      const cNorm = normalizeArabicText(c.name || '');
      return cNorm.length >= 2 && addressNorm.includes(cNorm);
    });
    if (cityHit && !cityHit.useParentFees && Number(cityHit.deliveryPrice) > 0) {
      return {
        price: round2(Number(cityHit.deliveryPrice)),
        label: `${matchedOpt.label} · ${cityHit.name}`,
        isConfigured: isConfiguredInStore
      };
    }
    if (Number(matchedOpt.deliveryPrice) > 0) {
      return {
        price: round2(Number(matchedOpt.deliveryPrice)),
        label: matchedOpt.label,
        isConfigured: isConfiguredInStore
      };
    }
  }

  return {
    price: 65,
    label: 'افتراضي بوسطة',
    isConfigured: false
  };
};

export interface PickedInventoryItem {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  price: number;
  cost: number;
  weight: number;
  availableStock: number | null;
  thumbnail?: string;
}

const buildPickedItem = (
  prod: Product,
  variantId: string | undefined,
  quantity: number,
  warehouseId: string
): PickedInventoryItem => {
  const variant = variantId ? prod.variants?.find(v => v.id === variantId) : undefined;
  const key = variant ? `${prod.id}__${variant.id}` : prod.id;
  const variantLabel = variant
    ? Object.values(variant.options || {}).join(' / ') || variant.sku
    : undefined;
  const availableStock = variant
    ? variant.warehouseStock?.[warehouseId] ?? variant.stockQuantity ?? variant.stock ?? null
    : prod.warehouseStock?.[warehouseId] ?? prod.stockQuantity ?? prod.stock ?? null;

  return {
    key,
    productId: prod.id,
    variantId: variant?.id,
    name: prod.name,
    variantName: variantLabel,
    sku: variant?.sku || prod.sku,
    quantity: Math.max(1, Math.round(quantity || 1)),
    price: Number(variant?.price ?? prod.price ?? 0) || 0,
    cost: Number(variant?.costPrice ?? prod.costPrice ?? 0) || 0,
    weight: Number(variant?.weight ?? prod.weight ?? 1) || 1,
    availableStock,
    thumbnail: variant?.image || prod.thumbnail
  };
};

const extractQuantityFromSheetText = (text: string): number => {
  if (!text) return 1;
  const patterns = [
    /(?:^|\s)(\d+)\s*[x×*](?:\s|$)/i,
    /[x×*]\s*(\d+)(?:\s|$)/i,
    /(?:الكمية|كمية|عدد|qty|pcs)[:\s-]*(\d+)/i
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m && m[1]) {
      const q = parseInt(m[1], 10);
      if (Number.isFinite(q) && q >= 1 && q <= 50) return q;
    }
  }
  return 1;
};

export interface InventoryDetectionResult {
  autoPicked: PickedInventoryItem[];
  autoReason: string | null;
  suggestions: Array<{
    product: Product;
    variantId?: string;
    variantLabel?: string;
    price: number;
    reason: string;
    score: number;
  }>;
}

export const detectInventoryProductsForSheetRow = (
  sheetRow: SheetAuditRow,
  products: Product[],
  warehouseId: string,
  expectedProductPrice: number,
  settings: Settings
): InventoryDetectionResult => {
  if (!products || products.length === 0) {
    return { autoPicked: [], autoReason: null, suggestions: [] };
  }

  const descRaw = sheetRow.packageDescription || '';
  const descKey = normalizeProductMatchText(descRaw);
  const fullTextNorm = normalizeProductMatchText(
    [descRaw, sheetRow.businessRefKey || '', sheetRow.notes || ''].join(' ')
  );
  const qtyHint = extractQuantityFromSheetText(`${descRaw} ${sheetRow.notes || ''}`);

  // Tier 1: Learned description -> product mapping in store settings
  if (descKey && settings?.sheetProductMappings?.[descKey]?.length) {
    const mappedEntries = settings.sheetProductMappings[descKey];
    const mappedItems: PickedInventoryItem[] = [];
    for (const entry of mappedEntries) {
      const prod = products.find(p => p.id === entry.productId);
      if (prod) {
        mappedItems.push(
          buildPickedItem(prod, entry.variantId, entry.quantity || qtyHint || 1, warehouseId)
        );
      }
    }
    if (mappedItems.length > 0) {
      return {
        autoPicked: mappedItems,
        autoReason: 'تم التعرّف تلقائياً من ذاكرة الربط السابقة لوصف الشحنة',
        suggestions: []
      };
    }
  }

  // Tier 2: Direct SKU match in description / reference / notes
  if (fullTextNorm) {
    const rawTokens = new Set(
      [descRaw, sheetRow.businessRefKey || '', sheetRow.notes || '']
        .join(' ')
        .toLowerCase()
        .split(/[\s,|/\\;()[\]]+/)
        .map(s => s.trim())
        .filter(s => s.length >= 3)
    );
    for (const prod of products) {
      const pSku = (prod.sku || '').trim().toLowerCase();
      if (pSku.length >= 3 && (rawTokens.has(pSku) || fullTextNorm.includes(normalizeProductMatchText(pSku)))) {
        return {
          autoPicked: [buildPickedItem(prod, undefined, qtyHint, warehouseId)],
          autoReason: `تم التعرّف تلقائياً من كود SKU (${prod.sku})`,
          suggestions: []
        };
      }
      if (prod.hasVariants && prod.variants?.length) {
        for (const v of prod.variants) {
          const vSku = (v.sku || '').trim().toLowerCase();
          if (vSku.length >= 3 && (rawTokens.has(vSku) || fullTextNorm.includes(normalizeProductMatchText(vSku)))) {
            return {
              autoPicked: [buildPickedItem(prod, v.id, qtyHint, warehouseId)],
              autoReason: `تم التعرّف تلقائياً من كود المتغير (${v.sku})`,
              suggestions: []
            };
          }
        }
      }
    }
  }

  // Build candidate scores across Name Match & Price Match
  const descWords = descKey
    .split(' ')
    .filter(w => w.length >= 2 && !/^\d+$/.test(w));

  const grossCod = round2(Number(sheetRow.sheetGrossAmount) || 0);
  const priceTargets = [expectedProductPrice, grossCod].filter(v => v > 0);

  const scoredCandidates: Array<{
    product: Product;
    variantId?: string;
    variantLabel?: string;
    price: number;
    score: number;
    reason: string;
    isExactNameMatch: boolean;
    isPriceMatch: boolean;
    matchedQty: number;
  }> = [];

  for (const prod of products) {
    const entries =
      prod.hasVariants && prod.variants?.length
        ? prod.variants.map(v => ({
            variantId: v.id,
            variantLabel: Object.values(v.options || {}).join(' / ') || v.sku,
            nameNorm: normalizeProductMatchText(`${prod.name} ${Object.values(v.options || {}).join(' ')}`),
            price: Number(v.price ?? prod.price ?? 0) || 0
          }))
        : [
            {
              variantId: undefined,
              variantLabel: undefined,
              nameNorm: normalizeProductMatchText(prod.name || ''),
              price: Number(prod.price ?? 0) || 0
            }
          ];

    for (const ent of entries) {
      let score = 0;
      const reasons: string[] = [];
      let isExactNameMatch = false;
      let isPriceMatch = false;
      let matchedQty = qtyHint;

      // Name similarity check against description
      if (descKey && ent.nameNorm) {
        if (descKey === ent.nameNorm || descKey.includes(ent.nameNorm) || ent.nameNorm.includes(descKey)) {
          score += 90;
          isExactNameMatch = true;
          reasons.push('تطابق وصف الشيت');
        } else if (descWords.length > 0) {
          const prodWords = ent.nameNorm.split(' ').filter(w => w.length >= 2);
          const overlapCount = descWords.filter(w =>
            prodWords.some(pw => pw === w || pw.includes(w) || w.includes(pw))
          ).length;
          if (overlapCount > 0) {
            const ratio = overlapCount / Math.max(1, Math.min(descWords.length, prodWords.length));
            if (overlapCount >= 2 || ratio >= 0.6) {
              score += Math.round(45 + ratio * 35);
              reasons.push('تشابه الاسم مع الوصف');
            } else {
              score += 20;
            }
          }
        }
      }

      // Price similarity check against expected product subtotal (COD - Bosta shipping) or gross COD
      if (ent.price > 0 && priceTargets.length > 0) {
        const hitSingle = priceTargets.some(t => Math.abs(ent.price - t) <= 1);
        if (hitSingle) {
          score += 55;
          isPriceMatch = true;
          matchedQty = 1;
          reasons.push(`مطابق للسعر (${formatEgp(ent.price)})`);
        } else {
          for (const q of [2, 3, 4]) {
            if (priceTargets.some(t => Math.abs(ent.price * q - t) <= 1.5)) {
              score += 40;
              isPriceMatch = true;
              matchedQty = q;
              reasons.push(`مطابق لـ ${q} قطعة (${formatEgp(ent.price * q)})`);
              break;
            }
          }
        }
      }

      if (score >= 40) {
        scoredCandidates.push({
          product: prod,
          variantId: ent.variantId,
          variantLabel: ent.variantLabel,
          price: ent.price,
          score,
          reason: reasons.join(' + '),
          isExactNameMatch,
          isPriceMatch,
          matchedQty
        });
      }
    }
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  const suggestions = scoredCandidates.slice(0, 6).map(c => ({
    product: c.product,
    variantId: c.variantId,
    variantLabel: c.variantLabel,
    price: c.price,
    reason: c.reason,
    score: c.score
  }));

  // Tier 3: Strong name/description + price or unambiguous name match
  const top = scoredCandidates[0];
  const second = scoredCandidates[1];
  if (top) {
    const clearLead = !second || top.score - second.score >= 20;
    if ((top.isExactNameMatch && clearLead) || (top.score >= 100 && clearLead)) {
      return {
        autoPicked: [buildPickedItem(top.product, top.variantId, top.matchedQty, warehouseId)],
        autoReason: `تم التعرّف تلقائياً: ${top.reason}`,
        suggestions
      };
    }

    // Tier 4: Unique unambiguous single-product price match against expected product price
    const exactPriceHits = scoredCandidates.filter(c => c.isPriceMatch && Math.abs(c.price * c.matchedQty - expectedProductPrice) <= 1.5);
    if (exactPriceHits.length === 1 && expectedProductPrice > 0) {
      const only = exactPriceHits[0];
      return {
        autoPicked: [buildPickedItem(only.product, only.variantId, only.matchedQty, warehouseId)],
        autoReason: `تم التعرّف تلقائياً بمطابقة السعر المتوقع (${formatEgp(expectedProductPrice)})`,
        suggestions
      };
    }
  }

  return {
    autoPicked: [],
    autoReason: null,
    suggestions
  };
};

export default function SheetOrderLinkAndImportModal({
  sheetRow,
  orders,
  settings,
  storeName,
  canWriteStore,
  initialMode,
  orderBasePath,
  onClose,
  onCreateOrderFromSheet,
  onLinkOrderWithSettlement,
  onUpdateOrderFromSheet,
  onLocalManualLinkOnly,
  onDeleteOrderFromStore
}: SheetOrderLinkAndImportModalProps) {
  const resolvedMatchedOrder = useMemo(() => {
    if (sheetRow.matchedOrder) return sheetRow.matchedOrder;
    const normTrack = normalizeTrackingCode(sheetRow.trackingKey);
    const normRef = normalizeTrackingCode(sheetRow.businessRefKey);
    return (
      orders.find(o => {
        const candidates = [
          o.waybillNumber,
          o.bostaTrackingNumber,
          o.turboTrackingNumber,
          o.returnTrackingNumber,
          o.referenceNumber,
          o.orderNumber,
          o.id
        ]
          .map(normalizeTrackingCode)
          .filter(Boolean);
        return (normTrack && candidates.includes(normTrack)) || (normRef && candidates.includes(normRef));
      }) || null
    );
  }, [sheetRow, orders]);

  const isAlreadyLinked = Boolean(resolvedMatchedOrder);
  const [confirmDeleteMatched, setConfirmDeleteMatched] = useState(false);
  const [mode, setMode] = useState<'create' | 'link' | 'edit'>(() => {
    if (initialMode === 'edit' && isAlreadyLinked && canWriteStore && onUpdateOrderFromSheet) {
      return 'edit';
    }
    if (isAlreadyLinked) {
      return canWriteStore && onUpdateOrderFromSheet && resolvedMatchedOrder?.platform === 'bosta_sheet_import'
        ? 'edit'
        : 'link';
    }
    return canWriteStore ? 'create' : 'link';
  });

  // Infer default statuses from sheet row
  const sheetStatusLower = (sheetRow.sheetStatus || '').toLowerCase();
  const isReturnedRow =
    sheetRow.category === 'not_collected_customer' ||
    sheetStatusLower.includes('return') ||
    sheetStatusLower.includes('cancel') ||
    sheetStatusLower.includes('fail') ||
    sheetStatusLower.includes('مرتجع');
  const isDeliveredRow =
    !isReturnedRow &&
    (sheetStatusLower.includes('deliver') ||
      sheetStatusLower.includes('تم التسليم') ||
      Boolean(sheetRow.sheetDeliveredAt) ||
      sheetRow.sheetGrossAmount > 0);
  const hasCashout = Boolean((sheetRow.sheetCashoutId || '').trim());

  const defaultOrderStatus: OrderStatus = isReturnedRow
    ? 'مرتجع'
    : hasCashout && isDeliveredRow
    ? 'تم_التحصيل'
    : isDeliveredRow
    ? 'تم_التوصيل'
    : 'قيد_الشحن';

  const defaultPaymentStatus: PaymentStatus = isReturnedRow
    ? 'مرتجع'
    : isDeliveredRow
    ? 'مدفوع'
    : 'بانتظار الدفع';

  // Form states for Create & Edit modes
  const [orderNumber, setOrderNumber] = useState(
    resolvedMatchedOrder?.orderNumber || sheetRow.businessRefKey || `BST-${sheetRow.trackingKey.slice(-6)}`
  );
  const [customerName, setCustomerName] = useState(
    resolvedMatchedOrder?.customerName || sheetRow.customerName || 'عميل بوسطة'
  );
  const [customerPhone, setCustomerPhone] = useState(
    resolvedMatchedOrder?.customerPhone || sheetRow.phoneRaw || ''
  );
  const [city, setCity] = useState(
    resolvedMatchedOrder?.governorate || resolvedMatchedOrder?.city || sheetRow.dropoffCity || ''
  );
  const [customerAddress, setCustomerAddress] = useState(
    resolvedMatchedOrder?.customerAddress || sheetRow.dropoffAddress || sheetRow.dropoffCity || ''
  );
  const [brandName, setBrandName] = useState(
    resolvedMatchedOrder?.merchantBrandName || sheetRow.brandName || storeName
  );
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    resolvedMatchedOrder?.status || defaultOrderStatus
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    resolvedMatchedOrder?.paymentStatus || defaultPaymentStatus
  );

  // Shipping Spread Settlement state (Customer Shipping Fee vs Carrier Actual Fee)
  const actualCarrierFee = round2(sheetRow.sheetFeesAmount || 0);
  const initialBostaQuote = useMemo(
    () => resolveBostaShippingQuote(sheetRow.dropoffCity || '', sheetRow.dropoffAddress || '', settings),
    [sheetRow.dropoffCity, sheetRow.dropoffAddress, settings]
  );
  const bostaCityQuote = useMemo(
    () =>
      resolveBostaShippingQuote(
        city || sheetRow.dropoffCity || '',
        customerAddress || sheetRow.dropoffAddress || '',
        settings
      ),
    [city, customerAddress, sheetRow.dropoffCity, sheetRow.dropoffAddress, settings]
  );
  const defaultCityFee = useMemo(() => {
    if (resolvedMatchedOrder && resolvedMatchedOrder.shippingFee !== undefined && resolvedMatchedOrder.shippingFee >= 0) {
      return resolvedMatchedOrder.shippingFee;
    }
    return initialBostaQuote.price;
  }, [resolvedMatchedOrder?.shippingFee, initialBostaQuote.price]);

  const [customerShippingFeeStr, setCustomerShippingFeeStr] = useState(String(defaultCityFee));
  const [codAmountStr, setCodAmountStr] = useState(
    String(
      resolvedMatchedOrder
        ? round2(
            resolvedMatchedOrder.totalAmountOverride ??
              resolvedMatchedOrder.totalPrice ??
              sheetRow.sheetGrossAmount ??
              0
          )
        : round2(sheetRow.sheetGrossAmount || 0)
    )
  );
  const [walletShippingSource, setWalletShippingSource] = useState<'customer' | 'carrier'>(() => {
    if (resolvedMatchedOrder?.sheetFeeBillingMode === 'store_company_fees') return 'customer';
    if (resolvedMatchedOrder?.sheetFeeBillingMode === 'carrier_all_inclusive') return 'carrier';
    return actualCarrierFee > 0 ? 'carrier' : 'customer';
  });
  const [settlementNotes, setSettlementNotes] = useState(resolvedMatchedOrder?.notes || '');

  // Store shipping company settings (Bosta) for itemized store_company_fees mode
  const bostaCompFees = useMemo(() => getCompanySpecificFees(settings, 'بوسطة'), [settings]);
  const useCustomBostaFees = bostaCompFees?.useCustomFees ?? false;
  const globalFinEnabled = Boolean(settings?.enableGlobalFinancials);
  const configuredInsuranceRate = useCustomBostaFees
    ? (bostaCompFees?.insuranceFeePercent ?? 0)
    : (globalFinEnabled && settings?.enableInsurance ? (settings.insuranceFeePercent ?? 0) : 0);
  const configuredInspectionFee = useCustomBostaFees
    ? (bostaCompFees?.inspectionFee ?? 0)
    : (globalFinEnabled && settings?.enableInspection ? (settings.inspectionFee ?? 0) : 0);
  const configuredVatRate = useCustomBostaFees
    ? (bostaCompFees?.enableVat === false
        ? 0
        : (bostaCompFees?.shippingVatRate ?? (isBosta('بوسطة') ? 0.14 : 0)))
    : (globalFinEnabled ? (settings?.shippingVatRate ?? 0.14) : 0);
  const applyFixedReturnSetting = useCustomBostaFees
    ? Boolean(bostaCompFees?.enableFixedReturn)
    : (globalFinEnabled && Boolean(settings?.enableReturnShipping));
  const configuredReturnFee = applyFixedReturnSetting
    ? (useCustomBostaFees ? (bostaCompFees?.returnShippingFee ?? 0) : (settings?.returnShippingFee ?? 0))
    : 0;
  const configuredCodEnabled = useCustomBostaFees
    ? Boolean(bostaCompFees?.enableCodFees)
    : Boolean(settings?.enableGlobalCod);

  const [applyInsurance, setApplyInsurance] = useState<boolean>(() =>
    resolvedMatchedOrder && resolvedMatchedOrder.sheetFeeBillingMode === 'store_company_fees'
      ? (resolvedMatchedOrder.isInsured ?? configuredInsuranceRate > 0)
      : configuredInsuranceRate > 0
  );
  const [applyInspection, setApplyInspection] = useState<boolean>(() =>
    resolvedMatchedOrder && resolvedMatchedOrder.sheetFeeBillingMode === 'store_company_fees'
      ? (resolvedMatchedOrder.includeInspectionFee ??
          (configuredInspectionFee > 0 && bostaCompFees?.defaultInspectionActive !== false))
      : configuredInspectionFee > 0 && bostaCompFees?.defaultInspectionActive !== false
  );
  const [applyCodFee, setApplyCodFee] = useState<boolean>(() =>
    resolvedMatchedOrder && resolvedMatchedOrder.sheetFeeBillingMode === 'store_company_fees'
      ? (resolvedMatchedOrder.codFee === undefined ? configuredCodEnabled : (Number(resolvedMatchedOrder.codFee) || 0) > 0 || configuredCodEnabled)
      : configuredCodEnabled
  );
  const [applyReturnFixedFee, setApplyReturnFixedFee] = useState<boolean>(applyFixedReturnSetting);

  // Unified Inventory Picker & Deduction state + Smart Auto-Detection
  const products: Product[] = settings.products || [];
  const warehouses = settings.warehouses || [];
  const initialWarehouseId =
    (settings as unknown as { defaultWarehouseId?: string }).defaultWarehouseId ||
    warehouses[0]?.id ||
    'wh_main';
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(initialWarehouseId);
  const [inventorySearch, setInventorySearch] = useState('');
  const initialDetection = useMemo(
    () =>
      isAlreadyLinked
        ? { autoPicked: [] as PickedInventoryItem[], autoReason: null as string | null, suggestions: [] }
        : detectInventoryProductsForSheetRow(
            sheetRow,
            products,
            initialWarehouseId,
            Math.max(0, round2((sheetRow.sheetGrossAmount || 0) - initialBostaQuote.price)),
            settings
          ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [pickedItems, setPickedItems] = useState<PickedInventoryItem[]>(initialDetection.autoPicked);
  const [autoDetectedReason, setAutoDetectedReason] = useState<string | null>(initialDetection.autoReason);
  const [deductFromInventory, setDeductFromInventory] = useState<boolean>(!isReturnedRow);

  // Existing Order Link mode state
  const [existingOrderSearch, setExistingOrderSearch] = useState(
    resolvedMatchedOrder?.orderNumber || sheetRow.phoneRaw || sheetRow.businessRefKey || ''
  );
  const [selectedExistingOrderId, setSelectedExistingOrderId] = useState<string>(
    resolvedMatchedOrder?.id || ''
  );

  const selectedExistingOrder = useMemo(
    () => orders.find(o => o.id === selectedExistingOrderId) || null,
    [orders, selectedExistingOrderId]
  );

  const pickedItemsSubtotal = useMemo(
    () => round2(pickedItems.reduce((s, i) => s + i.price * i.quantity, 0)),
    [pickedItems]
  );
  const pickedItemsCost = useMemo(
    () => round2(pickedItems.reduce((s, i) => s + i.cost * i.quantity, 0)),
    [pickedItems]
  );

  // Live shipping spread & company fees math
  const customerShippingFee = Math.max(0, round2(parseFloat(customerShippingFeeStr) || 0));
  const codAmount = Math.max(0, round2(parseFloat(codAmountStr) || 0));
  const computedProductPrice =
    pickedItems.length > 0
      ? pickedItemsSubtotal
      : Math.max(0, round2(codAmount - customerShippingFee));

  const storeFeesBreakdown = useMemo(() => {
    const isReturnedStatus = ['مرتجع', 'فشل_التوصيل', 'ملغي'].includes(orderStatus);
    const previewOrder: Order = {
      id: resolvedMatchedOrder?.id || 'preview_sheet_order',
      orderNumber: orderNumber.trim() || 'PREVIEW',
      date: '',
      shippingCompany: 'بوسطة',
      shippingArea: city.trim() || 'غير محدد',
      customerName: customerName.trim() || 'عميل بوسطة',
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      items:
        pickedItems.length > 0
          ? pickedItems.map(i => ({
              productId: i.productId,
              name: i.name,
              productName: i.name,
              quantity: i.quantity,
              price: i.price,
              cost: i.cost,
              weight: i.weight,
              variantId: i.variantId,
              variantName: i.variantName
            }))
          : resolvedMatchedOrder?.items || [],
      shippingFee: customerShippingFee,
      isManualShippingOverride: true,
      status: orderStatus,
      paymentStatus,
      productName: sheetRow.packageDescription || 'شحنة بوسطة',
      productPrice: computedProductPrice,
      productCost: pickedItemsCost > 0 ? pickedItemsCost : (resolvedMatchedOrder?.productCost || 0),
      totalPrice: codAmount,
      totalAmountOverride: codAmount,
      weight: 1,
      discount: 0,
      preparationStatus: 'جاهز',
      platform: 'bosta_sheet_import',
      sheetFeeBillingMode: 'store_company_fees',
      isInsured: applyInsurance,
      includeInspectionFee: applyInspection,
      inspectionFeePaidByCustomer: false
    };

    const insuranceFee =
      applyInsurance && configuredInsuranceRate > 0
        ? round2(calculateInsuranceFee(previewOrder, configuredInsuranceRate, settings))
        : 0;
    const vatValue = round2(calculateBostaVat(previewOrder, insuranceFee, settings));
    const inspectionFee =
      applyInspection && configuredInspectionFee > 0 ? round2(configuredInspectionFee) : 0;
    const isCollectedOrDelivered =
      orderStatus === 'تم_التحصيل' || (mode !== 'edit' && hasCashout && isDeliveredRow);
    const codFee =
      applyCodFee && isCollectedOrDelivered && codAmount > 0
        ? round2(calculateCodFee(previewOrder, settings))
        : 0;
    const returnShippingFee =
      applyReturnFixedFee && isReturnedStatus && configuredReturnFee > 0
        ? round2(configuredReturnFee)
        : 0;
    const totalStoreCarrierFees = round2(
      customerShippingFee + insuranceFee + vatValue + inspectionFee + codFee + returnShippingFee
    );

    return {
      insuranceFee,
      vatValue,
      inspectionFee,
      codFee,
      returnShippingFee,
      totalStoreCarrierFees
    };
  }, [
    orderStatus,
    resolvedMatchedOrder,
    orderNumber,
    city,
    customerName,
    customerPhone,
    customerAddress,
    pickedItems,
    customerShippingFee,
    paymentStatus,
    sheetRow.packageDescription,
    computedProductPrice,
    pickedItemsCost,
    codAmount,
    applyInsurance,
    applyInspection,
    applyCodFee,
    applyReturnFixedFee,
    configuredInsuranceRate,
    configuredInspectionFee,
    configuredReturnFee,
    settings,
    mode,
    hasCashout,
    isDeliveredRow
  ]);

  // Positive = store charges/collects MORE than Bosta charged
  // Negative = store subsidizes shipping vs Bosta
  const baseShippingSpread = round2(customerShippingFee - actualCarrierFee);
  const shippingSpread =
    walletShippingSource === 'customer'
      ? round2(storeFeesBreakdown.totalStoreCarrierFees - actualCarrierFee)
      : baseShippingSpread;
  const walletShippingFee =
    walletShippingSource === 'carrier'
      ? actualCarrierFee > 0
        ? actualCarrierFee
        : customerShippingFee
      : customerShippingFee;
  const effectiveWalletExpenses =
    walletShippingSource === 'customer'
      ? storeFeesBreakdown.totalStoreCarrierFees
      : walletShippingFee;
  const willDepositCodToWallet =
    mode === 'edit'
      ? codAmount > 0 && orderStatus === 'تم_التحصيل'
      : codAmount > 0 && (orderStatus === 'تم_التحصيل' || (hasCashout && isDeliveredRow));
  const willDeductShippingFromWallet =
    effectiveWalletExpenses > 0 && orderStatus !== 'قيد_التنفيذ';
  const walletNetImpact = round2(
    (willDepositCodToWallet ? codAmount : 0) -
      (willDeductShippingFromWallet ? effectiveWalletExpenses : 0)
  );

  // Filter unified inventory products
  const filteredProducts = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const list = q
      ? products.filter(
          p =>
            p.name.toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.merchantName || '').toLowerCase().includes(q)
        )
      : products;
    return list.slice(0, 12);
  }, [products, inventorySearch]);

  // Filter existing store orders for linking
  const filteredExistingOrders = useMemo(() => {
    const q = existingOrderSearch.trim().toLowerCase();
    const cleanPhone = (p: string) => p.replace(/\D/g, '').slice(-9);
    const rowPhone9 = cleanPhone(sheetRow.phoneRaw || '');

    const scored = orders
      .map(o => {
        let score = 0;
        if (resolvedMatchedOrder?.id === o.id) score += 100;
        if (
          (o.waybillNumber || '').trim().toLowerCase() === sheetRow.trackingKey.toLowerCase() ||
          (o.bostaTrackingNumber || '').trim().toLowerCase() === sheetRow.trackingKey.toLowerCase()
        ) {
          score += 90;
        }
        if (rowPhone9 && cleanPhone(o.customerPhone || '') === rowPhone9) score += 60;
        if (
          sheetRow.businessRefKey &&
          o.orderNumber.toLowerCase().includes(sheetRow.businessRefKey.toLowerCase())
        ) {
          score += 50;
        }
        if (q) {
          const matchQ =
            o.orderNumber.toLowerCase().includes(q) ||
            (o.waybillNumber || '').toLowerCase().includes(q) ||
            (o.customerName || '').toLowerCase().includes(q) ||
            (o.customerPhone || '').toLowerCase().includes(q) ||
            (o.merchantBrandName || '').toLowerCase().includes(q);
          if (!matchQ) return null;
          score += 20;
        }
        return { order: o, score };
      })
      .filter((x): x is { order: Order; score: number } => Boolean(x))
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 20).map(x => x.order);
  }, [orders, existingOrderSearch, sheetRow]);

  const handleAddProduct = (prod: Product, variantId?: string) => {
    const variant = variantId ? prod.variants.find(v => v.id === variantId) : undefined;
    const key = variant ? `${prod.id}__${variant.id}` : prod.id;
    const variantLabel = variant
      ? Object.values(variant.options || {}).join(' / ') || variant.sku
      : undefined;
    const availableStock = variant
      ? variant.warehouseStock?.[selectedWarehouseId] ?? variant.stockQuantity ?? variant.stock ?? null
      : prod.warehouseStock?.[selectedWarehouseId] ?? prod.stockQuantity ?? prod.stock ?? null;

    setPickedItems(prev => {
      const existingIdx = prev.findIndex(i => i.key === key);
      if (existingIdx !== -1) {
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          key,
          productId: prod.id,
          variantId: variant?.id,
          name: prod.name,
          variantName: variantLabel,
          sku: variant?.sku || prod.sku,
          quantity: 1,
          price: variant?.price ?? prod.price ?? 0,
          cost: variant?.costPrice ?? prod.costPrice ?? 0,
          weight: variant?.weight ?? prod.weight ?? 1,
          availableStock,
          thumbnail: variant?.image || prod.thumbnail
        }
      ];
    });
  };

  const handleConfirmCreate = () => {
    if (!onCreateOrderFromSheet) return;
    const finalItems: OrderItem[] =
      pickedItems.length > 0
        ? pickedItems.map(i => ({
            productId: i.productId,
            name: i.name,
            productName: i.name,
            quantity: i.quantity,
            price: i.price,
            cost: i.cost,
            weight: i.weight,
            variantId: i.variantId,
            variantName: i.variantName,
            thumbnail: i.thumbnail
          }))
        : [
            {
              productId: `sheet_item_${sheetRow.trackingKey}`,
              name: sheetRow.packageDescription || `شحنة بوسطة #${sheetRow.trackingKey}`,
              productName: sheetRow.packageDescription || `شحنة بوسطة #${sheetRow.trackingKey}`,
              quantity: 1,
              price: computedProductPrice,
              cost: 0,
              weight: 1
            }
          ];

    const spreadText = `تسوية الشحن: سعر شحن العميل ${formatEgp(customerShippingFee)} vs تكلفة بوسطة ${formatEgp(actualCarrierFee)} (فرق الشحن ${shippingSpread >= 0 ? '+' : ''}${formatEgp(shippingSpread)})`;
    const mergedNotes = [settlementNotes.trim(), spreadText].filter(Boolean).join(' | ');

    onCreateOrderFromSheet({
      sheetRow,
      orderNumber: orderNumber.trim() || `BST-${sheetRow.trackingKey.slice(-6)}`,
      customerName: customerName.trim() || 'عميل بوسطة',
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim() || city.trim() || '-',
      city: city.trim(),
      brandName: brandName.trim() || storeName,
      codAmount,
      customerShippingFee,
      actualCarrierFee,
      walletShippingFee,
      walletShippingSource,
      isInsured: walletShippingSource === 'customer' ? applyInsurance : false,
      insuranceFee: walletShippingSource === 'customer' ? storeFeesBreakdown.insuranceFee : 0,
      includeInspectionFee: walletShippingSource === 'customer' ? applyInspection : false,
      inspectionFee: walletShippingSource === 'customer' ? storeFeesBreakdown.inspectionFee : 0,
      vatValue: walletShippingSource === 'customer' ? storeFeesBreakdown.vatValue : 0,
      shippingVatRate: walletShippingSource === 'customer' ? configuredVatRate : 0,
      codFee: walletShippingSource === 'customer' ? storeFeesBreakdown.codFee : 0,
      returnShippingFee: walletShippingSource === 'customer' ? storeFeesBreakdown.returnShippingFee : 0,
      totalStoreCarrierFees:
        walletShippingSource === 'customer'
          ? storeFeesBreakdown.totalStoreCarrierFees
          : walletShippingFee,
      shippingSpread,
      productPrice: computedProductPrice,
      status: orderStatus,
      paymentStatus,
      collectionProcessed: orderStatus === 'تم_التحصيل' || (hasCashout && isDeliveredRow),
      cashoutId: sheetRow.sheetCashoutId,
      items: finalItems,
      deductFromInventory: deductFromInventory && pickedItems.length > 0,
      pickedFromInventory: pickedItems.length > 0,
      warehouseId: selectedWarehouseId,
      notes: mergedNotes
    });
    onClose();
  };

  const handleConfirmEdit = () => {
    if (!resolvedMatchedOrder || !onUpdateOrderFromSheet) return;
    onUpdateOrderFromSheet({
      orderId: resolvedMatchedOrder.id,
      sheetRow,
      orderNumber: orderNumber.trim() || resolvedMatchedOrder.orderNumber,
      customerName: customerName.trim() || resolvedMatchedOrder.customerName || 'عميل بوسطة',
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim() || city.trim() || '-',
      city: city.trim(),
      brandName: brandName.trim() || storeName,
      codAmount,
      customerShippingFee,
      actualCarrierFee,
      walletShippingFee,
      walletShippingSource,
      isInsured: walletShippingSource === 'customer' ? applyInsurance : false,
      insuranceFee: walletShippingSource === 'customer' ? storeFeesBreakdown.insuranceFee : 0,
      includeInspectionFee: walletShippingSource === 'customer' ? applyInspection : false,
      inspectionFee: walletShippingSource === 'customer' ? storeFeesBreakdown.inspectionFee : 0,
      vatValue: walletShippingSource === 'customer' ? storeFeesBreakdown.vatValue : 0,
      shippingVatRate: walletShippingSource === 'customer' ? configuredVatRate : 0,
      codFee: walletShippingSource === 'customer' ? storeFeesBreakdown.codFee : 0,
      returnShippingFee: walletShippingSource === 'customer' ? storeFeesBreakdown.returnShippingFee : 0,
      totalStoreCarrierFees:
        walletShippingSource === 'customer'
          ? storeFeesBreakdown.totalStoreCarrierFees
          : walletShippingFee,
      shippingSpread,
      status: orderStatus,
      paymentStatus,
      notes: settlementNotes.trim()
    });
    onClose();
  };

  const handleConfirmLink = () => {
    if (!selectedExistingOrder) return;
    if (canWriteStore && onLinkOrderWithSettlement) {
      const itemsToDeduct: OrderItem[] | undefined =
        deductFromInventory && !selectedExistingOrder.stockDeducted
          ? pickedItems.length > 0
            ? pickedItems.map(i => ({
                productId: i.productId,
                name: i.name,
                productName: i.name,
                quantity: i.quantity,
                price: i.price,
                cost: i.cost,
                weight: i.weight,
                variantId: i.variantId,
                variantName: i.variantName
              }))
            : selectedExistingOrder.items
          : undefined;

      onLinkOrderWithSettlement({
        orderId: selectedExistingOrder.id,
        sheetRow,
        customerShippingFee,
        actualCarrierFee,
        shippingSpread,
        deductFromInventory: Boolean(deductFromInventory && !selectedExistingOrder.stockDeducted),
        itemsToDeduct,
        warehouseId: selectedWarehouseId,
        notes: settlementNotes.trim() || undefined
      });
    } else {
      onLocalManualLinkOnly(sheetRow.trackingKey, selectedExistingOrder.id);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              ربط / تنزيل الأوردر وتسوية فرق سعر الشحن
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                بوليصة {sheetRow.trackingKey}
              </span>
              <span aria-hidden="true">·</span>
              <span>{sheetRow.customerName || 'بدون اسم'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                COD: {formatEgp(sheetRow.sheetGrossAmount)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-rose-600 dark:text-rose-400">
                شحن بوسطة الفعلي: -{formatEgp(actualCarrierFee)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
            {isAlreadyLinked && canWriteStore && onUpdateOrderFromSheet && (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'edit'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>تعديل بيانات الأوردر</span>
              </button>
            )}
            {!isAlreadyLinked && (
              <button
                type="button"
                disabled={!canWriteStore}
                onClick={() => setMode('create')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 ${
                  mode === 'create'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>تنزيل كأوردر جديد بالأوردرات + مخزون</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode('link')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'link'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{isAlreadyLinked ? 'تسوية الشحن / تغيير الربط' : 'ربط بأوردر موجود بالمتجر'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {resolvedMatchedOrder && orderBasePath && (
              <Link
                to={`${orderBasePath}/edit/${resolvedMatchedOrder.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold hover:bg-indigo-100"
              >
                <ExternalLink className="w-3 h-3" />
                <span>فتح التعديل الكامل</span>
              </Link>
            )}
            {!canWriteStore && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                الإنشاء المباشر متاح من لوحة صاحب المتجر
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* DELETE LINKED ORDER FROM STORE (CASCADE WALLET + RESTORE INVENTORY) */}
          {resolvedMatchedOrder && canWriteStore && onDeleteOrderFromStore && (
            <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-black text-rose-800 dark:text-rose-200">
                    {resolvedMatchedOrder.platform === 'bosta_sheet_import'
                      ? `الأوردر نازل حالياً في طلبات المتجر (#${resolvedMatchedOrder.orderNumber})`
                      : `الأوردر مربوط وموجود حالياً في طلبات المتجر (#${resolvedMatchedOrder.orderNumber})`}
                  </div>
                  <div className="text-[11px] text-rose-700/90 dark:text-rose-300/90 mt-0.5">
                    {resolvedMatchedOrder.stockDeducted
                      ? `ساحب مخزون (${(resolvedMatchedOrder.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)} قطعة) — عند إلغاء النزول سيتم رد المخزون ومسح جميع حركاته من المحفظة.`
                      : 'عند إلغاء النزول سيتم مسح الأوردر من المتجر ومسح جميع حركاته من المحفظة وإعادة ضبط الرصيد.'}
                  </div>
                </div>
                {!confirmDeleteMatched ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteMatched(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>
                      {resolvedMatchedOrder.platform === 'bosta_sheet_import'
                        ? 'إلغاء النزول وحذف من المتجر'
                        : 'فك ربط وحذف من المتجر'}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteMatched(false)}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 text-[11px] font-bold cursor-pointer"
                    >
                      تراجع
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteOrderFromStore(resolvedMatchedOrder.id);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-black cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>تأكيد المسح ورد المخزون والمحفظة</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LIVE SHIPPING SPREAD SETTLEMENT CALCULATOR (Always visible in both modes!) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                <Truck className="w-4 h-4 text-[#008060]" />
                <span>تسوية فرق سعر الشحن (سعر العميل مقابل تكلفة بوسطة)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                صافي بوسطة: {formatEgp(sheetRow.sheetNetPayout)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  مصاريف بوسطة الفعلية (بالشيت)
                </label>
                <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                  {formatEgp(actualCarrierFee)}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    سعر الشحن اللي بتديه للعميل / البراند
                  </label>
                  <div className="flex items-center gap-2">
                    {customerShippingFee !== bostaCityQuote.price && (
                      <button
                        type="button"
                        onClick={() => setCustomerShippingFeeStr(String(bostaCityQuote.price))}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        title={`تطبيق تسعيرة بوسطة (${bostaCityQuote.label})`}
                      >
                        بوسطة ({bostaCityQuote.price} ج.م)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCustomerShippingFeeStr('0')}
                      className="text-[10px] font-bold text-[#008060] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      شحن مجاني (0)
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={customerShippingFeeStr}
                  onChange={e => setCustomerShippingFeeStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono tabular-nums font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#008060]/30"
                />
                <div className="mt-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {customerShippingFee === 0
                    ? 'شحن مجاني للعميل (0 ج.م)'
                    : customerShippingFee === bostaCityQuote.price
                    ? `✓ مطابق لتسعيرة بوسطة (${bostaCityQuote.label})`
                    : `تسعيرة بوسطة المقترحة (${bostaCityQuote.label}): ${formatEgp(bostaCityQuote.price)}`}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {walletShippingSource === 'customer'
                    ? 'فرق تسعيرة المتجر − بوسطة'
                    : 'فرق الشحن (العميل − بوسطة)'}
                </label>
                <div
                  className={`px-3 py-2 rounded-xl border font-mono tabular-nums font-black ${
                    shippingSpread > 0
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : shippingSpread < 0
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {shippingSpread > 0 ? `+${formatEgp(shippingSpread)} (فائض تسوية)` : shippingSpread < 0 ? `${formatEgp(shippingSpread)} (دعم عليك)` : '0 ج.م (متطابق)'}
                </div>
              </div>
            </div>
          </div>

          {mode === 'create' || mode === 'edit' ? (
            <>
              {/* Order Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    رقم الأوردر بالمتجر
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={e => setOrderNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    البراند
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    إجمالي التحصيل (COD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={codAmountStr}
                    onChange={e => setCodAmountStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    اسم العميل
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    المحافظة / المنطقة
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    حالة الأوردر
                  </label>
                  <select
                    value={orderStatus}
                    onChange={e => setOrderStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="تم_التحصيل">تم التحصيل (مصفّى)</option>
                    <option value="تم_التوصيل">تم التوصيل</option>
                    <option value="قيد_الشحن">قيد الشحن</option>
                    <option value="مرتجع">مرتجع</option>
                    <option value="قيد_التنفيذ">قيد التنفيذ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    حالة الدفع
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="مدفوع">مدفوع</option>
                    <option value="بانتظار الدفع">بانتظار الدفع</option>
                    <option value="مدفوع جزئياً">مدفوع جزئياً</option>
                    <option value="مرتجع">مرتجع</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    العنوان
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* LIVE STORE WALLET IMPACT PREVIEW */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-slate-900 dark:text-white">
                    {mode === 'edit'
                      ? 'ملخص التأثير المحدّث على محفظة المتجر'
                      : 'ملخص التأثير على محفظة المتجر عند التنزيل'}
                  </div>
                  <div className="inline-flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setWalletShippingSource('customer')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                        walletShippingSource === 'customer'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      تسعيرة المتجر + مصاريف شركة الشحن ({formatEgp(storeFeesBreakdown.totalStoreCarrierFees)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalletShippingSource('carrier')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                        walletShippingSource === 'carrier'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      تكلفة بوسطة الشاملة بالشيت ({formatEgp(actualCarrierFee)})
                    </button>
                  </div>
                </div>

                {walletShippingSource === 'customer' && (
                  <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-200/70 dark:border-indigo-900/50 space-y-2 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black text-indigo-900 dark:text-indigo-200">
                        تفصيل مصاريف شركة الشحن المطبّقة من إعدادات المتجر (بوسطة):
                      </span>
                      <span className="font-mono tabular-nums font-black text-indigo-700 dark:text-indigo-300">
                        الإجمالي: -{formatEgp(storeFeesBreakdown.totalStoreCarrierFees)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold">الشحن الأساسي</div>
                        <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                          -{formatEgp(customerShippingFee)}
                        </div>
                      </div>

                      <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold">
                          ضريبة ({Math.round(configuredVatRate * 100)}%)
                        </div>
                        <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                          {storeFeesBreakdown.vatValue > 0 ? `-${formatEgp(storeFeesBreakdown.vatValue)}` : '0 ج.م'}
                        </div>
                      </div>

                      <label className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-1.5 cursor-pointer">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold">
                            التأمين ({configuredInsuranceRate}%)
                          </div>
                          <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                            {storeFeesBreakdown.insuranceFee > 0 ? `-${formatEgp(storeFeesBreakdown.insuranceFee)}` : '0 ج.م'}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={applyInsurance}
                          disabled={configuredInsuranceRate <= 0}
                          onChange={e => setApplyInsurance(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer disabled:opacity-40"
                        />
                      </label>

                      <label className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-1.5 cursor-pointer">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold">المعاينة</div>
                          <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                            {storeFeesBreakdown.inspectionFee > 0 ? `-${formatEgp(storeFeesBreakdown.inspectionFee)}` : '0 ج.م'}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={applyInspection}
                          disabled={configuredInspectionFee <= 0}
                          onChange={e => setApplyInspection(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer disabled:opacity-40"
                        />
                      </label>

                      <label className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-1.5 cursor-pointer">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold">رسوم COD</div>
                          <div className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                            {storeFeesBreakdown.codFee > 0 ? `-${formatEgp(storeFeesBreakdown.codFee)}` : '0 ج.م'}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={applyCodFee}
                          disabled={!configuredCodEnabled}
                          onChange={e => setApplyCodFee(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer disabled:opacity-40"
                        />
                      </label>
                    </div>

                    {['مرتجع', 'فشل_التوصيل', 'ملغي'].includes(orderStatus) && configuredReturnFee > 0 && (
                      <label className="inline-flex items-center gap-2 pt-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={applyReturnFixedFee}
                          onChange={e => setApplyReturnFixedFee(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-rose-600 cursor-pointer"
                        />
                        <span className="font-bold text-rose-700 dark:text-rose-300 font-mono tabular-nums">
                          تطبيق رسوم المرتجع الثابتة من إعدادات الشركة (-{formatEgp(configuredReturnFee)})
                        </span>
                      </label>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-slate-500 font-bold">إيداع التحصيل (COD)</div>
                    <div
                      className={`mt-0.5 font-mono tabular-nums font-black ${
                        willDepositCodToWallet
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {willDepositCodToWallet
                        ? `+${formatEgp(codAmount)}`
                        : codAmount === 0
                        ? '0 ج.م (تحصيل 0 — لا يُضاف رصيد)'
                        : '0 ج.م (عند التحصيل)'}
                    </div>
                  </div>

                  <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-slate-500 font-bold">
                      {walletShippingSource === 'customer'
                        ? 'إجمالي استقطاع الشحن والرسوم'
                        : 'خصم مصاريف الشحن'}
                    </div>
                    <div className="mt-0.5 font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                      {willDeductShippingFromWallet
                        ? `-${formatEgp(effectiveWalletExpenses)}`
                        : '0 ج.م (قيد التنفيذ)'}
                    </div>
                  </div>

                  <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-slate-500 font-bold">
                      {mode === 'edit' ? 'صافي التأثير المحدّث بالمحفظة' : 'صافي الحركة بالمحفظة'}
                    </div>
                    <div
                      className={`mt-0.5 font-mono tabular-nums font-black ${
                        walletNetImpact > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : walletNetImpact < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {walletNetImpact > 0 ? `+${formatEgp(walletNetImpact)}` : formatEgp(walletNetImpact)}
                    </div>
                  </div>
                </div>
              </div>

              {/* UNIFIED INVENTORY PICKER & OPTIONAL DEDUCTION (create mode only) */}
              {mode === 'create' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                    <Boxes className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>المنتجات والخصم من المخزون الموحّد</span>
                    {sheetRow.packageDescription && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={sheetRow.packageDescription}>
                        وصف الشيت: {sheetRow.packageDescription}
                      </span>
                    )}
                  </div>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deductFromInventory}
                      onChange={e => setDeductFromInventory(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#008060] cursor-pointer"
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      خصم الكمية تلقائياً من المخزون الموحّد
                    </span>
                  </label>
                </div>

                {autoDetectedReason && pickedItems.length > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-200">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{autoDetectedReason}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPickedItems([]);
                        setAutoDetectedReason(null);
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline cursor-pointer"
                    >
                      مسح الاختيار التلقائي
                    </button>
                  </div>
                )}

                {(() => {
                  const liveDetection = detectInventoryProductsForSheetRow(
                    sheetRow,
                    products,
                    selectedWarehouseId,
                    Math.max(0, round2(codAmount - customerShippingFee)),
                    settings
                  );
                  if (pickedItems.length === 0 && liveDetection.suggestions.length > 0) {
                    return (
                      <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/70 dark:border-indigo-900/50 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-800 dark:text-indigo-200">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>مقترحات مطابقة من المخزن (بناءً على الوصف / السعر المتوقع {formatEgp(Math.max(0, round2(codAmount - customerShippingFee)))}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {liveDetection.suggestions.map((sug, idx) => (
                            <button
                              key={`${sug.product.id}_${sug.variantId || 'base'}_${idx}`}
                              type="button"
                              onClick={() => {
                                handleAddProduct(sug.product, sug.variantId);
                                setAutoDetectedReason(`تم الاختيار من المقترحات (${sug.reason})`);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 text-[11px] font-bold text-slate-800 dark:text-slate-100 cursor-pointer transition-colors"
                              title={sug.reason}
                            >
                              <Plus className="w-3 h-3 text-indigo-600" />
                              <span>{sug.product.name}{sug.variantLabel ? ` (${sug.variantLabel})` : ''}</span>
                              <span className="font-mono tabular-nums text-[10px] text-indigo-600 dark:text-indigo-400">
                                {formatEgp(sug.price)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={inventorySearch}
                      onChange={e => setInventorySearch(e.target.value)}
                      placeholder="ابحث في المخزون الموحّد بالاسم أو SKU لإضافته للأوردر..."
                      className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  {warehouses.length > 0 && (
                    <select
                      value={selectedWarehouseId}
                      onChange={e => setSelectedWarehouseId(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          مخزن: {w.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {products.length === 0 ? (
                  <div className="text-[11px] text-slate-500 py-2">
                    لا توجد منتجات مسجّلة في المخزون الموحّد حالياً — سيتم تنزيل الأوردر بوصف الشحنة من الشيت مباشرة.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                    {filteredProducts.map(prod => {
                      const avail =
                        prod.warehouseStock?.[selectedWarehouseId] ??
                        prod.stockQuantity ??
                        prod.stock ??
                        null;
                      return (
                        <div
                          key={prod.id}
                          className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {prod.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                              {prod.sku ? `SKU: ${prod.sku} · ` : ''}
                              سعر: {formatEgp(prod.price)}
                              {avail !== null ? ` · رصيد المخزون: ${avail}` : ''}
                            </div>
                          </div>

                          {prod.hasVariants && prod.variants?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {prod.variants.slice(0, 4).map(v => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => handleAddProduct(prod, v.id)}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-[10px] font-bold cursor-pointer"
                                >
                                  + {Object.values(v.options || {}).join('/') || v.sku}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddProduct(prod)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold hover:opacity-90 cursor-pointer shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Inventory Items */}
                {pickedItems.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      الأصناف المختارة ({pickedItems.length}) — إجمالي الأصناف:{' '}
                      <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatEgp(pickedItemsSubtotal)}
                      </span>
                      {pickedItemsCost > 0 && (
                        <span className="font-mono tabular-nums text-slate-400 mr-2">
                          (تكلفة: {formatEgp(pickedItemsCost)})
                        </span>
                      )}
                    </div>
                    {pickedItems.map(item => {
                      const nextStock =
                        item.availableStock !== null
                          ? Math.max(0, item.availableStock - item.quantity)
                          : null;
                      return (
                        <div
                          key={item.key}
                          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {item.name}
                              {item.variantName ? ` (${item.variantName})` : ''}
                            </div>
                            <div className="text-[10px] font-mono tabular-nums text-slate-500">
                              {formatEgp(item.price)} × {item.quantity} ={' '}
                              {formatEgp(item.price * item.quantity)}
                              {deductFromInventory && item.availableStock !== null && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-2">
                                  · المخزون: {item.availableStock} ← {nextStock}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setPickedItems(prev =>
                                  prev.map(p =>
                                    p.key === item.key
                                      ? { ...p, quantity: Math.max(1, p.quantity - 1) }
                                      : p
                                  )
                                )
                              }
                              className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-mono tabular-nums font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPickedItems(prev =>
                                  prev.map(p =>
                                    p.key === item.key ? { ...p, quantity: p.quantity + 1 } : p
                                  )
                                )
                              }
                              className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPickedItems(prev => prev.filter(p => p.key !== item.key))
                              }
                              className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </>
          ) : (
            /* MODE 2: LINK TO EXISTING STORE ORDER */
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={existingOrderSearch}
                  onChange={e => setExistingOrderSearch(e.target.value)}
                  placeholder="ابحث عن الأوردر بالمتجر برقم الأوردر أو اسم العميل أو الهاتف..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {filteredExistingOrders.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    لا توجد أوردرات مطابقة — يمكنك التبديل إلى «تنزيل كأوردر جديد بالأوردرات» لإنشائه فوراً.
                  </div>
                ) : (
                  filteredExistingOrders.map(ord => {
                    const selected = ord.id === selectedExistingOrderId;
                    return (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => {
                          setSelectedExistingOrderId(ord.id);
                          if (ord.shippingFee !== undefined && ord.shippingFee >= 0) {
                            setCustomerShippingFeeStr(String(ord.shippingFee));
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 text-right flex flex-wrap items-center justify-between gap-2 transition-colors cursor-pointer ${
                          selected
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/35'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                              #{ord.orderNumber}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                              {ord.customerName}
                            </span>
                            <span className="font-mono tabular-nums text-slate-500">
                              {ord.customerPhone}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono tabular-nums">
                            شحن مسجّل للعميل: {formatEgp(ord.shippingFee || 0)} · الحالة: {ord.status}
                            {ord.stockDeducted ? ' · مخصوم من المخزون' : ' · لم يُخصم من المخزون'}
                          </div>
                        </div>
                        {selected && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedExistingOrder && !selectedExistingOrder.stockDeducted && canWriteStore && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductFromInventory}
                    onChange={e => setDeductFromInventory(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#008060] cursor-pointer"
                  />
                  <span className="font-bold text-amber-900 dark:text-amber-200">
                    خصم أصناف الأوردر #{selectedExistingOrder.orderNumber} من المخزون الموحّد الآن (لأنه لم يُخصم مسبقاً)
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Optional Settlement Note */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              ملاحظة تسوية (اختياري)
            </label>
            <input
              type="text"
              value={settlementNotes}
              onChange={e => setSettlementNotes(e.target.value)}
              placeholder="مثال: تسوية فرق شحن البراند أو خصم عمولة..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            {mode === 'edit'
              ? `تعديل الأوردر #${orderNumber} · تحصيل: ${formatEgp(codAmount)} · شحن العميل: ${formatEgp(customerShippingFee)}`
              : mode === 'create'
              ? `سعر المنتج: ${formatEgp(computedProductPrice)} · شحن العميل: ${formatEgp(customerShippingFee)} · فرق الشحن: ${shippingSpread >= 0 ? '+' : ''}${formatEgp(shippingSpread)}`
              : selectedExistingOrder
              ? `سيتم ربط البوليصة بالأوردر #${selectedExistingOrder.orderNumber} وتسجيل فرق الشحن (${shippingSpread >= 0 ? '+' : ''}${formatEgp(shippingSpread)})`
              : 'اختر أوردراً من القائمة للربط'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              إلغاء
            </button>
            {mode === 'edit' ? (
              <button
                type="button"
                disabled={!canWriteStore || !onUpdateOrderFromSheet || !resolvedMatchedOrder}
                onClick={handleConfirmEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#008060] hover:bg-[#006b50] text-white text-xs font-bold disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>حفظ تعديلات الأوردر والمحفظة</span>
              </button>
            ) : mode === 'create' ? (
              <button
                type="button"
                disabled={!canWriteStore || !onCreateOrderFromSheet}
                onClick={handleConfirmCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#008060] hover:bg-[#006b50] text-white text-xs font-bold disabled:opacity-40 transition-colors cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>
                  {deductFromInventory && pickedItems.length > 0
                    ? 'تنزيل بالأوردرات والخصم من المخزون'
                    : 'تنزيل الأوردر وحفظ التسوية'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!selectedExistingOrder}
                onClick={handleConfirmLink}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>حفظ الربط وتسوية الشحن</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
