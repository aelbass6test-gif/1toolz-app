
const admin = require('firebase-admin');
const fs = require('fs');

if (!fs.existsSync('./firebase-applet-config.json')) {
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(config.credential),
  databaseURL: `https://${config.projectId}.firebaseio.com`
});

const db = admin.firestore();

async function getWallet() {
  const settingsRef = db.collection('settings');
  const snapshot = await settingsRef.get();
  
  snapshot.forEach(doc => {
      const data = doc.data();
      if (data.wallet && data.wallet.transactions) {
          console.log('Wallet Transactions:', JSON.stringify(data.wallet.transactions.slice(0, 5), null, 2));
      }
  });
}

getWallet().catch(console.error);
