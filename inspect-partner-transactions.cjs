const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const q = collection(db, 'partner_transactions');
  const snap = await getDocs(q);
  console.log("Total partner_transactions in DB:", snap.size);
  
  snap.docs.forEach(doc => {
    const d = doc.id;
    const info = doc.data();
    console.log(`\nTransaction ID: ${d}`);
    console.log(`Partner ID: ${info.partnerId}`);
    console.log(`Partner Name: ${info.partnerName}`);
    console.log(`Type: ${info.type}`);
    console.log(`Amount: ${info.amount}`);
    console.log(`Notes: ${info.notes}`);
    console.log(`Date: ${info.date}`);
    if (JSON.stringify(info).includes('360')) {
      console.log("-> FOUND 360 in this transaction!");
    }
  });
  
  process.exit(0);
}
run();
