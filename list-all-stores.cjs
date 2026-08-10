const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'stores_data'));
  console.log("stores_data count:", snap.size);
  snap.docs.forEach(d => {
    console.log(`  Store Doc [${d.id}]:`, d.data().name);
  });
  process.exit(0);
}
run();
