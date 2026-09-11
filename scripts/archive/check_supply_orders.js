import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  // Check supply_orders collection in Firestore
  const soRef = collection(db, 'supply_orders');
  const soSnap = await getDocs(soRef);
  console.log(`Found ${soSnap.size} documents in 'supply_orders' collection in Firestore.`);
  if (soSnap.size > 0) {
    soSnap.docs.forEach(doc => {
      console.log(` - ID: ${doc.id}, storeId: ${doc.data().storeId || doc.data().store_id}`);
    });
  }

  // Check if they are inside stores_data settings
  const storesRef = collection(db, 'stores_data');
  const storesSnap = await getDocs(storesRef);
  console.log(`\nChecking inside stores_data documents for embedded supplyOrders...`);
  
  storesSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.settings && data.settings.supplyOrders && data.settings.supplyOrders.length > 0) {
      console.log(` - Store ${doc.id} (${data.name}) has ${data.settings.supplyOrders.length} supply orders embedded.`);
    }
    // Also check for Supabase credentials while we're at it
    if (data.settings && data.settings.supabaseUrl) {
      console.log(`   * Store ${doc.id} has Supabase configured: ${data.settings.supabaseUrl}`);
    }
  });

  process.exit(0);
}
check();
