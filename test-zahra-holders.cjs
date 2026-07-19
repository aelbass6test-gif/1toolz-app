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
  const holders = s.cashHolders || [];
  const zahra = holders.filter(h => h.userName && h.userName.includes('زهره'));
  console.log("Holders in settings:", JSON.stringify(zahra, null, 2));
  process.exit(0);
}
run();
