const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const q = collection(db, 'inventory_audits');
  const snap = await getDocs(q);
  console.log("Total inventory_audits in DB:", snap.size);
  
  snap.docs.forEach(doc => {
    const d = doc.id;
    const info = doc.data();
    console.log(`\nAudit ID: ${d}`);
    console.log(`Store ID: ${info.storeId || info.store_id}`);
    console.log(`Title: ${info.title || info.sessionName}`);
    console.log(`Status: ${info.status}`);
    console.log(`Manager: ${info.managerName}`);
    console.log(`Notes: ${info.notes}`);
    console.log(`Created At: ${info.createdAt || info.date}`);
    // Check if there's any mention of 360 or جرد
    if (JSON.stringify(info).includes('360')) {
      console.log("-> FOUND 360 in this audit!");
    }
  });
  
  process.exit(0);
}
run();
