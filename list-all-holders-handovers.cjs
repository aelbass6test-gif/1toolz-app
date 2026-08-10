const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const hSnap = await getDocs(collection(db, 'cash_holders'));
  console.log("cash_holders count:", hSnap.size);
  hSnap.docs.forEach(d => {
    console.log(`  Holder [${d.id}]:`, d.data());
  });

  const hanSnap = await getDocs(collection(db, 'cash_handovers'));
  console.log("cash_handovers count:", hanSnap.size);
  hanSnap.docs.forEach(d => {
    console.log(`  Handover [${d.id}]:`, d.data());
  });

  process.exit(0);
}
run();
