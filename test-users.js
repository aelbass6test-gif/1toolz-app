import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  usersSnapshot.forEach(doc => {
    console.log(doc.id, doc.data().fullName, doc.data().stores);
  });
  process.exit(0);
}
run();
