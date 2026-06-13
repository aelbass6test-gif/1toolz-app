import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const storesSnap = await getDocs(collection(db, 'stores_data'));
    for (const d of storesSnap.docs) {
       const settings = d.data()?.settings;
       if (settings && settings.companySpecificFees) {
         console.log("Store:", d.id, d.data()?.name);
         console.log(JSON.stringify(settings.companySpecificFees, null, 2));
       }
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
