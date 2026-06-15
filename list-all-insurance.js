import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('captured.json', 'utf8'));
const orders = data.items || data;
orders.forEach((o, i) => {
  const d = o.details || {};
  console.log(`[${i}] Order: ${o.order_number || d.orderNumber}, Name: ${o.customer_name}, Status: ${o.status}, Company: ${d.shippingCompany}, productPrice: ${d.productPrice || o.productPrice}, shippingFee: ${d.shippingFee || o.shippingFee}, insuranceFee: ${d.insuranceFee || o.insuranceFee}`);
});
