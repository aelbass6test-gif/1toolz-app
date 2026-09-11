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
    console.log("Store:", JSON.stringify(snap.data(), null, 2));
  }
  
  // also check supply_orders again just in case there's a storeId field
  const q = collection(db, 'supply_orders');
  const sq = await getDocs(q);
  console.log("Total supply_orders docs:", sq.size);
  process.exit(0);
}
dump();
