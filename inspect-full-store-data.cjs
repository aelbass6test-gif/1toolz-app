const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');

if (!fs.existsSync('./firebase-applet-config.json')) {
  console.log('No config file');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const storeId = 'store-1771165841517-fkrbaec';
  const docRef = doc(db, 'stores_data', storeId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    console.log('Store document does not exist in Firestore');
    return;
  }
  const data = snap.data();
  console.log('Keys of stores_data doc:', Object.keys(data));
  
  // Since we also have subcollections, let's see if the settings or nested subcolls exist,
  // or if the data itself contains the lists. Wait, we saw nested lists are synced.
  // Let's print some general info first.
}

run().then(() => process.exit(0)).catch(console.error);
