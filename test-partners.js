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
    console.log("Store ID:", doc.id);
    console.log("Partners:", JSON.stringify(data.settings?.partners || [], null, 2));
  });
  process.exit(0);
}
run();
