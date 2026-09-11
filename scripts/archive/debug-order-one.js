
const admin = require('firebase-admin');
const fs = require('fs');

if (!fs.existsSync('./firebase-applet-config.json')) {
  console.log('No firebase-applet-config.json found');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(config.credential),
  databaseURL: `https://${config.projectId}.firebaseio.com`
});

const db = admin.firestore();

async function getOrderOne() {
  const ordersRef = db.collection('orders');
  const snapshot = await ordersRef.where('orderNumber', 'in', ['1', 1]).get();
  
  if (snapshot.empty) {
    console.log('No order #1 found');
    return;
  }

  snapshot.forEach(doc => {
    console.log('Order #1 Data:', JSON.stringify(doc.data(), null, 2));
  });
}

getOrderOne().catch(console.error);
