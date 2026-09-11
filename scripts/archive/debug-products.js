import * as fs from 'fs';

try {
  const fileContent = fs.readFileSync('captured-products.json', 'utf8');
  const data = JSON.parse(fileContent);
  const products = data.items || [];
  
  let grandTotal = 0;
  
  console.log(`| SKU | Name | Stock | Cost | Subtotal |`);
  console.log(`|---|---|---|---|---|`);
  
  products.forEach(p => {
    let cost = p.costPrice || 0;
    
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      p.variants.forEach(v => {
        const qty = v.stockQuantity ?? v.stock ?? 0;
        const vCost = v.costPrice ?? p.costPrice ?? 0;
        const sub = qty * vCost;
        if (qty > 0) {
          console.log(`| ${v.sku} | (V) ${p.name} | ${qty} | ${vCost} | ${sub} |`);
          grandTotal += sub;
        }
      });
    } else {
      const qty = p.stockQuantity ?? p.stock ?? 0;
      const sub = qty * cost;
      if (qty > 0) {
        console.log(`| ${p.sku} | ${p.name} | ${qty} | ${cost} | ${sub} |`);
        grandTotal += sub;
      }
    }
  });
  
  console.log(`\nGrand Total: ${grandTotal}`);
} catch (e) {
  console.error(e);
}
