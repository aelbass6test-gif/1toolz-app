
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('orderNumber', '==', '1'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('No order #1 found among all orders');
      // Try string vs number just in case
      const q2 = query(ordersRef, where('orderNumber', '==', 1));
      const snapshot2 = await getDocs(q2);
      if (snapshot2.empty) {
          console.log('Fetching first 5 orders to see structure...');
          const q3 = query(ordersRef);
          const snap3 = await getDocs(q3);
          snap3.docs.slice(0, 5).forEach(d => console.log(d.id, d.data().orderNumber));
          return;
      }
      snapshot2.forEach(doc => {
          console.log('Order #1 (number) Data:', JSON.stringify(doc.data(), null, 2));
      });
    } else {
      snapshot.forEach(doc => {
        console.log('Order #1 (string) Data:', JSON.stringify(doc.data(), null, 2));
      });
    }

    // Also look for transactions in settings if store ID is known
    const settingsSnap = await getDocs(collection(db, 'settings'));
    settingsSnap.forEach(doc => {
        const data = doc.data();
        if (data.wallet && data.wallet.transactions) {
            const related = data.wallet.transactions.filter(t => 
                (t.note && t.note.includes('#1')) || t.orderNumber === '1' || t.orderNumber === 1
            );
            if (related.length > 0) {
                console.log('Related Transactions in Settings:', JSON.stringify(related, null, 2));
            }
        }
    });

  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
