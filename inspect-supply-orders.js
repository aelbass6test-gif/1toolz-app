import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

if (!fs.existsSync('./firebase-applet-config.json')) {
  console.log("No config file found!");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

initializeApp({
  credential: cert(config.credential)
});

const db = getFirestore();

async function run() {
  const settingsRef = db.collection('settings');
  const snapshot = await settingsRef.get();
  
  snapshot.forEach(doc => {
      const data = doc.data();
      console.log('Document ID:', doc.id);
      if (data.supplyOrders) {
          console.log(`Supply Orders count: ${data.supplyOrders.length}`);
          data.supplyOrders.forEach(so => {
              console.log(`- Order: ID=${so.id}, Ref=${so.referenceNumber || '(none)'}, TotalCost=${so.totalCost}, GrandTotal=${so.grandTotal}, Date=${so.date}, Status=${so.status}`);
              if (so.items) {
                  console.log(`  Items count: ${so.items.length}`);
                  so.items.forEach((item, idx) => {
                      console.log(`    Item ${idx+1}: name=${item.name}, quantity=${item.quantity}, cost=${item.cost}, isReturn=${item.isReturn}`);
                  });
              }
          });
      } else {
          console.log('No supplyOrders in this document.');
      }
  });
  process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
