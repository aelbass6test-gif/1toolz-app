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
      console.log(`Store keys:`, Object.keys(data));
      if (data.settings) {
        console.log(`settings keys:`, Object.keys(data.settings));
        console.log(`supplyOrders inside settings:`, Array.isArray(data.settings.supplyOrders) ? data.settings.supplyOrders.length : typeof data.settings.supplyOrders);
        if (Array.isArray(data.settings.supplyOrders)) {
          console.log(JSON.stringify(data.settings.supplyOrders, null, 2));
        }
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
