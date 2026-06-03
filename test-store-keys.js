import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const storesSnapshot = await getDocs(collection(db, 'stores_data'));
  storesSnapshot.forEach(doc => {
    const data = doc.data();
    for(const key of Object.keys(data)) {
      if(key === 'settings') {
         console.log(doc.id, "Settings keys:", Object.keys(data.settings));
         for (const skey of Object.keys(data.settings)) {
            if (skey.toLowerCase().includes('employ') || skey.toLowerCase().includes('user') || skey.toLowerCase().includes('staff') || skey.toLowerCase().includes('conf') || skey.toLowerCase().includes('call')) {
               console.log("-->", skey, data.settings[skey]);
            }
         }
      } else {
         console.log(doc.id, "Root key:", key);
      }
    }
  });
  process.exit(0);
}
run();
