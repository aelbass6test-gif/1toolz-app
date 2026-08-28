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
    console.log("Supabase URL:", data.settings?.supabaseUrl);
    console.log("Local supply_orders embedded length:", data.settings?.supplyOrders?.length);
  }
  
  // also check other store
  const storeId2 = 'store-1787194899166-hmcx2ts';
  const docRef2 = doc(db, 'stores_data', storeId2);
  const snap2 = await getDoc(docRef2);
  if (snap2.exists()) {
    const data = snap2.data();
    console.log("Supabase URL 2:", data.settings?.supabaseUrl);
    console.log("Local supply_orders 2 embedded length:", data.settings?.supplyOrders?.length);
  }
  
  process.exit(0);
}
dump();
