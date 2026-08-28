import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function link() {
  try {
    const userRef = doc(db, 'users', '01050511791');
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      let stores = userSnap.data().stores || [];
      const hasStore = stores.some(s => s.id === 'store-1787194899166-hmcx2ts');
      if (!hasStore) {
        stores.push({
          id: 'store-1787194899166-hmcx2ts',
          name: 'دكتور الصلعه',
          currency: 'EGP',
          language: 'عربي',
          specialization: 'أخرى',
          creationDate: new Date().toISOString()
        });
        await updateDoc(userRef, { stores });
        console.log("Store linked successfully to 01050511791.");
      } else {
        console.log("Store is already linked.");
      }
    }
    
    // Also create the store in stores_data so it doesn't break Firestore listeners
    const storeRef = doc(db, 'stores_data', 'store-1787194899166-hmcx2ts');
    const storeSnap = await getDoc(storeRef);
    if (!storeSnap.exists()) {
      import('firebase/firestore').then(({ setDoc }) => {
        setDoc(storeRef, {
          id: 'store-1787194899166-hmcx2ts',
          name: 'دكتور الصلعه',
          settings: {}
        }).then(() => {
          console.log("Store document created in stores_data.");
          process.exit(0);
        });
      });
    } else {
      process.exit(0);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
link();
