import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const snap = await getDocs(collection(db, 'stores_data'));
    console.log(`Found ${snap.size} stores in stores_data:`);
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`Store Document ID: ${doc.id}`);
      const settings = data.settings || {};
      const supplyOrders = settings.supplyOrders || [];
      console.log(`  Supply Orders count: ${supplyOrders.length}`);
      supplyOrders.forEach(so => {
        console.log(`  - Order: ID=${so.id}, Ref=${so.referenceNumber || '(none)'}, TotalCost=${so.totalCost}, GrandTotal=${so.grandTotal}, Date=${so.date}, Status=${so.status}`);
        if (so.items) {
          console.log(`    Items count: ${so.items.length}`);
          so.items.forEach((item, idx) => {
            console.log(`      Item ${idx+1}: name=${item.name}, quantity=${item.quantity}, cost=${item.cost}, isReturn=${item.isReturn}`);
          });
        }
      });
    });
  } catch (err) {
    console.error("Error reading stores_data:", err);
  }
  process.exit(0);
}

run();
