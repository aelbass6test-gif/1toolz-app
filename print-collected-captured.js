import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('captured.json', 'utf8'));
const orders = data.items || data;
console.log("COLLECTED ORDERS IN CAPTURED.JSON:");
orders.forEach(o => {
  const d = o.details || {};
  // Check statuses that correspond to collected or paid
  if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة' || o.status === 'تم_توصيلها' || o.status === 'مرتجع') {
    console.log(`Order: ${o.order_number || d.orderNumber}, Name: ${o.customer_name}, Status: ${o.status || o.status}, Company: ${d.shippingCompany}, productPrice: ${d.productPrice}, shippingFee: ${d.shippingFee}, isInsured: ${d.isInsured}, insuranceFee: ${d.insuranceFee}`);
  }
});
