const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const storesSnap = await getDocs(collection(db, 'stores_data'));
  console.log("Total stores:", storesSnap.size);
  
  for (const doc of storesSnap.docs) {
    const storeId = doc.id;
    const storeName = doc.data().name;
    const settings = doc.data().settings || {};
    const partners = settings.partners || [];
    const handovers = settings.cashHandovers || [];
    const holders = settings.cashHolders || [];
    
    // Check nested collections
    const subcolls = ['orders', 'transactions', 'products', 'customers', 'wallet', 'cash_handovers'];
    const counts = {};
    for (const sc of subcolls) {
      try {
        const subSnap = await getDocs(collection(db, `stores_data/${storeId}/${sc}`));
        counts[sc] = subSnap.size;
      } catch (err) {
        counts[sc] = 'error';
      }
    }
    
    console.log(`\nStore ID: ${storeId}`);
    console.log(`Store Name: ${storeName}`);
    console.log(`Settings Handovers: ${handovers.length}, Settings Holders: ${holders.length}, Partners: ${partners.map(p => p.name).join(', ')}`);
    console.log(`Nested collections:`, counts);
  }
  process.exit(0);
}
run();
