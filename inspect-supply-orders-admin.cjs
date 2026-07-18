const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with application default credentials on Cloud Run
initializeApp();

const db = getFirestore();

async function run() {
  try {
    const settingsRef = db.collection('stores_data');
    const snapshot = await settingsRef.get();
    console.log(`Found ${snapshot.size} stores:`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('Document ID:', doc.id, 'Store Name:', data.name);
      if (data.settings && data.settings.supplyOrders) {
          const supplyOrders = data.settings.supplyOrders;
          console.log(`Supply Orders count: ${supplyOrders.length}`);
          supplyOrders.forEach(so => {
              console.log(`- Order: ID=${so.id}, Ref=${so.referenceNumber || '(none)'}, TotalCost=${so.totalCost}, GrandTotal=${so.grandTotal}, Date=${so.date}, Status=${so.status}`);
              if (so.items) {
                  console.log(`  Items count: ${so.items.length}`);
                  so.items.forEach((item, idx) => {
                      console.log(`    Item ${idx+1}: name=${item.name || item.productName}, quantity=${item.quantity}, cost=${item.cost}, isReturn=${item.isReturn}`);
                  });
              }
          });
      } else {
          console.log('No supplyOrders in this store.');
      }
    });
  } catch (err) {
    console.error("Admin firestore read failed:", err);
  }
  process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
