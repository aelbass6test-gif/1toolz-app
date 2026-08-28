import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function dump() {
  const storeId = 'store-1771165841517-fkrbaec';
  const docRef = doc(db, 'stores_data', storeId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    console.log("Local supply_orders length for store 1:", data.settings?.supplyOrders?.length);
  }
  process.exit(0);
}
dump();
