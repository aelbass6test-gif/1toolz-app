import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const storesSnap = await getDocs(collection(db, 'stores_data'));
    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const storeName = storeDoc.data().name;
      const settings = storeDoc.data().settings || {};

      const ordersSnap = await getDocs(collection(db, `stores_data/${storeId}/orders`));
      console.log(`Checking store ${storeId} - ${storeName} with ${ordersSnap.size} orders`);
      ordersSnap.docs.forEach(doc => {
        const order = doc.data();
        const str = JSON.stringify(order);
        if (str.includes("9.18") || str.includes("9.25") || str.includes("8.25") || order.orderNumber === "1" || order.orderNumber === 1 || order.order_number === "1") {
          console.log(`FOUND ORDER in Firestore! ID: ${doc.id}, orderNumber: ${order.orderNumber || order.order_number}, status: ${order.status}`);
          console.log(JSON.stringify(order, null, 2));
        }
      });

      // Also check root 'orders' collection
      const rootOrdersSnap = await getDocs(collection(db, 'orders'));
      rootOrdersSnap.docs.forEach(doc => {
        const order = doc.data();
        const str = JSON.stringify(order);
        if (str.includes("9.18") || str.includes("9.25") || str.includes("8.25") || order.orderNumber === "1" || order.orderNumber === 1 || order.order_number === "1") {
          console.log(`FOUND ROOT ORDER! ID: ${doc.id}, orderNumber: ${order.orderNumber || order.order_number}, status: ${order.status}`);
          console.log(JSON.stringify(order, null, 2));
        }
      });
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
