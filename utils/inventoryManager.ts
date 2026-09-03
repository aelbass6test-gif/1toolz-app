import { Order, Product, Settings } from '../types';

/**
 * Deducts item quantities of an order from warehouse and product stock.
 */
export function deductOrderStock(
  order: Partial<Order>,
  products: Product[],
  defaultWarehouseId?: string
): Product[] {
  if (!Array.isArray(products) || products.length === 0) return products || [];

  const targetWhId = order.warehouseId || defaultWarehouseId || 'wh_main';
  const items = order.items || [];
  if (!Array.isArray(items) || items.length === 0) return products;

  return products.map(p => {
    const orderedItems = items.filter(item => item.productId === p.id);
    if (orderedItems.length === 0) return p;

    const newProd = { ...p };

    if (p.hasVariants && Array.isArray(p.variants)) {
      newProd.variants = p.variants.map(v => {
        const matchItem = orderedItems.find(item => item.variantId === v.id || item.productId === v.id);
        if (!matchItem) return v;

        const qty = Number(matchItem.quantity) || 1;
        const currentStockMap = { ...(v.warehouseStock || {}) };
        const currentWhStock = currentStockMap[targetWhId] !== undefined 
          ? Number(currentStockMap[targetWhId]) 
          : Number(v.stockQuantity ?? v.stock ?? 0);

        currentStockMap[targetWhId] = Math.max(0, currentWhStock - qty);
        const newDist = Object.values(currentStockMap).reduce((s, val) => s + Math.max(0, Number(val) || 0), 0);

        return {
          ...v,
          warehouseStock: currentStockMap,
          stockQuantity: newDist,
          stock: newDist,
          inStock: newDist > 0
        };
      });

      const totalFromVars = newProd.variants.reduce((t, v) => t + (v.stockQuantity || 0), 0);
      newProd.stockQuantity = totalFromVars;
      newProd.stock = totalFromVars;
      newProd.inStock = totalFromVars > 0;
    } else {
      const matchItem = orderedItems.find(item => !item.variantId || item.productId === p.id);
      if (matchItem) {
        const qty = Number(matchItem.quantity) || 1;
        const currentStockMap = { ...(p.warehouseStock || {}) };
        const currentWhStock = currentStockMap[targetWhId] !== undefined 
          ? Number(currentStockMap[targetWhId]) 
          : Number(p.stockQuantity ?? p.stock ?? 0);

        currentStockMap[targetWhId] = Math.max(0, currentWhStock - qty);
        const newDist = Object.values(currentStockMap).reduce((s, val) => s + Math.max(0, Number(val) || 0), 0);

        newProd.warehouseStock = currentStockMap;
        newProd.stockQuantity = newDist;
        newProd.stock = newDist;
        newProd.inStock = newDist > 0;
      }
    }

    return newProd;
  });
}

/**
 * Restores item quantities of a cancelled or returned order back to warehouse and product stock.
 */
export function restoreOrderStock(
  order: Partial<Order>,
  products: Product[],
  defaultWarehouseId?: string
): Product[] {
  if (!Array.isArray(products) || products.length === 0) return products || [];

  const targetWhId = order.warehouseId || defaultWarehouseId || 'wh_main';
  const items = order.items || [];
  if (!Array.isArray(items) || items.length === 0) return products;

  return products.map(p => {
    const orderedItems = items.filter(item => item.productId === p.id);
    if (orderedItems.length === 0) return p;

    const newProd = { ...p };

    if (p.hasVariants && Array.isArray(p.variants)) {
      newProd.variants = p.variants.map(v => {
        const matchItem = orderedItems.find(item => item.variantId === v.id || item.productId === v.id);
        if (!matchItem) return v;

        const qty = Number(matchItem.quantity) || 1;
        const currentStockMap = { ...(v.warehouseStock || {}) };
        const currentWhStock = currentStockMap[targetWhId] !== undefined 
          ? Number(currentStockMap[targetWhId]) 
          : Number(v.stockQuantity ?? v.stock ?? 0);

        currentStockMap[targetWhId] = currentWhStock + qty;
        const newDist = Object.values(currentStockMap).reduce((s, val) => s + Math.max(0, Number(val) || 0), 0);

        return {
          ...v,
          warehouseStock: currentStockMap,
          stockQuantity: newDist,
          stock: newDist,
          inStock: newDist > 0
        };
      });

      const totalFromVars = newProd.variants.reduce((t, v) => t + (v.stockQuantity || 0), 0);
      newProd.stockQuantity = totalFromVars;
      newProd.stock = totalFromVars;
      newProd.inStock = totalFromVars > 0;
    } else {
      const matchItem = orderedItems.find(item => !item.variantId || item.productId === p.id);
      if (matchItem) {
        const qty = Number(matchItem.quantity) || 1;
        const currentStockMap = { ...(p.warehouseStock || {}) };
        const currentWhStock = currentStockMap[targetWhId] !== undefined 
          ? Number(currentStockMap[targetWhId]) 
          : Number(p.stockQuantity ?? p.stock ?? 0);

        currentStockMap[targetWhId] = currentWhStock + qty;
        const newDist = Object.values(currentStockMap).reduce((s, val) => s + Math.max(0, Number(val) || 0), 0);

        newProd.warehouseStock = currentStockMap;
        newProd.stockQuantity = newDist;
        newProd.stock = newDist;
        newProd.inStock = newDist > 0;
      }
    }

    return newProd;
  });
}
