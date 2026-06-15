import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const colls = ['orders', 'stores_data', 'settings', 'maintenance_requests'];
    for (const c of colls) {
      const snap = await getDocs(collection(db, c));
      console.log(`Collection: ${c}, count: ${snap.size}`);
      if (snap.size > 0 && c === 'stores_data') {
        for (const doc of snap.docs) {
          console.log("stores_data doc ID:", doc.id, "name:", doc.data().name);
          const ordersSnap = await getDocs(collection(db, `stores_data/${doc.id}/orders`));
          console.log(`-- nested orders count: ${ordersSnap.size}`);
        }
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
