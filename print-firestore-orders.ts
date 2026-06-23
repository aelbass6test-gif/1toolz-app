import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const ordersSnap = await getDocs(collection(db, 'orders'));
    console.log(`Found ${ordersSnap.size} total orders in root collection.`);
    ordersSnap.docs.forEach((d) => {
      const o = d.data();
      const num = o.orderNumber || o.order_number;
      // We are looking for something with a collection/waybill price of 1593 or 1600 or with items price 1500 or similar
      console.log(`Order #${num}:`);
      console.log(`  - status: ${o.status}`);
      console.log(`  - shippingCompany: ${o.shippingCompany}`);
      console.log(`  - productPrice: ${o.productPrice}`);
      console.log(`  - shippingFee: ${o.shippingFee}`);
      console.log(`  - discount: ${o.discount}`);
      console.log(`  - totalAmountOverride: ${o.totalAmountOverride}`);
      console.log(`  - includeInspectionFee: ${o.includeInspectionFee}`);
      console.log(`  - inspectionFeePaidByCustomer: ${o.inspectionFeePaidByCustomer}`);
      console.log(`  - advancePayment: ${o.advancePayment}`);
      if (o.items) {
        console.log(`  - items:`, JSON.stringify(o.items));
      }
    });
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
