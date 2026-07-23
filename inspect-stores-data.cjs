const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

if (!fs.existsSync('./firebase-applet-config.json')) {
  console.log('No firebase-applet-config.json found');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const collRef = collection(db, 'stores_data');
  const snap = await getDocs(collRef);
  console.log('Stores data docs count:', snap.size);
  snap.forEach(doc => {
    const data = doc.data();
    console.log('Doc ID:', doc.id);
    console.log('  Name:', data.name);
    console.log('  Keys:', Object.keys(data));
    if (data.wallet) {
      console.log('  Wallet structure:', Object.keys(data.wallet));
      console.log('  Wallet balance:', data.wallet.balance);
      const txs = data.wallet.transactions || [];
      console.log('  Total txs:', txs.length);
      const filterTxs = txs.filter(t => {
        const note = t.note || '';
        return note.includes('138') || note.includes('139') || (t.id && (t.id.includes('138') || t.id.includes('139')));
      });
      console.log('  Filtered txs:', JSON.stringify(filterTxs, null, 2));
    }
  });
}

run().then(() => process.exit(0)).catch(console.error);
