import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const store = await getDoc(doc(db, 'stores_data', 'store-1771165841517-fkrbaec'));
  const data = store.data();
  console.log(Object.keys(data));
  process.exit(0);
}
run();
