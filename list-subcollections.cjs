const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

if (!fs.existsSync('./firebase-applet-config.json')) {
  console.log('No config file');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const storeId = 'store-1771165841517-fkrbaec';
  const subcolls = ['orders', 'transactions', 'products', 'customers', 'wallet'];
  
  for (const s of subcolls) {
    try {
      const snap = await getDocs(collection(db, `stores_data/${storeId}/${s}`));
      console.log(`Sub-collection stores_data/${storeId}/${s}: count = ${snap.size}`);
      if (snap.size > 0) {
        console.log(`  Sample doc ID: ${snap.docs[0].id}`);
        console.log(`  Keys:`, Object.keys(snap.docs[0].data()));
      }
    } catch (err) {
      console.error(`Error querying stores_data/${storeId}/${s}:`, err.message);
    }
  }
}

run().then(() => process.exit(0)).catch(console.error);
