import type { MerchantStockAllocation, Product } from '../types';

/**
 * Canonical product-to-merchant relationship.
 * IDs are authoritative; names and phone numbers are intentionally not used here.
 */
export const normalizeMerchantId = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

const normalizeMerchantLabel = (value: unknown): string => {
  let label = String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  label = label.replace(/\s*\((موكل|مورد|صاحب بضاعة|تاجر|partner|employee|admin|الموكل الرئيسي|مشترك|وكيل معتمد|وكيل أمانة)\)\s*/gi, '');
  return label.replace(/عبد\s+/g, 'عبد').replace(/ابو\s+/g, 'ابو').trim();
};

export const getMerchantAllocation = (
  product: Partial<Product> | any,
  merchantId: string
): MerchantStockAllocation | undefined => {
  const targetId = normalizeMerchantId(merchantId);
  if (!targetId || !Array.isArray(product?.merchantAllocations)) return undefined;

  return product.merchantAllocations.find(
    (allocation: MerchantStockAllocation) => normalizeMerchantId(allocation?.merchantId) === targetId
  );
};

export const productBelongsToMerchant = (
  product: Partial<Product> | any,
  merchantId: string
): boolean => {
  const targetId = normalizeMerchantId(merchantId);
  if (!targetId || !product) return false;

  if (normalizeMerchantId(product.merchantId) === targetId) return true;

  // Legacy product records used supplierId before merchantId was standardized.
  if (normalizeMerchantId(product.supplierId) === targetId) return true;

  if (Array.isArray(product.merchantIds) && product.merchantIds.some((id: unknown) => normalizeMerchantId(id) === targetId)) {
    return true;
  }

  return Boolean(getMerchantAllocation(product, targetId));
};

/** True for orders created for a merchant/consignment account, not store-owned sales. */
export const isMerchantOrder = (order: any): boolean => {
  if (!order || typeof order !== 'object') return false;
  const orderMerchantId = normalizeMerchantId(order.merchantId);
  if (orderMerchantId && orderMerchantId !== 'pending') return true;
  return Array.isArray(order.items) && order.items.some((item: any) =>
    Boolean(normalizeMerchantId(item?.merchantId)) && normalizeMerchantId(item?.merchantId) !== 'pending'
  );
};

export const getStoreOwnedOrders = <T extends any>(orders: T[] | undefined): T[] =>
  (Array.isArray(orders) ? orders : []).filter(order => !isMerchantOrder(order));

/**
 * Safe migration: only preserves explicit IDs and derives ownerType from explicit
 * IDs/allocations. Name-only records are never assigned to an entity.
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

    const primaryName = normalizeMerchantLabel(product.merchantName || product.supplierName);
    if (!normalizeMerchantId(product.merchantId) && !normalizeMerchantId(product.supplierId) && primaryName) ambiguousCount += 1;

    const nextAllocations = Array.isArray(product.merchantAllocations)
      ? product.merchantAllocations.map((allocation: any) => {
          if (normalizeMerchantId(allocation?.merchantId)) {
            addMerchantId(String(allocation.merchantId));
            return allocation;
          }
          if (normalizeMerchantLabel(allocation?.merchantName)) ambiguousCount += 1;
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
      (idsByName.get(primaryName) || []).length > 1;
    const allocationNeedsReview = Array.isArray(product.merchantAllocations) && product.merchantAllocations.some((allocation: any) =>
      !normalizeMerchantId(allocation?.merchantId) &&
      (idsByName.get(normalizeMerchantLabel(allocation?.merchantName)) || []).length > 1
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
  merchantId: string
): T[] => {
  const source = Array.isArray(products) ? products : [];
  const targetId = normalizeMerchantId(merchantId);
  if (!targetId) return [];

  return source
    .filter(product => productBelongsToMerchant(product, targetId))
    .map(product => {
      const sourceProduct = product as any;
      const allocation = getMerchantAllocation(product, targetId);
      if (!allocation) {
        const isShared = sourceProduct.ownerType === 'shared' || (Array.isArray(sourceProduct.merchantIds) && sourceProduct.merchantIds.length > 1);
        const stock = isShared ? 0 : getNumericStock(product);
        return {
          ...sourceProduct,
          stock,
          stockQuantity: stock,
          costPrice: Number(sourceProduct.costPrice ?? sourceProduct.cost ?? 0) || 0
        } as T;
      }

      const stock = Number(allocation.stock ?? 0) || 0;
      return {
        ...sourceProduct,
        stock,
        stockQuantity: stock,
        quantity: stock,
        costPrice: Number(allocation.costPrice ?? sourceProduct.costPrice ?? 0) || 0,
        price: Number(allocation.sellingPrice ?? sourceProduct.price ?? 0) || 0,
        isAllocatedConsignment: true,
        merchantAllocation: allocation
      } as T;
    });
};
