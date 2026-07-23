const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

if (!fs.existsSync('./firebase-applet-config.json')) {
  console.log('No config file');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const colls = ['orders', 'stores_data'];
  for (const storeId of [
    'store-1771165841517-fkrbaec',
    'store-1778212844642-kmq6cpc',
    'store-1780610866950-2ce25yc',
    'store-1780626772920-c3ct4q3',
    'store-1782706198930-4yx0bf6'
  ]) {
    const nestedOrders = await getDocs(collection(db, `stores_data/${storeId}/orders`));
    if (nestedOrders.size > 0) {
      console.log(`Store ${storeId} has nested orders:`, nestedOrders.size);
      nestedOrders.forEach(doc => {
        const d = doc.data();
        const clientName = d.customerName || d.customer_name || (d.details && d.details.customerName) || '';
        if (clientName.includes('احمد الحنفي') || clientName.includes('الحنفي') || d.status === 'تم_الاستبدال' || d.orderNumber === 138 || d.orderNumber === 139 || String(d.orderNumber).includes('138') || String(d.orderNumber).includes('139')) {
          console.log(`Doc ID: ${doc.id}`);
          console.log(`  Order Number: ${d.orderNumber || d.order_number}`);
          console.log(`  Status: ${d.status}`);
          console.log(`  Customer: ${clientName}`);
          console.log(`  Product Price: ${d.productPrice}`);
          console.log(`  Product Cost: ${d.productCost}`);
          console.log(`  Total Price: ${d.totalPrice}`);
          console.log(`  Shipping Fee: ${d.shippingFee}`);
          console.log(`  Details keys:`, d.details ? Object.keys(d.details) : 'no details');
          if (d.details) {
            console.log(`  Details.shippingFee: ${d.details.shippingFee}`);
            console.log(`  Details.insuranceFee: ${d.details.insuranceFee}`);
            console.log(`  Details.inspectionFee: ${d.details.inspectionFee}`);
            console.log(`  Details.isInsured: ${d.details.isInsured}`);
            console.log(`  Details.items:`, JSON.stringify(d.details.items));
          }
        }
      });
    }
  }
}

run().then(() => process.exit(0)).catch(console.error);
