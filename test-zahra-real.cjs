const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";
async function run() {
  const store = await getDoc(doc(db, 'stores_data', storeId));
  const s = store.data().settings || {};
  
  const q = query(collection(db, 'cash_holders'), where('store_id', '==', storeId));
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => d.data());
  const z = docs.find(d => d.userName && d.userName.includes('زهره'));
  console.log("From cash_holders subcol:", z);
  
  process.exit(0);
}
run();
