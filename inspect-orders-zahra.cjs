const fs = require('fs');
const data = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');
const app = initializeApp(data);
const db = getFirestore(app, data.firestoreDatabaseId);

const storeId = "store-1771165841517-fkrbaec";

async function run() {
  const store = await getDoc(doc(db, 'stores_data', storeId));
  const s = store.data().settings || {};
  console.log("partnerTransactions:", s.partnerTransactions);

  const snap = await getDocs(collection(db, 'orders'));
  console.log("Orders count:", snap.size);
  let zahraAdvanceCount = 0;
  let zahraAdvanceSum = 0;
  snap.docs.forEach(d => {
      const o = d.data();
      const str = JSON.stringify(o);
      if (str.includes('زهره') || str.includes('زهرة')) {
          console.log("Order with Zahra:", d.id, o.advancePayment, o.advancePaymentPartnerId, o.cashHolderName, o.cashHolderId);
          if (o.advancePayment > 0) {
              zahraAdvanceCount++;
              zahraAdvanceSum += o.advancePayment;
          }
      }
  });
  console.log("zahraAdvanceCount:", zahraAdvanceCount, "zahraAdvanceSum:", zahraAdvanceSum);

  process.exit(0);
}
run();
