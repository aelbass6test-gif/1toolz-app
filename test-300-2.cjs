const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";
async function run() {
  const store = await getDoc(doc(db, 'stores_data', storeId));
  const s = store.data().settings || {};
  console.log("handovers count:", (s.cashHandovers || []).length);
  const handovers = s.cashHandovers || [];
  const found = handovers.filter(h => h.amount === 300 || h.amount === 7225 || h.amount === 6925 || h.amount === 100);
  console.log("found:", found);
  
  process.exit(0);
}
run();
