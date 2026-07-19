const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const storeId = "store-1771165841517-fkrbaec";

async function run() {
  try {
    const storeDoc = await db.collection('stores_data').doc(storeId).get();
    if (!storeDoc.exists) {
      console.log(`Store ${storeId} does not exist`);
      return;
    }
    const storeData = storeDoc.data();
    console.log("=== STORE SETTINGS ===");
    console.log("Partners:", JSON.stringify(storeData.settings?.partners || [], null, 2));
    console.log("Cash Holders:", JSON.stringify(storeData.settings?.cashHolders || [], null, 2));
    console.log("Partner Transactions:", JSON.stringify(storeData.settings?.partnerTransactions || [], null, 2));

    // Let's check subcollections
    const collections = await db.collection('stores_data').doc(storeId).listCollections();
    console.log("Nested Subcollections:");
    for (const coll of collections) {
      console.log(`- ${coll.id}`);
      const snap = await coll.get();
      console.log(`  Size: ${snap.size}`);
      if (coll.id === 'orders') {
        snap.docs.forEach(doc => {
          const o = doc.data();
          console.log(`  Order: ID=${doc.id}, Num=${o.orderNumber || o.order_number}, Status=${o.status}, Channel=${o.channel}, Cust=${o.customerName}`);
          console.log(`    cashHolderId: ${o.cashHolderId}, cashHolderName: ${o.cashHolderName}`);
          console.log(`    advancePayment: ${o.advancePayment}, advancePaymentHolderId: ${o.advancePaymentHolderId}, advancePaymentHolderName: ${o.advancePaymentHolderName}`);
        });
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
