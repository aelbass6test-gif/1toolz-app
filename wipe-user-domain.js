import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const storeId = 'store-1778212844642-kmq6cpc';
  const domainToWipe = '3bdomedia.com';
  console.log(`Searching for users containing store: ${storeId} or domain: ${domainToWipe}...`);
  
  const querySnapshot = await getDocs(collection(db, 'users'));
  let foundCount = 0;
  let totalCount = 0;
  
  for (const userDoc of querySnapshot.docs) {
    totalCount++;
    const data = userDoc.data();
    const stores = data.stores || [];
    let modified = false;
    
    const updatedStores = stores.map(s => {
      const sDom = (s.customDomain || '').toLowerCase().trim();
      if (s.id === storeId || sDom === domainToWipe || sDom === 'www.' + domainToWipe) {
        console.log(`Found match in user ${userDoc.id} (${data.fullName || 'No Name'}). Domain was: ${s.customDomain}`);
        modified = true;
        return { ...s, customDomain: null };
      }
      return s;
    });

    if (modified) {
      console.log(`Updating user doc ${userDoc.id}...`);
      await updateDoc(doc(db, 'users', userDoc.id), { stores: updatedStores });
      console.log(`✅ User ${userDoc.id} updated.`);
      foundCount++;
    }
    
    if (totalCount % 50 === 0) {
        console.log(`Processed ${totalCount} users...`);
    }
  }

  console.log(`\nFinished. Found and updated ${foundCount} users out of ${totalCount}.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
