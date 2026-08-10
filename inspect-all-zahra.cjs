const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";

async function run() {
  const collections = ['cash_holders', 'cash_handovers', 'transactions', 'wallet', 'partners', 'treasury_transactions'];
  for (const c of collections) {
      try {
          const snap = await getDocs(collection(db, c));
          console.log(`Collection [${c}] docs count:`, snap.size);
          snap.docs.forEach(d => {
              const str = JSON.stringify(d.data());
              if (str.includes('زهره') || str.includes('11975') || str.includes('4750') || str.includes('7225')) {
                  console.log(`  Found in ${c} doc ${d.id}:`, d.data());
              }
          });
      } catch (e) {
          console.log(`Error reading ${c}:`, e.message);
      }
  }

  // Also check store settings fields
  const store = await getDoc(doc(db, 'stores_data', storeId));
  const s = store.data().settings || {};
  console.log("Settings keys:", Object.keys(s));
  if (s.cashHolders) console.log("settings.cashHolders:", s.cashHolders);
  if (s.cashHandovers) console.log("settings.cashHandovers:", s.cashHandovers);

  process.exit(0);
}
run();
