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
  console.log("partnerTransactions:", (s.partnerTransactions || []).filter(t => t.amount === 6000));
  console.log("wallet.transactions:", (store.data().wallet?.transactions || []).filter(t => t.amount === 6000));
  
  process.exit(0);
}
run();
