const { initializeApp } = require('firebase/app');
const { initializeFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

if (!fs.existsSync('./firebase-applet-config.json')) {
  console.log('No config file');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

async function run() {
  const rootOrders = await getDocs(collection(db, 'orders'));
  console.log(`Found root orders:`, rootOrders.size);
  rootOrders.forEach(doc => {
    const d = doc.data();
    const clientName = d.customerName || d.customer_name || (d.details && d.details.customerName) || '';
    if (clientName.includes('حسام حواش') || String(d.orderNumber).includes('145')) {
      console.log(`Doc ID: ${doc.id}`);
      console.log(`  Order Number: ${d.orderNumber || d.order_number}`);
      console.log(`  Status: ${d.status}`);
      console.log(`  Customer: ${clientName}`);
      console.log(`  Shipping Fee: ${d.shippingFee}`);
      console.log(`  All Keys:`, Object.keys(d));
      console.log(`  Whole doc:`, JSON.stringify(d, null, 2));
    }
  });
}

run().then(() => process.exit(0)).catch(console.error);

