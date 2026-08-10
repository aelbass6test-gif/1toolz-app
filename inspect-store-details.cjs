const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";

async function run() {
  const store = await getDoc(doc(db, 'stores_data', storeId));
  const s = store.data() || {};
  console.log("Store root keys:", Object.keys(s));
  if (s.settings) {
    console.log("Settings keys:", Object.keys(s.settings));
    console.log("cashHolders in settings:", s.settings.cashHolders);
    console.log("cashHandovers in settings:", s.settings.cashHandovers);
  }
  process.exit(0);
}
run();
