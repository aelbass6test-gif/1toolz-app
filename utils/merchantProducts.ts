import type { MerchantStockAllocation, Product } from '../types';

/**
 * Canonical product-to-merchant relationship.
 * IDs are authoritative; names and phone numbers are intentionally not used here.
 */
export const normalizeMerchantId = (value: unknown): string =>
  String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export const normalizeMerchantLabel = (value: unknown): string => {
  let name = String(value ?? '').trim().replace(/\s+/g, ' ');
  name = name.replace(/\s*\((موكل|مورد|صاحب بضاعة|تاجر|partner|employee|admin|الموكل الرئيسي|مشترك|وكيل معتمد|وكيل أمانة)\)/gi, '');
  
  // Normalize compound Arabic names
  name = name.replace(/عبد\s+/g, 'عبد');
  name = name.replace(/ابو\s+/g, 'ابو');
  name = name.replace(/بن\s+/g, 'بن');

  return name
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/ـ+/g, '') // remove tatweel
    .toLowerCase()
    .trim();
};

export const getMerchantAllocation = (
  product: Partial<Product> | any,
  merchantId: string,
  merchantName?: string
): MerchantStockAllocation | undefined => {
  const targetId = normalizeMerchantId(merchantId);
  const targetName = merchantName ? normalizeMerchantLabel(merchantName) : '';
  if (!Array.isArray(product?.merchantAllocations)) return undefined;
  if (!targetId && !targetName) return undefined;

  return product.merchantAllocations.find(
    (allocation: MerchantStockAllocation) => 
      (targetId && normalizeMerchantId(allocation?.merchantId) === targetId) ||
      (targetName && normalizeMerchantLabel(allocation?.merchantName) === targetName)
  );
};

export const productBelongsToMerchant = (
  product: Partial<Product> | any,
  merchantId: string,
  merchantName?: string
): boolean => {
  if (!product) return false;
  const targetId = normalizeMerchantId(merchantId);
  const targetName = merchantName ? normalizeMerchantLabel(merchantName) : '';
  
  if (!targetId && !targetName) return false;

  // 1. Direct ID matches
  if (targetId && normalizeMerchantId(product.merchantId) === targetId) return true;
  if (targetId && normalizeMerchantId(product.supplierId) === targetId) return true;
  if (targetId && Array.isArray(product.merchantIds) && product.merchantIds.some((id: unknown) => normalizeMerchantId(id) === targetId)) {
    return true;
  }

  // 2. Direct Name matches (using robust label normalization)
  const pName = normalizeMerchantLabel(product.merchantName || '');
  const pSupName = normalizeMerchantLabel(product.supplierName || '');
  
  if (targetName) {
    if (pName && (pName === targetName || pName.includes(targetName) || targetName.includes(pName))) return true;
    if (pSupName && (pSupName === targetName || pSupName.includes(targetName) || targetName.includes(pSupName))) return true;
  }

  // 3. Fallback: ID as Name (handles cases where name was stored in ID field)
  if (targetId && pName && (pName === targetId || pName.includes(targetId) || targetId.includes(pName))) return true;

  // 4. Allocation matches (ID or Name)
  return Boolean(getMerchantAllocation(product, targetId, merchantName));
};

/** Only an explicit merchant ID makes an order a merchant sale; names are descriptive only. */
export const isMerchantOrder = (order: any): boolean => {
  if (!order || typeof order !== 'object') return false;
  const orderMerchantId = normalizeMerchantId(order.merchantId);
  if (orderMerchantId && orderMerchantId !== 'pending') return true;
  return Array.isArray(order.items) && order.items.some((item: any) =>
    Boolean(normalizeMerchantId(item?.merchantId))
  );
};

export const isUnresolvedMerchantOrder = (order: any): boolean => {
  if (!order || typeof order !== 'object') return false;
  const hasOrderId = Boolean(normalizeMerchantId(order.merchantId) && normalizeMerchantId(order.merchantId) !== 'pending');
  if (!hasOrderId && String(order.merchantName || '').trim()) return true;
  if (hasOrderId) return false;
  return Array.isArray(order.items) && order.items.some((item: any) =>
    !normalizeMerchantId(item?.merchantId) && Boolean(String(item?.merchantName || '').trim())
  );
};

/** Unresolved name-only agency orders are excluded from store and merchant reports until reviewed. */
export const getStoreOwnedOrders = <T extends any>(orders: T[] | undefined): T[] =>
  (Array.isArray(orders) ? orders : []).filter(order => !isMerchantOrder(order) && !isUnresolvedMerchantOrder(order));

/**
 * Safe legacy migration: only already-explicit IDs are normalized into the ID list.
 * Name-only relationships are never linked automatically; they remain reviewable.
 */
export const migrateLegacyProductMerchantLinks = (
  products: any[] | undefined,
  suppliers: any[] | undefined,
  partners: any[] | undefined
): { products: any[]; changed: boolean; migratedCount: number; ambiguousCount: number } => {
  const source = Array.isArray(products) ? products : [];
  const entities = [...(Array.isArray(suppliers) ? suppliers : []), ...(Array.isArray(partners) ? partners : [])]
    .filter(entity => entity?.id && normalizeMerchantLabel(entity.name))
    .map(entity => ({ id: String(entity.id), name: normalizeMerchantLabel(entity.name) }));

  const idsByName = new Map<string, string[]>();
  entities.forEach(entity => {
    const ids = idsByName.get(entity.name) || [];
    if (!ids.includes(entity.id)) ids.push(entity.id);
    idsByName.set(entity.name, ids);
  });

  let changed = false;
  let migratedCount = 0;
  let ambiguousCount = 0;
  const migratedProducts = source.map(product => {
    if (!product || typeof product !== 'object') return product;

    const nextMerchantIds = Array.isArray(product.merchantIds) ? [...product.merchantIds] : [];
    let nextProduct = product;
    let productChanged = false;

    const addMerchantId = (merchantId: string) => {
      if (!nextMerchantIds.some(id => normalizeMerchantId(id) === normalizeMerchantId(merchantId))) {
        nextMerchantIds.push(merchantId);
        productChanged = true;
      }
    };

    const legacyName = normalizeMerchantLabel(product.merchantName || product.supplierName);
    if (!normalizeMerchantId(product.merchantId) && !normalizeMerchantId(product.supplierId) && (idsByName.get(legacyName) || []).length > 1) {
      ambiguousCount += 1;
    }

    const nextAllocations = Array.isArray(product.merchantAllocations)
      ? product.merchantAllocations.map((allocation: any) => {
          if (normalizeMerchantId(allocation?.merchantId)) {
            addMerchantId(String(allocation.merchantId));
            return allocation;
          }
          const allocationName = normalizeMerchantLabel(allocation?.merchantName);
          if ((idsByName.get(allocationName) || []).length > 1) ambiguousCount += 1;
          return allocation;
        })
      : product.merchantAllocations;

    if (Array.isArray(product.merchantAllocations) && nextAllocations.some((allocation: any, index: number) => allocation !== product.merchantAllocations[index])) {
      nextProduct = { ...nextProduct, merchantAllocations: nextAllocations };
      productChanged = true;
    }

    if (nextMerchantIds.length > 0 && JSON.stringify(nextMerchantIds) !== JSON.stringify(product.merchantIds || [])) {
      nextProduct = { ...nextProduct, merchantIds: Array.from(new Set(nextMerchantIds)) };
      productChanged = true;
    }

    if (!product.ownerType) {
      const explicitIds = new Set([
        normalizeMerchantId(product.merchantId),
        normalizeMerchantId(product.supplierId),
        ...nextMerchantIds.map(normalizeMerchantId),
        ...(Array.isArray(nextAllocations) ? nextAllocations.map((allocation: any) => normalizeMerchantId(allocation?.merchantId)) : [])
      ].filter(Boolean));
      if (explicitIds.size > 1 || (Array.isArray(nextAllocations) && nextAllocations.length > 0)) {
        nextProduct = { ...nextProduct, ownerType: 'shared' };
        productChanged = true;
      } else if (explicitIds.size === 1) {
        nextProduct = { ...nextProduct, ownerType: 'merchant' };
        productChanged = true;
      } else if (!normalizeMerchantLabel(product.merchantName || product.supplierName)) {
        nextProduct = { ...nextProduct, ownerType: 'store' };
        productChanged = true;
      }
    }

    if (productChanged) {
      changed = true;
      return nextProduct;
    }
    return product;
  });

  return { products: migratedProducts, changed, migratedCount, ambiguousCount };
};

/** Finds legacy products whose owner name maps to multiple entities. */
export const getProductsNeedingMerchantReview = (
  products: any[] | undefined,
  suppliers: any[] | undefined,
  partners: any[] | undefined
): any[] => {
  const source = Array.isArray(products) ? products : [];
  const entities = [...(Array.isArray(suppliers) ? suppliers : []), ...(Array.isArray(partners) ? partners : [])]
    .filter(entity => entity?.id && normalizeMerchantLabel(entity.name))
    .map(entity => ({ id: String(entity.id), name: normalizeMerchantLabel(entity.name) }));
  const idsByName = new Map<string, string[]>();
  entities.forEach(entity => {
    const ids = idsByName.get(entity.name) || [];
    if (!ids.includes(entity.id)) ids.push(entity.id);
    idsByName.set(entity.name, ids);
  });

  return source.filter(product => {
    if (!product || typeof product !== 'object') return false;
    const primaryName = normalizeMerchantLabel(product.merchantName || product.supplierName);
    const primaryNeedsReview = !normalizeMerchantId(product.merchantId) &&
      !normalizeMerchantId(product.supplierId) &&
      !(Array.isArray(product.merchantIds) && product.merchantIds.some((id: unknown) => normalizeMerchantId(id))) &&
      !(Array.isArray(product.merchantAllocations) && product.merchantAllocations.some((allocation: any) => normalizeMerchantId(allocation?.merchantId))) &&
      Boolean(primaryName);
    const allocationNeedsReview = Array.isArray(product.merchantAllocations) && product.merchantAllocations.some((allocation: any) =>
      !normalizeMerchantId(allocation?.merchantId) &&
      Boolean(normalizeMerchantLabel(allocation?.merchantName)) &&
      Boolean(normalizeMerchantLabel(allocation?.merchantName))
    );
    return primaryNeedsReview || allocationNeedsReview;
  });
};

const getNumericStock = (product: any): number => {
  if (product?.hasVariants && Array.isArray(product.variants)) {
    return product.variants.reduce((sum: number, variant: any) => {
      const variantStock = variant?.stockQuantity ?? variant?.stock ?? 0;
      return sum + (Number(variantStock) || 0);
    }, 0);
  }

  if (product?.stockQuantity !== null && product?.stockQuantity !== undefined) {
    return Number(product.stockQuantity) || 0;
  }

  return Number(product?.stock ?? product?.quantity ?? 0) || 0;
};

/**
 * Returns products assigned to one merchant and overlays merchant-specific
 * allocation values without mutating the source product.
 */
export const getProductsForMerchant = <T extends Partial<Product> | any>(
  products: T[] | undefined,
  merchantId: string,
  merchantName?: string
): T[] => {
  const source = Array.isArray(products) ? products : [];
  const targetId = normalizeMerchantId(merchantId);
  const targetName = merchantName ? normalizeMerchantLabel(merchantName) : '';
  if (!targetId && !targetName) return [];

  return source
    .filter(product => productBelongsToMerchant(product, targetId, merchantName))
    .map(product => {
      const sourceProduct = product as any;
      const allocation = getMerchantAllocation(product, targetId, merchantName);
      const isShared = sourceProduct.ownerType === 'shared';
      const sharedCost = Number(allocation?.costPrice ?? sourceProduct.merchantCostPrice ?? 0) || 0;
      const sharedSafeFields = isShared ? {
        merchantId: targetId,
        merchantIds: [targetId],
        merchantName: allocation?.merchantName || targetId,
        merchantAllocations: allocation ? [allocation] : [],
        cost: sharedCost,
        wholesalePrice: undefined,
        supplierPrice: undefined,
        warehouseStock: undefined,
        variants: Array.isArray(sourceProduct.variants)
          ? sourceProduct.variants.map((variant: any) => ({ ...variant, stock: null, stockQuantity: null, warehouseStock: undefined }))
          : sourceProduct.variants
      } : {};
      if (!allocation) {
        const stock = isShared ? null : getNumericStock(product);
        return {
          ...sourceProduct,
          ...sharedSafeFields,
          stock,
          stockQuantity: stock,
          ...(isShared ? { quantity: null, inventory: null, inStock: true, unlimitedStock: true, isSharedProduct: true } : {}),
          costPrice: isShared ? sharedCost : Number(sourceProduct.costPrice ?? sourceProduct.cost ?? 0) || 0
        } as T;
      }

      const unlimitedStock = isShared && (allocation.stock == null || String(allocation.stock).trim() === '');
      const stock = unlimitedStock ? null : Number(allocation.stock) || 0;
      return {
        ...sourceProduct,
        ...sharedSafeFields,
        stock,
        stockQuantity: stock,
        quantity: stock,
        inventory: stock,
        inStock: unlimitedStock || stock > 0,
        unlimitedStock,
        isSharedProduct: isShared,
        costPrice: Number(allocation.costPrice ?? (isShared ? sourceProduct.merchantCostPrice : sourceProduct.costPrice) ?? 0) || 0,
        price: Number(allocation.sellingPrice ?? sourceProduct.price ?? 0) || 0,
        isAllocatedConsignment: true,
        merchantAllocation: allocation
      } as T;
    });
};
