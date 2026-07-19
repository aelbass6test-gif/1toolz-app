import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const storeId = "store-1778212844642-kmq6cpc";

async function run() {
  try {
    const docSnap = await getDoc(doc(db, 'stores_data', storeId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.settings) {
        console.log("CASH HOLDERS:");
        console.log(JSON.stringify(data.settings.cashHolders || [], null, 2));
        console.log("PARTNERS:");
        console.log(JSON.stringify(data.settings.partners || [], null, 2));
        console.log("PARTNER TRANSACTIONS:");
        console.log(JSON.stringify(data.settings.partnerTransactions || [], null, 2));
        console.log("TREASURY:");
        console.log(JSON.stringify(data.settings.treasury || data.treasury || {}, null, 2));
      } else {
        console.log("No settings key in store data!");
      }
    } else {
      console.log("Store document does not exist!");
    }
  } catch (err) {
    console.error("Error reading store doc:", err);
  }
  process.exit(0);
}

run();
