const admin = require('firebase-admin');
const fs = require('fs');

if (!fs.existsSync('./firebase-applet-config.json')) {
  console.log('No config file found');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(config.credential),
  databaseURL: `https://${config.projectId}.firebaseio.com`
});

const db = admin.firestore();

async function run() {
  const settingsRef = db.collection('settings');
  const snapshot = await settingsRef.get();
  
  snapshot.forEach(doc => {
      const data = doc.data();
      console.log('Document ID:', doc.id);
      if (data.wallet) {
          console.log('  Wallet Balance:', data.wallet.balance);
          const txs = data.wallet.transactions || [];
          console.log('  Total Transactions:', txs.length);
          const filterTxs = txs.filter(t => {
              const note = t.note || '';
              return note.includes('138') || note.includes('139') || (t.id && (t.id.includes('138') || t.id.includes('139')));
          });
          console.log('  Filtered Transactions (138/139):', JSON.stringify(filterTxs, null, 2));
      } else {
          console.log('  No wallet found in this document');
      }
  });
}

run().catch(console.error);
