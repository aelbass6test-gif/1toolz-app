const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";

async function run() {
  const subcolNames = ['cash_holders', 'cash_holders_data', 'cash_handovers', 'cashHandovers', 'cashHolders', 'handovers'];
  for (const name of subcolNames) {
    try {
      const colRef = collection(db, 'stores_data', storeId, name);
      const snap = await getDocs(colRef);
      console.log(`Subcollection [${name}] docs count:`, snap.size);
      snap.docs.forEach(d => {
        console.log(`  Doc [${d.id}]:`, d.data());
      });
    } catch (e) {
      console.log(`Error reading subcollection ${name}:`, e.message);
    }
  }
  process.exit(0);
}
run();
