import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('captured.json', 'utf8'));
const orders = data.items || data;
orders.forEach(o => {
  const d = o.details || {};
  if (o.total_price === 825 || o.total_price === 918 || o.total_price === 925 ||
      o.productPrice === 825 || o.productPrice === 918 || o.productPrice === 925 ||
      d.productPrice === 825 || d.productPrice === 918 || d.productPrice === 925 ||
      d.insuranceFee === 8.25 || d.insuranceFee === 9.18 || d.insuranceFee === 9.25) {
    console.log("MATCH:", o.order_number, "TotalPrice:", o.total_price, "ProdPrice:", d.productPrice, "ShipFee:", d.shippingFee, "InsFee:", d.insuranceFee);
  }
});
