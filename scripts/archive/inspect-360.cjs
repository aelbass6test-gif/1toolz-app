const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs, query, where } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";

async function run() {
  const store = await getDoc(doc(db, 'stores_data', storeId));
  const storeData = store.data() || {};
  console.log("Store Document Keys:", Object.keys(storeData));
  const settings = storeData.settings || {};
  console.log("Settings Keys:", Object.keys(settings));
  
  console.log("=== CHECKING CASH HANDOVERS ===");
  const handovers = settings.cashHandovers || [];
  console.log("Total cashHandovers:", handovers.length);
  const foundHandovers = handovers.filter(h => 
    h.amount == 360 || 
    h.amount == -360 || 
    JSON.stringify(h).includes('جرد') || 
    JSON.stringify(h).includes('360')
  );
  console.log("Found in cashHandovers:", JSON.stringify(foundHandovers, null, 2));

  console.log("=== CHECKING CASH HOLDERS ===");
  const holders = settings.cashHolders || [];
  console.log("Total cashHolders:", holders.length);
  const foundHolders = holders.filter(h => 
    h.currentBalance == 360 || 
    JSON.stringify(h).includes('جرد') || 
    JSON.stringify(h).includes('360')
  );
  console.log("Found in cashHolders:", JSON.stringify(foundHolders, null, 2));

  if (handovers.length > 0) {
    console.log("First 3 Handovers:", JSON.stringify(handovers.slice(0, 3), null, 2));
  }
  
  process.exit(0);
}
run();
