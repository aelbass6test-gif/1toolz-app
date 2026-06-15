import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('captured.json', 'utf8'));
const orders = data.items || data;
console.log("Total captured orders:", orders.length);
orders.forEach(o => {
  if (o.order_number === "1" || o.order_number === 1 || o.orderNumber === "1" || o.orderNumber === 1 || o.order_number?.includes("1") || o.orderNumber?.includes("1")) {
    console.log("Found order:", o.order_number || o.orderNumber, o.status, o.customer_name);
  }
});
