import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function findCollections() {
  try {
    const storesSnap = await getDocs(collection(db, 'stores_data'));
    console.log("Stores in stores_data:", storesSnap.docs.map(d => ({id: d.id, ...d.data() /**/ })));
    
    // Let's check root level subcollections by trying some common names, but also we can check 'orders' and nested
    const rootOrders = await getDocs(collection(db, 'orders'));
    console.log("Root orders collection size:", rootOrders.size);
    if (rootOrders.size > 0) {
      rootOrders.docs.slice(0, 5).forEach(d => console.log("Root order doc id:", d.id, d.data()));
    }
    
    for (const storeDoc of storesSnap.docs) {
      console.log(`Checking subcollections for store ${storeDoc.id}`);
      // Let's try 'orders', 'shipments', etc.
      const nestedOrders = await getDocs(collection(db, `stores_data/${storeDoc.id}/orders`));
      console.log(`  - orders subcollection size:`, nestedOrders.size);
      if (nestedOrders.size > 0) {
        nestedOrders.docs.slice(0, 2).forEach(o => console.log("    Nested order doc id:", o.id, o.data()));
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
findCollections();
