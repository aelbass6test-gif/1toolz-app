const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'partners'));
  console.log("partners collection count:", snap.size);
  snap.docs.forEach(d => {
    console.log(`  Partner Doc [${d.id}]:`, d.data());
  });
  process.exit(0);
}
run();
