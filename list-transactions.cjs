const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'transactions'));
  console.log("transactions collection count:", snap.size);
  snap.docs.forEach(d => {
    console.log(`  Tx Doc [${d.id}]:`, d.data());
  });
  process.exit(0);
}
run();
