const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1778212844642-kmq6cpc";
async function run() {
  const store = await getDoc(doc(db, 'stores_data', storeId));
  const s = store.data().settings || {};
  console.log("handovers count:", (s.cashHandovers || []).length);
  const handovers = s.cashHandovers || [];
  const found = handovers.filter(h => h.amount === 300);
  console.log("300 tx:", found);
  
  const partnerTx = s.partnerTransactions || [];
  console.log("Partner tx with 300:", partnerTx.filter(t => t.amount === 300));
  
  process.exit(0);
}
run();
