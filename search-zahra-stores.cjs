const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'stores_data'));
  for (const d of snap.docs) {
    const store = d.data();
    const settings = store.settings || {};
    const partners = settings.partners || [];
    const foundPartner = partners.find(p => p.name && (p.name.includes('زهره') || p.name.includes('زهرة')));
    if (foundPartner) {
      console.log(`Found Zahra in Store Doc [${d.id}]:`, store.name);
      console.log("  Partner object:", foundPartner);
      console.log("  All Partners in this store:", partners);
    }
  }
  process.exit(0);
}
run();
