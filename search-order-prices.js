import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('captured.json', 'utf8'));
const orders = data.items || data;
orders.forEach(o => {
  const detailsStr = JSON.stringify(o);
  if (detailsStr.includes("8.25") || detailsStr.includes("9.18") || detailsStr.includes("9.25") || detailsStr.includes("918") || detailsStr.includes("925")) {
    console.log("Found matching order:", o.order_number || o.orderNumber, "status:", o.status, "customer:", o.customer_name);
    console.log("details keys/values:");
    if (o.details) {
      console.log("  productPrice:", o.details.productPrice, "shippingFee:", o.details.shippingFee, "insuranceFee:", o.details.insuranceFee);
    }
  }
});
