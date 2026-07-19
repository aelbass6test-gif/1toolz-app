const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'cash_handovers'));
  console.log("Total cash_handovers in DB:", snap.docs.length);
  snap.docs.forEach(doc => {
      const d = doc.data();
      if (d.amount === 6000 || d.amount === 825 || d.amount === 100) {
          console.log("Found:", d.amount, d.notes, d.store_id);
      }
  });
  process.exit(0);
}
run();
