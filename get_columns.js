import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function dump() {
  const storeId = 'store-1771165841517-fkrbaec';
  const docRef = doc(db, 'stores_data', storeId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    if(data.settings?.supabaseUrl) {
       const supabase = createClient(data.settings.supabaseUrl, data.settings.supabaseAnonKey);
       const { data: cols, error } = await supabase.rpc('get_columns_for_table', { table_name: 'supply_orders' });
       // if we can't do that, just try to insert a dummy and see the error
       const { error: e2 } = await supabase.from('supply_orders').insert({ id: 'test', store_id: storeId, supplier_id: 'test', total_cost: 0, date: 'test', status: 'test', bogus_field: 123 });
       console.log("Error inserting bogus:", e2);
    }
  }
  process.exit(0);
}
dump();
