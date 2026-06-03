import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'employees'));
  for (const docObj of snap.docs) {
    if (docObj.id.includes('_')) {
        console.log("Keeping:", docObj.id);
    } else {
        console.log("Deleting bad format:", docObj.id);
        await deleteDoc(docObj.ref);
    }
  }
  process.exit(0);
}
run();
