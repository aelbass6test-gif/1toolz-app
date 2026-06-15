import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('captured.json', 'utf8'));
const orders = data.items || data;

console.log(`Analyzing ${orders.length} orders for insurance fits...`);

orders.forEach(o => {
  const d = o.details || {};
  const productPrice = Number(o.productPrice || d.productPrice || 0);
  const shippingFee = Number(o.shippingFee || d.shippingFee || 0);
  const discount = Number(o.discount || d.discount || 0);

  // Let's test different calculations
  const totalAmount = productPrice + shippingFee - discount;
  const priceAmount = productPrice;
  const costAmount = Number(o.product_cost || d.productCost || 0);

  const testTotal1 = Math.round((totalAmount * 0.01) * 100) / 100;
  const testPrice1 = Math.round((priceAmount * 0.01) * 100) / 100;
  
  // What if insurance rate is different, e.g. 0.01?
  if (testTotal1 === 9.18 || testTotal1 === 8.25 || testTotal1 === 9.25 ||
      testPrice1 === 9.18 || testPrice1 === 8.25 || testPrice1 === 9.25 ||
      d.insuranceFee === 9.18 || d.insuranceFee === 8.25 || d.insuranceFee === 9.25) {
    console.log(`\nFound matching order: ${o.order_number || d.orderNumber}`);
    console.log(`  Customer: ${o.customer_name}`);
    console.log(`  Status: ${o.status}`);
    console.log(`  ProductPrice: ${productPrice}, ShippingFee: ${shippingFee}, Discount: ${discount}`);
    console.log(`  TotalAmount (Basis total): ${totalAmount} => 1% = ${testTotal1}`);
    console.log(`  ProductPrice (Basis price): ${priceAmount} => 1% = ${testPrice1}`);
    console.log(`  Current details.insuranceFee: ${d.insuranceFee}`);
  }
});
