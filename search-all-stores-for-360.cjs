const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

async function run() {
  const storesSnap = await getDocs(collection(db, 'stores_data'));
  
  for (const doc of storesSnap.docs) {
    const storeId = doc.id;
    const storeName = doc.data().name;
    const settings = doc.data().settings || {};
    
    const handovers = settings.cashHandovers || [];
    const foundH = handovers.filter(h => 
      h.amount == 360 || 
      h.amount == -360 || 
      JSON.stringify(h).includes('جرد') || 
      JSON.stringify(h).includes('360')
    );
    
    if (foundH.length > 0) {
      console.log(`\nFound in Store ${storeId} (${storeName}) settings.cashHandovers:`, JSON.stringify(foundH, null, 2));
    }
    
    const holders = settings.cashHolders || [];
    const foundHol = holders.filter(h => 
      h.currentBalance == 360 || 
      JSON.stringify(h).includes('جرد') || 
      JSON.stringify(h).includes('360')
    );
    
    if (foundHol.length > 0) {
      console.log(`\nFound in Store ${storeId} (${storeName}) settings.cashHolders:`, JSON.stringify(foundHol, null, 2));
    }
  }
  
  console.log("Finished searching all stores.");
  process.exit(0);
}
run();
