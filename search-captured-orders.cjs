const fs = require('fs');
const data = JSON.parse(fs.readFileSync('captured.json', 'utf8'));
const orders = data.items || [];

console.log("Total orders in captured.json:", orders.length);

const matched360 = orders.filter(o => 
  JSON.stringify(o).includes('360') || 
  JSON.stringify(o).includes('جرد') || 
  JSON.stringify(o).includes('زهره') ||
  JSON.stringify(o).includes('زهرة')
);

console.log("Matched orders count:", matched360.length);
matched360.forEach(o => {
  console.log(`- Order: ${o.order_number} | Customer: ${o.customer_name} | Total: ${o.total_price} | Date: ${o.date}`);
  if (o.details) {
    console.log(`  Advance Payment: ${o.details.advancePayment} | PartnerId: ${o.details.advancePaymentPartnerId}`);
  }
});

process.exit(0);
