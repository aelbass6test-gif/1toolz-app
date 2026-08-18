const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";

async function run() {
  const q = query(collection(db, 'cash_handovers'), where('store_id', '==', storeId));
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log("Total cash_handovers for this store:", docs.length);
  
  const found = docs.filter(d => 
    d.amount == 360 || 
    d.amount == -360 || 
    JSON.stringify(d).includes('جرد') || 
    JSON.stringify(d).includes('360')
  );
  
  console.log("Found cash_handovers matching 360 or 'جرد':", JSON.stringify(found, null, 2));

  // Let's also print all handovers related to "زهره" to see what handovers exist
  const zahra = docs.filter(d => 
    (d.toUserName && d.toUserName.includes('زهره')) ||
    (d.fromUserName && d.fromUserName.includes('زهره'))
  );
  console.log("All Zahra Handovers:");
  zahra.forEach(z => {
    console.log(`- From: ${z.fromUserName} | To: ${z.toUserName} | Amount: ${z.amount} | Date: ${z.date} | Notes: ${z.notes} | Status: ${z.status}`);
  });
  
  process.exit(0);
}
run();
