import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function findUser() {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  let found = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.stores) {
      const hasStore = data.stores.some(s => s.id === 'store-1787194899166-hmcx2ts');
      if (hasStore) {
        found.push(data);
      }
    }
  });
  console.log("Found users:", JSON.stringify(found, null, 2));
  process.exit(0);
}
findUser();
