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
  const settingsRef = collection(db, 'settings');
  const snap = await getDocs(settingsRef);
  console.log('Documents in settings collection:', snap.size);
  snap.forEach(doc => {
    const data = doc.data();
    console.log('Document ID:', doc.id);
    if (data.wallet) {
      console.log('  Balance:', data.wallet.balance);
      const txs = data.wallet.transactions || [];
      console.log('  Total Transactions:', txs.length);
      const filterTxs = txs.filter(t => {
        const note = t.note || '';
        return note.includes('138') || note.includes('139') || (t.id && (t.id.includes('138') || t.id.includes('139')));
      });
      console.log('  Transactions for 138/139:', JSON.stringify(filterTxs, null, 2));
    } else {
      console.log('  No wallet found');
    }
  });
}

run().then(() => process.exit(0)).catch(console.error);
