import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function findStore() {
  const storeRef = doc(db, 'stores_data', 'store-1787194899166-hmcx2ts');
  const snapshot = await getDoc(storeRef);
  if (snapshot.exists()) {
    console.log("Store found in Firebase:", snapshot.data().name);
  } else {
    console.log("Store NOT found in Firebase.");
  }
  process.exit(0);
}
findStore();
