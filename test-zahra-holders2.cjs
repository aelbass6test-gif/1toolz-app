const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";
async function run() {
  const q = query(collection(db, 'cash_holders'), where('storeId', '==', storeId));
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => d.data());
  console.log("Docs:", docs.length);
  const zahra = docs.filter(d => d.userName && d.userName.includes('زهره'));
  console.log("Holders in col:", JSON.stringify(zahra, null, 2));
  process.exit(0);
}
run();
