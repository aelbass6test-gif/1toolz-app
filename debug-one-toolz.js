import { oneToolzProducts } from './data/one-toolz-products';

let grandTotal = 0;
let totalStock = 0;

oneToolzProducts.forEach(p => {
  const stock = p.stockQuantity ?? p.stock ?? 0;
  const cost = p.costPrice ?? 0;
  const sub = stock * cost;
  totalStock += stock;
  grandTotal += sub;
});

console.log(`Static file one-toolz-products.ts:`);
console.log(`  Total Products Count: ${oneToolzProducts.length}`);
console.log(`  Total Stock: ${totalStock}`);
console.log(`  Total Cost Value: ${grandTotal}`);
