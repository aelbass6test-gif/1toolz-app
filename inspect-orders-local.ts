import { readFileSync } from 'fs';

try {
  const content = readFileSync('captured.json', 'utf8');
  const data = JSON.parse(content);
  const orders = Array.isArray(data) ? data : (data.items || []);
  console.log("Found orders count:", orders.length);
  orders.forEach((o: any, idx: number) => {
    console.log(`\nOrder #${idx + 1}:`);
    console.log(`  - ID: ${o.id || o.orderNumber || o.order_number}`);
    console.log(`  - status: ${o.status}`);
    console.log(`  - productPrice: ${o.productPrice}`);
    console.log(`  - shippingFee: ${o.shippingFee}`);
    console.log(`  - discount: ${o.discount}`);
    console.log(`  - totalAmountOverride: ${o.totalAmountOverride}`);
    console.log(`  - includeInspectionFee: ${o.includeInspectionFee}`);
    console.log(`  - inspectionFeePaidByCustomer: ${o.inspectionFeePaidByCustomer}`);
    console.log(`  - shippingCompany: ${o.shippingCompany}`);
    console.log(`  - advancePayment: ${o.advancePayment}`);
    if (o.items) {
      console.log(`  - items:`, o.items);
    }
  });
} catch (e) {
  console.error(e);
}
